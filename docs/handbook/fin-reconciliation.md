---
title: Bank Reconciliation
slug: fin-reconciliation
category: finance
article_type: guide
module: finance
tags: [reconciliation, bank, statement, matching]
sort_order: 12
is_pinned: false
excerpt: Match bank statement transactions to Urban Vibes Dynamics records to ensure your books are accurate.
---

# Bank Reconciliation

Bank reconciliation is the process of comparing your bank statement to the transactions recorded in Urban Vibes Dynamics. It confirms that every deposit and withdrawal on your bank statement has a matching entry in your books, and vice versa. Regular reconciliation catches errors, fraud, and missing entries before they become larger problems.

> **Tip:** Reconcile monthly, ideally within 5 days of receiving your bank statement.

---

## 1. What Bank Reconciliation Is

Your bank statement shows every transaction that actually moved through your bank account during a period. Urban Vibes Dynamics's ledger shows every transaction you have recorded in the system. These two should match — but they often don't, for legitimate reasons:

- A cheque you issued has not yet been cleared by the bank (**timing difference**).
- The bank charged a fee that you haven't recorded in Urban Vibes Dynamics yet (**missing entry**).
- You recorded a transaction in Urban Vibes Dynamics with a slightly different amount (**data entry error**).

Reconciliation identifies all of these differences so you can resolve them and confirm that your closing bank balance matches the system.

---

## 2. Uploading a Bank Statement

Urban Vibes Dynamics accepts bank statements in two formats:

| Format | Description |
|---|---|
| **CSV** | Comma-separated values. Most Kenyan banks export in this format. Columns required: Date, Description, Debit, Credit (or Amount with sign). |
| **OFX** | Open Financial Exchange format. Supported by some banks and accounting software exports. |

To upload:

1. Go to **Finance → Reconciliation**.
2. Select the **Bank Account** you want to reconcile from the dropdown.
3. Click **Upload Statement**.
4. Select your file (CSV or OFX).
5. If uploading a CSV, a column mapping step appears — map your file's columns to Urban Vibes Dynamics's expected fields (Date, Description, Debit, Credit, Reference).
6. Set the **Statement Period** — the start and end dates covered by the statement.
7. Click **Import**.

Urban Vibes Dynamics will display the imported statement lines in the reconciliation view alongside your unreconciled ledger entries.

---

## 3. Auto-Matching

After import, Urban Vibes Dynamics attempts to automatically match statement lines to ledger entries.

**Auto-match criteria:**
- Amount matches exactly (or within a configured tolerance)
- Transaction date matches within ± 3 days
- Reference number matches (if present in both)

Matched pairs are highlighted in green and moved to the **Matched** section. You can review all auto-matches before confirming — click any matched pair to see the details of both the statement line and the ledger entry.

To confirm all auto-matches at once, click **Confirm All Matches**. To confirm individually, click the checkmark on each pair.

To reject an incorrect auto-match (e.g., two transactions happened to have the same amount), click the **X** on the matched pair to unmatch and return both lines to the unmatched queue.

---

## 4. Manual Matching

Statement lines that do not auto-match appear in the **Unmatched Statement Lines** list. Ledger entries without a matching statement line appear in the **Unmatched Ledger Entries** list.

To manually match a statement line to a ledger entry:

1. Click a statement line in the **Unmatched Statement Lines** list to select it (it highlights in blue).
2. In the **Unmatched Ledger Entries** list, find the corresponding payment or receipt.
   - Use the **Search** bar to filter by amount, reference number, or payee name.
   - Use the **Date Range** filter to narrow results.
3. Click the ledger entry to select it.
4. Click **Match Selected** — the pair moves to the Matched section.

You can also match one statement line to **multiple ledger entries** (useful for split transactions — see section 6) or multiple statement lines to one ledger entry.

---

## 5. Recording Missing Transactions

Sometimes your bank statement contains transactions that are not in Urban Vibes Dynamics at all — bank charges, interest income, direct debits, or returned cheques that were never recorded.

To record a missing transaction directly from the reconciliation screen:

1. Select the unmatched statement line.
2. Click **Create Ledger Entry**.
3. Choose the transaction type:
   - **Bank Charge / Fee** → posts a debit to a Bank Charges expense account
   - **Interest Income** → posts a credit to an Interest Income account
   - **Other** → choose any account from the Chart of Accounts
4. Enter the description and confirm the account.
5. Click **Save and Match** — the new ledger entry is created and immediately matched to the statement line.

This approach ensures that every statement line is accounted for in your books.

---

## 6. Handling Split Transactions

A split transaction occurs when one bank statement line corresponds to multiple Urban Vibes Dynamics records. For example, a single bank transfer covers three invoices.

1. Select the statement line from the unmatched list.
2. Click **Split Match**.
3. In the split match panel, search for and select each ledger entry that makes up the total.
4. The running total is shown — it must equal the statement line amount exactly before you can confirm.
5. Once the totals match, click **Confirm Split Match**.

The statement line is now matched to all selected ledger entries as a group.

---

## 7. Marking a Period as Reconciled

Once all statement lines are matched (or accounted for with new entries), you can mark the period as reconciled. This locks the period and prevents further changes to matched entries.

1. Ensure the **Difference** shown at the top of the reconciliation screen reads **KES 0.00** (or your base currency equivalent).
2. Click **Mark Period as Reconciled**.
3. Confirm the closing balance matches your bank statement closing balance.
4. Click **Confirm**.

The period is now locked. A green "Reconciled" badge appears on the bank account for this period. Attempting to edit a transaction from a reconciled period will show a warning.

> To re-open a reconciled period (e.g., to correct an error), a user with Finance Admin or Super Admin role can go to **Finance → Reconciliation → History** and click **Unlock Period**.

---

## 8. Reconciliation Report

After marking a period as reconciled, Urban Vibes Dynamics generates a **Reconciliation Report** you can save or print for your records.

The report includes:

| Section | Content |
|---|---|
| **Opening Balance** | Ledger balance at the start of the period |
| **Transactions in Urban Vibes Dynamics** | All payments and receipts recorded during the period |
| **Transactions on Statement** | All lines from the uploaded bank statement |
| **Matched Transactions** | All matched pairs with amounts |
| **Outstanding Ledger Items** | Entries in Urban Vibes Dynamics not yet on the bank statement (uncleared cheques, etc.) |
| **Outstanding Statement Items** | Bank statement lines not yet in Urban Vibes Dynamics (timing differences) |
| **Closing Balance** | Confirmed closing balance matching the bank statement |
| **Match Percentage** | % of statement lines matched automatically vs manually |

To access: **Finance → Reconciliation → History → [Period] → View Report**.

---

## 9. Common Issues and How to Resolve Them

### Timing Differences — Cheques Not Cleared

**Issue:** You recorded a cheque payment in Urban Vibes Dynamics but it hasn't appeared on the bank statement yet.

**Resolution:** Leave the ledger entry unmatched. It will appear as an "Outstanding Ledger Item" in the reconciliation report. When the cheque clears in the following month's statement, match it then.

### Bank Charges Not Recorded

**Issue:** The bank deducted a monthly fee that isn't in Urban Vibes Dynamics.

**Resolution:** Select the unmatched statement line and use **Create Ledger Entry** to post it to a Bank Charges account (see section 5).

### Wrong Currency on a Transaction

**Issue:** A USD payment was recorded against a KES bank account, or vice versa.

**Resolution:** Void the incorrect payment in Finance → Payments, re-record it correctly, then match the corrected entry to the statement line.

### Amount Mismatch Due to Rounding

**Issue:** The statement shows KES 10,500.00 but the ledger entry is KES 10,499.99 due to exchange rate rounding.

**Resolution:** Use **Manual Match** — select both the statement line and ledger entry and confirm the match despite the small difference. Urban Vibes Dynamics will post the rounding difference (KES 0.01) to the **Rounding Adjustment** account automatically.

### Duplicate Entries

**Issue:** The same payment was recorded twice in Urban Vibes Dynamics.

**Resolution:** Identify the duplicate in the Unmatched Ledger Entries list. Void or delete the duplicate entry (Finance → Payments → [Payment] → Void), then match the remaining entry to the bank statement line.

---

## Next Steps

- [Multi-Currency & Exchange Rates](./fin-multi-currency-setup.md) — reconciling foreign-currency accounts
- [Chart of Accounts Setup](./fin-chart-of-accounts.md) — configure bank charge and rounding adjustment accounts
- [Finance Reports](./fin-reports.md) — generate P&L and cash flow reports after reconciliation
