"""Project cross-module linking models.

Lightweight join tables for soft-linking projects to CRM deals
and finance expenses. Drive folders and documents use existing
models with metadata references.
"""
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ProjectDealLink(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Links a project to a CRM deal."""

    __tablename__ = "project_deal_links"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("crm_deals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    project = relationship("Project", foreign_keys=[project_id])
    deal = relationship("Deal", foreign_keys=[deal_id])

    def __repr__(self) -> str:
        return f"<ProjectDealLink project={self.project_id} deal={self.deal_id}>"


class ProjectExpenseLink(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Links a project to a finance expense for cost tracking."""

    __tablename__ = "project_expense_links"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    expense_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("finance_expenses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    project = relationship("Project", foreign_keys=[project_id])
    expense = relationship("Expense", foreign_keys=[expense_id])

    def __repr__(self) -> str:
        return f"<ProjectExpenseLink project={self.project_id} expense={self.expense_id}>"


class ProjectDriveFolder(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Links a project to its dedicated Drive folder."""

    __tablename__ = "project_drive_folders"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    folder_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drive_folders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    project = relationship("Project", foreign_keys=[project_id])
    folder = relationship("DriveFolder", foreign_keys=[folder_id])

    def __repr__(self) -> str:
        return f"<ProjectDriveFolder project={self.project_id} folder={self.folder_id}>"


class ProjectDocument(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Links a project to a Drive file (document) created from project context."""

    __tablename__ = "project_documents"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drive_files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    doc_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="document",
        comment="document | spreadsheet | presentation",
    )

    project = relationship("Project", foreign_keys=[project_id])
    file = relationship("DriveFile", foreign_keys=[file_id])

    def __repr__(self) -> str:
        return f"<ProjectDocument project={self.project_id} file={self.file_id} title={self.title!r}>"
