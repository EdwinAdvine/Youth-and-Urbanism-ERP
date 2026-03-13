"""Manufacturing Equipment & Maintenance — assets, downtime, MWOs, OEE."""

import uuid
from datetime import datetime, date as date_type
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func

from app.core.deps import CurrentUser, DBSession
from app.models.manufacturing import (
    AssetRegister,
    DowntimeRecord,
    MaintenanceWorkOrder,
    WorkStation,
)

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────────────

class AssetCreate(BaseModel):
    asset_code: str
    name: str
    workstation_id: uuid.UUID | None = None
    asset_type: str
    manufacturer: str | None = None
    model_number: str | None = None
    serial_number: str | None = None
    purchase_date: str | None = None
    purchase_cost: float = 0
    warranty_expiry: str | None = None
    location: str | None = None
    specifications: dict | None = None
    notes: str | None = None


class AssetUpdate(BaseModel):
    name: str | None = None
    workstation_id: uuid.UUID | None = None
    status: str | None = None
    total_operating_hours: float | None = None
    location: str | None = None
    notes: str | None = None
    specifications: dict | None = None


class DowntimeCreate(BaseModel):
    workstation_id: uuid.UUID
    asset_id: uuid.UUID | None = None
    work_order_id: uuid.UUID | None = None
    downtime_type: str
    category: str
    start_time: datetime
    end_time: datetime | None = None
    root_cause: str | None = None
    resolution: str | None = None


class DowntimeClose(BaseModel):
    end_time: datetime
    root_cause: str | None = None
    resolution: str | None = None


class MWOCreate(BaseModel):
    asset_id: uuid.UUID
    schedule_id: uuid.UUID | None = None
    maintenance_type: str
    trigger_type: str = "calendar"
    description: str
    priority: str = "medium"
    assigned_to: uuid.UUID | None = None
    planned_date: str | None = None


class MWOUpdate(BaseModel):
    status: str | None = None
    assigned_to: uuid.UUID | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    parts_used: dict | None = None
    labor_cost: float | None = None
    parts_cost: float | None = None
    completion_notes: str | None = None


class MWOComplete(BaseModel):
    parts_used: dict | None = None
    labor_cost: float = 0
    parts_cost: float = 0
    completion_notes: str | None = None


# ─── Asset Register ───────────────────────────────────────────────────────────

@router.post("/assets", status_code=201)
async def create_asset(body: AssetCreate, db: DBSession, user: CurrentUser):
    asset = AssetRegister(
        asset_code=body.asset_code,
        name=body.name,
        workstation_id=body.workstation_id,
        asset_type=body.asset_type,
        manufacturer=body.manufacturer,
        model_number=body.model_number,
        serial_number=body.serial_number,
        purchase_date=date_type.fromisoformat(body.purchase_date) if body.purchase_date else None,
        purchase_cost=Decimal(str(body.purchase_cost)),
        warranty_expiry=date_type.fromisoformat(body.warranty_expiry) if body.warranty_expiry else None,
        status="active",
        total_operating_hours=Decimal("0"),
        specifications=body.specifications,
        location=body.location,
        notes=body.notes,
        owner_id=user.id,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


@router.get("/assets")
async def list_assets(
    db: DBSession,
    user: CurrentUser,
    workstation_id: uuid.UUID | None = None,
    status: str | None = None,
):
    q = select(AssetRegister)
    if workstation_id:
        q = q.where(AssetRegister.workstation_id == workstation_id)
    if status:
        q = q.where(AssetRegister.status == status)
    result = await db.execute(q.order_by(AssetRegister.asset_code))
    return result.scalars().all()


@router.get("/assets/{asset_id}")
async def get_asset(asset_id: uuid.UUID, db: DBSession, user: CurrentUser):
    result = await db.execute(select(AssetRegister).where(AssetRegister.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.put("/assets/{asset_id}")
async def update_asset(
    asset_id: uuid.UUID,
    body: AssetUpdate,
    db: DBSession,
    user: CurrentUser,
):
    result = await db.execute(select(AssetRegister).where(AssetRegister.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "total_operating_hours" and value is not None:
            setattr(asset, field, Decimal(str(value)))
        else:
            setattr(asset, field, value)
    await db.commit()
    await db.refresh(asset)
    return asset


@router.get("/assets/{asset_id}/history")
async def asset_maintenance_history(
    asset_id: uuid.UUID,
    db: DBSession,
    user: CurrentUser,
):
    """Return maintenance work orders and downtime records for an asset."""
    mwo_result = await db.execute(
        select(MaintenanceWorkOrder)
        .where(MaintenanceWorkOrder.asset_id == asset_id)
        .order_by(MaintenanceWorkOrder.created_at.desc())
    )
    downtime_result = await db.execute(
        select(DowntimeRecord)
        .where(DowntimeRecord.asset_id == asset_id)
        .order_by(DowntimeRecord.start_time.desc())
    )
    return {
        "maintenance_work_orders": mwo_result.scalars().all(),
        "downtime_records": downtime_result.scalars().all(),
    }


# ─── Downtime ─────────────────────────────────────────────────────────────────

@router.post("/downtime", status_code=201)
async def log_downtime(body: DowntimeCreate, db: DBSession, user: CurrentUser):
    duration = None
    if body.end_time:
        delta = body.end_time - body.start_time
        duration = int(delta.total_seconds() / 60)

    record = DowntimeRecord(
        workstation_id=body.workstation_id,
        asset_id=body.asset_id,
        work_order_id=body.work_order_id,
        downtime_type=body.downtime_type,
        category=body.category,
        start_time=body.start_time,
        end_time=body.end_time,
        duration_minutes=duration,
        root_cause=body.root_cause,
        resolution=body.resolution,
        reported_by=user.id,
    )
    db.add(record)

    # Update workstation status
    ws_result = await db.execute(select(WorkStation).where(WorkStation.id == body.workstation_id))
    ws = ws_result.scalar_one_or_none()
    if ws and not body.end_time:
        ws.current_status = "breakdown" if body.downtime_type == "unplanned" else "maintenance"

    await db.commit()
    await db.refresh(record)
    return record


@router.get("/downtime")
async def list_downtime(
    db: DBSession,
    user: CurrentUser,
    workstation_id: uuid.UUID | None = None,
    asset_id: uuid.UUID | None = None,
    downtime_type: str | None = None,
):
    q = select(DowntimeRecord)
    if workstation_id:
        q = q.where(DowntimeRecord.workstation_id == workstation_id)
    if asset_id:
        q = q.where(DowntimeRecord.asset_id == asset_id)
    if downtime_type:
        q = q.where(DowntimeRecord.downtime_type == downtime_type)
    result = await db.execute(q.order_by(DowntimeRecord.start_time.desc()))
    return result.scalars().all()


@router.put("/downtime/{record_id}/close")
async def close_downtime(
    record_id: uuid.UUID,
    body: DowntimeClose,
    db: DBSession,
    user: CurrentUser,
):
    result = await db.execute(select(DowntimeRecord).where(DowntimeRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Downtime record not found")
    record.end_time = body.end_time
    delta = body.end_time - record.start_time
    record.duration_minutes = int(delta.total_seconds() / 60)
    if body.root_cause:
        record.root_cause = body.root_cause
    if body.resolution:
        record.resolution = body.resolution

    # Reset workstation status
    ws_result = await db.execute(select(WorkStation).where(WorkStation.id == record.workstation_id))
    ws = ws_result.scalar_one_or_none()
    if ws:
        ws.current_status = "idle"

    await db.commit()
    await db.refresh(record)
    return record


@router.get("/downtime/analysis/pareto")
async def downtime_pareto(
    db: DBSession,
    user: CurrentUser,
    workstation_id: uuid.UUID | None = None,
    days: int = 30,
):
    """Pareto analysis of downtime by category."""
    cutoff = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    from datetime import timedelta
    cutoff = cutoff - timedelta(days=days)

    q = (
        select(
            DowntimeRecord.category,
            func.count().label("occurrences"),
            func.sum(DowntimeRecord.duration_minutes).label("total_minutes"),
        )
        .where(DowntimeRecord.start_time >= cutoff)
        .group_by(DowntimeRecord.category)
        .order_by(func.sum(DowntimeRecord.duration_minutes).desc())
    )
    if workstation_id:
        q = q.where(DowntimeRecord.workstation_id == workstation_id)

    result = await db.execute(q)
    rows = result.all()
    grand_total = sum(r.total_minutes or 0 for r in rows)
    cumulative = 0
    pareto = []
    for r in rows:
        mins = r.total_minutes or 0
        cumulative += mins
        pareto.append(
            {
                "category": r.category,
                "occurrences": r.occurrences,
                "total_minutes": int(mins),
                "percent": round(mins / grand_total * 100, 1) if grand_total else 0,
                "cumulative_percent": round(cumulative / grand_total * 100, 1) if grand_total else 0,
            }
        )
    return pareto


# ─── OEE Enhanced ─────────────────────────────────────────────────────────────

@router.get("/oee/{workstation_id}")
async def get_oee_detailed(
    workstation_id: uuid.UUID,
    db: DBSession,
    user: CurrentUser,
    date_from: str | None = None,
    date_to: str | None = None,
):
    """
    OEE = Availability × Performance × Quality
    Availability = (Planned - Downtime) / Planned
    Performance  = Actual output / Theoretical max output
    Quality      = Good units / Total units
    """
    from datetime import timedelta
    from app.models.manufacturing import WorkOrder, QualityCheck

    today = date_type.today()
    d_from = date_type.fromisoformat(date_from) if date_from else today - timedelta(days=30)
    d_to = date_type.fromisoformat(date_to) if date_to else today

    # Downtime hours
    dt_result = await db.execute(
        select(func.sum(DowntimeRecord.duration_minutes)).where(
            DowntimeRecord.workstation_id == workstation_id,
            DowntimeRecord.start_time >= datetime.combine(d_from, datetime.min.time()),
            DowntimeRecord.start_time <= datetime.combine(d_to, datetime.max.time()),
        )
    )
    downtime_minutes = float(dt_result.scalar() or 0)

    # Planned minutes (capacity slots)
    from app.models.manufacturing import CapacitySlot
    cap_result = await db.execute(
        select(func.sum(CapacitySlot.total_minutes)).where(
            CapacitySlot.workstation_id == workstation_id,
            CapacitySlot.slot_date >= d_from,
            CapacitySlot.slot_date <= d_to,
        )
    )
    planned_minutes = float(cap_result.scalar() or 480 * (d_to - d_from).days)  # fallback 8h/day

    availability = max(0, (planned_minutes - downtime_minutes) / planned_minutes) if planned_minutes else 0

    # Quality (from quality checks for WOs on this workstation)
    qc_result = await db.execute(
        select(
            func.sum(QualityCheck.quantity_inspected),
            func.sum(QualityCheck.quantity_passed),
        ).join(WorkOrder, WorkOrder.id == QualityCheck.work_order_id).where(
            WorkOrder.workstation_id == workstation_id,
            QualityCheck.checked_at >= datetime.combine(d_from, datetime.min.time()),
        )
    )
    qc_row = qc_result.one()
    total_inspected = float(qc_row[0] or 0)
    total_passed = float(qc_row[1] or 0)
    quality = total_passed / total_inspected if total_inspected else 1.0

    # Performance: ratio of actual output vs planned (simplified)
    wo_result = await db.execute(
        select(
            func.sum(WorkOrder.planned_quantity),
            func.sum(WorkOrder.completed_quantity),
        ).where(
            WorkOrder.workstation_id == workstation_id,
            WorkOrder.status == "completed",
            WorkOrder.actual_end >= datetime.combine(d_from, datetime.min.time()),
        )
    )
    wo_row = wo_result.one()
    planned_qty = float(wo_row[0] or 0)
    completed_qty = float(wo_row[1] or 0)
    performance = completed_qty / planned_qty if planned_qty else 1.0
    performance = min(performance, 1.0)  # cap at 100%

    oee = availability * performance * quality

    return {
        "workstation_id": str(workstation_id),
        "period": {"from": d_from.isoformat(), "to": d_to.isoformat()},
        "oee": round(oee * 100, 1),
        "availability": round(availability * 100, 1),
        "performance": round(performance * 100, 1),
        "quality": round(quality * 100, 1),
        "planned_minutes": planned_minutes,
        "downtime_minutes": downtime_minutes,
        "total_inspected": total_inspected,
        "total_passed": total_passed,
        "planned_qty": planned_qty,
        "completed_qty": completed_qty,
    }


# ─── Maintenance Work Orders ──────────────────────────────────────────────────

@router.post("/maintenance-work-orders", status_code=201)
async def create_mwo(body: MWOCreate, db: DBSession, user: CurrentUser):
    pass
    # Auto-generate MWO number
    count_result = await db.execute(select(func.count()).select_from(MaintenanceWorkOrder))
    count = count_result.scalar() or 0
    mwo_number = f"MWO-{count + 1:05d}"

    mwo = MaintenanceWorkOrder(
        mwo_number=mwo_number,
        asset_id=body.asset_id,
        schedule_id=body.schedule_id,
        maintenance_type=body.maintenance_type,
        trigger_type=body.trigger_type,
        description=body.description,
        priority=body.priority,
        assigned_to=body.assigned_to,
        planned_date=date_type.fromisoformat(body.planned_date) if body.planned_date else None,
        status="open",
        created_by=user.id,
    )
    db.add(mwo)
    await db.commit()
    await db.refresh(mwo)
    return mwo


@router.get("/maintenance-work-orders")
async def list_mwos(
    db: DBSession,
    user: CurrentUser,
    status: str | None = None,
    asset_id: uuid.UUID | None = None,
):
    q = select(MaintenanceWorkOrder)
    if status:
        q = q.where(MaintenanceWorkOrder.status == status)
    if asset_id:
        q = q.where(MaintenanceWorkOrder.asset_id == asset_id)
    result = await db.execute(q.order_by(MaintenanceWorkOrder.created_at.desc()))
    return result.scalars().all()


@router.get("/maintenance-work-orders/{mwo_id}")
async def get_mwo(mwo_id: uuid.UUID, db: DBSession, user: CurrentUser):
    result = await db.execute(select(MaintenanceWorkOrder).where(MaintenanceWorkOrder.id == mwo_id))
    mwo = result.scalar_one_or_none()
    if not mwo:
        raise HTTPException(status_code=404, detail="Maintenance work order not found")
    return mwo


@router.put("/maintenance-work-orders/{mwo_id}")
async def update_mwo(
    mwo_id: uuid.UUID,
    body: MWOUpdate,
    db: DBSession,
    user: CurrentUser,
):
    result = await db.execute(select(MaintenanceWorkOrder).where(MaintenanceWorkOrder.id == mwo_id))
    mwo = result.scalar_one_or_none()
    if not mwo:
        raise HTTPException(status_code=404, detail="Maintenance work order not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        if field in ("labor_cost", "parts_cost") and value is not None:
            setattr(mwo, field, Decimal(str(value)))
        else:
            setattr(mwo, field, value)
    await db.commit()
    await db.refresh(mwo)
    return mwo


@router.post("/maintenance-work-orders/{mwo_id}/complete")
async def complete_mwo(
    mwo_id: uuid.UUID,
    body: MWOComplete,
    db: DBSession,
    user: CurrentUser,
):
    result = await db.execute(select(MaintenanceWorkOrder).where(MaintenanceWorkOrder.id == mwo_id))
    mwo = result.scalar_one_or_none()
    if not mwo:
        raise HTTPException(status_code=404, detail="Maintenance work order not found")
    mwo.status = "completed"
    mwo.completed_at = datetime.now()
    mwo.parts_used = body.parts_used
    mwo.labor_cost = Decimal(str(body.labor_cost))
    mwo.parts_cost = Decimal(str(body.parts_cost))
    mwo.completion_notes = body.completion_notes

    # Update asset status
    asset_result = await db.execute(select(AssetRegister).where(AssetRegister.id == mwo.asset_id))
    asset = asset_result.scalar_one_or_none()
    if asset:
        asset.status = "active"

    await db.commit()
    await db.refresh(mwo)
    return mwo
