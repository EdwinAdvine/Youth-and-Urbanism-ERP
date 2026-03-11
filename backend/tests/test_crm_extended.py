"""Extended CRM tests — lead conversion, campaigns, pipeline analytics, contact import."""
from __future__ import annotations

import io
import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


# ── Lead Conversion (lead -> opportunity -> deal) ────────────────────────────


@pytest.mark.asyncio
async def test_lead_conversion_creates_opportunity(client: AsyncClient, test_user):
    """Converting a lead creates an opportunity and marks lead as converted."""
    h = auth_headers(test_user)

    # Create a contact
    contact_resp = await client.post(
        "/api/v1/crm/contacts",
        json={"first_name": "Jane", "last_name": "Doe", "email": "jane@example.com"},
        headers=h,
    )
    assert contact_resp.status_code == 201
    contact_id = contact_resp.json()["id"]

    # Create a lead linked to the contact
    lead_resp = await client.post(
        "/api/v1/crm/leads",
        json={
            "title": "Enterprise Deal",
            "contact_id": contact_id,
            "estimated_value": "50000",
            "source": "referral",
        },
        headers=h,
    )
    assert lead_resp.status_code == 201
    lead_id = lead_resp.json()["id"]
    assert lead_resp.json()["status"] == "new"

    # Convert the lead
    convert_resp = await client.post(
        f"/api/v1/crm/leads/{lead_id}/convert",
        headers=h,
    )
    assert convert_resp.status_code == 200
    opp_data = convert_resp.json()
    assert opp_data["stage"] == "prospecting"
    assert opp_data["lead_id"] == lead_id

    # Verify lead status is now converted
    lead_detail = await client.get(f"/api/v1/crm/leads/{lead_id}", headers=h)
    assert lead_detail.json()["status"] == "converted"


@pytest.mark.asyncio
async def test_cannot_convert_already_converted_lead(client: AsyncClient, test_user):
    """Converting an already-converted lead returns 400."""
    h = auth_headers(test_user)

    lead_resp = await client.post(
        "/api/v1/crm/leads",
        json={"title": "Already Converted Lead", "estimated_value": "1000"},
        headers=h,
    )
    lead_id = lead_resp.json()["id"]

    # Convert once
    await client.post(f"/api/v1/crm/leads/{lead_id}/convert", headers=h)

    # Try converting again
    resp = await client.post(f"/api/v1/crm/leads/{lead_id}/convert", headers=h)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_opportunity_close_won_creates_deal(client: AsyncClient, test_user):
    """Closing an opportunity as won creates a deal."""
    h = auth_headers(test_user)

    opp_resp = await client.post(
        "/api/v1/crm/opportunities",
        json={
            "title": "Big Opp",
            "stage": "negotiation",
            "expected_value": "100000",
            "probability": 80,
        },
        headers=h,
    )
    assert opp_resp.status_code == 201
    opp_id = opp_resp.json()["id"]

    close_resp = await client.post(
        f"/api/v1/crm/opportunities/{opp_id}/close-won",
        headers=h,
    )
    assert close_resp.status_code == 200
    deal = close_resp.json()
    assert deal["status"] == "active"
    assert deal["opportunity_id"] == opp_id
    assert deal["deal_value"] == "100000"


@pytest.mark.asyncio
async def test_opportunity_close_lost(client: AsyncClient, test_user):
    """Closing an opportunity as lost updates its stage."""
    h = auth_headers(test_user)

    opp_resp = await client.post(
        "/api/v1/crm/opportunities",
        json={"title": "Lost Opp", "stage": "proposal", "expected_value": "5000"},
        headers=h,
    )
    opp_id = opp_resp.json()["id"]

    close_resp = await client.post(
        f"/api/v1/crm/opportunities/{opp_id}/close-lost",
        headers=h,
    )
    assert close_resp.status_code == 200
    assert close_resp.json()["stage"] == "closed_lost"


@pytest.mark.asyncio
async def test_cannot_close_already_closed_opportunity(client: AsyncClient, test_user):
    """Cannot close an opportunity that is already closed."""
    h = auth_headers(test_user)

    opp_resp = await client.post(
        "/api/v1/crm/opportunities",
        json={"title": "Closed Opp", "stage": "prospecting", "expected_value": "2000"},
        headers=h,
    )
    opp_id = opp_resp.json()["id"]
    await client.post(f"/api/v1/crm/opportunities/{opp_id}/close-lost", headers=h)

    # Try closing again
    resp = await client.post(f"/api/v1/crm/opportunities/{opp_id}/close-won", headers=h)
    assert resp.status_code == 400


# ── Full Lead-to-Deal pipeline ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_full_lead_to_deal_pipeline(client: AsyncClient, test_user):
    """Full pipeline: create contact -> create lead -> convert -> close won."""
    h = auth_headers(test_user)

    contact_resp = await client.post(
        "/api/v1/crm/contacts",
        json={"first_name": "Pipeline", "last_name": "Customer", "email": "pipe@example.com"},
        headers=h,
    )
    contact_id = contact_resp.json()["id"]

    lead_resp = await client.post(
        "/api/v1/crm/leads",
        json={"title": "Pipeline Deal", "contact_id": contact_id, "estimated_value": "25000"},
        headers=h,
    )
    lead_id = lead_resp.json()["id"]

    # Convert lead -> opportunity
    convert_resp = await client.post(f"/api/v1/crm/leads/{lead_id}/convert", headers=h)
    opp_id = convert_resp.json()["id"]

    # Close won -> deal
    close_resp = await client.post(f"/api/v1/crm/opportunities/{opp_id}/close-won", headers=h)
    assert close_resp.status_code == 200
    deal = close_resp.json()
    assert deal["deal_value"] == "25000"


# ── Campaign CRUD + Analytics ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_campaign_crud(client: AsyncClient, test_user):
    """Create, read, update, delete a campaign."""
    h = auth_headers(test_user)

    # Create
    create_resp = await client.post(
        "/api/v1/crm/campaigns",
        json={
            "name": "Spring Promo",
            "campaign_type": "email",
            "budget": "5000",
            "start_date": "2026-04-01",
            "end_date": "2026-04-30",
        },
        headers=h,
    )
    assert create_resp.status_code == 201
    campaign_id = create_resp.json()["id"]

    # Read
    get_resp = await client.get(f"/api/v1/crm/campaigns/{campaign_id}", headers=h)
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Spring Promo"

    # Update
    update_resp = await client.put(
        f"/api/v1/crm/campaigns/{campaign_id}",
        json={"name": "Spring Promo 2026", "spent": "1200"},
        headers=h,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Spring Promo 2026"

    # Delete
    del_resp = await client.delete(f"/api/v1/crm/campaigns/{campaign_id}", headers=h)
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_campaign_analytics(client: AsyncClient, test_user):
    """GET /api/v1/crm/campaigns/{id}/analytics returns stats."""
    h = auth_headers(test_user)
    create_resp = await client.post(
        "/api/v1/crm/campaigns",
        json={"name": "Analytics Campaign", "campaign_type": "social"},
        headers=h,
    )
    campaign_id = create_resp.json()["id"]

    analytics_resp = await client.get(
        f"/api/v1/crm/campaigns/{campaign_id}/analytics",
        headers=h,
    )
    assert analytics_resp.status_code == 200
    data = analytics_resp.json()
    assert "total_contacts" in data
    assert "open_rate" in data
    assert "click_rate" in data
    assert "conversion_rate" in data


@pytest.mark.asyncio
async def test_list_campaigns_with_filter(client: AsyncClient, test_user):
    """GET /api/v1/crm/campaigns with status filter."""
    h = auth_headers(test_user)
    await client.post(
        "/api/v1/crm/campaigns",
        json={"name": "Draft Campaign", "status": "draft"},
        headers=h,
    )

    resp = await client.get(
        "/api/v1/crm/campaigns",
        params={"status": "draft"},
        headers=h,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


@pytest.mark.asyncio
async def test_campaign_not_found(client: AsyncClient, test_user):
    """GET nonexistent campaign returns 404."""
    resp = await client.get(
        f"/api/v1/crm/campaigns/{uuid.uuid4()}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


# ── Pipeline Analytics ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_pipeline_view(client: AsyncClient, test_user):
    """GET /api/v1/crm/pipeline returns stages with counts and values."""
    resp = await client.get(
        "/api/v1/crm/pipeline",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "stages" in data
    for stage in data["stages"]:
        assert "stage" in stage
        assert "count" in stage
        assert "total_value" in stage


@pytest.mark.asyncio
async def test_pipeline_report_win_rate(client: AsyncClient, test_user):
    """GET /api/v1/crm/reports/pipeline returns conversion rates and win rate."""
    resp = await client.get(
        "/api/v1/crm/reports/pipeline",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "total_opportunities" in data
    assert "stages" in data
    assert "win_rate" in data
    assert isinstance(data["win_rate"], (int, float))


@pytest.mark.asyncio
async def test_sales_forecast(client: AsyncClient, test_user):
    """GET /api/v1/crm/reports/sales-forecast returns monthly forecasts."""
    resp = await client.get(
        "/api/v1/crm/reports/sales-forecast",
        params={"months_ahead": 3},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "forecasts" in data
    assert len(data["forecasts"]) == 3
    for f in data["forecasts"]:
        assert "month" in f
        assert "total_value" in f
        assert "weighted_value" in f


@pytest.mark.asyncio
async def test_crm_dashboard(client: AsyncClient, test_user):
    """GET /api/v1/crm/dashboard returns summary stats."""
    resp = await client.get(
        "/api/v1/crm/dashboard",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "total_contacts" in data
    assert "pipeline_value" in data
    assert "conversion_rate" in data


# ── Contact Import ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_contact_import_csv(client: AsyncClient, test_user):
    """POST /api/v1/crm/contacts/import imports contacts from CSV."""
    csv_content = (
        "contact_type,first_name,last_name,email,phone,source,tags\n"
        "person,Import,One,import1@example.com,+254700000001,csv_test,\"tag1,tag2\"\n"
        "person,Import,Two,import2@example.com,+254700000002,csv_test,tag3\n"
    )

    resp = await client.post(
        "/api/v1/crm/contacts/import",
        files={"file": ("contacts.csv", csv_content.encode(), "text/csv")},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["created"] == 2
    assert data["skipped"] == 0


@pytest.mark.asyncio
async def test_contact_import_rejects_non_csv(client: AsyncClient, test_user):
    """POST /api/v1/crm/contacts/import rejects non-CSV files."""
    resp = await client.post(
        "/api/v1/crm/contacts/import",
        files={"file": ("contacts.txt", b"not csv data", "text/plain")},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_contact_export_csv(client: AsyncClient, test_user):
    """GET /api/v1/crm/contacts/export returns CSV."""
    # Create a contact first
    await client.post(
        "/api/v1/crm/contacts",
        json={"first_name": "Export", "last_name": "Test", "email": "export@example.com"},
        headers=auth_headers(test_user),
    )

    resp = await client.get(
        "/api/v1/crm/contacts/export",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert "text/csv" in resp.headers.get("content-type", "")


# ── Contact Timeline ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_contact_timeline(client: AsyncClient, test_user):
    """GET /api/v1/crm/contacts/{id}/timeline returns activity history."""
    h = auth_headers(test_user)

    contact_resp = await client.post(
        "/api/v1/crm/contacts",
        json={"first_name": "Timeline", "last_name": "Person", "email": "timeline@example.com"},
        headers=h,
    )
    contact_id = contact_resp.json()["id"]

    # Create a lead for this contact
    await client.post(
        "/api/v1/crm/leads",
        json={"title": "Timeline Lead", "contact_id": contact_id},
        headers=h,
    )

    resp = await client.get(f"/api/v1/crm/contacts/{contact_id}/timeline", headers=h)
    assert resp.status_code == 200
    data = resp.json()
    assert "timeline" in data
    assert len(data["timeline"]) >= 1


# ── Auth Required ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_crm_requires_auth(client: AsyncClient):
    """CRM endpoints require authentication."""
    resp = await client.get("/api/v1/crm/contacts")
    assert resp.status_code in (401, 403)
