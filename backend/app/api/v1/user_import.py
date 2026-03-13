"""Bulk User Import API — CSV upload, preview, confirm (Super Admin only)."""

from typing import Any

from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel

from app.core.deps import DBSession, SuperAdminUser
from app.services.user_import import batch_create_users, parse_csv_preview

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class UserImportRow(BaseModel):
    email: str
    full_name: str
    role: str | None = None
    password: str | None = None
    department: str | None = None
    row: int | None = None


class ConfirmPayload(BaseModel):
    users: list[UserImportRow] | None = None
    rows: list[UserImportRow] | None = None


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post(
    "/users/import/preview",
    summary="Upload CSV and preview user import (Super Admin)",
)
async def import_preview(
    _: SuperAdminUser,
    db: DBSession,
    file: UploadFile = File(..., description="CSV file with email, full_name columns"),
) -> dict[str, Any]:
    """
    Parse the uploaded CSV, validate each row (format, duplicates in DB),
    and return a preview of valid and error rows.
    """
    content = await file.read()
    csv_text = content.decode("utf-8-sig")  # handles BOM
    return await parse_csv_preview(db, csv_text)


@router.post(
    "/users/import/confirm",
    summary="Confirm bulk user import from validated rows (Super Admin)",
)
async def import_confirm(
    payload: ConfirmPayload,
    _: SuperAdminUser,
    db: DBSession,
) -> dict[str, Any]:
    """
    Accept the validated rows from the preview step and batch-create users.
    Supports both ``{ "users": [...] }`` and ``{ "rows": [...] }`` payloads.
    """
    rows = payload.users or payload.rows or []
    if not rows:
        return {
            "created_count": 0,
            "skipped_count": 0,
            "created_users": [],
            "skipped": [],
            "created": 0,
            "message": "No users to import",
        }
    return await batch_create_users(db, [r.model_dump() for r in rows])
