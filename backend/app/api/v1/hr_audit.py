"""HR Audit API — field-level change tracking and sensitive access logs."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.models.hr_phase1 import AuditFieldChange

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────


class AuditFieldChangeOut(BaseModel):
    id: uuid.UUID
    table_name: str
    record_id: uuid.UUID
    field_name: str
    old_value: str | None
    new_value: str | None
    changed_by: uuid.UUID
    change_reason: str | None
    ip_address: str | None
    created_at: Any

    model_config = {"from_attributes": True}


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/audit/changes", summary="Query field-level change history")
async def list_audit_changes(
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
    table_name: str | None = Query(None),
    record_id: uuid.UUID | None = Query(None),
    field_name: str | None = Query(None),
    changed_by: uuid.UUID | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """Query audit trail of field-level changes on HR records."""
    query = select(AuditFieldChange)
    count_query = select(func.count()).select_from(AuditFieldChange)

    filters = []
    if table_name:
        filters.append(AuditFieldChange.table_name == table_name)
    if record_id:
        filters.append(AuditFieldChange.record_id == record_id)
    if field_name:
        filters.append(AuditFieldChange.field_name == field_name)
    if changed_by:
        filters.append(AuditFieldChange.changed_by == changed_by)
    if start_date:
        filters.append(AuditFieldChange.created_at >= start_date)
    if end_date:
        filters.append(AuditFieldChange.created_at <= end_date)

    if filters:
        query = query.where(and_(*filters))
        count_query = count_query.where(and_(*filters))

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(
        query.order_by(AuditFieldChange.created_at.desc()).offset(offset).limit(limit)
    )
    items = [AuditFieldChangeOut.model_validate(r).model_dump() for r in result.scalars().all()]

    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/audit/changes/{record_id}", summary="All changes for a specific record")
async def get_record_changes(
    record_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    """Get full change history for a specific HR record."""
    result = await db.execute(
        select(AuditFieldChange)
        .where(AuditFieldChange.record_id == record_id)
        .order_by(AuditFieldChange.created_at.desc())
    )
    items = [AuditFieldChangeOut.model_validate(r).model_dump() for r in result.scalars().all()]
    return {"items": items, "total": len(items)}


@router.get("/audit/sensitive-access", summary="Log of sensitive field access")
async def sensitive_access_log(
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """Query access log for sensitive HR fields (salary, SSN, etc.)."""
    sensitive_fields = ["salary", "ssn", "bank_account", "tax_id", "national_id"]
    query = select(AuditFieldChange).where(
        AuditFieldChange.field_name.in_(sensitive_fields)
    )
    count_query = select(func.count()).select_from(AuditFieldChange).where(
        AuditFieldChange.field_name.in_(sensitive_fields)
    )

    if start_date:
        query = query.where(AuditFieldChange.created_at >= start_date)
        count_query = count_query.where(AuditFieldChange.created_at >= start_date)
    if end_date:
        query = query.where(AuditFieldChange.created_at <= end_date)
        count_query = count_query.where(AuditFieldChange.created_at <= end_date)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(
        query.order_by(AuditFieldChange.created_at.desc()).offset(offset).limit(limit)
    )
    items = [AuditFieldChangeOut.model_validate(r).model_dump() for r in result.scalars().all()]

    return {"items": items, "total": total, "page": page, "limit": limit}
