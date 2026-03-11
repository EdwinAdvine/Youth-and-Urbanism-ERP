"""Integration tests for the Calendar API."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_create_event(client: AsyncClient, test_user):
    """POST /api/v1/calendar/events creates a calendar event."""
    resp = await client.post(
        "/api/v1/calendar/events",
        json={
            "title": "Team Standup",
            "start_time": "2026-03-15T09:00:00Z",
            "end_time": "2026-03-15T09:30:00Z",
        },
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Team Standup"


@pytest.mark.asyncio
async def test_list_events(client: AsyncClient, test_user):
    """GET /api/v1/calendar/events returns events."""
    resp = await client.get(
        "/api/v1/calendar/events",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_update_event(client: AsyncClient, test_user):
    """PUT /api/v1/calendar/events/{id} updates an event."""
    create_resp = await client.post(
        "/api/v1/calendar/events",
        json={
            "title": "Meeting",
            "start_time": "2026-03-16T10:00:00Z",
            "end_time": "2026-03-16T11:00:00Z",
        },
        headers=auth_headers(test_user),
    )
    event_id = create_resp.json()["id"]
    resp = await client.put(
        f"/api/v1/calendar/events/{event_id}",
        json={"title": "Updated Meeting"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_delete_event(client: AsyncClient, test_user):
    """DELETE /api/v1/calendar/events/{id} deletes an event."""
    create_resp = await client.post(
        "/api/v1/calendar/events",
        json={
            "title": "Delete Event",
            "start_time": "2026-03-17T10:00:00Z",
            "end_time": "2026-03-17T11:00:00Z",
        },
        headers=auth_headers(test_user),
    )
    event_id = create_resp.json()["id"]
    resp = await client.delete(
        f"/api/v1/calendar/events/{event_id}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_calendar_requires_auth(client: AsyncClient):
    """Calendar endpoints require authentication."""
    resp = await client.get("/api/v1/calendar/events")
    assert resp.status_code in (401, 403)
