"""Mail Calendar Scanner — detects scheduling intent in Era Mail messages.

Uses the local Ollama instance to analyse email subject + body and extract
structured event data (date, time, duration, attendees, location, title).

Public API
----------
scan_mail_for_scheduling_intent(message_id, db)
    Analyse one MailboxMessage and return a scheduling-intent result dict.

batch_scan_recent_mail(user_id, db, hours=24)
    Scan all unscanned messages received in the last N hours for a user.

on_mail_received_calendar(data)
    Event-bus handler for "mail.received" — auto-publishes
    "calendar.suggestion.created" when confidence > 0.7.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.events import event_bus

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

OLLAMA_TIMEOUT = 120  # seconds
_SCANNED_FLAG_KEY = "calendar_scan"  # key checked/set in ai_triage JSONB

# System prompt fed to Ollama so it stays focused on scheduling extraction
_SYSTEM_PROMPT = (
    "You are a scheduling assistant embedded in an enterprise ERP. "
    "Your only job is to read an email and determine whether it contains "
    "a scheduling or meeting request. If it does, extract the details. "
    "Always respond with valid JSON and nothing else."
)

# Extraction prompt template — subject and body are interpolated at call time
_EXTRACTION_PROMPT_TEMPLATE = """\
Analyse the following email and extract scheduling information.

Subject: {subject}

Body:
{body}

Respond ONLY with a JSON object that matches this exact schema:
{{
  "has_scheduling_intent": true | false,
  "confidence": <float 0.0-1.0>,
  "suggested_event": {{
    "title": "<meeting title or email subject>",
    "date": "<YYYY-MM-DD or null>",
    "time": "<HH:MM 24h or null>",
    "duration_minutes": <integer or null>,
    "attendees": ["<email or name>"],
    "location": "<location string or null>"
  }}
}}

Rules:
- Set has_scheduling_intent to false and confidence to 0.0 when no scheduling
  language is present (newsletters, receipts, notifications, etc.).
- confidence should reflect how certain you are that this is a meeting request.
- If no explicit date/time is mentioned, still return the title and attendees.
- suggested_event may be null when has_scheduling_intent is false.
"""


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _call_ollama(prompt: str) -> str:
    """POST prompt to local Ollama /api/generate. Returns the response text."""
    url = f"{settings.OLLAMA_URL.rstrip('/')}/api/generate"
    payload: dict[str, Any] = {
        "model": settings.OLLAMA_MODEL,
        "prompt": prompt,
        "system": _SYSTEM_PROMPT,
        "stream": False,
    }
    async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data.get("response", "")


def _parse_ollama_response(raw: str) -> dict[str, Any]:
    """Extract the JSON object from Ollama's text response.

    Ollama sometimes wraps JSON in markdown code fences; this strips them.
    Returns a dict — never raises.
    """
    text = raw.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.splitlines()
        # Remove first and last fence lines
        inner = [
            ln for ln in lines
            if not ln.startswith("```")
        ]
        text = "\n".join(inner).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Attempt to find the first {...} block
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass
    return {}


def _build_event_times(
    date_str: str | None,
    time_str: str | None,
    duration_minutes: int | None,
) -> tuple[str | None, str | None]:
    """Convert extracted date/time/duration into ISO datetime strings.

    Returns (start_time_iso, end_time_iso). Either may be None when the
    source data is missing or unparseable.
    """
    if not date_str:
        return None, None

    now = datetime.now(timezone.utc)
    time_part = time_str or "09:00"
    duration = duration_minutes or 60

    try:
        start = datetime.fromisoformat(f"{date_str}T{time_part}:00")
        # Interpret naive datetime as UTC
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        end = start + timedelta(minutes=duration)
        return start.isoformat(), end.isoformat()
    except (ValueError, TypeError):
        logger.debug("Could not parse date=%s time=%s", date_str, time_str)
        return None, None


# ---------------------------------------------------------------------------
# Core scanning function
# ---------------------------------------------------------------------------

async def scan_mail_for_scheduling_intent(
    message_id: str,
    db: AsyncSession,
) -> dict[str, Any]:
    """Scan a single MailboxMessage for scheduling intent.

    Parameters
    ----------
    message_id:
        UUID string of the MailboxMessage row.
    db:
        Active async SQLAlchemy session.

    Returns
    -------
    dict with keys:
        has_scheduling_intent (bool)
        confidence (float)
        suggested_event (dict | None)
            title, start_time, end_time, attendees, location,
            erp_context (mail_id, message_subject, scanned_at)
    """
    from app.models.mail_storage import MailboxMessage  # local import avoids circular deps

    # ── Load message ─────────────────────────────────────────────────────────
    try:
        msg_uuid = uuid.UUID(str(message_id))
    except (ValueError, AttributeError):
        logger.warning("scan_mail_for_scheduling_intent: invalid UUID %s", message_id)
        return {"has_scheduling_intent": False, "confidence": 0.0, "suggested_event": None}

    result = await db.execute(
        select(MailboxMessage).where(MailboxMessage.id == msg_uuid)
    )
    message = result.scalar_one_or_none()

    if message is None:
        logger.warning("scan_mail_for_scheduling_intent: message %s not found", message_id)
        return {"has_scheduling_intent": False, "confidence": 0.0, "suggested_event": None}

    subject = message.subject or ""
    body = (message.body_text or message.body_html or "").strip()

    # Truncate very long bodies to keep Ollama prompt manageable
    body_excerpt = body[:4000] if len(body) > 4000 else body

    # ── Build prompt ─────────────────────────────────────────────────────────
    prompt = _EXTRACTION_PROMPT_TEMPLATE.format(
        subject=subject,
        body=body_excerpt,
    )

    # ── Call Ollama ───────────────────────────────────────────────────────────
    try:
        raw_response = await _call_ollama(prompt)
    except httpx.HTTPError as exc:
        logger.error("Ollama HTTP error while scanning message %s: %s", message_id, exc)
        return {"has_scheduling_intent": False, "confidence": 0.0, "suggested_event": None}
    except Exception:
        logger.exception("Unexpected error calling Ollama for message %s", message_id)
        return {"has_scheduling_intent": False, "confidence": 0.0, "suggested_event": None}

    # ── Parse response ────────────────────────────────────────────────────────
    parsed = _parse_ollama_response(raw_response)
    has_intent: bool = bool(parsed.get("has_scheduling_intent", False))
    confidence: float = float(parsed.get("confidence", 0.0))

    # Mark message as scanned so batch scan skips it next time
    try:
        triage = dict(message.ai_triage or {})
        triage[_SCANNED_FLAG_KEY] = datetime.now(timezone.utc).isoformat()
        message.ai_triage = triage
        await db.commit()
    except Exception:
        logger.exception("Failed to mark message %s as calendar-scanned", message_id)
        await db.rollback()

    if not has_intent:
        return {"has_scheduling_intent": False, "confidence": confidence, "suggested_event": None}

    # ── Build suggested event ─────────────────────────────────────────────────
    raw_event: dict = parsed.get("suggested_event") or {}

    start_iso, end_iso = _build_event_times(
        date_str=raw_event.get("date"),
        time_str=raw_event.get("time"),
        duration_minutes=raw_event.get("duration_minutes"),
    )

    # Attendees: combine From address with any extracted attendees
    extracted_attendees: list[str] = raw_event.get("attendees") or []
    if message.from_addr and message.from_addr not in extracted_attendees:
        extracted_attendees.insert(0, message.from_addr)

    suggested_event = {
        "title": raw_event.get("title") or subject or "Untitled Meeting",
        "start_time": start_iso,
        "end_time": end_iso,
        "attendees": extracted_attendees,
        "location": raw_event.get("location"),
        "erp_context": {
            "mail_id": str(message.id),
            "message_subject": subject,
            "from_addr": message.from_addr,
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "source": "mail_calendar_scanner",
        },
    }

    logger.info(
        "Scheduling intent detected in message %s (confidence=%.2f): %s",
        message_id,
        confidence,
        suggested_event["title"],
    )

    return {
        "has_scheduling_intent": True,
        "confidence": confidence,
        "suggested_event": suggested_event,
    }


# ---------------------------------------------------------------------------
# Batch scanner
# ---------------------------------------------------------------------------

async def batch_scan_recent_mail(
    user_id: str,
    db: AsyncSession,
    hours: int = 24,
) -> list[dict[str, Any]]:
    """Scan recent unscanned messages for a user and return suggested events.

    Parameters
    ----------
    user_id:
        UUID string of the owner.
    db:
        Active async SQLAlchemy session.
    hours:
        How far back (from now) to look for messages.

    Returns
    -------
    List of result dicts from scan_mail_for_scheduling_intent where
    has_scheduling_intent is True.
    """
    from app.models.mail_storage import MailboxMessage  # local import

    try:
        owner_uuid = uuid.UUID(str(user_id))
    except (ValueError, AttributeError):
        logger.warning("batch_scan_recent_mail: invalid user_id %s", user_id)
        return []

    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    # Fetch messages received since cutoff that haven't been calendar-scanned yet.
    # We detect "unscanned" by checking that the ai_triage JSONB does NOT contain
    # the calendar_scan key. PostgreSQL JSONB operator: ? checks key existence.
    from sqlalchemy import not_, cast
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy import func as sa_func

    stmt = (
        select(MailboxMessage.id)
        .where(
            MailboxMessage.user_id == owner_uuid,
            MailboxMessage.received_at >= cutoff,
            MailboxMessage.is_deleted.is_(False),
            MailboxMessage.is_draft.is_(False),
            # Exclude already-scanned: ai_triage is null OR doesn't have the key
            not_(
                MailboxMessage.ai_triage[_SCANNED_FLAG_KEY].as_string().isnot(None)
            ),
        )
        .order_by(MailboxMessage.received_at.desc())
        .limit(50)  # safety cap — avoid hammering Ollama
    )

    result = await db.execute(stmt)
    message_ids: list[uuid.UUID] = result.scalars().all()

    if not message_ids:
        logger.debug("batch_scan_recent_mail: no unscanned messages for user %s", user_id)
        return []

    logger.info(
        "batch_scan_recent_mail: scanning %d messages for user %s",
        len(message_ids),
        user_id,
    )

    suggestions: list[dict[str, Any]] = []
    for msg_id in message_ids:
        try:
            scan_result = await scan_mail_for_scheduling_intent(str(msg_id), db)
            if scan_result.get("has_scheduling_intent"):
                scan_result["message_id"] = str(msg_id)
                suggestions.append(scan_result)
        except Exception:
            logger.exception(
                "batch_scan_recent_mail: error scanning message %s", msg_id
            )
            continue

    logger.info(
        "batch_scan_recent_mail: found %d scheduling suggestions for user %s",
        len(suggestions),
        user_id,
    )
    return suggestions


# ---------------------------------------------------------------------------
# Event-bus handler
# ---------------------------------------------------------------------------

async def on_mail_received_calendar(data: dict) -> None:
    """Handle the 'mail.received' event and auto-suggest calendar events.

    Expected data keys:
        message_id (str)  — UUID of the newly received MailboxMessage
        user_id    (str)  — UUID of the message owner

    Publishes 'calendar.suggestion.created' when confidence > 0.7.
    """
    message_id: str | None = data.get("message_id")
    user_id: str | None = data.get("user_id")

    if not message_id:
        logger.debug("on_mail_received_calendar: no message_id in event data")
        return

    logger.debug("on_mail_received_calendar: processing message %s", message_id)

    try:
        from app.core.database import AsyncSessionLocal  # local import

        async with AsyncSessionLocal() as db:
            scan_result = await scan_mail_for_scheduling_intent(message_id, db)

        if (
            scan_result.get("has_scheduling_intent")
            and scan_result.get("confidence", 0.0) > 0.7
        ):
            suggested_event = scan_result["suggested_event"]
            await event_bus.publish(
                "calendar.suggestion.created",
                {
                    "user_id": user_id,
                    "message_id": message_id,
                    "confidence": scan_result["confidence"],
                    "suggested_event": suggested_event,
                },
            )
            logger.info(
                "calendar.suggestion.created published for message %s "
                "(confidence=%.2f, title=%r)",
                message_id,
                scan_result["confidence"],
                suggested_event.get("title"),
            )
    except Exception:
        logger.exception(
            "on_mail_received_calendar: unhandled error for message %s", message_id
        )
