"""Manufacturing Extensions — Routing, Scrap, Maintenance, QC, Reports, Dashboard KPIs."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.models.manufacturing import (
    BillOfMaterials,
    MaintenanceSchedule,
    QualityCheck,
    QualityControl,
    RoutingStep,
    ScrapEntry,
    WorkOrder,
    WorkStation,
)

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

# -- Routing Steps --

class RoutingStepCreate(BaseModel):
    bom_id: uuid.UUID
    workstation_id: uuid.UUID
    sequence: int
    operation: str
    duration_minutes: int


class RoutingStepUpdate(BaseModel):
    workstation_id: uuid.UUID | None = None
    sequence: int | None = None
    operation: str | None = None
    duration_minutes: int | None = None


class RoutingStepOut(BaseModel):
    id: uuid.UUID
    bom_id: uuid.UUID
    workstation_id: uuid.UUID
    sequence: int
    operation: str
    duration_minutes: int
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Scrap Entries --

class ScrapEntryCreate(BaseModel):
    work_order_id: uuid.UUID
    item_id: uuid.UUID
    quantity: int
    reason: str
    date: date


class ScrapEntryOut(BaseModel):
    id: uuid.UUID
    work_order_id: uuid.UUID
    item_id: uuid.UUID
    quantity: int
    reason: str
    date: date
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Maintenance Schedules --

class MaintenanceScheduleCreate(BaseModel):
    workstation_id: uuid.UUID
    description: str
    frequency: str  # daily, weekly, monthly
    next_date: date


class MaintenanceScheduleUpdate(BaseModel):
    description: str | None = None
    frequency: str | None = None
    next_date: date | None = None
    last_completed: date | None = None
    is_active: bool | None = None


class MaintenanceScheduleOut(BaseModel):
    id: uuid.UUID
    workstation_id: uuid.UUID
    description: str
    frequency: str
    next_date: date
    last_completed: date | None
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Quality Control --

class QualityControlCreate(BaseModel):
    work_order_id: uuid.UUID
    test_name: str
    result: str  # pass, fail
    notes: str | None = None


class QualityControlOut(BaseModel):
    id: uuid.UUID
    work_order_id: uuid.UUID
    test_name: str
    result: str
    inspector_id: uuid.UUID
    notes: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════════════════════
#  ROUTING STEP ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/routing", summary="List routing steps")
async def list_routing_steps(
    current_user: CurrentUser,
    db: DBSession,
    bom_id: uuid.UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    query = select(RoutingStep)

    if bom_id:
        query = query.where(RoutingStep.bom_id == bom_id)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(RoutingStep.sequence.asc()).offset(skip).limit(limit)
    result = await db.execute(query)
    steps = result.scalars().all()
    return {
        "total": total,
        "routing_steps": [RoutingStepOut.model_validate(s).model_dump() for s in steps],
    }


@router.post(
    "/routing",
    status_code=status.HTTP_201_CREATED,
    summary="Create a routing step",
    dependencies=[Depends(require_app_admin("manufacturing"))],
)
async def create_routing_step(
    payload: RoutingStepCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    bom = await db.get(BillOfMaterials, payload.bom_id)
    if not bom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BOM not found")

    ws = await db.get(WorkStation, payload.workstation_id)
    if not ws or not ws.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workstation not found")

    step = RoutingStep(
        bom_id=payload.bom_id,
        workstation_id=payload.workstation_id,
        sequence=payload.sequence,
        operation=payload.operation,
        duration_minutes=payload.duration_minutes,
    )
    db.add(step)
    await db.commit()
    await db.refresh(step)
    return RoutingStepOut.model_validate(step).model_dump()


@router.get("/routing/{step_id}", summary="Get routing step detail")
async def get_routing_step(
    step_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    step = await db.get(RoutingStep, step_id)
    if not step:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Routing step not found")
    return RoutingStepOut.model_validate(step).model_dump()


@router.put(
    "/routing/{step_id}",
    summary="Update a routing step",
    dependencies=[Depends(require_app_admin("manufacturing"))],
)
async def update_routing_step(
    step_id: uuid.UUID,
    payload: RoutingStepUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    step = await db.get(RoutingStep, step_id)
    if not step:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Routing step not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(step, field, value)

    await db.commit()
    await db.refresh(step)
    return RoutingStepOut.model_validate(step).model_dump()


# ══════════════════════════════════════════════════════════════════════════════
#  SCRAP ENTRY ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/scrap-entries",
    status_code=status.HTTP_201_CREATED,
    summary="Record a scrap entry",
    dependencies=[Depends(require_app_admin("manufacturing"))],
)
async def create_scrap_entry(
    payload: ScrapEntryCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    wo = await db.get(WorkOrder, payload.work_order_id)
    if not wo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")

    entry = ScrapEntry(
        work_order_id=payload.work_order_id,
        item_id=payload.item_id,
        quantity=payload.quantity,
        reason=payload.reason,
        date=payload.date,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return ScrapEntryOut.model_validate(entry).model_dump()


@router.get("/scrap-entries", summary="List scrap entries")
async def list_scrap_entries(
    current_user: CurrentUser,
    db: DBSession,
    work_order_id: uuid.UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(ScrapEntry)

    if work_order_id:
        query = query.where(ScrapEntry.work_order_id == work_order_id)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(ScrapEntry.date.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    entries = result.scalars().all()
    return {
        "total": total,
        "scrap_entries": [ScrapEntryOut.model_validate(e).model_dump() for e in entries],
    }


# ══════════════════════════════════════════════════════════════════════════════
#  MAINTENANCE SCHEDULE ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/maintenance-schedules", summary="List maintenance schedules")
async def list_maintenance_schedules(
    current_user: CurrentUser,
    db: DBSession,
    workstation_id: uuid.UUID | None = Query(None),
    is_active: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(MaintenanceSchedule)

    if workstation_id:
        query = query.where(MaintenanceSchedule.workstation_id == workstation_id)
    if is_active is not None:
        query = query.where(MaintenanceSchedule.is_active == is_active)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(MaintenanceSchedule.next_date.asc()).offset(skip).limit(limit)
    result = await db.execute(query)
    schedules = result.scalars().all()
    return {
        "total": total,
        "maintenance_schedules": [MaintenanceScheduleOut.model_validate(s).model_dump() for s in schedules],
    }


@router.post(
    "/maintenance-schedules",
    status_code=status.HTTP_201_CREATED,
    summary="Create a maintenance schedule",
    dependencies=[Depends(require_app_admin("manufacturing"))],
)
async def create_maintenance_schedule(
    payload: MaintenanceScheduleCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    ws = await db.get(WorkStation, payload.workstation_id)
    if not ws or not ws.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workstation not found")

    if payload.frequency not in ("daily", "weekly", "monthly"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Frequency must be 'daily', 'weekly', or 'monthly'",
        )

    schedule = MaintenanceSchedule(
        workstation_id=payload.workstation_id,
        description=payload.description,
        frequency=payload.frequency,
        next_date=payload.next_date,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return MaintenanceScheduleOut.model_validate(schedule).model_dump()


@router.put(
    "/maintenance-schedules/{schedule_id}",
    summary="Update a maintenance schedule",
    dependencies=[Depends(require_app_admin("manufacturing"))],
)
async def update_maintenance_schedule(
    schedule_id: uuid.UUID,
    payload: MaintenanceScheduleUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    schedule = await db.get(MaintenanceSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Maintenance schedule not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(schedule, field, value)

    await db.commit()
    await db.refresh(schedule)
    return MaintenanceScheduleOut.model_validate(schedule).model_dump()


# ══════════════════════════════════════════════════════════════════════════════
#  QUALITY CONTROL ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/quality-control", summary="List quality control records")
async def list_quality_control(
    current_user: CurrentUser,
    db: DBSession,
    work_order_id: uuid.UUID | None = Query(None),
    result_filter: str | None = Query(None, alias="result"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(QualityControl)

    if work_order_id:
        query = query.where(QualityControl.work_order_id == work_order_id)
    if result_filter:
        query = query.where(QualityControl.result == result_filter)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(QualityControl.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    records = result.scalars().all()
    return {
        "total": total,
        "quality_control": [QualityControlOut.model_validate(r).model_dump() for r in records],
    }


@router.post(
    "/quality-control",
    status_code=status.HTTP_201_CREATED,
    summary="Create a quality control record",
    dependencies=[Depends(require_app_admin("manufacturing"))],
)
async def create_quality_control(
    payload: QualityControlCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    wo = await db.get(WorkOrder, payload.work_order_id)
    if not wo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")

    if payload.result not in ("pass", "fail"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Result must be 'pass' or 'fail'",
        )

    qc = QualityControl(
        work_order_id=payload.work_order_id,
        test_name=payload.test_name,
        result=payload.result,
        inspector_id=current_user.id,
        notes=payload.notes,
    )
    db.add(qc)
    await db.commit()
    await db.refresh(qc)
    return QualityControlOut.model_validate(qc).model_dump()


@router.get("/quality-control/{qc_id}", summary="Get quality control record detail")
async def get_quality_control(
    qc_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    qc = await db.get(QualityControl, qc_id)
    if not qc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quality control record not found")
    return QualityControlOut.model_validate(qc).model_dump()


# ══════════════════════════════════════════════════════════════════════════════
#  REPORTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/reports/oee", summary="Report: Overall Equipment Effectiveness (OEE)")
async def report_oee(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """
    Simplified OEE calculation per workstation based on completed work orders.
    OEE = Availability x Performance x Quality (approximated from data).
    """
    # Get active workstations
    ws_result = await db.execute(
        select(WorkStation).where(WorkStation.is_active == True)  # noqa: E712
    )
    workstations = ws_result.scalars().all()

    oee_data = []
    for ws in workstations:
        # Work orders on this workstation
        wo_result = await db.execute(
            select(WorkOrder).where(
                and_(
                    WorkOrder.workstation_id == ws.id,
                    WorkOrder.status == "completed",
                )
            )
        )
        completed_wos = wo_result.scalars().all()

        if not completed_wos:
            oee_data.append({
                "workstation_id": str(ws.id),
                "workstation_name": ws.name,
                "workstation_code": ws.code,
                "completed_orders": 0,
                "oee_percent": 0.0,
                "availability_percent": 0.0,
                "performance_percent": 0.0,
                "quality_percent": 0.0,
            })
            continue

        total_planned = sum(wo.planned_quantity for wo in completed_wos)
        total_completed = sum(wo.completed_quantity for wo in completed_wos)
        total_rejected = sum(wo.rejected_quantity for wo in completed_wos)

        # Quality rate
        quality = (total_completed - total_rejected) / max(total_completed, 1) * 100

        # Performance rate (completed vs planned)
        performance = total_completed / max(total_planned, 1) * 100

        # Availability (simplified: % of WOs that actually ran vs total time)
        total_with_times = [
            wo for wo in completed_wos
            if wo.actual_start and wo.actual_end and wo.planned_start and wo.planned_end
        ]
        if total_with_times:
            planned_time = sum(
                (wo.planned_end - wo.planned_start).total_seconds()
                for wo in total_with_times
            )
            actual_time = sum(
                (wo.actual_end - wo.actual_start).total_seconds()
                for wo in total_with_times
            )
            availability = min(actual_time / max(planned_time, 1) * 100, 100.0)
        else:
            availability = 100.0

        oee = (availability / 100) * (performance / 100) * (quality / 100) * 100

        oee_data.append({
            "workstation_id": str(ws.id),
            "workstation_name": ws.name,
            "workstation_code": ws.code,
            "completed_orders": len(completed_wos),
            "oee_percent": round(oee, 1),
            "availability_percent": round(availability, 1),
            "performance_percent": round(performance, 1),
            "quality_percent": round(quality, 1),
        })

    return {"workstations": oee_data}


@router.get("/reports/production-plan", summary="Report: upcoming production plan")
async def report_production_plan(
    current_user: CurrentUser,
    db: DBSession,
    days_ahead: int = Query(30, ge=1, le=365),
) -> dict[str, Any]:
    """List work orders planned or in-progress, grouped by status."""
    from datetime import timedelta

    cutoff = datetime.now(timezone.utc) + timedelta(days=days_ahead)

    result = await db.execute(
        select(WorkOrder).where(
            and_(
                WorkOrder.status.in_(["draft", "planned", "in_progress"]),
            )
        ).order_by(WorkOrder.planned_start.asc().nullslast())
    )
    orders = result.scalars().all()

    plan = []
    for wo in orders:
        plan.append({
            "wo_id": str(wo.id),
            "wo_number": wo.wo_number,
            "status": wo.status,
            "priority": wo.priority,
            "planned_quantity": wo.planned_quantity,
            "planned_start": wo.planned_start.isoformat() if wo.planned_start else None,
            "planned_end": wo.planned_end.isoformat() if wo.planned_end else None,
            "finished_item_id": str(wo.finished_item_id),
            "workstation_id": str(wo.workstation_id) if wo.workstation_id else None,
        })

    return {
        "days_ahead": days_ahead,
        "total_orders": len(plan),
        "orders": plan,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  DASHBOARD KPIs
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/dashboard/kpis", summary="Manufacturing dashboard KPIs")
async def dashboard_kpis(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Total scrap quantity
    scrap_result = await db.execute(
        select(func.coalesce(func.sum(ScrapEntry.quantity), 0)).select_from(ScrapEntry)
    )
    total_scrap = scrap_result.scalar() or 0

    # Upcoming maintenance (next 7 days)
    from datetime import timedelta
    cutoff = date.today() + timedelta(days=7)
    maint_result = await db.execute(
        select(func.count()).select_from(MaintenanceSchedule).where(
            and_(
                MaintenanceSchedule.is_active == True,  # noqa: E712
                MaintenanceSchedule.next_date <= cutoff,
            )
        )
    )
    upcoming_maintenance = maint_result.scalar() or 0

    # QC pass/fail rates
    qc_total_result = await db.execute(
        select(func.count()).select_from(QualityControl)
    )
    qc_total = qc_total_result.scalar() or 0

    qc_pass_result = await db.execute(
        select(func.count()).select_from(QualityControl).where(QualityControl.result == "pass")
    )
    qc_pass = qc_pass_result.scalar() or 0
    qc_pass_rate = round(qc_pass / max(qc_total, 1) * 100, 1)

    # Active work orders
    active_wo_result = await db.execute(
        select(func.count()).select_from(WorkOrder).where(
            WorkOrder.status == "in_progress"
        )
    )
    active_work_orders = active_wo_result.scalar() or 0

    # Total routing steps
    routing_result = await db.execute(
        select(func.count()).select_from(RoutingStep)
    )
    total_routing_steps = routing_result.scalar() or 0

    # Overdue maintenance
    overdue_result = await db.execute(
        select(func.count()).select_from(MaintenanceSchedule).where(
            and_(
                MaintenanceSchedule.is_active == True,  # noqa: E712
                MaintenanceSchedule.next_date < date.today(),
            )
        )
    )
    overdue_maintenance = overdue_result.scalar() or 0

    return {
        "total_scrap_quantity": total_scrap,
        "upcoming_maintenance_count": upcoming_maintenance,
        "overdue_maintenance_count": overdue_maintenance,
        "qc_total_tests": qc_total,
        "qc_pass_rate_percent": qc_pass_rate,
        "active_work_orders": active_work_orders,
        "total_routing_steps": total_routing_steps,
    }
