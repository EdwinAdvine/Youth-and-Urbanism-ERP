"""Jitsi Meet integration.

Provides helpers to:
- generate a signed JWT for authenticated Jitsi rooms (HS256, app_id / app_secret)
- build a room URL with that token embedded
- list active rooms (placeholder — Jitsi does not expose a REST inventory API)
"""
from __future__ import annotations

import time
import uuid
from typing import Any

from jose import jwt

from app.core.config import settings

# The Jitsi app credentials are read from settings.  The secret used to sign
# Jitsi JWTs is the same SECRET_KEY used for internal JWTs when a dedicated
# JITSI_APP_SECRET is not configured.  In production you should set both
# JITSI_APP_ID and JITSI_APP_SECRET in the environment.
_JITSI_APP_ID: str = getattr(settings, "JITSI_APP_ID", "urban-vibes-dynamics")
_JITSI_APP_SECRET: str = getattr(settings, "JITSI_APP_SECRET", settings.SECRET_KEY)


def generate_jwt(room: str, user: dict[str, Any]) -> str:
    """Return a signed Jitsi JWT for the given room and user.

    Parameters
    ----------
    room:
        The Jitsi room name (URL-safe string).
    user:
        Dict with at least ``id`` and ``name``; optionally ``email`` and
        ``avatar``.

    The token follows the Jitsi JWT auth spec:
    https://github.com/jitsi/lib-jitsi-meet/blob/master/doc/tokens.md
    """
    now = int(time.time())
    payload: dict[str, Any] = {
        "context": {
            "user": {
                "id": str(user.get("id", "")),
                "name": str(user.get("name", "Anonymous")),
                "email": str(user.get("email", "")),
                "avatar": str(user.get("avatar", "")),
            },
        },
        "aud": "jitsi",
        "iss": _JITSI_APP_ID,
        "sub": settings.JITSI_PUBLIC_URL.replace("http://", "").replace("https://", ""),
        "room": room,
        "iat": now,
        "exp": now + 7200,  # 2-hour sessions
    }
    return jwt.encode(payload, _JITSI_APP_SECRET, algorithm="HS256")


def create_room(name: str, user_id: str, user_name: str, user_email: str = "") -> dict[str, str]:
    """Create a Jitsi room descriptor.

    Jitsi rooms are created implicitly when the first participant joins.  This
    function returns the room URL and a pre-signed JWT so the frontend can
    embed the Jitsi IFrame API or redirect the user.

    Returns
    -------
    dict with keys ``room_url`` and ``jwt_token``.
    """
    # Sanitise room name: replace spaces/special chars with hyphens
    safe_name = "".join(c if c.isalnum() or c == "-" else "-" for c in name.strip())
    if not safe_name:
        safe_name = str(uuid.uuid4())

    user_info: dict[str, Any] = {
        "id": user_id,
        "name": user_name,
        "email": user_email,
    }
    token = generate_jwt(safe_name, user_info)
    room_url = f"{settings.JITSI_PUBLIC_URL}/{safe_name}?jwt={token}"
    return {
        "room_name": safe_name,
        "room_url": room_url,
        "jwt_token": token,
    }


def list_rooms() -> list[dict[str, Any]]:
    """Return a list of active Jitsi rooms.

    Jitsi Meet does not expose a REST API for listing active conferences in
    the default open-source deployment.  Prosody / Jicofo statistics are
    available only via XMPP or optional monitoring endpoints.

    This function is a placeholder that always returns an empty list.  When
    meeting records are stored in the database the frontend should query the
    ``/meetings`` API rather than this helper.
    """
    return []
