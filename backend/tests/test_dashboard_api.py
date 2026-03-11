"""Integration tests for the Dashboard API."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_dashboard_stats(client: AsyncClient, test_user):
    """GET /api/v1/dashboard/stats returns dashboard statistics."""
    resp = await client.get(
        "/api/v1/dashboard/stats",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)


@pytest.mark.asyncio
async def test_dashboard_activity(client: AsyncClient, test_user):
    """GET /api/v1/dashboard/activity returns recent activity."""
    resp = await client.get(
        "/api/v1/dashboard/activity",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_dashboard_requires_auth(client: AsyncClient):
    """Dashboard endpoints require authentication."""
    resp = await client.get("/api/v1/dashboard/stats")
    assert resp.status_code in (401, 403)
