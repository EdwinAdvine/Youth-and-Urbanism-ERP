"""Inventory Phase 5 — Advanced Costing, Cost Layers, Audit Trail."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, select, desc

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.models.inventory import (
    CostingConfig, CostLayer, InventoryAuditTrail,
    InventoryItem, Warehouse, PurchaseOrder,
)

router = APIRouter()

# ─── CostingConfig schemas ────────────────────────────────────────────────────

class CostingConfigCreate(BaseModel):
    item_id: uuid.UUID
    method: str = "average"
    standard_cost: Decimal | None = None

class CostingConfigOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    method: str
    standard_cost: Decimal | None
    item_name: str | None = None
    model_config = {"from_attributes": True}

# ─── CostLayer schemas ────────────────────────────────────────────────────────

class CostLayerOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    purchase_order_id: uuid.UUID | None
    quantity_received: int
    quantity_remaining: int
    unit_cost: Decimal
    receipt_date: date
    item_name: str | None = None
    created_at: Any
    model_config = {"from_attributes": True}

# ─── AuditTrail schemas ───────────────────────────────────────────────────────

class AuditTrailOut(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    field_name: str
    old_value: str | None
    new_value: str | None
    changed_by: uuid.UUID
    changed_at: datetime
    model_config = {"from_attributes": True}

# ─── CostingConfig endpoints ──────────────────────────────────────────────────

@router.get("/costing-config", response_model=list[CostingConfigOut], tags=["Inventory Costing"])
async def list_costing_configs(db: DBSession, _: CurrentUser):
    result = await db.execute(select(CostingConfig))
    rows = result.scalars().all()
    out = []
    for r in rows:
        item = await db.get(InventoryItem, r.item_id)
        out.append(CostingConfigOut(id=r.id, item_id=r.item_id, method=r.method, standard_cost=r.standard_cost, item_name=item.name if item else None))
    return out

@router.post("/costing-config", response_model=CostingConfigOut, status_code=201, tags=["Inventory Costing"])
async def create_costing_config(payload: CostingConfigCreate, db: DBSession, current_user: CurrentUser):
    config = CostingConfig(**payload.model_dump(), last_updated_by=current_user.id)
    db.add(config)
    await db.commit()
    await db.refresh(config)
    item = await db.get(InventoryItem, config.item_id)
    return CostingConfigOut(id=config.id, item_id=config.item_id, method=config.method, standard_cost=config.standard_cost, item_name=item.name if item else None)

@router.patch("/costing-config/{item_id}", response_model=CostingConfigOut, tags=["Inventory Costing"])
async def update_costing_config(item_id: uuid.UUID, method: str | None = None, standard_cost: Decimal | None = None, db: DBSession = None, current_user: CurrentUser = None):
    result = await db.execute(select(CostingConfig).where(CostingConfig.item_id == item_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404)
    if method:
        config.method = method
    if standard_cost is not None:
        config.standard_cost = standard_cost
    config.last_updated_by = current_user.id
    await db.commit()
    item = await db.get(InventoryItem, config.item_id)
    return CostingConfigOut(id=config.id, item_id=config.item_id, method=config.method, standard_cost=config.standard_cost, item_name=item.name if item else None)

# ─── CostLayer endpoints ──────────────────────────────────────────────────────

@router.get("/cost-layers", response_model=list[CostLayerOut], tags=["Inventory Costing"])
async def list_cost_layers(db: DBSession, _: CurrentUser, item_id: uuid.UUID | None = None, warehouse_id: uuid.UUID | None = None):
    q = select(CostLayer).where(CostLayer.quantity_remaining > 0)
    if item_id:
        q = q.where(CostLayer.item_id == item_id)
    if warehouse_id:
        q = q.where(CostLayer.warehouse_id == warehouse_id)
    result = await db.execute(q.order_by(CostLayer.receipt_date))
    layers = result.scalars().all()
    out = []
    for l in layers:
        item = await db.get(InventoryItem, l.item_id)
        out.append(CostLayerOut(
            id=l.id, item_id=l.item_id, warehouse_id=l.warehouse_id,
            purchase_order_id=l.purchase_order_id, quantity_received=l.quantity_received,
            quantity_remaining=l.quantity_remaining, unit_cost=l.unit_cost,
            receipt_date=l.receipt_date, item_name=item.name if item else None, created_at=l.created_at,
        ))
    return out

@router.get("/profitability", tags=["Inventory Costing"])
async def profitability_report(db: DBSession, _: CurrentUser):
    """Simple profitability report: selling_price - cost_price per item."""
    result = await db.execute(select(InventoryItem).where(InventoryItem.is_active == True))
    items = result.scalars().all()
    report = []
    for item in items:
        margin = float(item.selling_price) - float(item.cost_price)
        margin_pct = (margin / float(item.selling_price) * 100) if item.selling_price > 0 else 0
        report.append({
            "item_id": str(item.id),
            "sku": item.sku,
            "name": item.name,
            "cost_price": float(item.cost_price),
            "selling_price": float(item.selling_price),
            "margin": round(margin, 2),
            "margin_pct": round(margin_pct, 1),
        })
    return sorted(report, key=lambda x: x["margin_pct"], reverse=True)

# ─── Audit Trail endpoints ────────────────────────────────────────────────────

@router.get("/audit-trail", response_model=list[AuditTrailOut], tags=["Inventory Audit"])
async def list_audit_trail(
    db: DBSession, _: CurrentUser,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    limit: int = 100,
):
    q = select(InventoryAuditTrail).order_by(desc(InventoryAuditTrail.changed_at)).limit(limit)
    if entity_type:
        q = q.where(InventoryAuditTrail.entity_type == entity_type)
    if entity_id:
        q = q.where(InventoryAuditTrail.entity_id == entity_id)
    result = await db.execute(q)
    return result.scalars().all()
