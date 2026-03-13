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

            # Sentiment analysis via AI
            try:
                from app.tasks.file_processing import _ai_chat

                sentiment_prompt = (
                    f"Analyze the sentiment of this support ticket. "
                    f"Return ONLY a JSON object with 'score' (float from -1.0 to 1.0) "
                    f"and 'label' (one of: frustrated, angry, confused, neutral, satisfied).\n\n"
                    f"Ticket: {text[:1000]}"
                )
                sentiment_resp = await _ai_chat([
                    {"role": "system", "content": "You are a sentiment analysis assistant. Respond with valid JSON only."},
                    {"role": "user", "content": sentiment_prompt},
                ])

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


# ── Phase 2 Tasks ─────────────────────────────────────────────────────────────


@celery_app.task(name="tasks.support_evaluate_automations")
def support_evaluate_automations(ticket_id: str, trigger_event: str):
    """Evaluate all active automations for a given ticket and trigger event."""

    async def _evaluate():
        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.core.events import event_bus
        from app.models.support import Ticket, TicketComment
        from app.models.support_phase2 import SupportAutomation, SupportAutomationLog

        async with AsyncSessionLocal() as db:
            ticket = (await db.execute(
                select(Ticket).where(Ticket.id == ticket_id)
            )).scalar_one_or_none()
            if not ticket:
                return {"status": "ticket_not_found"}

            automations = (await db.execute(
                select(SupportAutomation).where(
                    SupportAutomation.is_active == True,  # noqa: E712
                    SupportAutomation.trigger_event == trigger_event,
                )
            )).scalars().all()

            executed = []
            for auto in automations:
                # Check conditions
                conditions = auto.conditions or {}
                match = True
                for field, expected in conditions.items():
                    actual = getattr(ticket, field, None)
                    if actual is None:
                        match = False
                        break
                    if isinstance(expected, list):
                        if actual not in expected:
                            match = False
                            break
                    elif str(actual) != str(expected):
                        match = False
                        break

                if not match:
                    continue

                # Execute actions
                actions_done = []
                try:
                    for action in (auto.actions or []):
                        atype = action.get("type")
                        if atype == "assign":
                            import uuid as _uuid
                            ticket.assigned_to = _uuid.UUID(action["user_id"])
                            actions_done.append(f"assigned to {action['user_id']}")
                        elif atype == "set_priority":
                            ticket.priority = action["value"]
                            actions_done.append(f"priority → {action['value']}")
                        elif atype == "add_tag":
                            tags = ticket.tags or []
                            if action["value"] not in tags:
                                tags.append(action["value"])
                                ticket.tags = tags
                            actions_done.append(f"tag +{action['value']}")
                        elif atype == "add_comment":
                            comment = TicketComment(
                                ticket_id=ticket.id,
                                author_id=auto.created_by,
                                content=action.get("content", ""),
                                is_internal=action.get("is_internal", True),
                            )
                            db.add(comment)
                            actions_done.append("added comment")
                        elif atype == "send_notification":
                            await event_bus.publish("support.automation.notification", {
                                "ticket_id": str(ticket.id),
                                "message": action.get("message", ""),
                                "user_id": action.get("user_id", ""),
                            })
                            actions_done.append("sent notification")

                    from datetime import datetime, timezone
                    auto.execution_count += 1
                    auto.last_executed_at = datetime.now(timezone.utc)

                    log = SupportAutomationLog(
                        automation_id=auto.id,
                        ticket_id=ticket.id,
                        actions_executed=actions_done,
                        success=True,
                    )
                    db.add(log)
                    executed.append(auto.name)

                except Exception as exc:
                    log = SupportAutomationLog(
                        automation_id=auto.id,
                        ticket_id=ticket.id,
                        actions_executed=actions_done,
                        success=False,
                        error_message=str(exc),
                    )
                    db.add(log)

            await db.commit()
            task_logger.info(
                "Automations for ticket %s: %d matched, executed: %s",
                ticket_id, len(executed), ", ".join(executed) or "none",
            )
            return {"status": "ok", "executed": executed}

    try:
        return asyncio.run(_evaluate())
    except Exception as exc:
        task_logger.exception("Evaluate automations failed")
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="tasks.support_weekly_digest")
def support_weekly_digest():
    """Weekly: send digest email to support admins with key metrics."""

    async def _digest():
        from datetime import datetime, timedelta, timezone

        from sqlalchemy import and_, func, select

        from app.core.config import settings
        from app.core.database import AsyncSessionLocal
        from app.models.support import Ticket
        from app.models.user import User

        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            week_ago = now - timedelta(days=7)

            # Gather metrics
            new_count = (await db.execute(
                select(func.count(Ticket.id)).where(Ticket.created_at >= week_ago)
            )).scalar() or 0

            resolved_count = (await db.execute(
                select(func.count(Ticket.id)).where(
                    and_(Ticket.resolved_at.isnot(None), Ticket.resolved_at >= week_ago)
                )
            )).scalar() or 0

            open_count = (await db.execute(
                select(func.count(Ticket.id)).where(Ticket.status.in_(["open", "in_progress"]))
            )).scalar() or 0

            sla_breached = (await db.execute(
                select(func.count(Ticket.id)).where(
                    and_(
                        Ticket.created_at >= week_ago,
                        (Ticket.sla_response_breached == True) | (Ticket.sla_resolution_breached == True),  # noqa: E712
                    )
                )
            )).scalar() or 0

            # Send to admins
            admins = (await db.execute(
                select(User).where(User.is_active == True, User.role.in_(["super_admin", "admin"]))  # noqa: E712
            )).scalars().all()

            from app.tasks.celery_app import send_email
            for admin in admins:
                send_email.delay(
                    to=admin.email,
                    subject=f"Weekly Support Digest — {now.strftime('%b %d, %Y')}",
                    body=(
                        f"Support Weekly Digest\n"
                        f"{'=' * 40}\n\n"
                        f"New tickets this week: {new_count}\n"
                        f"Resolved this week: {resolved_count}\n"
                        f"Currently open: {open_count}\n"
                        f"SLA breached: {sla_breached}\n\n"
                        f"View details: {settings.FRONTEND_URL}/support\n"
                    ),
                )

            task_logger.info("Weekly digest sent to %d admins", len(admins))
            return {"admins_notified": len(admins), "new": new_count, "resolved": resolved_count}

    try:
        return asyncio.run(_digest())
    except Exception as exc:
        task_logger.exception("Weekly digest failed")
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="tasks.support_ai_auto_respond")
def support_ai_auto_respond(ticket_id: str):
    """AI: generate and post an auto-response draft for a new ticket."""

    async def _respond():
        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.models.support import Ticket, TicketComment, SupportKnowledgeBaseArticle

        async with AsyncSessionLocal() as db:
            ticket = (await db.execute(
                select(Ticket).where(Ticket.id == ticket_id)
            )).scalar_one_or_none()
            if not ticket:
                return {"status": "not_found"}

            # Find relevant KB articles
            keywords = ticket.subject.split()[:5]
            kb_articles = []
            for kw in keywords:
                if len(kw) < 3:
                    continue
                results = (await db.execute(
                    select(SupportKnowledgeBaseArticle).where(
                        SupportKnowledgeBaseArticle.status == "published",
                        SupportKnowledgeBaseArticle.title.ilike(f"%{kw}%"),
                    ).limit(3)
                )).scalars().all()
                kb_articles.extend(results)
            # Deduplicate
            seen_ids = set()
            unique_articles = []
            for a in kb_articles:
                if a.id not in seen_ids:
                    seen_ids.add(a.id)
                    unique_articles.append(a)

            kb_context = "\n".join(
                f"- {a.title}: {(a.content or '')[:200]}" for a in unique_articles[:5]
            )

            # Generate response via AI
            try:
                from app.tasks.file_processing import _ai_chat
                prompt = (
                    f"You are a helpful support agent. Draft a professional response to this support ticket.\n\n"
                    f"Subject: {ticket.subject}\n"
                    f"Description: {(ticket.description or '')[:1000]}\n\n"
                )
                if kb_context:
                    prompt += f"Relevant knowledge base articles:\n{kb_context}\n\n"
                prompt += (
                    "Draft a helpful, empathetic response. If KB articles are relevant, reference them. "
                    "Keep it concise (2-3 paragraphs max)."
                )

                draft = await _ai_chat([
                    {"role": "system", "content": "You are a helpful, empathetic support agent."},
                    {"role": "user", "content": prompt},
                ])

            except Exception as exc:
                task_logger.warning("AI auto-respond LLM call failed: %s", exc)
                draft = (
                    f"Thank you for contacting support regarding \"{ticket.subject}\".\n\n"
                    f"We've received your request and a support agent will review it shortly. "
                    f"Your ticket number is {ticket.ticket_number}."
                )

            # Save as internal draft comment
            comment = TicketComment(
                ticket_id=ticket.id,
                author_id=ticket.assigned_to or ticket.created_by,
                content=f"[AI Draft Response]\n\n{draft}",
                is_internal=True,
            )
            db.add(comment)
            await db.commit()

            return {"status": "drafted", "draft_length": len(draft)}

    try:
        return asyncio.run(_respond())
    except Exception as exc:
        task_logger.exception("AI auto-respond failed")
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="tasks.support_evaluate_escalation_chains")
def support_evaluate_escalation_chains():
    """Periodic: check SLA escalation chains and execute matching escalation levels."""

    async def _evaluate():
        from datetime import datetime, timedelta, timezone

        from sqlalchemy import and_, select

        from app.core.database import AsyncSessionLocal
        from app.core.events import event_bus
        from app.models.support import Ticket
        from app.models.support_phase2 import SLAEscalationChain

        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)

            # Get all active tickets with SLA due dates
            tickets_q = select(Ticket).where(
                Ticket.status.in_(["open", "in_progress"]),
                Ticket.sla_resolution_due.isnot(None),
                Ticket.resolved_at.is_(None),
            )
            tickets = (await db.execute(tickets_q)).scalars().all()

            escalation_count = 0
            for ticket in tickets:
                minutes_until_breach = (ticket.sla_resolution_due - now).total_seconds() / 60

                # Find matching escalation chains
                chains = (await db.execute(
                    select(SLAEscalationChain).where(
                        SLAEscalationChain.trigger_minutes_before_breach >= minutes_until_breach,
                    ).order_by(SLAEscalationChain.level)
                )).scalars().all()

                for chain in chains:
                    if chain.action == "notify":
                        if chain.target_user_id:
                            await event_bus.publish("support.escalation.triggered", {
                                "ticket_id": str(ticket.id),
                                "ticket_number": ticket.ticket_number,
                                "level": chain.level,
                                "target_user_id": str(chain.target_user_id),
                                "action": "notify",
                                "minutes_until_breach": round(minutes_until_breach),
                            })
                    elif chain.action == "reassign":
                        if chain.target_user_id:
                            ticket.assigned_to = chain.target_user_id
                            await event_bus.publish("support.ticket.assigned", {
                                "ticket_id": str(ticket.id),
                                "ticket_number": ticket.ticket_number,
                                "assigned_to": str(chain.target_user_id),
                                "reason": f"SLA escalation level {chain.level}",
                            })
                    elif chain.action == "escalate":
                        ticket.priority = "urgent"
                        await event_bus.publish("support.sla.breached", {
                            "ticket_id": str(ticket.id),
                            "ticket_number": ticket.ticket_number,
                            "sla_type": "escalation",
                            "level": chain.level,
                        })

                    escalation_count += 1

            await db.commit()
            task_logger.info("Escalation chains: %d actions triggered", escalation_count)
            return {"status": "ok", "escalations": escalation_count}

    try:
        return asyncio.run(_evaluate())
    except Exception as exc:
        task_logger.exception("Escalation chain evaluation failed")
        return {"status": "error", "error": str(exc)}


# ── Phase 3 Tasks ─────────────────────────────────────────────────────────────


@celery_app.task(name="tasks.support_daily_analytics_snapshot")
def support_daily_analytics_snapshot():
    """Daily: capture support metrics snapshot for trend analysis."""

    async def _snapshot():
        from datetime import datetime, timedelta, timezone

        from sqlalchemy import and_, func, select

        from app.core.database import AsyncSessionLocal
        from app.models.support import CustomerSatisfaction, Ticket, TicketComment
        from app.models.support_phase3 import SupportAnalyticsSnapshot

        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            yesterday_start = today_start - timedelta(days=1)

            day_filter = and_(Ticket.created_at >= yesterday_start, Ticket.created_at < today_start)

            new_tickets = (await db.execute(
                select(func.count(Ticket.id)).where(day_filter)
            )).scalar() or 0

            resolved = (await db.execute(
                select(func.count(Ticket.id)).where(
                    and_(Ticket.resolved_at >= yesterday_start, Ticket.resolved_at < today_start)
                )
            )).scalar() or 0

            closed = (await db.execute(
                select(func.count(Ticket.id)).where(
                    and_(Ticket.closed_at >= yesterday_start, Ticket.closed_at < today_start)
                )
            )).scalar() or 0

            backlog = (await db.execute(
                select(func.count(Ticket.id)).where(Ticket.status.in_(["open", "in_progress"]))
            )).scalar() or 0

            # SLA compliance
            total_sla = (await db.execute(
                select(func.count(Ticket.id)).where(
                    day_filter, Ticket.sla_response_due.isnot(None)
                )
            )).scalar() or 0
            breached = (await db.execute(
                select(func.count(Ticket.id)).where(
                    day_filter,
                    (Ticket.sla_response_breached == True) | (Ticket.sla_resolution_breached == True),  # noqa: E712
                )
            )).scalar() or 0
            sla_pct = round((1 - breached / max(total_sla, 1)) * 100, 1)

            # Avg response time
            resp_q = select(
                func.avg(
                    func.extract("epoch", Ticket.first_response_at - Ticket.created_at) / 60
                )
            ).where(day_filter, Ticket.first_response_at.isnot(None))
            avg_response = (await db.execute(resp_q)).scalar()

            # CSAT
            csat_q = select(
                func.avg(CustomerSatisfaction.score), func.count(CustomerSatisfaction.id)
            ).where(CustomerSatisfaction.created_at >= yesterday_start, CustomerSatisfaction.created_at < today_start)
            csat_row = (await db.execute(csat_q)).one_or_none()
            avg_csat = csat_row[0] if csat_row else None
            csat_responses = csat_row[1] if csat_row else 0

            # Channel breakdown
            ch_q = select(Ticket.channel, func.count(Ticket.id)).where(day_filter).group_by(Ticket.channel)
            channel_breakdown = {row[0] or "web": row[1] for row in (await db.execute(ch_q)).all()}

            # Priority breakdown
            pr_q = select(Ticket.priority, func.count(Ticket.id)).where(day_filter).group_by(Ticket.priority)
            priority_breakdown = {row[0]: row[1] for row in (await db.execute(pr_q)).all()}

            snapshot = SupportAnalyticsSnapshot(
                snapshot_date=yesterday_start,
                new_tickets=new_tickets,
                resolved_tickets=resolved,
                closed_tickets=closed,
                backlog_count=backlog,
                sla_compliance_pct=sla_pct,
                avg_response_minutes=round(avg_response, 1) if avg_response else None,
                avg_csat=round(avg_csat, 2) if avg_csat else None,
                csat_responses=csat_responses,
                channel_breakdown=channel_breakdown,
                priority_breakdown=priority_breakdown,
            )
            db.add(snapshot)
            await db.commit()

            task_logger.info("Analytics snapshot: %d new, %d resolved, backlog=%d", new_tickets, resolved, backlog)
            return {"status": "ok", "date": yesterday_start.isoformat()}

    try:
        return asyncio.run(_snapshot())
    except Exception as exc:
        task_logger.exception("Daily analytics snapshot failed")
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="tasks.support_evaluate_proactive_rules")
def support_evaluate_proactive_rules(event_name: str, event_data: dict | None = None):
    """Evaluate proactive rules against an incoming event."""

    async def _evaluate():
        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.core.events import event_bus
        from app.models.support_phase3 import ProactiveRule

        async with AsyncSessionLocal() as db:
            rules = (await db.execute(
                select(ProactiveRule).where(
                    ProactiveRule.is_active == True,  # noqa: E712
                    ProactiveRule.trigger_type == "event",
                )
            )).scalars().all()

            executed = []
            data = event_data or {}

            for rule in rules:
                conditions = rule.trigger_conditions or {}
                if conditions.get("event") != event_name:
                    continue

                # Check threshold conditions
                threshold = conditions.get("threshold")
                metric = conditions.get("metric")
                if threshold and metric:
                    actual_value = data.get(metric, 0)
                    if actual_value < threshold:
                        continue

                # Execute actions
                for action in (rule.actions or []):
                    atype = action.get("type")
                    if atype == "notify_agent":
                        await event_bus.publish("support.proactive.alert", {
                            "rule_name": rule.name,
                            "message": action.get("message", ""),
                            "event_data": data,
                        })
                    elif atype == "create_ticket":
                        from app.models.support import Ticket
                        ticket = Ticket(
                            ticket_number=f"PRO-{rule.id.hex[:8]}",
                            subject=action.get("subject", f"Proactive: {rule.name}"),
                            description=action.get("template", str(data)),
                            priority=action.get("priority", "medium"),
                            status="open",
                            channel="proactive",
                            created_by=rule.created_by,
                        )
                        db.add(ticket)

                from datetime import datetime, timezone
                rule.execution_count += 1
                rule.last_triggered_at = datetime.now(timezone.utc)
                executed.append(rule.name)

            await db.commit()
            task_logger.info("Proactive rules: %d executed for event %s", len(executed), event_name)
            return {"status": "ok", "executed": executed}

    try:
        return asyncio.run(_evaluate())
    except Exception as exc:
        task_logger.exception("Proactive rules evaluation failed")
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="tasks.support_compute_customer_health")
def support_compute_customer_health(customer_email: str | None = None):
    """Compute customer health scores based on ticket history and sentiment."""

    async def _compute():
        from datetime import datetime, timedelta, timezone

        from sqlalchemy import func, select

        from app.core.database import AsyncSessionLocal
        from app.models.support import CustomerSatisfaction, Ticket
        from app.models.support_phase3 import CustomerHealthScore

        async with AsyncSessionLocal() as db:
            # Get unique customer emails
            if customer_email:
                emails = [customer_email]
            else:
                email_q = select(Ticket.customer_email).where(
                    Ticket.customer_email.isnot(None), Ticket.customer_email != ""
                ).distinct()
                emails = [r[0] for r in (await db.execute(email_q)).all()]

            now = datetime.now(timezone.utc)
            computed = 0

            for email in emails:
                tickets = (await db.execute(
                    select(Ticket).where(Ticket.customer_email.ilike(email)).order_by(Ticket.created_at.desc())
                )).scalars().all()

                if not tickets:
                    continue

                total = len(tickets)
                # Ticket frequency (per month over last 6 months)
                six_months_ago = now - timedelta(days=180)
                recent_tickets = [t for t in tickets if t.created_at >= six_months_ago]
                frequency = len(recent_tickets) / 6.0

                # Avg sentiment
                sentiments = [t.sentiment_score for t in tickets if t.sentiment_score is not None]
                avg_sentiment = sum(sentiments) / max(len(sentiments), 1) if sentiments else 0

                # CSAT
                csat_scores = []
                for t in tickets[:20]:
                    cs = (await db.execute(
                        select(CustomerSatisfaction).where(CustomerSatisfaction.ticket_id == t.id)
                    )).scalar_one_or_none()
                    if cs and cs.score is not None:
                        csat_scores.append(cs.score)
                avg_csat = sum(csat_scores) / max(len(csat_scores), 1) if csat_scores else None

                # Compute scores (0-100)
                engagement = min(100, int(frequency * 20))
                satisfaction = int((avg_csat or 3) * 20) if avg_csat else 50
                sentiment_score_adj = int((avg_sentiment + 1) * 50)
                effort = max(0, 100 - int(frequency * 10))
                overall = int((engagement * 0.2 + satisfaction * 0.35 + sentiment_score_adj * 0.25 + effort * 0.2))

                # Risk level
                risk = "healthy"
                churn_prob = 0.1
                factors = []

                if overall < 30:
                    risk = "critical"
                    churn_prob = 0.7
                    factors.append({"factor": "Very low overall score", "impact": -30})
                elif overall < 50:
                    risk = "at_risk"
                    churn_prob = 0.4
                    factors.append({"factor": "Below average score", "impact": -15})

                if avg_sentiment < -0.3:
                    factors.append({"factor": "Negative sentiment trend", "impact": -10})
                    churn_prob += 0.1
                if frequency > 5:
                    factors.append({"factor": "High ticket volume", "impact": -5})

                # Upsert
                existing = (await db.execute(
                    select(CustomerHealthScore).where(CustomerHealthScore.customer_email.ilike(email))
                )).scalar_one_or_none()

                if existing:
                    existing.overall_score = overall
                    existing.engagement_score = engagement
                    existing.satisfaction_score = satisfaction
                    existing.effort_score = effort
                    existing.ticket_frequency = round(frequency, 2)
                    existing.avg_sentiment = round(avg_sentiment, 2)
                    existing.avg_csat = round(avg_csat, 2) if avg_csat else None
                    existing.last_ticket_at = tickets[0].created_at
                    existing.total_tickets = total
                    existing.risk_level = risk
                    existing.churn_probability = round(churn_prob, 2)
                    existing.score_factors = factors
                    existing.computed_at = now
                else:
                    score = CustomerHealthScore(
                        customer_email=email,
                        overall_score=overall,
                        engagement_score=engagement,
                        satisfaction_score=satisfaction,
                        effort_score=effort,
                        ticket_frequency=round(frequency, 2),
                        avg_sentiment=round(avg_sentiment, 2),
                        avg_csat=round(avg_csat, 2) if avg_csat else None,
                        last_ticket_at=tickets[0].created_at,
                        total_tickets=total,
                        risk_level=risk,
                        churn_probability=round(churn_prob, 2),
                        score_factors=factors,
                        computed_at=now,
                    )
                    db.add(score)

                computed += 1

            await db.commit()
            task_logger.info("Customer health: computed %d scores", computed)
            return {"status": "ok", "computed": computed}

    try:
        return asyncio.run(_compute())
    except Exception as exc:
        task_logger.exception("Customer health computation failed")
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="tasks.support_transcribe_voice")
def support_transcribe_voice(call_id: str):
    """Transcribe a voice call recording via AI."""

    async def _transcribe():
        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.models.support_phase3 import VoiceCallRecord

        async with AsyncSessionLocal() as db:
            call = (await db.execute(
                select(VoiceCallRecord).where(VoiceCallRecord.id == call_id)
            )).scalar_one_or_none()
            if not call or not call.recording_url:
                return {"status": "no_recording"}

            # Placeholder: real implementation would download recording and use Whisper API
            call.transcript = "[Transcription service not yet configured. Recording available at: " + call.recording_url + "]"
            await db.commit()
            return {"status": "pending", "call_id": call_id}

    try:
        return asyncio.run(_transcribe())
    except Exception as exc:
        task_logger.exception("Voice transcription failed")
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="tasks.support_cleanup_expired_sandboxes")
def support_cleanup_expired_sandboxes():
    """Daily: deactivate expired sandboxes."""

    async def _cleanup():
        from datetime import datetime, timezone

        from sqlalchemy import and_, select, update

        from app.core.database import AsyncSessionLocal
        from app.models.support_phase3 import SupportSandbox

        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            stmt = (
                update(SupportSandbox)
                .where(
                    and_(
                        SupportSandbox.is_active == True,  # noqa: E712
                        SupportSandbox.expires_at.isnot(None),
                        SupportSandbox.expires_at < now,
                    )
                )
                .values(is_active=False)
                .returning(SupportSandbox.id)
            )
            result = await db.execute(stmt)
            expired = result.scalars().all()
            await db.commit()
            task_logger.info("Cleaned up %d expired sandboxes", len(expired))
            return len(expired)

    try:
        count = asyncio.run(_cleanup())
        return {"status": "ok", "expired_count": count}
    except Exception as exc:
        task_logger.exception("Sandbox cleanup failed")
        return {"status": "error", "error": str(exc)}
