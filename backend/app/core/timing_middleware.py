"""Request timing middleware.

Records the duration of every API request and stores per-endpoint
p95/p99 percentiles in Redis sorted sets with a 1-hour rolling window.
Used by the Admin Performance Dashboard.
"""

from __future__ import annotations

import time
from collections.abc import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class TimingMiddleware(BaseHTTPMiddleware):
    """Measure request duration and persist stats to Redis."""

    def __init__(self, app, redis_url: str) -> None:
        super().__init__(app)
        self._redis_url = redis_url
        self._redis = None

    async def _get_redis(self):
        if self._redis is None:
            import redis.asyncio as aioredis  # noqa: PLC0415
            self._redis = aioredis.from_url(self._redis_url, decode_responses=True)
        return self._redis

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Only measure API requests
        if not request.url.path.startswith("/api/v1/"):
            return await call_next(request)

        # Skip WebSocket upgrades
        if request.headers.get("upgrade", "").lower() == "websocket":
            return await call_next(request)

        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        # Store asynchronously — fire and forget to avoid adding latency
        try:
            await self._store_timing(request, duration_ms)
        except Exception:
            pass  # Never let metrics storage break a request

        # Add timing header for frontend visibility
        response.headers["x-response-time"] = f"{duration_ms:.1f}ms"
        return response

    async def _store_timing(self, request: Request, duration_ms: float) -> None:
        """Store timing sample in Redis sorted set (score = timestamp)."""
        import time as _time  # noqa: PLC0415

        redis = await self._get_redis()
        # Normalise path — strip UUIDs/IDs for grouping
        path = self._normalise_path(request.url.path)
        key = f"perf:timing:{request.method}:{path}"
        now_ts = _time.time()

        pipeline = redis.pipeline(transaction=False)
        # Add sample: member = "timestamp:duration_ms", score = timestamp
        member = f"{now_ts:.3f}:{duration_ms:.1f}"
        pipeline.zadd(key, {member: now_ts})
        # Remove samples older than 1 hour
        pipeline.zremrangebyscore(key, "-inf", now_ts - 3600)
        # Expire key after 2 hours of inactivity
        pipeline.expire(key, 7200)
        # Track all endpoint keys for listing
        pipeline.sadd("perf:endpoints", key)
        await pipeline.execute()

    @staticmethod
    def _normalise_path(path: str) -> str:
        """Replace UUID segments and numeric IDs with {id} for grouping."""
        import re  # noqa: PLC0415
        # Replace UUIDs
        path = re.sub(
            r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            "{id}", path, flags=re.IGNORECASE
        )
        # Replace standalone integers
        path = re.sub(r"/\d+(/|$)", r"/{id}\1", path)
        return path
