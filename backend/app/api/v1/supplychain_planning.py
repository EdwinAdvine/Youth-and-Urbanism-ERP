"""Supply Chain Planning API — Demand Forecasting, S&OP, Supply Plans, Capacity."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.models.inventory import InventoryItem, StockMovement
from app.models.supplychain_planning import (
    CapacityPlan,
    DemandForecast,
    DemandSignal,
    ForecastScenario,
    SalesOperationsPlan,
    SupplyPlan,
    SupplyPlanLine,
)

router = APIRouter()


# ── Pydantic Schemas ─────────────────────────────────────────────────────────

# -- Demand Forecasts --

class ForecastCreate(BaseModel):
    item_id: uuid.UUID
    warehouse_id: uuid.UUID | None = None
    forecast_date: date
    period_type: str = "monthly"
    predicted_quantity: int
    confidence_lower: int | None = None
    confidence_upper: int | None = None
    method: str = "moving_avg"
    scenario_id: uuid.UUID | None = None
    source_data: dict | None = None


class ForecastOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    warehouse_id: uuid.UUID | None
    forecast_date: date
    period_type: str
    predicted_quantity: int
    confidence_lower: int | None
    confidence_upper: int | None
    method: str
    scenario_id: uuid.UUID | None
    source_data: dict | None
    created_by: uuid.UUID
    created_at: Any
    model_config = {"from_attributes": True}


class ForecastGenerateRequest(BaseModel):
    item_ids: list[uuid.UUID]
    horizon_months: int = 3
    method: str = "moving_avg"
    scenario_id: uuid.UUID | None = None
    period_type: str = "monthly"


class WhatIfRequest(BaseModel):
    scenario_id: uuid.UUID
    item_ids: list[uuid.UUID] | None = None
    horizon_months: int = 3


# -- Forecast Scenarios --

class ScenarioCreate(BaseModel):
    name: str
    description: str | None = None
    assumptions: dict | None = None


class ScenarioUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    assumptions: dict | None = None


class ScenarioOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    status: str
    assumptions: dict | None
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


# -- Demand Signals --

class DemandSignalCreate(BaseModel):
    signal_type: str
    item_id: uuid.UUID | None = None
    source_module: str = "manual"
    source_id: uuid.UUID | None = None
    impact_quantity: int
    impact_start_date: date
    impact_end_date: date
    confidence: Decimal = Decimal("0.5")
    metadata_json: dict | None = None


class DemandSignalOut(BaseModel):
    id: uuid.UUID
    signal_type: str
    item_id: uuid.UUID | None
    source_module: str
    source_id: uuid.UUID | None
    impact_quantity: int
    impact_start_date: date
    impact_end_date: date
    confidence: Any
    metadata_json: dict | None
    created_at: Any
    model_config = {"from_attributes": True}


# -- S&OP Plans --

class SOPCreate(BaseModel):
    title: str
    cycle_type: str = "monthly"
    period_start: date
    period_end: date
    demand_summary: dict | None = None
    supply_summary: dict | None = None
    notes: str | None = None


class SOPUpdate(BaseModel):
    title: str | None = None
    demand_summary: dict | None = None
    supply_summary: dict | None = None
    notes: str | None = None


class SOPOut(BaseModel):
    id: uuid.UUID
    title: str
    cycle_type: str
    period_start: date
    period_end: date
    status: str
    demand_summary: dict | None
    supply_summary: dict | None
    notes: str | None
    created_by: uuid.UUID
    approved_by: uuid.UUID | None
    approved_at: Any | None
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


# -- Supply Plans --

class SupplyPlanGenerateRequest(BaseModel):
    sop_id: uuid.UUID | None = None
    forecast_scenario_id: uuid.UUID | None = None
    plan_horizon_days: int = 90


class SupplyPlanLineUpdate(BaseModel):
    supplier_id: uuid.UUID | None = None
    planned_order_date: date | None = None
    planned_delivery_date: date | None = None
    planned_quantity: int | None = None
    estimated_cost: Decimal | None = None


class SupplyPlanLineOut(BaseModel):
    id: uuid.UUID
    plan_id: uuid.UUID
    item_id: uuid.UUID
    supplier_id: uuid.UUID | None
    planned_order_date: date
    planned_delivery_date: date
    planned_quantity: int
    estimated_cost: Any
    status: str
    model_config = {"from_attributes": True}


class SupplyPlanOut(BaseModel):
    id: uuid.UUID
    sop_id: uuid.UUID | None
    forecast_scenario_id: uuid.UUID | None
    status: str
    generated_at: Any
    plan_horizon_days: int
    created_at: Any
    model_config = {"from_attributes": True}


# -- Capacity Plans --

class CapacityPlanCreate(BaseModel):
    sop_id: uuid.UUID | None = None
    resource_type: str
    resource_id: uuid.UUID | None = None
    period_start: date
    period_end: date
    available_capacity: Decimal = Decimal("0")
    required_capacity: Decimal = Decimal("0")
    utilization_pct: Decimal = Decimal("0")
    constraints: dict | None = None


class CapacityPlanOut(BaseModel):
    id: uuid.UUID
    sop_id: uuid.UUID | None
    resource_type: str
    resource_id: uuid.UUID | None
    period_start: date
    period_end: date
    available_capacity: Any
    required_capacity: Any
    utilization_pct: Any
    constraints: dict | None
    created_at: Any
    model_config = {"from_attributes": True}


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _generate_forecasts_for_item(
    db: DBSession,
    item_id: uuid.UUID,
    user_id: uuid.UUID,
    horizon_months: int,
    method: str,
    period_type: str,
    scenario_id: uuid.UUID | None,
) -> list[DemandForecast]:
    """Generate simple forecasts using historical stock movements."""
    from datetime import timedelta

    # Get average monthly consumption from last 6 months
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    result = await db.execute(
        select(func.coalesce(func.sum(StockMovement.quantity), 0)).where(
            StockMovement.item_id == item_id,
            StockMovement.movement_type == "issue",
            StockMovement.created_at >= six_months_ago,
        )
    )
    total_issued = abs(result.scalar() or 0)
    avg_monthly = max(total_issued // 6, 1)

    forecasts = []
    today = datetime.utcnow().date()
    for m in range(horizon_months):
        forecast_dt = date(
            today.year + (today.month + m - 1) // 12,
            (today.month + m - 1) % 12 + 1,
            1,
        )
        fc = DemandForecast(
            item_id=item_id,
            forecast_date=forecast_dt,
            period_type=period_type,
            predicted_quantity=avg_monthly,
            confidence_lower=int(avg_monthly * 0.8),
            confidence_upper=int(avg_monthly * 1.2),
            method=method,
            scenario_id=scenario_id,
            source_data={"avg_monthly": avg_monthly, "total_issued_6m": total_issued},
            created_by=user_id,
        )
        db.add(fc)
        forecasts.append(fc)
    return forecasts


# ── Demand Forecast Endpoints ────────────────────────────────────────────────

@router.get("/forecasts", summary="List demand forecasts")
async def list_forecasts(
    current_user: CurrentUser,
    db: DBSession,
    item_id: uuid.UUID | None = Query(None),
    scenario_id: uuid.UUID | None = Query(None),
    period_type: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(DemandForecast)
    if item_id:
        query = query.where(DemandForecast.item_id == item_id)
    if scenario_id:
        query = query.where(DemandForecast.scenario_id == scenario_id)
    if period_type:
        query = query.where(DemandForecast.period_type == period_type)

    total = await db.execute(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(
        query.order_by(DemandForecast.forecast_date).offset(skip).limit(limit)
    )
    return {
        "total": total.scalar() or 0,
        "forecasts": [ForecastOut.model_validate(r) for r in rows.scalars().all()],
    }


@router.post(
    "/forecasts/generate",
    status_code=status.HTTP_201_CREATED,
    summary="Generate demand forecasts for items",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def generate_forecasts(
    payload: ForecastGenerateRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    all_forecasts: list[DemandForecast] = []
    for item_id in payload.item_ids:
        # Verify item exists
        item = await db.execute(
            select(InventoryItem).where(InventoryItem.id == item_id)
        )
        if not item.scalar_one_or_none():
            raise HTTPException(404, f"Inventory item {item_id} not found")
        forecasts = await _generate_forecasts_for_item(
            db, item_id, current_user.id,
            payload.horizon_months, payload.method,
            payload.period_type, payload.scenario_id,
        )
        all_forecasts.extend(forecasts)

    await db.commit()
    await event_bus.publish("supplychain.forecast.generated", {
        "item_count": len(payload.item_ids),
        "forecast_count": len(all_forecasts),
        "generated_by": str(current_user.id),
    })
    return {
        "generated": len(all_forecasts),
        "forecasts": [ForecastOut.model_validate(f) for f in all_forecasts],
    }


@router.get("/forecasts/{forecast_id}", summary="Get forecast detail")
async def get_forecast(
    forecast_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(DemandForecast).where(DemandForecast.id == forecast_id)
    )
    fc = result.scalar_one_or_none()
    if not fc:
        raise HTTPException(404, "Forecast not found")
    return ForecastOut.model_validate(fc).model_dump()


@router.delete(
    "/forecasts/{forecast_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_app_admin("supply_chain"))],
    response_model=None,
)
async def delete_forecast(
    forecast_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    result = await db.execute(
        select(DemandForecast).where(DemandForecast.id == forecast_id)
    )
    fc = result.scalar_one_or_none()
    if not fc:
        raise HTTPException(404, "Forecast not found")
    await db.delete(fc)
    await db.commit()


@router.post("/forecasts/what-if", summary="What-if scenario simulation")
async def what_if_simulation(
    payload: WhatIfRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Run what-if simulation — returns projected forecasts without persisting."""
    # Fetch scenario assumptions
    result = await db.execute(
        select(ForecastScenario).where(ForecastScenario.id == payload.scenario_id)
    )
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(404, "Scenario not found")

    growth_rate = (scenario.assumptions or {}).get("growth_rate", 0)

    # Get base forecasts (latest active or from items)
    query = select(DemandForecast).where(DemandForecast.scenario_id.is_(None))
    if payload.item_ids:
        query = query.where(DemandForecast.item_id.in_(payload.item_ids))
    query = query.order_by(DemandForecast.forecast_date).limit(100)
    rows = await db.execute(query)
    base_forecasts = rows.scalars().all()

    # Apply growth rate adjustment
    projections = []
    for fc in base_forecasts:
        adjusted_qty = int(fc.predicted_quantity * (1 + growth_rate / 100))
        projections.append({
            "item_id": str(fc.item_id),
            "forecast_date": fc.forecast_date.isoformat(),
            "base_quantity": fc.predicted_quantity,
            "adjusted_quantity": adjusted_qty,
            "growth_rate_applied": growth_rate,
        })

    return {
        "scenario": ScenarioOut.model_validate(scenario).model_dump(),
        "projections": projections,
        "total_projections": len(projections),
    }


# ── Forecast Scenario Endpoints ──────────────────────────────────────────────

@router.get("/forecast-scenarios", summary="List forecast scenarios")
async def list_scenarios(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(ForecastScenario)
    if status_filter:
        query = query.where(ForecastScenario.status == status_filter)
    total = await db.execute(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(
        query.order_by(ForecastScenario.created_at.desc()).offset(skip).limit(limit)
    )
    return {
        "total": total.scalar() or 0,
        "scenarios": [ScenarioOut.model_validate(r) for r in rows.scalars().all()],
    }


@router.post(
    "/forecast-scenarios",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def create_scenario(
    payload: ScenarioCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    scenario = ForecastScenario(
        name=payload.name,
        description=payload.description,
        assumptions=payload.assumptions,
        created_by=current_user.id,
    )
    db.add(scenario)
    await db.commit()
    await db.refresh(scenario)
    return {"id": str(scenario.id), "name": scenario.name}


@router.put(
    "/forecast-scenarios/{scenario_id}",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def update_scenario(
    scenario_id: uuid.UUID,
    payload: ScenarioUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(ForecastScenario).where(ForecastScenario.id == scenario_id)
    )
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(404, "Scenario not found")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(scenario, field, val)
    await db.commit()
    await db.refresh(scenario)
    return ScenarioOut.model_validate(scenario).model_dump()


# ── Demand Signal Endpoints ──────────────────────────────────────────────────

@router.get("/demand-signals", summary="List demand signals")
async def list_demand_signals(
    current_user: CurrentUser,
    db: DBSession,
    signal_type: str | None = Query(None),
    source_module: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(DemandSignal)
    if signal_type:
        query = query.where(DemandSignal.signal_type == signal_type)
    if source_module:
        query = query.where(DemandSignal.source_module == source_module)
    total = await db.execute(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(
        query.order_by(DemandSignal.created_at.desc()).offset(skip).limit(limit)
    )
    return {
        "total": total.scalar() or 0,
        "signals": [DemandSignalOut.model_validate(r) for r in rows.scalars().all()],
    }


@router.post(
    "/demand-signals",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def create_demand_signal(
    payload: DemandSignalCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    signal = DemandSignal(
        signal_type=payload.signal_type,
        item_id=payload.item_id,
        source_module=payload.source_module,
        source_id=payload.source_id,
        impact_quantity=payload.impact_quantity,
        impact_start_date=payload.impact_start_date,
        impact_end_date=payload.impact_end_date,
        confidence=payload.confidence,
        metadata_json=payload.metadata_json,
    )
    db.add(signal)
    await db.commit()
    await db.refresh(signal)
    return {"id": str(signal.id), "signal_type": signal.signal_type}


# ── S&OP Plan Endpoints ──────────────────────────────────────────────────────

@router.get("/sop-plans", summary="List S&OP cycles")
async def list_sop_plans(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(SalesOperationsPlan)
    if status_filter:
        query = query.where(SalesOperationsPlan.status == status_filter)
    total = await db.execute(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(
        query.order_by(SalesOperationsPlan.created_at.desc()).offset(skip).limit(limit)
    )
    return {
        "total": total.scalar() or 0,
        "sop_plans": [SOPOut.model_validate(r) for r in rows.scalars().all()],
    }


@router.post(
    "/sop-plans",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def create_sop_plan(
    payload: SOPCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    sop = SalesOperationsPlan(
        title=payload.title,
        cycle_type=payload.cycle_type,
        period_start=payload.period_start,
        period_end=payload.period_end,
        demand_summary=payload.demand_summary,
        supply_summary=payload.supply_summary,
        notes=payload.notes,
        created_by=current_user.id,
    )
    db.add(sop)
    await db.commit()
    await db.refresh(sop)
    return {"id": str(sop.id), "title": sop.title}


@router.get("/sop-plans/{sop_id}", summary="Get S&OP detail")
async def get_sop_plan(
    sop_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(SalesOperationsPlan).where(SalesOperationsPlan.id == sop_id)
    )
    sop = result.scalar_one_or_none()
    if not sop:
        raise HTTPException(404, "S&OP plan not found")
    return SOPOut.model_validate(sop).model_dump()


@router.put(
    "/sop-plans/{sop_id}",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def update_sop_plan(
    sop_id: uuid.UUID,
    payload: SOPUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(SalesOperationsPlan).where(SalesOperationsPlan.id == sop_id)
    )
    sop = result.scalar_one_or_none()
    if not sop:
        raise HTTPException(404, "S&OP plan not found")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(sop, field, val)
    await db.commit()
    await db.refresh(sop)
    return SOPOut.model_validate(sop).model_dump()


@router.post(
    "/sop-plans/{sop_id}/approve",
    dependencies=[Depends(require_app_admin("supply_chain"))],
    summary="Approve an S&OP cycle",
)
async def approve_sop_plan(
    sop_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(SalesOperationsPlan).where(SalesOperationsPlan.id == sop_id)
    )
    sop = result.scalar_one_or_none()
    if not sop:
        raise HTTPException(404, "S&OP plan not found")
    if sop.status not in ("draft", "in_review"):
        raise HTTPException(400, f"Cannot approve S&OP in status '{sop.status}'")
    sop.status = "approved"
    sop.approved_by = current_user.id
    sop.approved_at = datetime.utcnow()
    await db.commit()
    await event_bus.publish("supplychain.sop.approved", {
        "sop_id": str(sop.id),
        "approved_by": str(current_user.id),
    })
    return {"id": str(sop.id), "status": "approved"}


# ── Supply Plan Endpoints ────────────────────────────────────────────────────

@router.get("/supply-plans", summary="List supply plans")
async def list_supply_plans(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(SupplyPlan)
    if status_filter:
        query = query.where(SupplyPlan.status == status_filter)
    total = await db.execute(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(
        query.order_by(SupplyPlan.generated_at.desc()).offset(skip).limit(limit)
    )
    return {
        "total": total.scalar() or 0,
        "supply_plans": [SupplyPlanOut.model_validate(r) for r in rows.scalars().all()],
    }


@router.post(
    "/supply-plans/generate",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_app_admin("supply_chain"))],
    summary="Generate supply plan from forecasts",
)
async def generate_supply_plan(
    payload: SupplyPlanGenerateRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    plan = SupplyPlan(
        sop_id=payload.sop_id,
        forecast_scenario_id=payload.forecast_scenario_id,
        plan_horizon_days=payload.plan_horizon_days,
    )
    db.add(plan)
    await db.flush()

    # Fetch forecasts to build plan lines
    fc_query = select(DemandForecast)
    if payload.forecast_scenario_id:
        fc_query = fc_query.where(
            DemandForecast.scenario_id == payload.forecast_scenario_id
        )
    else:
        fc_query = fc_query.where(DemandForecast.scenario_id.is_(None))
    fc_query = fc_query.order_by(DemandForecast.forecast_date).limit(200)
    fc_rows = await db.execute(fc_query)
    forecasts = fc_rows.scalars().all()

    lines_created = 0
    for fc in forecasts:
        from datetime import timedelta

        lead_time = 14  # default lead time
        line = SupplyPlanLine(
            plan_id=plan.id,
            item_id=fc.item_id,
            planned_order_date=fc.forecast_date - timedelta(days=lead_time),
            planned_delivery_date=fc.forecast_date,
            planned_quantity=fc.predicted_quantity,
        )
        db.add(line)
        lines_created += 1

    await db.commit()
    await db.refresh(plan)
    return {
        "id": str(plan.id),
        "lines_created": lines_created,
        "status": plan.status,
    }


@router.get("/supply-plans/{plan_id}", summary="Get supply plan detail with lines")
async def get_supply_plan(
    plan_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(SupplyPlan)
        .options(selectinload(SupplyPlan.lines))
        .where(SupplyPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(404, "Supply plan not found")
    return {
        **SupplyPlanOut.model_validate(plan).model_dump(),
        "lines": [SupplyPlanLineOut.model_validate(l) for l in plan.lines],
    }


@router.put(
    "/supply-plans/{plan_id}/lines/{line_id}",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def update_supply_plan_line(
    plan_id: uuid.UUID,
    line_id: uuid.UUID,
    payload: SupplyPlanLineUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(SupplyPlanLine).where(
            SupplyPlanLine.id == line_id, SupplyPlanLine.plan_id == plan_id
        )
    )
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(404, "Supply plan line not found")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(line, field, val)
    await db.commit()
    await db.refresh(line)
    return SupplyPlanLineOut.model_validate(line).model_dump()


@router.post(
    "/supply-plans/{plan_id}/execute",
    dependencies=[Depends(require_app_admin("supply_chain"))],
    summary="Execute supply plan — convert plan lines to purchase orders",
)
async def execute_supply_plan(
    plan_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(SupplyPlan)
        .options(selectinload(SupplyPlan.lines))
        .where(SupplyPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(404, "Supply plan not found")
    if plan.status != "draft":
        raise HTTPException(400, f"Cannot execute plan in status '{plan.status}'")

    # Mark plan and lines as active/ordered
    plan.status = "active"
    converted = 0
    for line in plan.lines:
        if line.status == "planned":
            line.status = "ordered"
            converted += 1

    await db.commit()
    await event_bus.publish("supplychain.supply_plan.executed", {
        "plan_id": str(plan.id),
        "lines_converted": converted,
        "executed_by": str(current_user.id),
    })
    return {"id": str(plan.id), "status": "active", "lines_converted": converted}


# ── Capacity Plan Endpoints ──────────────────────────────────────────────────

@router.get("/capacity-plans", summary="List capacity plans")
async def list_capacity_plans(
    current_user: CurrentUser,
    db: DBSession,
    sop_id: uuid.UUID | None = Query(None),
    resource_type: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(CapacityPlan)
    if sop_id:
        query = query.where(CapacityPlan.sop_id == sop_id)
    if resource_type:
        query = query.where(CapacityPlan.resource_type == resource_type)
    total = await db.execute(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(query.offset(skip).limit(limit))
    return {
        "total": total.scalar() or 0,
        "capacity_plans": [CapacityPlanOut.model_validate(r) for r in rows.scalars().all()],
    }


@router.post(
    "/capacity-plans",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def create_capacity_plan(
    payload: CapacityPlanCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    cp = CapacityPlan(
        sop_id=payload.sop_id,
        resource_type=payload.resource_type,
        resource_id=payload.resource_id,
        period_start=payload.period_start,
        period_end=payload.period_end,
        available_capacity=payload.available_capacity,
        required_capacity=payload.required_capacity,
        utilization_pct=payload.utilization_pct,
        constraints=payload.constraints,
    )
    db.add(cp)
    await db.commit()
    await db.refresh(cp)
    return {"id": str(cp.id), "resource_type": cp.resource_type}
