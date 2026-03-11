"""Finance extension models — Currency, ExchangeRate, BankStatement, Reconciliation."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Currency(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Currency definition."""
    __tablename__ = "finance_currencies"

    code: Mapped[str] = mapped_column(String(3), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    symbol: Mapped[str] = mapped_column(String(10), nullable=False)
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(18, 8), default=Decimal("1.0"))
    is_base: Mapped[bool] = mapped_column(Boolean, default=False)
    last_updated: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ExchangeRate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Exchange rate between two currencies."""
    __tablename__ = "finance_exchange_rates"

    from_currency_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_currencies.id"), nullable=False
    )
    to_currency_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_currencies.id"), nullable=False
    )
    rate: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)

    from_currency = relationship("Currency", foreign_keys=[from_currency_id], lazy="selectin")
    to_currency = relationship("Currency", foreign_keys=[to_currency_id], lazy="selectin")


class BankStatement(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Imported bank statement header."""
    __tablename__ = "finance_bank_statements"

    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_accounts.id"), nullable=False
    )
    statement_date: Mapped[date] = mapped_column(Date, nullable=False)
    opening_balance: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    closing_balance: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    account = relationship("Account", lazy="selectin")
    lines = relationship("BankStatementLine", back_populates="statement", cascade="all, delete-orphan", lazy="selectin")
    reconciliation = relationship("Reconciliation", back_populates="statement", uselist=False)


class BankStatementLine(UUIDPrimaryKeyMixin, Base):
    """Individual line in a bank statement."""
    __tablename__ = "finance_bank_statement_lines"

    statement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_bank_statements.id"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    matched_payment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_payments.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default="unmatched"
    )  # unmatched, matched, excluded

    statement = relationship("BankStatement", back_populates="lines")
    matched_payment = relationship("Payment", lazy="selectin")


class Reconciliation(UUIDPrimaryKeyMixin, Base):
    """Bank statement reconciliation record."""
    __tablename__ = "finance_reconciliations"

    statement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_bank_statements.id"), unique=True, nullable=False
    )
    reconciled_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    reconciled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    statement = relationship("BankStatement", back_populates="reconciliation")


class BankReconciliation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Full bank reconciliation with matched transaction items."""
    __tablename__ = "finance_bank_reconciliations"

    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finance_accounts.id"), nullable=False
    )
    statement_date: Mapped[date] = mapped_column(Date, nullable=False)
    statement_balance: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    reconciled_balance: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, in_progress, completed
    reconciled_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    reconciled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    items: Mapped[list | None] = mapped_column(JSON, nullable=True)  # list of matched transactions

    account = relationship("Account", lazy="selectin")
