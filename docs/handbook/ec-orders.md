---
title: Managing Orders
slug: managing-orders
category: ecommerce
article_type: guide
module: ecommerce
tags: [ecommerce, orders, fulfilment, shipping, inventory, invoicing]
sort_order: 2
is_pinned: false
excerpt: Process customer orders from placement through fulfilment and delivery.
---

# Managing Orders

Every purchase made through your Urban Vibes Dynamics storefront creates an order record. The Orders view is your fulfilment dashboard — track what needs to be packed, what has been dispatched, and what has been delivered, all in one place.

## The Orders Queue

Go to **E-Commerce → Orders**. You see all orders in a list with columns for order number, customer name, order date, total (in KES), payment status, and fulfilment status.

Use the filters at the top to narrow the view by status, date range, payment method, or fulfilment status.

## Order Status Workflow

Orders move through the following statuses:

1. **Pending** — order placed, payment not yet confirmed (e.g., awaiting M-Pesa confirmation or bank transfer verification)
2. **Confirmed** — payment received and verified; ready to be processed
3. **Processing** — your team is preparing the order (picking, packing)
4. **Shipped** — order dispatched to the customer
5. **Delivered** — customer has received the order
6. **Cancelled** — order cancelled before shipment (stock is returned to Inventory automatically)

## Confirming an Order

When a payment is received:

- **M-Pesa payments** are confirmed automatically via the M-Pesa callback. The order status changes from Pending to Confirmed without manual action.
- **Bank transfer payments** must be confirmed manually. Once your Finance team verifies the deposit, go to the order, click **Confirm Payment**, and the status advances to Confirmed.

## Generating a Packing Slip

With a Confirmed or Processing order open, click **Print Packing Slip**. A formatted PDF is generated showing the order number, customer name and delivery address, and the list of items with quantities. Print this and include it in the package.

## Marking as Shipped

1. Open the order and click **Mark as Shipped**.
2. Enter the **tracking number** and **courier name** (e.g., "G4S", "Fargo Courier", "Wells Fargo Kenya", or your own delivery team).
3. Click **Confirm**.

The customer receives an automated email notification with the tracking number and any courier link you provide. The order status changes to Shipped.

## Delivery Confirmation

When the order is delivered:

- If your courier provides a delivery callback, Urban Vibes Dynamics updates the status to Delivered automatically.
- Otherwise, mark it manually: open the order and click **Mark as Delivered**.

The customer receives a final email confirming delivery and is prompted to leave a review (if product reviews are enabled in your store settings).

## Inventory Sync

When an order is Confirmed, Urban Vibes Dynamics automatically reduces the stock quantity for each product in the Inventory module. You do not need to update stock manually. If a product goes out of stock, it is automatically marked as unavailable in the storefront to prevent overselling.

When an order is Cancelled, the reserved stock is returned to Inventory automatically.

## Finance Integration: Customer Invoice

When an order reaches Confirmed status, Urban Vibes Dynamics automatically generates a **customer invoice** in the Finance module. The invoice includes:

- All order line items with unit prices in KES
- 16% VAT (or the applicable rate set in your store settings)
- Shipping fee
- Payment method and reference (e.g., M-Pesa transaction ID)

The invoice is sent to the customer's email and is also viewable in their order history on the customer portal. Your Finance team can access it from **Finance → Invoices** like any other invoice.

## Cancellations and Refunds

To cancel an order (before shipment):

1. Open the order and click **Cancel Order**.
2. Enter a cancellation reason.
3. The order is cancelled, stock is restored, and the customer is notified by email.

For refunds on already-shipped or delivered orders, create a **Credit Note** from the linked Finance invoice. Refund processing (e.g., M-Pesa reversal) is handled through your payment provider's process.
