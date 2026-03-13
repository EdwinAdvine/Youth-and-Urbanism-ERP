---
title: "Purchase Orders"
slug: purchase-orders
category: inventory
article_type: guide
module: inventory
tags: [purchase-orders, procurement, GRN, suppliers, restocking]
sort_order: 2
is_pinned: false
excerpt: "Create purchase orders for restocking, receive goods, and reconcile with vendor bills."
---

# Purchase Orders

A Purchase Order (PO) is the formal document your business sends to a supplier when you need to restock inventory. Urban Vibes Dynamics tracks the PO through its full lifecycle: creation → supplier fulfilment → goods receipt → vendor bill — and keeps your stock levels and accounts accurate at every step.

## Creating a Purchase Order

1. Navigate to **Inventory → Purchase Orders → New PO**.
2. Fill in the PO header:
   - **Supplier** — select from your supplier list (managed under **Inventory → Suppliers**). The supplier's payment terms (e.g., Net 30) and default currency (KES) are pre-filled from their profile.
   - **Order Date** — defaults to today.
   - **Expected Delivery Date** — when you expect the goods to arrive. Used to flag overdue POs.
   - **Delivery Location / Warehouse** — the warehouse where goods will be received.
   - **Reference Number** — an optional internal reference (e.g., a requisition number or project code) for tracking purposes.

3. Add line items:
   - Click **Add Item**.
   - Search for the inventory item by name or SKU.
   - Enter the **Quantity** to order.
   - Enter the **Unit Price (KES excl. VAT)** — this is usually quoted by the supplier on their proforma invoice.
   - Specify whether the item attracts **VAT (16%)** or is exempt. Urban Vibes Dynamics calculates the VAT amount per line and shows totals at the bottom: Subtotal (excl. VAT), Total VAT, and Grand Total (incl. VAT).
   - Repeat for all items.

4. Add any **PO Notes or Terms** in the notes field (e.g., "Delivery must include delivery note signed by our warehouse manager").

5. Click **Save as Draft** to review later, or **Submit PO** to finalise and send.

## Sending the PO to the Supplier

Once submitted:

1. Click **Send to Supplier**. Urban Vibes Dynamics generates a formatted PDF of the PO.
2. Choose how to send it: **Email** (sends directly from the system to the supplier's email address on file) or **Download PDF** (to attach to your own email or WhatsApp).

The PO status changes from **Draft** to **Sent**. The supplier can then prepare and dispatch the goods.

## Common Kenyan Suppliers Setup

Urban Vibes Dynamics's supplier profile includes fields relevant to Kenya procurement:
- **KRA PIN** (required for vendor reconciliation and tax compliance)
- **Bank Account** (for payment via your bank's supplier payment module)
- **VAT Registration Number** (for input VAT claims on VAT-registered purchases)

Ensure your suppliers' KRA PINs are on file — they are required when claiming input VAT on purchases.

## Receiving Goods — Creating a GRN

When the supplier delivers the goods, the warehouse manager records a **Goods Receipt Note (GRN)**:

1. Go to **Inventory → Purchase Orders** and open the relevant PO.
2. Click **Receive Goods**.
3. A GRN form opens, pre-filled with the PO lines. For each item, enter the **Quantity Received** — this may differ from the quantity ordered if the supplier made a partial delivery.
4. Note any damages or discrepancies in the **Notes** field on each line.
5. Click **Confirm Receipt**.

Immediately on confirmation:

- Stock levels for each received item increase by the quantity received, at the specified warehouse.
- A stock movement record is created (Type: Receipt, Reference: GRN-00XXX).
- The PO status updates to **Partially Received** (if not all items were delivered) or **Fully Received**.

If the supplier sends multiple deliveries against the same PO (common for large or backordered items), you can record multiple GRNs against the same PO. Each receipt is tracked separately.

## Reconciling with a Vendor Bill

Once goods are received, you need to record the supplier's invoice in Finance:

1. From the PO, click **Create Vendor Bill**.
2. Urban Vibes Dynamics automatically opens a new bill in the Finance module (Accounts Payable), pre-filled with:
   - Supplier name
   - PO line items, quantities (from GRN), and unit prices
   - VAT amounts
   - Grand total in KES
3. Match the values to the physical supplier invoice or e-invoice received.
4. Enter the **Supplier Invoice Number** and **Invoice Date**.
5. Confirm the bill. It enters the Accounts Payable queue for payment.

If the supplier invoices an amount different from the PO (e.g., price variation, additional delivery charges), adjust the bill before confirming. A variance above a threshold (configurable in Finance Settings) will require Finance Admin approval.

## Tracking PO Status

All purchase orders are listed under **Inventory → Purchase Orders** with status indicators:

| Status | Meaning |
|---|---|
| Draft | Created but not yet sent |
| Sent | Sent to supplier, awaiting delivery |
| Partially Received | Some items received, remainder outstanding |
| Fully Received | All items received |
| Billed | Vendor bill created and posted |
| Cancelled | PO cancelled before fulfilment |

Overdue POs (Expected Delivery Date passed, status still Sent or Partially Received) are highlighted in amber and appear in the **Overdue POs** widget on the Inventory dashboard.

> **Tip:** Never receive goods without creating a GRN in Urban Vibes Dynamics, even for urgent deliveries. A verbal "yes we got it" that is not recorded in the system leaves stock counts wrong and makes it impossible to trace discrepancies in a later audit.
