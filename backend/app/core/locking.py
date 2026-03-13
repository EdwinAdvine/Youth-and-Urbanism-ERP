"""Optimistic locking helpers.

Usage in update endpoints:
    # 1. Check version before applying changes
    await check_version(db, Invoice, invoice_id, payload.version)

    # 2. Apply changes ...

    # 3. Bump version
    increment_version(invoice)
"""
from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class StaleDataError(HTTPException):
    """Raised when the record was modified by another user since last read."""

    def __init__(self) -> None:
        super().__init__(
            status_code=409,
            detail="Record was modified by another user. Please refresh and try again.",
        )


async def check_version(
    db: AsyncSession,
    model_class,
    record_id: uuid.UUID,
    expected_version: int,
) -> None:
    """Verify that the record version matches the expected value.

    Raises StaleDataError (HTTP 409) if the record has been modified.
    Raises HTTPException 404 if the record is not found.
    """
    result = await db.execute(
        select(model_class.version).where(model_class.id == record_id)
    )
    current = result.scalar_one_or_none()
    if current is None:
        raise HTTPException(status_code=404, detail="Record not found")
    if current != expected_version:
        raise StaleDataError()


def increment_version(instance) -> None:
    """Bump the version number on a model instance."""
    instance.version = (instance.version or 1) + 1
