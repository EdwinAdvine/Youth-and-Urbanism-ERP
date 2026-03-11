"""Integration tests for the Users API (Super Admin only)."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_list_users_as_superadmin(client: AsyncClient, superadmin_user):
    """GET /api/v1/users returns user list for super admin."""
    resp = await client.get(
        "/api/v1/users",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list) or "total" in data or isinstance(data, dict)


@pytest.mark.asyncio
async def test_list_users_as_normal_user(client: AsyncClient, test_user):
    """GET /api/v1/users as normal user returns 403."""
    resp = await client.get(
        "/api/v1/users",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_user_as_superadmin(client: AsyncClient, superadmin_user):
    """POST /api/v1/users creates a user."""
    resp = await client.post(
        "/api/v1/users",
        json={
            "email": "created-by-admin@example.com",
            "password": "newuserpass123",
            "full_name": "Created By Admin",
        },
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "created-by-admin@example.com"


@pytest.mark.asyncio
async def test_get_user_by_id(client: AsyncClient, superadmin_user, test_user):
    """GET /api/v1/users/{id} returns user details."""
    resp = await client.get(
        f"/api/v1/users/{test_user.id}",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200
    assert resp.json()["email"] == test_user.email


@pytest.mark.asyncio
async def test_update_user(client: AsyncClient, superadmin_user, test_user):
    """PUT /api/v1/users/{id} updates user fields."""
    resp = await client.put(
        f"/api/v1/users/{test_user.id}",
        json={"full_name": "Updated Name"},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Updated Name"


@pytest.mark.asyncio
async def test_delete_user(client: AsyncClient, superadmin_user, test_user):
    """DELETE /api/v1/users/{id} removes/deactivates the user."""
    resp = await client.delete(
        f"/api/v1/users/{test_user.id}",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code in (200, 204)


@pytest.mark.asyncio
async def test_unauthenticated_access(client: AsyncClient):
    """GET /api/v1/users without token returns 401."""
    resp = await client.get("/api/v1/users")
    assert resp.status_code in (401, 403)
