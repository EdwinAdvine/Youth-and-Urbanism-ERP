"""License enforcement as FastAPI dependencies."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Callable

from fastapi import Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.license import License
from app.models.user import User


async def check_license(db: AsyncSession = Depends(get_db)) -> License:
    """
    FastAPI dependency that verifies an active, non-expired license exists
    and user count is within limits.

    Raises HTTPException 403 when:
    - No active license exists
    - License has expired
    - Current active user count exceeds max_users
    """
    result = await db.execute(
        select(License)
        .where(License.is_active == True)  # noqa: E712
        .order_by(License.created_at.desc())
        .limit(1)
    )
    lic = result.scalar_one_or_none()

    if lic is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="License expired or inactive",
        )

    # Check expiration
    if lic.expires_at:
        now = datetime.now(UTC)
        if lic.expires_at.replace(tzinfo=now.tzinfo) < now:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="License expired or inactive",
            )

    # Check user count
    count_result = await db.execute(
        select(func.count()).select_from(User).where(User.is_active == True)  # noqa: E712
    )
    current_users = count_result.scalar() or 0
    if current_users > lic.max_users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User limit exceeded",
        )

    return lic


def check_feature(feature: str) -> Callable:
    """
    Factory that returns a FastAPI dependency checking whether a specific
    feature/module slug is enabled in the active license.

    Usage:
        @router.get("/crm/contacts", dependencies=[Depends(check_feature("crm"))])
        async def list_contacts(...): ...
    """

    async def _check(db: AsyncSession = Depends(get_db)) -> None:
        result = await db.execute(
            select(License)
            .where(License.is_active == True)  # noqa: E712
            .order_by(License.created_at.desc())
            .limit(1)
        )
        lic = result.scalar_one_or_none()

        if lic is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="License expired or inactive",
            )

        # Check expiration
        if lic.expires_at:
            now = datetime.now(UTC)
            if lic.expires_at.replace(tzinfo=now.tzinfo) < now:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="License expired or inactive",
                )

        # Check if feature is in the enabled list
        enabled_features: list[str] = lic.features or []
        if feature not in enabled_features:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Feature '{feature}' is not enabled in your license",
            )

    return _check
