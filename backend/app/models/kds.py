"""Kitchen Display System models — stations, orders, order items."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class KDSStation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A kitchen / bar / prep station that receives orders."""

    __tablename__ = "kds_stations"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    station_type: Mapped[str] = mapped_column(
        String(50), default="kitchen"
    )  # kitchen, bar, prep, packing
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(default=True)

    warehouse = relationship("Warehouse")
    orders = relationship("KDSOrder", back_populates="station")


class KDSOrder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """An order routed to a KDS station from a POS transaction."""

    __tablename__ = "kds_orders"

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_transactions.id"), nullable=False
    )
    station_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kds_stations.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(30), default="new"
    )  # new, in_progress, ready, served, cancelled
    priority: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    transaction = relationship("POSTransaction")
    station = relationship("KDSStation", back_populates="orders")
    items = relationship("KDSOrderItem", back_populates="order", cascade="all, delete-orphan")


class KDSOrderItem(UUIDPrimaryKeyMixin, Base):
    """A single item within a KDS order."""

    __tablename__ = "kds_order_items"

    kds_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kds_orders.id"), nullable=False
    )
    line_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_transaction_lines.id"), nullable=True
    )
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    modifiers: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(30), default="pending"
    )  # pending, cooking, ready

    order = relationship("KDSOrder", back_populates="items")
    line = relationship("POSTransactionLine")
