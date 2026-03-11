"""Meeting extension models: MeetingRecording, MeetingChat, MeetingTemplate, MeetingNote, MeetingLink."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class MeetingRecording(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A recording associated with a meeting (CalendarEvent with type=meeting)."""

    __tablename__ = "meeting_recordings"

    meeting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("calendar_events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    file_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    meeting = relationship("CalendarEvent", foreign_keys=[meeting_id])

    def __repr__(self) -> str:
        return (
            f"<MeetingRecording id={self.id} meeting={self.meeting_id} "
            f"size={self.size_bytes}>"
        )


class MeetingChat(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Chat messages exported from a meeting session."""

    __tablename__ = "meeting_chats"

    meeting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("calendar_events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # JSON array of chat messages [{user_id, user_name, message, timestamp}, ...]
    messages: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)

    exported_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    meeting = relationship("CalendarEvent", foreign_keys=[meeting_id])

    def __repr__(self) -> str:
        return f"<MeetingChat id={self.id} meeting={self.meeting_id}>"


class MeetingTemplate(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A reusable meeting template with default settings."""

    __tablename__ = "meeting_templates"

    name: Mapped[str] = mapped_column(String(500), nullable=False)

    default_duration_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=30
    )

    # JSON with default settings (e.g. {mute_on_start, lobby_enabled, etc.})
    default_settings: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # iCal RRULE for recurring pattern
    recurring_pattern: Mapped[str | None] = mapped_column(
        String(500), nullable=True,
        comment="iCal RRULE string for recurring meetings",
    )

    def __repr__(self) -> str:
        return f"<MeetingTemplate id={self.id} name={self.name!r}>"


class MeetingNote(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Notes taken during or after a meeting."""

    __tablename__ = "meeting_notes"

    meeting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("calendar_events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    content: Mapped[str] = mapped_column(Text, nullable=False)

    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Relationships
    meeting = relationship("CalendarEvent", foreign_keys=[meeting_id])
    author = relationship("User", foreign_keys=[author_id])

    def __repr__(self) -> str:
        return (
            f"<MeetingNote id={self.id} meeting={self.meeting_id} "
            f"author={self.author_id}>"
        )


class MeetingLink(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Soft cross-module link from a meeting to another entity.

    Supports linking meetings to project tasks, CRM contacts, CRM deals,
    Notes, and any future module entity via a (link_type, entity_id) pair.
    """

    __tablename__ = "meeting_links"

    meeting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("calendar_events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # e.g. "task", "contact", "deal", "note"
    link_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="task | contact | deal | note",
    )

    entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        comment="ID of the linked entity in its own table",
    )

    # Denormalised title for quick display without joins
    entity_title: Mapped[str | None] = mapped_column(
        String(500), nullable=True,
    )

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Relationships
    meeting = relationship("CalendarEvent", foreign_keys=[meeting_id])
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return (
            f"<MeetingLink id={self.id} meeting={self.meeting_id} "
            f"type={self.link_type} entity={self.entity_id}>"
        )
