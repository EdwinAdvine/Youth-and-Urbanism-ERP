"""Lead scoring engine — evaluates leads against configurable LeadScoringRule entries."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.crm import Lead, LeadScoringRule

logger = logging.getLogger(__name__)


def _evaluate_rule(rule: LeadScoringRule, field_value: str | None) -> bool:
    """Check if a single rule matches against the given field value."""
    if field_value is None:
        return False
    target = rule.value
    op = rule.operator
    fv = str(field_value)
    if op == "equals":
        return fv.lower() == target.lower()
    if op == "contains":
        return target.lower() in fv.lower()
    if op == "greater_than":
        try:
            return float(fv) > float(target)
        except (ValueError, TypeError):
            return False
    if op == "less_than":
        try:
            return float(fv) < float(target)
        except (ValueError, TypeError):
            return False
    if op == "in":
        # target is comma-separated list
        options = [o.strip().lower() for o in target.split(",")]
        return fv.lower() in options
    return False


def _get_field_value(lead: Lead, field_name: str) -> str | None:
    """Resolve a field value from lead or its contact."""
    # Lead fields
    if hasattr(lead, field_name):
        val = getattr(lead, field_name)
        if val is not None:
            return str(val)
    # Contact fields (via relationship)
    if lead.contact and hasattr(lead.contact, field_name):
        val = getattr(lead.contact, field_name)
        if val is not None:
            return str(val)
    # Custom fields
    if lead.custom_fields and field_name in lead.custom_fields:
        return str(lead.custom_fields[field_name])
    if lead.contact and lead.contact.custom_fields and field_name in lead.contact.custom_fields:
        return str(lead.contact.custom_fields[field_name])
    return None


async def score_lead(db: AsyncSession, lead_id, rules: list[LeadScoringRule] | None = None) -> dict:
    """Score a single lead against all active rules. Returns score dict."""
    stmt = select(Lead).where(Lead.id == lead_id).options(selectinload(Lead.contact))
    result = await db.execute(stmt)
    lead = result.scalar_one_or_none()
    if not lead:
        return {"error": "Lead not found"}

    if rules is None:
        rules_stmt = select(LeadScoringRule).where(LeadScoringRule.is_active.is_(True))
        rules_result = await db.execute(rules_stmt)
        rules = list(rules_result.scalars().all())

    total_score = 0
    factors: list[dict] = []

    for rule in rules:
        field_value = _get_field_value(lead, rule.field_name)
        matched = _evaluate_rule(rule, field_value)
        if matched:
            total_score += rule.score_delta
            factors.append({
                "rule": rule.name,
                "category": rule.category,
                "field": rule.field_name,
                "delta": rule.score_delta,
            })

    # Clamp 0-100
    total_score = max(0, min(100, total_score))

    # Determine category
    if total_score >= 80:
        category = "Hot"
    elif total_score >= 60:
        category = "Warm"
    elif total_score >= 40:
        category = "Cool"
    else:
        category = "Cold"

    # Persist score on lead
    lead.score = total_score
    lead.score_factors = {"factors": factors, "category": category}
    lead.scored_at = datetime.now(timezone.utc)
    await db.flush()

    return {
        "lead_id": str(lead.id),
        "score": total_score,
        "category": category,
        "factors": factors,
    }


async def batch_rescore_all(db: AsyncSession) -> dict:
    """Re-score all leads using current active rules."""
    rules_stmt = select(LeadScoringRule).where(LeadScoringRule.is_active.is_(True))
    rules_result = await db.execute(rules_stmt)
    rules = list(rules_result.scalars().all())

    leads_stmt = select(Lead).options(selectinload(Lead.contact))
    leads_result = await db.execute(leads_stmt)
    leads = list(leads_result.scalars().all())

    scored = 0
    for lead in leads:
        total_score = 0
        factors: list[dict] = []
        for rule in rules:
            field_value = _get_field_value(lead, rule.field_name)
            if _evaluate_rule(rule, field_value):
                total_score += rule.score_delta
                factors.append({"rule": rule.name, "delta": rule.score_delta})

        total_score = max(0, min(100, total_score))
        category = "Hot" if total_score >= 80 else "Warm" if total_score >= 60 else "Cool" if total_score >= 40 else "Cold"

        lead.score = total_score
        lead.score_factors = {"factors": factors, "category": category}
        lead.scored_at = datetime.now(timezone.utc)
        scored += 1

    await db.flush()
    return {"scored": scored, "rules_applied": len(rules)}
