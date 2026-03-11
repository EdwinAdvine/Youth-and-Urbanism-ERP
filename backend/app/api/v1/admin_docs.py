"""Super Admin ONLYOFFICE / Docs configuration endpoints.

All config is stored in the system_settings table as JSON values
under the 'docs_admin' category.
"""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel as PydanticBase
from sqlalchemy import select

from app.core.deps import DBSession, SuperAdminUser
from app.models.settings import SystemSettings

router = APIRouter()

CATEGORY = "docs_admin"


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

class DocsServerConfig(PydanticBase):
    onlyoffice_url: str = "http://onlyoffice:80"
    jwt_secret: str = ""
    jwt_header: str = "Authorization"
    max_file_size_mb: int = 100
    autosave_enabled: bool = True
    autosave_interval_seconds: int = 300
    macros_enabled: bool = True
    macros_mode: str = "warn"  # "warn" | "enable" | "disable"
    plugins_enabled: bool = True


class DocsTemplates(PydanticBase):
    templates: list[dict[str, str]] = []
    # Each template: { "name": "Invoice Template", "type": "docx", "url": "..." }


class DocsQuotas(PydanticBase):
    default_storage_quota_mb: int = 2048
    per_user_overrides: dict[str, int] = {}
    max_concurrent_editors: int = 20


class DocsRetention(PydanticBase):
    retention_enabled: bool = False
    retention_days: int = 365
    exclude_pinned: bool = True
    exclude_shared: bool = True
    dry_run: bool = True


class DocsFileTypes(PydanticBase):
    allowed_document_types: list[str] = [
        "docx", "xlsx", "pptx", "pdf", "odt", "ods", "odp",
        "doc", "xls", "ppt", "csv", "txt", "rtf",
    ]
    allowed_image_types: list[str] = ["png", "jpg", "jpeg", "gif", "svg", "bmp"]
    enable_pdf_editing: bool = False


# ── Docs Server Config ───────────────────────────────────────────────────────

DOCS_CONFIG_KEY = "docs_server_config"
DOCS_CONFIG_DEFAULTS = DocsServerConfig().model_dump()


@router.get("/config", response_model=DocsServerConfig, summary="Get ONLYOFFICE server configuration")
async def get_docs_config(
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _get_config(db, DOCS_CONFIG_KEY, DOCS_CONFIG_DEFAULTS)


@router.put("/config", response_model=DocsServerConfig, summary="Update ONLYOFFICE server configuration")
async def update_docs_config(
    payload: DocsServerConfig,
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _put_config(db, DOCS_CONFIG_KEY, payload.model_dump())


# ── Document Templates ───────────────────────────────────────────────────────

DOCS_TEMPLATES_KEY = "docs_templates"
DOCS_TEMPLATES_DEFAULTS = DocsTemplates().model_dump()


@router.get("/templates", response_model=DocsTemplates, summary="Get system document templates")
async def get_docs_templates(
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _get_config(db, DOCS_TEMPLATES_KEY, DOCS_TEMPLATES_DEFAULTS)


@router.put("/templates", response_model=DocsTemplates, summary="Update system document templates")
async def update_docs_templates(
    payload: DocsTemplates,
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _put_config(db, DOCS_TEMPLATES_KEY, payload.model_dump())


# ── Docs Quotas ──────────────────────────────────────────────────────────────

DOCS_QUOTAS_KEY = "docs_quotas"
DOCS_QUOTAS_DEFAULTS = DocsQuotas().model_dump()


@router.get("/quotas", response_model=DocsQuotas, summary="Get docs storage quotas")
async def get_docs_quotas(
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _get_config(db, DOCS_QUOTAS_KEY, DOCS_QUOTAS_DEFAULTS)


@router.put("/quotas", response_model=DocsQuotas, summary="Update docs storage quotas")
async def update_docs_quotas(
    payload: DocsQuotas,
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _put_config(db, DOCS_QUOTAS_KEY, payload.model_dump())


# ── File Types ───────────────────────────────────────────────────────────────

DOCS_FILE_TYPES_KEY = "docs_file_types"
DOCS_FILE_TYPES_DEFAULTS = DocsFileTypes().model_dump()


@router.get("/file-types", response_model=DocsFileTypes, summary="Get allowed document types")
async def get_docs_file_types(
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _get_config(db, DOCS_FILE_TYPES_KEY, DOCS_FILE_TYPES_DEFAULTS)


@router.put("/file-types", response_model=DocsFileTypes, summary="Update allowed document types")
async def update_docs_file_types(
    payload: DocsFileTypes,
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _put_config(db, DOCS_FILE_TYPES_KEY, payload.model_dump())


# ── Document Retention Policy ───────────────────────────────────────────────

DOCS_RETENTION_KEY = "docs_retention"
DOCS_RETENTION_DEFAULTS = DocsRetention().model_dump()


@router.get("/retention", response_model=DocsRetention, summary="Get document retention policy")
async def get_docs_retention(
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _get_config(db, DOCS_RETENTION_KEY, DOCS_RETENTION_DEFAULTS)


@router.put("/retention", response_model=DocsRetention, summary="Update document retention policy")
async def update_docs_retention(
    payload: DocsRetention,
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _put_config(db, DOCS_RETENTION_KEY, payload.model_dump())
