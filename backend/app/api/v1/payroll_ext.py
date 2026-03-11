"""Payroll Extensions API — Tax Brackets, Statutory Deductions, Pay Runs."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import and_, select

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.models.hr import Employee, Payslip, SalaryStructure
from app.models.payroll_ext import PayRun, StatutoryDeduction, TaxBracket

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class TaxBracketCreate(BaseModel):
    name: str
    country_code: str = "KE"
    min_amount: Decimal
    max_amount: Decimal | None = None
    rate: Decimal
    effective_from: date

class TaxBracketUpdate(BaseModel):
    name: str | None = None
    country_code: str | None = None
    min_amount: Decimal | None = None
    max_amount: Decimal | None = None
    rate: Decimal | None = None
    effective_from: date | None = None

class TaxBracketOut(BaseModel):
    id: uuid.UUID
    name: str
    country_code: str
    min_amount: Decimal
    max_amount: Decimal | None
    rate: Decimal
    effective_from: date
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


class StatutoryDeductionCreate(BaseModel):
    name: str
    country_code: str = "KE"
    calculation_type: str  # percentage, fixed
    value: Decimal
    max_amount: Decimal | None = None
    is_active: bool = True

class StatutoryDeductionUpdate(BaseModel):
    name: str | None = None
    country_code: str | None = None
    calculation_type: str | None = None
    value: Decimal | None = None
    max_amount: Decimal | None = None
    is_active: bool | None = None

class StatutoryDeductionOut(BaseModel):
    id: uuid.UUID
    name: str
    country_code: str
    calculation_type: str
    value: Decimal
    max_amount: Decimal | None
    is_active: bool
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


class PayRunGeneratePayload(BaseModel):
    period_start: date
    period_end: date
    salary_structure_id: uuid.UUID | None = None
    employee_ids: list[uuid.UUID] | None = None

class PayRunOut(BaseModel):
    id: uuid.UUID
    period_start: date
    period_end: date
    status: str
    total_gross: Decimal
    total_deductions: Decimal
    total_net: Decimal
    created_by: uuid.UUID
    approved_by: uuid.UUID | None
    processed_at: Any | None
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


# ── Tax Bracket endpoints ────────────────────────────────────────────────────

@router.get("/tax-brackets", summary="List tax brackets")
async def list_tax_brackets(
    current_user: CurrentUser,
    db: DBSession,
    country_code: str | None = Query(None),
) -> dict[str, Any]:
    query = select(TaxBracket).order_by(TaxBracket.min_amount.asc())
    if country_code:
        query = query.where(TaxBracket.country_code == country_code)
    result = await db.execute(query)
    brackets = result.scalars().all()
    return {
        "total": len(brackets),
        "tax_brackets": [TaxBracketOut.model_validate(b).model_dump() for b in brackets],
    }


@router.post("/tax-brackets", status_code=status.HTTP_201_CREATED, summary="Create a tax bracket")
async def create_tax_bracket(
    payload: TaxBracketCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    bracket = TaxBracket(
        name=payload.name,
        country_code=payload.country_code,
        min_amount=payload.min_amount,
        max_amount=payload.max_amount,
        rate=payload.rate,
        effective_from=payload.effective_from,
    )
    db.add(bracket)
    await db.commit()
    await db.refresh(bracket)
    return TaxBracketOut.model_validate(bracket).model_dump()


@router.put("/tax-brackets/{bracket_id}", summary="Update a tax bracket")
async def update_tax_bracket(
    bracket_id: uuid.UUID,
    payload: TaxBracketUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    bracket = await db.get(TaxBracket, bracket_id)
    if not bracket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tax bracket not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(bracket, field, value)
    await db.commit()
    await db.refresh(bracket)
    return TaxBracketOut.model_validate(bracket).model_dump()


@router.delete("/tax-brackets/{bracket_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a tax bracket")
async def delete_tax_bracket(
    bracket_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> Response:
    bracket = await db.get(TaxBracket, bracket_id)
    if not bracket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tax bracket not found")
    await db.delete(bracket)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Statutory Deduction endpoints ────────────────────────────────────────────

@router.get("/statutory-deductions", summary="List statutory deductions")
async def list_statutory_deductions(
    current_user: CurrentUser,
    db: DBSession,
    country_code: str | None = Query(None),
    is_active: bool | None = Query(None),
) -> dict[str, Any]:
    query = select(StatutoryDeduction).order_by(StatutoryDeduction.name.asc())
    if country_code:
        query = query.where(StatutoryDeduction.country_code == country_code)
    if is_active is not None:
        query = query.where(StatutoryDeduction.is_active == is_active)
    result = await db.execute(query)
    deductions = result.scalars().all()
    return {
        "total": len(deductions),
        "statutory_deductions": [StatutoryDeductionOut.model_validate(d).model_dump() for d in deductions],
    }


@router.post("/statutory-deductions", status_code=status.HTTP_201_CREATED, summary="Create a statutory deduction")
async def create_statutory_deduction(
    payload: StatutoryDeductionCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    deduction = StatutoryDeduction(
        name=payload.name,
        country_code=payload.country_code,
        calculation_type=payload.calculation_type,
        value=payload.value,
        max_amount=payload.max_amount,
        is_active=payload.is_active,
    )
    db.add(deduction)
    await db.commit()
    await db.refresh(deduction)
    return StatutoryDeductionOut.model_validate(deduction).model_dump()


@router.put("/statutory-deductions/{deduction_id}", summary="Update a statutory deduction")
async def update_statutory_deduction(
    deduction_id: uuid.UUID,
    payload: StatutoryDeductionUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    deduction = await db.get(StatutoryDeduction, deduction_id)
    if not deduction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Statutory deduction not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(deduction, field, value)
    await db.commit()
    await db.refresh(deduction)
    return StatutoryDeductionOut.model_validate(deduction).model_dump()


@router.delete("/statutory-deductions/{deduction_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a statutory deduction")
async def delete_statutory_deduction(
    deduction_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> Response:
    deduction = await db.get(StatutoryDeduction, deduction_id)
    if not deduction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Statutory deduction not found")
    await db.delete(deduction)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Pay Run endpoints ────────────────────────────────────────────────────────

@router.post("/pay-runs/generate", status_code=status.HTTP_201_CREATED, summary="Generate a pay run with payslips")
async def generate_pay_run(
    payload: PayRunGeneratePayload,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    if payload.period_end < payload.period_start:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="period_end must be on or after period_start")

    # Load salary structure if provided
    salary_structure: SalaryStructure | None = None
    if payload.salary_structure_id:
        salary_structure = await db.get(SalaryStructure, payload.salary_structure_id)
        if not salary_structure:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salary structure not found")

    # Load tax brackets & statutory deductions
    bracket_result = await db.execute(
        select(TaxBracket)
        .where(TaxBracket.effective_from <= payload.period_end)
        .order_by(TaxBracket.min_amount.asc())
    )
    tax_brackets = bracket_result.scalars().all()

    deduction_result = await db.execute(
        select(StatutoryDeduction).where(StatutoryDeduction.is_active == True)  # noqa: E712
    )
    statutory_deductions = deduction_result.scalars().all()

    # Determine target employees
    emp_query = select(Employee).where(Employee.is_active == True)  # noqa: E712
    if payload.employee_ids:
        emp_query = emp_query.where(Employee.id.in_(payload.employee_ids))
    result = await db.execute(emp_query)
    employees = result.scalars().all()

    if not employees:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active employees found")

    # Create pay run
    pay_run = PayRun(
        period_start=payload.period_start,
        period_end=payload.period_end,
        status="generated",
        created_by=current_user.id,
    )
    db.add(pay_run)
    await db.flush()

    total_gross = Decimal("0")
    total_deductions = Decimal("0")
    total_net = Decimal("0")
    payslip_count = 0

    for emp in employees:
        # Calculate gross pay
        if salary_structure:
            gross = salary_structure.base_salary
            if salary_structure.allowances:
                for _k, amt in salary_structure.allowances.items():
                    gross += Decimal(str(amt))
        else:
            gross = emp.salary or Decimal("0")

        # Calculate tax using brackets
        tax = Decimal("0")
        for bracket in tax_brackets:
            if gross < bracket.min_amount:
                break
            taxable_in_bracket = gross
            if bracket.max_amount:
                taxable_in_bracket = min(gross, bracket.max_amount)
            taxable_in_bracket -= bracket.min_amount
            if taxable_in_bracket > 0:
                tax += taxable_in_bracket * bracket.rate

        # Calculate statutory deductions
        stat_ded = Decimal("0")
        for sd in statutory_deductions:
            if sd.calculation_type == "percentage":
                ded = gross * sd.value
                if sd.max_amount and ded > sd.max_amount:
                    ded = sd.max_amount
                stat_ded += ded
            else:
                stat_ded += sd.value

        ded_total = tax + stat_ded
        net = gross - ded_total

        payslip = Payslip(
            employee_id=emp.id,
            salary_structure_id=payload.salary_structure_id,
            period_start=payload.period_start,
            period_end=payload.period_end,
            gross_pay=gross,
            deductions_total=ded_total,
            net_pay=net,
            status="draft",
        )
        db.add(payslip)

        total_gross += gross
        total_deductions += ded_total
        total_net += net
        payslip_count += 1

    pay_run.total_gross = total_gross
    pay_run.total_deductions = total_deductions
    pay_run.total_net = total_net

    await db.commit()
    await db.refresh(pay_run)

    return {
        "pay_run": PayRunOut.model_validate(pay_run).model_dump(),
        "payslips_generated": payslip_count,
    }


@router.get("/pay-runs", summary="List pay runs")
async def list_pay_runs(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status"),
) -> dict[str, Any]:
    query = select(PayRun).order_by(PayRun.period_start.desc())
    if status_filter:
        query = query.where(PayRun.status == status_filter)
    result = await db.execute(query)
    runs = result.scalars().all()
    return {
        "total": len(runs),
        "pay_runs": [PayRunOut.model_validate(r).model_dump() for r in runs],
    }


@router.get("/pay-runs/{pay_run_id}", summary="Get pay run detail")
async def get_pay_run(
    pay_run_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    pay_run = await db.get(PayRun, pay_run_id)
    if not pay_run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pay run not found")

    # Get associated payslips
    payslips_result = await db.execute(
        select(Payslip).where(
            and_(
                Payslip.period_start == pay_run.period_start,
                Payslip.period_end == pay_run.period_end,
            )
        )
    )
    payslips = payslips_result.scalars().all()

    data = PayRunOut.model_validate(pay_run).model_dump()
    data["payslips"] = [
        {
            "id": str(p.id),
            "employee_id": str(p.employee_id),
            "gross_pay": str(p.gross_pay),
            "deductions_total": str(p.deductions_total),
            "net_pay": str(p.net_pay),
            "status": p.status,
        }
        for p in payslips
    ]
    return data


@router.put("/pay-runs/{pay_run_id}/approve", summary="Approve a pay run")
async def approve_pay_run(
    pay_run_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    pay_run = await db.get(PayRun, pay_run_id)
    if not pay_run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pay run not found")
    if pay_run.status not in ("generated", "reviewed"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot approve pay run with status '{pay_run.status}'")

    pay_run.status = "approved"
    pay_run.approved_by = current_user.id

    # Also approve all associated payslips
    payslips_result = await db.execute(
        select(Payslip).where(
            and_(
                Payslip.period_start == pay_run.period_start,
                Payslip.period_end == pay_run.period_end,
                Payslip.status == "draft",
            )
        )
    )
    for p in payslips_result.scalars().all():
        p.status = "approved"
        p.approved_by = current_user.id

    await db.commit()
    await db.refresh(pay_run)

    await event_bus.publish("payrun.approved", {
        "pay_run_id": str(pay_run.id),
        "period_start": pay_run.period_start.isoformat(),
        "period_end": pay_run.period_end.isoformat(),
        "approved_by": str(current_user.id),
    })

    return PayRunOut.model_validate(pay_run).model_dump()


@router.put("/pay-runs/{pay_run_id}/process", summary="Process a pay run (mark as paid)")
async def process_pay_run(
    pay_run_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    pay_run = await db.get(PayRun, pay_run_id)
    if not pay_run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pay run not found")
    if pay_run.status != "approved":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot process pay run with status '{pay_run.status}'")

    pay_run.status = "processed"
    pay_run.processed_at = datetime.now(timezone.utc)

    # Mark all associated payslips as paid
    payslips_result = await db.execute(
        select(Payslip).where(
            and_(
                Payslip.period_start == pay_run.period_start,
                Payslip.period_end == pay_run.period_end,
                Payslip.status == "approved",
            )
        )
    )
    for p in payslips_result.scalars().all():
        p.status = "paid"

    await db.commit()
    await db.refresh(pay_run)

    await event_bus.publish("payrun.processed", {
        "pay_run_id": str(pay_run.id),
        "total_net": str(pay_run.total_net),
        "processed_at": pay_run.processed_at.isoformat(),
    })

    return PayRunOut.model_validate(pay_run).model_dump()
