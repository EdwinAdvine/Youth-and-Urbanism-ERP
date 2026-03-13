"""Support Omnichannel API — channel configuration, inbound webhooks, and per-channel stats."""

import base64
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.support import Ticket
from app.models.support_phase2 import OmnichannelConfig

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _encrypt_key(raw: str) -> str:
    """Encode an API key with base64 (simple, reversible — replace with Fernet for production)."""
    return base64.b64encode(raw.encode()).decode()


def _mask_key(encrypted: str | None) -> str | None:
    """Return only the last 4 characters of the decrypted key."""
    if not encrypted:
        return None
    try:
        raw = base64.b64decode(encrypted.encode()).decode()
    except Exception:
        raw = encrypted
    return f"****{raw[-4:]}" if len(raw) >= 4 else "****"


async def _get_config_or_404(db: DBSession, channel_id: uuid.UUID) -> OmnichannelConfig:
    cfg = await db.get(OmnichannelConfig, channel_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="Channel config not found")
    return cfg


async def _generate_ticket_number(db: DBSession) -> str:
    """Generate TKT-YYYY-NNNN ticket number."""
    year = datetime.now(timezone.utc).year
    prefix = f"TKT-{year}-"
    result = await db.execute(
        select(func.count()).select_from(Ticket).where(Ticket.ticket_number.like(f"{prefix}%"))
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}{count:04d}"


# ── Schemas ───────────────────────────────────────────────────────────────────

class ChannelConfigCreate(BaseModel):
    channel: str
    display_name: str
    webhook_url: str | None = None
    api_key: str | None = None
    settings: dict | None = None


class ChannelConfigUpdate(BaseModel):
    display_name: str | None = None
    webhook_url: str | None = None
    api_key: str | None = None
    settings: dict | None = None
    is_active: bool | None = None


class ChannelConfigOut(BaseModel):
    id: uuid.UUID
    channel: str
    display_name: str
    webhook_url: str | None
    api_key_masked: str | None
    settings: dict | None
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class WebhookPayload(BaseModel):
    sender_id: str
    sender_name: str
    message: str
    sender_email: str | None = None


# ── Serialiser ────────────────────────────────────────────────────────────────

def _config_out(cfg: OmnichannelConfig) -> dict:
    return {
        "id": cfg.id,
        "channel": cfg.channel,
        "display_name": cfg.display_name,
        "webhook_url": cfg.webhook_url,
        "api_key_masked": _mask_key(cfg.api_key_encrypted),
        "settings": cfg.settings,
        "is_active": cfg.is_active,
        "created_at": cfg.created_at,
        "updated_at": cfg.updated_at,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/omnichannel/channels", summary="List all omnichannel channel configs")
async def list_channels(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(OmnichannelConfig).order_by(OmnichannelConfig.created_at.asc())
    )
    configs = result.scalars().all()
    return {"channels": [_config_out(c) for c in configs]}


@router.post("/omnichannel/channels", status_code=201, summary="Create omnichannel channel config")
async def create_channel(
    payload: ChannelConfigCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Guard against duplicate channel name
    existing = await db.execute(
        select(OmnichannelConfig).where(OmnichannelConfig.channel == payload.channel)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"A channel config for '{payload.channel}' already exists",
        )

    cfg = OmnichannelConfig(
        channel=payload.channel,
        display_name=payload.display_name,
        webhook_url=payload.webhook_url,
        api_key_encrypted=_encrypt_key(payload.api_key) if payload.api_key else None,
        settings=payload.settings or {},
        is_active=False,
    )
    db.add(cfg)
    await db.commit()
    await db.refresh(cfg)
    return _config_out(cfg)


@router.get(
    "/omnichannel/channels/{channel_id}",
    summary="Get omnichannel channel config (api_key masked)",
)
async def get_channel(
    channel_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    cfg = await _get_config_or_404(db, channel_id)
    return _config_out(cfg)


@router.put("/omnichannel/channels/{channel_id}", summary="Update omnichannel channel config")
async def update_channel(
    channel_id: uuid.UUID,
    payload: ChannelConfigUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    cfg = await _get_config_or_404(db, channel_id)

    if payload.display_name is not None:
        cfg.display_name = payload.display_name
    if payload.webhook_url is not None:
        cfg.webhook_url = payload.webhook_url
    if payload.api_key is not None:
        cfg.api_key_encrypted = _encrypt_key(payload.api_key)
    if payload.settings is not None:
        cfg.settings = payload.settings
    if payload.is_active is not None:
        cfg.is_active = payload.is_active

    await db.commit()
    await db.refresh(cfg)
    return _config_out(cfg)


@router.delete(
    "/omnichannel/channels/{channel_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete omnichannel channel config",
)
async def delete_channel(
    channel_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> None:
    cfg = await _get_config_or_404(db, channel_id)
    await db.delete(cfg)
    await db.commit()


@router.post(
    "/omnichannel/channels/{channel_id}/toggle",
    summary="Toggle is_active for a channel config",
)
async def toggle_channel(
    channel_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    cfg = await _get_config_or_404(db, channel_id)
    cfg.is_active = not cfg.is_active
    await db.commit()
    await db.refresh(cfg)
    return _config_out(cfg)


@router.post(
    "/omnichannel/channels/{channel_id}/test",
    summary="Test connectivity for a channel config",
)
async def test_channel(
    channel_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    cfg = await _get_config_or_404(db, channel_id)
    # Placeholder — real implementations would ping the channel's API
    return {"status": "ok", "channel": cfg.channel}


@router.post(
    "/omnichannel/webhook/{channel_name}",
    status_code=201,
    summary="Inbound webhook — create ticket from external channel message",
)
async def inbound_webhook(
    channel_name: str,
    payload: WebhookPayload,
    db: DBSession,
) -> dict[str, Any]:
    """
    Public webhook endpoint called by external messaging platforms (WhatsApp, Facebook, etc.).
    Validates the channel exists and is active, then creates a support ticket from the message.
    No auth token is required — the caller is an external platform.
    """
    result = await db.execute(
        select(OmnichannelConfig).where(OmnichannelConfig.channel == channel_name)
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=404, detail=f"Channel '{channel_name}' not found")
    if not cfg.is_active:
        raise HTTPException(
            status_code=400,
            detail=f"Channel '{channel_name}' is not active",
        )

    ticket_number = await _generate_ticket_number(db)
    subject = payload.message[:100]

    ticket = Ticket(
        ticket_number=ticket_number,
        subject=subject,
        description=payload.message,
        channel=channel_name,
        customer_name=payload.sender_name,
        customer_email=payload.sender_email,
        status="open",
        priority="medium",
        # created_by is required on the model; use a sentinel UUID for inbound messages
        # (no internal user initiated this — real implem would resolve a bot/system user ID)
        created_by=uuid.UUID("00000000-0000-0000-0000-000000000001"),
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)

    await event_bus.publish("support.ticket.created", {
        "ticket_id": str(ticket.id),
        "ticket_number": ticket.ticket_number,
        "subject": ticket.subject,
        "priority": ticket.priority,
        "customer_email": ticket.customer_email or "",
        "customer_name": ticket.customer_name or "",
        "channel": channel_name,
        "source": "omnichannel_webhook",
    })

    return {"ticket_id": str(ticket.id), "ticket_number": ticket.ticket_number}


@router.get("/omnichannel/stats", summary="Per-channel ticket counts")
async def omnichannel_stats(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Return a breakdown of ticket counts grouped by the channel field on Ticket."""
    result = await db.execute(
        select(Ticket.channel, func.count(Ticket.id).label("count"))
        .group_by(Ticket.channel)
        .order_by(func.count(Ticket.id).desc())
    )
    rows = result.all()
    return {
        "stats": [{"channel": row.channel, "ticket_count": row.count} for row in rows]
    }
