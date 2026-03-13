"""Soft-delete query helpers.

Usage:
    # In list endpoints — exclude soft-deleted rows:
    query = not_deleted(select(Invoice), Invoice)

    # In delete endpoints — soft-delete instead of hard delete:
    await soft_delete(db, invoice, user_id=current_user.id)
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Select, func
from sqlalchemy.ext.asyncio import AsyncSession


def not_deleted(query: Select, model) -> Select:
    """Filter helper: exclude soft-deleted rows."""
    if hasattr(model, "deleted_at"):
        return query.where(model.deleted_at.is_(None))
    return query


async def soft_delete(
    db: AsyncSession,
    instance,
    *,
    user_id: uuid.UUID | None = None,
) -> None:
    """Mark a record as soft-deleted instead of hard deleting."""
    instance.deleted_at = func.now()
    if user_id and hasattr(instance, "deleted_by"):
        instance.deleted_by = user_id
    db.add(instance)


async def restore(db: AsyncSession, instance) -> None:
    """Restore a soft-deleted record."""
    instance.deleted_at = None
    instance.deleted_by = None
    db.add(instance)
