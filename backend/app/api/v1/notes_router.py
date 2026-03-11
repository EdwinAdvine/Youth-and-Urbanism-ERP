"""Notes API — personal notes for each user."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import select

from sqlalchemy import or_

from app.core.deps import CurrentUser, DBSession
from app.models.notes import Note

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class NoteCreate(BaseModel):
    title: str = "Untitled"
    content: str | None = None
    tags: list[str] | None = None
    is_pinned: bool = False


class NoteUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    tags: list[str] | None = None
    is_pinned: bool | None = None


class NoteShare(BaseModel):
    user_ids: list[str]


class NoteLink(BaseModel):
    type: str  # "doc", "file", "folder", "calendar", "project", "task"
    id: str
    title: str | None = None


class NoteOut(BaseModel):
    id: uuid.UUID
    title: str
    content: str | None
    tags: list[str] | None
    is_pinned: bool
    shared_with: list | None
    is_shared: bool
    linked_items: list | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", summary="List notes for the current user")
async def list_notes(
    current_user: CurrentUser,
    db: DBSession,
    tag: str | None = Query(None, description="Filter notes that contain this tag"),
    pinned: bool | None = Query(None, description="Filter by pinned status"),
) -> dict[str, Any]:
    query = select(Note).where(Note.owner_id == current_user.id)
    if pinned is not None:
        query = query.where(Note.is_pinned == pinned)
    if tag:
        # PostgreSQL ARRAY contains operator
        query = query.where(Note.tags.contains([tag]))
    # Pinned first, then most recently updated
    query = query.order_by(Note.is_pinned.desc(), Note.updated_at.desc())
    result = await db.execute(query)
    notes = result.scalars().all()
    return {
        "total": len(notes),
        "notes": [NoteOut.model_validate(n) for n in notes],
    }


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create a note")
async def create_note(
    payload: NoteCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    note = Note(
        title=payload.title,
        content=payload.content,
        owner_id=current_user.id,
        tags=payload.tags or [],
        is_pinned=payload.is_pinned,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return NoteOut.model_validate(note).model_dump()


@router.get("/{note_id}", summary="Get a single note")
async def get_note(
    note_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    note = await db.get(Note, note_id)
    if not note or note.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return NoteOut.model_validate(note).model_dump()


@router.put("/{note_id}", summary="Update a note")
async def update_note(
    note_id: uuid.UUID,
    payload: NoteUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    note = await db.get(Note, note_id)
    if not note or note.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    if payload.title is not None:
        note.title = payload.title
    if payload.content is not None:
        note.content = payload.content
    if payload.tags is not None:
        note.tags = payload.tags
    if payload.is_pinned is not None:
        note.is_pinned = payload.is_pinned

    await db.commit()
    await db.refresh(note)
    return NoteOut.model_validate(note).model_dump()


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a note")
async def delete_note(
    note_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    note = await db.get(Note, note_id)
    if not note or note.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    await db.delete(note)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{note_id}/share", summary="Share a note with other users")
async def share_note(
    note_id: uuid.UUID,
    payload: NoteShare,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    note = await db.get(Note, note_id)
    if not note or note.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    note.shared_with = payload.user_ids
    note.is_shared = len(payload.user_ids) > 0
    await db.commit()
    await db.refresh(note)
    return NoteOut.model_validate(note).model_dump()


@router.get("/shared-with-me", summary="List notes shared with the current user")
async def shared_with_me(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Query notes where shared_with JSON array contains our user id
    user_id_str = str(current_user.id)
    query = (
        select(Note)
        .where(Note.is_shared.is_(True))
        .order_by(Note.updated_at.desc())
    )
    result = await db.execute(query)
    all_shared = result.scalars().all()
    # Filter in Python since JSON array containment varies by driver
    notes = [n for n in all_shared if user_id_str in (n.shared_with or [])]
    return {
        "total": len(notes),
        "notes": [NoteOut.model_validate(n) for n in notes],
    }


# ── Deep Linking ─────────────────────────────────────────────────────────────

@router.post("/{note_id}/links", summary="Add a cross-module link to a note")
async def add_note_link(
    note_id: uuid.UUID,
    payload: NoteLink,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    note = await db.get(Note, note_id)
    if not note or note.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    links = list(note.linked_items or [])
    # Prevent duplicates
    if not any(l.get("type") == payload.type and l.get("id") == payload.id for l in links):
        links.append({"type": payload.type, "id": payload.id, "title": payload.title})
    note.linked_items = links
    await db.commit()
    await db.refresh(note)
    return NoteOut.model_validate(note).model_dump()


@router.delete("/{note_id}/links/{link_type}/{link_id}", summary="Remove a cross-module link from a note")
async def remove_note_link(
    note_id: uuid.UUID,
    link_type: str,
    link_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    note = await db.get(Note, note_id)
    if not note or note.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    links = [l for l in (note.linked_items or []) if not (l.get("type") == link_type and l.get("id") == link_id)]
    note.linked_items = links
    await db.commit()
    await db.refresh(note)
    return NoteOut.model_validate(note).model_dump()


@router.get("/{note_id}/links", summary="List cross-module links for a note")
async def list_note_links(
    note_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    note = await db.get(Note, note_id)
    if not note or note.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    return {"total": len(note.linked_items or []), "links": note.linked_items or []}
