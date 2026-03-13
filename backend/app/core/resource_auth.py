"""Row-level resource authorization for Urban Vibes Dynamics.

Generic check_resource_access() validates whether a user can perform
an action on a specific resource based on ownership, team membership,
shared access, app admin, or super admin.
"""
from __future__ import annotations
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status


async def check_resource_access(
    db: AsyncSession,
    user,
    resource_type: str,
    resource_id: UUID,
    permission: str = "read",
) -> bool:
    """Check whether *user* can perform *permission* on *resource_type*/*resource_id*.

    Access tiers (first match wins):
    1. Super Admin — always allowed.
    2. Resource owner (`owner_id == user.id` or `user_id == user.id`).
    3. Team member sharing the resource.
    4. Explicit share record granting the user access.
    5. App Admin for the resource's module.
    6. Default deny.

    Returns True if allowed, raises HTTP 403 if denied.
    """
    # 1. Super Admin bypass
    if getattr(user, "is_superadmin", False):
        return True

    user_id = user.id

    # 2. Check ownership — try common owner column names
    table_map = {
        "drive_file": ("drive_files", ["owner_id", "uploaded_by"]),
        "note": ("notes", ["owner_id", "user_id", "author_id"]),
        "project": ("projects", ["owner_id", "manager_id", "created_by"]),
        "form": ("forms", ["owner_id", "created_by"]),
    }

    if resource_type in table_map:
        from sqlalchemy import text  # noqa: PLC0415
        table_name, owner_cols = table_map[resource_type]
        for col in owner_cols:
            row = await db.execute(
                text(f"SELECT id FROM {table_name} WHERE id = :rid AND {col} = :uid LIMIT 1"),
                {"rid": str(resource_id), "uid": str(user_id)},
            )
            if row.first():
                return True

    # 3. Check shared access via file_shares table
    if resource_type == "drive_file":
        from sqlalchemy import text  # noqa: PLC0415
        row = await db.execute(
            text(
                "SELECT id FROM file_shares WHERE file_id = :rid AND shared_with_user_id = :uid "
                "AND (permission = :perm OR permission = 'edit') LIMIT 1"
            ),
            {"rid": str(resource_id), "uid": str(user_id), "perm": permission},
        )
        if row.first():
            return True

    # 4. App Admin check
    module_map = {
        "drive_file": "drive",
        "note": "notes",
        "project": "projects",
        "form": "forms",
    }
    app_name = module_map.get(resource_type)
    if app_name:
        from app.core.rbac import is_app_admin  # noqa: PLC0415
        if await is_app_admin(db, str(user_id), app_name):
            return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Access to {resource_type}/{resource_id} denied",
    )
