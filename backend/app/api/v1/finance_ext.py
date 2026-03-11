"""Finance Extensions API — Currencies, Exchange Rates, Bank Statements, Reconciliation, P&L, Balance Sheet."""
from __future__ import annotations

import csv
import io
import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.models.finance import Account, JournalLine, Payment
from app.models.finance_ext import (
    BankStatement,
    BankStatementLine,
    Currency,
    ExchangeRate,
    Reconciliation,
)

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class CurrencyCreate(BaseModel):
    code: str
    name: str
    symbol: str
    is_base: bool = False

class CurrencyUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    symbol: str | None = None
    is_base: bool | None = None

class CurrencyOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    symbol: str
    is_base: bool
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}

class ExchangeRateCreate(BaseModel):
    from_currency_id: uuid.UUID
    to_currency_id: uuid.UUID
    rate: Decimal
    effective_date: date

class ExchangeRateOut(BaseModel):
    id: uuid.UUID
    from_currency_id: uuid.UUID
    to_currency_id: uuid.UUID
    rate: Decimal
    effective_date: date
    from_currency_code: str | None = None
    to_currency_code: str | None = None
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}

class BankStatementOut(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    statement_date: date
    opening_balance: Decimal
    closing_balance: Decimal
    file_url: str | None
    line_count: int = 0
    matched_count: int = 0
    is_reconciled: bool = False
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}

class BankStatementLineOut(BaseModel):
    id: uuid.UUID
    statement_id: uuid.UUID
    date: date
    description: str
    amount: Decimal
    matched_payment_id: uuid.UUID | None
    status: str
    model_config = {"from_attributes": True}


# ── Currency endpoints ─────────────────────────────────────────────────────────

@router.get("/currencies", summary="List all currencies")
async def list_currencies(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(select(Currency).order_by(Currency.code.asc()))
    currencies = result.scalars().all()
    return {
        "total": len(currencies),
        "currencies": [CurrencyOut.model_validate(c).model_dump() for c in currencies],
    }


@router.post("/currencies", status_code=status.HTTP_201_CREATED, summary="Create a currency")
async def create_currency(
    payload: CurrencyCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("finance")),
) -> dict[str, Any]:
    # If setting as base, unset any existing base
    if payload.is_base:
        existing_base = await db.execute(select(Currency).where(Currency.is_base == True))  # noqa: E712
        for c in existing_base.scalars().all():
            c.is_base = False

    currency = Currency(
        code=payload.code.upper(),
        name=payload.name,
        symbol=payload.symbol,
        is_base=payload.is_base,
    )
    db.add(currency)
    await db.commit()
    await db.refresh(currency)
    return CurrencyOut.model_validate(currency).model_dump()


@router.put("/currencies/{currency_id}", summary="Update a currency")
async def update_currency(
    currency_id: uuid.UUID,
    payload: CurrencyUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("finance")),
) -> dict[str, Any]:
    currency = await db.get(Currency, currency_id)
    if not currency:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Currency not found")

    if payload.is_base:
        existing_base = await db.execute(select(Currency).where(Currency.is_base == True))  # noqa: E712
        for c in existing_base.scalars().all():
            c.is_base = False

    for field, value in payload.model_dump(exclude_none=True).items():
        if field == "code" and value:
            value = value.upper()
        setattr(currency, field, value)

    await db.commit()
    await db.refresh(currency)
    return CurrencyOut.model_validate(currency).model_dump()


@router.delete("/currencies/{currency_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a currency")
async def delete_currency(
    currency_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("finance")),
) -> Response:
    currency = await db.get(Currency, currency_id)
    if not currency:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Currency not found")
    await db.delete(currency)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Exchange Rate endpoints ────────────────────────────────────────────────────

@router.get("/exchange-rates", summary="List exchange rates")
async def list_exchange_rates(
    current_user: CurrentUser,
    db: DBSession,
    from_currency_id: uuid.UUID | None = Query(None),
    to_currency_id: uuid.UUID | None = Query(None),
) -> dict[str, Any]:
    query = select(ExchangeRate).order_by(ExchangeRate.effective_date.desc())
    if from_currency_id:
        query = query.where(ExchangeRate.from_currency_id == from_currency_id)
    if to_currency_id:
        query = query.where(ExchangeRate.to_currency_id == to_currency_id)

    result = await db.execute(query)
    rates = result.scalars().all()

    items = []
    for r in rates:
        d = ExchangeRateOut.model_validate(r).model_dump()
        d["from_currency_code"] = r.from_currency.code if r.from_currency else None
        d["to_currency_code"] = r.to_currency.code if r.to_currency else None
        items.append(d)

    return {"total": len(items), "exchange_rates": items}


@router.post("/exchange-rates", status_code=status.HTTP_201_CREATED, summary="Create an exchange rate")
async def create_exchange_rate(
    payload: ExchangeRateCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("finance")),
) -> dict[str, Any]:
    rate = ExchangeRate(
        from_currency_id=payload.from_currency_id,
        to_currency_id=payload.to_currency_id,
        rate=payload.rate,
        effective_date=payload.effective_date,
    )
    db.add(rate)
    await db.commit()
    await db.refresh(rate)
    return ExchangeRateOut.model_validate(rate).model_dump()


# ── Bank Statement endpoints ──────────────────────────────────────────────────

@router.post("/bank-statements/import", status_code=status.HTTP_201_CREATED, summary="Import a bank statement from CSV")
async def import_bank_statement(
    current_user: CurrentUser,
    db: DBSession,
    account_id: uuid.UUID = Query(..., description="Account to attach statement to"),
    statement_date: date = Query(..., description="Statement date"),
    file: UploadFile = File(...),
    _admin: Any = Depends(require_app_admin("finance")),
) -> dict[str, Any]:
    # Verify account exists
    account = await db.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    # Parse CSV
    content = await file.read()
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))

    stmt = BankStatement(
        account_id=account_id,
        statement_date=statement_date,
        opening_balance=Decimal("0"),
        closing_balance=Decimal("0"),
        file_url=None,
    )
    db.add(stmt)
    await db.flush()

    lines_created = 0
    running_total = Decimal("0")
    first_line = True

    for row in reader:
        # Expect columns: date, description, amount
        try:
            line_date = date.fromisoformat(row.get("date", "").strip())
        except (ValueError, AttributeError):
            line_date = statement_date

        desc = row.get("description", "").strip() or "No description"
        try:
            amount = Decimal(row.get("amount", "0").strip().replace(",", ""))
        except Exception:
            amount = Decimal("0")

        if first_line:
            first_line = False

        running_total += amount

        line = BankStatementLine(
            statement_id=stmt.id,
            date=line_date,
            description=desc,
            amount=amount,
            status="unmatched",
        )
        db.add(line)
        lines_created += 1

    stmt.closing_balance = running_total
    await db.commit()
    await db.refresh(stmt)

    return {
        "id": str(stmt.id),
        "statement_date": stmt.statement_date.isoformat(),
        "lines_imported": lines_created,
        "closing_balance": str(stmt.closing_balance),
    }


@router.get("/bank-statements", summary="List bank statements")
async def list_bank_statements(
    current_user: CurrentUser,
    db: DBSession,
    account_id: uuid.UUID | None = Query(None),
) -> dict[str, Any]:
    query = select(BankStatement).order_by(BankStatement.statement_date.desc())
    if account_id:
        query = query.where(BankStatement.account_id == account_id)

    result = await db.execute(query)
    statements = result.scalars().all()

    items = []
    for s in statements:
        d = BankStatementOut.model_validate(s).model_dump()
        d["line_count"] = len(s.lines) if s.lines else 0
        d["matched_count"] = sum(1 for ln in (s.lines or []) if ln.status == "matched")
        d["is_reconciled"] = s.reconciliation is not None
        items.append(d)

    return {"total": len(items), "statements": items}


@router.get("/bank-statements/{statement_id}", summary="Get bank statement detail with lines")
async def get_bank_statement(
    statement_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    stmt = await db.get(BankStatement, statement_id)
    if not stmt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Statement not found")

    await db.refresh(stmt, attribute_names=["lines", "reconciliation", "account"])

    lines = [BankStatementLineOut.model_validate(ln).model_dump() for ln in (stmt.lines or [])]
    return {
        "id": str(stmt.id),
        "account_id": str(stmt.account_id),
        "account_name": stmt.account.name if stmt.account else None,
        "statement_date": stmt.statement_date.isoformat(),
        "opening_balance": str(stmt.opening_balance),
        "closing_balance": str(stmt.closing_balance),
        "is_reconciled": stmt.reconciliation is not None,
        "lines": lines,
    }


# ── Reconciliation endpoints ─────────────────────────────────────────────────

@router.post("/bank-statements/{statement_id}/auto-match", summary="Auto-match statement lines to payments")
async def auto_match_statement(
    statement_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("finance")),
) -> dict[str, Any]:
    stmt = await db.get(BankStatement, statement_id)
    if not stmt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Statement not found")

    await db.refresh(stmt, attribute_names=["lines"])
    matched_count = 0

    for line in stmt.lines:
        if line.status != "unmatched":
            continue

        # Try to find a payment with matching amount and date within 3 days
        payment_result = await db.execute(
            select(Payment).where(
                and_(
                    Payment.amount == abs(line.amount),
                    Payment.payment_date >= line.date,
                    Payment.payment_date <= line.date,
                )
            )
        )
        payment = payment_result.scalar_one_or_none()

        if payment:
            line.matched_payment_id = payment.id
            line.status = "matched"
            matched_count += 1

    await db.commit()
    return {"matched": matched_count, "total_lines": len(stmt.lines)}


class ReconcilePayload(BaseModel):
    notes: str | None = None

@router.post("/bank-statements/{statement_id}/reconcile", summary="Reconcile a bank statement")
async def reconcile_statement(
    statement_id: uuid.UUID,
    payload: ReconcilePayload,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("finance")),
) -> dict[str, Any]:
    stmt = await db.get(BankStatement, statement_id)
    if not stmt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Statement not found")

    # Check if already reconciled
    existing = await db.execute(
        select(Reconciliation).where(Reconciliation.statement_id == statement_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Statement already reconciled")

    reconciliation = Reconciliation(
        statement_id=statement_id,
        reconciled_by=current_user.id,
        notes=payload.notes,
    )
    db.add(reconciliation)
    await db.commit()
    await db.refresh(reconciliation)

    return {
        "id": str(reconciliation.id),
        "statement_id": str(statement_id),
        "reconciled_by": str(current_user.id),
        "reconciled_at": reconciliation.reconciled_at.isoformat(),
        "notes": reconciliation.notes,
    }


# ── Financial Reports ─────────────────────────────────────────────────────────

@router.get("/reports/pnl", summary="Profit & Loss report")
async def pnl_report(
    current_user: CurrentUser,
    db: DBSession,
    from_date: date = Query(..., alias="from", description="Start date"),
    to_date: date = Query(..., alias="to", description="End date"),
) -> dict[str, Any]:
    """Generate a P&L report for the given date range.

    Revenue accounts have credits > debits (positive = income).
    Expense accounts have debits > credits (positive = expense).
    """
    from app.models.finance import JournalEntry  # noqa: PLC0415

    # Revenue: sum credits - debits for revenue accounts
    revenue_query = (
        select(
            Account.id,
            Account.code,
            Account.name,
            (func.coalesce(func.sum(JournalLine.credit), 0) - func.coalesce(func.sum(JournalLine.debit), 0)).label("amount"),
        )
        .join(JournalLine, JournalLine.account_id == Account.id)
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .where(
            and_(
                Account.account_type == "revenue",
                JournalEntry.status == "posted",
                JournalEntry.entry_date >= from_date,
                JournalEntry.entry_date <= to_date,
            )
        )
        .group_by(Account.id, Account.code, Account.name)
        .order_by(Account.code.asc())
    )

    # Expense: sum debits - credits for expense accounts
    expense_query = (
        select(
            Account.id,
            Account.code,
            Account.name,
            (func.coalesce(func.sum(JournalLine.debit), 0) - func.coalesce(func.sum(JournalLine.credit), 0)).label("amount"),
        )
        .join(JournalLine, JournalLine.account_id == Account.id)
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .where(
            and_(
                Account.account_type == "expense",
                JournalEntry.status == "posted",
                JournalEntry.entry_date >= from_date,
                JournalEntry.entry_date <= to_date,
            )
        )
        .group_by(Account.id, Account.code, Account.name)
        .order_by(Account.code.asc())
    )

    rev_result = await db.execute(revenue_query)
    revenue_rows = [
        {"account_id": str(r.id), "account_code": r.code, "account_name": r.name, "amount": float(r.amount)}
        for r in rev_result.all()
    ]

    exp_result = await db.execute(expense_query)
    expense_rows = [
        {"account_id": str(r.id), "account_code": r.code, "account_name": r.name, "amount": float(r.amount)}
        for r in exp_result.all()
    ]

    total_revenue = sum(r["amount"] for r in revenue_rows)
    total_expenses = sum(r["amount"] for r in expense_rows)
    net_income = total_revenue - total_expenses

    return {
        "from": from_date.isoformat(),
        "to": to_date.isoformat(),
        "revenue": revenue_rows,
        "total_revenue": total_revenue,
        "expenses": expense_rows,
        "total_expenses": total_expenses,
        "net_income": net_income,
    }


@router.get("/reports/balance-sheet", summary="Balance Sheet report")
async def balance_sheet_report(
    current_user: CurrentUser,
    db: DBSession,
    as_of: date = Query(..., description="As-of date"),
) -> dict[str, Any]:
    """Balance Sheet: Assets = Liabilities + Equity."""
    from app.models.finance import JournalEntry  # noqa: PLC0415

    async def _get_section(account_type: str, debit_positive: bool) -> list[dict[str, Any]]:
        if debit_positive:
            amount_expr = func.coalesce(func.sum(JournalLine.debit), 0) - func.coalesce(func.sum(JournalLine.credit), 0)
        else:
            amount_expr = func.coalesce(func.sum(JournalLine.credit), 0) - func.coalesce(func.sum(JournalLine.debit), 0)

        query = (
            select(
                Account.id,
                Account.code,
                Account.name,
                amount_expr.label("balance"),
            )
            .join(JournalLine, JournalLine.account_id == Account.id)
            .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
            .where(
                and_(
                    Account.account_type == account_type,
                    JournalEntry.status == "posted",
                    JournalEntry.entry_date <= as_of,
                )
            )
            .group_by(Account.id, Account.code, Account.name)
            .order_by(Account.code.asc())
        )
        result = await db.execute(query)
        return [
            {"account_id": str(r.id), "account_code": r.code, "account_name": r.name, "balance": float(r.balance)}
            for r in result.all()
        ]

    assets = await _get_section("asset", debit_positive=True)
    liabilities = await _get_section("liability", debit_positive=False)
    equity = await _get_section("equity", debit_positive=False)

    total_assets = sum(a["balance"] for a in assets)
    total_liabilities = sum(l["balance"] for l in liabilities)
    total_equity = sum(e["balance"] for e in equity)

    return {
        "as_of": as_of.isoformat(),
        "assets": assets,
        "total_assets": total_assets,
        "liabilities": liabilities,
        "total_liabilities": total_liabilities,
        "equity": equity,
        "total_equity": total_equity,
        "total_liabilities_and_equity": total_liabilities + total_equity,
        "is_balanced": abs(total_assets - (total_liabilities + total_equity)) < 0.01,
    }
