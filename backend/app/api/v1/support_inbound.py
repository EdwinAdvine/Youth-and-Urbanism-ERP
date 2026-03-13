"""Support Inbound Email API — configure email-to-ticket routing rules."""

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.support_phase1 import InboundEmailRule

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class InboundRuleCreate(BaseModel):
    email_address: str
    category_id: uuid.UUID | None = None
    priority: str = "medium"
    assign_to: uuid.UUID | None = None
    auto_reply_template_id: uuid.UUID | None = None
    is_active: bool = True


class InboundRuleUpdate(BaseModel):
    email_address: str | None = None
    category_id: uuid.UUID | None = None
    priority: str | None = None
    assign_to: uuid.UUID | None = None
    auto_reply_template_id: uuid.UUID | None = None
    is_active: bool | None = None


class InboundRuleOut(BaseModel):
    id: uuid.UUID
    email_address: str
    category_id: uuid.UUID | None
    category_name: str | None = None
    priority: str
    assign_to: uuid.UUID | None
    assignee_name: str | None = None
    auto_reply_template_id: uuid.UUID | None
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


def _rule_out(rule: InboundEmailRule) -> dict:
    d = InboundRuleOut.model_validate(rule).model_dump()
    d["category_name"] = rule.category.name if rule.category else None
    d["assignee_name"] = rule.assignee.full_name if rule.assignee else None
    return d


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/inbound-email/rules", summary="List inbound email routing rules")
async def list_inbound_rules(
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(InboundEmailRule).order_by(InboundEmailRule.email_address)
    )
    rules = result.scalars().all()
    return [_rule_out(r) for r in rules]


@router.post("/inbound-email/rules", status_code=201, summary="Create inbound email rule")
async def create_inbound_rule(
    payload: InboundRuleCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    rule = InboundEmailRule(**payload.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return _rule_out(rule)


@router.put("/inbound-email/rules/{rule_id}", summary="Update inbound email rule")
async def update_inbound_rule(
    rule_id: uuid.UUID,
    payload: InboundRuleUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    rule = await db.get(InboundEmailRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(rule, field, value)

    await db.commit()
    await db.refresh(rule)
    return _rule_out(rule)


@router.delete("/inbound-email/rules/{rule_id}", status_code=204, summary="Delete inbound email rule")
async def delete_inbound_rule(
    rule_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    rule = await db.get(InboundEmailRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    await db.delete(rule)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)
