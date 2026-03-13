---
title: Opening & Closing a POS Session
slug: opening-closing-pos-session
category: pos
article_type: guide
module: pos
tags: [pos, session, cash-management, reconciliation, cashier]
sort_order: 1
is_pinned: false
excerpt: Start a POS session, process sales, and close out with a cash reconciliation.
---

# Opening & Closing a POS Session

A POS session is the complete operating period for a cashier at a terminal — from opening cash count to final reconciliation. Urban Vibes Dynamics enforces session boundaries to ensure every transaction is accountable and every till is reconciled at shift end.

## Opening a Session

Navigate to **POS → Open Session** (or click the POS icon from the app launcher).

1. **Select Terminal** — If your business has multiple POS terminals (e.g. Till 1 — Main Counter, Till 2 — Café), select the appropriate one. Each terminal has its own session, float, and report.

2. **Opening Cash Count** — Count the physical cash in the till and enter the total. Urban Vibes Dynamics breaks this down by denomination:

   | Denomination | Count | Total |
   |---|---|---|
   | KES 1,000 | 5 | 5,000 |
   | KES 500 | 4 | 2,000 |
   | KES 200 | 3 | 600 |
   | KES 100 | 5 | 500 |
   | **Total Float** | | **8,100** |

3. **Confirm Opening Float** — Click **Open Session**. The cashier dashboard loads and the session timer starts.

## Processing a Sale

The cashier dashboard shows the product grid and the order cart.

**Adding products to the cart:**

- **Scan barcode** — Point the barcode scanner at the product. It is added instantly.
- **Search by name** — Type in the search bar at the top of the product grid.
- **Browse by category** — Use the category tabs to browse (e.g. Beverages, Food, Accessories).

**Adjusting the order:**

- Tap a cart line item to change quantity or delete it.
- Click **Discount** to apply a percentage or fixed-amount discount to a line item or the whole order. Discounts above the cashier's authorised limit (configured per role) require a manager PIN.
- Click **Customer** to attach a loyalty/CRM customer to the sale (enables loyalty points accrual and personalised email receipt).

**Payment:**

Click **Payment**. The payment screen shows the order total and asks for the payment method:

- **Cash** — Enter the amount tendered. Change due is calculated and displayed prominently.
- **Card (PoS Terminal)** — Confirm the amount and instruct the customer to tap/insert on the card reader.
- **Mpesa** — Enter the customer's Mpesa confirmation code. Urban Vibes Dynamics validates the code format and records it on the transaction.
- **Split Payment** — Click **Add Payment Method** to split the bill across multiple methods (e.g. KES 500 cash + KES 1,200 card).

Click **Confirm Payment** to complete the sale.

**Receipt:**

The system prompts: **Print Receipt** or **Email Receipt**. Email receipt requires a customer email address (populated automatically if a CRM customer was attached). For no receipt, click **Skip**.

## Handling Refunds

From the POS dashboard, click **Refunds**, search for the original transaction by receipt number or customer name, select the items to refund, and choose the refund method. Cash refunds deduct from the session cash balance.

## Closing a Session

At end of shift, click **Close Session**.

1. **Closing Cash Count** — Count the physical cash in the till and enter by denomination, exactly as at opening.

2. **Session Summary** — Urban Vibes Dynamics displays:
   - Total sales by payment method.
   - Expected cash in till (Opening Float + Cash Sales − Cash Refunds).
   - Actual cash you counted.
   - **Variance** — The difference between expected and actual cash. Green = exact, amber = minor discrepancy (within your configured tolerance, default KES 50), red = significant variance requiring explanation.

3. **Variance Explanation** — If the variance exceeds tolerance, enter a reason (e.g. "Change error on transaction #1042").

4. **Confirm Close** — Click **Close Session**. The session is locked. All sales data is posted to Finance automatically (journal entry: cash/card debit, revenue credit, VAT liability credit).

A **Session Close Report** PDF is generated and can be printed or emailed to the store manager.

## Tips

- Never share cashier logins — each session is tied to a user for audit purposes.
- If you need to leave the till temporarily, click **Lock Session**. A PIN is required to resume.
- If a session was left open accidentally (e.g. power cut), a manager can force-close it from **POS → Sessions → [Session] → Force Close**.
