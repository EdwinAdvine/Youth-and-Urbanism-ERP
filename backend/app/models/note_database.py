"""Notion-style database models for Y&U Notes.

Supports structured databases embedded in pages or attached to notebooks,
with typed properties (columns), multiple views (table/kanban/calendar/gallery/list/timeline),
and row-level data stored as JSON values.
"""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# ---------------------------------------------------------------------------
# NoteDatabase — top-level database container
# ---------------------------------------------------------------------------


class NoteDatabase(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A Notion-style structured database belonging to a user.

    Can be embedded inside a page (page_id), attached to a notebook
    (notebook_id), or exist as a standalone database.
    """

    __tablename__ = "note_databases"

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    notebook_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notebooks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    page_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # --- Appearance ---
    icon: Mapped[str | None] = mapped_column(String(20), nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    # --- State ---
    is_shared: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # --- Relationships ---
    owner = relationship("User", foreign_keys=[owner_id])
    notebook = relationship("Notebook", foreign_keys=[notebook_id])
    page = relationship("Note", foreign_keys=[page_id])
    properties = relationship(
        "NoteDatabaseProperty",
        back_populates="database",
        cascade="all, delete-orphan",
        order_by="NoteDatabaseProperty.sort_order",
    )
    views = relationship(
        "NoteDatabaseView",
        back_populates="database",
        cascade="all, delete-orphan",
        order_by="NoteDatabaseView.sort_order",
    )
    rows = relationship(
        "NoteDatabaseRow",
        back_populates="database",
        cascade="all, delete-orphan",
        order_by="NoteDatabaseRow.sort_order",
    )

    def __repr__(self) -> str:
        return f"<NoteDatabase id={self.id} title={self.title!r}>"


# ---------------------------------------------------------------------------
# NoteDatabaseProperty — typed column definition
# ---------------------------------------------------------------------------


class NoteDatabaseProperty(Base, UUIDPrimaryKeyMixin):
    """A typed property (column) definition for a NoteDatabase.

    property_type may be one of:
        text | number | select | multi_select | date | checkbox | url |
        email | phone | person | file | relation | rollup | formula |
        status | created_time | last_edited_time
    """

    __tablename__ = "note_database_properties"

    database_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("note_databases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    property_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment=(
            "text|number|select|multi_select|date|checkbox|url|email|phone|"
            "person|file|relation|rollup|formula|status|created_time|last_edited_time"
        ),
    )
    # Stores select options, relation target database id, formula expression, etc.
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    width: Mapped[int] = mapped_column(
        Integer, nullable=False, default=160,
        comment="Column width in pixels for table view",
    )

    # --- Relationships ---
    database = relationship("NoteDatabase", back_populates="properties")

    def __repr__(self) -> str:
        return (
            f"<NoteDatabaseProperty id={self.id} name={self.name!r}"
            f" type={self.property_type!r}>"
        )


# ---------------------------------------------------------------------------
# NoteDatabaseView — saved view configuration
# ---------------------------------------------------------------------------


class NoteDatabaseView(Base, UUIDPrimaryKeyMixin):
    """A named, saved view over a NoteDatabase.

    view_type may be one of:
        table | kanban | calendar | gallery | list | timeline

    config stores view-specific settings such as:
        filters, sorts, group_by field, visible_properties list, etc.
    """

    __tablename__ = "note_database_views"

    database_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("note_databases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    view_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="table|kanban|calendar|gallery|list|timeline",
    )
    config: Mapped[dict | None] = mapped_column(
        JSON, nullable=True,
        comment="filters, sorts, group_by, visible_properties, etc.",
    )
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # --- Relationships ---
    database = relationship("NoteDatabase", back_populates="views")

    def __repr__(self) -> str:
        return (
            f"<NoteDatabaseView id={self.id} name={self.name!r}"
            f" type={self.view_type!r}>"
        )


# ---------------------------------------------------------------------------
# NoteDatabaseRow — a single record in a database
# ---------------------------------------------------------------------------


class NoteDatabaseRow(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A single data row in a NoteDatabase.

    values stores the row's property values as a JSON object keyed by
    property id: {<property_id>: <value>}.

    An optional page_id links to a Note sub-page for this row, enabling
    rich content per-record (like Notion's row detail pages).
    """

    __tablename__ = "note_database_rows"

    database_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("note_databases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    page_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notes.id", ondelete="SET NULL"),
        nullable=True,
    )
    # {property_id: value} — property ids are NoteDatabaseProperty.id as strings
    values: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # --- Relationships ---
    database = relationship("NoteDatabase", back_populates="rows")
    page = relationship("Note", foreign_keys=[page_id])
    created_by = relationship("User", foreign_keys=[created_by_id])

    def __repr__(self) -> str:
        return f"<NoteDatabaseRow id={self.id} database={self.database_id}>"
