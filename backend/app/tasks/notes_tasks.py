"""Notes embedding tasks: generate pgvector embeddings for semantic note search."""
from __future__ import annotations

import asyncio
import logging
import re

from celery import shared_task

logger = logging.getLogger(__name__)


def _strip_html(html: str) -> str:
    """Remove HTML tags and collapse whitespace."""
    text = re.sub(r"<[^>]+>", "", html)
    return text.strip()


@shared_task(name="tasks.embed_note", bind=True, max_retries=3)
def embed_note_task(self, note_id: str) -> dict:
    """Generate vector embeddings for a note's content and store in pgvector.

    Triggered after note.created and note.updated events.
    Chunks the cleaned note text and stores DocumentEmbedding rows for RAG search.
    """

    async def _embed():
        import uuid as uuid_mod

        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.models.notes import Note
        from app.services.embedding import EmbeddingService

        async with AsyncSessionLocal() as db:
            stmt = select(Note).where(Note.id == uuid_mod.UUID(note_id))
            result = await db.execute(stmt)
            note = result.scalar_one_or_none()

            if not note:
                logger.warning("embed_note_task: note %s not found", note_id)
                return {"status": "error", "error": "Note not found"}

            raw_content = note.content or ""
            if not raw_content.strip():
                logger.info("embed_note_task: note %s has no content — skipping", note_id)
                return {"status": "skipped", "reason": "Empty content"}

            clean_text = _strip_html(raw_content)
            if not clean_text:
                return {"status": "skipped", "reason": "Content empty after stripping HTML"}

            svc = EmbeddingService()
            chunk_count = await svc.chunk_and_embed(
                source_type="note",
                source_id=note.id,
                text=clean_text,
                db=db,
                metadata={"title": note.title, "owner_id": str(note.owner_id)},
            )
            await db.commit()

            logger.info(
                "embed_note_task: stored %d chunks for note %s (%r)",
                chunk_count,
                note_id,
                note.title,
            )
            return {
                "status": "success",
                "note_id": note_id,
                "chunks": chunk_count,
            }

    try:
        return asyncio.run(_embed())
    except Exception as exc:
        logger.exception("embed_note_task failed for note %s", note_id)
        raise self.retry(exc=exc, countdown=30)
