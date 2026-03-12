"""E-Commerce Loyalty & Rewards models."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class EcomLoyaltyProgram(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Per-store loyalty program configuration."""
    __tablename__ = "ecom_loyalty_programs"

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_stores.id", ondelete="CASCADE"),
        nullable=False, unique=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, default="Loyalty Rewards")
    points_per_unit_spent: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    currency_per_point: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False, default=Decimal("0.01"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    referral_bonus_points: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    referral_referee_points: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    points_expiry_days: Mapped[int | None] = mapped_column(Integer, nullable=True)

    store = relationship("Store", lazy="joined")

    def __repr__(self) -> str:
        return f"<EcomLoyaltyProgram store={self.store_id} active={self.is_active}>"


class EcomLoyaltyTier(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Loyalty tier level configuration."""
    __tablename__ = "ecom_loyalty_tiers"

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_stores.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    min_lifetime_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    free_shipping: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    badge_color: Mapped[str] = mapped_column(String(20), nullable=False, default="#51459d")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    def __repr__(self) -> str:
        return f"<EcomLoyaltyTier id={self.id} name={self.name!r}>"


class CustomerLoyaltyAccount(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Customer loyalty points balance and tier."""
    __tablename__ = "ecom_loyalty_accounts"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_customers.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    points_balance: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lifetime_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_loyalty_tiers.id", ondelete="SET NULL"), nullable=True
    )

    customer = relationship("CustomerAccount", lazy="joined")
    tier = relationship("EcomLoyaltyTier", lazy="joined")
    transactions = relationship("EcomLoyaltyTransaction", back_populates="account", lazy="selectin")

    def __repr__(self) -> str:
        return f"<CustomerLoyaltyAccount customer={self.customer_id} points={self.points_balance}>"


class EcomLoyaltyTransaction(Base, UUIDPrimaryKeyMixin):
    """Audit log for loyalty point changes."""
    __tablename__ = "ecom_loyalty_transactions"

    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_loyalty_accounts.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False)  # earned/spent/expired/referral/adjustment
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    reference_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    account = relationship("CustomerLoyaltyAccount", back_populates="transactions", lazy="joined")

    def __repr__(self) -> str:
        return f"<EcomLoyaltyTransaction type={self.transaction_type} points={self.points}>"


class ReferralCode(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Customer referral code."""
    __tablename__ = "ecom_referral_codes"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_customers.id", ondelete="CASCADE"),
        nullable=False, unique=True,
    )
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    used_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_points_earned: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    customer = relationship("CustomerAccount", lazy="joined")
    uses = relationship("ReferralUse", back_populates="referral_code", lazy="selectin")

    def __repr__(self) -> str:
        return f"<ReferralCode code={self.code!r} used={self.used_count}>"


class ReferralUse(Base, UUIDPrimaryKeyMixin):
    """Record of a referral code use."""
    __tablename__ = "ecom_referral_uses"

    referral_code_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_referral_codes.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    new_customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_customers.id", ondelete="CASCADE"), nullable=False
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_orders.id", ondelete="SET NULL"), nullable=True
    )
    rewarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    referral_code = relationship("ReferralCode", back_populates="uses", lazy="joined")

    def __repr__(self) -> str:
        return f"<ReferralUse referral_code={self.referral_code_id}>"
