"""Anomaly detection — new IP login alerts, brute force detection."""
from __future__ import annotations
import redis.asyncio as aioredis
from app.core.config import settings

def _redis():
    return aioredis.from_url(settings.REDIS_URL, decode_responses=True)

async def record_login_ip(user_id: str, ip: str) -> bool:
    """Record a successful login IP. Returns True if this is a new IP for the user."""
    r = _redis()
    try:
        key = f"user_ips:{user_id}"
        is_new = not bool(await r.sismember(key, ip))
        await r.sadd(key, ip)
        await r.expire(key, 90 * 86400)  # remember IPs for 90 days
        return is_new
    finally:
        await r.aclose()

async def record_failed_login(ip: str) -> int:
    """Increment failed login counter for an IP. Returns current count."""
    r = _redis()
    try:
        key = f"failed_logins_ip:{ip}"
        count = await r.incr(key)
        if count == 1:
            await r.expire(key, 300)  # 5-minute window
        return int(count)
    finally:
        await r.aclose()

async def get_failed_login_count(ip: str) -> int:
    r = _redis()
    try:
        val = await r.get(f"failed_logins_ip:{ip}")
        return int(val) if val else 0
    finally:
        await r.aclose()

async def clear_failed_logins(ip: str) -> None:
    r = _redis()
    try:
        await r.delete(f"failed_logins_ip:{ip}")
    finally:
        await r.aclose()
