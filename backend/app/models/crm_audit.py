"""CRM Audit Log model — tracks all CRM entity changes."""
from __future__ import annotations

import uuid

from sqlalchemy import (
    ForeignKey,
    Index,
    String,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class CRMAuditLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Audit trail for CRM entity create/update/delete/view/export/merge actions."""

    __tablename__ = "crm_audit_log"
    __table_args__ = (
        Index("ix_crm_audit_log_entity", "entity_type", "entity_id"),
    )

    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    action: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # create, update, delete, view, export, merge
    changes: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {field: {old, new}, ...}
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    user = relationship("User", foreign_keys=[user_id])
