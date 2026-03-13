"""HR People Analytics — Custom Dashboards, DEI, Predictive Reports, Cost Modeling."""

import csv
import io
import logging
import uuid
from datetime import date, datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.models.hr_phase3 import AnalyticsDashboard

router = APIRouter()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class WidgetPosition(BaseModel):
    x: int
    y: int
    w: int
    h: int


class WidgetConfig(BaseModel):
    id: str
    type: str  # headcount | attrition | compensation | diversity | performance | burnout
    title: str
    config: dict
    position: WidgetPosition


class DashboardCreate(BaseModel):
    name: str
    description: str | None = None
    is_shared: bool = False
    layout: list[dict] | None = None


class DashboardUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_shared: bool | None = None
    layout: list[dict] | None = None


class DashboardOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    owner_id: uuid.UUID
    is_shared: bool
    layout: list | None
    widget_count: int
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class CostScenarioInput(BaseModel):
    headcount_growth_pct: float
    salary_increase_pct: float
    new_benefit_cost_per_head: float | None = None
    fiscal_year: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_dashboard_or_404(db: AsyncSession, dashboard_id: uuid.UUID) -> AnalyticsDashboard:
    result = await db.execute(
        select(AnalyticsDashboard).where(AnalyticsDashboard.id == dashboard_id)
    )
    dashboard = result.scalar_one_or_none()
    if dashboard is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found")
    return dashboard


def _is_owner_or_admin(dashboard: AnalyticsDashboard, current_user: Any) -> bool:
    return str(dashboard.owner_id) == str(current_user.id) or getattr(current_user, "role", "") in (
        "super_admin",
        "app_admin",
    )


# ---------------------------------------------------------------------------
# Custom Dashboards
# ---------------------------------------------------------------------------


@router.get("/analytics/dashboards")
async def list_dashboards(
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    """List dashboards owned by the current user plus any shared dashboards."""
    from sqlalchemy import or_  # noqa: PLC0415

    query = select(AnalyticsDashboard).where(
        or_(
            AnalyticsDashboard.owner_id == current_user.id,
            AnalyticsDashboard.is_shared.is_(True),
        )
    )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        query.order_by(AnalyticsDashboard.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(query)
    dashboards = result.scalars().all()

    return {
        "items": [DashboardOut.model_validate(d) for d in dashboards],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("/analytics/dashboards", status_code=status.HTTP_201_CREATED)
async def create_dashboard(
    body: DashboardCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> DashboardOut:
    """Create a new analytics dashboard."""
    layout = body.layout or []
    dashboard = AnalyticsDashboard(
        name=body.name,
        description=body.description,
        owner_id=current_user.id,
        is_shared=body.is_shared,
        layout=layout,
        widget_count=len(layout),
    )
    db.add(dashboard)
    await db.commit()
    await db.refresh(dashboard)
    return DashboardOut.model_validate(dashboard)


@router.get("/analytics/dashboards/{dashboard_id}")
async def get_dashboard(
    dashboard_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> DashboardOut:
    """Get a dashboard with its widget layout."""
    dashboard = await _get_dashboard_or_404(db, dashboard_id)

    # Only owner or shared dashboards are visible to non-owners
    if (
        str(dashboard.owner_id) != str(current_user.id)
        and not dashboard.is_shared
        and getattr(current_user, "role", "") not in ("super_admin", "app_admin")
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return DashboardOut.model_validate(dashboard)


@router.put("/analytics/dashboards/{dashboard_id}")
async def update_dashboard(
    dashboard_id: uuid.UUID,
    body: DashboardUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> DashboardOut:
    """Update a dashboard (owner or admin only)."""
    dashboard = await _get_dashboard_or_404(db, dashboard_id)

    if not _is_owner_or_admin(dashboard, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner or an admin can update this dashboard")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dashboard, field, value)

    # Keep widget_count in sync with layout
    if "layout" in update_data and update_data["layout"] is not None:
        dashboard.widget_count = len(update_data["layout"])

    await db.commit()
    await db.refresh(dashboard)
    return DashboardOut.model_validate(dashboard)


@router.delete("/analytics/dashboards/{dashboard_id}", status_code=status.HTTP_200_OK, response_model=None)
async def delete_dashboard(
    dashboard_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """Delete a dashboard (owner or admin only)."""
    dashboard = await _get_dashboard_or_404(db, dashboard_id)

    if not _is_owner_or_admin(dashboard, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner or an admin can delete this dashboard")

    await db.delete(dashboard)
    await db.commit()


@router.post("/analytics/dashboards/{dashboard_id}/widgets", status_code=status.HTTP_201_CREATED)
async def add_widget_to_dashboard(
    dashboard_id: uuid.UUID,
    body: WidgetConfig,
    current_user: CurrentUser,
    db: DBSession,
) -> DashboardOut:
    """Add a widget to a dashboard's layout."""
    dashboard = await _get_dashboard_or_404(db, dashboard_id)

    if not _is_owner_or_admin(dashboard, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner or an admin can modify this dashboard")

    layout: list = list(dashboard.layout or [])

    # Check for duplicate widget id
    if any(w.get("id") == body.id for w in layout):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Widget with id '{body.id}' already exists in this dashboard",
        )

    layout.append(body.model_dump())
    dashboard.layout = layout
    dashboard.widget_count = len(layout)

    await db.commit()
    await db.refresh(dashboard)
    return DashboardOut.model_validate(dashboard)


@router.delete(
    "/analytics/dashboards/{dashboard_id}/widgets/{widget_id}",
    status_code=status.HTTP_200_OK,
)
async def remove_widget_from_dashboard(
    dashboard_id: uuid.UUID,
    widget_id: str,
    current_user: CurrentUser,
    db: DBSession,
) -> DashboardOut:
    """Remove a widget from a dashboard's layout."""
    dashboard = await _get_dashboard_or_404(db, dashboard_id)

    if not _is_owner_or_admin(dashboard, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner or an admin can modify this dashboard")

    layout: list = list(dashboard.layout or [])
    new_layout = [w for w in layout if w.get("id") != widget_id]

    if len(new_layout) == len(layout):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Widget '{widget_id}' not found in this dashboard",
        )

    dashboard.layout = new_layout
    dashboard.widget_count = len(new_layout)

    await db.commit()
    await db.refresh(dashboard)
    return DashboardOut.model_validate(dashboard)


# ---------------------------------------------------------------------------
# DEI Metrics
# ---------------------------------------------------------------------------


@router.get("/analytics/dei/overview")
async def dei_overview(
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
) -> dict:
    """Org-wide DEI snapshot: gender distribution, department breakdown, leadership diversity."""
    from app.models.hr import Department, Employee  # noqa: PLC0415

    # Total active employees
    total_result = await db.execute(
        select(func.count(Employee.id)).where(Employee.is_active.is_(True))
    )
    total_employees = total_result.scalar() or 0

    # Gender distribution from metadata_json->>'gender'
    gender_rows = await db.execute(
        select(
            Employee.metadata_json["gender"].astext.label("gender"),
            func.count(Employee.id).label("count"),
        )
        .where(Employee.is_active.is_(True))
        .group_by(Employee.metadata_json["gender"].astext)
    )
    gender_rows_all = gender_rows.all()

    gender_distribution: dict[str, int] = {"male": 0, "female": 0, "other": 0, "not_specified": 0}
    for row in gender_rows_all:
        g = (row.gender or "").lower()
        if g in gender_distribution:
            gender_distribution[g] += row.count
        elif g:
            gender_distribution["other"] += row.count
        else:
            gender_distribution["not_specified"] += row.count

    # Department breakdown — headcount by department + gender
    dept_query = (
        select(
            Department.name.label("department_name"),
            Employee.metadata_json["gender"].astext.label("gender"),
            func.count(Employee.id).label("count"),
        )
        .join(Department, Department.id == Employee.department_id)
        .where(Employee.is_active.is_(True))
        .group_by(Department.name, Employee.metadata_json["gender"].astext)
        .order_by(Department.name)
    )
    dept_result = await db.execute(dept_query)
    dept_rows = dept_result.all()

    dept_map: dict[str, dict] = {}
    for row in dept_rows:
        dept_name = row.department_name
        if dept_name not in dept_map:
            dept_map[dept_name] = {"department": dept_name, "total": 0, "gender_split": {}}
        g = (row.gender or "not_specified").lower()
        dept_map[dept_name]["gender_split"][g] = row.count
        dept_map[dept_name]["total"] += row.count

    department_breakdown = list(dept_map.values())

    # Leadership diversity — employees with manager/lead job titles
    manager_gender_query = (
        select(
            Employee.metadata_json["gender"].astext.label("gender"),
            func.count(Employee.id).label("count"),
        )
        .where(
            Employee.is_active.is_(True),
            Employee.job_title.ilike("%manager%")
            | Employee.job_title.ilike("%lead%")
            | Employee.job_title.ilike("%director%")
            | Employee.job_title.ilike("%head%"),
        )
        .group_by(Employee.metadata_json["gender"].astext)
    )
    mgr_result = await db.execute(manager_gender_query)
    mgr_rows = mgr_result.all()

    manager_gender_split: dict[str, int] = {}
    for row in mgr_rows:
        g = (row.gender or "not_specified").lower()
        manager_gender_split[g] = row.count

    return {
        "total_employees": total_employees,
        "gender_distribution": gender_distribution,
        "department_breakdown": department_breakdown,
        "leadership_diversity": {
            "manager_gender_split": manager_gender_split,
        },
    }


# ---------------------------------------------------------------------------
# Predictive Reports
# ---------------------------------------------------------------------------


@router.get("/analytics/predictive/attrition-risk")
async def predictive_attrition_risk(
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
    risk_level: str | None = Query(None, description="Filter: high, critical"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    """List employees with elevated attrition risk based on latest FlightRiskScores."""
    from app.models.hr import Employee  # noqa: PLC0415
    from app.models.hr_phase3 import FlightRiskScore  # noqa: PLC0415

    # Get most recent score per employee via subquery
    latest_subq = (
        select(
            FlightRiskScore.employee_id,
            func.max(FlightRiskScore.calculated_at).label("max_calc"),
        )
        .group_by(FlightRiskScore.employee_id)
        .subquery()
    )
    query = (
        select(FlightRiskScore, Employee)
        .join(
            latest_subq,
            (FlightRiskScore.employee_id == latest_subq.c.employee_id)
            & (FlightRiskScore.calculated_at == latest_subq.c.max_calc),
        )
        .join(Employee, Employee.id == FlightRiskScore.employee_id)
        .where(Employee.is_active.is_(True))
    )

    if risk_level:
        query = query.where(FlightRiskScore.risk_level == risk_level)
    else:
        # Default: only show high and critical
        query = query.where(FlightRiskScore.risk_level.in_(["high", "critical"]))

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        query.order_by(FlightRiskScore.score.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.all()

    items = []
    for score, emp in rows:
        items.append(
            {
                "employee_id": str(emp.id),
                "employee_number": emp.employee_number,
                "job_title": emp.job_title,
                "department_id": str(emp.department_id) if emp.department_id else None,
                "risk_score": float(score.score),
                "risk_level": score.risk_level,
                "factors": score.factors,
                "recommendations": score.recommendations,
                "calculated_at": score.calculated_at.isoformat() if score.calculated_at else None,
            }
        )

    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/analytics/predictive/hiring-demand")
async def predictive_hiring_demand(
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
) -> dict:
    """Project next-quarter hiring demand based on growth scenarios and open requisitions."""
    from app.models.hr import Department, Employee  # noqa: PLC0415
    from app.models.hr_phase3 import WorkforcePlanningScenario  # noqa: PLC0415

    # Current headcount per department
    dept_headcount_result = await db.execute(
        select(
            Employee.department_id,
            Department.name.label("department_name"),
            func.count(Employee.id).label("headcount"),
        )
        .join(Department, Department.id == Employee.department_id)
        .where(Employee.is_active.is_(True))
        .group_by(Employee.department_id, Department.name)
    )
    dept_headcount = {row.department_id: row for row in dept_headcount_result.all()}

    total_headcount = sum(row.headcount for row in dept_headcount.values())

    # Most recent approved workforce planning scenario for current year
    current_year = date.today().year
    scenario_result = await db.execute(
        select(WorkforcePlanningScenario)
        .where(
            WorkforcePlanningScenario.fiscal_year == current_year,
            WorkforcePlanningScenario.is_approved.is_(True),
        )
        .order_by(WorkforcePlanningScenario.created_at.desc())
        .limit(1)
    )
    scenario = scenario_result.scalar_one_or_none()

    projected_hires = 0
    scenario_summary = None

    if scenario and scenario.scenarios:
        # Use the first scenario variant as the base projection
        base_sc = scenario.scenarios[0]
        projected_hires = base_sc.get("new_hires", 0)
        scenario_summary = {
            "scenario_name": base_sc.get("name"),
            "growth_rate": base_sc.get("growth_rate"),
            "attrition_rate": base_sc.get("attrition_rate"),
            "projected_headcount": base_sc.get("projected_headcount"),
        }
    else:
        # Fallback: assume 5% growth + 10% attrition replacement
        attrition_replacement = int(total_headcount * 0.10 / 4)  # quarterly
        growth_hires = int(total_headcount * 0.05 / 4)
        projected_hires = attrition_replacement + growth_hires
        scenario_summary = {
            "scenario_name": "default_estimate",
            "growth_rate": 5.0,
            "attrition_rate": 10.0,
            "note": "No approved planning scenario found; using default estimates",
        }

    department_breakdown = [
        {
            "department_id": str(dept_id),
            "department_name": row.department_name,
            "current_headcount": row.headcount,
        }
        for dept_id, row in dept_headcount.items()
    ]

    return {
        "current_total_headcount": total_headcount,
        "projected_hires_next_quarter": projected_hires,
        "planning_scenario": scenario_summary,
        "department_breakdown": department_breakdown,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Cost Modeling
# ---------------------------------------------------------------------------


@router.get("/analytics/cost/headcount")
async def cost_headcount(
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
) -> dict:
    """Headcount by department with salary totals and estimated benefit costs."""
    from app.models.hr import Department, Employee  # noqa: PLC0415

    query = (
        select(
            Department.id.label("department_id"),
            Department.name.label("department"),
            func.count(Employee.id).label("headcount"),
            func.coalesce(func.sum(Employee.salary), 0).label("total_salary_budget"),
            func.coalesce(func.avg(Employee.salary), 0).label("avg_salary"),
        )
        .join(Department, Department.id == Employee.department_id)
        .where(Employee.is_active.is_(True))
        .group_by(Department.id, Department.name)
        .order_by(Department.name)
    )
    result = await db.execute(query)
    rows = result.all()

    items = []
    for row in rows:
        total_salary = float(row.total_salary_budget)
        items.append(
            {
                "department_id": str(row.department_id),
                "department": row.department,
                "headcount": row.headcount,
                "total_salary_budget": total_salary,
                "avg_salary": float(row.avg_salary),
                "benefit_cost_est": round(total_salary * 0.25, 2),
            }
        )

    grand_total_salary = sum(i["total_salary_budget"] for i in items)
    grand_total_headcount = sum(i["headcount"] for i in items)

    return {
        "items": items,
        "total": len(items),
        "grand_total_headcount": grand_total_headcount,
        "grand_total_salary_budget": grand_total_salary,
        "grand_total_benefit_cost_est": round(grand_total_salary * 0.25, 2),
    }


@router.get("/analytics/cost/compensation-analysis")
async def compensation_analysis(
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
) -> dict:
    """Compare employee salaries against compensation bands for their job level."""
    from app.models.hr import Employee  # noqa: PLC0415
    from app.models.hr_phase1 import CompensationBand  # noqa: PLC0415

    emp_result = await db.execute(
        select(Employee)
        .where(Employee.is_active.is_(True), Employee.salary.isnot(None))
        .order_by(Employee.employee_number)
    )
    employees = emp_result.scalars().all()

    band_result = await db.execute(
        select(CompensationBand).where(CompensationBand.is_active.is_(True))
    )
    all_bands = band_result.scalars().all()

    # Index bands by job_level for O(1) lookup
    band_by_level: dict[str, Any] = {}
    for band in all_bands:
        band_by_level[band.job_level.lower()] = band

    above_band: list[dict] = []
    below_band: list[dict] = []
    within_band: list[dict] = []
    unmatched: list[dict] = []

    for emp in employees:
        # Try to match employee job_title to a compensation band job_level
        job_level = (emp.job_title or "").lower()
        band = band_by_level.get(job_level)

        emp_salary = float(emp.salary)
        entry: dict = {
            "employee_id": str(emp.id),
            "employee_number": emp.employee_number,
            "job_title": emp.job_title,
            "salary": emp_salary,
        }

        if band is None:
            unmatched.append(entry)
            continue

        entry["band_min"] = float(band.min_salary)
        entry["band_mid"] = float(band.mid_salary)
        entry["band_max"] = float(band.max_salary)
        entry["job_level"] = band.job_level

        if emp_salary < float(band.min_salary):
            below_band.append(entry)
        elif emp_salary > float(band.max_salary):
            above_band.append(entry)
        else:
            within_band.append(entry)

    return {
        "summary": {
            "total_analyzed": len(employees),
            "within_band": len(within_band),
            "above_band": len(above_band),
            "below_band": len(below_band),
            "unmatched_to_band": len(unmatched),
        },
        "above_band": above_band,
        "below_band": below_band,
        "within_band": within_band,
        "unmatched": unmatched,
    }


@router.post("/analytics/cost/scenario-model")
async def cost_scenario_model(
    body: CostScenarioInput,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
) -> dict:
    """Project total people cost under a headcount/salary growth scenario."""
    from app.models.hr import Department, Employee  # noqa: PLC0415

    dept_query = (
        select(
            Department.id.label("department_id"),
            Department.name.label("department"),
            func.count(Employee.id).label("headcount"),
            func.coalesce(func.sum(Employee.salary), 0).label("total_salary"),
        )
        .join(Department, Department.id == Employee.department_id)
        .where(Employee.is_active.is_(True))
        .group_by(Department.id, Department.name)
        .order_by(Department.name)
    )
    result = await db.execute(dept_query)
    dept_rows = result.all()

    benefit_cost_per_head_default = body.new_benefit_cost_per_head or 0.0
    salary_factor = 1 + (body.salary_increase_pct / 100)
    headcount_factor = 1 + (body.headcount_growth_pct / 100)

    current_total_cost = 0.0
    projected_total_cost = 0.0
    breakdown_by_department: list[dict] = []

    for row in dept_rows:
        current_salary = float(row.total_salary)
        current_headcount = row.headcount
        benefit_cost_current = benefit_cost_per_head_default * current_headcount
        current_cost = current_salary + benefit_cost_current

        projected_headcount = max(int(current_headcount * headcount_factor), 0)
        projected_salary = current_salary * salary_factor * (
            projected_headcount / current_headcount if current_headcount else 1
        )
        benefit_cost_projected = benefit_cost_per_head_default * projected_headcount
        projected_cost = projected_salary + benefit_cost_projected

        current_total_cost += current_cost
        projected_total_cost += projected_cost

        breakdown_by_department.append(
            {
                "department_id": str(row.department_id),
                "department": row.department,
                "current_headcount": current_headcount,
                "projected_headcount": projected_headcount,
                "current_cost": round(current_cost, 2),
                "projected_cost": round(projected_cost, 2),
                "delta": round(projected_cost - current_cost, 2),
            }
        )

    delta = round(projected_total_cost - current_total_cost, 2)

    return {
        "fiscal_year": body.fiscal_year,
        "headcount_growth_pct": body.headcount_growth_pct,
        "salary_increase_pct": body.salary_increase_pct,
        "current_cost": round(current_total_cost, 2),
        "projected_cost": round(projected_total_cost, 2),
        "delta": delta,
        "delta_pct": round((delta / current_total_cost * 100) if current_total_cost else 0, 2),
        "breakdown_by_department": breakdown_by_department,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------


@router.get("/analytics/export/headcount-report")
async def export_headcount_report(
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
) -> Response:
    """CSV export of headcount and salary cost data by department."""
    from app.models.hr import Department, Employee  # noqa: PLC0415

    query = (
        select(
            Department.name.label("department"),
            func.count(Employee.id).label("headcount"),
            func.coalesce(func.sum(Employee.salary), 0).label("total_salary_budget"),
            func.coalesce(func.avg(Employee.salary), 0).label("avg_salary"),
        )
        .join(Department, Department.id == Employee.department_id)
        .where(Employee.is_active.is_(True))
        .group_by(Department.name)
        .order_by(Department.name)
    )
    result = await db.execute(query)
    rows = result.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Department", "Headcount", "Total Salary Budget", "Avg Salary", "Benefit Cost Est (25%)"])

    for row in rows:
        total_salary = float(row.total_salary_budget)
        writer.writerow(
            [
                row.department,
                row.headcount,
                f"{total_salary:.2f}",
                f"{float(row.avg_salary):.2f}",
                f"{total_salary * 0.25:.2f}",
            ]
        )

    filename = f"headcount_report_{date.today().isoformat()}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/analytics/export/dei-report")
async def export_dei_report(
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
) -> Response:
    """CSV export of DEI metrics: gender distribution by department."""
    from app.models.hr import Department, Employee  # noqa: PLC0415

    query = (
        select(
            Department.name.label("department_name"),
            Employee.job_title,
            Employee.metadata_json["gender"].astext.label("gender"),
            func.count(Employee.id).label("count"),
        )
        .join(Department, Department.id == Employee.department_id)
        .where(Employee.is_active.is_(True))
        .group_by(Department.name, Employee.job_title, Employee.metadata_json["gender"].astext)
        .order_by(Department.name, Employee.job_title)
    )
    result = await db.execute(query)
    rows = result.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Department", "Job Title", "Gender", "Count"])

    for row in rows:
        writer.writerow(
            [
                row.department_name,
                row.job_title or "N/A",
                row.gender or "not_specified",
                row.count,
            ]
        )

    filename = f"dei_report_{date.today().isoformat()}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
