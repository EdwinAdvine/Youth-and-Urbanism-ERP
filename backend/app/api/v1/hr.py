"""HR & Payroll API — CRUD for departments, employees, leave requests, and attendance."""

import uuid
from datetime import date, datetime, time, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import and_, extract, func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.models.hr import Attendance, Department, Employee, LeaveRequest, Payslip, SalaryStructure

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

# -- Department schemas --

class DepartmentCreate(BaseModel):
    name: str
    description: str | None = None
    head_id: uuid.UUID | None = None
    parent_id: uuid.UUID | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    head_id: uuid.UUID | None = None
    parent_id: uuid.UUID | None = None
    is_active: bool | None = None


class DepartmentOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    head_id: uuid.UUID | None
    parent_id: uuid.UUID | None
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Employee schemas --

class EmployeeCreate(BaseModel):
    user_id: uuid.UUID
    department_id: uuid.UUID | None = None
    job_title: str | None = None
    employment_type: str = "full_time"
    hire_date: date
    salary: Decimal | None = None
    currency: str = "USD"
    metadata_json: dict | None = None


class EmployeeUpdate(BaseModel):
    department_id: uuid.UUID | None = None
    job_title: str | None = None
    employment_type: str | None = None
    hire_date: date | None = None
    termination_date: date | None = None
    salary: Decimal | None = None
    currency: str | None = None
    is_active: bool | None = None
    metadata_json: dict | None = None


class EmployeeOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    employee_number: str
    department_id: uuid.UUID | None
    department_name: str | None = None
    job_title: str | None
    employment_type: str
    hire_date: date
    termination_date: date | None
    salary: Decimal | None
    currency: str
    is_active: bool
    metadata_json: dict | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Leave Request schemas --

class LeaveRequestCreate(BaseModel):
    leave_type: str
    start_date: date
    end_date: date
    reason: str | None = None


class LeaveRequestOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    leave_type: str
    start_date: date
    end_date: date
    days: Decimal
    reason: str | None
    status: str
    approved_by: uuid.UUID | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Attendance schemas --

class AttendanceOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    attendance_date: date
    check_in: time | None
    check_out: time | None
    status: str
    hours_worked: Decimal | None
    notes: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_employee_for_user(db, user_id: uuid.UUID) -> Employee:
    """Look up the Employee record linked to a user_id, or raise 404."""
    result = await db.execute(
        select(Employee).where(Employee.user_id == user_id)
    )
    employee = result.scalar_one_or_none()
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee profile found for current user",
        )
    return employee


def _employee_to_dict(employee: Employee) -> dict[str, Any]:
    """Convert an Employee ORM object to a dict with department_name."""
    data = EmployeeOut.model_validate(employee).model_dump()
    data["department_name"] = employee.department.name if employee.department else None
    return data


async def _next_employee_number(db) -> str:
    """Generate the next employee number in the format EMP-0001."""
    result = await db.execute(select(func.count()).select_from(Employee))
    count = result.scalar() or 0
    return f"EMP-{count + 1:04d}"


# ── Department endpoints ──────────────────────────────────────────────────────

@router.get("/departments", summary="List departments (tree structure)")
async def list_departments(
    current_user: CurrentUser,
    db: DBSession,
    is_active: bool | None = Query(None, description="Filter by active status"),
) -> dict[str, Any]:
    query = select(Department).options(selectinload(Department.parent))

    if is_active is not None:
        query = query.where(Department.is_active == is_active)

    query = query.order_by(Department.name.asc())
    result = await db.execute(query)
    departments = result.scalars().all()

    items = []
    for dept in departments:
        d = DepartmentOut.model_validate(dept).model_dump()
        d["parent_name"] = dept.parent.name if dept.parent else None
        items.append(d)

    return {"total": len(items), "departments": items}


@router.post(
    "/departments",
    status_code=status.HTTP_201_CREATED,
    summary="Create a department",
)
async def create_department(
    payload: DepartmentCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    department = Department(
        name=payload.name,
        description=payload.description,
        head_id=payload.head_id,
        parent_id=payload.parent_id,
    )
    db.add(department)
    await db.commit()
    await db.refresh(department)
    return DepartmentOut.model_validate(department).model_dump()


@router.put("/departments/{department_id}", summary="Update a department")
async def update_department(
    department_id: uuid.UUID,
    payload: DepartmentUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    department = await db.get(Department, department_id)
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(department, field, value)

    await db.commit()
    await db.refresh(department)
    return DepartmentOut.model_validate(department).model_dump()


@router.delete(
    "/departments/{department_id}",
    status_code=status.HTTP_200_OK,
    summary="Soft-delete a department",
)
async def delete_department(
    department_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> Response:
    department = await db.get(Department, department_id)
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    department.is_active = False
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ── Employee endpoints ────────────────────────────────────────────────────────

@router.get("/employees/me", summary="Get current user's employee profile")
async def get_my_employee_profile(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(Employee)
        .where(Employee.user_id == current_user.id)
        .options(selectinload(Employee.department))
    )
    employee = result.scalar_one_or_none()
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee profile found for current user",
        )
    return _employee_to_dict(employee)


@router.get("/employees", summary="List employees")
async def list_employees(
    current_user: CurrentUser,
    db: DBSession,
    department_id: uuid.UUID | None = Query(None, description="Filter by department"),
    is_active: bool | None = Query(None, description="Filter by active status"),
    employment_type: str | None = Query(None, description="Filter by employment type"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=1000),
) -> dict[str, Any]:
    query = select(Employee).options(selectinload(Employee.department))

    if department_id is not None:
        query = query.where(Employee.department_id == department_id)
    if is_active is not None:
        query = query.where(Employee.is_active == is_active)
    if employment_type is not None:
        query = query.where(Employee.employment_type == employment_type)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Page
    query = query.order_by(Employee.employee_number.asc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    employees = result.scalars().all()

    return {
        "total": total,
        "employees": [_employee_to_dict(e) for e in employees],
    }


@router.post(
    "/employees",
    status_code=status.HTTP_201_CREATED,
    summary="Create an employee profile",
)
async def create_employee(
    payload: EmployeeCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    # Check if user already has an employee profile
    existing = await db.execute(
        select(Employee).where(Employee.user_id == payload.user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already has an employee profile",
        )

    employee_number = await _next_employee_number(db)

    employee = Employee(
        user_id=payload.user_id,
        employee_number=employee_number,
        department_id=payload.department_id,
        job_title=payload.job_title,
        employment_type=payload.employment_type,
        hire_date=payload.hire_date,
        salary=payload.salary,
        currency=payload.currency,
        metadata_json=payload.metadata_json,
    )
    db.add(employee)
    await db.commit()
    await db.refresh(employee, attribute_names=["department"])
    await event_bus.publish_data_change("employee", str(employee.id), "created")
    return _employee_to_dict(employee)


@router.get("/employees/{employee_id}", summary="Get employee detail")
async def get_employee(
    employee_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(Employee)
        .where(Employee.id == employee_id)
        .options(selectinload(Employee.department))
    )
    employee = result.scalar_one_or_none()
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    return _employee_to_dict(employee)


@router.put("/employees/{employee_id}", summary="Update an employee")
async def update_employee(
    employee_id: uuid.UUID,
    payload: EmployeeUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    result = await db.execute(
        select(Employee)
        .where(Employee.id == employee_id)
        .options(selectinload(Employee.department))
    )
    employee = result.scalar_one_or_none()
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(employee, field, value)

    await db.commit()
    await db.refresh(employee, attribute_names=["department"])
    await event_bus.publish_data_change("employee", str(employee.id), "updated")
    return _employee_to_dict(employee)


# ── Leave Request endpoints ───────────────────────────────────────────────────

@router.get("/leave-requests", summary="List leave requests")
async def list_leave_requests(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    # Check if user is HR admin
    is_hr_admin = False
    if current_user.is_superadmin:
        is_hr_admin = True
    else:
        from app.core.rbac import is_app_admin  # noqa: PLC0415
        is_hr_admin = await is_app_admin(db, str(current_user.id), "hr")

    query = select(LeaveRequest)

    if not is_hr_admin:
        # Regular users only see their own leave requests
        employee = await _get_employee_for_user(db, current_user.id)
        query = query.where(LeaveRequest.employee_id == employee.id)

    if status_filter:
        query = query.where(LeaveRequest.status == status_filter)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Page
    query = query.order_by(LeaveRequest.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    leave_requests = result.scalars().all()

    return {
        "total": total,
        "leave_requests": [LeaveRequestOut.model_validate(lr) for lr in leave_requests],
    }


@router.post(
    "/leave-requests",
    status_code=status.HTTP_201_CREATED,
    summary="Submit a leave request",
)
async def create_leave_request(
    payload: LeaveRequestCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    if payload.end_date < payload.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must be on or after start_date",
        )

    employee = await _get_employee_for_user(db, current_user.id)

    # Auto-compute days (inclusive of start and end)
    days = Decimal((payload.end_date - payload.start_date).days + 1)

    leave_request = LeaveRequest(
        employee_id=employee.id,
        leave_type=payload.leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        days=days,
        reason=payload.reason,
        status="pending",
    )
    db.add(leave_request)
    await db.commit()
    await db.refresh(leave_request)
    return LeaveRequestOut.model_validate(leave_request).model_dump()


@router.put(
    "/leave-requests/{request_id}/approve",
    summary="Approve a leave request",
)
async def approve_leave_request(
    request_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    leave_request = await db.get(LeaveRequest, request_id)
    if not leave_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")
    if leave_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve a leave request with status '{leave_request.status}'",
        )

    leave_request.status = "approved"
    leave_request.approved_by = current_user.id
    await db.commit()
    await db.refresh(leave_request)

    await event_bus.publish("leave.approved", {
        "leave_request_id": str(leave_request.id),
        "employee_id": str(leave_request.employee_id),
        "leave_type": leave_request.leave_type,
        "start_date": leave_request.start_date.isoformat(),
        "end_date": leave_request.end_date.isoformat(),
        "approved_by": str(current_user.id),
    })

    return LeaveRequestOut.model_validate(leave_request).model_dump()


@router.put(
    "/leave-requests/{request_id}/reject",
    summary="Reject a leave request",
)
async def reject_leave_request(
    request_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    leave_request = await db.get(LeaveRequest, request_id)
    if not leave_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")
    if leave_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject a leave request with status '{leave_request.status}'",
        )

    leave_request.status = "rejected"
    leave_request.approved_by = current_user.id
    await db.commit()
    await db.refresh(leave_request)

    await event_bus.publish("leave.rejected", {
        "leave_request_id": str(leave_request.id),
        "employee_id": str(leave_request.employee_id),
        "leave_type": leave_request.leave_type,
        "start_date": leave_request.start_date.isoformat(),
        "end_date": leave_request.end_date.isoformat(),
        "rejected_by": str(current_user.id),
    })

    return LeaveRequestOut.model_validate(leave_request).model_dump()


@router.get("/leave-balance/{employee_id}", summary="Get leave balance for an employee")
async def get_leave_balance(
    employee_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    employee = await db.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    current_year = date.today().year
    annual_allocation = Decimal("21")

    # Sum approved leave days by type for current year
    result = await db.execute(
        select(LeaveRequest.leave_type, func.sum(LeaveRequest.days))
        .where(
            and_(
                LeaveRequest.employee_id == employee_id,
                LeaveRequest.status == "approved",
                extract("year", LeaveRequest.start_date) == current_year,
            )
        )
        .group_by(LeaveRequest.leave_type)
    )
    used_by_type: dict[str, Decimal] = {}
    for leave_type, total_days in result.all():
        used_by_type[leave_type] = total_days or Decimal("0")

    total_used = sum(used_by_type.values(), Decimal("0"))

    return {
        "employee_id": str(employee_id),
        "year": current_year,
        "annual_allocation": float(annual_allocation),
        "total_used": float(total_used),
        "remaining": float(annual_allocation - total_used),
        "used_by_type": {k: float(v) for k, v in used_by_type.items()},
    }


# ── Attendance endpoints ──────────────────────────────────────────────────────

@router.get("/attendance", summary="List attendance records")
async def list_attendance(
    current_user: CurrentUser,
    db: DBSession,
    employee_id: uuid.UUID | None = Query(None, description="Filter by employee"),
    start_date: date | None = Query(None, description="Filter from date"),
    end_date: date | None = Query(None, description="Filter to date"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Attendance)

    if employee_id is not None:
        query = query.where(Attendance.employee_id == employee_id)
    if start_date is not None:
        query = query.where(Attendance.attendance_date >= start_date)
    if end_date is not None:
        query = query.where(Attendance.attendance_date <= end_date)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Page
    query = query.order_by(Attendance.attendance_date.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    records = result.scalars().all()

    return {
        "total": total,
        "attendance": [AttendanceOut.model_validate(r) for r in records],
    }


@router.post(
    "/attendance/check-in",
    status_code=status.HTTP_201_CREATED,
    summary="Record check-in for current user",
)
async def check_in(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    employee = await _get_employee_for_user(db, current_user.id)
    today = date.today()
    now = datetime.now(timezone.utc).time()

    # Check if already checked in today
    result = await db.execute(
        select(Attendance).where(
            and_(
                Attendance.employee_id == employee.id,
                Attendance.attendance_date == today,
            )
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already checked in today",
        )

    record = Attendance(
        employee_id=employee.id,
        attendance_date=today,
        check_in=now,
        status="present",
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    await event_bus.publish("attendance.checked_in", {
        "employee_id": str(employee.id),
        "attendance_date": today.isoformat(),
        "check_in": now.isoformat(),
    })

    return AttendanceOut.model_validate(record).model_dump()


@router.put("/attendance/check-out", summary="Record check-out for current user")
async def check_out(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    employee = await _get_employee_for_user(db, current_user.id)
    today = date.today()
    now = datetime.now(timezone.utc).time()

    # Find today's attendance record
    result = await db.execute(
        select(Attendance).where(
            and_(
                Attendance.employee_id == employee.id,
                Attendance.attendance_date == today,
            )
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No check-in found for today. Please check in first.",
        )
    if record.check_out is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already checked out today",
        )

    record.check_out = now

    # Auto-compute hours_worked
    if record.check_in:
        check_in_dt = datetime.combine(today, record.check_in)
        check_out_dt = datetime.combine(today, now)
        diff_seconds = (check_out_dt - check_in_dt).total_seconds()
        record.hours_worked = Decimal(str(round(diff_seconds / 3600, 2)))

    await db.commit()
    await db.refresh(record)
    return AttendanceOut.model_validate(record).model_dump()


# ── Dashboard endpoint ────────────────────────────────────────────────────────

@router.get("/dashboard/stats", summary="HR dashboard summary")
async def hr_dashboard(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    today = date.today()

    # Total active employees
    total_result = await db.execute(
        select(func.count()).select_from(Employee).where(Employee.is_active == True)  # noqa: E712
    )
    total_employees = total_result.scalar() or 0

    # On leave today (approved leaves overlapping today)
    on_leave_result = await db.execute(
        select(func.count()).select_from(LeaveRequest).where(
            and_(
                LeaveRequest.status == "approved",
                LeaveRequest.start_date <= today,
                LeaveRequest.end_date >= today,
            )
        )
    )
    on_leave_today = on_leave_result.scalar() or 0

    # Present today (attendance records for today)
    present_result = await db.execute(
        select(func.count()).select_from(Attendance).where(
            Attendance.attendance_date == today,
        )
    )
    present_today = present_result.scalar() or 0

    # Departments count (active)
    dept_result = await db.execute(
        select(func.count()).select_from(Department).where(Department.is_active == True)  # noqa: E712
    )
    departments_count = dept_result.scalar() or 0

    return {
        "total_employees": total_employees,
        "on_leave_today": on_leave_today,
        "present_today": present_today,
        "departments_count": departments_count,
    }


# ── Salary Structure & Payslip schemas ────────────────────────────────────────

class SalaryStructureCreate(BaseModel):
    name: str
    base_salary: Decimal
    allowances: dict | None = None
    deductions: dict | None = None


class SalaryStructureUpdate(BaseModel):
    name: str | None = None
    base_salary: Decimal | None = None
    allowances: dict | None = None
    deductions: dict | None = None
    is_active: bool | None = None


class SalaryStructureOut(BaseModel):
    id: uuid.UUID
    name: str
    base_salary: Decimal
    allowances: dict | None
    deductions: dict | None
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class PayslipOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str | None = None
    salary_structure_id: uuid.UUID | None
    period_start: date
    period_end: date
    gross_pay: Decimal
    deductions_total: Decimal
    net_pay: Decimal
    status: str
    approved_by: uuid.UUID | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class PayslipGenerate(BaseModel):
    period_start: date
    period_end: date
    salary_structure_id: uuid.UUID | None = None
    employee_ids: list[uuid.UUID] | None = None  # None means all active employees


# ── Salary Structure endpoints ────────────────────────────────────────────────

@router.get("/salary-structures", summary="List all active salary structures")
async def list_salary_structures(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(SalaryStructure).where(SalaryStructure.is_active == True).order_by(SalaryStructure.name.asc())  # noqa: E712
    )
    structures = result.scalars().all()
    return {
        "total": len(structures),
        "salary_structures": [SalaryStructureOut.model_validate(s).model_dump() for s in structures],
    }


@router.post(
    "/salary-structures",
    status_code=status.HTTP_201_CREATED,
    summary="Create a salary structure",
)
async def create_salary_structure(
    payload: SalaryStructureCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    structure = SalaryStructure(
        name=payload.name,
        base_salary=payload.base_salary,
        allowances=payload.allowances,
        deductions=payload.deductions,
    )
    db.add(structure)
    await db.commit()
    await db.refresh(structure)
    return SalaryStructureOut.model_validate(structure).model_dump()


@router.put("/salary-structures/{structure_id}", summary="Update a salary structure")
async def update_salary_structure(
    structure_id: uuid.UUID,
    payload: SalaryStructureUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    structure = await db.get(SalaryStructure, structure_id)
    if not structure:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salary structure not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(structure, field, value)

    await db.commit()
    await db.refresh(structure)
    return SalaryStructureOut.model_validate(structure).model_dump()


@router.delete(
    "/salary-structures/{structure_id}",
    status_code=status.HTTP_200_OK,
    summary="Soft-delete a salary structure",
)
async def delete_salary_structure(
    structure_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> Response:
    structure = await db.get(SalaryStructure, structure_id)
    if not structure:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salary structure not found")

    structure.is_active = False
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ── Payslip endpoints ─────────────────────────────────────────────────────────

def _payslip_to_dict(payslip: Payslip) -> dict[str, Any]:
    """Convert a Payslip ORM object to a dict with employee name."""
    data = PayslipOut.model_validate(payslip).model_dump()
    if payslip.employee:
        data["employee_name"] = payslip.employee.job_title or payslip.employee.employee_number
    return data


@router.get("/payslips", summary="List payslips with filters")
async def list_payslips(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    period_start: date | None = Query(None, description="Filter by period start"),
    period_end: date | None = Query(None, description="Filter by period end"),
    employee_id: uuid.UUID | None = Query(None, description="Filter by employee"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Payslip)

    if status_filter:
        query = query.where(Payslip.status == status_filter)
    if period_start:
        query = query.where(Payslip.period_start >= period_start)
    if period_end:
        query = query.where(Payslip.period_end <= period_end)
    if employee_id:
        query = query.where(Payslip.employee_id == employee_id)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Page
    query = query.order_by(Payslip.period_start.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    payslips = result.scalars().all()

    return {
        "total": total,
        "payslips": [_payslip_to_dict(p) for p in payslips],
    }


@router.post(
    "/payslips/generate",
    status_code=status.HTTP_201_CREATED,
    summary="Generate payslips for a pay period",
)
async def generate_payslips(
    payload: PayslipGenerate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    if payload.period_end < payload.period_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="period_end must be on or after period_start",
        )

    # Load salary structure if provided
    salary_structure: SalaryStructure | None = None
    if payload.salary_structure_id:
        salary_structure = await db.get(SalaryStructure, payload.salary_structure_id)
        if not salary_structure:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Salary structure not found",
            )

    # Determine target employees
    emp_query = select(Employee).where(Employee.is_active == True)  # noqa: E712
    if payload.employee_ids:
        emp_query = emp_query.where(Employee.id.in_(payload.employee_ids))

    result = await db.execute(emp_query)
    employees = result.scalars().all()

    if not employees:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active employees found for payslip generation",
        )

    generated_payslips: list[dict[str, Any]] = []

    for emp in employees:
        # Determine gross pay from salary structure or employee base salary
        if salary_structure:
            gross_pay = salary_structure.base_salary
            # Add allowances
            if salary_structure.allowances:
                for _key, amount in salary_structure.allowances.items():
                    gross_pay += Decimal(str(amount))
            # Calculate deductions
            deductions_total = Decimal("0")
            if salary_structure.deductions:
                for _key, rate_or_amount in salary_structure.deductions.items():
                    rate_val = Decimal(str(rate_or_amount))
                    if rate_val < 1:
                        # Treat as percentage of base salary
                        deductions_total += salary_structure.base_salary * rate_val
                    else:
                        # Treat as fixed amount
                        deductions_total += rate_val
            struct_id = salary_structure.id
        else:
            gross_pay = emp.salary or Decimal("0")
            deductions_total = Decimal("0")
            struct_id = None

        net_pay = gross_pay - deductions_total

        payslip = Payslip(
            employee_id=emp.id,
            salary_structure_id=struct_id,
            period_start=payload.period_start,
            period_end=payload.period_end,
            gross_pay=gross_pay,
            deductions_total=deductions_total,
            net_pay=net_pay,
            status="draft",
        )
        db.add(payslip)
        await db.flush()
        generated_payslips.append({
            "id": str(payslip.id),
            "employee_id": str(emp.id),
            "employee_number": emp.employee_number,
            "gross_pay": str(gross_pay),
            "deductions_total": str(deductions_total),
            "net_pay": str(net_pay),
        })

    await db.commit()

    return {
        "generated": len(generated_payslips),
        "payslips": generated_payslips,
    }


@router.post("/payslips/{payslip_id}/approve", summary="Approve a payslip")
async def approve_payslip(
    payslip_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    payslip = await db.get(Payslip, payslip_id)
    if not payslip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payslip not found")

    if payslip.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve a payslip with status '{payslip.status}'",
        )

    payslip.status = "approved"
    payslip.approved_by = current_user.id
    await db.commit()
    await db.refresh(payslip)

    await event_bus.publish("payslip.approved", {
        "payslip_id": str(payslip.id),
        "employee_id": str(payslip.employee_id),
        "net_pay": str(payslip.net_pay),
        "period_start": payslip.period_start.isoformat(),
        "period_end": payslip.period_end.isoformat(),
        "approved_by": str(current_user.id),
    })

    return _payslip_to_dict(payslip)


@router.post("/payslips/{payslip_id}/mark-paid", summary="Mark a payslip as paid")
async def mark_payslip_paid(
    payslip_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    payslip = await db.get(Payslip, payslip_id)
    if not payslip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payslip not found")

    if payslip.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot mark as paid — payslip status is '{payslip.status}', must be 'approved'",
        )

    payslip.status = "paid"
    await db.commit()
    await db.refresh(payslip)

    await event_bus.publish("payslip.paid", {
        "payslip_id": str(payslip.id),
        "employee_id": str(payslip.employee_id),
        "net_pay": str(payslip.net_pay),
    })

    return _payslip_to_dict(payslip)


# ── CSV Export endpoints ──────────────────────────────────────────────────────

@router.get("/employees/export", summary="Export employees as CSV")
async def export_employees(
    current_user: CurrentUser,
    db: DBSession,
):
    """Download all employees as a CSV file."""
    from app.core.export import rows_to_csv  # noqa: PLC0415
    from app.models.user import User  # noqa: PLC0415
    result = await db.execute(
        select(Employee, User)
        .join(User, Employee.user_id == User.id)
        .where(Employee.is_active == True)  # noqa: E712
        .order_by(Employee.created_at.desc())
    )
    rows_data = result.all()
    rows = [
        {
            "employee_number": row.Employee.employee_number,
            "full_name": row.User.full_name,
            "email": row.User.email,
            "job_title": row.Employee.job_title or "",
            "employment_type": row.Employee.employment_type,
            "hire_date": str(row.Employee.hire_date),
            "is_active": row.Employee.is_active,
            "created_at": row.Employee.created_at.isoformat(),
        }
        for row in rows_data
    ]
    columns = ["employee_number", "full_name", "email", "job_title", "employment_type", "hire_date", "is_active", "created_at"]
    return rows_to_csv(rows, columns, "employees.csv")
