"""CRM Lead Scoring — CRUD for scoring rules + score execution."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.crm import LeadScoringRule
from app.services.crm_scoring import batch_rescore_all, score_lead

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────


class ScoringRuleCreate(BaseModel):
    name: str
    category: str  # demographic, behavioral, firmographic, engagement
    field_name: str
    operator: str  # equals, contains, greater_than, less_than, in
    value: str
    score_delta: int
    is_active: bool = True


class ScoringRuleUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    field_name: str | None = None
    operator: str | None = None
    value: str | None = None
    score_delta: int | None = None
    is_active: bool | None = None


class ScoringRuleOut(BaseModel):
    id: uuid.UUID
    name: str
    category: str
    field_name: str
    operator: str
    value: str
    score_delta: int
    is_active: bool
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/scoring/rules", summary="List scoring rules")
async def list_scoring_rules(
    current_user: CurrentUser,
    db: DBSession,
    category: str | None = Query(None),
    active_only: bool = Query(False),
) -> dict[str, Any]:
    query = select(LeadScoringRule)
    if category:
        query = query.where(LeadScoringRule.category == category)
    if active_only:
        query = query.where(LeadScoringRule.is_active.is_(True))
    query = query.order_by(LeadScoringRule.created_at)
    result = await db.execute(query)
    rules = result.scalars().all()
    return {"rules": [ScoringRuleOut.model_validate(r).model_dump() for r in rules]}


@router.post("/scoring/rules", status_code=201, summary="Create a scoring rule")
async def create_scoring_rule(
    payload: ScoringRuleCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    rule = LeadScoringRule(
        name=payload.name,
        category=payload.category,
        field_name=payload.field_name,
        operator=payload.operator,
        value=payload.value,
        score_delta=payload.score_delta,
        is_active=payload.is_active,
        created_by=current_user.id,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return ScoringRuleOut.model_validate(rule).model_dump()


@router.put("/scoring/rules/{rule_id}", summary="Update a scoring rule")
async def update_scoring_rule(
    rule_id: uuid.UUID,
    payload: ScoringRuleUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    rule = await db.get(LeadScoringRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Scoring rule not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(rule, k, v)
    await db.commit()
    await db.refresh(rule)
    return ScoringRuleOut.model_validate(rule).model_dump()


@router.delete("/scoring/rules/{rule_id}", status_code=204, summary="Delete a scoring rule")
async def delete_scoring_rule(
    rule_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    rule = await db.get(LeadScoringRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Scoring rule not found")
    await db.delete(rule)
    await db.commit()
    return Response(status_code=204)


@router.post("/scoring/run", summary="Batch re-score all leads")
async def run_batch_scoring(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await batch_rescore_all(db)
    await db.commit()
    return result


@router.post("/leads/{lead_id}/score", summary="Score a single lead")
async def score_single_lead(
    lead_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await score_lead(db, lead_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    await db.commit()
    return result


@router.get("/scoring/weights", summary="Get scoring weights summary")
async def get_scoring_weights(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(LeadScoringRule).where(LeadScoringRule.is_active.is_(True))
    )
    rules = result.scalars().all()
    by_category: dict[str, list] = {}
    total_possible = 0
    for r in rules:
        by_category.setdefault(r.category, []).append({
            "name": r.name,
            "field": r.field_name,
            "delta": r.score_delta,
        })
        if r.score_delta > 0:
            total_possible += r.score_delta
    return {
        "total_possible_score": total_possible,
        "categories": by_category,
        "active_rules": len(rules),
    }
