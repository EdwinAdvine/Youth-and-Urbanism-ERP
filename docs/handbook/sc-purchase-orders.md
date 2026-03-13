---
title: Procurement & Purchase Orders
slug: procurement-purchase-orders
category: supply-chain
article_type: guide
module: supply-chain
tags: [procurement, purchase-orders, requisitions, approvals]
sort_order: 2
is_pinned: false
excerpt: Create purchase requisitions, get approvals, and issue purchase orders to suppliers.
---

# Procurement & Purchase Orders

Urban Vibes Dynamics uses a structured requisition-to-PO workflow to ensure spending is controlled, traceable, and fully integrated with Finance. Every purchase follows the same path from request to vendor bill.

## The Requisition-to-PO Flow

```
Department raises Requisition
        ↓
Procurement reviews & approves
        ↓
Requisition converts to Purchase Order
        ↓
PO sent to supplier (email / PDF)
        ↓
Goods received → GRN posted
        ↓
Vendor bill auto-created in Finance
```

## Step 1 — Raising a Requisition

Navigate to **Supply Chain → Procurement → New Requisition**.

Any staff member with the `procurement.request` permission can raise a requisition. Fill in:

- **Department** — The requesting department (e.g. Production, IT, Admin).
- **Required By Date** — Used to back-calculate whether the current stock and supplier lead times can meet the deadline.
- **Line Items** — Add one row per item: product/material, quantity, unit of measure, and estimated unit price. If the item exists in the product catalogue, select it from the dropdown — the last purchase price populates automatically.
- **Justification** — A short note explaining the business need. Required for any requisition above KES 50,000.
- **Suggested Supplier** — Optional. Leave blank if procurement should choose.

Save and click **Submit for Approval**.

## Step 2 — Approval Tiers

Urban Vibes Dynamics applies automatic approval routing based on total requisition value:

| Requisition Value | Approval Required |
|---|---|
| Below KES 50,000 | Auto-approved — converts to PO immediately |
| KES 50,000 – 500,000 | Procurement Manager approval |
| Above KES 500,000 | Procurement Manager + Finance Director approval |

Approvers receive an in-app notification and an email with a direct link. They can approve, reject, or request changes from the notification link without logging into the full application. Rejection requires a reason, which is visible to the requester.

## Step 3 — Converting to a Purchase Order

Once approved, open the requisition and click **Convert to PO**. Urban Vibes Dynamics will:

1. Auto-select the preferred supplier (or prompt you to choose one if none was suggested).
2. Populate payment terms and currency from the supplier record.
3. Generate a unique PO number (format: `PO-YYYY-NNNN`).

Review the PO, adjust unit prices if you have negotiated a better rate, then click **Send to Supplier**. The system emails the supplier a PDF of the PO and marks it as **Sent**.

## Step 4 — Receiving Goods (GRN)

When the goods arrive, navigate to **Supply Chain → GRN → New** and reference the PO number. See the [Goods Received Notes](goods-received-notes) article for the full receiving workflow.

## Step 5 — Vendor Bill Auto-Creation

Once a GRN is posted against a PO, Urban Vibes Dynamics automatically creates a **Vendor Bill** in Finance → Accounts Payable. The bill is pre-populated with:

- Supplier name and payment terms
- Line items matching what was received (not necessarily what was ordered — partial receipts are handled correctly)
- Tax amounts based on the supplier's tax configuration

The Finance team then reviews, posts the bill, and schedules payment. No double entry is required.

## Tracking & Reporting

- **Supply Chain → Procurement → Purchase Orders** — filter by status: draft, sent, partially received, fully received, closed.
- **Spend by Supplier** report — total PO value per supplier over a selectable date range.
- **Open POs** report — all POs awaiting full delivery, with expected delivery dates highlighted in red when overdue.

## Tips

- Always enter realistic **Required By Dates** — the Planning module uses these to flag procurement risks.
- If a supplier cannot deliver the full quantity, raise a second PO for the remainder rather than editing the original closed PO.
- Use the **Notes** field on the PO for any special delivery instructions (e.g. fragile handling, specific warehouse bay).
