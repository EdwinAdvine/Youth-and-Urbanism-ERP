"""Calendar resource booking API — rooms, equipment, vehicles."""

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, or_, select

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.models.calendar import CalendarEvent
from app.models.resource import Resource, ResourceBooking

router = APIRouter(prefix="/calendar", tags=["Calendar - Resources"])


# ── Schemas ───────────────────────────────────────────────────────────────────


class AvailabilitySlot(BaseModel):
    day: int  # 0=Sun, 1=Mon ... 6=Sat
    start: str  # "09:00"
    end: str  # "17:00"


class ResourceCreate(BaseModel):
    name: str
    description: str | None = None
    resource_type: str = "room"  # room | equipment | vehicle | desk | other
    location: str | None = None
    capacity: int | None = None
    features: list[str] | None = None
    availability: list[AvailabilitySlot] | None = None
    color: str = "#3ec9d6"
    image_url: str | None = None


class ResourceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    resource_type: str | None = None
    location: str | None = None
    capacity: int | None = None
    features: list[str] | None = None
    availability: list[AvailabilitySlot] | None = None
    color: str | None = None
    image_url: str | None = None
    is_active: bool | None = None


class ResourceOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    resource_type: str
    location: str | None
    capacity: int | None
    features: list | None
    availability: list | None
    color: str
    image_url: str | None
    is_active: bool
    managed_by: uuid.UUID | None
    created_at: Any
    model_config = {"from_attributes": True}


class ResourceBookingCreate(BaseModel):
    start_time: datetime
    end_time: datetime
    title: str | None = None
    notes: str | None = None
    recurrence_rule: str | None = None


class ResourceBookingOut(BaseModel):
    id: uuid.UUID
    resource_id: uuid.UUID
    event_id: uuid.UUID | None
    booked_by: uuid.UUID
    start_time: datetime
    end_time: datetime
    title: str | None
    notes: str | None
    status: str
    recurrence_rule: str | None
    created_at: Any
    model_config = {"from_attributes": True}


class AvailabilityWindow(BaseModel):
    start: str  # ISO datetime
    end: str  # ISO datetime


# ── Resource CRUD (admin-only create/update/delete) ──────────────────────────


@router.get("/resources", summary="List all resources")
async def list_resources(
    current_user: CurrentUser,
    db: DBSession,
    resource_type: str | None = Query(None, description="Filter by type: room, equipment, vehicle, desk, other"),
    active_only: bool = Query(True, description="Return only active resources"),
) -> dict[str, Any]:
    query = select(Resource).order_by(Resource.name)
    if resource_type:
        query = query.where(Resource.resource_type == resource_type)
    if active_only:
        query = query.where(Resource.is_active.is_(True))

    result = await db.execute(query)
    resources = result.scalars().all()
    return {
        "total": len(resources),
        "resources": [ResourceOut.model_validate(r) for r in resources],
    }


@router.post(
    "/resources",
    status_code=status.HTTP_201_CREATED,
    summary="Create a resource (admin only)",
    dependencies=[],
)
async def create_resource(
    payload: ResourceCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Only super admins or calendar app admins can create resources
    if not current_user.is_superadmin:
        from app.core.rbac import is_app_admin

        if not await is_app_admin(db, str(current_user.id), "calendar"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required to create resources",
            )

    resource = Resource(
        name=payload.name,
        description=payload.description,
        resource_type=payload.resource_type,
        location=payload.location,
        capacity=payload.capacity,
        features=payload.features,
        availability=(
            [s.model_dump() for s in payload.availability]
            if payload.availability
            else [{"day": d, "start": "08:00", "end": "18:00"} for d in range(1, 6)]
        ),
        color=payload.color,
        image_url=payload.image_url,
        managed_by=current_user.id,
    )
    db.add(resource)
    await db.commit()
    await db.refresh(resource)
    return ResourceOut.model_validate(resource).model_dump()


@router.put("/resources/{resource_id}", summary="Update a resource")
async def update_resource(
    resource_id: uuid.UUID,
    payload: ResourceUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Only super admins, calendar app admins, or the resource manager can update
    if not current_user.is_superadmin and resource.managed_by != current_user.id:
        from app.core.rbac import is_app_admin

        if not await is_app_admin(db, str(current_user.id), "calendar"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this resource",
            )

    update_data = payload.model_dump(exclude_none=True)
    if "availability" in update_data and payload.availability:
        update_data["availability"] = [s.model_dump() for s in payload.availability]

    for field, value in update_data.items():
        setattr(resource, field, value)

    await db.commit()
    await db.refresh(resource)
    return ResourceOut.model_validate(resource).model_dump()


@router.delete(
    "/resources/{resource_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a resource",
)
async def delete_resource(
    resource_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> None:
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    if not current_user.is_superadmin and resource.managed_by != current_user.id:
        from app.core.rbac import is_app_admin

        if not await is_app_admin(db, str(current_user.id), "calendar"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this resource",
            )

    await db.delete(resource)
    await db.commit()


# ── Availability check ───────────────────────────────────────────────────────


@router.get(
    "/resources/{resource_id}/availability",
    summary="Get availability for a date range",
)
async def get_resource_availability(
    resource_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
) -> dict[str, Any]:
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    if not resource.is_active:
        raise HTTPException(status_code=400, detail="Resource is not active")

    from datetime import timedelta

    s_date = datetime.strptime(start_date, "%Y-%m-%d").date()
    e_date = datetime.strptime(end_date, "%Y-%m-%d").date()

    if e_date < s_date:
        raise HTTPException(status_code=400, detail="end_date must be >= start_date")
    if (e_date - s_date).days > 90:
        raise HTTPException(status_code=400, detail="Date range cannot exceed 90 days")

    # Fetch existing bookings in the range
    range_start = datetime.combine(s_date, datetime.min.time())
    range_end = datetime.combine(e_date + timedelta(days=1), datetime.min.time())

    result = await db.execute(
        select(ResourceBooking).where(
            ResourceBooking.resource_id == resource_id,
            ResourceBooking.status != "cancelled",
            ResourceBooking.start_time < range_end,
            ResourceBooking.end_time > range_start,
        )
    )
    existing_bookings = result.scalars().all()

    availability_schedule = resource.availability or []

    # Build day-by-day availability
    days: list[dict[str, Any]] = []
    current_date = s_date
    while current_date <= e_date:
        day_of_week = current_date.isoweekday() % 7  # 0=Sun, 1=Mon ...

        # Find availability windows for this day of week
        day_windows: list[dict[str, str]] = []
        for slot in availability_schedule:
            if slot["day"] == day_of_week:
                day_windows.append({"start": slot["start"], "end": slot["end"]})

        # Find bookings on this day
        day_start = datetime.combine(current_date, datetime.min.time())
        day_end = day_start + timedelta(days=1)
        day_bookings = [
            {
                "id": str(b.id),
                "start": b.start_time.isoformat(),
                "end": b.end_time.isoformat(),
                "title": b.title,
                "booked_by": str(b.booked_by),
                "status": b.status,
            }
            for b in existing_bookings
            if b.start_time < day_end and b.end_time > day_start
        ]

        days.append({
            "date": current_date.isoformat(),
            "day_of_week": day_of_week,
            "available_windows": day_windows,
            "bookings": day_bookings,
        })
        current_date += timedelta(days=1)

    return {
        "resource_id": str(resource_id),
        "resource_name": resource.name,
        "start_date": start_date,
        "end_date": end_date,
        "days": days,
    }


# ── Booking endpoints ────────────────────────────────────────────────────────


@router.post(
    "/resources/{resource_id}/book",
    status_code=status.HTTP_201_CREATED,
    summary="Book a resource (creates ResourceBooking + CalendarEvent)",
)
async def book_resource(
    resource_id: uuid.UUID,
    payload: ResourceBookingCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    if not resource.is_active:
        raise HTTPException(status_code=400, detail="Resource is not active")

    if payload.end_time <= payload.start_time:
        raise HTTPException(status_code=400, detail="end_time must be after start_time")

    # ── Conflict detection ────────────────────────────────────────────────
    conflict_result = await db.execute(
        select(ResourceBooking).where(
            ResourceBooking.resource_id == resource_id,
            ResourceBooking.status != "cancelled",
            ResourceBooking.start_time < payload.end_time,
            ResourceBooking.end_time > payload.start_time,
        )
    )
    conflicts = conflict_result.scalars().all()
    if conflicts:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Resource is already booked for the requested time slot",
        )

    # ── Create a linked CalendarEvent ─────────────────────────────────────
    event_title = payload.title or f"{resource.name} booking"
    cal_event = CalendarEvent(
        title=event_title,
        description=f"Resource booking: {resource.name} ({resource.resource_type})",
        start_time=payload.start_time,
        end_time=payload.end_time,
        event_type="booking",
        organizer_id=current_user.id,
        location=resource.location,
        color=resource.color,
        erp_context={"resource_id": str(resource_id)},
    )
    db.add(cal_event)
    await db.flush()

    # ── Create ResourceBooking ────────────────────────────────────────────
    booking = ResourceBooking(
        resource_id=resource_id,
        event_id=cal_event.id,
        booked_by=current_user.id,
        start_time=payload.start_time,
        end_time=payload.end_time,
        title=payload.title,
        notes=payload.notes,
        recurrence_rule=payload.recurrence_rule,
        status="confirmed",
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)

    # Publish event for cross-module reactions
    await event_bus.publish("resource.booked", {
        "booking_id": str(booking.id),
        "resource_id": str(resource_id),
        "resource_name": resource.name,
        "resource_type": resource.resource_type,
        "event_id": str(cal_event.id),
        "booked_by": str(current_user.id),
        "start_time": payload.start_time.isoformat(),
        "end_time": payload.end_time.isoformat(),
    })

    return ResourceBookingOut.model_validate(booking).model_dump()


@router.get("/resources/bookings", summary="List current user's resource bookings")
async def list_my_resource_bookings(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    upcoming_only: bool = Query(False, description="Only future bookings"),
) -> dict[str, Any]:
    query = (
        select(ResourceBooking)
        .where(ResourceBooking.booked_by == current_user.id)
        .order_by(ResourceBooking.start_time.desc())
    )
    if status_filter:
        query = query.where(ResourceBooking.status == status_filter)
    if upcoming_only:
        query = query.where(ResourceBooking.start_time >= datetime.utcnow())

    result = await db.execute(query)
    bookings = result.scalars().all()
    return {
        "total": len(bookings),
        "bookings": [ResourceBookingOut.model_validate(b) for b in bookings],
    }


@router.delete(
    "/resources/bookings/{booking_id}",
    status_code=status.HTTP_200_OK,
    summary="Cancel a resource booking",
)
async def cancel_resource_booking(
    booking_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> None:
    booking = await db.get(ResourceBooking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Only the booker, the resource manager, or admins can cancel
    if booking.booked_by != current_user.id and not current_user.is_superadmin:
        resource = await db.get(Resource, booking.resource_id)
        if not resource or resource.managed_by != current_user.id:
            from app.core.rbac import is_app_admin

            if not await is_app_admin(db, str(current_user.id), "calendar"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to cancel this booking",
                )

    if booking.status == "cancelled":
        raise HTTPException(status_code=400, detail="Booking is already cancelled")

    booking.status = "cancelled"

    # Also cancel the linked calendar event if it exists
    if booking.event_id:
        cal_event = await db.get(CalendarEvent, booking.event_id)
        if cal_event:
            cal_event.status = "cancelled"

    await db.commit()

    await event_bus.publish("resource.booking_cancelled", {
        "booking_id": str(booking.id),
        "resource_id": str(booking.resource_id),
        "booked_by": str(booking.booked_by),
        "cancelled_by": str(current_user.id),
    })
