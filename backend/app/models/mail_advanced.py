"""Advanced mail models for Era Mail upgrade — 16 models."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# ---------------------------------------------------------------------------
# 1. MailAccount — multi-account support
# ---------------------------------------------------------------------------
class MailAccount(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mail_accounts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    provider: Mapped[str] = mapped_column(
        String(20), nullable=False,
        comment="internal, gmail, outlook, yahoo, imap",
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    imap_host: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    imap_port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    smtp_host: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    smtp_port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    oauth_tokens: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="Encrypted OAuth tokens",
    )
    password_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sync_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    sync_cursor: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user = relationship("User")


# ---------------------------------------------------------------------------
# 2. FocusedInboxScore
# ---------------------------------------------------------------------------
class FocusedInboxScore(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "focused_inbox_scores"
    __table_args__ = (
        UniqueConstraint("user_id", "sender_email", name="uq_focused_inbox_user_sender"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    sender_email: Mapped[str] = mapped_column(String(320), nullable=False)
    score: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    email_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_email_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    has_crm_contact: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_open_deal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_support_ticket: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user = relationship("User")


# ---------------------------------------------------------------------------
# 3. SmartFolder
# ---------------------------------------------------------------------------
class SmartFolder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mail_smart_folders"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_ai_suggested: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    message_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    user = relationship("User")


# ---------------------------------------------------------------------------
# 4. SearchFolder
# ---------------------------------------------------------------------------
class SearchFolder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mail_search_folders"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    query_string: Mapped[str] = mapped_column(Text, nullable=False)
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    user = relationship("User")


# ---------------------------------------------------------------------------
# 5. MailCategory
# ---------------------------------------------------------------------------
class MailCategory(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mail_categories"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=False)
    keyboard_shortcut: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    user = relationship("User")


# ---------------------------------------------------------------------------
# 6. MailQuickStep
# ---------------------------------------------------------------------------
class MailQuickStep(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mail_quick_steps"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    keyboard_shortcut: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    actions: Mapped[list[Any]] = mapped_column(JSONB, default=list, nullable=False)

    user = relationship("User")


# ---------------------------------------------------------------------------
# 7. MailTemplate
# ---------------------------------------------------------------------------
class MailTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mail_templates"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    subject_template: Mapped[str] = mapped_column(String(998), nullable=False)
    body_html_template: Mapped[str] = mapped_column(Text, nullable=False)
    variables: Mapped[list[Any]] = mapped_column(JSONB, default=list, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user = relationship("User")


# ---------------------------------------------------------------------------
# 8. MailPoll
# ---------------------------------------------------------------------------
class MailPoll(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mail_polls"

    message_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True,
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[list[Any]] = mapped_column(JSONB, nullable=False)
    responses: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    closes_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    creator = relationship("User")


# ---------------------------------------------------------------------------
# 9. MailContactProfile
# ---------------------------------------------------------------------------
class MailContactProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mail_contact_profiles"
    __table_args__ = (
        UniqueConstraint("user_id", "email", name="uq_mail_contact_profile_user_email"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    company: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    crm_contact_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True,
    )
    email_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_email_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    avg_response_time_minutes: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    sentiment_trend: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    user = relationship("User")


# ---------------------------------------------------------------------------
# 11. DLPPolicy
# ---------------------------------------------------------------------------
class DLPPolicy(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "dlp_policies"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    patterns: Mapped[list[Any]] = mapped_column(JSONB, nullable=False)
    action: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="warn, block, log",
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )

    creator = relationship("User")


# ---------------------------------------------------------------------------
# 12. PushSubscription
# ---------------------------------------------------------------------------
class PushSubscription(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "push_subscriptions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    p256dh_key: Mapped[str] = mapped_column(Text, nullable=False)
    auth_key: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user = relationship("User")


# ---------------------------------------------------------------------------
# 13. MailWebhook
# ---------------------------------------------------------------------------
class MailWebhook(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mail_webhooks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    events: Mapped[list[Any]] = mapped_column(JSONB, default=list, nullable=False)
    secret: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user = relationship("User")


# ---------------------------------------------------------------------------
# 14. SharedMailbox
# ---------------------------------------------------------------------------
class SharedMailbox(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "shared_mailboxes"

    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    member_ids: Mapped[list[Any]] = mapped_column(JSONB, default=list, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    auto_assign_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    assignment_strategy: Mapped[str] = mapped_column(
        String(20), default="round_robin", nullable=False,
    )

    creator = relationship("User")


# ---------------------------------------------------------------------------
# 15. MailAnnotation
# ---------------------------------------------------------------------------
class MailAnnotation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mail_annotations"

    message_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_internal: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    author = relationship("User")


# ---------------------------------------------------------------------------
# 16. MailRetentionPolicy
# ---------------------------------------------------------------------------
class MailRetentionPolicy(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mail_retention_policies"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    applies_to_labels: Mapped[Optional[list[Any]]] = mapped_column(JSONB, nullable=True)
    applies_to_categories: Mapped[Optional[list[Any]]] = mapped_column(JSONB, nullable=True)
    retention_days: Mapped[int] = mapped_column(Integer, nullable=False)
    action: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="archive, delete",
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )

    creator = relationship("User")
