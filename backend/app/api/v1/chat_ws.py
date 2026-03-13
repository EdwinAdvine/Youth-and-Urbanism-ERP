"""Y&U Teams — Chat WebSocket endpoint with connection manager.

One WebSocket connection per user (multiplexed across all channels).
Real-time delivery of messages, typing, presence, reactions, and read receipts
via Redis pub/sub for multi-instance fan-out.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import redis.asyncio as aioredis
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.security import decode_token
from app.models.chat import ChannelMember
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Connection Manager ───────────────────────────────────────────────────────

class ChatConnectionManager:
    """Manages active WebSocket connections, keyed by user_id.

    Each user can have multiple connections (e.g., multiple browser tabs).
    Messages are fan-out via Redis pub/sub so all connected instances receive them.
    """

    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}
        self._user_channels: dict[str, set[str]] = {}  # user_id -> set of channel_ids

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.setdefault(user_id, set()).add(ws)
        logger.info("Chat WS connected: user=%s (total=%d)", user_id, len(self._connections[user_id]))

    def disconnect(self, user_id: str, ws: WebSocket) -> None:
        if user_id in self._connections:
            self._connections[user_id].discard(ws)
            if not self._connections[user_id]:
                del self._connections[user_id]
                self._user_channels.pop(user_id, None)
        logger.info("Chat WS disconnected: user=%s", user_id)

    def set_user_channels(self, user_id: str, channel_ids: set[str]) -> None:
        self._user_channels[user_id] = channel_ids

    def get_users_in_channel(self, channel_id: str) -> set[str]:
        """Return user_ids connected and subscribed to a channel."""
        return {
            uid for uid, channels in self._user_channels.items()
            if channel_id in channels
        }

    async def send_to_user(self, user_id: str, data: dict[str, Any]) -> None:
        """Send a message to all connections of a user."""
        connections = self._connections.get(user_id, set())
        dead = set()
        for ws in connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.add(ws)
        for ws in dead:
            connections.discard(ws)

    async def broadcast_to_channel(self, channel_id: str, data: dict[str, Any], exclude_user: str | None = None) -> None:
        """Send a message to all connected users in a channel."""
        users = self.get_users_in_channel(channel_id)
        for uid in users:
            if uid != exclude_user:
                await self.send_to_user(uid, data)

    @property
    def connected_user_ids(self) -> set[str]:
        return set(self._connections.keys())


# Module-level singleton
manager = ChatConnectionManager()


# ── Redis Pub/Sub Listener ───────────────────────────────────────────────────

async def _redis_listener(user_id: str, channel_ids: set[str]) -> None:
    """Background task: subscribe to Redis channels for a user and forward to WS."""
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    pubsub = r.pubsub()

    redis_channels = [f"chat:{cid}" for cid in channel_ids]
    redis_channels.append(f"chat:user:{user_id}")  # personal channel for DM notifications
    redis_channels.append("chat:presence")  # global presence updates

    if redis_channels:
        await pubsub.subscribe(*redis_channels)

    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            try:
                data = json.loads(message["data"])
                await manager.send_to_user(user_id, data)
            except (json.JSONDecodeError, TypeError):
                continue
    except asyncio.CancelledError:
        pass
    finally:
        await pubsub.unsubscribe()
        await pubsub.close()
        await r.close()


# ── Publish helper ───────────────────────────────────────────────────────────

async def publish_to_channel(channel_id: str, data: dict[str, Any]) -> None:
    """Publish a chat event to a Redis channel for fan-out."""
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        await r.publish(f"chat:{channel_id}", json.dumps(data, default=str))
    finally:
        await r.close()


async def publish_to_user(user_id: str, data: dict[str, Any]) -> None:
    """Publish a chat event directly to a user's personal channel."""
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        await r.publish(f"chat:user:{user_id}", json.dumps(data, default=str))
    finally:
        await r.close()


async def publish_presence(data: dict[str, Any]) -> None:
    """Publish a presence change globally."""
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        await r.publish("chat:presence", json.dumps(data, default=str))
    finally:
        await r.close()


# ── WebSocket Endpoint ───────────────────────────────────────────────────────

@router.websocket("/ws")
async def chat_websocket(
    websocket: WebSocket,
    token: str = Query(""),
) -> None:
    """
    Authenticated WebSocket for Y&U Teams real-time chat.

    One connection per user, multiplexed across all channels.

    Client sends:
      {"type": "ping"}
      {"type": "typing", "channel_id": "..."}
      {"type": "read", "channel_id": "..."}
      {"type": "subscribe", "channel_ids": ["..."]}

    Server sends:
      {"type": "message.new", "channel_id": "...", "message": {...}}
      {"type": "message.edited", "channel_id": "...", ...}
      {"type": "message.deleted", "channel_id": "...", ...}
      {"type": "typing", "channel_id": "...", "user_id": "...", "user_name": "..."}
      {"type": "presence.changed", "user_id": "...", "status": "..."}
      {"type": "reaction.added", "channel_id": "...", ...}
      {"type": "reaction.removed", "channel_id": "...", ...}
      {"type": "read_receipt", "channel_id": "...", ...}
      {"type": "pong"}
    """

    # ── Authenticate ─────────────────────────────────────────────────────────
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise ValueError("Not an access token")
        user_id_str: str = payload["sub"]
    except (JWTError, ValueError, KeyError):
        await websocket.close(code=4001, reason="Unauthorized")
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id_str))
        user = result.scalar_one_or_none()
        if user is None or not user.is_active:
            await websocket.close(code=4001, reason="User not found or inactive")
            return

        # Get user's channel memberships
        cm_result = await db.execute(
            select(ChannelMember.channel_id).where(ChannelMember.user_id == user_id_str)
        )
        channel_ids = {str(row) for row in cm_result.scalars().all()}

    # ── Connect ──────────────────────────────────────────────────────────────
    await manager.connect(user_id_str, websocket)
    manager.set_user_channels(user_id_str, channel_ids)

    # Start Redis listener for this user
    listener_task = asyncio.create_task(
        _redis_listener(user_id_str, channel_ids),
        name=f"chat-redis-{user_id_str}",
    )

    # Set presence to online
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        presence_data = json.dumps({
            "user_id": user_id_str,
            "status": "online",
            "last_active": datetime.now(timezone.utc).isoformat(),
        })
        await r.set(f"presence:{user_id_str}", presence_data, ex=120)
    finally:
        await r.close()

    await publish_presence({
        "type": "presence.changed",
        "user_id": user_id_str,
        "status": "online",
    })

    # ── Message Loop ─────────────────────────────────────────────────────────
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data: dict[str, Any] = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = data.get("type", "")

            if msg_type == "ping":
                # Heartbeat — refresh presence TTL
                r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
                try:
                    presence_data = json.dumps({
                        "user_id": user_id_str,
                        "status": "online",
                        "last_active": datetime.now(timezone.utc).isoformat(),
                    })
                    await r.set(f"presence:{user_id_str}", presence_data, ex=120)
                finally:
                    await r.close()
                await websocket.send_json({"type": "pong"})

            elif msg_type == "typing":
                channel_id = data.get("channel_id", "")
                if channel_id in channel_ids:
                    await publish_to_channel(channel_id, {
                        "type": "typing",
                        "channel_id": channel_id,
                        "user_id": user_id_str,
                        "user_name": user.full_name,
                    })

            elif msg_type == "read":
                channel_id = data.get("channel_id", "")
                if channel_id in channel_ids:
                    await publish_to_channel(channel_id, {
                        "type": "read_receipt",
                        "channel_id": channel_id,
                        "user_id": user_id_str,
                        "last_read_at": datetime.now(timezone.utc).isoformat(),
                    })

            elif msg_type == "subscribe":
                # Dynamic subscription to new channels (e.g., after joining)
                new_ids = set(data.get("channel_ids", []))
                channel_ids.update(new_ids)
                manager.set_user_channels(user_id_str, channel_ids)
                # Restart redis listener with updated channels
                listener_task.cancel()
                try:
                    await listener_task
                except asyncio.CancelledError:
                    pass
                listener_task = asyncio.create_task(
                    _redis_listener(user_id_str, channel_ids),
                    name=f"chat-redis-{user_id_str}",
                )
                await websocket.send_json({"type": "subscribed", "channel_ids": list(new_ids)})

            else:
                await websocket.send_json({"type": "error", "message": f"Unknown type: {msg_type}"})

    except WebSocketDisconnect:
        pass
    finally:
        listener_task.cancel()
        try:
            await listener_task
        except asyncio.CancelledError:
            pass

        manager.disconnect(user_id_str, websocket)

        # Set presence to offline
        await publish_presence({
            "type": "presence.changed",
            "user_id": user_id_str,
            "status": "offline",
        })
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        try:
            await r.delete(f"presence:{user_id_str}")
        finally:
            await r.close()

        try:
            await websocket.close()
        except Exception:
            pass
