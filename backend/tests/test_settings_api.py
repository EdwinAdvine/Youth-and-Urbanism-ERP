"""Integration tests for the Settings API."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_get_settings(client: AsyncClient, test_user):
    """GET /api/v1/settings returns settings."""
    resp = await client.get(
        "/api/v1/settings",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_update_settings_as_superadmin(client: AsyncClient, superadmin_user):
    """PUT /api/v1/settings updates settings for super admin."""
    resp = await client.put(
        "/api/v1/settings",
        json={"items": [{"key": "company_name", "value": "Urban Corp", "category": "general"}]},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_preferences(client: AsyncClient, test_user):
    """GET /api/v1/settings/preferences returns user preferences."""
    resp = await client.get(
        "/api/v1/settings/preferences",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_update_preferences(client: AsyncClient, test_user):
    """PUT /api/v1/settings/preferences updates user preferences."""
    resp = await client.put(
        "/api/v1/settings/preferences",
        json={"theme": "dark", "language": "en", "timezone": "Africa/Nairobi"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_settings_requires_auth(client: AsyncClient):
    """Settings endpoints require authentication."""
    resp = await client.get("/api/v1/settings")
    assert resp.status_code in (401, 403)
