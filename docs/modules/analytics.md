# Analytics Module

> Built-in ERP analytics dashboard with real-time metrics across all modules.

## Overview

The Analytics module provides a built-in analytics dashboard that replaced Superset. It runs direct PostgreSQL queries for real-time data — no external BI tool required. Covers revenue, users, module activity, expenses, support metrics, and top products.

---

## Features

- **Revenue analytics** — monthly/quarterly/annual revenue trends
- **User activity** — active users, module usage, feature adoption
- **Module metrics** — per-module KPIs (Finance, HR, CRM, Support, E-Commerce)
- **Expense analytics** — spend by category, department, vendor
- **Support metrics** — ticket volume, resolution times, CSAT trends
- **Top products** — best-selling products across POS and E-Commerce
- **Customer analytics** — acquisition, retention, lifetime value
- **Custom dashboards** — Super Admin can define custom metric schemas
- **Export** — CSV/Excel export of any analytics report

---

## Key Files

| File | Description |
|------|-------------|
| `backend/app/api/v1/analytics.py` | Core analytics endpoints |
| `backend/app/api/v1/analytics_ext.py` | Extended module-specific analytics |
| `backend/app/api/v1/analytics_schema.py` | Custom analytics schema definitions |
| `frontend/src/features/analytics/` | Analytics dashboard pages |
| `frontend/src/api/analytics.ts` | Analytics API client hooks |

---

## Architecture

All analytics use **direct PostgreSQL queries** (not a separate data warehouse):
- Queries are optimized with appropriate indexes
- Results are cached in Redis for 5 minutes
- Heavy reports use Celery background tasks for async computation

## Access

- Regular users: see analytics for their own module (Finance users see Finance metrics)
- App Admins: see full analytics for their module
- Super Admin: see all analytics across all modules
