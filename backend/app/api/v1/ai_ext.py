"""AI extensions — prompt templates, knowledge base, usage stats, conversations."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.models.ai import AIAuditLog, AIChatHistory, AIKnowledgeBase, AIPromptTemplate

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class TemplateCreate(BaseModel):
    name: str
    # Accept both 'prompt' (frontend) and 'template' (legacy)
    prompt: str | None = Field(default=None)
    template: str | None = Field(default=None)
    # Accept both 'category' (frontend) and 'module' (legacy)
    category: str | None = None
    module: str | None = None
    description: str | None = None
    variables: list[str] | dict | None = None
    is_public: bool = False

    @model_validator(mode="after")
    def resolve_aliases(self) -> "TemplateCreate":
        if self.prompt is None and self.template:
            self.prompt = self.template
        if self.prompt is None:
            self.prompt = ""
        if self.category is None and self.module:
            self.category = self.module
        return self


class TemplateUpdate(BaseModel):
    name: str | None = None
    prompt: str | None = None
    template: str | None = None
    category: str | None = None
    module: str | None = None
    description: str | None = None
    variables: list[str] | dict | None = None
    is_public: bool | None = None

    @model_validator(mode="after")
    def resolve_aliases(self) -> "TemplateUpdate":
        if self.prompt is None and self.template:
            self.prompt = self.template
        if self.category is None and self.module:
            self.category = self.module
        return self


class KBCreate(BaseModel):
    name: str
    description: str | None = None
    module: str | None = None


class KBUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    module: str | None = None


# ── Response helpers ──────────────────────────────────────────────────────────

def _template_to_dict(t: AIPromptTemplate) -> dict[str, Any]:
    """Map AIPromptTemplate ORM to the dict shape the frontend expects."""
    vars_raw = t.variables
    if isinstance(vars_raw, dict):
        variables_out: list[str] = list(vars_raw.keys())
    elif isinstance(vars_raw, list):
        variables_out = [str(v) for v in vars_raw]
    else:
        variables_out = []

    return {
        "id": str(t.id),
        "name": t.name,
        "description": None,
        "prompt": t.template,           # DB field 'template' → frontend 'prompt'
        "category": t.module,           # DB field 'module' → frontend 'category'
        "variables": variables_out,
        "is_public": t.is_public,
        "created_by": str(t.created_by),
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.created_at.isoformat() if t.created_at else None,
    }


def _kb_to_dict(kb: AIKnowledgeBase) -> dict[str, Any]:
    """Map AIKnowledgeBase ORM to the dict shape the frontend expects."""
    return {
        "id": str(kb.id),
        "name": kb.name,
        "description": kb.description,
        "document_count": kb.document_count,
        "total_chunks": kb.document_count,  # approximate: 1 doc ≈ 1 chunk
        "status": "active",
        "created_at": kb.created_at.isoformat() if kb.created_at else None,
        "updated_at": kb.created_at.isoformat() if kb.created_at else None,
    }


# ── Prompt Templates ─────────────────────────────────────────────────────────

@router.get("/templates", summary="List AI prompt templates")
async def list_templates(
    current_user: CurrentUser,
    db: DBSession,
    module: str | None = Query(None, description="Filter by module/category"),
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
        "templates": [_template_to_dict(t) for t in templates],
    }


@router.post("/templates", status_code=status.HTTP_201_CREATED, summary="Create an AI prompt template")
async def create_template(
    payload: TemplateCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    vars_db: dict | None = None
    if isinstance(payload.variables, list):
        vars_db = {v: "" for v in payload.variables}
    elif isinstance(payload.variables, dict):
        vars_db = payload.variables

    template = AIPromptTemplate(
        name=payload.name,
        template=payload.prompt or "",
        module=payload.category,
        variables=vars_db,
        created_by=current_user.id,
        is_public=payload.is_public,
        created_at=datetime.now(timezone.utc),
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return _template_to_dict(template)


@router.get("/templates/{template_id}", summary="Get an AI prompt template")
async def get_template(
    template_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    template = await db.get(AIPromptTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.created_by != current_user.id and not template.is_public:
        raise HTTPException(status_code=404, detail="Template not found")
    return _template_to_dict(template)


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

    if payload.name is not None:
        template.name = payload.name
    if payload.prompt is not None:
        template.template = payload.prompt
    if payload.category is not None:
        template.module = payload.category
    if payload.is_public is not None:
        template.is_public = payload.is_public
    if payload.variables is not None:
        if isinstance(payload.variables, list):
            template.variables = {v: "" for v in payload.variables}
        else:
            template.variables = payload.variables

    await db.commit()
    await db.refresh(template)
    return _template_to_dict(template)


@router.delete("/templates/{template_id}", status_code=status.HTTP_200_OK, response_model=None, summary="Delete an AI prompt template")
async def delete_template(
    template_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    template = await db.get(AIPromptTemplate, template_id)
    if not template or template.created_by != current_user.id:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(template)
    await db.commit()


# ── Knowledge Bases ───────────────────────────────────────────────────────────
# Uses plural '/knowledge-bases' to match the frontend API client.

@router.get("/knowledge-bases", summary="List AI knowledge bases")
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
        "knowledge_bases": [_kb_to_dict(kb) for kb in kbs],
    }


@router.post("/knowledge-bases", status_code=status.HTTP_201_CREATED, summary="Create an AI knowledge base")
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
    return _kb_to_dict(kb)


@router.get("/knowledge-bases/{kb_id}", summary="Get an AI knowledge base")
async def get_knowledge_base(
    kb_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    kb = await db.get(AIKnowledgeBase, kb_id)
    if not kb or kb.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return _kb_to_dict(kb)


@router.put("/knowledge-bases/{kb_id}", summary="Update an AI knowledge base")
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
    return _kb_to_dict(kb)


@router.delete("/knowledge-bases/{kb_id}", status_code=status.HTTP_200_OK, response_model=None, summary="Delete an AI knowledge base")
async def delete_knowledge_base(
    kb_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    kb = await db.get(AIKnowledgeBase, kb_id)
    if not kb or kb.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    await db.delete(kb)
    await db.commit()


@router.post("/knowledge-bases/{kb_id}/upload", status_code=status.HTTP_201_CREATED, summary="Upload a document to a knowledge base")
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


# ── Usage Stats ───────────────────────────────────────────────────────────────

@router.get("/usage", summary="Get AI usage statistics")
async def usage_stats(
    current_user: CurrentUser,
    db: DBSession,
    period: str = Query("30d", description="Period: 7d, 30d, 90d"),
    days: int | None = Query(None, ge=1, le=365, description="Override period with explicit day count"),
) -> dict[str, Any]:
    # Parse period string
    period_days = days
    if period_days is None:
        try:
            period_days = int(period.rstrip("d"))
        except (ValueError, AttributeError):
            period_days = 30

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=period_days)

    # Total user requests
    user_req_result = await db.execute(
        select(func.count())
        .select_from(AIChatHistory)
        .where(
            AIChatHistory.user_id == current_user.id,
            AIChatHistory.role == "user",
            AIChatHistory.created_at >= cutoff,
        )
    )
    total_requests = user_req_result.scalar() or 0

    # Estimated total tokens (~4 chars per token)
    char_result = await db.execute(
        select(func.sum(func.length(AIChatHistory.content)))
        .where(
            AIChatHistory.user_id == current_user.id,
            AIChatHistory.created_at >= cutoff,
        )
    )
    total_chars = char_result.scalar() or 0
    total_tokens = total_chars // 4

    # Tool usage breakdown (from audit log)
    audit_result = await db.execute(
        select(AIAuditLog.action, func.count())
        .where(
            AIAuditLog.user_id == current_user.id,
            AIAuditLog.created_at >= cutoff,
        )
        .group_by(AIAuditLog.action)
        .order_by(func.count().desc())
    )
    tokens_by_tool = [
        {"tool": action, "tokens": 0, "requests": count}
        for action, count in audit_result.all()
    ]

    # tokens_by_model: single aggregate (model not tracked per message)
    tokens_by_model = (
        [{"model": "default", "tokens": total_tokens, "requests": total_requests}]
        if total_requests > 0 else []
    )

    # Daily breakdown
    daily_result = await db.execute(
        select(
            func.date_trunc("day", AIChatHistory.created_at).label("day"),
            func.sum(func.length(AIChatHistory.content)).label("chars"),
            func.count().label("msgs"),
        )
        .where(
            AIChatHistory.user_id == current_user.id,
            AIChatHistory.created_at >= cutoff,
        )
        .group_by(func.date_trunc("day", AIChatHistory.created_at))
        .order_by(func.date_trunc("day", AIChatHistory.created_at))
    )
    tokens_by_day = [
        {
            "date": row.day.strftime("%Y-%m-%d") if row.day else "",
            "tokens": (row.chars or 0) // 4,
            "requests": row.msgs or 0,
        }
        for row in daily_result.all()
    ]

    return {
        "total_tokens": total_tokens,
        "total_requests": total_requests,
        "tokens_by_day": tokens_by_day,
        "tokens_by_model": tokens_by_model,
        "tokens_by_tool": tokens_by_tool,
        "period_start": cutoff.isoformat(),
        "period_end": now.isoformat(),
    }


# ── Conversations (session-based chat history) ────────────────────────────────

@router.get("/conversations", summary="List AI conversations grouped by session")
async def list_conversations(
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    offset = (page - 1) * limit

    count_result = await db.execute(
        select(func.count(AIChatHistory.session_id.distinct()))
        .where(AIChatHistory.user_id == current_user.id)
    )
    total = count_result.scalar() or 0

    sessions_result = await db.execute(
        select(
            AIChatHistory.session_id,
            func.max(AIChatHistory.created_at).label("last_at"),
            func.count().label("msg_count"),
        )
        .where(AIChatHistory.user_id == current_user.id)
        .group_by(AIChatHistory.session_id)
        .order_by(func.max(AIChatHistory.created_at).desc())
        .offset(offset)
        .limit(limit)
    )
    sessions = sessions_result.all()

    conversations = []
    for row in sessions:
        last_msg_result = await db.execute(
            select(AIChatHistory.content)
            .where(
                AIChatHistory.user_id == current_user.id,
                AIChatHistory.session_id == row.session_id,
                AIChatHistory.role == "user",
            )
            .order_by(AIChatHistory.created_at.desc())
            .limit(1)
        )
        last_user_msg = last_msg_result.scalar_one_or_none()
        title = (
            (last_user_msg[:60] + "…") if last_user_msg and len(last_user_msg) > 60
            else last_user_msg or row.session_id
        )

        conversations.append({
            "id": row.session_id,
            "session_id": row.session_id,
            "title": title,
            "message_count": row.msg_count,
            "last_message": last_user_msg[:100] if last_user_msg else None,
            "created_at": row.last_at.isoformat() if row.last_at else None,
            "updated_at": row.last_at.isoformat() if row.last_at else None,
        })

    return {"total": total, "conversations": conversations}


@router.get("/conversations/{conversation_id}/messages", summary="Get messages for a conversation")
async def get_conversation_messages(
    conversation_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(AIChatHistory)
        .where(
            AIChatHistory.user_id == current_user.id,
            AIChatHistory.session_id == conversation_id,
        )
        .order_by(AIChatHistory.created_at)
    )
    messages = result.scalars().all()

    return {
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "tokens_used": len(m.content) // 4,
                "model": None,
                "timestamp": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ]
    }
