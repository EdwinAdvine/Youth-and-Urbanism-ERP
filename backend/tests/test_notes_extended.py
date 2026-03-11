"""Extended tests for Notes API — deep linking, folder organization, search."""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _create_note(
    client: AsyncClient,
    headers: dict,
    title: str = "Test Note",
    content: str = "Some content",
    tags: list[str] | None = None,
) -> dict:
    resp = await client.post(
        "/api/v1/notes",
        json={"title": title, "content": content, "tags": tags or []},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


# ── Deep Linking Tests ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_add_link_to_note(client: AsyncClient, test_user):
    """POST /api/v1/notes/{id}/links adds a cross-module link."""
    headers = auth_headers(test_user)
    note = await _create_note(client, headers)
    note_id = note["id"]

    resp = await client.post(
        f"/api/v1/notes/{note_id}/links",
        json={"type": "doc", "id": "doc-123", "title": "Q4 Report"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert any(
        link["type"] == "doc" and link["id"] == "doc-123"
        for link in (data.get("linked_items") or [])
    )


@pytest.mark.asyncio
async def test_add_duplicate_link_is_idempotent(client: AsyncClient, test_user):
    """Adding the same link twice does not create duplicates."""
    headers = auth_headers(test_user)
    note = await _create_note(client, headers)
    note_id = note["id"]

    link_payload = {"type": "project", "id": "proj-1", "title": "Website Redesign"}
    await client.post(f"/api/v1/notes/{note_id}/links", json=link_payload, headers=headers)
    resp = await client.post(f"/api/v1/notes/{note_id}/links", json=link_payload, headers=headers)

    assert resp.status_code == 200
    links = resp.json().get("linked_items") or []
    matching = [l for l in links if l["type"] == "project" and l["id"] == "proj-1"]
    assert len(matching) == 1


@pytest.mark.asyncio
async def test_list_note_links(client: AsyncClient, test_user):
    """GET /api/v1/notes/{id}/links returns the linked items."""
    headers = auth_headers(test_user)
    note = await _create_note(client, headers)
    note_id = note["id"]

    # Add two links
    await client.post(
        f"/api/v1/notes/{note_id}/links",
        json={"type": "file", "id": "file-1", "title": "budget.xlsx"},
        headers=headers,
    )
    await client.post(
        f"/api/v1/notes/{note_id}/links",
        json={"type": "task", "id": "task-42", "title": "Review design"},
        headers=headers,
    )

    resp = await client.get(f"/api/v1/notes/{note_id}/links", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["links"]) == 2


@pytest.mark.asyncio
async def test_unlink_item_from_note(client: AsyncClient, test_user):
    """DELETE /api/v1/notes/{id}/links/{type}/{link_id} removes a link."""
    headers = auth_headers(test_user)
    note = await _create_note(client, headers)
    note_id = note["id"]

    await client.post(
        f"/api/v1/notes/{note_id}/links",
        json={"type": "calendar", "id": "evt-99", "title": "Team standup"},
        headers=headers,
    )

    # Remove the link
    resp = await client.delete(
        f"/api/v1/notes/{note_id}/links/calendar/evt-99",
        headers=headers,
    )
    assert resp.status_code == 200
    assert not any(
        l["type"] == "calendar" and l["id"] == "evt-99"
        for l in (resp.json().get("linked_items") or [])
    )


@pytest.mark.asyncio
async def test_link_on_nonexistent_note(client: AsyncClient, test_user):
    """Adding a link to a nonexistent note returns 404."""
    resp = await client.post(
        f"/api/v1/notes/{uuid.uuid4()}/links",
        json={"type": "doc", "id": "x", "title": "X"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


# ── Folder Organization Tests ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_folder(client: AsyncClient, test_user):
    """POST /api/v1/notes/folders creates a folder tag."""
    headers = auth_headers(test_user)
    resp = await client.post(
        "/api/v1/notes/folders",
        json={"name": "Work Notes"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Work Notes"
    assert data["tag"] == "folder:Work Notes"


@pytest.mark.asyncio
async def test_list_folders(client: AsyncClient, test_user):
    """GET /api/v1/notes/folders returns folder list."""
    headers = auth_headers(test_user)
    resp = await client.get("/api/v1/notes/folders", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "folders" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_move_note_to_folder_via_tag(client: AsyncClient, test_user):
    """Assigning a folder tag to a note simulates moving it to a folder."""
    headers = auth_headers(test_user)
    note = await _create_note(client, headers, title="Folder Note")
    note_id = note["id"]

    # Add a folder tag
    resp = await client.post(
        f"/api/v1/notes/{note_id}/tags",
        json={"tag_name": "folder:Projects"},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["tag_name"] == "folder:Projects"


@pytest.mark.asyncio
async def test_delete_folder(client: AsyncClient, test_user):
    """DELETE /api/v1/notes/folders/{name} removes folder tags."""
    headers = auth_headers(test_user)
    resp = await client.delete("/api/v1/notes/folders/Work Notes", headers=headers)
    assert resp.status_code == 204


# ── Search Tests ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_search_notes_by_title(client: AsyncClient, test_user):
    """GET /api/v1/notes/search?q=... finds notes by title."""
    headers = auth_headers(test_user)
    await _create_note(client, headers, title="Quarterly Revenue Report", content="Revenue data")

    resp = await client.get(
        "/api/v1/notes/search?q=Quarterly",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert any("Quarterly" in n["title"] for n in data["notes"])


@pytest.mark.asyncio
async def test_search_notes_by_content(client: AsyncClient, test_user):
    """GET /api/v1/notes/search?q=... finds notes by content."""
    headers = auth_headers(test_user)
    await _create_note(client, headers, title="Meeting Notes", content="Discussion about xylophone budgets")

    resp = await client.get(
        "/api/v1/notes/search?q=xylophone",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


@pytest.mark.asyncio
async def test_search_no_results(client: AsyncClient, test_user):
    """Search with no matching query returns empty list."""
    headers = auth_headers(test_user)
    resp = await client.get(
        "/api/v1/notes/search?q=zzz_no_match_zzz",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_search_with_pinned_filter(client: AsyncClient, test_user):
    """Search with pinned filter limits results."""
    headers = auth_headers(test_user)
    await _create_note(client, headers, title="Pinned Search Test", content="findme")
    # Pin the note would require an update, but we can at least verify the endpoint accepts the param
    resp = await client.get(
        "/api/v1/notes/search?q=findme&pinned=false",
        headers=headers,
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_search_requires_query_param(client: AsyncClient, test_user):
    """Search without q parameter returns 422."""
    resp = await client.get(
        "/api/v1/notes/search",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 422
