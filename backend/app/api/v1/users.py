
import uuid

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_audit
from app.core.database import get_db
from app.core.deps import SuperAdminUser
from app.core.rate_limit import limiter
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
    data["app_admin_scopes"] = scopes if role in ("admin", "superadmin") else []
    data.setdefault("app_access", [])
    data.setdefault("permissions", [])
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
@limiter.limit("10/minute")
async def create_user(
    request: Request,
    payload: UserCreate,
    current_user: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> UserMeResponse:
    user = await UserService(db).create_user(payload)
    await log_audit(db, current_user, "user.created",
                    resource_type="user", resource_id=str(user.id),
                    metadata={"email": user.email, "full_name": user.full_name},
                    request=request)
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
    request: Request,
    user_id: uuid.UUID,
    payload: UserUpdate,
    current_user: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> UserMeResponse:
    user = await UserService(db).update_user(user_id, payload)
    await log_audit(db, current_user, "user.updated",
                    resource_type="user", resource_id=str(user_id),
                    metadata={"changes": payload.model_dump(exclude_unset=True, exclude={"password"})},
                    request=request)
    return await _enrich_user(db, user)


@router.delete("/{user_id}", status_code=status.HTTP_200_OK, summary="Delete user (Super Admin)")
async def delete_user(
    request: Request,
    user_id: uuid.UUID,
    current_user: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    await UserService(db).delete_user(user_id)
    await log_audit(db, current_user, "user.deleted",
                    resource_type="user", resource_id=str(user_id),
                    request=request)
