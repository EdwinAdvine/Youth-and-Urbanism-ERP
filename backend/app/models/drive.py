"""Drive models: DriveFile and DriveFolder."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


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

    ``minio_key`` is the object key within the ``urban-erp-drive`` bucket.
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

    # Relationships
    owner = relationship("User", foreign_keys=[owner_id])
    folder = relationship("DriveFolder", back_populates="files", foreign_keys=[folder_id])

    def __repr__(self) -> str:
        return f"<DriveFile id={self.id} name={self.name!r} size={self.size}>"
