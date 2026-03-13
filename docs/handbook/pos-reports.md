---
title: POS Sales Reports
slug: pos-sales-reports
category: pos
article_type: guide
module: pos
tags: [pos, reports, sales-summary, analytics, cashier, finance-sync]
sort_order: 3
is_pinned: false
excerpt: Analyse POS performance with daily sales summaries, top products, and cashier reports.
---

# POS Sales Reports

Urban Vibes Dynamics generates a comprehensive set of POS reports that let you analyse daily performance, identify top sellers, evaluate cashier productivity, and verify that POS transactions have synced correctly to Finance.

## Accessing POS Reports

Navigate to **POS → Reports**. Select the date range using the date picker (default: today). All reports can be filtered by terminal and cashier.

## Daily Sales Summary

The Daily Sales Summary is the first report to review each morning. It shows:

- **Total Revenue** — Gross sales for the day before discounts and refunds.
- **Discounts Given** — Total discount value applied across all transactions.
- **Refunds** — Total refund value and number of refund transactions.
- **Net Revenue** — Revenue after discounts and refunds.
- **Number of Transactions** — Total sales count.
- **Average Transaction Value** — Net Revenue ÷ Transactions.
- **Busiest Hour** — The hour with the highest transaction volume (useful for staffing decisions).

The summary is broken down by terminal when multiple terminals are in use, and a daily total row aggregates all terminals.

## Top Products Report

Navigate to **POS → Reports → Top Products**. Select your ranking metric:

- **By Revenue** — Products generating the most income. Identifies your most profitable sellers.
- **By Quantity** — Products sold in the highest volume. May differ significantly from revenue ranking (e.g. a KES 50 item sold 200 times versus a KES 500 item sold 30 times).

The report shows the top 20 products by default. Adjust the limit or filter by category to drill into specific product groups. Use this report weekly to make restocking and promotion decisions.

## Sales by Payment Method

This report shows the breakdown of revenue by how customers paid:

| Payment Method | Transactions | Total (KES) | % of Revenue |
|---|---|---|---|
| Cash | 142 | 48,500 | 38% |
| Card | 89 | 61,200 | 48% |
| Mpesa | 34 | 17,800 | 14% |

Use this report to manage cash handling (how much cash to retain in the till versus bank daily) and to reconcile card and Mpesa settlements with your bank and Mpesa merchant statement.

## Cashier Performance Report

Navigate to **POS → Reports → Cashier Performance**. For each cashier and session:

- Total sales value.
- Number of transactions.
- Average transaction duration (start-to-completion).
- Discounts authorised (flagged if above cashier's authorised discount limit).
- Refunds processed.
- Cash variance at session close.

This report is useful for identifying cashiers who consistently have cash variances or unusually high discount rates.

## Session Close Report

Every closed POS session generates a **Session Close Report**, accessible under **POS → Sessions → [Session] → Close Report**. This PDF-formatted report includes:

- Opening and closing float.
- Sales by payment method.
- Expected vs. actual cash count.
- Variance amount and any explanation entered by the cashier.
- Total transactions and net revenue for the session.

The Session Close Report should be printed and signed by the cashier and supervisor as the official end-of-shift record.

## How POS Sales Sync to Finance

When a session is closed, Urban Vibes Dynamics automatically posts a journal entry to Finance for all transactions in that session:

```
Dr  Cash in Hand (or Card Clearing Account)      [amount by payment method]
Dr  Mpesa Clearing Account                       [Mpesa amount]
    Cr  Revenue — Retail Sales                   [net sales excl. VAT]
    Cr  VAT Payable                              [VAT collected]
```

Refunds post the reverse entry. Discounts reduce the revenue credit. You can view these journal entries in **Finance → Journal Entries**, filtered by source "POS".

The Finance team does not need to do any manual data entry for POS sales — the sync is automatic on session close.

## Exporting Reports

Every POS report has an **Export to CSV** button in the top-right corner. The CSV export includes all columns shown in the report plus the individual transaction IDs for reconciliation purposes.

## Tips

- Review the Top Products report weekly and compare to the prior week — sudden drops in a product's sales often indicate a stockout or a display issue at the till.
- Reconcile the Sales by Payment Method report against your bank statement and Mpesa merchant portal weekly to catch any missing settlements early.
- Set a calendar reminder to pull the Session Close Reports for each terminal daily — do not let variances accumulate unreviewed.
