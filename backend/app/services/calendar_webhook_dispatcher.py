"""Calendar webhook dispatcher and API key utilities.

Responsibilities:
- Dispatching signed webhook payloads to subscriber URLs (HMAC-SHA256).
- Generating and validating calendar API keys.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.calendar_webhooks import CalendarApiKey, CalendarWebhook

logger = logging.getLogger(__name__)

# Event types that the webhook system can emit
CALENDAR_WEBHOOK_EVENTS = (
    "event.created",
    "event.updated",
    "event.deleted",
    "booking.created",
    "booking.cancelled",
    "focus.blocked",
)

# Maximum delivery failures before a webhook is automatically deactivated
MAX_FAILURES = 10


# ---------------------------------------------------------------------------
# Webhook dispatcher
# ---------------------------------------------------------------------------


async def dispatch_webhook(
    event_type: str,
    payload: dict,
    user_id: str,
    db: AsyncSession,
) -> None:
    """Fire a webhook event to all active subscribers for *user_id*.

    Each webhook is delivered independently.  Failures update the failure
    counter; after MAX_FAILURES consecutive failures the webhook is deactivated.
    """
    result = await db.execute(
        select(CalendarWebhook).where(
            CalendarWebhook.user_id == user_id,
            CalendarWebhook.is_active == True,  # noqa: E712
        )
    )
    webhooks = result.scalars().all()

    # Filter to those subscribed to this event type
    targets = [wh for wh in webhooks if event_type in (wh.events or [])]
    if not targets:
        return

    now = datetime.now(timezone.utc)
    body = {
        "event": event_type,
        "timestamp": now.isoformat(),
        "data": payload,
    }
    body_bytes = json.dumps(body, default=str).encode()

    async with httpx.AsyncClient(timeout=10.0) as client:
        for webhook in targets:
            signature = hmac.new(
                webhook.secret.encode(),
                body_bytes,
                hashlib.sha256,
            ).hexdigest()

            headers = {
                "Content-Type": "application/json",
                "X-Era-Signature": f"sha256={signature}",
                "X-Era-Event": event_type,
            }

            try:
                response = await client.post(
                    webhook.url,
                    content=body_bytes,
                    headers=headers,
                )
                webhook.last_triggered_at = now
                webhook.last_status_code = response.status_code

                if response.is_success:
                    # Reset failure streak on success
                    webhook.failure_count = 0
                else:
                    webhook.failure_count = (webhook.failure_count or 0) + 1
                    logger.warning(
                        "Webhook %s returned status %d (failure %d)",
                        webhook.id,
                        response.status_code,
                        webhook.failure_count,
                    )

            except Exception as exc:  # network error, timeout, etc.
                webhook.last_triggered_at = now
                webhook.last_status_code = None
                webhook.failure_count = (webhook.failure_count or 0) + 1
                logger.error(
                    "Webhook %s delivery failed: %s (failure %d)",
                    webhook.id,
                    exc,
                    webhook.failure_count,
                )

            # Auto-deactivate after too many failures
            if webhook.failure_count >= MAX_FAILURES:
                webhook.is_active = False
                logger.warning(
                    "Webhook %s auto-deactivated after %d failures",
                    webhook.id,
                    webhook.failure_count,
                )

            await db.flush()


# ---------------------------------------------------------------------------
# API key utilities
# ---------------------------------------------------------------------------


def generate_api_key() -> tuple[str, str]:
    """Return *(raw_key, sha256_hash)*.

    The raw key has the format ``era_<32-byte url-safe token>`` and is shown
    to the user exactly once.  Only the hash is persisted.
    """
    raw_key = "era_" + secrets.token_urlsafe(32)
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    return raw_key, key_hash


async def validate_api_key(
    raw_key: str,
    db: AsyncSession,
) -> CalendarApiKey | None:
    """Validate a raw API key string.

    Returns the matching :class:`CalendarApiKey` record (with ``last_used_at``
    updated) if the key is active and not expired, or ``None`` otherwise.
    """
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(CalendarApiKey).where(
            CalendarApiKey.key_hash == key_hash,
            CalendarApiKey.is_active == True,  # noqa: E712
        )
    )
    api_key = result.scalar_one_or_none()

    if api_key is None:
        return None

    # Check expiry
    if api_key.expires_at is not None and api_key.expires_at < now:
        return None

    # Touch last_used_at
    api_key.last_used_at = now
    await db.flush()

    return api_key
