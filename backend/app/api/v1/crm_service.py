"""CRM Service Hub — conversations, knowledge base, and SLA management."""

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.core.sanitize import like_pattern
from app.models.crm_service import (
    Conversation,
    ConversationMessage,
    CRMKnowledgeBaseArticle as KnowledgeBaseArticle,
    CRMSLAPolicy as SLAPolicy,
    SLATracker,
)

router = APIRouter()


# ── Conversation Schemas ──────────────────────────────────────────────────────


class ConversationCreate(BaseModel):
    channel: str
    subject: str | None = None
    contact_id: uuid.UUID | None = None
    ticket_id: uuid.UUID | None = None
    status: str = "open"
    assigned_to: uuid.UUID | None = None
    metadata_json: dict | None = None


class ConversationUpdate(BaseModel):
    channel: str | None = None
    subject: str | None = None
    contact_id: uuid.UUID | None = None
    ticket_id: uuid.UUID | None = None
    status: str | None = None
    assigned_to: uuid.UUID | None = None
    metadata_json: dict | None = None


class ConversationOut(BaseModel):
    id: uuid.UUID
    channel: str
    subject: str | None
    contact_id: uuid.UUID | None
    ticket_id: uuid.UUID | None
    status: str
    assigned_to: uuid.UUID | None
    last_message_at: Any | None
    metadata_json: dict | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class ConversationAssign(BaseModel):
    assigned_to: uuid.UUID


class ConversationResolve(BaseModel):
    status: str = "resolved"


# ── Message Schemas ───────────────────────────────────────────────────────────


class MessageCreate(BaseModel):
    sender_type: str = "agent"
    sender_id: uuid.UUID | None = None
    content: str
    content_type: str = "text"
    attachments: list[dict] | None = None


class MessageOut(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_type: str
    sender_id: uuid.UUID | None
    content: str
    content_type: str
    attachments: list[dict] | None
    created_at: Any

    model_config = {"from_attributes": True}


# ── KB Article Schemas ────────────────────────────────────────────────────────


class ArticleCreate(BaseModel):
    title: str
    slug: str
    content_html: str
    content_text: str
    category: str
    tags: list[str] | None = None
    status: str = "draft"


class ArticleUpdate(BaseModel):
    title: str | None = None
    slug: str | None = None
    content_html: str | None = None
    content_text: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    status: str | None = None


class ArticleOut(BaseModel):
    id: uuid.UUID
    title: str
    slug: str
    content_html: str
    content_text: str
    category: str
    tags: list[str] | None
    status: str
    view_count: int
    helpful_count: int
    not_helpful_count: int
    author_id: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class KBSearchRequest(BaseModel):
    query: str
    limit: int = 10


# ── SLA Schemas ───────────────────────────────────────────────────────────────


class SLAPolicyCreate(BaseModel):
    name: str
    description: str | None = None
    priority: str
    first_response_hours: int
    resolution_hours: int
    business_hours_only: bool = True
    is_active: bool = True


class SLAPolicyUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    priority: str | None = None
    first_response_hours: int | None = None
    resolution_hours: int | None = None
    business_hours_only: bool | None = None
    is_active: bool | None = None


class SLAPolicyOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    priority: str
    first_response_hours: int
    resolution_hours: int
    business_hours_only: bool
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class SLATrackerOut(BaseModel):
    id: uuid.UUID
    ticket_id: uuid.UUID
    sla_policy_id: uuid.UUID
    first_response_due: Any | None
    first_response_at: Any | None
    resolution_due: Any | None
    resolution_at: Any | None
    is_first_response_breached: bool
    is_resolution_breached: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Conversation Endpoints ────────────────────────────────────────────────────


@router.get("/conversations", summary="List conversations")
async def list_conversations(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    channel: str | None = Query(None, description="Filter by channel"),
    assigned_to: uuid.UUID | None = Query(None, description="Filter by assigned user"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Conversation)

    if status_filter:
        query = query.where(Conversation.status == status_filter)
    if channel:
        query = query.where(Conversation.channel == channel)
    if assigned_to:
        query = query.where(Conversation.assigned_to == assigned_to)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Conversation.updated_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    conversations = result.scalars().all()
    return {
        "total": total,
        "items": [ConversationOut.model_validate(c).model_dump() for c in conversations],
    }


@router.post("/conversations", status_code=status.HTTP_201_CREATED, summary="Create a conversation")
async def create_conversation(
    payload: ConversationCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    conversation = Conversation(
        channel=payload.channel,
        subject=payload.subject,
        contact_id=payload.contact_id,
        ticket_id=payload.ticket_id,
        status=payload.status,
        assigned_to=payload.assigned_to,
        metadata_json=payload.metadata_json,
    )
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    return ConversationOut.model_validate(conversation).model_dump()


@router.get("/conversations/{conversation_id}", summary="Get conversation with messages")
async def get_conversation(
    conversation_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    query = (
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.messages))
    )
    result = await db.execute(query)
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return {
        **ConversationOut.model_validate(conversation).model_dump(),
        "messages": [MessageOut.model_validate(m).model_dump() for m in conversation.messages],
    }


@router.post(
    "/conversations/{conversation_id}/messages",
    status_code=status.HTTP_201_CREATED,
    summary="Add message to conversation",
)
async def add_message(
    conversation_id: uuid.UUID,
    payload: MessageCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    conversation = await db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    message = ConversationMessage(
        conversation_id=conversation_id,
        sender_type=payload.sender_type,
        sender_id=payload.sender_id or current_user.id,
        content=payload.content,
        content_type=payload.content_type,
        attachments=payload.attachments,
    )
    db.add(message)

    conversation.last_message_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(message)
    return MessageOut.model_validate(message).model_dump()


@router.put("/conversations/{conversation_id}/assign", summary="Assign conversation to user")
async def assign_conversation(
    conversation_id: uuid.UUID,
    payload: ConversationAssign,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    conversation = await db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    conversation.assigned_to = payload.assigned_to
    if conversation.status == "open":
        conversation.status = "pending"

    await db.commit()
    await db.refresh(conversation)
    return ConversationOut.model_validate(conversation).model_dump()


@router.put("/conversations/{conversation_id}/resolve", summary="Resolve conversation")
async def resolve_conversation(
    conversation_id: uuid.UUID,
    payload: ConversationResolve,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    conversation = await db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    conversation.status = payload.status

    await db.commit()
    await db.refresh(conversation)
    return ConversationOut.model_validate(conversation).model_dump()


# ── Knowledge Base Endpoints ──────────────────────────────────────────────────


@router.get("/kb/articles", summary="List KB articles")
async def list_kb_articles(
    current_user: CurrentUser,
    db: DBSession,
    category: str | None = Query(None, description="Filter by category"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    search: str | None = Query(None, description="Search by title"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(KnowledgeBaseArticle)

    if category:
        query = query.where(KnowledgeBaseArticle.category == category)
    if status_filter:
        query = query.where(KnowledgeBaseArticle.status == status_filter)
    if search:
        safe_pat = like_pattern(search)
        query = query.where(KnowledgeBaseArticle.title.ilike(safe_pat))

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(KnowledgeBaseArticle.updated_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    articles = result.scalars().all()
    return {
        "total": total,
        "items": [ArticleOut.model_validate(a).model_dump() for a in articles],
    }


@router.post("/kb/articles", status_code=status.HTTP_201_CREATED, summary="Create KB article")
async def create_kb_article(
    payload: ArticleCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    article = KnowledgeBaseArticle(
        title=payload.title,
        slug=payload.slug,
        content_html=payload.content_html,
        content_text=payload.content_text,
        category=payload.category,
        tags=payload.tags,
        status=payload.status,
        author_id=current_user.id,
    )
    db.add(article)
    await db.commit()
    await db.refresh(article)

    # Compute embedding asynchronously (best-effort)
    try:
        from app.services.crm_kb_embeddings import update_article_embedding

        await update_article_embedding(db, article)
    except Exception:
        pass  # Embedding failure should not block article creation

    return ArticleOut.model_validate(article).model_dump()


@router.get("/kb/articles/{article_id}", summary="Get KB article")
async def get_kb_article(
    article_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    article = await db.get(KnowledgeBaseArticle, article_id)
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    article.view_count = (article.view_count or 0) + 1
    await db.commit()
    await db.refresh(article)
    return ArticleOut.model_validate(article).model_dump()


@router.put("/kb/articles/{article_id}", summary="Update KB article")
async def update_kb_article(
    article_id: uuid.UUID,
    payload: ArticleUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    article = await db.get(KnowledgeBaseArticle, article_id)
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(article, field, value)

    await db.commit()
    await db.refresh(article)

    # Re-compute embedding if content changed
    try:
        from app.services.crm_kb_embeddings import update_article_embedding

        await update_article_embedding(db, article)
    except Exception:
        pass

    return ArticleOut.model_validate(article).model_dump()


@router.delete("/kb/articles/{article_id}", status_code=status.HTTP_200_OK, summary="Delete KB article")
async def delete_kb_article(
    article_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    article = await db.get(KnowledgeBaseArticle, article_id)
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    await db.delete(article)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


@router.post("/kb/search", summary="Semantic search KB articles")
async def search_kb_articles(
    payload: KBSearchRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.services.crm_kb_embeddings import semantic_search

    results = await semantic_search(db, query=payload.query, limit=payload.limit)
    return {"items": results}


# ── SLA Policy Endpoints ─────────────────────────────────────────────────────


@router.get("/sla/policies", summary="List SLA policies")
async def list_sla_policies(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    query = select(SLAPolicy).order_by(SLAPolicy.priority)
    result = await db.execute(query)
    policies = result.scalars().all()
    return {
        "total": len(policies),
        "items": [SLAPolicyOut.model_validate(p).model_dump() for p in policies],
    }


@router.post("/sla/policies", status_code=status.HTTP_201_CREATED, summary="Create SLA policy")
async def create_sla_policy(
    payload: SLAPolicyCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    policy = SLAPolicy(
        name=payload.name,
        description=payload.description,
        priority=payload.priority,
        first_response_hours=payload.first_response_hours,
        resolution_hours=payload.resolution_hours,
        business_hours_only=payload.business_hours_only,
        is_active=payload.is_active,
    )
    db.add(policy)
    await db.commit()
    await db.refresh(policy)
    return SLAPolicyOut.model_validate(policy).model_dump()


@router.put("/sla/policies/{policy_id}", summary="Update SLA policy")
async def update_sla_policy(
    policy_id: uuid.UUID,
    payload: SLAPolicyUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    policy = await db.get(SLAPolicy, policy_id)
    if not policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SLA policy not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(policy, field, value)

    await db.commit()
    await db.refresh(policy)
    return SLAPolicyOut.model_validate(policy).model_dump()


@router.delete("/sla/policies/{policy_id}", status_code=status.HTTP_200_OK, summary="Delete SLA policy")
async def delete_sla_policy(
    policy_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    policy = await db.get(SLAPolicy, policy_id)
    if not policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SLA policy not found")
    await db.delete(policy)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


@router.get("/sla/tickets/{ticket_id}", summary="Get SLA tracker for a ticket")
async def get_sla_tracker(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    query = select(SLATracker).where(SLATracker.ticket_id == ticket_id)
    result = await db.execute(query)
    tracker = result.scalar_one_or_none()
    if not tracker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SLA tracker not found for this ticket")
    return SLATrackerOut.model_validate(tracker).model_dump()
