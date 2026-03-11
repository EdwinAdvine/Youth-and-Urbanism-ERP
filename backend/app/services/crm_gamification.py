"""CRM Gamification — compute periodic scores for sales team leaderboards."""
from __future__ import annotations

import logging
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.crm import Deal, Lead, SalesActivity
from app.models.crm_reports import GamificationScore
from app.models.user import User

logger = logging.getLogger(__name__)


async def compute_daily_scores(db: AsyncSession) -> dict:
    """Compute daily gamification scores for all active users."""
    today = date.today()
    yesterday = today - timedelta(days=1)

    # Get all users
    users_result = await db.execute(select(User.id))
    user_ids = [row for row in users_result.scalars().all()]

    computed = 0
    for user_id in user_ids:
        # Deals closed yesterday
        deals_result = await db.execute(
            select(func.count(), func.coalesce(func.sum(Deal.deal_value), 0)).where(
                Deal.owner_id == user_id,
                Deal.close_date == yesterday,
            )
        )
        deals_row = deals_result.one()
        deals_closed = deals_row[0] or 0
        deals_value = Decimal(str(deals_row[1] or 0))

        # Activities completed yesterday
        activities_result = await db.execute(
            select(func.count()).where(
                SalesActivity.owner_id == user_id,
                func.date(SalesActivity.completed_at) == yesterday,
            )
        )
        activities_completed = activities_result.scalar() or 0

        # Leads converted yesterday
        leads_result = await db.execute(
            select(func.count()).where(
                Lead.owner_id == user_id,
                Lead.status == "converted",
                func.date(Lead.updated_at) == yesterday,
            )
        )
        leads_converted = leads_result.scalar() or 0

        # Calculate score: deal_value/100 + activities*5 + leads_converted*20
        score = int(deals_value / 100) + (activities_completed * 5) + (leads_converted * 20)

        if score > 0 or deals_closed > 0 or activities_completed > 0:
            gs = GamificationScore(
                user_id=user_id,
                period="daily",
                period_start=yesterday,
                score=score,
                deals_closed=deals_closed,
                deals_value=deals_value,
                activities_completed=activities_completed,
                leads_converted=leads_converted,
            )
            db.add(gs)
            computed += 1

    await db.flush()
    return {"computed": computed, "date": yesterday.isoformat()}


async def get_leaderboard(db: AsyncSession, period: str = "monthly", limit: int = 20) -> list[dict]:
    """Get the top scorers for a given period."""
    today = date.today()
    if period == "daily":
        start = today - timedelta(days=1)
    elif period == "weekly":
        start = today - timedelta(days=7)
    else:
        start = today.replace(day=1)

    stmt = (
        select(
            GamificationScore.user_id,
            func.sum(GamificationScore.score).label("total_score"),
            func.sum(GamificationScore.deals_closed).label("total_deals"),
            func.sum(GamificationScore.deals_value).label("total_value"),
            func.sum(GamificationScore.activities_completed).label("total_activities"),
            func.sum(GamificationScore.leads_converted).label("total_leads"),
        )
        .where(
            GamificationScore.period == "daily",
            GamificationScore.period_start >= start,
        )
        .group_by(GamificationScore.user_id)
        .order_by(func.sum(GamificationScore.score).desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        {
            "user_id": str(row.user_id),
            "total_score": row.total_score or 0,
            "total_deals": row.total_deals or 0,
            "total_value": float(row.total_value or 0),
            "total_activities": row.total_activities or 0,
            "total_leads": row.total_leads or 0,
            "rank": idx + 1,
        }
        for idx, row in enumerate(rows)
    ]
