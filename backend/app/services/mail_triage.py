"""AI-powered email classification, priority scoring, and triage."""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


# ── Single-message classification ─────────────────────────────────────────────


async def classify_message(
    db: AsyncSession,
    message_id: uuid.UUID,
    user_id: uuid.UUID,
) -> dict[str, Any]:
    """Classify a single message using the configured AI provider.

    Reads the message from the database, asks the AI to classify it into one
    of the standard categories, generates a priority score, a 1-2 sentence
    summary, and a list of predicted actions.  Updates the MailboxMessage
    columns in-place and returns the classification dict.
    """
    from app.models.mail_storage import MailboxMessage

    result = await db.execute(
        select(MailboxMessage).where(MailboxMessage.id == message_id)
    )
    msg = result.scalar_one_or_none()
    if not msg:
        return {"error": "Message not found"}

    # Build CRM + support context for richer classification
    crm_ctx = await _get_crm_context(db, msg.from_addr)
    support_ctx = await _get_support_context(db, msg.from_addr)

    # Ask AI to classify
    prompt = _build_classification_prompt(
        from_email=msg.from_addr,
        subject=msg.subject,
        body_text=msg.body_text,
        crm_context=crm_ctx,
        support_context=support_ctx,
    )

    ai_result = await _call_ai(db, prompt, user_id)

    category = ai_result.get("category", "personal")
    urgency = ai_result.get("urgency", 0.5)
    summary = ai_result.get("summary", msg.subject[:100] if msg.subject else "")
    sentiment = ai_result.get("sentiment", "neutral")

    # Compute priority score
    priority_score = _compute_priority_score(
        ai_category=category,
        crm_context=crm_ctx,
        support_context=support_ctx,
        ai_urgency=urgency,
    )

    # Determine focused inbox status
    is_focused = (
        priority_score >= 0.6
        or crm_ctx.get("has_open_deal", False)
        or support_ctx.get("has_open_ticket", False)
    )

    # Predicted actions
    predicted_actions = _generate_predicted_actions(category, crm_ctx, support_ctx, msg.subject)

    # Update message record
    msg.ai_category = category
    msg.priority_score = priority_score
    msg.ai_summary = summary
    msg.ai_triage = {
        "category": category,
        "urgency": urgency,
        "sentiment": sentiment,
        "is_focused": is_focused,
        "crm_context": crm_ctx,
        "support_context": support_ctx,
    }
    msg.predicted_actions = predicted_actions

    try:
        await db.commit()
    except Exception as exc:
        logger.error("Failed to persist triage data for message %s: %s", message_id, exc)
        await db.rollback()

    # Update focused inbox score
    await compute_sender_score(db, user_id, msg.from_addr)

    return {
        "category": category,
        "priority_score": priority_score,
        "summary": summary,
        "predicted_actions": predicted_actions,
        "is_focused": is_focused,
        "sentiment": sentiment,
    }


# ── Batch triage ──────────────────────────────────────────────────────────────


async def triage_inbox(
    db: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 50,
) -> dict[str, Any]:
    """Batch triage: select unclassified messages and classify each.

    Returns a dict with the count of classified messages and a list of results.
    """
    from app.models.mail_storage import MailboxMessage

    result = await db.execute(
        select(MailboxMessage).where(
            MailboxMessage.user_id == user_id,
            MailboxMessage.ai_category.is_(None),
        ).order_by(MailboxMessage.received_at.desc()).limit(limit)
    )
    messages = result.scalars().all()

    results: list[dict[str, Any]] = []
    for msg in messages:
        triage_result = await classify_message(db=db, message_id=msg.id, user_id=user_id)
        results.append({"message_id": str(msg.id), **triage_result})

    return {"classified": len(results), "results": results}


# ── Sender score ──────────────────────────────────────────────────────────────


async def compute_sender_score(
    db: AsyncSession,
    user_id: uuid.UUID,
    sender_email: str,
) -> float:
    """Compute a focused-inbox importance score for a sender.

    Base score 0.5, with boosts:
      +0.2  if CRM contact
      +0.15 if open deal
      +0.1  if open support ticket
      +0.05 per 10 emails from sender (capped contribution)

    Score is capped at 1.0.  Creates or updates a FocusedInboxScore record.
    """
    from app.models.mail_advanced import FocusedInboxScore
    from app.models.mail_storage import MailboxMessage

    score = 0.5

    # CRM boost
    crm_ctx = await _get_crm_context(db, sender_email)
    if crm_ctx.get("is_contact"):
        score += 0.2
    if crm_ctx.get("has_open_deal"):
        score += 0.15

    # Support boost
    support_ctx = await _get_support_context(db, sender_email)
    if support_ctx.get("has_open_ticket"):
        score += 0.1

    # Email volume boost
    count_result = await db.execute(
        select(func.count()).where(
            MailboxMessage.user_id == user_id,
            MailboxMessage.from_addr == sender_email,
        )
    )
    email_count = count_result.scalar() or 0
    score += 0.05 * (email_count // 10)

    score = min(1.0, score)

    # Upsert FocusedInboxScore
    result = await db.execute(
        select(FocusedInboxScore).where(
            FocusedInboxScore.user_id == user_id,
            FocusedInboxScore.sender_email == sender_email,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.importance_score = score
        existing.interaction_count += 1
        existing.last_interaction = datetime.now(timezone.utc)
        existing.is_focused = score >= 0.6
        existing.has_open_deal = crm_ctx.get("has_open_deal", False)
        existing.has_open_ticket = support_ctx.get("has_open_ticket", False)
        existing.is_crm_contact = crm_ctx.get("is_contact", False)
    else:
        new_record = FocusedInboxScore(
            user_id=user_id,
            sender_email=sender_email,
            importance_score=score,
            interaction_count=1,
            last_interaction=datetime.now(timezone.utc),
            is_focused=score >= 0.6,
            has_open_deal=crm_ctx.get("has_open_deal", False),
            has_open_ticket=support_ctx.get("has_open_ticket", False),
            is_crm_contact=crm_ctx.get("is_contact", False),
        )
        db.add(new_record)

    try:
        await db.commit()
    except Exception as exc:
        logger.error("Failed to update FocusedInboxScore for %s: %s", sender_email, exc)
        await db.rollback()

    return score


# ── Action-item extraction ────────────────────────────────────────────────────


async def extract_action_items(
    db: AsyncSession,
    message_id: uuid.UUID,
    user_id: uuid.UUID,
) -> list[dict]:
    """Use AI to extract action items from an email thread.

    Returns a list of dicts: [{action, due_date, assignee_hint}, ...].
    """
    from app.models.mail_storage import MailboxMessage

    result = await db.execute(
        select(MailboxMessage).where(MailboxMessage.id == message_id)
    )
    msg = result.scalar_one_or_none()
    if not msg:
        return []

    # Build thread context from references
    thread_text = f"Subject: {msg.subject}\nFrom: {msg.from_addr}\n\n{msg.body_text}"

    # If there are referenced messages, include them for context
    if msg.in_reply_to:
        ref_result = await db.execute(
            select(MailboxMessage).where(
                MailboxMessage.user_id == msg.user_id,
                MailboxMessage.message_id_header == msg.in_reply_to,
            ).limit(1)
        )
        ref_msg = ref_result.scalar_one_or_none()
        if ref_msg:
            thread_text = (
                f"--- Earlier message ---\n"
                f"Subject: {ref_msg.subject}\nFrom: {ref_msg.from_addr}\n{ref_msg.body_text}\n\n"
                f"--- Latest message ---\n{thread_text}"
            )

    prompt = f"""Extract action items from this email thread.

{thread_text[:2000]}

Return a JSON array of action items. Each item should have:
- "action": a clear, concise description of the action required
- "due_date": an ISO date string if mentioned or implied (null if none)
- "assignee_hint": who should handle this (name/email if mentioned, null otherwise)

Return ONLY the JSON array, no other text. If no action items, return []."""

    ai_result = await _call_ai(db, prompt, user_id)

    # The AI response might be a dict with a wrapping key, or directly a list
    if isinstance(ai_result, list):
        return ai_result
    if isinstance(ai_result, dict) and "actions" in ai_result:
        return ai_result["actions"]
    if isinstance(ai_result, dict) and "items" in ai_result:
        return ai_result["items"]

    return []


# ── Internal helpers ──────────────────────────────────────────────────────────


def _build_classification_prompt(
    from_email: str,
    subject: str,
    body_text: str,
    crm_context: dict,
    support_context: dict,
) -> str:
    """Build the prompt for AI email classification."""
    crm_desc = (
        "Known contact with open deals"
        if crm_context.get("has_open_deal")
        else "Known CRM contact"
        if crm_context.get("is_contact")
        else "Unknown sender"
    )
    support_desc = (
        "Has open support tickets"
        if support_context.get("has_open_ticket")
        else "No open tickets"
    )

    return f"""Classify this email into one category and provide analysis.

From: {from_email}
Subject: {subject}
Body (first 500 chars): {body_text[:500]}

CRM Context: {crm_desc}
Support Context: {support_desc}

Return a JSON object with these fields:
- "category": one of "finance-invoice", "support-request", "deal-related", "project-update", "meeting-request", "personal", "newsletter", "spam-suspect"
- "urgency": float 0.0-1.0 (how urgent is this email?)
- "sentiment": one of "positive", "neutral", "negative", "frustrated"
- "summary": one-sentence summary of the email (max 100 chars)

Return ONLY the JSON object, no other text."""


async def _call_ai(db: AsyncSession, prompt: str, user_id: uuid.UUID) -> dict[str, Any] | list:
    """Call the active AI provider and parse JSON from the response."""
    try:
        from app.services.ai import AIService

        ai = AIService(db)
        reply_text, _provider, _model = await ai.chat(
            messages=[{"role": "user", "content": prompt}],
            user_id=user_id,
            session_id=f"mail_triage_{uuid.uuid4().hex[:8]}",
        )

        # Extract JSON from response
        start = reply_text.find("{")
        bracket_start = reply_text.find("[")

        # Use whichever comes first (object or array)
        if bracket_start >= 0 and (start < 0 or bracket_start < start):
            end = reply_text.rfind("]") + 1
            if end > bracket_start:
                return json.loads(reply_text[bracket_start:end])
        elif start >= 0:
            end = reply_text.rfind("}") + 1
            if end > start:
                return json.loads(reply_text[start:end])

    except Exception as exc:
        logger.error("AI call failed during mail triage: %s", exc)

    return {
        "category": "personal",
        "urgency": 0.5,
        "sentiment": "neutral",
        "summary": "",
    }


async def _get_crm_context(db: AsyncSession, sender_email: str) -> dict[str, Any]:
    """Check if sender exists in CRM and has open deals."""
    context: dict[str, Any] = {
        "is_contact": False,
        "has_open_deal": False,
        "deal_count": 0,
        "total_deal_value": 0.0,
        "contact_name": "",
    }

    try:
        from app.models.crm import Contact

        result = await db.execute(
            select(Contact).where(
                func.lower(Contact.email) == sender_email.lower()
            ).limit(1)
        )
        contact = result.scalar_one_or_none()

        if contact:
            context["is_contact"] = True
            context["contact_name"] = f"{contact.first_name} {contact.last_name}".strip()

            from app.models.crm import Deal

            deals_result = await db.execute(
                select(func.count(), func.coalesce(func.sum(Deal.value), 0)).where(
                    Deal.contact_id == contact.id,
                    Deal.stage.notin_(["closed_won", "closed_lost"]),
                )
            )
            deal_row = deals_result.one_or_none()
            if deal_row:
                context["deal_count"] = deal_row[0]
                context["total_deal_value"] = float(deal_row[1])
                context["has_open_deal"] = deal_row[0] > 0

    except Exception as exc:
        logger.debug("CRM context lookup failed: %s", exc)

    return context


async def _get_support_context(db: AsyncSession, sender_email: str) -> dict[str, Any]:
    """Check if sender has open support tickets."""
    context: dict[str, Any] = {
        "has_open_ticket": False,
        "open_ticket_count": 0,
        "latest_ticket_subject": "",
    }

    try:
        from app.models.support import Ticket

        result = await db.execute(
            select(func.count(), func.max(Ticket.subject)).where(
                func.lower(Ticket.requester_email) == sender_email.lower(),
                Ticket.status.notin_(["closed", "resolved"]),
            )
        )
        row = result.one_or_none()
        if row and row[0] > 0:
            context["has_open_ticket"] = True
            context["open_ticket_count"] = row[0]
            context["latest_ticket_subject"] = row[1] or ""

    except Exception as exc:
        logger.debug("Support context lookup failed: %s", exc)

    return context


def _compute_priority_score(
    ai_category: str,
    crm_context: dict,
    support_context: dict,
    ai_urgency: float,
) -> float:
    """Compute a 0-1 priority score from AI urgency + ERP context."""
    score = ai_urgency * 0.4  # Base from AI urgency

    # Category weights
    category_boosts = {
        "finance-invoice": 0.2,
        "support-request": 0.15,
        "deal-related": 0.2,
        "meeting-request": 0.1,
        "project-update": 0.1,
        "personal": 0.05,
        "newsletter": -0.2,
        "spam-suspect": -0.3,
    }
    score += category_boosts.get(ai_category, 0.0)

    # CRM boosts
    if crm_context.get("has_open_deal"):
        score += 0.2
        deal_value = crm_context.get("total_deal_value", 0)
        if deal_value > 50000:
            score += 0.1
        elif deal_value > 10000:
            score += 0.05
    elif crm_context.get("is_contact"):
        score += 0.1

    # Support boosts
    if support_context.get("has_open_ticket"):
        score += 0.15

    return max(0.0, min(1.0, score))


def _generate_predicted_actions(
    category: str,
    crm_context: dict,
    support_context: dict,
    subject: str,
) -> list[dict[str, str]]:
    """Generate context-aware predicted actions for the action bar."""
    actions: list[dict[str, str]] = []

    if category == "finance-invoice":
        actions.extend([
            {"type": "create_invoice", "label": "Create Invoice", "icon": "receipt"},
            {"type": "link_crm", "label": "Link to CRM", "icon": "users"},
            {"type": "reply", "label": "Confirm Receipt", "icon": "check"},
        ])
    elif category == "support-request":
        actions.extend([
            {"type": "create_ticket", "label": "Create Ticket", "icon": "ticket"},
            {"type": "reply", "label": "Reply", "icon": "reply"},
        ])
        if crm_context.get("has_open_deal"):
            actions.append({"type": "escalate", "label": "Escalate (VIP)", "icon": "alert-triangle"})
    elif category == "deal-related":
        actions.extend([
            {"type": "link_crm", "label": "Link to Deal", "icon": "briefcase"},
            {"type": "create_task", "label": "Create Follow-up", "icon": "check-square"},
            {"type": "reply", "label": "Reply", "icon": "reply"},
        ])
    elif category == "meeting-request":
        actions.extend([
            {"type": "add_to_calendar", "label": "Add to Calendar", "icon": "calendar"},
            {"type": "reply", "label": "Accept/Decline", "icon": "reply"},
        ])
    elif category == "project-update":
        actions.extend([
            {"type": "create_task", "label": "Create Task", "icon": "check-square"},
            {"type": "save_note", "label": "Save as Note", "icon": "file-text"},
        ])
    else:
        actions.extend([
            {"type": "reply", "label": "Reply", "icon": "reply"},
            {"type": "archive", "label": "Archive", "icon": "archive"},
        ])

    if support_context.get("has_open_ticket"):
        actions.insert(0, {"type": "view_ticket", "label": "View Ticket", "icon": "ticket"})

    return actions[:4]  # Max 4 actions
