"""POS tests — session lifecycle, transactions, refunds, voids, cash reconciliation, dashboard."""
from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


# ── Helpers ─────────────────────────────────────────────────────────────────


async def _create_warehouse(client: AsyncClient, h: dict, name: str = "POS WH") -> dict:
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
    name: str = "POS Item",
    cost: str = "80",
    sell: str = "120",
) -> dict:
    resp = await client.post(
        "/api/v1/inventory/items",
        json={
            "name": name,
            "cost_price": cost,
            "selling_price": sell,
            "reorder_level": 5,
            "category": "pos",
        },
        headers=h,
    )
    assert resp.status_code == 201
    return resp.json()


async def _add_stock(
    client: AsyncClient, h: dict, item_id: str, warehouse_id: str, qty: int = 100
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
    client: AsyncClient, h: dict, warehouse_id: str, opening: str = "5000"
) -> dict:
    resp = await client.post(
        "/api/v1/pos/sessions/open",
        json={"warehouse_id": warehouse_id, "opening_balance": opening},
        headers=h,
    )
    assert resp.status_code == 201
    return resp.json()


async def _close_session(
    client: AsyncClient, h: dict, session_id: str, closing: str = "5000"
) -> dict:
    resp = await client.post(
        f"/api/v1/pos/sessions/{session_id}/close",
        json={"closing_balance": closing},
        headers=h,
    )
    return resp.json()


async def _setup_pos(client: AsyncClient, h: dict):
    """Create warehouse, item, stock, and open a POS session. Returns (warehouse, item, session)."""
    wh = await _create_warehouse(client, h, name=f"POS-WH-{uuid.uuid4().hex[:4]}")
    item = await _create_item(client, h, name=f"POS-Item-{uuid.uuid4().hex[:4]}")
    await _add_stock(client, h, item["id"], wh["id"], 100)
    session = await _open_session(client, h, wh["id"])
    return wh, item, session


# ── Session Lifecycle ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_open_session(client: AsyncClient, superadmin_user):
    """Open a POS session and verify it."""
    h = auth_headers(superadmin_user)
    wh = await _create_warehouse(client, h, name="Open Session WH")

    session = await _open_session(client, h, wh["id"], "10000")
    assert session["status"] == "open"
    assert session["opening_balance"] == "10000"
    assert session["warehouse_id"] == wh["id"]

    # Close to avoid conflict with other tests
    await _close_session(client, h, session["id"], "10000")


@pytest.mark.asyncio
async def test_cannot_open_duplicate_session(client: AsyncClient, superadmin_user):
    """Cannot open a second session while one is already open."""
    h = auth_headers(superadmin_user)
    wh = await _create_warehouse(client, h, name="Dup Session WH")
    session = await _open_session(client, h, wh["id"])

    # Try opening another
    resp = await client.post(
        "/api/v1/pos/sessions/open",
        json={"warehouse_id": wh["id"], "opening_balance": "1000"},
        headers=h,
    )
    assert resp.status_code == 409

    # Cleanup
    await _close_session(client, h, session["id"])


@pytest.mark.asyncio
async def test_close_session_calculates_difference(client: AsyncClient, superadmin_user):
    """Closing a session computes expected balance and difference."""
    h = auth_headers(superadmin_user)
    wh = await _create_warehouse(client, h, name="Close Session WH")
    item = await _create_item(client, h, name="Close Session Item")
    await _add_stock(client, h, item["id"], wh["id"], 100)
    session = await _open_session(client, h, wh["id"], "5000")

    # Make a sale
    await client.post(
        "/api/v1/pos/transactions",
        json={
            "lines": [
                {"item_id": item["id"], "quantity": 2, "unit_price": "120"},
            ],
            "payments": [{"payment_method": "cash", "amount": "240"}],
        },
        headers=h,
    )

    # Close with exact expected balance (5000 + 240 = 5240)
    close_resp = await client.post(
        f"/api/v1/pos/sessions/{session['id']}/close",
        json={"closing_balance": "5240"},
        headers=h,
    )
    assert close_resp.status_code == 200
    data = close_resp.json()
    assert data["status"] == "closed"
    assert data["closing_balance"] == "5240"
    # Difference should be 0 or very small
    diff = Decimal(data["difference"])
    assert abs(diff) < Decimal("1")


@pytest.mark.asyncio
async def test_cannot_close_already_closed(client: AsyncClient, superadmin_user):
    """Cannot close a session that is already closed."""
    h = auth_headers(superadmin_user)
    wh = await _create_warehouse(client, h, name="Already Closed WH")
    session = await _open_session(client, h, wh["id"])
    await _close_session(client, h, session["id"])

    resp = await client.post(
        f"/api/v1/pos/sessions/{session['id']}/close",
        json={"closing_balance": "5000"},
        headers=h,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_get_active_session(client: AsyncClient, superadmin_user):
    """GET /api/v1/pos/sessions/active returns the current open session."""
    h = auth_headers(superadmin_user)
    wh = await _create_warehouse(client, h, name="Active Session WH")
    session = await _open_session(client, h, wh["id"])

    resp = await client.get("/api/v1/pos/sessions/active", headers=h)
    assert resp.status_code == 200
    assert resp.json()["id"] == session["id"]

    # Cleanup
    await _close_session(client, h, session["id"])


@pytest.mark.asyncio
async def test_list_sessions(client: AsyncClient, superadmin_user):
    """GET /api/v1/pos/sessions returns session list."""
    h = auth_headers(superadmin_user)

    resp = await client.get("/api/v1/pos/sessions", headers=h)
    assert resp.status_code == 200
    assert "total" in resp.json()
    assert "sessions" in resp.json()


# ── Transactions ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_transaction(client: AsyncClient, superadmin_user):
    """Create a POS sale transaction with proper calculation."""
    h = auth_headers(superadmin_user)
    wh, item, session = await _setup_pos(client, h)

    txn_resp = await client.post(
        "/api/v1/pos/transactions",
        json={
            "customer_name": "Walk-in",
            "lines": [
                {
                    "item_id": item["id"],
                    "quantity": 3,
                    "unit_price": "120",
                    "discount_amount": "10",
                },
            ],
            "discount_amount": "0",
            "tax_amount": "50",
            "payments": [{"payment_method": "cash", "amount": "400"}],
        },
        headers=h,
    )
    assert txn_resp.status_code == 201
    txn = txn_resp.json()
    assert txn["status"] == "completed"
    # subtotal = (120 * 3) - 10 = 350
    assert Decimal(txn["subtotal"]) == Decimal("350")
    # total = 350 - 0 (txn discount) + 50 (tax) = 400
    assert Decimal(txn["total"]) == Decimal("400")
    assert len(txn["lines"]) == 1
    assert len(txn["payments"]) == 1

    # Cleanup
    await _close_session(client, h, session["id"])


@pytest.mark.asyncio
async def test_transaction_requires_session(client: AsyncClient, test_user):
    """Cannot create transaction without an active session."""
    h = auth_headers(test_user)

    resp = await client.post(
        "/api/v1/pos/transactions",
        json={
            "lines": [
                {"item_id": str(uuid.uuid4()), "quantity": 1, "unit_price": "100"},
            ],
            "payments": [{"payment_method": "cash", "amount": "100"}],
        },
        headers=h,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_transaction_insufficient_stock(client: AsyncClient, superadmin_user):
    """Cannot sell more than available stock."""
    h = auth_headers(superadmin_user)
    wh, item, session = await _setup_pos(client, h)

    resp = await client.post(
        "/api/v1/pos/transactions",
        json={
            "lines": [
                {"item_id": item["id"], "quantity": 999, "unit_price": "120"},
            ],
            "payments": [{"payment_method": "cash", "amount": "999999"}],
        },
        headers=h,
    )
    assert resp.status_code == 422

    # Cleanup
    await _close_session(client, h, session["id"])


@pytest.mark.asyncio
async def test_transaction_insufficient_payment(client: AsyncClient, superadmin_user):
    """Payment must cover the total."""
    h = auth_headers(superadmin_user)
    wh, item, session = await _setup_pos(client, h)

    resp = await client.post(
        "/api/v1/pos/transactions",
        json={
            "lines": [
                {"item_id": item["id"], "quantity": 1, "unit_price": "120"},
            ],
            "payments": [{"payment_method": "cash", "amount": "50"}],  # underpay
        },
        headers=h,
    )
    assert resp.status_code == 422

    # Cleanup
    await _close_session(client, h, session["id"])


@pytest.mark.asyncio
async def test_transaction_no_lines(client: AsyncClient, superadmin_user):
    """Cannot create a transaction with no line items."""
    h = auth_headers(superadmin_user)
    wh = await _create_warehouse(client, h, name="No Lines WH")
    session = await _open_session(client, h, wh["id"])

    resp = await client.post(
        "/api/v1/pos/transactions",
        json={
            "lines": [],
            "payments": [{"payment_method": "cash", "amount": "100"}],
        },
        headers=h,
    )
    assert resp.status_code == 422

    # Cleanup
    await _close_session(client, h, session["id"])


@pytest.mark.asyncio
async def test_transaction_no_payments(client: AsyncClient, superadmin_user):
    """Cannot create a transaction with no payments."""
    h = auth_headers(superadmin_user)
    wh, item, session = await _setup_pos(client, h)

    resp = await client.post(
        "/api/v1/pos/transactions",
        json={
            "lines": [
                {"item_id": item["id"], "quantity": 1, "unit_price": "120"},
            ],
            "payments": [],
        },
        headers=h,
    )
    assert resp.status_code == 422

    # Cleanup
    await _close_session(client, h, session["id"])


@pytest.mark.asyncio
async def test_get_transaction_detail(client: AsyncClient, superadmin_user):
    """GET /api/v1/pos/transactions/{id} returns full detail with lines and payments."""
    h = auth_headers(superadmin_user)
    wh, item, session = await _setup_pos(client, h)

    txn_resp = await client.post(
        "/api/v1/pos/transactions",
        json={
            "lines": [
                {"item_id": item["id"], "quantity": 1, "unit_price": "120"},
            ],
            "payments": [{"payment_method": "cash", "amount": "120"}],
        },
        headers=h,
    )
    txn_id = txn_resp.json()["id"]

    detail_resp = await client.get(
        f"/api/v1/pos/transactions/{txn_id}", headers=h
    )
    assert detail_resp.status_code == 200
    data = detail_resp.json()
    assert len(data["lines"]) == 1
    assert len(data["payments"]) == 1

    # Cleanup
    await _close_session(client, h, session["id"])


# ── Refunds ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_refund_transaction(client: AsyncClient, superadmin_user):
    """Refunding a completed transaction restores stock and marks as refunded."""
    h = auth_headers(superadmin_user)
    wh, item, session = await _setup_pos(client, h)

    # Make a sale
    txn_resp = await client.post(
        "/api/v1/pos/transactions",
        json={
            "lines": [
                {"item_id": item["id"], "quantity": 5, "unit_price": "120"},
            ],
            "payments": [{"payment_method": "cash", "amount": "600"}],
        },
        headers=h,
    )
    txn_id = txn_resp.json()["id"]

    # Refund
    refund_resp = await client.post(
        f"/api/v1/pos/transactions/{txn_id}/refund", headers=h
    )
    assert refund_resp.status_code == 200
    assert refund_resp.json()["status"] == "refunded"

    # Cleanup
    await _close_session(client, h, session["id"])


@pytest.mark.asyncio
async def test_cannot_refund_non_completed(client: AsyncClient, superadmin_user):
    """Cannot refund a transaction that is not completed."""
    h = auth_headers(superadmin_user)
    wh, item, session = await _setup_pos(client, h)

    # Make and refund a sale
    txn_resp = await client.post(
        "/api/v1/pos/transactions",
        json={
            "lines": [
                {"item_id": item["id"], "quantity": 1, "unit_price": "120"},
            ],
            "payments": [{"payment_method": "cash", "amount": "120"}],
        },
        headers=h,
    )
    txn_id = txn_resp.json()["id"]
    await client.post(f"/api/v1/pos/transactions/{txn_id}/refund", headers=h)

    # Try refunding again
    resp = await client.post(
        f"/api/v1/pos/transactions/{txn_id}/refund", headers=h
    )
    assert resp.status_code == 409

    # Cleanup
    await _close_session(client, h, session["id"])


# ── Void ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_void_transaction(client: AsyncClient, superadmin_user):
    """Void a completed transaction."""
    h = auth_headers(superadmin_user)
    wh, item, session = await _setup_pos(client, h)

    txn_resp = await client.post(
        "/api/v1/pos/transactions",
        json={
            "lines": [
                {"item_id": item["id"], "quantity": 2, "unit_price": "120"},
            ],
            "payments": [{"payment_method": "cash", "amount": "240"}],
        },
        headers=h,
    )
    txn_id = txn_resp.json()["id"]

    void_resp = await client.post(
        f"/api/v1/pos/transactions/{txn_id}/void", headers=h
    )
    assert void_resp.status_code == 200
    assert void_resp.json()["status"] == "voided"

    # Cleanup
    await _close_session(client, h, session["id"])


# ── Receipt ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_receipt(client: AsyncClient, superadmin_user):
    """GET /api/v1/pos/transactions/{id}/receipt returns receipt data."""
    h = auth_headers(superadmin_user)
    wh, item, session = await _setup_pos(client, h)

    txn_resp = await client.post(
        "/api/v1/pos/transactions",
        json={
            "customer_name": "Receipt Customer",
            "lines": [
                {"item_id": item["id"], "quantity": 1, "unit_price": "120"},
            ],
            "payments": [{"payment_method": "cash", "amount": "120"}],
        },
        headers=h,
    )
    txn_id = txn_resp.json()["id"]

    receipt_resp = await client.get(
        f"/api/v1/pos/transactions/{txn_id}/receipt", headers=h
    )
    assert receipt_resp.status_code == 200
    data = receipt_resp.json()
    assert "transaction_number" in data
    assert "lines" in data
    assert "payments" in data
    assert "total" in data
    assert data["customer_name"] == "Receipt Customer"

    # Cleanup
    await _close_session(client, h, session["id"])


# ── Cash Reconciliation ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_session_reconciliation(client: AsyncClient, superadmin_user):
    """GET /api/v1/pos/sessions/{id}/reconciliation returns summary."""
    h = auth_headers(superadmin_user)
    wh, item, session = await _setup_pos(client, h)

    # Make a sale
    await client.post(
        "/api/v1/pos/transactions",
        json={
            "lines": [
                {"item_id": item["id"], "quantity": 2, "unit_price": "120"},
            ],
            "payments": [{"payment_method": "cash", "amount": "240"}],
        },
        headers=h,
    )

    recon_resp = await client.get(
        f"/api/v1/pos/sessions/{session['id']}/reconciliation", headers=h
    )
    assert recon_resp.status_code == 200
    data = recon_resp.json()
    assert "session" in data
    assert "total_sales" in data
    assert "payment_methods" in data
    assert "transaction_counts" in data

    # Cleanup
    await _close_session(client, h, session["id"])


# ── Session Export ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_session_export(client: AsyncClient, superadmin_user):
    """GET /api/v1/pos/sessions/{id}/export returns CSV."""
    h = auth_headers(superadmin_user)
    wh = await _create_warehouse(client, h, name="Export WH")
    session = await _open_session(client, h, wh["id"])

    resp = await client.get(
        f"/api/v1/pos/sessions/{session['id']}/export", headers=h
    )
    assert resp.status_code == 200
    assert "text/csv" in resp.headers.get("content-type", "")

    # Cleanup
    await _close_session(client, h, session["id"])


# ── Dashboard ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_pos_dashboard(client: AsyncClient, test_user):
    """GET /api/v1/pos/dashboard/stats returns today's summary."""
    resp = await client.get(
        "/api/v1/pos/dashboard/stats",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "today_sales_total" in data
    assert "today_sales_count" in data
    assert "today_avg_sale" in data
    assert "top_products" in data


# ── Auth Required ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_pos_requires_auth(client: AsyncClient):
    """POS endpoints require authentication."""
    resp = await client.get("/api/v1/pos/sessions")
    assert resp.status_code in (401, 403)
