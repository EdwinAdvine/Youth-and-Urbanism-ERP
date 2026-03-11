"""Calendar Extensions API — Recurring expansion, RSVP, Availability, Subscriptions, Categories, Utilities."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import and_, or_, select, func

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.calendar import CalendarEvent, CalendarCategory, CalendarSubscription

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

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
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class RSVPPayload(BaseModel):
    response: str  # accepted | declined | tentative


class AvailabilityQuery(BaseModel):
    user_ids: list[str]
    start: datetime
    end: datetime


class SubscriptionCreate(BaseModel):
    name: str
    ical_url: str
    sync_interval_minutes: int = 60


class SubscriptionOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    ical_url: str
    sync_interval_minutes: int
    last_synced: datetime | None
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class CategoryCreate(BaseModel):
    name: str
    color: str = "#51459d"


class CategoryUpdate(BaseModel):
    name: str | None = None
    color: str | None = None


class CategoryOut(BaseModel):
    id: uuid.UUID
    name: str
    color: str
    user_id: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Recurring events expansion ───────────────────────────────────────────────

@router.get("/events/recurring", summary="Expand recurring events for a date range")
async def list_recurring_events(
    current_user: CurrentUser,
    db: DBSession,
    start: datetime = Query(..., description="Range start"),
    end: datetime = Query(..., description="Range end"),
) -> dict[str, Any]:
    """Expand recurrence rules into individual event instances for the given range."""
    # Fetch recurring events owned by or attended by user
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.organizer_id == current_user.id,
            CalendarEvent.recurrence_rule.isnot(None),
        )
    )
    recurring_events = result.scalars().all()

    expanded = []
    for event in recurring_events:
        instances = _expand_recurrence(event, start, end)
        expanded.extend(instances)

    return {"total": len(expanded), "events": expanded}


def _expand_recurrence(
    event: CalendarEvent, range_start: datetime, range_end: datetime
) -> list[dict[str, Any]]:
    """Generate virtual event instances from a recurring event's RRULE within the range."""
    rule = (event.recurrence_rule or "").upper()
    freq = "WEEKLY"
    interval = 1
    for part in rule.replace("RRULE:", "").split(";"):
        if part.startswith("FREQ="):
            freq = part.split("=")[1]
        elif part.startswith("INTERVAL="):
            interval = int(part.split("=")[1])

    freq_map = {
        "DAILY": timedelta(days=1),
        "WEEKLY": timedelta(weeks=1),
        "MONTHLY": timedelta(days=30),
        "YEARLY": timedelta(days=365),
    }
    delta = freq_map.get(freq, timedelta(weeks=1)) * interval
    duration = event.end_time - event.start_time

    instances = []
    # Include the original event if it falls in range
    if event.start_time >= range_start and event.start_time <= range_end:
        instances.append({
            "id": str(event.id),
            "title": event.title,
            "description": event.description,
            "start_time": event.start_time.isoformat(),
            "end_time": event.end_time.isoformat(),
            "all_day": event.all_day,
            "event_type": event.event_type,
            "color": event.color,
            "location": event.location,
            "is_recurring_instance": False,
            "parent_event_id": str(event.id),
        })

    current = event.start_time + delta
    max_instances = 365  # safety limit
    count = 0
    while current <= range_end and count < max_instances:
        if event.recurrence_end and current > event.recurrence_end:
            break
        if current >= range_start:
            instances.append({
                "id": f"{event.id}__{current.isoformat()}",
                "title": event.title,
                "description": event.description,
                "start_time": current.isoformat(),
                "end_time": (current + duration).isoformat(),
                "all_day": event.all_day,
                "event_type": event.event_type,
                "color": event.color,
                "location": event.location,
                "is_recurring_instance": True,
                "parent_event_id": str(event.id),
            })
        current += delta
        count += 1

    return instances


# ── RSVP ─────────────────────────────────────────────────────────────────────

@router.post("/events/{event_id}/rsvp", summary="RSVP to a calendar event")
async def rsvp_event(
    event_id: uuid.UUID,
    payload: RSVPPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    valid_responses = {"accepted", "declined", "tentative"}
    if payload.response not in valid_responses:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"response must be one of: {', '.join(valid_responses)}",
        )

    event = await db.get(CalendarEvent, event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # Update attendees list with RSVP data
    attendees = event.attendees or []
    user_id_str = str(current_user.id)

    # Replace simple user ID with RSVP object, or add new
    updated_attendees = []
    found = False
    for att in attendees:
        if isinstance(att, dict) and att.get("user_id") == user_id_str:
            att["response"] = payload.response
            updated_attendees.append(att)
            found = True
        elif isinstance(att, str) and att == user_id_str:
            updated_attendees.append({
                "user_id": user_id_str,
                "response": payload.response,
            })
            found = True
        else:
            updated_attendees.append(att)

    if not found:
        updated_attendees.append({
            "user_id": user_id_str,
            "response": payload.response,
        })

    event.attendees = updated_attendees
    await db.commit()
    await db.refresh(event)

    await event_bus.publish("calendar.rsvp", {
        "event_id": str(event_id),
        "user_id": user_id_str,
        "response": payload.response,
        "title": event.title,
    })

    return {
        "event_id": str(event_id),
        "user_id": user_id_str,
        "response": payload.response,
        "attendees": event.attendees,
    }


# ── Availability ─────────────────────────────────────────────────────────────

@router.get("/availability", summary="Check free/busy status for users")
async def check_availability(
    current_user: CurrentUser,
    db: DBSession,
    user_ids: str = Query(..., description="Comma-separated user IDs"),
    start: datetime = Query(..., description="Range start"),
    end: datetime = Query(..., description="Range end"),
) -> dict[str, Any]:
    uid_list = [uid.strip() for uid in user_ids.split(",") if uid.strip()]

    availability: dict[str, list[dict]] = {}
    for uid in uid_list:
        try:
            user_uuid = uuid.UUID(uid)
        except ValueError:
            continue

        result = await db.execute(
            select(CalendarEvent).where(
                CalendarEvent.organizer_id == user_uuid,
                CalendarEvent.start_time < end,
                CalendarEvent.end_time > start,
            ).order_by(CalendarEvent.start_time.asc())
        )
        events = result.scalars().all()

        busy_slots = []
        for evt in events:
            busy_slots.append({
                "start": evt.start_time.isoformat(),
                "end": evt.end_time.isoformat(),
                "title": evt.title,
                "event_type": evt.event_type,
            })
        availability[uid] = busy_slots

    return {"start": start.isoformat(), "end": end.isoformat(), "availability": availability}


# ── Subscriptions ────────────────────────────────────────────────────────────

@router.get("/subscriptions", summary="List calendar subscriptions")
async def list_subscriptions(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(CalendarSubscription)
        .where(CalendarSubscription.user_id == current_user.id)
        .order_by(CalendarSubscription.created_at.desc())
    )
    subs = result.scalars().all()
    return {
        "total": len(subs),
        "subscriptions": [SubscriptionOut.model_validate(s).model_dump() for s in subs],
    }


@router.post(
    "/subscriptions",
    status_code=status.HTTP_201_CREATED,
    summary="Add a calendar subscription",
)
async def create_subscription(
    payload: SubscriptionCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    sub = CalendarSubscription(
        user_id=current_user.id,
        name=payload.name,
        ical_url=payload.ical_url,
        sync_interval_minutes=payload.sync_interval_minutes,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return SubscriptionOut.model_validate(sub).model_dump()


@router.delete(
    "/subscriptions/{sub_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a calendar subscription",
)
async def delete_subscription(
    sub_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    sub = await db.get(CalendarSubscription, sub_id)
    if not sub or sub.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    await db.delete(sub)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Categories ───────────────────────────────────────────────────────────────

@router.get("/categories", summary="List calendar categories")
async def list_categories(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(CalendarCategory)
        .where(CalendarCategory.user_id == current_user.id)
        .order_by(CalendarCategory.name.asc())
    )
    cats = result.scalars().all()
    return {
        "total": len(cats),
        "categories": [CategoryOut.model_validate(c).model_dump() for c in cats],
    }


@router.post(
    "/categories",
    status_code=status.HTTP_201_CREATED,
    summary="Create a calendar category",
)
async def create_category(
    payload: CategoryCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    cat = CalendarCategory(
        name=payload.name,
        color=payload.color,
        user_id=current_user.id,
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return CategoryOut.model_validate(cat).model_dump()


@router.put("/categories/{cat_id}", summary="Update a calendar category")
async def update_category(
    cat_id: uuid.UUID,
    payload: CategoryUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    cat = await db.get(CalendarCategory, cat_id)
    if not cat or cat.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(cat, field, value)

    await db.commit()
    await db.refresh(cat)
    return CategoryOut.model_validate(cat).model_dump()


@router.delete(
    "/categories/{cat_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a calendar category",
)
async def delete_category(
    cat_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    cat = await db.get(CalendarCategory, cat_id)
    if not cat or cat.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    await db.delete(cat)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Utilities ────────────────────────────────────────────────────────────────

@router.post("/events/{event_id}/duplicate", summary="Duplicate a calendar event")
async def duplicate_event(
    event_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    offset_days: int = Query(0, description="Shift the duplicate by N days"),
) -> dict[str, Any]:
    event = await db.get(CalendarEvent, event_id)
    if not event or event.organizer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    shift = timedelta(days=offset_days)
    duplicate = CalendarEvent(
        title=f"{event.title} (copy)",
        description=event.description,
        start_time=event.start_time + shift,
        end_time=event.end_time + shift,
        all_day=event.all_day,
        event_type=event.event_type,
        color=event.color,
        location=event.location,
        organizer_id=current_user.id,
        attendees=event.attendees or [],
    )
    db.add(duplicate)
    await db.commit()
    await db.refresh(duplicate)
    return EventOut.model_validate(duplicate).model_dump()


@router.get("/events/export", summary="Export calendar events as iCal")
async def export_events_ical(
    current_user: CurrentUser,
    db: DBSession,
    start: datetime | None = Query(None),
    end: datetime | None = Query(None),
) -> Response:
    """Export user's calendar events in iCalendar (ICS) format."""
    query = select(CalendarEvent).where(CalendarEvent.organizer_id == current_user.id)
    if start:
        query = query.where(CalendarEvent.start_time >= start)
    if end:
        query = query.where(CalendarEvent.end_time <= end)

    query = query.order_by(CalendarEvent.start_time.asc())
    result = await db.execute(query)
    events = result.scalars().all()

    # Build iCal content
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Urban ERP//Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]

    for evt in events:
        dtstart = evt.start_time.strftime("%Y%m%dT%H%M%SZ")
        dtend = evt.end_time.strftime("%Y%m%dT%H%M%SZ")
        created = evt.created_at.strftime("%Y%m%dT%H%M%SZ") if evt.created_at else dtstart

        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{evt.id}@urban-erp",
            f"DTSTART:{dtstart}",
            f"DTEND:{dtend}",
            f"DTSTAMP:{created}",
            f"SUMMARY:{_ical_escape(evt.title)}",
        ])
        if evt.description:
            lines.append(f"DESCRIPTION:{_ical_escape(evt.description)}")
        if evt.location:
            lines.append(f"LOCATION:{_ical_escape(evt.location)}")
        if evt.recurrence_rule:
            lines.append(f"RRULE:{evt.recurrence_rule}")
        lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")
    ical_content = "\r\n".join(lines)

    return Response(
        content=ical_content,
        media_type="text/calendar",
        headers={"Content-Disposition": "attachment; filename=calendar.ics"},
    )


def _ical_escape(text: str) -> str:
    """Escape special characters for iCal format."""
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")
