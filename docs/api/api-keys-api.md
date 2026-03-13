# Api Keys — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 3


## Contents

- [api_keys.py](#api-keys) (3 endpoints)

---

## api_keys.py

API key management — generate, list, revoke.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `` | `create_api_key` | — |
| `GET` | `` | `list_api_keys` | — |
| `DELETE` | `/{key_id}` | `revoke_api_key` | — |

### `POST `

**Function:** `create_api_key` (line 35)

**Parameters:** `request`, `payload`

**Response model:** `APIKeyCreatedResponse`

**Auth:** `current_user`


### `GET `

**Function:** `list_api_keys` (line 52)

**Auth:** `current_user`


### `DELETE /{key_id}`

**Function:** `revoke_api_key` (line 59)

**Parameters:** `key_id`

**Auth:** `current_user`

