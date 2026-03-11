"""Extended document models: DocumentComment, DocumentTemplate, RecentDocument."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class DocumentComment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A positional comment on a document (separate from DocComment in doc_comment.py).

    Supports inline annotations with position data for ONLYOFFICE integration.
    """

    __tablename__ = "document_comments"

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drive_files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    content: Mapped[str] = mapped_column(Text, nullable=False)

    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    is_resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # JSON with position/selection data for inline annotations
    position_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Relationships
    document = relationship("DriveFile", foreign_keys=[document_id])
    author = relationship("User", foreign_keys=[author_id])

    def __repr__(self) -> str:
        return (
            f"<DocumentComment id={self.id} doc={self.document_id} "
            f"author={self.author_id} resolved={self.is_resolved}>"
        )


class DocumentTemplate(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A reusable document template (docx, xlsx, pptx)."""

    __tablename__ = "document_templates"

    name: Mapped[str] = mapped_column(String(500), nullable=False)

    doc_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="doc",
        comment="doc | xlsx | pptx",
    )

    file_path: Mapped[str] = mapped_column(String(1024), nullable=False)

    category: Mapped[str] = mapped_column(String(200), nullable=False, default="general")

    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    def __repr__(self) -> str:
        return (
            f"<DocumentTemplate id={self.id} name={self.name!r} "
            f"type={self.doc_type} system={self.is_system}>"
        )


class RecentDocument(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Tracks recently opened documents per user."""

    __tablename__ = "recent_documents"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drive_files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    last_opened: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    document = relationship("DriveFile", foreign_keys=[document_id])

    def __repr__(self) -> str:
        return (
            f"<RecentDocument id={self.id} user={self.user_id} "
            f"doc={self.document_id}>"
        )
