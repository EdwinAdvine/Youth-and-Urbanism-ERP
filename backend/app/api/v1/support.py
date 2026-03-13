"""Support / Customer Center API — tickets, comments, KB, SLA, dashboard."""

import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession, SparseFields, apply_sparse_fields
from app.core.events import event_bus
from app.core.export import rows_to_csv
from app.models.support import (
    SupportKnowledgeBaseArticle as KnowledgeBaseArticle,
    SupportSLAPolicy as SLAPolicy,
    Ticket,
    TicketCategory,
    TicketComment,
)
from app.models.support_phase2 import TicketFollower, SLAEscalationChain

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    slug: str
    description: str | None = None
    color: str | None = "#51459d"
    is_active: bool = True
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    color: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class CategoryOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    color: str | None
    is_active: bool
    sort_order: int
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class TicketCreate(BaseModel):
    subject: str
    description: str | None = None
    priority: str = "medium"
    category_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    customer_email: str | None = None
    customer_name: str | None = None
    assigned_to: uuid.UUID | None = None
    tags: list[str] | None = None


class TicketUpdate(BaseModel):
    subject: str | None = None
    description: str | None = None
    priority: str | None = None
    category_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    customer_email: str | None = None
    customer_name: str | None = None
    tags: list[str] | None = None


class AssignPayload(BaseModel):
    assigned_to: uuid.UUID | None = None


class CommentCreate(BaseModel):
    content: str
    is_internal: bool = False
    attachments: list | None = None


class CommentOut(BaseModel):
    id: uuid.UUID
    ticket_id: uuid.UUID
    author_id: uuid.UUID
    author_name: str | None = None
    content: str
    is_internal: bool
    attachments: list | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class TicketOut(BaseModel):
    id: uuid.UUID
    ticket_number: str
    subject: str
    description: str | None
    status: str
    priority: str
    category_id: uuid.UUID | None
    category_name: str | None = None
    contact_id: uuid.UUID | None
    customer_email: str | None
    customer_name: str | None
    assigned_to: uuid.UUID | None
    assignee_name: str | None = None
    created_by: uuid.UUID
    creator_name: str | None = None
    resolved_at: Any | None
    closed_at: Any | None
    first_response_at: Any | None
    sla_response_due: Any | None
    sla_resolution_due: Any | None
    sla_response_breached: bool
    sla_resolution_breached: bool
    tags: list[str] | None
    channel: str = "web"
    sentiment_score: float | None = None
    sentiment_label: str | None = None
    custom_fields: dict | None = None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class TicketDetailOut(TicketOut):
    comments: list[CommentOut] = []


class KBCreate(BaseModel):
    title: str
    slug: str
    content: str | None = None
    category_id: uuid.UUID | None = None
    status: str = "draft"
    tags: list[str] | None = None


class KBUpdate(BaseModel):
    title: str | None = None
    slug: str | None = None
    content: str | None = None
    category_id: uuid.UUID | None = None
    status: str | None = None
    tags: list[str] | None = None


class KBOut(BaseModel):
    id: uuid.UUID
    title: str
    slug: str
    content: str | None
    category_id: uuid.UUID | None
    status: str
    author_id: uuid.UUID
    author_name: str | None = None
    tags: list[str] | None
    view_count: int
    helpful_count: int
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class SLACreate(BaseModel):
    name: str
    priority: str
    response_time_hours: int
    resolution_time_hours: int
    is_active: bool = True


class SLAUpdate(BaseModel):
    name: str | None = None
    priority: str | None = None
    response_time_hours: int | None = None
    resolution_time_hours: int | None = None
    is_active: bool | None = None


class SLAOut(BaseModel):
    id: uuid.UUID
    name: str
    priority: str
    response_time_hours: int
    resolution_time_hours: int
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class DashboardStats(BaseModel):
    total_tickets: int
    open_tickets: int
    in_progress_tickets: int
    resolved_tickets: int
    closed_tickets: int
    avg_response_hours: float | None
    sla_breached: int
    tickets_by_priority: dict[str, int]
    tickets_by_category: list[dict[str, Any]]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _ticket_out(t: Ticket) -> dict:
    """Convert a Ticket ORM instance to a dict matching TicketOut."""
    d = TicketOut.model_validate(t).model_dump()
    d["category_name"] = t.category.name if t.category else None
    d["assignee_name"] = t.assignee.full_name if t.assignee else None
    d["creator_name"] = t.creator.full_name if t.creator else None
    return d


def _ticket_detail_out(t: Ticket) -> dict:
    d = _ticket_out(t)
    d["comments"] = [
        {
            **CommentOut.model_validate(c).model_dump(),
            "author_name": c.author.full_name if c.author else None,
        }
        for c in (t.comments or [])
    ]
    return d


async def _generate_ticket_number(db) -> str:
    """Generate TKT-YYYY-NNNN."""
    year = datetime.now(timezone.utc).year
    prefix = f"TKT-{year}-"
    result = await db.execute(
        select(func.count()).select_from(Ticket).where(Ticket.ticket_number.like(f"{prefix}%"))
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}{count:04d}"


async def _get_sla_for_priority(db, priority: str) -> SLAPolicy | None:
    result = await db.execute(
        select(SLAPolicy).where(
            and_(SLAPolicy.priority == priority, SLAPolicy.is_active == True)  # noqa: E712
        ).limit(1)
    )
    return result.scalar_one_or_none()


# ── Categories ─────────────────────────────────────────────────────────────────

@router.get("/categories", summary="List ticket categories")
async def list_categories(
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(TicketCategory).order_by(TicketCategory.sort_order, TicketCategory.name)
    )
    categories = result.scalars().all()
    return [CategoryOut.model_validate(c).model_dump() for c in categories]


@router.post("/categories", status_code=status.HTTP_201_CREATED, summary="Create category")
async def create_category(
    payload: CategoryCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    cat = TicketCategory(**payload.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return CategoryOut.model_validate(cat).model_dump()


@router.put("/categories/{category_id}", summary="Update category")
async def update_category(
    category_id: uuid.UUID,
    payload: CategoryUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    cat = await db.get(TicketCategory, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(cat, field, value)
    await db.commit()
    await db.refresh(cat)
    return CategoryOut.model_validate(cat).model_dump()


@router.delete("/categories/{category_id}", status_code=status.HTTP_200_OK, summary="Delete category")
async def delete_category(
    category_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    cat = await db.get(TicketCategory, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(cat)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ── Tickets ────────────────────────────────────────────────────────────────────

VALID_STATUSES = {"open", "in_progress", "waiting_on_customer", "waiting_on_internal", "resolved", "closed"}
VALID_PRIORITIES = {"low", "medium", "high", "urgent"}


@router.get("/tickets", summary="List tickets with filters")
async def list_tickets(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status"),
    priority: str | None = None,
    category_id: uuid.UUID | None = None,
    assigned_to: uuid.UUID | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    fields: SparseFields = None,
) -> dict[str, Any]:
    filters = []
    if status_filter:
        filters.append(Ticket.status == status_filter)
    if priority:
        filters.append(Ticket.priority == priority)
    if category_id:
        filters.append(Ticket.category_id == category_id)
    if assigned_to:
        filters.append(Ticket.assigned_to == assigned_to)
    if search:
        like = f"%{search}%"
        filters.append(
            or_(
                Ticket.subject.ilike(like),
                Ticket.ticket_number.ilike(like),
                Ticket.customer_name.ilike(like),
                Ticket.customer_email.ilike(like),
            )
        )

    # Count
    count_q = select(func.count()).select_from(Ticket)
    if filters:
        count_q = count_q.where(and_(*filters))
    total = (await db.execute(count_q)).scalar() or 0

    # Fetch
    q = select(Ticket).order_by(Ticket.created_at.desc()).offset((page - 1) * limit).limit(limit)
    if filters:
        q = q.where(and_(*filters))
    result = await db.execute(q)
    tickets = result.scalars().all()
    ticket_data = [_ticket_out(t) for t in tickets]
    if fields:
        ticket_data = [apply_sparse_fields(t, fields) for t in ticket_data]
    return {
        "total": total,
        "tickets": ticket_data,
    }


@router.post("/tickets", status_code=status.HTTP_201_CREATED, summary="Create a ticket")
async def create_ticket(
    payload: TicketCreate,
    current_user: CurrentUser,
    db: DBSession,
    request: Request,
) -> dict[str, Any]:
    if payload.priority and payload.priority not in VALID_PRIORITIES:
        raise HTTPException(status_code=400, detail=f"Invalid priority: {payload.priority}")

    ticket_number = await _generate_ticket_number(db)

    ticket = Ticket(
        ticket_number=ticket_number,
        subject=payload.subject,
        description=payload.description,
        priority=payload.priority,
        category_id=payload.category_id,
        contact_id=payload.contact_id,
        customer_email=payload.customer_email,
        customer_name=payload.customer_name,
        assigned_to=payload.assigned_to,
        created_by=current_user.id,
        tags=payload.tags or [],
    )

    # Set SLA dates based on priority
    sla = await _get_sla_for_priority(db, payload.priority)
    if sla:
        now = datetime.now(timezone.utc)
        ticket.sla_response_due = now + timedelta(hours=sla.response_time_hours)
        ticket.sla_resolution_due = now + timedelta(hours=sla.resolution_time_hours)

    db.add(ticket)
    await db.commit()

    # Re-fetch with relationships
    result = await db.execute(
        select(Ticket).where(Ticket.id == ticket.id)
    )
    ticket = result.scalar_one()

    # Audit log
    from app.api.v1.support_audit import write_audit_log  # noqa: PLC0415
    await write_audit_log(
        db, ticket.id, current_user.id, "created",
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()

    # Publish event for cross-module integrations (Support→Mail, notifications)
    await event_bus.publish("support.ticket.created", {
        "ticket_id": str(ticket.id),
        "ticket_number": ticket.ticket_number,
        "subject": ticket.subject,
        "priority": ticket.priority,
        "customer_email": ticket.customer_email or "",
        "customer_name": ticket.customer_name or "",
        "assigned_to": str(ticket.assigned_to) if ticket.assigned_to else "",
        "created_by": str(ticket.created_by),
    })
    await event_bus.publish_data_change("ticket", str(ticket.id), "created")

    return _ticket_out(ticket)


@router.get("/tickets/export", summary="Export tickets as CSV")
async def export_tickets(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status"),
):
    filters = []
    if status_filter:
        filters.append(Ticket.status == status_filter)

    q = select(Ticket).order_by(Ticket.created_at.desc())
    if filters:
        q = q.where(and_(*filters))
    result = await db.execute(q)
    tickets = result.scalars().all()

    columns = [
        "ticket_number", "subject", "status", "priority",
        "customer_name", "customer_email", "created_at", "resolved_at", "closed_at",
    ]
    rows = []
    for t in tickets:
        rows.append({
            "ticket_number": t.ticket_number,
            "subject": t.subject,
            "status": t.status,
            "priority": t.priority,
            "customer_name": t.customer_name or "",
            "customer_email": t.customer_email or "",
            "created_at": str(t.created_at),
            "resolved_at": str(t.resolved_at) if t.resolved_at else "",
            "closed_at": str(t.closed_at) if t.closed_at else "",
        })

    return rows_to_csv(rows, columns, filename="tickets_export.csv")


@router.get("/tickets/{ticket_id}", summary="Get ticket detail with comments")
async def get_ticket(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    request: Request,
) -> dict[str, Any]:
    result = await db.execute(
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(selectinload(Ticket.comments))
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    out = _ticket_detail_out(ticket)

    # Collision detection: check who else is viewing this ticket via Redis presence
    viewing_agents: list[str] = []
    try:
        import redis.asyncio as aioredis
        from app.core.config import settings as _settings
        r = aioredis.from_url(_settings.REDIS_URL, decode_responses=True)
        members = await r.smembers(f"support:viewing:{ticket_id}")
        viewing_agents = [m for m in members if m != str(current_user.id)]
        await r.close()
    except Exception:
        pass  # Redis unavailable — skip collision detection
    out["viewing_agents"] = viewing_agents

    return out


@router.put("/tickets/{ticket_id}", summary="Update ticket fields")
async def update_ticket(
    ticket_id: uuid.UUID,
    payload: TicketUpdate,
    current_user: CurrentUser,
    db: DBSession,
    request: Request,
) -> dict[str, Any]:
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    from app.api.v1.support_audit import write_audit_log  # noqa: PLC0415

    for field, value in payload.model_dump(exclude_none=True).items():
        if field == "priority" and value not in VALID_PRIORITIES:
            raise HTTPException(status_code=400, detail=f"Invalid priority: {value}")
        old_value = getattr(ticket, field, None)
        if old_value != value:
            await write_audit_log(
                db, ticket_id, current_user.id, "field_changed",
                field_name=field, old_value=str(old_value) if old_value is not None else None,
                new_value=str(value), ip_address=request.client.host if request.client else None,
            )
        setattr(ticket, field, value)

    await db.commit()

    # Re-fetch
    result = await db.execute(select(Ticket).where(Ticket.id == ticket.id))
    ticket = result.scalar_one()
    await event_bus.publish_data_change("ticket", str(ticket.id), "updated")
    return _ticket_out(ticket)


@router.post("/tickets/{ticket_id}/assign", summary="Assign ticket to user")
async def assign_ticket(
    ticket_id: uuid.UUID,
    payload: AssignPayload,
    current_user: CurrentUser,
    db: DBSession,
    request: Request,
) -> dict[str, Any]:
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    from app.api.v1.support_audit import write_audit_log  # noqa: PLC0415

    old_assigned = str(ticket.assigned_to) if ticket.assigned_to else None
    ticket.assigned_to = payload.assigned_to
    if ticket.status == "open" and payload.assigned_to:
        ticket.status = "in_progress"

    await write_audit_log(
        db, ticket_id, current_user.id, "assigned",
        field_name="assigned_to", old_value=old_assigned,
        new_value=str(payload.assigned_to) if payload.assigned_to else None,
        ip_address=request.client.host if request.client else None,
    )

    await db.commit()
    result = await db.execute(select(Ticket).where(Ticket.id == ticket.id))
    ticket = result.scalar_one()

    # Publish assignment event
    if payload.assigned_to:
        await event_bus.publish("support.ticket.assigned", {
            "ticket_id": str(ticket.id),
            "ticket_number": ticket.ticket_number,
            "subject": ticket.subject,
            "assigned_to": str(payload.assigned_to),
            "assigned_by": str(current_user.id),
        })

    return _ticket_out(ticket)


@router.post("/tickets/{ticket_id}/resolve", summary="Resolve ticket")
async def resolve_ticket(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    request: Request,
) -> dict[str, Any]:
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status == "closed":
        raise HTTPException(status_code=400, detail="Cannot resolve a closed ticket")

    from app.api.v1.support_audit import write_audit_log  # noqa: PLC0415

    old_status = ticket.status
    now = datetime.now(timezone.utc)
    ticket.status = "resolved"
    ticket.resolved_at = now

    # Check SLA breach
    if ticket.sla_resolution_due and now > ticket.sla_resolution_due:
        ticket.sla_resolution_breached = True

    await write_audit_log(
        db, ticket_id, current_user.id, "status_changed",
        field_name="status", old_value=old_status, new_value="resolved",
        ip_address=request.client.host if request.client else None,
    )

    await db.commit()
    result = await db.execute(select(Ticket).where(Ticket.id == ticket.id))
    ticket = result.scalar_one()

    # Publish resolved event — triggers CSAT survey after 24h
    await event_bus.publish("support.ticket.resolved", {
        "ticket_id": str(ticket.id),
        "ticket_number": ticket.ticket_number,
        "subject": ticket.subject,
        "customer_email": ticket.customer_email or "",
        "customer_name": ticket.customer_name or "",
        "resolved_by": str(current_user.id),
    })

    return _ticket_out(ticket)


@router.post("/tickets/{ticket_id}/close", summary="Close ticket")
async def close_ticket(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    request: Request,
) -> dict[str, Any]:
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    from app.api.v1.support_audit import write_audit_log  # noqa: PLC0415

    old_status = ticket.status
    ticket.status = "closed"
    ticket.closed_at = datetime.now(timezone.utc)

    await write_audit_log(
        db, ticket_id, current_user.id, "status_changed",
        field_name="status", old_value=old_status, new_value="closed",
        ip_address=request.client.host if request.client else None,
    )

    await db.commit()
    result = await db.execute(select(Ticket).where(Ticket.id == ticket.id))
    ticket = result.scalar_one()
    return _ticket_out(ticket)


@router.post("/tickets/{ticket_id}/reopen", summary="Reopen ticket")
async def reopen_ticket(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    request: Request,
) -> dict[str, Any]:
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status not in ("resolved", "closed"):
        raise HTTPException(status_code=400, detail="Only resolved/closed tickets can be reopened")

    from app.api.v1.support_audit import write_audit_log  # noqa: PLC0415

    old_status = ticket.status
    ticket.status = "open"
    ticket.resolved_at = None
    ticket.closed_at = None

    await write_audit_log(
        db, ticket_id, current_user.id, "status_changed",
        field_name="status", old_value=old_status, new_value="open",
        ip_address=request.client.host if request.client else None,
    )

    await db.commit()
    result = await db.execute(select(Ticket).where(Ticket.id == ticket.id))
    ticket = result.scalar_one()
    return _ticket_out(ticket)


# ── Comments ───────────────────────────────────────────────────────────────────

@router.get("/tickets/{ticket_id}/comments", summary="List comments on a ticket")
async def list_comments(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    result = await db.execute(
        select(TicketComment)
        .where(TicketComment.ticket_id == ticket_id)
        .order_by(TicketComment.created_at.asc())
    )
    comments = result.scalars().all()
    return [
        {
            **CommentOut.model_validate(c).model_dump(),
            "author_name": c.author.full_name if c.author else None,
        }
        for c in comments
    ]


@router.post(
    "/tickets/{ticket_id}/comments",
    status_code=status.HTTP_201_CREATED,
    summary="Add comment to ticket",
)
async def add_comment(
    ticket_id: uuid.UUID,
    payload: CommentCreate,
    current_user: CurrentUser,
    db: DBSession,
    request: Request,
) -> dict[str, Any]:
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    comment = TicketComment(
        ticket_id=ticket_id,
        author_id=current_user.id,
        content=payload.content,
        is_internal=payload.is_internal,
        attachments=payload.attachments or [],
    )
    db.add(comment)

    # Track first response time
    if not ticket.first_response_at and ticket.created_by != current_user.id:
        now = datetime.now(timezone.utc)
        ticket.first_response_at = now
        if ticket.sla_response_due and now > ticket.sla_response_due:
            ticket.sla_response_breached = True

    # Audit log
    from app.api.v1.support_audit import write_audit_log  # noqa: PLC0415
    await write_audit_log(
        db, ticket_id, current_user.id, "comment_added",
        ip_address=request.client.host if request.client else None,
    )

    await db.commit()
    await db.refresh(comment)

    # Parse @mentions — pattern: @user_email or @full_name
    mention_pattern = re.compile(r"@([\w.+-]+@[\w-]+\.[\w.]+)")
    mentioned_emails = mention_pattern.findall(payload.content)
    if mentioned_emails:
        from app.models.user import User  # noqa: PLC0415
        for email_addr in mentioned_emails:
            user_result = await db.execute(
                select(User).where(User.email.ilike(email_addr)).limit(1)
            )
            mentioned_user = user_result.scalar_one_or_none()
            if mentioned_user:
                await event_bus.publish("support.mention", {
                    "ticket_id": str(ticket.id),
                    "ticket_number": ticket.ticket_number,
                    "mentioned_user_id": str(mentioned_user.id),
                    "comment_preview": payload.content[:200],
                    "mentioned_by": str(current_user.id),
                })

    # Publish comment.added event — triggers customer email for external comments
    await event_bus.publish("support.comment.added", {
        "ticket_id": str(ticket.id),
        "ticket_number": ticket.ticket_number,
        "subject": ticket.subject,
        "is_internal": payload.is_internal,
        "customer_email": ticket.customer_email or "",
        "customer_name": ticket.customer_name or "",
        "comment_preview": payload.content[:500],
        "author_name": current_user.full_name if hasattr(current_user, "full_name") else "",
    })

    return {
        **CommentOut.model_validate(comment).model_dump(),
        "author_name": current_user.full_name if hasattr(current_user, "full_name") else None,
    }


# ── Knowledge Base ─────────────────────────────────────────────────────────────

@router.get("/kb", summary="List published KB articles")
async def list_kb_articles(
    current_user: CurrentUser,
    db: DBSession,
    search: str | None = None,
    category_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    filters = [KnowledgeBaseArticle.status == "published"]
    if search:
        like = f"%{search}%"
        filters.append(
            or_(KnowledgeBaseArticle.title.ilike(like), KnowledgeBaseArticle.content.ilike(like))
        )
    if category_id:
        filters.append(KnowledgeBaseArticle.category_id == category_id)

    count_q = select(func.count()).select_from(KnowledgeBaseArticle).where(and_(*filters))
    total = (await db.execute(count_q)).scalar() or 0

    q = (
        select(KnowledgeBaseArticle)
        .where(and_(*filters))
        .order_by(KnowledgeBaseArticle.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(q)
    articles = result.scalars().all()

    return {
        "total": total,
        "articles": [
            {
                **KBOut.model_validate(a).model_dump(),
                "author_name": a.author.full_name if a.author else None,
            }
            for a in articles
        ],
    }


@router.get("/kb/{slug}", summary="Get KB article by slug")
async def get_kb_article(
    slug: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(KnowledgeBaseArticle).where(KnowledgeBaseArticle.slug == slug)
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Increment view count
    article.view_count += 1
    await db.commit()
    await db.refresh(article)

    return {
        **KBOut.model_validate(article).model_dump(),
        "author_name": article.author.full_name if article.author else None,
    }


@router.post("/kb", status_code=status.HTTP_201_CREATED, summary="Create KB article")
async def create_kb_article(
    payload: KBCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    article = KnowledgeBaseArticle(
        **payload.model_dump(),
        author_id=current_user.id,
    )
    db.add(article)
    await db.commit()
    await db.refresh(article)
    return {
        **KBOut.model_validate(article).model_dump(),
        "author_name": current_user.full_name if hasattr(current_user, "full_name") else None,
    }


@router.put("/kb/{article_id}", summary="Update KB article")
async def update_kb_article(
    article_id: uuid.UUID,
    payload: KBUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    article = await db.get(KnowledgeBaseArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(article, field, value)
    await db.commit()
    await db.refresh(article)
    return {
        **KBOut.model_validate(article).model_dump(),
        "author_name": article.author.full_name if article.author else None,
    }


@router.delete("/kb/{article_id}", status_code=status.HTTP_200_OK, summary="Delete KB article")
async def delete_kb_article(
    article_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    article = await db.get(KnowledgeBaseArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    await db.delete(article)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


@router.post("/kb/{article_id}/helpful", summary="Mark KB article as helpful")
async def mark_kb_helpful(
    article_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    article = await db.get(KnowledgeBaseArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    article.helpful_count += 1
    await db.commit()
    await db.refresh(article)
    return {
        **KBOut.model_validate(article).model_dump(),
        "author_name": article.author.full_name if article.author else None,
    }


# ── SLA Policies ───────────────────────────────────────────────────────────────

@router.get("/sla", summary="List SLA policies")
async def list_sla_policies(
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    result = await db.execute(select(SLAPolicy).order_by(SLAPolicy.priority))
    policies = result.scalars().all()
    return [SLAOut.model_validate(p).model_dump() for p in policies]


@router.post("/sla", status_code=status.HTTP_201_CREATED, summary="Create SLA policy")
async def create_sla_policy(
    payload: SLACreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    policy = SLAPolicy(**payload.model_dump())
    db.add(policy)
    await db.commit()
    await db.refresh(policy)
    return SLAOut.model_validate(policy).model_dump()


@router.put("/sla/{sla_id}", summary="Update SLA policy")
async def update_sla_policy(
    sla_id: uuid.UUID,
    payload: SLAUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    policy = await db.get(SLAPolicy, sla_id)
    if not policy:
        raise HTTPException(status_code=404, detail="SLA policy not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(policy, field, value)
    await db.commit()
    await db.refresh(policy)
    return SLAOut.model_validate(policy).model_dump()


# ── Dashboard Stats ────────────────────────────────────────────────────────────

@router.get("/dashboard/stats", summary="Support dashboard statistics")
async def dashboard_stats(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Totals by status
    status_counts = {}
    for s in VALID_STATUSES:
        q = select(func.count()).select_from(Ticket).where(Ticket.status == s)
        status_counts[s] = (await db.execute(q)).scalar() or 0

    total = sum(status_counts.values())

    # Tickets by priority
    priority_counts = {}
    for p in VALID_PRIORITIES:
        q = select(func.count()).select_from(Ticket).where(Ticket.priority == p)
        priority_counts[p] = (await db.execute(q)).scalar() or 0

    # SLA breached count
    sla_q = select(func.count()).select_from(Ticket).where(
        or_(Ticket.sla_response_breached == True, Ticket.sla_resolution_breached == True)  # noqa: E712
    )
    sla_breached = (await db.execute(sla_q)).scalar() or 0

    # Avg response time (for tickets that have first_response_at)
    avg_response = None
    resp_q = select(Ticket.created_at, Ticket.first_response_at).where(
        Ticket.first_response_at.isnot(None)
    )
    resp_rows = (await db.execute(resp_q)).all()
    if resp_rows:
        diffs = [(r[1] - r[0]).total_seconds() / 3600 for r in resp_rows]
        avg_response = round(sum(diffs) / len(diffs), 1)

    # Tickets by category
    cat_q = (
        select(TicketCategory.name, func.count(Ticket.id))
        .outerjoin(Ticket, Ticket.category_id == TicketCategory.id)
        .group_by(TicketCategory.name)
        .order_by(func.count(Ticket.id).desc())
    )
    cat_rows = (await db.execute(cat_q)).all()
    tickets_by_category = [{"name": row[0], "count": row[1]} for row in cat_rows]

    return {
        "total_tickets": total,
        "open_tickets": status_counts.get("open", 0),
        "in_progress_tickets": status_counts.get("in_progress", 0),
        "resolved_tickets": status_counts.get("resolved", 0),
        "closed_tickets": status_counts.get("closed", 0),
        "avg_response_hours": avg_response,
        "sla_breached": sla_breached,
        "tickets_by_priority": priority_counts,
        "tickets_by_category": tickets_by_category,
    }


# ── Ticket Followers ──────────────────────────────────────────────────────────

class FollowerCreate(BaseModel):
    user_id: uuid.UUID
    notify_on_comment: bool = True
    notify_on_status_change: bool = True

class FollowerOut(BaseModel):
    id: uuid.UUID
    ticket_id: uuid.UUID
    user_id: uuid.UUID
    notify_on_comment: bool
    notify_on_status_change: bool
    user_name: str | None = None
    created_at: Any
    model_config = {"from_attributes": True}

@router.get("/tickets/{ticket_id}/followers", summary="List ticket followers")
async def list_followers(ticket_id: uuid.UUID, db: DBSession, current_user: CurrentUser) -> list[dict[str, Any]]:
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    result = await db.execute(select(TicketFollower).where(TicketFollower.ticket_id == ticket_id))
    followers = result.scalars().all()
    return [
        {**FollowerOut.model_validate(f).model_dump(), "user_name": f.user.full_name if f.user else None}
        for f in followers
    ]

@router.post("/tickets/{ticket_id}/followers", status_code=201, summary="Add follower to ticket")
async def add_follower(ticket_id: uuid.UUID, payload: FollowerCreate, db: DBSession, current_user: CurrentUser) -> dict[str, Any]:
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    # Check not already following
    existing = await db.execute(
        select(TicketFollower).where(TicketFollower.ticket_id == ticket_id, TicketFollower.user_id == payload.user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User already following this ticket")
    follower = TicketFollower(
        ticket_id=ticket_id, user_id=payload.user_id,
        notify_on_comment=payload.notify_on_comment,
        notify_on_status_change=payload.notify_on_status_change,
    )
    db.add(follower)
    await db.commit()
    await db.refresh(follower)
    return {**FollowerOut.model_validate(follower).model_dump(), "user_name": follower.user.full_name if follower.user else None}

@router.delete("/tickets/{ticket_id}/followers/{follower_id}", status_code=204, summary="Remove follower")
async def remove_follower(ticket_id: uuid.UUID, follower_id: uuid.UUID, db: DBSession, current_user: CurrentUser) -> Response:
    follower = await db.get(TicketFollower, follower_id)
    if not follower or follower.ticket_id != ticket_id:
        raise HTTPException(status_code=404, detail="Follower not found")
    await db.delete(follower)
    await db.commit()
    return Response(status_code=204)

@router.post("/tickets/{ticket_id}/follow", summary="Follow ticket (self)")
async def follow_ticket(ticket_id: uuid.UUID, db: DBSession, current_user: CurrentUser) -> dict[str, str]:
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    existing = await db.execute(
        select(TicketFollower).where(TicketFollower.ticket_id == ticket_id, TicketFollower.user_id == current_user.id)
    )
    if existing.scalar_one_or_none():
        return {"status": "already_following"}
    follower = TicketFollower(ticket_id=ticket_id, user_id=current_user.id)
    db.add(follower)
    await db.commit()
    return {"status": "following"}

@router.post("/tickets/{ticket_id}/unfollow", summary="Unfollow ticket (self)")
async def unfollow_ticket(ticket_id: uuid.UUID, db: DBSession, current_user: CurrentUser) -> dict[str, str]:
    result = await db.execute(
        select(TicketFollower).where(TicketFollower.ticket_id == ticket_id, TicketFollower.user_id == current_user.id)
    )
    follower = result.scalar_one_or_none()
    if not follower:
        return {"status": "not_following"}
    await db.delete(follower)
    await db.commit()
    return {"status": "unfollowed"}


# ── SLA Escalation Chains ─────────────────────────────────────────────────────

class EscalationChainCreate(BaseModel):
    sla_policy_id: uuid.UUID
    level: int
    trigger_minutes_before_breach: int = 60
    action: str = "notify"  # notify, reassign, escalate
    target_user_id: uuid.UUID | None = None
    notify_channel: str = "in_app"  # in_app, email, both

class EscalationChainOut(BaseModel):
    id: uuid.UUID
    sla_policy_id: uuid.UUID
    level: int
    trigger_minutes_before_breach: int
    action: str
    target_user_id: uuid.UUID | None
    notify_channel: str
    target_user_name: str | None = None
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}

@router.get("/sla/{sla_policy_id}/escalation-chain", summary="List escalation chain for SLA")
async def list_escalation_chain(sla_policy_id: uuid.UUID, db: DBSession, current_user: CurrentUser) -> list[dict[str, Any]]:
    result = await db.execute(
        select(SLAEscalationChain).where(SLAEscalationChain.sla_policy_id == sla_policy_id).order_by(SLAEscalationChain.level)
    )
    chains = result.scalars().all()
    return [
        {**EscalationChainOut.model_validate(c).model_dump(), "target_user_name": c.target_user.full_name if c.target_user else None}
        for c in chains
    ]

@router.post("/sla/{sla_policy_id}/escalation-chain", status_code=201, summary="Add escalation level")
async def add_escalation_level(sla_policy_id: uuid.UUID, payload: EscalationChainCreate, db: DBSession, current_user: CurrentUser) -> dict[str, Any]:
    chain = SLAEscalationChain(
        sla_policy_id=sla_policy_id, level=payload.level,
        trigger_minutes_before_breach=payload.trigger_minutes_before_breach,
        action=payload.action, target_user_id=payload.target_user_id,
        notify_channel=payload.notify_channel,
    )
    db.add(chain)
    await db.commit()
    await db.refresh(chain)
    return {**EscalationChainOut.model_validate(chain).model_dump(), "target_user_name": chain.target_user.full_name if chain.target_user else None}

@router.put("/sla/escalation-chain/{chain_id}", summary="Update escalation level")
async def update_escalation_level(chain_id: uuid.UUID, payload: EscalationChainCreate, db: DBSession, current_user: CurrentUser) -> dict[str, Any]:
    chain = await db.get(SLAEscalationChain, chain_id)
    if not chain:
        raise HTTPException(status_code=404, detail="Escalation chain not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(chain, field, value)
    await db.commit()
    await db.refresh(chain)
    return EscalationChainOut.model_validate(chain).model_dump()

@router.delete("/sla/escalation-chain/{chain_id}", status_code=204, summary="Delete escalation level")
async def delete_escalation_level(chain_id: uuid.UUID, db: DBSession, current_user: CurrentUser) -> Response:
    chain = await db.get(SLAEscalationChain, chain_id)
    if not chain:
        raise HTTPException(status_code=404, detail="Escalation chain not found")
    await db.delete(chain)
    await db.commit()
    return Response(status_code=204)
