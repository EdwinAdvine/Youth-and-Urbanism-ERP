"""Docs API — ONLYOFFICE document management endpoints."""

import asyncio
import io
import json
import logging
import uuid
import zipfile
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request, Response, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.config import settings
from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.drive import DriveFile
from app.models.doc_link import DocLink
from app.models.doc_comment import DocComment, DocVersion
from app.models.projects import Project, Task
from app.models.finance import Invoice
from app.models.notes import Note

_logger = logging.getLogger(__name__)

router = APIRouter()


def _minimal_document_bytes(ext: str) -> bytes:
    """Return minimal valid bytes for a new empty document of the given extension.

    ONLYOFFICE requires a valid (non-empty) Office Open XML file to open.
    Uploading 0 bytes causes a "Download failed" error in the editor.
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        if ext in ("docx", "doc", "odt"):
            z.writestr(
                "[Content_Types].xml",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                '<Default Extension="xml" ContentType="application/xml"/>'
                '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
                "</Types>",
            )
            z.writestr(
                "_rels/.rels",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
                "</Relationships>",
            )
            z.writestr(
                "word/_rels/document.xml.rels",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'
            )
            z.writestr(
                "word/document.xml",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
                "<w:body><w:p><w:r><w:t/></w:r></w:p><w:sectPr/></w:body>"
                "</w:document>",
            )
        elif ext in ("xlsx", "xls", "ods"):
            z.writestr(
                "[Content_Types].xml",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                '<Default Extension="xml" ContentType="application/xml"/>'
                '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                "</Types>",
            )
            z.writestr(
                "_rels/.rels",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
                "</Relationships>",
            )
            z.writestr(
                "xl/_rels/workbook.xml.rels",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
                "</Relationships>",
            )
            z.writestr(
                "xl/workbook.xml",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>'
                "</workbook>",
            )
            z.writestr(
                "xl/worksheets/sheet1.xml",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                "<sheetData/></worksheet>",
            )
        elif ext in ("pptx", "ppt", "odp"):
            z.writestr(
                "[Content_Types].xml",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                '<Default Extension="xml" ContentType="application/xml"/>'
                '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
                '<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
                "</Types>",
            )
            z.writestr(
                "_rels/.rels",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>'
                "</Relationships>",
            )
            z.writestr(
                "ppt/_rels/presentation.xml.rels",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>'
                "</Relationships>",
            )
            z.writestr(
                "ppt/presentation.xml",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                '<p:sldMasterIdLst/><p:sldSz cx="9144000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/>'
                '<p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>'
                "</p:presentation>",
            )
            z.writestr(
                "ppt/slides/_rels/slide1.xml.rels",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>',
            )
            z.writestr(
                "ppt/slides/slide1.xml",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
                '<p:cSld><p:spTree/></p:cSld>'
                "</p:sld>",
            )
        else:
            # Fallback: minimal DOCX
            return _minimal_document_bytes("docx")
    return buf.getvalue()


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


class ConvertRequest(BaseModel):
    output_format: str  # pdf, docx, xlsx, csv, odt, etc.


class AttachToEmailResponse(BaseModel):
    file_id: str
    filename: str
    content_type: str
    download_url: str
    size: int


class LinkToNoteRequest(BaseModel):
    note_id: uuid.UUID


# ── Helpers ────────────────────────────────────────────────────────────────────

def _ext(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _callback_url(file_id: str) -> str:
    # Must use the internal backend URL so ONLYOFFICE (inside Docker) can POST here
    return f"{settings.BACKEND_INTERNAL_URL}/api/v1/docs/callback?file_id={file_id}"


_MOBILE_UA_KEYWORDS = ("mobile", "android", "iphone", "ipad", "ipod", "webos", "opera mini")


def _is_mobile_ua(user_agent: str) -> bool:
    """Check if User-Agent string indicates a mobile browser."""
    ua_lower = user_agent.lower()
    return any(kw in ua_lower for kw in _MOBILE_UA_KEYWORDS)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/files", summary="List documents (docx, xlsx, pptx, pdf, …)")
async def list_documents(
    current_user: CurrentUser,
    db: DBSession,
    doc_type: str | None = Query(None, description="Filter by extension: docx | xlsx | pptx"),
    view: str = Query("all", description="all | mine | shared | recent"),
) -> dict[str, Any]:
    from sqlalchemy import or_  # noqa: PLC0415

    if view == "shared":
        # Documents the current user shared publicly, or public docs from others
        query = select(DriveFile).where(
            or_(
                DriveFile.is_public == True,  # noqa: E712
                DriveFile.owner_id == current_user.id,
            )
        ).where(DriveFile.is_public == True)  # noqa: E712
    else:
        query = select(DriveFile).where(DriveFile.owner_id == current_user.id)

    if view == "recent":
        query = query.order_by(DriveFile.updated_at.desc()).limit(20)
    else:
        query = query.order_by(DriveFile.updated_at.desc())

    result = await db.execute(query)
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
            "folder_path": f.folder_path,
            "is_public": f.is_public,
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

    # Create a minimal valid document skeleton in MinIO so ONLYOFFICE can open it.
    # Uploading 0 bytes causes ONLYOFFICE to show "Download failed" because it
    # cannot parse an empty ZIP/Office Open XML file.
    doc_bytes = _minimal_document_bytes(ext)
    try:
        record = minio_client.upload_file(
            file_data=doc_bytes,
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
        size=len(doc_bytes),
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
    request: Request,
    current_user: CurrentUser,
    db: DBSession,
    mode: str = Query("edit", description="edit | view"),
    theme: str = Query("light", description="light | dark"),
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
    ui_theme = "theme-dark" if theme == "dark" else "theme-light"

    # Auto-detect mobile user-agent and use mobile config
    user_agent = request.headers.get("user-agent", "")
    is_mobile = _is_mobile_ua(user_agent)

    if is_mobile:
        config = onlyoffice.get_editor_config_mobile(
            file_id=str(file_id),
            filename=file.name,
            user_id=str(current_user.id),
            user_name=display_name,
            download_url=download_url,
            callback_url=callback_url,
            mode=mode if mode in ("edit", "view") else "edit",
            ui_theme=ui_theme,
        )
    else:
        config = onlyoffice.get_editor_config(
            file_id=str(file_id),
            filename=file.name,
            user_id=str(current_user.id),
            user_name=display_name,
            download_url=download_url,
            callback_url=callback_url,
            mode=mode if mode in ("edit", "view") else "edit",
            ui_theme=ui_theme,
        )

    # Track editing session for co-editing presence
    if mode == "edit":
        try:
            onlyoffice.track_editing_session(
                file_id=str(file_id),
                user_id=str(current_user.id),
                user_name=display_name,
                action="join",
            )
        except Exception:
            pass  # Non-critical: Redis may be unavailable

    return {
        "file_id": str(file_id),
        "filename": file.name,
        "onlyoffice_url": settings.ONLYOFFICE_PUBLIC_URL,
        "editor_config": config,
        "is_mobile": is_mobile,
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

    try:
        body: dict[str, Any] = await request.json()
    except Exception:
        return {"error": 1}

    result = onlyoffice.validate_callback(body)
    action = result.get("action")

    if action == "save":
        url: str | None = result.get("url")
        if url:
            # Download the new file from ONLYOFFICE and re-upload to MinIO.
            # Pass only file_id + url — background task creates its own DB session.
            background_tasks.add_task(_persist_saved_doc, file_id, url)

            # Publish doc.saved event for cross-module sync (e.g. project task activity)
            file = await db.get(DriveFile, file_id)
            await event_bus.publish("doc.saved", {
                "file_id": str(file_id),
                "name": file.name if file else "unknown",
                "url": url,
            })

    # Track editor leaving on close/save-close (status 2 or 4)
    cb_status = body.get("status", 0)
    cb_users = body.get("users", [])
    if cb_status in (2, 4):
        # All users disconnected — clear sessions for any users in the callback
        try:
            if cb_users:
                for uid in cb_users:
                    onlyoffice.track_editing_session(str(file_id), uid, "", "leave")
        except Exception:
            pass  # Non-critical

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


@router.delete("/link/{link_id}", status_code=status.HTTP_200_OK, summary="Remove a doc-task link")
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
    return Response(status_code=status.HTTP_200_OK)


# ── Doc Comment schemas ─────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    content: str
    anchor: str | None = None
    parent_id: uuid.UUID | None = None


class CommentUpdate(BaseModel):
    content: str | None = None
    resolved: bool | None = None


class CommentOut(BaseModel):
    id: uuid.UUID
    file_id: uuid.UUID
    author_id: uuid.UUID
    content: str
    anchor: str | None
    parent_id: uuid.UUID | None
    resolved: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Doc Comment endpoints ──────────────────────────────────────────────────

@router.get("/file/{file_id}/comments", summary="List comments on a document")
async def list_comments(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await db.get(DriveFile, file_id)
    if not file or (file.owner_id != current_user.id and not file.is_public):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    result = await db.execute(
        select(DocComment)
        .where(DocComment.file_id == file_id, DocComment.parent_id.is_(None))
        .order_by(DocComment.created_at.asc())
    )
    comments = result.scalars().all()

    out = []
    for c in comments:
        comment_data = CommentOut.model_validate(c).model_dump()
        # Fetch replies
        replies_result = await db.execute(
            select(DocComment).where(DocComment.parent_id == c.id).order_by(DocComment.created_at.asc())
        )
        comment_data["replies"] = [CommentOut.model_validate(r).model_dump() for r in replies_result.scalars().all()]
        out.append(comment_data)

    return {"total": len(out), "comments": out}


@router.post("/file/{file_id}/comments", status_code=status.HTTP_201_CREATED, summary="Add a comment to a document")
async def create_comment(
    file_id: uuid.UUID,
    payload: CommentCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await db.get(DriveFile, file_id)
    if not file or (file.owner_id != current_user.id and not file.is_public):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if payload.parent_id:
        parent = await db.get(DocComment, payload.parent_id)
        if not parent or parent.file_id != file_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent comment not found")

    comment = DocComment(
        file_id=file_id,
        author_id=current_user.id,
        content=payload.content,
        anchor=payload.anchor,
        parent_id=payload.parent_id,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    # Notify doc owner if commenter is different
    if file.owner_id != current_user.id:
        await event_bus.publish("doc.commented", {
            "file_id": str(file_id),
            "file_name": file.name,
            "comment_id": str(comment.id),
            "author_id": str(current_user.id),
            "owner_id": str(file.owner_id),
            "content": payload.content[:100],
        })

    return CommentOut.model_validate(comment).model_dump()


@router.put("/comment/{comment_id}", summary="Update a comment")
async def update_comment(
    comment_id: uuid.UUID,
    payload: CommentUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    comment = await db.get(DocComment, comment_id)
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your comment")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(comment, field, value)

    await db.commit()
    await db.refresh(comment)
    return CommentOut.model_validate(comment).model_dump()


@router.delete("/comment/{comment_id}", status_code=status.HTTP_200_OK, summary="Delete a comment")
async def delete_comment(
    comment_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    comment = await db.get(DocComment, comment_id)
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    # Author or doc owner can delete
    file = await db.get(DriveFile, comment.file_id)
    if comment.author_id != current_user.id and (not file or file.owner_id != current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    await db.delete(comment)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ── Doc Version endpoints ──────────────────────────────────────────────────

@router.get("/file/{file_id}/versions", summary="List version history for a document")
async def list_versions(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await db.get(DriveFile, file_id)
    if not file or (file.owner_id != current_user.id and not file.is_public):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    result = await db.execute(
        select(DocVersion)
        .where(DocVersion.file_id == file_id)
        .order_by(DocVersion.version_number.desc())
    )
    versions = result.scalars().all()
    return {
        "total": len(versions),
        "versions": [
            {
                "id": str(v.id),
                "version_number": v.version_number,
                "size": v.size,
                "saved_by": str(v.saved_by) if v.saved_by else None,
                "label": v.label,
                "created_at": v.created_at,
            }
            for v in versions
        ],
    }


@router.get("/version/{version_id}/download", summary="Download a specific version of a document")
async def download_version(
    version_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.integrations import minio_client  # noqa: PLC0415

    version = await db.get(DocVersion, version_id)
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    file = await db.get(DriveFile, version.file_id)
    if not file or (file.owner_id != current_user.id and not file.is_public):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    try:
        download_url = minio_client.get_download_url(version.minio_key)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage unavailable: {exc}",
        ) from exc

    return {
        "version_id": str(version_id),
        "version_number": version.version_number,
        "download_url": download_url,
        "filename": file.name,
    }


@router.post("/file/{file_id}/versions/{version_id}/restore", summary="Restore a document to a previous version")
async def restore_version(
    file_id: uuid.UUID,
    version_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Restore a document to a previous version by copying its content as the current file."""
    from app.integrations.minio_client import _get_client, BUCKET_NAME  # noqa: PLC0415

    file = await db.get(DriveFile, file_id)
    if not file or file.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    version = await db.get(DocVersion, version_id)
    if not version or version.file_id != file_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    try:
        s3 = _get_client()
        # Copy the version's object over the current file's object
        s3.copy_object(
            Bucket=BUCKET_NAME,
            Key=file.minio_key,
            CopySource={"Bucket": BUCKET_NAME, "Key": version.minio_key},
        )
        file.size = version.size
        await db.commit()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage error: {exc}",
        ) from exc

    return {
        "restored": True,
        "file_id": str(file_id),
        "restored_to_version": version.version_number,
    }


# ── Conversion API ───────────────────────────────────────────────────────────


@router.post("/{doc_id}/convert", summary="Convert document to another format via ONLYOFFICE")
async def convert_document(
    doc_id: uuid.UUID,
    payload: ConvertRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Convert a document to a different format using the ONLYOFFICE Conversion API.

    Supported conversions include docx->pdf, xlsx->csv, pptx->pdf, etc.
    Returns the converted file URL or conversion status.
    """
    from app.integrations import onlyoffice  # noqa: PLC0415
    from app.integrations import minio_client  # noqa: PLC0415

    file = await db.get(DriveFile, doc_id)
    if not file or (file.owner_id != current_user.id and not file.is_public):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    valid_formats = {"pdf", "docx", "xlsx", "pptx", "odt", "ods", "odp", "csv", "txt", "html", "png", "jpg"}
    if payload.output_format.lower() not in valid_formats:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"output_format must be one of: {', '.join(sorted(valid_formats))}",
        )

    try:
        download_url = minio_client.get_download_url(file.minio_key)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage unavailable: {exc}",
        ) from exc

    try:
        result = onlyoffice.request_conversion(
            file_id=str(doc_id),
            filename=file.name,
            download_url=download_url,
            output_format=payload.output_format.lower(),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"ONLYOFFICE conversion failed: {exc}",
        ) from exc

    return {
        "file_id": str(doc_id),
        "original_name": file.name,
        "target_format": payload.output_format,
        "conversion": result,
    }


# ── Co-editing Presence ──────────────────────────────────────────────────────


@router.get("/{doc_id}/editors", summary="List users currently editing a document")
async def list_active_editors(
    doc_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Return the list of users currently editing the document.

    Uses Redis-based session tracking updated by ONLYOFFICE callbacks
    and editor-config requests.
    """
    from app.integrations import onlyoffice  # noqa: PLC0415

    file = await db.get(DriveFile, doc_id)
    if not file or (file.owner_id != current_user.id and not file.is_public):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    try:
        editors = onlyoffice.get_active_editors(str(doc_id))
    except Exception:
        editors = []

    return {
        "file_id": str(doc_id),
        "editors": editors,
        "count": len(editors),
    }


# ── Cross-Module: Docs → Finance (invoice document generation) ──────────────


@router.post("/generate-invoice/{invoice_id}", status_code=status.HTTP_201_CREATED,
             summary="Generate a document from an invoice")
async def generate_invoice_document(
    invoice_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Create a formatted DOCX document from a finance invoice.

    Generates an HTML invoice from the invoice data, uploads it to MinIO,
    and creates a DriveFile record so it appears in the user's documents.
    """
    from app.integrations import minio_client  # noqa: PLC0415

    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    # Build invoice HTML content
    items_html = ""
    items_data = invoice.items or []
    for item in items_data:
        desc = item.get("description", "Item")
        qty = item.get("quantity", 1)
        price = item.get("unit_price", item.get("price", 0))
        amount = item.get("amount", float(qty) * float(price))
        items_html += f"<tr><td>{desc}</td><td style='text-align:right'>{qty}</td><td style='text-align:right'>{invoice.currency} {float(price):,.2f}</td><td style='text-align:right'>{invoice.currency} {float(amount):,.2f}</td></tr>"

    if not items_html:
        items_html = "<tr><td colspan='4' style='text-align:center'>No line items</td></tr>"

    html_content = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
body {{ font-family: 'Open Sans', Arial, sans-serif; padding: 40px; color: #333; }}
h1 {{ color: #51459d; margin-bottom: 5px; }}
.invoice-header {{ display: flex; justify-content: space-between; margin-bottom: 30px; }}
.meta {{ color: #666; font-size: 14px; }}
table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
th {{ background: #51459d; color: white; padding: 10px 12px; text-align: left; }}
td {{ padding: 10px 12px; border-bottom: 1px solid #eee; }}
.totals {{ text-align: right; margin-top: 20px; }}
.totals .total {{ font-size: 20px; color: #51459d; font-weight: bold; }}
.footer {{ margin-top: 40px; padding-top: 20px; border-top: 2px solid #51459d; font-size: 12px; color: #999; }}
</style></head><body>
<h1>INVOICE</h1>
<div class="invoice-header">
    <div>
        <p class="meta"><strong>Invoice #:</strong> {invoice.invoice_number}</p>
        <p class="meta"><strong>Date:</strong> {invoice.issue_date}</p>
        <p class="meta"><strong>Due Date:</strong> {invoice.due_date}</p>
        <p class="meta"><strong>Status:</strong> {invoice.status.upper()}</p>
    </div>
    <div>
        <p class="meta"><strong>Bill To:</strong></p>
        <p class="meta">{invoice.customer_name or 'N/A'}</p>
        <p class="meta">{invoice.customer_email or ''}</p>
    </div>
</div>
<table>
    <thead><tr><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>{items_html}</tbody>
</table>
<div class="totals">
    <p>Subtotal: {invoice.currency} {float(invoice.subtotal):,.2f}</p>
    <p>Tax: {invoice.currency} {float(invoice.tax_amount):,.2f}</p>
    <p class="total">Total: {invoice.currency} {float(invoice.total):,.2f}</p>
</div>
{f'<p class="meta"><em>{invoice.notes}</em></p>' if invoice.notes else ''}
<div class="footer">
    <p>Generated by Urban Vibes Dynamics</p>
</div>
</body></html>"""

    filename = f"Invoice_{invoice.invoice_number}.html"
    content_type = "text/html"

    try:
        record = minio_client.upload_file(
            file_data=html_content.encode("utf-8"),
            filename=filename,
            user_id=str(current_user.id),
            folder_path="documents/invoices",
            content_type=content_type,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage unavailable: {exc}",
        ) from exc

    drive_file = DriveFile(
        id=uuid.UUID(record["file_id"]),
        name=filename,
        content_type=content_type,
        size=len(html_content.encode("utf-8")),
        minio_key=record["minio_key"],
        folder_path="/documents/invoices",
        owner_id=current_user.id,
        is_public=False,
    )
    db.add(drive_file)
    await db.commit()
    await db.refresh(drive_file)

    await event_bus.publish("doc.invoice_generated", {
        "file_id": str(drive_file.id),
        "invoice_id": str(invoice_id),
        "invoice_number": invoice.invoice_number,
        "user_id": str(current_user.id),
    })

    return {
        "file_id": str(drive_file.id),
        "filename": filename,
        "invoice_number": invoice.invoice_number,
        "size": drive_file.size,
    }


# ── Cross-Module: Docs → Mail (attachment) ──────────────────────────────────


@router.post("/{doc_id}/attach-to-email", summary="Get document as email attachment blob")
async def attach_to_email(
    doc_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Return document metadata and a pre-signed download URL suitable for
    attaching to an outgoing email.

    The frontend can use the ``download_url`` to fetch the file bytes and
    include them in a mail compose payload.
    """
    from app.integrations import minio_client  # noqa: PLC0415

    file = await db.get(DriveFile, doc_id)
    if not file or (file.owner_id != current_user.id and not file.is_public):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    try:
        download_url = minio_client.get_download_url(file.minio_key)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage unavailable: {exc}",
        ) from exc

    return {
        "file_id": str(doc_id),
        "filename": file.name,
        "content_type": file.content_type,
        "download_url": download_url,
        "size": file.size,
    }


# ── Cross-Module: Docs → Notes (link) ───────────────────────────────────────


@router.post("/{doc_id}/link-to-note", summary="Link a document to a note")
async def link_to_note(
    doc_id: uuid.UUID,
    payload: LinkToNoteRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Add a document reference to a note's ``linked_items`` array.

    Creates a cross-module link so the note shows the document as a
    related item. The link includes ``type``, ``id``, and ``title``.
    """
    file = await db.get(DriveFile, doc_id)
    if not file or (file.owner_id != current_user.id and not file.is_public):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    note = await db.get(Note, payload.note_id)
    if not note or note.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    # Add to linked_items (avoid duplicates)
    linked = note.linked_items or []
    doc_link_entry = {
        "type": "doc",
        "id": str(doc_id),
        "title": file.name,
    }

    # Check for existing link
    already_linked = any(
        item.get("type") == "doc" and item.get("id") == str(doc_id)
        for item in linked
    )
    if already_linked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Document is already linked to this note",
        )

    linked.append(doc_link_entry)
    note.linked_items = linked
    await db.commit()
    await db.refresh(note)

    await event_bus.publish("doc.linked_to_note", {
        "file_id": str(doc_id),
        "file_name": file.name,
        "note_id": str(payload.note_id),
        "note_title": note.title,
        "user_id": str(current_user.id),
    })

    return {
        "file_id": str(doc_id),
        "note_id": str(payload.note_id),
        "linked_items_count": len(linked),
    }


# ── Background helpers ────────────────────────────────────────────────────────

async def _persist_saved_doc(file_id: uuid.UUID, url: str) -> None:
    """Background task: fetch saved document from ONLYOFFICE, update MinIO + DB, and create a version snapshot.

    Creates its own DB session — do NOT pass the request session here because
    FastAPI closes it before the background task runs.
    """
    import httpx  # noqa: PLC0415
    import io  # noqa: PLC0415
    from app.integrations.minio_client import _get_client, _ensure_bucket, BUCKET_NAME  # noqa: PLC0415
    from app.core.database import AsyncSessionLocal  # noqa: PLC0415
    from sqlalchemy import func  # noqa: PLC0415

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            file_data = resp.content

        async with AsyncSessionLocal() as db:
            file = await db.get(DriveFile, file_id)
            if not file:
                return

            s3 = _get_client()
            _ensure_bucket(s3)

            # Create a version snapshot before overwriting
            count_result = await db.execute(
                select(func.count()).select_from(DocVersion).where(DocVersion.file_id == file_id)
            )
            next_version = (count_result.scalar() or 0) + 1
            version_key = f"{file.minio_key}.v{next_version}"

            # Copy current file to version key (if file has content)
            if file.size > 0:
                try:
                    s3.copy_object(
                        Bucket=BUCKET_NAME,
                        Key=version_key,
                        CopySource={"Bucket": BUCKET_NAME, "Key": file.minio_key},
                    )
                except Exception:
                    # If copy fails (e.g., source doesn't exist yet), upload the new data as version instead
                    s3.put_object(
                        Bucket=BUCKET_NAME, Key=version_key,
                        Body=io.BytesIO(file_data), ContentType=file.content_type,
                        ContentLength=len(file_data),
                    )
            else:
                # First save — snapshot the new data as v1
                s3.put_object(
                    Bucket=BUCKET_NAME, Key=version_key,
                    Body=io.BytesIO(file_data), ContentType=file.content_type,
                    ContentLength=len(file_data),
                )

            version = DocVersion(
                file_id=file_id,
                version_number=next_version,
                minio_key=version_key,
                size=file.size if file.size > 0 else len(file_data),
            )
            db.add(version)

            # Overwrite the current file in MinIO
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
        _logger.error("_persist_saved_doc failed for %s: %s", file_id, exc)


# ── WebSocket Presence Manager ───────────────────────────────────────────────


class DocPresenceManager:
    """Manages real-time WebSocket presence for document editing sessions."""

    def __init__(self) -> None:
        # file_id -> {user_id: {"ws": WebSocket, "name": str, "cursor": dict | None}}
        self._connections: dict[str, dict[str, dict[str, Any]]] = {}

    async def connect(
        self, file_id: str, user_id: str, user_name: str, ws: WebSocket
    ) -> None:
        await ws.accept()
        if file_id not in self._connections:
            self._connections[file_id] = {}
        self._connections[file_id][user_id] = {
            "ws": ws,
            "name": user_name,
            "cursor": None,
        }
        await self._broadcast(file_id, {
            "type": "user_joined",
            "user_id": user_id,
            "user_name": user_name,
            "users": self._user_list(file_id),
        })

    def disconnect(self, file_id: str, user_id: str) -> None:
        if file_id in self._connections:
            self._connections[file_id].pop(user_id, None)
            if not self._connections[file_id]:
                del self._connections[file_id]

    async def broadcast_leave(self, file_id: str, user_id: str, user_name: str) -> None:
        await self._broadcast(file_id, {
            "type": "user_left",
            "user_id": user_id,
            "user_name": user_name,
            "users": self._user_list(file_id),
        })

    async def update_cursor(
        self, file_id: str, user_id: str, cursor_data: dict
    ) -> None:
        if file_id in self._connections and user_id in self._connections[file_id]:
            self._connections[file_id][user_id]["cursor"] = cursor_data
        await self._broadcast(
            file_id,
            {
                "type": "cursor_position",
                "user_id": user_id,
                "user_name": self._connections.get(file_id, {}).get(user_id, {}).get("name", ""),
                "cursor": cursor_data,
            },
            exclude_user=user_id,
        )

    def _user_list(self, file_id: str) -> list[dict[str, str]]:
        conns = self._connections.get(file_id, {})
        return [
            {"user_id": uid, "user_name": info["name"]}
            for uid, info in conns.items()
        ]

    async def _broadcast(
        self, file_id: str, message: dict, *, exclude_user: str | None = None
    ) -> None:
        conns = self._connections.get(file_id, {})
        payload = json.dumps(message)
        dead: list[str] = []
        for uid, info in conns.items():
            if uid == exclude_user:
                continue
            try:
                await info["ws"].send_text(payload)
            except Exception:
                dead.append(uid)
        for uid in dead:
            self.disconnect(file_id, uid)


_presence_manager = DocPresenceManager()


@router.websocket("/ws/presence/{file_id}")
async def doc_presence_ws(
    websocket: WebSocket,
    file_id: str,
) -> None:
    """Real-time document presence via WebSocket.

    Query params: ``token`` (JWT) — used for auth.
    Messages from client: ``{"type": "cursor_position", "cursor": {...}}``
    Messages to client: ``user_joined``, ``user_left``, ``cursor_position``
    """
    token = websocket.query_params.get("token", "")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    # Authenticate
    try:
        from app.core.security import decode_token  # noqa: PLC0415
        payload = decode_token(token)
        user_id = payload.get("sub", "")
        user_name = payload.get("name", payload.get("email", "User"))
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await _presence_manager.connect(file_id, user_id, user_name, websocket)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                continue

            if msg.get("type") == "cursor_position":
                await _presence_manager.update_cursor(
                    file_id, user_id, msg.get("cursor", {})
                )
            elif msg.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        _presence_manager.disconnect(file_id, user_id)
        await _presence_manager.broadcast_leave(file_id, user_id, user_name)


# ── WebSocket Document AI Copilot ───────────────────────────────────────────


@router.websocket("/ws/copilot/{file_id}")
async def doc_copilot_ws(
    websocket: WebSocket,
    file_id: str,
) -> None:
    """Document-context AI copilot chat via WebSocket.

    Query params: ``token`` (JWT).
    Client sends: ``{"type": "prompt", "message": "..."}``
    Server sends: ``{"type": "chunk", "content": "..."}`` (streaming),
                  ``{"type": "done", "full_content": "..."}``,
                  ``{"type": "error", "message": "..."}``.
    """
    token = websocket.query_params.get("token", "")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        from app.core.security import decode_token  # noqa: PLC0415
        payload = decode_token(token)
        user_id = payload.get("sub", "")
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await websocket.accept()

    # Load file context
    from app.core.database import AsyncSessionLocal  # noqa: PLC0415
    async with AsyncSessionLocal() as db:
        file = await db.get(DriveFile, uuid.UUID(file_id))
        file_name = file.name if file else "Unknown Document"

    # Conversation history for this session
    messages: list[dict[str, str]] = []

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                continue

            if msg.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue

            if msg.get("type") != "prompt":
                continue

            user_message = msg.get("message", "").strip()
            if not user_message:
                continue

            messages.append({"role": "user", "content": user_message})

            # Call AI with document context
            try:
                async with AsyncSessionLocal() as db:
                    from app.services.doc_ai import DocAIService  # noqa: PLC0415
                    svc = DocAIService(db, uuid.UUID(user_id))

                    # Build context-enriched prompt
                    context_prompt = (
                        f"You are an AI assistant helping with the document '{file_name}'. "
                        f"Provide helpful, concise responses about document content, formatting, "
                        f"and writing assistance.\n\n"
                        f"User: {user_message}"
                    )

                    result = await svc.generate(
                        prompt=context_prompt,
                        doc_name=file_name,
                    )
                    reply = result["content"]
                    messages.append({"role": "assistant", "content": reply})

                    # Send in chunks for streaming feel
                    chunk_size = 50
                    for i in range(0, len(reply), chunk_size):
                        chunk = reply[i:i + chunk_size]
                        await websocket.send_text(json.dumps({
                            "type": "chunk",
                            "content": chunk,
                        }))
                        await asyncio.sleep(0.02)

                    await websocket.send_text(json.dumps({
                        "type": "done",
                        "full_content": reply,
                        "model": result.get("model", "unknown"),
                    }))

            except Exception as exc:
                _logger.error("Copilot error for file %s: %s", file_id, exc)
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": f"AI service error: {exc}",
                }))

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
