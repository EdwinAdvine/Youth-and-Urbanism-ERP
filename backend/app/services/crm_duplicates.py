"""Duplicate contact detection and merging service."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.crm import (
    CampaignContact,
    Contact,
    ContactNote,
    DuplicateCandidate,
    Lead,
    Quote,
    SalesActivity,
    SequenceEnrollment,
)

logger = logging.getLogger(__name__)


def _normalize_phone(phone: str | None) -> str | None:
    """Strip non-digit characters for phone comparison."""
    if not phone:
        return None
    return "".join(c for c in phone if c.isdigit())


async def detect_duplicates(db: AsyncSession) -> list[dict]:
    """Scan all active contacts for duplicates. Returns newly created candidates."""
    stmt = select(Contact).where(Contact.is_active.is_(True))
    result = await db.execute(stmt)
    contacts = list(result.scalars().all())

    # Build lookup indexes
    email_map: dict[str, list[Contact]] = {}
    phone_map: dict[str, list[Contact]] = {}
    name_company_map: dict[str, list[Contact]] = {}

    for c in contacts:
        if c.email:
            key = c.email.strip().lower()
            email_map.setdefault(key, []).append(c)
        norm_phone = _normalize_phone(c.phone)
        if norm_phone and len(norm_phone) >= 7:
            phone_map.setdefault(norm_phone, []).append(c)
        if c.first_name and c.last_name:
            key = f"{c.first_name.strip().lower()}|{c.last_name.strip().lower()}|{(c.company_name or '').strip().lower()}"
            name_company_map.setdefault(key, []).append(c)

    # Collect candidate pairs (deduplicated by sorted id pair)
    seen_pairs: set[tuple] = set()
    candidates: list[dict] = []

    def _add_pair(a: Contact, b: Contact, confidence: int, match_fields: list[str]):
        pair_key = tuple(sorted([str(a.id), str(b.id)]))
        if pair_key in seen_pairs:
            return
        seen_pairs.add(pair_key)
        candidates.append({
            "contact_a_id": a.id,
            "contact_b_id": b.id,
            "confidence_score": confidence,
            "match_fields": match_fields,
        })

    # Email exact match = 90
    for group in email_map.values():
        if len(group) > 1:
            for i, a in enumerate(group):
                for b in group[i + 1:]:
                    _add_pair(a, b, 90, ["email"])

    # Phone match = 80
    for group in phone_map.values():
        if len(group) > 1:
            for i, a in enumerate(group):
                for b in group[i + 1:]:
                    _add_pair(a, b, 80, ["phone"])

    # Name + company match = 70
    for group in name_company_map.values():
        if len(group) > 1:
            for i, a in enumerate(group):
                for b in group[i + 1:]:
                    _add_pair(a, b, 70, ["first_name", "last_name", "company_name"])

    # Check existing candidates to avoid re-creating
    existing_stmt = select(DuplicateCandidate).where(DuplicateCandidate.status == "pending")
    existing_result = await db.execute(existing_stmt)
    existing_pairs = {
        tuple(sorted([str(c.contact_a_id), str(c.contact_b_id)]))
        for c in existing_result.scalars().all()
    }

    new_candidates = []
    for cand in candidates:
        pair_key = tuple(sorted([str(cand["contact_a_id"]), str(cand["contact_b_id"])]))
        if pair_key not in existing_pairs:
            dc = DuplicateCandidate(**cand)
            db.add(dc)
            new_candidates.append(cand)

    await db.flush()
    return new_candidates


async def merge_contacts(
    db: AsyncSession,
    candidate_id,
    keep_contact_id,
    reviewer_id,
) -> dict:
    """Merge two contacts — keep one, reassign all related records from the other, soft-delete the other."""
    stmt = select(DuplicateCandidate).where(DuplicateCandidate.id == candidate_id)
    result = await db.execute(stmt)
    candidate = result.scalar_one_or_none()
    if not candidate:
        return {"error": "Candidate not found"}

    merge_id = candidate.contact_a_id if str(candidate.contact_a_id) != str(keep_contact_id) else candidate.contact_b_id

    # Reassign leads
    await db.execute(
        update(Lead).where(Lead.contact_id == merge_id).values(contact_id=keep_contact_id)
    )
    # Reassign notes
    await db.execute(
        update(ContactNote).where(ContactNote.contact_id == merge_id).values(contact_id=keep_contact_id)
    )
    # Reassign quotes
    await db.execute(
        update(Quote).where(Quote.contact_id == merge_id).values(contact_id=keep_contact_id)
    )
    # Reassign activities
    await db.execute(
        update(SalesActivity).where(SalesActivity.contact_id == merge_id).values(contact_id=keep_contact_id)
    )
    # Reassign campaign contacts
    await db.execute(
        update(CampaignContact).where(CampaignContact.contact_id == merge_id).values(contact_id=keep_contact_id)
    )
    # Reassign sequence enrollments
    await db.execute(
        update(SequenceEnrollment).where(SequenceEnrollment.contact_id == merge_id).values(contact_id=keep_contact_id)
    )

    # Soft-delete the merged contact
    await db.execute(
        update(Contact).where(Contact.id == merge_id).values(is_active=False)
    )

    # Mark candidate as merged
    candidate.status = "merged"
    candidate.reviewed_by = reviewer_id
    candidate.reviewed_at = datetime.now(timezone.utc)
    await db.flush()

    return {
        "kept": str(keep_contact_id),
        "merged": str(merge_id),
        "status": "merged",
    }


async def dismiss_candidate(db: AsyncSession, candidate_id, reviewer_id) -> dict:
    """Dismiss a duplicate candidate."""
    stmt = select(DuplicateCandidate).where(DuplicateCandidate.id == candidate_id)
    result = await db.execute(stmt)
    candidate = result.scalar_one_or_none()
    if not candidate:
        return {"error": "Candidate not found"}

    candidate.status = "dismissed"
    candidate.reviewed_by = reviewer_id
    candidate.reviewed_at = datetime.now(timezone.utc)
    await db.flush()
    return {"status": "dismissed"}
