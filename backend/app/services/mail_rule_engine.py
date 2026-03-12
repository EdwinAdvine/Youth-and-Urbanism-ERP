"""Mail rule execution engine -- evaluates rules against messages and applies actions."""
from __future__ import annotations

import logging
import re
import uuid
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


# ── String matching helper ────────────────────────────────────────────────────


def _match_condition(field_value: str, operator: str, match_value: str) -> bool:
    """Evaluate a single condition against a field value.

    Supported operators: contains, not_contains, equals, not_equals,
    starts_with, ends_with, regex, is_true, is_false.
    """
    fv = field_value.lower()
    mv = match_value.lower()

    if operator == "contains":
        return mv in fv
    elif operator == "not_contains":
        return mv not in fv
    elif operator == "equals":
        return fv == mv
    elif operator == "not_equals":
        return fv != mv
    elif operator == "starts_with":
        return fv.startswith(mv)
    elif operator == "ends_with":
        return fv.endswith(mv)
    elif operator == "regex":
        try:
            return bool(re.search(match_value, field_value, re.IGNORECASE))
        except re.error:
            return False
    elif operator == "is_true":
        return fv == "true"
    elif operator == "is_false":
        return fv == "false"
    return False


# ── Rule evaluation ───────────────────────────────────────────────────────────


async def evaluate_rule(rule_data: dict, message_data: dict) -> bool:
    """Evaluate a single rule's conditions against message data.

    ``rule_data`` must contain a ``conditions`` key (list of condition dicts
    or a single condition dict) and optionally ``match_mode`` ("all" or "any").

    Each condition dict: ``{"field": "from"|"subject"|"to"|"body",
    "operator": "contains"|"equals"|"starts_with"|"ends_with"|"regex",
    "value": "..."}``.

    ``message_data`` is a flat dict with keys matching the condition fields
    (from, subject, to, body, has_attachment, from_name).
    """
    conditions = rule_data.get("conditions", [])

    # Support single-condition dict form
    if isinstance(conditions, dict):
        conditions = [conditions]

    if not isinstance(conditions, list) or not conditions:
        return False

    match_mode = rule_data.get("match_mode", "all")
    results: list[bool] = []

    for condition in conditions:
        field = condition.get("field", "")
        operator = condition.get("operator", "contains")
        value = condition.get("value", "")

        if not field or not value:
            continue

        field_value = str(message_data.get(field, ""))
        results.append(_match_condition(field_value, operator, value))

    if not results:
        return False

    if match_mode == "any":
        return any(results)
    return all(results)  # default: "all" (AND)


# ── Action application ────────────────────────────────────────────────────────


async def apply_actions(
    db: AsyncSession,
    message_id: uuid.UUID,
    actions: list[dict],
) -> list[dict]:
    """Apply a list of actions to a message.

    Supported action types:
      - move: change folder (``{"type": "move", "value": "Archive"}``)
      - label: add label_id (``{"type": "label", "value": "<uuid>"}``)
      - mark_read: mark as read
      - mark_starred: mark as starred
      - delete: soft-delete
      - flag: set flag_status to "flagged"
      - categorize: add category_id
      - set_display_format: conditional formatting
      - forward: publish event (not executed here, returned for caller)

    Returns a list of dicts describing the actions that were applied.
    """
    from app.models.mail_storage import MailboxMessage

    result = await db.execute(
        select(MailboxMessage).where(MailboxMessage.id == message_id)
    )
    message = result.scalar_one_or_none()
    if not message:
        return [{"error": "Message not found"}]

    applied: list[dict] = []

    for action in actions:
        action_type = action.get("type", "")
        action_value = action.get("value", "")

        try:
            if action_type == "move":
                message.folder = action_value
                applied.append({"type": "move", "to": action_value})

            elif action_type == "label":
                if action_value:
                    labels = list(message.label_ids or [])
                    if action_value not in labels:
                        labels.append(action_value)
                        message.label_ids = labels
                    applied.append({"type": "label", "label_id": action_value})

            elif action_type == "mark_read":
                message.is_read = True
                applied.append({"type": "mark_read"})

            elif action_type == "mark_starred":
                message.is_starred = True
                applied.append({"type": "mark_starred"})

            elif action_type == "delete":
                message.is_deleted = True
                applied.append({"type": "delete"})

            elif action_type == "flag":
                message.flag_status = "flagged"
                applied.append({"type": "flag"})

            elif action_type == "categorize":
                cat_ids = list(message.category_ids or [])
                if action_value and action_value not in cat_ids:
                    cat_ids.append(action_value)
                    message.category_ids = cat_ids
                applied.append({"type": "categorize", "category_id": action_value})

            elif action_type == "set_display_format":
                message.display_format = action.get("format", {})
                applied.append({"type": "set_display_format"})

            elif action_type == "forward":
                # Forward is handled asynchronously -- publish an event for the
                # caller to pick up.  We don't execute the send here.
                applied.append({"type": "forward", "to": action_value, "pending": True})

        except Exception as exc:
            logger.error("Failed to apply action %s to message %s: %s", action_type, message_id, exc)

    if applied:
        try:
            await db.commit()
        except Exception as exc:
            logger.error("Failed to commit actions for message %s: %s", message_id, exc)
            await db.rollback()

    return applied


# ── Full message processing ───────────────────────────────────────────────────


async def process_message(
    db: AsyncSession,
    message_id: uuid.UUID,
    user_id: uuid.UUID,
) -> list[dict]:
    """Load all active rules for a user, evaluate each against the message,
    and apply matching rule actions.

    Rules are evaluated in priority order (ascending).  If a rule has
    ``stop_processing`` set, no further rules are checked after it matches.

    Returns a list of action dicts that were applied.
    """
    from app.models.mail import MailRule
    from app.models.mail_storage import MailboxMessage

    # Load message
    msg_result = await db.execute(
        select(MailboxMessage).where(MailboxMessage.id == message_id)
    )
    message = msg_result.scalar_one_or_none()
    if not message:
        return []

    # Build message data dict for rule evaluation
    message_data = {
        "from": message.from_addr or "",
        "from_name": message.from_name or "",
        "to": ", ".join(a.get("email", "") for a in (message.to_addrs or [])),
        "subject": message.subject or "",
        "body": message.body_text or "",
        "has_attachment": "true" if message.attachments else "false",
    }

    # Load active rules ordered by priority
    rules_result = await db.execute(
        select(MailRule).where(
            MailRule.owner_id == user_id,
            MailRule.is_active.is_(True),
        ).order_by(MailRule.priority.asc())
    )
    rules = rules_result.scalars().all()

    all_applied: list[dict] = []

    for rule in rules:
        rule_data = {
            "conditions": rule.conditions,
            "match_mode": getattr(rule, "match_mode", "all"),
        }

        matched = await evaluate_rule(rule_data, message_data)
        if not matched:
            continue

        # Apply actions from this rule
        actions = rule.actions or []
        for action in actions:
            action_type = action.get("type", "")
            action_value = action.get("value", "")

            try:
                if action_type == "move":
                    message.folder = action_value
                    all_applied.append({"type": "move", "to": action_value, "rule": rule.name})

                elif action_type == "label":
                    if action_value:
                        labels = list(message.label_ids or [])
                        if action_value not in labels:
                            labels.append(action_value)
                            message.label_ids = labels
                        all_applied.append({"type": "label", "label_id": action_value, "rule": rule.name})

                elif action_type == "mark_read":
                    message.is_read = True
                    all_applied.append({"type": "mark_read", "rule": rule.name})

                elif action_type == "star":
                    message.is_starred = True
                    all_applied.append({"type": "star", "rule": rule.name})

                elif action_type == "delete":
                    message.is_deleted = True
                    all_applied.append({"type": "delete", "rule": rule.name})

                elif action_type == "flag":
                    message.flag_status = "flagged"
                    all_applied.append({"type": "flag", "rule": rule.name})

                elif action_type == "categorize":
                    cat_ids = list(message.category_ids or [])
                    if action_value and action_value not in cat_ids:
                        cat_ids.append(action_value)
                        message.category_ids = cat_ids
                    all_applied.append({"type": "categorize", "category_id": action_value, "rule": rule.name})

                elif action_type == "set_display_format":
                    message.display_format = action.get("format", {})
                    all_applied.append({"type": "set_display_format", "rule": rule.name})

                elif action_type == "forward":
                    all_applied.append({"type": "forward", "to": action_value, "rule": rule.name, "pending": True})

            except Exception as exc:
                logger.error(
                    "Failed to execute action %s for rule %s: %s",
                    action_type, rule.name, exc,
                )

        # Respect stop_processing flag
        if rule.stop_processing:
            break

    if all_applied:
        try:
            await db.commit()
        except Exception as exc:
            logger.error("Failed to commit rule actions for message %s: %s", message_id, exc)
            await db.rollback()

    return all_applied


# ── Dry-run test ──────────────────────────────────────────────────────────────


async def test_rule(
    db: AsyncSession,
    rule_id: uuid.UUID,
    message_id: uuid.UUID,
    user_id: uuid.UUID,
) -> dict:
    """Dry-run: evaluate a rule against a message without applying any actions.

    Returns ``{would_match: bool, actions_preview: list}``.
    """
    from app.models.mail import MailRule
    from app.models.mail_storage import MailboxMessage

    rule = await db.get(MailRule, rule_id)
    if not rule or rule.owner_id != user_id:
        return {"would_match": False, "actions_preview": [], "error": "Rule not found"}

    msg = await db.get(MailboxMessage, message_id)
    if not msg or msg.user_id != user_id:
        return {"would_match": False, "actions_preview": [], "error": "Message not found"}

    message_data = {
        "from": msg.from_addr or "",
        "from_name": msg.from_name or "",
        "to": ", ".join(a.get("email", "") for a in (msg.to_addrs or [])),
        "subject": msg.subject or "",
        "body": msg.body_text or "",
        "has_attachment": "true" if msg.attachments else "false",
    }

    rule_data = {
        "conditions": rule.conditions,
        "match_mode": getattr(rule, "match_mode", "all"),
    }

    matched = await evaluate_rule(rule_data, message_data)

    if not matched:
        return {
            "would_match": False,
            "actions_preview": [],
            "message": "Message does not match rule conditions.",
        }

    actions_preview = [
        {"type": a.get("type"), "value": a.get("value")}
        for a in (rule.actions or [])
    ]

    return {
        "would_match": True,
        "actions_preview": actions_preview,
        "message": f"Rule '{rule.name}' would execute {len(actions_preview)} action(s).",
    }
