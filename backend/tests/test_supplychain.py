"""Integration tests for the Supply Chain API."""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


# ── Suppliers ────────────────────────────────────────────────────────────────


async def test_list_suppliers(client: AsyncClient, test_user):
    """GET /api/v1/supply-chain/suppliers returns supplier list."""
    resp = await client.get(
        "/api/v1/supply-chain/suppliers",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "suppliers" in data


async def test_create_supplier(client: AsyncClient, superadmin_user):
    """POST /api/v1/supply-chain/suppliers creates a supplier (admin only)."""
    resp = await client.post(
        "/api/v1/supply-chain/suppliers",
        json={
            "name": "Acme Widgets",
            "contact_name": "Alice",
            "email": "alice@acme.com",
            "phone": "+1-555-0100",
            "payment_terms_days": 45,
        },
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Acme Widgets"
    assert data["code"].startswith("SUP-")
    assert data["payment_terms_days"] == 45


async def test_get_supplier_detail(client: AsyncClient, superadmin_user):
    """GET /api/v1/supply-chain/suppliers/{id} returns supplier detail."""
    create = await client.post(
        "/api/v1/supply-chain/suppliers",
        json={"name": "Detail Supplier"},
        headers=auth_headers(superadmin_user),
    )
    supplier_id = create.json()["id"]
    resp = await client.get(
        f"/api/v1/supply-chain/suppliers/{supplier_id}",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == supplier_id


async def test_get_supplier_not_found(client: AsyncClient, test_user):
    """GET /api/v1/supply-chain/suppliers/{bad_id} returns 404."""
    resp = await client.get(
        f"/api/v1/supply-chain/suppliers/{uuid.uuid4()}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 404


async def test_update_supplier(client: AsyncClient, superadmin_user):
    """PUT /api/v1/supply-chain/suppliers/{id} updates supplier fields."""
    create = await client.post(
        "/api/v1/supply-chain/suppliers",
        json={"name": "Before Update"},
        headers=auth_headers(superadmin_user),
    )
    supplier_id = create.json()["id"]
    resp = await client.put(
        f"/api/v1/supply-chain/suppliers/{supplier_id}",
        json={"name": "After Update", "rating": 5},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "After Update"
    assert resp.json()["rating"] == 5


async def test_delete_supplier_soft(client: AsyncClient, superadmin_user):
    """DELETE /api/v1/supply-chain/suppliers/{id} soft-deletes (sets is_active=False)."""
    create = await client.post(
        "/api/v1/supply-chain/suppliers",
        json={"name": "To Delete"},
        headers=auth_headers(superadmin_user),
    )
    supplier_id = create.json()["id"]
    resp = await client.delete(
        f"/api/v1/supply-chain/suppliers/{supplier_id}",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 204

    # Verify it's now inactive
    detail = await client.get(
        f"/api/v1/supply-chain/suppliers/{supplier_id}",
        headers=auth_headers(superadmin_user),
    )
    assert detail.json()["is_active"] is False


async def test_search_suppliers(client: AsyncClient, superadmin_user):
    """GET /api/v1/supply-chain/suppliers?search= filters by name."""
    await client.post(
        "/api/v1/supply-chain/suppliers",
        json={"name": "UniqueSearchTerm123"},
        headers=auth_headers(superadmin_user),
    )
    resp = await client.get(
        "/api/v1/supply-chain/suppliers?search=UniqueSearchTerm123",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


# ── Requisitions ─────────────────────────────────────────────────────────────


async def _create_requisition(client: AsyncClient, headers: dict) -> dict:
    """Helper: create a requisition with a dummy item_id."""
    resp = await client.post(
        "/api/v1/supply-chain/requisitions",
        json={
            "title": "Office Supplies",
            "priority": "high",
            "lines": [
                {
                    "item_id": str(uuid.uuid4()),
                    "quantity": 10,
                    "estimated_unit_price": "25.00",
                }
            ],
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


async def test_create_requisition(client: AsyncClient, superadmin_user):
    """POST /api/v1/supply-chain/requisitions creates a requisition."""
    data = await _create_requisition(client, auth_headers(superadmin_user))
    assert data["requisition_number"].startswith("REQ-")
    assert data["status"] == "draft"
    assert len(data["lines"]) == 1
    assert data["total_estimated"] == "250.00"


async def test_create_requisition_empty_lines_rejected(client: AsyncClient, superadmin_user):
    """POST /api/v1/supply-chain/requisitions with empty lines → 422."""
    resp = await client.post(
        "/api/v1/supply-chain/requisitions",
        json={"title": "Bad Req", "lines": []},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 422


async def test_list_requisitions(client: AsyncClient, superadmin_user):
    """GET /api/v1/supply-chain/requisitions lists requisitions."""
    await _create_requisition(client, auth_headers(superadmin_user))
    resp = await client.get(
        "/api/v1/supply-chain/requisitions",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


async def test_get_requisition_detail(client: AsyncClient, superadmin_user):
    """GET /api/v1/supply-chain/requisitions/{id} returns full detail."""
    created = await _create_requisition(client, auth_headers(superadmin_user))
    resp = await client.get(
        f"/api/v1/supply-chain/requisitions/{created['id']}",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200
    assert "lines" in resp.json()


async def test_update_draft_requisition(client: AsyncClient, superadmin_user):
    """PUT /api/v1/supply-chain/requisitions/{id} updates a draft requisition."""
    created = await _create_requisition(client, auth_headers(superadmin_user))
    resp = await client.put(
        f"/api/v1/supply-chain/requisitions/{created['id']}",
        json={"title": "Updated Title", "priority": "low"},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated Title"


# ── Requisition lifecycle: draft → submitted → approved ─────────────────────


async def test_requisition_submit(client: AsyncClient, superadmin_user):
    """POST .../submit changes status from draft to submitted."""
    created = await _create_requisition(client, auth_headers(superadmin_user))
    resp = await client.post(
        f"/api/v1/supply-chain/requisitions/{created['id']}/submit",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "submitted"


async def test_requisition_submit_rejects_non_draft(client: AsyncClient, superadmin_user):
    """Submitting a non-draft requisition fails with 409."""
    created = await _create_requisition(client, auth_headers(superadmin_user))
    # Submit once
    await client.post(
        f"/api/v1/supply-chain/requisitions/{created['id']}/submit",
        headers=auth_headers(superadmin_user),
    )
    # Submit again should fail
    resp = await client.post(
        f"/api/v1/supply-chain/requisitions/{created['id']}/submit",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 409


async def test_requisition_approve(client: AsyncClient, superadmin_user):
    """POST .../approve?action=approve transitions submitted → approved."""
    created = await _create_requisition(client, auth_headers(superadmin_user))
    await client.post(
        f"/api/v1/supply-chain/requisitions/{created['id']}/submit",
        headers=auth_headers(superadmin_user),
    )
    resp = await client.post(
        f"/api/v1/supply-chain/requisitions/{created['id']}/approve?action=approve",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"
    assert resp.json()["approved_by"] is not None


async def test_requisition_reject(client: AsyncClient, superadmin_user):
    """POST .../approve?action=reject transitions submitted → rejected."""
    created = await _create_requisition(client, auth_headers(superadmin_user))
    await client.post(
        f"/api/v1/supply-chain/requisitions/{created['id']}/submit",
        headers=auth_headers(superadmin_user),
    )
    resp = await client.post(
        f"/api/v1/supply-chain/requisitions/{created['id']}/approve?action=reject",
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"


async def test_update_non_draft_requisition_fails(client: AsyncClient, superadmin_user):
    """PUT on a submitted requisition returns 409."""
    created = await _create_requisition(client, auth_headers(superadmin_user))
    await client.post(
        f"/api/v1/supply-chain/requisitions/{created['id']}/submit",
        headers=auth_headers(superadmin_user),
    )
    resp = await client.put(
        f"/api/v1/supply-chain/requisitions/{created['id']}",
        json={"title": "Should Fail"},
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 409


# ── GRN ──────────────────────────────────────────────────────────────────────


async def test_list_grns(client: AsyncClient, test_user):
    """GET /api/v1/supply-chain/grn returns GRN list."""
    resp = await client.get(
        "/api/v1/supply-chain/grn",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert "grns" in resp.json()


async def test_create_grn_missing_po_returns_404(client: AsyncClient, superadmin_user):
    """POST /api/v1/supply-chain/grn with invalid PO → 404."""
    resp = await client.post(
        "/api/v1/supply-chain/grn",
        json={
            "purchase_order_id": str(uuid.uuid4()),
            "supplier_id": str(uuid.uuid4()),
            "warehouse_id": str(uuid.uuid4()),
            "received_date": "2026-03-01",
            "lines": [
                {
                    "po_line_id": str(uuid.uuid4()),
                    "item_id": str(uuid.uuid4()),
                    "ordered_quantity": 100,
                    "received_quantity": 100,
                    "accepted_quantity": 100,
                }
            ],
        },
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 404


# ── Returns ──────────────────────────────────────────────────────────────────


async def test_list_returns(client: AsyncClient, test_user):
    """GET /api/v1/supply-chain/returns returns list."""
    resp = await client.get(
        "/api/v1/supply-chain/returns",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert "returns" in resp.json()


async def test_create_return_missing_supplier_returns_404(client: AsyncClient, superadmin_user):
    """POST /api/v1/supply-chain/returns with invalid supplier → 404."""
    resp = await client.post(
        "/api/v1/supply-chain/returns",
        json={
            "supplier_id": str(uuid.uuid4()),
            "warehouse_id": str(uuid.uuid4()),
            "reason": "Defective batch",
            "lines": [
                {
                    "item_id": str(uuid.uuid4()),
                    "quantity": 5,
                    "unit_cost": "10.00",
                }
            ],
        },
        headers=auth_headers(superadmin_user),
    )
    assert resp.status_code == 404


# ── Dashboard ────────────────────────────────────────────────────────────────


async def test_supply_chain_dashboard(client: AsyncClient, test_user):
    """GET /api/v1/supply-chain/dashboard/stats returns summary stats."""
    resp = await client.get(
        "/api/v1/supply-chain/dashboard/stats",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "total_suppliers" in data
    assert "pending_requisitions" in data
    assert "open_grns" in data


# ── Auth Required ────────────────────────────────────────────────────────────


async def test_supply_chain_requires_auth(client: AsyncClient):
    """Supply chain endpoints require authentication."""
    resp = await client.get("/api/v1/supply-chain/suppliers")
    assert resp.status_code in (401, 403)
