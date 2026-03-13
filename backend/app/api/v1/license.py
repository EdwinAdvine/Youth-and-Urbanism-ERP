"""License / Subscription Tracking API — Super Admin only."""

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.core.deps import DBSession, SuperAdminUser
from app.models.license import License, LicenseType
from app.models.user import User

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class LicenseActivate(BaseModel):
    license_key: str = Field(..., min_length=8, max_length=255)
    license_type: LicenseType = LicenseType.trial
    max_users: int = Field(default=5, ge=1)
    features: list[str] = []
    expires_at: datetime | None = None
    notes: str | None = None


class LicenseUpdate(BaseModel):
    license_type: LicenseType | None = None
    max_users: int | None = Field(default=None, ge=1)
    features: list[str] | None = None
    expires_at: datetime | None = None
    is_active: bool | None = None
    notes: str | None = None


class LicenseOut(BaseModel):
    id: uuid.UUID
    license_key: str
    license_type: LicenseType
    max_users: int
    current_users: int
    features: list[str]
    issued_at: datetime
    expires_at: datetime | None
    is_active: bool
    notes: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class LicenseStatusOut(BaseModel):
    is_active: bool
    days_remaining: int | None
    current_users: int
    max_users: int
    features: list[str]
    license_type: LicenseType | None
    expires_at: datetime | None


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("", summary="Get current active license")
async def get_license(
    _: SuperAdminUser,
    db: DBSession,
) -> dict[str, Any] | None:
    result = await db.execute(
        select(License)
        .where(License.is_active == True)  # noqa: E712
        .order_by(License.created_at.desc())
        .limit(1)
    )
    lic = result.scalar_one_or_none()
    if lic is None:
        return None

    # Sync current_users count
    count_result = await db.execute(
        select(func.count()).select_from(User).where(User.is_active == True)  # noqa: E712
    )
    lic.current_users = count_result.scalar() or 0

    return LicenseOut.model_validate(lic).model_dump()


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create / activate a license")
async def activate_license(
    payload: LicenseActivate,
    _: SuperAdminUser,
    db: DBSession,
) -> dict[str, Any]:
    # Check duplicate key
    existing = await db.execute(
        select(License).where(License.license_key == payload.license_key)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="License key already registered",
        )

    # Deactivate existing active licenses
    active_result = await db.execute(
        select(License).where(License.is_active == True)  # noqa: E712
    )
    for old in active_result.scalars().all():
        old.is_active = False

    # Count current users
    count_result = await db.execute(
        select(func.count()).select_from(User).where(User.is_active == True)  # noqa: E712
    )
    current_users = count_result.scalar() or 0

    lic = License(
        license_key=payload.license_key,
        license_type=payload.license_type,
        max_users=payload.max_users,
        current_users=current_users,
        features=payload.features,
        expires_at=payload.expires_at,
        is_active=True,
        notes=payload.notes,
    )
    db.add(lic)
    await db.flush()
    await db.refresh(lic)
    return LicenseOut.model_validate(lic).model_dump()


@router.put("/{license_id}", summary="Update license details")
async def update_license(
    license_id: uuid.UUID,
    payload: LicenseUpdate,
    _: SuperAdminUser,
    db: DBSession,
) -> dict[str, Any]:
    lic = await db.get(License, license_id)
    if lic is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="License not found",
        )

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(lic, key, value)

    # Sync current_users count
    count_result = await db.execute(
        select(func.count()).select_from(User).where(User.is_active == True)  # noqa: E712
    )
    lic.current_users = count_result.scalar() or 0

    await db.flush()
    await db.refresh(lic)
    return LicenseOut.model_validate(lic).model_dump()


@router.get("/status", summary="License status check")
async def license_status(
    _: SuperAdminUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(License)
        .where(License.is_active == True)  # noqa: E712
        .order_by(License.created_at.desc())
        .limit(1)
    )
    lic = result.scalar_one_or_none()

    # Count current users
    count_result = await db.execute(
        select(func.count()).select_from(User).where(User.is_active == True)  # noqa: E712
    )
    current_users = count_result.scalar() or 0

    if lic is None:
        return LicenseStatusOut(
            is_active=False,
            days_remaining=None,
            current_users=current_users,
            max_users=0,
            features=[],
            license_type=None,
            expires_at=None,
        ).model_dump()

    # Calculate days remaining
    days_remaining: int | None = None
    if lic.expires_at:
        now = datetime.now(UTC)
        delta = lic.expires_at.replace(tzinfo=now.tzinfo) - now
        days_remaining = max(0, delta.days)

    return LicenseStatusOut(
        is_active=lic.is_active,
        days_remaining=days_remaining,
        current_users=current_users,
        max_users=lic.max_users,
        features=lic.features or [],
        license_type=lic.license_type,
        expires_at=lic.expires_at,
    ).model_dump()
