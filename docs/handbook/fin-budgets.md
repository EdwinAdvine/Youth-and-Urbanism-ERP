---
title: Setting Up Budgets
slug: setting-up-budgets
category: finance
article_type: guide
module: finance
tags: [budgets, forecasting, actuals, departments, planning]
sort_order: 6
is_pinned: false
excerpt: Create annual or quarterly budgets and track actuals vs budget in real time.
---

# Setting Up Budgets

Budgets in Urban Vibes Dynamics give you a target to measure actual financial performance against. Once configured, every transaction that posts to a budgeted account is tracked in real time — no manual spreadsheet updates required.

## Step 1: Create a New Budget

Navigate to **Finance → Budgets** and click **New Budget**.

| Field | Description |
|---|---|
| **Budget Name** | A clear label, e.g. "FY 2025 Annual Budget" or "Q2 2025 – Marketing Dept" |
| **Period Type** | Annual (Jan–Dec) or Quarterly (select which quarter) |
| **Start Date / End Date** | The budget period. For an annual budget, this is typically 1 Jan to 31 Dec. |
| **Department** | Optional — restrict this budget to a specific department or cost centre |
| **Description** | Internal notes about the budget's purpose |

Click **Save** to create the budget shell. You will then be taken to the budget lines editor.

## Step 2: Add Budget Lines

Each budget line ties a specific account to a planned amount for the period.

Click **Add Budget Line** and fill in:

| Field | Description |
|---|---|
| **Account** | Select from your Chart of Accounts — typically revenue (4xxx) or expense (5xxx) accounts |
| **Budgeted Amount** | The total planned amount for the full period |
| **Monthly Distribution** | Choose **Even** (amount ÷ 12 per month) or **Manual** (enter each month individually) |

**Example budget lines for a small business:**

| Account | Annual Budget |
|---|---|
| 4000 – Sales Revenue | KES 6,000,000 |
| 5100 – Salaries | KES 2,400,000 |
| 5110 – Rent | KES 480,000 |
| 5120 – Utilities | KES 120,000 |
| 5200 – Marketing | KES 360,000 |
| 5300 – Travel & Transport | KES 180,000 |

For seasonal businesses — for instance a company with peak sales in November and December — use **Manual** distribution and enter higher amounts in those months.

## Step 3: View Budget vs Actuals

Once transactions start posting, Urban Vibes Dynamics compares them against your budget automatically. Go to **Finance → Budgets**, open your budget, and click the **Actuals** tab.

You will see a table with:

- **Budgeted** — the planned amount for the period
- **Actual** — what has actually been spent or earned
- **Variance** — the difference (positive = under budget on expenses, negative = over budget)
- **% Used** — how much of the budget has been consumed

Accounts that are more than **10% over budget** are highlighted in red. This gives you an immediate visual alert to investigate.

## Using Budgets for Department Spending Control

If each department has its own budget, department heads can be granted read-only access to their specific budget report. This creates accountability without giving staff access to the full P&L.

**Example workflow:**
1. Finance Admin creates a "Q3 2025 – Engineering Dept" budget with a KES 500,000 expense ceiling
2. Engineering Manager is given access to that budget view
3. Each time an expense is posted to an Engineering account, the actual updates in real time
4. When actuals hit 80% of budget, the Engineering Manager sees the warning and adjusts spending

## Quarterly Reviews

It is good practice to review budget vs actuals at the end of each month with your management team. Look for:

- **Revenue lines** that are behind target — indicates a pipeline or collection problem
- **Expense lines** running over — investigate whether this is a one-off or a structural issue
- **Accounts with zero actuals** — double-check that transactions are being posted to the correct accounts

You can export the budget vs actuals comparison from **Finance → Reports → Budget Report** as a CSV to share in management meetings.

## Tips

- Create your annual budget **before** the financial year begins so you have targets from day one.
- Do not obsess over precision on every line — a reasonable estimate is far better than no budget at all.
- You can create multiple budgets (e.g. a conservative budget and an optimistic budget) and compare each against actuals.
