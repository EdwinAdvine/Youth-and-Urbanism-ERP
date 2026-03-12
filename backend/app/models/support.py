"""Support / Customer Center models — tickets, KB articles, SLA policies."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class TicketCategory(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Category / department for support tickets."""

    __tablename__ = "ticket_categories"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str | None] = mapped_column(String(30), nullable=True, default="#51459d")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    tickets = relationship("Ticket", back_populates="category", lazy="selectin")

    def __repr__(self) -> str:
        return f"<TicketCategory id={self.id} name={self.name!r}>"


class Ticket(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A customer support ticket."""

    __tablename__ = "tickets"

    ticket_number: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, index=True
    )
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Status workflow
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="open", index=True,
    )
    priority: Mapped[str] = mapped_column(
        String(20), nullable=False, default="medium", index=True,
    )

    # Category
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ticket_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Customer info (linked CRM contact or free-text)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("crm_contacts.id", ondelete="SET NULL"),
        nullable=True,
    )
    customer_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    customer_name: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # Assignment
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Timestamps for SLA
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    first_response_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # SLA fields
    sla_response_due: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sla_resolution_due: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sla_response_breached: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sla_resolution_breached: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Tags
    tags: Mapped[list[str] | None] = mapped_column(
        ARRAY(String(100)), nullable=True, default=list,
    )

    # Phase 1 — omnichannel, AI sentiment, custom fields
    channel: Mapped[str] = mapped_column(
        String(30), nullable=False, default="web", index=True,
    )  # web, email, live_chat, whatsapp, api
    sentiment_score: Mapped[float | None] = mapped_column(Float, nullable=True)  # -1.0 to 1.0
    sentiment_label: Mapped[str | None] = mapped_column(
        String(30), nullable=True,
    )  # frustrated, confused, neutral, satisfied, angry
    custom_fields: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, default=dict,
    )  # template-driven custom data

    # Relationships
    category = relationship("TicketCategory", back_populates="tickets", lazy="joined")
    assignee = relationship("User", foreign_keys=[assigned_to], lazy="joined")
    creator = relationship("User", foreign_keys=[created_by], lazy="joined")
    contact = relationship("Contact", foreign_keys=[contact_id], lazy="joined")
    comments = relationship(
        "TicketComment", back_populates="ticket", lazy="selectin",
        order_by="TicketComment.created_at",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Ticket {self.ticket_number} status={self.status}>"


class TicketComment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A comment / reply on a ticket (internal or customer-facing)."""

    __tablename__ = "ticket_comments"

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_internal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    attachments: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)

    # Relationships
    ticket = relationship("Ticket", back_populates="comments")
    author = relationship("User", foreign_keys=[author_id], lazy="joined")

    def __repr__(self) -> str:
        return f"<TicketComment id={self.id} ticket={self.ticket_id}>"


class SupportKnowledgeBaseArticle(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A knowledge-base / help article."""

    __tablename__ = "kb_articles"

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    slug: Mapped[str] = mapped_column(String(500), unique=True, nullable=False, index=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)

    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ticket_categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    tags: Mapped[list[str] | None] = mapped_column(
        ARRAY(String(100)), nullable=True, default=list,
    )
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    helpful_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    author = relationship("User", foreign_keys=[author_id], lazy="joined")
    category = relationship("TicketCategory", lazy="joined")

    def __repr__(self) -> str:
        return f"<KBArticle id={self.id} title={self.title!r}>"


class SupportSLAPolicy(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """SLA policy per priority level."""

    __tablename__ = "sla_policies"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    response_time_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    resolution_time_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    def __repr__(self) -> str:
        return f"<SupportSLAPolicy id={self.id} priority={self.priority}>"


class CannedResponse(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Pre-written response template for support agents."""

    __tablename__ = "canned_responses"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    author = relationship("User", foreign_keys=[created_by], lazy="joined")

    def __repr__(self) -> str:
        return f"<CannedResponse id={self.id} name={self.name!r}>"


class TicketTag(Base, UUIDPrimaryKeyMixin):
    """Explicit tag association for a ticket (normalised)."""

    __tablename__ = "ticket_tags"

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tag_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    ticket = relationship("Ticket", foreign_keys=[ticket_id])

    def __repr__(self) -> str:
        return f"<TicketTag ticket={self.ticket_id} tag={self.tag_name!r}>"


class TicketRoutingRule(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Auto-routing rule: matches conditions on new tickets to auto-assign/re-prioritize."""

    __tablename__ = "ticket_routing_rules"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # JSON conditions: {"subject_contains": "...", "priority": "...", "customer_email_domain": "...", "tags_include": [...], "category_id": "..."}
    conditions: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)

    # Actions
    assign_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    priority_override: Mapped[str | None] = mapped_column(String(20), nullable=True)
    category_override: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ticket_categories.id", ondelete="SET NULL"),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    priority_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    assignee = relationship("User", foreign_keys=[assign_to], lazy="joined")

    def __repr__(self) -> str:
        return f"<TicketRoutingRule id={self.id} name={self.name!r} active={self.is_active}>"


class CustomerSatisfaction(Base, UUIDPrimaryKeyMixin):
    """CSAT survey response linked to a resolved/closed ticket."""

    __tablename__ = "customer_satisfaction"

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    ticket = relationship("Ticket", foreign_keys=[ticket_id])

    def __repr__(self) -> str:
        return f"<CustomerSatisfaction ticket={self.ticket_id} rating={self.rating}>"
