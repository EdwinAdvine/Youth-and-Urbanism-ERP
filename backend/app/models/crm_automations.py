"""CRM Phase 2 — Workflow automation engine models."""
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


class CRMWorkflow(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Configurable automation workflow with trigger, conditions, and actions."""

    __tablename__ = "crm_workflows"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    trigger_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # event, schedule, manual, webhook
    trigger_config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, active, paused
    execution_count: Mapped[int] = mapped_column(Integer, default=0)
    last_executed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    nodes = relationship(
        "WorkflowNode", back_populates="workflow", cascade="all, delete-orphan"
    )
    executions = relationship(
        "CRMWorkflowExecution", back_populates="workflow", cascade="all, delete-orphan"
    )


class WorkflowNode(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Single node in the workflow graph (trigger, action, condition, delay, branch)."""

    __tablename__ = "crm_workflow_nodes"

    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_workflows.id"), nullable=False
    )
    node_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # trigger, action, condition, delay, branch
    position_x: Mapped[int] = mapped_column(Integer, default=0)
    position_y: Mapped[int] = mapped_column(Integer, default=0)
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    next_node_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    true_branch_node_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    false_branch_node_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    workflow = relationship("CRMWorkflow", back_populates="nodes")


class CRMWorkflowExecution(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Record of a single workflow run."""

    __tablename__ = "crm_workflow_executions"

    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_workflows.id"), nullable=False
    )
    trigger_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="running"
    )  # running, completed, failed, cancelled
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    steps_log: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    workflow = relationship("CRMWorkflow", back_populates="executions")


class WorkflowTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Pre-built workflow template for common automation patterns."""

    __tablename__ = "crm_workflow_templates"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # sales, marketing, support, onboarding
    workflow_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=True)
