from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser
from app.core.security import decode_token
from app.models.ai import AIChatHistory
from app.models.user import User
from app.schemas.ai import (
    ChatHistoryItem,
    ChatMessage,
    ChatResponse,
)
from app.services.ai import AIService

router = APIRouter()


# ── REST chat ─────────────────────────────────────────────────────────────────
@router.post("/chat", response_model=ChatResponse, summary="Send a chat message to the AI")
async def chat(
    payload: ChatMessage,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    session_id = payload.session_id or str(uuid.uuid4())
    svc = AIService(db)

    # Build message list: inject context if provided
    messages: list[dict[str, str]] = []
    if payload.context:
        messages.append({
            "role": "system",
            "content": f"Context: {json.dumps(payload.context)}",
        })
    messages.append({"role": "user", "content": payload.message})

    reply, provider, model = await svc.chat(messages, current_user.id, session_id)
    return ChatResponse(reply=reply, session_id=session_id, provider=provider, model=model)


# ── Chat history ──────────────────────────────────────────────────────────────
@router.get(
    "/history/{session_id}",
    response_model=list[ChatHistoryItem],
    summary="Get chat history for a session",
)
async def get_history(
    session_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> list[ChatHistoryItem]:
    svc = AIService(db)
    history = await svc.get_session_history(current_user.id, session_id)
    return [ChatHistoryItem.model_validate(h) for h in history]


@router.get(
    "/sessions",
    response_model=list[str],
    summary="List session IDs for current user",
)
async def list_sessions(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> list[str]:
    result = await db.execute(
        select(AIChatHistory.session_id)
        .where(AIChatHistory.user_id == current_user.id)
        .distinct()
        .order_by(AIChatHistory.session_id)
    )
    return [row[0] for row in result.all()]


# ── WebSocket streaming ───────────────────────────────────────────────────────
@router.websocket("/ws/chat/{session_id}")
async def websocket_chat(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(""),
) -> None:
    """
    WebSocket endpoint for streaming AI responses.

    Authentication: JWT passed via ?token= query parameter.
    Protocol:
      Client sends: {"message": "...", "context": {...}}
      Server streams: {"type": "delta", "delta": "..."} chunks,
                      then {"type": "done", "done": true, "provider": ..., "model": ...}
      On error:       {"type": "error", "error": "..."}
    Connection stays open for multiple messages.
    """
    # ── Authenticate from query param ─────────────────────────────────────────
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise ValueError("Not an access token")
        user_id_str: str = payload["sub"]
    except (JWTError, ValueError, KeyError):
        await websocket.close(code=4001, reason="Unauthorized")
        return

    from app.core.database import AsyncSessionLocal  # noqa: PLC0415

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id_str))
        user = result.scalar_one_or_none()
        if user is None or not user.is_active:
            await websocket.close(code=4001, reason="User not found or inactive")
            return

        await websocket.accept()

        # ── Message loop ──────────────────────────────────────────────────────
        try:
            while True:
                raw = await websocket.receive_text()
                try:
                    data: dict[str, Any] = json.loads(raw)
                except json.JSONDecodeError:
                    await websocket.send_json({"type": "error", "error": "Invalid JSON"})
                    continue

                message_text: str = data.get("message") or data.get("content", "")
                context: dict[str, Any] | None = data.get("context") or (
                    data.get("metadata", {}) or {}
                ).get("context")

                if not message_text:
                    await websocket.send_json({"type": "error", "error": "Empty message"})
                    continue

                messages: list[dict[str, str]] = []
                if context:
                    messages.append({"role": "system", "content": f"Context: {json.dumps(context)}"})
                messages.append({"role": "user", "content": message_text})

                svc = AIService(db, user=user)
                provider_used = "ollama"
                model_used = ""
                try:
                    config = await svc.get_active_config()
                    if config:
                        provider_used = config.provider
                        model_used = config.model_name

                    async for chunk in svc.stream_chat(messages, user.id, session_id):
                        await websocket.send_json({"type": "delta", "delta": chunk})

                    await websocket.send_json({
                        "type": "done",
                        "done": True,
                        "provider": provider_used,
                        "model": model_used,
                    })
                except Exception as exc:
                    try:
                        await websocket.send_json({"type": "error", "error": str(exc)})
                    except Exception:
                        pass
        except WebSocketDisconnect:
            pass
        finally:
            try:
                await websocket.close()
            except Exception:
                pass
