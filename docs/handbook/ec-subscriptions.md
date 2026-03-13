---
title: Subscription Products & Recurring Billing
slug: subscription-products-recurring-billing
category: ecommerce
article_type: guide
module: ecommerce
tags: [ecommerce, subscriptions, recurring-billing, plans, invoicing]
sort_order: 3
is_pinned: false
excerpt: Sell subscription products and automatically bill customers on a recurring schedule.
---

# Subscription Products & Recurring Billing

Subscriptions let you sell products or services on a recurring basis — software licences, monthly supply contracts, membership packages, SaaS tiers, or any offering billed on a schedule. Urban Vibes Dynamics handles the billing cycle automatically, generating invoices and sending payment reminders without manual intervention.

## Creating a Subscription Plan

1. Go to **E-Commerce → Subscriptions → Plans**.
2. Click **New Plan**.
3. Fill in the plan details:
   - **Plan Name**: e.g., "Basic Monthly", "Business Quarterly", "Enterprise Annual"
   - **Billing Interval**: select **Monthly**, **Quarterly**, or **Annual**
   - **Price (KES)**: the amount billed per interval, excluding VAT. 16% VAT is added automatically at invoicing for VAT-applicable plans.
   - **Free Trial Period**: optionally set a trial (e.g., 14 days). The customer is not billed during the trial. Billing begins on the day the trial ends.
   - **Description**: a short description shown to customers on the checkout page.
4. Click **Save Plan**.

## Linking a Plan to a Product

In **E-Commerce → Products**, open the product you want to sell on subscription (e.g., "Monthly Office Supplies Bundle"). Under the **Pricing** tab, select **Subscription** instead of **One-Time** and choose the plan you created. Save the product.

When customers add this product to their cart, they see the subscription terms clearly at checkout before completing the purchase.

## Customer Subscribes

A customer subscribes by completing checkout as with any product. After payment (via M-Pesa, card, or bank transfer for the first billing period), a subscription record is created in Urban Vibes Dynamics with:

- Customer details
- Plan and price
- Start date, next billing date
- Payment method on file

The customer receives a confirmation email with their subscription details and a link to their self-service portal.

## Automatic Invoice Generation

On each billing date, Urban Vibes Dynamics automatically:

1. Generates a **Finance invoice** for the customer covering that billing period.
2. Sends the invoice to the customer by email with payment instructions.
3. If the customer has a card or M-Pesa token on file (from previous payments), the payment is attempted automatically and the invoice is marked as Paid upon success.

Your Finance team can view all subscription invoices in **Finance → Invoices**, filtered by type "Subscription".

## Failed Payment Handling

If automatic payment fails (e.g., insufficient M-Pesa balance or expired card):

1. Urban Vibes Dynamics sends the customer an email notification asking them to update their payment method or complete payment manually.
2. A second attempt is made after 3 days.
3. If payment is still not received after the grace period (configurable, default 7 days), the subscription is automatically **suspended** and the customer loses access to the subscribed service.
4. The Support team receives an alert for each suspended subscription so they can follow up.

## Managing Subscriptions

Go to **E-Commerce → Subscriptions → Active** to see all current subscriber records. For each subscription you can:

- **Pause**: suspend billing temporarily (e.g., customer requested a break). The subscription resumes on a specified restart date.
- **Cancel**: end the subscription. The customer is notified by email. No further invoices are generated. If there are unused days in the current billing period, you can optionally issue a prorated credit note.
- **Upgrade / Downgrade**: change the customer to a different plan. Urban Vibes Dynamics calculates the prorated difference and applies it to the next invoice.

## Customer Self-Service Portal

Customers can manage their own subscriptions through your store's customer portal (accessible from the order confirmation email or by logging into the storefront). From the portal they can:

- View their current plan and next billing date
- Update their payment details
- Pause or cancel their subscription
- Download past invoices

Allowing customers to self-serve reduces the number of support requests your team has to handle for subscription management.
