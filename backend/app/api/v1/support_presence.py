"""Support Agent Presence API — Redis-backed online status, typing indicators, collision detection."""

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.deps import CurrentUser, DBSession

router = APIRouter()

PRESENCE_TTL = 60  # seconds — must heartbeat within this window
PRESENCE_KEY_PREFIX = "support:presence:"
TYPING_KEY_PREFIX = "support:typing:"
VIEWING_KEY_PREFIX = "support:viewing:"


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_redis():
    """Get a Redis connection from the app's Redis pool."""
    import redis.asyncio as aioredis
    from app.core.config import settings

    return aioredis.from_url(
        f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/3",
        decode_responses=True,
    )


# ── Schemas ───────────────────────────────────────────────────────────────────

class HeartbeatPayload(BaseModel):
    status: str = "online"  # online, away, busy
    viewing_ticket_id: uuid.UUID | None = None


class PresenceOut(BaseModel):
    user_id: uuid.UUID
    user_name: str | None = None
    status: str
    viewing_ticket_id: uuid.UUID | None = None
    last_seen: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/presence/heartbeat", summary="Agent presence heartbeat")
async def heartbeat(
    payload: HeartbeatPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    r = await _get_redis()
    try:
        now = datetime.now(timezone.utc).isoformat()
        data = {
            "status": payload.status,
            "viewing_ticket_id": str(payload.viewing_ticket_id) if payload.viewing_ticket_id else None,
            "last_seen": now,
            "user_name": current_user.full_name if hasattr(current_user, "full_name") else None,
        }
        key = f"{PRESENCE_KEY_PREFIX}{current_user.id}"
        await r.set(key, json.dumps(data), ex=PRESENCE_TTL)

        # Also track which ticket is being viewed
        if payload.viewing_ticket_id:
            viewing_key = f"{VIEWING_KEY_PREFIX}{payload.viewing_ticket_id}"
            await r.hset(viewing_key, str(current_user.id), json.dumps({
                "user_name": data["user_name"],
                "since": now,
            }))
            await r.expire(viewing_key, PRESENCE_TTL)

        return {"status": "ok", "presence": data}
    finally:
        await r.aclose()


@router.get("/presence/agents", summary="List online support agents")
async def list_online_agents(
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    r = await _get_redis()
    try:
        agents = []
        async for key in r.scan_iter(f"{PRESENCE_KEY_PREFIX}*"):
            user_id = key.replace(PRESENCE_KEY_PREFIX, "")
            raw = await r.get(key)
            if raw:
                data = json.loads(raw)
                agents.append({
                    "user_id": user_id,
                    "user_name": data.get("user_name"),
                    "status": data.get("status", "online"),
                    "viewing_ticket_id": data.get("viewing_ticket_id"),
                    "last_seen": data.get("last_seen"),
                })
        return agents
    finally:
        await r.aclose()


@router.get("/presence/ticket/{ticket_id}", summary="Who is viewing this ticket")
async def ticket_viewers(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    r = await _get_redis()
    try:
        viewing_key = f"{VIEWING_KEY_PREFIX}{ticket_id}"
        viewers_raw = await r.hgetall(viewing_key)

        viewers = []
        for user_id, raw in viewers_raw.items():
            data = json.loads(raw)
            viewers.append({
                "user_id": user_id,
                "user_name": data.get("user_name"),
                "since": data.get("since"),
            })
        return viewers
    finally:
        await r.aclose()


@router.post("/presence/typing/{ticket_id}", summary="Signal agent is typing on ticket")
async def set_typing(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, str]:
    r = await _get_redis()
    try:
        typing_key = f"{TYPING_KEY_PREFIX}{ticket_id}"
        await r.hset(typing_key, str(current_user.id), json.dumps({
            "user_name": current_user.full_name if hasattr(current_user, "full_name") else None,
            "since": datetime.now(timezone.utc).isoformat(),
        }))
        await r.expire(typing_key, 10)  # typing indicator expires after 10s
        return {"status": "ok"}
    finally:
        await r.aclose()


@router.get("/presence/typing/{ticket_id}", summary="Who is typing on this ticket")
async def get_typing(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    r = await _get_redis()
    try:
        typing_key = f"{TYPING_KEY_PREFIX}{ticket_id}"
        typers_raw = await r.hgetall(typing_key)

        typers = []
        for user_id, raw in typers_raw.items():
            if user_id != str(current_user.id):  # Don't show self
                data = json.loads(raw)
                typers.append({
                    "user_id": user_id,
                    "user_name": data.get("user_name"),
                })
        return typers
    finally:
        await r.aclose()
