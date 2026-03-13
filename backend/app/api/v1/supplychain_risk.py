"""supplychain_risk.py — Supply Chain Risk Management & MRP (Material Requirements Planning).

Endpoints:
  Risk Assessments  — CRUD + nested scenarios / mitigation plans
  Risk Scenarios    — list + create per assessment
  Mitigation Plans  — list + create per assessment, status update
  MRP Runs          — list, create+trigger (simplified MRP calculation), get summary, get lines
  Production Schedules — list, create, update
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError

from app.core.deps import CurrentUser, DBSession
from app.models.supplychain_advanced import (
    MitigationPlan,
    MRPLine,
    MRPRun,
    ProductionSchedule,
    RiskAssessment,
    RiskScenario,
)

router = APIRouter(tags=["Supply Chain Risk & MRP"])


# ── Shared helpers ─────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _not_found(label: str = "Record") -> HTTPException:
    return HTTPException(status_code=404, detail=f"{label} not found")


# ════════════════════════════════════════════════════════════════════════════════
# Pydantic schemas
# ════════════════════════════════════════════════════════════════════════════════

# ── RiskAssessment ─────────────────────────────────────────────────────────────

class RiskAssessmentCreate(BaseModel):
    title: str
    description: str | None = None
    risk_category: str
    risk_level: str = "medium"
    probability: float | None = None        # 0.0 – 1.0
    impact_score: float | None = None       # 0 – 10
    affected_supplier_id: uuid.UUID | None = None
    affected_product_ids: list | None = None
    affected_routes: list | None = None
    expected_impact_start: datetime | None = None
    expected_impact_end: datetime | None = None
    status: str = "open"
    owner_id: uuid.UUID | None = None


class RiskAssessmentUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    risk_category: str | None = None
    risk_level: str | None = None
    probability: float | None = None
    impact_score: float | None = None
    affected_supplier_id: uuid.UUID | None = None
    affected_product_ids: list | None = None
    affected_routes: list | None = None
    expected_impact_start: datetime | None = None
    expected_impact_end: datetime | None = None
    status: str | None = None
    owner_id: uuid.UUID | None = None


class RiskAssessmentOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    risk_category: str
    risk_level: str
    probability: float | None
    impact_score: float | None
    risk_score: float | None
    affected_supplier_id: uuid.UUID | None
    affected_product_ids: list | None
    affected_routes: list | None
    identified_date: Any
    expected_impact_start: Any
    expected_impact_end: Any
    status: str
    owner_id: uuid.UUID | None
    created_by: uuid.UUID | None
    created_at: Any
    updated_at: Any
    # Nested extras (populated on detail endpoint)
    scenarios_count: int = 0
    mitigation_plans_count: int = 0
    scenarios: list[Any] = []
    model_config = {"from_attributes": True}


# ── RiskScenario ──────────────────────────────────────────────────────────────

class RiskScenarioCreate(BaseModel):
    name: str
    description: str | None = None
    scenario_type: str = "pessimistic"
    assumptions: dict | None = None
    projected_cost_impact: float | None = None
    projected_revenue_impact: float | None = None
    projected_delay_days: int | None = None
    simulation_results: dict | None = None


class RiskScenarioOut(BaseModel):
    id: uuid.UUID
    risk_id: uuid.UUID
    name: str
    description: str | None
    scenario_type: str
    assumptions: dict | None
    projected_cost_impact: Any
    projected_revenue_impact: Any
    projected_delay_days: int | None
    simulation_results: dict | None
    created_by: uuid.UUID | None
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


# ── MitigationPlan ─────────────────────────────────────────────────────────────

class MitigationPlanCreate(BaseModel):
    title: str
    description: str | None = None
    strategy: str = "mitigate"
    actions: list | None = None
    estimated_cost: float | None = None
    effectiveness_score: float | None = None
    status: str = "planned"
    assigned_to: uuid.UUID | None = None
    due_date: datetime | None = None


class MitigationPlanStatusUpdate(BaseModel):
    status: str   # planned | in_progress | completed | cancelled
    completed_at: datetime | None = None


class MitigationPlanOut(BaseModel):
    id: uuid.UUID
    risk_id: uuid.UUID
    title: str
    description: str | None
    strategy: str
    actions: list | None
    estimated_cost: Any
    effectiveness_score: float | None
    status: str
    assigned_to: uuid.UUID | None
    due_date: Any
    completed_at: Any
    created_by: uuid.UUID | None
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


# ── MRPRun ─────────────────────────────────────────────────────────────────────

class MRPRunCreate(BaseModel):
    name: str
    run_type: str = "regenerative"
    planning_horizon_days: int = 90
    bucket_size: str = "week"
    product_ids: list | None = None
    warehouse_ids: list | None = None


class MRPRunOut(BaseModel):
    id: uuid.UUID
    name: str
    run_type: str
    planning_horizon_days: int
    bucket_size: str
    product_ids: list | None
    warehouse_ids: list | None
    status: str
    started_at: Any
    completed_at: Any
    error_message: str | None
    total_demand_lines: int
    planned_orders_count: int
    exceptions_count: int
    created_by: uuid.UUID | None
    created_at: Any
    model_config = {"from_attributes": True}


# ── MRPLine ────────────────────────────────────────────────────────────────────

class MRPLineOut(BaseModel):
    id: uuid.UUID
    mrp_run_id: uuid.UUID
    product_id: uuid.UUID | None
    product_sku: str | None
    product_name: str | None
    period_start: Any
    period_end: Any
    gross_demand: Any
    scheduled_receipts: Any
    projected_inventory: Any
    net_demand: Any
    planned_order_qty: Any
    demand_source_type: str | None
    demand_source_id: uuid.UUID | None
    action_type: str | None
    action_details: dict | None
    exception_message: str | None
    created_at: Any
    model_config = {"from_attributes": True}


# ── ProductionSchedule ─────────────────────────────────────────────────────────

class ProductionScheduleCreate(BaseModel):
    mrp_run_id: uuid.UUID | None = None
    product_id: uuid.UUID | None = None
    product_sku: str | None = None
    product_name: str | None = None
    planned_qty: float
    confirmed_qty: float | None = None
    work_center: str | None = None
    planned_start: datetime
    planned_end: datetime
    status: str = "planned"
    priority: int = 5
    notes: str | None = None


class ProductionScheduleUpdate(BaseModel):
    status: str | None = None
    confirmed_qty: float | None = None
    completed_qty: float | None = None
    actual_start: datetime | None = None
    actual_end: datetime | None = None
    work_center: str | None = None
    priority: int | None = None
    notes: str | None = None


class ProductionScheduleOut(BaseModel):
    id: uuid.UUID
    mrp_run_id: uuid.UUID | None
    product_id: uuid.UUID | None
    product_sku: str | None
    product_name: str | None
    planned_qty: Any
    confirmed_qty: Any
    completed_qty: Any
    work_center: str | None
    planned_start: Any
    planned_end: Any
    actual_start: Any
    actual_end: Any
    status: str
    priority: int
    notes: str | None
    created_by: uuid.UUID | None
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


# ════════════════════════════════════════════════════════════════════════════════
# Risk Assessments
# ════════════════════════════════════════════════════════════════════════════════

@router.get("/supply-chain/risk/assessments", response_model=list[RiskAssessmentOut])
async def list_risk_assessments(
    db: DBSession,
    current_user: CurrentUser,
    status: str | None = Query(default=None, description="open | monitoring | mitigated | closed"),
    risk_level: str | None = Query(default=None, description="low | medium | high | critical"),
    risk_category: str | None = Query(default=None, description="supplier | logistics | demand | geopolitical | …"),
    skip: int = 0,
    limit: int = 100,
) -> list[RiskAssessmentOut]:
    """List risk assessments with optional filters."""
    q = select(RiskAssessment)
    if status:
        q = q.where(RiskAssessment.status == status)
    if risk_level:
        q = q.where(RiskAssessment.risk_level == risk_level)
    if risk_category:
        q = q.where(RiskAssessment.risk_category == risk_category)
    q = q.order_by(RiskAssessment.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    assessments = result.scalars().all()

    out: list[RiskAssessmentOut] = []
    for a in assessments:
        sc_count_res = await db.execute(
            select(func.count()).select_from(RiskScenario).where(RiskScenario.risk_id == a.id)
        )
        mp_count_res = await db.execute(
            select(func.count()).select_from(MitigationPlan).where(MitigationPlan.risk_id == a.id)
        )
        out.append(RiskAssessmentOut(
            **{c: getattr(a, c) for c in RiskAssessment.__table__.columns.keys()},
            scenarios_count=sc_count_res.scalar_one(),
            mitigation_plans_count=mp_count_res.scalar_one(),
        ))
    return out


@router.post("/supply-chain/risk/assessments", response_model=RiskAssessmentOut, status_code=201)
async def create_risk_assessment(
    payload: RiskAssessmentCreate,
    db: DBSession,
    current_user: CurrentUser,
) -> RiskAssessmentOut:
    """Create a new risk assessment. Auto-computes risk_score = probability * impact_score."""
    risk_score: float | None = None
    if payload.probability is not None and payload.impact_score is not None:
        risk_score = round(payload.probability * payload.impact_score, 4)

    assessment = RiskAssessment(
        title=payload.title,
        description=payload.description,
        risk_category=payload.risk_category,
        risk_level=payload.risk_level,
        probability=payload.probability,
        impact_score=payload.impact_score,
        risk_score=risk_score,
        affected_supplier_id=payload.affected_supplier_id,
        affected_product_ids=payload.affected_product_ids,
        affected_routes=payload.affected_routes,
        expected_impact_start=payload.expected_impact_start,
        expected_impact_end=payload.expected_impact_end,
        status=payload.status,
        owner_id=payload.owner_id,
        created_by=current_user.id,
    )
    db.add(assessment)
    await db.commit()
    await db.refresh(assessment)
    return RiskAssessmentOut(
        **{c: getattr(assessment, c) for c in RiskAssessment.__table__.columns.keys()},
        scenarios_count=0,
        mitigation_plans_count=0,
    )


@router.get("/supply-chain/risk/assessments/{assessment_id}", response_model=RiskAssessmentOut)
async def get_risk_assessment(
    assessment_id: uuid.UUID,
    db: DBSession,
    current_user: CurrentUser,
) -> RiskAssessmentOut:
    """Get a single risk assessment with nested scenarios and mitigation plan count."""
    assessment = await db.get(RiskAssessment, assessment_id)
    if not assessment:
        raise _not_found("Risk assessment")

    scenarios_res = await db.execute(
        select(RiskScenario).where(RiskScenario.risk_id == assessment_id).order_by(RiskScenario.created_at)
    )
    scenarios = scenarios_res.scalars().all()

    mp_count_res = await db.execute(
        select(func.count()).select_from(MitigationPlan).where(MitigationPlan.risk_id == assessment_id)
    )
    mp_count = mp_count_res.scalar_one()

    scenarios_out = [
        RiskScenarioOut(**{c: getattr(s, c) for c in RiskScenario.__table__.columns.keys()})
        for s in scenarios
    ]

    return RiskAssessmentOut(
        **{c: getattr(assessment, c) for c in RiskAssessment.__table__.columns.keys()},
        scenarios_count=len(scenarios_out),
        mitigation_plans_count=mp_count,
        scenarios=scenarios_out,
    )


@router.put("/supply-chain/risk/assessments/{assessment_id}", response_model=RiskAssessmentOut)
async def update_risk_assessment(
    assessment_id: uuid.UUID,
    payload: RiskAssessmentUpdate,
    db: DBSession,
    current_user: CurrentUser,
) -> RiskAssessmentOut:
    """Update a risk assessment. Recomputes risk_score if probability or impact_score changes."""
    assessment = await db.get(RiskAssessment, assessment_id)
    if not assessment:
        raise _not_found("Risk assessment")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(assessment, field, value)

    # Recompute risk_score if either component was updated
    if "probability" in update_data or "impact_score" in update_data:
        prob = assessment.probability
        impact = assessment.impact_score
        if prob is not None and impact is not None:
            assessment.risk_score = round(prob * impact, 4)
        else:
            assessment.risk_score = None

    await db.commit()
    await db.refresh(assessment)

    sc_count_res = await db.execute(
        select(func.count()).select_from(RiskScenario).where(RiskScenario.risk_id == assessment_id)
    )
    mp_count_res = await db.execute(
        select(func.count()).select_from(MitigationPlan).where(MitigationPlan.risk_id == assessment_id)
    )
    return RiskAssessmentOut(
        **{c: getattr(assessment, c) for c in RiskAssessment.__table__.columns.keys()},
        scenarios_count=sc_count_res.scalar_one(),
        mitigation_plans_count=mp_count_res.scalar_one(),
    )


@router.delete("/supply-chain/risk/assessments/{assessment_id}", status_code=200)
async def delete_risk_assessment(
    assessment_id: uuid.UUID,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    """Delete a risk assessment (cascades to scenarios and mitigation plans)."""
    assessment = await db.get(RiskAssessment, assessment_id)
    if not assessment:
        raise _not_found("Risk assessment")
    await db.delete(assessment)
    await db.commit()
    return {"deleted": str(assessment_id)}


# ════════════════════════════════════════════════════════════════════════════════
# Risk Scenarios
# ════════════════════════════════════════════════════════════════════════════════

@router.get(
    "/supply-chain/risk/assessments/{risk_id}/scenarios",
    response_model=list[RiskScenarioOut],
)
async def list_risk_scenarios(
    risk_id: uuid.UUID,
    db: DBSession,
    current_user: CurrentUser,
) -> list[RiskScenarioOut]:
    """List all scenarios for a given risk assessment."""
    assessment = await db.get(RiskAssessment, risk_id)
    if not assessment:
        raise _not_found("Risk assessment")

    result = await db.execute(
        select(RiskScenario)
        .where(RiskScenario.risk_id == risk_id)
        .order_by(RiskScenario.scenario_type, RiskScenario.created_at)
    )
    scenarios = result.scalars().all()
    return [
        RiskScenarioOut(**{c: getattr(s, c) for c in RiskScenario.__table__.columns.keys()})
        for s in scenarios
    ]


@router.post(
    "/supply-chain/risk/assessments/{risk_id}/scenarios",
    response_model=RiskScenarioOut,
    status_code=201,
)
async def create_risk_scenario(
    risk_id: uuid.UUID,
    payload: RiskScenarioCreate,
    db: DBSession,
    current_user: CurrentUser,
) -> RiskScenarioOut:
    """Create a what-if scenario for a risk assessment."""
    assessment = await db.get(RiskAssessment, risk_id)
    if not assessment:
        raise _not_found("Risk assessment")

    scenario = RiskScenario(
        risk_id=risk_id,
        name=payload.name,
        description=payload.description,
        scenario_type=payload.scenario_type,
        assumptions=payload.assumptions,
        projected_cost_impact=payload.projected_cost_impact,
        projected_revenue_impact=payload.projected_revenue_impact,
        projected_delay_days=payload.projected_delay_days,
        simulation_results=payload.simulation_results,
        created_by=current_user.id,
    )
    db.add(scenario)
    await db.commit()
    await db.refresh(scenario)
    return RiskScenarioOut(**{c: getattr(scenario, c) for c in RiskScenario.__table__.columns.keys()})


# ════════════════════════════════════════════════════════════════════════════════
# Mitigation Plans
# ════════════════════════════════════════════════════════════════════════════════

@router.get(
    "/supply-chain/risk/assessments/{risk_id}/mitigation-plans",
    response_model=list[MitigationPlanOut],
)
async def list_mitigation_plans(
    risk_id: uuid.UUID,
    db: DBSession,
    current_user: CurrentUser,
) -> list[MitigationPlanOut]:
    """List all mitigation plans for a given risk assessment."""
    assessment = await db.get(RiskAssessment, risk_id)
    if not assessment:
        raise _not_found("Risk assessment")

    result = await db.execute(
        select(MitigationPlan)
        .where(MitigationPlan.risk_id == risk_id)
        .order_by(MitigationPlan.created_at)
    )
    plans = result.scalars().all()
    return [
        MitigationPlanOut(**{c: getattr(p, c) for c in MitigationPlan.__table__.columns.keys()})
        for p in plans
    ]


@router.post(
    "/supply-chain/risk/assessments/{risk_id}/mitigation-plans",
    response_model=MitigationPlanOut,
    status_code=201,
)
async def create_mitigation_plan(
    risk_id: uuid.UUID,
    payload: MitigationPlanCreate,
    db: DBSession,
    current_user: CurrentUser,
) -> MitigationPlanOut:
    """Create a mitigation plan for a risk assessment."""
    assessment = await db.get(RiskAssessment, risk_id)
    if not assessment:
        raise _not_found("Risk assessment")

    plan = MitigationPlan(
        risk_id=risk_id,
        title=payload.title,
        description=payload.description,
        strategy=payload.strategy,
        actions=payload.actions,
        estimated_cost=payload.estimated_cost,
        effectiveness_score=payload.effectiveness_score,
        status=payload.status,
        assigned_to=payload.assigned_to,
        due_date=payload.due_date,
        created_by=current_user.id,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return MitigationPlanOut(**{c: getattr(plan, c) for c in MitigationPlan.__table__.columns.keys()})


@router.put(
    "/supply-chain/risk/mitigation-plans/{plan_id}/status",
    response_model=MitigationPlanOut,
)
async def update_mitigation_plan_status(
    plan_id: uuid.UUID,
    payload: MitigationPlanStatusUpdate,
    db: DBSession,
    current_user: CurrentUser,
) -> MitigationPlanOut:
    """Update the status of a mitigation plan."""
    plan = await db.get(MitigationPlan, plan_id)
    if not plan:
        raise _not_found("Mitigation plan")

    plan.status = payload.status
    if payload.status == "completed":
        plan.completed_at = payload.completed_at or _now()
    elif payload.completed_at is not None:
        plan.completed_at = payload.completed_at

    await db.commit()
    await db.refresh(plan)
    return MitigationPlanOut(**{c: getattr(plan, c) for c in MitigationPlan.__table__.columns.keys()})


# ════════════════════════════════════════════════════════════════════════════════
# MRP Runs
# ════════════════════════════════════════════════════════════════════════════════

@router.get("/supply-chain/mrp/runs", response_model=list[MRPRunOut])
async def list_mrp_runs(
    db: DBSession,
    current_user: CurrentUser,
    status: str | None = Query(default=None, description="pending | running | completed | failed"),
    skip: int = 0,
    limit: int = 50,
) -> list[MRPRunOut]:
    """List MRP runs, optionally filtered by status."""
    q = select(MRPRun)
    if status:
        q = q.where(MRPRun.status == status)
    q = q.order_by(MRPRun.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    runs = result.scalars().all()
    return [MRPRunOut(**{c: getattr(r, c) for c in MRPRun.__table__.columns.keys()}) for r in runs]


@router.post("/supply-chain/mrp/runs", response_model=MRPRunOut, status_code=201)
async def create_mrp_run(
    payload: MRPRunCreate,
    db: DBSession,
    current_user: CurrentUser,
) -> MRPRunOut:
    """Create and execute a simplified MRP run.

    The MRP calculation:
    1. Queries the inventory_items table for on-hand stock (via text() since the model lives in a
       different module).
    2. For each product found (scoped to payload.product_ids when provided), generates MRPLine
       records across the planning horizon bucketed by week (or the requested bucket_size).
    3. Sets action_type = 'new_po' when net_demand > 0.
    4. Updates run summary stats and marks status = 'completed'.
    """
    run = MRPRun(
        name=payload.name,
        run_type=payload.run_type,
        planning_horizon_days=payload.planning_horizon_days,
        bucket_size=payload.bucket_size,
        product_ids=payload.product_ids,
        warehouse_ids=payload.warehouse_ids,
        status="running",
        started_at=_now(),
        created_by=current_user.id,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    lines_created = 0
    planned_orders = 0
    exceptions = 0

    try:
        # ── Step 1: Fetch inventory items via text() SQL ───────────────────────
        inv_sql = text(
            """
            SELECT id, sku, name, quantity_on_hand, reorder_level
            FROM inventory_items
            WHERE is_active = true
            LIMIT 200
            """
        )
        inv_result = await db.execute(inv_sql)
        inventory_rows = inv_result.fetchall()

        # Filter to requested product_ids if specified
        if payload.product_ids:
            requested_ids = {str(pid) for pid in payload.product_ids}
            inventory_rows = [r for r in inventory_rows if str(r.id) in requested_ids]

        # ── Step 2: Determine bucket boundaries ────────────────────────────────
        bucket_days = {
            "day": 1,
            "week": 7,
            "month": 30,
        }.get(payload.bucket_size, 7)

        horizon_days = max(1, payload.planning_horizon_days)
        now = _now()
        buckets: list[tuple[datetime, datetime]] = []
        cursor = now
        while (cursor - now).days < horizon_days:
            bucket_end = cursor + timedelta(days=bucket_days)
            if (bucket_end - now).days > horizon_days:
                bucket_end = now + timedelta(days=horizon_days)
            buckets.append((cursor, bucket_end))
            cursor = bucket_end

        # Protect against edge cases (empty buckets)
        if not buckets:
            buckets = [(now, now + timedelta(days=bucket_days))]

        # ── Step 3: Generate MRPLine records per product per bucket ────────────
        for row in inventory_rows:
            projected_inventory = float(row.quantity_on_hand or 0)
            reorder_level = float(row.reorder_level or 0) if hasattr(row, "reorder_level") else 0.0

            for period_start, period_end in buckets:
                # Simplified demand estimate: reorder_level / number_of_buckets per horizon
                gross_demand = round(reorder_level / max(len(buckets), 1), 4) if reorder_level else 10.0
                scheduled_receipts = 0.0

                net_demand = max(0.0, gross_demand - scheduled_receipts - projected_inventory)
                planned_order_qty = net_demand if net_demand > 0 else 0.0
                action_type = "new_po" if net_demand > 0 else "none"

                # Project forward: carry over any shortfall
                projected_inventory = max(0.0, projected_inventory + scheduled_receipts - gross_demand)

                line = MRPLine(
                    mrp_run_id=run.id,
                    product_id=row.id,
                    product_sku=row.sku,
                    product_name=row.name,
                    period_start=period_start,
                    period_end=period_end,
                    gross_demand=gross_demand,
                    scheduled_receipts=scheduled_receipts,
                    projected_inventory=projected_inventory,
                    net_demand=net_demand,
                    planned_order_qty=planned_order_qty,
                    demand_source_type="forecast",
                    action_type=action_type,
                    action_details={"bucket_size": payload.bucket_size},
                )
                db.add(line)
                lines_created += 1
                if net_demand > 0:
                    planned_orders += 1

        await db.commit()

        # ── Step 4: Mark run completed with summary stats ──────────────────────
        run.status = "completed"
        run.completed_at = _now()
        run.total_demand_lines = lines_created
        run.planned_orders_count = planned_orders
        run.exceptions_count = exceptions

    except SQLAlchemyError as exc:
        await db.rollback()
        run.status = "failed"
        run.error_message = str(exc)[:500]
        run.completed_at = _now()

    await db.commit()
    await db.refresh(run)
    return MRPRunOut(**{c: getattr(run, c) for c in MRPRun.__table__.columns.keys()})


@router.get("/supply-chain/mrp/runs/{run_id}", response_model=MRPRunOut)
async def get_mrp_run(
    run_id: uuid.UUID,
    db: DBSession,
    current_user: CurrentUser,
) -> MRPRunOut:
    """Get a single MRP run with summary statistics."""
    run = await db.get(MRPRun, run_id)
    if not run:
        raise _not_found("MRP run")

    # Refresh live counts in case lines were added externally
    lines_count_res = await db.execute(
        select(func.count()).select_from(MRPLine).where(MRPLine.mrp_run_id == run_id)
    )
    po_count_res = await db.execute(
        select(func.count())
        .select_from(MRPLine)
        .where(MRPLine.mrp_run_id == run_id, MRPLine.action_type == "new_po")
    )
    out = MRPRunOut(**{c: getattr(run, c) for c in MRPRun.__table__.columns.keys()})
    out.total_demand_lines = lines_count_res.scalar_one()
    out.planned_orders_count = po_count_res.scalar_one()
    return out


@router.get("/supply-chain/mrp/runs/{run_id}/lines", response_model=list[MRPLineOut])
async def get_mrp_lines(
    run_id: uuid.UUID,
    db: DBSession,
    current_user: CurrentUser,
    action_type: str | None = Query(default=None, description="new_po | reschedule | cancel | expedite | none"),
    product_sku: str | None = Query(default=None),
    skip: int = 0,
    limit: int = 200,
) -> list[MRPLineOut]:
    """Get all MRP lines for a run, with optional filtering."""
    run = await db.get(MRPRun, run_id)
    if not run:
        raise _not_found("MRP run")

    q = select(MRPLine).where(MRPLine.mrp_run_id == run_id)
    if action_type:
        q = q.where(MRPLine.action_type == action_type)
    if product_sku:
        q = q.where(MRPLine.product_sku == product_sku)
    q = q.order_by(MRPLine.period_start, MRPLine.product_sku).offset(skip).limit(limit)

    result = await db.execute(q)
    lines = result.scalars().all()
    return [MRPLineOut(**{c: getattr(line, c) for c in MRPLine.__table__.columns.keys()}) for line in lines]


# ════════════════════════════════════════════════════════════════════════════════
# Production Schedules
# ════════════════════════════════════════════════════════════════════════════════

@router.get("/supply-chain/production/schedules", response_model=list[ProductionScheduleOut])
async def list_production_schedules(
    db: DBSession,
    current_user: CurrentUser,
    status: str | None = Query(default=None, description="planned | confirmed | in_progress | completed | cancelled"),
    work_center: str | None = Query(default=None),
    skip: int = 0,
    limit: int = 100,
) -> list[ProductionScheduleOut]:
    """List production schedules with optional filters."""
    q = select(ProductionSchedule)
    if status:
        q = q.where(ProductionSchedule.status == status)
    if work_center:
        q = q.where(ProductionSchedule.work_center == work_center)
    q = q.order_by(ProductionSchedule.planned_start.asc()).offset(skip).limit(limit)
    result = await db.execute(q)
    schedules = result.scalars().all()
    return [
        ProductionScheduleOut(**{c: getattr(s, c) for c in ProductionSchedule.__table__.columns.keys()})
        for s in schedules
    ]


@router.post("/supply-chain/production/schedules", response_model=ProductionScheduleOut, status_code=201)
async def create_production_schedule(
    payload: ProductionScheduleCreate,
    db: DBSession,
    current_user: CurrentUser,
) -> ProductionScheduleOut:
    """Create a new production schedule entry."""
    # Validate optional mrp_run_id reference
    if payload.mrp_run_id:
        run = await db.get(MRPRun, payload.mrp_run_id)
        if not run:
            raise _not_found("MRP run")

    schedule = ProductionSchedule(
        mrp_run_id=payload.mrp_run_id,
        product_id=payload.product_id,
        product_sku=payload.product_sku,
        product_name=payload.product_name,
        planned_qty=payload.planned_qty,
        confirmed_qty=payload.confirmed_qty,
        work_center=payload.work_center,
        planned_start=payload.planned_start,
        planned_end=payload.planned_end,
        status=payload.status,
        priority=payload.priority,
        notes=payload.notes,
        created_by=current_user.id,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return ProductionScheduleOut(
        **{c: getattr(schedule, c) for c in ProductionSchedule.__table__.columns.keys()}
    )


@router.put("/supply-chain/production/schedules/{schedule_id}", response_model=ProductionScheduleOut)
async def update_production_schedule(
    schedule_id: uuid.UUID,
    payload: ProductionScheduleUpdate,
    db: DBSession,
    current_user: CurrentUser,
) -> ProductionScheduleOut:
    """Update a production schedule (status, confirmed_qty, actual start/end, etc.)."""
    schedule = await db.get(ProductionSchedule, schedule_id)
    if not schedule:
        raise _not_found("Production schedule")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(schedule, field, value)

    await db.commit()
    await db.refresh(schedule)
    return ProductionScheduleOut(
        **{c: getattr(schedule, c) for c in ProductionSchedule.__table__.columns.keys()}
    )
