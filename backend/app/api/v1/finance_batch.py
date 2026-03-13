"""Finance Batch Operations + Revenue Recognition endpoints.

Batch: create/update/approve multiple invoices, expenses, vendor bills at once.
Revenue Recognition: IFRS 15 / ASC 606 deferred revenue schedule management.
Custom Fields: define and list custom fields per entity type.
Dimensions: class/location/segment management.
"""

import csv
import io
import uuid
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.models.finance import (
    CustomField,
    Dimension,
    Expense,
    Invoice,
    RevenueRecognitionSchedule,
)

router = APIRouter(tags=["Finance Batch & Revenue Recognition"])


# ──────────────────────────────────────────────────────────────────────────
# Batch Invoice Operations
# ──────────────────────────────────────────────────────────────────────────

class BatchInvoiceItem(BaseModel):
    customer_name: str
    customer_email: str | None = None
    issue_date: date
    due_date: date
    currency: str = "USD"
    items: list[dict] = []
    notes: str | None = None
    tax_rate: float = 0.0


class BatchInvoiceRequest(BaseModel):
    invoices: list[BatchInvoiceItem]
    invoice_type: str = "sales"


@router.post("/invoices/batch", status_code=status.HTTP_201_CREATED)
async def batch_create_invoices(
    payload: BatchInvoiceRequest,
    db: DBSession,
    current_user: CurrentUser,
):
    """Batch create multiple invoices in a single request."""
    if len(payload.invoices) > 500:
        raise HTTPException(status_code=400, detail="Maximum 500 invoices per batch")

    today_str = date.today().strftime("%Y%m%d")
    count_result = await db.execute(
        select(func.count()).select_from(Invoice).where(Invoice.invoice_number.like(f"INV-{today_str}%"))
    )
    start_seq = (count_result.scalar_one() or 0) + 1

    created = []
    errors = []
    for i, inv_data in enumerate(payload.invoices):
        try:
            # Calculate totals from items
            subtotal = Decimal("0")
            tax_amount = Decimal("0")
            serialized_items = []
            for item in inv_data.items:
                qty = Decimal(str(item.get("quantity", 1)))
                price = Decimal(str(item.get("unit_price", 0)))
                rate = Decimal(str(item.get("tax_rate", inv_data.tax_rate)))
                line = qty * price
                tax = line * (rate / Decimal("100"))
                subtotal += line
                tax_amount += tax
                serialized_items.append({**item, "amount": float(line)})

            total = subtotal + tax_amount
            inv_number = f"INV-{today_str}-{start_seq + i:04d}"

            invoice = Invoice(
                invoice_number=inv_number,
                invoice_type=payload.invoice_type,
                status="draft",
                customer_name=inv_data.customer_name,
                customer_email=inv_data.customer_email,
                issue_date=inv_data.issue_date,
                due_date=inv_data.due_date,
                subtotal=subtotal,
                tax_amount=tax_amount,
                total=total,
                currency=inv_data.currency,
                notes=inv_data.notes,
                items=serialized_items,
                owner_id=current_user.id,
            )
            db.add(invoice)
            await db.flush()
            created.append({"invoice_number": inv_number, "customer": inv_data.customer_name, "total": float(total)})
        except Exception as e:
            errors.append({"index": i, "customer": getattr(inv_data, "customer_name", "?"), "error": str(e)})

    await db.commit()
    return {
        "created_count": len(created),
        "error_count": len(errors),
        "created": created,
        "errors": errors,
    }


@router.post("/invoices/batch-send")
async def batch_send_invoices(
    invoice_ids: list[uuid.UUID],
    db: DBSession,
    current_user: CurrentUser,
):
    """Mark multiple draft invoices as sent."""
    if len(invoice_ids) > 200:
        raise HTTPException(status_code=400, detail="Maximum 200 invoices per batch")

    result = await db.execute(
        select(Invoice).where(Invoice.id.in_(invoice_ids), Invoice.status == "draft")
    )
    invoices = result.scalars().all()
    for inv in invoices:
        inv.status = "sent"
    await db.commit()
    return {"updated_count": len(invoices), "skipped": len(invoice_ids) - len(invoices)}


@router.post("/invoices/batch-import-csv")
async def batch_import_invoices_csv(
    file: UploadFile = File(...),
    invoice_type: str = "sales",
    db: DBSession = None,
    current_user: CurrentUser = None,
):
    """Import invoices from CSV. Expected columns: customer_name, customer_email, amount, due_date, description."""
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    today = date.today()
    today_str = today.strftime("%Y%m%d")
    count_result = await db.execute(
        select(func.count()).select_from(Invoice).where(Invoice.invoice_number.like(f"INV-{today_str}%"))
    )
    seq = (count_result.scalar_one() or 0) + 1

    created = []
    errors = []
    for i, row in enumerate(reader):
        try:
            amount = Decimal(str(row.get("amount", "0")))
            due_date_str = row.get("due_date", str(today + timedelta(days=30)))
            due_date = date.fromisoformat(due_date_str)

            inv = Invoice(
                invoice_number=f"INV-{today_str}-{seq + i:04d}",
                invoice_type=invoice_type,
                status="draft",
                customer_name=row.get("customer_name", ""),
                customer_email=row.get("customer_email"),
                issue_date=today,
                due_date=due_date,
                subtotal=amount,
                tax_amount=Decimal("0"),
                total=amount,
                currency=row.get("currency", "USD"),
                notes=row.get("description") or row.get("notes"),
                items=[{"description": row.get("description", ""), "quantity": 1, "unit_price": float(amount), "amount": float(amount)}],
                owner_id=current_user.id,
            )
            db.add(inv)
            await db.flush()
            created.append({"invoice_number": inv.invoice_number, "customer": inv.customer_name})
        except Exception as e:
            errors.append({"row": i + 2, "error": str(e)})

    await db.commit()
    return {"created_count": len(created), "error_count": len(errors), "created": created, "errors": errors}


# ──────────────────────────────────────────────────────────────────────────
# Batch Expense Operations
# ──────────────────────────────────────────────────────────────────────────

@router.post("/expenses/batch-approve")
async def batch_approve_expenses(
    expense_ids: list[uuid.UUID],
    db: DBSession,
    current_user: CurrentUser,
):
    """Approve multiple submitted expenses at once."""
    from datetime import datetime, timezone
    from app.services.finance_auto_je import on_expense_approved

    result = await db.execute(
        select(Expense).where(Expense.id.in_(expense_ids), Expense.status == "submitted")
    )
    expenses = result.scalars().all()
    je_count = 0
    for exp in expenses:
        exp.status = "approved"
        exp.approver_id = current_user.id
        exp.approved_at = datetime.now(timezone.utc)
        await db.flush()
        je = await on_expense_approved(db, exp.id, current_user.id)
        if je:
            je_count += 1

    await db.commit()
    return {
        "approved_count": len(expenses),
        "skipped": len(expense_ids) - len(expenses),
        "journal_entries_posted": je_count,
    }


@router.post("/expenses/batch-import-csv")
async def batch_import_expenses_csv(
    file: UploadFile = File(...),
    db: DBSession = None,
    current_user: CurrentUser = None,
):
    """Import expenses from CSV. Columns: description, amount, category, expense_date, currency."""
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    created = []
    errors = []
    for i, row in enumerate(reader):
        try:
            exp = Expense(
                description=row.get("description", "Imported expense"),
                amount=Decimal(str(row.get("amount", "0"))),
                currency=row.get("currency", "USD"),
                category=row.get("category", "other"),
                expense_date=date.fromisoformat(row.get("expense_date", str(date.today()))),
                status="draft",
                user_id=current_user.id,
            )
            db.add(exp)
            await db.flush()
            created.append({"id": str(exp.id), "description": exp.description, "amount": float(exp.amount)})
        except Exception as e:
            errors.append({"row": i + 2, "error": str(e)})

    await db.commit()
    return {"created_count": len(created), "error_count": len(errors), "created": created, "errors": errors}


# ──────────────────────────────────────────────────────────────────────────
# Revenue Recognition (IFRS 15 / ASC 606)
# ──────────────────────────────────────────────────────────────────────────

class RevenueRecognitionCreate(BaseModel):
    invoice_id: uuid.UUID
    total_amount: Decimal
    recognition_method: str = "straight_line"  # straight_line, milestone, percentage_complete
    start_date: date
    end_date: date
    revenue_account_id: uuid.UUID | None = None
    deferred_account_id: uuid.UUID | None = None


@router.post("/revenue-recognition", status_code=status.HTTP_201_CREATED)
async def create_revenue_recognition_schedule(
    payload: RevenueRecognitionCreate,
    db: DBSession,
    current_user: CurrentUser,
):
    """Create a revenue recognition schedule for an invoice (IFRS 15 compliant)."""
    # Validate invoice exists
    inv_result = await db.execute(select(Invoice).where(Invoice.id == payload.invoice_id))
    if not inv_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Build schedule lines for straight-line method
    schedule_lines = []
    if payload.recognition_method == "straight_line":
        total_months = (
            (payload.end_date.year - payload.start_date.year) * 12
            + (payload.end_date.month - payload.start_date.month)
            + 1
        )
        monthly_amount = payload.total_amount / max(total_months, 1)
        current = payload.start_date
        for m in range(total_months):
            period = f"{current.year}-{current.month:02d}"
            schedule_lines.append({
                "period": period,
                "amount": float(round(monthly_amount, 2)),
                "recognized": False,
                "je_id": None,
            })
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)

    schedule = RevenueRecognitionSchedule(
        invoice_id=payload.invoice_id,
        total_amount=payload.total_amount,
        recognized_amount=Decimal("0"),
        deferred_amount=payload.total_amount,
        recognition_method=payload.recognition_method,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status="active",
        revenue_account_id=payload.revenue_account_id,
        deferred_account_id=payload.deferred_account_id,
        schedule_lines=schedule_lines,
        owner_id=current_user.id,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return {
        "id": str(schedule.id),
        "invoice_id": str(schedule.invoice_id),
        "total_amount": float(schedule.total_amount),
        "recognition_method": schedule.recognition_method,
        "periods": len(schedule_lines),
        "status": schedule.status,
    }


@router.get("/revenue-recognition")
async def list_revenue_recognition_schedules(
    db: DBSession,
    current_user: CurrentUser,
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    q = select(RevenueRecognitionSchedule)
    if status_filter:
        q = q.where(RevenueRecognitionSchedule.status == status_filter)
    q = q.order_by(RevenueRecognitionSchedule.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(q)
    schedules = result.scalars().all()
    return {
        "items": [
            {
                "id": str(s.id),
                "invoice_id": str(s.invoice_id),
                "total_amount": float(s.total_amount),
                "recognized_amount": float(s.recognized_amount),
                "deferred_amount": float(s.deferred_amount),
                "recognition_method": s.recognition_method,
                "start_date": str(s.start_date),
                "end_date": str(s.end_date),
                "status": s.status,
                "progress_pct": round(float(s.recognized_amount) / max(float(s.total_amount), 1) * 100, 1),
            }
            for s in schedules
        ]
    }


@router.post("/revenue-recognition/{schedule_id}/run-period")
async def run_revenue_recognition_period(
    schedule_id: uuid.UUID,
    period: str,  # format: "2026-03"
    db: DBSession,
    current_user: CurrentUser,
):
    """Recognize revenue for a specific period — posts a journal entry."""
    result = await db.execute(
        select(RevenueRecognitionSchedule).where(RevenueRecognitionSchedule.id == schedule_id)
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if schedule.status != "active":
        raise HTTPException(status_code=400, detail=f"Schedule is {schedule.status}")

    # Find the period line
    lines = schedule.schedule_lines or []
    period_line = next((l for l in lines if l.get("period") == period), None)
    if not period_line:
        raise HTTPException(status_code=404, detail=f"Period '{period}' not found in schedule")
    if period_line.get("recognized"):
        raise HTTPException(status_code=400, detail=f"Period '{period}' already recognized")

    amount = Decimal(str(period_line["amount"]))

    # Post the JE if accounts are configured
    je_id = None
    if schedule.revenue_account_id and schedule.deferred_account_id:
        from app.services.finance_auto_je import _post_je
        je = await _post_je(
            db,
            description=f"Revenue recognition — {period}",
            debit_account_id=schedule.deferred_account_id,
            credit_account_id=schedule.revenue_account_id,
            amount=amount,
            metadata={"schedule_id": str(schedule_id), "period": period, "trigger": "revenue_recognition"},
            posted_by_id=current_user.id,
        )
        je_id = str(je.id)

    # Update the schedule line
    period_line["recognized"] = True
    period_line["je_id"] = je_id
    schedule.schedule_lines = [
        {**l, "recognized": True, "je_id": je_id} if l.get("period") == period else l
        for l in lines
    ]
    schedule.recognized_amount = schedule.recognized_amount + amount
    schedule.deferred_amount = schedule.deferred_amount - amount

    # Check if fully recognized
    if all(l.get("recognized") for l in schedule.schedule_lines):
        schedule.status = "completed"

    await db.commit()
    return {
        "period": period,
        "amount_recognized": float(amount),
        "journal_entry_id": je_id,
        "total_recognized": float(schedule.recognized_amount),
        "total_deferred": float(schedule.deferred_amount),
        "schedule_status": schedule.status,
    }


# ──────────────────────────────────────────────────────────────────────────
# Custom Fields Management
# ──────────────────────────────────────────────────────────────────────────

class CustomFieldCreate(BaseModel):
    entity_type: str
    field_name: str
    field_label: str
    field_type: str
    options: list[str] | None = None
    is_required: bool = False
    sort_order: int = 0
    placeholder: str | None = None
    default_value: str | None = None


@router.get("/custom-fields")
async def list_custom_fields(
    db: DBSession,
    current_user: CurrentUser,
    entity_type: str | None = Query(None),
):
    q = select(CustomField).where(CustomField.is_active == True).order_by(CustomField.entity_type, CustomField.sort_order)
    if entity_type:
        q = q.where(CustomField.entity_type == entity_type)
    result = await db.execute(q)
    fields = result.scalars().all()
    return {
        "items": [
            {
                "id": str(f.id),
                "entity_type": f.entity_type,
                "field_name": f.field_name,
                "field_label": f.field_label,
                "field_type": f.field_type,
                "options": f.options,
                "is_required": f.is_required,
                "sort_order": f.sort_order,
                "placeholder": f.placeholder,
                "default_value": f.default_value,
            }
            for f in fields
        ]
    }


@router.post("/custom-fields", status_code=status.HTTP_201_CREATED)
async def create_custom_field(
    payload: CustomFieldCreate,
    db: DBSession,
    current_user: CurrentUser,
):
    # Check 100-field limit per entity type
    count_result = await db.execute(
        select(func.count()).select_from(CustomField).where(
            CustomField.entity_type == payload.entity_type,
            CustomField.is_active == True,
        )
    )
    if (count_result.scalar_one() or 0) >= 100:
        raise HTTPException(status_code=400, detail="Maximum 100 custom fields per entity type")

    field = CustomField(
        entity_type=payload.entity_type,
        field_name=payload.field_name,
        field_label=payload.field_label,
        field_type=payload.field_type,
        options=payload.options,
        is_required=payload.is_required,
        sort_order=payload.sort_order,
        placeholder=payload.placeholder,
        default_value=payload.default_value,
        owner_id=current_user.id,
    )
    db.add(field)
    await db.commit()
    await db.refresh(field)
    return {"id": str(field.id), "field_name": field.field_name, "entity_type": field.entity_type}


@router.delete("/custom-fields/{field_id}", status_code=status.HTTP_200_OK)
async def delete_custom_field(field_id: uuid.UUID, db: DBSession, current_user: CurrentUser):
    result = await db.execute(select(CustomField).where(CustomField.id == field_id))
    field = result.scalar_one_or_none()
    if not field:
        raise HTTPException(status_code=404, detail="Custom field not found")
    field.is_active = False  # Soft delete
    await db.commit()


# ──────────────────────────────────────────────────────────────────────────
# Dimensions (Classes / Locations / Segments)
# ──────────────────────────────────────────────────────────────────────────

class DimensionCreate(BaseModel):
    name: str
    code: str | None = None
    dimension_type: str  # class, location, department, project, custom
    parent_id: uuid.UUID | None = None
    description: str | None = None
    color: str | None = None


@router.get("/dimensions")
async def list_dimensions(
    db: DBSession,
    current_user: CurrentUser,
    dimension_type: str | None = Query(None),
    is_active: bool = Query(True),
):
    q = select(Dimension).where(Dimension.is_active == is_active).order_by(Dimension.dimension_type, Dimension.name)
    if dimension_type:
        q = q.where(Dimension.dimension_type == dimension_type)
    result = await db.execute(q)
    dims = result.scalars().all()
    return {
        "items": [
            {
                "id": str(d.id),
                "name": d.name,
                "code": d.code,
                "dimension_type": d.dimension_type,
                "parent_id": str(d.parent_id) if d.parent_id else None,
                "is_active": d.is_active,
                "description": d.description,
                "color": d.color,
            }
            for d in dims
        ]
    }


@router.post("/dimensions", status_code=status.HTTP_201_CREATED)
async def create_dimension(
    payload: DimensionCreate,
    db: DBSession,
    current_user: CurrentUser,
):
    dim = Dimension(
        name=payload.name,
        code=payload.code,
        dimension_type=payload.dimension_type,
        parent_id=payload.parent_id,
        description=payload.description,
        color=payload.color,
    )
    db.add(dim)
    await db.commit()
    await db.refresh(dim)
    return {"id": str(dim.id), "name": dim.name, "dimension_type": dim.dimension_type}


@router.put("/dimensions/{dim_id}")
async def update_dimension(
    dim_id: uuid.UUID,
    payload: DimensionCreate,
    db: DBSession,
    current_user: CurrentUser,
):
    result = await db.execute(select(Dimension).where(Dimension.id == dim_id))
    dim = result.scalar_one_or_none()
    if not dim:
        raise HTTPException(status_code=404, detail="Dimension not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(dim, field, value)
    await db.commit()
    return {"id": str(dim.id), "name": dim.name}


@router.delete("/dimensions/{dim_id}", status_code=status.HTTP_200_OK)
async def delete_dimension(dim_id: uuid.UUID, db: DBSession, current_user: CurrentUser):
    result = await db.execute(select(Dimension).where(Dimension.id == dim_id))
    dim = result.scalar_one_or_none()
    if not dim:
        raise HTTPException(status_code=404, detail="Dimension not found")
    dim.is_active = False
    await db.commit()
