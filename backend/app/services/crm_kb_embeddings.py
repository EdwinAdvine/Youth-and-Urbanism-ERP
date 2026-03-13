"""Knowledge Base embeddings — generate via OpenAI-compatible API, search via pgvector cosine similarity."""
from __future__ import annotations

import logging

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.crm_service import CRMKnowledgeBaseArticle as KnowledgeBaseArticle

logger = logging.getLogger(__name__)


async def generate_embedding(text_content: str) -> list[float] | None:
    """Generate an embedding vector using the configured AI provider."""
    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=settings.AI_API_KEY, base_url=settings.AI_BASE_URL)

        resp = await client.embeddings.create(
            model="text-embedding-3-small",
            input=text_content[:8000],
        )
        return resp.data[0].embedding
    except Exception:
        logger.exception("Failed to generate embedding via AI provider")
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
