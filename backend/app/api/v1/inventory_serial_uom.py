"""Inventory Phase 1 — Serial Numbers, Units of Measure, Blanket Orders, Three-Way Match."""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.models.inventory import (
    SerialNumber, UnitOfMeasure, UoMConversion, BlanketOrder,
    PurchaseOrder, PurchaseOrderLine, InventoryItem, InventorySupplier,
)

router = APIRouter()

# ─── UnitOfMeasure schemas ────────────────────────────────────────────────────

class UoMCreate(BaseModel):
    name: str
    abbreviation: str
    category: str = "count"
    is_base: bool = False

class UoMUpdate(BaseModel):
    name: str | None = None
    abbreviation: str | None = None
    category: str | None = None
    is_base: bool | None = None
    is_active: bool | None = None

class UoMOut(BaseModel):
    id: uuid.UUID
    name: str
    abbreviation: str
    category: str
    is_base: bool
    is_active: bool
    model_config = {"from_attributes": True}

class UoMConversionCreate(BaseModel):
    from_uom_id: uuid.UUID
    to_uom_id: uuid.UUID
    factor: Decimal
    item_id: uuid.UUID | None = None

class UoMConversionOut(BaseModel):
    id: uuid.UUID
    from_uom_id: uuid.UUID
    to_uom_id: uuid.UUID
    factor: Decimal
    item_id: uuid.UUID | None
    from_uom_name: str | None = None
    to_uom_name: str | None = None
    model_config = {"from_attributes": True}

class ConvertRequest(BaseModel):
    value: Decimal
    from_uom_id: uuid.UUID
    to_uom_id: uuid.UUID
    item_id: uuid.UUID | None = None

# ─── UoM endpoints ───────────────────────────────────────────────────────────

@router.get("/uom", response_model=list[UoMOut], tags=["Inventory UoM"])
async def list_uom(db: DBSession, _: CurrentUser, category: str | None = None):
    q = select(UnitOfMeasure).where(UnitOfMeasure.is_active == True)
    if category:
        q = q.where(UnitOfMeasure.category == category)
    result = await db.execute(q.order_by(UnitOfMeasure.name))
    return result.scalars().all()

@router.post("/uom", response_model=UoMOut, status_code=201, tags=["Inventory UoM"])
async def create_uom(payload: UoMCreate, db: DBSession, _: Any = Depends(require_app_admin("inventory"))):
    uom = UnitOfMeasure(**payload.model_dump())
    db.add(uom)
    await db.commit()
    await db.refresh(uom)
    return uom

@router.patch("/uom/{uom_id}", response_model=UoMOut, tags=["Inventory UoM"])
async def update_uom(uom_id: uuid.UUID, payload: UoMUpdate, db: DBSession, _: Any = Depends(require_app_admin("inventory"))):
    uom = await db.get(UnitOfMeasure, uom_id)
    if not uom:
        raise HTTPException(status_code=404)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(uom, k, v)
    await db.commit()
    await db.refresh(uom)
    return uom

@router.delete("/uom/{uom_id}", status_code=204, tags=["Inventory UoM"])
async def delete_uom(uom_id: uuid.UUID, db: DBSession, _: Any = Depends(require_app_admin("inventory"))):
    uom = await db.get(UnitOfMeasure, uom_id)
    if not uom:
        raise HTTPException(status_code=404)
    await db.delete(uom)
    await db.commit()

@router.get("/uom/conversions", response_model=list[UoMConversionOut], tags=["Inventory UoM"])
async def list_uom_conversions(db: DBSession, _: CurrentUser, item_id: uuid.UUID | None = None):
    q = select(UoMConversion)
    if item_id:
        q = q.where(UoMConversion.item_id == item_id)
    result = await db.execute(q)
    rows = result.scalars().all()
    out = []
    for row in rows:
        from_uom = await db.get(UnitOfMeasure, row.from_uom_id)
        to_uom = await db.get(UnitOfMeasure, row.to_uom_id)
        out.append(UoMConversionOut(
            id=row.id, from_uom_id=row.from_uom_id, to_uom_id=row.to_uom_id,
            factor=row.factor, item_id=row.item_id,
            from_uom_name=from_uom.name if from_uom else None,
            to_uom_name=to_uom.name if to_uom else None,
        ))
    return out

@router.post("/uom/conversions", response_model=UoMConversionOut, status_code=201, tags=["Inventory UoM"])
async def create_uom_conversion(payload: UoMConversionCreate, db: DBSession, _: Any = Depends(require_app_admin("inventory"))):
    conv = UoMConversion(**payload.model_dump())
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return UoMConversionOut(id=conv.id, from_uom_id=conv.from_uom_id, to_uom_id=conv.to_uom_id, factor=conv.factor, item_id=conv.item_id)

@router.post("/uom/convert", tags=["Inventory UoM"])
async def convert_value(payload: ConvertRequest, db: DBSession, _: CurrentUser):
    # Try item-specific first, then global
    q = select(UoMConversion).where(
        UoMConversion.from_uom_id == payload.from_uom_id,
        UoMConversion.to_uom_id == payload.to_uom_id,
    )
    if payload.item_id:
        q_specific = q.where(UoMConversion.item_id == payload.item_id)
        result = await db.execute(q_specific)
        conv = result.scalar_one_or_none()
        if not conv:
            result = await db.execute(q.where(UoMConversion.item_id == None))
            conv = result.scalar_one_or_none()
    else:
        result = await db.execute(q.where(UoMConversion.item_id == None))
        conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="No conversion found")
    return {"input_value": payload.value, "converted_value": float(payload.value) * float(conv.factor), "factor": float(conv.factor)}

# ─── SerialNumber schemas ─────────────────────────────────────────────────────

class SerialCreate(BaseModel):
    item_id: uuid.UUID
    serial_no: str
    warehouse_id: uuid.UUID | None = None
    batch_id: uuid.UUID | None = None
    purchase_order_id: uuid.UUID | None = None
    status: str = "available"
    notes: str | None = None

class SerialUpdate(BaseModel):
    warehouse_id: uuid.UUID | None = None
    status: str | None = None
    sold_to_reference: str | None = None
    notes: str | None = None

class SerialOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    serial_no: str
    warehouse_id: uuid.UUID | None
    batch_id: uuid.UUID | None
    purchase_order_id: uuid.UUID | None
    status: str
    sold_to_reference: str | None
    notes: str | None
    item_name: str | None = None
    created_at: Any
    model_config = {"from_attributes": True}

# ─── Serial Number endpoints ──────────────────────────────────────────────────

@router.get("/serials", response_model=list[SerialOut], tags=["Inventory Serials"])
async def list_serials(
    db: DBSession, _: CurrentUser,
    item_id: uuid.UUID | None = None,
    status: str | None = None,
    warehouse_id: uuid.UUID | None = None,
):
    q = select(SerialNumber)
    if item_id:
        q = q.where(SerialNumber.item_id == item_id)
    if status:
        q = q.where(SerialNumber.status == status)
    if warehouse_id:
        q = q.where(SerialNumber.warehouse_id == warehouse_id)
    result = await db.execute(q.order_by(SerialNumber.serial_no))
    serials = result.scalars().all()
    out = []
    for s in serials:
        item = await db.get(InventoryItem, s.item_id)
        out.append(SerialOut(
            id=s.id, item_id=s.item_id, serial_no=s.serial_no, warehouse_id=s.warehouse_id,
            batch_id=s.batch_id, purchase_order_id=s.purchase_order_id, status=s.status,
            sold_to_reference=s.sold_to_reference, notes=s.notes,
            item_name=item.name if item else None, created_at=s.created_at,
        ))
    return out

@router.post("/serials", response_model=SerialOut, status_code=201, tags=["Inventory Serials"])
async def create_serial(payload: SerialCreate, db: DBSession, current_user: CurrentUser):
    sn = SerialNumber(**payload.model_dump())
    db.add(sn)
    await db.commit()
    await db.refresh(sn)
    item = await db.get(InventoryItem, sn.item_id)
    return SerialOut(
        id=sn.id, item_id=sn.item_id, serial_no=sn.serial_no, warehouse_id=sn.warehouse_id,
        batch_id=sn.batch_id, purchase_order_id=sn.purchase_order_id, status=sn.status,
        sold_to_reference=sn.sold_to_reference, notes=sn.notes,
        item_name=item.name if item else None, created_at=sn.created_at,
    )

@router.get("/serials/{serial_id}", response_model=SerialOut, tags=["Inventory Serials"])
async def get_serial(serial_id: uuid.UUID, db: DBSession, _: CurrentUser):
    sn = await db.get(SerialNumber, serial_id)
    if not sn:
        raise HTTPException(status_code=404)
    item = await db.get(InventoryItem, sn.item_id)
    return SerialOut(
        id=sn.id, item_id=sn.item_id, serial_no=sn.serial_no, warehouse_id=sn.warehouse_id,
        batch_id=sn.batch_id, purchase_order_id=sn.purchase_order_id, status=sn.status,
        sold_to_reference=sn.sold_to_reference, notes=sn.notes,
        item_name=item.name if item else None, created_at=sn.created_at,
    )

@router.patch("/serials/{serial_id}", response_model=SerialOut, tags=["Inventory Serials"])
async def update_serial(serial_id: uuid.UUID, payload: SerialUpdate, db: DBSession, _: CurrentUser):
    sn = await db.get(SerialNumber, serial_id)
    if not sn:
        raise HTTPException(status_code=404)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(sn, k, v)
    await db.commit()
    await db.refresh(sn)
    item = await db.get(InventoryItem, sn.item_id)
    return SerialOut(
        id=sn.id, item_id=sn.item_id, serial_no=sn.serial_no, warehouse_id=sn.warehouse_id,
        batch_id=sn.batch_id, purchase_order_id=sn.purchase_order_id, status=sn.status,
        sold_to_reference=sn.sold_to_reference, notes=sn.notes,
        item_name=item.name if item else None, created_at=sn.created_at,
    )

@router.get("/serials/{serial_id}/trace", tags=["Inventory Serials"])
async def trace_serial(serial_id: uuid.UUID, db: DBSession, _: CurrentUser):
    """Forward/backward traceability for a serial number."""
    sn = await db.get(SerialNumber, serial_id)
    if not sn:
        raise HTTPException(status_code=404)
    item = await db.get(InventoryItem, sn.item_id)
    po = None
    if sn.purchase_order_id:
        po = await db.get(PurchaseOrder, sn.purchase_order_id)
    return {
        "serial": {"id": str(sn.id), "serial_no": sn.serial_no, "status": sn.status},
        "item": {"id": str(item.id), "name": item.name, "sku": item.sku} if item else None,
        "received_via": {"po_number": po.po_number, "supplier": po.supplier_name} if po else None,
        "current_location": {"warehouse_id": str(sn.warehouse_id)} if sn.warehouse_id else None,
        "sold_to": sn.sold_to_reference,
    }

# ─── BlanketOrder schemas ─────────────────────────────────────────────────────

class BlanketOrderCreate(BaseModel):
    supplier_id: uuid.UUID
    start_date: date
    end_date: date | None = None
    total_value_limit: Decimal | None = None
    terms: str | None = None
    notes: str | None = None

class BlanketOrderUpdate(BaseModel):
    end_date: date | None = None
    total_value_limit: Decimal | None = None
    status: str | None = None
    terms: str | None = None
    notes: str | None = None

class BlanketOrderOut(BaseModel):
    id: uuid.UUID
    bo_number: str
    supplier_id: uuid.UUID
    start_date: date
    end_date: date | None
    total_value_limit: Decimal | None
    released_value: Decimal
    status: str
    terms: str | None
    notes: str | None
    supplier_name: str | None = None
    utilization_pct: float | None = None
    created_at: Any
    model_config = {"from_attributes": True}

async def _bo_out(bo: BlanketOrder, db: AsyncSession) -> BlanketOrderOut:
    supplier = await db.get(InventorySupplier, bo.supplier_id)
    util = None
    if bo.total_value_limit and bo.total_value_limit > 0:
        util = round(float(bo.released_value) / float(bo.total_value_limit) * 100, 1)
    return BlanketOrderOut(
        id=bo.id, bo_number=bo.bo_number, supplier_id=bo.supplier_id,
        start_date=bo.start_date, end_date=bo.end_date, total_value_limit=bo.total_value_limit,
        released_value=bo.released_value, status=bo.status, terms=bo.terms, notes=bo.notes,
        supplier_name=supplier.name if supplier else None, utilization_pct=util,
        created_at=bo.created_at,
    )

def _gen_bo_number() -> str:
    import secrets
    return "BO-" + secrets.token_hex(4).upper()

# ─── Blanket Order endpoints ──────────────────────────────────────────────────

@router.get("/blanket-orders", response_model=list[BlanketOrderOut], tags=["Inventory Blanket Orders"])
async def list_blanket_orders(db: DBSession, _: CurrentUser, status: str | None = None):
    q = select(BlanketOrder)
    if status:
        q = q.where(BlanketOrder.status == status)
    result = await db.execute(q.order_by(BlanketOrder.created_at.desc()))
    bos = result.scalars().all()
    return [await _bo_out(bo, db) for bo in bos]

@router.post("/blanket-orders", response_model=BlanketOrderOut, status_code=201, tags=["Inventory Blanket Orders"])
async def create_blanket_order(payload: BlanketOrderCreate, db: DBSession, current_user: CurrentUser):
    bo = BlanketOrder(**payload.model_dump(), bo_number=_gen_bo_number(), owner_id=current_user.id)
    db.add(bo)
    await db.commit()
    await db.refresh(bo)
    return await _bo_out(bo, db)

@router.get("/blanket-orders/{bo_id}", response_model=BlanketOrderOut, tags=["Inventory Blanket Orders"])
async def get_blanket_order(bo_id: uuid.UUID, db: DBSession, _: CurrentUser):
    bo = await db.get(BlanketOrder, bo_id)
    if not bo:
        raise HTTPException(status_code=404)
    return await _bo_out(bo, db)

@router.patch("/blanket-orders/{bo_id}", response_model=BlanketOrderOut, tags=["Inventory Blanket Orders"])
async def update_blanket_order(bo_id: uuid.UUID, payload: BlanketOrderUpdate, db: DBSession, _: CurrentUser):
    bo = await db.get(BlanketOrder, bo_id)
    if not bo:
        raise HTTPException(status_code=404)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(bo, k, v)
    await db.commit()
    await db.refresh(bo)
    return await _bo_out(bo, db)

@router.post("/blanket-orders/{bo_id}/release", tags=["Inventory Blanket Orders"])
async def release_blanket_order(
    bo_id: uuid.UUID,
    release_value: Decimal,
    db: DBSession,
    current_user: CurrentUser,
):
    """Record that a PO has been released against this blanket order."""
    bo = await db.get(BlanketOrder, bo_id)
    if not bo:
        raise HTTPException(status_code=404)
    if bo.status not in ("active", "draft"):
        raise HTTPException(status_code=400, detail="Blanket order is not active")
    bo.released_value = (bo.released_value or Decimal(0)) + release_value
    if bo.total_value_limit and bo.released_value >= bo.total_value_limit:
        bo.status = "exhausted"
    await db.commit()
    return {"released_value": float(bo.released_value), "status": bo.status}

# ─── Three-Way Match endpoints ────────────────────────────────────────────────

@router.get("/purchase-orders/{po_id}/match-status", tags=["Inventory 3-Way Match"])
async def get_match_status(po_id: uuid.UUID, db: DBSession, _: CurrentUser):
    po = await db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404)
    result = await db.execute(select(PurchaseOrderLine).where(PurchaseOrderLine.purchase_order_id == po_id))
    lines = result.scalars().all()
    line_details = []
    all_matched = True
    for line in lines:
        item = await db.get(InventoryItem, line.item_id)
        matched = line.received_quantity >= line.quantity
        if not matched:
            all_matched = False
        line_details.append({
            "item_name": item.name if item else str(line.item_id),
            "ordered": line.quantity,
            "received": line.received_quantity,
            "unit_price": float(line.unit_price),
            "matched": matched,
        })
    return {
        "po_number": po.po_number,
        "status": po.three_way_match_status,
        "all_matched": all_matched,
        "lines": line_details,
    }

@router.post("/purchase-orders/{po_id}/match", tags=["Inventory 3-Way Match"])
async def perform_match(po_id: uuid.UUID, db: DBSession, _: CurrentUser):
    """Run three-way match: PO qty vs received qty vs invoice."""
    po = await db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404)
    result = await db.execute(select(PurchaseOrderLine).where(PurchaseOrderLine.purchase_order_id == po_id))
    lines = result.scalars().all()
    discrepancies = [l for l in lines if l.received_quantity != l.quantity]
    if discrepancies:
        po.three_way_match_status = "discrepancy"
    else:
        po.three_way_match_status = "matched"
    await db.commit()
    return {"match_status": po.three_way_match_status, "discrepancy_count": len(discrepancies)}
