"""Notes extensions — folders, sharing, tags, utilities, templates, AI summarize, cross-module links."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.core.sanitize import like_pattern
from app.models.notes import Note, NoteShareRecord, NoteTag, NoteTemplate

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class FolderCreate(BaseModel):
    name: str
    parent_id: uuid.UUID | None = None


class FolderUpdate(BaseModel):
    name: str | None = None


class ShareCreate(BaseModel):
    user_id: uuid.UUID
    permission: str = "view"  # view | edit


class TagPayload(BaseModel):
    tag_name: str


class DuplicatePayload(BaseModel):
    title: str | None = None


class ExportPayload(BaseModel):
    format: str = "html"  # html | markdown | txt


class TemplateCreate(BaseModel):
    name: str
    content_html: str = ""
    category: str | None = None


class AISummarizePayload(BaseModel):
    max_length: int | None = None


class TagOut(BaseModel):
    id: uuid.UUID
    note_id: uuid.UUID
    tag_name: str
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class NoteShareOut(BaseModel):
    id: uuid.UUID
    note_id: uuid.UUID
    shared_with_user_id: uuid.UUID
    permission: str
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    content_html: str
    category: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_owned_note(db: AsyncSession, note_id: uuid.UUID, user_id: uuid.UUID) -> Note:
    note = await db.get(Note, note_id)
    if not note or note.owner_id != user_id:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


# ── Folders (using tags as lightweight folder simulation) ────────────────────
# Notes don't have a dedicated folder model, so we use a special tag prefix
# "folder:" to simulate folders. This approach avoids adding new tables while
# providing folder-like organisation.

FOLDER_PREFIX = "folder:"


@router.get("/folders", summary="List note folders")
async def list_folders(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(NoteTag.tag_name)
        .join(Note, Note.id == NoteTag.note_id)
        .where(
            Note.owner_id == current_user.id,
            NoteTag.tag_name.like(f"{FOLDER_PREFIX}%"),
        )
        .distinct()
        .order_by(NoteTag.tag_name)
    )
    folders = [
        {"name": row[0].removeprefix(FOLDER_PREFIX), "tag": row[0]}
        for row in result.all()
    ]
    return {"total": len(folders), "folders": folders}


@router.post("/folders", status_code=status.HTTP_201_CREATED, summary="Create a note folder")
async def create_folder(
    payload: FolderCreate,
    current_user: CurrentUser,
) -> dict[str, Any]:
    folder_tag = f"{FOLDER_PREFIX}{payload.name}"
    return {"name": payload.name, "tag": folder_tag, "created": True}


@router.put("/folders/{folder_name}", summary="Rename a note folder")
async def rename_folder(
    folder_name: str,
    payload: FolderUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    if not payload.name:
        raise HTTPException(status_code=400, detail="New name is required")

    old_tag = f"{FOLDER_PREFIX}{folder_name}"
    new_tag = f"{FOLDER_PREFIX}{payload.name}"

    # Update all matching tags
    result = await db.execute(
        select(NoteTag)
        .join(Note, Note.id == NoteTag.note_id)
        .where(Note.owner_id == current_user.id, NoteTag.tag_name == old_tag)
    )
    tags = result.scalars().all()
    for tag in tags:
        tag.tag_name = new_tag
    await db.commit()

    return {"old_name": folder_name, "new_name": payload.name, "updated": len(tags)}


@router.delete("/folders/{folder_name}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a note folder")
async def delete_folder(
    folder_name: str,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    tag_name = f"{FOLDER_PREFIX}{folder_name}"
    result = await db.execute(
        select(NoteTag)
        .join(Note, Note.id == NoteTag.note_id)
        .where(Note.owner_id == current_user.id, NoteTag.tag_name == tag_name)
    )
    tags = result.scalars().all()
    for tag in tags:
        await db.delete(tag)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Sharing ──────────────────────────────────────────────────────────────────

@router.post("/notes/{note_id}/share", status_code=status.HTTP_201_CREATED, summary="Share a note with a user")
async def share_note(
    note_id: uuid.UUID,
    payload: ShareCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    note = await _get_owned_note(db, note_id, current_user.id)

    # Check for existing share
    existing = await db.execute(
        select(NoteShareRecord).where(
            NoteShareRecord.note_id == note_id,
            NoteShareRecord.shared_with_user_id == payload.user_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Note already shared with this user")

    share = NoteShareRecord(
        note_id=note_id,
        shared_with_user_id=payload.user_id,
        permission=payload.permission,
    )
    db.add(share)

    # Update the note's shared status
    note.is_shared = True
    shared_list = list(note.shared_with or [])
    uid_str = str(payload.user_id)
    if uid_str not in shared_list:
        shared_list.append(uid_str)
    note.shared_with = shared_list

    await db.commit()
    await db.refresh(share)
    return NoteShareOut.model_validate(share).model_dump()


@router.delete("/notes/{note_id}/share/{user_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Revoke note share")
async def revoke_note_share(
    note_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    note = await _get_owned_note(db, note_id, current_user.id)

    result = await db.execute(
        select(NoteShareRecord).where(
            NoteShareRecord.note_id == note_id,
            NoteShareRecord.shared_with_user_id == user_id,
        )
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    await db.delete(share)

    # Update shared_with list
    shared_list = [uid for uid in (note.shared_with or []) if uid != str(user_id)]
    note.shared_with = shared_list
    note.is_shared = len(shared_list) > 0

    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Tags ─────────────────────────────────────────────────────────────────────

@router.get("/tags", summary="List all unique tags used by the current user")
async def list_all_tags(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(NoteTag.tag_name, func.count(NoteTag.id))
        .join(Note, Note.id == NoteTag.note_id)
        .where(
            Note.owner_id == current_user.id,
            ~NoteTag.tag_name.like(f"{FOLDER_PREFIX}%"),
        )
        .group_by(NoteTag.tag_name)
        .order_by(NoteTag.tag_name)
    )
    tags = [{"tag": row[0], "count": row[1]} for row in result.all()]
    return {"total": len(tags), "tags": tags}


@router.post("/notes/{note_id}/tags", status_code=status.HTTP_201_CREATED, summary="Add a tag to a note")
async def add_note_tag(
    note_id: uuid.UUID,
    payload: TagPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_owned_note(db, note_id, current_user.id)

    # Check for duplicate
    existing = await db.execute(
        select(NoteTag).where(NoteTag.note_id == note_id, NoteTag.tag_name == payload.tag_name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Tag already exists on this note")

    tag = NoteTag(note_id=note_id, tag_name=payload.tag_name)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return TagOut.model_validate(tag).model_dump()


@router.delete("/notes/{note_id}/tags/{tag_name}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove a tag from a note")
async def remove_note_tag(
    note_id: uuid.UUID,
    tag_name: str,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    await _get_owned_note(db, note_id, current_user.id)

    result = await db.execute(
        select(NoteTag).where(NoteTag.note_id == note_id, NoteTag.tag_name == tag_name)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    await db.delete(tag)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Utilities ────────────────────────────────────────────────────────────────

@router.post("/notes/{note_id}/duplicate", status_code=status.HTTP_201_CREATED, summary="Duplicate a note")
async def duplicate_note(
    note_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    payload: DuplicatePayload | None = None,
) -> dict[str, Any]:
    note = await _get_owned_note(db, note_id, current_user.id)

    new_title = (payload.title if payload and payload.title else f"Copy of {note.title}")

    new_note = Note(
        title=new_title,
        content=note.content,
        owner_id=current_user.id,
        tags=list(note.tags or []),
        is_pinned=False,
    )
    db.add(new_note)
    await db.commit()
    await db.refresh(new_note)

    return {
        "id": str(new_note.id),
        "title": new_note.title,
        "duplicated_from": str(note_id),
    }


@router.post("/notes/{note_id}/export", summary="Export a note in the specified format")
async def export_note(
    note_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    payload: ExportPayload | None = None,
) -> dict[str, Any]:
    note = await _get_owned_note(db, note_id, current_user.id)

    fmt = payload.format if payload else "html"
    content = note.content or ""

    if fmt == "html":
        exported = f"<html><head><title>{note.title}</title></head><body>{content}</body></html>"
        content_type = "text/html"
    elif fmt == "markdown":
        # Basic HTML-to-markdown conversion
        import re
        md = content
        md = re.sub(r"<h[1-6]>(.*?)</h[1-6]>", r"# \1\n", md)
        md = re.sub(r"<p>(.*?)</p>", r"\1\n\n", md)
        md = re.sub(r"<br\s*/?>", "\n", md)
        md = re.sub(r"<strong>(.*?)</strong>", r"**\1**", md)
        md = re.sub(r"<em>(.*?)</em>", r"*\1*", md)
        md = re.sub(r"<[^>]+>", "", md)
        exported = f"# {note.title}\n\n{md}"
        content_type = "text/markdown"
    else:
        # Plain text
        import re
        text = re.sub(r"<[^>]+>", "", content)
        exported = f"{note.title}\n\n{text}"
        content_type = "text/plain"

    return {
        "note_id": str(note_id),
        "title": note.title,
        "format": fmt,
        "content_type": content_type,
        "content": exported,
    }


@router.get("/search", summary="Search notes by title and content")
async def search_notes(
    current_user: CurrentUser,
    db: DBSession,
    q: str = Query(..., min_length=1, description="Search query"),
    tag: str | None = Query(None, description="Filter by tag"),
    pinned: bool | None = Query(None, description="Filter by pinned status"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    from sqlalchemy import or_  # noqa: PLC0415

    query = select(Note).where(
        Note.owner_id == current_user.id,
        or_(
            Note.title.ilike(like_pattern(q)),
            Note.content.ilike(like_pattern(q)),
        ),
    )

    if pinned is not None:
        query = query.where(Note.is_pinned == pinned)
    if tag:
        query = query.where(Note.tags.contains([tag]))

    query = query.order_by(Note.is_pinned.desc(), Note.updated_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)

    result = await db.execute(query)
    notes = result.scalars().all()

    return {
        "total": len(notes),
        "notes": [
            {
                "id": str(n.id),
                "title": n.title,
                "content_preview": (n.content or "")[:200],
                "tags": n.tags,
                "is_pinned": n.is_pinned,
                "updated_at": n.updated_at.isoformat() if n.updated_at else None,
            }
            for n in notes
        ],
    }


# ── Templates ────────────────────────────────────────────────────────────────

@router.get("/templates", summary="List note templates")
async def list_templates(
    current_user: CurrentUser,
    db: DBSession,
    category: str | None = Query(None, description="Filter by category"),
) -> dict[str, Any]:
    query = select(NoteTemplate).order_by(NoteTemplate.name)
    if category:
        query = query.where(NoteTemplate.category == category)
    result = await db.execute(query)
    templates = result.scalars().all()
    return {
        "total": len(templates),
        "templates": [TemplateOut.model_validate(t).model_dump() for t in templates],
    }


@router.post("/templates", status_code=status.HTTP_201_CREATED, summary="Create a note template")
async def create_template(
    payload: TemplateCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    template = NoteTemplate(
        name=payload.name,
        content_html=payload.content_html,
        category=payload.category,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return TemplateOut.model_validate(template).model_dump()


# ── AI Summarize ─────────────────────────────────────────────────────────────

@router.post("/ai-summarize", summary="AI-powered note summarization")
async def ai_summarize(
    payload: AISummarizePayload,
    current_user: CurrentUser,
    note_id: uuid.UUID = Query(..., description="Note ID to summarize"),
    db: DBSession = ...,
) -> dict[str, Any]:
    note = await _get_owned_note(db, note_id, current_user.id)

    if not note.content:
        return {"summary": "", "note_id": str(note_id), "message": "Note has no content to summarize"}

    try:
        from app.services.ai import AIService  # noqa: PLC0415

        max_len = payload.max_length or 200
        prompt = (
            f"Summarize the following note in {max_len} words or fewer. "
            f"Be concise and capture the key points.\n\n"
            f"Title: {note.title}\n"
            f"Content: {note.content}"
        )

        ai = AIService()
        response = await ai.generate(
            prompt=prompt,
            user_id=str(current_user.id),
            context={"tool": "note_summarize", "note_id": str(note_id)},
        )
        summary = response.get("response", "")
        return {"summary": summary, "note_id": str(note_id)}
    except Exception as exc:
        return {"summary": "", "note_id": str(note_id), "error": str(exc)}


# ══════════════════════════════════════════════════════════════════════════════
#  CROSS-MODULE SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class AttachFilePayload(BaseModel):
    file_id: uuid.UUID
    file_name: str | None = None


class CreateEventFromNotePayload(BaseModel):
    start_time: datetime
    end_time: datetime | None = None
    event_type: str = "reminder"


class EmailNotePayload(BaseModel):
    to: list[str]
    subject: str | None = None


class LinkTaskPayload(BaseModel):
    task_id: uuid.UUID
    project_id: uuid.UUID


# ══════════════════════════════════════════════════════════════════════════════
#  4. Notes → Drive: attach/embed a Drive file to a note
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/notes/{note_id}/attach-file",
    summary="Attach a Drive file to a note via linked_items",
    status_code=status.HTTP_201_CREATED,
)
async def attach_file_to_note(
    note_id: uuid.UUID,
    payload: AttachFilePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Link a Drive file to this note via the linked_items JSON column."""
    note = await _get_owned_note(db, note_id, current_user.id)

    from app.models.drive import DriveFile  # noqa: PLC0415

    file = await db.get(DriveFile, payload.file_id)
    if not file:
        raise HTTPException(status_code=404, detail="Drive file not found")

    file_name = payload.file_name or file.name
    linked = list(note.linked_items or [])

    # Check for duplicate
    for item in linked:
        if item.get("type") == "file" and item.get("id") == str(payload.file_id):
            raise HTTPException(status_code=409, detail="File already attached to this note")

    link_entry = {
        "type": "file",
        "id": str(payload.file_id),
        "title": file_name,
        "module": "drive",
    }
    linked.append(link_entry)
    note.linked_items = linked

    await db.commit()
    await db.refresh(note)

    return {
        "note_id": str(note_id),
        "linked_item": link_entry,
        "total_links": len(note.linked_items or []),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  5. Notes → Calendar: create calendar event from note
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/notes/{note_id}/create-event",
    summary="Create a calendar event from a note",
    status_code=status.HTTP_201_CREATED,
)
async def create_event_from_note(
    note_id: uuid.UUID,
    payload: CreateEventFromNotePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Create a CalendarEvent using the note title and content as event details."""
    note = await _get_owned_note(db, note_id, current_user.id)

    from app.models.calendar import CalendarEvent  # noqa: PLC0415

    end_time = payload.end_time or (payload.start_time + timedelta(hours=1))

    # Strip HTML for description
    import re  # noqa: PLC0415
    description = re.sub(r"<[^>]+>", "", note.content or "")
    if len(description) > 2000:
        description = description[:2000] + "..."

    event = CalendarEvent(
        title=note.title,
        description=description,
        start_time=payload.start_time,
        end_time=end_time,
        event_type=payload.event_type,
        organizer_id=current_user.id,
        color="#51459d",
    )
    db.add(event)
    await db.flush()

    # Also add cross-link in the note's linked_items
    linked = list(note.linked_items or [])
    linked.append({
        "type": "calendar",
        "id": str(event.id),
        "title": f"Event: {note.title}",
        "module": "calendar",
    })
    note.linked_items = linked

    await db.commit()
    await db.refresh(event)

    await event_bus.publish("note.event.created", {
        "note_id": str(note_id),
        "event_id": str(event.id),
        "title": note.title,
        "user_id": str(current_user.id),
    })

    return {
        "event_id": str(event.id),
        "title": event.title,
        "start_time": event.start_time.isoformat(),
        "end_time": event.end_time.isoformat(),
        "note_id": str(note_id),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  6. Notes → Mail: email a note's content
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/notes/{note_id}/email",
    summary="Send a note's content as an email",
    status_code=status.HTTP_200_OK,
)
async def email_note(
    note_id: uuid.UUID,
    payload: EmailNotePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Send the note content as an email body to the specified recipients."""
    note = await _get_owned_note(db, note_id, current_user.id)

    if not payload.to:
        raise HTTPException(status_code=400, detail="At least one recipient is required")

    subject = payload.subject or f"Note: {note.title}"
    html_body = note.content or ""

    # Strip HTML for plain-text fallback
    import re  # noqa: PLC0415
    plain_text = re.sub(r"<[^>]+>", "", html_body)

    from_email = getattr(current_user, "email", "noreply@urban-erp.local")

    try:
        from app.integrations.smtp_client import send_email  # noqa: PLC0415
        result = await send_email(
            from_addr=from_email,
            to_addrs=payload.to,
            subject=subject,
            body_text=plain_text,
            body_html=html_body,
        )
        success = result.get("success", False)
        service_available = True
    except Exception:
        success = False
        service_available = False

    await event_bus.publish("note.emailed", {
        "note_id": str(note_id),
        "to": payload.to,
        "subject": subject,
        "user_id": str(current_user.id),
    })

    return {
        "note_id": str(note_id),
        "to": payload.to,
        "subject": subject,
        "sent": success,
        "service_available": service_available,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  7. Notes → Projects: link note to a task
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/notes/{note_id}/link-task",
    summary="Link a note to a project task via linked_items",
    status_code=status.HTTP_201_CREATED,
)
async def link_note_to_task(
    note_id: uuid.UUID,
    payload: LinkTaskPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Add a task link to this note's linked_items JSON column."""
    note = await _get_owned_note(db, note_id, current_user.id)

    from app.models.projects import Task  # noqa: PLC0415

    task = await db.get(Task, payload.task_id)
    if not task or task.project_id != payload.project_id:
        raise HTTPException(status_code=404, detail="Task not found in the specified project")

    linked = list(note.linked_items or [])

    # Check for duplicate
    for item in linked:
        if item.get("type") == "task" and item.get("id") == str(payload.task_id):
            raise HTTPException(status_code=409, detail="Task already linked to this note")

    link_entry = {
        "type": "task",
        "id": str(payload.task_id),
        "title": task.title,
        "module": "projects",
    }
    linked.append(link_entry)
    note.linked_items = linked

    await db.commit()
    await db.refresh(note)

    return {
        "note_id": str(note_id),
        "linked_item": link_entry,
        "total_links": len(note.linked_items or []),
    }
