# Authentication & Authorization

Urban Vibes Dynamics uses **JWT-based authentication** with a **three-tier RBAC model**.
This document covers the full authentication flow, token lifecycle, dependency
injection patterns, and role-based access control.

---

## Authentication Flow

```
1. Client POST /api/v1/auth/login  { email, password }
2. Backend:
   a. Loads user by email from PostgreSQL
   b. Verifies password with bcrypt (passlib)
   c. Checks user.is_active
3. Backend returns:
   { access_token, refresh_token, token_type: "bearer" }
4. Client includes token on every request:
   Authorization: Bearer <access_token>
5. Backend middleware validates JWT → extracts user_id → loads User from DB
```

---

## Token Types

### Access Token
- **Lifetime:** `ACCESS_TOKEN_EXPIRE_MINUTES` (default: 60 minutes)
- **Contains:** `sub` (user_id UUID), `type: "access"`, `exp`, `iat`
- **Storage:** Client memory or localStorage — never in a cookie
- **Algorithm:** HS256 signed with `SECRET_KEY`

### Refresh Token
- **Lifetime:** `REFRESH_TOKEN_EXPIRE_DAYS` (default: 30 days)
- **Contains:** `sub` (user_id UUID), `type: "refresh"`, `jti` (unique token ID)
- **Storage:** Stored in Redis with TTL; validated on refresh
- **Use:** `POST /api/v1/auth/refresh` to obtain a new access token

### Token Invalidation
Tokens cannot be explicitly revoked before expiry (stateless JWT), **except**
refresh tokens, which are stored in Redis and deleted on:
- `POST /api/v1/auth/logout`
- Password change
- Admin deactivation of user account

---

## Three-Tier RBAC

```
Super Admin
  ├── Full system access
  ├── Creates App Admins and Users
  ├── Manages global settings, AI config, backups
  └── All permissions across all modules

App Admin (scoped per module)
  ├── e.g., Finance Admin, HR Admin, CRM Admin
  ├── Full access within their module
  ├── Cannot access admin features of other modules
  └── Assigned by Super Admin

User (permission-based)
  ├── Access defined by assigned Role
  ├── Roles contain permission sets per module
  └── Created by Super Admin or App Admin
```

---

## Dependency Injection

All authentication is handled via FastAPI's dependency injection system.
Import the appropriate type from `app.core.deps`:

### `CurrentUser` — Any authenticated user

```python
from app.core.deps import CurrentUser

@router.get("/invoices")
async def list_invoices(current_user: CurrentUser, db: DBSession):
    # current_user is a User ORM object, already validated
    ...
```

### `SuperAdminUser` — Super Admin only

```python
from app.core.deps import SuperAdminUser

@router.delete("/users/{user_id}")
async def delete_user(user_id: UUID, current_user: SuperAdminUser, db: DBSession):
    # Raises 403 if user is not a Super Admin
    ...
```

### `require_app_admin(app_name)` — App Admin factory

```python
from app.core.deps import require_app_admin

FinanceAdmin = require_app_admin("finance")

@router.post("/chart-of-accounts")
async def create_account(
    payload: AccountCreate,
    current_user: Annotated[User, Depends(FinanceAdmin)],
    db: DBSession,
):
    # Raises 403 unless: user is Super Admin, OR has Finance App Admin role
    ...
```

### `DBSession` — Async database session

```python
from app.core.deps import DBSession
from sqlalchemy.ext.asyncio import AsyncSession

@router.get("/items")
async def list_items(db: DBSession):
    # db is an AsyncSession, automatically closed after request
    ...
```

---

## Permission Model

Permissions follow the pattern: `{module}.{resource}.{action}`

Examples:
- `finance.invoice.create`
- `finance.invoice.delete`
- `hr.employee.view`
- `crm.lead.convert`

Users inherit permissions from their assigned Role. Super Admins bypass all
permission checks. App Admins have full access within their module scope.

**Checking permissions programmatically:**

```python
from app.core.rbac import user_has_permission

can_delete = await user_has_permission(db, user.id, "finance.invoice.delete")
```

---

## SSO (OAuth2/OIDC)

Super Admins can configure SSO providers in Admin > SSO:
- Google Workspace
- Microsoft Entra ID (Azure AD)
- Custom OIDC provider

SSO users are automatically created on first login and assigned the default
User role. SSO configuration is stored in the `SSOProvider` model.

SSO endpoints:
- `GET /api/v1/sso/providers` — list enabled providers
- `GET /api/v1/sso/authorize/{provider}` — start OAuth flow
- `GET /api/v1/sso/callback/{provider}` — handle OAuth callback

---

## Field-Level Encryption

Sensitive fields (e.g., IMAP/SMTP passwords, API keys) stored in the database
are encrypted using **Fernet symmetric encryption** (AES-128-CBC + HMAC-SHA256).

The encryption key is derived from `SECRET_KEY`. Functions are in
`backend/app/core/security.py`:

```python
from app.core.security import encrypt_field, decrypt_field

encrypted = encrypt_field("my-api-key")
original = decrypt_field(encrypted)
```

> **Important:** Changing `SECRET_KEY` in production will make all encrypted
> fields unreadable. Back up and re-encrypt before rotating the key.
