"""Payroll extension models — TaxBracket, StatutoryDeduction, PayRun."""
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
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class TaxBracket(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Progressive tax bracket for payroll calculation."""
    __tablename__ = "hr_tax_brackets"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    country_code: Mapped[str] = mapped_column(String(3), nullable=False, default="KE")
    min_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    max_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)  # e.g. 0.1000 = 10%
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)


class StatutoryDeduction(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Statutory deduction configuration (NHIF, NSSF, etc.)."""
    __tablename__ = "hr_statutory_deductions"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    country_code: Mapped[str] = mapped_column(String(3), nullable=False, default="KE")
    calculation_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # percentage, fixed
    value: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    max_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class PayRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Batch payroll processing run."""
    __tablename__ = "hr_pay_runs"

    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, generated, reviewed, approved, processed
    total_gross: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    total_deductions: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    total_net: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
