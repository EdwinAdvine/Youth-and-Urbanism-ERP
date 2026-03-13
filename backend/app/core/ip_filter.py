"""Redis-backed IP blocklist middleware."""
from __future__ import annotations
from fastapi import Request, Response
from fastapi.responses import JSONResponse
import redis.asyncio as aioredis
from app.core.config import settings

def _redis():
    return aioredis.from_url(settings.REDIS_URL, decode_responses=True)

async def is_ip_blocked(ip: str) -> bool:
    r = _redis()
    try:
        return bool(await r.exists(f"ip_block:{ip}"))
    finally:
        await r.aclose()

async def block_ip(ip: str, ttl_seconds: int = 3600) -> None:
    r = _redis()
    try:
        await r.setex(f"ip_block:{ip}", ttl_seconds, "1")
    finally:
        await r.aclose()

async def unblock_ip(ip: str) -> None:
    r = _redis()
    try:
        await r.delete(f"ip_block:{ip}")
    finally:
        await r.aclose()

async def list_blocked_ips() -> list[str]:
    r = _redis()
    try:
        keys = await r.keys("ip_block:*")
        return [k.replace("ip_block:", "") for k in keys]
    finally:
        await r.aclose()

async def ip_filter_middleware(request: Request, call_next) -> Response:
    """Starlette middleware: block requests from blocked IPs."""
    # Extract real IP (X-Forwarded-For if behind proxy)
    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0].strip() if forwarded else request.client.host if request.client else "unknown"
    if ip != "unknown" and await is_ip_blocked(ip):
        return JSONResponse(status_code=403, content={"detail": "Access denied"})
    return await call_next(request)
