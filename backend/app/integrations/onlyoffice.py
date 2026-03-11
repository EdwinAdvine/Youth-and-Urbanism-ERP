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
        },
        "token": "",  # filled below
    }

    # Sign the entire config
    config["token"] = _sign(config)
    return config


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
