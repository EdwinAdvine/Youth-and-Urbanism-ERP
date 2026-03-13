# User Profile — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 4


## Contents

- [profile.py](#profile) (4 endpoints)

---

## profile.py

User profile and password management endpoints.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/me` | `get_profile` | Return the authenticated user's profile including preferences. |
| `PUT` | `/me` | `update_profile` | Update the authenticated user's full_name and/or avatar_url. |
| `PUT` | `/me/password` | `change_password` | Change the authenticated user's password after verifying the current one. |
| `GET` | `/me/activity` | `get_activity` | Return the 20 most recent activity entries for the authenticated user. |

### `GET /me`

**Function:** `get_profile` (line 73)

Return the authenticated user's profile including preferences.

**Response model:** `ProfileOut`

**Auth:** `current_user`


### `PUT /me`

**Function:** `update_profile` (line 108)

Update the authenticated user's full_name and/or avatar_url.

**Parameters:** `payload`

**Response model:** `ProfileOut`

**Auth:** `current_user`


### `PUT /me/password`

**Function:** `change_password` (line 160)

Change the authenticated user's password after verifying the current one.

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /me/activity`

**Function:** `get_activity` (line 184)

Return the 20 most recent activity entries for the authenticated user.

**Auth:** `current_user`

