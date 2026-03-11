"""Supply Chain Ops API — Control Tower, RFx, Risks, Replenishment, Workflows, Compliance, ESG, Analytics."""
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
from app.models.inventory import StockLevel
from app.models.supplychain_ops import (
    ComplianceRecord,
    ControlTowerAlert,
    ESGMetric,
    ReplenishmentRule,
    RFx,
    RFxResponse,
    SafetyStockConfig,
    StockHealthScore,
    SupplierRisk,
    SupplyChainEvent,
    SupplyChainKPI,
    WorkflowRun,
    WorkflowStep,
    WorkflowTemplate,
)

router = APIRouter()


# ── Pydantic Schemas ─────────────────────────────────────────────────────────

# -- Control Tower --

class AlertCreate(BaseModel):
    alert_type: str
    severity: str = "medium"
    title: str
    description: str | None = None
    source_module: str | None = None
    source_entity_id: uuid.UUID | None = None
    assigned_to: uuid.UUID | None = None
    metadata_json: dict | None = None


class AlertUpdate(BaseModel):
    status: str | None = None
    assigned_to: uuid.UUID | None = None
    severity: str | None = None


class AlertOut(BaseModel):
    id: uuid.UUID
    alert_type: str
    severity: str
    title: str
    description: str | None
    source_module: str | None
    source_entity_id: uuid.UUID | None
    status: str
    assigned_to: uuid.UUID | None
    resolved_at: Any | None
    metadata_json: dict | None
    created_at: Any
    model_config = {"from_attributes": True}


class KPIOut(BaseModel):
    id: uuid.UUID
    kpi_name: str
    period: str
    value: Any
    target: Any | None
    unit: str
    dimension: str | None
    dimension_value: str | None
    created_at: Any
    model_config = {"from_attributes": True}


class EventOut(BaseModel):
    id: uuid.UUID
    event_type: str
    entity_type: str
    entity_id: uuid.UUID
    description: str | None
    severity: str
    metadata_json: dict | None
    occurred_at: Any
    model_config = {"from_attributes": True}


# -- RFx --

class RFxCreate(BaseModel):
    rfx_type: str
    title: str
    description: str | None = None
    deadline: datetime | None = None
    items: dict | None = None
    invited_suppliers: list[str] | None = None


class RFxUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    deadline: datetime | None = None
    items: dict | None = None


class RFxOut(BaseModel):
    id: uuid.UUID
    rfx_number: str
    rfx_type: str
    title: str
    description: str | None
    status: str
    deadline: Any | None
    created_by: uuid.UUID
    items: dict | None
    invited_suppliers: list[str] | None
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


class RFxResponseCreate(BaseModel):
    supplier_id: uuid.UUID
    quoted_items: dict | None = None
    total_value: Decimal = Decimal("0")
    lead_time_days: int | None = None
    notes: str | None = None


class RFxResponseUpdate(BaseModel):
    score: Decimal | None = None
    status: str | None = None


class RFxResponseOut(BaseModel):
    id: uuid.UUID
    rfx_id: uuid.UUID
    supplier_id: uuid.UUID
    submitted_at: Any
    status: str
    quoted_items: dict | None
    total_value: Any
    lead_time_days: int | None
    notes: str | None
    score: Any | None
    created_at: Any
    model_config = {"from_attributes": True}


# -- Supplier Risk --

class SupplierRiskCreate(BaseModel):
    supplier_id: uuid.UUID
    risk_type: str
    severity: str = "medium"
    description: str
    source: str | None = "manual"
    mitigation_notes: str | None = None


class SupplierRiskOut(BaseModel):
    id: uuid.UUID
    supplier_id: uuid.UUID
    risk_type: str
    severity: str
    description: str
    source: str | None
    mitigation_notes: str | None
    status: str
    detected_at: Any
    last_reviewed_at: Any | None
    created_at: Any
    model_config = {"from_attributes": True}


# -- Replenishment --

class ReplenishmentRuleCreate(BaseModel):
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    rule_type: str = "reorder_point"
    min_level: int = 0
    max_level: int = 0
    reorder_point: int = 0
    reorder_quantity: int = 0
    lead_time_days: int = 7
    supplier_id: uuid.UUID | None = None
    auto_generate_po: bool = False


class ReplenishmentRuleUpdate(BaseModel):
    rule_type: str | None = None
    min_level: int | None = None
    max_level: int | None = None
    reorder_point: int | None = None
    reorder_quantity: int | None = None
    lead_time_days: int | None = None
    supplier_id: uuid.UUID | None = None
    is_active: bool | None = None
    auto_generate_po: bool | None = None


class ReplenishmentRuleOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    rule_type: str
    min_level: int
    max_level: int
    reorder_point: int
    reorder_quantity: int
    lead_time_days: int
    supplier_id: uuid.UUID | None
    is_active: bool
    auto_generate_po: bool
    last_triggered_at: Any | None
    created_at: Any
    model_config = {"from_attributes": True}


# -- Safety Stock --

class SafetyStockUpdate(BaseModel):
    method: str | None = None
    safety_stock_qty: int | None = None
    service_level_pct: Decimal | None = None


class SafetyStockOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    method: str
    safety_stock_qty: int
    service_level_pct: Any | None
    demand_std_dev: Any | None
    lead_time_std_dev: Any | None
    recalculated_at: Any | None
    created_at: Any
    model_config = {"from_attributes": True}


# -- Stock Health --

class StockHealthOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    warehouse_id: uuid.UUID | None
    health_status: str
    days_of_stock: int
    turnover_rate: Any
    last_movement_date: date | None
    recommended_action: str
    calculated_at: Any
    model_config = {"from_attributes": True}


# -- Workflows --

class WorkflowTemplateCreate(BaseModel):
    name: str
    description: str | None = None
    trigger_event: str
    steps: dict | None = None


class WorkflowTemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    trigger_event: str | None = None
    steps: dict | None = None
    is_active: bool | None = None


class WorkflowTemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    trigger_event: str
    steps: dict | None
    is_active: bool
    created_by: uuid.UUID
    created_at: Any
    model_config = {"from_attributes": True}


class WorkflowRunOut(BaseModel):
    id: uuid.UUID
    template_id: uuid.UUID
    trigger_data: dict | None
    status: str
    started_at: Any
    completed_at: Any | None
    error_message: str | None
    created_at: Any
    model_config = {"from_attributes": True}


class WorkflowStepOut(BaseModel):
    id: uuid.UUID
    run_id: uuid.UUID
    step_index: int
    action: str
    params: dict | None
    status: str
    result: dict | None
    started_at: Any | None
    completed_at: Any | None
    model_config = {"from_attributes": True}


# -- Compliance & ESG --

class ComplianceCreate(BaseModel):
    entity_type: str
    entity_id: uuid.UUID
    compliance_type: str
    status: str = "pending_review"
    details: dict | None = None
    expiry_date: date | None = None


class ComplianceUpdate(BaseModel):
    status: str | None = None
    details: dict | None = None
    expiry_date: date | None = None


class ComplianceOut(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    compliance_type: str
    status: str
    details: dict | None
    expiry_date: date | None
    reviewed_by: uuid.UUID | None
    reviewed_at: Any | None
    created_at: Any
    model_config = {"from_attributes": True}


class ESGMetricCreate(BaseModel):
    supplier_id: uuid.UUID | None = None
    metric_type: str
    period: str
    value: Decimal
    unit: str
    benchmark: Decimal | None = None
    source: str | None = None


class ESGMetricOut(BaseModel):
    id: uuid.UUID
    supplier_id: uuid.UUID | None
    metric_type: str
    period: str
    value: Any
    unit: str
    benchmark: Any | None
    source: str | None
    created_at: Any
    model_config = {"from_attributes": True}


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _next_rfx_number(db: DBSession) -> str:
    year = datetime.utcnow().year
    pattern = f"RFX-{year}-%"
    result = await db.execute(
        select(func.count()).select_from(RFx).where(RFx.rfx_number.like(pattern))
    )
    count = (result.scalar() or 0) + 1
    return f"RFX-{year}-{count:04d}"


# ══════════════════════════════════════════════════════════════════════════════
# CONTROL TOWER
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/control-tower/dashboard", summary="Control tower overview")
async def control_tower_dashboard(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Open alerts by severity
    alert_counts = await db.execute(
        select(ControlTowerAlert.severity, func.count())
        .where(ControlTowerAlert.status == "open")
        .group_by(ControlTowerAlert.severity)
    )
    alerts_by_severity = {row[0]: row[1] for row in alert_counts.all()}

    # Latest KPIs
    kpi_rows = await db.execute(
        select(SupplyChainKPI)
        .order_by(SupplyChainKPI.created_at.desc())
        .limit(10)
    )
    kpis = [KPIOut.model_validate(k) for k in kpi_rows.scalars().all()]

    # Recent events
    event_rows = await db.execute(
        select(SupplyChainEvent)
        .order_by(SupplyChainEvent.occurred_at.desc())
        .limit(20)
    )
    events = [EventOut.model_validate(e) for e in event_rows.scalars().all()]

    # Total open alerts
    total_open = await db.execute(
        select(func.count()).select_from(ControlTowerAlert)
        .where(ControlTowerAlert.status == "open")
    )

    return {
        "alerts_by_severity": alerts_by_severity,
        "total_open_alerts": total_open.scalar() or 0,
        "kpis": [k.model_dump() for k in kpis],
        "recent_events": [e.model_dump() for e in events],
    }


@router.get("/control-tower/alerts", summary="List control tower alerts")
async def list_alerts(
    current_user: CurrentUser,
    db: DBSession,
    severity: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    alert_type: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(ControlTowerAlert)
    if severity:
        query = query.where(ControlTowerAlert.severity == severity)
    if status_filter:
        query = query.where(ControlTowerAlert.status == status_filter)
    if alert_type:
        query = query.where(ControlTowerAlert.alert_type == alert_type)
    total = await db.execute(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(
        query.order_by(ControlTowerAlert.created_at.desc()).offset(skip).limit(limit)
    )
    return {
        "total": total.scalar() or 0,
        "alerts": [AlertOut.model_validate(r) for r in rows.scalars().all()],
    }


@router.post(
    "/control-tower/alerts",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def create_alert(
    payload: AlertCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    alert = ControlTowerAlert(
        alert_type=payload.alert_type,
        severity=payload.severity,
        title=payload.title,
        description=payload.description,
        source_module=payload.source_module,
        source_entity_id=payload.source_entity_id,
        assigned_to=payload.assigned_to,
        metadata_json=payload.metadata_json,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    await event_bus.publish("supplychain.alert.created", {
        "alert_id": str(alert.id),
        "alert_type": alert.alert_type,
        "severity": alert.severity,
    })
    return {"id": str(alert.id), "title": alert.title}


@router.put(
    "/control-tower/alerts/{alert_id}",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def update_alert(
    alert_id: uuid.UUID,
    payload: AlertUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(ControlTowerAlert).where(ControlTowerAlert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(404, "Alert not found")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(alert, field, val)
    if payload.status == "resolved":
        alert.resolved_at = datetime.utcnow()
    await db.commit()
    await db.refresh(alert)
    return AlertOut.model_validate(alert).model_dump()


@router.get("/control-tower/kpis", summary="List supply chain KPIs")
async def list_kpis(
    current_user: CurrentUser,
    db: DBSession,
    kpi_name: str | None = Query(None),
    period: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    query = select(SupplyChainKPI)
    if kpi_name:
        query = query.where(SupplyChainKPI.kpi_name == kpi_name)
    if period:
        query = query.where(SupplyChainKPI.period == period)
    total = await db.execute(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(
        query.order_by(SupplyChainKPI.created_at.desc()).offset(skip).limit(limit)
    )
    return {
        "total": total.scalar() or 0,
        "kpis": [KPIOut.model_validate(r) for r in rows.scalars().all()],
    }


@router.post(
    "/control-tower/kpis/calculate",
    dependencies=[Depends(require_app_admin("supply_chain"))],
    summary="Trigger KPI recalculation",
)
async def calculate_kpis(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Calculate key SC KPIs for the current period."""
    from app.models.supplychain import Shipment

    period = datetime.utcnow().strftime("%Y-%m")
    kpis_created = 0

    # OTIF rate (on-time in-full): delivered shipments / total shipments
    total_shipments = await db.execute(
        select(func.count()).select_from(Shipment)
    )
    delivered = await db.execute(
        select(func.count()).select_from(Shipment).where(Shipment.status == "delivered")
    )
    total_s = total_shipments.scalar() or 0
    delivered_s = delivered.scalar() or 0
    otif = (delivered_s / total_s * 100) if total_s > 0 else 0

    kpi = SupplyChainKPI(
        kpi_name="otif_rate", period=period,
        value=Decimal(str(round(otif, 2))), unit="percent",
    )
    db.add(kpi)
    kpis_created += 1

    # Inventory turns placeholder
    kpi2 = SupplyChainKPI(
        kpi_name="inventory_turns", period=period,
        value=Decimal("0"), unit="ratio",
    )
    db.add(kpi2)
    kpis_created += 1

    await db.commit()
    return {"period": period, "kpis_calculated": kpis_created}


@router.get("/control-tower/events", summary="List SC events timeline")
async def list_events(
    current_user: CurrentUser,
    db: DBSession,
    event_type: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    query = select(SupplyChainEvent)
    if event_type:
        query = query.where(SupplyChainEvent.event_type == event_type)
    total = await db.execute(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(
        query.order_by(SupplyChainEvent.occurred_at.desc()).offset(skip).limit(limit)
    )
    return {
        "total": total.scalar() or 0,
        "events": [EventOut.model_validate(r) for r in rows.scalars().all()],
    }


@router.get("/control-tower/health", summary="Overall SC health score")
async def sc_health(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    open_critical = await db.execute(
        select(func.count()).select_from(ControlTowerAlert).where(
            ControlTowerAlert.status == "open",
            ControlTowerAlert.severity == "critical",
        )
    )
    open_high = await db.execute(
        select(func.count()).select_from(ControlTowerAlert).where(
            ControlTowerAlert.status == "open",
            ControlTowerAlert.severity == "high",
        )
    )
    critical = open_critical.scalar() or 0
    high = open_high.scalar() or 0
    # Simple health score: 100 - (critical * 20) - (high * 5), clamped 0-100
    score = max(0, min(100, 100 - critical * 20 - high * 5))
    return {
        "health_score": score,
        "open_critical_alerts": critical,
        "open_high_alerts": high,
        "status": "healthy" if score >= 80 else "at_risk" if score >= 50 else "critical",
    }


# ══════════════════════════════════════════════════════════════════════════════
# RFx (Request for Quote / Proposal / Information)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/rfx", summary="List RFx")
async def list_rfx(
    current_user: CurrentUser,
    db: DBSession,
    rfx_type: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(RFx)
    if rfx_type:
        query = query.where(RFx.rfx_type == rfx_type)
    if status_filter:
        query = query.where(RFx.status == status_filter)
    total = await db.execute(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(
        query.order_by(RFx.created_at.desc()).offset(skip).limit(limit)
    )
    return {
        "total": total.scalar() or 0,
        "rfx_list": [RFxOut.model_validate(r) for r in rows.scalars().all()],
    }


@router.post(
    "/rfx",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def create_rfx(
    payload: RFxCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    rfx = RFx(
        rfx_number=await _next_rfx_number(db),
        rfx_type=payload.rfx_type,
        title=payload.title,
        description=payload.description,
        deadline=payload.deadline,
        items=payload.items,
        invited_suppliers=payload.invited_suppliers,
        created_by=current_user.id,
    )
    db.add(rfx)
    await db.commit()
    await db.refresh(rfx)
    return {"id": str(rfx.id), "rfx_number": rfx.rfx_number}


@router.get("/rfx/{rfx_id}", summary="Get RFx detail")
async def get_rfx(
    rfx_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(RFx).options(selectinload(RFx.responses)).where(RFx.id == rfx_id)
    )
    rfx = result.scalar_one_or_none()
    if not rfx:
        raise HTTPException(404, "RFx not found")
    return {
        **RFxOut.model_validate(rfx).model_dump(),
        "responses": [RFxResponseOut.model_validate(r) for r in rfx.responses],
    }


@router.put(
    "/rfx/{rfx_id}",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def update_rfx(
    rfx_id: uuid.UUID,
    payload: RFxUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(select(RFx).where(RFx.id == rfx_id))
    rfx = result.scalar_one_or_none()
    if not rfx:
        raise HTTPException(404, "RFx not found")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(rfx, field, val)
    await db.commit()
    await db.refresh(rfx)
    return RFxOut.model_validate(rfx).model_dump()


@router.post(
    "/rfx/{rfx_id}/publish",
    dependencies=[Depends(require_app_admin("supply_chain"))],
    summary="Publish RFx to suppliers",
)
async def publish_rfx(
    rfx_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(select(RFx).where(RFx.id == rfx_id))
    rfx = result.scalar_one_or_none()
    if not rfx:
        raise HTTPException(404, "RFx not found")
    if rfx.status != "draft":
        raise HTTPException(400, f"Cannot publish RFx in status '{rfx.status}'")
    rfx.status = "published"
    await db.commit()
    await event_bus.publish("supplychain.rfx.published", {
        "rfx_id": str(rfx.id),
        "rfx_type": rfx.rfx_type,
        "invited_suppliers": rfx.invited_suppliers or [],
    })
    return {"id": str(rfx.id), "status": "published"}


@router.post(
    "/rfx/{rfx_id}/close",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def close_rfx(
    rfx_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(select(RFx).where(RFx.id == rfx_id))
    rfx = result.scalar_one_or_none()
    if not rfx:
        raise HTTPException(404, "RFx not found")
    rfx.status = "closed"
    await db.commit()
    return {"id": str(rfx.id), "status": "closed"}


@router.post(
    "/rfx/{rfx_id}/award/{response_id}",
    dependencies=[Depends(require_app_admin("supply_chain"))],
    summary="Award RFx to a supplier",
)
async def award_rfx(
    rfx_id: uuid.UUID,
    response_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(RFx).options(selectinload(RFx.responses)).where(RFx.id == rfx_id)
    )
    rfx = result.scalar_one_or_none()
    if not rfx:
        raise HTTPException(404, "RFx not found")

    winning = None
    for resp in rfx.responses:
        if resp.id == response_id:
            resp.status = "awarded"
            winning = resp
        else:
            if resp.status not in ("rejected",):
                resp.status = "rejected"

    if not winning:
        raise HTTPException(404, "Response not found on this RFx")

    rfx.status = "awarded"
    await db.commit()
    await event_bus.publish("supplychain.rfx.awarded", {
        "rfx_id": str(rfx.id),
        "supplier_id": str(winning.supplier_id),
        "total_value": str(winning.total_value),
    })
    return {"id": str(rfx.id), "status": "awarded", "winning_supplier_id": str(winning.supplier_id)}


@router.get("/rfx/{rfx_id}/responses", summary="List responses for an RFx")
async def list_rfx_responses(
    rfx_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    rows = await db.execute(
        select(RFxResponse).where(RFxResponse.rfx_id == rfx_id)
        .order_by(RFxResponse.submitted_at.desc())
    )
    return {
        "responses": [RFxResponseOut.model_validate(r) for r in rows.scalars().all()],
    }


@router.post(
    "/rfx/{rfx_id}/responses",
    status_code=status.HTTP_201_CREATED,
    summary="Submit a supplier response to an RFx",
)
async def submit_rfx_response(
    rfx_id: uuid.UUID,
    payload: RFxResponseCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(select(RFx).where(RFx.id == rfx_id))
    rfx = result.scalar_one_or_none()
    if not rfx:
        raise HTTPException(404, "RFx not found")
    if rfx.status != "published":
        raise HTTPException(400, "RFx is not open for responses")

    resp = RFxResponse(
        rfx_id=rfx_id,
        supplier_id=payload.supplier_id,
        quoted_items=payload.quoted_items,
        total_value=payload.total_value,
        lead_time_days=payload.lead_time_days,
        notes=payload.notes,
    )
    db.add(resp)
    await db.commit()
    await db.refresh(resp)
    return {"id": str(resp.id), "rfx_id": str(rfx_id)}


@router.put(
    "/rfx/{rfx_id}/responses/{response_id}/score",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def score_rfx_response(
    rfx_id: uuid.UUID,
    response_id: uuid.UUID,
    payload: RFxResponseUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(RFxResponse).where(
            RFxResponse.id == response_id, RFxResponse.rfx_id == rfx_id
        )
    )
    resp = result.scalar_one_or_none()
    if not resp:
        raise HTTPException(404, "Response not found")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(resp, field, val)
    if payload.status is None and resp.status == "submitted":
        resp.status = "under_review"
    await db.commit()
    await db.refresh(resp)
    return RFxResponseOut.model_validate(resp).model_dump()


# ══════════════════════════════════════════════════════════════════════════════
# SUPPLIER RISK
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/supplier-risks", summary="List supplier risks")
async def list_supplier_risks(
    current_user: CurrentUser,
    db: DBSession,
    supplier_id: uuid.UUID | None = Query(None),
    risk_type: str | None = Query(None),
    severity: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(SupplierRisk)
    if supplier_id:
        query = query.where(SupplierRisk.supplier_id == supplier_id)
    if risk_type:
        query = query.where(SupplierRisk.risk_type == risk_type)
    if severity:
        query = query.where(SupplierRisk.severity == severity)
    if status_filter:
        query = query.where(SupplierRisk.status == status_filter)
    total = await db.execute(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(
        query.order_by(SupplierRisk.detected_at.desc()).offset(skip).limit(limit)
    )
    return {
        "total": total.scalar() or 0,
        "risks": [SupplierRiskOut.model_validate(r) for r in rows.scalars().all()],
    }


@router.post(
    "/supplier-risks",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def create_supplier_risk(
    payload: SupplierRiskCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    risk = SupplierRisk(
        supplier_id=payload.supplier_id,
        risk_type=payload.risk_type,
        severity=payload.severity,
        description=payload.description,
        source=payload.source,
        mitigation_notes=payload.mitigation_notes,
    )
    db.add(risk)
    await db.commit()
    await db.refresh(risk)
    return {"id": str(risk.id), "risk_type": risk.risk_type}


# ══════════════════════════════════════════════════════════════════════════════
# REPLENISHMENT RULES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/replenishment-rules", summary="List replenishment rules")
async def list_replenishment_rules(
    current_user: CurrentUser,
    db: DBSession,
    item_id: uuid.UUID | None = Query(None),
    warehouse_id: uuid.UUID | None = Query(None),
    is_active: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    query = select(ReplenishmentRule)
    if item_id:
        query = query.where(ReplenishmentRule.item_id == item_id)
    if warehouse_id:
        query = query.where(ReplenishmentRule.warehouse_id == warehouse_id)
    if is_active is not None:
        query = query.where(ReplenishmentRule.is_active == is_active)
    total = await db.execute(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(query.offset(skip).limit(limit))
    return {
        "total": total.scalar() or 0,
        "rules": [ReplenishmentRuleOut.model_validate(r) for r in rows.scalars().all()],
    }


@router.post(
    "/replenishment-rules",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def create_replenishment_rule(
    payload: ReplenishmentRuleCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    rule = ReplenishmentRule(
        item_id=payload.item_id,
        warehouse_id=payload.warehouse_id,
        rule_type=payload.rule_type,
        min_level=payload.min_level,
        max_level=payload.max_level,
        reorder_point=payload.reorder_point,
        reorder_quantity=payload.reorder_quantity,
        lead_time_days=payload.lead_time_days,
        supplier_id=payload.supplier_id,
        auto_generate_po=payload.auto_generate_po,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return {"id": str(rule.id), "rule_type": rule.rule_type}


@router.put(
    "/replenishment-rules/{rule_id}",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def update_replenishment_rule(
    rule_id: uuid.UUID,
    payload: ReplenishmentRuleUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(ReplenishmentRule).where(ReplenishmentRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Rule not found")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(rule, field, val)
    await db.commit()
    await db.refresh(rule)
    return ReplenishmentRuleOut.model_validate(rule).model_dump()


@router.delete(
    "/replenishment-rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_app_admin("supply_chain"))],
    response_model=None,
)
async def delete_replenishment_rule(
    rule_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    result = await db.execute(
        select(ReplenishmentRule).where(ReplenishmentRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Rule not found")
    await db.delete(rule)
    await db.commit()


@router.post(
    "/replenishment-rules/check",
    dependencies=[Depends(require_app_admin("supply_chain"))],
    summary="Trigger replenishment check across all active rules",
)
async def check_replenishment(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    rules = await db.execute(
        select(ReplenishmentRule).where(ReplenishmentRule.is_active.is_(True))
    )
    triggered = []
    for rule in rules.scalars().all():
        # Check current stock level
        sl = await db.execute(
            select(StockLevel).where(
                StockLevel.item_id == rule.item_id,
                StockLevel.warehouse_id == rule.warehouse_id,
            )
        )
        stock = sl.scalar_one_or_none()
        current_qty = stock.quantity_on_hand if stock else 0

        if current_qty <= rule.reorder_point:
            rule.last_triggered_at = datetime.utcnow()
            triggered.append({
                "rule_id": str(rule.id),
                "item_id": str(rule.item_id),
                "warehouse_id": str(rule.warehouse_id),
                "current_qty": current_qty,
                "reorder_point": rule.reorder_point,
                "reorder_quantity": rule.reorder_quantity,
                "auto_generate_po": rule.auto_generate_po,
            })
            await event_bus.publish("supplychain.replenishment.triggered", {
                "rule_id": str(rule.id),
                "item_id": str(rule.item_id),
                "auto_generate_po": rule.auto_generate_po,
            })

    await db.commit()
    return {"checked": True, "triggered_count": len(triggered), "triggered": triggered}


# ══════════════════════════════════════════════════════════════════════════════
# SAFETY STOCK
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/safety-stock", summary="List safety stock configs")
async def list_safety_stock(
    current_user: CurrentUser,
    db: DBSession,
    item_id: uuid.UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    query = select(SafetyStockConfig)
    if item_id:
        query = query.where(SafetyStockConfig.item_id == item_id)
    total = await db.execute(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(query.offset(skip).limit(limit))
    return {
        "total": total.scalar() or 0,
        "configs": [SafetyStockOut.model_validate(r) for r in rows.scalars().all()],
    }


@router.post(
    "/safety-stock/calculate",
    dependencies=[Depends(require_app_admin("supply_chain"))],
    summary="Recalculate safety stock for items",
)
async def calculate_safety_stock(
    current_user: CurrentUser,
    db: DBSession,
    item_ids: list[uuid.UUID] | None = Query(None),
) -> dict[str, Any]:
    """Recalculate safety stock using demand variability method."""
    query = select(SafetyStockConfig)
    if item_ids:
        query = query.where(SafetyStockConfig.item_id.in_(item_ids))
    rows = await db.execute(query)
    configs = rows.scalars().all()

    updated = 0
    for cfg in configs:
        # Simple calculation: safety_stock = Z * std_dev * sqrt(lead_time)
        if cfg.method == "service_level" and cfg.demand_std_dev:
            import math
            z_score = 1.65 if (cfg.service_level_pct or 0) >= 95 else 1.28
            lt = float(cfg.lead_time_std_dev or 1)
            cfg.safety_stock_qty = int(z_score * float(cfg.demand_std_dev) * math.sqrt(lt))
            cfg.recalculated_at = datetime.utcnow()
            updated += 1

    await db.commit()
    return {"recalculated": updated}


@router.put(
    "/safety-stock/{config_id}",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def update_safety_stock(
    config_id: uuid.UUID,
    payload: SafetyStockUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(SafetyStockConfig).where(SafetyStockConfig.id == config_id)
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(404, "Safety stock config not found")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(cfg, field, val)
    await db.commit()
    await db.refresh(cfg)
    return SafetyStockOut.model_validate(cfg).model_dump()


# ══════════════════════════════════════════════════════════════════════════════
# STOCK HEALTH
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/stock-health", summary="List stock health scores")
async def list_stock_health(
    current_user: CurrentUser,
    db: DBSession,
    health_status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    query = select(StockHealthScore)
    if health_status:
        query = query.where(StockHealthScore.health_status == health_status)
    total = await db.execute(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(
        query.order_by(StockHealthScore.calculated_at.desc()).offset(skip).limit(limit)
    )
    return {
        "total": total.scalar() or 0,
        "scores": [StockHealthOut.model_validate(r) for r in rows.scalars().all()],
    }


@router.post(
    "/stock-health/analyze",
    dependencies=[Depends(require_app_admin("supply_chain"))],
    summary="Run stock health analysis",
)
async def analyze_stock_health(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Scan all stock levels and classify health status."""
    from app.models.inventory import StockMovement

    levels = await db.execute(select(StockLevel))
    analyzed = 0

    for sl in levels.scalars().all():
        # Get last movement date
        last_move = await db.execute(
            select(func.max(StockMovement.created_at)).where(
                StockMovement.item_id == sl.item_id,
                StockMovement.warehouse_id == sl.warehouse_id,
            )
        )
        last_dt = last_move.scalar()
        days_since = (datetime.utcnow() - last_dt).days if last_dt else 999

        if days_since > 180:
            health = "obsolete"
            action = "liquidate"
        elif days_since > 90:
            health = "slow_moving"
            action = "markdown"
        elif sl.quantity_on_hand <= 0:
            health = "understock"
            action = "reorder"
        else:
            health = "healthy"
            action = "none"

        # Upsert score
        existing = await db.execute(
            select(StockHealthScore).where(
                StockHealthScore.item_id == sl.item_id,
                StockHealthScore.warehouse_id == sl.warehouse_id,
            )
        )
        score = existing.scalar_one_or_none()
        if score:
            score.health_status = health
            score.days_of_stock = max(0, sl.quantity_on_hand)
            score.last_movement_date = last_dt.date() if last_dt else None
            score.recommended_action = action
            score.calculated_at = datetime.utcnow()
        else:
            score = StockHealthScore(
                item_id=sl.item_id,
                warehouse_id=sl.warehouse_id,
                health_status=health,
                days_of_stock=max(0, sl.quantity_on_hand),
                last_movement_date=last_dt.date() if last_dt else None,
                recommended_action=action,
            )
            db.add(score)
        analyzed += 1

    await db.commit()
    return {"analyzed": analyzed}


# ══════════════════════════════════════════════════════════════════════════════
# WORKFLOWS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/workflows/templates", summary="List workflow templates")
async def list_workflow_templates(
    current_user: CurrentUser,
    db: DBSession,
    is_active: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(WorkflowTemplate)
    if is_active is not None:
        query = query.where(WorkflowTemplate.is_active == is_active)
    total = await db.execute(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(
        query.order_by(WorkflowTemplate.created_at.desc()).offset(skip).limit(limit)
    )
    return {
        "total": total.scalar() or 0,
        "templates": [WorkflowTemplateOut.model_validate(r) for r in rows.scalars().all()],
    }


@router.post(
    "/workflows/templates",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def create_workflow_template(
    payload: WorkflowTemplateCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    tpl = WorkflowTemplate(
        name=payload.name,
        description=payload.description,
        trigger_event=payload.trigger_event,
        steps=payload.steps,
        created_by=current_user.id,
    )
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return {"id": str(tpl.id), "name": tpl.name}


@router.put(
    "/workflows/templates/{template_id}",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def update_workflow_template(
    template_id: uuid.UUID,
    payload: WorkflowTemplateUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(WorkflowTemplate).where(WorkflowTemplate.id == template_id)
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template not found")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(tpl, field, val)
    await db.commit()
    await db.refresh(tpl)
    return WorkflowTemplateOut.model_validate(tpl).model_dump()


@router.delete(
    "/workflows/templates/{template_id}",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def deactivate_workflow_template(
    template_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(WorkflowTemplate).where(WorkflowTemplate.id == template_id)
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template not found")
    tpl.is_active = False
    await db.commit()
    return {"id": str(tpl.id), "is_active": False}


@router.get("/workflows/runs", summary="List workflow runs")
async def list_workflow_runs(
    current_user: CurrentUser,
    db: DBSession,
    template_id: uuid.UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(WorkflowRun)
    if template_id:
        query = query.where(WorkflowRun.template_id == template_id)
    if status_filter:
        query = query.where(WorkflowRun.status == status_filter)
    total = await db.execute(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(
        query.order_by(WorkflowRun.started_at.desc()).offset(skip).limit(limit)
    )
    return {
        "total": total.scalar() or 0,
        "runs": [WorkflowRunOut.model_validate(r) for r in rows.scalars().all()],
    }


@router.get("/workflows/runs/{run_id}", summary="Get workflow run detail with steps")
async def get_workflow_run(
    run_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(WorkflowRun)
        .options(selectinload(WorkflowRun.steps))
        .where(WorkflowRun.id == run_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(404, "Workflow run not found")
    return {
        **WorkflowRunOut.model_validate(run).model_dump(),
        "steps": [WorkflowStepOut.model_validate(s) for s in sorted(run.steps, key=lambda s: s.step_index)],
    }


@router.post(
    "/workflows/trigger",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_app_admin("supply_chain"))],
    summary="Manually trigger a workflow",
)
async def trigger_workflow(
    current_user: CurrentUser,
    db: DBSession,
    template_id: uuid.UUID = Query(...),
    trigger_data: dict | None = None,
) -> dict[str, Any]:
    result = await db.execute(
        select(WorkflowTemplate).where(WorkflowTemplate.id == template_id)
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template not found")
    if not tpl.is_active:
        raise HTTPException(400, "Template is inactive")

    run = WorkflowRun(
        template_id=tpl.id,
        trigger_data=trigger_data,
    )
    db.add(run)
    await db.flush()

    # Create step instances from template
    steps_def = tpl.steps or {}
    step_list = steps_def.get("steps", []) if isinstance(steps_def, dict) else []
    for idx, step_def in enumerate(step_list):
        step = WorkflowStep(
            run_id=run.id,
            step_index=idx,
            action=step_def.get("action", "unknown"),
            params=step_def.get("params"),
        )
        db.add(step)

    await db.commit()
    await db.refresh(run)
    return {"id": str(run.id), "status": run.status}


@router.post(
    "/workflows/runs/{run_id}/cancel",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def cancel_workflow_run(
    run_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(WorkflowRun).where(WorkflowRun.id == run_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(404, "Workflow run not found")
    if run.status != "running":
        raise HTTPException(400, f"Cannot cancel run in status '{run.status}'")
    run.status = "cancelled"
    run.completed_at = datetime.utcnow()
    await db.commit()
    return {"id": str(run.id), "status": "cancelled"}


# ══════════════════════════════════════════════════════════════════════════════
# COMPLIANCE & ESG
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/compliance", summary="List compliance records")
async def list_compliance(
    current_user: CurrentUser,
    db: DBSession,
    entity_type: str | None = Query(None),
    compliance_type: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(ComplianceRecord)
    if entity_type:
        query = query.where(ComplianceRecord.entity_type == entity_type)
    if compliance_type:
        query = query.where(ComplianceRecord.compliance_type == compliance_type)
    if status_filter:
        query = query.where(ComplianceRecord.status == status_filter)
    total = await db.execute(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(
        query.order_by(ComplianceRecord.created_at.desc()).offset(skip).limit(limit)
    )
    return {
        "total": total.scalar() or 0,
        "records": [ComplianceOut.model_validate(r) for r in rows.scalars().all()],
    }


@router.post(
    "/compliance",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def create_compliance(
    payload: ComplianceCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    rec = ComplianceRecord(
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        compliance_type=payload.compliance_type,
        status=payload.status,
        details=payload.details,
        expiry_date=payload.expiry_date,
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return {"id": str(rec.id), "compliance_type": rec.compliance_type}


@router.put(
    "/compliance/{record_id}",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def update_compliance(
    record_id: uuid.UUID,
    payload: ComplianceUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(ComplianceRecord).where(ComplianceRecord.id == record_id)
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(404, "Compliance record not found")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(rec, field, val)
    if payload.status and payload.status != "pending_review":
        rec.reviewed_by = current_user.id
        rec.reviewed_at = datetime.utcnow()
    await db.commit()
    await db.refresh(rec)
    return ComplianceOut.model_validate(rec).model_dump()


@router.get("/esg-metrics", summary="List ESG metrics")
async def list_esg_metrics(
    current_user: CurrentUser,
    db: DBSession,
    supplier_id: uuid.UUID | None = Query(None),
    metric_type: str | None = Query(None),
    period: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    query = select(ESGMetric)
    if supplier_id:
        query = query.where(ESGMetric.supplier_id == supplier_id)
    if metric_type:
        query = query.where(ESGMetric.metric_type == metric_type)
    if period:
        query = query.where(ESGMetric.period == period)
    total = await db.execute(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(
        query.order_by(ESGMetric.created_at.desc()).offset(skip).limit(limit)
    )
    return {
        "total": total.scalar() or 0,
        "metrics": [ESGMetricOut.model_validate(r) for r in rows.scalars().all()],
    }


@router.post(
    "/esg-metrics",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def create_esg_metric(
    payload: ESGMetricCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    metric = ESGMetric(
        supplier_id=payload.supplier_id,
        metric_type=payload.metric_type,
        period=payload.period,
        value=payload.value,
        unit=payload.unit,
        benchmark=payload.benchmark,
        source=payload.source,
    )
    db.add(metric)
    await db.commit()
    await db.refresh(metric)
    return {"id": str(metric.id), "metric_type": metric.metric_type}


@router.get("/esg-metrics/summary", summary="ESG dashboard summary")
async def esg_summary(
    current_user: CurrentUser,
    db: DBSession,
    period: str | None = Query(None),
) -> dict[str, Any]:
    query = select(
        ESGMetric.metric_type,
        func.avg(ESGMetric.value).label("avg_value"),
        func.count().label("count"),
    ).group_by(ESGMetric.metric_type)
    if period:
        query = query.where(ESGMetric.period == period)
    rows = await db.execute(query)
    return {
        "summary": [
            {"metric_type": row[0], "avg_value": float(row[1] or 0), "count": row[2]}
            for row in rows.all()
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
# ANALYTICS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/analytics/cost-to-serve", summary="Cost-to-serve breakdown")
async def cost_to_serve(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.supplychain import GRNLine

    # Sum accepted_quantity * estimated cost from recent GRNs
    total_cost = await db.execute(
        select(func.sum(GRNLine.accepted_quantity)).select_from(GRNLine)
    )
    return {
        "total_units_received": total_cost.scalar() or 0,
        "note": "Detailed cost-to-serve requires freight and labor data (Phase 2)",
    }


@router.get("/analytics/carbon-footprint", summary="Carbon footprint metrics")
async def carbon_footprint(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(
            func.sum(ESGMetric.value).label("total"),
            func.avg(ESGMetric.value).label("avg"),
        ).where(ESGMetric.metric_type == "carbon_footprint")
    )
    row = result.one_or_none()
    return {
        "total_carbon": float(row[0] or 0) if row else 0,
        "avg_carbon_per_supplier": float(row[1] or 0) if row else 0,
    }


@router.get("/analytics/risk-heatmap", summary="Supplier risk heatmap data")
async def risk_heatmap(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    rows = await db.execute(
        select(
            SupplierRisk.risk_type,
            SupplierRisk.severity,
            func.count().label("count"),
        )
        .where(SupplierRisk.status == "active")
        .group_by(SupplierRisk.risk_type, SupplierRisk.severity)
    )
    return {
        "heatmap": [
            {"risk_type": r[0], "severity": r[1], "count": r[2]}
            for r in rows.all()
        ],
    }


@router.get("/analytics/ai-summary", summary="AI-generated SC executive summary")
async def ai_summary(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Gather key metrics for AI prompt
    open_alerts = await db.execute(
        select(func.count()).select_from(ControlTowerAlert)
        .where(ControlTowerAlert.status == "open")
    )
    active_risks = await db.execute(
        select(func.count()).select_from(SupplierRisk)
        .where(SupplierRisk.status == "active")
    )
    return {
        "summary": (
            f"Supply Chain Status: {open_alerts.scalar() or 0} open alerts, "
            f"{active_risks.scalar() or 0} active supplier risks. "
            "Review control tower dashboard for detailed KPIs."
        ),
        "note": "Full AI-generated summary requires Ollama integration (coming in AI agents phase)",
    }
