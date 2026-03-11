"""Automatic Journal Entry posting service.

When financial events occur (invoice sent/paid, expense approved, asset purchased,
depreciation run) this service auto-posts the corresponding double-entry journal
entries — eliminating the #1 gap vs QuickBooks Advanced.

Trigger points are wired in main.py event bus handlers.
"""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import (
    Account,
    Invoice,
    JournalEntry,
    JournalLine,
    Expense,
    VendorBill,
    FixedAsset,
)


async def _generate_je_number(db: AsyncSession) -> str:
    """Generate unique journal entry number: AUTO-YYYYMMDD-NNNN."""
    today = date.today().strftime("%Y%m%d")
    result = await db.execute(
        select(JournalEntry).where(
            JournalEntry.entry_number.like(f"AUTO-{today}-%")
        ).order_by(JournalEntry.entry_number.desc())
    )
    existing = result.scalars().all()
    seq = len(existing) + 1
    return f"AUTO-{today}-{seq:04d}"


async def _get_default_account(
    db: AsyncSession, account_type: str, code_prefix: str | None = None
) -> Account | None:
    """Look up the first active account of a given type (optionally by code prefix)."""
    q = select(Account).where(Account.account_type == account_type, Account.is_active == True)
    if code_prefix:
        q = q.where(Account.code.like(f"{code_prefix}%"))
    result = await db.execute(q.limit(1))
    return result.scalar_one_or_none()


async def _post_je(
    db: AsyncSession,
    description: str,
    debit_account_id: uuid.UUID,
    credit_account_id: uuid.UUID,
    amount: Decimal,
    metadata: dict[str, Any] | None = None,
    posted_by_id: uuid.UUID | None = None,
) -> JournalEntry:
    """Create and immediately post a two-line journal entry."""
    entry_number = await _generate_je_number(db)
    je = JournalEntry(
        entry_number=entry_number,
        entry_date=date.today(),
        description=description,
        status="posted",
        posted_by=posted_by_id,
        metadata_json=metadata or {},
    )
    db.add(je)
    await db.flush()  # get je.id

    db.add(JournalLine(
        journal_entry_id=je.id,
        account_id=debit_account_id,
        debit=amount,
        credit=Decimal("0"),
        description=description,
    ))
    db.add(JournalLine(
        journal_entry_id=je.id,
        account_id=credit_account_id,
        debit=Decimal("0"),
        credit=amount,
        description=description,
    ))
    await db.flush()
    return je


# ─────────────────────────────────────────────────────────────────────────────
# Public handlers — called from event bus or API endpoints
# ─────────────────────────────────────────────────────────────────────────────

async def on_invoice_sent(db: AsyncSession, invoice_id: uuid.UUID) -> JournalEntry | None:
    """Invoice sent → DR Accounts Receivable / CR Revenue."""
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice or invoice.auto_je_posted:
        return None

    ar_account = await _get_default_account(db, "asset", "12")  # 1200 AR
    if not ar_account:
        ar_account = await _get_default_account(db, "asset")
    revenue_account = await _get_default_account(db, "revenue", "4")  # 4000 Revenue
    if not revenue_account:
        revenue_account = await _get_default_account(db, "revenue")

    if not ar_account or not revenue_account:
        return None  # accounts not configured — skip silently

    je = await _post_je(
        db,
        description=f"Invoice {invoice.invoice_number} — {invoice.customer_name or 'Customer'}",
        debit_account_id=ar_account.id,
        credit_account_id=revenue_account.id,
        amount=invoice.total,
        metadata={"invoice_id": str(invoice_id), "trigger": "invoice.sent"},
    )

    # Mark so we don't double-post
    invoice.auto_je_posted = True
    await db.flush()
    return je


async def on_invoice_paid(db: AsyncSession, invoice_id: uuid.UUID) -> JournalEntry | None:
    """Invoice paid → DR Cash / CR Accounts Receivable."""
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        return None

    cash_account = await _get_default_account(db, "asset", "10")  # 1000 Cash
    if not cash_account:
        cash_account = await _get_default_account(db, "asset")
    ar_account = await _get_default_account(db, "asset", "12")  # 1200 AR
    if not ar_account:
        ar_account = await _get_default_account(db, "asset")

    if not cash_account or not ar_account or cash_account.id == ar_account.id:
        return None

    je = await _post_je(
        db,
        description=f"Payment received — Invoice {invoice.invoice_number}",
        debit_account_id=cash_account.id,
        credit_account_id=ar_account.id,
        amount=invoice.total,
        metadata={"invoice_id": str(invoice_id), "trigger": "invoice.paid"},
    )
    return je


async def on_expense_approved(
    db: AsyncSession, expense_id: uuid.UUID, approver_id: uuid.UUID | None = None
) -> JournalEntry | None:
    """Expense approved → DR Expense Account / CR Accounts Payable."""
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        return None

    # Use the expense's linked account if set, else find default expense account
    expense_account_id = expense.account_id
    if not expense_account_id:
        exp_account = await _get_default_account(db, "expense")
        if not exp_account:
            return None
        expense_account_id = exp_account.id

    ap_account = await _get_default_account(db, "liability", "20")  # 2000 AP
    if not ap_account:
        ap_account = await _get_default_account(db, "liability")
    if not ap_account:
        return None

    je = await _post_je(
        db,
        description=f"Expense approved — {expense.description[:100]}",
        debit_account_id=expense_account_id,
        credit_account_id=ap_account.id,
        amount=expense.amount,
        metadata={"expense_id": str(expense_id), "trigger": "expense.approved"},
        posted_by_id=approver_id,
    )
    return je


async def on_expense_reimbursed(
    db: AsyncSession, expense_id: uuid.UUID
) -> JournalEntry | None:
    """Expense reimbursed → DR Accounts Payable / CR Cash."""
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        return None

    ap_account = await _get_default_account(db, "liability", "20")
    if not ap_account:
        ap_account = await _get_default_account(db, "liability")
    cash_account = await _get_default_account(db, "asset", "10")
    if not cash_account:
        cash_account = await _get_default_account(db, "asset")

    if not ap_account or not cash_account:
        return None

    je = await _post_je(
        db,
        description=f"Expense reimbursed — {expense.description[:100]}",
        debit_account_id=ap_account.id,
        credit_account_id=cash_account.id,
        amount=expense.amount,
        metadata={"expense_id": str(expense_id), "trigger": "expense.reimbursed"},
    )
    return je


async def on_vendor_bill_paid(
    db: AsyncSession, bill_id: uuid.UUID
) -> JournalEntry | None:
    """Vendor bill paid → DR Accounts Payable / CR Cash."""
    result = await db.execute(select(VendorBill).where(VendorBill.id == bill_id))
    bill = result.scalar_one_or_none()
    if not bill:
        return None

    ap_account = await _get_default_account(db, "liability", "20")
    if not ap_account:
        ap_account = await _get_default_account(db, "liability")
    cash_account = await _get_default_account(db, "asset", "10")
    if not cash_account:
        cash_account = await _get_default_account(db, "asset")

    if not ap_account or not cash_account:
        return None

    je = await _post_je(
        db,
        description=f"Bill paid — {bill.bill_number} ({bill.vendor_name})",
        debit_account_id=ap_account.id,
        credit_account_id=cash_account.id,
        amount=bill.total,
        metadata={"bill_id": str(bill_id), "trigger": "bill.paid"},
    )
    return je


async def on_vendor_bill_approved(
    db: AsyncSession, bill_id: uuid.UUID
) -> JournalEntry | None:
    """Vendor bill approved → DR Expense / CR Accounts Payable."""
    result = await db.execute(select(VendorBill).where(VendorBill.id == bill_id))
    bill = result.scalar_one_or_none()
    if not bill:
        return None

    expense_account = await _get_default_account(db, "expense", "5")  # 5000 COGS/Expense
    if not expense_account:
        expense_account = await _get_default_account(db, "expense")
    ap_account = await _get_default_account(db, "liability", "20")
    if not ap_account:
        ap_account = await _get_default_account(db, "liability")

    if not expense_account or not ap_account:
        return None

    je = await _post_je(
        db,
        description=f"Vendor bill approved — {bill.bill_number} ({bill.vendor_name})",
        debit_account_id=expense_account.id,
        credit_account_id=ap_account.id,
        amount=bill.total,
        metadata={"bill_id": str(bill_id), "trigger": "bill.approved"},
    )
    return je


async def on_asset_purchased(
    db: AsyncSession, asset_id: uuid.UUID
) -> JournalEntry | None:
    """Fixed asset purchased → DR Fixed Asset / CR Cash (or AP)."""
    result = await db.execute(select(FixedAsset).where(FixedAsset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        return None

    asset_account_id = asset.account_id
    if not asset_account_id:
        fa_account = await _get_default_account(db, "asset", "15")  # 1500 Fixed Assets
        if not fa_account:
            fa_account = await _get_default_account(db, "asset")
        if not fa_account:
            return None
        asset_account_id = fa_account.id

    cash_account = await _get_default_account(db, "asset", "10")
    if not cash_account:
        cash_account = await _get_default_account(db, "asset")
    if not cash_account or str(cash_account.id) == str(asset_account_id):
        return None

    je = await _post_je(
        db,
        description=f"Fixed asset acquired — {asset.name} ({asset.asset_code})",
        debit_account_id=asset_account_id,
        credit_account_id=cash_account.id,
        amount=asset.purchase_cost,
        metadata={"asset_id": str(asset_id), "trigger": "asset.purchased"},
    )
    return je


async def on_asset_depreciated(
    db: AsyncSession, asset_id: uuid.UUID, depreciation_amount: Decimal
) -> JournalEntry | None:
    """Depreciation run → DR Depreciation Expense / CR Accumulated Depreciation."""
    result = await db.execute(select(FixedAsset).where(FixedAsset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset or depreciation_amount <= 0:
        return None

    dep_expense = await _get_default_account(db, "expense", "6")  # 6xxx Depreciation Expense
    if not dep_expense:
        dep_expense = await _get_default_account(db, "expense")
    accum_dep = await _get_default_account(db, "asset", "16")  # 1600 Accumulated Depreciation (contra)
    if not accum_dep:
        accum_dep = await _get_default_account(db, "asset")

    if not dep_expense or not accum_dep or str(dep_expense.id) == str(accum_dep.id):
        return None

    je = await _post_je(
        db,
        description=f"Depreciation — {asset.name} ({asset.asset_code})",
        debit_account_id=dep_expense.id,
        credit_account_id=accum_dep.id,
        amount=depreciation_amount,
        metadata={"asset_id": str(asset_id), "trigger": "asset.depreciated"},
    )
    return je


async def on_cogs_posted(
    db: AsyncSession, sale_id: str, cogs_amount: Decimal, source: str = "pos"
) -> JournalEntry | None:
    """POS sale or E-Commerce order paid → DR COGS / CR Inventory Asset.

    Uses Average Cost method (COGS amount provided by the caller from SC module).
    """
    if cogs_amount <= 0:
        return None

    cogs_account = await _get_default_account(db, "expense", "5")  # 5xxx COGS
    if not cogs_account:
        cogs_account = await _get_default_account(db, "expense")

    inventory_account = await _get_default_account(db, "asset", "13")  # 13xx Inventory Asset
    if not inventory_account:
        inventory_account = await _get_default_account(db, "asset")

    if not cogs_account or not inventory_account or str(cogs_account.id) == str(inventory_account.id):
        return None

    je = await _post_je(
        db,
        description=f"COGS — {source} sale {sale_id[:8]}",
        debit_account_id=cogs_account.id,
        credit_account_id=inventory_account.id,
        amount=cogs_amount,
        metadata={"sale_id": sale_id, "source": source, "trigger": f"{source}.sale.completed"},
    )
    return je
