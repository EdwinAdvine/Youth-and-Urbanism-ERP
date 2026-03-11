"""Finance API — Recurring Invoices."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.models.finance import Invoice, RecurringInvoice

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class RecurringInvoiceCreate(BaseModel):
    source_invoice_id: uuid.UUID | None = None
    customer_name: str
    customer_email: str | None = None
    frequency: str  # daily, weekly, monthly, quarterly, yearly
    next_date: date
    end_date: date | None = None
    items: list[dict[str, Any]] | None = None
    subtotal: Decimal = Decimal("0")
    tax_amount: Decimal = Decimal("0")
    total: Decimal = Decimal("0")
    currency: str = "USD"
    notes: str | None = None


class RecurringInvoiceUpdate(BaseModel):
    customer_name: str | None = None
    customer_email: str | None = None
    frequency: str | None = None
    next_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None
    items: list[dict[str, Any]] | None = None
    subtotal: Decimal | None = None
    tax_amount: Decimal | None = None
    total: Decimal | None = None
    currency: str | None = None
    notes: str | None = None


class RecurringInvoiceOut(BaseModel):
    id: uuid.UUID
    source_invoice_id: uuid.UUID | None
    customer_name: str
    customer_email: str | None
    frequency: str
    next_date: date
    end_date: date | None
    is_active: bool
    items: list[dict[str, Any]] | None
    subtotal: Decimal
    tax_amount: Decimal
    total: Decimal
    currency: str
    notes: str | None
    owner_id: uuid.UUID
    last_generated: date | None
    invoices_generated: int
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

FREQUENCY_DELTAS = {
    "daily": timedelta(days=1),
    "weekly": timedelta(weeks=1),
    "monthly": None,  # handled specially
    "quarterly": None,
    "yearly": None,
}


def _advance_date(current: date, frequency: str) -> date:
    """Calculate the next occurrence date based on frequency."""
    if frequency == "daily":
        return current + timedelta(days=1)
    elif frequency == "weekly":
        return current + timedelta(weeks=1)
    elif frequency == "monthly":
        month = current.month % 12 + 1
        year = current.year + (1 if current.month == 12 else 0)
        day = min(current.day, 28)  # safe day
        return current.replace(year=year, month=month, day=day)
    elif frequency == "quarterly":
        month = current.month + 3
        year = current.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        day = min(current.day, 28)
        return current.replace(year=year, month=month, day=day)
    elif frequency == "yearly":
        return current.replace(year=current.year + 1)
    else:
        return current + timedelta(days=30)


async def _generate_invoice_number(db: Any) -> str:
    """Generate an auto-incrementing invoice number like INV-2026-0001."""
    year = datetime.utcnow().year
    pattern = f"INV-{year}-%"
    result = await db.execute(
        select(func.count()).select_from(Invoice).where(Invoice.invoice_number.like(pattern))
    )
    count = (result.scalar() or 0) + 1
    return f"INV-{year}-{count:04d}"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/recurring-invoices", status_code=status.HTTP_201_CREATED, summary="Create a recurring invoice config")
async def create_recurring_invoice(
    payload: RecurringInvoiceCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    if payload.frequency not in ("daily", "weekly", "monthly", "quarterly", "yearly"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="frequency must be one of: daily, weekly, monthly, quarterly, yearly",
        )

    # Calculate totals from items if not provided
    subtotal = payload.subtotal
    tax_amount = payload.tax_amount
    total = payload.total

    if payload.items and subtotal == Decimal("0"):
        subtotal = sum(
            Decimal(str(item.get("quantity", 0))) * Decimal(str(item.get("unit_price", 0)))
            for item in payload.items
            if isinstance(item, dict)
        )
        total = subtotal + tax_amount

    recurring = RecurringInvoice(
        source_invoice_id=payload.source_invoice_id,
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        frequency=payload.frequency,
        next_date=payload.next_date,
        end_date=payload.end_date,
        items=payload.items,
        subtotal=subtotal,
        tax_amount=tax_amount,
        total=total,
        currency=payload.currency,
        notes=payload.notes,
        owner_id=current_user.id,
    )
    db.add(recurring)
    await db.commit()
    await db.refresh(recurring)
    return RecurringInvoiceOut.model_validate(recurring).model_dump()


@router.get("/recurring-invoices", summary="List recurring invoice configs")
async def list_recurring_invoices(
    current_user: CurrentUser,
    db: DBSession,
    is_active: bool | None = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(RecurringInvoice).where(RecurringInvoice.owner_id == current_user.id)

    if is_active is not None:
        query = query.where(RecurringInvoice.is_active == is_active)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(RecurringInvoice.next_date.asc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    items = result.scalars().all()
    return {
        "total": total,
        "recurring_invoices": [RecurringInvoiceOut.model_validate(r) for r in items],
    }


@router.get("/recurring-invoices/{recurring_id}", summary="Get recurring invoice config")
async def get_recurring_invoice(
    recurring_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    recurring = await db.get(RecurringInvoice, recurring_id)
    if not recurring:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring invoice not found")
    if recurring.owner_id != current_user.id and not current_user.is_superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return RecurringInvoiceOut.model_validate(recurring).model_dump()


@router.put("/recurring-invoices/{recurring_id}", summary="Update / pause a recurring invoice config")
async def update_recurring_invoice(
    recurring_id: uuid.UUID,
    payload: RecurringInvoiceUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    recurring = await db.get(RecurringInvoice, recurring_id)
    if not recurring:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring invoice not found")
    if recurring.owner_id != current_user.id and not current_user.is_superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    if payload.frequency is not None and payload.frequency not in ("daily", "weekly", "monthly", "quarterly", "yearly"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="frequency must be one of: daily, weekly, monthly, quarterly, yearly",
        )

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(recurring, field, value)

    await db.commit()
    await db.refresh(recurring)
    return RecurringInvoiceOut.model_validate(recurring).model_dump()


@router.delete(
    "/recurring-invoices/{recurring_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a recurring invoice config",
)
async def delete_recurring_invoice(
    recurring_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    recurring = await db.get(RecurringInvoice, recurring_id)
    if not recurring:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring invoice not found")
    if recurring.owner_id != current_user.id and not current_user.is_superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    await db.delete(recurring)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/recurring-invoices/{recurring_id}/generate",
    status_code=status.HTTP_201_CREATED,
    summary="Manually generate the next invoice from a recurring config",
)
async def generate_recurring_invoice(
    recurring_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    recurring = await db.get(RecurringInvoice, recurring_id)
    if not recurring:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring invoice not found")
    if recurring.owner_id != current_user.id and not current_user.is_superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    if not recurring.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Recurring invoice is paused / inactive",
        )

    if recurring.end_date and recurring.next_date > recurring.end_date:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Recurring invoice has passed its end date",
        )

    # Generate invoice
    invoice_number = await _generate_invoice_number(db)
    due_date = recurring.next_date + timedelta(days=30)

    invoice = Invoice(
        invoice_number=invoice_number,
        invoice_type="sales",
        customer_name=recurring.customer_name,
        customer_email=recurring.customer_email,
        issue_date=recurring.next_date,
        due_date=due_date,
        subtotal=recurring.subtotal,
        tax_amount=recurring.tax_amount,
        total=recurring.total,
        currency=recurring.currency,
        notes=recurring.notes,
        items=recurring.items,
        owner_id=recurring.owner_id,
    )
    db.add(invoice)

    # Advance recurring schedule
    recurring.last_generated = recurring.next_date
    recurring.invoices_generated = (recurring.invoices_generated or 0) + 1
    recurring.next_date = _advance_date(recurring.next_date, recurring.frequency)

    # Auto-deactivate if past end date
    if recurring.end_date and recurring.next_date > recurring.end_date:
        recurring.is_active = False

    await db.commit()
    await db.refresh(invoice)

    await event_bus.publish("recurring_invoice.generated", {
        "recurring_id": str(recurring.id),
        "invoice_id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "total": str(invoice.total),
        "currency": invoice.currency,
    })

    return {
        "invoice": {
            "id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "issue_date": str(invoice.issue_date),
            "due_date": str(invoice.due_date),
            "total": str(invoice.total),
            "currency": invoice.currency,
            "status": invoice.status,
        },
        "next_date": str(recurring.next_date),
        "invoices_generated": recurring.invoices_generated,
    }
