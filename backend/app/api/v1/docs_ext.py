"""Docs Extensions API — Versions, Permissions, Comments, Templates, Export, AI, Recent, ERP Generation."""

import uuid
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.drive import DriveFile
from app.models.doc_comment import DocVersion
from app.models.docs import (
    DocumentBookmark, DocumentComment, DocumentTemplate, RecentDocument,
    SpreadsheetDataConnection, DocumentAuditLog, DocumentSecurity,
    DocumentTemplateCategory, DocumentTemplateFavorite,
)

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class VersionOut(BaseModel):
    id: uuid.UUID
    file_id: uuid.UUID
    version_number: int
    size: int
    saved_by: uuid.UUID | None
    label: str | None
    created_at: Any

    model_config = {"from_attributes": True}


class PermissionCreate(BaseModel):
    user_id: uuid.UUID
    permission: str = "view"  # view | edit | comment


class PermissionOut(BaseModel):
    user_id: str
    permission: str


class DocCommentCreate(BaseModel):
    content: str
    position_data: dict | None = None


class DocCommentOut(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    content: str
    author_id: uuid.UUID
    is_resolved: bool
    position_data: dict | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    doc_type: str
    file_path: str
    category: str
    is_system: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class ExportRequest(BaseModel):
    format: str = "pdf"  # pdf | docx | xlsx | pptx | odt | ods | odp


class AIGenerateRequest(BaseModel):
    prompt: str
    doc_type: str = "doc"


class AISummarizeRequest(BaseModel):
    max_length: int = 500


class AITranslateRequest(BaseModel):
    target_language: str


class AIImproveRequest(BaseModel):
    text: str
    tone: str = "professional"


class AIExpandRequest(BaseModel):
    text: str


class AISimplifyRequest(BaseModel):
    text: str


class RecentDocOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    document_id: uuid.UUID
    last_opened: datetime
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _ext(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


async def _get_accessible_file(
    file_id: uuid.UUID, user_id: uuid.UUID, db: Any
) -> DriveFile:
    """Fetch a DriveFile and verify the user has access."""
    file = await db.get(DriveFile, file_id)
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Owner always has access
    if file.owner_id == user_id:
        return file

    # Public files are accessible
    if file.is_public:
        return file

    # Check shared permissions (stored as JSON on DriveFile if available)
    permissions = getattr(file, "shared_with", None) or {}
    if str(user_id) in permissions:
        return file

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


# ── Versions ─────────────────────────────────────────────────────────────────

@router.get("/docs/{doc_id}/versions", summary="List version history for a document")
async def list_versions(
    doc_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await _get_accessible_file(doc_id, current_user.id, db)

    result = await db.execute(
        select(DocVersion)
        .where(DocVersion.file_id == doc_id)
        .order_by(DocVersion.version_number.desc())
    )
    versions = result.scalars().all()
    return {
        "total": len(versions),
        "versions": [
            {
                "id": str(v.id),
                "file_id": str(v.file_id),
                "version_number": v.version_number,
                "size": v.size,
                "saved_by": str(v.saved_by) if v.saved_by else None,
                "label": v.label,
                "created_at": v.created_at,
            }
            for v in versions
        ],
    }


@router.post("/docs/{doc_id}/restore/{version_id}", summary="Restore document to a specific version")
async def restore_version(
    doc_id: uuid.UUID,
    version_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await db.get(DriveFile, doc_id)
    if not file or file.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    version = await db.get(DocVersion, version_id)
    if not version or version.file_id != doc_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    try:
        from app.integrations.minio_client import _get_client, BUCKET_NAME  # noqa: PLC0415

        s3 = _get_client()
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
        "file_id": str(doc_id),
        "restored_to_version": version.version_number,
    }


@router.post(
    "/docs/{doc_id}/versions/{version_id}/compare/{other_version_id}",
    summary="Diff two document versions",
)
async def compare_versions(
    doc_id: uuid.UUID,
    version_id: uuid.UUID,
    other_version_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Return a word-level diff summary between two stored document versions.

    Reads both snapshots from MinIO, decodes as UTF-8 text, and returns
    added/removed line counts plus the first 200 changed lines for display.
    """
    await _get_accessible_file(doc_id, current_user.id, db)

    version_a = await db.get(DocVersion, version_id)
    version_b = await db.get(DocVersion, other_version_id)

    for v, label in [(version_a, "version_id"), (version_b, "other_version_id")]:
        if not v or v.file_id != doc_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Version not found: {label}",
            )

    try:
        from app.integrations.minio_client import _get_client, BUCKET_NAME  # noqa: PLC0415
        import difflib  # noqa: PLC0415

        s3 = _get_client()

        def _fetch(key: str) -> str:
            resp = s3.get_object(Bucket=BUCKET_NAME, Key=key)
            raw = resp["Body"].read()
            try:
                return raw.decode("utf-8")
            except UnicodeDecodeError:
                return raw.decode("latin-1", errors="replace")

        text_a = _fetch(version_a.minio_key)
        text_b = _fetch(version_b.minio_key)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage error: {exc}",
        ) from exc

    lines_a = text_a.splitlines(keepends=True)
    lines_b = text_b.splitlines(keepends=True)

    diff_lines = list(difflib.unified_diff(
        lines_a, lines_b,
        fromfile=f"v{version_a.version_number}",
        tofile=f"v{version_b.version_number}",
        lineterm="",
    ))

    added = sum(1 for l in diff_lines if l.startswith("+") and not l.startswith("+++"))
    removed = sum(1 for l in diff_lines if l.startswith("-") and not l.startswith("---"))

    return {
        "file_id": str(doc_id),
        "version_a": {
            "id": str(version_a.id),
            "version_number": version_a.version_number,
            "label": version_a.label,
        },
        "version_b": {
            "id": str(version_b.id),
            "version_number": version_b.version_number,
            "label": version_b.label,
        },
        "added_lines": added,
        "removed_lines": removed,
        "total_changed_lines": added + removed,
        "diff": diff_lines[:200],
    }


# ── Permissions ──────────────────────────────────────────────────────────────

@router.get("/docs/{doc_id}/permissions", summary="List document permissions")
async def list_permissions(
    doc_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await db.get(DriveFile, doc_id)
    if not file or file.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Permissions are stored as a JSON field on DriveFile (shared_with)
    shared_with = getattr(file, "shared_with", None) or {}
    permissions = [
        {"user_id": uid, "permission": perm}
        for uid, perm in shared_with.items()
    ]
    return {
        "file_id": str(doc_id),
        "owner_id": str(file.owner_id),
        "permissions": permissions,
    }


@router.post(
    "/docs/{doc_id}/permissions",
    status_code=status.HTTP_201_CREATED,
    summary="Grant document permission to a user",
)
async def add_permission(
    doc_id: uuid.UUID,
    payload: PermissionCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await db.get(DriveFile, doc_id)
    if not file or file.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    valid_perms = {"view", "edit", "comment"}
    if payload.permission not in valid_perms:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"permission must be one of: {', '.join(valid_perms)}",
        )

    # Update shared_with JSON
    shared_with = getattr(file, "shared_with", None) or {}
    shared_with[str(payload.user_id)] = payload.permission

    if hasattr(file, "shared_with"):
        file.shared_with = shared_with

    await db.commit()

    return {
        "file_id": str(doc_id),
        "user_id": str(payload.user_id),
        "permission": payload.permission,
    }


@router.delete(
    "/docs/{doc_id}/permissions/{user_id}",
    status_code=status.HTTP_200_OK,
    summary="Revoke document permission from a user",
)
async def remove_permission(
    doc_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    file = await db.get(DriveFile, doc_id)
    if not file or file.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    shared_with = getattr(file, "shared_with", None) or {}
    if str(user_id) in shared_with:
        del shared_with[str(user_id)]
        if hasattr(file, "shared_with"):
            file.shared_with = shared_with
        await db.commit()

    return Response(status_code=status.HTTP_200_OK)


# ── Comments (DocumentComment — inline annotations) ─────────────────────────

@router.get("/docs/{doc_id}/comments", summary="List inline comments on a document")
async def list_doc_comments(
    doc_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_accessible_file(doc_id, current_user.id, db)

    result = await db.execute(
        select(DocumentComment)
        .where(DocumentComment.document_id == doc_id)
        .order_by(DocumentComment.created_at.asc())
    )
    comments = result.scalars().all()
    return {
        "total": len(comments),
        "comments": [DocCommentOut.model_validate(c).model_dump() for c in comments],
    }


@router.post(
    "/docs/{doc_id}/comments",
    status_code=status.HTTP_201_CREATED,
    summary="Add an inline comment to a document",
)
async def create_doc_comment(
    doc_id: uuid.UUID,
    payload: DocCommentCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await _get_accessible_file(doc_id, current_user.id, db)

    comment = DocumentComment(
        document_id=doc_id,
        content=payload.content,
        author_id=current_user.id,
        position_data=payload.position_data,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    if file.owner_id != current_user.id:
        await event_bus.publish("doc.commented", {
            "file_id": str(doc_id),
            "file_name": file.name,
            "comment_id": str(comment.id),
            "author_id": str(current_user.id),
            "owner_id": str(file.owner_id),
            "content": payload.content[:100],
        })

    return DocCommentOut.model_validate(comment).model_dump()


@router.put("/docs/comments/{comment_id}/resolve", summary="Resolve/unresolve a document comment")
async def resolve_comment(
    comment_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    comment = await db.get(DocumentComment, comment_id)
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    # Author or document owner can resolve
    file = await db.get(DriveFile, comment.document_id)
    if comment.author_id != current_user.id and (not file or file.owner_id != current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    comment.is_resolved = not comment.is_resolved
    await db.commit()
    await db.refresh(comment)
    return DocCommentOut.model_validate(comment).model_dump()


# ── Templates ────────────────────────────────────────────────────────────────

@router.get("/templates", summary="List document templates")
async def list_templates(
    current_user: CurrentUser,
    db: DBSession,
    category: str | None = Query(None, description="Filter by category"),
    doc_type: str | None = Query(None, description="Filter by doc type"),
) -> dict[str, Any]:
    query = select(DocumentTemplate)
    if category:
        query = query.where(DocumentTemplate.category == category)
    if doc_type:
        query = query.where(DocumentTemplate.doc_type == doc_type)

    query = query.order_by(DocumentTemplate.name.asc())
    result = await db.execute(query)
    templates = result.scalars().all()
    return {
        "total": len(templates),
        "templates": [TemplateOut.model_validate(t).model_dump() for t in templates],
    }


@router.post(
    "/from-template/{template_id}",
    status_code=status.HTTP_201_CREATED,
    summary="Create a document from a template",
)
async def create_from_template(
    template_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    filename: str = Query(..., description="Name for the new document"),
) -> dict[str, Any]:
    template = await db.get(DocumentTemplate, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    try:
        from app.integrations import minio_client  # noqa: PLC0415

        # Copy template file to user's documents folder
        ext_map = {"doc": "docx", "xlsx": "xlsx", "pptx": "pptx"}
        ext = ext_map.get(template.doc_type, template.doc_type)
        final_name = filename if "." in filename else f"{filename}.{ext}"

        content_type_map = {
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        }
        content_type = content_type_map.get(ext, "application/octet-stream")

        # Copy actual template content (not empty bytes)
        try:
            template_bytes = minio_client.get_download_url(template.file_path)
            import httpx  # noqa: PLC0415
            resp = httpx.get(template_bytes, timeout=30)
            file_data = resp.content if resp.status_code == 200 else b""
        except Exception:
            file_data = b""

        record = minio_client.upload_file(
            file_data=file_data,
            filename=final_name,
            user_id=str(current_user.id),
            folder_path="documents",
            content_type=content_type,
        )

        drive_file = DriveFile(
            id=uuid.UUID(record["file_id"]),
            name=final_name,
            content_type=content_type,
            size=record["size"],
            minio_key=record["minio_key"],
            folder_path="/documents",
            owner_id=current_user.id,
            is_public=False,
        )
        db.add(drive_file)
        await db.commit()
        await db.refresh(drive_file)

        return {
            "file_id": str(drive_file.id),
            "filename": final_name,
            "template_name": template.name,
            "doc_type": template.doc_type,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to create from template: {exc}",
        ) from exc


# ── Export ───────────────────────────────────────────────────────────────────

@router.post("/docs/{doc_id}/export", summary="Export a document to a different format")
async def export_document(
    doc_id: uuid.UUID,
    payload: ExportRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await _get_accessible_file(doc_id, current_user.id, db)

    valid_formats = {"pdf", "docx", "xlsx", "pptx", "odt", "ods", "odp"}
    if payload.format not in valid_formats:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"format must be one of: {', '.join(valid_formats)}",
        )

    try:
        from app.integrations import minio_client  # noqa: PLC0415

        download_url = minio_client.get_download_url(file.minio_key)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage unavailable: {exc}",
        ) from exc

    # For ONLYOFFICE conversion, generate a conversion request
    try:
        from app.integrations import onlyoffice  # noqa: PLC0415

        result = onlyoffice.request_conversion(
            file_id=str(doc_id),
            filename=file.name,
            download_url=download_url,
            output_format=payload.format,
        )
        return {
            "file_id": str(doc_id),
            "original_name": file.name,
            "target_format": payload.format,
            "conversion": result,
        }
    except Exception:
        # Fallback: return download URL for the original format
        return {
            "file_id": str(doc_id),
            "original_name": file.name,
            "target_format": payload.format,
            "download_url": download_url,
            "note": "Direct conversion unavailable; returning original file",
        }


# ── AI ───────────────────────────────────────────────────────────────────────


def _get_doc_ai(db: Any, user_id: uuid.UUID):
    """Lazily import and instantiate DocAIService."""
    from app.services.doc_ai import DocAIService  # noqa: PLC0415
    return DocAIService(db, user_id)


async def _read_file_text(file: DriveFile) -> str:
    """Best-effort read of file content as text for AI processing."""
    try:
        from app.integrations import minio_client  # noqa: PLC0415
        file_bytes = minio_client.download_file(file.minio_key)
        return file_bytes.decode("utf-8", errors="replace")
    except Exception:
        return ""


@router.post("/docs/{doc_id}/ai-generate", summary="AI-generate content for a document")
async def ai_generate(
    doc_id: uuid.UUID,
    payload: AIGenerateRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await _get_accessible_file(doc_id, current_user.id, db)

    try:
        svc = _get_doc_ai(db, current_user.id)
        result = await svc.generate(
            prompt=payload.prompt,
            doc_name=file.name,
            doc_type=payload.doc_type,
        )
        return {
            "file_id": str(doc_id),
            "generated_content": result["content"],
            "model": result.get("model", "unknown"),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI service unavailable: {exc}",
        ) from exc


@router.post("/docs/{doc_id}/ai-summarize", summary="AI-summarize a document")
async def ai_summarize(
    doc_id: uuid.UUID,
    payload: AISummarizeRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await _get_accessible_file(doc_id, current_user.id, db)
    text = await _read_file_text(file)

    if not text.strip():
        text = f"Document: {file.name}"

    try:
        svc = _get_doc_ai(db, current_user.id)
        result = await svc.summarize(
            text=text,
            doc_name=file.name,
            max_length=payload.max_length,
        )
        return {
            "file_id": str(doc_id),
            "filename": file.name,
            "summary": result["content"],
            "model": result.get("model", "unknown"),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI service unavailable: {exc}",
        ) from exc


@router.post("/docs/{doc_id}/ai-translate", summary="AI-translate a document to a target language")
async def ai_translate(
    doc_id: uuid.UUID,
    payload: AITranslateRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await _get_accessible_file(doc_id, current_user.id, db)
    text = await _read_file_text(file)

    if not text.strip():
        # Fallback: check linked note
        from app.models.notes import Note  # noqa: PLC0415
        result = await db.execute(
            select(Note).where(Note.title.ilike(f"%{file.name}%")).limit(1)
        )
        note = result.scalar_one_or_none()
        if note and note.content:
            text = note.content

    if not text.strip():
        text = f"Document: {file.name}"

    try:
        svc = _get_doc_ai(db, current_user.id)
        result = await svc.translate(
            text=text,
            target_language=payload.target_language,
            doc_name=file.name,
        )
        return {
            "file_id": str(doc_id),
            "filename": file.name,
            "target_language": payload.target_language,
            "translated_content": result["content"],
            "model": result.get("model", "unknown"),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI service unavailable: {exc}",
        ) from exc


@router.post("/docs/{doc_id}/ai-improve", summary="AI-improve document text (grammar, clarity, tone)")
async def ai_improve(
    doc_id: uuid.UUID,
    payload: AIImproveRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await _get_accessible_file(doc_id, current_user.id, db)

    try:
        svc = _get_doc_ai(db, current_user.id)
        result = await svc.improve(
            text=payload.text,
            doc_name=file.name,
            tone=payload.tone,
        )
        return {
            "file_id": str(doc_id),
            "improved_content": result["content"],
            "model": result.get("model", "unknown"),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI service unavailable: {exc}",
        ) from exc


@router.post("/docs/{doc_id}/ai-expand", summary="AI-expand text with more detail")
async def ai_expand(
    doc_id: uuid.UUID,
    payload: AIExpandRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await _get_accessible_file(doc_id, current_user.id, db)

    try:
        svc = _get_doc_ai(db, current_user.id)
        result = await svc.expand(
            text=payload.text,
            doc_name=file.name,
        )
        return {
            "file_id": str(doc_id),
            "expanded_content": result["content"],
            "model": result.get("model", "unknown"),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI service unavailable: {exc}",
        ) from exc


@router.post("/docs/{doc_id}/ai-simplify", summary="AI-simplify text for easier reading")
async def ai_simplify(
    doc_id: uuid.UUID,
    payload: AISimplifyRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await _get_accessible_file(doc_id, current_user.id, db)

    try:
        svc = _get_doc_ai(db, current_user.id)
        result = await svc.simplify(
            text=payload.text,
            doc_name=file.name,
        )
        return {
            "file_id": str(doc_id),
            "simplified_content": result["content"],
            "model": result.get("model", "unknown"),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI service unavailable: {exc}",
        ) from exc


# ── Recent Documents ─────────────────────────────────────────────────────────

@router.get("/recent", summary="List recently opened documents")
async def list_recent(
    current_user: CurrentUser,
    db: DBSession,
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    result = await db.execute(
        select(RecentDocument)
        .where(RecentDocument.user_id == current_user.id)
        .order_by(RecentDocument.last_opened.desc())
        .limit(limit)
    )
    recents = result.scalars().all()

    # Enrich with file details
    docs = []
    for r in recents:
        file = await db.get(DriveFile, r.document_id)
        if file:
            docs.append({
                "recent_id": str(r.id),
                "document_id": str(r.document_id),
                "name": file.name,
                "extension": _ext(file.name),
                "size": file.size,
                "last_opened": r.last_opened.isoformat(),
            })

    return {"total": len(docs), "recent_documents": docs}


# ── Bookmarks ────────────────────────────────────────────────────────────────

@router.get("/bookmarks", summary="List bookmarked documents")
async def list_bookmarks(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(DocumentBookmark)
        .where(DocumentBookmark.user_id == current_user.id)
        .order_by(DocumentBookmark.created_at.desc())
    )
    bookmarks = result.scalars().all()

    docs = []
    for bm in bookmarks:
        file = await db.get(DriveFile, bm.file_id)
        if file:
            docs.append({
                "bookmark_id": str(bm.id),
                "file_id": str(bm.file_id),
                "name": file.name,
                "extension": _ext(file.name),
                "size": file.size,
                "content_type": file.content_type,
                "bookmarked_at": bm.created_at.isoformat() if bm.created_at else None,
            })

    return {"total": len(docs), "bookmarks": docs}


@router.post(
    "/docs/{doc_id}/bookmark",
    summary="Toggle bookmark on a document (add if absent, remove if present)",
)
async def toggle_bookmark(
    doc_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_accessible_file(doc_id, current_user.id, db)

    result = await db.execute(
        select(DocumentBookmark).where(
            DocumentBookmark.user_id == current_user.id,
            DocumentBookmark.file_id == doc_id,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        await db.delete(existing)
        await db.commit()
        return {"file_id": str(doc_id), "bookmarked": False}

    bookmark = DocumentBookmark(user_id=current_user.id, file_id=doc_id)
    db.add(bookmark)
    await db.commit()
    return {"file_id": str(doc_id), "bookmarked": True}


# ── ERP Document Generation ──────────────────────────────────────────────────


class ERPGenerateRequest(BaseModel):
    template_type: str = Field(
        ...,
        description="One of: invoice, payslip, purchase_order, project_report, financial_report, crm_pipeline",
    )
    params: dict[str, Any] = Field(
        default_factory=dict,
        description="Template-specific parameters (invoice_id, employee_id, etc.)",
    )


@router.get("/erp-templates", summary="List available ERP document templates")
async def list_erp_templates(
    current_user: CurrentUser,
) -> dict[str, Any]:
    from app.services.doc_templates import ERPTemplateEngine  # noqa: PLC0415

    return {"templates": ERPTemplateEngine.available_templates()}


@router.post(
    "/generate-from-erp",
    status_code=status.HTTP_201_CREATED,
    summary="Generate a document from ERP data",
)
async def generate_from_erp(
    payload: ERPGenerateRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.services.doc_templates import ERPTemplateEngine  # noqa: PLC0415

    engine = ERPTemplateEngine(db)
    params = payload.params
    ttype = payload.template_type

    try:
        if ttype == "invoice":
            invoice_id = uuid.UUID(params["invoice_id"])
            file_bytes, filename = await engine.generate_invoice_docx(invoice_id)
            content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        elif ttype == "payslip":
            employee_id = uuid.UUID(params["employee_id"])
            period_start = date.fromisoformat(params["period_start"])
            period_end = date.fromisoformat(params["period_end"])
            file_bytes, filename = await engine.generate_payslip_docx(employee_id, period_start, period_end)
            content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        elif ttype == "purchase_order":
            req_id = uuid.UUID(params["requisition_id"])
            file_bytes, filename = await engine.generate_purchase_order_docx(req_id)
            content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        elif ttype == "project_report":
            project_id = uuid.UUID(params["project_id"])
            file_bytes, filename = await engine.generate_project_report_docx(project_id)
            content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        elif ttype == "financial_report":
            report_type = params.get("report_type", "overview")
            start = date.fromisoformat(params["start_date"])
            end = date.fromisoformat(params["end_date"])
            file_bytes, filename = await engine.generate_financial_report_xlsx(report_type, start, end)
            content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

        elif ttype == "crm_pipeline":
            pipeline_id = uuid.UUID(params["pipeline_id"]) if params.get("pipeline_id") else None
            file_bytes, filename = await engine.generate_crm_pipeline_xlsx(pipeline_id)
            content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unknown template type: {ttype}. Use GET /erp-templates to see available types.",
            )

    except (KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid parameters: {exc}",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Document generation failed: {exc}",
        ) from exc

    # Upload to MinIO and create DriveFile
    try:
        from app.integrations import minio_client  # noqa: PLC0415

        record = minio_client.upload_file(
            file_data=file_bytes,
            filename=filename,
            user_id=str(current_user.id),
            folder_path="documents/erp-generated",
            content_type=content_type,
        )

        drive_file = DriveFile(
            id=uuid.UUID(record["file_id"]),
            name=filename,
            content_type=content_type,
            size=record["size"],
            minio_key=record["minio_key"],
            folder_path="/documents/erp-generated",
            owner_id=current_user.id,
            is_public=False,
        )
        db.add(drive_file)
        await db.commit()
        await db.refresh(drive_file)

        await event_bus.publish("doc.generated", {
            "file_id": str(drive_file.id),
            "filename": filename,
            "template_type": ttype,
            "user_id": str(current_user.id),
        })

        return {
            "file_id": str(drive_file.id),
            "filename": filename,
            "template_type": ttype,
            "size": record["size"],
            "content_type": content_type,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage error: {exc}",
        ) from exc


# ── Spreadsheet ERP Data Connections ─────────────────────────────────────────


class DataConnectionCreate(BaseModel):
    source_module: str
    query_type: str
    query_params: dict[str, Any] = Field(default_factory=dict)
    target_range: str
    refresh_interval_minutes: int = 0


class DataConnectionOut(BaseModel):
    id: uuid.UUID
    file_id: uuid.UUID
    source_module: str
    query_type: str
    query_params: dict | None
    target_range: str
    refresh_interval_minutes: int
    last_refreshed: Any
    cached_data: dict | None
    created_at: Any

    model_config = {"from_attributes": True}


@router.post(
    "/spreadsheet/{file_id}/data-connection",
    status_code=status.HTTP_201_CREATED,
    summary="Create an ERP data connection for a spreadsheet",
)
async def create_data_connection(
    file_id: uuid.UUID,
    payload: DataConnectionCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_accessible_file(file_id, current_user.id, db)

    conn = SpreadsheetDataConnection(
        file_id=file_id,
        owner_id=current_user.id,
        source_module=payload.source_module,
        query_type=payload.query_type,
        query_params=payload.query_params,
        target_range=payload.target_range,
        refresh_interval_minutes=payload.refresh_interval_minutes,
    )
    db.add(conn)
    await db.commit()
    await db.refresh(conn)
    return DataConnectionOut.model_validate(conn).model_dump()


@router.get(
    "/spreadsheet/{file_id}/data-connections",
    summary="List ERP data connections for a spreadsheet",
)
async def list_data_connections(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_accessible_file(file_id, current_user.id, db)
    result = await db.execute(
        select(SpreadsheetDataConnection)
        .where(SpreadsheetDataConnection.file_id == file_id)
        .order_by(SpreadsheetDataConnection.created_at.asc())
    )
    conns = result.scalars().all()
    return {
        "total": len(conns),
        "connections": [DataConnectionOut.model_validate(c).model_dump() for c in conns],
    }


class EvaluateFormulaRequest(BaseModel):
    formulas: list[dict[str, Any]]  # [{formula, params, cell}]


@router.post(
    "/spreadsheet/{file_id}/evaluate",
    summary="Evaluate ERP.* formulas for a spreadsheet",
)
async def evaluate_formulas(
    file_id: uuid.UUID,
    payload: EvaluateFormulaRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_accessible_file(file_id, current_user.id, db)

    from app.services.erp_formula_engine import ERPFormulaEngine  # noqa: PLC0415

    engine = ERPFormulaEngine(db)
    results = await engine.evaluate_batch(payload.formulas)
    return {"file_id": str(file_id), "results": results}


@router.post(
    "/spreadsheet/{file_id}/refresh-data",
    summary="Refresh all ERP data connections for a spreadsheet",
)
async def refresh_spreadsheet_data(
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_accessible_file(file_id, current_user.id, db)

    result = await db.execute(
        select(SpreadsheetDataConnection).where(SpreadsheetDataConnection.file_id == file_id)
    )
    conns = result.scalars().all()

    from app.services.erp_formula_engine import ERPFormulaEngine  # noqa: PLC0415

    engine = ERPFormulaEngine(db)
    refreshed = 0
    for conn in conns:
        try:
            await engine.refresh_data_connection(conn.id)
            refreshed += 1
        except Exception:
            pass

    return {"file_id": str(file_id), "refreshed": refreshed, "total": len(conns)}


# ── Charts & AI Visualization ─────────────────────────────────────────────────


@router.get("/charts/presets", summary="List available ERP chart presets")
async def list_available_charts(current_user: CurrentUser) -> dict[str, Any]:
    from app.services.chart_engine import ChartEngine  # noqa: PLC0415

    return {"charts": ChartEngine.available_charts()}


class ChartGenerateRequest(BaseModel):
    chart_type: str
    params: dict[str, Any] = Field(default_factory=dict)


@router.post("/charts/generate", summary="Generate chart data from ERP sources")
async def generate_chart(
    payload: ChartGenerateRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.services.chart_engine import ChartEngine  # noqa: PLC0415

    try:
        engine = ChartEngine(db)
        data = await engine.generate(payload.chart_type, payload.params)
        return {"chart_type": payload.chart_type, "data": data}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Chart generation failed: {exc}",
        ) from exc


# ── Agentic Document Copilot ──────────────────────────────────────────────────


class AgentDocRequest(BaseModel):
    action: str  # create_board_deck | create_monthly_report | create_proposal
    params: dict[str, Any] = Field(default_factory=dict)


@router.get("/agent/actions", summary="List available agentic doc actions")
async def list_agent_actions(current_user: CurrentUser) -> dict[str, Any]:
    from app.services.doc_agent import DocAgentService  # noqa: PLC0415

    return {"actions": DocAgentService.available_actions()}


@router.post(
    "/agent/run",
    status_code=status.HTTP_201_CREATED,
    summary="Agentic document generation — create board deck, monthly report, or proposal",
)
async def agent_generate_doc(
    payload: AgentDocRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.services.doc_agent import DocAgentService  # noqa: PLC0415

    svc = DocAgentService(db, current_user.id)
    params = payload.params

    try:
        if payload.action == "create_board_deck":
            start = date.fromisoformat(params.get("start_date", "2024-01-01"))
            end = date.fromisoformat(params.get("end_date", datetime.utcnow().strftime("%Y-%m-%d")))
            file_bytes, filename = await svc.create_board_deck(start, end)
        elif payload.action == "create_monthly_report":
            year = int(params.get("year", datetime.utcnow().year))
            month = int(params.get("month", datetime.utcnow().month))
            department = params.get("department")
            file_bytes, filename = await svc.create_monthly_report(year, month, department)
        elif payload.action == "create_proposal":
            deal_id = uuid.UUID(params["deal_id"])
            file_bytes, filename = await svc.create_proposal(deal_id)
        elif payload.action == "create_contract":
            template_type = params.get("template_type", "nda")
            deal_id_raw = params.get("deal_id")
            deal_id_parsed = uuid.UUID(deal_id_raw) if deal_id_raw else None
            eff_date_raw = params.get("effective_date")
            eff_date_parsed = date.fromisoformat(eff_date_raw) if eff_date_raw else None
            file_bytes, filename = await svc.create_contract(
                template_type=template_type,
                deal_id=deal_id_parsed,
                party_name=params.get("party_name"),
                party_company=params.get("party_company"),
                effective_date=eff_date_parsed,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unknown action: {payload.action}",
            )
    except (KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid parameters: {exc}",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Agent generation failed: {exc}",
        ) from exc

    try:
        from app.integrations import minio_client  # noqa: PLC0415

        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "docx"
        content_type_map = {
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
        content_type = content_type_map.get(ext, "application/octet-stream")

        record = minio_client.upload_file(
            file_data=file_bytes,
            filename=filename,
            user_id=str(current_user.id),
            folder_path="documents/agent-generated",
            content_type=content_type,
        )
        drive_file = DriveFile(
            id=uuid.UUID(record["file_id"]),
            name=filename,
            content_type=content_type,
            size=record["size"],
            minio_key=record["minio_key"],
            folder_path="/documents/agent-generated",
            owner_id=current_user.id,
            is_public=False,
        )
        db.add(drive_file)
        await db.commit()
        await db.refresh(drive_file)

        await event_bus.publish("doc.agent_generated", {
            "file_id": str(drive_file.id),
            "filename": filename,
            "action": payload.action,
            "user_id": str(current_user.id),
        })

        return {
            "file_id": str(drive_file.id),
            "filename": filename,
            "action": payload.action,
            "size": record["size"],
            "content_type": content_type,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage error after agent generation: {exc}",
        ) from exc


# ── Document Analytics ────────────────────────────────────────────────────────


@router.get("/analytics/overview", summary="Document suite usage overview")
async def analytics_overview(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.services.doc_analytics import DocAnalyticsService  # noqa: PLC0415

    svc = DocAnalyticsService(db)
    return await svc.overview()


@router.get("/analytics/by-type", summary="Documents grouped by file type")
async def analytics_by_type(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.services.doc_analytics import DocAnalyticsService  # noqa: PLC0415

    svc = DocAnalyticsService(db)
    return {"by_type": await svc.usage_by_type()}


@router.get("/analytics/top-documents", summary="Most-accessed documents")
async def analytics_top_docs(
    current_user: CurrentUser,
    db: DBSession,
    limit: int = Query(10, ge=1, le=50),
) -> dict[str, Any]:
    from app.services.doc_analytics import DocAnalyticsService  # noqa: PLC0415

    svc = DocAnalyticsService(db)
    return {"top_documents": await svc.top_documents(limit)}


@router.get("/analytics/storage-trend", summary="Daily new-file storage trend")
async def analytics_storage_trend(
    current_user: CurrentUser,
    db: DBSession,
    days: int = Query(30, ge=7, le=365),
) -> dict[str, Any]:
    from app.services.doc_analytics import DocAnalyticsService  # noqa: PLC0415

    svc = DocAnalyticsService(db)
    return {"trend": await svc.storage_trend(days)}


@router.get("/analytics/collaboration", summary="Collaboration and sharing stats")
async def analytics_collaboration(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.services.doc_analytics import DocAnalyticsService  # noqa: PLC0415

    svc = DocAnalyticsService(db)
    return await svc.collaboration_stats()


@router.get("/docs/{doc_id}/analytics/audit", summary="Audit log summary for a document")
async def analytics_audit(
    doc_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    days: int = Query(30, ge=1, le=365),
) -> dict[str, Any]:
    from app.services.doc_analytics import DocAnalyticsService  # noqa: PLC0415

    await _get_accessible_file(doc_id, current_user.id, db)
    svc = DocAnalyticsService(db)
    return await svc.audit_summary(doc_id, days)


# ── Document Security & Compliance ───────────────────────────────────────────


class SecuritySettingsUpdate(BaseModel):
    classification: str = "internal"
    prevent_download: bool = False
    prevent_print: bool = False
    prevent_copy: bool = False
    watermark_enabled: bool = False
    watermark_text: str | None = None
    expires_at: str | None = None  # ISO datetime string


@router.get("/docs/{doc_id}/security", summary="Get document security settings")
async def get_security_settings(
    doc_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_accessible_file(doc_id, current_user.id, db)

    result = await db.execute(
        select(DocumentSecurity).where(DocumentSecurity.file_id == doc_id)
    )
    sec = result.scalar_one_or_none()
    if not sec:
        return {
            "file_id": str(doc_id),
            "classification": "internal",
            "prevent_download": False,
            "prevent_print": False,
            "prevent_copy": False,
            "watermark_enabled": False,
            "watermark_text": None,
            "expires_at": None,
        }

    return {
        "file_id": str(doc_id),
        "classification": sec.classification,
        "prevent_download": sec.prevent_download,
        "prevent_print": sec.prevent_print,
        "prevent_copy": sec.prevent_copy,
        "watermark_enabled": sec.watermark_enabled,
        "watermark_text": sec.watermark_text,
        "expires_at": sec.expires_at.isoformat() if sec.expires_at else None,
    }


@router.put("/docs/{doc_id}/security", summary="Update document security settings")
async def update_security_settings(
    doc_id: uuid.UUID,
    payload: SecuritySettingsUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await db.get(DriveFile, doc_id)
    if not file or file.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can update security settings")

    result = await db.execute(
        select(DocumentSecurity).where(DocumentSecurity.file_id == doc_id)
    )
    sec = result.scalar_one_or_none()

    expires = None
    if payload.expires_at:
        try:
            expires = datetime.fromisoformat(payload.expires_at)
        except ValueError:
            pass

    if sec:
        sec.classification = payload.classification
        sec.prevent_download = payload.prevent_download
        sec.prevent_print = payload.prevent_print
        sec.prevent_copy = payload.prevent_copy
        sec.watermark_enabled = payload.watermark_enabled
        sec.watermark_text = payload.watermark_text
        sec.expires_at = expires
    else:
        sec = DocumentSecurity(
            file_id=doc_id,
            classification=payload.classification,
            prevent_download=payload.prevent_download,
            prevent_print=payload.prevent_print,
            prevent_copy=payload.prevent_copy,
            watermark_enabled=payload.watermark_enabled,
            watermark_text=payload.watermark_text,
            expires_at=expires,
        )
        db.add(sec)

    await db.commit()

    audit = DocumentAuditLog(
        file_id=doc_id,
        user_id=current_user.id,
        action="security_updated",
        details={"classification": payload.classification},
    )
    db.add(audit)
    await db.commit()

    return {"file_id": str(doc_id), "updated": True}


@router.post("/docs/{doc_id}/audit-log", status_code=status.HTTP_201_CREATED, summary="Record a document audit event")
async def record_audit_event(
    doc_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    action: str = Query(..., description="e.g. viewed, downloaded, printed"),
) -> dict[str, Any]:
    audit = DocumentAuditLog(
        file_id=doc_id,
        user_id=current_user.id,
        action=action,
    )
    db.add(audit)
    await db.commit()
    return {"file_id": str(doc_id), "action": action, "logged": True}


# ── Template Marketplace ──────────────────────────────────────────────────────


@router.get("/template-marketplace", summary="Browse the template marketplace")
async def browse_marketplace(
    current_user: CurrentUser,
    db: DBSession,
    category_id: uuid.UUID | None = Query(None),
    search: str | None = Query(None),
    doc_type: str | None = Query(None),
) -> dict[str, Any]:
    query = select(DocumentTemplate)
    if category_id:
        query = query.where(DocumentTemplate.category == str(category_id))
    if doc_type:
        query = query.where(DocumentTemplate.doc_type == doc_type)
    if search:
        query = query.where(DocumentTemplate.name.ilike(f"%{search}%"))

    result = await db.execute(query.order_by(DocumentTemplate.name.asc()))
    templates = result.scalars().all()

    fav_result = await db.execute(
        select(DocumentTemplateFavorite.template_id)
        .where(DocumentTemplateFavorite.user_id == current_user.id)
    )
    fav_ids = {str(r) for r in fav_result.scalars().all()}

    items = []
    for t in templates:
        items.append({
            "id": str(t.id),
            "name": t.name,
            "doc_type": t.doc_type,
            "category": t.category,
            "is_system": t.is_system,
            "is_favorite": str(t.id) in fav_ids,
        })

    return {"total": len(items), "templates": items}


@router.get("/templates/categories", summary="List template categories")
async def list_template_categories(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(DocumentTemplateCategory).order_by(DocumentTemplateCategory.sort_order.asc())
    )
    cats = result.scalars().all()
    return {
        "total": len(cats),
        "categories": [
            {"id": str(c.id), "name": c.name, "description": c.description, "icon": c.icon}
            for c in cats
        ],
    }


@router.post("/templates/{template_id}/favorite", summary="Toggle favorite on a template")
async def toggle_template_favorite(
    template_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(DocumentTemplateFavorite).where(
            DocumentTemplateFavorite.user_id == current_user.id,
            DocumentTemplateFavorite.template_id == template_id,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        await db.delete(existing)
        await db.commit()
        return {"template_id": str(template_id), "favorited": False}

    fav = DocumentTemplateFavorite(user_id=current_user.id, template_id=template_id)
    db.add(fav)
    await db.commit()
    return {"template_id": str(template_id), "favorited": True}


@router.post(
    "/templates/publish",
    status_code=status.HTTP_201_CREATED,
    summary="Publish a document as a reusable template",
)
async def publish_as_template(
    current_user: CurrentUser,
    db: DBSession,
    file_id: uuid.UUID = Query(...),
    name: str = Query(...),
    doc_type: str = Query(...),
    category: str = Query("General"),
) -> dict[str, Any]:
    file = await db.get(DriveFile, file_id)
    if not file or file.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only file owner can publish as template")

    template = DocumentTemplate(
        name=name,
        doc_type=doc_type,
        file_path=file.minio_key,
        category=category,
        is_system=False,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)

    return {
        "template_id": str(template.id),
        "name": name,
        "doc_type": doc_type,
        "category": category,
    }


class TemplateRateRequest(BaseModel):
    rating: float = Field(..., ge=1.0, le=5.0, description="Star rating 1–5")


@router.post("/templates/{template_id}/rate", summary="Rate a document template (1–5 stars)")
async def rate_template(
    template_id: uuid.UUID,
    payload: TemplateRateRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.docs import DocumentTemplate  # noqa: PLC0415

    tmpl = await db.get(DocumentTemplate, template_id)
    if not tmpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    # Compute new rolling average
    new_count = tmpl.rating_count + 1
    new_rating = ((tmpl.rating * tmpl.rating_count) + payload.rating) / new_count
    tmpl.rating = round(new_rating, 2)
    tmpl.rating_count = new_count
    await db.commit()

    return {"template_id": str(template_id), "rating": tmpl.rating, "rating_count": tmpl.rating_count}


@router.get("/templates/favorites", summary="Get favorited template IDs for current user")
async def get_template_favorites(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(DocumentTemplateFavorite.template_id)
        .where(DocumentTemplateFavorite.user_id == current_user.id)
    )
    fav_ids = [str(r) for r in result.scalars().all()]
    return {"favorites": fav_ids}


@router.get("/analytics/usage", summary="Document usage by file type (alias of by-type)")
async def analytics_usage(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.services.doc_analytics import DocAnalyticsService  # noqa: PLC0415

    svc = DocAnalyticsService(db)
    return {"usage": await svc.usage_by_type()}


@router.get("/spreadsheet/formulas", summary="List supported ERP.* formula names")
async def list_erp_formula_names(current_user: CurrentUser) -> dict[str, Any]:
    formulas = [
        {"name": "ERP.REVENUE", "description": "Total revenue (invoices) for optional date range"},
        {"name": "ERP.EXPENSE", "description": "Total expenses for optional date range"},
        {"name": "ERP.HEADCOUNT", "description": "Active employee count"},
        {"name": "ERP.STOCK", "description": "Total stock quantity for an item SKU"},
        {"name": "ERP.PIPELINE", "description": "Total CRM pipeline value"},
        {"name": "ERP.INVOICE_COUNT", "description": "Number of invoices for optional date range"},
        {"name": "ERP.PAYROLL_TOTAL", "description": "Total net pay for period"},
        {"name": "ERP.PROJECT_PROGRESS", "description": "Project completion % by project ID"},
        {"name": "ERP.OPEN_TICKETS", "description": "Count of open support tickets"},
        {"name": "ERP.POS_SALES", "description": "Total POS sales for optional date range"},
    ]
    return {"formulas": formulas}


# ── Full-text search via pgvector ─────────────────────────────────────────────


@router.get("/search", summary="Semantic full-text search across documents")
async def search_documents(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    current_user: CurrentUser = None,
    db: DBSession = None,
) -> dict[str, Any]:
    """Search documents using ilike text match with pgvector cosine similarity fallback.

    Searches document names and returns scored results. When pgvector embeddings
    are available, semantic similarity is used; otherwise falls back to trigram-style ilike.
    """
    from sqlalchemy import or_, func  # noqa: PLC0415

    pattern = f"%{q}%"

    # Text-based name search (always available)
    stmt = (
        select(DriveFile)
        .where(
            or_(
                DriveFile.name.ilike(pattern),
                DriveFile.folder_path.ilike(pattern),
            ),
            DriveFile.is_trashed.is_(False),
        )
        .order_by(DriveFile.updated_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    files = result.scalars().all()

    # Try pgvector semantic search if embedding table exists
    semantic_results: list[dict[str, Any]] = []
    try:
        from sqlalchemy import text  # noqa: PLC0415

        # Generate embedding for query via AI service
        from app.services.ai import AIService  # noqa: PLC0415
        ai_svc = AIService(db)
        embed_response = await ai_svc.embed(q)
        embedding = embed_response.get("embedding")

        if embedding:
            embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"
            semantic_stmt = text("""
                SELECT de.file_id, de.chunk_text, 1 - (de.embedding <=> :emb::vector) AS score
                FROM document_embeddings de
                JOIN drive_files df ON df.id = de.file_id
                WHERE df.is_trashed = false
                ORDER BY de.embedding <=> :emb::vector
                LIMIT :lim
            """)
            sem_result = await db.execute(semantic_stmt, {"emb": embedding_str, "lim": min(limit, 10)})
            for row in sem_result:
                semantic_results.append({
                    "file_id": str(row.file_id),
                    "snippet": row.chunk_text[:200],
                    "score": float(row.score),
                })
    except Exception:
        pass  # pgvector embeddings not available — text search only

    return {
        "query": q,
        "results": [
            {
                "id": str(f.id),
                "name": f.name,
                "content_type": f.content_type,
                "folder_path": f.folder_path,
                "updated_at": f.updated_at.isoformat() if f.updated_at else None,
                "size": f.size,
            }
            for f in files
        ],
        "semantic_snippets": semantic_results,
        "total": len(files),
    }


# ── Watermark endpoint ─────────────────────────────────────────────────────────


class WatermarkRequest(BaseModel):
    enabled: bool = True
    text: str = Field(default="CONFIDENTIAL", max_length=200)


@router.post("/docs/{doc_id}/watermark", summary="Set or clear watermark on a document")
async def set_watermark(
    doc_id: uuid.UUID,
    payload: WatermarkRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Enable watermarking with custom text on a document's security settings."""
    result = await db.execute(
        select(DocumentSecurity).where(DocumentSecurity.file_id == doc_id)
    )
    sec = result.scalar_one_or_none()

    if not sec:
        sec = DocumentSecurity(
            file_id=doc_id,
            created_by=current_user.id,
        )
        db.add(sec)

    sec.watermark_enabled = payload.enabled
    sec.watermark_text = payload.text if payload.enabled else None
    await db.commit()

    return {
        "doc_id": str(doc_id),
        "watermark_enabled": sec.watermark_enabled,
        "watermark_text": sec.watermark_text,
    }


# ── Compliance report ─────────────────────────────────────────────────────────

from app.core.deps import SuperAdminUser  # noqa: E402, PLC0415


@router.get("/admin/compliance-report", summary="Document compliance summary (super-admin)")
async def compliance_report(
    current_user: SuperAdminUser,
    db: DBSession,
    days: int = Query(30, ge=1, le=365),
) -> dict[str, Any]:
    """Return a compliance overview: classifications, restricted docs, recent audit actions."""
    from datetime import timedelta, timezone  # noqa: PLC0415
    from sqlalchemy import func  # noqa: PLC0415

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Classification breakdown
    class_result = await db.execute(
        select(DocumentSecurity.classification, func.count(DocumentSecurity.id))
        .group_by(DocumentSecurity.classification)
    )
    classification_counts = {row[0] or "unclassified": row[1] for row in class_result}

    # Restricted documents count
    restricted_result = await db.execute(
        select(func.count(DocumentSecurity.id)).where(
            DocumentSecurity.classification.in_(["confidential", "restricted"])
        )
    )
    restricted_count = restricted_result.scalar() or 0

    # Watermarked docs
    watermark_result = await db.execute(
        select(func.count(DocumentSecurity.id)).where(DocumentSecurity.watermark_enabled.is_(True))
    )
    watermarked_count = watermark_result.scalar() or 0

    # Recent audit actions
    audit_result = await db.execute(
        select(DocumentAuditLog.action, func.count(DocumentAuditLog.id))
        .where(DocumentAuditLog.created_at >= cutoff)
        .group_by(DocumentAuditLog.action)
        .order_by(func.count(DocumentAuditLog.id).desc())
    )
    audit_by_action = {row[0]: row[1] for row in audit_result}

    # Total docs audited in period
    total_audit = sum(audit_by_action.values())

    return {
        "period_days": days,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "classification_breakdown": classification_counts,
        "restricted_documents": restricted_count,
        "watermarked_documents": watermarked_count,
        "audit_actions_in_period": audit_by_action,
        "total_audit_events": total_audit,
    }


# ── Offline sync endpoints ─────────────────────────────────────────────────────


@router.get("/sync-manifest", summary="Offline sync manifest — list of recent docs for caching")
async def sync_manifest(
    limit: int = Query(20, ge=1, le=50),
    current_user: CurrentUser = None,
    db: DBSession = None,
) -> dict[str, Any]:
    """Return a list of the user's most recently accessed documents for offline caching."""
    recent_stmt = (
        select(RecentDocument.file_id, RecentDocument.last_accessed)
        .where(RecentDocument.user_id == current_user.id)
        .order_by(RecentDocument.last_accessed.desc())
        .limit(limit)
    )
    recent_result = await db.execute(recent_stmt)
    recent_rows = recent_result.all()

    file_ids = [row.file_id for row in recent_rows]
    files_result = await db.execute(
        select(DriveFile).where(DriveFile.id.in_(file_ids), DriveFile.is_trashed.is_(False))
    )
    files_by_id = {f.id: f for f in files_result.scalars().all()}

    manifest = []
    for row in recent_rows:
        f = files_by_id.get(row.file_id)
        if not f:
            continue
        manifest.append({
            "file_id": str(f.id),
            "name": f.name,
            "content_type": f.content_type,
            "size": f.size,
            "updated_at": f.updated_at.isoformat() if f.updated_at else None,
            "last_accessed": row.last_accessed.isoformat() if row.last_accessed else None,
            "minio_key": f.minio_key,
        })

    return {
        "manifest": manifest,
        "generated_at": datetime.utcnow().isoformat(),
        "count": len(manifest),
    }


class SyncBatchItem(BaseModel):
    file_id: uuid.UUID
    action: str  # "view" | "comment" | "bookmark"
    payload: dict[str, Any] = Field(default_factory=dict)
    queued_at: str  # ISO 8601 datetime


class SyncBatchRequest(BaseModel):
    operations: list[SyncBatchItem]


@router.post("/sync-batch", summary="Replay offline-queued operations on reconnect")
async def sync_batch(
    payload: SyncBatchRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Process a batch of operations that were queued while offline."""
    processed = 0
    failed = 0
    errors: list[str] = []

    for op in payload.operations:
        try:
            if op.action == "view":
                # Update RecentDocument
                recent = (await db.execute(
                    select(RecentDocument).where(
                        RecentDocument.file_id == op.file_id,
                        RecentDocument.user_id == current_user.id,
                    )
                )).scalar_one_or_none()
                if recent:
                    recent.last_accessed = datetime.utcnow()
                else:
                    db.add(RecentDocument(file_id=op.file_id, user_id=current_user.id))

            elif op.action == "bookmark":
                exists = (await db.execute(
                    select(DocumentBookmark).where(
                        DocumentBookmark.file_id == op.file_id,
                        DocumentBookmark.user_id == current_user.id,
                    )
                )).scalar_one_or_none()
                if not exists:
                    db.add(DocumentBookmark(file_id=op.file_id, user_id=current_user.id))

            elif op.action == "audit_log":
                db.add(DocumentAuditLog(
                    file_id=op.file_id,
                    user_id=current_user.id,
                    action=op.payload.get("action", "viewed"),
                    metadata=op.payload,
                ))

            processed += 1
        except Exception as exc:
            failed += 1
            errors.append(f"{op.file_id}/{op.action}: {exc}")

    await db.commit()

    return {
        "processed": processed,
        "failed": failed,
        "errors": errors[:10],  # cap error list
    }
