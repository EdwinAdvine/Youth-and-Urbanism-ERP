"""E-Commerce AI Personalization Service."""
from __future__ import annotations

import logging
from decimal import Decimal

from sqlalchemy import func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def get_recommendations(
    db: AsyncSession,
    customer_id: str | None,
    store_id: str,
    limit: int = 8,
) -> list[dict]:
    """
    Collaborative filtering: find products bought by customers who bought same products.
    Falls back to top-rated/top-selling products if no order history.
    """
    from app.models.ecommerce import EcomOrder, OrderLine, EcomProduct

    recs: list[dict] = []

    if customer_id:
        # Step 1: find products this customer has bought
        customer_orders = await db.execute(
            select(OrderLine.product_id)
            .join(EcomOrder, OrderLine.order_id == EcomOrder.id)
            .where(EcomOrder.customer_id == customer_id)
            .distinct()
        )
        bought_ids = [r for r in customer_orders.scalars().all()]

        if bought_ids:
            # Step 2: find customers who bought same products
            similar_customers = await db.execute(
                select(EcomOrder.customer_id)
                .join(OrderLine, OrderLine.order_id == EcomOrder.id)
                .where(OrderLine.product_id.in_(bought_ids))
                .where(EcomOrder.customer_id != customer_id)
                .distinct()
                .limit(100)
            )
            sim_ids = [r for r in similar_customers.scalars().all()]

            if sim_ids:
                # Step 3: find products bought by similar customers not bought by current customer
                recs_result = await db.execute(
                    select(OrderLine.product_id, func.count().label("freq"))
                    .join(EcomOrder, OrderLine.order_id == EcomOrder.id)
                    .where(EcomOrder.customer_id.in_(sim_ids))
                    .where(OrderLine.product_id.notin_(bought_ids))
                    .group_by(OrderLine.product_id)
                    .order_by(desc("freq"))
                    .limit(limit)
                )
                rec_product_ids = [r.product_id for r in recs_result.all()]

                products = await db.execute(
                    select(EcomProduct).where(
                        EcomProduct.id.in_(rec_product_ids),
                        EcomProduct.is_published == True,
                    )
                )
                for p in products.scalars().all():
                    recs.append({
                        "id": str(p.id),
                        "display_name": p.display_name,
                        "price": float(p.price),
                        "images": p.images or [],
                        "slug": p.slug,
                        "reason": "customers_also_bought",
                    })

    # Fallback: top-selling products
    if len(recs) < limit:
        needed = limit - len(recs)
        existing_ids = [r["id"] for r in recs]
        top = await db.execute(
            select(OrderLine.product_id, func.count().label("sales"))
            .group_by(OrderLine.product_id)
            .order_by(desc("sales"))
            .limit(needed + 20)
        )
        top_ids = [r.product_id for r in top.all() if str(r.product_id) not in existing_ids][:needed]
        if top_ids:
            products = await db.execute(
                select(EcomProduct).where(
                    EcomProduct.id.in_(top_ids),
                    EcomProduct.is_published == True,
                )
            )
            for p in products.scalars().all():
                recs.append({
                    "id": str(p.id),
                    "display_name": p.display_name,
                    "price": float(p.price),
                    "images": p.images or [],
                    "slug": p.slug,
                    "reason": "top_selling",
                })

    return recs[:limit]


async def generate_product_description(
    product_name: str,
    attributes: dict,
) -> str:
    """Generate SEO-optimized product description using the configured AI provider."""
    try:
        from openai import AsyncOpenAI
        from app.core.config import settings

        prompt = (
            f"Write a compelling, SEO-optimized product description for: {product_name}. "
            f"Key attributes: {attributes}. "
            "Keep it 2-3 paragraphs. Focus on benefits, not just features. "
            "Use natural language. No markdown headers."
        )

        provider = settings.AI_PROVIDER
        if provider == "anthropic":
            import anthropic

            client = anthropic.AsyncAnthropic(api_key=settings.AI_API_KEY)
            resp = await client.messages.create(
                model=settings.AI_MODEL,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.content[0].text
        else:
            client_oai = AsyncOpenAI(api_key=settings.AI_API_KEY, base_url=settings.AI_BASE_URL)
            resp = await client_oai.chat.completions.create(
                model=settings.AI_MODEL,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.choices[0].message.content or ""
    except Exception as e:
        logger.warning("AI description generation failed: %s", e)
        return f"Discover the {product_name} — a high-quality product crafted for excellence."


async def compute_dynamic_price_suggestion(
    db: AsyncSession,
    product_id: str,
) -> dict:
    """Suggest optimal price based on demand signals."""
    from app.models.ecommerce import EcomProduct, OrderLine, EcomOrder, Wishlist

    product_result = await db.execute(
        select(EcomProduct).where(EcomProduct.id == product_id)
    )
    product = product_result.scalar_one_or_none()
    if not product:
        return {"suggested_price": None, "reason": "Product not found"}

    # Count recent orders (last 30 days)
    from datetime import datetime, timedelta, timezone
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    order_count_result = await db.execute(
        select(func.count()).select_from(OrderLine)
        .join(EcomOrder, OrderLine.order_id == EcomOrder.id)
        .where(OrderLine.product_id == product_id)
        .where(EcomOrder.created_at >= thirty_days_ago)
    )
    recent_orders = order_count_result.scalar() or 0

    # Count wishlists
    wishlist_count_result = await db.execute(
        select(func.count()).select_from(Wishlist).where(Wishlist.product_id == product_id)
    )
    wishlist_count = wishlist_count_result.scalar() or 0

    current_price = float(product.price)
    suggested = current_price

    if recent_orders > 20 or wishlist_count > 10:
        suggested = round(current_price * 1.05, 2)
        reason = "high_demand"
    elif recent_orders < 2:
        suggested = round(current_price * 0.95, 2)
        reason = "low_demand"
    else:
        reason = "optimal"

    return {
        "current_price": current_price,
        "suggested_price": suggested,
        "change_pct": round((suggested - current_price) / current_price * 100, 1) if current_price else 0,
        "reason": reason,
        "signals": {"recent_orders_30d": recent_orders, "wishlist_count": wishlist_count},
    }


async def get_ecom_health_score(db: AsyncSession, store_id: str) -> dict:
    """Compute a 0-100 health score for the e-commerce store."""
    from app.models.ecommerce import EcomOrder, Cart, CartItem
    from datetime import datetime, timedelta, timezone

    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

    # Total orders last 30 days
    orders_result = await db.execute(
        select(func.count()).select_from(EcomOrder)
        .where(EcomOrder.store_id == store_id)
        .where(EcomOrder.created_at >= thirty_days_ago)
    )
    total_orders = orders_result.scalar() or 0

    # Carts with items last 30 days (proxy for sessions)
    carts_result = await db.execute(
        select(func.count()).select_from(Cart)
        .where(Cart.store_id == store_id)
        .where(Cart.created_at >= thirty_days_ago)
    )
    total_carts = carts_result.scalar() or 1

    # Revenue growth (compare last 30d vs prior 30d)
    sixty_days_ago = datetime.now(timezone.utc) - timedelta(days=60)
    recent_rev_result = await db.execute(
        select(func.coalesce(func.sum(EcomOrder.total), 0))
        .where(EcomOrder.store_id == store_id)
        .where(EcomOrder.created_at >= thirty_days_ago)
    )
    recent_rev = float(recent_rev_result.scalar() or 0)

    prior_rev_result = await db.execute(
        select(func.coalesce(func.sum(EcomOrder.total), 0))
        .where(EcomOrder.store_id == store_id)
        .where(EcomOrder.created_at >= sixty_days_ago)
        .where(EcomOrder.created_at < thirty_days_ago)
    )
    prior_rev = float(prior_rev_result.scalar() or 1)

    # Scores (each 0-25)
    conversion_rate = min(total_orders / total_carts, 1) if total_carts > 0 else 0
    conversion_score = round(conversion_rate * 25)

    cart_abandonment_rate = 1 - conversion_rate
    abandonment_score = round((1 - cart_abandonment_rate) * 20)

    growth_rate = (recent_rev - prior_rev) / prior_rev if prior_rev > 0 else 0
    growth_score = min(round((1 + growth_rate) * 12.5), 25)

    # Repeat purchase rate
    repeat_result = await db.execute(
        select(func.count()).select_from(EcomOrder)
        .where(EcomOrder.store_id == store_id)
        .where(EcomOrder.created_at >= thirty_days_ago)
        .where(EcomOrder.customer_id.in_(
            select(EcomOrder.customer_id)
            .where(EcomOrder.store_id == store_id)
            .where(EcomOrder.created_at < thirty_days_ago)
            .distinct()
        ))
    )
    repeat_orders = repeat_result.scalar() or 0
    repeat_rate = repeat_orders / max(total_orders, 1)
    repeat_score = round(repeat_rate * 25)

    total_score = conversion_score + abandonment_score + growth_score + repeat_score

    return {
        "score": min(total_score, 100),
        "grade": "A" if total_score >= 80 else "B" if total_score >= 60 else "C" if total_score >= 40 else "D",
        "components": {
            "conversion_rate": {"score": conversion_score, "value": round(conversion_rate * 100, 1)},
            "cart_abandonment": {"score": abandonment_score, "value": round(cart_abandonment_rate * 100, 1)},
            "revenue_growth": {"score": growth_score, "value": round(growth_rate * 100, 1)},
            "repeat_purchase_rate": {"score": repeat_score, "value": round(repeat_rate * 100, 1)},
        },
        "period_days": 30,
    }
