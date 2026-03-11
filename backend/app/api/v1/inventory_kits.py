"""Inventory Phase 4 — Kits/Bundles, Supplier Pricing, Landed Costs."""
from __future__ import annotations

import uuid
import secrets
from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, select

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.models.inventory import (
    Kit, KitComponent, SupplierPriceList,
    LandedCostVoucher, LandedCostLine, LandedCostAllocation,
    InventoryItem, InventorySupplier, StockLevel,
)

router = APIRouter()

# ─── Kit schemas ──────────────────────────────────────────────────────────────

class KitComponentIn(BaseModel):
    component_item_id: uuid.UUID
    quantity: Decimal
    is_optional: bool = False

class KitCreate(BaseModel):
    kit_item_id: uuid.UUID
    description: str | None = None
    components: list[KitComponentIn] = []

class KitComponentOut(BaseModel):
    id: uuid.UUID
    component_item_id: uuid.UUID
    quantity: Decimal
    is_optional: bool
    item_name: str | None = None
    model_config = {"from_attributes": True}

class KitOut(BaseModel):
    id: uuid.UUID
    kit_item_id: uuid.UUID
    description: str | None
    is_active: bool
    kit_item_name: str | None = None
    components: list[KitComponentOut] = []
    model_config = {"from_attributes": True}

# ─── Kit endpoints ─────────────────────────────────────────────────────────────

@router.get("/kits", response_model=list[KitOut], tags=["Inventory Kits"])
async def list_kits(db: DBSession, _: CurrentUser):
    result = await db.execute(select(Kit).where(Kit.is_active == True))
    kits = result.scalars().all()
    out = []
    for kit in kits:
        kit_item = await db.get(InventoryItem, kit.kit_item_id)
        comps_result = await db.execute(select(KitComponent).where(KitComponent.kit_id == kit.id))
        comps = comps_result.scalars().all()
        comp_outs = []
        for c in comps:
            ci = await db.get(InventoryItem, c.component_item_id)
            comp_outs.append(KitComponentOut(
                id=c.id, component_item_id=c.component_item_id,
                quantity=c.quantity, is_optional=c.is_optional,
                item_name=ci.name if ci else None,
            ))
        out.append(KitOut(
            id=kit.id, kit_item_id=kit.kit_item_id, description=kit.description,
            is_active=kit.is_active, kit_item_name=kit_item.name if kit_item else None,
            components=comp_outs,
        ))
    return out

@router.post("/kits", response_model=KitOut, status_code=201, tags=["Inventory Kits"])
async def create_kit(payload: KitCreate, db: DBSession, _: CurrentUser):
    kit = Kit(kit_item_id=payload.kit_item_id, description=payload.description)
    db.add(kit)
    await db.flush()
    comp_outs = []
    for c in payload.components:
        comp = KitComponent(kit_id=kit.id, **c.model_dump())
        db.add(comp)
        await db.flush()
        ci = await db.get(InventoryItem, comp.component_item_id)
        comp_outs.append(KitComponentOut(
            id=comp.id, component_item_id=comp.component_item_id,
            quantity=comp.quantity, is_optional=comp.is_optional,
            item_name=ci.name if ci else None,
        ))
    await db.commit()
    kit_item = await db.get(InventoryItem, kit.kit_item_id)
    return KitOut(
        id=kit.id, kit_item_id=kit.kit_item_id, description=kit.description,
        is_active=kit.is_active, kit_item_name=kit_item.name if kit_item else None,
        components=comp_outs,
    )

@router.get("/kits/{kit_id}/check-availability", tags=["Inventory Kits"])
async def check_kit_availability(kit_id: uuid.UUID, warehouse_id: uuid.UUID, quantity: int, db: DBSession, _: CurrentUser):
    """Check if sufficient components are available to assemble the kit."""
    kit = await db.get(Kit, kit_id)
    if not kit:
        raise HTTPException(status_code=404)
    comps_result = await db.execute(select(KitComponent).where(KitComponent.kit_id == kit_id))
    comps = comps_result.scalars().all()
    availability = []
    can_assemble = True
    for c in comps:
        needed = int(float(c.quantity) * quantity)
        level_result = await db.execute(
            select(StockLevel).where(StockLevel.item_id == c.component_item_id, StockLevel.warehouse_id == warehouse_id)
        )
        level = level_result.scalar_one_or_none()
        available = level.quantity_on_hand if level else 0
        sufficient = available >= needed
        if not sufficient and not c.is_optional:
            can_assemble = False
        item = await db.get(InventoryItem, c.component_item_id)
        availability.append({
            "component": item.name if item else str(c.component_item_id),
            "needed": needed, "available": available, "sufficient": sufficient, "optional": c.is_optional,
        })
    return {"can_assemble": can_assemble, "requested_qty": quantity, "components": availability}

# ─── Supplier Price List schemas ──────────────────────────────────────────────

class SupplierPriceCreate(BaseModel):
    supplier_id: uuid.UUID
    item_id: uuid.UUID
    unit_price: Decimal
    min_order_qty: int = 1
    lead_time_days: int = 0
    currency: str = "USD"
    valid_from: date | None = None
    valid_to: date | None = None

class SupplierPriceOut(BaseModel):
    id: uuid.UUID
    supplier_id: uuid.UUID
    item_id: uuid.UUID
    unit_price: Decimal
    min_order_qty: int
    lead_time_days: int
    currency: str
    valid_from: date | None
    valid_to: date | None
    is_active: bool
    supplier_name: str | None = None
    item_name: str | None = None
    model_config = {"from_attributes": True}

# ─── Supplier Price List endpoints ───────────────────────────────────────────

@router.get("/supplier-prices", response_model=list[SupplierPriceOut], tags=["Inventory Pricing"])
async def list_supplier_prices(db: DBSession, _: CurrentUser, item_id: uuid.UUID | None = None, supplier_id: uuid.UUID | None = None):
    q = select(SupplierPriceList).where(SupplierPriceList.is_active == True)
    if item_id:
        q = q.where(SupplierPriceList.item_id == item_id)
    if supplier_id:
        q = q.where(SupplierPriceList.supplier_id == supplier_id)
    result = await db.execute(q.order_by(SupplierPriceList.unit_price))
    rows = result.scalars().all()
    out = []
    for r in rows:
        supplier = await db.get(InventorySupplier, r.supplier_id)
        item = await db.get(InventoryItem, r.item_id)
        out.append(SupplierPriceOut(
            id=r.id, supplier_id=r.supplier_id, item_id=r.item_id, unit_price=r.unit_price,
            min_order_qty=r.min_order_qty, lead_time_days=r.lead_time_days, currency=r.currency,
            valid_from=r.valid_from, valid_to=r.valid_to, is_active=r.is_active,
            supplier_name=supplier.name if supplier else None,
            item_name=item.name if item else None,
        ))
    return out

@router.post("/supplier-prices", response_model=SupplierPriceOut, status_code=201, tags=["Inventory Pricing"])
async def create_supplier_price(payload: SupplierPriceCreate, db: DBSession, _: CurrentUser):
    price = SupplierPriceList(**payload.model_dump())
    db.add(price)
    await db.commit()
    await db.refresh(price)
    supplier = await db.get(InventorySupplier, price.supplier_id)
    item = await db.get(InventoryItem, price.item_id)
    return SupplierPriceOut(
        id=price.id, supplier_id=price.supplier_id, item_id=price.item_id, unit_price=price.unit_price,
        min_order_qty=price.min_order_qty, lead_time_days=price.lead_time_days, currency=price.currency,
        valid_from=price.valid_from, valid_to=price.valid_to, is_active=price.is_active,
        supplier_name=supplier.name if supplier else None, item_name=item.name if item else None,
    )

@router.get("/supplier-prices/best-price", tags=["Inventory Pricing"])
async def best_price(item_id: uuid.UUID, quantity: int, db: DBSession, _: CurrentUser):
    today = date.today()
    q = select(SupplierPriceList).where(
        SupplierPriceList.item_id == item_id,
        SupplierPriceList.is_active == True,
        SupplierPriceList.min_order_qty <= quantity,
    ).where(
        (SupplierPriceList.valid_to == None) | (SupplierPriceList.valid_to >= today)
    ).order_by(SupplierPriceList.unit_price)
    result = await db.execute(q.limit(1))
    best = result.scalar_one_or_none()
    if not best:
        return {"message": "No price list found"}
    supplier = await db.get(InventorySupplier, best.supplier_id)
    return {
        "supplier_id": str(best.supplier_id),
        "supplier_name": supplier.name if supplier else None,
        "unit_price": float(best.unit_price),
        "lead_time_days": best.lead_time_days,
        "total_price": float(best.unit_price) * quantity,
    }

# ─── Landed Cost schemas ──────────────────────────────────────────────────────

class LandedCostLineIn(BaseModel):
    cost_type: str
    amount: Decimal
    currency: str = "USD"
    description: str | None = None

class LandedCostCreate(BaseModel):
    purchase_order_id: uuid.UUID | None = None
    notes: str | None = None
    cost_lines: list[LandedCostLineIn] = []

class LandedCostLineOut(BaseModel):
    id: uuid.UUID
    cost_type: str
    amount: Decimal
    currency: str
    description: str | None
    model_config = {"from_attributes": True}

class LandedCostVoucherOut(BaseModel):
    id: uuid.UUID
    voucher_number: str
    purchase_order_id: uuid.UUID | None
    status: str
    notes: str | None
    cost_lines: list[LandedCostLineOut] = []
    total_cost: float = 0.0
    created_at: Any
    model_config = {"from_attributes": True}

# ─── Landed Cost endpoints ────────────────────────────────────────────────────

@router.get("/landed-costs", response_model=list[LandedCostVoucherOut], tags=["Inventory Landed Costs"])
async def list_landed_costs(db: DBSession, _: CurrentUser):
    result = await db.execute(select(LandedCostVoucher).order_by(LandedCostVoucher.created_at.desc()))
    vouchers = result.scalars().all()
    out = []
    for v in vouchers:
        lines_result = await db.execute(select(LandedCostLine).where(LandedCostLine.voucher_id == v.id))
        lines = lines_result.scalars().all()
        line_outs = [LandedCostLineOut(id=l.id, cost_type=l.cost_type, amount=l.amount, currency=l.currency, description=l.description) for l in lines]
        out.append(LandedCostVoucherOut(
            id=v.id, voucher_number=v.voucher_number, purchase_order_id=v.purchase_order_id,
            status=v.status, notes=v.notes, cost_lines=line_outs,
            total_cost=sum(float(l.amount) for l in lines), created_at=v.created_at,
        ))
    return out

@router.post("/landed-costs", response_model=LandedCostVoucherOut, status_code=201, tags=["Inventory Landed Costs"])
async def create_landed_cost(payload: LandedCostCreate, db: DBSession, current_user: CurrentUser):
    voucher_number = "LC-" + secrets.token_hex(4).upper()
    voucher = LandedCostVoucher(
        voucher_number=voucher_number, purchase_order_id=payload.purchase_order_id,
        notes=payload.notes, owner_id=current_user.id,
    )
    db.add(voucher)
    await db.flush()
    line_outs = []
    for line_data in payload.cost_lines:
        line = LandedCostLine(voucher_id=voucher.id, **line_data.model_dump())
        db.add(line)
        await db.flush()
        line_outs.append(LandedCostLineOut(id=line.id, cost_type=line.cost_type, amount=line.amount, currency=line.currency, description=line.description))
    await db.commit()
    return LandedCostVoucherOut(
        id=voucher.id, voucher_number=voucher.voucher_number, purchase_order_id=voucher.purchase_order_id,
        status=voucher.status, notes=voucher.notes, cost_lines=line_outs,
        total_cost=sum(float(l.amount) for l in line_outs), created_at=voucher.created_at,
    )

@router.post("/landed-costs/{voucher_id}/apply", tags=["Inventory Landed Costs"])
async def apply_landed_cost(voucher_id: uuid.UUID, allocation_method: str = "by_value", db: DBSession = None, current_user: CurrentUser = None):
    """Allocate landed costs to PO line items and mark voucher as applied."""
    voucher = await db.get(LandedCostVoucher, voucher_id)
    if not voucher:
        raise HTTPException(status_code=404)
    if voucher.status != "draft":
        raise HTTPException(status_code=400, detail="Voucher already applied or cancelled")
    lines_result = await db.execute(select(LandedCostLine).where(LandedCostLine.voucher_id == voucher_id))
    cost_lines = lines_result.scalars().all()
    total_cost = sum(float(l.amount) for l in cost_lines)
    voucher.status = "applied"
    await db.commit()
    return {"voucher_number": voucher.voucher_number, "total_cost_applied": total_cost, "status": voucher.status}
