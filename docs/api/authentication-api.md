# Authentication — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 13


## Contents

- [auth.py](#auth) (7 endpoints)
- [sso.py](#sso) (6 endpoints)

---

## auth.py


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/login` | `login` | — |
| `POST` | `/register` | `register` | — |
| `POST` | `/refresh` | `refresh` | — |
| `POST` | `/logout` | `logout` | — |
| `POST` | `/change-password` | `change_password` | — |
| `POST` | `/admin/users/{user_id}/unlock` | `unlock_account` | — |
| `GET` | `/me` | `me` | — |

### `POST /login`

**Function:** `login` (line 40)

**Parameters:** `request`, `payload`


### `POST /register`

**Function:** `register` (line 54)

**Parameters:** `request`, `payload`

**Response model:** `UserResponse`


### `POST /refresh`

**Function:** `refresh` (line 65)

**Parameters:** `request`, `payload`

**Response model:** `TokenResponse`


### `POST /logout`

**Function:** `logout` (line 74)

**Response model:** `MessageResponse`

**Auth:** `current_user`


### `POST /change-password`

**Function:** `change_password` (line 81)

**Parameters:** `request`, `payload`

**Response model:** `MessageResponse`

**Auth:** `current_user`


### `POST /admin/users/{user_id}/unlock`

**Function:** `unlock_account` (line 96)

**Parameters:** `user_id`

**Response model:** `MessageResponse`

**Auth:** `admin`


### `GET /me`

**Function:** `me` (line 107)

**Response model:** `UserMeResponse`

**Auth:** `current_user`


---

## sso.py


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/providers` | `list_providers` | — |
| `POST` | `/providers` | `create_provider` | — |
| `PUT` | `/providers/{provider_id}` | `update_provider` | — |
| `DELETE` | `/providers/{provider_id}` | `delete_provider` | — |
| `GET` | `/{provider_id}/authorize` | `authorize` | — |
| `GET` | `/{provider_id}/callback` | `callback` | — |

### `GET /providers`

**Function:** `list_providers` (line 69)


### `POST /providers`

**Function:** `create_provider` (line 79)

**Parameters:** `payload`

**Response model:** `SSOProviderResponse`

**Auth:** `_`


### `PUT /providers/{provider_id}`

**Function:** `update_provider` (line 103)

**Parameters:** `provider_id`, `payload`

**Response model:** `SSOProviderResponse`

**Auth:** `_`


### `DELETE /providers/{provider_id}`

**Function:** `delete_provider` (line 128)

**Parameters:** `provider_id`

**Auth:** `_`


### `GET /{provider_id}/authorize`

**Function:** `authorize` (line 145)

**Parameters:** `provider_id`


### `GET /{provider_id}/callback`

**Function:** `callback` (line 158)

**Parameters:** `provider_id`, `code`, `state`

