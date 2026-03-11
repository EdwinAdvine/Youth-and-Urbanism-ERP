"""Knowledge Base embeddings — generate via Ollama, search via pgvector cosine similarity."""
from __future__ import annotations

import logging

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.crm_service import KnowledgeBaseArticle

logger = logging.getLogger(__name__)


async def generate_embedding(text_content: str) -> list[float] | None:
    """Generate an embedding vector using the local Ollama instance."""
    try:
        import httpx
        from app.core.config import settings

        ollama_url = f"http://{settings.OLLAMA_HOST}:{settings.OLLAMA_PORT}"
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{ollama_url}/api/embeddings",
                json={"model": "nomic-embed-text", "prompt": text_content[:8000]},
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("embedding")
    except Exception:
        logger.exception("Failed to generate embedding via Ollama")
    return None


async def update_article_embedding(db: AsyncSession, article_id) -> bool:
    """Generate and store embedding for a knowledge base article."""
    article = await db.get(KnowledgeBaseArticle, article_id)
    if not article:
        return False

    content = f"{article.title}\n\n{article.content_text or article.content_html or ''}"
    embedding = await generate_embedding(content)

    if embedding:
        article.embedding = embedding
        await db.flush()
        return True
    return False


async def semantic_search(db: AsyncSession, query: str, limit: int = 10) -> list[dict]:
    """Search knowledge base articles by semantic similarity."""
    query_embedding = await generate_embedding(query)
    if not query_embedding:
        # Fallback to text search
        return await _text_search(db, query, limit)

    # Use pgvector cosine distance
    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"
    stmt = text("""
        SELECT id, title, slug, category, content_text,
               1 - (embedding <=> :embedding::vector) AS similarity
        FROM crm_knowledge_base_articles
        WHERE status = 'published' AND embedding IS NOT NULL
        ORDER BY embedding <=> :embedding::vector
        LIMIT :limit
    """)

    result = await db.execute(stmt, {"embedding": embedding_str, "limit": limit})
    rows = result.all()

    return [
        {
            "id": str(row.id),
            "title": row.title,
            "slug": row.slug,
            "category": row.category,
            "snippet": (row.content_text or "")[:200],
            "similarity": float(row.similarity) if row.similarity else 0,
        }
        for row in rows
    ]


async def _text_search(db: AsyncSession, query: str, limit: int = 10) -> list[dict]:
    """Fallback text search using ILIKE."""
    pattern = f"%{query}%"
    stmt = (
        select(KnowledgeBaseArticle)
        .where(
            KnowledgeBaseArticle.status == "published",
            KnowledgeBaseArticle.title.ilike(pattern)
            | KnowledgeBaseArticle.content_text.ilike(pattern),
        )
        .limit(limit)
    )
    result = await db.execute(stmt)
    articles = result.scalars().all()

    return [
        {
            "id": str(a.id),
            "title": a.title,
            "slug": a.slug,
            "category": a.category,
            "snippet": (a.content_text or "")[:200],
            "similarity": 0,
        }
        for a in articles
    ]
