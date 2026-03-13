# E-Commerce Module

> Multi-store online selling with product catalog, orders, B2B, subscriptions, and storefront API.

## Overview

The E-Commerce module provides a complete online selling platform with multi-store support, product variant management, B2B pricing tiers, subscription billing, a public storefront API, and deep integration with Inventory, Finance, Supply Chain, and CRM.

**Who uses it:** E-Commerce Admins, Store Managers, Customers (via storefront)
**Requires:** E-Commerce App Admin for management; storefront API is public

---

## Features

- **Multi-store** — manage multiple online stores from one interface
- **Product catalog** — products with variants (size, color, material), images, categories
- **Inventory sync** — real-time stock levels synced with Inventory module
- **Order management** — full order lifecycle from placement through delivery
- **B2B portal** — business customer accounts with tiered/custom pricing
- **Subscriptions** — recurring product/service subscriptions with auto-renewal
- **Loyalty program** — points, tiers, rewards linked with POS loyalty
- **Blog/CMS** — storefront blog for SEO and customer engagement
- **Storefront API** — headless commerce REST API for custom storefronts
- **Discount engine** — coupon codes, percentage/fixed discounts, bulk pricing
- **Abandoned cart** — track and recover abandoned checkout sessions
- **Product import** — bulk CSV/Excel product import
- **Analytics** — revenue, conversion rate, top products, customer lifetime value

---

## Architecture

### Key Files

| File | Description |
|------|-------------|
| `backend/app/api/v1/ecommerce.py` | Core CRUD: stores, products, orders |
| `backend/app/api/v1/ecommerce_b2b.py` | B2B accounts, pricing tiers, credit limits |
| `backend/app/api/v1/ecommerce_blog.py` | Blog/CMS for storefront content |
| `backend/app/api/v1/ecommerce_import.py` | Bulk product import (CSV/Excel) |
| `backend/app/api/v1/ecommerce_loyalty.py` | Loyalty points and rewards |
| `backend/app/api/v1/ecommerce_subscriptions.py` | Recurring subscription management |
| `backend/app/api/v1/storefront.py` | Public storefront API (unauthenticated) |
| `frontend/src/features/ecommerce/` | E-Commerce admin pages |
| `frontend/src/features/storefront/` | Public storefront pages |
| `frontend/src/api/ecommerce.ts` | E-Commerce API client hooks |

---

## Data Models

| Model | Table | Description |
|-------|-------|-------------|
| `Store` | `ecommerce_stores` | An online storefront |
| `Product` | `ecommerce_products` | Product with variants |
| `ProductVariant` | `ecommerce_product_variants` | SKU-level variant (size/color) |
| `Order` | `ecommerce_orders` | Customer order |
| `OrderItem` | `ecommerce_order_items` | Line item in an order |
| `B2BAccount` | `ecommerce_b2b_accounts` | Business customer account |
| `Subscription` | `ecommerce_subscriptions` | Recurring subscription |

---

## Order Lifecycle

```
pending → processing → shipped → delivered
    ↓
cancelled (before shipping)
    ↓
refunded (after delivery)
```

## Storefront API

Public API for headless commerce (no authentication required for browsing):

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/storefront/products` | Product catalog |
| `GET` | `/storefront/products/{id}` | Product detail |
| `POST` | `/storefront/cart` | Add to cart |
| `GET` | `/storefront/cart` | View cart |
| `POST` | `/storefront/checkout` | Place order |
| `GET` | `/storefront/categories` | Product categories |
| `GET` | `/storefront/search` | Search products |

---

## Cross-Module Integrations

| Module | Integration |
|--------|-------------|
| Inventory | Product stock levels synced; deducted on order placement |
| Finance | Order → Finance invoice auto-created; revenue tracked |
| Supply Chain | Low stock triggers auto-procurement request |
| CRM | Customer created/linked to CRM Contact on first order |
| Mail | Order confirmation, shipping notification emails sent |
| POS | Shared loyalty program (points earn/redeem across channels) |
