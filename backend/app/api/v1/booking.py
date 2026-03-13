"""Booking pages API — public scheduling links (Calendly-style)."""

import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.booking import BookingPage, BookingSlot
from app.models.calendar import CalendarEvent

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class AvailabilitySlot(BaseModel):
    day: int  # 0=Sun, 1=Mon ... 6=Sat
    start: str  # "09:00"
    end: str    # "17:00"


class CustomQuestion(BaseModel):
    label: str
    type: str = "text"  # text | textarea | select | checkbox
    required: bool = False
    options: list[str] | None = None


class BookingPageCreate(BaseModel):
    slug: str
    title: str
    description: str | None = None
    duration_minutes: int = 30
    buffer_before: int = 0
    buffer_after: int = 0
    min_notice_hours: int = 4
    max_advance_days: int = 60
    availability: list[AvailabilitySlot] | None = None
    color: str = "#51459d"
    welcome_message: str | None = None
    custom_questions: list[CustomQuestion] | None = None
    auto_create_jitsi: bool = True
    event_type: str = "meeting"


class BookingPageUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    duration_minutes: int | None = None
    buffer_before: int | None = None
    buffer_after: int | None = None
    min_notice_hours: int | None = None
    max_advance_days: int | None = None
    availability: list[AvailabilitySlot] | None = None
    color: str | None = None
    welcome_message: str | None = None
    custom_questions: list[CustomQuestion] | None = None
    auto_create_jitsi: bool | None = None
    is_active: bool | None = None


class BookingPageOut(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    slug: str
    title: str
    description: str | None
    duration_minutes: int
    buffer_before: int
    buffer_after: int
    min_notice_hours: int
    max_advance_days: int
    availability: list
    color: str
    welcome_message: str | None
    custom_questions: list | None
    auto_create_jitsi: bool
    event_type: str
    is_active: bool
    created_at: Any
    model_config = {"from_attributes": True}


class BookSlotCreate(BaseModel):
    booker_name: str
    booker_email: str
    start_time: datetime
    answers: dict | None = None


class BookingSlotOut(BaseModel):
    id: uuid.UUID
    booking_page_id: uuid.UUID
    event_id: uuid.UUID | None
    booker_name: str
    booker_email: str
    start_time: datetime
    end_time: datetime
    status: str
    answers: dict | None
    created_at: Any
    model_config = {"from_attributes": True}


# ── Booking Page CRUD (authenticated) ────────────────────────────────────────

@router.get("/pages", summary="List my booking pages")
async def list_booking_pages(current_user: CurrentUser, db: DBSession) -> dict[str, Any]:
    result = await db.execute(
        select(BookingPage)
        .where(BookingPage.owner_id == current_user.id)
        .order_by(BookingPage.created_at.desc())
    )
    pages = result.scalars().all()
    return {"total": len(pages), "pages": [BookingPageOut.model_validate(p) for p in pages]}


@router.post("/pages", status_code=status.HTTP_201_CREATED, summary="Create a booking page")
async def create_booking_page(
    payload: BookingPageCreate, current_user: CurrentUser, db: DBSession
) -> dict[str, Any]:
    # Check slug uniqueness
    existing = await db.execute(select(BookingPage).where(BookingPage.slug == payload.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Slug already taken")

    page = BookingPage(
        owner_id=current_user.id,
        slug=payload.slug,
        title=payload.title,
        description=payload.description,
        duration_minutes=payload.duration_minutes,
        buffer_before=payload.buffer_before,
        buffer_after=payload.buffer_after,
        min_notice_hours=payload.min_notice_hours,
        max_advance_days=payload.max_advance_days,
        availability=[s.model_dump() for s in payload.availability] if payload.availability else [
            {"day": d, "start": "09:00", "end": "17:00"} for d in range(1, 6)
        ],
        color=payload.color,
        welcome_message=payload.welcome_message,
        custom_questions=[q.model_dump() for q in payload.custom_questions] if payload.custom_questions else None,
        auto_create_jitsi=payload.auto_create_jitsi,
        event_type=payload.event_type,
    )
    db.add(page)
    await db.commit()
    await db.refresh(page)
    return BookingPageOut.model_validate(page).model_dump()


@router.put("/pages/{page_id}", summary="Update a booking page")
async def update_booking_page(
    page_id: uuid.UUID, payload: BookingPageUpdate, current_user: CurrentUser, db: DBSession
) -> dict[str, Any]:
    page = await db.get(BookingPage, page_id)
    if not page or page.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Booking page not found")

    update_data = payload.model_dump(exclude_none=True)
    if "availability" in update_data and payload.availability:
        update_data["availability"] = [s.model_dump() for s in payload.availability]
    if "custom_questions" in update_data and payload.custom_questions:
        update_data["custom_questions"] = [q.model_dump() for q in payload.custom_questions]

    for field, value in update_data.items():
        setattr(page, field, value)

    await db.commit()
    await db.refresh(page)
    return BookingPageOut.model_validate(page).model_dump()


@router.delete("/pages/{page_id}", status_code=status.HTTP_200_OK, summary="Delete a booking page")
async def delete_booking_page(
    page_id: uuid.UUID, current_user: CurrentUser, db: DBSession
):
    page = await db.get(BookingPage, page_id)
    if not page or page.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Booking page not found")
    await db.delete(page)
    await db.commit()


# ── Public booking endpoints (no auth required) ──────────────────────────────

@router.get("/public/{slug}", summary="Get public booking page info")
async def get_public_booking_page(slug: str, db: DBSession) -> dict[str, Any]:
    result = await db.execute(select(BookingPage).where(BookingPage.slug == slug, BookingPage.is_active.is_(True)))
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Booking page not found")
    return BookingPageOut.model_validate(page).model_dump()


@router.get("/public/{slug}/available-slots", summary="Get available time slots for a date range")
async def get_available_slots(
    slug: str,
    db: DBSession,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
) -> dict[str, Any]:
    result = await db.execute(select(BookingPage).where(BookingPage.slug == slug, BookingPage.is_active.is_(True)))
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Booking page not found")

    # Parse date
    target_date = datetime.strptime(date, "%Y-%m-%d").date()
    day_of_week = target_date.isoweekday() % 7  # 0=Sun, 1=Mon ...

    # Check if day is in availability
    available_hours = []
    for slot in page.availability:
        if slot["day"] == day_of_week:
            available_hours.append(slot)

    if not available_hours:
        return {"date": date, "slots": []}

    # Get existing bookings for the owner on this date
    day_start = datetime.combine(target_date, datetime.min.time())
    day_end = day_start + timedelta(days=1)
    existing = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.organizer_id == page.owner_id,
            CalendarEvent.start_time >= day_start,
            CalendarEvent.start_time < day_end,
        )
    )
    booked_events = existing.scalars().all()

    # Generate slots
    slots = []
    for avail in available_hours:
        start_h, start_m = map(int, avail["start"].split(":"))
        end_h, end_m = map(int, avail["end"].split(":"))

        current = datetime.combine(target_date, datetime.min.time().replace(hour=start_h, minute=start_m))
        window_end = datetime.combine(target_date, datetime.min.time().replace(hour=end_h, minute=end_m))

        while current + timedelta(minutes=page.duration_minutes) <= window_end:
            slot_end = current + timedelta(minutes=page.duration_minutes)
            buffer_start = current - timedelta(minutes=page.buffer_before)
            buffer_end = slot_end + timedelta(minutes=page.buffer_after)

            # Check conflicts
            is_free = True
            for ev in booked_events:
                if ev.start_time < buffer_end and ev.end_time > buffer_start:
                    is_free = False
                    break

            if is_free:
                slots.append({
                    "start": current.isoformat(),
                    "end": slot_end.isoformat(),
                })

            current += timedelta(minutes=page.duration_minutes + page.buffer_after)

    return {"date": date, "slots": slots}


@router.post("/public/{slug}/book", status_code=status.HTTP_201_CREATED, summary="Book a slot")
async def book_slot(
    slug: str, payload: BookSlotCreate, db: DBSession
) -> dict[str, Any]:
    result = await db.execute(select(BookingPage).where(BookingPage.slug == slug, BookingPage.is_active.is_(True)))
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Booking page not found")

    end_time = payload.start_time + timedelta(minutes=page.duration_minutes)

    # Create calendar event for the owner
    jitsi_room = f"era-booking-{uuid.uuid4().hex[:12]}" if page.auto_create_jitsi else None
    cal_event = CalendarEvent(
        title=f"Booking: {payload.booker_name}",
        description=f"Booked by {payload.booker_name} ({payload.booker_email}) via {page.title}",
        start_time=payload.start_time,
        end_time=end_time,
        event_type=page.event_type,
        organizer_id=page.owner_id,
        attendees=[payload.booker_email],
        jitsi_room=jitsi_room,
        buffer_before=page.buffer_before,
        buffer_after=page.buffer_after,
        color=page.color,
    )
    db.add(cal_event)
    await db.flush()

    # Create booking slot
    slot = BookingSlot(
        booking_page_id=page.id,
        event_id=cal_event.id,
        booker_name=payload.booker_name,
        booker_email=payload.booker_email,
        start_time=payload.start_time,
        end_time=end_time,
        answers=payload.answers,
    )
    db.add(slot)
    await db.commit()
    await db.refresh(slot)

    # Publish event
    await event_bus.publish("booking.created", {
        "booking_id": str(slot.id),
        "booking_page_id": str(page.id),
        "event_id": str(cal_event.id),
        "booker_name": payload.booker_name,
        "booker_email": payload.booker_email,
        "start_time": payload.start_time.isoformat(),
        "owner_id": str(page.owner_id),
    })

    return BookingSlotOut.model_validate(slot).model_dump()


# ── Booking management (authenticated) ───────────────────────────────────────

@router.get("/pages/{page_id}/slots", summary="List bookings for a page")
async def list_booking_slots(
    page_id: uuid.UUID, current_user: CurrentUser, db: DBSession,
    status_filter: str | None = Query(None, alias="status"),
) -> dict[str, Any]:
    page = await db.get(BookingPage, page_id)
    if not page or page.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Booking page not found")

    query = select(BookingSlot).where(BookingSlot.booking_page_id == page_id)
    if status_filter:
        query = query.where(BookingSlot.status == status_filter)
    query = query.order_by(BookingSlot.start_time.desc())

    result = await db.execute(query)
    slots = result.scalars().all()
    return {"total": len(slots), "slots": [BookingSlotOut.model_validate(s) for s in slots]}


@router.post("/slots/{slot_id}/cancel", summary="Cancel a booking")
async def cancel_booking(
    slot_id: uuid.UUID, current_user: CurrentUser, db: DBSession,
    reason: str | None = None,
) -> dict[str, Any]:
    slot = await db.get(BookingSlot, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Verify ownership via booking page
    page = await db.get(BookingPage, slot.booking_page_id)
    if not page or page.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    slot.status = "cancelled"
    slot.cancelled_at = datetime.utcnow()
    slot.cancel_reason = reason

    await db.commit()
    await db.refresh(slot)
    return BookingSlotOut.model_validate(slot).model_dump()
