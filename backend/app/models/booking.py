"""Booking pages & scheduling links — Calendly-style public booking."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class BookingPage(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A public booking page for a user — like Calendly scheduling links.

    Each user can have multiple booking pages (e.g. "30-min intro call",
    "1-hour consultation"). The page is publicly accessible via a slug URL.
    """

    __tablename__ = "booking_pages"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # URL slug: /book/{slug} — unique across system
    slug: Mapped[str] = mapped_column(
        String(200), nullable=False, unique=True, index=True,
    )

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Duration in minutes
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)

    # Buffer before/after bookings (minutes)
    buffer_before: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    buffer_after: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Minimum scheduling notice (hours) — e.g. can't book less than 4 hours from now
    min_notice_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=4)

    # How far ahead can people book (days)
    max_advance_days: Mapped[int] = mapped_column(Integer, nullable=False, default=60)

    # Availability window — JSON array of weekly slots
    # e.g. [{"day": 1, "start": "09:00", "end": "17:00"}, ...]
    availability: Mapped[list] = mapped_column(
        JSON, nullable=False,
        default=lambda: [
            {"day": 1, "start": "09:00", "end": "17:00"},
            {"day": 2, "start": "09:00", "end": "17:00"},
            {"day": 3, "start": "09:00", "end": "17:00"},
            {"day": 4, "start": "09:00", "end": "17:00"},
            {"day": 5, "start": "09:00", "end": "17:00"},
        ],
    )

    # Custom branding
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="#51459d")
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    welcome_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Custom questions — JSON array of form fields
    # e.g. [{"label": "Company name", "type": "text", "required": true}]
    custom_questions: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Auto-create Jitsi room for video meetings
    auto_create_jitsi: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Event type to create when booked
    event_type: Mapped[str] = mapped_column(String(20), nullable=False, default="meeting")

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    owner = relationship("User", foreign_keys=[owner_id])
    slots = relationship("BookingSlot", back_populates="booking_page", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<BookingPage id={self.id} slug={self.slug!r} owner={self.owner_id}>"


class BookingSlot(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A confirmed booking made through a BookingPage."""

    __tablename__ = "booking_slots"

    booking_page_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("booking_pages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # The resulting calendar event
    event_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("calendar_events.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Booker info (may not be a registered user)
    booker_name: Mapped[str] = mapped_column(String(300), nullable=False)
    booker_email: Mapped[str] = mapped_column(String(300), nullable=False)

    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # "confirmed" | "cancelled" | "completed" | "no_show"
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="confirmed",
    )

    # Answers to custom questions — JSON
    answers: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Cancellation
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    booking_page = relationship("BookingPage", back_populates="slots")
    event = relationship("CalendarEvent", foreign_keys=[event_id])

    def __repr__(self) -> str:
        return f"<BookingSlot id={self.id} booker={self.booker_email} status={self.status}>"
