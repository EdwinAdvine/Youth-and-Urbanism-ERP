"""Support Phase 2 — Community Forum API.

Endpoints for ForumCategory, ForumPost, ForumReply, and post→ticket conversion.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.models.support import Ticket
from app.models.support_phase2 import ForumCategory, ForumPost, ForumReply

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

# -- Categories --

class ForumCategoryCreate(BaseModel):
    name: str
    slug: str
    description: str | None = None
    sort_order: int = 0
    is_active: bool = True


class ForumCategoryUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class ForumCategoryOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    sort_order: int
    is_active: bool
    post_count: int
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Posts --

class ForumPostCreate(BaseModel):
    category_id: uuid.UUID
    title: str
    content: str


class ForumPostUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    is_pinned: bool | None = None
    is_locked: bool | None = None


class ForumPostOut(BaseModel):
    id: uuid.UUID
    category_id: uuid.UUID
    author_id: uuid.UUID
    author_type: str
    title: str
    content: str
    is_pinned: bool
    is_locked: bool
    view_count: int
    upvote_count: int
    reply_count: int
    author_name: str | None
    category_name: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Replies --

class ForumReplyCreate(BaseModel):
    content: str


class ForumReplyOut(BaseModel):
    id: uuid.UUID
    post_id: uuid.UUID
    author_id: uuid.UUID
    content: str
    is_best_answer: bool
    upvote_count: int
    author_name: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _post_out(post: ForumPost) -> dict[str, Any]:
    author_name: str | None = None
    if post.author:
        author_name = getattr(post.author, "full_name", None) or getattr(post.author, "email", None)
    category_name: str | None = post.category.name if post.category else None
    data = ForumPostOut.model_validate(post).model_dump()
    data["author_name"] = author_name
    data["category_name"] = category_name
    return data


def _reply_out(reply: ForumReply) -> dict[str, Any]:
    author_name: str | None = None
    if reply.author:
        author_name = getattr(reply.author, "full_name", None) or getattr(reply.author, "email", None)
    data = ForumReplyOut.model_validate(reply).model_dump()
    data["author_name"] = author_name
    return data


async def _generate_ticket_number(db) -> str:
    """Generate TKT-YYYY-NNNN."""
    year = datetime.now(timezone.utc).year
    prefix = f"TKT-{year}-"
    result = await db.execute(
        select(func.count()).select_from(Ticket).where(Ticket.ticket_number.like(f"{prefix}%"))
    )
    seq = (result.scalar() or 0) + 1
    return f"{prefix}{seq:04d}"


# ══════════════════════════════════════════════════════════════════════════════
#  FORUM CATEGORIES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/forum/categories", summary="List forum categories")
async def list_forum_categories(
    current_user: CurrentUser,
    db: DBSession,
    active_only: bool = Query(False),
) -> list[dict[str, Any]]:
    query = select(ForumCategory).order_by(ForumCategory.sort_order.asc(), ForumCategory.name.asc())
    if active_only:
        query = query.where(ForumCategory.is_active == True)  # noqa: E712
    result = await db.execute(query)
    categories = result.scalars().all()

    out = []
    for cat in categories:
        data = ForumCategoryOut.model_validate(cat).model_dump()
        data["post_count"] = len(cat.posts) if cat.posts else 0
        out.append(data)
    return out


@router.post(
    "/forum/categories",
    status_code=status.HTTP_201_CREATED,
    summary="Create a forum category",
)
async def create_forum_category(
    payload: ForumCategoryCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Check slug uniqueness
    existing = await db.execute(
        select(ForumCategory).where(ForumCategory.slug == payload.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A category with slug '{payload.slug}' already exists",
        )
    cat = ForumCategory(
        name=payload.name,
        slug=payload.slug,
        description=payload.description,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    data = ForumCategoryOut.model_validate(cat).model_dump()
    data["post_count"] = 0
    return data


@router.put("/forum/categories/{category_id}", summary="Update a forum category")
async def update_forum_category(
    category_id: uuid.UUID,
    payload: ForumCategoryUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    cat = await db.get(ForumCategory, category_id)
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    updates = payload.model_dump(exclude_none=True)
    if "slug" in updates and updates["slug"] != cat.slug:
        existing = await db.execute(
            select(ForumCategory).where(ForumCategory.slug == updates["slug"])
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A category with slug '{updates['slug']}' already exists",
            )
    for field, value in updates.items():
        setattr(cat, field, value)

    await db.commit()
    await db.refresh(cat)
    data = ForumCategoryOut.model_validate(cat).model_dump()
    data["post_count"] = len(cat.posts) if cat.posts else 0
    return data


@router.delete(
    "/forum/categories/{category_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a forum category",
)
async def delete_forum_category(
    category_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    cat = await db.get(ForumCategory, category_id)
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    await db.delete(cat)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
#  FORUM POSTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/forum/posts", summary="List forum posts with pagination")
async def list_forum_posts(
    current_user: CurrentUser,
    db: DBSession,
    category_id: uuid.UUID | None = Query(None),
    pinned_first: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(ForumPost)
    if category_id:
        query = query.where(ForumPost.category_id == category_id)

    if pinned_first:
        query = query.order_by(
            ForumPost.is_pinned.desc(),
            ForumPost.created_at.desc(),
        )
    else:
        query = query.order_by(ForumPost.created_at.desc())

    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginated results
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    posts = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_post_out(p) for p in posts],
    }


@router.post(
    "/forum/posts",
    status_code=status.HTTP_201_CREATED,
    summary="Create a forum post",
)
async def create_forum_post(
    payload: ForumPostCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Verify category exists
    cat = await db.get(ForumCategory, payload.category_id)
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    if not cat.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot post to an inactive category",
        )

    post = ForumPost(
        category_id=payload.category_id,
        title=payload.title,
        content=payload.content,
        author_id=current_user.id,
        author_type="user",
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return _post_out(post)


@router.get("/forum/posts/{post_id}", summary="Get forum post detail (increments view count)")
async def get_forum_post(
    post_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    post = await db.get(ForumPost, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    post.view_count = (post.view_count or 0) + 1
    await db.commit()
    await db.refresh(post)

    data = _post_out(post)
    data["replies"] = [_reply_out(r) for r in (post.replies or [])]
    return data


@router.put("/forum/posts/{post_id}", summary="Update a forum post")
async def update_forum_post(
    post_id: uuid.UUID,
    payload: ForumPostUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    post = await db.get(ForumPost, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(post, field, value)

    await db.commit()
    await db.refresh(post)
    return _post_out(post)


@router.delete(
    "/forum/posts/{post_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a forum post",
)
async def delete_forum_post(
    post_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    post = await db.get(ForumPost, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    await db.delete(post)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


@router.post("/forum/posts/{post_id}/upvote", summary="Upvote a forum post")
async def upvote_forum_post(
    post_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    post = await db.get(ForumPost, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    post.upvote_count = (post.upvote_count or 0) + 1
    await db.commit()
    await db.refresh(post)
    return {"post_id": str(post_id), "upvote_count": post.upvote_count}


# ══════════════════════════════════════════════════════════════════════════════
#  FORUM REPLIES
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/forum/posts/{post_id}/replies",
    status_code=status.HTTP_201_CREATED,
    summary="Create a reply on a forum post",
)
async def create_forum_reply(
    post_id: uuid.UUID,
    payload: ForumReplyCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    post = await db.get(ForumPost, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    if post.is_locked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This post is locked and cannot accept new replies",
        )

    reply = ForumReply(
        post_id=post_id,
        author_id=current_user.id,
        content=payload.content,
    )
    db.add(reply)

    post.reply_count = (post.reply_count or 0) + 1

    await db.commit()
    await db.refresh(reply)
    return _reply_out(reply)


@router.post("/forum/replies/{reply_id}/upvote", summary="Upvote a forum reply")
async def upvote_forum_reply(
    reply_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    reply = await db.get(ForumReply, reply_id)
    if not reply:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reply not found")

    reply.upvote_count = (reply.upvote_count or 0) + 1
    await db.commit()
    await db.refresh(reply)
    return {"reply_id": str(reply_id), "upvote_count": reply.upvote_count}


@router.post("/forum/replies/{reply_id}/best-answer", summary="Mark reply as best answer")
async def mark_best_answer(
    reply_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    reply = await db.get(ForumReply, reply_id)
    if not reply:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reply not found")

    post = await db.get(ForumPost, reply.post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated post not found")

    # Only the post author can mark a best answer
    if post.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the post author can mark a best answer",
        )

    # Unmark any existing best answer on this post
    existing_best_result = await db.execute(
        select(ForumReply).where(
            ForumReply.post_id == reply.post_id,
            ForumReply.is_best_answer == True,  # noqa: E712
        )
    )
    for existing_reply in existing_best_result.scalars().all():
        if existing_reply.id != reply_id:
            existing_reply.is_best_answer = False

    reply.is_best_answer = True
    await db.commit()
    await db.refresh(reply)
    return _reply_out(reply)


# ══════════════════════════════════════════════════════════════════════════════
#  CONVERT POST TO TICKET
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/forum/posts/{post_id}/convert-to-ticket",
    status_code=status.HTTP_201_CREATED,
    summary="Convert a forum post into a support ticket",
)
async def convert_post_to_ticket(
    post_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    post = await db.get(ForumPost, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    ticket_number = await _generate_ticket_number(db)

    author_name: str | None = None
    author_email: str | None = None
    if post.author:
        author_name = getattr(post.author, "full_name", None) or getattr(post.author, "email", None)
        author_email = getattr(post.author, "email", None)

    ticket = Ticket(
        ticket_number=ticket_number,
        subject=post.title,
        description=post.content,
        status="open",
        priority="medium",
        created_by=current_user.id,
        customer_name=author_name,
        customer_email=author_email,
        channel="forum",
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)

    return {
        "ticket_id": str(ticket.id),
        "ticket_number": ticket.ticket_number,
        "subject": ticket.subject,
        "status": ticket.status,
        "channel": ticket.channel,
        "source_post_id": str(post_id),
    }
