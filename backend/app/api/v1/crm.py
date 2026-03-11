"""CRM API — CRUD for contacts, leads, opportunities, deals, pipeline & dashboard."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import and_, extract, func, or_, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.core.sanitize import like_pattern
from app.models.crm import Contact, Deal, Lead, Opportunity

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

# -- Contact schemas --

class ContactCreate(BaseModel):
    contact_type: str = "person"
    first_name: str | None = None
    last_name: str | None = None
    company_name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    tags: list[str] | None = None
    source: str | None = None
    metadata_json: dict | None = None


class ContactUpdate(BaseModel):
    contact_type: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    company_name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    tags: list[str] | None = None
    source: str | None = None
    metadata_json: dict | None = None


class ContactOut(BaseModel):
    id: uuid.UUID
    contact_type: str
    first_name: str | None
    last_name: str | None
    company_name: str | None
    email: str | None
    phone: str | None
    address: str | None
    tags: list[str] | None
    source: str | None
    owner_id: uuid.UUID
    is_active: bool
    metadata_json: dict | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Lead schemas --

class LeadCreate(BaseModel):
    title: str
    contact_id: uuid.UUID | None = None
    status: str = "new"
    source: str | None = None
    estimated_value: Decimal | None = None
    currency: str = "USD"
    notes: str | None = None
    assigned_to: uuid.UUID | None = None


class LeadUpdate(BaseModel):
    title: str | None = None
    contact_id: uuid.UUID | None = None
    status: str | None = None
    source: str | None = None
    estimated_value: Decimal | None = None
    currency: str | None = None
    notes: str | None = None
    assigned_to: uuid.UUID | None = None


class LeadOut(BaseModel):
    id: uuid.UUID
    title: str
    contact_id: uuid.UUID | None
    status: str
    source: str | None
    estimated_value: Decimal | None
    currency: str
    notes: str | None
    assigned_to: uuid.UUID | None
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Opportunity schemas --

class OpportunityCreate(BaseModel):
    title: str
    lead_id: uuid.UUID | None = None
    stage: str = "prospecting"
    probability: int | None = None
    expected_value: Decimal | None = None
    currency: str = "USD"
    expected_close_date: date | None = None
    notes: str | None = None
    assigned_to: uuid.UUID | None = None


class OpportunityUpdate(BaseModel):
    title: str | None = None
    lead_id: uuid.UUID | None = None
    stage: str | None = None
    probability: int | None = None
    expected_value: Decimal | None = None
    currency: str | None = None
    expected_close_date: date | None = None
    notes: str | None = None
    assigned_to: uuid.UUID | None = None


class OpportunityOut(BaseModel):
    id: uuid.UUID
    title: str
    lead_id: uuid.UUID | None
    stage: str
    probability: int | None
    expected_value: Decimal | None
    currency: str
    expected_close_date: date | None
    notes: str | None
    assigned_to: uuid.UUID | None
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Deal schemas --

class DealOut(BaseModel):
    id: uuid.UUID
    title: str
    opportunity_id: uuid.UUID | None
    deal_value: Decimal
    currency: str
    close_date: date
    status: str
    notes: str | None
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Contact endpoints ──────────────────────────────────────────────────────────

@router.get("/contacts", summary="List contacts")
async def list_contacts(
    current_user: CurrentUser,
    db: DBSession,
    contact_type: str | None = Query(None, description="Filter by contact type (person/company)"),
    tags: str | None = Query(None, description="Filter by tag (comma-separated)"),
    source: str | None = Query(None, description="Filter by source"),
    search: str | None = Query(None, description="Search first_name, last_name, or email"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Contact).where(Contact.is_active == True)  # noqa: E712

    if contact_type:
        query = query.where(Contact.contact_type == contact_type)
    if source:
        query = query.where(Contact.source == source)
    if tags:
        tag_list = [t.strip() for t in tags.split(",")]
        for tag in tag_list:
            query = query.where(Contact.tags.any(tag))
    if search:
        safe_pat = like_pattern(search)
        query = query.where(
            or_(
                Contact.first_name.ilike(safe_pat),
                Contact.last_name.ilike(safe_pat),
                Contact.email.ilike(safe_pat),
            )
        )

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Page
    query = query.order_by(Contact.updated_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    contacts = result.scalars().all()
    return {
        "total": total,
        "contacts": [ContactOut.model_validate(c) for c in contacts],
    }


@router.post("/contacts", status_code=status.HTTP_201_CREATED, summary="Create a contact")
async def create_contact(
    payload: ContactCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    contact = Contact(
        contact_type=payload.contact_type,
        first_name=payload.first_name,
        last_name=payload.last_name,
        company_name=payload.company_name,
        email=payload.email,
        phone=payload.phone,
        address=payload.address,
        tags=payload.tags or [],
        source=payload.source,
        owner_id=current_user.id,
        metadata_json=payload.metadata_json,
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return ContactOut.model_validate(contact).model_dump()


@router.get("/contacts/{contact_id}", summary="Get contact with related leads")
async def get_contact(
    contact_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    query = (
        select(Contact)
        .where(Contact.id == contact_id, Contact.is_active == True)  # noqa: E712
        .options(selectinload(Contact.leads))
    )
    result = await db.execute(query)
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")

    data = ContactOut.model_validate(contact).model_dump()
    data["leads"] = [LeadOut.model_validate(l) for l in contact.leads]
    return data


@router.put("/contacts/{contact_id}", summary="Update a contact")
async def update_contact(
    contact_id: uuid.UUID,
    payload: ContactUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    contact = await db.get(Contact, contact_id)
    if not contact or not contact.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(contact, field, value)

    await db.commit()
    await db.refresh(contact)
    return ContactOut.model_validate(contact).model_dump()


@router.delete(
    "/contacts/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete a contact",
)
async def delete_contact(
    contact_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    contact = await db.get(Contact, contact_id)
    if not contact or not contact.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")

    contact.is_active = False
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Lead endpoints ─────────────────────────────────────────────────────────────

@router.get("/leads", summary="List leads")
async def list_leads(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status", description="Filter by lead status"),
    assigned_to: uuid.UUID | None = Query(None, description="Filter by assigned user"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Lead)

    if status_filter:
        query = query.where(Lead.status == status_filter)
    if assigned_to:
        query = query.where(Lead.assigned_to == assigned_to)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Page
    query = query.order_by(Lead.updated_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    leads = result.scalars().all()
    return {
        "total": total,
        "leads": [LeadOut.model_validate(l) for l in leads],
    }


@router.post("/leads", status_code=status.HTTP_201_CREATED, summary="Create a lead")
async def create_lead(
    payload: LeadCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    lead = Lead(
        title=payload.title,
        contact_id=payload.contact_id,
        status=payload.status,
        source=payload.source,
        estimated_value=payload.estimated_value,
        currency=payload.currency,
        notes=payload.notes,
        assigned_to=payload.assigned_to,
        owner_id=current_user.id,
    )
    db.add(lead)
    await db.commit()
    await db.refresh(lead)

    await event_bus.publish("lead.created", {
        "lead_id": str(lead.id),
        "title": lead.title,
        "owner_id": str(lead.owner_id),
    })

    return LeadOut.model_validate(lead).model_dump()


@router.get("/leads/{lead_id}", summary="Get lead with contact and opportunities")
async def get_lead(
    lead_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    query = (
        select(Lead)
        .where(Lead.id == lead_id)
        .options(selectinload(Lead.contact), selectinload(Lead.opportunities))
    )
    result = await db.execute(query)
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    data = LeadOut.model_validate(lead).model_dump()
    if lead.contact:
        data["contact"] = ContactOut.model_validate(lead.contact).model_dump()
    else:
        data["contact"] = None
    data["opportunities"] = [OpportunityOut.model_validate(o) for o in lead.opportunities]
    return data


@router.put("/leads/{lead_id}", summary="Update a lead")
async def update_lead(
    lead_id: uuid.UUID,
    payload: LeadUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(lead, field, value)

    await db.commit()
    await db.refresh(lead)
    return LeadOut.model_validate(lead).model_dump()


@router.post("/leads/{lead_id}/convert", summary="Convert lead to opportunity")
async def convert_lead(
    lead_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    if lead.status == "converted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lead is already converted",
        )

    opportunity = Opportunity(
        title=lead.title,
        lead_id=lead.id,
        stage="prospecting",
        expected_value=lead.estimated_value,
        currency=lead.currency,
        assigned_to=lead.assigned_to,
        owner_id=current_user.id,
    )
    db.add(opportunity)

    lead.status = "converted"
    await db.commit()
    await db.refresh(opportunity)

    await event_bus.publish("lead.converted", {
        "lead_id": str(lead.id),
        "opportunity_id": str(opportunity.id),
        "owner_id": str(current_user.id),
    })

    return OpportunityOut.model_validate(opportunity).model_dump()


# ── Opportunity endpoints ──────────────────────────────────────────────────────

@router.get("/opportunities", summary="List opportunities")
async def list_opportunities(
    current_user: CurrentUser,
    db: DBSession,
    stage: str | None = Query(None, description="Filter by stage"),
    assigned_to: uuid.UUID | None = Query(None, description="Filter by assigned user"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Opportunity)

    if stage:
        query = query.where(Opportunity.stage == stage)
    if assigned_to:
        query = query.where(Opportunity.assigned_to == assigned_to)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Page
    query = query.order_by(Opportunity.updated_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    opportunities = result.scalars().all()
    return {
        "total": total,
        "opportunities": [OpportunityOut.model_validate(o) for o in opportunities],
    }


@router.post(
    "/opportunities",
    status_code=status.HTTP_201_CREATED,
    summary="Create an opportunity",
)
async def create_opportunity(
    payload: OpportunityCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    opportunity = Opportunity(
        title=payload.title,
        lead_id=payload.lead_id,
        stage=payload.stage,
        probability=payload.probability,
        expected_value=payload.expected_value,
        currency=payload.currency,
        expected_close_date=payload.expected_close_date,
        notes=payload.notes,
        assigned_to=payload.assigned_to,
        owner_id=current_user.id,
    )
    db.add(opportunity)
    await db.commit()
    await db.refresh(opportunity)
    return OpportunityOut.model_validate(opportunity).model_dump()


@router.get("/opportunities/{opportunity_id}", summary="Get opportunity with lead and deals")
async def get_opportunity(
    opportunity_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    query = (
        select(Opportunity)
        .where(Opportunity.id == opportunity_id)
        .options(selectinload(Opportunity.lead), selectinload(Opportunity.deals))
    )
    result = await db.execute(query)
    opportunity = result.scalar_one_or_none()
    if not opportunity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")

    data = OpportunityOut.model_validate(opportunity).model_dump()
    if opportunity.lead:
        data["lead"] = LeadOut.model_validate(opportunity.lead).model_dump()
    else:
        data["lead"] = None
    data["deals"] = [DealOut.model_validate(d) for d in opportunity.deals]
    return data


@router.put("/opportunities/{opportunity_id}", summary="Update an opportunity")
async def update_opportunity(
    opportunity_id: uuid.UUID,
    payload: OpportunityUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    opportunity = await db.get(Opportunity, opportunity_id)
    if not opportunity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")

    old_stage = opportunity.stage

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(opportunity, field, value)

    await db.commit()
    await db.refresh(opportunity)

    if payload.stage and payload.stage != old_stage:
        await event_bus.publish("opportunity.stage_changed", {
            "opportunity_id": str(opportunity.id),
            "old_stage": old_stage,
            "new_stage": opportunity.stage,
            "owner_id": str(opportunity.owner_id),
        })

    return OpportunityOut.model_validate(opportunity).model_dump()


@router.post(
    "/opportunities/{opportunity_id}/close-won",
    summary="Close opportunity as won — creates a deal",
)
async def close_won(
    opportunity_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    opportunity = await db.get(Opportunity, opportunity_id)
    if not opportunity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
    if opportunity.stage in ("closed_won", "closed_lost"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Opportunity is already {opportunity.stage}",
        )

    deal = Deal(
        title=opportunity.title,
        opportunity_id=opportunity.id,
        deal_value=opportunity.expected_value or Decimal("0"),
        currency=opportunity.currency,
        close_date=date.today(),
        status="active",
        owner_id=current_user.id,
    )
    db.add(deal)

    opportunity.stage = "closed_won"
    await db.commit()
    await db.refresh(deal)

    await event_bus.publish("deal.closed", {
        "deal_id": str(deal.id),
        "opportunity_id": str(opportunity.id),
        "deal_value": str(deal.deal_value),
        "owner_id": str(current_user.id),
    })

    return DealOut.model_validate(deal).model_dump()


@router.post(
    "/opportunities/{opportunity_id}/close-lost",
    summary="Close opportunity as lost",
)
async def close_lost(
    opportunity_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    opportunity = await db.get(Opportunity, opportunity_id)
    if not opportunity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
    if opportunity.stage in ("closed_won", "closed_lost"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Opportunity is already {opportunity.stage}",
        )

    opportunity.stage = "closed_lost"
    await db.commit()
    await db.refresh(opportunity)
    return OpportunityOut.model_validate(opportunity).model_dump()


# ── Deal endpoints ─────────────────────────────────────────────────────────────

@router.get("/deals", summary="List deals")
async def list_deals(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status", description="Filter by deal status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Deal)

    if status_filter:
        query = query.where(Deal.status == status_filter)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Page
    query = query.order_by(Deal.updated_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    deals = result.scalars().all()
    return {
        "total": total,
        "deals": [DealOut.model_validate(d) for d in deals],
    }


# ── Pipeline view ──────────────────────────────────────────────────────────────

@router.get("/pipeline", summary="Pipeline view — opportunities grouped by stage")
async def pipeline_view(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    query = (
        select(
            Opportunity.stage,
            func.count(Opportunity.id).label("count"),
            func.coalesce(func.sum(Opportunity.expected_value), 0).label("total_value"),
        )
        .where(Opportunity.stage.notin_(["closed_won", "closed_lost"]))
        .group_by(Opportunity.stage)
        .order_by(Opportunity.stage)
    )
    result = await db.execute(query)
    rows = result.all()

    stages = [
        {"stage": row.stage, "count": row.count, "total_value": float(row.total_value)}
        for row in rows
    ]
    return {"stages": stages}


# ── Dashboard ──────────────────────────────────────────────────────────────────

@router.get("/dashboard", summary="CRM dashboard stats")
async def dashboard(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    current_month = now.month
    current_year = now.year

    # Total active contacts
    total_contacts_result = await db.execute(
        select(func.count()).select_from(Contact).where(Contact.is_active == True)  # noqa: E712
    )
    total_contacts = total_contacts_result.scalar() or 0

    # New leads this month
    new_leads_result = await db.execute(
        select(func.count()).select_from(Lead).where(
            extract("month", Lead.created_at) == current_month,
            extract("year", Lead.created_at) == current_year,
        )
    )
    new_leads_this_month = new_leads_result.scalar() or 0

    # Pipeline value (sum of all non-closed opportunities)
    pipeline_result = await db.execute(
        select(func.coalesce(func.sum(Opportunity.expected_value), 0)).where(
            Opportunity.stage.notin_(["closed_won", "closed_lost"])
        )
    )
    pipeline_value = float(pipeline_result.scalar() or 0)

    # Deals closed this month (count + value)
    deals_this_month_result = await db.execute(
        select(
            func.count(Deal.id).label("count"),
            func.coalesce(func.sum(Deal.deal_value), 0).label("value"),
        ).where(
            extract("month", Deal.close_date) == current_month,
            extract("year", Deal.close_date) == current_year,
        )
    )
    deals_row = deals_this_month_result.one()
    deals_closed_this_month = {
        "count": deals_row.count,
        "value": float(deals_row.value),
    }

    # Conversion rate (leads converted / total leads * 100)
    total_leads_result = await db.execute(
        select(func.count()).select_from(Lead)
    )
    total_leads = total_leads_result.scalar() or 0

    converted_leads_result = await db.execute(
        select(func.count()).select_from(Lead).where(Lead.status == "converted")
    )
    converted_leads = converted_leads_result.scalar() or 0

    conversion_rate = round((converted_leads / total_leads * 100), 2) if total_leads > 0 else 0.0

    return {
        "total_contacts": total_contacts,
        "new_leads_this_month": new_leads_this_month,
        "pipeline_value": pipeline_value,
        "deals_closed_this_month": deals_closed_this_month,
        "conversion_rate": conversion_rate,
    }


# NOTE: CSV export + import moved to crm_ext.py
