"""Activity feed model for cross-module activity tracking."""
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ActivityFeedEntry(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A single entry in the cross-module activity feed."""

    __tablename__ = "activity_feed"

    activity_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # created, updated, deleted, shared, approved, etc.
    message: Mapped[str] = mapped_column(Text, nullable=False)
    module: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # finance, hr, crm, projects, drive, calendar, mail, etc.
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
