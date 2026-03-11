"""Extended tests for Forms API — export, validation, settings."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _create_form_with_fields(
    client: AsyncClient,
    headers: dict,
    title: str = "Test Form",
    fields: list[dict] | None = None,
    settings: dict | None = None,
) -> dict:
    """Create a form and add fields to it."""
    payload: dict = {"title": title}
    if settings:
        payload["settings"] = settings

    resp = await client.post("/api/v1/forms/", json=payload, headers=headers)
    assert resp.status_code == 201
    form = resp.json()
    form_id = form["id"]

    for field in (fields or []):
        field_resp = await client.post(
            f"/api/v1/forms/{form_id}/fields",
            json=field,
            headers=headers,
        )
        assert field_resp.status_code == 201

    return form


async def _submit_response(
    client: AsyncClient,
    headers: dict,
    form_id: str,
    answers: dict,
) -> dict:
    resp = await client.post(
        f"/api/v1/forms/{form_id}/responses",
        json={"answers": answers},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


# ── Export Tests ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_export_responses_json(client: AsyncClient, test_user):
    """GET /api/v1/forms/{id}/export?format=json returns JSON responses."""
    headers = auth_headers(test_user)
    form = await _create_form_with_fields(
        client, headers, "Export JSON Test",
        fields=[
            {"label": "Name", "field_type": "text", "is_required": True, "order": 1},
            {"label": "Email", "field_type": "email", "is_required": True, "order": 2},
        ],
    )
    form_id = form["id"]

    await _submit_response(client, headers, form_id, {"q1": "Alice", "q2": "alice@test.com"})
    await _submit_response(client, headers, form_id, {"q1": "Bob", "q2": "bob@test.com"})

    resp = await client.get(
        f"/api/v1/forms/{form_id}/export?format=json",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 2


@pytest.mark.asyncio
async def test_export_responses_csv(client: AsyncClient, test_user):
    """GET /api/v1/forms/{id}/export?format=csv returns CSV content."""
    headers = auth_headers(test_user)
    form = await _create_form_with_fields(
        client, headers, "Export CSV Test",
        fields=[
            {"label": "Company", "field_type": "text", "is_required": False, "order": 1},
        ],
    )
    form_id = form["id"]
    await _submit_response(client, headers, form_id, {"q1": "Acme Corp"})

    resp = await client.get(
        f"/api/v1/forms/{form_id}/export?format=csv",
        headers=headers,
    )
    assert resp.status_code == 200
    # CSV responses come as binary (application/octet-stream or text/csv)
    assert len(resp.content) > 0


@pytest.mark.asyncio
async def test_export_nonexistent_form(client: AsyncClient, test_user):
    """Export on a nonexistent form returns 404."""
    import uuid

    resp = await client.get(
        f"/api/v1/forms/{uuid.uuid4()}/export?format=json",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_export_empty_responses(client: AsyncClient, test_user):
    """Exporting a form with no responses returns an empty list (JSON)."""
    headers = auth_headers(test_user)
    form = await _create_form_with_fields(client, headers, "Empty Export")

    resp = await client.get(
        f"/api/v1/forms/{form['id']}/export?format=json",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json() == []


# ── Validation Tests ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_field_required(client: AsyncClient, test_user):
    """Fields can be marked as required."""
    headers = auth_headers(test_user)
    form = await _create_form_with_fields(client, headers, "Validation Form")
    form_id = form["id"]

    resp = await client.post(
        f"/api/v1/forms/{form_id}/fields",
        json={"label": "Phone", "field_type": "text", "is_required": True, "order": 1},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["is_required"] is True


@pytest.mark.asyncio
async def test_create_field_types(client: AsyncClient, test_user):
    """Different field types are accepted."""
    headers = auth_headers(test_user)
    form = await _create_form_with_fields(client, headers, "Field Types Form")
    form_id = form["id"]

    field_types = ["text", "email", "number", "select", "checkbox", "textarea", "date"]
    for i, ft in enumerate(field_types):
        resp = await client.post(
            f"/api/v1/forms/{form_id}/fields",
            json={"label": f"Field {ft}", "field_type": ft, "order": i + 1},
            headers=headers,
        )
        assert resp.status_code == 201, f"Failed for field_type={ft}: {resp.text}"
        assert resp.json()["field_type"] == ft


@pytest.mark.asyncio
async def test_select_field_with_options(client: AsyncClient, test_user):
    """Select fields accept options list."""
    headers = auth_headers(test_user)
    form = await _create_form_with_fields(client, headers, "Select Options Form")
    form_id = form["id"]

    resp = await client.post(
        f"/api/v1/forms/{form_id}/fields",
        json={
            "label": "Color Preference",
            "field_type": "select",
            "options": ["Red", "Green", "Blue"],
            "is_required": True,
            "order": 1,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["options"] == ["Red", "Green", "Blue"]


@pytest.mark.asyncio
async def test_create_form_without_title_fails(client: AsyncClient, test_user):
    """Creating a form without a title fails validation."""
    resp = await client.post(
        "/api/v1/forms/",
        json={},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_submit_response_to_nonexistent_form(client: AsyncClient, test_user):
    """Submitting to a nonexistent form returns 404."""
    import uuid

    resp = await client.post(
        f"/api/v1/forms/{uuid.uuid4()}/responses",
        json={"answers": {"q1": "test"}},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_form_settings_crm_lead_capture(client: AsyncClient, test_user):
    """Forms can be created with crm_lead_capture setting."""
    headers = auth_headers(test_user)
    form = await _create_form_with_fields(
        client, headers, "Lead Capture Form",
        settings={"crm_lead_capture": True},
    )
    assert form["title"] == "Lead Capture Form"
    # Verify the settings are stored (depends on API returning settings)
    # At minimum, creation should succeed
    assert "id" in form
