"""Notes offline sync — batch mutation replay for PWA offline edits."""

import uuid
import logging
from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.deps import CurrentUser, DBSession

logger = logging.getLogger(__name__)
router = APIRouter()


class Mutation(BaseModel):
    id: str
    type: Literal["create_note", "update_note", "delete_note"]
    payload: dict[str, Any]
    timestamp: int


class SyncBatchRequest(BaseModel):
    mutations: list[Mutation]


class SyncBatchResponse(BaseModel):
    applied: int
    skipped: int
    errors: list[str]


@router.post("/sync-batch", response_model=SyncBatchResponse)
async def sync_batch(body: SyncBatchRequest, db: DBSession, user: CurrentUser) -> SyncBatchResponse:
    """Replay offline mutations in timestamp order.

    Idempotent: duplicate mutation IDs (by note_id + timestamp) are skipped.
    """
    from app.models.notes import Note  # noqa: PLC0415
    from sqlalchemy import select  # noqa: PLC0415

    applied = 0
    skipped = 0
    errors: list[str] = []

    # Sort by timestamp ascending — apply in order
    mutations = sorted(body.mutations, key=lambda m: m.timestamp)

    for mutation in mutations:
        try:
            if mutation.type == "create_note":
                payload = mutation.payload
                # Skip if note with same id already exists
                note_id = payload.get("id")
                if note_id:
                    existing = await db.get(Note, uuid.UUID(str(note_id)))
                    if existing:
                        skipped += 1
                        continue
                note = Note(
                    title=payload.get("title", "Untitled"),
                    content=payload.get("content", ""),
                    owner_id=user.id,
                    tags=payload.get("tags", []),
                    notebook_id=uuid.UUID(str(payload["notebook_id"])) if payload.get("notebook_id") else None,
                )
                if note_id:
                    note.id = uuid.UUID(str(note_id))
                db.add(note)
                applied += 1

            elif mutation.type == "update_note":
                note_id = mutation.payload.get("id")
                if not note_id:
                    skipped += 1
                    continue
                note = await db.get(Note, uuid.UUID(str(note_id)))
                if not note or str(note.owner_id) != str(user.id):
                    skipped += 1
                    continue
                # Only apply if offline timestamp is newer than server updated_at
                offline_ts = mutation.timestamp / 1000  # ms to seconds
                server_ts = note.updated_at.timestamp() if note.updated_at else 0
                if offline_ts < server_ts:
                    skipped += 1
                    continue
                for field in ("title", "content", "tags", "is_pinned"):
                    if field in mutation.payload:
                        setattr(note, field, mutation.payload[field])
                note.updated_at = datetime.now(UTC)
                applied += 1

            elif mutation.type == "delete_note":
                note_id = mutation.payload.get("id")
                if not note_id:
                    skipped += 1
                    continue
                note = await db.get(Note, uuid.UUID(str(note_id)))
                if note and str(note.owner_id) == str(user.id):
                    await db.delete(note)
                    applied += 1
                else:
                    skipped += 1

        except Exception as e:
            logger.exception("Failed to apply mutation %s", mutation.id)
            errors.append(f"Mutation {mutation.id}: {e!s}")

    await db.commit()
    return SyncBatchResponse(applied=applied, skipped=skipped, errors=errors)
