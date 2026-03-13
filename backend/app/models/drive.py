"""Drive models: DriveFile, DriveFolder, AI metadata, smart folders, activity logging."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

# pgvector column type — graceful fallback if pgvector not installed
try:
    from pgvector.sqlalchemy import Vector

    _PGVECTOR_AVAILABLE = True
except ImportError:
    _PGVECTOR_AVAILABLE = False


class DriveFolder(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Represents a virtual folder in the drive.

    Folders are self-referential: ``parent_id`` points to another DriveFolder.
    A ``None`` parent means the folder lives at the root of the user's drive.
    """

    __tablename__ = "drive_folders"

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drive_folders.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Enhanced folder metadata
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)  # hex color code
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)  # icon identifier
    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    owner = relationship("User", foreign_keys=[owner_id])
    parent = relationship("DriveFolder", remote_side="DriveFolder.id", foreign_keys=[parent_id])
    children = relationship(
        "DriveFolder",
        foreign_keys=[parent_id],
        back_populates="parent",
        cascade="all, delete-orphan",
    )
    files = relationship(
        "DriveFile",
        back_populates="folder",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<DriveFolder id={self.id} name={self.name!r} owner={self.owner_id}>"


class DriveFile(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Represents a file stored in MinIO.

    ``minio_key`` is the object key within the ``urban-vibes-dynamics-drive`` bucket.
    ``folder_path`` is a denormalized path string for quick display/filtering;
    the FK ``folder_id`` links to the parent ``DriveFolder`` row.
    """

    __tablename__ = "drive_files"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(255), nullable=False, default="application/octet-stream")
    size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    minio_key: Mapped[str] = mapped_column(String(1024), nullable=False, unique=True)
    folder_path: Mapped[str] = mapped_column(String(1024), nullable=False, default="/")

    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drive_folders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # ── AI / Content Intelligence columns ─────────────────────────────────────
    file_content_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)  # SHA-256
    ai_processed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # pgvector embedding (1024-dim for mxbai-embed-large / nomic-embed-text)
    if _PGVECTOR_AVAILABLE:
        content_embedding = mapped_column(Vector(1024), nullable=True)
    else:
        content_embedding = mapped_column(Text, nullable=True)  # fallback

    # ── File locking ──────────────────────────────────────────────────────────
    is_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    locked_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Sensitivity ───────────────────────────────────────────────────────────
    sensitivity_level: Mapped[str | None] = mapped_column(
        String(30), nullable=True,
    )  # public, internal, confidential, highly_confidential

    # ── Legal hold ────────────────────────────────────────────────────────────
    is_on_hold: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # ── Source module tracking (Drive as universal gateway) ──────────────────
    source_module: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True,
    )  # finance, notes, mail, pos, hr, support, manufacturing, supplychain, calendar, projects
    source_entity_type: Mapped[str | None] = mapped_column(
        String(100), nullable=True,
    )  # invoice, note, receipt, attachment, ticket, work_order, etc.
    source_entity_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True,
    )  # UUID of the originating entity

    # Relationships
    owner = relationship("User", foreign_keys=[owner_id])
    folder = relationship("DriveFolder", back_populates="files", foreign_keys=[folder_id])
    locker = relationship("User", foreign_keys=[locked_by])
    ai_metadata = relationship("FileAIMetadata", back_populates="file", uselist=False, cascade="all, delete-orphan")

    # Full-text search index (applied via Alembic raw SQL for tsvector)
    __table_args__ = (
        Index("ix_drive_files_name_trgm", "name", postgresql_using="gin",
              postgresql_ops={"name": "gin_trgm_ops"}),
        Index("ix_drive_files_source", "source_module", "source_entity_type", "source_entity_id"),
    )

    def __repr__(self) -> str:
        return f"<DriveFile id={self.id} name={self.name!r} size={self.size}>"


class FileTag(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Tag attached to a drive file for categorisation."""

    __tablename__ = "file_tags"

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_files.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    tag_name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)  # hex color
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")  # manual, ai

    file = relationship("DriveFile", foreign_keys=[file_id])


class FileComment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Comment on a drive file with threading support."""

    __tablename__ = "file_comments"

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_files.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Threading
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("file_comments.id", ondelete="CASCADE"), nullable=True, index=True,
    )
    is_resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    file = relationship("DriveFile", foreign_keys=[file_id])
    user = relationship("User", foreign_keys=[user_id])
    parent = relationship("FileComment", remote_side="FileComment.id", foreign_keys=[parent_id])
    replies = relationship(
        "FileComment",
        foreign_keys=[parent_id],
        back_populates="parent",
        cascade="all, delete-orphan",
    )


class TrashBin(UUIDPrimaryKeyMixin, Base):
    """Soft-delete record for drive files moved to trash."""

    __tablename__ = "trash_bin"

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_files.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_folders.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    deleted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False,
    )
    deleted_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    auto_purge_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    file = relationship("DriveFile", foreign_keys=[file_id])
    folder = relationship("DriveFolder", foreign_keys=[folder_id])
    deleter = relationship("User", foreign_keys=[deleted_by])


# ── AI Metadata ───────────────────────────────────────────────────────────────


class FileAIMetadata(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """AI-generated insights for a drive file: summary, entities, tags, sensitivity."""

    __tablename__ = "file_ai_metadata"

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_files.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )

    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    entities_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    suggested_tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    sensitivity_level: Mapped[str | None] = mapped_column(String(30), nullable=True)
    language: Mapped[str | None] = mapped_column(String(10), nullable=True)
    word_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Cross-module suggestions (e.g., "link to CRM deal #X", "create Finance expense")
    module_suggestions: Mapped[list | None] = mapped_column(JSON, nullable=True)

    file = relationship("DriveFile", back_populates="ai_metadata", foreign_keys=[file_id])


# ── Smart Folders ─────────────────────────────────────────────────────────────


class SmartFolder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Virtual folder that auto-populates based on a saved filter query."""

    __tablename__ = "smart_folders"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # Filter DSL stored as JSON
    # Example: {"content_types": ["application/pdf"], "tags": ["invoice"],
    #           "date_from": "2025-10-01", "size_min": 0, "query": "acme"}
    filter_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # Sort/display prefs
    sort_field: Mapped[str] = mapped_column(String(50), nullable=False, default="created_at")
    sort_direction: Mapped[str] = mapped_column(String(4), nullable=False, default="desc")

    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    owner = relationship("User", foreign_keys=[owner_id])


# ── Saved Views ───────────────────────────────────────────────────────────────


class SavedView(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Persistent column layout / filter / sort configuration for a folder."""

    __tablename__ = "saved_views"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_folders.id", ondelete="CASCADE"),
        nullable=True, index=True,
    )

    filters_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    sort_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    columns_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    view_type: Mapped[str] = mapped_column(String(20), nullable=False, default="list")  # list, grid, detail
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    owner = relationship("User", foreign_keys=[owner_id])
    folder = relationship("DriveFolder", foreign_keys=[folder_id])


# ── File Metadata (key-value) ─────────────────────────────────────────────────


class FileMetadata(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Arbitrary key-value metadata on a drive file (e.g., Invoice Number, Client Name)."""

    __tablename__ = "file_metadata"

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_files.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_type: Mapped[str] = mapped_column(String(20), nullable=False, default="string")  # string, number, date, bool

    file = relationship("DriveFile", foreign_keys=[file_id])

    __table_args__ = (
        Index("ix_file_metadata_key_value", "key", "value", postgresql_using="btree"),
    )


# ── Activity / Access Logging ─────────────────────────────────────────────────


class FileAccessLog(UUIDPrimaryKeyMixin, Base):
    """Comprehensive activity log for every Drive interaction."""

    __tablename__ = "file_access_logs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    file_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_files.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_folders.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )

    action: Mapped[str] = mapped_column(String(50), nullable=False)
    # Actions: upload, download, view, preview, edit, delete, restore, share,
    #          move, copy, rename, tag, comment, lock, unlock, search
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False,
    )

    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        Index("ix_file_access_logs_timestamp", "timestamp"),
        Index("ix_file_access_logs_action", "action"),
    )


# ── Drive Snapshots (Point-in-Time Restore) ──────────────────────────────────


class DriveSnapshot(UUIDPrimaryKeyMixin, Base):
    """Captures the state of a user's drive at a point in time for restore."""

    __tablename__ = "drive_snapshots"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    snapshot_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False,
    )
    # JSON tree of files/folders with minio_keys for restoration
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    file_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # bytes

    owner = relationship("User", foreign_keys=[owner_id])


# ── Sensitivity Labels ────────────────────────────────────────────────────────


class SensitivityLabel(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Admin-configurable sensitivity classification labels."""

    __tablename__ = "sensitivity_labels"

    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="#6b7280")
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    severity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # 0=public, 10=internal, 20=confidential, 30=highly_confidential

    # Sharing restrictions
    block_external_sharing: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    block_public_links: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    require_password_for_links: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    max_link_expiry_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
