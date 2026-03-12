"""MailboxMessage model — PostgreSQL mail storage.

Stores email messages directly in the database.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class MailboxMessage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A single email message stored locally in PostgreSQL.

    Messages can be populated from IMAP sync, SMTP receipt, or direct
    creation (drafts/sent).
    """

    __tablename__ = "mailbox_messages"

    # ── Ownership ─────────────────────────────────────────────────────────────
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Folder / organisation ─────────────────────────────────────────────────
    folder: Mapped[str] = mapped_column(
        String(100), nullable=False, default="INBOX", index=True,
    )

    # ── Envelope fields ───────────────────────────────────────────────────────
    from_addr: Mapped[str] = mapped_column(String(320), nullable=False, default="")
    from_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    to_addrs: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    cc: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    bcc: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    subject: Mapped[str] = mapped_column(String(998), nullable=False, default="")

    # ── Body ──────────────────────────────────────────────────────────────────
    body_html: Mapped[str] = mapped_column(Text, nullable=False, default="")
    body_text: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # ── Headers / metadata ────────────────────────────────────────────────────
    headers: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    attachments: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list,
        comment="List of {filename, content_type, size, storage_key} dicts",
    )

    # ── Flags ─────────────────────────────────────────────────────────────────
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_starred: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_draft: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ── Threading ─────────────────────────────────────────────────────────────
    message_id_header: Mapped[str] = mapped_column(
        String(500), nullable=False, default="", index=True,
    )
    in_reply_to: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    references: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # ── Timestamps ────────────────────────────────────────────────────────────
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True,
    )
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # ── Label IDs (optional) ──────────────────────────────────────────────────
    label_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    # ── Multi-account ────────────────────────────────────────────────────────
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True,
    )

    # ── Pinning & Flags ──────────────────────────────────────────────────────
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    flag_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="none",
        comment="none, flagged, complete",
    )
    flag_due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    flag_reminder_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Categories ───────────────────────────────────────────────────────────
    category_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    # ── DLP / Security ───────────────────────────────────────────────────────
    sensitivity_label_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True,
    )

    # ── Display formatting (from conditional rules) ──────────────────────────
    display_format: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # ── Scheduled send ───────────────────────────────────────────────────────
    scheduled_send_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── AI Triage ────────────────────────────────────────────────────────────
    priority_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_category: Mapped[str | None] = mapped_column(
        String(50), nullable=True,
        comment="finance-invoice, support-request, deal-related, project-update, personal, newsletter, spam-suspect",
    )
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_triage: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    predicted_actions: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        Index("ix_mailbox_messages_user_folder", "user_id", "folder"),
        Index("ix_mailbox_messages_user_received", "user_id", "received_at"),
        Index("ix_mailbox_messages_user_read", "user_id", "is_read"),
    )

    def to_summary_dict(self) -> dict:
        """Return a lightweight dict suitable for list views."""
        return {
            "id": str(self.id),
            "folder": self.folder,
            "from": {"name": self.from_name, "email": self.from_addr},
            "to": self.to_addrs,
            "subject": self.subject,
            "date": self.received_at.isoformat() if self.received_at else None,
            "read": self.is_read,
            "starred": self.is_starred,
            "is_draft": self.is_draft,
            "has_attachments": bool(self.attachments),
            "label_ids": self.label_ids,
            "is_pinned": self.is_pinned,
            "flag_status": self.flag_status,
            "priority_score": self.priority_score,
            "ai_category": self.ai_category,
        }

    def to_full_dict(self) -> dict:
        """Return the complete message dict."""
        return {
            "id": str(self.id),
            "folder": self.folder,
            "from": {"name": self.from_name, "email": self.from_addr},
            "to": self.to_addrs,
            "cc": self.cc,
            "bcc": self.bcc,
            "subject": self.subject,
            "body_text": self.body_text,
            "body_html": self.body_html,
            "date": self.received_at.isoformat() if self.received_at else None,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "read": self.is_read,
            "starred": self.is_starred,
            "is_draft": self.is_draft,
            "is_deleted": self.is_deleted,
            "message_id_header": self.message_id_header,
            "in_reply_to": self.in_reply_to,
            "references": self.references,
            "headers": self.headers,
            "attachments": self.attachments,
            "label_ids": self.label_ids,
            "account_id": str(self.account_id) if self.account_id else None,
            "is_pinned": self.is_pinned,
            "flag_status": self.flag_status,
            "flag_due_date": self.flag_due_date.isoformat() if self.flag_due_date else None,
            "flag_reminder_at": self.flag_reminder_at.isoformat() if self.flag_reminder_at else None,
            "category_ids": self.category_ids,
            "sensitivity_label_id": str(self.sensitivity_label_id) if self.sensitivity_label_id else None,
            "display_format": self.display_format,
            "scheduled_send_at": self.scheduled_send_at.isoformat() if self.scheduled_send_at else None,
            "priority_score": self.priority_score,
            "ai_category": self.ai_category,
            "ai_summary": self.ai_summary,
            "ai_triage": self.ai_triage,
            "predicted_actions": self.predicted_actions,
        }
