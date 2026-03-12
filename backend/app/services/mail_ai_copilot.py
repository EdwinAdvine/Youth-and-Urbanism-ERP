"""Era Mail — Context-Aware AI Copilot.

Provides AI-powered drafting, summarisation, tone analysis,
smart-compose, financial ribbon, and meeting-prep briefings
by pulling context from CRM, Finance, Projects, and Support modules.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import date
from typing import Any
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> dict[str, Any] | None:
    """Best-effort extraction of a JSON object from an AI response string."""
    try:
        start = text.index("{")
        end = text.rindex("}") + 1
        return json.loads(text[start:end])
    except (ValueError, json.JSONDecodeError):
        return None


async def _ai_call(db: AsyncSession, prompt: str, user_id: uuid.UUID) -> str:
    """Fire-and-forget AI chat call, returns the reply text."""
    from app.services.ai import AIService

    ai = AIService(db)
    reply_text, _, _ = await ai.chat(
        messages=[{"role": "user", "content": prompt}],
        user_id=user_id,
        session_id=f"mail_copilot_{uuid4().hex[:8]}",
    )
    return reply_text


# ---------------------------------------------------------------------------
# Context loaders (each wrapped in try/except for graceful degradation)
# ---------------------------------------------------------------------------

async def _load_message(db: AsyncSession, message_id: uuid.UUID) -> Any | None:
    from app.models.mail_storage import MailboxMessage

    result = await db.execute(
        select(MailboxMessage).where(MailboxMessage.id == message_id)
    )
    return result.scalar_one_or_none()


async def _crm_context_for_email(db: AsyncSession, email: str) -> dict[str, Any]:
    """Return CRM contact + deal info for an email address."""
    ctx: dict[str, Any] = {}
    try:
        from app.models.crm import Contact, Deal, Lead, Opportunity

        result = await db.execute(
            select(Contact).where(Contact.email == email).limit(1)
        )
        contact = result.scalar_one_or_none()
        if contact:
            ctx["contact"] = {
                "id": str(contact.id),
                "name": f"{contact.first_name or ''} {contact.last_name or ''}".strip(),
                "company": contact.company_name,
                "lifecycle_stage": contact.lifecycle_stage,
                "score": contact.score,
                "industry": contact.industry,
            }
            # Deals via Lead → Opportunity → Deal chain
            deal_result = await db.execute(
                select(Deal)
                .join(Opportunity, Deal.opportunity_id == Opportunity.id)
                .join(Lead, Opportunity.lead_id == Lead.id)
                .where(Lead.contact_id == contact.id)
                .order_by(Deal.close_date.desc())
                .limit(3)
            )
            deals = deal_result.scalars().all()
            if deals:
                ctx["deals"] = [
                    {
                        "title": d.title,
                        "value": str(d.deal_value),
                        "currency": d.currency,
                        "status": d.status,
                        "close_date": str(d.close_date),
                    }
                    for d in deals
                ]
    except Exception:
        logger.debug("CRM context lookup failed for %s", email, exc_info=True)

    # Fallback deal lookup by company name (only if Lead chain found nothing)
    try:
        from app.models.crm import Deal

        if "deals" not in ctx and "contact" in ctx and ctx["contact"].get("company"):
            company = ctx["contact"]["company"]
            deal_result = await db.execute(
                select(Deal)
                .where(Deal.title.ilike(f"%{company}%"))
                .order_by(Deal.close_date.desc())
                .limit(3)
            )
            deals = deal_result.scalars().all()
            if deals:
                ctx["deals"] = [
                    {
                        "title": d.title,
                        "value": str(d.deal_value),
                        "currency": d.currency,
                        "status": d.status,
                        "close_date": str(d.close_date),
                    }
                    for d in deals
                ]
    except Exception:
        logger.debug("CRM deal lookup failed", exc_info=True)

    return ctx


async def _finance_context_for_email(db: AsyncSession, email: str) -> dict[str, Any]:
    """Return outstanding invoices and payment info for a sender email."""
    ctx: dict[str, Any] = {}
    try:
        from app.models.finance import Invoice, Payment

        # Outstanding invoices
        inv_result = await db.execute(
            select(Invoice).where(
                Invoice.customer_email == email,
                Invoice.status.in_(["sent", "overdue"]),
            )
        )
        invoices = inv_result.scalars().all()
        if invoices:
            ctx["outstanding_invoices"] = [
                {
                    "number": inv.invoice_number,
                    "total": str(inv.total),
                    "currency": inv.currency,
                    "status": inv.status,
                    "due_date": str(inv.due_date),
                }
                for inv in invoices
            ]

        # Last payment
        pay_result = await db.execute(
            select(Payment)
            .join(Invoice, Payment.invoice_id == Invoice.id)
            .where(Invoice.customer_email == email)
            .order_by(Payment.payment_date.desc())
            .limit(1)
        )
        last_payment = pay_result.scalar_one_or_none()
        if last_payment:
            ctx["last_payment"] = {
                "amount": str(last_payment.amount),
                "date": str(last_payment.payment_date),
                "method": last_payment.payment_method,
            }

        # Total spent (all paid invoices)
        total_result = await db.execute(
            select(func.sum(Invoice.total)).where(
                Invoice.customer_email == email,
                Invoice.status == "paid",
            )
        )
        total_spent = total_result.scalar()
        if total_spent:
            ctx["total_spent"] = str(total_spent)

    except Exception:
        logger.debug("Finance context lookup failed for %s", email, exc_info=True)

    return ctx


async def _project_context_for_keywords(
    db: AsyncSession, sender_name: str, subject: str
) -> dict[str, Any]:
    """Find projects/tasks mentioning the sender or subject keywords."""
    ctx: dict[str, Any] = {}
    try:
        from app.models.projects import Project, Task

        search_terms = [t for t in (sender_name, subject) if t]
        projects: list[Any] = []
        for term in search_terms:
            if not term or len(term) < 3:
                continue
            result = await db.execute(
                select(Project)
                .where(
                    Project.name.ilike(f"%{term}%")
                    | Project.description.ilike(f"%{term}%")
                )
                .limit(3)
            )
            projects.extend(result.scalars().all())

        seen_ids: set[uuid.UUID] = set()
        unique_projects = []
        for p in projects:
            if p.id not in seen_ids:
                seen_ids.add(p.id)
                unique_projects.append(p)

        if unique_projects:
            ctx["related_projects"] = [
                {
                    "name": p.name,
                    "status": p.status,
                    "description": (p.description or "")[:200],
                }
                for p in unique_projects[:5]
            ]

        # Related tasks
        tasks: list[Any] = []
        for term in search_terms:
            if not term or len(term) < 3:
                continue
            result = await db.execute(
                select(Task)
                .where(Task.title.ilike(f"%{term}%"))
                .order_by(Task.created_at.desc())
                .limit(5)
            )
            tasks.extend(result.scalars().all())

        seen_task_ids: set[uuid.UUID] = set()
        unique_tasks = []
        for t in tasks:
            if t.id not in seen_task_ids:
                seen_task_ids.add(t.id)
                unique_tasks.append(t)

        if unique_tasks:
            ctx["related_tasks"] = [
                {
                    "title": t.title,
                    "status": t.status,
                    "priority": t.priority,
                }
                for t in unique_tasks[:5]
            ]

    except Exception:
        logger.debug("Project context lookup failed", exc_info=True)

    return ctx


async def _support_context_for_email(db: AsyncSession, email: str) -> dict[str, Any]:
    """Return open support tickets for a sender email."""
    ctx: dict[str, Any] = {}
    try:
        from app.models.support import Ticket

        result = await db.execute(
            select(Ticket).where(
                Ticket.customer_email == email,
                Ticket.status.in_(["open", "in_progress", "waiting"]),
            )
        )
        tickets = result.scalars().all()
        if tickets:
            ctx["open_tickets"] = [
                {
                    "number": t.ticket_number,
                    "subject": t.subject,
                    "status": t.status,
                    "priority": t.priority,
                }
                for t in tickets
            ]
    except Exception:
        logger.debug("Support context lookup failed for %s", email, exc_info=True)

    return ctx


# ---------------------------------------------------------------------------
# 1. Context-Aware Draft Reply
# ---------------------------------------------------------------------------

async def context_aware_draft(
    db: AsyncSession,
    user_id: uuid.UUID,
    message_id: uuid.UUID,
    tone: str = "professional",
    instructions: str = "",
) -> dict[str, Any]:
    """Generate a full draft reply enriched with cross-module ERP context.

    Parameters
    ----------
    tone : str
        One of ``professional``, ``casual``, ``empathetic``, ``direct``.
    instructions : str
        Free-form user instructions for the draft (e.g. "decline politely").

    Returns
    -------
    dict with keys: draft_html, draft_text, context_used, tone
    """
    try:
        msg = await _load_message(db, message_id)
        if not msg:
            return {
                "draft_html": "",
                "draft_text": "",
                "context_used": [],
                "tone": tone,
                "error": "Message not found",
            }

        sender_email = msg.from_addr
        sender_name = msg.from_name or sender_email

        # Gather context from all modules
        crm_ctx = await _crm_context_for_email(db, sender_email)
        finance_ctx = await _finance_context_for_email(db, sender_email)
        project_ctx = await _project_context_for_keywords(db, sender_name, msg.subject)
        support_ctx = await _support_context_for_email(db, sender_email)

        context_used: list[str] = []
        context_block = ""

        if crm_ctx:
            context_used.append("CRM")
            context_block += f"\n## CRM Context\n{json.dumps(crm_ctx, indent=2)}\n"
        if finance_ctx:
            context_used.append("Finance")
            context_block += f"\n## Finance Context\n{json.dumps(finance_ctx, indent=2)}\n"
        if project_ctx:
            context_used.append("Projects")
            context_block += f"\n## Project Context\n{json.dumps(project_ctx, indent=2)}\n"
        if support_ctx:
            context_used.append("Support")
            context_block += f"\n## Support Context\n{json.dumps(support_ctx, indent=2)}\n"

        prompt = f"""You are an AI email assistant for Urban ERP (Era Mail).
Draft a reply to the following email using a {tone} tone.

## Original Email
From: {sender_name} <{sender_email}>
Subject: {msg.subject}
Body:
{msg.body_text or msg.body_html}

{context_block}

## Instructions
{instructions or "Write an appropriate reply based on the context available."}

## Output Format
Return ONLY a JSON object with two keys:
- "draft_html": the reply body as clean HTML (use <p> tags, no full page structure)
- "draft_text": the reply body as plain text

Do NOT include a subject line. Only the body of the reply."""

        reply = await _ai_call(db, prompt, user_id)

        parsed = _extract_json(reply)
        if parsed:
            return {
                "draft_html": parsed.get("draft_html", ""),
                "draft_text": parsed.get("draft_text", ""),
                "context_used": context_used,
                "tone": tone,
            }

        # Fallback: treat the whole response as plain text
        return {
            "draft_html": f"<p>{reply}</p>",
            "draft_text": reply,
            "context_used": context_used,
            "tone": tone,
        }

    except Exception:
        logger.exception("context_aware_draft failed for message %s", message_id)
        return {
            "draft_html": "",
            "draft_text": "",
            "context_used": [],
            "tone": tone,
            "error": "Failed to generate draft",
        }


# ---------------------------------------------------------------------------
# 2. Enhanced Thread Summarisation
# ---------------------------------------------------------------------------

async def summarize_thread(
    db: AsyncSession,
    user_id: uuid.UUID,
    message_ids: list[uuid.UUID],
) -> dict[str, Any]:
    """Summarise an email thread with CRM context for participants.

    Returns
    -------
    dict with keys: summary, key_decisions, action_items,
                    unresolved_questions, sentiment_overview
    """
    try:
        from app.models.mail_storage import MailboxMessage

        result = await db.execute(
            select(MailboxMessage)
            .where(MailboxMessage.id.in_(message_ids))
            .order_by(MailboxMessage.received_at.asc())
        )
        messages = result.scalars().all()

        if not messages:
            return {
                "summary": "",
                "key_decisions": [],
                "action_items": [],
                "unresolved_questions": [],
                "sentiment_overview": "",
                "error": "No messages found",
            }

        # Build thread text
        thread_parts: list[str] = []
        participant_emails: set[str] = set()
        for m in messages:
            participant_emails.add(m.from_addr)
            thread_parts.append(
                f"--- From: {m.from_name or m.from_addr} ({m.from_addr}) "
                f"at {m.received_at} ---\n{m.body_text or m.body_html}\n"
            )
        thread_text = "\n".join(thread_parts)

        # CRM context for participants
        crm_context_parts: list[str] = []
        for email in participant_emails:
            crm_ctx = await _crm_context_for_email(db, email)
            if crm_ctx:
                crm_context_parts.append(f"  {email}: {json.dumps(crm_ctx)}")

        crm_block = ""
        if crm_context_parts:
            crm_block = "\n## Participant CRM Context\n" + "\n".join(crm_context_parts)

        prompt = f"""You are an AI email assistant for Urban ERP.
Analyse the following email thread and produce a structured summary.

## Email Thread ({len(messages)} messages)
{thread_text}
{crm_block}

## Output Format
Return ONLY a JSON object with these keys:
- "summary": a concise 2-4 sentence summary of the thread
- "key_decisions": list of strings — decisions made in the thread
- "action_items": list of strings — tasks or follow-ups mentioned
- "unresolved_questions": list of strings — open questions still unanswered
- "sentiment_overview": a short sentence describing the overall tone/sentiment"""

        reply = await _ai_call(db, prompt, user_id)

        parsed = _extract_json(reply)
        if parsed:
            return {
                "summary": parsed.get("summary", ""),
                "key_decisions": parsed.get("key_decisions", []),
                "action_items": parsed.get("action_items", []),
                "unresolved_questions": parsed.get("unresolved_questions", []),
                "sentiment_overview": parsed.get("sentiment_overview", ""),
            }

        return {
            "summary": reply,
            "key_decisions": [],
            "action_items": [],
            "unresolved_questions": [],
            "sentiment_overview": "",
        }

    except Exception:
        logger.exception("summarize_thread failed")
        return {
            "summary": "",
            "key_decisions": [],
            "action_items": [],
            "unresolved_questions": [],
            "sentiment_overview": "",
            "error": "Failed to summarise thread",
        }


# ---------------------------------------------------------------------------
# 3. Tone Analyser
# ---------------------------------------------------------------------------

async def check_tone(
    db: AsyncSession,
    user_id: uuid.UUID,
    text: str,
) -> dict[str, Any]:
    """Analyse the tone of a piece of text.

    Returns
    -------
    dict with keys: tone, confidence, suggestions, emoji_summary
    """
    try:
        prompt = f"""You are an AI tone analyser for Urban ERP's email system.
Analyse the following email text and determine its tone.

## Text
{text}

## Output Format
Return ONLY a JSON object with these keys:
- "tone": one of "professional", "casual", "aggressive", "passive", "empathetic"
- "confidence": a float between 0.0 and 1.0
- "suggestions": a list of 1-3 short improvement suggestions (strings)
- "emoji_summary": a single emoji that best represents the tone"""

        reply = await _ai_call(db, prompt, user_id)

        parsed = _extract_json(reply)
        if parsed:
            return {
                "tone": parsed.get("tone", "professional"),
                "confidence": float(parsed.get("confidence", 0.5)),
                "suggestions": parsed.get("suggestions", []),
                "emoji_summary": parsed.get("emoji_summary", ""),
            }

        return {
            "tone": "professional",
            "confidence": 0.0,
            "suggestions": ["Could not analyse tone — please try again."],
            "emoji_summary": "",
        }

    except Exception:
        logger.exception("check_tone failed")
        return {
            "tone": "unknown",
            "confidence": 0.0,
            "suggestions": [],
            "emoji_summary": "",
            "error": "Failed to analyse tone",
        }


# ---------------------------------------------------------------------------
# 4. Smart Compose (Ghost-Text Autocomplete)
# ---------------------------------------------------------------------------

async def smart_compose_suggest(
    db: AsyncSession,
    user_id: uuid.UUID,
    partial_text: str,
    context_message_id: uuid.UUID | None = None,
) -> dict[str, str]:
    """Generate a 1-3 word continuation for the text being typed.

    Returns
    -------
    dict with key: suggestion
    """
    try:
        context_hint = ""
        if context_message_id:
            msg = await _load_message(db, context_message_id)
            if msg:
                context_hint = (
                    f"\n\nThis is a reply to an email from {msg.from_name or msg.from_addr} "
                    f"with subject: {msg.subject}\n"
                    f"Original snippet: {(msg.body_text or '')[:300]}"
                )

        prompt = f"""You are an autocomplete engine for an email composer.
Given the partial text the user is typing, suggest the next 1-3 words
that naturally continue the sentence. Return ONLY the continuation words,
nothing else. No quotes, no punctuation beyond what naturally follows.

{context_hint}

Partial text: "{partial_text}"

Continuation:"""

        reply = await _ai_call(db, prompt, user_id)

        # Clean up — take only the first line, strip quotes
        suggestion = reply.strip().split("\n")[0].strip().strip('"').strip("'")
        # Limit to roughly 3 words
        words = suggestion.split()
        if len(words) > 4:
            suggestion = " ".join(words[:3])

        return {"suggestion": suggestion}

    except Exception:
        logger.exception("smart_compose_suggest failed")
        return {"suggestion": ""}


# ---------------------------------------------------------------------------
# 5. Financial Context Ribbon
# ---------------------------------------------------------------------------

async def generate_financial_ribbon(
    db: AsyncSession,
    user_id: uuid.UUID,
    sender_email: str,
) -> dict[str, Any]:
    """Build the Financial Context Ribbon data for a sender.

    Queries Finance, CRM, and Support modules to produce a rich
    at-a-glance ribbon shown in the mail reading pane.

    Returns
    -------
    dict with keys: open_invoices_count, open_invoices_total,
                    overdue_invoices_count, overdue_invoices_total,
                    last_payment_date, last_payment_amount,
                    total_lifetime_spent, deal_stage, deal_value,
                    lifetime_revenue, open_ticket_count, currency
    """
    ribbon: dict[str, Any] = {
        "sender_email": sender_email,
        "open_invoices_count": 0,
        "open_invoices_total": "0.00",
        "overdue_invoices_count": 0,
        "overdue_invoices_total": "0.00",
        "last_payment_date": None,
        "last_payment_amount": None,
        "total_lifetime_spent": "0.00",
        "deal_stage": None,
        "deal_value": None,
        "lifetime_revenue": "0.00",
        "open_ticket_count": 0,
        "currency": "USD",
    }

    # -- Finance: invoices ------------------------------------------------
    try:
        from app.models.finance import Invoice, Payment

        # Open (sent) invoices
        open_result = await db.execute(
            select(func.count(), func.coalesce(func.sum(Invoice.total), 0)).where(
                Invoice.customer_email == sender_email,
                Invoice.status == "sent",
            )
        )
        open_row = open_result.one()
        ribbon["open_invoices_count"] = open_row[0]
        ribbon["open_invoices_total"] = str(open_row[1])

        # Overdue invoices
        overdue_result = await db.execute(
            select(func.count(), func.coalesce(func.sum(Invoice.total), 0)).where(
                Invoice.customer_email == sender_email,
                Invoice.status == "overdue",
            )
        )
        overdue_row = overdue_result.one()
        ribbon["overdue_invoices_count"] = overdue_row[0]
        ribbon["overdue_invoices_total"] = str(overdue_row[1])

        # Last payment
        pay_result = await db.execute(
            select(Payment)
            .join(Invoice, Payment.invoice_id == Invoice.id)
            .where(Invoice.customer_email == sender_email)
            .order_by(Payment.payment_date.desc())
            .limit(1)
        )
        last_pay = pay_result.scalar_one_or_none()
        if last_pay:
            ribbon["last_payment_date"] = str(last_pay.payment_date)
            ribbon["last_payment_amount"] = str(last_pay.amount)

        # Total lifetime spent (paid invoices)
        total_result = await db.execute(
            select(func.coalesce(func.sum(Invoice.total), 0)).where(
                Invoice.customer_email == sender_email,
                Invoice.status == "paid",
            )
        )
        ribbon["total_lifetime_spent"] = str(total_result.scalar())

    except Exception:
        logger.debug("Financial ribbon: finance lookup failed for %s", sender_email, exc_info=True)

    # -- CRM: deal stage + lifetime revenue --------------------------------
    try:
        from app.models.crm import Contact, Deal

        contact_result = await db.execute(
            select(Contact).where(Contact.email == sender_email).limit(1)
        )
        contact = contact_result.scalar_one_or_none()

        if contact and contact.company_name:
            deal_result = await db.execute(
                select(Deal)
                .where(Deal.title.ilike(f"%{contact.company_name}%"))
                .order_by(Deal.close_date.desc())
                .limit(1)
            )
            latest_deal = deal_result.scalar_one_or_none()
            if latest_deal:
                ribbon["deal_stage"] = latest_deal.status
                ribbon["deal_value"] = str(latest_deal.deal_value)
                ribbon["currency"] = latest_deal.currency

            # Lifetime revenue from all deals
            rev_result = await db.execute(
                select(func.coalesce(func.sum(Deal.deal_value), 0)).where(
                    Deal.title.ilike(f"%{contact.company_name}%"),
                    Deal.status.in_(["active", "completed"]),
                )
            )
            ribbon["lifetime_revenue"] = str(rev_result.scalar())

    except Exception:
        logger.debug("Financial ribbon: CRM lookup failed for %s", sender_email, exc_info=True)

    # -- Support: open tickets --------------------------------------------
    try:
        from app.models.support import Ticket

        ticket_count_result = await db.execute(
            select(func.count()).where(
                Ticket.customer_email == sender_email,
                Ticket.status.in_(["open", "in_progress", "waiting"]),
            )
        )
        ribbon["open_ticket_count"] = ticket_count_result.scalar() or 0

    except Exception:
        logger.debug("Financial ribbon: support lookup failed for %s", sender_email, exc_info=True)

    return ribbon


# ---------------------------------------------------------------------------
# 6. Meeting Prep Briefing
# ---------------------------------------------------------------------------

async def generate_meeting_prep(
    db: AsyncSession,
    user_id: uuid.UUID,
    attendee_emails: list[str],
) -> dict[str, Any]:
    """Generate a meeting-prep briefing for each attendee.

    Pulls recent emails, CRM status, project tasks, and support tickets
    for every attendee and asks AI to produce a natural-language briefing.

    Returns
    -------
    dict with keys: briefing_text, attendees (list of per-attendee dicts)
    """
    try:
        from app.models.mail_storage import MailboxMessage

        attendee_details: list[dict[str, Any]] = []

        for email in attendee_emails:
            attendee_info: dict[str, Any] = {"email": email}

            # Recent emails
            try:
                mail_result = await db.execute(
                    select(MailboxMessage)
                    .where(MailboxMessage.from_addr == email)
                    .order_by(MailboxMessage.received_at.desc())
                    .limit(5)
                )
                recent_mails = mail_result.scalars().all()
                if recent_mails:
                    attendee_info["recent_emails"] = [
                        {
                            "subject": m.subject,
                            "date": str(m.received_at),
                            "snippet": (m.body_text or "")[:150],
                        }
                        for m in recent_mails
                    ]
            except Exception:
                logger.debug("Meeting prep: mail lookup failed for %s", email, exc_info=True)

            # CRM status
            crm_ctx = await _crm_context_for_email(db, email)
            if crm_ctx:
                attendee_info["crm"] = crm_ctx

            # Project tasks (search by email local part as a heuristic name match)
            local_part = email.split("@")[0].replace(".", " ").replace("_", " ")
            project_ctx = await _project_context_for_keywords(db, local_part, "")
            if project_ctx:
                attendee_info["projects"] = project_ctx

            # Support tickets
            support_ctx = await _support_context_for_email(db, email)
            if support_ctx:
                attendee_info["support"] = support_ctx

            attendee_details.append(attendee_info)

        # Build AI prompt
        attendee_block = json.dumps(attendee_details, indent=2, default=str)

        prompt = f"""You are an AI meeting-preparation assistant for Urban ERP.
Based on the following attendee data gathered from CRM, Finance, Projects,
Support, and recent emails, produce a concise briefing that a meeting
organiser can review before the meeting.

## Attendee Data
{attendee_block}

## Output Format
Return ONLY a JSON object with these keys:
- "briefing_text": a natural-language briefing (2-5 paragraphs, covering all attendees)
- "attendees": a list of objects, each with:
    - "email": the attendee email
    - "name": best-guess name (from CRM or email)
    - "key_points": list of 2-4 bullet-point strings about this attendee
    - "risk_flags": list of strings for anything to watch out for (overdue invoices, open tickets, etc.)"""

        reply = await _ai_call(db, prompt, user_id)

        parsed = _extract_json(reply)
        if parsed:
            return {
                "briefing_text": parsed.get("briefing_text", ""),
                "attendees": parsed.get("attendees", []),
            }

        return {
            "briefing_text": reply,
            "attendees": [{"email": e, "name": e, "key_points": [], "risk_flags": []} for e in attendee_emails],
        }

    except Exception:
        logger.exception("generate_meeting_prep failed")
        return {
            "briefing_text": "",
            "attendees": [],
            "error": "Failed to generate meeting prep briefing",
        }
