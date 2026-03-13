# Admin Module

> User management, roles, permissions, RBAC, SSO, backups, and system settings.

## Overview

The Admin module is the platform backbone — it manages users, roles, permissions, App Admin assignments, SSO providers, system settings, license management, and backups. Only Super Admins can access most of these features.

---

## Features

- **User management** — create, edit, deactivate users; bulk CSV import
- **Role management** — create roles with granular permission sets
- **App Admin assignment** — assign users as admins of specific modules
- **RBAC** — three-tier: Super Admin → App Admin → User
- **SSO** — OAuth2/OIDC with Google, Microsoft, custom providers
- **AI configuration** — set AI provider (Ollama/OpenAI/Anthropic), API keys
- **System settings** — company name, logo, timezone, language, defaults
- **Audit log** — immutable log of all system changes
- **License management** — track license, user limits, feature flags
- **Backups** — database backup creation, download, and restore
- **Search** — global cross-module search management
- **Notifications** — notification preferences and delivery settings

---

## Key Files

| File | Description |
|------|-------------|
| `backend/app/api/v1/admin.py` | Core admin: users, settings, audit log |
| `backend/app/api/v1/app_admin.py` | App Admin assignment and dashboard |
| `backend/app/api/v1/auth.py` | Authentication: login, register, refresh, logout |
| `backend/app/api/v1/backups.py` | Database backup management |
| `backend/app/api/v1/license.py` | License management |
| `backend/app/api/v1/roles.py` | Role and permission CRUD |
| `backend/app/api/v1/sso.py` | SSO provider configuration |
| `backend/app/api/v1/user_import.py` | Bulk user CSV import |
| `backend/app/api/v1/users.py` | User profile management |

---

## RBAC Reference

| Role | Access Level | Assigned By |
|------|-------------|-------------|
| Super Admin | Full system | System (seeded) or other Super Admin |
| App Admin | One module fully | Super Admin |
| User | Permission-based | Super Admin or App Admin |

## Default Permissions Pattern

```
finance.invoice.view
finance.invoice.create
finance.invoice.edit
finance.invoice.delete
finance.invoice.send
```

Pattern: `{module}.{resource}.{action}`
