"""KDS API — Kitchen Display System: stations, orders, order items, real-time WebSocket."""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.models.kds import KDSOrder, KDSOrderItem, KDSStation

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

# -- Stations --

class StationIn(BaseModel):
    name: str
    station_type: str = "kitchen"
    warehouse_id: uuid.UUID
    is_active: bool = True


class StationOut(BaseModel):
    id: uuid.UUID
    name: str
    station_type: str
    warehouse_id: uuid.UUID
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class StationUpdateIn(BaseModel):
    name: str | None = None
    station_type: str | None = None
    warehouse_id: uuid.UUID | None = None
    is_active: bool | None = None


# -- Order Items --

class OrderItemIn(BaseModel):
    line_id: uuid.UUID | None = None
    item_name: str
    quantity: int
    modifiers: dict[str, Any] | None = None
    notes: str | None = None


class OrderItemOut(BaseModel):
    id: uuid.UUID
    kds_order_id: uuid.UUID
    line_id: uuid.UUID | None
    item_name: str
    quantity: int
    modifiers: dict[str, Any] | None
    notes: str | None
    status: str

    model_config = {"from_attributes": True}


# -- Orders --

class OrderCreateIn(BaseModel):
    transaction_id: uuid.UUID
    station_id: uuid.UUID
    priority: int = 0
    items: list[OrderItemIn]


class OrderOut(BaseModel):
    id: uuid.UUID
    transaction_id: uuid.UUID
    station_id: uuid.UUID
    status: str
    priority: int
    started_at: Any | None
    completed_at: Any | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class OrderDetailOut(OrderOut):
    items: list[OrderItemOut] = []


# ── WebSocket connection manager ─────────────────────────────────────────────

class ConnectionManager:
    """Simple in-memory tracker of WebSocket clients per station_id."""

    def __init__(self):
        self._connections: dict[uuid.UUID, list[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, station_id: uuid.UUID, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self._connections.setdefault(station_id, []).append(ws)

    async def disconnect(self, station_id: uuid.UUID, ws: WebSocket):
        async with self._lock:
            conns = self._connections.get(station_id, [])
            if ws in conns:
                conns.remove(ws)
            if not conns:
                self._connections.pop(station_id, None)

    async def broadcast(self, station_id: uuid.UUID, message: dict[str, Any]):
        async with self._lock:
            conns = list(self._connections.get(station_id, []))
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                await self.disconnect(station_id, ws)


manager = ConnectionManager()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _order_to_dict(order: KDSOrder) -> dict[str, Any]:
    """Serialize a KDSOrder with its items to a dict."""
    return OrderDetailOut.model_validate(order).model_dump(mode="json")


async def _get_active_orders_for_station(db: DBSession, station_id: uuid.UUID) -> list[dict[str, Any]]:
    """Return active orders (not served/cancelled) for a station, ordered by priority desc + created_at asc."""
    result = await db.execute(
        select(KDSOrder)
        .options(selectinload(KDSOrder.items))
        .where(
            and_(
                KDSOrder.station_id == station_id,
                KDSOrder.status.notin_(["served", "cancelled"]),
            )
        )
        .order_by(KDSOrder.priority.desc(), KDSOrder.created_at.asc())
    )
    orders = result.scalars().all()
    return [_order_to_dict(o) for o in orders]


async def _notify_station(station_id: uuid.UUID, event: str, data: dict[str, Any]):
    """Broadcast a typed event to all WebSocket clients on a station."""
    await manager.broadcast(station_id, {"event": event, "data": data})


# ── Station endpoints ────────────────────────────────────────────────────────

@router.post("/stations", status_code=status.HTTP_201_CREATED, summary="Create a KDS station")
async def create_station(
    payload: StationIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    station = KDSStation(
        name=payload.name,
        station_type=payload.station_type,
        warehouse_id=payload.warehouse_id,
        is_active=payload.is_active,
    )
    db.add(station)
    await db.commit()
    await db.refresh(station)
    return StationOut.model_validate(station).model_dump()


@router.get("/stations", summary="List KDS stations")
async def list_stations(
    current_user: CurrentUser,
    db: DBSession,
    warehouse_id: uuid.UUID | None = Query(None, description="Filter by warehouse"),
) -> list[dict[str, Any]]:
    stmt = select(KDSStation)
    if warehouse_id is not None:
        stmt = stmt.where(KDSStation.warehouse_id == warehouse_id)
    stmt = stmt.order_by(KDSStation.name)
    result = await db.execute(stmt)
    stations = result.scalars().all()
    return [StationOut.model_validate(s).model_dump() for s in stations]


@router.get("/stations/{station_id}", summary="Get KDS station detail")
async def get_station(
    station_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    station = await db.get(KDSStation, station_id)
    if not station:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")
    return StationOut.model_validate(station).model_dump()


@router.put("/stations/{station_id}", summary="Update a KDS station")
async def update_station(
    station_id: uuid.UUID,
    payload: StationUpdateIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    station = await db.get(KDSStation, station_id)
    if not station:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(station, field, value)

    await db.commit()
    await db.refresh(station)
    return StationOut.model_validate(station).model_dump()


@router.delete("/stations/{station_id}", status_code=status.HTTP_200_OK, summary="Delete a KDS station")
async def delete_station(
    station_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    station = await db.get(KDSStation, station_id)
    if not station:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")
    await db.delete(station)
    await db.commit()


# ── Station orders endpoint ──────────────────────────────────────────────────

@router.get("/stations/{station_id}/orders", summary="List active orders for a station")
async def list_station_orders(
    station_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    station = await db.get(KDSStation, station_id)
    if not station:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")
    return await _get_active_orders_for_station(db, station_id)


# ── Order endpoints ──────────────────────────────────────────────────────────

@router.post("/orders", status_code=status.HTTP_201_CREATED, summary="Create a KDS order")
async def create_order(
    payload: OrderCreateIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Validate station exists
    station = await db.get(KDSStation, payload.station_id)
    if not station:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")

    if not payload.items:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="At least one item is required")

    order = KDSOrder(
        transaction_id=payload.transaction_id,
        station_id=payload.station_id,
        priority=payload.priority,
        status="new",
    )
    db.add(order)
    await db.flush()

    for item_in in payload.items:
        item = KDSOrderItem(
            kds_order_id=order.id,
            line_id=item_in.line_id,
            item_name=item_in.item_name,
            quantity=item_in.quantity,
            modifiers=item_in.modifiers,
            notes=item_in.notes,
            status="pending",
        )
        db.add(item)

    await db.commit()
    await db.refresh(order, attribute_names=["items"])

    order_data = _order_to_dict(order)
    await _notify_station(payload.station_id, "order_created", order_data)
    return order_data


@router.get("/orders/{order_id}", summary="Get KDS order detail with items")
async def get_order(
    order_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(KDSOrder)
        .options(selectinload(KDSOrder.items))
        .where(KDSOrder.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return _order_to_dict(order)


@router.post("/orders/{order_id}/start", summary="Mark order as in_progress")
async def start_order(
    order_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(KDSOrder)
        .options(selectinload(KDSOrder.items))
        .where(KDSOrder.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.status != "new":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot start order with status '{order.status}'. Must be 'new'.",
        )

    order.status = "in_progress"
    order.started_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(order, attribute_names=["items"])

    order_data = _order_to_dict(order)
    await _notify_station(order.station_id, "order_updated", order_data)
    return order_data


@router.post("/orders/{order_id}/ready", summary="Mark order as ready")
async def ready_order(
    order_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(KDSOrder)
        .options(selectinload(KDSOrder.items))
        .where(KDSOrder.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.status not in ("new", "in_progress"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot mark order as ready with status '{order.status}'.",
        )

    order.status = "ready"
    order.completed_at = datetime.now(timezone.utc)
    if not order.started_at:
        order.started_at = order.completed_at
    await db.commit()
    await db.refresh(order, attribute_names=["items"])

    order_data = _order_to_dict(order)
    await _notify_station(order.station_id, "order_updated", order_data)
    return order_data


@router.post("/orders/{order_id}/served", summary="Mark order as served")
async def served_order(
    order_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(KDSOrder)
        .options(selectinload(KDSOrder.items))
        .where(KDSOrder.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.status not in ("ready",):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot mark order as served with status '{order.status}'. Must be 'ready'.",
        )

    order.status = "served"
    await db.commit()
    await db.refresh(order, attribute_names=["items"])

    order_data = _order_to_dict(order)
    await _notify_station(order.station_id, "order_updated", order_data)
    return order_data


@router.post("/orders/{order_id}/cancel", summary="Cancel a KDS order")
async def cancel_order(
    order_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(KDSOrder)
        .options(selectinload(KDSOrder.items))
        .where(KDSOrder.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.status in ("served", "cancelled"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel order with status '{order.status}'.",
        )

    order.status = "cancelled"
    await db.commit()
    await db.refresh(order, attribute_names=["items"])

    order_data = _order_to_dict(order)
    await _notify_station(order.station_id, "order_cancelled", order_data)
    return order_data


# ── Order item endpoints ─────────────────────────────────────────────────────

@router.post("/orders/{order_id}/items/{item_id}/cooking", summary="Mark item as cooking")
async def item_cooking(
    order_id: uuid.UUID,
    item_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(KDSOrderItem).where(
            and_(KDSOrderItem.id == item_id, KDSOrderItem.kds_order_id == order_id)
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order item not found")
    if item.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot mark item as cooking with status '{item.status}'. Must be 'pending'.",
        )

    item.status = "cooking"
    await db.commit()
    await db.refresh(item)

    # Fetch parent order for station_id broadcast
    order = await db.get(KDSOrder, order_id)
    item_data = OrderItemOut.model_validate(item).model_dump(mode="json")
    await _notify_station(
        order.station_id,  # type: ignore[union-attr]
        "item_updated",
        {"order_id": str(order_id), "item": item_data},
    )
    return item_data


@router.post("/orders/{order_id}/items/{item_id}/ready", summary="Mark item as ready")
async def item_ready(
    order_id: uuid.UUID,
    item_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(KDSOrderItem).where(
            and_(KDSOrderItem.id == item_id, KDSOrderItem.kds_order_id == order_id)
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order item not found")
    if item.status not in ("pending", "cooking"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot mark item as ready with status '{item.status}'.",
        )

    item.status = "ready"
    await db.commit()
    await db.refresh(item)

    # Fetch parent order for station_id broadcast
    order = await db.get(KDSOrder, order_id)
    item_data = OrderItemOut.model_validate(item).model_dump(mode="json")
    await _notify_station(
        order.station_id,  # type: ignore[union-attr]
        "item_updated",
        {"order_id": str(order_id), "item": item_data},
    )
    return item_data


# ── WebSocket endpoint ───────────────────────────────────────────────────────

@router.websocket("/ws/{station_id}")
async def kds_websocket(
    websocket: WebSocket,
    station_id: uuid.UUID,
    db: DBSession,
    token: str = Query(...),
):
    """Real-time order feed for a KDS station.

    On connect: sends all active orders.
    On order changes: broadcasts updates to all connected clients for the station.
    Client can send JSON pings; server ignores them to keep the connection alive.
    Requires JWT token via query parameter for authentication.
    """
    # Authenticate via JWT token
    from app.core.security import decode_token  # noqa: PLC0415
    from jose import JWTError  # noqa: PLC0415

    try:
        payload = decode_token(token)
        if not payload.get("sub") or payload.get("type") != "access":
            await websocket.close(code=4001, reason="Invalid token")
            return
    except JWTError:
        await websocket.close(code=4001, reason="Authentication required")
        return

    # Validate station exists
    station = await db.get(KDSStation, station_id)
    if not station:
        await websocket.close(code=4004, reason="Station not found")
        return

    await manager.connect(station_id, websocket)
    try:
        # Send initial snapshot of active orders
        active_orders = await _get_active_orders_for_station(db, station_id)
        await websocket.send_json({"event": "snapshot", "data": active_orders})

        # Keep connection alive — read and discard client messages
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(station_id, websocket)
