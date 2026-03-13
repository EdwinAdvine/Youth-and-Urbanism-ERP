"""Email-to-Note inbound processing via Stalwart IMAP polling.

Provides two endpoints:
  GET  /notes/email/address          — user's personal notes email address
  POST /notes/email/process-inbound  — internal webhook called by Celery beat

The actual IMAP polling is handled by a Celery beat task (tasks/celery_app.py).
This router handles:
  1. Returning the deterministic per-user email address.
  2. Accepting processed inbound email payloads and creating notes from them.
"""

import hashlib
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession
from app.models.notes import Note

router = APIRouter(tags=["Notes Email Inbound"])

_EMAIL_DOMAIN = "erp.local"


# ── Helpers ─────────────────────────────────────────────────────────────────

def _user_email_address(user_id: uuid.UUID) -> str:
    """Return the deterministic notes-inbound address for a user.

    Format: notes+{first8hexofsha256(user_id)}@erp.local
    Example: notes+a3f8c2d1@erp.local
    """
    uid_hash = hashlib.sha256(str(user_id).encode()).hexdigest()[:8]
    return f"notes+{uid_hash}@{_EMAIL_DOMAIN}"


# ── Schemas ──────────────────────────────────────────────────────────────────

class InboundEmailPayload(BaseModel):
    """Payload sent by the Celery IMAP polling task."""
    from_email: str
    subject: str
    body_text: str | None = None
    body_html: str | None = None
    # Internal auth: Celery sets this to the resolved owner's user_id
    owner_user_id: str | None = None


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/email/address", summary="Get the user's personal notes email address")
async def get_notes_email_address(current_user: CurrentUser) -> dict[str, str]:
    """Return the inbound email address that creates notes on behalf of the user.

    Any email sent to this address by the Celery IMAP task will automatically
    become a new note in the user's default notebook.
    """
    return {
        "address": _user_email_address(current_user.id),
        "description": (
            "Forward or send emails to this address to automatically create notes. "
            "Subject becomes the note title; body becomes the content."
        ),
    }


@router.post(
    "/email/process-inbound",
    summary="Process an inbound email and create a note (internal, Celery only)",
    status_code=201,
)
async def process_inbound_email(
    payload: InboundEmailPayload,
    db: DBSession,
) -> dict[str, Any]:
    """Create a note from an inbound email message.

    This endpoint is called internally by the Celery beat IMAP polling task.
    It does NOT require user authentication (it is called by a trusted background
    process). In a production hardened deployment you would add an internal API
    key header check here.

    The `owner_user_id` field in the payload must be set by the Celery task after
    it resolves the destination address to a user.
    """
    if not payload.owner_user_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="owner_user_id is required for inbound email processing",
        )

    try:
        owner_id = uuid.UUID(payload.owner_user_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid owner_user_id UUID")

    # Choose content: prefer plain text; fall back to HTML
    content = payload.body_text or payload.body_html or ""
    title = payload.subject.strip() or f"Email from {payload.from_email}"

    note = Note(
        title=title[:500],
        content=content,
        content_format="html" if payload.body_html and not payload.body_text else "html",
        owner_id=owner_id,
        source_type="email",
        tags=["email-inbound"],
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)

    return {
        "id": str(note.id),
        "title": note.title,
        "source_type": note.source_type,
        "owner_id": str(note.owner_id),
        "created_at": note.created_at.isoformat(),
    }
