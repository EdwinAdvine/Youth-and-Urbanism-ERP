"""Projects API — Subtasks, checklists, task relationships, and audit log."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.models.projects import Project, Task
from app.models.projects_enhanced import TaskChecklist, TaskRelationship, TaskAuditLog

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _user_can_access_project(project: Project, user_id: uuid.UUID) -> bool:
    if project.owner_id == user_id:
        return True
    members = project.members or []
    return str(user_id) in [str(m) for m in members]


async def _get_project_and_task(
    db: DBSession, project_id: uuid.UUID, task_id: uuid.UUID, user_id: uuid.UUID
) -> tuple[Project, Task]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, user_id):
        raise HTTPException(status_code=404, detail="Project not found")
    task = await db.get(Task, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found")
    return project, task


async def _record_audit(
    db: DBSession,
    task_id: uuid.UUID,
    user_id: uuid.UUID,
    action: str,
    changes: dict | None = None,
) -> None:
    entry = TaskAuditLog(task_id=task_id, user_id=user_id, action=action, changes=changes)
    db.add(entry)


# ── Schemas ──────────────────────────────────────────────────────────────────

class SubtaskCreate(BaseModel):
    title: str
    description: str | None = None
    assignee_id: uuid.UUID | None = None
    priority: str = "medium"
    due_date: datetime | None = None
    start_date: datetime | None = None
    estimated_hours: float | None = None
    tags: list[str] | None = None


class SubtaskOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    parent_id: uuid.UUID | None
    title: str
    description: str | None
    assignee_id: uuid.UUID | None
    status: str
    priority: str
    due_date: datetime | None
    start_date: datetime | None
    estimated_hours: float | None
    order: int
    tags: list[str] | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class ReparentPayload(BaseModel):
    new_parent_id: uuid.UUID | None = None


class ChecklistCreate(BaseModel):
    title: str
    order: int = 0


class ChecklistUpdate(BaseModel):
    title: str | None = None
    is_completed: bool | None = None
    order: int | None = None


class ChecklistOut(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    title: str
    is_completed: bool
    order: int
    completed_at: datetime | None
    completed_by: uuid.UUID | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class RelationshipCreate(BaseModel):
    target_task_id: uuid.UUID
    relationship_type: str  # blocks | is_blocked_by | duplicates | is_duplicated_by | relates_to


class RelationshipOut(BaseModel):
    id: uuid.UUID
    source_task_id: uuid.UUID
    target_task_id: uuid.UUID
    relationship_type: str
    created_at: Any

    model_config = {"from_attributes": True}


class AuditLogOut(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    user_id: uuid.UUID | None
    action: str
    changes: dict | None
    created_at: Any

    model_config = {"from_attributes": True}


# ── Subtask endpoints ────────────────────────────────────────────────────────

MAX_SUBTASK_DEPTH = 3


async def _get_task_depth(db: DBSession, task: Task) -> int:
    """Walk up the parent chain to find the depth of a task."""
    depth = 0
    current = task
    while current.parent_id is not None:
        depth += 1
        current = await db.get(Task, current.parent_id)
        if current is None:
            break
    return depth


@router.post(
    "/{project_id}/tasks/{task_id}/subtasks",
    status_code=status.HTTP_201_CREATED,
    summary="Create a subtask",
)
async def create_subtask(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: SubtaskCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project, parent_task = await _get_project_and_task(db, project_id, task_id, current_user.id)

    # Check depth limit
    depth = await _get_task_depth(db, parent_task)
    if depth >= MAX_SUBTASK_DEPTH - 1:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum subtask depth of {MAX_SUBTASK_DEPTH} levels reached",
        )

    # Get next order value
    count_result = await db.execute(
        select(func.count()).select_from(Task).where(Task.parent_id == task_id)
    )
    next_order = (count_result.scalar() or 0)

    subtask = Task(
        project_id=project_id,
        parent_id=task_id,
        title=payload.title,
        description=payload.description,
        assignee_id=payload.assignee_id,
        status="todo",
        priority=payload.priority,
        due_date=payload.due_date,
        start_date=payload.start_date,
        estimated_hours=payload.estimated_hours,
        order=next_order,
        tags=payload.tags or [],
    )
    db.add(subtask)

    await _record_audit(db, task_id, current_user.id, "updated", {
        "subtask_added": {"new": payload.title},
    })

    await db.commit()
    await db.refresh(subtask)
    return SubtaskOut.model_validate(subtask).model_dump()


@router.get(
    "/{project_id}/tasks/{task_id}/subtasks",
    summary="List subtasks of a task",
)
async def list_subtasks(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_project_and_task(db, project_id, task_id, current_user.id)

    result = await db.execute(
        select(Task)
        .where(Task.parent_id == task_id)
        .order_by(Task.order.asc())
    )
    subtasks = result.scalars().all()
    return {
        "total": len(subtasks),
        "subtasks": [SubtaskOut.model_validate(s).model_dump() for s in subtasks],
    }


@router.put(
    "/{project_id}/tasks/{task_id}/reparent",
    summary="Move a task to a different parent or make top-level",
)
async def reparent_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: ReparentPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, str]:
    project, task = await _get_project_and_task(db, project_id, task_id, current_user.id)

    if payload.new_parent_id:
        if payload.new_parent_id == task_id:
            raise HTTPException(status_code=400, detail="A task cannot be its own parent")
        new_parent = await db.get(Task, payload.new_parent_id)
        if not new_parent or new_parent.project_id != project_id:
            raise HTTPException(status_code=404, detail="New parent task not found")
        depth = await _get_task_depth(db, new_parent)
        if depth >= MAX_SUBTASK_DEPTH - 1:
            raise HTTPException(status_code=400, detail="Maximum subtask depth reached")

    old_parent = task.parent_id
    task.parent_id = payload.new_parent_id

    await _record_audit(db, task_id, current_user.id, "updated", {
        "parent_id": {"old": str(old_parent) if old_parent else None,
                      "new": str(payload.new_parent_id) if payload.new_parent_id else None},
    })

    await db.commit()
    return {"message": "Task reparented successfully"}


# ── Checklist endpoints ──────────────────────────────────────────────────────

@router.post(
    "/{project_id}/tasks/{task_id}/checklists",
    status_code=status.HTTP_201_CREATED,
    summary="Add a checklist item to a task",
)
async def create_checklist_item(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: ChecklistCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_project_and_task(db, project_id, task_id, current_user.id)

    item = TaskChecklist(
        task_id=task_id,
        title=payload.title,
        order=payload.order,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return ChecklistOut.model_validate(item).model_dump()


@router.get(
    "/{project_id}/tasks/{task_id}/checklists",
    summary="List checklist items for a task",
)
async def list_checklist_items(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_project_and_task(db, project_id, task_id, current_user.id)

    result = await db.execute(
        select(TaskChecklist)
        .where(TaskChecklist.task_id == task_id)
        .order_by(TaskChecklist.order.asc())
    )
    items = result.scalars().all()
    total = len(items)
    completed = sum(1 for i in items if i.is_completed)

    return {
        "total": total,
        "completed": completed,
        "progress": round(completed / total * 100, 1) if total > 0 else 0,
        "items": [ChecklistOut.model_validate(i).model_dump() for i in items],
    }


@router.put(
    "/{project_id}/tasks/{task_id}/checklists/{item_id}",
    summary="Update a checklist item",
)
async def update_checklist_item(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    item_id: uuid.UUID,
    payload: ChecklistUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_project_and_task(db, project_id, task_id, current_user.id)

    item = await db.get(TaskChecklist, item_id)
    if not item or item.task_id != task_id:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    if payload.title is not None:
        item.title = payload.title
    if payload.order is not None:
        item.order = payload.order
    if payload.is_completed is not None:
        old_completed = item.is_completed
        item.is_completed = payload.is_completed
        if payload.is_completed and not old_completed:
            item.completed_at = func.now()
            item.completed_by = current_user.id
        elif not payload.is_completed and old_completed:
            item.completed_at = None
            item.completed_by = None

        await _record_audit(db, task_id, current_user.id, "checklist_toggled", {
            "checklist_item": item.title,
            "is_completed": {"old": old_completed, "new": payload.is_completed},
        })

    await db.commit()
    await db.refresh(item)
    return ChecklistOut.model_validate(item).model_dump()


@router.delete(
    "/{project_id}/tasks/{task_id}/checklists/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a checklist item",
)
async def delete_checklist_item(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    item_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    await _get_project_and_task(db, project_id, task_id, current_user.id)

    item = await db.get(TaskChecklist, item_id)
    if not item or item.task_id != task_id:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    await db.delete(item)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Task relationship endpoints ──────────────────────────────────────────────

VALID_RELATIONSHIP_TYPES = {"blocks", "is_blocked_by", "duplicates", "is_duplicated_by", "relates_to"}


@router.post(
    "/{project_id}/tasks/{task_id}/relationships",
    status_code=status.HTTP_201_CREATED,
    summary="Create a task relationship",
)
async def create_relationship(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: RelationshipCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project, source_task = await _get_project_and_task(db, project_id, task_id, current_user.id)

    if payload.relationship_type not in VALID_RELATIONSHIP_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid relationship type. Must be one of: {', '.join(VALID_RELATIONSHIP_TYPES)}")

    if payload.target_task_id == task_id:
        raise HTTPException(status_code=400, detail="A task cannot have a relationship with itself")

    target_task = await db.get(Task, payload.target_task_id)
    if not target_task or target_task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Target task not found in this project")

    # Check for duplicate
    existing = await db.execute(
        select(TaskRelationship).where(
            TaskRelationship.source_task_id == task_id,
            TaskRelationship.target_task_id == payload.target_task_id,
            TaskRelationship.relationship_type == payload.relationship_type,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="This relationship already exists")

    rel = TaskRelationship(
        source_task_id=task_id,
        target_task_id=payload.target_task_id,
        relationship_type=payload.relationship_type,
    )
    db.add(rel)
    await db.commit()
    await db.refresh(rel)
    return RelationshipOut.model_validate(rel).model_dump()


@router.get(
    "/{project_id}/tasks/{task_id}/relationships",
    summary="List all relationships for a task",
)
async def list_relationships(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_project_and_task(db, project_id, task_id, current_user.id)

    # Relationships where this task is the source
    outgoing_result = await db.execute(
        select(TaskRelationship).where(TaskRelationship.source_task_id == task_id)
    )
    outgoing = outgoing_result.scalars().all()

    # Relationships where this task is the target
    incoming_result = await db.execute(
        select(TaskRelationship).where(TaskRelationship.target_task_id == task_id)
    )
    incoming = incoming_result.scalars().all()

    return {
        "outgoing": [RelationshipOut.model_validate(r).model_dump() for r in outgoing],
        "incoming": [RelationshipOut.model_validate(r).model_dump() for r in incoming],
    }


@router.delete(
    "/{project_id}/tasks/{task_id}/relationships/{rel_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a task relationship",
)
async def delete_relationship(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    rel_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    await _get_project_and_task(db, project_id, task_id, current_user.id)

    rel = await db.get(TaskRelationship, rel_id)
    if not rel or (rel.source_task_id != task_id and rel.target_task_id != task_id):
        raise HTTPException(status_code=404, detail="Relationship not found")

    await db.delete(rel)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Audit log endpoint ───────────────────────────────────────────────────────

@router.get(
    "/{project_id}/tasks/{task_id}/audit-log",
    summary="Get audit log for a task",
)
async def get_task_audit_log(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
) -> dict[str, Any]:
    await _get_project_and_task(db, project_id, task_id, current_user.id)

    query = (
        select(TaskAuditLog)
        .where(TaskAuditLog.task_id == task_id)
        .order_by(TaskAuditLog.created_at.desc())
    )

    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar() or 0

    result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    entries = result.scalars().all()

    return {
        "total": total,
        "entries": [AuditLogOut.model_validate(e).model_dump() for e in entries],
    }
