"""HR Extensions API — documents, training, performance, benefits, overtime, reports, org chart."""

import csv
import datetime as dt
import io
import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, extract, func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.models.hr import (
    Attendance,
    Benefit,
    Department,
    Employee,
    EmployeeDocument,
    LeaveRequest,
    Overtime,
    PerformanceReview,
    Training,
    TrainingAttendee,
)

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

# -- Employee Document schemas --

class EmployeeDocumentCreate(BaseModel):
    doc_type: str  # contract, id, cert, other
    file_id: uuid.UUID | None = None
    file_name: str
    expiry_date: date | None = None


class EmployeeDocumentOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    doc_type: str
    file_id: uuid.UUID | None
    file_name: str
    expiry_date: date | None
    uploaded_by: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Training schemas --

class TrainingCreate(BaseModel):
    name: str
    description: str | None = None
    date: dt.date
    trainer: str | None = None
    duration_hours: int = 0
    cost: Decimal | None = None
    status: str = "planned"


class TrainingUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    date: dt.date | None = None
    trainer: str | None = None
    duration_hours: int | None = None
    cost: Decimal | None = None
    status: str | None = None


class TrainingOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    date: dt.date
    trainer: str | None
    duration_hours: int
    cost: Decimal | None
    status: str
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class TrainingAttendeeCreate(BaseModel):
    employee_id: uuid.UUID
    status: str = "registered"


class TrainingAttendeeOut(BaseModel):
    id: uuid.UUID
    training_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str | None = None
    status: str
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Performance Review schemas --

class PerformanceReviewCreate(BaseModel):
    employee_id: uuid.UUID
    period: str
    rating: int = Field(ge=1, le=5)
    goals: dict | None = None
    strengths: str | None = None
    areas_for_improvement: str | None = None
    comments: str | None = None


class PerformanceReviewUpdate(BaseModel):
    period: str | None = None
    rating: int | None = Field(None, ge=1, le=5)
    goals: dict | None = None
    strengths: str | None = None
    areas_for_improvement: str | None = None
    status: str | None = None
    comments: str | None = None


class PerformanceReviewOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    reviewer_id: uuid.UUID
    period: str
    rating: int
    goals: dict | None
    strengths: str | None
    areas_for_improvement: str | None
    status: str
    comments: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Benefit schemas --

class BenefitCreate(BaseModel):
    employee_id: uuid.UUID
    benefit_type: str  # health, pension, transport, housing, other
    amount: Decimal
    start_date: date
    end_date: date | None = None


class BenefitUpdate(BaseModel):
    benefit_type: str | None = None
    amount: Decimal | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None


class BenefitOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    benefit_type: str
    amount: Decimal
    start_date: date
    end_date: date | None
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Overtime schemas --

class OvertimeCreate(BaseModel):
    employee_id: uuid.UUID
    overtime_date: date
    hours: Decimal
    rate_multiplier: Decimal = Decimal("1.5")
    notes: str | None = None


class OvertimeUpdate(BaseModel):
    overtime_date: date | None = None
    hours: Decimal | None = None
    rate_multiplier: Decimal | None = None
    notes: str | None = None


class OvertimeOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    overtime_date: date
    hours: Decimal
    rate_multiplier: Decimal
    status: str
    approver_id: uuid.UUID | None
    notes: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Attendance bulk schema --

class AttendanceBulkRow(BaseModel):
    employee_number: str
    attendance_date: date
    check_in: str | None = None  # HH:MM
    check_out: str | None = None
    status: str = "present"
    notes: str | None = None


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_employee_for_user(db, user_id: uuid.UUID) -> Employee:
    result = await db.execute(select(Employee).where(Employee.user_id == user_id))
    employee = result.scalar_one_or_none()
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee profile found for current user",
        )
    return employee


# ── Employee Document endpoints ──────────────────────────────────────────────

@router.get("/employees/{employee_id}/documents", summary="List documents for an employee")
async def list_employee_documents(
    employee_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Verify employee exists
    employee = await db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    result = await db.execute(
        select(EmployeeDocument)
        .where(EmployeeDocument.employee_id == employee_id)
        .order_by(EmployeeDocument.created_at.desc())
    )
    docs = result.scalars().all()
    return {
        "total": len(docs),
        "documents": [EmployeeDocumentOut.model_validate(d).model_dump() for d in docs],
    }


@router.post(
    "/employees/{employee_id}/documents",
    status_code=status.HTTP_201_CREATED,
    summary="Upload / attach a document to an employee",
)
async def create_employee_document(
    employee_id: uuid.UUID,
    payload: EmployeeDocumentCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    employee = await db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    if payload.doc_type not in ("contract", "id", "cert", "other"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="doc_type must be one of: contract, id, cert, other",
        )

    doc = EmployeeDocument(
        employee_id=employee_id,
        doc_type=payload.doc_type,
        file_id=payload.file_id,
        file_name=payload.file_name,
        expiry_date=payload.expiry_date,
        uploaded_by=current_user.id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return EmployeeDocumentOut.model_validate(doc).model_dump()


@router.delete(
    "/employees/{employee_id}/documents/{doc_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete an employee document",
)
async def delete_employee_document(
    employee_id: uuid.UUID,
    doc_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
):
    result = await db.execute(
        select(EmployeeDocument).where(
            and_(
                EmployeeDocument.id == doc_id,
                EmployeeDocument.employee_id == employee_id,
            )
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    await db.delete(doc)
    await db.commit()


# ── Training endpoints ───────────────────────────────────────────────────────

@router.get("/training", summary="List training sessions")
async def list_trainings(
    current_user: CurrentUser,
    db: DBSession,
    training_status: str | None = Query(None, alias="status", description="Filter by status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Training)

    if training_status:
        query = query.where(Training.status == training_status)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Training.date.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    trainings = result.scalars().all()

    return {
        "total": total,
        "trainings": [TrainingOut.model_validate(t).model_dump() for t in trainings],
    }


@router.post(
    "/training",
    status_code=status.HTTP_201_CREATED,
    summary="Create a training session",
)
async def create_training(
    payload: TrainingCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    if payload.status not in ("planned", "in_progress", "completed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="status must be one of: planned, in_progress, completed",
        )

    training = Training(
        name=payload.name,
        description=payload.description,
        date=payload.date,
        trainer=payload.trainer,
        duration_hours=payload.duration_hours,
        cost=payload.cost,
        status=payload.status,
    )
    db.add(training)
    await db.commit()
    await db.refresh(training)
    return TrainingOut.model_validate(training).model_dump()


@router.get("/training/{training_id}", summary="Get training detail")
async def get_training(
    training_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    training = await db.get(Training, training_id)
    if not training:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training not found")
    return TrainingOut.model_validate(training).model_dump()


@router.put("/training/{training_id}", summary="Update a training session")
async def update_training(
    training_id: uuid.UUID,
    payload: TrainingUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    training = await db.get(Training, training_id)
    if not training:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(training, field, value)

    await db.commit()
    await db.refresh(training)
    return TrainingOut.model_validate(training).model_dump()


@router.post(
    "/training/{training_id}/attendees",
    status_code=status.HTTP_201_CREATED,
    summary="Add an attendee to a training session",
)
async def add_training_attendee(
    training_id: uuid.UUID,
    payload: TrainingAttendeeCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    training = await db.get(Training, training_id)
    if not training:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training not found")

    employee = await db.get(Employee, payload.employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    # Check duplicate
    existing = await db.execute(
        select(TrainingAttendee).where(
            and_(
                TrainingAttendee.training_id == training_id,
                TrainingAttendee.employee_id == payload.employee_id,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Employee is already registered for this training",
        )

    attendee = TrainingAttendee(
        training_id=training_id,
        employee_id=payload.employee_id,
        status=payload.status,
    )
    db.add(attendee)
    await db.commit()
    await db.refresh(attendee, attribute_names=["employee"])

    data = TrainingAttendeeOut.model_validate(attendee).model_dump()
    data["employee_name"] = attendee.employee.job_title or attendee.employee.employee_number if attendee.employee else None
    return data


@router.get("/training/{training_id}/attendees", summary="List attendees for a training session")
async def list_training_attendees(
    training_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    training = await db.get(Training, training_id)
    if not training:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training not found")

    result = await db.execute(
        select(TrainingAttendee)
        .where(TrainingAttendee.training_id == training_id)
        .options(selectinload(TrainingAttendee.employee))
    )
    attendees = result.scalars().all()

    items = []
    for a in attendees:
        d = TrainingAttendeeOut.model_validate(a).model_dump()
        d["employee_name"] = a.employee.job_title or a.employee.employee_number if a.employee else None
        items.append(d)

    return {"total": len(items), "attendees": items}


# ── Performance Review endpoints ─────────────────────────────────────────────

@router.get("/performance-reviews", summary="List performance reviews")
async def list_performance_reviews(
    current_user: CurrentUser,
    db: DBSession,
    employee_id: uuid.UUID | None = Query(None, description="Filter by employee"),
    review_status: str | None = Query(None, alias="status", description="Filter by status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(PerformanceReview)

    if employee_id:
        query = query.where(PerformanceReview.employee_id == employee_id)
    if review_status:
        query = query.where(PerformanceReview.status == review_status)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(PerformanceReview.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    reviews = result.scalars().all()

    return {
        "total": total,
        "reviews": [PerformanceReviewOut.model_validate(r).model_dump() for r in reviews],
    }


@router.post(
    "/performance-reviews",
    status_code=status.HTTP_201_CREATED,
    summary="Create a performance review",
)
async def create_performance_review(
    payload: PerformanceReviewCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    employee = await db.get(Employee, payload.employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    review = PerformanceReview(
        employee_id=payload.employee_id,
        reviewer_id=current_user.id,
        period=payload.period,
        rating=payload.rating,
        goals=payload.goals,
        strengths=payload.strengths,
        areas_for_improvement=payload.areas_for_improvement,
        status="draft",
        comments=payload.comments,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return PerformanceReviewOut.model_validate(review).model_dump()


@router.get("/performance-reviews/{review_id}", summary="Get a performance review")
async def get_performance_review(
    review_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    review = await db.get(PerformanceReview, review_id)
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Performance review not found")
    return PerformanceReviewOut.model_validate(review).model_dump()


@router.put("/performance-reviews/{review_id}", summary="Update a performance review")
async def update_performance_review(
    review_id: uuid.UUID,
    payload: PerformanceReviewUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    review = await db.get(PerformanceReview, review_id)
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Performance review not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(review, field, value)

    await db.commit()
    await db.refresh(review)
    return PerformanceReviewOut.model_validate(review).model_dump()


# ── HR Reports endpoints ────────────────────────────────────────────────────

@router.get("/reports/headcount", summary="Headcount report by department")
async def report_headcount(
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    result = await db.execute(
        select(
            Department.name,
            func.count(Employee.id).label("count"),
        )
        .outerjoin(Employee, and_(Employee.department_id == Department.id, Employee.is_active == True))  # noqa: E712
        .where(Department.is_active == True)  # noqa: E712
        .group_by(Department.id, Department.name)
        .order_by(Department.name.asc())
    )
    rows = result.all()

    total = sum(row.count for row in rows)
    return {
        "total_headcount": total,
        "by_department": [{"department": row.name, "count": row.count} for row in rows],
    }


@router.get("/reports/attrition", summary="Attrition report for a given year")
async def report_attrition(
    current_user: CurrentUser,
    db: DBSession,
    year: int = Query(None, description="Year to report on (defaults to current year)"),
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    report_year = year or date.today().year

    # Employees terminated in the year
    terminated_result = await db.execute(
        select(func.count()).select_from(Employee).where(
            and_(
                Employee.termination_date.isnot(None),
                extract("year", Employee.termination_date) == report_year,
            )
        )
    )
    terminated = terminated_result.scalar() or 0

    # Average headcount: active + terminated that year
    active_result = await db.execute(
        select(func.count()).select_from(Employee).where(Employee.is_active == True)  # noqa: E712
    )
    active = active_result.scalar() or 0

    avg_headcount = (active + terminated) / 2 if (active + terminated) > 0 else 1
    attrition_rate = round((terminated / avg_headcount) * 100, 2)

    return {
        "year": report_year,
        "terminated": terminated,
        "active_employees": active,
        "attrition_rate_pct": attrition_rate,
    }


@router.get("/reports/leave-balance", summary="Leave balance summary for all employees")
async def report_leave_balance(
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    current_year = date.today().year
    annual_allocation = Decimal("21")

    # All active employees
    emp_result = await db.execute(
        select(Employee).where(Employee.is_active == True).order_by(Employee.employee_number.asc())  # noqa: E712
    )
    employees = emp_result.scalars().all()

    # Approved leave days grouped by employee
    leave_result = await db.execute(
        select(
            LeaveRequest.employee_id,
            func.sum(LeaveRequest.days).label("total_days"),
        )
        .where(
            and_(
                LeaveRequest.status == "approved",
                extract("year", LeaveRequest.start_date) == current_year,
            )
        )
        .group_by(LeaveRequest.employee_id)
    )
    used_map: dict[uuid.UUID, Decimal] = {}
    for row in leave_result.all():
        used_map[row.employee_id] = row.total_days or Decimal("0")

    balances = []
    for emp in employees:
        used = used_map.get(emp.id, Decimal("0"))
        balances.append({
            "employee_id": str(emp.id),
            "employee_number": emp.employee_number,
            "job_title": emp.job_title,
            "annual_allocation": float(annual_allocation),
            "used": float(used),
            "remaining": float(annual_allocation - used),
        })

    return {"year": current_year, "total_employees": len(balances), "balances": balances}


# ── Org Chart endpoint ───────────────────────────────────────────────────────

@router.get("/org-chart", summary="Organisation chart — hierarchical department → employee tree")
async def org_chart(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Load all active departments
    dept_result = await db.execute(
        select(Department).where(Department.is_active == True).order_by(Department.name.asc())  # noqa: E712
    )
    departments = dept_result.scalars().all()

    # Load all active employees with departments
    emp_result = await db.execute(
        select(Employee)
        .where(Employee.is_active == True)  # noqa: E712
        .options(selectinload(Employee.department))
        .order_by(Employee.employee_number.asc())
    )
    employees = emp_result.scalars().all()

    # Group employees by department
    dept_employees: dict[uuid.UUID, list[dict]] = {}
    unassigned: list[dict] = []
    for emp in employees:
        emp_data = {
            "id": str(emp.id),
            "employee_number": emp.employee_number,
            "job_title": emp.job_title,
            "employment_type": emp.employment_type,
        }
        if emp.department_id:
            dept_employees.setdefault(emp.department_id, []).append(emp_data)
        else:
            unassigned.append(emp_data)

    # Build tree — departments indexed by id
    dept_map: dict[uuid.UUID, dict] = {}
    for dept in departments:
        dept_map[dept.id] = {
            "id": str(dept.id),
            "name": dept.name,
            "description": dept.description,
            "head_id": str(dept.head_id) if dept.head_id else None,
            "parent_id": str(dept.parent_id) if dept.parent_id else None,
            "employees": dept_employees.get(dept.id, []),
            "children": [],
        }

    # Nest children under parents
    roots: list[dict] = []
    for dept_id, node in dept_map.items():
        parent_uuid = None
        for dept in departments:
            if str(dept.id) == node["id"] and dept.parent_id:
                parent_uuid = dept.parent_id
                break
        if parent_uuid and parent_uuid in dept_map:
            dept_map[parent_uuid]["children"].append(node)
        else:
            roots.append(node)

    result_tree = roots
    if unassigned:
        result_tree.append({
            "id": None,
            "name": "Unassigned",
            "description": "Employees not assigned to any department",
            "head_id": None,
            "parent_id": None,
            "employees": unassigned,
            "children": [],
        })

    return {"org_chart": result_tree}


# ── Attendance Bulk Import endpoint ──────────────────────────────────────────

@router.post(
    "/attendance/bulk",
    status_code=status.HTTP_201_CREATED,
    summary="Bulk import attendance records from CSV",
)
async def bulk_import_attendance(
    current_user: CurrentUser,
    db: DBSession,
    file: UploadFile = File(...),
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are accepted",
        )

    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    required_cols = {"employee_number", "attendance_date", "status"}
    if not required_cols.issubset(set(reader.fieldnames or [])):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV must contain columns: {', '.join(sorted(required_cols))}",
        )

    # Pre-load employee number map
    emp_result = await db.execute(select(Employee))
    emp_map: dict[str, uuid.UUID] = {}
    for emp in emp_result.scalars().all():
        emp_map[emp.employee_number] = emp.id

    created = 0
    skipped = 0
    errors: list[str] = []

    for idx, row in enumerate(reader, start=2):  # row 1 is header
        emp_num = (row.get("employee_number") or "").strip()
        att_date_str = (row.get("attendance_date") or "").strip()
        att_status = (row.get("status") or "present").strip()

        if not emp_num or not att_date_str:
            errors.append(f"Row {idx}: missing employee_number or attendance_date")
            skipped += 1
            continue

        if emp_num not in emp_map:
            errors.append(f"Row {idx}: employee_number '{emp_num}' not found")
            skipped += 1
            continue

        try:
            att_date = date.fromisoformat(att_date_str)
        except ValueError:
            errors.append(f"Row {idx}: invalid date format '{att_date_str}'")
            skipped += 1
            continue

        # Check duplicate
        existing = await db.execute(
            select(Attendance).where(
                and_(
                    Attendance.employee_id == emp_map[emp_num],
                    Attendance.attendance_date == att_date,
                )
            )
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        # Parse optional check_in / check_out
        from datetime import time as _time  # noqa: PLC0415

        check_in = None
        check_out = None
        ci_str = (row.get("check_in") or "").strip()
        co_str = (row.get("check_out") or "").strip()
        if ci_str:
            try:
                parts = ci_str.split(":")
                check_in = _time(int(parts[0]), int(parts[1]))
            except (ValueError, IndexError):
                pass
        if co_str:
            try:
                parts = co_str.split(":")
                check_out = _time(int(parts[0]), int(parts[1]))
            except (ValueError, IndexError):
                pass

        record = Attendance(
            employee_id=emp_map[emp_num],
            attendance_date=att_date,
            check_in=check_in,
            check_out=check_out,
            status=att_status,
            notes=(row.get("notes") or "").strip() or None,
        )
        db.add(record)
        created += 1

    await db.commit()

    return {
        "created": created,
        "skipped": skipped,
        "errors": errors[:50],  # cap error list
    }


# ── Employee Availability endpoint ──────────────────────────────────────────

@router.get("/employees/{employee_id}/availability", summary="Check employee availability (leave + project workload)")
async def employee_availability(
    employee_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    start_date: date = Query(None, description="Range start (defaults to today)"),
    end_date: date = Query(None, description="Range end (defaults to 30 days from today)"),
) -> dict[str, Any]:
    """HR→Projects: check leave calendar and current project workload for an employee."""
    employee = await db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    today = date.today()
    range_start = start_date or today
    range_end = end_date or (today + dt.timedelta(days=30))

    # 1. Approved leave in range
    leave_result = await db.execute(
        select(LeaveRequest).where(
            and_(
                LeaveRequest.employee_id == employee_id,
                LeaveRequest.status == "approved",
                LeaveRequest.end_date >= range_start,
                LeaveRequest.start_date <= range_end,
            )
        ).order_by(LeaveRequest.start_date.asc())
    )
    leaves = leave_result.scalars().all()

    leave_days: list[dict] = []
    total_leave_days = 0
    for lv in leaves:
        eff_start = max(lv.start_date, range_start)
        eff_end = min(lv.end_date, range_end)
        days = (eff_end - eff_start).days + 1
        total_leave_days += days
        leave_days.append({
            "leave_type": lv.leave_type,
            "start_date": lv.start_date.isoformat(),
            "end_date": lv.end_date.isoformat(),
            "days_in_range": days,
        })

    # 2. Project workload — hours logged in the range from time logs
    from app.models.projects import TimeLog, Task  # noqa: PLC0415
    time_result = await db.execute(
        select(func.sum(TimeLog.hours)).where(
            and_(
                TimeLog.user_id == employee.user_id,
                TimeLog.logged_at >= dt.datetime.combine(range_start, dt.time.min, tzinfo=dt.timezone.utc),
                TimeLog.logged_at <= dt.datetime.combine(range_end, dt.time.max, tzinfo=dt.timezone.utc),
            )
        )
    )
    total_logged_hours = float(time_result.scalar() or 0)

    # 3. Active tasks assigned to employee's user
    active_tasks_result = await db.execute(
        select(func.count()).select_from(Task).where(
            and_(
                Task.assignee_id == employee.user_id,
                Task.status.in_(["todo", "in_progress", "in_review"]),
            )
        )
    )
    active_tasks_count = active_tasks_result.scalar() or 0

    # Compute availability
    business_days_in_range = sum(
        1 for d in range((range_end - range_start).days + 1)
        if (range_start + dt.timedelta(days=d)).weekday() < 5
    )
    available_days = max(0, business_days_in_range - total_leave_days)
    # Assume 8h/day capacity
    capacity_hours = available_days * 8
    utilization_pct = round((total_logged_hours / capacity_hours * 100), 1) if capacity_hours > 0 else 0.0

    # Is on leave today?
    on_leave_today = any(
        lv.start_date <= today <= lv.end_date
        for lv in leaves
    )

    # Availability status
    if on_leave_today:
        availability_status = "on_leave"
    elif utilization_pct >= 90:
        availability_status = "overloaded"
    elif utilization_pct >= 70:
        availability_status = "busy"
    else:
        availability_status = "available"

    return {
        "employee_id": str(employee_id),
        "employee_number": employee.employee_number,
        "range_start": range_start.isoformat(),
        "range_end": range_end.isoformat(),
        "availability_status": availability_status,
        "on_leave_today": on_leave_today,
        "leave_periods": leave_days,
        "total_leave_days": total_leave_days,
        "business_days": business_days_in_range,
        "available_days": available_days,
        "active_tasks": active_tasks_count,
        "logged_hours": round(total_logged_hours, 1),
        "capacity_hours": capacity_hours,
        "utilization_pct": utilization_pct,
    }


# ── Dashboard KPIs endpoint ─────────────────────────────────────────────────

@router.get("/dashboard/kpis", summary="HR dashboard KPIs")
async def dashboard_kpis(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    today = date.today()
    current_year = today.year

    # Total active employees
    total_result = await db.execute(
        select(func.count()).select_from(Employee).where(Employee.is_active == True)  # noqa: E712
    )
    total_employees = total_result.scalar() or 0

    # On leave today
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

    # Average salary
    avg_salary_result = await db.execute(
        select(func.avg(Employee.salary)).where(
            and_(Employee.is_active == True, Employee.salary.isnot(None))  # noqa: E712
        )
    )
    avg_salary = avg_salary_result.scalar()
    avg_salary = round(float(avg_salary), 2) if avg_salary else 0.0

    # Attrition rate (current year)
    terminated_result = await db.execute(
        select(func.count()).select_from(Employee).where(
            and_(
                Employee.termination_date.isnot(None),
                extract("year", Employee.termination_date) == current_year,
            )
        )
    )
    terminated = terminated_result.scalar() or 0
    avg_headcount = (total_employees + terminated) / 2 if (total_employees + terminated) > 0 else 1
    attrition_rate = round((terminated / avg_headcount) * 100, 2)

    return {
        "total_employees": total_employees,
        "on_leave_today": on_leave_today,
        "avg_salary": avg_salary,
        "attrition_rate_pct": attrition_rate,
        "terminated_this_year": terminated,
    }


# ── Benefit endpoints ────────────────────────────────────────────────────────

@router.get("/benefits", summary="List benefits")
async def list_benefits(
    current_user: CurrentUser,
    db: DBSession,
    employee_id: uuid.UUID | None = Query(None, description="Filter by employee"),
    benefit_type: str | None = Query(None, description="Filter by benefit type"),
    is_active: bool | None = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Benefit)

    if employee_id:
        query = query.where(Benefit.employee_id == employee_id)
    if benefit_type:
        query = query.where(Benefit.benefit_type == benefit_type)
    if is_active is not None:
        query = query.where(Benefit.is_active == is_active)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Benefit.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    benefits = result.scalars().all()

    return {
        "total": total,
        "benefits": [BenefitOut.model_validate(b).model_dump() for b in benefits],
    }


@router.post(
    "/benefits",
    status_code=status.HTTP_201_CREATED,
    summary="Create a benefit for an employee",
)
async def create_benefit(
    payload: BenefitCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    employee = await db.get(Employee, payload.employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    if payload.benefit_type not in ("health", "pension", "transport", "housing", "other"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="benefit_type must be one of: health, pension, transport, housing, other",
        )

    benefit = Benefit(
        employee_id=payload.employee_id,
        benefit_type=payload.benefit_type,
        amount=payload.amount,
        start_date=payload.start_date,
        end_date=payload.end_date,
        is_active=True,
    )
    db.add(benefit)
    await db.commit()
    await db.refresh(benefit)
    return BenefitOut.model_validate(benefit).model_dump()


@router.get("/benefits/{benefit_id}", summary="Get a benefit")
async def get_benefit(
    benefit_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    benefit = await db.get(Benefit, benefit_id)
    if not benefit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Benefit not found")
    return BenefitOut.model_validate(benefit).model_dump()


@router.put("/benefits/{benefit_id}", summary="Update a benefit")
async def update_benefit(
    benefit_id: uuid.UUID,
    payload: BenefitUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    benefit = await db.get(Benefit, benefit_id)
    if not benefit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Benefit not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(benefit, field, value)

    await db.commit()
    await db.refresh(benefit)
    return BenefitOut.model_validate(benefit).model_dump()


# ── Overtime endpoints ───────────────────────────────────────────────────────

@router.get("/overtime", summary="List overtime records")
async def list_overtime(
    current_user: CurrentUser,
    db: DBSession,
    employee_id: uuid.UUID | None = Query(None, description="Filter by employee"),
    overtime_status: str | None = Query(None, alias="status", description="Filter by status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Overtime)

    if employee_id:
        query = query.where(Overtime.employee_id == employee_id)
    if overtime_status:
        query = query.where(Overtime.status == overtime_status)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Overtime.overtime_date.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    records = result.scalars().all()

    return {
        "total": total,
        "overtime": [OvertimeOut.model_validate(r).model_dump() for r in records],
    }


@router.post(
    "/overtime",
    status_code=status.HTTP_201_CREATED,
    summary="Create an overtime record",
)
async def create_overtime(
    payload: OvertimeCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    employee = await db.get(Employee, payload.employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    record = Overtime(
        employee_id=payload.employee_id,
        overtime_date=payload.overtime_date,
        hours=payload.hours,
        rate_multiplier=payload.rate_multiplier,
        status="pending",
        notes=payload.notes,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return OvertimeOut.model_validate(record).model_dump()


@router.put("/overtime/{overtime_id}/approve", summary="Approve an overtime record")
async def approve_overtime(
    overtime_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    record = await db.get(Overtime, overtime_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Overtime record not found")

    if record.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve an overtime record with status '{record.status}'",
        )

    record.status = "approved"
    record.approver_id = current_user.id
    await db.commit()
    await db.refresh(record)

    await event_bus.publish("overtime.approved", {
        "overtime_id": str(record.id),
        "employee_id": str(record.employee_id),
        "hours": str(record.hours),
        "rate_multiplier": str(record.rate_multiplier),
        "approved_by": str(current_user.id),
    })

    return OvertimeOut.model_validate(record).model_dump()


@router.put("/overtime/{overtime_id}/reject", summary="Reject an overtime record")
async def reject_overtime(
    overtime_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    record = await db.get(Overtime, overtime_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Overtime record not found")

    if record.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject an overtime record with status '{record.status}'",
        )

    record.status = "rejected"
    record.approver_id = current_user.id
    await db.commit()
    await db.refresh(record)

    await event_bus.publish("overtime.rejected", {
        "overtime_id": str(record.id),
        "employee_id": str(record.employee_id),
        "rejected_by": str(current_user.id),
    })

    return OvertimeOut.model_validate(record).model_dump()
