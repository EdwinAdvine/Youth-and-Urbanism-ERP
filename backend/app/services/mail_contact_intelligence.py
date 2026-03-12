"""Contact Intelligence service for Era Mail.

Provides contact profile syncing, enrichment, relationship graph
computation, and duplicate detection across Mail and CRM modules.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher

from sqlalchemy import select, func, text, and_, or_, extract, case
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 1. sync_contact_profiles
# ---------------------------------------------------------------------------
async def sync_contact_profiles(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> dict:
    """Sync / update MailContactProfile records from email history.

    For each unique sender in the user's mailbox:
    - Compute email_count, first_email_at, last_email_at
    - Calculate avg_response_time from reply patterns
    - Upsert into MailContactProfile
    - Cross-reference with CRM Contact

    Returns ``{synced: int, created: int, updated: int}``.
    """
    from app.models.mail_advanced import MailContactProfile
    from app.models.mail_storage import MailboxMessage

    created = 0
    updated = 0

    # ── Gather per-sender stats from mailbox ──────────────────────────────
    sender_stats_q = (
        select(
            MailboxMessage.from_addr,
            func.max(MailboxMessage.from_name).label("from_name"),
            func.count(MailboxMessage.id).label("email_count"),
            func.min(MailboxMessage.received_at).label("first_email_at"),
            func.max(MailboxMessage.received_at).label("last_email_at"),
        )
        .where(
            MailboxMessage.user_id == user_id,
            MailboxMessage.from_addr != "",
            MailboxMessage.is_deleted == False,  # noqa: E712
        )
        .group_by(MailboxMessage.from_addr)
    )
    result = await db.execute(sender_stats_q)
    sender_rows = result.all()

    # ── Pre-compute average response times ────────────────────────────────
    # A "response" is a sent message whose in_reply_to matches an incoming
    # message's message_id_header from the same sender.
    avg_response_map: dict[str, float] = {}
    try:
        incoming = MailboxMessage.__table__.alias("incoming")
        reply = MailboxMessage.__table__.alias("reply")

        resp_q = (
            select(
                incoming.c.from_addr,
                func.avg(
                    extract("epoch", reply.c.sent_at)
                    - extract("epoch", incoming.c.received_at)
                ).label("avg_seconds"),
            )
            .select_from(
                incoming.join(
                    reply,
                    and_(
                        reply.c.in_reply_to == incoming.c.message_id_header,
                        reply.c.user_id == user_id,
                        reply.c.folder == "Sent",
                        incoming.c.message_id_header != "",
                    ),
                )
            )
            .where(
                incoming.c.user_id == user_id,
                incoming.c.from_addr != "",
                incoming.c.is_deleted == False,  # noqa: E712
            )
            .group_by(incoming.c.from_addr)
        )
        resp_result = await db.execute(resp_q)
        for row in resp_result.all():
            if row.avg_seconds is not None and row.avg_seconds > 0:
                avg_response_map[row.from_addr] = row.avg_seconds / 3600.0
    except Exception:
        logger.warning("Failed to compute response times — skipping", exc_info=True)

    # ── Load CRM contacts for cross-reference ─────────────────────────────
    crm_map: dict[str, dict] = {}
    try:
        from app.models.crm import Contact

        crm_q = select(
            Contact.id,
            Contact.email,
            Contact.first_name,
            Contact.last_name,
            Contact.company_name,
            func.coalesce(
                Contact.metadata_json.op("->>")("title"),
                text("NULL"),
            ).label("title"),
        ).where(Contact.email.isnot(None), Contact.is_active == True)  # noqa: E712
        crm_result = await db.execute(crm_q)
        for row in crm_result.all():
            if row.email:
                crm_map[row.email.lower()] = {
                    "crm_contact_id": row.id,
                    "display_name": " ".join(
                        filter(None, [row.first_name, row.last_name])
                    ),
                    "company": row.company_name,
                    "title": row.title if row.title != "NULL" else None,
                }
    except Exception:
        logger.warning("CRM cross-reference unavailable — skipping", exc_info=True)

    # ── Upsert loop ───────────────────────────────────────────────────────
    for row in sender_rows:
        email_lower = row.from_addr.lower().strip()
        if not email_lower:
            continue

        existing_q = select(MailContactProfile).where(
            MailContactProfile.user_id == user_id,
            func.lower(MailContactProfile.email) == email_lower,
        )
        existing_result = await db.execute(existing_q)
        profile = existing_result.scalar_one_or_none()

        crm_info = crm_map.get(email_lower, {})
        avg_resp_hours = avg_response_map.get(row.from_addr)
        avg_resp_minutes = avg_resp_hours * 60.0 if avg_resp_hours is not None else None

        if profile is None:
            profile = MailContactProfile(
                user_id=user_id,
                email=row.from_addr,
                display_name=crm_info.get("display_name") or row.from_name or None,
                title=crm_info.get("title"),
                company=crm_info.get("company"),
                crm_contact_id=crm_info.get("crm_contact_id"),
                email_count=row.email_count,
                last_email_at=row.last_email_at,
                avg_response_time_minutes=avg_resp_minutes,
            )
            db.add(profile)
            created += 1
        else:
            profile.email_count = row.email_count
            profile.last_email_at = row.last_email_at
            if avg_resp_minutes is not None:
                profile.avg_response_time_minutes = avg_resp_minutes
            if crm_info:
                profile.crm_contact_id = crm_info.get("crm_contact_id")
                profile.company = crm_info.get("company") or profile.company
                profile.title = crm_info.get("title") or profile.title
                if not profile.display_name:
                    profile.display_name = crm_info.get("display_name")
            updated += 1

    await db.flush()

    return {"synced": created + updated, "created": created, "updated": updated}


# ---------------------------------------------------------------------------
# 2. enrich_contact
# ---------------------------------------------------------------------------
async def enrich_contact(
    db: AsyncSession,
    user_id: uuid.UUID,
    email: str,
) -> dict:
    """Enrich a single contact profile by email address.

    Looks up or creates a MailContactProfile, merges CRM data, and
    computes email statistics.  Returns the enriched profile as a dict.
    """
    from app.models.mail_advanced import MailContactProfile
    from app.models.mail_storage import MailboxMessage

    email_lower = email.lower().strip()

    # ── Look up existing profile ──────────────────────────────────────────
    profile_q = select(MailContactProfile).where(
        MailContactProfile.user_id == user_id,
        func.lower(MailContactProfile.email) == email_lower,
    )
    profile_result = await db.execute(profile_q)
    profile = profile_result.scalar_one_or_none()

    # ── Email stats ───────────────────────────────────────────────────────
    stats_q = (
        select(
            func.count(MailboxMessage.id).label("email_count"),
            func.min(MailboxMessage.received_at).label("first_email_at"),
            func.max(MailboxMessage.received_at).label("last_email_at"),
        )
        .where(
            MailboxMessage.user_id == user_id,
            func.lower(MailboxMessage.from_addr) == email_lower,
            MailboxMessage.is_deleted == False,  # noqa: E712
        )
    )
    stats_result = await db.execute(stats_q)
    stats = stats_result.one()

    # ── Avg response time ─────────────────────────────────────────────────
    avg_resp_minutes: float | None = None
    try:
        incoming = MailboxMessage.__table__.alias("incoming")
        reply = MailboxMessage.__table__.alias("reply")
        resp_q = (
            select(
                func.avg(
                    extract("epoch", reply.c.sent_at)
                    - extract("epoch", incoming.c.received_at)
                ).label("avg_seconds"),
            )
            .select_from(
                incoming.join(
                    reply,
                    and_(
                        reply.c.in_reply_to == incoming.c.message_id_header,
                        reply.c.user_id == user_id,
                        reply.c.folder == "Sent",
                        incoming.c.message_id_header != "",
                    ),
                )
            )
            .where(
                incoming.c.user_id == user_id,
                func.lower(incoming.c.from_addr) == email_lower,
                incoming.c.is_deleted == False,  # noqa: E712
            )
        )
        resp_result = await db.execute(resp_q)
        avg_seconds = resp_result.scalar()
        if avg_seconds is not None and avg_seconds > 0:
            avg_resp_minutes = avg_seconds / 60.0
    except Exception:
        logger.warning("Failed to compute response time for %s", email, exc_info=True)

    # ── CRM enrichment ────────────────────────────────────────────────────
    crm_data: dict = {}
    try:
        from app.models.crm import Contact

        crm_q = select(Contact).where(
            func.lower(Contact.email) == email_lower,
            Contact.is_active == True,  # noqa: E712
        )
        crm_result = await db.execute(crm_q)
        crm_contact = crm_result.scalar_one_or_none()
        if crm_contact:
            crm_data = {
                "crm_contact_id": crm_contact.id,
                "display_name": " ".join(
                    filter(None, [crm_contact.first_name, crm_contact.last_name])
                ),
                "company": crm_contact.company_name,
                "title": (crm_contact.custom_fields or {}).get("title")
                if crm_contact.custom_fields
                else None,
            }
    except Exception:
        logger.warning("CRM lookup failed for %s", email, exc_info=True)

    # ── Upsert profile ────────────────────────────────────────────────────
    if profile is None:
        profile = MailContactProfile(
            user_id=user_id,
            email=email,
            display_name=crm_data.get("display_name"),
            title=crm_data.get("title"),
            company=crm_data.get("company"),
            crm_contact_id=crm_data.get("crm_contact_id"),
            email_count=stats.email_count or 0,
            last_email_at=stats.last_email_at,
            avg_response_time_minutes=avg_resp_minutes,
        )
        db.add(profile)
    else:
        profile.email_count = stats.email_count or 0
        profile.last_email_at = stats.last_email_at
        if avg_resp_minutes is not None:
            profile.avg_response_time_minutes = avg_resp_minutes
        if crm_data:
            profile.crm_contact_id = crm_data.get("crm_contact_id") or profile.crm_contact_id
            profile.company = crm_data.get("company") or profile.company
            profile.title = crm_data.get("title") or profile.title
            if not profile.display_name:
                profile.display_name = crm_data.get("display_name")

    await db.flush()

    return {
        "id": str(profile.id),
        "email": profile.email,
        "display_name": profile.display_name,
        "title": profile.title,
        "company": profile.company,
        "crm_contact_id": str(profile.crm_contact_id) if profile.crm_contact_id else None,
        "email_count": profile.email_count,
        "first_email_at": stats.first_email_at.isoformat() if stats.first_email_at else None,
        "last_email_at": profile.last_email_at.isoformat() if profile.last_email_at else None,
        "avg_response_time_minutes": profile.avg_response_time_minutes,
        "sentiment_trend": profile.sentiment_trend,
    }


# ---------------------------------------------------------------------------
# 3. compute_relationship_graph
# ---------------------------------------------------------------------------
async def compute_relationship_graph(
    db: AsyncSession,
    user_id: uuid.UUID,
    email: str,
) -> dict:
    """Compute relationship data for a contact.

    Returns:
        {
            frequency_trend: [{month: "2025-10", count: 12}, ...],  # last 6 months
            sentiment_trend: [{month: "2025-10", avg_sentiment: 0.65}, ...],
            thread_count: int,
        }
    """
    from app.models.mail_storage import MailboxMessage

    email_lower = email.lower().strip()
    now = datetime.now(timezone.utc)
    six_months_ago = now - timedelta(days=180)

    # ── Monthly email frequency (last 6 months) ──────────────────────────
    frequency_trend: list[dict] = []
    try:
        freq_q = (
            select(
                func.to_char(MailboxMessage.received_at, text("'YYYY-MM'")).label("month"),
                func.count(MailboxMessage.id).label("count"),
            )
            .where(
                MailboxMessage.user_id == user_id,
                func.lower(MailboxMessage.from_addr) == email_lower,
                MailboxMessage.received_at >= six_months_ago,
                MailboxMessage.is_deleted == False,  # noqa: E712
            )
            .group_by(text("1"))
            .order_by(text("1"))
        )
        freq_result = await db.execute(freq_q)
        for row in freq_result.all():
            frequency_trend.append({"month": row.month, "count": row.count})
    except Exception:
        logger.warning("Failed to compute frequency trend for %s", email, exc_info=True)

    # ── Sentiment trend (from ai_triage JSON on recent messages) ──────────
    sentiment_trend: list[dict] = []
    try:
        # ai_triage is a JSONB column; sentiment lives at ai_triage->>'sentiment'
        sentiment_expr = MailboxMessage.ai_triage.op("->>")("sentiment")
        sent_q = (
            select(
                func.to_char(MailboxMessage.received_at, text("'YYYY-MM'")).label("month"),
                func.avg(
                    case(
                        (sentiment_expr == "positive", 1.0),
                        (sentiment_expr == "neutral", 0.0),
                        (sentiment_expr == "negative", -1.0),
                        else_=None,
                    )
                ).label("avg_sentiment"),
            )
            .where(
                MailboxMessage.user_id == user_id,
                func.lower(MailboxMessage.from_addr) == email_lower,
                MailboxMessage.received_at >= six_months_ago,
                MailboxMessage.ai_triage.isnot(None),
                MailboxMessage.is_deleted == False,  # noqa: E712
            )
            .group_by(text("1"))
            .order_by(text("1"))
        )
        sent_result = await db.execute(sent_q)
        for row in sent_result.all():
            sentiment_trend.append({
                "month": row.month,
                "avg_sentiment": round(float(row.avg_sentiment), 2) if row.avg_sentiment is not None else None,
            })
    except Exception:
        logger.warning("Failed to compute sentiment trend for %s", email, exc_info=True)

    # ── Thread count (unique threads with this sender) ────────────────────
    thread_count = 0
    try:
        # Count distinct non-empty message_id_header values that appear as
        # in_reply_to on at least one other message, plus messages with no
        # in_reply_to (thread starters).  Simplified: count distinct
        # conversation roots by grouping on the first reference or
        # message_id_header.
        thread_q = (
            select(func.count(func.distinct(
                case(
                    (MailboxMessage.in_reply_to != "", MailboxMessage.in_reply_to),
                    else_=MailboxMessage.message_id_header,
                )
            )))
            .where(
                MailboxMessage.user_id == user_id,
                or_(
                    func.lower(MailboxMessage.from_addr) == email_lower,
                    # Also count threads where user replied to this sender
                    and_(
                        MailboxMessage.folder == "Sent",
                        MailboxMessage.to_addrs.op("@>")(func.cast(f'["{email}"]', type_=text("jsonb"))),
                    ),
                ),
                MailboxMessage.is_deleted == False,  # noqa: E712
            )
        )
        thread_result = await db.execute(thread_q)
        thread_count = thread_result.scalar() or 0
    except Exception:
        logger.warning("Failed to compute thread count for %s", email, exc_info=True)

    return {
        "frequency_trend": frequency_trend,
        "sentiment_trend": sentiment_trend,
        "thread_count": thread_count,
    }


# ---------------------------------------------------------------------------
# 4. detect_duplicates
# ---------------------------------------------------------------------------
async def detect_duplicates(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> list[dict]:
    """Find potential duplicate contacts between MailContactProfile and CRM.

    Compares display names using fuzzy matching and checks for CRM contacts
    that share email addresses.

    Returns a list of::

        {
            profile_email: str,
            crm_email: str | None,
            confidence: float,      # 0.0 – 1.0
            suggested_action: str,   # "merge", "review", "link"
        }
    """
    from app.models.mail_advanced import MailContactProfile

    duplicates: list[dict] = []

    # ── Load mail contact profiles for this user ──────────────────────────
    profiles_q = select(MailContactProfile).where(
        MailContactProfile.user_id == user_id,
    )
    profiles_result = await db.execute(profiles_q)
    profiles = list(profiles_result.scalars().all())

    if not profiles:
        return duplicates

    # ── Cross-check with CRM contacts ─────────────────────────────────────
    crm_contacts_map: dict[str, dict] = {}
    try:
        from app.models.crm import Contact

        crm_q = select(
            Contact.id,
            Contact.email,
            Contact.first_name,
            Contact.last_name,
            Contact.company_name,
        ).where(Contact.email.isnot(None), Contact.is_active == True)  # noqa: E712
        crm_result = await db.execute(crm_q)
        for row in crm_result.all():
            if row.email:
                crm_contacts_map[row.email.lower().strip()] = {
                    "id": row.id,
                    "email": row.email,
                    "name": " ".join(filter(None, [row.first_name, row.last_name])),
                    "company": row.company_name,
                }
    except Exception:
        logger.warning("CRM contact lookup failed during duplicate detection", exc_info=True)

    # ── Name-similarity between mail profiles (internal duplicates) ───────
    for i, p1 in enumerate(profiles):
        for p2 in profiles[i + 1 :]:
            if not p1.display_name or not p2.display_name:
                continue
            # Skip if emails are identical (already the same profile)
            if p1.email.lower() == p2.email.lower():
                continue
            ratio = SequenceMatcher(
                None,
                p1.display_name.lower(),
                p2.display_name.lower(),
            ).ratio()
            if ratio >= 0.80:
                confidence = round(ratio, 2)
                suggested = "merge" if confidence >= 0.95 else "review"
                duplicates.append({
                    "profile_email": p1.email,
                    "crm_email": p2.email,
                    "confidence": confidence,
                    "suggested_action": suggested,
                })

    # ── Mail profiles vs CRM contacts (cross-module duplicates) ───────────
    for profile in profiles:
        prof_email = profile.email.lower().strip()

        # Direct email match — already linked
        if prof_email in crm_contacts_map and not profile.crm_contact_id:
            duplicates.append({
                "profile_email": profile.email,
                "crm_email": crm_contacts_map[prof_email]["email"],
                "confidence": 1.0,
                "suggested_action": "link",
            })
            continue

        # Name-based fuzzy match against CRM contacts
        if not profile.display_name:
            continue
        for crm_email, crm_info in crm_contacts_map.items():
            if crm_email == prof_email:
                continue
            if not crm_info["name"]:
                continue
            ratio = SequenceMatcher(
                None,
                profile.display_name.lower(),
                crm_info["name"].lower(),
            ).ratio()
            if ratio >= 0.85:
                confidence = round(ratio, 2)
                suggested = "merge" if confidence >= 0.95 else "review"
                duplicates.append({
                    "profile_email": profile.email,
                    "crm_email": crm_info["email"],
                    "confidence": confidence,
                    "suggested_action": suggested,
                })

    return duplicates
