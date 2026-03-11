"""System settings and user preferences endpoints."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel as PydanticBase
from sqlalchemy import select, delete

from app.core.deps import CurrentUser, DBSession, SuperAdminUser
from app.models.settings import SystemSettings, UserPreferences

router = APIRouter()

# ── Safe keys visible to all authenticated users ────────────────────────────
SAFE_KEYS = frozenset({"company_name", "currency", "date_format", "fiscal_year_start"})


# ── Pydantic schemas (inline) ───────────────────────────────────────────────
class SettingOut(PydanticBase):
    key: str
    value: str | None
    category: str

    model_config = {"from_attributes": True}


class SettingItem(PydanticBase):
    key: str
    value: str | None = None
    category: str = "general"


class SettingsBulkUpdate(PydanticBase):
    items: list[SettingItem]


class PreferencesOut(PydanticBase):
    theme: str = "light"
    language: str = "en"
    timezone: str = "UTC"
    notifications_enabled: bool = True
    email_notifications: bool = True

    model_config = {"from_attributes": True}


class PreferencesUpdate(PydanticBase):
    theme: str | None = None
    language: str | None = None
    timezone: str | None = None
    notifications_enabled: bool | None = None
    email_notifications: bool | None = None


# ── System Settings endpoints ────────────────────────────────────────────────
@router.get(
    "",
    response_model=list[SettingOut],
    summary="List system settings",
)
async def list_settings(
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """Return system settings.

    Super admins see all settings; regular users only see safe public keys.
    """
    stmt = select(SystemSettings)
    if not current_user.is_superadmin:
        stmt = stmt.where(SystemSettings.key.in_(SAFE_KEYS))
    stmt = stmt.order_by(SystemSettings.key)

    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [SettingOut.model_validate(r) for r in rows]


@router.put(
    "",
    response_model=list[SettingOut],
    summary="Bulk upsert system settings (Super Admin)",
)
async def bulk_upsert_settings(
    payload: SettingsBulkUpdate,
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    """Create or update system settings in bulk. Requires Super Admin."""
    upserted: list[SystemSettings] = []

    for item in payload.items:
        result = await db.execute(
            select(SystemSettings).where(SystemSettings.key == item.key)
        )
        existing = result.scalar_one_or_none()

        if existing is not None:
            existing.value = item.value
            existing.category = item.category
            upserted.append(existing)
        else:
            new_setting = SystemSettings(
                key=item.key,
                value=item.value,
                category=item.category,
            )
            db.add(new_setting)
            upserted.append(new_setting)

    await db.commit()
    for s in upserted:
        await db.refresh(s)

    return [SettingOut.model_validate(s) for s in upserted]


# ── User Preferences endpoints ──────────────────────────────────────────────
@router.get(
    "/preferences",
    response_model=PreferencesOut,
    summary="Get current user preferences",
)
async def get_preferences(
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """Return the authenticated user's preferences, or defaults if none saved."""
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()

    if prefs is None:
        return PreferencesOut()  # defaults

    return PreferencesOut.model_validate(prefs)


@router.put(
    "/preferences",
    response_model=PreferencesOut,
    summary="Update current user preferences",
)
async def update_preferences(
    payload: PreferencesUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """Update (or create) the authenticated user's preferences."""
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()

    update_data = payload.model_dump(exclude_unset=True)

    if prefs is None:
        prefs = UserPreferences(user_id=current_user.id, **update_data)
        db.add(prefs)
    else:
        for field, value in update_data.items():
            setattr(prefs, field, value)

    await db.commit()
    await db.refresh(prefs)

    return PreferencesOut.model_validate(prefs)
