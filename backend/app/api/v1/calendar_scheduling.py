"""Calendar Scheduling Intelligence endpoints.

Exposes:
1.  POST /calendar/negotiate-availability  — priority-aware slot negotiation
2.  POST /calendar/travel-buffers/{event_date}  — auto travel-buffer insertion
3.  GET  /calendar/predict-conflicts  — next-week conflict + overload prediction
4.  GET  /calendar/proactive-suggestions  — unblocked tasks + approaching SLAs
5.  POST /calendar/events/{event_id}/displace  — move a lower-priority event
"""

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession
from app.models.calendar import CalendarEvent

router = APIRouter(
    prefix="/calendar",
    tags=["Calendar - Scheduling Intelligence"],
)


# ---------------------------------------------------------------------------
# Pydantic request / response schemas
# ---------------------------------------------------------------------------

class NegotiateAvailabilityRequest(BaseModel):
    attendee_ids: list[str]
    duration_minutes: int = 30
    priority: str = "normal"


class DisplaceEventRequest(BaseModel):
    new_slot_start: str  # ISO-8601 datetime string


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/negotiate-availability")
async def negotiate_availability(
    payload: NegotiateAvailabilityRequest,
    db: DBSession,
    user: CurrentUser,
) -> dict[str, Any]:
    """Find optimal meeting slots with priority-negotiation support.

    High/urgent priority requests can displace lower-priority events.
    Returns up to 5 ranked slots; *negotiable* slots identify which
    existing events would need to be moved.
    """
    from app.services.calendar_scheduling_intelligence import (
        negotiate_availability as _negotiate,
    )

    if payload.priority not in ("low", "normal", "high", "urgent"):
        raise HTTPException(
            status_code=422,
            detail="priority must be one of: low, normal, high, urgent",
        )
    if payload.duration_minutes < 5 or payload.duration_minutes > 480:
        raise HTTPException(
            status_code=422,
            detail="duration_minutes must be between 5 and 480",
        )

    slots = await _negotiate(
        requester_id=str(user.id),
        attendee_ids=payload.attendee_ids,
        duration_minutes=payload.duration_minutes,
        priority=payload.priority,
        db=db,
    )
    return {"slots": slots, "count": len(slots)}


@router.post("/travel-buffers/{event_date}")
async def add_travel_buffers(
    event_date: str,
    db: DBSession,
    user: CurrentUser,
) -> dict[str, Any]:
    """Auto-insert travel-time buffers between in-person events on a given date.

    ``event_date`` must be an ISO-8601 date string (YYYY-MM-DD).
    Returns a list of warnings for each buffer that was adjusted.
    """
    from app.services.calendar_scheduling_intelligence import (
        add_travel_buffers as _add_buffers,
    )

    warnings = await _add_buffers(
        user_id=str(user.id),
        date_str=event_date,
        db=db,
    )
    await db.commit()
    return {"warnings": warnings, "count": len(warnings)}


@router.get("/predict-conflicts")
async def predict_conflicts(
    db: DBSession,
    user: CurrentUser,
) -> dict[str, Any]:
    """Scan the next 7 days for conflicts, overloaded days, and focus violations.

    Returns:
    - **conflicts** — pairs of overlapping events (including buffer times)
    - **overloaded_days** — days with > 6 hours of scheduled meetings
    - **focus_violations** — events that intrude on focus-time blocks
    - **suggestions** — actionable reschedule / load-reduction tips
    """
    from app.services.calendar_scheduling_intelligence import (
        predict_next_week_conflicts as _predict,
    )

    result = await _predict(user_id=str(user.id), db=db)
    return result


@router.get("/proactive-suggestions")
async def proactive_suggestions(
    db: DBSession,
    user: CurrentUser,
) -> dict[str, Any]:
    """Surface proactive scheduling recommendations.

    Checks for:
    - Tasks due within 3 days that have no calendar time-block
    - Open support tickets with SLA expiring within 24 hours

    Returns suggested actions the user should take.
    """
    from app.services.calendar_scheduling_intelligence import (
        proactive_schedule_suggestions as _proactive,
    )

    result = await _proactive(user_id=str(user.id), db=db)
    return result


@router.post("/events/{event_id}/displace")
async def displace_event(
    event_id: str,
    payload: DisplaceEventRequest,
    db: DBSession,
    user: CurrentUser,
) -> dict[str, Any]:
    """Move an existing lower-priority event to a new time slot.

    Used after ``negotiate-availability`` identifies a negotiable conflict.
    The caller provides the ``new_slot_start`` (ISO-8601).  The event's
    duration is preserved; only start_time and end_time are updated.

    Only the event organiser (or a super admin) may displace an event.
    """
    from datetime import datetime, timezone

    # Load the event
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid event_id UUID.")

    event: CalendarEvent | None = await db.get(CalendarEvent, eid)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")

    # Permission check — only organiser can displace
    if event.organizer_id != user.id and not getattr(user, "is_superadmin", False):
        raise HTTPException(
            status_code=403,
            detail="Only the event organiser can displace this event.",
        )

    # Parse the new slot start
    try:
        new_start = datetime.fromisoformat(payload.new_slot_start)
        if new_start.tzinfo is None:
            new_start = new_start.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=422,
            detail="new_slot_start must be a valid ISO-8601 datetime string.",
        )

    # Preserve original duration
    original_duration = event.end_time - event.start_time
    new_end = new_start + original_duration

    old_start = event.start_time.isoformat()
    event.start_time = new_start
    event.end_time = new_end

    await db.commit()
    await db.refresh(event)

    return {
        "event_id": str(event.id),
        "title": event.title,
        "old_start": old_start,
        "new_start": event.start_time.isoformat(),
        "new_end": event.end_time.isoformat(),
        "message": "Event successfully displaced to new time slot.",
    }
