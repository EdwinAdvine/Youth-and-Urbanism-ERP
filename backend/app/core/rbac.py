"""Three-tier Role-Based Access Control (RBAC) for Urban Vibes Dynamics.

Implements the authorization layer that controls what each user can see
and do across every module in the platform.  The model has three tiers:

Tier 1 — Super Admin:
    Full unrestricted access to every module and setting.  Created during
    initial setup.  Can create App Admins and regular Users, configure
    AI providers, manage Docker services, and access global analytics.
    Identified by the ``is_superadmin`` flag on the ``User`` model (and
    mirrored in the JWT ``is_superadmin`` claim for fast checks).

Tier 2 — App Admin:
    Scoped administrative access to **one specific module** (e.g.,
    "Finance Admin" can manage invoices, accounts, and budgets but
    cannot touch HR or CRM).  Represented by rows in the ``AppAdmin``
    table linking a user to an ``app_name``.  A single user may hold
    App Admin rights for multiple modules.

Tier 3 — User:
    Standard access governed by fine-grained permissions.  Permissions
    are grouped into Roles (e.g., "Sales Rep", "Warehouse Clerk"),
    and Roles are assigned to Users via the ``UserRole`` join table.
    Permissions are simple string keys like ``"finance.invoice.create"``
    or ``"hr.employee.view"``.

Relationship chain:
    User ──► UserRole ──► Role ──► RolePermission ──► Permission

Dependency injection helpers in ``core/deps.py`` wrap these functions:
    - ``CurrentUser``           — any authenticated user
    - ``SuperAdminUser``        — requires ``is_superadmin`` (tier 1)
    - ``require_app_admin(app)``— requires AppAdmin for *app* (tier 2)

Usage:
    from app.core.rbac import (
        get_user_permissions, user_has_permission,
        is_app_admin, get_user_app_scopes,
    )

    # Check a specific permission
    if await user_has_permission(db, user_id, "finance.invoice.create"):
        ...

    # Check App Admin status
    if await is_app_admin(db, user_id, "finance"):
        ...

    # Get all permissions (for frontend menu rendering)
    perms = await get_user_permissions(db, user_id)
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import AppAdmin, Permission, Role, RolePermission, UserRole


async def get_user_permissions(db: AsyncSession, user_id: str) -> set[str]:
    """Return the set of permission names held by a user (via their roles).

    Walks the full join chain: ``UserRole → Role → RolePermission →
    Permission`` and collects all distinct permission name strings.

    This is the foundational query for tier-3 (User) authorization.
    Results are **not cached** because permissions may change mid-session
    (e.g., an App Admin revokes a role); every protected endpoint gets
    a fresh check.

    Args:
        db: Async SQLAlchemy session (injected via ``DBSession``).
        user_id: UUID of the user to look up.

    Returns:
        A set of permission name strings, e.g.
        ``{"finance.invoice.create", "finance.invoice.view"}``.
    """
    result = await db.execute(
        # Four-table join: Permission ← RolePermission ← Role ← UserRole
        # We only SELECT the permission name — no full ORM load needed.
        select(Permission.name)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(Role, Role.id == RolePermission.role_id)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
    )
    # Use a set for O(1) membership checks in user_has_permission()
    return {row[0] for row in result.all()}


async def user_has_permission(
    db: AsyncSession, user_id: str, permission: str
) -> bool:
    """Check whether *user_id* holds a specific *permission* string.

    Convenience wrapper around ``get_user_permissions`` for single-
    permission checks.  Used by route-level guards, e.g.::

        if not await user_has_permission(db, user.id, "hr.employee.create"):
            raise HTTPException(403, "Insufficient permissions")

    Args:
        db: Async SQLAlchemy session.
        user_id: UUID of the user.
        permission: Dot-separated permission key (e.g.,
            ``"projects.task.delete"``).

    Returns:
        ``True`` if the user holds the permission via any of their
        assigned roles, ``False`` otherwise.
    """
    perms = await get_user_permissions(db, user_id)
    return permission in perms


async def is_app_admin(
    db: AsyncSession, user_id: str, app_name: str
) -> bool:
    """Check if the user holds an AppAdmin record for the given application.

    This is the tier-2 authorization check.  App Admins have full CRUD
    access within their scoped module but cannot affect other modules.
    The check is a simple existence query against the ``AppAdmin`` table.

    Args:
        db: Async SQLAlchemy session.
        user_id: UUID of the user.
        app_name: Module identifier, e.g. ``"finance"``, ``"hr"``,
            ``"crm"``.  Must match the ``app_name`` column in the
            ``AppAdmin`` table.

    Returns:
        ``True`` if the user is an admin for the specified app.
    """
    result = await db.execute(
        select(AppAdmin).where(
            AppAdmin.user_id == user_id,
            AppAdmin.app_name == app_name,
        )
    )
    # scalar_one_or_none returns the AppAdmin instance or None
    return result.scalar_one_or_none() is not None


async def get_user_app_scopes(db: AsyncSession, user_id: str) -> list[str]:
    """Return list of app names the user is an admin for.

    Used by the frontend to render per-module admin dashboards and by
    the backend to populate the user's session context.  A user with
    no App Admin records gets an empty list (they may still have
    tier-3 permissions or be a Super Admin).

    Args:
        db: Async SQLAlchemy session.
        user_id: UUID of the user.

    Returns:
        A list of module identifier strings, e.g.
        ``["finance", "hr"]``.
    """
    result = await db.execute(
        select(AppAdmin.app_name).where(AppAdmin.user_id == user_id)
    )
    return [row[0] for row in result.all()]
