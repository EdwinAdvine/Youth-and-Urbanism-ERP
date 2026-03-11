"""Integration tests for the Profile API."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_get_profile(client: AsyncClient, test_user):
    """GET /api/v1/profile/me returns current user profile."""
    resp = await client.get(
        "/api/v1/profile/me",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == test_user.email


@pytest.mark.asyncio
async def test_update_profile(client: AsyncClient, test_user):
    """PUT /api/v1/profile/me updates profile."""
    resp = await client.put(
        "/api/v1/profile/me",
        json={"full_name": "Updated Profile Name"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Updated Profile Name"


@pytest.mark.asyncio
async def test_change_password(client: AsyncClient, test_user):
    """PUT /api/v1/profile/me/password changes the user password."""
    resp = await client.put(
        "/api/v1/profile/me/password",
        json={"current_password": "testpass123", "new_password": "newpass12345"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_change_password_wrong_current(client: AsyncClient, test_user):
    """PUT /api/v1/profile/me/password with wrong current password fails."""
    resp = await client.put(
        "/api/v1/profile/me/password",
        json={"current_password": "wrongpassword", "new_password": "newpass12345"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code in (400, 401, 403)


@pytest.mark.asyncio
async def test_get_activity(client: AsyncClient, test_user):
    """GET /api/v1/profile/me/activity returns user activity."""
    resp = await client.get(
        "/api/v1/profile/me/activity",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_profile_requires_auth(client: AsyncClient):
    """Profile endpoints require authentication."""
    resp = await client.get("/api/v1/profile/me")
    assert resp.status_code in (401, 403)
