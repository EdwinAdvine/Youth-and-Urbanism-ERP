"""Finance Currencies API — dedicated CRUD for currency management."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.models.finance_ext import Currency

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class CurrencyCreate(BaseModel):
    code: str
    name: str
    symbol: str
    exchange_rate: Decimal = Decimal("1.0")
    is_base: bool = False


class CurrencyUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    symbol: str | None = None
    exchange_rate: Decimal | None = None
    is_base: bool | None = None


class CurrencyOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    symbol: str
    exchange_rate: Decimal
    is_base: bool
    last_updated: Any | None = None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/currencies/all", summary="List all currencies with exchange rates")
async def list_currencies(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(select(Currency).order_by(Currency.code.asc()))
    currencies = result.scalars().all()
    return {
        "total": len(currencies),
        "currencies": [CurrencyOut.model_validate(c).model_dump() for c in currencies],
    }


@router.get("/currencies/{currency_id}", summary="Get a single currency")
async def get_currency(
    currency_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    currency = await db.get(Currency, currency_id)
    if not currency:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Currency not found")
    return CurrencyOut.model_validate(currency).model_dump()


@router.post("/currencies", status_code=status.HTTP_201_CREATED, summary="Create a currency")
async def create_currency(
    payload: CurrencyCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("finance")),
) -> dict[str, Any]:
    # If setting as base, unset any existing base
    if payload.is_base:
        existing_base = await db.execute(select(Currency).where(Currency.is_base == True))  # noqa: E712
        for c in existing_base.scalars().all():
            c.is_base = False

    currency = Currency(
        code=payload.code.upper(),
        name=payload.name,
        symbol=payload.symbol,
        exchange_rate=payload.exchange_rate,
        is_base=payload.is_base,
        last_updated=datetime.now(timezone.utc),
    )
    db.add(currency)
    await db.commit()
    await db.refresh(currency)
    return CurrencyOut.model_validate(currency).model_dump()


@router.put("/currencies/{currency_id}", summary="Update a currency")
async def update_currency(
    currency_id: uuid.UUID,
    payload: CurrencyUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("finance")),
) -> dict[str, Any]:
    currency = await db.get(Currency, currency_id)
    if not currency:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Currency not found")

    if payload.is_base:
        existing_base = await db.execute(select(Currency).where(Currency.is_base == True))  # noqa: E712
        for c in existing_base.scalars().all():
            c.is_base = False

    for field, value in payload.model_dump(exclude_none=True).items():
        if field == "code" and value:
            value = value.upper()
        setattr(currency, field, value)

    currency.last_updated = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(currency)
    return CurrencyOut.model_validate(currency).model_dump()


@router.delete("/currencies/{currency_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a currency")
async def delete_currency(
    currency_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("finance")),
) -> Response:
    currency = await db.get(Currency, currency_id)
    if not currency:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Currency not found")
    if currency.is_base:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the base currency. Set another currency as base first.",
        )
    await db.delete(currency)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
