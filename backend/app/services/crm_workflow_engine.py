"""CRM Workflow execution engine — event-driven node graph traversal."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.crm_automations import CRMWorkflow as Workflow, CRMWorkflowExecution as WorkflowExecution, WorkflowNode

logger = logging.getLogger(__name__)


async def trigger_workflows_for_event(db: AsyncSession, event_name: str, event_data: dict) -> int:
    """Find and execute all active workflows matching the given event trigger."""
    stmt = select(Workflow).where(
        Workflow.status == "active",
        Workflow.trigger_type == "event",
    ).options(selectinload(Workflow.nodes))
    result = await db.execute(stmt)
    workflows = result.scalars().all()

    executed = 0
    for wf in workflows:
        trigger_config = wf.trigger_config or {}
        if trigger_config.get("event_name") != event_name:
            continue
        try:
            await execute_workflow(db, wf, event_data)
            executed += 1
        except Exception:
            logger.exception("Failed to execute workflow %s for event %s", wf.id, event_name)

    return executed


async def execute_workflow(db: AsyncSession, workflow: Workflow, trigger_data: dict) -> WorkflowExecution:
    """Execute a workflow by walking its node graph."""
    execution = WorkflowExecution(
        workflow_id=workflow.id,
        trigger_data=trigger_data,
        status="running",
        started_at=datetime.now(timezone.utc),
        steps_log=[],
    )
    db.add(execution)
    await db.flush()

    nodes_by_id = {str(n.id): n for n in (workflow.nodes or [])}

    # Find the trigger node
    trigger_node = None
    for n in (workflow.nodes or []):
        if n.node_type == "trigger":
            trigger_node = n
            break

    if not trigger_node:
        execution.status = "failed"
        execution.error_message = "No trigger node found"
        execution.completed_at = datetime.now(timezone.utc)
        await db.flush()
        return execution

    # Walk the graph
    current_node_id = str(trigger_node.next_node_id) if trigger_node.next_node_id else None
    steps_log = []
    max_steps = 100  # safety limit

    while current_node_id and max_steps > 0:
        max_steps -= 1
        node = nodes_by_id.get(current_node_id)
        if not node:
            break

        step_result = await _execute_node(db, node, trigger_data)
        steps_log.append({
            "node_id": current_node_id,
            "node_type": node.node_type,
            "result": step_result,
            "executed_at": datetime.now(timezone.utc).isoformat(),
        })

        # Determine next node
        if node.node_type == "condition":
            if step_result.get("condition_met"):
                current_node_id = str(node.true_branch_node_id) if node.true_branch_node_id else None
            else:
                current_node_id = str(node.false_branch_node_id) if node.false_branch_node_id else None
        else:
            current_node_id = str(node.next_node_id) if node.next_node_id else None

    execution.steps_log = steps_log
    execution.status = "completed"
    execution.completed_at = datetime.now(timezone.utc)

    # Update workflow stats
    workflow.execution_count = (workflow.execution_count or 0) + 1
    workflow.last_executed_at = datetime.now(timezone.utc)

    await db.flush()
    return execution


async def _execute_node(db: AsyncSession, node: WorkflowNode, trigger_data: dict) -> dict:
    """Execute a single workflow node."""
    config = node.config or {}
    node_type = node.node_type

    if node_type == "action":
        return await _execute_action(db, config, trigger_data)
    elif node_type == "condition":
        return _evaluate_condition(config, trigger_data)
    elif node_type == "delay":
        # Delay nodes are handled by the scheduler, not inline
        return {"delayed": True, "delay_hours": config.get("delay_hours", 0)}
    elif node_type == "branch":
        return {"branched": True}
    else:
        return {"skipped": True, "reason": f"Unknown node type: {node_type}"}


async def _execute_action(db: AsyncSession, config: dict, trigger_data: dict) -> dict:
    """Execute an action node (send_email, update_field, create_task, notify, webhook)."""
    action_type = config.get("action_type", "")

    if action_type == "send_email":
        try:
            from app.tasks.celery_app import send_email
            send_email.delay(
                to=config.get("to_email", trigger_data.get("email", "")),
                subject=config.get("subject", "Workflow notification"),
                body=config.get("body", ""),
            )
            return {"action": "send_email", "status": "queued"}
        except Exception as e:
            return {"action": "send_email", "status": "error", "error": str(e)}

    elif action_type == "update_field":
        entity_type = config.get("entity_type")
        entity_id = trigger_data.get(f"{entity_type}_id") or trigger_data.get("entity_id")
        field_name = config.get("field_name")
        field_value = config.get("field_value")
        if entity_type and entity_id and field_name:
            try:
                from app.models import crm as crm_models
                model_map = {
                    "contact": crm_models.Contact,
                    "lead": crm_models.Lead,
                    "opportunity": crm_models.Opportunity,
                    "deal": crm_models.Deal,
                }
                model = model_map.get(entity_type)
                if model:
                    obj = await db.get(model, entity_id)
                    if obj:
                        setattr(obj, field_name, field_value)
                        return {"action": "update_field", "status": "updated"}
            except Exception as e:
                return {"action": "update_field", "status": "error", "error": str(e)}
        return {"action": "update_field", "status": "skipped"}

    elif action_type == "create_task":
        try:
            from app.models.crm import SalesActivity
            activity = SalesActivity(
                activity_type="task",
                subject=config.get("subject", "Workflow task"),
                description=config.get("description", ""),
                contact_id=trigger_data.get("contact_id"),
                owner_id=trigger_data.get("owner_id", trigger_data.get("user_id", "")),
            )
            db.add(activity)
            return {"action": "create_task", "status": "created"}
        except Exception as e:
            return {"action": "create_task", "status": "error", "error": str(e)}

    elif action_type == "notify":
        try:
            from app.core.events import event_bus
            await event_bus.publish("workflow.notification", {
                "message": config.get("message", ""),
                "user_id": config.get("user_id", trigger_data.get("owner_id", "")),
            })
            return {"action": "notify", "status": "published"}
        except Exception as e:
            return {"action": "notify", "status": "error", "error": str(e)}

    return {"action": action_type, "status": "unknown_action"}


def _evaluate_condition(config: dict, trigger_data: dict) -> dict:
    """Evaluate a condition node."""
    field = config.get("field", "")
    operator = config.get("operator", "equals")
    value = config.get("value", "")

    actual = str(trigger_data.get(field, ""))

    if operator == "equals":
        met = actual.lower() == str(value).lower()
    elif operator == "not_equals":
        met = actual.lower() != str(value).lower()
    elif operator == "contains":
        met = str(value).lower() in actual.lower()
    elif operator == "greater_than":
        try:
            met = float(actual) > float(value)
        except (ValueError, TypeError):
            met = False
    elif operator == "less_than":
        try:
            met = float(actual) < float(value)
        except (ValueError, TypeError):
            met = False
    else:
        met = False

    return {"condition_met": met, "field": field, "operator": operator, "actual": actual, "expected": value}
