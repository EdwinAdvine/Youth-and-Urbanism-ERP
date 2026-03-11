"""Integration tests for the Notes API."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_create_note(client: AsyncClient, test_user):
    """POST /api/v1/notes creates a note."""
    resp = await client.post(
        "/api/v1/notes",
        json={"title": "My First Note", "content": "Hello world"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "My First Note"


@pytest.mark.asyncio
async def test_list_notes(client: AsyncClient, test_user):
    """GET /api/v1/notes returns notes."""
    await client.post(
        "/api/v1/notes",
        json={"title": "Note for List"},
        headers=auth_headers(test_user),
    )
    resp = await client.get(
        "/api/v1/notes",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_note_detail(client: AsyncClient, test_user):
    """GET /api/v1/notes/{id} returns note detail."""
    create_resp = await client.post(
        "/api/v1/notes",
        json={"title": "Detail Note"},
        headers=auth_headers(test_user),
    )
    note_id = create_resp.json()["id"]
    resp = await client.get(
        f"/api/v1/notes/{note_id}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_update_note(client: AsyncClient, test_user):
    """PUT /api/v1/notes/{id} updates a note."""
    create_resp = await client.post(
        "/api/v1/notes",
        json={"title": "Update Me"},
        headers=auth_headers(test_user),
    )
    note_id = create_resp.json()["id"]
    resp = await client.put(
        f"/api/v1/notes/{note_id}",
        json={"title": "Updated Note", "is_pinned": True},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_delete_note(client: AsyncClient, test_user):
    """DELETE /api/v1/notes/{id} deletes a note."""
    create_resp = await client.post(
        "/api/v1/notes",
        json={"title": "Delete Me"},
        headers=auth_headers(test_user),
    )
    note_id = create_resp.json()["id"]
    resp = await client.delete(
        f"/api/v1/notes/{note_id}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_notes_requires_auth(client: AsyncClient):
    """Notes endpoints require authentication."""
    resp = await client.get("/api/v1/notes")
    assert resp.status_code in (401, 403)
