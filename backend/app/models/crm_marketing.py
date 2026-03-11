"""CRM Phase 2 — Marketing automation models."""
from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class EmailCampaignConfig(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A/B test configuration and send stats for an email campaign."""

    __tablename__ = "crm_email_campaign_configs"

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_campaigns.id"), nullable=False
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_email_templates.id"), nullable=True
    )
    subject_line_a: Mapped[str] = mapped_column(String(500), nullable=False)
    subject_line_b: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ab_test_ratio: Mapped[int] = mapped_column(Integer, default=50)
    ab_winner_metric: Mapped[str] = mapped_column(
        String(20), default="open_rate"
    )  # open_rate, click_rate
    ab_winner_auto_send: Mapped[bool] = mapped_column(Boolean, default=False)
    winner_determined_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    send_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sent_count: Mapped[int] = mapped_column(Integer, default=0)
    open_count: Mapped[int] = mapped_column(Integer, default=0)
    click_count: Mapped[int] = mapped_column(Integer, default=0)
    unsubscribe_count: Mapped[int] = mapped_column(Integer, default=0)
    bounce_count: Mapped[int] = mapped_column(Integer, default=0)

    campaign = relationship("Campaign", foreign_keys=[campaign_id])
    template = relationship("EmailTemplate", foreign_keys=[template_id])


class Segment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Contact segment — static or dynamic rule-based grouping."""

    __tablename__ = "crm_segments"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    segment_type: Mapped[str] = mapped_column(
        String(30), default="static"
    )  # static, dynamic
    rules: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    contact_count: Mapped[int] = mapped_column(Integer, default=0)
    ai_suggested: Mapped[bool] = mapped_column(Boolean, default=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    contacts = relationship(
        "SegmentContact", back_populates="segment", cascade="all, delete-orphan"
    )


class SegmentContact(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Many-to-many link between segments and contacts."""

    __tablename__ = "crm_segment_contacts"

    segment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_segments.id"), nullable=False
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_contacts.id"), nullable=False
    )
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    segment = relationship("Segment", back_populates="contacts")
    contact = relationship("Contact")


class ContentCalendarItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Content calendar entry tied to a campaign."""

    __tablename__ = "crm_content_calendar"

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    content_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # blog, social, email, video, webinar
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="idea"
    )  # idea, draft, scheduled, published
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_campaigns.id"), nullable=True
    )
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    campaign = relationship("Campaign", foreign_keys=[campaign_id])


class Unsubscribe(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Record of a contact unsubscribing from email communications."""

    __tablename__ = "crm_unsubscribes"

    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_contacts.id"), nullable=False
    )
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_campaigns.id"), nullable=True
    )
    reason: Mapped[str | None] = mapped_column(String(200), nullable=True)
    unsubscribed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    contact = relationship("Contact", foreign_keys=[contact_id])
    campaign = relationship("Campaign", foreign_keys=[campaign_id])
