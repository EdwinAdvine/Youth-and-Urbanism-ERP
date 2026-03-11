"""Integration tests for the Auth API."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_register_user(client: AsyncClient):
    """POST /api/v1/auth/register creates a new user."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "securepass123",
            "full_name": "New User",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "newuser@example.com"
    assert data["full_name"] == "New User"
    assert "id" in data


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    """POST /api/v1/auth/register with duplicate email fails."""
    payload = {
        "email": "dupe@example.com",
        "password": "securepass123",
        "full_name": "Dupe User",
    }
    await client.post("/api/v1/auth/register", json=payload)
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code in (400, 409)


@pytest.mark.asyncio
async def test_register_short_password(client: AsyncClient):
    """POST /api/v1/auth/register with short password fails validation."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "short@example.com", "password": "abc", "full_name": "Short"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    """POST /api/v1/auth/login returns tokens for valid credentials."""
    # Register first
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "logintest@example.com",
            "password": "securepass123",
            "full_name": "Login Test",
        },
    )
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "logintest@example.com", "password": "securepass123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    """POST /api/v1/auth/login with wrong password fails."""
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "wrongpw@example.com",
            "password": "securepass123",
            "full_name": "Wrong PW",
        },
    )
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "wrongpw@example.com", "password": "wrongpassword"},
    )
    assert resp.status_code in (400, 401)


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    """POST /api/v1/auth/login with unknown email fails."""
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "ghost@example.com", "password": "securepass123"},
    )
    assert resp.status_code in (400, 401, 404)


@pytest.mark.asyncio
async def test_me_authenticated(client: AsyncClient, test_user):
    """GET /api/v1/auth/me returns the current user."""
    resp = await client.get(
        "/api/v1/auth/me",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == test_user.email


@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient):
    """GET /api/v1/auth/me without token returns 401."""
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_logout(client: AsyncClient, test_user):
    """POST /api/v1/auth/logout succeeds for authenticated user."""
    resp = await client.post(
        "/api/v1/auth/logout",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "Logged out successfully"
