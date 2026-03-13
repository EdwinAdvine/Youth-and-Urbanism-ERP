"""HR AI Intelligence — Skills Ontology, Flight Risk, Burnout, Chatbot, Workforce Planning."""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.models.hr_phase3 import (
    AnalyticsDashboard, BurnoutIndicator, FlightRiskScore,
    SkillOntology, WorkforcePlanningScenario,
)

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional service imports (graceful fallback if not yet implemented)
# ---------------------------------------------------------------------------

try:
    from app.services.hr_flight_risk import calculate_flight_risk  # noqa: PLC0415
except ImportError:
    calculate_flight_risk = None  # type: ignore[assignment]

try:
    from app.services.hr_flight_risk import calculate_burnout_risk  # noqa: PLC0415
except ImportError:
    calculate_burnout_risk = None  # type: ignore[assignment]


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class SkillOntologyCreate(BaseModel):
    name: str
    category: str
    parent_id: uuid.UUID | None = None
    aliases: list[str] | None = None
    description: str | None = None


class SkillOntologyUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    parent_id: uuid.UUID | None = None
    aliases: list[str] | None = None
    description: str | None = None
    is_active: bool | None = None


class SkillOntologyOut(BaseModel):
    id: uuid.UUID
    name: str
    category: str
    parent_id: uuid.UUID | None
    aliases: list | None
    description: str | None
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class SkillOntologyWithChildrenOut(SkillOntologyOut):
    children: list[SkillOntologyOut] = []

    model_config = {"from_attributes": True}


class FlightRiskScoreOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    score: Any
    risk_level: str
    factors: dict | None
    recommendations: list | None
    model_version: str | None
    calculated_at: Any
    created_at: Any

    model_config = {"from_attributes": True}


class BurnoutIndicatorOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    risk_score: Any
    risk_level: str
    overtime_hours_30d: Any
    leave_days_taken_90d: int | None
    consecutive_work_days: int | None
    sentiment_trend: str | None
    factors: dict | None
    recommendations: list | None
    calculated_at: Any
    created_at: Any

    model_config = {"from_attributes": True}


class HRChatbotQuery(BaseModel):
    message: str
    context: dict | None = None


class WorkforcePlanningScenarioItem(BaseModel):
    name: str
    growth_rate: float
    attrition_rate: float
    new_hires: int
    salary_increase_pct: float


class WorkforcePlanningCreate(BaseModel):
    name: str
    fiscal_year: int
    base_headcount: int
    base_budget: float | None = None
    scenarios: list[WorkforcePlanningScenarioItem]
    assumptions: dict | None = None


class WorkforcePlanningOut(BaseModel):
    id: uuid.UUID
    name: str
    fiscal_year: int
    base_headcount: int
    base_budget: Any
    scenarios: list | None
    assumptions: dict | None
    created_by: uuid.UUID
    is_approved: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Skills Ontology
# ---------------------------------------------------------------------------


@router.get("/ai/skills-ontology")
async def list_skills_ontology(
    current_user: CurrentUser,
    db: DBSession,
    parent_id: uuid.UUID | None = Query(None),
    q: str | None = Query(None, description="Search query"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    """List all skill ontology nodes with optional parent_id filter and search."""
    query = select(SkillOntology).where(SkillOntology.is_active.is_(True))

    if parent_id is not None:
        query = query.where(SkillOntology.parent_id == parent_id)
    else:
        # Default: top-level nodes only when no parent filter provided
        pass

    if q:
        query = query.where(SkillOntology.name.ilike(f"%{q}%"))

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(SkillOntology.category, SkillOntology.name).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    skills = result.scalars().all()

    return {
        "items": [SkillOntologyOut.model_validate(s) for s in skills],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("/ai/skills-ontology", status_code=status.HTTP_201_CREATED)
async def create_skill_ontology(
    body: SkillOntologyCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
) -> SkillOntologyOut:
    """Create a skill ontology node (admin only)."""
    if body.parent_id is not None:
        parent_result = await db.execute(
            select(SkillOntology).where(SkillOntology.id == body.parent_id)
        )
        if parent_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent skill not found",
            )

    skill = SkillOntology(
        name=body.name,
        category=body.category,
        parent_id=body.parent_id,
        aliases=body.aliases,
        description=body.description,
    )
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    return SkillOntologyOut.model_validate(skill)


@router.get("/ai/skills-ontology/tree")
async def skills_ontology_tree(
    current_user: CurrentUser,
    db: DBSession,
) -> dict:
    """Full skills ontology tree, grouped by category."""
    result = await db.execute(
        select(SkillOntology)
        .where(SkillOntology.is_active.is_(True), SkillOntology.parent_id.is_(None))
        .order_by(SkillOntology.category, SkillOntology.name)
    )
    root_skills = result.scalars().all()

    # Group by category
    tree: dict[str, list] = {}
    for skill in root_skills:
        cat = skill.category
        if cat not in tree:
            tree[cat] = []
        node = SkillOntologyWithChildrenOut.model_validate(skill)
        # Children are already loaded via selectin relationship
        node.children = [
            SkillOntologyOut.model_validate(c)
            for c in (skill.children or [])
            if c.is_active
        ]
        tree[cat].append(node.model_dump())

    categories = [
        {"category": cat, "skills": skills, "count": len(skills)}
        for cat, skills in tree.items()
    ]
    return {"categories": categories, "total_categories": len(categories)}


@router.get("/ai/skills-ontology/{skill_id}")
async def get_skill_ontology(
    skill_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> SkillOntologyWithChildrenOut:
    """Get a skill ontology node with its direct children."""
    result = await db.execute(
        select(SkillOntology).where(SkillOntology.id == skill_id)
    )
    skill = result.scalar_one_or_none()
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")

    out = SkillOntologyWithChildrenOut.model_validate(skill)
    out.children = [
        SkillOntologyOut.model_validate(c)
        for c in (skill.children or [])
        if c.is_active
    ]
    return out


@router.put("/ai/skills-ontology/{skill_id}")
async def update_skill_ontology(
    skill_id: uuid.UUID,
    body: SkillOntologyUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
) -> SkillOntologyOut:
    """Update a skill ontology node (admin only)."""
    result = await db.execute(
        select(SkillOntology).where(SkillOntology.id == skill_id)
    )
    skill = result.scalar_one_or_none()
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(skill, field, value)

    await db.commit()
    await db.refresh(skill)
    return SkillOntologyOut.model_validate(skill)


@router.delete("/ai/skills-ontology/{skill_id}", status_code=status.HTTP_200_OK, response_model=None)
async def delete_skill_ontology(
    skill_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Soft-delete a skill ontology node (admin only, sets is_active=False)."""
    result = await db.execute(
        select(SkillOntology).where(SkillOntology.id == skill_id)
    )
    skill = result.scalar_one_or_none()
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")

    skill.is_active = False
    await db.commit()


# ---------------------------------------------------------------------------
# Flight Risk
# ---------------------------------------------------------------------------


@router.post("/ai/flight-risk/calculate/{employee_id}", status_code=status.HTTP_201_CREATED)
async def calculate_employee_flight_risk(
    employee_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
) -> FlightRiskScoreOut:
    """Calculate and persist flight risk score for an employee."""
    from app.models.hr import Employee  # noqa: PLC0415

    emp_result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = emp_result.scalar_one_or_none()
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    if calculate_flight_risk is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Flight risk service is not available",
        )

    # Gather context data for the risk calculation
    from app.models.hr import Attendance, LeaveRequest  # noqa: PLC0415

    leave_result = await db.execute(
        select(LeaveRequest)
        .where(LeaveRequest.employee_id == employee_id)
        .order_by(LeaveRequest.created_at.desc())
        .limit(20)
    )
    recent_leaves = leave_result.scalars().all()

    attendance_result = await db.execute(
        select(Attendance)
        .where(Attendance.employee_id == employee_id)
        .order_by(Attendance.attendance_date.desc())
        .limit(90)
    )
    recent_attendance = attendance_result.scalars().all()

    context = {
        "employee": employee,
        "recent_leaves": recent_leaves,
        "recent_attendance": recent_attendance,
        "skills": list(employee.skills or []),
    }

    risk_data = await calculate_flight_risk(context)

    score = FlightRiskScore(
        employee_id=employee_id,
        score=risk_data.get("score", 0),
        risk_level=risk_data.get("risk_level", "medium"),
        factors=risk_data.get("factors"),
        recommendations=risk_data.get("recommendations"),
        model_version=risk_data.get("model_version", "1.0"),
        calculated_at=datetime.now(timezone.utc),
    )
    db.add(score)
    await db.commit()
    await db.refresh(score)

    await event_bus.publish(
        "hr.flight_risk.calculated",
        {"employee_id": str(employee_id), "risk_level": score.risk_level, "score": str(score.score)},
    )

    return FlightRiskScoreOut.model_validate(score)


@router.get("/ai/flight-risk/scores")
async def list_flight_risk_scores(
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
    risk_level: str | None = Query(None, description="Filter by risk_level: low, medium, high, critical"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    """List all flight risk scores (admin/manager), with optional risk_level filter."""
    query = select(FlightRiskScore)

    if risk_level:
        query = query.where(FlightRiskScore.risk_level == risk_level)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(FlightRiskScore.calculated_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    scores = result.scalars().all()

    return {
        "items": [FlightRiskScoreOut.model_validate(s) for s in scores],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/ai/flight-risk/scores/{employee_id}")
async def get_employee_flight_risk_score(
    employee_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> FlightRiskScoreOut:
    """Get the latest flight risk score for a specific employee."""
    result = await db.execute(
        select(FlightRiskScore)
        .where(FlightRiskScore.employee_id == employee_id)
        .order_by(FlightRiskScore.calculated_at.desc())
        .limit(1)
    )
    score = result.scalar_one_or_none()
    if score is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No flight risk score found for this employee",
        )
    return FlightRiskScoreOut.model_validate(score)


@router.get("/ai/flight-risk/team-summary")
async def flight_risk_team_summary(
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
) -> dict:
    """Aggregated team flight risk summary statistics."""
    # Count of each risk level from most recent scores per employee
    # Use a subquery to get the latest score per employee
    latest_subq = (
        select(
            FlightRiskScore.employee_id,
            func.max(FlightRiskScore.calculated_at).label("max_calc"),
        )
        .group_by(FlightRiskScore.employee_id)
        .subquery()
    )
    latest_scores_query = (
        select(FlightRiskScore)
        .join(
            latest_subq,
            (FlightRiskScore.employee_id == latest_subq.c.employee_id)
            & (FlightRiskScore.calculated_at == latest_subq.c.max_calc),
        )
    )
    result = await db.execute(latest_scores_query)
    latest_scores = result.scalars().all()

    summary: dict[str, int] = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    total_assessed = len(latest_scores)
    total_score = 0.0

    for s in latest_scores:
        lvl = s.risk_level if s.risk_level in summary else "medium"
        summary[lvl] += 1
        total_score += float(s.score)

    avg_score = round(total_score / total_assessed, 2) if total_assessed else 0.0

    return {
        "total_assessed": total_assessed,
        "avg_risk_score": avg_score,
        "risk_distribution": summary,
        "high_risk_count": summary["high"] + summary["critical"],
    }


# ---------------------------------------------------------------------------
# Burnout
# ---------------------------------------------------------------------------


@router.post("/ai/burnout/calculate/{employee_id}", status_code=status.HTTP_201_CREATED)
async def calculate_employee_burnout(
    employee_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
) -> BurnoutIndicatorOut:
    """Calculate and persist burnout risk indicators for an employee."""
    from app.models.hr import Attendance, Employee, LeaveRequest  # noqa: PLC0415

    emp_result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = emp_result.scalar_one_or_none()
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    if calculate_burnout_risk is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Burnout risk service is not available",
        )

    # Gather attendance data (last 30 days)
    from datetime import date, timedelta  # noqa: PLC0415

    today = date.today()
    thirty_days_ago = today - timedelta(days=30)
    ninety_days_ago = today - timedelta(days=90)

    attendance_result = await db.execute(
        select(Attendance)
        .where(
            Attendance.employee_id == employee_id,
            Attendance.attendance_date >= thirty_days_ago,
        )
        .order_by(Attendance.attendance_date.desc())
    )
    attendance_30d = attendance_result.scalars().all()

    leave_result = await db.execute(
        select(LeaveRequest)
        .where(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.start_date >= ninety_days_ago,
            LeaveRequest.status == "approved",
        )
    )
    leaves_90d = leave_result.scalars().all()

    context = {
        "employee": employee,
        "attendance_30d": attendance_30d,
        "leaves_90d": leaves_90d,
    }

    burnout_data = await calculate_burnout_risk(context)

    indicator = BurnoutIndicator(
        employee_id=employee_id,
        risk_score=burnout_data.get("risk_score", 0),
        risk_level=burnout_data.get("risk_level", "low"),
        overtime_hours_30d=burnout_data.get("overtime_hours_30d"),
        leave_days_taken_90d=burnout_data.get("leave_days_taken_90d"),
        consecutive_work_days=burnout_data.get("consecutive_work_days"),
        sentiment_trend=burnout_data.get("sentiment_trend"),
        factors=burnout_data.get("factors"),
        recommendations=burnout_data.get("recommendations"),
        calculated_at=datetime.now(timezone.utc),
    )
    db.add(indicator)
    await db.commit()
    await db.refresh(indicator)

    await event_bus.publish(
        "hr.burnout.calculated",
        {"employee_id": str(employee_id), "risk_level": indicator.risk_level},
    )

    return BurnoutIndicatorOut.model_validate(indicator)


@router.get("/ai/burnout/indicators")
async def list_burnout_indicators(
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
    risk_level: str | None = Query(None, description="Filter: low, medium, high, critical"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    """List burnout indicators (admin only), with optional risk_level filter."""
    query = select(BurnoutIndicator)

    if risk_level:
        query = query.where(BurnoutIndicator.risk_level == risk_level)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(BurnoutIndicator.calculated_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    indicators = result.scalars().all()

    return {
        "items": [BurnoutIndicatorOut.model_validate(i) for i in indicators],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/ai/burnout/indicators/{employee_id}")
async def get_employee_burnout_indicator(
    employee_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> BurnoutIndicatorOut:
    """Get the latest burnout indicator for a specific employee."""
    result = await db.execute(
        select(BurnoutIndicator)
        .where(BurnoutIndicator.employee_id == employee_id)
        .order_by(BurnoutIndicator.calculated_at.desc())
        .limit(1)
    )
    indicator = result.scalar_one_or_none()
    if indicator is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No burnout indicator found for this employee",
        )
    return BurnoutIndicatorOut.model_validate(indicator)


# ---------------------------------------------------------------------------
# HR Chatbot
# ---------------------------------------------------------------------------

_HR_SYSTEM_PROMPT = (
    "You are an HR assistant for Urban Vibes Dynamics. Answer questions about HR policies, "
    "employee data, and best practices. Be concise and professional."
)


@router.post("/ai/hr-chatbot/query")
async def hr_chatbot_query(
    body: HRChatbotQuery,
    current_user: CurrentUser,
) -> dict:
    """HR policy/data chatbot powered by Ollama."""
    prompt_parts = []
    if body.context:
        prompt_parts.append(f"Context: {body.context}\n\n")
    prompt_parts.append(body.message)
    full_prompt = "".join(prompt_parts)

    payload = {
        "model": "llama3",
        "system": _HR_SYSTEM_PROMPT,
        "prompt": full_prompt,
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post("http://localhost:11435/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.warning("Ollama HR chatbot call failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is currently unavailable. Please try again later.",
        ) from exc

    response_text = data.get("response", "")
    return {
        "response": response_text,
        "sources": [],
    }


# ---------------------------------------------------------------------------
# Workforce Planning
# ---------------------------------------------------------------------------


@router.get("/ai/workforce-planning/scenarios")
async def list_workforce_planning_scenarios(
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
    fiscal_year: int | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    """List workforce planning scenarios."""
    query = select(WorkforcePlanningScenario)

    if fiscal_year:
        query = query.where(WorkforcePlanningScenario.fiscal_year == fiscal_year)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        query.order_by(WorkforcePlanningScenario.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(query)
    scenarios = result.scalars().all()

    return {
        "items": [WorkforcePlanningOut.model_validate(s) for s in scenarios],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("/ai/workforce-planning/scenarios", status_code=status.HTTP_201_CREATED)
async def create_workforce_planning_scenario(
    body: WorkforcePlanningCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
) -> WorkforcePlanningOut:
    """Create a workforce planning scenario with auto-calculated cost projections."""
    # Build scenario list with projected cost calculations
    calculated_scenarios = []
    for sc in body.scenarios:
        # Project headcount: base + new_hires - attrition
        attrition_headcount = int(body.base_headcount * (sc.attrition_rate / 100))
        net_growth_headcount = int(body.base_headcount * (sc.growth_rate / 100))
        projected_headcount = body.base_headcount + net_growth_headcount + sc.new_hires - attrition_headcount
        projected_headcount = max(projected_headcount, 0)

        # Project cost from base budget
        projected_cost: float | None = None
        if body.base_budget is not None:
            per_head_cost = body.base_budget / body.base_headcount if body.base_headcount else 0
            salary_factor = 1 + (sc.salary_increase_pct / 100)
            projected_cost = round(per_head_cost * salary_factor * projected_headcount, 2)

        calculated_scenarios.append(
            {
                "name": sc.name,
                "growth_rate": sc.growth_rate,
                "attrition_rate": sc.attrition_rate,
                "new_hires": sc.new_hires,
                "salary_increase_pct": sc.salary_increase_pct,
                "projected_headcount": projected_headcount,
                "projected_cost": projected_cost,
            }
        )

    scenario_obj = WorkforcePlanningScenario(
        name=body.name,
        fiscal_year=body.fiscal_year,
        base_headcount=body.base_headcount,
        base_budget=body.base_budget,
        scenarios=calculated_scenarios,
        assumptions=body.assumptions,
        created_by=current_user.id,
    )
    db.add(scenario_obj)
    await db.commit()
    await db.refresh(scenario_obj)
    return WorkforcePlanningOut.model_validate(scenario_obj)


@router.get("/ai/workforce-planning/scenarios/{scenario_id}")
async def get_workforce_planning_scenario(
    scenario_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
) -> dict:
    """Get a workforce planning scenario with detailed projections."""
    result = await db.execute(
        select(WorkforcePlanningScenario).where(WorkforcePlanningScenario.id == scenario_id)
    )
    scenario = result.scalar_one_or_none()
    if scenario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found")

    base = WorkforcePlanningOut.model_validate(scenario).model_dump()

    # Enrich each scenario variant with delta metrics
    enriched_scenarios = []
    for sc in (scenario.scenarios or []):
        projected_headcount = sc.get("projected_headcount", scenario.base_headcount)
        net_headcount_change = projected_headcount - scenario.base_headcount
        projected_annual_cost = sc.get("projected_cost")
        cost_vs_base: float | None = None
        if projected_annual_cost is not None and scenario.base_budget is not None:
            cost_vs_base = round(float(projected_annual_cost) - float(scenario.base_budget), 2)

        enriched_scenarios.append(
            {
                **sc,
                "net_headcount_change": net_headcount_change,
                "projected_annual_cost": projected_annual_cost,
                "cost_vs_base": cost_vs_base,
            }
        )

    base["scenarios"] = enriched_scenarios
    return base
