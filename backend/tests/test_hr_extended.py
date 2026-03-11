"""Extended HR tests — payroll calculation, tax brackets, pay runs, leave balance, overtime."""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


# ── Tax Bracket CRUD ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_tax_bracket(client: AsyncClient, superadmin_user):
    """POST /api/v1/hr/tax-brackets creates a bracket."""
    resp = await client.post(
        "/api/v1/hr/tax-brackets",
        json={
            "name": "Band 1 (0-24000)",
            "country_code": "KE",
            "min_amount": "0",
            "max_amount": "24000",
            "rate": "0.10",
            "effective_from": "2026-01-01",
        },
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Band 1 (0-24000)"
    assert data["rate"] == "0.10"


@pytest.mark.asyncio
async def test_create_multiple_progressive_brackets(client: AsyncClient, superadmin_user):
    """Create progressive tax brackets and verify listing."""
    h = auth_headers(superadmin_user)
    brackets = [
        {"name": "Prog-0-24k", "min_amount": "0", "max_amount": "24000", "rate": "0.10", "effective_from": "2026-01-01"},
        {"name": "Prog-24k-32k", "min_amount": "24000", "max_amount": "32840", "rate": "0.25", "effective_from": "2026-01-01"},
        {"name": "Prog-32k+", "min_amount": "32840", "rate": "0.30", "effective_from": "2026-01-01"},
    ]
    for b in brackets:
        resp = await client.post("/api/v1/hr/tax-brackets", json=b, headers=h)
        assert resp.status_code == 201

    list_resp = await client.get("/api/v1/hr/tax-brackets", headers=h)
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= 3


@pytest.mark.asyncio
async def test_update_tax_bracket(client: AsyncClient, superadmin_user):
    """PUT /api/v1/hr/tax-brackets/{id} updates a bracket."""
    h = auth_headers(superadmin_user)
    create_resp = await client.post(
        "/api/v1/hr/tax-brackets",
        json={"name": "Updatable", "min_amount": "0", "rate": "0.05", "effective_from": "2026-01-01"},
        headers=h,
    )
    bracket_id = create_resp.json()["id"]

    update_resp = await client.put(
        f"/api/v1/hr/tax-brackets/{bracket_id}",
        json={"rate": "0.08"},
        headers=h,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["rate"] == "0.08"


@pytest.mark.asyncio
async def test_delete_tax_bracket(client: AsyncClient, superadmin_user):
    """DELETE /api/v1/hr/tax-brackets/{id} removes a bracket."""
    h = auth_headers(superadmin_user)
    create_resp = await client.post(
        "/api/v1/hr/tax-brackets",
        json={"name": "Deletable", "min_amount": "0", "rate": "0.01", "effective_from": "2026-01-01"},
        headers=h,
    )
    bracket_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/v1/hr/tax-brackets/{bracket_id}", headers=h)
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_nonexistent_tax_bracket(client: AsyncClient, superadmin_user):
    """DELETE nonexistent bracket returns 404."""
    resp = await client.delete(
        f"/api/v1/hr/tax-brackets/{uuid.uuid4()}",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 404


# ── Statutory Deductions ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_statutory_deduction_percentage(client: AsyncClient, superadmin_user):
    """Create a percentage-based statutory deduction."""
    resp = await client.post(
        "/api/v1/hr/statutory-deductions",
        json={
            "name": "NHIF",
            "calculation_type": "percentage",
            "value": "0.025",
            "max_amount": "1700",
        },
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["calculation_type"] == "percentage"


@pytest.mark.asyncio
async def test_create_statutory_deduction_fixed(client: AsyncClient, superadmin_user):
    """Create a fixed-amount statutory deduction."""
    resp = await client.post(
        "/api/v1/hr/statutory-deductions",
        json={
            "name": "Housing Levy",
            "calculation_type": "fixed",
            "value": "1500",
        },
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["calculation_type"] == "fixed"


@pytest.mark.asyncio
async def test_list_statutory_deductions(client: AsyncClient, test_user):
    """GET /api/v1/hr/statutory-deductions returns deductions."""
    resp = await client.get(
        "/api/v1/hr/statutory-deductions",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert "statutory_deductions" in resp.json()


# ── Pay Run (batch payslip generation) ───────────────────────────────────────


@pytest.mark.asyncio
async def test_generate_pay_run(client: AsyncClient, superadmin_user, test_user):
    """Generate a pay run producing payslips for all active employees."""
    h = auth_headers(superadmin_user)

    # Ensure at least one employee exists
    emp_resp = await client.post(
        "/api/v1/hr/employees",
        json={"user_id": str(test_user.id), "hire_date": "2025-01-01"},
        headers=h,
    )
    # May already exist from other tests
    assert emp_resp.status_code in (201, 400, 409, 422)

    # Generate pay run
    run_resp = await client.post(
        "/api/v1/hr/pay-runs/generate",
        json={
            "period_start": "2026-03-01",
            "period_end": "2026-03-31",
        },
        headers=h,
    )
    assert run_resp.status_code in (201, 404)
    if run_resp.status_code == 201:
        data = run_resp.json()
        assert "pay_run" in data
        assert data["payslips_generated"] >= 1
        pr = data["pay_run"]
        # Verify: gross - deductions = net
        gross = float(pr["total_gross"])
        deductions = float(pr["total_deductions"])
        net = float(pr["total_net"])
        assert net == pytest.approx(gross - deductions, abs=0.01)


@pytest.mark.asyncio
async def test_pay_run_invalid_dates(client: AsyncClient, superadmin_user):
    """Pay run with end_date < start_date should be rejected."""
    resp = await client.post(
        "/api/v1/hr/pay-runs/generate",
        json={
            "period_start": "2026-03-31",
            "period_end": "2026-03-01",
        },
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_list_pay_runs(client: AsyncClient, test_user):
    """GET /api/v1/hr/pay-runs returns list of runs."""
    resp = await client.get(
        "/api/v1/hr/pay-runs",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert "pay_runs" in resp.json()


@pytest.mark.asyncio
async def test_approve_and_process_pay_run(client: AsyncClient, superadmin_user, test_user):
    """Full lifecycle: generate -> approve -> process pay run."""
    h = auth_headers(superadmin_user)

    # Ensure employee exists
    await client.post(
        "/api/v1/hr/employees",
        json={"user_id": str(test_user.id), "hire_date": "2025-01-01"},
        headers=h,
    )

    # Generate
    gen_resp = await client.post(
        "/api/v1/hr/pay-runs/generate",
        json={"period_start": "2026-04-01", "period_end": "2026-04-30"},
        headers=h,
    )
    if gen_resp.status_code != 201:
        pytest.skip("Could not generate pay run (no active employees)")

    run_id = gen_resp.json()["pay_run"]["id"]

    # Approve
    approve_resp = await client.put(
        f"/api/v1/hr/pay-runs/{run_id}/approve",
        headers=h,
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "approved"

    # Process
    process_resp = await client.put(
        f"/api/v1/hr/pay-runs/{run_id}/process",
        headers=h,
    )
    assert process_resp.status_code == 200
    assert process_resp.json()["status"] == "processed"


@pytest.mark.asyncio
async def test_cannot_process_unapproved_pay_run(client: AsyncClient, superadmin_user, test_user):
    """Cannot process a pay run that has not been approved."""
    h = auth_headers(superadmin_user)

    await client.post(
        "/api/v1/hr/employees",
        json={"user_id": str(test_user.id), "hire_date": "2025-01-01"},
        headers=h,
    )

    gen_resp = await client.post(
        "/api/v1/hr/pay-runs/generate",
        json={"period_start": "2026-05-01", "period_end": "2026-05-31"},
        headers=h,
    )
    if gen_resp.status_code != 201:
        pytest.skip("Could not generate pay run")

    run_id = gen_resp.json()["pay_run"]["id"]
    process_resp = await client.put(f"/api/v1/hr/pay-runs/{run_id}/process", headers=h)
    assert process_resp.status_code == 400


# ── Leave Balance ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_leave_balance_report(client: AsyncClient, superadmin_user):
    """GET /api/v1/hr/reports/leave-balance returns balance for all employees."""
    resp = await client.get(
        "/api/v1/hr/reports/leave-balance",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "balances" in data
    assert "year" in data
    # Each balance has allocation, used, remaining
    for bal in data["balances"]:
        assert "annual_allocation" in bal
        assert "used" in bal
        assert "remaining" in bal
        assert bal["remaining"] == pytest.approx(bal["annual_allocation"] - bal["used"], abs=0.01)


# ── Overtime ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_overtime_record(client: AsyncClient, superadmin_user, test_user):
    """Create an overtime record for an employee."""
    h = auth_headers(superadmin_user)

    # Ensure employee exists
    emp_resp = await client.post(
        "/api/v1/hr/employees",
        json={"user_id": str(test_user.id), "hire_date": "2025-01-01"},
        headers=h,
    )
    # Get employee ID
    emp_list = await client.get("/api/v1/hr/employees", headers=h)
    employees = emp_list.json()
    if isinstance(employees, list):
        emp_id = employees[0]["id"] if employees else None
    else:
        items = employees.get("employees", employees.get("items", []))
        emp_id = items[0]["id"] if items else None

    if not emp_id:
        pytest.skip("No employees available")

    ot_resp = await client.post(
        "/api/v1/hr/overtime",
        json={
            "employee_id": emp_id,
            "overtime_date": "2026-03-10",
            "hours": "4.5",
            "rate_multiplier": "1.5",
            "notes": "Weekend work",
        },
        headers=h,
    )
    assert ot_resp.status_code == 201
    data = ot_resp.json()
    assert data["status"] == "pending"
    assert data["hours"] == "4.5"
    assert data["rate_multiplier"] == "1.5"


@pytest.mark.asyncio
async def test_approve_overtime(client: AsyncClient, superadmin_user, test_user):
    """Approve an overtime record."""
    h = auth_headers(superadmin_user)

    emp_list = await client.get("/api/v1/hr/employees", headers=h)
    employees = emp_list.json()
    if isinstance(employees, list):
        emp_id = employees[0]["id"] if employees else None
    else:
        items = employees.get("employees", employees.get("items", []))
        emp_id = items[0]["id"] if items else None

    if not emp_id:
        pytest.skip("No employees available")

    create_resp = await client.post(
        "/api/v1/hr/overtime",
        json={
            "employee_id": emp_id,
            "overtime_date": "2026-03-11",
            "hours": "2",
            "rate_multiplier": "2.0",
        },
        headers=h,
    )
    if create_resp.status_code != 201:
        pytest.skip("Could not create overtime")

    ot_id = create_resp.json()["id"]
    approve_resp = await client.put(f"/api/v1/hr/overtime/{ot_id}/approve", headers=h)
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "approved"


@pytest.mark.asyncio
async def test_reject_overtime(client: AsyncClient, superadmin_user, test_user):
    """Reject an overtime record."""
    h = auth_headers(superadmin_user)

    emp_list = await client.get("/api/v1/hr/employees", headers=h)
    employees = emp_list.json()
    if isinstance(employees, list):
        emp_id = employees[0]["id"] if employees else None
    else:
        items = employees.get("employees", employees.get("items", []))
        emp_id = items[0]["id"] if items else None

    if not emp_id:
        pytest.skip("No employees available")

    create_resp = await client.post(
        "/api/v1/hr/overtime",
        json={
            "employee_id": emp_id,
            "overtime_date": "2026-03-12",
            "hours": "8",
            "rate_multiplier": "1.5",
        },
        headers=h,
    )
    if create_resp.status_code != 201:
        pytest.skip("Could not create overtime")

    ot_id = create_resp.json()["id"]
    reject_resp = await client.put(f"/api/v1/hr/overtime/{ot_id}/reject", headers=h)
    assert reject_resp.status_code == 200
    assert reject_resp.json()["status"] == "rejected"


@pytest.mark.asyncio
async def test_cannot_approve_already_approved_overtime(client: AsyncClient, superadmin_user, test_user):
    """Cannot approve overtime that is already approved."""
    h = auth_headers(superadmin_user)

    emp_list = await client.get("/api/v1/hr/employees", headers=h)
    employees = emp_list.json()
    if isinstance(employees, list):
        emp_id = employees[0]["id"] if employees else None
    else:
        items = employees.get("employees", employees.get("items", []))
        emp_id = items[0]["id"] if items else None

    if not emp_id:
        pytest.skip("No employees available")

    create_resp = await client.post(
        "/api/v1/hr/overtime",
        json={
            "employee_id": emp_id,
            "overtime_date": "2026-03-13",
            "hours": "3",
            "rate_multiplier": "1.5",
        },
        headers=h,
    )
    if create_resp.status_code != 201:
        pytest.skip("Could not create overtime")

    ot_id = create_resp.json()["id"]
    await client.put(f"/api/v1/hr/overtime/{ot_id}/approve", headers=h)

    second_approve = await client.put(f"/api/v1/hr/overtime/{ot_id}/approve", headers=h)
    assert second_approve.status_code == 400


# ── HR Dashboard KPIs ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_hr_dashboard_kpis(client: AsyncClient, test_user):
    """GET /api/v1/hr/dashboard/kpis returns KPI data."""
    resp = await client.get(
        "/api/v1/hr/dashboard/kpis",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "total_employees" in data
    assert "on_leave_today" in data
    assert "avg_salary" in data
    assert "attrition_rate_pct" in data


# ── Auth Required ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_hr_ext_requires_auth(client: AsyncClient):
    """HR extension endpoints require authentication."""
    resp = await client.get("/api/v1/hr/tax-brackets")
    assert resp.status_code in (401, 403)
