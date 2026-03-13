"""Cursor-based pagination for high-volume list endpoints.

Usage in a router:
    from app.core.pagination import CursorPage, cursor_params

    @router.get("/invoices")
    async def list_invoices(
        paging: Annotated[dict, Depends(cursor_params)],
        db: DBSession,
    ) -> CursorPage:
        q = select(Invoice).where(...).order_by(Invoice.id.desc())
        return await paginate_cursor(db, q, paging, lambda row: {"id": row.id, ...})

Frontend (useInfiniteQuery):
    const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
        queryKey: ['invoices'],
        queryFn: ({ pageParam }) => fetchInvoices({ cursor: pageParam }),
        getNextPageParam: (last) => last.next_cursor ?? undefined,
    })
"""

from __future__ import annotations

import base64
import json
from typing import Any, TypeVar

from fastapi import Query
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


def _encode_cursor(value: Any) -> str:
    return base64.urlsafe_b64encode(json.dumps(value).encode()).decode()


def _decode_cursor(cursor: str) -> Any:
    try:
        return json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())
    except Exception:
        return None


class CursorPage:
    """Response wrapper for cursor-paginated results."""

    def __init__(
        self,
        items: list[Any],
        next_cursor: str | None,
        has_more: bool,
        total: int | None = None,
    ) -> None:
        self.items = items
        self.next_cursor = next_cursor
        self.has_more = has_more
        self.total = total

    def dict(self) -> dict[str, Any]:
        return {
            "items": self.items,
            "next_cursor": self.next_cursor,
            "has_more": self.has_more,
            "total": self.total,
        }


async def paginate_cursor(
    db: AsyncSession,
    query: Select,
    cursor: str | None,
    limit: int,
    serialiser: Any,
    cursor_column: str = "id",
    count_query: Select | None = None,
) -> CursorPage:
    """Execute cursor-paginated query.

    Args:
        db: Async database session
        query: Base SQLAlchemy select query (must be ordered by cursor_column DESC)
        cursor: Opaque cursor from previous page (None for first page)
        limit: Page size
        serialiser: Callable(row) → dict — converts ORM row to API dict
        cursor_column: Column name used as cursor (default: "id")
        count_query: Optional count query for total; omitted by default for performance
    """
    if cursor:
        cursor_value = _decode_cursor(cursor)
        if cursor_value is not None:
            # Assumes DESC ordering — next page has smaller IDs
            col = query.columns_clause_froms[0].c[cursor_column]
            query = query.where(col < cursor_value)

    # Fetch limit+1 to determine if there is a next page
    rows = (await db.execute(query.limit(limit + 1))).scalars().all()

    has_more = len(rows) > limit
    page_rows = rows[:limit]

    next_cursor: str | None = None
    if has_more and page_rows:
        last_val = getattr(page_rows[-1], cursor_column)
        next_cursor = _encode_cursor(last_val)

    total: int | None = None
    if count_query is not None:
        count_result = await db.execute(count_query)
        total = count_result.scalar_one_or_none()

    return CursorPage(
        items=[serialiser(row) for row in page_rows],
        next_cursor=next_cursor,
        has_more=has_more,
        total=total,
    )


def cursor_params(
    cursor: str | None = Query(default=None, description="Opaque pagination cursor from previous response"),
    limit: int = Query(default=50, ge=1, le=200, description="Page size (1–200)"),
) -> dict[str, Any]:
    """FastAPI dependency that extracts cursor pagination parameters."""
    return {"cursor": cursor, "limit": limit}
