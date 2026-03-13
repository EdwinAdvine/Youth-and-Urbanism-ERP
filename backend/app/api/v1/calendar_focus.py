"""Calendar Focus Time management API."""

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.calendar import FocusTimeBlock

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────


class FocusTimeBlockCreate(BaseModel):
    label: str = Field("Focus Time", max_length=200)
    days_of_week: list[int] = Field(
        default=[1, 2, 3, 4, 5],
        description="Array of day numbers (0=Sun .. 6=Sat)",
    )
    start_hour: int = Field(9, ge=0, le=23)
    start_minute: int = Field(0, ge=0, le=59)
    end_hour: int = Field(12, ge=0, le=23)
    end_minute: int = Field(0, ge=0, le=59)
    auto_decline: bool = False
    is_active: bool = True


class FocusTimeBlockUpdate(BaseModel):
    label: str | None = Field(None, max_length=200)
    days_of_week: list[int] | None = None
    start_hour: int | None = Field(None, ge=0, le=23)
    start_minute: int | None = Field(None, ge=0, le=59)
    end_hour: int | None = Field(None, ge=0, le=23)
    end_minute: int | None = Field(None, ge=0, le=59)
    auto_decline: bool | None = None
    is_active: bool | None = None


class FocusTimeBlockOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    label: str = Field(validation_alias="name")
    days_of_week: list[int]
    start_hour: int
    start_minute: int
    end_hour: int
    end_minute: int
    auto_decline: bool
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True, "populate_by_name": True}


# ── Helpers ──────────────────────────────────────────────────────────────────


def _validate_time_range(
    start_hour: int, start_minute: int, end_hour: int, end_minute: int
) -> None:
    """Raise 422 if end time is not after start time."""
    if (end_hour, end_minute) <= (start_hour, start_minute):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end time must be after start time",
        )


def _validate_days(days: list[int]) -> None:
    """Raise 422 if any day value is outside 0-6."""
    if not days:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="days_of_week must contain at least one day",
        )
    if any(d < 0 or d > 6 for d in days):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="days_of_week values must be between 0 (Sun) and 6 (Sat)",
        )


async def _get_block_or_404(
    block_id: uuid.UUID, user_id: uuid.UUID, db: DBSession
) -> FocusTimeBlock:
    """Fetch a focus-time block owned by the current user, or raise 404."""
    result = await db.execute(
        select(FocusTimeBlock).where(
            FocusTimeBlock.id == block_id,
            FocusTimeBlock.user_id == user_id,
        )
    )
    block = result.scalar_one_or_none()
    if not block:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Focus time block not found",
        )
    return block


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get(
    "/focus-time",
    response_model=list[FocusTimeBlockOut],
    summary="List focus time blocks",
)
async def list_focus_time_blocks(
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """Return all focus-time blocks belonging to the authenticated user."""
    result = await db.execute(
        select(FocusTimeBlock)
        .where(FocusTimeBlock.user_id == current_user.id)
        .order_by(FocusTimeBlock.start_hour, FocusTimeBlock.start_minute)
    )
    return result.scalars().all()


@router.post(
    "/focus-time",
    response_model=FocusTimeBlockOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a focus time block",
)
async def create_focus_time_block(
    payload: FocusTimeBlockCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """Create a new focus-time block for the authenticated user."""
    _validate_days(payload.days_of_week)
    _validate_time_range(
        payload.start_hour, payload.start_minute,
        payload.end_hour, payload.end_minute,
    )

    block = FocusTimeBlock(
        user_id=current_user.id,
        name=payload.label,
        days_of_week=payload.days_of_week,
        start_hour=payload.start_hour,
        start_minute=payload.start_minute,
        end_hour=payload.end_hour,
        end_minute=payload.end_minute,
        auto_decline=payload.auto_decline,
        is_active=payload.is_active,
    )
    db.add(block)
    await db.commit()
    await db.refresh(block)
    return block


@router.put(
    "/focus-time/{block_id}",
    response_model=FocusTimeBlockOut,
    summary="Update a focus time block",
)
async def update_focus_time_block(
    block_id: uuid.UUID,
    payload: FocusTimeBlockUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """Partially update a focus-time block owned by the authenticated user."""
    block = await _get_block_or_404(block_id, current_user.id, db)

    update_data = payload.model_dump(exclude_unset=True)

    # Map 'label' to the model's 'name' column
    if "label" in update_data:
        update_data["name"] = update_data.pop("label")

    if "days_of_week" in update_data:
        _validate_days(update_data["days_of_week"])

    # Validate time range using the effective values after partial update
    effective_start_hour = update_data.get("start_hour", block.start_hour)
    effective_start_minute = update_data.get("start_minute", block.start_minute)
    effective_end_hour = update_data.get("end_hour", block.end_hour)
    effective_end_minute = update_data.get("end_minute", block.end_minute)
    _validate_time_range(
        effective_start_hour, effective_start_minute,
        effective_end_hour, effective_end_minute,
    )

    for field, value in update_data.items():
        setattr(block, field, value)

    await db.commit()
    await db.refresh(block)
    return block


@router.delete(
    "/focus-time/{block_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a focus time block",
)
async def delete_focus_time_block(
    block_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> None:
    """Delete a focus-time block owned by the authenticated user."""
    block = await _get_block_or_404(block_id, current_user.id, db)
    await db.delete(block)
    await db.commit()


@router.get(
    "/focus-time/active",
    response_model=list[FocusTimeBlockOut],
    summary="Get currently active focus time blocks",
)
async def get_active_focus_blocks(
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """Return focus-time blocks that are active right now.

    Checks the current server time's day-of-week and hour/minute against
    stored blocks. Used by the auto-decline logic to decide whether to
    reject incoming meeting invites.
    """
    now = datetime.utcnow()
    # Python weekday(): Mon=0 .. Sun=6  ->  model uses 0=Sun .. 6=Sat
    py_weekday = now.weekday()  # Mon=0
    model_day = (py_weekday + 1) % 7  # shift so Sun=0

    current_minutes = now.hour * 60 + now.minute

    # Fetch all active blocks for the user
    result = await db.execute(
        select(FocusTimeBlock).where(
            FocusTimeBlock.user_id == current_user.id,
            FocusTimeBlock.is_active.is_(True),
        )
    )
    blocks = result.scalars().all()

    active_now: list[FocusTimeBlock] = []
    for block in blocks:
        if model_day not in (block.days_of_week or []):
            continue
        block_start = block.start_hour * 60 + block.start_minute
        block_end = block.end_hour * 60 + block.end_minute
        if block_start <= current_minutes < block_end:
            active_now.append(block)

    return active_now
