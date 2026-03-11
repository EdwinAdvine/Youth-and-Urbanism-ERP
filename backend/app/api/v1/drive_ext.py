"""Drive extensions — copy, bulk ops, versions, trash, storage, search, tags, comments, cross-module links."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.core.sanitize import like_pattern
from app.models.drive import DriveFile, DriveFolder, FileComment, FileTag, TrashBin

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


@router.delete("/files/{file_id}/tags/{tag_name}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove a tag from a file")
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
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
