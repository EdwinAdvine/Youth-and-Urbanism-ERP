"""Inventory Phase 6 — Automation Rules, Demand Forecasting, AI Insights."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.inventory import (
    InventoryAutomationRule, InventoryItem, StockLevel, Warehouse,
)

router = APIRouter()

# ─── AutomationRule schemas ───────────────────────────────────────────────────

class AutomationRuleCreate(BaseModel):
    name: str
    trigger_event: str
    conditions: dict | None = None
    action_type: str
    action_config: dict | None = None

class AutomationRuleUpdate(BaseModel):
    name: str | None = None
    trigger_event: str | None = None
    conditions: dict | None = None
    action_type: str | None = None
    action_config: dict | None = None
    is_active: bool | None = None

class AutomationRuleOut(BaseModel):
    id: uuid.UUID
    name: str
    trigger_event: str
    conditions: dict | None
    action_type: str
    action_config: dict | None
    is_active: bool
    last_triggered_at: Any | None
    created_at: Any
    model_config = {"from_attributes": True}

# ─── Automation Rule endpoints ────────────────────────────────────────────────

@router.get("/automation-rules", response_model=list[AutomationRuleOut], tags=["Inventory Automation"])
async def list_automation_rules(db: DBSession, _: CurrentUser):
    result = await db.execute(select(InventoryAutomationRule).order_by(InventoryAutomationRule.name))
    return result.scalars().all()

@router.post("/automation-rules", response_model=AutomationRuleOut, status_code=201, tags=["Inventory Automation"])
async def create_automation_rule(payload: AutomationRuleCreate, db: DBSession, current_user: CurrentUser):
    rule = InventoryAutomationRule(**payload.model_dump(), owner_id=current_user.id)
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule

@router.patch("/automation-rules/{rule_id}", response_model=AutomationRuleOut, tags=["Inventory Automation"])
async def update_automation_rule(rule_id: uuid.UUID, payload: AutomationRuleUpdate, db: DBSession, _: CurrentUser):
    rule = await db.get(InventoryAutomationRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(rule, k, v)
    await db.commit()
    await db.refresh(rule)
    return rule

@router.delete("/automation-rules/{rule_id}", status_code=204, tags=["Inventory Automation"])
async def delete_automation_rule(rule_id: uuid.UUID, db: DBSession, _: CurrentUser):
    rule = await db.get(InventoryAutomationRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404)
    await db.delete(rule)
    await db.commit()

@router.post("/automation-rules/{rule_id}/test", tags=["Inventory Automation"])
async def test_automation_rule(rule_id: uuid.UUID, db: DBSession, _: CurrentUser):
    """Dry-run an automation rule to see what it would do."""
    rule = await db.get(InventoryAutomationRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404)
    return {
        "rule_id": str(rule.id),
        "name": rule.name,
        "trigger_event": rule.trigger_event,
        "action_type": rule.action_type,
        "would_affect": "Dry run complete — no changes made",
        "is_active": rule.is_active,
    }

# ─── Forecast / AI Insights endpoints ────────────────────────────────────────

@router.get("/forecast/insights", tags=["Inventory Forecasting"])
async def ai_inventory_insights(db: DBSession, _: CurrentUser):
    """Return AI-generated inventory insights based on current stock data."""
    result = await db.execute(select(StockLevel))
    levels = result.scalars().all()

    total_items = len(levels)
    low_stock = 0
    zero_stock = 0
    overstock = 0

    for level in levels:
        item = await db.get(InventoryItem, level.item_id)
        if not item:
            continue
        if level.quantity_on_hand == 0:
            zero_stock += 1
        elif level.quantity_on_hand <= item.reorder_level:
            low_stock += 1
        if item.max_stock_level and level.quantity_on_hand > item.max_stock_level:
            overstock += 1

    insights = []
    if zero_stock > 0:
        insights.append({"type": "critical", "message": f"{zero_stock} items are completely out of stock. Immediate replenishment required."})
    if low_stock > 0:
        insights.append({"type": "warning", "message": f"{low_stock} items are below reorder level. Consider placing purchase orders."})
    if overstock > 0:
        insights.append({"type": "info", "message": f"{overstock} items exceed max stock level. Consider promotions or transfers."})
    if not insights:
        insights.append({"type": "success", "message": "All items are within optimal stock levels."})

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "summary": {"total_stock_levels": total_items, "zero_stock": zero_stock, "low_stock": low_stock, "overstock": overstock},
        "insights": insights,
    }

@router.get("/forecast/demand/{item_id}", tags=["Inventory Forecasting"])
async def demand_forecast(item_id: uuid.UUID, db: DBSession, _: CurrentUser, periods: int = 3):
    """Simple moving average demand forecast for an item."""
    from app.models.inventory import StockMovement
    result = await db.execute(
        select(StockMovement).where(
            StockMovement.item_id == item_id,
            StockMovement.movement_type == "issue",
        ).order_by(StockMovement.created_at.desc()).limit(30)
    )
    movements = result.scalars().all()
    if not movements:
        return {"item_id": str(item_id), "forecast": [], "message": "Insufficient historical data"}

    total_issued = sum(m.quantity for m in movements)
    avg_per_period = total_issued / max(len(movements), 1)

    forecasts = []
    for i in range(1, periods + 1):
        forecasts.append({
            "period": i,
            "forecasted_demand": round(avg_per_period * 30, 0),  # monthly
            "confidence": "low" if len(movements) < 10 else ("medium" if len(movements) < 20 else "high"),
        })

    item = await db.get(InventoryItem, item_id)
    return {
        "item_id": str(item_id),
        "item_name": item.name if item else None,
        "data_points_used": len(movements),
        "forecast": forecasts,
    }
