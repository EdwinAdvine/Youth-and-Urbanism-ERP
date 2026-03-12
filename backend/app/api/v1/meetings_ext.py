"""Meetings Extensions API — Invite, RSVP, Recordings, Start/End, Chat, AI, Upcoming, Instant, Recurring, Templates, Cross-Module Links."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.calendar import CalendarEvent
from app.models.meetings import MeetingChat, MeetingLink, MeetingNote, MeetingRecording, MeetingTemplate

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class MeetingOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    start_time: datetime
    end_time: datetime
    location: str | None
    attendees: list | None
    color: str | None
    jitsi_room: str | None
    organizer_id: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class InvitePayload(BaseModel):
    user_ids: list[str]
    message: str | None = None


class RSVPPayload(BaseModel):
    response: str  # accepted | declined | tentative


class RecordingOut(BaseModel):
    id: uuid.UUID
    meeting_id: uuid.UUID
    file_id: uuid.UUID | None
    duration_seconds: int | None
    size_bytes: int | None
    recorded_at: datetime
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class MeetingNoteCreate(BaseModel):
    content: str


class MeetingNoteOut(BaseModel):
    id: uuid.UUID
    meeting_id: uuid.UUID
    content: str
    author_id: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class TemplateCreate(BaseModel):
    name: str
    default_duration_minutes: int = 30
    default_settings: dict | None = None
    recurring_pattern: str | None = None


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    default_duration_minutes: int
    default_settings: dict | None
    recurring_pattern: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class InstantMeetingCreate(BaseModel):
    title: str = "Quick Meeting"
    attendees: list[str] | None = None


class AISummarizeRequest(BaseModel):
    include_chat: bool = True
    include_notes: bool = True


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_meeting(
    meeting_id: uuid.UUID, db: Any
) -> CalendarEvent:
    """Fetch a meeting (CalendarEvent with type=meeting)."""
    event = await db.get(CalendarEvent, meeting_id)
    if not event or event.event_type != "meeting":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    return event


def _can_access_meeting(event: CalendarEvent, user_id: uuid.UUID) -> bool:
    """Check if user is organizer or attendee."""
    if event.organizer_id == user_id:
        return True
    attendees = event.attendees or []
    for att in attendees:
        if isinstance(att, str) and att == str(user_id):
            return True
        if isinstance(att, dict) and att.get("user_id") == str(user_id):
            return True
    return False


# ── Invite ───────────────────────────────────────────────────────────────────

@router.post("/{meeting_id}/invite", summary="Invite users to a meeting")
async def invite_users(
    meeting_id: uuid.UUID,
    payload: InvitePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    event = await _get_meeting(meeting_id, db)
    if event.organizer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the organizer can invite")

    attendees = event.attendees or []
    existing_ids = set()
    for att in attendees:
        if isinstance(att, str):
            existing_ids.add(att)
        elif isinstance(att, dict):
            existing_ids.add(att.get("user_id", ""))

    added = []
    for uid in payload.user_ids:
        if uid not in existing_ids:
            attendees.append({"user_id": uid, "response": "pending"})
            added.append(uid)

    event.attendees = attendees
    await db.commit()
    await db.refresh(event)

    # Send email invites
    if added:
        try:
            from app.models.user import User  # noqa: PLC0415
            from app.integrations.smtp_client import send_email as smtp_send  # noqa: PLC0415

            organizer_email = getattr(current_user, "email", "")
            display_name = getattr(current_user, "full_name", None) or organizer_email

            emails = []
            for uid in added:
                try:
                    user = await db.get(User, uuid.UUID(uid))
                    if user and getattr(user, "email", None):
                        emails.append(user.email)
                except (ValueError, Exception):
                    pass

            if emails:
                body = (
                    f"You have been invited to: {event.title}\n"
                    f"When: {event.start_time.strftime('%B %d, %Y %I:%M %p')} - "
                    f"{event.end_time.strftime('%I:%M %p')}\n"
                    f"Organizer: {display_name}\n"
                )
                if event.jitsi_room:
                    from app.core.config import settings  # noqa: PLC0415
                    body += f"Join: {settings.JITSI_PUBLIC_URL}/{event.jitsi_room}\n"
                if payload.message:
                    body += f"\nMessage: {payload.message}\n"

                await smtp_send(
                    from_addr=organizer_email,
                    to_addrs=emails,
                    subject=f"Meeting Invite: {event.title}",
                    body_text=body,
                )
        except Exception:
            pass  # Don't fail invite if email fails

    await event_bus.publish("meeting.invited", {
        "meeting_id": str(meeting_id),
        "invited_users": added,
        "organizer_id": str(current_user.id),
    })

    return {
        "meeting_id": str(meeting_id),
        "invited": added,
        "total_attendees": len(event.attendees),
    }


# ── RSVP ─────────────────────────────────────────────────────────────────────

@router.put(
    "/{meeting_id}/attendees/{user_id}/respond",
    summary="RSVP to a meeting",
)
async def rsvp_meeting(
    meeting_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: RSVPPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Only the user themselves can RSVP
    if user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only RSVP for yourself")

    valid_responses = {"accepted", "declined", "tentative"}
    if payload.response not in valid_responses:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"response must be one of: {', '.join(valid_responses)}",
        )

    event = await _get_meeting(meeting_id, db)
    attendees = event.attendees or []
    uid_str = str(user_id)

    updated = False
    new_attendees = []
    for att in attendees:
        if isinstance(att, str) and att == uid_str:
            new_attendees.append({"user_id": uid_str, "response": payload.response})
            updated = True
        elif isinstance(att, dict) and att.get("user_id") == uid_str:
            att["response"] = payload.response
            new_attendees.append(att)
            updated = True
        else:
            new_attendees.append(att)

    if not updated:
        new_attendees.append({"user_id": uid_str, "response": payload.response})

    event.attendees = new_attendees
    await db.commit()
    await db.refresh(event)

    await event_bus.publish("meeting.rsvp", {
        "meeting_id": str(meeting_id),
        "user_id": uid_str,
        "response": payload.response,
        "title": event.title,
    })

    return {
        "meeting_id": str(meeting_id),
        "user_id": uid_str,
        "response": payload.response,
    }


# ── Recordings ───────────────────────────────────────────────────────────────

@router.get("/{meeting_id}/recording", summary="Get meeting recording")
async def get_recording(
    meeting_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    event = await _get_meeting(meeting_id, db)
    if not _can_access_meeting(event, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(MeetingRecording)
        .where(MeetingRecording.meeting_id == meeting_id)
        .order_by(MeetingRecording.recorded_at.desc())
    )
    recordings = result.scalars().all()

    if not recordings:
        return {"meeting_id": str(meeting_id), "recordings": [], "total": 0}

    recording_list = []
    for rec in recordings:
        rec_data = RecordingOut.model_validate(rec).model_dump()
        # Get download URL if file exists
        if rec.file_id:
            try:
                from app.integrations import minio_client  # noqa: PLC0415
                from app.models.drive import DriveFile  # noqa: PLC0415

                drive_file = await db.get(DriveFile, rec.file_id)
                if drive_file:
                    rec_data["download_url"] = minio_client.get_download_url(drive_file.minio_key)
                    rec_data["filename"] = drive_file.name
            except Exception:
                pass
        recording_list.append(rec_data)

    return {"meeting_id": str(meeting_id), "recordings": recording_list, "total": len(recording_list)}


# ── Start / End ──────────────────────────────────────────────────────────────

@router.post("/{meeting_id}/start", summary="Signal that a meeting has started")
async def start_meeting(
    meeting_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    event = await _get_meeting(meeting_id, db)
    if event.organizer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the organizer can start")

    await event_bus.publish("meeting.started", {
        "meeting_id": str(meeting_id),
        "title": event.title,
        "organizer_id": str(current_user.id),
        "jitsi_room": event.jitsi_room,
        "started_at": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "meeting_id": str(meeting_id),
        "status": "started",
        "jitsi_room": event.jitsi_room,
        "started_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/{meeting_id}/end", summary="Signal that a meeting has ended")
async def end_meeting(
    meeting_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    event = await _get_meeting(meeting_id, db)
    if event.organizer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the organizer can end")

    ended_at = datetime.now(timezone.utc)
    duration = None
    if event.start_time:
        duration = int((ended_at - event.start_time).total_seconds())

    await event_bus.publish("meeting.ended", {
        "meeting_id": str(meeting_id),
        "title": event.title,
        "organizer_id": str(current_user.id),
        "ended_at": ended_at.isoformat(),
        "duration_seconds": duration,
    })

    return {
        "meeting_id": str(meeting_id),
        "status": "ended",
        "ended_at": ended_at.isoformat(),
        "duration_seconds": duration,
    }


# ── Chat Export ──────────────────────────────────────────────────────────────

@router.get("/{meeting_id}/chat-export", summary="Export meeting chat messages")
async def export_chat(
    meeting_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    event = await _get_meeting(meeting_id, db)
    if not _can_access_meeting(event, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(MeetingChat).where(MeetingChat.meeting_id == meeting_id)
    )
    chat = result.scalar_one_or_none()

    if not chat:
        return {"meeting_id": str(meeting_id), "messages": [], "exported_at": None}

    # Mark as exported
    if not chat.exported_at:
        chat.exported_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(chat)

    return {
        "meeting_id": str(meeting_id),
        "messages": chat.messages or [],
        "exported_at": chat.exported_at.isoformat() if chat.exported_at else None,
    }


# ── AI Summarize ─────────────────────────────────────────────────────────────

@router.post("/{meeting_id}/ai-summarize", summary="AI-summarize a meeting")
async def ai_summarize_meeting(
    meeting_id: uuid.UUID,
    payload: AISummarizeRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    event = await _get_meeting(meeting_id, db)
    if not _can_access_meeting(event, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Gather meeting context
    context_parts = [
        f"Meeting: {event.title}",
        f"Date: {event.start_time.strftime('%B %d, %Y %I:%M %p')} - {event.end_time.strftime('%I:%M %p')}",
    ]
    if event.description:
        context_parts.append(f"Description: {event.description}")

    # Include chat if requested
    if payload.include_chat:
        chat_result = await db.execute(
            select(MeetingChat).where(MeetingChat.meeting_id == meeting_id)
        )
        chat = chat_result.scalar_one_or_none()
        if chat and chat.messages:
            chat_text = "\n".join(
                f"{m.get('user_name', 'Unknown')}: {m.get('message', '')}"
                for m in (chat.messages or [])
            )
            context_parts.append(f"Chat transcript:\n{chat_text}")

    # Include notes if requested
    if payload.include_notes:
        notes_result = await db.execute(
            select(MeetingNote)
            .where(MeetingNote.meeting_id == meeting_id)
            .order_by(MeetingNote.created_at.asc())
        )
        notes = notes_result.scalars().all()
        if notes:
            notes_text = "\n".join(n.content for n in notes)
            context_parts.append(f"Meeting notes:\n{notes_text}")

    context = "\n\n".join(context_parts)

    try:
        from app.services.ai import AIService  # noqa: PLC0415

        ai_service = AIService()
        result = await ai_service.generate(
            prompt=f"Summarize this meeting and list key decisions and action items:\n\n{context}",
            system_prompt="You are a meeting summarization assistant. Provide concise, actionable summaries.",
            user_id=str(current_user.id),
        )
        return {
            "meeting_id": str(meeting_id),
            "title": event.title,
            "summary": result.get("content", ""),
            "model": result.get("model", "unknown"),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI service unavailable: {exc}",
        ) from exc


# ── Upcoming ─────────────────────────────────────────────────────────────────

@router.get("/upcoming", summary="List upcoming meetings")
async def list_upcoming(
    current_user: CurrentUser,
    db: DBSession,
    days: int = Query(7, ge=1, le=90, description="Number of days ahead"),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=days)

    result = await db.execute(
        select(CalendarEvent)
        .where(
            CalendarEvent.event_type == "meeting",
            CalendarEvent.organizer_id == current_user.id,
            CalendarEvent.start_time >= now,
            CalendarEvent.start_time <= end,
        )
        .order_by(CalendarEvent.start_time.asc())
        .limit(limit)
    )
    meetings = result.scalars().all()
    return {
        "total": len(meetings),
        "meetings": [MeetingOut.model_validate(m).model_dump() for m in meetings],
    }


# ── Instant Meeting ─────────────────────────────────────────────────────────

@router.post(
    "/instant",
    status_code=status.HTTP_201_CREATED,
    summary="Create an instant/quick meeting",
)
async def create_instant_meeting(
    payload: InstantMeetingCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.integrations import jitsi  # noqa: PLC0415

    display_name = (
        getattr(current_user, "full_name", None)
        or getattr(current_user, "email", str(current_user.id))
    )
    email = getattr(current_user, "email", "")

    jitsi_data = jitsi.create_room(
        name=payload.title,
        user_id=str(current_user.id),
        user_name=display_name,
        user_email=email,
    )

    now = datetime.now(timezone.utc)
    event = CalendarEvent(
        title=payload.title,
        description="Instant meeting",
        start_time=now,
        end_time=now + timedelta(hours=1),
        all_day=False,
        event_type="meeting",
        color="#51459d",
        organizer_id=current_user.id,
        attendees=payload.attendees or [],
        jitsi_room=jitsi_data["room_name"],
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    await event_bus.publish("meeting.created", {
        "meeting_id": str(event.id),
        "title": event.title,
        "organizer_id": str(current_user.id),
        "jitsi_room": event.jitsi_room,
        "jitsi_room_url": jitsi_data["room_url"],
        "instant": True,
    })

    return {
        **MeetingOut.model_validate(event).model_dump(),
        "jitsi_room_url": jitsi_data["room_url"],
        "jitsi_jwt": jitsi_data["jwt_token"],
    }


# ── Recurring Meetings ──────────────────────────────────────────────────────

@router.get("/recurring", summary="List recurring meetings")
async def list_recurring_meetings(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.event_type == "meeting",
            CalendarEvent.organizer_id == current_user.id,
            CalendarEvent.recurrence_rule.isnot(None),
        ).order_by(CalendarEvent.start_time.asc())
    )
    meetings = result.scalars().all()
    return {
        "total": len(meetings),
        "meetings": [MeetingOut.model_validate(m).model_dump() for m in meetings],
    }


# ── Templates ────────────────────────────────────────────────────────────────

@router.get("/templates", summary="List meeting templates")
async def list_templates(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(MeetingTemplate).order_by(MeetingTemplate.name.asc())
    )
    templates = result.scalars().all()
    return {
        "total": len(templates),
        "templates": [TemplateOut.model_validate(t).model_dump() for t in templates],
    }


@router.post(
    "/templates",
    status_code=status.HTTP_201_CREATED,
    summary="Create a meeting template",
)
async def create_template(
    payload: TemplateCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    template = MeetingTemplate(
        name=payload.name,
        default_duration_minutes=payload.default_duration_minutes,
        default_settings=payload.default_settings,
        recurring_pattern=payload.recurring_pattern,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return TemplateOut.model_validate(template).model_dump()


# ══════════════════════════════════════════════════════════════════════════════
# Cross-Module Integrations: Tasks, Notes, CRM
# ══════════════════════════════════════════════════════════════════════════════


# ── Schemas ──────────────────────────────────────────────────────────────────

class LinkTaskPayload(BaseModel):
    task_id: str


class LinkContactPayload(BaseModel):
    contact_id: str


class LinkDealPayload(BaseModel):
    deal_id: str


class MeetingLinkOut(BaseModel):
    id: uuid.UUID
    meeting_id: uuid.UUID
    link_type: str
    entity_id: uuid.UUID
    entity_title: str | None
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class CreateMeetingNotePayload(BaseModel):
    """Optional extra content to append when auto-creating a meeting note."""
    extra_content: str | None = None


class MeetingNoteFullOut(BaseModel):
    """Note from the Notes module linked to a meeting."""
    id: uuid.UUID
    title: str
    content: str | None
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Meetings → Projects: Link to Tasks ──────────────────────────────────────

@router.post("/{meeting_id}/link-task", summary="Link a meeting to a project task")
async def link_task(
    meeting_id: uuid.UUID,
    payload: LinkTaskPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    event = await _get_meeting(meeting_id, db)
    if not _can_access_meeting(event, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    from app.models.projects import Task  # noqa: PLC0415

    task_uuid = uuid.UUID(payload.task_id)
    task = await db.get(Task, task_uuid)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    # Check for duplicate link
    existing = await db.execute(
        select(MeetingLink).where(
            MeetingLink.meeting_id == meeting_id,
            MeetingLink.link_type == "task",
            MeetingLink.entity_id == task_uuid,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Task already linked to this meeting")

    link = MeetingLink(
        meeting_id=meeting_id,
        link_type="task",
        entity_id=task_uuid,
        entity_title=task.title,
        created_by=current_user.id,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return MeetingLinkOut.model_validate(link).model_dump()


@router.get("/{meeting_id}/linked-tasks", summary="List tasks linked to a meeting")
async def get_linked_tasks(
    meeting_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    event = await _get_meeting(meeting_id, db)
    if not _can_access_meeting(event, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(MeetingLink).where(
            MeetingLink.meeting_id == meeting_id,
            MeetingLink.link_type == "task",
        ).order_by(MeetingLink.created_at.desc())
    )
    links = result.scalars().all()

    # Enrich with current task data
    from app.models.projects import Task  # noqa: PLC0415

    tasks_out = []
    for link in links:
        task = await db.get(Task, link.entity_id)
        tasks_out.append({
            "link_id": str(link.id),
            "task_id": str(link.entity_id),
            "title": task.title if task else link.entity_title,
            "status": task.status if task else None,
            "priority": task.priority if task else None,
            "project_id": str(task.project_id) if task else None,
            "assignee_id": str(task.assignee_id) if task and task.assignee_id else None,
            "linked_at": link.created_at.isoformat() if link.created_at else None,
        })

    return {"meeting_id": str(meeting_id), "tasks": tasks_out, "total": len(tasks_out)}


@router.delete(
    "/{meeting_id}/unlink-task/{task_id}",
    status_code=status.HTTP_200_OK,
    summary="Unlink a task from a meeting",
)
async def unlink_task(
    meeting_id: uuid.UUID,
    task_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    event = await _get_meeting(meeting_id, db)
    if not _can_access_meeting(event, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(MeetingLink).where(
            MeetingLink.meeting_id == meeting_id,
            MeetingLink.link_type == "task",
            MeetingLink.entity_id == task_id,
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task link not found")

    await db.delete(link)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ── Meetings → Notes: Auto-Create Meeting Notes ─────────────────────────────

@router.post("/{meeting_id}/create-note", summary="Create a Note linked to this meeting")
async def create_meeting_note(
    meeting_id: uuid.UUID,
    payload: CreateMeetingNotePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    event = await _get_meeting(meeting_id, db)
    if not _can_access_meeting(event, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    from app.models.notes import Note  # noqa: PLC0415

    # Build meeting note content
    attendee_list = event.attendees or []
    attendees_str = ", ".join(
        att.get("user_id", att) if isinstance(att, dict) else str(att)
        for att in attendee_list
    ) or "None"

    content_parts = [
        f"# Meeting Notes: {event.title}\n",
        f"**Date:** {event.start_time.strftime('%B %d, %Y %I:%M %p')} - {event.end_time.strftime('%I:%M %p')}",
        f"**Attendees:** {attendees_str}",
    ]
    if event.description:
        content_parts.append(f"**Description:** {event.description}")
    content_parts.append("\n---\n## Notes\n")
    if payload.extra_content:
        content_parts.append(payload.extra_content)

    content = "\n".join(content_parts)

    note = Note(
        title=f"Meeting Notes: {event.title}",
        content=content,
        owner_id=current_user.id,
        tags=["meeting-note"],
        linked_items=[{
            "type": "meeting",
            "id": str(meeting_id),
            "title": event.title,
        }],
    )
    db.add(note)
    await db.flush()

    # Also create a MeetingLink back to the note
    link = MeetingLink(
        meeting_id=meeting_id,
        link_type="note",
        entity_id=note.id,
        entity_title=note.title,
        created_by=current_user.id,
    )
    db.add(link)
    await db.commit()
    await db.refresh(note)

    return {
        "meeting_id": str(meeting_id),
        "note": MeetingNoteFullOut.model_validate(note).model_dump(),
        "link_id": str(link.id),
    }


@router.get("/{meeting_id}/meeting-notes", summary="List Notes linked to a meeting")
async def get_meeting_notes(
    meeting_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    event = await _get_meeting(meeting_id, db)
    if not _can_access_meeting(event, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(MeetingLink).where(
            MeetingLink.meeting_id == meeting_id,
            MeetingLink.link_type == "note",
        ).order_by(MeetingLink.created_at.desc())
    )
    links = result.scalars().all()

    from app.models.notes import Note  # noqa: PLC0415

    notes_out = []
    for link in links:
        note = await db.get(Note, link.entity_id)
        if note:
            notes_out.append({
                "link_id": str(link.id),
                "note_id": str(note.id),
                "title": note.title,
                "content_preview": (note.content or "")[:200],
                "created_at": note.created_at.isoformat() if note.created_at else None,
                "linked_at": link.created_at.isoformat() if link.created_at else None,
            })

    return {"meeting_id": str(meeting_id), "notes": notes_out, "total": len(notes_out)}


# ── Meetings → CRM: Link to Contacts/Deals ──────────────────────────────────

@router.post("/{meeting_id}/link-contact", summary="Link a meeting to a CRM contact")
async def link_contact(
    meeting_id: uuid.UUID,
    payload: LinkContactPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    event = await _get_meeting(meeting_id, db)
    if not _can_access_meeting(event, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    from app.models.crm import Contact  # noqa: PLC0415

    contact_uuid = uuid.UUID(payload.contact_id)
    contact = await db.get(Contact, contact_uuid)
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")

    # Check for duplicate
    existing = await db.execute(
        select(MeetingLink).where(
            MeetingLink.meeting_id == meeting_id,
            MeetingLink.link_type == "contact",
            MeetingLink.entity_id == contact_uuid,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Contact already linked")

    display_name = (
        f"{contact.first_name or ''} {contact.last_name or ''}".strip()
        or contact.company_name
        or contact.email
        or "Unnamed Contact"
    )

    link = MeetingLink(
        meeting_id=meeting_id,
        link_type="contact",
        entity_id=contact_uuid,
        entity_title=display_name,
        created_by=current_user.id,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return MeetingLinkOut.model_validate(link).model_dump()


@router.post("/{meeting_id}/link-deal", summary="Link a meeting to a CRM deal")
async def link_deal(
    meeting_id: uuid.UUID,
    payload: LinkDealPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    event = await _get_meeting(meeting_id, db)
    if not _can_access_meeting(event, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    from app.models.crm import Deal  # noqa: PLC0415

    deal_uuid = uuid.UUID(payload.deal_id)
    deal = await db.get(Deal, deal_uuid)
    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    # Check for duplicate
    existing = await db.execute(
        select(MeetingLink).where(
            MeetingLink.meeting_id == meeting_id,
            MeetingLink.link_type == "deal",
            MeetingLink.entity_id == deal_uuid,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Deal already linked")

    link = MeetingLink(
        meeting_id=meeting_id,
        link_type="deal",
        entity_id=deal_uuid,
        entity_title=deal.title,
        created_by=current_user.id,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return MeetingLinkOut.model_validate(link).model_dump()


@router.get("/{meeting_id}/linked-crm", summary="Get CRM contacts and deals linked to a meeting")
async def get_linked_crm(
    meeting_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    event = await _get_meeting(meeting_id, db)
    if not _can_access_meeting(event, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(MeetingLink).where(
            MeetingLink.meeting_id == meeting_id,
            MeetingLink.link_type.in_(["contact", "deal"]),
        ).order_by(MeetingLink.created_at.desc())
    )
    links = result.scalars().all()

    from app.models.crm import Contact, Deal  # noqa: PLC0415

    contacts_out = []
    deals_out = []

    for link in links:
        if link.link_type == "contact":
            contact = await db.get(Contact, link.entity_id)
            contacts_out.append({
                "link_id": str(link.id),
                "contact_id": str(link.entity_id),
                "name": link.entity_title,
                "email": contact.email if contact else None,
                "phone": contact.phone if contact else None,
                "company": contact.company_name if contact else None,
                "linked_at": link.created_at.isoformat() if link.created_at else None,
            })
        elif link.link_type == "deal":
            deal = await db.get(Deal, link.entity_id)
            deals_out.append({
                "link_id": str(link.id),
                "deal_id": str(link.entity_id),
                "title": link.entity_title,
                "value": str(deal.deal_value) if deal else None,
                "currency": deal.currency if deal else None,
                "status": deal.status if deal else None,
                "linked_at": link.created_at.isoformat() if link.created_at else None,
            })

    return {
        "meeting_id": str(meeting_id),
        "contacts": contacts_out,
        "deals": deals_out,
        "total": len(contacts_out) + len(deals_out),
    }


@router.delete(
    "/{meeting_id}/unlink-crm/{link_type}/{entity_id}",
    status_code=status.HTTP_200_OK,
    summary="Unlink a CRM contact or deal from a meeting",
)
async def unlink_crm(
    meeting_id: uuid.UUID,
    link_type: str,
    entity_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    if link_type not in ("contact", "deal"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="link_type must be 'contact' or 'deal'",
        )

    event = await _get_meeting(meeting_id, db)
    if not _can_access_meeting(event, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(MeetingLink).where(
            MeetingLink.meeting_id == meeting_id,
            MeetingLink.link_type == link_type,
            MeetingLink.entity_id == entity_id,
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")

    await db.delete(link)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)
