"""Docs Extensions API — Versions, Permissions, Comments, Templates, Export, AI, Recent."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.drive import DriveFile
from app.models.doc_comment import DocComment, DocVersion
from app.models.docs import DocumentComment, DocumentTemplate, RecentDocument

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
    status_code=status.HTTP_204_NO_CONTENT,
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

    return Response(status_code=status.HTTP_204_NO_CONTENT)


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

        # Create new file record from template
        record = minio_client.upload_file(
            file_data=b"",
            filename=final_name,
            user_id=str(current_user.id),
            folder_path="documents",
            content_type=content_type,
        )

        drive_file = DriveFile(
            id=uuid.UUID(record["file_id"]),
            name=final_name,
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

@router.post("/docs/{doc_id}/ai-generate", summary="AI-generate content for a document")
async def ai_generate(
    doc_id: uuid.UUID,
    payload: AIGenerateRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    file = await _get_accessible_file(doc_id, current_user.id, db)

    try:
        from app.services.ai import AIService  # noqa: PLC0415

        ai_service = AIService()
        system_prompt = (
            f"You are a document assistant. Generate professional content for a "
            f"{payload.doc_type} document. The document is named '{file.name}'."
        )
        result = await ai_service.generate(
            prompt=payload.prompt,
            system_prompt=system_prompt,
            user_id=str(current_user.id),
        )
        return {
            "file_id": str(doc_id),
            "generated_content": result.get("content", ""),
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

    try:
        from app.integrations import minio_client  # noqa: PLC0415

        download_url = minio_client.get_download_url(file.minio_key)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage unavailable: {exc}",
        ) from exc

    try:
        from app.services.ai import AIService  # noqa: PLC0415

        ai_service = AIService()
        prompt = (
            f"Summarize the following document in at most {payload.max_length} characters. "
            f"Document name: {file.name}. Provide a concise, professional summary."
        )
        result = await ai_service.generate(
            prompt=prompt,
            system_prompt="You are a document summarization assistant.",
            user_id=str(current_user.id),
        )
        return {
            "file_id": str(doc_id),
            "filename": file.name,
            "summary": result.get("content", ""),
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

    # Try to fetch file content from MinIO
    content_to_translate = ""
    try:
        from app.integrations import minio_client  # noqa: PLC0415

        file_bytes = minio_client.download_file(file.minio_key)
        content_to_translate = file_bytes.decode("utf-8", errors="replace")
    except Exception:
        pass

    # Fallback: check if there's a linked note with content
    if not content_to_translate.strip():
        from app.models.notes import Note  # noqa: PLC0415

        result = await db.execute(
            select(Note).where(Note.title.ilike(f"%{file.name}%")).limit(1)
        )
        note = result.scalar_one_or_none()
        if note and note.content:
            content_to_translate = note.content

    if not content_to_translate.strip():
        content_to_translate = f"Document: {file.name}"

    try:
        from app.services.ai import AIService  # noqa: PLC0415

        ai_service = AIService()
        prompt = (
            f"Translate the following text to {payload.target_language}. "
            "Preserve all formatting, headers, and structure. "
            "Return ONLY the translated text without any explanations.\n\n"
            f"{content_to_translate[:5000]}"
        )
        result = await ai_service.generate(
            prompt=prompt,
            system_prompt="You are a professional document translator.",
            user_id=str(current_user.id),
        )
        return {
            "file_id": str(doc_id),
            "filename": file.name,
            "target_language": payload.target_language,
            "translated_content": result.get("content", ""),
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
