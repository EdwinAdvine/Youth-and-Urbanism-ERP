"""Universal audit trail — SQLAlchemy event listeners.

Automatically captures INSERT, UPDATE, and DELETE operations across
all models and writes them to the ``universal_audit_log`` table.

Context (user_id, ip_address) is carried via ``contextvars`` set by
the ``AuditContextMiddleware`` in main.py.
"""
from __future__ import annotations

import contextvars
import logging
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session, UOWTransaction

logger = logging.getLogger(__name__)

# ── Context variables set per-request by middleware / deps ────────────────────
audit_user_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "audit_user_id", default=None,
)
audit_ip_address: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "audit_ip_address", default=None,
)

# Tables excluded from auditing (too noisy or recursive)
EXCLUDED_TABLES: set[str] = {
    "universal_audit_log",
    "audit_logs",
    "analytics_usage_logs",
    "chat_message_read_receipts",
    "message_read_receipts",
    "activity_feed",
}


def _serialize(val: Any) -> Any:
    """Convert a value to a JSON-safe representation."""
    if val is None:
        return None
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, Decimal):
        return str(val)
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, bytes):
        return "<binary>"
    if isinstance(val, (list, dict)):
        return val
    if isinstance(val, (str, int, float, bool)):
        return val
    return str(val)


def _get_columns(mapper) -> list[str]:
    """Return column attribute names for a mapper."""
    return [prop.key for prop in mapper.column_attrs]


def _snapshot(instance, columns: list[str]) -> dict[str, Any]:
    """Create a JSON-safe snapshot of an instance's column values."""
    result: dict[str, Any] = {}
    for col in columns:
        try:
            result[col] = _serialize(getattr(instance, col, None))
        except Exception:
            result[col] = "<error>"
    return result


def _collect_changes(session: Session) -> list[dict[str, Any]]:
    """Collect audit entries from the session's pending changes."""
    entries: list[dict[str, Any]] = []
    user_id = audit_user_id.get()
    ip_addr = audit_ip_address.get()

    # INSERTs
    for instance in list(session.new):
        mapper = inspect(type(instance))
        table_name = mapper.persist_selectable.name
        if table_name in EXCLUDED_TABLES:
            continue
        cols = _get_columns(mapper)
        new_vals = _snapshot(instance, cols)
        entries.append({
            "table_name": table_name,
            "record_id": str(getattr(instance, "id", "")),
            "action": "INSERT",
            "old_values": None,
            "new_values": new_vals,
            "changed_fields": cols,
            "user_id": user_id,
            "ip_address": ip_addr,
        })

    # UPDATEs
    for instance in list(session.dirty):
        if not session.is_modified(instance, include_collections=False):
            continue
        mapper = inspect(type(instance))
        table_name = mapper.persist_selectable.name
        if table_name in EXCLUDED_TABLES:
            continue

        state = inspect(instance)
        changed_fields: list[str] = []
        old_values: dict[str, Any] = {}
        new_values: dict[str, Any] = {}
        for attr in _get_columns(mapper):
            hist = state.attrs[attr].history
            if hist.has_changes():
                old_val = hist.deleted[0] if hist.deleted else None
                new_val = hist.added[0] if hist.added else getattr(instance, attr, None)
                changed_fields.append(attr)
                old_values[attr] = _serialize(old_val)
                new_values[attr] = _serialize(new_val)

        if changed_fields:
            entries.append({
                "table_name": table_name,
                "record_id": str(getattr(instance, "id", "")),
                "action": "UPDATE",
                "old_values": old_values,
                "new_values": new_values,
                "changed_fields": changed_fields,
                "user_id": user_id,
                "ip_address": ip_addr,
            })

    # DELETEs
    for instance in list(session.deleted):
        mapper = inspect(type(instance))
        table_name = mapper.persist_selectable.name
        if table_name in EXCLUDED_TABLES:
            continue
        cols = _get_columns(mapper)
        old_vals = _snapshot(instance, cols)
        entries.append({
            "table_name": table_name,
            "record_id": str(getattr(instance, "id", "")),
            "action": "DELETE",
            "old_values": old_vals,
            "new_values": None,
            "changed_fields": None,
            "user_id": user_id,
            "ip_address": ip_addr,
        })

    return entries


# Buffer for entries collected during flush — inserted in after_commit
_pending_entries: contextvars.ContextVar[list[dict]] = contextvars.ContextVar(
    "_pending_entries", default=[],
)


def _before_flush(session: Session, flush_context: UOWTransaction, instances) -> None:
    """Collect audit entries before flush (while history is still available)."""
    try:
        entries = _collect_changes(session)
        if entries:
            existing = _pending_entries.get([])
            _pending_entries.set(existing + entries)
    except Exception:
        logger.debug("Audit listener: error collecting changes", exc_info=True)


def _after_commit(session: Session) -> None:
    """Write collected audit entries after successful commit."""
    entries = _pending_entries.get([])
    if not entries:
        return
    _pending_entries.set([])

    try:
        # Use a separate sync connection to avoid interfering with the
        # async session lifecycle. We use the session's bind directly.
        from app.models.audit_trail import UniversalAuditLog  # noqa: PLC0415

        # Build ORM instances for bulk save
        audit_records = []
        for entry in entries:
            audit_records.append(UniversalAuditLog(
                table_name=entry["table_name"],
                record_id=entry["record_id"],
                action=entry["action"],
                old_values=entry["old_values"],
                new_values=entry["new_values"],
                changed_fields=entry["changed_fields"],
                user_id=uuid.UUID(entry["user_id"]) if entry["user_id"] else None,
                ip_address=entry["ip_address"],
            ))

        # Add to the session — they'll be committed in the next flush
        for record in audit_records:
            session.add(record)

        # We need to flush these without triggering another before_flush audit
        _in_audit_write.set(True)
        try:
            session.flush()
        finally:
            _in_audit_write.set(False)
    except Exception:
        logger.debug("Audit listener: error writing audit log", exc_info=True)


def _after_rollback(session: Session) -> None:
    """Clear pending entries on rollback."""
    _pending_entries.set([])


_in_audit_write: contextvars.ContextVar[bool] = contextvars.ContextVar(
    "_in_audit_write", default=False,
)


def _guarded_before_flush(session, flush_context, instances):
    """Skip audit collection when we're writing audit records ourselves."""
    if _in_audit_write.get(False):
        return
    _before_flush(session, flush_context, instances)


def register_audit_listeners() -> None:
    """Register SQLAlchemy event listeners for universal audit trail.

    Call this once at application startup (in lifespan).
    """
    event.listen(Session, "before_flush", _guarded_before_flush)
    event.listen(Session, "after_commit", _after_commit)
    event.listen(Session, "after_rollback", _after_rollback)
    logger.info("Universal audit trail listeners registered.")
