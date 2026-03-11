"""Finance models — double-entry accounting, invoicing, payments."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Account(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Chart of Accounts entry."""

    __tablename__ = "finance_accounts"

    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    account_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # asset, liability, equity, revenue, expense
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_accounts.id"), nullable=True
    )
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # relationships
    parent = relationship("Account", remote_side="Account.id", lazy="selectin")
    journal_lines = relationship("JournalLine", back_populates="account")


class JournalEntry(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Double-entry journal entry (header)."""

    __tablename__ = "finance_journal_entries"

    entry_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, posted, cancelled
    posted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    lines = relationship("JournalLine", back_populates="journal_entry", cascade="all, delete-orphan")


class JournalLine(UUIDPrimaryKeyMixin, Base):
    """Single line in a journal entry (debit or credit)."""

    __tablename__ = "finance_journal_lines"

    journal_entry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_journal_entries.id"), nullable=False
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_accounts.id"), nullable=False
    )
    debit: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    credit: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    journal_entry = relationship("JournalEntry", back_populates="lines")
    account = relationship("Account", back_populates="journal_lines")


class Invoice(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Sales or purchase invoice."""

    __tablename__ = "finance_invoices"

    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    invoice_type: Mapped[str] = mapped_column(String(20), nullable=False)  # sales, purchase
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, sent, paid, overdue, cancelled
    customer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    customer_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    items: Mapped[list | None] = mapped_column(JSON, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    # Phase 2A additions
    custom_fields: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    dimension_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    auto_je_posted: Mapped[bool] = mapped_column(Boolean, default=False)


class Payment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Payment received or made."""

    __tablename__ = "finance_payments"

    payment_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_invoices.id"), nullable=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    payment_method: Mapped[str] = mapped_column(
        String(50), default="bank_transfer"
    )  # bank_transfer, cash, card, mobile_money
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    reference: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="completed")  # pending, completed, failed
    payer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )


class Budget(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Budget allocation for a fiscal year."""
    __tablename__ = "finance_budgets"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    fiscal_year: Mapped[int] = mapped_column(Integer, nullable=False)
    department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("hr_departments.id"), nullable=True)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    spent_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft, active, closed
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    lines = relationship("BudgetLine", back_populates="budget", cascade="all, delete-orphan", lazy="selectin")


class BudgetLine(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Individual budget line for an account."""
    __tablename__ = "finance_budget_lines"

    budget_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("finance_budgets.id"), nullable=False)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("finance_accounts.id"), nullable=False)
    allocated: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    spent: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))

    budget = relationship("Budget", back_populates="lines")
    account = relationship("Account", lazy="selectin")


class TaxRate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Tax rate configuration."""
    __tablename__ = "finance_tax_rates"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)  # percentage e.g. 16.00
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class RecurringInvoice(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Template for auto-generated recurring invoices."""
    __tablename__ = "finance_recurring_invoices"

    source_invoice_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_invoices.id"), nullable=True
    )
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    customer_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    frequency: Mapped[str] = mapped_column(String(20), nullable=False)  # daily, weekly, monthly, quarterly, yearly
    next_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    items: Mapped[list | None] = mapped_column(JSON, nullable=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    last_generated: Mapped[date | None] = mapped_column(Date, nullable=True)
    invoices_generated: Mapped[int] = mapped_column(Integer, default=0)


class Expense(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Employee expense claim."""
    __tablename__ = "finance_expenses"

    description: Mapped[str] = mapped_column(String(500), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    category: Mapped[str] = mapped_column(String(100), nullable=False)  # travel, meals, office, software, other
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    receipt_file_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_files.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, submitted, approved, rejected, reimbursed
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    approver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_accounts.id"), nullable=True
    )
    # Phase 2A additions
    custom_fields: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    dimension_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    mileage_km: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    mileage_rate: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)


class VendorBill(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Bill from a vendor / supplier."""
    __tablename__ = "finance_vendor_bills"

    bill_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    vendor_name: Mapped[str] = mapped_column(String(200), nullable=False)
    vendor_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, received, approved, paid, overdue, cancelled
    items: Mapped[list | None] = mapped_column(JSON, nullable=True)
    reference: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    payment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_payments.id"), nullable=True
    )
    # Phase 2A additions
    custom_fields: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    dimension_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)


class FixedAsset(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Fixed asset for depreciation tracking."""
    __tablename__ = "finance_fixed_assets"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    asset_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)  # equipment, furniture, vehicle, building, IT
    purchase_date: Mapped[date] = mapped_column(Date, nullable=False)
    purchase_cost: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    salvage_value: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    useful_life_months: Mapped[int] = mapped_column(Integer, nullable=False)
    depreciation_method: Mapped[str] = mapped_column(
        String(30), default="straight_line"
    )  # straight_line, declining_balance
    accumulated_depreciation: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    current_value: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, disposed, fully_depreciated
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_accounts.id"), nullable=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )


# ─────────────────────────────────────────────────────────────────────────────
# Phase 2A New Models
# ─────────────────────────────────────────────────────────────────────────────

class Estimate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Sales estimate / quote. Can be converted to an Invoice."""
    __tablename__ = "finance_estimates"

    estimate_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, sent, accepted, declined, converted
    customer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    customer_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    items: Mapped[list | None] = mapped_column(JSON, nullable=True)
    custom_fields: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    dimension_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    converted_invoice_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_invoices.id"), nullable=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )


class CustomField(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """User-definable custom fields for finance entities (up to 100 per entity type)."""
    __tablename__ = "finance_custom_fields"

    entity_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # invoice, expense, bill, vendor, estimate
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)
    field_label: Mapped[str] = mapped_column(String(200), nullable=False)
    field_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # text, number, date, dropdown, checkbox, multiselect, url
    options: Mapped[list | None] = mapped_column(JSON, nullable=True)  # for dropdown/multiselect
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    placeholder: Mapped[str | None] = mapped_column(String(200), nullable=True)
    default_value: Mapped[str | None] = mapped_column(String(500), nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )


class Dimension(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Accounting dimension — Class, Location, Department, or custom segment."""
    __tablename__ = "finance_dimensions"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    dimension_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # class, location, department, project, custom
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_dimensions.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)

    parent = relationship("Dimension", remote_side="Dimension.id", lazy="selectin")


class RevenueRecognitionSchedule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """IFRS 15 / ASC 606 deferred revenue recognition schedule."""
    __tablename__ = "finance_revenue_recognition"

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_invoices.id"), nullable=False
    )
    total_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    recognized_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    deferred_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    recognition_method: Mapped[str] = mapped_column(
        String(40), default="straight_line"
    )  # straight_line, milestone, percentage_complete
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="active"
    )  # active, completed, cancelled
    revenue_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_accounts.id"), nullable=True
    )
    deferred_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_accounts.id"), nullable=True
    )
    schedule_lines: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # [{period: "2026-01", amount: 500.00, recognized: false, je_id: null}, ...]
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    invoice = relationship("Invoice", lazy="selectin")


class WorkflowRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Configurable automation rule: trigger event + conditions + actions."""
    __tablename__ = "finance_workflow_rules"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    trigger_event: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # expense.submitted, invoice.overdue, bill.received, budget.exceeded
    conditions: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # [{field: "amount", operator: "gt", value: 1000}, ...]
    actions: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # [{type: "notify", params: {...}}, {type: "require_approval", ...}, ...]
    priority: Mapped[int] = mapped_column(Integer, default=10)
    last_triggered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    trigger_count: Mapped[int] = mapped_column(Integer, default=0)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )


class WorkflowExecution(UUIDPrimaryKeyMixin, Base):
    """Audit log of every workflow rule execution."""
    __tablename__ = "finance_workflow_executions"

    rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_workflow_rules.id"), nullable=False
    )
    trigger_event: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="success")  # success, failed, skipped
    actions_taken: Mapped[list | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    executed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    rule = relationship("WorkflowRule", lazy="selectin")


class DunningLog(UUIDPrimaryKeyMixin, Base):
    """AI smart dunning — tracks payment reminder stages per overdue invoice."""
    __tablename__ = "finance_dunning_logs"

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_invoices.id"), nullable=False
    )
    stage: Mapped[int] = mapped_column(Integer, default=1)  # 1=soft, 2=firm, 3=formal, 4=collections
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    channel: Mapped[str] = mapped_column(String(20), default="email")
    message_preview: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    opened: Mapped[bool] = mapped_column(Boolean, default=False)
    responded: Mapped[bool] = mapped_column(Boolean, default=False)
