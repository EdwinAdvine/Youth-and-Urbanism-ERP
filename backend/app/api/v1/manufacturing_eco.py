"""Manufacturing ECO API — Engineering Change Orders & Material Substitutions."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.manufacturing import (
    BillOfMaterials,
    BOMItem,
    ECOApproval,
    EngineeringChangeOrder,
    MaterialSubstitution,
)

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class ECOCreate(BaseModel):
    title: str
    description: str | None = None
    bom_id: uuid.UUID
    change_type: str = "revision"  # revision, new_version, obsolete
    priority: str = "medium"
    reason: str | None = None
    impact_analysis: str | None = None
    affected_items: list[uuid.UUID] | None = None


class ECOUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    change_type: str | None = None
    priority: str | None = None
    reason: str | None = None
    impact_analysis: str | None = None
    affected_items: list[uuid.UUID] | None = None


class ECOApprovalOut(BaseModel):
    id: uuid.UUID
    eco_id: uuid.UUID
    approver_id: uuid.UUID
    decision: str
    comments: str | None
    decided_at: datetime | None
    sequence: int
    created_at: Any

    model_config = {"from_attributes": True}


class ECOOut(BaseModel):
    id: uuid.UUID
    eco_number: str
    title: str
    description: str | None
    bom_id: uuid.UUID
    change_type: str
    status: str
    priority: str
    requested_by: uuid.UUID
    approved_by: uuid.UUID | None
    submitted_at: datetime | None
    approved_at: datetime | None
    implemented_at: datetime | None
    reason: str | None
    impact_analysis: str | None
    affected_items: Any
    new_bom_version: int | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class ECODetailOut(ECOOut):
    approvals: list[ECOApprovalOut] = []


class ECOApprovalIn(BaseModel):
    approver_ids: list[uuid.UUID]


class ECODecisionIn(BaseModel):
    decision: str  # approved, rejected
    comments: str | None = None


class SubstitutionCreate(BaseModel):
    substitute_item_id: uuid.UUID
    priority: int = 1
    conversion_factor: Decimal = Decimal("1")
    notes: str | None = None
    valid_from: date | None = None
    valid_until: date | None = None


class SubstitutionOut(BaseModel):
    id: uuid.UUID
    bom_item_id: uuid.UUID
    substitute_item_id: uuid.UUID
    priority: int
    conversion_factor: Decimal
    is_active: bool
    notes: str | None
    valid_from: date | None
    valid_until: date | None
    created_at: Any

    model_config = {"from_attributes": True}


# ── Helper ────────────────────────────────────────────────────────────────────

async def _next_eco_number(db: DBSession) -> str:
    result = await db.execute(select(func.count(EngineeringChangeOrder.id)))
    count = result.scalar() or 0
    return f"ECO-{count + 1:05d}"


# ── ECO Endpoints ─────────────────────────────────────────────────────────────

@router.post("/eco", response_model=ECOOut, status_code=status.HTTP_201_CREATED)
async def create_eco(body: ECOCreate, db: DBSession, user: CurrentUser):
    bom = await db.get(BillOfMaterials, body.bom_id)
    if not bom:
        raise HTTPException(status_code=404, detail="BOM not found")

    eco = EngineeringChangeOrder(
        eco_number=await _next_eco_number(db),
        title=body.title,
        description=body.description,
        bom_id=body.bom_id,
        change_type=body.change_type,
        priority=body.priority,
        reason=body.reason,
        impact_analysis=body.impact_analysis,
        affected_items=[str(i) for i in body.affected_items] if body.affected_items else None,
        requested_by=user.id,
    )
    db.add(eco)
    await db.commit()
    await db.refresh(eco)
    return eco


@router.get("/eco", response_model=list[ECOOut])
async def list_ecos(
    db: DBSession,
    user: CurrentUser,
    bom_id: uuid.UUID | None = None,
    eco_status: str | None = Query(None, alias="status"),
    skip: int = 0,
    limit: int = 50,
):
    q = select(EngineeringChangeOrder).order_by(EngineeringChangeOrder.created_at.desc())
    if bom_id:
        q = q.where(EngineeringChangeOrder.bom_id == bom_id)
    if eco_status:
        q = q.where(EngineeringChangeOrder.status == eco_status)
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/eco/{eco_id}", response_model=ECODetailOut)
async def get_eco(eco_id: uuid.UUID, db: DBSession, user: CurrentUser):
    result = await db.execute(
        select(EngineeringChangeOrder)
        .options(selectinload(EngineeringChangeOrder.approvals))
        .where(EngineeringChangeOrder.id == eco_id)
    )
    eco = result.scalar_one_or_none()
    if not eco:
        raise HTTPException(status_code=404, detail="ECO not found")
    return eco


@router.put("/eco/{eco_id}", response_model=ECOOut)
async def update_eco(eco_id: uuid.UUID, body: ECOUpdate, db: DBSession, user: CurrentUser):
    eco = await db.get(EngineeringChangeOrder, eco_id)
    if not eco:
        raise HTTPException(status_code=404, detail="ECO not found")
    if eco.status != "draft":
        raise HTTPException(status_code=400, detail="Can only edit draft ECOs")

    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "affected_items" and value is not None:
            value = [str(i) for i in value]
        setattr(eco, field, value)

    await db.commit()
    await db.refresh(eco)
    return eco


@router.post("/eco/{eco_id}/submit", response_model=ECOOut)
async def submit_eco(eco_id: uuid.UUID, db: DBSession, user: CurrentUser):
    eco = await db.get(EngineeringChangeOrder, eco_id)
    if not eco:
        raise HTTPException(status_code=404, detail="ECO not found")
    if eco.status != "draft":
        raise HTTPException(status_code=400, detail="ECO is not in draft status")

    eco.status = "submitted"
    eco.submitted_at = func.now()
    await db.commit()
    await db.refresh(eco)

    await event_bus.publish("eco.submitted", {
        "eco_id": str(eco.id),
        "eco_number": eco.eco_number,
        "title": eco.title,
        "bom_id": str(eco.bom_id),
        "requested_by": str(eco.requested_by),
    })
    return eco


@router.post("/eco/{eco_id}/add-approvers", response_model=ECODetailOut)
async def add_eco_approvers(eco_id: uuid.UUID, body: ECOApprovalIn, db: DBSession, user: CurrentUser):
    result = await db.execute(
        select(EngineeringChangeOrder)
        .options(selectinload(EngineeringChangeOrder.approvals))
        .where(EngineeringChangeOrder.id == eco_id)
    )
    eco = result.scalar_one_or_none()
    if not eco:
        raise HTTPException(status_code=404, detail="ECO not found")

    existing_count = len(eco.approvals)
    for i, approver_id in enumerate(body.approver_ids):
        approval = ECOApproval(
            eco_id=eco.id,
            approver_id=approver_id,
            sequence=existing_count + i + 1,
        )
        db.add(approval)

    eco.status = "under_review"
    await db.commit()
    await db.refresh(eco, attribute_names=["approvals"])
    return eco


@router.post("/eco/{eco_id}/approve", response_model=ECOOut)
async def approve_eco(eco_id: uuid.UUID, body: ECODecisionIn, db: DBSession, user: CurrentUser):
    result = await db.execute(
        select(EngineeringChangeOrder)
        .options(selectinload(EngineeringChangeOrder.approvals))
        .where(EngineeringChangeOrder.id == eco_id)
    )
    eco = result.scalar_one_or_none()
    if not eco:
        raise HTTPException(status_code=404, detail="ECO not found")
    if eco.status not in ("submitted", "under_review"):
        raise HTTPException(status_code=400, detail="ECO is not pending approval")

    # Find user's pending approval
    user_approval = None
    for a in eco.approvals:
        if a.approver_id == user.id and a.decision == "pending":
            user_approval = a
            break

    if not user_approval:
        raise HTTPException(status_code=403, detail="You are not a pending approver for this ECO")

    user_approval.decision = body.decision
    user_approval.comments = body.comments
    user_approval.decided_at = func.now()

    # Check if all approved or any rejected
    if body.decision == "rejected":
        eco.status = "rejected"
    else:
        all_decided = all(a.decision != "pending" for a in eco.approvals)
        all_approved = all(a.decision == "approved" for a in eco.approvals)
        if all_decided and all_approved:
            eco.status = "approved"
            eco.approved_by = user.id
            eco.approved_at = func.now()

            await event_bus.publish("eco.approved", {
                "eco_id": str(eco.id),
                "eco_number": eco.eco_number,
                "bom_id": str(eco.bom_id),
            })

    await db.commit()
    await db.refresh(eco)
    return eco


@router.post("/eco/{eco_id}/implement", response_model=ECOOut)
async def implement_eco(eco_id: uuid.UUID, db: DBSession, user: CurrentUser):
    result = await db.execute(
        select(EngineeringChangeOrder)
        .where(EngineeringChangeOrder.id == eco_id)
    )
    eco = result.scalar_one_or_none()
    if not eco:
        raise HTTPException(status_code=404, detail="ECO not found")
    if eco.status != "approved":
        raise HTTPException(status_code=400, detail="ECO must be approved before implementation")

    # Load the original BOM with items
    bom_result = await db.execute(
        select(BillOfMaterials)
        .options(selectinload(BillOfMaterials.items))
        .where(BillOfMaterials.id == eco.bom_id)
    )
    original_bom = bom_result.scalar_one_or_none()
    if not original_bom:
        raise HTTPException(status_code=404, detail="Original BOM not found")

    if eco.change_type == "obsolete":
        original_bom.is_active = False
        eco.status = "implemented"
        eco.implemented_at = func.now()
    else:
        # Create new BOM version
        new_version = original_bom.version + 1
        count_result = await db.execute(select(func.count(BillOfMaterials.id)))
        total_boms = count_result.scalar() or 0

        new_bom = BillOfMaterials(
            bom_number=f"BOM-{total_boms + 1:05d}",
            name=f"{original_bom.name} v{new_version}",
            finished_item_id=original_bom.finished_item_id,
            quantity_produced=original_bom.quantity_produced,
            version=new_version,
            is_active=True,
            is_default=True,
            notes=f"Created from ECO {eco.eco_number}",
            owner_id=user.id,
        )
        db.add(new_bom)
        await db.flush()

        # Copy BOM items
        for item in original_bom.items:
            new_item = BOMItem(
                bom_id=new_bom.id,
                item_id=item.item_id,
                child_bom_id=item.child_bom_id,
                quantity_required=item.quantity_required,
                unit_of_measure=item.unit_of_measure,
                scrap_percentage=item.scrap_percentage,
                sort_order=item.sort_order,
                is_phantom=item.is_phantom,
                notes=item.notes,
            )
            db.add(new_item)

        # Mark old BOM as not default
        original_bom.is_default = False
        eco.new_bom_version = new_version
        eco.status = "implemented"
        eco.implemented_at = func.now()

    await db.commit()
    await db.refresh(eco)

    await event_bus.publish("eco.implemented", {
        "eco_id": str(eco.id),
        "eco_number": eco.eco_number,
        "bom_id": str(eco.bom_id),
        "change_type": eco.change_type,
        "new_bom_version": eco.new_bom_version,
    })
    return eco


@router.get("/bom/{bom_id}/versions", response_model=list[dict])
async def list_bom_versions(bom_id: uuid.UUID, db: DBSession, user: CurrentUser):
    bom = await db.get(BillOfMaterials, bom_id)
    if not bom:
        raise HTTPException(status_code=404, detail="BOM not found")

    result = await db.execute(
        select(BillOfMaterials)
        .where(BillOfMaterials.finished_item_id == bom.finished_item_id)
        .order_by(BillOfMaterials.version.desc())
    )
    boms = result.scalars().all()
    return [
        {
            "id": str(b.id),
            "bom_number": b.bom_number,
            "name": b.name,
            "version": b.version,
            "is_active": b.is_active,
            "is_default": b.is_default,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        }
        for b in boms
    ]


# ── Material Substitution Endpoints ──────────────────────────────────────────

@router.get("/bom/{bom_id}/substitutions", response_model=list[SubstitutionOut])
async def list_bom_substitutions(bom_id: uuid.UUID, db: DBSession, user: CurrentUser):
    result = await db.execute(
        select(MaterialSubstitution)
        .join(BOMItem, MaterialSubstitution.bom_item_id == BOMItem.id)
        .where(BOMItem.bom_id == bom_id)
        .order_by(MaterialSubstitution.priority)
    )
    return result.scalars().all()


@router.post("/bom-items/{item_id}/substitutions", response_model=SubstitutionOut, status_code=status.HTTP_201_CREATED)
async def add_substitution(item_id: uuid.UUID, body: SubstitutionCreate, db: DBSession, user: CurrentUser):
    bom_item = await db.get(BOMItem, item_id)
    if not bom_item:
        raise HTTPException(status_code=404, detail="BOM item not found")

    sub = MaterialSubstitution(
        bom_item_id=item_id,
        substitute_item_id=body.substitute_item_id,
        priority=body.priority,
        conversion_factor=body.conversion_factor,
        notes=body.notes,
        valid_from=body.valid_from,
        valid_until=body.valid_until,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub


@router.delete("/substitutions/{sub_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_substitution(sub_id: uuid.UUID, db: DBSession, user: CurrentUser):
    sub = await db.get(MaterialSubstitution, sub_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Substitution not found")
    await db.delete(sub)
    await db.commit()
