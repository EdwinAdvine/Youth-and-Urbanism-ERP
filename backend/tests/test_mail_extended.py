"""Extended Mail tests — send/receive, rules, signatures, threads, search, read receipts."""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import auth_headers


# ── Helpers ─────────────────────────────────────────────────────────────────


MOCK_SMTP_RESULT = {"success": True, "message_id": f"<test-{uuid.uuid4().hex[:8]}@example.com>"}


async def _create_mail_message(db: AsyncSession, user_id, folder: str = "INBOX", subject: str = "Test Subject") -> str:
    """Insert a minimal MailboxMessage directly in the DB and return its ID."""
    from app.models.mail_storage import MailboxMessage
    from datetime import datetime, timezone

    msg = MailboxMessage(
        user_id=user_id,
        folder=folder,
        from_addr="sender@example.com",
        from_name="Sender",
        to_addrs=[{"email": "user@example.com"}],
        subject=subject,
        body_text=f"Body of {subject}",
        body_html=f"<p>Body of {subject}</p>",
        message_id_header=f"<{uuid.uuid4().hex}@example.com>",
        is_read=False,
        received_at=datetime.now(timezone.utc),
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return str(msg.id)


# ── Send email ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.integrations.smtp_client.send_email", new_callable=AsyncMock)
async def test_send_email(mock_smtp, client: AsyncClient, test_user, db: AsyncSession):
    """POST /api/v1/mail/send creates and sends an email."""
    mock_smtp.return_value = MOCK_SMTP_RESULT

    resp = await client.post(
        "/api/v1/mail/send",
        json={
            "to": ["recipient@example.com"],
            "subject": "Hello from test",
            "body": "This is the body",
        },
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data.get("success") is True


@pytest.mark.asyncio
async def test_send_email_missing_to(client: AsyncClient, test_user):
    """POST /api/v1/mail/send without 'to' returns 422."""
    resp = await client.post(
        "/api/v1/mail/send",
        json={"subject": "No recipient", "body": "Missing to field"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 422


# ── List messages ───────────────────────────────────────────────────────────


@pytest.mark.asyncio

async def test_list_messages(client: AsyncClient, test_user, db: AsyncSession):
    """GET /api/v1/mail/messages returns messages list."""
    await _create_mail_message(db, test_user.id, subject="List Test 1")
    await _create_mail_message(db, test_user.id, subject="List Test 2")

    resp = await client.get(
        "/api/v1/mail/messages",
        params={"folder": "INBOX"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "messages" in data
    assert data["total"] >= 2


@pytest.mark.asyncio

async def test_list_messages_pagination(client: AsyncClient, test_user, db: AsyncSession):
    """GET /api/v1/mail/messages with pagination."""
    for i in range(5):
        await _create_mail_message(db, test_user.id, subject=f"Page Test {i}")

    resp = await client.get(
        "/api/v1/mail/messages",
        params={"folder": "INBOX", "page": 1, "limit": 2},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["messages"]) <= 2


# ── Get single message ──────────────────────────────────────────────────────


@pytest.mark.asyncio

async def test_get_message(client: AsyncClient, test_user, db: AsyncSession):
    """GET /api/v1/mail/message/{id} returns message detail."""
    msg_id = await _create_mail_message(db, test_user.id, subject="Detail Message")

    resp = await client.get(
        f"/api/v1/mail/message/{msg_id}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["message"]["subject"] == "Detail Message"


@pytest.mark.asyncio

async def test_get_message_not_found(client: AsyncClient, test_user):
    """GET /api/v1/mail/message/{bad_id} returns 404."""
    resp = await client.get(
        f"/api/v1/mail/message/{uuid.uuid4()}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


# ── Mark as read / star ─────────────────────────────────────────────────────


@pytest.mark.asyncio

async def test_mark_as_read(client: AsyncClient, test_user, db: AsyncSession):
    """PUT /api/v1/mail/message/{id}/read marks message read."""
    msg_id = await _create_mail_message(db, test_user.id, subject="Read Me")

    resp = await client.put(
        f"/api/v1/mail/message/{msg_id}/read",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True


@pytest.mark.asyncio

async def test_toggle_star(client: AsyncClient, test_user, db: AsyncSession):
    """PUT /api/v1/mail/message/{id}/star toggles star."""
    msg_id = await _create_mail_message(db, test_user.id, subject="Star Me")

    resp = await client.put(
        f"/api/v1/mail/message/{msg_id}/star",
        params={"starred": True},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert resp.json()["starred"] is True


# ── Delete message ──────────────────────────────────────────────────────────


@pytest.mark.asyncio

async def test_delete_message_to_trash(client: AsyncClient, test_user, db: AsyncSession):
    """DELETE /api/v1/mail/message/{id} moves to Trash."""
    msg_id = await _create_mail_message(db, test_user.id, subject="Delete Me")

    resp = await client.delete(
        f"/api/v1/mail/message/{msg_id}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True


@pytest.mark.asyncio

async def test_delete_message_permanent(client: AsyncClient, test_user, db: AsyncSession):
    """DELETE /api/v1/mail/message/{id}?permanent=true permanently deletes."""
    msg_id = await _create_mail_message(db, test_user.id, subject="Perm Delete")

    resp = await client.delete(
        f"/api/v1/mail/message/{msg_id}",
        params={"permanent": True},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True


# ── Move message ────────────────────────────────────────────────────────────


@pytest.mark.asyncio

async def test_move_message(client: AsyncClient, test_user, db: AsyncSession):
    """PUT /api/v1/mail/message/{id}/move moves message to another folder."""
    msg_id = await _create_mail_message(db, test_user.id, subject="Move Me")

    resp = await client.put(
        f"/api/v1/mail/message/{msg_id}/move",
        params={"folder": "Archive"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert resp.json()["folder"] == "Archive"


# ── Folders ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio

async def test_list_folders(client: AsyncClient, test_user, db: AsyncSession):
    """GET /api/v1/mail/folders returns folder list."""
    resp = await client.get(
        "/api/v1/mail/folders",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "folders" in data
    folder_names = [f["name"] for f in data["folders"]]
    assert "INBOX" in folder_names
    assert "Sent" in folder_names


# ── Rules CRUD ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_rule(client: AsyncClient, test_user):
    """POST /api/v1/mail/rules creates an inbox rule."""
    resp = await client.post(
        "/api/v1/mail/rules",
        json={
            "name": "Auto-archive newsletters",
            "conditions": {"from_contains": "@newsletter.com"},
            "actions": [{"type": "move", "folder": "Archive"}],
            "match_mode": "all",
            "priority": 1,
        },
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Auto-archive newsletters"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_list_rules(client: AsyncClient, test_user):
    """GET /api/v1/mail/rules returns rule list."""
    h = auth_headers(test_user)
    await client.post(
        "/api/v1/mail/rules",
        json={"name": "List Rule", "conditions": {}, "actions": []},
        headers=h,
    )

    resp = await client.get("/api/v1/mail/rules", headers=h)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


@pytest.mark.asyncio
async def test_update_rule(client: AsyncClient, test_user):
    """PUT /api/v1/mail/rules/{id} updates a rule."""
    h = auth_headers(test_user)
    create_resp = await client.post(
        "/api/v1/mail/rules",
        json={"name": "Update Rule", "conditions": {"subject": "test"}, "actions": []},
        headers=h,
    )
    rule_id = create_resp.json()["id"]

    resp = await client.put(
        f"/api/v1/mail/rules/{rule_id}",
        json={"name": "Updated Rule Name", "is_active": False},
        headers=h,
    )
    assert resp.status_code == 200
    assert resp.json()["updated"] is True


@pytest.mark.asyncio
async def test_delete_rule(client: AsyncClient, test_user):
    """DELETE /api/v1/mail/rules/{id} deletes a rule."""
    h = auth_headers(test_user)
    create_resp = await client.post(
        "/api/v1/mail/rules",
        json={"name": "Delete Rule", "conditions": {}, "actions": []},
        headers=h,
    )
    rule_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/v1/mail/rules/{rule_id}", headers=h)
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True


@pytest.mark.asyncio
async def test_delete_rule_not_found(client: AsyncClient, test_user):
    """DELETE /api/v1/mail/rules/{bad_id} returns 404."""
    resp = await client.delete(
        f"/api/v1/mail/rules/{uuid.uuid4()}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_rule_conditions_format(client: AsyncClient, test_user):
    """Rules store conditions dict and actions list correctly."""
    h = auth_headers(test_user)
    conditions = {"from_contains": "@spam.com", "subject_contains": "viagra"}
    actions = [
        {"type": "move", "folder": "Spam"},
        {"type": "mark_read"},
    ]
    create_resp = await client.post(
        "/api/v1/mail/rules",
        json={
            "name": "Spam Filter",
            "conditions": conditions,
            "actions": actions,
            "match_mode": "any",
            "stop_processing": True,
        },
        headers=h,
    )
    assert create_resp.status_code == 201
    data = create_resp.json()
    assert data["conditions"] == conditions
    assert data["actions"] == actions
    assert data["match_mode"] == "any"
    assert data["stop_processing"] is True


# ── Signatures CRUD ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_signature(client: AsyncClient, test_user):
    """POST /api/v1/mail/signatures creates a signature."""
    resp = await client.post(
        "/api/v1/mail/signatures",
        json={
            "name": "Work Signature",
            "content_text": "Best regards,\nTest User",
            "content_html": "<p>Best regards,<br>Test User</p>",
            "is_default": True,
        },
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Work Signature"
    assert data["is_default"] is True


@pytest.mark.asyncio
async def test_list_signatures(client: AsyncClient, test_user):
    """GET /api/v1/mail/signatures returns signature list."""
    h = auth_headers(test_user)
    await client.post(
        "/api/v1/mail/signatures",
        json={"name": "List Sig", "content_text": "-- sig"},
        headers=h,
    )

    resp = await client.get("/api/v1/mail/signatures", headers=h)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


@pytest.mark.asyncio
async def test_update_signature(client: AsyncClient, test_user):
    """PUT /api/v1/mail/signatures/{id} updates a signature."""
    h = auth_headers(test_user)
    create_resp = await client.post(
        "/api/v1/mail/signatures",
        json={"name": "Update Sig", "content_text": "-- old sig"},
        headers=h,
    )
    sig_id = create_resp.json()["id"]

    resp = await client.put(
        f"/api/v1/mail/signatures/{sig_id}",
        json={"name": "Updated Sig Name", "content_text": "-- new sig"},
        headers=h,
    )
    assert resp.status_code == 200
    assert resp.json()["updated"] is True


@pytest.mark.asyncio
async def test_delete_signature(client: AsyncClient, test_user):
    """DELETE /api/v1/mail/signatures/{id} deletes a signature."""
    h = auth_headers(test_user)
    create_resp = await client.post(
        "/api/v1/mail/signatures",
        json={"name": "Delete Sig", "content_text": "-- del"},
        headers=h,
    )
    sig_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/v1/mail/signatures/{sig_id}", headers=h)
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True


@pytest.mark.asyncio
async def test_default_signature_selection(client: AsyncClient, test_user):
    """Setting a new default signature un-defaults the previous one."""
    h = auth_headers(test_user)

    # Create first default
    resp1 = await client.post(
        "/api/v1/mail/signatures",
        json={"name": "First Default", "content_text": "sig1", "is_default": True},
        headers=h,
    )
    assert resp1.status_code == 201

    # Create second default — should replace first
    resp2 = await client.post(
        "/api/v1/mail/signatures",
        json={"name": "Second Default", "content_text": "sig2", "is_default": True},
        headers=h,
    )
    assert resp2.status_code == 201
    assert resp2.json()["is_default"] is True


# ── Read Receipts ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_read_receipts(client: AsyncClient, test_user):
    """GET /api/v1/mail/read-receipts returns receipts list."""
    resp = await client.get(
        "/api/v1/mail/read-receipts",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "receipts" in data


@pytest.mark.asyncio
async def test_confirm_read_receipt_not_found(client: AsyncClient):
    """POST /api/v1/mail/read-receipts/{bad_id}/confirm returns 404."""
    resp = await client.post(
        f"/api/v1/mail/read-receipts/{uuid.uuid4()}/confirm",
    )
    assert resp.status_code == 404


# ── Thread listing ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_threads(client: AsyncClient, test_user, db: AsyncSession):
    """GET /api/v1/mail/threads returns thread list."""
    from app.models.mail import MailThread
    from datetime import datetime, timezone

    thread = MailThread(
        user_id=test_user.id,
        subject="Thread Subject",
        participant_ids=[str(test_user.id)],
        message_ids=[str(uuid.uuid4())],
        last_message_at=datetime.now(timezone.utc),
        message_count=1,
    )
    db.add(thread)
    await db.commit()

    resp = await client.get(
        "/api/v1/mail/threads",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "threads" in data
    assert data["total"] >= 1


@pytest.mark.asyncio
async def test_list_threads_pagination(client: AsyncClient, test_user):
    """GET /api/v1/mail/threads with pagination params."""
    resp = await client.get(
        "/api/v1/mail/threads",
        params={"page": 1, "limit": 10},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


# ── Search ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_search_messages(client: AsyncClient, test_user):
    """GET /api/v1/mail/search returns results from built-in mail storage."""
    resp = await client.get(
        "/api/v1/mail/search",
        params={"q": "test query"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "messages" in data


@pytest.mark.asyncio
async def test_search_messages_requires_query(client: AsyncClient, test_user):
    """GET /api/v1/mail/search without q param returns 422."""
    resp = await client.get(
        "/api/v1/mail/search",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 422


# ── Labels ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_label_crud(client: AsyncClient, test_user):
    """Create, list, update, delete a mail label."""
    h = auth_headers(test_user)

    # Create
    create_resp = await client.post(
        "/api/v1/mail/labels",
        json={"name": "Important", "color": "#ff3a6e"},
        headers=h,
    )
    assert create_resp.status_code == 201
    label_id = create_resp.json()["id"]

    # List
    list_resp = await client.get("/api/v1/mail/labels", headers=h)
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= 1

    # Update
    update_resp = await client.put(
        f"/api/v1/mail/labels/{label_id}",
        json={"name": "Very Important"},
        headers=h,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Very Important"

    # Delete
    del_resp = await client.delete(f"/api/v1/mail/labels/{label_id}", headers=h)
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_label_not_found(client: AsyncClient, test_user):
    """PUT on nonexistent label returns 404."""
    resp = await client.put(
        f"/api/v1/mail/labels/{uuid.uuid4()}",
        json={"name": "Ghost"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


# ── Filters CRUD ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_filter_crud(client: AsyncClient, test_user):
    """Create, list, get, update, delete a mail filter."""
    h = auth_headers(test_user)

    # Create
    create_resp = await client.post(
        "/api/v1/mail/filters",
        json={
            "name": "Block Spam",
            "conditions": {"from": "@spam.com"},
            "actions": [{"type": "delete"}],
            "priority": 1,
        },
        headers=h,
    )
    assert create_resp.status_code == 201
    filter_id = create_resp.json()["id"]

    # List
    list_resp = await client.get("/api/v1/mail/filters", headers=h)
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= 1

    # Get
    get_resp = await client.get(f"/api/v1/mail/filters/{filter_id}", headers=h)
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Block Spam"

    # Update
    update_resp = await client.put(
        f"/api/v1/mail/filters/{filter_id}",
        json={"name": "Block All Spam", "priority": 0},
        headers=h,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Block All Spam"

    # Delete
    del_resp = await client.delete(f"/api/v1/mail/filters/{filter_id}", headers=h)
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_filter_not_found(client: AsyncClient, test_user):
    """GET nonexistent filter returns 404."""
    resp = await client.get(
        f"/api/v1/mail/filters/{uuid.uuid4()}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


# ── Auth Required ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_mail_requires_auth(client: AsyncClient):
    """Mail endpoints require authentication."""
    resp = await client.get("/api/v1/mail/messages")
    assert resp.status_code in (401, 403)
