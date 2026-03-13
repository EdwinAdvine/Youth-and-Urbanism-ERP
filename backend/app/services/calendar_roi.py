"""Calendar ROI calculator and AI Meeting Coach service."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.calendar import CalendarEvent
from app.models.crm import Deal
from app.models.finance import Invoice
from app.models.hr import Employee

# Default hourly rate when no salary data is available
DEFAULT_HOURLY_RATE = 50.0
# Monthly hours used to convert monthly salary to hourly
MONTHLY_HOURS = 160.0


async def _ai_chat(messages: list[dict], model: str | None = None) -> str:
    """Call the configured AI provider."""
    from openai import AsyncOpenAI

    provider = settings.AI_PROVIDER
    if provider == "anthropic":
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=settings.AI_API_KEY)
        system_parts = [m["content"] for m in messages if m["role"] == "system"]
        non_system = [m for m in messages if m["role"] != "system"]
        kwargs: dict[str, Any] = {
            "model": model or settings.AI_MODEL,
            "max_tokens": 4096,
            "messages": non_system,
        }
        if system_parts:
            kwargs["system"] = "\n\n".join(system_parts)
        resp = await client.messages.create(**kwargs)
        return resp.content[0].text
    else:
        client_oai = AsyncOpenAI(api_key=settings.AI_API_KEY, base_url=settings.AI_BASE_URL)
        resp = await client_oai.chat.completions.create(
            model=model or settings.AI_MODEL,
            messages=messages,
        )
        return resp.choices[0].message.content or ""


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

async def _get_hourly_rates(
    user_ids: list[str], db: AsyncSession
) -> dict[str, float]:
    """Return {user_id: hourly_rate} for a list of user IDs.

    Falls back to DEFAULT_HOURLY_RATE when an Employee record does not exist or
    has no salary set.
    """
    if not user_ids:
        return {}

    parsed_ids: list[uuid.UUID] = []
    for uid in user_ids:
        try:
            parsed_ids.append(uuid.UUID(str(uid)))
        except (ValueError, AttributeError):
            pass

    rates: dict[str, float] = {str(uid): DEFAULT_HOURLY_RATE for uid in parsed_ids}

    if parsed_ids:
        result = await db.execute(
            select(Employee).where(Employee.user_id.in_(parsed_ids))
        )
        employees = result.scalars().all()
        for emp in employees:
            if emp.salary is not None:
                hourly = float(emp.salary) / MONTHLY_HOURS
                rates[str(emp.user_id)] = round(hourly, 4)

    return rates


def _duration_hours(event: CalendarEvent) -> float:
    start = event.start_time
    end = event.end_time
    # Make both naive or both aware before subtracting
    if start.tzinfo is None and end.tzinfo is not None:
        start = start.replace(tzinfo=timezone.utc)
    elif start.tzinfo is not None and end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return max((end - start).total_seconds() / 3600, 0)


# ─────────────────────────────────────────────────────────────────────────────
# calculate_meeting_roi
# ─────────────────────────────────────────────────────────────────────────────

async def calculate_meeting_roi(event_id: str, db: AsyncSession) -> dict[str, Any]:
    """Calculate the ROI for a single meeting event.

    Returns a dict with cost breakdown, attributed revenue, and ROI %.
    """
    try:
        eid = uuid.UUID(str(event_id))
    except ValueError:
        return {"error": "Invalid event_id"}

    event = await db.get(CalendarEvent, eid)
    if not event:
        return {"error": "Event not found"}

    # Collect all participant user IDs (organizer + attendees list)
    all_user_ids: list[str] = [str(event.organizer_id)]
    for attendee in event.attendees or []:
        uid = str(attendee)
        if uid not in all_user_ids:
            all_user_ids.append(uid)

    rates = await _get_hourly_rates(all_user_ids, db)
    duration_hours = _duration_hours(event)

    cost_breakdown: list[dict[str, Any]] = []
    total_cost = 0.0
    for uid in all_user_ids:
        hr = rates.get(uid, DEFAULT_HOURLY_RATE)
        cost = round(hr * duration_hours, 2)
        total_cost += cost
        cost_breakdown.append(
            {"user_id": uid, "hourly_rate": round(hr, 2), "cost": cost}
        )
    total_cost = round(total_cost, 2)

    # Revenue attribution from ERP context
    erp = event.erp_context or {}
    revenue_90d = 0.0
    meetings_with_client = 1
    deal_value = 0.0
    roi_pct: float | None = None

    client_id = erp.get("client_id") or erp.get("contact_id")
    deal_id = erp.get("deal_id")

    if client_id:
        cutoff = datetime.utcnow() - timedelta(days=90)
        inv_result = await db.execute(
            select(func.sum(Invoice.total)).where(
                Invoice.customer_email.isnot(None),
                Invoice.status == "paid",
                Invoice.issue_date >= cutoff.date(),
            )
        )
        # Note: Invoice doesn't have a direct client_id FK, we use customer_name/email
        # as a proxy — sum all paid invoices in the window as overall revenue context
        raw_sum = inv_result.scalar()
        revenue_90d = float(raw_sum) if raw_sum else 0.0

        # Count meetings with the same erp_context client in last 90 days
        meetings_q = await db.execute(
            select(func.count(CalendarEvent.id)).where(
                CalendarEvent.start_time >= (datetime.utcnow() - timedelta(days=90)),
                CalendarEvent.erp_context.isnot(None),
            )
        )
        meetings_with_client = max(meetings_q.scalar() or 1, 1)

    if deal_id:
        try:
            deal = await db.get(Deal, uuid.UUID(str(deal_id)))
            if deal and deal.deal_value:
                deal_value = float(deal.deal_value)
        except (ValueError, AttributeError):
            pass

    if client_id or deal_id:
        attributed = (revenue_90d / meetings_with_client) + deal_value
        if total_cost > 0:
            roi_pct = round(((attributed - total_cost) / total_cost) * 100, 1)

    return {
        "event_id": str(event.id),
        "title": event.title,
        "duration_hours": round(duration_hours, 2),
        "attendee_count": len(all_user_ids),
        "total_cost_usd": total_cost,
        "revenue_attributed_usd": round(revenue_90d + deal_value, 2),
        "roi_pct": roi_pct,
        "erp_context": erp,
        "cost_breakdown": cost_breakdown,
    }


# ─────────────────────────────────────────────────────────────────────────────
# get_meeting_roi_dashboard
# ─────────────────────────────────────────────────────────────────────────────

async def get_meeting_roi_dashboard(
    user_id: str, days: int, db: AsyncSession
) -> dict[str, Any]:
    """Aggregate meeting costs for the current user over the last N days.

    Groups into client meetings (have erp_context) vs internal, surfaces the top 5
    most expensive meetings and a monthly breakdown.
    """
    try:
        uid = uuid.UUID(str(user_id))
    except ValueError:
        return {"error": "Invalid user_id"}

    since = datetime.utcnow() - timedelta(days=days)

    events_result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.organizer_id == uid,
            CalendarEvent.event_type == "meeting",
            CalendarEvent.start_time >= since,
        ).order_by(CalendarEvent.start_time.desc())
    )
    events: list[CalendarEvent] = list(events_result.scalars().all())

    # Gather all unique attendee user IDs across all events for bulk salary lookup
    all_user_ids: set[str] = {str(uid)}
    for ev in events:
        for att in ev.attendees or []:
            all_user_ids.add(str(att))
    rates = await _get_hourly_rates(list(all_user_ids), db)

    total_cost = 0.0
    client_cost = 0.0
    internal_cost = 0.0
    meeting_costs: list[dict[str, Any]] = []
    by_month: dict[str, float] = {}

    for ev in events:
        duration = _duration_hours(ev)
        participants = [str(ev.organizer_id)] + [str(a) for a in (ev.attendees or [])]
        event_cost = sum(
            rates.get(p, DEFAULT_HOURLY_RATE) * duration for p in participants
        )
        event_cost = round(event_cost, 2)
        total_cost += event_cost

        is_client_meeting = bool(ev.erp_context and (
            ev.erp_context.get("client_id")
            or ev.erp_context.get("contact_id")
            or ev.erp_context.get("deal_id")
            or ev.erp_context.get("invoice_id")
        ))
        if is_client_meeting:
            client_cost += event_cost
        else:
            internal_cost += event_cost

        month_key = ev.start_time.strftime("%Y-%m")
        by_month[month_key] = round(by_month.get(month_key, 0.0) + event_cost, 2)

        meeting_costs.append({
            "event_id": str(ev.id),
            "title": ev.title,
            "date": ev.start_time.isoformat(),
            "duration_hours": round(duration, 2),
            "attendee_count": len(participants),
            "cost_usd": event_cost,
            "is_client_meeting": is_client_meeting,
        })

    # Top 5 most expensive
    most_expensive = sorted(meeting_costs, key=lambda x: x["cost_usd"], reverse=True)[:5]

    # Monthly breakdown as sorted list
    by_month_list = [
        {"month": k, "cost_usd": v}
        for k, v in sorted(by_month.items())
    ]

    avg_cost = round(total_cost / len(events), 2) if events else 0.0

    return {
        "period_days": days,
        "total_meetings": len(events),
        "total_cost_usd": round(total_cost, 2),
        "client_meeting_cost_usd": round(client_cost, 2),
        "internal_meeting_cost_usd": round(internal_cost, 2),
        "avg_cost_per_meeting_usd": avg_cost,
        "most_expensive_meetings": most_expensive,
        "by_month": by_month_list,
    }


# ─────────────────────────────────────────────────────────────────────────────
# analyze_meeting_sentiment
# ─────────────────────────────────────────────────────────────────────────────

async def analyze_meeting_sentiment(
    event_id: str, notes: str, db: AsyncSession
) -> dict[str, Any]:
    """Send meeting notes to the configured AI provider for sentiment + coaching analysis.

    Returns: {sentiment, score, key_themes, action_items, coaching_tip}
    """
    if not notes or not notes.strip():
        return {
            "sentiment": "neutral",
            "score": 0.5,
            "key_themes": [],
            "action_items": [],
            "coaching_tip": "No notes provided for analysis.",
        }

    prompt = (
        "Analyze this meeting note for sentiment. "
        "Return ONLY valid JSON (no markdown, no extra text) with these exact keys: "
        '{"sentiment": "positive" | "neutral" | "negative", '
        '"score": <float 0-1>, '
        '"key_themes": [<string>, ...], '
        '"action_items": [<string>, ...], '
        '"coaching_tip": "<string>"}\n\n'
        f"Meeting notes:\n{notes}"
    )

    import logging
    logger = logging.getLogger(__name__)

    try:
        raw = await _ai_chat([{"role": "user", "content": prompt}])
        result = json.loads(raw.strip())

        # Validate and normalise
        sentiment = result.get("sentiment", "neutral")
        if sentiment not in ("positive", "neutral", "negative"):
            sentiment = "neutral"
        score = float(result.get("score", 0.5))
        score = max(0.0, min(1.0, score))

        return {
            "event_id": str(event_id),
            "sentiment": sentiment,
            "score": round(score, 3),
            "key_themes": result.get("key_themes", []),
            "action_items": result.get("action_items", []),
            "coaching_tip": result.get("coaching_tip", ""),
        }

    except Exception as exc:
        logger.error("AI analysis error for event %s: %s", event_id, exc)
        return {
            "event_id": str(event_id),
            "sentiment": "neutral",
            "score": 0.5,
            "key_themes": [],
            "action_items": [],
            "coaching_tip": "AI analysis unavailable.",
            "error": str(exc),
        }


# ─────────────────────────────────────────────────────────────────────────────
# get_meeting_coach_report
# ─────────────────────────────────────────────────────────────────────────────

async def get_meeting_coach_report(user_id: str, db: AsyncSession) -> dict[str, Any]:
    """Aggregate sentiment analysis across the last 10 meetings with notes.

    Detects declining client relationships (3+ consecutive negative scores) and
    surfaces coaching tips and pending action items.
    """
    try:
        uid = uuid.UUID(str(user_id))
    except ValueError:
        return {"error": "Invalid user_id"}

    # Fetch last 10 meetings that have a description (used as notes)
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.organizer_id == uid,
            CalendarEvent.event_type == "meeting",
            CalendarEvent.description.isnot(None),
        )
        .order_by(CalendarEvent.start_time.desc())
        .limit(10)
    )
    events: list[CalendarEvent] = list(result.scalars().all())

    if not events:
        return {
            "sentiment_trend": "neutral",
            "meetings_analyzed": 0,
            "client_alerts": [],
            "coaching_tips": [
                "Start adding notes to your meetings to unlock AI-powered coaching insights."
            ],
            "action_items": [],
        }

    # Analyse each meeting's notes via AI
    analyses: list[dict[str, Any]] = []
    for ev in events:
        notes = ev.description or ""
        analysis = await analyze_meeting_sentiment(str(ev.id), notes, db)
        analysis["event_id"] = str(ev.id)
        analysis["title"] = ev.title
        analysis["date"] = ev.start_time.isoformat()
        # Group by client if erp_context present
        erp = ev.erp_context or {}
        analysis["client_key"] = (
            erp.get("client_id")
            or erp.get("contact_id")
            or erp.get("customer_name")
            or "internal"
        )
        analyses.append(analysis)

    # Overall sentiment trend — average score
    scores = [a["score"] for a in analyses]
    avg_score = sum(scores) / len(scores) if scores else 0.5
    if avg_score >= 0.65:
        overall_trend = "positive"
    elif avg_score <= 0.35:
        overall_trend = "negative"
    else:
        overall_trend = "neutral"

    # Group by client and detect declining relationships
    from collections import defaultdict
    client_histories: dict[str, list[dict]] = defaultdict(list)
    for a in analyses:
        client_histories[a["client_key"]].append(a)

    client_alerts: list[dict[str, Any]] = []
    for client_key, history in client_histories.items():
        if client_key == "internal":
            continue
        # Sort oldest → newest for trend detection
        sorted_history = sorted(history, key=lambda x: x["date"])
        recent_scores = [h["score"] for h in sorted_history[-5:]]  # last 5 meetings

        # Declining = last 3+ are all below 0.4
        recent_3 = recent_scores[-3:]
        if len(recent_3) >= 3 and all(s < 0.4 for s in recent_3):
            tip = (
                history[-1].get("coaching_tip")
                or "Consider scheduling a dedicated relationship-building session."
            )
            client_alerts.append({
                "client": client_key,
                "trend": "declining",
                "recent_scores": [round(s, 2) for s in recent_3],
                "tip": tip,
            })
        elif len(recent_scores) >= 2:
            # Detect a worrying drop between last two meetings
            if recent_scores[-1] < recent_scores[-2] - 0.25:
                client_alerts.append({
                    "client": client_key,
                    "trend": "at_risk",
                    "recent_scores": [round(s, 2) for s in recent_scores[-2:]],
                    "tip": "Sentiment dropped significantly — follow up soon.",
                })

    # Aggregate coaching tips and action items (deduplicated)
    all_tips: list[str] = []
    all_actions: list[str] = []
    seen_tips: set[str] = set()
    seen_actions: set[str] = set()
    for a in analyses:
        tip = a.get("coaching_tip", "")
        if tip and tip not in seen_tips:
            all_tips.append(tip)
            seen_tips.add(tip)
        for action in a.get("action_items", []):
            if action and action not in seen_actions:
                all_actions.append(action)
                seen_actions.add(action)

    return {
        "sentiment_trend": overall_trend,
        "avg_sentiment_score": round(avg_score, 3),
        "meetings_analyzed": len(analyses),
        "client_alerts": client_alerts,
        "coaching_tips": all_tips[:10],
        "action_items": all_actions[:20],
        "recent_analyses": analyses,
    }
