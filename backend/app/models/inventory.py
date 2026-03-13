"""Inventory models — warehouses, items, stock levels, movements, purchase orders."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, OptimisticLockMixin, TimestampMixin, UUIDPrimaryKeyMixin

# ── Phase 1 forward declarations (avoid circular) ─────────────────────────────
# SerialNumber, UnitOfMeasure, UoMConversion, BlanketOrder added below


# ── Warehouse ─────────────────────────────────────────────────────────────────
class Warehouse(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Physical or logical storage location."""

    __tablename__ = "inventory_warehouses"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    location: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Phase 0 additions
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    warehouse_type: Mapped[str] = mapped_column(
        String(30), default="standard"
    )  # standard, transit, drop_ship, consignment
    manager_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )


# ── InventoryItem ─────────────────────────────────────────────────────────────
class InventoryItem(OptimisticLockMixin, UUIDPrimaryKeyMixin, TimestampMixin, Base):
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
    # Phase 0 additions
    item_type: Mapped[str] = mapped_column(
        String(30), default="stockable"
    )  # stockable, consumable, service, kit
    tracking_type: Mapped[str] = mapped_column(
        String(20), default="none"
    )  # none, batch, serial
    weight: Mapped[Decimal | None] = mapped_column(Numeric(10, 3), nullable=True)
    dimensions: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )  # {length, width, height, unit}
    barcode: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )
    min_order_qty: Mapped[int] = mapped_column(Integer, default=1)
    lead_time_days: Mapped[int] = mapped_column(Integer, default=0)
    preferred_supplier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_suppliers.id"), nullable=True
    )
    custom_fields: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    max_stock_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rfid_tag: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )

    stock_levels = relationship("StockLevel", back_populates="item")
    stock_movements = relationship("StockMovement", back_populates="item")
    preferred_supplier = relationship("InventorySupplier", foreign_keys=[preferred_supplier_id])


# ── StockLevel ────────────────────────────────────────────────────────────────
class StockLevel(OptimisticLockMixin, UUIDPrimaryKeyMixin, TimestampMixin, Base):
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
    # Phase 0 additions
    quantity_committed: Mapped[int] = mapped_column(Integer, default=0)
    quantity_incoming: Mapped[int] = mapped_column(Integer, default=0)
    bin_location: Mapped[str | None] = mapped_column(String(100), nullable=True)

    item = relationship("InventoryItem", back_populates="stock_levels")
    warehouse = relationship("Warehouse")

    @property
    def quantity_available(self) -> int:
        """Available = on_hand - reserved - committed."""
        return self.quantity_on_hand - self.quantity_reserved - self.quantity_committed


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
class PurchaseOrder(OptimisticLockMixin, UUIDPrimaryKeyMixin, TimestampMixin, Base):
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
    # Phase 1 additions
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_suppliers.id"), nullable=True
    )
    blanket_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_blanket_orders.id"), nullable=True
    )
    warehouse_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=True
    )
    three_way_match_status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending, matched, discrepancy

    lines = relationship(
        "PurchaseOrderLine", back_populates="purchase_order", cascade="all, delete-orphan"
    )
    supplier = relationship("InventorySupplier", foreign_keys=[supplier_id])
    blanket_order = relationship("BlanketOrder", back_populates="purchase_orders")


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


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 1 MODELS — Serial Numbers, UoM, Blanket Orders
# ═══════════════════════════════════════════════════════════════════════════════

class UnitOfMeasure(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Unit of measure master (each, kg, liter, carton…)."""
    __tablename__ = "inventory_uom"
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    abbreviation: Mapped[str] = mapped_column(String(20), nullable=False)
    category: Mapped[str] = mapped_column(String(30), default="count")  # count, weight, length, volume, area
    is_base: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    conversions_from = relationship("UoMConversion", foreign_keys="UoMConversion.from_uom_id")


class UoMConversion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Conversion factor between two units (1 carton = 12 each)."""
    __tablename__ = "inventory_uom_conversions"
    __table_args__ = (UniqueConstraint("from_uom_id", "to_uom_id", "item_id", name="uq_uom_conversion"),)
    from_uom_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_uom.id"), nullable=False)
    to_uom_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_uom.id"), nullable=False)
    factor: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=True)
    from_uom = relationship("UnitOfMeasure", foreign_keys=[from_uom_id])
    to_uom = relationship("UnitOfMeasure", foreign_keys=[to_uom_id])


class BlanketOrder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Long-term framework agreement with a supplier covering multiple POs."""
    __tablename__ = "inventory_blanket_orders"
    bo_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    supplier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_suppliers.id"), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_value_limit: Mapped[Decimal | None] = mapped_column(Numeric(16, 2), nullable=True)
    released_value: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=0)
    status: Mapped[str] = mapped_column(String(20), default="active")  # draft, active, exhausted, expired, cancelled
    terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    supplier = relationship("InventorySupplier")
    purchase_orders = relationship("PurchaseOrder", back_populates="blanket_order")


class SerialNumber(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One physical unit tracked by serial number."""
    __tablename__ = "inventory_serial_numbers"
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False)
    serial_no: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    warehouse_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=True)
    batch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_batch_numbers.id"), nullable=True)
    purchase_order_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_purchase_orders.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="available")  # available, reserved, sold, returned, scrapped
    sold_to_reference: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    item = relationship("InventoryItem")
    warehouse = relationship("Warehouse")
    batch = relationship("BatchNumber")


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 2 MODELS — Warehouse Zones, Bins, Pick-Pack-Ship
# ═══════════════════════════════════════════════════════════════════════════════

class WarehouseZone(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Logical zone inside a warehouse (receiving, storage, picking…)."""
    __tablename__ = "inventory_warehouse_zones"
    warehouse_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    zone_type: Mapped[str] = mapped_column(String(30), default="storage")  # receiving, storage, picking, packing, shipping, quality
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    warehouse = relationship("Warehouse")
    bins = relationship("WarehouseBin", back_populates="zone")


class WarehouseBin(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Individual bin / shelf / rack location within a zone."""
    __tablename__ = "inventory_warehouse_bins"
    __table_args__ = (UniqueConstraint("warehouse_id", "bin_code", name="uq_bin_code_per_warehouse"),)
    zone_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_warehouse_zones.id"), nullable=False)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False)
    bin_code: Mapped[str] = mapped_column(String(50), nullable=False)
    bin_type: Mapped[str] = mapped_column(String(30), default="standard")  # standard, bulk, refrigerated, hazmat
    max_weight: Mapped[Decimal | None] = mapped_column(Numeric(10, 3), nullable=True)
    max_volume: Mapped[Decimal | None] = mapped_column(Numeric(10, 3), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    zone = relationship("WarehouseZone", back_populates="bins")
    warehouse = relationship("Warehouse")
    contents = relationship("BinContent", back_populates="bin")


class BinContent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Current stock of an item in a specific bin."""
    __tablename__ = "inventory_bin_contents"
    __table_args__ = (UniqueConstraint("bin_id", "item_id", "variant_id", "batch_id", name="uq_bin_content"),)
    bin_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_warehouse_bins.id"), nullable=False)
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False)
    variant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_item_variants.id"), nullable=True)
    batch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_batch_numbers.id"), nullable=True)
    serial_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_serial_numbers.id"), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    bin = relationship("WarehouseBin", back_populates="contents")
    item = relationship("InventoryItem")


class PutawayRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Rule for automatically directing incoming stock to a zone/bin."""
    __tablename__ = "inventory_putaway_rules"
    warehouse_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False)
    item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    zone_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_warehouse_zones.id"), nullable=True)
    bin_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_warehouse_bins.id"), nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=10)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    warehouse = relationship("Warehouse")
    item = relationship("InventoryItem")


class PickList(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Pick list for fulfilling a sales order or transfer."""
    __tablename__ = "inventory_pick_lists"
    pick_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, in_progress, picked, packed, shipped
    pick_strategy: Mapped[str] = mapped_column(String(20), default="fifo")  # fifo, fefo, lifo, zone_priority
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reference_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    warehouse = relationship("Warehouse")
    lines = relationship("PickListLine", back_populates="pick_list", cascade="all, delete-orphan")


class PickListLine(UUIDPrimaryKeyMixin, Base):
    """Single pick task line on a pick list."""
    __tablename__ = "inventory_pick_list_lines"
    pick_list_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_pick_lists.id"), nullable=False)
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False)
    bin_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_warehouse_bins.id"), nullable=True)
    batch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_batch_numbers.id"), nullable=True)
    serial_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_serial_numbers.id"), nullable=True)
    quantity_requested: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_picked: Mapped[int] = mapped_column(Integer, default=0)
    pick_list = relationship("PickList", back_populates="lines")
    item = relationship("InventoryItem")


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 3 MODELS — Replenishment, ABC/XYZ
# ═══════════════════════════════════════════════════════════════════════════════

class PurchaseSuggestion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """AI/rule generated suggestion to create a purchase order."""
    __tablename__ = "inventory_purchase_suggestions"
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False)
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_suppliers.id"), nullable=True)
    suggested_qty: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, accepted, dismissed
    item = relationship("InventoryItem")
    warehouse = relationship("Warehouse")
    supplier = relationship("InventorySupplier")


class ItemClassification(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """ABC/XYZ classification for an item per warehouse."""
    __tablename__ = "inventory_item_classifications"
    __table_args__ = (UniqueConstraint("item_id", "warehouse_id", name="uq_item_classification"),)
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False)
    abc_class: Mapped[str | None] = mapped_column(String(1), nullable=True)
    xyz_class: Mapped[str | None] = mapped_column(String(1), nullable=True)
    combined_class: Mapped[str | None] = mapped_column(String(2), nullable=True)
    annual_consumption_value: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=0)
    demand_variability: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    calculated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    item = relationship("InventoryItem")
    warehouse = relationship("Warehouse")


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 4 MODELS — Kits, Supplier Pricing, Landed Costs
# ═══════════════════════════════════════════════════════════════════════════════

class Kit(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Kit / bundle definition (e.g. Starter Pack = 3 items assembled together)."""
    __tablename__ = "inventory_kits"
    kit_item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    kit_item = relationship("InventoryItem", foreign_keys=[kit_item_id])
    components = relationship("KitComponent", back_populates="kit", cascade="all, delete-orphan")


class KitComponent(UUIDPrimaryKeyMixin, Base):
    """Single component within a kit."""
    __tablename__ = "inventory_kit_components"
    kit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_kits.id"), nullable=False)
    component_item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    is_optional: Mapped[bool] = mapped_column(Boolean, default=False)
    kit = relationship("Kit", back_populates="components")
    component_item = relationship("InventoryItem", foreign_keys=[component_item_id])


class SupplierPriceList(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Price list entry from a supplier for a specific item."""
    __tablename__ = "inventory_supplier_prices"
    supplier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_suppliers.id"), nullable=False)
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    min_order_qty: Mapped[int] = mapped_column(Integer, default=1)
    lead_time_days: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    supplier = relationship("InventorySupplier")
    item = relationship("InventoryItem")


class LandedCostVoucher(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Voucher to allocate additional landed costs to received goods."""
    __tablename__ = "inventory_landed_cost_vouchers"
    voucher_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    purchase_order_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_purchase_orders.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft, applied, cancelled
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    cost_lines = relationship("LandedCostLine", back_populates="voucher", cascade="all, delete-orphan")
    allocations = relationship("LandedCostAllocation", back_populates="voucher", cascade="all, delete-orphan")


class LandedCostLine(UUIDPrimaryKeyMixin, Base):
    """Single cost component on a landed cost voucher."""
    __tablename__ = "inventory_landed_cost_lines"
    voucher_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_landed_cost_vouchers.id"), nullable=False)
    cost_type: Mapped[str] = mapped_column(String(50), nullable=False)  # freight, insurance, duty, customs, handling
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    voucher = relationship("LandedCostVoucher", back_populates="cost_lines")


class LandedCostAllocation(UUIDPrimaryKeyMixin, Base):
    """Allocation of landed cost to a specific received item."""
    __tablename__ = "inventory_landed_cost_allocations"
    voucher_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_landed_cost_vouchers.id"), nullable=False)
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False)
    allocated_amount: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    allocation_method: Mapped[str] = mapped_column(String(20), default="by_value")  # by_value, by_qty, by_weight
    voucher = relationship("LandedCostVoucher", back_populates="allocations")
    item = relationship("InventoryItem")


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 5 MODELS — Costing & Audit Trail
# ═══════════════════════════════════════════════════════════════════════════════

class CostingConfig(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Per-item costing method configuration."""
    __tablename__ = "inventory_costing_config"
    __table_args__ = (UniqueConstraint("item_id", name="uq_costing_config_item"),)
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False)
    method: Mapped[str] = mapped_column(String(20), default="average")  # fifo, lifo, average, standard, specific
    standard_cost: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    last_updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    item = relationship("InventoryItem")


class CostLayer(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Immutable FIFO/LIFO cost layer — quantity_remaining decreases on issue."""
    __tablename__ = "inventory_cost_layers"
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False)
    purchase_order_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_purchase_orders.id"), nullable=True)
    quantity_received: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_remaining: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    receipt_date: Mapped[date] = mapped_column(Date, nullable=False)
    item = relationship("InventoryItem")
    warehouse = relationship("Warehouse")


class InventoryAuditTrail(UUIDPrimaryKeyMixin, Base):
    """Field-level change log for inventory entities."""
    __tablename__ = "inventory_audit_trail"
    __table_args__ = (Index("ix_inv_audit_entity", "entity_type", "entity_id"),)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 6 MODELS — Automation Rules
# ═══════════════════════════════════════════════════════════════════════════════

class InventoryAutomationRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Automation rule triggered by inventory events."""
    __tablename__ = "inventory_automation_rules"
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    trigger_event: Mapped[str] = mapped_column(String(50), nullable=False)  # stock_below_reorder, po_received, count_discrepancy, expiry_approaching
    conditions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)  # create_po, send_alert, update_bin, adjust_stock
    action_config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_triggered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
