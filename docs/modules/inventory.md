# Inventory Module

> Multi-warehouse stock management, serial tracking, kits, and automated replenishment.

## Overview

The Inventory module manages the full lifecycle of physical goods: item catalog, multi-warehouse stock, purchase orders, goods receiving, stock adjustments, costing methods, and reorder automation.

---

## Features

- Multi-warehouse / bin location management
- Item catalog with variants, UOM (units of measure), barcodes
- Serial number and lot tracking
- Kit/bundle assembly (Bill of Materials for simple assemblies)
- Inventory costing: FIFO, LIFO, weighted average
- Stock adjustments and cycle counts
- Purchase orders (PO) with partial receiving
- Automated replenishment rules (min/max levels)
- Inventory analytics: stock value, movement history, slow-moving items
- WMS (Warehouse Management System) — pick/pack/ship workflows

---

## Key Files

| File | Description |
|------|-------------|
| `backend/app/api/v1/inventory.py` | Core CRUD: items, warehouses, stock movements |
| `backend/app/api/v1/inventory_automation.py` | Auto-replenishment rules |
| `backend/app/api/v1/inventory_costing.py` | Costing method calculations |
| `backend/app/api/v1/inventory_kits.py` | Kit/bundle assembly |
| `backend/app/api/v1/inventory_replenishment.py` | Reorder point management |
| `backend/app/api/v1/inventory_serial_uom.py` | Serial/lot tracking and UOM conversions |
| `backend/app/api/v1/inventory_wms.py` | Warehouse management (pick/pack/ship) |
| `backend/app/models/inventory.py` | Inventory SQLAlchemy models |

---

## Cross-Module Integrations

| Module | Integration |
|--------|-------------|
| Supply Chain | GRN receipt → stock increase; low stock → procurement request |
| Finance | Stock valuation changes update balance sheet asset account |
| E-Commerce | Product stock levels synced; order fulfillment deducts stock |
| POS | Sale deducts stock; session close reconciles |
| Manufacturing | BOM components consumed; finished goods added |
