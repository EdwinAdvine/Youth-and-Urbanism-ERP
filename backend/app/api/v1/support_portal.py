"""Support Phase 2 — Customer Self-Service Portal API.

Admin endpoints: manage portal accounts (requires internal staff JWT).
Customer-facing endpoints: login, tickets, KB articles (requires X-Portal-Token).
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.support import (
    SupportKnowledgeBaseArticle as KnowledgeBaseArticle,
    Ticket,
    TicketComment,
)
from app.models.support_phase2 import CustomerPortalAccount

router = APIRouter()

# ── Password hashing ──────────────────────────────────────────────────────────

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Portal JWT dependency ──────────────────────────────────────────────────────

async def get_portal_user(request: Request, db: DBSession) -> CustomerPortalAccount:
    """Decode X-Portal-Token header (or portal_token query param) and return the account."""
    token = request.headers.get("X-Portal-Token") or request.query_params.get("portal_token")
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Portal token required")
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "portal":
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token type")
        account = await db.get(CustomerPortalAccount, uuid.UUID(payload["sub"]))
        if not account or not account.is_active:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account inactive")
        return account
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid portal token")


PortalUser = CustomerPortalAccount  # type alias for clarity in signatures


# ── Inline Pydantic schemas ───────────────────────────────────────────────────

class PortalAccountCreate(BaseModel):
    email: str
    display_name: str
    password: str
    contact_id: uuid.UUID | None = None


class PortalAccountUpdate(BaseModel):
    display_name: str | None = None
    is_active: bool | None = None
    contact_id: uuid.UUID | None = None


class PortalAccountOut(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    is_active: bool
    contact_id: uuid.UUID | None
    last_login_at: Any
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class PortalLoginIn(BaseModel):
    email: str
    password: str


class PortalTicketCreate(BaseModel):
    subject: str
    description: str | None = None
    priority: str = "medium"
    category_id: uuid.UUID | None = None


class PortalCommentCreate(BaseModel):
    content: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_portal_token(account_id: uuid.UUID) -> str:
    """Encode a portal-scoped JWT using the application secret key."""
    return jwt.encode(
        {"sub": str(account_id), "type": "portal"},
        settings.SECRET_KEY,
        algorithm="HS256",
    )


def _ticket_to_dict(ticket: Ticket, include_comments: bool = False) -> dict:
    """Serialise a Ticket ORM instance to a plain dict for API responses."""
    data: dict = {
        "id": str(ticket.id),
        "ticket_number": ticket.ticket_number,
        "subject": ticket.subject,
        "description": ticket.description,
        "status": ticket.status,
        "priority": ticket.priority,
        "channel": ticket.channel,
        "category_id": str(ticket.category_id) if ticket.category_id else None,
        "customer_email": ticket.customer_email,
        "customer_name": ticket.customer_name,
        "created_at": ticket.created_at,
        "updated_at": ticket.updated_at,
    }
    if include_comments and ticket.comments is not None:
        data["comments"] = [
            {
                "id": str(c.id),
                "content": c.content,
                "is_internal": c.is_internal,
                "author_id": str(c.author_id) if c.author_id else None,
                "created_at": c.created_at,
            }
            for c in ticket.comments
            if not c.is_internal
        ]
    return data


# ── Admin endpoints ───────────────────────────────────────────────────────────

@router.get("/portal/accounts", tags=["Support Portal — Admin"])
async def list_portal_accounts(
    current_user: CurrentUser,
    db: DBSession,
    search: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    """List all customer portal accounts. Supports search by email or display_name."""
    q = select(CustomerPortalAccount)
    if search:
        pattern = f"%{search}%"
        q = q.where(
            or_(
                CustomerPortalAccount.email.ilike(pattern),
                CustomerPortalAccount.display_name.ilike(pattern),
            )
        )
    total_result = await db.execute(
        select(func.count()).select_from(q.subquery())
    )
    total = total_result.scalar_one()

    q = q.order_by(CustomerPortalAccount.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    accounts = result.scalars().all()

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": [PortalAccountOut.model_validate(a).model_dump() for a in accounts],
    }


@router.post("/portal/accounts", status_code=status.HTTP_201_CREATED, tags=["Support Portal — Admin"])
async def create_portal_account(
    payload: PortalAccountCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict:
    """Create a new customer portal account. Hashes the supplied password with bcrypt."""
    # Check email uniqueness
    existing = await db.execute(
        select(CustomerPortalAccount).where(CustomerPortalAccount.email == payload.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    account = CustomerPortalAccount(
        email=payload.email,
        display_name=payload.display_name,
        password_hash=pwd_context.hash(payload.password),
        contact_id=payload.contact_id,
        is_active=True,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return PortalAccountOut.model_validate(account).model_dump()


@router.put("/portal/accounts/{account_id}", tags=["Support Portal — Admin"])
async def update_portal_account(
    account_id: uuid.UUID,
    payload: PortalAccountUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict:
    """Update display_name, is_active, or contact_id for a portal account."""
    account = await db.get(CustomerPortalAccount, account_id)
    if not account:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Portal account not found")

    if payload.display_name is not None:
        account.display_name = payload.display_name
    if payload.is_active is not None:
        account.is_active = payload.is_active
    if payload.contact_id is not None:
        account.contact_id = payload.contact_id

    await db.commit()
    await db.refresh(account)
    return PortalAccountOut.model_validate(account).model_dump()


@router.delete("/portal/accounts/{account_id}", tags=["Support Portal — Admin"])
async def deactivate_portal_account(
    account_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict:
    """Deactivate a portal account (soft delete — sets is_active=False)."""
    account = await db.get(CustomerPortalAccount, account_id)
    if not account:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Portal account not found")

    account.is_active = False
    await db.commit()
    return {"detail": "Account deactivated", "id": str(account_id)}


# ── Customer-facing endpoints ─────────────────────────────────────────────────

@router.post("/portal/login", tags=["Support Portal — Customer"])
async def portal_login(payload: PortalLoginIn, db: DBSession) -> dict:
    """Authenticate a portal customer and return a signed JWT (X-Portal-Token)."""
    result = await db.execute(
        select(CustomerPortalAccount).where(CustomerPortalAccount.email == payload.email)
    )
    account = result.scalar_one_or_none()

    if not account or not account.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    if not pwd_context.verify(payload.password, account.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    # Update last login timestamp
    account.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    token = _generate_portal_token(account.id)
    return {
        "portal_token": token,
        "account": PortalAccountOut.model_validate(account).model_dump(),
    }


@router.get("/portal/my-tickets", tags=["Support Portal — Customer"])
async def list_my_tickets(
    request: Request,
    db: DBSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    account: PortalUser = Depends(get_portal_user),
) -> dict:
    """List all tickets associated with the authenticated portal customer's email."""
    q = (
        select(Ticket)
        .where(Ticket.customer_email == account.email)
        .order_by(Ticket.created_at.desc())
    )
    total_result = await db.execute(
        select(func.count()).select_from(q.subquery())
    )
    total = total_result.scalar_one()

    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    tickets = result.scalars().all()

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": [_ticket_to_dict(t) for t in tickets],
    }


@router.post("/portal/my-tickets", status_code=status.HTTP_201_CREATED, tags=["Support Portal — Customer"])
async def create_my_ticket(
    payload: PortalTicketCreate,
    request: Request,
    db: DBSession,
    account: PortalUser = Depends(get_portal_user),
) -> dict:
    """Create a new support ticket from the portal. Channel is set to 'portal'."""
    # Generate ticket number
    count_result = await db.execute(select(func.count()).select_from(Ticket))
    count = count_result.scalar_one()
    ticket_number = f"TKT-{count + 1:05d}"

    ticket = Ticket(
        ticket_number=ticket_number,
        subject=payload.subject,
        description=payload.description,
        priority=payload.priority,
        category_id=payload.category_id,
        channel="portal",
        customer_email=account.email,
        customer_name=account.display_name,
        contact_id=account.contact_id,
        status="open",
        # created_by requires a staff user UUID — use a sentinel approach:
        # portal tickets have no internal creator; we rely on customer_email as identity.
        # We must satisfy the NOT NULL constraint by using account's linked contact or
        # falling back to a system placeholder. Here we set created_by to a nil UUID
        # that callers should handle; for a full deployment, wire a system_user_id from settings.
        created_by=uuid.UUID("00000000-0000-0000-0000-000000000000"),
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)

    await event_bus.publish("support.ticket.created", {
        "ticket_id": str(ticket.id),
        "ticket_number": ticket.ticket_number,
        "subject": ticket.subject,
        "channel": "portal",
        "customer_email": account.email,
        "customer_name": account.display_name,
    })

    return _ticket_to_dict(ticket)


@router.get("/portal/my-tickets/{ticket_id}", tags=["Support Portal — Customer"])
async def get_my_ticket(
    ticket_id: uuid.UUID,
    request: Request,
    db: DBSession,
    account: PortalUser = Depends(get_portal_user),
) -> dict:
    """Get full ticket detail including non-internal comments."""
    result = await db.execute(
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(selectinload(Ticket.comments))
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ticket not found")

    # Verify ownership — customer may only view their own tickets
    if ticket.customer_email != account.email:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    return _ticket_to_dict(ticket, include_comments=True)


@router.post("/portal/my-tickets/{ticket_id}/comments", status_code=status.HTTP_201_CREATED, tags=["Support Portal — Customer"])
async def add_my_ticket_comment(
    ticket_id: uuid.UUID,
    payload: PortalCommentCreate,
    request: Request,
    db: DBSession,
    account: PortalUser = Depends(get_portal_user),
) -> dict:
    """Add a customer reply to a ticket. Publishes support.comment.added event."""
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ticket not found")

    if ticket.customer_email != account.email:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    if ticket.status == "closed":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot comment on a closed ticket")

    comment = TicketComment(
        ticket_id=ticket_id,
        # Portal customers have no internal user record; use sentinel UUID
        author_id=uuid.UUID("00000000-0000-0000-0000-000000000000"),
        content=payload.content,
        is_internal=False,
    )
    db.add(comment)

    # Re-open ticket if it was resolved — customer is following up
    if ticket.status == "resolved":
        ticket.status = "open"

    await db.commit()
    await db.refresh(comment)

    await event_bus.publish("support.comment.added", {
        "ticket_id": str(ticket.id),
        "ticket_number": ticket.ticket_number,
        "subject": ticket.subject,
        "is_internal": False,
        "customer_email": ticket.customer_email or "",
        "customer_name": account.display_name,
        "comment_preview": payload.content[:500],
        "author_name": account.display_name,
        "source": "portal",
    })

    return {
        "id": str(comment.id),
        "ticket_id": str(comment.ticket_id),
        "content": comment.content,
        "is_internal": comment.is_internal,
        "created_at": comment.created_at,
    }


@router.get("/portal/kb", tags=["Support Portal — Customer"])
async def search_kb_articles(
    db: DBSession,
    q: str | None = Query(None, description="Search term for title or content"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    """Search published knowledge-base articles. No authentication required."""
    query = select(KnowledgeBaseArticle).where(KnowledgeBaseArticle.status == "published")

    if q:
        pattern = f"%{q}%"
        query = query.where(
            or_(
                KnowledgeBaseArticle.title.ilike(pattern),
                KnowledgeBaseArticle.content.ilike(pattern),
            )
        )

    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar_one()

    query = query.order_by(KnowledgeBaseArticle.view_count.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    articles = result.scalars().all()

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": [
            {
                "id": str(a.id),
                "title": a.title,
                "slug": a.slug,
                "content": a.content,
                "tags": a.tags,
                "view_count": a.view_count,
                "helpful_count": a.helpful_count,
                "category_id": str(a.category_id) if a.category_id else None,
                "created_at": a.created_at,
                "updated_at": a.updated_at,
            }
            for a in articles
        ],
    }


@router.get("/portal/kb/{article_id}", tags=["Support Portal — Customer"])
async def get_kb_article(
    article_id: uuid.UUID,
    db: DBSession,
) -> dict:
    """Retrieve a single published KB article and increment its view count."""
    article = await db.get(KnowledgeBaseArticle, article_id)

    if not article or article.status != "published":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Article not found")

    # Increment view count in-place
    article.view_count = (article.view_count or 0) + 1
    await db.commit()

    return {
        "id": str(article.id),
        "title": article.title,
        "slug": article.slug,
        "content": article.content,
        "tags": article.tags,
        "status": article.status,
        "view_count": article.view_count,
        "helpful_count": article.helpful_count,
        "category_id": str(article.category_id) if article.category_id else None,
        "created_at": article.created_at,
        "updated_at": article.updated_at,
    }
