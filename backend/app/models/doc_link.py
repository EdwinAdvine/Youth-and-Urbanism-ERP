"""DocLink model: links DriveFiles to project tasks."""
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class DocLink(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Associates a DriveFile (document) with a project task.

    This enables the Docs <-> Projects sync feature, allowing users to
    attach documents to specific tasks within a project.
    """

    __tablename__ = "doc_links"

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drive_files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    linked_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Relationships
    file = relationship("DriveFile", foreign_keys=[file_id])
    task = relationship("Task", foreign_keys=[task_id])
    project = relationship("Project", foreign_keys=[project_id])
    user = relationship("User", foreign_keys=[linked_by])

    def __repr__(self) -> str:
        return (
            f"<DocLink id={self.id} file={self.file_id} "
            f"task={self.task_id} project={self.project_id}>"
        )
