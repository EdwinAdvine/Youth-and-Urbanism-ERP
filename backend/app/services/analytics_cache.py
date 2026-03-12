"""Analytics Redis caching layer — three-tier cache strategy.

Tier 1: Redis (1-5 min TTL) — widget query results
Tier 2: PostgreSQL materialized views (hourly/daily) — heavy aggregations
Tier 3: Browser (TanStack Query staleTime) — client-side

This module handles Tier 1. Cache keys follow:
    analytics:widget:{widget_id}:{query_hash}
    analytics:query:{query_hash}
    analytics:kpi:{module}:{kpi_name}
"""
from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

# Module-level Redis connection (lazy init)
_redis: aioredis.Redis | None = None

DEFAULT_TTL = 300  # 5 minutes
KPI_TTL = 60  # 1 minute for KPIs (near real-time)
REPORT_TTL = 900  # 15 minutes for heavy reports


async def get_redis() -> aioredis.Redis:
    """Get or create the analytics Redis connection."""
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            db=3,  # Separate DB from Celery (db 1/2) and EventBus (db 0)
        )
    return _redis


def _make_key(prefix: str, *parts: str) -> str:
    """Build a namespaced cache key."""
    return f"analytics:{prefix}:{':'.join(parts)}"


def _hash_query(query_config: dict | str) -> str:
    """Create a stable hash for a query config."""
    if isinstance(query_config, dict):
        raw = json.dumps(query_config, sort_keys=True, default=str)
    else:
        raw = str(query_config)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


async def get_cached(key: str) -> dict | list | None:
    """Retrieve a cached value. Returns None on miss."""
    try:
        r = await get_redis()
        raw = await r.get(key)
        if raw is not None:
            logger.debug("Cache HIT: %s", key)
            return json.loads(raw)
        logger.debug("Cache MISS: %s", key)
        return None
    except Exception:
        logger.warning("Cache read error for %s", key, exc_info=True)
        return None


async def set_cached(key: str, value: Any, ttl: int = DEFAULT_TTL) -> None:
    """Store a value in cache with TTL."""
    try:
        r = await get_redis()
        raw = json.dumps(value, default=str)
        await r.setex(key, ttl, raw)
        logger.debug("Cache SET: %s (TTL=%ds)", key, ttl)
    except Exception:
        logger.warning("Cache write error for %s", key, exc_info=True)


async def invalidate(key: str) -> None:
    """Remove a specific cache entry."""
    try:
        r = await get_redis()
        await r.delete(key)
        logger.debug("Cache INVALIDATED: %s", key)
    except Exception:
        logger.warning("Cache invalidation error for %s", key, exc_info=True)


async def invalidate_pattern(pattern: str) -> None:
    """Remove all cache entries matching a pattern (e.g., analytics:widget:*).

    Uses SCAN to avoid blocking Redis on large keyspaces.
    """
    try:
        r = await get_redis()
        cursor = 0
        deleted = 0
        while True:
            cursor, keys = await r.scan(cursor, match=pattern, count=100)
            if keys:
                await r.delete(*keys)
                deleted += len(keys)
            if cursor == 0:
                break
        if deleted:
            logger.info("Cache INVALIDATED %d keys matching '%s'", deleted, pattern)
    except Exception:
        logger.warning("Cache pattern invalidation error for %s", pattern, exc_info=True)


async def invalidate_widget(widget_id: str) -> None:
    """Invalidate all cached data for a specific widget."""
    await invalidate_pattern(f"analytics:widget:{widget_id}:*")


async def invalidate_module(module: str) -> None:
    """Invalidate all cached KPIs and data for a module."""
    await invalidate_pattern(f"analytics:kpi:{module}:*")
    await invalidate_pattern(f"analytics:module:{module}:*")


async def invalidate_dashboard(dashboard_id: str) -> None:
    """Invalidate all widget caches for a dashboard."""
    await invalidate_pattern(f"analytics:dashboard:{dashboard_id}:*")


# ── Convenience wrappers ─────────────────────────────────────────────────────

async def get_widget_data(widget_id: str, query_config: dict) -> dict | None:
    """Get cached widget query result."""
    key = _make_key("widget", widget_id, _hash_query(query_config))
    return await get_cached(key)


async def set_widget_data(
    widget_id: str, query_config: dict, data: dict, ttl: int = DEFAULT_TTL
) -> None:
    """Cache a widget query result."""
    key = _make_key("widget", widget_id, _hash_query(query_config))
    await set_cached(key, data, ttl)


async def get_kpi(module: str, kpi_name: str) -> dict | None:
    """Get cached KPI value."""
    key = _make_key("kpi", module, kpi_name)
    return await get_cached(key)


async def set_kpi(module: str, kpi_name: str, data: dict, ttl: int = KPI_TTL) -> None:
    """Cache a KPI value."""
    key = _make_key("kpi", module, kpi_name)
    await set_cached(key, data, ttl)


async def get_query_result(sql: str) -> dict | None:
    """Get cached ad-hoc query result."""
    key = _make_key("query", _hash_query(sql))
    return await get_cached(key)


async def set_query_result(sql: str, data: dict, ttl: int = DEFAULT_TTL) -> None:
    """Cache an ad-hoc query result."""
    key = _make_key("query", _hash_query(sql))
    await set_cached(key, data, ttl)


async def close() -> None:
    """Close the Redis connection (call on app shutdown)."""
    global _redis
    if _redis is not None:
        await _redis.close()
        _redis = None
