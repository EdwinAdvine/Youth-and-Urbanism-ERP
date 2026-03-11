"""Integration tests for the Projects API — Kanban, time logging, milestones."""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _create_project(client: AsyncClient, headers: dict, name: str = "Test Project") -> dict:
    resp = await client.post(
        "/api/v1/projects",
        json={"name": name, "status": "active"},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


async def _create_task(
    client: AsyncClient,
    headers: dict,
    project_id: str,
    title: str = "Test Task",
    status: str = "todo",
    order: int = 0,
    priority: str = "medium",
) -> dict:
    resp = await client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={
            "title": title,
            "status": status,
            "order": order,
            "priority": priority,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


# ── Kanban board ─────────────────────────────────────────────────────────────


async def test_kanban_board(client: AsyncClient, test_user):
    """GET .../board returns tasks grouped by status."""
    headers = auth_headers(test_user)
    project = await _create_project(client, headers)
    await _create_task(client, headers, project["id"], "Task A", "todo", 0)
    await _create_task(client, headers, project["id"], "Task B", "in_progress", 1)
    await _create_task(client, headers, project["id"], "Task C", "done", 0)

    resp = await client.get(
        f"/api/v1/projects/{project['id']}/board",
        headers=headers,
    )
    assert resp.status_code == 200
    board = resp.json()
    assert "todo" in board
    assert "in_progress" in board
    assert "done" in board
    assert len(board["todo"]) >= 1
    assert len(board["in_progress"]) >= 1
    assert len(board["done"]) >= 1


async def test_kanban_board_unknown_status_goes_to_todo(client: AsyncClient, test_user):
    """Tasks with unknown status bucket into 'todo'."""
    headers = auth_headers(test_user)
    project = await _create_project(client, headers)
    await _create_task(client, headers, project["id"], "Odd Status Task", "backlog", 0)

    resp = await client.get(
        f"/api/v1/projects/{project['id']}/board",
        headers=headers,
    )
    assert resp.status_code == 200
    board = resp.json()
    # 'backlog' is not a standard board column, so it goes to 'todo'
    assert any(t["title"] == "Odd Status Task" for t in board["todo"])


# ── Kanban reorder ───────────────────────────────────────────────────────────


async def test_batch_reorder_tasks(client: AsyncClient, test_user):
    """PUT .../board/reorder updates task statuses and orders."""
    headers = auth_headers(test_user)
    project = await _create_project(client, headers)
    task_a = await _create_task(client, headers, project["id"], "Reorder A", "todo", 0)
    task_b = await _create_task(client, headers, project["id"], "Reorder B", "todo", 1)

    resp = await client.put(
        f"/api/v1/projects/{project['id']}/board/reorder",
        json={
            "tasks": [
                {"task_id": task_a["id"], "status": "in_progress", "order": 0},
                {"task_id": task_b["id"], "status": "todo", "order": 0},
            ]
        },
        headers=headers,
    )
    assert resp.status_code == 200

    # Verify the board reflects the changes
    board_resp = await client.get(
        f"/api/v1/projects/{project['id']}/board",
        headers=headers,
    )
    board = board_resp.json()
    in_progress_ids = [t["id"] for t in board["in_progress"]]
    assert task_a["id"] in in_progress_ids


async def test_batch_reorder_skips_invalid_tasks(client: AsyncClient, test_user):
    """PUT .../board/reorder silently skips tasks not in the project."""
    headers = auth_headers(test_user)
    project = await _create_project(client, headers)
    resp = await client.put(
        f"/api/v1/projects/{project['id']}/board/reorder",
        json={
            "tasks": [
                {"task_id": str(uuid.uuid4()), "status": "done", "order": 0},
            ]
        },
        headers=headers,
    )
    assert resp.status_code == 200


async def test_batch_reorder_requires_project_access(client: AsyncClient, test_user, superadmin_user):
    """PUT .../board/reorder on unknown project → 404."""
    resp = await client.put(
        f"/api/v1/projects/{uuid.uuid4()}/board/reorder",
        json={"tasks": []},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


# ── Task CRUD ────────────────────────────────────────────────────────────────


async def test_create_task(client: AsyncClient, test_user):
    """POST .../tasks creates a task."""
    headers = auth_headers(test_user)
    project = await _create_project(client, headers)
    task = await _create_task(client, headers, project["id"], "New Task")
    assert task["title"] == "New Task"
    assert task["project_id"] == project["id"]


async def test_list_tasks(client: AsyncClient, test_user):
    """GET .../tasks lists tasks for a project."""
    headers = auth_headers(test_user)
    project = await _create_project(client, headers)
    await _create_task(client, headers, project["id"], "List Task")
    resp = await client.get(
        f"/api/v1/projects/{project['id']}/tasks",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


async def test_list_tasks_filter_by_status(client: AsyncClient, test_user):
    """GET .../tasks?status=done filters correctly."""
    headers = auth_headers(test_user)
    project = await _create_project(client, headers)
    await _create_task(client, headers, project["id"], "Done Task", "done")
    await _create_task(client, headers, project["id"], "Todo Task", "todo")
    resp = await client.get(
        f"/api/v1/projects/{project['id']}/tasks?status=done",
        headers=headers,
    )
    assert resp.status_code == 200
    for t in resp.json()["tasks"]:
        assert t["status"] == "done"


async def test_update_task(client: AsyncClient, test_user):
    """PUT .../tasks/{id} updates task fields."""
    headers = auth_headers(test_user)
    project = await _create_project(client, headers)
    task = await _create_task(client, headers, project["id"], "Before")
    resp = await client.put(
        f"/api/v1/projects/{project['id']}/tasks/{task['id']}",
        json={"title": "After", "priority": "high"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "After"
    assert resp.json()["priority"] == "high"


async def test_delete_task(client: AsyncClient, test_user):
    """DELETE .../tasks/{id} removes a task."""
    headers = auth_headers(test_user)
    project = await _create_project(client, headers)
    task = await _create_task(client, headers, project["id"], "Deletable")
    resp = await client.delete(
        f"/api/v1/projects/{project['id']}/tasks/{task['id']}",
        headers=headers,
    )
    assert resp.status_code == 204


async def test_task_not_found(client: AsyncClient, test_user):
    """PUT on nonexistent task → 404."""
    headers = auth_headers(test_user)
    project = await _create_project(client, headers)
    resp = await client.put(
        f"/api/v1/projects/{project['id']}/tasks/{uuid.uuid4()}",
        json={"title": "Should Fail"},
        headers=headers,
    )
    assert resp.status_code == 404


# ── Time logging ─────────────────────────────────────────────────────────────


async def test_log_time(client: AsyncClient, test_user):
    """POST .../time-logs creates a time log entry."""
    headers = auth_headers(test_user)
    project = await _create_project(client, headers)
    task = await _create_task(client, headers, project["id"], "Time Task")
    resp = await client.post(
        f"/api/v1/projects/{project['id']}/tasks/{task['id']}/time-logs",
        json={"hours": 2.5, "description": "Implementation work"},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["hours"] == 2.5


async def test_list_time_logs(client: AsyncClient, test_user):
    """GET .../time-logs returns logs with totals."""
    headers = auth_headers(test_user)
    project = await _create_project(client, headers)
    task = await _create_task(client, headers, project["id"], "Log Task")
    await client.post(
        f"/api/v1/projects/{project['id']}/tasks/{task['id']}/time-logs",
        json={"hours": 1.0, "description": "Session 1"},
        headers=headers,
    )
    await client.post(
        f"/api/v1/projects/{project['id']}/tasks/{task['id']}/time-logs",
        json={"hours": 2.0, "description": "Session 2"},
        headers=headers,
    )
    resp = await client.get(
        f"/api/v1/projects/{project['id']}/tasks/{task['id']}/time-logs",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert data["total_hours"] == 3.0


async def test_time_log_for_nonexistent_task_fails(client: AsyncClient, test_user):
    """POST time-log on nonexistent task → 404."""
    headers = auth_headers(test_user)
    project = await _create_project(client, headers)
    resp = await client.post(
        f"/api/v1/projects/{project['id']}/tasks/{uuid.uuid4()}/time-logs",
        json={"hours": 1.0},
        headers=headers,
    )
    assert resp.status_code == 404


async def test_project_time_report(client: AsyncClient, test_user):
    """GET .../time-report returns aggregated time data."""
    headers = auth_headers(test_user)
    project = await _create_project(client, headers)
    task = await _create_task(client, headers, project["id"], "Report Task")
    await client.post(
        f"/api/v1/projects/{project['id']}/tasks/{task['id']}/time-logs",
        json={"hours": 4.0},
        headers=headers,
    )
    resp = await client.get(
        f"/api/v1/projects/{project['id']}/time-report",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["grand_total_hours"] >= 4.0
    assert len(data["by_task"]) >= 1


# ── Milestones ───────────────────────────────────────────────────────────────


async def test_create_milestone(client: AsyncClient, test_user):
    """POST .../milestones creates a milestone."""
    headers = auth_headers(test_user)
    project = await _create_project(client, headers)
    resp = await client.post(
        f"/api/v1/projects/{project['id']}/milestones",
        json={"title": "Phase 1 Complete", "due_date": "2026-06-01T00:00:00"},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["title"] == "Phase 1 Complete"
    assert resp.json()["is_completed"] is False


async def test_list_milestones(client: AsyncClient, test_user):
    """GET .../milestones lists project milestones."""
    headers = auth_headers(test_user)
    project = await _create_project(client, headers)
    await client.post(
        f"/api/v1/projects/{project['id']}/milestones",
        json={"title": "M1"},
        headers=headers,
    )
    await client.post(
        f"/api/v1/projects/{project['id']}/milestones",
        json={"title": "M2"},
        headers=headers,
    )
    resp = await client.get(
        f"/api/v1/projects/{project['id']}/milestones",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] >= 2


async def test_create_milestone_nonexistent_project_fails(client: AsyncClient, test_user):
    """POST milestone for nonexistent project → 404."""
    resp = await client.post(
        f"/api/v1/projects/{uuid.uuid4()}/milestones",
        json={"title": "Orphan Milestone"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


# ── Project CRUD extended ────────────────────────────────────────────────────


async def test_get_project_detail_includes_counts(client: AsyncClient, test_user):
    """GET .../projects/{id} includes task_count and milestone_count."""
    headers = auth_headers(test_user)
    project = await _create_project(client, headers)
    await _create_task(client, headers, project["id"], "Count Task")
    await client.post(
        f"/api/v1/projects/{project['id']}/milestones",
        json={"title": "Count Milestone"},
        headers=headers,
    )
    resp = await client.get(
        f"/api/v1/projects/{project['id']}",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["task_count"] >= 1
    assert resp.json()["milestone_count"] >= 1


async def test_update_project(client: AsyncClient, test_user):
    """PUT .../projects/{id} updates project fields."""
    headers = auth_headers(test_user)
    project = await _create_project(client, headers)
    resp = await client.put(
        f"/api/v1/projects/{project['id']}",
        json={"name": "Renamed Project", "status": "completed"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed Project"


async def test_delete_project(client: AsyncClient, test_user):
    """DELETE .../projects/{id} removes the project."""
    headers = auth_headers(test_user)
    project = await _create_project(client, headers)
    resp = await client.delete(
        f"/api/v1/projects/{project['id']}",
        headers=headers,
    )
    assert resp.status_code == 204


async def test_project_access_control(client: AsyncClient, test_user, superadmin_user):
    """Only owner can update/delete a project."""
    # Create as test_user
    headers = auth_headers(test_user)
    project = await _create_project(client, headers)

    # superadmin_user tries to update — should fail (not owner)
    resp = await client.put(
        f"/api/v1/projects/{project['id']}",
        json={"name": "Hacked"},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 404


# ── Auth Required ────────────────────────────────────────────────────────────


async def test_projects_requires_auth(client: AsyncClient):
    """Project endpoints require authentication."""
    resp = await client.get("/api/v1/projects")
    assert resp.status_code in (401, 403)
