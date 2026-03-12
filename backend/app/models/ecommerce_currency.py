"""E-Commerce Currency models."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class EcomCurrency(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Supported currency for multi-currency e-commerce."""
    __tablename__ = "ecom_currencies"

    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False, index=True)  # ISO 4217
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    symbol: Mapped[str] = mapped_column(String(10), nullable=False)
    exchange_rate_to_base: Mapped[Decimal] = mapped_column(Numeric(14, 6), nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_updated: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<EcomCurrency code={self.code!r} rate={self.exchange_rate_to_base}>"
