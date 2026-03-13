"""Notes API — personal notes for each user (extended with hierarchy support)."""

import logging
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import select

logger = logging.getLogger(__name__)

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.notes import Note, NoteEntityLink
from app.schemas.notes import (
    NoteCreate,
    NoteLink,
    NoteOut,
    NoteShare,
    NoteUpdate,
)

router = APIRouter()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", summary="List notes for the current user")
async def list_notes(
    current_user: CurrentUser,
    db: DBSession,
    tag: str | None = Query(None, description="Filter notes that contain this tag"),
    pinned: bool | None = Query(None, description="Filter by pinned status"),
    notebook_id: uuid.UUID | None = Query(None, description="Filter by notebook"),
    section_id: uuid.UUID | None = Query(None, description="Filter by section"),
    archived: bool = Query(False, description="Include archived notes"),
) -> dict[str, Any]:
    query = select(Note).where(Note.owner_id == current_user.id)
    if pinned is not None:
        query = query.where(Note.is_pinned == pinned)
    if tag:
        query = query.where(Note.tags.contains([tag]))
    if notebook_id:
        query = query.where(Note.notebook_id == notebook_id)
    if section_id:
        query = query.where(Note.section_id == section_id)
    if not archived:
        query = query.where(Note.is_archived.is_(False))
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
        # Hierarchy
        notebook_id=payload.notebook_id,
        section_id=payload.section_id,
        parent_page_id=payload.parent_page_id,
        # Editor
        content_format=payload.content_format,
        # Appearance
        icon=payload.icon,
        cover_image_url=payload.cover_image_url,
        full_width=payload.full_width,
        # Properties
        properties=payload.properties or {},
        # Source
        source_type=payload.source_type,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)

    # Auto-link source entity if provided
    if payload.source_entity_type and payload.source_entity_id:
        try:
            entity_uuid = uuid.UUID(payload.source_entity_id)
            link = NoteEntityLink(
                note_id=note.id,
                entity_type=payload.source_entity_type,
                entity_id=entity_uuid,
                link_type="created_from",
                created_by_id=current_user.id,
            )
            db.add(link)
            await db.commit()
        except ValueError:
            pass  # Invalid UUID, skip linking

    # Publish event for embedding pipeline & cross-module reactions
    await event_bus.publish("note.created", {
        "note_id": str(note.id),
        "owner_id": str(current_user.id),
        "title": note.title,
        "source_type": note.source_type,
    })
    await event_bus.publish_data_change("note", str(note.id), "created")

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

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(note, field, value)

    # Update word count if content changed
    if payload.content is not None:
        note.word_count = len((payload.content or "").split())

    await db.commit()
    await db.refresh(note)

    # Publish event for embedding pipeline
    await event_bus.publish("note.updated", {
        "note_id": str(note.id),
        "owner_id": str(current_user.id),
        "title": note.title,
    })
    await event_bus.publish_data_change("note", str(note.id), "updated")

    return NoteOut.model_validate(note).model_dump()


@router.delete("/{note_id}", status_code=status.HTTP_200_OK, summary="Delete a note")
async def delete_note(
    note_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    permanent: bool = Query(False),
) -> Response:
    note = await db.get(Note, note_id)
    if not note or note.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    if permanent:
        await db.delete(note)
    else:
        note.is_archived = True

    await db.commit()
    await event_bus.publish_data_change("note", str(note_id), "deleted")
    return Response(status_code=status.HTTP_200_OK)


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
    user_id_str = str(current_user.id)
    query = (
        select(Note)
        .where(Note.is_shared.is_(True))
        .order_by(Note.updated_at.desc())
    )
    result = await db.execute(query)
    all_shared = result.scalars().all()
    notes = [n for n in all_shared if user_id_str in (n.shared_with or [])]
    return {
        "total": len(notes),
        "notes": [NoteOut.model_validate(n) for n in notes],
    }


# ── Deep Linking (legacy JSON-based — kept for backward compat) ──────────

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


# ── Semantic Search ────────────────────────────────────────────────────────────

@router.get("/search/semantic", summary="Semantic (vector) search over the current user's notes")
async def semantic_search_notes(
    current_user: CurrentUser,
    db: DBSession,
    q: str = Query(..., description="Search query text"),
    limit: int = Query(10, ge=1, le=100, description="Maximum number of results to return"),
    notebook_id: uuid.UUID | None = Query(None, description="Restrict results to a specific notebook"),
) -> dict[str, Any]:
    """Hybrid semantic + keyword search across the current user's notes.

    1. Runs a pgvector cosine-similarity search (semantic).
    2. Runs an ILIKE search on title and content (keyword).
    3. Merges: semantic results first, then keyword-only results not already
       present, capped at *limit*.

    Each result includes: note_id, note_title, excerpt, score, notebook_id.
    """
    from sqlalchemy import or_

    from app.services.embedding import EmbeddingService

    svc = EmbeddingService()

    # ── 1. Semantic search ────────────────────────────────────────────────
    try:
        raw_semantic = await svc.search(
            query_text=q,
            top_k=limit * 2,
            source_types=["note"],
            db=db,
        )
    except Exception:
        logger.warning("Semantic search unavailable for notes query %r", q, exc_info=True)
        raw_semantic = []

    # Keep only notes owned by the current user (and optionally filtered by notebook)
    user_id_str = str(current_user.id)
    semantic_results: list[dict[str, Any]] = []
    seen_note_ids: set[str] = set()

    if raw_semantic:
        # Collect all source_ids returned
        candidate_ids = [r["source_id"] for r in raw_semantic]
        stmt = select(Note).where(
            Note.owner_id == current_user.id,
            Note.id.in_([uuid.UUID(nid) for nid in candidate_ids]),
        )
        if notebook_id:
            stmt = stmt.where(Note.notebook_id == notebook_id)
        note_result = await db.execute(stmt)
        notes_by_id: dict[str, Note] = {str(n.id): n for n in note_result.scalars().all()}

        for hit in raw_semantic:
            nid = hit["source_id"]
            if nid not in notes_by_id:
                continue  # filtered out (wrong owner / notebook)
            note_obj = notes_by_id[nid]
            chunk_text: str = hit.get("chunk_text", "")
            semantic_results.append(
                {
                    "note_id": nid,
                    "note_title": note_obj.title,
                    "excerpt": chunk_text[:200],
                    "score": round(hit["score"], 4),
                    "notebook_id": str(note_obj.notebook_id) if note_obj.notebook_id else None,
                }
            )
            seen_note_ids.add(nid)
            if len(semantic_results) >= limit:
                break

    # ── 2. ILIKE keyword search ───────────────────────────────────────────
    keyword_results: list[dict[str, Any]] = []
    if len(semantic_results) < limit:
        pattern = f"%{q}%"
        kw_stmt = select(Note).where(
            Note.owner_id == current_user.id,
            Note.is_archived.is_(False),
            or_(
                Note.title.ilike(pattern),
                Note.content.ilike(pattern),
            ),
        )
        if notebook_id:
            kw_stmt = kw_stmt.where(Note.notebook_id == notebook_id)
        kw_stmt = kw_stmt.order_by(Note.updated_at.desc()).limit(limit)
        kw_result = await db.execute(kw_stmt)
        kw_notes = kw_result.scalars().all()

        for note_obj in kw_notes:
            nid = str(note_obj.id)
            if nid in seen_note_ids:
                continue  # already in semantic results
            # Build excerpt from content
            raw_content = note_obj.content or ""
            import re
            clean = re.sub(r"<[^>]+>", "", raw_content).strip()
            keyword_results.append(
                {
                    "note_id": nid,
                    "note_title": note_obj.title,
                    "excerpt": clean[:200],
                    "score": 0.0,  # keyword match — no vector score
                    "notebook_id": str(note_obj.notebook_id) if note_obj.notebook_id else None,
                }
            )

    # ── 3. Merge and cap ─────────────────────────────────────────────────
    merged = (semantic_results + keyword_results)[:limit]
    return {
        "total": len(merged),
        "query": q,
        "results": merged,
    }
