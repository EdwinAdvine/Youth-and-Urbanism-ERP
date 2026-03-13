---
title: E-Commerce Products & Catalogue
slug: ec-products
category: ecommerce
article_type: guide
module: ecommerce
tags: [products, catalogue, variants, pricing, images]
sort_order: 4
is_pinned: false
excerpt: Add products to your online store, configure variants, and manage your catalogue.
---

# E-Commerce Products & Catalogue

## Creating a Product

Navigate to **E-Commerce → Products → New** to create a product. Fill in the core fields: name, description, category, base price, and tax class. These fields appear on both the storefront product page and in any exports or reports.

## Product Types

Urban Vibes Dynamics supports four product types:

- **Simple** — a single SKU with one price and one stock unit. Use this for items with no variants.
- **Variable** — multiple variants generated from attribute groups (e.g., colour, size). Each variant has its own SKU, price, and stock level.
- **Digital** — a downloadable file (PDF, software, audio). No shipping required; the download link is sent automatically in the order confirmation email.
- **Service** — sold by the unit but not physically shipped or downloaded (e.g., a consulting hour, an installation fee).

## Adding Variants

For Variable products, define attribute groups first. Example:

- Colour: Red / Blue / Green
- Size: S / M / L / XL

Urban Vibes Dynamics generates every combination automatically (e.g., Red-S, Red-M, Blue-L). Each variant gets its own SKU and price. You can edit individual variants to set different prices or mark specific combinations as unavailable.

## Images

Upload multiple images per product. The first image becomes the thumbnail on listing pages and in cart/checkout. Drag to reorder images. Supported formats: JPEG, PNG, WebP. Images are stored in MinIO and served directly — no external CDN dependency.

## Inventory Link

Each product variant links to an **Inventory item** in the Inventory module. The storefront reads live stock levels from this link and displays a "Low Stock" or "Out of Stock" badge automatically. When stock reaches zero, the add-to-cart button is disabled, preventing overselling.

> **Tip:** Always link products to Inventory items — this ensures your storefront shows real-time stock and prevents selling items you don't have.

## Categories and Tags

Assign products to one or more categories and add tags. Categories drive storefront navigation menus and filter panels. Tags are used for search and can power promotional rules (e.g., "20% off all items tagged 'clearance'").

## SEO Fields

Each product has a dedicated SEO section:

- **Meta title** — overrides the product name in `<title>` tags
- **Meta description** — the snippet shown in search engine results
- **URL slug** — the path segment for the product page (auto-generated from the product name; edit to customise)

## Publishing States

Products can be in one of three states:

| State | Description |
|-------|-------------|
| Draft | Saved but not visible on the storefront |
| Active | Publicly visible and purchasable |
| Archived | Hidden from the storefront; order history is preserved |

You can also **schedule publishing** — set a future date and time for a product to go Active automatically. Useful for product launches or promotional releases.

## Product Visibility

Control which audience sees each product:

- **B2C** — visible to all visitors on the public storefront
- **B2B** — visible only to logged-in trade customers
- **Both** — visible to all visitors; trade customers see their group price

## Bulk Actions

For large catalogues, use the bulk tools:

- **CSV import** — download the import template, fill in product data, upload. Variants, prices, and SKUs are all supported in the template.
- **Bulk price update** — select multiple products and apply a percentage increase/decrease or a fixed amount adjustment across all selected items.
