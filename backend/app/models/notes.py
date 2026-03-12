"""Note models for the Y&U Notes knowledge hub.

Supports hierarchical organisation (Notebook > Section > Page > Sub-page),
TipTap block editor content, cross-module entity linking, version history,
collaboration, and audit logging.
"""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, LargeBinary, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# ---------------------------------------------------------------------------
# Notebook hierarchy
# ---------------------------------------------------------------------------


class Notebook(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Top-level container for organising notes (like OneNote Notebooks)."""

    __tablename__ = "notebooks"

    title: Mapped[str] = mapped_column(String(500), nullable=False, default="Untitled Notebook")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    owner = relationship("User", foreign_keys=[owner_id])
    sections = relationship(
        "NotebookSection",
        back_populates="notebook",
        cascade="all, delete-orphan",
        order_by="NotebookSection.sort_order",
    )

    def __repr__(self) -> str:
        return f"<Notebook id={self.id} title={self.title!r}>"


class NotebookSection(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A section within a notebook, grouping related pages."""

    __tablename__ = "notebook_sections"

    notebook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notebooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False, default="Untitled Section")
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    notebook = relationship("Notebook", back_populates="sections")
    pages = relationship(
        "Note",
        back_populates="section",
        foreign_keys="Note.section_id",
        order_by="Note.sort_order",
    )

    def __repr__(self) -> str:
        return f"<NotebookSection id={self.id} title={self.title!r}>"


# ---------------------------------------------------------------------------
# Core Note (extended with hierarchy + block editor support)
# ---------------------------------------------------------------------------


class Note(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A page/note within the knowledge hub.

    Supports hierarchical nesting (sub-pages), TipTap JSON content,
    cross-module linking, and page-level metadata/properties.
    """

    __tablename__ = "notes"

    title: Mapped[str] = mapped_column(String(500), nullable=False, default="Untitled")
    content: Mapped[str | None] = mapped_column(Text, nullable=True)

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # --- Hierarchy ---
    notebook_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notebooks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    section_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notebook_sections.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    parent_page_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # --- Editor ---
    content_format: Mapped[str] = mapped_column(
        String(20), nullable=False, default="html",
        comment="html | tiptap_json",
    )

    # --- Appearance ---
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    full_width: Mapped[bool] = mapped_column(Boolean, default=False)

    # --- Ordering / State ---
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    word_count: Mapped[int] = mapped_column(Integer, default=0)

    # --- Tags ---
    tags: Mapped[list[str] | None] = mapped_column(
        ARRAY(String(100)),
        nullable=True,
        default=list,
    )
    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # --- Sharing (legacy JSON; NoteShareRecord is the relational source of truth) ---
    shared_with: Mapped[list | None] = mapped_column(
        JSON, nullable=True, default=list,
        comment="JSON array of user-id strings this note is shared with",
    )
    is_shared: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # --- Cross-module links (legacy JSON; NoteEntityLink is the relational replacement) ---
    linked_items: Mapped[list | None] = mapped_column(
        JSON, nullable=True, default=list,
        comment="JSON array of cross-module links",
    )

    # --- Page properties (Notion-style key-value metadata) ---
    properties: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, default=dict,
        comment="Notion-style page properties: {property_name: value}",
    )

    # --- Source tracking ---
    source_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default="manual",
        comment="manual | voice | meeting | auto_created | web_clip | email",
    )

    # --- Relationships ---
    owner = relationship("User", foreign_keys=[owner_id])
    section = relationship("NotebookSection", back_populates="pages", foreign_keys=[section_id])
    notebook = relationship("Notebook", foreign_keys=[notebook_id])
    sub_pages = relationship(
        "Note",
        back_populates="parent_page",
        foreign_keys=[parent_page_id],
        order_by="Note.sort_order",
    )
    parent_page = relationship(
        "Note",
        remote_side="Note.id",
        foreign_keys=[parent_page_id],
    )
    entity_links = relationship(
        "NoteEntityLink",
        back_populates="note",
        cascade="all, delete-orphan",
    )
    versions = relationship(
        "NoteVersion",
        back_populates="note",
        cascade="all, delete-orphan",
        order_by="NoteVersion.version_number.desc()",
    )
    audit_logs = relationship(
        "NoteAuditLog",
        back_populates="note",
        cascade="all, delete-orphan",
    )
    comments = relationship(
        "NoteComment",
        back_populates="note",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Note id={self.id} title={self.title!r} owner={self.owner_id}>"


# ---------------------------------------------------------------------------
# Cross-module entity linking (relational replacement for linked_items JSON)
# ---------------------------------------------------------------------------


class NoteEntityLink(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Relational link between a note and any ERP entity.

    Replaces the JSON ``linked_items`` column for proper querying and integrity.
    """

    __tablename__ = "note_entity_links"

    note_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entity_type: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="contact | deal | invoice | project | task | ticket | employee | meeting | file | lead | calendar",
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False,
    )
    link_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default="references",
        comment="references | created_from | related_to | action_item",
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    note = relationship("Note", back_populates="entity_links")
    created_by = relationship("User", foreign_keys=[created_by_id])

    def __repr__(self) -> str:
        return f"<NoteEntityLink note={self.note_id} {self.entity_type}:{self.entity_id}>"


# ---------------------------------------------------------------------------
# Version history
# ---------------------------------------------------------------------------


class NoteVersion(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Snapshot of a note's content at a point in time."""

    __tablename__ = "note_versions"

    note_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content_snapshot: Mapped[str] = mapped_column(Text, nullable=False)
    content_format: Mapped[str] = mapped_column(
        String(20), nullable=False, default="tiptap_json",
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    word_count: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    note = relationship("Note", back_populates="versions")
    created_by = relationship("User", foreign_keys=[created_by_id])

    def __repr__(self) -> str:
        return f"<NoteVersion note={self.note_id} v{self.version_number}>"


# ---------------------------------------------------------------------------
# Collaboration — comments
# ---------------------------------------------------------------------------


class NoteComment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Threaded comment anchored to a block within a note."""

    __tablename__ = "note_comments"

    note_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_comment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("note_comments.id", ondelete="CASCADE"),
        nullable=True,
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Anchor to a specific block in TipTap editor
    anchor_block_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True,
        comment="TipTap node ID for inline comment anchoring",
    )
    anchor_text: Mapped[str | None] = mapped_column(
        String(500), nullable=True,
        comment="Quoted text the comment refers to",
    )

    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    note = relationship("Note", back_populates="comments")
    author = relationship("User", foreign_keys=[author_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])
    replies = relationship(
        "NoteComment",
        back_populates="parent_comment",
        foreign_keys=[parent_comment_id],
    )
    parent_comment = relationship(
        "NoteComment",
        remote_side="NoteComment.id",
        foreign_keys=[parent_comment_id],
    )

    def __repr__(self) -> str:
        return f"<NoteComment id={self.id} note={self.note_id}>"


# ---------------------------------------------------------------------------
# Collaboration — real-time CRDT state (Yjs)
# ---------------------------------------------------------------------------


class NoteCollabSnapshot(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Compacted Y.Doc state for a note (binary snapshot)."""

    __tablename__ = "note_collab_snapshots"

    note_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notes.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    snapshot: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    def __repr__(self) -> str:
        return f"<NoteCollabSnapshot note={self.note_id} v{self.version}>"


class NoteCollabUpdate(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Incremental Yjs update for a note (compacted periodically)."""

    __tablename__ = "note_collab_updates"

    note_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    update_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)

    def __repr__(self) -> str:
        return f"<NoteCollabUpdate note={self.note_id} v{self.version}>"


# ---------------------------------------------------------------------------
# Audit logging
# ---------------------------------------------------------------------------


class NoteAuditLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Immutable audit trail for note actions."""

    __tablename__ = "note_audit_logs"

    note_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="created | updated | deleted | shared | unshared | viewed | exported | printed | moved | version_restored | ai_generated",
    )
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Relationships
    note = relationship("Note", back_populates="audit_logs")
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<NoteAuditLog note={self.note_id} action={self.action!r}>"


# ---------------------------------------------------------------------------
# Security & compliance
# ---------------------------------------------------------------------------


class NoteSensitivityLabel(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Organisation-level sensitivity classification for notes."""

    __tablename__ = "note_sensitivity_labels"

    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    level: Mapped[int] = mapped_column(
        Integer, nullable=False,
        comment="0=public, 1=internal, 2=confidential, 3=restricted",
    )
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="#6b7280")
    restrictions: Mapped[dict] = mapped_column(
        JSON, nullable=False, default=dict,
        comment='{"prevent_share": bool, "prevent_export": bool, "prevent_print": bool, "watermark": bool, "auto_expire_days": int|null}',
    )

    def __repr__(self) -> str:
        return f"<NoteSensitivityLabel {self.name!r} level={self.level}>"


# ---------------------------------------------------------------------------
# Legacy models (kept for backwards compatibility)
# ---------------------------------------------------------------------------


class NoteTag(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Tag attached to a note for categorisation."""

    __tablename__ = "note_tags"

    note_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tag_name: Mapped[str] = mapped_column(String(100), nullable=False)

    note = relationship("Note", foreign_keys=[note_id])


class NoteShareRecord(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Fine-grained share record for a note with permission levels."""

    __tablename__ = "note_shares"

    note_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    shared_with_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    permission: Mapped[str] = mapped_column(
        String(10), nullable=False, default="view",
        comment="view | edit | comment",
    )

    note = relationship("Note", foreign_keys=[note_id])
    shared_with = relationship("User", foreign_keys=[shared_with_user_id])


class NoteTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Reusable note template with optional ERP merge fields."""

    __tablename__ = "note_templates"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_html: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content_tiptap_json: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="TipTap JSON content for block editor templates",
    )
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    erp_merge_fields: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, default=dict,
        comment='ERP merge field mappings: {"{{field}}": {"module": "...", "query": "..."}}',
    )
    preview_image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, comment="Pre-built system template")
