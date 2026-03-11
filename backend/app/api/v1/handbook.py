"""Handbook API — categories, articles, search, feedback, progress, and admin."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.models.handbook import (
    HandbookArticle,
    HandbookCategory,
    HandbookFeedback,
    HandbookProgress,
    HandbookViewLog,
)

router = APIRouter()

AdminUser = require_app_admin("handbook")


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    slug: str
    description: str | None = None
    icon: str | None = None
    parent_id: uuid.UUID | None = None
    sort_order: int = 0
    module: str | None = None
    is_active: bool = True


class CategoryUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    icon: str | None = None
    parent_id: uuid.UUID | None = None
    sort_order: int | None = None
    module: str | None = None
    is_active: bool | None = None


class CategoryOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    icon: str | None
    parent_id: uuid.UUID | None
    sort_order: int
    module: str | None
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class CategoryTreeOut(CategoryOut):
    children: list[CategoryTreeOut] = []
    article_count: int = 0


class ArticleCreate(BaseModel):
    title: str
    slug: str
    content_markdown: str = ""
    content_html: str | None = None
    excerpt: str | None = None
    category_id: uuid.UUID | None = None
    status: str = "draft"
    article_type: str = "guide"
    module: str | None = None
    tags: list[str] | None = None
    sort_order: int = 0
    featured_image_url: str | None = None
    video_url: str | None = None
    ai_shortcut_prompt: str | None = None
    estimated_read_time: int | None = None
    is_pinned: bool = False


class ArticleUpdate(BaseModel):
    title: str | None = None
    slug: str | None = None
    content_markdown: str | None = None
    content_html: str | None = None
    excerpt: str | None = None
    category_id: uuid.UUID | None = None
    status: str | None = None
    article_type: str | None = None
    module: str | None = None
    tags: list[str] | None = None
    sort_order: int | None = None
    featured_image_url: str | None = None
    video_url: str | None = None
    ai_shortcut_prompt: str | None = None
    estimated_read_time: int | None = None
    is_pinned: bool | None = None


class ArticleOut(BaseModel):
    id: uuid.UUID
    title: str
    slug: str
    excerpt: str | None
    category_id: uuid.UUID | None
    author_id: uuid.UUID
    status: str
    article_type: str
    module: str | None
    tags: list[str] | None
    sort_order: int
    featured_image_url: str | None
    video_url: str | None
    ai_shortcut_prompt: str | None
    estimated_read_time: int | None
    view_count: int
    helpful_count: int
    not_helpful_count: int
    is_pinned: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class ArticleDetailOut(ArticleOut):
    content_markdown: str
    content_html: str | None
    category: CategoryOut | None = None


class FeedbackCreate(BaseModel):
    is_helpful: bool
    comment: str | None = None


class FeedbackOut(BaseModel):
    id: uuid.UUID
    article_id: uuid.UUID
    user_id: uuid.UUID
    is_helpful: bool
    comment: str | None
    created_at: Any

    model_config = {"from_attributes": True}


class ReorderItem(BaseModel):
    id: uuid.UUID
    sort_order: int


class BulkReorder(BaseModel):
    items: list[ReorderItem]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _build_category_tree(categories: list, parent_id: uuid.UUID | None = None) -> list[dict]:
    """Build a nested category tree from a flat list."""
    tree = []
    for cat in categories:
        if cat.parent_id == parent_id:
            node = CategoryOut.model_validate(cat).model_dump()
            node["children"] = _build_category_tree(categories, cat.id)
            node["article_count"] = len(cat.articles) if hasattr(cat, "articles") and cat.articles else 0
            tree.append(node)
    tree.sort(key=lambda x: x["sort_order"])
    return tree


# ══════════════════════════════════════════════════════════════════════════════
#  PUBLIC ENDPOINTS (all authenticated users)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/categories", summary="List all active categories (tree structure)")
async def list_categories(
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict]:
    query = (
        select(HandbookCategory)
        .where(HandbookCategory.is_active == True)  # noqa: E712
        .options(selectinload(HandbookCategory.articles))
        .order_by(HandbookCategory.sort_order)
    )
    result = await db.execute(query)
    categories = result.scalars().all()
    return _build_category_tree(list(categories))


@router.get("/categories/{slug}", summary="Get category with its published articles")
async def get_category(
    slug: str,
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    cat_result = await db.execute(
        select(HandbookCategory).where(
            HandbookCategory.slug == slug,
            HandbookCategory.is_active == True,  # noqa: E712
        )
    )
    category = cat_result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    count_q = (
        select(func.count())
        .select_from(HandbookArticle)
        .where(HandbookArticle.category_id == category.id, HandbookArticle.status == "published")
    )
    total = (await db.execute(count_q)).scalar() or 0

    articles_q = (
        select(HandbookArticle)
        .where(HandbookArticle.category_id == category.id, HandbookArticle.status == "published")
        .order_by(HandbookArticle.is_pinned.desc(), HandbookArticle.sort_order, HandbookArticle.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    articles = (await db.execute(articles_q)).scalars().all()

    return {
        "category": CategoryOut.model_validate(category).model_dump(),
        "total": total,
        "articles": [ArticleOut.model_validate(a).model_dump() for a in articles],
    }


@router.get("/articles", summary="List published articles")
async def list_articles(
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category: str | None = Query(None, description="Filter by category slug"),
    module: str | None = Query(None, description="Filter by ERP module"),
    tag: str | None = Query(None, description="Filter by tag"),
    article_type: str | None = Query(None, description="Filter by article type"),
) -> dict[str, Any]:
    conditions = [HandbookArticle.status == "published"]

    if category:
        cat_result = await db.execute(
            select(HandbookCategory.id).where(HandbookCategory.slug == category)
        )
        cat_id = cat_result.scalar_one_or_none()
        if cat_id:
            conditions.append(HandbookArticle.category_id == cat_id)

    if module:
        conditions.append(HandbookArticle.module == module)
    if article_type:
        conditions.append(HandbookArticle.article_type == article_type)
    if tag:
        conditions.append(HandbookArticle.tags.any(tag))

    count_q = select(func.count()).select_from(HandbookArticle).where(*conditions)
    total = (await db.execute(count_q)).scalar() or 0

    articles_q = (
        select(HandbookArticle)
        .where(*conditions)
        .order_by(HandbookArticle.is_pinned.desc(), HandbookArticle.sort_order, HandbookArticle.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    articles = (await db.execute(articles_q)).scalars().all()

    return {
        "total": total,
        "articles": [ArticleOut.model_validate(a).model_dump() for a in articles],
    }


@router.get("/articles/{slug}", summary="Get a single article by slug")
async def get_article(
    slug: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    query = (
        select(HandbookArticle)
        .where(HandbookArticle.slug == slug, HandbookArticle.status == "published")
        .options(selectinload(HandbookArticle.category))
    )
    result = await db.execute(query)
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Increment view count
    await db.execute(
        update(HandbookArticle)
        .where(HandbookArticle.id == article.id)
        .values(view_count=HandbookArticle.view_count + 1)
    )

    # Log view
    view_log = HandbookViewLog(article_id=article.id, user_id=current_user.id)
    db.add(view_log)
    await db.commit()
    await db.refresh(article)

    return ArticleDetailOut.model_validate(article).model_dump()


@router.get("/articles/{article_id}/related", summary="Get related articles")
async def get_related_articles(
    article_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    limit: int = Query(5, ge=1, le=20),
) -> list[dict]:
    article = await db.get(HandbookArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Find articles in the same category or with overlapping tags
    conditions = [
        HandbookArticle.status == "published",
        HandbookArticle.id != article_id,
    ]
    or_conditions = []
    if article.category_id:
        or_conditions.append(HandbookArticle.category_id == article.category_id)
    if article.module:
        or_conditions.append(HandbookArticle.module == article.module)

    if or_conditions:
        conditions.append(or_(*or_conditions))

    query = (
        select(HandbookArticle)
        .where(*conditions)
        .order_by(HandbookArticle.view_count.desc())
        .limit(limit)
    )
    related = (await db.execute(query)).scalars().all()
    return [ArticleOut.model_validate(a).model_dump() for a in related]


@router.get("/search", summary="Full-text search articles")
async def search_articles(
    current_user: CurrentUser,
    db: DBSession,
    q: str = Query(..., min_length=1, description="Search query"),
    module: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    term = f"%{q}%"
    conditions = [
        HandbookArticle.status == "published",
        or_(
            HandbookArticle.title.ilike(term),
            HandbookArticle.excerpt.ilike(term),
            HandbookArticle.content_markdown.ilike(term),
        ),
    ]
    if module:
        conditions.append(HandbookArticle.module == module)

    count_q = select(func.count()).select_from(HandbookArticle).where(*conditions)
    total = (await db.execute(count_q)).scalar() or 0

    query = (
        select(HandbookArticle)
        .where(*conditions)
        .order_by(HandbookArticle.view_count.desc(), HandbookArticle.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    articles = (await db.execute(query)).scalars().all()

    return {
        "total": total,
        "query": q,
        "articles": [ArticleOut.model_validate(a).model_dump() for a in articles],
    }


@router.post("/articles/{article_id}/feedback", summary="Submit feedback on an article")
async def submit_feedback(
    article_id: uuid.UUID,
    payload: FeedbackCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    article = await db.get(HandbookArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Check existing feedback
    existing = await db.execute(
        select(HandbookFeedback).where(
            HandbookFeedback.article_id == article_id,
            HandbookFeedback.user_id == current_user.id,
        )
    )
    feedback = existing.scalar_one_or_none()

    if feedback:
        # Update existing feedback
        old_helpful = feedback.is_helpful
        feedback.is_helpful = payload.is_helpful
        feedback.comment = payload.comment

        # Adjust counts
        if old_helpful != payload.is_helpful:
            if payload.is_helpful:
                article.helpful_count += 1
                article.not_helpful_count = max(0, article.not_helpful_count - 1)
            else:
                article.not_helpful_count += 1
                article.helpful_count = max(0, article.helpful_count - 1)
    else:
        # Create new feedback
        feedback = HandbookFeedback(
            article_id=article_id,
            user_id=current_user.id,
            is_helpful=payload.is_helpful,
            comment=payload.comment,
        )
        db.add(feedback)
        if payload.is_helpful:
            article.helpful_count += 1
        else:
            article.not_helpful_count += 1

    await db.commit()
    await db.refresh(feedback)
    return FeedbackOut.model_validate(feedback).model_dump()


@router.post("/articles/{article_id}/mark-read", summary="Mark article as read")
async def mark_article_read(
    article_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, str]:
    article = await db.get(HandbookArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    existing = await db.execute(
        select(HandbookProgress).where(
            HandbookProgress.article_id == article_id,
            HandbookProgress.user_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        return {"status": "already_marked"}

    progress = HandbookProgress(article_id=article_id, user_id=current_user.id)
    db.add(progress)
    await db.commit()
    return {"status": "marked"}


@router.delete(
    "/articles/{article_id}/mark-read",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Unmark article as read",
)
async def unmark_article_read(
    article_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    result = await db.execute(
        select(HandbookProgress).where(
            HandbookProgress.article_id == article_id,
            HandbookProgress.user_id == current_user.id,
        )
    )
    progress = result.scalar_one_or_none()
    if progress:
        await db.delete(progress)
        await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/progress", summary="Get current user's reading progress")
async def get_progress(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(HandbookProgress).where(HandbookProgress.user_id == current_user.id)
    )
    records = result.scalars().all()

    total_published = (
        await db.execute(
            select(func.count()).select_from(HandbookArticle).where(HandbookArticle.status == "published")
        )
    ).scalar() or 0

    return {
        "read_article_ids": [str(r.article_id) for r in records],
        "total_read": len(records),
        "total_published": total_published,
        "completion_pct": round(len(records) / total_published * 100, 1) if total_published else 0,
    }


@router.get("/getting-started", summary="Get onboarding / getting-started articles")
async def getting_started(
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict]:
    query = (
        select(HandbookArticle)
        .where(
            HandbookArticle.status == "published",
            HandbookArticle.article_type == "quickstart",
        )
        .order_by(HandbookArticle.sort_order, HandbookArticle.created_at)
    )
    articles = (await db.execute(query)).scalars().all()
    return [ArticleOut.model_validate(a).model_dump() for a in articles]


# ══════════════════════════════════════════════════════════════════════════════
#  ADMIN ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/admin/categories", status_code=status.HTTP_201_CREATED, summary="Create category")
async def admin_create_category(
    payload: CategoryCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    if not current_user.is_superadmin:
        from app.core.rbac import is_app_admin  # noqa: PLC0415
        if not await is_app_admin(db, str(current_user.id), "handbook"):
            raise HTTPException(status_code=403, detail="Admin access required")

    category = HandbookCategory(**payload.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return CategoryOut.model_validate(category).model_dump()


@router.put("/admin/categories/{cat_id}", summary="Update category")
async def admin_update_category(
    cat_id: uuid.UUID,
    payload: CategoryUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    if not current_user.is_superadmin:
        from app.core.rbac import is_app_admin  # noqa: PLC0415
        if not await is_app_admin(db, str(current_user.id), "handbook"):
            raise HTTPException(status_code=403, detail="Admin access required")

    category = await db.get(HandbookCategory, cat_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(category, field, value)

    await db.commit()
    await db.refresh(category)
    return CategoryOut.model_validate(category).model_dump()


@router.delete(
    "/admin/categories/{cat_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete category",
)
async def admin_delete_category(
    cat_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    if not current_user.is_superadmin:
        from app.core.rbac import is_app_admin  # noqa: PLC0415
        if not await is_app_admin(db, str(current_user.id), "handbook"):
            raise HTTPException(status_code=403, detail="Admin access required")

    category = await db.get(HandbookCategory, cat_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    await db.delete(category)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/admin/categories/reorder", summary="Bulk reorder categories")
async def admin_reorder_categories(
    payload: BulkReorder,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, str]:
    if not current_user.is_superadmin:
        from app.core.rbac import is_app_admin  # noqa: PLC0415
        if not await is_app_admin(db, str(current_user.id), "handbook"):
            raise HTTPException(status_code=403, detail="Admin access required")

    for item in payload.items:
        await db.execute(
            update(HandbookCategory)
            .where(HandbookCategory.id == item.id)
            .values(sort_order=item.sort_order)
        )
    await db.commit()
    return {"status": "reordered"}


@router.post("/admin/articles", status_code=status.HTTP_201_CREATED, summary="Create article")
async def admin_create_article(
    payload: ArticleCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    if not current_user.is_superadmin:
        from app.core.rbac import is_app_admin  # noqa: PLC0415
        if not await is_app_admin(db, str(current_user.id), "handbook"):
            raise HTTPException(status_code=403, detail="Admin access required")

    # Estimate read time from markdown content (~200 words/min)
    word_count = len(payload.content_markdown.split())
    est_read_time = payload.estimated_read_time or max(1, round(word_count / 200))

    article = HandbookArticle(
        **payload.model_dump(exclude={"estimated_read_time"}),
        author_id=current_user.id,
        estimated_read_time=est_read_time,
    )
    db.add(article)
    await db.commit()
    await db.refresh(article)
    return ArticleOut.model_validate(article).model_dump()


@router.put("/admin/articles/{article_id}", summary="Update article")
async def admin_update_article(
    article_id: uuid.UUID,
    payload: ArticleUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    if not current_user.is_superadmin:
        from app.core.rbac import is_app_admin  # noqa: PLC0415
        if not await is_app_admin(db, str(current_user.id), "handbook"):
            raise HTTPException(status_code=403, detail="Admin access required")

    article = await db.get(HandbookArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    data = payload.model_dump(exclude_none=True)

    # Recalculate read time if content changed
    if "content_markdown" in data:
        word_count = len(data["content_markdown"].split())
        data["estimated_read_time"] = max(1, round(word_count / 200))

    for field, value in data.items():
        setattr(article, field, value)

    await db.commit()
    await db.refresh(article)
    return ArticleOut.model_validate(article).model_dump()


@router.delete(
    "/admin/articles/{article_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete article",
)
async def admin_delete_article(
    article_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    if not current_user.is_superadmin:
        from app.core.rbac import is_app_admin  # noqa: PLC0415
        if not await is_app_admin(db, str(current_user.id), "handbook"):
            raise HTTPException(status_code=403, detail="Admin access required")

    article = await db.get(HandbookArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    await db.delete(article)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/admin/articles/reorder", summary="Bulk reorder articles")
async def admin_reorder_articles(
    payload: BulkReorder,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, str]:
    if not current_user.is_superadmin:
        from app.core.rbac import is_app_admin  # noqa: PLC0415
        if not await is_app_admin(db, str(current_user.id), "handbook"):
            raise HTTPException(status_code=403, detail="Admin access required")

    for item in payload.items:
        await db.execute(
            update(HandbookArticle)
            .where(HandbookArticle.id == item.id)
            .values(sort_order=item.sort_order)
        )
    await db.commit()
    return {"status": "reordered"}


@router.post("/admin/articles/{article_id}/publish", summary="Publish article")
async def admin_publish_article(
    article_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    if not current_user.is_superadmin:
        from app.core.rbac import is_app_admin  # noqa: PLC0415
        if not await is_app_admin(db, str(current_user.id), "handbook"):
            raise HTTPException(status_code=403, detail="Admin access required")

    article = await db.get(HandbookArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    article.status = "published"
    await db.commit()
    await db.refresh(article)
    return ArticleOut.model_validate(article).model_dump()


@router.post("/admin/articles/{article_id}/archive", summary="Archive article")
async def admin_archive_article(
    article_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    if not current_user.is_superadmin:
        from app.core.rbac import is_app_admin  # noqa: PLC0415
        if not await is_app_admin(db, str(current_user.id), "handbook"):
            raise HTTPException(status_code=403, detail="Admin access required")

    article = await db.get(HandbookArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    article.status = "archived"
    await db.commit()
    await db.refresh(article)
    return ArticleOut.model_validate(article).model_dump()


@router.post("/admin/articles/{article_id}/upload-media", summary="Upload media to MinIO")
async def admin_upload_media(
    article_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: CurrentUser = None,
    db: DBSession = None,
) -> dict[str, str]:
    if not current_user.is_superadmin:
        from app.core.rbac import is_app_admin  # noqa: PLC0415
        if not await is_app_admin(db, str(current_user.id), "handbook"):
            raise HTTPException(status_code=403, detail="Admin access required")

    article = await db.get(HandbookArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    from app.integrations.minio_client import upload_file  # noqa: PLC0415

    file_content = await file.read()
    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "bin"
    object_name = f"handbook/{article_id}/{uuid.uuid4()}.{ext}"

    url = await upload_file(
        bucket="urban-erp-files",
        object_name=object_name,
        data=file_content,
        content_type=file.content_type or "application/octet-stream",
    )

    return {"url": url, "object_name": object_name}


@router.get("/admin/analytics", summary="Handbook analytics dashboard")
async def admin_analytics(
    current_user: CurrentUser,
    db: DBSession,
    days: int = Query(30, ge=1, le=365),
) -> dict[str, Any]:
    if not current_user.is_superadmin:
        from app.core.rbac import is_app_admin  # noqa: PLC0415
        if not await is_app_admin(db, str(current_user.id), "handbook"):
            raise HTTPException(status_code=403, detail="Admin access required")

    from datetime import timedelta  # noqa: PLC0415
    from datetime import datetime, timezone  # noqa: PLC0415

    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Total articles by status
    status_counts = {}
    for s in ("draft", "published", "archived"):
        count = (await db.execute(
            select(func.count()).select_from(HandbookArticle).where(HandbookArticle.status == s)
        )).scalar() or 0
        status_counts[s] = count

    # Total views in period
    total_views = (await db.execute(
        select(func.count()).select_from(HandbookViewLog).where(HandbookViewLog.viewed_at >= since)
    )).scalar() or 0

    # Most viewed articles
    most_viewed_q = (
        select(HandbookArticle)
        .where(HandbookArticle.status == "published")
        .order_by(HandbookArticle.view_count.desc())
        .limit(10)
    )
    most_viewed = (await db.execute(most_viewed_q)).scalars().all()

    # Most helpful articles
    most_helpful_q = (
        select(HandbookArticle)
        .where(HandbookArticle.status == "published", HandbookArticle.helpful_count > 0)
        .order_by(HandbookArticle.helpful_count.desc())
        .limit(10)
    )
    most_helpful = (await db.execute(most_helpful_q)).scalars().all()

    # Least helpful (most not-helpful feedback)
    least_helpful_q = (
        select(HandbookArticle)
        .where(HandbookArticle.status == "published", HandbookArticle.not_helpful_count > 0)
        .order_by(HandbookArticle.not_helpful_count.desc())
        .limit(10)
    )
    least_helpful = (await db.execute(least_helpful_q)).scalars().all()

    # Total feedback
    total_feedback = (await db.execute(
        select(func.count()).select_from(HandbookFeedback)
    )).scalar() or 0

    return {
        "period_days": days,
        "status_counts": status_counts,
        "total_views": total_views,
        "total_feedback": total_feedback,
        "most_viewed": [ArticleOut.model_validate(a).model_dump() for a in most_viewed],
        "most_helpful": [ArticleOut.model_validate(a).model_dump() for a in most_helpful],
        "least_helpful": [ArticleOut.model_validate(a).model_dump() for a in least_helpful],
    }


@router.get("/admin/analytics/articles/{article_id}", summary="Per-article analytics")
async def admin_article_analytics(
    article_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    days: int = Query(30, ge=1, le=365),
) -> dict[str, Any]:
    if not current_user.is_superadmin:
        from app.core.rbac import is_app_admin  # noqa: PLC0415
        if not await is_app_admin(db, str(current_user.id), "handbook"):
            raise HTTPException(status_code=403, detail="Admin access required")

    article = await db.get(HandbookArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    from datetime import timedelta, timezone  # noqa: PLC0415

    since = datetime.now(timezone.utc) - timedelta(days=days)

    views_in_period = (await db.execute(
        select(func.count()).select_from(HandbookViewLog).where(
            HandbookViewLog.article_id == article_id,
            HandbookViewLog.viewed_at >= since,
        )
    )).scalar() or 0

    unique_viewers = (await db.execute(
        select(func.count(func.distinct(HandbookViewLog.user_id))).where(
            HandbookViewLog.article_id == article_id,
            HandbookViewLog.viewed_at >= since,
        )
    )).scalar() or 0

    feedback_result = await db.execute(
        select(HandbookFeedback).where(HandbookFeedback.article_id == article_id)
    )
    all_feedback = feedback_result.scalars().all()

    completions = (await db.execute(
        select(func.count()).select_from(HandbookProgress).where(
            HandbookProgress.article_id == article_id,
        )
    )).scalar() or 0

    return {
        "article": ArticleOut.model_validate(article).model_dump(),
        "period_days": days,
        "views_in_period": views_in_period,
        "unique_viewers": unique_viewers,
        "total_views": article.view_count,
        "helpful_count": article.helpful_count,
        "not_helpful_count": article.not_helpful_count,
        "total_completions": completions,
        "feedback": [FeedbackOut.model_validate(f).model_dump() for f in all_feedback],
    }
