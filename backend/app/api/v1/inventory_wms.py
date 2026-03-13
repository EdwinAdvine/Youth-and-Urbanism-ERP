"""Inventory Phase 2 — Warehouse Management System (zones, bins, putaway, pick-pack-ship)."""

import uuid
import secrets
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, select

from app.core.deps import CurrentUser, DBSession
from app.models.inventory import (
    WarehouseZone, WarehouseBin, BinContent, PutawayRule,
    PickList, PickListLine, InventoryItem,
)

router = APIRouter()

# ─── Zone schemas ─────────────────────────────────────────────────────────────

class ZoneCreate(BaseModel):
    warehouse_id: uuid.UUID
    name: str
    zone_type: str = "storage"
    description: str | None = None

class ZoneOut(BaseModel):
    id: uuid.UUID
    warehouse_id: uuid.UUID
    name: str
    zone_type: str
    description: str | None
    is_active: bool
    model_config = {"from_attributes": True}

# ─── Bin schemas ──────────────────────────────────────────────────────────────

class BinCreate(BaseModel):
    zone_id: uuid.UUID
    warehouse_id: uuid.UUID
    bin_code: str
    bin_type: str = "standard"
    max_weight: float | None = None
    max_volume: float | None = None

class BinBulkCreate(BaseModel):
    zone_id: uuid.UUID
    warehouse_id: uuid.UUID
    bin_codes: list[str]
    bin_type: str = "standard"

class BinOut(BaseModel):
    id: uuid.UUID
    zone_id: uuid.UUID
    warehouse_id: uuid.UUID
    bin_code: str
    bin_type: str
    max_weight: float | None
    max_volume: float | None
    is_active: bool
    model_config = {"from_attributes": True}

# ─── BinContent schemas ───────────────────────────────────────────────────────

class BinContentOut(BaseModel):
    id: uuid.UUID
    bin_id: uuid.UUID
    item_id: uuid.UUID
    variant_id: uuid.UUID | None
    batch_id: uuid.UUID | None
    serial_id: uuid.UUID | None
    quantity: int
    item_name: str | None = None
    bin_code: str | None = None
    model_config = {"from_attributes": True}

# ─── Putaway Rule schemas ─────────────────────────────────────────────────────

class PutawayRuleCreate(BaseModel):
    warehouse_id: uuid.UUID
    item_id: uuid.UUID | None = None
    category: str | None = None
    zone_id: uuid.UUID | None = None
    bin_id: uuid.UUID | None = None
    priority: int = 10

class PutawayRuleOut(BaseModel):
    id: uuid.UUID
    warehouse_id: uuid.UUID
    item_id: uuid.UUID | None
    category: str | None
    zone_id: uuid.UUID | None
    bin_id: uuid.UUID | None
    priority: int
    is_active: bool
    model_config = {"from_attributes": True}

# ─── PickList schemas ─────────────────────────────────────────────────────────

class PickListCreate(BaseModel):
    warehouse_id: uuid.UUID
    pick_strategy: str = "fifo"
    reference_type: str | None = None
    reference_id: uuid.UUID | None = None
    notes: str | None = None
    lines: list[dict] = []  # [{item_id, quantity_requested}]

class PickListLineOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    bin_id: uuid.UUID | None
    quantity_requested: int
    quantity_picked: int
    item_name: str | None = None
    model_config = {"from_attributes": True}

class PickListOut(BaseModel):
    id: uuid.UUID
    pick_number: str
    warehouse_id: uuid.UUID
    status: str
    pick_strategy: str
    assigned_to: uuid.UUID | None
    reference_type: str | None
    notes: str | None
    lines: list[PickListLineOut] = []
    created_at: Any
    model_config = {"from_attributes": True}

# ─── Zone endpoints ───────────────────────────────────────────────────────────

@router.get("/warehouses/{warehouse_id}/zones", response_model=list[ZoneOut], tags=["Inventory WMS"])
async def list_zones(warehouse_id: uuid.UUID, db: DBSession, _: CurrentUser):
    result = await db.execute(select(WarehouseZone).where(WarehouseZone.warehouse_id == warehouse_id, WarehouseZone.is_active == True))
    return result.scalars().all()

@router.post("/warehouses/{warehouse_id}/zones", response_model=ZoneOut, status_code=201, tags=["Inventory WMS"])
async def create_zone(warehouse_id: uuid.UUID, payload: ZoneCreate, db: DBSession, _: CurrentUser):
    zone = WarehouseZone(**payload.model_dump())
    db.add(zone)
    await db.commit()
    await db.refresh(zone)
    return zone

@router.patch("/zones/{zone_id}", response_model=ZoneOut, tags=["Inventory WMS"])
async def update_zone(zone_id: uuid.UUID, name: str | None = None, zone_type: str | None = None, is_active: bool | None = None, db: DBSession = None, _: CurrentUser = None):
    zone = await db.get(WarehouseZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404)
    if name is not None:
        zone.name = name
    if zone_type is not None:
        zone.zone_type = zone_type
    if is_active is not None:
        zone.is_active = is_active
    await db.commit()
    await db.refresh(zone)
    return zone

# ─── Bin endpoints ────────────────────────────────────────────────────────────

@router.get("/zones/{zone_id}/bins", response_model=list[BinOut], tags=["Inventory WMS"])
async def list_bins(zone_id: uuid.UUID, db: DBSession, _: CurrentUser):
    result = await db.execute(select(WarehouseBin).where(WarehouseBin.zone_id == zone_id, WarehouseBin.is_active == True))
    return result.scalars().all()

@router.post("/zones/{zone_id}/bins", response_model=BinOut, status_code=201, tags=["Inventory WMS"])
async def create_bin(zone_id: uuid.UUID, payload: BinCreate, db: DBSession, _: CurrentUser):
    bin_ = WarehouseBin(**payload.model_dump())
    db.add(bin_)
    await db.commit()
    await db.refresh(bin_)
    return bin_

@router.post("/zones/{zone_id}/bins/bulk", response_model=list[BinOut], status_code=201, tags=["Inventory WMS"])
async def bulk_create_bins(zone_id: uuid.UUID, payload: BinBulkCreate, db: DBSession, _: CurrentUser):
    bins = []
    for code in payload.bin_codes:
        b = WarehouseBin(zone_id=zone_id, warehouse_id=payload.warehouse_id, bin_code=code, bin_type=payload.bin_type)
        db.add(b)
        bins.append(b)
    await db.commit()
    for b in bins:
        await db.refresh(b)
    return bins

@router.get("/bins/{bin_id}/contents", response_model=list[BinContentOut], tags=["Inventory WMS"])
async def get_bin_contents(bin_id: uuid.UUID, db: DBSession, _: CurrentUser):
    result = await db.execute(select(BinContent).where(BinContent.bin_id == bin_id))
    contents = result.scalars().all()
    out = []
    bin_ = await db.get(WarehouseBin, bin_id)
    for c in contents:
        item = await db.get(InventoryItem, c.item_id)
        out.append(BinContentOut(
            id=c.id, bin_id=c.bin_id, item_id=c.item_id, variant_id=c.variant_id,
            batch_id=c.batch_id, serial_id=c.serial_id, quantity=c.quantity,
            item_name=item.name if item else None,
            bin_code=bin_.bin_code if bin_ else None,
        ))
    return out

# ─── Putaway Rule endpoints ───────────────────────────────────────────────────

@router.get("/putaway-rules", response_model=list[PutawayRuleOut], tags=["Inventory WMS"])
async def list_putaway_rules(db: DBSession, _: CurrentUser, warehouse_id: uuid.UUID | None = None):
    q = select(PutawayRule).where(PutawayRule.is_active == True)
    if warehouse_id:
        q = q.where(PutawayRule.warehouse_id == warehouse_id)
    result = await db.execute(q.order_by(PutawayRule.priority))
    return result.scalars().all()

@router.post("/putaway-rules", response_model=PutawayRuleOut, status_code=201, tags=["Inventory WMS"])
async def create_putaway_rule(payload: PutawayRuleCreate, db: DBSession, _: CurrentUser):
    rule = PutawayRule(**payload.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule

@router.post("/putaway-rules/suggest", tags=["Inventory WMS"])
async def suggest_putaway(item_id: uuid.UUID, warehouse_id: uuid.UUID, db: DBSession, _: CurrentUser):
    """Return the best bin for an incoming item based on putaway rules."""
    item = await db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=404)
    # Try item-specific rule first, then category, then warehouse default
    for condition in [
        and_(PutawayRule.item_id == item_id, PutawayRule.warehouse_id == warehouse_id),
        and_(PutawayRule.category == item.category, PutawayRule.warehouse_id == warehouse_id),
        and_(PutawayRule.item_id == None, PutawayRule.category == None, PutawayRule.warehouse_id == warehouse_id),
    ]:
        result = await db.execute(select(PutawayRule).where(condition, PutawayRule.is_active == True).order_by(PutawayRule.priority).limit(1))
        rule = result.scalar_one_or_none()
        if rule:
            return {"rule_id": str(rule.id), "zone_id": str(rule.zone_id), "bin_id": str(rule.bin_id) if rule.bin_id else None}
    return {"rule_id": None, "zone_id": None, "bin_id": None, "message": "No matching putaway rule"}

# ─── Pick List endpoints ──────────────────────────────────────────────────────

@router.get("/pick-lists", response_model=list[PickListOut], tags=["Inventory WMS"])
async def list_pick_lists(db: DBSession, _: CurrentUser, warehouse_id: uuid.UUID | None = None, status: str | None = None):
    q = select(PickList)
    if warehouse_id:
        q = q.where(PickList.warehouse_id == warehouse_id)
    if status:
        q = q.where(PickList.status == status)
    result = await db.execute(q.order_by(PickList.created_at.desc()))
    pick_lists = result.scalars().all()
    out = []
    for pl in pick_lists:
        lines_result = await db.execute(select(PickListLine).where(PickListLine.pick_list_id == pl.id))
        lines = lines_result.scalars().all()
        line_outs = []
        for line in lines:
            item = await db.get(InventoryItem, line.item_id)
            line_outs.append(PickListLineOut(
                id=line.id, item_id=line.item_id, bin_id=line.bin_id,
                quantity_requested=line.quantity_requested, quantity_picked=line.quantity_picked,
                item_name=item.name if item else None,
            ))
        out.append(PickListOut(
            id=pl.id, pick_number=pl.pick_number, warehouse_id=pl.warehouse_id,
            status=pl.status, pick_strategy=pl.pick_strategy, assigned_to=pl.assigned_to,
            reference_type=pl.reference_type, notes=pl.notes, lines=line_outs, created_at=pl.created_at,
        ))
    return out

@router.post("/pick-lists", response_model=PickListOut, status_code=201, tags=["Inventory WMS"])
async def create_pick_list(payload: PickListCreate, db: DBSession, current_user: CurrentUser):
    pick_number = "PK-" + secrets.token_hex(4).upper()
    pl = PickList(
        pick_number=pick_number, warehouse_id=payload.warehouse_id,
        pick_strategy=payload.pick_strategy, reference_type=payload.reference_type,
        reference_id=payload.reference_id, notes=payload.notes,
        owner_id=current_user.id,
    )
    db.add(pl)
    await db.flush()
    line_outs = []
    for line_data in payload.lines:
        line = PickListLine(
            pick_list_id=pl.id,
            item_id=uuid.UUID(line_data["item_id"]),
            quantity_requested=line_data["quantity_requested"],
        )
        db.add(line)
        await db.flush()
        item = await db.get(InventoryItem, line.item_id)
        line_outs.append(PickListLineOut(
            id=line.id, item_id=line.item_id, bin_id=line.bin_id,
            quantity_requested=line.quantity_requested, quantity_picked=line.quantity_picked,
            item_name=item.name if item else None,
        ))
    await db.commit()
    await db.refresh(pl)
    return PickListOut(
        id=pl.id, pick_number=pl.pick_number, warehouse_id=pl.warehouse_id,
        status=pl.status, pick_strategy=pl.pick_strategy, assigned_to=pl.assigned_to,
        reference_type=pl.reference_type, notes=pl.notes, lines=line_outs, created_at=pl.created_at,
    )

@router.patch("/pick-lists/{pick_id}/status", tags=["Inventory WMS"])
async def update_pick_list_status(pick_id: uuid.UUID, status: str, db: DBSession, current_user: CurrentUser):
    pl = await db.get(PickList, pick_id)
    if not pl:
        raise HTTPException(status_code=404)
    valid_transitions = {
        "pending": ["in_progress"],
        "in_progress": ["picked"],
        "picked": ["packed"],
        "packed": ["shipped"],
    }
    if status not in valid_transitions.get(pl.status, []):
        raise HTTPException(status_code=400, detail=f"Cannot transition from {pl.status} to {status}")
    pl.status = status
    await db.commit()
    return {"id": str(pl.id), "pick_number": pl.pick_number, "status": pl.status}

@router.patch("/pick-lists/{pick_id}/lines/{line_id}/pick", tags=["Inventory WMS"])
async def record_pick(pick_id: uuid.UUID, line_id: uuid.UUID, quantity_picked: int, db: DBSession, _: CurrentUser):
    line = await db.get(PickListLine, line_id)
    if not line or line.pick_list_id != pick_id:
        raise HTTPException(status_code=404)
    line.quantity_picked = quantity_picked
    await db.commit()
    return {"line_id": str(line.id), "quantity_picked": line.quantity_picked}
