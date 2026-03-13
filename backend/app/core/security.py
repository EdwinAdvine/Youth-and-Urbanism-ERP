"""Authentication and cryptography primitives for Urban Vibes Dynamics.

Provides JWT token creation/verification, password hashing, refresh-token
management (via Redis), and field-level encryption for sensitive data such
as third-party AI API keys stored in SystemSettings.

Authentication flow:
    1. User submits credentials to ``/api/v1/auth/login``.
    2. ``verify_password`` checks the bcrypt hash stored in PostgreSQL.
    3. On success, ``create_access_token`` returns a short-lived JWT
       (expiry from ``settings.ACCESS_TOKEN_EXPIRE_MINUTES``) and
       ``create_refresh_token`` returns a long-lived JWT stored in Redis.
    4. Subsequent requests include the access token in the
       ``Authorization: Bearer <token>`` header.
    5. ``decode_token`` (called by ``core/deps.py → CurrentUser``)
       validates the signature and expiry on every request.
    6. When the access token expires, the client sends the refresh token;
       the backend verifies it against Redis and issues a new pair.
    7. On logout, ``revoke_refresh_token`` deletes the Redis key so the
       refresh token cannot be reused.

Token types (``payload["type"]``):
    - ``"access"``  — short-lived, carries user identity + role claims.
    - ``"refresh"`` — long-lived, stored server-side in Redis, used only
      to obtain a new access token.

Field-level encryption:
    - Uses Fernet symmetric encryption derived from ``SECRET_KEY``.
    - Applied to AI provider API keys before persisting to the database.
    - Falls back to pass-through (no encryption) if the ``cryptography``
      package is not installed (development convenience only).

Usage:
    from app.core.security import (
        hash_password, verify_password,
        create_access_token, create_refresh_token, decode_token,
        store_refresh_token, revoke_refresh_token,
        encrypt_field, decrypt_field,
    )

    hashed = hash_password("s3cret")
    assert verify_password("s3cret", hashed)

    token = create_access_token(
        subject=str(user.id), email=user.email, is_superadmin=user.is_superadmin
    )
    claims = decode_token(token)
    # claims == {"sub": "...", "email": "...", "is_superadmin": False, ...}
"""

from __future__ import annotations

import base64
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import redis.asyncio as aioredis
from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

# ── Password hashing ──────────────────────────────────────────────────────────
# "deprecated='auto'" tells passlib to automatically re-hash passwords that
# use older/weaker schemes whenever verify() is called, migrating them to
# bcrypt transparently.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Hash a plaintext password using bcrypt.

    Returns the full bcrypt hash string (algorithm id + salt + digest)
    ready for storage in the ``users.password_hash`` column.
    """
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify *plain* against a bcrypt *hashed* value.

    Returns ``True`` if the password matches. Internally uses constant-time
    comparison to prevent timing attacks.
    """
    return pwd_context.verify(plain, hashed)


# ── JWT ───────────────────────────────────────────────────────────────────────
def create_access_token(
    subject: str,
    email: str,
    is_superadmin: bool,
    extra: dict[str, Any] | None = None,
) -> str:
    """Create a short-lived JWT access token.

    Args:
        subject: The user's UUID (stored as the ``sub`` claim).
        email: User's email, embedded so downstream code can read it
            without a DB round-trip.
        is_superadmin: Embedded so the RBAC dependency (``SuperAdminUser``)
            can check it directly from the token.
        extra: Optional additional claims (e.g., ``tenant_id`` for
            future multi-tenancy).

    Returns:
        An encoded JWT string signed with ``settings.SECRET_KEY`` using
        the algorithm specified in ``settings.ALGORITHM`` (default HS256).
    """
    expire = datetime.now(UTC) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": subject,          # user UUID — primary identifier
        "email": email,          # avoids extra DB lookup in hot paths
        "is_superadmin": is_superadmin,  # checked by SuperAdminUser dep
        "exp": expire,           # standard JWT expiry claim
        "type": "access",       # distinguishes from refresh tokens
        "jti": str(uuid.uuid4()),  # unique token ID for revocation
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: str) -> str:
    """Create a long-lived JWT refresh token.

    Unlike the access token, the refresh token carries only the user's UUID
    and an expiry — no role or email claims — because it is never used for
    authorization directly. Its sole purpose is to obtain a new access
    token without re-entering credentials.

    The token is also persisted in Redis (see ``store_refresh_token``) so
    the server can revoke it on logout or password change.

    Args:
        subject: The user's UUID.

    Returns:
        An encoded JWT string.
    """
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
# Refresh tokens are stored server-side in Redis so they can be revoked
# individually (on logout) or en masse (on password change).  Each user
# gets exactly one active refresh token at a time — issuing a new one
# overwrites the previous, effectively invalidating it.

def _redis_client() -> aioredis.Redis:
    """Create a short-lived Redis client for token operations.

    A new connection is created per call (and closed in a ``finally``
    block) rather than reusing a module-level singleton, because these
    calls are infrequent (login / refresh / logout) and this avoids
    connection-lifecycle issues during testing and worker restarts.
    """
    return aioredis.from_url(settings.REDIS_URL, decode_responses=True)


async def store_refresh_token(user_id: str, token: str) -> None:
    """Persist *token* in Redis with a TTL matching the JWT expiry.

    Key format: ``refresh:<user_id>``.  Using ``SETEX`` ensures the key
    auto-expires even if the user never explicitly logs out.
    """
    r = _redis_client()
    try:
        key = f"refresh:{user_id}"
        # Convert days to seconds for Redis SETEX
        ttl = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
        await r.setex(key, ttl, token)
    finally:
        await r.aclose()


async def get_stored_refresh_token(user_id: str) -> str | None:
    """Retrieve the stored refresh token for *user_id*, or ``None``.

    Used during the token-refresh flow to verify that the client's
    refresh token matches the one the server issued (prevents replay
    of revoked tokens).
    """
    r = _redis_client()
    try:
        return await r.get(f"refresh:{user_id}")
    finally:
        await r.aclose()


async def revoke_refresh_token(user_id: str) -> None:
    """Delete the stored refresh token, effectively logging the user out.

    Called on ``POST /api/v1/auth/logout`` and on password change.
    """
    r = _redis_client()
    try:
        await r.delete(f"refresh:{user_id}")
    finally:
        await r.aclose()


async def revoke_token_jti(jti: str, ttl_seconds: int = 3600) -> None:
    """Add a JTI to the Redis revocation set (used for session revocation)."""
    r = _redis_client()
    try:
        await r.setex(f"revoked_jti:{jti}", ttl_seconds, "1")
    finally:
        await r.aclose()


async def is_token_revoked(jti: str) -> bool:
    r = _redis_client()
    try:
        return bool(await r.exists(f"revoked_jti:{jti}"))
    finally:
        await r.aclose()


# ── Field-level encryption (for AI API keys) ──────────────────────────────────
# Fernet (symmetric AES-128-CBC with HMAC) is used to encrypt sensitive
# configuration values — primarily third-party AI API keys (OpenAI,
# Anthropic, Grok) stored in the SystemSettings table.  This ensures
# that a raw database dump does not expose plaintext secrets.

def _derive_fernet_key() -> bytes:
    """Derive a 32-byte URL-safe base64 key from ``SECRET_KEY`` using HMAC-SHA256.

    Uses a keyed HMAC with a fixed application-specific salt to produce
    a deterministic 32-byte key from the arbitrary-length SECRET_KEY.
    This is cryptographically stronger than simple padding/truncation.
    """
    import hashlib
    import hmac

    raw = settings.SECRET_KEY.encode()
    derived = hmac.new(b"urban-vibes-dynamics-fernet-v1", raw, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(derived)


try:
    from cryptography.fernet import Fernet

    # Module-level Fernet instance — created once at import time so
    # encrypt/decrypt calls are fast (no key derivation per call).
    _fernet = Fernet(_derive_fernet_key())

    def encrypt_field(value: str) -> str:
        """Encrypt a plaintext string for safe database storage.

        Returns a Fernet token (base64 string) that includes the
        ciphertext, IV, and HMAC — safe to store in a ``TEXT`` column.
        """
        return _fernet.encrypt(value.encode()).decode()

    def decrypt_field(encrypted: str) -> str:
        """Decrypt a Fernet token back to the original plaintext string.

        Raises ``cryptography.fernet.InvalidToken`` if the token is
        corrupted or was encrypted with a different key.
        """
        return _fernet.decrypt(encrypted.encode()).decode()

except ImportError:
    # cryptography not installed — pass-through (dev only).
    # In production the cryptography package MUST be installed so that
    # API keys are never stored in plaintext.
    def encrypt_field(value: str) -> str:  # type: ignore[misc]
        """No-op fallback when ``cryptography`` is not installed (dev only)."""
        return value

    def decrypt_field(encrypted: str) -> str:  # type: ignore[misc]
        """No-op fallback when ``cryptography`` is not installed (dev only)."""
        return encrypted
