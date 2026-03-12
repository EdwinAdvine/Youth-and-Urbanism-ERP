"""Support Phase 2 models — Automation, Portal, Forum, Omnichannel, Escalation, Followers."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class SupportAutomation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """If/then workflow automation rule for support events."""

    __tablename__ = "support_automations"

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Trigger: event name that fires this automation
    trigger_event: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True,
    )  # e.g. support.ticket.created, support.comment.added, support.sla.breached

    # JSON conditions: {"priority": "urgent", "category_id": "...", "tags_include": [...], "sentiment_below": -0.5}
    conditions: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)

    # JSON actions: [{"type": "assign", "user_id": "..."}, {"type": "set_priority", "value": "high"}, {"type": "add_tag", "value": "escalated"}, {"type": "send_email", "template": "..."}, {"type": "add_comment", "content": "...", "is_internal": true}]
    actions: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    execution_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )

    # Relationships
    creator = relationship("User", foreign_keys=[created_by], lazy="joined")
    logs = relationship("SupportAutomationLog", back_populates="automation", lazy="selectin", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<SupportAutomation id={self.id} name={self.name!r} active={self.is_active}>"


class SupportAutomationLog(Base, UUIDPrimaryKeyMixin):
    """Execution log for a support automation."""

    __tablename__ = "support_automation_logs"

    automation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("support_automations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    ticket_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    actions_executed: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    executed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    automation = relationship("SupportAutomation", back_populates="logs")
    ticket = relationship("Ticket", foreign_keys=[ticket_id])

    def __repr__(self) -> str:
        return f"<SupportAutomationLog automation={self.automation_id} success={self.success}>"


class CustomerPortalAccount(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Customer self-service portal account (separate from internal users)."""

    __tablename__ = "customer_portal_accounts"

    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_contacts.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(300), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    contact = relationship("Contact", foreign_keys=[contact_id], lazy="joined")

    def __repr__(self) -> str:
        return f"<CustomerPortalAccount email={self.email!r}>"


class ForumCategory(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Community forum category."""

    __tablename__ = "forum_categories"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    posts = relationship("ForumPost", back_populates="category", lazy="selectin")

    def __repr__(self) -> str:
        return f"<ForumCategory name={self.name!r}>"


class ForumPost(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Community forum post / question."""

    __tablename__ = "forum_posts"

    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("forum_categories.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    # author_type: internal user or portal customer
    author_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="user",
    )  # user, customer

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    upvote_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reply_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    category = relationship("ForumCategory", back_populates="posts")
    author = relationship("User", foreign_keys=[author_id], lazy="joined")
    replies = relationship("ForumReply", back_populates="post", lazy="selectin", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<ForumPost id={self.id} title={self.title!r}>"


class ForumReply(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Reply to a forum post."""

    __tablename__ = "forum_replies"

    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("forum_posts.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_best_answer: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    upvote_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    post = relationship("ForumPost", back_populates="replies")
    author = relationship("User", foreign_keys=[author_id], lazy="joined")

    def __repr__(self) -> str:
        return f"<ForumReply id={self.id} post={self.post_id}>"


class SLAEscalationChain(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Multi-level escalation chain linked to an SLA policy."""

    __tablename__ = "sla_escalation_chains"

    sla_policy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sla_policies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    level: Mapped[int] = mapped_column(Integer, nullable=False)  # 1, 2, 3
    trigger_minutes_before_breach: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    action: Mapped[str] = mapped_column(
        String(30), nullable=False, default="notify",
    )  # notify, reassign, escalate
    target_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    notify_channel: Mapped[str] = mapped_column(
        String(30), nullable=False, default="in_app",
    )  # in_app, email, both

    sla_policy = relationship("SupportSLAPolicy", foreign_keys=[sla_policy_id])
    target_user = relationship("User", foreign_keys=[target_user_id], lazy="joined")

    def __repr__(self) -> str:
        return f"<SLAEscalationChain sla={self.sla_policy_id} level={self.level}>"


class OmnichannelConfig(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Configuration for an external messaging channel (WhatsApp, Facebook, SMS, etc.)."""

    __tablename__ = "omnichannel_configs"

    channel: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False, index=True,
    )  # whatsapp, facebook, sms, telegram, instagram
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    webhook_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    api_key_encrypted: Mapped[str | None] = mapped_column(String(500), nullable=True)
    settings: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    def __repr__(self) -> str:
        return f"<OmnichannelConfig channel={self.channel!r} active={self.is_active}>"


class TicketFollower(Base, UUIDPrimaryKeyMixin):
    """User watching/following a ticket for notifications."""

    __tablename__ = "ticket_followers"

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    notify_on_comment: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notify_on_status_change: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    ticket = relationship("Ticket", foreign_keys=[ticket_id])
    user = relationship("User", foreign_keys=[user_id], lazy="joined")

    def __repr__(self) -> str:
        return f"<TicketFollower ticket={self.ticket_id} user={self.user_id}>"
