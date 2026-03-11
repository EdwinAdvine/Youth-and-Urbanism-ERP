"""Loyalty program models — programs, tiers, members, transactions, rewards."""
from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class LoyaltyProgram(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A loyalty / rewards program definition."""

    __tablename__ = "loyalty_programs"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    points_per_unit_currency: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=1, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(default=True)

    tiers = relationship("LoyaltyTier", back_populates="program", cascade="all, delete-orphan")
    rewards = relationship("LoyaltyReward", back_populates="program", cascade="all, delete-orphan")
    members = relationship("LoyaltyMember", back_populates="program")


class LoyaltyTier(UUIDPrimaryKeyMixin, Base):
    """A tier within a loyalty program (e.g. Bronze, Silver, Gold)."""

    __tablename__ = "loyalty_tiers"

    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("loyalty_programs.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    min_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    discount_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    points_multiplier: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=1)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    program = relationship("LoyaltyProgram", back_populates="tiers")


class LoyaltyMember(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A customer enrolled in a loyalty program."""

    __tablename__ = "loyalty_members"

    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("loyalty_programs.id"), nullable=False
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_contacts.id"), nullable=False
    )
    points_balance: Mapped[int] = mapped_column(Integer, default=0)
    lifetime_points: Mapped[int] = mapped_column(Integer, default=0)
    tier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("loyalty_tiers.id"), nullable=True
    )
    referral_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)

    program = relationship("LoyaltyProgram", back_populates="members")
    customer = relationship("Contact", foreign_keys=[customer_id])
    tier = relationship("LoyaltyTier")
    transactions = relationship("LoyaltyTransaction", back_populates="member")


class LoyaltyTransaction(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A single points earn or redeem event."""

    __tablename__ = "loyalty_transactions"

    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("loyalty_members.id"), nullable=False
    )
    pos_transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_transactions.id"), nullable=True
    )
    points_change: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(200), nullable=False)
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)

    member = relationship("LoyaltyMember", back_populates="transactions")
    pos_transaction = relationship("POSTransaction")


class LoyaltyReward(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A reward that can be redeemed with loyalty points."""

    __tablename__ = "loyalty_rewards"

    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("loyalty_programs.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    points_cost: Mapped[int] = mapped_column(Integer, nullable=False)
    reward_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # discount, free_item, gift_card, store_credit
    reward_value: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)

    program = relationship("LoyaltyProgram", back_populates="rewards")
