from __future__ import annotations

import base64
from datetime import UTC, datetime, timedelta
from typing import Any

import redis.asyncio as aioredis
from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

# ── Password hashing ──────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT ───────────────────────────────────────────────────────────────────────
def create_access_token(
    subject: str,
    email: str,
    is_superadmin: bool,
    extra: dict[str, Any] | None = None,
) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": subject,
        "email": email,
        "is_superadmin": is_superadmin,
        "exp": expire,
        "type": "access",
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: str) -> str:
    expire = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload: dict[str, Any] = {
        "sub": subject,
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """Decode and verify a JWT token. Raises JWTError on failure."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


# ── Refresh-token store (Redis) ───────────────────────────────────────────────
def _redis_client() -> aioredis.Redis:
    return aioredis.from_url(settings.REDIS_URL, decode_responses=True)


async def store_refresh_token(user_id: str, token: str) -> None:
    r = _redis_client()
    try:
        key = f"refresh:{user_id}"
        ttl = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
        await r.setex(key, ttl, token)
    finally:
        await r.aclose()


async def get_stored_refresh_token(user_id: str) -> str | None:
    r = _redis_client()
    try:
        return await r.get(f"refresh:{user_id}")
    finally:
        await r.aclose()


async def revoke_refresh_token(user_id: str) -> None:
    r = _redis_client()
    try:
        await r.delete(f"refresh:{user_id}")
    finally:
        await r.aclose()


# ── Field-level encryption (for AI API keys) ──────────────────────────────────
def _derive_fernet_key() -> bytes:
    """Derive a 32-byte URL-safe base64 key from SECRET_KEY."""
    raw = settings.SECRET_KEY.encode()
    # Pad/truncate to 32 bytes then base64-encode for Fernet
    padded = (raw * (32 // len(raw) + 1))[:32]
    return base64.urlsafe_b64encode(padded)


try:
    from cryptography.fernet import Fernet

    _fernet = Fernet(_derive_fernet_key())

    def encrypt_field(value: str) -> str:
        return _fernet.encrypt(value.encode()).decode()

    def decrypt_field(encrypted: str) -> str:
        return _fernet.decrypt(encrypted.encode()).decode()

except ImportError:
    # cryptography not installed — pass-through (dev only)
    def encrypt_field(value: str) -> str:  # type: ignore[misc]
        return value

    def decrypt_field(encrypted: str) -> str:  # type: ignore[misc]
        return encrypted
