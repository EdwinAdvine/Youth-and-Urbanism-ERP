"""Automation engine — matches event data against project automation rules and executes actions."""
from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.projects import Task
from app.models.projects_enhanced import AutomationRule
from app.models.notification import Notification

logger = logging.getLogger(__name__)


async def run_automations_for_event(
    db: AsyncSession,
    event_name: str,
    event_data: dict,
) -> int:
    """Match automation rules for the given event and execute matching actions.

    Returns the number of rules executed.
    """
    project_id = event_data.get("project_id")
    if not project_id:
        return 0

    # Map event names to trigger types
    trigger_map = {
        "task.status_changed": "status_change",
        "task.assigned": "assignment_change",
        "task.created": "task_created",
    }
    trigger_type = trigger_map.get(event_name)
    if not trigger_type:
        return 0

    # Fetch active rules for this project and trigger type
    result = await db.execute(
        select(AutomationRule).where(
            AutomationRule.project_id == uuid.UUID(project_id),
            AutomationRule.trigger_type == trigger_type,
            AutomationRule.is_active.is_(True),
        )
    )
    rules = result.scalars().all()

    executed = 0
    for rule in rules:
        if _matches_trigger(rule, event_data):
            try:
                await _execute_action(db, rule, event_data)
                rule.execution_count += 1
                executed += 1
            except Exception:
                logger.exception("Failed to execute automation rule %s", rule.id)

    if executed:
        await db.commit()

    return executed


def _matches_trigger(rule: AutomationRule, event_data: dict) -> bool:
    """Check if the event data matches the rule's trigger config."""
    config = rule.trigger_config or {}

    if rule.trigger_type == "status_change":
        from_status = config.get("from_status")
        to_status = config.get("to_status")
        if from_status and event_data.get("old_status") != from_status:
            return False
        if to_status and event_data.get("new_status") != to_status:
            return False
        return True

    elif rule.trigger_type == "assignment_change":
        return True  # Any assignment change triggers

    elif rule.trigger_type == "task_created":
        return True  # Any task creation triggers

    elif rule.trigger_type == "priority_change":
        to_priority = config.get("to_priority")
        if to_priority and event_data.get("new_priority") != to_priority:
            return False
        return True

    return False


async def _execute_action(db: AsyncSession, rule: AutomationRule, event_data: dict) -> None:
    """Execute the configured action for a matched rule."""
    config = rule.action_config or {}
    task_id = event_data.get("task_id")

    if not task_id:
        return

    task = await db.get(Task, uuid.UUID(task_id))
    if not task:
        return

    if rule.action_type == "assign_user":
        user_id = config.get("user_id")
        if user_id:
            task.assignee_id = uuid.UUID(user_id)

    elif rule.action_type == "move_to_status":
        new_status = config.get("status")
        if new_status:
            task.status = new_status

    elif rule.action_type == "add_tag":
        tag = config.get("tag")
        if tag:
            tags = list(task.tags or [])
            if tag not in tags:
                tags.append(tag)
                task.tags = tags

    elif rule.action_type == "send_notification":
        message = config.get("message", f"Automation '{rule.name}' triggered")
        # Notify the task assignee or project owner
        notify_user = task.assignee_id or uuid.UUID(event_data.get("owner_id", str(rule.created_by)))
        notification = Notification(
            user_id=notify_user,
            title=f"Automation: {rule.name}",
            message=message,
            notification_type="automation",
            link=f"/projects/{task.project_id}/tasks/{task.id}",
        )
        db.add(notification)

    elif rule.action_type == "create_subtask":
        subtask_title = config.get("title", "Auto-created subtask")
        subtask_priority = config.get("priority", "medium")
        subtask = Task(
            project_id=task.project_id,
            parent_id=task.id,
            title=subtask_title,
            status="todo",
            priority=subtask_priority,
            order=0,
            tags=[],
        )
        db.add(subtask)

    logger.info("Executed automation rule %s (%s -> %s)", rule.id, rule.trigger_type, rule.action_type)
