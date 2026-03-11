"""Integration tests for the Docs API — comments, versions, doc-links, permissions."""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import auth_headers


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _create_drive_file(db: AsyncSession, owner_id, name: str = "test.docx", is_public: bool = False) -> str:
    """Insert a minimal DriveFile directly in the DB and return its ID."""
    from app.models.drive import DriveFile

    file = DriveFile(
        name=name,
        content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size=0,
        minio_key=f"documents/{owner_id}/{uuid.uuid4().hex}/{name}",
        folder_path="/documents",
        owner_id=owner_id,
        is_public=is_public,
    )
    db.add(file)
    await db.commit()
    await db.refresh(file)
    return str(file.id)


async def _create_project_and_task(client: AsyncClient, headers: dict) -> tuple[str, str]:
    """Create a project and task for doc-link tests."""
    project = await client.post(
        "/api/v1/projects",
        json={"name": f"Doc Link Project {uuid.uuid4().hex[:4]}"},
        headers=headers,
    )
    assert project.status_code == 201
    project_id = project.json()["id"]

    task = await client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "Doc Link Task"},
        headers=headers,
    )
    assert task.status_code == 201
    return project_id, task.json()["id"]


# ── Document listing ─────────────────────────────────────────────────────────


async def test_list_documents(client: AsyncClient, test_user, db: AsyncSession):
    """GET /api/v1/docs/files returns document list."""
    await _create_drive_file(db, test_user.id)
    resp = await client.get(
        "/api/v1/docs/files",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert "documents" in resp.json()


async def test_list_documents_filter_by_type(client: AsyncClient, test_user, db: AsyncSession):
    """GET /api/v1/docs/files?doc_type=docx filters by extension."""
    await _create_drive_file(db, test_user.id, "report.docx")
    await _create_drive_file(db, test_user.id, "data.xlsx")
    resp = await client.get(
        "/api/v1/docs/files?doc_type=docx",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    for doc in resp.json()["documents"]:
        assert doc["extension"] == "docx"


# ── Doc Comments ─────────────────────────────────────────────────────────────


async def test_add_comment_to_document(client: AsyncClient, test_user, db: AsyncSession):
    """POST /api/v1/docs/file/{id}/comments adds a comment."""
    file_id = await _create_drive_file(db, test_user.id)
    resp = await client.post(
        f"/api/v1/docs/file/{file_id}/comments",
        json={"content": "Great work on section 3!", "anchor": "page-3"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    assert resp.json()["content"] == "Great work on section 3!"
    assert resp.json()["anchor"] == "page-3"


async def test_list_comments_on_document(client: AsyncClient, test_user, db: AsyncSession):
    """GET /api/v1/docs/file/{id}/comments returns comments."""
    file_id = await _create_drive_file(db, test_user.id)
    headers = auth_headers(test_user)
    await client.post(
        f"/api/v1/docs/file/{file_id}/comments",
        json={"content": "Comment 1"},
        headers=headers,
    )
    await client.post(
        f"/api/v1/docs/file/{file_id}/comments",
        json={"content": "Comment 2"},
        headers=headers,
    )
    resp = await client.get(
        f"/api/v1/docs/file/{file_id}/comments",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] >= 2


async def test_reply_to_comment(client: AsyncClient, test_user, db: AsyncSession):
    """POST with parent_id creates a reply."""
    file_id = await _create_drive_file(db, test_user.id)
    headers = auth_headers(test_user)
    parent = await client.post(
        f"/api/v1/docs/file/{file_id}/comments",
        json={"content": "Parent comment"},
        headers=headers,
    )
    parent_id = parent.json()["id"]
    resp = await client.post(
        f"/api/v1/docs/file/{file_id}/comments",
        json={"content": "Reply to parent", "parent_id": parent_id},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["parent_id"] == parent_id


async def test_reply_to_nonexistent_parent_fails(client: AsyncClient, test_user, db: AsyncSession):
    """Reply to a nonexistent parent comment → 404."""
    file_id = await _create_drive_file(db, test_user.id)
    resp = await client.post(
        f"/api/v1/docs/file/{file_id}/comments",
        json={"content": "Orphan reply", "parent_id": str(uuid.uuid4())},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


async def test_update_comment(client: AsyncClient, test_user, db: AsyncSession):
    """PUT /api/v1/docs/comment/{id} updates comment content."""
    file_id = await _create_drive_file(db, test_user.id)
    headers = auth_headers(test_user)
    create = await client.post(
        f"/api/v1/docs/file/{file_id}/comments",
        json={"content": "Original"},
        headers=headers,
    )
    comment_id = create.json()["id"]
    resp = await client.put(
        f"/api/v1/docs/comment/{comment_id}",
        json={"content": "Updated"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["content"] == "Updated"


async def test_resolve_comment(client: AsyncClient, test_user, db: AsyncSession):
    """PUT /api/v1/docs/comment/{id} with resolved=True marks it resolved."""
    file_id = await _create_drive_file(db, test_user.id)
    headers = auth_headers(test_user)
    create = await client.post(
        f"/api/v1/docs/file/{file_id}/comments",
        json={"content": "Fix typo"},
        headers=headers,
    )
    comment_id = create.json()["id"]
    resp = await client.put(
        f"/api/v1/docs/comment/{comment_id}",
        json={"resolved": True},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["resolved"] is True


async def test_update_comment_by_non_author_fails(client: AsyncClient, test_user, superadmin_user, db: AsyncSession):
    """PUT on another user's comment → 403."""
    file_id = await _create_drive_file(db, test_user.id, is_public=True)
    headers = auth_headers(test_user)
    create = await client.post(
        f"/api/v1/docs/file/{file_id}/comments",
        json={"content": "My comment"},
        headers=headers,
    )
    comment_id = create.json()["id"]
    resp = await client.put(
        f"/api/v1/docs/comment/{comment_id}",
        json={"content": "Hacked"},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 403


async def test_delete_comment(client: AsyncClient, test_user, db: AsyncSession):
    """DELETE /api/v1/docs/comment/{id} removes a comment."""
    file_id = await _create_drive_file(db, test_user.id)
    headers = auth_headers(test_user)
    create = await client.post(
        f"/api/v1/docs/file/{file_id}/comments",
        json={"content": "Deletable"},
        headers=headers,
    )
    comment_id = create.json()["id"]
    resp = await client.delete(
        f"/api/v1/docs/comment/{comment_id}",
        headers=headers,
    )
    assert resp.status_code == 204


async def test_delete_comment_not_found(client: AsyncClient, test_user):
    """DELETE on nonexistent comment → 404."""
    resp = await client.delete(
        f"/api/v1/docs/comment/{uuid.uuid4()}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


# ── Doc Comments on nonexistent file ─────────────────────────────────────────


async def test_comment_on_nonexistent_file_fails(client: AsyncClient, test_user):
    """POST comment on nonexistent file → 404."""
    resp = await client.post(
        f"/api/v1/docs/file/{uuid.uuid4()}/comments",
        json={"content": "orphan"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


# ── Version History ──────────────────────────────────────────────────────────


async def test_list_versions_empty(client: AsyncClient, test_user, db: AsyncSession):
    """GET /api/v1/docs/file/{id}/versions returns empty list for new file."""
    file_id = await _create_drive_file(db, test_user.id)
    resp = await client.get(
        f"/api/v1/docs/file/{file_id}/versions",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


async def test_list_versions_nonexistent_file(client: AsyncClient, test_user):
    """GET /api/v1/docs/file/{bad_id}/versions → 404."""
    resp = await client.get(
        f"/api/v1/docs/file/{uuid.uuid4()}/versions",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


async def test_download_version_not_found(client: AsyncClient, test_user):
    """GET /api/v1/docs/version/{bad_id}/download → 404."""
    resp = await client.get(
        f"/api/v1/docs/version/{uuid.uuid4()}/download",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


# ── Doc-Links ────────────────────────────────────────────────────────────────


async def test_link_doc_to_task(client: AsyncClient, test_user, db: AsyncSession):
    """POST /api/v1/docs/link links a document to a project task."""
    headers = auth_headers(test_user)
    file_id = await _create_drive_file(db, test_user.id)
    project_id, task_id = await _create_project_and_task(client, headers)

    resp = await client.post(
        "/api/v1/docs/link",
        json={"file_id": file_id, "task_id": task_id, "project_id": project_id},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["file_id"] == file_id
    assert resp.json()["task_id"] == task_id


async def test_duplicate_link_rejected(client: AsyncClient, test_user, db: AsyncSession):
    """Linking the same doc to the same task twice → 409."""
    headers = auth_headers(test_user)
    file_id = await _create_drive_file(db, test_user.id)
    project_id, task_id = await _create_project_and_task(client, headers)

    await client.post(
        "/api/v1/docs/link",
        json={"file_id": file_id, "task_id": task_id, "project_id": project_id},
        headers=headers,
    )
    resp = await client.post(
        "/api/v1/docs/link",
        json={"file_id": file_id, "task_id": task_id, "project_id": project_id},
        headers=headers,
    )
    assert resp.status_code == 409


async def test_link_nonexistent_file_fails(client: AsyncClient, test_user):
    """POST doc-link with nonexistent file → 404."""
    headers = auth_headers(test_user)
    project_id, task_id = await _create_project_and_task(client, headers)
    resp = await client.post(
        "/api/v1/docs/link",
        json={
            "file_id": str(uuid.uuid4()),
            "task_id": task_id,
            "project_id": project_id,
        },
        headers=headers,
    )
    assert resp.status_code == 404


async def test_list_links_for_file(client: AsyncClient, test_user, db: AsyncSession):
    """GET /api/v1/docs/file/{id}/links returns links."""
    headers = auth_headers(test_user)
    file_id = await _create_drive_file(db, test_user.id)
    project_id, task_id = await _create_project_and_task(client, headers)

    await client.post(
        "/api/v1/docs/link",
        json={"file_id": file_id, "task_id": task_id, "project_id": project_id},
        headers=headers,
    )
    resp = await client.get(
        f"/api/v1/docs/file/{file_id}/links",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


async def test_list_docs_for_task(client: AsyncClient, test_user, db: AsyncSession):
    """GET /api/v1/docs/task/{task_id}/docs returns linked documents."""
    headers = auth_headers(test_user)
    file_id = await _create_drive_file(db, test_user.id, "linked.docx")
    project_id, task_id = await _create_project_and_task(client, headers)

    await client.post(
        "/api/v1/docs/link",
        json={"file_id": file_id, "task_id": task_id, "project_id": project_id},
        headers=headers,
    )
    resp = await client.get(
        f"/api/v1/docs/task/{task_id}/docs",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


async def test_delete_doc_link(client: AsyncClient, test_user, db: AsyncSession):
    """DELETE /api/v1/docs/link/{id} removes a doc-task link."""
    headers = auth_headers(test_user)
    file_id = await _create_drive_file(db, test_user.id)
    project_id, task_id = await _create_project_and_task(client, headers)

    create = await client.post(
        "/api/v1/docs/link",
        json={"file_id": file_id, "task_id": task_id, "project_id": project_id},
        headers=headers,
    )
    link_id = create.json()["id"]
    resp = await client.delete(
        f"/api/v1/docs/link/{link_id}",
        headers=headers,
    )
    assert resp.status_code == 204


async def test_delete_doc_link_not_found(client: AsyncClient, test_user):
    """DELETE on nonexistent link → 404."""
    resp = await client.delete(
        f"/api/v1/docs/link/{uuid.uuid4()}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


# ── Permission enforcement ───────────────────────────────────────────────────


async def test_other_user_cannot_view_private_doc_comments(
    client: AsyncClient, test_user, superadmin_user, db: AsyncSession
):
    """Non-owner cannot list comments on a private document → 404."""
    file_id = await _create_drive_file(db, test_user.id, is_public=False)
    resp = await client.get(
        f"/api/v1/docs/file/{file_id}/comments",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 404


async def test_other_user_can_view_public_doc_comments(
    client: AsyncClient, test_user, superadmin_user, db: AsyncSession
):
    """Non-owner CAN list comments on a public document."""
    file_id = await _create_drive_file(db, test_user.id, is_public=True)
    headers = auth_headers(test_user)
    await client.post(
        f"/api/v1/docs/file/{file_id}/comments",
        json={"content": "Public comment"},
        headers=headers,
    )
    resp = await client.get(
        f"/api/v1/docs/file/{file_id}/comments",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


# ── Auth Required ────────────────────────────────────────────────────────────


async def test_docs_requires_auth(client: AsyncClient):
    """Docs endpoints require authentication."""
    resp = await client.get("/api/v1/docs/files")
    assert resp.status_code in (401, 403)


# ── ONLYOFFICE Callback Handler Tests ────────────────────────────────────────


async def test_callback_save_status_acknowledged(client: AsyncClient, test_user, db: AsyncSession):
    """POST /api/v1/docs/callback with status=2 (save) returns {error: 0}."""
    file_id = await _create_drive_file(db, test_user.id)
    resp = await client.post(
        f"/api/v1/docs/callback?file_id={file_id}",
        json={
            "status": 2,
            "url": "http://onlyoffice:80/cache/files/saved_doc.docx",
            "key": "abc123",
            "users": [str(test_user.id)],
        },
    )
    assert resp.status_code == 200
    assert resp.json() == {"error": 0}


async def test_callback_editing_status_acknowledged(client: AsyncClient, test_user, db: AsyncSession):
    """POST /api/v1/docs/callback with status=1 (editing) returns {error: 0}."""
    file_id = await _create_drive_file(db, test_user.id)
    resp = await client.post(
        f"/api/v1/docs/callback?file_id={file_id}",
        json={
            "status": 1,
            "key": "abc123",
            "users": [str(test_user.id)],
        },
    )
    assert resp.status_code == 200
    assert resp.json() == {"error": 0}


async def test_callback_closed_no_changes(client: AsyncClient, test_user, db: AsyncSession):
    """POST /api/v1/docs/callback with status=4 (closed, no changes) returns {error: 0}."""
    file_id = await _create_drive_file(db, test_user.id)
    resp = await client.post(
        f"/api/v1/docs/callback?file_id={file_id}",
        json={
            "status": 4,
            "key": "abc123",
            "users": [str(test_user.id)],
        },
    )
    assert resp.status_code == 200
    assert resp.json() == {"error": 0}


async def test_callback_force_save(client: AsyncClient, test_user, db: AsyncSession):
    """POST /api/v1/docs/callback with status=6 (force-save) returns {error: 0}."""
    file_id = await _create_drive_file(db, test_user.id)
    resp = await client.post(
        f"/api/v1/docs/callback?file_id={file_id}",
        json={
            "status": 6,
            "url": "http://onlyoffice:80/cache/files/force_saved.docx",
            "key": "def456",
            "forcesavetype": 0,
        },
    )
    assert resp.status_code == 200
    assert resp.json() == {"error": 0}


async def test_callback_error_status(client: AsyncClient, test_user, db: AsyncSession):
    """POST /api/v1/docs/callback with status=3 (error) still returns {error: 0}."""
    file_id = await _create_drive_file(db, test_user.id)
    resp = await client.post(
        f"/api/v1/docs/callback?file_id={file_id}",
        json={
            "status": 3,
            "key": "err789",
        },
    )
    assert resp.status_code == 200
    assert resp.json() == {"error": 0}


async def test_callback_invalid_json(client: AsyncClient, test_user, db: AsyncSession):
    """POST /api/v1/docs/callback with invalid JSON returns {error: 1}."""
    file_id = await _create_drive_file(db, test_user.id)
    resp = await client.post(
        f"/api/v1/docs/callback?file_id={file_id}",
        content="not json",
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 200
    assert resp.json() == {"error": 1}


async def test_callback_with_history(client: AsyncClient, test_user, db: AsyncSession):
    """POST /api/v1/docs/callback with history + changesurl is accepted."""
    file_id = await _create_drive_file(db, test_user.id)
    resp = await client.post(
        f"/api/v1/docs/callback?file_id={file_id}",
        json={
            "status": 2,
            "url": "http://onlyoffice:80/cache/files/saved_doc.docx",
            "key": "hist001",
            "users": [str(test_user.id)],
            "history": {"changes": [], "serverVersion": "7.4"},
            "changesurl": "http://onlyoffice:80/cache/files/changes.zip",
        },
    )
    assert resp.status_code == 200
    assert resp.json() == {"error": 0}


async def test_callback_with_actions(client: AsyncClient, test_user, db: AsyncSession):
    """POST /api/v1/docs/callback with actions array is accepted."""
    file_id = await _create_drive_file(db, test_user.id)
    resp = await client.post(
        f"/api/v1/docs/callback?file_id={file_id}",
        json={
            "status": 1,
            "key": "act001",
            "users": [str(test_user.id)],
            "actions": [{"type": 1, "userid": str(test_user.id)}],
        },
    )
    assert resp.status_code == 200
    assert resp.json() == {"error": 0}


# ── Conversion API ──────────────────────────────────────────────────────────


async def test_convert_document_nonexistent_file(client: AsyncClient, test_user):
    """POST /api/v1/docs/{bad_id}/convert on nonexistent file -> 404."""
    resp = await client.post(
        f"/api/v1/docs/{uuid.uuid4()}/convert",
        json={"output_format": "pdf"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


async def test_convert_document_invalid_format(client: AsyncClient, test_user, db: AsyncSession):
    """POST /api/v1/docs/{id}/convert with invalid format -> 422."""
    file_id = await _create_drive_file(db, test_user.id)
    resp = await client.post(
        f"/api/v1/docs/{file_id}/convert",
        json={"output_format": "zip"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 422


# ── Active Editors ──────────────────────────────────────────────────────────


async def test_list_editors_nonexistent_file(client: AsyncClient, test_user):
    """GET /api/v1/docs/{bad_id}/editors on nonexistent file -> 404."""
    resp = await client.get(
        f"/api/v1/docs/{uuid.uuid4()}/editors",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


async def test_list_editors_empty(client: AsyncClient, test_user, db: AsyncSession):
    """GET /api/v1/docs/{id}/editors returns empty list for new file."""
    file_id = await _create_drive_file(db, test_user.id)
    resp = await client.get(
        f"/api/v1/docs/{file_id}/editors",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "editors" in data
    assert "count" in data


# ── Cross-Module: Docs → Mail ──────────────────────────────────────────────


async def test_attach_to_email_nonexistent_file(client: AsyncClient, test_user):
    """POST /api/v1/docs/{bad_id}/attach-to-email -> 404."""
    resp = await client.post(
        f"/api/v1/docs/{uuid.uuid4()}/attach-to-email",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


# ── Cross-Module: Docs → Notes ─────────────────────────────────────────────


async def test_link_to_note_nonexistent_doc(client: AsyncClient, test_user):
    """POST /api/v1/docs/{bad_id}/link-to-note -> 404."""
    resp = await client.post(
        f"/api/v1/docs/{uuid.uuid4()}/link-to-note",
        json={"note_id": str(uuid.uuid4())},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404
