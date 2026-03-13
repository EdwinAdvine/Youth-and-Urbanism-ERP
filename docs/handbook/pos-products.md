---
title: POS Products & Pricing
slug: pos-products-pricing
category: pos
article_type: guide
module: pos
tags: [pos, products, pricing, variants, modifiers, price-lists, barcode]
sort_order: 2
is_pinned: false
excerpt: Set up products, categories, variants, modifiers, and pricing for your POS terminal.
---

# POS Products & Pricing

Urban Vibes Dynamics's POS product catalogue is shared with the Inventory module — every product sold at the POS is the same product record tracked in stock. This means there is one place to manage product information, and POS sales automatically decrement inventory in real time.

## Adding a Product to POS

Navigate to **POS → Products → New Product** (or **Inventory → Products → New Product** — they are the same record).

Fill in the core fields:

- **Name** — The product name as it will appear on the POS screen and receipts.
- **Category** — Assign a POS category (e.g. Beverages, Hot Food, Accessories). Categories appear as tabs on the cashier screen for quick browsing.
- **Barcode (EAN/SKU)** — Enter the barcode if you use a scanner. You can scan directly into this field using a connected barcode scanner. Leave blank for products that are always searched by name.
- **Image** — Upload a product image (JPEG or PNG, recommended 400×400 px). The image appears on the POS product grid to help cashiers identify items quickly.
- **Price** — The default selling price (inclusive of VAT if your business is VAT-registered).
- **Tax** — Select the applicable VAT rate (e.g. 16% Standard, 0% Zero-Rated, Exempt).
- **Available in POS** — Toggle on. Products with this toggle off are in the Inventory catalogue but do not appear at the till.

## Product Variants

Variants allow one product with multiple options (size, colour, flavour) to exist as a single catalogue entry rather than multiple products.

Navigate to the **Variants** tab of the product:

1. Add a **Variant Attribute** — e.g. "Size" with options Small, Medium, Large.
2. Add a second attribute if needed — e.g. "Colour" with options Black, White, Red.
3. Urban Vibes Dynamics generates all combinations automatically. You can then set a price override per variant (e.g. Large costs KES 50 more than Small).

At the POS, selecting a product with variants opens a popup for the cashier to choose the options before adding to the cart.

## Modifier Groups

Modifiers are add-ons or customisations applied to a product at point of sale, commonly used in food service.

Navigate to **POS → Modifiers → New Modifier Group**:

- **Group Name** — e.g. "Coffee Customisations".
- **Selection Type** — Single (customer picks exactly one) or Multiple (customer picks any combination).
- **Required?** — If yes, the cashier cannot proceed without making a selection.
- **Modifiers** — Add items with name and price adjustment (positive for add-ons, negative for exclusions, zero for free choices). E.g.:
  - Oat Milk +KES 30
  - Soy Milk +KES 30
  - Whole Milk +KES 0
  - Vanilla Syrup +KES 20
  - Extra Shot +KES 50

Attach modifier groups to products on the product's **POS** tab. Multiple modifier groups can be attached to one product (e.g. Milk Choice + Syrup + Size).

## Price Lists

Price lists let you define alternative pricing that activates automatically based on conditions.

Navigate to **POS → Price Lists → New**:

- **Name** — e.g. "Happy Hour", "Staff Discount", "Wholesale".
- **Discount Type** — Percentage off (e.g. 20%) or fixed price per product.
- **Schedule** — Optional: set active days and hours (e.g. Mon–Fri 5pm–7pm for Happy Hour).
- **Customer Group** — Restrict to a CRM customer tag (e.g. "wholesale-account").
- **Products Included** — All products, specific categories, or specific products.

When an eligible customer is attached to a POS sale (or the time matches a scheduled price list), the applicable price list activates automatically and adjusts prices in the cart.

## Product Bundles / Combos

Navigate to **POS → Products → New Bundle**:

- **Bundle Name** — e.g. "Breakfast Combo", "Office Starter Pack".
- **Bundle Price** — The fixed price for the bundle (usually lower than the sum of components).
- **Components** — Add each product and quantity included in the bundle.

When the bundle is added to the cart, it appears as a single line item at the bundle price. Inventory deducts each component individually in the background.

## Inventory Sync

Every POS sale triggers an immediate stock decrement in Inventory. If stock falls to zero, the product is greyed out on the POS product grid and cannot be added to the cart (prevents selling stock that does not exist). You can override this per product with a **Sell on Negative Stock** toggle — useful for products ordered on demand.

## Best Practices

- Use clear, consistent category names — cashiers navigate by category under time pressure.
- Always set a barcode if the product has one; scanning is faster and more accurate than searching.
- Review price lists monthly to ensure scheduled pricing (happy hour, seasonal) is still correct.
