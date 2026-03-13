"""CalendarWebhook and CalendarApiKey models for webhook subscriptions and OAuth2/API key access."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class CalendarWebhook(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A webhook subscription for calendar events.

    When matching calendar events are fired (e.g. event.created), the platform
    signs the payload with HMAC-SHA256 using ``secret`` and POSTs it to ``url``.
    """

    __tablename__ = "calendar_webhooks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)

    # The external HTTPS endpoint that receives the webhook payload
    url: Mapped[str] = mapped_column(String(1000), nullable=False)

    # HMAC-SHA256 signing secret — auto-generated on creation if not supplied
    secret: Mapped[str] = mapped_column(String(200), nullable=False)

    # JSON array of event type strings, e.g. ["event.created", "booking.created"]
    events: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        comment='Array of subscribed event types e.g. ["event.created", "event.updated"]',
    )

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    last_triggered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # HTTP status code returned by the last delivery attempt
    last_status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Incremented on each failed delivery; webhook auto-deactivated after 10 failures
    failure_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="calendar_webhooks")

    def __repr__(self) -> str:
        return (
            f"<CalendarWebhook id={self.id} name={self.name!r} "
            f"active={self.is_active} failures={self.failure_count}>"
        )


class CalendarApiKey(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """An API key granting programmatic access to the calendar module.

    The raw key is shown exactly once on creation; only its SHA-256 hash is
    stored in the database.  ``key_prefix`` (first 8 chars) is stored for
    display purposes so users can identify which key is which.
    """

    __tablename__ = "calendar_api_keys"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)

    # SHA-256 hash of the raw key — never stored in plain text
    key_hash: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)

    # First 8 characters of the raw key for UI display, e.g. "era_k1a2"
    key_prefix: Mapped[str] = mapped_column(String(20), nullable=False)

    # JSON array of scope strings, e.g. ["calendar:read", "bookings:write"]
    scopes: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        comment='Allowed scopes: ["calendar:read","calendar:write","bookings:read","bookings:write"]',
    )

    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="calendar_api_keys")

    def __repr__(self) -> str:
        return (
            f"<CalendarApiKey id={self.id} name={self.name!r} "
            f"prefix={self.key_prefix!r} active={self.is_active}>"
        )
