"""HR Compensation API — bands, merit increases, bonuses, equity grants."""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, select

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.models.hr import Employee
from app.models.hr_phase1 import (
    Bonus,
    CompensationBand,
    EmployeeActivityLog,
    EquityGrant,
    MeritBudgetPool,
    MeritIncrease,
)

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

# -- Compensation Band schemas --


class CompensationBandCreate(BaseModel):
    job_level: str
    job_family: str
    currency: str = "USD"
    min_salary: Decimal
    mid_salary: Decimal
    max_salary: Decimal
    country_code: str = "KE"
    effective_from: date
    is_active: bool = True


class CompensationBandUpdate(BaseModel):
    job_level: str | None = None
    job_family: str | None = None
    currency: str | None = None
    min_salary: Decimal | None = None
    mid_salary: Decimal | None = None
    max_salary: Decimal | None = None
    country_code: str | None = None
    effective_from: date | None = None
    is_active: bool | None = None


class CompensationBandOut(BaseModel):
    id: uuid.UUID
    job_level: str
    job_family: str
    currency: str
    min_salary: Decimal
    mid_salary: Decimal
    max_salary: Decimal
    country_code: str
    effective_from: date
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Merit Budget Pool schemas --


class MeritBudgetPoolCreate(BaseModel):
    name: str
    department_id: uuid.UUID | None = None
    fiscal_year: int
    total_budget: Decimal
    currency: str = "USD"
    status: str = "open"


class MeritBudgetPoolUpdate(BaseModel):
    name: str | None = None
    department_id: uuid.UUID | None = None
    fiscal_year: int | None = None
    total_budget: Decimal | None = None
    currency: str | None = None
    status: str | None = None


class MeritBudgetPoolOut(BaseModel):
    id: uuid.UUID
    name: str
    department_id: uuid.UUID | None
    fiscal_year: int
    total_budget: Decimal
    allocated_amount: Decimal
    currency: str
    status: str
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Merit Increase schemas --


class MeritIncreaseCreate(BaseModel):
    employee_id: uuid.UUID
    review_id: uuid.UUID | None = None
    proposed_salary: Decimal
    increase_type: str  # merit, promotion, market_adjustment, cost_of_living
    effective_date: date
    budget_pool_id: uuid.UUID | None = None
    notes: str | None = None


class MeritIncreaseOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    review_id: uuid.UUID | None
    current_salary: Decimal
    proposed_salary: Decimal
    increase_percentage: Decimal
    increase_type: str
    effective_date: date
    budget_pool_id: uuid.UUID | None
    status: str
    approved_by: uuid.UUID | None
    notes: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Bonus schemas --


class BonusCreate(BaseModel):
    employee_id: uuid.UUID
    bonus_type: str  # performance, spot, signing, referral, holiday, retention
    amount: Decimal
    currency: str = "USD"
    reason: str | None = None
    review_id: uuid.UUID | None = None
    pay_period: str | None = None


class BonusOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    bonus_type: str
    amount: Decimal
    currency: str
    reason: str | None
    review_id: uuid.UUID | None
    pay_period: str | None
    status: str
    approved_by: uuid.UUID | None
    paid_at: Any | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Equity Grant schemas --


class EquityGrantCreate(BaseModel):
    employee_id: uuid.UUID
    grant_type: str  # stock_option, rsu, espp
    shares: int
    strike_price: Decimal | None = None
    grant_date: date
    vesting_start: date
    vesting_schedule: dict | None = None  # {"cliff_months": 12, "total_months": 48, "frequency": "monthly"}
    notes: str | None = None


class EquityGrantUpdate(BaseModel):
    grant_type: str | None = None
    shares: int | None = None
    strike_price: Decimal | None = None
    grant_date: date | None = None
    vesting_start: date | None = None
    vesting_schedule: dict | None = None
    status: str | None = None
    notes: str | None = None


class EquityGrantOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    grant_type: str
    shares: int
    strike_price: Decimal | None
    grant_date: date
    vesting_start: date
    vesting_schedule: dict | None
    vested_shares: int
    exercised_shares: int
    status: str
    notes: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class VestingEvent(BaseModel):
    date: date
    shares_vesting: int
    cumulative_vested: int
    percentage_vested: float


# ── Compensation Band endpoints ───────────────────────────────────────────────


@router.get("/compensation/bands", response_model=list[CompensationBandOut])
async def list_compensation_bands(
    current_user: CurrentUser,
    db: DBSession,
    job_level: str | None = Query(None),
    job_family: str | None = Query(None),
    country_code: str | None = Query(None),
    is_active: bool | None = Query(None),
):
    """List compensation bands with optional filters."""
    stmt = select(CompensationBand)
    conditions = []
    if job_level:
        conditions.append(CompensationBand.job_level == job_level)
    if job_family:
        conditions.append(CompensationBand.job_family == job_family)
    if country_code:
        conditions.append(CompensationBand.country_code == country_code)
    if is_active is not None:
        conditions.append(CompensationBand.is_active == is_active)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    stmt = stmt.order_by(CompensationBand.job_level, CompensationBand.job_family)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/compensation/bands", response_model=CompensationBandOut, status_code=201)
async def create_compensation_band(
    data: CompensationBandCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Create a compensation band (admin)."""
    band = CompensationBand(**data.model_dump())
    db.add(band)
    await db.commit()
    await db.refresh(band)
    return band


@router.put("/compensation/bands/{band_id}", response_model=CompensationBandOut)
async def update_compensation_band(
    band_id: uuid.UUID,
    data: CompensationBandUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Update a compensation band (admin)."""
    band = await db.get(CompensationBand, band_id)
    if not band:
        raise HTTPException(status_code=404, detail="Compensation band not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(band, field, value)
    await db.commit()
    await db.refresh(band)
    return band


@router.delete("/compensation/bands/{band_id}")
async def delete_compensation_band(
    band_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Soft-delete a compensation band (admin)."""
    band = await db.get(CompensationBand, band_id)
    if not band:
        raise HTTPException(status_code=404, detail="Compensation band not found")
    band.is_active = False
    await db.commit()
    return {"detail": "Compensation band deactivated"}


@router.get("/compensation/bands/analysis")
async def compensation_band_analysis(
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Compare employee salaries against compensation bands. Returns employees outside range."""
    # Get all active bands
    bands_result = await db.execute(
        select(CompensationBand).where(CompensationBand.is_active == True)
    )
    bands = bands_result.scalars().all()

    # Get all active employees with salary
    emp_result = await db.execute(
        select(Employee).where(
            and_(Employee.is_active == True, Employee.salary.isnot(None))
        )
    )
    employees = emp_result.scalars().all()

    outside_range = []
    for emp in employees:
        # Find matching bands by job_title similarity
        for band in bands:
            if (
                emp.job_title
                and band.job_family.lower() in emp.job_title.lower()
                and emp.currency == band.currency
            ):
                if emp.salary < band.min_salary:
                    outside_range.append(
                        {
                            "employee_id": str(emp.id),
                            "employee_number": emp.employee_number,
                            "job_title": emp.job_title,
                            "current_salary": float(emp.salary),
                            "currency": emp.currency,
                            "band_id": str(band.id),
                            "band_job_level": band.job_level,
                            "band_job_family": band.job_family,
                            "band_min": float(band.min_salary),
                            "band_max": float(band.max_salary),
                            "deviation": "below_minimum",
                            "difference": float(band.min_salary - emp.salary),
                        }
                    )
                elif emp.salary > band.max_salary:
                    outside_range.append(
                        {
                            "employee_id": str(emp.id),
                            "employee_number": emp.employee_number,
                            "job_title": emp.job_title,
                            "current_salary": float(emp.salary),
                            "currency": emp.currency,
                            "band_id": str(band.id),
                            "band_job_level": band.job_level,
                            "band_job_family": band.job_family,
                            "band_min": float(band.min_salary),
                            "band_max": float(band.max_salary),
                            "deviation": "above_maximum",
                            "difference": float(emp.salary - band.max_salary),
                        }
                    )
                break

    return {
        "total_employees_analyzed": len(employees),
        "total_bands": len(bands),
        "employees_outside_range": len(outside_range),
        "details": outside_range,
    }


# ── Merit Budget Pool endpoints ───────────────────────────────────────────────


@router.get("/merit/budget-pools", response_model=list[MeritBudgetPoolOut])
async def list_merit_budget_pools(
    current_user: CurrentUser,
    db: DBSession,
    fiscal_year: int | None = Query(None),
    department_id: uuid.UUID | None = Query(None),
    status: str | None = Query(None),
):
    """List merit budget pools with optional filters."""
    stmt = select(MeritBudgetPool)
    conditions = []
    if fiscal_year:
        conditions.append(MeritBudgetPool.fiscal_year == fiscal_year)
    if department_id:
        conditions.append(MeritBudgetPool.department_id == department_id)
    if status:
        conditions.append(MeritBudgetPool.status == status)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    stmt = stmt.order_by(MeritBudgetPool.fiscal_year.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/merit/budget-pools", response_model=MeritBudgetPoolOut, status_code=201)
async def create_merit_budget_pool(
    data: MeritBudgetPoolCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Create a merit budget pool (admin)."""
    pool = MeritBudgetPool(
        **data.model_dump(),
        created_by=current_user.id,
    )
    db.add(pool)
    await db.commit()
    await db.refresh(pool)
    return pool


@router.put("/merit/budget-pools/{pool_id}", response_model=MeritBudgetPoolOut)
async def update_merit_budget_pool(
    pool_id: uuid.UUID,
    data: MeritBudgetPoolUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Update a merit budget pool (admin)."""
    pool = await db.get(MeritBudgetPool, pool_id)
    if not pool:
        raise HTTPException(status_code=404, detail="Merit budget pool not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(pool, field, value)
    await db.commit()
    await db.refresh(pool)
    return pool


# ── Merit Increase endpoints ──────────────────────────────────────────────────


@router.get("/merit/increases")
async def list_merit_increases(
    current_user: CurrentUser,
    db: DBSession,
    employee_id: uuid.UUID | None = Query(None),
    status: str | None = Query(None),
    increase_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """List merit increases with pagination and filters."""
    stmt = select(MeritIncrease)
    count_stmt = select(func.count()).select_from(MeritIncrease)
    conditions = []
    if employee_id:
        conditions.append(MeritIncrease.employee_id == employee_id)
    if status:
        conditions.append(MeritIncrease.status == status)
    if increase_type:
        conditions.append(MeritIncrease.increase_type == increase_type)
    if conditions:
        where_clause = and_(*conditions)
        stmt = stmt.where(where_clause)
        count_stmt = count_stmt.where(where_clause)

    total = (await db.execute(count_stmt)).scalar() or 0
    stmt = stmt.order_by(MeritIncrease.created_at.desc())
    stmt = stmt.offset((page - 1) * limit).limit(limit)
    result = await db.execute(stmt)
    items = result.scalars().all()
    return {
        "items": [MeritIncreaseOut.model_validate(i) for i in items],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("/merit/increases", response_model=MeritIncreaseOut, status_code=201)
async def propose_merit_increase(
    data: MeritIncreaseCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Propose a merit increase (admin). Auto-calculates increase_percentage from current employee salary."""
    employee = await db.get(Employee, data.employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    if not employee.salary or employee.salary == 0:
        raise HTTPException(status_code=400, detail="Employee has no current salary set")

    current_salary = employee.salary
    increase_percentage = (
        (data.proposed_salary - current_salary) / current_salary * 100
    )

    increase = MeritIncrease(
        employee_id=data.employee_id,
        review_id=data.review_id,
        current_salary=current_salary,
        proposed_salary=data.proposed_salary,
        increase_percentage=increase_percentage,
        increase_type=data.increase_type,
        effective_date=data.effective_date,
        budget_pool_id=data.budget_pool_id,
        notes=data.notes,
        status="proposed",
    )
    db.add(increase)
    await db.commit()
    await db.refresh(increase)
    return increase


@router.put("/merit/increases/{increase_id}/approve", response_model=MeritIncreaseOut)
async def approve_merit_increase(
    increase_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Approve a proposed merit increase (admin). Updates budget pool allocated_amount."""
    increase = await db.get(MeritIncrease, increase_id)
    if not increase:
        raise HTTPException(status_code=404, detail="Merit increase not found")
    if increase.status != "proposed":
        raise HTTPException(status_code=400, detail=f"Cannot approve increase with status '{increase.status}'")

    increase.status = "approved"
    increase.approved_by = current_user.id

    # Update budget pool allocated amount if linked
    if increase.budget_pool_id:
        pool = await db.get(MeritBudgetPool, increase.budget_pool_id)
        if pool:
            increase_amount = increase.proposed_salary - increase.current_salary
            pool.allocated_amount = pool.allocated_amount + increase_amount

    await db.commit()
    await db.refresh(increase)
    return increase


@router.put("/merit/increases/{increase_id}/reject", response_model=MeritIncreaseOut)
async def reject_merit_increase(
    increase_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Reject a proposed merit increase (admin)."""
    increase = await db.get(MeritIncrease, increase_id)
    if not increase:
        raise HTTPException(status_code=404, detail="Merit increase not found")
    if increase.status != "proposed":
        raise HTTPException(status_code=400, detail=f"Cannot reject increase with status '{increase.status}'")

    increase.status = "rejected"
    increase.approved_by = current_user.id
    await db.commit()
    await db.refresh(increase)
    return increase


@router.put("/merit/increases/{increase_id}/apply", response_model=MeritIncreaseOut)
async def apply_merit_increase(
    increase_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Apply an approved merit increase to Employee.salary (admin). Publishes employee.salary_changed event and logs in activity timeline."""
    increase = await db.get(MeritIncrease, increase_id)
    if not increase:
        raise HTTPException(status_code=404, detail="Merit increase not found")
    if increase.status != "approved":
        raise HTTPException(status_code=400, detail=f"Cannot apply increase with status '{increase.status}'. Must be approved first.")

    # Update employee salary
    employee = await db.get(Employee, increase.employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    old_salary = employee.salary
    employee.salary = increase.proposed_salary
    increase.status = "applied"

    # Log in activity timeline
    activity = EmployeeActivityLog(
        employee_id=increase.employee_id,
        activity_type="salary_change",
        title=f"Salary {increase.increase_type}: {old_salary} → {increase.proposed_salary}",
        description=increase.notes,
        source_module="hr",
        source_id=increase.id,
        metadata_json={
            "old_salary": str(old_salary),
            "new_salary": str(increase.proposed_salary),
            "increase_percentage": str(increase.increase_percentage),
            "increase_type": increase.increase_type,
        },
        occurred_at=datetime.now(timezone.utc),
    )
    db.add(activity)

    await db.commit()
    await db.refresh(increase)

    # Publish event
    await event_bus.publish(
        "employee.salary_changed",
        {
            "employee_id": str(increase.employee_id),
            "old_salary": str(old_salary),
            "new_salary": str(increase.proposed_salary),
            "increase_type": increase.increase_type,
            "increase_id": str(increase.id),
        },
    )

    return increase


# ── Bonus endpoints ───────────────────────────────────────────────────────────


@router.get("/bonuses")
async def list_bonuses(
    current_user: CurrentUser,
    db: DBSession,
    employee_id: uuid.UUID | None = Query(None),
    bonus_type: str | None = Query(None),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """List bonuses with pagination and filters."""
    stmt = select(Bonus)
    count_stmt = select(func.count()).select_from(Bonus)
    conditions = []
    if employee_id:
        conditions.append(Bonus.employee_id == employee_id)
    if bonus_type:
        conditions.append(Bonus.bonus_type == bonus_type)
    if status:
        conditions.append(Bonus.status == status)
    if conditions:
        where_clause = and_(*conditions)
        stmt = stmt.where(where_clause)
        count_stmt = count_stmt.where(where_clause)

    total = (await db.execute(count_stmt)).scalar() or 0
    stmt = stmt.order_by(Bonus.created_at.desc())
    stmt = stmt.offset((page - 1) * limit).limit(limit)
    result = await db.execute(stmt)
    items = result.scalars().all()
    return {
        "items": [BonusOut.model_validate(i) for i in items],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("/bonuses", response_model=BonusOut, status_code=201)
async def create_bonus(
    data: BonusCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Create a bonus (admin)."""
    employee = await db.get(Employee, data.employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    bonus = Bonus(**data.model_dump(), status="proposed")
    db.add(bonus)
    await db.commit()
    await db.refresh(bonus)
    return bonus


@router.put("/bonuses/{bonus_id}/approve", response_model=BonusOut)
async def approve_bonus(
    bonus_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Approve a bonus (admin). Publishes bonus.approved event."""
    bonus = await db.get(Bonus, bonus_id)
    if not bonus:
        raise HTTPException(status_code=404, detail="Bonus not found")
    if bonus.status != "proposed":
        raise HTTPException(status_code=400, detail=f"Cannot approve bonus with status '{bonus.status}'")

    bonus.status = "approved"
    bonus.approved_by = current_user.id
    await db.commit()
    await db.refresh(bonus)

    await event_bus.publish(
        "bonus.approved",
        {
            "bonus_id": str(bonus.id),
            "employee_id": str(bonus.employee_id),
            "bonus_type": bonus.bonus_type,
            "amount": str(bonus.amount),
            "currency": bonus.currency,
        },
    )

    return bonus


@router.put("/bonuses/{bonus_id}/pay", response_model=BonusOut)
async def pay_bonus(
    bonus_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Mark a bonus as paid (admin)."""
    bonus = await db.get(Bonus, bonus_id)
    if not bonus:
        raise HTTPException(status_code=404, detail="Bonus not found")
    if bonus.status != "approved":
        raise HTTPException(status_code=400, detail=f"Cannot pay bonus with status '{bonus.status}'. Must be approved first.")

    bonus.status = "paid"
    bonus.paid_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(bonus)
    return bonus


# ── Equity Grant endpoints ────────────────────────────────────────────────────


@router.get("/equity-grants")
async def list_equity_grants(
    current_user: CurrentUser,
    db: DBSession,
    employee_id: uuid.UUID | None = Query(None),
    grant_type: str | None = Query(None),
    status: str | None = Query(None),
):
    """List equity grants with optional filters."""
    stmt = select(EquityGrant)
    conditions = []
    if employee_id:
        conditions.append(EquityGrant.employee_id == employee_id)
    if grant_type:
        conditions.append(EquityGrant.grant_type == grant_type)
    if status:
        conditions.append(EquityGrant.status == status)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    stmt = stmt.order_by(EquityGrant.grant_date.desc())
    result = await db.execute(stmt)
    items = result.scalars().all()
    return [EquityGrantOut.model_validate(i) for i in items]


@router.post("/equity-grants", response_model=EquityGrantOut, status_code=201)
async def create_equity_grant(
    data: EquityGrantCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Create an equity grant (admin)."""
    employee = await db.get(Employee, data.employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    grant = EquityGrant(**data.model_dump(), status="active", vested_shares=0, exercised_shares=0)
    db.add(grant)
    await db.commit()
    await db.refresh(grant)
    return grant


@router.put("/equity-grants/{grant_id}", response_model=EquityGrantOut)
async def update_equity_grant(
    grant_id: uuid.UUID,
    data: EquityGrantUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin=Depends(require_app_admin("hr")),
):
    """Update an equity grant (admin)."""
    grant = await db.get(EquityGrant, grant_id)
    if not grant:
        raise HTTPException(status_code=404, detail="Equity grant not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(grant, field, value)
    await db.commit()
    await db.refresh(grant)
    return grant


@router.get("/equity-grants/{grant_id}/vesting-schedule", response_model=list[VestingEvent])
async def get_vesting_schedule(
    grant_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """Calculate vesting timeline based on the grant's vesting_schedule JSON."""
    grant = await db.get(EquityGrant, grant_id)
    if not grant:
        raise HTTPException(status_code=404, detail="Equity grant not found")
    if not grant.vesting_schedule:
        raise HTTPException(status_code=400, detail="No vesting schedule defined for this grant")

    schedule = grant.vesting_schedule
    cliff_months = schedule.get("cliff_months", 12)
    total_months = schedule.get("total_months", 48)
    frequency = schedule.get("frequency", "monthly")

    if total_months <= 0:
        raise HTTPException(status_code=400, detail="Invalid total_months in vesting schedule")

    vesting_events: list[dict] = []
    cumulative = 0

    # Determine interval in months
    if frequency == "quarterly":
        interval = 3
    elif frequency == "annually":
        interval = 12
    else:  # monthly
        interval = 1

    for month in range(interval, total_months + 1, interval):
        if month < cliff_months:
            continue

        # At cliff, vest all accumulated shares up to this point
        if month == cliff_months or (month > cliff_months and not vesting_events):
            shares_at_point = int(grant.shares * month / total_months)
            vesting_shares = shares_at_point - cumulative
        else:
            shares_at_point = int(grant.shares * month / total_months)
            vesting_shares = shares_at_point - cumulative

        if vesting_shares <= 0:
            continue

        cumulative += vesting_shares

        # Calculate vesting date
        vest_year = grant.vesting_start.year + (grant.vesting_start.month - 1 + month) // 12
        vest_month = (grant.vesting_start.month - 1 + month) % 12 + 1
        vest_day = min(grant.vesting_start.day, 28)  # safe day
        vest_date = date(vest_year, vest_month, vest_day)

        vesting_events.append(
            {
                "date": vest_date,
                "shares_vesting": vesting_shares,
                "cumulative_vested": cumulative,
                "percentage_vested": round(cumulative / grant.shares * 100, 2),
            }
        )

    # Ensure final event covers all shares
    if cumulative < grant.shares and vesting_events:
        remaining = grant.shares - cumulative
        vesting_events[-1]["shares_vesting"] += remaining
        vesting_events[-1]["cumulative_vested"] = grant.shares
        vesting_events[-1]["percentage_vested"] = 100.0

    return vesting_events


@router.put("/equity-grants/{grant_id}/vest", response_model=EquityGrantOut)
async def vest_equity_grant(
    grant_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    shares_to_vest: int = Query(..., ge=1, description="Number of shares to vest"),
    _admin=Depends(require_app_admin("hr")),
):
    """Process a vesting event: update vested_shares (admin)."""
    grant = await db.get(EquityGrant, grant_id)
    if not grant:
        raise HTTPException(status_code=404, detail="Equity grant not found")
    if grant.status not in ("active",):
        raise HTTPException(status_code=400, detail=f"Cannot vest shares for grant with status '{grant.status}'")

    unvested = grant.shares - grant.vested_shares
    if shares_to_vest > unvested:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot vest {shares_to_vest} shares. Only {unvested} unvested shares remaining.",
        )

    grant.vested_shares += shares_to_vest

    # Auto-update status if fully vested
    if grant.vested_shares >= grant.shares:
        grant.status = "fully_vested"

    await db.commit()
    await db.refresh(grant)
    return grant
