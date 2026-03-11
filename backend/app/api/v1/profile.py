"""User profile and password management endpoints."""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel as PydanticBase, Field
from sqlalchemy import select, update

from app.core.deps import CurrentUser, DBSession
from app.core.rbac import get_user_app_scopes
from app.core.security import verify_password, hash_password
from app.models.user import User
from app.models.activity import ActivityFeedEntry
from app.models.settings import UserPreferences

router = APIRouter()


# ── Pydantic schemas (inline) ───────────────────────────────────────────────
class PreferencesOut(PydanticBase):
    theme: str = "light"
    language: str = "en"
    timezone: str = "UTC"
    notifications_enabled: bool = True
    email_notifications: bool = True

    model_config = {"from_attributes": True}


class ProfileOut(PydanticBase):
    id: UUID
    email: str
    full_name: str
    avatar_url: str | None = None
    is_active: bool
    is_superadmin: bool
    role: str = "user"  # "superadmin" | "admin" | "user"
    app_admin_scopes: list[str] = []
    created_at: datetime
    last_login: datetime | None = None
    preferences: PreferencesOut | None = None

    model_config = {"from_attributes": True}


class ProfileUpdate(PydanticBase):
    full_name: str | None = None
    avatar_url: str | None = None


class PasswordChange(PydanticBase):
    current_password: str
    new_password: str = Field(..., min_length=8)


class ActivityOut(PydanticBase):
    id: UUID
    activity_type: str
    message: str
    module: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Profile endpoints ───────────────────────────────────────────────────────
@router.get(
    "/me",
    response_model=ProfileOut,
    summary="Get current user profile",
)
async def get_profile(
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """Return the authenticated user's profile including preferences."""
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()

    scopes = await get_user_app_scopes(db, str(current_user.id))
    role = "superadmin" if current_user.is_superadmin else ("admin" if scopes else "user")

    profile_data = {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "avatar_url": current_user.avatar_url,
        "is_active": current_user.is_active,
        "is_superadmin": current_user.is_superadmin,
        "role": role,
        "app_admin_scopes": scopes if role == "admin" else [],
        "created_at": current_user.created_at,
        "last_login": current_user.last_login,
        "preferences": PreferencesOut.model_validate(prefs) if prefs else None,
    }

    return ProfileOut(**profile_data)


@router.put(
    "/me",
    response_model=ProfileOut,
    summary="Update current user profile",
)
async def update_profile(
    payload: ProfileUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """Update the authenticated user's full_name and/or avatar_url."""
    update_data = payload.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update",
        )

    for field, value in update_data.items():
        setattr(current_user, field, value)

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    # Fetch preferences for the response
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()

    scopes = await get_user_app_scopes(db, str(current_user.id))
    role = "superadmin" if current_user.is_superadmin else ("admin" if scopes else "user")

    profile_data = {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "avatar_url": current_user.avatar_url,
        "is_active": current_user.is_active,
        "is_superadmin": current_user.is_superadmin,
        "role": role,
        "app_admin_scopes": scopes if role == "admin" else [],
        "created_at": current_user.created_at,
        "last_login": current_user.last_login,
        "preferences": PreferencesOut.model_validate(prefs) if prefs else None,
    }

    return ProfileOut(**profile_data)


@router.put(
    "/me/password",
    status_code=status.HTTP_200_OK,
    summary="Change current user password",
)
async def change_password(
    payload: PasswordChange,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, str]:
    """Change the authenticated user's password after verifying the current one."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.hashed_password = hash_password(payload.new_password)
    db.add(current_user)
    await db.commit()

    return {"detail": "Password updated successfully"}


@router.get(
    "/me/activity",
    response_model=list[ActivityOut],
    summary="Get current user recent activity",
)
async def get_activity(
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """Return the 20 most recent activity entries for the authenticated user."""
    result = await db.execute(
        select(ActivityFeedEntry)
        .where(ActivityFeedEntry.user_id == current_user.id)
        .order_by(ActivityFeedEntry.created_at.desc())
        .limit(20)
    )
    entries = result.scalars().all()

    return [ActivityOut.model_validate(e) for e in entries]
