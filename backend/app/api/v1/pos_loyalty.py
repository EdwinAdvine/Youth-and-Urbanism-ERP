"""POS Loyalty — Gift Cards & Store Credit endpoints."""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.pos import (
    POSGiftCard,
    POSGiftCardTransaction,
    POSStoreCredit,
    POSStoreCreditTransaction,
)

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

# -- Gift Cards --

class GiftCardIssueIn(BaseModel):
    original_amount: Decimal
    customer_id: uuid.UUID | None = None
    expires_at: datetime | None = None


class GiftCardLoadIn(BaseModel):
    amount: Decimal


class GiftCardRedeemIn(BaseModel):
    amount: Decimal
    pos_transaction_id: uuid.UUID | None = None


class GiftCardOut(BaseModel):
    id: uuid.UUID
    card_number: str
    original_amount: Decimal
    current_balance: Decimal
    customer_id: uuid.UUID | None
    issued_by: uuid.UUID
    expires_at: Any | None
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class GiftCardTransactionOut(BaseModel):
    id: uuid.UUID
    gift_card_id: uuid.UUID
    transaction_id: uuid.UUID | None
    amount: Decimal
    balance_after: Decimal
    notes: str | None
    created_at: Any

    model_config = {"from_attributes": True}


# -- Store Credit --

class StoreCreditOut(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    balance: Decimal
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class StoreCreditAdjustIn(BaseModel):
    amount: Decimal  # positive to add, negative to deduct
    reason: str
    pos_transaction_id: uuid.UUID | None = None


class StoreCreditTransactionOut(BaseModel):
    id: uuid.UUID
    store_credit_id: uuid.UUID
    transaction_id: uuid.UUID | None
    amount: Decimal
    balance_after: Decimal
    reason: str
    created_at: Any

    model_config = {"from_attributes": True}


# ── Gift Card endpoints ──────────────────────────────────────────────────────

@router.post("/gift-cards", status_code=status.HTTP_201_CREATED, summary="Issue a new gift card")
async def issue_gift_card(
    payload: GiftCardIssueIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    if payload.original_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="original_amount must be greater than zero.",
        )

    card_number = f"GC-{secrets.token_hex(8).upper()}"

    card = POSGiftCard(
        card_number=card_number,
        original_amount=payload.original_amount,
        current_balance=payload.original_amount,
        customer_id=payload.customer_id,
        issued_by=current_user.id,
        expires_at=payload.expires_at,
    )
    db.add(card)
    await db.flush()

    # Initial load transaction
    txn = POSGiftCardTransaction(
        gift_card_id=card.id,
        amount=payload.original_amount,
        balance_after=payload.original_amount,
        notes="Initial load",
    )
    db.add(txn)
    await db.commit()
    await db.refresh(card)
    return GiftCardOut.model_validate(card).model_dump()


@router.get("/gift-cards", summary="List gift cards")
async def list_gift_cards(
    current_user: CurrentUser,
    db: DBSession,
    active_only: bool = Query(False, description="Return only active cards"),
    customer_id: uuid.UUID | None = Query(None, description="Filter by customer"),
) -> list[dict[str, Any]]:
    stmt = select(POSGiftCard)
    if active_only:
        stmt = stmt.where(POSGiftCard.is_active.is_(True))
    if customer_id is not None:
        stmt = stmt.where(POSGiftCard.customer_id == customer_id)
    stmt = stmt.order_by(POSGiftCard.created_at.desc())

    result = await db.execute(stmt)
    cards = result.scalars().all()
    return [GiftCardOut.model_validate(c).model_dump() for c in cards]


@router.get("/gift-cards/{card_number}", summary="Lookup gift card by card number")
async def get_gift_card(
    card_number: str,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(POSGiftCard).where(POSGiftCard.card_number == card_number)
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gift card not found")

    # Fetch recent transactions
    txn_result = await db.execute(
        select(POSGiftCardTransaction)
        .where(POSGiftCardTransaction.gift_card_id == card.id)
        .order_by(POSGiftCardTransaction.created_at.desc())
        .limit(20)
    )
    txns = txn_result.scalars().all()

    card_data = GiftCardOut.model_validate(card).model_dump()
    card_data["recent_transactions"] = [
        GiftCardTransactionOut.model_validate(t).model_dump() for t in txns
    ]
    return card_data


@router.post("/gift-cards/{card_id}/load", summary="Add balance to a gift card")
async def load_gift_card(
    card_id: uuid.UUID,
    payload: GiftCardLoadIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    card = await db.get(POSGiftCard, card_id)
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gift card not found")
    if not card.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gift card is deactivated")
    if payload.amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount must be greater than zero")

    card.current_balance += payload.amount
    new_balance = card.current_balance

    txn = POSGiftCardTransaction(
        gift_card_id=card.id,
        amount=payload.amount,
        balance_after=new_balance,
        notes="Balance load",
    )
    db.add(txn)
    await db.commit()
    await db.refresh(card)
    return GiftCardOut.model_validate(card).model_dump()


@router.post("/gift-cards/{card_id}/redeem", summary="Redeem balance from a gift card")
async def redeem_gift_card(
    card_id: uuid.UUID,
    payload: GiftCardRedeemIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    card = await db.get(POSGiftCard, card_id)
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gift card not found")
    if not card.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gift card is deactivated")
    if payload.amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount must be greater than zero")
    if card.current_balance < payload.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient balance. Available: {card.current_balance}",
        )
    if card.expires_at and card.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gift card has expired")

    card.current_balance -= payload.amount
    new_balance = card.current_balance

    txn = POSGiftCardTransaction(
        gift_card_id=card.id,
        transaction_id=payload.pos_transaction_id,
        amount=-payload.amount,
        balance_after=new_balance,
        notes="Redemption",
    )
    db.add(txn)
    await db.commit()
    await db.refresh(card)
    return GiftCardOut.model_validate(card).model_dump()


@router.put("/gift-cards/{card_id}/deactivate", summary="Deactivate a gift card")
async def deactivate_gift_card(
    card_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    card = await db.get(POSGiftCard, card_id)
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gift card not found")

    card.is_active = False
    await db.commit()
    await db.refresh(card)
    return GiftCardOut.model_validate(card).model_dump()


# ── Store Credit endpoints ───────────────────────────────────────────────────

@router.get("/store-credits/{customer_id}", summary="Get store credit balance for a customer")
async def get_store_credit(
    customer_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(POSStoreCredit).where(POSStoreCredit.customer_id == customer_id)
    )
    credit = result.scalar_one_or_none()

    if not credit:
        credit = POSStoreCredit(
            customer_id=customer_id,
            balance=Decimal("0"),
        )
        db.add(credit)
        await db.commit()
        await db.refresh(credit)

    return StoreCreditOut.model_validate(credit).model_dump()


@router.post("/store-credits/{customer_id}/adjust", summary="Adjust store credit balance")
async def adjust_store_credit(
    customer_id: uuid.UUID,
    payload: StoreCreditAdjustIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(POSStoreCredit).where(POSStoreCredit.customer_id == customer_id)
    )
    credit = result.scalar_one_or_none()

    if not credit:
        credit = POSStoreCredit(
            customer_id=customer_id,
            balance=Decimal("0"),
        )
        db.add(credit)
        await db.flush()

    new_balance = credit.balance + payload.amount
    if new_balance < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient store credit. Available: {credit.balance}",
        )

    credit.balance = new_balance

    txn = POSStoreCreditTransaction(
        store_credit_id=credit.id,
        transaction_id=payload.pos_transaction_id,
        amount=payload.amount,
        balance_after=new_balance,
        reason=payload.reason,
    )
    db.add(txn)
    await db.commit()
    await db.refresh(credit)
    return StoreCreditOut.model_validate(credit).model_dump()


@router.get("/store-credits/{customer_id}/transactions", summary="List store credit transactions")
async def list_store_credit_transactions(
    customer_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    # Find the store credit record
    result = await db.execute(
        select(POSStoreCredit).where(POSStoreCredit.customer_id == customer_id)
    )
    credit = result.scalar_one_or_none()
    if not credit:
        return []

    txn_result = await db.execute(
        select(POSStoreCreditTransaction)
        .where(POSStoreCreditTransaction.store_credit_id == credit.id)
        .order_by(POSStoreCreditTransaction.created_at.desc())
    )
    txns = txn_result.scalars().all()
    return [StoreCreditTransactionOut.model_validate(t).model_dump() for t in txns]
