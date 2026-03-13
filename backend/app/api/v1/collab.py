"""Y&U Notes real-time collaboration: WebSocket Yjs sync, comments, and versions."""

import asyncio
import json
import logging
import uuid
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession
from app.core.security import decode_token

logger = logging.getLogger(__name__)
router = APIRouter()

# ── In-memory WebSocket connection registry ─────────────────────────────────
# { note_id: set of WebSocket connections }
_rooms: dict[str, set[WebSocket]] = defaultdict(set)
_room_users: dict[str, dict[str, dict]] = defaultdict(dict)  # note_id → {conn_id: user_info}


# ── WebSocket: Yjs document sync ─────────────────────────────────────────────

@router.websocket("/ws/{note_id}")
async def collab_ws(
    websocket: WebSocket,
    note_id: str,
    token: str = Query(...),
) -> None:
    """WebSocket endpoint for Yjs real-time collaboration on a note page.

    Protocol (binary frames):
    - On connect: server sends the current Y.Doc snapshot if it exists
    - Client sends binary Yjs update → server persists + broadcasts to room
    - Client sends JSON awareness update → server broadcasts to room

    JSON text frames are treated as awareness/presence messages and broadcast.
    Binary frames are treated as Yjs document updates and persisted.
    """
    # Authenticate via token query param
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001)
            return
    except Exception:
        await websocket.close(code=4001)
        return

    await websocket.accept()
    conn_id = str(uuid.uuid4())[:8]
    _rooms[note_id].add(websocket)
    _room_users[note_id][conn_id] = {"user_id": user_id, "conn_id": conn_id}

    # Send current snapshot to new client
    try:
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.note_collab import NoteCollabSnapshot  # noqa: PLC0415
        async with AsyncSessionLocal() as db:
            res = await db.execute(
                select(NoteCollabSnapshot).where(
                    NoteCollabSnapshot.note_id == uuid.UUID(note_id)
                )
            )
            snap = res.scalar_one_or_none()
            if snap and snap.snapshot:
                await websocket.send_bytes(snap.snapshot)
    except Exception:
        logger.exception("Failed to send snapshot to new collab client for note %s", note_id)

    # Broadcast updated presence to room
    await _broadcast_awareness(note_id, websocket, {"type": "join", "user_id": user_id, "conn_id": conn_id})

    try:
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive(), timeout=30.0)
            except asyncio.TimeoutError:
                # Send ping to keep alive
                await websocket.send_text(json.dumps({"type": "ping"}))
                continue

            if "bytes" in msg and msg["bytes"]:
                # Binary Yjs update → persist and broadcast
                update_data: bytes = msg["bytes"]
                await _handle_yjs_update(note_id, user_id, update_data)
                await _broadcast_bytes(note_id, websocket, update_data)
            elif "text" in msg and msg["text"]:
                # JSON awareness/presence → broadcast only, do not persist
                await _broadcast_text(note_id, websocket, msg["text"])

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("Collab WebSocket error for note %s", note_id)
    finally:
        _rooms[note_id].discard(websocket)
        _room_users[note_id].pop(conn_id, None)
        if not _rooms[note_id]:
            del _rooms[note_id]
        if not _room_users[note_id]:
            del _room_users[note_id]
        await _broadcast_awareness(note_id, websocket, {"type": "leave", "user_id": user_id, "conn_id": conn_id})


async def _handle_yjs_update(note_id: str, user_id: str, update_data: bytes) -> None:
    """Persist a Yjs update blob and refresh the snapshot."""
    try:
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.note_collab import NoteCollabSnapshot, NoteCollabUpdate  # noqa: PLC0415
        async with AsyncSessionLocal() as db:
            # Append update
            upd = NoteCollabUpdate(
                note_id=uuid.UUID(note_id),
                update_data=update_data,
                user_id=uuid.UUID(user_id) if user_id else None,
            )
            db.add(upd)

            # Update snapshot: for simplicity, latest update = new snapshot
            # (A full Yjs merge would require pycrdt; this is a relay-store approach)
            res = await db.execute(
                select(NoteCollabSnapshot).where(
                    NoteCollabSnapshot.note_id == uuid.UUID(note_id)
                )
            )
            snap = res.scalar_one_or_none()
            if snap:
                snap.snapshot = update_data
                snap.version += 1
                snap.updated_at = datetime.now(UTC)
            else:
                snap = NoteCollabSnapshot(
                    note_id=uuid.UUID(note_id),
                    snapshot=update_data,
                    version=1,
                )
                db.add(snap)
            await db.commit()
    except Exception:
        logger.exception("Failed to persist Yjs update for note %s", note_id)


async def _broadcast_bytes(note_id: str, sender: WebSocket, data: bytes) -> None:
    dead: list[WebSocket] = []
    for ws in list(_rooms.get(note_id, set())):
        if ws is sender:
            continue
        try:
            await ws.send_bytes(data)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _rooms[note_id].discard(ws)


async def _broadcast_text(note_id: str, sender: WebSocket, text: str) -> None:
    dead: list[WebSocket] = []
    for ws in list(_rooms.get(note_id, set())):
        if ws is sender:
            continue
        try:
            await ws.send_text(text)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _rooms[note_id].discard(ws)


async def _broadcast_awareness(note_id: str, sender: WebSocket, data: dict) -> None:
    text = json.dumps(data)
    dead: list[WebSocket] = []
    for ws in list(_rooms.get(note_id, set())):
        if ws is sender:
            continue
        try:
            await ws.send_text(text)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _rooms[note_id].discard(ws)


# ── REST: Presence ────────────────────────────────────────────────────────────

@router.get("/presence/{note_id}")
async def get_presence(note_id: str, user: CurrentUser) -> dict:
    """Return list of users currently editing a note."""
    users = list(_room_users.get(note_id, {}).values())
    return {"note_id": note_id, "active_users": users, "count": len(users)}


# ── REST: Comments ────────────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    content: str
    parent_comment_id: str | None = None
    anchor_block_id: str | None = None
    anchor_text: str | None = None


class CommentOut(BaseModel):
    id: str
    note_id: str
    parent_comment_id: str | None
    author_id: str
    author_name: str
    content: str
    anchor_block_id: str | None
    anchor_text: str | None
    is_resolved: bool
    created_at: str
    updated_at: str


@router.get("/comments/{note_id}", response_model=list[CommentOut])
async def list_comments(note_id: str, db: DBSession, user: CurrentUser) -> list[CommentOut]:
    from app.models.note_collab import NoteComment  # noqa: PLC0415
    from app.models.user import User  # noqa: PLC0415
    res = await db.execute(
        select(NoteComment).where(NoteComment.note_id == uuid.UUID(note_id))
        .order_by(NoteComment.created_at)
    )
    comments = res.scalars().all()
    result = []
    for c in comments:
        author = await db.get(User, c.author_id)
        result.append(CommentOut(
            id=str(c.id),
            note_id=str(c.note_id),
            parent_comment_id=str(c.parent_comment_id) if c.parent_comment_id else None,
            author_id=str(c.author_id),
            author_name=author.full_name if author else "Unknown",
            content=c.content,
            anchor_block_id=c.anchor_block_id,
            anchor_text=c.anchor_text,
            is_resolved=c.is_resolved,
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat(),
        ))
    return result


@router.post("/comments/{note_id}", response_model=CommentOut, status_code=201)
async def create_comment(note_id: str, body: CommentCreate, db: DBSession, user: CurrentUser) -> CommentOut:
    from app.models.note_collab import NoteComment  # noqa: PLC0415
    comment = NoteComment(
        note_id=uuid.UUID(note_id),
        author_id=user.id,
        content=body.content,
        parent_comment_id=uuid.UUID(body.parent_comment_id) if body.parent_comment_id else None,
        anchor_block_id=body.anchor_block_id,
        anchor_text=body.anchor_text,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return CommentOut(
        id=str(comment.id),
        note_id=str(comment.note_id),
        parent_comment_id=str(comment.parent_comment_id) if comment.parent_comment_id else None,
        author_id=str(comment.author_id),
        author_name=user.full_name,
        content=comment.content,
        anchor_block_id=comment.anchor_block_id,
        anchor_text=comment.anchor_text,
        is_resolved=comment.is_resolved,
        created_at=comment.created_at.isoformat(),
        updated_at=comment.updated_at.isoformat(),
    )


@router.patch("/comments/{note_id}/{comment_id}/resolve")
async def resolve_comment(note_id: str, comment_id: str, db: DBSession, user: CurrentUser) -> dict:
    from app.models.note_collab import NoteComment  # noqa: PLC0415
    c = await db.get(NoteComment, uuid.UUID(comment_id))
    if not c or str(c.note_id) != note_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    c.is_resolved = True
    c.resolved_by_id = user.id
    await db.commit()
    return {"ok": True}


@router.delete("/comments/{note_id}/{comment_id}", status_code=200)
async def delete_comment(note_id: str, comment_id: str, db: DBSession, user: CurrentUser) -> None:
    from app.models.note_collab import NoteComment  # noqa: PLC0415
    c = await db.get(NoteComment, uuid.UUID(comment_id))
    if not c or str(c.note_id) != note_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    if str(c.author_id) != str(user.id) and not user.is_superadmin:
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.delete(c)
    await db.commit()


# ── REST: Versions ────────────────────────────────────────────────────────────

class VersionOut(BaseModel):
    id: str
    note_id: str
    version_number: int
    label: str | None
    word_count: int
    created_by_id: str | None
    created_by_name: str | None
    created_at: str


@router.get("/versions/{note_id}", response_model=list[VersionOut])
async def list_versions(note_id: str, db: DBSession, user: CurrentUser) -> list[VersionOut]:
    from app.models.note_collab import NoteVersion  # noqa: PLC0415
    from app.models.user import User  # noqa: PLC0415
    res = await db.execute(
        select(NoteVersion).where(NoteVersion.note_id == uuid.UUID(note_id))
        .order_by(NoteVersion.version_number.desc())
        .limit(50)
    )
    versions = res.scalars().all()
    result = []
    for v in versions:
        author = await db.get(User, v.created_by_id) if v.created_by_id else None
        result.append(VersionOut(
            id=str(v.id),
            note_id=str(v.note_id),
            version_number=v.version_number,
            label=v.label,
            word_count=v.word_count,
            created_by_id=str(v.created_by_id) if v.created_by_id else None,
            created_by_name=author.full_name if author else None,
            created_at=v.created_at.isoformat(),
        ))
    return result


class VersionCreate(BaseModel):
    label: str | None = None


@router.post("/versions/{note_id}", response_model=VersionOut, status_code=201)
async def create_version(note_id: str, body: VersionCreate, db: DBSession, user: CurrentUser) -> VersionOut:
    from app.models.notes import Note  # noqa: PLC0415
    from app.models.note_collab import NoteVersion  # noqa: PLC0415
    import re  # noqa: PLC0415
    note = await db.get(Note, uuid.UUID(note_id))
    if not note or str(note.owner_id) != str(user.id):
        raise HTTPException(status_code=404, detail="Note not found")
    # Count words
    text = re.sub(r"<[^>]+>", "", note.content or "")
    word_count = len(text.split())
    # Get next version number
    res = await db.execute(
        select(func.max(NoteVersion.version_number)).where(NoteVersion.note_id == uuid.UUID(note_id))
    )
    max_ver = res.scalar() or 0
    version = NoteVersion(
        note_id=uuid.UUID(note_id),
        version_number=max_ver + 1,
        content_snapshot=note.content or "",
        created_by_id=user.id,
        label=body.label,
        word_count=word_count,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)
    return VersionOut(
        id=str(version.id),
        note_id=str(version.note_id),
        version_number=version.version_number,
        label=version.label,
        word_count=version.word_count,
        created_by_id=str(version.created_by_id) if version.created_by_id else None,
        created_by_name=user.full_name,
        created_at=version.created_at.isoformat(),
    )


@router.post("/versions/{note_id}/{version_id}/restore", status_code=200)
async def restore_version(note_id: str, version_id: str, db: DBSession, user: CurrentUser) -> dict:
    from app.models.notes import Note  # noqa: PLC0415
    from app.models.note_collab import NoteVersion  # noqa: PLC0415
    note = await db.get(Note, uuid.UUID(note_id))
    if not note or str(note.owner_id) != str(user.id):
        raise HTTPException(status_code=404, detail="Note not found")
    version = await db.get(NoteVersion, uuid.UUID(version_id))
    if not version or str(version.note_id) != note_id:
        raise HTTPException(status_code=404, detail="Version not found")
    note.content = version.content_snapshot
    note.updated_at = datetime.now(UTC)
    await db.commit()
    return {"ok": True, "restored_version": version.version_number}
