from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.database import create_all_tables
from app.core.etag_middleware import ETagMiddleware
from app.core.events import event_bus
from app.core.ip_filter import ip_filter_middleware
from app.core.logging_config import RequestIDMiddleware, setup_logging
from app.core.rate_limit import limiter
from app.core.security_headers import SecurityHeadersMiddleware
from app.core.timing_middleware import TimingMiddleware
from app.core.audit_listeners import (
    audit_ip_address,
    audit_user_id,
    register_audit_listeners,
)

setup_logging()

logger = logging.getLogger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Run startup tasks before serving, and cleanup on shutdown."""
    logger.info("Starting %s ...", settings.APP_NAME)

    # Validate that default dev secrets are not used in production
    from app.core.secrets_validator import validate_production_secrets  # noqa: PLC0415
    validate_production_secrets()

    # Create database tables in dev mode; use Alembic migrations in production
    if settings.DEBUG:
        await create_all_tables()
        logger.info("Database tables ensured (DEBUG mode).")
    else:
        logger.info("Skipping create_all_tables — use 'alembic upgrade head' for migrations.")

    # Seed first super-admin if not present
    await _seed_superadmin()
    logger.info("Super-admin seed complete.")

    # Seed permissions and system roles
    await _seed_permissions()
    logger.info("Permission seed complete.")

    # Start Redis event bus
    _register_event_handlers()
    # Register project automation event handlers
    _register_automation_handlers()
    # Register cross-module integration handlers (POS→Finance, E-Commerce→Mail, etc.)
    from app.core.integration_handlers import register_integration_handlers  # noqa: PLC0415
    register_integration_handlers()
    # Register mail → calendar scheduling intent handler
    from app.services.mail_calendar_scanner import on_mail_received_calendar  # noqa: PLC0415
    event_bus.on("mail.received")(on_mail_received_calendar)
    # Register universal audit trail listeners
    register_audit_listeners()
    await event_bus.start()
    logger.info("Event bus started.")

    yield  # ← application runs here

    await event_bus.stop()
    logger.info("Event bus stopped.")
    logger.info("Shutting down %s.", settings.APP_NAME)


def _register_automation_handlers() -> None:
    """Register project automation engine handlers on the event bus."""

    @event_bus.on("task.status_changed")
    @event_bus.on("task.assigned")
    @event_bus.on("task.created")
    async def _handle_automation_trigger(event_name: str, data: dict) -> None:
        """Run matching automation rules for project task events."""
        try:
            from app.services.automation_engine import run_automations_for_event  # noqa: PLC0415
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415

            async with AsyncSessionLocal() as session:
                executed = await run_automations_for_event(session, event_name, data)
                if executed:
                    logger.info("Executed %d automation rules for %s", executed, event_name)
        except Exception:
            logger.exception("Automation engine error for %s", event_name)


def _register_event_handlers() -> None:
    """Register cross-module event handlers on the event bus."""

    async def _log_activity(activity_type: str, message: str, module: str, user_id: str, metadata: dict | None = None) -> None:
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

    async def _create_notification(user_id: str, title: str, message: str, notif_type: str = "info", module: str | None = None, link_url: str | None = None) -> None:
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
                # App admins for this app
                res = await db.execute(select(AppAdmin.user_id).where(AppAdmin.app_name == app_name))
                ids = [str(r) for r in res.scalars().all()]
                # Super admins
                res2 = await db.execute(select(User.id).where(User.is_superadmin == True))  # noqa: E712
                ids += [str(r) for r in res2.scalars().all()]
                return list(set(ids))
        except Exception:
            logger.exception("Failed to get app admin ids for %s", app_name)
            return []

    @event_bus.on("meeting.created")
    async def on_meeting_created(data: dict) -> None:
        logger.info("Event: meeting.created — %s (organizer: %s)", data.get("title"), data.get("organizer_id"))
        # Auto-create calendar event for meeting attendees
        try:
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.models.calendar import CalendarEvent  # noqa: PLC0415
            async with AsyncSessionLocal() as db:
                cal_event = CalendarEvent(
                    title=data.get("title", "Meeting"),
                    start_time=data.get("start_time"),
                    end_time=data.get("end_time"),
                    event_type="meeting",
                    organizer_id=data.get("organizer_id"),
                    attendees=data.get("attendees", []),
                    jitsi_room=data.get("jitsi_room"),
                    color="#51459d",
                )
                db.add(cal_event)
                await db.commit()
                logger.info("Auto-created calendar event for meeting: %s", data.get("title"))
        except Exception:
            logger.exception("Failed to auto-create calendar event for meeting")

        await _log_activity("created", f"Meeting scheduled: {data.get('title')}", "meetings", data.get("organizer_id", ""), data)

    @event_bus.on("calendar.event.created")
    async def on_calendar_event_created(data: dict) -> None:
        logger.info("Event: calendar.event.created — %s", data.get("title"))
        # Calendar is REST-first (no CalDAV sync).
        await _log_activity("created", f"Calendar event: {data.get('title')}", "calendar", data.get("organizer_id", ""), data)

    @event_bus.on("file.uploaded")
    async def on_file_uploaded(data: dict) -> None:
        logger.info("Event: file.uploaded — %s (%s bytes)", data.get("name"), data.get("size"))
        await _log_activity("created", f"File uploaded: {data.get('name')}", "drive", data.get("owner_id", ""), data)

    @event_bus.on("file.deleted")
    async def on_file_deleted(data: dict) -> None:
        logger.info("Event: file.deleted — %s", data.get("name"))
        await _log_activity("deleted", f"File deleted: {data.get('name')}", "drive", data.get("owner_id", ""), data)

    @event_bus.on("file.shared")
    async def on_file_shared(data: dict) -> None:
        logger.info("Event: file.shared — %s shared by %s", data.get("name"), data.get("shared_by"))
        await _log_activity("shared", f"File shared: {data.get('name')} ({data.get('permission')})", "drive", data.get("shared_by", ""), data)
        shared_with = data.get("shared_with_user_id")
        if shared_with:
            await _create_notification(
                user_id=shared_with,
                title="File Shared With You",
                message=f"'{data.get('name', 'A file')}' has been shared with you ({data.get('permission', 'view')} access).",
                notif_type="info",
                module="drive",
                link_url="/drive",
            )

    @event_bus.on("folder.shared")
    async def on_folder_shared(data: dict) -> None:
        logger.info("Event: folder.shared — %s shared by %s", data.get("name"), data.get("shared_by"))
        await _log_activity("shared", f"Folder shared: {data.get('name')} ({data.get('permission')})", "drive", data.get("shared_by", ""), data)

    @event_bus.on("meeting.deleted")
    async def on_meeting_deleted(data: dict) -> None:
        logger.info("Event: meeting.deleted — %s", data.get("meeting_id"))
        await _log_activity("deleted", f"Meeting cancelled", "meetings", data.get("organizer_id", ""), data)

    @event_bus.on("invoice.sent")
    async def on_invoice_sent(data: dict) -> None:
        logger.info("Event: invoice.sent — %s", data.get("invoice_number"))
        await _log_activity("updated", f"Invoice sent: {data.get('invoice_number')}", "finance", data.get("owner_id", ""), data)
        # Notify finance admins
        admin_ids = await _get_app_admin_ids("finance")
        for uid in admin_ids:
            await _create_notification(
                user_id=uid,
                title="Invoice Sent",
                message=f"Invoice {data.get('invoice_number', '')} sent to {data.get('customer_name', '')}",
                notif_type="info",
                module="finance",
                link_url=f"/finance/invoices/{data.get('invoice_id', '')}",
            )
        # Auto-post AR journal entry: DR Accounts Receivable / CR Revenue
        invoice_id = data.get("invoice_id")
        if invoice_id:
            try:
                from app.core.database import AsyncSessionLocal as _ASL  # noqa: PLC0415
                from app.services.finance_auto_je import on_invoice_sent as _auto_je_sent  # noqa: PLC0415
                import uuid as _uuid  # noqa: PLC0415
                async with _ASL() as db:
                    await _auto_je_sent(db, _uuid.UUID(str(invoice_id)))
                    await db.commit()
                logger.info("Auto-posted AR journal entry for invoice %s", invoice_id)
            except Exception:
                logger.exception("Failed to auto-post JE for invoice.sent")

    @event_bus.on("payment.received")
    async def on_payment_received(data: dict) -> None:
        logger.info("Event: payment.received — %s", data.get("payment_number"))
        await _log_activity("created", f"Payment received: {data.get('payment_number')}", "finance", data.get("payer_id", ""), data)
        # Auto-post cash receipt: DR Cash / CR Accounts Receivable
        invoice_id = data.get("invoice_id")
        if invoice_id:
            try:
                from app.core.database import AsyncSessionLocal as _ASL  # noqa: PLC0415
                from app.services.finance_auto_je import on_invoice_paid as _auto_je_paid  # noqa: PLC0415
                import uuid as _uuid  # noqa: PLC0415
                async with _ASL() as db:
                    await _auto_je_paid(db, _uuid.UUID(str(invoice_id)))
                    await db.commit()
                logger.info("Auto-posted cash receipt JE for invoice %s", invoice_id)
            except Exception:
                logger.exception("Failed to auto-post JE for payment.received")

    @event_bus.on("expense.approved")
    async def on_expense_approved_je(data: dict) -> None:
        """Auto-post expense journal entry on approval."""
        expense_id = data.get("expense_id")
        if expense_id:
            try:
                from app.core.database import AsyncSessionLocal as _ASL  # noqa: PLC0415
                from app.services.finance_auto_je import on_expense_approved as _auto_je_exp  # noqa: PLC0415
                import uuid as _uuid  # noqa: PLC0415
                approver_id = data.get("approver_id")
                async with _ASL() as db:
                    await _auto_je_exp(
                        db,
                        _uuid.UUID(str(expense_id)),
                        _uuid.UUID(str(approver_id)) if approver_id else None,
                    )
                    await db.commit()
                logger.info("Auto-posted expense JE for expense %s", expense_id)
            except Exception:
                logger.exception("Failed to auto-post JE for expense.approved")

    @event_bus.on("asset.depreciated")
    async def on_asset_depreciated_je(data: dict) -> None:
        """Auto-post depreciation journal entry."""
        asset_id = data.get("asset_id")
        depreciation_amount = data.get("depreciation_amount")
        if asset_id and depreciation_amount:
            try:
                from app.core.database import AsyncSessionLocal as _ASL  # noqa: PLC0415
                from app.services.finance_auto_je import on_asset_depreciated as _auto_je_dep  # noqa: PLC0415
                from decimal import Decimal as _Dec  # noqa: PLC0415
                import uuid as _uuid  # noqa: PLC0415
                async with _ASL() as db:
                    await _auto_je_dep(db, _uuid.UUID(str(asset_id)), _Dec(str(depreciation_amount)))
                    await db.commit()
                logger.info("Auto-posted depreciation JE for asset %s", asset_id)
            except Exception:
                logger.exception("Failed to auto-post JE for asset.depreciated")

    # ── COGS Automation: POS sale + E-Commerce order → auto-post COGS JE ────
    @event_bus.on("pos.sale.completed")
    async def on_pos_sale_cogs(data: dict) -> None:
        """Auto-post COGS journal entry when a POS sale is completed."""
        logger.info("Event: pos.sale.completed — sale %s", data.get("sale_id"))
        try:
            import uuid as _uuid
            from decimal import Decimal as _Dec
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.services.finance_auto_je import on_cogs_posted as _cogs_je  # noqa: PLC0415

            sale_id = data.get("sale_id")
            cogs_amount = data.get("cogs_amount") or data.get("cost_of_goods_sold")
            if sale_id and cogs_amount:
                async with AsyncSessionLocal() as db:
                    await _cogs_je(db, str(sale_id), _Dec(str(cogs_amount)), "pos")
                    await db.commit()
                logger.info("Auto-posted COGS JE for POS sale %s (amount: %s)", sale_id, cogs_amount)
        except Exception:
            logger.exception("Failed to auto-post COGS JE for pos.sale.completed")

    @event_bus.on("ecommerce.order.paid")
    async def on_ecommerce_order_cogs(data: dict) -> None:
        """Auto-post COGS journal entry when an e-commerce order is paid."""
        logger.info("Event: ecommerce.order.paid — order %s", data.get("order_id"))
        try:
            from decimal import Decimal as _Dec
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.services.finance_auto_je import on_cogs_posted as _cogs_je  # noqa: PLC0415

            order_id = data.get("order_id")
            cogs_amount = data.get("cogs_amount") or data.get("cost_of_goods_sold")
            if order_id and cogs_amount:
                async with AsyncSessionLocal() as db:
                    await _cogs_je(db, str(order_id), _Dec(str(cogs_amount)), "ecommerce")
                    await db.commit()
                logger.info("Auto-posted COGS JE for e-commerce order %s (amount: %s)", order_id, cogs_amount)
        except Exception:
            logger.exception("Failed to auto-post COGS JE for ecommerce.order.paid")

    @event_bus.on("leave.approved")
    async def on_leave_approved(data: dict) -> None:
        logger.info("Event: leave.approved — employee %s", data.get("employee_id"))
        # Auto-create calendar event for the leave period
        try:
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.models.calendar import CalendarEvent  # noqa: PLC0415
            from datetime import datetime, timezone  # noqa: PLC0415
            async with AsyncSessionLocal() as db:
                start_str = data.get("start_date", "")
                end_str = data.get("end_date", "")
                if start_str and end_str:
                    start_dt = datetime.fromisoformat(start_str).replace(hour=0, minute=0, tzinfo=timezone.utc) if isinstance(start_str, str) else start_str
                    end_dt = datetime.fromisoformat(end_str).replace(hour=23, minute=59, tzinfo=timezone.utc) if isinstance(end_str, str) else end_str
                    cal_event = CalendarEvent(
                        title=f"Leave: {data.get('leave_type', 'Time Off')}",
                        start_time=start_dt,
                        end_time=end_dt,
                        event_type="holiday",
                        all_day=True,
                        organizer_id=data.get("user_id", data.get("approved_by", "")),
                        color="#ffa21d",
                    )
                    db.add(cal_event)
                    await db.commit()
                    logger.info("Auto-created calendar event for approved leave")
        except Exception:
            logger.exception("Failed to create calendar event for approved leave")

        await _log_activity("approved", f"Leave approved: {data.get('leave_type')}", "hr", data.get("approved_by", ""), data)
        # Notify the employee who requested leave
        employee_user_id = data.get("user_id", "")
        if employee_user_id:
            await _create_notification(
                user_id=employee_user_id,
                title="Leave Approved",
                message=f"Your {data.get('leave_type', 'leave')} request from {data.get('start_date', '')} to {data.get('end_date', '')} has been approved.",
                notif_type="success",
                module="hr",
                link_url="/hr/leave",
            )

    @event_bus.on("leave.rejected")
    async def on_leave_rejected(data: dict) -> None:
        logger.info("Event: leave.rejected — employee %s", data.get("employee_id"))
        await _log_activity("rejected", f"Leave rejected: {data.get('leave_type')}", "hr", data.get("rejected_by", ""), data)
        # Notify the employee who requested leave
        employee_user_id = data.get("user_id", "")
        if not employee_user_id:
            # Resolve user_id from employee_id
            try:
                from app.core.database import AsyncSessionLocal as _ASL  # noqa: PLC0415
                from app.models.hr import Employee as _Emp  # noqa: PLC0415
                from sqlalchemy import select as _sel  # noqa: PLC0415
                async with _ASL() as _db:
                    _res = await _db.execute(_sel(_Emp.user_id).where(_Emp.id == data.get("employee_id")))
                    employee_user_id = str(_res.scalar() or "")
            except Exception:
                pass
        if employee_user_id:
            await _create_notification(
                user_id=employee_user_id,
                title="Leave Rejected",
                message=f"Your {data.get('leave_type', 'leave')} request from {data.get('start_date', '')} to {data.get('end_date', '')} has been rejected.",
                notif_type="warning",
                module="hr",
                link_url="/hr/leave",
            )

    @event_bus.on("deal.closed")
    async def on_deal_closed(data: dict) -> None:
        logger.info("Event: deal.closed — %s (value: %s)", data.get("title"), data.get("deal_value"))
        # Auto-create draft invoice for closed deal
        try:
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.models.finance import Invoice  # noqa: PLC0415
            from datetime import date, timedelta  # noqa: PLC0415
            from sqlalchemy import func, select  # noqa: PLC0415
            async with AsyncSessionLocal() as db:
                # Generate invoice number
                count_q = select(func.count()).select_from(Invoice)
                count_result = await db.execute(count_q)
                seq = (count_result.scalar() or 0) + 1
                today = date.today()
                inv_number = f"INV-{today.year}-{seq:04d}"

                invoice = Invoice(
                    invoice_number=inv_number,
                    invoice_type="sales",
                    status="draft",
                    customer_name=data.get("contact_name", ""),
                    issue_date=today,
                    due_date=today + timedelta(days=30),
                    subtotal=data.get("deal_value", 0),
                    total=data.get("deal_value", 0),
                    owner_id=data.get("owner_id", ""),
                    items=[{"description": f"Deal: {data.get('title', '')}", "quantity": 1, "unit_price": data.get("deal_value", 0)}],
                )
                db.add(invoice)
                await db.commit()
                logger.info("Auto-created draft invoice %s for deal: %s", inv_number, data.get("title"))
        except Exception:
            logger.exception("Failed to create draft invoice for closed deal")

        await _log_activity("created", f"Deal closed: {data.get('title')} (${data.get('deal_value', 0):,.2f})", "crm", data.get("owner_id", ""), data)

    @event_bus.on("lead.converted")
    async def on_lead_converted(data: dict) -> None:
        logger.info("Event: lead.converted — %s", data.get("title"))
        await _log_activity("updated", f"Lead converted: {data.get('title')}", "crm", data.get("owner_id", ""), data)

    @event_bus.on("lead.created")
    async def on_lead_created_auto_score(data: dict) -> None:
        """Auto-score new leads using configurable scoring rules."""
        try:
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.services.crm_scoring import score_lead  # noqa: PLC0415
            async with AsyncSessionLocal() as db:
                lead_id = data.get("lead_id")
                if lead_id:
                    result = await score_lead(db, lead_id)
                    await db.commit()
                    logger.info("Auto-scored lead %s: %s", lead_id, result.get("score"))
        except Exception:
            logger.exception("Failed to auto-score new lead")

    @event_bus.on("contact.created")
    async def on_contact_created_detect_dupes(data: dict) -> None:
        """Async duplicate detection when a new contact is created."""
        try:
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.services.crm_duplicates import detect_duplicates  # noqa: PLC0415
            async with AsyncSessionLocal() as db:
                new = await detect_duplicates(db)
                await db.commit()
                if new:
                    logger.info("Detected %d new duplicate candidates after contact creation", len(new))
        except Exception:
            logger.exception("Failed to run duplicate detection after contact creation")

    @event_bus.on("ticket.created")
    async def on_ticket_created_workflow(data: dict) -> None:
        """Trigger CRM workflows when a ticket is created."""
        try:
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.services.crm_workflow_engine import trigger_workflows_for_event  # noqa: PLC0415
            async with AsyncSessionLocal() as db:
                count = await trigger_workflows_for_event(db, "ticket.created", data)
                await db.commit()
                if count:
                    logger.info("Triggered %d workflows for ticket.created", count)
        except Exception:
            logger.exception("Failed to trigger workflows for ticket.created")

    @event_bus.on("deal.closed")
    async def on_deal_closed_workflow(data: dict) -> None:
        """Trigger CRM workflows when a deal is closed."""
        try:
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.services.crm_workflow_engine import trigger_workflows_for_event  # noqa: PLC0415
            async with AsyncSessionLocal() as db:
                count = await trigger_workflows_for_event(db, "deal.closed", data)
                await db.commit()
                if count:
                    logger.info("Triggered %d workflows for deal.closed", count)
        except Exception:
            logger.exception("Failed to trigger workflows for deal.closed")

    @event_bus.on("stock.low")
    async def on_stock_low(data: dict) -> None:
        logger.info("Event: stock.low — item %s (on_hand: %s, reorder: %s)", data.get("item_name"), data.get("quantity_on_hand"), data.get("reorder_level"))
        admin_ids = await _get_app_admin_ids("inventory")
        for uid in admin_ids:
            await _create_notification(
                user_id=uid,
                title="Low Stock Alert",
                message=f"{data.get('item_name', 'Item')} (SKU: {data.get('sku', '')}) is below reorder level. On hand: {data.get('quantity_on_hand', 0)}, Reorder at: {data.get('reorder_level', 0)}",
                notif_type="warning",
                module="inventory",
                link_url=f"/inventory/reorder-alerts",
            )
        await _log_activity("alert", f"Low stock: {data.get('item_name')} (on hand: {data.get('quantity_on_hand', 0)})", "inventory", "", data)

    @event_bus.on("po.received")
    async def on_po_received(data: dict) -> None:
        logger.info("Event: po.received — PO %s from %s", data.get("po_number"), data.get("supplier_name"))
        admin_ids = await _get_app_admin_ids("inventory")
        for uid in admin_ids:
            await _create_notification(
                user_id=uid,
                title="Purchase Order Received",
                message=f"PO {data.get('po_number', '')} from {data.get('supplier_name', '')} has been received and stock updated.",
                notif_type="success",
                module="inventory",
                link_url=f"/inventory/purchase-orders",
            )
        await _log_activity("updated", f"PO received: {data.get('po_number')} from {data.get('supplier_name')}", "inventory", data.get("owner_id", ""), data)

    @event_bus.on("task.created")
    async def on_task_created(data: dict) -> None:
        logger.info("Event: task.created — %s (project: %s)", data.get("title"), data.get("project_name"))
        due_date_str = data.get("due_date")
        if due_date_str:
            try:
                from app.core.database import AsyncSessionLocal  # noqa: PLC0415
                from app.models.calendar import CalendarEvent  # noqa: PLC0415
                from datetime import datetime, timedelta, timezone  # noqa: PLC0415
                async with AsyncSessionLocal() as db:
                    due_dt = datetime.fromisoformat(due_date_str)
                    if due_dt.tzinfo is None:
                        due_dt = due_dt.replace(tzinfo=timezone.utc)
                    # Create a 1-hour calendar event at the due_date time
                    cal_event = CalendarEvent(
                        title=f"Task Due: {data.get('title', '')} [{data.get('project_name', '')}]",
                        description=f"Project task deadline. Task ID: {data.get('task_id', '')}",
                        start_time=due_dt,
                        end_time=due_dt + timedelta(hours=1),
                        event_type="task",
                        organizer_id=data.get("assignee_id") or "",
                        color="#ff3a6e",
                    )
                    db.add(cal_event)
                    await db.commit()
                    logger.info("Auto-created calendar event for task: %s", data.get("title"))
            except Exception:
                logger.exception("Failed to create calendar event for task.created")

        await _log_activity("created", f"Task created: {data.get('title')} in {data.get('project_name', 'project')}", "projects", data.get("assignee_id", ""), data)
        # Notify assignee
        assignee_id = data.get("assignee_id")
        if assignee_id:
            await _create_notification(
                user_id=assignee_id,
                title="New Task Assigned",
                message=f"You have been assigned the task '{data.get('title', '')}' in project '{data.get('project_name', '')}'.",
                notif_type="info",
                module="projects",
                link_url=f"/projects",
            )

    @event_bus.on("task.updated")
    async def on_task_updated(data: dict) -> None:
        logger.info("Event: task.updated — %s (due_date changed)", data.get("title"))
        due_date_str = data.get("due_date")
        task_id = data.get("task_id", "")
        if due_date_str:
            try:
                from app.core.database import AsyncSessionLocal  # noqa: PLC0415
                from app.models.calendar import CalendarEvent  # noqa: PLC0415
                from datetime import datetime, timedelta, timezone  # noqa: PLC0415
                from sqlalchemy import select  # noqa: PLC0415
                async with AsyncSessionLocal() as db:
                    due_dt = datetime.fromisoformat(due_date_str)
                    if due_dt.tzinfo is None:
                        due_dt = due_dt.replace(tzinfo=timezone.utc)
                    # Try to find existing calendar event for this task
                    result = await db.execute(
                        select(CalendarEvent).where(
                            CalendarEvent.description.contains(f"Task ID: {task_id}"),
                            CalendarEvent.event_type == "task",
                        )
                    )
                    existing = result.scalar_one_or_none()
                    if existing:
                        existing.start_time = due_dt
                        existing.end_time = due_dt + timedelta(hours=1)
                        existing.title = f"Task Due: {data.get('title', '')} [{data.get('project_name', '')}]"
                    else:
                        cal_event = CalendarEvent(
                            title=f"Task Due: {data.get('title', '')} [{data.get('project_name', '')}]",
                            description=f"Project task deadline. Task ID: {task_id}",
                            start_time=due_dt,
                            end_time=due_dt + timedelta(hours=1),
                            event_type="task",
                            organizer_id=data.get("assignee_id") or "",
                            color="#ff3a6e",
                        )
                        db.add(cal_event)
                    await db.commit()
                    logger.info("Updated calendar event for task: %s", data.get("title"))
            except Exception:
                logger.exception("Failed to update calendar event for task.updated")

        await _log_activity("updated", f"Task due date changed: {data.get('title')} in {data.get('project_name', 'project')}", "projects", data.get("assignee_id", ""), data)

    @event_bus.on("task.updated")
    async def on_task_updated_erp_context_sync(data: dict) -> None:
        """Sync erp_context-linked CalendarEvent blocks when a task is updated.

        Delegates to the calendar_task_sync service which handles the
        ``erp_context``-based linking introduced by auto_block_task_time.
        Skips events originating from the sync service itself to prevent loops.
        """
        from app.services.calendar_task_sync import on_task_updated_calendar_sync  # noqa: PLC0415
        await on_task_updated_calendar_sync(data)

    @event_bus.on("payslip.approved")
    async def on_payslip_approved(data: dict) -> None:
        logger.info("Event: payslip.approved — payslip %s for employee %s", data.get("payslip_id"), data.get("employee_id"))
        # Notify the employee's user account
        employee_user_id = data.get("user_id", "")
        if employee_user_id:
            await _create_notification(
                user_id=employee_user_id,
                title="Payslip Approved",
                message=f"Your payslip for {data.get('period_start', '')} to {data.get('period_end', '')} has been approved. Net pay: {data.get('net_pay', '')}",
                notif_type="success",
                module="hr",
                link_url=f"/hr/payslips/{data.get('payslip_id', '')}",
            )
        await _log_activity("approved", f"Payslip approved for employee {data.get('employee_id', '')}", "hr", data.get("approved_by", ""), data)

    @event_bus.on("mail.sent")
    async def on_mail_sent(data: dict) -> None:
        """Mail→Calendar: Auto-create calendar events from emails with date-like subjects."""
        logger.info("Event: mail.sent — from %s, subject: %s", data.get("from"), data.get("subject"))
        subject = (data.get("subject") or "").lower()
        # Detect meeting/event keywords in subject to auto-create calendar entries
        event_keywords = ["meeting", "appointment", "call", "sync", "standup", "review", "interview", "demo"]
        if any(kw in subject for kw in event_keywords):
            try:
                from app.core.database import AsyncSessionLocal  # noqa: PLC0415
                from app.models.calendar import CalendarEvent  # noqa: PLC0415
                from datetime import datetime, timedelta, timezone  # noqa: PLC0415
                async with AsyncSessionLocal() as db:
                    # Create a placeholder calendar event (user can adjust time)
                    now = datetime.now(timezone.utc)
                    cal_event = CalendarEvent(
                        title=f"[From Email] {data.get('subject', 'Meeting')}",
                        description=f"Auto-created from email sent to {', '.join(data.get('to', []))}",
                        start_time=now + timedelta(hours=1),
                        end_time=now + timedelta(hours=2),
                        event_type="event",
                        organizer_id=data.get("user_id", ""),
                        color="#3ec9d6",
                    )
                    db.add(cal_event)
                    await db.commit()
                    logger.info("Auto-created calendar event from email: %s", data.get("subject"))
            except Exception:
                logger.exception("Failed to create calendar event from mail.sent")

        await _log_activity("sent", f"Email sent: {data.get('subject')}", "mail", data.get("user_id", ""), data)

    @event_bus.on("mail.received")
    async def on_mail_received(data: dict) -> None:
        """Mail received: run rules, AI triage, compute sender score."""
        logger.info("Event: mail.received — from %s, subject: %s", data.get("from"), data.get("subject"))
        message_id = data.get("message_id")
        user_id = data.get("user_id")
        if not message_id or not user_id:
            return
        try:
            import uuid as _uuid
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415

            async with AsyncSessionLocal() as db:
                # 1) Execute mail rules
                try:
                    from app.services.mail_rule_engine import process_message  # noqa: PLC0415
                    await process_message(db, _uuid.UUID(message_id), _uuid.UUID(user_id))
                except Exception:
                    logger.exception("Rule engine error for message %s", message_id)

                # 2) AI classification & priority scoring
                try:
                    from app.services.mail_triage import classify_message  # noqa: PLC0415
                    await classify_message(db, _uuid.UUID(message_id), _uuid.UUID(user_id))
                except Exception:
                    logger.exception("AI triage error for message %s", message_id)

                # 3) Compute sender score for focused inbox
                sender_email = data.get("from", "")
                if sender_email:
                    try:
                        from app.services.mail_triage import compute_sender_score  # noqa: PLC0415
                        await compute_sender_score(db, _uuid.UUID(user_id), sender_email)
                    except Exception:
                        logger.exception("Sender score error for %s", sender_email)
        except Exception:
            logger.exception("mail.received handler failed for %s", message_id)

        await _log_activity("received", f"Email received: {data.get('subject')}", "mail", user_id or "", data)

    @event_bus.on("mail.classified")
    async def on_mail_classified(data: dict) -> None:
        """Mail classified: auto-route based on AI category (support→ticket, finance→invoice)."""
        logger.info("Event: mail.classified — category: %s", data.get("ai_category"))
        category = data.get("ai_category", "")
        message_id = data.get("message_id")
        user_id = data.get("user_id")
        if not message_id or not category:
            return
        try:
            # Auto-create support ticket for support-request emails
            if category == "support-request":
                await event_bus.publish("mail.create_ticket", {
                    "message_id": message_id,
                    "user_id": user_id,
                    "subject": data.get("subject", ""),
                    "from": data.get("from", ""),
                    "body": data.get("body_preview", ""),
                })
                logger.info("Auto-routing support-request email %s to ticket creation", message_id)
        except Exception:
            logger.exception("mail.classified handler failed for %s", message_id)

    # NOTE: ecommerce.order.created handler is in integration_handlers.py
    # (creates invoice with customer details + order lines from DB relationships)

    @event_bus.on("project.completed")
    async def on_project_completed(data: dict) -> None:
        """Projects → Finance: Log project cost as journal entry when completed."""
        logger.info("Event: project.completed — %s", data.get("name"))
        try:
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.models.finance import JournalEntry, JournalLine, Account  # noqa: PLC0415
            from datetime import date  # noqa: PLC0415
            from sqlalchemy import func, select  # noqa: PLC0415
            async with AsyncSessionLocal() as db:
                project_cost = data.get("total_cost", 0)
                if not project_cost:
                    return

                # Find a project expense account and cash/bank account
                expense_acct = await db.execute(
                    select(Account).where(Account.account_type == "expense", Account.is_active == True).limit(1)
                )
                expense_account = expense_acct.scalar_one_or_none()

                asset_acct = await db.execute(
                    select(Account).where(Account.account_type == "asset", Account.is_active == True).limit(1)
                )
                asset_account = asset_acct.scalar_one_or_none()

                if not expense_account or not asset_account:
                    logger.warning("No suitable accounts found for project cost journal entry")
                    return

                # Generate entry number
                count_q = select(func.count()).select_from(JournalEntry)
                count_result = await db.execute(count_q)
                seq = (count_result.scalar() or 0) + 1
                today = date.today()
                entry_number = f"JE-PROJ-{today.year}-{seq:04d}"

                entry = JournalEntry(
                    entry_number=entry_number,
                    entry_date=today,
                    description=f"Project cost: {data.get('name', 'Unknown')}",
                    status="posted",
                    posted_by=data.get("owner_id"),
                    metadata_json={"source": "project.completed", "project_id": data.get("project_id")},
                )
                db.add(entry)
                await db.flush()

                debit_line = JournalLine(
                    journal_entry_id=entry.id,
                    account_id=expense_account.id,
                    debit=project_cost,
                    credit=0,
                    description=f"Project expense: {data.get('name', '')}",
                )
                credit_line = JournalLine(
                    journal_entry_id=entry.id,
                    account_id=asset_account.id,
                    debit=0,
                    credit=project_cost,
                    description=f"Project expense: {data.get('name', '')}",
                )
                db.add_all([debit_line, credit_line])
                await db.commit()
                logger.info("Auto-created journal entry %s for completed project: %s", entry_number, data.get("name"))
        except Exception:
            logger.exception("Failed to create journal entry for project completion")

        await _log_activity("completed", f"Project completed: {data.get('name')}", "projects", data.get("owner_id", ""), data)

    @event_bus.on("stock.valued")
    async def on_stock_valued(data: dict) -> None:
        """Inventory → Finance: Create journal entry for stock valuation changes."""
        logger.info("Event: stock.valued — item %s, value %s", data.get("item_name"), data.get("total_value"))
        try:
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.models.finance import JournalEntry, JournalLine, Account  # noqa: PLC0415
            from datetime import date  # noqa: PLC0415
            from sqlalchemy import func, select  # noqa: PLC0415
            async with AsyncSessionLocal() as db:
                total_value = data.get("total_value", 0)
                if not total_value:
                    return

                # Find inventory asset account and COGS/expense account
                inventory_acct = await db.execute(
                    select(Account).where(
                        Account.account_type == "asset",
                        Account.name.ilike("%inventory%"),
                        Account.is_active == True,
                    ).limit(1)
                )
                inventory_account = inventory_acct.scalar_one_or_none()

                # Fallback to any asset account
                if not inventory_account:
                    fallback = await db.execute(
                        select(Account).where(Account.account_type == "asset", Account.is_active == True).limit(1)
                    )
                    inventory_account = fallback.scalar_one_or_none()

                liability_acct = await db.execute(
                    select(Account).where(Account.account_type == "liability", Account.is_active == True).limit(1)
                )
                liability_account = liability_acct.scalar_one_or_none()

                if not inventory_account or not liability_account:
                    logger.warning("No suitable accounts for stock valuation journal entry")
                    return

                count_q = select(func.count()).select_from(JournalEntry)
                count_result = await db.execute(count_q)
                seq = (count_result.scalar() or 0) + 1
                today = date.today()
                entry_number = f"JE-INV-{today.year}-{seq:04d}"

                movement_type = data.get("movement_type", "receipt")
                if movement_type == "receipt":
                    # Stock received: Debit Inventory (asset), Credit Accounts Payable (liability)
                    debit_acct = inventory_account
                    credit_acct = liability_account
                else:
                    # Stock issued: Debit COGS/Expense, Credit Inventory
                    debit_acct = liability_account
                    credit_acct = inventory_account

                entry = JournalEntry(
                    entry_number=entry_number,
                    entry_date=today,
                    description=f"Stock valuation: {data.get('item_name', 'Unknown')} ({movement_type})",
                    status="posted",
                    metadata_json={"source": "stock.valued", "item_id": data.get("item_id"), "movement_type": movement_type},
                )
                db.add(entry)
                await db.flush()

                db.add_all([
                    JournalLine(journal_entry_id=entry.id, account_id=debit_acct.id, debit=total_value, credit=0, description=f"Stock: {data.get('item_name', '')}"),
                    JournalLine(journal_entry_id=entry.id, account_id=credit_acct.id, debit=0, credit=total_value, description=f"Stock: {data.get('item_name', '')}"),
                ])
                await db.commit()
                logger.info("Auto-created stock valuation journal entry %s", entry_number)
        except Exception:
            logger.exception("Failed to create journal entry for stock valuation")

    @event_bus.on("doc.commented")
    async def on_doc_commented(data: dict) -> None:
        logger.info("Event: doc.commented — %s on %s", data.get("author_id"), data.get("file_name"))
        owner_id = data.get("owner_id", "")
        if owner_id:
            await _create_notification(
                user_id=owner_id,
                title="New Comment on Document",
                message=f"Someone commented on '{data.get('file_name', 'your document')}': {data.get('content', '')[:80]}",
                notif_type="info",
                module="docs",
                link_url=f"/docs",
            )
        await _log_activity("commented", f"Comment on: {data.get('file_name')}", "docs", data.get("author_id", ""), data)

    # ── Phase 1 HR Upgrade Events ──────────────────────────────────────────

    @event_bus.on("employee.skill_added")
    async def on_skill_added(data: dict) -> None:
        logger.info("Event: employee.skill_added — %s", data.get("employee_id"))
        try:
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.models.hr_phase1 import EmployeeActivityLog  # noqa: PLC0415
            async with AsyncSessionLocal() as db:
                log = EmployeeActivityLog(
                    employee_id=data["employee_id"],
                    activity_type="skill_added",
                    title=f"Skill added: {data.get('skill_name', '')} (Level {data.get('proficiency_level', '')})",
                    source_module="hr",
                    source_id=data.get("skill_id"),
                    occurred_at=datetime.now(UTC),
                )
                db.add(log)
                await db.commit()
        except Exception:
            logger.exception("Failed to log skill addition")

    @event_bus.on("employee.salary_changed")
    async def on_salary_changed(data: dict) -> None:
        logger.info("Event: employee.salary_changed — %s", data.get("employee_id"))
        try:
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.models.hr_phase1 import EmployeeActivityLog  # noqa: PLC0415
            async with AsyncSessionLocal() as db:
                log = EmployeeActivityLog(
                    employee_id=data["employee_id"],
                    activity_type="salary_change",
                    title=f"Salary changed: {data.get('current_salary', '')} → {data.get('proposed_salary', '')}",
                    description=f"Increase type: {data.get('increase_type', '')}",
                    source_module="hr",
                    source_id=data.get("increase_id"),
                    occurred_at=datetime.now(UTC),
                )
                db.add(log)
                await db.commit()
        except Exception:
            logger.exception("Failed to log salary change")
        await _log_activity("salary_changed", f"Salary updated for employee {data.get('employee_id')}", "hr", data.get("approved_by", ""), data)

    @event_bus.on("bonus.approved")
    async def on_bonus_approved(data: dict) -> None:
        logger.info("Event: bonus.approved — %s", data.get("employee_id"))
        try:
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.models.hr_phase1 import EmployeeActivityLog  # noqa: PLC0415
            async with AsyncSessionLocal() as db:
                log = EmployeeActivityLog(
                    employee_id=data["employee_id"],
                    activity_type="bonus",
                    title=f"Bonus approved: {data.get('bonus_type', '')} — {data.get('amount', '')} {data.get('currency', 'USD')}",
                    source_module="hr",
                    source_id=data.get("bonus_id"),
                    occurred_at=datetime.now(UTC),
                )
                db.add(log)
                await db.commit()
        except Exception:
            logger.exception("Failed to log bonus approval")

    @event_bus.on("goal.completed")
    async def on_goal_completed(data: dict) -> None:
        logger.info("Event: goal.completed — %s", data.get("goal_id"))
        employee_id = data.get("owner_id")
        if data.get("owner_type") == "employee" and employee_id:
            try:
                from app.core.database import AsyncSessionLocal  # noqa: PLC0415
                from app.models.hr_phase1 import EmployeeActivityLog  # noqa: PLC0415
                async with AsyncSessionLocal() as db:
                    log = EmployeeActivityLog(
                        employee_id=employee_id,
                        activity_type="goal_completed",
                        title=f"Goal completed: {data.get('title', '')}",
                        source_module="hr",
                        source_id=data.get("goal_id"),
                        occurred_at=datetime.now(UTC),
                    )
                    db.add(log)
                    await db.commit()
            except Exception:
                logger.exception("Failed to log goal completion")

    @event_bus.on("review_cycle.launched")
    async def on_review_cycle_launched(data: dict) -> None:
        logger.info("Event: review_cycle.launched — %s", data.get("cycle_id"))
        await _log_activity("review_cycle_launched", f"Review cycle launched: {data.get('name', '')}", "hr", data.get("created_by", ""), data)

    @event_bus.on("feedback.received")
    async def on_feedback_received(data: dict) -> None:
        logger.info("Event: feedback.received — to %s", data.get("to_employee_id"))
        to_user_id = data.get("to_user_id")
        if to_user_id:
            await _create_notification(
                user_id=to_user_id,
                title="New Feedback Received",
                message=f"You received {data.get('feedback_type', 'feedback')} from a colleague.",
                notif_type="info",
                module="hr",
                link_url="/hr/feedback",
            )

    @event_bus.on("shift.assigned")
    async def on_shift_assigned(data: dict) -> None:
        logger.info("Event: shift.assigned — employee %s", data.get("employee_id"))

    # ── Phase 2 HR Upgrade Events ──────────────────────────────────────────

    @event_bus.on("ats.ai_screen_requested")
    async def on_ats_ai_screen_requested(data: dict) -> None:
        """ATS → AI: Run async resume screening when requested."""
        logger.info("Event: ats.ai_screen_requested — candidate %s vs req %s", data.get("candidate_id"), data.get("requisition_id"))
        try:
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.models.hr_phase2 import Candidate, CandidateApplication, JobRequisition  # noqa: PLC0415
            from app.services.hr_ai_screening import screen_resume  # noqa: PLC0415
            from sqlalchemy import select  # noqa: PLC0415
            async with AsyncSessionLocal() as db:
                cand = await db.get(Candidate, data["candidate_id"])
                req = await db.get(JobRequisition, data["requisition_id"])
                app_res = await db.execute(
                    select(CandidateApplication).where(
                        CandidateApplication.candidate_id == data["candidate_id"],
                        CandidateApplication.requisition_id == data["requisition_id"],
                    )
                )
                application = app_res.scalar_one_or_none()
                if not cand or not req or not application:
                    return
                resume_text = cand.ai_summary or cand.notes or ""
                result = await screen_resume(
                    resume_text=resume_text,
                    job_title=req.title,
                    required_skills=req.skills_required or [],
                    job_description=req.description or "",
                )
                application.ai_match_score = result.get("match_score", 0)
                application.ai_match_notes = result.get("summary", "")
                if not cand.skills_extracted:
                    cand.skills_extracted = result.get("extracted_skills", [])
                    cand.ai_summary = result.get("summary", "")
                await db.commit()
                logger.info("AI screening complete — score: %s for candidate %s", result.get("match_score"), data.get("candidate_id"))
        except Exception:
            logger.exception("Failed to run AI resume screening")

    @event_bus.on("ats.interview_scheduled")
    async def on_interview_scheduled(data: dict) -> None:
        logger.info("Event: ats.interview_scheduled — application %s", data.get("application_id"))
        await _log_activity("created", f"Interview scheduled for candidate", "hr", data.get("scheduled_by", ""), data)

    @event_bus.on("ats.application_stage_changed")
    async def on_application_stage_changed(data: dict) -> None:
        logger.info("Event: ats.application_stage_changed — %s → %s", data.get("old_stage"), data.get("new_stage"))
        await _log_activity("updated", f"Application moved to {data.get('new_stage', '')}", "hr", data.get("updated_by", ""), data)

    @event_bus.on("lms.course_completed")
    async def on_course_completed(data: dict) -> None:
        """LMS → Skills: Auto-add skills from completed course to employee skills."""
        logger.info("Event: lms.course_completed — employee %s course %s", data.get("employee_id"), data.get("course_id"))
        try:
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.models.hr_phase1 import EmployeeSkill, EmployeeActivityLog  # noqa: PLC0415
            from app.models.hr_phase2 import Course  # noqa: PLC0415
            async with AsyncSessionLocal() as db:
                course = await db.get(Course, data["course_id"])
                if course and course.skills_taught:
                    for skill_name in course.skills_taught:
                        existing = await db.execute(
                            select(EmployeeSkill).where(
                                EmployeeSkill.employee_id == data["employee_id"],
                                EmployeeSkill.skill_name == skill_name,
                            )
                        )
                        if not existing.scalar_one_or_none():
                            db.add(EmployeeSkill(
                                employee_id=data["employee_id"],
                                skill_name=skill_name,
                                category="lms",
                                proficiency_level=2,
                            ))
                log = EmployeeActivityLog(
                    employee_id=data["employee_id"],
                    activity_type="course_completed",
                    title=f"Completed course: {data.get('course_title', '')}",
                    source_module="hr_lms",
                    source_id=data.get("course_id"),
                    occurred_at=datetime.now(UTC),
                )
                db.add(log)
                await db.commit()
        except Exception:
            logger.exception("Failed to process course completion event")
        # Notify the employee
        user_id = data.get("user_id")
        if user_id:
            await _create_notification(
                user_id=user_id,
                title="Course Completed!",
                message=f"Congratulations! You completed '{data.get('course_title', 'the course')}'. Score: {data.get('quiz_score', 'N/A')}%",
                notif_type="success",
                module="hr",
                link_url="/hr/learning",
            )

    @event_bus.on("engagement.survey_launched")
    async def on_survey_launched(data: dict) -> None:
        logger.info("Event: engagement.survey_launched — survey %s", data.get("survey_id"))
        await _log_activity("created", f"Survey launched: {data.get('title', '')}", "hr", data.get("created_by", ""), data)

    @event_bus.on("engagement.survey_response_submitted")
    async def on_survey_response_submitted(data: dict) -> None:
        """Engagement → Sentiment: Run async sentiment analysis on open responses."""
        logger.info("Event: engagement.survey_response_submitted — survey %s", data.get("survey_id"))
        if not data.get("response_id"):
            return
        try:
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.models.hr_phase2 import SurveyResponse  # noqa: PLC0415
            from app.services.hr_sentiment import analyze_survey_responses, score_to_decimal  # noqa: PLC0415
            async with AsyncSessionLocal() as db:
                response = await db.get(SurveyResponse, data["response_id"])
                if response and response.answers:
                    result = await analyze_survey_responses(response.answers)
                    response.sentiment_score = score_to_decimal(result["score"])
                    response.sentiment_label = result["label"]
                    await db.commit()
                    logger.info("Sentiment analysis complete: %s (%s)", result["label"], result["score"])
        except Exception:
            logger.exception("Failed to run sentiment analysis for survey response")

    @event_bus.on("engagement.recognition_given")
    async def on_recognition_given(data: dict) -> None:
        logger.info("Event: engagement.recognition_given — to employee %s", data.get("to_employee_id"))
        to_user_id = data.get("to_user_id")
        if to_user_id:
            await _create_notification(
                user_id=to_user_id,
                title="You received recognition!",
                message=f"{data.get('from_name', 'A colleague')} gave you {data.get('recognition_type', 'kudos')}: {data.get('message', '')[:80]}",
                notif_type="success",
                module="hr",
                link_url="/hr/recognition",
            )

    @event_bus.on("onboarding.buddy_assigned")
    async def on_buddy_assigned(data: dict) -> None:
        logger.info("Event: onboarding.buddy_assigned — new employee %s, buddy %s", data.get("new_employee_id"), data.get("buddy_employee_id"))
        buddy_user_id = data.get("buddy_user_id")
        if buddy_user_id:
            await _create_notification(
                user_id=buddy_user_id,
                title="You've been assigned as a buddy!",
                message=f"You are now the onboarding buddy for a new team member. Welcome them aboard!",
                notif_type="info",
                module="hr",
                link_url="/hr/onboarding-tracker",
            )

    @event_bus.on("onboarding.task_completed")
    async def on_onboarding_task_completed(data: dict) -> None:
        logger.info("Event: onboarding.task_completed — task %s for employee %s", data.get("task_id"), data.get("employee_id"))

    @event_bus.on("onboarding.completed")
    async def on_onboarding_completed(data: dict) -> None:
        logger.info("Event: onboarding.completed — employee %s", data.get("employee_id"))
        admin_ids = await _get_app_admin_ids("hr")
        for uid in admin_ids:
            await _create_notification(
                user_id=uid,
                title="Onboarding Complete",
                message=f"Employee {data.get('employee_name', '')} has completed all onboarding tasks.",
                notif_type="success",
                module="hr",
                link_url="/hr/onboarding-tracker",
            )

    @event_bus.on("hr.offboarding_started")
    async def on_offboarding_started(data: dict) -> None:
        logger.info("Event: hr.offboarding_started — employee %s", data.get("employee_id"))
        await _log_activity("updated", f"Offboarding started for employee {data.get('employee_id', '')}", "hr", data.get("initiated_by", ""), data)

    # ── Phase 3 HR Events ──────────────────────────────────────────────────────

    @event_bus.on("hr.workflow_approval_required")
    async def on_workflow_approval_required(data: dict) -> None:
        """Notify approver that a workflow step needs their decision."""
        logger.info("Event: hr.workflow_approval_required — execution %s", data.get("execution_id"))
        approver_id = data.get("approver_id")
        if approver_id:
            await _send_notification(
                user_id=approver_id,
                title="Workflow Approval Required",
                body=f"A workflow step requires your approval: {data.get('step_description', 'Approval needed')}",
                link_url="/hr/workflows/approvals",
            )

    @event_bus.on("hr.workflow_decision")
    async def on_workflow_decision(data: dict) -> None:
        """Log workflow approval decision."""
        logger.info(
            "Event: hr.workflow_decision — execution %s decision=%s",
            data.get("execution_id"),
            data.get("decision"),
        )
        await _log_activity(
            "updated",
            f"Workflow decision: {data.get('decision')} for execution {data.get('execution_id', '')}",
            "hr",
            data.get("decided_by", ""),
            data,
        )

    @event_bus.on("hr.workflow_task_created")
    async def on_workflow_task_created(data: dict) -> None:
        """Notify assignee of a task created by a workflow."""
        logger.info("Event: hr.workflow_task_created — task %s", data.get("task_title"))
        assignee_id = data.get("assignee_id")
        if assignee_id:
            await _send_notification(
                user_id=assignee_id,
                title="New Task Assigned",
                body=f"Workflow task assigned: {data.get('task_title', 'New task')}",
                link_url="/projects",
            )

    @event_bus.on("hr.flight_risk_high")
    async def on_flight_risk_high(data: dict) -> None:
        """Alert HR admins when an employee has high/critical flight risk."""
        logger.info(
            "Event: hr.flight_risk_high — employee %s risk=%s",
            data.get("employee_id"),
            data.get("risk_level"),
        )

    @event_bus.on("hr.burnout_risk_high")
    async def on_burnout_risk_high(data: dict) -> None:
        """Alert manager and HR when an employee has high burnout risk."""
        logger.info(
            "Event: hr.burnout_risk_high — employee %s risk=%s",
            data.get("employee_id"),
            data.get("risk_level"),
        )

    # ── Support Phase 1 Events ────────────────────────────────────────────────

    @event_bus.on("support.ticket.created")
    async def on_support_ticket_created(data: dict) -> None:
        """Trigger AI classification and notify assignee on new ticket."""
        logger.info("Event: support.ticket.created — %s", data.get("ticket_number"))
        # AI auto-classify
        try:
            from app.tasks.support_tasks import support_ai_classify_ticket  # noqa: PLC0415
            support_ai_classify_ticket.delay(data.get("ticket_id", ""))
        except Exception:
            logger.warning("Could not queue AI classification for ticket %s", data.get("ticket_id"))

        # Notify assignee
        assigned_to = data.get("assigned_to")
        if assigned_to:
            await _create_notification(
                user_id=assigned_to,
                title="New Ticket Assigned",
                message=f"Ticket {data.get('ticket_number', '')}: {data.get('subject', '')}",
                notif_type="info",
                module="support",
                link_url=f"/support/tickets/{data.get('ticket_id', '')}",
            )

    @event_bus.on("support.ticket.resolved")
    async def on_support_ticket_resolved(data: dict) -> None:
        """Queue CSAT survey 24h after ticket resolution."""
        logger.info("Event: support.ticket.resolved — %s", data.get("ticket_number"))
        try:
            from app.tasks.support_tasks import support_send_csat_survey  # noqa: PLC0415
            support_send_csat_survey.apply_async(
                args=[data.get("ticket_id", "")],
                countdown=86400,  # 24 hours
            )
        except Exception:
            logger.warning("Could not queue CSAT survey for ticket %s", data.get("ticket_id"))

    @event_bus.on("support.ticket.assigned")
    async def on_support_ticket_assigned(data: dict) -> None:
        """Notify new assignee when a ticket is assigned/reassigned."""
        logger.info("Event: support.ticket.assigned — %s to %s", data.get("ticket_number"), data.get("assigned_to"))
        assigned_to = data.get("assigned_to")
        if assigned_to:
            await _create_notification(
                user_id=assigned_to,
                title="Ticket Assigned to You",
                message=f"Ticket {data.get('ticket_number', '')}: {data.get('subject', '')}",
                notif_type="info",
                module="support",
                link_url=f"/support/tickets/{data.get('ticket_id', '')}",
            )

    @event_bus.on("support.ticket.escalated")
    async def on_support_ticket_escalated(data: dict) -> None:
        """Notify support admins when a ticket is escalated."""
        logger.info("Event: support.ticket.escalated — %s", data.get("ticket_number"))
        admin_ids = await _get_app_admin_ids("support")
        for uid in admin_ids:
            await _create_notification(
                user_id=uid,
                title="Ticket Escalated",
                message=f"Ticket {data.get('ticket_number', '')} has been escalated. Priority: {data.get('priority', 'N/A')}",
                notif_type="warning",
                module="support",
                link_url=f"/support/tickets/{data.get('ticket_id', '')}",
            )

    @event_bus.on("support.sla.warning")
    async def on_support_sla_warning(data: dict) -> None:
        """Notify agent and admins when SLA is approaching breach."""
        logger.info("Event: support.sla.warning — ticket %s, sla_type=%s", data.get("ticket_number"), data.get("sla_type"))
        admin_ids = await _get_app_admin_ids("support")
        for uid in admin_ids:
            await _create_notification(
                user_id=uid,
                title="SLA Warning",
                message=f"Ticket {data.get('ticket_number', '')} {data.get('sla_type', '')} SLA due at {data.get('due_at', '')}",
                notif_type="warning",
                module="support",
                link_url=f"/support/tickets/{data.get('ticket_id', '')}",
            )

    @event_bus.on("support.sla.breached")
    async def on_support_sla_breached(data: dict) -> None:
        """Escalation notification when SLA is breached."""
        logger.info("Event: support.sla.breached — ticket %s, sla_type=%s", data.get("ticket_number"), data.get("sla_type"))
        admin_ids = await _get_app_admin_ids("support")
        for uid in admin_ids:
            await _create_notification(
                user_id=uid,
                title="SLA Breached!",
                message=f"Ticket {data.get('ticket_number', '')} has breached {data.get('sla_type', '')} SLA.",
                notif_type="danger",
                module="support",
                link_url=f"/support/tickets/{data.get('ticket_id', '')}",
            )
        # Also notify the assigned agent
        assigned_to = data.get("assigned_to")
        if assigned_to:
            await _create_notification(
                user_id=assigned_to,
                title="SLA Breached",
                message=f"Ticket {data.get('ticket_number', '')} has breached {data.get('sla_type', '')} SLA. Immediate action required.",
                notif_type="danger",
                module="support",
                link_url=f"/support/tickets/{data.get('ticket_id', '')}",
            )

    @event_bus.on("support.mention")
    async def on_support_mention(data: dict) -> None:
        """Notify mentioned user in a ticket comment."""
        logger.info("Event: support.mention — user %s in ticket %s", data.get("mentioned_user_id"), data.get("ticket_number"))
        mentioned_user_id = data.get("mentioned_user_id")
        if mentioned_user_id:
            await _create_notification(
                user_id=mentioned_user_id,
                title="You were mentioned",
                message=f"You were mentioned in ticket {data.get('ticket_number', '')}: {data.get('comment_preview', '')}",
                notif_type="info",
                module="support",
                link_url=f"/support/tickets/{data.get('ticket_id', '')}",
            )

    @event_bus.on("support.livechat.queued")
    async def on_support_livechat_queued(data: dict) -> None:
        """Alert available agents when a live chat session is queued."""
        logger.info("Event: support.livechat.queued — session %s", data.get("session_id"))
        admin_ids = await _get_app_admin_ids("support")
        for uid in admin_ids:
            await _create_notification(
                user_id=uid,
                title="New Live Chat",
                message=f"A customer is waiting in live chat queue. Visitor: {data.get('visitor_name', 'Anonymous')}",
                notif_type="info",
                module="support",
                link_url="/support/live-chat",
            )

    @event_bus.on("support.comment.added")
    async def on_support_comment_added(data: dict) -> None:
        """Email customer when an external (non-internal) comment is added."""
        logger.info("Event: support.comment.added — ticket %s", data.get("ticket_number"))
        if data.get("is_internal"):
            return  # Don't email for internal notes
        customer_email = data.get("customer_email")
        if customer_email:
            try:
                from app.tasks.celery_app import send_email  # noqa: PLC0415
                send_email.delay(
                    to=customer_email,
                    subject=f"Re: {data.get('subject', '')} [{data.get('ticket_number', '')}]",
                    body=(
                        f"Hi {data.get('customer_name', 'there')},\n\n"
                        f"A new reply has been added to your ticket {data.get('ticket_number', '')}:\n\n"
                        f"{data.get('comment_preview', '')}\n\n"
                        f"— Support Team"
                    ),
                )
            except Exception:
                logger.warning("Could not send comment notification email for ticket %s", data.get("ticket_number"))


    # ── Support Phase 2 — Automation + Proactive event handlers ─────────

    @event_bus.on("support.ticket.created")
    async def on_support_ticket_created_automations(data: dict) -> None:
        """Trigger automations + proactive rules + AI auto-respond for new tickets."""
        ticket_id = data.get("ticket_id", "")
        if ticket_id:
            try:
                from app.tasks.support_tasks import (  # noqa: PLC0415
                    support_evaluate_automations,
                    support_ai_auto_respond,
                    support_evaluate_proactive_rules,
                )
                support_evaluate_automations.delay(ticket_id, "support.ticket.created")
                support_ai_auto_respond.delay(ticket_id)
                support_evaluate_proactive_rules.delay("support.ticket.created", data)
            except Exception:
                logger.warning("Could not trigger automations for ticket %s", ticket_id)

    @event_bus.on("support.ticket.resolved")
    async def on_support_ticket_resolved_automations(data: dict) -> None:
        """Trigger automations on ticket resolution."""
        ticket_id = data.get("ticket_id", "")
        if ticket_id:
            try:
                from app.tasks.support_tasks import support_evaluate_automations  # noqa: PLC0415
                support_evaluate_automations.delay(ticket_id, "support.ticket.resolved")
            except Exception:
                logger.warning("Could not trigger automations for resolved ticket %s", ticket_id)

    @event_bus.on("support.sla.breached")
    async def on_support_sla_breached_automations(data: dict) -> None:
        """Trigger automations on SLA breach."""
        ticket_id = data.get("ticket_id", "")
        if ticket_id:
            try:
                from app.tasks.support_tasks import support_evaluate_automations  # noqa: PLC0415
                support_evaluate_automations.delay(ticket_id, "support.sla.breached")
            except Exception:
                logger.warning("Could not trigger automations for SLA breach on %s", ticket_id)

    @event_bus.on("support.escalation.triggered")
    async def on_support_escalation_triggered(data: dict) -> None:
        """Notify target user when SLA escalation is triggered."""
        logger.info("Event: support.escalation.triggered — ticket %s level %s",
                     data.get("ticket_number"), data.get("level"))
        target_user_id = data.get("target_user_id")
        if target_user_id:
            await _create_notification(
                user_id=target_user_id,
                title=f"SLA Escalation L{data.get('level', '?')}",
                message=f"Ticket {data.get('ticket_number', '')} escalated — {data.get('minutes_until_breach', '?')} min until breach",
                notif_type="warning",
                module="support",
                link_url=f"/support/tickets/{data.get('ticket_id', '')}",
            )

    @event_bus.on("support.proactive.alert")
    async def on_support_proactive_alert(data: dict) -> None:
        """Alert agents about proactive rule triggers."""
        logger.info("Event: support.proactive.alert — rule %s", data.get("rule_name"))
        admin_ids = await _get_app_admin_ids("support")
        for uid in admin_ids:
            await _create_notification(
                user_id=str(uid),
                title=f"Proactive Alert: {data.get('rule_name', '')}",
                message=data.get("message", "Proactive support rule triggered"),
                notif_type="info",
                module="support",
                link_url="/support/proactive/rules",
            )

    # ── Y&U Notes — Auto-create notes from ERP events ─────────────────────

    @event_bus.on("meeting.created")
    async def on_meeting_created_note(data: dict) -> None:
        """Auto-create a meeting notes page when a meeting is scheduled."""
        logger.info("Event: meeting.created → auto-create meeting note for %s", data.get("title"))
        try:
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.models.notes import Note  # noqa: PLC0415
            async with AsyncSessionLocal() as db:
                attendees = data.get("attendees", [])
                attendee_list = "\n".join(f"  - {a}" for a in attendees) if attendees else "  - (none listed)"
                content = (
                    f"<h1>Meeting Notes: {data.get('title', 'Untitled Meeting')}</h1>\n"
                    f"<p><strong>Date:</strong> {data.get('start_time', 'TBD')}</p>\n"
                    f"<h2>Attendees</h2>\n<p>{attendee_list}</p>\n"
                    f"<h2>Agenda</h2>\n<p>(Add agenda items here)</p>\n"
                    f"<h2>Discussion</h2>\n<p></p>\n"
                    f"<h2>Action Items</h2>\n<ul><li></li></ul>\n"
                    f"<h2>Decisions</h2>\n<ul><li></li></ul>\n"
                )
                note = Note(
                    title=f"Meeting Notes: {data.get('title', 'Untitled Meeting')}",
                    content=content,
                    owner_id=data.get("organizer_id"),
                    tags=["meeting-notes", "auto-created"],
                    source_type="meeting",
                    linked_items=[{
                        "type": "meeting",
                        "id": str(data.get("meeting_id", "")),
                        "title": data.get("title", ""),
                    }],
                )
                db.add(note)
                await db.commit()
                logger.info("Auto-created meeting notes page for: %s", data.get("title"))
        except Exception:
            logger.exception("Failed to auto-create meeting notes page")

    @event_bus.on("project.created")
    async def on_project_created_note(data: dict) -> None:
        """Auto-create a project notebook when a new project is created."""
        logger.info("Event: project.created → auto-create notebook for %s", data.get("name"))
        try:
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.models.notes import Note, Notebook, NotebookSection  # noqa: PLC0415
            async with AsyncSessionLocal() as db:
                # Create project notebook
                nb = Notebook(
                    title=f"Project: {data.get('name', 'Untitled')}",
                    description=data.get("description", ""),
                    owner_id=data.get("owner_id"),
                    icon="📁",
                    color="#51459d",
                )
                db.add(nb)
                await db.flush()

                # Create default sections
                for idx, sec_title in enumerate(["Overview", "Meeting Notes", "Research", "Decisions"]):
                    sec = NotebookSection(
                        notebook_id=nb.id,
                        title=sec_title,
                        sort_order=idx,
                    )
                    db.add(sec)
                await db.flush()

                # Get the Overview section for the welcome page
                from sqlalchemy import select  # noqa: PLC0415
                overview_sec = (await db.execute(
                    select(NotebookSection).where(
                        NotebookSection.notebook_id == nb.id,
                        NotebookSection.title == "Overview",
                    )
                )).scalar_one()

                # Create project overview page
                content = (
                    f"<h1>{data.get('name', 'Project Overview')}</h1>\n"
                    f"<p>{data.get('description', '')}</p>\n"
                    f"<h2>Objectives</h2>\n<ul><li></li></ul>\n"
                    f"<h2>Team</h2>\n<p>(Add team members here)</p>\n"
                    f"<h2>Timeline</h2>\n<p>(Add key milestones)</p>\n"
                )
                page = Note(
                    title=f"Project Overview: {data.get('name', '')}",
                    content=content,
                    owner_id=data.get("owner_id"),
                    notebook_id=nb.id,
                    section_id=overview_sec.id,
                    tags=["project", "auto-created"],
                    source_type="auto_created",
                    linked_items=[{
                        "type": "project",
                        "id": str(data.get("project_id", "")),
                        "title": data.get("name", ""),
                    }],
                )
                db.add(page)
                await db.commit()
                logger.info("Auto-created project notebook for: %s", data.get("name"))
        except Exception:
            logger.exception("Failed to auto-create project notebook")

    @event_bus.on("support.ticket.escalated")
    async def on_ticket_escalated_note(data: dict) -> None:
        """Auto-create an investigation note when a ticket is escalated."""
        logger.info("Event: support.ticket.escalated → auto-create investigation note for %s", data.get("ticket_number"))
        try:
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.models.notes import Note  # noqa: PLC0415
            async with AsyncSessionLocal() as db:
                content = (
                    f"<h1>Investigation: {data.get('subject', data.get('ticket_number', 'Escalated Ticket'))}</h1>\n"
                    f"<p><strong>Ticket:</strong> {data.get('ticket_number', 'N/A')}</p>\n"
                    f"<p><strong>Priority:</strong> {data.get('priority', 'N/A')}</p>\n"
                    f"<p><strong>Customer:</strong> {data.get('customer_name', 'N/A')}</p>\n"
                    f"<h2>Issue Description</h2>\n<p>{data.get('description', '(See ticket for details)')}</p>\n"
                    f"<h2>Root Cause Analysis</h2>\n<p></p>\n"
                    f"<h2>Steps Taken</h2>\n<ol><li></li></ol>\n"
                    f"<h2>Resolution</h2>\n<p></p>\n"
                )
                note = Note(
                    title=f"Investigation: {data.get('subject', data.get('ticket_number', 'Escalated Ticket'))}",
                    content=content,
                    owner_id=data.get("assigned_to_id") or data.get("created_by_id"),
                    tags=["investigation", "escalation", "auto-created"],
                    source_type="auto_created",
                    linked_items=[{
                        "type": "ticket",
                        "id": str(data.get("ticket_id", "")),
                        "title": data.get("ticket_number", ""),
                    }],
                )
                db.add(note)
                await db.commit()
                logger.info("Auto-created investigation note for ticket: %s", data.get("ticket_number"))
        except Exception:
            logger.exception("Failed to auto-create investigation note")

    @event_bus.on("note.updated")
    @event_bus.on("note.created")
    async def on_note_saved_embed(data: dict) -> None:
        """Trigger pgvector embedding for semantic search after a note is saved."""
        note_id = data.get("note_id")
        if not note_id:
            return
        try:
            from app.tasks.notes_tasks import embed_note_task  # noqa: PLC0415
            embed_note_task.delay(str(note_id))
            logger.info("Queued embed_note_task for note %s", note_id)
        except Exception:
            logger.exception("Failed to queue embed_note_task for note %s", note_id)


async def _seed_permissions() -> None:
    """Seed permissions and system roles idempotently on every startup."""
    from app.core.database import AsyncSessionLocal  # noqa: PLC0415
    from app.services.permission_seeder import seed_permissions  # noqa: PLC0415

    async with AsyncSessionLocal() as db:
        await seed_permissions(db)
        await db.commit()


async def _seed_superadmin() -> None:
    """Create the first super-admin account if it does not exist."""
    from sqlalchemy import select  # noqa: PLC0415

    from app.core.database import AsyncSessionLocal  # noqa: PLC0415
    from app.core.security import hash_password  # noqa: PLC0415
    from app.models.user import User  # noqa: PLC0415

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.email == settings.FIRST_SUPERADMIN_EMAIL)
        )
        if result.scalar_one_or_none() is None:
            admin = User(
                email=settings.FIRST_SUPERADMIN_EMAIL,
                full_name="Super Admin",
                hashed_password=hash_password(settings.FIRST_SUPERADMIN_PASSWORD),
                is_superadmin=True,
                is_active=True,
            )
            db.add(admin)
            await db.commit()
            logger.info("First super-admin created: %s", settings.FIRST_SUPERADMIN_EMAIL)
        else:
            logger.info("Super-admin already exists, skipping seed.")


# ── App factory ───────────────────────────────────────────────────────────────
def create_app() -> FastAPI:
    application = FastAPI(
        title=settings.APP_NAME,
        description="Urban Vibes Dynamics — Phase 3: Full ERP with Inventory, Payroll, Budget, Notifications & Global Search",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # ── GZip compression (fallback for direct container access) ──────────────
    application.add_middleware(GZipMiddleware, minimum_size=500)

    # ── Request timing (perf metrics stored in Redis) ─────────────────────────
    application.add_middleware(TimingMiddleware, redis_url=settings.REDIS_URL)

    # ── ETag conditional responses (reduces 4G data transfer) ────────────────
    application.add_middleware(ETagMiddleware)

    # ── Security headers ─────────────────────────────────────────────────────
    application.add_middleware(SecurityHeadersMiddleware)

    # ── Request ID tracking ───────────────────────────────────────────────────
    application.add_middleware(RequestIDMiddleware)

    # ── CORS ──────────────────────────────────────────────────────────────────
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID", "Accept", "If-None-Match"],
    )

    # ── Rate limiting ─────────────────────────────────────────────────────────
    application.state.limiter = limiter
    application.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # ── REST API router ───────────────────────────────────────────────────────
    from app.api.v1 import api_router  # noqa: PLC0415

    application.include_router(api_router, prefix="/api/v1")

    # ── Health check (real dependency checks) ─────────────────────────────────
    @application.get("/health", tags=["health"], summary="Service health check")
    async def health() -> JSONResponse:
        checks: dict[str, str] = {}
        overall = "healthy"

        # Check PostgreSQL
        try:
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from sqlalchemy import text  # noqa: PLC0415
            async with AsyncSessionLocal() as db:
                await db.execute(text("SELECT 1"))
            checks["database"] = "ok"
        except Exception:
            checks["database"] = "unavailable"
            overall = "degraded"

        # Check Redis
        try:
            import redis.asyncio as aioredis  # noqa: PLC0415
            r = aioredis.from_url(settings.REDIS_URL)
            try:
                await r.ping()
                checks["redis"] = "ok"
            finally:
                await r.aclose()
        except Exception:
            checks["redis"] = "unavailable"
            overall = "degraded"

        # Check MinIO
        try:
            from app.integrations.minio_client import _get_client  # noqa: PLC0415
            _get_client().list_buckets()
            checks["minio"] = "ok"
        except Exception:
            checks["minio"] = "unavailable"
            overall = "degraded"


        status_code = 200 if overall == "healthy" else 503
        return JSONResponse(
            status_code=status_code,
            content={
                "status": overall,
                "app": settings.APP_NAME,
                "timestamp": datetime.now(UTC).isoformat(),
                "checks": checks,
            },
        )

    # ── Prometheus metrics ────────────────────────────────────────────────────
    from app.core.metrics import instrument_app  # noqa: PLC0415

    instrument_app(application)

    @application.middleware("http")
    async def audit_context_middleware(request, call_next):
        """Set audit context (user_id, IP) for universal audit trail."""
        # Extract IP address
        ip = request.client.host if request.client else None
        audit_ip_address.set(ip)

        # Try to extract user_id from Authorization header (best-effort)
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                from app.core.security import decode_token  # noqa: PLC0415
                payload = decode_token(auth_header[7:])
                audit_user_id.set(payload.get("sub"))
            except Exception:
                audit_user_id.set(None)
        else:
            audit_user_id.set(None)

        response = await call_next(request)
        return response

    # ── IP blocklist filter ────────────────────────────────────────────────────
    application.middleware("http")(ip_filter_middleware)

    return application


app = create_app()
