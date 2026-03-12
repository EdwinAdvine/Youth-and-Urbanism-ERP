"""Pydantic schemas for Y&U Notes (notebooks, pages, entity links, versions)."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Notebook schemas
# ---------------------------------------------------------------------------


class NotebookCreate(BaseModel):
    title: str = "Untitled Notebook"
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    cover_image_url: str | None = None


class NotebookUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    cover_image_url: str | None = None
    is_archived: bool | None = None


class NotebookOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    owner_id: uuid.UUID
    icon: str | None
    color: str | None
    cover_image_url: str | None
    is_default: bool
    is_shared: bool
    sort_order: int
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NotebookWithSections(NotebookOut):
    sections: list[SectionOut] = []
    page_count: int = 0


# ---------------------------------------------------------------------------
# Section schemas
# ---------------------------------------------------------------------------


class SectionCreate(BaseModel):
    title: str = "Untitled Section"
    color: str | None = None


class SectionUpdate(BaseModel):
    title: str | None = None
    color: str | None = None


class SectionOut(BaseModel):
    id: uuid.UUID
    notebook_id: uuid.UUID
    title: str
    color: str | None
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SectionWithPages(SectionOut):
    page_count: int = 0


# ---------------------------------------------------------------------------
# Note (page) schemas — extended for hierarchy
# ---------------------------------------------------------------------------


class NoteCreate(BaseModel):
    title: str = "Untitled"
    content: str | None = None
    tags: list[str] | None = None
    is_pinned: bool = False
    # Hierarchy
    notebook_id: uuid.UUID | None = None
    section_id: uuid.UUID | None = None
    parent_page_id: uuid.UUID | None = None
    # Editor
    content_format: str = "html"
    # Appearance
    icon: str | None = None
    cover_image_url: str | None = None
    full_width: bool = False
    # Properties
    properties: dict | None = None
    # Source context (for cross-module note creation)
    source_module: str | None = None
    source_entity_type: str | None = None
    source_entity_id: str | None = None
    source_type: str = "manual"


class NoteUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    tags: list[str] | None = None
    is_pinned: bool | None = None
    content_format: str | None = None
    icon: str | None = None
    cover_image_url: str | None = None
    full_width: bool | None = None
    is_archived: bool | None = None
    properties: dict | None = None


class NoteOut(BaseModel):
    id: uuid.UUID
    title: str
    content: str | None
    owner_id: uuid.UUID
    tags: list[str] | None
    is_pinned: bool
    shared_with: list | None
    is_shared: bool
    linked_items: list | None
    # Hierarchy
    notebook_id: uuid.UUID | None = None
    section_id: uuid.UUID | None = None
    parent_page_id: uuid.UUID | None = None
    # Editor
    content_format: str = "html"
    # Appearance
    icon: str | None = None
    cover_image_url: str | None = None
    full_width: bool = False
    # State
    sort_order: int = 0
    is_archived: bool = False
    word_count: int = 0
    # Properties
    properties: dict | None = None
    source_type: str = "manual"
    # Timestamps
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class NoteTreeItem(BaseModel):
    """Compact note representation for tree navigation."""
    id: uuid.UUID
    title: str
    icon: str | None = None
    parent_page_id: uuid.UUID | None = None
    sort_order: int = 0
    is_pinned: bool = False
    is_archived: bool = False
    updated_at: Any
    sub_pages: list[NoteTreeItem] = []

    model_config = {"from_attributes": True}


class NoteMovePayload(BaseModel):
    """Move a page to a different notebook/section/parent."""
    notebook_id: uuid.UUID | None = None
    section_id: uuid.UUID | None = None
    parent_page_id: uuid.UUID | None = None
    sort_order: int | None = None


class NoteBreadcrumb(BaseModel):
    id: uuid.UUID
    title: str
    type: str  # "notebook" | "section" | "page"


# ---------------------------------------------------------------------------
# Entity link schemas
# ---------------------------------------------------------------------------


class EntityLinkCreate(BaseModel):
    entity_type: str
    entity_id: uuid.UUID
    link_type: str = "references"


class EntityLinkOut(BaseModel):
    id: uuid.UUID
    note_id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    link_type: str
    created_by_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Version schemas
# ---------------------------------------------------------------------------


class NoteVersionOut(BaseModel):
    id: uuid.UUID
    note_id: uuid.UUID
    version_number: int
    content_format: str
    created_by_id: uuid.UUID | None
    label: str | None
    word_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class NoteVersionCreate(BaseModel):
    label: str | None = None


# ---------------------------------------------------------------------------
# Comment schemas
# ---------------------------------------------------------------------------


class NoteCommentCreate(BaseModel):
    content: str
    parent_comment_id: uuid.UUID | None = None
    anchor_block_id: str | None = None
    anchor_text: str | None = None


class NoteCommentOut(BaseModel):
    id: uuid.UUID
    note_id: uuid.UUID
    parent_comment_id: uuid.UUID | None
    author_id: uuid.UUID
    content: str
    anchor_block_id: str | None
    anchor_text: str | None
    is_resolved: bool
    resolved_by_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    replies: list[NoteCommentOut] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Audit log schemas
# ---------------------------------------------------------------------------


class NoteAuditLogOut(BaseModel):
    id: uuid.UUID
    note_id: uuid.UUID
    user_id: uuid.UUID | None
    action: str
    details: dict | None
    ip_address: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Reorder payload
# ---------------------------------------------------------------------------


class ReorderPayload(BaseModel):
    """Reorder items by providing ordered list of IDs."""
    ids: list[uuid.UUID]


# ---------------------------------------------------------------------------
# Legacy schemas (kept for backward compat with notes_router / notes_ext)
# ---------------------------------------------------------------------------


class NoteShare(BaseModel):
    user_ids: list[str]


class NoteLink(BaseModel):
    type: str
    id: str
    title: str | None = None


# Resolve forward refs
NotebookWithSections.model_rebuild()
NoteTreeItem.model_rebuild()
NoteCommentOut.model_rebuild()
