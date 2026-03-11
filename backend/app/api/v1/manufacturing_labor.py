"""Manufacturing Labor & Workforce — operator skills, crew scheduling, timesheet push."""
from __future__ import annotations

import uuid
from datetime import datetime, date as date_type
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.manufacturing import OperatorSkill, CrewAssignment

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────────────

class SkillCreate(BaseModel):
    employee_id: uuid.UUID
    skill_name: str
    proficiency_level: str = "trainee"
    certification_number: str | None = None
    certified_date: str | None = None
    expiry_date: str | None = None
    notes: str | None = None


class SkillUpdate(BaseModel):
    proficiency_level: str | None = None
    certification_number: str | None = None
    certified_date: str | None = None
    expiry_date: str | None = None
    is_active: bool | None = None
    notes: str | None = None


class CrewAssignmentCreate(BaseModel):
    work_order_id: uuid.UUID
    workstation_id: uuid.UUID
    employee_id: uuid.UUID
    shift: str
    assignment_date: str
    role: str = "operator"
    start_time: datetime | None = None
    end_time: datetime | None = None


class LogHoursPayload(BaseModel):
    hours_worked: float
    start_time: datetime | None = None
    end_time: datetime | None = None


class TimesheetPushPayload(BaseModel):
    assignment_ids: list[uuid.UUID]


# ─── Operator Skills ──────────────────────────────────────────────────────────

@router.post("/skills", status_code=201)
async def create_skill(body: SkillCreate, db: DBSession, user: CurrentUser):
    skill = OperatorSkill(
        employee_id=body.employee_id,
        skill_name=body.skill_name,
        proficiency_level=body.proficiency_level,
        certification_number=body.certification_number,
        certified_date=date_type.fromisoformat(body.certified_date) if body.certified_date else None,
        expiry_date=date_type.fromisoformat(body.expiry_date) if body.expiry_date else None,
        is_active=True,
        notes=body.notes,
        created_by=user.id,
    )
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    return skill


@router.get("/skills")
async def list_skills(
    db: DBSession,
    user: CurrentUser,
    employee_id: uuid.UUID | None = None,
    skill_name: str | None = None,
):
    q = select(OperatorSkill).where(OperatorSkill.is_active.is_(True))
    if employee_id:
        q = q.where(OperatorSkill.employee_id == employee_id)
    if skill_name:
        q = q.where(OperatorSkill.skill_name.ilike(f"%{skill_name}%"))
    result = await db.execute(q.order_by(OperatorSkill.skill_name))
    return result.scalars().all()


@router.put("/skills/{skill_id}")
async def update_skill(
    skill_id: uuid.UUID,
    body: SkillUpdate,
    db: DBSession,
    user: CurrentUser,
):
    result = await db.execute(select(OperatorSkill).where(OperatorSkill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        if field in ("certified_date", "expiry_date") and isinstance(value, str):
            setattr(skill, field, date_type.fromisoformat(value))
        else:
            setattr(skill, field, value)
    await db.commit()
    await db.refresh(skill)
    return skill


@router.delete("/skills/{skill_id}", status_code=204)
async def delete_skill(skill_id: uuid.UUID, db: DBSession, user: CurrentUser):
    result = await db.execute(select(OperatorSkill).where(OperatorSkill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    skill.is_active = False
    await db.commit()


@router.get("/skills/matrix")
async def skills_matrix(db: DBSession, user: CurrentUser):
    """
    Return skills matrix: employee × skill → proficiency level.
    Groups by (employee_id, skill_name) since one employee can have multiple skills.
    """
    result = await db.execute(
        select(
            OperatorSkill.employee_id,
            OperatorSkill.skill_name,
            OperatorSkill.proficiency_level,
            OperatorSkill.expiry_date,
        ).where(OperatorSkill.is_active.is_(True))
        .order_by(OperatorSkill.employee_id, OperatorSkill.skill_name)
    )
    rows = result.all()

    # Build matrix: { employee_id: { skill_name: { level, expiry } } }
    matrix: dict[str, dict[str, dict]] = {}
    skills_set: set[str] = set()
    for row in rows:
        emp_id = str(row.employee_id)
        skills_set.add(row.skill_name)
        matrix.setdefault(emp_id, {})[row.skill_name] = {
            "proficiency_level": row.proficiency_level,
            "expiry_date": row.expiry_date.isoformat() if row.expiry_date else None,
        }

    return {"employees": matrix, "skills": sorted(skills_set)}


@router.get("/skills/expiring")
async def expiring_certifications(    db: DBSession,
    user: CurrentUser,
    days: int = 30,
):
    """Return skills with certifications expiring within N days."""
    from datetime import timedelta
    today = date_type.today()
    cutoff = today + timedelta(days=days)
    result = await db.execute(
        select(OperatorSkill).where(
            OperatorSkill.is_active.is_(True),
            OperatorSkill.expiry_date.is_not(None),
            OperatorSkill.expiry_date <= cutoff,
        ).order_by(OperatorSkill.expiry_date)
    )
    expiring = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "employee_id": str(s.employee_id),
            "skill_name": s.skill_name,
            "proficiency_level": s.proficiency_level,
            "certification_number": s.certification_number,
            "expiry_date": s.expiry_date.isoformat() if s.expiry_date else None,
            "days_until_expiry": (s.expiry_date - today).days if s.expiry_date else None,
            "expired": s.expiry_date < today if s.expiry_date else False,
        }
        for s in expiring
    ]


# ─── Crew Assignments ─────────────────────────────────────────────────────────

@router.post("/crew", status_code=201)
async def create_crew_assignment(body: CrewAssignmentCreate, db: DBSession, user: CurrentUser):
    assignment = CrewAssignment(
        work_order_id=body.work_order_id,
        workstation_id=body.workstation_id,
        employee_id=body.employee_id,
        shift=body.shift,
        assignment_date=date_type.fromisoformat(body.assignment_date),
        role=body.role,
        start_time=body.start_time,
        end_time=body.end_time,
        hours_worked=Decimal("0"),
        timesheet_pushed=False,
        created_by=user.id,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return assignment


@router.get("/crew")
async def list_crew_assignments(
    db: DBSession,
    user: CurrentUser,
    work_order_id: uuid.UUID | None = None,
    workstation_id: uuid.UUID | None = None,
    employee_id: uuid.UUID | None = None,
    assignment_date: str | None = None,
):
    q = select(CrewAssignment)
    if work_order_id:
        q = q.where(CrewAssignment.work_order_id == work_order_id)
    if workstation_id:
        q = q.where(CrewAssignment.workstation_id == workstation_id)
    if employee_id:
        q = q.where(CrewAssignment.employee_id == employee_id)
    if assignment_date:
        q = q.where(CrewAssignment.assignment_date == date_type.fromisoformat(assignment_date))
    result = await db.execute(q.order_by(CrewAssignment.assignment_date.desc()))
    return result.scalars().all()


@router.post("/crew/{assignment_id}/log-hours")
async def log_hours(
    assignment_id: uuid.UUID,
    body: LogHoursPayload,
    db: DBSession,
    user: CurrentUser,
):
    result = await db.execute(select(CrewAssignment).where(CrewAssignment.id == assignment_id))
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    assignment.hours_worked = Decimal(str(body.hours_worked))
    if body.start_time:
        assignment.start_time = body.start_time
    if body.end_time:
        assignment.end_time = body.end_time
    await db.commit()
    await db.refresh(assignment)
    return assignment


@router.post("/crew/push-timesheet")
async def push_timesheet(
    body: TimesheetPushPayload,
    db: DBSession,
    user: CurrentUser,
):
    """
    Push crew assignment hours to HR attendance records.
    Publishes mfg.timesheet.push event for each assignment.
    """
    pushed = []
    for assignment_id in body.assignment_ids:
        result = await db.execute(select(CrewAssignment).where(CrewAssignment.id == assignment_id))
        assignment = result.scalar_one_or_none()
        if not assignment or assignment.timesheet_pushed:
            continue

        await event_bus.publish(
            "mfg.timesheet.push",
            {
                "assignment_id": str(assignment.id),
                "employee_id": str(assignment.employee_id),
                "work_order_id": str(assignment.work_order_id),
                "date": assignment.assignment_date.isoformat(),
                "hours_worked": float(assignment.hours_worked),
                "shift": assignment.shift,
                "role": assignment.role,
            },
        )
        assignment.timesheet_pushed = True
        pushed.append(str(assignment.id))

    await db.commit()
    return {"pushed": len(pushed), "assignment_ids": pushed}


# ─── Crew Schedule View ───────────────────────────────────────────────────────

@router.get("/crew/schedule")
async def crew_schedule(
    db: DBSession,
    user: CurrentUser,
    date_from: str | None = None,
    date_to: str | None = None,
    workstation_id: uuid.UUID | None = None,
):
    """Return crew assignments grouped by date for schedule display."""
    from datetime import timedelta
    today = date_type.today()
    d_from = date_type.fromisoformat(date_from) if date_from else today
    d_to = date_type.fromisoformat(date_to) if date_to else today + timedelta(days=7)

    q = select(CrewAssignment).where(
        CrewAssignment.assignment_date >= d_from,
        CrewAssignment.assignment_date <= d_to,
    )
    if workstation_id:
        q = q.where(CrewAssignment.workstation_id == workstation_id)
    result = await db.execute(q.order_by(CrewAssignment.assignment_date, CrewAssignment.shift))
    assignments = result.scalars().all()

    # Group by date
    grouped: dict[str, list] = {}
    for a in assignments:
        day = a.assignment_date.isoformat()
        grouped.setdefault(day, []).append(
            {
                "id": str(a.id),
                "employee_id": str(a.employee_id),
                "work_order_id": str(a.work_order_id),
                "workstation_id": str(a.workstation_id),
                "shift": a.shift,
                "role": a.role,
                "hours_worked": float(a.hours_worked),
                "timesheet_pushed": a.timesheet_pushed,
            }
        )
    return grouped
