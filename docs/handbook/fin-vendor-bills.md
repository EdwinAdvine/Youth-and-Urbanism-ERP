---
title: Vendor Bills & Accounts Payable
slug: vendor-bills-accounts-payable
category: finance
article_type: guide
module: finance
tags: [vendor-bills, accounts-payable, suppliers, bills, supply-chain]
sort_order: 9
is_pinned: false
excerpt: Record and pay supplier invoices through the vendor bills workflow.
---

# Vendor Bills & Accounts Payable

A vendor bill (also called a supplier invoice) is what you receive from a supplier asking you to pay for goods or services they have delivered. Recording bills in Urban Vibes Dynamics keeps your accounts payable accurate, ensures you never miss a payment, and maintains a full audit trail for every supplier transaction.

## Step 1: Create a New Vendor Bill

Navigate to **Finance → Vendor Bills** and click **New Bill**.

| Field | Description |
|---|---|
| **Supplier** | Search for the supplier from your contacts. Add inline if new. |
| **Supplier Invoice No.** | The invoice number from the supplier's document (for your records and reconciliation) |
| **Bill Date** | The date on the supplier's invoice |
| **Due Date** | When payment is due. If the supplier gives you Net 30 terms, set this 30 days after the bill date. |

## Step 2: Add Line Items

Click **Add Line** for each item on the supplier's invoice:

| Field | Description |
|---|---|
| **Description** | What was delivered, e.g. "500 reams A4 paper" |
| **Quantity** | Number of units |
| **Unit Price** | Price per unit |
| **Tax** | Input VAT rate if applicable (e.g. VAT 16% — you will claim this as input VAT) |
| **Account** | The expense or asset account to post to (e.g. 1200 Inventory, 5300 Office Supplies) |

## Step 3: Save as Draft

Click **Save Draft**. The bill is saved but has not yet posted to your books. Review the line items carefully — confirm the amounts match the paper invoice from the supplier before proceeding.

## Step 4: Approve the Bill

Once reviewed, click **Approve**. This posts the journal entry:

| Debit | Credit |
|---|---|
| Expense / Asset Account | Accounts Payable (2000) |

Your accounts payable balance increases by the bill amount.

## Step 5: Record Payment When You Pay

When you transfer money to the supplier, open the bill and click **Record Payment**:

- Enter the amount paid
- Select payment method and account (e.g. KCB Bank → Bank Transfer)
- Enter the reference (bank transaction ID, M-Pesa code, cheque number)

Urban Vibes Dynamics posts:

| Debit | Credit |
|---|---|
| Accounts Payable (2000) | Bank Account |

If you pay the full amount, the bill status changes to **Paid**. Partial payments move it to **Partial**.

## Aged Payables Report

Go to **Finance → Reports → Aged Payables** to see all outstanding bills grouped by how overdue they are:

- **Current** — not yet due
- **1–30 days overdue**
- **31–60 days overdue**
- **61+ days overdue**

Use this report weekly to plan your payment run. Prioritise suppliers with the shortest terms and most critical relationships. Late payment to key suppliers like logistics companies or raw material vendors can disrupt your operations.

## Integration with Supply Chain

When a Purchase Order in the **Supply Chain** module is marked as **Received** (goods delivered and confirmed), Urban Vibes Dynamics automatically creates a draft vendor bill pre-filled with all the PO line items. This means you do not need to re-enter the data manually — just open the auto-created bill, verify the amounts against the supplier's invoice, and approve.

This PO-to-bill matching helps catch discrepancies: if the supplier bills you for 100 units but the PO was for 80, the mismatch is immediately visible.

## Recurring Bills

For fixed monthly expenses — rent, internet, software subscriptions — enable the **Recurring** toggle and set the frequency. Urban Vibes Dynamics will auto-generate the draft bill each month so you just need to review and approve it.

## Tips

- Always enter bills promptly after receiving them. Bills sitting in a desk drawer are liabilities that are not on your books yet — this understates your payables and distorts your cash flow.
- For suppliers who issue invoices in USD, enter the amount in KES at the day's exchange rate and note the original USD amount in the description field.
- Keep scanned copies of all supplier invoices attached to each bill record. This is essential documentation during a KRA audit.
