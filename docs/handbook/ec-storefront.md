---
title: Storefront & Customer Experience
slug: ec-storefront
category: ecommerce
article_type: guide
module: ecommerce
tags: [storefront, design, checkout, customer, ux]
sort_order: 5
is_pinned: false
excerpt: Customise your public-facing online store and configure the checkout experience.
---

# Storefront & Customer Experience

## The Storefront URL

Your online store is accessible at `/store` on your Urban Vibes Dynamics domain. It is fully self-hosted — no third-party platform, no external SaaS dependency. Everything runs within your Docker stack.

## Branding

Go to **E-Commerce → Settings → Storefront** to configure your store's visual identity:

- **Logo** — upload your store logo (shown in the header and order emails)
- **Banner** — a full-width homepage banner image or carousel
- **Primary colour** — the accent colour for buttons, links, and highlights
- **Font** — defaults to Open Sans (inheriting from the Urban Vibes Dynamics global theme); can be overridden per-store

## Homepage Layout

The homepage is composed of configurable sections:

- Featured products (manually curated or auto-selected by sales volume)
- Categories grid (visual tiles linking to filtered product listings)
- Promotional banners (image + text + CTA button; link to any product, category, or URL)

Reorder and enable/disable sections from the storefront settings panel.

## Navigation

Top-level product categories appear as navigation links in the storefront header. Configure the display order and visibility of each category under **E-Commerce → Categories**. Sub-categories render as dropdown menus.

## Product Pages

Each product has a dedicated storefront page containing:

- Image gallery with zoom and swipe support
- Product name, description, and attribute selectors (colour/size pickers for variants)
- Real-time stock badge (In Stock / Low Stock / Out of Stock)
- Add-to-cart button (disabled when out of stock)
- Related products section

## Cart and Checkout Flow

The checkout follows a linear, conversion-optimised flow:

1. **Cart sidebar** — slides in from the right; shows items, quantities, subtotal
2. **Checkout page** — delivery address entry
3. **Shipping method** — customer selects from available methods for their zone
4. **Payment** — customer selects payment method and completes payment
5. **Confirmation page** — order summary with order number
6. **Confirmation email** — sent automatically to the customer's email address

## Guest Checkout vs Required Login

Configurable in **Storefront Settings → Checkout**. Enable guest checkout to allow purchases without account creation. Guest order details are associated with the email address provided at checkout.

> **Tip:** Enable guest checkout — requiring account creation before purchase reduces conversions by up to 30%.

## Shipping Zones and Methods

Define shipping zones (e.g., Nairobi, Rest of Kenya, International) and assign methods to each zone:

- **Flat rate** — a fixed fee regardless of order size
- **Free over threshold** — free shipping when the cart exceeds a set amount
- **Rate per kg** — enter a manual rate; the system calculates based on total order weight

At checkout, only methods applicable to the customer's delivery address zone are shown.

## Tax Display

Choose how prices are displayed on the storefront:

- **Including VAT** — the displayed price includes tax; VAT is itemised at checkout
- **Excluding VAT** — the displayed price is pre-tax; VAT is added at checkout

A VAT line always appears on the checkout summary and in the order confirmation email.

## Order Confirmation

An order confirmation email is sent automatically as soon as payment is confirmed (or the order is placed for COD and bank transfer). The email uses a configurable template and includes:

- Order number and date
- Itemised order summary with images
- Delivery address
- Payment method used
- Tracking placeholder (populated manually or via courier integration)

Edit the email template under **E-Commerce → Settings → Email Templates**.
