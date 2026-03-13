"""Drive file access request model for permission-gated file access."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class FileAccessRequest(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Request from a user to access a Drive file they found but lack permission for."""

    __tablename__ = "file_access_requests"

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drive_files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    requester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    requested_permission: Mapped[str] = mapped_column(
        String(20), nullable=False, default="view",
    )  # view, edit
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending",
    )  # pending, approved, denied

    responded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # Relationships
    file = relationship("DriveFile", foreign_keys=[file_id])
    requester = relationship("User", foreign_keys=[requester_id])
    owner = relationship("User", foreign_keys=[owner_id])
    responder = relationship("User", foreign_keys=[responded_by])

    def __repr__(self) -> str:
        return f"<FileAccessRequest id={self.id} file={self.file_id} status={self.status}>"
