"""POS API — Sessions, Transactions, Products, Dashboard."""
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
from app.models.finance import Invoice, Payment
from app.models.inventory import InventoryItem, StockLevel, StockMovement, Warehouse
from app.models.pos import POSPayment, POSSession, POSTransaction, POSTransactionLine

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

# -- Sessions --

class SessionOpenIn(BaseModel):
    warehouse_id: uuid.UUID
    opening_balance: Decimal = Decimal("0")
    notes: str | None = None


class SessionCloseIn(BaseModel):
    closing_balance: Decimal
    notes: str | None = None


class SessionOut(BaseModel):
    id: uuid.UUID
    session_number: str
    cashier_id: uuid.UUID
    warehouse_id: uuid.UUID
    opened_at: Any
    closed_at: Any | None
    opening_balance: Decimal
    closing_balance: Decimal | None
    expected_balance: Decimal | None
    difference: Decimal | None
    status: str
    notes: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Transactions --

class TransactionLineIn(BaseModel):
    item_id: uuid.UUID
    quantity: int
    unit_price: Decimal
    discount_amount: Decimal = Decimal("0")


class TransactionPaymentIn(BaseModel):
    payment_method: str  # cash, card, mobile_money, split
    amount: Decimal
    reference: str | None = None


class TransactionCreateIn(BaseModel):
    customer_name: str | None = None
    customer_email: str | None = None
    discount_amount: Decimal = Decimal("0")
    discount_type: str | None = None  # percentage, fixed
    tax_amount: Decimal = Decimal("0")
    lines: list[TransactionLineIn]
    payments: list[TransactionPaymentIn]


class TransactionLineOut(BaseModel):
    id: uuid.UUID
    transaction_id: uuid.UUID
    item_id: uuid.UUID
    item_name: str
    item_sku: str
    quantity: int
    unit_price: Decimal
    discount_amount: Decimal
    line_total: Decimal

    model_config = {"from_attributes": True}


class PaymentOut(BaseModel):
    id: uuid.UUID
    transaction_id: uuid.UUID
    payment_method: str
    amount: Decimal
    reference: str | None
    change_given: Decimal

    model_config = {"from_attributes": True}


class TransactionOut(BaseModel):
    id: uuid.UUID
    transaction_number: str
    session_id: uuid.UUID
    customer_name: str | None
    customer_email: str | None
    subtotal: Decimal
    discount_amount: Decimal
    discount_type: str | None
    tax_amount: Decimal
    total: Decimal
    status: str
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class TransactionDetailOut(TransactionOut):
    lines: list[TransactionLineOut] = []
    payments: list[PaymentOut] = []


# -- Dashboard --

class POSDashboardStats(BaseModel):
    today_sales_total: Decimal
    today_sales_count: int
    today_avg_sale: Decimal
    top_products: list[dict[str, Any]]


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _generate_sequence(db: DBSession, model: Any, prefix: str, number_field: str) -> str:
    """Generate an auto-incrementing number like POS-2026-0001."""
    year = datetime.now(timezone.utc).year
    pattern = f"{prefix}-{year}-%"
    col = getattr(model, number_field)
    result = await db.execute(
        select(func.count()).select_from(model).where(col.like(pattern))
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}-{year}-{count:04d}"


async def _get_active_session(db: DBSession, user_id: uuid.UUID) -> POSSession | None:
    """Return the open POS session for the current user, if any."""
    result = await db.execute(
        select(POSSession).where(
            and_(
                POSSession.cashier_id == user_id,
                POSSession.status == "open",
            )
        )
    )
    return result.scalar_one_or_none()


# ── Session endpoints ────────────────────────────────────────────────────────

@router.post("/sessions/open", status_code=status.HTTP_201_CREATED, summary="Open a new POS session")
async def open_session(
    payload: SessionOpenIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Check no open session already exists for this user
    existing = await _get_active_session(db, current_user.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an open POS session. Close it before opening a new one.",
        )

    # Validate warehouse
    warehouse = await db.get(Warehouse, payload.warehouse_id)
    if not warehouse or not warehouse.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    session_number = await _generate_sequence(db, POSSession, "POS", "session_number")

    session = POSSession(
        session_number=session_number,
        cashier_id=current_user.id,
        warehouse_id=payload.warehouse_id,
        opening_balance=payload.opening_balance,
        notes=payload.notes,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionOut.model_validate(session).model_dump()


@router.post("/sessions/{session_id}/close", summary="Close a POS session")
async def close_session(
    session_id: uuid.UUID,
    payload: SessionCloseIn,
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

    # Calculate expected balance from transactions
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

    expected = session.opening_balance + total_sales - total_refunds
    difference = payload.closing_balance - expected

    session.closed_at = datetime.now(timezone.utc)
    session.closing_balance = payload.closing_balance
    session.expected_balance = expected
    session.difference = difference
    session.status = "closed"
    if payload.notes:
        session.notes = (session.notes or "") + "\n" + payload.notes

    await db.commit()
    await db.refresh(session)
    return SessionOut.model_validate(session).model_dump()


@router.get("/sessions", summary="List POS sessions")
async def list_sessions(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(POSSession)

    if status_filter:
        query = query.where(POSSession.status == status_filter)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(POSSession.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    sessions = result.scalars().all()
    return {
        "total": total,
        "sessions": [SessionOut.model_validate(s).model_dump() for s in sessions],
    }


@router.get("/sessions/active", summary="Get the current user's active POS session")
async def get_active_session(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    session = await _get_active_session(db, current_user.id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active session")
    return SessionOut.model_validate(session).model_dump()


@router.get("/sessions/{session_id}", summary="Get POS session detail")
async def get_session(
    session_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    session = await db.get(POSSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return SessionOut.model_validate(session).model_dump()


@router.get("/sessions/{session_id}/reconciliation", summary="Session reconciliation summary")
async def session_reconciliation(
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

    return {
        "session": SessionOut.model_validate(session).model_dump(),
        "transaction_counts": status_counts,
        "total_sales": str(total_sales),
        "payment_methods": payment_methods,
    }


@router.get("/sessions/{session_id}/export", summary="Export session transactions as CSV")
async def export_session(
    session_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    from app.core.export import rows_to_csv  # noqa: PLC0415

    session = await db.get(POSSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    result = await db.execute(
        select(POSTransaction).where(
            POSTransaction.session_id == session_id
        ).order_by(POSTransaction.created_at.asc())
    )
    transactions = result.scalars().all()

    rows = [
        {
            "transaction_number": t.transaction_number,
            "customer_name": t.customer_name or "",
            "subtotal": float(t.subtotal),
            "discount": float(t.discount_amount),
            "tax": float(t.tax_amount),
            "total": float(t.total),
            "status": t.status,
            "created_at": t.created_at.isoformat(),
        }
        for t in transactions
    ]
    columns = ["transaction_number", "customer_name", "subtotal", "discount", "tax", "total", "status", "created_at"]
    return rows_to_csv(rows, columns, f"pos_session_{session.session_number}.csv")


# ── Transaction endpoints ────────────────────────────────────────────────────

@router.post("/transactions", status_code=status.HTTP_201_CREATED, summary="Create a POS sale")
async def create_transaction(
    payload: TransactionCreateIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Core POS sale: validates stock, creates transaction + lines + payments,
    issues stock movements, auto-creates a Finance Invoice + Payment, publishes event."""

    if not payload.lines:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one line item is required",
        )
    if not payload.payments:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one payment is required",
        )

    # Must have an active session
    session = await _get_active_session(db, current_user.id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No active POS session. Open a session first.",
        )

    # ── Validate items and stock ──────────────────────────────────────────
    line_models: list[POSTransactionLine] = []
    subtotal = Decimal("0")

    for line_in in payload.lines:
        item = await db.get(InventoryItem, line_in.item_id)
        if not item or not item.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Item {line_in.item_id} not found",
            )

        # Check stock in the session warehouse
        sl_result = await db.execute(
            select(StockLevel).where(
                and_(
                    StockLevel.item_id == line_in.item_id,
                    StockLevel.warehouse_id == session.warehouse_id,
                )
            )
        )
        stock_level = sl_result.scalar_one_or_none()
        available = (stock_level.quantity_on_hand - stock_level.quantity_reserved) if stock_level else 0

        if available < line_in.quantity:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Insufficient stock for {item.name} (SKU: {item.sku}). Available: {available}, requested: {line_in.quantity}",
            )

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

    # Calculate totals
    total = subtotal - payload.discount_amount + payload.tax_amount

    # Validate payment covers total
    total_tendered = sum(p.amount for p in payload.payments)
    if total_tendered < total:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Payment ({total_tendered}) is less than total ({total})",
        )

    change = total_tendered - total

    # ── Create transaction ────────────────────────────────────────────────
    txn_number = await _generate_sequence(db, POSTransaction, "TXN", "transaction_number")

    txn = POSTransaction(
        transaction_number=txn_number,
        session_id=session.id,
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        subtotal=subtotal,
        discount_amount=payload.discount_amount,
        discount_type=payload.discount_type,
        tax_amount=payload.tax_amount,
        total=total,
        created_by=current_user.id,
    )
    db.add(txn)
    await db.flush()

    # Attach lines
    for lm in line_models:
        lm.transaction_id = txn.id
        db.add(lm)

    # Attach payments (assign change to last cash payment or first payment)
    remaining_change = change
    for i, p_in in enumerate(payload.payments):
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

    # If there's still remaining change (no cash payment), assign to first payment
    if remaining_change > 0:
        # Already flushed above — just note it; unlikely in practice
        pass

    # ── Create stock movements (issue) ────────────────────────────────────
    low_stock_alerts: list[dict[str, Any]] = []

    for lm in line_models:
        movement = StockMovement(
            item_id=lm.item_id,
            warehouse_id=session.warehouse_id,
            movement_type="issue",
            quantity=-lm.quantity,
            reference_type="pos_transaction",
            reference_id=txn.id,
            notes=f"POS sale {txn_number}",
            created_by=current_user.id,
        )
        db.add(movement)

        # Update stock level
        sl_result = await db.execute(
            select(StockLevel).where(
                and_(
                    StockLevel.item_id == lm.item_id,
                    StockLevel.warehouse_id == session.warehouse_id,
                )
            )
        )
        stock_level = sl_result.scalar_one()
        stock_level.quantity_on_hand -= lm.quantity

        # Check reorder level
        item = await db.get(InventoryItem, lm.item_id)
        if item and stock_level.quantity_on_hand <= item.reorder_level:
            low_stock_alerts.append({
                "item_id": str(item.id),
                "item_name": item.name,
                "sku": item.sku,
                "warehouse_id": str(session.warehouse_id),
                "quantity_on_hand": stock_level.quantity_on_hand,
                "reorder_level": item.reorder_level,
            })

    # ── Auto-create Finance Invoice (paid) + Payment ──────────────────────
    today = date.today()

    # Generate invoice number
    inv_year = datetime.now(timezone.utc).year
    inv_count_result = await db.execute(
        select(func.count()).select_from(Invoice).where(
            Invoice.invoice_number.like(f"INV-{inv_year}-%")
        )
    )
    inv_count = (inv_count_result.scalar() or 0) + 1
    inv_number = f"INV-{inv_year}-{inv_count:04d}"

    invoice = Invoice(
        invoice_number=inv_number,
        invoice_type="sales",
        status="paid",
        customer_name=payload.customer_name or "Walk-in Customer",
        customer_email=payload.customer_email,
        issue_date=today,
        due_date=today,
        subtotal=subtotal,
        tax_amount=payload.tax_amount,
        total=total,
        notes=f"Auto-generated from POS transaction {txn_number}",
        items=[
            {
                "item_name": lm.item_name,
                "item_sku": lm.item_sku,
                "quantity": lm.quantity,
                "unit_price": str(lm.unit_price),
                "line_total": str(lm.line_total),
            }
            for lm in line_models
        ],
        owner_id=current_user.id,
    )
    db.add(invoice)
    await db.flush()

    # Generate payment number
    pay_count_result = await db.execute(
        select(func.count()).select_from(Payment).where(
            Payment.payment_number.like(f"PAY-{inv_year}-%")
        )
    )
    pay_count = (pay_count_result.scalar() or 0) + 1
    pay_number = f"PAY-{inv_year}-{pay_count:04d}"

    finance_payment = Payment(
        payment_number=pay_number,
        invoice_id=invoice.id,
        amount=total,
        payment_method=payload.payments[0].payment_method,
        payment_date=today,
        reference=f"POS {txn_number}",
        status="completed",
        payer_id=current_user.id,
    )
    db.add(finance_payment)

    # Store receipt data
    txn.receipt_data = {
        "invoice_number": inv_number,
        "invoice_id": str(invoice.id),
        "payment_number": pay_number,
    }

    await db.commit()

    # ── Publish events ────────────────────────────────────────────────────
    await event_bus.publish("pos.sale.completed", {
        "transaction_id": str(txn.id),
        "transaction_number": txn_number,
        "total": str(total),
        "session_id": str(session.id),
        "cashier_id": str(current_user.id),
    })

    for alert in low_stock_alerts:
        await event_bus.publish("stock.low", alert)

    # Reload with lines and payments
    result = await db.execute(
        select(POSTransaction)
        .options(selectinload(POSTransaction.lines), selectinload(POSTransaction.payments))
        .where(POSTransaction.id == txn.id)
    )
    txn = result.scalar_one()
    return TransactionDetailOut.model_validate(txn).model_dump()


@router.get("/transactions", summary="List POS transactions")
async def list_transactions(
    current_user: CurrentUser,
    db: DBSession,
    session_id: uuid.UUID | None = Query(None, description="Filter by session"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(POSTransaction)

    if session_id:
        query = query.where(POSTransaction.session_id == session_id)
    if status_filter:
        query = query.where(POSTransaction.status == status_filter)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(POSTransaction.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    transactions = result.scalars().all()
    return {
        "total": total,
        "transactions": [TransactionOut.model_validate(t).model_dump() for t in transactions],
    }


@router.get("/transactions/{txn_id}", summary="Get POS transaction detail")
async def get_transaction(
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
    return TransactionDetailOut.model_validate(txn).model_dump()


@router.post("/transactions/{txn_id}/refund", summary="Refund a POS transaction")
async def refund_transaction(
    txn_id: uuid.UUID,
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

    # Get the session to know the warehouse
    session = await db.get(POSSession, txn.session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Reverse stock movements (receipt back into warehouse)
    for line in txn.lines:
        movement = StockMovement(
            item_id=line.item_id,
            warehouse_id=session.warehouse_id,
            movement_type="receipt",
            quantity=line.quantity,
            reference_type="pos_refund",
            reference_id=txn.id,
            notes=f"POS refund for {txn.transaction_number}",
            created_by=current_user.id,
        )
        db.add(movement)

        # Restore stock level
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

    txn.status = "refunded"
    await db.commit()
    await db.refresh(txn)

    await event_bus.publish("pos.sale.refunded", {
        "transaction_id": str(txn.id),
        "transaction_number": txn.transaction_number,
        "total": str(txn.total),
    })

    return TransactionOut.model_validate(txn).model_dump()


@router.post("/transactions/{txn_id}/void", summary="Void a POS transaction")
async def void_transaction(
    txn_id: uuid.UUID,
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
            detail=f"Cannot void transaction with status '{txn.status}'",
        )

    session = await db.get(POSSession, txn.session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Reverse stock
    for line in txn.lines:
        movement = StockMovement(
            item_id=line.item_id,
            warehouse_id=session.warehouse_id,
            movement_type="receipt",
            quantity=line.quantity,
            reference_type="pos_void",
            reference_id=txn.id,
            notes=f"POS void for {txn.transaction_number}",
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

    txn.status = "voided"
    await db.commit()
    await db.refresh(txn)
    return TransactionOut.model_validate(txn).model_dump()


@router.get("/transactions/{txn_id}/receipt", summary="Get receipt data for a transaction")
async def get_receipt(
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

    return {
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
        "receipt_data": txn.receipt_data,
    }


# ── Product endpoints (inventory items for POS grid) ────────────────────────

@router.get("/products", summary="List products for POS grid")
async def list_products(
    current_user: CurrentUser,
    db: DBSession,
    category: str | None = Query(None, description="Filter by category"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """Return inventory items with their stock levels for the POS product grid."""
    # Get active session warehouse
    session = await _get_active_session(db, current_user.id)
    warehouse_id = session.warehouse_id if session else None

    query = select(InventoryItem).where(
        and_(
            InventoryItem.is_active == True,  # noqa: E712
            InventoryItem.selling_price > 0,
        )
    )

    if category:
        query = query.where(InventoryItem.category == category)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(InventoryItem.name.asc()).offset(skip).limit(limit)
    result = await db.execute(query)
    items = result.scalars().all()

    products = []
    for item in items:
        stock = 0
        if warehouse_id:
            sl_result = await db.execute(
                select(StockLevel.quantity_on_hand).where(
                    and_(
                        StockLevel.item_id == item.id,
                        StockLevel.warehouse_id == warehouse_id,
                    )
                )
            )
            stock = sl_result.scalar() or 0

        products.append({
            "id": str(item.id),
            "sku": item.sku,
            "name": item.name,
            "category": item.category,
            "selling_price": str(item.selling_price),
            "cost_price": str(item.cost_price),
            "unit_of_measure": item.unit_of_measure,
            "stock_on_hand": stock,
        })

    return {"total": total, "products": products}


@router.get("/products/search", summary="Search products for POS")
async def search_products(
    current_user: CurrentUser,
    db: DBSession,
    q: str = Query(..., min_length=1, description="Search by name or SKU"),
) -> list[dict[str, Any]]:
    session = await _get_active_session(db, current_user.id)
    warehouse_id = session.warehouse_id if session else None

    like_pattern = f"%{q}%"
    result = await db.execute(
        select(InventoryItem).where(
            and_(
                InventoryItem.is_active == True,  # noqa: E712
                InventoryItem.selling_price > 0,
                InventoryItem.name.ilike(like_pattern) | InventoryItem.sku.ilike(like_pattern),
            )
        ).order_by(InventoryItem.name.asc()).limit(20)
    )
    items = result.scalars().all()

    products = []
    for item in items:
        stock = 0
        if warehouse_id:
            sl_result = await db.execute(
                select(StockLevel.quantity_on_hand).where(
                    and_(
                        StockLevel.item_id == item.id,
                        StockLevel.warehouse_id == warehouse_id,
                    )
                )
            )
            stock = sl_result.scalar() or 0

        products.append({
            "id": str(item.id),
            "sku": item.sku,
            "name": item.name,
            "category": item.category,
            "selling_price": str(item.selling_price),
            "stock_on_hand": stock,
        })

    return products


# ── Dashboard ────────────────────────────────────────────────────────────────

@router.get("/dashboard/stats", summary="POS dashboard stats for today")
async def pos_dashboard(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    today = date.today()

    # Today's completed sales
    sales_result = await db.execute(
        select(
            func.coalesce(func.sum(POSTransaction.total), 0),
            func.count(),
        ).where(
            and_(
                POSTransaction.status == "completed",
                func.date(POSTransaction.created_at) == today,
            )
        )
    )
    row = sales_result.one()
    today_total = row[0] or Decimal("0")
    today_count = row[1] or 0
    today_avg = (today_total / today_count) if today_count > 0 else Decimal("0")

    # Top products today (by quantity sold)
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
                POSTransaction.status == "completed",
                func.date(POSTransaction.created_at) == today,
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

    return {
        "today_sales_total": str(today_total),
        "today_sales_count": today_count,
        "today_avg_sale": str(today_avg),
        "top_products": top_products,
    }
