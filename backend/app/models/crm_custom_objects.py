"""CRM Custom Objects models — user-defined entities, records, and relationships."""
from __future__ import annotations

import uuid

from sqlalchemy import (
    Boolean,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class CustomObjectDefinition(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Schema definition for a user-created custom CRM object."""

    __tablename__ = "crm_custom_object_definitions"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    plural_label: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    fields: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )  # [{name, label, type, required, options, default_value}, ...]
    relationships: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )  # [{related_entity, relationship_type, foreign_key_field}, ...]
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    records = relationship("CustomObjectRecord", back_populates="definition", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by])


class CustomObjectRecord(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Single record (instance) of a custom object."""

    __tablename__ = "crm_custom_object_records"

    definition_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_custom_object_definitions.id"), nullable=False
    )
    data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    definition = relationship("CustomObjectDefinition", back_populates="records")
    owner = relationship("User", foreign_keys=[owner_id])
    record_relationships = relationship("CustomObjectRelationship", back_populates="record", cascade="all, delete-orphan")


class CustomObjectRelationship(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Link between a custom object record and another entity."""

    __tablename__ = "crm_custom_object_relationships"

    record_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_custom_object_records.id"), nullable=False
    )
    related_entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    related_entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(50), nullable=False)

    record = relationship("CustomObjectRecord", back_populates="record_relationships")
