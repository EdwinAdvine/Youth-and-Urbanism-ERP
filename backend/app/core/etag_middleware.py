"""ETag middleware for conditional HTTP responses.

Computes an ETag from response body content and returns 304 Not Modified
when the client sends a matching If-None-Match header. This eliminates
redundant data transfer — critical for 4G/slow network performance.

Only applies to GET requests on /api/v1/ paths. Skips WebSocket upgrades,
streaming responses, and large bodies (>1MB).
"""

from __future__ import annotations

import hashlib
from collections.abc import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


# Max body size to compute ETag for (1MB) — skip large file downloads
_MAX_ETAG_BODY_SIZE = 1_048_576


class ETagMiddleware(BaseHTTPMiddleware):
    """Add ETag headers and return 304 for unchanged API responses."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Only process GET requests on API paths
        if request.method != "GET" or not request.url.path.startswith("/api/v1/"):
            return await call_next(request)

        # Skip WebSocket upgrades
        if request.headers.get("upgrade", "").lower() == "websocket":
            return await call_next(request)

        response = await call_next(request)

        # Only process successful JSON responses
        if response.status_code != 200:
            return response

        content_type = response.headers.get("content-type", "")
        if "application/json" not in content_type:
            return response

        # Read response body
        body = b""
        async for chunk in response.body_iterator:
            if isinstance(chunk, str):
                chunk = chunk.encode("utf-8")
            body += chunk

        # Skip ETag for large responses
        if len(body) > _MAX_ETAG_BODY_SIZE:
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )

        # Compute ETag
        etag = f'W/"{hashlib.md5(body).hexdigest()}"'  # noqa: S324

        # Check If-None-Match
        if_none_match = request.headers.get("if-none-match", "")
        if if_none_match == etag:
            return Response(
                status_code=304,
                headers={
                    "etag": etag,
                    "cache-control": "private, max-age=10",
                },
            )

        # Return response with ETag and Cache-Control headers
        headers = dict(response.headers)
        headers["etag"] = etag
        headers["cache-control"] = "private, max-age=10"

        return Response(
            content=body,
            status_code=response.status_code,
            headers=headers,
            media_type=response.media_type,
        )
