# Manufacturing Module

> Bill of Materials, work orders, quality control, equipment management, and production traceability.

## Overview

The Manufacturing module manages production from design (BOM) through execution (work orders) to quality control and finished goods. Full lot/serial traceability connects raw materials through to finished product.

---

## Features

- **Bill of Materials (BOM)** — multi-level BOMs for complex assemblies
- **Work Orders** — production orders with planned vs actual tracking
- **Work Stations** — production line management with capacity planning
- **Labor tracking** — operator assignment and time tracking
- **Quality control** — checkpoint inspections, pass/fail recording
- **Equipment management** — machine register, maintenance schedules
- **Engineering Change Orders (ECO)** — managed BOM revisions
- **Production planning** — capacity-aware scheduling
- **Traceability** — lot/serial tracking from raw materials → finished goods
- **Cost breakdown** — actual vs standard cost per work order

---

## Key Files

| File | Description |
|------|-------------|
| `backend/app/api/v1/manufacturing.py` | Core: BOMs, work orders, work stations |
| `backend/app/api/v1/manufacturing_ai.py` | AI scheduling and quality prediction |
| `backend/app/api/v1/manufacturing_eco.py` | Engineering Change Orders |
| `backend/app/api/v1/manufacturing_equipment.py` | Equipment register and maintenance |
| `backend/app/api/v1/manufacturing_labor.py` | Labor tracking and time recording |
| `backend/app/api/v1/manufacturing_planning.py` | Production capacity planning |
| `backend/app/api/v1/manufacturing_quality.py` | Quality control inspections |
| `backend/app/api/v1/manufacturing_trace.py` | Lot/serial traceability |
| `backend/app/models/manufacturing.py` | Manufacturing SQLAlchemy models |

---

## Work Order Lifecycle

```
planned → confirmed → in_progress → completed → quality_check → closed
```

## Cross-Module Integrations

| Module | Integration |
|--------|-------------|
| Inventory | BOM components consumed from stock; finished goods added |
| Finance | Production cost journal entry on work order completion |
| Supply Chain | Request raw materials when stock is insufficient |
| HR | Operators assigned from employee directory |
