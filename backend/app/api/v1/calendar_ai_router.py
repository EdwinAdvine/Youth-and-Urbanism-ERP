"""Calendar AI endpoints — NLP event creation, scheduling suggestions, smart rescheduling."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.deps import CurrentUser, DBSession

router = APIRouter(prefix="/calendar/ai", tags=["Calendar - AI"])


class NLPEventRequest(BaseModel):
    text: str


class SuggestTimesRequest(BaseModel):
    attendee_ids: list[str]
    duration_minutes: int = 30
    days_ahead: int = 7


@router.post("/parse-event")
async def parse_natural_language_event(
    payload: NLPEventRequest,
    db: DBSession,
    user: CurrentUser,
):
    """Parse free-text into a structured calendar event."""
    from app.services.calendar_ai import parse_natural_language_event as parse_nlp  # noqa: PLC0415

    try:
        result = await parse_nlp(payload.text, str(user.id), db)
        return result
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/suggest-times")
async def suggest_optimal_times(
    payload: SuggestTimesRequest,
    db: DBSession,
    user: CurrentUser,
):
    """Suggest top 3 optimal meeting times for the given attendees."""
    from app.services.calendar_ai import suggest_optimal_times as suggest  # noqa: PLC0415

    slots = await suggest(
        attendee_ids=payload.attendee_ids,
        duration_minutes=payload.duration_minutes,
        db=db,
        days_ahead=payload.days_ahead,
    )
    return {"suggestions": slots}


@router.post("/reschedule/{event_id}")
async def suggest_reschedule(
    event_id: str,
    db: DBSession,
    user: CurrentUser,
):
    """Suggest alternative times for an event that has conflicts."""
    from app.services.calendar_ai import suggest_reschedule as reschedule  # noqa: PLC0415

    suggestions = await reschedule(event_id, db)
    return {"suggestions": suggestions}
