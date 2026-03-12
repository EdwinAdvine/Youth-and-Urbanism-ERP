"""Support Phase 1 models — live chat, audit log, time tracking, saved views, templates, inbound email."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class LiveChatSession(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A real-time chat session between a visitor/customer and an agent."""

    __tablename__ = "live_chat_sessions"

    visitor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True,
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("crm_contacts.id", ondelete="SET NULL"),
        nullable=True,
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    channel: Mapped[str] = mapped_column(
        String(30), nullable=False, default="web_chat", index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="queued", index=True,
    )  # queued, active, waiting, closed
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    ticket_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="SET NULL"),
        nullable=True,
    )
    metadata_json: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, default=dict,
    )  # browser info, page URL, referrer
    customer_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    customer_name: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # Relationships
    agent = relationship("User", foreign_keys=[agent_id], lazy="joined")
    contact = relationship("Contact", foreign_keys=[contact_id], lazy="joined")
    ticket = relationship("Ticket", foreign_keys=[ticket_id], lazy="joined")
    messages = relationship(
        "LiveChatMessage", back_populates="session", lazy="selectin",
        order_by="LiveChatMessage.created_at",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<LiveChatSession id={self.id} status={self.status}>"


class LiveChatMessage(Base, UUIDPrimaryKeyMixin):
    """A single message in a live chat session."""

    __tablename__ = "live_chat_messages"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("live_chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_type: Mapped[str] = mapped_column(
        String(20), nullable=False,
    )  # visitor, agent, bot, system
    sender_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="text",
    )  # text, image, file, system
    attachments: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    # Relationships
    session = relationship("LiveChatSession", back_populates="messages")

    def __repr__(self) -> str:
        return f"<LiveChatMessage id={self.id} type={self.sender_type}>"


class TicketAuditLog(Base, UUIDPrimaryKeyMixin):
    """Tracks every change made to a ticket for full audit trail."""

    __tablename__ = "ticket_audit_log"

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True,
    )  # created, status_changed, assigned, priority_changed, merged, field_updated, comment_added
    field_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id], lazy="joined")
    ticket = relationship("Ticket", foreign_keys=[ticket_id], lazy="joined")

    def __repr__(self) -> str:
        return f"<TicketAuditLog ticket={self.ticket_id} action={self.action}>"


class TicketTimeEntry(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Time tracking entry per agent per ticket."""

    __tablename__ = "ticket_time_entries"

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_billable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    billing_rate_hourly: Mapped[float | None] = mapped_column(
        Float, nullable=True,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    agent = relationship("User", foreign_keys=[agent_id], lazy="joined")
    ticket = relationship("Ticket", foreign_keys=[ticket_id], lazy="joined")

    def __repr__(self) -> str:
        return f"<TicketTimeEntry ticket={self.ticket_id} agent={self.agent_id}>"


class SavedTicketView(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """User-scoped saved filter/view for the tickets list."""

    __tablename__ = "saved_ticket_views"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    filters: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, default=dict,
    )  # {"status": [...], "priority": [...], "assigned_to": "...", "tags": [...], "category_id": "..."}
    columns: Mapped[list | None] = mapped_column(
        JSON, nullable=True, default=list,
    )  # list of visible column keys
    sort_by: Mapped[str] = mapped_column(String(50), nullable=False, default="created_at")
    sort_order: Mapped[str] = mapped_column(String(4), nullable=False, default="desc")
    is_shared: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    owner = relationship("User", foreign_keys=[user_id], lazy="joined")

    def __repr__(self) -> str:
        return f"<SavedTicketView id={self.id} name={self.name!r}>"


class TicketTemplate(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Pre-defined ticket creation template with default values."""

    __tablename__ = "ticket_templates"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    default_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_priority: Mapped[str | None] = mapped_column(String(20), nullable=True)
    default_category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ticket_categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    default_tags: Mapped[list[str] | None] = mapped_column(
        ARRAY(String(100)), nullable=True, default=list,
    )
    custom_fields: Mapped[list | None] = mapped_column(
        JSON, nullable=True, default=list,
    )  # [{field_name, field_type, required, options}]
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    category = relationship("TicketCategory", foreign_keys=[default_category_id], lazy="joined")
    author = relationship("User", foreign_keys=[created_by], lazy="joined")

    def __repr__(self) -> str:
        return f"<TicketTemplate id={self.id} name={self.name!r}>"


class InboundEmailRule(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Configuration for converting inbound emails to tickets."""

    __tablename__ = "inbound_email_rules"

    email_address: Mapped[str] = mapped_column(
        String(320), nullable=False, index=True,
    )  # support@domain.com
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ticket_categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    assign_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    auto_reply_template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("canned_responses.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    category = relationship("TicketCategory", foreign_keys=[category_id], lazy="joined")
    assignee = relationship("User", foreign_keys=[assign_to], lazy="joined")
    auto_reply_template = relationship("CannedResponse", foreign_keys=[auto_reply_template_id], lazy="joined")

    def __repr__(self) -> str:
        return f"<InboundEmailRule id={self.id} email={self.email_address}>"
