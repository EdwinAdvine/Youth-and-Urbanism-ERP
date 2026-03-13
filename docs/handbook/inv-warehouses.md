---
title: Warehouses & Locations
slug: inv-warehouses
category: inventory
article_type: guide
module: inventory
tags: [warehouses, locations, bins, storage, multi-location]
sort_order: 4
is_pinned: false
excerpt: Set up multiple warehouses and bin locations to track stock precisely by physical location.
---

# Warehouses & Locations

Urban Vibes Dynamics supports multi-location inventory out of the box. You can define multiple warehouses, break each warehouse into bin locations, and track stock precisely at every level — from the building down to the individual shelf slot.

## Creating a Warehouse

Go to **Inventory → Warehouses → New Warehouse** and fill in:

- **Name** — a clear label (e.g., "Main Warehouse", "Retail Store - CBD", "Returns Depot").
- **Address** — the physical address; used on goods receipt notes and transfer documents.
- **Type** — choose one of: Main (primary stock-holding location), Transit (stock in motion between locations), or Returns (items returned by customers awaiting processing).
- **Default for modules** — specify whether this warehouse is the default source for POS sales, E-Commerce fulfilment, Manufacturing raw materials, or purchase order receiving. Each module can only have one default warehouse.

Save the warehouse. It immediately appears as an option in stock transactions across all modules.

## Bin Locations Within a Warehouse

For warehouses where you need to know the exact shelf a product is on, enable **Bin Tracking** in the warehouse settings (Settings toggle: "Enable bin locations"). Once enabled:

- Go to the warehouse record → Locations tab → Add Location.
- Build a hierarchy: Aisle → Rack → Shelf → Bin (e.g., A → 01 → 03 → 001, giving bin code A-01-03-001).
- Locations can be named freely — use whatever labelling system matches your physical signage.

Bin-level tracking is optional per warehouse. You can have one warehouse with bins and another without.

## Assigning Stock to a Location

When receiving stock via a **Goods Receipt Note (GRN)**:

- If the destination warehouse has bin tracking enabled, a Location field appears on each GRN line.
- Select the bin where the stock is physically being placed.
- The system records quantity by bin, not just by warehouse.

When fulfilling an order, the system suggests the bin with the oldest stock of that item first (FIFO) to minimise waste.

## Location Transfers (Internal Transfers)

To move stock between bins within a warehouse, or between two warehouses:

1. Go to **Inventory → Internal Transfers → New Transfer**.
2. Set the source location (warehouse + bin) and destination location.
3. Add items and quantities.
4. Confirm the transfer. Stock is deducted from the source and added to the destination.

Transfers are recorded as a movement in the stock ledger so auditors can see the full movement history of any item.

## Virtual Locations

Virtual locations are not physical places — they are accounting buckets used to track stock states:

- **Transit** — stock that has left the source warehouse but has not yet arrived at the destination. When you initiate a warehouse-to-warehouse transfer, stock moves from Source → Transit. When the receiving warehouse confirms delivery, it moves from Transit → Destination. This means your reports always show accurate on-hand stock even mid-transfer.
- **Scrap** — items removed from saleable inventory due to damage or expiry. Moving stock to Scrap generates a loss entry in the stock valuation report.
- **Returns** — customer-returned items sit here until inspected and either restocked (moved back to a saleable location) or scrapped.

Virtual locations are created automatically when you set up the system. You can add custom virtual locations (e.g., "Quality Hold") for your own workflows.

## Multi-Warehouse Stock Levels

Open any item's stock card (**Inventory → Items → select item → Stock tab**):

- The stock card shows a row for each warehouse (and optionally each bin) with quantity on hand, quantity reserved, and quantity available.
- The total across all locations appears at the top.
- Reports under **Inventory → Reports → Stock by Location** can be filtered to show one warehouse or aggregated across all.

## Default Warehouse Per Module

Each module that consumes inventory can be configured to pull from a specific warehouse:

- **POS** — set in POS → Settings → Default Warehouse (e.g., "Retail Store - CBD").
- **E-Commerce** — set in E-Commerce → Settings → Fulfilment Warehouse.
- **Manufacturing** — set in Manufacturing → Settings → Raw Materials Warehouse.
- **Purchase Orders** — receiving location defaults to the warehouse set in Inventory → Settings → Default Receiving Warehouse.

When a sale or consumption event is recorded, stock is deducted from the configured default warehouse for that module automatically. You can override it per transaction if needed.

## Warehouse-Specific Reorder Points

Reorder points can be set globally per item or overridden per warehouse:

- Open the item → Stock tab → Reorder Rules.
- Set a minimum quantity for each warehouse independently.
- When stock at that warehouse falls below its specific minimum, a replenishment suggestion is raised in **Inventory → Replenishment**.

This allows a smaller retail location to have a lower reorder threshold than the main warehouse.

## Stock Count / Cycle Count

To audit physical stock against system records:

1. Go to **Inventory → Stock Counts → New Count**.
2. Select a warehouse (and optionally a specific aisle or bin range for a cycle count).
3. The system generates a count sheet listing all items expected in that location.
4. Enter physical counts. Items with discrepancies are highlighted.
5. Confirm the count. The system generates stock adjustment journal entries for all discrepancies, updating on-hand quantities to match physical reality.

Stock counts can be full (all items in a warehouse) or partial (cycle count of a subset). Schedule cycle counts in **Inventory → Stock Counts → Schedule** to run on a recurring basis.

---

> **Tip:** Create "Transit" as a virtual location — when you move stock between warehouses, receiving into Transit shows in-transit inventory that hasn't yet arrived, giving you an accurate real-time picture of your total stock position at all times.
