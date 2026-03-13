"""HR Skills, Succession Plans, Employee Timeline & Document Versions API."""

import uuid
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, select

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.models.hr import Department, Employee, EmployeeDocument
from app.models.hr_phase1 import (
    DocumentVersion,
    EmployeeActivityLog,
    EmployeeSkill,
    EmployeeSuccessionPlan,
)

router = APIRouter()


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


# ── Pydantic schemas ─────────────────────────────────────────────────────────

# -- Skill schemas --


class SkillCreate(BaseModel):
    skill_name: str
    category: str  # technical, soft, leadership, domain
    proficiency_level: int = Field(..., ge=1, le=5)
    years_experience: Decimal | None = None


class SkillUpdate(BaseModel):
    skill_name: str | None = None
    category: str | None = None
    proficiency_level: int | None = Field(None, ge=1, le=5)
    years_experience: Decimal | None = None


class SkillOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    skill_name: str
    category: str
    proficiency_level: int
    years_experience: Decimal | None
    verified_by: uuid.UUID | None
    verified_at: Any
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Succession Plan schemas --


class SuccessionPlanCreate(BaseModel):
    position_title: str
    department_id: uuid.UUID
    current_holder_id: uuid.UUID | None = None
    successor_id: uuid.UUID
    readiness: str = "developing"  # ready_now, ready_1yr, ready_2yr, developing
    priority: str = "medium"  # critical, high, medium, low
    development_notes: str | None = None


class SuccessionPlanUpdate(BaseModel):
    position_title: str | None = None
    successor_id: uuid.UUID | None = None
    readiness: str | None = None
    priority: str | None = None
    development_notes: str | None = None


class SuccessionPlanOut(BaseModel):
    id: uuid.UUID
    position_title: str
    department_id: uuid.UUID
    current_holder_id: uuid.UUID | None
    successor_id: uuid.UUID
    readiness: str
    priority: str
    development_notes: str | None
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Activity Log schemas --


class ActivityLogOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    activity_type: str
    title: str
    description: str | None
    source_module: str
    source_id: uuid.UUID | None
    metadata_json: dict | None
    occurred_at: Any
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Document Version schemas --


class DocumentVersionCreate(BaseModel):
    file_id: uuid.UUID
    file_name: str
    file_size: int | None = None
    change_notes: str | None = None


class DocumentVersionOut(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    version_number: int
    file_id: uuid.UUID
    file_name: str
    file_size: int | None
    change_notes: str | None
    uploaded_by: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Employee Skills (4 endpoints) ────────────────────────────────────────────


@router.get("/employees/{employee_id}/skills")
async def list_employee_skills(
    employee_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """List all skills for an employee."""
    result = await db.execute(
        select(EmployeeSkill)
        .where(EmployeeSkill.employee_id == employee_id)
        .order_by(EmployeeSkill.category, EmployeeSkill.skill_name)
    )
    skills = result.scalars().all()
    return {"items": [SkillOut.model_validate(s) for s in skills], "total": len(skills)}


@router.post("/employees/{employee_id}/skills", status_code=status.HTTP_201_CREATED)
async def add_employee_skill(
    employee_id: uuid.UUID,
    body: SkillCreate,
    current_user: CurrentUser,
    db: DBSession,
):
    """Add a skill to an employee (admin or self)."""
    # Verify employee exists
    emp_result = await db.execute(
        select(Employee).where(Employee.id == employee_id)
    )
    employee = emp_result.scalar_one_or_none()
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    skill = EmployeeSkill(
        employee_id=employee_id,
        skill_name=body.skill_name,
        category=body.category,
        proficiency_level=body.proficiency_level,
        years_experience=body.years_experience,
    )
    db.add(skill)
    await db.commit()
    await db.refresh(skill)

    # Publish event
    await event_bus.publish(
        "employee.skill_added",
        {
            "employee_id": str(employee_id),
            "skill_name": body.skill_name,
            "proficiency_level": body.proficiency_level,
        },
    )

    return SkillOut.model_validate(skill)


@router.put("/employees/{employee_id}/skills/{skill_id}")
async def update_employee_skill(
    employee_id: uuid.UUID,
    skill_id: uuid.UUID,
    body: SkillUpdate,
    current_user: CurrentUser,
    db: DBSession,
):
    """Update a skill for an employee."""
    result = await db.execute(
        select(EmployeeSkill).where(
            and_(EmployeeSkill.id == skill_id, EmployeeSkill.employee_id == employee_id)
        )
    )
    skill = result.scalar_one_or_none()
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(skill, field, value)

    await db.commit()
    await db.refresh(skill)
    return SkillOut.model_validate(skill)


@router.delete("/employees/{employee_id}/skills/{skill_id}", status_code=status.HTTP_200_OK)
async def delete_employee_skill(
    employee_id: uuid.UUID,
    skill_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """Remove a skill from an employee."""
    result = await db.execute(
        select(EmployeeSkill).where(
            and_(EmployeeSkill.id == skill_id, EmployeeSkill.employee_id == employee_id)
        )
    )
    skill = result.scalar_one_or_none()
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")

    await db.delete(skill)
    await db.commit()


# ── Skills Matrix (2 endpoints) ──────────────────────────────────────────────


@router.get("/skills/matrix")
async def skills_matrix(
    current_user: CurrentUser,
    db: DBSession,
    department_id: uuid.UUID | None = Query(None),
    category: str | None = Query(None),
    skill_name: str | None = Query(None),
):
    """Org-wide skills matrix — aggregated skill data."""
    query = (
        select(
            EmployeeSkill.skill_name,
            EmployeeSkill.category,
            func.count(EmployeeSkill.id).label("employee_count"),
            func.round(func.avg(EmployeeSkill.proficiency_level), 1).label("avg_proficiency"),
        )
        .join(Employee, Employee.id == EmployeeSkill.employee_id)
    )

    if department_id:
        query = query.where(Employee.department_id == department_id)
    if category:
        query = query.where(EmployeeSkill.category == category)
    if skill_name:
        query = query.where(EmployeeSkill.skill_name.ilike(f"%{skill_name}%"))

    query = query.group_by(EmployeeSkill.skill_name, EmployeeSkill.category).order_by(
        EmployeeSkill.category, EmployeeSkill.skill_name
    )

    result = await db.execute(query)
    rows = result.all()

    items = [
        {
            "skill_name": row.skill_name,
            "category": row.category,
            "employee_count": row.employee_count,
            "avg_proficiency": float(row.avg_proficiency) if row.avg_proficiency else 0,
        }
        for row in rows
    ]
    return {"items": items, "total": len(items)}


@router.get("/skills/gap-analysis/{department_id}")
async def skills_gap_analysis(
    department_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """Skills gap analysis for a department.

    Compares current skills distribution in the department vs the org-wide
    average to identify gaps.
    """
    # Verify department exists
    dept_result = await db.execute(select(Department).where(Department.id == department_id))
    department = dept_result.scalar_one_or_none()
    if department is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    # Current skills in the department
    dept_skills_query = (
        select(
            EmployeeSkill.skill_name,
            EmployeeSkill.category,
            func.count(EmployeeSkill.id).label("employee_count"),
            func.round(func.avg(EmployeeSkill.proficiency_level), 1).label("avg_proficiency"),
        )
        .join(Employee, Employee.id == EmployeeSkill.employee_id)
        .where(Employee.department_id == department_id)
        .group_by(EmployeeSkill.skill_name, EmployeeSkill.category)
    )
    dept_result = await db.execute(dept_skills_query)
    dept_rows = dept_result.all()
    dept_skills = {row.skill_name: row for row in dept_rows}

    # Org-wide skill averages (for comparison)
    org_skills_query = (
        select(
            EmployeeSkill.skill_name,
            EmployeeSkill.category,
            func.round(func.avg(EmployeeSkill.proficiency_level), 1).label("org_avg_proficiency"),
            func.count(EmployeeSkill.id).label("org_employee_count"),
        )
        .group_by(EmployeeSkill.skill_name, EmployeeSkill.category)
    )
    org_result = await db.execute(org_skills_query)
    org_rows = org_result.all()

    # Employee count in department
    emp_count_result = await db.execute(
        select(func.count(Employee.id)).where(
            and_(Employee.department_id == department_id, Employee.is_active.is_(True))
        )
    )
    dept_employee_count = emp_count_result.scalar() or 0

    gaps = []
    for org_row in org_rows:
        dept_row = dept_skills.get(org_row.skill_name)
        dept_avg = float(dept_row.avg_proficiency) if dept_row else 0
        dept_count = dept_row.employee_count if dept_row else 0
        org_avg = float(org_row.org_avg_proficiency) if org_row.org_avg_proficiency else 0

        gap = round(org_avg - dept_avg, 1)
        gaps.append(
            {
                "skill_name": org_row.skill_name,
                "category": org_row.category,
                "department_avg_proficiency": dept_avg,
                "org_avg_proficiency": org_avg,
                "gap": gap,
                "department_employee_count": dept_count,
                "org_employee_count": org_row.org_employee_count,
            }
        )

    # Sort by gap descending (biggest gaps first)
    gaps.sort(key=lambda x: x["gap"], reverse=True)

    return {
        "department_id": str(department_id),
        "department_name": department.name,
        "department_employee_count": dept_employee_count,
        "items": gaps,
        "total": len(gaps),
    }


# ── Succession Plans (4 endpoints) ───────────────────────────────────────────


@router.get("/succession-plans")
async def list_succession_plans(
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
    department_id: uuid.UUID | None = Query(None),
    priority: str | None = Query(None),
    readiness: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """List all succession plans (admin only)."""
    query = select(EmployeeSuccessionPlan)

    if department_id:
        query = query.where(EmployeeSuccessionPlan.department_id == department_id)
    if priority:
        query = query.where(EmployeeSuccessionPlan.priority == priority)
    if readiness:
        query = query.where(EmployeeSuccessionPlan.readiness == readiness)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Page
    query = query.order_by(EmployeeSuccessionPlan.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    plans = result.scalars().all()

    return {
        "items": [SuccessionPlanOut.model_validate(p) for p in plans],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("/succession-plans", status_code=status.HTTP_201_CREATED)
async def create_succession_plan(
    body: SuccessionPlanCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Create a succession plan (admin only)."""
    plan = EmployeeSuccessionPlan(
        position_title=body.position_title,
        department_id=body.department_id,
        current_holder_id=body.current_holder_id,
        successor_id=body.successor_id,
        readiness=body.readiness,
        priority=body.priority,
        development_notes=body.development_notes,
        created_by=current_user.id,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return SuccessionPlanOut.model_validate(plan)


@router.put("/succession-plans/{plan_id}")
async def update_succession_plan(
    plan_id: uuid.UUID,
    body: SuccessionPlanUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Update a succession plan (admin only)."""
    result = await db.execute(
        select(EmployeeSuccessionPlan).where(EmployeeSuccessionPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Succession plan not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(plan, field, value)

    await db.commit()
    await db.refresh(plan)
    return SuccessionPlanOut.model_validate(plan)


@router.delete("/succession-plans/{plan_id}", status_code=status.HTTP_200_OK)
async def delete_succession_plan(
    plan_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Delete a succession plan (admin only)."""
    result = await db.execute(
        select(EmployeeSuccessionPlan).where(EmployeeSuccessionPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Succession plan not found")

    await db.delete(plan)
    await db.commit()


# ── Employee Timeline (1 endpoint) ───────────────────────────────────────────


@router.get("/employees/{employee_id}/timeline")
async def employee_timeline(
    employee_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    activity_type: str | None = Query(None),
    source_module: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """Paginated activity log for an employee."""
    query = select(EmployeeActivityLog).where(EmployeeActivityLog.employee_id == employee_id)

    if activity_type:
        query = query.where(EmployeeActivityLog.activity_type == activity_type)
    if source_module:
        query = query.where(EmployeeActivityLog.source_module == source_module)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Page — order by occurred_at desc
    query = query.order_by(EmployeeActivityLog.occurred_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()

    return {
        "items": [ActivityLogOut.model_validate(log) for log in logs],
        "total": total,
        "page": page,
        "limit": limit,
    }


# ── Document Versions (2 endpoints) ──────────────────────────────────────────


@router.get("/employees/{employee_id}/documents/{doc_id}/versions")
async def list_document_versions(
    employee_id: uuid.UUID,
    doc_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """List all versions for an employee document."""
    # Verify the document belongs to the employee
    doc_result = await db.execute(
        select(EmployeeDocument).where(
            and_(EmployeeDocument.id == doc_id, EmployeeDocument.employee_id == employee_id)
        )
    )
    document = doc_result.scalar_one_or_none()
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    result = await db.execute(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == doc_id)
        .order_by(DocumentVersion.version_number.desc())
    )
    versions = result.scalars().all()
    return {"items": [DocumentVersionOut.model_validate(v) for v in versions], "total": len(versions)}


@router.post(
    "/employees/{employee_id}/documents/{doc_id}/versions",
    status_code=status.HTTP_201_CREATED,
)
async def create_document_version(
    employee_id: uuid.UUID,
    doc_id: uuid.UUID,
    body: DocumentVersionCreate,
    current_user: CurrentUser,
    db: DBSession,
):
    """Upload a new version for an employee document (auto-increment version_number)."""
    # Verify the document belongs to the employee
    doc_result = await db.execute(
        select(EmployeeDocument).where(
            and_(EmployeeDocument.id == doc_id, EmployeeDocument.employee_id == employee_id)
        )
    )
    document = doc_result.scalar_one_or_none()
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Get latest version number
    max_ver_result = await db.execute(
        select(func.coalesce(func.max(DocumentVersion.version_number), 0)).where(
            DocumentVersion.document_id == doc_id
        )
    )
    max_version = max_ver_result.scalar() or 0

    version = DocumentVersion(
        document_id=doc_id,
        version_number=max_version + 1,
        file_id=body.file_id,
        file_name=body.file_name,
        file_size=body.file_size,
        change_notes=body.change_notes,
        uploaded_by=current_user.id,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)
    return DocumentVersionOut.model_validate(version)
