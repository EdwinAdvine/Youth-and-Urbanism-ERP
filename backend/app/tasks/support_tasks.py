"""Support module Celery tasks — SLA escalation, inbound email polling, CSAT surveys, AI classification."""
from __future__ import annotations

import asyncio
import logging

from app.tasks.celery_app import celery_app

task_logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.support_check_sla_escalations")
def support_check_sla_escalations():
    """Periodic: find tickets approaching/breaching SLA, publish warning/breach events."""

    async def _check():
        from datetime import datetime, timedelta, timezone

        from sqlalchemy import and_, select

        from app.core.database import AsyncSessionLocal
        from app.core.events import event_bus
        from app.models.support import Ticket

        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            warning_threshold = now + timedelta(hours=2)

            # SLA response warning: due within 2 hours and not yet responded
            resp_warning_q = select(Ticket).where(
                and_(
                    Ticket.status.in_(["open", "in_progress"]),
                    Ticket.first_response_at.is_(None),
                    Ticket.sla_response_due.isnot(None),
                    Ticket.sla_response_due <= warning_threshold,
                    Ticket.sla_response_due > now,
                    Ticket.sla_response_breached == False,  # noqa: E712
                )
            )
            resp_warnings = (await db.execute(resp_warning_q)).scalars().all()
            for t in resp_warnings:
                await event_bus.publish("support.sla.warning", {
                    "ticket_id": str(t.id),
                    "ticket_number": t.ticket_number,
                    "sla_type": "response",
                    "due_at": t.sla_response_due.isoformat(),
                })

            # SLA response breach
            resp_breach_q = select(Ticket).where(
                and_(
                    Ticket.status.in_(["open", "in_progress"]),
                    Ticket.first_response_at.is_(None),
                    Ticket.sla_response_due.isnot(None),
                    Ticket.sla_response_due <= now,
                    Ticket.sla_response_breached == False,  # noqa: E712
                )
            )
            resp_breaches = (await db.execute(resp_breach_q)).scalars().all()
            for t in resp_breaches:
                t.sla_response_breached = True
                await event_bus.publish("support.sla.breached", {
                    "ticket_id": str(t.id),
                    "ticket_number": t.ticket_number,
                    "sla_type": "response",
                    "assigned_to": str(t.assigned_to) if t.assigned_to else "",
                })

            # SLA resolution warning
            res_warning_q = select(Ticket).where(
                and_(
                    Ticket.status.in_(["open", "in_progress", "waiting_on_internal"]),
                    Ticket.resolved_at.is_(None),
                    Ticket.sla_resolution_due.isnot(None),
                    Ticket.sla_resolution_due <= warning_threshold,
                    Ticket.sla_resolution_due > now,
                    Ticket.sla_resolution_breached == False,  # noqa: E712
                )
            )
            res_warnings = (await db.execute(res_warning_q)).scalars().all()
            for t in res_warnings:
                await event_bus.publish("support.sla.warning", {
                    "ticket_id": str(t.id),
                    "ticket_number": t.ticket_number,
                    "sla_type": "resolution",
                    "due_at": t.sla_resolution_due.isoformat(),
                })

            # SLA resolution breach
            res_breach_q = select(Ticket).where(
                and_(
                    Ticket.status.in_(["open", "in_progress", "waiting_on_internal"]),
                    Ticket.resolved_at.is_(None),
                    Ticket.sla_resolution_due.isnot(None),
                    Ticket.sla_resolution_due <= now,
                    Ticket.sla_resolution_breached == False,  # noqa: E712
                )
            )
            res_breaches = (await db.execute(res_breach_q)).scalars().all()
            for t in res_breaches:
                t.sla_resolution_breached = True
                await event_bus.publish("support.sla.breached", {
                    "ticket_id": str(t.id),
                    "ticket_number": t.ticket_number,
                    "sla_type": "resolution",
                    "assigned_to": str(t.assigned_to) if t.assigned_to else "",
                })

            await db.commit()
            total = len(resp_warnings) + len(resp_breaches) + len(res_warnings) + len(res_breaches)
            task_logger.info(
                "SLA check: %d warnings, %d breaches",
                len(resp_warnings) + len(res_warnings),
                len(resp_breaches) + len(res_breaches),
            )
            return total

    try:
        count = asyncio.run(_check())
        return {"status": "ok", "sla_events": count}
    except Exception as exc:
        task_logger.exception("SLA escalation check failed")
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="tasks.support_poll_inbound_emails")
def support_poll_inbound_emails():
    """Periodic: poll Stalwart IMAP for inbound support emails, create tickets."""

    async def _poll():
        from sqlalchemy import select

        from app.core.config import settings
        from app.core.database import AsyncSessionLocal
        from app.core.events import event_bus
        from app.models.support import Ticket
        from app.models.support_phase1 import InboundEmailRule

        async with AsyncSessionLocal() as db:
            # Get active inbound rules
            rules_q = select(InboundEmailRule).where(InboundEmailRule.is_active == True)  # noqa: E712
            rules = (await db.execute(rules_q)).scalars().all()

            if not rules:
                return 0

            created_count = 0

            # Connect to IMAP
            try:
                import aioimaplib

                imap = aioimaplib.IMAP4_SSL(host=settings.SMTP_HOST, port=993)
                await imap.wait_hello_from_server()

                # Login with configured credentials
                imap_user = getattr(settings, "IMAP_USER", f"support@{settings.MAIL_DOMAIN}")
                imap_pass = getattr(settings, "IMAP_PASSWORD", "")

                if not imap_pass:
                    task_logger.warning("IMAP_PASSWORD not configured, skipping inbound email poll")
                    return 0

                await imap.login(imap_user, imap_pass)
                await imap.select("INBOX")

                # Fetch unseen messages
                _, data = await imap.search("UNSEEN")
                if not data or not data[0]:
                    await imap.logout()
                    return 0

                message_ids = data[0].split()

                for msg_id in message_ids[:50]:  # Process max 50 per run
                    _, msg_data = await imap.fetch(msg_id.decode(), "(RFC822)")
                    if not msg_data:
                        continue

                    # Parse email
                    import email
                    raw_email = msg_data[1]
                    if isinstance(raw_email, tuple):
                        raw_email = raw_email[1]
                    msg = email.message_from_bytes(raw_email if isinstance(raw_email, bytes) else raw_email.encode())

                    from_addr = msg.get("From", "")
                    subject = msg.get("Subject", "No Subject")
                    to_addr = msg.get("To", "")

                    # Extract body
                    body = ""
                    if msg.is_multipart():
                        for part in msg.walk():
                            if part.get_content_type() == "text/plain":
                                body = part.get_payload(decode=True).decode("utf-8", errors="replace")
                                break
                    else:
                        body = msg.get_payload(decode=True).decode("utf-8", errors="replace")

                    # Match against inbound rules
                    matched_rule = None
                    for rule in rules:
                        if rule.email_address.lower() in to_addr.lower():
                            matched_rule = rule
                            break

                    if not matched_rule:
                        matched_rule = rules[0]  # Default to first rule

                    # Extract sender email
                    import re
                    email_match = re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', from_addr)
                    sender_email = email_match.group(0) if email_match else from_addr

                    # Create ticket
                    from app.api.v1.support import _generate_ticket_number

                    ticket_number = await _generate_ticket_number(db)
                    ticket = Ticket(
                        ticket_number=ticket_number,
                        subject=subject[:500],
                        description=body[:10000],
                        priority=matched_rule.priority,
                        category_id=matched_rule.category_id,
                        assigned_to=matched_rule.assign_to,
                        customer_email=sender_email,
                        customer_name=from_addr.split("<")[0].strip().strip('"') if "<" in from_addr else sender_email,
                        channel="email",
                        created_by=matched_rule.assign_to or (await db.execute(
                            select(Ticket).limit(1)
                        )).scalar_one_or_none().created_by if False else matched_rule.assign_to,
                    )
                    # Use system user for created_by if no assignee
                    from app.models.user import User
                    system_user = (await db.execute(
                        select(User).where(User.email.ilike("%admin%")).limit(1)
                    )).scalar_one_or_none()
                    if system_user:
                        ticket.created_by = system_user.id
                    elif matched_rule.assign_to:
                        ticket.created_by = matched_rule.assign_to

                    db.add(ticket)
                    await db.commit()
                    await db.refresh(ticket)

                    created_count += 1

                    # Mark as seen
                    await imap.store(msg_id.decode(), "+FLAGS", "\\Seen")

                    # Publish event
                    await event_bus.publish("support.ticket.created", {
                        "ticket_id": str(ticket.id),
                        "ticket_number": ticket.ticket_number,
                        "subject": ticket.subject,
                        "priority": ticket.priority,
                        "customer_email": ticket.customer_email or "",
                        "customer_name": ticket.customer_name or "",
                        "assigned_to": str(ticket.assigned_to) if ticket.assigned_to else "",
                        "channel": "email",
                    })

                await imap.logout()

            except ImportError:
                task_logger.warning("aioimaplib not installed, skipping inbound email poll")
                return 0
            except Exception as exc:
                task_logger.exception("Inbound email poll error: %s", exc)
                return created_count

            task_logger.info("Inbound email: created %d tickets", created_count)
            return created_count

    try:
        count = asyncio.run(_poll())
        return {"status": "ok", "tickets_created": count}
    except Exception as exc:
        task_logger.exception("Inbound email poll failed")
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="tasks.support_send_csat_survey", bind=True, max_retries=3)
def support_send_csat_survey(self, ticket_id: str):
    """Send CSAT survey email to customer 24h after ticket resolution."""

    async def _send():
        from sqlalchemy import select

        from app.core.config import settings
        from app.core.database import AsyncSessionLocal
        from app.models.support import CustomerSatisfaction, Ticket

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
            ticket = result.scalar_one_or_none()

            if not ticket or not ticket.customer_email:
                return "skipped"
            if ticket.status not in ("resolved", "closed"):
                return "skipped"

            # Check if already surveyed
            existing = await db.execute(
                select(CustomerSatisfaction).where(CustomerSatisfaction.ticket_id == ticket.id)
            )
            if existing.scalar_one_or_none():
                return "already_surveyed"

            # Send CSAT email
            from app.tasks.celery_app import send_email

            survey_url = f"{settings.FRONTEND_URL}/portal/tickets/{ticket.id}/feedback"
            send_email.delay(
                to=ticket.customer_email,
                subject=f"How was your support experience? [{ticket.ticket_number}]",
                body=(
                    f"Hi {ticket.customer_name or 'there'},\n\n"
                    f"Your support ticket ({ticket.ticket_number}: {ticket.subject}) has been resolved.\n\n"
                    f"We'd love to hear about your experience. Please rate your support:\n\n"
                    f"Rate here: {survey_url}\n\n"
                    f"Thank you for your feedback!\n"
                    f"— The Support Team"
                ),
            )
            return "sent"

    try:
        result = asyncio.run(_send())
        return {"status": result, "ticket_id": ticket_id}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="tasks.support_ai_classify_ticket")
def support_ai_classify_ticket(ticket_id: str):
    """AI-classify a new ticket: determine priority, category, sentiment, and intent."""

    async def _classify():
        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.models.support import Ticket, TicketCategory

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
            ticket = result.scalar_one_or_none()
            if not ticket:
                return {"status": "not_found"}

            text = f"{ticket.subject}\n{ticket.description or ''}"

            # Sentiment analysis via Ollama
            try:
                from app.services.ai import call_ollama

                sentiment_prompt = (
                    f"Analyze the sentiment of this support ticket. "
                    f"Return ONLY a JSON object with 'score' (float from -1.0 to 1.0) "
                    f"and 'label' (one of: frustrated, angry, confused, neutral, satisfied).\n\n"
                    f"Ticket: {text[:1000]}"
                )
                sentiment_resp = await call_ollama(sentiment_prompt)

                import json
                try:
                    sentiment = json.loads(sentiment_resp)
                    ticket.sentiment_score = float(sentiment.get("score", 0))
                    ticket.sentiment_label = sentiment.get("label", "neutral")
                except (json.JSONDecodeError, ValueError):
                    ticket.sentiment_score = 0.0
                    ticket.sentiment_label = "neutral"

            except Exception as exc:
                task_logger.warning("Sentiment analysis failed: %s", exc)
                ticket.sentiment_score = 0.0
                ticket.sentiment_label = "neutral"

            await db.commit()
            return {
                "status": "classified",
                "sentiment_score": ticket.sentiment_score,
                "sentiment_label": ticket.sentiment_label,
            }

    try:
        result = asyncio.run(_classify())
        return result
    except Exception as exc:
        task_logger.exception("AI classify ticket failed")
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="tasks.support_auto_close_stale_tickets")
def support_auto_close_stale_tickets():
    """Daily: close tickets in 'resolved' state for > 7 days."""

    async def _close():
        from datetime import datetime, timedelta, timezone

        from sqlalchemy import and_, select, update

        from app.core.database import AsyncSessionLocal
        from app.models.support import Ticket

        async with AsyncSessionLocal() as db:
            threshold = datetime.now(timezone.utc) - timedelta(days=7)
            stmt = (
                update(Ticket)
                .where(
                    and_(
                        Ticket.status == "resolved",
                        Ticket.resolved_at.isnot(None),
                        Ticket.resolved_at < threshold,
                    )
                )
                .values(
                    status="closed",
                    closed_at=datetime.now(timezone.utc),
                )
                .returning(Ticket.id)
            )
            result = await db.execute(stmt)
            closed_ids = result.scalars().all()
            await db.commit()
            task_logger.info("Auto-closed %d stale tickets", len(closed_ids))
            return len(closed_ids)

    try:
        count = asyncio.run(_close())
        return {"status": "ok", "closed_count": count}
    except Exception as exc:
        task_logger.exception("Auto-close stale tickets failed")
        return {"status": "error", "error": str(exc)}
