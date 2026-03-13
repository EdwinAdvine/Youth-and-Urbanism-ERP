---
title: Finance User Quick Start
slug: finance-user-quick-start
category: getting-started
article_type: quickstart
module: finance
tags: [finance, invoice, payment, accounts-receivable]
sort_order: 2
is_pinned: false
excerpt: Get started with Finance: create your first invoice and record a payment.
---

# Finance User Quick Start

This guide takes you from zero to your first paid invoice in Urban Vibes Dynamics Finance. By the end you will know how to create a customer invoice, send it, and record the incoming payment.

---

## Navigating Finance

Click **Finance** in the left sidebar. The Finance module has six primary sections:

- **Dashboard** — revenue overview, outstanding totals, recent transactions
- **Invoices** — customer invoices (`/finance/invoices`)
- **Bills** — vendor/supplier bills (`/finance/bills`)
- **Expenses** — employee expense submissions (`/finance/expenses`)
- **Accounts** — chart of accounts and journal entries (`/finance/accounts`)
- **Reports** — P&L, balance sheet, cash flow (`/finance/reports`)

---

## Step 1 — Create a Customer Invoice

1. Go to **Finance → Invoices** and click **+ New Invoice** (top right).
2. Fill in the header:
   - **Customer** — type to search existing contacts (or create one inline with the **+** icon)
   - **Invoice Date** — defaults to today
   - **Due Date** — set your payment terms (e.g. net 30)
   - **Reference / PO Number** — optional, but useful for matching payments
3. Add line items:
   - Click **+ Add Line**
   - Enter description, quantity, unit price, and tax rate
   - Urban Vibes Dynamics calculates subtotal, tax, and total automatically
4. Add any notes in the **Memo** field (these appear on the PDF).
5. Click **Save as Draft**.

Your invoice is now in **Draft** status. You can edit it freely at this stage.

---

## Step 2 — Review and Send

1. Open the draft invoice and click **Preview** to see the PDF exactly as the customer will receive it.
2. When satisfied, click **Send Invoice**.
3. In the send dialog, confirm the customer's email address, edit the subject/body if needed, and click **Send**.

The invoice status changes to **Sent**. A PDF is automatically attached to the outgoing email, and a copy is stored in the Finance file log.

> **Pro tip:** You can also click **Download PDF** to send the invoice manually via your own email client — useful when delivering to a customer in person.

---

## Step 3 — Record a Payment

When the customer pays, record it against the invoice:

1. Find the invoice in **Finance → Invoices** (filter by **Sent** status).
2. Open the invoice and click **Record Payment**.
3. Fill in:
   - **Payment Date** — the date funds arrived
   - **Amount** — partial payments are supported
   - **Payment Method** — Bank Transfer, Cash, Card, Cheque, etc.
   - **Reference** — bank transaction ID or cheque number
4. Click **Save Payment**.

If the payment covers the full outstanding balance, the invoice status automatically moves to **Paid**. Partial payments leave it as **Partial** and show the remaining balance prominently.

---

## Step 4 — View Outstanding Invoices

Go to **Finance → Invoices** and use the status filter to select **Sent** or **Partial**. You can also sort by **Due Date** (ascending) to see what is overdue first.

The Finance Dashboard at `/finance` shows an **Accounts Receivable Aging** widget — a quick visual of what is current, 30 days, 60 days, and 90+ days overdue.

---

## What is Next

- **Bulk send reminders:** Select multiple overdue invoices → **Actions → Send Reminder**.
- **Recurring invoices:** Open any invoice → **More → Make Recurring** to set up automatic monthly billing.
- **Connect to Projects:** From a project, go to **Integrations → Create Invoice** to auto-populate line items from tracked time or milestones.
