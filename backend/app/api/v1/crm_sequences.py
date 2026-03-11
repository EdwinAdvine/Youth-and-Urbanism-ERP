"""CRM Sales Sequences — sequence CRUD + enrollment management."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.models.crm import SalesSequence, SequenceEnrollment, SequenceStep
from app.services.crm_sequences import enroll_contact, unenroll_contact

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────


class StepSchema(BaseModel):
    step_order: int
    step_type: str  # email, wait, task, condition
    delay_days: int = 0
    delay_hours: int = 0
    config: dict | None = None


class SequenceCreate(BaseModel):
    name: str
    description: str | None = None
    trigger_type: str = "manual"
    trigger_config: dict | None = None
    steps: list[StepSchema] = []


class SequenceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    trigger_type: str | None = None
    trigger_config: dict | None = None


class SequenceOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    status: str
    trigger_type: str
    trigger_config: dict | None
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


class StepOut(BaseModel):
    id: uuid.UUID
    sequence_id: uuid.UUID
    step_order: int
    step_type: str
    delay_days: int
    delay_hours: int
    config: dict | None
    created_at: Any
    model_config = {"from_attributes": True}


class EnrollmentOut(BaseModel):
    id: uuid.UUID
    sequence_id: uuid.UUID
    contact_id: uuid.UUID
    current_step_id: uuid.UUID | None
    status: str
    enrolled_at: Any
    completed_at: Any | None
    enrolled_by: uuid.UUID
    metadata_json: dict | None
    created_at: Any
    model_config = {"from_attributes": True}


class EnrollPayload(BaseModel):
    contact_ids: list[uuid.UUID]


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/sequences", summary="List sales sequences")
async def list_sequences(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(SalesSequence)
    if status_filter:
        query = query.where(SalesSequence.status == status_filter)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    query = query.order_by(SalesSequence.updated_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    sequences = result.scalars().all()
    return {
        "total": total,
        "sequences": [SequenceOut.model_validate(s).model_dump() for s in sequences],
    }


@router.post("/sequences", status_code=201, summary="Create a sales sequence with steps")
async def create_sequence(
    payload: SequenceCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    sequence = SalesSequence(
        name=payload.name,
        description=payload.description,
        trigger_type=payload.trigger_type,
        trigger_config=payload.trigger_config,
        owner_id=current_user.id,
    )
    db.add(sequence)
    await db.flush()

    for step_data in payload.steps:
        step = SequenceStep(
            sequence_id=sequence.id,
            step_order=step_data.step_order,
            step_type=step_data.step_type,
            delay_days=step_data.delay_days,
            delay_hours=step_data.delay_hours,
            config=step_data.config,
        )
        db.add(step)

    await db.commit()
    await db.refresh(sequence)
    return SequenceOut.model_validate(sequence).model_dump()


@router.get("/sequences/{sequence_id}", summary="Get sequence detail with steps")
async def get_sequence(
    sequence_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    stmt = (
        select(SalesSequence)
        .where(SalesSequence.id == sequence_id)
        .options(selectinload(SalesSequence.steps), selectinload(SalesSequence.enrollments))
    )
    result = await db.execute(stmt)
    sequence = result.scalar_one_or_none()
    if not sequence:
        raise HTTPException(status_code=404, detail="Sequence not found")

    steps = sorted(sequence.steps, key=lambda s: s.step_order)
    active_enrollments = sum(1 for e in sequence.enrollments if e.status == "active")
    completed_enrollments = sum(1 for e in sequence.enrollments if e.status == "completed")

    return {
        "sequence": SequenceOut.model_validate(sequence).model_dump(),
        "steps": [StepOut.model_validate(s).model_dump() for s in steps],
        "stats": {
            "total_enrollments": len(sequence.enrollments),
            "active": active_enrollments,
            "completed": completed_enrollments,
        },
    }


@router.put("/sequences/{sequence_id}", summary="Update a sequence")
async def update_sequence(
    sequence_id: uuid.UUID,
    payload: SequenceUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    sequence = await db.get(SalesSequence, sequence_id)
    if not sequence:
        raise HTTPException(status_code=404, detail="Sequence not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(sequence, k, v)
    await db.commit()
    await db.refresh(sequence)
    return SequenceOut.model_validate(sequence).model_dump()


@router.delete("/sequences/{sequence_id}", status_code=204, summary="Delete a sequence")
async def delete_sequence(
    sequence_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    sequence = await db.get(SalesSequence, sequence_id)
    if not sequence:
        raise HTTPException(status_code=404, detail="Sequence not found")
    await db.delete(sequence)
    await db.commit()
    return Response(status_code=204)


@router.post("/sequences/{sequence_id}/activate", summary="Activate a sequence")
async def activate_sequence(
    sequence_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    sequence = await db.get(SalesSequence, sequence_id)
    if not sequence:
        raise HTTPException(status_code=404, detail="Sequence not found")
    sequence.status = "active"
    await db.commit()
    return {"status": "active", "id": str(sequence_id)}


@router.post("/sequences/{sequence_id}/pause", summary="Pause a sequence")
async def pause_sequence(
    sequence_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    sequence = await db.get(SalesSequence, sequence_id)
    if not sequence:
        raise HTTPException(status_code=404, detail="Sequence not found")
    sequence.status = "paused"
    await db.commit()
    return {"status": "paused", "id": str(sequence_id)}


@router.post("/sequences/{sequence_id}/enroll", summary="Enroll contacts in a sequence")
async def enroll_contacts(
    sequence_id: uuid.UUID,
    payload: EnrollPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    sequence = await db.get(SalesSequence, sequence_id)
    if not sequence:
        raise HTTPException(status_code=404, detail="Sequence not found")
    if sequence.status != "active":
        raise HTTPException(status_code=400, detail="Sequence must be active to enroll contacts")

    enrolled = []
    for contact_id in payload.contact_ids:
        enrollment = await enroll_contact(db, sequence_id, contact_id, current_user.id)
        enrolled.append(str(enrollment.id))
    await db.commit()
    return {"enrolled": len(enrolled), "enrollment_ids": enrolled}


@router.post("/sequences/{sequence_id}/unenroll/{contact_id}", summary="Unenroll a contact")
async def unenroll_from_sequence(
    sequence_id: uuid.UUID,
    contact_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    stmt = select(SequenceEnrollment).where(
        SequenceEnrollment.sequence_id == sequence_id,
        SequenceEnrollment.contact_id == contact_id,
        SequenceEnrollment.status == "active",
    )
    result = await db.execute(stmt)
    enrollment = result.scalar_one_or_none()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Active enrollment not found")
    res = await unenroll_contact(db, enrollment.id)
    await db.commit()
    return res


@router.get("/sequences/{sequence_id}/enrollments", summary="List enrollments for a sequence")
async def list_enrollments(
    sequence_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(SequenceEnrollment).where(SequenceEnrollment.sequence_id == sequence_id)
    if status_filter:
        query = query.where(SequenceEnrollment.status == status_filter)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    query = query.order_by(SequenceEnrollment.enrolled_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    enrollments = result.scalars().all()
    return {
        "total": total,
        "enrollments": [EnrollmentOut.model_validate(e).model_dump() for e in enrollments],
    }
