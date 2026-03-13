---
title: Bills of Materials (BOM)
slug: bills-of-materials
category: manufacturing
article_type: guide
module: manufacturing
tags: [bom, bill-of-materials, manufacturing, components, production]
sort_order: 1
is_pinned: false
excerpt: Define product recipes with Bills of Materials specifying raw materials and quantities.
---

# Bills of Materials (BOM)

A Bill of Materials is the recipe for a manufactured product — it lists every component, raw material, and sub-assembly required to produce one unit of the finished good. Accurate BOMs are the foundation of reliable work orders, accurate costing, and effective material planning.

## Creating a New BOM

Navigate to **Manufacturing → BOMs → New BOM**.

1. **Finished Product** — Select the product being manufactured from the product catalogue. If the product does not exist yet, create it first under Inventory → Products (set the product type to "Manufactured").

2. **BOM Type** — Choose:
   - **Manufacturing** — Standard production BOM.
   - **Kit** — Components are assembled at point of sale without a work order (e.g. gift baskets, bundled products).
   - **Sub-Assembly** — Used as a component in a higher-level BOM.

3. **Quantity** — The finished quantity that this BOM produces (usually 1 unit, but may be higher for batch production, e.g. "produces 100 kg").

4. **Unit of Measure** — Must match the product's UoM (e.g. kg, litres, pieces).

## Adding Components

Click **Add Component** for each raw material or sub-assembly required:

- **Component** — Select from the product/material catalogue.
- **Quantity** — Amount required per finished unit (or per the BOM quantity defined above).
- **Unit of Measure** — The UoM in which you consume this material (e.g. grams, ml, pieces). Can differ from the UoM in which you purchase it — Urban Vibes Dynamics handles the conversion automatically.
- **Scrap %** — Expected waste percentage for this component (e.g. 5% for cutting losses in fabric). Used in cost calculations and material requisition quantities.

## Multi-Level BOMs (Sub-Assemblies)

If a component is itself a manufactured item (a sub-assembly), Urban Vibes Dynamics automatically recognises it has its own BOM. During work order creation, the system can optionally generate child work orders for each sub-assembly. This is called a **multi-level BOM explosion**.

Example:
```
Finished Good: Assembled Machine (1 unit)
  ├── Steel Frame (1 unit) ← has its own BOM
  │     ├── Steel Sheet 3mm — 4 kg
  │     └── Welding Wire — 0.2 kg
  ├── Electric Motor (2 units) ← purchased component
  └── Control Panel (1 unit) ← has its own BOM
```

To view the full explosion, open the BOM and click **Explode BOM**. This shows every raw material at every level with total required quantities.

## BOM Version Control

BOMs change over time (supplier switches, recipe improvements, cost optimisation). Urban Vibes Dynamics keeps full version history:

- Click **New Version** to create a revised BOM while preserving the original.
- Set the new version as **Active** — all new work orders will use the active version.
- Old work orders retain the BOM version they were created with, so historical costing remains accurate.
- Add a **Change Reason** note when creating a new version (required for audit trail).

## Cost Explosion

Click **Calculate Cost** on any BOM to see the total material cost at current purchase prices:

| Component | Qty | Unit Cost (KES) | Total (KES) |
|---|---|---|---|
| Raw Material A | 2 kg | 150 | 300 |
| Raw Material B | 0.5 litres | 400 | 200 |
| Sub-Assembly C | 1 unit | 850 | 850 |
| **Total Material Cost** | | | **1,350** |

This is the material cost only. Work order costing adds labour (from workstation hourly rates) and overhead to produce the full manufactured cost.

## Linking BOM to Work Orders

When you create a Work Order and select a product, Urban Vibes Dynamics automatically loads the active BOM. All component quantities are calculated and reserved from stock. You can view and adjust the components on the work order before confirming — useful for one-off substitutions without changing the master BOM.

## Best Practices

- Review BOMs quarterly and update costs — outdated BOMs produce misleading product cost calculations.
- Always specify scrap percentages for materials with known waste; this prevents systematic under-purchasing.
- Use the **Explode BOM** view before raising large production runs to check that all sub-assembly materials are available or on order.
