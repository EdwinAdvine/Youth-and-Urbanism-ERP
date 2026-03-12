"""E-Commerce Celery tasks: abandoned cart recovery, subscriptions, flash sales, exchange rates, import."""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import date, datetime, timedelta, timezone

task_logger = logging.getLogger(__name__)


def _run(coro):
    """Run async coroutine in sync Celery task."""
    return asyncio.run(coro)


# Import celery_app from the main tasks module
from app.tasks.celery_app import celery_app


@celery_app.task(name="tasks.check_abandoned_carts")
def check_abandoned_carts():
    """
    Every 30 minutes: find carts inactive > ECOM_CART_ABANDONMENT_HOURS with items,
    log them to CartAbandonmentLog, queue recovery email 1.
    """
    async def _run_check():
        from sqlalchemy import select, update, and_
        from app.core.database import AsyncSessionLocal
        from app.models.ecommerce import Cart, CartItem, CartAbandonmentLog
        from app.core.config import settings

        abandonment_hours = getattr(settings, "ECOM_CART_ABANDONMENT_HOURS", 1)
        cutoff = datetime.now(timezone.utc) - timedelta(hours=abandonment_hours)

        async with AsyncSessionLocal() as db:
            # Find carts with items that have not been touched since cutoff
            carts_result = await db.execute(
                select(Cart).where(
                    Cart.updated_at <= cutoff,
                    Cart.customer_id.isnot(None),
                )
            )
            carts = carts_result.scalars().all()

            logged = 0
            for cart in carts:
                if not cart.items:
                    continue

                # Check if already logged
                existing = await db.execute(
                    select(CartAbandonmentLog).where(
                        CartAbandonmentLog.cart_id == cart.id,
                        CartAbandonmentLog.is_recovered == False,
                    )
                )
                if existing.scalar_one_or_none():
                    continue

                # Build items snapshot
                items_snapshot = [
                    {
                        "product_id": str(item.product_id),
                        "product_name": item.product.display_name if item.product else "Product",
                        "quantity": item.quantity,
                        "price": float(item.product.price) if item.product else 0,
                    }
                    for item in cart.items
                ]

                # Get customer email
                from app.models.ecommerce import CustomerAccount
                customer_result = await db.execute(
                    select(CustomerAccount).where(CustomerAccount.id == cart.customer_id)
                )
                customer = customer_result.scalar_one_or_none()
                if not customer:
                    continue

                log = CartAbandonmentLog(
                    cart_id=cart.id,
                    store_id=cart.store_id,
                    customer_email=customer.email,
                    customer_id=cart.customer_id,
                    items_snapshot=items_snapshot,
                    abandoned_at=datetime.now(timezone.utc),
                )
                db.add(log)
                logged += 1

            await db.commit()

            # Queue recovery email 1 for newly logged carts
            if logged > 0:
                send_cart_recovery_email_1.apply_async(countdown=300)  # 5 min delay

            task_logger.info("Abandoned cart check: logged %d carts", logged)
            return {"logged": logged}

    return _run(_run_check())


@celery_app.task(name="tasks.send_cart_recovery_email_1")
def send_cart_recovery_email_1():
    """Send first recovery email to customers with abandoned carts (1h window)."""
    async def _send():
        from sqlalchemy import select
        from app.core.database import AsyncSessionLocal
        from app.models.ecommerce import CartAbandonmentLog
        from app.tasks.celery_app import send_email
        from datetime import datetime, timedelta, timezone

        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        two_hours_ago = datetime.now(timezone.utc) - timedelta(hours=2)

        async with AsyncSessionLocal() as db:
            logs_result = await db.execute(
                select(CartAbandonmentLog).where(
                    CartAbandonmentLog.is_recovered == False,
                    CartAbandonmentLog.recovery_email_1_sent_at.is_(None),
                    CartAbandonmentLog.abandoned_at >= two_hours_ago,
                    CartAbandonmentLog.abandoned_at <= one_hour_ago,
                )
            )
            logs = logs_result.scalars().all()

            sent = 0
            for log in logs:
                items_html = "".join(
                    f"<li>{item.get('product_name', 'Product')} x{item.get('quantity', 1)} — {item.get('price', 0):.2f}</li>"
                    for item in (log.items_snapshot or [])
                )
                html = f"""
                <h2>You left something behind!</h2>
                <p>Hi there,</p>
                <p>You have items waiting in your cart:</p>
                <ul>{items_html}</ul>
                <p><a href="{getattr(__import__('app.core.config', fromlist=['settings']), 'settings', type('', (), {'APP_URL': 'http://localhost:3010'})()).APP_URL}/cart" style="background:#51459d;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;">Complete Your Order</a></p>
                """
                send_email.delay(
                    to=log.customer_email,
                    subject="You left something in your cart!",
                    body="You have items waiting in your cart. Complete your order now.",
                    html_body=html,
                )
                log.recovery_email_1_sent_at = datetime.now(timezone.utc)
                sent += 1

            await db.commit()
            task_logger.info("Cart recovery email 1 sent to %d customers", sent)
            return {"sent": sent}

    return _run(_send())


@celery_app.task(name="tasks.send_cart_recovery_email_2")
def send_cart_recovery_email_2():
    """Send second recovery email with discount coupon (24h after abandonment)."""
    async def _send():
        import random, string
        from sqlalchemy import select
        from decimal import Decimal
        from datetime import datetime, timedelta, timezone
        from app.core.database import AsyncSessionLocal
        from app.models.ecommerce import CartAbandonmentLog, Coupon
        from app.tasks.celery_app import send_email

        twenty_four_hours_ago = datetime.now(timezone.utc) - timedelta(hours=24)
        twenty_five_hours_ago = datetime.now(timezone.utc) - timedelta(hours=25)

        async with AsyncSessionLocal() as db:
            logs_result = await db.execute(
                select(CartAbandonmentLog).where(
                    CartAbandonmentLog.is_recovered == False,
                    CartAbandonmentLog.recovery_email_1_sent_at.isnot(None),
                    CartAbandonmentLog.recovery_email_2_sent_at.is_(None),
                    CartAbandonmentLog.abandoned_at >= twenty_five_hours_ago,
                    CartAbandonmentLog.abandoned_at <= twenty_four_hours_ago,
                )
            )
            logs = logs_result.scalars().all()

            sent = 0
            for log in logs:
                # Create a single-use coupon
                code = "RECOVER-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
                now = datetime.now(timezone.utc)
                coupon = Coupon(
                    code=code,
                    coupon_type="percentage",
                    value=Decimal("10"),
                    min_order=Decimal("0"),
                    valid_from=now,
                    valid_to=now + timedelta(days=3),
                    usage_limit=1,
                    is_active=True,
                )
                db.add(coupon)
                await db.flush()

                log.recovery_email_2_sent_at = now
                log.discount_code_used = code

                items_html = "".join(
                    f"<li>{item.get('product_name', 'Product')} x{item.get('quantity', 1)}</li>"
                    for item in (log.items_snapshot or [])
                )
                from app.core.config import settings
                html = f"""
                <h2>Here's 10% off to complete your order!</h2>
                <p>Your cart is still waiting. Use code <strong>{code}</strong> for 10% off.</p>
                <ul>{items_html}</ul>
                <p>Code expires in 3 days.</p>
                <p><a href="{settings.APP_URL}/cart?coupon={code}" style="background:#51459d;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;">Claim Your Discount</a></p>
                """
                send_email.delay(
                    to=log.customer_email,
                    subject=f"Still thinking? Here's 10% off — code: {code}",
                    body=f"Use code {code} for 10% off your abandoned cart.",
                    html_body=html,
                )
                sent += 1

            await db.commit()
            return {"sent": sent}

    return _run(_send())


@celery_app.task(name="tasks.process_due_subscriptions")
def process_due_subscriptions():
    """Daily: create orders for subscriptions due today."""
    async def _process():
        import random, string
        from sqlalchemy import select
        from datetime import date, timedelta
        from decimal import Decimal
        from app.core.database import AsyncSessionLocal
        from app.models.ecommerce_subscriptions import Subscription, SubscriptionOrder
        from app.models.ecommerce import EcomOrder, OrderLine

        today = date.today()

        async with AsyncSessionLocal() as db:
            due_subs_result = await db.execute(
                select(Subscription).where(
                    Subscription.status == "active",
                    Subscription.next_billing_date <= today,
                )
            )
            subscriptions = due_subs_result.scalars().all()

            processed = 0
            for sub in subscriptions:
                try:
                    if not sub.product:
                        continue

                    # Get store from product
                    from app.models.ecommerce import Store
                    store_result = await db.execute(select(Store).limit(1))
                    store = store_result.scalar_one_or_none()
                    if not store:
                        continue

                    # Compute price with discount
                    base_price = sub.product.price
                    discount_multiplier = Decimal("1") - sub.discount_pct / Decimal("100")
                    unit_price = base_price * discount_multiplier
                    total = unit_price * sub.quantity

                    order_number = "SUB-" + "".join(random.choices(string.digits, k=8))
                    order = EcomOrder(
                        store_id=store.id,
                        customer_id=sub.customer_id,
                        order_number=order_number,
                        subtotal=total,
                        total=total,
                        status="confirmed",
                        notes=f"Auto-generated subscription order",
                        shipping_address_id=sub.shipping_address_id,
                    )
                    db.add(order)
                    await db.flush()

                    line = OrderLine(
                        order_id=order.id,
                        product_id=sub.product_id,
                        product_name=sub.product.display_name,
                        quantity=sub.quantity,
                        unit_price=unit_price,
                        total=total,
                    )
                    db.add(line)

                    sub_order = SubscriptionOrder(
                        subscription_id=sub.id,
                        order_id=order.id,
                        billing_date=today,
                    )
                    db.add(sub_order)

                    # Advance next billing date
                    sub.next_billing_date = today + timedelta(days=sub.frequency_days)
                    processed += 1

                except Exception as e:
                    task_logger.error("Failed to process subscription %s: %s", sub.id, e)

            await db.commit()
            task_logger.info("Processed %d due subscriptions", processed)
            return {"processed": processed}

    return _run(_process())


@celery_app.task(name="tasks.activate_scheduled_flash_sales")
def activate_scheduled_flash_sales():
    """Every 5 min: activate flash sales whose start_at has passed and deactivate expired ones."""
    async def _activate():
        from sqlalchemy import update
        from datetime import datetime, timezone
        from app.core.database import AsyncSessionLocal
        from app.models.ecommerce import FlashSale

        now = datetime.now(timezone.utc)
        async with AsyncSessionLocal() as db:
            # Activate
            await db.execute(
                update(FlashSale)
                .where(
                    FlashSale.start_at <= now,
                    FlashSale.end_at > now,
                    FlashSale.is_active == False,
                )
                .values(is_active=True)
            )
            # Deactivate expired
            await db.execute(
                update(FlashSale)
                .where(
                    FlashSale.end_at <= now,
                    FlashSale.is_active == True,
                )
                .values(is_active=False)
            )
            await db.commit()
        return {"status": "ok", "checked_at": now.isoformat()}

    return _run(_activate())


@celery_app.task(name="tasks.refresh_exchange_rates")
def refresh_exchange_rates():
    """Daily: update exchange rates from exchangerate.host or manual fallback."""
    async def _refresh():
        from app.core.database import AsyncSessionLocal
        from app.models.ecommerce_currency import EcomCurrency
        from sqlalchemy import select
        from datetime import datetime, timezone

        try:
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get("https://api.exchangerate.host/latest?base=KES")
                if resp.status_code == 200:
                    data = resp.json()
                    rates = data.get("rates", {})
                else:
                    rates = {}
        except Exception:
            rates = {}

        if not rates:
            return {"status": "skipped", "reason": "no_rates_available"}

        async with AsyncSessionLocal() as db:
            currencies_result = await db.execute(select(EcomCurrency))
            currencies = currencies_result.scalars().all()
            updated = 0
            for currency in currencies:
                if currency.code in rates:
                    currency.exchange_rate_to_base = rates[currency.code]
                    currency.last_updated = datetime.now(timezone.utc)
                    updated += 1
            await db.commit()
            return {"status": "ok", "updated": updated}

    return _run(_refresh())


@celery_app.task(name="tasks.run_import_job")
def run_import_job(job_id: str):
    """Background task to process a product/customer/order import job."""
    async def _import():
        import json, csv, io
        from sqlalchemy import select, update
        from app.core.database import AsyncSessionLocal
        from app.models.ecommerce import ImportJob, EcomProduct, CustomerAccount
        from app.core.config import settings

        async with AsyncSessionLocal() as db:
            job_result = await db.execute(
                select(ImportJob).where(ImportJob.id == uuid.UUID(job_id))
            )
            job = job_result.scalar_one_or_none()
            if not job:
                return {"status": "error", "message": "Job not found"}

            job.status = "running"
            await db.commit()

            try:
                # Read file from MinIO
                from app.integrations import minio_client
                if job.file_path:
                    file_data = minio_client.get_file(job.file_path)
                    content = file_data.decode("utf-8") if isinstance(file_data, bytes) else file_data
                else:
                    job.status = "failed"
                    job.error_log = "No file path set"
                    await db.commit()
                    return {"status": "failed"}

                products_imported = 0
                customers_imported = 0

                # Parse CSV
                if job.source_platform in ("csv", "shopify", "woocommerce"):
                    reader = csv.DictReader(io.StringIO(content))
                    rows = list(reader)
                    mappings = job.mappings_json or {}

                    for i, row in enumerate(rows):
                        try:
                            name_field = mappings.get("display_name", "Name") or "Name"
                            price_field = mappings.get("price", "Price") or "Price"
                            slug_field = mappings.get("slug", "Handle") or "Handle"

                            display_name = row.get(name_field, f"Product {i}")
                            price_str = row.get(price_field, "0") or "0"
                            slug = row.get(slug_field, f"product-{i}")

                            from decimal import Decimal
                            import re
                            price_clean = re.sub(r"[^\d.]", "", str(price_str)) or "0"

                            # Get first store
                            from app.models.ecommerce import Store
                            store_result = await db.execute(select(Store).limit(1))
                            store = store_result.scalar_one_or_none()
                            if not store:
                                break

                            # Check if slug exists
                            existing = await db.execute(
                                select(EcomProduct).where(EcomProduct.slug == slug)
                            )
                            if not existing.scalar_one_or_none():
                                product = EcomProduct(
                                    store_id=store.id,
                                    display_name=display_name,
                                    slug=slug,
                                    price=Decimal(price_clean),
                                    is_published=False,
                                )
                                db.add(product)
                                products_imported += 1

                            # Update progress every 10 rows
                            if i % 10 == 0:
                                job.progress_pct = min(int(i / len(rows) * 90), 90)
                                await db.commit()

                        except Exception as row_err:
                            task_logger.warning("Import row %d error: %s", i, row_err)

                job.status = "done"
                job.progress_pct = 100
                job.imported_products = products_imported
                job.imported_customers = customers_imported
                await db.commit()
                return {"status": "done", "products": products_imported}

            except Exception as e:
                job.status = "failed"
                job.error_log = str(e)
                await db.commit()
                return {"status": "failed", "error": str(e)}

    return _run(_import())
