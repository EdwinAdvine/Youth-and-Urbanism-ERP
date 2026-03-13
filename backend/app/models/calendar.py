"""CalendarEvent model and calendar upgrade models."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, Float
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

# Allowed event types — enforced at the application layer, not as a DB enum
# so that new types can be added without a migration.
EVENT_TYPES = ("meeting", "task", "reminder", "holiday", "focus", "booking", "deadline")

# Sensitivity levels for events
SENSITIVITY_LEVELS = ("normal", "private", "confidential")

# Priority levels
PRIORITY_LEVELS = ("low", "normal", "high", "urgent")


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
        comment="meeting | task | reminder | holiday | focus | booking | deadline",
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

    # ── New fields (Calendar Mega-Upgrade) ──────────────────────────────────

    # Sensitivity & priority
    sensitivity: Mapped[str] = mapped_column(
        String(20), nullable=False, default="normal",
        comment="normal | private | confidential",
    )
    priority: Mapped[str] = mapped_column(
        String(20), nullable=False, default="normal",
        comment="low | normal | high | urgent",
    )

    # Buffer time (minutes before/after event)
    buffer_before: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="Buffer minutes before event",
    )
    buffer_after: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="Buffer minutes after event",
    )

    # Timezone display (IANA timezone string, e.g. Africa/Nairobi)
    timezone: Mapped[str | None] = mapped_column(
        String(100), nullable=True,
        comment="IANA timezone string for display, e.g. Africa/Nairobi",
    )

    # Reminders — JSON array of {minutes_before, channel} objects
    # e.g. [{"minutes_before": 15, "channel": "push"}, {"minutes_before": 60, "channel": "email"}]
    reminders: Mapped[list | None] = mapped_column(
        JSON, nullable=True, default=list,
        comment="Array of reminder configs [{minutes_before, channel}]",
    )

    # ERP cross-module context — JSON for flexible linking
    # e.g. {"invoice_id": "...", "ticket_id": "...", "deal_id": "...", "task_id": "..."}
    erp_context: Mapped[dict | None] = mapped_column(
        JSON, nullable=True,
        comment="ERP cross-module links {invoice_id, ticket_id, deal_id, project_id, ...}",
    )

    # Category FK (optional, for user-defined categories)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("calendar_categories.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Calendar this event belongs to (for multi-calendar support)
    calendar_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user_calendars.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Status for RSVP tracking
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="confirmed",
        comment="confirmed | tentative | cancelled",
    )

    # Relationships
    organizer = relationship("User", foreign_keys=[organizer_id])
    category = relationship("CalendarCategory", foreign_keys=[category_id])
    calendar = relationship("UserCalendar", foreign_keys=[calendar_id])
    attachments = relationship("EventAttachment", back_populates="event", cascade="all, delete-orphan")

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


class UserCalendar(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A named calendar that a user owns (e.g. Personal, Work, Team HR).

    Events belong to a calendar. Users can have multiple calendars.
    Permissions are granted per-calendar via CalendarPermission.
    """

    __tablename__ = "user_calendars"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="#51459d")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # "personal" | "team" | "department" | "resource" | "shared"
    calendar_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default="personal",
    )

    # For team/department calendars — optional link
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hr_departments.id", ondelete="SET NULL"),
        nullable=True,
    )

    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    owner = relationship("User", foreign_keys=[owner_id])
    permissions = relationship("CalendarPermission", back_populates="calendar", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<UserCalendar id={self.id} name={self.name!r} type={self.calendar_type}>"


class CalendarPermission(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Per-calendar access grants.

    permission_level: free_busy | read | propose | edit | manage
    """

    __tablename__ = "calendar_permissions"

    calendar_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user_calendars.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    grantee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    permission_level: Mapped[str] = mapped_column(
        String(20), nullable=False, default="read",
        comment="free_busy | read | propose | edit | manage",
    )

    # Who granted this permission (for audit trail)
    granted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="User who granted this permission",
    )

    calendar = relationship("UserCalendar", back_populates="permissions")
    grantee = relationship("User", foreign_keys=[grantee_id])
    granter = relationship("User", foreign_keys=[granted_by])

    def __repr__(self) -> str:
        return f"<CalendarPermission calendar={self.calendar_id} grantee={self.grantee_id} level={self.permission_level}>"


class EventAttachment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """File attachment on a calendar event, linked to Era Drive/MinIO."""

    __tablename__ = "event_attachments"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("calendar_events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # MinIO/Drive file reference
    drive_file_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True,
        comment="FK to drive_files if stored in Era Drive",
    )
    minio_key: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="Direct MinIO object key if not in Drive",
    )

    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    event = relationship("CalendarEvent", back_populates="attachments")
    uploader = relationship("User", foreign_keys=[uploaded_by])

    def __repr__(self) -> str:
        return f"<EventAttachment id={self.id} event={self.event_id} file={self.file_name!r}>"


class FocusTimeBlock(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """User-defined focus time preferences.

    The AI scheduler respects these blocks and auto-declines meeting
    invites that fall within focus hours.
    """

    __tablename__ = "focus_time_blocks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False, default="Focus Time")

    # Day-of-week bitmask (0=Sun, 1=Mon, ... 6=Sat) — JSON array of ints
    days_of_week: Mapped[list] = mapped_column(
        JSON, nullable=False, default=lambda: [1, 2, 3, 4, 5],
        comment="Array of day numbers [1,2,3,4,5] = Mon-Fri",
    )

    start_hour: Mapped[int] = mapped_column(Integer, nullable=False, default=9)
    start_minute: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    end_hour: Mapped[int] = mapped_column(Integer, nullable=False, default=12)
    end_minute: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Whether to auto-decline conflicting meetings
    auto_decline: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<FocusTimeBlock id={self.id} user={self.user_id} {self.start_hour}:{self.start_minute:02d}-{self.end_hour}:{self.end_minute:02d}>"


class CalendarRule(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Automation rule for calendar events.

    Rules can auto-accept/reject invites, auto-schedule follow-ups,
    or trigger cross-module actions.
    """

    __tablename__ = "calendar_rules"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(300), nullable=False)

    # "auto_accept" | "auto_reject" | "auto_tentative" | "auto_schedule" | "notify" | "erp_action"
    rule_type: Mapped[str] = mapped_column(String(30), nullable=False)

    # JSON conditions: {"from_vip": true, "max_daily_meetings": 5, "during_focus": false, ...}
    conditions: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # JSON actions: {"action": "decline", "message": "I'm in focus time", ...}
    actions: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<CalendarRule id={self.id} name={self.name!r} type={self.rule_type}>"


class CalendarAuditLog(Base, UUIDPrimaryKeyMixin):
    """Immutable audit trail for calendar changes."""

    __tablename__ = "calendar_audit_logs"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True,
        comment="The calendar event that was changed",
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # "created" | "updated" | "deleted" | "rsvp" | "shared" | "attachment_added"
    action: Mapped[str] = mapped_column(String(30), nullable=False)

    # JSON diff of changes: {"field": "title", "old": "...", "new": "..."}
    changes: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()",
    )

    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)

    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<CalendarAuditLog event={self.event_id} action={self.action} at={self.timestamp}>"
