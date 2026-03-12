"""Supply Chain Ops models — control tower, RFx, risks, replenishment, workflows, compliance, ESG."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# ── Control Tower ────────────────────────────────────────────────────────────

class ControlTowerAlert(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Real-time supply chain alert — delay, stockout, quality, cost overrun."""

    __tablename__ = "sc_control_tower_alerts"

    alert_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # delay, stockout, quality, demand_spike, cost_overrun
    severity: Mapped[str] = mapped_column(
        String(20), default="medium"
    )  # low, medium, high, critical
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_module: Mapped[str | None] = mapped_column(String(30), nullable=True)
    source_entity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default="open"
    )  # open, acknowledged, resolved, dismissed
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class SupplyChainKPI(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Calculated KPI metric for a period — OTIF, lead time, turns, etc."""

    __tablename__ = "sc_kpis"

    kpi_name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # otif_rate, lead_time_avg, inventory_turns, fill_rate, cost_to_serve
    period: Mapped[str] = mapped_column(String(20), nullable=False)  # e.g. "2026-03"
    value: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    target: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    unit: Mapped[str] = mapped_column(
        String(20), default="ratio"
    )  # percent, days, ratio, currency
    dimension: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # e.g. supplier_id, warehouse_id
    dimension_value: Mapped[str | None] = mapped_column(String(200), nullable=True)


class SupplyChainEvent(UUIDPrimaryKeyMixin, Base):
    """Timestamped supply chain event for the control tower timeline."""

    __tablename__ = "sc_events"

    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String(20), default="info")  # info, warn, error
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# ── RFx (Request for Quote / Proposal / Information) ────────────────────────

class RFx(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Request for Quote / Proposal / Information sent to suppliers."""

    __tablename__ = "sc_rfx"

    rfx_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    rfx_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # rfq, rfp, rfi
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(30), default="draft"
    )  # draft, published, closed, awarded, cancelled
    deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    items: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # requested items/quantities
    invited_suppliers: Mapped[list[str] | None] = mapped_column(
        ARRAY(String), nullable=True
    )  # supplier IDs as strings

    responses = relationship(
        "RFxResponse", back_populates="rfx", cascade="all, delete-orphan"
    )


class RFxResponse(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Supplier response to an RFx with quoted pricing."""

    __tablename__ = "sc_rfx_responses"

    rfx_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_rfx.id"), nullable=False
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_suppliers.id"), nullable=False
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), default="submitted"
    )  # submitted, under_review, shortlisted, rejected, awarded
    quoted_items: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    total_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    lead_time_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)

    rfx = relationship("RFx", back_populates="responses")
    supplier = relationship("Supplier", foreign_keys=[supplier_id])


# ── Supplier Risk ────────────────────────────────────────────────────────────

class SupplierRisk(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Risk record for a supplier — financial, geopolitical, ESG, etc."""

    __tablename__ = "sc_supplier_risks"

    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_suppliers.id"), nullable=False
    )
    risk_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # financial, geopolitical, esg, operational, compliance
    severity: Mapped[str] = mapped_column(
        String(20), default="medium"
    )  # low, medium, high, critical
    description: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # manual, ai_detected
    mitigation_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="active"
    )  # active, mitigated, closed
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    supplier = relationship("Supplier", foreign_keys=[supplier_id])


# ── Replenishment & Inventory Optimization ───────────────────────────────────

class ReplenishmentRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Auto-replenishment rule for an item at a warehouse."""

    __tablename__ = "sc_replenishment_rules"

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False
    )
    rule_type: Mapped[str] = mapped_column(
        String(20), default="reorder_point"
    )  # min_max, reorder_point, periodic
    min_level: Mapped[int] = mapped_column(Integer, default=0)
    max_level: Mapped[int] = mapped_column(Integer, default=0)
    reorder_point: Mapped[int] = mapped_column(Integer, default=0)
    reorder_quantity: Mapped[int] = mapped_column(Integer, default=0)
    lead_time_days: Mapped[int] = mapped_column(Integer, default=7)
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_suppliers.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    auto_generate_po: Mapped[bool] = mapped_column(Boolean, default=False)
    last_triggered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    item = relationship("InventoryItem", foreign_keys=[item_id])
    warehouse = relationship("Warehouse", foreign_keys=[warehouse_id])
    supplier = relationship("Supplier", foreign_keys=[supplier_id])


class SafetyStockConfig(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Safety stock calculation config per item/warehouse."""

    __tablename__ = "sc_safety_stock_configs"

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False
    )
    method: Mapped[str] = mapped_column(
        String(30), default="static"
    )  # static, demand_variability, service_level
    safety_stock_qty: Mapped[int] = mapped_column(Integer, default=0)
    service_level_pct: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2), nullable=True
    )
    demand_std_dev: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    lead_time_std_dev: Mapped[Decimal | None] = mapped_column(
        Numeric(8, 2), nullable=True
    )
    recalculated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    item = relationship("InventoryItem", foreign_keys=[item_id])
    warehouse = relationship("Warehouse", foreign_keys=[warehouse_id])


class StockHealthScore(UUIDPrimaryKeyMixin, Base):
    """Computed stock health classification for an item."""

    __tablename__ = "sc_stock_health_scores"

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    warehouse_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=True
    )
    health_status: Mapped[str] = mapped_column(
        String(20), default="healthy"
    )  # healthy, slow_moving, obsolete, overstock, understock
    days_of_stock: Mapped[int] = mapped_column(Integer, default=0)
    turnover_rate: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    last_movement_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    recommended_action: Mapped[str] = mapped_column(
        String(50), default="none"
    )  # none, markdown, liquidate, reorder, transfer
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    item = relationship("InventoryItem", foreign_keys=[item_id])
    warehouse = relationship("Warehouse", foreign_keys=[warehouse_id])


# ── Workflow Automation ──────────────────────────────────────────────────────

class SCWorkflowTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """No-code workflow template — trigger event → ordered action steps."""

    __tablename__ = "sc_workflow_templates"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    trigger_event: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # e.g. "crm.deal.won", "inventory.stock_below_reorder"
    steps: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # ordered step defs
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    runs = relationship("WorkflowRun", back_populates="template")


class WorkflowRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Execution instance of a workflow template."""

    __tablename__ = "sc_workflow_runs"

    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_workflow_templates.id"), nullable=False
    )
    trigger_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="running"
    )  # running, completed, failed, cancelled
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    template = relationship("SCWorkflowTemplate", back_populates="runs")
    steps = relationship(
        "WorkflowStep", back_populates="run", cascade="all, delete-orphan"
    )


class WorkflowStep(UUIDPrimaryKeyMixin, Base):
    """Individual step within a workflow run."""

    __tablename__ = "sc_workflow_steps"

    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_workflow_runs.id"), nullable=False
    )
    step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    action: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # reserve_inventory, create_po, create_project, send_notification
    params: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending, running, completed, failed, skipped
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    run = relationship("WorkflowRun", back_populates="steps")


# ── Compliance & ESG ─────────────────────────────────────────────────────────

class ComplianceRecord(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Compliance status for a supplier, shipment, or product."""

    __tablename__ = "sc_compliance_records"

    entity_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # supplier, shipment, product
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    compliance_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # regulatory, iso, customs, sanction
    status: Mapped[str] = mapped_column(
        String(20), default="pending_review"
    )  # compliant, non_compliant, pending_review, expired
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class ESGMetric(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Environmental, Social & Governance metric for a supplier or period."""

    __tablename__ = "sc_esg_metrics"

    supplier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_suppliers.id"), nullable=True
    )
    metric_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # carbon_footprint, water_usage, waste, labor_practices, diversity
    period: Mapped[str] = mapped_column(String(20), nullable=False)  # e.g. "2026-Q1"
    value: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    unit: Mapped[str] = mapped_column(String(30), nullable=False)
    benchmark: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)

    supplier = relationship("Supplier", foreign_keys=[supplier_id])
