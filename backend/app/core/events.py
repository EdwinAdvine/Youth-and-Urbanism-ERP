"""Cross-module event bus using Redis pub/sub.

Provides a lightweight async event bus backed by Redis pub/sub for
decoupled communication between Urban Vibes Dynamics modules.

Usage:
    from app.core.events import event_bus

    # Publishing (from API routes):
    await event_bus.publish("meeting.created", {"meeting_id": "...", "organizer_id": "..."})

    # Subscribing (registered at startup):
    @event_bus.on("meeting.created")
    async def handle_meeting_created(data: dict):
        # auto-create CalendarEvent, etc.
        ...

    # Lifecycle (in FastAPI lifespan):
    await event_bus.start()   # starts listener task
    await event_bus.stop()    # cleanup

Registered event channels:
    - meeting.created          — when a meeting is created
    - meeting.deleted          — when a meeting is deleted
    - calendar.event.created   — when a calendar event is created
    - calendar.event.updated   — when a calendar event is updated
    - calendar.event.reminder  — when a calendar event reminder fires (→ Notifications)
    - file.uploaded            — when a file is uploaded to Drive
    - file.deleted             — when a file is deleted from Drive
    - email.sent               — when an email is sent
    - note.created             — when a note is created
    - form.response.submitted  — when a form response is submitted
    - task.status.changed      — when a project task status changes
    - pos.sale.completed       — when a POS transaction completes (→ Finance journal entry)
    - ecommerce.order.created  — when an e-commerce order is placed (→ Finance invoice, Mail confirmation)
    - ecommerce.order.shipped  — when an e-commerce order ships (→ Mail shipping notification)
    - inventory.valuation.changed — when stock valuation changes (→ Finance balance sheet)
    - supplychain.goods_received  — when GRN is accepted (→ Inventory stock movements)
    - wo.completed             — when a manufacturing work order completes (→ Notifications)
    - support.ticket.created   — when a support ticket is created (→ Mail notification)
    - opportunity.stage_changed — when a CRM deal stage changes (→ Mail + Notifications)
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Callable, Coroutine
from uuid import uuid4

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

HandlerFn = Callable[[dict[str, Any]], Coroutine[Any, Any, None]]


class EventBus:
    """Async event bus using Redis pub/sub."""

    def __init__(self, redis_url: str) -> None:
        self._redis_url = redis_url
        self._handlers: dict[str, list[HandlerFn]] = {}
        self._redis: aioredis.Redis | None = None
        self._pubsub: aioredis.client.PubSub | None = None
        self._listener_task: asyncio.Task | None = None

    # -- decorator --------------------------------------------------------

    def on(self, channel: str) -> Callable[[HandlerFn], HandlerFn]:
        """Register an async handler for *channel*.

        Can be used as a decorator::

            @event_bus.on("meeting.created")
            async def handle(data: dict):
                ...
        """

        def decorator(fn: HandlerFn) -> HandlerFn:
            self._handlers.setdefault(channel, []).append(fn)
            logger.debug("Handler %s registered for channel '%s'", fn.__qualname__, channel)
            return fn

        return decorator

    # -- publish ----------------------------------------------------------

    async def publish(self, channel: str, data: dict[str, Any]) -> None:
        """Publish an event to *channel* with the given *data*."""
        if self._redis is None:
            logger.warning("EventBus not started — dropping event on '%s'", channel)
            return

        payload = {
            "event": channel,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "id": str(uuid4()),
        }
        message = json.dumps(payload)
        await self._redis.publish(channel, message)
        logger.debug("Published event %s on '%s'", payload["id"], channel)

    async def publish_data_change(
        self,
        entity_type: str,
        entity_id: str | None = None,
        action: str = "updated",
        user_ids: list[str] | None = None,
    ) -> None:
        """Publish a data change event for frontend cache invalidation via SSE.

        This is the bridge between backend mutations and the frontend's
        TanStack Query cache. The frontend SSE client maps entity_type to
        query keys and calls invalidateQueries().

        Args:
            entity_type: The entity that changed (e.g. "invoice", "contact", "task").
            entity_id: Optional ID of the changed entity.
            action: The action taken ("created", "updated", "deleted").
            user_ids: If set, notify only these users. If None, broadcast to all.
        """
        if self._redis is None:
            return

        payload = json.dumps({
            "entity": entity_type,
            "id": entity_id,
            "action": action,
            "ts": datetime.now(timezone.utc).isoformat(),
        })

        try:
            if user_ids:
                for uid in user_ids:
                    await self._redis.publish(f"user:{uid}:changes", payload)
            else:
                await self._redis.publish("broadcast:changes", payload)
        except Exception:
            logger.warning("Failed to publish data change for %s:%s", entity_type, entity_id)

    # -- lifecycle --------------------------------------------------------

    async def start(self) -> None:
        """Connect to Redis and start the background listener task."""
        self._redis = aioredis.from_url(self._redis_url, decode_responses=True)
        self._pubsub = self._redis.pubsub()

        channels = list(self._handlers.keys())
        if channels:
            await self._pubsub.subscribe(*channels)
            logger.info("EventBus subscribed to channels: %s", ", ".join(channels))
        else:
            logger.info("EventBus started with no registered handlers")

        self._listener_task = asyncio.create_task(self._listen(), name="event-bus-listener")
        logger.info("EventBus started")

    async def stop(self) -> None:
        """Cancel the listener task and close the Redis connection."""
        if self._listener_task is not None:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
            self._listener_task = None

        if self._pubsub is not None:
            await self._pubsub.unsubscribe()
            await self._pubsub.close()
            self._pubsub = None

        if self._redis is not None:
            await self._redis.close()
            self._redis = None

        logger.info("EventBus stopped")

    # -- internal ---------------------------------------------------------

    async def _listen(self) -> None:
        """Background task: read messages from pub/sub and dispatch to handlers."""
        assert self._pubsub is not None  # noqa: S101
        try:
            async for message in self._pubsub.listen():
                if message["type"] != "message":
                    continue

                channel: str = message["channel"]
                try:
                    payload: dict[str, Any] = json.loads(message["data"])
                except (json.JSONDecodeError, TypeError):
                    logger.exception("Failed to decode message on '%s'", channel)
                    continue

                handlers = self._handlers.get(channel, [])
                for handler in handlers:
                    try:
                        await handler(payload.get("data", {}))
                    except Exception:
                        logger.exception(
                            "Handler %s raised an exception for event %s on '%s'",
                            handler.__qualname__,
                            payload.get("id"),
                            channel,
                        )
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("EventBus listener crashed unexpectedly")


# Module-level singleton
event_bus = EventBus(settings.REDIS_URL)
