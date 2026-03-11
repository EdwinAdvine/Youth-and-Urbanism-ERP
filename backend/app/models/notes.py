"""Note model for the personal notes feature."""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Note(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A personal note owned by a single user.

    ``tags`` is stored as a PostgreSQL ARRAY of TEXT values for efficient
    tag-based filtering without a separate join table.
    ``is_pinned`` floats the note to the top of the user's note list.
    """

    __tablename__ = "notes"

    title: Mapped[str] = mapped_column(String(500), nullable=False, default="Untitled")
    content: Mapped[str | None] = mapped_column(Text, nullable=True)

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # PostgreSQL native array; use JSON fallback on non-PG engines if needed
    tags: Mapped[list[str] | None] = mapped_column(
        ARRAY(String(100)),
        nullable=True,
        default=list,
    )

    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Sharing
    shared_with: Mapped[list | None] = mapped_column(
        JSON, nullable=True, default=list,
        comment="JSON array of user-id strings this note is shared with",
    )
    is_shared: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Deep links to other modules: [{type: "doc"|"file"|"folder"|"calendar"|"project"|"task", id: "...", title: "..."}]
    linked_items: Mapped[list | None] = mapped_column(
        JSON, nullable=True, default=list,
        comment="JSON array of cross-module links",
    )

    # Relationship
    owner = relationship("User", foreign_keys=[owner_id])

    def __repr__(self) -> str:
        return f"<Note id={self.id} title={self.title!r} owner={self.owner_id}>"


class NoteTag(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Tag attached to a note for categorisation."""

    __tablename__ = "note_tags"

    note_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tag_name: Mapped[str] = mapped_column(String(100), nullable=False)

    note = relationship("Note", foreign_keys=[note_id])


class NoteShareRecord(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Fine-grained share record for a note with permission levels."""

    __tablename__ = "note_shares"

    note_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    shared_with_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    permission: Mapped[str] = mapped_column(
        String(10), nullable=False, default="view",
        comment="view | edit",
    )

    note = relationship("Note", foreign_keys=[note_id])
    shared_with = relationship("User", foreign_keys=[shared_with_user_id])


class NoteTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Reusable note template."""

    __tablename__ = "note_templates"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_html: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
