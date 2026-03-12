"""E-Commerce B2B models — companies, pricing tiers, quotes."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class EcomCompany(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """B2B company account for wholesale customers."""
    __tablename__ = "ecom_b2b_companies"

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    tax_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    credit_limit: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    payment_terms: Mapped[str] = mapped_column(String(20), nullable=False, default="COD")  # NET30/NET60/COD
    is_approved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)

    members = relationship("EcomCompanyMember", back_populates="company", cascade="all, delete-orphan", lazy="selectin")
    quotes = relationship("QuoteRequest", back_populates="company", lazy="selectin")

    def __repr__(self) -> str:
        return f"<EcomCompany id={self.id} name={self.name!r}>"


class EcomCompanyMember(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Links a CustomerAccount to a B2B company."""
    __tablename__ = "ecom_b2b_company_members"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_b2b_companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_customers.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="buyer")  # owner/buyer/viewer

    company = relationship("EcomCompany", back_populates="members", lazy="joined")
    customer = relationship("CustomerAccount", lazy="joined")

    def __repr__(self) -> str:
        return f"<EcomCompanyMember company={self.company_id} customer={self.customer_id}>"


class PricingTier(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Tiered pricing rule for B2B customers."""
    __tablename__ = "ecom_b2b_pricing_tiers"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    min_order_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    fixed_price_override: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_products.id", ondelete="CASCADE"), nullable=True
    )
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_b2b_companies.id", ondelete="CASCADE"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    product = relationship("EcomProduct", lazy="joined")

    def __repr__(self) -> str:
        return f"<PricingTier id={self.id} name={self.name!r}>"


class QuoteRequest(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """B2B quote request from a company."""
    __tablename__ = "ecom_b2b_quotes"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_b2b_companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    requested_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_customers.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft", index=True,
    )  # draft/submitted/reviewed/approved/rejected/converted
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    converted_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_orders.id", ondelete="SET NULL"), nullable=True
    )
    po_number: Mapped[str | None] = mapped_column(String(100), nullable=True)

    company = relationship("EcomCompany", back_populates="quotes", lazy="joined")
    requester = relationship("CustomerAccount", lazy="joined")
    items = relationship("QuoteItem", back_populates="quote", cascade="all, delete-orphan", lazy="selectin")

    def __repr__(self) -> str:
        return f"<QuoteRequest id={self.id} status={self.status}>"


class QuoteItem(Base, UUIDPrimaryKeyMixin):
    """Line item on a B2B quote."""
    __tablename__ = "ecom_b2b_quote_items"

    quote_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_b2b_quotes.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_products.id", ondelete="CASCADE"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    requested_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    approved_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    quote = relationship("QuoteRequest", back_populates="items")
    product = relationship("EcomProduct", lazy="joined")

    def __repr__(self) -> str:
        return f"<QuoteItem id={self.id} product_id={self.product_id}>"
