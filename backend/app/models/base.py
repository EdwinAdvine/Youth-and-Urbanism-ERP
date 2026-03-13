from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class UUIDPrimaryKeyMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )


class SoftDeleteMixin:
    """Mixin that adds soft-delete via deleted_at timestamp."""

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None, index=True,
    )
    deleted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, default=None,
    )

    @hybrid_property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    @is_deleted.inplace.expression
    @classmethod
    def _is_deleted_expression(cls):
        return cls.deleted_at.isnot(None)


class OptimisticLockMixin:
    """Adds a version column for optimistic concurrency control.

    Apply selectively to models where concurrent edits are likely
    (finance, inventory, CRM, projects, etc.).
    """

    version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1",
    )


class BaseModel(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Abstract base that all domain models inherit from."""

    __abstract__ = True
