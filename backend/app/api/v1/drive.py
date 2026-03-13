"""Drive API — file/folder management + enterprise sharing (SharePoint-level)."""

import logging
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.core.rate_limit import limiter
from app.core.sanitize import like_pattern
from app.models.drive import DriveFile, DriveFolder
from app.models.file_share import FileShare, ShareAuditLog, TeamFolder, TeamFolderMember

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class FolderCreate(BaseModel):
    name: str
    parent_id: uuid.UUID | None = None


class FileOut(BaseModel):
    id: uuid.UUID
    name: str
    content_type: str
    size: int
    minio_key: str
    folder_path: str
    is_public: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class FolderOut(BaseModel):
    id: uuid.UUID
    name: str
    parent_id: uuid.UUID | None
    created_at: Any

    model_config = {"from_attributes": True}


class ShareCreate(BaseModel):
    user_id: str | None = None
    team_id: str | None = None
    permission: str = "view"
    create_link: bool = False
    link_password: str | None = None
    no_download: bool = False
    is_file_drop: bool = False
    expires_at: str | None = None  # ISO datetime
    max_downloads: int | None = None
    notify_on_access: bool = False
    requires_approval: bool = False


class ShareOut(BaseModel):
    id: uuid.UUID
    file_id: uuid.UUID | None
    folder_id: uuid.UUID | None
    shared_with_user_id: uuid.UUID | None
    shared_with_team_id: uuid.UUID | None
    shared_by_user_id: uuid.UUID | None
    permission: str
    share_link: str | None
    no_download: bool
    is_file_drop: bool
    expires_at: Any
    max_downloads: int | None
    download_count: int
    requires_approval: bool
    approved: bool
    notify_on_access: bool
    created_at: Any

    model_config = {"from_attributes": True}


class ShareUpdate(BaseModel):
    permission: str | None = None
    expires_at: str | None = None
    no_download: bool | None = None
    max_downloads: int | None = None
    link_password: str | None = None
    notify_on_access: bool | None = None


class TeamFolderCreate(BaseModel):
    name: str
    description: str | None = None
    department: str | None = None
    is_company_wide: bool = False


class TeamFolderOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    department: str | None
    drive_folder_id: uuid.UUID | None
    owner_id: uuid.UUID
    is_company_wide: bool
    created_at: Any

    model_config = {"from_attributes": True}


class TeamMemberAdd(BaseModel):
    user_id: str
    permission: str = "view"


class TeamMemberOut(BaseModel):
    id: uuid.UUID
    team_folder_id: uuid.UUID
    user_id: uuid.UUID
    permission: str
    created_at: Any

    model_config = {"from_attributes": True}


class ShareAuditOut(BaseModel):
    id: uuid.UUID
    share_id: uuid.UUID | None
    action: str
    actor_id: uuid.UUID | None
    ip_address: str | None
    details: str | None
    timestamp: Any

    model_config = {"from_attributes": True}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _minio_available() -> bool:
    try:
        from app.integrations import minio_client  # noqa: F401
        return True
    except Exception:
        return False


def _hash_password(password: str) -> str:
    from passlib.hash import bcrypt
    return bcrypt.hash(password)


def _verify_password(password: str, hashed: str) -> bool:
    from passlib.hash import bcrypt
    try:
        return bcrypt.verify(password, hashed)
    except Exception:
        # Fallback for legacy SHA256 hashes during migration
        import hashlib
        return hashlib.sha256(password.encode()).hexdigest() == hashed


async def _log_share_action(
    db: AsyncSession, share_id: uuid.UUID | None, action: str,
    actor_id: uuid.UUID | None = None, ip: str | None = None, details: str | None = None,
) -> None:
    log = ShareAuditLog(
        share_id=share_id, action=action, actor_id=actor_id,
        ip_address=ip, details=details,
    )
    db.add(log)


async def _check_file_access(db: AsyncSession, file_id: uuid.UUID, user_id: uuid.UUID) -> DriveFile:
    """Check if user owns a file or has share access."""
    file = await db.get(DriveFile, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.owner_id == user_id:
        return file
    # Check shares
    result = await db.execute(
        select(FileShare).where(
            FileShare.file_id == file_id,
            or_(
                FileShare.shared_with_user_id == user_id,
                FileShare.share_link.isnot(None),
            ),
        )
    )
    if result.scalar_one_or_none():
        return file
    if file.is_public:
        return file
    raise HTTPException(status_code=404, detail="File not found")


# ── File Endpoints ─────────────────────────────────────────────────────────────

@router.get("/files", summary="List drive files for the current user")
async def list_files(
    current_user: CurrentUser,
    db: DBSession,
    folder_id: uuid.UUID | None = Query(None, description="Filter by folder ID"),
    file_type: str | None = Query(None, description="Filter by content-type substring, e.g. 'image'"),
) -> dict[str, Any]:
    query = select(DriveFile).where(DriveFile.owner_id == current_user.id)
    if folder_id is not None:
        query = query.where(DriveFile.folder_id == folder_id)
    if file_type:
        query = query.where(DriveFile.content_type.ilike(like_pattern(file_type)))
    query = query.order_by(DriveFile.created_at.desc())
    result = await db.execute(query)
    files = result.scalars().all()
    return {
        "total": len(files),
        "files": [FileOut.model_validate(f) for f in files],
    }


@router.post("/upload", status_code=status.HTTP_201_CREATED, summary="Upload a file to the drive")
@limiter.limit("20/minute")
async def upload_file(
    request: Request,
    current_user: CurrentUser,
    db: DBSession,
    file: UploadFile = File(...),
    folder_id: str | None = Form(None),
    is_public: bool = Form(False),
) -> dict[str, Any]:
    from app.integrations import minio_client  # noqa: PLC0415

    file_data = await file.read()
    filename = file.filename or "untitled"
    content_type = file.content_type or "application/octet-stream"

    # ── Quota enforcement ─────────────────────────────────────────────────
    try:
        from sqlalchemy import func as sa_func
        total_result = await db.execute(
            select(sa_func.sum(DriveFile.size)).where(DriveFile.owner_id == current_user.id)
        )
        current_usage = total_result.scalar() or 0
        # Default quota: 10GB (10240 MB). TODO: read from SystemSettings for per-user overrides.
        quota_bytes = 10240 * 1024 * 1024  # 10 GB
        if current_usage + len(file_data) > quota_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Storage quota exceeded. Used: {current_usage / (1024*1024):.1f}MB / {quota_bytes / (1024*1024):.0f}MB",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Quota check failed (allowing upload): %s", exc)

    # Resolve folder path
    folder_path = "/"
    resolved_folder_id: uuid.UUID | None = None
    if folder_id:
        try:
            resolved_folder_id = uuid.UUID(folder_id)
            folder_row = await db.get(DriveFolder, resolved_folder_id)
            if folder_row and folder_row.owner_id == current_user.id:
                folder_path = f"/{folder_row.name}"
            else:
                resolved_folder_id = None
        except ValueError:
            pass

    try:
        record = minio_client.upload_file(
            file_data=file_data,
            filename=filename,
            user_id=str(current_user.id),
            folder_path=folder_path.strip("/"),
            content_type=content_type,
        )
    except Exception as exc:
        logger.error("MinIO upload failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage service unavailable: {exc}",
        ) from exc

    drive_file = DriveFile(
        id=uuid.UUID(record["file_id"]),
        name=filename,
        content_type=content_type,
        size=record["size"],
        minio_key=record["minio_key"],
        folder_path=folder_path,
        folder_id=resolved_folder_id,
        owner_id=current_user.id,
        is_public=is_public,
    )
    db.add(drive_file)
    await db.commit()
    await db.refresh(drive_file)

    await event_bus.publish("file.uploaded", {
        "file_id": str(drive_file.id),
        "name": drive_file.name,
        "content_type": drive_file.content_type,
        "size": drive_file.size,
        "owner_id": str(current_user.id),
    })

    # Trigger thumbnail generation for images and PDFs
    if content_type.startswith("image/") or content_type == "application/pdf":
        try:
            from app.tasks.celery_app import generate_thumbnail  # noqa: PLC0415

            generate_thumbnail.delay(
                file_id=str(drive_file.id),
                minio_key=drive_file.minio_key,
                mime_type=content_type,
            )
        except Exception as exc:
            logger.warning("Failed to enqueue thumbnail task for %s: %s", drive_file.id, exc)

    # Trigger AI content extraction + embedding + analysis pipeline
    try:
        from app.tasks.file_processing import extract_file_content  # noqa: PLC0415
        extract_file_content.delay(str(drive_file.id))
    except Exception as exc:
        logger.warning("Failed to enqueue AI processing for %s: %s", drive_file.id, exc)

    # Log activity
    try:
        from app.models.drive import FileAccessLog  # noqa: PLC0415
        log = FileAccessLog(
            user_id=current_user.id,
            file_id=drive_file.id,
            action="upload",
            metadata_json={"filename": filename, "size": record["size"], "content_type": content_type},
        )
        db.add(log)
        await db.commit()
    except Exception:
        pass

    return FileOut.model_validate(drive_file).model_dump()


@router.get("/file/{file_id}", summary="Get file metadata")
async def get_file(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await _check_file_access(db, file_id, current_user.id)
    return FileOut.model_validate(file).model_dump()


@router.get("/file/{file_id}/download", summary="Get a pre-signed download URL")
async def download_file(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.integrations import minio_client  # noqa: PLC0415

    file = await _check_file_access(db, file_id, current_user.id)

    try:
        url = minio_client.get_download_url(file.minio_key)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage service unavailable: {exc}",
        ) from exc

    return {"file_id": str(file_id), "filename": file.name, "download_url": url, "expires_in": 3600}


@router.get("/file/{file_id}/thumbnail", summary="Get thumbnail for a file (redirect to presigned URL)")
async def get_file_thumbnail(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """Return a redirect to the MinIO presigned URL for the file's thumbnail.

    Returns 404 if no thumbnail has been generated yet.
    """
    from app.integrations import minio_client  # noqa: PLC0415

    # Verify access
    await _check_file_access(db, file_id, current_user.id)

    thumbnail_key = f"thumbnails/{file_id}.jpg"

    # Check if thumbnail exists in MinIO
    try:
        client = minio_client._get_client()
        client.head_object(Bucket=minio_client.BUCKET_NAME, Key=thumbnail_key)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thumbnail not available for this file",
        )

    try:
        url = minio_client.get_download_url(thumbnail_key)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage service unavailable: {exc}",
        ) from exc

    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)


@router.delete("/file/{file_id}", status_code=status.HTTP_200_OK, summary="Delete a file")
async def delete_file(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    from app.integrations import minio_client  # noqa: PLC0415

    file = await db.get(DriveFile, file_id)
    if not file or file.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    file_id_str = str(file.id)
    file_name = file.name
    minio_client.delete_file(file.minio_key)
    await db.delete(file)
    await db.commit()

    await event_bus.publish("file.deleted", {
        "file_id": file_id_str,
        "name": file_name,
        "owner_id": str(current_user.id),
    })

    return Response(status_code=status.HTTP_200_OK)


# ── Folder Endpoints ──────────────────────────────────────────────────────────

@router.get("/folders", summary="List folders for the current user")
async def list_folders(
    current_user: CurrentUser,
    db: DBSession,
    parent_id: uuid.UUID | None = Query(None),
) -> dict[str, Any]:
    query = select(DriveFolder).where(DriveFolder.owner_id == current_user.id)
    if parent_id is not None:
        query = query.where(DriveFolder.parent_id == parent_id)
    else:
        query = query.where(DriveFolder.parent_id.is_(None))
    result = await db.execute(query.order_by(DriveFolder.name))
    folders = result.scalars().all()
    return {
        "total": len(folders),
        "folders": [FolderOut.model_validate(f) for f in folders],
    }


@router.post("/folders", status_code=status.HTTP_201_CREATED, summary="Create a folder")
async def create_folder(
    payload: FolderCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    if payload.parent_id:
        parent = await db.get(DriveFolder, payload.parent_id)
        if not parent or parent.owner_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent folder not found")

    folder = DriveFolder(
        name=payload.name,
        parent_id=payload.parent_id,
        owner_id=current_user.id,
    )
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    return FolderOut.model_validate(folder).model_dump()


# ── File & Folder Sharing ─────────────────────────────────────────────────────

@router.post("/file/{file_id}/share", status_code=status.HTTP_201_CREATED, summary="Share a file")
async def share_file(
    file_id: uuid.UUID,
    payload: ShareCreate,
    current_user: CurrentUser,
    db: DBSession,
    request: Request,
) -> dict[str, Any]:
    file = await db.get(DriveFile, file_id)
    if not file or file.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="File not found")

    share = await _create_share(
        db, payload, current_user, file_id=file_id,
    )
    await _log_share_action(
        db, share.id, "created", current_user.id,
        ip=request.client.host if request.client else None,
        details=f"Shared file '{file.name}' with permission '{share.permission}'",
    )
    await db.commit()
    await db.refresh(share)

    await event_bus.publish("file.shared", {
        "file_id": str(file_id),
        "share_id": str(share.id),
        "name": file.name,
        "shared_by": str(current_user.id),
        "shared_with_user_id": payload.user_id,
        "permission": share.permission,
    })

    return ShareOut.model_validate(share).model_dump()


@router.post("/folder/{folder_id}/share", status_code=status.HTTP_201_CREATED, summary="Share a folder")
async def share_folder(
    folder_id: uuid.UUID,
    payload: ShareCreate,
    current_user: CurrentUser,
    db: DBSession,
    request: Request,
) -> dict[str, Any]:
    folder = await db.get(DriveFolder, folder_id)
    if not folder or folder.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Folder not found")

    share = await _create_share(
        db, payload, current_user, folder_id=folder_id,
    )
    await _log_share_action(
        db, share.id, "created", current_user.id,
        ip=request.client.host if request.client else None,
        details=f"Shared folder '{folder.name}' with permission '{share.permission}'",
    )
    await db.commit()
    await db.refresh(share)

    await event_bus.publish("folder.shared", {
        "folder_id": str(folder_id),
        "share_id": str(share.id),
        "name": folder.name,
        "shared_by": str(current_user.id),
        "permission": share.permission,
    })

    return ShareOut.model_validate(share).model_dump()


async def _create_share(
    db: AsyncSession,
    payload: ShareCreate,
    current_user: Any,
    file_id: uuid.UUID | None = None,
    folder_id: uuid.UUID | None = None,
) -> FileShare:
    share_link = None
    if payload.create_link:
        share_link = secrets.token_urlsafe(32)

    hashed_pw = None
    if payload.link_password:
        hashed_pw = _hash_password(payload.link_password)

    expires = None
    if payload.expires_at:
        expires = datetime.fromisoformat(payload.expires_at)

    share = FileShare(
        file_id=file_id,
        folder_id=folder_id,
        shared_with_user_id=uuid.UUID(payload.user_id) if payload.user_id else None,
        shared_with_team_id=uuid.UUID(payload.team_id) if payload.team_id else None,
        shared_by_user_id=current_user.id,
        permission=payload.permission,
        share_link=share_link,
        link_password=hashed_pw,
        no_download=payload.no_download,
        is_file_drop=payload.is_file_drop,
        expires_at=expires,
        max_downloads=payload.max_downloads,
        notify_on_access=payload.notify_on_access,
        requires_approval=payload.requires_approval,
    )
    db.add(share)
    return share


@router.get("/file/{file_id}/shares", summary="List all shares for a file")
async def list_file_shares(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await db.get(DriveFile, file_id)
    if not file or file.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="File not found")

    result = await db.execute(
        select(FileShare).where(FileShare.file_id == file_id).order_by(FileShare.created_at.desc())
    )
    shares = result.scalars().all()
    return {"total": len(shares), "shares": [ShareOut.model_validate(s) for s in shares]}


@router.patch("/share/{share_id}", summary="Update a share's settings")
async def update_share(
    share_id: uuid.UUID,
    payload: ShareUpdate,
    current_user: CurrentUser,
    db: DBSession,
    request: Request,
) -> dict[str, Any]:
    share = await db.get(FileShare, share_id)
    if not share or share.shared_by_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Share not found")

    if payload.permission is not None:
        share.permission = payload.permission
    if payload.expires_at is not None:
        share.expires_at = datetime.fromisoformat(payload.expires_at)
    if payload.no_download is not None:
        share.no_download = payload.no_download
    if payload.max_downloads is not None:
        share.max_downloads = payload.max_downloads
    if payload.link_password is not None:
        share.link_password = _hash_password(payload.link_password) if payload.link_password else None
    if payload.notify_on_access is not None:
        share.notify_on_access = payload.notify_on_access

    await _log_share_action(
        db, share.id, "modified", current_user.id,
        ip=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(share)
    return ShareOut.model_validate(share).model_dump()


@router.delete("/share/{share_id}", status_code=status.HTTP_200_OK, summary="Revoke a share")
async def revoke_share(
    share_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    request: Request,
) -> Response:
    share = await db.get(FileShare, share_id)
    if not share or share.shared_by_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Share not found")

    await _log_share_action(
        db, share.id, "revoked", current_user.id,
        ip=request.client.host if request.client else None,
    )
    await db.delete(share)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


@router.get("/shared-with-me", summary="List files shared with the current user")
async def shared_with_me(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Direct user shares
    query = (
        select(DriveFile)
        .join(FileShare, FileShare.file_id == DriveFile.id)
        .where(FileShare.shared_with_user_id == current_user.id)
        .order_by(DriveFile.created_at.desc())
    )
    result = await db.execute(query)
    files = result.scalars().all()

    # Team folder shares — get user's team memberships, then team shares
    team_query = (
        select(DriveFile)
        .join(FileShare, FileShare.file_id == DriveFile.id)
        .join(TeamFolderMember, TeamFolderMember.team_folder_id == FileShare.shared_with_team_id)
        .where(TeamFolderMember.user_id == current_user.id)
    )
    team_result = await db.execute(team_query)
    team_files = team_result.scalars().all()

    all_files = {f.id: f for f in list(files) + list(team_files)}
    return {
        "total": len(all_files),
        "files": [FileOut.model_validate(f) for f in all_files.values()],
    }


@router.get("/shared-folders", summary="List folders shared with the current user")
async def shared_folders(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    query = (
        select(DriveFolder)
        .join(FileShare, FileShare.folder_id == DriveFolder.id)
        .where(FileShare.shared_with_user_id == current_user.id)
        .order_by(DriveFolder.name)
    )
    result = await db.execute(query)
    folders = result.scalars().all()
    return {"total": len(folders), "folders": [FolderOut.model_validate(f) for f in folders]}


@router.get("/share/{link}", summary="Access a file/folder via share link")
async def access_share_link(
    link: str,
    db: DBSession,
    request: Request,
    password: str | None = Query(None),
) -> dict[str, Any]:
    result = await db.execute(
        select(FileShare).where(FileShare.share_link == link)
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found")

    # Expiry check
    if share.expires_at and share.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Share link expired")

    # Download limit check
    if share.max_downloads and share.download_count >= share.max_downloads:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Download limit reached")

    # Password check
    if share.link_password:
        if not password or not _verify_password(password, share.link_password):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid password")

    # Log access
    await _log_share_action(
        db, share.id, "accessed",
        ip=request.client.host if request.client else None,
    )

    response: dict[str, Any] = {
        "permission": share.permission,
        "no_download": share.no_download,
        "is_file_drop": share.is_file_drop,
    }

    if share.file_id:
        file = await db.get(DriveFile, share.file_id)
        if not file:
            raise HTTPException(status_code=404, detail="File not found")
        response["file"] = FileOut.model_validate(file).model_dump()
        response["type"] = "file"
    elif share.folder_id:
        folder = await db.get(DriveFolder, share.folder_id)
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")
        response["folder"] = FolderOut.model_validate(folder).model_dump()
        response["type"] = "folder"

    await db.commit()
    return response


@router.post("/share/{link}/download", summary="Download via share link (increments counter)")
async def download_via_share_link(
    link: str,
    db: DBSession,
    request: Request,
    password: str | None = Query(None),
) -> dict[str, Any]:
    from app.integrations import minio_client  # noqa: PLC0415

    result = await db.execute(select(FileShare).where(FileShare.share_link == link))
    share = result.scalar_one_or_none()
    if not share or not share.file_id:
        raise HTTPException(status_code=404, detail="Share link not found")

    if share.expires_at and share.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Share link expired")
    if share.max_downloads and share.download_count >= share.max_downloads:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Download limit reached")
    if share.no_download:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Downloads disabled for this share")
    if share.link_password and (not password or not _verify_password(password, share.link_password)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid password")

    file = await db.get(DriveFile, share.file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    share.download_count += 1
    await _log_share_action(
        db, share.id, "downloaded",
        ip=request.client.host if request.client else None,
    )
    await db.commit()

    url = minio_client.get_download_url(file.minio_key)
    return {"download_url": url, "filename": file.name, "download_count": share.download_count}


@router.post("/share/{link}/upload", status_code=status.HTTP_201_CREATED, summary="Upload to a file-drop share link")
async def upload_to_file_drop(
    link: str,
    db: DBSession,
    file: UploadFile = File(...),
    password: str | None = Form(None),
) -> dict[str, Any]:
    from app.integrations import minio_client  # noqa: PLC0415

    result = await db.execute(select(FileShare).where(FileShare.share_link == link))
    share = result.scalar_one_or_none()
    if not share or not share.is_file_drop:
        raise HTTPException(status_code=404, detail="File drop link not found")

    if share.expires_at and share.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Link expired")
    if share.link_password and (not password or not _verify_password(password, share.link_password)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid password")

    # Determine target folder
    target_folder_id = share.folder_id
    if not target_folder_id and share.file_id:
        f = await db.get(DriveFile, share.file_id)
        target_folder_id = f.folder_id if f else None

    # Get folder owner for storage path
    owner_id: str = ""
    folder_path = "/file-drops"
    if target_folder_id:
        folder = await db.get(DriveFolder, target_folder_id)
        if folder:
            owner_id = str(folder.owner_id)
            folder_path = f"/file-drops/{folder.name}"

    file_data = await file.read()
    filename = file.filename or "upload"
    content_type = file.content_type or "application/octet-stream"

    record = minio_client.upload_file(
        file_data=file_data, filename=filename,
        user_id=owner_id or "file-drops", folder_path=folder_path.strip("/"),
        content_type=content_type,
    )

    drive_file = DriveFile(
        id=uuid.UUID(record["file_id"]),
        name=filename, content_type=content_type,
        size=record["size"], minio_key=record["minio_key"],
        folder_path=folder_path,
        folder_id=target_folder_id,
        owner_id=uuid.UUID(owner_id) if owner_id else share.shared_by_user_id,
        is_public=False,
    )
    db.add(drive_file)
    await db.commit()
    await db.refresh(drive_file)

    return {"message": "File uploaded successfully", "file": FileOut.model_validate(drive_file).model_dump()}


# ── Share Audit Log ───────────────────────────────────────────────────────────

@router.get("/share-audit", summary="List sharing audit logs (owner or admin)")
async def list_share_audit(
    current_user: CurrentUser,
    db: DBSession,
    share_id: uuid.UUID | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
) -> dict[str, Any]:
    query = select(ShareAuditLog).order_by(ShareAuditLog.timestamp.desc())
    if share_id:
        query = query.where(ShareAuditLog.share_id == share_id)
    else:
        # Only show logs for shares the user created
        query = query.join(FileShare, FileShare.id == ShareAuditLog.share_id).where(
            FileShare.shared_by_user_id == current_user.id
        )
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    return {"total": len(logs), "logs": [ShareAuditOut.model_validate(l) for l in logs]}


# ── Team Folders ──────────────────────────────────────────────────────────────

@router.get("/team-folders", summary="List team folders the user belongs to")
async def list_team_folders(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # User's own + member of + company-wide
    own_query = select(TeamFolder).where(TeamFolder.owner_id == current_user.id)
    member_query = (
        select(TeamFolder)
        .join(TeamFolderMember, TeamFolderMember.team_folder_id == TeamFolder.id)
        .where(TeamFolderMember.user_id == current_user.id)
    )
    company_query = select(TeamFolder).where(TeamFolder.is_company_wide.is_(True))

    own_result = await db.execute(own_query)
    member_result = await db.execute(member_query)
    company_result = await db.execute(company_query)

    all_folders = {
        f.id: f
        for f in list(own_result.scalars().all())
        + list(member_result.scalars().all())
        + list(company_result.scalars().all())
    }

    return {
        "total": len(all_folders),
        "team_folders": [TeamFolderOut.model_validate(f) for f in all_folders.values()],
    }


@router.post("/team-folders", status_code=status.HTTP_201_CREATED, summary="Create a team folder")
async def create_team_folder(
    payload: TeamFolderCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Create backing drive folder
    drive_folder = DriveFolder(
        name=f"[Team] {payload.name}",
        parent_id=None,
        owner_id=current_user.id,
    )
    db.add(drive_folder)
    await db.flush()

    team_folder = TeamFolder(
        name=payload.name,
        description=payload.description,
        department=payload.department,
        drive_folder_id=drive_folder.id,
        owner_id=current_user.id,
        is_company_wide=payload.is_company_wide,
    )
    db.add(team_folder)
    await db.flush()

    # Add creator as admin member
    member = TeamFolderMember(
        team_folder_id=team_folder.id,
        user_id=current_user.id,
        permission="admin",
    )
    db.add(member)
    await db.commit()
    await db.refresh(team_folder)

    return TeamFolderOut.model_validate(team_folder).model_dump()


@router.get("/team-folders/{team_id}", summary="Get team folder details")
async def get_team_folder(
    team_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    tf = await db.get(TeamFolder, team_id)
    if not tf:
        raise HTTPException(status_code=404, detail="Team folder not found")
    return TeamFolderOut.model_validate(tf).model_dump()


@router.post("/team-folders/{team_id}/members", status_code=status.HTTP_201_CREATED, summary="Add member to team folder")
async def add_team_member(
    team_id: uuid.UUID,
    payload: TeamMemberAdd,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    tf = await db.get(TeamFolder, team_id)
    if not tf or tf.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Team folder not found")

    member = TeamFolderMember(
        team_folder_id=team_id,
        user_id=uuid.UUID(payload.user_id),
        permission=payload.permission,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return TeamMemberOut.model_validate(member).model_dump()


@router.get("/team-folders/{team_id}/members", summary="List team folder members")
async def list_team_members(
    team_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(TeamFolderMember).where(TeamFolderMember.team_folder_id == team_id)
    )
    members = result.scalars().all()
    return {"total": len(members), "members": [TeamMemberOut.model_validate(m) for m in members]}


@router.delete("/team-folders/{team_id}/members/{user_id}", status_code=status.HTTP_200_OK, summary="Remove team folder member")
async def remove_team_member(
    team_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    tf = await db.get(TeamFolder, team_id)
    if not tf or tf.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Team folder not found")

    result = await db.execute(
        select(TeamFolderMember).where(
            TeamFolderMember.team_folder_id == team_id,
            TeamFolderMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    await db.delete(member)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


@router.delete("/team-folders/{team_id}", status_code=status.HTTP_200_OK, summary="Delete a team folder")
async def delete_team_folder(
    team_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    tf = await db.get(TeamFolder, team_id)
    if not tf or tf.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Team folder not found")

    await db.delete(tf)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ── Sharing Policies (Super Admin) ───────────────────────────────────────────

@router.get("/sharing-policies", summary="Get global sharing policies")
async def get_sharing_policies(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Read from settings table or return defaults
    return {
        "allow_external_shares": True,
        "allow_public_links": True,
        "max_link_expiry_days": 90,
        "require_password_for_links": False,
        "allow_file_drop": True,
        "allow_resharing": True,
    }
