"""CRM models — contacts, leads, opportunities, deals, and MVP upgrade models."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, OptimisticLockMixin, TimestampMixin, UUIDPrimaryKeyMixin


# ---------------------------------------------------------------------------
# Core CRM models (original + enhanced)
# ---------------------------------------------------------------------------


class Contact(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """CRM contact (person or company)."""

    __tablename__ = "crm_contacts"
    __table_args__ = (
        Index("ix_crm_contacts_email", "email"),
        Index("ix_crm_contacts_lifecycle_stage", "lifecycle_stage"),
    )

    contact_type: Mapped[str] = mapped_column(
        String(20), default="person"
    )  # person, company
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)  # website, referral, cold_call
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # --- MVP additions ---
    website: Mapped[str | None] = mapped_column(String(300), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    annual_revenue: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    employee_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lifecycle_stage: Mapped[str] = mapped_column(
        String(30), default="subscriber"
    )  # subscriber, lead, mql, sql, opportunity, customer, evangelist
    last_activity_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    custom_fields: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    social_profiles: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {linkedin, twitter, facebook, ...}
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0-100

    leads = relationship("Lead", back_populates="contact")
    notes = relationship("ContactNote", back_populates="contact", cascade="all, delete-orphan")
    activities = relationship("SalesActivity", back_populates="contact", foreign_keys="SalesActivity.contact_id")


class Lead(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Sales lead — initial interest from a contact."""

    __tablename__ = "crm_leads"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_contacts.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(30), default="new"
    )  # new, contacted, qualified, unqualified, converted
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    estimated_value: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # --- MVP additions ---
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0-100 computed
    score_factors: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    scored_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    custom_fields: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    contact = relationship("Contact", back_populates="leads")
    opportunities = relationship("Opportunity", back_populates="lead")


class Opportunity(OptimisticLockMixin, UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Sales opportunity — qualified lead progressing through a pipeline."""

    __tablename__ = "crm_opportunities"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_leads.id"), nullable=True
    )
    stage: Mapped[str] = mapped_column(
        String(50), default="prospecting"
    )  # prospecting, proposal, negotiation, closed_won, closed_lost
    probability: Mapped[int | None] = mapped_column(nullable=True)  # 0-100%
    expected_value: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    expected_close_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # --- MVP additions ---
    pipeline_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_pipelines.id"), nullable=True
    )
    swimlane: Mapped[str | None] = mapped_column(String(50), nullable=True)
    weighted_value: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    loss_reason: Mapped[str | None] = mapped_column(String(200), nullable=True)
    custom_fields: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    lead = relationship("Lead", back_populates="opportunities")
    deals = relationship("Deal", back_populates="opportunity")
    pipeline = relationship("Pipeline", back_populates="opportunities")


class Deal(OptimisticLockMixin, UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Closed deal — won opportunity."""

    __tablename__ = "crm_deals"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    opportunity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_opportunities.id"), nullable=True
    )
    deal_value: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    close_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="active"
    )  # active, completed, cancelled
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    opportunity = relationship("Opportunity", back_populates="deals")


class Campaign(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Marketing campaign."""

    __tablename__ = "crm_campaigns"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    campaign_type: Mapped[str] = mapped_column(
        String(30), default="email"
    )  # email, social, event, other
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, active, paused, completed
    budget: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    spent: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    campaign_contacts = relationship("CampaignContact", back_populates="campaign", cascade="all, delete-orphan")


class CampaignContact(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Tracks contact participation in a campaign."""

    __tablename__ = "crm_campaign_contacts"

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_campaigns.id"), nullable=False
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_contacts.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending, sent, opened, clicked, converted
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    campaign = relationship("Campaign", back_populates="campaign_contacts")
    contact = relationship("Contact")


class CRMProduct(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Product catalog for CRM quotes."""

    __tablename__ = "crm_products"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    sku: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Quote(OptimisticLockMixin, UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Sales quote tied to a deal/contact."""

    __tablename__ = "crm_quotes"

    deal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_deals.id"), nullable=True
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_contacts.id"), nullable=False
    )
    quote_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    items: Mapped[list | None] = mapped_column(JSON, nullable=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    total: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, sent, accepted, rejected
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    deal = relationship("Deal")
    contact = relationship("Contact")


class CRMTicket(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """CRM support ticket linked to a contact."""

    __tablename__ = "crm_tickets"

    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_contacts.id"), nullable=True
    )
    subject: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="open"
    )  # open, in_progress, resolved, closed
    priority: Mapped[str] = mapped_column(
        String(20), default="medium"
    )  # low, medium, high, urgent
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    contact = relationship("Contact", foreign_keys=[contact_id])
    assignee = relationship("User", foreign_keys=[assigned_to])
    creator = relationship("User", foreign_keys=[created_by])


# ---------------------------------------------------------------------------
# MVP Phase — New models
# ---------------------------------------------------------------------------


class ContactNote(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Notes, calls, emails, meetings logged against a contact."""

    __tablename__ = "crm_contact_notes"

    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_contacts.id"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    note_type: Mapped[str] = mapped_column(
        String(30), default="note"
    )  # note, call, email, meeting, task
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)

    contact = relationship("Contact", back_populates="notes")
    author = relationship("User")


class CustomFieldDefinition(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """User-defined custom fields for any CRM entity."""

    __tablename__ = "crm_custom_field_definitions"

    entity_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # contact, lead, opportunity, deal
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)
    field_label: Mapped[str] = mapped_column(String(200), nullable=False)
    field_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # text, number, date, dropdown, boolean, url, email
    options: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # for dropdown type
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)
    default_value: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )


class DuplicateCandidate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Detected duplicate contact pair."""

    __tablename__ = "crm_duplicate_candidates"

    contact_a_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_contacts.id"), nullable=False
    )
    contact_b_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_contacts.id"), nullable=False
    )
    confidence_score: Mapped[int] = mapped_column(Integer, nullable=False)  # 0-100
    match_fields: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending, merged, dismissed
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    contact_a = relationship("Contact", foreign_keys=[contact_a_id])
    contact_b = relationship("Contact", foreign_keys=[contact_b_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])


class LeadScoringRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Configurable lead scoring rule."""

    __tablename__ = "crm_lead_scoring_rules"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # demographic, behavioral, firmographic, engagement
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)
    operator: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # equals, contains, greater_than, less_than, in
    value: Mapped[str] = mapped_column(String(500), nullable=False)
    score_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )


class SalesActivity(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Unified sales activity log (email, call, meeting, task, note, sms)."""

    __tablename__ = "crm_sales_activities"
    __table_args__ = (
        Index("ix_crm_sales_activities_contact_id", "contact_id"),
    )

    activity_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # email, call, meeting, task, note, sms
    subject: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_contacts.id"), nullable=True
    )
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_leads.id"), nullable=True
    )
    opportunity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_opportunities.id"), nullable=True
    )
    deal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_deals.id"), nullable=True
    )
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(100), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    contact = relationship("Contact", back_populates="activities", foreign_keys=[contact_id])
    lead = relationship("Lead", foreign_keys=[lead_id])
    opportunity = relationship("Opportunity", foreign_keys=[opportunity_id])
    deal = relationship("Deal", foreign_keys=[deal_id])


class Pipeline(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Named pipeline with custom stages."""

    __tablename__ = "crm_pipelines"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    stages: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )  # [{name, probability, color, position}, ...]
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    opportunities = relationship("Opportunity", back_populates="pipeline")


class SalesSequence(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Automated outreach sequence."""

    __tablename__ = "crm_sales_sequences"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, active, paused, archived
    trigger_type: Mapped[str] = mapped_column(
        String(30), default="manual"
    )  # manual, lead_created, stage_changed
    trigger_config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    steps = relationship("SequenceStep", back_populates="sequence", cascade="all, delete-orphan", order_by="SequenceStep.step_order")
    enrollments = relationship("SequenceEnrollment", back_populates="sequence")


class SequenceStep(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Individual step in a sales sequence."""

    __tablename__ = "crm_sequence_steps"

    sequence_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_sales_sequences.id"), nullable=False
    )
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    step_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # email, wait, task, condition
    delay_days: Mapped[int] = mapped_column(Integer, default=0)
    delay_hours: Mapped[int] = mapped_column(Integer, default=0)
    config: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )  # template_id, task description, condition rules, etc.

    sequence = relationship("SalesSequence", back_populates="steps")


class SequenceEnrollment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Contact enrollment in a sales sequence."""

    __tablename__ = "crm_sequence_enrollments"
    __table_args__ = (
        Index("ix_crm_sequence_enrollments_status", "status"),
    )

    sequence_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_sales_sequences.id"), nullable=False
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_contacts.id"), nullable=False
    )
    current_step_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_sequence_steps.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default="active"
    )  # active, paused, completed, bounced, unsubscribed
    enrolled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    enrolled_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    sequence = relationship("SalesSequence", back_populates="enrollments")
    contact = relationship("Contact")
    current_step = relationship("SequenceStep")


class EmailTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Reusable email/SMS template."""

    __tablename__ = "crm_email_templates"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body_html: Mapped[str] = mapped_column(Text, nullable=False)
    body_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(
        String(50), default="one_off"
    )  # sequence, campaign, one_off, notification
    variables: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # list of merge fields
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
