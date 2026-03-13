"""Advanced Support Analytics API — Phase 3.

Endpoints for snapshot-based analytics, agent leaderboards, AI impact,
channel breakdowns, volume forecasting, and customer health scoring.
"""

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.models.support import CustomerSatisfaction, Ticket, TicketComment  # noqa: F401
from app.models.support_phase3 import CustomerHealthScore, SupportAnalyticsSnapshot

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Inline Schemas ─────────────────────────────────────────────────────────────


class OverviewResponse(BaseModel):
    start_date: str
    end_date: str
    total_new: int
    total_resolved: int
    total_closed: int
    total_reopened: int
    avg_sla_compliance_pct: float | None
    avg_csat: float | None
    total_csat_responses: int
    channel_distribution: dict[str, int]
    priority_distribution: dict[str, int]
    snapshot_count: int


class TrendRow(BaseModel):
    snapshot_date: str
    new_tickets: int
    resolved_tickets: int
    closed_tickets: int
    reopened_tickets: int
    backlog_count: int
    sla_compliance_pct: float | None
    avg_response_minutes: float | None
    avg_resolution_minutes: float | None
    avg_csat: float | None
    csat_responses: int
    ai_classified_count: int
    ai_auto_responded_count: int
    ai_deflected_count: int
    channel_breakdown: dict | None
    priority_breakdown: dict | None
    category_breakdown: dict | None


class AgentLeaderboardEntry(BaseModel):
    user_id: str | None
    name: str | None
    resolved: int
    avg_csat: float | None
    avg_response_minutes: float | None


class AIImpactResponse(BaseModel):
    start_date: str
    end_date: str
    total_tickets: int
    ai_classified_count: int
    ai_auto_responded_count: int
    ai_deflected_count: int
    ai_classified_pct: float | None
    ai_auto_responded_pct: float | None
    ai_deflected_pct: float | None


class ChannelBreakdownResponse(BaseModel):
    start_date: str
    end_date: str
    channels: dict[str, int]


class ForecastPoint(BaseModel):
    date: str
    predicted_tickets: float


class CustomerHealthListItem(BaseModel):
    id: str
    customer_email: str
    contact_id: str | None
    overall_score: int
    engagement_score: int
    satisfaction_score: int
    effort_score: int
    risk_level: str
    churn_probability: float | None
    total_tickets: int
    last_ticket_at: str | None
    computed_at: str


class CustomerHealthDetail(CustomerHealthListItem):
    ticket_frequency: float | None
    avg_sentiment: float | None
    avg_csat: float | None
    score_factors: list | None


class ComputeHealthRequest(BaseModel):
    customer_email: str | None = None


class ComputeHealthResponse(BaseModel):
    computed: int
    message: str


# ── Helpers ────────────────────────────────────────────────────────────────────


def _parse_date_param(value: str, param_name: str) -> datetime:
    """Parse YYYY-MM-DD string into a UTC-aware datetime at midnight."""
    try:
        d = date.fromisoformat(value)
        return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid {param_name} format. Expected YYYY-MM-DD.",
        )


def _merge_json_counts(snapshots: list[SupportAnalyticsSnapshot], field: str) -> dict[str, int]:
    """Aggregate a JSON dict field (channel/priority/category breakdown) across snapshots."""
    merged: dict[str, int] = {}
    for snap in snapshots:
        breakdown: dict | None = getattr(snap, field, None)
        if not breakdown:
            continue
        for key, val in breakdown.items():
            merged[key] = merged.get(key, 0) + (int(val) if isinstance(val, (int, float)) else 0)
    return merged


def _aggregate_agent_performance(
    snapshots: list[SupportAnalyticsSnapshot],
) -> list[AgentLeaderboardEntry]:
    """Aggregate agent_performance JSON lists across snapshots into a leaderboard."""
    agent_map: dict[str, dict[str, Any]] = {}
    for snap in snapshots:
        perf_list: list | None = snap.agent_performance
        if not perf_list:
            continue
        for entry in perf_list:
            uid = str(entry.get("user_id", "")) or entry.get("name", "unknown")
            if uid not in agent_map:
                agent_map[uid] = {
                    "user_id": entry.get("user_id"),
                    "name": entry.get("name"),
                    "resolved": 0,
                    "csat_sum": 0.0,
                    "csat_count": 0,
                    "response_sum": 0.0,
                    "response_count": 0,
                }
            rec = agent_map[uid]
            resolved = int(entry.get("resolved", 0))
            rec["resolved"] += resolved

            avg_csat = entry.get("avg_csat")
            if avg_csat is not None:
                rec["csat_sum"] += float(avg_csat) * resolved
                rec["csat_count"] += resolved

            avg_resp = entry.get("avg_response_min")
            if avg_resp is not None:
                rec["response_sum"] += float(avg_resp) * resolved
                rec["response_count"] += resolved

    results: list[AgentLeaderboardEntry] = []
    for rec in agent_map.values():
        avg_csat = (rec["csat_sum"] / rec["csat_count"]) if rec["csat_count"] > 0 else None
        avg_resp = (rec["response_sum"] / rec["response_count"]) if rec["response_count"] > 0 else None
        results.append(
            AgentLeaderboardEntry(
                user_id=str(rec["user_id"]) if rec["user_id"] else None,
                name=rec["name"],
                resolved=rec["resolved"],
                avg_csat=round(avg_csat, 2) if avg_csat is not None else None,
                avg_response_minutes=round(avg_resp, 2) if avg_resp is not None else None,
            )
        )
    results.sort(key=lambda x: x.resolved, reverse=True)
    return results


# ── Endpoints ──────────────────────────────────────────────────────────────────


@router.get("/analytics/overview", response_model=OverviewResponse, summary="Aggregated support metrics for a date range")
async def analytics_overview(
    current_user: CurrentUser,
    db: DBSession,
    start_date: str = Query(..., description="Start date YYYY-MM-DD"),
    end_date: str = Query(..., description="End date YYYY-MM-DD"),
) -> OverviewResponse:
    """Return aggregated support metrics across all daily snapshots in the date range."""
    start_dt = _parse_date_param(start_date, "start_date")
    end_dt = _parse_date_param(end_date, "end_date") + timedelta(days=1)

    stmt = (
        select(SupportAnalyticsSnapshot)
        .where(
            SupportAnalyticsSnapshot.snapshot_date >= start_dt,
            SupportAnalyticsSnapshot.snapshot_date < end_dt,
        )
        .order_by(SupportAnalyticsSnapshot.snapshot_date)
    )
    result = await db.execute(stmt)
    snapshots = result.scalars().all()

    total_new = sum(s.new_tickets for s in snapshots)
    total_resolved = sum(s.resolved_tickets for s in snapshots)
    total_closed = sum(s.closed_tickets for s in snapshots)
    total_reopened = sum(s.reopened_tickets for s in snapshots)

    sla_values = [s.sla_compliance_pct for s in snapshots if s.sla_compliance_pct is not None]
    avg_sla = round(sum(sla_values) / len(sla_values), 2) if sla_values else None

    csat_weighted_sum = 0.0
    csat_total_responses = 0
    for s in snapshots:
        if s.avg_csat is not None and s.csat_responses > 0:
            csat_weighted_sum += s.avg_csat * s.csat_responses
            csat_total_responses += s.csat_responses
    avg_csat = round(csat_weighted_sum / csat_total_responses, 2) if csat_total_responses > 0 else None

    channel_dist = _merge_json_counts(list(snapshots), "channel_breakdown")
    priority_dist = _merge_json_counts(list(snapshots), "priority_breakdown")

    return OverviewResponse(
        start_date=start_date,
        end_date=end_date,
        total_new=total_new,
        total_resolved=total_resolved,
        total_closed=total_closed,
        total_reopened=total_reopened,
        avg_sla_compliance_pct=avg_sla,
        avg_csat=avg_csat,
        total_csat_responses=csat_total_responses,
        channel_distribution=channel_dist,
        priority_distribution=priority_dist,
        snapshot_count=len(snapshots),
    )


@router.get("/analytics/trends", response_model=list[TrendRow], summary="Daily time-series snapshot data")
async def analytics_trends(
    current_user: CurrentUser,
    db: DBSession,
    start_date: str = Query(..., description="Start date YYYY-MM-DD"),
    end_date: str = Query(..., description="End date YYYY-MM-DD"),
) -> list[TrendRow]:
    """Return all daily snapshots between start_date and end_date."""
    start_dt = _parse_date_param(start_date, "start_date")
    end_dt = _parse_date_param(end_date, "end_date") + timedelta(days=1)

    stmt = (
        select(SupportAnalyticsSnapshot)
        .where(
            SupportAnalyticsSnapshot.snapshot_date >= start_dt,
            SupportAnalyticsSnapshot.snapshot_date < end_dt,
        )
        .order_by(SupportAnalyticsSnapshot.snapshot_date)
    )
    result = await db.execute(stmt)
    snapshots = result.scalars().all()

    return [
        TrendRow(
            snapshot_date=s.snapshot_date.strftime("%Y-%m-%d"),
            new_tickets=s.new_tickets,
            resolved_tickets=s.resolved_tickets,
            closed_tickets=s.closed_tickets,
            reopened_tickets=s.reopened_tickets,
            backlog_count=s.backlog_count,
            sla_compliance_pct=s.sla_compliance_pct,
            avg_response_minutes=s.avg_response_minutes,
            avg_resolution_minutes=s.avg_resolution_minutes,
            avg_csat=s.avg_csat,
            csat_responses=s.csat_responses,
            ai_classified_count=s.ai_classified_count,
            ai_auto_responded_count=s.ai_auto_responded_count,
            ai_deflected_count=s.ai_deflected_count,
            channel_breakdown=s.channel_breakdown,
            priority_breakdown=s.priority_breakdown,
            category_breakdown=s.category_breakdown,
        )
        for s in snapshots
    ]


@router.get("/analytics/agents", response_model=list[AgentLeaderboardEntry], summary="Agent performance leaderboard")
async def analytics_agents(
    current_user: CurrentUser,
    db: DBSession,
    start_date: str = Query(..., description="Start date YYYY-MM-DD"),
    end_date: str = Query(..., description="End date YYYY-MM-DD"),
) -> list[AgentLeaderboardEntry]:
    """Return agent performance leaderboard aggregated from snapshots, sorted by resolved count."""
    start_dt = _parse_date_param(start_date, "start_date")
    end_dt = _parse_date_param(end_date, "end_date") + timedelta(days=1)

    stmt = (
        select(SupportAnalyticsSnapshot)
        .where(
            SupportAnalyticsSnapshot.snapshot_date >= start_dt,
            SupportAnalyticsSnapshot.snapshot_date < end_dt,
        )
    )
    result = await db.execute(stmt)
    snapshots = result.scalars().all()

    return _aggregate_agent_performance(list(snapshots))


@router.get("/analytics/ai-impact", response_model=AIImpactResponse, summary="AI impact metrics for a date range")
async def analytics_ai_impact(
    current_user: CurrentUser,
    db: DBSession,
    start_date: str = Query(..., description="Start date YYYY-MM-DD"),
    end_date: str = Query(..., description="End date YYYY-MM-DD"),
) -> AIImpactResponse:
    """Return AI classification, auto-response, and deflection counts with percentage of total tickets."""
    start_dt = _parse_date_param(start_date, "start_date")
    end_dt = _parse_date_param(end_date, "end_date") + timedelta(days=1)

    stmt = (
        select(SupportAnalyticsSnapshot)
        .where(
            SupportAnalyticsSnapshot.snapshot_date >= start_dt,
            SupportAnalyticsSnapshot.snapshot_date < end_dt,
        )
    )
    result = await db.execute(stmt)
    snapshots = result.scalars().all()

    total_new = sum(s.new_tickets for s in snapshots)
    ai_classified = sum(s.ai_classified_count for s in snapshots)
    ai_auto_responded = sum(s.ai_auto_responded_count for s in snapshots)
    ai_deflected = sum(s.ai_deflected_count for s in snapshots)

    def _pct(count: int) -> float | None:
        if total_new == 0:
            return None
        return round(count / total_new * 100, 2)

    return AIImpactResponse(
        start_date=start_date,
        end_date=end_date,
        total_tickets=total_new,
        ai_classified_count=ai_classified,
        ai_auto_responded_count=ai_auto_responded,
        ai_deflected_count=ai_deflected,
        ai_classified_pct=_pct(ai_classified),
        ai_auto_responded_pct=_pct(ai_auto_responded),
        ai_deflected_pct=_pct(ai_deflected),
    )


@router.get("/analytics/channels", response_model=ChannelBreakdownResponse, summary="Channel breakdown over date range")
async def analytics_channels(
    current_user: CurrentUser,
    db: DBSession,
    start_date: str = Query(..., description="Start date YYYY-MM-DD"),
    end_date: str = Query(..., description="End date YYYY-MM-DD"),
) -> ChannelBreakdownResponse:
    """Return aggregated channel breakdown across all snapshots in the date range."""
    start_dt = _parse_date_param(start_date, "start_date")
    end_dt = _parse_date_param(end_date, "end_date") + timedelta(days=1)

    stmt = (
        select(SupportAnalyticsSnapshot)
        .where(
            SupportAnalyticsSnapshot.snapshot_date >= start_dt,
            SupportAnalyticsSnapshot.snapshot_date < end_dt,
        )
    )
    result = await db.execute(stmt)
    snapshots = result.scalars().all()

    channels = _merge_json_counts(list(snapshots), "channel_breakdown")

    return ChannelBreakdownResponse(
        start_date=start_date,
        end_date=end_date,
        channels=channels,
    )


@router.get("/analytics/forecast", response_model=list[ForecastPoint], summary="7-day ticket volume forecast")
async def analytics_forecast(
    current_user: CurrentUser,
    db: DBSession,
) -> list[ForecastPoint]:
    """Compute a simple linear-trend forecast for the next 7 days using the last 30 days of snapshots."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    stmt = (
        select(SupportAnalyticsSnapshot)
        .where(SupportAnalyticsSnapshot.snapshot_date >= cutoff)
        .order_by(SupportAnalyticsSnapshot.snapshot_date)
    )
    result = await db.execute(stmt)
    snapshots = result.scalars().all()

    if not snapshots:
        # No data — return zeros for next 7 days
        today = date.today()
        return [
            ForecastPoint(
                date=(today + timedelta(days=i + 1)).isoformat(),
                predicted_tickets=0.0,
            )
            for i in range(7)
        ]

    # Build (x, y) pairs where x = day index, y = new_tickets
    xs = list(range(len(snapshots)))
    ys = [float(s.new_tickets) for s in snapshots]
    n = len(xs)

    sum_x = sum(xs)
    sum_y = sum(ys)
    sum_xx = sum(x * x for x in xs)
    sum_xy = sum(x * y for x, y in zip(xs, ys))

    denom = n * sum_xx - sum_x * sum_x
    if denom == 0:
        slope = 0.0
        intercept = sum_y / n if n > 0 else 0.0
    else:
        slope = (n * sum_xy - sum_x * sum_y) / denom
        intercept = (sum_y - slope * sum_x) / n

    last_date = snapshots[-1].snapshot_date.date()
    forecast: list[ForecastPoint] = []
    for i in range(1, 8):
        x_future = n - 1 + i
        predicted = max(0.0, round(intercept + slope * x_future, 2))
        forecast_date = last_date + timedelta(days=i)
        forecast.append(ForecastPoint(date=forecast_date.isoformat(), predicted_tickets=predicted))

    return forecast


@router.get("/analytics/customer-health", response_model=list[CustomerHealthListItem], summary="List customer health scores")
async def list_customer_health(
    current_user: CurrentUser,
    db: DBSession,
    risk_level: str | None = Query(None, description="Filter by risk level: healthy, at_risk, critical"),
    sort_by: str = Query("overall_score", description="Sort field: overall_score, churn_probability, total_tickets"),
    order: str = Query("desc", description="Sort order: asc or desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> list[CustomerHealthListItem]:
    """List customer health scores with optional risk_level filter, sorted and paginated."""
    stmt = select(CustomerHealthScore)

    if risk_level:
        stmt = stmt.where(CustomerHealthScore.risk_level == risk_level)

    sort_column_map = {
        "overall_score": CustomerHealthScore.overall_score,
        "churn_probability": CustomerHealthScore.churn_probability,
        "total_tickets": CustomerHealthScore.total_tickets,
        "computed_at": CustomerHealthScore.computed_at,
    }
    sort_col = sort_column_map.get(sort_by, CustomerHealthScore.overall_score)
    if order.lower() == "asc":
        stmt = stmt.order_by(sort_col.asc())
    else:
        stmt = stmt.order_by(sort_col.desc())

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    records = result.scalars().all()

    return [
        CustomerHealthListItem(
            id=str(r.id),
            customer_email=r.customer_email,
            contact_id=str(r.contact_id) if r.contact_id else None,
            overall_score=r.overall_score,
            engagement_score=r.engagement_score,
            satisfaction_score=r.satisfaction_score,
            effort_score=r.effort_score,
            risk_level=r.risk_level,
            churn_probability=r.churn_probability,
            total_tickets=r.total_tickets,
            last_ticket_at=r.last_ticket_at.isoformat() if r.last_ticket_at else None,
            computed_at=r.computed_at.isoformat(),
        )
        for r in records
    ]


@router.get("/analytics/customer-health/{customer_email:path}", response_model=CustomerHealthDetail, summary="Get single customer health detail")
async def get_customer_health(
    customer_email: str,
    current_user: CurrentUser,
    db: DBSession,
) -> CustomerHealthDetail:
    """Return full health detail for a specific customer email, including score factors."""
    stmt = (
        select(CustomerHealthScore)
        .where(CustomerHealthScore.customer_email == customer_email)
        .order_by(CustomerHealthScore.computed_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(status_code=404, detail=f"No health score found for '{customer_email}'")

    return CustomerHealthDetail(
        id=str(record.id),
        customer_email=record.customer_email,
        contact_id=str(record.contact_id) if record.contact_id else None,
        overall_score=record.overall_score,
        engagement_score=record.engagement_score,
        satisfaction_score=record.satisfaction_score,
        effort_score=record.effort_score,
        risk_level=record.risk_level,
        churn_probability=record.churn_probability,
        total_tickets=record.total_tickets,
        last_ticket_at=record.last_ticket_at.isoformat() if record.last_ticket_at else None,
        computed_at=record.computed_at.isoformat(),
        ticket_frequency=record.ticket_frequency,
        avg_sentiment=record.avg_sentiment,
        avg_csat=record.avg_csat,
        score_factors=record.score_factors,
    )


@router.post("/analytics/customer-health/compute", response_model=ComputeHealthResponse, summary="Recompute customer health scores")
async def compute_customer_health(
    current_user: CurrentUser,
    db: DBSession,
    customer_email: str | None = Query(None, description="Recompute for a specific customer only"),
) -> ComputeHealthResponse:
    """Recompute CustomerHealthScore records for all customers (or a specific one).

    Scoring methodology:
    - ticket_frequency: tickets/30-day rolling window
    - avg_sentiment: mean of ticket sentiment_score (-1 to 1)
    - avg_csat: mean of CSAT ratings from CustomerSatisfaction (1–5 scaled to 0–100)
    - effort_score: inverse of avg first-response minutes (faster = higher)
    - engagement_score: based on recency of last ticket
    - satisfaction_score: from avg_csat
    - overall_score: weighted average of sub-scores
    - risk_level: critical (<35), at_risk (35–65), healthy (>65)
    - churn_probability: linear interpolation from overall_score
    """
    now = datetime.now(timezone.utc)
    window_30 = now - timedelta(days=30)
    window_90 = now - timedelta(days=90)

    # Determine which customer emails to process
    if customer_email:
        emails_to_process = [customer_email]
    else:
        # Get distinct customer emails from tickets in the last 90 days
        stmt_emails = (
            select(Ticket.customer_email)
            .where(
                Ticket.customer_email.isnot(None),
                Ticket.created_at >= window_90,
            )
            .distinct()
        )
        email_result = await db.execute(stmt_emails)
        emails_to_process = [row[0] for row in email_result.fetchall() if row[0]]

    computed_count = 0

    for email in emails_to_process:
        # --- Ticket frequency (last 30 days) ---
        stmt_recent = select(func.count()).select_from(Ticket).where(
            Ticket.customer_email == email,
            Ticket.created_at >= window_30,
        )
        recent_count_result = await db.execute(stmt_recent)
        recent_count = recent_count_result.scalar() or 0
        ticket_frequency = float(recent_count)  # tickets per 30 days

        # --- Total ticket count ---
        stmt_total = select(func.count()).select_from(Ticket).where(
            Ticket.customer_email == email,
        )
        total_result = await db.execute(stmt_total)
        total_tickets = total_result.scalar() or 0

        # --- Last ticket timestamp ---
        stmt_last = (
            select(Ticket.created_at)
            .where(Ticket.customer_email == email)
            .order_by(Ticket.created_at.desc())
            .limit(1)
        )
        last_result = await db.execute(stmt_last)
        last_ticket_at = last_result.scalar_one_or_none()

        # --- Avg sentiment score ---
        stmt_sentiment = select(func.avg(Ticket.sentiment_score)).where(
            Ticket.customer_email == email,
            Ticket.sentiment_score.isnot(None),
        )
        sentiment_result = await db.execute(stmt_sentiment)
        avg_sentiment = sentiment_result.scalar_one_or_none()
        avg_sentiment = float(avg_sentiment) if avg_sentiment is not None else None

        # --- Avg CSAT (via join Ticket → CustomerSatisfaction) ---
        stmt_csat = (
            select(func.avg(CustomerSatisfaction.rating))
            .join(Ticket, CustomerSatisfaction.ticket_id == Ticket.id)
            .where(Ticket.customer_email == email)
        )
        csat_result = await db.execute(stmt_csat)
        avg_csat_raw = csat_result.scalar_one_or_none()
        avg_csat = float(avg_csat_raw) if avg_csat_raw is not None else None

        # --- Avg first response time (minutes) ---
        stmt_resp = select(
            func.avg(
                func.extract(
                    "epoch",
                    Ticket.first_response_at - Ticket.created_at,
                ) / 60
            )
        ).where(
            Ticket.customer_email == email,
            Ticket.first_response_at.isnot(None),
        )
        resp_result = await db.execute(stmt_resp)
        avg_response_minutes_raw = resp_result.scalar_one_or_none()
        avg_response_minutes = float(avg_response_minutes_raw) if avg_response_minutes_raw is not None else None

        # --- Linked contact_id ---
        stmt_contact = (
            select(Ticket.contact_id)
            .where(
                Ticket.customer_email == email,
                Ticket.contact_id.isnot(None),
            )
            .limit(1)
        )
        contact_result = await db.execute(stmt_contact)
        contact_id = contact_result.scalar_one_or_none()

        # ── Score computation ──────────────────────────────────────────────────

        score_factors: list[dict] = []

        # Engagement score: based on recency (days since last ticket, lower = more engaged)
        if last_ticket_at:
            days_since = (now - last_ticket_at).days
            if days_since <= 7:
                engagement_score = 90
            elif days_since <= 30:
                engagement_score = 70
            elif days_since <= 60:
                engagement_score = 50
            elif days_since <= 90:
                engagement_score = 30
            else:
                engagement_score = 10
            score_factors.append({"factor": f"Last ticket {days_since} days ago", "impact": engagement_score - 50})
        else:
            engagement_score = 50

        # Satisfaction score: from avg CSAT (1–5 → 0–100)
        if avg_csat is not None:
            satisfaction_score = round((avg_csat - 1) / 4 * 100)
            impact = satisfaction_score - 50
            score_factors.append({"factor": f"Avg CSAT {avg_csat:.1f}/5", "impact": impact})
        else:
            satisfaction_score = 50

        # Effort score: based on avg response time (faster = better)
        if avg_response_minutes is not None:
            if avg_response_minutes <= 30:
                effort_score = 90
            elif avg_response_minutes <= 120:
                effort_score = 70
            elif avg_response_minutes <= 480:
                effort_score = 50
            elif avg_response_minutes <= 1440:
                effort_score = 30
            else:
                effort_score = 10
            score_factors.append({"factor": f"Avg first response {avg_response_minutes:.0f} min", "impact": effort_score - 50})
        else:
            effort_score = 50

        # Sentiment adjustment
        if avg_sentiment is not None:
            # avg_sentiment is -1.0 to 1.0; scale to -20 to +20 impact
            sentiment_impact = round(avg_sentiment * 20)
            score_factors.append({"factor": f"Avg sentiment {avg_sentiment:.2f}", "impact": sentiment_impact})
        else:
            sentiment_impact = 0

        # Ticket frequency penalty (too many tickets in 30 days = customer struggling)
        if ticket_frequency > 10:
            freq_impact = -20
            score_factors.append({"factor": f"High ticket frequency ({ticket_frequency:.0f}/mo)", "impact": freq_impact})
        elif ticket_frequency > 5:
            freq_impact = -10
            score_factors.append({"factor": f"Elevated ticket frequency ({ticket_frequency:.0f}/mo)", "impact": freq_impact})
        else:
            freq_impact = 0

        # Weighted overall score
        overall_score = round(
            0.30 * engagement_score
            + 0.35 * satisfaction_score
            + 0.20 * effort_score
            + sentiment_impact
            + freq_impact
        )
        overall_score = max(0, min(100, overall_score))

        # Risk classification
        if overall_score > 65:
            risk_level = "healthy"
        elif overall_score >= 35:
            risk_level = "at_risk"
        else:
            risk_level = "critical"

        # Churn probability: inverse linear (score 0→prob 0.95, score 100→prob 0.02)
        churn_probability = round(max(0.02, min(0.95, 0.95 - (overall_score / 100) * 0.93)), 3)

        # ── Upsert CustomerHealthScore ─────────────────────────────────────────
        stmt_existing = (
            select(CustomerHealthScore)
            .where(CustomerHealthScore.customer_email == email)
            .limit(1)
        )
        existing_result = await db.execute(stmt_existing)
        record = existing_result.scalar_one_or_none()

        if record is None:
            record = CustomerHealthScore(customer_email=email)
            db.add(record)

        record.contact_id = contact_id
        record.overall_score = overall_score
        record.engagement_score = engagement_score
        record.satisfaction_score = satisfaction_score
        record.effort_score = effort_score
        record.ticket_frequency = ticket_frequency
        record.avg_sentiment = round(avg_sentiment, 4) if avg_sentiment is not None else None
        record.avg_csat = round(avg_csat, 4) if avg_csat is not None else None
        record.last_ticket_at = last_ticket_at
        record.total_tickets = total_tickets
        record.risk_level = risk_level
        record.churn_probability = churn_probability
        record.score_factors = score_factors
        record.computed_at = now

        computed_count += 1

    await db.commit()

    return ComputeHealthResponse(
        computed=computed_count,
        message=f"Health scores computed for {computed_count} customer(s).",
    )
