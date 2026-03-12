"""E-Commerce Subscription models."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Subscription(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Recurring product subscription."""
    __tablename__ = "ecom_subscriptions"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_customers.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_products.id", ondelete="CASCADE"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    frequency_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", index=True)  # active/paused/cancelled
    next_billing_date: Mapped[date] = mapped_column(Date, nullable=False)
    shipping_address_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_shipping_addresses.id", ondelete="SET NULL"), nullable=True
    )
    payment_gateway_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_payment_gateways.id", ondelete="SET NULL"), nullable=True
    )
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    customer = relationship("CustomerAccount", lazy="joined")
    product = relationship("EcomProduct", lazy="joined")
    orders = relationship("SubscriptionOrder", back_populates="subscription", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Subscription id={self.id} status={self.status}>"


class SubscriptionOrder(Base, UUIDPrimaryKeyMixin):
    """Link between a subscription cycle and its generated order."""
    __tablename__ = "ecom_subscription_orders"

    subscription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_subscriptions.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_orders.id", ondelete="CASCADE"), nullable=False
    )
    billing_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    subscription = relationship("Subscription", back_populates="orders", lazy="joined")
    order = relationship("EcomOrder", lazy="joined")

    def __repr__(self) -> str:
        return f"<SubscriptionOrder subscription={self.subscription_id}>"
