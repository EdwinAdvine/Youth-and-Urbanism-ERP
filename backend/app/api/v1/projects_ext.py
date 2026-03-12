"""Projects Extensions API — Dependencies, Milestones v2, Timeline, Reports, Templates."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.models.projects import (
    Project,
    ProjectMilestone,
    ProjectTemplate,
    Task,
    TaskDependency,
    TimeLog,
)

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _user_can_access_project(project: Project, user_id: uuid.UUID) -> bool:
    """Return True if the user owns the project or is a member."""
    if project.owner_id == user_id:
        return True
    members = project.members or []
    return str(user_id) in [str(m) for m in members]


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class TaskPositionUpdate(BaseModel):
    status: str | None = None
    order: int


class DependencyCreate(BaseModel):
    depends_on_id: uuid.UUID
    dependency_type: str = "finish_to_start"


class DependencyOut(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    depends_on_id: uuid.UUID
    dependency_type: str
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class MilestoneV2Create(BaseModel):
    name: str
    due_date: date | None = None
    status: str = "open"


class MilestoneV2Update(BaseModel):
    name: str | None = None
    due_date: date | None = None
    status: str | None = None


class MilestoneV2Out(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    due_date: date | None
    status: str
    completed_at: datetime | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class TemplateCreate(BaseModel):
    name: str
    description: str | None = None
    tasks: list[dict] | None = None
    settings: dict | None = None


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    tasks: list | None
    settings: dict | None
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class ProjectFromTemplateCreate(BaseModel):
    template_id: uuid.UUID
    name: str
    description: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    members: list[str] | None = None


class TaskOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: str | None
    assignee_id: uuid.UUID | None
    status: str
    priority: str
    due_date: datetime | None
    order: int
    tags: list[str] | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class ProjectOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    status: str
    start_date: datetime | None
    end_date: datetime | None
    color: str | None
    owner_id: uuid.UUID
    members: list | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Task Position (Kanban reorder) ───────────────────────────────────────────

@router.put("/tasks/{task_id}/position", summary="Update task position for Kanban reorder")
async def update_task_position(
    task_id: uuid.UUID,
    payload: TaskPositionUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    project = await db.get(Project, task.project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if payload.status is not None:
        task.status = payload.status
    task.order = payload.order

    await db.commit()
    await db.refresh(task)
    return TaskOut.model_validate(task).model_dump()


# ── Task Dependencies ────────────────────────────────────────────────────────

@router.post(
    "/tasks/{task_id}/dependencies",
    status_code=status.HTTP_201_CREATED,
    summary="Add a dependency to a task",
)
async def create_dependency(
    task_id: uuid.UUID,
    payload: DependencyCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    project = await db.get(Project, task.project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    depends_on = await db.get(Task, payload.depends_on_id)
    if not depends_on:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dependency task not found")

    if task_id == payload.depends_on_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A task cannot depend on itself",
        )

    # Check for duplicate
    existing = await db.execute(
        select(TaskDependency).where(
            TaskDependency.task_id == task_id,
            TaskDependency.depends_on_id == payload.depends_on_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Dependency already exists",
        )

    dep = TaskDependency(
        task_id=task_id,
        depends_on_id=payload.depends_on_id,
        dependency_type=payload.dependency_type,
    )
    db.add(dep)
    await db.commit()
    await db.refresh(dep)
    return DependencyOut.model_validate(dep).model_dump()


@router.delete(
    "/tasks/{task_id}/dependencies/{dep_id}",
    status_code=status.HTTP_200_OK,
    summary="Remove a task dependency",
)
async def delete_dependency(
    task_id: uuid.UUID,
    dep_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    dep = await db.get(TaskDependency, dep_id)
    if not dep or dep.task_id != task_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dependency not found")

    task = await db.get(Task, task_id)
    if task:
        project = await db.get(Project, task.project_id)
        if not project or not _user_can_access_project(project, current_user.id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await db.delete(dep)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


@router.get("/tasks/{task_id}/dependencies", summary="List dependencies for a task")
async def list_dependencies(
    task_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    project = await db.get(Project, task.project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Dependencies this task has (what it depends on)
    depends_on_result = await db.execute(
        select(TaskDependency).where(TaskDependency.task_id == task_id)
    )
    depends_on = depends_on_result.scalars().all()

    # Tasks that depend on this task
    dependents_result = await db.execute(
        select(TaskDependency).where(TaskDependency.depends_on_id == task_id)
    )
    dependents = dependents_result.scalars().all()

    return {
        "task_id": str(task_id),
        "depends_on": [DependencyOut.model_validate(d).model_dump() for d in depends_on],
        "dependents": [DependencyOut.model_validate(d).model_dump() for d in dependents],
    }


# ── Milestones v2 ────────────────────────────────────────────────────────────

@router.get("/{project_id}/milestones-v2", summary="List enhanced milestones for a project")
async def list_milestones_v2(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    result = await db.execute(
        select(ProjectMilestone)
        .where(ProjectMilestone.project_id == project_id)
        .order_by(ProjectMilestone.due_date.asc().nulls_last())
    )
    milestones = result.scalars().all()
    return {
        "total": len(milestones),
        "milestones": [MilestoneV2Out.model_validate(m).model_dump() for m in milestones],
    }


@router.post(
    "/{project_id}/milestones-v2",
    status_code=status.HTTP_201_CREATED,
    summary="Create an enhanced milestone",
)
async def create_milestone_v2(
    project_id: uuid.UUID,
    payload: MilestoneV2Create,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    milestone = ProjectMilestone(
        project_id=project_id,
        name=payload.name,
        due_date=payload.due_date,
        status=payload.status,
    )
    db.add(milestone)
    await db.commit()
    await db.refresh(milestone)
    return MilestoneV2Out.model_validate(milestone).model_dump()


@router.put("/milestones-v2/{milestone_id}", summary="Update an enhanced milestone")
async def update_milestone_v2(
    milestone_id: uuid.UUID,
    payload: MilestoneV2Update,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    milestone = await db.get(ProjectMilestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")

    project = await db.get(Project, milestone.project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(milestone, field, value)

    # Auto-set completed_at when status changes to completed
    if payload.status == "completed" and milestone.completed_at is None:
        milestone.completed_at = func.now()
    elif payload.status == "open":
        milestone.completed_at = None

    await db.commit()
    await db.refresh(milestone)
    return MilestoneV2Out.model_validate(milestone).model_dump()


@router.delete(
    "/milestones-v2/{milestone_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete an enhanced milestone",
)
async def delete_milestone_v2(
    milestone_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    milestone = await db.get(ProjectMilestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")

    project = await db.get(Project, milestone.project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await db.delete(milestone)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ── Timeline (Gantt) ─────────────────────────────────────────────────────────

@router.get("/{project_id}/timeline", summary="Get project timeline for Gantt chart")
async def get_timeline(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Fetch all tasks
    tasks_result = await db.execute(
        select(Task).where(Task.project_id == project_id).order_by(Task.order.asc())
    )
    tasks = tasks_result.scalars().all()

    # Fetch all dependencies for tasks in this project
    task_ids = [t.id for t in tasks]
    deps_result = await db.execute(
        select(TaskDependency).where(TaskDependency.task_id.in_(task_ids))
    )
    deps = deps_result.scalars().all()

    # Fetch milestones
    milestones_result = await db.execute(
        select(ProjectMilestone)
        .where(ProjectMilestone.project_id == project_id)
        .order_by(ProjectMilestone.due_date.asc().nulls_last())
    )
    milestones = milestones_result.scalars().all()

    # Build dependency map
    dep_map: dict[str, list[dict]] = {}
    for d in deps:
        key = str(d.task_id)
        if key not in dep_map:
            dep_map[key] = []
        dep_map[key].append({
            "depends_on_id": str(d.depends_on_id),
            "dependency_type": d.dependency_type,
        })

    timeline_tasks = []
    for t in tasks:
        timeline_tasks.append({
            "id": str(t.id),
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "assignee_id": str(t.assignee_id) if t.assignee_id else None,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "order": t.order,
            "dependencies": dep_map.get(str(t.id), []),
        })

    return {
        "project_id": str(project_id),
        "project_name": project.name,
        "start_date": project.start_date.isoformat() if project.start_date else None,
        "end_date": project.end_date.isoformat() if project.end_date else None,
        "tasks": timeline_tasks,
        "milestones": [MilestoneV2Out.model_validate(m).model_dump() for m in milestones],
    }


# ── Project Report ───────────────────────────────────────────────────────────

@router.get("/{project_id}/report", summary="Project report: hours, progress, burndown")
async def get_project_report(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Task counts by status
    status_counts_result = await db.execute(
        select(Task.status, func.count(Task.id))
        .where(Task.project_id == project_id)
        .group_by(Task.status)
    )
    status_counts = {row[0]: row[1] for row in status_counts_result.all()}

    total_tasks = sum(status_counts.values())
    done_tasks = status_counts.get("done", 0)
    progress_pct = round((done_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0

    # Total hours logged
    hours_result = await db.execute(
        select(func.coalesce(func.sum(TimeLog.hours), 0))
        .join(Task, TimeLog.task_id == Task.id)
        .where(Task.project_id == project_id)
    )
    total_hours = float(hours_result.scalar() or 0)

    # Hours by user
    user_hours_result = await db.execute(
        select(TimeLog.user_id, func.sum(TimeLog.hours).label("hours"))
        .join(Task, TimeLog.task_id == Task.id)
        .where(Task.project_id == project_id)
        .group_by(TimeLog.user_id)
    )
    hours_by_user = [
        {"user_id": str(r.user_id), "hours": float(r.hours)}
        for r in user_hours_result.all()
    ]

    # Burndown: tasks completed over time (grouped by date)
    burndown_result = await db.execute(
        select(
            func.date(Task.updated_at).label("date"),
            func.count(Task.id).label("completed"),
        )
        .where(Task.project_id == project_id, Task.status == "done")
        .group_by(func.date(Task.updated_at))
        .order_by(func.date(Task.updated_at).asc())
    )
    burndown = [
        {"date": str(r.date), "completed": r.completed}
        for r in burndown_result.all()
    ]

    # Overdue tasks
    from datetime import datetime as dt, timezone  # noqa: PLC0415
    now = dt.now(timezone.utc)
    overdue_result = await db.execute(
        select(func.count(Task.id))
        .where(
            Task.project_id == project_id,
            Task.due_date < now,
            Task.status != "done",
        )
    )
    overdue_count = overdue_result.scalar() or 0

    return {
        "project_id": str(project_id),
        "project_name": project.name,
        "total_tasks": total_tasks,
        "status_counts": status_counts,
        "progress_pct": progress_pct,
        "total_hours_logged": total_hours,
        "hours_by_user": hours_by_user,
        "overdue_tasks": overdue_count,
        "burndown": burndown,
    }


# ── Templates ────────────────────────────────────────────────────────────────

@router.get("/templates", summary="List project templates")
async def list_templates(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(ProjectTemplate)
        .where(ProjectTemplate.owner_id == current_user.id)
        .order_by(ProjectTemplate.created_at.desc())
    )
    templates = result.scalars().all()
    return {
        "total": len(templates),
        "templates": [TemplateOut.model_validate(t).model_dump() for t in templates],
    }


@router.post(
    "/templates",
    status_code=status.HTTP_201_CREATED,
    summary="Create a project template",
)
async def create_template(
    payload: TemplateCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    template = ProjectTemplate(
        name=payload.name,
        description=payload.description,
        tasks=payload.tasks or [],
        settings=payload.settings,
        owner_id=current_user.id,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return TemplateOut.model_validate(template).model_dump()


@router.post(
    "/from-template",
    status_code=status.HTTP_201_CREATED,
    summary="Create a project from a template",
)
async def create_project_from_template(
    payload: ProjectFromTemplateCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    template = await db.get(ProjectTemplate, payload.template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    # Create the project
    project = Project(
        name=payload.name,
        description=payload.description or template.description,
        status="active",
        start_date=payload.start_date,
        end_date=payload.end_date,
        color=(template.settings or {}).get("color"),
        owner_id=current_user.id,
        members=payload.members or [],
    )
    db.add(project)
    await db.flush()  # Get project.id

    # Create tasks from template
    template_tasks = template.tasks or []
    created_tasks = []
    for idx, task_def in enumerate(template_tasks):
        task = Task(
            project_id=project.id,
            title=task_def.get("title", f"Task {idx + 1}"),
            description=task_def.get("description"),
            status=task_def.get("status", "todo"),
            priority=task_def.get("priority", "medium"),
            order=task_def.get("order", idx),
            tags=task_def.get("tags", []),
        )
        db.add(task)
        created_tasks.append(task)

    await db.commit()
    await db.refresh(project)

    return {
        **ProjectOut.model_validate(project).model_dump(),
        "tasks_created": len(created_tasks),
        "template_name": template.name,
    }
