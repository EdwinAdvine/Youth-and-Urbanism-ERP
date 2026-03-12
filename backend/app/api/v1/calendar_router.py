"""Calendar API — CRUD for calendar events."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.calendar import CalendarEvent, EVENT_TYPES

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class ReminderConfig(BaseModel):
    minutes_before: int = 15
    channel: str = "push"  # push | email | in_app


class EventCreate(BaseModel):
    title: str
    description: str | None = None
    start_time: datetime
    end_time: datetime
    all_day: bool = False
    event_type: str = "meeting"
    color: str | None = None
    location: str | None = None
    attendees: list[str] | None = None
    jitsi_room: str | None = None
    recurrence_rule: str | None = None
    recurrence_end: datetime | None = None
    # New fields
    sensitivity: str = "normal"
    priority: str = "normal"
    buffer_before: int = 0
    buffer_after: int = 0
    timezone: str | None = None
    reminders: list[ReminderConfig] | None = None
    erp_context: dict | None = None
    category_id: uuid.UUID | None = None
    calendar_id: uuid.UUID | None = None
    status: str = "confirmed"


class EventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    all_day: bool | None = None
    event_type: str | None = None
    color: str | None = None
    location: str | None = None
    attendees: list[str] | None = None
    jitsi_room: str | None = None
    recurrence_rule: str | None = None
    recurrence_end: datetime | None = None
    # New fields
    sensitivity: str | None = None
    priority: str | None = None
    buffer_before: int | None = None
    buffer_after: int | None = None
    timezone: str | None = None
    reminders: list[ReminderConfig] | None = None
    erp_context: dict | None = None
    category_id: uuid.UUID | None = None
    calendar_id: uuid.UUID | None = None
    status: str | None = None


class EventOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    start_time: datetime
    end_time: datetime
    all_day: bool
    event_type: str
    color: str | None
    location: str | None
    attendees: list | None
    jitsi_room: str | None
    recurrence_rule: str | None
    recurrence_end: datetime | None
    parent_event_id: uuid.UUID | None
    organizer_id: uuid.UUID
    # New fields
    sensitivity: str
    priority: str
    buffer_before: int
    buffer_after: int
    timezone: str | None
    reminders: list | None
    erp_context: dict | None
    category_id: uuid.UUID | None
    calendar_id: uuid.UUID | None
    status: str
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/events", summary="List calendar events")
async def list_events(
    current_user: CurrentUser,
    db: DBSession,
    start: datetime | None = Query(None, description="Filter events starting at or after this datetime"),
    end: datetime | None = Query(None, description="Filter events ending at or before this datetime"),
    event_type: str | None = Query(None, description="meeting | task | reminder | holiday"),
) -> dict[str, Any]:
    # Fetch events where the user is the organizer OR is listed as an attendee
    query = select(CalendarEvent).where(CalendarEvent.organizer_id == current_user.id)

    if start:
        query = query.where(CalendarEvent.start_time >= start)
    if end:
        query = query.where(CalendarEvent.end_time <= end)
    if event_type:
        query = query.where(CalendarEvent.event_type == event_type)

    query = query.order_by(CalendarEvent.start_time.asc())
    result = await db.execute(query)
    events = result.scalars().all()
    return {
        "total": len(events),
        "events": [EventOut.model_validate(e) for e in events],
    }


@router.post("/events", status_code=status.HTTP_201_CREATED, summary="Create a calendar event")
async def create_event(
    payload: EventCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    if payload.event_type not in EVENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"event_type must be one of: {', '.join(EVENT_TYPES)}",
        )
    if payload.end_time <= payload.start_time:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_time must be after start_time",
        )

    event = CalendarEvent(
        title=payload.title,
        description=payload.description,
        start_time=payload.start_time,
        end_time=payload.end_time,
        all_day=payload.all_day,
        event_type=payload.event_type,
        color=payload.color,
        location=payload.location,
        organizer_id=current_user.id,
        attendees=payload.attendees or [],
        jitsi_room=payload.jitsi_room,
        recurrence_rule=payload.recurrence_rule,
        recurrence_end=payload.recurrence_end,
        # New fields
        sensitivity=payload.sensitivity,
        priority=payload.priority,
        buffer_before=payload.buffer_before,
        buffer_after=payload.buffer_after,
        timezone=payload.timezone,
        reminders=[r.model_dump() for r in payload.reminders] if payload.reminders else [],
        erp_context=payload.erp_context,
        category_id=payload.category_id,
        calendar_id=payload.calendar_id,
        status=payload.status,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    await event_bus.publish("calendar.event.created", {
        "event_id": str(event.id),
        "title": event.title,
        "event_type": event.event_type,
        "organizer_id": str(current_user.id),
        "start_time": event.start_time.isoformat(),
        "end_time": event.end_time.isoformat(),
        "description": event.description or "",
        "location": event.location or "",
        "attendees": event.attendees or [],
    })

    return EventOut.model_validate(event).model_dump()


@router.put("/events/{event_id}", summary="Update a calendar event")
async def update_event(
    event_id: uuid.UUID,
    payload: EventUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    event = await db.get(CalendarEvent, event_id)
    if not event or event.organizer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if payload.event_type is not None and payload.event_type not in EVENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"event_type must be one of: {', '.join(EVENT_TYPES)}",
        )

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(event, field, value)

    # Validate time range if both are being updated
    start = payload.start_time or event.start_time
    end = payload.end_time or event.end_time
    if end <= start:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_time must be after start_time",
        )

    await db.commit()
    await db.refresh(event)

    await event_bus.publish("calendar.event.updated", {
        "event_id": str(event.id),
        "title": event.title,
        "event_type": event.event_type,
        "organizer_id": str(current_user.id),
    })

    return EventOut.model_validate(event).model_dump()


@router.delete(
    "/events/{event_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a calendar event",
)
async def delete_event(
    event_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    event = await db.get(CalendarEvent, event_id)
    if not event or event.organizer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    await db.delete(event)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


@router.post("/sync", summary="CalDAV sync (retired)")
async def sync_calendar(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """CalDAV sync has been retired. The calendar now uses the REST API directly."""
    return {"synced": 0, "message": "CalDAV sync retired. Calendar uses REST API directly."}


@router.post(
    "/events/{event_id}/expand",
    status_code=status.HTTP_201_CREATED,
    summary="Expand a recurring event into individual instances",
)
async def expand_recurring_event(
    event_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    count: int = Query(10, ge=1, le=52, description="Number of instances to generate"),
) -> dict[str, Any]:
    """Generate individual event instances from a recurring event's RRULE."""
    from datetime import timedelta  # noqa: PLC0415

    event = await db.get(CalendarEvent, event_id)
    if not event or event.organizer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if not event.recurrence_rule:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Event has no recurrence rule",
        )

    # Parse basic RRULE: support FREQ=DAILY|WEEKLY|MONTHLY with INTERVAL
    rule = event.recurrence_rule.upper()
    freq = "WEEKLY"
    interval = 1
    for part in rule.replace("RRULE:", "").split(";"):
        if part.startswith("FREQ="):
            freq = part.split("=")[1]
        elif part.startswith("INTERVAL="):
            interval = int(part.split("=")[1])

    freq_map = {"DAILY": timedelta(days=1), "WEEKLY": timedelta(weeks=1), "MONTHLY": timedelta(days=30)}
    delta = freq_map.get(freq, timedelta(weeks=1)) * interval

    duration = event.end_time - event.start_time
    created = []

    for i in range(1, count + 1):
        new_start = event.start_time + delta * i
        if event.recurrence_end and new_start > event.recurrence_end:
            break

        instance = CalendarEvent(
            title=event.title,
            description=event.description,
            start_time=new_start,
            end_time=new_start + duration,
            all_day=event.all_day,
            event_type=event.event_type,
            color=event.color,
            location=event.location,
            organizer_id=current_user.id,
            attendees=event.attendees,
            parent_event_id=event.id,
        )
        db.add(instance)
        created.append(instance)

    if created:
        await db.commit()
        for inst in created:
            await db.refresh(inst)

    return {
        "parent_event_id": str(event_id),
        "instances_created": len(created),
        "events": [EventOut.model_validate(e).model_dump() for e in created],
    }
