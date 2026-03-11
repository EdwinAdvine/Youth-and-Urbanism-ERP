from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import SuperAdminUser
from app.schemas.user import (
    AssignRoleRequest,
    PermissionCreate,
    PermissionResponse,
    RoleCreate,
    RoleResponse,
    RoleUpdate,
)
from app.services.user import UserService

router = APIRouter()


# ── Roles ─────────────────────────────────────────────────────────────────────
@router.get("", response_model=list[RoleResponse], summary="List all roles")
async def list_roles(
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> list[RoleResponse]:
    roles = await UserService(db).list_roles()
    return [RoleResponse.model_validate(r) for r in roles]


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED, summary="Create role")
async def create_role(
    payload: RoleCreate,
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> RoleResponse:
    role = await UserService(db).create_role(payload)
    return RoleResponse.model_validate(role)


@router.put("/{role_id}", response_model=RoleResponse, summary="Update role")
async def update_role(
    role_id: uuid.UUID,
    payload: RoleUpdate,
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> RoleResponse:
    role = await UserService(db).update_role(role_id, payload)
    return RoleResponse.model_validate(role)


@router.delete("/{role_id}", status_code=status.HTTP_200_OK, summary="Delete role")
async def delete_role(
    role_id: uuid.UUID,
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    await UserService(db).delete_role(role_id)


# ── Permissions ───────────────────────────────────────────────────────────────
@router.get("/permissions", response_model=list[PermissionResponse], summary="List all permissions")
async def list_permissions(
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> list[PermissionResponse]:
    perms = await UserService(db).list_permissions()
    return [PermissionResponse.model_validate(p) for p in perms]


@router.post(
    "/permissions",
    response_model=PermissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create permission",
)
async def create_permission(
    payload: PermissionCreate,
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> PermissionResponse:
    perm = await UserService(db).create_permission(payload)
    return PermissionResponse.model_validate(perm)


@router.post("/{role_id}/permissions/{permission_id}", status_code=status.HTTP_200_OK)
async def assign_permission(
    role_id: uuid.UUID,
    permission_id: uuid.UUID,
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    await UserService(db).assign_permission_to_role(role_id, permission_id)


@router.delete("/{role_id}/permissions/{permission_id}", status_code=status.HTTP_200_OK)
async def remove_permission(
    role_id: uuid.UUID,
    permission_id: uuid.UUID,
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    await UserService(db).remove_permission_from_role(role_id, permission_id)


# ── User-Role assignments ─────────────────────────────────────────────────────
@router.post("/assign", status_code=status.HTTP_200_OK, summary="Assign role to user")
async def assign_role(
    payload: AssignRoleRequest,
    current_user: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    await UserService(db).assign_role_to_user(payload, current_user.id)


@router.delete(
    "/assign/{user_id}/{role_id}",
    status_code=status.HTTP_200_OK,
    summary="Revoke role from user",
)
async def revoke_role(
    user_id: uuid.UUID,
    role_id: uuid.UUID,
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    await UserService(db).revoke_role_from_user(user_id, role_id)
