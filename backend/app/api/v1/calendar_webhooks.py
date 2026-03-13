"""Calendar Webhooks & API Keys router.

Endpoints:
  Webhooks
    GET    /calendar/webhooks                       — list user's webhooks
    POST   /calendar/webhooks                       — create webhook (secret shown once)
    PUT    /calendar/webhooks/{webhook_id}           — update webhook
    DELETE /calendar/webhooks/{webhook_id}           — delete webhook
    POST   /calendar/webhooks/{webhook_id}/test      — send test ping

  API Keys
    GET    /calendar/api-keys                       — list keys (prefix only, no raw key)
    POST   /calendar/api-keys                       — create key (raw key shown once)
    DELETE /calendar/api-keys/{key_id}              — revoke key
"""

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.calendar_webhooks import CalendarApiKey, CalendarWebhook
from app.services.calendar_webhook_dispatcher import (
    CALENDAR_WEBHOOK_EVENTS,
    dispatch_webhook,
    generate_api_key,
)

router = APIRouter(prefix="/calendar", tags=["Calendar - Webhooks & API Keys"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

VALID_SCOPES = (
    "calendar:read",
    "calendar:write",
    "bookings:read",
    "bookings:write",
)


class WebhookCreate(BaseModel):
    name: str = Field(..., max_length=200)
    url: str = Field(..., max_length=1000)
    secret: str | None = Field(
        None,
        max_length=200,
        description="HMAC signing secret. Auto-generated if omitted.",
    )
    events: list[str] = Field(
        default_factory=list,
        description=f"Event types to subscribe to. Valid: {CALENDAR_WEBHOOK_EVENTS}",
    )


class WebhookUpdate(BaseModel):
    name: str | None = Field(None, max_length=200)
    url: str | None = Field(None, max_length=1000)
    events: list[str] | None = None
    is_active: bool | None = None


class WebhookOut(BaseModel):
    id: uuid.UUID
    name: str
    url: str
    events: list[str]
    is_active: bool
    last_triggered_at: datetime | None
    last_status_code: int | None
    failure_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WebhookCreateOut(WebhookOut):
    """Extended response returned once on creation — includes plain-text secret."""

    secret: str


class ApiKeyCreate(BaseModel):
    name: str = Field(..., max_length=200)
    scopes: list[str] = Field(
        default_factory=list,
        description=f"Allowed scopes. Valid: {VALID_SCOPES}",
    )
    expires_in_days: int | None = Field(
        None,
        ge=1,
        description="If provided, key expires after this many days.",
    )


class ApiKeyOut(BaseModel):
    id: uuid.UUID
    name: str
    key_prefix: str
    scopes: list[str]
    expires_at: datetime | None
    last_used_at: datetime | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ApiKeyCreateOut(ApiKeyOut):
    """Extended response returned once on creation — includes the full raw key."""

    raw_key: str


class TestWebhookOut(BaseModel):
    success: bool
    status_code: int | None
    message: str


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _assert_valid_events(events: list[str]) -> None:
    bad = [e for e in events if e not in CALENDAR_WEBHOOK_EVENTS]
    if bad:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown event types: {bad}. Valid: {list(CALENDAR_WEBHOOK_EVENTS)}",
        )


def _assert_valid_scopes(scopes: list[str]) -> None:
    bad = [s for s in scopes if s not in VALID_SCOPES]
    if bad:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown scopes: {bad}. Valid: {list(VALID_SCOPES)}",
        )


async def _get_webhook_or_404(
    webhook_id: uuid.UUID,
    user_id: uuid.UUID,
    db: DBSession,
) -> CalendarWebhook:
    result = await db.execute(
        select(CalendarWebhook).where(
            CalendarWebhook.id == webhook_id,
            CalendarWebhook.user_id == user_id,
        )
    )
    webhook = result.scalar_one_or_none()
    if webhook is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
    return webhook


async def _get_api_key_or_404(
    key_id: uuid.UUID,
    user_id: uuid.UUID,
    db: DBSession,
) -> CalendarApiKey:
    result = await db.execute(
        select(CalendarApiKey).where(
            CalendarApiKey.id == key_id,
            CalendarApiKey.user_id == user_id,
        )
    )
    key = result.scalar_one_or_none()
    if key is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    return key


# ---------------------------------------------------------------------------
# Webhook endpoints
# ---------------------------------------------------------------------------


@router.get("/webhooks", response_model=list[WebhookOut])
async def list_webhooks(
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """List all webhooks belonging to the current user."""
    result = await db.execute(
        select(CalendarWebhook)
        .where(CalendarWebhook.user_id == current_user.id)
        .order_by(CalendarWebhook.created_at.desc())
    )
    return result.scalars().all()


@router.post("/webhooks", response_model=WebhookCreateOut, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    body: WebhookCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """Create a new webhook subscription.

    The plain-text secret is returned **once** in this response.  Store it
    securely — it will never be returned again.
    """
    _assert_valid_events(body.events)

    plain_secret = body.secret or secrets.token_urlsafe(32)

    webhook = CalendarWebhook(
        user_id=current_user.id,
        name=body.name,
        url=body.url,
        secret=plain_secret,
        events=body.events,
        is_active=True,
        failure_count=0,
    )
    db.add(webhook)
    await db.commit()
    await db.refresh(webhook)

    # Serialize via Pydantic then inject secret
    out = WebhookOut.model_validate(webhook).model_dump()
    out["secret"] = plain_secret
    return out


@router.put("/webhooks/{webhook_id}", response_model=WebhookOut)
async def update_webhook(
    webhook_id: uuid.UUID,
    body: WebhookUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """Update a webhook's name, URL, event subscriptions, or active state."""
    webhook = await _get_webhook_or_404(webhook_id, current_user.id, db)

    if body.name is not None:
        webhook.name = body.name
    if body.url is not None:
        webhook.url = body.url
    if body.events is not None:
        _assert_valid_events(body.events)
        webhook.events = body.events
    if body.is_active is not None:
        webhook.is_active = body.is_active
        if body.is_active:
            # Manually re-activating: reset failure counter
            webhook.failure_count = 0

    await db.commit()
    await db.refresh(webhook)
    return webhook


@router.delete("/webhooks/{webhook_id}", status_code=status.HTTP_200_OK)
async def delete_webhook(
    webhook_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> None:
    """Permanently delete a webhook subscription."""
    webhook = await _get_webhook_or_404(webhook_id, current_user.id, db)
    await db.delete(webhook)
    await db.commit()


@router.post("/webhooks/{webhook_id}/test", response_model=TestWebhookOut)
async def test_webhook(
    webhook_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """Send a test ping payload to the webhook URL.

    Uses the same signing mechanism as real deliveries so you can verify
    your endpoint's signature validation logic.
    """
    webhook = await _get_webhook_or_404(webhook_id, current_user.id, db)

    test_payload = {
        "test": True,
        "message": "This is a test webhook delivery from Urban Vibes Dynamics Calendar.",
        "webhook_id": str(webhook.id),
        "webhook_name": webhook.name,
    }

    import hashlib
    import hmac as _hmac
    import json as _json

    import httpx

    body_obj = {
        "event": "webhook.test",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": test_payload,
    }
    body_bytes = _json.dumps(body_obj, default=str).encode()
    signature = _hmac.new(
        webhook.secret.encode(),
        body_bytes,
        hashlib.sha256,
    ).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-Era-Signature": f"sha256={signature}",
        "X-Era-Event": "webhook.test",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(webhook.url, content=body_bytes, headers=headers)

        success = response.is_success
        return TestWebhookOut(
            success=success,
            status_code=response.status_code,
            message=(
                f"Test delivery succeeded with status {response.status_code}."
                if success
                else f"Endpoint returned {response.status_code}."
            ),
        )
    except Exception as exc:
        return TestWebhookOut(
            success=False,
            status_code=None,
            message=f"Delivery failed: {exc}",
        )


# ---------------------------------------------------------------------------
# API Key endpoints
# ---------------------------------------------------------------------------


@router.get("/api-keys", response_model=list[ApiKeyOut])
async def list_api_keys(
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """List all API keys for the current user (prefix only — no raw key)."""
    result = await db.execute(
        select(CalendarApiKey)
        .where(CalendarApiKey.user_id == current_user.id)
        .order_by(CalendarApiKey.created_at.desc())
    )
    return result.scalars().all()


@router.post("/api-keys", response_model=ApiKeyCreateOut, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    body: ApiKeyCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """Generate a new calendar API key.

    The full raw key is returned **once** in this response.  It cannot be
    recovered later — copy it to a secure location now.
    """
    _assert_valid_scopes(body.scopes)

    raw_key, key_hash = generate_api_key()
    key_prefix = raw_key[:8]  # e.g. "era_k1a2"

    expires_at: datetime | None = None
    if body.expires_in_days is not None:
        expires_at = datetime.now(timezone.utc) + timedelta(days=body.expires_in_days)

    api_key = CalendarApiKey(
        user_id=current_user.id,
        name=body.name,
        key_hash=key_hash,
        key_prefix=key_prefix,
        scopes=body.scopes,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    out = ApiKeyOut.model_validate(api_key).model_dump()
    out["raw_key"] = raw_key
    return out


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_200_OK)
async def revoke_api_key(
    key_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> None:
    """Revoke (permanently delete) a calendar API key."""
    api_key = await _get_api_key_or_404(key_id, current_user.id, db)
    await db.delete(api_key)
    await db.commit()
