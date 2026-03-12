"""CRM reports, dashboards, and gamification endpoints."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.models.crm import Lead, Opportunity
from app.models.crm_reports import DashboardWidget, GamificationScore, SavedReport
from app.services.crm_gamification import compute_daily_scores, get_leaderboard

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class SavedReportCreate(BaseModel):
    name: str
    report_type: str  # pipeline, revenue, activity, conversion, forecast
    config: dict[str, Any] | None = None
    is_favorite: bool = False
    is_shared: bool = False


class SavedReportUpdate(BaseModel):
    name: str | None = None
    report_type: str | None = None
    config: dict[str, Any] | None = None
    is_favorite: bool | None = None
    is_shared: bool | None = None


class SavedReportOut(BaseModel):
    id: uuid.UUID
    name: str
    report_type: str
    config: dict[str, Any] | None
    is_favorite: bool
    is_shared: bool
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}


class DashboardWidgetCreate(BaseModel):
    dashboard_id: uuid.UUID | None = None
    widget_type: str  # stat_card, chart, table, funnel, leaderboard
    title: str
    config: dict[str, Any] | None = None
    position_x: int = 0
    position_y: int = 0
    width: int = 4
    height: int = 3


class DashboardWidgetUpdate(BaseModel):
    widget_type: str | None = None
    title: str | None = None
    config: dict[str, Any] | None = None
    position_x: int | None = None
    position_y: int | None = None
    width: int | None = None
    height: int | None = None


class DashboardWidgetOut(BaseModel):
    id: uuid.UUID
    dashboard_id: uuid.UUID | None
    widget_type: str
    title: str
    config: dict[str, Any] | None
    position_x: int
    position_y: int
    width: int
    height: int
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}


class GamificationScoreOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    period: str
    period_start: date
    score: int
    deals_closed: int
    deals_value: Decimal
    activities_completed: int
    leads_converted: int
    metadata_json: dict[str, Any] | None

    model_config = {"from_attributes": True}


class FunnelStage(BaseModel):
    stage: str
    count: int
    total_value: Decimal


class CohortRow(BaseModel):
    month: str
    total_leads: int
    converted_leads: int


# ---------------------------------------------------------------------------
# 1. Pipeline funnel report
# ---------------------------------------------------------------------------


@router.get("/reports/funnel", response_model=list[FunnelStage])
async def pipeline_funnel_report(
    current_user: CurrentUser,
    db: DBSession,
):
    """Pipeline funnel: count + total expected_value grouped by stage."""
    stmt = (
        select(
            Opportunity.stage,
            func.count(Opportunity.id).label("count"),
            func.coalesce(func.sum(Opportunity.expected_value), 0).label("total_value"),
        )
        .group_by(Opportunity.stage)
        .order_by(func.count(Opportunity.id).desc())
    )
    rows = (await db.execute(stmt)).all()
    return [
        FunnelStage(stage=r.stage, count=r.count, total_value=r.total_value)
        for r in rows
    ]


# ---------------------------------------------------------------------------
# 2. Cohort report
# ---------------------------------------------------------------------------


@router.get("/reports/cohort", response_model=list[CohortRow])
async def cohort_report(
    current_user: CurrentUser,
    db: DBSession,
):
    """Cohort report: leads grouped by created_at month with conversion counts."""
    month_expr = func.to_char(Lead.created_at, "YYYY-MM")
    stmt = (
        select(
            month_expr.label("month"),
            func.count(Lead.id).label("total_leads"),
            func.count(func.nullif(Lead.status != "converted", True)).label(
                "converted_leads"
            ),
        )
        .group_by(month_expr)
        .order_by(month_expr)
    )
    rows = (await db.execute(stmt)).all()
    return [
        CohortRow(month=r.month, total_leads=r.total_leads, converted_leads=r.converted_leads)
        for r in rows
    ]


# ---------------------------------------------------------------------------
# 3. Leaderboard
# ---------------------------------------------------------------------------


@router.get("/reports/leaderboard")
async def leaderboard(
    current_user: CurrentUser,
    db: DBSession,
    period: str = Query("weekly", regex="^(daily|weekly|monthly)$"),
    limit: int = Query(10, ge=1, le=100),
):
    """Gamification leaderboard."""
    return await get_leaderboard(db, period=period, limit=limit)


# ---------------------------------------------------------------------------
# 4. Compute daily scores
# ---------------------------------------------------------------------------


@router.post("/reports/compute-scores", status_code=status.HTTP_202_ACCEPTED)
async def trigger_compute_scores(
    current_user: CurrentUser,
    db: DBSession,
):
    """Trigger daily gamification score computation."""
    await compute_daily_scores(db)
    return {"detail": "Daily scores computed successfully."}


# ---------------------------------------------------------------------------
# 5-8. Saved reports CRUD
# ---------------------------------------------------------------------------


@router.get("/saved-reports")
async def list_saved_reports(
    current_user: CurrentUser,
    db: DBSession,
    report_type: str | None = Query(None),
    is_favorite: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """List saved reports for current user (paginated)."""
    base = select(SavedReport).where(SavedReport.owner_id == current_user.id)
    if report_type is not None:
        base = base.where(SavedReport.report_type == report_type)
    if is_favorite is not None:
        base = base.where(SavedReport.is_favorite == is_favorite)

    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar_one()

    items_result = await db.execute(base.offset(skip).limit(limit))
    items = items_result.scalars().all()

    return {
        "total": total,
        "items": [SavedReportOut.model_validate(i) for i in items],
    }


@router.post("/saved-reports", response_model=SavedReportOut, status_code=status.HTTP_201_CREATED)
async def create_saved_report(
    payload: SavedReportCreate,
    current_user: CurrentUser,
    db: DBSession,
):
    """Create a saved report."""
    report = SavedReport(
        name=payload.name,
        report_type=payload.report_type,
        config=payload.config,
        is_favorite=payload.is_favorite,
        is_shared=payload.is_shared,
        owner_id=current_user.id,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


@router.put("/saved-reports/{report_id}", response_model=SavedReportOut)
async def update_saved_report(
    report_id: uuid.UUID,
    payload: SavedReportUpdate,
    current_user: CurrentUser,
    db: DBSession,
):
    """Update a saved report."""
    result = await db.execute(
        select(SavedReport).where(
            SavedReport.id == report_id,
            SavedReport.owner_id == current_user.id,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved report not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(report, key, value)

    await db.commit()
    await db.refresh(report)
    return report


@router.delete("/saved-reports/{report_id}", status_code=status.HTTP_200_OK)
async def delete_saved_report(
    report_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """Delete a saved report."""
    result = await db.execute(
        select(SavedReport).where(
            SavedReport.id == report_id,
            SavedReport.owner_id == current_user.id,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved report not found")

    await db.delete(report)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# 9-12. Dashboard widgets CRUD
# ---------------------------------------------------------------------------


@router.get("/dashboard-widgets")
async def list_dashboard_widgets(
    current_user: CurrentUser,
    db: DBSession,
    dashboard_id: uuid.UUID | None = Query(None),
):
    """List widgets for the current user, optionally filtered by dashboard_id."""
    base = select(DashboardWidget).where(DashboardWidget.owner_id == current_user.id)
    if dashboard_id is not None:
        base = base.where(DashboardWidget.dashboard_id == dashboard_id)

    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar_one()

    items_result = await db.execute(base.order_by(DashboardWidget.position_y, DashboardWidget.position_x))
    items = items_result.scalars().all()

    return {
        "total": total,
        "items": [DashboardWidgetOut.model_validate(i) for i in items],
    }


@router.post("/dashboard-widgets", response_model=DashboardWidgetOut, status_code=status.HTTP_201_CREATED)
async def create_dashboard_widget(
    payload: DashboardWidgetCreate,
    current_user: CurrentUser,
    db: DBSession,
):
    """Create a dashboard widget."""
    widget = DashboardWidget(
        dashboard_id=payload.dashboard_id,
        widget_type=payload.widget_type,
        title=payload.title,
        config=payload.config,
        position_x=payload.position_x,
        position_y=payload.position_y,
        width=payload.width,
        height=payload.height,
        owner_id=current_user.id,
    )
    db.add(widget)
    await db.commit()
    await db.refresh(widget)
    return widget


@router.put("/dashboard-widgets/{widget_id}", response_model=DashboardWidgetOut)
async def update_dashboard_widget(
    widget_id: uuid.UUID,
    payload: DashboardWidgetUpdate,
    current_user: CurrentUser,
    db: DBSession,
):
    """Update a dashboard widget (position, config, size)."""
    result = await db.execute(
        select(DashboardWidget).where(
            DashboardWidget.id == widget_id,
            DashboardWidget.owner_id == current_user.id,
        )
    )
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard widget not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(widget, key, value)

    await db.commit()
    await db.refresh(widget)
    return widget


@router.delete("/dashboard-widgets/{widget_id}", status_code=status.HTTP_200_OK)
async def delete_dashboard_widget(
    widget_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """Delete a dashboard widget."""
    result = await db.execute(
        select(DashboardWidget).where(
            DashboardWidget.id == widget_id,
            DashboardWidget.owner_id == current_user.id,
        )
    )
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard widget not found")

    await db.delete(widget)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# 13. Current user's gamification scores
# ---------------------------------------------------------------------------


@router.get("/gamification/my-score", response_model=list[GamificationScoreOut])
async def my_gamification_scores(
    current_user: CurrentUser,
    db: DBSession,
):
    """Get current user's gamification scores for the last 30 days."""
    cutoff = date.today() - timedelta(days=30)
    stmt = (
        select(GamificationScore)
        .where(
            GamificationScore.user_id == current_user.id,
            GamificationScore.period_start >= cutoff,
        )
        .order_by(GamificationScore.period_start.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()
