"""Integration tests for the Analytics API (base + ext)."""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


# ── Basic analytics stats ────────────────────────────────────────────────────


async def test_revenue_stats(client: AsyncClient, test_user):
    """GET /api/v1/analytics/stats/revenue returns revenue data."""
    resp = await client.get(
        "/api/v1/analytics/stats/revenue",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["service_available"] is True
    assert "data" in data


async def test_revenue_stats_custom_months(client: AsyncClient, test_user):
    """GET /api/v1/analytics/stats/revenue?months=6 uses custom range."""
    resp = await client.get(
        "/api/v1/analytics/stats/revenue?months=6",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


async def test_user_growth_stats(client: AsyncClient, test_user):
    """GET /api/v1/analytics/stats/users returns user growth data."""
    resp = await client.get(
        "/api/v1/analytics/stats/users",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert resp.json()["service_available"] is True


async def test_module_usage_stats(client: AsyncClient, test_user):
    """GET /api/v1/analytics/stats/modules returns per-module counts."""
    resp = await client.get(
        "/api/v1/analytics/stats/modules",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert "modules" in resp.json()


async def test_expense_stats(client: AsyncClient, test_user):
    """GET /api/v1/analytics/stats/expenses returns expense breakdown."""
    resp = await client.get(
        "/api/v1/analytics/stats/expenses",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert resp.json()["service_available"] is True


async def test_top_products_stats(client: AsyncClient, test_user):
    """GET /api/v1/analytics/stats/top-products returns top products."""
    resp = await client.get(
        "/api/v1/analytics/stats/top-products",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


async def test_support_metrics(client: AsyncClient, test_user):
    """GET /api/v1/analytics/stats/support-metrics returns ticket metrics."""
    resp = await client.get(
        "/api/v1/analytics/stats/support-metrics",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


# ── Query execution (read-only enforcement) ──────────────────────────────────


async def test_execute_select_query(client: AsyncClient, test_user):
    """POST /api/v1/analytics/query executes a valid SELECT."""
    resp = await client.post(
        "/api/v1/analytics/query",
        json={"sql": "SELECT 1 AS val", "limit": 10},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["row_count"] == 1
    assert data["columns"] == ["val"]
    assert data["rows"][0]["val"] == 1


async def test_execute_query_rejects_insert(client: AsyncClient, test_user):
    """POST /api/v1/analytics/query rejects INSERT statement."""
    resp = await client.post(
        "/api/v1/analytics/query",
        json={"sql": "INSERT INTO users (id) VALUES ('x')"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 400
    assert "forbidden" in resp.json()["detail"].lower() or "SELECT" in resp.json()["detail"]


async def test_execute_query_rejects_delete(client: AsyncClient, test_user):
    """POST /api/v1/analytics/query rejects DELETE statement."""
    resp = await client.post(
        "/api/v1/analytics/query",
        json={"sql": "DELETE FROM users"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 400


async def test_execute_query_rejects_update(client: AsyncClient, test_user):
    """POST /api/v1/analytics/query rejects UPDATE statement."""
    resp = await client.post(
        "/api/v1/analytics/query",
        json={"sql": "UPDATE users SET email='hack'"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 400


async def test_execute_query_rejects_drop(client: AsyncClient, test_user):
    """POST /api/v1/analytics/query rejects DROP TABLE."""
    resp = await client.post(
        "/api/v1/analytics/query",
        json={"sql": "DROP TABLE users"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 400


async def test_execute_query_rejects_truncate(client: AsyncClient, test_user):
    """POST /api/v1/analytics/query rejects TRUNCATE."""
    resp = await client.post(
        "/api/v1/analytics/query",
        json={"sql": "TRUNCATE users"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 400


async def test_execute_query_with_params(client: AsyncClient, test_user):
    """POST /api/v1/analytics/query supports parameterized queries."""
    resp = await client.post(
        "/api/v1/analytics/query",
        json={"sql": "SELECT :val AS result", "params": {"val": 42}, "limit": 5},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert resp.json()["rows"][0]["result"] == 42


async def test_execute_query_with_subquery(client: AsyncClient, test_user):
    """CTE (WITH) queries are allowed as they start with WITH."""
    resp = await client.post(
        "/api/v1/analytics/query",
        json={"sql": "WITH cte AS (SELECT 1 AS n) SELECT * FROM cte"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert resp.json()["row_count"] == 1


# ── Dashboards ───────────────────────────────────────────────────────────────


async def _create_dashboard(client: AsyncClient, headers: dict, name: str = "Test Dashboard") -> dict:
    resp = await client.post(
        "/api/v1/analytics/dashboards",
        json={"name": name, "description": "A test dashboard", "is_shared": False},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


async def test_create_dashboard(client: AsyncClient, test_user):
    """POST /api/v1/analytics/dashboards creates a dashboard."""
    headers = auth_headers(test_user)
    data = await _create_dashboard(client, headers)
    assert data["name"] == "Test Dashboard"
    assert data["owner_id"] == str(test_user.id)


async def test_list_dashboards(client: AsyncClient, test_user):
    """GET /api/v1/analytics/dashboards returns user dashboards."""
    headers = auth_headers(test_user)
    await _create_dashboard(client, headers)
    resp = await client.get("/api/v1/analytics/dashboards", headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_get_dashboard(client: AsyncClient, test_user):
    """GET /api/v1/analytics/dashboards/{id} returns detail."""
    headers = auth_headers(test_user)
    dash = await _create_dashboard(client, headers)
    resp = await client.get(f"/api/v1/analytics/dashboards/{dash['id']}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == dash["id"]


async def test_get_dashboard_not_found(client: AsyncClient, test_user):
    """GET /api/v1/analytics/dashboards/{bad_id} → 404."""
    resp = await client.get(
        f"/api/v1/analytics/dashboards/{uuid.uuid4()}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


async def test_update_dashboard(client: AsyncClient, test_user):
    """PUT /api/v1/analytics/dashboards/{id} updates dashboard fields."""
    headers = auth_headers(test_user)
    dash = await _create_dashboard(client, headers)
    resp = await client.put(
        f"/api/v1/analytics/dashboards/{dash['id']}",
        json={"name": "Renamed Dashboard"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed Dashboard"


async def test_update_dashboard_other_user_denied(client: AsyncClient, test_user, superadmin_user):
    """PUT by non-owner returns 403."""
    headers = auth_headers(test_user)
    dash = await _create_dashboard(client, headers)
    resp = await client.put(
        f"/api/v1/analytics/dashboards/{dash['id']}",
        json={"name": "Hacked"},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 403


async def test_delete_dashboard(client: AsyncClient, test_user):
    """DELETE /api/v1/analytics/dashboards/{id} removes dashboard."""
    headers = auth_headers(test_user)
    dash = await _create_dashboard(client, headers)
    resp = await client.delete(
        f"/api/v1/analytics/dashboards/{dash['id']}",
        headers=headers,
    )
    assert resp.status_code == 204


# ── Widgets ──────────────────────────────────────────────────────────────────


async def test_create_widget(client: AsyncClient, test_user):
    """POST /api/v1/analytics/dashboards/{id}/widgets adds a widget."""
    headers = auth_headers(test_user)
    dash = await _create_dashboard(client, headers)
    resp = await client.post(
        f"/api/v1/analytics/dashboards/{dash['id']}/widgets",
        json={
            "widget_type": "bar",
            "title": "Revenue by Month",
            "query_config": {"sql": "SELECT 1"},
        },
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["widget_type"] == "bar"


async def test_list_widgets(client: AsyncClient, test_user):
    """GET /api/v1/analytics/dashboards/{id}/widgets returns widgets."""
    headers = auth_headers(test_user)
    dash = await _create_dashboard(client, headers)
    await client.post(
        f"/api/v1/analytics/dashboards/{dash['id']}/widgets",
        json={
            "widget_type": "kpi",
            "title": "Total Users",
            "query_config": {"sql": "SELECT COUNT(*) FROM users"},
        },
        headers=headers,
    )
    resp = await client.get(
        f"/api/v1/analytics/dashboards/{dash['id']}/widgets",
        headers=headers,
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1


async def test_update_widget(client: AsyncClient, test_user):
    """PUT /api/v1/analytics/widgets/{id} updates widget fields."""
    headers = auth_headers(test_user)
    dash = await _create_dashboard(client, headers)
    create = await client.post(
        f"/api/v1/analytics/dashboards/{dash['id']}/widgets",
        json={
            "widget_type": "pie",
            "title": "Old Title",
            "query_config": {"sql": "SELECT 1"},
        },
        headers=headers,
    )
    widget_id = create.json()["id"]
    resp = await client.put(
        f"/api/v1/analytics/widgets/{widget_id}",
        json={"title": "New Title"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "New Title"


async def test_delete_widget(client: AsyncClient, test_user):
    """DELETE /api/v1/analytics/widgets/{id} removes a widget."""
    headers = auth_headers(test_user)
    dash = await _create_dashboard(client, headers)
    create = await client.post(
        f"/api/v1/analytics/dashboards/{dash['id']}/widgets",
        json={
            "widget_type": "line",
            "title": "To Delete",
            "query_config": {"sql": "SELECT 1"},
        },
        headers=headers,
    )
    widget_id = create.json()["id"]
    resp = await client.delete(
        f"/api/v1/analytics/widgets/{widget_id}",
        headers=headers,
    )
    assert resp.status_code == 204


# ── Saved Queries ────────────────────────────────────────────────────────────


async def _create_saved_query(client: AsyncClient, headers: dict, name: str = "My Query") -> dict:
    resp = await client.post(
        "/api/v1/analytics/saved-queries",
        json={
            "name": name,
            "sql_text": "SELECT COUNT(*) AS total FROM users",
            "description": "User count query",
            "module": "users",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


async def test_create_saved_query(client: AsyncClient, test_user):
    """POST /api/v1/analytics/saved-queries creates a saved query."""
    data = await _create_saved_query(client, auth_headers(test_user))
    assert data["name"] == "My Query"


async def test_create_saved_query_rejects_mutation(client: AsyncClient, test_user):
    """POST saved query with DDL SQL is rejected."""
    resp = await client.post(
        "/api/v1/analytics/saved-queries",
        json={"name": "Bad", "sql_text": "DROP TABLE users"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 400


async def test_list_saved_queries(client: AsyncClient, test_user):
    """GET /api/v1/analytics/saved-queries returns list."""
    headers = auth_headers(test_user)
    await _create_saved_query(client, headers)
    resp = await client.get("/api/v1/analytics/saved-queries", headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_get_saved_query(client: AsyncClient, test_user):
    """GET /api/v1/analytics/saved-queries/{id} returns detail."""
    headers = auth_headers(test_user)
    sq = await _create_saved_query(client, headers)
    resp = await client.get(f"/api/v1/analytics/saved-queries/{sq['id']}", headers=headers)
    assert resp.status_code == 200


async def test_delete_saved_query(client: AsyncClient, test_user):
    """DELETE /api/v1/analytics/saved-queries/{id} removes it."""
    headers = auth_headers(test_user)
    sq = await _create_saved_query(client, headers)
    resp = await client.delete(f"/api/v1/analytics/saved-queries/{sq['id']}", headers=headers)
    assert resp.status_code == 204


# ── Reports ──────────────────────────────────────────────────────────────────


async def test_create_report(client: AsyncClient, test_user):
    """POST /api/v1/analytics/reports creates a report."""
    headers = auth_headers(test_user)
    resp = await client.post(
        "/api/v1/analytics/reports",
        json={
            "name": "Monthly Revenue Report",
            "report_type": "one_time",
            "format": "csv",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "Monthly Revenue Report"


async def test_list_reports(client: AsyncClient, test_user):
    """GET /api/v1/analytics/reports returns user reports."""
    headers = auth_headers(test_user)
    await client.post(
        "/api/v1/analytics/reports",
        json={"name": "List Test Report", "report_type": "one_time", "format": "pdf"},
        headers=headers,
    )
    resp = await client.get("/api/v1/analytics/reports", headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_run_report(client: AsyncClient, test_user):
    """POST /api/v1/analytics/reports/{id}/run executes a report."""
    headers = auth_headers(test_user)
    sq = await _create_saved_query(client, headers, "Report Query")
    create = await client.post(
        "/api/v1/analytics/reports",
        json={
            "name": "Runnable Report",
            "report_type": "one_time",
            "format": "csv",
            "query_id": sq["id"],
        },
        headers=headers,
    )
    report_id = create.json()["id"]
    resp = await client.post(
        f"/api/v1/analytics/reports/{report_id}/run",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["row_count"] >= 0
    assert resp.json()["run_at"] is not None


# ── Alerts ───────────────────────────────────────────────────────────────────


async def test_create_alert(client: AsyncClient, test_user):
    """POST /api/v1/analytics/alerts creates a data alert."""
    headers = auth_headers(test_user)
    sq = await _create_saved_query(client, headers, "Alert Query")
    resp = await client.post(
        "/api/v1/analytics/alerts",
        json={
            "name": "High User Alert",
            "condition": "gt",
            "threshold": "100",
            "query_id": sq["id"],
        },
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["condition"] == "gt"


async def test_list_alerts(client: AsyncClient, test_user):
    """GET /api/v1/analytics/alerts returns alerts."""
    headers = auth_headers(test_user)
    sq = await _create_saved_query(client, headers, "Alert List Query")
    await client.post(
        "/api/v1/analytics/alerts",
        json={
            "name": "Test Alert",
            "condition": "lt",
            "threshold": "10",
            "query_id": sq["id"],
        },
        headers=headers,
    )
    resp = await client.get("/api/v1/analytics/alerts", headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_delete_alert(client: AsyncClient, test_user):
    """DELETE /api/v1/analytics/alerts/{id} removes an alert."""
    headers = auth_headers(test_user)
    sq = await _create_saved_query(client, headers, "Del Alert Query")
    create = await client.post(
        "/api/v1/analytics/alerts",
        json={
            "name": "Delete Me",
            "condition": "eq",
            "threshold": "0",
            "query_id": sq["id"],
        },
        headers=headers,
    )
    alert_id = create.json()["id"]
    resp = await client.delete(f"/api/v1/analytics/alerts/{alert_id}", headers=headers)
    assert resp.status_code == 204


async def test_create_alert_invalid_query_returns_404(client: AsyncClient, test_user):
    """POST alert with nonexistent query_id → 404."""
    resp = await client.post(
        "/api/v1/analytics/alerts",
        json={
            "name": "Bad Alert",
            "condition": "gt",
            "threshold": "1",
            "query_id": str(uuid.uuid4()),
        },
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


# ── Module KPIs ──────────────────────────────────────────────────────────────


async def test_module_kpis_finance(client: AsyncClient, test_user):
    """GET /api/v1/analytics/modules/finance/kpis returns KPIs."""
    resp = await client.get(
        "/api/v1/analytics/modules/finance/kpis",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["module"] == "finance"
    assert len(data["kpis"]) > 0


async def test_module_kpis_unknown_module(client: AsyncClient, test_user):
    """GET /api/v1/analytics/modules/nonexistent/kpis → 404."""
    resp = await client.get(
        "/api/v1/analytics/modules/nonexistent/kpis",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


# ── Module Trends ────────────────────────────────────────────────────────────


async def test_module_trends(client: AsyncClient, test_user):
    """GET /api/v1/analytics/modules/support/trends returns trend data."""
    resp = await client.get(
        "/api/v1/analytics/modules/support/trends",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert resp.json()["module"] == "support"


# ── Cross-module summary ─────────────────────────────────────────────────────


async def test_cross_module_summary(client: AsyncClient, test_user):
    """GET /api/v1/analytics/cross-module/summary returns exec summary."""
    resp = await client.get(
        "/api/v1/analytics/cross-module/summary",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert "kpis" in resp.json()


# ── Auth Required ────────────────────────────────────────────────────────────


async def test_analytics_requires_auth(client: AsyncClient):
    """Analytics endpoints require authentication."""
    resp = await client.get("/api/v1/analytics/stats/revenue")
    assert resp.status_code in (401, 403)
