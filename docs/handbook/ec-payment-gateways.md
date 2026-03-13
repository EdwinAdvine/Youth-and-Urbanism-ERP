---
title: Payment Gateways & Methods
slug: ec-payment-gateways
category: ecommerce
article_type: guide
module: ecommerce
tags: [payments, mpesa, stripe, cash-on-delivery, gateway]
sort_order: 6
is_pinned: false
excerpt: Configure payment methods for your online store including M-Pesa, card payments, and bank transfer.
---

# Payment Gateways & Methods

## Available Payment Methods

Urban Vibes Dynamics supports four payment methods out of the box, all configured from **E-Commerce → Settings → Payments**:

| Method | Best For |
|--------|----------|
| M-Pesa STK Push | Kenya-based customers paying by mobile money |
| Card via Stripe | International and card-preferring customers |
| Bank Transfer | B2B customers with payment terms |
| Cash on Delivery | Last-mile delivery operations |

## Enabling M-Pesa

Go to **E-Commerce → Settings → Payments → M-Pesa** and enter the following credentials from your Safaricom Daraja portal:

- **Consumer Key**
- **Consumer Secret**
- **Shortcode** (the till number or paybill number)
- **Passphrase** (used to generate the STK Push password)

Switch to **Sandbox** mode and test with a real phone number before going live. Sandbox transactions do not move real money.

> **Tip:** Always test M-Pesa with a real phone number in sandbox mode before going live — the STK Push confirmation confirms your Daraja credentials are correct.

## M-Pesa STK Push Flow

1. Customer enters their M-Pesa phone number at checkout
2. Urban Vibes Dynamics sends an STK Push request to Safaricom
3. Customer receives a prompt on their phone and enters their M-Pesa PIN
4. Safaricom confirms the payment to Urban Vibes Dynamics via callback (typically within 10 seconds)
5. Order is created and confirmation email is sent automatically

If the customer dismisses the prompt or the payment times out, the order is not created and the customer is returned to checkout with an error message.

## Stripe Card Payments

Go to **E-Commerce → Settings → Payments → Stripe** and enter:

- **Publishable Key** — used in the browser to initialise the Stripe Elements card widget
- **Secret Key** — used server-side to confirm payment intents

Card details are collected via Stripe Elements embedded directly in the checkout page. No card data ever touches Urban Vibes Dynamics servers — all sensitive data is handled by Stripe's PCI-compliant infrastructure.

## Bank Transfer

When bank transfer is enabled, customers see your bank account details at checkout. The order is created immediately in **Pending Payment** status. A Finance team user must manually mark the order as paid after verifying the transfer in your bank statement.

Configure your bank details (bank name, account name, account number, branch, reference instructions) under **Payments → Bank Transfer**.

## Cash on Delivery

COD orders are created immediately without any payment processing. The delivery person collects cash at the time of delivery. COD orders appear in a dedicated **Cash on Delivery Report** under **E-Commerce → Reports** to help reconcile collections.

## Payment Icons on Storefront

Enabled gateways display their logos automatically:

- At the checkout payment step
- In the footer of the storefront (builds buyer confidence)

No configuration needed — icons appear as soon as a gateway is enabled and saved.

## Refunds

Process refunds from **E-Commerce → Orders → [Order] → Refund**:

- **M-Pesa refunds** — processed via the Daraja reversal API; funds return to the customer's M-Pesa wallet
- **Stripe refunds** — processed via Stripe API; funds return to the original card within 5–10 business days
- **Bank transfer refunds** — marked as refunded in the system; actual bank transfer is done manually by your finance team
- **COD refunds** — marked manually; cash is returned in person

All refunds create a corresponding credit note in the Finance module automatically.

## Transaction Fees

For Stripe and M-Pesa, transaction fees can be configured to be:

- **Absorbed by the business** — customers see no surcharge; fees appear in your Finance reports as a cost
- **Passed to the customer** — a payment surcharge line is added to the order total at checkout (disclose this in your terms and conditions)

Configure this per gateway under **Payments → [Gateway] → Fee Handling**.
