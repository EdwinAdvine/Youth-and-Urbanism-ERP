"""CRM models — contacts, leads, opportunities, deals."""
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
)
from sqlalchemy.dialects.postgresql import ARRAY, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Contact(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """CRM contact (person or company)."""

    __tablename__ = "crm_contacts"

    contact_type: Mapped[str] = mapped_column(
        String(20), default="person"
    )  # person, company
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)  # website, referral, cold_call
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    leads = relationship("Lead", back_populates="contact")


class Lead(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Sales lead — initial interest from a contact."""

    __tablename__ = "crm_leads"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_contacts.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(30), default="new"
    )  # new, contacted, qualified, unqualified, converted
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    estimated_value: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    contact = relationship("Contact", back_populates="leads")
    opportunities = relationship("Opportunity", back_populates="lead")


class Opportunity(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Sales opportunity — qualified lead progressing through a pipeline."""

    __tablename__ = "crm_opportunities"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_leads.id"), nullable=True
    )
    stage: Mapped[str] = mapped_column(
        String(50), default="prospecting"
    )  # prospecting, proposal, negotiation, closed_won, closed_lost
    probability: Mapped[int | None] = mapped_column(nullable=True)  # 0-100%
    expected_value: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    expected_close_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    lead = relationship("Lead", back_populates="opportunities")
    deals = relationship("Deal", back_populates="opportunity")


class Deal(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Closed deal — won opportunity."""

    __tablename__ = "crm_deals"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    opportunity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_opportunities.id"), nullable=True
    )
    deal_value: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    close_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="active"
    )  # active, completed, cancelled
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    opportunity = relationship("Opportunity", back_populates="deals")
