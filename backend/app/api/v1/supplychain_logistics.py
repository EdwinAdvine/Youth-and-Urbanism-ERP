"""supplychain_logistics.py — Supply Chain Phase 2 Logistics router.

Endpoints (~18) covering:
  - Carriers          CRUD + soft-delete
  - Routes            CRUD + hard-delete
  - Transport Orders  list / create / get / status-update / tracking-event / freight costs
  - Dock Schedules    list / create / update (with dock-door conflict check)
  - Yard Slots        list / assign / release
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.supplychain_logistics import (
    Carrier,
    DockSchedule,
    FreightCost,
    Route,
    TransportOrder,
    YardSlot,
)

router = APIRouter(tags=["Supply Chain Logistics"])

# ── Allowed status transitions ────────────────────────────────────────────────
_TO_TRANSITIONS: dict[str, list[str]] = {
    "draft":              ["confirmed", "cancelled"],
    "confirmed":          ["picked_up", "cancelled"],
    "picked_up":          ["in_transit", "cancelled"],
    "in_transit":         ["out_for_delivery", "delivered", "cancelled"],
    "out_for_delivery":   ["delivered", "cancelled"],
    "delivered":          [],
    "cancelled":          [],
}


# ═══════════════════════════════════════════════════════════════════════════════
# Pydantic Schemas
# ═══════════════════════════════════════════════════════════════════════════════

# ── Carrier ───────────────────────────────────────────────────────────────────
class CarrierCreate(BaseModel):
    name: str
    code: str | None = None
    carrier_type: str = "road"
    scac_code: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    api_endpoint: str | None = None
    api_key_encrypted: str | None = None
    tracking_url_template: str | None = None
    service_levels: list | None = None
    rating: float | None = None
    notes: str | None = None


class CarrierUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    carrier_type: str | None = None
    scac_code: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    api_endpoint: str | None = None
    api_key_encrypted: str | None = None
    tracking_url_template: str | None = None
    service_levels: list | None = None
    is_active: bool | None = None
    rating: float | None = None
    notes: str | None = None


# ── Route ─────────────────────────────────────────────────────────────────────
class RouteCreate(BaseModel):
    name: str
    carrier_id: uuid.UUID | None = None
    origin_location: str
    destination_location: str
    origin_country: str | None = None
    destination_country: str | None = None
    transit_days: int | None = None
    transport_mode: str = "road"
    distance_km: float | None = None
    base_cost: float | None = None
    currency: str = "USD"
    waypoints: list | None = None
    is_active: bool = True


class RouteUpdate(BaseModel):
    name: str | None = None
    carrier_id: uuid.UUID | None = None
    origin_location: str | None = None
    destination_location: str | None = None
    origin_country: str | None = None
    destination_country: str | None = None
    transit_days: int | None = None
    transport_mode: str | None = None
    distance_km: float | None = None
    base_cost: float | None = None
    currency: str | None = None
    waypoints: list | None = None
    is_active: bool | None = None


# ── Transport Order ───────────────────────────────────────────────────────────
class TransportOrderCreate(BaseModel):
    carrier_id: uuid.UUID | None = None
    route_id: uuid.UUID | None = None
    purchase_order_id: uuid.UUID | None = None
    sales_order_id: uuid.UUID | None = None
    service_level: str | None = None
    tracking_number: str | None = None
    shipper_address: dict | None = None
    consignee_address: dict | None = None
    weight_kg: float | None = None
    volume_m3: float | None = None
    package_count: int | None = None
    items: list | None = None
    pickup_date: datetime | None = None
    estimated_delivery: datetime | None = None
    special_instructions: str | None = None


class TransportOrderStatusUpdate(BaseModel):
    status: str


class TrackingEventCreate(BaseModel):
    location: str
    status: str
    notes: str | None = None


# ── Freight Cost ──────────────────────────────────────────────────────────────
class FreightCostCreate(BaseModel):
    cost_type: str
    amount: float
    currency: str = "USD"
    invoiced: bool = False
    invoice_reference: str | None = None
    notes: str | None = None


# ── Dock Schedule ─────────────────────────────────────────────────────────────
class DockScheduleCreate(BaseModel):
    transport_order_id: uuid.UUID | None = None
    dock_door: str
    direction: str = "inbound"
    scheduled_start: datetime
    scheduled_end: datetime
    actual_arrival: datetime | None = None
    actual_departure: datetime | None = None
    status: str = "scheduled"
    carrier_name: str | None = None
    driver_name: str | None = None
    trailer_number: str | None = None
    notes: str | None = None


class DockScheduleUpdate(BaseModel):
    transport_order_id: uuid.UUID | None = None
    dock_door: str | None = None
    direction: str | None = None
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    actual_arrival: datetime | None = None
    actual_departure: datetime | None = None
    status: str | None = None
    carrier_name: str | None = None
    driver_name: str | None = None
    trailer_number: str | None = None
    notes: str | None = None


# ── Yard Slot ─────────────────────────────────────────────────────────────────
class YardSlotAssign(BaseModel):
    transport_order_id: uuid.UUID


# ═══════════════════════════════════════════════════════════════════════════════
# Carriers
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/logistics/carriers")
async def list_carriers(
    db: DBSession,
    user: CurrentUser,
    is_active: bool | None = None,
    carrier_type: str | None = None,
):
    """List all carriers with optional filters."""
    stmt = select(Carrier)
    if is_active is not None:
        stmt = stmt.where(Carrier.is_active == is_active)
    if carrier_type:
        stmt = stmt.where(Carrier.carrier_type == carrier_type)
    stmt = stmt.order_by(Carrier.name)
    result = await db.execute(stmt)
    carriers = result.scalars().all()
    return [_carrier_dict(c) for c in carriers]


@router.post("/logistics/carriers", status_code=201)
async def create_carrier(body: CarrierCreate, db: DBSession, user: CurrentUser):
    """Create a new carrier."""
    carrier = Carrier(**body.model_dump())
    db.add(carrier)
    await db.commit()
    await db.refresh(carrier)
    return _carrier_dict(carrier)


@router.get("/logistics/carriers/{carrier_id}")
async def get_carrier(carrier_id: uuid.UUID, db: DBSession, user: CurrentUser):
    """Get a single carrier by ID."""
    carrier = await _get_or_404(db, Carrier, carrier_id)
    return _carrier_dict(carrier)


@router.put("/logistics/carriers/{carrier_id}")
async def update_carrier(carrier_id: uuid.UUID, body: CarrierUpdate, db: DBSession, user: CurrentUser):
    """Update carrier fields."""
    carrier = await _get_or_404(db, Carrier, carrier_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(carrier, field, value)
    await db.commit()
    await db.refresh(carrier)
    return _carrier_dict(carrier)


@router.delete("/logistics/carriers/{carrier_id}", status_code=200)
async def delete_carrier(carrier_id: uuid.UUID, db: DBSession, user: CurrentUser):
    """Soft-delete a carrier by setting is_active=False."""
    carrier = await _get_or_404(db, Carrier, carrier_id)
    carrier.is_active = False
    await db.commit()
    return {"detail": "Carrier deactivated", "id": str(carrier_id)}


# ═══════════════════════════════════════════════════════════════════════════════
# Routes
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/logistics/routes")
async def list_routes(
    db: DBSession,
    user: CurrentUser,
    carrier_id: uuid.UUID | None = None,
    origin_country: str | None = None,
    destination_country: str | None = None,
):
    """List shipping routes with optional filters."""
    stmt = select(Route)
    if carrier_id:
        stmt = stmt.where(Route.carrier_id == carrier_id)
    if origin_country:
        stmt = stmt.where(Route.origin_country == origin_country)
    if destination_country:
        stmt = stmt.where(Route.destination_country == destination_country)
    stmt = stmt.order_by(Route.name)
    result = await db.execute(stmt)
    routes = result.scalars().all()
    return [_route_dict(r) for r in routes]


@router.post("/logistics/routes", status_code=201)
async def create_route(body: RouteCreate, db: DBSession, user: CurrentUser):
    """Create a new shipping route."""
    route = Route(**body.model_dump())
    db.add(route)
    await db.commit()
    await db.refresh(route)
    return _route_dict(route)


@router.get("/logistics/routes/{route_id}")
async def get_route(route_id: uuid.UUID, db: DBSession, user: CurrentUser):
    """Get a single route by ID."""
    route = await _get_or_404(db, Route, route_id)
    return _route_dict(route)


@router.put("/logistics/routes/{route_id}")
async def update_route(route_id: uuid.UUID, body: RouteUpdate, db: DBSession, user: CurrentUser):
    """Update route fields."""
    route = await _get_or_404(db, Route, route_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(route, field, value)
    await db.commit()
    await db.refresh(route)
    return _route_dict(route)


@router.delete("/logistics/routes/{route_id}", status_code=200)
async def delete_route(route_id: uuid.UUID, db: DBSession, user: CurrentUser):
    """Hard-delete a route."""
    route = await _get_or_404(db, Route, route_id)
    await db.delete(route)
    await db.commit()
    return {"detail": "Route deleted", "id": str(route_id)}


# ═══════════════════════════════════════════════════════════════════════════════
# Transport Orders
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/logistics/transport-orders")
async def list_transport_orders(
    db: DBSession,
    user: CurrentUser,
    status: str | None = None,
    carrier_id: uuid.UUID | None = None,
):
    """List transport orders with optional filters."""
    stmt = select(TransportOrder)
    if status:
        stmt = stmt.where(TransportOrder.status == status)
    if carrier_id:
        stmt = stmt.where(TransportOrder.carrier_id == carrier_id)
    stmt = stmt.order_by(TransportOrder.created_at.desc())
    result = await db.execute(stmt)
    orders = result.scalars().all()
    return [_to_dict(o) for o in orders]


@router.post("/logistics/transport-orders", status_code=201)
async def create_transport_order(body: TransportOrderCreate, db: DBSession, user: CurrentUser):
    """Create a transport order with an auto-generated reference (TO-YYYYMMDD-xxxxxxxx)."""
    now = datetime.now(tz=timezone.utc)
    date_part = now.strftime("%Y%m%d")
    hex_part = uuid.uuid4().hex[:8].upper()
    reference = f"TO-{date_part}-{hex_part}"

    order = TransportOrder(
        reference=reference,
        created_by=user.id,
        **body.model_dump(),
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return _to_dict(order)


@router.get("/logistics/transport-orders/{order_id}")
async def get_transport_order(order_id: uuid.UUID, db: DBSession, user: CurrentUser):
    """Get a single transport order by ID."""
    order = await _get_or_404(db, TransportOrder, order_id)
    return _to_dict(order)


@router.put("/logistics/transport-orders/{order_id}/status")
async def update_transport_order_status(
    order_id: uuid.UUID,
    body: TransportOrderStatusUpdate,
    db: DBSession,
    user: CurrentUser,
):
    """Update transport order status (validated transitions only)."""
    order = await _get_or_404(db, TransportOrder, order_id)
    allowed = _TO_TRANSITIONS.get(order.status, [])
    if body.status not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"Cannot transition from '{order.status}' to '{body.status}'. "
                   f"Allowed: {allowed}",
        )
    order.status = body.status
    if body.status == "delivered" and order.actual_delivery is None:
        order.actual_delivery = datetime.now(tz=timezone.utc)
    await db.commit()
    await db.refresh(order)
    return _to_dict(order)


@router.post("/logistics/transport-orders/{order_id}/tracking-event")
async def append_tracking_event(
    order_id: uuid.UUID,
    body: TrackingEventCreate,
    db: DBSession,
    user: CurrentUser,
):
    """Append a new tracking event to the order's tracking_events JSON array."""
    order = await _get_or_404(db, TransportOrder, order_id)
    event = {
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        "location": body.location,
        "status": body.status,
        "notes": body.notes,
        "recorded_by": str(user.id),
    }
    existing: list = list(order.tracking_events or [])
    existing.append(event)
    order.tracking_events = existing
    await db.commit()
    await db.refresh(order)
    return {"tracking_events": order.tracking_events}


@router.get("/logistics/transport-orders/{order_id}/freight-costs")
async def list_freight_costs(order_id: uuid.UUID, db: DBSession, user: CurrentUser):
    """List all freight cost lines for a transport order."""
    await _get_or_404(db, TransportOrder, order_id)
    stmt = select(FreightCost).where(FreightCost.transport_order_id == order_id).order_by(FreightCost.created_at)
    result = await db.execute(stmt)
    costs = result.scalars().all()
    return [_fc_dict(fc) for fc in costs]


@router.post("/logistics/transport-orders/{order_id}/freight-costs", status_code=201)
async def add_freight_cost(
    order_id: uuid.UUID,
    body: FreightCostCreate,
    db: DBSession,
    user: CurrentUser,
):
    """Add a freight cost line to a transport order."""
    await _get_or_404(db, TransportOrder, order_id)
    fc = FreightCost(transport_order_id=order_id, **body.model_dump())
    db.add(fc)
    await db.commit()
    await db.refresh(fc)
    return _fc_dict(fc)


# ═══════════════════════════════════════════════════════════════════════════════
# Dock Schedules
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/logistics/dock-schedules")
async def list_dock_schedules(
    db: DBSession,
    user: CurrentUser,
    direction: str | None = None,
    status: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
):
    """List dock appointments with optional direction, status, and date-range filters."""
    stmt = select(DockSchedule)
    if direction:
        stmt = stmt.where(DockSchedule.direction == direction)
    if status:
        stmt = stmt.where(DockSchedule.status == status)
    if date_from:
        stmt = stmt.where(DockSchedule.scheduled_start >= date_from)
    if date_to:
        stmt = stmt.where(DockSchedule.scheduled_end <= date_to)
    stmt = stmt.order_by(DockSchedule.scheduled_start)
    result = await db.execute(stmt)
    schedules = result.scalars().all()
    return [_dock_dict(s) for s in schedules]


@router.post("/logistics/dock-schedules", status_code=201)
async def create_dock_schedule(body: DockScheduleCreate, db: DBSession, user: CurrentUser):
    """Create a dock appointment. No conflict check on creation (use update to resolve)."""
    schedule = DockSchedule(created_by=user.id, **body.model_dump())
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return _dock_dict(schedule)


@router.put("/logistics/dock-schedules/{schedule_id}")
async def update_dock_schedule(
    schedule_id: uuid.UUID,
    body: DockScheduleUpdate,
    db: DBSession,
    user: CurrentUser,
):
    """Update a dock schedule. Checks for dock-door time-window conflicts."""
    schedule = await _get_or_404(db, DockSchedule, schedule_id)

    updates = body.model_dump(exclude_unset=True)

    # Determine the effective door and time window after this update
    effective_door = updates.get("dock_door", schedule.dock_door)
    effective_start = updates.get("scheduled_start", schedule.scheduled_start)
    effective_end = updates.get("scheduled_end", schedule.scheduled_end)

    # Conflict check: same dock_door, overlapping time, different record
    conflict_stmt = (
        select(DockSchedule)
        .where(DockSchedule.dock_door == effective_door)
        .where(DockSchedule.id != schedule_id)
        .where(DockSchedule.status.not_in(["cancelled"]))
        .where(DockSchedule.scheduled_start < effective_end)
        .where(DockSchedule.scheduled_end > effective_start)
    )
    conflict_result = await db.execute(conflict_stmt)
    conflict = conflict_result.scalars().first()
    if conflict:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Dock door '{effective_door}' is already booked "
                f"between {conflict.scheduled_start.isoformat()} and "
                f"{conflict.scheduled_end.isoformat()} (schedule id: {conflict.id})."
            ),
        )

    for field, value in updates.items():
        setattr(schedule, field, value)
    await db.commit()
    await db.refresh(schedule)
    return _dock_dict(schedule)


# ═══════════════════════════════════════════════════════════════════════════════
# Yard Slots
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/logistics/yard-slots")
async def list_yard_slots(db: DBSession, user: CurrentUser, zone: str | None = None, status: str | None = None):
    """List all yard slots with their current status."""
    stmt = select(YardSlot)
    if zone:
        stmt = stmt.where(YardSlot.zone == zone)
    if status:
        stmt = stmt.where(YardSlot.status == status)
    stmt = stmt.order_by(YardSlot.slot_code)
    result = await db.execute(stmt)
    slots = result.scalars().all()
    return [_slot_dict(s) for s in slots]


@router.put("/logistics/yard-slots/{slot_id}/assign")
async def assign_yard_slot(slot_id: uuid.UUID, body: YardSlotAssign, db: DBSession, user: CurrentUser):
    """Assign a transport order to a yard slot (slot must be available)."""
    slot = await _get_or_404(db, YardSlot, slot_id)
    if slot.status != "available":
        raise HTTPException(
            status_code=409,
            detail=f"Yard slot '{slot.slot_code}' is not available (current status: '{slot.status}').",
        )
    # Verify the transport order exists
    await _get_or_404(db, TransportOrder, body.transport_order_id)
    slot.status = "occupied"
    slot.occupied_by_transport_id = body.transport_order_id
    slot.occupied_since = datetime.now(tz=timezone.utc)
    await db.commit()
    await db.refresh(slot)
    return _slot_dict(slot)


@router.put("/logistics/yard-slots/{slot_id}/release")
async def release_yard_slot(slot_id: uuid.UUID, db: DBSession, user: CurrentUser):
    """Release an occupied yard slot back to available."""
    slot = await _get_or_404(db, YardSlot, slot_id)
    if slot.status not in ("occupied", "reserved"):
        raise HTTPException(
            status_code=409,
            detail=f"Yard slot '{slot.slot_code}' is not occupied or reserved (status: '{slot.status}').",
        )
    slot.status = "available"
    slot.occupied_by_transport_id = None
    slot.occupied_since = None
    slot.reserved_until = None
    await db.commit()
    await db.refresh(slot)
    return _slot_dict(slot)


# ═══════════════════════════════════════════════════════════════════════════════
# Internal helpers
# ═══════════════════════════════════════════════════════════════════════════════

async def _get_or_404(db, model, record_id: uuid.UUID):
    result = await db.execute(select(model).where(model.id == record_id))
    obj = result.scalars().first()
    if obj is None:
        raise HTTPException(status_code=404, detail=f"{model.__name__} {record_id} not found.")
    return obj


def _carrier_dict(c: Carrier) -> dict:
    return {
        "id": str(c.id),
        "name": c.name,
        "code": c.code,
        "carrier_type": c.carrier_type,
        "scac_code": c.scac_code,
        "contact_email": c.contact_email,
        "contact_phone": c.contact_phone,
        "api_endpoint": c.api_endpoint,
        "tracking_url_template": c.tracking_url_template,
        "service_levels": c.service_levels,
        "is_active": c.is_active,
        "rating": c.rating,
        "notes": c.notes,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def _route_dict(r: Route) -> dict:
    return {
        "id": str(r.id),
        "name": r.name,
        "carrier_id": str(r.carrier_id) if r.carrier_id else None,
        "origin_location": r.origin_location,
        "destination_location": r.destination_location,
        "origin_country": r.origin_country,
        "destination_country": r.destination_country,
        "transit_days": r.transit_days,
        "transport_mode": r.transport_mode,
        "distance_km": r.distance_km,
        "base_cost": float(r.base_cost) if r.base_cost is not None else None,
        "currency": r.currency,
        "waypoints": r.waypoints,
        "is_active": r.is_active,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def _to_dict(o: TransportOrder) -> dict:
    return {
        "id": str(o.id),
        "reference": o.reference,
        "carrier_id": str(o.carrier_id) if o.carrier_id else None,
        "route_id": str(o.route_id) if o.route_id else None,
        "purchase_order_id": str(o.purchase_order_id) if o.purchase_order_id else None,
        "sales_order_id": str(o.sales_order_id) if o.sales_order_id else None,
        "status": o.status,
        "service_level": o.service_level,
        "tracking_number": o.tracking_number,
        "shipper_address": o.shipper_address,
        "consignee_address": o.consignee_address,
        "weight_kg": o.weight_kg,
        "volume_m3": o.volume_m3,
        "package_count": o.package_count,
        "items": o.items,
        "pickup_date": o.pickup_date.isoformat() if o.pickup_date else None,
        "estimated_delivery": o.estimated_delivery.isoformat() if o.estimated_delivery else None,
        "actual_delivery": o.actual_delivery.isoformat() if o.actual_delivery else None,
        "tracking_events": o.tracking_events,
        "special_instructions": o.special_instructions,
        "created_by": str(o.created_by) if o.created_by else None,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
    }


def _fc_dict(fc: FreightCost) -> dict:
    return {
        "id": str(fc.id),
        "transport_order_id": str(fc.transport_order_id),
        "cost_type": fc.cost_type,
        "amount": float(fc.amount),
        "currency": fc.currency,
        "invoiced": fc.invoiced,
        "invoice_reference": fc.invoice_reference,
        "notes": fc.notes,
        "created_at": fc.created_at.isoformat() if fc.created_at else None,
    }


def _dock_dict(s: DockSchedule) -> dict:
    return {
        "id": str(s.id),
        "transport_order_id": str(s.transport_order_id) if s.transport_order_id else None,
        "dock_door": s.dock_door,
        "direction": s.direction,
        "scheduled_start": s.scheduled_start.isoformat() if s.scheduled_start else None,
        "scheduled_end": s.scheduled_end.isoformat() if s.scheduled_end else None,
        "actual_arrival": s.actual_arrival.isoformat() if s.actual_arrival else None,
        "actual_departure": s.actual_departure.isoformat() if s.actual_departure else None,
        "status": s.status,
        "carrier_name": s.carrier_name,
        "driver_name": s.driver_name,
        "trailer_number": s.trailer_number,
        "notes": s.notes,
        "created_by": str(s.created_by) if s.created_by else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


def _slot_dict(s: YardSlot) -> dict:
    return {
        "id": str(s.id),
        "slot_code": s.slot_code,
        "zone": s.zone,
        "slot_type": s.slot_type,
        "capacity_tons": s.capacity_tons,
        "status": s.status,
        "occupied_by_transport_id": str(s.occupied_by_transport_id) if s.occupied_by_transport_id else None,
        "occupied_since": s.occupied_since.isoformat() if s.occupied_since else None,
        "reserved_until": s.reserved_until.isoformat() if s.reserved_until else None,
        "notes": s.notes,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }
