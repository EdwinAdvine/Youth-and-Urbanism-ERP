"""Super Admin Jitsi / Meetings configuration endpoints.

All config is stored in the system_settings table as JSON values
under the 'meetings_admin' category.
"""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel as PydanticBase
from sqlalchemy import select

from app.core.deps import DBSession, SuperAdminUser
from app.models.settings import SystemSettings

router = APIRouter()

CATEGORY = "meetings_admin"


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_config(db, key: str, defaults: dict) -> dict:
    result = await db.execute(
        select(SystemSettings).where(
            SystemSettings.key == key,
            SystemSettings.category == CATEGORY,
        )
    )
    row = result.scalar_one_or_none()
    if row is None or row.value is None:
        return defaults
    try:
        return {**defaults, **json.loads(row.value)}
    except json.JSONDecodeError:
        return defaults


async def _put_config(db, key: str, data: dict) -> dict:
    result = await db.execute(
        select(SystemSettings).where(
            SystemSettings.key == key,
            SystemSettings.category == CATEGORY,
        )
    )
    row = result.scalar_one_or_none()
    value_str = json.dumps(data)
    if row is None:
        row = SystemSettings(key=key, value=value_str, category=CATEGORY)
        db.add(row)
    else:
        row.value = value_str
    await db.commit()
    return data


# ── Schemas ──────────────────────────────────────────────────────────────────

class MeetingsServerConfig(PydanticBase):
    jitsi_url: str = "https://meet.jitsi"
    jwt_app_id: str = ""
    jwt_secret: str = ""
    enable_lobby: bool = True
    enable_breakout_rooms: bool = True
    require_authentication: bool = True


class MeetingsDefaults(PydanticBase):
    max_participants: int = 100
    recording_enabled: bool = True
    default_video_quality: str = "720"
    default_mute_on_join: bool = True
    default_camera_off_on_join: bool = False
    max_meeting_duration_minutes: int = 480
    enable_screen_sharing: bool = True
    enable_chat: bool = True
    enable_raise_hand: bool = True


class MeetingsRecording(PydanticBase):
    storage_bucket: str = "recordings"
    auto_delete_after_days: int = 90
    max_recording_size_mb: int = 2048
    recording_format: str = "mp4"
    auto_transcribe: bool = False


class LobbySettings(PydanticBase):
    logo_url: str = ""
    welcome_message: str = "Welcome! The host will let you in shortly."
    background_color: str = "#1a1a2e"
    require_approval: bool = True


class JitsiTheme(PydanticBase):
    primary_color: str = "#51459d"
    logo_url: str = ""
    watermark_url: str = ""
    toolbar_buttons: list[str] = [
        "camera", "chat", "closedcaptions", "desktop", "download",
        "embedmeeting", "etherpad", "feedback", "filmstrip", "fullscreen",
        "hangup", "help", "highlight", "invite", "linktosalesforce",
        "livestreaming", "microphone", "noisesuppression", "participants-pane",
        "profile", "raisehand", "recording", "security", "select-background",
        "settings", "shareaudio", "sharedvideo", "shortcuts", "stats",
        "tileview", "toggle-camera", "videoquality", "whiteboard",
    ]


class SIPConfig(PydanticBase):
    sip_enabled: bool = False
    sip_server: str = ""
    sip_username: str = ""
    sip_password: str = ""
    dial_in_number: str = ""
    dial_in_pin_prefix: str = ""


# ── Meetings Server Config ──────────────────────────────────────────────────

MEETINGS_CONFIG_KEY = "meetings_server_config"
MEETINGS_CONFIG_DEFAULTS = MeetingsServerConfig().model_dump()


@router.get("/config", response_model=MeetingsServerConfig, summary="Get Jitsi server configuration")
async def get_meetings_config(
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _get_config(db, MEETINGS_CONFIG_KEY, MEETINGS_CONFIG_DEFAULTS)


@router.put("/config", response_model=MeetingsServerConfig, summary="Update Jitsi server configuration")
async def update_meetings_config(
    payload: MeetingsServerConfig,
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _put_config(db, MEETINGS_CONFIG_KEY, payload.model_dump())


# ── Meetings Defaults ────────────────────────────────────────────────────────

MEETINGS_DEFAULTS_KEY = "meetings_defaults"
MEETINGS_DEFAULTS_DEFAULTS = MeetingsDefaults().model_dump()


@router.get("/defaults", response_model=MeetingsDefaults, summary="Get meeting default settings")
async def get_meetings_defaults(
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _get_config(db, MEETINGS_DEFAULTS_KEY, MEETINGS_DEFAULTS_DEFAULTS)


@router.put("/defaults", response_model=MeetingsDefaults, summary="Update meeting default settings")
async def update_meetings_defaults(
    payload: MeetingsDefaults,
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _put_config(db, MEETINGS_DEFAULTS_KEY, payload.model_dump())


# ── Recording Config ─────────────────────────────────────────────────────────

MEETINGS_RECORDING_KEY = "meetings_recording"
MEETINGS_RECORDING_DEFAULTS = MeetingsRecording().model_dump()


@router.get("/recording", response_model=MeetingsRecording, summary="Get recording configuration")
async def get_meetings_recording(
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _get_config(db, MEETINGS_RECORDING_KEY, MEETINGS_RECORDING_DEFAULTS)


@router.put("/recording", response_model=MeetingsRecording, summary="Update recording configuration")
async def update_meetings_recording(
    payload: MeetingsRecording,
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _put_config(db, MEETINGS_RECORDING_KEY, payload.model_dump())


# ── Lobby Settings ──────────────────────────────────────────────────────────

LOBBY_KEY = "meetings_lobby_settings"
LOBBY_DEFAULTS = LobbySettings().model_dump()


@router.get("/lobby", response_model=LobbySettings, summary="Get lobby customization settings")
async def get_lobby_settings(
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _get_config(db, LOBBY_KEY, LOBBY_DEFAULTS)


@router.put("/lobby", response_model=LobbySettings, summary="Update lobby customization settings")
async def update_lobby_settings(
    payload: LobbySettings,
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _put_config(db, LOBBY_KEY, payload.model_dump())


# ── Public lobby settings (no auth — used by the lobby pre-join page) ──────

@router.get("/lobby/public", response_model=LobbySettings, summary="Get lobby settings (public)")
async def get_lobby_settings_public(db: DBSession) -> Any:
    return await _get_config(db, LOBBY_KEY, LOBBY_DEFAULTS)


# ── Jitsi Theme ─────────────────────────────────────────────────────────────

THEME_KEY = "meetings_jitsi_theme"
THEME_DEFAULTS = JitsiTheme().model_dump()


@router.get("/theme", response_model=JitsiTheme, summary="Get Jitsi UI theme")
async def get_jitsi_theme(
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _get_config(db, THEME_KEY, THEME_DEFAULTS)


@router.put("/theme", response_model=JitsiTheme, summary="Update Jitsi UI theme")
async def update_jitsi_theme(
    payload: JitsiTheme,
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _put_config(db, THEME_KEY, payload.model_dump())


# ── Public theme (used by frontend Jitsi iframe embed) ─────────────────────

@router.get("/theme/public", response_model=JitsiTheme, summary="Get Jitsi theme (public)")
async def get_jitsi_theme_public(db: DBSession) -> Any:
    return await _get_config(db, THEME_KEY, THEME_DEFAULTS)


# ── SIP Configuration ──────────────────────────────────────────────────────

SIP_KEY = "meetings_sip_config"
SIP_DEFAULTS = SIPConfig().model_dump()


@router.get("/sip", response_model=SIPConfig, summary="Get SIP gateway configuration")
async def get_sip_config(
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _get_config(db, SIP_KEY, SIP_DEFAULTS)


@router.put("/sip", response_model=SIPConfig, summary="Update SIP gateway configuration")
async def update_sip_config(
    payload: SIPConfig,
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _put_config(db, SIP_KEY, payload.model_dump())
