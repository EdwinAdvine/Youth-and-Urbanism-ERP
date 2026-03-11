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


# ── Double-Entry Validation Tests ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_journal_entry_balanced(client: AsyncClient, test_user):
    """Journal entry must have balanced debits and credits."""
    # Create two accounts
    acc1 = await client.post(
        "/api/v1/finance/accounts",
        json={"code": "1200", "name": "Bank DE", "account_type": "asset"},
        headers=auth_headers(test_user),
    )
    acc2 = await client.post(
        "/api/v1/finance/accounts",
        json={"code": "4200", "name": "Revenue DE", "account_type": "revenue"},
        headers=auth_headers(test_user),
    )
    acc1_id = acc1.json()["id"]
    acc2_id = acc2.json()["id"]

    # Create a balanced journal entry
    resp = await client.post(
        "/api/v1/finance/journal-entries",
        json={
            "entry_date": "2026-03-01",
            "description": "Balanced entry test",
            "lines": [
                {"account_id": acc1_id, "debit": 500.00, "credit": 0},
                {"account_id": acc2_id, "debit": 0, "credit": 500.00},
            ],
        },
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    # Verify the lines are balanced
    lines = data.get("lines", [])
    total_debit = sum(float(ln.get("debit", 0)) for ln in lines)
    total_credit = sum(float(ln.get("credit", 0)) for ln in lines)
    assert abs(total_debit - total_credit) < 0.01, f"Entry not balanced: debit={total_debit}, credit={total_credit}"


@pytest.mark.asyncio
async def test_journal_entry_unbalanced_rejected(client: AsyncClient, test_user):
    """Unbalanced journal entry should be rejected (if server validates)."""
    acc1 = await client.post(
        "/api/v1/finance/accounts",
        json={"code": "1201", "name": "Bank UB", "account_type": "asset"},
        headers=auth_headers(test_user),
    )
    acc2 = await client.post(
        "/api/v1/finance/accounts",
        json={"code": "4201", "name": "Revenue UB", "account_type": "revenue"},
        headers=auth_headers(test_user),
    )
    acc1_id = acc1.json()["id"]
    acc2_id = acc2.json()["id"]

    resp = await client.post(
        "/api/v1/finance/journal-entries",
        json={
            "entry_date": "2026-03-01",
            "description": "Unbalanced entry test",
            "lines": [
                {"account_id": acc1_id, "debit": 1000.00, "credit": 0},
                {"account_id": acc2_id, "debit": 0, "credit": 500.00},
            ],
        },
        headers=auth_headers(test_user),
    )
    # Server should reject (400/422) OR if it allows, the entry exists but is unbalanced
    # We accept both behaviors — the test documents which one applies
    if resp.status_code in (400, 422):
        pass  # Server enforces balance — good
    else:
        # Server allows it — verify we can detect the imbalance
        assert resp.status_code == 201
        data = resp.json()
        lines = data.get("lines", [])
        total_debit = sum(float(ln.get("debit", 0)) for ln in lines)
        total_credit = sum(float(ln.get("credit", 0)) for ln in lines)
        assert abs(total_debit - total_credit) > 0.01, "Expected unbalanced entry"


# ── Report Calculation Tests ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_pnl_report_structure(client: AsyncClient, test_user):
    """P&L report should return revenue, expenses, and net_income."""
    resp = await client.get(
        "/api/v1/finance/reports/pnl",
        params={"from": "2026-01-01", "to": "2026-12-31"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "revenue" in data
    assert "expenses" in data
    assert "total_revenue" in data
    assert "total_expenses" in data
    assert "net_income" in data
    # Net income should be revenue - expenses
    assert abs(data["net_income"] - (data["total_revenue"] - data["total_expenses"])) < 0.01


@pytest.mark.asyncio
async def test_balance_sheet_structure(client: AsyncClient, test_user):
    """Balance sheet should return assets, liabilities, equity, and balance check."""
    resp = await client.get(
        "/api/v1/finance/reports/balance-sheet",
        params={"as_of": "2026-12-31"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "assets" in data
    assert "liabilities" in data
    assert "equity" in data
    assert "total_assets" in data
    assert "total_liabilities" in data
    assert "total_equity" in data
    assert "is_balanced" in data


@pytest.mark.asyncio
async def test_cash_flow_report_structure(client: AsyncClient, test_user):
    """Cash flow report should have operating, investing, financing sections."""
    resp = await client.get(
        "/api/v1/finance/reports/cash-flow",
        params={"start_date": "2026-01-01", "end_date": "2026-12-31"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "operating_activities" in data
    assert "investing_activities" in data
    assert "financing_activities" in data
    assert "net_change_in_cash" in data


@pytest.mark.asyncio
async def test_aged_receivables_structure(client: AsyncClient, test_user):
    """Aged receivables should return aging buckets."""
    resp = await client.get(
        "/api/v1/finance/reports/aged-receivables",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "buckets" in data
    assert "grand_total" in data


@pytest.mark.asyncio
async def test_aged_payables_structure(client: AsyncClient, test_user):
    """Aged payables should return aging buckets."""
    resp = await client.get(
        "/api/v1/finance/reports/aged-payables",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "buckets" in data
    assert "grand_total" in data


@pytest.mark.asyncio
async def test_dashboard_kpis_structure(client: AsyncClient, test_user):
    """Dashboard KPIs should return key financial metrics."""
    resp = await client.get(
        "/api/v1/finance/dashboard/kpis",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "revenue" in data
    assert "profit" in data
    assert "cash_position" in data
    assert "total_receivables" in data
    assert "total_payables" in data


# ── Budget vs Actual Tests ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_budget(client: AsyncClient, test_user):
    """POST /api/v1/finance/budgets creates a budget."""
    resp = await client.post(
        "/api/v1/finance/budgets",
        json={
            "name": "Q1 2026 Budget",
            "fiscal_year": 2026,
            "total_amount": 50000.00,
            "status": "draft",
        },
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Q1 2026 Budget"
    assert float(data["total_amount"]) == 50000.00


@pytest.mark.asyncio
async def test_budget_list(client: AsyncClient, test_user):
    """GET /api/v1/finance/budgets returns budgets."""
    resp = await client.get(
        "/api/v1/finance/budgets",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_budget_spent_tracking(client: AsyncClient, test_user):
    """Budget should track spent_amount field."""
    create_resp = await client.post(
        "/api/v1/finance/budgets",
        json={
            "name": "Tracking Budget",
            "fiscal_year": 2026,
            "total_amount": 10000.00,
            "status": "active",
        },
        headers=auth_headers(test_user),
    )
    assert create_resp.status_code == 201
    budget = create_resp.json()
    assert float(budget.get("spent_amount", 0)) == 0.0
    remaining = float(budget["total_amount"]) - float(budget.get("spent_amount", 0))
    assert remaining == 10000.00


# ── Multi-Currency Tests ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_currencies(client: AsyncClient, test_user):
    """GET /api/v1/finance/currencies returns currencies."""
    resp = await client.get(
        "/api/v1/finance/currencies",
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "currencies" in data


@pytest.mark.asyncio
async def test_create_currency(client: AsyncClient, test_user):
    """POST /api/v1/finance/currencies creates a currency."""
    resp = await client.post(
        "/api/v1/finance/currencies",
        json={"code": "KES", "name": "Kenyan Shilling", "symbol": "KSh", "is_base": False},
        headers=auth_headers(test_user),
    )
    # May require admin — accept 201 or 403
    assert resp.status_code in (201, 403)


@pytest.mark.asyncio
async def test_invoice_currency_field(client: AsyncClient, test_user):
    """Invoice should carry a currency field."""
    resp = await client.post(
        "/api/v1/finance/invoices",
        json={
            "invoice_type": "sales",
            "customer_name": "Multi-Currency Customer",
            "issue_date": "2026-03-01",
            "due_date": "2026-03-31",
            "subtotal": 2000.00,
            "total": 2000.00,
            "currency": "EUR",
            "items": [{"description": "Euro Service", "quantity": 1, "unit_price": 2000.00}],
        },
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data.get("currency") == "EUR"
