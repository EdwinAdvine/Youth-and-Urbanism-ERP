"""POS extended tests — offline sync, terminals, discounts, cash movements, reports."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import auth_headers


# ── Helpers ─────────────────────────────────────────────────────────────────


async def _create_warehouse(client: AsyncClient, h: dict, name: str = "POS-Ext WH") -> dict:
    resp = await client.post(
        "/api/v1/inventory/warehouses",
        json={"name": name, "location": "Nairobi"},
        headers=h,
    )
    assert resp.status_code == 201
    return resp.json()


async def _create_item(
    client: AsyncClient, h: dict, name: str = "POS-Ext Item",
    cost: str = "80", sell: str = "120",
) -> dict:
    resp = await client.post(
        "/api/v1/inventory/items",
        json={
            "name": name,
            "cost_price": cost,
            "selling_price": sell,
            "reorder_level": 5,
            "category": "pos-ext",
        },
        headers=h,
    )
    assert resp.status_code == 201
    return resp.json()


async def _add_stock(
    client: AsyncClient, h: dict, item_id: str, warehouse_id: str, qty: int = 100,
) -> None:
    resp = await client.post(
        "/api/v1/inventory/stock-movements",
        json={
            "item_id": item_id,
            "warehouse_id": warehouse_id,
            "movement_type": "receipt",
            "quantity": qty,
        },
        headers=h,
    )
    assert resp.status_code == 201


async def _open_session(
    client: AsyncClient, h: dict, warehouse_id: str, opening: str = "5000",
) -> dict:
    resp = await client.post(
        "/api/v1/pos/sessions/open",
        json={"warehouse_id": warehouse_id, "opening_balance": opening},
        headers=h,
    )
    assert resp.status_code == 201
    return resp.json()


async def _close_session(client: AsyncClient, h: dict, session_id: str) -> dict:
    resp = await client.post(
        f"/api/v1/pos/sessions/{session_id}/close",
        json={"closing_balance": "5000"},
        headers=h,
    )
    return resp.json()


async def _setup_pos(client: AsyncClient, h: dict):
    """Create warehouse, item, stock, open session. Returns (warehouse, item, session)."""
    wh = await _create_warehouse(client, h, name=f"POS-Ext-WH-{uuid.uuid4().hex[:4]}")
    item = await _create_item(client, h, name=f"POS-Ext-Item-{uuid.uuid4().hex[:4]}")
    await _add_stock(client, h, item["id"], wh["id"], 100)
    session = await _open_session(client, h, wh["id"])
    return wh, item, session


# ── Offline Sync ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_offline_sync_success(client: AsyncClient, superadmin_user):
    """POST /api/v1/pos/transactions/offline-sync imports transactions."""
    h = auth_headers(superadmin_user)
    wh, item, session = await _setup_pos(client, h)

    resp = await client.post(
        "/api/v1/pos/transactions/offline-sync",
        json={
            "transactions": [
                {
                    "session_id": session["id"],
                    "offline_id": f"offline-{uuid.uuid4().hex[:8]}",
                    "customer_name": "Offline Customer",
                    "lines": [
                        {"item_id": item["id"], "quantity": 2, "unit_price": "120"},
                    ],
                    "payments": [
                        {"payment_method": "cash", "amount": "240"},
                    ],
                },
            ],
        },
        headers=h,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["success"] == 1
    assert data["errors"] == 0
    assert data["results"][0]["status"] == "success"

    # Cleanup
    await _close_session(client, h, session["id"])


@pytest.mark.asyncio
async def test_offline_sync_duplicate_rejection(client: AsyncClient, superadmin_user):
    """Offline sync with same offline_id should still process (dedup is client-side)."""
    h = auth_headers(superadmin_user)
    wh, item, session = await _setup_pos(client, h)
    offline_id = f"offline-dup-{uuid.uuid4().hex[:8]}"

    txn_data = {
        "session_id": session["id"],
        "offline_id": offline_id,
        "lines": [{"item_id": item["id"], "quantity": 1, "unit_price": "120"}],
        "payments": [{"payment_method": "cash", "amount": "120"}],
    }

    # First sync
    resp1 = await client.post(
        "/api/v1/pos/transactions/offline-sync",
        json={"transactions": [txn_data]},
        headers=h,
    )
    assert resp1.status_code == 200
    assert resp1.json()["success"] == 1

    # Second sync with same offline_id (server accepts it; dedup is client responsibility)
    resp2 = await client.post(
        "/api/v1/pos/transactions/offline-sync",
        json={"transactions": [txn_data]},
        headers=h,
    )
    assert resp2.status_code == 200

    # Cleanup
    await _close_session(client, h, session["id"])


@pytest.mark.asyncio
async def test_offline_sync_invalid_session(client: AsyncClient, superadmin_user):
    """Offline sync with nonexistent session returns error per-transaction."""
    h = auth_headers(superadmin_user)
    wh, item, session = await _setup_pos(client, h)

    resp = await client.post(
        "/api/v1/pos/transactions/offline-sync",
        json={
            "transactions": [
                {
                    "session_id": str(uuid.uuid4()),
                    "offline_id": "bad-session",
                    "lines": [{"item_id": item["id"], "quantity": 1, "unit_price": "120"}],
                    "payments": [{"payment_method": "cash", "amount": "120"}],
                },
            ],
        },
        headers=h,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["errors"] == 1
    assert data["results"][0]["status"] == "error"

    # Cleanup
    await _close_session(client, h, session["id"])


@pytest.mark.asyncio
async def test_offline_sync_empty_lines_rejected(client: AsyncClient, superadmin_user):
    """Offline sync with no line items returns per-transaction error."""
    h = auth_headers(superadmin_user)
    wh, item, session = await _setup_pos(client, h)

    resp = await client.post(
        "/api/v1/pos/transactions/offline-sync",
        json={
            "transactions": [
                {
                    "session_id": session["id"],
                    "offline_id": "no-lines",
                    "lines": [],
                    "payments": [{"payment_method": "cash", "amount": "100"}],
                },
            ],
        },
        headers=h,
    )
    assert resp.status_code == 200
    assert resp.json()["results"][0]["status"] == "error"

    # Cleanup
    await _close_session(client, h, session["id"])


@pytest.mark.asyncio
async def test_offline_sync_no_payments_rejected(client: AsyncClient, superadmin_user):
    """Offline sync with no payments returns per-transaction error."""
    h = auth_headers(superadmin_user)
    wh, item, session = await _setup_pos(client, h)

    resp = await client.post(
        "/api/v1/pos/transactions/offline-sync",
        json={
            "transactions": [
                {
                    "session_id": session["id"],
                    "offline_id": "no-payments",
                    "lines": [{"item_id": item["id"], "quantity": 1, "unit_price": "120"}],
                    "payments": [],
                },
            ],
        },
        headers=h,
    )
    assert resp.status_code == 200
    assert resp.json()["results"][0]["status"] == "error"

    # Cleanup
    await _close_session(client, h, session["id"])


@pytest.mark.asyncio
async def test_offline_sync_empty_batch_rejected(client: AsyncClient, superadmin_user):
    """Offline sync with empty transactions list returns 422."""
    resp = await client.post(
        "/api/v1/pos/transactions/offline-sync",
        json={"transactions": []},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 422


# ── Terminals CRUD ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_terminal_crud(client: AsyncClient, superadmin_user):
    """Create, list, update, delete a POS terminal."""
    h = auth_headers(superadmin_user)

    # Create
    create_resp = await client.post(
        "/api/v1/pos/terminals",
        json={"name": "Register 1", "location": "Counter A"},
        headers=h,
    )
    assert create_resp.status_code == 201
    terminal_id = create_resp.json()["id"]

    # List
    list_resp = await client.get("/api/v1/pos/terminals", headers=h)
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= 1

    # Update
    update_resp = await client.put(
        f"/api/v1/pos/terminals/{terminal_id}",
        json={"name": "Register 1 Updated", "location": "Counter B"},
        headers=h,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Register 1 Updated"

    # Delete
    del_resp = await client.delete(f"/api/v1/pos/terminals/{terminal_id}", headers=h)
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_terminal_not_found(client: AsyncClient, superadmin_user):
    """PUT on nonexistent terminal returns 404."""
    resp = await client.put(
        f"/api/v1/pos/terminals/{uuid.uuid4()}",
        json={"name": "Ghost Terminal"},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 404


# ── Discounts CRUD ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_discount_crud(client: AsyncClient, superadmin_user):
    """Create, list, update, delete a POS discount."""
    h = auth_headers(superadmin_user)

    # Create
    create_resp = await client.post(
        "/api/v1/pos/discounts",
        json={"name": "Happy Hour", "discount_type": "percentage", "value": "10"},
        headers=h,
    )
    assert create_resp.status_code == 201
    discount_id = create_resp.json()["id"]

    # List
    list_resp = await client.get("/api/v1/pos/discounts", headers=h)
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= 1

    # Update
    update_resp = await client.put(
        f"/api/v1/pos/discounts/{discount_id}",
        json={"name": "Super Happy Hour", "discount_type": "percentage", "value": "15"},
        headers=h,
    )
    assert update_resp.status_code == 200

    # Delete
    del_resp = await client.delete(f"/api/v1/pos/discounts/{discount_id}", headers=h)
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_discount_invalid_type_rejected(client: AsyncClient, superadmin_user):
    """Creating a discount with invalid type returns 422."""
    resp = await client.post(
        "/api/v1/pos/discounts",
        json={"name": "Bad Discount", "discount_type": "bogus", "value": "10"},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_discount_percentage_over_100_rejected(client: AsyncClient, superadmin_user):
    """Percentage discount over 100% returns 422."""
    resp = await client.post(
        "/api/v1/pos/discounts",
        json={"name": "Over 100", "discount_type": "percentage", "value": "150"},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 422


# ── Cash Movements ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cash_movement_crud(client: AsyncClient, superadmin_user):
    """Create and list cash movements for a session."""
    h = auth_headers(superadmin_user)
    wh = await _create_warehouse(client, h, name=f"CM-WH-{uuid.uuid4().hex[:4]}")
    session = await _open_session(client, h, wh["id"])

    # Cash in
    in_resp = await client.post(
        "/api/v1/pos/cash-movements",
        json={
            "session_id": session["id"],
            "movement_type": "in",
            "amount": "500",
            "reason": "Petty cash deposit",
        },
        headers=h,
    )
    assert in_resp.status_code == 201

    # Cash out
    out_resp = await client.post(
        "/api/v1/pos/cash-movements",
        json={
            "session_id": session["id"],
            "movement_type": "out",
            "amount": "200",
            "reason": "Change for vendor",
        },
        headers=h,
    )
    assert out_resp.status_code == 201

    # List
    list_resp = await client.get(
        f"/api/v1/pos/sessions/{session['id']}/cash-movements",
        headers=h,
    )
    assert list_resp.status_code == 200
    data = list_resp.json()
    assert Decimal(data["total_in"]) == Decimal("500")
    assert Decimal(data["total_out"]) == Decimal("200")
    assert Decimal(data["net"]) == Decimal("300")

    # Cleanup
    await _close_session(client, h, session["id"])


@pytest.mark.asyncio
async def test_cash_movement_invalid_type_rejected(client: AsyncClient, superadmin_user):
    """Cash movement with invalid type returns 422."""
    h = auth_headers(superadmin_user)
    wh = await _create_warehouse(client, h, name=f"CM-Bad-{uuid.uuid4().hex[:4]}")
    session = await _open_session(client, h, wh["id"])

    resp = await client.post(
        "/api/v1/pos/cash-movements",
        json={
            "session_id": session["id"],
            "movement_type": "invalid",
            "amount": "100",
            "reason": "Bad type",
        },
        headers=h,
    )
    assert resp.status_code == 422

    # Cleanup
    await _close_session(client, h, session["id"])


# ── Session Summary ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_session_summary(client: AsyncClient, superadmin_user):
    """GET /api/v1/pos/sessions/{id}/summary returns shift summary."""
    h = auth_headers(superadmin_user)
    wh, item, session = await _setup_pos(client, h)

    # Make a sale
    await client.post(
        "/api/v1/pos/transactions",
        json={
            "lines": [{"item_id": item["id"], "quantity": 3, "unit_price": "120"}],
            "payments": [{"payment_method": "cash", "amount": "360"}],
        },
        headers=h,
    )

    summary_resp = await client.get(
        f"/api/v1/pos/sessions/{session['id']}/summary",
        headers=h,
    )
    assert summary_resp.status_code == 200
    data = summary_resp.json()
    assert "session" in data
    assert "total_sales" in data
    assert "payment_methods" in data
    assert "top_products" in data

    # Cleanup
    await _close_session(client, h, session["id"])


# ── Reports ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_daily_sales_report(client: AsyncClient, superadmin_user):
    """GET /api/v1/pos/reports/daily-sales returns daily grouped data."""
    today = date.today()
    resp = await client.get(
        "/api/v1/pos/reports/daily-sales",
        params={"start_date": today.isoformat(), "end_date": today.isoformat()},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "days" in data
    assert "grand_total" in data
    assert "grand_count" in data


@pytest.mark.asyncio
async def test_by_product_report(client: AsyncClient, superadmin_user):
    """GET /api/v1/pos/reports/by-product returns product breakdown."""
    today = date.today()
    resp = await client.get(
        "/api/v1/pos/reports/by-product",
        params={"start_date": today.isoformat(), "end_date": today.isoformat()},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "products" in data


@pytest.mark.asyncio
async def test_by_cashier_report(client: AsyncClient, superadmin_user):
    """GET /api/v1/pos/reports/by-cashier returns cashier breakdown."""
    today = date.today()
    resp = await client.get(
        "/api/v1/pos/reports/by-cashier",
        params={"start_date": today.isoformat(), "end_date": today.isoformat()},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "cashiers" in data


# ── Receipt generation ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_generate_receipt(client: AsyncClient, superadmin_user):
    """POST /api/v1/pos/transactions/{id}/receipt generates a receipt."""
    h = auth_headers(superadmin_user)
    wh, item, session = await _setup_pos(client, h)

    txn_resp = await client.post(
        "/api/v1/pos/transactions",
        json={
            "customer_name": "Receipt Customer",
            "lines": [{"item_id": item["id"], "quantity": 1, "unit_price": "120"}],
            "payments": [{"payment_method": "cash", "amount": "120"}],
        },
        headers=h,
    )
    txn_id = txn_resp.json()["id"]

    receipt_resp = await client.post(
        f"/api/v1/pos/transactions/{txn_id}/receipt",
        headers=h,
    )
    assert receipt_resp.status_code == 201
    data = receipt_resp.json()
    assert "receipt" in data
    assert "receipt_number" in data["receipt"]

    # Cleanup
    await _close_session(client, h, session["id"])


@pytest.mark.asyncio
async def test_duplicate_receipt_rejected(client: AsyncClient, superadmin_user):
    """Generating receipt twice returns 409."""
    h = auth_headers(superadmin_user)
    wh, item, session = await _setup_pos(client, h)

    txn_resp = await client.post(
        "/api/v1/pos/transactions",
        json={
            "lines": [{"item_id": item["id"], "quantity": 1, "unit_price": "120"}],
            "payments": [{"payment_method": "cash", "amount": "120"}],
        },
        headers=h,
    )
    txn_id = txn_resp.json()["id"]

    await client.post(f"/api/v1/pos/transactions/{txn_id}/receipt", headers=h)
    resp2 = await client.post(f"/api/v1/pos/transactions/{txn_id}/receipt", headers=h)
    assert resp2.status_code == 409

    # Cleanup
    await _close_session(client, h, session["id"])


# ── Auth Required ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_pos_extended_requires_auth(client: AsyncClient):
    """POS extended endpoints require authentication."""
    resp = await client.get("/api/v1/pos/terminals")
    assert resp.status_code in (401, 403)
