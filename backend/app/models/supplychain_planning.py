"""Supply Chain Planning models — demand forecasting, S&OP, supply plans, capacity."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
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


# ── ForecastScenario ─────────────────────────────────────────────────────────
class ForecastScenario(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A named set of assumptions for what-if demand forecasting."""

    __tablename__ = "sc_forecast_scenarios"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, active, archived
    assumptions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    forecasts = relationship("DemandForecast", back_populates="scenario")


# ── DemandForecast ───────────────────────────────────────────────────────────
class DemandForecast(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Predicted demand for an item in a period — generated or manual."""

    __tablename__ = "sc_demand_forecasts"

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    warehouse_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=True
    )
    forecast_date: Mapped[date] = mapped_column(Date, nullable=False)
    period_type: Mapped[str] = mapped_column(
        String(20), default="monthly"
    )  # daily, weekly, monthly
    predicted_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence_lower: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confidence_upper: Mapped[int | None] = mapped_column(Integer, nullable=True)
    method: Mapped[str] = mapped_column(
        String(30), default="moving_avg"
    )  # moving_avg, linear_trend, ml_model, consensus
    scenario_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_forecast_scenarios.id"), nullable=True
    )
    source_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    item = relationship("InventoryItem", foreign_keys=[item_id])
    warehouse = relationship("Warehouse", foreign_keys=[warehouse_id])
    scenario = relationship("ForecastScenario", back_populates="forecasts")


# ── DemandSignal ─────────────────────────────────────────────────────────────
class DemandSignal(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """External demand signal from CRM deals, promotions, or market data."""

    __tablename__ = "sc_demand_signals"

    signal_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # crm_deal, seasonal, market_trend, promo, manual
    item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=True
    )
    source_module: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # crm, ecommerce, manual
    source_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    impact_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    impact_start_date: Mapped[date] = mapped_column(Date, nullable=False)
    impact_end_date: Mapped[date] = mapped_column(Date, nullable=False)
    confidence: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=0.5)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    item = relationship("InventoryItem", foreign_keys=[item_id])


# ── SalesOperationsPlan ──────────────────────────────────────────────────────
class SalesOperationsPlan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """S&OP cycle — monthly or weekly demand/supply alignment."""

    __tablename__ = "sc_sop_plans"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    cycle_type: Mapped[str] = mapped_column(
        String(20), default="monthly"
    )  # monthly, weekly
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), default="draft"
    )  # draft, in_review, approved, closed
    demand_summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    supply_summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    supply_plans = relationship("SupplyPlan", back_populates="sop")
    capacity_plans = relationship("CapacityPlan", back_populates="sop")


# ── SupplyPlan ───────────────────────────────────────────────────────────────
class SupplyPlan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Generated supply plan — maps forecast demand to supplier POs."""

    __tablename__ = "sc_supply_plans"

    sop_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_sop_plans.id"), nullable=True
    )
    forecast_scenario_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_forecast_scenarios.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, active, superseded
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    plan_horizon_days: Mapped[int] = mapped_column(Integer, default=90)

    sop = relationship("SalesOperationsPlan", back_populates="supply_plans")
    scenario = relationship("ForecastScenario", foreign_keys=[forecast_scenario_id])
    lines = relationship(
        "SupplyPlanLine", back_populates="plan", cascade="all, delete-orphan"
    )


# ── SupplyPlanLine ───────────────────────────────────────────────────────────
class SupplyPlanLine(UUIDPrimaryKeyMixin, Base):
    """Single line on a supply plan — one item from one supplier."""

    __tablename__ = "sc_supply_plan_lines"

    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_supply_plans.id"), nullable=False
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_suppliers.id"), nullable=True
    )
    planned_order_date: Mapped[date] = mapped_column(Date, nullable=False)
    planned_delivery_date: Mapped[date] = mapped_column(Date, nullable=False)
    planned_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    estimated_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    status: Mapped[str] = mapped_column(
        String(20), default="planned"
    )  # planned, ordered, received

    plan = relationship("SupplyPlan", back_populates="lines")
    item = relationship("InventoryItem", foreign_keys=[item_id])
    supplier = relationship("Supplier", foreign_keys=[supplier_id])


# ── CapacityPlan ─────────────────────────────────────────────────────────────
class CapacityPlan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Capacity requirement for a resource during an S&OP period."""

    __tablename__ = "sc_capacity_plans"

    sop_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_sop_plans.id"), nullable=True
    )
    resource_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # warehouse, transport, labor
    resource_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    available_capacity: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    required_capacity: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    utilization_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    constraints: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    sop = relationship("SalesOperationsPlan", back_populates="capacity_plans")
