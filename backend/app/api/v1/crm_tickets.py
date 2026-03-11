"""CRM Tickets API — CRUD for CRM support tickets."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select

from app.core.deps import CurrentUser, DBSession
from app.core.sanitize import like_pattern
from app.models.crm import CRMTicket

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class TicketCreate(BaseModel):
    contact_id: uuid.UUID | None = None
    subject: str
    description: str | None = None
    status: str = "open"
    priority: str = "medium"
    assigned_to: uuid.UUID | None = None


class TicketUpdate(BaseModel):
    contact_id: uuid.UUID | None = None
    subject: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    assigned_to: uuid.UUID | None = None


class TicketAssign(BaseModel):
    assigned_to: uuid.UUID


class TicketOut(BaseModel):
    id: uuid.UUID
    contact_id: uuid.UUID | None
    subject: str
    description: str | None
    status: str
    priority: str
    assigned_to: uuid.UUID | None
    created_by: uuid.UUID
    resolved_at: Any | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/tickets", summary="List CRM tickets")
async def list_tickets(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status", description="Filter by ticket status"),
    priority: str | None = Query(None, description="Filter by priority"),
    assigned_to: uuid.UUID | None = Query(None, description="Filter by assigned user"),
    search: str | None = Query(None, description="Search subject or description"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(CRMTicket)

    if status_filter:
        query = query.where(CRMTicket.status == status_filter)
    if priority:
        query = query.where(CRMTicket.priority == priority)
    if assigned_to:
        query = query.where(CRMTicket.assigned_to == assigned_to)
    if search:
        safe_pat = like_pattern(search)
        query = query.where(
            or_(
                CRMTicket.subject.ilike(safe_pat),
                CRMTicket.description.ilike(safe_pat),
            )
        )

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Page
    query = query.order_by(CRMTicket.updated_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    tickets = result.scalars().all()
    return {
        "total": total,
        "tickets": [TicketOut.model_validate(t).model_dump() for t in tickets],
    }


@router.post("/tickets", status_code=status.HTTP_201_CREATED, summary="Create a CRM ticket")
async def create_ticket(
    payload: TicketCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    ticket = CRMTicket(
        contact_id=payload.contact_id,
        subject=payload.subject,
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        assigned_to=payload.assigned_to,
        created_by=current_user.id,
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return TicketOut.model_validate(ticket).model_dump()


@router.get("/tickets/{ticket_id}", summary="Get a CRM ticket")
async def get_ticket(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    ticket = await db.get(CRMTicket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return TicketOut.model_validate(ticket).model_dump()


@router.put("/tickets/{ticket_id}", summary="Update a CRM ticket")
async def update_ticket(
    ticket_id: uuid.UUID,
    payload: TicketUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    ticket = await db.get(CRMTicket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    old_status = ticket.status

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(ticket, field, value)

    # Auto-set resolved_at when status changes to resolved
    if payload.status == "resolved" and old_status != "resolved":
        ticket.resolved_at = datetime.now(timezone.utc)
    elif payload.status and payload.status != "resolved":
        ticket.resolved_at = None

    await db.commit()
    await db.refresh(ticket)
    return TicketOut.model_validate(ticket).model_dump()


@router.delete("/tickets/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a CRM ticket")
async def delete_ticket(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    ticket = await db.get(CRMTicket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    await db.delete(ticket)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/tickets/{ticket_id}/assign", summary="Assign a CRM ticket")
async def assign_ticket(
    ticket_id: uuid.UUID,
    payload: TicketAssign,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    ticket = await db.get(CRMTicket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    ticket.assigned_to = payload.assigned_to
    if ticket.status == "open":
        ticket.status = "in_progress"

    await db.commit()
    await db.refresh(ticket)
    return TicketOut.model_validate(ticket).model_dump()
