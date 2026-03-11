"""Per-app admin dashboard endpoints.

Provides stats, config read, and config update scoped to individual
application modules (mail, forms, projects, drive, calendar, notes, etc.).
Access requires either Super Admin privileges or an AppAdmin record for
the requested app.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_app_admin
from app.models.user import AppAdmin, User
from app.models.calendar import CalendarEvent
from app.models.drive import DriveFile, DriveFolder
from app.models.forms import Form, FormField, FormResponse
from app.models.notes import Note
from app.models.projects import Milestone, Project, Task, TimeLog

router = APIRouter()

# ── Supported apps and their stat queries ──────────────────────────────────

SUPPORTED_APPS = {
    "mail",
    "forms",
    "projects",
    "drive",
    "calendar",
    "notes",
    "docs",
    "teams",
    "analytics",
    "hr",
    "crm",
    "finance",
    "inventory",
}

# Default configuration per app (mutable through PUT)
DEFAULT_APP_CONFIGS: dict[str, dict[str, Any]] = {
    "mail": {
        "max_attachment_size_mb": 25,
        "allow_external_recipients": True,
        "auto_save_drafts": True,
    },
    "forms": {
        "max_fields_per_form": 50,
        "allow_anonymous_responses": True,
        "max_file_upload_mb": 10,
    },
    "projects": {
        "default_task_status": "todo",
        "max_members_per_project": 50,
        "enable_time_tracking": True,
    },
    "drive": {
        "max_file_size_mb": 100,
        "allowed_extensions": [],
        "enable_public_sharing": False,
    },
    "calendar": {
        "default_event_duration_minutes": 60,
        "enable_jitsi_integration": True,
        "max_attendees_per_event": 100,
    },
    "notes": {
        "max_note_size_kb": 500,
        "enable_pinning": True,
        "max_tags_per_note": 20,
    },
    "docs": {
        "enable_collaborative_editing": True,
        "auto_save_interval_seconds": 30,
        "max_document_size_mb": 50,
    },
    "teams": {
        "max_participants_per_meeting": 100,
        "enable_recording": False,
        "default_video_quality": "720p",
    },
    "analytics": {
        "auto_refresh_interval_seconds": 300,
        "max_dashboard_widgets": 20,
        "enable_data_export": True,
    },
    "hr": {"enable_leave_management": True, "enable_payroll": False},
    "crm": {"enable_lead_scoring": True, "max_pipeline_stages": 10},
    "finance": {"default_currency": "USD", "enable_multi_currency": False},
    "inventory": {"enable_barcode_scanning": True, "low_stock_threshold": 10},
}

# In-memory config store — in production this would be a DB table or Redis.
# Deep-copy defaults so mutations don't affect the template.
import copy  # noqa: E402

_app_configs: dict[str, dict[str, Any]] = copy.deepcopy(DEFAULT_APP_CONFIGS)


# ── Pydantic schemas ──────────────────────────────────────────────────────

class AppStats(BaseModel):
    app_name: str
    stats: dict[str, Any]


class AppConfig(BaseModel):
    app_name: str
    config: dict[str, Any]


class AppConfigUpdate(BaseModel):
    config: dict[str, Any]


# ── Helper: resolve the dependency for path-param app_name ─────────────────

def _validate_app(app_name: str) -> str:
    if app_name not in SUPPORTED_APPS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown application: '{app_name}'. Supported: {sorted(SUPPORTED_APPS)}",
        )
    return app_name


async def _require_app_or_super(
    app_name: str,
    db: AsyncSession,
    current_user: User,
) -> User:
    """Check that the current user is either a super admin or app admin for *app_name*."""
    if current_user.is_superadmin:
        return current_user

    from app.core.rbac import is_app_admin  # noqa: PLC0415

    if not await is_app_admin(db, str(current_user.id), app_name):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Admin access to '{app_name}' required",
        )
    return current_user


# ── Stat collectors per app ───────────────────────────────────────────────

async def _stats_notes(db: AsyncSession) -> dict[str, Any]:
    total = (await db.execute(select(func.count(Note.id)))).scalar() or 0
    pinned = (
        await db.execute(select(func.count(Note.id)).where(Note.is_pinned.is_(True)))
    ).scalar() or 0
    return {"total_notes": total, "pinned_notes": pinned}


async def _stats_forms(db: AsyncSession) -> dict[str, Any]:
    total_forms = (await db.execute(select(func.count(Form.id)))).scalar() or 0
    published = (
        await db.execute(
            select(func.count(Form.id)).where(Form.is_published.is_(True))
        )
    ).scalar() or 0
    total_responses = (await db.execute(select(func.count(FormResponse.id)))).scalar() or 0
    total_fields = (await db.execute(select(func.count(FormField.id)))).scalar() or 0
    return {
        "total_forms": total_forms,
        "published_forms": published,
        "total_responses": total_responses,
        "total_fields": total_fields,
    }


async def _stats_projects(db: AsyncSession) -> dict[str, Any]:
    total_projects = (await db.execute(select(func.count(Project.id)))).scalar() or 0
    active = (
        await db.execute(
            select(func.count(Project.id)).where(Project.status == "active")
        )
    ).scalar() or 0
    total_tasks = (await db.execute(select(func.count(Task.id)))).scalar() or 0
    completed_tasks = (
        await db.execute(
            select(func.count(Task.id)).where(Task.status == "done")
        )
    ).scalar() or 0
    total_milestones = (await db.execute(select(func.count(Milestone.id)))).scalar() or 0
    total_time_logs = (await db.execute(select(func.count(TimeLog.id)))).scalar() or 0
    return {
        "total_projects": total_projects,
        "active_projects": active,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "total_milestones": total_milestones,
        "total_time_logs": total_time_logs,
    }


async def _stats_drive(db: AsyncSession) -> dict[str, Any]:
    total_files = (await db.execute(select(func.count(DriveFile.id)))).scalar() or 0
    total_folders = (await db.execute(select(func.count(DriveFolder.id)))).scalar() or 0
    total_size = (await db.execute(select(func.coalesce(func.sum(DriveFile.size), 0)))).scalar() or 0
    public_files = (
        await db.execute(
            select(func.count(DriveFile.id)).where(DriveFile.is_public.is_(True))
        )
    ).scalar() or 0
    return {
        "total_files": total_files,
        "total_folders": total_folders,
        "total_storage_bytes": total_size,
        "public_files": public_files,
    }


async def _stats_calendar(db: AsyncSession) -> dict[str, Any]:
    total_events = (await db.execute(select(func.count(CalendarEvent.id)))).scalar() or 0
    meetings = (
        await db.execute(
            select(func.count(CalendarEvent.id)).where(
                CalendarEvent.event_type == "meeting"
            )
        )
    ).scalar() or 0
    return {"total_events": total_events, "total_meetings": meetings}


async def _stats_users(db: AsyncSession) -> dict[str, Any]:
    """Generic user-count stats used for apps that don't yet have domain tables."""
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    active_users = (
        await db.execute(
            select(func.count(User.id)).where(User.is_active.is_(True))
        )
    ).scalar() or 0
    return {"total_users": total_users, "active_users": active_users}


_STAT_COLLECTORS: dict[str, Any] = {
    "notes": _stats_notes,
    "forms": _stats_forms,
    "projects": _stats_projects,
    "drive": _stats_drive,
    "calendar": _stats_calendar,
}


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get(
    "/apps/{app_name}/stats",
    response_model=AppStats,
    summary="Get statistics for an application module",
)
async def get_app_stats(
    app_name: str = Path(..., description="Application module name"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AppStats:
    _validate_app(app_name)
    await _require_app_or_super(app_name, db, current_user)

    collector = _STAT_COLLECTORS.get(app_name)
    if collector:
        stats = await collector(db)
    else:
        # For apps without dedicated models, return generic user stats
        stats = await _stats_users(db)

    return AppStats(app_name=app_name, stats=stats)


@router.get(
    "/apps/{app_name}/config",
    response_model=AppConfig,
    summary="Get configuration for an application module",
)
async def get_app_config(
    app_name: str = Path(..., description="Application module name"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AppConfig:
    _validate_app(app_name)
    await _require_app_or_super(app_name, db, current_user)

    config = _app_configs.get(app_name, {})
    return AppConfig(app_name=app_name, config=config)


@router.put(
    "/apps/{app_name}/config",
    response_model=AppConfig,
    summary="Update configuration for an application module",
)
async def update_app_config(
    body: AppConfigUpdate,
    app_name: str = Path(..., description="Application module name"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AppConfig:
    _validate_app(app_name)
    await _require_app_or_super(app_name, db, current_user)

    # Merge supplied keys into existing config (partial update)
    existing = _app_configs.get(app_name, {})
    existing.update(body.config)
    _app_configs[app_name] = existing

    return AppConfig(app_name=app_name, config=existing)
