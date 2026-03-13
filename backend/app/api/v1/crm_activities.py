"""CRM Sales Activities — unified activity log CRUD."""

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.models.crm import Contact, SalesActivity

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────


class ActivityCreate(BaseModel):
    activity_type: str  # email, call, meeting, task, note, sms
    subject: str
    description: str | None = None
    contact_id: uuid.UUID | None = None
    lead_id: uuid.UUID | None = None
    opportunity_id: uuid.UUID | None = None
    deal_id: uuid.UUID | None = None
    assigned_to: uuid.UUID | None = None
    completed_at: datetime | None = None
    due_date: datetime | None = None
    duration_minutes: int | None = None
    outcome: str | None = None
    metadata_json: dict | None = None


class ActivityUpdate(BaseModel):
    activity_type: str | None = None
    subject: str | None = None
    description: str | None = None
    completed_at: datetime | None = None
    due_date: datetime | None = None
    duration_minutes: int | None = None
    outcome: str | None = None
    metadata_json: dict | None = None


class ActivityOut(BaseModel):
    id: uuid.UUID
    activity_type: str
    subject: str
    description: str | None
    contact_id: uuid.UUID | None
    lead_id: uuid.UUID | None
    opportunity_id: uuid.UUID | None
    deal_id: uuid.UUID | None
    assigned_to: uuid.UUID | None
    completed_at: Any | None
    due_date: Any | None
    duration_minutes: int | None
    outcome: str | None
    metadata_json: dict | None
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/activities", summary="List sales activities")
async def list_activities(
    current_user: CurrentUser,
    db: DBSession,
    activity_type: str | None = Query(None),
    contact_id: uuid.UUID | None = Query(None),
    lead_id: uuid.UUID | None = Query(None),
    opportunity_id: uuid.UUID | None = Query(None),
    deal_id: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(SalesActivity)
    if activity_type:
        query = query.where(SalesActivity.activity_type == activity_type)
    if contact_id:
        query = query.where(SalesActivity.contact_id == contact_id)
    if lead_id:
        query = query.where(SalesActivity.lead_id == lead_id)
    if opportunity_id:
        query = query.where(SalesActivity.opportunity_id == opportunity_id)
    if deal_id:
        query = query.where(SalesActivity.deal_id == deal_id)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    query = query.order_by(SalesActivity.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    activities = result.scalars().all()
    return {
        "total": total,
        "activities": [ActivityOut.model_validate(a).model_dump() for a in activities],
    }


@router.post("/activities", status_code=201, summary="Log a sales activity")
async def create_activity(
    payload: ActivityCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    activity = SalesActivity(
        activity_type=payload.activity_type,
        subject=payload.subject,
        description=payload.description,
        contact_id=payload.contact_id,
        lead_id=payload.lead_id,
        opportunity_id=payload.opportunity_id,
        deal_id=payload.deal_id,
        assigned_to=payload.assigned_to,
        completed_at=payload.completed_at,
        due_date=payload.due_date,
        duration_minutes=payload.duration_minutes,
        outcome=payload.outcome,
        metadata_json=payload.metadata_json,
        owner_id=current_user.id,
    )
    db.add(activity)
    await db.commit()
    await db.refresh(activity)

    # Update contact last_activity_at
    if payload.contact_id:
        contact = await db.get(Contact, payload.contact_id)
        if contact:
            from datetime import timezone
            contact.last_activity_at = datetime.now(timezone.utc)
            await db.commit()

    return ActivityOut.model_validate(activity).model_dump()


@router.put("/activities/{activity_id}", summary="Update an activity")
async def update_activity(
    activity_id: uuid.UUID,
    payload: ActivityUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    activity = await db.get(SalesActivity, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(activity, k, v)
    await db.commit()
    await db.refresh(activity)
    return ActivityOut.model_validate(activity).model_dump()


@router.delete("/activities/{activity_id}", status_code=204, summary="Delete an activity")
async def delete_activity(
    activity_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    activity = await db.get(SalesActivity, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    await db.delete(activity)
    await db.commit()
    return Response(status_code=204)
