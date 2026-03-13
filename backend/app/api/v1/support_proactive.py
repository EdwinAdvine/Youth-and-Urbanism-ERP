"""Support Proactive Rules API — Phase 3.

Manages rules that trigger outreach (create_ticket / send_email / notify_agent)
before customers report issues.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, select

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.support_phase3 import ProactiveRule

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class RuleCreate(BaseModel):
    name: str
    description: str | None = None
    trigger_type: str = "event"  # event | schedule | threshold
    trigger_conditions: dict = {}
    actions: list[dict] = []


class RuleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    trigger_type: str | None = None
    trigger_conditions: dict | None = None
    actions: list[dict] | None = None
    is_active: bool | None = None


class RuleOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    trigger_type: str
    trigger_conditions: dict | None
    actions: list | None
    is_active: bool
    execution_count: int
    last_triggered_at: Any | None
    created_by: uuid.UUID
    creator_name: str | None = None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class TestRuleRequest(BaseModel):
    test_context: dict = {}


class EvaluateRequest(BaseModel):
    event_name: str
    event_data: dict = {}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _rule_out(rule: ProactiveRule) -> dict:
    creator_name: str | None = None
    if rule.creator:
        creator_name = getattr(rule.creator, "full_name", None) or getattr(rule.creator, "email", None)
    return {
        **RuleOut.model_validate(rule).model_dump(),
        "creator_name": creator_name,
    }


def _check_conditions(rule: ProactiveRule, event_name: str, event_data: dict) -> tuple[bool, dict]:
    """Evaluate trigger_conditions for event / threshold triggers.

    Returns (would_trigger, matched_conditions).
    Schedule triggers are handled by Celery beat and always return False here.
    """
    conditions: dict = rule.trigger_conditions or {}
    matched: dict = {}

    if rule.trigger_type == "schedule":
        return False, {}

    if rule.trigger_type == "event":
        expected_event = conditions.get("event")
        if expected_event and event_name == expected_event:
            matched["event"] = expected_event
            return True, matched
        return False, {}

    if rule.trigger_type == "threshold":
        metric: str | None = conditions.get("metric")
        threshold = conditions.get("threshold")
        if metric is None or threshold is None:
            return False, {}
        value = event_data.get(metric)
        if value is not None and float(value) >= float(threshold):
            matched[metric] = value
            matched["threshold"] = threshold
            return True, matched
        return False, {}

    return False, {}


async def _execute_actions(rule: ProactiveRule, event_data: dict, db: Any) -> None:
    """Fire each action in rule.actions list."""
    actions: list[dict] = rule.actions or []
    for action in actions:
        action_type = action.get("type")

        if action_type == "create_ticket":
            await event_bus.publish("proactive.create_ticket", {
                "rule_id": str(rule.id),
                "rule_name": rule.name,
                "template": action.get("template"),
                "context": event_data,
            })

        elif action_type == "send_email":
            await event_bus.publish("proactive.send_email", {
                "rule_id": str(rule.id),
                "rule_name": rule.name,
                "template": action.get("template"),
                "context": event_data,
            })

        elif action_type == "notify_agent":
            await event_bus.publish("proactive.notify_agent", {
                "rule_id": str(rule.id),
                "rule_name": rule.name,
                "message": action.get("message"),
                "context": event_data,
            })


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/proactive/rules", summary="List proactive support rules")
async def list_rules(
    current_user: CurrentUser,
    db: DBSession,
    trigger_type: str | None = Query(None, description="Filter by trigger_type (event|schedule|threshold)"),
    is_active: bool | None = Query(None, description="Filter by active state"),
) -> list[dict]:
    filters = []
    if trigger_type is not None:
        filters.append(ProactiveRule.trigger_type == trigger_type)
    if is_active is not None:
        filters.append(ProactiveRule.is_active == is_active)

    q = select(ProactiveRule).order_by(ProactiveRule.created_at.desc())
    if filters:
        q = q.where(and_(*filters))

    result = await db.execute(q)
    rules = result.scalars().all()
    return [_rule_out(r) for r in rules]


@router.post("/proactive/rules", summary="Create a proactive support rule", status_code=status.HTTP_201_CREATED)
async def create_rule(
    payload: RuleCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict:
    rule = ProactiveRule(
        name=payload.name,
        description=payload.description,
        trigger_type=payload.trigger_type,
        trigger_conditions=payload.trigger_conditions,
        actions=payload.actions,
        created_by=current_user.id,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return _rule_out(rule)


@router.get("/proactive/rules/{rule_id}", summary="Get proactive rule detail")
async def get_rule(
    rule_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict:
    rule = await db.get(ProactiveRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Proactive rule not found")
    return _rule_out(rule)


@router.put("/proactive/rules/{rule_id}", summary="Update a proactive rule")
async def update_rule(
    rule_id: uuid.UUID,
    payload: RuleUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict:
    rule = await db.get(ProactiveRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Proactive rule not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)

    await db.commit()
    await db.refresh(rule)
    return _rule_out(rule)


@router.delete(
    "/proactive/rules/{rule_id}",
    summary="Delete a proactive rule",
    status_code=status.HTTP_200_OK,
)
async def delete_rule(
    rule_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> None:
    rule = await db.get(ProactiveRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Proactive rule not found")
    await db.delete(rule)
    await db.commit()


@router.post("/proactive/rules/{rule_id}/toggle", summary="Toggle rule active state")
async def toggle_rule(
    rule_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict:
    rule = await db.get(ProactiveRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Proactive rule not found")

    rule.is_active = not rule.is_active
    await db.commit()
    await db.refresh(rule)
    return _rule_out(rule)


@router.post("/proactive/rules/{rule_id}/test", summary="Dry-run test a rule against a context")
async def test_rule(
    rule_id: uuid.UUID,
    payload: TestRuleRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict:
    rule = await db.get(ProactiveRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Proactive rule not found")

    # For test: treat test_context as both event_name source and event_data
    event_name: str = payload.test_context.get("event_name", "")
    event_data: dict = payload.test_context.get("event_data", payload.test_context)

    would_trigger, matched_conditions = _check_conditions(rule, event_name, event_data)

    return {
        "rule_id": str(rule.id),
        "rule_name": rule.name,
        "trigger_type": rule.trigger_type,
        "would_trigger": would_trigger,
        "matched_conditions": matched_conditions,
    }


@router.post("/proactive/rules/evaluate", summary="Evaluate all active rules against an incoming event")
async def evaluate_rules(
    payload: EvaluateRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict:
    """Evaluate all active rules against an event. Execute actions for matching rules."""
    q = select(ProactiveRule).where(ProactiveRule.is_active == True)  # noqa: E712
    result = await db.execute(q)
    active_rules = result.scalars().all()

    executed: list[str] = []
    now = datetime.now(tz=timezone.utc)

    for rule in active_rules:
        would_trigger, _ = _check_conditions(rule, payload.event_name, payload.event_data)
        if would_trigger:
            await _execute_actions(rule, payload.event_data, db)
            rule.execution_count = (rule.execution_count or 0) + 1
            rule.last_triggered_at = now
            executed.append(rule.name)

    if executed:
        await db.commit()

    return {
        "event_name": payload.event_name,
        "evaluated_rules": len(active_rules),
        "triggered_count": len(executed),
        "executed_rules": executed,
    }
