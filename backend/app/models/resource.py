"""Resource booking models — rooms, equipment, vehicles."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Resource(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A bookable resource — meeting room, projector, vehicle, etc."""

    __tablename__ = "resources"

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # "room" | "equipment" | "vehicle" | "desk" | "other"
    resource_type: Mapped[str] = mapped_column(String(30), nullable=False, default="room")

    location: Mapped[str | None] = mapped_column(String(500), nullable=True)
    capacity: Mapped[int | None] = mapped_column(
        Integer, nullable=True,
        comment="Max capacity for rooms, null for equipment",
    )

    # Features — JSON array: ["projector", "whiteboard", "video_conf", "ac"]
    features: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Availability — JSON weekly schedule (same format as BookingPage)
    availability: Mapped[list | None] = mapped_column(
        JSON, nullable=True,
        comment="Weekly availability slots [{day, start, end}]",
    )

    color: Mapped[str] = mapped_column(String(20), nullable=False, default="#3ec9d6")
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Admin who manages this resource
    managed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    manager = relationship("User", foreign_keys=[managed_by])
    bookings = relationship("ResourceBooking", back_populates="resource", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Resource id={self.id} name={self.name!r} type={self.resource_type}>"


class ResourceBooking(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A booking of a resource for a specific time slot."""

    __tablename__ = "resource_bookings"

    resource_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    event_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("calendar_events.id", ondelete="SET NULL"),
        nullable=True,
        comment="Linked calendar event, if any",
    )

    booked_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # "confirmed" | "pending_approval" | "cancelled"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="confirmed")

    # Recurrence (for recurring room bookings)
    recurrence_rule: Mapped[str | None] = mapped_column(String(500), nullable=True)

    resource = relationship("Resource", back_populates="bookings")
    booker = relationship("User", foreign_keys=[booked_by])
    event = relationship("CalendarEvent", foreign_keys=[event_id])

    def __repr__(self) -> str:
        return f"<ResourceBooking id={self.id} resource={self.resource_id} status={self.status}>"
