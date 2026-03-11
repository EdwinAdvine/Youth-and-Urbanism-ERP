from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.database import create_all_tables
from app.core.events import event_bus
from app.core.logging_config import RequestIDMiddleware, setup_logging
from app.core.rate_limit import limiter
from app.core.security_headers import SecurityHeadersMiddleware

setup_logging()

logger = logging.getLogger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Run startup tasks before serving, and cleanup on shutdown."""
    logger.info("Starting %s ...", settings.APP_NAME)

    # Create database tables in dev mode; use Alembic migrations in production
    if settings.DEBUG:
        await create_all_tables()
        logger.info("Database tables ensured (DEBUG mode).")
    else:
        logger.info("Skipping create_all_tables — use 'alembic upgrade head' for migrations.")

    # Seed first super-admin if not present
    await _seed_superadmin()
    logger.info("Super-admin seed complete.")

    # Start Redis event bus
    _register_event_handlers()
    await event_bus.start()
    logger.info("Event bus started.")

    yield  # ← application runs here

    await event_bus.stop()
    logger.info("Event bus stopped.")
    logger.info("Shutting down %s.", settings.APP_NAME)


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
            from app.core.database import AsyncSessionLocal  # noqa: PLC0415
            from app.models.notification import Notification  # noqa: PLC0415
            async with AsyncSessionLocal() as db:
                notif = Notification(
                    user_id=user_id,
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
        try:
            from app.integrations.stalwart import caldav_push_event  # noqa: PLC0415

            # Resolve organizer email for the CalDAV push
            organizer_email = data.get("organizer_email", "")
            if not organizer_email and data.get("organizer_id"):
                try:
                    from app.core.database import AsyncSessionLocal as _ASL  # noqa: PLC0415
                    from app.models.user import User as _User  # noqa: PLC0415
                    from sqlalchemy import select as _select  # noqa: PLC0415
                    async with _ASL() as _db:
                        _res = await _db.execute(
                            _select(_User.email).where(_User.id == data["organizer_id"])
                        )
                        organizer_email = _res.scalar() or ""
                except Exception:
                    logger.debug("Could not resolve organizer email for CalDAV push")

            if organizer_email:
                await caldav_push_event(
                    user_email=organizer_email,
                    event_id=data.get("event_id", ""),
                    title=data.get("title", ""),
                    start_time=data.get("start_time", ""),
                    end_time=data.get("end_time", ""),
                    description=data.get("description", ""),
                    location=data.get("location", ""),
                    attendees=data.get("attendees"),
                )
        except Exception:
            logger.debug("CalDAV push skipped (Stalwart may not be available)")

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

    @event_bus.on("payment.received")
    async def on_payment_received(data: dict) -> None:
        logger.info("Event: payment.received — %s", data.get("payment_number"))
        await _log_activity("created", f"Payment received: {data.get('payment_number')}", "finance", data.get("payer_id", ""), data)

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
        description="Urban ERP — Phase 3: Full ERP with Inventory, Payroll, Budget, Notifications & Global Search",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # ── Security headers ─────────────────────────────────────────────────────
    application.add_middleware(SecurityHeadersMiddleware)

    # ── Request ID tracking ───────────────────────────────────────────────────
    application.add_middleware(RequestIDMiddleware)

    # ── CORS ──────────────────────────────────────────────────────────────────
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
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

        # Check Nextcloud
        try:
            from app.integrations.nextcloud_client import health_check as nc_health  # noqa: PLC0415
            nc_ok = await nc_health()
            checks["nextcloud"] = "ok" if nc_ok else "unavailable"
            if not nc_ok:
                overall = "degraded"
        except Exception:
            checks["nextcloud"] = "unavailable"
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

    return application


app = create_app()
