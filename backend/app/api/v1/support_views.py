"""Support Saved Views API — user-scoped saved ticket filters."""

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select

from app.core.deps import CurrentUser, DBSession
from app.models.support import Ticket
from app.models.support_phase1 import SavedTicketView

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class ViewCreate(BaseModel):
    name: str
    filters: dict | None = None
    columns: list[str] | None = None
    sort_by: str = "created_at"
    sort_order: str = "desc"
    is_shared: bool = False
    is_default: bool = False


class ViewUpdate(BaseModel):
    name: str | None = None
    filters: dict | None = None
    columns: list[str] | None = None
    sort_by: str | None = None
    sort_order: str | None = None
    is_shared: bool | None = None
    is_default: bool | None = None


class ViewOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    filters: dict | None
    columns: list | None
    sort_by: str
    sort_order: str
    is_shared: bool
    is_default: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/views", summary="List saved ticket views")
async def list_views(
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(SavedTicketView)
        .where(
            or_(
                SavedTicketView.user_id == current_user.id,
                SavedTicketView.is_shared == True,  # noqa: E712
            )
        )
        .order_by(SavedTicketView.is_default.desc(), SavedTicketView.name)
    )
    views = result.scalars().all()
    return [ViewOut.model_validate(v).model_dump() for v in views]


@router.post("/views", status_code=201, summary="Create saved view")
async def create_view(
    payload: ViewCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # If setting as default, unset other defaults for this user
    if payload.is_default:
        existing = await db.execute(
            select(SavedTicketView).where(
                and_(
                    SavedTicketView.user_id == current_user.id,
                    SavedTicketView.is_default == True,  # noqa: E712
                )
            )
        )
        for v in existing.scalars().all():
            v.is_default = False

    view = SavedTicketView(
        **payload.model_dump(),
        user_id=current_user.id,
    )
    db.add(view)
    await db.commit()
    await db.refresh(view)
    return ViewOut.model_validate(view).model_dump()


@router.put("/views/{view_id}", summary="Update saved view")
async def update_view(
    view_id: uuid.UUID,
    payload: ViewUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    view = await db.get(SavedTicketView, view_id)
    if not view:
        raise HTTPException(status_code=404, detail="View not found")
    if view.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only edit own views")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(view, field, value)

    await db.commit()
    await db.refresh(view)
    return ViewOut.model_validate(view).model_dump()


@router.delete("/views/{view_id}", status_code=204, summary="Delete saved view")
async def delete_view(
    view_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    view = await db.get(SavedTicketView, view_id)
    if not view:
        raise HTTPException(status_code=404, detail="View not found")
    if view.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only delete own views")

    await db.delete(view)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


@router.get("/views/{view_id}/tickets", summary="Execute saved view — returns filtered tickets")
async def execute_view(
    view_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    view = await db.get(SavedTicketView, view_id)
    if not view:
        raise HTTPException(status_code=404, detail="View not found")
    if view.user_id != current_user.id and not view.is_shared:
        raise HTTPException(status_code=403, detail="Access denied")

    filters_dict = view.filters or {}
    sql_filters = []

    if "status" in filters_dict:
        statuses = filters_dict["status"]
        if isinstance(statuses, list) and statuses:
            sql_filters.append(Ticket.status.in_(statuses))
        elif isinstance(statuses, str):
            sql_filters.append(Ticket.status == statuses)

    if "priority" in filters_dict:
        priorities = filters_dict["priority"]
        if isinstance(priorities, list) and priorities:
            sql_filters.append(Ticket.priority.in_(priorities))
        elif isinstance(priorities, str):
            sql_filters.append(Ticket.priority == priorities)

    if "assigned_to" in filters_dict and filters_dict["assigned_to"]:
        sql_filters.append(Ticket.assigned_to == uuid.UUID(filters_dict["assigned_to"]))

    if "category_id" in filters_dict and filters_dict["category_id"]:
        sql_filters.append(Ticket.category_id == uuid.UUID(filters_dict["category_id"]))

    if "tags" in filters_dict:
        for tag in filters_dict["tags"]:
            sql_filters.append(Ticket.tags.any(tag))

    if "search" in filters_dict and filters_dict["search"]:
        like = f"%{filters_dict['search']}%"
        sql_filters.append(
            or_(Ticket.subject.ilike(like), Ticket.ticket_number.ilike(like))
        )

    # Count
    count_q = select(func.count()).select_from(Ticket)
    if sql_filters:
        count_q = count_q.where(and_(*sql_filters))
    total = (await db.execute(count_q)).scalar() or 0

    # Sort
    sort_col = getattr(Ticket, view.sort_by, Ticket.created_at)
    order = sort_col.desc() if view.sort_order == "desc" else sort_col.asc()

    q = select(Ticket).order_by(order).offset((page - 1) * limit).limit(limit)
    if sql_filters:
        q = q.where(and_(*sql_filters))
    result = await db.execute(q)
    tickets = result.scalars().all()

    from app.api.v1.support import _ticket_out

    return {
        "total": total,
        "view_name": view.name,
        "tickets": [_ticket_out(t) for t in tickets],
    }
