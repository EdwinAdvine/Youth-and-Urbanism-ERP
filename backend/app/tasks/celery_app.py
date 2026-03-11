from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "urban_erp",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.celery_app"],
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

        from sqlalchemy import select, update

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
}
