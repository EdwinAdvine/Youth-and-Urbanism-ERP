"""Calendar ↔ Task synchronisation service.

Provides automatic time-blocking for project tasks and two-way sync between
CalendarEvent records (event_type="task") and Task records.

Linking strategy
----------------
Every task-linked CalendarEvent stores the following in its ``erp_context``
JSON column::

    {
        "task_id":    "<uuid>",
        "project_id": "<uuid>"
    }

This is the single source of truth for the relationship — no extra join table
is required.

Public API
----------
* ``auto_block_task_time``     — find the best free slot and create an event
* ``sync_calendar_to_task``    — event rescheduled → update task.due_date
* ``sync_task_to_calendar``    — task.due_date changed → update linked event
* ``on_task_updated_calendar_sync`` — event-bus handler wired to "task.updated"
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import cast, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events import event_bus
from app.models.calendar import CalendarEvent, FocusTimeBlock
from app.models.projects import Task
from app.services.calendar_ai import (
    WORK_DAY_END,
    WORK_DAY_START,
    _get_events_in_range,
    _get_focus_blocks,
    _is_within_focus_block,
    _score_slot,
    _slot_overlaps_event,
)

logger = logging.getLogger(__name__)

# ── Colour coding for task priority ──────────────────────────────────────────
_PRIORITY_COLOUR: dict[str, str] = {
    "critical": "#ff3a6e",  # Danger
    "high":     "#ffa21d",  # Warning
    "medium":   "#51459d",  # Primary
    "low":      "#3ec9d6",  # Info
}

# Default task duration when estimated_hours is not set (minutes)
_DEFAULT_DURATION_MINUTES = 60

# How many work-days ahead to scan for a free slot
_LOOK_AHEAD_DAYS = 14

# Step size for scanning candidate slots (minutes)
_SLOT_STEP_MINUTES = 30


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _duration_minutes(task: Task) -> int:
    """Return the task's estimated duration in whole minutes.

    Falls back to ``_DEFAULT_DURATION_MINUTES`` when ``estimated_hours`` is
    absent or zero.
    """
    if task.estimated_hours and task.estimated_hours > 0:
        return max(int(task.estimated_hours * 60), 15)
    return _DEFAULT_DURATION_MINUTES


def _priority_score_bonus(task: Task) -> float:
    """Extra score bonus applied to candidate slots for high-priority tasks.

    High-priority tasks receive a bonus that biases the slot selection further
    towards morning slots (the slot scorer already gives a morning bonus; this
    multiplies the effect).
    """
    bonuses: dict[str, float] = {"critical": 30.0, "high": 15.0, "medium": 0.0, "low": -10.0}
    return bonuses.get(task.priority or "medium", 0.0)


async def _find_linked_event(task_id: str, db: AsyncSession) -> CalendarEvent | None:
    """Return the CalendarEvent linked to *task_id* via erp_context, or None."""
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.erp_context.cast(JSONB)["task_id"].as_string() == task_id,
            CalendarEvent.status != "cancelled",
        )
    )
    return result.scalars().first()


async def _find_best_slot(
    task: Task,
    db: AsyncSession,
) -> datetime | None:
    """Scan the next ``_LOOK_AHEAD_DAYS`` work-days and return the best free slot.

    Rules applied (in order):
    1. Skip weekends.
    2. Skip slots outside WORK_DAY_START – WORK_DAY_END.
    3. Skip slots that overlap any existing event for the assignee (incl. buffers).
    4. Skip slots that fall inside the assignee's focus-time blocks.
    5. Score remaining candidates — high-priority tasks boost the morning bonus.
    6. Return the highest-scoring slot start.
    """
    duration = _duration_minutes(task)
    now = datetime.now(timezone.utc)
    # Start searching from the next whole hour
    range_start = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    range_end = range_start + timedelta(days=_LOOK_AHEAD_DAYS)

    assignee_ids: list[str] = []
    if task.assignee_id:
        assignee_ids.append(str(task.assignee_id))

    # If there's no assignee we still create the block (organiser = project owner
    # resolved upstream); use an empty list so we still get an unblocked slot.
    events: list[CalendarEvent] = []
    focus_blocks: list[FocusTimeBlock] = []
    if assignee_ids:
        events = await _get_events_in_range(assignee_ids, range_start, range_end, db)
        focus_blocks = await _get_focus_blocks(assignee_ids, db)

    extra_bonus = _priority_score_bonus(task)
    candidates: list[tuple[float, datetime]] = []
    cursor = range_start

    while cursor + timedelta(minutes=duration) <= range_end:
        slot_end = cursor + timedelta(minutes=duration)

        # Skip weekends
        if cursor.weekday() >= 5:
            cursor += timedelta(minutes=_SLOT_STEP_MINUTES)
            continue

        # Skip outside work hours
        if cursor.time() < WORK_DAY_START or slot_end.time() > WORK_DAY_END:
            cursor += timedelta(minutes=_SLOT_STEP_MINUTES)
            continue

        # Check event conflicts
        if _slot_overlaps_event(cursor, slot_end, events):
            cursor += timedelta(minutes=_SLOT_STEP_MINUTES)
            continue

        # Check focus-time conflicts (task blocks should NOT go inside focus blocks)
        if _is_within_focus_block(cursor, duration, focus_blocks):
            cursor += timedelta(minutes=_SLOT_STEP_MINUTES)
            continue

        score = _score_slot(cursor) + extra_bonus
        candidates.append((score, cursor))
        cursor += timedelta(minutes=_SLOT_STEP_MINUTES)

    if not candidates:
        return None

    candidates.sort(key=lambda c: c[0], reverse=True)
    return candidates[0][1]


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------

async def auto_block_task_time(task_id: str, db: AsyncSession) -> CalendarEvent:
    """Find the optimal free slot for *task_id* and create a CalendarEvent block.

    The event is linked back to the task via ``erp_context``.  If a linked
    event already exists it is returned without creating a duplicate.

    Raises
    ------
    ValueError
        If the task is not found in the database.
    RuntimeError
        If no free slot could be found within ``_LOOK_AHEAD_DAYS`` work-days.
    """
    task = await db.get(Task, uuid.UUID(task_id))
    if task is None:
        raise ValueError(f"Task {task_id!r} not found")

    # Idempotency — return existing block if already scheduled
    existing = await _find_linked_event(task_id, db)
    if existing is not None:
        logger.info("Task %s already has a calendar block (%s) — skipping", task_id, existing.id)
        return existing

    slot_start = await _find_best_slot(task, db)
    if slot_start is None:
        raise RuntimeError(
            f"Could not find a free slot for task {task_id!r} "
            f"in the next {_LOOK_AHEAD_DAYS} work-days"
        )

    duration = _duration_minutes(task)
    slot_end = slot_start + timedelta(minutes=duration)

    # Determine the organiser: assignee first, then fall back to project owner
    organizer_id: uuid.UUID
    if task.assignee_id:
        organizer_id = task.assignee_id
    else:
        # Load project owner
        from app.models.projects import Project  # noqa: PLC0415
        project = await db.get(Project, task.project_id)
        organizer_id = project.owner_id if project else uuid.uuid4()

    attendees: list[str] = []
    if task.assignee_id:
        attendees = [str(task.assignee_id)]

    # Build a human-readable title
    priority_label = (task.priority or "medium").capitalize()
    title = f"[{priority_label}] {task.title}"

    event = CalendarEvent(
        title=title,
        description=(
            f"Auto-scheduled time block for project task.\n"
            f"Estimated duration: {task.estimated_hours or 1}h"
        ),
        start_time=slot_start,
        end_time=slot_end,
        event_type="task",
        organizer_id=organizer_id,
        attendees=attendees,
        color=_PRIORITY_COLOUR.get(task.priority or "medium", "#51459d"),
        priority=_map_priority(task.priority),
        erp_context={
            "task_id": task_id,
            "project_id": str(task.project_id),
        },
        reminders=[{"minutes_before": 15, "channel": "push"}],
        status="confirmed",
    )

    db.add(event)
    await db.commit()
    await db.refresh(event)

    logger.info(
        "Auto-blocked time for task %r (%s → %s)",
        task.title,
        slot_start.isoformat(),
        slot_end.isoformat(),
    )
    return event


def _map_priority(task_priority: str | None) -> str:
    """Map Task priority strings to CalendarEvent priority strings."""
    mapping = {"critical": "urgent", "high": "high", "medium": "normal", "low": "low"}
    return mapping.get(task_priority or "medium", "normal")


async def sync_calendar_to_task(event_id: str, db: AsyncSession) -> Task | None:
    """Propagate a calendar-event reschedule back to the linked task.

    When a CalendarEvent with an ``erp_context.task_id`` is moved or
    rescheduled, this function updates the task's ``due_date`` to match the
    new event ``end_time`` and publishes a ``task.updated`` event so that
    downstream handlers (notifications, automation rules, etc.) are triggered.

    Returns the updated Task, or None if the event has no task link.
    """
    event = await db.get(CalendarEvent, uuid.UUID(event_id))
    if event is None:
        logger.warning("sync_calendar_to_task: event %r not found", event_id)
        return None

    ctx: dict[str, Any] = event.erp_context or {}
    task_id_str: str | None = ctx.get("task_id")
    if not task_id_str:
        logger.debug("Event %s has no erp_context.task_id — nothing to sync", event_id)
        return None

    task = await db.get(Task, uuid.UUID(task_id_str))
    if task is None:
        logger.warning("sync_calendar_to_task: task %r not found for event %r", task_id_str, event_id)
        return None

    old_due = task.due_date
    task.due_date = event.end_time
    await db.commit()
    await db.refresh(task)

    logger.info(
        "sync_calendar_to_task: task %r due_date updated %s → %s",
        task.title,
        old_due,
        task.due_date,
    )

    # Publish task.updated so automation rules & notifications fire
    await event_bus.publish("task.updated", {
        "task_id": task_id_str,
        "title": task.title,
        "project_id": str(task.project_id),
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "assignee_id": str(task.assignee_id) if task.assignee_id else None,
        "source": "calendar_sync",   # prevents infinite loop — handlers should check this
    })

    return task


async def sync_task_to_calendar(task_id: str, db: AsyncSession) -> CalendarEvent | None:
    """Propagate a task due_date change to the linked CalendarEvent.

    Finds the linked event via ``erp_context.task_id``, then updates its
    ``start_time`` / ``end_time`` to keep the block anchored to the new
    due date while preserving the original duration.

    Returns the updated CalendarEvent, or None if no linked event exists.
    """
    task = await db.get(Task, uuid.UUID(task_id))
    if task is None:
        logger.warning("sync_task_to_calendar: task %r not found", task_id)
        return None

    event = await _find_linked_event(task_id, db)
    if event is None:
        logger.debug("sync_task_to_calendar: no linked event for task %r", task_id)
        return None

    if task.due_date is None:
        logger.debug("sync_task_to_calendar: task %r has no due_date — skipping", task_id)
        return None

    # Preserve the original event duration
    original_duration = event.end_time - event.start_time
    due_dt: datetime = task.due_date
    if due_dt.tzinfo is None:
        due_dt = due_dt.replace(tzinfo=timezone.utc)

    # Anchor end_time to due_date; start_time = due_date − duration
    new_end = due_dt
    new_start = due_dt - original_duration

    # Clamp start within work hours
    if new_start.time() < WORK_DAY_START:
        new_start = new_start.replace(
            hour=WORK_DAY_START.hour, minute=WORK_DAY_START.minute, second=0, microsecond=0
        )
        new_end = new_start + original_duration

    event.start_time = new_start
    event.end_time = new_end
    # Keep the title in sync with any task title changes
    priority_label = (task.priority or "medium").capitalize()
    event.title = f"[{priority_label}] {task.title}"
    event.color = _PRIORITY_COLOUR.get(task.priority or "medium", "#51459d")

    await db.commit()
    await db.refresh(event)

    logger.info(
        "sync_task_to_calendar: event for task %r rescheduled to %s → %s",
        task.title,
        event.start_time.isoformat(),
        event.end_time.isoformat(),
    )
    return event


# ---------------------------------------------------------------------------
# Event-bus handler
# ---------------------------------------------------------------------------

async def on_task_updated_calendar_sync(data: dict) -> None:
    """Handle ``task.updated`` events and keep the linked calendar block in sync.

    Wired up in ``main.py`` via ``event_bus.on("task.updated")``.

    Skips events that originated from ``sync_calendar_to_task`` (identified by
    ``data["source"] == "calendar_sync"``) to prevent an infinite loop.
    """
    # Guard: ignore events we ourselves published to avoid ping-pong
    if data.get("source") == "calendar_sync":
        return

    task_id: str | None = data.get("task_id")
    if not task_id:
        return

    logger.info("on_task_updated_calendar_sync: task %s updated — syncing calendar", task_id)

    try:
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            await sync_task_to_calendar(task_id, db)
    except Exception:
        logger.exception(
            "on_task_updated_calendar_sync: failed to sync task %r to calendar", task_id
        )


async def auto_block_multiple_tasks(
    task_ids: list[str],
    db: AsyncSession,
) -> list[dict[str, Any]]:
    """Auto-schedule time blocks for a batch of tasks.

    Returns a list of result dicts with keys ``task_id``, ``event_id`` (on
    success), and ``error`` (on failure).
    """
    results: list[dict[str, Any]] = []
    for tid in task_ids:
        try:
            event = await auto_block_task_time(tid, db)
            results.append({
                "task_id": tid,
                "event_id": str(event.id),
                "start_time": event.start_time.isoformat(),
                "end_time": event.end_time.isoformat(),
                "error": None,
            })
        except Exception as exc:
            logger.warning("auto_block_multiple_tasks: task %r failed — %s", tid, exc)
            results.append({"task_id": tid, "event_id": None, "error": str(exc)})
    return results
