from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.models.crm_collaboration import CRMComment, RecordFollower

router = APIRouter()

# ---------------------------------------------------------------------------
# Pydantic schemas — Comments
# ---------------------------------------------------------------------------


class CommentCreate(BaseModel):
    entity_type: str
    entity_id: UUID
    content: str
    parent_id: UUID | None = None
    mentions: list[UUID] | None = None


class CommentUpdate(BaseModel):
    content: str


class CommentOut(BaseModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    parent_id: UUID | None
    content: str
    mentions: list[UUID] | None
    author_id: UUID
    is_edited: bool
    children: list[CommentOut] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Pydantic schemas — Followers
# ---------------------------------------------------------------------------


class FollowerCreate(BaseModel):
    entity_type: str
    entity_id: UUID


class FollowerOut(BaseModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    user_id: UUID

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Comments endpoints
# ---------------------------------------------------------------------------


@router.get("/comments")
async def list_comments(
    current_user: CurrentUser,
    db: DBSession,
    entity_type: str = Query(...),
    entity_id: UUID = Query(...),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """List comments for an entity, returned as a threaded structure."""

    # Total count for the entity (all comments, parents + children)
    count_q = select(func.count(CRMComment.id)).where(
        CRMComment.entity_type == entity_type,
        CRMComment.entity_id == entity_id,
    )
    total = (await db.execute(count_q)).scalar_one()

    # Fetch all comments for the entity so we can build the tree in-memory
    q = (
        select(CRMComment)
        .where(
            CRMComment.entity_type == entity_type,
            CRMComment.entity_id == entity_id,
        )
        .order_by(CRMComment.created_at)
    )
    rows = (await db.execute(q)).scalars().all()

    # Build threaded tree
    by_id: dict[UUID, dict[str, Any]] = {}
    roots: list[dict[str, Any]] = []

    for row in rows:
        node = CommentOut.model_validate(row).model_dump()
        node["children"] = []
        by_id[row.id] = node

    for row in rows:
        node = by_id[row.id]
        if row.parent_id and row.parent_id in by_id:
            by_id[row.parent_id]["children"].append(node)
        else:
            roots.append(node)

    # Paginate top-level threads
    paginated = roots[skip : skip + limit]

    return {"total": total, "items": paginated}


@router.post("/comments", status_code=status.HTTP_201_CREATED)
async def create_comment(
    body: CommentCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> CommentOut:
    """Create a comment on an entity."""

    # If replying, verify parent exists and belongs to the same entity
    if body.parent_id:
        parent = await db.get(CRMComment, body.parent_id)
        if not parent:
            raise HTTPException(status_code=404, detail="Parent comment not found")
        if parent.entity_type != body.entity_type or parent.entity_id != body.entity_id:
            raise HTTPException(
                status_code=400,
                detail="Parent comment belongs to a different entity",
            )

    comment = CRMComment(
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        parent_id=body.parent_id,
        content=body.content,
        mentions=[str(u) for u in body.mentions] if body.mentions else None,
        author_id=current_user.id,
        is_edited=False,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return CommentOut.model_validate(comment)


@router.put("/comments/{comment_id}")
async def update_comment(
    comment_id: UUID,
    body: CommentUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> CommentOut:
    """Update comment content. Only the author may edit."""

    comment = await db.get(CRMComment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the author can edit this comment")

    comment.content = body.content
    comment.is_edited = True
    await db.commit()
    await db.refresh(comment)
    return CommentOut.model_validate(comment)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    """Delete a comment. Allowed for the author or an admin."""

    comment = await db.get(CRMComment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    is_admin = getattr(current_user, "is_superuser", False) or getattr(
        current_user, "role", None
    ) in ("admin", "super_admin")

    if comment.author_id != current_user.id and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorised to delete this comment")

    await db.delete(comment)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Followers endpoints
# ---------------------------------------------------------------------------


@router.get("/followers")
async def list_followers(
    current_user: CurrentUser,
    db: DBSession,
    entity_type: str = Query(...),
    entity_id: UUID = Query(...),
) -> dict[str, Any]:
    """List all followers for a given entity."""

    q = select(RecordFollower).where(
        RecordFollower.entity_type == entity_type,
        RecordFollower.entity_id == entity_id,
    )
    rows = (await db.execute(q)).scalars().all()
    items = [FollowerOut.model_validate(r) for r in rows]
    return {"total": len(items), "items": items}


@router.post("/followers", status_code=status.HTTP_201_CREATED)
async def follow_record(
    body: FollowerCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> FollowerOut:
    """Follow a record. Prevents duplicate follows."""

    existing_q = select(RecordFollower).where(
        RecordFollower.entity_type == body.entity_type,
        RecordFollower.entity_id == body.entity_id,
        RecordFollower.user_id == current_user.id,
    )
    existing = (await db.execute(existing_q)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Already following this record")

    follower = RecordFollower(
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        user_id=current_user.id,
    )
    db.add(follower)
    await db.commit()
    await db.refresh(follower)
    return FollowerOut.model_validate(follower)


@router.delete("/followers/{follower_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unfollow_record(
    follower_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    """Unfollow a record."""

    follower = await db.get(RecordFollower, follower_id)
    if not follower:
        raise HTTPException(status_code=404, detail="Follower record not found")
    if follower.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorised to remove this follow")

    await db.delete(follower)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/followers/my")
async def list_my_follows(
    current_user: CurrentUser,
    db: DBSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """List all records the current user is following (paginated)."""

    count_q = select(func.count(RecordFollower.id)).where(
        RecordFollower.user_id == current_user.id,
    )
    total = (await db.execute(count_q)).scalar_one()

    q = (
        select(RecordFollower)
        .where(RecordFollower.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().all()
    items = [FollowerOut.model_validate(r) for r in rows]
    return {"total": total, "items": items}
