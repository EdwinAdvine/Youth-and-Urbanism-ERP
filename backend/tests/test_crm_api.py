"""Integration tests for the CRM API."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


# ── Contacts ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_contact(client: AsyncClient, test_user):
    """POST /api/v1/crm/contacts creates a contact."""
    resp = await client.post(
        "/api/v1/crm/contacts",
        json={
            "contact_type": "person",
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
        },
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["first_name"] == "John"


@pytest.mark.asyncio
async def test_list_contacts(client: AsyncClient, test_user):
    """GET /api/v1/crm/contacts returns contacts."""
    resp = await client.get(
        "/api/v1/crm/contacts",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_contact_detail(client: AsyncClient, test_user):
    """GET /api/v1/crm/contacts/{id} returns contact detail."""
    create_resp = await client.post(
        "/api/v1/crm/contacts",
        json={"contact_type": "company", "first_name": "Acme Corp"},
        headers=auth_headers(test_user),
    )
    contact_id = create_resp.json()["id"]
    resp = await client.get(
        f"/api/v1/crm/contacts/{contact_id}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_update_contact(client: AsyncClient, test_user):
    """PUT /api/v1/crm/contacts/{id} updates a contact."""
    create_resp = await client.post(
        "/api/v1/crm/contacts",
        json={"contact_type": "person", "first_name": "Jane"},
        headers=auth_headers(test_user),
    )
    contact_id = create_resp.json()["id"]
    resp = await client.put(
        f"/api/v1/crm/contacts/{contact_id}",
        json={"last_name": "Smith"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_delete_contact(client: AsyncClient, test_user):
    """DELETE /api/v1/crm/contacts/{id} deletes a contact."""
    create_resp = await client.post(
        "/api/v1/crm/contacts",
        json={"contact_type": "person", "first_name": "Delete Me"},
        headers=auth_headers(test_user),
    )
    contact_id = create_resp.json()["id"]
    resp = await client.delete(
        f"/api/v1/crm/contacts/{contact_id}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 204


# ── Leads ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_lead(client: AsyncClient, test_user):
    """POST /api/v1/crm/leads creates a lead."""
    resp = await client.post(
        "/api/v1/crm/leads",
        json={"title": "New Business Lead"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    assert resp.json()["title"] == "New Business Lead"


@pytest.mark.asyncio
async def test_list_leads(client: AsyncClient, test_user):
    """GET /api/v1/crm/leads returns leads."""
    resp = await client.get(
        "/api/v1/crm/leads",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_update_lead(client: AsyncClient, test_user):
    """PUT /api/v1/crm/leads/{id} updates a lead."""
    create_resp = await client.post(
        "/api/v1/crm/leads",
        json={"title": "Lead to Update"},
        headers=auth_headers(test_user),
    )
    lead_id = create_resp.json()["id"]
    resp = await client.put(
        f"/api/v1/crm/leads/{lead_id}",
        json={"title": "Updated Lead"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


# ── Opportunities ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_opportunity(client: AsyncClient, test_user):
    """POST /api/v1/crm/opportunities creates an opportunity."""
    resp = await client.post(
        "/api/v1/crm/opportunities",
        json={"title": "Big Deal Opp"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_list_opportunities(client: AsyncClient, test_user):
    """GET /api/v1/crm/opportunities returns opportunities."""
    resp = await client.get(
        "/api/v1/crm/opportunities",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


# ── Pipeline & Dashboard ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_pipeline(client: AsyncClient, test_user):
    """GET /api/v1/crm/pipeline returns pipeline data."""
    resp = await client.get(
        "/api/v1/crm/pipeline",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_crm_dashboard(client: AsyncClient, test_user):
    """GET /api/v1/crm/dashboard returns CRM dashboard."""
    resp = await client.get(
        "/api/v1/crm/dashboard",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


# ── Auth Required ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_crm_requires_auth(client: AsyncClient):
    """CRM endpoints require authentication."""
    resp = await client.get("/api/v1/crm/contacts")
    assert resp.status_code in (401, 403)
