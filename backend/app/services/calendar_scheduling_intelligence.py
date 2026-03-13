"""Scheduling intelligence service.

Three feature areas:
1. Dynamic availability with priority negotiation — find slots that can
   displace lower-priority events when needed.
2. Travel-time estimation — heuristic buffer between in-person events.
3. Predictive scheduling — proactive conflict detection, overload alerts,
   and suggestions for unblocked tasks / approaching SLAs.
"""
from __future__ import annotations

import uuid
import logging
from datetime import datetime, timedelta, time, timezone, date
from typing import Any

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.calendar import CalendarEvent, FocusTimeBlock
from app.models.projects import Task
from app.models.support import Ticket

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

WORK_START = time(9, 0)
WORK_END = time(18, 0)
SLOT_STEP_MINUTES = 30
SCAN_DAYS = 14
TOP_SLOTS = 5

# Priority ordering — higher index = higher priority
PRIORITY_ORDER = {"low": 0, "normal": 1, "high": 2, "urgent": 3}

VIRTUAL_KEYWORDS = {"virtual", "zoom", "jitsi", "online", "remote", "teams"}


# ---------------------------------------------------------------------------
# Internal helpers (shared with calendar_ai patterns)
# ---------------------------------------------------------------------------

def _priority_rank(p: str) -> int:
    return PRIORITY_ORDER.get((p or "normal").lower(), 1)


def _score_slot(slot_start: datetime) -> float:
    """Score a candidate slot — mirrors calendar_ai._score_slot."""
    score = 100.0
    t = slot_start.time()
    if t < time(12, 0):
        score += 20.0
    if t <= time(9, 30):
        score += 10.0
    dow = slot_start.weekday()
    if dow in (1, 2, 3):
        score += 5.0
    if t < time(8, 0) or t >= time(17, 0):
        score -= 40.0
    return score


def _events_for_user(
    user_id: str,
    events: list[CalendarEvent],
) -> list[CalendarEvent]:
    """Filter a pre-fetched event list to those relevant to a single user."""
    uid = uuid.UUID(user_id)
    result: list[CalendarEvent] = []
    for ev in events:
        if ev.organizer_id == uid:
            result.append(ev)
            continue
        if ev.attendees and user_id in [str(a) for a in ev.attendees]:
            result.append(ev)
    return result


def _overlaps_slot(
    slot_start: datetime,
    slot_end: datetime,
    ev: CalendarEvent,
    with_buffers: bool = True,
) -> bool:
    ev_start = ev.start_time
    ev_end = ev.end_time
    if with_buffers:
        ev_start -= timedelta(minutes=ev.buffer_before or 0)
        ev_end += timedelta(minutes=ev.buffer_after or 0)
    return slot_start < ev_end and slot_end > ev_start


def _conflicting_events(
    slot_start: datetime,
    slot_end: datetime,
    events: list[CalendarEvent],
    with_buffers: bool = True,
) -> list[CalendarEvent]:
    return [
        ev for ev in events
        if _overlaps_slot(slot_start, slot_end, ev, with_buffers)
    ]


# ---------------------------------------------------------------------------
# Feature 1 — negotiate_availability
# ---------------------------------------------------------------------------

async def negotiate_availability(
    requester_id: str,
    attendee_ids: list[str],
    duration_minutes: int,
    priority: str,
    db: AsyncSession,
) -> list[dict[str, Any]]:
    """Find top slots for a meeting, negotiating around lower-priority events.

    Returns up to TOP_SLOTS entries with shape:
        {start, end, score, negotiable, conflicts}

    A slot marked *negotiable* means it would be free if one or more existing
    (lower-priority) events were rescheduled.
    """
    all_attendee_ids = list({requester_id, *attendee_ids})
    req_rank = _priority_rank(priority)

    now = datetime.now(timezone.utc)
    range_start = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
    range_end = range_start + timedelta(days=SCAN_DAYS)

    # Fetch events for all attendees in range
    uid_uuids = [uuid.UUID(uid) for uid in all_attendee_ids]
    result = await db.execute(
        select(CalendarEvent).where(
            and_(
                CalendarEvent.start_time < range_end,
                CalendarEvent.end_time > range_start,
                CalendarEvent.status != "cancelled",
                or_(
                    CalendarEvent.organizer_id.in_(uid_uuids),
                    *[
                        CalendarEvent.attendees.op("@>")(f'["{uid}"]')
                        for uid in all_attendee_ids
                    ],
                ),
            )
        )
    )
    all_events: list[CalendarEvent] = list(result.scalars().all())

    # Fetch focus blocks
    focus_result = await db.execute(
        select(FocusTimeBlock).where(
            FocusTimeBlock.user_id.in_(uid_uuids),
            FocusTimeBlock.is_active.is_(True),
        )
    )
    focus_blocks = list(focus_result.scalars().all())

    def _within_focus(slot_start: datetime) -> bool:
        slot_end = slot_start + timedelta(minutes=duration_minutes)
        dow = slot_start.weekday()
        iso_dow = (dow + 1) % 7
        for block in focus_blocks:
            if iso_dow not in (block.days_of_week or []):
                continue
            bs = slot_start.replace(
                hour=block.start_hour, minute=block.start_minute, second=0, microsecond=0
            )
            be = slot_start.replace(
                hour=block.end_hour, minute=block.end_minute, second=0, microsecond=0
            )
            if slot_start < be and slot_end > bs:
                return True
        return False

    candidates: list[dict[str, Any]] = []
    cursor = range_start

    while cursor + timedelta(minutes=duration_minutes) <= range_end:
        slot_end = cursor + timedelta(minutes=duration_minutes)

        # Skip weekends and outside work hours
        if cursor.weekday() >= 5:
            cursor += timedelta(minutes=SLOT_STEP_MINUTES)
            continue
        if cursor.time() < WORK_START or slot_end.time() > WORK_END:
            cursor += timedelta(minutes=SLOT_STEP_MINUTES)
            continue
        if _within_focus(cursor):
            cursor += timedelta(minutes=SLOT_STEP_MINUTES)
            continue

        # Gather conflicts for each attendee
        blocking: list[dict[str, Any]] = []   # higher/same priority — hard block
        negotiable_conflicts: list[dict[str, Any]] = []  # lower priority — negotiable

        for uid in all_attendee_ids:
            user_events = _events_for_user(uid, all_events)
            overlapping = _conflicting_events(cursor, slot_end, user_events)
            for ev in overlapping:
                ev_rank = _priority_rank(ev.priority)
                conflict_entry = {
                    "event_id": str(ev.id),
                    "attendee_id": uid,
                    "priority": ev.priority,
                    "title": ev.title,
                }
                if ev_rank < req_rank:
                    negotiable_conflicts.append(conflict_entry)
                else:
                    blocking.append(conflict_entry)

        if blocking:
            # Hard conflict — skip this slot entirely
            cursor += timedelta(minutes=SLOT_STEP_MINUTES)
            continue

        score = _score_slot(cursor)
        if negotiable_conflicts:
            # Small score penalty for negotiable slots
            score -= 15.0

        candidates.append({
            "start": cursor.isoformat(),
            "end": slot_end.isoformat(),
            "score": round(score, 1),
            "negotiable": bool(negotiable_conflicts),
            "conflicts": negotiable_conflicts,
        })
        cursor += timedelta(minutes=SLOT_STEP_MINUTES)

    # Sort: free slots first (negotiable=False), then by score descending
    candidates.sort(key=lambda c: (c["negotiable"], -c["score"]))
    return candidates[:TOP_SLOTS]


# ---------------------------------------------------------------------------
# Feature 2 — Travel-time estimation
# ---------------------------------------------------------------------------

def estimate_travel_time(from_location: str | None, to_location: str | None) -> int:
    """Return estimated travel time in minutes between two locations.

    Heuristic-only; no external API calls.
    """
    if not from_location or not to_location:
        return 0

    from_lower = from_location.lower().strip()
    to_lower = to_location.lower().strip()

    if from_lower == to_lower:
        return 0

    # Virtual / remote check
    for keyword in VIRTUAL_KEYWORDS:
        if keyword in from_lower or keyword in to_lower:
            return 0

    # Same building heuristic (first 20 chars match)
    if from_lower[:20] == to_lower[:20]:
        return 5

    return 30


async def add_travel_buffers(
    user_id: str,
    date_str: str,
    db: AsyncSession,
) -> list[dict[str, Any]]:
    """Auto-calculate and apply travel buffers between in-person events on a date.

    Returns a list of warning dicts:
        {event_id, warning, travel_minutes}
    """
    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        return [{"error": f"Invalid date: {date_str}"}]

    day_start = datetime(
        target_date.year, target_date.month, target_date.day,
        0, 0, 0, tzinfo=timezone.utc
    )
    day_end = day_start + timedelta(days=1)

    uid = uuid.UUID(user_id)
    result = await db.execute(
        select(CalendarEvent).where(
            and_(
                CalendarEvent.start_time >= day_start,
                CalendarEvent.start_time < day_end,
                CalendarEvent.status != "cancelled",
                or_(
                    CalendarEvent.organizer_id == uid,
                    CalendarEvent.attendees.op("@>")(f'["{user_id}"]'),
                ),
            )
        ).order_by(CalendarEvent.start_time)
    )
    events: list[CalendarEvent] = list(result.scalars().all())

    # Filter to in-person events (those with a non-virtual location)
    def _is_in_person(ev: CalendarEvent) -> bool:
        if not ev.location:
            return False
        loc = ev.location.lower()
        return not any(kw in loc for kw in VIRTUAL_KEYWORDS)

    in_person = [ev for ev in events if _is_in_person(ev)]

    warnings: list[dict[str, Any]] = []

    for i in range(len(in_person) - 1):
        ev_a = in_person[i]
        ev_b = in_person[i + 1]

        travel_minutes = estimate_travel_time(ev_a.location, ev_b.location)
        if travel_minutes == 0:
            continue

        gap_seconds = (ev_b.start_time - ev_a.end_time).total_seconds()
        gap_minutes = int(gap_seconds / 60)

        if gap_minutes >= travel_minutes:
            # Gap is already sufficient
            continue

        # Need to add buffer — pick whichever field requires smaller adjustment
        shortfall = travel_minutes - gap_minutes
        current_buffer_after = ev_a.buffer_after or 0
        current_buffer_before = ev_b.buffer_before or 0

        # Use buffer_after on ev_a if it results in a smaller total addition
        if current_buffer_after + shortfall <= current_buffer_before + shortfall:
            ev_a.buffer_after = max(current_buffer_after, travel_minutes)
            changed_event_id = str(ev_a.id)
            changed_field = "buffer_after"
        else:
            ev_b.buffer_before = max(current_buffer_before, travel_minutes)
            changed_event_id = str(ev_b.id)
            changed_field = "buffer_before"

        await db.flush()

        warnings.append({
            "event_id": changed_event_id,
            "warning": (
                f"Travel time of {travel_minutes} min needed between "
                f"'{ev_a.title}' and '{ev_b.title}'. "
                f"Updated {changed_field} on event {changed_event_id}."
            ),
            "travel_minutes": travel_minutes,
        })

    return warnings


# ---------------------------------------------------------------------------
# Feature 3 — Predictive scheduling
# ---------------------------------------------------------------------------

async def predict_next_week_conflicts(
    user_id: str,
    db: AsyncSession,
) -> dict[str, Any]:
    """Scan the next 7 days for conflicts, overloaded days, and focus violations.

    Returns:
        {conflicts, overloaded_days, focus_violations, suggestions}
    """
    now = datetime.now(timezone.utc)
    range_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    range_end = range_start + timedelta(days=7)

    uid = uuid.UUID(user_id)
    result = await db.execute(
        select(CalendarEvent).where(
            and_(
                CalendarEvent.start_time >= range_start,
                CalendarEvent.end_time <= range_end,
                CalendarEvent.status != "cancelled",
                or_(
                    CalendarEvent.organizer_id == uid,
                    CalendarEvent.attendees.op("@>")(f'["{user_id}"]'),
                ),
            )
        ).order_by(CalendarEvent.start_time)
    )
    events: list[CalendarEvent] = list(result.scalars().all())

    # Focus blocks
    fb_result = await db.execute(
        select(FocusTimeBlock).where(
            FocusTimeBlock.user_id == uid,
            FocusTimeBlock.is_active.is_(True),
        )
    )
    focus_blocks: list[FocusTimeBlock] = list(fb_result.scalars().all())

    # --- Conflict detection (pairwise, including buffers) ---
    conflicts: list[dict[str, Any]] = []
    seen_pairs: set[frozenset] = set()

    for i, ev_a in enumerate(events):
        for ev_b in events[i + 1:]:
            if ev_b.start_time >= ev_a.end_time + timedelta(minutes=ev_a.buffer_after or 0):
                break  # events are ordered; no more overlaps possible with ev_a
            pair_key = frozenset({str(ev_a.id), str(ev_b.id)})
            if pair_key in seen_pairs:
                continue
            if _overlaps_slot(ev_a.start_time, ev_a.end_time, ev_b, with_buffers=True):
                seen_pairs.add(pair_key)
                conflicts.append({
                    "event_a_id": str(ev_a.id),
                    "event_a_title": ev_a.title,
                    "event_b_id": str(ev_b.id),
                    "event_b_title": ev_b.title,
                    "overlap_start": max(ev_a.start_time, ev_b.start_time).isoformat(),
                })

    # --- Overloaded day detection (> 6 hours of meetings) ---
    day_totals: dict[str, float] = {}
    for ev in events:
        day_key = ev.start_time.date().isoformat()
        duration_hours = (ev.end_time - ev.start_time).total_seconds() / 3600
        day_totals[day_key] = day_totals.get(day_key, 0.0) + duration_hours

    overloaded_days = [
        {"date": d, "total_hours": round(h, 1)}
        for d, h in day_totals.items()
        if h > 6.0
    ]

    # --- Focus-time violation detection ---
    focus_violations: list[dict[str, Any]] = []
    for ev in events:
        slot_end = ev.end_time
        dow = ev.start_time.weekday()
        iso_dow = (dow + 1) % 7
        for block in focus_blocks:
            if iso_dow not in (block.days_of_week or []):
                continue
            bs = ev.start_time.replace(
                hour=block.start_hour, minute=block.start_minute,
                second=0, microsecond=0,
            )
            be = ev.start_time.replace(
                hour=block.end_hour, minute=block.end_minute,
                second=0, microsecond=0,
            )
            if ev.start_time < be and slot_end > bs:
                focus_violations.append({
                    "event_id": str(ev.id),
                    "event_title": ev.title,
                    "focus_block": block.name,
                    "focus_start": bs.isoformat(),
                    "focus_end": be.isoformat(),
                })

    # --- Suggestions (reschedule one event from each conflict pair) ---
    suggestions: list[dict[str, Any]] = []
    for conflict in conflicts[:5]:  # Cap suggestions to avoid excessive queries
        suggestions.append({
            "action": "reschedule",
            "event_id": conflict["event_b_id"],
            "event_title": conflict["event_b_title"],
            "reason": f"Conflicts with '{conflict['event_a_title']}'",
            "hint": "Use the reschedule AI endpoint to find alternative times.",
        })

    for ol_day in overloaded_days:
        suggestions.append({
            "action": "reduce_load",
            "date": ol_day["date"],
            "total_hours": ol_day["total_hours"],
            "reason": "Day exceeds 6 hours of scheduled meetings.",
            "hint": "Consider moving some meetings to adjacent days.",
        })

    return {
        "conflicts": conflicts,
        "overloaded_days": overloaded_days,
        "focus_violations": focus_violations,
        "suggestions": suggestions,
    }


async def proactive_schedule_suggestions(
    user_id: str,
    db: AsyncSession,
) -> dict[str, Any]:
    """Proactively surface scheduling gaps: unblocked tasks and approaching SLAs.

    Returns:
        {unblocked_tasks, approaching_slas, suggested_actions}
    """
    now = datetime.now(timezone.utc)
    three_days_later = now + timedelta(days=3)
    uid = uuid.UUID(user_id)

    # --- Tasks: not done, has due_date, assigned to user, due within 3 days ---
    task_result = await db.execute(
        select(Task).where(
            and_(
                Task.assignee_id == uid,
                Task.status != "done",
                Task.due_date.isnot(None),
                Task.due_date <= three_days_later,
            )
        )
    )
    tasks: list[Task] = list(task_result.scalars().all())

    # Check which tasks have a linked calendar event via erp_context
    cal_result = await db.execute(
        select(CalendarEvent).where(
            and_(
                CalendarEvent.start_time >= now,
                or_(
                    CalendarEvent.organizer_id == uid,
                    CalendarEvent.attendees.op("@>")(f'["{user_id}"]'),
                ),
                CalendarEvent.erp_context.isnot(None),
            )
        )
    )
    future_events: list[CalendarEvent] = list(cal_result.scalars().all())

    # Build set of task IDs that already have a calendar block
    blocked_task_ids: set[str] = set()
    for ev in future_events:
        ctx = ev.erp_context or {}
        if "task_id" in ctx:
            blocked_task_ids.add(str(ctx["task_id"]))

    unblocked_tasks: list[dict[str, Any]] = []
    for task in tasks:
        if str(task.id) not in blocked_task_ids:
            unblocked_tasks.append({
                "task_id": str(task.id),
                "title": task.title,
                "due_date": task.due_date.isoformat() if task.due_date else None,
                "priority": task.priority,
                "status": task.status,
            })

    # --- Support tickets: assigned to user, open, SLA resolution due within 24h ---
    sla_deadline = now + timedelta(hours=24)
    ticket_result = await db.execute(
        select(Ticket).where(
            and_(
                Ticket.assigned_to == uid,
                Ticket.status.in_(["open", "pending"]),
                Ticket.sla_resolution_due.isnot(None),
                Ticket.sla_resolution_due <= sla_deadline,
                Ticket.sla_resolution_breached.is_(False),
            )
        )
    )
    tickets: list[Ticket] = list(ticket_result.scalars().all())

    approaching_slas: list[dict[str, Any]] = [
        {
            "ticket_id": str(t.id),
            "ticket_number": t.ticket_number,
            "subject": t.subject,
            "sla_resolution_due": t.sla_resolution_due.isoformat() if t.sla_resolution_due else None,
            "priority": t.priority,
        }
        for t in tickets
    ]

    # --- Suggested actions ---
    suggested_actions: list[dict[str, Any]] = []

    for task in unblocked_tasks:
        suggested_actions.append({
            "type": "auto_block_task",
            "task_id": task["task_id"],
            "task_title": task["title"],
            "due_date": task["due_date"],
            "message": (
                f"Task '{task['title']}' is due by {task['due_date']} "
                "with no calendar time block. Suggest scheduling a work session."
            ),
        })

    for ticket in approaching_slas:
        suggested_actions.append({
            "type": "schedule_callback",
            "ticket_id": ticket["ticket_id"],
            "ticket_number": ticket["ticket_number"],
            "sla_due": ticket["sla_resolution_due"],
            "message": (
                f"Ticket #{ticket['ticket_number']} SLA expires at "
                f"{ticket['sla_resolution_due']}. Suggest scheduling a callback."
            ),
        })

    return {
        "unblocked_tasks": unblocked_tasks,
        "approaching_slas": approaching_slas,
        "suggested_actions": suggested_actions,
    }
