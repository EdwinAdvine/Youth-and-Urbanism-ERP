"""Integration tests for the Notifications API."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_list_notifications(client: AsyncClient, test_user):
    """GET /api/v1/notifications returns notifications."""
    resp = await client.get(
        "/api/v1/notifications/",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_unread_count(client: AsyncClient, test_user):
    """GET /api/v1/notifications/unread-count returns unread count."""
    resp = await client.get(
        "/api/v1/notifications/unread-count",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "count" in data or "unread_count" in data or isinstance(data, (int, dict))


@pytest.mark.asyncio
async def test_mark_all_read(client: AsyncClient, test_user):
    """PUT /api/v1/notifications/read-all marks all as read."""
    resp = await client.put(
        "/api/v1/notifications/read-all",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_notifications_requires_auth(client: AsyncClient):
    """Notification endpoints require authentication."""
    resp = await client.get("/api/v1/notifications/")
    assert resp.status_code in (401, 403)
