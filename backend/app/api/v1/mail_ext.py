"""Mail extensions — threads, drafts, search, labels, snooze, contacts, cross-module links."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.mail import MailLabel, MailThread

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class LabelCreate(BaseModel):
    name: str
    color: str = "#51459d"


class LabelUpdate(BaseModel):
    name: str | None = None
    color: str | None = None


class DraftCreate(BaseModel):
    to: list[str] | None = None
    subject: str = ""
    body: str = ""
    html_body: str | None = None
    cc: list[str] | None = None


class SnoozePayload(BaseModel):
    snooze_until: str  # ISO datetime


class LabelOut(BaseModel):
    id: uuid.UUID
    name: str
    color: str
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class ThreadOut(BaseModel):
    id: uuid.UUID
    subject: str
    participant_ids: list
    message_ids: list
    last_message_at: Any
    message_count: int
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _user_email(current_user: Any) -> str:
    email = getattr(current_user, "email", None)
    if email:
        return email
    username = getattr(current_user, "username", str(current_user.id))
    return f"{username}@{settings.MAIL_DOMAIN}"


# ── Threads ──────────────────────────────────────────────────────────────────

@router.get("/threads", summary="List mail threads (threaded view)")
async def list_threads(
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    query = (
        select(MailThread)
        .where(MailThread.user_id == current_user.id)
        .order_by(MailThread.last_message_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(query)
    threads = result.scalars().all()
    return {
        "total": len(threads),
        "threads": [ThreadOut.model_validate(t).model_dump() for t in threads],
    }


# ── Drafts ───────────────────────────────────────────────────────────────────

@router.post("/messages/draft", status_code=status.HTTP_201_CREATED, summary="Save a draft message")
async def save_draft(
    payload: DraftCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Save a draft message in PostgreSQL."""
    user_email = _user_email(current_user)

    from app.models.mail_storage import MailboxMessage  # noqa: PLC0415

    draft = MailboxMessage(
        user_id=current_user.id,
        folder="Drafts",
        from_addr=user_email,
        from_name=getattr(current_user, "full_name", "") or "",
        to_addrs=[{"email": addr} for addr in (payload.to or [])],
        cc=[{"email": addr} for addr in (payload.cc or [])],
        subject=payload.subject,
        body_text=payload.body,
        body_html=payload.html_body or "",
        is_draft=True,
        received_at=datetime.now(timezone.utc),
    )
    db.add(draft)
    await db.commit()
    await db.refresh(draft)

    return {
        "service_available": True,
        "saved": True,
        "draft_id": str(draft.id),
        "subject": draft.subject,
    }


# ── Search ───────────────────────────────────────────────────────────────────

@router.get("/search", summary="Full-text search across messages")
async def search_messages(
    current_user: CurrentUser,
    db: DBSession,
    q: str = Query(..., min_length=1, description="Search query"),
    sender: str | None = Query(None, alias="from", description="Filter by sender email"),
    has_attachment: bool | None = Query(None, description="Filter messages with attachments"),
    date_from: str | None = Query(None, description="ISO date start range"),
    date_to: str | None = Query(None, description="ISO date end range"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """Search messages using PostgreSQL ILIKE."""
    from app.models.mail_storage import MailboxMessage  # noqa: PLC0415

    safe_q = q.replace("%", r"\%").replace("_", r"\_")
    pattern = f"%{safe_q}%"

    filters = [
        MailboxMessage.user_id == current_user.id,
        MailboxMessage.is_deleted.is_(False),
        or_(
            MailboxMessage.subject.ilike(pattern),
            MailboxMessage.from_addr.ilike(pattern),
            MailboxMessage.body_text.ilike(pattern),
        ),
    ]

    if sender:
        filters.append(MailboxMessage.from_addr.ilike(f"%{sender}%"))
    if has_attachment is True:
        # attachments is a JSONB array; non-empty means has attachments
        filters.append(func.jsonb_array_length(MailboxMessage.attachments) > 0)
    elif has_attachment is False:
        filters.append(func.jsonb_array_length(MailboxMessage.attachments) == 0)
    if date_from:
        filters.append(MailboxMessage.received_at >= datetime.fromisoformat(date_from))
    if date_to:
        filters.append(MailboxMessage.received_at <= datetime.fromisoformat(date_to))

    base_q = select(MailboxMessage).where(*filters)

    # Total count
    count_result = await db.execute(select(func.count()).select_from(base_q.subquery()))
    total = count_result.scalar() or 0

    # Paginated results
    offset = (page - 1) * limit
    result = await db.execute(
        base_q.order_by(MailboxMessage.received_at.desc()).offset(offset).limit(limit)
    )
    messages_list = result.scalars().all()

    return {
        "service_available": True,
        "total": total,
        "messages": [m.to_summary_dict() for m in messages_list],
    }


# ── Labels ───────────────────────────────────────────────────────────────────

@router.get("/labels", summary="List custom mail labels")
async def list_labels(current_user: CurrentUser, db: DBSession) -> dict[str, Any]:
    result = await db.execute(
        select(MailLabel).where(MailLabel.user_id == current_user.id).order_by(MailLabel.name)
    )
    labels = result.scalars().all()
    return {
        "total": len(labels),
        "labels": [LabelOut.model_validate(l).model_dump() for l in labels],
    }


@router.post("/labels", status_code=status.HTTP_201_CREATED, summary="Create a mail label")
async def create_label(
    payload: LabelCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    label = MailLabel(
        name=payload.name,
        color=payload.color,
        user_id=current_user.id,
    )
    db.add(label)
    await db.commit()
    await db.refresh(label)
    return LabelOut.model_validate(label).model_dump()


@router.put("/labels/{label_id}", summary="Update a mail label")
async def update_label(
    label_id: uuid.UUID,
    payload: LabelUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    label = await db.get(MailLabel, label_id)
    if not label or label.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Label not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(label, field, value)

    await db.commit()
    await db.refresh(label)
    return LabelOut.model_validate(label).model_dump()


@router.delete("/labels/{label_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete a mail label")
async def delete_label(
    label_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> None:
    label = await db.get(MailLabel, label_id)
    if not label or label.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Label not found")
    await db.delete(label)
    await db.commit()


# ── Snooze ───────────────────────────────────────────────────────────────────

@router.post("/messages/{message_id}/snooze", summary="Snooze a message until a specified time")
async def snooze_message(
    message_id: str,
    payload: SnoozePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Snooze a message — mark it as read now, schedule it to reappear later.

    This marks the message as read and stores a snooze record.
    When the snooze time arrives, a Celery task will unmark read to re-surface it.
    """
    snooze_until = datetime.fromisoformat(payload.snooze_until)

    if snooze_until <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Snooze time must be in the future")

    from app.models.mail_storage import MailboxMessage  # noqa: PLC0415

    try:
        msg_uuid = uuid.UUID(message_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid message ID")

    result = await db.execute(
        select(MailboxMessage).where(
            MailboxMessage.id == msg_uuid,
            MailboxMessage.user_id == current_user.id,
            MailboxMessage.is_deleted.is_(False),
        )
    )
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    # Store snooze_until in the headers JSONB field
    msg.headers = {**(msg.headers or {}), "snoozed_until": snooze_until.isoformat()}
    msg.is_read = True  # Mark read when snoozed
    await db.commit()

    return {
        "service_available": True,
        "snoozed": True,
        "message_id": message_id,
        "snooze_until": snooze_until.isoformat(),
    }


# ── Contacts ─────────────────────────────────────────────────────────────────

# ── Cross-module Schemas ─────────────────────────────────────────────────────

class SaveAllAttachmentsToDrivePayload(BaseModel):
    folder_id: str | None = None


class LinkCRMPayload(BaseModel):
    contact_id: str | None = None
    deal_id: str | None = None
    note: str | None = None


class ConvertToTaskPayload(BaseModel):
    project_id: str
    assignee_id: str | None = None
    priority: str = "medium"


class SaveAsNotePayload(BaseModel):
    tags: list[str] | None = None
    is_pinned: bool = False


# ── Mail -> Drive: Save all attachments ──────────────────────────────────────

@router.post(
    "/messages/{message_id}/save-to-drive",
    status_code=status.HTTP_201_CREATED,
    summary="Save all email attachments to Drive",
)
async def save_message_attachments_to_drive(
    message_id: str,
    payload: SaveAllAttachmentsToDrivePayload | None = None,
    current_user: CurrentUser = ...,
    db: DBSession = ...,
) -> dict[str, Any]:
    """Download all attachments from a mail message and save them to the user's Drive (MinIO)."""
    from app.integrations import minio_client  # noqa: PLC0415
    from app.models.drive import DriveFile  # noqa: PLC0415
    from app.models.mail_storage import MailboxMessage  # noqa: PLC0415

    folder_path = "mail-attachments"
    folder_id = (payload.folder_id if payload else None)

    try:
        msg_uuid = uuid.UUID(message_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid message ID")

    result = await db.execute(
        select(MailboxMessage).where(
            MailboxMessage.id == msg_uuid,
            MailboxMessage.user_id == current_user.id,
            MailboxMessage.is_deleted.is_(False),
        )
    )
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    attachments = msg.attachments or []
    if not attachments:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message has no attachments")

    saved_files: list[dict[str, Any]] = []
    for att in attachments:
        storage_key = att.get("storage_key")
        if not storage_key:
            continue

        # Download from MinIO using the storage_key
        try:
            data = minio_client.download_file(storage_key)
        except Exception:
            continue

        filename = att.get("filename", "attachment")
        content_type = att.get("content_type", "application/octet-stream")

        # Re-upload to Drive folder
        record = minio_client.upload_file(
            file_data=data,
            filename=filename,
            user_id=str(current_user.id),
            folder_path=folder_path,
            content_type=content_type,
        )

        drive_file = DriveFile(
            id=uuid.UUID(record["file_id"]),
            name=filename,
            content_type=content_type,
            size=len(data),
            minio_key=record["minio_key"],
            folder_path=f"/{folder_path}",
            folder_id=uuid.UUID(folder_id) if folder_id else None,
            owner_id=current_user.id,
            is_public=False,
        )
        db.add(drive_file)
        saved_files.append({
            "file_id": str(drive_file.id),
            "filename": filename,
            "size": len(data),
            "content_type": content_type,
        })

    await db.commit()

    await event_bus.publish("file.uploaded", {
        "source": "mail_save_all_attachments",
        "message_id": message_id,
        "owner_id": str(current_user.id),
        "file_count": len(saved_files),
    })

    return {
        "saved": True,
        "file_count": len(saved_files),
        "files": saved_files,
        "folder_path": f"/{folder_path}",
    }


# ── Mail -> CRM: Link to Contact/Deal ────────────────────────────────────────

@router.post(
    "/messages/{message_id}/link-crm",
    status_code=status.HTTP_201_CREATED,
    summary="Link an email to a CRM contact or deal",
)
async def link_message_to_crm(
    message_id: str,
    payload: LinkCRMPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Create a CRM activity entry linking this email to a contact or deal."""
    from app.models.crm import Contact, Deal  # noqa: PLC0415
    from app.models.activity import ActivityFeedEntry  # noqa: PLC0415

    if not payload.contact_id and not payload.deal_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Must provide contact_id or deal_id")

    # Validate contact/deal exists
    linked_entity_name = ""
    linked_entity_type = ""
    if payload.contact_id:
        contact = await db.get(Contact, uuid.UUID(payload.contact_id))
        if not contact:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
        name_parts = [contact.first_name or "", contact.last_name or ""]
        linked_entity_name = " ".join(p for p in name_parts if p) or contact.company_name or contact.email or "Unknown"
        linked_entity_type = "contact"

    if payload.deal_id:
        deal = await db.get(Deal, uuid.UUID(payload.deal_id))
        if not deal:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")
        linked_entity_name = deal.title
        linked_entity_type = "deal"

    # Get email subject for the activity message
    email_subject = message_id  # fallback

    from app.models.mail_storage import MailboxMessage  # noqa: PLC0415
    try:
        msg_uuid = uuid.UUID(message_id)
        result = await db.execute(
            select(MailboxMessage).where(
                MailboxMessage.id == msg_uuid,
                MailboxMessage.user_id == current_user.id,
            )
        )
        msg = result.scalar_one_or_none()
        if msg:
            email_subject = msg.subject or message_id
    except (ValueError, Exception):
        pass

    activity = ActivityFeedEntry(
        activity_type="email_linked",
        message=f"Email \"{email_subject}\" linked to {linked_entity_type} \"{linked_entity_name}\"",
        module="crm",
        user_id=current_user.id,
        metadata_json={
            "message_id": message_id,
            "email_subject": email_subject,
            "contact_id": payload.contact_id,
            "deal_id": payload.deal_id,
            "note": payload.note,
            "link_type": "mail_to_crm",
        },
    )
    db.add(activity)
    await db.commit()
    await db.refresh(activity)

    return {
        "linked": True,
        "activity_id": str(activity.id),
        "message_id": message_id,
        "contact_id": payload.contact_id,
        "deal_id": payload.deal_id,
        "entity_name": linked_entity_name,
        "entity_type": linked_entity_type,
    }


@router.get(
    "/messages/{message_id}/crm-links",
    summary="Get CRM links for an email message",
)
async def get_message_crm_links(
    message_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Return all CRM activity entries linked to this email."""
    from app.models.activity import ActivityFeedEntry  # noqa: PLC0415

    result = await db.execute(
        select(ActivityFeedEntry).where(
            ActivityFeedEntry.user_id == current_user.id,
            ActivityFeedEntry.module == "crm",
            ActivityFeedEntry.activity_type == "email_linked",
            ActivityFeedEntry.metadata_json["message_id"].as_string() == message_id,
        ).order_by(ActivityFeedEntry.created_at.desc())
    )
    links = result.scalars().all()

    return {
        "message_id": message_id,
        "total": len(links),
        "links": [
            {
                "activity_id": str(link.id),
                "message": link.message,
                "contact_id": (link.metadata_json or {}).get("contact_id"),
                "deal_id": (link.metadata_json or {}).get("deal_id"),
                "note": (link.metadata_json or {}).get("note"),
                "created_at": link.created_at.isoformat() if link.created_at else None,
            }
            for link in links
        ],
    }


# ── Mail -> Projects: Convert to Task ────────────────────────────────────────

@router.post(
    "/messages/{message_id}/convert-to-task",
    status_code=status.HTTP_201_CREATED,
    summary="Convert an email into a project task",
)
async def convert_message_to_task(
    message_id: str,
    payload: ConvertToTaskPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Create a project task from an email message — subject becomes title, body becomes description."""
    from app.models.projects import Project, Task  # noqa: PLC0415
    from app.models.mail_storage import MailboxMessage  # noqa: PLC0415

    # Validate project
    project = await db.get(Project, uuid.UUID(payload.project_id))
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Fetch email content
    try:
        msg_uuid = uuid.UUID(message_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid message ID")

    result = await db.execute(
        select(MailboxMessage).where(
            MailboxMessage.id == msg_uuid,
            MailboxMessage.user_id == current_user.id,
            MailboxMessage.is_deleted.is_(False),
        )
    )
    db_msg = result.scalar_one_or_none()
    if not db_msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    subject = db_msg.subject or "Untitled email task"
    body_text = db_msg.body_text or db_msg.body_html or ""
    from_addr = db_msg.from_addr or ""

    description = f"Created from email by {from_addr}\n\n{body_text}"

    # Get max order for the project
    max_order_result = await db.execute(
        select(Task.order).where(Task.project_id == project.id).order_by(Task.order.desc()).limit(1)
    )
    max_order = max_order_result.scalar_one_or_none() or 0

    task = Task(
        project_id=project.id,
        title=subject,
        description=description,
        assignee_id=uuid.UUID(payload.assignee_id) if payload.assignee_id else current_user.id,
        status="todo",
        priority=payload.priority,
        order=max_order + 1,
        tags=["from-email"],
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    await event_bus.publish("task.created", {
        "task_id": str(task.id),
        "project_id": str(project.id),
        "title": task.title,
        "source": "mail_convert",
        "message_id": message_id,
        "user_id": str(current_user.id),
    })

    return {
        "created": True,
        "task_id": str(task.id),
        "project_id": str(project.id),
        "project_name": project.name,
        "title": task.title,
        "priority": task.priority,
        "status": task.status,
    }


# ── Mail -> Notes: Save as Note ──────────────────────────────────────────────

@router.post(
    "/messages/{message_id}/save-as-note",
    status_code=status.HTTP_201_CREATED,
    summary="Save email content as a Note",
)
async def save_message_as_note(
    message_id: str,
    payload: SaveAsNotePayload | None = None,
    current_user: CurrentUser = ...,
    db: DBSession = ...,
) -> dict[str, Any]:
    """Create a Note from an email — subject becomes title, body becomes content, with back-link to email."""
    from app.models.notes import Note  # noqa: PLC0415
    from app.models.mail_storage import MailboxMessage  # noqa: PLC0415

    try:
        msg_uuid = uuid.UUID(message_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid message ID")

    result = await db.execute(
        select(MailboxMessage).where(
            MailboxMessage.id == msg_uuid,
            MailboxMessage.user_id == current_user.id,
            MailboxMessage.is_deleted.is_(False),
        )
    )
    db_msg = result.scalar_one_or_none()
    if not db_msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    subject = db_msg.subject or "Untitled email note"
    body_html = db_msg.body_html or ""
    body_text = db_msg.body_text or ""
    from_addr = db_msg.from_addr or ""
    date_str = db_msg.received_at.isoformat() if db_msg.received_at else ""

    # Build content with email metadata header
    content = (
        f"<p><strong>From:</strong> {from_addr}<br>"
        f"<strong>Date:</strong> {date_str}<br>"
        f"<strong>Subject:</strong> {subject}</p>"
        f"<hr>"
        f"{body_html or body_text}"
    )

    tags = (payload.tags if payload and payload.tags else []) + ["from-email"]
    is_pinned = payload.is_pinned if payload else False

    note = Note(
        title=subject,
        content=content,
        owner_id=current_user.id,
        tags=tags,
        is_pinned=is_pinned,
        linked_items=[
            {"type": "mail", "id": message_id, "title": subject},
        ],
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)

    return {
        "created": True,
        "note_id": str(note.id),
        "title": note.title,
        "tags": note.tags,
        "is_pinned": note.is_pinned,
    }


# ── Contacts ─────────────────────────────────────────────────────────────────

@router.get("/contacts", summary="List mail contacts (extracted from sent/received)")
async def list_mail_contacts(
    current_user: CurrentUser,
    db: DBSession,
    q: str | None = Query(None, description="Search contacts by email/name"),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """Get frequently used email contacts by querying recent sent messages."""
    user_email = _user_email(current_user)

    from app.models.mail_storage import MailboxMessage  # noqa: PLC0415

    result = await db.execute(
        select(MailboxMessage.to_addrs, MailboxMessage.cc).where(
            MailboxMessage.user_id == current_user.id,
            MailboxMessage.folder == "Sent",
            MailboxMessage.is_deleted.is_(False),
        ).order_by(MailboxMessage.sent_at.desc()).limit(200)
    )
    rows = result.all()

    # Flatten JSONB arrays of to_addrs and cc into unique emails
    contacts_set: dict[str, dict[str, str]] = {}
    for to_addrs, cc_addrs in rows:
        for addr_list in (to_addrs or [], cc_addrs or []):
            for addr in (addr_list if isinstance(addr_list, list) else [addr_list]):
                if isinstance(addr, dict):
                    email = addr.get("email", "")
                    name = addr.get("name", "")
                elif isinstance(addr, str):
                    email = addr
                    name = ""
                else:
                    continue
                if email and email != user_email and email not in contacts_set:
                    contacts_set[email] = {"email": email, "name": name}

    contacts_list = list(contacts_set.values())

    if q:
        q_lower = q.lower()
        contacts_list = [
            c for c in contacts_list
            if q_lower in c["email"].lower() or q_lower in c.get("name", "").lower()
        ]

    return {
        "service_available": True,
        "total": len(contacts_list[:limit]),
        "contacts": contacts_list[:limit],
    }
