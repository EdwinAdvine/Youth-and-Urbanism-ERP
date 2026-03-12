"""Loyalty Program API — Programs, Tiers, Members, Points, Rewards."""
from __future__ import annotations

import secrets
import uuid
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.models.crm import Contact
from app.models.loyalty import (
    LoyaltyMember,
    LoyaltyProgram,
    LoyaltyReward,
    LoyaltyTier,
    LoyaltyTransaction,
)

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

# -- Programs --

class ProgramCreateIn(BaseModel):
    name: str
    description: str | None = None
    points_per_unit_currency: Decimal = Decimal("1")
    is_active: bool = True


class ProgramUpdateIn(BaseModel):
    name: str | None = None
    description: str | None = None
    points_per_unit_currency: Decimal | None = None
    is_active: bool | None = None


class ProgramOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    points_per_unit_currency: Decimal
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Tiers --

class TierCreateIn(BaseModel):
    name: str
    min_points: int = 0
    discount_percentage: Decimal = Decimal("0")
    points_multiplier: Decimal = Decimal("1")
    sort_order: int = 0


class TierUpdateIn(BaseModel):
    name: str | None = None
    min_points: int | None = None
    discount_percentage: Decimal | None = None
    points_multiplier: Decimal | None = None
    sort_order: int | None = None


class TierOut(BaseModel):
    id: uuid.UUID
    program_id: uuid.UUID
    name: str
    min_points: int
    discount_percentage: Decimal
    points_multiplier: Decimal
    sort_order: int

    model_config = {"from_attributes": True}


# -- Members --

class MemberEnrollIn(BaseModel):
    program_id: uuid.UUID
    customer_id: uuid.UUID


class MemberOut(BaseModel):
    id: uuid.UUID
    program_id: uuid.UUID
    customer_id: uuid.UUID
    points_balance: int
    lifetime_points: int
    tier_id: uuid.UUID | None
    referral_code: str
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Transactions --

class TransactionOut(BaseModel):
    id: uuid.UUID
    member_id: uuid.UUID
    pos_transaction_id: uuid.UUID | None
    points_change: int
    reason: str
    balance_after: int
    created_at: Any

    model_config = {"from_attributes": True}


# -- Points --

class EarnPointsIn(BaseModel):
    points: int
    reason: str = "purchase"
    pos_transaction_id: uuid.UUID | None = None


class RedeemPointsIn(BaseModel):
    points: int
    reward_id: uuid.UUID | None = None
    reason: str = "redemption"


# -- Rewards --

class RewardCreateIn(BaseModel):
    name: str
    description: str | None = None
    points_cost: int
    reward_type: str  # discount, free_item, gift_card, store_credit
    reward_value: dict | None = None
    is_active: bool = True


class RewardUpdateIn(BaseModel):
    name: str | None = None
    description: str | None = None
    points_cost: int | None = None
    reward_type: str | None = None
    reward_value: dict | None = None
    is_active: bool | None = None


class RewardOut(BaseModel):
    id: uuid.UUID
    program_id: uuid.UUID
    name: str
    description: str | None
    points_cost: int
    reward_type: str
    reward_value: dict | None
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _check_tier_upgrade(db: DBSession, member: LoyaltyMember):
    """Auto-upgrade member tier if lifetime_points qualifies for a higher tier."""
    result = await db.execute(
        select(LoyaltyTier)
        .where(LoyaltyTier.program_id == member.program_id)
        .order_by(LoyaltyTier.min_points.desc())
    )
    tiers = result.scalars().all()
    for tier in tiers:
        if member.lifetime_points >= tier.min_points:
            if member.tier_id != tier.id:
                member.tier_id = tier.id
            break


# ── Program endpoints ─────────────────────────────────────────────────────────

@router.post("/programs", status_code=status.HTTP_201_CREATED, summary="Create a loyalty program")
async def create_program(
    payload: ProgramCreateIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    program = LoyaltyProgram(
        name=payload.name,
        description=payload.description,
        points_per_unit_currency=payload.points_per_unit_currency,
        is_active=payload.is_active,
    )
    db.add(program)
    await db.commit()
    await db.refresh(program)
    return ProgramOut.model_validate(program).model_dump()


@router.get("/programs", summary="List loyalty programs")
async def list_programs(
    current_user: CurrentUser,
    db: DBSession,
    is_active: bool | None = Query(None, description="Filter by active status"),
) -> list[dict[str, Any]]:
    stmt = select(LoyaltyProgram)
    if is_active is not None:
        stmt = stmt.where(LoyaltyProgram.is_active == is_active)
    stmt = stmt.order_by(LoyaltyProgram.created_at.desc())
    result = await db.execute(stmt)
    programs = result.scalars().all()
    return [ProgramOut.model_validate(p).model_dump() for p in programs]


@router.get("/programs/{program_id}", summary="Get loyalty program detail with tiers & rewards")
async def get_program(
    program_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(LoyaltyProgram)
        .where(LoyaltyProgram.id == program_id)
        .options(
            selectinload(LoyaltyProgram.tiers),
            selectinload(LoyaltyProgram.rewards),
        )
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    data = ProgramOut.model_validate(program).model_dump()
    data["tiers"] = [
        TierOut.model_validate(t).model_dump()
        for t in sorted(program.tiers, key=lambda t: t.sort_order)
    ]
    data["rewards"] = [
        RewardOut.model_validate(r).model_dump() for r in program.rewards
    ]
    return data


@router.put("/programs/{program_id}", summary="Update a loyalty program")
async def update_program(
    program_id: uuid.UUID,
    payload: ProgramUpdateIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    program = await db.get(LoyaltyProgram, program_id)
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(program, field, value)

    await db.commit()
    await db.refresh(program)
    return ProgramOut.model_validate(program).model_dump()


# ── Tier endpoints ────────────────────────────────────────────────────────────

@router.post("/programs/{program_id}/tiers", status_code=status.HTTP_201_CREATED, summary="Create a tier")
async def create_tier(
    program_id: uuid.UUID,
    payload: TierCreateIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    program = await db.get(LoyaltyProgram, program_id)
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    tier = LoyaltyTier(
        program_id=program_id,
        name=payload.name,
        min_points=payload.min_points,
        discount_percentage=payload.discount_percentage,
        points_multiplier=payload.points_multiplier,
        sort_order=payload.sort_order,
    )
    db.add(tier)
    await db.commit()
    await db.refresh(tier)
    return TierOut.model_validate(tier).model_dump()


@router.put("/tiers/{tier_id}", summary="Update a tier")
async def update_tier(
    tier_id: uuid.UUID,
    payload: TierUpdateIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    tier = await db.get(LoyaltyTier, tier_id)
    if not tier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tier not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tier, field, value)

    await db.commit()
    await db.refresh(tier)
    return TierOut.model_validate(tier).model_dump()


@router.delete("/tiers/{tier_id}", status_code=status.HTTP_200_OK, summary="Delete a tier")
async def delete_tier(
    tier_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    tier = await db.get(LoyaltyTier, tier_id)
    if not tier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tier not found")

    # Remove tier assignment from members before deleting
    result = await db.execute(
        select(LoyaltyMember).where(LoyaltyMember.tier_id == tier_id)
    )
    members_on_tier = result.scalars().all()
    for member in members_on_tier:
        member.tier_id = None

    await db.delete(tier)
    await db.commit()


# ── Member endpoints ──────────────────────────────────────────────────────────

@router.post("/members", status_code=status.HTTP_201_CREATED, summary="Enroll a customer in a loyalty program")
async def enroll_member(
    payload: MemberEnrollIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Validate program
    program = await db.get(LoyaltyProgram, payload.program_id)
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    if not program.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Program is not active")

    # Validate customer (CRM contact)
    customer = await db.get(Contact, payload.customer_id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    # Check for duplicate enrollment
    result = await db.execute(
        select(LoyaltyMember).where(
            LoyaltyMember.program_id == payload.program_id,
            LoyaltyMember.customer_id == payload.customer_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Customer is already enrolled in this program",
        )

    referral_code = secrets.token_urlsafe(8)

    member = LoyaltyMember(
        program_id=payload.program_id,
        customer_id=payload.customer_id,
        referral_code=referral_code,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return MemberOut.model_validate(member).model_dump()


@router.get("/members", summary="List loyalty members")
async def list_members(
    current_user: CurrentUser,
    db: DBSession,
    program_id: uuid.UUID | None = Query(None, description="Filter by program"),
) -> list[dict[str, Any]]:
    stmt = select(LoyaltyMember).options(selectinload(LoyaltyMember.tier))
    if program_id is not None:
        stmt = stmt.where(LoyaltyMember.program_id == program_id)
    stmt = stmt.order_by(LoyaltyMember.created_at.desc())
    result = await db.execute(stmt)
    members = result.scalars().all()
    rows = []
    for m in members:
        data = MemberOut.model_validate(m).model_dump()
        if m.tier:
            data["tier_name"] = m.tier.name
        rows.append(data)
    return rows


@router.get("/members/by-customer/{customer_id}", summary="Lookup memberships by CRM contact ID")
async def get_member_by_customer(
    customer_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(LoyaltyMember)
        .where(LoyaltyMember.customer_id == customer_id)
        .options(selectinload(LoyaltyMember.tier), selectinload(LoyaltyMember.program))
    )
    members = result.scalars().all()
    rows = []
    for m in members:
        data = MemberOut.model_validate(m).model_dump()
        if m.tier:
            data["tier_name"] = m.tier.name
        if m.program:
            data["program_name"] = m.program.name
        rows.append(data)
    return rows


@router.get("/members/{member_id}", summary="Get member detail with tier, points, transactions")
async def get_member(
    member_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(LoyaltyMember)
        .where(LoyaltyMember.id == member_id)
        .options(
            selectinload(LoyaltyMember.tier),
            selectinload(LoyaltyMember.program),
            selectinload(LoyaltyMember.transactions),
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    data = MemberOut.model_validate(member).model_dump()
    if member.tier:
        data["tier_name"] = member.tier.name
        data["tier_discount_percentage"] = float(member.tier.discount_percentage)
        data["tier_points_multiplier"] = float(member.tier.points_multiplier)
    if member.program:
        data["program_name"] = member.program.name
    data["transactions"] = [
        TransactionOut.model_validate(t).model_dump()
        for t in sorted(member.transactions, key=lambda t: t.created_at, reverse=True)
    ]
    return data


# ── Points endpoints ──────────────────────────────────────────────────────────

@router.post("/members/{member_id}/earn", summary="Earn loyalty points")
async def earn_points(
    member_id: uuid.UUID,
    payload: EarnPointsIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    member = await db.get(LoyaltyMember, member_id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if payload.points <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Points must be positive")

    member.points_balance += payload.points
    member.lifetime_points += payload.points

    txn = LoyaltyTransaction(
        member_id=member_id,
        pos_transaction_id=payload.pos_transaction_id,
        points_change=payload.points,
        reason=payload.reason,
        balance_after=member.points_balance,
    )
    db.add(txn)

    # Check for tier upgrade
    await _check_tier_upgrade(db, member)

    await db.commit()
    await db.refresh(member)
    await db.refresh(txn)

    return {
        "transaction": TransactionOut.model_validate(txn).model_dump(),
        "member": MemberOut.model_validate(member).model_dump(),
    }


@router.post("/members/{member_id}/redeem", summary="Redeem loyalty points")
async def redeem_points(
    member_id: uuid.UUID,
    payload: RedeemPointsIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    member = await db.get(LoyaltyMember, member_id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if payload.points <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Points must be positive")

    if member.points_balance < payload.points:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient points. Balance: {member.points_balance}, requested: {payload.points}",
        )

    # Validate reward if provided
    if payload.reward_id:
        reward = await db.get(LoyaltyReward, payload.reward_id)
        if not reward:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reward not found")
        if not reward.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reward is not active")
        if payload.points < reward.points_cost:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Reward requires {reward.points_cost} points, but only {payload.points} provided",
            )

    member.points_balance -= payload.points

    txn = LoyaltyTransaction(
        member_id=member_id,
        points_change=-payload.points,
        reason=payload.reason,
        balance_after=member.points_balance,
    )
    db.add(txn)

    await db.commit()
    await db.refresh(member)
    await db.refresh(txn)

    return {
        "transaction": TransactionOut.model_validate(txn).model_dump(),
        "member": MemberOut.model_validate(member).model_dump(),
    }


# ── Reward endpoints ──────────────────────────────────────────────────────────

@router.post("/programs/{program_id}/rewards", status_code=status.HTTP_201_CREATED, summary="Create a reward")
async def create_reward(
    program_id: uuid.UUID,
    payload: RewardCreateIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    program = await db.get(LoyaltyProgram, program_id)
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    reward = LoyaltyReward(
        program_id=program_id,
        name=payload.name,
        description=payload.description,
        points_cost=payload.points_cost,
        reward_type=payload.reward_type,
        reward_value=payload.reward_value,
        is_active=payload.is_active,
    )
    db.add(reward)
    await db.commit()
    await db.refresh(reward)
    return RewardOut.model_validate(reward).model_dump()


@router.get("/programs/{program_id}/rewards", summary="List rewards for a program")
async def list_rewards(
    program_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    is_active: bool | None = Query(None, description="Filter by active status"),
) -> list[dict[str, Any]]:
    stmt = select(LoyaltyReward).where(LoyaltyReward.program_id == program_id)
    if is_active is not None:
        stmt = stmt.where(LoyaltyReward.is_active == is_active)
    stmt = stmt.order_by(LoyaltyReward.points_cost.asc())
    result = await db.execute(stmt)
    rewards = result.scalars().all()
    return [RewardOut.model_validate(r).model_dump() for r in rewards]


@router.put("/rewards/{reward_id}", summary="Update a reward")
async def update_reward(
    reward_id: uuid.UUID,
    payload: RewardUpdateIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    reward = await db.get(LoyaltyReward, reward_id)
    if not reward:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reward not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(reward, field, value)

    await db.commit()
    await db.refresh(reward)
    return RewardOut.model_validate(reward).model_dump()


@router.delete("/rewards/{reward_id}", status_code=status.HTTP_200_OK, summary="Delete a reward")
async def delete_reward(
    reward_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    reward = await db.get(LoyaltyReward, reward_id)
    if not reward:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reward not found")

    await db.delete(reward)
    await db.commit()
