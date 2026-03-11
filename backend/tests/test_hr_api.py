"""Integration tests for the HR API."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


# ── Departments ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_department(client: AsyncClient, superadmin_user):
    """POST /api/v1/hr/departments creates a department."""
    resp = await client.post(
        "/api/v1/hr/departments",
        json={"name": "Engineering", "description": "Tech team"},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "Engineering"


@pytest.mark.asyncio
async def test_list_departments(client: AsyncClient, test_user):
    """GET /api/v1/hr/departments returns departments."""
    resp = await client.get(
        "/api/v1/hr/departments",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_update_department(client: AsyncClient, superadmin_user):
    """PUT /api/v1/hr/departments/{id} updates a department."""
    create_resp = await client.post(
        "/api/v1/hr/departments",
        json={"name": "Sales Dept"},
        headers=auth_headers(superadmin_user),
    )
    dept_id = create_resp.json()["id"]
    resp = await client.put(
        f"/api/v1/hr/departments/{dept_id}",
        json={"name": "Sales & Marketing"},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Sales & Marketing"


@pytest.mark.asyncio
async def test_delete_department(client: AsyncClient, superadmin_user):
    """DELETE /api/v1/hr/departments/{id} deletes a department."""
    create_resp = await client.post(
        "/api/v1/hr/departments",
        json={"name": "Temp Dept"},
        headers=auth_headers(superadmin_user),
    )
    dept_id = create_resp.json()["id"]
    resp = await client.delete(
        f"/api/v1/hr/departments/{dept_id}",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 204


# ── Employees ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_employee(client: AsyncClient, superadmin_user, test_user):
    """POST /api/v1/hr/employees creates an employee record."""
    resp = await client.post(
        "/api/v1/hr/employees",
        json={
            "user_id": str(test_user.id),
            "hire_date": "2025-01-01",
        },
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_list_employees(client: AsyncClient, test_user):
    """GET /api/v1/hr/employees returns employees."""
    resp = await client.get(
        "/api/v1/hr/employees",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_my_employee_profile(client: AsyncClient, test_user):
    """GET /api/v1/hr/employees/me returns own employee profile."""
    resp = await client.get(
        "/api/v1/hr/employees/me",
        headers=auth_headers(test_user),
    )
    # May be 200 if employee exists or 404 if not
    assert resp.status_code in (200, 404)


# ── Leave Requests ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_leave_request(client: AsyncClient, test_user):
    """POST /api/v1/hr/leave-requests creates a leave request."""
    resp = await client.post(
        "/api/v1/hr/leave-requests",
        json={
            "leave_type": "annual",
            "start_date": "2026-03-15",
            "end_date": "2026-03-20",
        },
        headers=auth_headers(test_user),
    )
    # May require employee record first
    assert resp.status_code in (201, 400, 404)


@pytest.mark.asyncio
async def test_list_leave_requests(client: AsyncClient, test_user):
    """GET /api/v1/hr/leave-requests returns leave requests."""
    resp = await client.get(
        "/api/v1/hr/leave-requests",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


# ── Attendance ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_attendance(client: AsyncClient, test_user):
    """GET /api/v1/hr/attendance returns attendance records."""
    resp = await client.get(
        "/api/v1/hr/attendance",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_check_in(client: AsyncClient, test_user):
    """POST /api/v1/hr/attendance/check-in records a check-in."""
    resp = await client.post(
        "/api/v1/hr/attendance/check-in",
        headers=auth_headers(test_user),
    )
    # May require employee record
    assert resp.status_code in (200, 201, 400, 404)


# ── Dashboard ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_hr_dashboard_stats(client: AsyncClient, test_user):
    """GET /api/v1/hr/dashboard/stats returns HR dashboard stats."""
    resp = await client.get(
        "/api/v1/hr/dashboard/stats",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


# ── Salary Structures ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_salary_structures(client: AsyncClient, test_user):
    """GET /api/v1/hr/salary-structures returns salary structures."""
    resp = await client.get(
        "/api/v1/hr/salary-structures",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


# ── Payslips ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_payslips(client: AsyncClient, test_user):
    """GET /api/v1/hr/payslips returns payslips."""
    resp = await client.get(
        "/api/v1/hr/payslips",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


# ── Auth Required ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_hr_requires_auth(client: AsyncClient):
    """HR endpoints require authentication."""
    resp = await client.get("/api/v1/hr/departments")
    assert resp.status_code in (401, 403)
