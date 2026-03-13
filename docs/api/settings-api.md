# Settings — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 5


## Contents

- [settings.py](#settings) (5 endpoints)

---

## settings.py

System settings, user preferences, and changelog endpoints.

Provides:
- System settings CRUD (Super Admin only for writes; public safe keys readable by all)
- User preferences per authenticated user (theme, language, timezone, notifications)
- GET /changelog — serves CHANGELOG.md as raw markdown for the in-app changelog page

Router prefix: /settings (registered in api/v1/__init__.py)


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `` | `list_settings` | Return system settings. |
| `PUT` | `` | `bulk_upsert_settings` | Create or update system settings in bulk. Requires Super Admin. |
| `GET` | `/preferences` | `get_preferences` | Return the authenticated user's preferences, or defaults if none saved. |
| `PUT` | `/preferences` | `update_preferences` | Update (or create) the authenticated user's preferences. |
| `GET` | `/changelog` | `get_changelog` | Return the contents of CHANGELOG.md as plain text markdown. |

### `GET `

**Function:** `list_settings` (line 74)

Return system settings.

Super admins see all settings; regular users only see safe public keys.

**Auth:** `current_user`


### `PUT `

**Function:** `bulk_upsert_settings` (line 97)

Create or update system settings in bulk. Requires Super Admin.

**Parameters:** `payload`

**Auth:** `_admin`


### `GET /preferences`

**Function:** `get_preferences` (line 137)

Return the authenticated user's preferences, or defaults if none saved.

**Response model:** `PreferencesOut`

**Auth:** `current_user`


### `PUT /preferences`

**Function:** `update_preferences` (line 158)

Update (or create) the authenticated user's preferences.

**Parameters:** `payload`

**Response model:** `PreferencesOut`

**Auth:** `current_user`


### `GET /changelog`

**Function:** `get_changelog` (line 191)

Return the contents of CHANGELOG.md as plain text markdown.

Used by the in-app Changelog page (Settings → Changelog) to render
the full release history without a separate static file server.
Any authenticated user can read the changelog.

**Auth:** `_current_user`

