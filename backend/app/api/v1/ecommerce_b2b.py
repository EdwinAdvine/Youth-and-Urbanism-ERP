"""E-Commerce B2B API — companies, pricing tiers, quotes."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession
from app.models.ecommerce_b2b import EcomCompany, EcomCompanyMember, PricingTier, QuoteRequest, QuoteItem
from app.models.ecommerce import EcomProduct, EcomOrder, OrderLine

router = APIRouter(tags=["E-Commerce B2B"])


# ── Companies ─────────────────────────────────────────────────────────────────

@router.post("/b2b/companies", status_code=201)
async def register_company(
    data: dict,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Register a B2B company account."""
    company = EcomCompany(
        name=data["name"],
        tax_id=data.get("tax_id"),
        contact_email=data.get("contact_email"),
        contact_phone=data.get("contact_phone"),
        address=data.get("address"),
        notes=data.get("notes"),
        credit_limit=Decimal(str(data.get("credit_limit", 0))),
        payment_terms=data.get("payment_terms", "COD"),
        is_approved=False,
    )
    db.add(company)
    await db.commit()
    await db.refresh(company)
    return {"id": str(company.id), "name": company.name, "status": "pending_approval"}


@router.get("/b2b/companies")
async def list_companies(
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
    is_approved: bool | None = None,
    skip: int = 0,
    limit: int = 50,
):
    """List all B2B companies (admin)."""
    q = select(EcomCompany)
    if is_approved is not None:
        q = q.where(EcomCompany.is_approved == is_approved)
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    companies = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "name": c.name,
            "tax_id": c.tax_id,
            "contact_email": c.contact_email,
            "payment_terms": c.payment_terms,
            "credit_limit": float(c.credit_limit),
            "is_approved": c.is_approved,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in companies
    ]


@router.get("/b2b/companies/{company_id}")
async def get_company(
    company_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Get B2B company detail."""
    result = await db.execute(select(EcomCompany).where(EcomCompany.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return {
        "id": str(company.id),
        "name": company.name,
        "tax_id": company.tax_id,
        "contact_email": company.contact_email,
        "contact_phone": company.contact_phone,
        "address": company.address,
        "payment_terms": company.payment_terms,
        "credit_limit": float(company.credit_limit),
        "is_approved": company.is_approved,
        "notes": company.notes,
        "members": [
            {"id": str(m.id), "customer_id": str(m.customer_id), "role": m.role}
            for m in company.members
        ],
        "created_at": company.created_at.isoformat() if company.created_at else None,
    }


@router.put("/b2b/companies/{company_id}/approve")
async def approve_company(
    company_id: uuid.UUID,
    data: dict,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Approve or reject a B2B company."""
    result = await db.execute(select(EcomCompany).where(EcomCompany.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    company.is_approved = data.get("is_approved", True)
    if data.get("credit_limit") is not None:
        company.credit_limit = Decimal(str(data["credit_limit"]))
    if data.get("payment_terms"):
        company.payment_terms = data["payment_terms"]
    company.approved_by = current_user.id
    await db.commit()
    return {"id": str(company.id), "is_approved": company.is_approved}


@router.put("/b2b/companies/{company_id}")
async def update_company(
    company_id: uuid.UUID,
    data: dict,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Update B2B company details."""
    result = await db.execute(select(EcomCompany).where(EcomCompany.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    for field in ["name", "tax_id", "contact_email", "contact_phone", "address", "notes", "payment_terms"]:
        if field in data:
            setattr(company, field, data[field])
    if "credit_limit" in data:
        company.credit_limit = Decimal(str(data["credit_limit"]))
    await db.commit()
    return {"id": str(company.id), "name": company.name}


@router.post("/b2b/companies/{company_id}/members")
async def add_company_member(
    company_id: uuid.UUID,
    data: dict,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Add a customer as a member of a B2B company."""
    member = EcomCompanyMember(
        company_id=company_id,
        customer_id=uuid.UUID(data["customer_id"]),
        role=data.get("role", "buyer"),
    )
    db.add(member)
    await db.commit()
    return {"id": str(member.id), "role": member.role}


# ── Pricing Tiers ─────────────────────────────────────────────────────────────

@router.get("/b2b/pricing-tiers")
async def list_pricing_tiers(
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
    company_id: uuid.UUID | None = None,
):
    """List pricing tiers."""
    q = select(PricingTier).where(PricingTier.is_active == True)
    if company_id:
        q = q.where(PricingTier.company_id == company_id)
    result = await db.execute(q)
    tiers = result.scalars().all()
    return [
        {
            "id": str(t.id),
            "name": t.name,
            "min_order_qty": t.min_order_qty,
            "discount_pct": float(t.discount_pct),
            "fixed_price_override": float(t.fixed_price_override) if t.fixed_price_override else None,
            "product_id": str(t.product_id) if t.product_id else None,
            "company_id": str(t.company_id) if t.company_id else None,
            "is_active": t.is_active,
        }
        for t in tiers
    ]


@router.post("/b2b/pricing-tiers", status_code=201)
async def create_pricing_tier(
    data: dict,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Create a pricing tier."""
    tier = PricingTier(
        name=data["name"],
        min_order_qty=data.get("min_order_qty", 1),
        discount_pct=Decimal(str(data.get("discount_pct", 0))),
        fixed_price_override=Decimal(str(data["fixed_price_override"])) if data.get("fixed_price_override") else None,
        product_id=uuid.UUID(data["product_id"]) if data.get("product_id") else None,
        company_id=uuid.UUID(data["company_id"]) if data.get("company_id") else None,
        is_active=data.get("is_active", True),
    )
    db.add(tier)
    await db.commit()
    await db.refresh(tier)
    return {"id": str(tier.id), "name": tier.name}


@router.put("/b2b/pricing-tiers/{tier_id}")
async def update_pricing_tier(
    tier_id: uuid.UUID,
    data: dict,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Update a pricing tier."""
    result = await db.execute(select(PricingTier).where(PricingTier.id == tier_id))
    tier = result.scalar_one_or_none()
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")
    for field in ["name", "min_order_qty", "is_active"]:
        if field in data:
            setattr(tier, field, data[field])
    if "discount_pct" in data:
        tier.discount_pct = Decimal(str(data["discount_pct"]))
    await db.commit()
    return {"id": str(tier.id), "name": tier.name}


@router.delete("/b2b/pricing-tiers/{tier_id}", status_code=204)
async def delete_pricing_tier(
    tier_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Delete a pricing tier."""
    result = await db.execute(select(PricingTier).where(PricingTier.id == tier_id))
    tier = result.scalar_one_or_none()
    if tier:
        await db.delete(tier)
        await db.commit()


# ── Quotes ────────────────────────────────────────────────────────────────────

@router.post("/b2b/quotes", status_code=201)
async def create_quote(
    data: dict,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Create a B2B quote request."""
    quote = QuoteRequest(
        company_id=uuid.UUID(data["company_id"]),
        requested_by=uuid.UUID(data["customer_id"]),
        notes=data.get("notes"),
        po_number=data.get("po_number"),
        valid_until=datetime.fromisoformat(data["valid_until"]) if data.get("valid_until") else None,
        status="submitted" if data.get("submit") else "draft",
    )
    db.add(quote)
    await db.flush()

    for item_data in data.get("items", []):
        item = QuoteItem(
            quote_id=quote.id,
            product_id=uuid.UUID(item_data["product_id"]),
            quantity=item_data.get("quantity", 1),
            requested_price=Decimal(str(item_data["requested_price"])) if item_data.get("requested_price") else None,
        )
        db.add(item)

    await db.commit()
    await db.refresh(quote)
    return {"id": str(quote.id), "status": quote.status}


@router.get("/b2b/quotes")
async def list_quotes(
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
    status: str | None = None,
    company_id: uuid.UUID | None = None,
    skip: int = 0,
    limit: int = 50,
):
    """List B2B quotes."""
    q = select(QuoteRequest)
    if status:
        q = q.where(QuoteRequest.status == status)
    if company_id:
        q = q.where(QuoteRequest.company_id == company_id)
    q = q.order_by(QuoteRequest.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    quotes = result.scalars().all()
    return [
        {
            "id": str(qt.id),
            "company_id": str(qt.company_id),
            "company_name": qt.company.name if qt.company else None,
            "status": qt.status,
            "po_number": qt.po_number,
            "items_count": len(qt.items),
            "valid_until": qt.valid_until.isoformat() if qt.valid_until else None,
            "created_at": qt.created_at.isoformat() if qt.created_at else None,
        }
        for qt in quotes
    ]


@router.get("/b2b/quotes/{quote_id}")
async def get_quote(
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Get a single B2B quote with its line items."""
    result = await db.execute(select(QuoteRequest).where(QuoteRequest.id == quote_id))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return {
        "id": str(quote.id),
        "company_id": str(quote.company_id),
        "company_name": quote.company.name if quote.company else None,
        "status": quote.status,
        "notes": quote.notes,
        "admin_notes": quote.admin_notes,
        "po_number": quote.po_number,
        "valid_until": quote.valid_until.isoformat() if quote.valid_until else None,
        "converted_order_id": str(quote.converted_order_id) if quote.converted_order_id else None,
        "items": [
            {
                "id": str(i.id),
                "product_id": str(i.product_id),
                "product_name": i.product.display_name if i.product else None,
                "quantity": i.quantity,
                "requested_price": float(i.requested_price) if i.requested_price else None,
                "approved_price": float(i.approved_price) if i.approved_price else None,
            }
            for i in quote.items
        ],
        "created_at": quote.created_at.isoformat() if quote.created_at else None,
    }


@router.put("/b2b/quotes/{quote_id}/review")
async def review_quote(
    quote_id: uuid.UUID,
    data: dict,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Admin review: set approved prices per item."""
    result = await db.execute(select(QuoteRequest).where(QuoteRequest.id == quote_id))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    quote.status = data.get("status", "reviewed")
    if data.get("admin_notes"):
        quote.admin_notes = data["admin_notes"]

    for item_update in data.get("items", []):
        item_result = await db.execute(
            select(QuoteItem).where(QuoteItem.id == uuid.UUID(item_update["id"]))
        )
        item = item_result.scalar_one_or_none()
        if item and "approved_price" in item_update:
            item.approved_price = Decimal(str(item_update["approved_price"]))

    await db.commit()
    return {"id": str(quote.id), "status": quote.status}


@router.post("/b2b/quotes/{quote_id}/convert")
async def convert_quote_to_order(
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Convert an approved quote into an e-commerce order."""
    import random
    import string

    result = await db.execute(select(QuoteRequest).where(QuoteRequest.id == quote_id))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    if quote.status not in ("approved", "reviewed"):
        raise HTTPException(status_code=400, detail="Quote must be approved before converting")

    from app.models.ecommerce import Store, OrderLine as OL

    store_result = await db.execute(select(Store).limit(1))
    store = store_result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=400, detail="No store configured")

    order_number = "B2B-" + "".join(random.choices(string.digits, k=8))
    subtotal = sum(
        (i.approved_price or i.requested_price or Decimal("0")) * i.quantity
        for i in quote.items
    )
    order = EcomOrder(
        store_id=store.id,
        customer_id=quote.requested_by,
        order_number=order_number,
        subtotal=subtotal,
        total=subtotal,
        status="confirmed",
        po_number=quote.po_number,
        notes=f"Converted from quote {quote.id}",
    )
    db.add(order)
    await db.flush()

    for qi in quote.items:
        price = qi.approved_price or qi.requested_price or Decimal("0")
        line = OL(
            order_id=order.id,
            product_id=qi.product_id,
            product_name=qi.product.display_name if qi.product else "Product",
            quantity=qi.quantity,
            unit_price=price,
            total=price * qi.quantity,
        )
        db.add(line)

    quote.status = "converted"
    quote.converted_order_id = order.id
    await db.commit()
    return {"order_id": str(order.id), "order_number": order_number}
