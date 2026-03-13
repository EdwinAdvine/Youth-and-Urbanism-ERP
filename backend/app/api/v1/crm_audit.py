"""CRM Audit Log — endpoints for viewing and recording CRM entity audit trails."""

import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.models.crm_audit import CRMAuditLog

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class AuditLogOut(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    action: str
    changes: dict | None = None
    user_id: uuid.UUID
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogCreate(BaseModel):
    entity_type: str
    entity_id: uuid.UUID
    action: str
    changes: dict | None = None
    ip_address: str | None = None
    user_agent: str | None = None


class AuditStatRow(BaseModel):
    action: str
    count: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/audit-log", response_model=dict)
async def list_audit_logs(
    current_user: CurrentUser,
    db: DBSession,
    entity_type: str | None = Query(None),
    action: str | None = Query(None),
    user_id: uuid.UUID | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    """List all audit entries with optional filters, ordered by created_at desc."""
    base = select(CRMAuditLog)

    if entity_type is not None:
        base = base.where(CRMAuditLog.entity_type == entity_type)
    if action is not None:
        base = base.where(CRMAuditLog.action == action)
    if user_id is not None:
        base = base.where(CRMAuditLog.user_id == user_id)
    if start_date is not None:
        base = base.where(CRMAuditLog.created_at >= datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc))
    if end_date is not None:
        base = base.where(CRMAuditLog.created_at < datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc))

    total_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(total_q)).scalar() or 0

    items_q = base.order_by(CRMAuditLog.created_at.desc()).offset(skip).limit(limit)
    rows = (await db.execute(items_q)).scalars().all()

    return {"total": total, "items": [AuditLogOut.model_validate(r) for r in rows]}


@router.get("/audit-log/entity/{entity_type}/{entity_id}", response_model=dict)
async def get_entity_audit_trail(
    entity_type: str,
    entity_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    """Get the full audit trail for a specific entity, ordered by created_at desc."""
    base = select(CRMAuditLog).where(
        CRMAuditLog.entity_type == entity_type,
        CRMAuditLog.entity_id == entity_id,
    )

    total_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(total_q)).scalar() or 0

    items_q = base.order_by(CRMAuditLog.created_at.desc()).offset(skip).limit(limit)
    rows = (await db.execute(items_q)).scalars().all()

    return {"total": total, "items": [AuditLogOut.model_validate(r) for r in rows]}


@router.get("/audit-log/stats", response_model=list[AuditStatRow])
async def get_audit_stats(
    current_user: CurrentUser,
    db: DBSession,
) -> list[AuditStatRow]:
    """Count of actions by type in the last 30 days."""
    since = datetime.now(timezone.utc) - timedelta(days=30)

    q = (
        select(CRMAuditLog.action, func.count().label("count"))
        .where(CRMAuditLog.created_at >= since)
        .group_by(CRMAuditLog.action)
        .order_by(func.count().desc())
    )
    rows = (await db.execute(q)).all()

    return [AuditStatRow(action=r.action, count=r.count) for r in rows]


@router.post("/audit-log", response_model=AuditLogOut, status_code=status.HTTP_201_CREATED)
async def create_audit_entry(
    payload: AuditLogCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> AuditLogOut:
    """Record a new audit log entry (used internally / by middleware)."""
    entry = CRMAuditLog(
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        action=payload.action,
        changes=payload.changes,
        user_id=current_user.id,
        ip_address=payload.ip_address,
        user_agent=payload.user_agent,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    return AuditLogOut.model_validate(entry)
