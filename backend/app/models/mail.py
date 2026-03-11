"""Mail models: inbox rules, signatures, and read receipts."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class MailRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Inbox rule: auto-move, auto-label, auto-forward, auto-delete based on conditions."""

    __tablename__ = "mail_rules"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Conditions (JSON): {"field": "from"|"subject"|"to"|"body", "operator": "contains"|"equals"|"starts_with", "value": "..."}
    conditions: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)

    # Actions (JSON): [{"type": "move"|"label"|"forward"|"delete"|"mark_read", "value": "..."}]
    actions: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    # Match mode: "all" (AND) or "any" (OR)
    match_mode: Mapped[str] = mapped_column(String(10), default="all", nullable=False)

    stop_processing: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    owner = relationship("User", foreign_keys=[owner_id])


class MailSignature(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Email signature that can be attached to outgoing messages."""

    __tablename__ = "mail_signatures"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content_html: Mapped[str] = mapped_column(Text, nullable=False, default="")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    owner = relationship("User", foreign_keys=[owner_id])


class ReadReceipt(UUIDPrimaryKeyMixin, Base):
    """Tracks read receipts for sent messages."""

    __tablename__ = "read_receipts"

    message_id: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    recipient_email: Mapped[str] = mapped_column(String(320), nullable=False)
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False,
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

    sender = relationship("User", foreign_keys=[sender_id])
