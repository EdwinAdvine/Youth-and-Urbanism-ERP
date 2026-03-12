"""Notebooks API — hierarchical note organisation (Notebook > Section > Page)."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.models.notes import Note, Notebook, NotebookSection, NoteEntityLink, NoteVersion
from app.schemas.notes import (
    EntityLinkCreate,
    EntityLinkOut,
    NotebookCreate,
    NotebookOut,
    NotebookUpdate,
    NotebookWithSections,
    NoteBreadcrumb,
    NoteCommentCreate,
    NoteCommentOut,
    NoteMovePayload,
    NoteOut,
    NoteTreeItem,
    NoteVersionCreate,
    NoteVersionOut,
    ReorderPayload,
    SectionCreate,
    SectionOut,
    SectionUpdate,
    SectionWithPages,
)
from app.models.notes import NoteComment

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_notebook_or_404(
    notebook_id: uuid.UUID, user_id: uuid.UUID, db: DBSession
) -> Notebook:
    nb = await db.get(Notebook, notebook_id)
    if not nb or nb.owner_id != user_id:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return nb


async def _get_section_or_404(
    section_id: uuid.UUID, user_id: uuid.UUID, db: DBSession
) -> NotebookSection:
    sec = await db.get(NotebookSection, section_id, options=[selectinload(NotebookSection.notebook)])
    if not sec or sec.notebook.owner_id != user_id:
        raise HTTPException(status_code=404, detail="Section not found")
    return sec


async def _get_note_or_404(
    note_id: uuid.UUID, user_id: uuid.UUID, db: DBSession
) -> Note:
    note = await db.get(Note, note_id)
    if not note or note.owner_id != user_id:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


# ---------------------------------------------------------------------------
# Notebook CRUD
# ---------------------------------------------------------------------------


@router.get("", summary="List notebooks for the current user")
async def list_notebooks(
    current_user: CurrentUser,
    db: DBSession,
    include_archived: bool = Query(False),
) -> dict[str, Any]:
    query = (
        select(Notebook)
        .where(Notebook.owner_id == current_user.id)
        .order_by(Notebook.sort_order, Notebook.created_at)
    )
    if not include_archived:
        query = query.where(Notebook.is_archived.is_(False))
    result = await db.execute(query)
    notebooks = result.scalars().all()

    out = []
    for nb in notebooks:
        # Count pages in this notebook
        cnt = await db.execute(
            select(func.count(Note.id)).where(
                Note.notebook_id == nb.id, Note.is_archived.is_(False)
            )
        )
        d = NotebookOut.model_validate(nb).model_dump()
        d["page_count"] = cnt.scalar() or 0
        out.append(d)

    return {"total": len(out), "notebooks": out}


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create a notebook")
async def create_notebook(
    payload: NotebookCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Get max sort_order
    result = await db.execute(
        select(func.max(Notebook.sort_order)).where(Notebook.owner_id == current_user.id)
    )
    max_order = result.scalar() or 0

    nb = Notebook(
        title=payload.title,
        description=payload.description,
        owner_id=current_user.id,
        icon=payload.icon,
        color=payload.color,
        cover_image_url=payload.cover_image_url,
        sort_order=max_order + 1,
    )
    db.add(nb)
    await db.flush()

    # Auto-create a default "General" section
    sec = NotebookSection(
        notebook_id=nb.id,
        title="General",
        sort_order=0,
    )
    db.add(sec)
    await db.commit()
    await db.refresh(nb)
    return NotebookOut.model_validate(nb).model_dump()


@router.get("/{notebook_id}", summary="Get a notebook with sections and page tree")
async def get_notebook(
    notebook_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    nb = await _get_notebook_or_404(notebook_id, current_user.id, db)

    # Fetch sections
    sec_result = await db.execute(
        select(NotebookSection)
        .where(NotebookSection.notebook_id == nb.id)
        .order_by(NotebookSection.sort_order)
    )
    sections = sec_result.scalars().all()

    section_list = []
    total_pages = 0
    for sec in sections:
        cnt = await db.execute(
            select(func.count(Note.id)).where(
                Note.section_id == sec.id, Note.is_archived.is_(False)
            )
        )
        page_count = cnt.scalar() or 0
        total_pages += page_count
        sd = SectionOut.model_validate(sec).model_dump()
        sd["page_count"] = page_count
        section_list.append(sd)

    out = NotebookOut.model_validate(nb).model_dump()
    out["sections"] = section_list
    out["page_count"] = total_pages
    return out


@router.put("/{notebook_id}", summary="Update a notebook")
async def update_notebook(
    notebook_id: uuid.UUID,
    payload: NotebookUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    nb = await _get_notebook_or_404(notebook_id, current_user.id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(nb, field, value)
    await db.commit()
    await db.refresh(nb)
    return NotebookOut.model_validate(nb).model_dump()


@router.delete("/{notebook_id}", status_code=status.HTTP_200_OK, summary="Archive a notebook")
async def delete_notebook(
    notebook_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    permanent: bool = Query(False),
) -> Response:
    nb = await _get_notebook_or_404(notebook_id, current_user.id, db)
    if nb.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete the default notebook")
    if permanent:
        await db.delete(nb)
    else:
        nb.is_archived = True
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


@router.put("/reorder", summary="Reorder notebooks")
async def reorder_notebooks(
    payload: ReorderPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, str]:
    for idx, nb_id in enumerate(payload.ids):
        nb = await db.get(Notebook, nb_id)
        if nb and nb.owner_id == current_user.id:
            nb.sort_order = idx
    await db.commit()
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Section CRUD
# ---------------------------------------------------------------------------


@router.post("/{notebook_id}/sections", status_code=status.HTTP_201_CREATED, summary="Create a section")
async def create_section(
    notebook_id: uuid.UUID,
    payload: SectionCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    nb = await _get_notebook_or_404(notebook_id, current_user.id, db)

    result = await db.execute(
        select(func.max(NotebookSection.sort_order)).where(
            NotebookSection.notebook_id == nb.id
        )
    )
    max_order = result.scalar() or 0

    sec = NotebookSection(
        notebook_id=nb.id,
        title=payload.title,
        color=payload.color,
        sort_order=max_order + 1,
    )
    db.add(sec)
    await db.commit()
    await db.refresh(sec)
    return SectionOut.model_validate(sec).model_dump()


@router.put("/{notebook_id}/sections/{section_id}", summary="Update a section")
async def update_section(
    notebook_id: uuid.UUID,
    section_id: uuid.UUID,
    payload: SectionUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_notebook_or_404(notebook_id, current_user.id, db)
    sec = await _get_section_or_404(section_id, current_user.id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(sec, field, value)
    await db.commit()
    await db.refresh(sec)
    return SectionOut.model_validate(sec).model_dump()


@router.delete("/{notebook_id}/sections/{section_id}", status_code=status.HTTP_200_OK, summary="Delete a section")
async def delete_section(
    notebook_id: uuid.UUID,
    section_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    nb = await _get_notebook_or_404(notebook_id, current_user.id, db)
    sec = await _get_section_or_404(section_id, current_user.id, db)

    # Move orphaned pages to the first remaining section
    other_sec = await db.execute(
        select(NotebookSection)
        .where(NotebookSection.notebook_id == nb.id, NotebookSection.id != sec.id)
        .order_by(NotebookSection.sort_order)
        .limit(1)
    )
    fallback = other_sec.scalar_one_or_none()
    if fallback:
        pages = await db.execute(select(Note).where(Note.section_id == sec.id))
        for page in pages.scalars().all():
            page.section_id = fallback.id

    await db.delete(sec)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


@router.put("/{notebook_id}/sections/reorder", summary="Reorder sections within a notebook")
async def reorder_sections(
    notebook_id: uuid.UUID,
    payload: ReorderPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, str]:
    await _get_notebook_or_404(notebook_id, current_user.id, db)
    for idx, sec_id in enumerate(payload.ids):
        sec = await db.get(NotebookSection, sec_id)
        if sec and sec.notebook_id == notebook_id:
            sec.sort_order = idx
    await db.commit()
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Page tree & navigation
# ---------------------------------------------------------------------------


@router.get("/{notebook_id}/pages", summary="List all pages in a notebook (tree structure)")
async def list_notebook_pages(
    notebook_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    section_id: uuid.UUID | None = Query(None),
) -> dict[str, Any]:
    await _get_notebook_or_404(notebook_id, current_user.id, db)

    query = (
        select(Note)
        .where(
            Note.notebook_id == notebook_id,
            Note.owner_id == current_user.id,
            Note.is_archived.is_(False),
        )
        .order_by(Note.sort_order, Note.created_at)
    )
    if section_id:
        query = query.where(Note.section_id == section_id)

    result = await db.execute(query)
    pages = result.scalars().all()

    # Build tree from flat list
    page_map: dict[uuid.UUID, dict] = {}
    roots: list[dict] = []
    for p in pages:
        item = NoteTreeItem.model_validate(p).model_dump()
        item["sub_pages"] = []
        page_map[p.id] = item

    for p in pages:
        item = page_map[p.id]
        if p.parent_page_id and p.parent_page_id in page_map:
            page_map[p.parent_page_id]["sub_pages"].append(item)
        else:
            roots.append(item)

    return {"total": len(pages), "pages": roots}


@router.get("/{notebook_id}/tree", summary="Full notebook tree (sections + pages)")
async def notebook_tree(
    notebook_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    nb = await _get_notebook_or_404(notebook_id, current_user.id, db)

    # Sections
    sec_result = await db.execute(
        select(NotebookSection)
        .where(NotebookSection.notebook_id == nb.id)
        .order_by(NotebookSection.sort_order)
    )
    sections = sec_result.scalars().all()

    # All pages in notebook
    pages_result = await db.execute(
        select(Note)
        .where(
            Note.notebook_id == nb.id,
            Note.owner_id == current_user.id,
            Note.is_archived.is_(False),
        )
        .order_by(Note.sort_order, Note.created_at)
    )
    all_pages = pages_result.scalars().all()

    # Group pages by section, build trees
    section_pages: dict[uuid.UUID, list[Note]] = {}
    for p in all_pages:
        sid = p.section_id
        if sid:
            section_pages.setdefault(sid, []).append(p)

    def _build_tree(pages: list[Note]) -> list[dict]:
        page_map: dict[uuid.UUID, dict] = {}
        roots: list[dict] = []
        for p in pages:
            item = NoteTreeItem.model_validate(p).model_dump()
            item["sub_pages"] = []
            page_map[p.id] = item
        for p in pages:
            item = page_map[p.id]
            if p.parent_page_id and p.parent_page_id in page_map:
                page_map[p.parent_page_id]["sub_pages"].append(item)
            else:
                roots.append(item)
        return roots

    tree = []
    for sec in sections:
        sd = SectionOut.model_validate(sec).model_dump()
        sd["pages"] = _build_tree(section_pages.get(sec.id, []))
        sd["page_count"] = len(section_pages.get(sec.id, []))
        tree.append(sd)

    return {
        "notebook": NotebookOut.model_validate(nb).model_dump(),
        "sections": tree,
    }


# ---------------------------------------------------------------------------
# Page operations (move, breadcrumb, recent, favorites)
# ---------------------------------------------------------------------------


@router.put("/pages/{note_id}/move", summary="Move a page to a different notebook/section/parent")
async def move_page(
    note_id: uuid.UUID,
    payload: NoteMovePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    note = await _get_note_or_404(note_id, current_user.id, db)

    if payload.notebook_id is not None:
        # Verify ownership of target notebook
        await _get_notebook_or_404(payload.notebook_id, current_user.id, db)
        note.notebook_id = payload.notebook_id
    if payload.section_id is not None:
        await _get_section_or_404(payload.section_id, current_user.id, db)
        note.section_id = payload.section_id
    if payload.parent_page_id is not None:
        # Prevent circular reference
        if payload.parent_page_id == note.id:
            raise HTTPException(status_code=400, detail="Cannot set a page as its own parent")
        parent = await _get_note_or_404(payload.parent_page_id, current_user.id, db)
        note.parent_page_id = parent.id
    elif payload.parent_page_id is None and "parent_page_id" in payload.model_fields_set:
        note.parent_page_id = None
    if payload.sort_order is not None:
        note.sort_order = payload.sort_order

    await db.commit()
    await db.refresh(note)
    return NoteOut.model_validate(note).model_dump()


@router.get("/pages/{note_id}/breadcrumb", summary="Get breadcrumb path for a page")
async def page_breadcrumb(
    note_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    note = await _get_note_or_404(note_id, current_user.id, db)
    crumbs: list[dict] = []

    # Notebook
    if note.notebook_id:
        nb = await db.get(Notebook, note.notebook_id)
        if nb:
            crumbs.append(NoteBreadcrumb(id=nb.id, title=nb.title, type="notebook").model_dump())

    # Section
    if note.section_id:
        sec = await db.get(NotebookSection, note.section_id)
        if sec:
            crumbs.append(NoteBreadcrumb(id=sec.id, title=sec.title, type="section").model_dump())

    # Parent pages (walk up the tree, max 10 levels to prevent infinite loops)
    parent_chain: list[dict] = []
    parent_id = note.parent_page_id
    depth = 0
    while parent_id and depth < 10:
        parent = await db.get(Note, parent_id)
        if not parent:
            break
        parent_chain.append(NoteBreadcrumb(id=parent.id, title=parent.title, type="page").model_dump())
        parent_id = parent.parent_page_id
        depth += 1
    parent_chain.reverse()
    crumbs.extend(parent_chain)

    # Current page
    crumbs.append(NoteBreadcrumb(id=note.id, title=note.title, type="page").model_dump())

    return {"breadcrumb": crumbs}


@router.get("/pages/recent", summary="Recently edited pages across all notebooks")
async def recent_pages(
    current_user: CurrentUser,
    db: DBSession,
    limit: int = Query(20, le=100),
) -> dict[str, Any]:
    result = await db.execute(
        select(Note)
        .where(
            Note.owner_id == current_user.id,
            Note.is_archived.is_(False),
        )
        .order_by(Note.updated_at.desc())
        .limit(limit)
    )
    pages = result.scalars().all()
    return {
        "total": len(pages),
        "pages": [NoteOut.model_validate(p).model_dump() for p in pages],
    }


@router.get("/pages/favorites", summary="Pinned/favorited pages")
async def favorite_pages(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(Note)
        .where(
            Note.owner_id == current_user.id,
            Note.is_pinned.is_(True),
            Note.is_archived.is_(False),
        )
        .order_by(Note.updated_at.desc())
    )
    pages = result.scalars().all()
    return {
        "total": len(pages),
        "pages": [NoteOut.model_validate(p).model_dump() for p in pages],
    }


# ---------------------------------------------------------------------------
# Entity links (relational cross-module linking)
# ---------------------------------------------------------------------------


@router.post("/pages/{note_id}/entity-links", status_code=status.HTTP_201_CREATED, summary="Link an ERP entity to a note")
async def create_entity_link(
    note_id: uuid.UUID,
    payload: EntityLinkCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    note = await _get_note_or_404(note_id, current_user.id, db)

    # Check for duplicates
    existing = await db.execute(
        select(NoteEntityLink).where(
            NoteEntityLink.note_id == note.id,
            NoteEntityLink.entity_type == payload.entity_type,
            NoteEntityLink.entity_id == payload.entity_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Link already exists")

    link = NoteEntityLink(
        note_id=note.id,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        link_type=payload.link_type,
        created_by_id=current_user.id,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return EntityLinkOut.model_validate(link).model_dump()


@router.get("/pages/{note_id}/entity-links", summary="List entity links for a note")
async def list_entity_links(
    note_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_note_or_404(note_id, current_user.id, db)
    result = await db.execute(
        select(NoteEntityLink)
        .where(NoteEntityLink.note_id == note_id)
        .order_by(NoteEntityLink.created_at.desc())
    )
    links = result.scalars().all()
    return {
        "total": len(links),
        "links": [EntityLinkOut.model_validate(l).model_dump() for l in links],
    }


@router.delete("/pages/{note_id}/entity-links/{link_id}", status_code=status.HTTP_200_OK, summary="Remove an entity link")
async def delete_entity_link(
    note_id: uuid.UUID,
    link_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    await _get_note_or_404(note_id, current_user.id, db)
    link = await db.get(NoteEntityLink, link_id)
    if not link or link.note_id != note_id:
        raise HTTPException(status_code=404, detail="Link not found")
    await db.delete(link)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Version history
# ---------------------------------------------------------------------------


@router.get("/pages/{note_id}/versions", summary="List version history for a note")
async def list_versions(
    note_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_note_or_404(note_id, current_user.id, db)
    result = await db.execute(
        select(NoteVersion)
        .where(NoteVersion.note_id == note_id)
        .order_by(NoteVersion.version_number.desc())
    )
    versions = result.scalars().all()
    return {
        "total": len(versions),
        "versions": [NoteVersionOut.model_validate(v).model_dump() for v in versions],
    }


@router.post("/pages/{note_id}/versions", status_code=status.HTTP_201_CREATED, summary="Create a named version snapshot")
async def create_version(
    note_id: uuid.UUID,
    payload: NoteVersionCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    note = await _get_note_or_404(note_id, current_user.id, db)

    # Get next version number
    result = await db.execute(
        select(func.max(NoteVersion.version_number)).where(NoteVersion.note_id == note.id)
    )
    max_ver = result.scalar() or 0

    version = NoteVersion(
        note_id=note.id,
        version_number=max_ver + 1,
        content_snapshot=note.content or "",
        content_format=note.content_format,
        created_by_id=current_user.id,
        label=payload.label,
        word_count=note.word_count,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)
    return NoteVersionOut.model_validate(version).model_dump()


@router.get("/pages/{note_id}/versions/{version_id}", summary="Get a specific version's content")
async def get_version(
    note_id: uuid.UUID,
    version_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_note_or_404(note_id, current_user.id, db)
    version = await db.get(NoteVersion, version_id)
    if not version or version.note_id != note_id:
        raise HTTPException(status_code=404, detail="Version not found")
    out = NoteVersionOut.model_validate(version).model_dump()
    out["content_snapshot"] = version.content_snapshot
    return out


@router.post("/pages/{note_id}/versions/{version_id}/restore", summary="Restore note to a previous version")
async def restore_version(
    note_id: uuid.UUID,
    version_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    note = await _get_note_or_404(note_id, current_user.id, db)
    version = await db.get(NoteVersion, version_id)
    if not version or version.note_id != note_id:
        raise HTTPException(status_code=404, detail="Version not found")

    # Save current state as a new version before restoring
    result = await db.execute(
        select(func.max(NoteVersion.version_number)).where(NoteVersion.note_id == note.id)
    )
    max_ver = result.scalar() or 0

    backup = NoteVersion(
        note_id=note.id,
        version_number=max_ver + 1,
        content_snapshot=note.content or "",
        content_format=note.content_format,
        created_by_id=current_user.id,
        label=f"Auto-saved before restore to v{version.version_number}",
        word_count=note.word_count,
    )
    db.add(backup)

    # Restore
    note.content = version.content_snapshot
    note.content_format = version.content_format
    await db.commit()
    await db.refresh(note)
    return NoteOut.model_validate(note).model_dump()


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------


@router.get("/pages/{note_id}/comments", summary="List comments for a note")
async def list_comments(
    note_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_note_or_404(note_id, current_user.id, db)
    result = await db.execute(
        select(NoteComment)
        .where(NoteComment.note_id == note_id, NoteComment.parent_comment_id.is_(None))
        .order_by(NoteComment.created_at)
    )
    top_level = result.scalars().all()

    async def _with_replies(comment: NoteComment) -> dict:
        out = NoteCommentOut.model_validate(comment).model_dump()
        replies_result = await db.execute(
            select(NoteComment)
            .where(NoteComment.parent_comment_id == comment.id)
            .order_by(NoteComment.created_at)
        )
        replies = replies_result.scalars().all()
        out["replies"] = [await _with_replies(r) for r in replies]
        return out

    comments = [await _with_replies(c) for c in top_level]
    return {"total": len(comments), "comments": comments}


@router.post("/pages/{note_id}/comments", status_code=status.HTTP_201_CREATED, summary="Add a comment")
async def create_comment(
    note_id: uuid.UUID,
    payload: NoteCommentCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_note_or_404(note_id, current_user.id, db)
    comment = NoteComment(
        note_id=note_id,
        author_id=current_user.id,
        content=payload.content,
        parent_comment_id=payload.parent_comment_id,
        anchor_block_id=payload.anchor_block_id,
        anchor_text=payload.anchor_text,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return NoteCommentOut.model_validate(comment).model_dump()


@router.delete("/pages/{note_id}/comments/{comment_id}", status_code=status.HTTP_200_OK, summary="Delete a comment")
async def delete_comment(
    note_id: uuid.UUID,
    comment_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    comment = await db.get(NoteComment, comment_id)
    if not comment or comment.note_id != note_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot delete another user's comment")
    await db.delete(comment)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


@router.post("/pages/{note_id}/comments/{comment_id}/resolve", summary="Resolve a comment thread")
async def resolve_comment(
    note_id: uuid.UUID,
    comment_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    comment = await db.get(NoteComment, comment_id)
    if not comment or comment.note_id != note_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    comment.is_resolved = True
    comment.resolved_by_id = current_user.id
    await db.commit()
    await db.refresh(comment)
    return NoteCommentOut.model_validate(comment).model_dump()
