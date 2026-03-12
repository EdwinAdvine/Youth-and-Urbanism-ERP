"""Projects API — Sprints, backlog, calendar view, and bulk operations."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select

from app.core.deps import CurrentUser, DBSession
from app.models.projects import Project, Task
from app.models.projects_enhanced import Sprint

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _user_can_access_project(project: Project, user_id: uuid.UUID) -> bool:
    if project.owner_id == user_id:
        return True
    members = project.members or []
    return str(user_id) in [str(m) for m in members]


# ── Schemas ──────────────────────────────────────────────────────────────────

class SprintCreate(BaseModel):
    name: str
    goal: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


class SprintUpdate(BaseModel):
    name: str | None = None
    goal: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    status: str | None = None  # planning | active | completed


class SprintOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    goal: str | None
    start_date: datetime | None
    end_date: datetime | None
    status: str
    created_at: Any
    updated_at: Any
    task_count: int = 0

    model_config = {"from_attributes": True}


class AssignSprintPayload(BaseModel):
    sprint_id: uuid.UUID | None = None  # None = move to backlog


class BulkUpdatePayload(BaseModel):
    task_ids: list[uuid.UUID]
    status: str | None = None
    priority: str | None = None
    assignee_id: uuid.UUID | None = None
    sprint_id: uuid.UUID | None = None


# ── Sprint endpoints ─────────────────────────────────────────────────────────

@router.post(
    "/{project_id}/sprints",
    status_code=status.HTTP_201_CREATED,
    summary="Create a sprint",
)
async def create_sprint(
    project_id: uuid.UUID,
    payload: SprintCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    sprint = Sprint(
        project_id=project_id,
        name=payload.name,
        goal=payload.goal,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    db.add(sprint)
    await db.commit()
    await db.refresh(sprint)

    out = SprintOut.model_validate(sprint).model_dump()
    out["task_count"] = 0
    return out


@router.get(
    "/{project_id}/sprints",
    summary="List sprints for a project",
)
async def list_sprints(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(Sprint)
        .where(Sprint.project_id == project_id)
        .order_by(Sprint.created_at.desc())
    )
    sprints = result.scalars().all()

    output = []
    for s in sprints:
        count_result = await db.execute(
            select(func.count()).select_from(Task).where(Task.sprint_id == s.id)
        )
        task_count = count_result.scalar() or 0
        data = SprintOut.model_validate(s).model_dump()
        data["task_count"] = task_count
        output.append(data)

    return {"total": len(output), "sprints": output}


@router.put(
    "/{project_id}/sprints/{sprint_id}",
    summary="Update a sprint",
)
async def update_sprint(
    project_id: uuid.UUID,
    sprint_id: uuid.UUID,
    payload: SprintUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    sprint = await db.get(Sprint, sprint_id)
    if not sprint or sprint.project_id != project_id:
        raise HTTPException(status_code=404, detail="Sprint not found")

    for attr, value in payload.model_dump(exclude_none=True).items():
        setattr(sprint, attr, value)

    await db.commit()
    await db.refresh(sprint)
    return SprintOut.model_validate(sprint).model_dump()


@router.delete(
    "/{project_id}/sprints/{sprint_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a sprint (moves tasks to backlog)",
)
async def delete_sprint(
    project_id: uuid.UUID,
    sprint_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    sprint = await db.get(Sprint, sprint_id)
    if not sprint or sprint.project_id != project_id:
        raise HTTPException(status_code=404, detail="Sprint not found")

    # Move all tasks in this sprint to backlog (sprint_id = NULL)
    tasks_result = await db.execute(
        select(Task).where(Task.sprint_id == sprint_id)
    )
    for task in tasks_result.scalars().all():
        task.sprint_id = None

    await db.delete(sprint)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


@router.put(
    "/{project_id}/tasks/{task_id}/sprint",
    summary="Assign a task to a sprint or move to backlog",
)
async def assign_task_to_sprint(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: AssignSprintPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, str]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    task = await db.get(Task, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found")

    if payload.sprint_id:
        sprint = await db.get(Sprint, payload.sprint_id)
        if not sprint or sprint.project_id != project_id:
            raise HTTPException(status_code=404, detail="Sprint not found")

    task.sprint_id = payload.sprint_id
    await db.commit()
    return {"message": "Task sprint assignment updated"}


# ── Backlog endpoint ─────────────────────────────────────────────────────────

@router.get(
    "/{project_id}/backlog",
    summary="List backlog tasks (no sprint assigned)",
)
async def get_backlog(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    query = select(Task).where(
        Task.project_id == project_id,
        Task.sprint_id.is_(None),
        Task.parent_id.is_(None),  # Only top-level tasks
    )

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    result = await db.execute(
        query.order_by(Task.order.asc()).offset((page - 1) * limit).limit(limit)
    )
    tasks = result.scalars().all()

    return {
        "total": total,
        "tasks": [
            {
                "id": str(t.id),
                "title": t.title,
                "status": t.status,
                "priority": t.priority,
                "assignee_id": str(t.assignee_id) if t.assignee_id else None,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "start_date": t.start_date.isoformat() if t.start_date else None,
                "estimated_hours": t.estimated_hours,
                "tags": t.tags,
                "order": t.order,
            }
            for t in tasks
        ],
    }


# ── Calendar view endpoint ───────────────────────────────────────────────────

@router.get(
    "/{project_id}/calendar",
    summary="Tasks in a date range for calendar view",
)
async def get_calendar_tasks(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    start: datetime = Query(..., description="Start of date range"),
    end: datetime = Query(..., description="End of date range"),
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    # Tasks that have a due_date or start_date within the range
    query = select(Task).where(
        Task.project_id == project_id,
        or_(
            and_(Task.due_date.isnot(None), Task.due_date >= start, Task.due_date <= end),
            and_(Task.start_date.isnot(None), Task.start_date >= start, Task.start_date <= end),
        ),
    )

    result = await db.execute(query.order_by(Task.due_date.asc().nulls_last()))
    tasks = result.scalars().all()

    # Group by date
    by_date: dict[str, list] = {}
    for t in tasks:
        date_key = (t.due_date or t.start_date).strftime("%Y-%m-%d") if (t.due_date or t.start_date) else "unscheduled"
        if date_key not in by_date:
            by_date[date_key] = []
        by_date[date_key].append({
            "id": str(t.id),
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "assignee_id": str(t.assignee_id) if t.assignee_id else None,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "start_date": t.start_date.isoformat() if t.start_date else None,
            "estimated_hours": t.estimated_hours,
        })

    return {"total": len(tasks), "by_date": by_date}


# ── Bulk update endpoint ────────────────────────────────────────────────────

@router.put(
    "/{project_id}/tasks/bulk",
    summary="Bulk update tasks (status, priority, assignee, sprint)",
)
async def bulk_update_tasks(
    project_id: uuid.UUID,
    payload: BulkUpdatePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    if not payload.task_ids:
        raise HTTPException(status_code=400, detail="No task IDs provided")

    updated = 0
    for tid in payload.task_ids:
        task = await db.get(Task, tid)
        if not task or task.project_id != project_id:
            continue
        if payload.status is not None:
            task.status = payload.status
        if payload.priority is not None:
            task.priority = payload.priority
        if payload.assignee_id is not None:
            task.assignee_id = payload.assignee_id
        if payload.sprint_id is not None:
            task.sprint_id = payload.sprint_id
        updated += 1

    await db.commit()
    return {"updated": updated, "total_requested": len(payload.task_ids)}
