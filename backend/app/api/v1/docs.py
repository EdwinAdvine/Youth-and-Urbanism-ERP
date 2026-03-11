"""Docs API — ONLYOFFICE document management endpoints."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.config import settings
from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.drive import DriveFile
from app.models.doc_link import DocLink
from app.models.projects import Project, Task

router = APIRouter()

# Extensions considered "documents" for this feature
_DOC_EXTENSIONS = {"docx", "doc", "odt", "xlsx", "xls", "ods", "pptx", "ppt", "odp", "pdf"}

_EXT_CONTENT_TYPE = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "pdf": "application/pdf",
    "odt": "application/vnd.oasis.opendocument.text",
    "ods": "application/vnd.oasis.opendocument.spreadsheet",
    "odp": "application/vnd.oasis.opendocument.presentation",
}


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class DocCreate(BaseModel):
    filename: str
    doc_type: str = "docx"  # docx | xlsx | pptx


class OnlyOfficeCallback(BaseModel):
    status: int
    url: str | None = None
    key: str | None = None
    users: list[str] | None = None
    actions: list[dict] | None = None
    history: dict | None = None
    changesurl: str | None = None
    forcesavetype: int | None = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _ext(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _callback_url(file_id: str) -> str:
    return f"{settings.APP_URL}/api/v1/docs/callback?file_id={file_id}"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/files", summary="List documents (docx, xlsx, pptx, pdf, …)")
async def list_documents(
    current_user: CurrentUser,
    db: DBSession,
    doc_type: str | None = Query(None, description="Filter by extension: docx | xlsx | pptx"),
) -> dict[str, Any]:
    query = select(DriveFile).where(DriveFile.owner_id == current_user.id)
    result = await db.execute(query.order_by(DriveFile.created_at.desc()))
    all_files = result.scalars().all()

    docs = []
    for f in all_files:
        ext = _ext(f.name)
        if ext not in _DOC_EXTENSIONS:
            continue
        if doc_type and ext != doc_type.lower().lstrip("."):
            continue
        docs.append({
            "id": str(f.id),
            "name": f.name,
            "extension": ext,
            "content_type": f.content_type,
            "size": f.size,
            "minio_key": f.minio_key,
            "created_at": f.created_at,
            "updated_at": f.updated_at,
        })

    return {"total": len(docs), "documents": docs}


@router.post("/create", status_code=status.HTTP_201_CREATED, summary="Create a new empty document")
async def create_document(
    payload: DocCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.integrations import onlyoffice  # noqa: PLC0415
    from app.integrations import minio_client  # noqa: PLC0415

    # Ensure extension is on the filename
    filename = payload.filename
    if not _ext(filename):
        filename = f"{filename}.{payload.doc_type}"

    ext = _ext(filename)
    content_type = _EXT_CONTENT_TYPE.get(ext, "application/octet-stream")

    # Create an empty placeholder file in MinIO so ONLYOFFICE can fetch it
    try:
        record = minio_client.upload_file(
            file_data=b"",
            filename=filename,
            user_id=str(current_user.id),
            folder_path="documents",
            content_type=content_type,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage service unavailable: {exc}",
        ) from exc

    file_id = record["file_id"]
    drive_file = DriveFile(
        id=uuid.UUID(file_id),
        name=filename,
        content_type=content_type,
        size=0,
        minio_key=record["minio_key"],
        folder_path="/documents",
        owner_id=current_user.id,
        is_public=False,
    )
    db.add(drive_file)
    await db.commit()
    await db.refresh(drive_file)

    doc_config = onlyoffice.create_document(filename, str(current_user.id))
    return {
        "file_id": file_id,
        "filename": filename,
        "extension": ext,
        "content_type": content_type,
        "onlyoffice": doc_config,
    }


@router.get("/editor-config/{file_id}", summary="Get ONLYOFFICE editor config with JWT")
async def get_editor_config(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    mode: str = Query("edit", description="edit | view"),
) -> dict[str, Any]:
    from app.integrations import onlyoffice  # noqa: PLC0415
    from app.integrations import minio_client  # noqa: PLC0415

    file = await db.get(DriveFile, file_id)
    if not file or (file.owner_id != current_user.id and not file.is_public):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    try:
        download_url = minio_client.get_download_url(file.minio_key)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage service unavailable: {exc}",
        ) from exc

    display_name = getattr(current_user, "full_name", None) or getattr(current_user, "email", str(current_user.id))
    callback_url = _callback_url(str(file_id))

    config = onlyoffice.get_editor_config(
        file_id=str(file_id),
        filename=file.name,
        user_id=str(current_user.id),
        user_name=display_name,
        download_url=download_url,
        callback_url=callback_url,
        mode=mode if mode in ("edit", "view") else "edit",
    )
    return {
        "file_id": str(file_id),
        "filename": file.name,
        "onlyoffice_url": settings.ONLYOFFICE_PUBLIC_URL,
        "editor_config": config,
    }


@router.post("/callback", summary="ONLYOFFICE save callback")
async def onlyoffice_callback(
    request: Request,
    background_tasks: BackgroundTasks,
    db: DBSession,
    file_id: uuid.UUID = Query(..., description="Drive file ID"),
) -> dict[str, int]:
    """Process ONLYOFFICE Document Server save/status callbacks.

    ONLYOFFICE expects a JSON response ``{"error": 0}`` to acknowledge receipt.
    Any other response causes the server to retry.
    """
    from app.integrations import onlyoffice  # noqa: PLC0415
    from app.integrations import minio_client  # noqa: PLC0415

    try:
        body: dict[str, Any] = await request.json()
    except Exception:
        return {"error": 1}

    result = onlyoffice.validate_callback(body)
    action = result.get("action")

    if action == "save":
        url: str | None = result.get("url")
        if url:
            # Download the new file from ONLYOFFICE and re-upload to MinIO
            background_tasks.add_task(_persist_saved_doc, db, file_id, url)

            # Publish doc.saved event for cross-module sync (e.g. project task activity)
            file = await db.get(DriveFile, file_id)
            await event_bus.publish("doc.saved", {
                "file_id": str(file_id),
                "name": file.name if file else "unknown",
                "url": url,
            })

    # Always acknowledge
    return {"error": 0}


# ── Doc-Link schemas ──────────────────────────────────────────────────────────

class DocLinkCreate(BaseModel):
    file_id: uuid.UUID
    task_id: uuid.UUID
    project_id: uuid.UUID


class DocLinkOut(BaseModel):
    id: uuid.UUID
    file_id: uuid.UUID
    task_id: uuid.UUID
    project_id: uuid.UUID
    linked_by: uuid.UUID
    created_at: Any

    model_config = {"from_attributes": True}


# ── Doc-Link endpoints ───────────────────────────────────────────────────────

@router.post("/link", status_code=status.HTTP_201_CREATED, summary="Link a document to a project task")
async def link_doc_to_task(
    payload: DocLinkCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Validate file exists and user owns it
    file = await db.get(DriveFile, payload.file_id)
    if not file or (file.owner_id != current_user.id and not file.is_public):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Validate project exists
    project = await db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Validate task exists and belongs to the project
    task = await db.get(Task, payload.task_id)
    if not task or task.project_id != payload.project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found in this project")

    # Check for duplicate link
    existing = await db.execute(
        select(DocLink).where(
            DocLink.file_id == payload.file_id,
            DocLink.task_id == payload.task_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Document is already linked to this task",
        )

    link = DocLink(
        file_id=payload.file_id,
        task_id=payload.task_id,
        project_id=payload.project_id,
        linked_by=current_user.id,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)

    # Publish event for activity feed
    await event_bus.publish("doc.linked", {
        "link_id": str(link.id),
        "file_id": str(payload.file_id),
        "file_name": file.name,
        "task_id": str(payload.task_id),
        "task_title": task.title,
        "project_id": str(payload.project_id),
        "project_name": project.name,
        "user_id": str(current_user.id),
    })

    return DocLinkOut.model_validate(link).model_dump()


@router.get("/file/{file_id}/links", summary="List all task links for a document")
async def list_links_for_file(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await db.get(DriveFile, file_id)
    if not file or (file.owner_id != current_user.id and not file.is_public):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    result = await db.execute(
        select(DocLink).where(DocLink.file_id == file_id).order_by(DocLink.created_at.desc())
    )
    links = result.scalars().all()
    return {
        "total": len(links),
        "links": [DocLinkOut.model_validate(l).model_dump() for l in links],
    }


@router.get("/task/{task_id}/docs", summary="List all documents linked to a task")
async def list_docs_for_task(
    task_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    result = await db.execute(
        select(DocLink).where(DocLink.task_id == task_id).order_by(DocLink.created_at.desc())
    )
    links = result.scalars().all()

    # Enrich with file details
    docs = []
    for link in links:
        file = await db.get(DriveFile, link.file_id)
        if file:
            docs.append({
                "link_id": str(link.id),
                "file_id": str(file.id),
                "name": file.name,
                "extension": _ext(file.name),
                "size": file.size,
                "linked_by": str(link.linked_by),
                "created_at": link.created_at,
            })

    return {"total": len(docs), "documents": docs}


@router.delete("/link/{link_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove a doc-task link")
async def delete_doc_link(
    link_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    link = await db.get(DocLink, link_id)
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")

    # Only the user who created the link or the file owner can remove it
    file = await db.get(DriveFile, link.file_id)
    if link.linked_by != current_user.id and (not file or file.owner_id != current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to remove this link")

    await db.delete(link)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Background helpers ────────────────────────────────────────────────────────

async def _persist_saved_doc(db: Any, file_id: uuid.UUID, url: str) -> None:
    """Background task: fetch saved document from ONLYOFFICE and update MinIO + DB."""
    import httpx  # noqa: PLC0415
    from app.integrations import minio_client  # noqa: PLC0415

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            file_data = resp.content

        file = await db.get(DriveFile, file_id)
        if not file:
            return

        # Overwrite the existing MinIO object
        from app.integrations.minio_client import _get_client, BUCKET_NAME  # noqa: PLC0415
        import io  # noqa: PLC0415
        s3 = _get_client()
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=file.minio_key,
            Body=io.BytesIO(file_data),
            ContentType=file.content_type,
            ContentLength=len(file_data),
        )

        # Update size in DB
        file.size = len(file_data)
        await db.commit()
    except Exception as exc:
        import logging  # noqa: PLC0415
        logging.getLogger(__name__).error("_persist_saved_doc failed for %s: %s", file_id, exc)
