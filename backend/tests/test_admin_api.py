"""Integration tests for the Admin API."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


# ── Stats ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_stats(client: AsyncClient, superadmin_user):
    """GET /api/v1/admin/stats returns admin statistics."""
    resp = await client.get(
        "/api/v1/admin/stats",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_admin_stats_forbidden_for_normal_user(client: AsyncClient, test_user):
    """GET /api/v1/admin/stats returns 403 for normal users."""
    resp = await client.get(
        "/api/v1/admin/stats",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 403


# ── App Admins ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_app_admins(client: AsyncClient, superadmin_user):
    """GET /api/v1/admin/app-admins returns app admins."""
    resp = await client.get(
        "/api/v1/admin/app-admins",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_create_app_admin(client: AsyncClient, superadmin_user, test_user):
    """POST /api/v1/admin/app-admins creates an app admin."""
    resp = await client.post(
        "/api/v1/admin/app-admins",
        json={"user_id": str(test_user.id), "app_name": "finance"},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code in (200, 201)


# ── AI Config ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_ai_config(client: AsyncClient, superadmin_user):
    """GET /api/v1/admin/ai-config returns AI configuration."""
    resp = await client.get(
        "/api/v1/admin/ai-config",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_update_ai_config(client: AsyncClient, superadmin_user):
    """PUT /api/v1/admin/ai-config updates AI configuration."""
    resp = await client.put(
        "/api/v1/admin/ai-config",
        json={"provider": "ollama", "model_name": "llama3"},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200


# ── Audit Logs ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_audit_logs(client: AsyncClient, superadmin_user):
    """GET /api/v1/admin/audit-logs returns audit logs."""
    resp = await client.get(
        "/api/v1/admin/audit-logs",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200


# ── Auth Required ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_requires_superadmin(client: AsyncClient, test_user):
    """Admin endpoints require super admin role."""
    resp = await client.get(
        "/api/v1/admin/app-admins",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 403
