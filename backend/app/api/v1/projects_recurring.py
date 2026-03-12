"""Projects API — Recurring task configurations."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.projects import Project, Task
from app.models.projects_enhanced import RecurringTaskConfig

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _user_can_access_project(project: Project, user_id: uuid.UUID) -> bool:
    if project.owner_id == user_id:
        return True
    members = project.members or []
    return str(user_id) in [str(m) for m in members]


VALID_RECURRENCE_TYPES = {"daily", "weekly", "monthly", "custom"}


def _calculate_next_run(
    recurrence_type: str,
    interval: int,
    day_of_week: int | None,
    day_of_month: int | None,
    from_time: datetime | None = None,
) -> datetime:
    """Calculate the next run time based on recurrence config."""
    now = from_time or datetime.now(timezone.utc)
    if recurrence_type == "daily":
        return now + timedelta(days=interval)
    elif recurrence_type == "weekly":
        return now + timedelta(weeks=interval)
    elif recurrence_type == "monthly":
        # Simple: add interval months
        month = now.month + interval
        year = now.year + (month - 1) // 12
        month = ((month - 1) % 12) + 1
        day = min(day_of_month or now.day, 28)  # Safe day
        return now.replace(year=year, month=month, day=day)
    else:
        # Custom — default to daily
        return now + timedelta(days=interval)


# ── Schemas ──────────────────────────────────────────────────────────────────

class RecurringConfigCreate(BaseModel):
    template_task: dict  # {title, description, status, priority, assignee_id, tags}
    recurrence_type: str  # daily | weekly | monthly | custom
    recurrence_interval: int = 1
    day_of_week: int | None = None  # 0=Mon..6=Sun
    day_of_month: int | None = None
    cron_expression: str | None = None
    next_run_at: datetime | None = None


class RecurringConfigUpdate(BaseModel):
    template_task: dict | None = None
    recurrence_type: str | None = None
    recurrence_interval: int | None = None
    day_of_week: int | None = None
    day_of_month: int | None = None
    cron_expression: str | None = None
    next_run_at: datetime | None = None
    is_active: bool | None = None


class RecurringConfigOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    template_task: dict
    recurrence_type: str
    recurrence_interval: int
    day_of_week: int | None
    day_of_month: int | None
    cron_expression: str | None
    next_run_at: datetime
    is_active: bool
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post(
    "/{project_id}/recurring",
    status_code=status.HTTP_201_CREATED,
    summary="Create a recurring task configuration",
)
async def create_recurring_config(
    project_id: uuid.UUID,
    payload: RecurringConfigCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.recurrence_type not in VALID_RECURRENCE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid recurrence_type. Must be one of: {', '.join(VALID_RECURRENCE_TYPES)}",
        )

    # Validate template has at least a title
    if not payload.template_task.get("title"):
        raise HTTPException(status_code=400, detail="template_task must include a 'title'")

    next_run = payload.next_run_at or _calculate_next_run(
        payload.recurrence_type,
        payload.recurrence_interval,
        payload.day_of_week,
        payload.day_of_month,
    )

    config = RecurringTaskConfig(
        project_id=project_id,
        template_task=payload.template_task,
        recurrence_type=payload.recurrence_type,
        recurrence_interval=payload.recurrence_interval,
        day_of_week=payload.day_of_week,
        day_of_month=payload.day_of_month,
        cron_expression=payload.cron_expression,
        next_run_at=next_run,
        created_by=current_user.id,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return RecurringConfigOut.model_validate(config).model_dump()


@router.get(
    "/{project_id}/recurring",
    summary="List recurring task configurations",
)
async def list_recurring_configs(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(RecurringTaskConfig)
        .where(RecurringTaskConfig.project_id == project_id)
        .order_by(RecurringTaskConfig.created_at.desc())
    )
    configs = result.scalars().all()
    return {
        "total": len(configs),
        "configs": [RecurringConfigOut.model_validate(c).model_dump() for c in configs],
    }


@router.put(
    "/{project_id}/recurring/{config_id}",
    summary="Update a recurring task configuration",
)
async def update_recurring_config(
    project_id: uuid.UUID,
    config_id: uuid.UUID,
    payload: RecurringConfigUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    config = await db.get(RecurringTaskConfig, config_id)
    if not config or config.project_id != project_id:
        raise HTTPException(status_code=404, detail="Recurring config not found")

    for attr, value in payload.model_dump(exclude_none=True).items():
        setattr(config, attr, value)

    await db.commit()
    await db.refresh(config)
    return RecurringConfigOut.model_validate(config).model_dump()


@router.delete(
    "/{project_id}/recurring/{config_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a recurring task configuration",
)
async def delete_recurring_config(
    project_id: uuid.UUID,
    config_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    config = await db.get(RecurringTaskConfig, config_id)
    if not config or config.project_id != project_id:
        raise HTTPException(status_code=404, detail="Recurring config not found")

    await db.delete(config)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


@router.post(
    "/{project_id}/recurring/{config_id}/trigger",
    summary="Manually trigger a recurring task to create the next occurrence",
)
async def trigger_recurring_task(
    project_id: uuid.UUID,
    config_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    config = await db.get(RecurringTaskConfig, config_id)
    if not config or config.project_id != project_id:
        raise HTTPException(status_code=404, detail="Recurring config not found")

    tmpl = config.template_task
    assignee_id = tmpl.get("assignee_id")

    task = Task(
        project_id=project_id,
        title=tmpl.get("title", "Recurring Task"),
        description=tmpl.get("description"),
        assignee_id=uuid.UUID(assignee_id) if assignee_id else None,
        status=tmpl.get("status", "todo"),
        priority=tmpl.get("priority", "medium"),
        tags=tmpl.get("tags", []),
        recurring_config_id=config.id,
    )
    db.add(task)

    # Advance next_run_at
    config.next_run_at = _calculate_next_run(
        config.recurrence_type,
        config.recurrence_interval,
        config.day_of_week,
        config.day_of_month,
        from_time=config.next_run_at,
    )

    await db.commit()
    await db.refresh(task)
    return {
        "task_id": str(task.id),
        "title": task.title,
        "next_run_at": config.next_run_at.isoformat(),
    }
