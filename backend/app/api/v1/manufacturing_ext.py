"""Manufacturing Extensions — Routing, Scrap, Maintenance, QC, Reports, Dashboard KPIs."""

import uuid
from datetime import date, datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.models.manufacturing import (
    BillOfMaterials,
    MaintenanceSchedule,
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


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 3A — Digital Work Instructions & MES
# ══════════════════════════════════════════════════════════════════════════════

import uuid as _uuid
from pydantic import BaseModel as _BaseModel


class WorkInstructionsUpdate(_BaseModel):
    work_instructions: str | None = None
    instruction_media: dict | None = None
    barcode_scan_required: bool | None = None


class IoTDataPointIn(_BaseModel):
    workstation_id: str | None = None
    asset_id: str | None = None
    work_order_id: str | None = None
    metric_name: str
    metric_value: float
    unit: str | None = None
    source: str | None = None
    timestamp: str | None = None


class BarcodeScanIn(_BaseModel):
    barcode: str
    scan_type: str = "work_order"  # work_order, lot, item


@router.get("/routing-steps/{step_id}/instructions")
async def get_work_instructions(
    step_id: _uuid.UUID,
    db: DBSession,
    user: CurrentUser,
):
    result = await db.execute(select(RoutingStep).where(RoutingStep.id == step_id))
    step = result.scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=404, detail="Routing step not found")
    return {
        "step_id": str(step.id),
        "operation": step.operation,
        "duration_minutes": step.duration_minutes,
        "work_instructions": step.work_instructions,
        "instruction_media": step.instruction_media,
        "barcode_scan_required": step.barcode_scan_required,
    }


@router.put("/routing-steps/{step_id}/instructions")
async def update_work_instructions(
    step_id: _uuid.UUID,
    body: WorkInstructionsUpdate,
    db: DBSession,
    user: CurrentUser,
):
    result = await db.execute(select(RoutingStep).where(RoutingStep.id == step_id))
    step = result.scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=404, detail="Routing step not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(step, field, value)
    await db.commit()
    await db.refresh(step)
    return step


@router.post("/barcode-scan")
async def barcode_scan(
    body: BarcodeScanIn,
    db: DBSession,
    user: CurrentUser,
):
    """Resolve a scanned barcode to the relevant entity."""
    from app.models.manufacturing import WorkOrder, LotSerialTrack
    from app.models.inventory import InventoryItem

    result: dict = {"barcode": body.barcode, "scan_type": body.scan_type, "resolved": False}

    if body.scan_type == "work_order":
        wo_result = await db.execute(select(WorkOrder).where(WorkOrder.wo_number == body.barcode))
        wo = wo_result.scalar_one_or_none()
        if wo:
            result.update({
                "resolved": True,
                "entity": "work_order",
                "id": str(wo.id),
                "wo_number": wo.wo_number,
                "status": wo.status,
                "priority": wo.priority,
            })
    elif body.scan_type == "lot":
        lot_result = await db.execute(
            select(LotSerialTrack).where(LotSerialTrack.tracking_number == body.barcode)
        )
        lot = lot_result.scalar_one_or_none()
        if lot:
            result.update({
                "resolved": True,
                "entity": "lot",
                "id": str(lot.id),
                "tracking_number": lot.tracking_number,
                "tracking_type": lot.tracking_type,
                "status": lot.status,
            })
    elif body.scan_type == "item":
        item_result = await db.execute(
            select(InventoryItem).where(InventoryItem.sku == body.barcode)
        )
        item = item_result.scalar_one_or_none()
        if item:
            result.update({
                "resolved": True,
                "entity": "item",
                "id": str(item.id),
                "name": item.name,
                "sku": item.sku,
            })

    return result


@router.post("/iot/ingest", status_code=201)
async def ingest_iot_data(
    body: list[IoTDataPointIn],
    db: DBSession,
    user: CurrentUser,
):
    """Bulk-ingest IoT sensor data points."""
    from app.models.manufacturing import IoTDataPoint
    from decimal import Decimal
    from datetime import datetime

    points = []
    for dp in body:
        point = IoTDataPoint(
            workstation_id=_uuid.UUID(dp.workstation_id) if dp.workstation_id else None,
            asset_id=_uuid.UUID(dp.asset_id) if dp.asset_id else None,
            work_order_id=_uuid.UUID(dp.work_order_id) if dp.work_order_id else None,
            metric_name=dp.metric_name,
            metric_value=Decimal(str(dp.metric_value)),
            unit=dp.unit,
            source=dp.source,
            timestamp=datetime.fromisoformat(dp.timestamp) if dp.timestamp else datetime.now(),
        )
        db.add(point)
        points.append(point)

    await db.commit()
    return {"ingested": len(points)}


@router.get("/iot/data")
async def get_iot_data(
    db: DBSession,
    user: CurrentUser,
    workstation_id: _uuid.UUID | None = None,
    metric_name: str | None = None,
    hours: int = 1,
):
    """Query recent IoT data points."""
    from app.models.manufacturing import IoTDataPoint
    from datetime import timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    q = select(IoTDataPoint).where(IoTDataPoint.timestamp >= cutoff)
    if workstation_id:
        q = q.where(IoTDataPoint.workstation_id == workstation_id)
    if metric_name:
        q = q.where(IoTDataPoint.metric_name == metric_name)
    result = await db.execute(q.order_by(IoTDataPoint.timestamp.desc()).limit(500))
    return result.scalars().all()


@router.get("/production-board")
async def production_board(
    db: DBSession,
    user: CurrentUser,
):
    """Live production board — all active work orders with workstation and schedule status."""
    from app.models.manufacturing import ScheduleEntry

    wo_result = await db.execute(
        select(WorkOrder)
        .where(WorkOrder.status.in_(["planned", "in_progress"]))
        .order_by(WorkOrder.priority.desc(), WorkOrder.planned_start.asc().nulls_last())
    )
    work_orders = wo_result.scalars().all()

    board = []
    for wo in work_orders:
        # Get current schedule entries
        se_result = await db.execute(
            select(ScheduleEntry)
            .where(
                ScheduleEntry.work_order_id == wo.id,
                ScheduleEntry.scenario_id.is_(None),
            )
            .order_by(ScheduleEntry.sequence)
        )
        entries = se_result.scalars().all()

        board.append({
            "id": str(wo.id),
            "wo_number": wo.wo_number,
            "status": wo.status,
            "priority": wo.priority,
            "planned_quantity": wo.planned_quantity,
            "completed_quantity": wo.completed_quantity,
            "progress_percent": round(wo.completed_quantity / wo.planned_quantity * 100, 1) if wo.planned_quantity else 0,
            "planned_start": wo.planned_start.isoformat() if wo.planned_start else None,
            "planned_end": wo.planned_end.isoformat() if wo.planned_end else None,
            "actual_start": wo.actual_start.isoformat() if wo.actual_start else None,
            "workstation_id": str(wo.workstation_id) if wo.workstation_id else None,
            "schedule_entries": len(entries),
            "current_step": next(({"id": str(e.id), "status": e.status, "sequence": e.sequence} for e in entries if e.status == "in_progress"), None),
        })
    return board


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 3C — CPQ Product Configurator
# ══════════════════════════════════════════════════════════════════════════════

class ConfiguratorRuleCreate(_BaseModel):
    name: str
    bom_id: str
    rule_type: str
    condition: dict
    action: dict
    priority: int = 0


class ConfiguratorSelectionIn(_BaseModel):
    feature: str
    value: str


@router.post("/configurator/rules", status_code=201)
async def create_configurator_rule(
    body: ConfiguratorRuleCreate,
    db: DBSession,
    user: CurrentUser,
):
    from app.models.manufacturing import ConfiguratorRule
    rule = ConfiguratorRule(
        name=body.name,
        bom_id=_uuid.UUID(body.bom_id),
        rule_type=body.rule_type,
        condition=body.condition,
        action=body.action,
        priority=body.priority,
        is_active=True,
        created_by=user.id,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.get("/configurator/rules")
async def list_configurator_rules(
    db: DBSession,
    user: CurrentUser,
    bom_id: _uuid.UUID | None = None,
):
    from app.models.manufacturing import ConfiguratorRule
    q = select(ConfiguratorRule).where(ConfiguratorRule.is_active.is_(True))
    if bom_id:
        q = q.where(ConfiguratorRule.bom_id == bom_id)
    result = await db.execute(q.order_by(ConfiguratorRule.priority.desc()))
    return result.scalars().all()


@router.put("/configurator/rules/{rule_id}")
async def update_configurator_rule(
    rule_id: _uuid.UUID,
    body: dict,
    db: DBSession,
    user: CurrentUser,
):
    from app.models.manufacturing import ConfiguratorRule
    result = await db.execute(select(ConfiguratorRule).where(ConfiguratorRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    for field, value in body.items():
        if hasattr(rule, field):
            setattr(rule, field, value)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/configurator/rules/{rule_id}", status_code=204)
async def delete_configurator_rule(
    rule_id: _uuid.UUID,
    db: DBSession,
    user: CurrentUser,
):
    from app.models.manufacturing import ConfiguratorRule
    result = await db.execute(select(ConfiguratorRule).where(ConfiguratorRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    rule.is_active = False
    await db.commit()


@router.post("/configurator/sessions")
async def start_configurator_session(
    bom_id: _uuid.UUID,
    db: DBSession,
    user: CurrentUser,
):
    """Start a new CPQ configuration session for a BOM."""
    import random, string
    from app.models.manufacturing import ConfiguratorSession, BOMItem
    from app.models.inventory import InventoryItem
    from decimal import Decimal

    code = "CPQ-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))

    # Load base BOM items with costs
    items_result = await db.execute(
        select(BOMItem, InventoryItem)
        .join(InventoryItem, BOMItem.item_id == InventoryItem.id)
        .where(BOMItem.bom_id == bom_id, BOMItem.is_phantom.is_(False))
    )
    rows = items_result.all()
    base_items = [
        {
            "bom_item_id": str(r.BOMItem.id),
            "item_id": str(r.InventoryItem.id),
            "name": r.InventoryItem.name,
            "quantity": float(r.BOMItem.quantity_required),
            "unit_cost": float(getattr(r.InventoryItem, "cost_price", 0) or 0),
        }
        for r in rows
    ]
    base_cost = sum(i["quantity"] * i["unit_cost"] for i in base_items)

    session = ConfiguratorSession(
        session_code=code,
        base_bom_id=bom_id,
        selections={},
        computed_bom_items=base_items,
        computed_cost=Decimal(str(base_cost)),
        status="active",
        created_by=user.id,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/configurator/sessions/{session_id}")
async def get_configurator_session(
    session_id: _uuid.UUID,
    db: DBSession,
    user: CurrentUser,
):
    from app.models.manufacturing import ConfiguratorSession
    result = await db.execute(select(ConfiguratorSession).where(ConfiguratorSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/configurator/sessions/{session_id}/select")
async def apply_selection(
    session_id: _uuid.UUID,
    body: ConfiguratorSelectionIn,
    db: DBSession,
    user: CurrentUser,
):
    """Apply a feature selection to a CPQ session and recompute the BOM."""
    from app.models.manufacturing import ConfiguratorSession, ConfiguratorRule
    from decimal import Decimal

    result = await db.execute(select(ConfiguratorSession).where(ConfiguratorSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session or session.status != "active":
        raise HTTPException(status_code=404, detail="Active session not found")

    # Update selections
    selections = dict(session.selections or {})
    selections[body.feature] = body.value
    session.selections = selections

    # Reload base items and apply rules
    from app.models.manufacturing import BOMItem, ConfiguratorRule
    from app.models.inventory import InventoryItem

    items_result = await db.execute(
        select(BOMItem, InventoryItem)
        .join(InventoryItem, BOMItem.item_id == InventoryItem.id)
        .where(BOMItem.bom_id == session.base_bom_id, BOMItem.is_phantom.is_(False))
    )
    rows = items_result.all()
    computed = {
        str(r.BOMItem.id): {
            "bom_item_id": str(r.BOMItem.id),
            "item_id": str(r.InventoryItem.id),
            "name": r.InventoryItem.name,
            "quantity": float(r.BOMItem.quantity_required),
            "unit_cost": float(getattr(r.InventoryItem, "cost_price", 0) or 0),
            "included": True,
        }
        for r in rows
    }

    # Apply active rules
    rules_result = await db.execute(
        select(ConfiguratorRule)
        .where(
            ConfiguratorRule.bom_id == session.base_bom_id,
            ConfiguratorRule.is_active.is_(True),
        )
        .order_by(ConfiguratorRule.priority.desc())
    )
    rules = rules_result.scalars().all()

    for rule in rules:
        cond = rule.condition or {}
        cond_feature = cond.get("feature")
        cond_value = cond.get("value")
        if cond_feature and selections.get(cond_feature) != cond_value:
            continue  # Condition not met

        action = rule.action or {}
        target_item_id = action.get("bom_item_id")

        if rule.rule_type == "exclude" and target_item_id in computed:
            computed[target_item_id]["included"] = False
        elif rule.rule_type == "include" and target_item_id in computed:
            computed[target_item_id]["included"] = True
        elif rule.rule_type == "quantity_adjust" and target_item_id in computed:
            computed[target_item_id]["quantity"] = float(action.get("quantity", computed[target_item_id]["quantity"]))

    final_items = [v for v in computed.values() if v.get("included", True)]
    total_cost = sum(i["quantity"] * i["unit_cost"] for i in final_items)

    session.computed_bom_items = final_items
    session.computed_cost = Decimal(str(total_cost))
    await db.commit()
    await db.refresh(session)
    return session


@router.post("/configurator/sessions/{session_id}/finalize")
async def finalize_configurator_session(
    session_id: _uuid.UUID,
    db: DBSession,
    user: CurrentUser,
):
    """Finalize CPQ session → create a new BOM from the configured items."""
    from app.models.manufacturing import ConfiguratorSession, BillOfMaterials, BOMItem
    import random, string

    result = await db.execute(select(ConfiguratorSession).where(ConfiguratorSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session or session.status != "active":
        raise HTTPException(status_code=404, detail="Active session not found")

    # Load base BOM for metadata
    bom_result = await db.execute(select(BillOfMaterials).where(BillOfMaterials.id == session.base_bom_id))
    base_bom = bom_result.scalar_one_or_none()
    if not base_bom:
        raise HTTPException(status_code=400, detail="Base BOM not found")

    suffix = "".join(random.choices(string.digits, k=4))
    new_bom = BillOfMaterials(
        bom_number=f"{base_bom.bom_number}-CPQ-{suffix}",
        name=f"{base_bom.name} (Configured {session.session_code})",
        finished_item_id=base_bom.finished_item_id,
        quantity_produced=base_bom.quantity_produced,
        version=1,
        is_active=True,
        is_default=False,
        owner_id=user.id,
    )
    db.add(new_bom)
    await db.flush()

    # Create BOM items from computed items
    for item_data in (session.computed_bom_items or []):
        import uuid as _u
        bom_item = BOMItem(
            bom_id=new_bom.id,
            item_id=_u.UUID(item_data["item_id"]),
            quantity_required=item_data["quantity"],
            unit_of_measure="unit",
            sort_order=0,
            is_phantom=False,
        )
        db.add(bom_item)

    session.status = "finalized"
    session.finalized_bom_id = new_bom.id
    await db.commit()
    await db.refresh(session)
    return {"session": session, "finalized_bom_id": str(new_bom.id), "bom_number": new_bom.bom_number}
