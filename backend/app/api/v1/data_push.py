"""Server-Sent Events (SSE) endpoint for real-time data push.

Provides a persistent SSE connection that notifies the authenticated user
whenever data changes in the ERP. The frontend uses this to invalidate
TanStack Query caches instantly — achieving ≤5s data freshness across tabs.

Usage (frontend):
    const es = new EventSource('/api/v1/data-push/stream?token=<jwt>');
    es.onmessage = (e) => {
        const { entity, action } = JSON.parse(e.data);
        queryClient.invalidateQueries({ queryKey: ENTITY_QUERY_MAP[entity] });
    };

Redis channels:
    - user:{user_id}:changes  — changes relevant to a specific user
    - broadcast:changes       — changes relevant to all users
"""


import asyncio
import json
import logging

import redis.asyncio as aioredis
from fastapi import APIRouter, Query, HTTPException, status
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.security import decode_token

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/stream",
    summary="SSE stream for real-time data change notifications",
    response_class=StreamingResponse,
)
async def data_change_stream(token: str = Query(..., description="JWT access token")) -> StreamingResponse:
    """Open a Server-Sent Events stream that delivers data change events.

    The client should pass the JWT as a query parameter since EventSource
    does not support custom headers. Events are delivered as JSON objects:

        data: {"entity": "invoice", "action": "created", "id": "...", "ts": "..."}

    Reconnection is handled automatically by the browser's EventSource API.
    """
    # Validate token and extract user_id
    from jose import JWTError  # noqa: PLC0415

    try:
        payload = decode_token(token)
        user_id: str | None = payload.get("sub")
        token_type: str | None = payload.get("type")
        if not user_id or token_type != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    async def event_generator():
        redis_client = None
        pubsub = None
        try:
            redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            pubsub = redis_client.pubsub()
            await pubsub.subscribe(
                f"user:{user_id}:changes",
                "broadcast:changes",
            )
            logger.info("SSE stream opened for user %s", user_id)

            # Send initial heartbeat so the connection is confirmed
            yield "data: {\"type\": \"connected\"}\n\n"

            while True:
                try:
                    message = await asyncio.wait_for(
                        pubsub.get_message(ignore_subscribe_messages=True, timeout=None),
                        timeout=30.0,  # Send keepalive every 30s
                    )
                    if message and message.get("type") == "message":
                        yield f"data: {message['data']}\n\n"
                except asyncio.TimeoutError:
                    # Send keepalive comment to prevent proxy/browser timeout
                    yield ": keepalive\n\n"
                except asyncio.CancelledError:
                    break

        except Exception as exc:
            logger.warning("SSE stream error for user %s: %s", user_id, exc)
        finally:
            logger.info("SSE stream closed for user %s", user_id)
            if pubsub:
                try:
                    await pubsub.unsubscribe()
                    await pubsub.close()
                except Exception:
                    pass
            if redis_client:
                try:
                    await redis_client.aclose()
                except Exception:
                    pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx buffering for this response
            "Connection": "keep-alive",
        },
    )
