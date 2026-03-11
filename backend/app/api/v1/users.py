from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import SuperAdminUser
from app.core.rbac import get_user_app_scopes
from app.schemas.user import UserCreate, UserMeResponse, UserResponse, UserUpdate
from app.services.user import UserService

router = APIRouter()


async def _enrich_user(db: AsyncSession, user: object) -> UserMeResponse:
    """Add computed role and app_admin_scopes to a UserResponse."""
    base = UserResponse.model_validate(user)
    scopes = await get_user_app_scopes(db, str(base.id))
    role = "superadmin" if base.is_superadmin else ("admin" if scopes else "user")
    data = base.model_dump()
    data["role"] = role
    data["app_admin_scopes"] = scopes if role == "admin" else []
    return UserMeResponse(**data)


@router.get("", response_model=list[UserMeResponse], summary="List all users (Super Admin)")
async def list_users(
    _: SuperAdminUser,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> list[UserMeResponse]:
    users = await UserService(db).list_users(skip=skip, limit=limit)
    return [await _enrich_user(db, u) for u in users]


@router.post("", response_model=UserMeResponse, status_code=status.HTTP_201_CREATED, summary="Create user (Super Admin)")
async def create_user(
    payload: UserCreate,
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> UserMeResponse:
    user = await UserService(db).create_user(payload)
    return await _enrich_user(db, user)


@router.get("/{user_id}", response_model=UserMeResponse, summary="Get user by ID (Super Admin)")
async def get_user(
    user_id: uuid.UUID,
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> UserMeResponse:
    user = await UserService(db).get_user(user_id)
    return await _enrich_user(db, user)


@router.put("/{user_id}", response_model=UserMeResponse, summary="Update user (Super Admin)")
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> UserMeResponse:
    user = await UserService(db).update_user(user_id, payload)
    return await _enrich_user(db, user)


@router.delete("/{user_id}", status_code=status.HTTP_200_OK, summary="Delete user (Super Admin)")
async def delete_user(
    user_id: uuid.UUID,
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    await UserService(db).delete_user(user_id)
