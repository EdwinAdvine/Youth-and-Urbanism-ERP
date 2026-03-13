---
title: Goods Received Notes (GRN)
slug: goods-received-notes
category: supply-chain
article_type: guide
module: supply-chain
tags: [grn, receiving, goods-receipt, inventory, purchase-orders]
sort_order: 3
is_pinned: false
excerpt: Record goods received from suppliers and reconcile against purchase orders.
---

# Goods Received Notes (GRN)

A Goods Received Note is the official record of stock entering your warehouse. Every GRN is reconciled against the originating Purchase Order, updates stock levels in Inventory, and triggers the vendor bill in Finance.

## Creating a GRN

Navigate to **Supply Chain → GRN → New**.

1. **Select Purchase Order** — Search by PO number or supplier name. Only POs in **Sent** or **Partially Received** status are available. Selecting the PO auto-fills the expected line items, quantities, and supplier details.

2. **Delivery Date** — Enter the actual date the goods arrived (defaults to today).

3. **Delivery Note / Waybill Number** — Enter the supplier's delivery note or waybill reference. This is your traceability link if a dispute arises later.

4. **Receiving Warehouse / Location** — Select the storage location where goods will be placed (e.g. Main Store, Cold Room, Raw Materials Bay 3).

## Recording Received Quantities

For each line item on the PO, enter the **Received Quantity**. Urban Vibes Dynamics supports three scenarios:

- **Full Receipt** — Received qty matches the PO qty. Click **Receive All** to auto-fill all lines.
- **Partial Receipt** — Enter the actual qty received. The PO remains open (status: Partially Received) and you can raise a second GRN when the remainder arrives.
- **Over-delivery** — If the supplier sends more than ordered, Urban Vibes Dynamics flags the line in orange. You must actively accept the overage (it will be billed) or mark it for return.

## Recording Discrepancies

Click the **Discrepancy** flag on any line to record issues:

- **Damaged Goods** — Enter the number of units damaged and a description. These units are excluded from the stock update and flagged for return or credit note.
- **Short Delivery** — Auto-detected when received qty < ordered qty. Add a note if the supplier confirmed backordering the remainder.
- **Wrong Item** — Mark the line as Wrong Item. The received quantity is set to zero for that line and a return is initiated automatically.
- **Quality Hold** — If goods require QC inspection before being put away, mark as **Quality Hold**. Stock is quarantined in a separate bin and only released after QC sign-off.

## Posting the GRN

Once all quantities are confirmed, click **Post GRN**. The following happens automatically:

1. **Inventory updated** — Stock levels increase by the accepted received quantities at the locations specified.
2. **Vendor Bill created** — Finance → Accounts Payable receives a draft vendor bill for the accepted quantities at the PO unit prices.
3. **PO status updated** — PO moves to Partially Received or Fully Received accordingly.
4. **Supplier performance recorded** — Delivery timeliness and quality data feed the Supplier Performance dashboard.

Posted GRNs cannot be edited. If you posted with an error, raise a **Credit Note** or a **Return to Supplier** (see below).

## Return to Supplier (RTS)

To return damaged, wrong, or excess goods:

1. Open the posted GRN and click **Create Return**.
2. Select the lines and quantities to return.
3. Enter the return reason (Damaged / Wrong Item / Excess / Quality Failure).
4. Click **Confirm Return** — a Return to Supplier document is generated and emailed to the supplier. Stock is decremented and a vendor credit note is raised in Finance.

## Best Practices

- Never post a GRN without physically verifying the delivery note matches what is in front of you.
- Use **Quality Hold** for any goods that need inspection — never let uninspected goods go directly to production.
- Reconcile all open POs weekly: any PO older than the supplier's lead time + 7 days with no GRN should be chased.
