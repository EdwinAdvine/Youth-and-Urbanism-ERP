"""Performance monitoring endpoints for the Admin Performance Dashboard.

All endpoints require Super Admin access.

Endpoints:
    GET /perf/db-stats        — Top slow queries from pg_stat_statements
    GET /perf/db-pool         — SQLAlchemy engine pool stats
    GET /perf/cache-stats     — Redis memory + keyspace stats
    GET /perf/endpoint-timing — Per-endpoint p50/p95/p99 from Redis
    POST /perf/web-vitals     — Receive Core Web Vitals from frontend
"""


import logging
import statistics
from typing import Any

from fastapi import APIRouter

from app.core.deps import DBSession, SuperAdminUser
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/db-stats", summary="Top 20 slow queries from pg_stat_statements")
async def db_stats(
    _admin: SuperAdminUser,
    db: DBSession,
    limit: int = 20,
) -> dict[str, Any]:
    """Return the slowest queries by mean execution time."""
    try:
        from sqlalchemy import text  # noqa: PLC0415

        result = await db.execute(text("""
            SELECT
                LEFT(query, 200) AS query,
                calls,
                ROUND(mean_exec_time::numeric, 2) AS mean_ms,
                ROUND(total_exec_time::numeric, 2) AS total_ms,
                ROUND(stddev_exec_time::numeric, 2) AS stddev_ms,
                rows
            FROM pg_stat_statements
            WHERE query NOT LIKE '%pg_stat_statements%'
            ORDER BY mean_exec_time DESC
            LIMIT :limit
        """), {"limit": limit})
        rows = result.fetchall()
        data = [
            {
                "query": row[0],
                "calls": int(row[1]),
                "mean_ms": float(row[2]),
                "total_ms": float(row[3]),
                "stddev_ms": float(row[4]),
                "rows": int(row[5]),
            }
            for row in rows
        ]
        return {"data": data}
    except Exception as exc:
        logger.warning("pg_stat_statements query failed: %s", exc)
        return {"data": [], "error": "pg_stat_statements not available"}


@router.get("/db-pool", summary="SQLAlchemy connection pool status")
async def db_pool_stats(_admin: SuperAdminUser) -> dict[str, Any]:
    """Return current connection pool utilization."""
    from app.core.database import engine  # noqa: PLC0415

    pool = engine.pool
    return {
        "pool_size": pool.size(),
        "checked_in": pool.checkedin(),
        "checked_out": pool.checkedout(),
        "overflow": pool.overflow(),
        "invalid": pool.invalid(),
    }


@router.get("/cache-stats", summary="Redis memory and keyspace stats")
async def cache_stats(_admin: SuperAdminUser) -> dict[str, Any]:
    """Return Redis INFO for memory usage and keyspace hits/misses."""
    try:
        import redis.asyncio as aioredis  # noqa: PLC0415

        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        try:
            info = await r.info()
            return {
                "used_memory_human": info.get("used_memory_human"),
                "used_memory_peak_human": info.get("used_memory_peak_human"),
                "connected_clients": info.get("connected_clients"),
                "keyspace_hits": info.get("keyspace_hits"),
                "keyspace_misses": info.get("keyspace_misses"),
                "total_commands_processed": info.get("total_commands_processed"),
                "redis_version": info.get("redis_version"),
            }
        finally:
            await r.aclose()
    except Exception as exc:
        return {"error": str(exc)}


@router.get("/endpoint-timing", summary="Per-endpoint response time percentiles")
async def endpoint_timing(_admin: SuperAdminUser) -> dict[str, Any]:
    """Return p50/p95/p99 response times per endpoint from Redis."""
    try:
        import redis.asyncio as aioredis  # noqa: PLC0415

        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        try:
            endpoint_keys = await r.smembers("perf:endpoints")
            results = []
            for key in sorted(endpoint_keys):
                # Key format: perf:timing:METHOD:/path/{id}
                parts = key.split(":", 3)
                if len(parts) < 4:
                    continue
                method = parts[2]
                path = parts[3]

                # Members format: "timestamp:duration_ms"
                members = await r.zrange(key, 0, -1)
                if not members:
                    continue

                durations = []
                for m in members:
                    try:
                        durations.append(float(m.split(":", 1)[1]))
                    except (IndexError, ValueError):
                        pass

                if not durations:
                    continue

                durations.sort()
                n = len(durations)
                results.append({
                    "method": method,
                    "path": path,
                    "count": n,
                    "p50_ms": round(statistics.median(durations), 1),
                    "p95_ms": round(durations[int(n * 0.95)], 1),
                    "p99_ms": round(durations[int(n * 0.99)], 1),
                    "max_ms": round(max(durations), 1),
                })

            results.sort(key=lambda x: x["p95_ms"], reverse=True)
            return {"data": results[:50]}  # Top 50 slowest endpoints
        finally:
            await r.aclose()
    except Exception as exc:
        return {"data": [], "error": str(exc)}


@router.post("/web-vitals", summary="Receive Core Web Vitals from frontend")
async def store_web_vitals(
    payload: dict[str, Any],
    db: DBSession,
) -> dict[str, str]:
    """Store Core Web Vitals batch from frontend.

    Payload: { "metrics": [{"name": "LCP", "value": 1234, "rating": "good", "url": "..."}, ...] }
    """
    metrics = payload.get("metrics", [])
    if not metrics:
        return {"status": "no_metrics"}

    try:
        from sqlalchemy import text  # noqa: PLC0415

        for m in metrics:
            await db.execute(text("""
                INSERT INTO perf_web_vitals (name, value, rating, url, created_at)
                VALUES (:name, :value, :rating, :url, NOW())
                ON CONFLICT DO NOTHING
            """), {
                "name": m.get("name"),
                "value": m.get("value"),
                "rating": m.get("rating"),
                "url": m.get("url", ""),
            })
        await db.commit()
        return {"status": "stored"}
    except Exception as exc:
        logger.warning("Failed to store web vitals: %s", exc)
        return {"status": "error"}


@router.get("/web-vitals/summary", summary="Core Web Vitals summary (last 24h)")
async def web_vitals_summary(
    _admin: SuperAdminUser,
    db: DBSession,
) -> dict[str, Any]:
    """Return average Core Web Vitals grouped by metric name."""
    try:
        from sqlalchemy import text  # noqa: PLC0415

        result = await db.execute(text("""
            SELECT
                name,
                COUNT(*) AS count,
                ROUND(AVG(value)::numeric, 1) AS avg_value,
                ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value)::numeric, 1) AS p75_value,
                MODE() WITHIN GROUP (ORDER BY rating) AS common_rating
            FROM perf_web_vitals
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY name
            ORDER BY name
        """))
        rows = result.fetchall()
        data = [
            {
                "name": row[0],
                "count": int(row[1]),
                "avg": float(row[2]),
                "p75": float(row[3]),
                "rating": row[4],
            }
            for row in rows
        ]
        return {"data": data}
    except Exception as exc:
        return {"data": [], "error": str(exc)}
