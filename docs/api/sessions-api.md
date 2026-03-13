# Sessions — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 3


## Contents

- [sessions.py](#sessions) (3 endpoints)

---

## sessions.py

Session management — list, revoke, sign out everywhere.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `` | `list_sessions` | — |
| `DELETE` | `/{session_id}` | `revoke_session` | — |
| `DELETE` | `` | `revoke_all_sessions` | — |

### `GET `

**Function:** `list_sessions` (line 17)

**Auth:** `current_user`


### `DELETE /{session_id}`

**Function:** `revoke_session` (line 27)

**Parameters:** `session_id`

**Auth:** `current_user`


### `DELETE `

**Function:** `revoke_all_sessions` (line 40)

**Parameters:** `request`

**Auth:** `current_user`

