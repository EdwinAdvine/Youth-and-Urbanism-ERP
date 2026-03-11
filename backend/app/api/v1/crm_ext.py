"""CRM Extensions — campaigns, quotes, products, reports, contact import/export."""
from __future__ import annotations

import csv
import io
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.core.sanitize import like_pattern
from app.models.crm import (
    Campaign,
    CampaignContact,
    Contact,
    CRMProduct,
    Deal,
    Lead,
    Opportunity,
    Quote,
)

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

# -- Campaign schemas --

class CampaignCreate(BaseModel):
    name: str
    campaign_type: str = "email"
    status: str = "draft"
    budget: Decimal | None = None
    spent: Decimal = Decimal("0")
    start_date: date | None = None
    end_date: date | None = None
    description: str | None = None


class CampaignUpdate(BaseModel):
    name: str | None = None
    campaign_type: str | None = None
    status: str | None = None
    budget: Decimal | None = None
    spent: Decimal | None = None
    start_date: date | None = None
    end_date: date | None = None
    description: str | None = None


class CampaignOut(BaseModel):
    id: uuid.UUID
    name: str
    campaign_type: str
    status: str
    budget: Decimal | None
    spent: Decimal
    start_date: date | None
    end_date: date | None
    description: str | None
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Quote schemas --

class QuoteCreate(BaseModel):
    deal_id: uuid.UUID | None = None
    contact_id: uuid.UUID
    quote_number: str
    items: list[dict] | None = None
    subtotal: Decimal
    tax_amount: Decimal = Decimal("0")
    total: Decimal
    status: str = "draft"
    valid_until: date | None = None
    notes: str | None = None


class QuoteUpdate(BaseModel):
    deal_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    quote_number: str | None = None
    items: list[dict] | None = None
    subtotal: Decimal | None = None
    tax_amount: Decimal | None = None
    total: Decimal | None = None
    status: str | None = None
    valid_until: date | None = None
    notes: str | None = None


class QuoteOut(BaseModel):
    id: uuid.UUID
    deal_id: uuid.UUID | None
    contact_id: uuid.UUID
    quote_number: str
    items: list[dict] | None
    subtotal: Decimal
    tax_amount: Decimal
    total: Decimal
    status: str
    valid_until: date | None
    notes: str | None
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Product schemas --

class ProductCreate(BaseModel):
    name: str
    description: str | None = None
    price: Decimal
    sku: str
    category: str | None = None
    is_active: bool = True


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: Decimal | None = None
    sku: str | None = None
    category: str | None = None
    is_active: bool | None = None


class ProductOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    price: Decimal
    sku: str
    category: str | None
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Campaign endpoints ─────────────────────────────────────────────────────────

@router.get("/campaigns", summary="List campaigns")
async def list_campaigns(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    campaign_type: str | None = Query(None, description="Filter by campaign type"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Campaign)

    if status_filter:
        query = query.where(Campaign.status == status_filter)
    if campaign_type:
        query = query.where(Campaign.campaign_type == campaign_type)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Campaign.updated_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    campaigns = result.scalars().all()
    return {
        "total": total,
        "campaigns": [CampaignOut.model_validate(c) for c in campaigns],
    }


@router.post("/campaigns", status_code=status.HTTP_201_CREATED, summary="Create a campaign")
async def create_campaign(
    payload: CampaignCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    campaign = Campaign(
        name=payload.name,
        campaign_type=payload.campaign_type,
        status=payload.status,
        budget=payload.budget,
        spent=payload.spent,
        start_date=payload.start_date,
        end_date=payload.end_date,
        description=payload.description,
        owner_id=current_user.id,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    await event_bus.publish("campaign.created", {
        "campaign_id": str(campaign.id),
        "name": campaign.name,
        "owner_id": str(campaign.owner_id),
    })

    return CampaignOut.model_validate(campaign).model_dump()


@router.get("/campaigns/{campaign_id}", summary="Get campaign detail")
async def get_campaign(
    campaign_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    query = (
        select(Campaign)
        .where(Campaign.id == campaign_id)
        .options(selectinload(Campaign.campaign_contacts))
    )
    result = await db.execute(query)
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    data = CampaignOut.model_validate(campaign).model_dump()
    data["contacts_count"] = len(campaign.campaign_contacts)
    return data


@router.put("/campaigns/{campaign_id}", summary="Update a campaign")
async def update_campaign(
    campaign_id: uuid.UUID,
    payload: CampaignUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(campaign, field, value)

    await db.commit()
    await db.refresh(campaign)
    return CampaignOut.model_validate(campaign).model_dump()


@router.delete(
    "/campaigns/{campaign_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a campaign",
)
async def delete_campaign(
    campaign_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    await db.delete(campaign)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/campaigns/{campaign_id}/analytics", summary="Campaign analytics")
async def campaign_analytics(
    campaign_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    # Aggregate contact statuses
    status_counts_query = (
        select(
            CampaignContact.status,
            func.count(CampaignContact.id).label("count"),
        )
        .where(CampaignContact.campaign_id == campaign_id)
        .group_by(CampaignContact.status)
    )
    result = await db.execute(status_counts_query)
    status_rows = result.all()

    total_contacts = sum(r.count for r in status_rows)
    status_breakdown = {r.status: r.count for r in status_rows}

    sent = status_breakdown.get("sent", 0) + status_breakdown.get("opened", 0) + status_breakdown.get("clicked", 0) + status_breakdown.get("converted", 0)
    opened = status_breakdown.get("opened", 0) + status_breakdown.get("clicked", 0) + status_breakdown.get("converted", 0)
    clicked = status_breakdown.get("clicked", 0) + status_breakdown.get("converted", 0)
    converted = status_breakdown.get("converted", 0)

    return {
        "campaign_id": str(campaign_id),
        "name": campaign.name,
        "total_contacts": total_contacts,
        "status_breakdown": status_breakdown,
        "sent": sent,
        "open_rate": round((opened / sent * 100), 2) if sent > 0 else 0.0,
        "click_rate": round((clicked / sent * 100), 2) if sent > 0 else 0.0,
        "conversion_rate": round((converted / total_contacts * 100), 2) if total_contacts > 0 else 0.0,
        "budget": float(campaign.budget) if campaign.budget else None,
        "spent": float(campaign.spent),
        "roi": round(float(campaign.budget - campaign.spent), 2) if campaign.budget else None,
    }


@router.post("/campaigns/{campaign_id}/send", summary="Send campaign to contacts")
async def send_campaign(
    campaign_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    if campaign.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Campaign is already completed",
        )

    # Mark all pending contacts as sent
    now = datetime.now(timezone.utc)
    pending_query = select(CampaignContact).where(
        CampaignContact.campaign_id == campaign_id,
        CampaignContact.status == "pending",
    )
    result = await db.execute(pending_query)
    pending_contacts = result.scalars().all()

    sent_count = 0
    for cc in pending_contacts:
        cc.status = "sent"
        cc.sent_at = now
        sent_count += 1

    campaign.status = "active"
    await db.commit()

    await event_bus.publish("campaign.sent", {
        "campaign_id": str(campaign_id),
        "sent_count": sent_count,
        "owner_id": str(campaign.owner_id),
    })

    return {"campaign_id": str(campaign_id), "sent_count": sent_count}


# ── Quote endpoints ────────────────────────────────────────────────────────────

@router.get("/quotes", summary="List quotes")
async def list_quotes(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    contact_id: uuid.UUID | None = Query(None, description="Filter by contact"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Quote)

    if status_filter:
        query = query.where(Quote.status == status_filter)
    if contact_id:
        query = query.where(Quote.contact_id == contact_id)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Quote.updated_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    quotes = result.scalars().all()
    return {
        "total": total,
        "quotes": [QuoteOut.model_validate(q) for q in quotes],
    }


@router.post("/quotes", status_code=status.HTTP_201_CREATED, summary="Create a quote")
async def create_quote(
    payload: QuoteCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Validate contact exists
    contact = await db.get(Contact, payload.contact_id)
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")

    quote = Quote(
        deal_id=payload.deal_id,
        contact_id=payload.contact_id,
        quote_number=payload.quote_number,
        items=payload.items,
        subtotal=payload.subtotal,
        tax_amount=payload.tax_amount,
        total=payload.total,
        status=payload.status,
        valid_until=payload.valid_until,
        notes=payload.notes,
        owner_id=current_user.id,
    )
    db.add(quote)
    await db.commit()
    await db.refresh(quote)

    await event_bus.publish("quote.created", {
        "quote_id": str(quote.id),
        "quote_number": quote.quote_number,
        "total": str(quote.total),
        "owner_id": str(quote.owner_id),
    })

    return QuoteOut.model_validate(quote).model_dump()


@router.get("/quotes/{quote_id}", summary="Get quote detail")
async def get_quote(
    quote_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    query = (
        select(Quote)
        .where(Quote.id == quote_id)
        .options(selectinload(Quote.contact), selectinload(Quote.deal))
    )
    result = await db.execute(query)
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")

    data = QuoteOut.model_validate(quote).model_dump()
    if quote.contact:
        data["contact_name"] = f"{quote.contact.first_name or ''} {quote.contact.last_name or ''}".strip()
    if quote.deal:
        data["deal_title"] = quote.deal.title
    return data


@router.put("/quotes/{quote_id}", summary="Update a quote")
async def update_quote(
    quote_id: uuid.UUID,
    payload: QuoteUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    quote = await db.get(Quote, quote_id)
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(quote, field, value)

    await db.commit()
    await db.refresh(quote)
    return QuoteOut.model_validate(quote).model_dump()


@router.post("/quotes/{quote_id}/send", summary="Mark quote as sent")
async def send_quote(
    quote_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    quote = await db.get(Quote, quote_id)
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    if quote.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quote is already {quote.status}",
        )

    quote.status = "sent"
    await db.commit()
    await db.refresh(quote)

    await event_bus.publish("quote.sent", {
        "quote_id": str(quote.id),
        "quote_number": quote.quote_number,
        "contact_id": str(quote.contact_id),
        "owner_id": str(quote.owner_id),
    })

    return QuoteOut.model_validate(quote).model_dump()


# ── Product endpoints ──────────────────────────────────────────────────────────

@router.get("/products", summary="List products")
async def list_products(
    current_user: CurrentUser,
    db: DBSession,
    category: str | None = Query(None, description="Filter by category"),
    active_only: bool = Query(True, description="Only active products"),
    search: str | None = Query(None, description="Search name or SKU"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(CRMProduct)

    if active_only:
        query = query.where(CRMProduct.is_active == True)  # noqa: E712
    if category:
        query = query.where(CRMProduct.category == category)
    if search:
        safe_pat = like_pattern(search)
        from sqlalchemy import or_
        query = query.where(
            or_(
                CRMProduct.name.ilike(safe_pat),
                CRMProduct.sku.ilike(safe_pat),
            )
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(CRMProduct.updated_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    products = result.scalars().all()
    return {
        "total": total,
        "products": [ProductOut.model_validate(p) for p in products],
    }


@router.post("/products", status_code=status.HTTP_201_CREATED, summary="Create a product")
async def create_product(
    payload: ProductCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    product = CRMProduct(
        name=payload.name,
        description=payload.description,
        price=payload.price,
        sku=payload.sku,
        category=payload.category,
        is_active=payload.is_active,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return ProductOut.model_validate(product).model_dump()


@router.get("/products/{product_id}", summary="Get product detail")
async def get_product(
    product_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    product = await db.get(CRMProduct, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return ProductOut.model_validate(product).model_dump()


@router.put("/products/{product_id}", summary="Update a product")
async def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    product = await db.get(CRMProduct, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(product, field, value)

    await db.commit()
    await db.refresh(product)
    return ProductOut.model_validate(product).model_dump()


@router.delete(
    "/products/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a product",
)
async def delete_product(
    product_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    product = await db.get(CRMProduct, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    await db.delete(product)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Reports ────────────────────────────────────────────────────────────────────

@router.get("/reports/pipeline", summary="Pipeline conversion rates per stage")
async def pipeline_report(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Conversion rates: how many opportunities move from one stage to the next."""
    stages_ordered = ["prospecting", "proposal", "negotiation", "closed_won", "closed_lost"]

    # Count per stage
    stage_counts_query = (
        select(
            Opportunity.stage,
            func.count(Opportunity.id).label("count"),
            func.coalesce(func.sum(Opportunity.expected_value), 0).label("total_value"),
        )
        .group_by(Opportunity.stage)
    )
    result = await db.execute(stage_counts_query)
    rows = result.all()

    stage_map = {r.stage: {"count": r.count, "total_value": float(r.total_value)} for r in rows}
    total_opps = sum(d["count"] for d in stage_map.values())

    stages = []
    for s in stages_ordered:
        data = stage_map.get(s, {"count": 0, "total_value": 0.0})
        stages.append({
            "stage": s,
            "count": data["count"],
            "total_value": data["total_value"],
            "conversion_rate": round((data["count"] / total_opps * 100), 2) if total_opps > 0 else 0.0,
        })

    # Overall win rate
    won = stage_map.get("closed_won", {"count": 0})["count"]
    lost = stage_map.get("closed_lost", {"count": 0})["count"]
    closed = won + lost
    win_rate = round((won / closed * 100), 2) if closed > 0 else 0.0

    return {
        "total_opportunities": total_opps,
        "stages": stages,
        "win_rate": win_rate,
    }


@router.get("/reports/sales-forecast", summary="Sales forecast based on pipeline")
async def sales_forecast(
    current_user: CurrentUser,
    db: DBSession,
    months_ahead: int = Query(3, ge=1, le=12, description="Months to forecast"),
) -> dict[str, Any]:
    """Weighted forecast: expected_value * probability / 100 for open opportunities."""
    now = datetime.now(timezone.utc).date()

    forecasts = []
    for i in range(months_ahead):
        month_start = date(now.year, now.month, 1) + timedelta(days=32 * i)
        month_start = month_start.replace(day=1)
        if month_start.month == 12:
            month_end = date(month_start.year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = date(month_start.year, month_start.month + 1, 1) - timedelta(days=1)

        query = (
            select(
                func.count(Opportunity.id).label("count"),
                func.coalesce(func.sum(Opportunity.expected_value), 0).label("total_value"),
                func.coalesce(
                    func.sum(Opportunity.expected_value * Opportunity.probability / 100), 0
                ).label("weighted_value"),
            )
            .where(
                Opportunity.stage.notin_(["closed_won", "closed_lost"]),
                Opportunity.expected_close_date >= month_start,
                Opportunity.expected_close_date <= month_end,
            )
        )
        result = await db.execute(query)
        row = result.one()

        forecasts.append({
            "month": month_start.strftime("%Y-%m"),
            "opportunity_count": row.count,
            "total_value": float(row.total_value),
            "weighted_value": float(row.weighted_value),
        })

    return {"forecasts": forecasts}


@router.get("/contacts/{contact_id}/timeline", summary="Contact activity timeline")
async def contact_timeline(
    contact_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Aggregate all CRM activities for a contact: leads, opportunities, deals, quotes, campaigns."""
    contact = await db.get(Contact, contact_id)
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")

    timeline: list[dict[str, Any]] = []

    # Leads
    leads_result = await db.execute(
        select(Lead).where(Lead.contact_id == contact_id).order_by(Lead.created_at.desc())
    )
    for lead in leads_result.scalars().all():
        timeline.append({
            "type": "lead",
            "id": str(lead.id),
            "title": lead.title,
            "status": lead.status,
            "value": float(lead.estimated_value) if lead.estimated_value else None,
            "timestamp": lead.created_at.isoformat(),
        })

    # Opportunities via leads
    lead_ids = [t["id"] for t in timeline if t["type"] == "lead"]
    if lead_ids:
        opps_result = await db.execute(
            select(Opportunity).where(
                Opportunity.lead_id.in_([uuid.UUID(lid) for lid in lead_ids])
            ).order_by(Opportunity.created_at.desc())
        )
        for opp in opps_result.scalars().all():
            timeline.append({
                "type": "opportunity",
                "id": str(opp.id),
                "title": opp.title,
                "stage": opp.stage,
                "value": float(opp.expected_value) if opp.expected_value else None,
                "timestamp": opp.created_at.isoformat(),
            })

            # Deals from opportunities
            deals_result = await db.execute(
                select(Deal).where(Deal.opportunity_id == opp.id)
            )
            for deal in deals_result.scalars().all():
                timeline.append({
                    "type": "deal",
                    "id": str(deal.id),
                    "title": deal.title,
                    "value": float(deal.deal_value),
                    "status": deal.status,
                    "timestamp": deal.created_at.isoformat(),
                })

    # Quotes
    quotes_result = await db.execute(
        select(Quote).where(Quote.contact_id == contact_id).order_by(Quote.created_at.desc())
    )
    for quote in quotes_result.scalars().all():
        timeline.append({
            "type": "quote",
            "id": str(quote.id),
            "title": f"Quote #{quote.quote_number}",
            "status": quote.status,
            "value": float(quote.total),
            "timestamp": quote.created_at.isoformat(),
        })

    # Campaigns
    cc_result = await db.execute(
        select(CampaignContact)
        .where(CampaignContact.contact_id == contact_id)
        .options(selectinload(CampaignContact.campaign))
        .order_by(CampaignContact.created_at.desc())
    )
    for cc in cc_result.scalars().all():
        timeline.append({
            "type": "campaign",
            "id": str(cc.campaign_id),
            "title": cc.campaign.name if cc.campaign else "Unknown Campaign",
            "status": cc.status,
            "value": None,
            "timestamp": cc.created_at.isoformat(),
        })

    # Sort by timestamp descending
    timeline.sort(key=lambda x: x["timestamp"], reverse=True)

    return {
        "contact_id": str(contact_id),
        "contact_name": f"{contact.first_name or ''} {contact.last_name or ''}".strip(),
        "timeline": timeline,
    }


# ── Contact Import / Export ────────────────────────────────────────────────────

@router.post("/contacts/import", summary="Import contacts from CSV")
async def import_contacts(
    current_user: CurrentUser,
    db: DBSession,
    file: UploadFile = File(..., description="CSV file with contact data"),
) -> dict[str, Any]:
    """Import contacts from a CSV file. Expected columns: contact_type, first_name, last_name, company_name, email, phone, address, source, tags."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are supported",
        )

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    created = 0
    skipped = 0
    errors: list[dict[str, Any]] = []

    for row_num, row in enumerate(reader, start=2):  # row 1 is header
        try:
            # Normalize keys
            row = {k.strip().lower(): v.strip() if v else "" for k, v in row.items() if k}

            contact = Contact(
                contact_type=row.get("contact_type", "person") or "person",
                first_name=row.get("first_name") or None,
                last_name=row.get("last_name") or None,
                company_name=row.get("company_name") or row.get("company") or None,
                email=row.get("email") or None,
                phone=row.get("phone") or None,
                address=row.get("address") or None,
                source=row.get("source") or "csv_import",
                tags=[t.strip() for t in row.get("tags", "").split(",") if t.strip()] or [],
                owner_id=current_user.id,
            )
            db.add(contact)
            created += 1
        except Exception as e:
            skipped += 1
            errors.append({"row": row_num, "error": str(e)})

    await db.commit()

    return {
        "created": created,
        "skipped": skipped,
        "errors": errors[:20],  # Limit error details
    }


@router.get("/contacts/export", summary="Export contacts as CSV")
async def export_contacts(
    current_user: CurrentUser,
    db: DBSession,
):
    """Download all active contacts as a CSV file."""
    from app.core.export import rows_to_csv  # noqa: PLC0415

    result = await db.execute(
        select(Contact).where(Contact.is_active == True).order_by(Contact.created_at.desc())  # noqa: E712
    )
    contacts = result.scalars().all()
    rows = [
        {
            "contact_type": c.contact_type,
            "first_name": c.first_name or "",
            "last_name": c.last_name or "",
            "company_name": c.company_name or "",
            "email": c.email or "",
            "phone": c.phone or "",
            "address": c.address or "",
            "source": c.source or "",
            "tags": ",".join(c.tags) if c.tags else "",
            "created_at": c.created_at.isoformat(),
        }
        for c in contacts
    ]
    columns = ["contact_type", "first_name", "last_name", "company_name", "email", "phone", "address", "source", "tags", "created_at"]
    return rows_to_csv(rows, columns, "crm_contacts.csv")
