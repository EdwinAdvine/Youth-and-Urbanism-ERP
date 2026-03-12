"""Support Live Chat API — sessions, messages, and WebSocket real-time messaging."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.support_phase1 import LiveChatMessage, LiveChatSession

router = APIRouter()


# ── WebSocket connection manager ──────────────────────────────────────────────

class ChatConnectionManager:
    """Manages WebSocket connections for live chat sessions."""

    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, session_id: str, ws: WebSocket):
        await ws.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(ws)

    def disconnect(self, session_id: str, ws: WebSocket):
        if session_id in self.active_connections:
            self.active_connections[session_id].remove(ws)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            for ws in self.active_connections[session_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    pass


chat_manager = ChatConnectionManager()


# ── Schemas ───────────────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    subject: str | None = None
    customer_email: str | None = None
    customer_name: str | None = None
    channel: str = "web_chat"
    metadata_json: dict | None = None


class SessionOut(BaseModel):
    id: uuid.UUID
    visitor_id: uuid.UUID | None
    contact_id: uuid.UUID | None
    agent_id: uuid.UUID | None
    agent_name: str | None = None
    channel: str
    status: str
    subject: str | None
    started_at: Any
    ended_at: Any | None
    ticket_id: uuid.UUID | None
    customer_email: str | None
    customer_name: str | None
    message_count: int = 0
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    sender_type: str
    sender_id: uuid.UUID | None
    content: str
    content_type: str
    attachments: list | None
    created_at: Any

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    content: str
    content_type: str = "text"
    attachments: list | None = None


class AssignAgentPayload(BaseModel):
    agent_id: uuid.UUID


class TransferPayload(BaseModel):
    new_agent_id: uuid.UUID
    reason: str | None = None


def _session_out(s: LiveChatSession) -> dict:
    d = SessionOut.model_validate(s).model_dump()
    d["agent_name"] = s.agent.full_name if s.agent else None
    d["message_count"] = len(s.messages) if s.messages else 0
    return d


# ── REST Endpoints ────────────────────────────────────────────────────────────

@router.get("/live-chat/sessions", summary="List chat sessions")
async def list_sessions(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    filters = []
    if status_filter:
        filters.append(LiveChatSession.status == status_filter)

    count_q = select(func.count()).select_from(LiveChatSession)
    if filters:
        count_q = count_q.where(and_(*filters))
    total = (await db.execute(count_q)).scalar() or 0

    q = (
        select(LiveChatSession)
        .options(selectinload(LiveChatSession.messages))
        .order_by(LiveChatSession.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    if filters:
        q = q.where(and_(*filters))
    result = await db.execute(q)
    sessions = result.scalars().all()

    return {
        "total": total,
        "sessions": [_session_out(s) for s in sessions],
    }


@router.post("/live-chat/sessions", status_code=201, summary="Start a new chat session")
async def create_session(
    payload: SessionCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    session = LiveChatSession(
        visitor_id=current_user.id,
        channel=payload.channel,
        subject=payload.subject,
        customer_email=payload.customer_email,
        customer_name=payload.customer_name,
        metadata_json=payload.metadata_json or {},
    )
    db.add(session)
    await db.commit()

    # Re-fetch with relationships
    result = await db.execute(
        select(LiveChatSession)
        .where(LiveChatSession.id == session.id)
        .options(selectinload(LiveChatSession.messages))
    )
    session = result.scalar_one()

    # Notify agents a chat is queued
    await event_bus.publish("support.livechat.queued", {
        "session_id": str(session.id),
        "customer_name": payload.customer_name or "",
        "subject": payload.subject or "",
    })

    return _session_out(session)


@router.get("/live-chat/sessions/{session_id}", summary="Get chat session with messages")
async def get_session(
    session_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(LiveChatSession)
        .where(LiveChatSession.id == session_id)
        .options(selectinload(LiveChatSession.messages))
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    d = _session_out(session)
    d["messages"] = [MessageOut.model_validate(m).model_dump() for m in session.messages]
    return d


@router.post("/live-chat/sessions/{session_id}/messages", status_code=201, summary="Send message (REST)")
async def send_message(
    session_id: uuid.UUID,
    payload: MessageCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    session = await db.get(LiveChatSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    if session.status == "closed":
        raise HTTPException(status_code=400, detail="Chat session is closed")

    # Determine sender type
    sender_type = "agent" if session.agent_id == current_user.id else "visitor"

    msg = LiveChatMessage(
        session_id=session_id,
        sender_type=sender_type,
        sender_id=current_user.id,
        content=payload.content,
        content_type=payload.content_type,
        attachments=payload.attachments or [],
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    # Broadcast to WebSocket clients
    msg_data = MessageOut.model_validate(msg).model_dump()
    # Convert UUIDs to strings for JSON serialization
    msg_data = {k: str(v) if isinstance(v, uuid.UUID) else v for k, v in msg_data.items()}
    await chat_manager.broadcast(str(session_id), {
        "type": "message",
        "data": msg_data,
    })

    return MessageOut.model_validate(msg).model_dump()


@router.post("/live-chat/sessions/{session_id}/assign", summary="Assign agent to chat")
async def assign_agent(
    session_id: uuid.UUID,
    payload: AssignAgentPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    session = await db.get(LiveChatSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    session.agent_id = payload.agent_id
    session.status = "active"
    await db.commit()

    # Re-fetch
    result = await db.execute(
        select(LiveChatSession)
        .where(LiveChatSession.id == session.id)
        .options(selectinload(LiveChatSession.messages))
    )
    session = result.scalar_one()

    # Add system message
    sys_msg = LiveChatMessage(
        session_id=session_id,
        sender_type="system",
        content=f"Agent {session.agent.full_name if session.agent else 'unknown'} joined the chat.",
        content_type="system",
    )
    db.add(sys_msg)
    await db.commit()

    await chat_manager.broadcast(str(session_id), {
        "type": "agent_joined",
        "agent_name": session.agent.full_name if session.agent else None,
    })

    return _session_out(session)


@router.post("/live-chat/sessions/{session_id}/transfer", summary="Transfer chat to another agent")
async def transfer_session(
    session_id: uuid.UUID,
    payload: TransferPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    session = await db.get(LiveChatSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    old_agent_name = session.agent.full_name if session.agent else "unknown"
    session.agent_id = payload.new_agent_id
    await db.commit()

    result = await db.execute(
        select(LiveChatSession)
        .where(LiveChatSession.id == session.id)
        .options(selectinload(LiveChatSession.messages))
    )
    session = result.scalar_one()

    new_agent_name = session.agent.full_name if session.agent else "unknown"
    reason_text = f" Reason: {payload.reason}" if payload.reason else ""

    sys_msg = LiveChatMessage(
        session_id=session_id,
        sender_type="system",
        content=f"Chat transferred from {old_agent_name} to {new_agent_name}.{reason_text}",
        content_type="system",
    )
    db.add(sys_msg)
    await db.commit()

    await chat_manager.broadcast(str(session_id), {
        "type": "transferred",
        "new_agent_name": new_agent_name,
    })

    return _session_out(session)


@router.post("/live-chat/sessions/{session_id}/close", summary="Close chat session")
async def close_session(
    session_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    session = await db.get(LiveChatSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    session.status = "closed"
    session.ended_at = datetime.now(timezone.utc)
    await db.commit()

    sys_msg = LiveChatMessage(
        session_id=session_id,
        sender_type="system",
        content="Chat session ended.",
        content_type="system",
    )
    db.add(sys_msg)
    await db.commit()

    await chat_manager.broadcast(str(session_id), {"type": "closed"})

    # Publish event for potential auto-ticket creation
    await event_bus.publish("support.livechat.ended", {
        "session_id": str(session_id),
        "agent_id": str(session.agent_id) if session.agent_id else "",
        "customer_email": session.customer_email or "",
    })

    result = await db.execute(
        select(LiveChatSession)
        .where(LiveChatSession.id == session.id)
        .options(selectinload(LiveChatSession.messages))
    )
    session = result.scalar_one()
    return _session_out(session)


@router.post("/live-chat/sessions/{session_id}/convert-to-ticket", summary="Create ticket from chat")
async def convert_to_ticket(
    session_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Convert a chat session into a support ticket with the chat transcript as description."""
    result = await db.execute(
        select(LiveChatSession)
        .where(LiveChatSession.id == session_id)
        .options(selectinload(LiveChatSession.messages))
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    if session.ticket_id:
        raise HTTPException(status_code=400, detail="Session already linked to a ticket")

    # Build transcript
    lines = []
    for msg in session.messages or []:
        sender = msg.sender_type.capitalize()
        lines.append(f"[{sender}] {msg.content}")
    transcript = "\n".join(lines)

    from app.api.v1.support import TicketCreate, create_ticket

    payload = TicketCreate(
        subject=session.subject or "Live chat conversation",
        description=f"--- Chat Transcript ---\n{transcript}",
        priority="medium",
        customer_email=session.customer_email,
        customer_name=session.customer_name,
        assigned_to=session.agent_id,
    )

    ticket_data = await create_ticket(payload, current_user, db)

    # Link session to ticket
    session.ticket_id = uuid.UUID(str(ticket_data["id"]))
    await db.commit()

    return {
        "session_id": str(session_id),
        "ticket": ticket_data,
    }


# ── WebSocket ─────────────────────────────────────────────────────────────────

@router.websocket("/live-chat/ws/{session_id}")
async def chat_websocket(
    websocket: WebSocket,
    session_id: str,
):
    """Real-time chat WebSocket. Clients send/receive messages in JSON format.

    Send: {"type": "message", "content": "Hello", "sender_type": "visitor|agent", "sender_id": "..."}
    Send: {"type": "typing"}
    Receive: {"type": "message", "data": {...}}
    Receive: {"type": "typing", "sender_type": "...", "sender_id": "..."}
    """
    await chat_manager.connect(session_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "typing":
                await chat_manager.broadcast(session_id, {
                    "type": "typing",
                    "sender_type": data.get("sender_type", "visitor"),
                    "sender_id": data.get("sender_id"),
                })

            elif msg_type == "message":
                # Persist message to DB
                from app.core.database import AsyncSessionLocal

                async with AsyncSessionLocal() as db:
                    msg = LiveChatMessage(
                        session_id=uuid.UUID(session_id),
                        sender_type=data.get("sender_type", "visitor"),
                        sender_id=uuid.UUID(data["sender_id"]) if data.get("sender_id") else None,
                        content=data.get("content", ""),
                        content_type=data.get("content_type", "text"),
                        attachments=data.get("attachments", []),
                    )
                    db.add(msg)
                    await db.commit()
                    await db.refresh(msg)

                    msg_out = MessageOut.model_validate(msg).model_dump()
                    msg_out = {k: str(v) if isinstance(v, uuid.UUID) else v for k, v in msg_out.items()}

                await chat_manager.broadcast(session_id, {
                    "type": "message",
                    "data": msg_out,
                })

    except WebSocketDisconnect:
        chat_manager.disconnect(session_id, websocket)
    except Exception:
        chat_manager.disconnect(session_id, websocket)
