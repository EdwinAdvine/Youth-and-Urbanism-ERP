"""NoteShareLink — public share links for notes with optional password and expiry.

Separate from NoteShareRecord (user-to-user internal sharing).
This model supports anonymous public sharing via tokenised URLs.
"""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class NoteShareLink(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A public share link for a note.

    Token is a UUID4 used as the URL slug, e.g. /notes/share/{token}.
    Password hash is optional (bcrypt via passlib).
    """

    __tablename__ = "note_share_links"

    note_id: Mapped[uuid.UUID] = mapped_column(
        "note_id",
        ForeignKey("notes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True,
        default=lambda: str(uuid.uuid4()),
    )
    password_hash: Mapped[str | None] = mapped_column(String(256), nullable=True)
    expires_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    permissions: Mapped[str] = mapped_column(
        String(10), nullable=False, default="view",
        comment="view | edit | comment",
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    note = relationship("Note", foreign_keys=[note_id])
    created_by = relationship("User", foreign_keys=[created_by_id])

    def __repr__(self) -> str:
        return f"<NoteShareLink note={self.note_id} token={self.token!r} perms={self.permissions!r}>"
