"""AI-powered calendar services.

Provides NLP event parsing, optimal scheduling suggestions, and smart
rescheduling — all backed by the local Ollama instance with no external
API dependencies.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, time, timezone
from typing import Any

import httpx
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.calendar import CalendarEvent, FocusTimeBlock
from app.models.user import User

logger = logging.getLogger(__name__)

# Work-day boundaries used for scoring suggestions
WORK_DAY_START = time(8, 0)
WORK_DAY_END = time(17, 0)
MORNING_END = time(12, 0)

# Ollama HTTP timeout (seconds)
OLLAMA_TIMEOUT = 120


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _ollama_generate(prompt: str, system: str | None = None) -> str:
    """Send a single-shot prompt to Ollama's /api/generate endpoint.

    Returns the raw response text.  Raises on HTTP or JSON errors.
    """
    url = f"{settings.OLLAMA_URL.rstrip('/')}/api/generate"
    payload: dict[str, Any] = {
        "model": settings.OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
    }
    if system:
        payload["system"] = system

    async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data.get("response", "")


async def _lookup_users_by_name(
    names: list[str], db: AsyncSession
) -> list[dict[str, Any]]:
    """Fuzzy-match a list of human names against the User table.

    Returns a list of dicts with ``id``, ``full_name``, and ``email``
    for every name that matched at least one user.
    """
    matched: list[dict[str, Any]] = []
    for name in names:
        name_clean = name.strip()
        if not name_clean:
            continue
        # Case-insensitive ILIKE search
        result = await db.execute(
            select(User).where(
                User.full_name.ilike(f"%{name_clean}%"),
                User.is_active.is_(True),
            )
        )
        user = result.scalars().first()
        if user:
            matched.append({
                "id": str(user.id),
                "full_name": user.full_name,
                "email": user.email,
            })
    return matched


async def _get_events_in_range(
    user_ids: list[str],
    range_start: datetime,
    range_end: datetime,
    db: AsyncSession,
    exclude_event_id: uuid.UUID | None = None,
) -> list[CalendarEvent]:
    """Fetch all CalendarEvents for *any* of the given users in a time range."""
    uid_uuids = [uuid.UUID(uid) for uid in user_ids]
    conditions = [
        CalendarEvent.start_time < range_end,
        CalendarEvent.end_time > range_start,
        CalendarEvent.status != "cancelled",
        or_(
            CalendarEvent.organizer_id.in_(uid_uuids),
            # Also check if the user appears in the attendees JSON list
            *[CalendarEvent.attendees.op("@>")(json.dumps([uid])) for uid in user_ids],
        ),
    ]
    if exclude_event_id:
        conditions.append(CalendarEvent.id != exclude_event_id)

    result = await db.execute(
        select(CalendarEvent).where(and_(*conditions))
    )
    return list(result.scalars().all())


async def _get_focus_blocks(
    user_ids: list[str], db: AsyncSession
) -> list[FocusTimeBlock]:
    """Fetch active FocusTimeBlock entries for the given users."""
    uid_uuids = [uuid.UUID(uid) for uid in user_ids]
    result = await db.execute(
        select(FocusTimeBlock).where(
            FocusTimeBlock.user_id.in_(uid_uuids),
            FocusTimeBlock.is_active.is_(True),
        )
    )
    return list(result.scalars().all())


def _is_within_focus_block(
    dt: datetime, duration_minutes: int, blocks: list[FocusTimeBlock]
) -> bool:
    """Return True if the proposed slot overlaps any focus-time block."""
    slot_end = dt + timedelta(minutes=duration_minutes)
    dow = dt.weekday()  # 0=Mon ... 6=Sun
    # FocusTimeBlock uses 0=Sun convention; convert Python weekday
    iso_dow = (dow + 1) % 7  # Python Mon=0 -> 1, Sun=6 -> 0

    for block in blocks:
        if iso_dow not in (block.days_of_week or []):
            continue
        block_start = dt.replace(
            hour=block.start_hour, minute=block.start_minute, second=0, microsecond=0
        )
        block_end = dt.replace(
            hour=block.end_hour, minute=block.end_minute, second=0, microsecond=0
        )
        # Overlap check
        if dt < block_end and slot_end > block_start:
            return True
    return False


def _slot_overlaps_event(
    slot_start: datetime,
    slot_end: datetime,
    events: list[CalendarEvent],
) -> bool:
    """Return True if the proposed slot overlaps any existing event (including buffers)."""
    for ev in events:
        ev_start = ev.start_time - timedelta(minutes=ev.buffer_before or 0)
        ev_end = ev.end_time + timedelta(minutes=ev.buffer_after or 0)
        if slot_start < ev_end and slot_end > ev_start:
            return True
    return False


def _score_slot(slot_start: datetime) -> float:
    """Score a candidate time slot.  Higher is better.

    Preferences:
    - Morning slots (before noon) get a bonus.
    - Slots at the start of the work day get a small bonus (reduces fragmentation).
    - Mid-week days (Tue-Thu) get a slight bonus over Mon/Fri.
    """
    score = 100.0
    t = slot_start.time()

    # Morning bonus
    if t < MORNING_END:
        score += 20.0

    # Start-of-day bonus (anti-fragmentation)
    if t <= time(9, 30):
        score += 10.0

    # Mid-week bonus
    dow = slot_start.weekday()  # 0=Mon
    if dow in (1, 2, 3):  # Tue, Wed, Thu
        score += 5.0

    # Penalise very early / very late
    if t < WORK_DAY_START or t >= WORK_DAY_END:
        score -= 40.0

    return score


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def parse_natural_language_event(
    text: str,
    user_id: str,
    db: AsyncSession,
) -> dict[str, Any]:
    """Parse free-form text into a structured calendar-event dict.

    Example input:
        "Schedule a finance review with Amina next Tuesday at 2pm"

    Returns a dict ready for ``CalendarEvent`` creation, with attendees
    resolved to real user IDs where possible.
    """

    now_iso = datetime.now(timezone.utc).isoformat()

    system_prompt = (
        "You are a calendar assistant for Urban ERP.  "
        "Extract structured event details from the user's natural language input.  "
        "Return ONLY valid JSON with these fields:\n"
        '  "title": string,\n'
        '  "start_time": ISO-8601 datetime string,\n'
        '  "end_time": ISO-8601 datetime string (default 1 hour after start if not specified),\n'
        '  "attendee_names": array of person name strings mentioned,\n'
        '  "event_type": one of "meeting", "task", "reminder", "focus", "deadline",\n'
        '  "location": string or null\n'
        "Do NOT include any text outside the JSON object.  "
        f"The current UTC time is {now_iso}.  "
        "Resolve relative dates like 'next Tuesday' against the current date."
    )

    prompt = f'Parse this into a calendar event:\n"{text}"'

    raw = await _ollama_generate(prompt, system=system_prompt)

    # Strip markdown fences if present
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        # Remove opening fence (```json or ```)
        first_newline = cleaned.index("\n")
        cleaned = cleaned[first_newline + 1 :]
    if cleaned.endswith("```"):
        cleaned = cleaned[: -3]
    cleaned = cleaned.strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("Ollama returned non-JSON for NLP event parsing: %s", raw[:300])
        # Return a best-effort fallback
        return {
            "title": text,
            "start_time": None,
            "end_time": None,
            "attendees": [],
            "attendee_names": [],
            "event_type": "meeting",
            "location": None,
            "ai_raw": raw,
            "parse_error": True,
        }

    # Resolve attendee names to user records
    attendee_names: list[str] = parsed.get("attendee_names", [])
    matched_users = await _lookup_users_by_name(attendee_names, db)
    attendee_ids = [u["id"] for u in matched_users]

    # Parse datetimes (keep as strings if they are already ISO)
    start_time = parsed.get("start_time")
    end_time = parsed.get("end_time")

    # If end_time is missing, default to 1 hour after start
    if start_time and not end_time:
        try:
            st = datetime.fromisoformat(start_time)
            end_time = (st + timedelta(hours=1)).isoformat()
        except (ValueError, TypeError):
            pass

    return {
        "title": parsed.get("title", text),
        "start_time": start_time,
        "end_time": end_time,
        "attendees": attendee_ids,
        "attendee_details": matched_users,
        "unresolved_names": [
            n for n in attendee_names
            if not any(u["full_name"].lower().startswith(n.lower()) or n.lower() in u["full_name"].lower() for u in matched_users)
        ],
        "event_type": parsed.get("event_type", "meeting"),
        "location": parsed.get("location"),
        "organizer_id": user_id,
    }


async def suggest_optimal_times(
    attendee_ids: list[str],
    duration_minutes: int,
    db: AsyncSession,
    days_ahead: int = 7,
) -> list[dict[str, Any]]:
    """Find the top 3 optimal meeting slots for all attendees.

    Scans the next ``days_ahead`` working days in 30-minute increments,
    skipping any slot that conflicts with existing events or focus-time
    blocks for *any* attendee.  Slots are scored to prefer mornings and
    reduce calendar fragmentation.
    """
    now = datetime.now(timezone.utc)
    range_start = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    range_end = range_start + timedelta(days=days_ahead)

    # Fetch all blocking data
    events = await _get_events_in_range(attendee_ids, range_start, range_end, db)
    focus_blocks = await _get_focus_blocks(attendee_ids, db)

    candidates: list[tuple[float, datetime]] = []
    cursor = range_start

    while cursor + timedelta(minutes=duration_minutes) <= range_end:
        slot_end = cursor + timedelta(minutes=duration_minutes)

        # Skip weekends (Sat=5, Sun=6)
        if cursor.weekday() >= 5:
            cursor += timedelta(minutes=30)
            continue

        # Skip outside work hours
        if cursor.time() < WORK_DAY_START or slot_end.time() > WORK_DAY_END:
            cursor += timedelta(minutes=30)
            continue

        # Check conflicts
        if _slot_overlaps_event(cursor, slot_end, events):
            cursor += timedelta(minutes=30)
            continue

        if _is_within_focus_block(cursor, duration_minutes, focus_blocks):
            cursor += timedelta(minutes=30)
            continue

        score = _score_slot(cursor)
        candidates.append((score, cursor))
        cursor += timedelta(minutes=30)

    # Sort descending by score, take top 3
    candidates.sort(key=lambda c: c[0], reverse=True)
    top = candidates[:3]

    return [
        {
            "start_time": slot.isoformat(),
            "end_time": (slot + timedelta(minutes=duration_minutes)).isoformat(),
            "score": round(score, 1),
            "day": slot.strftime("%A"),
            "time": slot.strftime("%H:%M"),
        }
        for score, slot in top
    ]


async def suggest_reschedule(
    event_id: str,
    db: AsyncSession,
) -> list[dict[str, Any]]:
    """Suggest 3 alternative times for an event that has conflicts.

    Loads the event, identifies all attendees (organiser + attendees list),
    then delegates to ``suggest_optimal_times`` with the same duration.
    """
    event = await db.get(CalendarEvent, uuid.UUID(event_id))
    if not event:
        return []

    # Collect all participant IDs
    participant_ids: list[str] = [str(event.organizer_id)]
    if event.attendees:
        for aid in event.attendees:
            aid_str = str(aid)
            if aid_str not in participant_ids:
                participant_ids.append(aid_str)

    # Calculate original duration in minutes
    duration = event.end_time - event.start_time
    duration_minutes = max(int(duration.total_seconds() / 60), 15)

    suggestions = await suggest_optimal_times(
        attendee_ids=participant_ids,
        duration_minutes=duration_minutes,
        db=db,
        days_ahead=7,
    )

    # Annotate each suggestion with the original event context
    for s in suggestions:
        s["original_event_id"] = event_id
        s["original_title"] = event.title

    return suggestions
