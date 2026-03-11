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
