"""DocComment and DocVersion models for collaborative document annotations and revision tracking."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class DocComment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A comment/annotation on a document (DriveFile).

    Supports threaded replies via ``parent_id`` self-reference.
    """

    __tablename__ = "doc_comments"

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drive_files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Optional: anchor comment to a specific position/selection in the doc
    anchor: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Threading: replies reference a parent comment
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doc_comments.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    resolved: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Relationships
    file = relationship("DriveFile", foreign_keys=[file_id])
    author = relationship("User", foreign_keys=[author_id])
    parent = relationship("DocComment", remote_side="DocComment.id", foreign_keys=[parent_id])
    replies = relationship(
        "DocComment",
        foreign_keys=[parent_id],
        back_populates="parent",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<DocComment id={self.id} file={self.file_id} author={self.author_id}>"


class DocVersion(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A saved revision/version of a document.

    Each time ONLYOFFICE saves a document, a new version entry is created
    with the MinIO key pointing to the snapshot of the file at that point.
    """

    __tablename__ = "doc_versions"

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drive_files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    version_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # MinIO key for this version's snapshot
    minio_key: Mapped[str] = mapped_column(String(1024), nullable=False)

    size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Who saved this version
    saved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Optional label for named versions
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ONLYOFFICE changes URL for diff
    changes_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    # Relationships
    file = relationship("DriveFile", foreign_keys=[file_id])
    user = relationship("User", foreign_keys=[saved_by])

    def __repr__(self) -> str:
        return f"<DocVersion id={self.id} file={self.file_id} v{self.version_number}>"
