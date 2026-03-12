"""API router for Y&U Notes AI — generate, summarize, extract, transform, Q&A."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession
from app.services.notes_ai import NotesAIService

router = APIRouter()


# ── Request / Response schemas ───────────────────────────────────────────────

class GenerateRequest(BaseModel):
    prompt: str
    include_erp_context: bool = True


class GenerateResponse(BaseModel):
    content: str


class SummarizeRequest(BaseModel):
    content: str
    style: str = "concise"  # concise | executive | detailed


class ExtractActionsRequest(BaseModel):
    content: str


class ActionItem(BaseModel):
    type: str
    title: str
    assignee: str | None = None
    due_date: str | None = None
    priority: str = "medium"
    erp_action: str | None = None


class TransformRequest(BaseModel):
    text: str
    action: str  # improve | expand | simplify | fix_grammar | translate | change_tone
    tone: str | None = None
    target_language: str | None = None


class AskRequest(BaseModel):
    question: str
    notebook_id: str | None = None


class AskResponse(BaseModel):
    answer: str
    sources: list[dict[str, Any]] = []


class SuggestLinksRequest(BaseModel):
    content: str


class SuggestedLink(BaseModel):
    entity_type: str
    reference_text: str
    confidence: float


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=GenerateResponse)
async def generate_content(
    body: GenerateRequest,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    """Generate note content with optional ERP context enrichment."""
    svc = NotesAIService(db, user)
    content = await svc.generate_content(
        prompt=body.prompt,
        user_id=user.id,
        include_erp_context=body.include_erp_context,
    )
    return GenerateResponse(content=content)


@router.post("/summarize", response_model=GenerateResponse)
async def summarize_content(
    body: SummarizeRequest,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    """Summarize note content in the requested style."""
    svc = NotesAIService(db, user)
    summary = await svc.summarize(content=body.content, user_id=user.id, style=body.style)
    return GenerateResponse(content=summary)


@router.post("/{note_id}/summarize", response_model=GenerateResponse)
async def summarize_note(
    note_id: str,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
    style: str = "concise",
):
    """Summarize an existing note by ID."""
    from sqlalchemy import select as sa_select
    from app.models.notes import Note

    result = await db.execute(sa_select(Note).where(Note.id == note_id, Note.owner_id == user.id))
    note = result.scalar_one_or_none()
    if not note:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Note not found")

    svc = NotesAIService(db, user)
    summary = await svc.summarize(content=note.content or "", user_id=user.id, style=style)
    return GenerateResponse(content=summary)


@router.post("/extract-actions", response_model=list[ActionItem])
async def extract_actions(
    body: ExtractActionsRequest,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    """Extract action items, tasks, and follow-ups from note content."""
    svc = NotesAIService(db, user)
    actions = await svc.extract_actions(content=body.content, user_id=user.id)
    return actions


@router.post("/{note_id}/extract-actions", response_model=list[ActionItem])
async def extract_note_actions(
    note_id: str,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    """Extract action items from an existing note."""
    from sqlalchemy import select as sa_select
    from app.models.notes import Note

    result = await db.execute(sa_select(Note).where(Note.id == note_id, Note.owner_id == user.id))
    note = result.scalar_one_or_none()
    if not note:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Note not found")

    svc = NotesAIService(db, user)
    actions = await svc.extract_actions(content=note.content or "", user_id=user.id)
    return actions


@router.post("/transform", response_model=GenerateResponse)
async def transform_text(
    body: TransformRequest,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    """Transform text: improve, expand, simplify, translate, fix grammar, change tone."""
    svc = NotesAIService(db, user)
    result = await svc.transform_text(
        text=body.text,
        action=body.action,
        user_id=user.id,
        tone=body.tone,
        target_language=body.target_language,
    )
    return GenerateResponse(content=result)


@router.post("/ask", response_model=AskResponse)
async def ask_notes(
    body: AskRequest,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    """Ask a question across all your notes (RAG Q&A with semantic search)."""
    svc = NotesAIService(db, user)
    result = await svc.ask_notes(
        question=body.question,
        user_id=user.id,
        notebook_id=body.notebook_id,
    )
    return AskResponse(**result)


@router.post("/suggest-links", response_model=list[SuggestedLink])
async def suggest_links(
    body: SuggestLinksRequest,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    """Analyze content and suggest ERP entity links."""
    svc = NotesAIService(db, user)
    suggestions = await svc.suggest_links(content=body.content, user_id=user.id)
    return suggestions
