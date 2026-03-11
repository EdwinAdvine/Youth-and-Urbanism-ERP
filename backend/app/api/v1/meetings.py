"""Meetings API — calendar events with an associated Jitsi room."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.calendar import CalendarEvent

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class MeetingCreate(BaseModel):
    title: str
    description: str | None = None
    start_time: datetime
    end_time: datetime
    location: str | None = None
    attendees: list[str] | None = None  # list of user-id strings
    color: str | None = "#51459d"


class MeetingUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    location: str | None = None
    attendees: list[str] | None = None
    color: str | None = None


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


# ── Helpers ────────────────────────────────────────────────────────────────────

def _event_to_meeting_out(event: CalendarEvent) -> MeetingOut:
    return MeetingOut.model_validate(event)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", summary="List meetings (calendar events with type=meeting)")
async def list_meetings(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(CalendarEvent)
        .where(
            CalendarEvent.event_type == "meeting",
            CalendarEvent.organizer_id == current_user.id,
        )
        .order_by(CalendarEvent.start_time.desc())
    )
    meetings = result.scalars().all()
    return {
        "total": len(meetings),
        "meetings": [MeetingOut.model_validate(m) for m in meetings],
    }


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create a meeting with a Jitsi room")
async def create_meeting(
    payload: MeetingCreate,
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

    event = CalendarEvent(
        title=payload.title,
        description=payload.description,
        start_time=payload.start_time,
        end_time=payload.end_time,
        all_day=False,
        event_type="meeting",
        color=payload.color or "#51459d",
        location=payload.location,
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
        "organizer_email": email,
        "organizer_name": display_name,
        "start_time": event.start_time.isoformat(),
        "end_time": event.end_time.isoformat(),
        "jitsi_room": event.jitsi_room,
        "jitsi_room_url": jitsi_data["room_url"],
        "attendees": payload.attendees or [],
        "description": payload.description or "",
    })

    # Auto-send email invites to attendees
    if payload.attendees:
        try:
            from app.models.user import User  # noqa: PLC0415

            attendee_emails = []
            for att_id in payload.attendees:
                try:
                    user = await db.get(User, uuid.UUID(att_id))
                    if user and getattr(user, "email", None):
                        attendee_emails.append(user.email)
                except (ValueError, Exception):
                    pass

            if attendee_emails:
                from app.integrations import stalwart  # noqa: PLC0415

                invite_body = (
                    f"You have been invited to a meeting.\n\n"
                    f"Title: {event.title}\n"
                    f"When: {event.start_time.strftime('%B %d, %Y %I:%M %p')} – {event.end_time.strftime('%I:%M %p')}\n"
                    f"Organizer: {display_name}\n"
                    f"Join: {jitsi_data['room_url']}\n"
                )
                if payload.description:
                    invite_body += f"\nDescription: {payload.description}\n"

                await stalwart.send_message(
                    from_email=email,
                    to=attendee_emails,
                    subject=f"Meeting Invite: {event.title}",
                    body=invite_body,
                )
        except Exception:
            pass  # Don't fail meeting creation if invite sending fails

    return {
        **MeetingOut.model_validate(event).model_dump(),
        "jitsi_room_url": jitsi_data["room_url"],
        "jitsi_jwt": jitsi_data["jwt_token"],
    }


@router.get("/{meeting_id}", summary="Get meeting details")
async def get_meeting(
    meeting_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    event = await db.get(CalendarEvent, meeting_id)
    if not event or event.event_type != "meeting":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    # Organizer or attendee can view
    attendees: list = event.attendees or []
    if event.organizer_id != current_user.id and str(current_user.id) not in attendees:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return MeetingOut.model_validate(event).model_dump()


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a meeting")
async def delete_meeting(
    meeting_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    event = await db.get(CalendarEvent, meeting_id)
    if not event or event.event_type != "meeting":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    if event.organizer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the organizer can delete this meeting")
    meeting_id = str(event.id)
    await db.delete(event)
    await db.commit()

    await event_bus.publish("meeting.deleted", {
        "meeting_id": meeting_id,
        "organizer_id": str(current_user.id),
    })

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{meeting_id}/join", summary="Get Jitsi room URL and JWT for joining")
async def join_meeting(
    meeting_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.integrations import jitsi  # noqa: PLC0415

    event = await db.get(CalendarEvent, meeting_id)
    if not event or event.event_type != "meeting":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    attendees: list = event.attendees or []
    if event.organizer_id != current_user.id and str(current_user.id) not in attendees:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if not event.jitsi_room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Jitsi room associated with this meeting",
        )

    display_name = (
        getattr(current_user, "full_name", None)
        or getattr(current_user, "email", str(current_user.id))
    )
    email = getattr(current_user, "email", "")

    token = jitsi.generate_jwt(
        room=event.jitsi_room,
        user={
            "id": str(current_user.id),
            "name": display_name,
            "email": email,
        },
    )

    from app.core.config import settings  # noqa: PLC0415
    room_url = f"{settings.JITSI_PUBLIC_URL}/{event.jitsi_room}?jwt={token}"

    return {
        "meeting_id": str(meeting_id),
        "room_name": event.jitsi_room,
        "room_url": room_url,
        "jwt_token": token,
    }


# ── Recording webhook ────────────────────────────────────────────────────────

@router.post("/recording-webhook", summary="Jitsi recording webhook — auto-save to Drive/MinIO")
async def recording_webhook(request: Request) -> dict[str, Any]:
    """Handle Jitsi Jibri recording completion webhook.

    When Jitsi finishes recording a meeting, it POSTs metadata here.
    We download the recording and upload it to MinIO under meetings/ folder.
    """
    import logging  # noqa: PLC0415
    logger = logging.getLogger(__name__)

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    room_name = body.get("room_name") or body.get("roomName", "")
    recording_url = body.get("recording_url") or body.get("recordingUrl", "")
    file_name = body.get("file_name") or body.get("fileName") or f"recording-{room_name}.mp4"

    if not recording_url:
        logger.warning("Recording webhook called without recording_url")
        return {"status": "ignored", "reason": "no recording_url"}

    try:
        import httpx  # noqa: PLC0415
        from app.integrations.minio_client import upload_file_from_bytes  # noqa: PLC0415

        # Download the recording
        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.get(recording_url)
            resp.raise_for_status()
            recording_bytes = resp.content

        # Upload to MinIO under meetings/ prefix
        minio_key = f"meetings/{room_name}/{file_name}"
        content_type = "video/mp4"
        upload_file_from_bytes(
            data=recording_bytes,
            object_name=minio_key,
            content_type=content_type,
        )

        # Create a Drive file entry for the recording
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.drive import DriveFile  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            # Find the meeting to get organizer_id
            result = await db.execute(
                select(CalendarEvent).where(CalendarEvent.jitsi_room == room_name).limit(1)
            )
            meeting = result.scalar_one_or_none()
            owner_id = str(meeting.organizer_id) if meeting else None

            if owner_id:
                drive_file = DriveFile(
                    name=file_name,
                    content_type=content_type,
                    size=len(recording_bytes),
                    minio_key=minio_key,
                    folder_path="meetings",
                    owner_id=owner_id,
                )
                db.add(drive_file)
                await db.commit()
                logger.info("Saved meeting recording to Drive: %s (%d bytes)", minio_key, len(recording_bytes))

        await event_bus.publish("meeting.recording.saved", {
            "room_name": room_name,
            "file_name": file_name,
            "minio_key": minio_key,
            "size": len(recording_bytes),
            "organizer_id": owner_id,
        })

        return {"status": "saved", "minio_key": minio_key, "size": len(recording_bytes)}

    except Exception as exc:
        logger.exception("Failed to save meeting recording: %s", exc)
        return {"status": "error", "error": str(exc)}
