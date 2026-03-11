"""Projects API — Task comments with threading, @mentions, and activity feed."""
from __future__ import annotations

import re
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.projects import Project, Task
from app.models.projects_enhanced import TaskComment, TaskAuditLog
from app.models.notification import Notification

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _user_can_access_project(project: Project, user_id: uuid.UUID) -> bool:
    if project.owner_id == user_id:
        return True
    members = project.members or []
    return str(user_id) in [str(m) for m in members]


MENTION_PATTERN = re.compile(r"@\[([0-9a-f\-]{36})\]")


def _extract_mentions(content: str) -> list[str]:
    """Extract user IDs from @[uuid] patterns in content."""
    return MENTION_PATTERN.findall(content)


# ── Schemas ──────────────────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    content: str
    parent_id: uuid.UUID | None = None


class CommentUpdate(BaseModel):
    content: str


class CommentOut(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    author_id: uuid.UUID
    content: str
    parent_id: uuid.UUID | None
    mentions: list | None
    is_edited: bool
    created_at: Any
    updated_at: Any
    replies: list[dict] | None = None

    model_config = {"from_attributes": True}


# ── Comment endpoints ────────────────────────────────────────────────────────

@router.post(
    "/{project_id}/tasks/{task_id}/comments",
    status_code=status.HTTP_201_CREATED,
    summary="Create a comment on a task",
)
async def create_comment(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: CommentCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    task = await db.get(Task, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found")

    # Validate parent comment if threading
    if payload.parent_id:
        parent = await db.get(TaskComment, payload.parent_id)
        if not parent or parent.task_id != task_id:
            raise HTTPException(status_code=404, detail="Parent comment not found")

    # Parse @mentions
    mentioned_ids = _extract_mentions(payload.content)

    comment = TaskComment(
        task_id=task_id,
        author_id=current_user.id,
        content=payload.content,
        parent_id=payload.parent_id,
        mentions=mentioned_ids if mentioned_ids else None,
    )
    db.add(comment)

    # Create notifications for mentioned users
    for user_id_str in mentioned_ids:
        try:
            mentioned_uid = uuid.UUID(user_id_str)
            if mentioned_uid != current_user.id:
                notification = Notification(
                    user_id=mentioned_uid,
                    title="You were mentioned in a comment",
                    message=f"You were mentioned in a comment on task \"{task.title}\" in project \"{project.name}\"",
                    notification_type="mention",
                    link=f"/projects/{project_id}/tasks/{task_id}",
                )
                db.add(notification)
        except ValueError:
            continue

    # Audit log entry
    audit = TaskAuditLog(
        task_id=task_id,
        user_id=current_user.id,
        action="commented",
        changes={"comment_preview": payload.content[:200]},
    )
    db.add(audit)

    await db.commit()
    await db.refresh(comment)

    # Publish event
    await event_bus.publish("task.commented", {
        "task_id": str(task_id),
        "comment_id": str(comment.id),
        "author_id": str(current_user.id),
        "project_id": str(project_id),
        "project_name": project.name,
        "task_title": task.title,
        "mentions": mentioned_ids,
    })

    return CommentOut.model_validate(comment).model_dump()


@router.get(
    "/{project_id}/tasks/{task_id}/comments",
    summary="List comments for a task (threaded)",
)
async def list_comments(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    task = await db.get(Task, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found")

    # Get top-level comments (no parent)
    query = (
        select(TaskComment)
        .where(TaskComment.task_id == task_id, TaskComment.parent_id.is_(None))
        .order_by(TaskComment.created_at.asc())
    )

    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar() or 0

    result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    top_comments = result.scalars().all()

    # For each top-level comment, fetch replies
    output = []
    for c in top_comments:
        comment_data = CommentOut.model_validate(c).model_dump()
        replies_result = await db.execute(
            select(TaskComment)
            .where(TaskComment.parent_id == c.id)
            .order_by(TaskComment.created_at.asc())
        )
        replies = replies_result.scalars().all()
        comment_data["replies"] = [CommentOut.model_validate(r).model_dump() for r in replies]
        output.append(comment_data)

    return {"total": total, "comments": output}


@router.put(
    "/{project_id}/tasks/{task_id}/comments/{comment_id}",
    summary="Edit a comment",
)
async def update_comment(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    comment_id: uuid.UUID,
    payload: CommentUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    comment = await db.get(TaskComment, comment_id)
    if not comment or comment.task_id != task_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only edit your own comments")

    comment.content = payload.content
    comment.mentions = _extract_mentions(payload.content) or None
    comment.is_edited = True

    await db.commit()
    await db.refresh(comment)
    return CommentOut.model_validate(comment).model_dump()


@router.delete(
    "/{project_id}/tasks/{task_id}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a comment",
)
async def delete_comment(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    comment_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    comment = await db.get(TaskComment, comment_id)
    if not comment or comment.task_id != task_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.id and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")

    await db.delete(comment)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Activity feed (merged audit log + comments) ─────────────────────────────

@router.get(
    "/{project_id}/tasks/{task_id}/activity",
    summary="Merged activity feed: audit log + comments, sorted by time",
)
async def get_task_activity(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    task = await db.get(Task, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found")

    # Fetch audit log entries
    audit_result = await db.execute(
        select(TaskAuditLog)
        .where(TaskAuditLog.task_id == task_id)
        .order_by(TaskAuditLog.created_at.desc())
    )
    audit_entries = audit_result.scalars().all()

    # Fetch comments
    comment_result = await db.execute(
        select(TaskComment)
        .where(TaskComment.task_id == task_id)
        .order_by(TaskComment.created_at.desc())
    )
    comments = comment_result.scalars().all()

    # Merge and sort by created_at descending
    activities = []
    for e in audit_entries:
        activities.append({
            "type": "audit",
            "id": str(e.id),
            "user_id": str(e.user_id) if e.user_id else None,
            "action": e.action,
            "changes": e.changes,
            "created_at": e.created_at.isoformat(),
        })
    for c in comments:
        activities.append({
            "type": "comment",
            "id": str(c.id),
            "user_id": str(c.author_id),
            "content": c.content,
            "parent_id": str(c.parent_id) if c.parent_id else None,
            "mentions": c.mentions,
            "is_edited": c.is_edited,
            "created_at": c.created_at.isoformat(),
        })

    activities.sort(key=lambda x: x["created_at"], reverse=True)

    # Paginate
    total = len(activities)
    start = (page - 1) * limit
    end = start + limit

    return {"total": total, "activities": activities[start:end]}
