"""Integration tests for the Finance API."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


# ── Accounts ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_account(client: AsyncClient, test_user):
    """POST /api/v1/finance/accounts creates an account."""
    resp = await client.post(
        "/api/v1/finance/accounts",
        json={"code": "1001", "name": "Cash", "account_type": "asset"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Cash"
    assert data["code"] == "1001"


@pytest.mark.asyncio
async def test_list_accounts(client: AsyncClient, test_user):
    """GET /api/v1/finance/accounts returns accounts."""
    await client.post(
        "/api/v1/finance/accounts",
        json={"code": "2001", "name": "Revenue", "account_type": "revenue"},
        headers=auth_headers(test_user),
    )
    resp = await client.get(
        "/api/v1/finance/accounts",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_update_account(client: AsyncClient, test_user):
    """PUT /api/v1/finance/accounts/{id} updates an account."""
    create_resp = await client.post(
        "/api/v1/finance/accounts",
        json={"code": "3001", "name": "Expense", "account_type": "expense"},
        headers=auth_headers(test_user),
    )
    account_id = create_resp.json()["id"]
    resp = await client.put(
        f"/api/v1/finance/accounts/{account_id}",
        json={"name": "Operating Expense"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Operating Expense"


@pytest.mark.asyncio
async def test_delete_account(client: AsyncClient, test_user):
    """DELETE /api/v1/finance/accounts/{id} deletes an account."""
    create_resp = await client.post(
        "/api/v1/finance/accounts",
        json={"code": "9001", "name": "Temp Account", "account_type": "asset"},
        headers=auth_headers(test_user),
    )
    account_id = create_resp.json()["id"]
    resp = await client.delete(
        f"/api/v1/finance/accounts/{account_id}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 204


# ── Invoices ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_invoice(client: AsyncClient, test_user):
    """POST /api/v1/finance/invoices creates an invoice."""
    resp = await client.post(
        "/api/v1/finance/invoices",
        json={
            "invoice_type": "sales",
            "customer_name": "Test Customer",
            "issue_date": "2026-01-01",
            "due_date": "2026-01-31",
            "subtotal": 1000.00,
            "total": 1000.00,
            "items": [{"description": "Consulting", "quantity": 1, "unit_price": 1000.00}],
        },
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["invoice_type"] == "sales"
    assert "invoice_number" in data


@pytest.mark.asyncio
async def test_list_invoices(client: AsyncClient, test_user):
    """GET /api/v1/finance/invoices returns invoices."""
    resp = await client.get(
        "/api/v1/finance/invoices",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_invoice_detail(client: AsyncClient, test_user):
    """GET /api/v1/finance/invoices/{id} returns invoice detail."""
    create_resp = await client.post(
        "/api/v1/finance/invoices",
        json={
            "invoice_type": "sales",
            "customer_name": "Detail Customer",
            "issue_date": "2026-02-01",
            "due_date": "2026-02-28",
            "subtotal": 500.00,
            "total": 500.00,
            "items": [{"description": "Service", "quantity": 1, "unit_price": 500.00}],
        },
        headers=auth_headers(test_user),
    )
    invoice_id = create_resp.json()["id"]
    resp = await client.get(
        f"/api/v1/finance/invoices/{invoice_id}",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == invoice_id


# ── Payments ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_payment(client: AsyncClient, test_user):
    """POST /api/v1/finance/payments creates a payment."""
    resp = await client.post(
        "/api/v1/finance/payments",
        json={
            "amount": 500.00,
            "payment_date": "2026-01-15",
            "payment_method": "bank_transfer",
        },
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_list_payments(client: AsyncClient, test_user):
    """GET /api/v1/finance/payments returns payments."""
    resp = await client.get(
        "/api/v1/finance/payments",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


# ── Journal Entries ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_journal_entry(client: AsyncClient, test_user):
    """POST /api/v1/finance/journal-entries creates a journal entry."""
    # Create two accounts first
    acc1 = await client.post(
        "/api/v1/finance/accounts",
        json={"code": "1100", "name": "Bank JE", "account_type": "asset"},
        headers=auth_headers(test_user),
    )
    acc2 = await client.post(
        "/api/v1/finance/accounts",
        json={"code": "4100", "name": "Sales Revenue JE", "account_type": "revenue"},
        headers=auth_headers(test_user),
    )
    acc1_id = acc1.json()["id"]
    acc2_id = acc2.json()["id"]

    resp = await client.post(
        "/api/v1/finance/journal-entries",
        json={
            "entry_date": "2026-01-15",
            "description": "Cash sale",
            "lines": [
                {"account_id": acc1_id, "debit": 1000.00, "credit": 0},
                {"account_id": acc2_id, "debit": 0, "credit": 1000.00},
            ],
        },
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_list_journal_entries(client: AsyncClient, test_user):
    """GET /api/v1/finance/journal-entries returns journal entries."""
    resp = await client.get(
        "/api/v1/finance/journal-entries",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


# ── Dashboard ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_finance_dashboard_stats(client: AsyncClient, test_user):
    """GET /api/v1/finance/dashboard/stats returns stats."""
    resp = await client.get(
        "/api/v1/finance/dashboard/stats",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


# ── Tax Rates ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_tax_rates(client: AsyncClient, test_user):
    """GET /api/v1/finance/tax-rates returns tax rates."""
    resp = await client.get(
        "/api/v1/finance/tax-rates",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


# ── Reports ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_trial_balance_report(client: AsyncClient, test_user):
    """GET /api/v1/finance/reports/trial-balance returns report."""
    resp = await client.get(
        "/api/v1/finance/reports/trial-balance",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


# ── Auth Required ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_finance_requires_auth(client: AsyncClient):
    """Finance endpoints require authentication."""
    resp = await client.get("/api/v1/finance/accounts")
    assert resp.status_code in (401, 403)
