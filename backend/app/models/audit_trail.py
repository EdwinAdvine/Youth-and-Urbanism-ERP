"""Universal audit trail — captures every INSERT/UPDATE/DELETE across all models."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class UniversalAuditLog(Base):
    """Immutable audit record for any table change."""

    __tablename__ = "universal_audit_log"
    __table_args__ = (
        Index("ix_ual_table_record", "table_name", "record_id"),
        Index("ix_ual_timestamp", "timestamp"),
        Index("ix_ual_user", "user_id"),
        Index("ix_ual_action", "action"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    table_name: Mapped[str] = mapped_column(String(100), nullable=False)
    record_id: Mapped[str] = mapped_column(String(36), nullable=False)
    action: Mapped[str] = mapped_column(String(10), nullable=False)  # INSERT, UPDATE, DELETE
    old_values: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    new_values: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    changed_fields: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
