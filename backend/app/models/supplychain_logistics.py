"""supplychain_logistics.py — Supply Chain Phase 2 Logistics models.

Models:
  - Carrier           — freight carrier / 3PL
  - Route             — defined shipping lane (origin → destination)
  - TransportOrder    — a shipment linked to a PO or SO
  - FreightCost       — cost breakdown per transport order
  - DockSchedule      — inbound/outbound dock appointment
  - YardSlot          — yard management (trailer/container parking slots)
"""
from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


# ── Carrier ───────────────────────────────────────────────────────────────────
class Carrier(Base):
    __tablename__ = "sc_carriers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    code: Mapped[str | None] = mapped_column(sa.String(50), unique=True, nullable=True)
    carrier_type: Mapped[str] = mapped_column(sa.String(50), nullable=False, default="road")
    # road | air | sea | rail | courier
    scac_code: Mapped[str | None] = mapped_column(sa.String(10), nullable=True)   # Standard Carrier Alpha Code
    contact_email: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(sa.String(50), nullable=True)
    api_endpoint: Mapped[str | None] = mapped_column(sa.String(500), nullable=True)
    api_key_encrypted: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    tracking_url_template: Mapped[str | None] = mapped_column(sa.String(500), nullable=True)
    # {tracking_number} placeholder
    service_levels: Mapped[list | None] = mapped_column(sa.JSON, nullable=True)
    # ["standard", "express", "overnight"]
    is_active: Mapped[bool] = mapped_column(sa.Boolean, default=True)
    rating: Mapped[float | None] = mapped_column(sa.Float, nullable=True)        # 0-5 performance score
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )


# ── Route ─────────────────────────────────────────────────────────────────────
class Route(Base):
    __tablename__ = "sc_routes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    carrier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_carriers.id", ondelete="SET NULL"), nullable=True
    )
    origin_location: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    destination_location: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    origin_country: Mapped[str | None] = mapped_column(sa.String(3), nullable=True)  # ISO 3166-1 alpha-3
    destination_country: Mapped[str | None] = mapped_column(sa.String(3), nullable=True)
    transit_days: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    transport_mode: Mapped[str] = mapped_column(sa.String(50), nullable=False, default="road")
    distance_km: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
    base_cost: Mapped[float | None] = mapped_column(sa.Numeric(12, 2), nullable=True)
    currency: Mapped[str] = mapped_column(sa.String(3), nullable=False, default="USD")
    waypoints: Mapped[list | None] = mapped_column(sa.JSON, nullable=True)  # list of intermediate stops
    is_active: Mapped[bool] = mapped_column(sa.Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )


# ── TransportOrder ────────────────────────────────────────────────────────────
class TransportOrder(Base):
    __tablename__ = "sc_transport_orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference: Mapped[str] = mapped_column(sa.String(100), unique=True, nullable=False)
    carrier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_carriers.id", ondelete="SET NULL"), nullable=True
    )
    route_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_routes.id", ondelete="SET NULL"), nullable=True
    )
    # Links to source documents
    purchase_order_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    sales_order_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    # Status lifecycle
    status: Mapped[str] = mapped_column(sa.String(50), nullable=False, default="draft")
    # draft | confirmed | picked_up | in_transit | out_for_delivery | delivered | cancelled
    service_level: Mapped[str | None] = mapped_column(sa.String(50), nullable=True)
    tracking_number: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    # Addresses
    shipper_address: Mapped[dict | None] = mapped_column(sa.JSON, nullable=True)
    consignee_address: Mapped[dict | None] = mapped_column(sa.JSON, nullable=True)
    # Cargo details
    weight_kg: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
    volume_m3: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
    package_count: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    items: Mapped[list | None] = mapped_column(sa.JSON, nullable=True)  # [{product_id, qty, weight_kg}]
    # Dates
    pickup_date: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    estimated_delivery: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    actual_delivery: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    # Tracking events log
    tracking_events: Mapped[list | None] = mapped_column(sa.JSON, nullable=True)
    # [{timestamp, location, status, notes}]
    special_instructions: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )


# ── FreightCost ───────────────────────────────────────────────────────────────
class FreightCost(Base):
    __tablename__ = "sc_freight_costs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transport_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_transport_orders.id", ondelete="CASCADE"), nullable=False
    )
    cost_type: Mapped[str] = mapped_column(sa.String(50), nullable=False)
    # freight | fuel_surcharge | handling | customs | insurance | other
    amount: Mapped[float] = mapped_column(sa.Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(sa.String(3), nullable=False, default="USD")
    invoiced: Mapped[bool] = mapped_column(sa.Boolean, default=False)
    invoice_reference: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())


# ── DockSchedule ──────────────────────────────────────────────────────────────
class DockSchedule(Base):
    __tablename__ = "sc_dock_schedules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transport_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_transport_orders.id", ondelete="SET NULL"), nullable=True
    )
    dock_door: Mapped[str] = mapped_column(sa.String(50), nullable=False)  # "D01", "D02", etc.
    direction: Mapped[str] = mapped_column(sa.String(20), nullable=False, default="inbound")
    # inbound | outbound
    scheduled_start: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
    scheduled_end: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
    actual_arrival: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    actual_departure: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(sa.String(30), nullable=False, default="scheduled")
    # scheduled | arrived | loading | departed | cancelled
    carrier_name: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    driver_name: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    trailer_number: Mapped[str | None] = mapped_column(sa.String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )


# ── YardSlot ──────────────────────────────────────────────────────────────────
class YardSlot(Base):
    __tablename__ = "sc_yard_slots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slot_code: Mapped[str] = mapped_column(sa.String(50), unique=True, nullable=False)  # "Y-A01"
    zone: Mapped[str | None] = mapped_column(sa.String(50), nullable=True)              # "A", "B", "Hazmat"
    slot_type: Mapped[str] = mapped_column(sa.String(50), nullable=False, default="trailer")
    # trailer | container | flatbed | refrigerated
    capacity_tons: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
    status: Mapped[str] = mapped_column(sa.String(30), nullable=False, default="available")
    # available | occupied | reserved | maintenance
    occupied_by_transport_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sc_transport_orders.id", ondelete="SET NULL"), nullable=True
    )
    occupied_since: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    reserved_until: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )
