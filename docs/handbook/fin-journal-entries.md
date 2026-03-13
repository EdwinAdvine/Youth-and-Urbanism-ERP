---
title: Manual Journal Entries
slug: manual-journal-entries
category: finance
article_type: guide
module: finance
tags: [journal, double-entry, adjustments, accounting, closing]
sort_order: 4
is_pinned: false
excerpt: Create manual double-entry journal entries for adjustments, corrections, and closing entries.
---

# Manual Journal Entries

Most transactions in Urban Vibes Dynamics — invoices, payments, bills, payroll — post journal entries automatically. Manual journal entries are for situations that do not fit neatly into those workflows: period-end adjustments, depreciation, foreign exchange revaluation, corrections, and accruals.

> **Who should do this:** Manual journal entries should only be created by your accountant or Finance Admin. An incorrect entry can distort your financial reports significantly.

## When to Use Manual Journal Entries

- **End-of-period accruals** — Recording expenses that have been incurred but not yet invoiced (e.g. December electricity bill not yet received)
- **Depreciation** — Monthly allocation of fixed asset cost to expense
- **Foreign exchange adjustments** — Revaluing USD-denominated balances at month-end exchange rates
- **Corrections** — Fixing a posting that went to the wrong account
- **Inter-company transfers** — Moving funds between related entities
- **Prepaid expense amortisation** — Spreading a lump-sum prepayment across the months it covers

## Step 1: Navigate to Journal Entries

Go to **Finance → Journal** and click **New Entry**.

## Step 2: Fill in the Header

| Field | Description |
|---|---|
| **Date** | The accounting date for this entry (not necessarily today) |
| **Reference** | A short identifier, e.g. "DEP-2025-03" for March depreciation |
| **Description** | A clear explanation of why this entry exists |

## Step 3: Add Journal Lines

Every journal entry must have at least two lines, and the total **Debits must equal total Credits** before you can save.

Click **Add Line** for each line:

| Field | Description |
|---|---|
| **Account** | Search and select the account from your Chart of Accounts |
| **Description** | Optional line-level note |
| **Debit** | Amount on the debit side (leave blank if credit) |
| **Credit** | Amount on the credit side (leave blank if debit) |

**Example — Monthly Depreciation:**

| Account | Debit | Credit |
|---|---|---|
| 5500 – Depreciation Expense | 25,000 | |
| 1500 – Accumulated Depreciation | | 25,000 |

**Example — Accrued Salary (December):**

| Account | Debit | Credit |
|---|---|---|
| 5100 – Salaries Expense | 180,000 | |
| 2200 – Accrued Salaries Payable | | 180,000 |

## Step 4: Save as Draft

Click **Save as Draft**. The entry is stored but has **not yet affected your books**. You can edit, add lines, or delete it at this stage. This is the best time to have a colleague review the entry.

## Step 5: Review and Post

Once you are satisfied the entry is correct, click **Post**. The entry is now **permanent**:

- It is written to the general ledger
- It affects all financial reports
- **You cannot edit a posted journal entry**

This is intentional — posted entries form an immutable audit trail.

## Reversing a Posted Entry

If you discover an error in a posted entry, do not try to delete it. Instead:

1. Open the posted entry
2. Click **Create Reversal**
3. Set the reversal date (usually the first day of the next period)
4. Urban Vibes Dynamics creates a mirror entry with debits and credits swapped, effectively cancelling the original
5. Then post a new, corrected entry

This approach preserves the full audit trail, which is essential for KRA compliance and external audits.

## Viewing the General Ledger

To see every posting to a specific account, go to **Finance → Reports → General Ledger**, filter by account and date range. Each line shows the transaction source — whether it was an invoice, payment, payroll run, or manual journal.

## Tips

- Always write a clear **Description** on both the header and each line. Future-you (and your auditor) will thank you.
- Use consistent reference prefixes: `DEP-` for depreciation, `ACR-` for accruals, `FX-` for forex, `COR-` for corrections.
- If you are unsure whether a manual entry is needed, check whether the transaction can be entered through a native workflow (invoice, expense claim, etc.) first. Native workflows are less error-prone.
