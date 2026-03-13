# Point of Sale (POS) Module

> In-store sales terminal with session management, loyalty, KDS, and Finance integration.

## Overview

The POS module provides a touch-friendly in-store sales terminal with session management, barcode scanning, multi-payment methods, receipt printing, and real-time Finance integration (every sale posts a journal entry automatically).

---

## Features

- **POS terminal** — product grid, search, barcode scan, cart management
- **Sessions** — open/close sessions with cash reconciliation
- **Multi-terminal** — multiple POS terminals per location
- **Payment methods** — cash, card, mobile money (M-Pesa), split payment
- **Receipts** — thermal receipt printing and email receipt
- **Discounts** — per-item and cart-level discounts
- **Loyalty** — points earn/redeem integrated with the Loyalty module
- **Kitchen Display System (KDS)** — order display for kitchen/bar workflows
- **Returns & refunds** — process returns against original sales
- **Shift reports** — end-of-shift sales summary and cash count
- **Finance integration** — every sale auto-posts a journal entry

---

## Key Files

| File | Description |
|------|-------------|
| `backend/app/api/v1/pos.py` | Core: sessions, transactions, products |
| `backend/app/api/v1/pos_ext.py` | Extended: returns, reporting, terminal config |
| `backend/app/api/v1/pos_loyalty.py` | Loyalty points integration |
| `backend/app/api/v1/kds.py` | Kitchen Display System |
| `backend/app/api/v1/loyalty.py` | Loyalty program management |
| `backend/app/models/pos.py` | POS SQLAlchemy models |

---

## Events Published

| Event | Trigger | Handled By |
|-------|---------|------------|
| `pos.sale.completed` | Transaction finalized | Finance (journal entry), CRM (purchase history), Mail (email receipt) |

## Cross-Module Integrations

| Module | Integration |
|--------|-------------|
| Finance | Each sale auto-posts a journal entry (revenue + payment method) |
| Inventory | Stock deducted on sale |
| CRM | Customer purchase history tracked |
| Mail | Email receipt to customer |
| E-Commerce | Shared loyalty points across channels |
