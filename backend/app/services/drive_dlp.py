"""drive_dlp.py — DLP (Data Loss Prevention) scanning engine for Drive files.

Scans file text content against active DlpRules and records violations.
Called during file share operations and on-demand.
"""
from __future__ import annotations

import re
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.drive_phase2 import DlpRule, DlpViolation


def _pattern_matches(pattern_type: str, pattern_value: str, content_text: str) -> bool:
    """Return True if the pattern matches the content text."""
    if pattern_type == "regex":
        return bool(re.search(pattern_value, content_text, re.IGNORECASE))
    elif pattern_type == "keyword":
        return pattern_value.lower() in content_text.lower()
    elif pattern_type == "ai_classification":
        # AI classification requires a separate AI call — skip during sync scan
        return False
    return False


async def scan_file(
    file_id: uuid.UUID,
    content_text: str,
    db: AsyncSession,
    user_id: uuid.UUID | None = None,
) -> list[dict]:
    """Scan file content against all active DLP rules.

    For each active rule, checks every pattern in rule.patterns.
    If any pattern matches, records a DlpViolation and commits.

    Returns a list of violation dicts: {rule_id, rule_name, action, matched_patterns}.
    """
    result = await db.execute(
        select(DlpRule).where(DlpRule.is_active == True)
    )
    rules: list[DlpRule] = result.scalars().all()

    violations: list[dict] = []

    for rule in rules:
        matched: list[dict] = []
        patterns: list[dict] = rule.patterns or []

        for pattern in patterns:
            p_type = pattern.get("type", "")
            p_value = pattern.get("value", "")
            if not p_value:
                continue
            if _pattern_matches(p_type, p_value, content_text):
                matched.append({
                    "type": p_type,
                    "value": p_value,
                    "label": pattern.get("label", ""),
                })

        if matched:
            violation = DlpViolation(
                rule_id=rule.id,
                file_id=file_id,
                user_id=user_id,
                matched_patterns=matched,
                action_taken=rule.action,
                details=f"Matched {len(matched)} pattern(s) in rule '{rule.name}'",
            )
            db.add(violation)
            violations.append({
                "rule_id": str(rule.id),
                "rule_name": rule.name,
                "action": rule.action,
                "matched_patterns": matched,
            })

    if violations:
        await db.commit()

    return violations


async def check_share_allowed(
    file_id: uuid.UUID,
    content_text: str,
    db: AsyncSession,
    user_id: uuid.UUID | None = None,
) -> tuple[bool, list[dict]]:
    """Check whether sharing a file is allowed under DLP policy.

    Returns (True, []) if no blocking violations exist.
    Returns (False, violations) if any rule with action 'block_sharing' or
    'quarantine' is triggered.
    """
    violations = await scan_file(file_id, content_text, db, user_id)

    blocking_actions = {"block_sharing", "quarantine"}
    blocking = [v for v in violations if v["action"] in blocking_actions]

    if blocking:
        return False, violations

    return True, []
