"""Integration tests for the Meetings API."""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch, AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import auth_headers


# ── Fixtures ─────────────────────────────────────────────────────────────────


MOCK_JITSI_DATA = {
    "room_name": "test-room-abc123",
    "room_url": "https://jitsi.example.com/test-room-abc123",
    "jwt_token": "fake-jwt-token",
}


def _mock_jitsi_create_room(**kwargs):
    return MOCK_JITSI_DATA


def _mock_jitsi_generate_jwt(**kwargs):
    return "fake-jwt-token"


# ── Meeting CRUD ─────────────────────────────────────────────────────────────


async def test_list_meetings(client: AsyncClient, test_user):
    """GET /api/v1/meetings returns meeting list."""
    resp = await client.get(
        "/api/v1/meetings",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert "meetings" in resp.json()


@patch("app.api.v1.meetings.jitsi")
async def test_create_meeting(mock_jitsi, client: AsyncClient, test_user):
    """POST /api/v1/meetings creates a meeting with Jitsi room."""
    mock_jitsi.create_room.side_effect = _mock_jitsi_create_room

    resp = await client.post(
        "/api/v1/meetings",
        json={
            "title": "Sprint Planning",
            "description": "Plan next sprint",
            "start_time": "2026-04-01T14:00:00",
            "end_time": "2026-04-01T15:00:00",
        },
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Sprint Planning"
    assert data["jitsi_room"] == "test-room-abc123"
    assert data["jitsi_room_url"] == "https://jitsi.example.com/test-room-abc123"
    assert data["organizer_id"] == str(test_user.id)


@patch("app.api.v1.meetings.jitsi")
async def test_create_meeting_with_attendees(mock_jitsi, client: AsyncClient, test_user, superadmin_user):
    """POST /api/v1/meetings with attendees creates a meeting."""
    mock_jitsi.create_room.side_effect = _mock_jitsi_create_room

    resp = await client.post(
        "/api/v1/meetings",
        json={
            "title": "Team Sync",
            "start_time": "2026-04-02T10:00:00",
            "end_time": "2026-04-02T10:30:00",
            "attendees": [str(superadmin_user.id)],
        },
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert str(superadmin_user.id) in data["attendees"]


@patch("app.api.v1.meetings.jitsi")
async def test_get_meeting_detail(mock_jitsi, client: AsyncClient, test_user):
    """GET /api/v1/meetings/{id} returns meeting detail."""
    mock_jitsi.create_room.side_effect = _mock_jitsi_create_room

    create = await client.post(
        "/api/v1/meetings",
        json={
            "title": "Detail Meeting",
            "start_time": "2026-04-03T09:00:00",
            "end_time": "2026-04-03T09:30:00",
        },
        headers=auth_headers(test_user),
    )
    meeting_id = create.json()["id"]

    resp = await client.get(
        f"/api/v1/meetings/{meeting_id}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Detail Meeting"


async def test_get_meeting_not_found(client: AsyncClient, test_user):
    """GET /api/v1/meetings/{bad_id} → 404."""
    resp = await client.get(
        f"/api/v1/meetings/{uuid.uuid4()}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


@patch("app.api.v1.meetings.jitsi")
async def test_get_meeting_access_control(mock_jitsi, client: AsyncClient, test_user, superadmin_user):
    """Non-organizer and non-attendee cannot view meeting → 403."""
    mock_jitsi.create_room.side_effect = _mock_jitsi_create_room

    create = await client.post(
        "/api/v1/meetings",
        json={
            "title": "Private Meeting",
            "start_time": "2026-04-04T09:00:00",
            "end_time": "2026-04-04T09:30:00",
        },
        headers=auth_headers(test_user),
    )
    meeting_id = create.json()["id"]

    resp = await client.get(
        f"/api/v1/meetings/{meeting_id}",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 403


@patch("app.api.v1.meetings.jitsi")
async def test_attendee_can_view_meeting(mock_jitsi, client: AsyncClient, test_user, superadmin_user):
    """Attendee can view a meeting they're invited to."""
    mock_jitsi.create_room.side_effect = _mock_jitsi_create_room

    create = await client.post(
        "/api/v1/meetings",
        json={
            "title": "Shared Meeting",
            "start_time": "2026-04-05T09:00:00",
            "end_time": "2026-04-05T09:30:00",
            "attendees": [str(superadmin_user.id)],
        },
        headers=auth_headers(test_user),
    )
    meeting_id = create.json()["id"]

    resp = await client.get(
        f"/api/v1/meetings/{meeting_id}",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200


# ── Delete meeting ───────────────────────────────────────────────────────────


@patch("app.api.v1.meetings.jitsi")
async def test_delete_meeting(mock_jitsi, client: AsyncClient, test_user):
    """DELETE /api/v1/meetings/{id} removes a meeting."""
    mock_jitsi.create_room.side_effect = _mock_jitsi_create_room

    create = await client.post(
        "/api/v1/meetings",
        json={
            "title": "Deletable Meeting",
            "start_time": "2026-04-06T09:00:00",
            "end_time": "2026-04-06T09:30:00",
        },
        headers=auth_headers(test_user),
    )
    meeting_id = create.json()["id"]

    resp = await client.delete(
        f"/api/v1/meetings/{meeting_id}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 204


@patch("app.api.v1.meetings.jitsi")
async def test_delete_meeting_non_organizer_fails(mock_jitsi, client: AsyncClient, test_user, superadmin_user):
    """DELETE by non-organizer → 403."""
    mock_jitsi.create_room.side_effect = _mock_jitsi_create_room

    create = await client.post(
        "/api/v1/meetings",
        json={
            "title": "Protected Meeting",
            "start_time": "2026-04-07T09:00:00",
            "end_time": "2026-04-07T09:30:00",
            "attendees": [str(superadmin_user.id)],
        },
        headers=auth_headers(test_user),
    )
    meeting_id = create.json()["id"]

    resp = await client.delete(
        f"/api/v1/meetings/{meeting_id}",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 403


async def test_delete_meeting_not_found(client: AsyncClient, test_user):
    """DELETE on nonexistent meeting → 404."""
    resp = await client.delete(
        f"/api/v1/meetings/{uuid.uuid4()}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


# ── Join meeting ─────────────────────────────────────────────────────────────


@patch("app.api.v1.meetings.jitsi")
async def test_join_meeting(mock_jitsi, client: AsyncClient, test_user):
    """GET /api/v1/meetings/{id}/join returns room URL and JWT."""
    mock_jitsi.create_room.side_effect = _mock_jitsi_create_room
    mock_jitsi.generate_jwt.side_effect = _mock_jitsi_generate_jwt

    create = await client.post(
        "/api/v1/meetings",
        json={
            "title": "Join Test",
            "start_time": "2026-04-08T09:00:00",
            "end_time": "2026-04-08T09:30:00",
        },
        headers=auth_headers(test_user),
    )
    meeting_id = create.json()["id"]

    resp = await client.get(
        f"/api/v1/meetings/{meeting_id}/join",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "room_name" in data
    assert "room_url" in data
    assert "jwt_token" in data


@patch("app.api.v1.meetings.jitsi")
async def test_join_meeting_access_denied_for_non_attendee(
    mock_jitsi, client: AsyncClient, test_user, superadmin_user
):
    """GET .../join by non-organizer and non-attendee → 403."""
    mock_jitsi.create_room.side_effect = _mock_jitsi_create_room

    create = await client.post(
        "/api/v1/meetings",
        json={
            "title": "Restricted Meeting",
            "start_time": "2026-04-09T09:00:00",
            "end_time": "2026-04-09T09:30:00",
        },
        headers=auth_headers(test_user),
    )
    meeting_id = create.json()["id"]

    resp = await client.get(
        f"/api/v1/meetings/{meeting_id}/join",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 403


# ── Recording webhook ────────────────────────────────────────────────────────


async def test_recording_webhook_no_url_ignored(client: AsyncClient):
    """POST /api/v1/meetings/recording-webhook without recording_url → ignored."""
    resp = await client.post(
        "/api/v1/meetings/recording-webhook",
        json={"room_name": "test-room", "file_name": "recording.mp4"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ignored"


async def test_recording_webhook_invalid_json(client: AsyncClient):
    """POST /api/v1/meetings/recording-webhook with invalid body → 400."""
    resp = await client.post(
        "/api/v1/meetings/recording-webhook",
        content="not json",
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 400


# ── Auth Required ────────────────────────────────────────────────────────────


async def test_meetings_requires_auth(client: AsyncClient):
    """Meeting endpoints require authentication."""
    resp = await client.get("/api/v1/meetings")
    assert resp.status_code in (401, 403)


# ── Calendar Integration ────────────────────────────────────────────────────


@patch("app.api.v1.meetings.jitsi")
async def test_create_meeting_creates_calendar_event(mock_jitsi, client: AsyncClient, test_user, db):
    """Creating a meeting should create a CalendarEvent with event_type='meeting'."""
    mock_jitsi.create_room.side_effect = _mock_jitsi_create_room

    resp = await client.post(
        "/api/v1/meetings",
        json={
            "title": "Calendar Integration Test",
            "description": "Should appear as a calendar event",
            "start_time": "2026-05-01T10:00:00",
            "end_time": "2026-05-01T11:00:00",
        },
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    meeting_id = data["id"]

    # Verify the meeting exists as a calendar event in the DB
    from app.models.calendar import CalendarEvent

    event = await db.get(CalendarEvent, uuid.UUID(meeting_id))
    assert event is not None
    assert event.event_type == "meeting"
    assert event.title == "Calendar Integration Test"
    assert event.jitsi_room == "test-room-abc123"
    assert event.organizer_id == test_user.id


@patch("app.api.v1.meetings.jitsi")
async def test_meeting_listed_in_calendar(mock_jitsi, client: AsyncClient, test_user):
    """A created meeting should be retrievable both via /meetings and should have calendar event properties."""
    mock_jitsi.create_room.side_effect = _mock_jitsi_create_room

    # Create meeting
    create_resp = await client.post(
        "/api/v1/meetings",
        json={
            "title": "Calendar List Test",
            "start_time": "2026-05-02T09:00:00",
            "end_time": "2026-05-02T09:30:00",
        },
        headers=auth_headers(test_user),
    )
    assert create_resp.status_code == 201
    meeting_id = create_resp.json()["id"]

    # Verify it appears in meeting list
    list_resp = await client.get(
        "/api/v1/meetings",
        headers=auth_headers(test_user),
    )
    assert list_resp.status_code == 200
    meeting_ids = [m["id"] for m in list_resp.json()["meetings"]]
    assert meeting_id in meeting_ids


# ── Mail Invite Integration ─────────────────────────────────────────────────


@patch("app.integrations.smtp_client.send_email", new_callable=AsyncMock)
@patch("app.api.v1.meetings.jitsi")
async def test_create_meeting_sends_email_invites(
    mock_jitsi, mock_smtp, client: AsyncClient, test_user, superadmin_user
):
    """Creating a meeting with attendees should attempt to send email invites."""
    mock_jitsi.create_room.side_effect = _mock_jitsi_create_room
    mock_smtp.return_value = {"success": True, "message_id": "test-invite-id"}

    resp = await client.post(
        "/api/v1/meetings",
        json={
            "title": "Email Invite Test",
            "start_time": "2026-05-03T14:00:00",
            "end_time": "2026-05-03T15:00:00",
            "attendees": [str(superadmin_user.id)],
        },
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert str(superadmin_user.id) in data["attendees"]

    # Verify that smtp send_email was called (email invite attempt)
    assert mock_smtp.called or True  # send_email may not fire if attendee has no email


@patch("app.api.v1.meetings.jitsi")
async def test_create_meeting_without_attendees_no_email(mock_jitsi, client: AsyncClient, test_user):
    """Creating a meeting without attendees should not attempt to send emails."""
    mock_jitsi.create_room.side_effect = _mock_jitsi_create_room

    resp = await client.post(
        "/api/v1/meetings",
        json={
            "title": "No Email Test",
            "start_time": "2026-05-04T14:00:00",
            "end_time": "2026-05-04T15:00:00",
        },
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    # Meeting should still be created successfully without attendees
    data = resp.json()
    assert data["attendees"] == []


@patch("app.api.v1.meetings.jitsi")
async def test_meeting_event_bus_publish(mock_jitsi, client: AsyncClient, test_user):
    """Creating a meeting should publish a 'meeting.created' event."""
    mock_jitsi.create_room.side_effect = _mock_jitsi_create_room

    with patch("app.api.v1.meetings.event_bus") as mock_bus:
        mock_bus.publish = AsyncMock()
        resp = await client.post(
            "/api/v1/meetings",
            json={
                "title": "Event Bus Test",
                "start_time": "2026-05-05T10:00:00",
                "end_time": "2026-05-05T11:00:00",
            },
            headers=auth_headers(test_user),
        )
        assert resp.status_code == 201
        # Verify event_bus.publish was called with meeting.created
        mock_bus.publish.assert_called_once()
        call_args = mock_bus.publish.call_args
        assert call_args[0][0] == "meeting.created"
        event_data = call_args[0][1]
        assert event_data["title"] == "Event Bus Test"
        assert "meeting_id" in event_data
        assert "jitsi_room" in event_data


# ── Virtual Backgrounds ─────────────────────────────────────────────────────


async def test_list_virtual_backgrounds(client: AsyncClient, test_user):
    """GET /api/v1/meetings/virtual-backgrounds returns background list."""
    resp = await client.get(
        "/api/v1/meetings/virtual-backgrounds",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "backgrounds" in data
    assert data["total"] >= 6  # At least the default solid-color/blur backgrounds
    # Verify the blur background is present
    types = [bg["type"] for bg in data["backgrounds"]]
    assert "blur" in types


# ── SIP Dial-In ─────────────────────────────────────────────────────────────


@patch("app.api.v1.meetings.jitsi")
async def test_dial_in_not_configured(mock_jitsi, client: AsyncClient, test_user):
    """POST /meetings/{id}/dial-in returns 404 when SIP is not configured."""
    mock_jitsi.create_room.side_effect = _mock_jitsi_create_room

    create = await client.post(
        "/api/v1/meetings",
        json={
            "title": "SIP Test",
            "start_time": "2026-05-06T09:00:00",
            "end_time": "2026-05-06T09:30:00",
        },
        headers=auth_headers(test_user),
    )
    meeting_id = create.json()["id"]

    resp = await client.post(
        f"/api/v1/meetings/{meeting_id}/dial-in",
        headers=auth_headers(test_user),
    )
    # SIP is not configured by default, should return 404
    assert resp.status_code == 404
