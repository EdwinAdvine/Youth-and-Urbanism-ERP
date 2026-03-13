"""WebSocket authentication helper."""
from __future__ import annotations
from fastapi import WebSocket
from jose import JWTError
from app.core.security import decode_token
from app.core.config import settings

async def validate_ws_token(websocket: WebSocket, token: str) -> dict | None:
    """Validate a JWT token for a WebSocket connection.
    Returns decoded payload or None. Caller should close with code 4001 on None."""
    # Origin check
    origin = websocket.headers.get("origin", "")
    allowed = [str(o).rstrip("/") for o in settings.CORS_ORIGINS]
    if origin and origin.rstrip("/") not in allowed:
        await websocket.close(code=4003, reason="Origin not allowed")
        return None
    try:
        payload = decode_token(token)
        if payload.get("type") != "access" or not payload.get("sub"):
            await websocket.close(code=4001, reason="Invalid token")
            return None
        return payload
    except JWTError:
        await websocket.close(code=4001, reason="Invalid token")
        return None
