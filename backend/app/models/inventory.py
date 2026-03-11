"""Inventory models — warehouses, items, stock levels, movements, purchase orders."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# ── Warehouse ─────────────────────────────────────────────────────────────────
class Warehouse(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Physical or logical storage location."""

    __tablename__ = "inventory_warehouses"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    location: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


# ── InventoryItem ─────────────────────────────────────────────────────────────
class InventoryItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Stockable item / product."""

    __tablename__ = "inventory_items"

    sku: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    unit_of_measure: Mapped[str] = mapped_column(String(50), default="unit")
    cost_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    selling_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    reorder_level: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    stock_levels = relationship("StockLevel", back_populates="item")
    stock_movements = relationship("StockMovement", back_populates="item")


# ── StockLevel ────────────────────────────────────────────────────────────────
class StockLevel(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Current quantity of an item in a specific warehouse."""

    __tablename__ = "inventory_stock_levels"
    __table_args__ = (
        UniqueConstraint("item_id", "warehouse_id", name="uq_stock_item_warehouse"),
    )

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False
    )
    quantity_on_hand: Mapped[int] = mapped_column(Integer, default=0)
    quantity_reserved: Mapped[int] = mapped_column(Integer, default=0)

    item = relationship("InventoryItem", back_populates="stock_levels")
    warehouse = relationship("Warehouse")


# ── StockMovement ─────────────────────────────────────────────────────────────
class StockMovement(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Audit trail for every stock-in / stock-out event."""

    __tablename__ = "inventory_stock_movements"

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False
    )
    movement_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # receipt, issue, transfer, adjustment
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reference_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # e.g. "purchase_order"
    reference_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    item = relationship("InventoryItem", back_populates="stock_movements")
    warehouse = relationship("Warehouse")


# ── PurchaseOrder ─────────────────────────────────────────────────────────────
class PurchaseOrder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Purchase order header."""

    __tablename__ = "inventory_purchase_orders"

    po_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    supplier_name: Mapped[str] = mapped_column(String(200), nullable=False)
    supplier_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, sent, received, cancelled
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    expected_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    lines = relationship(
        "PurchaseOrderLine", back_populates="purchase_order", cascade="all, delete-orphan"
    )


# ── PurchaseOrderLine ─────────────────────────────────────────────────────────
class PurchaseOrderLine(UUIDPrimaryKeyMixin, Base):
    """Single line item on a purchase order."""

    __tablename__ = "inventory_purchase_order_lines"

    purchase_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_purchase_orders.id"), nullable=False
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    received_quantity: Mapped[int] = mapped_column(Integer, default=0)

    purchase_order = relationship("PurchaseOrder", back_populates="lines")
    item = relationship("InventoryItem")


# ── Supplier ─────────────────────────────────────────────────────────────────
class InventorySupplier(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Vendor / supplier master record (inventory-specific)."""

    __tablename__ = "inventory_suppliers"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_person: Mapped[str | None] = mapped_column(String(200), nullable=True)
    payment_terms: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


# ── StockAdjustment ──────────────────────────────────────────────────────────
class StockAdjustment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Record of a manual stock quantity adjustment with reason."""

    __tablename__ = "inventory_stock_adjustments"

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False
    )
    old_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    new_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    adjusted_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    item = relationship("InventoryItem")
    warehouse = relationship("Warehouse")


# ── ItemVariant ──────────────────────────────────────────────────────────────
class ItemVariant(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Variant of an inventory item (e.g. colour, size)."""

    __tablename__ = "inventory_item_variants"

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    variant_name: Mapped[str] = mapped_column(String(200), nullable=False)
    sku: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    price_adjustment: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    attributes: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    item = relationship("InventoryItem")


# ── BatchNumber ──────────────────────────────────────────────────────────────
class BatchNumber(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Batch / lot tracking for inventory items."""

    __tablename__ = "inventory_batch_numbers"

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    batch_no: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    manufacture_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False
    )

    item = relationship("InventoryItem")
    warehouse = relationship("Warehouse")


# ── InventoryCount ───────────────────────────────────────────────────────────
class InventoryCount(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Physical inventory count / stock-take session."""

    __tablename__ = "inventory_counts"

    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False
    )
    count_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="in_progress"
    )  # in_progress, completed, cancelled
    counted_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    lines: Mapped[list | None] = mapped_column(
        JSON, nullable=True
    )  # array of {item_id, expected_qty, actual_qty}

    warehouse = relationship("Warehouse")
