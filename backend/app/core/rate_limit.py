"""Redis-backed rate limiting for Urban Vibes Dynamics API endpoints.

Uses the ``slowapi`` library (a Starlette/FastAPI wrapper around
``limits``) with Redis as the shared counter store, so rate limits
are enforced consistently across multiple backend workers.

Default policy:
    100 requests per minute per client IP (``get_remote_address``).

Usage:
    from app.core.rate_limit import limiter

    # Apply a custom limit to a specific route:
    @router.post("/auth/login")
    @limiter.limit("5/minute")
    async def login(request: Request, ...):
        ...

    # The default limit (100/min) applies automatically to all routes
    # once the limiter middleware is added to the FastAPI app (see main.py).

Configuration:
    - storage_uri: Redis URL from ``settings.REDIS_URL`` (shared with
      Celery broker and EventBus).
    - key_func: ``get_remote_address`` extracts the client IP from the
      request. Behind a reverse proxy, ensure X-Forwarded-For is set.
    - enabled: Always ``True``. To disable in tests, mock or patch.
"""
from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

# -- Module-level singleton -------------------------------------------------
# Instantiated once at import time; attached to the FastAPI app in main.py
# via ``app.state.limiter = limiter`` and the ``SlowAPIMiddleware``.

limiter = Limiter(
    key_func=get_remote_address,     # Identify clients by IP address
    default_limits=["100/minute"],   # Global fallback: 100 req/min per IP
    storage_uri=settings.REDIS_URL,  # Redis for distributed counter storage
    enabled=True,                    # Active in all environments
)
