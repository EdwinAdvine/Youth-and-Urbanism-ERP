"""Finance API — Chart of Accounts, Journal Entries, Invoices, Payments, Reports."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.models.finance import Account, Budget, BudgetLine, Invoice, JournalEntry, JournalLine, Payment, TaxRate

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

# -- Accounts --

class AccountCreate(BaseModel):
    code: str
    name: str
    account_type: str  # asset, liability, equity, revenue, expense
    parent_id: uuid.UUID | None = None
    currency: str = "USD"
    description: str | None = None


class AccountUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    account_type: str | None = None
    parent_id: uuid.UUID | None = None
    currency: str | None = None
    description: str | None = None
    is_active: bool | None = None


class AccountOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    account_type: str
    parent_id: uuid.UUID | None
    currency: str
    is_active: bool
    description: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Journal Entries --

class JournalLineIn(BaseModel):
    account_id: uuid.UUID
    debit: Decimal = Decimal("0")
    credit: Decimal = Decimal("0")
    description: str | None = None


class JournalLineOut(BaseModel):
    id: uuid.UUID
    journal_entry_id: uuid.UUID
    account_id: uuid.UUID
    debit: Decimal
    credit: Decimal
    description: str | None

    model_config = {"from_attributes": True}


class JournalEntryCreate(BaseModel):
    entry_date: date
    description: str | None = None
    metadata_json: dict | None = None
    lines: list[JournalLineIn]


class JournalEntryUpdate(BaseModel):
    entry_date: date | None = None
    description: str | None = None
    metadata_json: dict | None = None
    lines: list[JournalLineIn] | None = None


class JournalEntryOut(BaseModel):
    id: uuid.UUID
    entry_number: str
    entry_date: date
    description: str | None
    status: str
    posted_by: uuid.UUID | None
    metadata_json: dict | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class JournalEntryDetailOut(JournalEntryOut):
    lines: list[JournalLineOut] = []


# -- Invoices --

class InvoiceCreate(BaseModel):
    invoice_type: str  # sales, purchase
    customer_name: str | None = None
    customer_email: str | None = None
    issue_date: date
    due_date: date
    subtotal: Decimal = Decimal("0")
    tax_amount: Decimal = Decimal("0")
    total: Decimal = Decimal("0")
    currency: str = "USD"
    notes: str | None = None
    items: list | None = None


class InvoiceUpdate(BaseModel):
    invoice_type: str | None = None
    customer_name: str | None = None
    customer_email: str | None = None
    issue_date: date | None = None
    due_date: date | None = None
    subtotal: Decimal | None = None
    tax_amount: Decimal | None = None
    total: Decimal | None = None
    currency: str | None = None
    notes: str | None = None
    items: list | None = None


class InvoiceOut(BaseModel):
    id: uuid.UUID
    invoice_number: str
    invoice_type: str
    status: str
    customer_name: str | None
    customer_email: str | None
    issue_date: date
    due_date: date
    subtotal: Decimal
    tax_amount: Decimal
    total: Decimal
    currency: str
    notes: str | None
    items: list | None
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Payments --

class PaymentCreate(BaseModel):
    invoice_id: uuid.UUID | None = None
    amount: Decimal
    currency: str = "USD"
    payment_method: str = "bank_transfer"
    payment_date: date
    reference: str | None = None
    status: str = "completed"


class PaymentOut(BaseModel):
    id: uuid.UUID
    payment_number: str
    invoice_id: uuid.UUID | None
    amount: Decimal
    currency: str
    payment_method: str
    payment_date: date
    reference: str | None
    status: str
    payer_id: uuid.UUID | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _generate_sequence(db: DBSession, model: Any, prefix: str, number_field: str) -> str:
    """Generate an auto-incrementing number like JE-2026-0001."""
    year = datetime.utcnow().year
    pattern = f"{prefix}-{year}-%"
    col = getattr(model, number_field)
    result = await db.execute(
        select(func.count()).select_from(model).where(col.like(pattern))
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}-{year}-{count:04d}"


# ── Account endpoints ─────────────────────────────────────────────────────────

@router.get("/accounts", summary="List accounts (chart of accounts)")
async def list_accounts(
    current_user: CurrentUser,
    db: DBSession,
    account_type: str | None = Query(None, description="Filter by account type"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Account).where(Account.is_active == True)  # noqa: E712

    if account_type:
        query = query.where(Account.account_type == account_type)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Account.code.asc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    accounts = result.scalars().all()
    return {
        "total": total,
        "accounts": [AccountOut.model_validate(a) for a in accounts],
    }


@router.post("/accounts", status_code=status.HTTP_201_CREATED, summary="Create an account")
async def create_account(
    payload: AccountCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    account = Account(
        code=payload.code,
        name=payload.name,
        account_type=payload.account_type,
        parent_id=payload.parent_id,
        currency=payload.currency,
        description=payload.description,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return AccountOut.model_validate(account).model_dump()


@router.put("/accounts/{account_id}", summary="Update an account")
async def update_account(
    account_id: uuid.UUID,
    payload: AccountUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    account = await db.get(Account, account_id)
    if not account or not account.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(account, field, value)

    await db.commit()
    await db.refresh(account)
    return AccountOut.model_validate(account).model_dump()


@router.delete(
    "/accounts/{account_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete an account",
)
async def delete_account(
    account_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    account = await db.get(Account, account_id)
    if not account or not account.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    account.is_active = False
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Journal Entry endpoints ──────────────────────────────────────────────────

@router.get("/journal-entries", summary="List journal entries")
async def list_journal_entries(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    start_date: date | None = Query(None, description="Start date filter"),
    end_date: date | None = Query(None, description="End date filter"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(JournalEntry)

    if status_filter:
        query = query.where(JournalEntry.status == status_filter)
    if start_date:
        query = query.where(JournalEntry.entry_date >= start_date)
    if end_date:
        query = query.where(JournalEntry.entry_date <= end_date)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(JournalEntry.entry_date.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    entries = result.scalars().all()
    return {
        "total": total,
        "journal_entries": [JournalEntryOut.model_validate(e) for e in entries],
    }


@router.post(
    "/journal-entries",
    status_code=status.HTTP_201_CREATED,
    summary="Create a journal entry with lines",
)
async def create_journal_entry(
    payload: JournalEntryCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    if not payload.lines:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one journal line is required",
        )

    # Validate double-entry: sum(debit) must equal sum(credit)
    total_debit = sum(line.debit for line in payload.lines)
    total_credit = sum(line.credit for line in payload.lines)
    if total_debit != total_credit:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Debits ({total_debit}) must equal credits ({total_credit})",
        )

    entry_number = await _generate_sequence(db, JournalEntry, "JE", "entry_number")

    entry = JournalEntry(
        entry_number=entry_number,
        entry_date=payload.entry_date,
        description=payload.description,
        metadata_json=payload.metadata_json,
    )
    db.add(entry)
    await db.flush()  # get the entry id

    for line_data in payload.lines:
        line = JournalLine(
            journal_entry_id=entry.id,
            account_id=line_data.account_id,
            debit=line_data.debit,
            credit=line_data.credit,
            description=line_data.description,
        )
        db.add(line)

    await db.commit()
    await db.refresh(entry)

    # Eager load lines for response
    result = await db.execute(
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines))
        .where(JournalEntry.id == entry.id)
    )
    entry = result.scalar_one()
    return JournalEntryDetailOut.model_validate(entry).model_dump()


@router.get("/journal-entries/{entry_id}", summary="Get journal entry with lines")
async def get_journal_entry(
    entry_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines))
        .where(JournalEntry.id == entry_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found")
    return JournalEntryDetailOut.model_validate(entry).model_dump()


@router.put("/journal-entries/{entry_id}", summary="Update a draft journal entry")
async def update_journal_entry(
    entry_id: uuid.UUID,
    payload: JournalEntryUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines))
        .where(JournalEntry.id == entry_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found")

    if entry.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only draft entries can be updated",
        )

    if payload.entry_date is not None:
        entry.entry_date = payload.entry_date
    if payload.description is not None:
        entry.description = payload.description
    if payload.metadata_json is not None:
        entry.metadata_json = payload.metadata_json

    # If lines are provided, replace them
    if payload.lines is not None:
        if not payload.lines:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="At least one journal line is required",
            )

        total_debit = sum(line.debit for line in payload.lines)
        total_credit = sum(line.credit for line in payload.lines)
        if total_debit != total_credit:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Debits ({total_debit}) must equal credits ({total_credit})",
            )

        # Remove existing lines
        for existing_line in entry.lines:
            await db.delete(existing_line)

        # Add new lines
        for line_data in payload.lines:
            line = JournalLine(
                journal_entry_id=entry.id,
                account_id=line_data.account_id,
                debit=line_data.debit,
                credit=line_data.credit,
                description=line_data.description,
            )
            db.add(line)

    await db.commit()

    # Reload with lines
    result = await db.execute(
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines))
        .where(JournalEntry.id == entry.id)
    )
    entry = result.scalar_one()
    return JournalEntryDetailOut.model_validate(entry).model_dump()


@router.post("/journal-entries/{entry_id}/post", summary="Post a journal entry")
async def post_journal_entry(
    entry_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    entry = await db.get(JournalEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found")

    if entry.status == "posted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Journal entry is already posted",
        )
    if entry.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot post entry with status '{entry.status}'",
        )

    entry.status = "posted"
    entry.posted_by = current_user.id
    await db.commit()
    await db.refresh(entry)
    return JournalEntryOut.model_validate(entry).model_dump()


# ── Invoice endpoints ────────────────────────────────────────────────────────

@router.get("/invoices", summary="List invoices")
async def list_invoices(
    current_user: CurrentUser,
    db: DBSession,
    invoice_type: str | None = Query(None, description="Filter by type (sales/purchase)"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    start_date: date | None = Query(None, description="Issue date start"),
    end_date: date | None = Query(None, description="Issue date end"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Invoice)

    if invoice_type:
        query = query.where(Invoice.invoice_type == invoice_type)
    if status_filter:
        query = query.where(Invoice.status == status_filter)
    if start_date:
        query = query.where(Invoice.issue_date >= start_date)
    if end_date:
        query = query.where(Invoice.issue_date <= end_date)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Invoice.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    invoices = result.scalars().all()
    return {
        "total": total,
        "invoices": [InvoiceOut.model_validate(i) for i in invoices],
    }


@router.post("/invoices", status_code=status.HTTP_201_CREATED, summary="Create an invoice")
async def create_invoice(
    payload: InvoiceCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    invoice_number = await _generate_sequence(db, Invoice, "INV", "invoice_number")

    # Calculate subtotal/total from items if items are provided and totals are zero
    subtotal = payload.subtotal
    tax_amount = payload.tax_amount
    total = payload.total

    if payload.items and subtotal == 0:
        subtotal = sum(
            Decimal(str(item.get("quantity", 0))) * Decimal(str(item.get("unit_price", 0)))
            for item in payload.items
            if isinstance(item, dict)
        )
        total = subtotal + tax_amount

    invoice = Invoice(
        invoice_number=invoice_number,
        invoice_type=payload.invoice_type,
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        issue_date=payload.issue_date,
        due_date=payload.due_date,
        subtotal=subtotal,
        tax_amount=tax_amount,
        total=total,
        currency=payload.currency,
        notes=payload.notes,
        items=payload.items,
        owner_id=current_user.id,
    )
    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)
    return InvoiceOut.model_validate(invoice).model_dump()


@router.get("/invoices/{invoice_id}", summary="Get invoice detail")
async def get_invoice(
    invoice_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    return InvoiceOut.model_validate(invoice).model_dump()


@router.put("/invoices/{invoice_id}", summary="Update a draft invoice")
async def update_invoice(
    invoice_id: uuid.UUID,
    payload: InvoiceUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    if invoice.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only draft invoices can be updated",
        )

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(invoice, field, value)

    await db.commit()
    await db.refresh(invoice)
    return InvoiceOut.model_validate(invoice).model_dump()


@router.post("/invoices/{invoice_id}/send", summary="Mark invoice as sent")
async def send_invoice(
    invoice_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    if invoice.status not in ("draft",):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot send invoice with status '{invoice.status}'",
        )

    invoice.status = "sent"
    await db.commit()
    await db.refresh(invoice)

    await event_bus.publish("invoice.sent", {
        "invoice_id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "customer_email": invoice.customer_email,
        "total": str(invoice.total),
        "currency": invoice.currency,
    })

    return InvoiceOut.model_validate(invoice).model_dump()


@router.post("/invoices/{invoice_id}/mark-paid", summary="Mark invoice as paid")
async def mark_invoice_paid(
    invoice_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    if invoice.status == "paid":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invoice is already paid",
        )
    if invoice.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot mark a cancelled invoice as paid",
        )

    invoice.status = "paid"
    await db.commit()
    await db.refresh(invoice)
    return InvoiceOut.model_validate(invoice).model_dump()


@router.delete(
    "/invoices/{invoice_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel an invoice (soft-delete)",
)
async def delete_invoice(
    invoice_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    if invoice.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invoice is already cancelled",
        )

    invoice.status = "cancelled"
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Payment endpoints ────────────────────────────────────────────────────────

@router.get("/payments", summary="List payments")
async def list_payments(
    current_user: CurrentUser,
    db: DBSession,
    start_date: date | None = Query(None, description="Payment date start"),
    end_date: date | None = Query(None, description="Payment date end"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Payment)

    if start_date:
        query = query.where(Payment.payment_date >= start_date)
    if end_date:
        query = query.where(Payment.payment_date <= end_date)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Payment.payment_date.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    payments = result.scalars().all()
    return {
        "total": total,
        "payments": [PaymentOut.model_validate(p) for p in payments],
    }


@router.post("/payments", status_code=status.HTTP_201_CREATED, summary="Record a payment")
async def create_payment(
    payload: PaymentCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    payment_number = await _generate_sequence(db, Payment, "PAY", "payment_number")

    payment = Payment(
        payment_number=payment_number,
        invoice_id=payload.invoice_id,
        amount=payload.amount,
        currency=payload.currency,
        payment_method=payload.payment_method,
        payment_date=payload.payment_date,
        reference=payload.reference,
        status=payload.status,
        payer_id=current_user.id,
    )
    db.add(payment)
    await db.flush()

    # If linked to an invoice, check if fully paid
    if payload.invoice_id:
        invoice = await db.get(Invoice, payload.invoice_id)
        if not invoice:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Linked invoice not found",
            )

        # Sum all completed payments for this invoice
        payments_result = await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                and_(
                    Payment.invoice_id == payload.invoice_id,
                    Payment.status == "completed",
                )
            )
        )
        total_paid = payments_result.scalar() or Decimal("0")

        if total_paid >= invoice.total:
            invoice.status = "paid"

    await db.commit()
    await db.refresh(payment)

    await event_bus.publish("payment.received", {
        "payment_id": str(payment.id),
        "payment_number": payment.payment_number,
        "amount": str(payment.amount),
        "currency": payment.currency,
        "invoice_id": str(payment.invoice_id) if payment.invoice_id else None,
    })

    return PaymentOut.model_validate(payment).model_dump()


@router.get("/payments/{payment_id}", summary="Get payment detail")
async def get_payment(
    payment_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    payment = await db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    return PaymentOut.model_validate(payment).model_dump()


# ── Report endpoints ─────────────────────────────────────────────────────────

@router.get("/reports/trial-balance", summary="Trial balance from posted journal entries")
async def trial_balance(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Sum debits and credits per account from posted journal entries only
    result = await db.execute(
        select(
            Account.id,
            Account.code,
            Account.name,
            Account.account_type,
            func.coalesce(func.sum(JournalLine.debit), 0).label("total_debit"),
            func.coalesce(func.sum(JournalLine.credit), 0).label("total_credit"),
        )
        .join(JournalLine, JournalLine.account_id == Account.id)
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .where(JournalEntry.status == "posted")
        .where(Account.is_active == True)  # noqa: E712
        .group_by(Account.id, Account.code, Account.name, Account.account_type)
        .order_by(Account.code.asc())
    )
    rows = result.all()

    accounts = []
    grand_debit = Decimal("0")
    grand_credit = Decimal("0")
    for row in rows:
        total_debit = Decimal(str(row.total_debit))
        total_credit = Decimal(str(row.total_credit))
        balance = total_debit - total_credit
        grand_debit += total_debit
        grand_credit += total_credit
        accounts.append({
            "account_id": str(row.id),
            "code": row.code,
            "name": row.name,
            "account_type": row.account_type,
            "total_debit": str(total_debit),
            "total_credit": str(total_credit),
            "balance": str(balance),
        })

    return {
        "accounts": accounts,
        "grand_total_debit": str(grand_debit),
        "grand_total_credit": str(grand_credit),
    }


@router.get("/reports/income-statement", summary="Income statement for a date range")
async def income_statement(
    current_user: CurrentUser,
    db: DBSession,
    start_date: date = Query(..., description="Start date"),
    end_date: date = Query(..., description="End date"),
) -> dict[str, Any]:
    # Revenue and expense accounts from posted journal entries in date range
    result = await db.execute(
        select(
            Account.id,
            Account.code,
            Account.name,
            Account.account_type,
            func.coalesce(func.sum(JournalLine.debit), 0).label("total_debit"),
            func.coalesce(func.sum(JournalLine.credit), 0).label("total_credit"),
        )
        .join(JournalLine, JournalLine.account_id == Account.id)
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .where(JournalEntry.status == "posted")
        .where(JournalEntry.entry_date >= start_date)
        .where(JournalEntry.entry_date <= end_date)
        .where(Account.account_type.in_(["revenue", "expense"]))
        .where(Account.is_active == True)  # noqa: E712
        .group_by(Account.id, Account.code, Account.name, Account.account_type)
        .order_by(Account.code.asc())
    )
    rows = result.all()

    revenue_items = []
    expense_items = []
    total_revenue = Decimal("0")
    total_expenses = Decimal("0")

    for row in rows:
        total_debit = Decimal(str(row.total_debit))
        total_credit = Decimal(str(row.total_credit))
        item = {
            "account_id": str(row.id),
            "code": row.code,
            "name": row.name,
            "total_debit": str(total_debit),
            "total_credit": str(total_credit),
        }

        if row.account_type == "revenue":
            # Revenue: credits increase, debits decrease; net = credit - debit
            net = total_credit - total_debit
            item["net_amount"] = str(net)
            revenue_items.append(item)
            total_revenue += net
        else:
            # Expense: debits increase, credits decrease; net = debit - credit
            net = total_debit - total_credit
            item["net_amount"] = str(net)
            expense_items.append(item)
            total_expenses += net

    net_income = total_revenue - total_expenses

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "revenue": revenue_items,
        "total_revenue": str(total_revenue),
        "expenses": expense_items,
        "total_expenses": str(total_expenses),
        "net_income": str(net_income),
    }


# ── Dashboard endpoint ───────────────────────────────────────────────────────

@router.get("/dashboard/stats", summary="Finance dashboard summary")
async def finance_dashboard(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    today = date.today()
    first_of_month = today.replace(day=1)

    # Total revenue: sum of paid invoices (sales) this month
    rev_result = await db.execute(
        select(func.coalesce(func.sum(Invoice.total), 0)).where(
            and_(
                Invoice.invoice_type == "sales",
                Invoice.status == "paid",
                Invoice.issue_date >= first_of_month,
                Invoice.issue_date <= today,
            )
        )
    )
    total_revenue = rev_result.scalar() or Decimal("0")

    # Outstanding receivables: sum of sent/overdue sales invoices
    recv_result = await db.execute(
        select(func.coalesce(func.sum(Invoice.total), 0)).where(
            and_(
                Invoice.invoice_type == "sales",
                Invoice.status.in_(["sent", "overdue"]),
            )
        )
    )
    outstanding_receivables = recv_result.scalar() or Decimal("0")

    # Payments this month
    pay_result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            and_(
                Payment.status == "completed",
                Payment.payment_date >= first_of_month,
                Payment.payment_date <= today,
            )
        )
    )
    payments_this_month = pay_result.scalar() or Decimal("0")

    # Outstanding invoices count + amount
    outstanding_result = await db.execute(
        select(
            func.count(),
            func.coalesce(func.sum(Invoice.total), 0),
        ).where(
            and_(
                Invoice.invoice_type == "sales",
                Invoice.status.in_(["sent", "overdue"]),
            )
        )
    )
    outstanding_row = outstanding_result.one()
    outstanding_invoices_count = outstanding_row[0] or 0
    outstanding_invoices_amount = Decimal(str(outstanding_row[1])) if outstanding_row[1] else Decimal("0")

    # Payments today
    payments_today_result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            and_(
                Payment.status == "completed",
                Payment.payment_date == today,
            )
        )
    )
    payments_today = payments_today_result.scalar() or Decimal("0")

    # Total accounts
    acct_result = await db.execute(
        select(func.count()).select_from(Account).where(Account.is_active == True)  # noqa: E712
    )
    total_accounts = acct_result.scalar() or 0

    # Total invoices
    inv_result = await db.execute(
        select(func.count()).select_from(Invoice)
    )
    total_invoices = inv_result.scalar() or 0

    return {
        "total_revenue_mtd": str(total_revenue),
        "outstanding_receivables": str(outstanding_receivables),
        "outstanding_invoices_count": outstanding_invoices_count,
        "outstanding_invoices_amount": str(outstanding_invoices_amount),
        "payments_this_month": str(payments_this_month),
        "payments_today": str(payments_today),
        "total_accounts": total_accounts,
        "total_invoices": total_invoices,
    }


# ── Budget & Tax Rate schemas ─────────────────────────────────────────────────

class BudgetLineIn(BaseModel):
    account_id: uuid.UUID
    allocated: Decimal


class BudgetLineOut(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    allocated: Decimal
    spent: Decimal

    model_config = {"from_attributes": True}


class BudgetCreate(BaseModel):
    name: str
    fiscal_year: int
    department_id: uuid.UUID | None = None
    lines: list[BudgetLineIn]


class BudgetUpdate(BaseModel):
    name: str | None = None
    status: str | None = None  # draft, active, closed


class BudgetOut(BaseModel):
    id: uuid.UUID
    name: str
    fiscal_year: int
    department_id: uuid.UUID | None
    total_amount: Decimal
    spent_amount: Decimal
    status: str
    owner_id: uuid.UUID
    lines: list[BudgetLineOut] = []
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class TaxRateCreate(BaseModel):
    name: str
    rate: Decimal
    is_default: bool = False


class TaxRateUpdate(BaseModel):
    name: str | None = None
    rate: Decimal | None = None
    is_default: bool | None = None
    is_active: bool | None = None


class TaxRateOut(BaseModel):
    id: uuid.UUID
    name: str
    rate: Decimal
    is_default: bool
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Budget endpoints ──────────────────────────────────────────────────────────

@router.get("/budgets", summary="List budgets")
async def list_budgets(
    current_user: CurrentUser,
    db: DBSession,
    fiscal_year: int | None = Query(None, description="Filter by fiscal year"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Budget)

    if fiscal_year is not None:
        query = query.where(Budget.fiscal_year == fiscal_year)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Budget.fiscal_year.desc(), Budget.name.asc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    budgets = result.scalars().all()

    return {
        "total": total,
        "budgets": [BudgetOut.model_validate(b).model_dump() for b in budgets],
    }


@router.post(
    "/budgets",
    status_code=status.HTTP_201_CREATED,
    summary="Create a budget with line items",
)
async def create_budget(
    payload: BudgetCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("finance")),
) -> dict[str, Any]:
    if not payload.lines:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one budget line is required",
        )

    total_amount = sum(line.allocated for line in payload.lines)

    budget = Budget(
        name=payload.name,
        fiscal_year=payload.fiscal_year,
        department_id=payload.department_id,
        total_amount=total_amount,
        owner_id=current_user.id,
    )
    db.add(budget)
    await db.flush()

    for line_data in payload.lines:
        line = BudgetLine(
            budget_id=budget.id,
            account_id=line_data.account_id,
            allocated=line_data.allocated,
        )
        db.add(line)

    await db.commit()

    # Reload with lines
    result = await db.execute(
        select(Budget)
        .options(selectinload(Budget.lines))
        .where(Budget.id == budget.id)
    )
    budget = result.scalar_one()
    return BudgetOut.model_validate(budget).model_dump()


@router.get("/budgets/{budget_id}", summary="Get budget detail with lines")
async def get_budget(
    budget_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(Budget)
        .options(selectinload(Budget.lines))
        .where(Budget.id == budget_id)
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    return BudgetOut.model_validate(budget).model_dump()


@router.put("/budgets/{budget_id}", summary="Update a budget (name, status)")
async def update_budget(
    budget_id: uuid.UUID,
    payload: BudgetUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("finance")),
) -> dict[str, Any]:
    result = await db.execute(
        select(Budget)
        .options(selectinload(Budget.lines))
        .where(Budget.id == budget_id)
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(budget, field, value)

    await db.commit()
    await db.refresh(budget)
    return BudgetOut.model_validate(budget).model_dump()


@router.delete(
    "/budgets/{budget_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a budget (only if draft)",
)
async def delete_budget(
    budget_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("finance")),
) -> Response:
    budget = await db.get(Budget, budget_id)
    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")

    if budget.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete budget with status '{budget.status}' — only draft budgets can be deleted",
        )

    await db.delete(budget)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/reports/budget-vs-actual", summary="Budget vs actual spending report")
async def budget_vs_actual(
    current_user: CurrentUser,
    db: DBSession,
    fiscal_year: int = Query(..., description="Fiscal year"),
) -> dict[str, Any]:
    result = await db.execute(
        select(Budget)
        .options(selectinload(Budget.lines))
        .where(Budget.fiscal_year == fiscal_year)
        .order_by(Budget.name.asc())
    )
    budgets = result.scalars().all()

    report: list[dict[str, Any]] = []
    for budget in budgets:
        lines_report = []
        for line in budget.lines:
            variance = line.allocated - line.spent
            lines_report.append({
                "account_id": str(line.account_id),
                "account_name": line.account.name if line.account else None,
                "allocated": str(line.allocated),
                "spent": str(line.spent),
                "variance": str(variance),
                "utilization_pct": str(
                    round((line.spent / line.allocated) * 100, 2)
                ) if line.allocated > 0 else "0.00",
            })

        report.append({
            "budget_id": str(budget.id),
            "budget_name": budget.name,
            "status": budget.status,
            "total_amount": str(budget.total_amount),
            "spent_amount": str(budget.spent_amount),
            "variance": str(budget.total_amount - budget.spent_amount),
            "lines": lines_report,
        })

    return {
        "fiscal_year": fiscal_year,
        "budgets": report,
    }


# ── Tax Rate endpoints ────────────────────────────────────────────────────────

@router.get("/tax-rates", summary="List all active tax rates")
async def list_tax_rates(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(TaxRate).where(TaxRate.is_active == True).order_by(TaxRate.name.asc())  # noqa: E712
    )
    tax_rates = result.scalars().all()
    return {
        "total": len(tax_rates),
        "tax_rates": [TaxRateOut.model_validate(t).model_dump() for t in tax_rates],
    }


@router.post(
    "/tax-rates",
    status_code=status.HTTP_201_CREATED,
    summary="Create a tax rate",
)
async def create_tax_rate(
    payload: TaxRateCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("finance")),
) -> dict[str, Any]:
    # If is_default=True, unset other defaults first
    if payload.is_default:
        result = await db.execute(
            select(TaxRate).where(TaxRate.is_default == True)  # noqa: E712
        )
        existing_defaults = result.scalars().all()
        for tr in existing_defaults:
            tr.is_default = False

    tax_rate = TaxRate(
        name=payload.name,
        rate=payload.rate,
        is_default=payload.is_default,
    )
    db.add(tax_rate)
    await db.commit()
    await db.refresh(tax_rate)
    return TaxRateOut.model_validate(tax_rate).model_dump()


@router.put("/tax-rates/{tax_rate_id}", summary="Update a tax rate")
async def update_tax_rate(
    tax_rate_id: uuid.UUID,
    payload: TaxRateUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("finance")),
) -> dict[str, Any]:
    tax_rate = await db.get(TaxRate, tax_rate_id)
    if not tax_rate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tax rate not found")

    # If setting is_default=True, unset other defaults first
    if payload.is_default is True:
        result = await db.execute(
            select(TaxRate).where(
                TaxRate.is_default == True,  # noqa: E712
                TaxRate.id != tax_rate_id,
            )
        )
        existing_defaults = result.scalars().all()
        for tr in existing_defaults:
            tr.is_default = False

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(tax_rate, field, value)

    await db.commit()
    await db.refresh(tax_rate)
    return TaxRateOut.model_validate(tax_rate).model_dump()


# ── CSV Export endpoints ──────────────────────────────────────────────────────

@router.get("/invoices/export", summary="Export invoices as CSV")
async def export_invoices(
    current_user: CurrentUser,
    db: DBSession,
    status: str | None = Query(None),
):
    """Download all invoices as a CSV file."""
    from app.core.export import rows_to_csv  # noqa: PLC0415
    stmt = select(Invoice).order_by(Invoice.created_at.desc())
    if status:
        stmt = stmt.where(Invoice.status == status)
    result = await db.execute(stmt)
    invoices = result.scalars().all()
    rows = [
        {
            "invoice_number": i.invoice_number,
            "invoice_type": i.invoice_type,
            "status": i.status,
            "customer_name": i.customer_name or "",
            "customer_email": i.customer_email or "",
            "issue_date": str(i.issue_date),
            "due_date": str(i.due_date),
            "subtotal": float(i.subtotal),
            "tax": float(i.tax or 0),
            "total": float(i.total),
            "currency": i.currency,
            "created_at": i.created_at.isoformat(),
        }
        for i in invoices
    ]
    columns = ["invoice_number", "invoice_type", "status", "customer_name", "customer_email", "issue_date", "due_date", "subtotal", "tax", "total", "currency", "created_at"]
    return rows_to_csv(rows, columns, "invoices.csv")


@router.get("/payments/export", summary="Export payments as CSV")
async def export_payments(
    current_user: CurrentUser,
    db: DBSession,
):
    """Download all payments as a CSV file."""
    from app.core.export import rows_to_csv  # noqa: PLC0415
    result = await db.execute(select(Payment).order_by(Payment.created_at.desc()))
    payments = result.scalars().all()
    rows = [
        {
            "payment_number": p.payment_number,
            "amount": float(p.amount),
            "currency": p.currency,
            "payment_method": p.payment_method or "",
            "payment_date": str(p.payment_date),
            "reference": p.reference or "",
            "description": p.description or "",
            "created_at": p.created_at.isoformat(),
        }
        for p in payments
    ]
    columns = ["payment_number", "amount", "currency", "payment_method", "payment_date", "reference", "description", "created_at"]
    return rows_to_csv(rows, columns, "payments.csv")
