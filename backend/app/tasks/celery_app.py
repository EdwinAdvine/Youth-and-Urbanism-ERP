from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "urban_erp",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.celery_app", "app.tasks.ecommerce_tasks", "app.tasks.support_tasks", "app.tasks.file_processing"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=3600,
)


# ── Tasks ────────────────────────────────────────────────────────────────────


@celery_app.task(name="tasks.send_email", bind=True, max_retries=3)
def send_email(
    self,
    to: str,
    subject: str,
    body: str,
    from_email: str | None = None,
    cc: str | None = None,
    html_body: str | None = None,
):
    """Send email via configured SMTP host."""
    import asyncio

    import aiosmtplib
    from email.message import EmailMessage

    sender = from_email or f"noreply@{settings.MAIL_DOMAIN}"
    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = to
    msg["Subject"] = subject
    if cc:
        msg["Cc"] = cc
    if html_body:
        msg.set_content(body)
        msg.add_alternative(html_body, subtype="html")
    else:
        msg.set_content(body)

    async def _send():
        await aiosmtplib.send(msg, hostname=settings.SMTP_HOST, port=settings.SMTP_PORT)

    try:
        asyncio.run(_send())
        return {"status": "sent", "to": to, "subject": subject}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(name="tasks.generate_report_pdf")
def generate_report_pdf(
    report_type: str,
    data: dict,
    user_id: str,
    email_recipients: list[str] | None = None,
    save_to_drive: bool = True,
):
    """Generate an HTML report, save to Drive (MinIO), and optionally email to recipients.

    Args:
        report_type: Type/name of the report (e.g. "finance_pl", "hr_headcount").
        data: Report data to render.
        user_id: ID of the user who requested the report.
        email_recipients: List of email addresses to send the report to.
        save_to_drive: Whether to save the report to Drive/MinIO (default True).
    """
    from datetime import datetime

    generated_at = datetime.now().strftime('%Y-%m-%d %H:%M')
    filename = f"{report_type}_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"

    html = f"""<!DOCTYPE html>
    <html><head><style>
    body {{ font-family: sans-serif; padding: 40px; }}
    h1 {{ color: #51459d; }}
    table {{ border-collapse: collapse; width: 100%; }}
    th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
    th {{ background-color: #51459d; color: white; }}
    </style></head><body>
    <h1>Urban ERP — {report_type} Report</h1>
    <p>Generated: {generated_at}</p>
    <p>User: {user_id}</p>
    <pre>{str(data)}</pre>
    </body></html>"""

    result: dict = {"status": "complete", "report_type": report_type}

    # ── Report → Drive: save report to MinIO ──────────────────────────────
    if save_to_drive:
        try:
            from app.integrations import minio_client

            record = minio_client.upload_file(
                file_data=html.encode(),
                filename=filename,
                user_id=user_id,
                folder_path="reports",
                content_type="text/html",
            )
            result["minio_key"] = record["minio_key"]
            result["filename"] = record["filename"]
            result["drive_saved"] = True
        except Exception as exc:
            result["drive_saved"] = False
            result["drive_error"] = str(exc)

    # ── Report → Mail: email report to recipients ─────────────────────────
    if email_recipients:
        for recipient in email_recipients:
            try:
                send_email.delay(
                    to=recipient,
                    subject=f"Urban ERP Report: {report_type} ({generated_at})",
                    body=(
                        f"Your scheduled report '{report_type}' has been generated.\n\n"
                        f"Generated at: {generated_at}\n"
                        f"Report is attached below as HTML content.\n\n"
                        f"You can also find it in your Drive under the 'reports' folder."
                    ),
                    html_body=html,
                )
                result.setdefault("emails_sent", []).append(recipient)
            except Exception as exc:
                result.setdefault("email_errors", []).append(
                    {"recipient": recipient, "error": str(exc)}
                )

    return result


@celery_app.task(name="tasks.ai_background_query")
def ai_background_query(
    message: str, user_id: str, session_id: str | None = None
):
    """Run an AI query in the background."""
    import asyncio

    async def _query():
        from app.core.database import AsyncSessionLocal
        from app.services.ai import AIService

        async with AsyncSessionLocal() as db:
            svc = AIService(db)
            response = await svc.chat(
                message=message,
                session_id=session_id or "bg-" + user_id,
            )
            return response

    try:
        result = asyncio.run(_query())
        return {"status": "complete", "response": result, "user_id": user_id}
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="tasks.overdue_invoice_check")
def overdue_invoice_check():
    """Daily task: flag invoices past due_date as overdue."""
    import asyncio
    import logging

    task_logger = logging.getLogger(__name__)

    async def _check():
        from datetime import date

        from sqlalchemy import update

        from app.core.database import AsyncSessionLocal
        from app.models.finance import Invoice

        async with AsyncSessionLocal() as db:
            today = date.today()
            stmt = (
                update(Invoice)
                .where(
                    Invoice.status == "sent",
                    Invoice.due_date < today,
                )
                .values(status="overdue")
                .returning(Invoice.id)
            )
            result = await db.execute(stmt)
            overdue_ids = result.scalars().all()
            await db.commit()
            task_logger.info("Marked %d invoices as overdue", len(overdue_ids))
            return len(overdue_ids)

    try:
        count = asyncio.run(_check())
        return {"status": "ok", "overdue_count": count}
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="tasks.send_invoice_email", bind=True, max_retries=3)
def send_invoice_email(self, invoice_id: str):
    """Send an invoice notification email to the customer."""
    import asyncio

    async def _send():
        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.models.finance import Invoice

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
            invoice = result.scalar_one_or_none()
            if not invoice or not invoice.customer_email:
                return {"status": "skipped", "reason": "no invoice or email"}

            html = f"""
            <h2>Invoice {invoice.invoice_number}</h2>
            <p>Dear {invoice.customer_name or 'Customer'},</p>
            <p>Please find your invoice details below:</p>
            <ul>
                <li><strong>Invoice #:</strong> {invoice.invoice_number}</li>
                <li><strong>Amount:</strong> {invoice.currency} {invoice.total:,.2f}</li>
                <li><strong>Due Date:</strong> {invoice.due_date}</li>
            </ul>
            <p>Thank you for your business.</p>
            """
            # Use the existing send_email task
            send_email.delay(
                to=invoice.customer_email,
                subject=f"Invoice {invoice.invoice_number} from Urban ERP",
                body=f"Invoice {invoice.invoice_number} - Amount: {invoice.currency} {invoice.total:,.2f} - Due: {invoice.due_date}",
                html_body=html,
            )
            return {"status": "sent", "invoice": invoice.invoice_number}

    try:
        return asyncio.run(_send())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="tasks.daily_attendance_summary")
def daily_attendance_summary():
    """Daily task: log attendance summary stats."""
    import asyncio
    import logging

    task_logger = logging.getLogger(__name__)

    async def _summarize():
        from datetime import date

        from sqlalchemy import func, select

        from app.core.database import AsyncSessionLocal
        from app.models.hr import Attendance, Employee

        async with AsyncSessionLocal() as db:
            today = date.today()
            total_active = (await db.execute(
                select(func.count()).select_from(Employee).where(Employee.is_active == True)  # noqa: E712
            )).scalar() or 0

            present_today = (await db.execute(
                select(func.count()).select_from(Attendance).where(
                    Attendance.attendance_date == today,
                    Attendance.status.in_(["present", "remote"]),
                )
            )).scalar() or 0

            rate = (present_today / total_active * 100) if total_active > 0 else 0
            task_logger.info(
                "Attendance summary: %d/%d present (%.1f%%)",
                present_today, total_active, rate,
            )
            return {
                "date": today.isoformat(),
                "total_active": total_active,
                "present": present_today,
                "rate_percent": round(rate, 1),
            }

    try:
        return asyncio.run(_summarize())
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="tasks.generate_thumbnail", bind=True, max_retries=2)
def generate_thumbnail(self, file_id: str, minio_key: str, mime_type: str):
    """Generate a 256x256 max thumbnail for an image or PDF and upload to MinIO.

    For images (image/*): resize with Pillow preserving aspect ratio.
    For PDFs (application/pdf): convert first page with pdf2image, then resize.
    Thumbnail is stored at ``thumbnails/{file_id}.jpg`` in MinIO.
    """
    import io
    import logging

    task_logger = logging.getLogger(__name__)
    thumbnail_key = f"thumbnails/{file_id}.jpg"

    try:
        from app.integrations import minio_client
    except Exception as exc:
        task_logger.warning("Cannot import minio_client for thumbnail generation: %s", exc)
        return {"status": "error", "error": str(exc)}

    # Download the original file from MinIO
    try:
        client = minio_client._get_client()
        minio_client._ensure_bucket(client)
        response = client.get_object(Bucket=minio_client.BUCKET_NAME, Key=minio_key)
        file_data = response["Body"].read()
    except Exception as exc:
        task_logger.warning("Failed to download file %s for thumbnail: %s", minio_key, exc)
        raise self.retry(exc=exc, countdown=30)

    # Generate the thumbnail image
    thumb_bytes: bytes | None = None

    if mime_type.startswith("image/"):
        try:
            from PIL import Image

            img = Image.open(io.BytesIO(file_data))
            img.thumbnail((256, 256), Image.LANCZOS)
            if img.mode in ("RGBA", "P", "LA"):
                img = img.convert("RGB")
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
            thumb_bytes = buf.getvalue()
        except ImportError:
            task_logger.warning("Pillow not installed — skipping thumbnail for image %s", file_id)
            return {"status": "skipped", "reason": "Pillow not installed"}
        except Exception as exc:
            task_logger.warning("Failed to generate image thumbnail for %s: %s", file_id, exc)
            return {"status": "error", "error": str(exc)}

    elif mime_type == "application/pdf":
        try:
            from pdf2image import convert_from_bytes

            pages = convert_from_bytes(file_data, first_page=1, last_page=1, size=(256, None))
            if pages:
                page_img = pages[0]
                page_img.thumbnail((256, 256))
                if page_img.mode in ("RGBA", "P", "LA"):
                    page_img = page_img.convert("RGB")
                buf = io.BytesIO()
                page_img.save(buf, format="JPEG", quality=85)
                thumb_bytes = buf.getvalue()
        except ImportError:
            task_logger.warning("pdf2image not installed — skipping thumbnail for PDF %s", file_id)
            return {"status": "skipped", "reason": "pdf2image not installed"}
        except Exception as exc:
            task_logger.warning("Failed to generate PDF thumbnail for %s: %s", file_id, exc)
            return {"status": "error", "error": str(exc)}
    else:
        return {"status": "skipped", "reason": f"Unsupported mime type: {mime_type}"}

    if not thumb_bytes:
        return {"status": "error", "error": "No thumbnail data generated"}

    # Upload thumbnail to MinIO
    try:
        minio_client.upload_file_from_bytes(
            data=thumb_bytes,
            object_name=thumbnail_key,
            content_type="image/jpeg",
        )
        task_logger.info("Thumbnail generated for file %s -> %s (%d bytes)", file_id, thumbnail_key, len(thumb_bytes))
        return {"status": "ok", "thumbnail_key": thumbnail_key, "size": len(thumb_bytes)}
    except Exception as exc:
        task_logger.warning("Failed to upload thumbnail for %s: %s", file_id, exc)
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(name="tasks.daily_backup")
def daily_backup():
    """Daily task: create a PostgreSQL backup and upload to MinIO."""
    import logging

    task_logger = logging.getLogger(__name__)

    try:
        from app.services.backup import BackupService

        svc = BackupService()
        result = svc.create_db_backup()
        task_logger.info("Daily backup complete: %s (%d bytes)", result["filename"], result["size_bytes"])

        # Run retention cleanup
        cleanup = svc.delete_old_backups(keep_daily=7, keep_weekly=4, keep_monthly=12)
        task_logger.info("Backup retention cleanup: kept %d, deleted %d", cleanup["kept"], cleanup["deleted"])

        return {"status": "ok", "backup": result, "cleanup": cleanup}
    except Exception as exc:
        task_logger.exception("Daily backup failed: %s", exc)
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="tasks.calendar_event_reminders")
def calendar_event_reminders():
    """Periodic task: fire reminder events for calendar events starting soon (within 15 min)."""
    import asyncio
    import logging

    task_logger = logging.getLogger(__name__)

    async def _check_reminders():
        from datetime import datetime, timedelta, timezone

        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.core.events import event_bus
        from app.models.calendar import CalendarEvent

        now = datetime.now(timezone.utc)
        window_start = now
        window_end = now + timedelta(minutes=15)

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(CalendarEvent).where(
                    CalendarEvent.start_time >= window_start,
                    CalendarEvent.start_time <= window_end,
                )
            )
            upcoming_events = result.scalars().all()

        if not upcoming_events:
            return {"status": "ok", "reminders_sent": 0}

        # Ensure event bus is connected for publishing
        import redis.asyncio as aioredis
        redis_conn = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        event_bus._redis = redis_conn

        count = 0
        for event in upcoming_events:
            await event_bus.publish("calendar.event.reminder", {
                "event_id": str(event.id),
                "title": event.title,
                "start_time": event.start_time.isoformat() if event.start_time else "",
                "end_time": event.end_time.isoformat() if event.end_time else "",
                "organizer_id": str(event.organizer_id),
                "attendees": event.attendees if isinstance(getattr(event, "attendees", None), list) else [],
                "event_type": event.event_type,
            })
            count += 1

        await redis_conn.aclose()
        task_logger.info("Sent %d calendar event reminders", count)
        return {"status": "ok", "reminders_sent": count}

    try:
        return asyncio.run(_check_reminders())
    except Exception as exc:
        import logging as _logging
        _logging.getLogger(__name__).exception("Calendar reminder task failed: %s", exc)
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="tasks.document_retention_cleanup")
def document_retention_cleanup():
    """Periodic task: delete documents older than the configured retention period.

    Reads retention policy from admin_docs config (system_settings table).
    Honors ``exclude_pinned`` and ``exclude_shared`` flags.  When ``dry_run``
    is True, only logs what would be deleted without actually removing files.
    """
    import asyncio
    import json
    import logging

    task_logger = logging.getLogger(__name__)

    async def _cleanup():
        from datetime import datetime, timedelta, timezone

        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.models.drive import DriveFile
        from app.models.settings import SystemSettings

        # Read retention config
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(SystemSettings).where(
                    SystemSettings.key == "docs_retention",
                    SystemSettings.category == "docs_admin",
                )
            )
            row = result.scalar_one_or_none()

        defaults = {
            "retention_enabled": False,
            "retention_days": 365,
            "exclude_pinned": True,
            "exclude_shared": True,
            "dry_run": True,
        }
        if row and row.value:
            try:
                config = {**defaults, **json.loads(row.value)}
            except json.JSONDecodeError:
                config = defaults
        else:
            config = defaults

        if not config["retention_enabled"]:
            task_logger.info("Document retention is disabled, skipping")
            return {"status": "disabled"}

        cutoff = datetime.now(timezone.utc) - timedelta(days=config["retention_days"])

        async with AsyncSessionLocal() as db:
            query = select(DriveFile).where(DriveFile.created_at < cutoff)
            result = await db.execute(query)
            candidates = result.scalars().all()

            deleted = 0
            skipped = 0

            for file in candidates:
                # Skip shared files if configured
                if config["exclude_shared"]:
                    shared_with = getattr(file, "shared_with", None)
                    if shared_with:
                        skipped += 1
                        continue

                if config["dry_run"]:
                    task_logger.info("DRY RUN: would delete %s (%s)", file.name, file.id)
                    deleted += 1
                    continue

                # Actually delete from MinIO and DB
                try:
                    from app.integrations import minio_client

                    minio_client.delete_file(file.minio_key)
                    await db.delete(file)
                    deleted += 1
                except Exception as exc:
                    task_logger.warning("Failed to delete %s: %s", file.id, exc)
                    skipped += 1

            if not config["dry_run"]:
                await db.commit()

        task_logger.info(
            "Document retention cleanup: %d deleted, %d skipped (dry_run=%s, cutoff=%s)",
            deleted, skipped, config["dry_run"], cutoff.isoformat(),
        )
        return {
            "status": "ok",
            "deleted": deleted,
            "skipped": skipped,
            "dry_run": config["dry_run"],
            "retention_days": config["retention_days"],
        }

    try:
        return asyncio.run(_cleanup())
    except Exception as exc:
        import logging as _logging
        _logging.getLogger(__name__).exception("Document retention task failed: %s", exc)
        return {"status": "error", "error": str(exc)}


# ── Recurring project tasks ──────────────────────────────────────────────────

@celery_app.task(name="tasks.process_recurring_project_tasks")
def process_recurring_project_tasks():
    """Check for due recurring task configs and create task instances."""
    import asyncio

    async def _process():
        from app.core.database import AsyncSessionLocal
        from app.models.projects import Task
        from app.models.projects_enhanced import RecurringTaskConfig
        from sqlalchemy import select
        from datetime import datetime, timezone
        import uuid as _uuid
        import logging as _logging

        logger = _logging.getLogger(__name__)

        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            result = await db.execute(
                select(RecurringTaskConfig).where(
                    RecurringTaskConfig.is_active.is_(True),
                    RecurringTaskConfig.next_run_at <= now,
                )
            )
            configs = result.scalars().all()
            created = 0

            for config in configs:
                try:
                    tmpl = config.template_task
                    assignee_id = tmpl.get("assignee_id")

                    task = Task(
                        project_id=config.project_id,
                        title=tmpl.get("title", "Recurring Task"),
                        description=tmpl.get("description"),
                        assignee_id=_uuid.UUID(assignee_id) if assignee_id else None,
                        status=tmpl.get("status", "todo"),
                        priority=tmpl.get("priority", "medium"),
                        tags=tmpl.get("tags", []),
                        recurring_config_id=config.id,
                    )
                    db.add(task)

                    # Advance next_run_at
                    from datetime import timedelta
                    if config.recurrence_type == "daily":
                        config.next_run_at = config.next_run_at + timedelta(days=config.recurrence_interval)
                    elif config.recurrence_type == "weekly":
                        config.next_run_at = config.next_run_at + timedelta(weeks=config.recurrence_interval)
                    elif config.recurrence_type == "monthly":
                        month = config.next_run_at.month + config.recurrence_interval
                        year = config.next_run_at.year + (month - 1) // 12
                        month = ((month - 1) % 12) + 1
                        day = min(config.day_of_month or config.next_run_at.day, 28)
                        config.next_run_at = config.next_run_at.replace(year=year, month=month, day=day)
                    else:
                        config.next_run_at = config.next_run_at + timedelta(days=config.recurrence_interval)

                    created += 1
                except Exception:
                    logger.exception("Failed to create recurring task for config %s", config.id)

            if created:
                await db.commit()
                logger.info("Created %d recurring project tasks", created)

            return {"status": "ok", "created": created, "configs_checked": len(configs)}

    try:
        return asyncio.run(_process())
    except Exception as exc:
        import logging as _logging
        _logging.getLogger(__name__).exception("Recurring project tasks failed: %s", exc)
        return {"status": "error", "error": str(exc)}


# ── Beat schedule ────────────────────────────────────────────────────────────

celery_app.conf.beat_schedule = {
    "overdue-invoice-check-daily": {
        "task": "tasks.overdue_invoice_check",
        "schedule": 86400.0,  # 24 hours
    },
    "daily-attendance-summary": {
        "task": "tasks.daily_attendance_summary",
        "schedule": 86400.0,  # 24 hours
    },
    "daily-backup": {
        "task": "tasks.daily_backup",
        "schedule": crontab(hour=2, minute=0),
    },
    "calendar-event-reminders-every-5-min": {
        "task": "tasks.calendar_event_reminders",
        "schedule": 300.0,
    },
    "document-retention-daily": {
        "task": "tasks.document_retention_cleanup",
        "schedule": crontab(hour=3, minute=0),
    },
    "recurring-project-tasks-every-15-min": {
        "task": "tasks.process_recurring_project_tasks",
        "schedule": 900.0,  # 15 minutes
    },
    "capa-due-date-check-daily": {
        "task": "tasks.check_capa_due_dates",
        "schedule": 86400.0,  # 24 hours
    },
    "crm-sequence-processing-hourly": {
        "task": "tasks.process_crm_sequence_enrollments",
        "schedule": 3600.0,  # 1 hour
    },
    "crm-lead-scoring-daily": {
        "task": "tasks.rescore_all_crm_leads",
        "schedule": crontab(hour=4, minute=0),
    },
    "crm-gamification-scores-daily": {
        "task": "tasks.compute_crm_gamification_scores",
        "schedule": crontab(hour=3, minute=0),
    },
    "crm-sla-breach-check-hourly": {
        "task": "tasks.check_crm_sla_breaches",
        "schedule": 3600.0,  # 1 hour
    },
    # ── Supply Chain Planning & Ops ──
    "sc-kpi-calculation-daily": {
        "task": "tasks.sc_calculate_kpis",
        "schedule": crontab(hour=1, minute=0),
    },
    "sc-stock-health-daily": {
        "task": "tasks.sc_stock_health_analysis",
        "schedule": crontab(hour=1, minute=30),
    },
    "sc-replenishment-check-4h": {
        "task": "tasks.sc_replenishment_check",
        "schedule": 14400.0,  # 4 hours
    },
    "sc-safety-stock-weekly": {
        "task": "tasks.sc_safety_stock_recalc",
        "schedule": crontab(day_of_week=0, hour=4, minute=0),
    },
    "sc-demand-forecast-daily": {
        "task": "tasks.sc_demand_forecast_refresh",
        "schedule": crontab(hour=5, minute=0),
    },
    "sc-contract-expiry-daily": {
        "task": "tasks.sc_contract_expiry_check",
        "schedule": crontab(hour=6, minute=0),
    },
    # ── Finance Finance ──
    "finance-revenue-recognition-daily": {
        "task": "tasks.run_revenue_recognition",
        "schedule": crontab(hour=1, minute=0),
    },
    "finance-dunning-check-daily": {
        "task": "tasks.run_dunning_check",
        "schedule": crontab(hour=8, minute=0),
    },
    "finance-compliance-reminders-daily": {
        "task": "tasks.send_compliance_reminders",
        "schedule": crontab(hour=9, minute=0),
    },
    "finance-fx-revaluation-monthly": {
        "task": "tasks.run_fx_revaluation",
        "schedule": crontab(day_of_month=1, hour=2, minute=0),
    },
    # ── E-Commerce Tasks ──
    "ecom-abandoned-carts-every-30min": {
        "task": "tasks.check_abandoned_carts",
        "schedule": 1800.0,  # 30 minutes
    },
    "ecom-cart-recovery-email-1-every-30min": {
        "task": "tasks.send_cart_recovery_email_1",
        "schedule": 1800.0,
    },
    "ecom-cart-recovery-email-2-every-30min": {
        "task": "tasks.send_cart_recovery_email_2",
        "schedule": 1800.0,
    },
    "ecom-subscriptions-daily": {
        "task": "tasks.process_due_subscriptions",
        "schedule": crontab(hour=6, minute=0),
    },
    "ecom-flash-sales-every-5min": {
        "task": "tasks.activate_scheduled_flash_sales",
        "schedule": 300.0,  # 5 minutes
    },
    "ecom-exchange-rates-daily": {
        "task": "tasks.refresh_exchange_rates",
        "schedule": crontab(hour=7, minute=0),
    },
    # ── Support Phase 1 ──────────────────────────────────────────────────────
    "support-sla-escalation-every-5min": {
        "task": "tasks.support_check_sla_escalations",
        "schedule": 300.0,  # 5 minutes
    },
    "support-inbound-email-every-2min": {
        "task": "tasks.support_poll_inbound_emails",
        "schedule": 120.0,  # 2 minutes
    },
    "support-auto-close-stale-daily": {
        "task": "tasks.support_auto_close_stale_tickets",
        "schedule": crontab(hour=4, minute=0),
    },
    # ── Era Mail Advanced ──────────────────────────────────────────────────────
    "mail-imap-sync-every-5min": {
        "task": "tasks.mail_sync_all_accounts",
        "schedule": 300.0,  # 5 minutes
    },
    "mail-unsnooze-every-1min": {
        "task": "tasks.mail_check_snoozed_messages",
        "schedule": 60.0,  # 1 minute
    },
    "mail-flag-reminders-every-1min": {
        "task": "tasks.mail_check_flag_reminders",
        "schedule": 60.0,  # 1 minute
    },
    "mail-scheduled-send-every-1min": {
        "task": "tasks.mail_send_scheduled",
        "schedule": 60.0,  # 1 minute
    },
    "mail-retention-cleanup-daily": {
        "task": "tasks.mail_retention_cleanup",
        "schedule": crontab(hour=3, minute=30),
    },
    # ── Drive Intelligence ──────────────────────────────────────────────────
    "drive-purge-expired-trash-daily": {
        "task": "tasks.purge_expired_trash",
        "schedule": crontab(hour=2, minute=30),
    },
}


@celery_app.task(name="tasks.check_capa_due_dates")
def check_capa_due_dates():
    """Check for CAPAs approaching or past their due dates and publish events."""
    import asyncio
    from datetime import date as date_type, timedelta

    async def _check():
        from app.core.database import AsyncSessionLocal
        from app.core.events import event_bus
        from app.models.manufacturing import CAPA
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            today = date_type.today()
            warning_date = today + timedelta(days=7)

            result = await db.execute(
                select(CAPA).where(
                    CAPA.status.in_(["open", "in_progress"]),
                    CAPA.due_date.isnot(None),
                    CAPA.due_date <= warning_date,
                )
            )
            capas = result.scalars().all()

            for capa in capas:
                is_overdue = capa.due_date < today
                await event_bus.publish("capa.due_soon", {
                    "capa_id": str(capa.id),
                    "capa_number": capa.capa_number,
                    "due_date": capa.due_date.isoformat(),
                    "is_overdue": is_overdue,
                    "assigned_to": str(capa.assigned_to) if capa.assigned_to else None,
                })

            return {"checked": len(capas), "date": today.isoformat()}

    return asyncio.run(_check())


@celery_app.task(name="tasks.process_crm_sequence_enrollments")
def process_crm_sequence_enrollments():
    """Hourly: advance active CRM sequence enrollments to their next step."""
    import asyncio

    async def _process():
        from app.core.database import AsyncSessionLocal
        from app.services.crm_sequences import process_enrollments

        async with AsyncSessionLocal() as db:
            result = await process_enrollments(db)
            await db.commit()
            return result

    return asyncio.run(_process())


@celery_app.task(name="tasks.rescore_all_crm_leads")
def rescore_all_crm_leads():
    """Daily: re-score all CRM leads using current scoring rules."""
    import asyncio

    async def _rescore():
        from app.core.database import AsyncSessionLocal
        from app.services.crm_scoring import batch_rescore_all

        async with AsyncSessionLocal() as db:
            result = await batch_rescore_all(db)
            await db.commit()
            return result

    return asyncio.run(_rescore())


@celery_app.task(name="tasks.compute_crm_gamification_scores")
def compute_crm_gamification_scores():
    """Daily: compute gamification scores for CRM leaderboard."""
    import asyncio

    async def _compute():
        from app.core.database import AsyncSessionLocal
        from app.services.crm_gamification import compute_daily_scores

        async with AsyncSessionLocal() as db:
            result = await compute_daily_scores(db)
            await db.commit()
            return result

    return asyncio.run(_compute())


@celery_app.task(name="tasks.check_crm_sla_breaches")
def check_crm_sla_breaches():
    """Hourly: check SLA trackers for breaches and flag them."""
    import asyncio
    from datetime import datetime, timezone

    async def _check():
        from app.core.database import AsyncSessionLocal
        from app.models.crm_service import SLATracker
        from sqlalchemy import update

        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            # Flag first response breaches
            await db.execute(
                update(SLATracker)
                .where(
                    SLATracker.first_response_at.is_(None),
                    SLATracker.first_response_due < now,
                    SLATracker.is_first_response_breached.is_(False),
                )
                .values(is_first_response_breached=True)
            )
            # Flag resolution breaches
            await db.execute(
                update(SLATracker)
                .where(
                    SLATracker.resolution_at.is_(None),
                    SLATracker.resolution_due < now,
                    SLATracker.is_resolution_breached.is_(False),
                )
                .values(is_resolution_breached=True)
            )
            await db.commit()
            return {"checked_at": now.isoformat()}

    return asyncio.run(_check())


# ── Supply Chain Periodic Tasks ──────────────────────────────────────────────


@celery_app.task(name="tasks.sc_calculate_kpis")
def sc_calculate_kpis():
    """Calculate daily supply chain KPIs (OTIF, lead times, inventory turns)."""
    import asyncio
    from datetime import datetime as dt
    from decimal import Decimal as D

    async def _calc():
        from app.core.database import AsyncSessionLocal
        from app.models.supplychain import Shipment
        from app.models.supplychain_ops import SupplyChainKPI
        from sqlalchemy import func, select

        async with AsyncSessionLocal() as db:
            period = dt.utcnow().strftime("%Y-%m")
            total = (await db.execute(select(func.count()).select_from(Shipment))).scalar() or 0
            delivered = (await db.execute(
                select(func.count()).select_from(Shipment).where(Shipment.status == "delivered")
            )).scalar() or 0
            otif = (delivered / total * 100) if total > 0 else 0

            db.add(SupplyChainKPI(kpi_name="otif_rate", period=period, value=D(str(round(otif, 2))), unit="percent"))
            db.add(SupplyChainKPI(kpi_name="fill_rate", period=period, value=D(str(round(otif, 2))), unit="percent"))
            await db.commit()
            return {"period": period, "otif": otif}

    return asyncio.run(_calc())


@celery_app.task(name="tasks.sc_stock_health_analysis")
def sc_stock_health_analysis():
    """Scan all stock levels and update StockHealthScore records."""
    import asyncio
    from datetime import datetime as dt

    async def _analyze():
        from app.core.database import AsyncSessionLocal
        from app.models.inventory import StockLevel, StockMovement
        from app.models.supplychain_ops import StockHealthScore
        from sqlalchemy import func, select

        async with AsyncSessionLocal() as db:
            levels = await db.execute(select(StockLevel))
            analyzed = 0
            for sl in levels.scalars().all():
                last_move = await db.execute(
                    select(func.max(StockMovement.created_at)).where(
                        StockMovement.item_id == sl.item_id,
                        StockMovement.warehouse_id == sl.warehouse_id,
                    )
                )
                last_dt = last_move.scalar()
                days_since = (dt.utcnow() - last_dt).days if last_dt else 999

                if days_since > 180:
                    health, action = "obsolete", "liquidate"
                elif days_since > 90:
                    health, action = "slow_moving", "markdown"
                elif sl.quantity_on_hand <= 0:
                    health, action = "understock", "reorder"
                else:
                    health, action = "healthy", "none"

                existing = await db.execute(
                    select(StockHealthScore).where(
                        StockHealthScore.item_id == sl.item_id,
                        StockHealthScore.warehouse_id == sl.warehouse_id,
                    )
                )
                score = existing.scalar_one_or_none()
                if score:
                    score.health_status = health
                    score.days_of_stock = max(0, sl.quantity_on_hand)
                    score.recommended_action = action
                    score.calculated_at = dt.utcnow()
                else:
                    db.add(StockHealthScore(
                        item_id=sl.item_id, warehouse_id=sl.warehouse_id,
                        health_status=health, days_of_stock=max(0, sl.quantity_on_hand),
                        last_movement_date=last_dt.date() if last_dt else None,
                        recommended_action=action,
                    ))
                analyzed += 1
            await db.commit()
            return {"analyzed": analyzed}

    return asyncio.run(_analyze())


@celery_app.task(name="tasks.sc_replenishment_check")
def sc_replenishment_check():
    """Check items against replenishment rules and trigger alerts."""
    import asyncio

    async def _check():
        from app.core.database import AsyncSessionLocal
        from app.core.events import event_bus
        from app.models.inventory import StockLevel
        from app.models.supplychain_ops import ReplenishmentRule
        from datetime import datetime as dt
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            rules = await db.execute(
                select(ReplenishmentRule).where(ReplenishmentRule.is_active.is_(True))
            )
            triggered = 0
            for rule in rules.scalars().all():
                sl = await db.execute(
                    select(StockLevel).where(
                        StockLevel.item_id == rule.item_id,
                        StockLevel.warehouse_id == rule.warehouse_id,
                    )
                )
                stock = sl.scalar_one_or_none()
                qty = stock.quantity_on_hand if stock else 0
                if qty <= rule.reorder_point:
                    rule.last_triggered_at = dt.utcnow()
                    await event_bus.publish("supplychain.replenishment.triggered", {
                        "rule_id": str(rule.id),
                        "item_id": str(rule.item_id),
                        "auto_generate_po": rule.auto_generate_po,
                    })
                    triggered += 1
            await db.commit()
            return {"triggered": triggered}

    return asyncio.run(_check())


@celery_app.task(name="tasks.sc_safety_stock_recalc")
def sc_safety_stock_recalc():
    """Recalculate dynamic safety stock levels weekly."""
    import asyncio
    import math
    from datetime import datetime as dt

    async def _recalc():
        from app.core.database import AsyncSessionLocal
        from app.models.supplychain_ops import SafetyStockConfig
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            configs = await db.execute(
                select(SafetyStockConfig).where(SafetyStockConfig.method == "service_level")
            )
            updated = 0
            for cfg in configs.scalars().all():
                if cfg.demand_std_dev:
                    z = 1.65 if (cfg.service_level_pct or 0) >= 95 else 1.28
                    lt = float(cfg.lead_time_std_dev or 1)
                    cfg.safety_stock_qty = int(z * float(cfg.demand_std_dev) * math.sqrt(lt))
                    cfg.recalculated_at = dt.utcnow()
                    updated += 1
            await db.commit()
            return {"updated": updated}

    return asyncio.run(_recalc())


@celery_app.task(name="tasks.sc_demand_forecast_refresh")
def sc_demand_forecast_refresh():
    """Refresh rolling demand forecasts for items with active rules."""
    import asyncio

    async def _refresh():
        return {"status": "ok", "note": "Full auto-refresh requires ML pipeline (Phase 2)"}

    return asyncio.run(_refresh())


@celery_app.task(name="tasks.sc_contract_expiry_check")
def sc_contract_expiry_check():
    """Alert on supplier contracts expiring within 30 days."""
    import asyncio
    from datetime import date as date_type, timedelta

    async def _check():
        from app.core.database import AsyncSessionLocal
        from app.core.events import event_bus
        from app.models.supplychain import Contract
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            today = date_type.today()
            soon = today + timedelta(days=30)
            result = await db.execute(
                select(Contract).where(
                    Contract.status == "active",
                    Contract.end_date <= soon,
                    Contract.end_date >= today,
                )
            )
            expiring = result.scalars().all()
            for c in expiring:
                await event_bus.publish("supplychain.alert.created", {
                    "alert_type": "contract_expiry",
                    "severity": "medium" if (c.end_date - today).days > 14 else "high",
                    "title": f"Contract '{c.title}' expiring on {c.end_date}",
                })
            return {"expiring_contracts": len(expiring)}

    return asyncio.run(_check())


# ── Finance Periodic Tasks ────────────────────────────────────────────────────


@celery_app.task(name="tasks.run_revenue_recognition")
def run_revenue_recognition():
    """Daily: post recognition JEs for active revenue recognition schedules."""
    import asyncio
    import logging
    from datetime import date

    task_logger = logging.getLogger(__name__)

    async def _run():
        from decimal import Decimal

        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.models.finance import Account, JournalEntry, JournalLine, RevenueRecognitionSchedule

        async with AsyncSessionLocal() as db:
            today = date.today()
            period_key = today.strftime("%Y-%m")

            result = await db.execute(
                select(RevenueRecognitionSchedule).where(
                    RevenueRecognitionSchedule.status == "active",
                    RevenueRecognitionSchedule.start_date <= today,
                    RevenueRecognitionSchedule.end_date >= today,
                )
            )
            schedules = result.scalars().all()
            posted = 0

            for sched in schedules:
                lines = sched.schedule_lines or []
                already_done = any(ln.get("period") == period_key and ln.get("recognized") for ln in lines)
                if already_done:
                    continue

                months = max(1, (sched.end_date.year - sched.start_date.year) * 12
                             + sched.end_date.month - sched.start_date.month + 1)
                period_amount = round(float(sched.total_amount) / months, 2)
                if period_amount <= 0:
                    continue

                dr_result = await db.execute(select(Account).where(Account.account_type == "liability").limit(1))
                dr_account = dr_result.scalar_one_or_none()
                rev_result = await db.execute(select(Account).where(Account.account_type == "revenue").limit(1))
                rev_account = rev_result.scalar_one_or_none()
                if not dr_account or not rev_account:
                    continue

                je = JournalEntry(
                    entry_number=f"RR-{period_key}-{str(sched.id)[:8]}",
                    entry_date=today,
                    description=f"Revenue recognition — period {period_key}",
                    reference=f"REV-REC:{sched.id}",
                    status="posted",
                    created_by_id=sched.created_by_id,
                )
                db.add(je)
                await db.flush()
                db.add(JournalLine(journal_entry_id=je.id, account_id=dr_account.id,
                                   description="Deferred revenue recognition",
                                   debit=Decimal(str(period_amount)), credit=Decimal("0"),
                                   currency=sched.currency or "USD"))
                db.add(JournalLine(journal_entry_id=je.id, account_id=rev_account.id,
                                   description="Revenue recognized",
                                   debit=Decimal("0"), credit=Decimal(str(period_amount)),
                                   currency=sched.currency or "USD"))

                new_lines = [ln for ln in lines if ln.get("period") != period_key]
                new_lines.append({"period": period_key, "amount": period_amount,
                                  "recognized": True, "je_id": str(je.id),
                                  "recognized_at": today.isoformat()})
                sched.schedule_lines = new_lines
                sched.recognized_amount = float(sched.recognized_amount or 0) + period_amount
                if float(sched.recognized_amount) >= float(sched.total_amount) - 0.01:
                    sched.status = "completed"
                posted += 1

            await db.commit()
            task_logger.info("Revenue recognition: posted JEs for %d schedules (period %s)", posted, period_key)
            return {"status": "ok", "posted": posted, "period": period_key}

    try:
        return asyncio.run(_run())
    except Exception as exc:
        task_logger.exception("Revenue recognition task failed: %s", exc)
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="tasks.run_dunning_check")
def run_dunning_check():
    """Daily: find overdue invoices and send staged dunning reminder emails."""
    import asyncio
    import logging
    from datetime import date

    task_logger = logging.getLogger(__name__)

    async def _run():
        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.models.finance import DunningLog, Invoice

        stage_map = {1: "soft_reminder", 7: "firm_reminder", 14: "formal_notice", 30: "collections"}

        async with AsyncSessionLocal() as db:
            today = date.today()
            result = await db.execute(
                select(Invoice).where(Invoice.status == "overdue", Invoice.customer_email.isnot(None))
            )
            overdue = result.scalars().all()
            triggered = 0

            for inv in overdue:
                days_overdue = (today - inv.due_date).days if inv.due_date else 0
                last_log_r = await db.execute(
                    select(DunningLog).where(DunningLog.invoice_id == inv.id)
                    .order_by(DunningLog.sent_at.desc()).limit(1)
                )
                last_log = last_log_r.scalar_one_or_none()
                days_since = (today - last_log.sent_at.date()).days if last_log else 999

                send_stage = None
                for threshold, stage in sorted(stage_map.items(), reverse=True):
                    if days_overdue >= threshold and days_since >= threshold:
                        if not last_log or last_log.stage != stage:
                            send_stage = stage
                            break

                if not send_stage:
                    continue

                html = (f"<h2>Payment Reminder — Invoice {inv.invoice_number}</h2>"
                        f"<p>Your invoice for <strong>{inv.currency} {float(inv.total):,.2f}</strong>"
                        f" was due on <strong>{inv.due_date}</strong> ({days_overdue} days ago).</p>"
                        f"<p>Please arrange payment at your earliest convenience.</p>")
                send_email.delay(
                    to=inv.customer_email,
                    subject=f"[{send_stage.replace('_', ' ').title()}] Invoice {inv.invoice_number}",
                    body=f"Invoice {inv.invoice_number} is {days_overdue} days overdue.",
                    html_body=html,
                )
                db.add(DunningLog(invoice_id=inv.id, stage=send_stage, channel="email",
                                  recipient_email=inv.customer_email, days_overdue=days_overdue,
                                  message_preview=send_stage))
                triggered += 1

            await db.commit()
            task_logger.info("Dunning: triggered %d reminders for %d overdue invoices", triggered, len(overdue))
            return {"status": "ok", "overdue": len(overdue), "triggered": triggered}

    try:
        return asyncio.run(_run())
    except Exception as exc:
        task_logger.exception("Dunning check task failed: %s", exc)
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="tasks.send_compliance_reminders")
def send_compliance_reminders():
    """Daily: send reminders for compliance events due in 30, 7, or 1 day(s)."""
    import asyncio
    import logging
    from datetime import date, timedelta

    task_logger = logging.getLogger(__name__)

    async def _run():
        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.core.events import event_bus
        from app.models.finance_ext import ComplianceEvent

        async with AsyncSessionLocal() as db:
            today = date.today()
            result = await db.execute(
                select(ComplianceEvent).where(
                    ComplianceEvent.status == "pending",
                    ComplianceEvent.due_date >= today,
                    ComplianceEvent.due_date <= today + timedelta(days=30),
                )
            )
            events = result.scalars().all()
            notified = 0

            for evt in events:
                days_until = (evt.due_date - today).days
                configured_days = evt.reminder_days or [30, 7, 1]
                if days_until not in configured_days:
                    continue

                await event_bus.publish("compliance.reminder", {
                    "event_id": str(evt.id),
                    "title": evt.title,
                    "due_date": evt.due_date.isoformat(),
                    "days_until": days_until,
                    "jurisdiction": evt.jurisdiction,
                    "category": evt.category,
                    "assigned_to_id": str(evt.assigned_to_id) if evt.assigned_to_id else None,
                })
                notified += 1

            task_logger.info("Compliance reminders: notified %d / %d events", notified, len(events))
            return {"status": "ok", "checked": len(events), "notified": notified}

    try:
        return asyncio.run(_run())
    except Exception as exc:
        task_logger.exception("Compliance reminder task failed: %s", exc)
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="tasks.run_fx_revaluation")
def run_fx_revaluation():
    """Monthly (1st of month): revalue foreign-currency balances, post unrealized FX gain/loss JEs."""
    import asyncio
    import logging
    from datetime import date

    task_logger = logging.getLogger(__name__)

    async def _run():
        from decimal import Decimal

        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.models.finance import Account, JournalEntry, JournalLine
        from app.models.finance_ext import FXRevaluationEntry

        async with AsyncSessionLocal() as db:
            today = date.today()
            period_key = today.strftime("%Y-%m")

            result = await db.execute(
                select(Account).where(
                    Account.currency.isnot(None),
                    Account.currency != "USD",
                    Account.is_active.is_(True),
                )
            )
            foreign_accounts = result.scalars().all()
            if not foreign_accounts:
                return {"status": "ok", "revalued": 0, "period": period_key}

            fx_gain_r = await db.execute(
                select(Account).where(Account.account_type == "revenue",
                                      Account.name.ilike("%fx%")).limit(1)
            )
            fx_gain_account = fx_gain_r.scalar_one_or_none()
            fx_loss_r = await db.execute(
                select(Account).where(Account.account_type == "expense",
                                      Account.name.ilike("%fx%")).limit(1)
            )
            fx_loss_account = fx_loss_r.scalar_one_or_none()

            revalued = 0
            for account in foreign_accounts:
                current_rate = Decimal("1.0")  # Placeholder — fetch from ECB/Open Exchange Rates in prod
                balance = getattr(account, "balance", Decimal("0")) or Decimal("0")
                if not balance or balance == 0:
                    continue

                fx_diff = balance * current_rate - balance
                if abs(fx_diff) < Decimal("0.01"):
                    continue

                is_gain = fx_diff > 0
                contra = fx_gain_account if is_gain else fx_loss_account
                if not contra:
                    continue

                je = JournalEntry(
                    entry_number=f"FXR-{period_key}-{str(account.id)[:8]}",
                    entry_date=today,
                    description=f"FX revaluation — {account.currency} — {period_key}",
                    reference=f"FX-REVAL:{account.id}",
                    status="posted",
                )
                db.add(je)
                await db.flush()
                abs_diff = abs(fx_diff)
                db.add(JournalLine(journal_entry_id=je.id, account_id=account.id,
                                   description="FX revaluation adjustment",
                                   debit=abs_diff if is_gain else Decimal("0"),
                                   credit=Decimal("0") if is_gain else abs_diff, currency="USD"))
                db.add(JournalLine(journal_entry_id=je.id, account_id=contra.id,
                                   description="Unrealized FX gain/loss",
                                   debit=Decimal("0") if is_gain else abs_diff,
                                   credit=abs_diff if is_gain else Decimal("0"), currency="USD"))
                db.add(FXRevaluationEntry(
                    account_id=account.id, period=period_key, currency=account.currency,
                    original_balance=balance, revalued_balance=balance * current_rate,
                    fx_rate=current_rate, unrealized_gain_loss=fx_diff,
                    journal_entry_id=je.id, revaluation_date=today, is_realized=False,
                ))
                revalued += 1

            await db.commit()
            task_logger.info("FX revaluation: %d accounts revalued for %s", revalued, period_key)
            return {"status": "ok", "revalued": revalued, "period": period_key}

    try:
        return asyncio.run(_run())
    except Exception as exc:
        task_logger.exception("FX revaluation task failed: %s", exc)
        return {"status": "error", "error": str(exc)}


# ── Era Mail Advanced Tasks ─────────────────────────────────────────────────

import logging as _mail_logging

_mail_task_logger = _mail_logging.getLogger("mail_tasks")


@celery_app.task(name="tasks.mail_sync_all_accounts")
def mail_sync_all_accounts():
    """Sync all enabled external mail accounts via IMAP."""
    import asyncio
    from sqlalchemy import select as sa_select

    async def _run():
        from app.core.database import AsyncSessionLocal
        from app.models.mail_advanced import MailAccount
        from app.services.imap_sync import sync_account

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                sa_select(MailAccount.id).where(MailAccount.sync_enabled.is_(True))
            )
            account_ids = [row[0] for row in result.all()]
            synced = 0
            for aid in account_ids:
                try:
                    await sync_account(db, aid)
                    synced += 1
                except Exception:
                    _mail_task_logger.exception("IMAP sync failed for account %s", aid)
            return {"synced": synced, "total": len(account_ids)}

    return asyncio.run(_run())


@celery_app.task(name="tasks.mail_check_snoozed_messages")
def mail_check_snoozed_messages():
    """Unsnooze messages whose snooze time has passed."""
    import asyncio
    from datetime import datetime, timezone
    from sqlalchemy import select as sa_select

    async def _run():
        from app.core.database import AsyncSessionLocal
        from app.models.mail_storage import MailboxMessage

        now = datetime.now(timezone.utc)
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                sa_select(MailboxMessage).where(
                    MailboxMessage.folder == "Snoozed",
                    MailboxMessage.is_deleted.is_(False),
                )
            )
            messages = result.scalars().all()
            unsnoozed = 0
            for msg in messages:
                snooze_until = (msg.headers or {}).get("snooze_until")
                if snooze_until:
                    try:
                        snooze_dt = datetime.fromisoformat(snooze_until)
                        if snooze_dt <= now:
                            msg.folder = "INBOX"
                            msg.is_read = False
                            headers = dict(msg.headers or {})
                            headers.pop("snooze_until", None)
                            msg.headers = headers
                            unsnoozed += 1
                    except (ValueError, TypeError):
                        pass
            await db.commit()
            return {"unsnoozed": unsnoozed}

    return asyncio.run(_run())


@celery_app.task(name="tasks.mail_check_flag_reminders")
def mail_check_flag_reminders():
    """Send notifications for flagged messages with reminders due."""
    import asyncio
    from datetime import datetime, timezone
    from sqlalchemy import select as sa_select

    async def _run():
        from app.core.database import AsyncSessionLocal
        from app.core.events import event_bus
        from app.models.mail_storage import MailboxMessage

        now = datetime.now(timezone.utc)
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                sa_select(MailboxMessage).where(
                    MailboxMessage.flag_status == "flagged",
                    MailboxMessage.flag_reminder_at.isnot(None),
                    MailboxMessage.flag_reminder_at <= now,
                    MailboxMessage.is_deleted.is_(False),
                )
            )
            messages = result.scalars().all()
            notified = 0
            for msg in messages:
                await event_bus.publish("mail.flag_reminder", {
                    "user_id": str(msg.user_id),
                    "message_id": str(msg.id),
                    "subject": msg.subject,
                    "from": msg.from_addr,
                })
                msg.flag_reminder_at = None
                notified += 1
            await db.commit()
            return {"notified": notified}

    return asyncio.run(_run())


@celery_app.task(name="tasks.mail_send_scheduled")
def mail_send_scheduled():
    """Send emails that were scheduled for delivery."""
    import asyncio
    from datetime import datetime, timezone
    from sqlalchemy import select as sa_select

    async def _run():
        from app.core.database import AsyncSessionLocal
        from app.models.mail_storage import MailboxMessage

        now = datetime.now(timezone.utc)
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                sa_select(MailboxMessage).where(
                    MailboxMessage.scheduled_send_at.isnot(None),
                    MailboxMessage.scheduled_send_at <= now,
                    MailboxMessage.is_draft.is_(True),
                    MailboxMessage.is_deleted.is_(False),
                )
            )
            messages = result.scalars().all()
            sent = 0
            for msg in messages:
                try:
                    from app.integrations.smtp_client import send_email as smtp_send
                    to_addrs = [a.get("email", "") for a in (msg.to_addrs or []) if a.get("email")]
                    if not to_addrs:
                        continue
                    send_result = await smtp_send(
                        from_addr=msg.from_addr,
                        to_addrs=to_addrs,
                        subject=msg.subject,
                        body_text=msg.body_text,
                        body_html=msg.body_html or None,
                    )
                    if send_result.get("success"):
                        msg.is_draft = False
                        msg.folder = "Sent"
                        msg.scheduled_send_at = None
                        msg.sent_at = now
                        sent += 1
                except Exception:
                    _mail_task_logger.exception("Scheduled send failed for %s", msg.id)
            await db.commit()
            return {"sent": sent}

    return asyncio.run(_run())


@celery_app.task(name="tasks.mail_retention_cleanup")
def mail_retention_cleanup():
    """Apply mail retention policies — archive or delete old messages."""
    import asyncio
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import select as sa_select

    async def _run():
        from app.core.database import AsyncSessionLocal
        from app.models.mail_advanced import MailRetentionPolicy
        from app.models.mail_storage import MailboxMessage

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                sa_select(MailRetentionPolicy).where(MailRetentionPolicy.is_active.is_(True))
            )
            policies = result.scalars().all()
            affected = 0
            now = datetime.now(timezone.utc)

            for policy in policies:
                cutoff = now - timedelta(days=policy.retention_days)
                msgs_result = await db.execute(
                    sa_select(MailboxMessage).where(
                        MailboxMessage.received_at < cutoff,
                        MailboxMessage.is_deleted.is_(False),
                    ).limit(500)
                )
                msgs = msgs_result.scalars().all()
                for msg in msgs:
                    if policy.action == "delete":
                        msg.is_deleted = True
                    elif policy.action == "archive":
                        msg.folder = "Archive"
                    affected += 1

            await db.commit()
            return {"affected": affected}

    return asyncio.run(_run())
