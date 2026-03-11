"""E-Commerce tests — stores, products, orders, cart/checkout, coupons, reviews, dashboard."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


# ── Helpers ─────────────────────────────────────────────────────────────────


async def _create_store(client: AsyncClient, h: dict, name: str = "Test Store") -> dict:
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
    name: str = "Sample Product",
    price: str = "1500",
    published: bool = True,
) -> dict:
    slug = f"product-{uuid.uuid4().hex[:6]}"
    resp = await client.post(
        "/api/v1/ecommerce/products",
        json={
            "store_id": store_id,
            "display_name": name,
            "slug": slug,
            "price": price,
            "is_published": published,
        },
        headers=h,
    )
    assert resp.status_code == 201
    return resp.json()


# ── Store CRUD ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_store_crud(client: AsyncClient, test_user):
    """Create, read, update a store."""
    h = auth_headers(test_user)

    store = await _create_store(client, h, name="My Shop")
    assert store["currency"] == "KES"

    # Read
    get_resp = await client.get(
        f"/api/v1/ecommerce/stores/{store['id']}", headers=h
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "My Shop"

    # Update
    update_resp = await client.put(
        f"/api/v1/ecommerce/stores/{store['id']}",
        json={"name": "My Updated Shop"},
        headers=h,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "My Updated Shop"


@pytest.mark.asyncio
async def test_list_stores(client: AsyncClient, test_user):
    """GET /api/v1/ecommerce/stores returns a list."""
    h = auth_headers(test_user)
    await _create_store(client, h, name="List Store")

    resp = await client.get("/api/v1/ecommerce/stores", headers=h)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


# ── Product CRUD ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_product_crud(client: AsyncClient, test_user):
    """Create, read, update, delete a product."""
    h = auth_headers(test_user)
    store = await _create_store(client, h)
    product = await _create_product(client, h, store["id"], name="CRUD Product")

    # Read
    get_resp = await client.get(
        f"/api/v1/ecommerce/products/{product['id']}", headers=h
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["display_name"] == "CRUD Product"

    # Update
    update_resp = await client.put(
        f"/api/v1/ecommerce/products/{product['id']}",
        json={"display_name": "Updated Product", "price": "2000"},
        headers=h,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["display_name"] == "Updated Product"

    # Delete
    del_resp = await client.delete(
        f"/api/v1/ecommerce/products/{product['id']}", headers=h
    )
    assert del_resp.status_code == 204

    # Verify deleted
    get2 = await client.get(
        f"/api/v1/ecommerce/products/{product['id']}", headers=h
    )
    assert get2.status_code == 404


@pytest.mark.asyncio
async def test_list_products_with_filter(client: AsyncClient, test_user):
    """GET /api/v1/ecommerce/products with search filter."""
    h = auth_headers(test_user)
    store = await _create_store(client, h)
    await _create_product(client, h, store["id"], name="Searchable Widget")

    resp = await client.get(
        "/api/v1/ecommerce/products",
        params={"search": "Searchable", "store_id": store["id"]},
        headers=h,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


@pytest.mark.asyncio
async def test_product_not_found(client: AsyncClient, test_user):
    """GET nonexistent product returns 404."""
    resp = await client.get(
        f"/api/v1/ecommerce/products/{uuid.uuid4()}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


# ── Order Status Lifecycle ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_order_status_update(client: AsyncClient, test_user):
    """Create an order via checkout then update its status through lifecycle."""
    h = auth_headers(test_user)
    store = await _create_store(client, h)
    product = await _create_product(client, h, store["id"], name="Order Product")

    # Add to cart
    cart_resp = await client.post(
        "/api/v1/ecommerce/cart/items",
        json={
            "store_id": store["id"],
            "product_id": product["id"],
            "quantity": 2,
        },
        headers=h,
    )
    assert cart_resp.status_code == 201

    # Checkout
    checkout_resp = await client.post(
        "/api/v1/ecommerce/checkout",
        json={
            "address_line1": "123 Test St",
            "city": "Nairobi",
            "country": "Kenya",
        },
        headers=h,
    )
    assert checkout_resp.status_code == 201
    order_id = checkout_resp.json()["order_id"]

    # Confirm order
    status_resp = await client.put(
        f"/api/v1/ecommerce/orders/{order_id}/status",
        json={"status": "confirmed"},
        headers=h,
    )
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "confirmed"


@pytest.mark.asyncio
async def test_order_invalid_status(client: AsyncClient, test_user):
    """Updating order to an invalid status returns 400."""
    h = auth_headers(test_user)
    store = await _create_store(client, h)
    product = await _create_product(client, h, store["id"], name="Invalid Status Product")

    # Add to cart and checkout
    await client.post(
        "/api/v1/ecommerce/cart/items",
        json={"store_id": store["id"], "product_id": product["id"], "quantity": 1},
        headers=h,
    )
    checkout_resp = await client.post(
        "/api/v1/ecommerce/checkout",
        json={"address_line1": "456 Test Ave", "city": "Nairobi"},
        headers=h,
    )
    order_id = checkout_resp.json()["order_id"]

    resp = await client.put(
        f"/api/v1/ecommerce/orders/{order_id}/status",
        json={"status": "invalid_status"},
        headers=h,
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_ship_order(client: AsyncClient, test_user):
    """POST /api/v1/ecommerce/orders/{id}/ship marks order as shipped."""
    h = auth_headers(test_user)
    store = await _create_store(client, h)
    product = await _create_product(client, h, store["id"], name="Ship Product")

    await client.post(
        "/api/v1/ecommerce/cart/items",
        json={"store_id": store["id"], "product_id": product["id"], "quantity": 1},
        headers=h,
    )
    checkout_resp = await client.post(
        "/api/v1/ecommerce/checkout",
        json={"address_line1": "789 Ship St", "city": "Nairobi"},
        headers=h,
    )
    order_id = checkout_resp.json()["order_id"]

    ship_resp = await client.post(
        f"/api/v1/ecommerce/orders/{order_id}/ship",
        json={"tracking_number": "TRACK-12345"},
        headers=h,
    )
    assert ship_resp.status_code == 200
    assert ship_resp.json()["status"] == "shipped"
    assert ship_resp.json()["tracking_number"] == "TRACK-12345"


@pytest.mark.asyncio
async def test_refund_order(client: AsyncClient, test_user):
    """POST /api/v1/ecommerce/orders/{id}/refund cancels and refunds."""
    h = auth_headers(test_user)
    store = await _create_store(client, h)
    product = await _create_product(client, h, store["id"], name="Refund Product")

    await client.post(
        "/api/v1/ecommerce/cart/items",
        json={"store_id": store["id"], "product_id": product["id"], "quantity": 1},
        headers=h,
    )
    checkout_resp = await client.post(
        "/api/v1/ecommerce/checkout",
        json={"address_line1": "Refund Ave", "city": "Nairobi"},
        headers=h,
    )
    order_id = checkout_resp.json()["order_id"]

    refund_resp = await client.post(
        f"/api/v1/ecommerce/orders/{order_id}/refund",
        json={"reason": "Customer changed mind"},
        headers=h,
    )
    assert refund_resp.status_code == 200
    assert refund_resp.json()["status"] == "cancelled"
    assert refund_resp.json()["refunded"] is True


# ── Cart + Checkout Flow ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cart_add_update_remove(client: AsyncClient, test_user):
    """Add item to cart, update quantity, remove item."""
    h = auth_headers(test_user)
    store = await _create_store(client, h)
    product = await _create_product(client, h, store["id"], name="Cart Product")

    # Add
    add_resp = await client.post(
        "/api/v1/ecommerce/cart/items",
        json={
            "store_id": store["id"],
            "product_id": product["id"],
            "quantity": 3,
        },
        headers=h,
    )
    assert add_resp.status_code == 201
    cart = add_resp.json()
    assert len(cart["items"]) >= 1

    cart_item_id = cart["items"][-1]["id"]

    # Update quantity
    update_resp = await client.put(
        f"/api/v1/ecommerce/cart/items/{cart_item_id}",
        json={"quantity": 5},
        headers=h,
    )
    assert update_resp.status_code == 200

    # Remove
    remove_resp = await client.delete(
        f"/api/v1/ecommerce/cart/items/{cart_item_id}", headers=h
    )
    assert remove_resp.status_code == 204


@pytest.mark.asyncio
async def test_checkout_empty_cart(client: AsyncClient, test_user):
    """Checkout with empty cart returns 400."""
    h = auth_headers(test_user)

    # Attempt checkout without adding items
    resp = await client.post(
        "/api/v1/ecommerce/checkout",
        json={"address_line1": "Empty Cart St", "city": "Nairobi"},
        headers=h,
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_checkout_calculates_tax(client: AsyncClient, test_user):
    """Checkout applies 16% VAT to subtotal."""
    h = auth_headers(test_user)
    store = await _create_store(client, h)
    product = await _create_product(
        client, h, store["id"], name="Tax Product", price="1000"
    )

    await client.post(
        "/api/v1/ecommerce/cart/items",
        json={"store_id": store["id"], "product_id": product["id"], "quantity": 1},
        headers=h,
    )
    checkout_resp = await client.post(
        "/api/v1/ecommerce/checkout",
        json={"address_line1": "Tax St", "city": "Nairobi"},
        headers=h,
    )
    assert checkout_resp.status_code == 201
    data = checkout_resp.json()
    # Tax should be 16% of subtotal
    subtotal = data["subtotal"]
    tax = data["tax"]
    expected_tax = subtotal * 0.16
    assert abs(tax - expected_tax) < 0.01


# ── Coupons ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_coupon_crud(client: AsyncClient, test_user):
    """Create, list, update, delete a coupon."""
    h = auth_headers(test_user)
    now = datetime.now(timezone.utc)
    code = f"SAVE-{uuid.uuid4().hex[:6]}"

    # Create
    create_resp = await client.post(
        "/api/v1/ecommerce/coupons",
        json={
            "code": code,
            "coupon_type": "percentage",
            "value": "10",
            "min_order": "500",
            "valid_from": (now - timedelta(days=1)).isoformat(),
            "valid_to": (now + timedelta(days=30)).isoformat(),
            "usage_limit": 100,
        },
        headers=h,
    )
    assert create_resp.status_code == 201
    coupon_id = create_resp.json()["id"]

    # List
    list_resp = await client.get("/api/v1/ecommerce/coupons", headers=h)
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= 1

    # Update
    update_resp = await client.put(
        f"/api/v1/ecommerce/coupons/{coupon_id}",
        json={"value": "15"},
        headers=h,
    )
    assert update_resp.status_code == 200

    # Delete
    del_resp = await client.delete(
        f"/api/v1/ecommerce/coupons/{coupon_id}", headers=h
    )
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_coupon_validate_valid(client: AsyncClient, test_user):
    """Validate a valid coupon returns discount info."""
    h = auth_headers(test_user)
    now = datetime.now(timezone.utc)
    code = f"VALID-{uuid.uuid4().hex[:6]}"

    await client.post(
        "/api/v1/ecommerce/coupons",
        json={
            "code": code,
            "coupon_type": "percentage",
            "value": "20",
            "min_order": "100",
            "valid_from": (now - timedelta(days=1)).isoformat(),
            "valid_to": (now + timedelta(days=30)).isoformat(),
        },
        headers=h,
    )

    validate_resp = await client.post(
        "/api/v1/ecommerce/coupons/validate",
        json={"code": code, "order_total": "500"},
        headers=h,
    )
    assert validate_resp.status_code == 200
    data = validate_resp.json()
    assert data["valid"] is True
    assert data["discount"] == 100.0  # 20% of 500


@pytest.mark.asyncio
async def test_coupon_validate_expired(client: AsyncClient, test_user):
    """Validate an expired coupon returns valid=false."""
    h = auth_headers(test_user)
    now = datetime.now(timezone.utc)
    code = f"EXPIRED-{uuid.uuid4().hex[:6]}"

    await client.post(
        "/api/v1/ecommerce/coupons",
        json={
            "code": code,
            "coupon_type": "fixed",
            "value": "50",
            "valid_from": (now - timedelta(days=30)).isoformat(),
            "valid_to": (now - timedelta(days=1)).isoformat(),  # expired yesterday
        },
        headers=h,
    )

    validate_resp = await client.post(
        "/api/v1/ecommerce/coupons/validate",
        json={"code": code, "order_total": "500"},
        headers=h,
    )
    assert validate_resp.status_code == 200
    data = validate_resp.json()
    assert data["valid"] is False
    assert "expired" in data["reason"].lower()


@pytest.mark.asyncio
async def test_coupon_validate_min_order(client: AsyncClient, test_user):
    """Validate coupon with order below min_order returns valid=false."""
    h = auth_headers(test_user)
    now = datetime.now(timezone.utc)
    code = f"MINORD-{uuid.uuid4().hex[:6]}"

    await client.post(
        "/api/v1/ecommerce/coupons",
        json={
            "code": code,
            "coupon_type": "fixed",
            "value": "100",
            "min_order": "1000",
            "valid_from": (now - timedelta(days=1)).isoformat(),
            "valid_to": (now + timedelta(days=30)).isoformat(),
        },
        headers=h,
    )

    validate_resp = await client.post(
        "/api/v1/ecommerce/coupons/validate",
        json={"code": code, "order_total": "500"},  # below 1000
        headers=h,
    )
    assert validate_resp.status_code == 200
    data = validate_resp.json()
    assert data["valid"] is False
    assert "minimum" in data["reason"].lower()


@pytest.mark.asyncio
async def test_coupon_duplicate_code_rejected(client: AsyncClient, test_user):
    """Cannot create two coupons with the same code."""
    h = auth_headers(test_user)
    now = datetime.now(timezone.utc)
    code = f"DUPE-{uuid.uuid4().hex[:6]}"
    coupon_data = {
        "code": code,
        "coupon_type": "fixed",
        "value": "50",
        "valid_from": now.isoformat(),
        "valid_to": (now + timedelta(days=30)).isoformat(),
    }

    resp1 = await client.post("/api/v1/ecommerce/coupons", json=coupon_data, headers=h)
    assert resp1.status_code == 201

    resp2 = await client.post("/api/v1/ecommerce/coupons", json=coupon_data, headers=h)
    assert resp2.status_code == 400


# ── Reviews ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_product_review(client: AsyncClient, test_user):
    """Create a review for a product."""
    h = auth_headers(test_user)
    store = await _create_store(client, h)
    product = await _create_product(client, h, store["id"], name="Review Product")

    review_resp = await client.post(
        f"/api/v1/ecommerce/products/{product['id']}/reviews",
        json={"rating": 5, "comment": "Excellent product!"},
        headers=h,
    )
    assert review_resp.status_code == 201
    assert review_resp.json()["rating"] == 5


@pytest.mark.asyncio
async def test_cannot_review_twice(client: AsyncClient, test_user):
    """Cannot review the same product twice."""
    h = auth_headers(test_user)
    store = await _create_store(client, h)
    product = await _create_product(client, h, store["id"], name="Double Review Product")

    await client.post(
        f"/api/v1/ecommerce/products/{product['id']}/reviews",
        json={"rating": 4, "comment": "Good"},
        headers=h,
    )

    resp = await client.post(
        f"/api/v1/ecommerce/products/{product['id']}/reviews",
        json={"rating": 3, "comment": "Changed my mind"},
        headers=h,
    )
    assert resp.status_code == 400


# ── Shipping Methods ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_shipping_method_crud(client: AsyncClient, test_user):
    """Create, list, update, delete a shipping method."""
    h = auth_headers(test_user)

    create_resp = await client.post(
        "/api/v1/ecommerce/shipping-methods",
        json={"name": "Standard", "price": "250", "estimated_days": 5},
        headers=h,
    )
    assert create_resp.status_code == 201
    method_id = create_resp.json()["id"]

    list_resp = await client.get("/api/v1/ecommerce/shipping-methods", headers=h)
    assert list_resp.status_code == 200

    update_resp = await client.put(
        f"/api/v1/ecommerce/shipping-methods/{method_id}",
        json={"name": "Express", "price": "500"},
        headers=h,
    )
    assert update_resp.status_code == 200

    del_resp = await client.delete(
        f"/api/v1/ecommerce/shipping-methods/{method_id}", headers=h
    )
    assert del_resp.status_code == 204


# ── Dashboard + Reports ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ecommerce_dashboard(client: AsyncClient, test_user):
    """GET /api/v1/ecommerce/dashboard returns stats."""
    resp = await client.get(
        "/api/v1/ecommerce/dashboard",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "total_orders" in data
    assert "total_revenue" in data
    assert "total_products" in data
    assert "total_customers" in data


@pytest.mark.asyncio
async def test_sales_report(client: AsyncClient, test_user):
    """GET /api/v1/ecommerce/reports/sales returns grouped data."""
    resp = await client.get(
        "/api/v1/ecommerce/reports/sales",
        params={"group_by": "day"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "total_orders" in data
    assert "total_revenue" in data
    assert "data" in data


@pytest.mark.asyncio
async def test_conversion_funnel(client: AsyncClient, test_user):
    """GET /api/v1/ecommerce/reports/conversion-funnel returns funnel metrics."""
    resp = await client.get(
        "/api/v1/ecommerce/reports/conversion-funnel",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "total_carts" in data
    assert "total_orders" in data
    assert "cart_to_checkout_rate" in data


# ── Auth Required ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ecommerce_requires_auth(client: AsyncClient):
    """E-Commerce admin endpoints require authentication."""
    resp = await client.get("/api/v1/ecommerce/products")
    assert resp.status_code in (401, 403)
