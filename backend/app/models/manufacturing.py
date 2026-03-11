"""Manufacturing models — BOM, Work Orders, Workstations, Quality Checks."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

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
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    bom = relationship("BillOfMaterials", back_populates="items", foreign_keys=[bom_id])
    item = relationship("InventoryItem", foreign_keys=[item_id])
    child_bom = relationship("BillOfMaterials", foreign_keys=[child_bom_id])


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
    materials = relationship("MaterialConsumption", back_populates="work_order", cascade="all, delete-orphan")
    quality_checks = relationship("QualityCheck", back_populates="work_order", cascade="all, delete-orphan")


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
