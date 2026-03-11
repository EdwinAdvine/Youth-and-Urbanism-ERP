"""CalendarEvent model."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

# Allowed event types — enforced at the application layer, not as a DB enum
# so that new types can be added without a migration.
EVENT_TYPES = ("meeting", "task", "reminder", "holiday")


class CalendarEvent(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A calendar event.

    ``attendees`` is a JSON array of user-id strings so that it can hold
    arbitrary participant lists without requiring a separate join table.
    ``jitsi_room`` is populated only when the event was created from the
    meetings feature and has an associated Jitsi conference.
    """

    __tablename__ = "calendar_events"

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    end_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    all_day: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    event_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="meeting",
        comment="meeting | task | reminder | holiday",
    )

    color: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="CSS colour string e.g. #51459d",
    )

    location: Mapped[str | None] = mapped_column(String(500), nullable=True)

    organizer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # JSON array of user-id strings
    attendees: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)

    # Recurrence support (iCal RRULE format)
    recurrence_rule: Mapped[str | None] = mapped_column(
        String(500), nullable=True,
        comment="iCal RRULE string, e.g. FREQ=WEEKLY;BYDAY=MO,WE,FR",
    )
    recurrence_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    parent_event_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("calendar_events.id", ondelete="CASCADE"),
        nullable=True,
        comment="FK to parent event for recurring series instances",
    )

    # Jitsi room name (not the full URL) — populated for meeting-type events
    jitsi_room: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relationships
    organizer = relationship("User", foreign_keys=[organizer_id])

    def __repr__(self) -> str:
        return (
            f"<CalendarEvent id={self.id} title={self.title!r} "
            f"type={self.event_type} start={self.start_time}>"
        )


class CalendarSubscription(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """An external iCal calendar subscription that is periodically synced."""

    __tablename__ = "calendar_subscriptions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(500), nullable=False)

    ical_url: Mapped[str] = mapped_column(Text, nullable=False)

    sync_interval_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=60
    )

    last_synced: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<CalendarSubscription id={self.id} name={self.name!r} active={self.is_active}>"


class CalendarCategory(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A user-defined calendar category/label with a colour."""

    __tablename__ = "calendar_categories"

    name: Mapped[str] = mapped_column(String(200), nullable=False)

    color: Mapped[str] = mapped_column(
        String(20), nullable=False, default="#51459d"
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<CalendarCategory id={self.id} name={self.name!r} color={self.color}>"
