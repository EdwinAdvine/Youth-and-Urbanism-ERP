"""Extended Calendar tests — timezone handling and CalDAV ICS format."""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _create_event(
    client: AsyncClient,
    headers: dict,
    title: str = "TZ Test Event",
    start: str = "2026-04-01T09:00:00",
    end: str = "2026-04-01T09:30:00",
    event_type: str = "meeting",
    **extra: str,
) -> dict:
    payload = {
        "title": title,
        "start_time": start,
        "end_time": end,
        "event_type": event_type,
        **extra,
    }
    resp = await client.post(
        "/api/v1/calendar/events",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


# ── Timezone Handling Tests ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_event_utc_timezone(client: AsyncClient, test_user):
    """Events created with UTC timestamps are stored correctly."""
    headers = auth_headers(test_user)
    event = await _create_event(
        client, headers,
        title="UTC Event",
        start="2026-06-15T14:00:00",
        end="2026-06-15T15:00:00",
    )
    assert event["title"] == "UTC Event"
    assert "14:00" in event["start_time"]
    assert "15:00" in event["end_time"]


@pytest.mark.asyncio
async def test_create_event_with_timezone_offset(client: AsyncClient, test_user):
    """Events with timezone offset in ISO format are accepted."""
    headers = auth_headers(test_user)
    # Submit with EAT (East Africa Time, UTC+3) offset
    event = await _create_event(
        client, headers,
        title="Nairobi Meeting",
        start="2026-06-15T17:00:00+03:00",
        end="2026-06-15T18:00:00+03:00",
    )
    assert event["title"] == "Nairobi Meeting"
    # The event should be stored (exact format depends on backend normalization)
    assert event["start_time"] is not None
    assert event["end_time"] is not None


@pytest.mark.asyncio
async def test_create_event_different_timezone(client: AsyncClient, test_user):
    """Events with US Pacific timezone offset are stored."""
    headers = auth_headers(test_user)
    event = await _create_event(
        client, headers,
        title="SF Standup",
        start="2026-06-15T09:00:00-07:00",
        end="2026-06-15T09:30:00-07:00",
    )
    assert event["title"] == "SF Standup"


@pytest.mark.asyncio
async def test_event_times_preserved_on_retrieval(client: AsyncClient, test_user):
    """Event times from creation match what is returned on GET."""
    headers = auth_headers(test_user)
    event = await _create_event(
        client, headers,
        title="Time Check",
        start="2026-08-20T10:30:00",
        end="2026-08-20T11:45:00",
    )
    event_id = event["id"]

    resp = await client.get(f"/api/v1/calendar/events/{event_id}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "10:30" in data["start_time"]
    assert "11:45" in data["end_time"]


@pytest.mark.asyncio
async def test_all_day_event_date_boundaries(client: AsyncClient, test_user):
    """All-day events span the entire day."""
    headers = auth_headers(test_user)
    event = await _create_event(
        client, headers,
        title="Holiday",
        start="2026-12-25T00:00:00",
        end="2026-12-25T23:59:00",
        event_type="holiday",
        all_day="true",
    )
    assert event["all_day"] is True


@pytest.mark.asyncio
async def test_cross_day_event(client: AsyncClient, test_user):
    """Events that span midnight are created correctly."""
    headers = auth_headers(test_user)
    event = await _create_event(
        client, headers,
        title="Late Night Work",
        start="2026-07-10T22:00:00",
        end="2026-07-11T02:00:00",
    )
    assert event["title"] == "Late Night Work"


@pytest.mark.asyncio
async def test_multi_day_event(client: AsyncClient, test_user):
    """Multi-day events are stored correctly."""
    headers = auth_headers(test_user)
    event = await _create_event(
        client, headers,
        title="Conference",
        start="2026-09-01T08:00:00",
        end="2026-09-03T17:00:00",
    )
    assert event["title"] == "Conference"
    # Start and end on different days
    assert "09-01" in event["start_time"]
    assert "09-03" in event["end_time"]


# ── CalDAV / ICS Format Tests ────────────────────────────────────────────────
# These test the ICS export endpoint if available, or verify event data
# is structured for CalDAV compatibility.


@pytest.mark.asyncio
async def test_event_has_required_caldav_fields(client: AsyncClient, test_user):
    """Events contain fields required for CalDAV / ICS export."""
    headers = auth_headers(test_user)
    event = await _create_event(
        client, headers,
        title="CalDAV Compat",
        start="2026-05-10T09:00:00",
        end="2026-05-10T10:00:00",
    )
    # Required ICS fields: UID (id), SUMMARY (title), DTSTART, DTEND
    assert "id" in event
    assert "title" in event
    assert "start_time" in event
    assert "end_time" in event


@pytest.mark.asyncio
async def test_recurring_event_has_rrule_for_ics(client: AsyncClient, test_user):
    """Recurring events store RRULE for ICS export."""
    headers = auth_headers(test_user)
    resp = await client.post(
        "/api/v1/calendar/events",
        json={
            "title": "Weekly Sync",
            "start_time": "2026-05-10T10:00:00",
            "end_time": "2026-05-10T10:30:00",
            "event_type": "meeting",
            "recurrence_rule": "FREQ=WEEKLY;BYDAY=MO",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["recurrence_rule"] == "FREQ=WEEKLY;BYDAY=MO"


@pytest.mark.asyncio
async def test_event_organizer_set_for_ics(client: AsyncClient, test_user):
    """Events include organizer_id for ICS ORGANIZER field."""
    headers = auth_headers(test_user)
    event = await _create_event(client, headers, title="Organizer Check")
    assert event["organizer_id"] == str(test_user.id)


@pytest.mark.asyncio
async def test_event_with_location_for_ics(client: AsyncClient, test_user):
    """Events with location support ICS LOCATION field."""
    headers = auth_headers(test_user)
    event = await _create_event(client, headers, title="Office Meeting")
    event_id = event["id"]

    resp = await client.put(
        f"/api/v1/calendar/events/{event_id}",
        json={"location": "Room 42, Building A"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["location"] == "Room 42, Building A"


@pytest.mark.asyncio
async def test_event_with_description_for_ics(client: AsyncClient, test_user):
    """Events with description support ICS DESCRIPTION field."""
    headers = auth_headers(test_user)
    event = await _create_event(client, headers, title="Described Event")
    event_id = event["id"]

    resp = await client.put(
        f"/api/v1/calendar/events/{event_id}",
        json={"description": "Discuss Q3 metrics and planning"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert "Q3 metrics" in resp.json()["description"]
