---
title: E-Commerce Customers & Accounts
slug: ec-customers
category: ecommerce
article_type: guide
module: ecommerce
tags: [customers, accounts, b2b, portal, orders-history]
sort_order: 7
is_pinned: false
excerpt: Manage customer accounts, view order histories, and configure B2B trade portal access.
---

# E-Commerce Customers & Accounts

## Customer Accounts

Customers who register on the storefront automatically receive a customer account in Urban Vibes Dynamics. View all customer accounts under **E-Commerce → Customers**. The list shows name, email, registration date, total orders, and lifetime spend.

## Customer Profile

Each customer profile contains:

- **Contact details** — name, email, phone number
- **Address book** — saved shipping and billing addresses
- **Order history** — all past orders with status, total, and a link to the order detail
- **Loyalty points balance** — current points available to redeem (if the loyalty programme is enabled)
- **Notes** — internal notes visible only to your team (not the customer)

## CRM Sync

Every customer account is automatically linked to a **CRM Contact**. The sync is bidirectional:

- Changes made to the customer in E-Commerce (name, phone, email) are reflected in the CRM Contact
- Changes made to the CRM Contact are reflected in the E-Commerce customer profile

This means your sales team working in CRM and your e-commerce team working in the store always see the same customer data.

## B2B Customer Setup

To give a customer access to B2B pricing and payment terms:

1. Open the customer profile in **E-Commerce → Customers**
2. Toggle **Trade Account** to enabled
3. Assign a **Price List** (configured under E-Commerce → Price Lists)
4. Set **Payment Terms** (e.g., Net 30)

B2B customers see their group prices on the storefront and can check out on account (invoice payment) within their credit limit.

## Credit Limits

Set a credit limit on B2B accounts to control exposure. When a B2B customer's total unpaid invoice balance exceeds their credit limit, the checkout is blocked and they are shown a message to contact your accounts team. Credit limit balances are calculated from the Finance module's outstanding invoices.

## Customer Groups

Group customers by purchasing tier to apply different price lists:

| Group | Example Price List |
|-------|-------------------|
| Retail | Standard retail prices |
| Wholesale | 15% below retail |
| VIP | 20% below retail + free shipping |

Assign customers to groups individually or via bulk import.

> **Tip:** Use customer groups with price lists instead of creating separate products for wholesale customers — one catalogue, multiple price tiers.

## Guest Order Lookup

Customers who checked out as guests can look up their order at `/store/orders/lookup` by entering:

- The email address used at checkout
- The order number (from the confirmation email)

This shows the current order status without requiring account creation.

## Manually Creating a Customer

Create a customer without them going through the storefront registration:

- **E-Commerce → Customers → New** — fill in their details directly
- **Or sync from CRM** — open a CRM Contact and click "Create E-Commerce Account" — this links the existing Contact without creating a duplicate

## Customer Merge

If a guest customer later registers an account using the same email address, Urban Vibes Dynamics automatically consolidates their past guest orders under the new registered account. If the emails differ, an App Admin can manually merge accounts from **E-Commerce → Customers → [Customer] → Merge**.

## Customer Export

Export your full customer list to CSV from **E-Commerce → Customers → Export**. The export includes:

- Contact information
- Customer group and price list
- Total orders and lifetime spend
- Loyalty points balance
- Last order date

Use this for CRM campaign imports or external reporting.
