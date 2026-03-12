"""Support Extensions — SLA status, Canned Responses, Ticket Merge, CSAT, Reports, Dashboard KPIs."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select

from app.core.deps import CurrentUser, DBSession
from app.models.support import (
    CannedResponse,
    CustomerSatisfaction,
    SupportSLAPolicy as SLAPolicy,
    Ticket,
    TicketComment,
    TicketRoutingRule,
)

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

# -- SLA --

class SLAPolicyCreate(BaseModel):
    name: str
    response_time_hours: int
    resolution_time_hours: int
    priority_rules: dict | None = None
    is_active: bool = True


class SLAPolicyOut(BaseModel):
    id: uuid.UUID
    name: str
    priority: str
    response_time_hours: int
    resolution_time_hours: int
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Canned Responses --

class CannedResponseCreate(BaseModel):
    name: str
    content: str
    category: str


class CannedResponseUpdate(BaseModel):
    name: str | None = None
    content: str | None = None
    category: str | None = None


class CannedResponseOut(BaseModel):
    id: uuid.UUID
    name: str
    content: str
    category: str
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Ticket Merge --

class TicketMergePayload(BaseModel):
    source_ticket_ids: list[uuid.UUID]


# -- Customer Satisfaction --

class SatisfactionCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    feedback: str | None = None


class SatisfactionOut(BaseModel):
    id: uuid.UUID
    ticket_id: uuid.UUID
    rating: int
    feedback: str | None
    submitted_at: Any

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════════════════════
#  SLA POLICIES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/sla-policies", summary="List SLA policies")
async def list_sla_policies(
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(SLAPolicy).order_by(SLAPolicy.name)
    )
    policies = result.scalars().all()
    return [SLAPolicyOut.model_validate(p).model_dump() for p in policies]


@router.post(
    "/sla-policies",
    status_code=status.HTTP_201_CREATED,
    summary="Create an SLA policy",
)
async def create_sla_policy(
    payload: SLAPolicyCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    policy = SLAPolicy(
        name=payload.name,
        priority="medium",  # default; can be adjusted via existing SLA update
        response_time_hours=payload.response_time_hours,
        resolution_time_hours=payload.resolution_time_hours,
        is_active=payload.is_active,
    )
    db.add(policy)
    await db.commit()
    await db.refresh(policy)
    return SLAPolicyOut.model_validate(policy).model_dump()


@router.get("/tickets/{ticket_id}/sla-status", summary="Get SLA status for a ticket")
async def get_ticket_sla_status(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    now = datetime.now(timezone.utc)

    response_status = "not_set"
    resolution_status = "not_set"
    response_remaining_hours: float | None = None
    resolution_remaining_hours: float | None = None

    if ticket.sla_response_due:
        if ticket.sla_response_breached:
            response_status = "breached"
        elif ticket.first_response_at:
            response_status = "met"
        elif now > ticket.sla_response_due:
            response_status = "breached"
        else:
            response_status = "on_track"
            response_remaining_hours = round(
                (ticket.sla_response_due - now).total_seconds() / 3600, 1
            )

    if ticket.sla_resolution_due:
        if ticket.sla_resolution_breached:
            resolution_status = "breached"
        elif ticket.status in ("resolved", "closed"):
            resolution_status = "met"
        elif now > ticket.sla_resolution_due:
            resolution_status = "breached"
        else:
            resolution_status = "on_track"
            resolution_remaining_hours = round(
                (ticket.sla_resolution_due - now).total_seconds() / 3600, 1
            )

    return {
        "ticket_id": str(ticket_id),
        "ticket_number": ticket.ticket_number,
        "priority": ticket.priority,
        "response": {
            "status": response_status,
            "due": ticket.sla_response_due.isoformat() if ticket.sla_response_due else None,
            "responded_at": ticket.first_response_at.isoformat() if ticket.first_response_at else None,
            "remaining_hours": response_remaining_hours,
        },
        "resolution": {
            "status": resolution_status,
            "due": ticket.sla_resolution_due.isoformat() if ticket.sla_resolution_due else None,
            "resolved_at": ticket.resolved_at.isoformat() if ticket.resolved_at else None,
            "remaining_hours": resolution_remaining_hours,
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
#  CANNED RESPONSES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/canned-responses", summary="List canned responses")
async def list_canned_responses(
    current_user: CurrentUser,
    db: DBSession,
    category: str | None = Query(None),
    search: str | None = Query(None),
) -> list[dict[str, Any]]:
    query = select(CannedResponse)

    if category:
        query = query.where(CannedResponse.category == category)
    if search:
        like = f"%{search}%"
        query = query.where(
            CannedResponse.name.ilike(like) | CannedResponse.content.ilike(like)
        )

    query = query.order_by(CannedResponse.name.asc())
    result = await db.execute(query)
    responses = result.scalars().all()
    return [CannedResponseOut.model_validate(r).model_dump() for r in responses]


@router.post(
    "/canned-responses",
    status_code=status.HTTP_201_CREATED,
    summary="Create a canned response",
)
async def create_canned_response(
    payload: CannedResponseCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    cr = CannedResponse(
        name=payload.name,
        content=payload.content,
        category=payload.category,
        created_by=current_user.id,
    )
    db.add(cr)
    await db.commit()
    await db.refresh(cr)
    return CannedResponseOut.model_validate(cr).model_dump()


@router.put("/canned-responses/{cr_id}", summary="Update a canned response")
async def update_canned_response(
    cr_id: uuid.UUID,
    payload: CannedResponseUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    cr = await db.get(CannedResponse, cr_id)
    if not cr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canned response not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(cr, field, value)

    await db.commit()
    await db.refresh(cr)
    return CannedResponseOut.model_validate(cr).model_dump()


@router.delete(
    "/canned-responses/{cr_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a canned response",
)
async def delete_canned_response(
    cr_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    cr = await db.get(CannedResponse, cr_id)
    if not cr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canned response not found")

    await db.delete(cr)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
#  TICKET OPS — MERGE
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/tickets/{ticket_id}/merge", summary="Merge other tickets into this one")
async def merge_tickets(
    ticket_id: uuid.UUID,
    payload: TicketMergePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """
    Merge source tickets into the target ticket.
    - All comments from source tickets are moved to the target.
    - Source tickets are closed with a note referencing the target.
    """
    target = await db.get(Ticket, ticket_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target ticket not found")

    if target.status == "closed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot merge into a closed ticket",
        )

    merged_count = 0
    for source_id in payload.source_ticket_ids:
        if source_id == ticket_id:
            continue  # skip self

        source = await db.get(Ticket, source_id)
        if not source:
            continue

        # Move comments to target
        comments_result = await db.execute(
            select(TicketComment).where(TicketComment.ticket_id == source_id)
        )
        for comment in comments_result.scalars().all():
            comment.ticket_id = ticket_id

        # Add merge note
        merge_note = TicketComment(
            ticket_id=ticket_id,
            author_id=current_user.id,
            content=f"Merged from ticket {source.ticket_number} (ID: {source_id})",
            is_internal=True,
        )
        db.add(merge_note)

        # Close source
        source.status = "closed"
        source.closed_at = datetime.now(timezone.utc)
        merged_count += 1

    await db.commit()

    return {
        "target_ticket_id": str(ticket_id),
        "target_ticket_number": target.ticket_number,
        "merged_count": merged_count,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  CUSTOMER SATISFACTION
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/tickets/{ticket_id}/satisfaction",
    status_code=status.HTTP_201_CREATED,
    summary="Submit CSAT survey for a ticket",
)
async def submit_satisfaction(
    ticket_id: uuid.UUID,
    payload: SatisfactionCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    if ticket.status not in ("resolved", "closed"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Satisfaction survey can only be submitted for resolved or closed tickets",
        )

    # Check if already submitted
    existing = await db.execute(
        select(CustomerSatisfaction).where(CustomerSatisfaction.ticket_id == ticket_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Satisfaction survey already submitted for this ticket",
        )

    csat = CustomerSatisfaction(
        ticket_id=ticket_id,
        rating=payload.rating,
        feedback=payload.feedback,
    )
    db.add(csat)
    await db.commit()
    await db.refresh(csat)
    return SatisfactionOut.model_validate(csat).model_dump()


@router.get("/satisfaction-report", summary="CSAT satisfaction report (aggregate)")
async def satisfaction_report(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Total submissions
    total_result = await db.execute(
        select(func.count()).select_from(CustomerSatisfaction)
    )
    total = total_result.scalar() or 0

    if total == 0:
        return {
            "total_responses": 0,
            "average_rating": None,
            "rating_distribution": {},
            "satisfaction_rate_percent": None,
        }

    # Average
    avg_result = await db.execute(
        select(func.avg(CustomerSatisfaction.rating)).select_from(CustomerSatisfaction)
    )
    avg_rating = round(float(avg_result.scalar() or 0), 2)

    # Distribution
    distribution = {}
    for r in range(1, 6):
        count_result = await db.execute(
            select(func.count()).select_from(CustomerSatisfaction).where(
                CustomerSatisfaction.rating == r
            )
        )
        distribution[str(r)] = count_result.scalar() or 0

    # Satisfaction rate (4 or 5 stars)
    satisfied_result = await db.execute(
        select(func.count()).select_from(CustomerSatisfaction).where(
            CustomerSatisfaction.rating >= 4
        )
    )
    satisfied = satisfied_result.scalar() or 0
    satisfaction_rate = round(satisfied / total * 100, 1)

    return {
        "total_responses": total,
        "average_rating": avg_rating,
        "rating_distribution": distribution,
        "satisfaction_rate_percent": satisfaction_rate,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  REPORTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/reports/response-times", summary="Report: average response times by priority")
async def report_response_times(
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    """Average first-response time grouped by priority."""
    priorities = ["low", "medium", "high", "urgent"]
    report = []

    for p in priorities:
        result = await db.execute(
            select(Ticket.created_at, Ticket.first_response_at).where(
                and_(
                    Ticket.priority == p,
                    Ticket.first_response_at.isnot(None),
                )
            )
        )
        rows = result.all()

        if not rows:
            report.append({
                "priority": p,
                "ticket_count": 0,
                "avg_response_hours": None,
                "min_response_hours": None,
                "max_response_hours": None,
            })
            continue

        diffs = [(r[1] - r[0]).total_seconds() / 3600 for r in rows]
        report.append({
            "priority": p,
            "ticket_count": len(diffs),
            "avg_response_hours": round(sum(diffs) / len(diffs), 1),
            "min_response_hours": round(min(diffs), 1),
            "max_response_hours": round(max(diffs), 1),
        })

    return report


@router.get("/reports/satisfaction", summary="Report: satisfaction trends")
async def report_satisfaction(
    current_user: CurrentUser,
    db: DBSession,
    days: int = Query(30, ge=1, le=365),
) -> dict[str, Any]:
    """CSAT trends over the last N days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(CustomerSatisfaction).where(
            CustomerSatisfaction.submitted_at >= cutoff
        ).order_by(CustomerSatisfaction.submitted_at.asc())
    )
    records = result.scalars().all()

    if not records:
        return {
            "period_days": days,
            "total_responses": 0,
            "average_rating": None,
            "trend": [],
        }

    total = len(records)
    avg = round(sum(r.rating for r in records) / total, 2)

    # Group by date
    daily: dict[str, list[int]] = {}
    for r in records:
        day_str = r.submitted_at.strftime("%Y-%m-%d")
        daily.setdefault(day_str, []).append(r.rating)

    trend = []
    for day_str, ratings in sorted(daily.items()):
        trend.append({
            "date": day_str,
            "count": len(ratings),
            "average_rating": round(sum(ratings) / len(ratings), 2),
        })

    return {
        "period_days": days,
        "total_responses": total,
        "average_rating": avg,
        "trend": trend,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  DASHBOARD KPIs
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/dashboard/kpis", summary="Support dashboard KPIs")
async def dashboard_kpis(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)

    # Open tickets
    open_result = await db.execute(
        select(func.count()).select_from(Ticket).where(
            Ticket.status.in_(["open", "in_progress", "waiting_on_customer", "waiting_on_internal"])
        )
    )
    open_tickets = open_result.scalar() or 0

    # Unassigned tickets
    unassigned_result = await db.execute(
        select(func.count()).select_from(Ticket).where(
            and_(
                Ticket.status.in_(["open", "in_progress"]),
                Ticket.assigned_to.is_(None),
            )
        )
    )
    unassigned_tickets = unassigned_result.scalar() or 0

    # SLA breached (response or resolution)
    breached_result = await db.execute(
        select(func.count()).select_from(Ticket).where(
            or_(
                Ticket.sla_response_breached == True,  # noqa: E712
                Ticket.sla_resolution_breached == True,  # noqa: E712
            )
        )
    )
    sla_breached = breached_result.scalar() or 0

    # At risk (SLA due within 2 hours, not yet breached, still open)
    risk_cutoff = now + timedelta(hours=2)
    at_risk_result = await db.execute(
        select(func.count()).select_from(Ticket).where(
            and_(
                Ticket.status.in_(["open", "in_progress"]),
                or_(
                    and_(
                        Ticket.sla_response_due.isnot(None),
                        Ticket.sla_response_due <= risk_cutoff,
                        Ticket.sla_response_breached == False,  # noqa: E712
                        Ticket.first_response_at.is_(None),
                    ),
                    and_(
                        Ticket.sla_resolution_due.isnot(None),
                        Ticket.sla_resolution_due <= risk_cutoff,
                        Ticket.sla_resolution_breached == False,  # noqa: E712
                        Ticket.resolved_at.is_(None),
                    ),
                ),
            )
        )
    )
    at_risk = at_risk_result.scalar() or 0

    # Avg CSAT (last 30 days)
    thirty_days_ago = now - timedelta(days=30)
    csat_result = await db.execute(
        select(func.avg(CustomerSatisfaction.rating)).select_from(CustomerSatisfaction).where(
            CustomerSatisfaction.submitted_at >= thirty_days_ago
        )
    )
    avg_csat = csat_result.scalar()
    avg_csat = round(float(avg_csat), 2) if avg_csat else None

    # Tickets resolved today
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    resolved_today_result = await db.execute(
        select(func.count()).select_from(Ticket).where(
            and_(
                Ticket.resolved_at.isnot(None),
                Ticket.resolved_at >= today_start,
            )
        )
    )
    resolved_today = resolved_today_result.scalar() or 0

    # Canned responses count
    canned_result = await db.execute(
        select(func.count()).select_from(CannedResponse)
    )
    canned_count = canned_result.scalar() or 0

    return {
        "open_tickets": open_tickets,
        "unassigned_tickets": unassigned_tickets,
        "sla_breached": sla_breached,
        "sla_at_risk": at_risk,
        "avg_csat_30d": avg_csat,
        "resolved_today": resolved_today,
        "canned_responses_count": canned_count,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  TICKET ROUTING RULES
# ══════════════════════════════════════════════════════════════════════════════

class RoutingRuleCreate(BaseModel):
    name: str
    description: str | None = None
    conditions: dict | None = None
    assign_to: uuid.UUID | None = None
    priority_override: str | None = None
    category_override: uuid.UUID | None = None
    is_active: bool = True
    priority_order: int = 0


class RoutingRuleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    conditions: dict | None = None
    assign_to: uuid.UUID | None = None
    priority_override: str | None = None
    category_override: uuid.UUID | None = None
    is_active: bool | None = None
    priority_order: int | None = None


class RoutingRuleOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    conditions: dict | None
    assign_to: uuid.UUID | None
    priority_override: str | None
    category_override: uuid.UUID | None
    is_active: bool
    priority_order: int
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


@router.get("/routing-rules", summary="List ticket routing rules")
async def list_routing_rules(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(TicketRoutingRule)
        .order_by(TicketRoutingRule.priority_order.asc(), TicketRoutingRule.created_at.asc())
    )
    rules = result.scalars().all()
    return {
        "total": len(rules),
        "routing_rules": [RoutingRuleOut.model_validate(r).model_dump() for r in rules],
    }


@router.post(
    "/routing-rules",
    status_code=status.HTTP_201_CREATED,
    summary="Create a ticket routing rule",
)
async def create_routing_rule(
    payload: RoutingRuleCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    rule = TicketRoutingRule(
        name=payload.name,
        description=payload.description,
        conditions=payload.conditions,
        assign_to=payload.assign_to,
        priority_override=payload.priority_override,
        category_override=payload.category_override,
        is_active=payload.is_active,
        priority_order=payload.priority_order,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return RoutingRuleOut.model_validate(rule).model_dump()


@router.get("/routing-rules/{rule_id}", summary="Get a routing rule")
async def get_routing_rule(
    rule_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    rule = await db.get(TicketRoutingRule, rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Routing rule not found")
    return RoutingRuleOut.model_validate(rule).model_dump()


@router.put("/routing-rules/{rule_id}", summary="Update a ticket routing rule")
async def update_routing_rule(
    rule_id: uuid.UUID,
    payload: RoutingRuleUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    rule = await db.get(TicketRoutingRule, rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Routing rule not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(rule, field, value)

    await db.commit()
    await db.refresh(rule)
    return RoutingRuleOut.model_validate(rule).model_dump()


@router.delete(
    "/routing-rules/{rule_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a ticket routing rule",
)
async def delete_routing_rule(
    rule_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    rule = await db.get(TicketRoutingRule, rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Routing rule not found")

    await db.delete(rule)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)
