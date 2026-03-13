---
title: Recording Payments Against Invoices
slug: recording-payments-invoices
category: finance
article_type: guide
module: finance
tags: [invoices, payments, mpesa, receivables, journal]
sort_order: 2
is_pinned: false
excerpt: Mark an invoice as paid by recording a payment — including partial payments.
---

# Recording Payments Against Invoices

When a customer pays — whether by M-Pesa, bank transfer, cash, or card — you record the payment against their invoice in Urban Vibes Dynamics. The system updates the invoice status, reduces the outstanding balance, and automatically posts the corresponding journal entry to your books.

## Step 1: Open the Invoice

Go to **Finance → Invoices** and find the invoice you want to mark as paid. You can search by invoice number, customer name, or filter by status (Sent, Overdue, Partial).

Click the invoice to open it.

## Step 2: Click Record Payment

At the top of the invoice detail page, click the **Record Payment** button. A payment dialog opens.

## Step 3: Enter Payment Details

| Field | Description |
|---|---|
| **Amount** | How much the customer paid. Enter the exact amount received. |
| **Payment Date** | When you received the money. Defaults to today. |
| **Payment Method** | Cash, Card, Bank Transfer, M-Pesa, Cheque |
| **Reference** | Optional — e.g. M-Pesa confirmation code, bank transaction ID |
| **Notes** | Internal note for your records |

## Step 4: Understand Partial vs Full Payment

- **Full payment** (amount equals invoice balance): Invoice status changes to **Paid**. The outstanding balance becomes zero.
- **Partial payment** (amount is less than invoice balance): Invoice status changes to **Partial**. The remaining balance stays open, and you can record additional payments later until the invoice is fully settled.

**Example:** You issue an invoice for KES 50,000 to Nairobi Tech Ltd. They send you KES 30,000 via M-Pesa on the due date and promise the rest next week. Record KES 30,000 as a partial payment. The invoice shows **Partial — KES 20,000 outstanding**. When the second payment arrives, record it the same way to close the invoice.

## Step 5: Choose the Bank/Cash Account

Select which account the money landed in — e.g. **KCB Bank Account**, **Equity Bank**, **Cash on Hand**, or **M-Pesa Float**. These accounts must exist in your Chart of Accounts. If the account is missing, ask your Finance Admin to add it under **Finance → Chart of Accounts**.

## Step 6: Confirm the Journal Entry

Click **Save Payment**. Urban Vibes Dynamics automatically posts a double-entry journal entry:

| Debit | Credit |
|---|---|
| Bank / Cash Account | Accounts Receivable |

You do not need to create this journal entry manually — the system handles it for you.

## Viewing Payment History

On any invoice, scroll to the **Payments** section at the bottom of the invoice detail page. Each recorded payment is listed with its date, amount, method, and reference code.

If a payment was recorded in error, click the payment entry and select **Void Payment**. This reverses the journal entry and restores the invoice balance. Do not simply delete payments — always void them to maintain accurate books.

## Tips

- Always record payments on the same day you receive them. This keeps your accounts receivable report accurate.
- For M-Pesa payments, paste the Safaricom confirmation message code in the **Reference** field. This helps during reconciliation and audit.
- If a customer overpays, record the full amount received and then issue a credit note for the excess — or leave it as a customer credit to apply on the next invoice.
