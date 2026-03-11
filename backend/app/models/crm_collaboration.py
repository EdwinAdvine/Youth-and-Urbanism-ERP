"""CRM Collaboration models — comments and record followers."""
from __future__ import annotations

import uuid

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class CRMComment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Threaded comment on any CRM entity."""

    __tablename__ = "crm_comments"
    __table_args__ = (
        Index("ix_crm_comments_entity", "entity_type", "entity_id"),
    )

    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    mentions: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # [user_uuid, ...]
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    is_edited: Mapped[bool] = mapped_column(Boolean, default=False)

    author = relationship("User", foreign_keys=[author_id])


class RecordFollower(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """User following a CRM record for notifications."""

    __tablename__ = "crm_record_followers"
    __table_args__ = (
        Index("ix_crm_record_followers_entity", "entity_type", "entity_id"),
    )

    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    user = relationship("User", foreign_keys=[user_id])
