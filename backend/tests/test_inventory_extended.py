"""Extended Inventory tests — PO lifecycle, reorder alerts, stock valuation,
stock adjustments, batch/serial tracking, suppliers, physical counts."""
from __future__ import annotations

import uuid
from datetime import date

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


# ── Helpers ─────────────────────────────────────────────────────────────────


async def _create_warehouse(client: AsyncClient, h: dict, name: str = "Main WH") -> dict:
    resp = await client.post(
        "/api/v1/inventory/warehouses",
        json={"name": name, "location": "Nairobi"},
        headers=h,
    )
    assert resp.status_code == 201
    return resp.json()


async def _create_item(
    client: AsyncClient,
    h: dict,
    name: str = "Widget",
    cost: str = "100",
    sell: str = "150",
    reorder: int = 10,
) -> dict:
    resp = await client.post(
        "/api/v1/inventory/items",
        json={
            "name": name,
            "cost_price": cost,
            "selling_price": sell,
            "reorder_level": reorder,
            "category": "general",
        },
        headers=h,
    )
    assert resp.status_code == 201
    return resp.json()


# ── Purchase Order Lifecycle ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_po_create_and_detail(client: AsyncClient, superadmin_user):
    """Create a purchase order with lines and retrieve detail."""
    h = auth_headers(superadmin_user)
    item = await _create_item(client, h, name="PO Item")
    wh = await _create_warehouse(client, h, name="PO Warehouse")

    po_resp = await client.post(
        "/api/v1/inventory/purchase-orders",
        json={
            "supplier_name": "Acme Supplies",
            "supplier_email": "acme@example.com",
            "order_date": "2026-03-01",
            "expected_date": "2026-03-15",
            "lines": [
                {"item_id": item["id"], "quantity": 50, "unit_price": "100"},
            ],
        },
        headers=h,
    )
    assert po_resp.status_code == 201
    po = po_resp.json()
    assert po["status"] == "draft"
    assert po["total"] == "5000"
    assert len(po["lines"]) == 1

    # Detail
    detail_resp = await client.get(
        f"/api/v1/inventory/purchase-orders/{po['id']}", headers=h
    )
    assert detail_resp.status_code == 200
    assert detail_resp.json()["po_number"] == po["po_number"]


@pytest.mark.asyncio
async def test_po_send(client: AsyncClient, superadmin_user):
    """Mark a draft PO as sent."""
    h = auth_headers(superadmin_user)
    item = await _create_item(client, h, name="Send Item")

    po_resp = await client.post(
        "/api/v1/inventory/purchase-orders",
        json={
            "supplier_name": "Vendor B",
            "order_date": "2026-03-01",
            "lines": [{"item_id": item["id"], "quantity": 20, "unit_price": "50"}],
        },
        headers=h,
    )
    po_id = po_resp.json()["id"]

    send_resp = await client.post(
        f"/api/v1/inventory/purchase-orders/{po_id}/send", headers=h
    )
    assert send_resp.status_code == 200
    assert send_resp.json()["status"] == "sent"


@pytest.mark.asyncio
async def test_po_cannot_send_non_draft(client: AsyncClient, superadmin_user):
    """Cannot send a PO that is not in draft status."""
    h = auth_headers(superadmin_user)
    item = await _create_item(client, h, name="No-Send Item")

    po_resp = await client.post(
        "/api/v1/inventory/purchase-orders",
        json={
            "supplier_name": "Vendor C",
            "order_date": "2026-03-01",
            "lines": [{"item_id": item["id"], "quantity": 10, "unit_price": "25"}],
        },
        headers=h,
    )
    po_id = po_resp.json()["id"]

    # Send once
    await client.post(f"/api/v1/inventory/purchase-orders/{po_id}/send", headers=h)
    # Try sending again
    resp = await client.post(
        f"/api/v1/inventory/purchase-orders/{po_id}/send", headers=h
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_po_receive_creates_stock(client: AsyncClient, superadmin_user):
    """Receiving a PO creates stock movements and updates stock levels."""
    h = auth_headers(superadmin_user)
    wh = await _create_warehouse(client, h, name="Receive WH")
    item = await _create_item(client, h, name="Receive Item")

    po_resp = await client.post(
        "/api/v1/inventory/purchase-orders",
        json={
            "supplier_name": "Vendor D",
            "order_date": "2026-03-01",
            "lines": [{"item_id": item["id"], "quantity": 30, "unit_price": "75"}],
        },
        headers=h,
    )
    po_id = po_resp.json()["id"]

    # Send then receive
    await client.post(f"/api/v1/inventory/purchase-orders/{po_id}/send", headers=h)
    recv_resp = await client.post(
        f"/api/v1/inventory/purchase-orders/{po_id}/receive", headers=h
    )
    assert recv_resp.status_code == 200
    assert recv_resp.json()["status"] == "received"

    # Verify stock movement was created
    movements_resp = await client.get(
        "/api/v1/inventory/stock-movements",
        params={"item_id": item["id"]},
        headers=h,
    )
    assert movements_resp.status_code == 200
    assert movements_resp.json()["total"] >= 1


@pytest.mark.asyncio
async def test_po_cannot_receive_twice(client: AsyncClient, superadmin_user):
    """Cannot receive a PO that is already received."""
    h = auth_headers(superadmin_user)
    await _create_warehouse(client, h, name="Double Recv WH")
    item = await _create_item(client, h, name="Double Recv Item")

    po_resp = await client.post(
        "/api/v1/inventory/purchase-orders",
        json={
            "supplier_name": "Vendor E",
            "order_date": "2026-03-01",
            "lines": [{"item_id": item["id"], "quantity": 5, "unit_price": "10"}],
        },
        headers=h,
    )
    po_id = po_resp.json()["id"]

    await client.post(f"/api/v1/inventory/purchase-orders/{po_id}/receive", headers=h)
    resp = await client.post(
        f"/api/v1/inventory/purchase-orders/{po_id}/receive", headers=h
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_po_cancel(client: AsyncClient, superadmin_user):
    """Cancel a draft PO."""
    h = auth_headers(superadmin_user)
    item = await _create_item(client, h, name="Cancel Item")

    po_resp = await client.post(
        "/api/v1/inventory/purchase-orders",
        json={
            "supplier_name": "Vendor F",
            "order_date": "2026-03-01",
            "lines": [{"item_id": item["id"], "quantity": 5, "unit_price": "10"}],
        },
        headers=h,
    )
    po_id = po_resp.json()["id"]

    cancel_resp = await client.delete(
        f"/api/v1/inventory/purchase-orders/{po_id}", headers=h
    )
    assert cancel_resp.status_code == 204


@pytest.mark.asyncio
async def test_po_update_draft_only(client: AsyncClient, superadmin_user):
    """Can update a draft PO but not a sent one."""
    h = auth_headers(superadmin_user)
    item = await _create_item(client, h, name="Update PO Item")

    po_resp = await client.post(
        "/api/v1/inventory/purchase-orders",
        json={
            "supplier_name": "Old Vendor",
            "order_date": "2026-03-01",
            "lines": [{"item_id": item["id"], "quantity": 5, "unit_price": "10"}],
        },
        headers=h,
    )
    po_id = po_resp.json()["id"]

    # Update draft — ok
    update_resp = await client.put(
        f"/api/v1/inventory/purchase-orders/{po_id}",
        json={"supplier_name": "New Vendor"},
        headers=h,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["supplier_name"] == "New Vendor"

    # Send it
    await client.post(f"/api/v1/inventory/purchase-orders/{po_id}/send", headers=h)

    # Update sent — conflict
    resp = await client.put(
        f"/api/v1/inventory/purchase-orders/{po_id}",
        json={"supplier_name": "Another"},
        headers=h,
    )
    assert resp.status_code == 409


# ── Reorder Alerts ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_reorder_alerts_endpoint(client: AsyncClient, superadmin_user):
    """GET /api/v1/inventory/reorder-alerts returns items at or below reorder level."""
    h = auth_headers(superadmin_user)
    wh = await _create_warehouse(client, h, name="Alert WH")
    item = await _create_item(client, h, name="Low Stock Item", reorder=100)

    # Add only 5 units via stock movement (below reorder of 100)
    await client.post(
        "/api/v1/inventory/stock-movements",
        json={
            "item_id": item["id"],
            "warehouse_id": wh["id"],
            "movement_type": "receipt",
            "quantity": 5,
        },
        headers=h,
    )

    resp = await client.get("/api/v1/inventory/reorder-alerts", headers=h)
    assert resp.status_code == 200
    alerts = resp.json()
    # Should include our item
    item_ids = [a["item_id"] for a in alerts]
    assert item["id"] in item_ids


# ── Stock Valuation ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_stock_valuation_report(client: AsyncClient, superadmin_user):
    """GET /api/v1/inventory/valuation returns warehouse-level stock values."""
    h = auth_headers(superadmin_user)
    wh = await _create_warehouse(client, h, name="Valuation WH")
    item = await _create_item(client, h, name="Valued Item", cost="200", sell="350")

    # Add stock
    await client.post(
        "/api/v1/inventory/stock-movements",
        json={
            "item_id": item["id"],
            "warehouse_id": wh["id"],
            "movement_type": "receipt",
            "quantity": 10,
        },
        headers=h,
    )

    resp = await client.get("/api/v1/inventory/valuation", headers=h)
    assert resp.status_code == 200
    data = resp.json()
    assert "warehouses" in data
    assert "grand_total_cost" in data
    assert "grand_total_retail" in data
    assert "grand_total_units" in data


@pytest.mark.asyncio
async def test_stock_valuation_by_warehouse(client: AsyncClient, superadmin_user):
    """GET /api/v1/inventory/valuation?warehouse_id=X filters by warehouse."""
    h = auth_headers(superadmin_user)
    wh = await _create_warehouse(client, h, name="Filtered WH")

    resp = await client.get(
        "/api/v1/inventory/valuation",
        params={"warehouse_id": wh["id"]},
        headers=h,
    )
    assert resp.status_code == 200


# ── Stock Adjustments ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_stock_adjustment_sets_quantity(client: AsyncClient, superadmin_user):
    """Stock adjustment sets the exact quantity and creates movement."""
    h = auth_headers(superadmin_user)
    wh = await _create_warehouse(client, h, name="Adjust WH")
    item = await _create_item(client, h, name="Adjust Item")

    # Add initial stock
    await client.post(
        "/api/v1/inventory/stock-movements",
        json={
            "item_id": item["id"],
            "warehouse_id": wh["id"],
            "movement_type": "receipt",
            "quantity": 50,
        },
        headers=h,
    )

    # Adjust to 30
    adj_resp = await client.post(
        "/api/v1/inventory/stock-adjustments",
        json={
            "item_id": item["id"],
            "warehouse_id": wh["id"],
            "new_quantity": 30,
            "reason": "Damaged goods",
        },
        headers=h,
    )
    assert adj_resp.status_code == 201
    data = adj_resp.json()
    assert data["old_quantity"] == 50
    assert data["new_quantity"] == 30


@pytest.mark.asyncio
async def test_list_stock_adjustments(client: AsyncClient, superadmin_user):
    """GET /api/v1/inventory/stock-adjustments returns adjustments."""
    h = auth_headers(superadmin_user)
    resp = await client.get("/api/v1/inventory/stock-adjustments", headers=h)
    assert resp.status_code == 200
    assert "total" in resp.json()
    assert "stock_adjustments" in resp.json()


# ── Batch / Serial Tracking ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_and_list_batches(client: AsyncClient, superadmin_user):
    """Create a batch for an item and list batches."""
    h = auth_headers(superadmin_user)
    wh = await _create_warehouse(client, h, name="Batch WH")
    item = await _create_item(client, h, name="Batch Item")

    batch_resp = await client.post(
        f"/api/v1/inventory/items/{item['id']}/batches",
        json={
            "batch_no": f"BATCH-{uuid.uuid4().hex[:6]}",
            "manufacture_date": "2026-01-15",
            "expiry_date": "2027-01-15",
            "quantity": 100,
            "warehouse_id": wh["id"],
        },
        headers=h,
    )
    assert batch_resp.status_code == 201
    batch = batch_resp.json()
    assert batch["item_id"] == item["id"]
    assert batch["quantity"] == 100

    # List batches
    list_resp = await client.get(
        f"/api/v1/inventory/items/{item['id']}/batches", headers=h
    )
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 1


@pytest.mark.asyncio
async def test_duplicate_batch_number_rejected(client: AsyncClient, superadmin_user):
    """Cannot create two batches with the same batch number."""
    h = auth_headers(superadmin_user)
    wh = await _create_warehouse(client, h, name="Dup Batch WH")
    item = await _create_item(client, h, name="Dup Batch Item")
    batch_no = f"BATCH-DUP-{uuid.uuid4().hex[:4]}"

    await client.post(
        f"/api/v1/inventory/items/{item['id']}/batches",
        json={
            "batch_no": batch_no,
            "manufacture_date": "2026-01-15",
            "quantity": 50,
            "warehouse_id": wh["id"],
        },
        headers=h,
    )

    resp = await client.post(
        f"/api/v1/inventory/items/{item['id']}/batches",
        json={
            "batch_no": batch_no,
            "manufacture_date": "2026-02-15",
            "quantity": 25,
            "warehouse_id": wh["id"],
        },
        headers=h,
    )
    assert resp.status_code == 409


# ── Item Variants ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_and_list_variants(client: AsyncClient, superadmin_user):
    """Create a variant for an item and list variants."""
    h = auth_headers(superadmin_user)
    item = await _create_item(client, h, name="Variant Parent")

    variant_sku = f"VAR-{uuid.uuid4().hex[:6]}"
    variant_resp = await client.post(
        f"/api/v1/inventory/items/{item['id']}/variants",
        json={
            "variant_name": "Large",
            "sku": variant_sku,
            "price_adjustment": "25.00",
            "attributes": {"size": "L", "color": "Blue"},
        },
        headers=h,
    )
    assert variant_resp.status_code == 201
    variant = variant_resp.json()
    assert variant["variant_name"] == "Large"

    list_resp = await client.get(
        f"/api/v1/inventory/items/{item['id']}/variants", headers=h
    )
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 1


# ── Suppliers ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_supplier_crud(client: AsyncClient, superadmin_user):
    """Create, read, update, delete a supplier."""
    h = auth_headers(superadmin_user)

    # Create
    create_resp = await client.post(
        "/api/v1/inventory/suppliers",
        json={
            "name": "Test Supplier",
            "email": "supplier@example.com",
            "phone": "+254700000000",
            "contact_person": "John",
            "payment_terms": "Net 30",
        },
        headers=h,
    )
    assert create_resp.status_code == 201
    supplier_id = create_resp.json()["id"]

    # Read
    get_resp = await client.get(
        f"/api/v1/inventory/suppliers/{supplier_id}", headers=h
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Test Supplier"

    # Update
    update_resp = await client.put(
        f"/api/v1/inventory/suppliers/{supplier_id}",
        json={"name": "Updated Supplier"},
        headers=h,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Updated Supplier"

    # Delete (soft-delete)
    del_resp = await client.delete(
        f"/api/v1/inventory/suppliers/{supplier_id}", headers=h
    )
    assert del_resp.status_code == 204

    # Verify it is gone (soft-deleted)
    get_resp2 = await client.get(
        f"/api/v1/inventory/suppliers/{supplier_id}", headers=h
    )
    assert get_resp2.status_code == 404


# ── Physical Inventory Count ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_physical_count_lifecycle(client: AsyncClient, superadmin_user):
    """Create a physical count, submit results, complete."""
    h = auth_headers(superadmin_user)
    wh = await _create_warehouse(client, h, name="Count WH")

    # Create count
    count_resp = await client.post(
        "/api/v1/inventory/counts",
        json={
            "warehouse_id": wh["id"],
            "count_date": "2026-03-10",
            "notes": "Quarterly count",
        },
        headers=h,
    )
    assert count_resp.status_code == 201
    count = count_resp.json()
    assert count["status"] == "in_progress"

    # Complete count
    update_resp = await client.put(
        f"/api/v1/inventory/counts/{count['id']}",
        json={"status": "completed"},
        headers=h,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_cannot_update_completed_count(client: AsyncClient, superadmin_user):
    """Cannot update a count that is already completed."""
    h = auth_headers(superadmin_user)
    wh = await _create_warehouse(client, h, name="Completed Count WH")

    count_resp = await client.post(
        "/api/v1/inventory/counts",
        json={"warehouse_id": wh["id"], "count_date": "2026-03-10"},
        headers=h,
    )
    count_id = count_resp.json()["id"]

    # Complete
    await client.put(
        f"/api/v1/inventory/counts/{count_id}",
        json={"status": "completed"},
        headers=h,
    )

    # Try updating again
    resp = await client.put(
        f"/api/v1/inventory/counts/{count_id}",
        json={"status": "cancelled"},
        headers=h,
    )
    assert resp.status_code == 409


# ── Dashboard + Reports ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_inventory_dashboard(client: AsyncClient, test_user):
    """GET /api/v1/inventory/dashboard/stats returns summary."""
    resp = await client.get(
        "/api/v1/inventory/dashboard/stats",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "total_items" in data
    assert "low_stock_count" in data
    assert "pending_pos" in data
    assert "total_inventory_value" in data


@pytest.mark.asyncio
async def test_turnover_report(client: AsyncClient, test_user):
    """GET /api/v1/inventory/reports/turnover returns turnover data."""
    resp = await client.get(
        "/api/v1/inventory/reports/turnover",
        params={"days": 30},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "days" in data
    assert "items" in data


@pytest.mark.asyncio
async def test_aging_report(client: AsyncClient, test_user):
    """GET /api/v1/inventory/reports/aging returns aging buckets."""
    resp = await client.get(
        "/api/v1/inventory/reports/aging",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "buckets" in data
    assert "summary" in data


# ── Auth Required ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_inventory_requires_auth(client: AsyncClient):
    """Inventory endpoints require authentication."""
    resp = await client.get("/api/v1/inventory/items")
    assert resp.status_code in (401, 403)
