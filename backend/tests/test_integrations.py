"""Integration tests — health check, auth flow, model imports."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """GET /health returns 200 ok."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_all_models_importable():
    """Verify all models can be imported without errors."""
    from app.models import (
        Account,
        AIAuditLog,
        AIChatHistory,
        AIConfig,
        Attendance,
        Base,
        CalendarEvent,
        Contact,
        Deal,
        Department,
        DriveFile,
        DriveFolder,
        Employee,
        Form,
        FormField,
        FormResponse,
        Invoice,
        JournalEntry,
        JournalLine,
        Lead,
        LeaveRequest,
        Milestone,
        Note,
        Opportunity,
        Payment,
        Project,
        Task,
        TimeLog,
        User,
    )
    # Confirm all have __tablename__
    for model in [
        User, AIConfig, DriveFile, Note, CalendarEvent,
        Form, FormField, FormResponse,
        Project, Task, Milestone, TimeLog,
        Account, JournalEntry, JournalLine, Invoice, Payment,
        Department, Employee, LeaveRequest, Attendance,
        Contact, Lead, Opportunity, Deal,
    ]:
        assert hasattr(model, "__tablename__")


@pytest.mark.asyncio
async def test_unauthenticated_access_blocked(client: AsyncClient):
    """Protected endpoints return 401/403 without auth."""
    resp = await client.get("/api/v1/forms/")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_authenticated_access(client: AsyncClient, test_user):
    """Authenticated user can access protected endpoints."""
    resp = await client.get(
        "/api/v1/forms/",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
