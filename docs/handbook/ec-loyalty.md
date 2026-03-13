---
title: Loyalty Programme
slug: ec-loyalty
category: ecommerce
article_type: guide
module: ecommerce
tags: [loyalty, points, rewards, retention, customers]
sort_order: 8
is_pinned: false
excerpt: Set up a points-based loyalty programme to reward repeat customers across online and POS sales.
---

# Loyalty Programme

## Enabling Loyalty

Go to **E-Commerce → Settings → Loyalty** and toggle **Enable Loyalty Programme**. If the POS module is also active, the same loyalty programme applies to POS sales automatically — customers earn and redeem points at the till as well as online.

## Earning Rules

Define how customers earn points:

- **Base rate** — points earned per unit of spend (e.g., 1 point per KES 100 spent)
- **Category overrides** — earn at a different rate for specific product categories (e.g., 2 points per KES 100 on "Electronics")
- Points are awarded when an order is marked as **Delivered** or **Completed** (not when the order is placed, to prevent awarding points on returned orders)

## Redemption Rules

Define what points are worth:

- **Points value** — how much discount each point represents (e.g., 100 points = KES 50)
- **Minimum redemption threshold** — the minimum number of points a customer must have before they can redeem (e.g., must have at least 500 points to redeem)
- **Maximum redemption per order** — optionally cap the % of an order total that can be paid with points

## Online Redemption

At the online checkout, logged-in customers with redeemable points see a **"Use Points"** toggle. Enabling it shows how much discount their current balance provides and reduces the order total accordingly. The remaining balance (if any) is paid via their chosen payment method.

## POS Redemption

At the POS terminal, the cashier enters the customer's phone number or email to look up their account. The POS screen shows the customer's points balance. The cashier clicks **Apply Points** to apply a discount to the current sale. The customer confirms verbally and the redemption is recorded.

> **Tip:** Set your redemption threshold high enough that customers can earn a meaningful reward within 3–4 purchases — this is the psychological sweet spot for loyalty programme engagement.

## Bonus Campaigns

Run time-limited promotions to accelerate earning:

- **Double-point events** — all purchases earn 2x points during a specific date range
- **Category bonuses** — earn extra points on a specific category for a limited period
- **Welcome bonus** — award a fixed number of points when a customer first registers

Configure campaigns under **E-Commerce → Loyalty → Campaigns → New**.

## Tier-Based Loyalty

Create up to 5 tiers based on cumulative spend (calculated over the customer's lifetime or a rolling 12-month window):

| Tier | Min. Spend | Earning Multiplier |
|------|------------|-------------------|
| Bronze | KES 0 | 1x |
| Silver | KES 10,000 | 1.5x |
| Gold | KES 50,000 | 2x |

Tier status updates automatically when a customer crosses a threshold. Tier badges appear on their storefront account page.

## Points Expiry

Configure points to expire after a period of inactivity to manage outstanding liability:

- **Expiry period** — e.g., points expire if no earning or redemption activity in 12 months
- **Expiry warning email** — sent to customers 30 days before their points expire

## Loyalty Dashboard

View programme health under **E-Commerce → Loyalty**:

- Total points issued (all time)
- Total points redeemed (all time)
- Outstanding points liability (unredeemed points converted to KES value)
- Top customers by points balance
- Redemption rate trend (weekly/monthly)

## Customer Notifications

Customers receive automated emails:

- **Points earned** — after each qualifying purchase confirming points added and new balance
- **Points expiry warning** — 30 days before inactive points will expire
- **Tier upgrade** — when a customer moves up to a new tier
