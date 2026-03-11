from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser
from app.core.rate_limit import limiter
from app.core.rbac import get_user_app_scopes
from app.core.security import revoke_refresh_token
from app.schemas.auth import (
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.user import UserMeResponse, UserResponse
from app.services.auth import AuthService

router = APIRouter()


@router.post("/login", response_model=TokenResponse, summary="Obtain access + refresh tokens")
@limiter.limit("5/minute")
async def login(
    request: Request,
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    return await AuthService(db).login(payload)


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


@router.get("/me", response_model=UserMeResponse, summary="Current authenticated user")
async def me(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> UserMeResponse:
    scopes = await get_user_app_scopes(db, str(current_user.id))
    role = "superadmin" if current_user.is_superadmin else ("admin" if scopes else "user")
    data = UserResponse.model_validate(current_user).model_dump()
    data["role"] = role
    data["app_admin_scopes"] = scopes if role == "admin" else []
    return UserMeResponse(**data)
