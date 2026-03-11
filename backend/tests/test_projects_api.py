"""Integration tests for the Projects API."""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient

from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_create_project(client: AsyncClient, test_user):
    """POST /api/v1/projects/ creates a project."""
    resp = await client.post(
        "/api/v1/projects/",
        json={"name": "Website Redesign", "description": "Revamp the site"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Website Redesign"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_projects(client: AsyncClient, test_user):
    """GET /api/v1/projects/ returns the user's projects."""
    await client.post(
        "/api/v1/projects/",
        json={"name": "Project Alpha"},
        headers=auth_headers(test_user),
    )
    resp = await client.get(
        "/api/v1/projects/",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1


@pytest.mark.asyncio
async def test_create_task(client: AsyncClient, test_user):
    """POST /api/v1/projects/{id}/tasks creates a task."""
    project_resp = await client.post(
        "/api/v1/projects/",
        json={"name": "Task Test Project"},
        headers=auth_headers(test_user),
    )
    project_id = project_resp.json()["id"]

    resp = await client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "Design mockups", "status": "todo", "priority": "high"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    assert resp.json()["title"] == "Design mockups"
    assert resp.json()["priority"] == "high"


@pytest.mark.asyncio
async def test_update_task_status(client: AsyncClient, test_user):
    """PUT /api/v1/projects/{id}/tasks/{tid} updates task status."""
    project_resp = await client.post(
        "/api/v1/projects/",
        json={"name": "Status Test Project"},
        headers=auth_headers(test_user),
    )
    project_id = project_resp.json()["id"]

    task_resp = await client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "Move me", "status": "todo"},
        headers=auth_headers(test_user),
    )
    task_id = task_resp.json()["id"]

    resp = await client.put(
        f"/api/v1/projects/{project_id}/tasks/{task_id}",
        json={"status": "in_progress"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_progress"


@pytest.mark.asyncio
async def test_get_board(client: AsyncClient, test_user):
    """GET /api/v1/projects/{id}/board returns tasks grouped by status."""
    project_resp = await client.post(
        "/api/v1/projects/",
        json={"name": "Board Test"},
        headers=auth_headers(test_user),
    )
    project_id = project_resp.json()["id"]

    # Add tasks in different statuses
    for title, status in [("Task A", "todo"), ("Task B", "in_progress"), ("Task C", "done")]:
        await client.post(
            f"/api/v1/projects/{project_id}/tasks",
            json={"title": title, "status": status},
            headers=auth_headers(test_user),
        )

    resp = await client.get(
        f"/api/v1/projects/{project_id}/board",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    board = resp.json()
    assert "todo" in board
    assert "in_progress" in board
    assert "done" in board


@pytest.mark.asyncio
async def test_delete_project(client: AsyncClient, test_user):
    """DELETE /api/v1/projects/{id} removes the project."""
    project_resp = await client.post(
        "/api/v1/projects/",
        json={"name": "Delete Me"},
        headers=auth_headers(test_user),
    )
    project_id = project_resp.json()["id"]

    resp = await client.delete(
        f"/api/v1/projects/{project_id}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_add_time_log(client: AsyncClient, test_user):
    """POST /api/v1/projects/{id}/tasks/{tid}/time-logs logs time."""
    project_resp = await client.post(
        "/api/v1/projects/",
        json={"name": "Time Log Test"},
        headers=auth_headers(test_user),
    )
    project_id = project_resp.json()["id"]

    task_resp = await client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "Log hours", "status": "in_progress"},
        headers=auth_headers(test_user),
    )
    task_id = task_resp.json()["id"]

    resp = await client.post(
        f"/api/v1/projects/{project_id}/tasks/{task_id}/time-logs",
        json={"hours": 2.5, "description": "Initial work"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    assert resp.json()["hours"] == 2.5
