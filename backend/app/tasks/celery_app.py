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
    """Send email via SMTP (Mailhog in dev, Stalwart in prod)."""
    import asyncio

    import aiosmtplib
    from email.message import EmailMessage

    sender = from_email or "noreply@youthandurbanism.org"
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
        await aiosmtplib.send(msg, hostname="mailhog", port=1025)

    try:
        asyncio.run(_send())
        return {"status": "sent", "to": to, "subject": subject}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(name="tasks.generate_report_pdf")
def generate_report_pdf(report_type: str, data: dict, user_id: str):
    """Generate a simple HTML report and return it as a string (PDF generation requires WeasyPrint which needs system deps)."""
    from datetime import datetime

    html = f"""<!DOCTYPE html>
    <html><head><style>
    body {{ font-family: sans-serif; padding: 40px; }}
    h1 {{ color: #51459d; }}
    table {{ border-collapse: collapse; width: 100%; }}
    th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
    th {{ background-color: #51459d; color: white; }}
    </style></head><body>
    <h1>Urban ERP — {report_type} Report</h1>
    <p>Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}</p>
    <p>User: {user_id}</p>
    <pre>{str(data)}</pre>
    </body></html>"""

    # Store as HTML file in MinIO
    try:
        from app.integrations import minio_client

        record = minio_client.upload_file(
            file_data=html.encode(),
            filename=f"{report_type}_report.html",
            user_id=user_id,
            folder_path="reports",
            content_type="text/html",
        )
        return {
            "status": "complete",
            "minio_key": record["minio_key"],
            "filename": record["filename"],
        }
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


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


@celery_app.task(name="tasks.sync_caldav")
def sync_caldav():
    """Periodic CalDAV bi-directional sync with Stalwart CalDAV server.

    For each active user:
    1. Pull remote events from Stalwart CalDAV and create/update local CalendarEvent records.
    2. Push local events that don't exist remotely to Stalwart CalDAV.
    """
    import asyncio
    import logging

    task_logger = logging.getLogger(__name__)

    async def _sync():
        from datetime import datetime, timezone

        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.integrations.stalwart import caldav_pull_events, caldav_push_event
        from app.models.calendar import CalendarEvent
        from app.models.user import User

        stats = {"users_synced": 0, "pulled": 0, "pushed": 0, "errors": 0}

        async with AsyncSessionLocal() as db:
            # Get all active users
            result = await db.execute(
                select(User).where(User.is_active == True)  # noqa: E712
            )
            users = result.scalars().all()

        for user in users:
            try:
                # ── Pull: remote -> local ────────────────────────────────
                pull_result = await caldav_pull_events(user_email=user.email)
                if not pull_result.get("success"):
                    task_logger.debug(
                        "CalDAV pull skipped for %s: %s",
                        user.email,
                        pull_result.get("error", "unknown"),
                    )
                    continue

                remote_events = pull_result.get("events", [])

                async with AsyncSessionLocal() as db:
                    # Build a set of existing event UIDs for this user
                    existing_q = select(CalendarEvent).where(
                        CalendarEvent.organizer_id == user.id
                    )
                    existing_result = await db.execute(existing_q)
                    local_events = existing_result.scalars().all()
                    local_uid_map = {
                        str(ev.id): ev for ev in local_events
                    }

                    # Index remote UIDs (strip @urban-erp suffix if present)
                    remote_uid_set: set[str] = set()
                    for rev in remote_events:
                        raw_uid = rev.get("uid", "")
                        uid = raw_uid.replace("@urban-erp", "") if raw_uid else ""
                        remote_uid_set.add(uid)

                        # Create or update local event from remote
                        if uid and uid not in local_uid_map:
                            # Parse iCal datetime (YYYYMMDDTHHMMSSZ) to Python datetime
                            start_str = rev.get("start", "")
                            end_str = rev.get("end", "")
                            try:
                                start_dt = datetime.strptime(
                                    start_str, "%Y%m%dT%H%M%SZ"
                                ).replace(tzinfo=timezone.utc) if start_str else datetime.now(timezone.utc)
                                end_dt = datetime.strptime(
                                    end_str, "%Y%m%dT%H%M%SZ"
                                ).replace(tzinfo=timezone.utc) if end_str else start_dt
                            except ValueError:
                                start_dt = datetime.now(timezone.utc)
                                end_dt = start_dt

                            new_event = CalendarEvent(
                                title=rev.get("title", "Untitled"),
                                description=rev.get("description", ""),
                                location=rev.get("location", ""),
                                start_time=start_dt,
                                end_time=end_dt,
                                event_type="meeting",
                                organizer_id=user.id,
                                color="#51459d",
                            )
                            db.add(new_event)
                            stats["pulled"] += 1
                        elif uid and uid in local_uid_map:
                            # Update title if changed
                            local_ev = local_uid_map[uid]
                            remote_title = rev.get("title", "")
                            if remote_title and remote_title != local_ev.title:
                                local_ev.title = remote_title

                    await db.commit()

                    # ── Push: local -> remote ────────────────────────────────
                    for local_ev in local_events:
                        ev_id = str(local_ev.id)
                        if ev_id not in remote_uid_set:
                            try:
                                await caldav_push_event(
                                    user_email=user.email,
                                    event_id=ev_id,
                                    title=local_ev.title,
                                    start_time=local_ev.start_time.isoformat() if local_ev.start_time else "",
                                    end_time=local_ev.end_time.isoformat() if local_ev.end_time else "",
                                    description=local_ev.description or "",
                                    location=local_ev.location or "",
                                    attendees=local_ev.attendees if isinstance(local_ev.attendees, list) else [],
                                )
                                stats["pushed"] += 1
                            except Exception:
                                task_logger.debug("Failed to push event %s for %s", ev_id, user.email)
                                stats["errors"] += 1

                stats["users_synced"] += 1

            except Exception as exc:
                task_logger.warning("CalDAV sync error for user %s: %s", user.email, exc)
                stats["errors"] += 1

        task_logger.info(
            "CalDAV sync complete: %d users, %d pulled, %d pushed, %d errors",
            stats["users_synced"],
            stats["pulled"],
            stats["pushed"],
            stats["errors"],
        )
        return {"status": "ok", **stats}

    try:
        return asyncio.run(_sync())
    except Exception as exc:
        import logging as _logging
        _logging.getLogger(__name__).exception("CalDAV sync task failed: %s", exc)
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="tasks.sync_carddav")
def sync_carddav():
    """Periodic CardDAV bi-directional sync with Stalwart CardDAV server.

    For each active user who owns CRM contacts:
    1. Push local CRM contacts to Stalwart CardDAV as vCards.
    2. Pull remote contacts from Stalwart CardDAV and create local CRM Contact records.
    """
    import asyncio
    import logging

    task_logger = logging.getLogger(__name__)

    async def _sync():
        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.integrations.stalwart import (
            carddav_pull_contacts,
            carddav_push_contact,
        )
        from app.models.crm import Contact
        from app.models.user import User

        stats = {"users_synced": 0, "pushed": 0, "pulled": 0, "errors": 0}

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(User).where(User.is_active == True)  # noqa: E712
            )
            users = result.scalars().all()

        for user in users:
            try:
                # ── Push: local CRM contacts -> CardDAV ────────────────
                async with AsyncSessionLocal() as db:
                    contact_result = await db.execute(
                        select(Contact).where(Contact.owner_id == user.id)
                    )
                    local_contacts = contact_result.scalars().all()

                for contact in local_contacts:
                    try:
                        await carddav_push_contact(
                            user_email=user.email,
                            contact_id=str(contact.id),
                            first_name=contact.first_name or "",
                            last_name=contact.last_name or "",
                            email=contact.email or "",
                            phone=contact.phone or "",
                        )
                        stats["pushed"] += 1
                    except Exception:
                        task_logger.debug(
                            "Failed to push contact %s for %s", contact.id, user.email
                        )
                        stats["errors"] += 1

                # ── Pull: CardDAV -> local CRM contacts ────────────────
                pull_result = await carddav_pull_contacts(user_email=user.email)
                if not pull_result.get("success"):
                    task_logger.debug(
                        "CardDAV pull skipped for %s: %s",
                        user.email,
                        pull_result.get("error", "unknown"),
                    )
                    continue

                remote_contacts = pull_result.get("contacts", [])

                async with AsyncSessionLocal() as db:
                    # Build set of local contact IDs for this user
                    local_result = await db.execute(
                        select(Contact).where(Contact.owner_id == user.id)
                    )
                    local_ids = {
                        str(c.id) for c in local_result.scalars().all()
                    }

                    for rc in remote_contacts:
                        raw_uid = rc.get("uid", "")
                        uid = raw_uid.replace("@urban-erp", "") if raw_uid else ""
                        if uid and uid not in local_ids:
                            new_contact = Contact(
                                contact_type="person",
                                first_name=rc.get("first_name", ""),
                                last_name=rc.get("last_name", ""),
                                email=rc.get("email"),
                                phone=rc.get("phone"),
                                owner_id=user.id,
                                source="carddav_sync",
                            )
                            db.add(new_contact)
                            stats["pulled"] += 1

                    await db.commit()

                stats["users_synced"] += 1

            except Exception as exc:
                task_logger.warning("CardDAV sync error for user %s: %s", user.email, exc)
                stats["errors"] += 1

        task_logger.info(
            "CardDAV sync complete: %d users, %d pushed, %d pulled, %d errors",
            stats["users_synced"],
            stats["pushed"],
            stats["pulled"],
            stats["errors"],
        )
        return {"status": "ok", **stats}

    try:
        return asyncio.run(_sync())
    except Exception as exc:
        import logging as _logging
        _logging.getLogger(__name__).exception("CardDAV sync task failed: %s", exc)
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


# ── Beat schedule ────────────────────────────────────────────────────────────

celery_app.conf.beat_schedule = {
    "sync-caldav-every-5-min": {
        "task": "tasks.sync_caldav",
        "schedule": 300.0,
    },
    "sync-carddav-every-5-min": {
        "task": "tasks.sync_carddav",
        "schedule": 300.0,
    },
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
}
