from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel as PydanticBase
from sqlalchemy import func, select, update

from app.core.deps import CurrentUser, DBSession
from app.models.notification import Notification

router = APIRouter()


# ── Pydantic Schemas ─────────────────────────────────────────────────────────


class NotificationOut(PydanticBase):
    id: UUID
    title: str
    message: str
    type: str
    module: str | None
    is_read: bool
    link_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UnreadCountOut(PydanticBase):
    count: int


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/", response_model=dict[str, Any])
async def list_notifications(
    db: DBSession,
    current_user: CurrentUser,
    is_read: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    """List notifications for the current user."""
    base = select(Notification).where(Notification.user_id == current_user.id)

    if is_read is not None:
        base = base.where(Notification.is_read == is_read)

    # Total count
    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar_one()

    # Paginated items
    items_q = base.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
    rows = (await db.execute(items_q)).scalars().all()

    return {
        "total": total,
        "items": [NotificationOut.model_validate(r) for r in rows],
    }


@router.get("/unread-count", response_model=UnreadCountOut)
async def unread_count(
    db: DBSession,
    current_user: CurrentUser,
) -> UnreadCountOut:
    """Return the number of unread notifications for the current user."""
    q = select(func.count()).select_from(Notification).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False,  # noqa: E712
    )
    count = (await db.execute(q)).scalar_one()
    return UnreadCountOut(count=count)


@router.put("/read-all", response_model=dict[str, int])
async def mark_all_read(
    db: DBSession,
    current_user: CurrentUser,
) -> dict[str, int]:
    """Mark every notification for the current user as read."""
    stmt = (
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,  # noqa: E712
        )
        .values(is_read=True)
    )
    result = await db.execute(stmt)
    await db.commit()
    return {"updated": result.rowcount}


@router.put("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(
    notification_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
) -> NotificationOut:
    """Mark a single notification as read."""
    q = select(Notification).where(Notification.id == notification_id)
    notif = (await db.execute(q)).scalar_one_or_none()

    if notif is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    if notif.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not your notification",
        )

    notif.is_read = True
    await db.commit()
    await db.refresh(notif)
    return NotificationOut.model_validate(notif)


@router.post("/test", response_model=NotificationOut, status_code=status.HTTP_201_CREATED)
async def create_test_notification(
    db: DBSession,
    current_user: CurrentUser,
) -> NotificationOut:
    """Create a test notification for the current user (useful for verifying the system)."""
    notif = Notification(
        user_id=current_user.id,
        title="Test Notification",
        message="This is a test notification to confirm the system is working.",
        type="info",
        module=None,
        link_url="/notifications",
    )
    db.add(notif)
    await db.commit()
    await db.refresh(notif)
    return NotificationOut.model_validate(notif)


@router.delete("/{notification_id}", response_model=dict[str, bool])
async def delete_notification(
    notification_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
) -> dict[str, bool]:
    """Delete a notification owned by the current user."""
    q = select(Notification).where(Notification.id == notification_id)
    notif = (await db.execute(q)).scalar_one_or_none()

    if notif is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    if notif.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not your notification",
        )

    await db.delete(notif)
    await db.commit()
    return {"ok": True}
