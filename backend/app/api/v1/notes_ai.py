"""API router for Y&U Notes AI — generate, summarize, extract, transform, Q&A."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
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


# ── Voice Transcription ───────────────────────────────────────────────────────

@router.post("/transcribe", summary="Transcribe audio to a structured note")
async def transcribe_audio(
    audio: UploadFile,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
    notebook_id: str | None = Query(None),
) -> dict:
    """Upload audio -> Whisper (via OpenAI) -> create structured note.

    Accepts: mp3, mp4, wav, m4a, ogg, webm (max 25 MB)
    Returns: created note id + transcript
    """
    import tempfile, os, uuid as uuid_mod  # noqa: PLC0415
    from app.models.notes import Note  # noqa: PLC0415
    from app.core.config import settings  # noqa: PLC0415

    MAX_SIZE = 25 * 1024 * 1024
    content = await audio.read(MAX_SIZE + 1)
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="Audio file exceeds 25 MB limit")

    # Save to temp file
    suffix = os.path.splitext(audio.filename or "audio.webm")[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(content)
        tmp_path = f.name

    transcript = ""
    try:
        from openai import AsyncOpenAI  # noqa: PLC0415
        client = AsyncOpenAI(api_key=settings.AI_API_KEY, base_url=settings.AI_BASE_URL)
        with open(tmp_path, "rb") as af:
            resp = await client.audio.transcriptions.create(
                model="whisper-1",
                file=af,
            )
        transcript = resp.text or ""
        if not transcript:
            transcript = "[Audio transcription returned empty result]"
    except Exception:
        transcript = "[Audio transcription failed — check OpenAI API key and Whisper access]"
    finally:
        os.unlink(tmp_path)

    # Structure transcript with AI
    if transcript and not transcript.startswith('['):
        try:
            svc = NotesAIService(db, user)
            structure_prompt = (
                f"Structure this transcription into a clean meeting notes format with HTML. "
                f"Add headings, extract key points, action items. Transcript:\n\n{transcript}"
            )
            structured = await svc.generate_content(structure_prompt, user.id)
            note_content = structured
        except Exception:
            note_content = f"<p><strong>Transcript:</strong></p><p>{transcript}</p>"
    else:
        note_content = f"<p>{transcript}</p>"

    # Create the note
    note = Note(
        title=f"Audio Note — {audio.filename or 'Recording'}",
        content=note_content,
        owner_id=user.id,
        tags=["audio", "transcription"],
        source_type="voice",
        notebook_id=uuid_mod.UUID(str(notebook_id)) if notebook_id else None,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)

    return {"note_id": str(note.id), "transcript": transcript, "title": note.title}


# ── Mind Map ──────────────────────────────────────────────────────────────────

@router.post("/{note_id}/mindmap", summary="Generate a mind map graph from note content")
async def generate_mindmap(
    note_id: str,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
) -> dict:
    """Analyze note content and return a mind map as a JSON graph.

    Returns nodes and edges compatible with ReactFlow.
    """
    import uuid  # noqa: PLC0415
    import json  # noqa: PLC0415
    import re  # noqa: PLC0415
    from app.models.notes import Note  # noqa: PLC0415

    note = await db.get(Note, uuid.UUID(str(note_id)))
    if not note or str(note.owner_id) != str(user.id):
        raise HTTPException(status_code=404, detail="Note not found")

    text = re.sub(r"<[^>]+>", "", note.content or "")[:3000]

    svc = NotesAIService(db, user)
    prompt = (
        f"Analyze this note and return a mind map as JSON. "
        f"Return ONLY valid JSON with this structure:\n"
        f'{{"nodes": [{{"id": "1", "label": "Central Topic", "type": "central"}}, '
        f'{{"id": "2", "label": "Sub-topic", "type": "branch"}}], '
        f'"edges": [{{"id": "e1-2", "source": "1", "target": "2"}}]}}\n\n'
        f"The central node should be the main theme. Add 4-8 branch nodes for key concepts. "
        f"Note content:\n\n{text}"
    )

    try:
        raw = await svc.generate_content(prompt, user.id, include_erp_context=False)
        start = raw.find('{')
        end = raw.rfind('}') + 1
        graph = json.loads(raw[start:end]) if start >= 0 else {"nodes": [], "edges": []}
    except Exception:
        # Fallback: create simple graph from headings
        headings = re.findall(r'<h[123][^>]*>(.*?)</h[123]>', note.content or '')
        if not headings:
            headings = text.split('.')[:5]
        graph = {
            "nodes": [{"id": "0", "label": note.title, "type": "central"}]
            + [{"id": str(i + 1), "label": h[:50], "type": "branch"} for i, h in enumerate(headings[:7])],
            "edges": [{"id": f"e0-{i + 1}", "source": "0", "target": str(i + 1)} for i in range(min(7, len(headings)))]
        }

    return {"note_id": str(note_id), "title": note.title, "graph": graph}
