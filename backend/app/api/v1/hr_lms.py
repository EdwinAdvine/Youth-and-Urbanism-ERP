"""HR LMS (Learning Management System) — Courses, Modules, Enrollments, Certifications."""

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.models.hr import Employee
from app.models.hr_phase2 import (
    Certification,
    Course,
    CourseEnrollment,
    CourseModule,
)

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _get_course_or_404(db, course_id: uuid.UUID) -> Course:
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course


async def _get_enrollment_or_404(db, enr_id: uuid.UUID) -> CourseEnrollment:
    result = await db.execute(
        select(CourseEnrollment).where(CourseEnrollment.id == enr_id)
    )
    enr = result.scalar_one_or_none()
    if enr is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")
    return enr


async def _get_employee_for_user(db, user_id: uuid.UUID) -> Employee | None:
    result = await db.execute(select(Employee).where(Employee.user_id == user_id))
    return result.scalar_one_or_none()


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

# -- Course schemas --


class CourseCreate(BaseModel):
    title: str
    description: str | None = None
    category: str | None = None
    level: str = "beginner"  # beginner, intermediate, advanced
    duration_hours: float = 0.0
    thumbnail_url: str | None = None
    skills_taught: list[str] | None = None
    prerequisites: list[str] | None = None
    is_mandatory: bool = False
    pass_score: int = Field(70, ge=0, le=100)


class CourseUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    level: str | None = None
    duration_hours: float | None = None
    thumbnail_url: str | None = None
    skills_taught: list[str] | None = None
    prerequisites: list[str] | None = None
    is_mandatory: bool | None = None
    pass_score: int | None = Field(None, ge=0, le=100)
    is_published: bool | None = None


class CourseOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    category: str | None
    level: str
    duration_hours: Any
    thumbnail_url: str | None
    skills_taught: list | None
    prerequisites: list | None
    is_mandatory: bool
    is_published: bool
    pass_score: int
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class CourseDetailOut(CourseOut):
    modules: list["CourseModuleOut"]
    enrollment_count: int


# -- Course Module schemas --


class CourseModuleCreate(BaseModel):
    title: str
    module_type: str = "video"  # video, document, quiz, scorm
    content_url: str | None = None
    file_id: uuid.UUID | None = None
    duration_minutes: int = 0
    quiz_questions: list[dict] | None = None
    order_index: int = 0
    is_required: bool = True


class CourseModuleUpdate(BaseModel):
    title: str | None = None
    module_type: str | None = None
    content_url: str | None = None
    file_id: uuid.UUID | None = None
    duration_minutes: int | None = None
    quiz_questions: list[dict] | None = None
    order_index: int | None = None
    is_required: bool | None = None


class CourseModuleOut(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    module_type: str
    content_url: str | None
    file_id: uuid.UUID | None
    duration_minutes: int
    quiz_questions: list | None
    order_index: int
    is_required: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Enrollment schemas --


class EnrollmentCreate(BaseModel):
    course_id: uuid.UUID
    employee_id: uuid.UUID | None = None  # None = self-enroll


class EnrollmentProgressUpdate(BaseModel):
    module_id: uuid.UUID
    quiz_answers: list[int] | None = None  # index of chosen option per question


class EnrollmentOut(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    employee_id: uuid.UUID
    enrolled_by: uuid.UUID | None
    progress_pct: int
    quiz_score: int | None
    status: str
    started_at: Any
    completed_at: Any
    certificate_url: str | None
    modules_completed: list | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Certification schemas --


class CertificationCreate(BaseModel):
    employee_id: uuid.UUID
    name: str
    issuer: str | None = None
    credential_id: str | None = None
    issue_date: date
    expiry_date: date | None = None
    file_id: uuid.UUID | None = None
    course_id: uuid.UUID | None = None
    is_verified: bool = False


class CertificationUpdate(BaseModel):
    name: str | None = None
    issuer: str | None = None
    credential_id: str | None = None
    issue_date: date | None = None
    expiry_date: date | None = None
    file_id: uuid.UUID | None = None
    course_id: uuid.UUID | None = None
    is_verified: bool | None = None


class CertificationOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    name: str
    issuer: str | None
    credential_id: str | None
    issue_date: date
    expiry_date: date | None
    file_id: uuid.UUID | None
    course_id: uuid.UUID | None
    is_verified: bool
    verified_by: uuid.UUID | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# Update forward ref
CourseDetailOut.model_rebuild()


# ── Courses (8 endpoints) ─────────────────────────────────────────────────────


@router.get("/courses")
async def list_courses(
    current_user: CurrentUser,
    db: DBSession,
    category: str | None = Query(None),
    level: str | None = Query(None),
    is_mandatory: bool | None = Query(None),
    is_published: bool | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """List courses with optional filters. Paginated."""
    query = select(Course)

    if category:
        query = query.where(Course.category == category)
    if level:
        query = query.where(Course.level == level)
    if is_mandatory is not None:
        query = query.where(Course.is_mandatory.is_(is_mandatory))
    if is_published is not None:
        query = query.where(Course.is_published.is_(is_published))
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(Course.title.ilike(pattern), Course.description.ilike(pattern))
        )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Course.is_mandatory.desc(), Course.created_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)
    courses = (await db.execute(query)).scalars().all()

    return {
        "items": [CourseOut.model_validate(c) for c in courses],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("/courses", status_code=status.HTTP_201_CREATED)
async def create_course(
    body: CourseCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Create a new LMS course (HR admin only)."""
    course = Course(
        title=body.title,
        description=body.description,
        category=body.category,
        level=body.level,
        duration_hours=body.duration_hours,
        thumbnail_url=body.thumbnail_url,
        skills_taught=body.skills_taught,
        prerequisites=body.prerequisites,
        is_mandatory=body.is_mandatory,
        pass_score=body.pass_score,
        is_published=False,
        created_by=current_user.id,
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return CourseOut.model_validate(course)


@router.get("/courses/recommended")
async def recommended_courses(
    current_user: CurrentUser,
    db: DBSession,
):
    """Return published courses not yet enrolled in by the current user, ordered by is_mandatory desc."""
    # Look up employee record for current user
    emp = await _get_employee_for_user(db, current_user.id)
    if emp is None:
        # No employee profile — return all published courses ordered by mandatory first
        result = await db.execute(
            select(Course)
            .where(Course.is_published.is_(True))
            .order_by(Course.is_mandatory.desc(), Course.created_at.desc())
        )
        courses = result.scalars().all()
        return {
            "items": [CourseOut.model_validate(c) for c in courses],
            "total": len(courses),
        }

    # Get course IDs the employee is already enrolled in
    enrolled_q = select(CourseEnrollment.course_id).where(
        CourseEnrollment.employee_id == emp.id
    )
    enrolled_ids_result = await db.execute(enrolled_q)
    enrolled_ids = {row[0] for row in enrolled_ids_result.all()}

    # Return published courses not in the enrolled set
    query = select(Course).where(
        and_(
            Course.is_published.is_(True),
            Course.id.not_in(enrolled_ids) if enrolled_ids else True,
        )
    ).order_by(Course.is_mandatory.desc(), Course.created_at.desc())

    courses = (await db.execute(query)).scalars().all()
    return {
        "items": [CourseOut.model_validate(c) for c in courses],
        "total": len(courses),
    }


@router.get("/courses/{course_id}")
async def get_course(
    course_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """Get course detail including modules and enrollment count."""
    course = await _get_course_or_404(db, course_id)

    # Enrollment count
    count_result = await db.execute(
        select(func.count(CourseEnrollment.id)).where(
            CourseEnrollment.course_id == course_id
        )
    )
    enrollment_count = count_result.scalar() or 0

    # Modules ordered by order_index
    mod_result = await db.execute(
        select(CourseModule)
        .where(CourseModule.course_id == course_id)
        .order_by(CourseModule.order_index)
    )
    modules = mod_result.scalars().all()

    data = CourseOut.model_validate(course).model_dump()
    data["modules"] = [CourseModuleOut.model_validate(m) for m in modules]
    data["enrollment_count"] = enrollment_count
    return data


@router.put("/courses/{course_id}")
async def update_course(
    course_id: uuid.UUID,
    body: CourseUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Update a course (HR admin only)."""
    course = await _get_course_or_404(db, course_id)

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(course, field, value)

    await db.commit()
    await db.refresh(course)
    return CourseOut.model_validate(course)


@router.delete("/courses/{course_id}", status_code=status.HTTP_200_OK)
async def delete_course(
    course_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Delete a course. Rejected if active enrollments exist."""
    course = await _get_course_or_404(db, course_id)

    active_count_result = await db.execute(
        select(func.count(CourseEnrollment.id)).where(
            and_(
                CourseEnrollment.course_id == course_id,
                CourseEnrollment.status.in_(["enrolled", "in_progress"]),
            )
        )
    )
    active_count = active_count_result.scalar() or 0
    if active_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete course with {active_count} active enrollment(s). "
                   "Archive or complete them first.",
        )

    await db.delete(course)
    await db.commit()


@router.post("/courses/{course_id}/publish")
async def publish_course(
    course_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Publish a course (set is_published=True)."""
    course = await _get_course_or_404(db, course_id)

    if course.is_published:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Course is already published",
        )

    course.is_published = True
    await db.commit()
    await db.refresh(course)

    await event_bus.publish(
        "lms.course_published",
        {"course_id": str(course_id), "title": course.title},
    )

    return CourseOut.model_validate(course)


@router.get("/courses/{course_id}/leaderboard")
async def course_leaderboard(
    course_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """Top 10 completers for a course ranked by quiz_score descending."""
    await _get_course_or_404(db, course_id)

    result = await db.execute(
        select(CourseEnrollment)
        .where(
            and_(
                CourseEnrollment.course_id == course_id,
                CourseEnrollment.status == "completed",
                CourseEnrollment.quiz_score.is_not(None),
            )
        )
        .order_by(CourseEnrollment.quiz_score.desc(), CourseEnrollment.completed_at.asc())
        .limit(10)
    )
    enrollments = result.scalars().all()

    items = []
    for rank, enr in enumerate(enrollments, start=1):
        items.append(
            {
                "rank": rank,
                "enrollment_id": str(enr.id),
                "employee_id": str(enr.employee_id),
                "quiz_score": enr.quiz_score,
                "completed_at": enr.completed_at,
            }
        )

    return {"course_id": str(course_id), "items": items, "total": len(items)}


# ── Course Modules (4 endpoints) ──────────────────────────────────────────────


@router.get("/courses/{course_id}/modules")
async def list_course_modules(
    course_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """List all modules for a course in order."""
    await _get_course_or_404(db, course_id)

    result = await db.execute(
        select(CourseModule)
        .where(CourseModule.course_id == course_id)
        .order_by(CourseModule.order_index)
    )
    modules = result.scalars().all()
    return {"items": [CourseModuleOut.model_validate(m) for m in modules], "total": len(modules)}


@router.post("/courses/{course_id}/modules", status_code=status.HTTP_201_CREATED)
async def create_course_module(
    course_id: uuid.UUID,
    body: CourseModuleCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Add a module to a course (HR admin only)."""
    await _get_course_or_404(db, course_id)

    module = CourseModule(
        course_id=course_id,
        title=body.title,
        module_type=body.module_type,
        content_url=body.content_url,
        file_id=body.file_id,
        duration_minutes=body.duration_minutes,
        quiz_questions=body.quiz_questions,
        order_index=body.order_index,
        is_required=body.is_required,
    )
    db.add(module)
    await db.commit()
    await db.refresh(module)
    return CourseModuleOut.model_validate(module)


@router.put("/courses/{course_id}/modules/{mod_id}")
async def update_course_module(
    course_id: uuid.UUID,
    mod_id: uuid.UUID,
    body: CourseModuleUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Update a course module (HR admin only)."""
    result = await db.execute(
        select(CourseModule).where(
            and_(CourseModule.id == mod_id, CourseModule.course_id == course_id)
        )
    )
    module = result.scalar_one_or_none()
    if module is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(module, field, value)

    await db.commit()
    await db.refresh(module)
    return CourseModuleOut.model_validate(module)


@router.delete("/courses/{course_id}/modules/{mod_id}", status_code=status.HTTP_200_OK)
async def delete_course_module(
    course_id: uuid.UUID,
    mod_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Delete a course module (HR admin only)."""
    result = await db.execute(
        select(CourseModule).where(
            and_(CourseModule.id == mod_id, CourseModule.course_id == course_id)
        )
    )
    module = result.scalar_one_or_none()
    if module is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found")

    await db.delete(module)
    await db.commit()


# ── Enrollments (6 endpoints) ─────────────────────────────────────────────────


@router.get("/enrollments")
async def list_enrollments(
    current_user: CurrentUser,
    db: DBSession,
    course_id: uuid.UUID | None = Query(None),
    employee_id: uuid.UUID | None = Query(None),
    enrollment_status: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """List enrollments. Admins see all; regular users see only their own."""
    query = select(CourseEnrollment)

    # Non-admin users see only their own enrollments
    if not current_user.is_superadmin:
        emp = await _get_employee_for_user(db, current_user.id)
        if emp is not None:
            query = query.where(CourseEnrollment.employee_id == emp.id)
        # If no employee record, return empty
        else:
            return {"items": [], "total": 0, "page": page, "limit": limit}

    if course_id:
        query = query.where(CourseEnrollment.course_id == course_id)
    if employee_id and current_user.is_superadmin:
        query = query.where(CourseEnrollment.employee_id == employee_id)
    if enrollment_status:
        query = query.where(CourseEnrollment.status == enrollment_status)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(CourseEnrollment.created_at.desc()).offset((page - 1) * limit).limit(limit)
    enrollments = (await db.execute(query)).scalars().all()

    return {
        "items": [EnrollmentOut.model_validate(e) for e in enrollments],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("/enrollments", status_code=status.HTTP_201_CREATED)
async def create_enrollment(
    body: EnrollmentCreate,
    current_user: CurrentUser,
    db: DBSession,
):
    """Enroll an employee in a course.

    - Admins can specify any employee_id.
    - Regular users enroll themselves (employee_id derived from their user record).
    """
    # Resolve target employee
    if body.employee_id and current_user.is_superadmin:
        emp_result = await db.execute(
            select(Employee).where(Employee.id == body.employee_id)
        )
        emp = emp_result.scalar_one_or_none()
        if emp is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    else:
        emp = await _get_employee_for_user(db, current_user.id)
        if emp is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No employee profile found for current user",
            )

    # Verify course exists and is published
    course = await _get_course_or_404(db, body.course_id)
    if not course.is_published:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot enroll in an unpublished course",
        )

    # Check for existing enrollment
    existing = await db.execute(
        select(CourseEnrollment).where(
            and_(
                CourseEnrollment.course_id == body.course_id,
                CourseEnrollment.employee_id == emp.id,
            )
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Employee is already enrolled in this course",
        )

    enrollment = CourseEnrollment(
        course_id=body.course_id,
        employee_id=emp.id,
        enrolled_by=current_user.id,
        progress_pct=0,
        status="enrolled",
        modules_completed=[],
    )
    db.add(enrollment)
    await db.commit()
    await db.refresh(enrollment)

    await event_bus.publish(
        "lms.course_enrolled",
        {
            "enrollment_id": str(enrollment.id),
            "course_id": str(body.course_id),
            "employee_id": str(emp.id),
        },
    )

    return EnrollmentOut.model_validate(enrollment)


@router.get("/enrollments/{enr_id}")
async def get_enrollment(
    enr_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """Get enrollment detail."""
    enr = await _get_enrollment_or_404(db, enr_id)

    # Non-admin: verify access (must be the enrolled employee)
    if not current_user.is_superadmin:
        emp = await _get_employee_for_user(db, current_user.id)
        if emp is None or enr.employee_id != emp.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return EnrollmentOut.model_validate(enr)


@router.put("/enrollments/{enr_id}/progress")
async def update_enrollment_progress(
    enr_id: uuid.UUID,
    body: EnrollmentProgressUpdate,
    current_user: CurrentUser,
    db: DBSession,
):
    """Update enrollment progress when a learner completes a module.

    - Marks the module as completed.
    - Recalculates progress_pct based on required modules.
    - If quiz_answers provided and all required modules done, computes quiz_score.
    - Sets status=completed or failed based on pass_score; publishes lms.course_completed.
    """
    enr = await _get_enrollment_or_404(db, enr_id)

    # Non-admin: must be the enrolled employee
    if not current_user.is_superadmin:
        emp = await _get_employee_for_user(db, current_user.id)
        if emp is None or enr.employee_id != emp.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if enr.status in ("completed", "failed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Enrollment is already {enr.status}",
        )

    # Verify the module belongs to the course
    mod_result = await db.execute(
        select(CourseModule).where(
            and_(
                CourseModule.id == body.module_id,
                CourseModule.course_id == enr.course_id,
            )
        )
    )
    module = mod_result.scalar_one_or_none()
    if module is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module not found in this course",
        )

    # Update modules_completed list
    completed = list(enr.modules_completed or [])
    module_id_str = str(body.module_id)
    if module_id_str not in completed:
        completed.append(module_id_str)
    enr.modules_completed = completed

    # Transition to in_progress if not already
    if enr.status == "enrolled":
        enr.status = "in_progress"
        enr.started_at = datetime.now(timezone.utc)

    # Recalculate progress_pct from required modules
    all_modules_result = await db.execute(
        select(CourseModule).where(CourseModule.course_id == enr.course_id)
    )
    all_modules = all_modules_result.scalars().all()
    required_modules = [m for m in all_modules if m.is_required]
    total_required = len(required_modules)
    required_ids = {str(m.id) for m in required_modules}

    if total_required > 0:
        completed_required = len(required_ids.intersection(set(completed)))
        enr.progress_pct = int((completed_required / total_required) * 100)
    else:
        # No required modules — treat any completion as 100%
        enr.progress_pct = 100 if completed else 0

    # Check if all required modules are done
    all_required_done = required_ids.issubset(set(completed))

    if all_required_done:
        # Compute quiz score if quiz_answers provided
        if body.quiz_answers is not None:
            quiz_module = next(
                (m for m in all_modules if m.module_type == "quiz" and m.quiz_questions),
                None,
            )
            if quiz_module and quiz_module.quiz_questions:
                questions = quiz_module.quiz_questions
                total_points = sum(q.get("points", 1) for q in questions)
                earned_points = 0
                for i, q in enumerate(questions):
                    if i < len(body.quiz_answers):
                        if body.quiz_answers[i] == q.get("correct_index"):
                            earned_points += q.get("points", 1)
                enr.quiz_score = (
                    int((earned_points / total_points) * 100) if total_points > 0 else 0
                )
            else:
                # No quiz module — treat as 100%
                enr.quiz_score = 100
        else:
            # No quiz answers submitted — score defaults to None (pass if pass_score=0)
            enr.quiz_score = None

        # Get course pass_score
        course_result = await db.execute(select(Course).where(Course.id == enr.course_id))
        course = course_result.scalar_one_or_none()
        pass_score = course.pass_score if course else 70

        score = enr.quiz_score if enr.quiz_score is not None else 100
        if score >= pass_score:
            enr.status = "completed"
            enr.completed_at = datetime.now(timezone.utc)
            enr.progress_pct = 100

            await event_bus.publish(
                "lms.course_completed",
                {
                    "enrollment_id": str(enr.id),
                    "course_id": str(enr.course_id),
                    "employee_id": str(enr.employee_id),
                    "quiz_score": enr.quiz_score,
                },
            )
        else:
            enr.status = "failed"

    await db.commit()
    await db.refresh(enr)
    return EnrollmentOut.model_validate(enr)


@router.get("/employees/{emp_id}/learning-path")
async def employee_learning_path(
    emp_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """Return all enrollments + recommended (unenrolled published) courses for an employee."""
    # Verify employee exists
    emp_result = await db.execute(select(Employee).where(Employee.id == emp_id))
    emp = emp_result.scalar_one_or_none()
    if emp is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    # Non-admin: can only view own learning path
    if not current_user.is_superadmin:
        current_emp = await _get_employee_for_user(db, current_user.id)
        if current_emp is None or current_emp.id != emp_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # All enrollments for this employee
    enr_result = await db.execute(
        select(CourseEnrollment)
        .where(CourseEnrollment.employee_id == emp_id)
        .order_by(CourseEnrollment.created_at.desc())
    )
    enrollments = enr_result.scalars().all()
    enrolled_course_ids = {str(e.course_id) for e in enrollments}

    # Recommended: published, not enrolled
    query = select(Course).where(
        and_(
            Course.is_published.is_(True),
            Course.id.not_in([e.course_id for e in enrollments]) if enrollments else True,
        )
    ).order_by(Course.is_mandatory.desc(), Course.created_at.desc())
    recommended = (await db.execute(query)).scalars().all()

    return {
        "employee_id": str(emp_id),
        "enrollments": [EnrollmentOut.model_validate(e) for e in enrollments],
        "recommended_courses": [CourseOut.model_validate(c) for c in recommended],
        "enrolled_count": len(enrollments),
        "recommended_count": len(recommended),
    }


@router.get("/lms/dashboard")
async def lms_dashboard(
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """LMS summary stats: total courses, enrolled employees, completions this month, etc."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Total published courses
    total_courses_result = await db.execute(
        select(func.count(Course.id)).where(Course.is_published.is_(True))
    )
    total_courses = total_courses_result.scalar() or 0

    # Enrolled employees (distinct)
    enrolled_emp_result = await db.execute(
        select(func.count(func.distinct(CourseEnrollment.employee_id)))
    )
    enrolled_employees = enrolled_emp_result.scalar() or 0

    # Completions this month
    completions_result = await db.execute(
        select(func.count(CourseEnrollment.id)).where(
            and_(
                CourseEnrollment.status == "completed",
                CourseEnrollment.completed_at >= month_start,
            )
        )
    )
    completions_this_month = completions_result.scalar() or 0

    # Average completion percentage (across all active/completed enrollments)
    avg_pct_result = await db.execute(
        select(func.round(func.avg(CourseEnrollment.progress_pct), 1))
    )
    avg_completion_pct = float(avg_pct_result.scalar() or 0)

    # Top 5 courses by enrollment count
    top_courses_result = await db.execute(
        select(
            Course.id,
            Course.title,
            func.count(CourseEnrollment.id).label("enrollment_count"),
        )
        .join(CourseEnrollment, CourseEnrollment.course_id == Course.id, isouter=True)
        .group_by(Course.id, Course.title)
        .order_by(func.count(CourseEnrollment.id).desc())
        .limit(5)
    )
    top_courses = [
        {
            "course_id": str(row.id),
            "title": row.title,
            "enrollment_count": row.enrollment_count,
        }
        for row in top_courses_result.all()
    ]

    return {
        "total_courses": total_courses,
        "enrolled_employees": enrolled_employees,
        "completions_this_month": completions_this_month,
        "avg_completion_pct": avg_completion_pct,
        "top_courses": top_courses,
    }


# ── Certifications (6 endpoints) ──────────────────────────────────────────────


@router.get("/certifications")
async def list_certifications(
    current_user: CurrentUser,
    db: DBSession,
    employee_id: uuid.UUID | None = Query(None),
    expiring_soon: bool = Query(False),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """List certifications with optional filters. Paginated."""
    query = select(Certification)

    if employee_id:
        query = query.where(Certification.employee_id == employee_id)

    if expiring_soon:
        today = date.today()
        threshold = today + timedelta(days=30)
        query = query.where(
            and_(
                Certification.expiry_date.is_not(None),
                Certification.expiry_date >= today,
                Certification.expiry_date <= threshold,
            )
        )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Certification.expiry_date.asc().nullslast(), Certification.created_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)
    certs = (await db.execute(query)).scalars().all()

    return {
        "items": [CertificationOut.model_validate(c) for c in certs],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("/certifications", status_code=status.HTTP_201_CREATED)
async def create_certification(
    body: CertificationCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Create a certification record (HR admin only). Can be LMS-linked or manual."""
    # Verify employee exists
    emp_result = await db.execute(select(Employee).where(Employee.id == body.employee_id))
    if emp_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    # If course_id provided, verify it exists
    if body.course_id:
        await _get_course_or_404(db, body.course_id)

    cert = Certification(
        employee_id=body.employee_id,
        name=body.name,
        issuer=body.issuer,
        credential_id=body.credential_id,
        issue_date=body.issue_date,
        expiry_date=body.expiry_date,
        file_id=body.file_id,
        course_id=body.course_id,
        is_verified=body.is_verified,
        verified_by=current_user.id if body.is_verified else None,
    )
    db.add(cert)
    await db.commit()
    await db.refresh(cert)
    return CertificationOut.model_validate(cert)


@router.get("/certifications/expiring")
async def expiring_certifications(
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
    days: int = Query(30, ge=1, le=365),
):
    """List all certifications expiring within the next N days (default 30)."""
    today = date.today()
    threshold = today + timedelta(days=days)

    result = await db.execute(
        select(Certification)
        .where(
            and_(
                Certification.expiry_date.is_not(None),
                Certification.expiry_date >= today,
                Certification.expiry_date <= threshold,
            )
        )
        .order_by(Certification.expiry_date.asc())
    )
    certs = result.scalars().all()

    return {
        "days_ahead": days,
        "items": [CertificationOut.model_validate(c) for c in certs],
        "total": len(certs),
    }


@router.get("/certifications/{cert_id}")
async def get_certification(
    cert_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """Get a single certification record."""
    result = await db.execute(select(Certification).where(Certification.id == cert_id))
    cert = result.scalar_one_or_none()
    if cert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certification not found")
    return CertificationOut.model_validate(cert)


@router.put("/certifications/{cert_id}")
async def update_certification(
    cert_id: uuid.UUID,
    body: CertificationUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Update a certification (HR admin only)."""
    result = await db.execute(select(Certification).where(Certification.id == cert_id))
    cert = result.scalar_one_or_none()
    if cert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certification not found")

    update_data = body.model_dump(exclude_unset=True)

    # If is_verified is being set to True, record who verified it
    if update_data.get("is_verified") is True and not cert.is_verified:
        cert.verified_by = current_user.id
    elif update_data.get("is_verified") is False:
        cert.verified_by = None

    for field, value in update_data.items():
        setattr(cert, field, value)

    await db.commit()
    await db.refresh(cert)
    return CertificationOut.model_validate(cert)


@router.delete("/certifications/{cert_id}", status_code=status.HTTP_200_OK)
async def delete_certification(
    cert_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Delete a certification record (HR admin only)."""
    result = await db.execute(select(Certification).where(Certification.id == cert_id))
    cert = result.scalar_one_or_none()
    if cert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certification not found")

    await db.delete(cert)
    await db.commit()
