"""CRM Contacts V2 — 360° view, notes, duplicate detection & merge."""

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.models.crm import (
    CampaignContact,
    Contact,
    ContactNote,
    Deal,
    DuplicateCandidate,
    Lead,
    Opportunity,
    Quote,
    SalesActivity,
    SequenceEnrollment,
)
from app.services.crm_duplicates import detect_duplicates, dismiss_candidate, merge_contacts

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────


class NoteCreate(BaseModel):
    note_type: str = "note"
    content: str
    metadata_json: dict | None = None
    pinned: bool = False


class NoteOut(BaseModel):
    id: uuid.UUID
    contact_id: uuid.UUID
    author_id: uuid.UUID
    note_type: str
    content: str
    metadata_json: dict | None
    pinned: bool
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


class MergePayload(BaseModel):
    keep_contact_id: uuid.UUID


class DuplicateOut(BaseModel):
    id: uuid.UUID
    contact_a_id: uuid.UUID
    contact_b_id: uuid.UUID
    confidence_score: int
    match_fields: dict | None
    status: str
    reviewed_by: uuid.UUID | None
    reviewed_at: Any | None
    created_at: Any
    model_config = {"from_attributes": True}


# ── 360° View ────────────────────────────────────────────────────────────────


@router.get("/contacts/{contact_id}/360", summary="Full 360° contact view")
async def contact_360(
    contact_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    contact = await db.get(Contact, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    # Leads
    leads_result = await db.execute(select(Lead).where(Lead.contact_id == contact_id))
    leads = leads_result.scalars().all()

    # Opportunities from those leads
    lead_ids = [l.id for l in leads]
    opps = []
    if lead_ids:
        opps_result = await db.execute(select(Opportunity).where(Opportunity.lead_id.in_(lead_ids)))
        opps = opps_result.scalars().all()

    # Deals from those opportunities
    opp_ids = [o.id for o in opps]
    deals = []
    if opp_ids:
        deals_result = await db.execute(select(Deal).where(Deal.opportunity_id.in_(opp_ids)))
        deals = deals_result.scalars().all()

    # Quotes
    quotes_result = await db.execute(select(Quote).where(Quote.contact_id == contact_id))
    quotes = quotes_result.scalars().all()

    # Activities
    activities_result = await db.execute(
        select(SalesActivity)
        .where(SalesActivity.contact_id == contact_id)
        .order_by(SalesActivity.created_at.desc())
        .limit(50)
    )
    activities = activities_result.scalars().all()

    # Notes
    notes_result = await db.execute(
        select(ContactNote)
        .where(ContactNote.contact_id == contact_id)
        .order_by(ContactNote.pinned.desc(), ContactNote.created_at.desc())
    )
    notes = notes_result.scalars().all()

    # Campaigns
    campaign_result = await db.execute(
        select(CampaignContact)
        .where(CampaignContact.contact_id == contact_id)
        .options(selectinload(CampaignContact.campaign))
    )
    campaign_contacts = campaign_result.scalars().all()

    # Sequence enrollments
    enrollments_result = await db.execute(
        select(SequenceEnrollment).where(SequenceEnrollment.contact_id == contact_id)
    )
    enrollments = enrollments_result.scalars().all()

    def _serialize(obj):
        d = {}
        for col in obj.__table__.columns:
            val = getattr(obj, col.name)
            if isinstance(val, uuid.UUID):
                val = str(val)
            d[col.name] = val
        return d

    return {
        "contact": _serialize(contact),
        "leads": [_serialize(l) for l in leads],
        "opportunities": [_serialize(o) for o in opps],
        "deals": [_serialize(d) for d in deals],
        "quotes": [_serialize(q) for q in quotes],
        "activities": [_serialize(a) for a in activities],
        "notes": [NoteOut.model_validate(n).model_dump() for n in notes],
        "campaigns": [
            {
                "campaign_id": str(cc.campaign_id),
                "campaign_name": cc.campaign.name if cc.campaign else None,
                "status": cc.status,
                "sent_at": cc.sent_at,
                "opened_at": cc.opened_at,
            }
            for cc in campaign_contacts
        ],
        "sequence_enrollments": [_serialize(e) for e in enrollments],
    }


# ── Notes CRUD ────────────────────────────────────────────────────────────────


@router.get("/contacts/{contact_id}/notes", summary="List notes for a contact")
async def list_notes(
    contact_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = (
        select(ContactNote)
        .where(ContactNote.contact_id == contact_id)
        .order_by(ContactNote.pinned.desc(), ContactNote.created_at.desc())
    )
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    notes = result.scalars().all()
    return {
        "total": total,
        "notes": [NoteOut.model_validate(n).model_dump() for n in notes],
    }


@router.post("/contacts/{contact_id}/notes", status_code=201, summary="Add a note")
async def create_note(
    contact_id: uuid.UUID,
    payload: NoteCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    contact = await db.get(Contact, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    note = ContactNote(
        contact_id=contact_id,
        author_id=current_user.id,
        note_type=payload.note_type,
        content=payload.content,
        metadata_json=payload.metadata_json,
        pinned=payload.pinned,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return NoteOut.model_validate(note).model_dump()


# ── Duplicate Detection ──────────────────────────────────────────────────────


@router.post("/contacts/detect-duplicates", summary="Run duplicate detection")
async def run_duplicate_detection(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    new_candidates = await detect_duplicates(db)
    await db.commit()
    return {"new_candidates": len(new_candidates), "candidates": new_candidates}


@router.get("/duplicates", summary="List pending duplicate candidates")
async def list_duplicates(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str = Query("pending", alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(DuplicateCandidate).where(DuplicateCandidate.status == status_filter)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    query = query.order_by(DuplicateCandidate.confidence_score.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    dups = result.scalars().all()
    return {
        "total": total,
        "duplicates": [DuplicateOut.model_validate(d).model_dump() for d in dups],
    }


@router.post("/duplicates/{candidate_id}/merge", summary="Merge duplicate contacts")
async def merge_duplicate(
    candidate_id: uuid.UUID,
    payload: MergePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await merge_contacts(db, candidate_id, payload.keep_contact_id, current_user.id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    await db.commit()
    return result


@router.post("/duplicates/{candidate_id}/dismiss", summary="Dismiss a duplicate candidate")
async def dismiss_duplicate(
    candidate_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await dismiss_candidate(db, candidate_id, current_user.id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    await db.commit()
    return result
