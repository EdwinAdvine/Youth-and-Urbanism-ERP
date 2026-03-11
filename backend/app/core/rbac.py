from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import AppAdmin, Permission, Role, RolePermission, UserRole


async def get_user_permissions(db: AsyncSession, user_id: str) -> set[str]:
    """Return the set of permission names held by a user (via their roles)."""
    result = await db.execute(
        select(Permission.name)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(Role, Role.id == RolePermission.role_id)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
    )
    return {row[0] for row in result.all()}


async def user_has_permission(
    db: AsyncSession, user_id: str, permission: str
) -> bool:
    perms = await get_user_permissions(db, user_id)
    return permission in perms


async def is_app_admin(
    db: AsyncSession, user_id: str, app_name: str
) -> bool:
    """Check if the user holds an AppAdmin record for the given application."""
    result = await db.execute(
        select(AppAdmin).where(
            AppAdmin.user_id == user_id,
            AppAdmin.app_name == app_name,
        )
    )
    return result.scalar_one_or_none() is not None


async def get_user_app_scopes(db: AsyncSession, user_id: str) -> list[str]:
    """Return list of app names the user is an admin for."""
    result = await db.execute(
        select(AppAdmin.app_name).where(AppAdmin.user_id == user_id)
    )
    return [row[0] for row in result.all()]
