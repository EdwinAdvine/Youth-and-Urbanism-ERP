"""HR Phase 3 models — AI Intelligence, Workflows, People Analytics."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# ---------------------------------------------------------------------------
# Skill Ontology — Canonical skill taxonomy
# ---------------------------------------------------------------------------


class SkillOntology(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Canonical skill taxonomy node with optional parent/child hierarchy."""

    __tablename__ = "hr_skill_ontology"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_skill_ontology.id"), nullable=True
    )
    aliases: Mapped[list | None] = mapped_column(
        JSON, nullable=True
    )  # list of strings — alternate names / synonyms
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    parent = relationship(
        "SkillOntology", back_populates="children", remote_side="SkillOntology.id", lazy="selectin"
    )
    children = relationship(
        "SkillOntology", back_populates="parent", lazy="selectin"
    )


# ---------------------------------------------------------------------------
# AI Predictive Intelligence — Flight Risk & Burnout
# ---------------------------------------------------------------------------


class FlightRiskScore(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """AI-calculated flight-risk score for an employee."""

    __tablename__ = "hr_flight_risk_scores"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    score: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False
    )  # 0.00 – 100.00
    risk_level: Mapped[str] = mapped_column(
        String(20), default="medium"
    )  # low, medium, high, critical
    factors: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )  # {tenure_risk, satisfaction_risk, market_risk, performance_risk, workload_risk}
    recommendations: Mapped[list | None] = mapped_column(
        JSON, nullable=True
    )  # list of action strings
    model_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    employee = relationship("Employee", lazy="selectin")


class BurnoutIndicator(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """AI-calculated burnout risk indicators for an employee."""

    __tablename__ = "hr_burnout_indicators"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    risk_score: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False
    )  # 0.00 – 100.00
    risk_level: Mapped[str] = mapped_column(
        String(20), default="low"
    )  # low, medium, high, critical
    overtime_hours_30d: Mapped[Decimal | None] = mapped_column(
        Numeric(6, 2), nullable=True
    )
    leave_days_taken_90d: Mapped[int | None] = mapped_column(Integer, nullable=True)
    consecutive_work_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sentiment_trend: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # improving, stable, declining
    factors: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    recommendations: Mapped[list | None] = mapped_column(JSON, nullable=True)
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    employee = relationship("Employee", lazy="selectin")


# ---------------------------------------------------------------------------
# HR Workflow Automation
# ---------------------------------------------------------------------------


class Workflow(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Configurable HR automation workflow definition."""

    __tablename__ = "hr_workflows"

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    trigger_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # employee_created, status_changed, date_based, manual, goal_completed, review_submitted
    trigger_config: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )  # conditions for trigger evaluation
    steps: Mapped[list | None] = mapped_column(
        JSON, nullable=True
    )  # [{id, type, config, next_step_id}, ...]
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_template: Mapped[bool] = mapped_column(Boolean, default=False)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    last_run_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    run_count: Mapped[int] = mapped_column(Integer, default=0)

    executions = relationship("WorkflowExecution", back_populates="workflow", lazy="noload")


class WorkflowExecution(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A single execution run of a workflow."""

    __tablename__ = "hr_workflow_executions"

    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_workflows.id"), nullable=False
    )
    triggered_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    trigger_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(
        String(30), default="running"
    )  # running, completed, failed, paused, cancelled
    current_step_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    steps_completed: Mapped[list | None] = mapped_column(
        JSON, nullable=True
    )  # list of step result objects
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    workflow = relationship("Workflow", back_populates="executions")
    approvals = relationship("WorkflowApproval", back_populates="execution", lazy="selectin")


class WorkflowApproval(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Human-approval gate within a workflow execution step."""

    __tablename__ = "hr_workflow_approvals"

    execution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_workflow_executions.id"), nullable=False
    )
    step_id: Mapped[str] = mapped_column(String(100), nullable=False)
    approver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending, approved, rejected
    decision_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    execution = relationship("WorkflowExecution", back_populates="approvals")


# ---------------------------------------------------------------------------
# People Analytics — Dashboards
# ---------------------------------------------------------------------------


class AnalyticsDashboard(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """User-owned HR analytics dashboard with configurable widget layout."""

    __tablename__ = "hr_analytics_dashboards"

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False)
    layout: Mapped[list | None] = mapped_column(
        JSON, nullable=True
    )  # [{id, type, title, config, position: {x, y, w, h}}, ...]
    widget_count: Mapped[int] = mapped_column(Integer, default=0)


# ---------------------------------------------------------------------------
# Workforce Planning — Scenario Modelling
# ---------------------------------------------------------------------------


class WorkforcePlanningScenario(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Workforce planning scenario with headcount and budget projections."""

    __tablename__ = "hr_workforce_scenarios"

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    fiscal_year: Mapped[int] = mapped_column(Integer, nullable=False)
    base_headcount: Mapped[int] = mapped_column(Integer, nullable=False)
    base_budget: Mapped[Decimal | None] = mapped_column(Numeric(16, 2), nullable=True)
    scenarios: Mapped[list | None] = mapped_column(
        JSON, nullable=True
    )  # [{name, growth_rate, attrition_rate, new_hires, projected_cost}, ...]
    assumptions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
