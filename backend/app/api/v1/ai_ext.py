"""AI extensions — prompt templates, knowledge base, usage stats."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, DBSession
from app.models.ai import AIAuditLog, AIChatHistory, AIKnowledgeBase, AIPromptTemplate

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class TemplateCreate(BaseModel):
    name: str
    template: str
    module: str | None = None
    variables: dict | None = None
    is_public: bool = False


class TemplateUpdate(BaseModel):
    name: str | None = None
    template: str | None = None
    module: str | None = None
    variables: dict | None = None
    is_public: bool | None = None


class KBCreate(BaseModel):
    name: str
    description: str | None = None
    module: str | None = None


class KBUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    module: str | None = None


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    template: str
    module: str | None
    variables: dict | None
    created_by: uuid.UUID
    is_public: bool
    created_at: Any

    model_config = {"from_attributes": True}


class KBOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    module: str | None
    document_count: int
    owner_id: uuid.UUID
    created_at: Any

    model_config = {"from_attributes": True}


# ── Prompt Templates ─────────────────────────────────────────────────────────

@router.get("/templates", summary="List AI prompt templates")
async def list_templates(
    current_user: CurrentUser,
    db: DBSession,
    module: str | None = Query(None, description="Filter by module"),
) -> dict[str, Any]:
    from sqlalchemy import or_  # noqa: PLC0415

    query = select(AIPromptTemplate).where(
        or_(
            AIPromptTemplate.created_by == current_user.id,
            AIPromptTemplate.is_public.is_(True),
        )
    )
    if module:
        query = query.where(AIPromptTemplate.module == module)
    query = query.order_by(AIPromptTemplate.name)

    result = await db.execute(query)
    templates = result.scalars().all()
    return {
        "total": len(templates),
        "templates": [TemplateOut.model_validate(t).model_dump() for t in templates],
    }


@router.post("/templates", status_code=status.HTTP_201_CREATED, summary="Create an AI prompt template")
async def create_template(
    payload: TemplateCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    template = AIPromptTemplate(
        name=payload.name,
        template=payload.template,
        module=payload.module,
        variables=payload.variables,
        created_by=current_user.id,
        is_public=payload.is_public,
        created_at=datetime.now(timezone.utc),
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return TemplateOut.model_validate(template).model_dump()


@router.get("/templates/{template_id}", summary="Get an AI prompt template")
async def get_template(
    template_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from sqlalchemy import or_  # noqa: PLC0415

    template = await db.get(AIPromptTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.created_by != current_user.id and not template.is_public:
        raise HTTPException(status_code=404, detail="Template not found")
    return TemplateOut.model_validate(template).model_dump()


@router.put("/templates/{template_id}", summary="Update an AI prompt template")
async def update_template(
    template_id: uuid.UUID,
    payload: TemplateUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    template = await db.get(AIPromptTemplate, template_id)
    if not template or template.created_by != current_user.id:
        raise HTTPException(status_code=404, detail="Template not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(template, field, value)

    await db.commit()
    await db.refresh(template)
    return TemplateOut.model_validate(template).model_dump()


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete an AI prompt template")
async def delete_template(
    template_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> None:
    template = await db.get(AIPromptTemplate, template_id)
    if not template or template.created_by != current_user.id:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(template)
    await db.commit()


# ── Knowledge Base ───────────────────────────────────────────────────────────

@router.get("/knowledge-base", summary="List AI knowledge bases")
async def list_knowledge_bases(
    current_user: CurrentUser,
    db: DBSession,
    module: str | None = Query(None, description="Filter by module"),
) -> dict[str, Any]:
    query = select(AIKnowledgeBase).where(AIKnowledgeBase.owner_id == current_user.id)
    if module:
        query = query.where(AIKnowledgeBase.module == module)
    query = query.order_by(AIKnowledgeBase.name)

    result = await db.execute(query)
    kbs = result.scalars().all()
    return {
        "total": len(kbs),
        "knowledge_bases": [KBOut.model_validate(kb).model_dump() for kb in kbs],
    }


@router.post("/knowledge-base", status_code=status.HTTP_201_CREATED, summary="Create an AI knowledge base")
async def create_knowledge_base(
    payload: KBCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    kb = AIKnowledgeBase(
        name=payload.name,
        description=payload.description,
        module=payload.module,
        owner_id=current_user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(kb)
    await db.commit()
    await db.refresh(kb)
    return KBOut.model_validate(kb).model_dump()


@router.get("/knowledge-base/{kb_id}", summary="Get an AI knowledge base")
async def get_knowledge_base(
    kb_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    kb = await db.get(AIKnowledgeBase, kb_id)
    if not kb or kb.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return KBOut.model_validate(kb).model_dump()


@router.put("/knowledge-base/{kb_id}", summary="Update an AI knowledge base")
async def update_knowledge_base(
    kb_id: uuid.UUID,
    payload: KBUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    kb = await db.get(AIKnowledgeBase, kb_id)
    if not kb or kb.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(kb, field, value)

    await db.commit()
    await db.refresh(kb)
    return KBOut.model_validate(kb).model_dump()


@router.delete("/knowledge-base/{kb_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete an AI knowledge base")
async def delete_knowledge_base(
    kb_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> None:
    kb = await db.get(AIKnowledgeBase, kb_id)
    if not kb or kb.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    await db.delete(kb)
    await db.commit()


@router.post("/knowledge-base/{kb_id}/upload", status_code=status.HTTP_201_CREATED, summary="Upload a document to a knowledge base")
async def upload_to_knowledge_base(
    kb_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    file: UploadFile = File(...),
) -> dict[str, Any]:
    kb = await db.get(AIKnowledgeBase, kb_id)
    if not kb or kb.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    file_data = await file.read()
    filename = file.filename or "document"
    content_type = file.content_type or "application/octet-stream"

    # Store document in MinIO under knowledge-base path
    try:
        from app.integrations import minio_client  # noqa: PLC0415

        record = minio_client.upload_file(
            file_data=file_data,
            filename=filename,
            user_id=str(current_user.id),
            folder_path=f"knowledge-base/{kb_id}",
            content_type=content_type,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage service unavailable: {exc}",
        ) from exc

    # Increment document count
    kb.document_count += 1
    await db.commit()
    await db.refresh(kb)

    return {
        "kb_id": str(kb_id),
        "filename": filename,
        "size": len(file_data),
        "content_type": content_type,
        "document_count": kb.document_count,
        "minio_key": record.get("minio_key"),
    }


# ── Usage Stats ──────────────────────────────────────────────────────────────

@router.get("/usage", summary="Get AI usage statistics")
async def usage_stats(
    current_user: CurrentUser,
    db: DBSession,
    days: int = Query(30, ge=1, le=365, description="Number of days to look back"),
) -> dict[str, Any]:
    from datetime import timedelta  # noqa: PLC0415

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Chat message count
    chat_result = await db.execute(
        select(func.count())
        .select_from(AIChatHistory)
        .where(
            AIChatHistory.user_id == current_user.id,
            AIChatHistory.created_at >= cutoff,
        )
    )
    total_messages = chat_result.scalar() or 0

    # Session count
    session_result = await db.execute(
        select(func.count(AIChatHistory.session_id.distinct()))
        .where(
            AIChatHistory.user_id == current_user.id,
            AIChatHistory.created_at >= cutoff,
        )
    )
    total_sessions = session_result.scalar() or 0

    # Audit log count (actions)
    audit_result = await db.execute(
        select(func.count())
        .select_from(AIAuditLog)
        .where(
            AIAuditLog.user_id == current_user.id,
            AIAuditLog.created_at >= cutoff,
        )
    )
    total_actions = audit_result.scalar() or 0

    # Actions by type
    action_breakdown_result = await db.execute(
        select(AIAuditLog.action, func.count())
        .where(
            AIAuditLog.user_id == current_user.id,
            AIAuditLog.created_at >= cutoff,
        )
        .group_by(AIAuditLog.action)
        .order_by(func.count().desc())
    )
    action_breakdown = {row[0]: row[1] for row in action_breakdown_result.all()}

    # Messages by role
    role_result = await db.execute(
        select(AIChatHistory.role, func.count())
        .where(
            AIChatHistory.user_id == current_user.id,
            AIChatHistory.created_at >= cutoff,
        )
        .group_by(AIChatHistory.role)
    )
    messages_by_role = {row[0]: row[1] for row in role_result.all()}

    # Estimate token usage from message length (rough approximation: 1 token ~ 4 chars)
    char_result = await db.execute(
        select(func.sum(func.length(AIChatHistory.content)))
        .where(
            AIChatHistory.user_id == current_user.id,
            AIChatHistory.created_at >= cutoff,
        )
    )
    total_chars = char_result.scalar() or 0
    estimated_tokens = total_chars // 4

    return {
        "period_days": days,
        "total_messages": total_messages,
        "total_sessions": total_sessions,
        "total_actions": total_actions,
        "estimated_tokens": estimated_tokens,
        "messages_by_role": messages_by_role,
        "action_breakdown": action_breakdown,
    }
