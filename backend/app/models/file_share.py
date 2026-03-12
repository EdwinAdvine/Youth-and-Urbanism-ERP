"""Enterprise-grade sharing models for Y&U Drive (SharePoint-level)."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class FileShare(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A share record linking a DriveFile/DriveFolder to a user, team, or public link.

    Supports: user shares, group shares, public links with password/expiry/no-download,
    file-drop (upload-only) links, and view/edit/delete/reshare permissions.
    """

    __tablename__ = "file_shares"

    # Target — either a file or a folder (one must be set)
    file_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_files.id", ondelete="CASCADE"), nullable=True, index=True,
    )
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_folders.id", ondelete="CASCADE"), nullable=True, index=True,
    )

    # Recipient — user, team folder, or public (all nullable = public link)
    shared_with_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True,
    )
    shared_with_team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("team_folders.id", ondelete="CASCADE"), nullable=True, index=True,
    )

    # Shared by
    shared_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )

    # Permission level: view, edit, delete, reshare, upload_only (file drop)
    permission: Mapped[str] = mapped_column(String(20), default="view", nullable=False)

    # Public link sharing
    share_link: Mapped[str | None] = mapped_column(String(200), unique=True, nullable=True)
    link_password: Mapped[str | None] = mapped_column(String(255), nullable=True)  # bcrypt hash
    no_download: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_file_drop: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # upload-only
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    max_downloads: Mapped[int | None] = mapped_column(Integer, nullable=True)
    download_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Approval workflow
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )

    # Link scope: anyone, organization, specific_people
    link_scope: Mapped[str | None] = mapped_column(String(30), nullable=True, default="anyone")

    # Notification
    notify_on_access: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    file = relationship("DriveFile", foreign_keys=[file_id])
    folder = relationship("DriveFolder", foreign_keys=[folder_id])
    shared_with = relationship("User", foreign_keys=[shared_with_user_id])
    shared_by = relationship("User", foreign_keys=[shared_by_user_id])
    team = relationship("TeamFolder", foreign_keys=[shared_with_team_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])


class TeamFolder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Company-wide or department-specific shared folder with inherited permissions.

    Members get automatic access to all files within the team folder.
    """

    __tablename__ = "team_folders"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Optional department/module scope
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g. "finance", "hr"

    # The actual DriveFolder that backs this team folder
    drive_folder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drive_folders.id", ondelete="SET NULL"), nullable=True,
    )

    # Owner / creator
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )

    is_company_wide: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    drive_folder = relationship("DriveFolder", foreign_keys=[drive_folder_id])
    owner = relationship("User", foreign_keys=[owner_id])
    members = relationship("TeamFolderMember", back_populates="team_folder", cascade="all, delete-orphan")


class TeamFolderMember(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Maps users to team folders with specific permission levels."""

    __tablename__ = "team_folder_members"

    team_folder_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("team_folders.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    permission: Mapped[str] = mapped_column(String(20), default="view", nullable=False)  # view, edit, admin

    # Relationships
    team_folder = relationship("TeamFolder", back_populates="members")
    user = relationship("User", foreign_keys=[user_id])


class ShareAuditLog(UUIDPrimaryKeyMixin, Base):
    """Audit trail for all sharing actions."""

    __tablename__ = "share_audit_logs"

    share_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("file_shares.id", ondelete="SET NULL"), nullable=True,
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False)  # created, accessed, revoked, modified, downloaded
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False,
    )

    # Relationships
    share = relationship("FileShare", foreign_keys=[share_id])
    actor = relationship("User", foreign_keys=[actor_id])
