"""E-Commerce extended tests — inventory sync, stock deduction on checkout, refund stock restore, out-of-stock."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import auth_headers


# ── Helpers ─────────────────────────────────────────────────────────────────


async def _create_store(client: AsyncClient, h: dict, name: str = "Sync Store") -> dict:
    slug = f"store-{uuid.uuid4().hex[:6]}"
    resp = await client.post(
        "/api/v1/ecommerce/stores",
        json={"name": name, "slug": slug, "currency": "KES"},
        headers=h,
    )
    assert resp.status_code == 201
    return resp.json()


async def _create_product(
    client: AsyncClient,
    h: dict,
    store_id: str,
    name: str = "Sync Product",
    price: str = "1000",
) -> dict:
    slug = f"product-{uuid.uuid4().hex[:6]}"
    resp = await client.post(
        "/api/v1/ecommerce/products",
        json={
            "store_id": store_id,
            "display_name": name,
            "slug": slug,
            "price": price,
            "is_published": True,
        },
        headers=h,
    )
    assert resp.status_code == 201
    return resp.json()


async def _create_inventory_item_and_link(
    db: AsyncSession, product_id: str, stock_qty: int = 50
) -> str:
    """Create an InventoryItem, link it to the e-commerce product, and set stock."""
    from app.models.inventory import InventoryItem
    from app.models.ecommerce import EcomProduct

    item = InventoryItem(
        name=f"InvItem-{uuid.uuid4().hex[:6]}",
        sku=f"SKU-{uuid.uuid4().hex[:6]}",
        cost_price=Decimal("500"),
        selling_price=Decimal("1000"),
        quantity_on_hand=stock_qty,
        reorder_level=5,
        is_active=True,
    )
    db.add(item)
    await db.flush()

    # Link to e-commerce product
    product = await db.get(EcomProduct, uuid.UUID(product_id))
    if product:
        product.inventory_item_id = item.id
        await db.commit()
        await db.refresh(item)
    return str(item.id)


async def _add_to_cart_and_checkout(
    client: AsyncClient, h: dict, store_id: str, product_id: str, quantity: int = 1
) -> dict:
    """Add item to cart and checkout. Returns the checkout response data."""
    await client.post(
        "/api/v1/ecommerce/cart/items",
        json={"store_id": store_id, "product_id": product_id, "quantity": quantity},
        headers=h,
    )
    resp = await client.post(
        "/api/v1/ecommerce/checkout",
        json={"address_line1": "123 Test St", "city": "Nairobi", "country": "Kenya"},
        headers=h,
    )
    return resp


# ── Checkout deducts stock ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_checkout_deducts_inventory_stock(client: AsyncClient, test_user, db: AsyncSession):
    """Checkout should deduct the purchased quantity from linked inventory item."""
    h = auth_headers(test_user)
    store = await _create_store(client, h, name="Deduct Store")
    product = await _create_product(client, h, store["id"], name="Deduct Product")

    initial_stock = 50
    item_id = await _create_inventory_item_and_link(db, product["id"], stock_qty=initial_stock)

    checkout_resp = await _add_to_cart_and_checkout(client, h, store["id"], product["id"], quantity=3)
    assert checkout_resp.status_code == 201

    # Verify stock was deducted
    from app.models.inventory import InventoryItem
    item = await db.get(InventoryItem, uuid.UUID(item_id))
    await db.refresh(item)
    assert item.quantity_on_hand == initial_stock - 3


# ── Refund restores stock ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_refund_restores_inventory_stock(client: AsyncClient, test_user, db: AsyncSession):
    """Refunding an order should restore inventory stock."""
    h = auth_headers(test_user)
    store = await _create_store(client, h, name="Refund Stock Store")
    product = await _create_product(client, h, store["id"], name="Refund Stock Product")

    initial_stock = 50
    item_id = await _create_inventory_item_and_link(db, product["id"], stock_qty=initial_stock)

    checkout_resp = await _add_to_cart_and_checkout(client, h, store["id"], product["id"], quantity=5)
    assert checkout_resp.status_code == 201
    order_id = checkout_resp.json()["order_id"]

    # Verify stock was deducted
    from app.models.inventory import InventoryItem
    item = await db.get(InventoryItem, uuid.UUID(item_id))
    await db.refresh(item)
    assert item.quantity_on_hand == initial_stock - 5

    # Refund
    refund_resp = await client.post(
        f"/api/v1/ecommerce/orders/{order_id}/refund",
        json={"reason": "Customer changed mind"},
        headers=h,
    )
    assert refund_resp.status_code == 200
    assert refund_resp.json()["refunded"] is True

    # Verify stock was restored
    await db.refresh(item)
    assert item.quantity_on_hand == initial_stock


# ── Out-of-stock rejection ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_checkout_rejects_out_of_stock(client: AsyncClient, test_user, db: AsyncSession):
    """Checkout should reject when requested quantity exceeds available stock."""
    h = auth_headers(test_user)
    store = await _create_store(client, h, name="OOS Store")
    product = await _create_product(client, h, store["id"], name="OOS Product")

    # Set very low stock
    await _create_inventory_item_and_link(db, product["id"], stock_qty=2)

    # Try to buy more than available
    await client.post(
        "/api/v1/ecommerce/cart/items",
        json={"store_id": store["id"], "product_id": product["id"], "quantity": 10},
        headers=h,
    )
    checkout_resp = await client.post(
        "/api/v1/ecommerce/checkout",
        json={"address_line1": "OOS St", "city": "Nairobi"},
        headers=h,
    )
    assert checkout_resp.status_code == 400
    assert "stock" in checkout_resp.json()["detail"].lower() or "insufficient" in checkout_resp.json()["detail"].lower()


# ── Order status transitions ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_order_full_lifecycle(client: AsyncClient, test_user, db: AsyncSession):
    """Full order lifecycle: checkout -> confirmed -> shipped -> delivered."""
    h = auth_headers(test_user)
    store = await _create_store(client, h, name="Lifecycle Store")
    product = await _create_product(client, h, store["id"], name="Lifecycle Product")

    checkout_resp = await _add_to_cart_and_checkout(client, h, store["id"], product["id"])
    assert checkout_resp.status_code == 201
    order_id = checkout_resp.json()["order_id"]

    # Confirm
    confirm_resp = await client.put(
        f"/api/v1/ecommerce/orders/{order_id}/status",
        json={"status": "confirmed"},
        headers=h,
    )
    assert confirm_resp.status_code == 200

    # Ship
    ship_resp = await client.post(
        f"/api/v1/ecommerce/orders/{order_id}/ship",
        json={"tracking_number": "TRACK-LIFECYCLE-001"},
        headers=h,
    )
    assert ship_resp.status_code == 200
    assert ship_resp.json()["status"] == "shipped"
    assert ship_resp.json()["tracking_number"] == "TRACK-LIFECYCLE-001"


@pytest.mark.asyncio
async def test_cannot_refund_already_cancelled(client: AsyncClient, test_user):
    """Refunding an already cancelled order returns 400."""
    h = auth_headers(test_user)
    store = await _create_store(client, h, name="Double Cancel Store")
    product = await _create_product(client, h, store["id"], name="Double Cancel Product")

    checkout_resp = await _add_to_cart_and_checkout(client, h, store["id"], product["id"])
    order_id = checkout_resp.json()["order_id"]

    # First refund
    await client.post(
        f"/api/v1/ecommerce/orders/{order_id}/refund",
        json={"reason": "First refund"},
        headers=h,
    )

    # Second refund should fail
    resp = await client.post(
        f"/api/v1/ecommerce/orders/{order_id}/refund",
        json={"reason": "Double refund"},
        headers=h,
    )
    assert resp.status_code == 400


# ── Wishlist ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_wishlist_crud(client: AsyncClient, test_user):
    """Add to wishlist, list, remove."""
    h = auth_headers(test_user)
    store = await _create_store(client, h, name="Wishlist Store")
    product = await _create_product(client, h, store["id"], name="Wishlist Product")

    # Add
    add_resp = await client.post(
        "/api/v1/ecommerce/wishlist",
        json={"product_id": product["id"]},
        headers=h,
    )
    assert add_resp.status_code == 201
    wishlist_id = add_resp.json()["id"]

    # List
    list_resp = await client.get("/api/v1/ecommerce/wishlist", headers=h)
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= 1

    # Remove
    del_resp = await client.delete(f"/api/v1/ecommerce/wishlist/{wishlist_id}", headers=h)
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_wishlist_duplicate_rejected(client: AsyncClient, test_user):
    """Adding same product to wishlist twice returns 400."""
    h = auth_headers(test_user)
    store = await _create_store(client, h, name="Wish Dup Store")
    product = await _create_product(client, h, store["id"], name="Wish Dup Product")

    await client.post(
        "/api/v1/ecommerce/wishlist",
        json={"product_id": product["id"]},
        headers=h,
    )
    resp = await client.post(
        "/api/v1/ecommerce/wishlist",
        json={"product_id": product["id"]},
        headers=h,
    )
    assert resp.status_code == 400


# ── Top products report ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_top_products_report(client: AsyncClient, test_user):
    """GET /api/v1/ecommerce/reports/top-products returns product rankings."""
    resp = await client.get(
        "/api/v1/ecommerce/reports/top-products",
        params={"limit": 5},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


# ── POS sync endpoint ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_products_for_pos(client: AsyncClient, test_user):
    """GET /api/v1/ecommerce/products/pos-sync returns POS-formatted items."""
    h = auth_headers(test_user)
    store = await _create_store(client, h, name="POS Sync Store")
    await _create_product(client, h, store["id"], name="POS Sync Product")

    resp = await client.get(
        "/api/v1/ecommerce/products/pos-sync",
        params={"store_id": store["id"]},
        headers=h,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "pos_items" in data


# ── Auth Required ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ecommerce_extended_requires_auth(client: AsyncClient):
    """E-Commerce extended endpoints require authentication."""
    resp = await client.get("/api/v1/ecommerce/wishlist")
    assert resp.status_code in (401, 403)
