---
title: "Managing Stock & Inventory"
slug: managing-stock-inventory
category: inventory
article_type: guide
module: inventory
tags: [inventory, stock, warehouses, SKU, reorder-points]
sort_order: 1
is_pinned: false
excerpt: "Add inventory items, track stock levels across warehouses, and manage reorder points."
---

# Managing Stock & Inventory

Urban Vibes Dynamics's Inventory module is the single source of truth for everything your business holds in stock — from raw materials in a Nairobi warehouse to finished goods at a distribution point in Mombasa. This article covers how to create items, track quantities, and ensure you never run out unexpectedly.

## Navigating to Inventory

Go to **Inventory → Items** in the left sidebar. The Items list shows all active inventory items with their current stock level, reorder point, and warehouse location.

## Creating an Inventory Item

1. Click **New Item** (top-right button).
2. Fill in the item details:

   - **Item Name** — descriptive and clear (e.g., "A4 Printing Paper 80gsm Ream" or "Galvanised Steel Pipe 1-inch × 6m").
   - **SKU (Stock Keeping Unit)** — your unique internal product code. If you do not have a coding system, Urban Vibes Dynamics can auto-generate one in the format `ITM-00001`. Keep SKUs consistent and avoid spaces or special characters.
   - **Category** — group items into logical categories (e.g., Office Supplies, Electrical Materials, Beverages, Packaging). Categories can be added under **Inventory → Settings → Categories**.
   - **Unit of Measure (UoM)** — how the item is counted: pieces, reams, kilograms, litres, metres, cartons. Select from the list or add a custom UoM under Settings.
   - **Description** — optional but useful for items with specifications (e.g., voltage rating, material grade, brand).
   - **Reorder Point** — the stock level that triggers a low-stock alert. Example: if you set the reorder point to 50 units and stock drops to 49, HR receives a notification and the item appears on the **Low Stock** dashboard. Set this based on your lead time from suppliers — if your supplier takes 7 days to deliver, set a reorder point that covers 7 days of consumption with a buffer.
   - **Unit Cost (KES)** — the standard cost per unit, used for inventory valuation (FIFO or weighted average, configured in Settings). This does not set your selling price; that is in the POS or E-Commerce module.
   - **VAT Applicable** — toggle on if this item attracts Kenya VAT (16%). This determines how purchase costs are recorded in Finance.

3. Click **Save Item**.

## Setting Warehouse Locations

If your organisation operates multiple warehouses or store locations (e.g., "Westlands Warehouse", "Karen Showroom", "Mombasa DC"), each item can have a quantity tracked per location.

1. Open the item and go to the **Stock Levels** tab.
2. Click **Add Location**.
3. Select the warehouse from the dropdown. If the warehouse does not exist, add it under **Inventory → Settings → Warehouses**.
4. Enter the **Opening Stock** quantity for that location.
5. Repeat for each warehouse where this item is stocked.

The item's total stock is the sum across all locations. You can also set a **bin/shelf location** (e.g., "Aisle 3, Shelf B") within each warehouse for physical picking.

## Viewing Stock Movements

Every stock movement — whether from a purchase order receipt, a sale, a transfer between warehouses, or a manual adjustment — is recorded in the item's movement history.

1. Open any item.
2. Click the **Movements** tab.

You will see a chronological log showing: date, movement type (Receipt / Sale / Transfer / Adjustment), quantity in or out, reference document (e.g., PO-00045 or SO-00102), and the balance after each movement. This audit trail is essential for reconciling discrepancies and answering questions like "Who took those 20 units on 5th March?"

## Low Stock Alerts

Urban Vibes Dynamics monitors stock levels continuously. When any item's quantity at any warehouse drops to or below its reorder point:

- The item appears in the **Low Stock** widget on the Inventory dashboard.
- An email notification is sent to the designated **Purchasing Contact** (set under Inventory → Settings → Alerts).
- A badge count appears on the Inventory sidebar icon.

From the Low Stock list, you can click **Create Purchase Order** next to any item to immediately open a PO draft pre-filled with the item and suggested reorder quantity.

## Bulk Import Items via CSV

For businesses migrating from another system or setting up a large initial stock catalogue:

1. Go to **Inventory → Items → Import**.
2. Download the CSV template.
3. Fill in the template columns: Item Name, SKU, Category, UoM, Reorder Point, Unit Cost, Warehouse, Opening Quantity.
4. Upload the completed CSV.
5. The system validates each row and shows a preview before confirming the import. Rows with errors (e.g., duplicate SKU, missing mandatory field) are highlighted and must be corrected before the import proceeds.

Bulk imports are useful for initial setup but should not replace proper stock receipts for ongoing operations — always receive stock via a Purchase Order so the movement is properly documented.

> **Tip:** Spend time setting accurate reorder points for your fastest-moving items. A reorder point that is too low leads to stockouts; too high ties up cash in excess inventory. Review and adjust reorder points every quarter based on consumption trends visible in **Inventory → Reports → Stock Velocity**.
