"""Era Mail Advanced — AI triage, focused inbox, smart folders, FTS, calendar, cross-module routing."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select, update, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus

router = APIRouter()


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  Pydantic Schemas                                                          ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


class TriageRequest(BaseModel):
    limit: int = 50


class SenderScoreRequest(BaseModel):
    sender_email: str


class SmartFolderCreate(BaseModel):
    name: str
    query: dict = {}
    icon: str | None = "folder"
    is_ai_suggested: bool = False


class SearchFolderCreate(BaseModel):
    name: str
    query_string: str
    icon: str | None = "search"


class CategoryCreate(BaseModel):
    name: str
    color: str
    keyboard_shortcut: str | None = None


class QuickStepCreate(BaseModel):
    name: str
    icon: str | None = "zap"
    keyboard_shortcut: str | None = None
    actions: list[dict[str, Any]]


class QuickStepUpdate(BaseModel):
    name: str | None = None
    icon: str | None = None
    keyboard_shortcut: str | None = None
    actions: list[dict[str, Any]] | None = None


class FlagPayload(BaseModel):
    flag_status: str = "flagged"
    due_date: datetime | None = None
    reminder_at: datetime | None = None


class CategorizePayload(BaseModel):
    category_ids: list[str]


class TemplateCreate(BaseModel):
    name: str
    subject_template: str
    body_html_template: str
    variables: list[str] | None = None
    category: str | None = "custom"
    is_shared: bool = False


class TemplateUpdate(BaseModel):
    name: str | None = None
    subject_template: str | None = None
    body_html_template: str | None = None
    variables: list[str] | None = None
    category: str | None = None
    is_shared: bool | None = None


class TemplateRenderRequest(BaseModel):
    variables: dict[str, str]


class ThreadSummarizeRequest(BaseModel):
    message_ids: list[str]


class AIDraftRequest(BaseModel):
    message_id: str
    tone: str | None = "professional"
    instructions: str | None = None


class SharedMailboxCreate(BaseModel):
    email: str
    display_name: str
    member_ids: list[str]
    auto_assign_enabled: bool = False
    assignment_strategy: str | None = "round_robin"


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  Helpers                                                                    ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


async def _get_message_or_404(
    db: AsyncSession, message_id: str, user_id: uuid.UUID
) -> Any:
    """Fetch a MailboxMessage belonging to user or raise 404."""
    from app.models.mail_storage import MailboxMessage

    try:
        msg_uuid = uuid.UUID(message_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid message ID")

    result = await db.execute(
        select(MailboxMessage).where(
            MailboxMessage.id == msg_uuid,
            MailboxMessage.user_id == user_id,
        )
    )
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    return msg


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  1. AI Triage & Classification                                             ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


@router.post("/triage", summary="Triage inbox — batch classify unread messages")
async def triage_inbox(
    payload: TriageRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Batch-classify all unread inbox messages using AI + CRM/Support context."""
    from app.services.mail_triage import bulk_triage_inbox

    results = await bulk_triage_inbox(db, current_user.id, limit=payload.limit)
    return {"triaged_count": len(results), "results": results}


@router.post("/triage/{message_id}", summary="Classify a single message")
async def classify_single_message(
    message_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Classify a single message using AI + CRM/Support context."""
    from app.services.mail_triage import classify_email

    msg = await _get_message_or_404(db, message_id, current_user.id)
    result = await classify_email(
        db=db,
        message_id=msg.id,
        user_id=current_user.id,
        from_email=msg.from_addr,
        subject=msg.subject,
        body_text=msg.body_text,
    )
    return result


@router.get("/triage/summary", summary="Get triage summary counts by AI category")
async def triage_summary(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Return triage summary counts by ai_category for user's unread inbox."""
    from app.models.mail_storage import MailboxMessage

    result = await db.execute(
        select(
            MailboxMessage.ai_category,
            func.count().label("count"),
        )
        .where(
            MailboxMessage.user_id == current_user.id,
            MailboxMessage.folder == "INBOX",
            MailboxMessage.is_read.is_(False),
            MailboxMessage.is_deleted.is_(False),
            MailboxMessage.ai_category.isnot(None),
        )
        .group_by(MailboxMessage.ai_category)
    )
    rows = result.all()
    categories = {row[0]: row[1] for row in rows}

    # Also get total unread + un-triaged count
    untriaged_result = await db.execute(
        select(func.count()).where(
            MailboxMessage.user_id == current_user.id,
            MailboxMessage.folder == "INBOX",
            MailboxMessage.is_read.is_(False),
            MailboxMessage.is_deleted.is_(False),
            MailboxMessage.ai_category.is_(None),
        )
    )
    untriaged = untriaged_result.scalar() or 0

    return {
        "categories": categories,
        "untriaged": untriaged,
        "total_unread": sum(categories.values()) + untriaged,
    }


@router.post("/extract-actions/{message_id}", summary="Extract action items from message")
async def extract_actions(
    message_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Extract action items, deadlines, and meeting proposals from a message or thread."""
    import json as _json

    msg = await _get_message_or_404(db, message_id, current_user.id)

    try:
        from app.services.ai import AIService

        prompt = (
            "Extract action items from this email. Return a JSON array of objects, each with:\n"
            '- "action": description of the action\n'
            '- "assignee": who should do it (name or "me" if unclear)\n'
            '- "due_date": deadline if mentioned (ISO format or null)\n'
            '- "priority": "high", "medium", or "low"\n\n'
            f"Email:\nFrom: {msg.from_addr}\nSubject: {msg.subject}\n"
            f"Body:\n{msg.body_text[:2000]}\n\n"
            "Return ONLY the JSON array."
        )
        ai = AIService()
        response = await ai.generate(
            prompt=prompt,
            user_id=str(current_user.id),
            context={"tool": "mail_advanced"},
        )
        text = response.get("response", "[]")
        start = text.find("[")
        end = text.rfind("]") + 1
        actions = _json.loads(text[start:end]) if start >= 0 and end > start else []
    except Exception:
        actions = []

    return {"message_id": message_id, "actions": actions}


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  2. Focused Inbox                                                          ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


@router.get("/focused", summary="List focused inbox messages")
async def list_focused(
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """Messages with priority_score >= 0.6, folder=INBOX, not deleted."""
    from app.models.mail_storage import MailboxMessage

    offset = (page - 1) * limit
    base_q = select(MailboxMessage).where(
        MailboxMessage.user_id == current_user.id,
        MailboxMessage.folder == "INBOX",
        MailboxMessage.is_deleted.is_(False),
        MailboxMessage.priority_score >= 0.6,
    )

    count_result = await db.execute(select(func.count()).select_from(base_q.subquery()))
    total = count_result.scalar() or 0

    result = await db.execute(
        base_q.order_by(
            MailboxMessage.is_pinned.desc(),
            MailboxMessage.received_at.desc(),
        )
        .offset(offset)
        .limit(limit)
    )
    messages = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "messages": [m.to_summary_dict() for m in messages],
    }


@router.get("/other", summary="List 'Other' inbox messages")
async def list_other(
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """Messages with priority_score < 0.6 or NULL, folder=INBOX, not deleted."""
    from app.models.mail_storage import MailboxMessage

    offset = (page - 1) * limit
    base_q = select(MailboxMessage).where(
        MailboxMessage.user_id == current_user.id,
        MailboxMessage.folder == "INBOX",
        MailboxMessage.is_deleted.is_(False),
        (MailboxMessage.priority_score < 0.6) | (MailboxMessage.priority_score.is_(None)),
    )

    count_result = await db.execute(select(func.count()).select_from(base_q.subquery()))
    total = count_result.scalar() or 0

    result = await db.execute(
        base_q.order_by(
            MailboxMessage.is_pinned.desc(),
            MailboxMessage.received_at.desc(),
        )
        .offset(offset)
        .limit(limit)
    )
    messages = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "messages": [m.to_summary_dict() for m in messages],
    }


@router.post("/sender-score", summary="Compute/refresh sender score")
async def compute_sender_score(
    payload: SenderScoreRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Compute or refresh the focused inbox sender score for a given email."""
    from app.models.mail_storage import MailboxMessage
    from app.models.mail_advanced import FocusedInboxScore

    sender = payload.sender_email.lower().strip()

    # Count interactions
    interaction_count_result = await db.execute(
        select(func.count()).where(
            MailboxMessage.user_id == current_user.id,
            func.lower(MailboxMessage.from_addr) == sender,
        )
    )
    interaction_count = interaction_count_result.scalar() or 0

    # Check CRM context
    is_crm_contact = False
    has_open_deal = False
    has_open_ticket = False
    try:
        from app.models.crm import Contact, Deal

        contact_result = await db.execute(
            select(Contact).where(func.lower(Contact.email) == sender).limit(1)
        )
        contact = contact_result.scalar_one_or_none()
        if contact:
            is_crm_contact = True
            deal_result = await db.execute(
                select(func.count()).where(
                    Deal.contact_id == contact.id,
                    Deal.stage.notin_(["closed_won", "closed_lost"]),
                )
            )
            has_open_deal = (deal_result.scalar() or 0) > 0
    except Exception:
        pass

    try:
        from app.models.support import Ticket

        ticket_result = await db.execute(
            select(func.count()).where(
                func.lower(Ticket.requester_email) == sender,
                Ticket.status.notin_(["closed", "resolved"]),
            )
        )
        has_open_ticket = (ticket_result.scalar() or 0) > 0
    except Exception:
        pass

    # Compute importance score
    importance = min(1.0, 0.3 + (interaction_count * 0.02))
    if is_crm_contact:
        importance = min(1.0, importance + 0.15)
    if has_open_deal:
        importance = min(1.0, importance + 0.2)
    if has_open_ticket:
        importance = min(1.0, importance + 0.1)

    is_focused = importance >= 0.6

    # Upsert FocusedInboxScore
    result = await db.execute(
        select(FocusedInboxScore).where(
            FocusedInboxScore.user_id == current_user.id,
            FocusedInboxScore.sender_email == sender,
        )
    )
    score_row = result.scalar_one_or_none()

    if score_row:
        score_row.importance_score = importance
        score_row.interaction_count = interaction_count
        score_row.is_focused = is_focused
        score_row.has_open_deal = has_open_deal
        score_row.has_open_ticket = has_open_ticket
        score_row.is_crm_contact = is_crm_contact
        score_row.last_interaction = datetime.now(timezone.utc)
    else:
        score_row = FocusedInboxScore(
            user_id=current_user.id,
            sender_email=sender,
            importance_score=importance,
            interaction_count=interaction_count,
            is_focused=is_focused,
            has_open_deal=has_open_deal,
            has_open_ticket=has_open_ticket,
            is_crm_contact=is_crm_contact,
            last_interaction=datetime.now(timezone.utc),
        )
        db.add(score_row)

    await db.commit()

    return {
        "sender_email": sender,
        "importance_score": importance,
        "is_focused": is_focused,
        "interaction_count": interaction_count,
        "is_crm_contact": is_crm_contact,
        "has_open_deal": has_open_deal,
        "has_open_ticket": has_open_ticket,
    }


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  3. Smart Folders & Search Folders                                         ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


@router.get("/smart-folders", summary="List smart folders")
async def list_smart_folders(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.mail_advanced import SmartFolder

    result = await db.execute(
        select(SmartFolder)
        .where(SmartFolder.user_id == current_user.id)
        .order_by(SmartFolder.order)
    )
    folders = result.scalars().all()

    return {
        "total": len(folders),
        "smart_folders": [
            {
                "id": str(f.id),
                "name": f.name,
                "query": f.query_dsl,
                "icon": f.icon,
                "is_ai_generated": f.is_ai_generated,
            }
            for f in folders
        ],
    }


@router.post("/smart-folders", summary="Create smart folder", status_code=status.HTTP_201_CREATED)
async def create_smart_folder(
    payload: SmartFolderCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.mail_advanced import SmartFolder

    folder = SmartFolder(
        user_id=current_user.id,
        name=payload.name,
        query_dsl=payload.query,
        icon=payload.icon or "folder",
        is_ai_generated=payload.is_ai_suggested,
    )
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    return {"id": str(folder.id), "name": folder.name}


@router.delete("/smart-folders/{folder_id}", summary="Delete smart folder")
async def delete_smart_folder(
    folder_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.mail_advanced import SmartFolder

    folder = await db.get(SmartFolder, uuid.UUID(folder_id))
    if not folder or folder.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Smart folder not found")

    await db.delete(folder)
    await db.commit()
    return {"deleted": True}


@router.get("/search-folders", summary="List search folders")
async def list_search_folders(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.mail_advanced import SearchFolder

    result = await db.execute(
        select(SearchFolder)
        .where(SearchFolder.user_id == current_user.id)
        .order_by(SearchFolder.order)
    )
    folders = result.scalars().all()

    return {
        "total": len(folders),
        "search_folders": [
            {"id": str(f.id), "name": f.name, "query": f.query, "icon": f.icon}
            for f in folders
        ],
    }


@router.post("/search-folders", summary="Create search folder", status_code=status.HTTP_201_CREATED)
async def create_search_folder(
    payload: SearchFolderCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.mail_advanced import SearchFolder

    folder = SearchFolder(
        user_id=current_user.id,
        name=payload.name,
        query=payload.query_string,
        icon=payload.icon or "search",
    )
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    return {"id": str(folder.id), "name": folder.name}


@router.delete("/search-folders/{folder_id}", summary="Delete search folder")
async def delete_search_folder(
    folder_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.mail_advanced import SearchFolder

    folder = await db.get(SearchFolder, uuid.UUID(folder_id))
    if not folder or folder.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Search folder not found")

    await db.delete(folder)
    await db.commit()
    return {"deleted": True}


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  4. Full-Text Search                                                       ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


@router.get("/search", summary="Advanced full-text search")
async def advanced_search(
    current_user: CurrentUser,
    db: DBSession,
    q: str = Query("", description="Free-text search query"),
    from_addr: str | None = Query(None, description="Filter by sender email"),
    has_attachment: bool | None = Query(None, description="Filter by attachment presence"),
    is_unread: bool | None = Query(None, description="Filter unread only"),
    label: str | None = Query(None, description="Filter by label ID"),
    before: str | None = Query(None, description="Messages before this date (YYYY-MM-DD)"),
    after: str | None = Query(None, description="Messages after this date (YYYY-MM-DD)"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    """Advanced search with ILIKE on subject and body_text (tsvector upgrade is migration-level)."""
    from app.models.mail_storage import MailboxMessage

    offset = (page - 1) * limit

    base_q = select(MailboxMessage).where(
        MailboxMessage.user_id == current_user.id,
        MailboxMessage.is_deleted.is_(False),
    )

    # Free-text (ILIKE fallback)
    if q and q.strip():
        like_pattern = f"%{q.strip()}%"
        base_q = base_q.where(
            (MailboxMessage.subject.ilike(like_pattern))
            | (MailboxMessage.body_text.ilike(like_pattern))
        )

    if from_addr:
        base_q = base_q.where(func.lower(MailboxMessage.from_addr).contains(from_addr.lower()))

    if has_attachment is True:
        base_q = base_q.where(func.jsonb_array_length(MailboxMessage.attachments) > 0)
    elif has_attachment is False:
        base_q = base_q.where(
            (func.jsonb_array_length(MailboxMessage.attachments) == 0)
            | (MailboxMessage.attachments.is_(None))
        )

    if is_unread is True:
        base_q = base_q.where(MailboxMessage.is_read.is_(False))
    elif is_unread is False:
        base_q = base_q.where(MailboxMessage.is_read.is_(True))

    if label:
        base_q = base_q.where(MailboxMessage.label_ids.contains([label]))

    if before:
        try:
            before_dt = datetime.fromisoformat(before)
            base_q = base_q.where(MailboxMessage.received_at < before_dt)
        except ValueError:
            pass

    if after:
        try:
            after_dt = datetime.fromisoformat(after)
            base_q = base_q.where(MailboxMessage.received_at >= after_dt)
        except ValueError:
            pass

    # Count
    count_result = await db.execute(select(func.count()).select_from(base_q.subquery()))
    total = count_result.scalar() or 0

    # Paginated results
    result = await db.execute(
        base_q.order_by(MailboxMessage.received_at.desc()).offset(offset).limit(limit)
    )
    messages = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "messages": [m.to_summary_dict() for m in messages],
    }


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  5. Categories & Quick Steps                                               ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


@router.get("/categories", summary="List user categories")
async def list_categories(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.mail_advanced import MailCategory

    result = await db.execute(
        select(MailCategory).where(MailCategory.user_id == current_user.id)
    )
    cats = result.scalars().all()
    return {
        "total": len(cats),
        "categories": [
            {
                "id": str(c.id),
                "name": c.name,
                "color": c.color,
                "keyboard_shortcut": c.keyboard_shortcut,
            }
            for c in cats
        ],
    }


@router.post("/categories", summary="Create category", status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.mail_advanced import MailCategory

    cat = MailCategory(
        user_id=current_user.id,
        name=payload.name,
        color=payload.color,
        keyboard_shortcut=payload.keyboard_shortcut,
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return {"id": str(cat.id), "name": cat.name, "color": cat.color}


@router.delete("/categories/{cat_id}", summary="Delete category")
async def delete_category(
    cat_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.mail_advanced import MailCategory

    cat = await db.get(MailCategory, uuid.UUID(cat_id))
    if not cat or cat.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    await db.delete(cat)
    await db.commit()
    return {"deleted": True}


@router.get("/quick-steps", summary="List quick steps")
async def list_quick_steps(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.mail_advanced import MailQuickStep

    result = await db.execute(
        select(MailQuickStep)
        .where(MailQuickStep.user_id == current_user.id)
        .order_by(MailQuickStep.order)
    )
    steps = result.scalars().all()
    return {
        "total": len(steps),
        "quick_steps": [
            {
                "id": str(s.id),
                "name": s.name,
                "icon": s.icon,
                "keyboard_shortcut": s.keyboard_shortcut,
                "actions": s.actions,
            }
            for s in steps
        ],
    }


@router.post("/quick-steps", summary="Create quick step", status_code=status.HTTP_201_CREATED)
async def create_quick_step(
    payload: QuickStepCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.mail_advanced import MailQuickStep

    step = MailQuickStep(
        user_id=current_user.id,
        name=payload.name,
        icon=payload.icon or "zap",
        keyboard_shortcut=payload.keyboard_shortcut,
        actions=payload.actions,
    )
    db.add(step)
    await db.commit()
    await db.refresh(step)
    return {"id": str(step.id), "name": step.name}


@router.put("/quick-steps/{step_id}", summary="Update quick step")
async def update_quick_step(
    step_id: str,
    payload: QuickStepUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.mail_advanced import MailQuickStep

    step = await db.get(MailQuickStep, uuid.UUID(step_id))
    if not step or step.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quick step not found")

    if payload.name is not None:
        step.name = payload.name
    if payload.icon is not None:
        step.icon = payload.icon
    if payload.keyboard_shortcut is not None:
        step.keyboard_shortcut = payload.keyboard_shortcut
    if payload.actions is not None:
        step.actions = payload.actions

    await db.commit()
    await db.refresh(step)
    return {
        "id": str(step.id),
        "name": step.name,
        "icon": step.icon,
        "actions": step.actions,
    }


@router.delete("/quick-steps/{step_id}", summary="Delete quick step")
async def delete_quick_step(
    step_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.mail_advanced import MailQuickStep

    step = await db.get(MailQuickStep, uuid.UUID(step_id))
    if not step or step.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quick step not found")

    await db.delete(step)
    await db.commit()
    return {"deleted": True}


@router.post(
    "/quick-steps/{step_id}/execute/{message_id}",
    summary="Execute quick step on a message",
)
async def execute_quick_step(
    step_id: str,
    message_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Load quick step actions and apply them to a message via the rule engine action applier."""
    from app.models.mail_advanced import MailQuickStep
    from app.models.mail_storage import MailboxMessage

    step = await db.get(MailQuickStep, uuid.UUID(step_id))
    if not step or step.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quick step not found")

    msg = await _get_message_or_404(db, message_id, current_user.id)

    executed: list[dict[str, Any]] = []
    for action in step.actions:
        action_type = action.get("type", "")
        action_value = action.get("value", "")

        if action_type == "move":
            msg.folder = action_value
            executed.append({"type": "move", "to": action_value})
        elif action_type == "mark_read":
            msg.is_read = True
            executed.append({"type": "mark_read"})
        elif action_type == "mark_unread":
            msg.is_read = False
            executed.append({"type": "mark_unread"})
        elif action_type == "star":
            msg.is_starred = True
            executed.append({"type": "star"})
        elif action_type == "unstar":
            msg.is_starred = False
            executed.append({"type": "unstar"})
        elif action_type == "delete":
            msg.is_deleted = True
            executed.append({"type": "delete"})
        elif action_type == "flag":
            msg.flag_status = "flagged"
            executed.append({"type": "flag"})
        elif action_type == "unflag":
            msg.flag_status = "none"
            executed.append({"type": "unflag"})
        elif action_type == "label":
            labels = list(msg.label_ids or [])
            if action_value and action_value not in labels:
                labels.append(action_value)
                msg.label_ids = labels
            executed.append({"type": "label", "label": action_value})
        elif action_type == "categorize":
            cat_ids = list(msg.category_ids or [])
            if action_value not in cat_ids:
                cat_ids.append(action_value)
                msg.category_ids = cat_ids
            executed.append({"type": "categorize", "category": action_value})
        elif action_type == "pin":
            msg.is_pinned = True
            executed.append({"type": "pin"})

    await db.commit()
    return {
        "quick_step": step.name,
        "message_id": message_id,
        "actions_executed": executed,
    }


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  6. Pin, Flag, Categorize                                                  ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


@router.put("/message/{message_id}/pin", summary="Toggle pin on message")
async def toggle_pin(
    message_id: str,
    current_user: CurrentUser,
    db: DBSession,
    pinned: bool = Query(True, description="Set pinned state"),
) -> dict[str, Any]:
    msg = await _get_message_or_404(db, message_id, current_user.id)
    msg.is_pinned = pinned
    await db.commit()
    return {"message_id": message_id, "pinned": msg.is_pinned}


@router.put("/message/{message_id}/flag", summary="Set flag on message")
async def set_flag(
    message_id: str,
    payload: FlagPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    msg = await _get_message_or_404(db, message_id, current_user.id)
    msg.flag_status = payload.flag_status
    if payload.due_date:
        msg.flag_due_date = payload.due_date
    if payload.reminder_at:
        msg.flag_reminder_at = payload.reminder_at

    await db.commit()
    return {
        "message_id": message_id,
        "flag_status": msg.flag_status,
        "flag_due_date": msg.flag_due_date.isoformat() if msg.flag_due_date else None,
        "flag_reminder_at": msg.flag_reminder_at.isoformat() if msg.flag_reminder_at else None,
    }


@router.put("/message/{message_id}/categorize", summary="Set categories on message")
async def categorize_message(
    message_id: str,
    payload: CategorizePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    msg = await _get_message_or_404(db, message_id, current_user.id)
    msg.category_ids = payload.category_ids
    await db.commit()
    return {"message_id": message_id, "category_ids": msg.category_ids}


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  7. Templates                                                              ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


@router.get("/templates", summary="List mail templates")
async def list_templates(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.mail_advanced import MailTemplate

    result = await db.execute(
        select(MailTemplate).where(
            (MailTemplate.user_id == current_user.id) | (MailTemplate.is_shared.is_(True))
        )
    )
    templates = result.scalars().all()

    return {
        "total": len(templates),
        "templates": [
            {
                "id": str(t.id),
                "name": t.name,
                "subject_template": t.subject_template,
                "body_html_template": t.body_html_template,
                "variables": t.variables,
                "category": t.category,
                "is_shared": t.is_shared,
                "usage_count": t.usage_count,
            }
            for t in templates
        ],
    }


@router.post("/templates", summary="Create template", status_code=status.HTTP_201_CREATED)
async def create_template(
    payload: TemplateCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.mail_advanced import MailTemplate

    template = MailTemplate(
        user_id=current_user.id,
        name=payload.name,
        subject_template=payload.subject_template,
        body_html_template=payload.body_html_template,
        variables=payload.variables or [],
        category=payload.category or "custom",
        is_shared=payload.is_shared,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return {"id": str(template.id), "name": template.name}


@router.put("/templates/{template_id}", summary="Update template")
async def update_template(
    template_id: str,
    payload: TemplateUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.mail_advanced import MailTemplate

    template = await db.get(MailTemplate, uuid.UUID(template_id))
    if not template or template.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    if payload.name is not None:
        template.name = payload.name
    if payload.subject_template is not None:
        template.subject_template = payload.subject_template
    if payload.body_html_template is not None:
        template.body_html_template = payload.body_html_template
    if payload.variables is not None:
        template.variables = payload.variables
    if payload.category is not None:
        template.category = payload.category
    if payload.is_shared is not None:
        template.is_shared = payload.is_shared

    await db.commit()
    await db.refresh(template)
    return {
        "id": str(template.id),
        "name": template.name,
        "subject_template": template.subject_template,
        "body_html_template": template.body_html_template,
    }


@router.delete("/templates/{template_id}", summary="Delete template")
async def delete_template(
    template_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.mail_advanced import MailTemplate

    template = await db.get(MailTemplate, uuid.UUID(template_id))
    if not template or template.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    await db.delete(template)
    await db.commit()
    return {"deleted": True}


@router.post("/templates/{template_id}/render", summary="Render template with variables")
async def render_template(
    template_id: str,
    payload: TemplateRenderRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Render a template by replacing {{key}} placeholders with provided variable values."""
    from app.models.mail_advanced import MailTemplate

    template = await db.get(MailTemplate, uuid.UUID(template_id))
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    if template.user_id != current_user.id and not template.is_shared:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    subject = template.subject_template
    body = template.body_html_template

    for key, value in payload.variables.items():
        placeholder = "{{" + key + "}}"
        subject = subject.replace(placeholder, value)
        body = body.replace(placeholder, value)

    # Increment usage count
    template.usage_count = (template.usage_count or 0) + 1
    await db.commit()

    return {
        "template_id": str(template.id),
        "rendered_subject": subject,
        "rendered_body": body,
    }


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  8. Rule Testing & Execution                                               ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


@router.post("/rules/{rule_id}/test/{message_id}", summary="Test rule against message (dry run)")
async def test_rule_endpoint(
    rule_id: str,
    message_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Test a rule against a message without executing actions."""
    from app.services.mail_rule_engine import test_rule

    return await test_rule(
        db=db,
        user_id=current_user.id,
        rule_id=uuid.UUID(rule_id),
        message_id=uuid.UUID(message_id),
    )


@router.post("/rules/{rule_id}/run-now", summary="Run rule against all messages in a folder")
async def run_rule_now(
    rule_id: str,
    current_user: CurrentUser,
    db: DBSession,
    folder: str = Query("INBOX", description="Folder to apply rule to"),
    limit: int = Query(100, ge=1, le=500),
) -> dict[str, Any]:
    """Run a rule against all messages in a given folder."""
    from app.models.mail import MailRule
    from app.models.mail_storage import MailboxMessage
    from app.services.mail_rule_engine import apply_rules

    rule = await db.get(MailRule, uuid.UUID(rule_id))
    if not rule or rule.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")

    result = await db.execute(
        select(MailboxMessage).where(
            MailboxMessage.user_id == current_user.id,
            MailboxMessage.folder == folder,
            MailboxMessage.is_deleted.is_(False),
        ).limit(limit)
    )
    messages = result.scalars().all()

    total_actions = 0
    affected = 0
    for msg in messages:
        actions = await apply_rules(db, current_user.id, msg)
        if actions:
            affected += 1
            total_actions += len(actions)

    return {
        "rule_name": rule.name,
        "folder": folder,
        "messages_checked": len(messages),
        "messages_affected": affected,
        "actions_executed": total_actions,
    }


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  9. Calendar Integration                                                   ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


@router.post("/extract-calendar/{message_id}", summary="Extract calendar info from email")
async def extract_calendar(
    message_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Use AI to extract dates, times, participants, and location from an email."""
    import json as _json

    msg = await _get_message_or_404(db, message_id, current_user.id)

    try:
        from app.services.ai import AIService

        prompt = (
            "Extract calendar/scheduling information from this email. "
            "Return a JSON object with:\n"
            '- "has_event": true if email contains meeting/event info, false otherwise\n'
            '- "title": event title\n'
            '- "start_time": ISO datetime (or null)\n'
            '- "end_time": ISO datetime (or null)\n'
            '- "participants": list of email addresses or names\n'
            '- "location": location string (or null)\n\n'
            f"Email:\nFrom: {msg.from_addr}\nSubject: {msg.subject}\n"
            f"Body:\n{msg.body_text[:2000]}\n\n"
            "Return ONLY the JSON object."
        )
        ai = AIService()
        response = await ai.generate(
            prompt=prompt,
            user_id=str(current_user.id),
            context={"tool": "mail_advanced"},
        )
        text = response.get("response", "{}")
        start = text.find("{")
        end = text.rfind("}") + 1
        event_data = _json.loads(text[start:end]) if start >= 0 and end > start else {"has_event": False}
    except Exception:
        event_data = {"has_event": False}

    return {"message_id": message_id, "calendar_event": event_data}


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  10. Cross-Module Routing                                                  ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


@router.post("/create-ticket/{message_id}", summary="Create support ticket from email")
async def create_ticket_from_email(
    message_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Create a support ticket from an email and publish event."""
    msg = await _get_message_or_404(db, message_id, current_user.id)

    await event_bus.publish("mail.create_ticket", {
        "message_id": message_id,
        "subject": msg.subject,
        "body": msg.body_text[:5000],
        "from_email": msg.from_addr,
        "from_name": msg.from_name,
        "user_id": str(current_user.id),
    })

    # Also attempt direct creation
    try:
        from app.models.support import Ticket

        ticket = Ticket(
            subject=msg.subject,
            description=msg.body_text[:5000] or msg.body_html[:5000],
            requester_email=msg.from_addr,
            requester_name=msg.from_name,
            priority="medium",
            status="open",
            source="email",
            created_by=current_user.id,
        )
        db.add(ticket)
        await db.commit()
        await db.refresh(ticket)

        return {
            "created": True,
            "ticket_id": str(ticket.id),
            "subject": ticket.subject,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create ticket: {exc}",
        )


@router.post("/create-invoice/{message_id}", summary="Extract invoice data from email")
async def create_invoice_from_email(
    message_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Use AI to extract invoice data from an email for one-click invoice creation."""
    import json as _json

    msg = await _get_message_or_404(db, message_id, current_user.id)

    try:
        from app.services.ai import AIService

        prompt = (
            "Extract invoice data from this email. Return a JSON object with:\n"
            '- "vendor_name": company/person name\n'
            '- "vendor_email": email address\n'
            '- "invoice_number": invoice/reference number (or null)\n'
            '- "amount": total amount as number (or null)\n'
            '- "currency": currency code like USD, EUR (default "USD")\n'
            '- "due_date": due date in ISO format (or null)\n'
            '- "line_items": array of {"description": "...", "amount": 0.0} (or empty)\n'
            '- "has_invoice_content": true if email contains invoice info\n\n'
            f"Email:\nFrom: {msg.from_addr} ({msg.from_name})\n"
            f"Subject: {msg.subject}\nBody:\n{msg.body_text[:3000]}\n\n"
            "Return ONLY the JSON object."
        )
        ai = AIService()
        response = await ai.generate(
            prompt=prompt,
            user_id=str(current_user.id),
            context={"tool": "mail_advanced"},
        )
        text = response.get("response", "{}")
        start = text.find("{")
        end = text.rfind("}") + 1
        invoice_data = _json.loads(text[start:end]) if start >= 0 and end > start else {"has_invoice_content": False}
    except Exception:
        invoice_data = {"has_invoice_content": False}

    return {"message_id": message_id, "invoice_data": invoice_data}


@router.post("/create-crm-lead/{message_id}", summary="Create CRM lead from email sender")
async def create_crm_lead(
    message_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Create a CRM lead from the email sender and publish event."""
    msg = await _get_message_or_404(db, message_id, current_user.id)

    await event_bus.publish("mail.create_lead", {
        "message_id": message_id,
        "from_email": msg.from_addr,
        "from_name": msg.from_name,
        "subject": msg.subject,
        "user_id": str(current_user.id),
    })

    # Attempt direct lead creation
    try:
        from app.models.crm import Contact

        # Check if contact already exists
        existing = await db.execute(
            select(Contact).where(func.lower(Contact.email) == msg.from_addr.lower()).limit(1)
        )
        if existing.scalar_one_or_none():
            return {
                "created": False,
                "message": "Contact already exists in CRM",
                "email": msg.from_addr,
            }

        # Parse name parts
        name_parts = (msg.from_name or msg.from_addr.split("@")[0]).split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        contact = Contact(
            first_name=first_name,
            last_name=last_name,
            email=msg.from_addr,
            source="email",
            owner_id=current_user.id,
        )
        db.add(contact)
        await db.commit()
        await db.refresh(contact)

        return {
            "created": True,
            "contact_id": str(contact.id),
            "email": msg.from_addr,
            "name": msg.from_name,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create CRM lead: {exc}",
        )


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  11. Mail Analytics (Personal)                                             ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


@router.get("/analytics/overview", summary="Personal mail analytics overview")
async def analytics_overview(
    current_user: CurrentUser,
    db: DBSession,
    days: int = Query(30, ge=1, le=365),
) -> dict[str, Any]:
    """Personal mail analytics: sent/received counts, avg response time, unread count."""
    from app.models.mail_storage import MailboxMessage
    from datetime import timedelta

    since = datetime.now(timezone.utc) - timedelta(days=days)

    sent_result = await db.execute(
        select(func.count()).where(
            MailboxMessage.user_id == current_user.id,
            MailboxMessage.folder == "Sent",
            MailboxMessage.received_at >= since,
        )
    )
    sent_count = sent_result.scalar() or 0

    received_result = await db.execute(
        select(func.count()).where(
            MailboxMessage.user_id == current_user.id,
            MailboxMessage.folder == "INBOX",
            MailboxMessage.received_at >= since,
        )
    )
    received_count = received_result.scalar() or 0

    unread_result = await db.execute(
        select(func.count()).where(
            MailboxMessage.user_id == current_user.id,
            MailboxMessage.folder == "INBOX",
            MailboxMessage.is_read.is_(False),
        )
    )
    unread_count = unread_result.scalar() or 0

    # Avg response time: average difference between received_at of inbox
    # messages and sent_at of Sent messages with matching in_reply_to
    # Simplified: use average of (sent_at - received_at) for replied threads
    avg_response_minutes: float | None = None
    try:
        avg_result = await db.execute(
            text("""
                SELECT AVG(EXTRACT(EPOCH FROM (s.sent_at - r.received_at)) / 60)
                FROM mailbox_messages s
                JOIN mailbox_messages r
                    ON s.in_reply_to = r.message_id_header
                    AND s.user_id = r.user_id
                WHERE s.user_id = :user_id
                    AND s.folder = 'Sent'
                    AND s.sent_at IS NOT NULL
                    AND r.received_at >= :since
                    AND s.sent_at > r.received_at
            """),
            {"user_id": str(current_user.id), "since": since},
        )
        raw = avg_result.scalar()
        avg_response_minutes = round(float(raw), 1) if raw else None
    except Exception:
        pass

    return {
        "period_days": days,
        "sent_count": sent_count,
        "received_count": received_count,
        "avg_response_time_minutes": avg_response_minutes,
        "unread_count": unread_count,
    }


@router.get("/analytics/top-contacts", summary="Top contacts by email volume")
async def analytics_top_contacts(
    current_user: CurrentUser,
    db: DBSession,
    days: int = Query(30, ge=1, le=365),
) -> dict[str, Any]:
    """Top 10 contacts by email volume."""
    from app.models.mail_storage import MailboxMessage
    from datetime import timedelta

    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            MailboxMessage.from_addr,
            MailboxMessage.from_name,
            func.count().label("count"),
        )
        .where(
            MailboxMessage.user_id == current_user.id,
            MailboxMessage.folder == "INBOX",
            MailboxMessage.received_at >= since,
        )
        .group_by(MailboxMessage.from_addr, MailboxMessage.from_name)
        .order_by(func.count().desc())
        .limit(10)
    )
    rows = result.all()

    return {
        "period_days": days,
        "contacts": [
            {"email": r[0], "name": r[1], "count": r[2]}
            for r in rows
        ],
    }


@router.get("/analytics/hourly-heatmap", summary="Emails received by hour of day")
async def analytics_hourly_heatmap(
    current_user: CurrentUser,
    db: DBSession,
    days: int = Query(30, ge=1, le=365),
) -> dict[str, Any]:
    """Emails received by hour of day (0-23)."""
    from app.models.mail_storage import MailboxMessage
    from datetime import timedelta

    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            func.extract("hour", MailboxMessage.received_at).label("hour"),
            func.count().label("count"),
        )
        .where(
            MailboxMessage.user_id == current_user.id,
            MailboxMessage.folder == "INBOX",
            MailboxMessage.received_at >= since,
        )
        .group_by(func.extract("hour", MailboxMessage.received_at))
        .order_by("hour")
    )
    rows = result.all()

    # Fill all 24 hours (default 0)
    hour_map = {int(r[0]): r[1] for r in rows}
    heatmap = [{"hour": h, "count": hour_map.get(h, 0)} for h in range(24)]

    return {"period_days": days, "heatmap": heatmap}


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  12. AI Thread Summarization & Draft                                       ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


@router.post("/summarize-thread", summary="Summarize a mail thread")
async def summarize_thread(
    payload: ThreadSummarizeRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Load all messages by ID, send to AI, return a thread summary."""
    from app.models.mail_storage import MailboxMessage

    if not payload.message_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No message IDs provided")

    msg_uuids = []
    for mid in payload.message_ids:
        try:
            msg_uuids.append(uuid.UUID(mid))
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid message ID: {mid}")

    result = await db.execute(
        select(MailboxMessage)
        .where(
            MailboxMessage.id.in_(msg_uuids),
            MailboxMessage.user_id == current_user.id,
        )
        .order_by(MailboxMessage.received_at.asc())
    )
    messages = result.scalars().all()

    if not messages:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No messages found")

    # Build thread text
    thread_text_parts = []
    for m in messages:
        thread_text_parts.append(
            f"--- Message from {m.from_name} <{m.from_addr}> "
            f"({m.received_at.isoformat() if m.received_at else 'unknown date'}) ---\n"
            f"Subject: {m.subject}\n"
            f"{m.body_text[:1500]}\n"
        )
    thread_text = "\n".join(thread_text_parts)

    try:
        from app.services.ai import AIService

        prompt = (
            "Summarize this email thread concisely. Include key decisions, "
            "action items, and unresolved questions.\n\n"
            f"{thread_text[:6000]}"
        )
        ai = AIService()
        response = await ai.generate(
            prompt=prompt,
            user_id=str(current_user.id),
            context={"tool": "mail_advanced"},
        )
        summary = response.get("response", "Unable to generate summary.")
    except Exception as exc:
        summary = f"Summary unavailable: {exc}"

    return {
        "message_count": len(messages),
        "summary": summary,
    }


@router.post("/ai-draft", summary="Generate AI draft reply")
async def ai_draft_reply(
    payload: AIDraftRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Generate a full AI draft reply with Era context."""
    msg = await _get_message_or_404(db, payload.message_id, current_user.id)

    try:
        from app.services.ai import AIService

        tone_instruction = f"Use a {payload.tone} tone." if payload.tone else ""
        custom_instructions = f"\nAdditional instructions: {payload.instructions}" if payload.instructions else ""

        prompt = (
            f"Draft a reply to this email. {tone_instruction}{custom_instructions}\n\n"
            f"Original email:\n"
            f"From: {msg.from_name} <{msg.from_addr}>\n"
            f"Subject: {msg.subject}\n"
            f"Body:\n{msg.body_text[:2000]}\n\n"
            "Write a professional reply. Include a greeting and sign-off. "
            "Return ONLY the reply body text."
        )
        ai = AIService()
        response = await ai.generate(
            prompt=prompt,
            user_id=str(current_user.id),
            context={"tool": "mail_advanced"},
        )
        draft = response.get("response", "")
    except Exception as exc:
        draft = f"Draft generation failed: {exc}"

    return {
        "message_id": payload.message_id,
        "tone": payload.tone,
        "draft_body": draft,
    }


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  13. Shared Mailboxes (Admin)                                              ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


@router.get("/shared-mailboxes", summary="List shared mailboxes")
async def list_shared_mailboxes(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.mail_advanced import SharedMailbox

    result = await db.execute(select(SharedMailbox))
    mailboxes = result.scalars().all()

    return {
        "total": len(mailboxes),
        "shared_mailboxes": [
            {
                "id": str(mb.id),
                "email": mb.email,
                "display_name": mb.display_name,
                "member_ids": mb.member_ids,
                "auto_assign_mode": mb.auto_assign_mode,
                "auto_create_ticket": mb.auto_create_ticket,
                "auto_create_lead": mb.auto_create_lead,
            }
            for mb in mailboxes
        ],
    }


@router.post("/shared-mailboxes", summary="Create shared mailbox", status_code=status.HTTP_201_CREATED)
async def create_shared_mailbox(
    payload: SharedMailboxCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.mail_advanced import SharedMailbox

    # Check for duplicate email
    existing = await db.execute(
        select(SharedMailbox).where(SharedMailbox.email == payload.email).limit(1)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Shared mailbox with email '{payload.email}' already exists",
        )

    mailbox = SharedMailbox(
        email=payload.email,
        display_name=payload.display_name,
        member_ids=payload.member_ids,
        auto_assign_mode=payload.assignment_strategy or "round_robin",
        auto_assign_enabled=payload.auto_assign_enabled if hasattr(SharedMailbox, "auto_assign_enabled") else None,
        created_by=current_user.id,
    )
    db.add(mailbox)
    await db.commit()
    await db.refresh(mailbox)

    return {
        "id": str(mailbox.id),
        "email": mailbox.email,
        "display_name": mailbox.display_name,
    }


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  14. Contact Profiles                                                      ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


@router.get("/contacts/profiles", summary="List enriched contact profiles")
async def list_contact_profiles(
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    from app.models.mail_advanced import MailContactProfile

    offset = (page - 1) * limit

    base_q = select(MailContactProfile).where(
        MailContactProfile.user_id == current_user.id,
    )

    count_result = await db.execute(select(func.count()).select_from(base_q.subquery()))
    total = count_result.scalar() or 0

    result = await db.execute(
        base_q.order_by(MailContactProfile.last_email_at.desc().nullslast())
        .offset(offset)
        .limit(limit)
    )
    profiles = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "profiles": [
            {
                "id": str(p.id),
                "email": p.email,
                "display_name": p.display_name,
                "avatar_url": p.avatar_url,
                "title": p.title,
                "company": p.company,
                "phone": p.phone,
                "email_count": p.email_count,
                "last_email_at": p.last_email_at.isoformat() if p.last_email_at else None,
                "first_email_at": p.first_email_at.isoformat() if p.first_email_at else None,
                "avg_response_time_hours": p.avg_response_time_hours,
                "crm_contact_id": str(p.crm_contact_id) if p.crm_contact_id else None,
            }
            for p in profiles
        ],
    }


@router.get("/contacts/profile/{email:path}", summary="Get detailed contact profile")
async def get_contact_profile(
    email: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Get detailed contact profile with cross-module data (CRM, deals, invoices, tickets)."""
    from app.models.mail_advanced import MailContactProfile

    result = await db.execute(
        select(MailContactProfile).where(
            MailContactProfile.user_id == current_user.id,
            MailContactProfile.email == email,
        )
    )
    profile = result.scalar_one_or_none()

    profile_data: dict[str, Any] = {}
    if profile:
        profile_data = {
            "id": str(profile.id),
            "email": profile.email,
            "display_name": profile.display_name,
            "avatar_url": profile.avatar_url,
            "title": profile.title,
            "company": profile.company,
            "phone": profile.phone,
            "social_links": profile.social_links,
            "notes": profile.notes,
            "email_count": profile.email_count,
            "last_email_at": profile.last_email_at.isoformat() if profile.last_email_at else None,
            "first_email_at": profile.first_email_at.isoformat() if profile.first_email_at else None,
            "avg_response_time_hours": profile.avg_response_time_hours,
        }
    else:
        profile_data = {"email": email, "display_name": "", "exists": False}

    # Cross-module enrichment
    crm_data: dict[str, Any] = {"contact": None, "deals": []}
    try:
        from app.models.crm import Contact, Deal

        contact_result = await db.execute(
            select(Contact).where(func.lower(Contact.email) == email.lower()).limit(1)
        )
        crm_contact = contact_result.scalar_one_or_none()
        if crm_contact:
            crm_data["contact"] = {
                "id": str(crm_contact.id),
                "name": f"{crm_contact.first_name} {crm_contact.last_name}".strip(),
                "email": crm_contact.email,
            }
            deals_result = await db.execute(
                select(Deal).where(Deal.contact_id == crm_contact.id).limit(10)
            )
            deals = deals_result.scalars().all()
            crm_data["deals"] = [
                {
                    "id": str(d.id),
                    "name": d.name,
                    "stage": d.stage,
                    "value": float(d.value) if d.value else None,
                }
                for d in deals
            ]
    except Exception:
        pass

    # Support tickets
    tickets_data: list[dict[str, Any]] = []
    try:
        from app.models.support import Ticket

        tickets_result = await db.execute(
            select(Ticket)
            .where(func.lower(Ticket.requester_email) == email.lower())
            .order_by(Ticket.created_at.desc())
            .limit(5)
        )
        tickets = tickets_result.scalars().all()
        tickets_data = [
            {
                "id": str(t.id),
                "subject": t.subject,
                "status": t.status,
                "priority": t.priority,
            }
            for t in tickets
        ]
    except Exception:
        pass

    return {
        "profile": profile_data,
        "crm": crm_data,
        "tickets": tickets_data,
    }


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  15. Context-Aware AI Copilot (Phase 2)                                    ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


class ContextAwareDraftRequest(BaseModel):
    message_id: str
    tone: str | None = "professional"
    instructions: str | None = None
    include_era_context: bool = True


class ToneCheckRequest(BaseModel):
    text: str


class SmartComposeRequest(BaseModel):
    partial_text: str
    context_message_id: str | None = None


class MeetingPrepRequest(BaseModel):
    attendee_emails: list[str]


class TemplateRenderERPRequest(BaseModel):
    template_id: str
    contact_email: str | None = None
    deal_id: str | None = None
    invoice_id: str | None = None


class ScheduledSendRequest(BaseModel):
    message_id: str
    scheduled_at: datetime


class AIRuleConditionRequest(BaseModel):
    rule_id: str
    ai_condition: str  # Natural language condition, e.g. "if sender sounds frustrated"


@router.post("/ai-draft-context", summary="Generate AI draft with full Era ERP context")
async def ai_draft_with_context(
    payload: ContextAwareDraftRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Generate a full AI draft reply enriched with CRM, Finance, Projects, and Support data."""
    from app.services.mail_ai_copilot import context_aware_draft

    result = await context_aware_draft(
        db=db,
        user_id=current_user.id,
        message_id=uuid.UUID(payload.message_id),
        tone=payload.tone or "professional",
        instructions=payload.instructions,
    )
    return result


@router.post("/summarize-thread-enhanced", summary="Enhanced thread summarization with Era context")
async def summarize_thread_enhanced(
    payload: ThreadSummarizeRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Summarize a thread with structured output: summary, decisions, action items, questions."""
    from app.services.mail_ai_copilot import summarize_thread

    msg_uuids = []
    for mid in payload.message_ids:
        try:
            msg_uuids.append(uuid.UUID(mid))
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid ID: {mid}")

    result = await summarize_thread(db=db, user_id=current_user.id, message_ids=msg_uuids)
    return result


@router.post("/tone-check", summary="Analyze tone of draft text")
async def tone_check(
    payload: ToneCheckRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Analyze draft text for tone and provide suggestions."""
    from app.services.mail_ai_copilot import check_tone

    return await check_tone(db=db, user_id=current_user.id, text=payload.text)


@router.post("/smart-compose", summary="Smart compose autocomplete suggestion")
async def smart_compose(
    payload: SmartComposeRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Generate ghost text autocomplete while typing."""
    from app.services.mail_ai_copilot import smart_compose_suggest

    return await smart_compose_suggest(
        db=db,
        user_id=current_user.id,
        partial_text=payload.partial_text,
        context_message_id=uuid.UUID(payload.context_message_id) if payload.context_message_id else None,
    )


@router.get("/financial-ribbon/{sender_email:path}", summary="Financial Context Ribbon")
async def financial_ribbon(
    sender_email: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """The Financial Context Ribbon — shows real-time financial context for a sender."""
    from app.services.mail_ai_copilot import generate_financial_ribbon

    return await generate_financial_ribbon(db=db, user_id=current_user.id, sender_email=sender_email)


@router.post("/meeting-prep", summary="Generate meeting prep briefing")
async def meeting_prep(
    payload: MeetingPrepRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Pre-meeting briefing from Era data: recent emails, CRM, projects, support per attendee."""
    from app.services.mail_ai_copilot import generate_meeting_prep

    return await generate_meeting_prep(
        db=db,
        user_id=current_user.id,
        attendee_emails=payload.attendee_emails,
    )


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  16. Contact Intelligence (Phase 2)                                        ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


@router.post("/contacts/sync", summary="Sync contact profiles from email history")
async def sync_contacts(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Scan email history, create/update MailContactProfile records, enrich from CRM."""
    from app.services.mail_contact_intelligence import sync_contact_profiles

    return await sync_contact_profiles(db=db, user_id=current_user.id)


@router.get("/contacts/relationship/{email:path}", summary="Contact relationship data")
async def contact_relationship(
    email: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Relationship graph: email frequency trend, sentiment trend, thread count."""
    from app.services.mail_contact_intelligence import compute_relationship_graph

    return await compute_relationship_graph(db=db, user_id=current_user.id, email=email)


@router.post("/contacts/detect-duplicates", summary="Detect duplicate contacts")
async def detect_duplicates(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Find potential duplicate contacts between mail profiles and CRM."""
    from app.services.mail_contact_intelligence import detect_duplicates

    return await detect_duplicates(db=db, user_id=current_user.id)


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  17. ERP-Aware Template Rendering (Phase 2)                                ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


@router.post("/templates/{template_id}/render-erp", summary="Render template with live ERP data")
async def render_template_erp(
    template_id: str,
    payload: TemplateRenderERPRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Render a template by pulling live ERP data for {{crm.contact.name}}, {{finance.invoice.amount}}, etc."""
    from app.models.mail_advanced import MailTemplate

    template = await db.get(MailTemplate, uuid.UUID(template_id))
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    if template.user_id != current_user.id and not template.is_shared:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    subject = template.subject_template
    body = template.body_html_template

    # Pull CRM contact data
    if payload.contact_email:
        try:
            from app.models.crm import Contact
            crm_result = await db.execute(
                select(Contact).where(func.lower(Contact.email) == payload.contact_email.lower()).limit(1)
            )
            contact = crm_result.scalar_one_or_none()
            if contact:
                replacements = {
                    "{{crm.contact.name}}": f"{contact.first_name} {contact.last_name}".strip(),
                    "{{crm.contact.first_name}}": contact.first_name or "",
                    "{{crm.contact.last_name}}": contact.last_name or "",
                    "{{crm.contact.email}}": contact.email or "",
                    "{{crm.contact.company}}": getattr(contact, "company", "") or "",
                }
                for placeholder, value in replacements.items():
                    subject = subject.replace(placeholder, value)
                    body = body.replace(placeholder, value)
        except Exception:
            pass

    # Pull deal data
    if payload.deal_id:
        try:
            from app.models.crm import Deal
            deal = await db.get(Deal, uuid.UUID(payload.deal_id))
            if deal:
                replacements = {
                    "{{crm.deal.name}}": deal.name or "",
                    "{{crm.deal.stage}}": deal.stage or "",
                    "{{crm.deal.value}}": f"{deal.value:,.2f}" if deal.value else "0.00",
                }
                for placeholder, value in replacements.items():
                    subject = subject.replace(placeholder, value)
                    body = body.replace(placeholder, value)
        except Exception:
            pass

    # Pull invoice data
    if payload.invoice_id:
        try:
            from app.models.finance import Invoice
            invoice = await db.get(Invoice, uuid.UUID(payload.invoice_id))
            if invoice:
                replacements = {
                    "{{finance.invoice.number}}": getattr(invoice, "invoice_number", str(invoice.id)[:8]),
                    "{{finance.invoice.amount}}": f"{invoice.total_amount:,.2f}" if hasattr(invoice, "total_amount") else "0.00",
                    "{{finance.invoice.due_date}}": invoice.due_date.strftime("%B %d, %Y") if hasattr(invoice, "due_date") and invoice.due_date else "",
                    "{{finance.invoice.status}}": getattr(invoice, "status", ""),
                }
                for placeholder, value in replacements.items():
                    subject = subject.replace(placeholder, value)
                    body = body.replace(placeholder, value)
        except Exception:
            pass

    # Auto-fill common variables
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    common = {
        "{{date.today}}": now.strftime("%B %d, %Y"),
        "{{date.year}}": str(now.year),
    }
    for placeholder, value in common.items():
        subject = subject.replace(placeholder, value)
        body = body.replace(placeholder, value)

    template.usage_count = (template.usage_count or 0) + 1
    await db.commit()

    return {
        "template_id": str(template.id),
        "rendered_subject": subject,
        "rendered_body": body,
    }


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  18. Scheduled Send (Phase 2)                                              ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


@router.post("/schedule-send", summary="Schedule a draft for future sending")
async def schedule_send(
    payload: ScheduledSendRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Set scheduled_send_at on a draft message. Celery beat picks it up and sends it."""
    msg = await _get_message_or_404(db, payload.message_id, current_user.id)

    if msg.folder != "Drafts":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft messages can be scheduled",
        )

    if payload.scheduled_at <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scheduled time must be in the future",
        )

    msg.scheduled_send_at = payload.scheduled_at
    await db.commit()

    return {
        "message_id": payload.message_id,
        "scheduled_at": payload.scheduled_at.isoformat(),
        "status": "scheduled",
    }


@router.delete("/schedule-send/{message_id}", summary="Cancel scheduled send")
async def cancel_scheduled_send(
    message_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Cancel a scheduled send by clearing scheduled_send_at."""
    msg = await _get_message_or_404(db, message_id, current_user.id)

    if not msg.scheduled_send_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message is not scheduled")

    msg.scheduled_send_at = None
    await db.commit()

    return {"message_id": message_id, "status": "cancelled"}


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  19. AI-Powered Rule Conditions (Phase 2)                                  ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


@router.post("/rules/{rule_id}/ai-condition", summary="Add AI condition to a rule")
async def add_ai_rule_condition(
    rule_id: str,
    payload: AIRuleConditionRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Add a natural-language AI condition to a mail rule. The rule engine evaluates it via AI."""
    from app.models.mail import MailRule

    rule = await db.get(MailRule, uuid.UUID(rule_id))
    if not rule or rule.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")

    conditions = dict(rule.conditions or {})
    ai_conditions = conditions.get("ai_conditions", [])
    ai_conditions.append(payload.ai_condition)
    conditions["ai_conditions"] = ai_conditions
    rule.conditions = conditions

    await db.commit()

    return {
        "rule_id": rule_id,
        "ai_conditions": ai_conditions,
        "total_conditions": len(ai_conditions),
    }


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  20. Email Annotations (Internal Team Comments) (Phase 2)                  ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


class AnnotationCreate(BaseModel):
    content: str
    is_internal: bool = True


@router.get("/message/{message_id}/annotations", summary="List annotations on a message")
async def list_annotations(
    message_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """List internal team annotations/comments on a message."""
    from app.models.mail_advanced import MailAnnotation

    result = await db.execute(
        select(MailAnnotation)
        .where(MailAnnotation.message_id == uuid.UUID(message_id))
        .order_by(MailAnnotation.created_at.asc())
    )
    annotations = result.scalars().all()

    return {
        "message_id": message_id,
        "total": len(annotations),
        "annotations": [
            {
                "id": str(a.id),
                "user_id": str(a.user_id),
                "content": a.content,
                "is_internal": a.is_internal,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in annotations
        ],
    }


@router.post(
    "/message/{message_id}/annotations",
    summary="Add annotation to message",
    status_code=status.HTTP_201_CREATED,
)
async def create_annotation(
    message_id: str,
    payload: AnnotationCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Add an internal annotation/comment to a message (invisible to sender)."""
    from app.models.mail_advanced import MailAnnotation

    annotation = MailAnnotation(
        message_id=uuid.UUID(message_id),
        user_id=current_user.id,
        content=payload.content,
        is_internal=payload.is_internal,
    )
    db.add(annotation)
    await db.commit()
    await db.refresh(annotation)

    return {
        "id": str(annotation.id),
        "message_id": message_id,
        "content": annotation.content,
        "created_at": annotation.created_at.isoformat() if annotation.created_at else None,
    }


@router.delete("/annotations/{annotation_id}", summary="Delete annotation")
async def delete_annotation(
    annotation_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Delete an annotation (only the author can delete)."""
    from app.models.mail_advanced import MailAnnotation

    annotation = await db.get(MailAnnotation, uuid.UUID(annotation_id))
    if not annotation or annotation.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annotation not found")

    await db.delete(annotation)
    await db.commit()
    return {"deleted": True}
