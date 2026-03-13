"""Calendar analytics & meeting prep API."""

import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.models.calendar import CalendarEvent
from app.models.crm import Contact, Deal
from app.models.finance import Invoice
from app.models.support import Ticket

router = APIRouter()


# ── Meeting analytics ─────────────────────────────────────────────────────────

@router.get("/analytics/summary", summary="Calendar analytics summary")
async def calendar_analytics_summary(
    current_user: CurrentUser,
    db: DBSession,
    days: int = Query(30, ge=7, le=365, description="Lookback period in days"),
) -> dict[str, Any]:
    """Meeting trends, time breakdown, and productivity insights."""
    since = datetime.utcnow() - timedelta(days=days)

    # Total events
    total_q = await db.execute(
        select(func.count(CalendarEvent.id)).where(
            CalendarEvent.organizer_id == current_user.id,
            CalendarEvent.start_time >= since,
        )
    )
    total_events = total_q.scalar() or 0

    # By type
    type_q = await db.execute(
        select(CalendarEvent.event_type, func.count(CalendarEvent.id))
        .where(CalendarEvent.organizer_id == current_user.id, CalendarEvent.start_time >= since)
        .group_by(CalendarEvent.event_type)
    )
    by_type = {row[0]: row[1] for row in type_q.all()}

    # Total meeting hours
    meeting_hours_q = await db.execute(
        select(
            func.sum(
                func.extract("epoch", CalendarEvent.end_time - CalendarEvent.start_time) / 3600
            )
        ).where(
            CalendarEvent.organizer_id == current_user.id,
            CalendarEvent.event_type == "meeting",
            CalendarEvent.start_time >= since,
        )
    )
    total_meeting_hours = round(meeting_hours_q.scalar() or 0, 1)

    # Average meeting duration
    avg_dur_q = await db.execute(
        select(
            func.avg(
                func.extract("epoch", CalendarEvent.end_time - CalendarEvent.start_time) / 60
            )
        ).where(
            CalendarEvent.organizer_id == current_user.id,
            CalendarEvent.event_type == "meeting",
            CalendarEvent.start_time >= since,
        )
    )
    avg_meeting_minutes = round(avg_dur_q.scalar() or 0, 0)

    # Meetings per week
    weeks = max(days / 7, 1)
    meetings_per_week = round(by_type.get("meeting", 0) / weeks, 1)

    # Busiest day of week
    busiest_q = await db.execute(
        select(
            func.extract("dow", CalendarEvent.start_time).label("dow"),
            func.count(CalendarEvent.id).label("cnt"),
        )
        .where(CalendarEvent.organizer_id == current_user.id, CalendarEvent.start_time >= since)
        .group_by("dow")
        .order_by(func.count(CalendarEvent.id).desc())
        .limit(1)
    )
    busiest_row = busiest_q.first()
    day_names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    busiest_day = day_names[int(busiest_row[0])] if busiest_row else "N/A"

    # Events by priority
    priority_q = await db.execute(
        select(CalendarEvent.priority, func.count(CalendarEvent.id))
        .where(CalendarEvent.organizer_id == current_user.id, CalendarEvent.start_time >= since)
        .group_by(CalendarEvent.priority)
    )
    by_priority = {row[0]: row[1] for row in priority_q.all()}

    # Focus time ratio (focus events / total non-all-day events)
    focus_count = by_type.get("focus", 0)
    non_allday_q = await db.execute(
        select(func.count(CalendarEvent.id)).where(
            CalendarEvent.organizer_id == current_user.id,
            CalendarEvent.start_time >= since,
            CalendarEvent.all_day.is_(False),
        )
    )
    non_allday = non_allday_q.scalar() or 1
    focus_ratio = round(focus_count / non_allday * 100, 1)

    return {
        "period_days": days,
        "total_events": total_events,
        "by_type": by_type,
        "total_meeting_hours": total_meeting_hours,
        "avg_meeting_minutes": avg_meeting_minutes,
        "meetings_per_week": meetings_per_week,
        "busiest_day": busiest_day,
        "by_priority": by_priority,
        "focus_time_ratio_pct": focus_ratio,
    }


# ── Meeting prep card ─────────────────────────────────────────────────────────

@router.get("/events/{event_id}/prep", summary="Get meeting prep card with ERP context")
async def meeting_prep_card(
    event_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Auto-pull attendee CRM profiles, recent deals, open tickets, and invoices."""
    event = await db.get(CalendarEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    prep = {
        "event_id": str(event.id),
        "title": event.title,
        "start_time": event.start_time.isoformat(),
        "end_time": event.end_time.isoformat(),
        "attendees": event.attendees or [],
        "erp_context": event.erp_context,
        "crm_context": [],
        "finance_context": [],
        "support_context": [],
    }

    # If event has ERP context, pull live data
    erp = event.erp_context or {}

    # Pull CRM contact data
    if erp.get("contact_id"):
        contact = await db.get(Contact, uuid.UUID(erp["contact_id"]))
        if contact:
            prep["crm_context"].append({
                "type": "contact",
                "id": str(contact.id),
                "name": f"{contact.first_name} {contact.last_name}",
                "email": contact.email,
                "company": contact.company,
            })

    # Pull deal data
    if erp.get("deal_id"):
        deal = await db.get(Deal, uuid.UUID(erp["deal_id"]))
        if deal:
            prep["crm_context"].append({
                "type": "deal",
                "id": str(deal.id),
                "name": deal.name,
                "stage": deal.stage,
                "value": float(deal.value) if deal.value else None,
            })

    # Pull invoice data
    if erp.get("invoice_id"):
        invoice = await db.get(Invoice, uuid.UUID(erp["invoice_id"]))
        if invoice:
            prep["finance_context"].append({
                "type": "invoice",
                "id": str(invoice.id),
                "number": getattr(invoice, "invoice_number", None),
                "total": float(invoice.total_amount) if hasattr(invoice, "total_amount") else None,
                "status": invoice.status,
            })

    # Pull support ticket data
    if erp.get("ticket_id"):
        ticket = await db.get(Ticket, uuid.UUID(erp["ticket_id"]))
        if ticket:
            prep["support_context"].append({
                "type": "ticket",
                "id": str(ticket.id),
                "subject": ticket.subject,
                "priority": ticket.priority,
                "status": ticket.status,
            })

    # Recent meetings with the same attendees (for context)
    if event.attendees:
        # Find last 3 meetings with overlapping attendees
        recent_q = await db.execute(
            select(CalendarEvent)
            .where(
                CalendarEvent.organizer_id == current_user.id,
                CalendarEvent.event_type == "meeting",
                CalendarEvent.id != event.id,
                CalendarEvent.start_time < event.start_time,
            )
            .order_by(CalendarEvent.start_time.desc())
            .limit(20)
        )
        recent_meetings = recent_q.scalars().all()
        related = []
        for m in recent_meetings:
            if m.attendees and any(a in event.attendees for a in m.attendees):
                related.append({
                    "id": str(m.id),
                    "title": m.title,
                    "date": m.start_time.isoformat(),
                })
                if len(related) >= 3:
                    break
        prep["recent_related_meetings"] = related

    return prep


# ── ERP-linked event creation helpers ─────────────────────────────────────────

@router.post("/events/from-invoice", status_code=status.HTTP_201_CREATED, summary="Create event linked to an invoice")
async def create_event_from_invoice(
    invoice_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    title: str = Query("Invoice Follow-up"),
    start_time: datetime = Query(...),
) -> dict[str, Any]:
    """One-click create event linked to a Finance invoice with auto-populated context."""
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    event = CalendarEvent(
        title=f"{title} — INV #{getattr(invoice, 'invoice_number', str(invoice_id)[:8])}",
        description=f"Follow-up for invoice {getattr(invoice, 'invoice_number', '')}. Amount: {getattr(invoice, 'total_amount', 'N/A')}",
        start_time=start_time,
        end_time=start_time + timedelta(minutes=30),
        event_type="meeting",
        organizer_id=current_user.id,
        priority="high",
        erp_context={
            "invoice_id": str(invoice_id),
            "invoice_number": getattr(invoice, "invoice_number", None),
            "invoice_amount": float(getattr(invoice, "total_amount", 0)),
        },
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    from app.api.v1.calendar_router import EventOut
    return EventOut.model_validate(event).model_dump()


@router.post("/events/from-ticket", status_code=status.HTTP_201_CREATED, summary="Create callback event from support ticket")
async def create_event_from_ticket(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    start_time: datetime = Query(...),
) -> dict[str, Any]:
    """Auto-schedule customer callback from a support ticket."""
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    priority_map = {"urgent": "urgent", "high": "high", "medium": "normal", "low": "low"}

    event = CalendarEvent(
        title=f"Callback: {ticket.subject}",
        description=f"Customer callback for ticket: {ticket.subject}\nPriority: {ticket.priority}\nStatus: {ticket.status}",
        start_time=start_time,
        end_time=start_time + timedelta(minutes=30),
        event_type="meeting",
        organizer_id=current_user.id,
        priority=priority_map.get(ticket.priority, "normal"),
        erp_context={
            "ticket_id": str(ticket_id),
            "ticket_subject": ticket.subject,
            "ticket_priority": ticket.priority,
        },
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    from app.api.v1.calendar_router import EventOut
    return EventOut.model_validate(event).model_dump()
