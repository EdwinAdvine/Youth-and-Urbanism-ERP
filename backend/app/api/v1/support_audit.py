"""Support Audit Log API — full ticket change history."""

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, select

from app.core.deps import CurrentUser, DBSession
from app.models.support import Ticket
from app.models.support_phase1 import TicketAuditLog

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class AuditLogOut(BaseModel):
    id: uuid.UUID
    ticket_id: uuid.UUID
    user_id: uuid.UUID | None
    user_name: str | None = None
    action: str
    field_name: str | None
    old_value: str | None
    new_value: str | None
    ip_address: str | None
    created_at: Any

    model_config = {"from_attributes": True}


# ── Helper ────────────────────────────────────────────────────────────────────

async def write_audit_log(
    db,
    ticket_id: uuid.UUID,
    user_id: uuid.UUID | None,
    action: str,
    field_name: str | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
    ip_address: str | None = None,
) -> None:
    """Write a single audit log entry (call from other support endpoints)."""
    entry = TicketAuditLog(
        ticket_id=ticket_id,
        user_id=user_id,
        action=action,
        field_name=field_name,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        ip_address=ip_address,
    )
    db.add(entry)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/tickets/{ticket_id}/audit-log", summary="Get audit trail for a ticket")
async def get_ticket_audit_log(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    filters = [TicketAuditLog.ticket_id == ticket_id]

    count_q = select(func.count()).select_from(TicketAuditLog).where(and_(*filters))
    total = (await db.execute(count_q)).scalar() or 0

    q = (
        select(TicketAuditLog)
        .where(and_(*filters))
        .order_by(TicketAuditLog.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(q)
    entries = result.scalars().all()

    return {
        "total": total,
        "entries": [
            {
                **AuditLogOut.model_validate(e).model_dump(),
                "user_name": e.user.full_name if e.user else None,
            }
            for e in entries
        ],
    }


@router.get("/audit-log", summary="Global support audit log with filters")
async def global_audit_log(
    current_user: CurrentUser,
    db: DBSession,
    ticket_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    action: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    filters = []
    if ticket_id:
        filters.append(TicketAuditLog.ticket_id == ticket_id)
    if user_id:
        filters.append(TicketAuditLog.user_id == user_id)
    if action:
        filters.append(TicketAuditLog.action == action)

    count_q = select(func.count()).select_from(TicketAuditLog)
    if filters:
        count_q = count_q.where(and_(*filters))
    total = (await db.execute(count_q)).scalar() or 0

    q = select(TicketAuditLog).order_by(TicketAuditLog.created_at.desc()).offset((page - 1) * limit).limit(limit)
    if filters:
        q = q.where(and_(*filters))
    result = await db.execute(q)
    entries = result.scalars().all()

    return {
        "total": total,
        "entries": [
            {
                **AuditLogOut.model_validate(e).model_dump(),
                "user_name": e.user.full_name if e.user else None,
            }
            for e in entries
        ],
    }
