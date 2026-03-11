"""Manufacturing models — BOM, Work Orders, Workstations, Quality, Traceability, ECOs."""
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
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# ── Bill of Materials ────────────────────────────────────────────────────────
class BillOfMaterials(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Recipe / formula for producing a finished item."""

    __tablename__ = "mfg_bom"

    bom_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    finished_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    quantity_produced: Mapped[int] = mapped_column(Integer, default=1)
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    items = relationship("BOMItem", back_populates="bom", cascade="all, delete-orphan", foreign_keys="[BOMItem.bom_id]")
    finished_item = relationship("InventoryItem", foreign_keys=[finished_item_id])


# ── BOM Item (line) ──────────────────────────────────────────────────────────
class BOMItem(UUIDPrimaryKeyMixin, Base):
    """Single raw material / sub-assembly line on a BOM."""

    __tablename__ = "mfg_bom_items"

    bom_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_bom.id"), nullable=False
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    child_bom_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_bom.id"), nullable=True
    )
    quantity_required: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    unit_of_measure: Mapped[str] = mapped_column(String(50), default="unit")
    scrap_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_phantom: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    bom = relationship("BillOfMaterials", back_populates="items", foreign_keys=[bom_id])
    item = relationship("InventoryItem", foreign_keys=[item_id])
    child_bom = relationship("BillOfMaterials", foreign_keys=[child_bom_id])
    substitutions = relationship("MaterialSubstitution", back_populates="bom_item", cascade="all, delete-orphan")


# ── WorkStation ──────────────────────────────────────────────────────────────
class WorkStation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A machine or work centre on the shop floor."""

    __tablename__ = "mfg_workstations"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    capacity_per_hour: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    hourly_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    current_status: Mapped[str] = mapped_column(
        String(20), default="idle"
    )  # running, idle, maintenance, breakdown
    warehouse_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=True
    )

    warehouse = relationship("Warehouse", foreign_keys=[warehouse_id])


# ── Work Order ───────────────────────────────────────────────────────────────
class WorkOrder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Production work order."""

    __tablename__ = "mfg_work_orders"

    wo_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    bom_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_bom.id"), nullable=False
    )
    workstation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_workstations.id"), nullable=True
    )
    finished_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    planned_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    completed_quantity: Mapped[int] = mapped_column(Integer, default=0)
    rejected_quantity: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, planned, in_progress, completed, cancelled
    priority: Mapped[str] = mapped_column(
        String(10), default="medium"
    )  # low, medium, high
    planned_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    planned_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    target_warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False
    )
    source_warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False
    )
    total_material_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    total_labor_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    total_overhead_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    consumption_mode: Mapped[str] = mapped_column(String(20), default="manual")  # manual, backflush
    parent_wo_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_work_orders.id"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    bom = relationship("BillOfMaterials", foreign_keys=[bom_id])
    workstation = relationship("WorkStation", foreign_keys=[workstation_id])
    finished_item = relationship("InventoryItem", foreign_keys=[finished_item_id])
    target_warehouse = relationship("Warehouse", foreign_keys=[target_warehouse_id])
    source_warehouse = relationship("Warehouse", foreign_keys=[source_warehouse_id])
    parent_wo = relationship("WorkOrder", remote_side="WorkOrder.id", foreign_keys=[parent_wo_id])
    materials = relationship("MaterialConsumption", back_populates="work_order", cascade="all, delete-orphan")
    quality_checks = relationship("QualityCheck", back_populates="work_order", cascade="all, delete-orphan")
    variances = relationship("WorkOrderVariance", back_populates="work_order", cascade="all, delete-orphan")
    rework_orders = relationship("ReworkOrder", back_populates="parent_wo", foreign_keys="[ReworkOrder.parent_wo_id]")


# ── Material Consumption ─────────────────────────────────────────────────────
class MaterialConsumption(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Tracks raw material consumed by a work order."""

    __tablename__ = "mfg_material_consumption"

    work_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_work_orders.id"), nullable=False
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    planned_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    actual_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=0)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False
    )
    stock_movement_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_stock_movements.id"), nullable=True
    )
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    work_order = relationship("WorkOrder", back_populates="materials")
    item = relationship("InventoryItem", foreign_keys=[item_id])
    warehouse = relationship("Warehouse", foreign_keys=[warehouse_id])


# ── Quality Check ────────────────────────────────────────────────────────────
class QualityCheck(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Quality inspection record for a work order."""

    __tablename__ = "mfg_quality_checks"

    check_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    work_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_work_orders.id"), nullable=False
    )
    inspector_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    quantity_inspected: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_passed: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_failed: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending, passed, failed, partial
    parameters: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    work_order = relationship("WorkOrder", back_populates="quality_checks")
    inspector = relationship("User", foreign_keys=[inspector_id])


# ── Routing Step ────────────────────────────────────────────────────────────
class RoutingStep(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A single operation/step in a production routing for a BOM."""

    __tablename__ = "mfg_routing_steps"

    bom_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_bom.id"), nullable=False
    )
    workstation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_workstations.id"), nullable=False
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    operation: Mapped[str] = mapped_column(String(300), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    required_skill: Mapped[str | None] = mapped_column(String(100), nullable=True)
    min_operators: Mapped[int] = mapped_column(Integer, default=1)
    work_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    instruction_media: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    barcode_scan_required: Mapped[bool] = mapped_column(Boolean, default=False)

    bom = relationship("BillOfMaterials", foreign_keys=[bom_id])
    workstation = relationship("WorkStation", foreign_keys=[workstation_id])


# ── Scrap Entry ─────────────────────────────────────────────────────────────
class ScrapEntry(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Records scrapped / wasted items from a work order."""

    __tablename__ = "mfg_scrap_entries"

    work_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_work_orders.id"), nullable=False
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)

    work_order = relationship("WorkOrder", foreign_keys=[work_order_id])


# ── Maintenance Schedule ────────────────────────────────────────────────────
class MaintenanceSchedule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Scheduled maintenance for a workstation."""

    __tablename__ = "mfg_maintenance_schedules"

    workstation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_workstations.id"), nullable=False
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    frequency: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # daily, weekly, monthly
    next_date: Mapped[date] = mapped_column(Date, nullable=False)
    last_completed: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    trigger_type: Mapped[str] = mapped_column(
        String(20), default="calendar"
    )  # calendar, hours, cycles
    trigger_threshold: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_assets.id"), nullable=True
    )

    workstation = relationship("WorkStation", foreign_keys=[workstation_id])


# ── Quality Control ─────────────────────────────────────────────────────────
class QualityControl(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Quality control test record for a work order."""

    __tablename__ = "mfg_quality_control"

    work_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_work_orders.id"), nullable=False
    )
    test_name: Mapped[str] = mapped_column(String(300), nullable=False)
    result: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # pass, fail
    inspector_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    work_order = relationship("WorkOrder", foreign_keys=[work_order_id])
    inspector = relationship("User", foreign_keys=[inspector_id])


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 1 — ECOs, Substitutions, Variance, Rework, Quality, Traceability
# ══════════════════════════════════════════════════════════════════════════════


# ── Engineering Change Order ────────────────────────────────────────────────
class EngineeringChangeOrder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Engineering Change Order for BOM revisions."""

    __tablename__ = "mfg_engineering_change_orders"

    eco_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    bom_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_bom.id"), nullable=False
    )
    change_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # revision, new_version, obsolete
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, submitted, under_review, approved, rejected, implemented
    priority: Mapped[str] = mapped_column(String(10), default="medium")
    requested_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    implemented_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    impact_analysis: Mapped[str | None] = mapped_column(Text, nullable=True)
    affected_items: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    new_bom_version: Mapped[int | None] = mapped_column(Integer, nullable=True)

    bom = relationship("BillOfMaterials", foreign_keys=[bom_id])
    requester = relationship("User", foreign_keys=[requested_by])
    approver = relationship("User", foreign_keys=[approved_by])
    approvals = relationship("ECOApproval", back_populates="eco", cascade="all, delete-orphan")


# ── ECO Approval ──────────────────────────────────────────────────────────
class ECOApproval(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Individual approval step for an ECO."""

    __tablename__ = "mfg_eco_approvals"

    eco_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_engineering_change_orders.id"), nullable=False
    )
    approver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    decision: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending, approved, rejected
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sequence: Mapped[int] = mapped_column(Integer, default=0)

    eco = relationship("EngineeringChangeOrder", back_populates="approvals")
    approver = relationship("User", foreign_keys=[approver_id])


# ── Material Substitution ─────────────────────────────────────────────────
class MaterialSubstitution(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Alternate material for a BOM item."""

    __tablename__ = "mfg_material_substitutions"

    bom_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_bom_items.id"), nullable=False
    )
    substitute_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    priority: Mapped[int] = mapped_column(Integer, default=1)
    conversion_factor: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)

    bom_item = relationship("BOMItem", back_populates="substitutions")
    substitute_item = relationship("InventoryItem", foreign_keys=[substitute_item_id])


# ── Work Order Variance ──────────────────────────────────────────────────
class WorkOrderVariance(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Planned vs actual variance for a work order."""

    __tablename__ = "mfg_wo_variances"

    work_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_work_orders.id"), nullable=False
    )
    variance_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # material, labor, time
    planned_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    actual_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    variance_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    variance_percent: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    work_order = relationship("WorkOrder", back_populates="variances")


# ── Rework Order ────────────────────────────────────────────────────────
class ReworkOrder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Rework order spawned from a quality failure."""

    __tablename__ = "mfg_rework_orders"

    rework_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    parent_wo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_work_orders.id"), nullable=False
    )
    child_wo_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_work_orders.id"), nullable=True
    )
    quality_check_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_quality_checks.id"), nullable=True
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending, in_progress, completed
    rework_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    parent_wo = relationship("WorkOrder", back_populates="rework_orders", foreign_keys=[parent_wo_id])
    child_wo = relationship("WorkOrder", foreign_keys=[child_wo_id])
    quality_check = relationship("QualityCheck", foreign_keys=[quality_check_id])
    creator = relationship("User", foreign_keys=[created_by])


# ── Inspection Plan ─────────────────────────────────────────────────────
class InspectionPlan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Template for quality inspection checklists."""

    __tablename__ = "mfg_inspection_plans"

    plan_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    bom_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_bom.id"), nullable=True
    )
    routing_step_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_routing_steps.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    bom = relationship("BillOfMaterials", foreign_keys=[bom_id])
    routing_step = relationship("RoutingStep", foreign_keys=[routing_step_id])
    items = relationship("InspectionPlanItem", back_populates="plan", cascade="all, delete-orphan")


# ── Inspection Plan Item ───────────────────────────────────────────────
class InspectionPlanItem(UUIDPrimaryKeyMixin, Base):
    """Single check item in an inspection plan."""

    __tablename__ = "mfg_inspection_plan_items"

    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_inspection_plans.id"), nullable=False
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    parameter_name: Mapped[str] = mapped_column(String(200), nullable=False)
    measurement_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # numeric, visual, boolean, text
    target_value: Mapped[str | None] = mapped_column(String(100), nullable=True)
    lower_limit: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    upper_limit: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    unit_of_measure: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_critical: Mapped[bool] = mapped_column(Boolean, default=False)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    sample_size: Mapped[int] = mapped_column(Integer, default=1)

    plan = relationship("InspectionPlan", back_populates="items")


# ── Non-Conformance Report ─────────────────────────────────────────────
class NonConformanceReport(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Records quality non-conformances for investigation."""

    __tablename__ = "mfg_non_conformance_reports"

    ncr_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_work_orders.id"), nullable=True
    )
    quality_check_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_quality_checks.id"), nullable=True
    )
    item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=True
    )
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_suppliers.id"), nullable=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # minor, major, critical
    status: Mapped[str] = mapped_column(
        String(20), default="open"
    )  # open, investigating, resolved, closed
    quantity_affected: Mapped[int] = mapped_column(Integer, default=0)
    root_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    disposition: Mapped[str | None] = mapped_column(
        String(30), nullable=True
    )  # rework, scrap, use_as_is, return_to_supplier
    reported_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    work_order = relationship("WorkOrder", foreign_keys=[work_order_id])
    quality_check = relationship("QualityCheck", foreign_keys=[quality_check_id])
    item = relationship("InventoryItem", foreign_keys=[item_id])
    reporter = relationship("User", foreign_keys=[reported_by])
    assignee = relationship("User", foreign_keys=[assigned_to])
    capas = relationship("CAPA", back_populates="ncr", cascade="all, delete-orphan")


# ── CAPA (Corrective and Preventive Action) ───────────────────────────
class CAPA(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Corrective / Preventive Action linked to an NCR."""

    __tablename__ = "mfg_capa"

    capa_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    ncr_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_non_conformance_reports.id"), nullable=True
    )
    capa_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # corrective, preventive
    description: Mapped[str] = mapped_column(Text, nullable=False)
    root_cause_analysis: Mapped[str | None] = mapped_column(Text, nullable=True)
    corrective_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    preventive_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="open"
    )  # open, in_progress, verification, closed
    priority: Mapped[str] = mapped_column(String(10), default="medium")
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    effectiveness_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    ncr = relationship("NonConformanceReport", back_populates="capas")
    assignee = relationship("User", foreign_keys=[assigned_to])
    creator = relationship("User", foreign_keys=[created_by])


# ── SPC Data Point ────────────────────────────────────────────────────
class SPCDataPoint(UUIDPrimaryKeyMixin, Base):
    """Statistical Process Control measurement data point."""

    __tablename__ = "mfg_spc_data_points"

    inspection_plan_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_inspection_plan_items.id"), nullable=False
    )
    work_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_work_orders.id"), nullable=False
    )
    measured_value: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    measured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    sample_number: Mapped[int] = mapped_column(Integer, nullable=False)
    subgroup: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recorded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    is_out_of_control: Mapped[bool] = mapped_column(Boolean, default=False)

    inspection_plan_item = relationship("InspectionPlanItem", foreign_keys=[inspection_plan_item_id])
    work_order = relationship("WorkOrder", foreign_keys=[work_order_id])
    recorder = relationship("User", foreign_keys=[recorded_by])


# ── Lot / Serial Tracking ─────────────────────────────────────────────
class LotSerialTrack(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Lot or serial number tracking for traceability."""

    __tablename__ = "mfg_lot_serial_tracks"

    tracking_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    tracking_type: Mapped[str] = mapped_column(
        String(10), nullable=False
    )  # lot, serial
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_work_orders.id"), nullable=True
    )
    parent_tracking_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_lot_serial_tracks.id"), nullable=True
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=1)
    status: Mapped[str] = mapped_column(
        String(20), default="active"
    )  # active, consumed, shipped, recalled
    manufactured_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_suppliers.id"), nullable=True
    )
    grn_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_goods_received_notes.id"), nullable=True
    )
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    item = relationship("InventoryItem", foreign_keys=[item_id])
    work_order = relationship("WorkOrder", foreign_keys=[work_order_id])
    parent_tracking = relationship("LotSerialTrack", remote_side="LotSerialTrack.id", foreign_keys=[parent_tracking_id])
    children = relationship("LotSerialTrack", foreign_keys="[LotSerialTrack.parent_tracking_id]")
    events = relationship("TraceabilityEvent", back_populates="lot_serial", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by])


# ── Traceability Event ─────────────────────────────────────────────────
class TraceabilityEvent(UUIDPrimaryKeyMixin, Base):
    """Audit event for a lot/serial number."""

    __tablename__ = "mfg_traceability_events"

    lot_serial_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_lot_serial_tracks.id"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # created, consumed, produced, inspected, shipped, recalled
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_work_orders.id"), nullable=True
    )
    reference_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    reference_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    recorded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    lot_serial = relationship("LotSerialTrack", back_populates="events")
    work_order = relationship("WorkOrder", foreign_keys=[work_order_id])
    recorder = relationship("User", foreign_keys=[recorded_by])


# ── Electronic Batch Record ────────────────────────────────────────────
class ElectronicBatchRecord(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Electronic batch record for regulatory compliance."""

    __tablename__ = "mfg_batch_records"

    batch_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    work_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_work_orders.id"), nullable=False
    )
    bom_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_bom.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), default="in_progress"
    )  # in_progress, completed, reviewed, approved
    material_verification: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    process_parameters: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    quality_results: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    deviations: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    electronic_signature: Mapped[str | None] = mapped_column(String(200), nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    work_order = relationship("WorkOrder", foreign_keys=[work_order_id])
    bom = relationship("BillOfMaterials", foreign_keys=[bom_id])
    approver = relationship("User", foreign_keys=[approved_by])


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 2 — Planning, Equipment, Labor
# ══════════════════════════════════════════════════════════════════════════════


# ── Asset Register ────────────────────────────────────────────────────────
class AssetRegister(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Physical equipment / machine asset register."""

    __tablename__ = "mfg_assets"

    asset_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    workstation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_workstations.id"), nullable=True
    )
    asset_type: Mapped[str] = mapped_column(String(50), nullable=False)  # machine, tool, vehicle, etc.
    manufacturer: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    serial_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    purchase_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    warranty_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="active"
    )  # active, inactive, disposed, under_maintenance
    total_operating_hours: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    specifications: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    workstation = relationship("WorkStation", foreign_keys=[workstation_id])
    downtime_records = relationship("DowntimeRecord", back_populates="asset", cascade="all, delete-orphan")
    maintenance_work_orders = relationship("MaintenanceWorkOrder", back_populates="asset", cascade="all, delete-orphan")


# ── Downtime Record ───────────────────────────────────────────────────────
class DowntimeRecord(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Records machine/workstation downtime events."""

    __tablename__ = "mfg_downtime_records"

    workstation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_workstations.id"), nullable=False
    )
    asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_assets.id"), nullable=True
    )
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_work_orders.id"), nullable=True
    )
    downtime_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # planned, unplanned, changeover
    category: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # mechanical, electrical, operator, material, quality, other
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    root_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
    reported_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    workstation = relationship("WorkStation", foreign_keys=[workstation_id])
    asset = relationship("AssetRegister", back_populates="downtime_records")
    work_order = relationship("WorkOrder", foreign_keys=[work_order_id])
    reporter = relationship("User", foreign_keys=[reported_by])


# ── Maintenance Work Order ────────────────────────────────────────────────
class MaintenanceWorkOrder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Maintenance execution work order."""

    __tablename__ = "mfg_maintenance_work_orders"

    mwo_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_assets.id"), nullable=False
    )
    schedule_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_maintenance_schedules.id"), nullable=True
    )
    maintenance_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # preventive, corrective, predictive, emergency
    trigger_type: Mapped[str] = mapped_column(
        String(20), default="calendar"
    )  # calendar, hours, cycles, condition
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="open"
    )  # open, in_progress, completed, cancelled
    priority: Mapped[str] = mapped_column(String(10), default="medium")
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    planned_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    parts_used: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    labor_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    parts_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    completion_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    asset = relationship("AssetRegister", back_populates="maintenance_work_orders")
    schedule = relationship("MaintenanceSchedule", foreign_keys=[schedule_id])
    assignee = relationship("User", foreign_keys=[assigned_to])
    creator = relationship("User", foreign_keys=[created_by])


# ── Production Scenario ───────────────────────────────────────────────────
class ProductionScenario(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """What-if production planning scenario."""

    __tablename__ = "mfg_production_scenarios"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, running, completed, failed
    parameters: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    results: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    schedule_entries = relationship("ScheduleEntry", back_populates="scenario", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by])


# ── Capacity Slot ─────────────────────────────────────────────────────────
class CapacitySlot(UUIDPrimaryKeyMixin, Base):
    """Workstation capacity block for a shift/date."""

    __tablename__ = "mfg_capacity_slots"

    workstation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_workstations.id"), nullable=False
    )
    slot_date: Mapped[date] = mapped_column(Date, nullable=False)
    shift: Mapped[str] = mapped_column(String(20), nullable=False)  # morning, afternoon, night
    total_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    allocated_minutes: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(
        String(20), default="available"
    )  # available, partial, full, maintenance

    workstation = relationship("WorkStation", foreign_keys=[workstation_id])


# ── Schedule Entry ────────────────────────────────────────────────────────
class ScheduleEntry(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Single work order routing step schedule slot."""

    __tablename__ = "mfg_schedule_entries"

    work_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_work_orders.id"), nullable=False
    )
    routing_step_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_routing_steps.id"), nullable=True
    )
    workstation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_workstations.id"), nullable=False
    )
    scenario_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_production_scenarios.id"), nullable=True
    )
    scheduled_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    scheduled_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    actual_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="scheduled"
    )  # scheduled, in_progress, completed, skipped
    sequence: Mapped[int] = mapped_column(Integer, default=0)

    work_order = relationship("WorkOrder", foreign_keys=[work_order_id])
    routing_step = relationship("RoutingStep", foreign_keys=[routing_step_id])
    workstation = relationship("WorkStation", foreign_keys=[workstation_id])
    scenario = relationship("ProductionScenario", back_populates="schedule_entries")


# ── Operator Skill ────────────────────────────────────────────────────────
class OperatorSkill(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Employee skill/certification record for shop floor operations."""

    __tablename__ = "mfg_operator_skills"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    skill_name: Mapped[str] = mapped_column(String(100), nullable=False)
    proficiency_level: Mapped[str] = mapped_column(
        String(20), default="trainee"
    )  # trainee, operator, senior, expert
    certification_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    certified_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    creator = relationship("User", foreign_keys=[created_by])


# ── Crew Assignment ───────────────────────────────────────────────────────
class CrewAssignment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Assigns an employee to a work order / workstation for a shift."""

    __tablename__ = "mfg_crew_assignments"

    work_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_work_orders.id"), nullable=False
    )
    workstation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_workstations.id"), nullable=False
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    shift: Mapped[str] = mapped_column(String(20), nullable=False)  # morning, afternoon, night
    assignment_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    role: Mapped[str] = mapped_column(String(50), default="operator")  # operator, lead, supervisor
    hours_worked: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=0)
    timesheet_pushed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    work_order = relationship("WorkOrder", foreign_keys=[work_order_id])
    workstation = relationship("WorkStation", foreign_keys=[workstation_id])
    creator = relationship("User", foreign_keys=[created_by])


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 3 — MES / IoT, CPQ Configurator
# ══════════════════════════════════════════════════════════════════════════════


# ── IoT Data Point ────────────────────────────────────────────────────────
class IoTDataPoint(UUIDPrimaryKeyMixin, Base):
    """Real-time sensor / machine data point from a workstation or asset."""

    __tablename__ = "mfg_iot_data_points"

    workstation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_workstations.id"), nullable=True
    )
    asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_assets.id"), nullable=True
    )
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_work_orders.id"), nullable=True
    )
    metric_name: Mapped[str] = mapped_column(String(100), nullable=False)
    metric_value: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    unit: Mapped[str | None] = mapped_column(String(30), nullable=True)
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    workstation = relationship("WorkStation", foreign_keys=[workstation_id])


# ── CPQ Configurator Rule ─────────────────────────────────────────────────
class ConfiguratorRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Rule that drives CPQ configuration logic for a BOM."""

    __tablename__ = "mfg_configurator_rules"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    bom_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_bom.id"), nullable=False
    )
    rule_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # include, exclude, substitute, quantity_adjust
    condition: Mapped[dict] = mapped_column(JSON, nullable=False)
    action: Mapped[dict] = mapped_column(JSON, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    bom = relationship("BillOfMaterials", foreign_keys=[bom_id])
    creator = relationship("User", foreign_keys=[created_by])


# ── CPQ Configurator Session ──────────────────────────────────────────────
class ConfiguratorSession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Interactive CPQ session tracking user selections and computed BOM."""

    __tablename__ = "mfg_configurator_sessions"

    session_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    base_bom_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_bom.id"), nullable=False
    )
    selections: Mapped[dict] = mapped_column(JSON, default=dict)
    computed_bom_items: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    computed_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    status: Mapped[str] = mapped_column(
        String(20), default="active"
    )  # active, finalized, abandoned
    finalized_bom_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mfg_bom.id"), nullable=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    base_bom = relationship("BillOfMaterials", foreign_keys=[base_bom_id])
    finalized_bom = relationship("BillOfMaterials", foreign_keys=[finalized_bom_id])
    creator = relationship("User", foreign_keys=[created_by])
