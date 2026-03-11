"""CRM AI Agent models — agent configs and execution runs."""
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
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class CRMAIAgentConfig(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Configuration for a CRM AI agent."""

    __tablename__ = "crm_ai_agent_configs"

    agent_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # lead_qualifier, meeting_scheduler, ticket_resolver, report_generator, data_enricher
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    config: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )  # {model, temperature, system_prompt_overrides, tool_allowlist}
    schedule: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    approval_required: Mapped[bool] = mapped_column(Boolean, default=True)
    max_actions_per_run: Mapped[int] = mapped_column(Integer, default=10)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    runs = relationship("CRMAIAgentRun", back_populates="agent_config", cascade="all, delete-orphan")
    owner = relationship("User", foreign_keys=[owner_id])


class CRMAIAgentRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Single execution run of a CRM AI agent."""

    __tablename__ = "crm_ai_agent_runs"

    agent_config_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_ai_agent_configs.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), default="running"
    )  # running, completed, failed, needs_approval
    trigger: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # scheduled, event, manual
    input_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    output_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    actions_taken: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    agent_config = relationship("CRMAIAgentConfig", back_populates="runs")
    approver = relationship("User", foreign_keys=[approved_by])
