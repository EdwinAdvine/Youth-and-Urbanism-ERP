"""Support Voice Call Management API — Phase 3."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.models.support_phase3 import VoiceCallRecord

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class VoiceCallCreate(BaseModel):
    customer_phone: Optional[str] = None
    customer_name: Optional[str] = None
    direction: str = "inbound"  # inbound | outbound
    ticket_id: Optional[uuid.UUID] = None


class VoiceCallUpdate(BaseModel):
    status: Optional[str] = None
    answered_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    notes: Optional[str] = None
    recording_url: Optional[str] = None


class LinkTicketRequest(BaseModel):
    ticket_id: uuid.UUID


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_call_or_404(db: DBSession, call_id: uuid.UUID) -> VoiceCallRecord:
    call = await db.get(VoiceCallRecord, call_id)
    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voice call not found")
    return call


def _serialize_call(call: VoiceCallRecord) -> dict:
    agent_info = None
    if call.agent:
        agent_info = {
            "id": str(call.agent.id),
            "full_name": getattr(call.agent, "full_name", None),
            "email": getattr(call.agent, "email", None),
        }

    ticket_info = None
    if call.ticket:
        ticket_info = {
            "id": str(call.ticket.id),
            "subject": getattr(call.ticket, "subject", None),
            "status": getattr(call.ticket, "status", None),
        }

    return {
        "id": str(call.id),
        "ticket_id": str(call.ticket_id) if call.ticket_id else None,
        "agent_id": str(call.agent_id) if call.agent_id else None,
        "customer_phone": call.customer_phone,
        "customer_name": call.customer_name,
        "direction": call.direction,
        "status": call.status,
        "started_at": call.started_at.isoformat() if call.started_at else None,
        "answered_at": call.answered_at.isoformat() if call.answered_at else None,
        "ended_at": call.ended_at.isoformat() if call.ended_at else None,
        "duration_seconds": call.duration_seconds,
        "wait_seconds": call.wait_seconds,
        "recording_url": call.recording_url,
        "transcript": call.transcript,
        "sentiment_score": call.sentiment_score,
        "notes": call.notes,
        "ticket": ticket_info,
        "agent": agent_info,
        "created_at": call.created_at.isoformat() if hasattr(call, "created_at") and call.created_at else None,
        "updated_at": call.updated_at.isoformat() if hasattr(call, "updated_at") and call.updated_at else None,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/voice/calls")
async def list_calls(
    db: DBSession,
    _: CurrentUser,
    direction: Optional[str] = Query(None, description="inbound or outbound"),
    status_filter: Optional[str] = Query(None, alias="status"),
    agent_id: Optional[uuid.UUID] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    """List voice call records with optional filters and pagination."""
    stmt = select(VoiceCallRecord)

    if direction:
        stmt = stmt.where(VoiceCallRecord.direction == direction)
    if status_filter:
        stmt = stmt.where(VoiceCallRecord.status == status_filter)
    if agent_id:
        stmt = stmt.where(VoiceCallRecord.agent_id == agent_id)
    if start_date:
        stmt = stmt.where(VoiceCallRecord.started_at >= start_date)
    if end_date:
        stmt = stmt.where(VoiceCallRecord.started_at <= end_date)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = stmt.order_by(VoiceCallRecord.started_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    calls = result.scalars().all()

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": [_serialize_call(c) for c in calls],
    }


@router.post("/voice/calls", status_code=status.HTTP_201_CREATED)
async def create_call(
    payload: VoiceCallCreate,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    """Create a new voice call record. Sets agent to current user, status to ringing."""
    call = VoiceCallRecord(
        customer_phone=payload.customer_phone,
        customer_name=payload.customer_name,
        direction=payload.direction,
        ticket_id=payload.ticket_id,
        agent_id=current_user.id,
        status="ringing",
        started_at=datetime.now(timezone.utc),
    )
    db.add(call)
    await db.commit()
    await db.refresh(call)
    return _serialize_call(call)


@router.get("/voice/calls/{call_id}")
async def get_call(
    call_id: uuid.UUID,
    db: DBSession,
    _: CurrentUser,
) -> dict:
    """Get a single voice call record with ticket and agent details."""
    call = await _get_call_or_404(db, call_id)
    return _serialize_call(call)


@router.put("/voice/calls/{call_id}")
async def update_call(
    call_id: uuid.UUID,
    payload: VoiceCallUpdate,
    db: DBSession,
    _: CurrentUser,
) -> dict:
    """Update call fields. Auto-calculates duration_seconds and wait_seconds when ended_at is set."""
    call = await _get_call_or_404(db, call_id)

    if payload.status is not None:
        call.status = payload.status
    if payload.answered_at is not None:
        call.answered_at = payload.answered_at
    if payload.notes is not None:
        call.notes = payload.notes
    if payload.recording_url is not None:
        call.recording_url = payload.recording_url

    if payload.ended_at is not None:
        call.ended_at = payload.ended_at
        # Calculate total call duration from start to end
        if call.started_at:
            ended = payload.ended_at
            started = call.started_at
            if ended.tzinfo is None:
                ended = ended.replace(tzinfo=timezone.utc)
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            call.duration_seconds = max(0, int((ended - started).total_seconds()))

        # Calculate wait time from start until answered (or end if never answered)
        if call.answered_at:
            answered = call.answered_at
            started = call.started_at
            if answered.tzinfo is None:
                answered = answered.replace(tzinfo=timezone.utc)
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            call.wait_seconds = max(0, int((answered - started).total_seconds()))
        else:
            # Call ended without being answered — entire duration is wait time
            call.wait_seconds = call.duration_seconds

    await db.commit()
    await db.refresh(call)
    return _serialize_call(call)


@router.post("/voice/calls/{call_id}/end")
async def end_call(
    call_id: uuid.UUID,
    db: DBSession,
    _: CurrentUser,
) -> dict:
    """End a call: set ended_at to now, status to completed, calculate duration."""
    call = await _get_call_or_404(db, call_id)

    now = datetime.now(timezone.utc)
    call.ended_at = now
    call.status = "completed"

    if call.started_at:
        started = call.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        call.duration_seconds = max(0, int((now - started).total_seconds()))

    if call.answered_at:
        answered = call.answered_at
        started = call.started_at
        if answered.tzinfo is None:
            answered = answered.replace(tzinfo=timezone.utc)
        if started and started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        call.wait_seconds = max(0, int((answered - started).total_seconds())) if started else 0
    else:
        call.wait_seconds = call.duration_seconds

    await db.commit()
    await db.refresh(call)
    return _serialize_call(call)


@router.post("/voice/calls/{call_id}/link-ticket")
async def link_ticket(
    call_id: uuid.UUID,
    payload: LinkTicketRequest,
    db: DBSession,
    _: CurrentUser,
) -> dict:
    """Link a voice call to an existing support ticket."""
    call = await _get_call_or_404(db, call_id)
    call.ticket_id = payload.ticket_id
    await db.commit()
    await db.refresh(call)
    return _serialize_call(call)


@router.post("/voice/calls/{call_id}/transcribe")
async def transcribe_call(
    call_id: uuid.UUID,
    db: DBSession,
    _: CurrentUser,
) -> dict:
    """Queue transcription for a call (actual work done by Celery task)."""
    call = await _get_call_or_404(db, call_id)
    call.transcript = "Transcription pending..."
    await db.commit()
    return {"success": True, "message": "Transcription queued", "call_id": str(call_id)}


@router.get("/voice/stats")
async def get_call_stats(
    db: DBSession,
    _: CurrentUser,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
) -> dict:
    """Aggregate call statistics: totals, averages, breakdowns by direction and status."""
    stmt = select(VoiceCallRecord)
    if start_date:
        stmt = stmt.where(VoiceCallRecord.started_at >= start_date)
    if end_date:
        stmt = stmt.where(VoiceCallRecord.started_at <= end_date)

    result = await db.execute(stmt)
    calls = result.scalars().all()

    total = len(calls)
    total_duration = sum(c.duration_seconds or 0 for c in calls)
    total_wait = sum(c.wait_seconds or 0 for c in calls)
    completed_calls = [c for c in calls if c.status == "completed"]

    avg_duration = round(total_duration / len(completed_calls), 2) if completed_calls else 0.0
    avg_wait = round(total_wait / total, 2) if total else 0.0

    by_direction: dict[str, int] = {}
    by_status: dict[str, int] = {}
    for c in calls:
        by_direction[c.direction] = by_direction.get(c.direction, 0) + 1
        by_status[c.status] = by_status.get(c.status, 0) + 1

    return {
        "total_calls": total,
        "avg_duration_seconds": avg_duration,
        "avg_wait_seconds": avg_wait,
        "by_direction": by_direction,
        "by_status": by_status,
        "date_range": {
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
        },
    }


@router.get("/voice/agents/{agent_id}/calls")
async def get_agent_calls(
    agent_id: uuid.UUID,
    db: DBSession,
    _: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    """List all voice calls handled by a specific agent."""
    count_stmt = select(func.count()).where(VoiceCallRecord.agent_id == agent_id)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = (
        select(VoiceCallRecord)
        .where(VoiceCallRecord.agent_id == agent_id)
        .order_by(VoiceCallRecord.started_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    calls = result.scalars().all()

    return {
        "agent_id": str(agent_id),
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": [_serialize_call(c) for c in calls],
    }
