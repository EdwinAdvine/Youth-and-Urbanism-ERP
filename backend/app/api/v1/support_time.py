"""Support Time Tracking API — start/stop timer, time entries per ticket."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, select

from app.core.deps import CurrentUser, DBSession
from app.models.support import Ticket
from app.models.support_phase1 import TicketTimeEntry

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class TimeEntryOut(BaseModel):
    id: uuid.UUID
    ticket_id: uuid.UUID
    agent_id: uuid.UUID
    agent_name: str | None = None
    started_at: Any
    ended_at: Any | None
    duration_seconds: int | None
    is_billable: bool
    billing_rate_hourly: float | None
    note: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class TimeEntryUpdate(BaseModel):
    is_billable: bool | None = None
    billing_rate_hourly: float | None = None
    note: str | None = None
    duration_seconds: int | None = None


class TimeReportEntry(BaseModel):
    agent_id: uuid.UUID
    agent_name: str | None = None
    total_seconds: int
    billable_seconds: int
    ticket_count: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/tickets/{ticket_id}/time/start", status_code=201, summary="Start time tracking on ticket")
async def start_timer(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Check for already-running timer
    running = await db.execute(
        select(TicketTimeEntry).where(
            and_(
                TicketTimeEntry.ticket_id == ticket_id,
                TicketTimeEntry.agent_id == current_user.id,
                TicketTimeEntry.ended_at.is_(None),
            )
        )
    )
    if running.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Timer already running on this ticket")

    entry = TicketTimeEntry(
        ticket_id=ticket_id,
        agent_id=current_user.id,
        started_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    return {
        **TimeEntryOut.model_validate(entry).model_dump(),
        "agent_name": current_user.full_name if hasattr(current_user, "full_name") else None,
    }


@router.post("/tickets/{ticket_id}/time/stop", summary="Stop running timer on ticket")
async def stop_timer(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(TicketTimeEntry).where(
            and_(
                TicketTimeEntry.ticket_id == ticket_id,
                TicketTimeEntry.agent_id == current_user.id,
                TicketTimeEntry.ended_at.is_(None),
            )
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="No running timer found")

    now = datetime.now(timezone.utc)
    entry.ended_at = now
    entry.duration_seconds = int((now - entry.started_at).total_seconds())

    await db.commit()
    await db.refresh(entry)

    return {
        **TimeEntryOut.model_validate(entry).model_dump(),
        "agent_name": entry.agent.full_name if entry.agent else None,
    }


@router.get("/tickets/{ticket_id}/time", summary="List time entries for a ticket")
async def list_time_entries(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    result = await db.execute(
        select(TicketTimeEntry)
        .where(TicketTimeEntry.ticket_id == ticket_id)
        .order_by(TicketTimeEntry.started_at.desc())
    )
    entries = result.scalars().all()

    return [
        {
            **TimeEntryOut.model_validate(e).model_dump(),
            "agent_name": e.agent.full_name if e.agent else None,
        }
        for e in entries
    ]


@router.put("/time-entries/{entry_id}", summary="Update a time entry")
async def update_time_entry(
    entry_id: uuid.UUID,
    payload: TimeEntryUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    entry = await db.get(TicketTimeEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    if entry.agent_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only edit own time entries")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(entry, field, value)

    await db.commit()
    await db.refresh(entry)

    return {
        **TimeEntryOut.model_validate(entry).model_dump(),
        "agent_name": entry.agent.full_name if entry.agent else None,
    }


@router.delete("/time-entries/{entry_id}", status_code=204, summary="Delete a time entry")
async def delete_time_entry(
    entry_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    entry = await db.get(TicketTimeEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    if entry.agent_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only delete own time entries")

    await db.delete(entry)
    await db.commit()


@router.get("/time/report", summary="Time tracking report by agent")
async def time_report(
    current_user: CurrentUser,
    db: DBSession,
    days: int = Query(30, ge=1, le=365),
) -> list[dict[str, Any]]:
    from datetime import timedelta

    since = datetime.now(timezone.utc) - timedelta(days=days)

    q = (
        select(
            TicketTimeEntry.agent_id,
            func.sum(TicketTimeEntry.duration_seconds).label("total_seconds"),
            func.sum(
                func.case(
                    (TicketTimeEntry.is_billable == True, TicketTimeEntry.duration_seconds),  # noqa: E712
                    else_=0,
                )
            ).label("billable_seconds"),
            func.count(func.distinct(TicketTimeEntry.ticket_id)).label("ticket_count"),
        )
        .where(
            and_(
                TicketTimeEntry.ended_at.isnot(None),
                TicketTimeEntry.started_at >= since,
            )
        )
        .group_by(TicketTimeEntry.agent_id)
        .order_by(func.sum(TicketTimeEntry.duration_seconds).desc())
    )

    result = await db.execute(q)
    rows = result.all()

    # Fetch agent names
    from app.models.user import User

    report = []
    for row in rows:
        agent = await db.get(User, row.agent_id)
        report.append({
            "agent_id": str(row.agent_id),
            "agent_name": agent.full_name if agent else None,
            "total_seconds": row.total_seconds or 0,
            "billable_seconds": row.billable_seconds or 0,
            "ticket_count": row.ticket_count or 0,
        })

    return report
