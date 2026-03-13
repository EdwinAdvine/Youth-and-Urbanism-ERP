"""Embedding service for RAG: chunking, embedding, and semantic search."""
from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.embedding import DocumentEmbedding

logger = logging.getLogger(__name__)

# Approximate token-to-character ratio (1 token ~ 4 chars for English).
# We target ~500 tokens per chunk, so ~2000 characters.
CHUNK_SIZE_CHARS = 2000
CHUNK_OVERLAP_CHARS = 200


class EmbeddingService:
    """Handles text embedding via OpenAI-compatible API and vector storage/search in pgvector."""

    # ── Embed a single text ────────────────────────────────────────────────
    async def embed_text(self, text: str) -> list[float]:
        """Call the configured AI provider's embeddings API to get a vector for *text*."""
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=settings.AI_API_KEY, base_url=settings.AI_BASE_URL)

        resp = await client.embeddings.create(
            model="text-embedding-3-small",
            input=text,
        )
        embedding = resp.data[0].embedding
        if not embedding:
            raise ValueError("AI provider returned no embedding.")
        return embedding

    # ── Chunk text into ~500-token pieces ──────────────────────────────────
    @staticmethod
    def _chunk_text(text: str) -> list[str]:
        """Split *text* into overlapping chunks of roughly CHUNK_SIZE_CHARS."""
        if not text:
            return []
        chunks: list[str] = []
        start = 0
        while start < len(text):
            end = start + CHUNK_SIZE_CHARS
            chunk = text[start:end]
            if chunk.strip():
                chunks.append(chunk.strip())
            start += CHUNK_SIZE_CHARS - CHUNK_OVERLAP_CHARS
        return chunks

    # ── Chunk, embed, and store ────────────────────────────────────────────
    async def chunk_and_embed(
        self,
        source_type: str,
        source_id: uuid.UUID,
        text: str,
        db: AsyncSession,
        metadata: dict[str, Any] | None = None,
    ) -> int:
        """Split *text* into chunks, embed each, and store as DocumentEmbedding rows.

        Returns the number of chunks stored.
        """
        # Remove old embeddings for this source first
        await self.delete_embeddings(source_type, source_id, db)

        chunks = self._chunk_text(text)
        if not chunks:
            return 0

        for idx, chunk in enumerate(chunks):
            try:
                vector = await self.embed_text(chunk)
            except Exception:
                logger.exception(
                    "Failed to embed chunk %d for %s:%s", idx, source_type, source_id
                )
                continue

            record = DocumentEmbedding(
                source_type=source_type,
                source_id=source_id,
                chunk_index=idx,
                chunk_text=chunk,
                embedding=vector,
                metadata_json=metadata or {},
            )
            db.add(record)

        await db.flush()
        logger.info(
            "Stored %d embeddings for %s:%s", len(chunks), source_type, source_id
        )
        return len(chunks)

    # ── Semantic search ────────────────────────────────────────────────────
    async def search(
        self,
        query_text: str,
        top_k: int = 5,
        source_types: list[str] | None = None,
        db: AsyncSession | None = None,
    ) -> list[dict[str, Any]]:
        """Embed *query_text* and find the closest chunks using cosine distance.

        Returns a list of dicts with keys: source_type, source_id, chunk_text,
        chunk_index, score, metadata_json.
        """
        if db is None:
            raise ValueError("db session is required for search")

        query_vector = await self.embed_text(query_text)

        # Build the query using pgvector's <=> (cosine distance) operator
        # Lower distance = more similar
        filters = ""
        params: dict[str, Any] = {"query_vec": str(query_vector), "top_k": top_k}
        if source_types:
            placeholders = ", ".join(f":st_{i}" for i in range(len(source_types)))
            filters = f"AND source_type IN ({placeholders})"
            for i, st in enumerate(source_types):
                params[f"st_{i}"] = st

        sql = text(f"""
            SELECT id, source_type, source_id, chunk_index, chunk_text,
                   metadata_json,
                   (embedding <=> :query_vec::vector) AS distance
            FROM document_embeddings
            WHERE 1=1 {filters}
            ORDER BY embedding <=> :query_vec::vector
            LIMIT :top_k
        """)

        result = await db.execute(sql, params)
        rows = result.fetchall()

        return [
            {
                "source_type": row.source_type,
                "source_id": str(row.source_id),
                "chunk_index": row.chunk_index,
                "chunk_text": row.chunk_text,
                "metadata_json": row.metadata_json,
                "score": 1.0 - float(row.distance),  # Convert distance to similarity
            }
            for row in rows
        ]

    # ── Delete embeddings for a source ─────────────────────────────────────
    async def delete_embeddings(
        self,
        source_type: str,
        source_id: uuid.UUID,
        db: AsyncSession,
    ) -> int:
        """Remove all embedding rows for the given source. Returns count deleted."""
        stmt = delete(DocumentEmbedding).where(
            DocumentEmbedding.source_type == source_type,
            DocumentEmbedding.source_id == source_id,
        )
        result = await db.execute(stmt)
        return result.rowcount  # type: ignore[return-value]


# Module-level singleton (reusable across the app)
embedding_svc = EmbeddingService()
