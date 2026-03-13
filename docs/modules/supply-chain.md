# Supply Chain Module

> Supplier management, purchase requisitions, goods receiving, and procurement planning.

## Overview

The Supply Chain module manages the procurement lifecycle: supplier directory, purchase requisitions, purchase orders (created in Inventory), goods receiving notes (GRN), and returns. It connects supplier relationships with inventory stock management.

---

## Features

- Supplier directory with performance ratings and payment terms
- Purchase requisitions with approval workflow
- Goods Received Notes (GRN) linked to purchase orders
- Return management for defective or incorrect goods
- Procurement planning with demand forecasting
- Supplier performance analytics
- Auto-procurement triggers from E-Commerce (low stock)

---

## Key Files

| File | Description |
|------|-------------|
| `backend/app/api/v1/supplychain.py` | Core: suppliers, requisitions, GRNs |
| `backend/app/api/v1/supplychain_ext.py` | Extended supply chain features |
| `backend/app/api/v1/supplychain_ops.py` | Operational workflows |
| `backend/app/api/v1/supplychain_planning.py` | Demand forecasting and planning |
| `backend/app/models/supplychain.py` | Supply chain SQLAlchemy models |

---

## GRN Workflow

```
Purchase Order sent to supplier
         ↓
Goods arrive at warehouse
         ↓
Create GRN → select PO → verify quantities
         ↓
Submit GRN → Inventory stock updated automatically
         ↓
Event: supplychain.goods_received → Inventory + Finance notified
```

## Cross-Module Integrations

| Module | Integration |
|--------|-------------|
| Inventory | GRN receipt → stock level increase |
| Finance | Procurement costs → vendor bills / accounts payable |
| E-Commerce | Low stock event → auto-create procurement request |
| Manufacturing | Raw material shortage → procurement request |
