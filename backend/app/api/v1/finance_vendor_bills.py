"""Finance API — Vendor Bills (Accounts Payable)."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.core.export import rows_to_csv
from app.models.finance import Payment, VendorBill

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class VendorBillCreate(BaseModel):
    vendor_name: str
    vendor_email: str | None = None
    issue_date: date
    due_date: date
    subtotal: Decimal = Decimal("0")
    tax_amount: Decimal = Decimal("0")
    total: Decimal = Decimal("0")
    currency: str = "USD"
    items: list[dict[str, Any]] | None = None
    reference: str | None = None
    notes: str | None = None


class VendorBillUpdate(BaseModel):
    vendor_name: str | None = None
    vendor_email: str | None = None
    issue_date: date | None = None
    due_date: date | None = None
    subtotal: Decimal | None = None
    tax_amount: Decimal | None = None
    total: Decimal | None = None
    currency: str | None = None
    items: list[dict[str, Any]] | None = None
    reference: str | None = None
    notes: str | None = None


class VendorBillPayRequest(BaseModel):
    payment_method: str = "bank_transfer"  # bank_transfer, cash, card, mobile_money
    payment_date: date | None = None
    reference: str | None = None


class VendorBillOut(BaseModel):
    id: uuid.UUID
    bill_number: str
    vendor_name: str
    vendor_email: str | None
    issue_date: date
    due_date: date
    subtotal: Decimal
    tax_amount: Decimal
    total: Decimal
    currency: str
    status: str
    items: list[dict[str, Any]] | None
    reference: str | None
    notes: str | None
    owner_id: uuid.UUID
    payment_id: uuid.UUID | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _generate_bill_number(db: Any) -> str:
    """Generate an auto-incrementing bill number like BILL-2026-0001."""
    year = datetime.utcnow().year
    pattern = f"BILL-{year}-%"
    result = await db.execute(
        select(func.count()).select_from(VendorBill).where(VendorBill.bill_number.like(pattern))
    )
    count = (result.scalar() or 0) + 1
    return f"BILL-{year}-{count:04d}"


async def _generate_payment_number(db: Any) -> str:
    """Generate an auto-incrementing payment number like PAY-2026-0001."""
    year = datetime.utcnow().year
    pattern = f"PAY-{year}-%"
    result = await db.execute(
        select(func.count()).select_from(Payment).where(Payment.payment_number.like(pattern))
    )
    count = (result.scalar() or 0) + 1
    return f"PAY-{year}-{count:04d}"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/vendor-bills", summary="List vendor bills")
async def list_vendor_bills(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    vendor: str | None = Query(None, description="Filter by vendor name (partial match)"),
    start_date: date | None = Query(None, description="Issue date start"),
    end_date: date | None = Query(None, description="Issue date end"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(VendorBill)

    if status_filter:
        query = query.where(VendorBill.status == status_filter)
    if vendor:
        query = query.where(VendorBill.vendor_name.ilike(f"%{vendor}%"))
    if start_date:
        query = query.where(VendorBill.issue_date >= start_date)
    if end_date:
        query = query.where(VendorBill.issue_date <= end_date)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(VendorBill.due_date.asc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    bills = result.scalars().all()
    return {
        "total": total,
        "vendor_bills": [VendorBillOut.model_validate(b) for b in bills],
    }


@router.post("/vendor-bills", status_code=status.HTTP_201_CREATED, summary="Create a vendor bill")
async def create_vendor_bill(
    payload: VendorBillCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    bill_number = await _generate_bill_number(db)

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

    bill = VendorBill(
        bill_number=bill_number,
        vendor_name=payload.vendor_name,
        vendor_email=payload.vendor_email,
        issue_date=payload.issue_date,
        due_date=payload.due_date,
        subtotal=subtotal,
        tax_amount=tax_amount,
        total=total,
        currency=payload.currency,
        status="draft",
        items=payload.items,
        reference=payload.reference,
        notes=payload.notes,
        owner_id=current_user.id,
    )
    db.add(bill)
    await db.commit()
    await db.refresh(bill)
    return VendorBillOut.model_validate(bill).model_dump()


@router.get("/vendor-bills/export", summary="Export vendor bills as CSV")
async def export_vendor_bills(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status"),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
):
    query = select(VendorBill)

    if status_filter:
        query = query.where(VendorBill.status == status_filter)
    if start_date:
        query = query.where(VendorBill.issue_date >= start_date)
    if end_date:
        query = query.where(VendorBill.issue_date <= end_date)

    result = await db.execute(query.order_by(VendorBill.due_date.asc()))
    bills = result.scalars().all()

    columns = [
        "id", "bill_number", "vendor_name", "vendor_email",
        "issue_date", "due_date", "subtotal", "tax_amount", "total",
        "currency", "status", "reference", "notes",
    ]
    rows = [
        {
            "id": str(b.id),
            "bill_number": b.bill_number,
            "vendor_name": b.vendor_name,
            "vendor_email": b.vendor_email or "",
            "issue_date": str(b.issue_date),
            "due_date": str(b.due_date),
            "subtotal": str(b.subtotal),
            "tax_amount": str(b.tax_amount),
            "total": str(b.total),
            "currency": b.currency,
            "status": b.status,
            "reference": b.reference or "",
            "notes": b.notes or "",
        }
        for b in bills
    ]
    return rows_to_csv(rows, columns, filename="vendor_bills_export.csv")


@router.get("/vendor-bills/{bill_id}", summary="Get vendor bill detail")
async def get_vendor_bill(
    bill_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    bill = await db.get(VendorBill, bill_id)
    if not bill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor bill not found")
    return VendorBillOut.model_validate(bill).model_dump()


@router.put("/vendor-bills/{bill_id}", summary="Update a vendor bill")
async def update_vendor_bill(
    bill_id: uuid.UUID,
    payload: VendorBillUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    bill = await db.get(VendorBill, bill_id)
    if not bill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor bill not found")
    if bill.status in ("paid", "cancelled"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot update bill with status '{bill.status}'",
        )

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(bill, field, value)

    await db.commit()
    await db.refresh(bill)
    return VendorBillOut.model_validate(bill).model_dump()


@router.put(
    "/vendor-bills/{bill_id}/approve",
    summary="Approve a vendor bill (Finance Admin)",
    dependencies=[Depends(require_app_admin("Finance"))],
)
async def approve_vendor_bill(
    bill_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    bill = await db.get(VendorBill, bill_id)
    if not bill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor bill not found")
    if bill.status not in ("draft", "received"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot approve bill with status '{bill.status}'",
        )

    bill.status = "approved"
    await db.commit()
    await db.refresh(bill)

    await event_bus.publish("vendor_bill.approved", {
        "bill_id": str(bill.id),
        "bill_number": bill.bill_number,
        "vendor_name": bill.vendor_name,
        "total": str(bill.total),
        "currency": bill.currency,
    })

    return VendorBillOut.model_validate(bill).model_dump()


@router.post(
    "/vendor-bills/{bill_id}/pay",
    status_code=status.HTTP_201_CREATED,
    summary="Pay a vendor bill (creates Payment record)",
    dependencies=[Depends(require_app_admin("Finance"))],
)
async def pay_vendor_bill(
    bill_id: uuid.UUID,
    payload: VendorBillPayRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    bill = await db.get(VendorBill, bill_id)
    if not bill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor bill not found")
    if bill.status == "paid":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bill is already paid")
    if bill.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot pay a cancelled bill")

    # Create a payment record
    payment_number = await _generate_payment_number(db)
    payment_date = payload.payment_date or date.today()

    payment = Payment(
        payment_number=payment_number,
        invoice_id=None,  # vendor bills are not linked to invoices
        amount=bill.total,
        currency=bill.currency,
        payment_method=payload.payment_method,
        payment_date=payment_date,
        reference=payload.reference or f"Payment for {bill.bill_number}",
        status="completed",
        payer_id=current_user.id,
    )
    db.add(payment)
    await db.flush()

    # Mark bill as paid
    bill.status = "paid"
    bill.payment_id = payment.id
    await db.commit()
    await db.refresh(bill)
    await db.refresh(payment)

    await event_bus.publish("vendor_bill.paid", {
        "bill_id": str(bill.id),
        "bill_number": bill.bill_number,
        "payment_id": str(payment.id),
        "payment_number": payment.payment_number,
        "amount": str(payment.amount),
        "currency": payment.currency,
        "vendor_name": bill.vendor_name,
    })

    return {
        "bill": VendorBillOut.model_validate(bill).model_dump(),
        "payment": {
            "id": str(payment.id),
            "payment_number": payment.payment_number,
            "amount": str(payment.amount),
            "currency": payment.currency,
            "payment_method": payment.payment_method,
            "payment_date": str(payment.payment_date),
            "status": payment.status,
        },
    }


@router.delete(
    "/vendor-bills/{bill_id}",
    status_code=status.HTTP_200_OK,
    summary="Cancel a vendor bill (soft-delete)",
)
async def delete_vendor_bill(
    bill_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    bill = await db.get(VendorBill, bill_id)
    if not bill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor bill not found")
    if bill.status == "paid":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot cancel a paid bill",
        )
    if bill.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bill is already cancelled",
        )

    bill.status = "cancelled"
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)
