"""Integration tests for the Manufacturing API."""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import auth_headers


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _create_inventory_item(
    client: AsyncClient, headers: dict, name: str = "Raw Material A", cost: float = 10.0
) -> dict:
    """Create an inventory item for BOM / work-order tests."""
    resp = await client.post(
        "/api/v1/inventory/items",
        json={
            "name": name,
            "sku": f"SKU-{uuid.uuid4().hex[:8]}",
            "category": "raw_material",
            "cost_price": cost,
            "selling_price": cost * 2,
            "reorder_level": 5,
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_warehouse(client: AsyncClient, headers: dict, name: str = "Main WH") -> dict:
    """Create a warehouse."""
    resp = await client.post(
        "/api/v1/inventory/warehouses",
        json={"name": name, "code": f"WH-{uuid.uuid4().hex[:6]}"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_bom(
    client: AsyncClient,
    headers: dict,
    finished_item_id: str,
    raw_item_id: str,
    qty_required: str = "2",
) -> dict:
    """Create a Bill of Materials."""
    resp = await client.post(
        "/api/v1/manufacturing/bom",
        json={
            "name": "Test BOM",
            "finished_item_id": finished_item_id,
            "quantity_produced": 1,
            "items": [
                {
                    "item_id": raw_item_id,
                    "quantity_required": qty_required,
                    "unit_of_measure": "unit",
                    "scrap_percentage": "5",
                }
            ],
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── BOM CRUD ─────────────────────────────────────────────────────────────────


async def test_list_boms(client: AsyncClient, test_user):
    """GET /api/v1/manufacturing/bom returns BOM list."""
    resp = await client.get(
        "/api/v1/manufacturing/bom",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert "boms" in resp.json()


async def test_create_bom(client: AsyncClient, superadmin_user):
    """POST /api/v1/manufacturing/bom creates a BOM with items."""
    headers = auth_headers(superadmin_user)
    finished = await _create_inventory_item(client, headers, "Finished Widget", 50.0)
    raw = await _create_inventory_item(client, headers, "Raw Steel", 10.0)

    bom = await _create_bom(client, headers, finished["id"], raw["id"])
    assert bom["bom_number"].startswith("BOM-")
    assert bom["name"] == "Test BOM"
    assert len(bom["items"]) == 1
    assert bom["finished_item_name"] == "Finished Widget"


async def test_create_bom_empty_items_rejected(client: AsyncClient, superadmin_user):
    """POST /api/v1/manufacturing/bom with no items → 422."""
    headers = auth_headers(superadmin_user)
    finished = await _create_inventory_item(client, headers, "Empty BOM Widget")
    resp = await client.post(
        "/api/v1/manufacturing/bom",
        json={
            "name": "Empty BOM",
            "finished_item_id": finished["id"],
            "items": [],
        },
        headers=headers,
    )
    assert resp.status_code == 422


async def test_create_bom_invalid_finished_item(client: AsyncClient, superadmin_user):
    """POST /api/v1/manufacturing/bom with nonexistent finished item → 404."""
    resp = await client.post(
        "/api/v1/manufacturing/bom",
        json={
            "name": "Bad BOM",
            "finished_item_id": str(uuid.uuid4()),
            "items": [
                {"item_id": str(uuid.uuid4()), "quantity_required": "1"},
            ],
        },
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 404


async def test_get_bom_detail(client: AsyncClient, superadmin_user):
    """GET /api/v1/manufacturing/bom/{id} returns BOM with items."""
    headers = auth_headers(superadmin_user)
    finished = await _create_inventory_item(client, headers, "BOM Detail Widget")
    raw = await _create_inventory_item(client, headers, "BOM Detail Raw")
    bom = await _create_bom(client, headers, finished["id"], raw["id"])

    resp = await client.get(
        f"/api/v1/manufacturing/bom/{bom['id']}",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == bom["id"]
    assert len(resp.json()["items"]) == 1


async def test_get_bom_not_found(client: AsyncClient, test_user):
    """GET /api/v1/manufacturing/bom/{bad_id} → 404."""
    resp = await client.get(
        f"/api/v1/manufacturing/bom/{uuid.uuid4()}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


async def test_update_bom(client: AsyncClient, superadmin_user):
    """PUT /api/v1/manufacturing/bom/{id} updates BOM fields."""
    headers = auth_headers(superadmin_user)
    finished = await _create_inventory_item(client, headers, "Update BOM Widget")
    raw = await _create_inventory_item(client, headers, "Update BOM Raw")
    bom = await _create_bom(client, headers, finished["id"], raw["id"])

    resp = await client.put(
        f"/api/v1/manufacturing/bom/{bom['id']}",
        json={"name": "Updated BOM Name"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated BOM Name"


async def test_delete_bom_soft(client: AsyncClient, superadmin_user):
    """DELETE /api/v1/manufacturing/bom/{id} soft-deletes."""
    headers = auth_headers(superadmin_user)
    finished = await _create_inventory_item(client, headers, "Delete BOM Widget")
    raw = await _create_inventory_item(client, headers, "Delete BOM Raw")
    bom = await _create_bom(client, headers, finished["id"], raw["id"])

    resp = await client.delete(
        f"/api/v1/manufacturing/bom/{bom['id']}",
        headers=headers,
    )
    assert resp.status_code == 204


# ── BOM cost calculation ─────────────────────────────────────────────────────


async def test_bom_cost_calculation(client: AsyncClient, superadmin_user):
    """GET /api/v1/manufacturing/bom/{id}/cost calculates material cost."""
    headers = auth_headers(superadmin_user)
    finished = await _create_inventory_item(client, headers, "Cost Widget", 100.0)
    raw = await _create_inventory_item(client, headers, "Cost Raw Material", 20.0)

    bom = await _create_bom(client, headers, finished["id"], raw["id"], qty_required="3")

    resp = await client.get(
        f"/api/v1/manufacturing/bom/{bom['id']}/cost",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "unit_cost" in data
    assert float(data["unit_cost"]) > 0


# ── Workstations ─────────────────────────────────────────────────────────────


async def test_list_workstations(client: AsyncClient, test_user):
    """GET /api/v1/manufacturing/workstations returns list."""
    resp = await client.get(
        "/api/v1/manufacturing/workstations",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


async def test_create_workstation(client: AsyncClient, superadmin_user):
    """POST /api/v1/manufacturing/workstations creates a workstation."""
    resp = await client.post(
        "/api/v1/manufacturing/workstations",
        json={
            "name": "Assembly Line 1",
            "code": f"WS-{uuid.uuid4().hex[:6]}",
            "hourly_rate": "50.00",
        },
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "Assembly Line 1"


async def test_get_workstation_detail(client: AsyncClient, superadmin_user):
    """GET /api/v1/manufacturing/workstations/{id} returns detail."""
    headers = auth_headers(superadmin_user)
    create = await client.post(
        "/api/v1/manufacturing/workstations",
        json={"name": "WS Detail", "code": f"WSD-{uuid.uuid4().hex[:4]}"},
        headers=headers,
    )
    ws_id = create.json()["id"]
    resp = await client.get(
        f"/api/v1/manufacturing/workstations/{ws_id}",
        headers=headers,
    )
    assert resp.status_code == 200


# ── Work Orders ──────────────────────────────────────────────────────────────


async def _create_work_order(client: AsyncClient, headers: dict) -> dict:
    """Create a complete work order with BOM, warehouses, etc."""
    finished = await _create_inventory_item(client, headers, f"WO Finished {uuid.uuid4().hex[:4]}")
    raw = await _create_inventory_item(client, headers, f"WO Raw {uuid.uuid4().hex[:4]}", 15.0)
    bom = await _create_bom(client, headers, finished["id"], raw["id"])
    source_wh = await _create_warehouse(client, headers, f"Src WH {uuid.uuid4().hex[:4]}")
    target_wh = await _create_warehouse(client, headers, f"Tgt WH {uuid.uuid4().hex[:4]}")

    resp = await client.post(
        "/api/v1/manufacturing/work-orders",
        json={
            "bom_id": bom["id"],
            "planned_quantity": 10,
            "priority": "high",
            "target_warehouse_id": target_wh["id"],
            "source_warehouse_id": source_wh["id"],
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_create_work_order(client: AsyncClient, superadmin_user):
    """POST /api/v1/manufacturing/work-orders creates a work order."""
    headers = auth_headers(superadmin_user)
    wo = await _create_work_order(client, headers)
    assert wo["wo_number"].startswith("WO-")
    assert wo["status"] == "draft"
    assert wo["planned_quantity"] == 10


async def test_list_work_orders(client: AsyncClient, test_user):
    """GET /api/v1/manufacturing/work-orders returns list."""
    resp = await client.get(
        "/api/v1/manufacturing/work-orders",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert "work_orders" in resp.json()


async def test_get_work_order_detail(client: AsyncClient, superadmin_user):
    """GET /api/v1/manufacturing/work-orders/{id} returns detail."""
    headers = auth_headers(superadmin_user)
    wo = await _create_work_order(client, headers)
    resp = await client.get(
        f"/api/v1/manufacturing/work-orders/{wo['id']}",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == wo["id"]


async def test_get_work_order_not_found(client: AsyncClient, test_user):
    """GET /api/v1/manufacturing/work-orders/{bad_id} → 404."""
    resp = await client.get(
        f"/api/v1/manufacturing/work-orders/{uuid.uuid4()}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


async def test_update_draft_work_order(client: AsyncClient, superadmin_user):
    """PUT on a draft work order updates fields."""
    headers = auth_headers(superadmin_user)
    wo = await _create_work_order(client, headers)
    resp = await client.put(
        f"/api/v1/manufacturing/work-orders/{wo['id']}",
        json={"priority": "low", "planned_quantity": 20},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["priority"] == "low"
    assert resp.json()["planned_quantity"] == 20


async def test_cancel_work_order(client: AsyncClient, superadmin_user):
    """POST .../cancel transitions draft → cancelled."""
    headers = auth_headers(superadmin_user)
    wo = await _create_work_order(client, headers)
    resp = await client.post(
        f"/api/v1/manufacturing/work-orders/{wo['id']}/cancel",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


async def test_cancel_completed_work_order_fails(client: AsyncClient, superadmin_user):
    """Cancelling a cancelled work order fails with 409."""
    headers = auth_headers(superadmin_user)
    wo = await _create_work_order(client, headers)
    await client.post(
        f"/api/v1/manufacturing/work-orders/{wo['id']}/cancel",
        headers=headers,
    )
    resp = await client.post(
        f"/api/v1/manufacturing/work-orders/{wo['id']}/cancel",
        headers=headers,
    )
    assert resp.status_code == 409


async def test_material_availability_check(client: AsyncClient, superadmin_user):
    """GET .../material-availability returns availability per material."""
    headers = auth_headers(superadmin_user)
    wo = await _create_work_order(client, headers)
    resp = await client.get(
        f"/api/v1/manufacturing/work-orders/{wo['id']}/material-availability",
        headers=headers,
    )
    assert resp.status_code == 200
    items = resp.json()
    assert isinstance(items, list)
    if items:
        assert "required" in items[0]
        assert "available" in items[0]
        assert "sufficient" in items[0]


async def test_list_consumption(client: AsyncClient, superadmin_user):
    """GET .../consumption returns consumption records for a work order."""
    headers = auth_headers(superadmin_user)
    wo = await _create_work_order(client, headers)
    resp = await client.get(
        f"/api/v1/manufacturing/work-orders/{wo['id']}/consumption",
        headers=headers,
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ── Quality Checks ───────────────────────────────────────────────────────────


async def test_list_quality_checks(client: AsyncClient, test_user):
    """GET /api/v1/manufacturing/quality-checks returns list."""
    resp = await client.get(
        "/api/v1/manufacturing/quality-checks",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert "quality_checks" in resp.json()


async def test_create_quality_check(client: AsyncClient, superadmin_user):
    """POST /api/v1/manufacturing/quality-checks creates a QC record."""
    headers = auth_headers(superadmin_user)
    wo = await _create_work_order(client, headers)

    resp = await client.post(
        "/api/v1/manufacturing/quality-checks",
        json={
            "work_order_id": wo["id"],
            "quantity_inspected": 100,
            "quantity_passed": 95,
            "quantity_failed": 5,
            "status": "completed",
            "notes": "Minor defects found",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["check_number"].startswith("QC-")
    assert data["quantity_passed"] == 95
    assert data["quantity_failed"] == 5


# ── Dashboard ────────────────────────────────────────────────────────────────


async def test_manufacturing_dashboard(client: AsyncClient, test_user):
    """GET /api/v1/manufacturing/dashboard/stats returns summary stats."""
    resp = await client.get(
        "/api/v1/manufacturing/dashboard/stats",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "total_boms" in data
    assert "total_workstations" in data
    assert "defect_rate_percent" in data


# ── Auth Required ────────────────────────────────────────────────────────────


async def test_manufacturing_requires_auth(client: AsyncClient):
    """Manufacturing endpoints require authentication."""
    resp = await client.get("/api/v1/manufacturing/bom")
    assert resp.status_code in (401, 403)
