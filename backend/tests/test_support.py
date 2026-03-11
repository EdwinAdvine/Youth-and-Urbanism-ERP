"""Integration tests for the Support / Customer Center API."""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _create_category(client: AsyncClient, headers: dict, name: str = "Billing") -> dict:
    resp = await client.post(
        "/api/v1/support/categories",
        json={"name": name, "slug": name.lower().replace(" ", "-")},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


async def _create_ticket(
    client: AsyncClient,
    headers: dict,
    subject: str = "Cannot login",
    priority: str = "medium",
    category_id: str | None = None,
) -> dict:
    payload: dict = {
        "subject": subject,
        "description": "Detailed description of the issue.",
        "priority": priority,
        "customer_email": "customer@example.com",
        "customer_name": "Test Customer",
    }
    if category_id:
        payload["category_id"] = category_id
    resp = await client.post(
        "/api/v1/support/tickets",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


async def _create_sla(client: AsyncClient, headers: dict, priority: str = "high") -> dict:
    resp = await client.post(
        "/api/v1/support/sla",
        json={
            "name": f"SLA for {priority}",
            "priority": priority,
            "response_time_hours": 2,
            "resolution_time_hours": 24,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


# ── Categories ───────────────────────────────────────────────────────────────


async def test_create_category(client: AsyncClient, test_user):
    """POST /api/v1/support/categories creates a ticket category."""
    cat = await _create_category(client, auth_headers(test_user))
    assert cat["name"] == "Billing"
    assert cat["slug"] == "billing"


async def test_list_categories(client: AsyncClient, test_user):
    """GET /api/v1/support/categories returns categories."""
    await _create_category(client, auth_headers(test_user), "Technical")
    resp = await client.get(
        "/api/v1/support/categories",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_update_category(client: AsyncClient, test_user):
    """PUT /api/v1/support/categories/{id} updates a category."""
    headers = auth_headers(test_user)
    cat = await _create_category(client, headers, "Old Name")
    resp = await client.put(
        f"/api/v1/support/categories/{cat['id']}",
        json={"name": "New Name"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"


async def test_delete_category(client: AsyncClient, test_user):
    """DELETE /api/v1/support/categories/{id} removes a category."""
    headers = auth_headers(test_user)
    cat = await _create_category(client, headers, "Deletable")
    resp = await client.delete(
        f"/api/v1/support/categories/{cat['id']}",
        headers=headers,
    )
    assert resp.status_code == 204


async def test_delete_nonexistent_category_returns_404(client: AsyncClient, test_user):
    """DELETE on nonexistent category → 404."""
    resp = await client.delete(
        f"/api/v1/support/categories/{uuid.uuid4()}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


# ── Tickets — CRUD ───────────────────────────────────────────────────────────


async def test_create_ticket(client: AsyncClient, test_user):
    """POST /api/v1/support/tickets creates a ticket."""
    headers = auth_headers(test_user)
    ticket = await _create_ticket(client, headers)
    assert ticket["ticket_number"].startswith("TKT-")
    assert ticket["status"] == "open"
    assert ticket["priority"] == "medium"


async def test_create_ticket_invalid_priority(client: AsyncClient, test_user):
    """POST with invalid priority → 400."""
    resp = await client.post(
        "/api/v1/support/tickets",
        json={"subject": "Bad Priority", "priority": "extreme"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 400


async def test_list_tickets(client: AsyncClient, test_user):
    """GET /api/v1/support/tickets returns ticket list."""
    headers = auth_headers(test_user)
    await _create_ticket(client, headers)
    resp = await client.get(
        "/api/v1/support/tickets",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


async def test_list_tickets_filter_by_status(client: AsyncClient, test_user):
    """GET /api/v1/support/tickets?status=open filters correctly."""
    headers = auth_headers(test_user)
    await _create_ticket(client, headers)
    resp = await client.get(
        "/api/v1/support/tickets?status=open",
        headers=headers,
    )
    assert resp.status_code == 200
    for t in resp.json()["tickets"]:
        assert t["status"] == "open"


async def test_list_tickets_filter_by_priority(client: AsyncClient, test_user):
    """GET /api/v1/support/tickets?priority=urgent filters correctly."""
    headers = auth_headers(test_user)
    await _create_ticket(client, headers, priority="urgent")
    resp = await client.get(
        "/api/v1/support/tickets?priority=urgent",
        headers=headers,
    )
    assert resp.status_code == 200


async def test_get_ticket_detail(client: AsyncClient, test_user):
    """GET /api/v1/support/tickets/{id} returns detail with comments."""
    headers = auth_headers(test_user)
    ticket = await _create_ticket(client, headers)
    resp = await client.get(
        f"/api/v1/support/tickets/{ticket['id']}",
        headers=headers,
    )
    assert resp.status_code == 200
    assert "comments" in resp.json()


async def test_get_ticket_not_found(client: AsyncClient, test_user):
    """GET /api/v1/support/tickets/{bad_id} → 404."""
    resp = await client.get(
        f"/api/v1/support/tickets/{uuid.uuid4()}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


async def test_update_ticket(client: AsyncClient, test_user):
    """PUT /api/v1/support/tickets/{id} updates ticket fields."""
    headers = auth_headers(test_user)
    ticket = await _create_ticket(client, headers)
    resp = await client.put(
        f"/api/v1/support/tickets/{ticket['id']}",
        json={"subject": "Updated subject", "priority": "high"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["subject"] == "Updated subject"


# ── Ticket lifecycle: open → assign → resolve → close ────────────────────────


async def test_assign_ticket(client: AsyncClient, test_user):
    """POST .../assign transitions open → in_progress when assigned."""
    headers = auth_headers(test_user)
    ticket = await _create_ticket(client, headers)
    resp = await client.post(
        f"/api/v1/support/tickets/{ticket['id']}/assign",
        json={"assigned_to": str(test_user.id)},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_progress"
    assert resp.json()["assigned_to"] is not None


async def test_resolve_ticket(client: AsyncClient, test_user):
    """POST .../resolve transitions ticket → resolved."""
    headers = auth_headers(test_user)
    ticket = await _create_ticket(client, headers)
    resp = await client.post(
        f"/api/v1/support/tickets/{ticket['id']}/resolve",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "resolved"
    assert resp.json()["resolved_at"] is not None


async def test_close_ticket(client: AsyncClient, test_user):
    """POST .../close transitions ticket → closed."""
    headers = auth_headers(test_user)
    ticket = await _create_ticket(client, headers)
    resp = await client.post(
        f"/api/v1/support/tickets/{ticket['id']}/close",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "closed"
    assert resp.json()["closed_at"] is not None


async def test_resolve_closed_ticket_fails(client: AsyncClient, test_user):
    """Resolving a closed ticket returns 400."""
    headers = auth_headers(test_user)
    ticket = await _create_ticket(client, headers)
    await client.post(
        f"/api/v1/support/tickets/{ticket['id']}/close",
        headers=headers,
    )
    resp = await client.post(
        f"/api/v1/support/tickets/{ticket['id']}/resolve",
        headers=headers,
    )
    assert resp.status_code == 400


async def test_reopen_resolved_ticket(client: AsyncClient, test_user):
    """POST .../reopen transitions resolved → open."""
    headers = auth_headers(test_user)
    ticket = await _create_ticket(client, headers)
    await client.post(
        f"/api/v1/support/tickets/{ticket['id']}/resolve",
        headers=headers,
    )
    resp = await client.post(
        f"/api/v1/support/tickets/{ticket['id']}/reopen",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "open"
    assert resp.json()["resolved_at"] is None


async def test_reopen_non_resolved_ticket_fails(client: AsyncClient, test_user):
    """Reopening an already-open ticket returns 400."""
    headers = auth_headers(test_user)
    ticket = await _create_ticket(client, headers)
    resp = await client.post(
        f"/api/v1/support/tickets/{ticket['id']}/reopen",
        headers=headers,
    )
    assert resp.status_code == 400


# ── Comments ─────────────────────────────────────────────────────────────────


async def test_add_comment(client: AsyncClient, test_user):
    """POST .../comments adds a comment to a ticket."""
    headers = auth_headers(test_user)
    ticket = await _create_ticket(client, headers)
    resp = await client.post(
        f"/api/v1/support/tickets/{ticket['id']}/comments",
        json={"content": "Looking into this issue.", "is_internal": False},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["content"] == "Looking into this issue."


async def test_list_comments(client: AsyncClient, test_user):
    """GET .../comments returns comments on a ticket."""
    headers = auth_headers(test_user)
    ticket = await _create_ticket(client, headers)
    await client.post(
        f"/api/v1/support/tickets/{ticket['id']}/comments",
        json={"content": "First comment"},
        headers=headers,
    )
    resp = await client.get(
        f"/api/v1/support/tickets/{ticket['id']}/comments",
        headers=headers,
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1


async def test_add_internal_comment(client: AsyncClient, test_user):
    """Internal comments are flagged accordingly."""
    headers = auth_headers(test_user)
    ticket = await _create_ticket(client, headers)
    resp = await client.post(
        f"/api/v1/support/tickets/{ticket['id']}/comments",
        json={"content": "Internal note", "is_internal": True},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["is_internal"] is True


# ── SLA ──────────────────────────────────────────────────────────────────────


async def test_create_sla_policy(client: AsyncClient, test_user):
    """POST /api/v1/support/sla creates an SLA policy."""
    sla = await _create_sla(client, auth_headers(test_user))
    assert sla["response_time_hours"] == 2
    assert sla["resolution_time_hours"] == 24


async def test_list_sla_policies(client: AsyncClient, test_user):
    """GET /api/v1/support/sla returns list of SLA policies."""
    headers = auth_headers(test_user)
    await _create_sla(client, headers, "low")
    resp = await client.get("/api/v1/support/sla", headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_update_sla_policy(client: AsyncClient, test_user):
    """PUT /api/v1/support/sla/{id} updates an SLA policy."""
    headers = auth_headers(test_user)
    sla = await _create_sla(client, headers, "medium")
    resp = await client.put(
        f"/api/v1/support/sla/{sla['id']}",
        json={"response_time_hours": 4},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["response_time_hours"] == 4


async def test_ticket_sla_dates_set_when_policy_exists(client: AsyncClient, test_user):
    """Ticket creation sets SLA due dates when a matching SLA policy exists."""
    headers = auth_headers(test_user)
    await _create_sla(client, headers, "urgent")
    ticket = await _create_ticket(client, headers, subject="Urgent SLA test", priority="urgent")
    assert ticket["sla_response_due"] is not None
    assert ticket["sla_resolution_due"] is not None


async def test_ticket_sla_response_breach_tracked(client: AsyncClient, test_user, superadmin_user):
    """SLA response breach is tracked when first response is by a different user."""
    headers = auth_headers(test_user)
    ticket = await _create_ticket(client, headers)
    # A different user (agent) responds to track first_response_at
    agent_headers = auth_headers(superadmin_user)
    resp = await client.post(
        f"/api/v1/support/tickets/{ticket['id']}/comments",
        json={"content": "Agent response"},
        headers=agent_headers,
    )
    assert resp.status_code == 201

    # Re-fetch ticket to check first_response_at
    detail = await client.get(
        f"/api/v1/support/tickets/{ticket['id']}",
        headers=headers,
    )
    assert detail.json()["first_response_at"] is not None


# ── Knowledge Base ───────────────────────────────────────────────────────────


async def test_create_kb_article(client: AsyncClient, test_user):
    """POST /api/v1/support/kb creates a KB article."""
    resp = await client.post(
        "/api/v1/support/kb",
        json={
            "title": "How to Reset Password",
            "slug": f"reset-password-{uuid.uuid4().hex[:6]}",
            "content": "Step 1: Go to settings...",
            "status": "published",
        },
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    assert resp.json()["title"] == "How to Reset Password"


async def test_list_kb_articles(client: AsyncClient, test_user):
    """GET /api/v1/support/kb returns published articles."""
    headers = auth_headers(test_user)
    await client.post(
        "/api/v1/support/kb",
        json={
            "title": "KB List Test",
            "slug": f"kb-list-{uuid.uuid4().hex[:6]}",
            "content": "Content here",
            "status": "published",
        },
        headers=headers,
    )
    resp = await client.get("/api/v1/support/kb", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


async def test_search_kb_articles(client: AsyncClient, test_user):
    """GET /api/v1/support/kb?search= searches KB articles."""
    headers = auth_headers(test_user)
    unique_term = f"UniqueKBTerm{uuid.uuid4().hex[:6]}"
    await client.post(
        "/api/v1/support/kb",
        json={
            "title": unique_term,
            "slug": f"search-{uuid.uuid4().hex[:6]}",
            "content": "searchable content",
            "status": "published",
        },
        headers=headers,
    )
    resp = await client.get(
        f"/api/v1/support/kb?search={unique_term}",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


async def test_get_kb_article_increments_views(client: AsyncClient, test_user):
    """GET /api/v1/support/kb/{slug} increments view_count."""
    headers = auth_headers(test_user)
    slug = f"view-test-{uuid.uuid4().hex[:6]}"
    await client.post(
        "/api/v1/support/kb",
        json={
            "title": "View Count Test",
            "slug": slug,
            "content": "Content",
            "status": "published",
        },
        headers=headers,
    )
    resp1 = await client.get(f"/api/v1/support/kb/{slug}", headers=headers)
    assert resp1.status_code == 200
    count1 = resp1.json()["view_count"]

    resp2 = await client.get(f"/api/v1/support/kb/{slug}", headers=headers)
    count2 = resp2.json()["view_count"]
    assert count2 == count1 + 1


async def test_mark_kb_helpful(client: AsyncClient, test_user):
    """POST /api/v1/support/kb/{id}/helpful increments helpful_count."""
    headers = auth_headers(test_user)
    create = await client.post(
        "/api/v1/support/kb",
        json={
            "title": "Helpful Test",
            "slug": f"helpful-{uuid.uuid4().hex[:6]}",
            "content": "Useful content",
            "status": "published",
        },
        headers=headers,
    )
    article_id = create.json()["id"]
    resp = await client.post(
        f"/api/v1/support/kb/{article_id}/helpful",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["helpful_count"] >= 1


async def test_delete_kb_article(client: AsyncClient, test_user):
    """DELETE /api/v1/support/kb/{id} removes an article."""
    headers = auth_headers(test_user)
    create = await client.post(
        "/api/v1/support/kb",
        json={
            "title": "To Delete",
            "slug": f"delete-{uuid.uuid4().hex[:6]}",
            "status": "draft",
        },
        headers=headers,
    )
    article_id = create.json()["id"]
    resp = await client.delete(f"/api/v1/support/kb/{article_id}", headers=headers)
    assert resp.status_code == 204


# ── Dashboard ────────────────────────────────────────────────────────────────


async def test_support_dashboard(client: AsyncClient, test_user):
    """GET /api/v1/support/dashboard/stats returns support stats."""
    resp = await client.get(
        "/api/v1/support/dashboard/stats",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "total_tickets" in data
    assert "sla_breached" in data
    assert "tickets_by_priority" in data


# ── Auth Required ────────────────────────────────────────────────────────────


async def test_support_requires_auth(client: AsyncClient):
    """Support endpoints require authentication."""
    resp = await client.get("/api/v1/support/tickets")
    assert resp.status_code in (401, 403)
