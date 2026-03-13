"""Immutable history tables for critical financial records.

These tables capture every modification to journal entries and invoices,
providing a complete audit trail that works even with direct SQL access
(populated by PostgreSQL triggers).
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Index, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class JournalEntryHistory(Base):
    """Immutable snapshot of a journal entry at each modification."""

    __tablename__ = "finance_journal_entries_history"
    __table_args__ = (
        Index("ix_jeh_journal_entry_id", "journal_entry_id"),
        Index("ix_jeh_changed_at", "changed_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    journal_entry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    entry_number: Mapped[str] = mapped_column(String(50), nullable=False)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    lines_snapshot: Mapped[list] = mapped_column(JSONB, nullable=False)
    posted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True,
    )
    changed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True,
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    change_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class InvoiceHistory(Base):
    """Immutable snapshot of an invoice at each modification."""

    __tablename__ = "finance_invoices_history"
    __table_args__ = (
        Index("ix_ih_invoice_id", "invoice_id"),
        Index("ix_ih_changed_at", "changed_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    invoice_number: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    items_snapshot: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    full_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    changed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True,
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    change_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
