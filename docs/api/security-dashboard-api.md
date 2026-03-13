# Security Dashboard — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 8


## Contents

- [security_dashboard.py](#security-dashboard) (8 endpoints)

---

## security_dashboard.py

Security dashboard — Super Admin only overview.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/overview` | `security_overview` | — |
| `GET` | `/events` | `list_security_events` | — |
| `POST` | `/events/{event_id}/resolve` | `resolve_event` | — |
| `GET` | `/login-activity` | `login_activity` | — |
| `GET` | `/ip-blocklist` | `get_ip_blocklist` | — |
| `POST` | `/ip-blocklist` | `add_to_blocklist` | — |
| `DELETE` | `/ip-blocklist/{ip}` | `remove_from_blocklist` | — |
| `POST` | `/lockdown` | `emergency_lockdown` | — |

### `GET /overview`

**Function:** `security_overview` (line 15)

**Auth:** `current_user`


### `GET /events`

**Function:** `list_security_events` (line 61)

**Parameters:** `skip`, `limit`, `severity`, `resolved`

**Auth:** `current_user`


### `POST /events/{event_id}/resolve`

**Function:** `resolve_event` (line 91)

**Parameters:** `event_id`

**Auth:** `current_user`


### `GET /login-activity`

**Function:** `login_activity` (line 105)

**Parameters:** `days`

**Auth:** `current_user`


### `GET /ip-blocklist`

**Function:** `get_ip_blocklist` (line 119)

**Auth:** `current_user`


### `POST /ip-blocklist`

**Function:** `add_to_blocklist` (line 123)

**Parameters:** `ip`, `ttl_hours`

**Auth:** `current_user`


### `DELETE /ip-blocklist/{ip}`

**Function:** `remove_from_blocklist` (line 128)

**Parameters:** `ip`

**Auth:** `current_user`


### `POST /lockdown`

**Function:** `emergency_lockdown` (line 133)

**Auth:** `current_user`

