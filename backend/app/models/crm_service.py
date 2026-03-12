"""CRM Phase 2 — Service hub models (conversations, knowledge base, SLA)."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    Vector = None


class Conversation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Omnichannel conversation thread linked to a contact and/or ticket."""

    __tablename__ = "crm_conversations"

    channel: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # email, chat, phone, social, web
    subject: Mapped[str | None] = mapped_column(String(300), nullable=True)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_contacts.id"), nullable=True
    )
    ticket_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_tickets.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default="open"
    )  # open, pending, resolved, closed
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    contact = relationship("Contact", foreign_keys=[contact_id])
    ticket = relationship("CRMTicket", foreign_keys=[ticket_id])
    messages = relationship(
        "ConversationMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )


class ConversationMessage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Individual message within a conversation."""

    __tablename__ = "crm_conversation_messages"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_conversations.id"), nullable=False
    )
    sender_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # customer, agent, system, ai
    sender_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(
        String(20), default="text"
    )  # text, html, attachment
    attachments: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    conversation = relationship("Conversation", back_populates="messages")


class CRMKnowledgeBaseArticle(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Self-service knowledge base article with optional vector embedding."""

    __tablename__ = "crm_knowledge_base_articles"

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    slug: Mapped[str] = mapped_column(String(300), unique=True, nullable=False)
    content_html: Mapped[str] = mapped_column(Text, nullable=False)
    content_text: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    tags: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, published, archived
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    helpful_count: Mapped[int] = mapped_column(Integer, default=0)
    not_helpful_count: Mapped[int] = mapped_column(Integer, default=0)
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # pgvector embedding — falls back to JSON if pgvector is not installed
    if Vector is not None:
        embedding = mapped_column(Vector(1536), nullable=True)
    else:
        embedding: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    author = relationship("User", foreign_keys=[author_id])


class CRMSLAPolicy(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Service-level agreement policy defining response/resolution targets."""

    __tablename__ = "crm_sla_policies"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # low, medium, high, urgent
    first_response_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    resolution_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    business_hours_only: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    trackers = relationship("SLATracker", back_populates="sla_policy")


class SLATracker(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Tracks SLA compliance for individual tickets."""

    __tablename__ = "crm_sla_trackers"

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_tickets.id"), nullable=False
    )
    sla_policy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_sla_policies.id"), nullable=False
    )
    first_response_due: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    first_response_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolution_due: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    resolution_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_first_response_breached: Mapped[bool] = mapped_column(Boolean, default=False)
    is_resolution_breached: Mapped[bool] = mapped_column(Boolean, default=False)

    ticket = relationship("CRMTicket", foreign_keys=[ticket_id])
    sla_policy = relationship("CRMSLAPolicy", back_populates="trackers")
