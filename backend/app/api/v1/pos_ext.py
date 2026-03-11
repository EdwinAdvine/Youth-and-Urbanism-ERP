"""POS Extensions — Terminals, Discounts, Receipts, Cash Movements, Reports, Offline Sync."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.inventory import InventoryItem, StockLevel, StockMovement
from app.models.pos import (
    POSCashMovement,
    POSDiscount,
    POSPayment,
    POSReceipt,
    POSSession,
    POSTerminal,
    POSTransaction,
    POSTransactionLine,
)

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

# -- Terminals --

class TerminalIn(BaseModel):
    name: str
    location: str | None = None
    is_active: bool = True
    settings: dict[str, Any] | None = None


class TerminalOut(BaseModel):
    id: uuid.UUID
    name: str
    location: str | None
    is_active: bool
    settings: dict[str, Any] | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Discounts --

class DiscountIn(BaseModel):
    name: str
    discount_type: str  # percentage, fixed
    value: Decimal
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    conditions: dict[str, Any] | None = None
    is_active: bool = True


class DiscountOut(BaseModel):
    id: uuid.UUID
    name: str
    discount_type: str
    value: Decimal
    valid_from: Any | None
    valid_to: Any | None
    conditions: dict[str, Any] | None
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Receipts --

class ReceiptOut(BaseModel):
    id: uuid.UUID
    transaction_id: uuid.UUID
    receipt_number: str
    printed_at: Any | None
    created_at: Any

    model_config = {"from_attributes": True}


# -- Cash Movements --

class CashMovementIn(BaseModel):
    session_id: uuid.UUID
    movement_type: str  # in, out
    amount: Decimal
    reason: str


class CashMovementOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    movement_type: str
    amount: Decimal
    reason: str
    created_by: uuid.UUID
    created_at: Any

    model_config = {"from_attributes": True}


# -- Session close --

class SessionCloseExtIn(BaseModel):
    closing_balance: Decimal
    cash_counted: dict[str, Any] | None = None  # denomination breakdown
    notes: str | None = None


# -- Offline sync --

class OfflineTransactionLineIn(BaseModel):
    item_id: uuid.UUID
    quantity: int
    unit_price: Decimal
    discount_amount: Decimal = Decimal("0")


class OfflineTransactionPaymentIn(BaseModel):
    payment_method: str
    amount: Decimal
    reference: str | None = None


class OfflineTransactionIn(BaseModel):
    session_id: uuid.UUID
    customer_name: str | None = None
    customer_email: str | None = None
    discount_amount: Decimal = Decimal("0")
    discount_type: str | None = None
    tax_amount: Decimal = Decimal("0")
    lines: list[OfflineTransactionLineIn]
    payments: list[OfflineTransactionPaymentIn]
    offline_id: str | None = None  # client-generated ID for dedup
    created_at_offline: datetime | None = None  # original offline timestamp


class OfflineSyncIn(BaseModel):
    transactions: list[OfflineTransactionIn]


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _generate_sequence(db: DBSession, model: Any, prefix: str, number_field: str) -> str:
    """Generate an auto-incrementing number like PREFIX-2026-0001."""
    year = datetime.now(timezone.utc).year
    pattern = f"{prefix}-{year}-%"
    col = getattr(model, number_field)
    result = await db.execute(
        select(func.count()).select_from(model).where(col.like(pattern))
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}-{year}-{count:04d}"


# ── Terminal endpoints ───────────────────────────────────────────────────────

@router.get("/terminals", summary="List POS terminals")
async def list_terminals(
    current_user: CurrentUser,
    db: DBSession,
    is_active: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    query = select(POSTerminal)
    if is_active is not None:
        query = query.where(POSTerminal.is_active == is_active)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(POSTerminal.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    terminals = result.scalars().all()
    return {
        "total": total,
        "terminals": [TerminalOut.model_validate(t).model_dump() for t in terminals],
    }


@router.post("/terminals", status_code=status.HTTP_201_CREATED, summary="Create a POS terminal")
async def create_terminal(
    payload: TerminalIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    terminal = POSTerminal(
        name=payload.name,
        location=payload.location,
        is_active=payload.is_active,
        settings=payload.settings,
    )
    db.add(terminal)
    await db.commit()
    await db.refresh(terminal)
    return TerminalOut.model_validate(terminal).model_dump()


@router.put("/terminals/{terminal_id}", summary="Update a POS terminal")
async def update_terminal(
    terminal_id: uuid.UUID,
    payload: TerminalIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    terminal = await db.get(POSTerminal, terminal_id)
    if not terminal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Terminal not found")

    terminal.name = payload.name
    terminal.location = payload.location
    terminal.is_active = payload.is_active
    terminal.settings = payload.settings
    await db.commit()
    await db.refresh(terminal)
    return TerminalOut.model_validate(terminal).model_dump()


@router.delete("/terminals/{terminal_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete a POS terminal")
async def delete_terminal(
    terminal_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> None:
    terminal = await db.get(POSTerminal, terminal_id)
    if not terminal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Terminal not found")
    await db.delete(terminal)
    await db.commit()


# ── Session extended endpoints ───────────────────────────────────────────────

@router.post("/sessions/{session_id}/close", summary="Close a POS session with cash count")
async def close_session_ext(
    session_id: uuid.UUID,
    payload: SessionCloseExtIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    session = await db.get(POSSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session.cashier_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your session")
    if session.status != "open":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session is not open")

    # Calculate expected balance from completed transactions
    txn_result = await db.execute(
        select(func.coalesce(func.sum(POSTransaction.total), 0)).where(
            and_(
                POSTransaction.session_id == session_id,
                POSTransaction.status == "completed",
            )
        )
    )
    total_sales = txn_result.scalar() or Decimal("0")

    # Calculate total refunds
    refund_result = await db.execute(
        select(func.coalesce(func.sum(POSTransaction.total), 0)).where(
            and_(
                POSTransaction.session_id == session_id,
                POSTransaction.status == "refunded",
            )
        )
    )
    total_refunds = refund_result.scalar() or Decimal("0")

    # Include cash movements
    cash_in_result = await db.execute(
        select(func.coalesce(func.sum(POSCashMovement.amount), 0)).where(
            and_(
                POSCashMovement.session_id == session_id,
                POSCashMovement.movement_type == "in",
            )
        )
    )
    total_cash_in = cash_in_result.scalar() or Decimal("0")

    cash_out_result = await db.execute(
        select(func.coalesce(func.sum(POSCashMovement.amount), 0)).where(
            and_(
                POSCashMovement.session_id == session_id,
                POSCashMovement.movement_type == "out",
            )
        )
    )
    total_cash_out = cash_out_result.scalar() or Decimal("0")

    expected = session.opening_balance + total_sales - total_refunds + total_cash_in - total_cash_out
    difference = payload.closing_balance - expected

    session.closed_at = datetime.now(timezone.utc)
    session.closing_balance = payload.closing_balance
    session.expected_balance = expected
    session.difference = difference
    session.status = "closed"

    notes_parts = []
    if payload.notes:
        notes_parts.append(payload.notes)
    if payload.cash_counted:
        notes_parts.append(f"Cash counted: {payload.cash_counted}")
    if notes_parts:
        session.notes = (session.notes or "") + "\n" + " | ".join(notes_parts)

    await db.commit()
    await db.refresh(session)

    from app.api.v1.pos import SessionOut  # noqa: PLC0415

    return SessionOut.model_validate(session).model_dump()


@router.get("/sessions/{session_id}/summary", summary="Shift summary with totals")
async def session_summary(
    session_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    session = await db.get(POSSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Transaction counts by status
    status_counts_result = await db.execute(
        select(POSTransaction.status, func.count()).where(
            POSTransaction.session_id == session_id
        ).group_by(POSTransaction.status)
    )
    status_counts = dict(status_counts_result.all())

    # Total sales
    sales_result = await db.execute(
        select(func.coalesce(func.sum(POSTransaction.total), 0)).where(
            and_(
                POSTransaction.session_id == session_id,
                POSTransaction.status == "completed",
            )
        )
    )
    total_sales = sales_result.scalar() or Decimal("0")

    # Total refunds
    refund_result = await db.execute(
        select(func.coalesce(func.sum(POSTransaction.total), 0)).where(
            and_(
                POSTransaction.session_id == session_id,
                POSTransaction.status == "refunded",
            )
        )
    )
    total_refunds = refund_result.scalar() or Decimal("0")

    # Payment method breakdown
    method_result = await db.execute(
        select(POSPayment.payment_method, func.sum(POSPayment.amount)).join(
            POSTransaction, POSPayment.transaction_id == POSTransaction.id
        ).where(
            and_(
                POSTransaction.session_id == session_id,
                POSTransaction.status == "completed",
            )
        ).group_by(POSPayment.payment_method)
    )
    payment_methods = {method: str(amount) for method, amount in method_result.all()}

    # Cash movements
    cash_movements_result = await db.execute(
        select(POSCashMovement).where(
            POSCashMovement.session_id == session_id
        ).order_by(POSCashMovement.created_at.asc())
    )
    cash_movements = cash_movements_result.scalars().all()

    cash_in_total = sum(
        cm.amount for cm in cash_movements if cm.movement_type == "in"
    )
    cash_out_total = sum(
        cm.amount for cm in cash_movements if cm.movement_type == "out"
    )

    # Top products this session
    top_result = await db.execute(
        select(
            POSTransactionLine.item_name,
            POSTransactionLine.item_sku,
            func.sum(POSTransactionLine.quantity).label("qty_sold"),
            func.sum(POSTransactionLine.line_total).label("revenue"),
        ).join(
            POSTransaction, POSTransactionLine.transaction_id == POSTransaction.id
        ).where(
            and_(
                POSTransaction.session_id == session_id,
                POSTransaction.status == "completed",
            )
        ).group_by(
            POSTransactionLine.item_name, POSTransactionLine.item_sku
        ).order_by(
            func.sum(POSTransactionLine.quantity).desc()
        ).limit(10)
    )
    top_products = [
        {
            "item_name": r.item_name,
            "item_sku": r.item_sku,
            "quantity_sold": r.qty_sold,
            "revenue": str(r.revenue),
        }
        for r in top_result.all()
    ]

    from app.api.v1.pos import SessionOut  # noqa: PLC0415

    return {
        "session": SessionOut.model_validate(session).model_dump(),
        "transaction_counts": status_counts,
        "total_sales": str(total_sales),
        "total_refunds": str(total_refunds),
        "net_sales": str(total_sales - total_refunds),
        "payment_methods": payment_methods,
        "cash_in_total": str(cash_in_total),
        "cash_out_total": str(cash_out_total),
        "top_products": top_products,
        "cash_movements": [CashMovementOut.model_validate(cm).model_dump() for cm in cash_movements],
    }


# ── Discount endpoints ───────────────────────────────────────────────────────

@router.get("/discounts", summary="List POS discounts")
async def list_discounts(
    current_user: CurrentUser,
    db: DBSession,
    is_active: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    query = select(POSDiscount)
    if is_active is not None:
        query = query.where(POSDiscount.is_active == is_active)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(POSDiscount.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    discounts = result.scalars().all()
    return {
        "total": total,
        "discounts": [DiscountOut.model_validate(d).model_dump() for d in discounts],
    }


@router.post("/discounts", status_code=status.HTTP_201_CREATED, summary="Create a POS discount")
async def create_discount(
    payload: DiscountIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    if payload.discount_type not in ("percentage", "fixed"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="discount_type must be 'percentage' or 'fixed'",
        )
    if payload.discount_type == "percentage" and (payload.value < 0 or payload.value > 100):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Percentage discount must be between 0 and 100",
        )

    discount = POSDiscount(
        name=payload.name,
        discount_type=payload.discount_type,
        value=payload.value,
        valid_from=payload.valid_from,
        valid_to=payload.valid_to,
        conditions=payload.conditions,
        is_active=payload.is_active,
    )
    db.add(discount)
    await db.commit()
    await db.refresh(discount)
    return DiscountOut.model_validate(discount).model_dump()


@router.put("/discounts/{discount_id}", summary="Update a POS discount")
async def update_discount(
    discount_id: uuid.UUID,
    payload: DiscountIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    discount = await db.get(POSDiscount, discount_id)
    if not discount:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discount not found")

    if payload.discount_type not in ("percentage", "fixed"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="discount_type must be 'percentage' or 'fixed'",
        )

    discount.name = payload.name
    discount.discount_type = payload.discount_type
    discount.value = payload.value
    discount.valid_from = payload.valid_from
    discount.valid_to = payload.valid_to
    discount.conditions = payload.conditions
    discount.is_active = payload.is_active
    await db.commit()
    await db.refresh(discount)
    return DiscountOut.model_validate(discount).model_dump()


@router.delete("/discounts/{discount_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete a POS discount")
async def delete_discount(
    discount_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> None:
    discount = await db.get(POSDiscount, discount_id)
    if not discount:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discount not found")
    await db.delete(discount)
    await db.commit()


# ── Receipt endpoints ────────────────────────────────────────────────────────

@router.post(
    "/transactions/{txn_id}/receipt",
    status_code=status.HTTP_201_CREATED,
    summary="Generate a receipt for a transaction",
)
async def generate_receipt(
    txn_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(POSTransaction)
        .options(selectinload(POSTransaction.lines), selectinload(POSTransaction.payments))
        .where(POSTransaction.id == txn_id)
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    # Check if receipt already exists
    existing = await db.execute(
        select(POSReceipt).where(POSReceipt.transaction_id == txn_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Receipt already generated for this transaction",
        )

    receipt_number = await _generate_sequence(db, POSReceipt, "RCT", "receipt_number")

    receipt = POSReceipt(
        transaction_id=txn.id,
        receipt_number=receipt_number,
        printed_at=datetime.now(timezone.utc),
    )
    db.add(receipt)
    await db.commit()
    await db.refresh(receipt)

    return {
        "receipt": ReceiptOut.model_validate(receipt).model_dump(),
        "transaction_number": txn.transaction_number,
        "date": txn.created_at.isoformat(),
        "customer_name": txn.customer_name or "Walk-in Customer",
        "lines": [
            {
                "item_name": l.item_name,
                "item_sku": l.item_sku,
                "quantity": l.quantity,
                "unit_price": str(l.unit_price),
                "discount": str(l.discount_amount),
                "line_total": str(l.line_total),
            }
            for l in txn.lines
        ],
        "subtotal": str(txn.subtotal),
        "discount": str(txn.discount_amount),
        "tax": str(txn.tax_amount),
        "total": str(txn.total),
        "payments": [
            {
                "method": p.payment_method,
                "amount": str(p.amount),
                "reference": p.reference,
                "change": str(p.change_given),
            }
            for p in txn.payments
        ],
    }


# ── Refund (extended — with reason) ─────────────────────────────────────────

class RefundIn(BaseModel):
    reason: str | None = None
    line_ids: list[uuid.UUID] | None = None  # partial refund by line IDs; None = full


@router.post("/transactions/{txn_id}/refund", summary="Refund a POS transaction (full or partial)")
async def refund_transaction_ext(
    txn_id: uuid.UUID,
    payload: RefundIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(POSTransaction)
        .options(selectinload(POSTransaction.lines))
        .where(POSTransaction.id == txn_id)
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    if txn.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot refund transaction with status '{txn.status}'",
        )

    session = await db.get(POSSession, txn.session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Determine which lines to refund
    if payload.line_ids:
        lines_to_refund = [l for l in txn.lines if l.id in payload.line_ids]
        if not lines_to_refund:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No matching line items found for refund",
            )
    else:
        lines_to_refund = txn.lines

    refund_total = Decimal("0")
    for line in lines_to_refund:
        movement = StockMovement(
            item_id=line.item_id,
            warehouse_id=session.warehouse_id,
            movement_type="receipt",
            quantity=line.quantity,
            reference_type="pos_refund",
            reference_id=txn.id,
            notes=f"POS refund for {txn.transaction_number}" + (f" — {payload.reason}" if payload.reason else ""),
            created_by=current_user.id,
        )
        db.add(movement)

        sl_result = await db.execute(
            select(StockLevel).where(
                and_(
                    StockLevel.item_id == line.item_id,
                    StockLevel.warehouse_id == session.warehouse_id,
                )
            )
        )
        stock_level = sl_result.scalar_one_or_none()
        if stock_level:
            stock_level.quantity_on_hand += line.quantity
        else:
            db.add(StockLevel(
                item_id=line.item_id,
                warehouse_id=session.warehouse_id,
                quantity_on_hand=line.quantity,
            ))

        refund_total += line.line_total

    txn.status = "refunded"
    if payload.reason:
        txn.receipt_data = {**(txn.receipt_data or {}), "refund_reason": payload.reason}

    await db.commit()
    await db.refresh(txn)

    await event_bus.publish("pos.sale.refunded", {
        "transaction_id": str(txn.id),
        "transaction_number": txn.transaction_number,
        "refund_total": str(refund_total),
        "reason": payload.reason,
    })

    from app.api.v1.pos import TransactionOut  # noqa: PLC0415

    return TransactionOut.model_validate(txn).model_dump()


# ── Cash Movement endpoints ──────────────────────────────────────────────────

@router.post("/cash-movements", status_code=status.HTTP_201_CREATED, summary="Record a cash movement")
async def create_cash_movement(
    payload: CashMovementIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    if payload.movement_type not in ("in", "out"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="movement_type must be 'in' or 'out'",
        )

    session = await db.get(POSSession, payload.session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session.status != "open":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session is not open")

    movement = POSCashMovement(
        session_id=payload.session_id,
        movement_type=payload.movement_type,
        amount=payload.amount,
        reason=payload.reason,
        created_by=current_user.id,
    )
    db.add(movement)
    await db.commit()
    await db.refresh(movement)
    return CashMovementOut.model_validate(movement).model_dump()


@router.get("/sessions/{session_id}/cash-movements", summary="List cash movements for a session")
async def list_cash_movements(
    session_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    session = await db.get(POSSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    result = await db.execute(
        select(POSCashMovement).where(
            POSCashMovement.session_id == session_id
        ).order_by(POSCashMovement.created_at.asc())
    )
    movements = result.scalars().all()

    total_in = sum(m.amount for m in movements if m.movement_type == "in")
    total_out = sum(m.amount for m in movements if m.movement_type == "out")

    return {
        "total_in": str(total_in),
        "total_out": str(total_out),
        "net": str(total_in - total_out),
        "movements": [CashMovementOut.model_validate(m).model_dump() for m in movements],
    }


# ── Report endpoints ─────────────────────────────────────────────────────────

@router.get("/reports/daily-sales", summary="Daily sales report")
async def report_daily_sales(
    current_user: CurrentUser,
    db: DBSession,
    start_date: date = Query(..., description="Start date (inclusive)"),
    end_date: date = Query(..., description="End date (inclusive)"),
) -> dict[str, Any]:
    result = await db.execute(
        select(
            func.date(POSTransaction.created_at).label("sale_date"),
            func.count().label("transaction_count"),
            func.coalesce(func.sum(POSTransaction.total), 0).label("total_sales"),
            func.coalesce(func.sum(POSTransaction.discount_amount), 0).label("total_discounts"),
            func.coalesce(func.sum(POSTransaction.tax_amount), 0).label("total_tax"),
        ).where(
            and_(
                POSTransaction.status == "completed",
                func.date(POSTransaction.created_at) >= start_date,
                func.date(POSTransaction.created_at) <= end_date,
            )
        ).group_by(
            func.date(POSTransaction.created_at)
        ).order_by(
            func.date(POSTransaction.created_at).asc()
        )
    )
    rows = result.all()

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "days": [
            {
                "date": str(r.sale_date),
                "transaction_count": r.transaction_count,
                "total_sales": str(r.total_sales),
                "total_discounts": str(r.total_discounts),
                "total_tax": str(r.total_tax),
            }
            for r in rows
        ],
        "grand_total": str(sum(r.total_sales for r in rows)),
        "grand_count": sum(r.transaction_count for r in rows),
    }


@router.get("/reports/by-cashier", summary="Sales report grouped by cashier")
async def report_by_cashier(
    current_user: CurrentUser,
    db: DBSession,
    start_date: date = Query(..., description="Start date (inclusive)"),
    end_date: date = Query(..., description="End date (inclusive)"),
) -> dict[str, Any]:
    from app.models.user import User  # noqa: PLC0415

    result = await db.execute(
        select(
            POSSession.cashier_id,
            User.full_name,
            User.email,
            func.count(POSTransaction.id).label("transaction_count"),
            func.coalesce(func.sum(POSTransaction.total), 0).label("total_sales"),
        ).join(
            POSSession, POSTransaction.session_id == POSSession.id
        ).join(
            User, POSSession.cashier_id == User.id
        ).where(
            and_(
                POSTransaction.status == "completed",
                func.date(POSTransaction.created_at) >= start_date,
                func.date(POSTransaction.created_at) <= end_date,
            )
        ).group_by(
            POSSession.cashier_id, User.full_name, User.email
        ).order_by(
            func.coalesce(func.sum(POSTransaction.total), 0).desc()
        )
    )
    rows = result.all()

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "cashiers": [
            {
                "cashier_id": str(r.cashier_id),
                "name": r.full_name,
                "email": r.email,
                "transaction_count": r.transaction_count,
                "total_sales": str(r.total_sales),
            }
            for r in rows
        ],
    }


@router.get("/reports/by-product", summary="Sales report grouped by product")
async def report_by_product(
    current_user: CurrentUser,
    db: DBSession,
    start_date: date = Query(..., description="Start date (inclusive)"),
    end_date: date = Query(..., description="End date (inclusive)"),
    top_n: int = Query(50, ge=1, le=500, description="Number of top products"),
) -> dict[str, Any]:
    result = await db.execute(
        select(
            POSTransactionLine.item_id,
            POSTransactionLine.item_name,
            POSTransactionLine.item_sku,
            func.sum(POSTransactionLine.quantity).label("qty_sold"),
            func.sum(POSTransactionLine.line_total).label("revenue"),
            func.sum(POSTransactionLine.discount_amount).label("total_discount"),
        ).join(
            POSTransaction, POSTransactionLine.transaction_id == POSTransaction.id
        ).where(
            and_(
                POSTransaction.status == "completed",
                func.date(POSTransaction.created_at) >= start_date,
                func.date(POSTransaction.created_at) <= end_date,
            )
        ).group_by(
            POSTransactionLine.item_id,
            POSTransactionLine.item_name,
            POSTransactionLine.item_sku,
        ).order_by(
            func.sum(POSTransactionLine.line_total).desc()
        ).limit(top_n)
    )
    rows = result.all()

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "products": [
            {
                "item_id": str(r.item_id),
                "item_name": r.item_name,
                "item_sku": r.item_sku,
                "quantity_sold": r.qty_sold,
                "revenue": str(r.revenue),
                "total_discount": str(r.total_discount),
            }
            for r in rows
        ],
    }


# ── Offline Sync endpoint ───────────────────────────────────────────────────

@router.post("/transactions/offline-sync", summary="Batch import offline transactions")
async def offline_sync(
    payload: OfflineSyncIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Import a batch of transactions created while the POS was offline.

    Each transaction is validated and imported independently. Failures for
    individual transactions do not roll back the entire batch — results
    are returned per-transaction so the client can retry failures.
    """
    if not payload.transactions:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one transaction is required",
        )

    results: list[dict[str, Any]] = []

    for txn_in in payload.transactions:
        try:
            # Validate session exists
            session = await db.get(POSSession, txn_in.session_id)
            if not session:
                results.append({
                    "offline_id": txn_in.offline_id,
                    "status": "error",
                    "detail": f"Session {txn_in.session_id} not found",
                })
                continue

            if not txn_in.lines:
                results.append({
                    "offline_id": txn_in.offline_id,
                    "status": "error",
                    "detail": "At least one line item is required",
                })
                continue

            if not txn_in.payments:
                results.append({
                    "offline_id": txn_in.offline_id,
                    "status": "error",
                    "detail": "At least one payment is required",
                })
                continue

            # Build line models
            line_models: list[POSTransactionLine] = []
            subtotal = Decimal("0")
            skip_txn = False

            for line_in in txn_in.lines:
                item = await db.get(InventoryItem, line_in.item_id)
                if not item or not item.is_active:
                    results.append({
                        "offline_id": txn_in.offline_id,
                        "status": "error",
                        "detail": f"Item {line_in.item_id} not found or inactive",
                    })
                    skip_txn = True
                    break

                line_total = (line_in.unit_price * line_in.quantity) - line_in.discount_amount
                subtotal += line_total

                line_models.append(POSTransactionLine(
                    item_id=item.id,
                    item_name=item.name,
                    item_sku=item.sku,
                    quantity=line_in.quantity,
                    unit_price=line_in.unit_price,
                    discount_amount=line_in.discount_amount,
                    line_total=line_total,
                ))

            if skip_txn:
                continue

            total = subtotal - txn_in.discount_amount + txn_in.tax_amount

            # Generate sequence number
            txn_number = await _generate_sequence(db, POSTransaction, "TXN", "transaction_number")

            txn = POSTransaction(
                transaction_number=txn_number,
                session_id=txn_in.session_id,
                customer_name=txn_in.customer_name,
                customer_email=txn_in.customer_email,
                subtotal=subtotal,
                discount_amount=txn_in.discount_amount,
                discount_type=txn_in.discount_type,
                tax_amount=txn_in.tax_amount,
                total=total,
                created_by=current_user.id,
                receipt_data={"offline_id": txn_in.offline_id, "synced_at": datetime.now(timezone.utc).isoformat()},
            )
            db.add(txn)
            await db.flush()

            # Attach lines
            for lm in line_models:
                lm.transaction_id = txn.id
                db.add(lm)

            # Attach payments
            change = sum(p.amount for p in txn_in.payments) - total
            remaining_change = max(change, Decimal("0"))

            for p_in in txn_in.payments:
                p_change = Decimal("0")
                if p_in.payment_method == "cash" and remaining_change > 0:
                    p_change = remaining_change
                    remaining_change = Decimal("0")

                db.add(POSPayment(
                    transaction_id=txn.id,
                    payment_method=p_in.payment_method,
                    amount=p_in.amount,
                    reference=p_in.reference,
                    change_given=p_change,
                ))

            # Update stock levels
            for lm in line_models:
                sl_result = await db.execute(
                    select(StockLevel).where(
                        and_(
                            StockLevel.item_id == lm.item_id,
                            StockLevel.warehouse_id == session.warehouse_id,
                        )
                    )
                )
                stock_level = sl_result.scalar_one_or_none()
                if stock_level:
                    stock_level.quantity_on_hand -= lm.quantity

                # Stock movement
                db.add(StockMovement(
                    item_id=lm.item_id,
                    warehouse_id=session.warehouse_id,
                    movement_type="issue",
                    quantity=-lm.quantity,
                    reference_type="pos_transaction",
                    reference_id=txn.id,
                    notes=f"POS offline sale {txn_number}",
                    created_by=current_user.id,
                ))

            results.append({
                "offline_id": txn_in.offline_id,
                "status": "success",
                "transaction_id": str(txn.id),
                "transaction_number": txn_number,
            })

        except Exception as exc:
            results.append({
                "offline_id": txn_in.offline_id,
                "status": "error",
                "detail": str(exc),
            })

    await db.commit()

    success_count = sum(1 for r in results if r["status"] == "success")
    error_count = sum(1 for r in results if r["status"] == "error")

    return {
        "total": len(results),
        "success": success_count,
        "errors": error_count,
        "results": results,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  POS ← E-Commerce: Sync products from e-commerce catalog
# ══════════════════════════════════════════════════════════════════════════════

class POSSyncFromEcommerceIn(BaseModel):
    store_id: uuid.UUID | None = None
    warehouse_id: uuid.UUID


@router.post(
    "/products/sync-from-ecommerce",
    status_code=status.HTTP_201_CREATED,
    summary="Import e-commerce products into POS-compatible inventory items",
)
async def sync_from_ecommerce(
    payload: POSSyncFromEcommerceIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Pull published products from e-commerce and create inventory items + stock levels for POS use.

    Products that already have a linked inventory_item_id are skipped (already synced).
    """
    from app.models.ecommerce import EcomProduct  # noqa: PLC0415
    from app.models.inventory import Warehouse  # noqa: PLC0415

    # Validate warehouse
    warehouse = await db.get(Warehouse, payload.warehouse_id)
    if not warehouse:
        from fastapi import HTTPException as _HE  # noqa: PLC0415
        raise _HE(status_code=404, detail="Warehouse not found")

    # Fetch published e-commerce products that don't yet have an inventory link
    query = (
        select(EcomProduct)
        .where(
            EcomProduct.is_published == True,  # noqa: E712
            EcomProduct.inventory_item_id.is_(None),
        )
    )
    if payload.store_id:
        query = query.where(EcomProduct.store_id == payload.store_id)

    result = await db.execute(query)
    products = result.scalars().all()

    if not products:
        return {"synced": 0, "message": "No new products to sync"}

    created = 0
    skipped = 0

    for product in products:
        # Check if an inventory item with same name/slug already exists
        existing = await db.execute(
            select(InventoryItem).where(InventoryItem.name == product.display_name)
        )
        item = existing.scalar_one_or_none()

        if not item:
            # Generate SKU
            count_q = select(func.count()).select_from(InventoryItem)
            count_result = await db.execute(count_q)
            seq = (count_result.scalar() or 0) + 1
            sku = f"ECOM-{seq:05d}"

            item = InventoryItem(
                name=product.display_name,
                sku=sku,
                description=product.description or "",
                unit_price=product.price,
                is_active=True,
            )
            db.add(item)
            await db.flush()

            # Create stock level for the warehouse
            stock = StockLevel(
                item_id=item.id,
                warehouse_id=payload.warehouse_id,
                quantity_on_hand=0,
                reorder_level=5,
            )
            db.add(stock)

        # Link ecommerce product to inventory item
        product.inventory_item_id = item.id
        created += 1

    await db.commit()

    return {
        "synced": created,
        "skipped": skipped,
        "warehouse_id": str(payload.warehouse_id),
        "message": f"Synced {created} e-commerce products to inventory for POS",
    }
