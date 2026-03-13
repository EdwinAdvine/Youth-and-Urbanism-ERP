"""Notes → ERP conversion endpoints.

Converts a note into a Project Task, Support Ticket, Finance Invoice,
Calendar Event, or CRM Lead/Deal, and records a NoteEntityLink for each
conversion.

Router prefix: /notes/convert  (registered in api/v1/__init__.py)
"""

import re
import uuid
from datetime import datetime, date, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.config import settings
from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus

router = APIRouter()


# ── HTML stripper ─────────────────────────────────────────────────────────────

def _strip_html(content: str | None) -> str:
    """Remove all HTML tags and return clean plain text."""
    clean = re.sub(r"<[^>]+>", "", content or "").strip()
    return clean


# ── Note ownership guard ──────────────────────────────────────────────────────

async def _get_owned_note(db, note_id: uuid.UUID, user_id: uuid.UUID):
    from app.models.notes import Note  # noqa: PLC0415

    note = await db.get(Note, note_id)
    if not note or note.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


# ── Sequence generators ───────────────────────────────────────────────────────

async def _generate_ticket_number(db) -> str:
    """Generate TKT-YYYY-NNNN."""
    from app.models.support import Ticket  # noqa: PLC0415

    year = datetime.utcnow().year
    prefix = f"TKT-{year}-"
    result = await db.execute(
        select(func.count()).select_from(Ticket).where(Ticket.ticket_number.like(f"{prefix}%"))
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}{count:04d}"


async def _generate_invoice_number(db) -> str:
    """Generate INV-YYYY-NNNN."""
    from app.models.finance import Invoice  # noqa: PLC0415

    year = datetime.utcnow().year
    prefix = f"INV-{year}-"
    result = await db.execute(
        select(func.count()).select_from(Invoice).where(Invoice.invoice_number.like(f"{prefix}%"))
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}{count:04d}"


# ── AI title extractor ────────────────────────────────────────────────────────

async def _ai_extract_title(content: str, fallback: str) -> str:
    """Ask AI to extract or summarise a short title from note content.

    Falls back to ``fallback`` on any error (including AI unavailable).
    """
    clean = _strip_html(content)
    if not clean:
        return fallback

    prompt = (
        "Extract a concise task title (10 words or fewer) from the following note content. "
        "Reply with ONLY the title, nothing else.\n\n"
        f"{clean[:500]}"
    )
    try:
        from openai import AsyncOpenAI  # noqa: PLC0415

        provider = settings.AI_PROVIDER
        if provider == "anthropic":
            import anthropic  # noqa: PLC0415
            client = anthropic.AsyncAnthropic(api_key=settings.AI_API_KEY)
            resp = await client.messages.create(
                model=settings.AI_MODEL, max_tokens=64,
                messages=[{"role": "user", "content": prompt}],
            )
            title = resp.content[0].text.strip()
        else:
            client = AsyncOpenAI(api_key=settings.AI_API_KEY, base_url=settings.AI_BASE_URL)
            resp = await client.chat.completions.create(
                model=settings.AI_MODEL, max_tokens=64,
                messages=[{"role": "user", "content": prompt}],
            )
            title = (resp.choices[0].message.content or "").strip()
        return title or fallback
    except Exception:
        return fallback


# ── Pydantic request bodies ───────────────────────────────────────────────────

class ConvertToTaskBody(BaseModel):
    project_id: uuid.UUID
    title: str | None = None
    priority: str = "medium"
    assignee_id: uuid.UUID | None = None


class ConvertToTicketBody(BaseModel):
    title: str | None = None
    priority: str = "medium"
    category: str | None = None


class ConvertToInvoiceBody(BaseModel):
    client_name: str
    currency: str = "KES"
    notes: str | None = None


class ConvertToEventBody(BaseModel):
    title: str | None = None
    start_time: str  # ISO 8601 string
    end_time: str | None = None
    attendees: list[str] = []


class ConvertToDealBody(BaseModel):
    title: str | None = None
    contact_name: str | None = None
    value: float | None = None


# ── 1. Convert note → Project Task ────────────────────────────────────────────

@router.post(
    "/{note_id}/task",
    status_code=status.HTTP_201_CREATED,
    summary="Convert note to a Project Task",
)
async def convert_to_task(
    note_id: uuid.UUID,
    payload: ConvertToTaskBody,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    note = await _get_owned_note(db, note_id, current_user.id)

    from app.models.projects import Task  # noqa: PLC0415
    from app.models.notes import NoteEntityLink  # noqa: PLC0415

    # Derive title
    if payload.title:
        task_title = payload.title
    else:
        task_title = await _ai_extract_title(note.content, note.title or "Task from Note")

    clean_desc = _strip_html(note.content)

    task = Task(
        project_id=payload.project_id,
        title=task_title,
        description=clean_desc[:2000] if clean_desc else None,
        priority=payload.priority,
        assignee_id=payload.assignee_id,
        status="todo",
    )
    db.add(task)
    await db.flush()

    # Create entity link
    link = NoteEntityLink(
        note_id=note_id,
        entity_type="task",
        entity_id=task.id,
        link_type="created_from",
        created_by_id=current_user.id,
    )
    db.add(link)

    await db.commit()
    await db.refresh(task)

    await event_bus.publish("note.converted.task", {
        "note_id": str(note_id),
        "task_id": str(task.id),
        "project_id": str(payload.project_id),
        "user_id": str(current_user.id),
    })

    return {
        "task_id": str(task.id),
        "task_title": task.title,
        "project_id": str(payload.project_id),
    }


# ── 2. Convert note → Support Ticket ─────────────────────────────────────────

@router.post(
    "/{note_id}/ticket",
    status_code=status.HTTP_201_CREATED,
    summary="Convert note to a Support Ticket",
)
async def convert_to_ticket(
    note_id: uuid.UUID,
    payload: ConvertToTicketBody,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    note = await _get_owned_note(db, note_id, current_user.id)

    from app.models.support import Ticket  # noqa: PLC0415
    from app.models.notes import NoteEntityLink  # noqa: PLC0415

    ticket_number = await _generate_ticket_number(db)
    clean_desc = _strip_html(note.content)
    subject = payload.title or note.title or "Ticket from Note"

    ticket = Ticket(
        ticket_number=ticket_number,
        subject=subject,
        description=clean_desc[:3000] if clean_desc else None,
        priority=payload.priority,
        status="open",
        channel="web",
        created_by=current_user.id,
    )
    db.add(ticket)
    await db.flush()

    # Create entity link
    link = NoteEntityLink(
        note_id=note_id,
        entity_type="ticket",
        entity_id=ticket.id,
        link_type="created_from",
        created_by_id=current_user.id,
    )
    db.add(link)

    await db.commit()
    await db.refresh(ticket)

    await event_bus.publish("note.converted.ticket", {
        "note_id": str(note_id),
        "ticket_id": str(ticket.id),
        "ticket_number": ticket.ticket_number,
        "user_id": str(current_user.id),
    })

    return {
        "ticket_id": str(ticket.id),
        "ticket_number": ticket.ticket_number,
        "title": ticket.subject,
    }


# ── 3. Convert note → Finance Invoice ────────────────────────────────────────

@router.post(
    "/{note_id}/invoice",
    status_code=status.HTTP_201_CREATED,
    summary="Convert note to a Finance Invoice (draft)",
)
async def convert_to_invoice(
    note_id: uuid.UUID,
    payload: ConvertToInvoiceBody,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    note = await _get_owned_note(db, note_id, current_user.id)

    from app.models.finance import Invoice  # noqa: PLC0415
    from app.models.notes import NoteEntityLink  # noqa: PLC0415

    invoice_number = await _generate_invoice_number(db)
    clean_content = _strip_html(note.content)

    # Use provided notes or first 1000 chars of note content
    invoice_notes = payload.notes if payload.notes else (clean_content[:1000] if clean_content else None)

    today = date.today()
    invoice = Invoice(
        invoice_number=invoice_number,
        invoice_type="sales",
        status="draft",
        customer_name=payload.client_name,
        currency=payload.currency,
        issue_date=today,
        due_date=today + timedelta(days=30),
        notes=invoice_notes,
        owner_id=current_user.id,
    )
    db.add(invoice)
    await db.flush()

    # Create entity link
    link = NoteEntityLink(
        note_id=note_id,
        entity_type="invoice",
        entity_id=invoice.id,
        link_type="created_from",
        created_by_id=current_user.id,
    )
    db.add(link)

    await db.commit()
    await db.refresh(invoice)

    await event_bus.publish("note.converted.invoice", {
        "note_id": str(note_id),
        "invoice_id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "user_id": str(current_user.id),
    })

    return {
        "invoice_id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
    }


# ── 4. Convert note → Calendar Event ─────────────────────────────────────────

@router.post(
    "/{note_id}/event",
    status_code=status.HTTP_201_CREATED,
    summary="Convert note to a Calendar Event",
)
async def convert_to_event(
    note_id: uuid.UUID,
    payload: ConvertToEventBody,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    note = await _get_owned_note(db, note_id, current_user.id)

    from app.models.calendar import CalendarEvent  # noqa: PLC0415
    from app.models.notes import NoteEntityLink  # noqa: PLC0415

    event_title = payload.title or note.title or "Event from Note"
    clean_desc = _strip_html(note.content)

    try:
        start_time = datetime.fromisoformat(payload.start_time)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="start_time must be a valid ISO 8601 datetime string",
        )

    if payload.end_time:
        try:
            end_time = datetime.fromisoformat(payload.end_time)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="end_time must be a valid ISO 8601 datetime string",
            )
    else:
        end_time = start_time + timedelta(hours=1)

    event = CalendarEvent(
        title=event_title,
        description=clean_desc[:2000] if clean_desc else None,
        start_time=start_time,
        end_time=end_time,
        event_type="meeting",
        organizer_id=current_user.id,
        attendees=payload.attendees,
        color="#51459d",
    )
    db.add(event)
    await db.flush()

    # Create entity link
    link = NoteEntityLink(
        note_id=note_id,
        entity_type="calendar",
        entity_id=event.id,
        link_type="created_from",
        created_by_id=current_user.id,
    )
    db.add(link)

    await db.commit()
    await db.refresh(event)

    await event_bus.publish("note.converted.event", {
        "note_id": str(note_id),
        "event_id": str(event.id),
        "title": event.title,
        "user_id": str(current_user.id),
    })

    return {
        "event_id": str(event.id),
        "title": event.title,
        "start_time": event.start_time.isoformat(),
    }


# ── 5. Convert note → CRM Lead/Deal ──────────────────────────────────────────

@router.post(
    "/{note_id}/deal",
    status_code=status.HTTP_201_CREATED,
    summary="Convert note to a CRM Lead/Deal",
)
async def convert_to_deal(
    note_id: uuid.UUID,
    payload: ConvertToDealBody,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    note = await _get_owned_note(db, note_id, current_user.id)

    from app.models.crm import Lead  # noqa: PLC0415
    from app.models.notes import NoteEntityLink  # noqa: PLC0415

    lead_title = payload.title or note.title or "Lead from Note"
    clean_notes = _strip_html(note.content)

    lead = Lead(
        title=lead_title,
        status="new",
        source="notes",
        notes=clean_notes[:1000] if clean_notes else None,
        estimated_value=payload.value,
        owner_id=current_user.id,
    )
    db.add(lead)
    await db.flush()

    # Create entity link
    link = NoteEntityLink(
        note_id=note_id,
        entity_type="lead",
        entity_id=lead.id,
        link_type="created_from",
        created_by_id=current_user.id,
    )
    db.add(link)

    await db.commit()
    await db.refresh(lead)

    await event_bus.publish("note.converted.deal", {
        "note_id": str(note_id),
        "lead_id": str(lead.id),
        "title": lead.title,
        "user_id": str(current_user.id),
    })

    return {
        "deal_id": str(lead.id),
        "title": lead.title,
    }
