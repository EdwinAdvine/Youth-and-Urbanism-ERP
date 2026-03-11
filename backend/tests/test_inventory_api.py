"""Integration tests for the Inventory API."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


# ── Items ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_item(client: AsyncClient, superadmin_user):
    """POST /api/v1/inventory/items creates an inventory item."""
    resp = await client.post(
        "/api/v1/inventory/items",
        json={"name": "Widget A", "sku": "WGT-001", "cost_price": 10.00, "selling_price": 25.00},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Widget A"


@pytest.mark.asyncio
async def test_list_items(client: AsyncClient, test_user):
    """GET /api/v1/inventory/items returns items."""
    resp = await client.get(
        "/api/v1/inventory/items",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_item_detail(client: AsyncClient, superadmin_user):
    """GET /api/v1/inventory/items/{id} returns item detail."""
    create_resp = await client.post(
        "/api/v1/inventory/items",
        json={"name": "Widget B"},
        headers=auth_headers(superadmin_user),
    )
    item_id = create_resp.json()["id"]
    resp = await client.get(
        f"/api/v1/inventory/items/{item_id}",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_update_item(client: AsyncClient, superadmin_user):
    """PUT /api/v1/inventory/items/{id} updates an item."""
    create_resp = await client.post(
        "/api/v1/inventory/items",
        json={"name": "Widget C"},
        headers=auth_headers(superadmin_user),
    )
    item_id = create_resp.json()["id"]
    resp = await client.put(
        f"/api/v1/inventory/items/{item_id}",
        json={"name": "Widget C Updated"},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_delete_item(client: AsyncClient, superadmin_user):
    """DELETE /api/v1/inventory/items/{id} deletes an item."""
    create_resp = await client.post(
        "/api/v1/inventory/items",
        json={"name": "Widget Delete"},
        headers=auth_headers(superadmin_user),
    )
    item_id = create_resp.json()["id"]
    resp = await client.delete(
        f"/api/v1/inventory/items/{item_id}",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 204


# ── Warehouses ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_warehouse(client: AsyncClient, superadmin_user):
    """POST /api/v1/inventory/warehouses creates a warehouse."""
    resp = await client.post(
        "/api/v1/inventory/warehouses",
        json={"name": "Main Warehouse", "location": "Nairobi"},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_list_warehouses(client: AsyncClient, test_user):
    """GET /api/v1/inventory/warehouses returns warehouses."""
    resp = await client.get(
        "/api/v1/inventory/warehouses",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


# ── Stock Levels ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_stock_levels(client: AsyncClient, test_user):
    """GET /api/v1/inventory/stock-levels returns stock levels."""
    resp = await client.get(
        "/api/v1/inventory/stock-levels",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


# ── Stock Movements ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_stock_movements(client: AsyncClient, test_user):
    """GET /api/v1/inventory/stock-movements returns movements."""
    resp = await client.get(
        "/api/v1/inventory/stock-movements",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


# ── Purchase Orders ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_purchase_orders(client: AsyncClient, test_user):
    """GET /api/v1/inventory/purchase-orders returns POs."""
    resp = await client.get(
        "/api/v1/inventory/purchase-orders",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


# ── Dashboard & Alerts ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_inventory_dashboard_stats(client: AsyncClient, test_user):
    """GET /api/v1/inventory/dashboard/stats returns stats."""
    resp = await client.get(
        "/api/v1/inventory/dashboard/stats",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_reorder_alerts(client: AsyncClient, test_user):
    """GET /api/v1/inventory/reorder-alerts returns alerts."""
    resp = await client.get(
        "/api/v1/inventory/reorder-alerts",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


# ── Auth Required ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_inventory_requires_auth(client: AsyncClient):
    """Inventory endpoints require authentication."""
    resp = await client.get("/api/v1/inventory/items")
    assert resp.status_code in (401, 403)
