"""HR Workflow Engine — executes workflow step definitions."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events import event_bus

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def execute_workflow(
    workflow_id: str,
    trigger_data: dict[str, Any],
    db: AsyncSession,
) -> str:
    """Create a WorkflowExecution and run all steps sequentially.

    If a step requires human approval the execution is paused: status is set
    to "paused", a WorkflowApproval record is created, and the event
    ``hr.workflow_approval_required`` is published.

    Args:
        workflow_id: UUID string of the Workflow to execute.
        trigger_data: Contextual data that triggered the workflow
            (e.g. ``{"employee_id": "...", "event": "employee_created"}``).
        db: Async SQLAlchemy session.

    Returns:
        execution_id (str) — UUID of the created WorkflowExecution.
    """
    from app.models.hr_phase3 import HRWorkflow as Workflow, WorkflowApproval, HRWorkflowExecution as WorkflowExecution  # noqa: PLC0415

    # Load the workflow definition
    result = await db.execute(
        select(Workflow).where(Workflow.id == uuid.UUID(workflow_id))
    )
    workflow: Workflow | None = result.scalar_one_or_none()
    if workflow is None:
        raise ValueError(f"Workflow {workflow_id} not found")

    if not workflow.is_active:
        raise ValueError(f"Workflow {workflow_id} is inactive")

    steps: list[dict[str, Any]] = workflow.steps or []
    execution_id = str(uuid.uuid4())

    # Create execution record
    execution = WorkflowExecution(
        id=uuid.UUID(execution_id),
        workflow_id=uuid.UUID(workflow_id),
        trigger_data=trigger_data,
        status="running",
        current_step_id=steps[0]["id"] if steps else None,
        steps_completed=[],
        started_at=datetime.now(timezone.utc),
    )
    db.add(execution)
    await db.flush()

    # Build execution context — steps can read/write shared state here
    context: dict[str, Any] = {
        "workflow_id": workflow_id,
        "execution_id": execution_id,
        "trigger_data": trigger_data,
        "results": {},
    }

    completed_steps: list[dict[str, Any]] = []

    for step in steps:
        step_id = step.get("id", str(uuid.uuid4()))
        execution.current_step_id = step_id
        await db.flush()

        try:
            step_result = await execute_step(step, context, db)
        except Exception as exc:
            logger.error(
                "Workflow %s step %s raised an error: %s",
                workflow_id,
                step_id,
                exc,
            )
            execution.status = "failed"
            execution.error_message = str(exc)
            execution.completed_at = datetime.now(timezone.utc)
            await db.flush()
            raise

        if step_result.get("requires_approval"):
            # Pause execution and create approval gate
            execution.status = "paused"
            execution.steps_completed = completed_steps
            await db.flush()

            approval = WorkflowApproval(
                id=uuid.uuid4(),
                execution_id=uuid.UUID(execution_id),
                step_id=step_id,
                status="pending",
                requested_at=datetime.now(timezone.utc),
            )
            db.add(approval)
            await db.flush()

            await event_bus.publish(
                "hr.workflow_approval_required",
                {
                    "execution_id": execution_id,
                    "workflow_id": workflow_id,
                    "workflow_name": workflow.name,
                    "step_id": step_id,
                    "approval_id": str(approval.id),
                    "trigger_data": trigger_data,
                },
            )
            logger.info(
                "Workflow %s paused at step %s awaiting approval",
                workflow_id,
                step_id,
            )
            return execution_id

        # Record completed step
        completed_steps.append(
            {
                "step_id": step_id,
                "type": step.get("type"),
                "status": step_result.get("status", "completed"),
                "result": step_result.get("result"),
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        # Store result in shared context so subsequent steps can reference it
        context["results"][step_id] = step_result.get("result")

        # Handle condition branching — skip to the matched next step
        if step.get("type") == "condition" and step_result.get("result", {}).get("next_step_id"):
            target_id = step_result["result"]["next_step_id"]
            # Find and jump to the target step (remaining steps in original order)
            remaining = [s for s in steps if s.get("id") == target_id]
            if remaining:
                logger.debug(
                    "Workflow %s condition branch → step %s",
                    workflow_id,
                    target_id,
                )
            # In the current linear model we continue; branching is recorded in result

    # All steps complete
    execution.status = "completed"
    execution.steps_completed = completed_steps
    execution.completed_at = datetime.now(timezone.utc)

    # Increment workflow run counter
    workflow.run_count = (workflow.run_count or 0) + 1
    workflow.last_run_at = datetime.now(timezone.utc)

    await db.flush()
    logger.info("Workflow %s execution %s completed successfully", workflow_id, execution_id)
    return execution_id


async def execute_step(
    step: dict[str, Any],
    context: dict[str, Any],
    db: AsyncSession,
) -> dict[str, Any]:
    """Dispatch a single workflow step to the appropriate handler.

    Args:
        step: Step definition dict with keys ``id``, ``type``, ``config``,
            and optional ``next_step_id``.
        context: Shared execution context (workflow_id, execution_id,
            trigger_data, results).
        db: Async SQLAlchemy session.

    Returns:
        ``{"status": "completed", "result": {...}}`` or
        ``{"status": "requires_approval"}``.
    """
    step_type: str = step.get("type", "")
    config: dict[str, Any] = step.get("config") or {}

    handlers = {
        "send_notification": _handle_send_notification,
        "update_field": _handle_update_field,
        "create_task": _handle_create_task,
        "send_email": _handle_send_email,
        "require_approval": _handle_require_approval,
        "delay": _handle_delay,
        "condition": _handle_condition,
    }

    handler = handlers.get(step_type)
    if handler is None:
        logger.warning("Unknown step type '%s' in workflow %s", step_type, context.get("workflow_id"))
        return {"status": "completed", "result": {"skipped": True, "reason": f"Unknown step type: {step_type}"}}

    return await handler(step, config, context, db)


async def resume_workflow(
    execution_id: str,
    approved: bool,
    note: str,
    db: AsyncSession,
) -> None:
    """Resume a paused workflow execution after an approval decision.

    Loads the WorkflowExecution, updates the associated WorkflowApproval, then
    either continues from the next step (if approved) or marks the execution
    as cancelled (if rejected).

    Args:
        execution_id: UUID string of the paused WorkflowExecution.
        approved: True to approve and continue; False to reject and cancel.
        note: Free-text decision note from the approver.
        db: Async SQLAlchemy session.
    """
    from app.models.hr_phase3 import HRWorkflow as Workflow, WorkflowApproval, HRWorkflowExecution as WorkflowExecution  # noqa: PLC0415

    # Load the execution
    exec_result = await db.execute(
        select(WorkflowExecution).where(WorkflowExecution.id == uuid.UUID(execution_id))
    )
    execution: WorkflowExecution | None = exec_result.scalar_one_or_none()
    if execution is None:
        raise ValueError(f"WorkflowExecution {execution_id} not found")

    if execution.status != "paused":
        raise ValueError(
            f"WorkflowExecution {execution_id} is not paused (status={execution.status})"
        )

    # Update the pending approval record
    approval_result = await db.execute(
        select(WorkflowApproval)
        .where(
            WorkflowApproval.execution_id == uuid.UUID(execution_id),
            WorkflowApproval.status == "pending",
        )
        .order_by(WorkflowApproval.requested_at.desc())
        .limit(1)
    )
    approval: WorkflowApproval | None = approval_result.scalar_one_or_none()
    if approval is not None:
        approval.status = "approved" if approved else "rejected"
        approval.decision_note = note
        approval.decided_at = datetime.now(timezone.utc)
        await db.flush()

    if not approved:
        execution.status = "cancelled"
        execution.completed_at = datetime.now(timezone.utc)
        execution.error_message = f"Rejected at step {execution.current_step_id}: {note}"
        await db.flush()
        logger.info("Workflow execution %s cancelled (rejected by approver)", execution_id)
        return

    # Load workflow steps and continue from the step after the approval gate
    wf_result = await db.execute(
        select(Workflow).where(Workflow.id == execution.workflow_id)
    )
    workflow: Workflow | None = wf_result.scalar_one_or_none()
    if workflow is None:
        execution.status = "failed"
        execution.error_message = "Parent workflow not found during resume"
        await db.flush()
        return

    steps: list[dict[str, Any]] = workflow.steps or []
    current_step_id = execution.current_step_id

    # Find the index of the paused step and continue with subsequent steps
    paused_index = next(
        (i for i, s in enumerate(steps) if s.get("id") == current_step_id),
        None,
    )
    if paused_index is None:
        execution.status = "failed"
        execution.error_message = f"Could not locate paused step {current_step_id} in workflow steps"
        await db.flush()
        return

    remaining_steps = steps[paused_index + 1:]

    context: dict[str, Any] = {
        "workflow_id": str(execution.workflow_id),
        "execution_id": execution_id,
        "trigger_data": execution.trigger_data or {},
        "results": {},
    }

    completed_steps: list[dict[str, Any]] = list(execution.steps_completed or [])
    execution.status = "running"
    await db.flush()

    for step in remaining_steps:
        step_id = step.get("id", str(uuid.uuid4()))
        execution.current_step_id = step_id
        await db.flush()

        try:
            step_result = await execute_step(step, context, db)
        except Exception as exc:
            logger.error("Resume of execution %s failed at step %s: %s", execution_id, step_id, exc)
            execution.status = "failed"
            execution.error_message = str(exc)
            execution.completed_at = datetime.now(timezone.utc)
            await db.flush()
            raise

        if step_result.get("requires_approval"):
            execution.status = "paused"
            execution.steps_completed = completed_steps
            await db.flush()

            new_approval = WorkflowApproval(
                id=uuid.uuid4(),
                execution_id=uuid.UUID(execution_id),
                step_id=step_id,
                status="pending",
                requested_at=datetime.now(timezone.utc),
            )
            db.add(new_approval)
            await db.flush()

            await event_bus.publish(
                "hr.workflow_approval_required",
                {
                    "execution_id": execution_id,
                    "workflow_id": str(execution.workflow_id),
                    "step_id": step_id,
                    "approval_id": str(new_approval.id),
                    "trigger_data": execution.trigger_data or {},
                },
            )
            return

        completed_steps.append(
            {
                "step_id": step_id,
                "type": step.get("type"),
                "status": step_result.get("status", "completed"),
                "result": step_result.get("result"),
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        context["results"][step_id] = step_result.get("result")

    execution.status = "completed"
    execution.steps_completed = completed_steps
    execution.completed_at = datetime.now(timezone.utc)

    workflow.run_count = (workflow.run_count or 0) + 1
    workflow.last_run_at = datetime.now(timezone.utc)

    await db.flush()
    logger.info("Workflow execution %s resumed and completed", execution_id)


async def evaluate_condition(condition: dict[str, Any], context: dict[str, Any]) -> bool:
    """Evaluate a simple condition expression against the execution context.

    Condition format::

        {"field": "status", "operator": "eq", "value": "active"}

    The ``field`` is looked up first in ``context["trigger_data"]``, then in
    the flat context dict itself.

    Supported operators:
        eq, neq, gt, lt, gte, lte, contains

    Args:
        condition: Condition dict with ``field``, ``operator``, ``value``.
        context: Execution context (trigger_data, results, etc.).

    Returns:
        bool — True if the condition is satisfied.
    """
    field: str = condition.get("field", "")
    operator: str = condition.get("operator", "eq")
    expected = condition.get("value")

    # Resolve field value: check trigger_data first, then flat context
    trigger_data: dict[str, Any] = context.get("trigger_data") or {}
    if field in trigger_data:
        actual = trigger_data[field]
    elif field in context:
        actual = context[field]
    else:
        logger.warning("Condition field '%s' not found in context", field)
        return False

    try:
        if operator == "eq":
            return actual == expected
        if operator == "neq":
            return actual != expected
        if operator == "gt":
            return float(actual) > float(expected)
        if operator == "lt":
            return float(actual) < float(expected)
        if operator == "gte":
            return float(actual) >= float(expected)
        if operator == "lte":
            return float(actual) <= float(expected)
        if operator == "contains":
            return str(expected).lower() in str(actual).lower()
    except (TypeError, ValueError) as exc:
        logger.warning("Condition evaluation error (field=%s, op=%s): %s", field, operator, exc)
        return False

    logger.warning("Unknown condition operator '%s'", operator)
    return False


# ---------------------------------------------------------------------------
# Step handlers (private)
# ---------------------------------------------------------------------------


async def _handle_send_notification(
    step: dict[str, Any],
    config: dict[str, Any],
    context: dict[str, Any],
    db: AsyncSession,
) -> dict[str, Any]:
    """Publish a notify.send event."""
    payload = {
        "title": config.get("title", "HR Workflow Notification"),
        "message": config.get("message", ""),
        "recipient_id": config.get("recipient_id") or context.get("trigger_data", {}).get("employee_id"),
        "type": config.get("type", "info"),
        "execution_id": context.get("execution_id"),
        "workflow_id": context.get("workflow_id"),
    }
    await event_bus.publish("notify.send", payload)
    logger.debug("Workflow step send_notification published notify.send")
    return {"status": "completed", "result": {"published": True, "channel": "notify.send"}}


async def _handle_update_field(
    step: dict[str, Any],
    config: dict[str, Any],
    context: dict[str, Any],
    db: AsyncSession,
) -> dict[str, Any]:
    """Update a field on a DB record via dynamic model lookup.

    Config keys:
        model (str): SQLAlchemy model class name.
        record_id (str): UUID of the record to update (can reference
            trigger_data via ``"$trigger.employee_id"`` style).
        field (str): Column name to update.
        value: New value (can reference trigger_data via ``"$trigger.<key>"``).
    """
    model_name: str = config.get("model", "")
    record_id: Any = _resolve_value(config.get("record_id", ""), context)
    field_name: str = config.get("field", "")
    new_value: Any = _resolve_value(config.get("value"), context)

    if not all([model_name, record_id, field_name]):
        logger.warning("update_field step missing required config keys")
        return {"status": "completed", "result": {"updated": False, "reason": "missing config"}}

    # Dynamically import the model from the models package
    try:
        import importlib

        # Try common model module paths
        model_cls = None
        for module_path in (
            f"app.models.hr_phase3",
            f"app.models.hr",
            f"app.models.{model_name.lower()}",
        ):
            try:
                mod = importlib.import_module(module_path)
                if hasattr(mod, model_name):
                    model_cls = getattr(mod, model_name)
                    break
            except ModuleNotFoundError:
                continue

        if model_cls is None:
            logger.error("update_field: model '%s' not found", model_name)
            return {"status": "completed", "result": {"updated": False, "reason": f"model {model_name} not found"}}

        result = await db.execute(
            select(model_cls).where(model_cls.id == uuid.UUID(str(record_id)))
        )
        record = result.scalar_one_or_none()
        if record is None:
            logger.warning("update_field: record %s not found in %s", record_id, model_name)
            return {"status": "completed", "result": {"updated": False, "reason": "record not found"}}

        setattr(record, field_name, new_value)
        await db.flush()
        logger.debug("update_field: set %s.%s = %s on %s", model_name, field_name, new_value, record_id)
        return {"status": "completed", "result": {"updated": True, "model": model_name, "record_id": str(record_id), "field": field_name}}

    except Exception as exc:
        logger.error("update_field step error: %s", exc)
        return {"status": "completed", "result": {"updated": False, "reason": str(exc)}}


async def _handle_create_task(
    step: dict[str, Any],
    config: dict[str, Any],
    context: dict[str, Any],
    db: AsyncSession,
) -> dict[str, Any]:
    """Publish an hr.workflow_task_created event."""
    payload = {
        "title": config.get("title", "Workflow Task"),
        "description": config.get("description", ""),
        "assignee_id": _resolve_value(config.get("assignee_id"), context),
        "due_days": config.get("due_days", 7),
        "priority": config.get("priority", "medium"),
        "execution_id": context.get("execution_id"),
        "workflow_id": context.get("workflow_id"),
        "trigger_data": context.get("trigger_data"),
    }
    await event_bus.publish("hr.workflow_task_created", payload)
    logger.debug("Workflow step create_task published hr.workflow_task_created")
    return {"status": "completed", "result": {"published": True, "task_title": payload["title"]}}


async def _handle_send_email(
    step: dict[str, Any],
    config: dict[str, Any],
    context: dict[str, Any],
    db: AsyncSession,
) -> dict[str, Any]:
    """Publish a mail.send event."""
    payload = {
        "to": _resolve_value(config.get("to"), context),
        "subject": config.get("subject", "HR Notification"),
        "body": config.get("body", ""),
        "template": config.get("template"),
        "execution_id": context.get("execution_id"),
        "workflow_id": context.get("workflow_id"),
    }
    await event_bus.publish("mail.send", payload)
    logger.debug("Workflow step send_email published mail.send to %s", payload["to"])
    return {"status": "completed", "result": {"published": True, "to": payload["to"]}}


async def _handle_require_approval(
    step: dict[str, Any],
    config: dict[str, Any],
    context: dict[str, Any],
    db: AsyncSession,
) -> dict[str, Any]:
    """Signal that this step requires human approval before continuing."""
    return {"status": "requires_approval"}


async def _handle_delay(
    step: dict[str, Any],
    config: dict[str, Any],
    context: dict[str, Any],
    db: AsyncSession,
) -> dict[str, Any]:
    """Record a delay step — actual scheduling is handled by Celery beat.

    We deliberately do not sleep here; instead we record the scheduled_at
    timestamp so a separate Celery beat task can check and resume when due.
    """
    delay_minutes: int = int(config.get("delay_minutes", 0))
    delay_hours: int = int(config.get("delay_hours", 0))
    delay_days: int = int(config.get("delay_days", 0))

    total_minutes = delay_minutes + delay_hours * 60 + delay_days * 1440
    from datetime import timedelta

    scheduled_at = datetime.now(timezone.utc) + timedelta(minutes=total_minutes)

    logger.debug(
        "Workflow delay step recorded: %d minutes → scheduled_at %s",
        total_minutes,
        scheduled_at.isoformat(),
    )
    return {
        "status": "completed",
        "result": {
            "delay_minutes": total_minutes,
            "scheduled_at": scheduled_at.isoformat(),
        },
    }


async def _handle_condition(
    step: dict[str, Any],
    config: dict[str, Any],
    context: dict[str, Any],
    db: AsyncSession,
) -> dict[str, Any]:
    """Evaluate a condition and return the next_step_id to branch to.

    Config keys:
        condition (dict): ``{field, operator, value}`` expression.
        if_true_step_id (str): Step ID to jump to when condition is True.
        if_false_step_id (str): Step ID to jump to when condition is False.
    """
    condition: dict[str, Any] = config.get("condition") or {}
    if_true_step_id: str | None = config.get("if_true_step_id")
    if_false_step_id: str | None = config.get("if_false_step_id")

    result = await evaluate_condition(condition, context)
    next_step_id = if_true_step_id if result else if_false_step_id

    logger.debug(
        "Condition evaluated to %s → next_step_id=%s",
        result,
        next_step_id,
    )
    return {
        "status": "completed",
        "result": {
            "condition_result": result,
            "next_step_id": next_step_id,
        },
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _resolve_value(value: Any, context: dict[str, Any]) -> Any:
    """Resolve a config value that may reference context via ``$trigger.<key>``."""
    if not isinstance(value, str):
        return value
    if value.startswith("$trigger."):
        key = value[len("$trigger."):]
        return (context.get("trigger_data") or {}).get(key, value)
    if value.startswith("$result."):
        # Format: $result.<step_id>.<field>
        parts = value[len("$result."):].split(".", 1)
        step_id = parts[0]
        field = parts[1] if len(parts) > 1 else None
        step_result = (context.get("results") or {}).get(step_id)
        if step_result is None:
            return value
        if field and isinstance(step_result, dict):
            return step_result.get(field, value)
        return step_result
    return value
