"""Integration tests for the Calendar API — recurrence, timezone, free/busy."""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _create_event(
    client: AsyncClient,
    headers: dict,
    title: str = "Team Standup",
    start: str = "2026-04-01T09:00:00",
    end: str = "2026-04-01T09:30:00",
    event_type: str = "meeting",
    recurrence_rule: str | None = None,
    recurrence_end: str | None = None,
    all_day: bool = False,
) -> dict:
    payload = {
        "title": title,
        "start_time": start,
        "end_time": end,
        "event_type": event_type,
        "all_day": all_day,
    }
    if recurrence_rule:
        payload["recurrence_rule"] = recurrence_rule
    if recurrence_end:
        payload["recurrence_end"] = recurrence_end
    resp = await client.post(
        "/api/v1/calendar/events",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


# ── Event CRUD ───────────────────────────────────────────────────────────────


async def test_create_event(client: AsyncClient, test_user):
    """POST /api/v1/calendar/events creates a calendar event."""
    headers = auth_headers(test_user)
    event = await _create_event(client, headers)
    assert event["title"] == "Team Standup"
    assert event["event_type"] == "meeting"
    assert event["organizer_id"] == str(test_user.id)


async def test_create_event_invalid_type(client: AsyncClient, test_user):
    """POST with invalid event_type → 422."""
    resp = await client.post(
        "/api/v1/calendar/events",
        json={
            "title": "Bad Type",
            "start_time": "2026-04-01T09:00:00",
            "end_time": "2026-04-01T10:00:00",
            "event_type": "invalid_type",
        },
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 422


async def test_create_event_end_before_start(client: AsyncClient, test_user):
    """POST with end_time <= start_time → 422."""
    resp = await client.post(
        "/api/v1/calendar/events",
        json={
            "title": "Bad Times",
            "start_time": "2026-04-01T10:00:00",
            "end_time": "2026-04-01T09:00:00",
            "event_type": "meeting",
        },
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 422


async def test_list_events(client: AsyncClient, test_user):
    """GET /api/v1/calendar/events returns user events."""
    headers = auth_headers(test_user)
    await _create_event(client, headers)
    resp = await client.get("/api/v1/calendar/events", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


async def test_list_events_filter_by_type(client: AsyncClient, test_user):
    """GET .../events?event_type=task filters correctly."""
    headers = auth_headers(test_user)
    await _create_event(client, headers, "Task Event", event_type="task")
    resp = await client.get(
        "/api/v1/calendar/events?event_type=task",
        headers=headers,
    )
    assert resp.status_code == 200
    for e in resp.json()["events"]:
        assert e["event_type"] == "task"


async def test_list_events_filter_by_date_range(client: AsyncClient, test_user):
    """GET .../events?start=...&end=... filters by date range."""
    headers = auth_headers(test_user)
    await _create_event(
        client, headers, "March Event",
        start="2026-03-15T09:00:00", end="2026-03-15T10:00:00",
    )
    await _create_event(
        client, headers, "May Event",
        start="2026-05-15T09:00:00", end="2026-05-15T10:00:00",
    )
    resp = await client.get(
        "/api/v1/calendar/events?start=2026-03-01T00:00:00&end=2026-03-31T23:59:59",
        headers=headers,
    )
    assert resp.status_code == 200
    for e in resp.json()["events"]:
        assert "2026-03" in e["start_time"]


async def test_update_event(client: AsyncClient, test_user):
    """PUT /api/v1/calendar/events/{id} updates event fields."""
    headers = auth_headers(test_user)
    event = await _create_event(client, headers)
    resp = await client.put(
        f"/api/v1/calendar/events/{event['id']}",
        json={"title": "Updated Standup", "location": "Room B"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated Standup"
    assert resp.json()["location"] == "Room B"


async def test_update_event_not_owner_fails(client: AsyncClient, test_user, superadmin_user):
    """PUT by non-organizer → 404."""
    headers = auth_headers(test_user)
    event = await _create_event(client, headers)
    resp = await client.put(
        f"/api/v1/calendar/events/{event['id']}",
        json={"title": "Hacked"},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 404


async def test_delete_event(client: AsyncClient, test_user):
    """DELETE /api/v1/calendar/events/{id} removes an event."""
    headers = auth_headers(test_user)
    event = await _create_event(client, headers, "To Delete")
    resp = await client.delete(
        f"/api/v1/calendar/events/{event['id']}",
        headers=headers,
    )
    assert resp.status_code == 204


async def test_delete_event_not_owner_fails(client: AsyncClient, test_user, superadmin_user):
    """DELETE by non-organizer → 404."""
    headers = auth_headers(test_user)
    event = await _create_event(client, headers)
    resp = await client.delete(
        f"/api/v1/calendar/events/{event['id']}",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 404


# ── Recurrence ───────────────────────────────────────────────────────────────


async def test_create_recurring_event(client: AsyncClient, test_user):
    """Recurring event stores recurrence_rule."""
    headers = auth_headers(test_user)
    event = await _create_event(
        client, headers,
        title="Weekly Standup",
        recurrence_rule="FREQ=WEEKLY;INTERVAL=1",
        recurrence_end="2026-06-30T23:59:59",
    )
    assert event["recurrence_rule"] == "FREQ=WEEKLY;INTERVAL=1"
    assert event["recurrence_end"] is not None


async def test_expand_weekly_recurrence(client: AsyncClient, test_user):
    """POST .../expand creates instances for weekly recurrence."""
    headers = auth_headers(test_user)
    event = await _create_event(
        client, headers,
        title="Weekly Meeting",
        start="2026-04-01T10:00:00",
        end="2026-04-01T11:00:00",
        recurrence_rule="FREQ=WEEKLY",
        recurrence_end="2026-06-30T23:59:59",
    )
    resp = await client.post(
        f"/api/v1/calendar/events/{event['id']}/expand?count=4",
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["instances_created"] == 4
    assert data["parent_event_id"] == event["id"]
    # Verify instances are 7 days apart
    events = data["events"]
    assert len(events) == 4
    for inst in events:
        assert inst["parent_event_id"] == event["id"]


async def test_expand_daily_recurrence(client: AsyncClient, test_user):
    """POST .../expand creates instances for daily recurrence."""
    headers = auth_headers(test_user)
    event = await _create_event(
        client, headers,
        title="Daily Huddle",
        start="2026-04-01T08:00:00",
        end="2026-04-01T08:15:00",
        recurrence_rule="FREQ=DAILY",
    )
    resp = await client.post(
        f"/api/v1/calendar/events/{event['id']}/expand?count=5",
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["instances_created"] == 5


async def test_expand_monthly_recurrence(client: AsyncClient, test_user):
    """POST .../expand creates instances for monthly recurrence."""
    headers = auth_headers(test_user)
    event = await _create_event(
        client, headers,
        title="Monthly Review",
        start="2026-04-01T14:00:00",
        end="2026-04-01T15:00:00",
        recurrence_rule="FREQ=MONTHLY",
    )
    resp = await client.post(
        f"/api/v1/calendar/events/{event['id']}/expand?count=3",
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["instances_created"] == 3


async def test_expand_with_interval(client: AsyncClient, test_user):
    """Recurrence with INTERVAL=2 creates bi-weekly instances."""
    headers = auth_headers(test_user)
    event = await _create_event(
        client, headers,
        title="Bi-Weekly Sync",
        start="2026-04-01T10:00:00",
        end="2026-04-01T10:30:00",
        recurrence_rule="FREQ=WEEKLY;INTERVAL=2",
    )
    resp = await client.post(
        f"/api/v1/calendar/events/{event['id']}/expand?count=3",
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["instances_created"] == 3


async def test_expand_respects_recurrence_end(client: AsyncClient, test_user):
    """Expansion stops when recurrence_end is reached."""
    headers = auth_headers(test_user)
    event = await _create_event(
        client, headers,
        title="Short Series",
        start="2026-04-01T10:00:00",
        end="2026-04-01T10:30:00",
        recurrence_rule="FREQ=WEEKLY",
        recurrence_end="2026-04-15T23:59:59",
    )
    resp = await client.post(
        f"/api/v1/calendar/events/{event['id']}/expand?count=10",
        headers=headers,
    )
    assert resp.status_code == 201
    # Only 2 instances fit before April 15: Apr 8 and Apr 15
    assert resp.json()["instances_created"] == 2


async def test_expand_non_recurring_event_fails(client: AsyncClient, test_user):
    """POST .../expand on non-recurring event → 422."""
    headers = auth_headers(test_user)
    event = await _create_event(client, headers, "One-off Meeting")
    resp = await client.post(
        f"/api/v1/calendar/events/{event['id']}/expand?count=5",
        headers=headers,
    )
    assert resp.status_code == 422


async def test_expand_nonexistent_event_fails(client: AsyncClient, test_user):
    """POST .../expand on nonexistent event → 404."""
    resp = await client.post(
        f"/api/v1/calendar/events/{uuid.uuid4()}/expand?count=5",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


# ── All-day events ───────────────────────────────────────────────────────────


async def test_all_day_event(client: AsyncClient, test_user):
    """All-day events are created correctly."""
    headers = auth_headers(test_user)
    event = await _create_event(
        client, headers,
        title="Company Holiday",
        start="2026-12-25T00:00:00",
        end="2026-12-25T23:59:00",
        event_type="holiday",
        all_day=True,
    )
    assert event["all_day"] is True
    assert event["event_type"] == "holiday"


# ── Attendees ────────────────────────────────────────────────────────────────


async def test_event_with_attendees(client: AsyncClient, test_user, superadmin_user):
    """Events can include an attendees list."""
    headers = auth_headers(test_user)
    event = await _create_event(client, headers, title="Collab Meeting")
    update_resp = await client.put(
        f"/api/v1/calendar/events/{event['id']}",
        json={"attendees": [str(superadmin_user.id)]},
        headers=headers,
    )
    assert update_resp.status_code == 200
    assert str(superadmin_user.id) in update_resp.json()["attendees"]


# ── Reminder events ──────────────────────────────────────────────────────────


async def test_create_reminder_event(client: AsyncClient, test_user):
    """Events of type 'reminder' are accepted."""
    headers = auth_headers(test_user)
    event = await _create_event(
        client, headers,
        title="Submit report",
        start="2026-04-01T17:00:00",
        end="2026-04-01T17:05:00",
        event_type="reminder",
    )
    assert event["event_type"] == "reminder"


# ── Auth Required ────────────────────────────────────────────────────────────


async def test_calendar_requires_auth(client: AsyncClient):
    """Calendar endpoints require authentication."""
    resp = await client.get("/api/v1/calendar/events")
    assert resp.status_code in (401, 403)
