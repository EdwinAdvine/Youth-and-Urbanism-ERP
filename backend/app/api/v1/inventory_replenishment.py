"""Inventory Phase 3 — Replenishment Rules, Purchase Suggestions, ABC/XYZ Analysis."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.models.inventory import (
    PurchaseSuggestion, ItemClassification,
    InventoryItem, Warehouse, StockLevel, StockMovement,
)

router = APIRouter()

# ─── PurchaseSuggestion schemas ───────────────────────────────────────────────

class SuggestionOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    supplier_id: uuid.UUID | None
    suggested_qty: int
    reason: str | None
    status: str
    item_name: str | None = None
    warehouse_name: str | None = None
    created_at: Any
    model_config = {"from_attributes": True}

# ─── Purchase Suggestion endpoints ───────────────────────────────────────────

@router.get("/purchase-suggestions", response_model=list[SuggestionOut], tags=["Inventory Replenishment"])
async def list_suggestions(db: DBSession, _: CurrentUser, status: str = "pending"):
    q = select(PurchaseSuggestion).where(PurchaseSuggestion.status == status)
    result = await db.execute(q.order_by(PurchaseSuggestion.created_at.desc()))
    suggestions = result.scalars().all()
    out = []
    for s in suggestions:
        item = await db.get(InventoryItem, s.item_id)
        wh = await db.get(Warehouse, s.warehouse_id)
        out.append(SuggestionOut(
            id=s.id, item_id=s.item_id, warehouse_id=s.warehouse_id, supplier_id=s.supplier_id,
            suggested_qty=s.suggested_qty, reason=s.reason, status=s.status,
            item_name=item.name if item else None, warehouse_name=wh.name if wh else None,
            created_at=s.created_at,
        ))
    return out

@router.post("/purchase-suggestions/run", tags=["Inventory Replenishment"])
async def run_replenishment_check(db: DBSession, current_user: CurrentUser):
    """Scan all items and generate purchase suggestions for those below reorder level."""
    result = await db.execute(select(StockLevel))
    levels = result.scalars().all()
    created = 0
    for level in levels:
        item = await db.get(InventoryItem, level.item_id)
        if not item or not item.is_active:
            continue
        if level.quantity_on_hand <= item.reorder_level:
            reorder_qty = max(item.min_order_qty, item.reorder_level * 2 - level.quantity_on_hand)
            # Check if suggestion already pending
            existing = await db.execute(
                select(PurchaseSuggestion).where(
                    PurchaseSuggestion.item_id == item.id,
                    PurchaseSuggestion.warehouse_id == level.warehouse_id,
                    PurchaseSuggestion.status == "pending",
                )
            )
            if existing.scalar_one_or_none():
                continue
            suggestion = PurchaseSuggestion(
                item_id=item.id,
                warehouse_id=level.warehouse_id,
                supplier_id=item.preferred_supplier_id,
                suggested_qty=reorder_qty,
                reason=f"Stock {level.quantity_on_hand} is at or below reorder level {item.reorder_level}",
            )
            db.add(suggestion)
            created += 1
    await db.commit()
    return {"suggestions_created": created}

@router.post("/purchase-suggestions/{suggestion_id}/accept", tags=["Inventory Replenishment"])
async def accept_suggestion(suggestion_id: uuid.UUID, db: DBSession, _: CurrentUser):
    s = await db.get(PurchaseSuggestion, suggestion_id)
    if not s:
        raise HTTPException(status_code=404)
    s.status = "accepted"
    await db.commit()
    return {"id": str(s.id), "status": s.status}

@router.post("/purchase-suggestions/{suggestion_id}/dismiss", tags=["Inventory Replenishment"])
async def dismiss_suggestion(suggestion_id: uuid.UUID, db: DBSession, _: CurrentUser):
    s = await db.get(PurchaseSuggestion, suggestion_id)
    if not s:
        raise HTTPException(status_code=404)
    s.status = "dismissed"
    await db.commit()
    return {"id": str(s.id), "status": s.status}

@router.post("/purchase-suggestions/bulk-accept", tags=["Inventory Replenishment"])
async def bulk_accept_suggestions(ids: list[uuid.UUID], db: DBSession, _: CurrentUser):
    updated = 0
    for sid in ids:
        s = await db.get(PurchaseSuggestion, sid)
        if s and s.status == "pending":
            s.status = "accepted"
            updated += 1
    await db.commit()
    return {"accepted": updated}

# ─── ABC/XYZ Analysis endpoints ──────────────────────────────────────────────

class ClassificationOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    abc_class: str | None
    xyz_class: str | None
    combined_class: str | None
    annual_consumption_value: Decimal
    demand_variability: Decimal | None
    calculated_at: Any | None
    item_name: str | None = None
    model_config = {"from_attributes": True}

@router.get("/abc-analysis", response_model=list[ClassificationOut], tags=["Inventory Replenishment"])
async def list_abc_analysis(db: DBSession, _: CurrentUser, warehouse_id: uuid.UUID | None = None):
    q = select(ItemClassification)
    if warehouse_id:
        q = q.where(ItemClassification.warehouse_id == warehouse_id)
    result = await db.execute(q.order_by(ItemClassification.annual_consumption_value.desc()))
    rows = result.scalars().all()
    out = []
    for r in rows:
        item = await db.get(InventoryItem, r.item_id)
        out.append(ClassificationOut(
            id=r.id, item_id=r.item_id, warehouse_id=r.warehouse_id,
            abc_class=r.abc_class, xyz_class=r.xyz_class, combined_class=r.combined_class,
            annual_consumption_value=r.annual_consumption_value, demand_variability=r.demand_variability,
            calculated_at=r.calculated_at, item_name=item.name if item else None,
        ))
    return out

@router.post("/abc-analysis/calculate", tags=["Inventory Replenishment"])
async def calculate_abc(db: DBSession, _: CurrentUser, warehouse_id: uuid.UUID | None = None):
    """Calculate ABC classification based on annual consumption value."""
    # Get all stock levels
    q = select(StockLevel)
    if warehouse_id:
        q = q.where(StockLevel.warehouse_id == warehouse_id)
    result = await db.execute(q)
    levels = result.scalars().all()

    # Calculate annual consumption value per item/warehouse
    item_values: dict[tuple, float] = {}
    for level in levels:
        item = await db.get(InventoryItem, level.item_id)
        if not item:
            continue
        # Proxy: on_hand * cost_price * 12 months
        val = float(level.quantity_on_hand) * float(item.cost_price) * 12
        key = (str(item.id), str(level.warehouse_id))
        item_values[key] = val

    if not item_values:
        return {"classified": 0}

    # Sort by value descending
    sorted_items = sorted(item_values.items(), key=lambda x: x[1], reverse=True)
    total_value = sum(v for _, v in sorted_items)

    classified = 0
    cumulative = 0.0
    for (item_id_str, wh_id_str), val in sorted_items:
        cumulative += val
        pct = cumulative / total_value if total_value > 0 else 0
        abc = "A" if pct <= 0.8 else ("B" if pct <= 0.95 else "C")

        item_id = uuid.UUID(item_id_str)
        wh_id = uuid.UUID(wh_id_str)

        existing = await db.execute(
            select(ItemClassification).where(
                ItemClassification.item_id == item_id,
                ItemClassification.warehouse_id == wh_id,
            )
        )
        clf = existing.scalar_one_or_none()
        if clf:
            clf.abc_class = abc
            clf.annual_consumption_value = Decimal(str(round(val, 2)))
            clf.combined_class = abc + (clf.xyz_class or "")
            clf.calculated_at = datetime.utcnow()
        else:
            clf = ItemClassification(
                item_id=item_id, warehouse_id=wh_id,
                abc_class=abc, annual_consumption_value=Decimal(str(round(val, 2))),
                calculated_at=datetime.utcnow(),
            )
            db.add(clf)
        classified += 1
    await db.commit()
    return {"classified": classified}

@router.get("/abc-analysis/summary", tags=["Inventory Replenishment"])
async def abc_summary(db: DBSession, _: CurrentUser):
    result = await db.execute(select(ItemClassification))
    rows = result.scalars().all()
    summary: dict[str, int] = {"A": 0, "B": 0, "C": 0, "unclassified": 0}
    for r in rows:
        if r.abc_class in summary:
            summary[r.abc_class] += 1
        else:
            summary["unclassified"] += 1
    return summary

@router.get("/overstock-alerts", tags=["Inventory Replenishment"])
async def overstock_alerts(db: DBSession, _: CurrentUser):
    """Return items where quantity_on_hand > max_stock_level."""
    result = await db.execute(select(StockLevel))
    levels = result.scalars().all()
    alerts = []
    for level in levels:
        item = await db.get(InventoryItem, level.item_id)
        if item and item.max_stock_level and level.quantity_on_hand > item.max_stock_level:
            wh = await db.get(Warehouse, level.warehouse_id)
            alerts.append({
                "item_id": str(item.id),
                "item_name": item.name,
                "sku": item.sku,
                "warehouse_id": str(level.warehouse_id),
                "warehouse_name": wh.name if wh else None,
                "quantity_on_hand": level.quantity_on_hand,
                "max_stock_level": item.max_stock_level,
                "excess": level.quantity_on_hand - item.max_stock_level,
            })
    return alerts
