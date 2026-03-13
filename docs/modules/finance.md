# Finance Module

> Double-entry accounting, invoicing, payments, budgets, and financial reporting.

## Overview

The Finance module implements a complete accounting system for Urban Vibes Dynamics. It uses
**double-entry bookkeeping** — every transaction creates a Journal Entry where
total debits always equal total credits. This ensures the accounting equation
(Assets = Liabilities + Equity) remains balanced at all times.

**Who uses it:** Finance Admins, Accountants, Management (for reports)
**Requires:** Finance App Admin access, or specific finance.* permissions

---

## Features

- **Chart of Accounts** — hierarchical account tree (asset, liability, equity, revenue, expense)
- **Journal Entries** — manual double-entry bookkeeping with draft/posted/cancelled lifecycle
- **Invoicing** — customer invoices with line items, tax, discounts, PDF generation
- **Payments** — record payments against invoices (partial or full)
- **Tax Management** — configurable tax rates (Kenya VAT 16%, WHT, etc.)
- **Budgets** — budget vs actuals per account/department
- **Fixed Assets** — asset register with depreciation schedules
- **Recurring Transactions** — auto-generated journal entries on schedule
- **Vendor Bills** — accounts payable, supplier invoices
- **Batch Processing** — bulk invoice creation and batch payments
- **Expense Claims** — employee expense submissions and approvals
- **Multi-currency** — foreign currency invoices with exchange rate conversion
- **Financial Reports** — P&L, Balance Sheet, Cash Flow, Trial Balance, Aged Receivables/Payables
- **AI Finance** — AI-powered forecasting, anomaly detection, cash flow predictions

---

## Architecture

### Key Files

| File | Description |
|------|-------------|
| `backend/app/api/v1/finance.py` | Core CRUD: accounts, journal entries, invoices, payments |
| `backend/app/api/v1/finance_ai.py` | AI-powered financial analysis endpoints |
| `backend/app/api/v1/finance_assets.py` | Fixed asset management and depreciation |
| `backend/app/api/v1/finance_batch.py` | Bulk invoice and payment processing |
| `backend/app/api/v1/finance_currencies.py` | Currency management and exchange rates |
| `backend/app/api/v1/finance_estimates.py` | Quotes and estimates (pre-invoice) |
| `backend/app/api/v1/finance_expenses.py` | Employee expense claims |
| `backend/app/api/v1/finance_recurring.py` | Recurring transaction templates |
| `backend/app/api/v1/finance_reports_ext.py` | Extended reporting (custom reports) |
| `backend/app/api/v1/finance_vendor_bills.py` | Accounts payable / vendor bills |
| `backend/app/api/v1/finance_workflows.py` | Approval workflows for invoices/expenses |
| `backend/app/api/v1/payroll_ext.py` | Payroll → Finance integration |
| `backend/app/models/finance.py` | All SQLAlchemy models |
| `frontend/src/features/finance/` | All Finance frontend pages |
| `frontend/src/api/finance.ts` | Finance API client hooks |

---

## Data Models

| Model | Table | Description |
|-------|-------|-------------|
| `Account` | `finance_accounts` | Chart of Accounts entry (hierarchical) |
| `JournalEntry` | `finance_journal_entries` | Double-entry transaction header |
| `JournalLine` | `finance_journal_lines` | Individual debit/credit line |
| `Invoice` | `finance_invoices` | Customer invoice |
| `InvoiceLineItem` | `finance_invoice_items` | Line item on an invoice |
| `Payment` | `finance_payments` | Payment against an invoice |
| `TaxRate` | `finance_tax_rates` | Configurable tax rates |
| `Budget` | `finance_budgets` | Budget period with lines per account |
| `BudgetLine` | `finance_budget_lines` | Budget amount for a single account |

---

## Workflows

### Invoice Lifecycle

```
draft → sent → partial → paid → void
                    ↑
           (partial payment received)
```

1. **draft** — created but not sent to customer
2. **sent** — emailed to customer (triggers `email.sent` event)
3. **partial** — some payments received but balance outstanding
4. **paid** — fully paid; a `Payment` record posts a journal entry
5. **void** — cancelled (reversal journal entry created)

### Journal Entry Lifecycle

```
draft → posted → cancelled
```

- **draft** — saved but not affecting account balances
- **posted** — permanent; affects balances; cannot be edited (create a reversal instead)
- **cancelled** — invalidated with a reversal entry

### Expense Claim Workflow

```
submitted → under_review → approved → paid
                       ↓
                    rejected
```

---

## API Endpoints

Full auto-generated reference: [docs/api/finance-api.md](../api/finance-api.md)

Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/finance/accounts` | List chart of accounts |
| `POST` | `/finance/accounts` | Create account |
| `GET` | `/finance/invoices` | List invoices with filters |
| `POST` | `/finance/invoices` | Create invoice |
| `POST` | `/finance/invoices/{id}/send` | Send invoice (email to customer) |
| `POST` | `/finance/invoices/{id}/void` | Void an invoice |
| `GET` | `/finance/payments` | List payments |
| `POST` | `/finance/payments` | Record payment |
| `GET` | `/finance/journal` | List journal entries |
| `POST` | `/finance/journal` | Create journal entry |
| `POST` | `/finance/journal/{id}/post` | Post a draft journal entry |
| `GET` | `/finance/reports/pnl` | Profit & Loss report |
| `GET` | `/finance/reports/balance-sheet` | Balance sheet |
| `GET` | `/finance/reports/cash-flow` | Cash flow statement |
| `GET` | `/finance/reports/trial-balance` | Trial balance |
| `GET` | `/finance/reports/aged-receivables` | Aged receivables |

---

## Cross-Module Integrations

| Source Module | Event | Finance Action |
|--------------|-------|----------------|
| POS | `pos.sale.completed` | Auto-post journal entry (revenue debit, cash/card credit) |
| E-Commerce | `ecommerce.order.created` | Auto-create customer invoice |
| Supply Chain | `supplychain.po.completed` | Auto-create vendor bill |
| Inventory | `inventory.valuation.changed` | Update stock asset account value |
| HR/Payroll | Payroll run | Create payroll journal entry (salary expense) |
| Manufacturing | Work order completed | Record production cost journal entry |

---

## Configuration

| Setting | Location | Description |
|---------|----------|-------------|
| Default currency | System Settings | Base currency for all accounts |
| Tax rates | Finance > Tax Rates | Configurable rates (Kenya VAT = 16%) |
| Account prefixes | Chart of Accounts | Asset=1xxx, Liability=2xxx, Equity=3xxx, Revenue=4xxx, Expense=5xxx |
| Budget periods | Finance > Budgets | Annual or quarterly budget cycles |

---

## Kenya Compliance

Built-in support for Kenya statutory requirements:
- **VAT:** 16% standard rate, 0% zero-rated, exempt items
- **WHT (Withholding Tax):** 5% on professional services
- **NHIF:** Employee health insurance deductions (payroll integration)
- **NSSF:** Pension deductions (payroll integration)
- **PAYE:** Pay-As-You-Earn income tax (payroll integration)

---

## Known Limitations

- Multi-currency invoices use exchange rates at invoice creation time (no auto-revaluation)
- Bank reconciliation is manual (no bank feed import yet)
- Audit trail for posted journal entries is read-only (no amendment flow, use reversals)
