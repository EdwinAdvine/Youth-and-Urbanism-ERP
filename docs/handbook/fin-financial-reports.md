---
title: Financial Reports Guide
slug: financial-reports-guide
category: finance
article_type: guide
module: finance
tags: [reports, p&l, balance-sheet, cash-flow, trial-balance, receivables]
sort_order: 5
is_pinned: false
excerpt: Run P&L, Balance Sheet, Cash Flow, Trial Balance, and Aged Receivables reports.
---

# Financial Reports Guide

Urban Vibes Dynamics generates all your core financial reports from live data — no exports to spreadsheets required. Reports draw directly from your posted journal entries and transactions, so the numbers are always up to date.

## Accessing Reports

Navigate to **Finance → Reports**. You will see a list of all available reports. Click any report name to open it with default parameters, then adjust the date range and filters as needed.

## Available Reports

### Profit & Loss (Income Statement)

Shows your revenues and expenses over a period, resulting in a net profit or net loss.

**How to read it:**
- **Revenue** section (4xxx accounts) shows all income earned in the period
- **Cost of Goods Sold** is subtracted to give **Gross Profit**
- **Operating Expenses** (5xxx accounts) are subtracted from Gross Profit to give **Operating Profit**
- Any interest income/expense gives the final **Net Profit**

Use the P&L to answer: *"Did we make money this month?"* and *"Which expense categories are growing?"*

**Date range tip:** Compare the same period year-on-year (e.g. Q1 2025 vs Q1 2024) to spot trends rather than looking at a single month in isolation.

### Balance Sheet

A snapshot of your financial position at a single point in time.

**How to read it:**
- **Assets** (what you own): cash, receivables, inventory, fixed assets
- **Liabilities** (what you owe): payables, loans, accruals, tax payable
- **Equity** (the difference): retained earnings + share capital

The fundamental equation always holds: **Assets = Liabilities + Equity**

Use the Balance Sheet to assess solvency and how much of the business is funded by debt vs owner equity.

### Cash Flow Statement

Shows actual cash movements — inflows and outflows — separated into Operating, Investing, and Financing activities.

Note: A business can show a P&L profit but negative cash flow if customers are slow to pay. The Cash Flow report exposes this gap and is often more useful for day-to-day decisions than the P&L.

### Trial Balance

Lists every account with its total debits and total credits for a period. Used primarily by accountants to verify that the books are balanced before preparing final statements. If Debits ≠ Credits, there is a data entry error somewhere.

### Aged Receivables

Shows outstanding customer invoices grouped by how long they have been overdue: **Current, 1–30 days, 31–60 days, 61–90 days, 90+ days**.

This report is your primary collections tool. Review it weekly and prioritise chasing the 60+ day column — these are the invoices most at risk of becoming bad debts.

**Example:** Pineapple Exports Ltd owes KES 120,000 in the 61–90 day bucket. That is a high-priority call or email today.

### Aged Payables

The mirror of Aged Receivables — shows what you owe suppliers and how overdue each bill is. Helps you plan payment runs and avoid straining supplier relationships.

### General Ledger

A full transaction-by-transaction listing for one or more accounts over a date range. Used for drilling into a specific account to investigate unusual balances.

## Filtering and Date Ranges

Every report has a **Date Range** filter at the top. Common options:

- This Month / Last Month
- This Quarter / Last Quarter
- This Financial Year / Last Financial Year
- Custom range (pick any start and end date)

You can also filter by **Department** or **Cost Centre** if your Chart of Accounts is structured with those sub-accounts.

## Exporting Reports

Click the **Export** button (top-right of any report) to download as **CSV**. This is useful for sharing with your external accountant or for importing into a KRA filing spreadsheet.

## Access Permissions

Financial reports are visible to:
- **Finance App Admin** — full access to all reports
- **Management roles** — read-only access to P&L and Balance Sheet (configurable by Super Admin)
- **Regular users** — no access to financial reports by default

If you need report access and do not have it, ask your Super Admin to update your permissions in **Settings → Users & Roles**.
