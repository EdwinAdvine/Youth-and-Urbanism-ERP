"""Mail Filters API — CRUD for server-side Sieve-compatible mail filters."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.mail import MailFilter

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class FilterCreate(BaseModel):
    name: str
    conditions: dict | list = []
    actions: list = []
    is_active: bool = True
    priority: int = 0
    sieve_script: str | None = None


class FilterUpdate(BaseModel):
    name: str | None = None
    conditions: dict | list | None = None
    actions: list | None = None
    is_active: bool | None = None
    priority: int | None = None
    sieve_script: str | None = None


class FilterOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    conditions: Any
    actions: Any
    is_active: bool
    priority: int
    sieve_script: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/filters", summary="List mail filters for the current user")
async def list_filters(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(MailFilter)
        .where(MailFilter.user_id == current_user.id)
        .order_by(MailFilter.priority.asc(), MailFilter.name.asc())
    )
    filters = result.scalars().all()
    return {
        "total": len(filters),
        "filters": [FilterOut.model_validate(f).model_dump() for f in filters],
    }


@router.post("/filters", status_code=status.HTTP_201_CREATED, summary="Create a mail filter")
async def create_filter(
    payload: FilterCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    mail_filter = MailFilter(
        user_id=current_user.id,
        name=payload.name,
        conditions=payload.conditions,
        actions=payload.actions,
        is_active=payload.is_active,
        priority=payload.priority,
        sieve_script=payload.sieve_script,
    )
    db.add(mail_filter)
    await db.commit()
    await db.refresh(mail_filter)
    return FilterOut.model_validate(mail_filter).model_dump()


@router.get("/filters/{filter_id}", summary="Get a mail filter")
async def get_filter(
    filter_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    mail_filter = await db.get(MailFilter, filter_id)
    if not mail_filter or mail_filter.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Filter not found")
    return FilterOut.model_validate(mail_filter).model_dump()


@router.put("/filters/{filter_id}", summary="Update a mail filter")
async def update_filter(
    filter_id: uuid.UUID,
    payload: FilterUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    mail_filter = await db.get(MailFilter, filter_id)
    if not mail_filter or mail_filter.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Filter not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(mail_filter, field, value)

    await db.commit()
    await db.refresh(mail_filter)
    return FilterOut.model_validate(mail_filter).model_dump()


@router.delete("/filters/{filter_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete a mail filter")
async def delete_filter(
    filter_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    mail_filter = await db.get(MailFilter, filter_id)
    if not mail_filter or mail_filter.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Filter not found")
    await db.delete(mail_filter)
    await db.commit()
