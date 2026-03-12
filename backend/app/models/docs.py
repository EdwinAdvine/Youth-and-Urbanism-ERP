"""Extended document models: DocumentComment, DocumentTemplate, RecentDocument."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
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


class DocumentBookmark(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A user's bookmarked/starred document for quick access."""

    __tablename__ = "document_bookmarks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drive_files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    file = relationship("DriveFile", foreign_keys=[file_id])

    def __repr__(self) -> str:
        return f"<DocumentBookmark user={self.user_id} file={self.file_id}>"


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


class SpreadsheetDataConnection(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Tracks live ERP data connections embedded in spreadsheets."""

    __tablename__ = "spreadsheet_data_connections"

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drive_files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # e.g. "finance", "hr", "crm"
    source_module: Mapped[str] = mapped_column(String(100), nullable=False)

    # e.g. "revenue", "headcount", "pipeline"
    query_type: Mapped[str] = mapped_column(String(100), nullable=False)

    # Parameters forwarded to the data query
    query_params: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Target cell range in the spreadsheet, e.g. "A1:D10"
    target_range: Mapped[str] = mapped_column(String(100), nullable=False)

    # 0 = manual refresh only
    refresh_interval_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )

    last_refreshed: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Last fetched results cached here
    cached_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Relationships
    file = relationship("DriveFile", foreign_keys=[file_id])
    owner = relationship("User", foreign_keys=[owner_id])

    def __repr__(self) -> str:
        return (
            f"<SpreadsheetDataConnection id={self.id} module={self.source_module!r} "
            f"query={self.query_type!r} file={self.file_id}>"
        )


class DocumentAuditLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Tracks all document actions for compliance and audit purposes."""

    __tablename__ = "document_audit_logs"

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drive_files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # viewed, edited, shared, downloaded, printed, exported
    action: Mapped[str] = mapped_column(String(50), nullable=False)

    # Action-specific metadata
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)

    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relationships
    file = relationship("DriveFile", foreign_keys=[file_id])
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return (
            f"<DocumentAuditLog id={self.id} file={self.file_id} "
            f"user={self.user_id} action={self.action!r}>"
        )


class DocumentSecurity(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Per-document security and access restriction settings."""

    __tablename__ = "document_security"

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drive_files.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # public, internal, confidential, restricted
    classification: Mapped[str] = mapped_column(
        String(50), nullable=False, default="internal"
    )

    prevent_download: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    prevent_print: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    prevent_copy: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    watermark_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    watermark_text: Mapped[str | None] = mapped_column(String(200), nullable=True)

    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    file = relationship("DriveFile", foreign_keys=[file_id])

    def __repr__(self) -> str:
        return (
            f"<DocumentSecurity id={self.id} file={self.file_id} "
            f"classification={self.classification!r}>"
        )


class DocumentTemplateCategory(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Category groupings for document templates."""

    __tablename__ = "document_template_categories"

    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Icon identifier (e.g. Lucide icon name)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)

    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    def __repr__(self) -> str:
        return (
            f"<DocumentTemplateCategory id={self.id} name={self.name!r} "
            f"sort_order={self.sort_order}>"
        )


class DocumentTemplateFavorite(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Records which templates a user has marked as a favourite."""

    __tablename__ = "document_template_favorites"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    template = relationship("DocumentTemplate", foreign_keys=[template_id])

    def __repr__(self) -> str:
        return (
            f"<DocumentTemplateFavorite user={self.user_id} "
            f"template={self.template_id}>"
        )
