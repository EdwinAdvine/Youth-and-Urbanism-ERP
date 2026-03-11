"""Supply Chain models — suppliers, procurement requisitions, GRNs, supplier returns."""
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
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# ── Supplier ─────────────────────────────────────────────────────────────────
class Supplier(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Registered supplier / vendor."""

    __tablename__ = "sc_suppliers"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    contact_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_terms: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # net30, net60, cod
    payment_terms_days: Mapped[int] = mapped_column(Integer, default=30)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-5
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_contacts.id"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )


# ── ProcurementRequisition ───────────────────────────────────────────────────
class ProcurementRequisition(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Internal purchase request before a PO is created."""

    __tablename__ = "sc_requisitions"

    requisition_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    requested_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_departments.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(30), default="draft"
    )  # draft, submitted, approved, rejected, converted_to_po
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    priority: Mapped[str] = mapped_column(String(20), default="medium")  # low, medium, high, urgent
    required_by_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_estimated: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    lines = relationship(
        "RequisitionLine", back_populates="requisition", cascade="all, delete-orphan"
    )


# ── RequisitionLine ──────────────────────────────────────────────────────────
class RequisitionLine(UUIDPrimaryKeyMixin, Base):
    """Single line on a procurement requisition."""

    __tablename__ = "sc_requisition_lines"

    requisition_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_requisitions.id"), nullable=False
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    estimated_unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_suppliers.id"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    requisition = relationship("ProcurementRequisition", back_populates="lines")
    item = relationship("InventoryItem")
    supplier = relationship("Supplier")


# ── GoodsReceivedNote ────────────────────────────────────────────────────────
class GoodsReceivedNote(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Goods received note — records delivery against a purchase order."""

    __tablename__ = "sc_goods_received_notes"

    grn_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    purchase_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_purchase_orders.id"), nullable=False
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_suppliers.id"), nullable=False
    )
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False
    )
    received_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    received_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, inspecting, accepted, partial, rejected
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    lines = relationship(
        "GRNLine", back_populates="grn", cascade="all, delete-orphan"
    )
    purchase_order = relationship("PurchaseOrder")
    supplier = relationship("Supplier")
    warehouse = relationship("Warehouse")


# ── GRNLine ──────────────────────────────────────────────────────────────────
class GRNLine(UUIDPrimaryKeyMixin, Base):
    """Single line on a GRN — tracks ordered vs received vs accepted."""

    __tablename__ = "sc_grn_lines"

    grn_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_goods_received_notes.id"), nullable=False
    )
    po_line_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_purchase_order_lines.id"), nullable=False
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    ordered_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    received_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    accepted_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    rejected_quantity: Mapped[int] = mapped_column(Integer, default=0)
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    grn = relationship("GoodsReceivedNote", back_populates="lines")
    item = relationship("InventoryItem")


# ── SupplierReturn ───────────────────────────────────────────────────────────
class SupplierReturn(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Return of goods back to a supplier."""

    __tablename__ = "sc_supplier_returns"

    return_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_suppliers.id"), nullable=False
    )
    grn_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_goods_received_notes.id"), nullable=True
    )
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(30), default="draft"
    )  # draft, pending_approval, approved, shipped, completed, cancelled
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    total_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    lines = relationship(
        "SupplierReturnLine", back_populates="supplier_return", cascade="all, delete-orphan"
    )
    supplier = relationship("Supplier")
    warehouse = relationship("Warehouse")


# ── SupplierReturnLine ───────────────────────────────────────────────────────
class SupplierReturnLine(UUIDPrimaryKeyMixin, Base):
    """Single line on a supplier return."""

    __tablename__ = "sc_supplier_return_lines"

    return_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_supplier_returns.id"), nullable=False
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    supplier_return = relationship("SupplierReturn", back_populates="lines")
    item = relationship("InventoryItem")
