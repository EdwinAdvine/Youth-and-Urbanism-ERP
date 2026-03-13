"""Collaborative document synchronization service.

Manages real-time collaborative state in Redis for the metadata layer:
  - Cursor positions per user
  - Active presence (who is in the document)
  - Sidebar/panel state (comment threads in-progress, selection highlights)
  - Comment-in-progress drafts (before publish)

ONLYOFFICE OT handles the document content sync.
This layer handles all metadata outside the ONLYOFFICE iframe.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

# Redis key patterns
_PRESENCE_KEY = "doc:presence:{file_id}"          # Hash: user_id → user metadata
_CURSORS_KEY = "doc:cursors:{file_id}"            # Hash: user_id → cursor JSON
_DRAFTS_KEY = "doc:drafts:{file_id}:{user_id}"    # String: in-progress comment draft
_SIDEBAR_KEY = "doc:sidebar:{file_id}"            # Hash: user_id → sidebar state JSON

_PRESENCE_TTL = 60        # seconds — refresh on heartbeat
_DRAFT_TTL = 3600         # 1 hour — hold draft even if disconnected briefly


class CollabSyncService:
    """Manages lightweight collaborative state in Redis.

    Usage::

        async with CollabSyncService.connect(redis_url) as svc:
            await svc.join(file_id, user_id, user_name)
            await svc.update_cursor(file_id, user_id, {"line": 5, "col": 12})
            users = await svc.get_presence(file_id)
    """

    def __init__(self, redis_client: Any) -> None:
        self._r = redis_client

    @classmethod
    async def from_url(cls, redis_url: str) -> "CollabSyncService":
        """Create a CollabSyncService connected to the given Redis URL."""
        import redis.asyncio as aioredis
        client = aioredis.from_url(redis_url, decode_responses=True)
        return cls(client)

    async def close(self) -> None:
        try:
            await self._r.aclose()
        except Exception:
            pass

    # ── Presence ──────────────────────────────────────────────────────────────

    async def join(
        self,
        file_id: uuid.UUID,
        user_id: uuid.UUID,
        user_name: str,
        color: str | None = None,
    ) -> dict[str, Any]:
        """Register a user as present in a document. Returns updated presence list."""
        pk = _PRESENCE_KEY.format(file_id=str(file_id))
        user_meta = json.dumps({
            "user_id": str(user_id),
            "user_name": user_name,
            "color": color or _color_for(str(user_id)),
            "joined_at": datetime.now(timezone.utc).isoformat(),
        })
        await self._r.hset(pk, str(user_id), user_meta)
        await self._r.expire(pk, _PRESENCE_TTL)
        return await self.get_presence(file_id)

    async def leave(self, file_id: uuid.UUID, user_id: uuid.UUID) -> dict[str, Any]:
        """Remove a user from presence. Returns updated presence list."""
        pk = _PRESENCE_KEY.format(file_id=str(file_id))
        ck = _CURSORS_KEY.format(file_id=str(file_id))
        sk = _SIDEBAR_KEY.format(file_id=str(file_id))
        await self._r.hdel(pk, str(user_id))
        await self._r.hdel(ck, str(user_id))
        await self._r.hdel(sk, str(user_id))
        return await self.get_presence(file_id)

    async def heartbeat(self, file_id: uuid.UUID, user_id: uuid.UUID) -> None:
        """Refresh TTL to indicate user is still active."""
        pk = _PRESENCE_KEY.format(file_id=str(file_id))
        if await self._r.hexists(pk, str(user_id)):
            await self._r.expire(pk, _PRESENCE_TTL)

    async def get_presence(self, file_id: uuid.UUID) -> dict[str, Any]:
        """Return current presence list for a document."""
        pk = _PRESENCE_KEY.format(file_id=str(file_id))
        raw = await self._r.hgetall(pk)
        users = []
        for _uid, meta_str in raw.items():
            try:
                users.append(json.loads(meta_str))
            except (json.JSONDecodeError, TypeError):
                pass
        return {"file_id": str(file_id), "users": users, "count": len(users)}

    # ── Cursors ───────────────────────────────────────────────────────────────

    async def update_cursor(
        self,
        file_id: uuid.UUID,
        user_id: uuid.UUID,
        cursor: dict[str, Any],
    ) -> None:
        """Store cursor/selection position for a user."""
        ck = _CURSORS_KEY.format(file_id=str(file_id))
        await self._r.hset(ck, str(user_id), json.dumps({
            **cursor,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }))
        await self._r.expire(ck, _PRESENCE_TTL)

    async def get_cursors(self, file_id: uuid.UUID) -> dict[str, Any]:
        """Return all active cursor positions for a document."""
        ck = _CURSORS_KEY.format(file_id=str(file_id))
        raw = await self._r.hgetall(ck)
        cursors = {}
        for uid, cur_str in raw.items():
            try:
                cursors[uid] = json.loads(cur_str)
            except (json.JSONDecodeError, TypeError):
                pass
        return {"file_id": str(file_id), "cursors": cursors}

    # ── Comment drafts ────────────────────────────────────────────────────────

    async def save_draft(
        self,
        file_id: uuid.UUID,
        user_id: uuid.UUID,
        draft: str,
        anchor: dict[str, Any] | None = None,
    ) -> None:
        """Save an in-progress comment draft so it survives brief disconnects."""
        dk = _DRAFTS_KEY.format(file_id=str(file_id), user_id=str(user_id))
        payload = json.dumps({"draft": draft, "anchor": anchor or {}})
        await self._r.set(dk, payload, ex=_DRAFT_TTL)

    async def get_draft(
        self,
        file_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> dict[str, Any] | None:
        """Retrieve a user's comment draft for a document."""
        dk = _DRAFTS_KEY.format(file_id=str(file_id), user_id=str(user_id))
        raw = await self._r.get(dk)
        if not raw:
            return None
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return None

    async def clear_draft(self, file_id: uuid.UUID, user_id: uuid.UUID) -> None:
        """Delete a comment draft (call after publishing the comment)."""
        dk = _DRAFTS_KEY.format(file_id=str(file_id), user_id=str(user_id))
        await self._r.delete(dk)

    # ── Sidebar / panel state ─────────────────────────────────────────────────

    async def update_sidebar_state(
        self,
        file_id: uuid.UUID,
        user_id: uuid.UUID,
        state: dict[str, Any],
    ) -> None:
        """Store per-user sidebar panel state (open panel, scroll position, etc.)."""
        sk = _SIDEBAR_KEY.format(file_id=str(file_id))
        await self._r.hset(sk, str(user_id), json.dumps(state))
        await self._r.expire(sk, _PRESENCE_TTL)

    async def get_sidebar_state(
        self,
        file_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Retrieve a user's sidebar state."""
        sk = _SIDEBAR_KEY.format(file_id=str(file_id))
        raw = await self._r.hget(sk, str(user_id))
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return {}

    # ── Broadcast helpers ─────────────────────────────────────────────────────

    async def broadcast(
        self,
        file_id: uuid.UUID,
        message_type: str,
        payload: dict[str, Any],
    ) -> None:
        """Publish a message to the document's Redis pub/sub channel.

        WebSocket handlers subscribed to ``doc:{file_id}:channel`` will receive it.
        """
        channel = f"doc:{file_id}:channel"
        msg = json.dumps({"type": message_type, "file_id": str(file_id), **payload})
        try:
            await self._r.publish(channel, msg)
        except Exception as exc:
            logger.warning("CollabSync broadcast failed: %s", exc)


def _color_for(user_id: str) -> str:
    """Deterministic color from user_id string."""
    colors = [
        "#6366f1", "#ec4899", "#f59e0b", "#10b981",
        "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6",
    ]
    h = 0
    for c in user_id:
        h = (h * 31 + ord(c)) & 0xFFFFFFFF
    return colors[h % len(colors)]
