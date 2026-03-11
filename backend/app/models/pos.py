"""Point of Sale models — sessions, transactions, lines, payments."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
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


# ── POS Session ──────────────────────────────────────────────────────────────
class POSSession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A cashier shift / register session."""

    __tablename__ = "pos_sessions"

    session_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    cashier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False
    )
    opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    opening_balance: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    closing_balance: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    expected_balance: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    difference: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="open"
    )  # open, closed, reconciled
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    cashier = relationship("User", foreign_keys=[cashier_id])
    warehouse = relationship("Warehouse")
    transactions = relationship("POSTransaction", back_populates="session")


# ── POS Transaction ──────────────────────────────────────────────────────────
class POSTransaction(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A single sale / return at the POS terminal."""

    __tablename__ = "pos_transactions"

    transaction_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_sessions.id"), nullable=False
    )
    customer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    customer_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    discount_type: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # percentage, fixed
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="completed"
    )  # completed, refunded, voided
    receipt_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # Relationships
    session = relationship("POSSession", back_populates="transactions")
    lines = relationship(
        "POSTransactionLine", back_populates="transaction", cascade="all, delete-orphan"
    )
    payments = relationship(
        "POSPayment", back_populates="transaction", cascade="all, delete-orphan"
    )
    creator = relationship("User", foreign_keys=[created_by])


# ── POS Transaction Line ─────────────────────────────────────────────────────
class POSTransactionLine(UUIDPrimaryKeyMixin, Base):
    """Single line item in a POS transaction."""

    __tablename__ = "pos_transaction_lines"

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_transactions.id"), nullable=False
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)
    item_sku: Mapped[str] = mapped_column(String(50), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    transaction = relationship("POSTransaction", back_populates="lines")
    item = relationship("InventoryItem")


# ── POS Payment ──────────────────────────────────────────────────────────────
class POSPayment(UUIDPrimaryKeyMixin, Base):
    """Payment tendered for a POS transaction."""

    __tablename__ = "pos_payments"

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_transactions.id"), nullable=False
    )
    payment_method: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # cash, card, mobile_money, split
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    reference: Mapped[str | None] = mapped_column(String(200), nullable=True)
    change_given: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)

    transaction = relationship("POSTransaction", back_populates="payments")


# ── POS Terminal ────────────────────────────────────────────────────────────
class POSTerminal(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A physical or virtual POS terminal/register."""

    __tablename__ = "pos_terminals"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    location: Mapped[str | None] = mapped_column(String(300), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    settings: Mapped[dict | None] = mapped_column(JSON, nullable=True)


# ── POS Discount ────────────────────────────────────────────────────────────
class POSDiscount(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Reusable discount definitions for POS transactions."""

    __tablename__ = "pos_discounts"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    discount_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # percentage, fixed
    value: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    valid_from: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    valid_to: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    conditions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)


# ── POS Receipt ─────────────────────────────────────────────────────────────
class POSReceipt(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Formal receipt generated for a POS transaction."""

    __tablename__ = "pos_receipts"

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_transactions.id"), nullable=False
    )
    receipt_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    printed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    transaction = relationship("POSTransaction")


# ── POS Cash Movement ───────────────────────────────────────────────────────
class POSCashMovement(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Cash-in / cash-out within a POS session (e.g. float top-up, cash drop)."""

    __tablename__ = "pos_cash_movements"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_sessions.id"), nullable=False
    )
    movement_type: Mapped[str] = mapped_column(
        String(10), nullable=False
    )  # in, out
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    session = relationship("POSSession")
    creator = relationship("User", foreign_keys=[created_by])
