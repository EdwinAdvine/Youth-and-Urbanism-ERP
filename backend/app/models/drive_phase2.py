"""Phase 2 + 3 Drive models: File Requests, Webhooks, API Keys, Templates, Vault, DLP."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# ── Phase 2: File Requests ───────────────────────────────────────────────────


class FileRequest(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A branded upload request with deadline, type restrictions, and tracking."""

    __tablename__ = "file_requests"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    required_types: Mapped[list | None] = mapped_column(JSON, nullable=True)  # ["application/pdf", "image/*"]
    max_file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)  # bytes
    max_files: Mapped[int | None] = mapped_column(Integer, nullable=True)

    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_folders.id", ondelete="SET NULL"), nullable=True,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )

    # Public link token for unauthenticated access
    token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Branding
    branding_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {logo_url, color, instructions, terms}

    # Relationships
    folder = relationship("DriveFolder", foreign_keys=[folder_id])
    creator = relationship("User", foreign_keys=[created_by])
    submissions = relationship("FileRequestSubmission", back_populates="request", cascade="all, delete-orphan")


class FileRequestSubmission(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Tracks each file uploaded in response to a FileRequest."""

    __tablename__ = "file_request_submissions"

    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("file_requests.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_files.id", ondelete="CASCADE"), nullable=False,
    )

    # Submitter info (may not be an authenticated user)
    submitted_by_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    submitted_by_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    submitted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="received")  # received, reviewed, accepted, rejected

    request = relationship("FileRequest", back_populates="submissions")
    file = relationship("DriveFile", foreign_keys=[file_id])


# ── Phase 3: Webhooks ────────────────────────────────────────────────────────


class DriveWebhook(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Webhook configuration for external system integration."""

    __tablename__ = "drive_webhooks"

    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    secret: Mapped[str | None] = mapped_column(String(255), nullable=True)  # HMAC signing secret
    events: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # Events: file.uploaded, file.deleted, file.shared, file.downloaded,
    #         comment.created, folder.created, request.submitted

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_triggered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    owner = relationship("User", foreign_keys=[owner_id])
    deliveries = relationship("WebhookDelivery", back_populates="webhook", cascade="all, delete-orphan")


class WebhookDelivery(UUIDPrimaryKeyMixin, Base):
    """Log of each webhook delivery attempt."""

    __tablename__ = "webhook_deliveries"

    webhook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_webhooks.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    event: Mapped[str] = mapped_column(String(50), nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    response_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    response_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    delivered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()", nullable=False)

    webhook = relationship("DriveWebhook", back_populates="deliveries")


# ── Phase 3: API Keys ────────────────────────────────────────────────────────


class DriveApiKey(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """API key for programmatic access to Drive endpoints."""

    __tablename__ = "drive_api_keys"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    key_prefix: Mapped[str] = mapped_column(String(10), nullable=False)  # first 8 chars for identification

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )

    scopes: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # Scopes: read, write, delete, share, admin
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    user = relationship("User", foreign_keys=[user_id])


# ── Phase 3: Document Templates ──────────────────────────────────────────────


class DriveTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Reusable document template stored in MinIO (Drive module)."""

    __tablename__ = "drive_templates"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_type: Mapped[str] = mapped_column(String(255), nullable=False)
    minio_key: Mapped[str] = mapped_column(String(1024), nullable=False, unique=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)  # contract, invoice, report, letter
    thumbnail_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )

    # Metadata for template variables
    variables_json: Mapped[list | None] = mapped_column(JSON, nullable=True)  # [{name, type, default, required}]
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    use_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    creator = relationship("User", foreign_keys=[created_by])


# ── Phase 3: Personal Vault ─────────────────────────────────────────────────


class PersonalVault(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Personal secure vault with re-authentication and auto-lock."""

    __tablename__ = "personal_vaults"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True,
    )
    vault_folder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_folders.id", ondelete="SET NULL"), nullable=True,
    )

    is_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    lock_timeout_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=20)
    last_accessed: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    vault_folder = relationship("DriveFolder", foreign_keys=[vault_folder_id])


# ── Phase 3: DLP Rules ──────────────────────────────────────────────────────


class DlpRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Data Loss Prevention rule for content scanning and sharing control."""

    __tablename__ = "dlp_rules"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Detection
    patterns: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # [{type: "regex", value: "\\d{4}-\\d{4}-\\d{4}-\\d{4}", label: "Credit Card"},
    #  {type: "keyword", value: "salary", label: "Salary Data"},
    #  {type: "ai_classification", value: "medical_record", label: "Medical"}]

    # Actions when detected
    action: Mapped[str] = mapped_column(String(30), nullable=False, default="warn")
    # Actions: warn, block_sharing, block_download, quarantine, notify_admin
    notify_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Scope
    apply_to_sensitivity: Mapped[list | None] = mapped_column(JSON, nullable=True)  # ["confidential", "highly_confidential"]
    apply_to_departments: Mapped[list | None] = mapped_column(JSON, nullable=True)  # ["finance", "hr"]

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    creator = relationship("User", foreign_keys=[created_by])
    violations = relationship("DlpViolation", back_populates="rule", cascade="all, delete-orphan")


class DlpViolation(UUIDPrimaryKeyMixin, Base):
    """Record of a DLP rule violation on a file."""

    __tablename__ = "dlp_violations"

    rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dlp_rules.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_files.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )

    matched_patterns: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    action_taken: Mapped[str] = mapped_column(String(30), nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()", nullable=False)

    rule = relationship("DlpRule", back_populates="violations")
    file = relationship("DriveFile", foreign_keys=[file_id])
    user = relationship("User", foreign_keys=[user_id])
