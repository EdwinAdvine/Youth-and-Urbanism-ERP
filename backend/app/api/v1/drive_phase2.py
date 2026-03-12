"""Phase 2 + 3 Drive endpoints: File Requests, Webhooks, API Keys, Templates, Vault, DLP,
Comment @mentions, Presence WebSocket, Sharing Analytics, Point-in-Time Restore, eDiscovery."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy import and_, delete, func, select, update
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession, SuperAdminUser
from app.models.drive import (
    DriveFile,
    DriveFolder,
    DriveSnapshot,
    FileAccessLog,
    FileComment,
    SensitivityLabel,
)
from app.models.drive_phase2 import (
    DlpRule,
    DlpViolation,
    DocumentTemplate,
    DriveApiKey,
    DriveWebhook,
    FileRequest,
    FileRequestSubmission,
    PersonalVault,
    WebhookDelivery,
)
from app.models.file_share import FileShare, ShareAuditLog

logger = logging.getLogger(__name__)
router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2: COMMENT @MENTIONS
# ══════════════════════════════════════════════════════════════════════════════


MENTION_REGEX = re.compile(r"@(\w+)")


class CommentCreate(BaseModel):
    content: str
    parent_id: str | None = None


class CommentResponse(BaseModel):
    id: str
    file_id: str
    user_id: str
    content: str
    parent_id: str | None
    is_resolved: bool
    created_at: str
    replies: list[dict] = []


@router.post("/files/{file_id}/comments")
async def create_comment_with_mentions(
    file_id: str,
    body: CommentCreate,
    db: DBSession,
    user: CurrentUser,
) -> dict:
    """Create a comment with @mention parsing and notification trigger."""
    comment = FileComment(
        file_id=uuid.UUID(file_id),
        user_id=user.id,
        content=body.content,
        parent_id=uuid.UUID(body.parent_id) if body.parent_id else None,
    )
    db.add(comment)
    await db.flush()

    # Parse @mentions and create notifications
    mentions = MENTION_REGEX.findall(body.content)
    if mentions:
        from app.models.user import User
        for username in set(mentions):
            result = await db.execute(select(User).where(User.username == username))
            mentioned_user = result.scalar_one_or_none()
            if mentioned_user and mentioned_user.id != user.id:
                # Try to create notification if model exists
                try:
                    from app.models.notification import Notification
                    notif = Notification(
                        user_id=mentioned_user.id,
                        title=f"You were mentioned in a comment",
                        message=f"{user.full_name or user.username} mentioned you on a file",
                        type="drive_mention",
                        link=f"/drive?file={file_id}",
                    )
                    db.add(notif)
                except ImportError:
                    pass

    await db.commit()
    return {"id": str(comment.id), "status": "created", "mentions": mentions}


@router.put("/comments/{comment_id}/resolve")
async def resolve_comment(
    comment_id: str,
    db: DBSession,
    user: CurrentUser,
) -> dict:
    """Mark a comment thread as resolved."""
    await db.execute(
        update(FileComment)
        .where(FileComment.id == uuid.UUID(comment_id))
        .values(is_resolved=True)
    )
    await db.commit()
    return {"status": "resolved"}


@router.get("/files/{file_id}/comments/threaded")
async def get_threaded_comments(
    file_id: str,
    db: DBSession,
    user: CurrentUser,
) -> dict:
    """Get all comments for a file organized as threads."""
    result = await db.execute(
        select(FileComment)
        .where(FileComment.file_id == uuid.UUID(file_id))
        .options(selectinload(FileComment.user), selectinload(FileComment.replies))
        .order_by(FileComment.created_at)
    )
    comments = result.scalars().all()

    # Build thread structure — top-level comments only
    threads = []
    for c in comments:
        if c.parent_id is None:
            threads.append({
                "id": str(c.id),
                "user_id": str(c.user_id),
                "user_name": c.user.full_name if hasattr(c.user, "full_name") else str(c.user_id),
                "content": c.content,
                "is_resolved": c.is_resolved,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "replies": [
                    {
                        "id": str(r.id),
                        "user_id": str(r.user_id),
                        "content": r.content,
                        "created_at": r.created_at.isoformat() if r.created_at else None,
                    }
                    for r in sorted(c.replies, key=lambda x: x.created_at)
                ],
            })
    return {"threads": threads, "total": len(threads)}


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2: REAL-TIME FILE PRESENCE (WebSocket)
# ══════════════════════════════════════════════════════════════════════════════


# In-memory presence map: {file_id: {user_id: {name, connected_at}}}
_file_presence: dict[str, dict[str, dict]] = {}


@router.websocket("/ws/file/{file_id}/presence")
async def file_presence_ws(websocket: WebSocket, file_id: str):
    """WebSocket for real-time file presence tracking."""
    await websocket.accept()
    user_id = None

    try:
        # First message should contain auth info
        init = await websocket.receive_json()
        user_id = init.get("user_id", str(uuid.uuid4()))
        user_name = init.get("user_name", "Anonymous")

        if file_id not in _file_presence:
            _file_presence[file_id] = {}

        _file_presence[file_id][user_id] = {
            "name": user_name,
            "connected_at": datetime.now(timezone.utc).isoformat(),
        }

        # Broadcast updated presence to all connected clients
        await websocket.send_json({
            "type": "presence_update",
            "users": list(_file_presence.get(file_id, {}).values()),
        })

        # Keep connection alive
        while True:
            msg = await websocket.receive_json()
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif msg.get("type") == "cursor":
                # Broadcast cursor position to other viewers
                pass

    except WebSocketDisconnect:
        pass
    finally:
        if user_id and file_id in _file_presence:
            _file_presence[file_id].pop(user_id, None)
            if not _file_presence[file_id]:
                del _file_presence[file_id]


@router.get("/files/{file_id}/presence")
async def get_file_presence(file_id: str, user: CurrentUser) -> dict:
    """Get who is currently viewing/editing a file."""
    return {"file_id": file_id, "users": list(_file_presence.get(file_id, {}).values())}


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2: FILE REQUESTS
# ══════════════════════════════════════════════════════════════════════════════


class FileRequestCreate(BaseModel):
    title: str
    description: str | None = None
    deadline: str | None = None
    required_types: list[str] | None = None
    max_file_size: int | None = None
    max_files: int | None = None
    folder_id: str | None = None
    branding_json: dict | None = None


@router.post("/file-requests")
async def create_file_request(
    body: FileRequestCreate,
    db: DBSession,
    user: CurrentUser,
) -> dict:
    """Create a file request with a public upload link."""
    token = secrets.token_urlsafe(32)
    req = FileRequest(
        title=body.title,
        description=body.description,
        deadline=datetime.fromisoformat(body.deadline) if body.deadline else None,
        required_types=body.required_types,
        max_file_size=body.max_file_size,
        max_files=body.max_files,
        folder_id=uuid.UUID(body.folder_id) if body.folder_id else None,
        created_by=user.id,
        token=token,
        branding_json=body.branding_json,
    )
    db.add(req)
    await db.commit()
    return {
        "id": str(req.id),
        "token": token,
        "upload_url": f"/drive/file-requests/{token}/upload",
        "status": "created",
    }


@router.get("/file-requests")
async def list_file_requests(
    db: DBSession,
    user: CurrentUser,
) -> dict:
    """List all file requests created by the current user."""
    result = await db.execute(
        select(FileRequest)
        .where(FileRequest.created_by == user.id)
        .options(selectinload(FileRequest.submissions))
        .order_by(FileRequest.created_at.desc())
    )
    requests = result.scalars().all()
    return {
        "requests": [
            {
                "id": str(r.id),
                "title": r.title,
                "description": r.description,
                "deadline": r.deadline.isoformat() if r.deadline else None,
                "token": r.token,
                "is_active": r.is_active,
                "submission_count": len(r.submissions),
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in requests
        ]
    }


@router.get("/file-requests/{token}/info")
async def get_file_request_info(token: str, db: DBSession) -> dict:
    """Public endpoint to get file request details (no auth required)."""
    result = await db.execute(
        select(FileRequest).where(FileRequest.token == token, FileRequest.is_active == True)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(404, "File request not found or inactive")
    if req.deadline and req.deadline < datetime.now(timezone.utc):
        raise HTTPException(410, "This file request has expired")
    return {
        "title": req.title,
        "description": req.description,
        "deadline": req.deadline.isoformat() if req.deadline else None,
        "required_types": req.required_types,
        "max_file_size": req.max_file_size,
        "max_files": req.max_files,
        "branding": req.branding_json,
    }


@router.delete("/file-requests/{request_id}")
async def deactivate_file_request(
    request_id: str,
    db: DBSession,
    user: CurrentUser,
) -> dict:
    """Deactivate a file request."""
    await db.execute(
        update(FileRequest)
        .where(FileRequest.id == uuid.UUID(request_id), FileRequest.created_by == user.id)
        .values(is_active=False)
    )
    await db.commit()
    return {"status": "deactivated"}


@router.get("/file-requests/{request_id}/submissions")
async def list_submissions(
    request_id: str,
    db: DBSession,
    user: CurrentUser,
) -> dict:
    """List all submissions for a file request."""
    result = await db.execute(
        select(FileRequestSubmission)
        .where(FileRequestSubmission.request_id == uuid.UUID(request_id))
        .options(selectinload(FileRequestSubmission.file))
        .order_by(FileRequestSubmission.created_at.desc())
    )
    subs = result.scalars().all()
    return {
        "submissions": [
            {
                "id": str(s.id),
                "file_name": s.file.name if s.file else None,
                "file_size": s.file.size if s.file else None,
                "submitted_by_name": s.submitted_by_name,
                "submitted_by_email": s.submitted_by_email,
                "status": s.status,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in subs
        ]
    }


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2: SHARING ANALYTICS
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/sharing-analytics")
async def sharing_analytics(
    db: DBSession,
    user: CurrentUser,
    days: int = Query(30, ge=1, le=365),
) -> dict:
    """Sharing analytics: access heatmap, download trends, top shared files."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Total shares
    total_shares = await db.scalar(
        select(func.count()).select_from(FileShare).where(FileShare.shared_by_user_id == user.id)
    ) or 0

    # Active links
    active_links = await db.scalar(
        select(func.count()).select_from(FileShare).where(
            FileShare.shared_by_user_id == user.id,
            FileShare.share_link.isnot(None),
            (FileShare.expires_at.is_(None) | (FileShare.expires_at > datetime.now(timezone.utc))),
        )
    ) or 0

    # Download counts
    total_downloads = await db.scalar(
        select(func.sum(FileShare.download_count)).where(FileShare.shared_by_user_id == user.id)
    ) or 0

    # Share audit log stats
    audit_result = await db.execute(
        select(ShareAuditLog.action, func.count())
        .where(ShareAuditLog.timestamp >= since)
        .group_by(ShareAuditLog.action)
    )
    action_breakdown = {row[0]: row[1] for row in audit_result.all()}

    # External vs internal shares
    external_shares = await db.scalar(
        select(func.count()).select_from(FileShare).where(
            FileShare.shared_by_user_id == user.id,
            FileShare.link_scope == "anyone",
        )
    ) or 0
    internal_shares = total_shares - external_shares

    # Top accessed files (via access log)
    top_files_result = await db.execute(
        select(FileAccessLog.file_id, func.count().label("count"))
        .where(
            FileAccessLog.user_id == user.id,
            FileAccessLog.action.in_(["download", "share"]),
            FileAccessLog.timestamp >= since,
        )
        .group_by(FileAccessLog.file_id)
        .order_by(func.count().desc())
        .limit(10)
    )
    top_file_ids = [str(row[0]) for row in top_files_result.all() if row[0]]

    return {
        "period_days": days,
        "total_shares": total_shares,
        "active_links": active_links,
        "total_downloads": total_downloads,
        "action_breakdown": action_breakdown,
        "external_shares": external_shares,
        "internal_shares": internal_shares,
        "top_shared_file_ids": top_file_ids,
    }


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3: WEBHOOKS
# ══════════════════════════════════════════════════════════════════════════════


class WebhookCreate(BaseModel):
    url: str
    events: list[str]
    secret: str | None = None


@router.post("/webhooks")
async def create_webhook(body: WebhookCreate, db: DBSession, user: CurrentUser) -> dict:
    """Register a webhook for Drive events."""
    hook = DriveWebhook(
        url=body.url,
        events=body.events,
        secret=body.secret,
        owner_id=user.id,
    )
    db.add(hook)
    await db.commit()
    return {"id": str(hook.id), "url": hook.url, "events": hook.events}


@router.get("/webhooks")
async def list_webhooks(db: DBSession, user: CurrentUser) -> dict:
    """List all webhooks for the current user."""
    result = await db.execute(
        select(DriveWebhook).where(DriveWebhook.owner_id == user.id).order_by(DriveWebhook.created_at.desc())
    )
    hooks = result.scalars().all()
    return {
        "webhooks": [
            {
                "id": str(h.id),
                "url": h.url,
                "events": h.events,
                "is_active": h.is_active,
                "failure_count": h.failure_count,
                "last_triggered_at": h.last_triggered_at.isoformat() if h.last_triggered_at else None,
            }
            for h in hooks
        ]
    }


@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str, db: DBSession, user: CurrentUser) -> dict:
    await db.execute(
        delete(DriveWebhook).where(DriveWebhook.id == uuid.UUID(webhook_id), DriveWebhook.owner_id == user.id)
    )
    await db.commit()
    return {"status": "deleted"}


@router.get("/webhooks/{webhook_id}/deliveries")
async def list_webhook_deliveries(webhook_id: str, db: DBSession, user: CurrentUser) -> dict:
    """List recent delivery attempts for a webhook."""
    result = await db.execute(
        select(WebhookDelivery)
        .where(WebhookDelivery.webhook_id == uuid.UUID(webhook_id))
        .order_by(WebhookDelivery.delivered_at.desc())
        .limit(50)
    )
    deliveries = result.scalars().all()
    return {
        "deliveries": [
            {
                "id": str(d.id),
                "event": d.event,
                "success": d.success,
                "response_status": d.response_status,
                "delivered_at": d.delivered_at.isoformat(),
            }
            for d in deliveries
        ]
    }


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3: API KEYS
# ══════════════════════════════════════════════════════════════════════════════


class ApiKeyCreate(BaseModel):
    name: str
    scopes: list[str] = Field(default_factory=lambda: ["read"])
    expires_in_days: int | None = None


@router.post("/api-keys")
async def create_api_key(body: ApiKeyCreate, db: DBSession, user: CurrentUser) -> dict:
    """Generate a new API key. The raw key is only shown once."""
    raw_key = f"yudrv_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

    key = DriveApiKey(
        name=body.name,
        key_hash=key_hash,
        key_prefix=raw_key[:8],
        user_id=user.id,
        scopes=body.scopes,
        expires_at=(datetime.now(timezone.utc) + timedelta(days=body.expires_in_days)) if body.expires_in_days else None,
    )
    db.add(key)
    await db.commit()
    return {
        "id": str(key.id),
        "name": key.name,
        "key": raw_key,  # Only returned once!
        "prefix": key.key_prefix,
        "scopes": key.scopes,
        "expires_at": key.expires_at.isoformat() if key.expires_at else None,
    }


@router.get("/api-keys")
async def list_api_keys(db: DBSession, user: CurrentUser) -> dict:
    result = await db.execute(
        select(DriveApiKey).where(DriveApiKey.user_id == user.id).order_by(DriveApiKey.created_at.desc())
    )
    keys = result.scalars().all()
    return {
        "keys": [
            {
                "id": str(k.id),
                "name": k.name,
                "prefix": k.key_prefix,
                "scopes": k.scopes,
                "is_active": k.is_active,
                "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
                "expires_at": k.expires_at.isoformat() if k.expires_at else None,
            }
            for k in keys
        ]
    }


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(key_id: str, db: DBSession, user: CurrentUser) -> dict:
    await db.execute(
        update(DriveApiKey)
        .where(DriveApiKey.id == uuid.UUID(key_id), DriveApiKey.user_id == user.id)
        .values(is_active=False)
    )
    await db.commit()
    return {"status": "revoked"}


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3: DOCUMENT TEMPLATES
# ══════════════════════════════════════════════════════════════════════════════


class TemplateCreate(BaseModel):
    name: str
    description: str | None = None
    content_type: str
    minio_key: str
    category: str | None = None
    variables_json: list | None = None
    is_public: bool = False


@router.post("/templates")
async def create_template(body: TemplateCreate, db: DBSession, user: CurrentUser) -> dict:
    tpl = DocumentTemplate(
        name=body.name,
        description=body.description,
        content_type=body.content_type,
        minio_key=body.minio_key,
        category=body.category,
        variables_json=body.variables_json,
        is_public=body.is_public,
        created_by=user.id,
    )
    db.add(tpl)
    await db.commit()
    return {"id": str(tpl.id), "name": tpl.name}


@router.get("/templates")
async def list_templates(
    db: DBSession,
    user: CurrentUser,
    category: str | None = None,
) -> dict:
    q = select(DocumentTemplate).where(
        (DocumentTemplate.is_public == True) | (DocumentTemplate.created_by == user.id)
    )
    if category:
        q = q.where(DocumentTemplate.category == category)
    q = q.order_by(DocumentTemplate.use_count.desc())
    result = await db.execute(q)
    templates = result.scalars().all()
    return {
        "templates": [
            {
                "id": str(t.id),
                "name": t.name,
                "description": t.description,
                "content_type": t.content_type,
                "category": t.category,
                "is_public": t.is_public,
                "use_count": t.use_count,
                "variables": t.variables_json,
            }
            for t in templates
        ]
    }


@router.post("/templates/{template_id}/use")
async def use_template(
    template_id: str,
    db: DBSession,
    user: CurrentUser,
    folder_id: str | None = Query(None),
    file_name: str | None = Query(None),
) -> dict:
    """Create a new file from a template by copying from MinIO."""
    result = await db.execute(select(DocumentTemplate).where(DocumentTemplate.id == uuid.UUID(template_id)))
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template not found")

    # Copy file in MinIO
    from app.integrations.minio_client import minio_client
    dest_name = file_name or f"{tpl.name} (copy)"
    dest_key = f"{user.id}/{uuid.uuid4()}_{dest_name}"

    try:
        minio_client.copy_object(tpl.minio_key, dest_key)
    except Exception:
        # Fallback: download and re-upload
        data = minio_client.download(tpl.minio_key)
        minio_client.upload(dest_key, data, tpl.content_type)

    new_file = DriveFile(
        name=dest_name,
        content_type=tpl.content_type,
        size=0,
        minio_key=dest_key,
        folder_id=uuid.UUID(folder_id) if folder_id else None,
        owner_id=user.id,
    )
    db.add(new_file)

    # Increment use count
    await db.execute(
        update(DocumentTemplate).where(DocumentTemplate.id == tpl.id).values(use_count=tpl.use_count + 1)
    )
    await db.commit()
    return {"file_id": str(new_file.id), "name": dest_name, "template": tpl.name}


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str, db: DBSession, user: CurrentUser) -> dict:
    await db.execute(
        delete(DocumentTemplate).where(
            DocumentTemplate.id == uuid.UUID(template_id), DocumentTemplate.created_by == user.id
        )
    )
    await db.commit()
    return {"status": "deleted"}


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3: PERSONAL VAULT
# ══════════════════════════════════════════════════════════════════════════════


class VaultUnlock(BaseModel):
    password: str


@router.get("/vault")
async def get_vault_status(db: DBSession, user: CurrentUser) -> dict:
    """Get or create the user's personal vault."""
    result = await db.execute(select(PersonalVault).where(PersonalVault.user_id == user.id))
    vault = result.scalar_one_or_none()

    if not vault:
        # Auto-create vault folder
        vault_folder = DriveFolder(name="Personal Vault", owner_id=user.id)
        db.add(vault_folder)
        await db.flush()

        vault = PersonalVault(user_id=user.id, vault_folder_id=vault_folder.id)
        db.add(vault)
        await db.commit()

    # Auto-lock if timeout exceeded
    if vault.last_accessed and not vault.is_locked:
        elapsed = (datetime.now(timezone.utc) - vault.last_accessed).total_seconds() / 60
        if elapsed > vault.lock_timeout_minutes:
            vault.is_locked = True
            await db.commit()

    return {
        "is_locked": vault.is_locked,
        "vault_folder_id": str(vault.vault_folder_id) if vault.vault_folder_id else None,
        "lock_timeout_minutes": vault.lock_timeout_minutes,
        "last_accessed": vault.last_accessed.isoformat() if vault.last_accessed else None,
    }


@router.post("/vault/unlock")
async def unlock_vault(body: VaultUnlock, db: DBSession, user: CurrentUser) -> dict:
    """Unlock the vault with the user's password (re-authentication)."""
    from app.services.auth import verify_password
    from app.models.user import User

    result = await db.execute(select(User).where(User.id == user.id))
    db_user = result.scalar_one_or_none()
    if not db_user or not verify_password(body.password, db_user.hashed_password):
        raise HTTPException(401, "Invalid password")

    await db.execute(
        update(PersonalVault)
        .where(PersonalVault.user_id == user.id)
        .values(is_locked=False, last_accessed=datetime.now(timezone.utc))
    )
    await db.commit()

    result2 = await db.execute(select(PersonalVault).where(PersonalVault.user_id == user.id))
    vault = result2.scalar_one()
    return {
        "is_locked": False,
        "vault_folder_id": str(vault.vault_folder_id) if vault.vault_folder_id else None,
    }


@router.post("/vault/lock")
async def lock_vault(db: DBSession, user: CurrentUser) -> dict:
    await db.execute(
        update(PersonalVault).where(PersonalVault.user_id == user.id).values(is_locked=True)
    )
    await db.commit()
    return {"is_locked": True}


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3: POINT-IN-TIME RESTORE
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/snapshots")
async def list_snapshots(db: DBSession, user: CurrentUser) -> dict:
    """List available drive snapshots for restoration."""
    result = await db.execute(
        select(DriveSnapshot)
        .where(DriveSnapshot.owner_id == user.id)
        .order_by(DriveSnapshot.snapshot_at.desc())
        .limit(30)
    )
    snapshots = result.scalars().all()
    return {
        "snapshots": [
            {
                "id": str(s.id),
                "snapshot_at": s.snapshot_at.isoformat(),
                "file_count": s.file_count,
                "total_size": s.total_size,
            }
            for s in snapshots
        ]
    }


@router.post("/snapshots/{snapshot_id}/restore")
async def restore_snapshot(
    snapshot_id: str,
    db: DBSession,
    user: CurrentUser,
) -> dict:
    """Restore drive to a snapshot. Creates a 'Restored' folder with snapshot contents."""
    result = await db.execute(
        select(DriveSnapshot).where(
            DriveSnapshot.id == uuid.UUID(snapshot_id),
            DriveSnapshot.owner_id == user.id,
        )
    )
    snapshot = result.scalar_one_or_none()
    if not snapshot:
        raise HTTPException(404, "Snapshot not found")

    # Create a restore folder
    restore_folder = DriveFolder(
        name=f"Restored ({snapshot.snapshot_at.strftime('%Y-%m-%d %H:%M')})",
        owner_id=user.id,
    )
    db.add(restore_folder)
    await db.flush()

    # Restore files from snapshot metadata
    restored_count = 0
    for file_meta in snapshot.metadata_json.get("files", []):
        new_file = DriveFile(
            name=file_meta["name"],
            content_type=file_meta.get("content_type", "application/octet-stream"),
            size=file_meta.get("size", 0),
            minio_key=file_meta["minio_key"],
            folder_id=restore_folder.id,
            owner_id=user.id,
        )
        db.add(new_file)
        restored_count += 1

    await db.commit()
    return {
        "status": "restored",
        "folder_id": str(restore_folder.id),
        "restored_files": restored_count,
    }


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3: DLP RULES
# ══════════════════════════════════════════════════════════════════════════════


class DlpRuleCreate(BaseModel):
    name: str
    description: str | None = None
    patterns: list[dict]
    action: str = "warn"
    notify_admin: bool = True
    apply_to_sensitivity: list[str] | None = None
    apply_to_departments: list[str] | None = None


@router.post("/admin/dlp-rules")
async def create_dlp_rule(body: DlpRuleCreate, db: DBSession, user: SuperAdminUser) -> dict:
    rule = DlpRule(
        name=body.name,
        description=body.description,
        patterns=body.patterns,
        action=body.action,
        notify_admin=body.notify_admin,
        apply_to_sensitivity=body.apply_to_sensitivity,
        apply_to_departments=body.apply_to_departments,
        created_by=user.id,
    )
    db.add(rule)
    await db.commit()
    return {"id": str(rule.id), "name": rule.name}


@router.get("/admin/dlp-rules")
async def list_dlp_rules(db: DBSession, user: SuperAdminUser) -> dict:
    result = await db.execute(select(DlpRule).order_by(DlpRule.created_at.desc()))
    rules = result.scalars().all()
    return {
        "rules": [
            {
                "id": str(r.id),
                "name": r.name,
                "description": r.description,
                "patterns": r.patterns,
                "action": r.action,
                "is_active": r.is_active,
            }
            for r in rules
        ]
    }


@router.delete("/admin/dlp-rules/{rule_id}")
async def delete_dlp_rule(rule_id: str, db: DBSession, user: SuperAdminUser) -> dict:
    await db.execute(delete(DlpRule).where(DlpRule.id == uuid.UUID(rule_id)))
    await db.commit()
    return {"status": "deleted"}


@router.get("/admin/dlp-violations")
async def list_dlp_violations(
    db: DBSession,
    user: SuperAdminUser,
    days: int = Query(30, ge=1, le=365),
) -> dict:
    """List recent DLP violations."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(DlpViolation)
        .where(DlpViolation.detected_at >= since)
        .options(selectinload(DlpViolation.rule), selectinload(DlpViolation.file))
        .order_by(DlpViolation.detected_at.desc())
        .limit(100)
    )
    violations = result.scalars().all()
    return {
        "violations": [
            {
                "id": str(v.id),
                "rule_name": v.rule.name if v.rule else None,
                "file_name": v.file.name if v.file else None,
                "file_id": str(v.file_id),
                "matched_patterns": v.matched_patterns,
                "action_taken": v.action_taken,
                "detected_at": v.detected_at.isoformat(),
            }
            for v in violations
        ]
    }


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3: eDISCOVERY (Admin cross-user search + export)
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/admin/ediscovery/search")
async def ediscovery_search(
    db: DBSession,
    user: SuperAdminUser,
    query: str = Query(""),
    owner_id: str | None = None,
    content_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    sensitivity: str | None = None,
    limit: int = Query(100, le=500),
) -> dict:
    """Cross-user file search for legal/compliance. Admin only."""
    q = select(DriveFile)

    if query:
        q = q.where(DriveFile.name.ilike(f"%{query}%") | DriveFile.file_content_text.ilike(f"%{query}%"))
    if owner_id:
        q = q.where(DriveFile.owner_id == uuid.UUID(owner_id))
    if content_type:
        q = q.where(DriveFile.content_type.ilike(f"%{content_type}%"))
    if date_from:
        q = q.where(DriveFile.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        q = q.where(DriveFile.created_at <= datetime.fromisoformat(date_to))
    if sensitivity:
        q = q.where(DriveFile.sensitivity_level == sensitivity)

    q = q.order_by(DriveFile.created_at.desc()).limit(limit)
    result = await db.execute(q)
    files = result.scalars().all()

    return {
        "total": len(files),
        "files": [
            {
                "id": str(f.id),
                "name": f.name,
                "owner_id": str(f.owner_id),
                "content_type": f.content_type,
                "size": f.size,
                "sensitivity_level": f.sensitivity_level,
                "is_on_hold": f.is_on_hold,
                "folder_path": f.folder_path,
                "created_at": f.created_at.isoformat() if f.created_at else None,
            }
            for f in files
        ]
    }


@router.post("/admin/ediscovery/hold/{file_id}")
async def toggle_legal_hold(
    file_id: str,
    db: DBSession,
    user: SuperAdminUser,
    hold: bool = Query(True),
) -> dict:
    """Place or remove a legal hold on a file."""
    await db.execute(
        update(DriveFile).where(DriveFile.id == uuid.UUID(file_id)).values(is_on_hold=hold)
    )
    await db.commit()

    # Log the action
    log = FileAccessLog(
        user_id=user.id,
        file_id=uuid.UUID(file_id),
        action="legal_hold_on" if hold else "legal_hold_off",
    )
    db.add(log)
    await db.commit()

    return {"file_id": file_id, "is_on_hold": hold}


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3: RANSOMWARE DETECTION (endpoint to check status)
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/admin/ransomware-status")
async def ransomware_status(db: DBSession, user: SuperAdminUser) -> dict:
    """Check for recent anomalous activity that may indicate ransomware."""
    # Count rapid file modifications in last 5 minutes
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)
    rapid_changes = await db.scalar(
        select(func.count()).select_from(FileAccessLog).where(
            FileAccessLog.action.in_(["upload", "edit", "delete"]),
            FileAccessLog.timestamp >= cutoff,
        )
    ) or 0

    # Count by user
    user_activity = await db.execute(
        select(FileAccessLog.user_id, func.count().label("count"))
        .where(
            FileAccessLog.action.in_(["upload", "edit", "delete"]),
            FileAccessLog.timestamp >= cutoff,
        )
        .group_by(FileAccessLog.user_id)
        .having(func.count() > 20)  # Threshold: >20 ops in 5 min
    )
    suspicious_users = [
        {"user_id": str(row[0]), "operations": row[1]}
        for row in user_activity.all()
    ]

    return {
        "total_operations_last_5min": rapid_changes,
        "threshold_exceeded": rapid_changes > 50,
        "suspicious_users": suspicious_users,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3: DRIVE ANALYTICS DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/analytics/storage-trends")
async def storage_trends(
    db: DBSession,
    user: CurrentUser,
    days: int = Query(30, ge=7, le=365),
) -> dict:
    """Storage usage trends over time from snapshot data."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(DriveSnapshot.snapshot_at, DriveSnapshot.file_count, DriveSnapshot.total_size)
        .where(DriveSnapshot.owner_id == user.id, DriveSnapshot.snapshot_at >= since)
        .order_by(DriveSnapshot.snapshot_at)
    )
    data_points = [
        {
            "date": row[0].isoformat(),
            "file_count": row[1],
            "total_size": row[2],
        }
        for row in result.all()
    ]
    return {"trends": data_points, "period_days": days}


@router.get("/analytics/user-activity")
async def user_activity_analytics(
    db: DBSession,
    user: CurrentUser,
    days: int = Query(30, ge=1, le=365),
) -> dict:
    """User activity breakdown by action type."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(FileAccessLog.action, func.count().label("count"))
        .where(FileAccessLog.user_id == user.id, FileAccessLog.timestamp >= since)
        .group_by(FileAccessLog.action)
        .order_by(func.count().desc())
    )
    return {
        "activity": {row[0]: row[1] for row in result.all()},
        "period_days": days,
    }


@router.get("/analytics/file-lifecycle")
async def file_lifecycle_analytics(
    db: DBSession,
    user: CurrentUser,
) -> dict:
    """Find stale files (not accessed in 90 days) and never-accessed files."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)

    # Total files
    total = await db.scalar(
        select(func.count()).select_from(DriveFile).where(DriveFile.owner_id == user.id)
    ) or 0

    # Files not accessed in 90 days
    # We check access log — files with no log entry after cutoff
    recent_files_q = select(FileAccessLog.file_id).where(
        FileAccessLog.user_id == user.id,
        FileAccessLog.timestamp >= cutoff,
    ).distinct()

    stale_count = await db.scalar(
        select(func.count()).select_from(DriveFile).where(
            DriveFile.owner_id == user.id,
            ~DriveFile.id.in_(recent_files_q),
        )
    ) or 0

    # Size breakdown by type
    type_result = await db.execute(
        select(DriveFile.content_type, func.count(), func.sum(DriveFile.size))
        .where(DriveFile.owner_id == user.id)
        .group_by(DriveFile.content_type)
        .order_by(func.sum(DriveFile.size).desc())
        .limit(10)
    )
    by_type = [
        {"content_type": row[0], "count": row[1], "total_size": row[2] or 0}
        for row in type_result.all()
    ]

    return {
        "total_files": total,
        "stale_files_90d": stale_count,
        "by_type": by_type,
    }
