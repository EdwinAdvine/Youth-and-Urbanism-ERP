from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_stored_refresh_token,
    hash_password,
    store_refresh_token,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def login(self, payload: LoginRequest) -> TokenResponse:
        result = await self.db.execute(
            select(User).where(User.email == payload.email)
        )
        user = result.scalar_one_or_none()

        if user is None or not verify_password(payload.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled",
            )

        # Update last_login
        user.last_login = datetime.now(UTC)
        self.db.add(user)
        await self.db.flush()

        access_token = create_access_token(
            subject=str(user.id),
            email=user.email,
            is_superadmin=user.is_superadmin,
        )
        refresh_token = create_refresh_token(subject=str(user.id))
        await store_refresh_token(str(user.id), refresh_token)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def register(self, payload: RegisterRequest) -> User:
        result = await self.db.execute(
            select(User).where(User.email == payload.email)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        user = User(
            email=payload.email,
            full_name=payload.full_name,
            hashed_password=hash_password(payload.password),
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def refresh(self, refresh_token: str) -> TokenResponse:
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
        try:
            payload = decode_token(refresh_token)
            if payload.get("type") != "refresh":
                raise credentials_exception
            user_id: str = payload["sub"]
        except JWTError:
            raise credentials_exception

        stored = await get_stored_refresh_token(user_id)
        if stored != refresh_token:
            raise credentials_exception

        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None or not user.is_active:
            raise credentials_exception

        new_access = create_access_token(
            subject=str(user.id),
            email=user.email,
            is_superadmin=user.is_superadmin,
        )
        new_refresh = create_refresh_token(subject=str(user.id))
        await store_refresh_token(str(user.id), new_refresh)

        return TokenResponse(
            access_token=new_access,
            refresh_token=new_refresh,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
