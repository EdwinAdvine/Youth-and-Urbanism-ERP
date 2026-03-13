# Dashboard — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 2


## Contents

- [dashboard.py](#dashboard) (2 endpoints)

---

## dashboard.py

Dashboard API — aggregated stats and activity feed across all modules.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/stats` | `dashboard_stats` | Return real-time stats from Finance, HR, CRM, and Projects. |
| `GET` | `/activity` | `dashboard_activity` | Return the latest cross-module activity entries. |

### `GET /stats`

**Function:** `dashboard_stats` (line 17)

Return real-time stats from Finance, HR, CRM, and Projects.

Response shape is flat to match frontend DashboardStats interface.

**Auth:** `current_user`


### `GET /activity`

**Function:** `dashboard_activity` (line 115)

Return the latest cross-module activity entries.

**Parameters:** `limit`

**Auth:** `current_user`

