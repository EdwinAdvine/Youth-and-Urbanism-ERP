"""Finance API — Fixed Asset Management & Depreciation."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.core.export import rows_to_csv
from app.models.finance import FixedAsset

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class FixedAssetCreate(BaseModel):
    name: str
    asset_code: str
    category: str  # equipment, furniture, vehicle, building, IT
    purchase_date: date
    purchase_cost: Decimal
    salvage_value: Decimal = Decimal("0")
    useful_life_months: int
    depreciation_method: str = "straight_line"  # straight_line, declining_balance
    location: str | None = None
    assigned_to: uuid.UUID | None = None
    account_id: uuid.UUID | None = None


class FixedAssetUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    salvage_value: Decimal | None = None
    useful_life_months: int | None = None
    depreciation_method: str | None = None
    location: str | None = None
    assigned_to: uuid.UUID | None = None
    account_id: uuid.UUID | None = None


class FixedAssetOut(BaseModel):
    id: uuid.UUID
    name: str
    asset_code: str
    category: str
    purchase_date: date
    purchase_cost: Decimal
    salvage_value: Decimal
    useful_life_months: int
    depreciation_method: str
    accumulated_depreciation: Decimal
    current_value: Decimal
    status: str
    location: str | None
    assigned_to: uuid.UUID | None
    account_id: uuid.UUID | None
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _calculate_depreciation(asset: FixedAsset) -> Decimal:
    """Calculate one period (monthly) of depreciation for the asset."""
    depreciable_base = asset.purchase_cost - asset.salvage_value
    if depreciable_base <= 0 or asset.useful_life_months <= 0:
        return Decimal("0")

    if asset.depreciation_method == "straight_line":
        # Equal monthly depreciation
        monthly = (depreciable_base / asset.useful_life_months).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        return monthly

    elif asset.depreciation_method == "declining_balance":
        # Double-declining balance (monthly rate)
        annual_rate = Decimal("2") / Decimal(str(asset.useful_life_months)) * Decimal("12")
        monthly_rate = annual_rate / Decimal("12")
        monthly = (asset.current_value * monthly_rate).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        # Don't depreciate below salvage value
        if asset.current_value - monthly < asset.salvage_value:
            monthly = asset.current_value - asset.salvage_value
        return max(monthly, Decimal("0"))

    return Decimal("0")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/fixed-assets", summary="List fixed assets")
async def list_fixed_assets(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    category: str | None = Query(None, description="Filter by category"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(FixedAsset)

    if status_filter:
        query = query.where(FixedAsset.status == status_filter)
    if category:
        query = query.where(FixedAsset.category == category)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(FixedAsset.purchase_date.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    assets = result.scalars().all()
    return {
        "total": total,
        "fixed_assets": [FixedAssetOut.model_validate(a) for a in assets],
    }


@router.post("/fixed-assets", status_code=status.HTTP_201_CREATED, summary="Create a fixed asset")
async def create_fixed_asset(
    payload: FixedAssetCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    if payload.depreciation_method not in ("straight_line", "declining_balance"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="depreciation_method must be straight_line or declining_balance",
        )

    # Check unique asset_code
    existing = await db.execute(
        select(FixedAsset).where(FixedAsset.asset_code == payload.asset_code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Asset code '{payload.asset_code}' already exists",
        )

    asset = FixedAsset(
        name=payload.name,
        asset_code=payload.asset_code,
        category=payload.category,
        purchase_date=payload.purchase_date,
        purchase_cost=payload.purchase_cost,
        salvage_value=payload.salvage_value,
        useful_life_months=payload.useful_life_months,
        depreciation_method=payload.depreciation_method,
        accumulated_depreciation=Decimal("0"),
        current_value=payload.purchase_cost,
        status="active",
        location=payload.location,
        assigned_to=payload.assigned_to,
        account_id=payload.account_id,
        owner_id=current_user.id,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return FixedAssetOut.model_validate(asset).model_dump()


@router.get("/fixed-assets/summary", summary="Fixed asset portfolio summary")
async def fixed_assets_summary(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Total values by status
    result = await db.execute(
        select(
            FixedAsset.status,
            func.count(FixedAsset.id).label("count"),
            func.coalesce(func.sum(FixedAsset.purchase_cost), 0).label("total_purchase_cost"),
            func.coalesce(func.sum(FixedAsset.current_value), 0).label("total_current_value"),
            func.coalesce(func.sum(FixedAsset.accumulated_depreciation), 0).label("total_accumulated_depreciation"),
        )
        .group_by(FixedAsset.status)
    )
    rows = result.all()

    by_status = []
    grand_purchase = Decimal("0")
    grand_current = Decimal("0")
    grand_depreciation = Decimal("0")
    grand_count = 0

    for row in rows:
        purchase = Decimal(str(row.total_purchase_cost))
        current = Decimal(str(row.total_current_value))
        depreciation = Decimal(str(row.total_accumulated_depreciation))
        grand_purchase += purchase
        grand_current += current
        grand_depreciation += depreciation
        grand_count += row.count
        by_status.append({
            "status": row.status,
            "count": row.count,
            "total_purchase_cost": str(purchase),
            "total_current_value": str(current),
            "total_accumulated_depreciation": str(depreciation),
        })

    # By category
    cat_result = await db.execute(
        select(
            FixedAsset.category,
            func.count(FixedAsset.id).label("count"),
            func.coalesce(func.sum(FixedAsset.current_value), 0).label("total_current_value"),
        )
        .where(FixedAsset.status == "active")
        .group_by(FixedAsset.category)
    )
    by_category = [
        {
            "category": row.category,
            "count": row.count,
            "total_current_value": str(Decimal(str(row.total_current_value))),
        }
        for row in cat_result.all()
    ]

    return {
        "total_assets": grand_count,
        "total_purchase_cost": str(grand_purchase),
        "total_current_value": str(grand_current),
        "total_accumulated_depreciation": str(grand_depreciation),
        "by_status": by_status,
        "by_category": by_category,
    }


@router.get("/fixed-assets/export", summary="Export fixed assets as CSV")
async def export_fixed_assets(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status"),
    category: str | None = Query(None),
):
    query = select(FixedAsset)

    if status_filter:
        query = query.where(FixedAsset.status == status_filter)
    if category:
        query = query.where(FixedAsset.category == category)

    result = await db.execute(query.order_by(FixedAsset.asset_code.asc()))
    assets = result.scalars().all()

    columns = [
        "id", "asset_code", "name", "category", "purchase_date",
        "purchase_cost", "salvage_value", "useful_life_months",
        "depreciation_method", "accumulated_depreciation", "current_value",
        "status", "location",
    ]
    rows = [
        {
            "id": str(a.id),
            "asset_code": a.asset_code,
            "name": a.name,
            "category": a.category,
            "purchase_date": str(a.purchase_date),
            "purchase_cost": str(a.purchase_cost),
            "salvage_value": str(a.salvage_value),
            "useful_life_months": str(a.useful_life_months),
            "depreciation_method": a.depreciation_method,
            "accumulated_depreciation": str(a.accumulated_depreciation),
            "current_value": str(a.current_value),
            "status": a.status,
            "location": a.location or "",
        }
        for a in assets
    ]
    return rows_to_csv(rows, columns, filename="fixed_assets_export.csv")


@router.get("/fixed-assets/{asset_id}", summary="Get fixed asset detail")
async def get_fixed_asset(
    asset_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    asset = await db.get(FixedAsset, asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fixed asset not found")
    return FixedAssetOut.model_validate(asset).model_dump()


@router.put("/fixed-assets/{asset_id}", summary="Update a fixed asset")
async def update_fixed_asset(
    asset_id: uuid.UUID,
    payload: FixedAssetUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    asset = await db.get(FixedAsset, asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fixed asset not found")
    if asset.status == "disposed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot update a disposed asset",
        )

    if payload.depreciation_method is not None and payload.depreciation_method not in ("straight_line", "declining_balance"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="depreciation_method must be straight_line or declining_balance",
        )

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(asset, field, value)

    await db.commit()
    await db.refresh(asset)
    return FixedAssetOut.model_validate(asset).model_dump()


@router.post("/fixed-assets/{asset_id}/depreciate", summary="Apply one period of depreciation")
async def depreciate_asset(
    asset_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    asset = await db.get(FixedAsset, asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fixed asset not found")
    if asset.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot depreciate asset with status '{asset.status}'",
        )

    depreciation_amount = _calculate_depreciation(asset)
    if depreciation_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Asset is fully depreciated or has no depreciable value",
        )

    previous_value = asset.current_value
    asset.accumulated_depreciation = asset.accumulated_depreciation + depreciation_amount
    asset.current_value = asset.purchase_cost - asset.accumulated_depreciation

    # Clamp to salvage value
    if asset.current_value <= asset.salvage_value:
        asset.current_value = asset.salvage_value
        asset.accumulated_depreciation = asset.purchase_cost - asset.salvage_value
        asset.status = "fully_depreciated"

    await db.commit()
    await db.refresh(asset)

    await event_bus.publish("asset.depreciated", {
        "asset_id": str(asset.id),
        "asset_code": asset.asset_code,
        "depreciation_amount": str(depreciation_amount),
        "previous_value": str(previous_value),
        "current_value": str(asset.current_value),
        "status": asset.status,
    })

    return {
        "asset": FixedAssetOut.model_validate(asset).model_dump(),
        "depreciation_applied": str(depreciation_amount),
        "previous_value": str(previous_value),
        "new_value": str(asset.current_value),
    }


@router.post("/fixed-assets/{asset_id}/dispose", summary="Mark a fixed asset as disposed")
async def dispose_asset(
    asset_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    asset = await db.get(FixedAsset, asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fixed asset not found")
    if asset.status == "disposed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Asset is already disposed",
        )

    asset.status = "disposed"
    await db.commit()
    await db.refresh(asset)

    await event_bus.publish("asset.disposed", {
        "asset_id": str(asset.id),
        "asset_code": asset.asset_code,
        "name": asset.name,
        "current_value": str(asset.current_value),
    })

    return FixedAssetOut.model_validate(asset).model_dump()
