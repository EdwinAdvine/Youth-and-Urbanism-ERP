"""Public share links for notes — password-protected, expiry-aware."""

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession
from app.models.notes import Note
from app.models.note_share_link import NoteShareLink

try:
    from passlib.context import CryptContext
    _pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    _PASSLIB_AVAILABLE = True
except ImportError:  # pragma: no cover
    _PASSLIB_AVAILABLE = False
    _pwd_ctx = None  # type: ignore[assignment]


router = APIRouter(tags=["Notes Share Links"])


# ── Helpers ─────────────────────────────────────────────────────────────────

def _hash_password(plain: str) -> str:
    if not _PASSLIB_AVAILABLE or _pwd_ctx is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="passlib is not installed; password-protected links are unavailable.",
        )
    return _pwd_ctx.hash(plain)


def _verify_password(plain: str, hashed: str) -> bool:
    if not _PASSLIB_AVAILABLE or _pwd_ctx is None:
        return False
    return _pwd_ctx.verify(plain, hashed)


def _link_to_dict(link: NoteShareLink) -> dict[str, Any]:
    return {
        "id": str(link.id),
        "note_id": str(link.note_id),
        "token": link.token,
        "has_password": link.password_hash is not None,
        "expires_at": link.expires_at.isoformat() if link.expires_at else None,
        "permissions": link.permissions,
        "created_by_id": str(link.created_by_id) if link.created_by_id else None,
        "created_at": link.created_at.isoformat(),
        "is_active": link.is_active,
    }


async def _get_note_or_404(note_id: str, db: AsyncSession, user_id: uuid.UUID) -> Note:
    result = await db.execute(
        select(Note).where(Note.id == uuid.UUID(note_id), Note.owner_id == user_id)
    )
    note = result.scalar_one_or_none()
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


# ── Schemas ──────────────────────────────────────────────────────────────────

class CreateShareLinkRequest(BaseModel):
    permissions: str = "view"          # view | edit | comment
    password: str | None = None
    expires_at: datetime | None = None


class AccessShareLinkRequest(BaseModel):
    password: str | None = None


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/{note_id}/share-links", summary="Create a public share link for a note")
async def create_share_link(
    note_id: str,
    body: CreateShareLinkRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> dict[str, Any]:
    """Create a public share link (optionally password-protected or expiring)."""
    await _get_note_or_404(note_id, db, current_user.id)

    link = NoteShareLink(
        note_id=uuid.UUID(note_id),
        token=str(uuid.uuid4()),
        permissions=body.permissions,
        expires_at=body.expires_at,
        created_by_id=current_user.id,
        is_active=True,
    )
    if body.password:
        link.password_hash = _hash_password(body.password)

    db.add(link)
    await db.commit()
    await db.refresh(link)
    return {"share_link": _link_to_dict(link)}


@router.get("/share/{token}", summary="Get note by public share token")
async def get_note_by_share_token(
    token: str,
    db: DBSession,
    password: str | None = None,
) -> dict[str, Any]:
    """Access a note via its public share token. Validates password and expiry."""
    result = await db.execute(
        select(NoteShareLink).where(
            NoteShareLink.token == token,
            NoteShareLink.is_active.is_(True),
        )
    )
    link = result.scalar_one_or_none()
    if link is None:
        raise HTTPException(status_code=404, detail="Share link not found or inactive")

    # Check expiry
    if link.expires_at and link.expires_at < datetime.now(tz=timezone.utc):
        raise HTTPException(status_code=410, detail="This share link has expired")

    # Check password
    if link.password_hash:
        if not password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="This share link is password-protected",
            )
        if not _verify_password(password, link.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password",
            )

    # Fetch the note
    note_result = await db.execute(select(Note).where(Note.id == link.note_id))
    note = note_result.scalar_one_or_none()
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    return {
        "note": {
            "id": str(note.id),
            "title": note.title,
            "content": note.content,
            "content_format": note.content_format,
            "icon": note.icon,
            "updated_at": note.updated_at.isoformat(),
        },
        "permissions": link.permissions,
    }


@router.get("/{note_id}/share-links", summary="List share links for a note")
async def list_share_links(
    note_id: str,
    db: DBSession,
    current_user: CurrentUser,
) -> dict[str, Any]:
    """Return all share links owned by the current user for a given note."""
    await _get_note_or_404(note_id, db, current_user.id)

    result = await db.execute(
        select(NoteShareLink).where(
            NoteShareLink.note_id == uuid.UUID(note_id),
            NoteShareLink.created_by_id == current_user.id,
        )
    )
    links = result.scalars().all()
    return {"share_links": [_link_to_dict(lnk) for lnk in links]}


@router.delete(
    "/{note_id}/share-links/{link_id}",
    summary="Delete (deactivate) a share link",
    status_code=200,
)
async def delete_share_link(
    note_id: str,
    link_id: str,
    db: DBSession,
    current_user: CurrentUser,
) -> None:
    """Soft-delete a share link by marking it inactive."""
    await _get_note_or_404(note_id, db, current_user.id)

    result = await db.execute(
        select(NoteShareLink).where(
            NoteShareLink.id == uuid.UUID(link_id),
            NoteShareLink.note_id == uuid.UUID(note_id),
            NoteShareLink.created_by_id == current_user.id,
        )
    )
    link = result.scalar_one_or_none()
    if link is None:
        raise HTTPException(status_code=404, detail="Share link not found")

    link.is_active = False
    await db.commit()
