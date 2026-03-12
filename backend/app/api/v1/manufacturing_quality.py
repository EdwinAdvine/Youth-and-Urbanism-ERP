"""Manufacturing Quality API — Inspection Plans, NCR, CAPA, SPC."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.manufacturing import (
    CAPA,
    InspectionPlan,
    InspectionPlanItem,
    NonConformanceReport,
    SPCDataPoint,
)

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

# -- Inspection Plan --

class InspectionPlanItemIn(BaseModel):
    sequence: int
    parameter_name: str
    measurement_type: str = "numeric"  # numeric, visual, boolean, text
    target_value: str | None = None
    lower_limit: Decimal | None = None
    upper_limit: Decimal | None = None
    unit_of_measure: str | None = None
    is_critical: bool = False
    instructions: str | None = None
    sample_size: int = 1


class InspectionPlanItemOut(BaseModel):
    id: uuid.UUID
    plan_id: uuid.UUID
    sequence: int
    parameter_name: str
    measurement_type: str
    target_value: str | None
    lower_limit: Decimal | None
    upper_limit: Decimal | None
    unit_of_measure: str | None
    is_critical: bool
    instructions: str | None
    sample_size: int

    model_config = {"from_attributes": True}


class InspectionPlanCreate(BaseModel):
    name: str
    description: str | None = None
    bom_id: uuid.UUID | None = None
    routing_step_id: uuid.UUID | None = None
    items: list[InspectionPlanItemIn] = []


class InspectionPlanUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class InspectionPlanOut(BaseModel):
    id: uuid.UUID
    plan_number: str
    name: str
    description: str | None
    bom_id: uuid.UUID | None
    routing_step_id: uuid.UUID | None
    is_active: bool
    version: int
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class InspectionPlanDetailOut(InspectionPlanOut):
    items: list[InspectionPlanItemOut] = []


# -- NCR --

class NCRCreate(BaseModel):
    work_order_id: uuid.UUID | None = None
    quality_check_id: uuid.UUID | None = None
    item_id: uuid.UUID | None = None
    supplier_id: uuid.UUID | None = None
    description: str
    severity: str = "major"  # minor, major, critical
    quantity_affected: int = 0
    assigned_to: uuid.UUID | None = None


class NCRUpdate(BaseModel):
    description: str | None = None
    severity: str | None = None
    status: str | None = None
    root_cause: str | None = None
    disposition: str | None = None
    assigned_to: uuid.UUID | None = None
    resolution_notes: str | None = None


class NCROut(BaseModel):
    id: uuid.UUID
    ncr_number: str
    work_order_id: uuid.UUID | None
    quality_check_id: uuid.UUID | None
    item_id: uuid.UUID | None
    supplier_id: uuid.UUID | None
    description: str
    severity: str
    status: str
    quantity_affected: int
    root_cause: str | None
    disposition: str | None
    reported_by: uuid.UUID
    assigned_to: uuid.UUID | None
    resolved_at: datetime | None
    resolution_notes: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- CAPA --

class CAPACreate(BaseModel):
    ncr_id: uuid.UUID | None = None
    capa_type: str = "corrective"  # corrective, preventive
    description: str
    root_cause_analysis: str | None = None
    corrective_action: str | None = None
    preventive_action: str | None = None
    priority: str = "medium"
    assigned_to: uuid.UUID | None = None
    due_date: date | None = None


class CAPAUpdate(BaseModel):
    description: str | None = None
    root_cause_analysis: str | None = None
    corrective_action: str | None = None
    preventive_action: str | None = None
    status: str | None = None
    priority: str | None = None
    assigned_to: uuid.UUID | None = None
    due_date: date | None = None


class CAPAOut(BaseModel):
    id: uuid.UUID
    capa_number: str
    ncr_id: uuid.UUID | None
    capa_type: str
    description: str
    root_cause_analysis: str | None
    corrective_action: str | None
    preventive_action: str | None
    status: str
    priority: str
    assigned_to: uuid.UUID | None
    due_date: date | None
    completed_at: datetime | None
    effectiveness_verified: bool
    verification_notes: str | None
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class CAPAVerifyIn(BaseModel):
    verification_notes: str
    is_effective: bool = True


# -- SPC --

class SPCDataPointIn(BaseModel):
    inspection_plan_item_id: uuid.UUID
    work_order_id: uuid.UUID
    measured_value: Decimal
    sample_number: int
    subgroup: int | None = None


class SPCDataPointOut(BaseModel):
    id: uuid.UUID
    inspection_plan_item_id: uuid.UUID
    work_order_id: uuid.UUID
    measured_value: Decimal
    measured_at: datetime
    sample_number: int
    subgroup: int | None
    recorded_by: uuid.UUID
    is_out_of_control: bool

    model_config = {"from_attributes": True}


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _next_plan_number(db: DBSession) -> str:
    result = await db.execute(select(func.count(InspectionPlan.id)))
    count = result.scalar() or 0
    return f"IP-{count + 1:05d}"


async def _next_ncr_number(db: DBSession) -> str:
    result = await db.execute(select(func.count(NonConformanceReport.id)))
    count = result.scalar() or 0
    return f"NCR-{count + 1:05d}"


async def _next_capa_number(db: DBSession) -> str:
    result = await db.execute(select(func.count(CAPA.id)))
    count = result.scalar() or 0
    return f"CAPA-{count + 1:05d}"


# ── Inspection Plan Endpoints ────────────────────────────────────────────────

@router.post("/inspection-plans", response_model=InspectionPlanDetailOut, status_code=status.HTTP_201_CREATED)
async def create_inspection_plan(body: InspectionPlanCreate, db: DBSession, user: CurrentUser):
    plan = InspectionPlan(
        plan_number=await _next_plan_number(db),
        name=body.name,
        description=body.description,
        bom_id=body.bom_id,
        routing_step_id=body.routing_step_id,
        owner_id=user.id,
    )
    db.add(plan)
    await db.flush()

    for item_data in body.items:
        item = InspectionPlanItem(
            plan_id=plan.id,
            **item_data.model_dump(),
        )
        db.add(item)

    await db.commit()
    # Re-fetch with items
    result = await db.execute(
        select(InspectionPlan)
        .options(selectinload(InspectionPlan.items))
        .where(InspectionPlan.id == plan.id)
    )
    return result.scalar_one()


@router.get("/inspection-plans", response_model=list[InspectionPlanOut])
async def list_inspection_plans(
    db: DBSession,
    user: CurrentUser,
    bom_id: uuid.UUID | None = None,
    is_active: bool | None = None,
    skip: int = 0,
    limit: int = 50,
):
    q = select(InspectionPlan).order_by(InspectionPlan.created_at.desc())
    if bom_id:
        q = q.where(InspectionPlan.bom_id == bom_id)
    if is_active is not None:
        q = q.where(InspectionPlan.is_active == is_active)
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/inspection-plans/{plan_id}", response_model=InspectionPlanDetailOut)
async def get_inspection_plan(plan_id: uuid.UUID, db: DBSession, user: CurrentUser):
    result = await db.execute(
        select(InspectionPlan)
        .options(selectinload(InspectionPlan.items))
        .where(InspectionPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Inspection plan not found")
    return plan


@router.put("/inspection-plans/{plan_id}", response_model=InspectionPlanOut)
async def update_inspection_plan(plan_id: uuid.UUID, body: InspectionPlanUpdate, db: DBSession, user: CurrentUser):
    plan = await db.get(InspectionPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Inspection plan not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)
    await db.commit()
    await db.refresh(plan)
    return plan


@router.post("/inspection-plans/{plan_id}/items", response_model=InspectionPlanItemOut, status_code=status.HTTP_201_CREATED)
async def add_inspection_plan_item(plan_id: uuid.UUID, body: InspectionPlanItemIn, db: DBSession, user: CurrentUser):
    plan = await db.get(InspectionPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Inspection plan not found")

    item = InspectionPlanItem(plan_id=plan_id, **body.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/inspection-plans/{plan_id}/items/{item_id}", status_code=status.HTTP_200_OK)
async def delete_inspection_plan_item(plan_id: uuid.UUID, item_id: uuid.UUID, db: DBSession, user: CurrentUser):
    item = await db.get(InspectionPlanItem, item_id)
    if not item or item.plan_id != plan_id:
        raise HTTPException(status_code=404, detail="Inspection plan item not found")
    await db.delete(item)
    await db.commit()


# ── NCR Endpoints ────────────────────────────────────────────────────────────

@router.post("/ncr", response_model=NCROut, status_code=status.HTTP_201_CREATED)
async def create_ncr(body: NCRCreate, db: DBSession, user: CurrentUser):
    ncr = NonConformanceReport(
        ncr_number=await _next_ncr_number(db),
        work_order_id=body.work_order_id,
        quality_check_id=body.quality_check_id,
        item_id=body.item_id,
        supplier_id=body.supplier_id,
        description=body.description,
        severity=body.severity,
        quantity_affected=body.quantity_affected,
        reported_by=user.id,
        assigned_to=body.assigned_to,
    )
    db.add(ncr)
    await db.commit()
    await db.refresh(ncr)

    await event_bus.publish("ncr.created", {
        "ncr_id": str(ncr.id),
        "ncr_number": ncr.ncr_number,
        "severity": ncr.severity,
        "work_order_id": str(ncr.work_order_id) if ncr.work_order_id else None,
        "reported_by": str(ncr.reported_by),
    })
    return ncr


@router.get("/ncr", response_model=list[NCROut])
async def list_ncrs(
    db: DBSession,
    user: CurrentUser,
    ncr_status: str | None = Query(None, alias="status"),
    severity: str | None = None,
    work_order_id: uuid.UUID | None = None,
    supplier_id: uuid.UUID | None = None,
    skip: int = 0,
    limit: int = 50,
):
    q = select(NonConformanceReport).order_by(NonConformanceReport.created_at.desc())
    if ncr_status:
        q = q.where(NonConformanceReport.status == ncr_status)
    if severity:
        q = q.where(NonConformanceReport.severity == severity)
    if work_order_id:
        q = q.where(NonConformanceReport.work_order_id == work_order_id)
    if supplier_id:
        q = q.where(NonConformanceReport.supplier_id == supplier_id)
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/ncr/{ncr_id}", response_model=NCROut)
async def get_ncr(ncr_id: uuid.UUID, db: DBSession, user: CurrentUser):
    ncr = await db.get(NonConformanceReport, ncr_id)
    if not ncr:
        raise HTTPException(status_code=404, detail="NCR not found")
    return ncr


@router.put("/ncr/{ncr_id}", response_model=NCROut)
async def update_ncr(ncr_id: uuid.UUID, body: NCRUpdate, db: DBSession, user: CurrentUser):
    ncr = await db.get(NonConformanceReport, ncr_id)
    if not ncr:
        raise HTTPException(status_code=404, detail="NCR not found")

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(ncr, field, value)

    # Auto-set resolved_at when status changes to resolved
    if "status" in updates and updates["status"] == "resolved":
        ncr.resolved_at = func.now()

    await db.commit()
    await db.refresh(ncr)
    return ncr


@router.get("/quality/supplier-scorecard/{supplier_id}")
async def supplier_quality_scorecard(supplier_id: uuid.UUID, db: DBSession, user: CurrentUser):
    # Count NCRs by severity
    ncr_result = await db.execute(
        select(
            NonConformanceReport.severity,
            func.count(NonConformanceReport.id),
        )
        .where(NonConformanceReport.supplier_id == supplier_id)
        .group_by(NonConformanceReport.severity)
    )
    ncr_by_severity = {row[0]: row[1] for row in ncr_result.all()}

    # Total NCRs
    total_result = await db.execute(
        select(func.count(NonConformanceReport.id))
        .where(NonConformanceReport.supplier_id == supplier_id)
    )
    total_ncrs = total_result.scalar() or 0

    # Open NCRs
    open_result = await db.execute(
        select(func.count(NonConformanceReport.id))
        .where(
            NonConformanceReport.supplier_id == supplier_id,
            NonConformanceReport.status.in_(["open", "investigating"]),
        )
    )
    open_ncrs = open_result.scalar() or 0

    return {
        "supplier_id": str(supplier_id),
        "total_ncrs": total_ncrs,
        "open_ncrs": open_ncrs,
        "ncrs_by_severity": ncr_by_severity,
        "quality_score": max(0, 100 - (ncr_by_severity.get("critical", 0) * 20)
                           - (ncr_by_severity.get("major", 0) * 10)
                           - (ncr_by_severity.get("minor", 0) * 3)),
    }


# ── CAPA Endpoints ───────────────────────────────────────────────────────────

@router.post("/capa", response_model=CAPAOut, status_code=status.HTTP_201_CREATED)
async def create_capa(body: CAPACreate, db: DBSession, user: CurrentUser):
    capa = CAPA(
        capa_number=await _next_capa_number(db),
        ncr_id=body.ncr_id,
        capa_type=body.capa_type,
        description=body.description,
        root_cause_analysis=body.root_cause_analysis,
        corrective_action=body.corrective_action,
        preventive_action=body.preventive_action,
        priority=body.priority,
        assigned_to=body.assigned_to,
        due_date=body.due_date,
        created_by=user.id,
    )
    db.add(capa)
    await db.commit()
    await db.refresh(capa)
    return capa


@router.get("/capa", response_model=list[CAPAOut])
async def list_capas(
    db: DBSession,
    user: CurrentUser,
    capa_status: str | None = Query(None, alias="status"),
    capa_type: str | None = None,
    ncr_id: uuid.UUID | None = None,
    skip: int = 0,
    limit: int = 50,
):
    q = select(CAPA).order_by(CAPA.created_at.desc())
    if capa_status:
        q = q.where(CAPA.status == capa_status)
    if capa_type:
        q = q.where(CAPA.capa_type == capa_type)
    if ncr_id:
        q = q.where(CAPA.ncr_id == ncr_id)
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/capa/{capa_id}", response_model=CAPAOut)
async def get_capa(capa_id: uuid.UUID, db: DBSession, user: CurrentUser):
    capa = await db.get(CAPA, capa_id)
    if not capa:
        raise HTTPException(status_code=404, detail="CAPA not found")
    return capa


@router.put("/capa/{capa_id}", response_model=CAPAOut)
async def update_capa(capa_id: uuid.UUID, body: CAPAUpdate, db: DBSession, user: CurrentUser):
    capa = await db.get(CAPA, capa_id)
    if not capa:
        raise HTTPException(status_code=404, detail="CAPA not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(capa, field, value)
    await db.commit()
    await db.refresh(capa)
    return capa


@router.post("/capa/{capa_id}/verify", response_model=CAPAOut)
async def verify_capa(capa_id: uuid.UUID, body: CAPAVerifyIn, db: DBSession, user: CurrentUser):
    capa = await db.get(CAPA, capa_id)
    if not capa:
        raise HTTPException(status_code=404, detail="CAPA not found")
    if capa.status != "verification":
        raise HTTPException(status_code=400, detail="CAPA must be in verification status")

    capa.effectiveness_verified = body.is_effective
    capa.verification_notes = body.verification_notes
    if body.is_effective:
        capa.status = "closed"
        capa.completed_at = func.now()
    else:
        capa.status = "in_progress"  # Reopen if not effective

    await db.commit()
    await db.refresh(capa)
    return capa


# ── SPC Endpoints ────────────────────────────────────────────────────────────

@router.post("/spc/data-points", response_model=SPCDataPointOut, status_code=status.HTTP_201_CREATED)
async def record_spc_data_point(body: SPCDataPointIn, db: DBSession, user: CurrentUser):
    # Check if out of control
    plan_item = await db.get(InspectionPlanItem, body.inspection_plan_item_id)
    if not plan_item:
        raise HTTPException(status_code=404, detail="Inspection plan item not found")

    is_out_of_control = False
    if plan_item.lower_limit is not None and body.measured_value < plan_item.lower_limit:
        is_out_of_control = True
    if plan_item.upper_limit is not None and body.measured_value > plan_item.upper_limit:
        is_out_of_control = True

    data_point = SPCDataPoint(
        inspection_plan_item_id=body.inspection_plan_item_id,
        work_order_id=body.work_order_id,
        measured_value=body.measured_value,
        sample_number=body.sample_number,
        subgroup=body.subgroup,
        recorded_by=user.id,
        is_out_of_control=is_out_of_control,
    )
    db.add(data_point)
    await db.commit()
    await db.refresh(data_point)
    return data_point


@router.get("/spc/control-chart/{plan_item_id}")
async def get_spc_control_chart(
    plan_item_id: uuid.UUID,
    db: DBSession,
    user: CurrentUser,
    work_order_id: uuid.UUID | None = None,
    limit: int = 100,
):
    plan_item = await db.get(InspectionPlanItem, plan_item_id)
    if not plan_item:
        raise HTTPException(status_code=404, detail="Inspection plan item not found")

    q = (
        select(SPCDataPoint)
        .where(SPCDataPoint.inspection_plan_item_id == plan_item_id)
        .order_by(SPCDataPoint.measured_at.desc())
        .limit(limit)
    )
    if work_order_id:
        q = q.where(SPCDataPoint.work_order_id == work_order_id)

    result = await db.execute(q)
    data_points = result.scalars().all()

    # Calculate SPC statistics
    values = [float(dp.measured_value) for dp in data_points]
    mean = sum(values) / len(values) if values else 0
    std_dev = (sum((v - mean) ** 2 for v in values) / len(values)) ** 0.5 if len(values) > 1 else 0

    return {
        "plan_item": {
            "id": str(plan_item.id),
            "parameter_name": plan_item.parameter_name,
            "target_value": plan_item.target_value,
            "lower_limit": float(plan_item.lower_limit) if plan_item.lower_limit else None,
            "upper_limit": float(plan_item.upper_limit) if plan_item.upper_limit else None,
        },
        "statistics": {
            "mean": round(mean, 4),
            "std_dev": round(std_dev, 4),
            "ucl": round(mean + 3 * std_dev, 4) if std_dev else None,
            "lcl": round(mean - 3 * std_dev, 4) if std_dev else None,
            "total_points": len(values),
            "out_of_control_count": sum(1 for dp in data_points if dp.is_out_of_control),
        },
        "data_points": [
            {
                "id": str(dp.id),
                "measured_value": float(dp.measured_value),
                "measured_at": dp.measured_at.isoformat() if dp.measured_at else None,
                "sample_number": dp.sample_number,
                "subgroup": dp.subgroup,
                "is_out_of_control": dp.is_out_of_control,
            }
            for dp in reversed(data_points)
        ],
    }
