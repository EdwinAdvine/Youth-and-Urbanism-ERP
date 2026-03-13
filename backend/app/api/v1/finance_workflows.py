"""Finance Workflow Rule Engine — configurable automation rules.

Supports: expense.submitted, invoice.overdue, bill.received, bill.approved,
budget.exceeded, invoice.paid, and more. Each rule has conditions + actions.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.models.finance import WorkflowRule, FinanceWorkflowExecution as WorkflowExecution

router = APIRouter(tags=["Finance Workflow Rules"])


# ── Schemas ────────────────────────────────────────────────────────────────

class ConditionSchema(BaseModel):
    field: str                         # e.g. "amount", "category", "department_id"
    operator: str                      # eq, ne, gt, gte, lt, lte, contains, in
    value: Any                         # comparison value


class ActionSchema(BaseModel):
    type: str                          # notify, require_approval, auto_approve, create_task, send_email, post_je, escalate
    params: dict[str, Any] = {}


class WorkflowRuleCreate(BaseModel):
    name: str
    description: str | None = None
    trigger_event: str                 # expense.submitted, invoice.overdue, ...
    conditions: list[ConditionSchema] = []
    actions: list[ActionSchema]
    priority: int = 10
    is_active: bool = True


class WorkflowRuleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    trigger_event: str | None = None
    conditions: list[ConditionSchema] | None = None
    actions: list[ActionSchema] | None = None
    priority: int | None = None
    is_active: bool | None = None


# ── Condition evaluator ────────────────────────────────────────────────────

def _evaluate_condition(condition: dict, entity: dict) -> bool:
    """Evaluate a single condition against entity data."""
    field = condition.get("field", "")
    operator = condition.get("operator", "eq")
    expected = condition.get("value")
    actual = entity.get(field)

    if actual is None:
        return False

    try:
        if operator == "eq":
            return str(actual) == str(expected)
        elif operator == "ne":
            return str(actual) != str(expected)
        elif operator == "gt":
            return float(actual) > float(expected)
        elif operator == "gte":
            return float(actual) >= float(expected)
        elif operator == "lt":
            return float(actual) < float(expected)
        elif operator == "lte":
            return float(actual) <= float(expected)
        elif operator == "contains":
            return str(expected).lower() in str(actual).lower()
        elif operator == "in":
            return actual in (expected if isinstance(expected, list) else [expected])
        else:
            return False
    except (ValueError, TypeError):
        return False


def evaluate_rule_conditions(rule: WorkflowRule, entity_data: dict) -> bool:
    """Returns True if ALL conditions in the rule are satisfied (AND logic)."""
    conditions = rule.conditions or []
    if not conditions:
        return True  # no conditions = always trigger
    return all(_evaluate_condition(c, entity_data) for c in conditions)


# ── Action executor ────────────────────────────────────────────────────────

async def execute_rule_actions(
    rule: WorkflowRule,
    entity_data: dict,
    entity_type: str,
    entity_id: uuid.UUID | None,
    db: DBSession,
) -> list[dict]:
    """Execute all actions for a matched workflow rule. Returns list of actions taken."""
    from app.core.events import event_bus

    actions_taken = []
    for action in (rule.actions or []):
        action_type = action.get("type") if isinstance(action, dict) else action["type"]
        params = action.get("params", {}) if isinstance(action, dict) else action.get("params", {})

        try:
            if action_type == "notify":
                # Publish in-app notification event
                await event_bus.publish("notification.create", {
                    "user_id": params.get("user_id"),
                    "title": params.get("title", f"Workflow: {rule.name}"),
                    "message": params.get("message", f"Rule '{rule.name}' triggered"),
                    "source_type": entity_type,
                    "source_id": str(entity_id) if entity_id else None,
                })
                actions_taken.append({"type": "notify", "status": "sent"})

            elif action_type == "send_email":
                await event_bus.publish("email.send", {
                    "to": params.get("to") or entity_data.get("email"),
                    "subject": params.get("subject", f"Action required: {rule.name}"),
                    "body": params.get("body", ""),
                    "template": params.get("template"),
                })
                actions_taken.append({"type": "send_email", "status": "queued"})

            elif action_type == "create_task":
                await event_bus.publish("task.create", {
                    "title": params.get("title", f"Follow up: {rule.name}"),
                    "description": params.get("description", ""),
                    "assignee_id": params.get("assignee_id"),
                    "due_date": params.get("due_date"),
                    "linked_entity_type": entity_type,
                    "linked_entity_id": str(entity_id) if entity_id else None,
                })
                actions_taken.append({"type": "create_task", "status": "created"})

            elif action_type == "require_approval":
                # Publish approval request event consumed by the module
                await event_bus.publish(f"{entity_type}.approval_required", {
                    "entity_id": str(entity_id) if entity_id else None,
                    "approver_id": params.get("approver_id"),
                    "timeout_hours": params.get("timeout_hours", 24),
                    "escalate_to": params.get("escalate_to"),
                    "rule_name": rule.name,
                })
                actions_taken.append({"type": "require_approval", "status": "pending"})

            elif action_type == "auto_approve":
                await event_bus.publish(f"{entity_type}.auto_approved", {
                    "entity_id": str(entity_id) if entity_id else None,
                    "rule_name": rule.name,
                })
                actions_taken.append({"type": "auto_approve", "status": "approved"})

            elif action_type == "escalate":
                await event_bus.publish(f"{entity_type}.escalated", {
                    "entity_id": str(entity_id) if entity_id else None,
                    "escalate_to": params.get("escalate_to"),
                    "reason": params.get("reason", f"Workflow escalation: {rule.name}"),
                })
                actions_taken.append({"type": "escalate", "status": "escalated"})

            else:
                actions_taken.append({"type": action_type, "status": "unknown_action"})

        except Exception as e:
            actions_taken.append({"type": action_type, "status": "error", "error": str(e)})

    return actions_taken


# ── Main trigger function ──────────────────────────────────────────────────

async def trigger_workflows(
    event: str,
    entity_type: str,
    entity_id: uuid.UUID | None,
    entity_data: dict,
    db: DBSession,
) -> list[dict]:
    """Find and execute all matching workflow rules for an event."""
    result = await db.execute(
        select(WorkflowRule)
        .where(WorkflowRule.trigger_event == event, WorkflowRule.is_active == True)
        .order_by(WorkflowRule.priority.asc())
    )
    rules = result.scalars().all()

    execution_results = []
    for rule in rules:
        if not evaluate_rule_conditions(rule, entity_data):
            continue

        actions_taken = await execute_rule_actions(rule, entity_data, entity_type, entity_id, db)

        # Log execution
        execution = WorkflowExecution(
            rule_id=rule.id,
            trigger_event=event,
            entity_type=entity_type,
            entity_id=entity_id,
            status="success",
            actions_taken=actions_taken,
            executed_at=datetime.now(timezone.utc),
        )
        db.add(execution)

        # Update rule stats
        rule.last_triggered_at = datetime.now(timezone.utc)
        rule.trigger_count = (rule.trigger_count or 0) + 1

        execution_results.append({
            "rule_id": str(rule.id),
            "rule_name": rule.name,
            "actions_taken": actions_taken,
        })

    await db.flush()
    return execution_results


# ── CRUD API ───────────────────────────────────────────────────────────────

BUILT_IN_TEMPLATES = [
    {
        "name": "High-value expense approval",
        "trigger_event": "expense.submitted",
        "conditions": [{"field": "amount", "operator": "gt", "value": 1000}],
        "actions": [
            {"type": "require_approval", "params": {"timeout_hours": 24}},
            {"type": "notify", "params": {"title": "Expense approval required", "message": "An expense over $1,000 requires your approval."}},
        ],
        "description": "Requires Finance Admin approval for expenses over $1,000",
        "priority": 5,
    },
    {
        "name": "Overdue invoice reminder",
        "trigger_event": "invoice.overdue",
        "conditions": [],
        "actions": [
            {"type": "send_email", "params": {"subject": "Invoice Overdue — Payment Required"}},
            {"type": "create_task", "params": {"title": "Follow up on overdue invoice"}},
        ],
        "description": "Sends reminder email and creates follow-up task for overdue invoices",
        "priority": 10,
    },
    {
        "name": "Large vendor bill CFO approval",
        "trigger_event": "bill.received",
        "conditions": [{"field": "total", "operator": "gt", "value": 10000}],
        "actions": [
            {"type": "require_approval", "params": {"timeout_hours": 48}},
            {"type": "notify", "params": {"title": "Large vendor bill requires CFO approval"}},
        ],
        "description": "Routes vendor bills over $10,000 to CFO for approval",
        "priority": 3,
    },
    {
        "name": "Budget utilization alert",
        "trigger_event": "budget.exceeded",
        "conditions": [],
        "actions": [
            {"type": "notify", "params": {"title": "Budget threshold exceeded", "message": "A budget has exceeded 90% utilization."}},
            {"type": "send_email", "params": {"subject": "Budget Alert: Threshold Exceeded"}},
        ],
        "description": "Alerts when a budget exceeds 90% utilization",
        "priority": 8,
    },
]


@router.get("/workflow-rules/templates")
async def list_workflow_templates(current_user: CurrentUser):
    """Return built-in workflow rule templates."""
    return {"templates": BUILT_IN_TEMPLATES}


@router.get("/workflow-rules")
async def list_workflow_rules(
    db: DBSession,
    current_user: CurrentUser,
    trigger_event: str | None = Query(None),
    is_active: bool | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    q = select(WorkflowRule).order_by(WorkflowRule.priority.asc())
    if trigger_event:
        q = q.where(WorkflowRule.trigger_event == trigger_event)
    if is_active is not None:
        q = q.where(WorkflowRule.is_active == is_active)
    q = q.offset((page - 1) * limit).limit(limit)
    result = await db.execute(q)
    rules = result.scalars().all()

    total_result = await db.execute(select(func.count()).select_from(WorkflowRule))
    total = total_result.scalar_one()

    return {
        "total": total,
        "items": [
            {
                "id": str(r.id),
                "name": r.name,
                "description": r.description,
                "trigger_event": r.trigger_event,
                "conditions": r.conditions,
                "actions": r.actions,
                "priority": r.priority,
                "is_active": r.is_active,
                "trigger_count": r.trigger_count,
                "last_triggered_at": r.last_triggered_at.isoformat() if r.last_triggered_at else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rules
        ],
    }


@router.post("/workflow-rules", status_code=status.HTTP_201_CREATED)
async def create_workflow_rule(
    payload: WorkflowRuleCreate,
    db: DBSession,
    current_user: CurrentUser,
):
    rule = WorkflowRule(
        name=payload.name,
        description=payload.description,
        trigger_event=payload.trigger_event,
        conditions=[c.model_dump() for c in payload.conditions],
        actions=[a.model_dump() for a in payload.actions],
        priority=payload.priority,
        is_active=payload.is_active,
        owner_id=current_user.id,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return {"id": str(rule.id), "name": rule.name, "trigger_event": rule.trigger_event}


@router.get("/workflow-rules/{rule_id}")
async def get_workflow_rule(rule_id: uuid.UUID, db: DBSession, current_user: CurrentUser):
    result = await db.execute(select(WorkflowRule).where(WorkflowRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Workflow rule not found")
    return {
        "id": str(rule.id),
        "name": rule.name,
        "description": rule.description,
        "trigger_event": rule.trigger_event,
        "conditions": rule.conditions,
        "actions": rule.actions,
        "priority": rule.priority,
        "is_active": rule.is_active,
        "trigger_count": rule.trigger_count,
        "last_triggered_at": rule.last_triggered_at.isoformat() if rule.last_triggered_at else None,
    }


@router.put("/workflow-rules/{rule_id}")
async def update_workflow_rule(
    rule_id: uuid.UUID,
    payload: WorkflowRuleUpdate,
    db: DBSession,
    current_user: CurrentUser,
):
    result = await db.execute(select(WorkflowRule).where(WorkflowRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Workflow rule not found")

    data = payload.model_dump(exclude_none=True)
    if "conditions" in data:
        data["conditions"] = [c.model_dump() if hasattr(c, "model_dump") else c for c in (payload.conditions or [])]
    if "actions" in data:
        data["actions"] = [a.model_dump() if hasattr(a, "model_dump") else a for a in (payload.actions or [])]

    for field, value in data.items():
        setattr(rule, field, value)

    await db.commit()
    return {"id": str(rule.id), "is_active": rule.is_active}


@router.delete("/workflow-rules/{rule_id}", status_code=status.HTTP_200_OK)
async def delete_workflow_rule(rule_id: uuid.UUID, db: DBSession, current_user: CurrentUser):
    result = await db.execute(select(WorkflowRule).where(WorkflowRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Workflow rule not found")
    await db.delete(rule)
    await db.commit()


@router.get("/workflow-rules/{rule_id}/executions")
async def list_rule_executions(
    rule_id: uuid.UUID,
    db: DBSession,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    q = (
        select(WorkflowExecution)
        .where(WorkflowExecution.rule_id == rule_id)
        .order_by(WorkflowExecution.executed_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(q)
    executions = result.scalars().all()
    return {
        "items": [
            {
                "id": str(e.id),
                "trigger_event": e.trigger_event,
                "entity_type": e.entity_type,
                "entity_id": str(e.entity_id) if e.entity_id else None,
                "status": e.status,
                "actions_taken": e.actions_taken,
                "error_message": e.error_message,
                "executed_at": e.executed_at.isoformat() if e.executed_at else None,
            }
            for e in executions
        ]
    }


@router.post("/workflow-rules/{rule_id}/test")
async def test_workflow_rule(
    rule_id: uuid.UUID,
    entity_data: dict,
    db: DBSession,
    current_user: CurrentUser,
):
    """Dry-run a workflow rule against sample entity data without executing actions."""
    result = await db.execute(select(WorkflowRule).where(WorkflowRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Workflow rule not found")

    conditions_met = evaluate_rule_conditions(rule, entity_data)
    return {
        "rule_id": str(rule.id),
        "rule_name": rule.name,
        "conditions_met": conditions_met,
        "would_trigger": conditions_met and rule.is_active,
        "conditions_detail": [
            {
                "condition": c,
                "result": _evaluate_condition(c, entity_data),
            }
            for c in (rule.conditions or [])
        ],
        "actions_that_would_run": rule.actions if conditions_met else [],
    }
