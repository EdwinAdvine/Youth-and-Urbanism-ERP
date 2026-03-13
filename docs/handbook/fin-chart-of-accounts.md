---
title: Chart of Accounts Setup
slug: chart-of-accounts-setup
category: finance
article_type: guide
module: finance
tags: [chart-of-accounts, accounting, setup, accounts, hierarchy]
sort_order: 3
is_pinned: false
excerpt: Structure your accounting with a hierarchical Chart of Accounts using the 1xxx-5xxx numbering system.
---

# Chart of Accounts Setup

The Chart of Accounts (CoA) is the foundation of your entire accounting structure. Every transaction in Urban Vibes Dynamics — every invoice, payment, expense, and journal entry — posts to one or more accounts in your CoA. Getting this right from the start saves significant cleanup work later.

## Account Numbering System

Urban Vibes Dynamics uses a standard five-class numbering convention:

| Range | Type | Examples |
|---|---|---|
| **1000–1999** | Assets | Cash, Bank, Receivables, Inventory, Fixed Assets |
| **2000–2999** | Liabilities | Accounts Payable, VAT Payable, Loans, Accruals |
| **3000–3999** | Equity | Retained Earnings, Share Capital, Owner's Draw |
| **4000–4999** | Revenue | Sales Revenue, Service Income, Interest Income |
| **5000–5999** | Expenses | Salaries, Rent, Utilities, Cost of Goods Sold |

This structure means that at a glance, account number **5120** is an expense account, while **1050** is an asset.

## Default Accounts Created by Urban Vibes Dynamics

When your company is first set up, Urban Vibes Dynamics creates a standard set of accounts automatically:

- **1000** — Cash on Hand
- **1010** — Bank Account (Primary)
- **1100** — Accounts Receivable
- **1200** — Inventory
- **2000** — Accounts Payable
- **2100** — VAT Payable
- **3000** — Retained Earnings
- **4000** — Sales Revenue
- **5000** — Cost of Goods Sold
- **5100** — General & Administrative Expenses

These system accounts are used by automated processes (invoice payments, payroll, PO completion). **Do not delete or renumber them.** You can rename them if needed, but their codes must remain intact.

## Creating a New Account

Navigate to **Finance → Chart of Accounts** and click **New Account**.

| Field | Description |
|---|---|
| **Account Code** | A unique number within the correct range (e.g. 5220 for a new expense) |
| **Account Name** | Clear, descriptive name (e.g. "Staff Training Expenses") |
| **Account Type** | Asset, Liability, Equity, Revenue, or Expense |
| **Parent Account** | Optional — assign a parent to create a sub-account hierarchy |
| **Description** | Internal note about what this account is used for |

## Creating a Hierarchy with Sub-Accounts

Sub-accounts let you track spending at a granular level while still rolling up totals to the parent. For example:

```
5100  General & Administrative Expenses
  5110  Rent
  5120  Utilities
    5121  Electricity
    5122  Water
    5123  Internet
  5130  Office Supplies
```

To create **5121 Electricity**, set its parent to **5120 Utilities**. When you run reports, totals for 5121 and 5122 and 5123 roll up into 5120, and 5120 rolls up into 5100. This makes your P&L clean at the top level while preserving detail when you drill down.

## When to Create Sub-Accounts

Create sub-accounts when:
- You need to track multiple cost centres separately (e.g. Marketing Dept Salaries vs Engineering Dept Salaries)
- You operate from multiple locations and want per-location expense visibility
- Your business has distinct revenue streams (e.g. Product Sales vs Consulting Fees vs Training Revenue)

## Account Types and Tax Impact

Revenue accounts (4xxx) and Expense accounts (5xxx) flow through the **Profit & Loss** statement. Asset and Liability accounts (1xxx–2xxx) appear on the **Balance Sheet**. Equity accounts (3xxx) appear on the Balance Sheet under owners' equity. Urban Vibes Dynamics uses the account type you set to ensure each account appears in the correct section of every report.

## Important Rules

- **Never delete a system account.** If it has been used in any transaction, the system will block deletion anyway.
- **Never reuse an account code.** Each code must be unique.
- You can **deactivate** an account (mark it inactive) to hide it from dropdowns without deleting it.
- Changes to the CoA take effect immediately — all future transactions will use the updated structure.

> **Tip:** Before your financial year begins, review the CoA with your accountant and agree on the full account list. Adding accounts mid-year is fine, but it can complicate year-on-year comparisons if new categories are introduced inconsistently.
