# Compliance — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 3


## Contents

- [compliance.py](#compliance) (3 endpoints)

---

## compliance.py

GDPR compliance — data export and deletion requests.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/me/data-export` | `export_my_data` | Return a JSON bundle of all data associated with the current user. |
| `DELETE` | `/me/account` | `request_account_deletion` | Schedule account deletion. Superadmins cannot self-delete. |
| `GET` | `/data-retention` | `get_retention_policies` | — |

### `GET /me/data-export`

**Function:** `export_my_data` (line 14)

Return a JSON bundle of all data associated with the current user.

**Auth:** `current_user`


### `DELETE /me/account`

**Function:** `request_account_deletion` (line 39)

Schedule account deletion. Superadmins cannot self-delete.

**Parameters:** `request`, `background_tasks`

**Auth:** `current_user`


### `GET /data-retention`

**Function:** `get_retention_policies` (line 51)

**Auth:** `_`

