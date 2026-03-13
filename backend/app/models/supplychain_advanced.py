"""supplychain_advanced.py — Supply Chain Phase 2 Risk/MRP models.

Models:
  - RiskAssessment    — identified supply chain risk event
  - RiskScenario      — what-if scenario for a risk
  - MitigationPlan    — action plan to address a risk
  - ProductionSchedule — planned production run from MRP
  - MRPRun            — Material Requirements Planning execution record
  - MRPLine           — individual line item from an MRP run (demand/supply)
"""
from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


# ── RiskAssessment ────────────────────────────────────────────────────────────
class RiskAssessment(Base):
    __tablename__ = "sc_risk_assessments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    risk_category: Mapped[str] = mapped_column(sa.String(50), nullable=False)
    # supplier | logistics | demand | geopolitical | weather | quality | cyber | financial
    risk_level: Mapped[str] = mapped_column(sa.String(20), nullable=False, default="medium")
    # low | medium | high | critical
    probability: Mapped[float | None] = mapped_column(sa.Float, nullable=True)  # 0.0 - 1.0
    impact_score: Mapped[float | None] = mapped_column(sa.Float, nullable=True)  # 0-10
    risk_score: Mapped[float | None] = mapped_column(sa.Float, nullable=True)    # probability * impact
    # Affected entities
    affected_supplier_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    affected_product_ids: Mapped[list | None] = mapped_column(sa.JSON, nullable=True)
    affected_routes: Mapped[list | None] = mapped_column(sa.JSON, nullable=True)
    # Timeline
    identified_date: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    expected_impact_start: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    expected_impact_end: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    # Status
    status: Mapped[str] = mapped_column(sa.String(30), nullable=False, default="open")
    # open | monitoring | mitigated | closed
    owner_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )


# ── RiskScenario ──────────────────────────────────────────────────────────────
class RiskScenario(Base):
    __tablename__ = "sc_risk_scenarios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    risk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_risk_assessments.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    scenario_type: Mapped[str] = mapped_column(sa.String(30), nullable=False, default="pessimistic")
    # optimistic | base | pessimistic
    assumptions: Mapped[dict | None] = mapped_column(sa.JSON, nullable=True)
    # {"demand_drop_pct": 20, "lead_time_increase_days": 5}
    projected_cost_impact: Mapped[float | None] = mapped_column(sa.Numeric(15, 2), nullable=True)
    projected_revenue_impact: Mapped[float | None] = mapped_column(sa.Numeric(15, 2), nullable=True)
    projected_delay_days: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    simulation_results: Mapped[dict | None] = mapped_column(sa.JSON, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )


# ── MitigationPlan ────────────────────────────────────────────────────────────
class MitigationPlan(Base):
    __tablename__ = "sc_mitigation_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    risk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_risk_assessments.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    strategy: Mapped[str] = mapped_column(sa.String(30), nullable=False, default="mitigate")
    # avoid | transfer | mitigate | accept
    actions: Mapped[list | None] = mapped_column(sa.JSON, nullable=True)
    # [{action, owner_id, due_date, status}]
    estimated_cost: Mapped[float | None] = mapped_column(sa.Numeric(15, 2), nullable=True)
    effectiveness_score: Mapped[float | None] = mapped_column(sa.Float, nullable=True)  # 0-10
    status: Mapped[str] = mapped_column(sa.String(30), nullable=False, default="planned")
    # planned | in_progress | completed | cancelled
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )


# ── MRPRun ────────────────────────────────────────────────────────────────────
class MRPRun(Base):
    """Material Requirements Planning execution — triggers BOM explosion."""

    __tablename__ = "sc_mrp_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    run_type: Mapped[str] = mapped_column(sa.String(30), nullable=False, default="regenerative")
    # regenerative | net_change
    planning_horizon_days: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=90)
    bucket_size: Mapped[str] = mapped_column(sa.String(10), nullable=False, default="week")
    # day | week | month
    # Scope filters
    product_ids: Mapped[list | None] = mapped_column(sa.JSON, nullable=True)  # null = all products
    warehouse_ids: Mapped[list | None] = mapped_column(sa.JSON, nullable=True)
    # Run metadata
    status: Mapped[str] = mapped_column(sa.String(30), nullable=False, default="pending")
    # pending | running | completed | failed
    started_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    # Summary stats
    total_demand_lines: Mapped[int] = mapped_column(sa.Integer, default=0)
    planned_orders_count: Mapped[int] = mapped_column(sa.Integer, default=0)
    exceptions_count: Mapped[int] = mapped_column(sa.Integer, default=0)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())


# ── MRPLine ───────────────────────────────────────────────────────────────────
class MRPLine(Base):
    """Individual demand/supply line from an MRP run."""

    __tablename__ = "sc_mrp_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mrp_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_mrp_runs.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    product_sku: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    product_name: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    # Period bucket
    period_start: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
    # Quantities
    gross_demand: Mapped[float] = mapped_column(sa.Numeric(15, 4), nullable=False, default=0)
    scheduled_receipts: Mapped[float] = mapped_column(sa.Numeric(15, 4), nullable=False, default=0)
    projected_inventory: Mapped[float] = mapped_column(sa.Numeric(15, 4), nullable=False, default=0)
    net_demand: Mapped[float] = mapped_column(sa.Numeric(15, 4), nullable=False, default=0)
    planned_order_qty: Mapped[float] = mapped_column(sa.Numeric(15, 4), nullable=False, default=0)
    # Source of demand
    demand_source_type: Mapped[str | None] = mapped_column(sa.String(50), nullable=True)
    # sales_order | forecast | safety_stock | dependent
    demand_source_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    # Suggested action
    action_type: Mapped[str | None] = mapped_column(sa.String(30), nullable=True)
    # new_po | reschedule | cancel | expedite | none
    action_details: Mapped[dict | None] = mapped_column(sa.JSON, nullable=True)
    exception_message: Mapped[str | None] = mapped_column(sa.String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())


# ── ProductionSchedule ────────────────────────────────────────────────────────
class ProductionSchedule(Base):
    """A planned production run derived from MRP output."""

    __tablename__ = "sc_production_schedules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mrp_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_mrp_runs.id", ondelete="SET NULL"), nullable=True
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    product_sku: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    product_name: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    # Quantities
    planned_qty: Mapped[float] = mapped_column(sa.Numeric(15, 4), nullable=False)
    confirmed_qty: Mapped[float | None] = mapped_column(sa.Numeric(15, 4), nullable=True)
    completed_qty: Mapped[float | None] = mapped_column(sa.Numeric(15, 4), nullable=True)
    # Resource assignment
    work_center: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    # Dates
    planned_start: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
    planned_end: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
    actual_start: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    actual_end: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    # Status
    status: Mapped[str] = mapped_column(sa.String(30), nullable=False, default="planned")
    # planned | confirmed | in_progress | completed | cancelled
    priority: Mapped[int] = mapped_column(sa.Integer, default=5)  # 1=highest, 10=lowest
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )
