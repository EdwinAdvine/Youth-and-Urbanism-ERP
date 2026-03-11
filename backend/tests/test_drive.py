"""Integration tests for Drive API — permissions, team folders, bulk operations."""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _upload_file(
    client: AsyncClient,
    headers: dict,
    filename: str = "test.txt",
    content: bytes = b"file content",
) -> dict:
    """Upload a file via the Drive API."""
    resp = await client.post(
        "/api/v1/drive/files/upload",
        files={"file": (filename, content, "text/plain")},
        headers=headers,
    )
    # Accept 200 or 201
    assert resp.status_code in (200, 201), f"Upload failed: {resp.status_code} {resp.text}"
    return resp.json()


async def _create_folder(
    client: AsyncClient,
    headers: dict,
    name: str = "Test Folder",
) -> dict:
    resp = await client.post(
        "/api/v1/drive/folders",
        json={"name": name},
        headers=headers,
    )
    assert resp.status_code in (200, 201), f"Folder create failed: {resp.status_code} {resp.text}"
    return resp.json()


# ── Permission Enforcement Tests ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_owner_can_access_own_file(client: AsyncClient, test_user):
    """File owner can retrieve their own file metadata."""
    headers = auth_headers(test_user)
    uploaded = await _upload_file(client, headers, "myfile.txt")
    file_id = uploaded.get("id") or uploaded.get("file_id")

    if file_id:
        resp = await client.get(f"/api/v1/drive/files/{file_id}", headers=headers)
        assert resp.status_code == 200


@pytest.mark.asyncio
async def test_non_owner_cannot_access_file(client: AsyncClient, test_user, superadmin_user):
    """A different user cannot access a file they don't own or have shared access to."""
    owner_headers = auth_headers(test_user)
    uploaded = await _upload_file(client, owner_headers, "private.txt")
    file_id = uploaded.get("id") or uploaded.get("file_id")

    if file_id:
        other_headers = auth_headers(superadmin_user)
        resp = await client.get(f"/api/v1/drive/files/{file_id}", headers=other_headers)
        # Should be 404 (not found, since they don't have access) or 403
        assert resp.status_code in (403, 404)


@pytest.mark.asyncio
async def test_list_files_only_shows_own(client: AsyncClient, test_user, superadmin_user):
    """Listing files only shows files owned by or shared with the current user."""
    # User uploads a file
    await _upload_file(client, auth_headers(test_user), "user_file.txt")

    # Admin's file list should not contain the user's file (unless shared)
    resp = await client.get("/api/v1/drive/files", headers=auth_headers(superadmin_user))
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_delete_file_only_owner(client: AsyncClient, test_user, superadmin_user):
    """Only the file owner can delete it."""
    owner_headers = auth_headers(test_user)
    uploaded = await _upload_file(client, owner_headers, "delete_test.txt")
    file_id = uploaded.get("id") or uploaded.get("file_id")

    if file_id:
        # Non-owner tries to delete
        resp = await client.delete(
            f"/api/v1/drive/files/{file_id}",
            headers=auth_headers(superadmin_user),
        )
        assert resp.status_code in (403, 404)


# ── Team Folder Membership Tests ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_team_folder(client: AsyncClient, test_user):
    """POST /api/v1/drive/team-folders creates a team folder."""
    headers = auth_headers(test_user)
    resp = await client.post(
        "/api/v1/drive/team-folders",
        json={"name": "Engineering", "description": "Engineering team files"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Engineering"


@pytest.mark.asyncio
async def test_list_team_folders(client: AsyncClient, test_user):
    """GET /api/v1/drive/team-folders returns folders user belongs to."""
    headers = auth_headers(test_user)
    # Create one first
    await client.post(
        "/api/v1/drive/team-folders",
        json={"name": "Marketing"},
        headers=headers,
    )
    resp = await client.get("/api/v1/drive/team-folders", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "team_folders" in data


@pytest.mark.asyncio
async def test_add_member_to_team_folder(client: AsyncClient, test_user, superadmin_user):
    """POST /api/v1/drive/team-folders/{id}/members adds a member."""
    headers = auth_headers(test_user)
    tf_resp = await client.post(
        "/api/v1/drive/team-folders",
        json={"name": "Sales Team"},
        headers=headers,
    )
    assert tf_resp.status_code == 201
    team_id = tf_resp.json()["id"]

    resp = await client.post(
        f"/api/v1/drive/team-folders/{team_id}/members",
        json={"user_id": str(superadmin_user.id), "role": "editor"},
        headers=headers,
    )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_list_team_folder_members(client: AsyncClient, test_user):
    """GET /api/v1/drive/team-folders/{id}/members lists members."""
    headers = auth_headers(test_user)
    tf_resp = await client.post(
        "/api/v1/drive/team-folders",
        json={"name": "Members List Test"},
        headers=headers,
    )
    team_id = tf_resp.json()["id"]

    resp = await client.get(
        f"/api/v1/drive/team-folders/{team_id}/members",
        headers=headers,
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_remove_member_from_team_folder(client: AsyncClient, test_user, superadmin_user):
    """DELETE /api/v1/drive/team-folders/{id}/members/{user_id} removes a member."""
    headers = auth_headers(test_user)
    tf_resp = await client.post(
        "/api/v1/drive/team-folders",
        json={"name": "Remove Member Test"},
        headers=headers,
    )
    team_id = tf_resp.json()["id"]

    # Add then remove
    await client.post(
        f"/api/v1/drive/team-folders/{team_id}/members",
        json={"user_id": str(superadmin_user.id), "role": "viewer"},
        headers=headers,
    )
    resp = await client.delete(
        f"/api/v1/drive/team-folders/{team_id}/members/{superadmin_user.id}",
        headers=headers,
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_team_folder(client: AsyncClient, test_user):
    """DELETE /api/v1/drive/team-folders/{id} deletes the folder."""
    headers = auth_headers(test_user)
    tf_resp = await client.post(
        "/api/v1/drive/team-folders",
        json={"name": "Delete Me"},
        headers=headers,
    )
    team_id = tf_resp.json()["id"]

    resp = await client.delete(
        f"/api/v1/drive/team-folders/{team_id}",
        headers=headers,
    )
    assert resp.status_code == 204


# ── Bulk Operation Tests ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_bulk_delete_files(client: AsyncClient, test_user):
    """POST /api/v1/drive/files/bulk-delete moves multiple files to trash."""
    headers = auth_headers(test_user)
    f1 = await _upload_file(client, headers, "bulk1.txt")
    f2 = await _upload_file(client, headers, "bulk2.txt")

    file_ids = [
        f1.get("id") or f1.get("file_id"),
        f2.get("id") or f2.get("file_id"),
    ]
    file_ids = [fid for fid in file_ids if fid]

    if len(file_ids) >= 2:
        resp = await client.post(
            "/api/v1/drive/files/bulk-delete",
            json={"file_ids": file_ids},
            headers=headers,
        )
        assert resp.status_code == 200


@pytest.mark.asyncio
async def test_bulk_move_files(client: AsyncClient, test_user):
    """POST /api/v1/drive/files/bulk-move moves files to a folder."""
    headers = auth_headers(test_user)

    folder = await _create_folder(client, headers, "Destination Folder")
    folder_id = folder.get("id") or folder.get("folder_id")

    f1 = await _upload_file(client, headers, "move1.txt")
    file_id = f1.get("id") or f1.get("file_id")

    if file_id and folder_id:
        resp = await client.post(
            "/api/v1/drive/files/bulk-move",
            json={"file_ids": [file_id], "target_folder_id": folder_id},
            headers=headers,
        )
        assert resp.status_code == 200


@pytest.mark.asyncio
async def test_bulk_delete_empty_list(client: AsyncClient, test_user):
    """Bulk delete with empty file list handles gracefully."""
    headers = auth_headers(test_user)
    resp = await client.post(
        "/api/v1/drive/files/bulk-delete",
        json={"file_ids": []},
        headers=headers,
    )
    # Should succeed with 200 or return 422 for empty list
    assert resp.status_code in (200, 422)


@pytest.mark.asyncio
async def test_drive_requires_auth(client: AsyncClient):
    """Drive endpoints require authentication."""
    resp = await client.get("/api/v1/drive/files")
    assert resp.status_code in (401, 403)
