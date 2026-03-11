"""ONLYOFFICE Document Server integration.

Provides helpers to:
- generate a signed JWT for the ONLYOFFICE document server
- build the editor config dict consumed by the JS Document Editor SDK
- process the save/status callbacks sent by the Document Server
"""
from __future__ import annotations

import hashlib
import time
import uuid
from typing import Any

from jose import jwt

from app.core.config import settings

# ── document type mapping ──────────────────────────────────────────────────────
_EXT_TYPE: dict[str, str] = {
    "docx": "word",
    "doc": "word",
    "odt": "word",
    "xlsx": "cell",
    "xls": "cell",
    "ods": "cell",
    "pptx": "slide",
    "ppt": "slide",
    "odp": "slide",
    "pdf": "word",
}

_EXT_MIME: dict[str, str] = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "pdf": "application/pdf",
}


def _sign(payload: dict[str, Any]) -> str:
    """Return a signed JWT for the given payload using the ONLYOFFICE JWT secret."""
    return jwt.encode(payload, settings.ONLYOFFICE_JWT_SECRET, algorithm="HS256")


def _doc_type(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return _EXT_TYPE.get(ext, "word")


# ── Public API ─────────────────────────────────────────────────────────────────

def create_document(filename: str, user_id: str) -> dict[str, Any]:
    """Return a minimal document-creation config.

    The returned dict includes an ONLYOFFICE-signed JWT so the frontend can
    request the server to create/open the empty file.
    """
    file_id = str(uuid.uuid4())
    payload: dict[str, Any] = {
        "file_id": file_id,
        "filename": filename,
        "user_id": user_id,
        "doc_type": _doc_type(filename),
        "iat": int(time.time()),
    }
    token = _sign(payload)
    return {
        "file_id": file_id,
        "filename": filename,
        "doc_type": payload["doc_type"],
        "token": token,
    }


def get_editor_config(
    file_id: str,
    filename: str,
    user_id: str,
    user_name: str,
    download_url: str,
    callback_url: str,
    mode: str = "edit",
    *,
    macros_enabled: bool = True,
    macros_mode: str = "warn",
    plugins_enabled: bool = True,
) -> dict[str, Any]:
    """Build the full ONLYOFFICE editor config dict for the JS SDK.

    Parameters
    ----------
    file_id:
        Unique identifier for the document (stored in MinIO / drive).
    filename:
        Original filename including extension (e.g. ``report.docx``).
    user_id:
        ID of the user opening the document.
    user_name:
        Display name for the collaborative cursor label.
    download_url:
        Pre-signed URL from which ONLYOFFICE DS can fetch the document bytes.
    callback_url:
        URL that ONLYOFFICE DS will POST save/status events to (``/docs/callback``).
    mode:
        ``"edit"`` (default) or ``"view"``.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "docx"
    doc_key = hashlib.md5(f"{file_id}:{int(time.time() // 60)}".encode()).hexdigest()

    config: dict[str, Any] = {
        "document": {
            "fileType": ext,
            "key": doc_key,
            "title": filename,
            "url": download_url,
            "permissions": {
                "comment": True,
                "download": True,
                "edit": mode == "edit",
                "print": True,
                "review": True,
            },
        },
        "documentType": _doc_type(filename),
        "editorConfig": {
            "callbackUrl": callback_url,
            "mode": mode,
            "lang": "en",
            "user": {
                "id": user_id,
                "name": user_name,
            },
            "customization": {
                "macros": macros_enabled,
                "plugins": plugins_enabled,
                "macrosMode": macros_mode,
            },
        },
    }

    # Sign the config WITHOUT the token field — ONLYOFFICE validates by decoding
    # the JWT and comparing it against the config excluding the token field itself.
    config["token"] = _sign(config)
    return config


def request_conversion(
    file_id: str,
    filename: str,
    download_url: str,
    output_format: str,
) -> dict[str, Any]:
    """Request file conversion via ONLYOFFICE Conversion API.

    Sends an HTTP POST to ``{ONLYOFFICE_URL}/ConvertService.ashx`` with a
    signed JWT payload describing the source file and target format.

    Returns the conversion result dict from ONLYOFFICE (contains ``fileUrl``
    for the converted file when ``endConvert`` is ``True``).
    """
    import httpx  # noqa: PLC0415

    doc_key = hashlib.md5(f"{file_id}:{int(time.time())}".encode()).hexdigest()

    payload: dict[str, Any] = {
        "async": False,
        "filetype": filename.rsplit(".", 1)[-1].lower() if "." in filename else "docx",
        "key": doc_key,
        "outputtype": output_format.lower(),
        "title": filename,
        "url": download_url,
    }

    token = _sign(payload)
    payload["token"] = token

    conversion_url = f"{settings.ONLYOFFICE_URL}/ConvertService.ashx"

    resp = httpx.post(
        conversion_url,
        json=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        timeout=60.0,
    )
    resp.raise_for_status()
    result = resp.json()

    return {
        "end_convert": result.get("endConvert", False),
        "file_url": result.get("fileUrl"),
        "percent": result.get("percent", 0),
        "error": result.get("error"),
    }


def get_editor_config_mobile(
    file_id: str,
    filename: str,
    user_id: str,
    user_name: str,
    download_url: str,
    callback_url: str,
    mode: str = "edit",
    *,
    macros_enabled: bool = True,
    macros_mode: str = "warn",
    plugins_enabled: bool = True,
) -> dict[str, Any]:
    """Build ONLYOFFICE editor config for mobile devices.

    Sets ``type: "mobile"`` in the config so ONLYOFFICE renders the
    mobile-optimized editor interface.
    """
    config = get_editor_config(
        file_id=file_id,
        filename=filename,
        user_id=user_id,
        user_name=user_name,
        download_url=download_url,
        callback_url=callback_url,
        mode=mode,
        macros_enabled=macros_enabled,
        macros_mode=macros_mode,
        plugins_enabled=plugins_enabled,
    )
    config["type"] = "mobile"
    # Re-sign without the token field, then re-attach
    config.pop("token", None)
    config["token"] = _sign(config)
    return config


def track_editing_session(
    file_id: str,
    user_id: str,
    user_name: str,
    action: str = "join",
) -> None:
    """Track user editing sessions in Redis for co-editing presence.

    ``action`` is ``"join"`` when a user opens the editor or ``"leave"``
    when the ONLYOFFICE callback reports disconnect (status 4 with no changes
    or status 2 on save-and-close).
    """
    import redis  # noqa: PLC0415

    r = redis.from_url(settings.REDIS_URL, decode_responses=True)
    key = f"doc:editors:{file_id}"

    if action == "join":
        # Store user info as a hash field with TTL refresh
        r.hset(key, user_id, f"{user_name}|{int(time.time())}")
        r.expire(key, 3600)  # auto-expire after 1 hour of no refresh
    elif action == "leave":
        r.hdel(key, user_id)
        # Clean up empty key
        if r.hlen(key) == 0:
            r.delete(key)


def get_active_editors(file_id: str) -> list[dict[str, str]]:
    """Return list of users currently editing the document.

    Each entry contains ``user_id``, ``user_name``, and ``joined_at`` (Unix timestamp).
    Stale entries (older than 30 minutes without heartbeat) are filtered out.
    """
    import redis  # noqa: PLC0415

    r = redis.from_url(settings.REDIS_URL, decode_responses=True)
    key = f"doc:editors:{file_id}"
    raw = r.hgetall(key)

    now = int(time.time())
    stale_threshold = 1800  # 30 minutes

    editors: list[dict[str, str]] = []
    stale_ids: list[str] = []

    for user_id, value in raw.items():
        parts = value.split("|", 1)
        user_name = parts[0] if len(parts) > 0 else "Unknown"
        joined_at = int(parts[1]) if len(parts) > 1 else 0

        if now - joined_at > stale_threshold:
            stale_ids.append(user_id)
            continue

        editors.append({
            "user_id": user_id,
            "user_name": user_name,
            "joined_at": str(joined_at),
        })

    # Cleanup stale entries
    if stale_ids:
        r.hdel(key, *stale_ids)

    return editors


def validate_callback(body: dict[str, Any]) -> dict[str, Any]:
    """Process a save callback from the ONLYOFFICE Document Server.

    ONLYOFFICE sends a callback with ``status`` codes:
    - 1  → document is being edited (no save needed)
    - 2  → document is ready for saving (``url`` contains the new file)
    - 3  → document saving error
    - 4  → document is closed with no changes
    - 6  → document is being edited but the current document state is saved
    - 7  → force-saving error

    Returns a normalized result dict:
    ``{"action": "save"|"ignore"|"error", "url": str|None, "status": int}``
    """
    status_code: int = body.get("status", 0)
    url: str | None = body.get("url")

    if status_code in (2, 6):
        return {"action": "save", "url": url, "status": status_code}
    if status_code in (3, 7):
        return {"action": "error", "url": None, "status": status_code}
    # 1 → editing in progress, 4 → closed without changes
    return {"action": "ignore", "url": None, "status": status_code}
