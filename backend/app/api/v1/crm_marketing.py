"""CRM Marketing — A/B tests, segments, content calendar, unsubscribes."""

import uuid
from datetime import date, datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import delete, func, select

from app.core.deps import CurrentUser, DBSession
from app.models.crm import Contact
from app.models.crm_marketing import (
    ContentCalendarItem,
    EmailCampaignConfig,
    Segment,
    SegmentContact,
    Unsubscribe,
)

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────


# -- A/B Test --


class ABTestCreate(BaseModel):
    template_id: uuid.UUID | None = None
    subject_line_a: str
    subject_line_b: str | None = None
    ab_test_ratio: int = 50
    ab_winner_metric: str = "open_rate"
    ab_winner_auto_send: bool = False
    send_at: datetime | None = None


class ABTestOut(BaseModel):
    id: uuid.UUID
    campaign_id: uuid.UUID
    template_id: uuid.UUID | None
    subject_line_a: str
    subject_line_b: str | None
    ab_test_ratio: int
    ab_winner_metric: str
    ab_winner_auto_send: bool
    winner_determined_at: datetime | None
    send_at: datetime | None
    sent_count: int
    open_count: int
    click_count: int
    unsubscribe_count: int
    bounce_count: int
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


# -- Segment --


class SegmentCreate(BaseModel):
    name: str
    description: str | None = None
    segment_type: str = "static"
    rules: dict | None = None
    ai_suggested: bool = False


class SegmentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    segment_type: str | None = None
    rules: dict | None = None
    ai_suggested: bool | None = None


class SegmentOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    segment_type: str
    rules: dict | None
    contact_count: int
    ai_suggested: bool
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


# -- Segment contacts --


class SegmentContactsAdd(BaseModel):
    contact_ids: list[uuid.UUID]


# -- Content calendar --


class ContentCalendarCreate(BaseModel):
    title: str
    content_type: str
    scheduled_date: date
    status: str = "idea"
    campaign_id: uuid.UUID | None = None
    assigned_to: uuid.UUID | None = None
    description: str | None = None


class ContentCalendarUpdate(BaseModel):
    title: str | None = None
    content_type: str | None = None
    scheduled_date: date | None = None
    status: str | None = None
    campaign_id: uuid.UUID | None = None
    assigned_to: uuid.UUID | None = None
    description: str | None = None


class ContentCalendarOut(BaseModel):
    id: uuid.UUID
    title: str
    content_type: str
    scheduled_date: date
    status: str
    campaign_id: uuid.UUID | None
    assigned_to: uuid.UUID | None
    description: str | None
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


# -- Unsubscribe --


class UnsubscribeCreate(BaseModel):
    contact_id: uuid.UUID
    campaign_id: uuid.UUID | None = None
    reason: str | None = None


class UnsubscribeOut(BaseModel):
    id: uuid.UUID
    contact_id: uuid.UUID
    campaign_id: uuid.UUID | None
    reason: str | None
    unsubscribed_at: datetime
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


# ── A/B Test Endpoints ───────────────────────────────────────────────────────


@router.post(
    "/campaigns/{campaign_id}/ab-test",
    status_code=201,
    summary="Create A/B test config for a campaign",
)
async def create_ab_test(
    campaign_id: uuid.UUID,
    payload: ABTestCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Check if config already exists for this campaign
    existing = await db.execute(
        select(EmailCampaignConfig).where(
            EmailCampaignConfig.campaign_id == campaign_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="A/B test config already exists for this campaign",
        )
    config = EmailCampaignConfig(
        campaign_id=campaign_id,
        template_id=payload.template_id,
        subject_line_a=payload.subject_line_a,
        subject_line_b=payload.subject_line_b,
        ab_test_ratio=payload.ab_test_ratio,
        ab_winner_metric=payload.ab_winner_metric,
        ab_winner_auto_send=payload.ab_winner_auto_send,
        send_at=payload.send_at,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return ABTestOut.model_validate(config).model_dump()


@router.get(
    "/campaigns/{campaign_id}/ab-test",
    summary="Get A/B test config + results",
)
async def get_ab_test(
    campaign_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(EmailCampaignConfig).where(
            EmailCampaignConfig.campaign_id == campaign_id
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="A/B test config not found")

    data = ABTestOut.model_validate(config).model_dump()

    # Compute derived metrics
    sent = config.sent_count or 0
    ratio = config.ab_test_ratio
    sent_a = int(sent * ratio / 100) if sent else 0
    sent_b = sent - sent_a if sent else 0
    open_rate_a = (config.open_count / sent_a * 100) if sent_a else 0.0
    open_rate_b = (config.open_count / sent_b * 100) if sent_b else 0.0

    winner = None
    if config.winner_determined_at:
        winner = "a" if open_rate_a >= open_rate_b else "b"

    data["open_rate_a"] = round(open_rate_a, 2)
    data["open_rate_b"] = round(open_rate_b, 2)
    data["winner"] = winner
    return data


# ── Segment Endpoints ────────────────────────────────────────────────────────


@router.get("/segments", summary="List segments")
async def list_segments(
    current_user: CurrentUser,
    db: DBSession,
    segment_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Segment)
    if segment_type:
        query = query.where(Segment.segment_type == segment_type)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    query = (
        query.order_by(Segment.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(query)
    segments = result.scalars().all()
    return {
        "total": total,
        "items": [SegmentOut.model_validate(s).model_dump() for s in segments],
    }


@router.post("/segments", status_code=201, summary="Create segment")
async def create_segment(
    payload: SegmentCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    segment = Segment(
        name=payload.name,
        description=payload.description,
        segment_type=payload.segment_type,
        rules=payload.rules,
        ai_suggested=payload.ai_suggested,
        owner_id=current_user.id,
    )
    db.add(segment)
    await db.commit()
    await db.refresh(segment)
    return SegmentOut.model_validate(segment).model_dump()


@router.put("/segments/{segment_id}", summary="Update segment")
async def update_segment(
    segment_id: uuid.UUID,
    payload: SegmentUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    segment = await db.get(Segment, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(segment, k, v)
    await db.commit()
    await db.refresh(segment)
    return SegmentOut.model_validate(segment).model_dump()


@router.delete("/segments/{segment_id}", status_code=204, summary="Delete segment")
async def delete_segment(
    segment_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    segment = await db.get(Segment, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    # Cascade via relationship: deletes SegmentContact entries
    await db.delete(segment)
    await db.commit()
    return Response(status_code=204)


@router.post(
    "/segments/{segment_id}/compute",
    summary="Compute dynamic segment membership",
)
async def compute_segment(
    segment_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    segment = await db.get(Segment, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    if segment.segment_type != "dynamic":
        raise HTTPException(
            status_code=400, detail="Only dynamic segments can be computed"
        )
    if not segment.rules:
        raise HTTPException(
            status_code=400, detail="Segment has no rules defined"
        )

    # Build query from rules
    rules = segment.rules
    conditions = rules.get("conditions", [rules]) if isinstance(rules, dict) else rules
    query = select(Contact)

    for cond in conditions:
        field = cond.get("field")
        operator = cond.get("operator")
        value = cond.get("value")
        if not field or not operator:
            continue
        col = getattr(Contact, field, None)
        if col is None:
            continue
        if operator == "equals":
            query = query.where(col == value)
        elif operator == "not_equals":
            query = query.where(col != value)
        elif operator == "contains":
            query = query.where(col.ilike(f"%{value}%"))
        elif operator == "greater_than":
            query = query.where(col > value)
        elif operator == "less_than":
            query = query.where(col < value)
        elif operator == "in":
            if isinstance(value, list):
                query = query.where(col.in_(value))
        elif operator == "is_null":
            query = query.where(col.is_(None))
        elif operator == "is_not_null":
            query = query.where(col.isnot(None))

    result = await db.execute(query)
    contacts = result.scalars().all()

    # Clear existing segment contacts
    await db.execute(
        delete(SegmentContact).where(SegmentContact.segment_id == segment_id)
    )

    # Insert new segment contacts
    now = datetime.now(timezone.utc)
    for contact in contacts:
        db.add(
            SegmentContact(
                segment_id=segment_id,
                contact_id=contact.id,
                added_at=now,
            )
        )

    segment.contact_count = len(contacts)
    await db.commit()
    await db.refresh(segment)

    return {
        "segment_id": str(segment_id),
        "contact_count": segment.contact_count,
        "computed_at": now.isoformat(),
    }


@router.post(
    "/segments/{segment_id}/contacts",
    status_code=201,
    summary="Add contacts to static segment",
)
async def add_segment_contacts(
    segment_id: uuid.UUID,
    payload: SegmentContactsAdd,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    segment = await db.get(Segment, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    if segment.segment_type != "static":
        raise HTTPException(
            status_code=400,
            detail="Cannot manually add contacts to a dynamic segment",
        )

    # Find already-linked contact ids to avoid duplicates
    existing_q = select(SegmentContact.contact_id).where(
        SegmentContact.segment_id == segment_id,
        SegmentContact.contact_id.in_(payload.contact_ids),
    )
    existing_result = await db.execute(existing_q)
    existing_ids = {row[0] for row in existing_result.all()}

    now = datetime.now(timezone.utc)
    added = 0
    for cid in payload.contact_ids:
        if cid in existing_ids:
            continue
        db.add(
            SegmentContact(
                segment_id=segment_id,
                contact_id=cid,
                added_at=now,
            )
        )
        added += 1

    segment.contact_count = segment.contact_count + added
    await db.commit()
    await db.refresh(segment)

    return {
        "added": added,
        "skipped_duplicates": len(payload.contact_ids) - added,
        "contact_count": segment.contact_count,
    }


# ── Content Calendar Endpoints ───────────────────────────────────────────────


@router.get("/content-calendar", summary="List content calendar items")
async def list_content_calendar(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status"),
    content_type: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(ContentCalendarItem)
    if status_filter:
        query = query.where(ContentCalendarItem.status == status_filter)
    if content_type:
        query = query.where(ContentCalendarItem.content_type == content_type)
    if date_from:
        query = query.where(ContentCalendarItem.scheduled_date >= date_from)
    if date_to:
        query = query.where(ContentCalendarItem.scheduled_date <= date_to)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    query = (
        query.order_by(ContentCalendarItem.scheduled_date.asc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(query)
    items = result.scalars().all()
    return {
        "total": total,
        "items": [ContentCalendarOut.model_validate(i).model_dump() for i in items],
    }


@router.post(
    "/content-calendar",
    status_code=201,
    summary="Create content calendar item",
)
async def create_content_calendar_item(
    payload: ContentCalendarCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    item = ContentCalendarItem(
        title=payload.title,
        content_type=payload.content_type,
        scheduled_date=payload.scheduled_date,
        status=payload.status,
        campaign_id=payload.campaign_id,
        assigned_to=payload.assigned_to,
        description=payload.description,
        owner_id=current_user.id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return ContentCalendarOut.model_validate(item).model_dump()


@router.put(
    "/content-calendar/{item_id}",
    summary="Update content calendar item",
)
async def update_content_calendar_item(
    item_id: uuid.UUID,
    payload: ContentCalendarUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    item = await db.get(ContentCalendarItem, item_id)
    if not item:
        raise HTTPException(
            status_code=404, detail="Content calendar item not found"
        )
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    await db.commit()
    await db.refresh(item)
    return ContentCalendarOut.model_validate(item).model_dump()


@router.delete(
    "/content-calendar/{item_id}",
    status_code=204,
    summary="Delete content calendar item",
)
async def delete_content_calendar_item(
    item_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    item = await db.get(ContentCalendarItem, item_id)
    if not item:
        raise HTTPException(
            status_code=404, detail="Content calendar item not found"
        )
    await db.delete(item)
    await db.commit()
    return Response(status_code=204)


# ── Unsubscribe Endpoints ────────────────────────────────────────────────────


@router.get("/unsubscribes", summary="List unsubscribes")
async def list_unsubscribes(
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Unsubscribe)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    query = (
        query.order_by(Unsubscribe.unsubscribed_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(query)
    unsubs = result.scalars().all()
    return {
        "total": total,
        "items": [UnsubscribeOut.model_validate(u).model_dump() for u in unsubs],
    }


@router.post(
    "/unsubscribes",
    status_code=201,
    summary="Record an unsubscribe",
)
async def create_unsubscribe(
    payload: UnsubscribeCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    unsub = Unsubscribe(
        contact_id=payload.contact_id,
        campaign_id=payload.campaign_id,
        reason=payload.reason,
        unsubscribed_at=datetime.now(timezone.utc),
    )
    db.add(unsub)
    await db.commit()
    await db.refresh(unsub)
    return UnsubscribeOut.model_validate(unsub).model_dump()
