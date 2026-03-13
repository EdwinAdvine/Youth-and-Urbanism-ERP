"""Estimates (Quotes) endpoints — create, send, accept, convert to invoice."""

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.models.finance import Estimate, Invoice

router = APIRouter(tags=["Finance Estimates"])


# ── Schemas ────────────────────────────────────────────────────────────────

class EstimateItemSchema(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price: float
    tax_rate: float = 0.0
    amount: float | None = None


class EstimateCreate(BaseModel):
    customer_name: str | None = None
    customer_email: str | None = None
    issue_date: date
    expiry_date: date
    currency: str = "USD"
    items: list[EstimateItemSchema] = []
    notes: str | None = None
    terms: str | None = None
    custom_fields: dict | None = None
    dimension_ids: list | None = None


class EstimateUpdate(BaseModel):
    customer_name: str | None = None
    customer_email: str | None = None
    issue_date: date | None = None
    expiry_date: date | None = None
    currency: str | None = None
    items: list[EstimateItemSchema] | None = None
    notes: str | None = None
    terms: str | None = None
    custom_fields: dict | None = None
    dimension_ids: list | None = None
    status: str | None = None


class ConvertToInvoiceParams(BaseModel):
    due_days: int = 30  # invoice due date = today + due_days


def _calculate_totals(items: list[Any]) -> tuple[Decimal, Decimal, Decimal]:
    subtotal = Decimal("0")
    tax_amount = Decimal("0")
    for item in items:
        qty = Decimal(str(item.quantity if hasattr(item, "quantity") else item.get("quantity", 1)))
        price = Decimal(str(item.unit_price if hasattr(item, "unit_price") else item.get("unit_price", 0)))
        tax_rate = Decimal(str(item.tax_rate if hasattr(item, "tax_rate") else item.get("tax_rate", 0)))
        line_total = qty * price
        line_tax = line_total * (tax_rate / Decimal("100"))
        subtotal += line_total
        tax_amount += line_tax
    return subtotal, tax_amount, subtotal + tax_amount


async def _generate_estimate_number(db: DBSession) -> str:
    today = date.today().strftime("%Y%m%d")
    result = await db.execute(
        select(func.count()).select_from(Estimate).where(
            Estimate.estimate_number.like(f"EST-{today}%")
        )
    )
    count = result.scalar_one() or 0
    return f"EST-{today}-{count + 1:04d}"


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/estimates")
async def list_estimates(
    db: DBSession,
    current_user: CurrentUser,
    status: str | None = Query(None),
    customer: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
):
    """List estimates with optional filters."""
    q = select(Estimate)
    if status:
        q = q.where(Estimate.status == status)
    if customer:
        q = q.where(Estimate.customer_name.ilike(f"%{customer}%"))
    q = q.order_by(Estimate.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(q)
    estimates = result.scalars().all()

    count_q = select(func.count()).select_from(Estimate)
    if status:
        count_q = count_q.where(Estimate.status == status)
    total = (await db.execute(count_q)).scalar_one()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": str(e.id),
                "estimate_number": e.estimate_number,
                "status": e.status,
                "customer_name": e.customer_name,
                "customer_email": e.customer_email,
                "issue_date": str(e.issue_date),
                "expiry_date": str(e.expiry_date),
                "total": float(e.total),
                "currency": e.currency,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in estimates
        ],
    }


@router.post("/estimates", status_code=status.HTTP_201_CREATED)
async def create_estimate(
    payload: EstimateCreate,
    db: DBSession,
    current_user: CurrentUser,
):
    """Create a new estimate/quote."""
    subtotal, tax_amount, total = _calculate_totals(payload.items)
    estimate_number = await _generate_estimate_number(db)

    estimate = Estimate(
        estimate_number=estimate_number,
        status="draft",
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        issue_date=payload.issue_date,
        expiry_date=payload.expiry_date,
        subtotal=subtotal,
        tax_amount=tax_amount,
        total=total,
        currency=payload.currency,
        notes=payload.notes,
        terms=payload.terms,
        items=[i.model_dump() for i in payload.items],
        custom_fields=payload.custom_fields,
        dimension_ids=payload.dimension_ids,
        owner_id=current_user.id,
    )
    db.add(estimate)
    await db.commit()
    await db.refresh(estimate)
    return {"id": str(estimate.id), "estimate_number": estimate.estimate_number, "status": estimate.status}


@router.get("/estimates/{estimate_id}")
async def get_estimate(estimate_id: uuid.UUID, db: DBSession, current_user: CurrentUser):
    result = await db.execute(select(Estimate).where(Estimate.id == estimate_id))
    estimate = result.scalar_one_or_none()
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")

    return {
        "id": str(estimate.id),
        "estimate_number": estimate.estimate_number,
        "status": estimate.status,
        "customer_name": estimate.customer_name,
        "customer_email": estimate.customer_email,
        "issue_date": str(estimate.issue_date),
        "expiry_date": str(estimate.expiry_date),
        "subtotal": float(estimate.subtotal),
        "tax_amount": float(estimate.tax_amount),
        "total": float(estimate.total),
        "currency": estimate.currency,
        "notes": estimate.notes,
        "terms": estimate.terms,
        "items": estimate.items,
        "custom_fields": estimate.custom_fields,
        "dimension_ids": estimate.dimension_ids,
        "converted_invoice_id": str(estimate.converted_invoice_id) if estimate.converted_invoice_id else None,
        "created_at": estimate.created_at.isoformat() if estimate.created_at else None,
    }


@router.put("/estimates/{estimate_id}")
async def update_estimate(
    estimate_id: uuid.UUID,
    payload: EstimateUpdate,
    db: DBSession,
    current_user: CurrentUser,
):
    result = await db.execute(select(Estimate).where(Estimate.id == estimate_id))
    estimate = result.scalar_one_or_none()
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    if estimate.status == "converted":
        raise HTTPException(status_code=400, detail="Cannot edit a converted estimate")

    for field, value in payload.model_dump(exclude_none=True).items():
        if field == "items":
            items = payload.items or []
            subtotal, tax_amount, total = _calculate_totals(items)
            estimate.items = [i.model_dump() for i in items]
            estimate.subtotal = subtotal
            estimate.tax_amount = tax_amount
            estimate.total = total
        else:
            setattr(estimate, field, value)

    await db.commit()
    return {"id": str(estimate.id), "status": estimate.status}


@router.post("/estimates/{estimate_id}/send")
async def send_estimate(estimate_id: uuid.UUID, db: DBSession, current_user: CurrentUser):
    """Mark estimate as sent (email sending handled by mail module)."""
    result = await db.execute(select(Estimate).where(Estimate.id == estimate_id))
    estimate = result.scalar_one_or_none()
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    if estimate.status != "draft":
        raise HTTPException(status_code=400, detail=f"Cannot send estimate in status '{estimate.status}'")

    estimate.status = "sent"
    await db.commit()
    return {"message": "Estimate marked as sent", "status": "sent"}


@router.post("/estimates/{estimate_id}/accept")
async def accept_estimate(estimate_id: uuid.UUID, db: DBSession, current_user: CurrentUser):
    """Mark estimate as accepted by customer."""
    result = await db.execute(select(Estimate).where(Estimate.id == estimate_id))
    estimate = result.scalar_one_or_none()
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    if estimate.status not in ("sent", "draft"):
        raise HTTPException(status_code=400, detail=f"Cannot accept estimate in status '{estimate.status}'")

    estimate.status = "accepted"
    await db.commit()
    return {"message": "Estimate accepted", "status": "accepted"}


@router.post("/estimates/{estimate_id}/decline")
async def decline_estimate(estimate_id: uuid.UUID, db: DBSession, current_user: CurrentUser):
    """Mark estimate as declined."""
    result = await db.execute(select(Estimate).where(Estimate.id == estimate_id))
    estimate = result.scalar_one_or_none()
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")

    estimate.status = "declined"
    await db.commit()
    return {"message": "Estimate declined", "status": "declined"}


@router.post("/estimates/{estimate_id}/convert-to-invoice", status_code=status.HTTP_201_CREATED)
async def convert_estimate_to_invoice(
    estimate_id: uuid.UUID,
    params: ConvertToInvoiceParams,
    db: DBSession,
    current_user: CurrentUser,
):
    """Convert an accepted estimate into a sales invoice."""
    result = await db.execute(select(Estimate).where(Estimate.id == estimate_id))
    estimate = result.scalar_one_or_none()
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    if estimate.status == "converted":
        raise HTTPException(status_code=400, detail="Estimate already converted to invoice")
    if estimate.status == "declined":
        raise HTTPException(status_code=400, detail="Cannot convert a declined estimate")

    # Generate invoice number
    today = date.today()
    today_str = today.strftime("%Y%m%d")
    inv_count_result = await db.execute(
        select(func.count()).select_from(Invoice).where(Invoice.invoice_number.like(f"INV-{today_str}%"))
    )
    inv_count = inv_count_result.scalar_one() or 0
    invoice_number = f"INV-{today_str}-{inv_count + 1:04d}"

    from datetime import timedelta
    due_date = today + timedelta(days=params.due_days)

    invoice = Invoice(
        invoice_number=invoice_number,
        invoice_type="sales",
        status="draft",
        customer_name=estimate.customer_name,
        customer_email=estimate.customer_email,
        issue_date=today,
        due_date=due_date,
        subtotal=estimate.subtotal,
        tax_amount=estimate.tax_amount,
        total=estimate.total,
        currency=estimate.currency,
        notes=estimate.notes,
        items=estimate.items,
        custom_fields=estimate.custom_fields,
        dimension_ids=estimate.dimension_ids,
        owner_id=current_user.id,
    )
    db.add(invoice)
    await db.flush()

    # Link back and mark converted
    estimate.converted_invoice_id = invoice.id
    estimate.status = "converted"
    await db.commit()
    await db.refresh(invoice)

    return {
        "message": "Estimate converted to invoice",
        "invoice_id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "estimate_id": str(estimate_id),
    }


@router.delete("/estimates/{estimate_id}", status_code=status.HTTP_200_OK)
async def delete_estimate(estimate_id: uuid.UUID, db: DBSession, current_user: CurrentUser):
    result = await db.execute(select(Estimate).where(Estimate.id == estimate_id))
    estimate = result.scalar_one_or_none()
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    if estimate.status == "converted":
        raise HTTPException(status_code=400, detail="Cannot delete a converted estimate")
    await db.delete(estimate)
    await db.commit()
