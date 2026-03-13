"""FastAPI dependency injection — authentication, authorization, and DB sessions.

Provides reusable ``Depends()`` functions and type aliases that every API
router in Urban Vibes Dynamics uses for:

- **Authentication** — extracting and validating a JWT bearer token, then
  resolving the corresponding ``User`` row from the database.
- **Authorization** — enforcing Super Admin or per-app Admin access via
  the three-tier RBAC model (Super Admin > App Admin > User).
- **Database sessions** — injecting an async SQLAlchemy session.

Usage:
    from app.core.deps import CurrentUser, SuperAdminUser, DBSession

    @router.get("/invoices")
    async def list_invoices(user: CurrentUser, db: DBSession):
        ...

    @router.post("/settings")
    async def update_settings(admin: SuperAdminUser, db: DBSession):
        ...

    @router.delete("/hr/employees/{id}")
    async def delete_employee(
        user: Annotated[User, Depends(require_app_admin("hr"))],
        db: DBSession,
    ):
        ...

Integrations:
    - core/security.py  — ``decode_token()`` for JWT verification
    - core/database.py  — ``get_db()`` for async session lifecycle
    - core/rbac.py      — ``is_app_admin()`` for per-module admin checks
    - models/user.py    — ``User`` model with ``is_superadmin`` and ``is_active``

Permissions:
    - ``CurrentUser``      — any authenticated, active user
    - ``SuperAdminUser``   — must have ``is_superadmin=True``
    - ``require_app_admin(app)`` — Super Admin OR app-scoped admin for *app*
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any

import sqlalchemy as sa
from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, get_read_db
from app.core.security import decode_token
from app.models.user import User

# auto_error=False so we can fall back to X-API-Key header authentication.
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Validate a JWT bearer token (or X-API-Key header) and return the authenticated User.

    Authentication order:
    1. JWT in ``Authorization: Bearer <token>`` header.
    2. Raw API key in ``X-API-Key: <key>`` header.

    Raises:
        HTTPException 401: If neither credential is valid or the user is inactive.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # --- 1. Try JWT Bearer token ---
    if credentials is not None:
        try:
            payload = decode_token(credentials.credentials)
            user_id: str | None = payload.get("sub")
            token_type: str | None = payload.get("type")
            # Reject refresh tokens used as access tokens
            if user_id is None or token_type != "access":
                raise credentials_exception
        except JWTError:
            raise credentials_exception

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None or not user.is_active:
            raise credentials_exception

        # Update session last_active_at non-blockingly (best-effort)
        jti = payload.get("jti")
        if jti:
            try:
                from app.models.session import UserSession  # noqa: PLC0415
                await db.execute(
                    sa.update(UserSession)
                    .where(
                        UserSession.token_jti == jti,
                        UserSession.revoked_at.is_(None),
                    )
                    .values(last_active_at=datetime.now(UTC))
                )
            except Exception:
                pass  # Never block requests for session tracking failures

        return user

    # --- 2. Try X-API-Key header ---
    api_key_header = request.headers.get("X-API-Key")
    if api_key_header:
        user = await get_user_from_api_key(api_key_header, db)
        if user is not None:
            return user

    raise credentials_exception


async def require_super_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Enforce Super Admin access on a route.

    Use this dependency for system-wide operations such as global settings,
    AI provider configuration, and user management.  Chains on top of
    ``get_current_user`` so the caller is already authenticated.

    Returns:
        The authenticated Super Admin ``User`` instance.

    Raises:
        HTTPException 403: If the authenticated user is not a Super Admin.
    """
    if not current_user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required",
        )
    return current_user


def require_app_admin(app_name: str):
    """Factory that returns a dependency enforcing app-scoped admin access.

    The three-tier RBAC model allows admins to be scoped to a specific
    application (e.g., "finance", "hr", "crm").  This factory produces a
    dependency that checks whether the caller is either:

    1. A **Super Admin** — always passes (full system access), or
    2. An **App Admin** for the given ``app_name`` — checked via
       ``rbac.is_app_admin()``, which queries the user's role assignments.

    Args:
        app_name: The module/app slug to check admin access for
            (e.g., "finance", "hr", "crm", "projects").

    Returns:
        An async dependency function suitable for use with ``Depends()``.

    Example:
        @router.delete("/hr/employees/{id}")
        async def delete_employee(
            user: Annotated[User, Depends(require_app_admin("hr"))],
            db: DBSession,
        ):
            ...

    Raises:
        HTTPException 403: If the user is neither a Super Admin nor an
            admin for the specified app.
    """

    async def _check(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> User:
        # Super Admins bypass all per-app checks — they have full system access
        if current_user.is_superadmin:
            return current_user

        # Lazy import to avoid circular dependency: deps → rbac → models → deps
        from app.core.rbac import is_app_admin  # noqa: PLC0415

        # Check the user's role assignments for the target app
        if not await is_app_admin(db, str(current_user.id), app_name):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Admin access to '{app_name}' required",
            )
        return current_user

    return _check


def require_app_access(app_name: str):
    """Factory that returns a dependency enforcing per-user app access.

    Checks the ``AppAccess`` table to see whether the user has been granted
    access to the given module. Super Admins always pass. If no ``AppAccess``
    row exists for the user+app, access is allowed by default (opt-out model).

    Args:
        app_name: The module slug (e.g., "finance", "hr", "crm").

    Returns:
        An async dependency function suitable for ``Depends()``.
    """

    async def _check(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> User:
        if current_user.is_superadmin:
            return current_user

        from app.models.user import AppAccess  # noqa: PLC0415

        result = await db.execute(
            select(AppAccess).where(
                AppAccess.user_id == current_user.id,
                AppAccess.app_name == app_name,
            )
        )
        access = result.scalar_one_or_none()
        # If a row exists and granted=False, block access
        if access is not None and not access.granted:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access to '{app_name}' is restricted for your account",
            )
        return current_user

    return _check


# ── Convenience type aliases ──────────────────────────────────────────────────
# These Annotated aliases embed the Depends() call so route handlers can
# declare dependencies with a single type annotation instead of repeating
# the full Annotated[..., Depends(...)] pattern in every signature.

def sparse_fields(
    fields: str | None = Query(
        default=None,
        description="Comma-separated list of fields to include in the response. "
                    "Example: ?fields=id,name,status",
    ),
) -> set[str] | None:
    """Dependency that parses ?fields=id,name,status into a set of field names.

    Usage in a router:
        @router.get("/invoices")
        async def list_invoices(
            fields: Annotated[set[str] | None, Depends(sparse_fields)],
            ...
        ):
            invoices = ...
            if fields:
                return [inv.model_dump(include=fields) for inv in invoices]
            return invoices
    """
    if not fields:
        return None
    return {f.strip() for f in fields.split(",") if f.strip()}


def apply_sparse_fields(obj: Any, fields: set[str] | None) -> Any:
    """Helper: filter a Pydantic model or dict to only the requested fields.

    If ``fields`` is None, the original object is returned unchanged.
    Works with Pydantic v2 models (model_dump) and plain dicts.
    """
    if fields is None:
        return obj
    if hasattr(obj, "model_dump"):
        return obj.model_dump(include=fields)
    if isinstance(obj, dict):
        return {k: v for k, v in obj.items() if k in fields}
    return obj


SparseFields = Annotated[set[str] | None, Depends(sparse_fields)]

CurrentUser = Annotated[User, Depends(get_current_user)]       # any authenticated, active user
SuperAdminUser = Annotated[User, Depends(require_super_admin)] # must be a Super Admin
DBSession = Annotated[AsyncSession, Depends(get_db)]           # async SQLAlchemy session — primary (write)
ReadDBSession = Annotated[AsyncSession, Depends(get_read_db)]  # async SQLAlchemy session — read replica (or primary fallback)


async def get_user_from_api_key(api_key: str, db: AsyncSession) -> User | None:
    """Look up user from API key header value."""
    from app.models.session import APIKey  # noqa: PLC0415
    from datetime import UTC, datetime  # noqa: PLC0415
    key_hash = APIKey.hash_key(api_key)
    result = await db.execute(
        select(APIKey).where(
            APIKey.key_hash == key_hash,
            APIKey.is_active == True,
        ).where(
            (APIKey.expires_at.is_(None)) | (APIKey.expires_at > datetime.now(UTC))
        )
    )
    api_key_obj = result.scalar_one_or_none()
    if not api_key_obj:
        return None
    # Update last_used_at
    api_key_obj.last_used_at = datetime.now(UTC)
    user_result = await db.execute(select(User).where(User.id == api_key_obj.user_id))
    user = user_result.scalar_one_or_none()
    if user and user.is_active:
        return user
    return None
