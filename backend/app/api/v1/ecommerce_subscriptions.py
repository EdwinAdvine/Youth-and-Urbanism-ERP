"""E-Commerce Subscriptions API — recurring product subscriptions."""

import uuid
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession
from app.models.ecommerce import CustomerAccount, EcomProduct
from app.models.ecommerce_subscriptions import Subscription, SubscriptionOrder

router = APIRouter(tags=["E-Commerce Subscriptions"])


# ── Create Subscription ───────────────────────────────────────────────────────

@router.post("/subscriptions", status_code=201)
async def create_subscription(
    data: dict,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Create a new product subscription for a customer."""
    product_id = uuid.UUID(data["product_id"])
    customer_id = uuid.UUID(data["customer_id"])

    # Validate product exists
    product_result = await db.execute(
        select(EcomProduct).where(EcomProduct.id == product_id)
    )
    product = product_result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Determine first billing date (default: today)
    first_billing = data.get("next_billing_date")
    if first_billing:
        next_billing = date.fromisoformat(first_billing)
    else:
        next_billing = date.today()

    subscription = Subscription(
        customer_id=customer_id,
        product_id=product_id,
        quantity=data.get("quantity", 1),
        frequency_days=data.get("frequency_days", 30),
        discount_pct=Decimal(str(data.get("discount_pct", 0))),
        status="active",
        next_billing_date=next_billing,
        shipping_address_id=uuid.UUID(data["shipping_address_id"]) if data.get("shipping_address_id") else None,
        payment_gateway_id=uuid.UUID(data["payment_gateway_id"]) if data.get("payment_gateway_id") else None,
        metadata_json=data.get("metadata_json", {}),
    )
    db.add(subscription)
    await db.commit()
    await db.refresh(subscription)

    return {
        "id": str(subscription.id),
        "customer_id": str(subscription.customer_id),
        "product_id": str(subscription.product_id),
        "product_name": product.display_name,
        "quantity": subscription.quantity,
        "frequency_days": subscription.frequency_days,
        "discount_pct": float(subscription.discount_pct),
        "status": subscription.status,
        "next_billing_date": subscription.next_billing_date.isoformat(),
    }


# ── Customer Subscriptions ────────────────────────────────────────────────────

@router.get("/subscriptions")
async def list_my_subscriptions(
    customer_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
    status: str | None = None,
):
    """List subscriptions for a customer."""
    q = select(Subscription).where(Subscription.customer_id == customer_id)
    if status:
        q = q.where(Subscription.status == status)
    q = q.order_by(Subscription.created_at.desc())
    result = await db.execute(q)
    subs = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "product_id": str(s.product_id),
            "product_name": s.product.display_name if s.product else None,
            "product_price": float(s.product.price) if s.product else None,
            "quantity": s.quantity,
            "frequency_days": s.frequency_days,
            "discount_pct": float(s.discount_pct),
            "status": s.status,
            "next_billing_date": s.next_billing_date.isoformat() if s.next_billing_date else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in subs
    ]


# ── Admin: All Subscriptions + MRR ───────────────────────────────────────────

@router.get("/subscriptions/admin")
async def list_all_subscriptions(
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
    status: str | None = None,
    skip: int = 0,
    limit: int = 100,
):
    """Admin: list all subscriptions with customer + product info and MRR."""
    q = select(Subscription)
    if status:
        q = q.where(Subscription.status == status)
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    subs = result.scalars().all()

    # Compute MRR: sum of monthly recurring revenue for active subscriptions
    active_result = await db.execute(
        select(Subscription).where(Subscription.status == "active")
    )
    active_subs = active_result.scalars().all()
    mrr = sum(
        float(s.product.price) * s.quantity * (1 - float(s.discount_pct) / 100) * (30 / s.frequency_days)
        for s in active_subs
        if s.product and s.frequency_days > 0
    )

    items = [
        {
            "id": str(s.id),
            "customer_id": str(s.customer_id),
            "customer_email": s.customer.email if s.customer else None,
            "customer_name": (
                f"{s.customer.first_name or ''} {s.customer.last_name or ''}".strip()
                if s.customer else None
            ),
            "product_id": str(s.product_id),
            "product_name": s.product.display_name if s.product else None,
            "quantity": s.quantity,
            "frequency_days": s.frequency_days,
            "discount_pct": float(s.discount_pct),
            "status": s.status,
            "next_billing_date": s.next_billing_date.isoformat() if s.next_billing_date else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in subs
    ]

    return {
        "items": items,
        "total": len(items),
        "mrr": round(mrr, 2),
    }


# ── Pause / Resume / Skip / Cancel ───────────────────────────────────────────

@router.put("/subscriptions/{subscription_id}/pause")
async def pause_subscription(
    subscription_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Pause an active subscription."""
    result = await db.execute(
        select(Subscription).where(Subscription.id == subscription_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if sub.status != "active":
        raise HTTPException(status_code=400, detail=f"Cannot pause a subscription with status '{sub.status}'")
    sub.status = "paused"
    await db.commit()
    return {"id": str(sub.id), "status": sub.status}


@router.put("/subscriptions/{subscription_id}/resume")
async def resume_subscription(
    subscription_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Resume a paused subscription."""
    result = await db.execute(
        select(Subscription).where(Subscription.id == subscription_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if sub.status != "paused":
        raise HTTPException(status_code=400, detail=f"Cannot resume a subscription with status '{sub.status}'")
    sub.status = "active"
    await db.commit()
    return {"id": str(sub.id), "status": sub.status}


@router.put("/subscriptions/{subscription_id}/skip")
async def skip_subscription_cycle(
    subscription_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Skip next billing cycle by advancing next_billing_date by frequency_days."""
    result = await db.execute(
        select(Subscription).where(Subscription.id == subscription_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if sub.status not in ("active", "paused"):
        raise HTTPException(status_code=400, detail=f"Cannot skip a subscription with status '{sub.status}'")

    current_date = sub.next_billing_date or date.today()
    sub.next_billing_date = current_date + timedelta(days=sub.frequency_days)
    await db.commit()
    return {"id": str(sub.id), "next_billing_date": sub.next_billing_date.isoformat()}


@router.delete("/subscriptions/{subscription_id}", status_code=204)
async def cancel_subscription(
    subscription_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Cancel a subscription."""
    from datetime import datetime, timezone

    result = await db.execute(
        select(Subscription).where(Subscription.id == subscription_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    sub.status = "cancelled"
    sub.cancelled_at = datetime.now(timezone.utc)
    await db.commit()


# ── Single Subscription Detail ────────────────────────────────────────────────

@router.get("/subscriptions/{subscription_id}")
async def get_subscription(
    subscription_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Get a single subscription with its order history."""
    result = await db.execute(
        select(Subscription).where(Subscription.id == subscription_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    orders_result = await db.execute(
        select(SubscriptionOrder)
        .where(SubscriptionOrder.subscription_id == subscription_id)
        .order_by(SubscriptionOrder.billing_date.desc())
    )
    sub_orders = orders_result.scalars().all()

    return {
        "id": str(sub.id),
        "customer_id": str(sub.customer_id),
        "customer_email": sub.customer.email if sub.customer else None,
        "product_id": str(sub.product_id),
        "product_name": sub.product.display_name if sub.product else None,
        "product_price": float(sub.product.price) if sub.product else None,
        "quantity": sub.quantity,
        "frequency_days": sub.frequency_days,
        "discount_pct": float(sub.discount_pct),
        "status": sub.status,
        "next_billing_date": sub.next_billing_date.isoformat() if sub.next_billing_date else None,
        "cancelled_at": sub.cancelled_at.isoformat() if sub.cancelled_at else None,
        "created_at": sub.created_at.isoformat() if sub.created_at else None,
        "order_history": [
            {
                "id": str(so.id),
                "order_id": str(so.order_id),
                "billing_date": so.billing_date.isoformat(),
                "created_at": so.created_at.isoformat(),
            }
            for so in sub_orders
        ],
    }
