"""Manufacturing Planning & Scheduling — finite capacity, Gantt, scenarios."""

import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession
from app.models.manufacturing import (
    WorkOrder,
    RoutingStep,
    CapacitySlot,
    ScheduleEntry,
    ProductionScenario,
)

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────────────

class CapacitySlotIn(BaseModel):
    workstation_id: uuid.UUID
    slot_date: str  # YYYY-MM-DD
    shift: str
    total_minutes: int


class ScheduleEntryUpdate(BaseModel):
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    status: str | None = None


class ScenarioCreate(BaseModel):
    name: str
    description: str | None = None
    parameters: dict | None = None


class ScenarioUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    parameters: dict | None = None
    status: str | None = None


# ─── Scheduling Engine ────────────────────────────────────────────────────────

async def _run_scheduler(db: AsyncSession, scenario_id: uuid.UUID | None = None) -> list[dict]:
    """
    Priority-based forward scheduler.
    For each planned WO (ordered by priority + planned_start), assign routing steps
    to workstation capacity slots — earliest-available-first.
    """
    from app.services.mfg_scheduler import schedule_work_orders
    return await schedule_work_orders(db, scenario_id)


# ─── Capacity Slots ───────────────────────────────────────────────────────────

@router.post("/capacity-slots", status_code=201)
async def create_capacity_slot(body: CapacitySlotIn, db: DBSession, user: CurrentUser):
    from datetime import date as date_type
    slot = CapacitySlot(
        workstation_id=body.workstation_id,
        slot_date=date_type.fromisoformat(body.slot_date),
        shift=body.shift,
        total_minutes=body.total_minutes,
        allocated_minutes=0,
        status="available",
    )
    db.add(slot)
    await db.commit()
    await db.refresh(slot)
    return slot


@router.get("/capacity-slots")
async def list_capacity_slots(
    db: DBSession,
    user: CurrentUser,
    workstation_id: uuid.UUID | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    from datetime import date as date_type
    q = select(CapacitySlot)
    if workstation_id:
        q = q.where(CapacitySlot.workstation_id == workstation_id)
    if date_from:
        q = q.where(CapacitySlot.slot_date >= date_type.fromisoformat(date_from))
    if date_to:
        q = q.where(CapacitySlot.slot_date <= date_type.fromisoformat(date_to))
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/capacity/workstation/{workstation_id}")
async def workstation_capacity(
    workstation_id: uuid.UUID,
    db: DBSession,
    user: CurrentUser,
    weeks: int = 4,
):
    """Return utilization summary for a workstation over N weeks."""
    from datetime import date as date_type
    today = date_type.today()
    end = today + timedelta(weeks=weeks)
    result = await db.execute(
        select(CapacitySlot).where(
            CapacitySlot.workstation_id == workstation_id,
            CapacitySlot.slot_date >= today,
            CapacitySlot.slot_date <= end,
        )
    )
    slots = result.scalars().all()
    total = sum(s.total_minutes for s in slots)
    allocated = sum(s.allocated_minutes for s in slots)
    return {
        "workstation_id": str(workstation_id),
        "weeks": weeks,
        "total_minutes": total,
        "allocated_minutes": allocated,
        "utilization_percent": round(allocated / total * 100, 1) if total else 0,
        "slots": [
            {
                "id": str(s.id),
                "slot_date": s.slot_date.isoformat(),
                "shift": s.shift,
                "total_minutes": s.total_minutes,
                "allocated_minutes": s.allocated_minutes,
                "status": s.status,
            }
            for s in slots
        ],
    }


@router.get("/capacity/rough-cut")
async def rough_cut_capacity(db: DBSession, user: CurrentUser, weeks: int = 8):
    """Compare aggregate demand (from planned WOs) vs aggregate capacity across all workstations."""
    from datetime import date as date_type
    today = date_type.today()
    end = today + timedelta(weeks=weeks)

    # Aggregate capacity by workstation
    cap_result = await db.execute(
        select(
            CapacitySlot.workstation_id,
            func.sum(CapacitySlot.total_minutes).label("total"),
            func.sum(CapacitySlot.allocated_minutes).label("allocated"),
        )
        .where(CapacitySlot.slot_date >= today, CapacitySlot.slot_date <= end)
        .group_by(CapacitySlot.workstation_id)
    )
    capacity = cap_result.all()

    # Planned WO demand (sum routing step durations)
    demand_result = await db.execute(
        select(RoutingStep.workstation_id, func.sum(RoutingStep.duration_minutes).label("demand"))
        .join(WorkOrder, WorkOrder.bom_id == RoutingStep.bom_id)
        .where(
            WorkOrder.status.in_(["planned", "draft"]),
            WorkOrder.planned_start >= datetime.combine(today, datetime.min.time()),
            WorkOrder.planned_end <= datetime.combine(end, datetime.min.time()),
        )
        .group_by(RoutingStep.workstation_id)
    )
    demand = {str(r.workstation_id): r.demand for r in demand_result.all()}

    rows = []
    for c in capacity:
        ws_id = str(c.workstation_id)
        rows.append({
            "workstation_id": ws_id,
            "capacity_minutes": int(c.total or 0),
            "allocated_minutes": int(c.allocated or 0),
            "demand_minutes": int(demand.get(ws_id, 0)),
            "free_minutes": int(c.total or 0) - int(c.allocated or 0),
            "overloaded": int(demand.get(ws_id, 0)) > int(c.total or 0),
        })
    return rows


# ─── Schedule Entries ─────────────────────────────────────────────────────────

@router.get("/schedule")
async def get_gantt_data(
    db: DBSession,
    user: CurrentUser,
    scenario_id: uuid.UUID | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    """Return Gantt-ready schedule entries."""
    q = select(ScheduleEntry)
    if scenario_id:
        q = q.where(ScheduleEntry.scenario_id == scenario_id)
    else:
        q = q.where(ScheduleEntry.scenario_id.is_(None))
    if date_from:
        q = q.where(ScheduleEntry.scheduled_start >= datetime.fromisoformat(date_from))
    if date_to:
        q = q.where(ScheduleEntry.scheduled_end <= datetime.fromisoformat(date_to))
    result = await db.execute(q)
    entries = result.scalars().all()
    return [
        {
            "id": str(e.id),
            "work_order_id": str(e.work_order_id),
            "routing_step_id": str(e.routing_step_id) if e.routing_step_id else None,
            "workstation_id": str(e.workstation_id),
            "scheduled_start": e.scheduled_start.isoformat(),
            "scheduled_end": e.scheduled_end.isoformat(),
            "actual_start": e.actual_start.isoformat() if e.actual_start else None,
            "actual_end": e.actual_end.isoformat() if e.actual_end else None,
            "status": e.status,
            "sequence": e.sequence,
        }
        for e in entries
    ]


@router.put("/schedule/{entry_id}")
async def update_schedule_entry(
    entry_id: uuid.UUID,
    body: ScheduleEntryUpdate,
    db: DBSession,
    user: CurrentUser,
):
    result = await db.execute(select(ScheduleEntry).where(ScheduleEntry.id == entry_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Schedule entry not found")
    if body.scheduled_start:
        entry.scheduled_start = body.scheduled_start
    if body.scheduled_end:
        entry.scheduled_end = body.scheduled_end
    if body.status:
        entry.status = body.status
    await db.commit()
    await db.refresh(entry)
    return entry


# ─── Run Scheduler ────────────────────────────────────────────────────────────

@router.post("/schedule/run")
async def run_scheduler(
    db: DBSession,
    user: CurrentUser,
    scenario_id: uuid.UUID | None = None,
):
    """Trigger finite capacity scheduling and return generated schedule entries."""
    entries = await _run_scheduler(db, scenario_id)
    return {"scheduled": len(entries), "entries": entries}


# ─── Scenarios ────────────────────────────────────────────────────────────────

@router.post("/scenarios", status_code=201)
async def create_scenario(body: ScenarioCreate, db: DBSession, user: CurrentUser):
    scenario = ProductionScenario(
        name=body.name,
        description=body.description,
        status="draft",
        parameters=body.parameters,
        created_by=user.id,
    )
    db.add(scenario)
    await db.commit()
    await db.refresh(scenario)
    return scenario


@router.get("/scenarios")
async def list_scenarios(db: DBSession, user: CurrentUser):
    result = await db.execute(select(ProductionScenario).order_by(ProductionScenario.created_at.desc()))
    return result.scalars().all()


@router.get("/scenarios/{scenario_id}")
async def get_scenario(scenario_id: uuid.UUID, db: DBSession, user: CurrentUser):
    result = await db.execute(select(ProductionScenario).where(ProductionScenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario


@router.put("/scenarios/{scenario_id}")
async def update_scenario(
    scenario_id: uuid.UUID,
    body: ScenarioUpdate,
    db: DBSession,
    user: CurrentUser,
):
    result = await db.execute(select(ProductionScenario).where(ProductionScenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(scenario, field, value)
    await db.commit()
    await db.refresh(scenario)
    return scenario


@router.post("/scenarios/{scenario_id}/run")
async def run_scenario(
    scenario_id: uuid.UUID,
    db: DBSession,
    user: CurrentUser,
):
    """Run the scheduler for a specific scenario."""
    result = await db.execute(select(ProductionScenario).where(ProductionScenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    scenario.status = "running"
    await db.commit()
    entries = await _run_scheduler(db, scenario_id)
    scenario.status = "completed"
    scenario.results = {"scheduled_entries": len(entries)}
    await db.commit()
    return {"scenario_id": str(scenario_id), "scheduled": len(entries), "entries": entries}


@router.delete("/scenarios/{scenario_id}", status_code=204)
async def delete_scenario(
    scenario_id: uuid.UUID,
    db: DBSession,
    user: CurrentUser,
):
    result = await db.execute(select(ProductionScenario).where(ProductionScenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    await db.delete(scenario)
    await db.commit()
