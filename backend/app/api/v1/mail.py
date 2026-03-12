"""Mail API — built-in SMTP/IMAP + PostgreSQL storage.

Messages are stored in the ``mailbox_messages`` table and sent via the
``smtp_client`` integration.

Enhanced with: inbox rules, signatures, read receipts, AI reply suggestions.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, File, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.mail import MailRule, MailSignature, ReadReceipt

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class SendMessagePayload(BaseModel):
    to: list[EmailStr]
    subject: str
    body: str
    cc: list[EmailStr] | None = None
    html_body: str | None = None
    in_reply_to: str | None = None
    references: str | None = None
    signature_id: str | None = None
    request_read_receipt: bool = False
    attachments: list[dict] | None = None


class RuleCreate(BaseModel):
    name: str
    conditions: dict
    actions: list
    match_mode: str = "all"
    priority: int = 0
    is_active: bool = True
    stop_processing: bool = False


class RuleUpdate(BaseModel):
    name: str | None = None
    conditions: dict | None = None
    actions: list | None = None
    match_mode: str | None = None
    priority: int | None = None
    is_active: bool | None = None
    stop_processing: bool | None = None


class SignatureCreate(BaseModel):
    name: str
    content_text: str = ""
    content_html: str = ""
    is_default: bool = False


class SignatureUpdate(BaseModel):
    name: str | None = None
    content_text: str | None = None
    content_html: str | None = None
    is_default: bool | None = None


class ReplyPayload(BaseModel):
    message_id: str
    body: str
    html_body: str | None = None
    reply_all: bool = False


class ForwardPayload(BaseModel):
    message_id: str
    to: list[EmailStr]
    body: str | None = None


class AISuggestPayload(BaseModel):
    message_id: str
    context: str | None = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _user_email(current_user: Any) -> str:
    """Derive the mailbox address for the current user."""
    email = getattr(current_user, "email", None)
    if email:
        return email
    username = getattr(current_user, "username", str(current_user.id))
    return f"{username}@{settings.MAIL_DOMAIN}"


async def _append_signature(
    db: AsyncSession, user_id: uuid.UUID, body: str, html_body: str | None, signature_id: str | None,
) -> tuple[str, str | None]:
    """Append the selected (or default) signature to message body."""
    if signature_id:
        sig = await db.get(MailSignature, uuid.UUID(signature_id))
    else:
        result = await db.execute(
            select(MailSignature).where(
                MailSignature.owner_id == user_id, MailSignature.is_default.is_(True)
            ).limit(1)
        )
        sig = result.scalar_one_or_none()

    if not sig:
        return body, html_body

    body = f"{body}\n\n--\n{sig.content_text}" if sig.content_text else body
    if html_body and sig.content_html:
        html_body = f"{html_body}<br><br><div class='signature'>{sig.content_html}</div>"
    return body, html_body


# ── Built-in helpers ──────────────────────────────────────────────────────────

async def _builtin_get_message(db: AsyncSession, message_id: str, user_id: uuid.UUID) -> dict[str, Any] | None:
    """Retrieve a message from local DB storage."""
    from app.models.mail_storage import MailboxMessage  # noqa: PLC0415

    try:
        msg_uuid = uuid.UUID(message_id)
    except ValueError:
        return None

    result = await db.execute(
        select(MailboxMessage).where(
            MailboxMessage.id == msg_uuid,
            MailboxMessage.user_id == user_id,
            MailboxMessage.is_deleted.is_(False),
        )
    )
    msg = result.scalar_one_or_none()
    if not msg:
        return None
    return msg.to_full_dict()


# ── Core mail endpoints ──────────────────────────────────────────────────────

@router.get("/folders", summary="List mail folders")
async def list_folders(current_user: CurrentUser, db: DBSession) -> dict[str, Any]:
    from app.models.mail_storage import MailboxMessage  # noqa: PLC0415

    result = await db.execute(
        select(
            MailboxMessage.folder,
            func.count(MailboxMessage.id).label("total"),
            func.count(MailboxMessage.id).filter(MailboxMessage.is_read.is_(False)).label("unread"),
        )
        .where(MailboxMessage.user_id == current_user.id, MailboxMessage.is_deleted.is_(False))
        .group_by(MailboxMessage.folder)
    )
    rows = result.all()

    # Ensure default folders always appear
    default_folders = {"INBOX", "Sent", "Drafts", "Trash", "Spam", "Archive"}
    folder_map: dict[str, dict] = {}
    for name in default_folders:
        folder_map[name] = {"id": name.lower(), "name": name, "role": name.lower(), "total_emails": 0, "unread_emails": 0}

    for row in rows:
        folder_name = row[0]
        total = row[1]
        unread = row[2]
        key = folder_name
        folder_map[key] = {
            "id": folder_name.lower(),
            "name": folder_name,
            "role": folder_name.lower() if folder_name in default_folders else None,
            "total_emails": total,
            "unread_emails": unread,
        }

    return {"service_available": True, "folders": list(folder_map.values())}


@router.get("/messages", summary="List messages in a folder")
async def list_messages(
    current_user: CurrentUser,
    db: DBSession,
    folder: str = Query("INBOX", description="Folder name"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    from app.models.mail_storage import MailboxMessage  # noqa: PLC0415

    # Map "inbox" -> "INBOX" for case-insensitive folder matching
    folder_filter = folder if folder != "inbox" else "INBOX"

    base_q = select(MailboxMessage).where(
        MailboxMessage.user_id == current_user.id,
        MailboxMessage.folder == folder_filter,
        MailboxMessage.is_deleted.is_(False),
    )

    # Total count
    count_result = await db.execute(
        select(func.count()).select_from(base_q.subquery())
    )
    total = count_result.scalar() or 0

    # Paginated results
    offset = (page - 1) * limit
    result = await db.execute(
        base_q.order_by(MailboxMessage.received_at.desc()).offset(offset).limit(limit)
    )
    messages = result.scalars().all()

    return {
        "service_available": True,
        "total": total,
        "messages": [m.to_summary_dict() for m in messages],
    }


@router.get("/message/{message_id}", summary="Get full message content")
async def get_message(
    message_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    msg = await _builtin_get_message(db, message_id, current_user.id)
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    # Auto-mark as read when fetched
    from app.models.mail_storage import MailboxMessage  # noqa: PLC0415
    await db.execute(
        update(MailboxMessage)
        .where(MailboxMessage.id == uuid.UUID(message_id), MailboxMessage.user_id == current_user.id)
        .values(is_read=True)
    )
    await db.commit()

    return {"service_available": True, "message": msg}


@router.post("/send", status_code=status.HTTP_201_CREATED, summary="Send an email")
async def send_email(
    payload: SendMessagePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from_email = _user_email(current_user)

    # Append signature
    body, html_body = await _append_signature(
        db, current_user.id, payload.body, payload.html_body, payload.signature_id
    )

    # Built-in SMTP sending
    from app.integrations.smtp_client import send_email as smtp_send  # noqa: PLC0415
    from app.models.mail_storage import MailboxMessage  # noqa: PLC0415

    result = await smtp_send(
        from_addr=from_email,
        to_addrs=[str(addr) for addr in payload.to],
        subject=payload.subject,
        body_html=html_body,
        body_text=body,
        cc=[str(addr) for addr in payload.cc] if payload.cc else None,
        attachments=payload.attachments,
        in_reply_to=payload.in_reply_to,
        references=payload.references,
        from_name=getattr(current_user, "full_name", None),
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=result.get("error", "Failed to send email"),
        )

    # Store in Sent folder
    sent_msg = MailboxMessage(
        user_id=current_user.id,
        folder="Sent",
        from_addr=from_email,
        from_name=getattr(current_user, "full_name", "") or "",
        to_addrs=[{"email": str(a)} for a in payload.to],
        cc=[{"email": str(a)} for a in payload.cc] if payload.cc else [],
        subject=payload.subject,
        body_html=html_body or "",
        body_text=body,
        message_id_header=result.get("message_id", ""),
        in_reply_to=payload.in_reply_to or "",
        references=payload.references or "",
        is_read=True,
        received_at=datetime.now(timezone.utc),
        sent_at=datetime.now(timezone.utc),
        attachments=[
            {"filename": a.get("filename", ""), "content_type": a.get("content_type", ""), "size": len(a.get("content", b""))}
            for a in (payload.attachments or [])
        ],
    )
    db.add(sent_msg)

    result = {
        "service_available": True,
        "success": True,
        "message_id": result.get("message_id"),
    }

    # Create read receipt tracking if requested
    if payload.request_read_receipt:
        msg_id = result.get("message_id", f"sent-{uuid.uuid4().hex[:12]}")
        for addr in payload.to:
            receipt = ReadReceipt(
                message_id=msg_id,
                sender_id=current_user.id,
                recipient_email=str(addr),
            )
            db.add(receipt)

    await db.commit()

    # Publish event for Mail->Calendar integration
    await event_bus.publish("mail.sent", {
        "user_id": str(current_user.id),
        "from": from_email,
        "to": [str(a) for a in payload.to],
        "subject": payload.subject,
        "message_id": result.get("message_id"),
    })

    return result


@router.put("/message/{message_id}/read", summary="Mark a message as read")
async def mark_as_read(
    message_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.mail_storage import MailboxMessage  # noqa: PLC0415
    try:
        msg_uuid = uuid.UUID(message_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid message ID")

    result = await db.execute(
        update(MailboxMessage)
        .where(MailboxMessage.id == msg_uuid, MailboxMessage.user_id == current_user.id)
        .values(is_read=True)
    )
    await db.commit()
    return {"service_available": True, "success": result.rowcount > 0, "message_id": message_id}


@router.put("/message/{message_id}/star", summary="Toggle star on a message")
async def toggle_star(
    message_id: str,
    current_user: CurrentUser,
    db: DBSession,
    starred: bool = Query(True),
) -> dict[str, Any]:
    """Toggle the starred flag on a message."""
    from app.models.mail_storage import MailboxMessage  # noqa: PLC0415
    try:
        msg_uuid = uuid.UUID(message_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid message ID")

    result = await db.execute(
        update(MailboxMessage)
        .where(MailboxMessage.id == msg_uuid, MailboxMessage.user_id == current_user.id)
        .values(is_starred=starred)
    )
    await db.commit()
    return {"success": result.rowcount > 0, "starred": starred}


@router.put("/message/{message_id}/move", summary="Move message to another folder")
async def move_message(
    message_id: str,
    current_user: CurrentUser,
    db: DBSession,
    folder: str = Query(..., description="Target folder name"),
) -> dict[str, Any]:
    """Move a message to a different folder."""
    from app.models.mail_storage import MailboxMessage  # noqa: PLC0415
    try:
        msg_uuid = uuid.UUID(message_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid message ID")

    result = await db.execute(
        update(MailboxMessage)
        .where(MailboxMessage.id == msg_uuid, MailboxMessage.user_id == current_user.id)
        .values(folder=folder)
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"success": True, "folder": folder}


@router.delete("/message/{message_id}", status_code=status.HTTP_200_OK, summary="Delete/trash a message")
async def delete_message(
    message_id: str,
    current_user: CurrentUser,
    db: DBSession,
    permanent: bool = Query(False, description="Permanently delete instead of moving to Trash"),
) -> dict[str, Any]:
    from app.models.mail_storage import MailboxMessage  # noqa: PLC0415
    try:
        msg_uuid = uuid.UUID(message_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid message ID")

    if permanent:
        result = await db.execute(
            update(MailboxMessage)
            .where(MailboxMessage.id == msg_uuid, MailboxMessage.user_id == current_user.id)
            .values(is_deleted=True)
        )
    else:
        # Move to Trash
        result = await db.execute(
            update(MailboxMessage)
            .where(MailboxMessage.id == msg_uuid, MailboxMessage.user_id == current_user.id)
            .values(folder="Trash")
        )
    await db.commit()
    return {"service_available": True, "success": result.rowcount > 0, "message_id": message_id}


# ── Attachments ──────────────────────────────────────────────────────────────

@router.get("/message/{message_id}/attachment/{attachment_id}", summary="Download a mail attachment")
async def download_attachment(
    message_id: str,
    attachment_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    from app.models.mail_storage import MailboxMessage  # noqa: PLC0415
    try:
        msg_uuid = uuid.UUID(message_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid message ID")

    result = await db.execute(
        select(MailboxMessage).where(
            MailboxMessage.id == msg_uuid,
            MailboxMessage.user_id == current_user.id,
        )
    )
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    # Find attachment by index or storage_key
    for att in (msg.attachments or []):
        if att.get("storage_key") == attachment_id or str(att.get("index", "")) == attachment_id:
            storage_key = att.get("storage_key")
            if not storage_key:
                raise HTTPException(status_code=404, detail="Attachment not stored")
            from app.integrations import minio_client  # noqa: PLC0415
            data = minio_client.download_file(storage_key)
            return Response(
                content=data,
                media_type=att.get("content_type", "application/octet-stream"),
                headers={"Content-Disposition": f'attachment; filename="{att.get("filename", "attachment")}"'},
            )

    raise HTTPException(status_code=404, detail="Attachment not found")


@router.post("/message/{message_id}/attachment/{attachment_id}/save-to-drive", summary="Save attachment to Drive")
async def save_attachment_to_drive(
    message_id: str,
    attachment_id: str,
    current_user: CurrentUser,
    db: DBSession,
    folder_path: str = Query("mail-attachments", description="Drive folder to save into"),
) -> dict[str, Any]:
    from app.models.mail_storage import MailboxMessage  # noqa: PLC0415
    from app.integrations import minio_client  # noqa: PLC0415
    from app.models.drive import DriveFile  # noqa: PLC0415

    try:
        msg_uuid = uuid.UUID(message_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid message ID")

    result = await db.execute(
        select(MailboxMessage).where(
            MailboxMessage.id == msg_uuid,
            MailboxMessage.user_id == current_user.id,
        )
    )
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    # Find matching attachment by storage_key or index
    target_att = None
    for att in (msg.attachments or []):
        if att.get("storage_key") == attachment_id or str(att.get("index", "")) == attachment_id:
            target_att = att
            break

    if not target_att or not target_att.get("storage_key"):
        raise HTTPException(status_code=404, detail="Attachment not found")

    data = minio_client.download_file(target_att["storage_key"])
    filename = target_att.get("filename", "attachment")
    content_type = target_att.get("content_type", "application/octet-stream")

    record = minio_client.upload_file(
        file_data=data, filename=filename,
        user_id=str(current_user.id), folder_path=folder_path,
        content_type=content_type,
    )
    drive_file = DriveFile(
        id=uuid.UUID(record["file_id"]), name=filename,
        content_type=content_type, size=len(data),
        minio_key=record["minio_key"], folder_path=f"/{folder_path}",
        owner_id=current_user.id, is_public=False,
    )
    db.add(drive_file)
    await db.commit()
    await db.refresh(drive_file)
    await event_bus.publish("file.uploaded", {
        "file_id": str(drive_file.id), "name": drive_file.name,
        "size": drive_file.size, "owner_id": str(current_user.id),
        "source": "mail_attachment", "message_id": message_id,
    })
    return {
        "saved": True, "file_id": str(drive_file.id),
        "filename": filename, "size": len(data),
        "folder_path": f"/{folder_path}",
    }


# ── Reply / Forward ──────────────────────────────────────────────────────────

@router.post("/reply", status_code=status.HTTP_201_CREATED, summary="Reply to an email")
async def reply_to_email(
    payload: ReplyPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    user_email = _user_email(current_user)

    msg_data = await _builtin_get_message(db, payload.message_id, current_user.id)
    if not msg_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Original message not found")

    from_info = msg_data.get("from", {})
    original_from = from_info.get("email", "") if isinstance(from_info, dict) else str(from_info)

    to_addrs = [original_from] if not payload.reply_all else [original_from] + [a.get("email", "") for a in (msg_data.get("cc") or [])]
    to_addrs = [a for a in to_addrs if a and a != user_email]
    if not to_addrs:
        to_addrs = [original_from]

    subject = msg_data.get("subject", "")
    if not subject.lower().startswith("re:"):
        subject = f"Re: {subject}"

    from app.integrations.smtp_client import send_email as smtp_send  # noqa: PLC0415
    from app.models.mail_storage import MailboxMessage  # noqa: PLC0415

    result = await smtp_send(
        from_addr=user_email,
        to_addrs=to_addrs,
        subject=subject,
        body_text=payload.body,
        body_html=payload.html_body,
        in_reply_to=msg_data.get("message_id_header", ""),
        references=msg_data.get("references", ""),
    )
    if not result.get("success"):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to send reply")

    # Store sent reply
    sent_msg = MailboxMessage(
        user_id=current_user.id,
        folder="Sent",
        from_addr=user_email,
        from_name=getattr(current_user, "full_name", "") or "",
        to_addrs=[{"email": a} for a in to_addrs],
        subject=subject,
        body_text=payload.body,
        body_html=payload.html_body or "",
        message_id_header=result.get("message_id", ""),
        in_reply_to=msg_data.get("message_id_header", ""),
        references=msg_data.get("references", ""),
        is_read=True,
        received_at=datetime.now(timezone.utc),
        sent_at=datetime.now(timezone.utc),
    )
    db.add(sent_msg)
    await db.commit()

    return {"service_available": True, "success": True, "message_id": result.get("message_id")}


@router.post("/forward", status_code=status.HTTP_201_CREATED, summary="Forward an email")
async def forward_email(
    payload: ForwardPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    user_email = _user_email(current_user)

    msg_data = await _builtin_get_message(db, payload.message_id, current_user.id)
    if not msg_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Original message not found")

    subject = msg_data.get("subject", "")
    if not subject.lower().startswith("fwd:"):
        subject = f"Fwd: {subject}"

    from_info = msg_data.get("from", {})
    original_from = from_info.get("email", "") if isinstance(from_info, dict) else str(from_info)
    original_body = msg_data.get("body_text", "") or msg_data.get("body_html", "")
    combined = f"{payload.body or ''}\n\n---------- Forwarded message ----------\nFrom: {original_from}\nSubject: {msg_data.get('subject', '')}\n\n{original_body}"

    from app.integrations.smtp_client import send_email as smtp_send  # noqa: PLC0415
    from app.models.mail_storage import MailboxMessage  # noqa: PLC0415

    result = await smtp_send(
        from_addr=user_email,
        to_addrs=[str(a) for a in payload.to],
        subject=subject,
        body_text=combined,
    )
    if not result.get("success"):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to forward email")

    sent_msg = MailboxMessage(
        user_id=current_user.id,
        folder="Sent",
        from_addr=user_email,
        from_name=getattr(current_user, "full_name", "") or "",
        to_addrs=[{"email": str(a)} for a in payload.to],
        subject=subject,
        body_text=combined,
        message_id_header=result.get("message_id", ""),
        is_read=True,
        received_at=datetime.now(timezone.utc),
        sent_at=datetime.now(timezone.utc),
    )
    db.add(sent_msg)
    await db.commit()

    return {"service_available": True, "success": True, "message_id": result.get("message_id")}


# ── Inbox Rules ──────────────────────────────────────────────────────────────

@router.get("/rules", summary="List inbox rules")
async def list_rules(current_user: CurrentUser, db: DBSession) -> dict[str, Any]:
    result = await db.execute(
        select(MailRule).where(MailRule.owner_id == current_user.id).order_by(MailRule.priority)
    )
    rules = result.scalars().all()
    return {
        "total": len(rules),
        "rules": [
            {
                "id": str(r.id), "name": r.name, "is_active": r.is_active,
                "priority": r.priority, "conditions": r.conditions, "actions": r.actions,
                "match_mode": r.match_mode, "stop_processing": r.stop_processing,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rules
        ],
    }


@router.post("/rules", status_code=status.HTTP_201_CREATED, summary="Create inbox rule")
async def create_rule(payload: RuleCreate, current_user: CurrentUser, db: DBSession) -> dict[str, Any]:
    rule = MailRule(
        owner_id=current_user.id,
        name=payload.name,
        conditions=payload.conditions,
        actions=payload.actions,
        match_mode=payload.match_mode,
        priority=payload.priority,
        is_active=payload.is_active,
        stop_processing=payload.stop_processing,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return {
        "id": str(rule.id), "name": rule.name, "is_active": rule.is_active,
        "priority": rule.priority, "conditions": rule.conditions, "actions": rule.actions,
        "match_mode": rule.match_mode, "stop_processing": rule.stop_processing,
    }


@router.put("/rules/{rule_id}", summary="Update inbox rule")
async def update_rule(
    rule_id: str, payload: RuleUpdate, current_user: CurrentUser, db: DBSession,
) -> dict[str, Any]:
    rule = await db.get(MailRule, uuid.UUID(rule_id))
    if not rule or rule.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Rule not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)

    await db.commit()
    await db.refresh(rule)
    return {"id": str(rule.id), "name": rule.name, "updated": True}


@router.delete("/rules/{rule_id}", summary="Delete inbox rule")
async def delete_rule(rule_id: str, current_user: CurrentUser, db: DBSession) -> dict[str, Any]:
    rule = await db.get(MailRule, uuid.UUID(rule_id))
    if not rule or rule.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Rule not found")
    await db.delete(rule)
    await db.commit()
    return {"deleted": True}


# ── Signatures ───────────────────────────────────────────────────────────────

@router.get("/signatures", summary="List email signatures")
async def list_signatures(current_user: CurrentUser, db: DBSession) -> dict[str, Any]:
    result = await db.execute(
        select(MailSignature).where(MailSignature.owner_id == current_user.id)
    )
    sigs = result.scalars().all()
    return {
        "total": len(sigs),
        "signatures": [
            {
                "id": str(s.id), "name": s.name,
                "content_text": s.content_text, "content_html": s.content_html,
                "is_default": s.is_default,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in sigs
        ],
    }


@router.post("/signatures", status_code=status.HTTP_201_CREATED, summary="Create email signature")
async def create_signature(payload: SignatureCreate, current_user: CurrentUser, db: DBSession) -> dict[str, Any]:
    if payload.is_default:
        await db.execute(
            update(MailSignature)
            .where(MailSignature.owner_id == current_user.id, MailSignature.is_default.is_(True))
            .values(is_default=False)
        )

    sig = MailSignature(
        owner_id=current_user.id,
        name=payload.name,
        content_text=payload.content_text,
        content_html=payload.content_html,
        is_default=payload.is_default,
    )
    db.add(sig)
    await db.commit()
    await db.refresh(sig)
    return {
        "id": str(sig.id), "name": sig.name,
        "content_text": sig.content_text, "content_html": sig.content_html,
        "is_default": sig.is_default,
    }


@router.put("/signatures/{sig_id}", summary="Update email signature")
async def update_signature(
    sig_id: str, payload: SignatureUpdate, current_user: CurrentUser, db: DBSession,
) -> dict[str, Any]:
    sig = await db.get(MailSignature, uuid.UUID(sig_id))
    if not sig or sig.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Signature not found")

    update_data = payload.model_dump(exclude_unset=True)

    if update_data.get("is_default"):
        await db.execute(
            update(MailSignature)
            .where(MailSignature.owner_id == current_user.id, MailSignature.id != sig.id)
            .values(is_default=False)
        )

    for field, value in update_data.items():
        setattr(sig, field, value)

    await db.commit()
    await db.refresh(sig)
    return {"id": str(sig.id), "name": sig.name, "updated": True}


@router.delete("/signatures/{sig_id}", summary="Delete email signature")
async def delete_signature(sig_id: str, current_user: CurrentUser, db: DBSession) -> dict[str, Any]:
    sig = await db.get(MailSignature, uuid.UUID(sig_id))
    if not sig or sig.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Signature not found")
    await db.delete(sig)
    await db.commit()
    return {"deleted": True}


# ── Read Receipts ────────────────────────────────────────────────────────────

@router.get("/read-receipts", summary="List read receipt status for sent messages")
async def list_read_receipts(current_user: CurrentUser, db: DBSession) -> dict[str, Any]:
    result = await db.execute(
        select(ReadReceipt).where(ReadReceipt.sender_id == current_user.id).order_by(ReadReceipt.requested_at.desc())
    )
    receipts = result.scalars().all()
    return {
        "total": len(receipts),
        "receipts": [
            {
                "id": str(r.id), "message_id": r.message_id,
                "recipient_email": r.recipient_email,
                "requested_at": r.requested_at.isoformat() if r.requested_at else None,
                "read_at": r.read_at.isoformat() if r.read_at else None,
            }
            for r in receipts
        ],
    }


@router.post("/read-receipts/{receipt_id}/confirm", summary="Confirm a read receipt")
async def confirm_read_receipt(receipt_id: str, db: DBSession) -> dict[str, Any]:
    receipt = await db.get(ReadReceipt, uuid.UUID(receipt_id))
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if receipt.read_at:
        return {"already_confirmed": True}

    receipt.read_at = datetime.now(timezone.utc)
    await db.commit()
    return {"confirmed": True, "read_at": receipt.read_at.isoformat()}


# ── AI Reply Suggestions ────────────────────────────────────────────────────

@router.post("/ai-suggest-reply", summary="Get AI-generated reply suggestions")
async def ai_suggest_reply(
    payload: AISuggestPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    msg = await _builtin_get_message(db, payload.message_id, current_user.id)

    if not msg:
        return {"suggestions": [], "error": "Message not found"}

    from_val = msg.get("from", "")
    if isinstance(from_val, dict):
        from_val = from_val.get("email", "")
    elif isinstance(from_val, list) and from_val:
        from_val = from_val[0].get("email", "") if isinstance(from_val[0], dict) else str(from_val[0])

    email_context = (
        f"From: {from_val}\n"
        f"Subject: {msg.get('subject', '')}\n"
        f"Body:\n{msg.get('body_text', '') or msg.get('body_html', '')}"
    )

    prompt = (
        "You are an email assistant. Based on the email below, generate exactly 3 different reply suggestions. "
        "Each should be a complete, professional reply. Return them as a JSON array of 3 strings.\n\n"
        f"Email:\n{email_context}"
    )
    if payload.context:
        prompt += f"\n\nAdditional context: {payload.context}"

    try:
        from app.services.ai import AIService  # noqa: PLC0415
        import json

        ai = AIService()
        response = await ai.generate(
            prompt=prompt,
            user_id=str(current_user.id),
            context={"tool": "mail_suggest_reply"},
        )
        text = response.get("response", "")
        start = text.find("[")
        end = text.rfind("]") + 1
        if start >= 0 and end > start:
            suggestions = json.loads(text[start:end])
        else:
            suggestions = [text]

        return {"suggestions": suggestions[:3]}
    except Exception as exc:
        return {"suggestions": [], "error": str(exc)}


# ── Attachment Upload ──────────────────────────────────────────────────────

@router.post("/attachments/upload", summary="Upload an attachment for compose")
async def upload_attachment(
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> dict[str, Any]:
    """Upload a file to MinIO for use as an email attachment.

    Returns a storage_key that can be referenced when sending the message.
    """
    try:
        from app.integrations import minio_client  # noqa: PLC0415

        file_content = await file.read()
        filename = file.filename or "attachment"
        content_type = file.content_type or "application/octet-stream"

        # Store in MinIO under mail-attachments/{user_id}/{uuid}/{filename}
        storage_key = f"mail-attachments/{current_user.id}/{uuid.uuid4()}/{filename}"

        result = minio_client.upload_file_from_bytes(
            data=file_content,
            object_name=storage_key,
            content_type=content_type,
        )

        return {
            "storage_key": storage_key,
            "filename": filename,
            "size": result["size"],
            "content_type": content_type,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload attachment: {exc}",
        ) from exc
