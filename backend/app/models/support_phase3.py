"""Support Phase 3 models — Advanced Analytics, Proactive Support, Voice, Agent Skills, Sandboxes, Customer Health."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class SupportAnalyticsSnapshot(Base, UUIDPrimaryKeyMixin):
    """Daily snapshot of support metrics for trend analysis."""

    __tablename__ = "support_analytics_snapshots"

    snapshot_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True,
    )

    # Volume metrics
    new_tickets: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    resolved_tickets: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    closed_tickets: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reopened_tickets: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    backlog_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # SLA metrics
    sla_compliance_pct: Mapped[float] = mapped_column(Float, nullable=True)
    avg_response_minutes: Mapped[float] = mapped_column(Float, nullable=True)
    avg_resolution_minutes: Mapped[float] = mapped_column(Float, nullable=True)

    # Satisfaction
    avg_csat: Mapped[float] = mapped_column(Float, nullable=True)
    csat_responses: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # AI impact
    ai_classified_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ai_auto_responded_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ai_deflected_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Channel breakdown (JSON: {"email": 10, "portal": 5, "chat": 3, ...})
    channel_breakdown: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
    priority_breakdown: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
    category_breakdown: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)

    # Agent performance (JSON: [{"user_id": "...", "name": "...", "resolved": N, "avg_csat": N, "avg_response_min": N}])
    agent_performance: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)

    def __repr__(self) -> str:
        return f"<SupportAnalyticsSnapshot date={self.snapshot_date}>"


class ProactiveRule(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Proactive support rule — triggers outreach before customers report issues."""

    __tablename__ = "proactive_rules"

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Trigger type: event-based, schedule-based, threshold-based
    trigger_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default="event",
    )  # event, schedule, threshold

    # Trigger conditions (JSON)
    # event: {"event": "ecommerce.order.delayed", "delay_minutes": 30}
    # threshold: {"metric": "error_rate", "threshold": 0.05, "window_minutes": 60}
    # schedule: {"cron": "0 9 * * 1"}
    trigger_conditions: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)

    # Actions: [{"type": "create_ticket", "template": "..."}, {"type": "send_email", "template": "..."}, {"type": "notify_agent", "message": "..."}]
    actions: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    execution_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_triggered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    creator = relationship("User", foreign_keys=[created_by], lazy="joined")

    def __repr__(self) -> str:
        return f"<ProactiveRule name={self.name!r} active={self.is_active}>"


class VoiceCallRecord(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Voice call record linked to a support ticket."""

    __tablename__ = "voice_call_records"

    ticket_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    customer_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    customer_name: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # Call metadata
    direction: Mapped[str] = mapped_column(
        String(10), nullable=False, default="inbound",
    )  # inbound, outbound
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="ringing",
    )  # ringing, in_progress, completed, missed, voicemail
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    wait_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Recording & transcription
    recording_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    sentiment_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    ticket = relationship("Ticket", foreign_keys=[ticket_id])
    agent = relationship("User", foreign_keys=[agent_id], lazy="joined")

    def __repr__(self) -> str:
        return f"<VoiceCallRecord id={self.id} direction={self.direction} status={self.status}>"


class AgentSkill(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Agent skill/expertise for skill-based routing."""

    __tablename__ = "agent_skills"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    skill_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    proficiency: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3,
    )  # 1-5 scale
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    max_concurrent: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    languages: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)

    user = relationship("User", foreign_keys=[user_id], lazy="joined")

    def __repr__(self) -> str:
        return f"<AgentSkill user={self.user_id} skill={self.skill_name!r} level={self.proficiency}>"


class AgentShift(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Agent work shift schedule."""

    __tablename__ = "agent_shifts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)  # HH:MM format
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), nullable=False, default="UTC")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    user = relationship("User", foreign_keys=[user_id], lazy="joined")

    def __repr__(self) -> str:
        return f"<AgentShift user={self.user_id} day={self.day_of_week} {self.start_time}-{self.end_time}>"


class SupportSandbox(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Support sandbox environment for testing automations and workflows."""

    __tablename__ = "support_sandboxes"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Snapshot of automations/SLA policies for testing
    config_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
    test_results: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)

    creator = relationship("User", foreign_keys=[created_by], lazy="joined")

    def __repr__(self) -> str:
        return f"<SupportSandbox name={self.name!r} active={self.is_active}>"


class CustomerHealthScore(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Customer health score — composite metric for churn risk and engagement."""

    __tablename__ = "customer_health_scores"

    customer_email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_contacts.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )

    # Composite scores (0-100)
    overall_score: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    engagement_score: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    satisfaction_score: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    effort_score: Mapped[int] = mapped_column(Integer, nullable=False, default=50)

    # Derived metrics
    ticket_frequency: Mapped[float] = mapped_column(Float, nullable=True)  # tickets/month
    avg_sentiment: Mapped[float] = mapped_column(Float, nullable=True)
    avg_csat: Mapped[float] = mapped_column(Float, nullable=True)
    last_ticket_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_tickets: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Risk classification
    risk_level: Mapped[str] = mapped_column(
        String(20), nullable=False, default="medium",
    )  # healthy, at_risk, critical
    churn_probability: Mapped[float] = mapped_column(Float, nullable=True)

    # Factors (JSON: [{"factor": "high ticket volume", "impact": -10}, ...])
    score_factors: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)

    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    contact = relationship("Contact", foreign_keys=[contact_id])

    def __repr__(self) -> str:
        return f"<CustomerHealthScore email={self.customer_email!r} score={self.overall_score} risk={self.risk_level}>"
