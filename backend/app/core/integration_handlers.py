"""Cross-module integration event handlers.

Registers event bus handlers for deep integrations between modules:
  - POS -> Finance (journal entry on sale)
  - POS -> Inventory (stock deduction on sale) -- already done inline in pos.py
  - E-Commerce -> Finance (invoice on order)
  - E-Commerce -> Inventory (stock deduction on order) -- already done inline in ecommerce_ext.py
  - E-Commerce -> Mail (order confirmation + shipping notification)
  - Inventory -> Finance (stock valuation journal entry)
  - Supply Chain -> Inventory (stock movement on GRN accept) -- already done inline in supplychain.py
  - Manufacturing -> Inventory (consume raw + produce finished) -- already done inline in manufacturing.py
  - HR -> Calendar (leave absence event) -- already done in main.py
  - Support -> Mail (ticket notification)
  - CRM -> Mail (deal stage notification)
  - Calendar -> Notifications (event reminder)
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app.core.events import event_bus

logger = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _log_activity(
    activity_type: str,
    message: str,
    module: str,
    user_id: str,
    metadata: dict | None = None,
) -> None:
    """Insert an ActivityFeedEntry for the dashboard."""
    try:
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.activity import ActivityFeedEntry  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            entry = ActivityFeedEntry(
                activity_type=activity_type,
                message=message,
                module=module,
                user_id=user_id,
                metadata_json=metadata,
            )
            db.add(entry)
            await db.commit()
    except Exception:
        logger.exception("Failed to log activity: %s", message)


async def _create_notification(
    user_id: str,
    title: str,
    message: str,
    notif_type: str = "info",
    module: str | None = None,
    link_url: str | None = None,
) -> None:
    """Insert a Notification for a specific user."""
    if not user_id:
        return
    try:
        import uuid as _uuid  # noqa: PLC0415
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.notification import Notification  # noqa: PLC0415

        # asyncpg requires uuid.UUID objects — never raw strings
        uid = _uuid.UUID(str(user_id)) if not isinstance(user_id, _uuid.UUID) else user_id
        async with AsyncSessionLocal() as db:
            notif = Notification(
                user_id=uid,
                title=title,
                message=message,
                type=notif_type,
                module=module,
                link_url=link_url,
            )
            db.add(notif)
            await db.commit()
    except Exception:
        logger.exception("Failed to create notification for user %s", user_id)


async def _get_app_admin_ids(app_name: str) -> list[str]:
    """Return user_ids of all admins for the given app, plus all super-admins."""
    try:
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.user import AppAdmin, User  # noqa: PLC0415
        from sqlalchemy import select  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            res = await db.execute(select(AppAdmin.user_id).where(AppAdmin.app_name == app_name))
            ids = [str(r) for r in res.scalars().all()]
            res2 = await db.execute(select(User.id).where(User.is_superadmin == True))  # noqa: E712
            ids += [str(r) for r in res2.scalars().all()]
            return list(set(ids))
    except Exception:
        logger.exception("Failed to get app admin ids for %s", app_name)
        return []


async def _send_system_email(to: list[str], subject: str, body: str) -> None:
    """Send a system email via SMTP (best-effort, swallow errors)."""
    try:
        from app.integrations.smtp_client import send_email  # noqa: PLC0415
        from app.core.config import settings  # noqa: PLC0415

        from_addr = getattr(settings, "SYSTEM_EMAIL", "noreply@urban-erp.local")
        await send_email(from_addr=from_addr, to_addrs=to, subject=subject, body_text=body)
        logger.info("System email sent to %s: %s", to, subject)
    except Exception:
        logger.debug("System email not sent (mail service may be unavailable): %s", subject)


# ── 1. POS → Finance: auto-create journal entry on sale ──────────────────────

@event_bus.on("pos.sale.completed")
async def on_pos_sale_completed(data: dict) -> None:
    """Create a double-entry journal entry when a POS sale completes.

    Debit: Cash/Card account (asset)
    Credit: Sales Revenue account (revenue)
    """
    logger.info(
        "Integration: pos.sale.completed → Finance journal entry (txn: %s)",
        data.get("transaction_number"),
    )
    try:
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.finance import Account, JournalEntry, JournalLine  # noqa: PLC0415
        from sqlalchemy import func, select  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            total = Decimal(data.get("total", "0"))
            if total <= 0:
                return

            # Find or default account codes
            # Try to find a "Cash" asset account and a "Sales Revenue" revenue account
            cash_result = await db.execute(
                select(Account).where(
                    Account.account_type == "asset",
                    Account.is_active == True,  # noqa: E712
                    Account.name.ilike("%cash%"),
                )
            )
            cash_account = cash_result.scalar_one_or_none()

            revenue_result = await db.execute(
                select(Account).where(
                    Account.account_type == "revenue",
                    Account.is_active == True,  # noqa: E712
                    Account.name.ilike("%sales%"),
                )
            )
            revenue_account = revenue_result.scalar_one_or_none()

            if not cash_account or not revenue_account:
                logger.warning(
                    "POS→Finance: Skipping journal entry — missing Cash or Sales Revenue account. "
                    "Create accounts with type 'asset' (name containing 'cash') and "
                    "type 'revenue' (name containing 'sales')."
                )
                return

            # Generate journal entry number
            today = date.today()
            count_result = await db.execute(
                select(func.count()).select_from(JournalEntry)
            )
            seq = (count_result.scalar() or 0) + 1
            entry_number = f"JE-POS-{today.year}-{seq:05d}"

            je = JournalEntry(
                entry_number=entry_number,
                entry_date=today,
                description=f"POS Sale: {data.get('transaction_number', '')}",
                status="posted",
                posted_by=data.get("cashier_id"),
                metadata_json={
                    "source": "pos",
                    "transaction_id": data.get("transaction_id"),
                    "transaction_number": data.get("transaction_number"),
                },
            )
            db.add(je)
            await db.flush()

            # Debit cash, credit revenue
            db.add(JournalLine(
                journal_entry_id=je.id,
                account_id=cash_account.id,
                debit=total,
                credit=Decimal("0"),
                description=f"POS cash receipt — {data.get('transaction_number', '')}",
            ))
            db.add(JournalLine(
                journal_entry_id=je.id,
                account_id=revenue_account.id,
                debit=Decimal("0"),
                credit=total,
                description=f"POS sales revenue — {data.get('transaction_number', '')}",
            ))

            await db.commit()
            logger.info("POS→Finance: Created journal entry %s for %s", entry_number, total)

    except Exception:
        logger.exception("POS→Finance: Failed to create journal entry for POS sale")

    await _log_activity(
        "created",
        f"POS sale journal entry: {data.get('transaction_number')} ({data.get('total')})",
        "finance",
        data.get("cashier_id", ""),
        data,
    )


# ── 2. E-Commerce → Finance: auto-create invoice on order ───────────────────

@event_bus.on("ecommerce.order.created")
async def on_ecommerce_order_created(data: dict) -> None:
    """Create a sales invoice when an e-commerce order is placed."""
    logger.info(
        "Integration: ecommerce.order.created → Finance invoice (order: %s)",
        data.get("order_number"),
    )
    try:
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.finance import Invoice  # noqa: PLC0415
        from app.models.ecommerce import EcomOrder, OrderLine  # noqa: PLC0415
        from sqlalchemy import func, select  # noqa: PLC0415
        from sqlalchemy.orm import selectinload  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            # Fetch the order with lines
            result = await db.execute(
                select(EcomOrder)
                .options(selectinload(EcomOrder.lines), selectinload(EcomOrder.customer))
                .where(EcomOrder.id == data.get("order_id"))
            )
            order = result.scalar_one_or_none()
            if not order:
                logger.warning("E-Commerce→Finance: Order %s not found", data.get("order_id"))
                return

            # Generate invoice number
            today = date.today()
            count_result = await db.execute(
                select(func.count()).select_from(Invoice)
            )
            seq = (count_result.scalar() or 0) + 1
            inv_number = f"INV-ECOM-{today.year}-{seq:04d}"

            customer_name = ""
            customer_email = ""
            if order.customer:
                customer_name = f"{order.customer.first_name or ''} {order.customer.last_name or ''}".strip()
                customer_email = order.customer.email or ""

            invoice = Invoice(
                invoice_number=inv_number,
                invoice_type="sales",
                status="sent",
                customer_name=customer_name,
                customer_email=customer_email,
                issue_date=today,
                due_date=today + timedelta(days=30),
                subtotal=order.subtotal,
                tax_amount=order.tax,
                total=order.total,
                owner_id=data.get("user_id", ""),
                notes=f"Auto-generated from e-commerce order {order.order_number}",
                items=[
                    {
                        "description": line.product_name,
                        "quantity": line.quantity,
                        "unit_price": float(line.unit_price),
                        "total": float(line.total),
                    }
                    for line in (order.lines or [])
                ],
            )
            db.add(invoice)
            await db.commit()
            logger.info("E-Commerce→Finance: Created invoice %s for order %s", inv_number, order.order_number)

    except Exception:
        logger.exception("E-Commerce→Finance: Failed to create invoice for order")

    # Send order confirmation email
    await _send_ecommerce_order_confirmation(data)

    await _log_activity(
        "created",
        f"E-commerce order invoice: {data.get('order_number')}",
        "finance",
        data.get("user_id", ""),
        data,
    )


# ── 3. E-Commerce → Mail: order confirmation email ──────────────────────────

async def _send_ecommerce_order_confirmation(data: dict) -> None:
    """Send order confirmation email to the customer."""
    try:
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.ecommerce import EcomOrder  # noqa: PLC0415
        from sqlalchemy import select  # noqa: PLC0415
        from sqlalchemy.orm import selectinload  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(EcomOrder)
                .options(selectinload(EcomOrder.customer))
                .where(EcomOrder.id == data.get("order_id"))
            )
            order = result.scalar_one_or_none()
            if not order or not order.customer or not order.customer.email:
                return

            subject = f"Order Confirmation — {order.order_number}"
            body = (
                f"Dear {order.customer.first_name or 'Customer'},\n\n"
                f"Thank you for your order ({order.order_number}).\n"
                f"Order Total: {order.total}\n"
                f"Status: {order.status}\n\n"
                f"We will notify you when your order ships.\n\n"
                f"Best regards,\nUrban ERP Store"
            )
            await _send_system_email(
                to=[order.customer.email],
                subject=subject,
                body=body,
            )
    except Exception:
        logger.debug("E-Commerce→Mail: Could not send order confirmation email")


# ── 4. E-Commerce → Mail: shipping notification ─────────────────────────────

@event_bus.on("ecommerce.order.shipped")
async def on_ecommerce_order_shipped(data: dict) -> None:
    """Send shipping notification email when order is shipped."""
    logger.info(
        "Integration: ecommerce.order.shipped → Mail notification (order: %s)",
        data.get("order_number"),
    )
    try:
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.ecommerce import EcomOrder  # noqa: PLC0415
        from sqlalchemy import select  # noqa: PLC0415
        from sqlalchemy.orm import selectinload  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(EcomOrder)
                .options(selectinload(EcomOrder.customer))
                .where(EcomOrder.id == data.get("order_id"))
            )
            order = result.scalar_one_or_none()
            if not order or not order.customer or not order.customer.email:
                return

            tracking = data.get("tracking_number", "N/A")
            subject = f"Your Order {order.order_number} Has Been Shipped!"
            body = (
                f"Dear {order.customer.first_name or 'Customer'},\n\n"
                f"Great news! Your order ({order.order_number}) has been shipped.\n"
                f"Tracking Number: {tracking}\n\n"
                f"You can track your package using the tracking number above.\n\n"
                f"Best regards,\nUrban ERP Store"
            )
            await _send_system_email(
                to=[order.customer.email],
                subject=subject,
                body=body,
            )
    except Exception:
        logger.debug("E-Commerce→Mail: Could not send shipping notification email")

    await _log_activity(
        "updated",
        f"E-commerce order shipped: {data.get('order_number')} (tracking: {data.get('tracking_number', 'N/A')})",
        "ecommerce",
        "",
        data,
    )


# ── 5. Inventory → Finance: stock valuation journal entry ────────────────────

@event_bus.on("inventory.valuation.changed")
async def on_inventory_valuation_changed(data: dict) -> None:
    """Update balance sheet accounts when stock valuation changes.

    Creates a journal entry adjusting the Inventory asset account.
    """
    logger.info(
        "Integration: inventory.valuation.changed → Finance journal entry (item: %s)",
        data.get("item_name"),
    )
    try:
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.finance import Account, JournalEntry, JournalLine  # noqa: PLC0415
        from sqlalchemy import func, select  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            change_amount = Decimal(str(data.get("value_change", "0")))
            if change_amount == 0:
                return

            # Find inventory asset account and COGS expense account
            inv_result = await db.execute(
                select(Account).where(
                    Account.account_type == "asset",
                    Account.is_active == True,  # noqa: E712
                    Account.name.ilike("%inventory%"),
                )
            )
            inventory_account = inv_result.scalar_one_or_none()

            cogs_result = await db.execute(
                select(Account).where(
                    Account.account_type == "expense",
                    Account.is_active == True,  # noqa: E712
                    Account.name.ilike("%cost of goods%"),
                )
            )
            cogs_account = cogs_result.scalar_one_or_none()

            if not inventory_account or not cogs_account:
                logger.warning(
                    "Inventory→Finance: Skipping journal entry — missing 'Inventory' asset "
                    "or 'Cost of Goods Sold' expense account."
                )
                return

            today = date.today()
            count_result = await db.execute(
                select(func.count()).select_from(JournalEntry)
            )
            seq = (count_result.scalar() or 0) + 1
            entry_number = f"JE-INV-{today.year}-{seq:05d}"

            je = JournalEntry(
                entry_number=entry_number,
                entry_date=today,
                description=f"Stock valuation adjustment: {data.get('item_name', '')}",
                status="posted",
                posted_by=data.get("user_id"),
                metadata_json={
                    "source": "inventory",
                    "item_id": data.get("item_id"),
                    "item_name": data.get("item_name"),
                    "value_change": str(change_amount),
                },
            )
            db.add(je)
            await db.flush()

            if change_amount > 0:
                # Stock value increased (receipt): debit inventory, credit COGS
                db.add(JournalLine(
                    journal_entry_id=je.id,
                    account_id=inventory_account.id,
                    debit=change_amount,
                    credit=Decimal("0"),
                    description=f"Inventory increase: {data.get('item_name', '')}",
                ))
                db.add(JournalLine(
                    journal_entry_id=je.id,
                    account_id=cogs_account.id,
                    debit=Decimal("0"),
                    credit=change_amount,
                    description=f"COGS adjustment: {data.get('item_name', '')}",
                ))
            else:
                # Stock value decreased (issue): debit COGS, credit inventory
                abs_amount = abs(change_amount)
                db.add(JournalLine(
                    journal_entry_id=je.id,
                    account_id=cogs_account.id,
                    debit=abs_amount,
                    credit=Decimal("0"),
                    description=f"COGS: {data.get('item_name', '')}",
                ))
                db.add(JournalLine(
                    journal_entry_id=je.id,
                    account_id=inventory_account.id,
                    debit=Decimal("0"),
                    credit=abs_amount,
                    description=f"Inventory decrease: {data.get('item_name', '')}",
                ))

            await db.commit()
            logger.info("Inventory→Finance: Created journal entry %s for valuation change %s", entry_number, change_amount)

    except Exception:
        logger.exception("Inventory→Finance: Failed to create journal entry for valuation change")


# ── 6. Supply Chain → Inventory: GRN accept creates stock movements ─────────
# NOTE: This is already handled inline in supplychain.py accept_grn endpoint.
# We register a handler for the event to provide activity logging and notifications.

@event_bus.on("supplychain.goods_received")
async def on_supplychain_goods_received(data: dict) -> None:
    """When goods are received via supply chain, create stock movements in inventory."""
    logger.info(
        "Integration: supplychain.goods_received → Inventory stock movement (GRN: %s)",
        data.get("grn_number"),
    )
    try:
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.inventory import StockLevel, StockMovement  # noqa: PLC0415
        from sqlalchemy import select  # noqa: PLC0415
        from sqlalchemy.sql import and_  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            items = data.get("items", [])
            warehouse_id = data.get("warehouse_id")
            user_id = data.get("received_by", "")

            for item_data in items:
                item_id = item_data.get("item_id")
                qty = item_data.get("accepted_quantity", 0)
                if not item_id or qty <= 0:
                    continue

                # Create stock movement
                movement = StockMovement(
                    item_id=item_id,
                    warehouse_id=warehouse_id,
                    movement_type="receipt",
                    quantity=qty,
                    reference_type="supplychain_grn",
                    reference_id=data.get("grn_id"),
                    notes=f"Supply chain GRN: {data.get('grn_number', '')}",
                    created_by=user_id,
                )
                db.add(movement)

                # Upsert stock level
                sl_result = await db.execute(
                    select(StockLevel).where(
                        and_(
                            StockLevel.item_id == item_id,
                            StockLevel.warehouse_id == warehouse_id,
                        )
                    )
                )
                stock_level = sl_result.scalar_one_or_none()
                if stock_level is None:
                    stock_level = StockLevel(
                        item_id=item_id,
                        warehouse_id=warehouse_id,
                        quantity_on_hand=qty,
                    )
                    db.add(stock_level)
                else:
                    stock_level.quantity_on_hand += qty

            await db.commit()
            logger.info(
                "SupplyChain→Inventory: Processed %d items from GRN %s",
                len(items),
                data.get("grn_number"),
            )

    except Exception:
        logger.exception("SupplyChain→Inventory: Failed to create stock movements from GRN")

    # Notify inventory admins
    admin_ids = await _get_app_admin_ids("inventory")
    for uid in admin_ids:
        await _create_notification(
            user_id=uid,
            title="Goods Received (Supply Chain)",
            message=f"GRN {data.get('grn_number', '')} accepted — stock updated for {len(data.get('items', []))} item(s).",
            notif_type="success",
            module="inventory",
            link_url="/inventory",
        )

    await _log_activity(
        "created",
        f"Supply chain goods received: GRN {data.get('grn_number', '')}",
        "inventory",
        data.get("received_by", ""),
        data,
    )


# ── 7. Manufacturing → Inventory: consume raw materials + produce finished goods
# NOTE: The manufacturing.py router already handles stock movements inline.
# We register a handler for wo.completed to log activity and send notifications.

@event_bus.on("wo.completed")
async def on_work_order_completed(data: dict) -> None:
    """When a work order completes, log activity and notify relevant teams."""
    logger.info(
        "Integration: wo.completed → Notifications + activity (WO: %s)",
        data.get("wo_number"),
    )

    # Notify manufacturing and inventory admins
    for app in ("manufacturing", "inventory"):
        admin_ids = await _get_app_admin_ids(app)
        for uid in admin_ids:
            await _create_notification(
                user_id=uid,
                title="Production Completed",
                message=(
                    f"Work order {data.get('wo_number', '')} completed. "
                    f"Produced: {data.get('completed_quantity', 0)} units, "
                    f"Rejected: {data.get('rejected_quantity', 0)} units."
                ),
                notif_type="success",
                module="manufacturing",
                link_url="/manufacturing",
            )

    await _log_activity(
        "completed",
        f"Work order completed: {data.get('wo_number')} (produced: {data.get('completed_quantity', 0)})",
        "manufacturing",
        data.get("owner_id", ""),
        data,
    )


# ── 8. Support → Mail: send email notification on ticket creation ────────────

@event_bus.on("support.ticket.created")
async def on_support_ticket_created(data: dict) -> None:
    """Send email notification when a support ticket is created."""
    logger.info(
        "Integration: support.ticket.created → Mail notification (ticket: %s)",
        data.get("ticket_number"),
    )

    # Send email to the customer if email is provided
    customer_email = data.get("customer_email")
    if customer_email:
        subject = f"Support Ticket Created — {data.get('ticket_number', '')}"
        body = (
            f"Dear {data.get('customer_name', 'Customer')},\n\n"
            f"Your support ticket has been created successfully.\n\n"
            f"Ticket Number: {data.get('ticket_number', '')}\n"
            f"Subject: {data.get('subject', '')}\n"
            f"Priority: {data.get('priority', 'medium')}\n\n"
            f"Our support team will review your request and respond as soon as possible.\n\n"
            f"Best regards,\nUrban ERP Support"
        )
        await _send_system_email(to=[customer_email], subject=subject, body=body)

    # Send notification to assigned agent
    assigned_to = data.get("assigned_to")
    if assigned_to:
        await _create_notification(
            user_id=assigned_to,
            title="New Support Ticket Assigned",
            message=f"Ticket {data.get('ticket_number', '')}: {data.get('subject', '')} (Priority: {data.get('priority', 'medium')})",
            notif_type="info",
            module="support",
            link_url=f"/support/tickets/{data.get('ticket_id', '')}",
        )

    # Notify support admins
    admin_ids = await _get_app_admin_ids("support")
    for uid in admin_ids:
        await _create_notification(
            user_id=uid,
            title="New Support Ticket",
            message=f"Ticket {data.get('ticket_number', '')}: {data.get('subject', '')} (Priority: {data.get('priority', 'medium')})",
            notif_type="info",
            module="support",
            link_url=f"/support/tickets/{data.get('ticket_id', '')}",
        )

    await _log_activity(
        "created",
        f"Support ticket: {data.get('ticket_number')} — {data.get('subject', '')}",
        "support",
        data.get("created_by", ""),
        data,
    )


# ── 9. CRM → Mail: deal stage change notification ───────────────────────────

@event_bus.on("opportunity.stage_changed")
async def on_opportunity_stage_changed(data: dict) -> None:
    """Send notification email when a deal/opportunity stage changes."""
    logger.info(
        "Integration: opportunity.stage_changed → Mail + Notifications (opp: %s, %s → %s)",
        data.get("opportunity_id"),
        data.get("old_stage"),
        data.get("new_stage"),
    )

    owner_id = data.get("owner_id", "")
    old_stage = data.get("old_stage", "")
    new_stage = data.get("new_stage", "")

    # Notify the deal owner
    if owner_id:
        await _create_notification(
            user_id=owner_id,
            title="Deal Stage Changed",
            message=f"Opportunity moved from '{old_stage}' to '{new_stage}'.",
            notif_type="info",
            module="crm",
            link_url=f"/crm/pipeline",
        )

    # Send email notification to CRM admins
    admin_ids = await _get_app_admin_ids("crm")
    for uid in admin_ids:
        if uid != owner_id:
            await _create_notification(
                user_id=uid,
                title="Deal Stage Changed",
                message=f"Opportunity {data.get('opportunity_id', '')} moved: {old_stage} → {new_stage}.",
                notif_type="info",
                module="crm",
                link_url=f"/crm/pipeline",
            )

    # Try to send email to the owner
    if owner_id:
        try:
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.models.user import User  # noqa: PLC0415

            async with AsyncSessionLocal() as db:
                user = await db.get(User, owner_id)
                if user and user.email:
                    subject = f"Deal Stage Update: {old_stage} → {new_stage}"
                    body = (
                        f"Hello {user.full_name or 'Team'},\n\n"
                        f"An opportunity you own has changed stage:\n"
                        f"  From: {old_stage}\n"
                        f"  To: {new_stage}\n\n"
                        f"Log in to Urban ERP to review the pipeline.\n\n"
                        f"Best regards,\nUrban ERP CRM"
                    )
                    await _send_system_email(to=[user.email], subject=subject, body=body)
        except Exception:
            logger.debug("CRM→Mail: Could not send stage change email")

    await _log_activity(
        "updated",
        f"Deal stage: {old_stage} → {new_stage}",
        "crm",
        owner_id,
        data,
    )


# ── 10. Calendar → Notifications: event reminder fires ──────────────────────

@event_bus.on("calendar.event.reminder")
async def on_calendar_event_reminder(data: dict) -> None:
    """Create a notification when a calendar event reminder fires."""
    logger.info(
        "Integration: calendar.event.reminder → Notification (event: %s)",
        data.get("title"),
    )

    organizer_id = data.get("organizer_id", "")
    event_title = data.get("title", "Upcoming Event")
    start_time = data.get("start_time", "")

    # Notify the organizer
    if organizer_id:
        await _create_notification(
            user_id=organizer_id,
            title="Event Reminder",
            message=f"Upcoming: {event_title} at {start_time}",
            notif_type="warning",
            module="calendar",
            link_url="/calendar",
        )

    # Notify all attendees
    attendees = data.get("attendees", [])
    for attendee_id in attendees:
        if attendee_id and attendee_id != organizer_id:
            await _create_notification(
                user_id=attendee_id,
                title="Event Reminder",
                message=f"Upcoming: {event_title} at {start_time}",
                notif_type="warning",
                module="calendar",
                link_url="/calendar",
            )


# ── 11. Meeting → Notes: auto-create meeting note when meeting ends ──────────

@event_bus.on("meeting.ended")
async def on_meeting_ended(data: dict) -> None:
    """Auto-create a blank meeting note for the organizer when a meeting ends."""
    meeting_id = data.get("meeting_id", "")
    organizer_id = data.get("organizer_id", "")
    title = data.get("title", "Meeting")

    logger.info(
        "Integration: meeting.ended → Notes auto-create (meeting: %s, organizer: %s)",
        meeting_id,
        organizer_id,
    )

    if not meeting_id or not organizer_id:
        return

    try:
        import uuid as _uuid  # noqa: PLC0415
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.notes import Note  # noqa: PLC0415
        from app.models.meetings import MeetingLink  # noqa: PLC0415
        from app.models.calendar import CalendarEvent  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            meeting_uuid = _uuid.UUID(meeting_id)
            organizer_uuid = _uuid.UUID(organizer_id)

            # Fetch meeting details for the note
            event = await db.get(CalendarEvent, meeting_uuid)
            if not event:
                logger.warning("Meeting→Notes: Meeting %s not found", meeting_id)
                return

            ended_at = data.get("ended_at", "")
            duration = data.get("duration_seconds")
            duration_str = f"{duration // 60}m {duration % 60}s" if duration else "N/A"

            attendee_list = event.attendees or []
            attendees_str = ", ".join(
                att.get("user_id", att) if isinstance(att, dict) else str(att)
                for att in attendee_list
            ) or "None"

            content = (
                f"# Meeting Notes: {title}\n\n"
                f"**Date:** {event.start_time.strftime('%B %d, %Y %I:%M %p')} - "
                f"{event.end_time.strftime('%I:%M %p')}\n"
                f"**Duration:** {duration_str}\n"
                f"**Attendees:** {attendees_str}\n"
            )
            if event.description:
                content += f"**Description:** {event.description}\n"
            content += "\n---\n\n## Key Discussion Points\n\n\n## Decisions Made\n\n\n## Action Items\n\n"

            note = Note(
                title=f"Meeting Notes: {title}",
                content=content,
                owner_id=organizer_uuid,
                tags=["meeting-note", "auto-generated"],
                linked_items=[{
                    "type": "meeting",
                    "id": meeting_id,
                    "title": title,
                }],
            )
            db.add(note)
            await db.flush()

            # Create a MeetingLink back-reference
            link = MeetingLink(
                meeting_id=meeting_uuid,
                link_type="note",
                entity_id=note.id,
                entity_title=note.title,
                created_by=organizer_uuid,
            )
            db.add(link)
            await db.commit()

            logger.info(
                "Meeting→Notes: Auto-created note '%s' (id: %s) for meeting %s",
                note.title, note.id, meeting_id,
            )

    except Exception:
        logger.exception("Meeting→Notes: Failed to auto-create meeting note")

    # Notify the organizer
    await _create_notification(
        user_id=organizer_id,
        title="Meeting Notes Created",
        message=f"Meeting notes for '{title}' have been auto-created. Edit them in Notes.",
        notif_type="info",
        module="meetings",
        link_url="/notes",
    )

    await _log_activity(
        "created",
        f"Auto-created meeting notes for: {title}",
        "meetings",
        organizer_id,
        data,
    )


# ── 12. Forms → CRM: auto-create lead from lead-capture form submission ──────

@event_bus.on("form.submitted")
async def on_form_submitted_lead_capture(data: dict) -> None:
    """When a form with crm_lead_capture setting is submitted, auto-create a CRM lead."""
    form_id = data.get("form_id")
    if not form_id:
        return

    try:
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.forms import Form  # noqa: PLC0415
        from app.models.crm import Contact, Lead  # noqa: PLC0415
        from sqlalchemy.orm import selectinload  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Form)
                .where(Form.id == form_id)
                .options(selectinload(Form.fields))
            )
            form = result.scalar_one_or_none()
            if not form:
                return

            settings = form.settings or {}
            if not settings.get("crm_lead_capture"):
                return  # Not a lead capture form

            logger.info(
                "Integration: form.submitted → CRM lead capture (form: %s)",
                form.title,
            )

            answers = data.get("answers", {})

            # Map field labels to answers
            field_map: dict[str, str] = {}
            for field in form.fields:
                label_lower = field.label.lower().strip()
                answer_val = answers.get(str(field.id), "")
                if answer_val:
                    field_map[label_lower] = str(answer_val)

            # Extract contact info from answers
            full_name = field_map.get("full name") or field_map.get("name") or ""
            email = field_map.get("email") or field_map.get("e-mail") or ""
            phone = field_map.get("phone") or field_map.get("phone number") or None
            company = field_map.get("company") or field_map.get("company name") or None
            message = field_map.get("message") or field_map.get("notes") or field_map.get("comment") or None

            if not full_name and not email:
                logger.warning("Lead capture form submitted but no name or email found in answers")
                return

            # Parse name
            name_parts = full_name.split(" ", 1)
            first_name = name_parts[0] if name_parts else None
            last_name = name_parts[1] if len(name_parts) > 1 else None

            owner_id = settings.get("auto_assign_to") or str(form.owner_id)

            # Check if contact with this email already exists
            contact_id = None
            if email:
                existing = await db.execute(
                    select(Contact).where(
                        Contact.email == email,
                        Contact.is_active == True,  # noqa: E712
                    )
                )
                existing_contact = existing.scalar_one_or_none()
                if existing_contact:
                    contact_id = existing_contact.id
                else:
                    contact = Contact(
                        contact_type="person",
                        first_name=first_name,
                        last_name=last_name,
                        email=email,
                        phone=phone,
                        company_name=company,
                        source="lead_capture_form",
                        owner_id=owner_id,
                        tags=["lead-capture"],
                    )
                    db.add(contact)
                    await db.flush()
                    contact_id = contact.id

            # Create lead
            lead = Lead(
                title=f"Lead: {full_name or email}" if full_name or email else f"Lead from {form.title}",
                contact_id=contact_id,
                status="new",
                source="lead_capture_form",
                notes=message,
                owner_id=owner_id,
                assigned_to=settings.get("auto_assign_to"),
            )
            db.add(lead)
            await db.commit()
            await db.refresh(lead)

            logger.info(
                "Form→CRM: Auto-created lead '%s' (id=%s) from form '%s'",
                lead.title, lead.id, form.title,
            )

            await _log_activity(
                "created",
                f"Lead auto-created from form: {form.title} — {full_name or email}",
                "crm",
                str(owner_id),
                {
                    "lead_id": str(lead.id),
                    "form_id": str(form_id),
                    "form_title": form.title,
                    "contact_email": email,
                },
            )

    except Exception:
        logger.exception("Form→CRM: Failed to auto-create lead from form submission")


# ── 13. Projects → Mail: send email when task is assigned ─────────────────

@event_bus.on("task.assigned")
async def on_task_assigned(data: dict) -> None:
    """Send email notification to the assignee when a task is assigned."""
    logger.info(
        "Integration: task.assigned → Mail + Notification (task: %s, assignee: %s)",
        data.get("task_id"),
        data.get("assignee_id"),
    )

    assignee_id = data.get("assignee_id", "")
    if not assignee_id:
        return

    task_title = data.get("title", "Untitled Task")
    project_name = data.get("project_name", "")
    project_id = data.get("project_id", "")

    # Create in-app notification
    await _create_notification(
        user_id=assignee_id,
        title="Task Assigned to You",
        message=f'"{task_title}" in project "{project_name}" has been assigned to you.',
        notif_type="info",
        module="projects",
        link_url=f"/projects/{project_id}",
    )

    # Send email to the assignee
    try:
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.user import User  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            user = await db.get(User, assignee_id)
            if user and user.email:
                subject = f"Task Assigned: {task_title}"
                body = (
                    f"Hello {user.full_name or 'Team Member'},\n\n"
                    f"You have been assigned a new task:\n\n"
                    f"  Task: {task_title}\n"
                    f"  Project: {project_name}\n\n"
                    f"Log in to Urban ERP to view the task details.\n\n"
                    f"Best regards,\nUrban ERP Projects"
                )
                await _send_system_email(to=[user.email], subject=subject, body=body)
    except Exception:
        logger.debug("Projects→Mail: Could not send task assignment email")

    await _log_activity(
        "assigned",
        f"Task assigned: {task_title} (project: {project_name})",
        "projects",
        data.get("assigned_by", ""),
        data,
    )


# ── 14. Projects → Mail: send email when task status changes ─────────────

@event_bus.on("task.status_changed")
async def on_task_status_changed(data: dict) -> None:
    """Send email notification to project owner when task status changes."""
    logger.info(
        "Integration: task.status_changed → Mail + Notification (task: %s, %s → %s)",
        data.get("task_id"),
        data.get("old_status"),
        data.get("new_status"),
    )

    owner_id = data.get("owner_id", "")
    task_title = data.get("title", "Untitled Task")
    project_name = data.get("project_name", "")
    project_id = data.get("project_id", "")
    old_status = data.get("old_status", "")
    new_status = data.get("new_status", "")

    # Notify the project owner
    if owner_id:
        await _create_notification(
            user_id=owner_id,
            title="Task Status Changed",
            message=f'"{task_title}" moved from {old_status} to {new_status} in "{project_name}".',
            notif_type="info",
            module="projects",
            link_url=f"/projects/{project_id}",
        )

    # Send email to project owner
    if owner_id:
        try:
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.models.user import User  # noqa: PLC0415

            async with AsyncSessionLocal() as db:
                user = await db.get(User, owner_id)
                if user and user.email:
                    subject = f"Task Update: {task_title} — {old_status} → {new_status}"
                    body = (
                        f"Hello {user.full_name or 'Project Owner'},\n\n"
                        f"A task in your project has changed status:\n\n"
                        f"  Task: {task_title}\n"
                        f"  Project: {project_name}\n"
                        f"  Status: {old_status} → {new_status}\n\n"
                        f"Log in to Urban ERP to review.\n\n"
                        f"Best regards,\nUrban ERP Projects"
                    )
                    await _send_system_email(to=[user.email], subject=subject, body=body)
        except Exception:
            logger.debug("Projects→Mail: Could not send status change email")

    # Also notify the assignee (if different from owner)
    assignee_id = data.get("assignee_id", "")
    if assignee_id and assignee_id != owner_id:
        await _create_notification(
            user_id=assignee_id,
            title="Task Status Changed",
            message=f'"{task_title}" moved from {old_status} to {new_status}.',
            notif_type="info",
            module="projects",
            link_url=f"/projects/{project_id}",
        )

    await _log_activity(
        "updated",
        f"Task status: {task_title} ({old_status} → {new_status})",
        "projects",
        "",
        data,
    )


# ── 15. E-Commerce → CRM: Auto-create/update CRM contact on order ─────────

@event_bus.on("ecommerce.order.created")
async def on_ecommerce_order_sync_crm(data: dict) -> None:
    """Auto-create or update a CRM contact from e-commerce customer data."""
    logger.info(
        "Integration: ecommerce.order.created → CRM contact sync (order: %s)",
        data.get("order_number"),
    )
    try:
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.ecommerce import EcomOrder, CustomerAccount  # noqa: PLC0415
        from app.models.crm import Contact  # noqa: PLC0415
        from sqlalchemy import select  # noqa: PLC0415
        from sqlalchemy.orm import selectinload  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(EcomOrder)
                .options(selectinload(EcomOrder.customer))
                .where(EcomOrder.id == data.get("order_id"))
            )
            order = result.scalar_one_or_none()
            if not order or not order.customer:
                return

            customer = order.customer

            # Already linked — update metadata
            if customer.crm_contact_id:
                contact = await db.get(Contact, customer.crm_contact_id)
                if contact:
                    metadata = contact.metadata_json or {}
                    metadata["last_ecom_order"] = data.get("order_number")
                    metadata["last_order_total"] = data.get("total")
                    metadata["total_orders"] = metadata.get("total_orders", 0) + 1
                    contact.metadata_json = metadata
                    await db.commit()
                return

            # Check if CRM contact with this email exists
            existing_result = await db.execute(
                select(Contact).where(Contact.email == customer.email)
            )
            existing_contact = existing_result.scalar_one_or_none()

            if existing_contact:
                customer.crm_contact_id = existing_contact.id
                metadata = existing_contact.metadata_json or {}
                metadata["ecom_customer_id"] = str(customer.id)
                metadata["last_ecom_order"] = data.get("order_number")
                metadata["total_orders"] = metadata.get("total_orders", 0) + 1
                existing_contact.metadata_json = metadata
                await db.commit()
            else:
                user_id = data.get("user_id", "")
                new_contact = Contact(
                    contact_type="person",
                    first_name=customer.first_name,
                    last_name=customer.last_name,
                    email=customer.email,
                    phone=customer.phone,
                    source="ecommerce",
                    owner_id=user_id,
                    metadata_json={
                        "ecom_customer_id": str(customer.id),
                        "last_ecom_order": data.get("order_number"),
                        "total_orders": 1,
                    },
                )
                db.add(new_contact)
                await db.flush()
                customer.crm_contact_id = new_contact.id
                await db.commit()

    except Exception:
        logger.exception("E-Commerce→CRM: Failed to sync CRM contact from order")


# ── 16. Supply Chain → Finance: Auto-create purchase invoice on PO completion ─

@event_bus.on("supplychain.po.completed")
async def on_supplychain_po_completed(data: dict) -> None:
    """Auto-create a purchase invoice in Finance when a supply chain PO is completed."""
    logger.info(
        "Integration: supplychain.po.completed → Finance purchase invoice (PO: %s)",
        data.get("po_number"),
    )
    try:
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.finance import Invoice  # noqa: PLC0415
        from app.models.inventory import PurchaseOrder, PurchaseOrderLine  # noqa: PLC0415
        from sqlalchemy import func, select  # noqa: PLC0415
        from sqlalchemy.orm import selectinload  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            po_id = data.get("po_id")
            if not po_id:
                return

            result = await db.execute(
                select(PurchaseOrder)
                .options(selectinload(PurchaseOrder.lines))
                .where(PurchaseOrder.id == po_id)
            )
            po = result.scalar_one_or_none()
            if not po:
                logger.warning("SupplyChain→Finance: PO %s not found", po_id)
                return

            today = date.today()
            count_result = await db.execute(
                select(func.count()).select_from(Invoice)
            )
            seq = (count_result.scalar() or 0) + 1
            inv_number = f"INV-PO-{today.year}-{seq:04d}"

            subtotal = sum(
                line.unit_price * line.received_quantity
                for line in (po.lines or [])
                if line.received_quantity > 0
            )
            tax_amount = subtotal * Decimal("0.16")
            total = subtotal + tax_amount

            items = [
                {
                    "description": f"PO Line — Item {line.item_id}",
                    "quantity": line.received_quantity,
                    "unit_price": float(line.unit_price),
                    "total": float(line.unit_price * line.received_quantity),
                }
                for line in (po.lines or [])
                if line.received_quantity > 0
            ]

            invoice = Invoice(
                invoice_number=inv_number,
                invoice_type="purchase",
                status="received",
                customer_name=po.supplier_name,
                customer_email=po.supplier_email,
                issue_date=today,
                due_date=today + timedelta(days=30),
                subtotal=subtotal,
                tax_amount=tax_amount,
                total=total,
                owner_id=data.get("user_id", po.owner_id),
                notes=f"Auto-generated from purchase order {po.po_number}",
                items=items,
            )
            db.add(invoice)
            await db.commit()
            logger.info(
                "SupplyChain→Finance: Created purchase invoice %s for PO %s",
                inv_number, po.po_number,
            )

    except Exception:
        logger.exception("SupplyChain→Finance: Failed to create purchase invoice from PO")

    admin_ids = await _get_app_admin_ids("finance")
    for uid in admin_ids:
        await _create_notification(
            user_id=uid,
            title="New Purchase Invoice (Supply Chain)",
            message=f"Purchase invoice created from PO {data.get('po_number', '')}.",
            notif_type="info",
            module="finance",
            link_url="/finance/invoices",
        )

    await _log_activity(
        "created",
        f"Purchase invoice from PO {data.get('po_number', '')}",
        "finance",
        data.get("user_id", ""),
        data,
    )


# ── HR → Mail: send email on leave approval / rejection ─────────────────────

@event_bus.on("leave.approved")
async def on_leave_approved_email(data: dict) -> None:
    """HR→Mail: send email notification when a leave request is approved."""
    logger.info("Integration: leave.approved → Mail notification (employee: %s)", data.get("employee_id"))
    try:
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.hr import Employee  # noqa: PLC0415
        from app.models.user import User  # noqa: PLC0415
        from sqlalchemy import select  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            # Resolve employee → user email
            emp_result = await db.execute(
                select(Employee).where(Employee.id == data.get("employee_id"))
            )
            employee = emp_result.scalar_one_or_none()
            if not employee:
                return

            user_result = await db.execute(
                select(User).where(User.id == employee.user_id)
            )
            user = user_result.scalar_one_or_none()
            if not user or not user.email:
                return

            subject = f"Leave Approved: {data.get('leave_type', 'Time Off')}"
            body = (
                f"Dear {user.full_name or 'Employee'},\n\n"
                f"Your leave request has been approved.\n\n"
                f"Type: {data.get('leave_type', 'N/A')}\n"
                f"Period: {data.get('start_date', '')} to {data.get('end_date', '')}\n\n"
                f"Regards,\nUrban ERP HR"
            )
            await _send_system_email(to=[user.email], subject=subject, body=body)
    except Exception:
        logger.exception("Failed to send leave approval email")


@event_bus.on("leave.rejected")
async def on_leave_rejected_email(data: dict) -> None:
    """HR→Mail: send email notification when a leave request is rejected."""
    logger.info("Integration: leave.rejected → Mail notification (employee: %s)", data.get("employee_id"))
    try:
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.hr import Employee  # noqa: PLC0415
        from app.models.user import User  # noqa: PLC0415
        from sqlalchemy import select  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            emp_result = await db.execute(
                select(Employee).where(Employee.id == data.get("employee_id"))
            )
            employee = emp_result.scalar_one_or_none()
            if not employee:
                return

            user_result = await db.execute(
                select(User).where(User.id == employee.user_id)
            )
            user = user_result.scalar_one_or_none()
            if not user or not user.email:
                return

            subject = f"Leave Rejected: {data.get('leave_type', 'Time Off')}"
            body = (
                f"Dear {user.full_name or 'Employee'},\n\n"
                f"Unfortunately, your leave request has been rejected.\n\n"
                f"Type: {data.get('leave_type', 'N/A')}\n"
                f"Period: {data.get('start_date', '')} to {data.get('end_date', '')}\n\n"
                f"Please contact your HR administrator for further details.\n\n"
                f"Regards,\nUrban ERP HR"
            )
            await _send_system_email(to=[user.email], subject=subject, body=body)
    except Exception:
        logger.exception("Failed to send leave rejection email")


# ── Calendar → Mail: send invite emails to attendees ────────────────────────

@event_bus.on("calendar.event.created")
async def on_calendar_event_created_email(data: dict) -> None:
    """Calendar→Mail: send email invites to all attendees when a calendar event is created."""
    attendees = data.get("attendees") or []
    if not attendees:
        return

    logger.info(
        "Integration: calendar.event.created → Mail invites (%d attendees, event: %s)",
        len(attendees), data.get("title"),
    )
    try:
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.user import User  # noqa: PLC0415
        from sqlalchemy import select  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            # Resolve organizer name
            organizer_name = "Someone"
            organizer_id = data.get("organizer_id")
            if organizer_id:
                org_result = await db.execute(select(User).where(User.id == organizer_id))
                org_user = org_result.scalar_one_or_none()
                if org_user:
                    organizer_name = org_user.full_name or org_user.email

            # Resolve attendee emails
            attendee_emails: list[str] = []
            for att in attendees:
                att_id = att if isinstance(att, str) else att.get("user_id") if isinstance(att, dict) else None
                if not att_id:
                    continue
                try:
                    from uuid import UUID  # noqa: PLC0415
                    att_uuid = UUID(att_id)
                    user_result = await db.execute(select(User).where(User.id == att_uuid))
                    att_user = user_result.scalar_one_or_none()
                    if att_user and att_user.email:
                        attendee_emails.append(att_user.email)
                except (ValueError, Exception):
                    # att_id might already be an email
                    if "@" in str(att_id):
                        attendee_emails.append(str(att_id))

            if not attendee_emails:
                return

            subject = f"Calendar Invite: {data.get('title', 'Event')}"
            body = (
                f"You have been invited to an event by {organizer_name}.\n\n"
                f"Event: {data.get('title', 'Untitled')}\n"
                f"Start: {data.get('start_time', '')}\n"
                f"End: {data.get('end_time', '')}\n"
                f"Type: {data.get('event_type', 'event')}\n"
            )
            location = data.get("location")
            if location:
                body += f"Location: {location}\n"
            description = data.get("description")
            if description:
                body += f"\nDetails: {description}\n"
            body += "\nRegards,\nUrban ERP Calendar"

            await _send_system_email(to=attendee_emails, subject=subject, body=body)
    except Exception:
        logger.exception("Failed to send calendar event invite emails")


# ── Support: apply ticket routing rules on creation ─────────────────────────

@event_bus.on("support.ticket.created")
async def on_ticket_created_apply_routing(data: dict) -> None:
    """Support: apply routing rules to auto-assign/re-prioritize newly created tickets."""
    ticket_id = data.get("ticket_id")
    if not ticket_id:
        return

    logger.info("Integration: support.ticket.created → Apply routing rules (ticket: %s)", data.get("ticket_number"))
    try:
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.support import Ticket  # noqa: PLC0415
        from sqlalchemy import select  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            # Load routing rules
            try:
                from app.models.support import TicketRoutingRule  # noqa: PLC0415
            except ImportError:
                return  # model not yet migrated

            rules_result = await db.execute(
                select(TicketRoutingRule)
                .where(TicketRoutingRule.is_active == True)  # noqa: E712
                .order_by(TicketRoutingRule.priority_order.asc())
            )
            rules = rules_result.scalars().all()
            if not rules:
                return

            ticket = await db.get(Ticket, ticket_id)
            if not ticket:
                return

            for rule in rules:
                if _ticket_matches_rule(ticket, data, rule):
                    if rule.assign_to and not ticket.assigned_to:
                        ticket.assigned_to = rule.assign_to
                    if rule.priority_override:
                        ticket.priority = rule.priority_override
                    if rule.category_override:
                        ticket.category_id = rule.category_override
                    logger.info(
                        "Routing rule '%s' applied to ticket %s (assign=%s, priority=%s)",
                        rule.name, ticket.ticket_number, rule.assign_to, rule.priority_override,
                    )
                    break  # first matching rule wins

            await db.commit()
    except Exception:
        logger.exception("Failed to apply routing rules to ticket %s", ticket_id)


def _ticket_matches_rule(ticket, data: dict, rule) -> bool:
    """Check if a ticket matches a routing rule's conditions.

    Conditions JSON format: {
        "subject_contains": "urgent",
        "priority": "high",
        "customer_email_domain": "vip.com",
        "tags_include": ["billing"],
        "category_id": "uuid-string",
    }
    """
    conditions = rule.conditions or {}
    if not conditions:
        return True  # empty conditions = match all

    subject = (data.get("subject") or ticket.subject or "").lower()
    priority = data.get("priority") or ticket.priority or ""
    customer_email = data.get("customer_email") or ticket.customer_email or ""
    tags = ticket.tags or []

    if "subject_contains" in conditions:
        if conditions["subject_contains"].lower() not in subject:
            return False

    if "priority" in conditions:
        if conditions["priority"] != priority:
            return False

    if "customer_email_domain" in conditions:
        domain = conditions["customer_email_domain"].lower()
        if not customer_email.lower().endswith(f"@{domain}"):
            return False

    if "tags_include" in conditions:
        required_tags = set(conditions["tags_include"])
        if not required_tags.issubset(set(tags)):
            return False

    if "category_id" in conditions:
        if str(ticket.category_id) != conditions["category_id"]:
            return False

    return True


# ── 18. Forms → Mail: email notification on submission to form owner ──────────

@event_bus.on("form.submitted")
async def on_form_submitted_email_owner(data: dict) -> None:
    """Send an email notification to the form owner when a response is submitted."""
    form_id = data.get("form_id")
    form_title = data.get("form_title", "Untitled Form")
    response_id = data.get("response_id", "")
    respondent_id = data.get("respondent_id")

    logger.info(
        "Integration: form.submitted → email notification to form owner (form: %s, response: %s)",
        form_title,
        response_id,
    )

    try:
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415
        from app.models.forms import Form  # noqa: PLC0415
        from app.models.user import User  # noqa: PLC0415
        from sqlalchemy import select  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            form = await db.get(Form, form_id)
            if not form:
                logger.warning("Form not found for email notification: %s", form_id)
                return

            owner = await db.get(User, form.owner_id)
            if not owner or not getattr(owner, "email", None):
                logger.warning("Form owner not found or has no email: %s", form.owner_id)
                return

            respondent_info = "Anonymous"
            if respondent_id:
                respondent = await db.get(User, respondent_id)
                if respondent:
                    respondent_info = (
                        getattr(respondent, "email", None)
                        or getattr(respondent, "full_name", str(respondent_id))
                    )

            answers_summary = ""
            answers = data.get("answers", {})
            if answers:
                answer_lines = []
                for field_id, value in list(answers.items())[:10]:
                    display_val = ", ".join(value) if isinstance(value, list) else str(value)
                    answer_lines.append(f"  - {field_id}: {display_val}")
                answers_summary = "\n".join(answer_lines)

            subject = f"New response to your form: {form_title}"
            body = (
                f"A new response has been submitted to your form \"{form_title}\".\n\n"
                f"Respondent: {respondent_info}\n"
                f"Response ID: {response_id}\n"
            )
            if answers_summary:
                body += f"\nAnswers:\n{answers_summary}\n"
            body += "\nView all responses in Urban ERP."

            await _send_system_email(
                to=[owner.email],
                subject=subject,
                body=body,
            )

            # Also create an in-app notification for the form owner
            await _create_notification(
                user_id=str(form.owner_id),
                title="New Form Response",
                message=f'New response to "{form_title}" from {respondent_info}',
                notif_type="info",
                module="forms",
                link_url=f"/forms/{form_id}/responses",
            )

    except Exception:
        logger.exception("Failed to send form submission email notification for form %s", form_id)


def register_integration_handlers() -> None:
    """No-op function — importing this module registers the @event_bus.on decorators.

    Call this from main.py to ensure the module is imported and handlers are registered.
    """
    logger.info(
        "Cross-module integration handlers registered: "
        "pos.sale.completed, ecommerce.order.created, ecommerce.order.shipped, "
        "inventory.valuation.changed, supplychain.goods_received, wo.completed, "
        "support.ticket.created, opportunity.stage_changed, calendar.event.reminder, "
        "meeting.ended, form.submitted (lead capture + email notification), "
        "task.assigned, task.status_changed, "
        "ecommerce.order.created (CRM sync), supplychain.po.completed, "
        "leave.approved (→ Mail), leave.rejected (→ Mail), "
        "calendar.event.created (→ Mail invites), "
        "support.ticket.created (→ routing rules)"
    )
