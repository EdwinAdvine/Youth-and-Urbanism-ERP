"""Analytics Extension API — dashboards, widgets, queries, reports, alerts, KPIs."""
from __future__ import annotations

import csv
import io
import logging
import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, text

from app.core.deps import CurrentUser, DBSession
from app.models.analytics import (
    Dashboard,
    AnalyticsDashboardWidget as DashboardWidget,
    DataAlert,
    Report,
    SavedQuery,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Regex to reject non-SELECT SQL ───────────────────────────────────────────
_FORBIDDEN_SQL_RE = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXEC|EXECUTE|MERGE|CALL|SET|COPY|VACUUM|REINDEX|CLUSTER|COMMENT|LOCK|NOTIFY|LISTEN|UNLISTEN|DISCARD|PREPARE|DEALLOCATE|SAVEPOINT|RELEASE|ROLLBACK|COMMIT|BEGIN)\b",
    re.IGNORECASE,
)
_VALID_SELECT_RE = re.compile(r"^\s*(SELECT|WITH)\b", re.IGNORECASE)


def _validate_readonly_sql(sql: str):
    """Raise 400 if SQL is not a read-only SELECT statement."""
    stripped = sql.strip().rstrip(";").strip()
    if not _VALID_SELECT_RE.match(stripped):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only SELECT queries are allowed.",
        )
    if _FORBIDDEN_SQL_RE.search(stripped):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query contains forbidden DDL/DML statements.",
        )


# ═══════════════════════════════════════════════════════════════════════════════
# Schemas
# ═══════════════════════════════════════════════════════════════════════════════


class DashboardCreate(BaseModel):
    name: str = Field(..., max_length=200)
    description: str | None = None
    layout: dict = Field(default_factory=dict)
    is_shared: bool = False


class DashboardUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    layout: dict | None = None
    is_shared: bool | None = None


class DashboardOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    layout: dict
    owner_id: uuid.UUID
    is_shared: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WidgetCreate(BaseModel):
    widget_type: str = Field(..., pattern=r"^(line|bar|pie|donut|kpi|table|heatmap|funnel|gauge)$")
    title: str = Field(..., max_length=200)
    query_config: dict
    position: dict = Field(default_factory=lambda: {"x": 0, "y": 0})
    size: dict = Field(default_factory=lambda: {"w": 6, "h": 4})
    settings: dict | None = None


class WidgetUpdate(BaseModel):
    widget_type: str | None = Field(None, pattern=r"^(line|bar|pie|donut|kpi|table|heatmap|funnel|gauge)$")
    title: str | None = None
    query_config: dict | None = None
    position: dict | None = None
    size: dict | None = None
    settings: dict | None = None


class WidgetOut(BaseModel):
    id: uuid.UUID
    dashboard_id: uuid.UUID
    widget_type: str
    title: str
    query_config: dict
    position: dict
    size: dict
    settings: dict | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class QueryExecute(BaseModel):
    sql: str = Field(..., min_length=1)
    params: dict[str, Any] = Field(default_factory=dict)
    limit: int = Field(100, ge=1, le=10000)


class SavedQueryCreate(BaseModel):
    name: str = Field(..., max_length=200)
    sql_text: str = Field(..., min_length=1)
    description: str | None = None
    module: str | None = None
    is_public: bool = False


class SavedQueryUpdate(BaseModel):
    name: str | None = None
    sql_text: str | None = None
    description: str | None = None
    module: str | None = None
    is_public: bool | None = None


class SavedQueryOut(BaseModel):
    id: uuid.UUID
    name: str
    sql_text: str
    description: str | None
    owner_id: uuid.UUID
    module: str | None
    is_public: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReportCreate(BaseModel):
    name: str = Field(..., max_length=200)
    report_type: str = Field(..., pattern=r"^(scheduled|one_time)$")
    schedule: str | None = None
    query_id: uuid.UUID | None = None
    format: str = Field("pdf", pattern=r"^(pdf|csv|xlsx)$")
    recipients: list[str] = Field(default_factory=list)


class ReportOut(BaseModel):
    id: uuid.UUID
    name: str
    report_type: str
    schedule: str | None
    query_id: uuid.UUID | None
    format: str
    recipients: list
    last_run: datetime | None
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AlertCreate(BaseModel):
    name: str = Field(..., max_length=200)
    condition: str = Field(..., pattern=r"^(gt|lt|gte|lte|eq|neq)$")
    threshold: Decimal
    query_id: uuid.UUID
    notify_users: list[str] = Field(default_factory=list)
    is_active: bool = True


class AlertUpdate(BaseModel):
    name: str | None = None
    condition: str | None = Field(None, pattern=r"^(gt|lt|gte|lte|eq|neq)$")
    threshold: Decimal | None = None
    query_id: uuid.UUID | None = None
    notify_users: list[str] | None = None
    is_active: bool | None = None


class AlertOut(BaseModel):
    id: uuid.UUID
    name: str
    condition: str
    threshold: Decimal
    query_id: uuid.UUID
    notify_users: list
    is_active: bool
    last_triggered: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# Dashboards
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/dashboards", summary="List dashboards")
async def list_dashboards(
    current_user: CurrentUser,
    db: DBSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> list[DashboardOut]:
    result = await db.execute(
        select(Dashboard)
        .where(
            (Dashboard.owner_id == current_user.id) | (Dashboard.is_shared == True)  # noqa: E712
        )
        .order_by(Dashboard.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return [DashboardOut.from_orm(d) for d in result.scalars().all()]


@router.post("/dashboards", status_code=status.HTTP_201_CREATED, summary="Create dashboard")
async def create_dashboard(
    body: DashboardCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> DashboardOut:
    dashboard = Dashboard(
        name=body.name,
        description=body.description,
        layout=body.layout,
        owner_id=current_user.id,
        is_shared=body.is_shared,
    )
    db.add(dashboard)
    await db.commit()
    await db.refresh(dashboard)
    return DashboardOut.from_orm(dashboard)


@router.get("/dashboards/{dashboard_id}", summary="Get dashboard by ID")
async def get_dashboard(
    dashboard_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> DashboardOut:
    result = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    if dashboard.owner_id != current_user.id and not dashboard.is_shared:
        raise HTTPException(status_code=403, detail="Access denied")
    return DashboardOut.from_orm(dashboard)


@router.put("/dashboards/{dashboard_id}", summary="Update dashboard")
async def update_dashboard(
    dashboard_id: uuid.UUID,
    body: DashboardUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> DashboardOut:
    result = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    if dashboard.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can update this dashboard")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(dashboard, field, value)
    await db.commit()
    await db.refresh(dashboard)
    return DashboardOut.from_orm(dashboard)


@router.delete("/dashboards/{dashboard_id}", status_code=status.HTTP_200_OK, response_model=None, summary="Delete dashboard")
async def delete_dashboard(
    dashboard_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    result = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    if dashboard.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can delete this dashboard")
    await db.delete(dashboard)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# Widgets
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/dashboards/{dashboard_id}/widgets", summary="List widgets on a dashboard")
async def list_widgets(
    dashboard_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> list[WidgetOut]:
    # Verify dashboard access
    result = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    if dashboard.owner_id != current_user.id and not dashboard.is_shared:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(DashboardWidget).where(DashboardWidget.dashboard_id == dashboard_id)
    )
    return [WidgetOut.from_orm(w) for w in result.scalars().all()]


@router.post(
    "/dashboards/{dashboard_id}/widgets",
    status_code=status.HTTP_201_CREATED,
    summary="Add widget to dashboard",
)
async def create_widget(
    dashboard_id: uuid.UUID,
    body: WidgetCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> WidgetOut:
    result = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    if dashboard.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can add widgets")

    widget = DashboardWidget(
        dashboard_id=dashboard_id,
        widget_type=body.widget_type,
        title=body.title,
        query_config=body.query_config,
        position=body.position,
        size=body.size,
        settings=body.settings,
    )
    db.add(widget)
    await db.commit()
    await db.refresh(widget)
    return WidgetOut.from_orm(widget)


@router.put("/widgets/{widget_id}", summary="Update a widget")
async def update_widget(
    widget_id: uuid.UUID,
    body: WidgetUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> WidgetOut:
    result = await db.execute(
        select(DashboardWidget)
        .join(Dashboard, Dashboard.id == DashboardWidget.dashboard_id)
        .where(DashboardWidget.id == widget_id)
    )
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    # Verify ownership via dashboard
    dash_result = await db.execute(select(Dashboard).where(Dashboard.id == widget.dashboard_id))
    dashboard = dash_result.scalar_one_or_none()
    if not dashboard or dashboard.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the dashboard owner can update widgets")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(widget, field, value)
    await db.commit()
    await db.refresh(widget)
    return WidgetOut.from_orm(widget)


@router.delete("/widgets/{widget_id}", status_code=status.HTTP_200_OK, response_model=None, summary="Delete a widget")
async def delete_widget(
    widget_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    result = await db.execute(select(DashboardWidget).where(DashboardWidget.id == widget_id))
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    dash_result = await db.execute(select(Dashboard).where(Dashboard.id == widget.dashboard_id))
    dashboard = dash_result.scalar_one_or_none()
    if not dashboard or dashboard.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the dashboard owner can delete widgets")

    await db.delete(widget)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# Ad-hoc Query Execution
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/query", summary="Execute ad-hoc read-only SQL query")
async def execute_query(
    body: QueryExecute,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Execute a SELECT-only SQL query and return results.

    IMPORTANT: Only SELECT statements are allowed. All DDL/DML is rejected.
    A LIMIT clause is enforced if not already present.
    """
    _validate_readonly_sql(body.sql)

    # Enforce a LIMIT to prevent unbounded result sets
    sql_stripped = body.sql.strip().rstrip(";")
    if not re.search(r"\bLIMIT\b", sql_stripped, re.IGNORECASE):
        sql_stripped = f"{sql_stripped} LIMIT {body.limit}"

    try:
        result = await db.execute(text(sql_stripped), body.params)
        columns = list(result.keys())
        rows = result.fetchall()
        data = [dict(zip(columns, row)) for row in rows]
        return {
            "columns": columns,
            "rows": data,
            "row_count": len(data),
        }
    except Exception as exc:
        logger.warning("Ad-hoc query failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Query execution failed: {exc}",
        )


# ═══════════════════════════════════════════════════════════════════════════════
# Saved Queries
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/saved-queries", summary="List saved queries")
async def list_saved_queries(
    current_user: CurrentUser,
    db: DBSession,
    module: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> list[SavedQueryOut]:
    stmt = select(SavedQuery).where(
        (SavedQuery.owner_id == current_user.id) | (SavedQuery.is_public == True)  # noqa: E712
    )
    if module:
        stmt = stmt.where(SavedQuery.module == module)
    stmt = stmt.order_by(SavedQuery.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return [SavedQueryOut.from_orm(q) for q in result.scalars().all()]


@router.post("/saved-queries", status_code=status.HTTP_201_CREATED, summary="Create saved query")
async def create_saved_query(
    body: SavedQueryCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> SavedQueryOut:
    _validate_readonly_sql(body.sql_text)
    query = SavedQuery(
        name=body.name,
        sql_text=body.sql_text,
        description=body.description,
        owner_id=current_user.id,
        module=body.module,
        is_public=body.is_public,
    )
    db.add(query)
    await db.commit()
    await db.refresh(query)
    return SavedQueryOut.from_orm(query)


@router.get("/saved-queries/{query_id}", summary="Get saved query")
async def get_saved_query(
    query_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> SavedQueryOut:
    result = await db.execute(select(SavedQuery).where(SavedQuery.id == query_id))
    query = result.scalar_one_or_none()
    if not query:
        raise HTTPException(status_code=404, detail="Saved query not found")
    if query.owner_id != current_user.id and not query.is_public:
        raise HTTPException(status_code=403, detail="Access denied")
    return SavedQueryOut.from_orm(query)


@router.put("/saved-queries/{query_id}", summary="Update saved query")
async def update_saved_query(
    query_id: uuid.UUID,
    body: SavedQueryUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> SavedQueryOut:
    result = await db.execute(select(SavedQuery).where(SavedQuery.id == query_id))
    query = result.scalar_one_or_none()
    if not query:
        raise HTTPException(status_code=404, detail="Saved query not found")
    if query.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can update this query")

    updates = body.model_dump(exclude_unset=True)
    if "sql_text" in updates:
        _validate_readonly_sql(updates["sql_text"])
    for field, value in updates.items():
        setattr(query, field, value)
    await db.commit()
    await db.refresh(query)
    return SavedQueryOut.from_orm(query)


@router.delete("/saved-queries/{query_id}", status_code=status.HTTP_200_OK, response_model=None, summary="Delete saved query")
async def delete_saved_query(
    query_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    result = await db.execute(select(SavedQuery).where(SavedQuery.id == query_id))
    query = result.scalar_one_or_none()
    if not query:
        raise HTTPException(status_code=404, detail="Saved query not found")
    if query.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can delete this query")
    await db.delete(query)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# Reports
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/reports", summary="List reports")
async def list_reports(
    current_user: CurrentUser,
    db: DBSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> list[ReportOut]:
    result = await db.execute(
        select(Report)
        .where(Report.owner_id == current_user.id)
        .order_by(Report.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return [ReportOut.from_orm(r) for r in result.scalars().all()]


@router.post("/reports", status_code=status.HTTP_201_CREATED, summary="Create report")
async def create_report(
    body: ReportCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> ReportOut:
    report = Report(
        name=body.name,
        report_type=body.report_type,
        schedule=body.schedule,
        query_id=body.query_id,
        format=body.format,
        recipients=body.recipients,
        owner_id=current_user.id,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return ReportOut.from_orm(report)


@router.post("/reports/{report_id}/run", summary="Run a report now")
async def run_report(
    report_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # If the report references a saved query, execute it
    data: list[dict] = []
    columns: list[str] = []
    if report.query_id:
        qr = await db.execute(select(SavedQuery).where(SavedQuery.id == report.query_id))
        saved_query = qr.scalar_one_or_none()
        if saved_query:
            _validate_readonly_sql(saved_query.sql_text)
            sql_stripped = saved_query.sql_text.strip().rstrip(";")
            if not re.search(r"\bLIMIT\b", sql_stripped, re.IGNORECASE):
                sql_stripped = f"{sql_stripped} LIMIT 10000"
            try:
                exec_result = await db.execute(text(sql_stripped))
                columns = list(exec_result.keys())
                rows = exec_result.fetchall()
                data = [dict(zip(columns, row)) for row in rows]
            except Exception as exc:
                logger.warning("Report query execution failed: %s", exc)
                raise HTTPException(status_code=400, detail=f"Query failed: {exc}")

    # Update last_run
    report.last_run = datetime.now(timezone.utc)
    await db.commit()

    return {
        "report_id": str(report.id),
        "name": report.name,
        "format": report.format,
        "columns": columns,
        "rows": data,
        "row_count": len(data),
        "run_at": report.last_run.isoformat(),
    }


@router.get("/reports/{report_id}/download", summary="Download report data as CSV")
async def download_report(
    report_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> StreamingResponse:
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    data: list[dict] = []
    columns: list[str] = []
    if report.query_id:
        qr = await db.execute(select(SavedQuery).where(SavedQuery.id == report.query_id))
        saved_query = qr.scalar_one_or_none()
        if saved_query:
            _validate_readonly_sql(saved_query.sql_text)
            sql_stripped = saved_query.sql_text.strip().rstrip(";")
            if not re.search(r"\bLIMIT\b", sql_stripped, re.IGNORECASE):
                sql_stripped = f"{sql_stripped} LIMIT 10000"
            try:
                exec_result = await db.execute(text(sql_stripped))
                columns = list(exec_result.keys())
                rows = exec_result.fetchall()
                data = [dict(zip(columns, row)) for row in rows]
            except Exception as exc:
                raise HTTPException(status_code=400, detail=f"Query failed: {exc}")

    # Generate CSV
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns or ["no_data"])
    writer.writeheader()
    for row in data:
        # Convert non-string values for CSV
        writer.writerow({k: str(v) if v is not None else "" for k, v in row.items()})

    output.seek(0)
    filename = f"{report.name.replace(' ', '_')}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Data Alerts
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/alerts", summary="List data alerts")
async def list_alerts(
    current_user: CurrentUser,
    db: DBSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> list[AlertOut]:
    result = await db.execute(
        select(DataAlert)
        .join(SavedQuery, SavedQuery.id == DataAlert.query_id)
        .where(SavedQuery.owner_id == current_user.id)
        .order_by(DataAlert.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return [AlertOut.from_orm(a) for a in result.scalars().all()]


@router.post("/alerts", status_code=status.HTTP_201_CREATED, summary="Create data alert")
async def create_alert(
    body: AlertCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> AlertOut:
    # Verify the query exists and belongs to user
    qr = await db.execute(select(SavedQuery).where(SavedQuery.id == body.query_id))
    saved_query = qr.scalar_one_or_none()
    if not saved_query:
        raise HTTPException(status_code=404, detail="Saved query not found")
    if saved_query.owner_id != current_user.id and not saved_query.is_public:
        raise HTTPException(status_code=403, detail="Access denied to the referenced query")

    alert = DataAlert(
        name=body.name,
        condition=body.condition,
        threshold=body.threshold,
        query_id=body.query_id,
        notify_users=body.notify_users,
        is_active=body.is_active,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return AlertOut.from_orm(alert)


@router.put("/alerts/{alert_id}", summary="Update data alert")
async def update_alert(
    alert_id: uuid.UUID,
    body: AlertUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> AlertOut:
    result = await db.execute(
        select(DataAlert)
        .join(SavedQuery, SavedQuery.id == DataAlert.query_id)
        .where(DataAlert.id == alert_id, SavedQuery.owner_id == current_user.id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(alert, field, value)
    await db.commit()
    await db.refresh(alert)
    return AlertOut.from_orm(alert)


@router.delete("/alerts/{alert_id}", status_code=status.HTTP_200_OK, response_model=None, summary="Delete data alert")
async def delete_alert(
    alert_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    result = await db.execute(
        select(DataAlert)
        .join(SavedQuery, SavedQuery.id == DataAlert.query_id)
        .where(DataAlert.id == alert_id, SavedQuery.owner_id == current_user.id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    await db.delete(alert)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# Module KPIs
# ═══════════════════════════════════════════════════════════════════════════════

_MODULE_KPI_QUERIES: dict[str, list[dict[str, str]]] = {
    "finance": [
        {"name": "revenue", "label": "Total Revenue", "sql": "SELECT COALESCE(SUM(total), 0) AS value FROM finance_invoices WHERE status = 'paid'"},
        {"name": "expenses", "label": "Total Expenses", "sql": "SELECT COALESCE(SUM(jl.debit), 0) AS value FROM finance_journal_lines jl JOIN finance_accounts a ON a.id = jl.account_id AND a.account_type = 'expense'"},
        {"name": "profit", "label": "Net Profit", "sql": "SELECT COALESCE((SELECT SUM(total) FROM finance_invoices WHERE status = 'paid'), 0) - COALESCE((SELECT SUM(jl.debit) FROM finance_journal_lines jl JOIN finance_accounts a ON a.id = jl.account_id AND a.account_type = 'expense'), 0) AS value"},
        {"name": "outstanding_invoices", "label": "Outstanding Invoices", "sql": "SELECT COUNT(*) AS value FROM finance_invoices WHERE status IN ('sent', 'overdue')"},
    ],
    "hr": [
        {"name": "headcount", "label": "Total Headcount", "sql": "SELECT COUNT(*) AS value FROM hr_employees WHERE status = 'active'"},
        {"name": "attrition", "label": "Terminated This Year", "sql": "SELECT COUNT(*) AS value FROM hr_employees WHERE status = 'terminated' AND EXTRACT(YEAR FROM updated_at) = EXTRACT(YEAR FROM NOW())"},
        {"name": "pending_leave", "label": "Pending Leave Requests", "sql": "SELECT COUNT(*) AS value FROM hr_leave_requests WHERE status = 'pending'"},
        {"name": "departments", "label": "Departments", "sql": "SELECT COUNT(*) AS value FROM hr_departments"},
    ],
    "crm": [
        {"name": "total_contacts", "label": "Total Contacts", "sql": "SELECT COUNT(*) AS value FROM crm_contacts"},
        {"name": "deals_won", "label": "Deals Won", "sql": "SELECT COUNT(*) AS value FROM crm_deals WHERE stage = 'won'"},
        {"name": "deals_value", "label": "Pipeline Value", "sql": "SELECT COALESCE(SUM(value), 0) AS value FROM crm_deals WHERE stage NOT IN ('won', 'lost')"},
        {"name": "conversion_rate", "label": "Conversion Rate (%)", "sql": "SELECT CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE stage = 'won') * 100.0 / COUNT(*), 1) ELSE 0 END AS value FROM crm_deals"},
    ],
    "inventory": [
        {"name": "stock_value", "label": "Total Stock Value", "sql": "SELECT COALESCE(SUM(sl.quantity_on_hand * i.cost_price), 0) AS value FROM inventory_stock_levels sl JOIN inventory_items i ON i.id = sl.item_id"},
        {"name": "turnover", "label": "Stock Movements (30d)", "sql": "SELECT COUNT(*) AS value FROM inventory_stock_movements WHERE created_at >= NOW() - INTERVAL '30 days'"},
        {"name": "low_stock", "label": "Low Stock Items", "sql": "SELECT COUNT(DISTINCT sl.item_id) AS value FROM inventory_stock_levels sl JOIN inventory_items i ON i.id = sl.item_id WHERE sl.quantity_on_hand <= i.reorder_level AND i.reorder_level > 0"},
        {"name": "active_items", "label": "Active Items", "sql": "SELECT COUNT(*) AS value FROM inventory_items WHERE is_active = true"},
    ],
    "projects": [
        {"name": "active_projects", "label": "Active Projects", "sql": "SELECT COUNT(*) AS value FROM projects WHERE status = 'active'"},
        {"name": "total_tasks", "label": "Total Tasks", "sql": "SELECT COUNT(*) AS value FROM project_tasks"},
        {"name": "overdue_tasks", "label": "Overdue Tasks", "sql": "SELECT COUNT(*) AS value FROM project_tasks WHERE due_date < NOW() AND status != 'done'"},
    ],
    "support": [
        {"name": "open_tickets", "label": "Open Tickets", "sql": "SELECT COUNT(*) AS value FROM support_tickets WHERE status = 'open'"},
        {"name": "resolved_tickets", "label": "Resolved Tickets", "sql": "SELECT COUNT(*) AS value FROM support_tickets WHERE status = 'resolved'"},
        {"name": "total_tickets", "label": "Total Tickets", "sql": "SELECT COUNT(*) AS value FROM support_tickets"},
    ],
    "ecommerce": [
        {"name": "total_orders", "label": "Total Orders", "sql": "SELECT COUNT(*) AS value FROM ecommerce_orders"},
        {"name": "total_revenue", "label": "Order Revenue", "sql": "SELECT COALESCE(SUM(total), 0) AS value FROM ecommerce_orders WHERE status != 'cancelled'"},
        {"name": "active_products", "label": "Active Products", "sql": "SELECT COUNT(*) AS value FROM ecommerce_products WHERE is_active = true"},
    ],
}


@router.get("/modules/{module}/kpis", summary="Pre-built KPIs for a module")
async def module_kpis(
    module: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    kpi_defs = _MODULE_KPI_QUERIES.get(module)
    if not kpi_defs:
        raise HTTPException(
            status_code=404,
            detail=f"No KPIs defined for module '{module}'. Available: {list(_MODULE_KPI_QUERIES.keys())}",
        )

    kpis: list[dict[str, Any]] = []
    for kpi in kpi_defs:
        try:
            result = await db.execute(text(kpi["sql"]))
            row = result.fetchone()
            value = float(row[0]) if row and row[0] is not None else 0
        except Exception:
            value = 0
        kpis.append({"name": kpi["name"], "label": kpi["label"], "value": value})

    return {"module": module, "kpis": kpis}


# ═══════════════════════════════════════════════════════════════════════════════
# Trends
# ═══════════════════════════════════════════════════════════════════════════════

_MODULE_TREND_QUERIES: dict[str, str] = {
    "finance": """
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS period,
               COALESCE(SUM(total), 0) AS value
        FROM finance_invoices
        WHERE created_at >= NOW() - make_interval(months => :months)
        GROUP BY 1 ORDER BY 1
    """,
    "hr": """
        SELECT TO_CHAR(DATE_TRUNC('month', hire_date), 'YYYY-MM') AS period,
               COUNT(*) AS value
        FROM hr_employees
        WHERE hire_date >= NOW() - make_interval(months => :months)
        GROUP BY 1 ORDER BY 1
    """,
    "crm": """
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS period,
               COUNT(*) AS value
        FROM crm_deals
        WHERE created_at >= NOW() - make_interval(months => :months)
        GROUP BY 1 ORDER BY 1
    """,
    "inventory": """
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS period,
               COUNT(*) AS value
        FROM inventory_stock_movements
        WHERE created_at >= NOW() - make_interval(months => :months)
        GROUP BY 1 ORDER BY 1
    """,
    "projects": """
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS period,
               COUNT(*) AS value
        FROM projects
        WHERE created_at >= NOW() - make_interval(months => :months)
        GROUP BY 1 ORDER BY 1
    """,
    "support": """
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS period,
               COUNT(*) AS value
        FROM support_tickets
        WHERE created_at >= NOW() - make_interval(months => :months)
        GROUP BY 1 ORDER BY 1
    """,
    "ecommerce": """
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS period,
               COALESCE(SUM(total), 0) AS value
        FROM ecommerce_orders
        WHERE created_at >= NOW() - make_interval(months => :months)
        GROUP BY 1 ORDER BY 1
    """,
}


@router.get("/modules/{module}/trends", summary="Time-series trend data for a module")
async def module_trends(
    module: str,
    current_user: CurrentUser,
    db: DBSession,
    months: int = Query(12, ge=1, le=36),
) -> dict[str, Any]:
    trend_sql = _MODULE_TREND_QUERIES.get(module)
    if not trend_sql:
        raise HTTPException(
            status_code=404,
            detail=f"No trend data for module '{module}'. Available: {list(_MODULE_TREND_QUERIES.keys())}",
        )

    try:
        result = await db.execute(text(trend_sql), {"months": months})
        rows = result.fetchall()
        data = [{"period": row[0], "value": float(row[1])} for row in rows]
    except Exception as exc:
        logger.warning("Trend query failed for %s: %s", module, exc)
        data = []

    return {"module": module, "months": months, "data": data}


# ═══════════════════════════════════════════════════════════════════════════════
# Cross-module Executive Summary
# ═══════════════════════════════════════════════════════════════════════════════

_EXECUTIVE_QUERIES: list[dict[str, str]] = [
    {"name": "total_revenue", "label": "Total Revenue", "sql": "SELECT COALESCE(SUM(total), 0) FROM finance_invoices WHERE status = 'paid'"},
    {"name": "total_expenses", "label": "Total Expenses", "sql": "SELECT COALESCE(SUM(jl.debit), 0) FROM finance_journal_lines jl JOIN finance_accounts a ON a.id = jl.account_id AND a.account_type = 'expense'"},
    {"name": "headcount", "label": "Active Employees", "sql": "SELECT COUNT(*) FROM hr_employees WHERE status = 'active'"},
    {"name": "crm_deals_pipeline", "label": "Pipeline Value", "sql": "SELECT COALESCE(SUM(value), 0) FROM crm_deals WHERE stage NOT IN ('won', 'lost')"},
    {"name": "crm_deals_won", "label": "Deals Won", "sql": "SELECT COUNT(*) FROM crm_deals WHERE stage = 'won'"},
    {"name": "inventory_value", "label": "Inventory Value", "sql": "SELECT COALESCE(SUM(sl.quantity_on_hand * i.cost_price), 0) FROM inventory_stock_levels sl JOIN inventory_items i ON i.id = sl.item_id"},
    {"name": "open_support_tickets", "label": "Open Support Tickets", "sql": "SELECT COUNT(*) FROM support_tickets WHERE status = 'open'"},
    {"name": "active_projects", "label": "Active Projects", "sql": "SELECT COUNT(*) FROM projects WHERE status = 'active'"},
    {"name": "total_users", "label": "Total Users", "sql": "SELECT COUNT(*) FROM users WHERE is_active = true"},
    {"name": "ecommerce_orders", "label": "E-Commerce Orders (30d)", "sql": "SELECT COUNT(*) FROM ecommerce_orders WHERE created_at >= NOW() - INTERVAL '30 days'"},
]


@router.get("/cross-module/summary", summary="Executive cross-module KPI summary")
async def cross_module_summary(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    kpis: list[dict[str, Any]] = []
    for item in _EXECUTIVE_QUERIES:
        try:
            result = await db.execute(text(item["sql"]))
            row = result.fetchone()
            value = float(row[0]) if row and row[0] is not None else 0
        except Exception:
            value = 0
        kpis.append({"name": item["name"], "label": item["label"], "value": value})

    return {"kpis": kpis}
