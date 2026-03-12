"""HR Scheduling API — shift templates, assignments, holiday calendar, overtime alerts."""
from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date, time, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.models.hr import Attendance, Employee
from app.models.hr_phase1 import HolidayCalendar, ShiftAssignment, ShiftTemplate

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

# -- Shift Template schemas --


class ShiftTemplateCreate(BaseModel):
    name: str
    start_time: time
    end_time: time
    break_duration_minutes: int = 60
    is_overnight: bool = False
    color: str | None = None


class ShiftTemplateUpdate(BaseModel):
    name: str | None = None
    start_time: time | None = None
    end_time: time | None = None
    break_duration_minutes: int | None = None
    is_overnight: bool | None = None
    color: str | None = None


class ShiftTemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    start_time: time
    end_time: time
    break_duration_minutes: int
    is_overnight: bool
    color: str | None
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Shift Assignment schemas --


class ShiftAssignmentCreate(BaseModel):
    employee_id: uuid.UUID
    shift_template_id: uuid.UUID
    assignment_date: date
    notes: str | None = None


class ShiftAssignmentBulkCreate(BaseModel):
    employee_ids: list[uuid.UUID]
    shift_template_id: uuid.UUID
    start_date: date
    end_date: date
    rotation_days: int = 1  # assign every N days within range


class ShiftAssignmentUpdate(BaseModel):
    shift_template_id: uuid.UUID | None = None
    assignment_date: date | None = None
    actual_start: time | None = None
    actual_end: time | None = None
    status: str | None = None
    notes: str | None = None


class ShiftAssignmentSwap(BaseModel):
    swap_with_employee_id: uuid.UUID


class ShiftTemplateNested(BaseModel):
    id: uuid.UUID
    name: str
    start_time: time
    end_time: time
    break_duration_minutes: int
    is_overnight: bool
    color: str | None

    model_config = {"from_attributes": True}


class EmployeeNested(BaseModel):
    id: uuid.UUID
    employee_number: str
    job_title: str | None
    department_id: uuid.UUID | None

    model_config = {"from_attributes": True}


class ShiftAssignmentOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    shift_template_id: uuid.UUID
    assignment_date: date
    actual_start: time | None
    actual_end: time | None
    status: str
    swap_with_id: uuid.UUID | None
    notes: str | None
    shift_template: ShiftTemplateNested | None = None
    employee: EmployeeNested | None = None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Holiday Calendar schemas --


class HolidayCalendarCreate(BaseModel):
    name: str
    country_code: str
    holiday_date: date
    is_recurring: bool = True
    is_half_day: bool = False


class HolidayCalendarUpdate(BaseModel):
    name: str | None = None
    country_code: str | None = None
    holiday_date: date | None = None
    is_recurring: bool | None = None
    is_half_day: bool | None = None


class HolidayCalendarOut(BaseModel):
    id: uuid.UUID
    name: str
    country_code: str
    holiday_date: date
    is_recurring: bool
    is_half_day: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Overtime Alert schema --


class OvertimeAlertOut(BaseModel):
    employee_id: uuid.UUID
    employee_number: str
    job_title: str | None
    department_id: uuid.UUID | None
    total_hours: float
    threshold_hours: float
    excess_hours: float


# ── Shift Template Endpoints ──────────────────────────────────────────────────


@router.get("/shifts/templates", response_model=list[ShiftTemplateOut])
async def list_shift_templates(
    db: DBSession,
    user: CurrentUser,
):
    """List all active shift templates."""
    result = await db.execute(
        select(ShiftTemplate).where(ShiftTemplate.is_active.is_(True))
    )
    return result.scalars().all()


@router.post(
    "/shifts/templates",
    response_model=ShiftTemplateOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_app_admin("hr"))],
)
async def create_shift_template(
    payload: ShiftTemplateCreate,
    db: DBSession,
    user: CurrentUser,
):
    """Create a new shift template (admin)."""
    template = ShiftTemplate(**payload.model_dump())
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@router.put(
    "/shifts/templates/{template_id}",
    response_model=ShiftTemplateOut,
    dependencies=[Depends(require_app_admin("hr"))],
)
async def update_shift_template(
    template_id: uuid.UUID,
    payload: ShiftTemplateUpdate,
    db: DBSession,
    user: CurrentUser,
):
    """Update an existing shift template (admin)."""
    result = await db.execute(
        select(ShiftTemplate).where(ShiftTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Shift template not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(template, key, value)

    await db.commit()
    await db.refresh(template)
    return template


@router.delete(
    "/shifts/templates/{template_id}",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_app_admin("hr"))],
)
async def delete_shift_template(
    template_id: uuid.UUID,
    db: DBSession,
    user: CurrentUser,
):
    """Soft-delete a shift template (admin)."""
    result = await db.execute(
        select(ShiftTemplate).where(ShiftTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Shift template not found")

    template.is_active = False
    await db.commit()


# ── Shift Assignment Endpoints ────────────────────────────────────────────────


@router.get("/shifts/assignments")
async def list_shift_assignments(
    db: DBSession,
    user: CurrentUser,
    employee_id: uuid.UUID | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    shift_status: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """List shift assignments with filters and pagination."""
    conditions = []
    if employee_id:
        conditions.append(ShiftAssignment.employee_id == employee_id)
    if start_date:
        conditions.append(ShiftAssignment.assignment_date >= start_date)
    if end_date:
        conditions.append(ShiftAssignment.assignment_date <= end_date)
    if shift_status:
        conditions.append(ShiftAssignment.status == shift_status)

    where_clause = and_(*conditions) if conditions else True

    # Count
    count_q = select(func.count()).select_from(ShiftAssignment).where(where_clause)
    total = (await db.execute(count_q)).scalar() or 0

    # Fetch
    offset = (page - 1) * limit
    q = (
        select(ShiftAssignment)
        .where(where_clause)
        .order_by(ShiftAssignment.assignment_date.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().all()

    return {
        "items": [ShiftAssignmentOut.model_validate(r) for r in rows],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post(
    "/shifts/assignments",
    response_model=ShiftAssignmentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_app_admin("hr"))],
)
async def create_shift_assignment(
    payload: ShiftAssignmentCreate,
    db: DBSession,
    user: CurrentUser,
):
    """Assign a single shift to an employee (admin)."""
    # Verify template exists
    tmpl = (
        await db.execute(
            select(ShiftTemplate).where(ShiftTemplate.id == payload.shift_template_id)
        )
    ).scalar_one_or_none()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Shift template not found")

    # Verify employee exists
    emp = (
        await db.execute(
            select(Employee).where(Employee.id == payload.employee_id)
        )
    ).scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    assignment = ShiftAssignment(**payload.model_dump())
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    await event_bus.publish(
        "shift.assigned",
        {
            "assignment_id": str(assignment.id),
            "employee_id": str(payload.employee_id),
            "shift_template_id": str(payload.shift_template_id),
            "assignment_date": str(payload.assignment_date),
        },
    )

    return assignment


@router.post(
    "/shifts/assignments/bulk",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_app_admin("hr"))],
)
async def bulk_create_shift_assignments(
    payload: ShiftAssignmentBulkCreate,
    db: DBSession,
    user: CurrentUser,
):
    """Bulk-assign shifts for a rotation period (admin)."""
    # Verify template exists
    tmpl = (
        await db.execute(
            select(ShiftTemplate).where(ShiftTemplate.id == payload.shift_template_id)
        )
    ).scalar_one_or_none()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Shift template not found")

    if payload.start_date > payload.end_date:
        raise HTTPException(status_code=400, detail="start_date must be <= end_date")

    if payload.rotation_days < 1:
        raise HTTPException(status_code=400, detail="rotation_days must be >= 1")

    created: list[ShiftAssignment] = []
    current = payload.start_date
    while current <= payload.end_date:
        for emp_id in payload.employee_ids:
            assignment = ShiftAssignment(
                employee_id=emp_id,
                shift_template_id=payload.shift_template_id,
                assignment_date=current,
            )
            db.add(assignment)
            created.append(assignment)
        current += timedelta(days=payload.rotation_days)

    await db.commit()

    # Refresh all to get IDs
    for a in created:
        await db.refresh(a)

    return {
        "created_count": len(created),
        "items": [ShiftAssignmentOut.model_validate(a) for a in created],
    }


@router.put(
    "/shifts/assignments/{assignment_id}",
    response_model=ShiftAssignmentOut,
    dependencies=[Depends(require_app_admin("hr"))],
)
async def update_shift_assignment(
    assignment_id: uuid.UUID,
    payload: ShiftAssignmentUpdate,
    db: DBSession,
    user: CurrentUser,
):
    """Update a shift assignment (admin)."""
    result = await db.execute(
        select(ShiftAssignment).where(ShiftAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Shift assignment not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(assignment, key, value)

    await db.commit()
    await db.refresh(assignment)
    return assignment


@router.post(
    "/shifts/assignments/{assignment_id}/swap",
    response_model=ShiftAssignmentOut,
)
async def swap_shift_assignment(
    assignment_id: uuid.UUID,
    payload: ShiftAssignmentSwap,
    db: DBSession,
    user: CurrentUser,
):
    """Request a shift swap with another employee."""
    result = await db.execute(
        select(ShiftAssignment).where(ShiftAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Shift assignment not found")

    # Verify swap target exists
    swap_emp = (
        await db.execute(
            select(Employee).where(Employee.id == payload.swap_with_employee_id)
        )
    ).scalar_one_or_none()
    if not swap_emp:
        raise HTTPException(status_code=404, detail="Swap target employee not found")

    assignment.swap_with_id = payload.swap_with_employee_id
    assignment.status = "swapped"
    await db.commit()
    await db.refresh(assignment)
    return assignment


# ── Shift Calendar Endpoint ───────────────────────────────────────────────────


@router.get("/shifts/calendar")
async def shift_calendar(
    db: DBSession,
    user: CurrentUser,
    start_date: date = Query(...),
    end_date: date = Query(...),
    department_id: uuid.UUID | None = Query(None),
):
    """Calendar view of shift assignments grouped by date with employee info."""
    conditions = [
        ShiftAssignment.assignment_date >= start_date,
        ShiftAssignment.assignment_date <= end_date,
    ]

    q = select(ShiftAssignment).where(and_(*conditions))

    # If filtering by department, join Employee
    if department_id:
        q = q.join(Employee, Employee.id == ShiftAssignment.employee_id).where(
            Employee.department_id == department_id
        )

    q = q.order_by(ShiftAssignment.assignment_date)
    rows = (await db.execute(q)).scalars().all()

    # Group by date
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        date_key = row.assignment_date.isoformat()
        grouped[date_key].append(ShiftAssignmentOut.model_validate(row).model_dump())

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "calendar": grouped,
    }


# ── Holiday Calendar Endpoints ────────────────────────────────────────────────


@router.get("/holidays")
async def list_holidays(
    db: DBSession,
    user: CurrentUser,
    country_code: str | None = Query(None),
    year: int | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    """List holidays, optionally filtered by country and year."""
    conditions = []
    if country_code:
        conditions.append(HolidayCalendar.country_code == country_code)
    if year:
        conditions.append(
            and_(
                HolidayCalendar.holiday_date >= date(year, 1, 1),
                HolidayCalendar.holiday_date <= date(year, 12, 31),
            )
        )

    where_clause = and_(*conditions) if conditions else True

    count_q = select(func.count()).select_from(HolidayCalendar).where(where_clause)
    total = (await db.execute(count_q)).scalar() or 0

    offset = (page - 1) * limit
    q = (
        select(HolidayCalendar)
        .where(where_clause)
        .order_by(HolidayCalendar.holiday_date)
        .offset(offset)
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().all()

    return {
        "items": [HolidayCalendarOut.model_validate(r) for r in rows],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post(
    "/holidays",
    response_model=HolidayCalendarOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_app_admin("hr"))],
)
async def create_holiday(
    payload: HolidayCalendarCreate,
    db: DBSession,
    user: CurrentUser,
):
    """Create a holiday entry (admin)."""
    holiday = HolidayCalendar(**payload.model_dump())
    db.add(holiday)
    await db.commit()
    await db.refresh(holiday)
    return holiday


@router.put(
    "/holidays/{holiday_id}",
    response_model=HolidayCalendarOut,
    dependencies=[Depends(require_app_admin("hr"))],
)
async def update_holiday(
    holiday_id: uuid.UUID,
    payload: HolidayCalendarUpdate,
    db: DBSession,
    user: CurrentUser,
):
    """Update a holiday entry (admin)."""
    result = await db.execute(
        select(HolidayCalendar).where(HolidayCalendar.id == holiday_id)
    )
    holiday = result.scalar_one_or_none()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(holiday, key, value)

    await db.commit()
    await db.refresh(holiday)
    return holiday


@router.delete(
    "/holidays/{holiday_id}",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_app_admin("hr"))],
)
async def delete_holiday(
    holiday_id: uuid.UUID,
    db: DBSession,
    user: CurrentUser,
):
    """Delete a holiday entry (admin)."""
    result = await db.execute(
        select(HolidayCalendar).where(HolidayCalendar.id == holiday_id)
    )
    holiday = result.scalar_one_or_none()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")

    await db.delete(holiday)
    await db.commit()


# ── Overtime Alerts Endpoint ──────────────────────────────────────────────────


@router.get("/overtime/alerts", response_model=list[OvertimeAlertOut])
async def overtime_alerts(
    db: DBSession,
    user: CurrentUser,
    threshold_hours: float = Query(40.0, ge=0),
    period_days: int = Query(7, ge=1),
):
    """Employees approaching or exceeding overtime threshold in recent period."""
    cutoff_date = date.today() - timedelta(days=period_days)

    q = (
        select(
            Attendance.employee_id,
            func.coalesce(func.sum(Attendance.hours_worked), 0).label("total_hours"),
        )
        .where(Attendance.attendance_date >= cutoff_date)
        .group_by(Attendance.employee_id)
        .having(func.coalesce(func.sum(Attendance.hours_worked), 0) >= threshold_hours)
    )
    rows = (await db.execute(q)).all()

    if not rows:
        return []

    # Fetch employee details for matching IDs
    emp_ids = [r.employee_id for r in rows]
    emp_q = select(Employee).where(Employee.id.in_(emp_ids))
    employees = {e.id: e for e in (await db.execute(emp_q)).scalars().all()}

    alerts = []
    for row in rows:
        emp = employees.get(row.employee_id)
        if not emp:
            continue
        total = float(row.total_hours)
        alerts.append(
            OvertimeAlertOut(
                employee_id=row.employee_id,
                employee_number=emp.employee_number,
                job_title=emp.job_title,
                department_id=emp.department_id,
                total_hours=total,
                threshold_hours=threshold_hours,
                excess_hours=round(total - threshold_hours, 2),
            )
        )

    return alerts
