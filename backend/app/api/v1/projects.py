"""Projects API — CRUD for projects, tasks, milestones, and time logs."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import and_, cast, func, or_, select
from sqlalchemy.dialects.postgresql import JSONB as JSONB_TYPE

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.projects import Milestone, Project, Task, TimeLog
from app.models.projects_enhanced import TaskAuditLog

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    status: str = "active"
    start_date: datetime | None = None
    end_date: datetime | None = None
    color: str | None = None
    members: list[str] | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    color: str | None = None
    members: list[str] | None = None


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


class ProjectDetailOut(ProjectOut):
    task_count: int = 0
    milestone_count: int = 0


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    assignee_id: uuid.UUID | None = None
    status: str = "todo"
    priority: str = "medium"
    due_date: datetime | None = None
    start_date: datetime | None = None
    estimated_hours: float | None = None
    order: int = 0
    tags: list[str] | None = None
    parent_id: uuid.UUID | None = None
    sprint_id: uuid.UUID | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    assignee_id: uuid.UUID | None = None
    status: str | None = None
    priority: str | None = None
    due_date: datetime | None = None
    start_date: datetime | None = None
    estimated_hours: float | None = None
    order: int | None = None
    tags: list[str] | None = None
    sprint_id: uuid.UUID | None = None


class TaskOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    parent_id: uuid.UUID | None = None
    title: str
    description: str | None
    assignee_id: uuid.UUID | None
    status: str
    priority: str
    due_date: datetime | None
    start_date: datetime | None = None
    estimated_hours: float | None = None
    sprint_id: uuid.UUID | None = None
    order: int
    tags: list[str] | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class TimeLogCreate(BaseModel):
    hours: float
    description: str | None = None


class TimeLogOut(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    user_id: uuid.UUID
    hours: float
    description: str | None
    logged_at: Any
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class MilestoneCreate(BaseModel):
    title: str
    due_date: datetime | None = None


class MilestoneOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    due_date: datetime | None
    is_completed: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _user_can_access_project(project: Project, user_id: uuid.UUID) -> bool:
    """Return True if the user owns the project or is a member."""
    if project.owner_id == user_id:
        return True
    members = project.members or []
    return str(user_id) in [str(m) for m in members]


# ── Project endpoints ─────────────────────────────────────────────────────────

@router.get("", summary="List projects the user owns or is a member of")
async def list_projects(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status", description="Filter by project status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    uid = str(current_user.id)

    # Base query: user is owner OR user is in the members JSON array
    # Use explicit cast + @> to avoid errors when members is NULL
    query = select(Project).where(
        or_(
            Project.owner_id == current_user.id,
            and_(
                Project.members.isnot(None),
                Project.members.op("@>")(cast([uid], JSONB_TYPE)),
            ),
        )
    )

    if status_filter:
        query = query.where(Project.status == status_filter)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Page
    query = query.order_by(Project.updated_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    projects = result.scalars().all()
    return {
        "total": total,
        "projects": [ProjectOut.model_validate(p) for p in projects],
    }


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create a project")
async def create_project(
    payload: ProjectCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = Project(
        name=payload.name,
        description=payload.description,
        status=payload.status,
        start_date=payload.start_date,
        end_date=payload.end_date,
        color=payload.color,
        owner_id=current_user.id,
        members=payload.members or [],
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return ProjectOut.model_validate(project).model_dump()


@router.get("/{project_id}", summary="Get project detail")
async def get_project(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Count tasks and milestones
    task_count_result = await db.execute(
        select(func.count()).select_from(Task).where(Task.project_id == project_id)
    )
    task_count = task_count_result.scalar() or 0

    milestone_count_result = await db.execute(
        select(func.count()).select_from(Milestone).where(Milestone.project_id == project_id)
    )
    milestone_count = milestone_count_result.scalar() or 0

    data = ProjectOut.model_validate(project).model_dump()
    data["task_count"] = task_count
    data["milestone_count"] = milestone_count
    return data


@router.put("/{project_id}", summary="Update a project")
async def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project)
    return ProjectOut.model_validate(project).model_dump()


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a project",
)
async def delete_project(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    project = await db.get(Project, project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    await db.delete(project)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Task endpoints ────────────────────────────────────────────────────────────

@router.get("/{project_id}/tasks", summary="List tasks in a project")
async def list_tasks(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status", description="Filter by task status"),
    assignee: uuid.UUID | None = Query(None, description="Filter by assignee ID"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    query = select(Task).where(Task.project_id == project_id)

    if status_filter:
        query = query.where(Task.status == status_filter)
    if assignee:
        query = query.where(Task.assignee_id == assignee)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Page
    query = query.order_by(Task.order.asc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    tasks = result.scalars().all()
    return {
        "total": total,
        "tasks": [TaskOut.model_validate(t) for t in tasks],
    }


@router.post(
    "/{project_id}/tasks",
    status_code=status.HTTP_201_CREATED,
    summary="Create a task",
)
async def create_task(
    project_id: uuid.UUID,
    payload: TaskCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    task = Task(
        project_id=project_id,
        title=payload.title,
        description=payload.description,
        assignee_id=payload.assignee_id,
        status=payload.status,
        priority=payload.priority,
        due_date=payload.due_date,
        start_date=payload.start_date,
        estimated_hours=payload.estimated_hours,
        order=payload.order,
        tags=payload.tags or [],
        parent_id=payload.parent_id,
        sprint_id=payload.sprint_id,
    )
    db.add(task)
    await db.flush()

    # Audit log
    audit = TaskAuditLog(task_id=task.id, user_id=current_user.id, action="created")
    db.add(audit)

    await db.commit()
    await db.refresh(task)

    # Publish task.created event for cross-module integrations (e.g. calendar)
    await event_bus.publish("task.created", {
        "task_id": str(task.id),
        "title": task.title,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "project_id": str(project.id),
        "project_name": project.name,
        "assignee_id": str(task.assignee_id) if task.assignee_id else None,
        "owner_id": str(project.owner_id),
    })

    # Publish task.assigned event if assignee was set on creation
    if task.assignee_id:
        await event_bus.publish("task.assigned", {
            "task_id": str(task.id),
            "title": task.title,
            "project_id": str(project.id),
            "project_name": project.name,
            "assignee_id": str(task.assignee_id),
            "assigned_by": str(current_user.id),
        })

    return TaskOut.model_validate(task).model_dump()


@router.put("/{project_id}/tasks/{task_id}", summary="Update a task")
async def update_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: TaskUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    task = await db.get(Task, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    old_due_date = task.due_date
    old_status = task.status
    old_assignee_id = task.assignee_id

    # Track changes for audit log
    changes = {}
    for field, value in payload.model_dump(exclude_none=True).items():
        old_val = getattr(task, field, None)
        if old_val != value:
            changes[field] = {
                "old": str(old_val) if old_val is not None else None,
                "new": str(value) if value is not None else None,
            }
        setattr(task, field, value)

    # Write audit log if anything changed
    if changes:
        action = "status_changed" if "status" in changes else "assigned" if "assignee_id" in changes else "updated"
        audit = TaskAuditLog(task_id=task.id, user_id=current_user.id, action=action, changes=changes)
        db.add(audit)

    await db.commit()
    await db.refresh(task)

    # Publish task.updated event when due_date changes (for calendar sync)
    if payload.due_date is not None and task.due_date != old_due_date:
        await event_bus.publish("task.updated", {
            "task_id": str(task.id),
            "title": task.title,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "old_due_date": old_due_date.isoformat() if old_due_date else None,
            "project_name": project.name,
            "assignee_id": str(task.assignee_id) if task.assignee_id else None,
        })

    # Publish task.assigned when assignee changes
    if payload.assignee_id is not None and task.assignee_id != old_assignee_id and task.assignee_id:
        await event_bus.publish("task.assigned", {
            "task_id": str(task.id),
            "title": task.title,
            "project_id": str(project.id),
            "project_name": project.name,
            "assignee_id": str(task.assignee_id),
            "assigned_by": str(current_user.id),
        })

    # Publish task.status_changed when status changes
    if payload.status is not None and task.status != old_status:
        await event_bus.publish("task.status_changed", {
            "task_id": str(task.id),
            "title": task.title,
            "project_id": str(project.id),
            "project_name": project.name,
            "old_status": old_status,
            "new_status": task.status,
            "owner_id": str(project.owner_id),
            "assignee_id": str(task.assignee_id) if task.assignee_id else None,
        })

    return TaskOut.model_validate(task).model_dump()


@router.delete(
    "/{project_id}/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a task",
)
async def delete_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    task = await db.get(Task, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    await db.delete(task)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{project_id}/board", summary="Kanban board data grouped by status")
async def get_board(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, list[dict[str, Any]]]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    query = (
        select(Task)
        .where(Task.project_id == project_id)
        .order_by(Task.order.asc())
    )
    result = await db.execute(query)
    tasks = result.scalars().all()

    board: dict[str, list[dict[str, Any]]] = {
        "todo": [],
        "in_progress": [],
        "in_review": [],
        "done": [],
    }

    for task in tasks:
        task_data = TaskOut.model_validate(task).model_dump()
        bucket = task.status if task.status in board else "todo"
        board[bucket].append(task_data)

    return board


# ── Batch reorder / move tasks (drag-and-drop) ──────────────────────────────


class TaskReorderItem(BaseModel):
    task_id: uuid.UUID
    status: str
    order: int


class BatchReorderPayload(BaseModel):
    tasks: list[TaskReorderItem]


@router.put("/{project_id}/board/reorder", summary="Batch reorder / move tasks across columns")
async def batch_reorder_tasks(
    project_id: uuid.UUID,
    payload: BatchReorderPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, str]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    for item in payload.tasks:
        task = await db.get(Task, item.task_id)
        if not task or task.project_id != project_id:
            continue
        old_status = task.status
        task.status = item.status
        task.order = item.order
        # Publish event if status changed
        if old_status != item.status:
            await event_bus.publish("task.updated", {
                "task_id": str(task.id),
                "title": task.title,
                "status": item.status,
                "old_status": old_status,
                "project_name": project.name,
                "assignee_id": str(task.assignee_id) if task.assignee_id else None,
            })

    await db.commit()
    return {"message": "Tasks reordered successfully"}


# ── Time log endpoints ────────────────────────────────────────────────────────

@router.post(
    "/{project_id}/tasks/{task_id}/time-logs",
    status_code=status.HTTP_201_CREATED,
    summary="Log time against a task",
)
async def create_time_log(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: TimeLogCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    task = await db.get(Task, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    time_log = TimeLog(
        task_id=task_id,
        user_id=current_user.id,
        hours=payload.hours,
        description=payload.description,
    )
    db.add(time_log)
    await db.commit()
    await db.refresh(time_log)
    return TimeLogOut.model_validate(time_log).model_dump()


@router.get(
    "/{project_id}/tasks/{task_id}/time-logs",
    summary="List time logs for a task",
)
async def list_task_time_logs(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    task = await db.get(Task, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    result = await db.execute(
        select(TimeLog)
        .where(TimeLog.task_id == task_id)
        .order_by(TimeLog.logged_at.desc())
    )
    logs = result.scalars().all()
    total_hours = sum(log.hours for log in logs)

    return {
        "total": len(logs),
        "total_hours": total_hours,
        "time_logs": [TimeLogOut.model_validate(tl).model_dump() for tl in logs],
    }


@router.get(
    "/{project_id}/time-report",
    summary="Time report for a project",
)
async def project_time_report(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Total hours per task
    task_hours_result = await db.execute(
        select(
            Task.id,
            Task.title,
            Task.status,
            func.coalesce(func.sum(TimeLog.hours), 0).label("total_hours"),
            func.count(TimeLog.id).label("log_count"),
        )
        .outerjoin(TimeLog, TimeLog.task_id == Task.id)
        .where(Task.project_id == project_id)
        .group_by(Task.id, Task.title, Task.status)
        .order_by(Task.title.asc())
    )
    task_rows = task_hours_result.all()

    # Total hours per user
    user_hours_result = await db.execute(
        select(
            TimeLog.user_id,
            func.sum(TimeLog.hours).label("total_hours"),
        )
        .join(Task, TimeLog.task_id == Task.id)
        .where(Task.project_id == project_id)
        .group_by(TimeLog.user_id)
    )
    user_rows = user_hours_result.all()

    grand_total = sum(r.total_hours for r in task_rows)

    return {
        "project_id": str(project_id),
        "project_name": project.name,
        "grand_total_hours": float(grand_total),
        "by_task": [
            {
                "task_id": str(r.id),
                "task_title": r.title,
                "task_status": r.status,
                "total_hours": float(r.total_hours),
                "log_count": r.log_count,
            }
            for r in task_rows
        ],
        "by_user": [
            {
                "user_id": str(r.user_id),
                "total_hours": float(r.total_hours),
            }
            for r in user_rows
        ],
    }


# ── Milestone endpoints ──────────────────────────────────────────────────────

@router.get("/{project_id}/milestones", summary="List milestones")
async def list_milestones(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    query = (
        select(Milestone)
        .where(Milestone.project_id == project_id)
        .order_by(Milestone.due_date.asc().nulls_last())
    )
    result = await db.execute(query)
    milestones = result.scalars().all()
    return {
        "total": len(milestones),
        "milestones": [MilestoneOut.model_validate(m) for m in milestones],
    }


@router.post(
    "/{project_id}/milestones",
    status_code=status.HTTP_201_CREATED,
    summary="Create a milestone",
)
async def create_milestone(
    project_id: uuid.UUID,
    payload: MilestoneCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    milestone = Milestone(
        project_id=project_id,
        title=payload.title,
        due_date=payload.due_date,
    )
    db.add(milestone)
    await db.commit()
    await db.refresh(milestone)
    return MilestoneOut.model_validate(milestone).model_dump()
