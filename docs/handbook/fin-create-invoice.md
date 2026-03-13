---
title: Creating and Sending Invoices
slug: creating-sending-invoices
category: finance
article_type: guide
module: finance
tags: [invoices, billing, tax, vat, customers]
sort_order: 1
is_pinned: false
excerpt: How to create a customer invoice, add line items, apply tax, and email it to the customer.
---

# Creating and Sending Invoices

Invoicing is the core of your accounts receivable workflow. Urban Vibes Dynamics gives you a clean, step-by-step process to create, preview, and send professional invoices directly to your customers — all from one screen.

## Step 1: Navigate to Invoices

Go to **Finance → Invoices** and click **New Invoice** in the top-right corner. The invoice form opens in a full-page editor.

## Step 2: Fill in Customer Details

- **Customer Name** — Start typing to search existing contacts. If the customer does not exist yet, you can add them inline and they will be saved to CRM Contacts automatically.
- **Customer Email** — This is the address the invoice PDF will be sent to. Confirm it is correct before proceeding.
- **Invoice Date** — Defaults to today.
- **Due Date** — Set the payment deadline. Common terms in Kenya: Net 7, Net 14, Net 30. The system will flag overdue invoices automatically once this date passes.
- **Invoice Number** — Auto-generated sequentially (e.g. INV-0042). You can override this if you need to match a custom numbering scheme.

## Step 3: Add Line Items

Click **Add Line Item** for each product or service you are billing for.

| Field | Description |
|---|---|
| Description | What the customer is paying for. Be specific — e.g. "Website Design – April 2025" |
| Quantity | Number of units, hours, or items |
| Unit Price | Price per unit in KES |
| Tax | Apply a tax rate (see below) |

The subtotal, tax amount, and grand total update in real time as you add items.

## Step 4: Apply VAT

Kenya's standard VAT rate is **16%**. Select **VAT 16%** from the tax dropdown on each taxable line item. Urban Vibes Dynamics calculates and displays the tax amount per line and the total tax at the bottom of the invoice.

If you supply zero-rated goods or services (e.g. certain food items, exports), select **VAT 0%**. Exempt supplies should have no tax rate applied.

> **Tip:** Tax rates are configured globally under **Finance → Tax Rates**. If the rate you need does not appear in the dropdown, ask your Finance Admin to add it.

## Step 5: Add Notes or Payment Instructions

Use the **Notes** field at the bottom to include payment instructions — for example: *"Please pay via M-Pesa Paybill 123456, Account: INV-0042"* or bank transfer details. This text appears on the printed/PDF invoice.

## Step 6: Save as Draft

Click **Save as Draft**. The invoice is saved with status **Draft** and is not yet visible to the customer. You can return and edit a draft invoice at any time.

## Step 7: Preview the PDF

Click **Preview** to see exactly what the customer will receive. Check that the company logo, address, and line items are correct. Your company details (logo, address, KRA PIN) are configured in **Settings → Company Profile**.

## Step 8: Send the Invoice

When you are satisfied, click **Send Invoice**. Urban Vibes Dynamics emails the PDF to the customer's email address. The invoice status changes from **Draft → Sent**.

## Tracking Invoice Status

| Status | Meaning |
|---|---|
| Draft | Created but not sent |
| Sent | Emailed to customer, awaiting payment |
| Partial | Customer has paid part of the amount |
| Paid | Fully settled |
| Overdue | Past due date with no full payment |
| Void | Cancelled — creates a reversing entry |

You can see all invoices and their statuses on the **Finance → Invoices** list. Use the status filter to quickly view only overdue or unpaid invoices and follow up accordingly.

## Recurring Invoices

For clients you bill on a regular cycle (e.g. monthly retainers), enable the **Recurring** toggle on the invoice and set the frequency. Urban Vibes Dynamics will auto-generate the next invoice on the scheduled date.
