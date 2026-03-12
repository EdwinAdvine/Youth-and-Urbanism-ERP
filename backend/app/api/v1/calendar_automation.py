"""Calendar automation rules — CRUD endpoints for auto-accept/decline/schedule rules."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.calendar import CalendarRule

router = APIRouter(prefix="/calendar/automation", tags=["Calendar - Automation"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class RuleCreate(BaseModel):
    name: str
    rule_type: str  # auto_accept, auto_decline, auto_schedule, auto_remind
    conditions: dict = {}
    actions: dict = {}
    is_active: bool = True


class RuleUpdate(BaseModel):
    name: str | None = None
    rule_type: str | None = None
    conditions: dict | None = None
    actions: dict | None = None
    is_active: bool | None = None


class RuleOut(BaseModel):
    id: str
    name: str
    rule_type: str
    conditions: dict
    actions: dict
    is_active: bool
    created_at: str


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/rules")
async def list_rules(db: DBSession, user: CurrentUser):
    result = await db.execute(
        select(CalendarRule)
        .where(CalendarRule.user_id == user.id)
        .order_by(CalendarRule.created_at.desc())
    )
    rules = result.scalars().all()
    return {
        "rules": [
            RuleOut(
                id=str(r.id),
                name=r.name,
                rule_type=r.rule_type,
                conditions=r.conditions or {},
                actions=r.actions or {},
                is_active=r.is_active,
                created_at=r.created_at.isoformat() if r.created_at else "",
            )
            for r in rules
        ]
    }


@router.post("/rules", status_code=status.HTTP_201_CREATED)
async def create_rule(payload: RuleCreate, db: DBSession, user: CurrentUser):
    rule = CalendarRule(
        id=uuid.uuid4(),
        user_id=user.id,
        name=payload.name,
        rule_type=payload.rule_type,
        conditions=payload.conditions,
        actions=payload.actions,
        is_active=payload.is_active,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return RuleOut(
        id=str(rule.id),
        name=rule.name,
        rule_type=rule.rule_type,
        conditions=rule.conditions or {},
        actions=rule.actions or {},
        is_active=rule.is_active,
        created_at=rule.created_at.isoformat() if rule.created_at else "",
    )


@router.put("/rules/{rule_id}")
async def update_rule(rule_id: str, payload: RuleUpdate, db: DBSession, user: CurrentUser):
    rule = await db.get(CalendarRule, uuid.UUID(rule_id))
    if not rule or rule.user_id != user.id:
        raise HTTPException(status_code=404, detail="Rule not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)

    await db.commit()
    await db.refresh(rule)
    return RuleOut(
        id=str(rule.id),
        name=rule.name,
        rule_type=rule.rule_type,
        conditions=rule.conditions or {},
        actions=rule.actions or {},
        is_active=rule.is_active,
        created_at=rule.created_at.isoformat() if rule.created_at else "",
    )


@router.delete("/rules/{rule_id}", status_code=status.HTTP_200_OK)
async def delete_rule(rule_id: str, db: DBSession, user: CurrentUser):
    rule = await db.get(CalendarRule, uuid.UUID(rule_id))
    if not rule or rule.user_id != user.id:
        raise HTTPException(status_code=404, detail="Rule not found")
    await db.delete(rule)
    await db.commit()
