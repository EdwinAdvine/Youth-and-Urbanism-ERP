# Finance — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 141


## Contents

- [finance.py](#finance) (34 endpoints)
- [finance_ai.py](#finance-ai) (9 endpoints)
- [finance_assets.py](#finance-assets) (8 endpoints)
- [finance_batch.py](#finance-batch) (15 endpoints)
- [finance_currencies.py](#finance-currencies) (5 endpoints)
- [finance_estimates.py](#finance-estimates) (9 endpoints)
- [finance_expenses.py](#finance-expenses) (11 endpoints)
- [finance_ext.py](#finance-ext) (13 endpoints)
- [finance_recurring.py](#finance-recurring) (6 endpoints)
- [finance_reports_ext.py](#finance-reports-ext) (15 endpoints)
- [finance_vendor_bills.py](#finance-vendor-bills) (8 endpoints)
- [finance_workflows.py](#finance-workflows) (8 endpoints)

---

## finance.py

Finance API — Chart of Accounts, Journal Entries, Invoices, Payments, Reports.

Implements double-entry bookkeeping for Urban Vibes Dynamics. Every financial transaction
creates a balanced JournalEntry (total debits == total credits).

Key business flows:
    Invoice lifecycle:  draft → sent → partial → paid → void
    Payment lifecycle:  draft → posted (creates a JournalEntry)
    Journal lifecycle:  draft → posted → cancelled (posted entries are immutable)

Permissions:
    - Finance App Admin: full access to all endpoints
    - Read-only users:   GET endpoints for reports and lists

Cross-module integrations:
    - POS:        pos.sale.completed → auto-posts a journal entry (revenue + cash/card)
    - E-Commerce: ecommerce.order.created → auto-creates an invoice
    - Inventory:  inventory.valuation.changed → updates balance sheet asset value
    - Supply Chain: supplychain.po.completed → creates a vendor bill

Router prefix: /finance (registered in api/v1/__init__.py)


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/accounts` | `list_accounts` | — |
| `POST` | `/accounts` | `create_account` | — |
| `PUT` | `/accounts/{account_id}` | `update_account` | — |
| `DELETE` | `/accounts/{account_id}` | `delete_account` | — |
| `GET` | `/journal-entries` | `list_journal_entries` | — |
| `POST` | `/journal-entries` | `create_journal_entry` | — |
| `GET` | `/journal-entries/{entry_id}` | `get_journal_entry` | — |
| `PUT` | `/journal-entries/{entry_id}` | `update_journal_entry` | — |
| `POST` | `/journal-entries/{entry_id}/post` | `post_journal_entry` | — |
| `GET` | `/invoices` | `list_invoices` | — |
| `POST` | `/invoices` | `create_invoice` | — |
| `GET` | `/invoices/{invoice_id}` | `get_invoice` | — |
| `PUT` | `/invoices/{invoice_id}` | `update_invoice` | — |
| `POST` | `/invoices/{invoice_id}/send` | `send_invoice` | — |
| `POST` | `/invoices/{invoice_id}/mark-paid` | `mark_invoice_paid` | — |
| `DELETE` | `/invoices/{invoice_id}` | `delete_invoice` | — |
| `GET` | `/payments` | `list_payments` | — |
| `POST` | `/payments` | `create_payment` | — |
| `GET` | `/payments/{payment_id}` | `get_payment` | — |
| `GET` | `/reports/trial-balance` | `trial_balance` | — |
| `GET` | `/reports/income-statement` | `income_statement` | — |
| `GET` | `/dashboard/stats` | `finance_dashboard` | — |
| `GET` | `/budgets` | `list_budgets` | — |
| `POST` | `/budgets` | `create_budget` | — |
| `GET` | `/budgets/{budget_id}` | `get_budget` | — |
| `PUT` | `/budgets/{budget_id}` | `update_budget` | — |
| `DELETE` | `/budgets/{budget_id}` | `delete_budget` | — |
| `GET` | `/reports/budget-vs-actual` | `budget_vs_actual` | — |
| `GET` | `/tax-rates` | `list_tax_rates` | — |
| `POST` | `/tax-rates` | `create_tax_rate` | — |
| `PUT` | `/tax-rates/{tax_rate_id}` | `update_tax_rate` | — |
| `GET` | `/invoices/export` | `export_invoices` | Download all invoices as a CSV file. |
| `GET` | `/payments/export` | `export_payments` | Download all payments as a CSV file. |
| `GET` | `/invoices/{invoice_id}/pdf` | `generate_invoice_pdf` | Generate a PDF for the given invoice using basic HTML→PDF conversion. |

### `GET /accounts`

**Function:** `list_accounts` (line 229)

**Parameters:** `account_type`, `page`, `limit`

**Auth:** `current_user`


### `POST /accounts`

**Function:** `create_account` (line 255)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /accounts/{account_id}`

**Function:** `update_account` (line 275)

**Parameters:** `account_id`, `payload`

**Auth:** `current_user`


### `DELETE /accounts/{account_id}`

**Function:** `delete_account` (line 298)

**Parameters:** `account_id`

**Auth:** `current_user`


### `GET /journal-entries`

**Function:** `list_journal_entries` (line 315)

**Parameters:** `status_filter`, `start_date`, `end_date`, `page`, `limit`

**Auth:** `current_user`


### `POST /journal-entries`

**Function:** `create_journal_entry` (line 351)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /journal-entries/{entry_id}`

**Function:** `get_journal_entry` (line 406)

**Parameters:** `entry_id`

**Auth:** `current_user`


### `PUT /journal-entries/{entry_id}`

**Function:** `update_journal_entry` (line 423)

**Parameters:** `entry_id`, `payload`

**Auth:** `current_user`


### `POST /journal-entries/{entry_id}/post`

**Function:** `post_journal_entry` (line 495)

**Parameters:** `entry_id`

**Auth:** `current_user`


### `GET /invoices`

**Function:** `list_invoices` (line 525)

**Parameters:** `invoice_type`, `status_filter`, `start_date`, `end_date`, `page`, `limit`, `fields`

**Auth:** `current_user`


### `POST /invoices`

**Function:** `create_invoice` (line 564)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /invoices/{invoice_id}`

**Function:** `get_invoice` (line 607)

**Parameters:** `invoice_id`

**Auth:** `current_user`


### `PUT /invoices/{invoice_id}`

**Function:** `update_invoice` (line 619)

**Parameters:** `invoice_id`, `payload`

**Auth:** `current_user`


### `POST /invoices/{invoice_id}/send`

**Function:** `send_invoice` (line 645)

**Parameters:** `invoice_id`

**Auth:** `current_user`


### `POST /invoices/{invoice_id}/mark-paid`

**Function:** `mark_invoice_paid` (line 676)

**Parameters:** `invoice_id`

**Auth:** `current_user`


### `DELETE /invoices/{invoice_id}`

**Function:** `delete_invoice` (line 707)

**Parameters:** `invoice_id`

**Auth:** `current_user`


### `GET /payments`

**Function:** `list_payments` (line 732)

**Parameters:** `start_date`, `end_date`, `page`, `limit`

**Auth:** `current_user`


### `POST /payments`

**Function:** `create_payment` (line 761)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /payments/{payment_id}`

**Function:** `get_payment` (line 821)

**Parameters:** `payment_id`

**Auth:** `current_user`


### `GET /reports/trial-balance`

**Function:** `trial_balance` (line 835)

**Auth:** `current_user`


### `GET /reports/income-statement`

**Function:** `income_statement` (line 885)

**Parameters:** `start_date`, `end_date`

**Auth:** `current_user`


### `GET /dashboard/stats`

**Function:** `finance_dashboard` (line 958)

**Auth:** `current_user`


### `GET /budgets`

**Function:** `list_budgets` (line 1124)

**Parameters:** `fiscal_year`, `page`, `limit`

**Auth:** `current_user`


### `POST /budgets`

**Function:** `create_budget` (line 1155)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `GET /budgets/{budget_id}`

**Function:** `get_budget` (line 1200)

**Parameters:** `budget_id`

**Auth:** `current_user`


### `PUT /budgets/{budget_id}`

**Function:** `update_budget` (line 1217)

**Parameters:** `budget_id`, `payload`, `_admin`

**Auth:** `current_user`


### `DELETE /budgets/{budget_id}`

**Function:** `delete_budget` (line 1246)

**Parameters:** `budget_id`, `_admin`

**Auth:** `current_user`


### `GET /reports/budget-vs-actual`

**Function:** `budget_vs_actual` (line 1268)

**Parameters:** `fiscal_year`

**Auth:** `current_user`


### `GET /tax-rates`

**Function:** `list_tax_rates` (line 1316)

**Auth:** `current_user`


### `POST /tax-rates`

**Function:** `create_tax_rate` (line 1335)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `PUT /tax-rates/{tax_rate_id}`

**Function:** `update_tax_rate` (line 1362)

**Parameters:** `tax_rate_id`, `payload`, `_admin`

**Auth:** `current_user`


### `GET /invoices/export`

**Function:** `export_invoices` (line 1396)

Download all invoices as a CSV file.

**Parameters:** `status`

**Auth:** `current_user`


### `GET /payments/export`

**Function:** `export_payments` (line 1430)

Download all payments as a CSV file.

**Auth:** `current_user`


### `GET /invoices/{invoice_id}/pdf`

**Function:** `generate_invoice_pdf` (line 1458)

Generate a PDF for the given invoice using basic HTML→PDF conversion.

**Parameters:** `invoice_id`

**Auth:** `current_user`


---

## finance_ai.py

Finance AI endpoints — 2026-era AI-native finance features.

Features:
- Cash flow forecast (30/60/90 day)
- Financial narrative generator
- AI bank transaction categorizer
- Receipt OCR (AI vision)
- Natural language report query
- Anomaly detection
- Tax optimizer suggestions
- Smart dunning engine


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/ai/cash-flow-forecast` | `cash_flow_forecast` | 30/60/90-day rolling cash flow forecast. |
| `POST` | `/ai/financial-narrative` | `generate_financial_narrative` | Generate an AI executive summary for any financial report. |
| `POST` | `/ai/categorize-bank-transactions` | `categorize_bank_transactions` | AI-powered bank transaction categorization using rules + AI embeddings. |
| `POST` | `/ai/nl-query` | `natural_language_query` | Convert natural language financial query to safe SQL and execute it. |
| `GET` | `/ai/anomaly-detection` | `detect_financial_anomalies` | Detect statistical anomalies and suspicious patterns in recent transactions. |
| `POST` | `/ai/dunning/generate-reminder/{invoice_id}` | `generate_dunning_reminder` | Generate AI-personalized payment reminder for an overdue invoice. |
| `GET` | `/ai/dunning/status/{invoice_id}` | `get_dunning_status` | Get the dunning history for an invoice. |
| `GET` | `/ai/tax-optimizer` | `tax_optimizer` | AI quarter-end tax optimization suggestions. |
| `POST` | `/ai/ocr-receipt` | `ocr_receipt` | Upload a receipt image → AI vision extracts vendor, amount, date, category. |

### `GET /ai/cash-flow-forecast`

**Function:** `cash_flow_forecast` (line 55)

30/60/90-day rolling cash flow forecast.

Uses: scheduled invoice due dates, historical collection rates,
recurring expenses, upcoming vendor bill due dates.

**Parameters:** `horizon_days`

**Auth:** `current_user`


### `POST /ai/financial-narrative`

**Function:** `generate_financial_narrative` (line 201)

Generate an AI executive summary for any financial report.

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /ai/categorize-bank-transactions`

**Function:** `categorize_bank_transactions` (line 248)

AI-powered bank transaction categorization using rules + AI embeddings.

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /ai/nl-query`

**Function:** `natural_language_query` (line 356)

Convert natural language financial query to safe SQL and execute it.

SAFETY: Only SELECT queries against finance tables. No DDL/DML allowed.

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /ai/anomaly-detection`

**Function:** `detect_financial_anomalies` (line 421)

Detect statistical anomalies and suspicious patterns in recent transactions.

**Parameters:** `days`

**Auth:** `current_user`


### `POST /ai/dunning/generate-reminder/{invoice_id}`

**Function:** `generate_dunning_reminder` (line 520)

Generate AI-personalized payment reminder for an overdue invoice.

**Parameters:** `invoice_id`

**Auth:** `current_user`


### `GET /ai/dunning/status/{invoice_id}`

**Function:** `get_dunning_status` (line 592)

Get the dunning history for an invoice.

**Parameters:** `invoice_id`

**Auth:** `current_user`


### `GET /ai/tax-optimizer`

**Function:** `tax_optimizer` (line 634)

AI quarter-end tax optimization suggestions.

**Parameters:** `fiscal_year`

**Auth:** `current_user`


### `POST /ai/ocr-receipt`

**Function:** `ocr_receipt` (line 699)

Upload a receipt image → AI vision extracts vendor, amount, date, category.

Returns pre-filled expense fields ready for form auto-population.

**Parameters:** `file`

**Auth:** `current_user`


---

## finance_assets.py

Finance API — Fixed Asset Management & Depreciation.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/fixed-assets` | `list_fixed_assets` | — |
| `POST` | `/fixed-assets` | `create_fixed_asset` | — |
| `GET` | `/fixed-assets/summary` | `fixed_assets_summary` | — |
| `GET` | `/fixed-assets/export` | `export_fixed_assets` | — |
| `GET` | `/fixed-assets/{asset_id}` | `get_fixed_asset` | — |
| `PUT` | `/fixed-assets/{asset_id}` | `update_fixed_asset` | — |
| `POST` | `/fixed-assets/{asset_id}/depreciate` | `depreciate_asset` | — |
| `POST` | `/fixed-assets/{asset_id}/dispose` | `dispose_asset` | — |

### `GET /fixed-assets`

**Function:** `list_fixed_assets` (line 103)

**Parameters:** `status_filter`, `category`, `page`, `limit`

**Auth:** `current_user`


### `POST /fixed-assets`

**Function:** `create_fixed_asset` (line 132)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /fixed-assets/summary`

**Function:** `fixed_assets_summary` (line 177)

**Auth:** `current_user`


### `GET /fixed-assets/export`

**Function:** `export_fixed_assets` (line 246)

**Parameters:** `status_filter`, `category`

**Auth:** `current_user`


### `GET /fixed-assets/{asset_id}`

**Function:** `get_fixed_asset` (line 290)

**Parameters:** `asset_id`

**Auth:** `current_user`


### `PUT /fixed-assets/{asset_id}`

**Function:** `update_fixed_asset` (line 302)

**Parameters:** `asset_id`, `payload`

**Auth:** `current_user`


### `POST /fixed-assets/{asset_id}/depreciate`

**Function:** `depreciate_asset` (line 332)

**Parameters:** `asset_id`

**Auth:** `current_user`


### `POST /fixed-assets/{asset_id}/dispose`

**Function:** `dispose_asset` (line 384)

**Parameters:** `asset_id`

**Auth:** `current_user`


---

## finance_batch.py

Finance Batch Operations + Revenue Recognition endpoints.

Batch: create/update/approve multiple invoices, expenses, vendor bills at once.
Revenue Recognition: IFRS 15 / ASC 606 deferred revenue schedule management.
Custom Fields: define and list custom fields per entity type.
Dimensions: class/location/segment management.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/invoices/batch` | `batch_create_invoices` | Batch create multiple invoices in a single request. |
| `POST` | `/invoices/batch-send` | `batch_send_invoices` | Mark multiple draft invoices as sent. |
| `POST` | `/invoices/batch-import-csv` | `batch_import_invoices_csv` | Import invoices from CSV. Expected columns: customer_name, customer_email, am... |
| `POST` | `/expenses/batch-approve` | `batch_approve_expenses` | Approve multiple submitted expenses at once. |
| `POST` | `/expenses/batch-import-csv` | `batch_import_expenses_csv` | Import expenses from CSV. Columns: description, amount, category, expense_dat... |
| `POST` | `/revenue-recognition` | `create_revenue_recognition_schedule` | Create a revenue recognition schedule for an invoice (IFRS 15 compliant). |
| `GET` | `/revenue-recognition` | `list_revenue_recognition_schedules` | — |
| `POST` | `/revenue-recognition/{schedule_id}/run-period` | `run_revenue_recognition_period` | Recognize revenue for a specific period — posts a journal entry. |
| `GET` | `/custom-fields` | `list_custom_fields` | — |
| `POST` | `/custom-fields` | `create_custom_field` | — |
| `DELETE` | `/custom-fields/{field_id}` | `delete_custom_field` | — |
| `GET` | `/dimensions` | `list_dimensions` | — |
| `POST` | `/dimensions` | `create_dimension` | — |
| `PUT` | `/dimensions/{dim_id}` | `update_dimension` | — |
| `DELETE` | `/dimensions/{dim_id}` | `delete_dimension` | — |

### `POST /invoices/batch`

**Function:** `batch_create_invoices` (line 52)

Batch create multiple invoices in a single request.

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /invoices/batch-send`

**Function:** `batch_send_invoices` (line 120)

Mark multiple draft invoices as sent.

**Parameters:** `invoice_ids`

**Auth:** `current_user`


### `POST /invoices/batch-import-csv`

**Function:** `batch_import_invoices_csv` (line 140)

Import invoices from CSV. Expected columns: customer_name, customer_email, amount, due_date, description.

**Parameters:** `file`, `invoice_type`

**Auth:** `current_user`


### `POST /expenses/batch-approve`

**Function:** `batch_approve_expenses` (line 195)

Approve multiple submitted expenses at once.

**Parameters:** `expense_ids`

**Auth:** `current_user`


### `POST /expenses/batch-import-csv`

**Function:** `batch_import_expenses_csv` (line 227)

Import expenses from CSV. Columns: description, amount, category, expense_date, currency.

**Parameters:** `file`

**Auth:** `current_user`


### `POST /revenue-recognition`

**Function:** `create_revenue_recognition_schedule` (line 273)

Create a revenue recognition schedule for an invoice (IFRS 15 compliant).

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /revenue-recognition`

**Function:** `list_revenue_recognition_schedules` (line 335)

**Parameters:** `status_filter`, `page`, `limit`

**Auth:** `current_user`


### `POST /revenue-recognition/{schedule_id}/run-period`

**Function:** `run_revenue_recognition_period` (line 368)

Recognize revenue for a specific period — posts a journal entry.

**Parameters:** `schedule_id`, `period`

**Auth:** `current_user`


### `GET /custom-fields`

**Function:** `list_custom_fields` (line 451)

**Parameters:** `entity_type`

**Auth:** `current_user`


### `POST /custom-fields`

**Function:** `create_custom_field` (line 481)

**Parameters:** `payload`

**Auth:** `current_user`


### `DELETE /custom-fields/{field_id}`

**Function:** `delete_custom_field` (line 515)

**Parameters:** `field_id`

**Auth:** `current_user`


### `GET /dimensions`

**Function:** `list_dimensions` (line 538)

**Parameters:** `dimension_type`, `is_active`

**Auth:** `current_user`


### `POST /dimensions`

**Function:** `create_dimension` (line 567)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /dimensions/{dim_id}`

**Function:** `update_dimension` (line 587)

**Parameters:** `dim_id`, `payload`

**Auth:** `current_user`


### `DELETE /dimensions/{dim_id}`

**Function:** `delete_dimension` (line 604)

**Parameters:** `dim_id`

**Auth:** `current_user`


---

## finance_currencies.py

Finance Currencies API — dedicated CRUD for currency management.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/currencies/all` | `list_currencies` | — |
| `GET` | `/currencies/{currency_id}` | `get_currency` | — |
| `POST` | `/currencies` | `create_currency` | — |
| `PUT` | `/currencies/{currency_id}` | `update_currency` | — |
| `DELETE` | `/currencies/{currency_id}` | `delete_currency` | — |

### `GET /currencies/all`

**Function:** `list_currencies` (line 53)

**Auth:** `current_user`


### `GET /currencies/{currency_id}`

**Function:** `get_currency` (line 66)

**Parameters:** `currency_id`

**Auth:** `current_user`


### `POST /currencies`

**Function:** `create_currency` (line 78)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `PUT /currencies/{currency_id}`

**Function:** `update_currency` (line 105)

**Parameters:** `currency_id`, `payload`, `_admin`

**Auth:** `current_user`


### `DELETE /currencies/{currency_id}`

**Function:** `delete_currency` (line 133)

**Parameters:** `currency_id`, `_admin`

**Auth:** `current_user`


---

## finance_estimates.py

Estimates (Quotes) endpoints — create, send, accept, convert to invoice.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/estimates` | `list_estimates` | List estimates with optional filters. |
| `POST` | `/estimates` | `create_estimate` | Create a new estimate/quote. |
| `GET` | `/estimates/{estimate_id}` | `get_estimate` | — |
| `PUT` | `/estimates/{estimate_id}` | `update_estimate` | — |
| `POST` | `/estimates/{estimate_id}/send` | `send_estimate` | Mark estimate as sent (email sending handled by mail module). |
| `POST` | `/estimates/{estimate_id}/accept` | `accept_estimate` | Mark estimate as accepted by customer. |
| `POST` | `/estimates/{estimate_id}/decline` | `decline_estimate` | Mark estimate as declined. |
| `POST` | `/estimates/{estimate_id}/convert-to-invoice` | `convert_estimate_to_invoice` | Convert an accepted estimate into a sales invoice. |
| `DELETE` | `/estimates/{estimate_id}` | `delete_estimate` | — |

### `GET /estimates`

**Function:** `list_estimates` (line 87)

List estimates with optional filters.

**Parameters:** `status`, `customer`, `page`, `limit`

**Auth:** `current_user`


### `POST /estimates`

**Function:** `create_estimate` (line 133)

Create a new estimate/quote.

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /estimates/{estimate_id}`

**Function:** `get_estimate` (line 167)

**Parameters:** `estimate_id`

**Auth:** `current_user`


### `PUT /estimates/{estimate_id}`

**Function:** `update_estimate` (line 196)

**Parameters:** `estimate_id`, `payload`

**Auth:** `current_user`


### `POST /estimates/{estimate_id}/send`

**Function:** `send_estimate` (line 225)

Mark estimate as sent (email sending handled by mail module).

**Parameters:** `estimate_id`

**Auth:** `current_user`


### `POST /estimates/{estimate_id}/accept`

**Function:** `accept_estimate` (line 240)

Mark estimate as accepted by customer.

**Parameters:** `estimate_id`

**Auth:** `current_user`


### `POST /estimates/{estimate_id}/decline`

**Function:** `decline_estimate` (line 255)

Mark estimate as declined.

**Parameters:** `estimate_id`

**Auth:** `current_user`


### `POST /estimates/{estimate_id}/convert-to-invoice`

**Function:** `convert_estimate_to_invoice` (line 268)

Convert an accepted estimate into a sales invoice.

**Parameters:** `estimate_id`, `params`

**Auth:** `current_user`


### `DELETE /estimates/{estimate_id}`

**Function:** `delete_estimate` (line 332)

**Parameters:** `estimate_id`

**Auth:** `current_user`


---

## finance_expenses.py

Finance API — Employee Expense Management.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/expenses` | `list_expenses` | — |
| `POST` | `/expenses` | `create_expense` | — |
| `GET` | `/expenses/export` | `export_expenses` | — |
| `GET` | `/expenses/{expense_id}` | `get_expense` | — |
| `PUT` | `/expenses/{expense_id}` | `update_expense` | — |
| `PUT` | `/expenses/{expense_id}/submit` | `submit_expense` | — |
| `PUT` | `/expenses/{expense_id}/approve` | `approve_expense` | — |
| `PUT` | `/expenses/{expense_id}/reject` | `reject_expense` | — |
| `PUT` | `/expenses/{expense_id}/reimburse` | `reimburse_expense` | — |
| `POST` | `/expenses/{expense_id}/receipt` | `upload_expense_receipt` | Upload a receipt photo or PDF and attach it to the expense. |
| `GET` | `/expenses/{expense_id}/receipt` | `get_expense_receipt` | Return a pre-signed URL to download the receipt. |

### `GET /expenses`

**Function:** `list_expenses` (line 71)

**Parameters:** `status_filter`, `user_id`, `category`, `start_date`, `end_date`, `page`, `limit`

**Auth:** `current_user`


### `POST /expenses`

**Function:** `create_expense` (line 118)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /expenses/export`

**Function:** `export_expenses` (line 141)

**Parameters:** `status_filter`, `start_date`, `end_date`

**Auth:** `current_user`


### `GET /expenses/{expense_id}`

**Function:** `get_expense` (line 188)

**Parameters:** `expense_id`

**Auth:** `current_user`


### `PUT /expenses/{expense_id}`

**Function:** `update_expense` (line 202)

**Parameters:** `expense_id`, `payload`

**Auth:** `current_user`


### `PUT /expenses/{expense_id}/submit`

**Function:** `submit_expense` (line 228)

**Parameters:** `expense_id`

**Auth:** `current_user`


### `PUT /expenses/{expense_id}/approve`

**Function:** `approve_expense` (line 264)

**Parameters:** `expense_id`

**Auth:** `current_user`


### `PUT /expenses/{expense_id}/reject`

**Function:** `reject_expense` (line 301)

**Parameters:** `expense_id`, `payload`

**Auth:** `current_user`


### `PUT /expenses/{expense_id}/reimburse`

**Function:** `reimburse_expense` (line 337)

**Parameters:** `expense_id`

**Auth:** `current_user`


### `POST /expenses/{expense_id}/receipt`

**Function:** `upload_expense_receipt` (line 370)

Upload a receipt photo or PDF and attach it to the expense.

**Parameters:** `expense_id`, `file`

**Auth:** `current_user`


### `GET /expenses/{expense_id}/receipt`

**Function:** `get_expense_receipt` (line 444)

Return a pre-signed URL to download the receipt.

**Parameters:** `expense_id`

**Auth:** `current_user`


---

## finance_ext.py

Finance Extensions API — Currencies, Exchange Rates, Bank Statements, Reconciliation, P&L, Balance Sheet.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/currencies` | `list_currencies` | — |
| `POST` | `/currencies` | `create_currency` | — |
| `PUT` | `/currencies/{currency_id}` | `update_currency` | — |
| `DELETE` | `/currencies/{currency_id}` | `delete_currency` | — |
| `GET` | `/exchange-rates` | `list_exchange_rates` | — |
| `POST` | `/exchange-rates` | `create_exchange_rate` | — |
| `POST` | `/bank-statements/import` | `import_bank_statement` | — |
| `GET` | `/bank-statements` | `list_bank_statements` | — |
| `GET` | `/bank-statements/{statement_id}` | `get_bank_statement` | — |
| `POST` | `/bank-statements/{statement_id}/auto-match` | `auto_match_statement` | — |
| `POST` | `/bank-statements/{statement_id}/reconcile` | `reconcile_statement` | — |
| `GET` | `/reports/pnl` | `pnl_report` | Generate a P&L report for the given date range. |
| `GET` | `/reports/balance-sheet` | `balance_sheet_report` | Balance Sheet: Assets = Liabilities + Equity. |

### `GET /currencies`

**Function:** `list_currencies` (line 99)

**Auth:** `current_user`


### `POST /currencies`

**Function:** `create_currency` (line 112)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `PUT /currencies/{currency_id}`

**Function:** `update_currency` (line 137)

**Parameters:** `currency_id`, `payload`, `_admin`

**Auth:** `current_user`


### `DELETE /currencies/{currency_id}`

**Function:** `delete_currency` (line 164)

**Parameters:** `currency_id`, `_admin`

**Auth:** `current_user`


### `GET /exchange-rates`

**Function:** `list_exchange_rates` (line 181)

**Parameters:** `from_currency_id`, `to_currency_id`

**Auth:** `current_user`


### `POST /exchange-rates`

**Function:** `create_exchange_rate` (line 207)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `POST /bank-statements/import`

**Function:** `import_bank_statement` (line 228)

**Parameters:** `account_id`, `statement_date`, `file`, `_admin`

**Auth:** `current_user`


### `GET /bank-statements`

**Function:** `list_bank_statements` (line 301)

**Parameters:** `account_id`

**Auth:** `current_user`


### `GET /bank-statements/{statement_id}`

**Function:** `get_bank_statement` (line 325)

**Parameters:** `statement_id`

**Auth:** `current_user`


### `POST /bank-statements/{statement_id}/auto-match`

**Function:** `auto_match_statement` (line 352)

**Parameters:** `statement_id`, `_admin`

**Auth:** `current_user`


### `POST /bank-statements/{statement_id}/reconcile`

**Function:** `reconcile_statement` (line 394)

**Parameters:** `statement_id`, `payload`, `_admin`

**Auth:** `current_user`


### `GET /reports/pnl`

**Function:** `pnl_report` (line 433)

Generate a P&L report for the given date range.

Revenue accounts have credits > debits (positive = income).
Expense accounts have debits > credits (positive = expense).

**Parameters:** `from_date`, `to_date`

**Auth:** `current_user`


### `GET /reports/balance-sheet`

**Function:** `balance_sheet_report` (line 518)

Balance Sheet: Assets = Liabilities + Equity.

**Parameters:** `as_of`

**Auth:** `current_user`


---

## finance_recurring.py

Finance API — Recurring Invoices.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/recurring-invoices` | `create_recurring_invoice` | — |
| `GET` | `/recurring-invoices` | `list_recurring_invoices` | — |
| `GET` | `/recurring-invoices/{recurring_id}` | `get_recurring_invoice` | — |
| `PUT` | `/recurring-invoices/{recurring_id}` | `update_recurring_invoice` | — |
| `DELETE` | `/recurring-invoices/{recurring_id}` | `delete_recurring_invoice` | — |
| `POST` | `/recurring-invoices/{recurring_id}/generate` | `generate_recurring_invoice` | — |

### `POST /recurring-invoices`

**Function:** `create_recurring_invoice` (line 123)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /recurring-invoices`

**Function:** `list_recurring_invoices` (line 169)

**Parameters:** `is_active`, `page`, `limit`

**Auth:** `current_user`


### `GET /recurring-invoices/{recurring_id}`

**Function:** `get_recurring_invoice` (line 195)

**Parameters:** `recurring_id`

**Auth:** `current_user`


### `PUT /recurring-invoices/{recurring_id}`

**Function:** `update_recurring_invoice` (line 209)

**Parameters:** `recurring_id`, `payload`

**Auth:** `current_user`


### `DELETE /recurring-invoices/{recurring_id}`

**Function:** `delete_recurring_invoice` (line 240)

**Parameters:** `recurring_id`

**Auth:** `current_user`


### `POST /recurring-invoices/{recurring_id}/generate`

**Function:** `generate_recurring_invoice` (line 261)

**Parameters:** `recurring_id`

**Auth:** `current_user`


---

## finance_reports_ext.py

Finance API — Extended Reports (Cash Flow, Trial Balance, Aged Receivables/Payables, KPIs).


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/reports/cash-flow` | `cash_flow_statement` | — |
| `GET` | `/reports/trial-balance-ext` | `trial_balance_extended` | — |
| `GET` | `/reports/aged-receivables` | `aged_receivables` | — |
| `GET` | `/reports/aged-payables` | `aged_payables` | — |
| `GET` | `/dashboard/kpis` | `dashboard_kpis` | — |
| `GET` | `/reports/{report_type}/export-xlsx` | `export_report_xlsx` | Export trial_balance, pl, balance_sheet, aged_ar, aged_ap, or kpis as XLSX. |
| `GET` | `/reports/revenue-streams` | `revenue_streams_report` | — |
| `GET` | `/reports/project-costing/{project_id}` | `project_costing_report` | — |
| `GET` | `/compliance-events` | `list_compliance_events` | — |
| `POST` | `/compliance-events` | `create_compliance_event` | — |
| `PUT` | `/compliance-events/{event_id}` | `update_compliance_event` | — |
| `PATCH` | `/compliance-events/{event_id}/complete` | `complete_compliance_event` | — |
| `DELETE` | `/compliance-events/{event_id}` | `delete_compliance_event` | — |
| `GET` | `/fx-revaluations` | `list_fx_revaluations` | — |
| `POST` | `/fx-revaluations/run` | `trigger_fx_revaluation` | — |

### `GET /reports/cash-flow`

**Function:** `cash_flow_statement` (line 28)

**Parameters:** `start_date`, `end_date`

**Auth:** `current_user`


### `GET /reports/trial-balance-ext`

**Function:** `trial_balance_extended` (line 140)

**Parameters:** `as_of`

**Auth:** `current_user`


### `GET /reports/aged-receivables`

**Function:** `aged_receivables` (line 204)

**Parameters:** `as_of`

**Auth:** `current_user`


### `GET /reports/aged-payables`

**Function:** `aged_payables` (line 304)

**Parameters:** `as_of`

**Auth:** `current_user`


### `GET /dashboard/kpis`

**Function:** `dashboard_kpis` (line 402)

**Parameters:** `period_start`, `period_end`

**Auth:** `current_user`


### `GET /reports/{report_type}/export-xlsx`

**Function:** `export_report_xlsx` (line 564)

Export trial_balance, pl, balance_sheet, aged_ar, aged_ap, or kpis as XLSX.

**Parameters:** `report_type`, `start_date`, `end_date`

**Auth:** `current_user`


### `GET /reports/revenue-streams`

**Function:** `revenue_streams_report` (line 667)

**Parameters:** `start_date`, `end_date`

**Auth:** `current_user`


### `GET /reports/project-costing/{project_id}`

**Function:** `project_costing_report` (line 734)

**Parameters:** `project_id`

**Auth:** `current_user`


### `GET /compliance-events`

**Function:** `list_compliance_events` (line 804)

**Parameters:** `status`, `category`, `jurisdiction`

**Auth:** `current_user`


### `POST /compliance-events`

**Function:** `create_compliance_event` (line 871)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /compliance-events/{event_id}`

**Function:** `update_compliance_event` (line 897)

**Parameters:** `event_id`, `payload`

**Auth:** `current_user`


### `PATCH /compliance-events/{event_id}/complete`

**Function:** `complete_compliance_event` (line 922)

**Parameters:** `event_id`

**Auth:** `current_user`


### `DELETE /compliance-events/{event_id}`

**Function:** `delete_compliance_event` (line 941)

**Parameters:** `event_id`

**Auth:** `current_user`


### `GET /fx-revaluations`

**Function:** `list_fx_revaluations` (line 965)

**Parameters:** `period`

**Auth:** `current_user`


### `POST /fx-revaluations/run`

**Function:** `trigger_fx_revaluation` (line 999)

**Auth:** `current_user`


---

## finance_vendor_bills.py

Finance API — Vendor Bills (Accounts Payable).


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/vendor-bills` | `list_vendor_bills` | — |
| `POST` | `/vendor-bills` | `create_vendor_bill` | — |
| `GET` | `/vendor-bills/export` | `export_vendor_bills` | — |
| `GET` | `/vendor-bills/{bill_id}` | `get_vendor_bill` | — |
| `PUT` | `/vendor-bills/{bill_id}` | `update_vendor_bill` | — |
| `PUT` | `/vendor-bills/{bill_id}/approve` | `approve_vendor_bill` | — |
| `POST` | `/vendor-bills/{bill_id}/pay` | `pay_vendor_bill` | — |
| `DELETE` | `/vendor-bills/{bill_id}` | `delete_vendor_bill` | — |

### `GET /vendor-bills`

**Function:** `list_vendor_bills` (line 106)

**Parameters:** `status_filter`, `vendor`, `start_date`, `end_date`, `page`, `limit`

**Auth:** `current_user`


### `POST /vendor-bills`

**Function:** `create_vendor_bill` (line 141)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /vendor-bills/export`

**Function:** `export_vendor_bills` (line 184)

**Parameters:** `status_filter`, `start_date`, `end_date`

**Auth:** `current_user`


### `GET /vendor-bills/{bill_id}`

**Function:** `get_vendor_bill` (line 230)

**Parameters:** `bill_id`

**Auth:** `current_user`


### `PUT /vendor-bills/{bill_id}`

**Function:** `update_vendor_bill` (line 242)

**Parameters:** `bill_id`, `payload`

**Auth:** `current_user`


### `PUT /vendor-bills/{bill_id}/approve`

**Function:** `approve_vendor_bill` (line 270)

**Parameters:** `bill_id`

**Auth:** `current_user`


### `POST /vendor-bills/{bill_id}/pay`

**Function:** `pay_vendor_bill` (line 305)

**Parameters:** `bill_id`, `payload`

**Auth:** `current_user`


### `DELETE /vendor-bills/{bill_id}`

**Function:** `delete_vendor_bill` (line 373)

**Parameters:** `bill_id`

**Auth:** `current_user`


---

## finance_workflows.py

Finance Workflow Rule Engine — configurable automation rules.

Supports: expense.submitted, invoice.overdue, bill.received, bill.approved,
budget.exceeded, invoice.paid, and more. Each rule has conditions + actions.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/workflow-rules/templates` | `list_workflow_templates` | Return built-in workflow rule templates. |
| `GET` | `/workflow-rules` | `list_workflow_rules` | — |
| `POST` | `/workflow-rules` | `create_workflow_rule` | — |
| `GET` | `/workflow-rules/{rule_id}` | `get_workflow_rule` | — |
| `PUT` | `/workflow-rules/{rule_id}` | `update_workflow_rule` | — |
| `DELETE` | `/workflow-rules/{rule_id}` | `delete_workflow_rule` | — |
| `GET` | `/workflow-rules/{rule_id}/executions` | `list_rule_executions` | — |
| `POST` | `/workflow-rules/{rule_id}/test` | `test_workflow_rule` | Dry-run a workflow rule against sample entity data without executing actions. |

### `GET /workflow-rules/templates`

**Function:** `list_workflow_templates` (line 282)

Return built-in workflow rule templates.

**Auth:** `current_user`


### `GET /workflow-rules`

**Function:** `list_workflow_rules` (line 288)

**Parameters:** `trigger_event`, `is_active`, `page`, `limit`

**Auth:** `current_user`


### `POST /workflow-rules`

**Function:** `create_workflow_rule` (line 330)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /workflow-rules/{rule_id}`

**Function:** `get_workflow_rule` (line 352)

**Parameters:** `rule_id`

**Auth:** `current_user`


### `PUT /workflow-rules/{rule_id}`

**Function:** `update_workflow_rule` (line 372)

**Parameters:** `rule_id`, `payload`

**Auth:** `current_user`


### `DELETE /workflow-rules/{rule_id}`

**Function:** `delete_workflow_rule` (line 397)

**Parameters:** `rule_id`

**Auth:** `current_user`


### `GET /workflow-rules/{rule_id}/executions`

**Function:** `list_rule_executions` (line 407)

**Parameters:** `rule_id`, `page`, `limit`

**Auth:** `current_user`


### `POST /workflow-rules/{rule_id}/test`

**Function:** `test_workflow_rule` (line 441)

Dry-run a workflow rule against sample entity data without executing actions.

**Parameters:** `rule_id`, `entity_data`

**Auth:** `current_user`

