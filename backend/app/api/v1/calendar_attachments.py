"""Calendar Event Attachments — upload, list, delete, and presigned download."""

import uuid
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.calendar import CalendarEvent, EventAttachment

router = APIRouter(prefix="/calendar", tags=["Calendar - Attachments"])

# 25 MB limit per file
_MAX_FILE_SIZE = 25 * 1024 * 1024  # bytes

# The project's primary bucket for non-Drive uploads
_BUCKET = "urban-vibes-dynamics-files"


# ── Pydantic response schema ────────────────────────────────────────────────────

class AttachmentOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    file_name: str
    file_size: int | None
    mime_type: str | None
    minio_key: str | None
    uploaded_by: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Helpers ─────────────────────────────────────────────────────────────────────

async def _get_event_or_404(db: DBSession, event_id: uuid.UUID) -> CalendarEvent:
    event = await db.get(CalendarEvent, event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


async def _get_attachment_or_404(
    db: DBSession, event_id: uuid.UUID, attachment_id: uuid.UUID
) -> EventAttachment:
    result = await db.execute(
        select(EventAttachment).where(
            EventAttachment.id == attachment_id,
            EventAttachment.event_id == event_id,
        )
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found"
        )
    return attachment


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post(
    "/events/{event_id}/attachments",
    status_code=status.HTTP_201_CREATED,
    response_model=AttachmentOut,
    summary="Upload a file attachment to a calendar event",
)
async def upload_attachment(
    event_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    file: UploadFile = File(...),
) -> AttachmentOut:
    """Upload a file (max 25 MB) and attach it to the given calendar event.

    The file is stored in MinIO under:
        ``calendar/attachments/{event_id}/{unique_id}_{original_filename}``

    The caller must be authenticated.  Any attendee or organizer may attach files.
    """
    await _get_event_or_404(db, event_id)

    # Read and validate file size
    file_data = await file.read()
    if len(file_data) > _MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds the 25 MB limit",
        )

    original_name = file.filename or "attachment"
    mime = file.content_type or "application/octet-stream"
    unique_prefix = str(uuid.uuid4())
    object_key = f"calendar/attachments/{event_id}/{unique_prefix}_{original_name}"

    # Upload to MinIO using the upload_file_from_bytes helper which accepts
    # an arbitrary object key (no user-prefix mangling).
    # We monkey-patch _BUCKET into the call via a direct boto3 call to keep
    # the right bucket, OR we use upload_file_from_bytes (which targets
    # urban-vibes-dynamics-drive).  Since the project uses urban-vibes-dynamics-files for attachments
    # we call the client directly.
    try:
        import boto3  # noqa: PLC0415
        from botocore.client import Config  # noqa: PLC0415
        import io  # noqa: PLC0415
        from app.core.config import settings  # noqa: PLC0415

        s3 = boto3.client(
            "s3",
            endpoint_url=settings.MINIO_URL,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
            ),
            region_name="us-east-1",
        )

        # Ensure the bucket exists
        try:
            s3.head_bucket(Bucket=_BUCKET)
        except Exception:
            try:
                s3.create_bucket(Bucket=_BUCKET)
            except Exception:
                pass

        s3.put_object(
            Bucket=_BUCKET,
            Key=object_key,
            Body=io.BytesIO(file_data),
            ContentType=mime,
            ContentLength=len(file_data),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"MinIO upload failed: {exc}",
        ) from exc

    attachment = EventAttachment(
        event_id=event_id,
        file_name=original_name,
        file_size=len(file_data),
        mime_type=mime,
        minio_key=object_key,
        uploaded_by=current_user.id,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)

    return AttachmentOut.model_validate(attachment)


@router.get(
    "/events/{event_id}/attachments",
    response_model=list[AttachmentOut],
    summary="List all attachments for a calendar event",
)
async def list_attachments(
    event_id: uuid.UUID,
    current_user: CurrentUser,  # noqa: ARG001 — ensures authenticated
    db: DBSession,
) -> list[AttachmentOut]:
    """Return all file attachments belonging to the given event."""
    await _get_event_or_404(db, event_id)

    result = await db.execute(
        select(EventAttachment)
        .where(EventAttachment.event_id == event_id)
        .order_by(EventAttachment.created_at.asc())
    )
    attachments = result.scalars().all()
    return [AttachmentOut.model_validate(a) for a in attachments]


@router.delete(
    "/events/{event_id}/attachments/{attachment_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a calendar event attachment",
)
async def delete_attachment(
    event_id: uuid.UUID,
    attachment_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, str]:
    """Delete an attachment from MinIO and the database.

    Only the uploader of the attachment **or** the organizer of the event may
    perform this action.
    """
    event = await _get_event_or_404(db, event_id)
    attachment = await _get_attachment_or_404(db, event_id, attachment_id)

    is_uploader = attachment.uploaded_by == current_user.id
    is_organizer = event.organizer_id == current_user.id

    if not (is_uploader or is_organizer):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the attachment uploader or event organizer can delete attachments",
        )

    # Remove from MinIO
    if attachment.minio_key:
        try:
            import boto3  # noqa: PLC0415
            from botocore.client import Config  # noqa: PLC0415
            from app.core.config import settings  # noqa: PLC0415

            s3 = boto3.client(
                "s3",
                endpoint_url=settings.MINIO_URL,
                aws_access_key_id=settings.MINIO_ACCESS_KEY,
                aws_secret_access_key=settings.MINIO_SECRET_KEY,
                config=Config(
                    signature_version="s3v4",
                    s3={"addressing_style": "path"},
                ),
                region_name="us-east-1",
            )
            s3.delete_object(Bucket=_BUCKET, Key=attachment.minio_key)
        except Exception:
            # Non-fatal: we still delete the DB record so the UI stays clean.
            pass

    await db.delete(attachment)
    await db.commit()
    return {"status": "deleted", "attachment_id": str(attachment_id)}


@router.get(
    "/events/{event_id}/attachments/{attachment_id}/download",
    summary="Get a presigned download URL for an attachment",
)
async def download_attachment(
    event_id: uuid.UUID,
    attachment_id: uuid.UUID,
    current_user: CurrentUser,  # noqa: ARG001 — ensures authenticated
    db: DBSession,
    redirect: bool = False,
) -> dict[str, str]:
    """Return (or redirect to) a MinIO presigned URL valid for 1 hour.

    Query param ``redirect=true`` sends an HTTP 302 redirect directly to the
    presigned URL.  Default behaviour returns JSON ``{"url": "..."}``.
    """
    await _get_event_or_404(db, event_id)
    attachment = await _get_attachment_or_404(db, event_id, attachment_id)

    if not attachment.minio_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No MinIO key stored for this attachment",
        )

    try:
        import boto3  # noqa: PLC0415
        from botocore.client import Config  # noqa: PLC0415
        from app.core.config import settings  # noqa: PLC0415

        s3 = boto3.client(
            "s3",
            endpoint_url=settings.MINIO_URL,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
            ),
            region_name="us-east-1",
        )
        presigned_url: str = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": _BUCKET, "Key": attachment.minio_key},
            ExpiresIn=3600,  # 1 hour
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to generate presigned URL: {exc}",
        ) from exc

    if redirect:
        return RedirectResponse(url=presigned_url, status_code=302)  # type: ignore[return-value]

    return {
        "url": presigned_url,
        "file_name": attachment.file_name,
        "mime_type": attachment.mime_type or "application/octet-stream",
        "expires_in": 3600,
    }
