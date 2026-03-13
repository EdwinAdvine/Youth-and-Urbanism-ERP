from typing import Union

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, SuperAdminUser
from app.core.rate_limit import limiter
from app.core.rbac import get_user_app_scopes, get_user_permissions
from app.core.security import revoke_refresh_token
from app.services.user import UserService
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    MFATokenResponse,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.user import UserMeResponse, UserResponse
from app.services.auth import AuthService

router = APIRouter()


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post(
    "/login",
    response_model=Union[TokenResponse, MFATokenResponse],
    summary="Obtain access + refresh tokens",
)
@limiter.limit("5/minute")
async def login(
    request: Request,
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse | MFATokenResponse:
    return await AuthService(db).login(
        payload,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )


@router.post("/register", response_model=UserResponse, status_code=201, summary="Self-registration")
@limiter.limit("3/minute")
async def register(
    request: Request,
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    user = await AuthService(db).register(payload)
    return UserResponse.model_validate(user)


@router.post("/refresh", response_model=TokenResponse, summary="Exchange refresh token")
@limiter.limit("10/minute")
async def refresh(
    request: Request,
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    return await AuthService(db).refresh(payload.refresh_token)


@router.post("/logout", response_model=MessageResponse, summary="Revoke refresh token")
async def logout(current_user: CurrentUser) -> MessageResponse:
    await revoke_refresh_token(str(current_user.id))
    return MessageResponse(message="Logged out successfully")


@router.post("/change-password", response_model=MessageResponse, summary="Change password")
@limiter.limit("3/minute")
async def change_password(
    request: Request,
    payload: ChangePasswordRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await AuthService(db).change_password(current_user, payload)
    return MessageResponse(message="Password changed successfully")


@router.post(
    "/admin/users/{user_id}/unlock",
    response_model=MessageResponse,
    summary="Unlock a locked user account (Super Admin)",
)
async def unlock_account(
    user_id: str,
    admin: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    import uuid  # noqa: PLC0415
    await AuthService(db).unlock_account(uuid.UUID(user_id))
    return MessageResponse(message="Account unlocked successfully")


@router.get("/me", response_model=UserMeResponse, summary="Current authenticated user")
async def me(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> UserMeResponse:
    scopes = await get_user_app_scopes(db, str(current_user.id))
    role = "superadmin" if current_user.is_superadmin else ("admin" if scopes else "user")
    perm_names = await get_user_permissions(db, str(current_user.id))
    app_access = await UserService(db).get_accessible_apps(current_user.id)

    data = UserResponse.model_validate(current_user).model_dump()
    data["role"] = role
    data["app_admin_scopes"] = scopes if role in ("admin", "superadmin") else []
    data["app_access"] = app_access
    data["permissions"] = sorted(perm_names)
    return UserMeResponse(**data)
