"""Calendar ROI & AI Meeting Coach endpoints."""

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.core.deps import CurrentUser, DBSession
from app.services.calendar_roi import (
    analyze_meeting_sentiment,
    calculate_meeting_roi,
    get_meeting_coach_report,
    get_meeting_roi_dashboard,
)

router = APIRouter(prefix="/calendar", tags=["Calendar - ROI & Coaching"])


# ── Request schemas ────────────────────────────────────────────────────────────

class SentimentRequest(BaseModel):
    notes: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get(
    "/events/{event_id}/roi",
    summary="Calculate ROI for a single meeting",
    response_model=None,
)
async def get_meeting_roi(
    event_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Return cost breakdown, attributed revenue, and ROI % for one meeting.

    Salary data is pulled from HR employee records (monthly → hourly via /160).
    Revenue attribution uses invoices paid in the last 90 days where the event
    has a client_id or deal_id in erp_context.
    """
    result = await calculate_meeting_roi(str(event_id), db)
    if "error" in result:
        status_code = 404 if result["error"] in ("Event not found", "Invalid event_id") else 400
        raise HTTPException(status_code=status_code, detail=result["error"])
    return result


@router.get(
    "/roi-dashboard",
    summary="Meeting ROI dashboard for the current user",
    response_model=None,
)
async def meeting_roi_dashboard(
    current_user: CurrentUser,
    db: DBSession,
    days: int = Query(90, ge=7, le=365, description="Look-back window in days"),
) -> dict[str, Any]:
    """Aggregate meeting costs, client vs internal split, and top 5 most expensive
    meetings for the authenticated user over the requested period.
    """
    result = await get_meeting_roi_dashboard(str(current_user.id), days, db)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post(
    "/events/{event_id}/analyze-sentiment",
    summary="Run Ollama sentiment analysis on meeting notes",
    response_model=None,
)
async def analyze_event_sentiment(
    event_id: uuid.UUID,
    body: SentimentRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Send meeting notes through the local Ollama model and receive:
    sentiment (positive/neutral/negative), a 0-1 score, key themes,
    extracted action items, and a coaching tip.
    """
    result = await analyze_meeting_sentiment(str(event_id), body.notes, db)
    return result


@router.get(
    "/meeting-coach",
    summary="Full AI meeting coach report for the current user",
    response_model=None,
)
async def meeting_coach_report(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Analyse the last 10 meetings with notes via Ollama.

    Returns:
    - Overall sentiment trend (positive / neutral / negative)
    - Client alerts — relationships showing 3+ consecutive negative scores
    - Aggregated coaching tips
    - Pending action items extracted from all analysed meetings
    """
    result = await get_meeting_coach_report(str(current_user.id), db)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result
