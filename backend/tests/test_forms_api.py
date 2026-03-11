"""Integration tests for the Forms API."""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient

from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_create_form(client: AsyncClient, test_user):
    """POST /api/v1/forms/ creates a form."""
    resp = await client.post(
        "/api/v1/forms/",
        json={"title": "Feedback Form", "description": "Collect feedback"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Feedback Form"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_forms(client: AsyncClient, test_user):
    """GET /api/v1/forms/ returns the user's forms."""
    # Create a form first
    await client.post(
        "/api/v1/forms/",
        json={"title": "Survey"},
        headers=auth_headers(test_user),
    )
    resp = await client.get(
        "/api/v1/forms/",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert any(f["title"] == "Survey" for f in data["forms"])


@pytest.mark.asyncio
async def test_add_field_to_form(client: AsyncClient, test_user):
    """POST /api/v1/forms/{id}/fields adds a field."""
    create_resp = await client.post(
        "/api/v1/forms/",
        json={"title": "Test Form"},
        headers=auth_headers(test_user),
    )
    form_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/v1/forms/{form_id}/fields",
        json={"label": "Your Name", "field_type": "text", "is_required": True, "order": 1},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    assert resp.json()["label"] == "Your Name"


@pytest.mark.asyncio
async def test_submit_response(client: AsyncClient, test_user):
    """POST /api/v1/forms/{id}/responses submits a response."""
    create_resp = await client.post(
        "/api/v1/forms/",
        json={"title": "Response Test"},
        headers=auth_headers(test_user),
    )
    form_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/v1/forms/{form_id}/responses",
        json={"answers": {"q1": "Answer 1"}},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    assert resp.json()["answers"] == {"q1": "Answer 1"}


@pytest.mark.asyncio
async def test_get_form_responses(client: AsyncClient, test_user):
    """GET /api/v1/forms/{id}/responses lists responses."""
    create_resp = await client.post(
        "/api/v1/forms/",
        json={"title": "Resp List Test"},
        headers=auth_headers(test_user),
    )
    form_id = create_resp.json()["id"]

    # Submit a response
    await client.post(
        f"/api/v1/forms/{form_id}/responses",
        json={"answers": {"q1": "test"}},
        headers=auth_headers(test_user),
    )

    resp = await client.get(
        f"/api/v1/forms/{form_id}/responses",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


@pytest.mark.asyncio
async def test_delete_form(client: AsyncClient, test_user):
    """DELETE /api/v1/forms/{id} removes the form."""
    create_resp = await client.post(
        "/api/v1/forms/",
        json={"title": "Delete Me"},
        headers=auth_headers(test_user),
    )
    form_id = create_resp.json()["id"]

    resp = await client.delete(
        f"/api/v1/forms/{form_id}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 204
