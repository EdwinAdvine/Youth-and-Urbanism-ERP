"""Calendar – Task Sync endpoints.

Provides REST endpoints for automatic time-blocking from project tasks and
two-way task ↔ calendar sync.

Routes
------
POST   /calendar/auto-block/{task_id}       — schedule a single task time block
POST   /calendar/auto-block-batch           — schedule time blocks for multiple tasks
GET    /calendar/task-links                 — list all task-linked events for the current user
PUT    /calendar/task-links/{event_id}/sync — manually trigger calendar → task sync
"""


import logging
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import cast, or_, select
from sqlalchemy.dialects.postgresql import JSONB

from app.core.deps import CurrentUser, DBSession
from app.models.calendar import CalendarEvent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/calendar", tags=["Calendar - Task Sync"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class BatchAutoBlockRequest(BaseModel):
    """Body for the batch auto-block endpoint."""

    task_ids: list[str]


class AutoBlockResponse(BaseModel):
    """Result of a single auto-block operation."""

    task_id: str
    event_id: str
    title: str
    start_time: str
    end_time: str
    color: str | None = None


class BatchAutoBlockResult(BaseModel):
    """Per-task result within a batch response."""

    task_id: str
    event_id: str | None
    start_time: str | None = None
    end_time: str | None = None
    error: str | None = None


class TaskLinkedEventOut(BaseModel):
    """Summary of a calendar event linked to a project task."""

    event_id: str
    task_id: str
    project_id: str | None
    title: str
    start_time: str
    end_time: str
    status: str
    color: str | None = None


class SyncResult(BaseModel):
    """Result of a manual sync operation."""

    event_id: str
    task_id: str
    synced_due_date: str | None
    message: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/auto-block/{task_id}",
    response_model=AutoBlockResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Auto-schedule a time block for a task",
)
async def auto_block_task(
    task_id: str,
    db: DBSession,
    current_user: CurrentUser,
) -> Any:
    """Find the optimal free slot in the assignee's calendar and create a
    time-block CalendarEvent linked to the given task.

    - Respects existing calendar events (no double-booking).
    - Respects user focus-time blocks.
    - Prefers morning slots for high-priority tasks.
    - Is idempotent: if a block already exists it is returned as-is.

    Returns the created (or existing) CalendarEvent details.
    """
    from app.services.calendar_task_sync import auto_block_task_time  # noqa: PLC0415

    try:
        event = await auto_block_task_time(task_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except Exception as exc:
        logger.exception("auto_block_task failed for task %r", task_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to auto-block time: {exc}",
        )

    return AutoBlockResponse(
        task_id=task_id,
        event_id=str(event.id),
        title=event.title,
        start_time=event.start_time.isoformat(),
        end_time=event.end_time.isoformat(),
        color=event.color,
    )


@router.post(
    "/auto-block-batch",
    response_model=list[BatchAutoBlockResult],
    status_code=status.HTTP_200_OK,
    summary="Auto-schedule time blocks for multiple tasks",
)
async def auto_block_tasks_batch(
    body: BatchAutoBlockRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> Any:
    """Schedule time blocks for a list of task IDs in a single request.

    Each task is processed independently — a failure on one task does not
    abort the others.  The response contains a per-task result including
    ``event_id`` on success or ``error`` on failure.

    Accepts up to 50 task IDs per request.
    """
    if not body.task_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="task_ids must not be empty",
        )
    if len(body.task_ids) > 50:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Maximum 50 task IDs per batch request",
        )

    from app.services.calendar_task_sync import auto_block_multiple_tasks  # noqa: PLC0415

    results = await auto_block_multiple_tasks(body.task_ids, db)
    return [BatchAutoBlockResult(**r) for r in results]


@router.get(
    "/task-links",
    response_model=list[TaskLinkedEventOut],
    summary="List all calendar events linked to tasks for the current user",
)
async def list_task_linked_events(
    db: DBSession,
    current_user: CurrentUser,
) -> Any:
    """Return every CalendarEvent that is linked to a project task and is
    organised by or attended by the current user.

    Events are returned in ascending order of start_time.
    """
    user_id_str = str(current_user.id)

    result = await db.execute(
        select(CalendarEvent)
        .where(
            CalendarEvent.event_type == "task",
            CalendarEvent.status != "cancelled",
            # Has a task_id in erp_context
            CalendarEvent.erp_context.cast(JSONB)["task_id"].as_string() != None,  # noqa: E711
            or_(
                CalendarEvent.organizer_id == current_user.id,
                # Check attendees JSON array contains the user's ID string
                CalendarEvent.attendees.cast(JSONB).contains(  # type: ignore[attr-defined]
                    [user_id_str]
                ),
            ),
        )
        .order_by(CalendarEvent.start_time.asc())
    )
    events = result.scalars().all()

    output: list[TaskLinkedEventOut] = []
    for ev in events:
        ctx: dict = ev.erp_context or {}
        output.append(
            TaskLinkedEventOut(
                event_id=str(ev.id),
                task_id=ctx.get("task_id", ""),
                project_id=ctx.get("project_id"),
                title=ev.title,
                start_time=ev.start_time.isoformat(),
                end_time=ev.end_time.isoformat(),
                status=ev.status,
                color=ev.color,
            )
        )

    return output


@router.put(
    "/task-links/{event_id}/sync",
    response_model=SyncResult,
    summary="Manually trigger sync between a calendar event and its linked task",
)
async def manual_sync_event_to_task(
    event_id: str,
    db: DBSession,
    current_user: CurrentUser,
) -> Any:
    """Re-run the calendar→task sync for *event_id*.

    Use this when you have manually rescheduled a task-linked calendar event
    and want the linked task's ``due_date`` to be updated immediately without
    waiting for the event-bus handler.

    Returns the updated task's new due_date.
    """
    # Verify the event exists and belongs to the current user
    try:
        event_uuid = uuid.UUID(event_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid event_id — must be a valid UUID",
        )

    event = await db.get(CalendarEvent, event_uuid)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # Only the organiser (or a superadmin) may trigger a manual sync
    if event.organizer_id != current_user.id and not current_user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to sync this event",
        )

    ctx: dict = event.erp_context or {}
    task_id_str: str | None = ctx.get("task_id")
    if not task_id_str:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This calendar event is not linked to a task",
        )

    from app.services.calendar_task_sync import sync_calendar_to_task  # noqa: PLC0415

    try:
        task = await sync_calendar_to_task(event_id, db)
    except Exception as exc:
        logger.exception("manual_sync_event_to_task failed for event %r", event_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sync failed: {exc}",
        )

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Linked task {task_id_str!r} not found",
        )

    return SyncResult(
        event_id=event_id,
        task_id=task_id_str,
        synced_due_date=task.due_date.isoformat() if task.due_date else None,
        message=(
            f"Task '{task.title}' due_date updated to "
            f"{task.due_date.isoformat() if task.due_date else 'None'}"
        ),
    )
