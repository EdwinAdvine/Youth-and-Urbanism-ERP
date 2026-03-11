"""HR Manager Dashboard API — team insights, delegation, and manager self-service."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.models.hr import (
    Attendance,
    Department,
    Employee,
    LeaveRequest,
    PerformanceReview,
)
from app.models.hr_phase1 import Goal, ContinuousFeedback

router = APIRouter()


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


async def _get_direct_reports(db, manager_employee: Employee) -> list[Employee]:
    """Get employees in the same department where the manager is department head."""
    if not manager_employee.department_id:
        return []
    # Check if user is department head
    dept_result = await db.execute(
        select(Department).where(
            and_(
                Department.id == manager_employee.department_id,
                Department.head_id == manager_employee.user_id,
            )
        )
    )
    dept = dept_result.scalar_one_or_none()
    if dept is None:
        return []
    # Get all employees in that department except the manager
    result = await db.execute(
        select(Employee)
        .where(
            and_(
                Employee.department_id == dept.id,
                Employee.id != manager_employee.id,
                Employee.is_active == True,
            )
        )
        .options(selectinload(Employee.department))
    )
    return list(result.scalars().all())


# ── Pydantic schemas ─────────────────────────────────────────────────────────


class TeamMemberOut(BaseModel):
    id: uuid.UUID
    employee_number: str
    job_title: str | None
    employment_type: str
    hire_date: date
    is_active: bool

    model_config = {"from_attributes": True}


class DelegationCreate(BaseModel):
    delegate_to_id: uuid.UUID  # employee_id to delegate to
    scope: str  # leave_approval, overtime_approval, all
    start_date: date
    end_date: date
    notes: str | None = None


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/manager/team", summary="Get manager's direct reports")
async def get_team(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Get the current manager's direct reports with summary info."""
    manager = await _get_employee_for_user(db, current_user.id)
    reports = await _get_direct_reports(db, manager)

    members = []
    for emp in reports:
        members.append({
            "id": str(emp.id),
            "employee_number": emp.employee_number,
            "job_title": emp.job_title,
            "employment_type": emp.employment_type,
            "hire_date": str(emp.hire_date),
            "is_active": emp.is_active,
            "department_name": emp.department.name if emp.department else None,
        })

    return {
        "manager_id": str(manager.id),
        "team_size": len(members),
        "members": members,
    }


@router.get("/manager/team/performance", summary="Team performance overview")
async def team_performance(
    current_user: CurrentUser,
    db: DBSession,
    period: str | None = Query(None, description="Review period e.g. Q1 2026"),
) -> dict[str, Any]:
    """Aggregate performance stats for the manager's team."""
    manager = await _get_employee_for_user(db, current_user.id)
    reports = await _get_direct_reports(db, manager)
    report_ids = [r.id for r in reports]

    if not report_ids:
        return {"team_size": 0, "reviews": [], "avg_rating": None}

    query = select(PerformanceReview).where(
        PerformanceReview.employee_id.in_(report_ids)
    )
    if period:
        query = query.where(PerformanceReview.period == period)
    query = query.order_by(PerformanceReview.created_at.desc())

    result = await db.execute(query)
    reviews = result.scalars().all()

    ratings = [r.rating for r in reviews if r.rating]
    avg_rating = sum(ratings) / len(ratings) if ratings else None

    review_list = []
    for r in reviews:
        emp = next((e for e in reports if e.id == r.employee_id), None)
        review_list.append({
            "employee_id": str(r.employee_id),
            "employee_name": emp.employee_number if emp else None,
            "period": r.period,
            "rating": r.rating,
            "status": r.status,
        })

    return {
        "team_size": len(report_ids),
        "total_reviews": len(reviews),
        "avg_rating": float(avg_rating) if avg_rating else None,
        "reviews": review_list,
    }


@router.get("/manager/team/leave", summary="Team leave status")
async def team_leave(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Show who is on leave today and upcoming leave requests."""
    manager = await _get_employee_for_user(db, current_user.id)
    reports = await _get_direct_reports(db, manager)
    report_ids = [r.id for r in reports]

    if not report_ids:
        return {"on_leave_today": [], "pending_requests": [], "upcoming": []}

    today = date.today()

    # On leave today
    on_leave_result = await db.execute(
        select(LeaveRequest).where(
            and_(
                LeaveRequest.employee_id.in_(report_ids),
                LeaveRequest.status == "approved",
                LeaveRequest.start_date <= today,
                LeaveRequest.end_date >= today,
            )
        )
    )
    on_leave = on_leave_result.scalars().all()

    # Pending requests
    pending_result = await db.execute(
        select(LeaveRequest).where(
            and_(
                LeaveRequest.employee_id.in_(report_ids),
                LeaveRequest.status == "pending",
            )
        ).order_by(LeaveRequest.created_at.desc())
    )
    pending = pending_result.scalars().all()

    def _leave_to_dict(lr):
        emp = next((e for e in reports if e.id == lr.employee_id), None)
        return {
            "id": str(lr.id),
            "employee_id": str(lr.employee_id),
            "employee_number": emp.employee_number if emp else None,
            "leave_type": lr.leave_type,
            "start_date": str(lr.start_date),
            "end_date": str(lr.end_date),
            "days": float(lr.days),
            "status": lr.status,
        }

    return {
        "on_leave_today": [_leave_to_dict(lr) for lr in on_leave],
        "pending_requests": [_leave_to_dict(lr) for lr in pending],
    }


@router.get("/manager/team/attendance", summary="Team attendance today")
async def team_attendance(
    current_user: CurrentUser,
    db: DBSession,
    target_date: date | None = Query(None),
) -> dict[str, Any]:
    """Show attendance status for the manager's team."""
    manager = await _get_employee_for_user(db, current_user.id)
    reports = await _get_direct_reports(db, manager)
    report_ids = [r.id for r in reports]

    if not report_ids:
        return {"date": str(target_date or date.today()), "team_size": 0, "records": []}

    check_date = target_date or date.today()
    result = await db.execute(
        select(Attendance).where(
            and_(
                Attendance.employee_id.in_(report_ids),
                Attendance.attendance_date == check_date,
            )
        )
    )
    records = result.scalars().all()

    checked_in_ids = {r.employee_id for r in records}
    attendance_list = []
    for emp in reports:
        record = next((r for r in records if r.employee_id == emp.id), None)
        attendance_list.append({
            "employee_id": str(emp.id),
            "employee_number": emp.employee_number,
            "job_title": emp.job_title,
            "status": record.status if record else "not_checked_in",
            "check_in": str(record.check_in) if record and record.check_in else None,
            "check_out": str(record.check_out) if record and record.check_out else None,
            "hours_worked": float(record.hours_worked) if record and record.hours_worked else None,
        })

    present_count = sum(1 for a in attendance_list if a["status"] in ("present", "remote"))

    return {
        "date": str(check_date),
        "team_size": len(reports),
        "present": present_count,
        "absent": len(reports) - present_count,
        "records": attendance_list,
    }


@router.get("/manager/team/goals", summary="Team goals progress")
async def team_goals(
    current_user: CurrentUser,
    db: DBSession,
    review_period: str | None = Query(None),
) -> dict[str, Any]:
    """Aggregate goal progress for the manager's team."""
    manager = await _get_employee_for_user(db, current_user.id)
    reports = await _get_direct_reports(db, manager)
    report_ids = [r.id for r in reports]

    if not report_ids:
        return {"team_size": 0, "total_goals": 0, "summary": {}}

    query = select(Goal).where(
        and_(
            Goal.owner_type == "employee",
            Goal.owner_id.in_(report_ids),
        )
    )
    if review_period:
        query = query.where(Goal.review_period == review_period)

    result = await db.execute(query)
    goals = result.scalars().all()

    status_counts = {}
    for g in goals:
        status_counts[g.status] = status_counts.get(g.status, 0) + 1

    return {
        "team_size": len(report_ids),
        "total_goals": len(goals),
        "summary": status_counts,
    }


@router.get("/manager/team/engagement", summary="Team engagement snapshot")
async def team_engagement(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Quick engagement snapshot based on feedback activity."""
    manager = await _get_employee_for_user(db, current_user.id)
    reports = await _get_direct_reports(db, manager)
    report_ids = [r.id for r in reports]

    if not report_ids:
        return {"team_size": 0, "feedback_given": 0, "feedback_received": 0}

    given_count = (await db.execute(
        select(func.count()).select_from(ContinuousFeedback).where(
            ContinuousFeedback.from_employee_id.in_(report_ids)
        )
    )).scalar() or 0

    received_count = (await db.execute(
        select(func.count()).select_from(ContinuousFeedback).where(
            ContinuousFeedback.to_employee_id.in_(report_ids)
        )
    )).scalar() or 0

    praise_count = (await db.execute(
        select(func.count()).select_from(ContinuousFeedback).where(
            and_(
                ContinuousFeedback.to_employee_id.in_(report_ids),
                ContinuousFeedback.feedback_type == "praise",
            )
        )
    )).scalar() or 0

    return {
        "team_size": len(report_ids),
        "feedback_given": given_count,
        "feedback_received": received_count,
        "praise_received": praise_count,
    }


@router.post("/manager/delegation", summary="Delegate approval authority")
async def create_delegation(
    payload: DelegationCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Delegate approval authority to another team member.
    Note: Stored as metadata on the manager's employee record.
    """
    manager = await _get_employee_for_user(db, current_user.id)

    # Verify delegate is a direct report
    reports = await _get_direct_reports(db, manager)
    report_ids = [r.id for r in reports]
    if payload.delegate_to_id not in report_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Delegate must be a direct report",
        )

    # Store delegation in metadata_json
    meta = manager.metadata_json or {}
    delegations = meta.get("delegations", [])
    delegation = {
        "id": str(uuid.uuid4()),
        "delegate_to_id": str(payload.delegate_to_id),
        "scope": payload.scope,
        "start_date": str(payload.start_date),
        "end_date": str(payload.end_date),
        "notes": payload.notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    delegations.append(delegation)
    meta["delegations"] = delegations
    manager.metadata_json = meta
    await db.commit()

    return {"message": "Delegation created", "delegation": delegation}


@router.get("/manager/delegation", summary="List active delegations")
async def list_delegations(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """List active delegations for the current manager."""
    manager = await _get_employee_for_user(db, current_user.id)
    meta = manager.metadata_json or {}
    delegations = meta.get("delegations", [])

    today = str(date.today())
    active = [d for d in delegations if d.get("start_date", "") <= today <= d.get("end_date", "")]

    return {"delegations": active, "total": len(active)}


@router.delete("/manager/delegation/{delegation_id}", summary="Revoke delegation")
async def revoke_delegation(
    delegation_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Revoke an active delegation."""
    manager = await _get_employee_for_user(db, current_user.id)
    meta = manager.metadata_json or {}
    delegations = meta.get("delegations", [])

    new_delegations = [d for d in delegations if d.get("id") != delegation_id]
    if len(new_delegations) == len(delegations):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Delegation not found",
        )

    meta["delegations"] = new_delegations
    manager.metadata_json = meta
    await db.commit()

    return {"message": "Delegation revoked"}
