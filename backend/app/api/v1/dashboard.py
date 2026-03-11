"""Dashboard API — aggregated stats and activity feed across all modules."""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/stats", summary="Aggregated dashboard statistics")
async def dashboard_stats(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Return real-time stats from Finance, HR, CRM, and Projects.

    Response shape is flat to match frontend DashboardStats interface.
    """
    from app.models.finance import Invoice, Payment  # noqa: PLC0415
    from app.models.hr import Employee, LeaveRequest  # noqa: PLC0415
    from app.models.crm import Lead, Opportunity, Deal  # noqa: PLC0415
    from app.models.projects import Project, Task  # noqa: PLC0415

    today = date.today()
    month_start = today.replace(day=1)

    # Previous month range (for revenue_prev)
    prev_month_end = month_start - timedelta(days=1)
    prev_month_start = prev_month_end.replace(day=1)

    # Finance stats
    outstanding_q = select(
        func.count(), func.coalesce(func.sum(Invoice.total), 0)
    ).where(Invoice.status.in_(["sent", "overdue"]))
    outstanding_result = await db.execute(outstanding_q)
    outstanding_count, outstanding_amount = outstanding_result.one()

    revenue_q = select(func.coalesce(func.sum(Payment.amount), 0)).where(
        Payment.status == "completed",
        Payment.payment_date >= month_start,
    )
    revenue_result = await db.execute(revenue_q)
    revenue_mtd = revenue_result.scalar() or 0

    # Previous month revenue for comparison
    revenue_prev_q = select(func.coalesce(func.sum(Payment.amount), 0)).where(
        Payment.status == "completed",
        Payment.payment_date >= prev_month_start,
        Payment.payment_date < month_start,
    )
    revenue_prev_result = await db.execute(revenue_prev_q)
    revenue_prev = revenue_prev_result.scalar() or 0

    # HR stats
    headcount_q = select(func.count()).select_from(Employee).where(Employee.is_active == True)  # noqa: E712
    headcount = (await db.execute(headcount_q)).scalar() or 0

    on_leave_q = select(func.count()).select_from(LeaveRequest).where(
        LeaveRequest.status == "approved",
        LeaveRequest.start_date <= today,
        LeaveRequest.end_date >= today,
    )
    on_leave = (await db.execute(on_leave_q)).scalar() or 0

    # CRM stats
    new_leads_q = select(func.count()).select_from(Lead).where(
        Lead.created_at >= datetime(month_start.year, month_start.month, month_start.day, tzinfo=timezone.utc),
    )
    new_leads = (await db.execute(new_leads_q)).scalar() or 0

    pipeline_q = select(func.coalesce(func.sum(Opportunity.expected_value), 0)).where(
        Opportunity.stage.notin_(["closed_won", "closed_lost"]),
    )
    pipeline_value = (await db.execute(pipeline_q)).scalar() or 0

    deals_q = select(func.count(), func.coalesce(func.sum(Deal.deal_value), 0)).where(
        Deal.close_date >= month_start,
        Deal.status == "active",
    )
    deals_result = await db.execute(deals_q)
    deals_count, deals_value = deals_result.one()

    # Projects stats
    active_projects_q = select(func.count()).select_from(Project).where(Project.status == "active")
    active_projects = (await db.execute(active_projects_q)).scalar() or 0

    open_tasks_q = select(func.count()).select_from(Task).where(Task.status.in_(["todo", "in_progress"]))
    open_tasks = (await db.execute(open_tasks_q)).scalar() or 0

    # Flat response matching frontend DashboardStats interface
    return {
        "revenue_mtd": float(revenue_mtd),
        "revenue_prev": float(revenue_prev),
        "open_invoices": outstanding_count,
        "active_employees": headcount,
        "active_projects": active_projects,
        "deals_pipeline": float(pipeline_value),
        # Extended fields for detailed views
        "outstanding_amount": float(outstanding_amount),
        "on_leave_today": on_leave,
        "new_leads_this_month": new_leads,
        "deals_closed_this_month": deals_count,
        "deals_value_this_month": float(deals_value),
        "open_tasks": open_tasks,
    }


@router.get("/activity", summary="Recent activity feed across modules")
async def dashboard_activity(
    current_user: CurrentUser,
    db: DBSession,
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    """Return the latest cross-module activity entries."""
    from app.models.activity import ActivityFeedEntry  # noqa: PLC0415

    query = (
        select(ActivityFeedEntry)
        .order_by(ActivityFeedEntry.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    entries = result.scalars().all()

    return {
        "items": [
            {
                "id": str(e.id),
                "activity_type": e.activity_type,
                "message": e.message,
                "module": e.module,
                "user_id": str(e.user_id),
                "metadata": e.metadata_json,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in entries
        ]
    }
