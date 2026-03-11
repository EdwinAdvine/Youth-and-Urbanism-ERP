"""Meetings API — calendar events with an associated Jitsi room."""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response, UploadFile, File, status
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
                from app.integrations.smtp_client import send_email  # noqa: PLC0415

                invite_body = (
                    f"You have been invited to a meeting.\n\n"
                    f"Title: {event.title}\n"
                    f"When: {event.start_time.strftime('%B %d, %Y %I:%M %p')} – {event.end_time.strftime('%I:%M %p')}\n"
                    f"Organizer: {display_name}\n"
                    f"Join: {jitsi_data['room_url']}\n"
                )
                if payload.description:
                    invite_body += f"\nDescription: {payload.description}\n"

                await send_email(
                    from_addr=email,
                    to_addrs=attendee_emails,
                    subject=f"Meeting Invite: {event.title}",
                    body_text=invite_body,
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


# ── Virtual Backgrounds ─────────────────────────────────────────────────────

VIRTUAL_BG_PREFIX = "virtual-backgrounds/"
DEFAULT_BACKGROUNDS = [
    {"id": "solid-blur", "name": "Blur", "type": "blur", "url": ""},
    {"id": "solid-1", "name": "Dark Gray", "type": "color", "url": "#1a1a2e"},
    {"id": "solid-2", "name": "Deep Purple", "type": "color", "url": "#51459d"},
    {"id": "solid-3", "name": "Navy", "type": "color", "url": "#0f3460"},
    {"id": "solid-4", "name": "Forest Green", "type": "color", "url": "#1b4332"},
    {"id": "solid-5", "name": "Warm Gray", "type": "color", "url": "#4a4e69"},
]


@router.get("/virtual-backgrounds", summary="List available virtual backgrounds")
async def list_virtual_backgrounds(
    current_user: CurrentUser,
) -> dict[str, Any]:
    """Return built-in solid-color/blur backgrounds plus any custom images uploaded to MinIO."""
    backgrounds = list(DEFAULT_BACKGROUNDS)

    try:
        from app.integrations import minio_client  # noqa: PLC0415

        uploaded = minio_client.list_files(user_id="system", folder_path="virtual-backgrounds")
        for item in uploaded:
            download_url = minio_client.get_download_url(item["minio_key"])
            backgrounds.append({
                "id": item["minio_key"],
                "name": item["filename"],
                "type": "image",
                "url": download_url,
            })
    except Exception:
        pass  # MinIO may not be available in dev

    return {"backgrounds": backgrounds, "total": len(backgrounds)}


@router.post("/virtual-backgrounds", status_code=status.HTTP_201_CREATED, summary="Upload a custom virtual background")
async def upload_virtual_background(
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> dict[str, Any]:
    """Upload a custom image as a virtual background to MinIO."""
    allowed_types = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File type {file.content_type} not allowed. Use PNG, JPEG, or WebP.",
        )

    max_size = 5 * 1024 * 1024  # 5 MB
    file_data = await file.read()
    if len(file_data) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size is 5 MB.",
        )

    try:
        from app.integrations import minio_client  # noqa: PLC0415

        result = minio_client.upload_file(
            file_data=file_data,
            filename=file.filename or "background.png",
            user_id="system",
            folder_path="virtual-backgrounds",
            content_type=file.content_type or "image/png",
        )
        download_url = minio_client.get_download_url(result["minio_key"])
        return {
            "id": result["minio_key"],
            "name": result["filename"],
            "type": "image",
            "url": download_url,
            "size": result["size"],
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to upload background: {exc}",
        ) from exc


# ── SIP Dial-In ────────────────────────────────────────────────────────────

@router.post("/{meeting_id}/dial-in", summary="Get SIP dial-in details for a meeting")
async def get_dial_in(
    meeting_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Generate SIP dial-in details for a meeting if SIP is configured."""
    from app.models.settings import SystemSettings  # noqa: PLC0415

    event = await db.get(CalendarEvent, meeting_id)
    if not event or event.event_type != "meeting":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    attendees: list = event.attendees or []
    if event.organizer_id != current_user.id and str(current_user.id) not in attendees:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Fetch SIP config from system settings
    result = await db.execute(
        select(SystemSettings).where(
            SystemSettings.key == "meetings_sip_config",
            SystemSettings.category == "meetings_admin",
        )
    )
    row = result.scalar_one_or_none()
    sip_config: dict = {}
    if row and row.value:
        try:
            sip_config = json.loads(row.value)
        except json.JSONDecodeError:
            pass

    if not sip_config.get("sip_enabled"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SIP gateway is not configured or not enabled",
        )

    # Generate a meeting-specific PIN from meeting ID
    meeting_pin = str(int(meeting_id.int % 10**8)).zfill(8)
    pin_prefix = sip_config.get("dial_in_pin_prefix", "")
    full_pin = f"{pin_prefix}{meeting_pin}" if pin_prefix else meeting_pin

    dial_in_number = sip_config.get("dial_in_number", "")
    sip_server = sip_config.get("sip_server", "")

    sip_uri = ""
    if sip_server and event.jitsi_room:
        sip_uri = f"sip:{event.jitsi_room}@{sip_server}"

    return {
        "meeting_id": str(meeting_id),
        "dial_in_number": dial_in_number,
        "meeting_pin": full_pin,
        "sip_uri": sip_uri,
        "jitsi_room": event.jitsi_room,
        "instructions": (
            f"Dial {dial_in_number} and enter PIN {full_pin} when prompted."
            if dial_in_number
            else f"Use SIP client to dial {sip_uri}"
        ),
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
