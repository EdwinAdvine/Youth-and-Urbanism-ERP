"""E-Commerce Loyalty & Rewards API — points, tiers, referrals, leaderboard."""
from __future__ import annotations

import random
import string
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession
from app.models.ecommerce import CustomerAccount
from app.models.ecommerce_loyalty import (
    CustomerLoyaltyAccount,
    EcomLoyaltyProgram as LoyaltyProgram,
    EcomLoyaltyTier as LoyaltyTier,
    EcomLoyaltyTransaction as LoyaltyTransaction,
    ReferralCode,
)

router = APIRouter(tags=["E-Commerce Loyalty"])


def _generate_referral_code() -> str:
    """Generate an 8-character uppercase alphanumeric referral code."""
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


# ── Loyalty Account ───────────────────────────────────────────────────────────

@router.get("/loyalty/account")
async def get_loyalty_account(
    customer_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Get a customer's loyalty account (points, tier, lifetime_points)."""
    account_result = await db.execute(
        select(CustomerLoyaltyAccount).where(CustomerLoyaltyAccount.customer_id == customer_id)
    )
    account = account_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Loyalty account not found")

    tier_data = None
    if account.tier:
        tier_data = {
            "id": str(account.tier.id),
            "name": account.tier.name,
            "discount_pct": float(account.tier.discount_pct),
            "free_shipping": account.tier.free_shipping,
            "badge_color": account.tier.badge_color,
        }

    return {
        "id": str(account.id),
        "customer_id": str(account.customer_id),
        "points_balance": account.points_balance,
        "lifetime_points": account.lifetime_points,
        "tier": tier_data,
    }


# ── Loyalty Tiers ─────────────────────────────────────────────────────────────

@router.get("/loyalty/tiers")
async def list_loyalty_tiers(
    store_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """List loyalty tiers for a store."""
    result = await db.execute(
        select(LoyaltyTier)
        .where(LoyaltyTier.store_id == store_id)
        .order_by(LoyaltyTier.sort_order)
    )
    tiers = result.scalars().all()
    return [
        {
            "id": str(t.id),
            "name": t.name,
            "min_lifetime_points": t.min_lifetime_points,
            "discount_pct": float(t.discount_pct),
            "free_shipping": t.free_shipping,
            "badge_color": t.badge_color,
            "sort_order": t.sort_order,
        }
        for t in tiers
    ]


# ── Loyalty Transactions ──────────────────────────────────────────────────────

@router.get("/loyalty/transactions")
async def list_loyalty_transactions(
    customer_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
    skip: int = 0,
    limit: int = 50,
):
    """Customer loyalty transaction history (paginated)."""
    account_result = await db.execute(
        select(CustomerLoyaltyAccount).where(CustomerLoyaltyAccount.customer_id == customer_id)
    )
    account = account_result.scalar_one_or_none()
    if not account:
        return []

    result = await db.execute(
        select(LoyaltyTransaction)
        .where(LoyaltyTransaction.account_id == account.id)
        .order_by(LoyaltyTransaction.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    transactions = result.scalars().all()
    return [
        {
            "id": str(tx.id),
            "transaction_type": tx.transaction_type,
            "points": tx.points,
            "reference_id": tx.reference_id,
            "note": tx.note,
            "created_at": tx.created_at.isoformat(),
        }
        for tx in transactions
    ]


# ── Redeem Points ─────────────────────────────────────────────────────────────

@router.post("/loyalty/redeem")
async def redeem_points(
    data: dict,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Redeem loyalty points against an order.

    Body: {customer_id: str, points: int, order_id: str}
    Returns: {discount_amount: float, points_used: int}
    """
    customer_id = uuid.UUID(data["customer_id"])
    points_to_redeem: int = data["points"]
    order_id: str = data.get("order_id", "")

    account_result = await db.execute(
        select(CustomerLoyaltyAccount).where(CustomerLoyaltyAccount.customer_id == customer_id)
    )
    account = account_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Loyalty account not found")

    if points_to_redeem <= 0:
        raise HTTPException(status_code=400, detail="Points must be positive")
    if account.points_balance < points_to_redeem:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient points. Balance: {account.points_balance}, requested: {points_to_redeem}",
        )

    # Look up currency_per_point from program config
    program_result = await db.execute(select(LoyaltyProgram).limit(1))
    program = program_result.scalar_one_or_none()
    currency_per_point = float(program.currency_per_point) if program else 0.01

    discount_amount = round(points_to_redeem * currency_per_point, 2)

    account.points_balance -= points_to_redeem
    tx = LoyaltyTransaction(
        account_id=account.id,
        transaction_type="spent",
        points=-points_to_redeem,
        reference_id=order_id or None,
        note=f"Redeemed for discount on order {order_id}" if order_id else "Points redeemed",
    )
    db.add(tx)
    await db.commit()

    return {"discount_amount": discount_amount, "points_used": points_to_redeem}


# ── Referral Code ─────────────────────────────────────────────────────────────

@router.get("/loyalty/referral-code")
async def get_referral_code(
    customer_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Get or auto-create a referral code for a customer."""
    ref_result = await db.execute(
        select(ReferralCode).where(ReferralCode.customer_id == customer_id)
    )
    ref = ref_result.scalar_one_or_none()

    if not ref:
        # Auto-create a unique referral code
        while True:
            candidate = _generate_referral_code()
            existing = await db.execute(
                select(ReferralCode).where(ReferralCode.code == candidate)
            )
            if not existing.scalar_one_or_none():
                break
        ref = ReferralCode(
            customer_id=customer_id,
            code=candidate,
            used_count=0,
            total_points_earned=0,
        )
        db.add(ref)
        await db.commit()
        await db.refresh(ref)

    return {
        "id": str(ref.id),
        "customer_id": str(ref.customer_id),
        "code": ref.code,
        "used_count": ref.used_count,
        "total_points_earned": ref.total_points_earned,
        "created_at": ref.created_at.isoformat() if ref.created_at else None,
    }


# ── Program Config ────────────────────────────────────────────────────────────

@router.get("/loyalty/program")
async def get_loyalty_program(
    store_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Admin: get loyalty program configuration for a store."""
    result = await db.execute(
        select(LoyaltyProgram).where(LoyaltyProgram.store_id == store_id)
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(status_code=404, detail="No loyalty program found for this store")

    return {
        "id": str(program.id),
        "store_id": str(program.store_id),
        "name": program.name,
        "points_per_unit_spent": program.points_per_unit_spent,
        "currency_per_point": float(program.currency_per_point),
        "is_active": program.is_active,
        "referral_bonus_points": program.referral_bonus_points,
        "referral_referee_points": program.referral_referee_points,
        "points_expiry_days": program.points_expiry_days,
        "created_at": program.created_at.isoformat() if program.created_at else None,
    }


@router.put("/loyalty/program")
async def update_loyalty_program(
    store_id: uuid.UUID,
    data: dict,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Admin: update loyalty program configuration."""
    result = await db.execute(
        select(LoyaltyProgram).where(LoyaltyProgram.store_id == store_id)
    )
    program = result.scalar_one_or_none()

    if not program:
        program = LoyaltyProgram(store_id=store_id)
        db.add(program)

    for field in ["name", "points_per_unit_spent", "is_active", "referral_bonus_points",
                  "referral_referee_points", "points_expiry_days"]:
        if field in data:
            setattr(program, field, data[field])
    if "currency_per_point" in data:
        program.currency_per_point = Decimal(str(data["currency_per_point"]))

    await db.commit()
    await db.refresh(program)
    return {"id": str(program.id), "name": program.name, "is_active": program.is_active}


# ── Leaderboard ───────────────────────────────────────────────────────────────

@router.get("/loyalty/leaderboard")
async def get_loyalty_leaderboard(
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Top 20 customers by points_balance."""
    result = await db.execute(
        select(CustomerLoyaltyAccount)
        .order_by(desc(CustomerLoyaltyAccount.points_balance))
        .limit(20)
    )
    accounts = result.scalars().all()
    return [
        {
            "rank": idx + 1,
            "customer_id": str(a.customer_id),
            "customer_name": (
                f"{a.customer.first_name or ''} {a.customer.last_name or ''}".strip()
                if a.customer else None
            ),
            "customer_email": a.customer.email if a.customer else None,
            "points_balance": a.points_balance,
            "lifetime_points": a.lifetime_points,
            "tier": a.tier.name if a.tier else None,
        }
        for idx, a in enumerate(accounts)
    ]


# ── Manual Point Adjustment ───────────────────────────────────────────────────

@router.post("/loyalty/adjust")
async def adjust_loyalty_points(
    data: dict,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Admin: manually adjust loyalty points for a customer.

    Body: {customer_id: str, points: int, note: str}
    Positive points = add, negative = deduct.
    """
    customer_id = uuid.UUID(data["customer_id"])
    points: int = data["points"]
    note: str = data.get("note", "Manual adjustment")

    account_result = await db.execute(
        select(CustomerLoyaltyAccount).where(CustomerLoyaltyAccount.customer_id == customer_id)
    )
    account = account_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Loyalty account not found for this customer")

    account.points_balance += points
    if points > 0:
        account.lifetime_points += points

    tx = LoyaltyTransaction(
        account_id=account.id,
        transaction_type="adjustment",
        points=points,
        note=note,
        reference_id=str(current_user.id),
    )
    db.add(tx)
    await db.commit()

    return {
        "customer_id": str(customer_id),
        "points_adjusted": points,
        "new_balance": account.points_balance,
        "note": note,
    }
