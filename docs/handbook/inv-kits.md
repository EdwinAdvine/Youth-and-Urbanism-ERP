---
title: Kits & Bundled Products
slug: inv-kits
category: inventory
article_type: guide
module: inventory
tags: [kits, bundles, products, components, bom, assembly]
sort_order: 5
is_pinned: false
excerpt: Create product kits that bundle multiple items — sold as one SKU but tracked as individual components.
---

# Kits & Bundled Products

A kit is a product you sell as a single item but that is made up of multiple individual stock components. Urban Vibes Dynamics tracks stock at the component level, so kits let you offer bundles without managing separate physical inventory for the bundle itself.

## What a Kit Is

A kit is a sellable SKU that references other inventory items as its components. When a kit is sold, each component's stock is reduced by the configured quantity. The kit itself never has its own stock quantity — its availability is determined entirely by how many complete sets of components are on hand.

**Example:** A "Laptop Starter Kit" kit has these components:
- 1 × Laptop Model X
- 1 × Laptop Bag
- 1 × Wireless Mouse

When one Laptop Starter Kit is sold, the system deducts one of each component from inventory.

## Kit vs Manufacturing BOM

Kits and Bills of Materials (BOMs) are different:

- **Kit** — components are pulled from stock at the point of sale. No production process, no work order. The "assembly" is assumed to happen at packing or the point of handover.
- **Manufacturing BOM** — components go through a production process (cutting, assembly, finishing, QC) tracked via work orders before becoming a finished product.

Use kits for pre-assembled bundles or promotional packages. Use a Manufacturing BOM when there is a genuine production process involved.

## Creating a Kit

1. Go to **Inventory → Items → New Item**.
2. Fill in the item name, SKU, and category as usual.
3. Check the **"Is Kit"** toggle in the item settings.
4. A Components section appears below. Click **Add Component**:
   - Select the component item from the inventory list.
   - Enter the quantity per kit unit (e.g., 2 if the kit includes 2 of this item).
   - Repeat for all components.
5. Set the kit's sell price (this is the price customers see — it is independent of individual component prices).
6. Save the item.

The kit now appears in the product catalogue, POS item search, and E-Commerce product list like any other item.

## Selling a Kit

Kits are sold through POS and E-Commerce identically to regular items:

- **POS** — search for the kit name or scan its barcode. It appears as a single line on the receipt at the kit price. When the sale is finalised, each component's on-hand quantity is decremented automatically.
- **E-Commerce** — the kit appears in the product catalogue as a single product with a single price. When an order is placed, the same component stock deduction happens at order confirmation.
- **Sales invoices** — add the kit as a line item. It appears as one line on the invoice.

## Kit Pricing

The kit's sell price is set manually when you create the kit. It does not automatically calculate from component prices, because kits are typically sold at a bundle discount.

If you want to check what the components would cost at their individual prices, open the kit and click **"Calculate from components"** — this shows the sum of component prices as a reference figure. You can choose to apply that figure or leave the kit price as set.

## Partial Kit Availability

A kit's availability is limited by its scarcest component. If any one component has zero stock, the kit shows as **Out of Stock**, even if all other components are fully stocked.

In the item's stock card, an availability indicator shows how many complete kits can be assembled from current component stock. This is visible in:

- The kit item's stock card (Inventory → Items → select kit → Stock tab)
- The POS item list (shows 0 when unavailable)
- The E-Commerce product listing (shows "Out of Stock")

## Kit on Invoices and Documents

By default, a kit appears as a single line item on invoices, receipts, and picking lists — customers see the kit name and price.

If you need to show the component breakdown on printed documents (e.g., for a customs declaration or detailed client invoice), enable **"Explode kit on documents"** in the kit settings. When this is on, the PDF shows the kit name as a header row followed by an indented list of components.

This setting does not affect how stock is tracked — components are always deducted individually regardless of how the document is formatted.

## Reporting

The **Inventory → Reports → Kit Sales** report shows:

- Kit name
- Units sold (by date range)
- Component quantities consumed per kit
- Total component quantities consumed across all kit sales

This report is useful for forecasting — it tells you how quickly components are being consumed through kit sales so you can set appropriate reorder points on the individual components.

## Editing a Kit

You can add, remove, or change component quantities in a kit at any time. Changes apply to future sales only — historical sales records are not retroactively updated.

If you change a component quantity (e.g., the kit now includes 2 mice instead of 1), update the component row and save. The new quantity takes effect immediately for the next sale.

---

> **Tip:** Use kits for promotional bundles — create a "Promo Bundle" kit at a discount price without changing the individual item prices. This keeps your pricing clean and the promotion easy to switch on or off by enabling or disabling the kit.
