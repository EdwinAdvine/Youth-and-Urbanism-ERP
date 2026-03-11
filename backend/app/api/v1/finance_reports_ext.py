"""Finance API — Extended Reports (Cash Flow, Trial Balance, Aged Receivables/Payables, KPIs)."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import and_, case, func, select

from app.core.deps import CurrentUser, DBSession
from app.models.finance import (
    Account,
    Expense,
    FixedAsset,
    Invoice,
    JournalEntry,
    JournalLine,
    Payment,
    VendorBill,
)

router = APIRouter()


# ── Cash Flow Statement ──────────────────────────────────────────────────────

@router.get("/reports/cash-flow", summary="Cash flow statement for a date range")
async def cash_flow_statement(
    current_user: CurrentUser,
    db: DBSession,
    start_date: date = Query(..., description="Start date"),
    end_date: date = Query(..., description="End date"),
) -> dict[str, Any]:
    # Operating activities: payments received minus expenses/vendor payments
    # Inflows: completed payments received (linked to sales invoices)
    inflows_result = await db.execute(
        select(
            func.coalesce(func.sum(Payment.amount), 0).label("total"),
        )
        .where(
            and_(
                Payment.payment_date >= start_date,
                Payment.payment_date <= end_date,
                Payment.status == "completed",
                Payment.invoice_id.isnot(None),
            )
        )
    )
    cash_inflows = Decimal(str(inflows_result.scalar() or 0))

    # Outflows: vendor bill payments
    vendor_payments_result = await db.execute(
        select(
            func.coalesce(func.sum(VendorBill.total), 0).label("total"),
        )
        .where(
            and_(
                VendorBill.status == "paid",
                VendorBill.updated_at >= datetime.combine(start_date, datetime.min.time()),
                VendorBill.updated_at <= datetime.combine(end_date, datetime.max.time()),
            )
        )
    )
    vendor_outflows = Decimal(str(vendor_payments_result.scalar() or 0))

    # Expense reimbursements
    expense_result = await db.execute(
        select(
            func.coalesce(func.sum(Expense.amount), 0).label("total"),
        )
        .where(
            and_(
                Expense.status == "reimbursed",
                Expense.expense_date >= start_date,
                Expense.expense_date <= end_date,
            )
        )
    )
    expense_outflows = Decimal(str(expense_result.scalar() or 0))

    operating_net = cash_inflows - vendor_outflows - expense_outflows

    # Investing activities: fixed asset purchases in the period
    asset_purchases_result = await db.execute(
        select(
            func.coalesce(func.sum(FixedAsset.purchase_cost), 0).label("total"),
        )
        .where(
            and_(
                FixedAsset.purchase_date >= start_date,
                FixedAsset.purchase_date <= end_date,
            )
        )
    )
    asset_purchases = Decimal(str(asset_purchases_result.scalar() or 0))
    investing_net = -asset_purchases

    # Financing activities: from journal entries tagged as equity/liability
    financing_result = await db.execute(
        select(
            func.coalesce(func.sum(JournalLine.credit - JournalLine.debit), 0).label("net"),
        )
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .join(Account, Account.id == JournalLine.account_id)
        .where(
            and_(
                JournalEntry.status == "posted",
                JournalEntry.entry_date >= start_date,
                JournalEntry.entry_date <= end_date,
                Account.account_type.in_(["equity", "liability"]),
            )
        )
    )
    financing_net = Decimal(str(financing_result.scalar() or 0))

    net_change = operating_net + investing_net + financing_net

    return {
        "period": {"start_date": str(start_date), "end_date": str(end_date)},
        "operating_activities": {
            "cash_inflows": str(cash_inflows),
            "vendor_payments": str(vendor_outflows),
            "expense_reimbursements": str(expense_outflows),
            "net": str(operating_net),
        },
        "investing_activities": {
            "asset_purchases": str(asset_purchases),
            "net": str(investing_net),
        },
        "financing_activities": {
            "net": str(financing_net),
        },
        "net_change_in_cash": str(net_change),
    }


# ── Trial Balance (extended — includes all accounts with zero balances) ──────

@router.get("/reports/trial-balance-ext", summary="Extended trial balance with all accounts")
async def trial_balance_extended(
    current_user: CurrentUser,
    db: DBSession,
    as_of: date | None = Query(None, description="Trial balance as of date (default: today)"),
) -> dict[str, Any]:
    as_of_date = as_of or date.today()

    # All active accounts with their journal line totals up to as_of
    result = await db.execute(
        select(
            Account.id,
            Account.code,
            Account.name,
            Account.account_type,
            func.coalesce(func.sum(JournalLine.debit), 0).label("total_debit"),
            func.coalesce(func.sum(JournalLine.credit), 0).label("total_credit"),
        )
        .outerjoin(JournalLine, JournalLine.account_id == Account.id)
        .outerjoin(
            JournalEntry,
            and_(
                JournalEntry.id == JournalLine.journal_entry_id,
                JournalEntry.status == "posted",
                JournalEntry.entry_date <= as_of_date,
            ),
        )
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
        "as_of": str(as_of_date),
        "accounts": accounts,
        "grand_total_debit": str(grand_debit),
        "grand_total_credit": str(grand_credit),
        "is_balanced": grand_debit == grand_credit,
    }


# ── Aged Receivables ────────────────────────────────────────────────────────

@router.get("/reports/aged-receivables", summary="Aged receivables report")
async def aged_receivables(
    current_user: CurrentUser,
    db: DBSession,
    as_of: date | None = Query(None, description="As-of date (default: today)"),
) -> dict[str, Any]:
    as_of_date = as_of or date.today()

    # Unpaid sales invoices (sent or overdue)
    result = await db.execute(
        select(Invoice)
        .where(
            and_(
                Invoice.invoice_type == "sales",
                Invoice.status.in_(["sent", "overdue"]),
                Invoice.due_date <= as_of_date,
            )
        )
        .order_by(Invoice.due_date.asc())
    )
    invoices = result.scalars().all()

    buckets = {
        "current": [],       # not yet due
        "1_30": [],          # 1-30 days overdue
        "31_60": [],         # 31-60 days overdue
        "61_90": [],         # 61-90 days overdue
        "over_90": [],       # 90+ days overdue
    }
    totals = {k: Decimal("0") for k in buckets}

    # Also get invoices not yet due
    not_due_result = await db.execute(
        select(Invoice)
        .where(
            and_(
                Invoice.invoice_type == "sales",
                Invoice.status.in_(["sent", "overdue"]),
                Invoice.due_date > as_of_date,
            )
        )
        .order_by(Invoice.due_date.asc())
    )
    not_due_invoices = not_due_result.scalars().all()

    for inv in not_due_invoices:
        entry = {
            "invoice_id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "customer_name": inv.customer_name,
            "due_date": str(inv.due_date),
            "total": str(inv.total),
            "currency": inv.currency,
            "days_overdue": 0,
        }
        buckets["current"].append(entry)
        totals["current"] += inv.total

    for inv in invoices:
        days_overdue = (as_of_date - inv.due_date).days
        entry = {
            "invoice_id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "customer_name": inv.customer_name,
            "due_date": str(inv.due_date),
            "total": str(inv.total),
            "currency": inv.currency,
            "days_overdue": days_overdue,
        }

        if days_overdue <= 30:
            buckets["1_30"].append(entry)
            totals["1_30"] += inv.total
        elif days_overdue <= 60:
            buckets["31_60"].append(entry)
            totals["31_60"] += inv.total
        elif days_overdue <= 90:
            buckets["61_90"].append(entry)
            totals["61_90"] += inv.total
        else:
            buckets["over_90"].append(entry)
            totals["over_90"] += inv.total

    grand_total = sum(totals.values())

    return {
        "as_of": str(as_of_date),
        "buckets": {
            "current": {"invoices": buckets["current"], "total": str(totals["current"])},
            "1_30_days": {"invoices": buckets["1_30"], "total": str(totals["1_30"])},
            "31_60_days": {"invoices": buckets["31_60"], "total": str(totals["31_60"])},
            "61_90_days": {"invoices": buckets["61_90"], "total": str(totals["61_90"])},
            "over_90_days": {"invoices": buckets["over_90"], "total": str(totals["over_90"])},
        },
        "grand_total": str(grand_total),
    }


# ── Aged Payables ────────────────────────────────────────────────────────────

@router.get("/reports/aged-payables", summary="Aged payables report")
async def aged_payables(
    current_user: CurrentUser,
    db: DBSession,
    as_of: date | None = Query(None, description="As-of date (default: today)"),
) -> dict[str, Any]:
    as_of_date = as_of or date.today()

    # Unpaid vendor bills (draft, received, approved, overdue — not paid/cancelled)
    result = await db.execute(
        select(VendorBill)
        .where(
            and_(
                VendorBill.status.in_(["draft", "received", "approved", "overdue"]),
                VendorBill.due_date <= as_of_date,
            )
        )
        .order_by(VendorBill.due_date.asc())
    )
    bills = result.scalars().all()

    # Not yet due
    not_due_result = await db.execute(
        select(VendorBill)
        .where(
            and_(
                VendorBill.status.in_(["draft", "received", "approved", "overdue"]),
                VendorBill.due_date > as_of_date,
            )
        )
        .order_by(VendorBill.due_date.asc())
    )
    not_due_bills = not_due_result.scalars().all()

    buckets = {
        "current": [],
        "1_30": [],
        "31_60": [],
        "61_90": [],
        "over_90": [],
    }
    totals = {k: Decimal("0") for k in buckets}

    for bill in not_due_bills:
        entry = {
            "bill_id": str(bill.id),
            "bill_number": bill.bill_number,
            "vendor_name": bill.vendor_name,
            "due_date": str(bill.due_date),
            "total": str(bill.total),
            "currency": bill.currency,
            "days_overdue": 0,
        }
        buckets["current"].append(entry)
        totals["current"] += bill.total

    for bill in bills:
        days_overdue = (as_of_date - bill.due_date).days
        entry = {
            "bill_id": str(bill.id),
            "bill_number": bill.bill_number,
            "vendor_name": bill.vendor_name,
            "due_date": str(bill.due_date),
            "total": str(bill.total),
            "currency": bill.currency,
            "days_overdue": days_overdue,
        }

        if days_overdue <= 30:
            buckets["1_30"].append(entry)
            totals["1_30"] += bill.total
        elif days_overdue <= 60:
            buckets["31_60"].append(entry)
            totals["31_60"] += bill.total
        elif days_overdue <= 90:
            buckets["61_90"].append(entry)
            totals["61_90"] += bill.total
        else:
            buckets["over_90"].append(entry)
            totals["over_90"] += bill.total

    grand_total = sum(totals.values())

    return {
        "as_of": str(as_of_date),
        "buckets": {
            "current": {"bills": buckets["current"], "total": str(totals["current"])},
            "1_30_days": {"bills": buckets["1_30"], "total": str(totals["1_30"])},
            "31_60_days": {"bills": buckets["31_60"], "total": str(totals["31_60"])},
            "61_90_days": {"bills": buckets["61_90"], "total": str(totals["61_90"])},
            "over_90_days": {"bills": buckets["over_90"], "total": str(totals["over_90"])},
        },
        "grand_total": str(grand_total),
    }


# ── Dashboard KPIs ───────────────────────────────────────────────────────────

@router.get("/dashboard/kpis", summary="Financial KPIs for the dashboard")
async def dashboard_kpis(
    current_user: CurrentUser,
    db: DBSession,
    period_start: date | None = Query(None, description="Period start (default: first day of current month)"),
    period_end: date | None = Query(None, description="Period end (default: today)"),
) -> dict[str, Any]:
    today = date.today()
    start = period_start or today.replace(day=1)
    end = period_end or today

    # Revenue: sum of paid invoices (sales) in period
    revenue_result = await db.execute(
        select(
            func.coalesce(func.sum(Invoice.total), 0).label("total"),
            func.count(Invoice.id).label("count"),
        )
        .where(
            and_(
                Invoice.invoice_type == "sales",
                Invoice.status == "paid",
                Invoice.issue_date >= start,
                Invoice.issue_date <= end,
            )
        )
    )
    revenue_row = revenue_result.one()
    revenue = Decimal(str(revenue_row.total))
    invoices_paid = revenue_row.count

    # Expenses: sum of approved/reimbursed expenses in period
    expenses_result = await db.execute(
        select(
            func.coalesce(func.sum(Expense.amount), 0).label("total"),
            func.count(Expense.id).label("count"),
        )
        .where(
            and_(
                Expense.status.in_(["approved", "reimbursed"]),
                Expense.expense_date >= start,
                Expense.expense_date <= end,
            )
        )
    )
    expenses_row = expenses_result.one()
    total_expenses = Decimal(str(expenses_row.total))
    expense_count = expenses_row.count

    # Vendor bill payments in period
    vendor_paid_result = await db.execute(
        select(
            func.coalesce(func.sum(VendorBill.total), 0).label("total"),
        )
        .where(
            and_(
                VendorBill.status == "paid",
                VendorBill.issue_date >= start,
                VendorBill.issue_date <= end,
            )
        )
    )
    vendor_payments = Decimal(str(vendor_paid_result.scalar() or 0))

    total_outflows = total_expenses + vendor_payments
    profit = revenue - total_outflows

    # Cash position: total completed payments received minus total outgoing
    cash_in_result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0))
        .where(Payment.status == "completed")
    )
    total_cash_in = Decimal(str(cash_in_result.scalar() or 0))

    cash_out_result = await db.execute(
        select(func.coalesce(func.sum(VendorBill.total), 0))
        .where(VendorBill.status == "paid")
    )
    total_cash_out = Decimal(str(cash_out_result.scalar() or 0))

    expense_reimbursed_result = await db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0))
        .where(Expense.status == "reimbursed")
    )
    total_reimbursed = Decimal(str(expense_reimbursed_result.scalar() or 0))

    cash_position = total_cash_in - total_cash_out - total_reimbursed

    # Receivables: sum of unpaid sales invoices
    receivables_result = await db.execute(
        select(func.coalesce(func.sum(Invoice.total), 0))
        .where(
            and_(
                Invoice.invoice_type == "sales",
                Invoice.status.in_(["sent", "overdue"]),
            )
        )
    )
    total_receivables = Decimal(str(receivables_result.scalar() or 0))

    # Payables: sum of unpaid vendor bills
    payables_result = await db.execute(
        select(func.coalesce(func.sum(VendorBill.total), 0))
        .where(
            VendorBill.status.in_(["draft", "received", "approved", "overdue"])
        )
    )
    total_payables = Decimal(str(payables_result.scalar() or 0))

    # Overdue counts
    overdue_invoices_result = await db.execute(
        select(func.count(Invoice.id))
        .where(
            and_(
                Invoice.invoice_type == "sales",
                Invoice.status.in_(["sent", "overdue"]),
                Invoice.due_date < today,
            )
        )
    )
    overdue_invoices = overdue_invoices_result.scalar() or 0

    overdue_bills_result = await db.execute(
        select(func.count(VendorBill.id))
        .where(
            and_(
                VendorBill.status.in_(["draft", "received", "approved", "overdue"]),
                VendorBill.due_date < today,
            )
        )
    )
    overdue_bills = overdue_bills_result.scalar() or 0

    # Pending expense approvals
    pending_expenses_result = await db.execute(
        select(func.count(Expense.id))
        .where(Expense.status == "submitted")
    )
    pending_expenses = pending_expenses_result.scalar() or 0

    return {
        "period": {"start_date": str(start), "end_date": str(end)},
        "revenue": str(revenue),
        "invoices_paid": invoices_paid,
        "total_expenses": str(total_expenses),
        "expense_count": expense_count,
        "vendor_payments": str(vendor_payments),
        "total_outflows": str(total_outflows),
        "profit": str(profit),
        "cash_position": str(cash_position),
        "total_receivables": str(total_receivables),
        "total_payables": str(total_payables),
        "overdue_invoices": overdue_invoices,
        "overdue_bills": overdue_bills,
        "pending_expense_approvals": pending_expenses,
    }
