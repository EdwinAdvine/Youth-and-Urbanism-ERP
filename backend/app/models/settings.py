"""System settings and user preferences models."""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class SystemSettings(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Global key-value settings managed by Super Admins."""

    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, default="general", server_default="general"
    )

    def __repr__(self) -> str:
        return f"<SystemSettings key={self.key}>"


class UserPreferences(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Per-user display and notification preferences."""

    __tablename__ = "user_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    theme: Mapped[str] = mapped_column(
        String(20), nullable=False, default="light", server_default="light"
    )
    language: Mapped[str] = mapped_column(
        String(10), nullable=False, default="en", server_default="en"
    )
    timezone: Mapped[str] = mapped_column(
        String(50), nullable=False, default="UTC", server_default="UTC"
    )
    notifications_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    email_notifications: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    def __repr__(self) -> str:
        return f"<UserPreferences user_id={self.user_id}>"
