"""Phase 3 final Drive models: Change Feed, Calendar Attachments, Content Types,
Auto-Backup Rules, Storage Tiers, Behavioral Profiles, Guest Users,
Contract Metadata, AI Auto-Links."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# ── Delta Sync / Change Feed ──────────────────────────────────────────────────


class DriveChangeFeed(UUIDPrimaryKeyMixin, Base):
    """Delta change log for sync clients. Every file/folder mutation appended here."""

    __tablename__ = "drive_change_feed"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    file_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_files.id", ondelete="SET NULL"), nullable=True,
    )
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_folders.id", ondelete="SET NULL"), nullable=True,
    )

    action: Mapped[str] = mapped_column(String(30), nullable=False)  # created, updated, deleted, moved, renamed
    entity_type: Mapped[str] = mapped_column(String(10), nullable=False)  # file, folder
    entity_name: Mapped[str] = mapped_column(String(1024), nullable=False)
    parent_folder_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Monotonically increasing per-user cursor for delta sync
    sequence_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False, index=True,
    )
    extra_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {old_name, new_folder_id, ...}

    user = relationship("User", foreign_keys=[user_id])


class DriveUserSequence(Base):
    """Per-user monotonic sequence counter for change feed cursors."""

    __tablename__ = "drive_user_sequences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True,
    )
    last_sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


# ── Calendar Integration ──────────────────────────────────────────────────────


class CalendarDriveAttachment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Links a Calendar event to one or more Drive files."""

    __tablename__ = "calendar_drive_attachments"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("calendar_events.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_files.id", ondelete="CASCADE"), nullable=False,
    )
    attached_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )

    event = relationship("CalendarEvent", foreign_keys=[event_id])
    file = relationship("DriveFile", foreign_keys=[file_id])
    attacher = relationship("User", foreign_keys=[attached_by])


# ── Content Types ─────────────────────────────────────────────────────────────


class DriveContentType(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Custom content type that enforces required metadata on upload within a folder."""

    __tablename__ = "drive_content_types"

    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Required fields schema: [{name, type, required, default, placeholder}]
    required_fields: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    allowed_mime_types: Mapped[list | None] = mapped_column(JSON, nullable=True)  # null = all
    icon: Mapped[str | None] = mapped_column(String(100), nullable=True)  # emoji or icon name
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)  # hex color

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    creator = relationship("User", foreign_keys=[created_by])
    folder_assignments = relationship(
        "DriveContentTypeFolder", back_populates="content_type", cascade="all, delete-orphan",
    )


class DriveContentTypeFolder(Base):
    """Maps content types to specific folders (inherits metadata requirements)."""

    __tablename__ = "drive_content_type_folders"

    content_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drive_content_types.id", ondelete="CASCADE"),
        primary_key=True,
    )
    folder_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drive_folders.id", ondelete="CASCADE"),
        primary_key=True,
    )
    enforce_on_upload: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    content_type = relationship("DriveContentType", back_populates="folder_assignments")
    folder = relationship("DriveFolder", foreign_keys=[folder_id])


# ── Auto-Backup Rules ─────────────────────────────────────────────────────────


class AutoBackupRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Scheduled backup rule for a specific Drive folder."""

    __tablename__ = "auto_backup_rules"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    folder_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_folders.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )

    schedule_cron: Mapped[str] = mapped_column(String(100), nullable=False, default="0 2 * * *")
    destination: Mapped[str] = mapped_column(String(50), nullable=False, default="minio_backup")
    retention_count: Mapped[int] = mapped_column(Integer, nullable=False, default=7)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_run_status: Mapped[str | None] = mapped_column(String(20), nullable=True)  # success, failed
    last_run_files: Mapped[int | None] = mapped_column(Integer, nullable=True)

    folder = relationship("DriveFolder", foreign_keys=[folder_id])
    creator = relationship("User", foreign_keys=[created_by])


# ── Storage Tiering ────────────────────────────────────────────────────────────


class DriveStorageTier(UUIDPrimaryKeyMixin, Base):
    """Tracks the storage tier of a file: hot → warm → cold → archived."""

    __tablename__ = "drive_storage_tiers"

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drive_files.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    tier: Mapped[str] = mapped_column(String(20), nullable=False, default="hot")  # hot, warm, cold, archived
    tiered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    tiered_by: Mapped[str] = mapped_column(String(20), nullable=False, default="auto")  # auto, manual
    restore_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    restore_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    file = relationship("DriveFile", foreign_keys=[file_id])


# ── Behavioral Anomaly Detection ──────────────────────────────────────────────


class DriveUserBehavior(UUIDPrimaryKeyMixin, Base):
    """Behavioral baseline profile per user for anomaly detection."""

    __tablename__ = "drive_user_behaviors"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True,
    )

    # Computed daily averages
    avg_daily_uploads: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_daily_downloads: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_daily_shares: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_daily_deletes: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Normal usage patterns
    typical_hours: Mapped[list | None] = mapped_column(JSON, nullable=True)  # [9, 10, 11, ..., 17]
    typical_ip_hashes: Mapped[list | None] = mapped_column(JSON, nullable=True)  # SHA256-hashed IPs

    # Computed thresholds (baseline × multiplier)
    upload_threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    download_threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    delete_threshold: Mapped[float | None] = mapped_column(Float, nullable=True)

    computed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    alert_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_alert_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", foreign_keys=[user_id])


class DriveAnomalyAlert(UUIDPrimaryKeyMixin, Base):
    """Alert record when anomalous Drive behavior is detected for a user."""

    __tablename__ = "drive_anomaly_alerts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # bulk_download, bulk_delete, off_hours_access, new_ip, mass_share, data_exfil

    details: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")  # low, medium, high, critical
    is_resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False, index=True,
    )

    user = relationship("User", foreign_keys=[user_id])
    resolver = relationship("User", foreign_keys=[resolved_by])


# ── Guest Users ────────────────────────────────────────────────────────────────


class DriveGuestUser(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Tracked external collaborator who accessed a share link."""

    __tablename__ = "drive_guest_users"

    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

    share_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("file_shares.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    invited_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )

    access_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_accessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    share = relationship("FileShare", foreign_keys=[share_id])
    inviter = relationship("User", foreign_keys=[invited_by])


# ── Contract Intelligence ─────────────────────────────────────────────────────


class DriveContractMetadata(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """AI-extracted key terms and dates from contract documents."""

    __tablename__ = "drive_contract_metadata"

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drive_files.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # AI-extracted fields
    parties: Mapped[list | None] = mapped_column(JSON, nullable=True)  # [{name, role}]
    effective_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expiry_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    renewal_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    contract_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)

    key_obligations: Mapped[list | None] = mapped_column(JSON, nullable=True)
    payment_terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    governing_law: Mapped[str | None] = mapped_column(String(255), nullable=True)
    termination_clauses: Mapped[list | None] = mapped_column(JSON, nullable=True)
    auto_renews: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    notice_period_days: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Alert tracking
    renewal_alert_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    expiry_alert_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)  # AI extraction confidence 0-1

    file = relationship("DriveFile", foreign_keys=[file_id])


# ── AI Auto-Links ──────────────────────────────────────────────────────────────


class DriveAutoLink(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """AI-suggested cross-module links between Drive files and ERP entities."""

    __tablename__ = "drive_auto_links"

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_files.id", ondelete="CASCADE"), nullable=False, index=True,
    )

    module: Mapped[str] = mapped_column(String(50), nullable=False)       # crm, finance, projects, hr, etc.
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)  # deal, invoice, project, employee
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False)     # UUID of the ERP entity
    entity_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    suggested_by: Mapped[str] = mapped_column(String(20), nullable=False, default="ai")  # ai, user
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="suggested")
    # suggested, confirmed, dismissed

    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    # e.g. "File mentions 'Acme Corp' matching CRM deal #2847"

    file = relationship("DriveFile", foreign_keys=[file_id])
    confirmer = relationship("User", foreign_keys=[confirmed_by])
