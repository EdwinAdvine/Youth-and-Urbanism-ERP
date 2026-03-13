"""Audit logging helper for Urban Vibes Dynamics.

Provides a single fire-and-forget function, ``log_audit()``, that records
user actions (create, update, delete, login, etc.) into the ``audit_logs``
database table via ``UserService.log_action()``.

Design decisions:
    - **Never raises:** All exceptions are silently swallowed so that an
      audit failure can never break the primary operation it decorates.
    - **Lazy import:** ``UserService`` is imported inside the function body
      to avoid circular import issues (``models → core → services``).
    - **IP extraction:** When a ``Request`` object is provided, the client
      IP is captured for forensic traceability.

Usage:
    from app.core.audit import log_audit

    @router.post("/invoices")
    async def create_invoice(
        ...,
        db: AsyncSession = Depends(get_db),
        user: User = Depends(current_user),
        request: Request,
    ):
        invoice = await InvoiceService(db).create(...)
        await log_audit(
            db, user, "invoice.created",
            resource_type="invoice",
            resource_id=str(invoice.id),
            metadata={"amount": invoice.total},
            request=request,
        )
        return invoice

Recorded fields:
    - action        — dot-delimited event name (e.g. "invoice.created")
    - user_id       — UUID of the acting user (None for anonymous/system)
    - user_email    — email address for quick human lookup
    - resource_type — entity kind (e.g. "invoice", "user", "project")
    - resource_id   — primary key of the affected resource
    - metadata      — arbitrary JSON dict with extra context
    - ip_address    — client IP from the HTTP request
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def log_audit(
    db: AsyncSession,
    user: User | None,
    action: str,
    *,
    resource_type: str | None = None,
    resource_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    request: Request | None = None,
) -> None:
    """Fire-and-forget audit log entry. Never raises.

    Args:
        db: Active async database session (from the request's ``get_db``
            dependency — the audit row is committed with the same
            transaction as the primary operation).
        user: The authenticated user performing the action, or ``None``
            for anonymous / system-initiated events.
        action: Dot-delimited action name (e.g. ``"invoice.created"``).
        resource_type: Kind of entity affected (e.g. ``"invoice"``).
        resource_id: Primary key (as string) of the affected entity.
        metadata: Optional JSON-serialisable dict with extra context
            (amounts, old/new values, etc.).
        request: The incoming ``Request`` — used only to extract the
            client IP address for forensic logging.
    """
    try:
        from app.services.user import UserService  # local import avoids circular deps

        # Extract client IP when a request object is available
        ip: str | None = None
        if request is not None and request.client is not None:
            ip = request.client.host

        await UserService(db).log_action(
            action,
            user_id=user.id if user else None,
            user_email=user.email if user else None,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            metadata=metadata,
            ip_address=ip,
        )
    except Exception:
        pass  # audit failures must never break primary operations
