"""Super Admin drive/storage configuration endpoints.

All config is stored in the system_settings table as JSON values
under the 'drive_admin' category.
"""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel as PydanticBase
from sqlalchemy import select

from app.core.deps import DBSession, SuperAdminUser
from app.core.config import settings
from app.models.settings import SystemSettings

router = APIRouter()

CATEGORY = "drive_admin"


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_config(db, key: str, defaults: dict) -> dict:
    result = await db.execute(
        select(SystemSettings).where(
            SystemSettings.key == key,
            SystemSettings.category == CATEGORY,
        )
    )
    row = result.scalar_one_or_none()
    if row is None or row.value is None:
        return defaults
    try:
        return {**defaults, **json.loads(row.value)}
    except json.JSONDecodeError:
        return defaults


async def _put_config(db, key: str, data: dict) -> dict:
    result = await db.execute(
        select(SystemSettings).where(
            SystemSettings.key == key,
            SystemSettings.category == CATEGORY,
        )
    )
    row = result.scalar_one_or_none()
    value_str = json.dumps(data)
    if row is None:
        row = SystemSettings(key=key, value=value_str, category=CATEGORY)
        db.add(row)
    else:
        row.value = value_str
    await db.commit()
    return data


# ── Schemas ──────────────────────────────────────────────────────────────────

class DriveQuotas(PydanticBase):
    default_storage_quota_mb: int = 10240
    per_user_overrides: dict[str, int] = {}
    per_team_overrides: dict[str, int] = {}
    warn_at_percent: int = 90


class DriveFileTypes(PydanticBase):
    allowed_mime_types: list[str] = []
    blocked_mime_types: list[str] = [
        "application/x-msdownload",
        "application/x-executable",
    ]
    max_file_size_mb: int = 500


class DriveRetention(PydanticBase):
    auto_delete_trash_days: int = 30
    version_retention_count: int = 10
    version_retention_days: int = 90


class DriveHealth(PydanticBase):
    minio_connected: bool = False
    minio_url: str = ""
    total_buckets: int = 0
    storage_used_bytes: int = 0
    storage_used_display: str = "0 B"


# ── Drive Quotas ─────────────────────────────────────────────────────────────

DRIVE_QUOTAS_KEY = "drive_quotas"
DRIVE_QUOTAS_DEFAULTS = DriveQuotas().model_dump()


@router.get("/quotas", response_model=DriveQuotas, summary="Get drive storage quotas")
async def get_drive_quotas(
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _get_config(db, DRIVE_QUOTAS_KEY, DRIVE_QUOTAS_DEFAULTS)


@router.put("/quotas", response_model=DriveQuotas, summary="Update drive storage quotas")
async def update_drive_quotas(
    payload: DriveQuotas,
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _put_config(db, DRIVE_QUOTAS_KEY, payload.model_dump())


# ── File Types ───────────────────────────────────────────────────────────────

DRIVE_FILE_TYPES_KEY = "drive_file_types"
DRIVE_FILE_TYPES_DEFAULTS = DriveFileTypes().model_dump()


@router.get("/file-types", response_model=DriveFileTypes, summary="Get allowed/blocked file types")
async def get_drive_file_types(
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _get_config(db, DRIVE_FILE_TYPES_KEY, DRIVE_FILE_TYPES_DEFAULTS)


@router.put("/file-types", response_model=DriveFileTypes, summary="Update allowed/blocked file types")
async def update_drive_file_types(
    payload: DriveFileTypes,
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _put_config(db, DRIVE_FILE_TYPES_KEY, payload.model_dump())


# ── Retention ────────────────────────────────────────────────────────────────

DRIVE_RETENTION_KEY = "drive_retention"
DRIVE_RETENTION_DEFAULTS = DriveRetention().model_dump()


@router.get("/retention", response_model=DriveRetention, summary="Get drive retention policies")
async def get_drive_retention(
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _get_config(db, DRIVE_RETENTION_KEY, DRIVE_RETENTION_DEFAULTS)


@router.put("/retention", response_model=DriveRetention, summary="Update drive retention policies")
async def update_drive_retention(
    payload: DriveRetention,
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _put_config(db, DRIVE_RETENTION_KEY, payload.model_dump())


# ── Health Check ─────────────────────────────────────────────────────────────

def _format_bytes(size: int) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024  # type: ignore[assignment]
    return f"{size:.1f} PB"


@router.get("/health", response_model=DriveHealth, summary="Check MinIO connection and storage usage")
async def get_drive_health(
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    health = DriveHealth(minio_url=settings.MINIO_URL if hasattr(settings, "MINIO_URL") else "")
    try:
        from minio import Minio  # noqa: PLC0415

        endpoint = settings.MINIO_URL.replace("http://", "").replace("https://", "") if hasattr(settings, "MINIO_URL") else "minio:9000"
        secure = hasattr(settings, "MINIO_URL") and settings.MINIO_URL.startswith("https")
        client = Minio(
            endpoint,
            access_key=settings.MINIO_ACCESS_KEY if hasattr(settings, "MINIO_ACCESS_KEY") else "",
            secret_key=settings.MINIO_SECRET_KEY if hasattr(settings, "MINIO_SECRET_KEY") else "",
            secure=secure,
        )
        buckets = client.list_buckets()
        health.minio_connected = True
        health.total_buckets = len(buckets)

        # Approximate storage — sum object sizes across buckets
        total_bytes = 0
        for bucket in buckets:
            try:
                for obj in client.list_objects(bucket.name, recursive=True):
                    total_bytes += obj.size or 0
            except Exception:
                pass
        health.storage_used_bytes = total_bytes
        health.storage_used_display = _format_bytes(total_bytes)
    except Exception:
        health.minio_connected = False

    return health
