"""HR Enhanced Onboarding/Offboarding API — templates, tasks, buddy system, progress, exit."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import Integer, and_, func, select

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.models.hr import Employee
from app.models.hr_phase2 import BuddyAssignment, OnboardingTask, OnboardingTemplate

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────


class TemplateTaskCreate(BaseModel):
    title: str
    description: str | None = None
    category: str | None = None
    due_days_offset: int = 0
    order_index: int = 0
    assigned_to: uuid.UUID | None = None


class TemplateCreate(BaseModel):
    name: str
    template_type: str = "onboarding"
    department_id: uuid.UUID | None = None
    description: str | None = None
    tasks: list[TemplateTaskCreate] = []


class TemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    department_id: uuid.UUID | None = None
    is_active: bool | None = None


class TemplateTaskOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    category: str | None
    due_days_offset: int
    order_index: int
    assigned_to: uuid.UUID | None
    status: str
    due_date: date | None
    completed_at: datetime | None
    notes: str | None

    model_config = {"from_attributes": True}


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    template_type: str
    department_id: uuid.UUID | None
    description: str | None
    is_active: bool
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any
    tasks: list[TemplateTaskOut] = []

    model_config = {"from_attributes": True}


class OnboardingTaskCreate(BaseModel):
    employee_id: uuid.UUID
    task_type: str = "onboarding"
    title: str
    description: str | None = None
    category: str | None = None
    assigned_to: uuid.UUID | None = None
    due_date: date | None = None
    order_index: int = 0
    notes: str | None = None


class OnboardingTaskOut(BaseModel):
    id: uuid.UUID
    template_id: uuid.UUID | None
    employee_id: uuid.UUID | None
    task_type: str
    title: str
    description: str | None
    category: str | None
    assigned_to: uuid.UUID | None
    due_days_offset: int
    due_date: date | None
    status: str
    completed_at: datetime | None
    notes: str | None
    order_index: int
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class TaskStatusUpdate(BaseModel):
    status: str  # pending, in_progress, completed, skipped
    notes: str | None = None


class StartOnboardingBody(BaseModel):
    template_id: uuid.UUID
    hire_date: date | None = None


class OffboardBody(BaseModel):
    template_id: uuid.UUID | None = None
    last_day: date
    reason: str | None = None


class BuddyAssignmentCreate(BaseModel):
    new_employee_id: uuid.UUID
    buddy_employee_id: uuid.UUID
    start_date: date
    end_date: date | None = None
    notes: str | None = None


class BuddyAssignmentOut(BaseModel):
    id: uuid.UUID
    new_employee_id: uuid.UUID
    buddy_employee_id: uuid.UUID
    start_date: date
    end_date: date | None
    notes: str | None
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class ExitInterviewBody(BaseModel):
    responses: dict
    last_day: date
    reason: str | None = None


# ── Template endpoints ────────────────────────────────────────────────────────


@router.get("/onboarding/templates", summary="List onboarding/offboarding templates")
async def list_templates(
    current_user: CurrentUser,
    db: DBSession,
    template_type: str | None = Query(None, description="onboarding or offboarding"),
    department_id: uuid.UUID | None = Query(None),
    is_active: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    q = select(OnboardingTemplate).where(OnboardingTemplate.is_active == is_active)
    if template_type:
        q = q.where(OnboardingTemplate.template_type == template_type)
    if department_id:
        q = q.where(OnboardingTemplate.department_id == department_id)
    q = q.order_by(OnboardingTemplate.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(q)
    templates = result.scalars().all()

    count_q = select(func.count()).select_from(OnboardingTemplate).where(
        OnboardingTemplate.is_active == is_active
    )
    if template_type:
        count_q = count_q.where(OnboardingTemplate.template_type == template_type)
    if department_id:
        count_q = count_q.where(OnboardingTemplate.department_id == department_id)
    total = (await db.execute(count_q)).scalar_one()

    return {
        "total": total,
        "items": [TemplateOut.model_validate(t) for t in templates],
    }


@router.post(
    "/onboarding/templates",
    status_code=status.HTTP_201_CREATED,
    summary="Create template with embedded tasks (HR admin)",
)
async def create_template(
    body: TemplateCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> TemplateOut:
    template = OnboardingTemplate(
        name=body.name,
        template_type=body.template_type,
        department_id=body.department_id,
        description=body.description,
        created_by=current_user.id,
    )
    db.add(template)
    await db.flush()  # get template.id before creating tasks

    for idx, task_data in enumerate(body.tasks):
        task = OnboardingTask(
            template_id=template.id,
            task_type=body.template_type,
            title=task_data.title,
            description=task_data.description,
            category=task_data.category,
            due_days_offset=task_data.due_days_offset,
            order_index=task_data.order_index if task_data.order_index else idx,
            assigned_to=task_data.assigned_to,
            status="pending",
        )
        db.add(task)

    await db.commit()
    await db.refresh(template)
    return TemplateOut.model_validate(template)


@router.get(
    "/onboarding/templates/{tmpl_id}",
    summary="Get template detail with ordered tasks",
)
async def get_template(
    tmpl_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> TemplateOut:
    result = await db.execute(
        select(OnboardingTemplate).where(OnboardingTemplate.id == tmpl_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return TemplateOut.model_validate(template)


@router.put(
    "/onboarding/templates/{tmpl_id}",
    summary="Update template metadata (HR admin)",
)
async def update_template(
    tmpl_id: uuid.UUID,
    body: TemplateUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> TemplateOut:
    result = await db.execute(
        select(OnboardingTemplate).where(OnboardingTemplate.id == tmpl_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(template, field, value)

    await db.commit()
    await db.refresh(template)
    return TemplateOut.model_validate(template)


@router.delete(
    "/onboarding/templates/{tmpl_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete template and cascade to template tasks (HR admin)",
)
async def delete_template(
    tmpl_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
):
    result = await db.execute(
        select(OnboardingTemplate).where(OnboardingTemplate.id == tmpl_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Delete template tasks first (cascade)
    tasks_result = await db.execute(
        select(OnboardingTask).where(OnboardingTask.template_id == tmpl_id)
    )
    for task in tasks_result.scalars().all():
        await db.delete(task)

    await db.delete(template)
    await db.commit()


# ── Task endpoints ────────────────────────────────────────────────────────────


@router.get("/onboarding/tasks", summary="List onboarding/offboarding tasks")
async def list_tasks(
    current_user: CurrentUser,
    db: DBSession,
    employee_id: uuid.UUID | None = Query(None),
    task_type: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    q = select(OnboardingTask).where(OnboardingTask.employee_id.isnot(None))
    if employee_id:
        q = q.where(OnboardingTask.employee_id == employee_id)
    if task_type:
        q = q.where(OnboardingTask.task_type == task_type)
    if status_filter:
        q = q.where(OnboardingTask.status == status_filter)
    q = q.order_by(OnboardingTask.due_date.asc().nullslast(), OnboardingTask.order_index.asc())

    count_q = select(func.count()).select_from(OnboardingTask).where(
        OnboardingTask.employee_id.isnot(None)
    )
    if employee_id:
        count_q = count_q.where(OnboardingTask.employee_id == employee_id)
    if task_type:
        count_q = count_q.where(OnboardingTask.task_type == task_type)
    if status_filter:
        count_q = count_q.where(OnboardingTask.status == status_filter)
    total = (await db.execute(count_q)).scalar_one()

    result = await db.execute(q.offset(skip).limit(limit))
    tasks = result.scalars().all()

    return {
        "total": total,
        "items": [OnboardingTaskOut.model_validate(t) for t in tasks],
    }


@router.post(
    "/onboarding/tasks",
    status_code=status.HTTP_201_CREATED,
    summary="Create standalone task for specific employee",
)
async def create_task(
    body: OnboardingTaskCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> OnboardingTaskOut:
    # Verify employee exists
    emp = (await db.execute(select(Employee).where(Employee.id == body.employee_id))).scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    task = OnboardingTask(
        employee_id=body.employee_id,
        task_type=body.task_type,
        title=body.title,
        description=body.description,
        category=body.category,
        assigned_to=body.assigned_to,
        due_date=body.due_date,
        order_index=body.order_index,
        notes=body.notes,
        status="pending",
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return OnboardingTaskOut.model_validate(task)


@router.get(
    "/onboarding/employees/{emp_id}/tasks",
    summary="Get onboarding checklist for a specific employee",
)
async def get_employee_tasks(
    emp_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    task_type: str | None = Query(None),
) -> dict[str, Any]:
    emp = (await db.execute(select(Employee).where(Employee.id == emp_id))).scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    q = select(OnboardingTask).where(OnboardingTask.employee_id == emp_id)
    if task_type:
        q = q.where(OnboardingTask.task_type == task_type)
    q = q.order_by(OnboardingTask.order_index.asc(), OnboardingTask.due_date.asc().nullslast())

    result = await db.execute(q)
    tasks = result.scalars().all()

    return {
        "employee_id": str(emp_id),
        "total": len(tasks),
        "items": [OnboardingTaskOut.model_validate(t) for t in tasks],
    }


@router.put(
    "/onboarding/tasks/{task_id}/status",
    summary="Update task status; publishes events on task/full completion",
)
async def update_task_status(
    task_id: uuid.UUID,
    body: TaskStatusUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> OnboardingTaskOut:
    result = await db.execute(select(OnboardingTask).where(OnboardingTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    valid_statuses = {"pending", "in_progress", "completed", "skipped"}
    if body.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}",
        )

    task.status = body.status
    if body.status == "completed":
        task.completed_at = datetime.now(timezone.utc)
    if body.notes is not None:
        task.notes = body.notes

    await db.flush()

    # Publish task completed event
    if body.status == "completed":
        await event_bus.publish(
            "onboarding.task_completed",
            {
                "task_id": str(task.id),
                "employee_id": str(task.employee_id),
                "title": task.title,
                "completed_by": str(current_user.id),
            },
        )

        # Check if all employee tasks are now done
        if task.employee_id:
            all_tasks_result = await db.execute(
                select(OnboardingTask).where(
                    and_(
                        OnboardingTask.employee_id == task.employee_id,
                        OnboardingTask.task_type == task.task_type,
                    )
                )
            )
            all_tasks = all_tasks_result.scalars().all()
            incomplete = [
                t for t in all_tasks if t.status not in ("completed", "skipped")
            ]
            if not incomplete:
                await event_bus.publish(
                    "onboarding.completed",
                    {
                        "employee_id": str(task.employee_id),
                        "task_type": task.task_type,
                        "total_tasks": len(all_tasks),
                    },
                )

    await db.commit()
    await db.refresh(task)
    return OnboardingTaskOut.model_validate(task)


@router.post(
    "/onboarding/employees/{emp_id}/start",
    status_code=status.HTTP_201_CREATED,
    summary="Start onboarding for employee from template (HR admin)",
)
async def start_onboarding(
    emp_id: uuid.UUID,
    body: StartOnboardingBody,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    emp = (await db.execute(select(Employee).where(Employee.id == emp_id))).scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    template_result = await db.execute(
        select(OnboardingTemplate).where(OnboardingTemplate.id == body.template_id)
    )
    template = template_result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    hire_date = body.hire_date or emp.hire_date or date.today()

    created_tasks: list[OnboardingTask] = []
    for tmpl_task in sorted(template.tasks, key=lambda t: t.order_index):
        due = hire_date + timedelta(days=tmpl_task.due_days_offset) if tmpl_task.due_days_offset >= 0 else None
        instance = OnboardingTask(
            template_id=template.id,
            employee_id=emp_id,
            task_type=template.template_type,
            title=tmpl_task.title,
            description=tmpl_task.description,
            category=tmpl_task.category,
            assigned_to=tmpl_task.assigned_to,
            due_days_offset=tmpl_task.due_days_offset,
            due_date=due,
            order_index=tmpl_task.order_index,
            status="pending",
        )
        db.add(instance)
        created_tasks.append(instance)

    await db.commit()
    for t in created_tasks:
        await db.refresh(t)

    await event_bus.publish(
        "onboarding.started",
        {
            "employee_id": str(emp_id),
            "template_id": str(body.template_id),
            "hire_date": str(hire_date),
            "task_count": len(created_tasks),
        },
    )

    return {
        "employee_id": str(emp_id),
        "template_id": str(body.template_id),
        "hire_date": str(hire_date),
        "tasks_created": len(created_tasks),
        "items": [OnboardingTaskOut.model_validate(t) for t in created_tasks],
    }


@router.post(
    "/onboarding/employees/{emp_id}/offboard",
    status_code=status.HTTP_201_CREATED,
    summary="Start offboarding for employee (HR admin)",
)
async def start_offboarding(
    emp_id: uuid.UUID,
    body: OffboardBody,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    emp = (await db.execute(select(Employee).where(Employee.id == emp_id))).scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    created_tasks: list[OnboardingTask] = []

    if body.template_id:
        template_result = await db.execute(
            select(OnboardingTemplate).where(
                and_(
                    OnboardingTemplate.id == body.template_id,
                    OnboardingTemplate.template_type == "offboarding",
                )
            )
        )
        template = template_result.scalar_one_or_none()
        if not template:
            raise HTTPException(status_code=404, detail="Offboarding template not found")

        for tmpl_task in sorted(template.tasks, key=lambda t: t.order_index):
            due = body.last_day + timedelta(days=tmpl_task.due_days_offset)
            instance = OnboardingTask(
                template_id=template.id,
                employee_id=emp_id,
                task_type="offboarding",
                title=tmpl_task.title,
                description=tmpl_task.description,
                category=tmpl_task.category,
                assigned_to=tmpl_task.assigned_to,
                due_days_offset=tmpl_task.due_days_offset,
                due_date=due,
                order_index=tmpl_task.order_index,
                status="pending",
            )
            db.add(instance)
            created_tasks.append(instance)
    else:
        # Create default offboarding tasks
        default_tasks = [
            ("Return equipment", "it_setup", 0),
            ("Revoke system access", "access", 0),
            ("Complete exit interview", "paperwork", -1),
            ("Knowledge transfer documentation", "training", -3),
            ("Final payroll processing", "paperwork", 0),
        ]
        for idx, (title, category, offset) in enumerate(default_tasks):
            due = body.last_day + timedelta(days=offset)
            instance = OnboardingTask(
                employee_id=emp_id,
                task_type="offboarding",
                title=title,
                category=category,
                due_days_offset=offset,
                due_date=due,
                order_index=idx,
                status="pending",
            )
            db.add(instance)
            created_tasks.append(instance)

    # Store last_day and reason on employee metadata
    meta = emp.metadata_json or {}
    meta["offboarding"] = {
        "last_day": str(body.last_day),
        "reason": body.reason,
        "initiated_by": str(current_user.id),
        "initiated_at": datetime.now(timezone.utc).isoformat(),
    }
    emp.metadata_json = meta

    await db.commit()
    for t in created_tasks:
        await db.refresh(t)

    await event_bus.publish(
        "hr.offboarding_started",
        {
            "employee_id": str(emp_id),
            "last_day": str(body.last_day),
            "reason": body.reason,
            "task_count": len(created_tasks),
            "initiated_by": str(current_user.id),
        },
    )

    return {
        "employee_id": str(emp_id),
        "last_day": str(body.last_day),
        "reason": body.reason,
        "tasks_created": len(created_tasks),
        "items": [OnboardingTaskOut.model_validate(t) for t in created_tasks],
    }


# ── Buddy system endpoints ────────────────────────────────────────────────────


@router.get("/onboarding/buddies", summary="List buddy assignments")
async def list_buddies(
    current_user: CurrentUser,
    db: DBSession,
    is_active: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    q = select(BuddyAssignment).where(BuddyAssignment.is_active == is_active)
    count_q = select(func.count()).select_from(BuddyAssignment).where(
        BuddyAssignment.is_active == is_active
    )
    total = (await db.execute(count_q)).scalar_one()
    result = await db.execute(q.order_by(BuddyAssignment.created_at.desc()).offset(skip).limit(limit))
    assignments = result.scalars().all()

    return {
        "total": total,
        "items": [BuddyAssignmentOut.model_validate(a) for a in assignments],
    }


@router.post(
    "/onboarding/buddies",
    status_code=status.HTTP_201_CREATED,
    summary="Assign a buddy to a new employee (HR admin)",
)
async def assign_buddy(
    body: BuddyAssignmentCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> BuddyAssignmentOut:
    if body.new_employee_id == body.buddy_employee_id:
        raise HTTPException(
            status_code=400,
            detail="Buddy cannot be the same as the new employee",
        )

    # Verify both employees exist
    for emp_id, label in [
        (body.new_employee_id, "New employee"),
        (body.buddy_employee_id, "Buddy employee"),
    ]:
        emp = (await db.execute(select(Employee).where(Employee.id == emp_id))).scalar_one_or_none()
        if not emp:
            raise HTTPException(status_code=404, detail=f"{label} not found")

    assignment = BuddyAssignment(
        new_employee_id=body.new_employee_id,
        buddy_employee_id=body.buddy_employee_id,
        start_date=body.start_date,
        end_date=body.end_date,
        notes=body.notes,
        is_active=True,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    await event_bus.publish(
        "onboarding.buddy_assigned",
        {
            "assignment_id": str(assignment.id),
            "new_employee_id": str(body.new_employee_id),
            "buddy_employee_id": str(body.buddy_employee_id),
            "start_date": str(body.start_date),
        },
    )

    return BuddyAssignmentOut.model_validate(assignment)


@router.delete(
    "/onboarding/buddies/{buddy_id}",
    summary="Deactivate buddy assignment (HR admin)",
)
async def deactivate_buddy(
    buddy_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, str]:
    result = await db.execute(
        select(BuddyAssignment).where(BuddyAssignment.id == buddy_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Buddy assignment not found")

    assignment.is_active = False
    assignment.end_date = date.today()
    await db.commit()

    return {"detail": "Buddy assignment deactivated"}


# ── Progress endpoints ────────────────────────────────────────────────────────


@router.get(
    "/onboarding/employees/{emp_id}/progress",
    summary="Get onboarding/offboarding progress for a specific employee",
)
async def get_employee_progress(
    emp_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    task_type: str = Query("onboarding"),
) -> dict[str, Any]:
    emp = (await db.execute(select(Employee).where(Employee.id == emp_id))).scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    tasks_result = await db.execute(
        select(OnboardingTask).where(
            and_(
                OnboardingTask.employee_id == emp_id,
                OnboardingTask.task_type == task_type,
            )
        )
    )
    tasks = tasks_result.scalars().all()
    total = len(tasks)
    completed = sum(1 for t in tasks if t.status == "completed")
    today = date.today()
    next_week = today + timedelta(days=7)

    overdue = [
        OnboardingTaskOut.model_validate(t)
        for t in tasks
        if t.due_date
        and t.due_date < today
        and t.status not in ("completed", "skipped")
    ]
    upcoming = [
        OnboardingTaskOut.model_validate(t)
        for t in tasks
        if t.due_date
        and today <= t.due_date <= next_week
        and t.status not in ("completed", "skipped")
    ]

    completion_pct = round((completed / total * 100), 1) if total > 0 else 0.0

    return {
        "employee_id": str(emp_id),
        "task_type": task_type,
        "total_tasks": total,
        "completed_tasks": completed,
        "completion_pct": completion_pct,
        "overdue_tasks": overdue,
        "upcoming_tasks": upcoming,
    }


@router.get(
    "/onboarding/dashboard",
    summary="Org-wide onboarding dashboard (HR admin)",
)
async def onboarding_dashboard(
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    today = date.today()

    # Employees with active (non-completed, non-skipped) onboarding tasks
    active_q = await db.execute(
        select(OnboardingTask.employee_id, func.count().label("active_count"))
        .where(
            and_(
                OnboardingTask.task_type == "onboarding",
                OnboardingTask.status.notin_(["completed", "skipped"]),
                OnboardingTask.employee_id.isnot(None),
            )
        )
        .group_by(OnboardingTask.employee_id)
    )
    employees_onboarding = active_q.all()

    # Avg completion pct — compute per employee then average
    all_tasks_q = await db.execute(
        select(
            OnboardingTask.employee_id,
            func.count().label("total"),
            func.sum(
                func.cast(OnboardingTask.status == "completed", Integer)
            ).label("done"),
        )
        .where(
            and_(
                OnboardingTask.task_type == "onboarding",
                OnboardingTask.employee_id.isnot(None),
            )
        )
        .group_by(OnboardingTask.employee_id)
    )
    rows = all_tasks_q.all()
    if rows:
        emp_pcts = [
            (r.done or 0) / r.total * 100 for r in rows if r.total > 0
        ]
        avg_completion_pct = round(sum(emp_pcts) / len(emp_pcts), 1) if emp_pcts else 0.0
    else:
        avg_completion_pct = 0.0

    # Overdue task count
    overdue_q = await db.execute(
        select(func.count()).select_from(OnboardingTask).where(
            and_(
                OnboardingTask.due_date < today,
                OnboardingTask.status.notin_(["completed", "skipped"]),
                OnboardingTask.employee_id.isnot(None),
            )
        )
    )
    overdue_count = overdue_q.scalar_one()

    # Active buddies
    buddies_q = await db.execute(
        select(func.count()).select_from(BuddyAssignment).where(BuddyAssignment.is_active == True)
    )
    buddies_active = buddies_q.scalar_one()

    return {
        "employees_onboarding": len(employees_onboarding),
        "onboarding_employee_ids": [str(r.employee_id) for r in employees_onboarding],
        "avg_completion_pct": avg_completion_pct,
        "overdue_task_count": overdue_count,
        "buddies_active": buddies_active,
    }


# ── Exit interview endpoints ──────────────────────────────────────────────────


@router.post(
    "/onboarding/employees/{emp_id}/exit-interview",
    status_code=status.HTTP_201_CREATED,
    summary="Submit exit interview for an employee (HR admin)",
)
async def submit_exit_interview(
    emp_id: uuid.UUID,
    body: ExitInterviewBody,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    emp = (await db.execute(select(Employee).where(Employee.id == emp_id))).scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    interview_data = {
        "responses": body.responses,
        "last_day": str(body.last_day),
        "reason": body.reason,
        "submitted_by": str(current_user.id),
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }

    meta = emp.metadata_json or {}
    meta["exit_interview"] = interview_data
    emp.metadata_json = meta

    await db.commit()

    await event_bus.publish(
        "hr.exit_interview_submitted",
        {
            "employee_id": str(emp_id),
            "last_day": str(body.last_day),
            "reason": body.reason,
            "submitted_by": str(current_user.id),
        },
    )

    return {
        "employee_id": str(emp_id),
        "detail": "Exit interview submitted",
        "data": interview_data,
    }


@router.get(
    "/onboarding/employees/{emp_id}/exit-interview",
    summary="Retrieve last exit interview data for an employee",
)
async def get_exit_interview(
    emp_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    emp = (await db.execute(select(Employee).where(Employee.id == emp_id))).scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    meta = emp.metadata_json or {}
    interview_data = meta.get("exit_interview")
    if not interview_data:
        raise HTTPException(
            status_code=404,
            detail="No exit interview found for this employee",
        )

    return {
        "employee_id": str(emp_id),
        "data": interview_data,
    }

