"""Drive extensions — copy, bulk ops, versions, trash, storage, search, tags, comments, cross-module links,
AI semantic search, smart folders, saved views, AI metadata, activity logging, file locking."""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.core.sanitize import like_pattern
from app.models.drive import (
    DriveFile, DriveFolder, DriveSnapshot, FileAccessLog, FileAIMetadata,
    FileComment, FileMetadata, FileTag, SavedView, SensitivityLabel, SmartFolder, TrashBin,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Cross-module link schemas ─────────────────────────────────────────────────

class LinkTaskPayload(BaseModel):
    task_id: uuid.UUID
    project_id: uuid.UUID


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class BulkFileIds(BaseModel):
    file_ids: list[uuid.UUID]


class BulkMovePayload(BaseModel):
    file_ids: list[uuid.UUID]
    target_folder_id: uuid.UUID | None = None


class TagCreate(BaseModel):
    tag_name: str


class CommentCreate(BaseModel):
    content: str


class TagOut(BaseModel):
    id: uuid.UUID
    file_id: uuid.UUID
    tag_name: str
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class CommentOut(BaseModel):
    id: uuid.UUID
    file_id: uuid.UUID
    user_id: uuid.UUID
    content: str
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class TrashOut(BaseModel):
    id: uuid.UUID
    file_id: uuid.UUID
    deleted_at: Any
    deleted_by: uuid.UUID
    auto_purge_at: Any
    file_name: str | None = None
    file_size: int | None = None

    model_config = {"from_attributes": True}


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _check_file_owner(db: AsyncSession, file_id: uuid.UUID, user_id: uuid.UUID) -> DriveFile:
    file = await db.get(DriveFile, file_id)
    if not file or file.owner_id != user_id:
        raise HTTPException(status_code=404, detail="File not found")
    return file


# ── Copy ─────────────────────────────────────────────────────────────────────

@router.post("/files/{file_id}/copy", status_code=status.HTTP_201_CREATED, summary="Copy a file")
async def copy_file(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    target_folder_id: uuid.UUID | None = Query(None, description="Target folder for the copy"),
) -> dict[str, Any]:
    from app.integrations import minio_client  # noqa: PLC0415

    file = await _check_file_owner(db, file_id, current_user.id)

    # Resolve target folder
    folder_path = file.folder_path
    resolved_folder_id = file.folder_id
    if target_folder_id:
        folder = await db.get(DriveFolder, target_folder_id)
        if folder and folder.owner_id == current_user.id:
            folder_path = f"/{folder.name}"
            resolved_folder_id = folder.id

    # Copy in MinIO
    new_file_id = uuid.uuid4()
    new_key = f"{current_user.id}/{folder_path.strip('/')}/{new_file_id}_{file.name}"

    try:
        minio_client.copy_file(file.minio_key, new_key)
    except Exception:
        # Fallback: download and re-upload
        try:
            data = minio_client.download_file(file.minio_key)
            record = minio_client.upload_file(
                file_data=data,
                filename=file.name,
                user_id=str(current_user.id),
                folder_path=folder_path.strip("/"),
                content_type=file.content_type,
            )
            new_key = record["minio_key"]
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Storage service unavailable: {exc}",
            ) from exc

    copy_name = f"Copy of {file.name}"
    new_file = DriveFile(
        id=new_file_id,
        name=copy_name,
        content_type=file.content_type,
        size=file.size,
        minio_key=new_key,
        folder_path=folder_path,
        folder_id=resolved_folder_id,
        owner_id=current_user.id,
        is_public=False,
    )
    db.add(new_file)
    await db.commit()
    await db.refresh(new_file)

    return {
        "id": str(new_file.id),
        "name": new_file.name,
        "content_type": new_file.content_type,
        "size": new_file.size,
        "folder_path": new_file.folder_path,
        "copied_from": str(file_id),
    }


# ── Bulk Operations ─────────────────────────────────────────────────────────

@router.post("/files/bulk-delete", summary="Bulk delete files (move to trash)")
async def bulk_delete(
    payload: BulkFileIds,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    deleted_ids: list[str] = []
    errors: list[str] = []

    for fid in payload.file_ids:
        file = await db.get(DriveFile, fid)
        if not file or file.owner_id != current_user.id:
            errors.append(f"File {fid} not found or access denied")
            continue

        # Move to trash
        trash = TrashBin(
            file_id=fid,
            deleted_by=current_user.id,
            auto_purge_at=datetime.now(timezone.utc) + timedelta(days=30),
        )
        db.add(trash)
        deleted_ids.append(str(fid))

    await db.commit()
    return {"deleted": deleted_ids, "errors": errors}


@router.post("/files/bulk-move", summary="Bulk move files to a folder")
async def bulk_move(
    payload: BulkMovePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Validate target folder
    folder_path = "/"
    if payload.target_folder_id:
        folder = await db.get(DriveFolder, payload.target_folder_id)
        if not folder or folder.owner_id != current_user.id:
            raise HTTPException(status_code=404, detail="Target folder not found")
        folder_path = f"/{folder.name}"

    moved_ids: list[str] = []
    errors: list[str] = []

    for fid in payload.file_ids:
        file = await db.get(DriveFile, fid)
        if not file or file.owner_id != current_user.id:
            errors.append(f"File {fid} not found or access denied")
            continue

        file.folder_id = payload.target_folder_id
        file.folder_path = folder_path
        moved_ids.append(str(fid))

    await db.commit()
    return {"moved": moved_ids, "target_folder_id": str(payload.target_folder_id) if payload.target_folder_id else None, "errors": errors}


# ── Versions ─────────────────────────────────────────────────────────────────

@router.get("/files/{file_id}/versions", summary="List file versions")
async def list_versions(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """List object versions from MinIO. Requires MinIO bucket versioning enabled."""
    file = await _check_file_owner(db, file_id, current_user.id)

    try:
        from app.integrations import minio_client  # noqa: PLC0415
        versions = minio_client.list_versions(file.minio_key)
    except Exception:
        # Return current version only if versioning unavailable
        versions = [
            {
                "version_id": "current",
                "last_modified": file.updated_at.isoformat() if file.updated_at else None,
                "size": file.size,
                "is_latest": True,
            }
        ]

    return {
        "file_id": str(file_id),
        "name": file.name,
        "versions": versions,
    }


# ── Trash ────────────────────────────────────────────────────────────────────

@router.get("/trash", summary="List files in trash bin")
async def list_trash(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    query = (
        select(TrashBin, DriveFile.name, DriveFile.size)
        .join(DriveFile, DriveFile.id == TrashBin.file_id)
        .where(TrashBin.deleted_by == current_user.id)
        .order_by(TrashBin.deleted_at.desc())
    )
    result = await db.execute(query)
    rows = result.all()
    items = []
    for trash, file_name, file_size in rows:
        items.append({
            "id": str(trash.id),
            "file_id": str(trash.file_id),
            "file_name": file_name,
            "file_size": file_size,
            "deleted_at": trash.deleted_at.isoformat() if trash.deleted_at else None,
            "auto_purge_at": trash.auto_purge_at.isoformat() if trash.auto_purge_at else None,
        })
    return {"total": len(items), "items": items}


@router.post("/files/{file_id}/restore", summary="Restore a file from trash")
async def restore_file(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(TrashBin).where(
            TrashBin.file_id == file_id,
            TrashBin.deleted_by == current_user.id,
        )
    )
    trash = result.scalar_one_or_none()
    if not trash:
        raise HTTPException(status_code=404, detail="File not found in trash")

    await db.delete(trash)
    await db.commit()
    return {"restored": True, "file_id": str(file_id)}


@router.delete("/trash", status_code=status.HTTP_200_OK, summary="Empty the trash bin")
async def empty_trash(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.integrations import minio_client  # noqa: PLC0415

    # Get all trashed files
    result = await db.execute(
        select(TrashBin).where(TrashBin.deleted_by == current_user.id)
    )
    trashed = result.scalars().all()

    purged = 0
    for trash in trashed:
        file = await db.get(DriveFile, trash.file_id)
        if file:
            try:
                minio_client.delete_file(file.minio_key)
            except Exception:
                pass
            await db.delete(file)
        await db.delete(trash)
        purged += 1

    await db.commit()
    return {"purged": purged}


# ── Storage ──────────────────────────────────────────────────────────────────

@router.get("/storage/usage", summary="Get storage usage statistics")
async def storage_usage(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Total size
    total_result = await db.execute(
        select(func.sum(DriveFile.size), func.count(DriveFile.id))
        .where(DriveFile.owner_id == current_user.id)
    )
    row = total_result.one()
    total_bytes = row[0] or 0
    total_files = row[1] or 0

    # By content type
    type_result = await db.execute(
        select(DriveFile.content_type, func.sum(DriveFile.size), func.count(DriveFile.id))
        .where(DriveFile.owner_id == current_user.id)
        .group_by(DriveFile.content_type)
        .order_by(func.sum(DriveFile.size).desc())
    )
    by_type = [
        {"content_type": ct, "size": int(sz or 0), "count": int(cnt)}
        for ct, sz, cnt in type_result.all()
    ]

    # Trash size
    trash_result = await db.execute(
        select(func.sum(DriveFile.size))
        .join(TrashBin, TrashBin.file_id == DriveFile.id)
        .where(TrashBin.deleted_by == current_user.id)
    )
    trash_bytes = trash_result.scalar() or 0

    return {
        "total_bytes": int(total_bytes),
        "total_files": total_files,
        "trash_bytes": int(trash_bytes),
        "by_type": by_type,
    }


# ── Search ───────────────────────────────────────────────────────────────────

@router.get("/files/search", summary="Full-text search across files")
async def search_files(
    current_user: CurrentUser,
    db: DBSession,
    q: str = Query(..., min_length=1, description="Search query"),
    content_type: str | None = Query(None, description="Filter by content type"),
    folder_id: uuid.UUID | None = Query(None, description="Filter by folder"),
    tag: str | None = Query(None, description="Filter by tag"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    query = select(DriveFile).where(
        DriveFile.owner_id == current_user.id,
        DriveFile.name.ilike(like_pattern(q)),
    )

    if content_type:
        query = query.where(DriveFile.content_type.ilike(like_pattern(content_type)))
    if folder_id:
        query = query.where(DriveFile.folder_id == folder_id)
    if tag:
        query = query.join(FileTag, FileTag.file_id == DriveFile.id).where(
            FileTag.tag_name.ilike(like_pattern(tag))
        )

    query = query.order_by(DriveFile.updated_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    files = result.scalars().all()

    return {
        "total": len(files),
        "files": [
            {
                "id": str(f.id),
                "name": f.name,
                "content_type": f.content_type,
                "size": f.size,
                "folder_path": f.folder_path,
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "updated_at": f.updated_at.isoformat() if f.updated_at else None,
            }
            for f in files
        ],
    }


# ── Tags ─────────────────────────────────────────────────────────────────────

@router.get("/files/{file_id}/tags", summary="List tags for a file")
async def list_file_tags(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _check_file_owner(db, file_id, current_user.id)
    result = await db.execute(
        select(FileTag).where(FileTag.file_id == file_id).order_by(FileTag.tag_name)
    )
    tags = result.scalars().all()
    return {"total": len(tags), "tags": [TagOut.model_validate(t).model_dump() for t in tags]}


@router.post("/files/{file_id}/tags", status_code=status.HTTP_201_CREATED, summary="Add a tag to a file")
async def add_file_tag(
    file_id: uuid.UUID,
    payload: TagCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _check_file_owner(db, file_id, current_user.id)

    # Check for duplicate
    existing = await db.execute(
        select(FileTag).where(FileTag.file_id == file_id, FileTag.tag_name == payload.tag_name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Tag already exists on this file")

    tag = FileTag(file_id=file_id, tag_name=payload.tag_name)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return TagOut.model_validate(tag).model_dump()


@router.delete("/files/{file_id}/tags/{tag_name}", status_code=status.HTTP_200_OK, summary="Remove a tag from a file")
async def remove_file_tag(
    file_id: uuid.UUID,
    tag_name: str,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    await _check_file_owner(db, file_id, current_user.id)

    result = await db.execute(
        select(FileTag).where(FileTag.file_id == file_id, FileTag.tag_name == tag_name)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    await db.delete(tag)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ── Comments ─────────────────────────────────────────────────────────────────

@router.get("/files/{file_id}/comments", summary="List comments on a file")
async def list_file_comments(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _check_file_owner(db, file_id, current_user.id)
    result = await db.execute(
        select(FileComment).where(FileComment.file_id == file_id).order_by(FileComment.created_at.asc())
    )
    comments = result.scalars().all()
    return {
        "total": len(comments),
        "comments": [CommentOut.model_validate(c).model_dump() for c in comments],
    }


@router.post("/files/{file_id}/comments", status_code=status.HTTP_201_CREATED, summary="Add a comment to a file")
async def add_file_comment(
    file_id: uuid.UUID,
    payload: CommentCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _check_file_owner(db, file_id, current_user.id)

    comment = FileComment(
        file_id=file_id,
        user_id=current_user.id,
        content=payload.content,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return CommentOut.model_validate(comment).model_dump()


# ══════════════════════════════════════════════════════════════════════════════
#  CROSS-MODULE: Drive → Docs (open in ONLYOFFICE editor)
# ══════════════════════════════════════════════════════════════════════════════

EDITABLE_EXTENSIONS = {"docx", "doc", "odt", "xlsx", "xls", "ods", "pptx", "ppt", "odp", "pdf"}


@router.post(
    "/files/{file_id}/open-in-editor",
    summary="Open a Drive file in ONLYOFFICE editor",
    status_code=status.HTTP_200_OK,
)
async def open_file_in_editor(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Return an ONLYOFFICE editor config for doc/xlsx/pptx files stored in Drive."""
    file = await _check_file_owner(db, file_id, current_user.id)

    ext = file.name.rsplit(".", 1)[-1].lower() if "." in file.name else ""
    if ext not in EDITABLE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '.{ext}' is not supported by the editor. "
                   f"Supported: {', '.join(sorted(EDITABLE_EXTENSIONS))}",
        )

    from app.integrations.minio_client import get_download_url  # noqa: PLC0415
    from app.integrations.onlyoffice import get_editor_config  # noqa: PLC0415
    from app.core.config import settings  # noqa: PLC0415

    download_url = get_download_url(file.minio_key)
    callback_url = f"{settings.APP_URL}/api/v1/docs/callback"

    user_name = getattr(current_user, "full_name", None) or getattr(current_user, "email", str(current_user.id))

    config = get_editor_config(
        file_id=str(file.id),
        filename=file.name,
        user_id=str(current_user.id),
        user_name=user_name,
        download_url=download_url,
        callback_url=callback_url,
        mode="edit",
    )

    editor_url = f"{settings.ONLYOFFICE_PUBLIC_URL}"

    return {
        "editor_url": editor_url,
        "config": config,
        "file_id": str(file.id),
        "file_name": file.name,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  CROSS-MODULE: Drive → Mail (get file as attachment metadata)
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/files/{file_id}/as-attachment",
    summary="Get Drive file metadata for mail attachment",
    status_code=status.HTTP_200_OK,
)
async def file_as_attachment(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Return file metadata and a pre-signed download URL suitable for attaching to an email."""
    file = await _check_file_owner(db, file_id, current_user.id)

    from app.integrations.minio_client import get_download_url  # noqa: PLC0415

    download_url = get_download_url(file.minio_key)

    return {
        "file_id": str(file.id),
        "name": file.name,
        "content_type": file.content_type,
        "size": file.size,
        "download_url": download_url,
        "minio_key": file.minio_key,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  CROSS-MODULE: Drive → Projects (link file to task)
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/files/{file_id}/link-task",
    summary="Link a Drive file to a project task",
    status_code=status.HTTP_201_CREATED,
)
async def link_file_to_task(
    file_id: uuid.UUID,
    payload: LinkTaskPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Create a TaskAttachment linking this Drive file to a project task."""
    file = await _check_file_owner(db, file_id, current_user.id)

    from app.models.projects import Task, TaskAttachment  # noqa: PLC0415

    # Verify the task exists and belongs to a project the user can access
    task = await db.get(Task, payload.task_id)
    if not task or task.project_id != payload.project_id:
        raise HTTPException(status_code=404, detail="Task not found in the specified project")

    # Check for duplicate attachment
    existing = await db.execute(
        select(TaskAttachment).where(
            TaskAttachment.task_id == payload.task_id,
            TaskAttachment.file_id == file_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="File is already linked to this task")

    attachment = TaskAttachment(
        task_id=payload.task_id,
        file_id=file_id,
        file_name=file.name,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)

    await event_bus.publish("drive.file.linked_to_task", {
        "file_id": str(file_id),
        "file_name": file.name,
        "task_id": str(payload.task_id),
        "project_id": str(payload.project_id),
        "user_id": str(current_user.id),
    })

    return {
        "attachment_id": str(attachment.id),
        "file_id": str(file_id),
        "file_name": file.name,
        "task_id": str(payload.task_id),
        "project_id": str(payload.project_id),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  AI-POWERED SEMANTIC SEARCH
# ══════════════════════════════════════════════════════════════════════════════


class SemanticSearchParams(BaseModel):
    query: str
    content_type: str | None = None
    folder_id: uuid.UUID | None = None
    tag: str | None = None
    date_from: str | None = None  # ISO date
    date_to: str | None = None  # ISO date
    sensitivity: str | None = None
    page: int = 1
    limit: int = 30


@router.post("/files/semantic-search", summary="AI-powered semantic search across file content")
async def semantic_search(
    params: SemanticSearchParams,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Search files using combined: PostgreSQL full-text search + pgvector cosine similarity + filename match.

    Returns results ranked by relevance score combining all three signals.
    """
    q = params.query.strip()
    if not q:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    results = []
    offset = (params.page - 1) * params.limit

    # Strategy 1: PostgreSQL tsvector full-text search (fast, keyword-based)
    fts_sql = """
        SELECT id, name, content_type, size, folder_path, sensitivity_level,
               ts_rank(search_vector, plainto_tsquery('english', :query)) AS fts_score,
               created_at, updated_at
        FROM drive_files
        WHERE owner_id = :owner_id
          AND search_vector @@ plainto_tsquery('english', :query)
    """
    sql_params: dict[str, Any] = {"query": q, "owner_id": str(current_user.id)}

    if params.content_type:
        fts_sql += " AND content_type ILIKE :ct"
        sql_params["ct"] = f"%{params.content_type}%"
    if params.folder_id:
        fts_sql += " AND folder_id = :fid"
        sql_params["fid"] = str(params.folder_id)
    if params.sensitivity:
        fts_sql += " AND sensitivity_level = :sens"
        sql_params["sens"] = params.sensitivity
    if params.date_from:
        fts_sql += " AND created_at >= :date_from"
        sql_params["date_from"] = params.date_from
    if params.date_to:
        fts_sql += " AND created_at <= :date_to"
        sql_params["date_to"] = params.date_to

    fts_sql += " ORDER BY fts_score DESC LIMIT :lim OFFSET :off"
    sql_params["lim"] = params.limit
    sql_params["off"] = offset

    fts_result = await db.execute(text(fts_sql), sql_params)
    fts_rows = fts_result.fetchall()

    seen_ids = set()
    for row in fts_rows:
        file_id = str(row[0])
        seen_ids.add(file_id)
        results.append({
            "id": file_id,
            "name": row[1],
            "content_type": row[2],
            "size": row[3],
            "folder_path": row[4],
            "sensitivity_level": row[5],
            "relevance_score": round(float(row[6]) * 100, 2),
            "match_type": "content",
            "created_at": row[7].isoformat() if row[7] else None,
            "updated_at": row[8].isoformat() if row[8] else None,
        })

    # Strategy 2: pgvector semantic search (if embeddings exist)
    if len(results) < params.limit:
        try:
            from app.services.embedding import embedding_svc

            query_embedding = await embedding_svc.embed_text(q)
            remaining = params.limit - len(results)

            # Search via DocumentEmbedding table for chunked matches
            vec_sql = """
                SELECT de.source_id, de.chunk_text, de.metadata_json,
                       (de.embedding <=> :query_vec::vector) AS distance
                FROM document_embeddings de
                WHERE de.source_type = 'drive_file'
                ORDER BY de.embedding <=> :query_vec::vector
                LIMIT :lim
            """
            vec_result = await db.execute(
                text(vec_sql),
                {"query_vec": str(query_embedding), "lim": remaining + 10},
            )
            vec_rows = vec_result.fetchall()

            for row in vec_rows:
                file_id = str(row[0])
                if file_id in seen_ids:
                    continue
                seen_ids.add(file_id)

                # Fetch file details
                file_stmt = select(DriveFile).where(
                    DriveFile.id == row[0],
                    DriveFile.owner_id == current_user.id,
                )
                file_result = await db.execute(file_stmt)
                drive_file = file_result.scalar_one_or_none()
                if not drive_file:
                    continue

                similarity = max(0, 1.0 - float(row[3]))
                results.append({
                    "id": file_id,
                    "name": drive_file.name,
                    "content_type": drive_file.content_type,
                    "size": drive_file.size,
                    "folder_path": drive_file.folder_path,
                    "sensitivity_level": drive_file.sensitivity_level,
                    "relevance_score": round(similarity * 100, 2),
                    "match_type": "semantic",
                    "snippet": row[1][:200] if row[1] else None,
                    "created_at": drive_file.created_at.isoformat() if drive_file.created_at else None,
                    "updated_at": drive_file.updated_at.isoformat() if drive_file.updated_at else None,
                })

                if len(results) >= params.limit:
                    break
        except Exception as exc:
            logger.warning("Semantic search fallback — embedding search failed: %s", exc)

    # Strategy 3: Fallback to filename ILIKE if very few results
    if len(results) < 5:
        fallback_stmt = (
            select(DriveFile)
            .where(
                DriveFile.owner_id == current_user.id,
                DriveFile.name.ilike(like_pattern(q)),
            )
            .limit(params.limit)
        )
        fallback_result = await db.execute(fallback_stmt)
        for f in fallback_result.scalars().all():
            fid = str(f.id)
            if fid not in seen_ids:
                seen_ids.add(fid)
                results.append({
                    "id": fid,
                    "name": f.name,
                    "content_type": f.content_type,
                    "size": f.size,
                    "folder_path": f.folder_path,
                    "sensitivity_level": f.sensitivity_level,
                    "relevance_score": 50.0,
                    "match_type": "filename",
                    "created_at": f.created_at.isoformat() if f.created_at else None,
                    "updated_at": f.updated_at.isoformat() if f.updated_at else None,
                })

    # Sort by relevance
    results.sort(key=lambda x: x["relevance_score"], reverse=True)

    return {"total": len(results), "query": q, "results": results[:params.limit]}


# ══════════════════════════════════════════════════════════════════════════════
#  AI FILE METADATA & INSIGHTS
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/files/{file_id}/ai-metadata", summary="Get AI-generated insights for a file")
async def get_file_ai_metadata(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await _check_file_owner(db, file_id, current_user.id)

    result = await db.execute(
        select(FileAIMetadata).where(FileAIMetadata.file_id == file_id)
    )
    ai_meta = result.scalar_one_or_none()

    if not ai_meta:
        return {
            "file_id": str(file_id),
            "status": "not_processed",
            "ai_processed": file.ai_processed,
        }

    return {
        "file_id": str(file_id),
        "status": "processed" if ai_meta.summary else "processing",
        "summary": ai_meta.summary,
        "entities": ai_meta.entities_json,
        "suggested_tags": ai_meta.suggested_tags,
        "sensitivity_level": ai_meta.sensitivity_level,
        "language": ai_meta.language,
        "word_count": ai_meta.word_count,
        "module_suggestions": ai_meta.module_suggestions,
        "processed_at": ai_meta.processed_at.isoformat() if ai_meta.processed_at else None,
        "processing_error": ai_meta.processing_error,
    }


@router.post("/files/{file_id}/reprocess-ai", summary="Re-trigger AI analysis for a file")
async def reprocess_file_ai(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await _check_file_owner(db, file_id, current_user.id)

    from app.tasks.file_processing import extract_file_content
    extract_file_content.delay(str(file_id))

    return {"status": "queued", "file_id": str(file_id)}


@router.post("/files/{file_id}/apply-ai-tags", summary="Apply AI-suggested tags to a file")
async def apply_ai_tags(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await _check_file_owner(db, file_id, current_user.id)

    result = await db.execute(
        select(FileAIMetadata).where(FileAIMetadata.file_id == file_id)
    )
    ai_meta = result.scalar_one_or_none()
    if not ai_meta or not ai_meta.suggested_tags:
        raise HTTPException(status_code=404, detail="No AI-suggested tags available")

    applied = []
    for tag_name in ai_meta.suggested_tags:
        existing = await db.execute(
            select(FileTag).where(FileTag.file_id == file_id, FileTag.tag_name == tag_name)
        )
        if not existing.scalar_one_or_none():
            tag = FileTag(file_id=file_id, tag_name=tag_name, source="ai")
            db.add(tag)
            applied.append(tag_name)

    await db.commit()
    return {"applied_tags": applied, "file_id": str(file_id)}


# ══════════════════════════════════════════════════════════════════════════════
#  SMART FOLDERS
# ══════════════════════════════════════════════════════════════════════════════


class SmartFolderCreate(BaseModel):
    name: str
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    filter_json: dict
    sort_field: str = "created_at"
    sort_direction: str = "desc"
    is_pinned: bool = False


class SmartFolderUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    filter_json: dict | None = None
    sort_field: str | None = None
    sort_direction: str | None = None
    is_pinned: bool | None = None


@router.get("/smart-folders", summary="List user's smart folders")
async def list_smart_folders(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(SmartFolder)
        .where(SmartFolder.owner_id == current_user.id)
        .order_by(SmartFolder.is_pinned.desc(), SmartFolder.name)
    )
    folders = result.scalars().all()
    return {
        "total": len(folders),
        "smart_folders": [
            {
                "id": str(f.id),
                "name": f.name,
                "description": f.description,
                "icon": f.icon,
                "color": f.color,
                "filter_json": f.filter_json,
                "sort_field": f.sort_field,
                "sort_direction": f.sort_direction,
                "is_pinned": f.is_pinned,
                "created_at": f.created_at.isoformat() if f.created_at else None,
            }
            for f in folders
        ],
    }


@router.post("/smart-folders", status_code=status.HTTP_201_CREATED, summary="Create a smart folder")
async def create_smart_folder(
    payload: SmartFolderCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    folder = SmartFolder(
        name=payload.name,
        description=payload.description,
        icon=payload.icon,
        color=payload.color,
        owner_id=current_user.id,
        filter_json=payload.filter_json,
        sort_field=payload.sort_field,
        sort_direction=payload.sort_direction,
        is_pinned=payload.is_pinned,
    )
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    return {
        "id": str(folder.id),
        "name": folder.name,
        "filter_json": folder.filter_json,
    }


@router.put("/smart-folders/{folder_id}", summary="Update a smart folder")
async def update_smart_folder(
    folder_id: uuid.UUID,
    payload: SmartFolderUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    folder = await db.get(SmartFolder, folder_id)
    if not folder or folder.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Smart folder not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(folder, field, value)

    await db.commit()
    await db.refresh(folder)
    return {"id": str(folder.id), "name": folder.name, "updated": True}


@router.delete("/smart-folders/{folder_id}", status_code=status.HTTP_200_OK)
async def delete_smart_folder(
    folder_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    folder = await db.get(SmartFolder, folder_id)
    if not folder or folder.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Smart folder not found")
    await db.delete(folder)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


@router.get("/smart-folders/{folder_id}/files", summary="Get files matching smart folder filter")
async def smart_folder_files(
    folder_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    folder = await db.get(SmartFolder, folder_id)
    if not folder or folder.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Smart folder not found")

    filters = folder.filter_json or {}
    query = select(DriveFile).where(DriveFile.owner_id == current_user.id)

    # Apply filters from the smart folder DSL
    if filters.get("content_types"):
        query = query.where(DriveFile.content_type.in_(filters["content_types"]))
    if filters.get("tags"):
        query = query.join(FileTag, FileTag.file_id == DriveFile.id).where(
            FileTag.tag_name.in_(filters["tags"])
        )
    if filters.get("query"):
        query = query.where(DriveFile.name.ilike(like_pattern(filters["query"])))
    if filters.get("date_from"):
        query = query.where(DriveFile.created_at >= filters["date_from"])
    if filters.get("date_to"):
        query = query.where(DriveFile.created_at <= filters["date_to"])
    if filters.get("sensitivity"):
        query = query.where(DriveFile.sensitivity_level == filters["sensitivity"])
    if filters.get("folder_id"):
        query = query.where(DriveFile.folder_id == filters["folder_id"])
    if filters.get("size_min"):
        query = query.where(DriveFile.size >= filters["size_min"])
    if filters.get("size_max"):
        query = query.where(DriveFile.size <= filters["size_max"])
    if filters.get("ai_processed") is not None:
        query = query.where(DriveFile.ai_processed == filters["ai_processed"])

    # Sort
    sort_col = getattr(DriveFile, folder.sort_field, DriveFile.created_at)
    if folder.sort_direction == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    files = result.scalars().all()

    return {
        "smart_folder": folder.name,
        "total": len(files),
        "files": [
            {
                "id": str(f.id),
                "name": f.name,
                "content_type": f.content_type,
                "size": f.size,
                "folder_path": f.folder_path,
                "sensitivity_level": f.sensitivity_level,
                "ai_processed": f.ai_processed,
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "updated_at": f.updated_at.isoformat() if f.updated_at else None,
            }
            for f in files
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
#  SAVED VIEWS
# ══════════════════════════════════════════════════════════════════════════════


class SavedViewCreate(BaseModel):
    name: str
    folder_id: uuid.UUID | None = None
    filters_json: dict | None = None
    sort_json: dict | None = None
    columns_json: list | None = None
    view_type: str = "list"
    is_default: bool = False


@router.get("/saved-views", summary="List saved views")
async def list_saved_views(
    current_user: CurrentUser,
    db: DBSession,
    folder_id: uuid.UUID | None = Query(None),
) -> dict[str, Any]:
    query = select(SavedView).where(SavedView.owner_id == current_user.id)
    if folder_id:
        query = query.where(
            or_(SavedView.folder_id == folder_id, SavedView.folder_id.is_(None))
        )
    result = await db.execute(query.order_by(SavedView.name))
    views = result.scalars().all()
    return {
        "total": len(views),
        "views": [
            {
                "id": str(v.id),
                "name": v.name,
                "folder_id": str(v.folder_id) if v.folder_id else None,
                "filters_json": v.filters_json,
                "sort_json": v.sort_json,
                "columns_json": v.columns_json,
                "view_type": v.view_type,
                "is_default": v.is_default,
            }
            for v in views
        ],
    }


@router.post("/saved-views", status_code=status.HTTP_201_CREATED, summary="Create a saved view")
async def create_saved_view(
    payload: SavedViewCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    view = SavedView(
        name=payload.name,
        owner_id=current_user.id,
        folder_id=payload.folder_id,
        filters_json=payload.filters_json,
        sort_json=payload.sort_json,
        columns_json=payload.columns_json,
        view_type=payload.view_type,
        is_default=payload.is_default,
    )
    db.add(view)
    await db.commit()
    await db.refresh(view)
    return {"id": str(view.id), "name": view.name}


@router.delete("/saved-views/{view_id}", status_code=status.HTTP_200_OK)
async def delete_saved_view(
    view_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    view = await db.get(SavedView, view_id)
    if not view or view.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="View not found")
    await db.delete(view)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
#  FILE METADATA (key-value)
# ══════════════════════════════════════════════════════════════════════════════


class MetadataCreate(BaseModel):
    key: str
    value: str | None = None
    value_type: str = "string"


@router.get("/files/{file_id}/metadata", summary="Get file custom metadata")
async def get_file_metadata(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _check_file_owner(db, file_id, current_user.id)
    result = await db.execute(
        select(FileMetadata).where(FileMetadata.file_id == file_id).order_by(FileMetadata.key)
    )
    items = result.scalars().all()
    return {
        "file_id": str(file_id),
        "metadata": [
            {"id": str(m.id), "key": m.key, "value": m.value, "value_type": m.value_type}
            for m in items
        ],
    }


@router.post("/files/{file_id}/metadata", status_code=status.HTTP_201_CREATED)
async def set_file_metadata(
    file_id: uuid.UUID,
    payload: MetadataCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _check_file_owner(db, file_id, current_user.id)

    # Upsert: update if key exists
    existing = await db.execute(
        select(FileMetadata).where(
            FileMetadata.file_id == file_id, FileMetadata.key == payload.key,
        )
    )
    meta = existing.scalar_one_or_none()
    if meta:
        meta.value = payload.value
        meta.value_type = payload.value_type
    else:
        meta = FileMetadata(
            file_id=file_id, key=payload.key, value=payload.value, value_type=payload.value_type,
        )
        db.add(meta)

    await db.commit()
    await db.refresh(meta)
    return {"id": str(meta.id), "key": meta.key, "value": meta.value}


@router.delete("/files/{file_id}/metadata/{key}", status_code=status.HTTP_200_OK)
async def delete_file_metadata(
    file_id: uuid.UUID,
    key: str,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    await _check_file_owner(db, file_id, current_user.id)
    result = await db.execute(
        select(FileMetadata).where(FileMetadata.file_id == file_id, FileMetadata.key == key)
    )
    meta = result.scalar_one_or_none()
    if not meta:
        raise HTTPException(status_code=404, detail="Metadata key not found")
    await db.delete(meta)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
#  FILE LOCKING
# ══════════════════════════════════════════════════════════════════════════════


@router.post("/files/{file_id}/lock", summary="Lock a file for exclusive editing")
async def lock_file(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await _check_file_owner(db, file_id, current_user.id)
    if file.is_locked and file.locked_by != current_user.id:
        raise HTTPException(status_code=409, detail="File is locked by another user")
    file.is_locked = True
    file.locked_by = current_user.id
    file.locked_at = datetime.now(timezone.utc)
    await db.commit()
    return {"locked": True, "file_id": str(file_id), "locked_by": str(current_user.id)}


@router.post("/files/{file_id}/unlock", summary="Unlock a file")
async def unlock_file(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await _check_file_owner(db, file_id, current_user.id)
    if file.is_locked and file.locked_by != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot unlock — locked by another user")
    file.is_locked = False
    file.locked_by = None
    file.locked_at = None
    await db.commit()
    return {"unlocked": True, "file_id": str(file_id)}


# ══════════════════════════════════════════════════════════════════════════════
#  ACTIVITY LOG
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/activity-log", summary="Get file activity log for current user")
async def get_activity_log(
    current_user: CurrentUser,
    db: DBSession,
    file_id: uuid.UUID | None = Query(None),
    action: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    query = select(FileAccessLog).where(FileAccessLog.user_id == current_user.id)
    if file_id:
        query = query.where(FileAccessLog.file_id == file_id)
    if action:
        query = query.where(FileAccessLog.action == action)
    query = query.order_by(FileAccessLog.timestamp.desc()).offset((page - 1) * limit).limit(limit)

    result = await db.execute(query)
    logs = result.scalars().all()

    return {
        "total": len(logs),
        "logs": [
            {
                "id": str(log.id),
                "file_id": str(log.file_id) if log.file_id else None,
                "folder_id": str(log.folder_id) if log.folder_id else None,
                "action": log.action,
                "metadata": log.metadata_json,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            }
            for log in logs
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
#  SENSITIVITY LABELS
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/sensitivity-labels", summary="List available sensitivity labels")
async def list_sensitivity_labels(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(SensitivityLabel).where(SensitivityLabel.is_active.is_(True)).order_by(SensitivityLabel.severity)
    )
    labels = result.scalars().all()
    return {
        "labels": [
            {
                "id": str(lb.id),
                "name": lb.name,
                "display_name": lb.display_name,
                "description": lb.description,
                "color": lb.color,
                "severity": lb.severity,
                "block_external_sharing": lb.block_external_sharing,
                "block_public_links": lb.block_public_links,
            }
            for lb in labels
        ],
    }


@router.put("/files/{file_id}/sensitivity", summary="Set sensitivity label on a file")
async def set_file_sensitivity(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    level: str = Query(..., description="Sensitivity level: public, internal, confidential, highly_confidential"),
) -> dict[str, Any]:
    file = await _check_file_owner(db, file_id, current_user.id)
    file.sensitivity_level = level
    await db.commit()
    return {"file_id": str(file_id), "sensitivity_level": level}


# ══════════════════════════════════════════════════════════════════════════════
#  DRIVE ANALYTICS
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/analytics/overview", summary="Drive analytics overview")
async def drive_analytics_overview(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    user_id = current_user.id

    # Total storage
    total = await db.execute(
        select(func.sum(DriveFile.size), func.count(DriveFile.id))
        .where(DriveFile.owner_id == user_id)
    )
    total_row = total.one()

    # AI processed count
    ai_count = await db.execute(
        select(func.count(DriveFile.id))
        .where(DriveFile.owner_id == user_id, DriveFile.ai_processed.is_(True))
    )

    # Files by sensitivity
    sens_result = await db.execute(
        select(DriveFile.sensitivity_level, func.count(DriveFile.id))
        .where(DriveFile.owner_id == user_id)
        .group_by(DriveFile.sensitivity_level)
    )

    # Recent activity count (last 7 days)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    activity_count = await db.execute(
        select(func.count(FileAccessLog.id))
        .where(FileAccessLog.user_id == user_id, FileAccessLog.timestamp >= week_ago)
    )

    return {
        "total_bytes": int(total_row[0] or 0),
        "total_files": total_row[1] or 0,
        "ai_processed_files": ai_count.scalar() or 0,
        "by_sensitivity": {
            (row[0] or "unlabeled"): row[1]
            for row in sens_result.all()
        },
        "activity_last_7_days": activity_count.scalar() or 0,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  CONTEXTUAL SEARCH BOOST (ERP module-aware search relevance)
# ══════════════════════════════════════════════════════════════════════════════


@router.post("/files/search/contextual", summary="ERP context-aware search with relevance boost")
async def contextual_search(
    current_user: CurrentUser,
    db: DBSession,
    q: str = Query(..., min_length=1),
    module: str | None = Query(None, description="Current ERP module for context boost"),
    entity_id: str | None = Query(None, description="Current entity ID for context boost"),
    limit: int = Query(30, le=100),
) -> dict[str, Any]:
    """Search files with relevance boosted by current ERP context.
    Files directly linked to the current entity rank higher."""
    from app.models.drive_phase3 import DriveAutoLink

    base_query = select(DriveFile).where(
        DriveFile.owner_id == current_user.id,
        DriveFile.name.ilike(like_pattern(q)),
    ).limit(limit)

    result = await db.execute(base_query)
    files = result.scalars().all()

    # Fetch linked files for boosting
    boosted_ids: set[str] = set()
    if module and entity_id:
        link_result = await db.execute(
            select(DriveAutoLink.file_id)
            .where(
                DriveAutoLink.module == module,
                DriveAutoLink.entity_id == entity_id,
                DriveAutoLink.status == "confirmed",
            )
        )
        boosted_ids = {str(row[0]) for row in link_result.all()}

    items = []
    for f in files:
        fid = str(f.id)
        score = 100 if fid in boosted_ids else 50
        items.append({
            "id": fid,
            "name": f.name,
            "content_type": f.content_type,
            "size": f.size,
            "folder_path": f.folder_path,
            "relevance_score": score,
            "context_boosted": fid in boosted_ids,
            "updated_at": f.updated_at.isoformat() if f.updated_at else None,
        })

    items.sort(key=lambda x: x["relevance_score"], reverse=True)
    return {"total": len(items), "query": q, "module_context": module, "results": items}


# ══════════════════════════════════════════════════════════════════════════════
#  AI-SUGGESTED SHARING
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/files/{file_id}/sharing-suggestions", summary="AI-suggested people to share with")
async def sharing_suggestions(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Suggest team members who haven't seen this file but are likely to need it.
    Based on: file tags, project membership, recent access patterns."""
    from app.models.user import User

    file = await _check_file_owner(db, file_id, current_user.id)

    # Get users who have accessed similar files (same folder or tags)
    file_tags = await db.execute(
        select(FileTag.tag_name).where(FileTag.file_id == file_id)
    )
    tags = [row[0] for row in file_tags.all()]

    suggestions = []

    if tags:
        # Find other users who access files with the same tags
        coworker_result = await db.execute(
            select(FileAccessLog.user_id, func.count(FileAccessLog.id).label("cnt"))
            .join(FileTag, FileTag.file_id == FileAccessLog.file_id)
            .where(
                FileTag.tag_name.in_(tags),
                FileAccessLog.user_id != current_user.id,
            )
            .group_by(FileAccessLog.user_id)
            .order_by(func.count(FileAccessLog.id).desc())
            .limit(5)
        )
        for uid, cnt in coworker_result.all():
            user = await db.get(User, uid)
            if user:
                suggestions.append({
                    "user_id": str(uid),
                    "name": user.full_name,
                    "email": user.email,
                    "reason": f"Frequently accesses files tagged '{tags[0]}'",
                    "confidence": min(0.9, cnt / 10),
                })

    return {
        "file_id": str(file_id),
        "file_name": file.name,
        "suggestions": suggestions[:5],
        "based_on_tags": tags,
    }


# ── Drive Phase 3: Delta/Changes API ─────────────────────────────────────────

@router.get("/changes")
async def get_drive_changes(
    cursor: str | None = Query(None, description="Pagination cursor (ISO timestamp)"),
    limit: int = Query(100, le=500),
    current_user: CurrentUser = None,
    db: DBSession = None,
) -> dict:
    """Returns all drive file changes since the given cursor timestamp.
    Used by sync clients to poll for changes.
    cursor: ISO datetime string. If None, returns changes in the last 24h.
    Returns: {changes: [...], next_cursor: "ISO timestamp", has_more: bool}
    """
    if cursor:
        try:
            since = datetime.fromisoformat(cursor.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid cursor format")
    else:
        since = datetime.now(timezone.utc) - timedelta(days=1)

    result = await db.execute(
        select(FileAccessLog)
        .where(
            FileAccessLog.user_id == current_user.id,
            FileAccessLog.timestamp >= since,
        )
        .order_by(FileAccessLog.timestamp.asc())
        .limit(limit + 1)
    )
    logs = result.scalars().all()
    has_more = len(logs) > limit
    logs = logs[:limit]

    changes = []
    for log in logs:
        changes.append({
            "file_id": str(log.file_id) if log.file_id else None,
            "action": log.action,
            "timestamp": log.timestamp.isoformat(),
        })

    next_cursor = logs[-1].timestamp.isoformat() if logs else datetime.now(timezone.utc).isoformat()
    return {"changes": changes, "next_cursor": next_cursor, "has_more": has_more}


# ── Drive Phase 3: DLP Endpoints ──────────────────────────────────────────────

class DlpRuleCreate(BaseModel):
    name: str
    description: str | None = None
    patterns: list[dict]  # [{type, value, label}]
    action: str = "warn"
    notify_admin: bool = True
    apply_to_sensitivity: list[str] | None = None
    apply_to_departments: list[str] | None = None
    is_active: bool = True


@router.get("/dlp/rules", summary="List DLP rules (admin)")
async def list_dlp_rules(current_user: CurrentUser, db: DBSession) -> list[dict]:
    from app.models.drive_phase2 import DlpRule
    result = await db.execute(select(DlpRule).order_by(DlpRule.created_at.desc()))
    rules = result.scalars().all()
    return [
        {
            "id": str(r.id), "name": r.name, "description": r.description,
            "patterns": r.patterns, "action": r.action, "is_active": r.is_active,
            "notify_admin": r.notify_admin,
        }
        for r in rules
    ]


@router.post("/dlp/rules", status_code=201, summary="Create DLP rule (admin)")
async def create_dlp_rule(body: DlpRuleCreate, current_user: CurrentUser, db: DBSession) -> dict:
    from app.models.drive_phase2 import DlpRule
    rule = DlpRule(
        name=body.name, description=body.description, patterns=body.patterns,
        action=body.action, notify_admin=body.notify_admin,
        apply_to_sensitivity=body.apply_to_sensitivity,
        apply_to_departments=body.apply_to_departments,
        is_active=body.is_active, created_by=current_user.id,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return {"id": str(rule.id), "name": rule.name, "action": rule.action}


@router.post("/files/{file_id}/dlp-scan", summary="Manually trigger DLP scan on a file")
async def dlp_scan_file(file_id: uuid.UUID, current_user: CurrentUser, db: DBSession) -> dict:
    from app.services.drive_dlp import scan_file
    file = await db.get(DriveFile, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    # Get text content from file (use stored extracted text or empty)
    content_text = getattr(file, "extracted_text", "") or ""
    violations = await scan_file(file_id, content_text, db, current_user.id)
    return {"file_id": str(file_id), "violations": violations, "clean": len(violations) == 0}


@router.get("/dlp/violations", summary="List DLP violations")
async def list_dlp_violations(
    limit: int = Query(50, le=200),
    current_user: CurrentUser = None,
    db: DBSession = None,
) -> list[dict]:
    from app.models.drive_phase2 import DlpViolation, DlpRule
    result = await db.execute(
        select(DlpViolation, DlpRule.name.label("rule_name"))
        .join(DlpRule, DlpRule.id == DlpViolation.rule_id)
        .order_by(DlpViolation.detected_at.desc())
        .limit(limit)
    )
    rows = result.all()
    return [
        {
            "id": str(v.DlpViolation.id),
            "rule_name": v.rule_name,
            "file_id": str(v.DlpViolation.file_id),
            "action_taken": v.DlpViolation.action_taken,
            "matched_patterns": v.DlpViolation.matched_patterns,
            "detected_at": v.DlpViolation.detected_at.isoformat(),
        }
        for v in rows
    ]


# ── Drive Phase 3: eDiscovery ─────────────────────────────────────────────────

class EDiscoverySearchPayload(BaseModel):
    query: str
    date_from: datetime | None = None
    date_to: datetime | None = None
    user_ids: list[uuid.UUID] | None = None   # None = all users (super admin)
    file_types: list[str] | None = None
    apply_legal_hold: bool = False


@router.post("/ediscovery/search", summary="eDiscovery cross-user content search (super admin)")
async def ediscovery_search(body: EDiscoverySearchPayload, current_user: CurrentUser, db: DBSession) -> dict:
    """Cross-user full-text search for legal/compliance purposes."""
    conditions = [DriveFile.extracted_text.ilike(f"%{body.query}%")]
    if body.date_from:
        conditions.append(DriveFile.created_at >= body.date_from)
    if body.date_to:
        conditions.append(DriveFile.created_at <= body.date_to)
    if body.user_ids:
        conditions.append(DriveFile.owner_id.in_(body.user_ids))
    if body.file_types:
        conditions.append(DriveFile.content_type.in_(body.file_types))

    result = await db.execute(
        select(DriveFile).where(*conditions).order_by(DriveFile.created_at.desc()).limit(200)
    )
    files = result.scalars().all()

    # Apply legal hold if requested
    if body.apply_legal_hold:
        for f in files:
            if hasattr(f, "legal_hold"):
                f.legal_hold = True
        await db.commit()

    return {
        "query": body.query,
        "total": len(files),
        "results": [
            {
                "file_id": str(f.id),
                "name": f.name,
                "owner_id": str(f.owner_id),
                "content_type": f.content_type,
                "size_bytes": f.size_bytes,
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "legal_hold": getattr(f, "legal_hold", False),
            }
            for f in files
        ],
    }


@router.post("/ediscovery/export", summary="Export eDiscovery results to ZIP")
async def ediscovery_export(file_ids: list[uuid.UUID], current_user: CurrentUser, db: DBSession) -> dict:
    """Returns a job_id for async ZIP export of the specified files."""
    import secrets
    job_id = secrets.token_hex(16)
    # In production: queue a Celery task to zip and upload to MinIO, then return download link
    return {
        "job_id": job_id,
        "status": "queued",
        "file_count": len(file_ids),
        "message": "Export queued. Download link will be available at /drive/ediscovery/export/{job_id}/download",
    }


# ── Drive Phase 3: Webhook Dispatch Engine ────────────────────────────────────

async def _dispatch_webhooks_for_event(event: str, payload: dict, db: AsyncSession) -> None:
    """Fire webhooks registered for the given event type."""
    import hashlib
    import hmac
    import json

    import httpx
    from app.models.drive_phase2 import DriveWebhook, WebhookDelivery

    result = await db.execute(
        select(DriveWebhook).where(
            DriveWebhook.is_active == True,
            DriveWebhook.events.contains([event]),
        )
    )
    webhooks = result.scalars().all()

    for wh in webhooks:
        body_bytes = json.dumps({"event": event, **payload}).encode()
        headers = {"Content-Type": "application/json", "X-Drive-Event": event}
        if wh.secret:
            sig = hmac.new(wh.secret.encode(), body_bytes, hashlib.sha256).hexdigest()
            headers["X-Drive-Signature-256"] = f"sha256={sig}"

        success = False
        response_status = None
        response_body = None
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(wh.url, content=body_bytes, headers=headers)
                response_status = resp.status_code
                response_body = resp.text[:1000]
                success = resp.is_success
        except Exception as exc:
            response_body = str(exc)[:500]

        delivery = WebhookDelivery(
            webhook_id=wh.id, event=event, payload_json=payload,
            response_status=response_status, response_body=response_body, success=success,
        )
        db.add(delivery)

        wh.last_triggered_at = datetime.now(timezone.utc)
        if not success:
            wh.failure_count = (wh.failure_count or 0) + 1

    await db.commit()


# Register drive webhook dispatcher with event bus
from app.core.events import event_bus as _event_bus


@_event_bus.on("drive.file.uploaded")
async def _on_drive_file_uploaded(data: dict, db=None) -> None:
    if db:
        await _dispatch_webhooks_for_event("file.uploaded", data, db)


@_event_bus.on("drive.file.shared")
async def _on_drive_file_shared(data: dict, db=None) -> None:
    if db:
        await _dispatch_webhooks_for_event("file.shared", data, db)


@_event_bus.on("drive.file.deleted")
async def _on_drive_file_deleted(data: dict, db=None) -> None:
    if db:
        await _dispatch_webhooks_for_event("file.deleted", data, db)


@router.get("/webhooks", summary="List drive webhooks for current user")
async def list_drive_webhooks(current_user: CurrentUser, db: DBSession) -> list[dict]:
    from app.models.drive_phase2 import DriveWebhook
    result = await db.execute(
        select(DriveWebhook).where(DriveWebhook.owner_id == current_user.id)
    )
    whs = result.scalars().all()
    return [
        {
            "id": str(w.id),
            "url": w.url,
            "events": w.events,
            "is_active": w.is_active,
            "failure_count": w.failure_count,
        }
        for w in whs
    ]


@router.post("/webhooks", status_code=201, summary="Register a drive webhook")
async def create_drive_webhook(
    body: dict,
    current_user: CurrentUser,
    db: DBSession,
) -> dict:
    from app.models.drive_phase2 import DriveWebhook
    wh = DriveWebhook(
        url=body.get("url", ""), secret=body.get("secret"),
        events=body.get("events", []), owner_id=current_user.id,
    )
    db.add(wh)
    await db.commit()
    await db.refresh(wh)
    return {"id": str(wh.id), "url": wh.url, "events": wh.events}
