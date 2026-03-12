"""E-Commerce Blog API — admin CRUD + public storefront endpoints."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession
from app.models.ecommerce_blog import BlogPost

router = APIRouter(tags=["E-Commerce Blog"])

# Separate router for public storefront blog endpoints (no auth required)
storefront_blog_router = APIRouter(tags=["Storefront Blog"])


# ── Admin Blog Endpoints ──────────────────────────────────────────────────────

@router.get("/blog")
async def list_blog_posts(
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
    store_id: uuid.UUID | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 50,
):
    """Admin: list all blog posts with status, author, and published_at."""
    q = select(BlogPost)
    if store_id:
        q = q.where(BlogPost.store_id == store_id)
    if status:
        q = q.where(BlogPost.status == status)
    q = q.order_by(BlogPost.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    posts = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "store_id": str(p.store_id),
            "title": p.title,
            "slug": p.slug,
            "status": p.status,
            "author_id": str(p.author_id),
            "author_name": (
                f"{p.author.first_name or ''} {p.author.last_name or ''}".strip()
                if p.author else None
            ),
            "published_at": p.published_at.isoformat() if p.published_at else None,
            "view_count": p.view_count,
            "tags": p.tags_json or [],
            "feature_image": p.feature_image,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in posts
    ]


@router.post("/blog", status_code=201)
async def create_blog_post(
    data: dict,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Create a new blog post (defaults to draft status)."""
    post = BlogPost(
        store_id=uuid.UUID(data["store_id"]),
        title=data["title"],
        slug=data["slug"],
        content_markdown=data.get("content_markdown"),
        author_id=current_user.id,
        status=data.get("status", "draft"),
        tags_json=data.get("tags", []),
        meta_title=data.get("meta_title"),
        meta_description=data.get("meta_description"),
        feature_image=data.get("feature_image"),
    )
    if post.status == "published" and not post.published_at:
        post.published_at = datetime.now(timezone.utc)

    db.add(post)
    await db.commit()
    await db.refresh(post)
    return {"id": str(post.id), "slug": post.slug, "status": post.status}


@router.get("/blog/{post_id}")
async def get_blog_post(
    post_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Get a blog post by ID (admin)."""
    result = await db.execute(select(BlogPost).where(BlogPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return {
        "id": str(post.id),
        "store_id": str(post.store_id),
        "title": post.title,
        "slug": post.slug,
        "content_markdown": post.content_markdown,
        "status": post.status,
        "author_id": str(post.author_id),
        "published_at": post.published_at.isoformat() if post.published_at else None,
        "tags": post.tags_json or [],
        "meta_title": post.meta_title,
        "meta_description": post.meta_description,
        "feature_image": post.feature_image,
        "view_count": post.view_count,
        "created_at": post.created_at.isoformat() if post.created_at else None,
    }


@router.put("/blog/{post_id}")
async def update_blog_post(
    post_id: uuid.UUID,
    data: dict,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Update a blog post."""
    result = await db.execute(select(BlogPost).where(BlogPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")

    for field in ["title", "slug", "content_markdown", "meta_title", "meta_description", "feature_image"]:
        if field in data:
            setattr(post, field, data[field])
    if "tags" in data:
        post.tags_json = data["tags"]
    if "status" in data:
        post.status = data["status"]
        if data["status"] == "published" and not post.published_at:
            post.published_at = datetime.now(timezone.utc)

    await db.commit()
    return {"id": str(post.id), "slug": post.slug, "status": post.status}


@router.delete("/blog/{post_id}", status_code=204)
async def delete_blog_post(
    post_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Delete a blog post."""
    result = await db.execute(select(BlogPost).where(BlogPost.id == post_id))
    post = result.scalar_one_or_none()
    if post:
        await db.delete(post)
        await db.commit()


@router.put("/blog/{post_id}/publish")
async def publish_blog_post(
    post_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Set post status to published and record published_at timestamp."""
    result = await db.execute(select(BlogPost).where(BlogPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    post.status = "published"
    if not post.published_at:
        post.published_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": str(post.id), "status": post.status, "published_at": post.published_at.isoformat()}


@router.put("/blog/{post_id}/unpublish")
async def unpublish_blog_post(
    post_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Set post status back to draft."""
    result = await db.execute(select(BlogPost).where(BlogPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    post.status = "draft"
    await db.commit()
    return {"id": str(post.id), "status": post.status}


# ── Storefront Blog Endpoints (public, no auth) ───────────────────────────────

@storefront_blog_router.get("/blog")
async def storefront_list_blog_posts(
    store_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    skip: int = 0,
    limit: int = 20,
):
    """Public: list published blog posts for a store."""
    result = await db.execute(
        select(BlogPost)
        .where(BlogPost.store_id == store_id)
        .where(BlogPost.status == "published")
        .order_by(BlogPost.published_at.desc())
        .offset(skip)
        .limit(limit)
    )
    posts = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "title": p.title,
            "slug": p.slug,
            "feature_image": p.feature_image,
            "tags": p.tags_json or [],
            "meta_description": p.meta_description,
            "published_at": p.published_at.isoformat() if p.published_at else None,
            "view_count": p.view_count,
        }
        for p in posts
    ]


@storefront_blog_router.get("/blog/{slug}")
async def storefront_get_blog_post_by_slug(
    slug: str,
    db: AsyncSession = Depends(DBSession),
):
    """Public: get a published blog post by slug and increment view_count."""
    result = await db.execute(
        select(BlogPost)
        .where(BlogPost.slug == slug)
        .where(BlogPost.status == "published")
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")

    post.view_count = (post.view_count or 0) + 1
    await db.commit()

    return {
        "id": str(post.id),
        "title": post.title,
        "slug": post.slug,
        "content_markdown": post.content_markdown,
        "feature_image": post.feature_image,
        "tags": post.tags_json or [],
        "meta_title": post.meta_title,
        "meta_description": post.meta_description,
        "published_at": post.published_at.isoformat() if post.published_at else None,
        "view_count": post.view_count,
        "author": (
            {
                "id": str(post.author_id),
                "name": f"{post.author.first_name or ''} {post.author.last_name or ''}".strip(),
            }
            if post.author else None
        ),
    }
