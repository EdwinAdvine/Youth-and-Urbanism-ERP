"""Inventory API — Items, Warehouses, Stock Levels, Movements, Purchase Orders."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.models.inventory import (
    InventoryItem,
    PurchaseOrder,
    PurchaseOrderLine,
    StockLevel,
    StockMovement,
    Warehouse,
)

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

# -- Warehouses --

class WarehouseCreate(BaseModel):
    name: str
    location: str | None = None
    address: str | None = None
    warehouse_type: str = "standard"
    manager_id: uuid.UUID | None = None


class WarehouseUpdate(BaseModel):
    name: str | None = None
    location: str | None = None
    is_active: bool | None = None
    address: str | None = None
    warehouse_type: str | None = None
    manager_id: uuid.UUID | None = None


class WarehouseOut(BaseModel):
    id: uuid.UUID
    name: str
    location: str | None
    is_active: bool
    address: str | None = None
    warehouse_type: str = "standard"
    manager_id: uuid.UUID | None = None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Items --

class ItemCreate(BaseModel):
    sku: str | None = None
    name: str
    description: str | None = None
    category: str | None = None
    unit_of_measure: str = "unit"
    cost_price: Decimal = Decimal("0")
    selling_price: Decimal = Decimal("0")
    reorder_level: int = 0
    item_type: str = "stockable"
    tracking_type: str = "none"
    weight: Decimal | None = None
    dimensions: dict | None = None
    barcode: str | None = None
    min_order_qty: int = 1
    lead_time_days: int = 0
    preferred_supplier_id: uuid.UUID | None = None
    custom_fields: dict | None = None
    max_stock_level: int | None = None


class ItemUpdate(BaseModel):
    sku: str | None = None
    name: str | None = None
    description: str | None = None
    category: str | None = None
    unit_of_measure: str | None = None
    cost_price: Decimal | None = None
    selling_price: Decimal | None = None
    reorder_level: int | None = None
    is_active: bool | None = None
    item_type: str | None = None
    tracking_type: str | None = None
    weight: Decimal | None = None
    dimensions: dict | None = None
    barcode: str | None = None
    min_order_qty: int | None = None
    lead_time_days: int | None = None
    preferred_supplier_id: uuid.UUID | None = None
    custom_fields: dict | None = None
    max_stock_level: int | None = None


class ItemOut(BaseModel):
    id: uuid.UUID
    sku: str
    name: str
    description: str | None
    category: str | None
    unit_of_measure: str
    cost_price: Decimal
    selling_price: Decimal
    reorder_level: int
    is_active: bool
    owner_id: uuid.UUID
    item_type: str = "stockable"
    tracking_type: str = "none"
    weight: Decimal | None = None
    dimensions: dict | None = None
    barcode: str | None = None
    min_order_qty: int = 1
    lead_time_days: int = 0
    preferred_supplier_id: uuid.UUID | None = None
    custom_fields: dict | None = None
    max_stock_level: int | None = None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Stock Levels --

class StockLevelOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    item_name: str | None = None
    warehouse_id: uuid.UUID
    warehouse_name: str | None = None
    quantity_on_hand: int
    quantity_reserved: int
    quantity_committed: int = 0
    quantity_incoming: int = 0
    quantity_available: int = 0
    bin_location: str | None = None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Stock Movements --

class StockMovementCreate(BaseModel):
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    movement_type: str  # receipt, issue, transfer, adjustment
    quantity: int
    reference_type: str | None = None
    reference_id: uuid.UUID | None = None
    notes: str | None = None


class StockMovementOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    movement_type: str
    quantity: int
    reference_type: str | None
    reference_id: uuid.UUID | None
    notes: str | None
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Purchase Orders --

class POLineIn(BaseModel):
    item_id: uuid.UUID
    quantity: int
    unit_price: Decimal


class POLineOut(BaseModel):
    id: uuid.UUID
    purchase_order_id: uuid.UUID
    item_id: uuid.UUID
    quantity: int
    unit_price: Decimal
    received_quantity: int

    model_config = {"from_attributes": True}


class POCreate(BaseModel):
    supplier_name: str
    supplier_email: str | None = None
    order_date: date
    expected_date: date | None = None
    notes: str | None = None
    lines: list[POLineIn]


class POUpdate(BaseModel):
    supplier_name: str | None = None
    supplier_email: str | None = None
    order_date: date | None = None
    expected_date: date | None = None
    notes: str | None = None
    lines: list[POLineIn] | None = None


class POOut(BaseModel):
    id: uuid.UUID
    po_number: str
    supplier_name: str
    supplier_email: str | None
    status: str
    order_date: date
    expected_date: date | None
    total: Decimal
    notes: str | None
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class PODetailOut(POOut):
    lines: list[POLineOut] = []


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _generate_sequence(db: DBSession, model: Any, prefix: str, number_field: str) -> str:
    """Generate an auto-incrementing number like PO-2026-0001."""
    year = datetime.utcnow().year
    pattern = f"{prefix}-{year}-%"
    col = getattr(model, number_field)
    result = await db.execute(
        select(func.count()).select_from(model).where(col.like(pattern))
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}-{year}-{count:04d}"


async def _generate_sku(db: DBSession) -> str:
    """Generate an auto-incrementing SKU like SKU-0001."""
    result = await db.execute(
        select(func.count()).select_from(InventoryItem)
    )
    count = (result.scalar() or 0) + 1
    return f"SKU-{count:04d}"


# ── Item endpoints ───────────────────────────────────────────────────────────

@router.get("/items", summary="List inventory items")
async def list_items(
    current_user: CurrentUser,
    db: DBSession,
    search: str | None = Query(None, description="Search by name or SKU"),
    category: str | None = Query(None, description="Filter by category"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=1000),
) -> dict[str, Any]:
    query = select(InventoryItem).where(InventoryItem.is_active == True)  # noqa: E712

    if search:
        like_pattern = f"%{search}%"
        query = query.where(
            InventoryItem.name.ilike(like_pattern) | InventoryItem.sku.ilike(like_pattern)
        )
    if category:
        query = query.where(InventoryItem.category == category)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(InventoryItem.name.asc()).offset(skip).limit(limit)
    result = await db.execute(query)
    items = result.scalars().all()
    return {
        "total": total,
        "items": [ItemOut.model_validate(i) for i in items],
    }


@router.post(
    "/items",
    status_code=status.HTTP_201_CREATED,
    summary="Create an inventory item",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def create_item(
    payload: ItemCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    sku = payload.sku if payload.sku else await _generate_sku(db)

    item = InventoryItem(
        sku=sku,
        name=payload.name,
        description=payload.description,
        category=payload.category,
        unit_of_measure=payload.unit_of_measure,
        cost_price=payload.cost_price,
        selling_price=payload.selling_price,
        reorder_level=payload.reorder_level,
        owner_id=current_user.id,
        item_type=payload.item_type,
        tracking_type=payload.tracking_type,
        weight=payload.weight,
        dimensions=payload.dimensions,
        barcode=payload.barcode,
        min_order_qty=payload.min_order_qty,
        lead_time_days=payload.lead_time_days,
        preferred_supplier_id=payload.preferred_supplier_id,
        custom_fields=payload.custom_fields,
        max_stock_level=payload.max_stock_level,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return ItemOut.model_validate(item).model_dump()


# ── CSV Export endpoints ──────────────────────────────────────────────────────

@router.get("/items/export", summary="Export inventory items as CSV")
async def export_items(
    current_user: CurrentUser,
    db: DBSession,
):
    """Download all inventory items as a CSV file."""
    from app.core.export import rows_to_csv  # noqa: PLC0415
    result = await db.execute(select(InventoryItem).where(InventoryItem.is_active == True).order_by(InventoryItem.name))  # noqa: E712
    items = result.scalars().all()
    rows = [
        {
            "sku": i.sku,
            "name": i.name,
            "description": i.description or "",
            "category": i.category or "",
            "unit_of_measure": i.unit_of_measure,
            "cost_price": float(i.cost_price),
            "selling_price": float(i.selling_price),
            "reorder_level": i.reorder_level,
            "max_stock_level": i.max_stock_level or "",
            "item_type": i.item_type,
            "tracking_type": i.tracking_type,
            "barcode": i.barcode or "",
            "lead_time_days": i.lead_time_days,
            "is_active": i.is_active,
            "created_at": i.created_at.isoformat(),
        }
        for i in items
    ]
    columns = [
        "sku", "name", "description", "category", "unit_of_measure",
        "cost_price", "selling_price", "reorder_level", "max_stock_level",
        "item_type", "tracking_type", "barcode", "lead_time_days",
        "is_active", "created_at",
    ]
    return rows_to_csv(rows, columns, "inventory_items.csv")

@router.get("/items/{item_id}", summary="Get inventory item detail")
async def get_item(
    item_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    item = await db.get(InventoryItem, item_id)
    if not item or not item.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return ItemOut.model_validate(item).model_dump()


@router.put(
    "/items/{item_id}",
    summary="Update an inventory item",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def update_item(
    item_id: uuid.UUID,
    payload: ItemUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    item = await db.get(InventoryItem, item_id)
    if not item or not item.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)
    return ItemOut.model_validate(item).model_dump()


@router.delete(
    "/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete an inventory item",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def delete_item(
    item_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    item = await db.get(InventoryItem, item_id)
    if not item or not item.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    item.is_active = False
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Warehouse endpoints ──────────────────────────────────────────────────────

@router.get("/warehouses", summary="List active warehouses")
async def list_warehouses(
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(Warehouse)
        .where(Warehouse.is_active == True)  # noqa: E712
        .order_by(Warehouse.name.asc())
    )
    warehouses = result.scalars().all()
    return [WarehouseOut.model_validate(w).model_dump() for w in warehouses]


@router.post(
    "/warehouses",
    status_code=status.HTTP_201_CREATED,
    summary="Create a warehouse",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def create_warehouse(
    payload: WarehouseCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    warehouse = Warehouse(
        name=payload.name,
        location=payload.location,
        address=payload.address,
        warehouse_type=payload.warehouse_type,
        manager_id=payload.manager_id,
    )
    db.add(warehouse)
    await db.commit()
    await db.refresh(warehouse)
    return WarehouseOut.model_validate(warehouse).model_dump()


@router.get("/warehouses/{warehouse_id}", summary="Get warehouse detail")
async def get_warehouse(
    warehouse_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    warehouse = await db.get(Warehouse, warehouse_id)
    if not warehouse or not warehouse.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    return WarehouseOut.model_validate(warehouse).model_dump()


@router.put(
    "/warehouses/{warehouse_id}",
    summary="Update a warehouse",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def update_warehouse(
    warehouse_id: uuid.UUID,
    payload: WarehouseUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    warehouse = await db.get(Warehouse, warehouse_id)
    if not warehouse or not warehouse.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(warehouse, field, value)

    await db.commit()
    await db.refresh(warehouse)
    return WarehouseOut.model_validate(warehouse).model_dump()


@router.delete(
    "/warehouses/{warehouse_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete a warehouse",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def delete_warehouse(
    warehouse_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    warehouse = await db.get(Warehouse, warehouse_id)
    if not warehouse or not warehouse.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    warehouse.is_active = False
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Stock Level endpoints ────────────────────────────────────────────────────

@router.get("/stock-levels", summary="List stock levels with optional filters")
async def list_stock_levels(
    current_user: CurrentUser,
    db: DBSession,
    item_id: uuid.UUID | None = Query(None, description="Filter by item"),
    warehouse_id: uuid.UUID | None = Query(None, description="Filter by warehouse"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    query = (
        select(
            StockLevel,
            InventoryItem.name.label("item_name"),
            Warehouse.name.label("warehouse_name"),
        )
        .join(InventoryItem, StockLevel.item_id == InventoryItem.id)
        .join(Warehouse, StockLevel.warehouse_id == Warehouse.id)
    )

    if item_id:
        query = query.where(StockLevel.item_id == item_id)
    if warehouse_id:
        query = query.where(StockLevel.warehouse_id == warehouse_id)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(InventoryItem.name.asc()).offset(skip).limit(limit)
    result = await db.execute(query)
    rows = result.all()

    levels = []
    for sl, item_name, warehouse_name in rows:
        out = StockLevelOut.model_validate(sl)
        out.item_name = item_name
        out.warehouse_name = warehouse_name
        levels.append(out.model_dump())

    return {"total": total, "stock_levels": levels}


@router.get("/stock-levels/{item_id}", summary="Stock for a specific item across warehouses")
async def get_item_stock_levels(
    item_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    item = await db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    result = await db.execute(
        select(
            StockLevel,
            Warehouse.name.label("warehouse_name"),
        )
        .join(Warehouse, StockLevel.warehouse_id == Warehouse.id)
        .where(StockLevel.item_id == item_id)
        .order_by(Warehouse.name.asc())
    )
    rows = result.all()

    levels = []
    for sl, warehouse_name in rows:
        out = StockLevelOut.model_validate(sl)
        out.item_name = item.name
        out.warehouse_name = warehouse_name
        levels.append(out.model_dump())

    return levels


# ── Stock Movement endpoints ─────────────────────────────────────────────────

@router.get("/stock-movements", summary="List stock movements")
async def list_stock_movements(
    current_user: CurrentUser,
    db: DBSession,
    movement_type: str | None = Query(None, description="Filter by type"),
    item_id: uuid.UUID | None = Query(None, description="Filter by item"),
    warehouse_id: uuid.UUID | None = Query(None, description="Filter by warehouse"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(StockMovement)

    if movement_type:
        query = query.where(StockMovement.movement_type == movement_type)
    if item_id:
        query = query.where(StockMovement.item_id == item_id)
    if warehouse_id:
        query = query.where(StockMovement.warehouse_id == warehouse_id)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(StockMovement.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    movements = result.scalars().all()
    return {
        "total": total,
        "stock_movements": [StockMovementOut.model_validate(m) for m in movements],
    }


@router.post(
    "/stock-movements",
    status_code=status.HTTP_201_CREATED,
    summary="Create a manual stock adjustment",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def create_stock_movement(
    payload: StockMovementCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Validate item and warehouse exist
    item = await db.get(InventoryItem, payload.item_id)
    if not item or not item.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    warehouse = await db.get(Warehouse, payload.warehouse_id)
    if not warehouse or not warehouse.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    # Create the movement record
    movement = StockMovement(
        item_id=payload.item_id,
        warehouse_id=payload.warehouse_id,
        movement_type=payload.movement_type,
        quantity=payload.quantity,
        reference_type=payload.reference_type,
        reference_id=payload.reference_id,
        notes=payload.notes,
        created_by=current_user.id,
    )
    db.add(movement)

    # Upsert stock level
    sl_result = await db.execute(
        select(StockLevel).where(
            and_(
                StockLevel.item_id == payload.item_id,
                StockLevel.warehouse_id == payload.warehouse_id,
            )
        )
    )
    stock_level = sl_result.scalar_one_or_none()

    if stock_level is None:
        stock_level = StockLevel(
            item_id=payload.item_id,
            warehouse_id=payload.warehouse_id,
            quantity_on_hand=payload.quantity,
        )
        db.add(stock_level)
    else:
        stock_level.quantity_on_hand += payload.quantity

    await db.flush()

    # Check reorder level
    if stock_level.quantity_on_hand <= item.reorder_level:
        await event_bus.publish("stock.low", {
            "item_id": str(item.id),
            "item_name": item.name,
            "sku": item.sku,
            "warehouse_id": str(warehouse.id),
            "warehouse_name": warehouse.name,
            "quantity_on_hand": stock_level.quantity_on_hand,
            "reorder_level": item.reorder_level,
        })

    await db.commit()
    await db.refresh(movement)

    # Publish stock valuation change event for Finance integration
    value_change = float(item.cost_price) * payload.quantity
    await event_bus.publish("inventory.valuation.changed", {
        "item_id": str(item.id),
        "item_name": item.name,
        "warehouse_id": str(payload.warehouse_id),
        "movement_type": payload.movement_type,
        "quantity": payload.quantity,
        "cost_price": float(item.cost_price),
        "value_change": str(value_change),
        "user_id": str(current_user.id),
    })

    return StockMovementOut.model_validate(movement).model_dump()


# ── Purchase Order endpoints ─────────────────────────────────────────────────

@router.get("/purchase-orders", summary="List purchase orders")
async def list_purchase_orders(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(PurchaseOrder)

    if status_filter:
        query = query.where(PurchaseOrder.status == status_filter)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(PurchaseOrder.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    orders = result.scalars().all()
    return {
        "total": total,
        "purchase_orders": [POOut.model_validate(o) for o in orders],
    }


@router.post(
    "/purchase-orders",
    status_code=status.HTTP_201_CREATED,
    summary="Create a purchase order with lines",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def create_purchase_order(
    payload: POCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    if not payload.lines:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one line item is required",
        )

    po_number = await _generate_sequence(db, PurchaseOrder, "PO", "po_number")

    # Calculate total from lines
    total = sum(
        Decimal(str(line.quantity)) * line.unit_price for line in payload.lines
    )

    po = PurchaseOrder(
        po_number=po_number,
        supplier_name=payload.supplier_name,
        supplier_email=payload.supplier_email,
        order_date=payload.order_date,
        expected_date=payload.expected_date,
        total=total,
        notes=payload.notes,
        owner_id=current_user.id,
    )
    db.add(po)
    await db.flush()

    for line_data in payload.lines:
        line = PurchaseOrderLine(
            purchase_order_id=po.id,
            item_id=line_data.item_id,
            quantity=line_data.quantity,
            unit_price=line_data.unit_price,
        )
        db.add(line)

    await db.commit()

    # Reload with lines
    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .where(PurchaseOrder.id == po.id)
    )
    po = result.scalar_one()
    return PODetailOut.model_validate(po).model_dump()


@router.get("/purchase-orders/{po_id}", summary="Get purchase order detail with lines")
async def get_purchase_order(
    po_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .where(PurchaseOrder.id == po_id)
    )
    po = result.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    return PODetailOut.model_validate(po).model_dump()


@router.put(
    "/purchase-orders/{po_id}",
    summary="Update a draft purchase order",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def update_purchase_order(
    po_id: uuid.UUID,
    payload: POUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .where(PurchaseOrder.id == po_id)
    )
    po = result.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    if po.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only draft purchase orders can be updated",
        )

    if payload.supplier_name is not None:
        po.supplier_name = payload.supplier_name
    if payload.supplier_email is not None:
        po.supplier_email = payload.supplier_email
    if payload.order_date is not None:
        po.order_date = payload.order_date
    if payload.expected_date is not None:
        po.expected_date = payload.expected_date
    if payload.notes is not None:
        po.notes = payload.notes

    # If lines are provided, replace them and recalculate total
    if payload.lines is not None:
        if not payload.lines:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="At least one line item is required",
            )

        # Remove existing lines
        for existing_line in po.lines:
            await db.delete(existing_line)

        # Add new lines
        total = Decimal("0")
        for line_data in payload.lines:
            line = PurchaseOrderLine(
                purchase_order_id=po.id,
                item_id=line_data.item_id,
                quantity=line_data.quantity,
                unit_price=line_data.unit_price,
            )
            db.add(line)
            total += Decimal(str(line_data.quantity)) * line_data.unit_price

        po.total = total

    await db.commit()

    # Reload with lines
    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .where(PurchaseOrder.id == po.id)
    )
    po = result.scalar_one()
    return PODetailOut.model_validate(po).model_dump()


@router.post(
    "/purchase-orders/{po_id}/send",
    summary="Mark purchase order as sent",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def send_purchase_order(
    po_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    po = await db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    if po.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot send purchase order with status '{po.status}'",
        )

    po.status = "sent"

    # Update quantity_incoming for each line item in the default warehouse
    result_lines = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .where(PurchaseOrder.id == po.id)
    )
    po_with_lines = result_lines.scalar_one()

    wh_result = await db.execute(
        select(Warehouse)
        .where(Warehouse.is_active == True)  # noqa: E712
        .order_by(Warehouse.name.asc())
        .limit(1)
    )
    default_warehouse = wh_result.scalar_one_or_none()

    if default_warehouse:
        for po_line in po_with_lines.lines:
            sl_result = await db.execute(
                select(StockLevel).where(
                    and_(
                        StockLevel.item_id == po_line.item_id,
                        StockLevel.warehouse_id == default_warehouse.id,
                    )
                )
            )
            stock_level = sl_result.scalar_one_or_none()
            if stock_level is None:
                stock_level = StockLevel(
                    item_id=po_line.item_id,
                    warehouse_id=default_warehouse.id,
                    quantity_incoming=po_line.quantity,
                )
                db.add(stock_level)
            else:
                stock_level.quantity_incoming += po_line.quantity

    await db.commit()
    await db.refresh(po)
    return POOut.model_validate(po).model_dump()


@router.post(
    "/purchase-orders/{po_id}/receive",
    summary="Receive goods for a purchase order",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def receive_purchase_order(
    po_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .where(PurchaseOrder.id == po_id)
    )
    po = result.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    if po.status not in ("draft", "sent"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot receive purchase order with status '{po.status}'",
        )

    low_stock_alerts: list[dict[str, Any]] = []

    for po_line in po.lines:
        # Determine the default warehouse (use first active warehouse)
        # For each line, create a stock movement
        wh_result = await db.execute(
            select(Warehouse)
            .where(Warehouse.is_active == True)  # noqa: E712
            .order_by(Warehouse.name.asc())
            .limit(1)
        )
        default_warehouse = wh_result.scalar_one_or_none()
        if not default_warehouse:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No active warehouse found to receive goods into",
            )

        qty_to_receive = po_line.quantity - po_line.received_quantity
        if qty_to_receive <= 0:
            continue

        # Create stock movement
        movement = StockMovement(
            item_id=po_line.item_id,
            warehouse_id=default_warehouse.id,
            movement_type="receipt",
            quantity=qty_to_receive,
            reference_type="purchase_order",
            reference_id=po.id,
            notes=f"Received from PO {po.po_number}",
            created_by=current_user.id,
        )
        db.add(movement)

        # Upsert stock level
        sl_result = await db.execute(
            select(StockLevel).where(
                and_(
                    StockLevel.item_id == po_line.item_id,
                    StockLevel.warehouse_id == default_warehouse.id,
                )
            )
        )
        stock_level = sl_result.scalar_one_or_none()

        if stock_level is None:
            stock_level = StockLevel(
                item_id=po_line.item_id,
                warehouse_id=default_warehouse.id,
                quantity_on_hand=qty_to_receive,
            )
            db.add(stock_level)
        else:
            stock_level.quantity_on_hand += qty_to_receive
            # Decrement quantity_incoming now that goods have arrived
            stock_level.quantity_incoming = max(
                0, stock_level.quantity_incoming - qty_to_receive
            )

        # Update received quantity on the PO line
        po_line.received_quantity = po_line.quantity

        # Check reorder level
        item = await db.get(InventoryItem, po_line.item_id)
        if item and stock_level.quantity_on_hand <= item.reorder_level:
            low_stock_alerts.append({
                "item_id": str(item.id),
                "item_name": item.name,
                "sku": item.sku,
                "quantity_on_hand": stock_level.quantity_on_hand,
                "reorder_level": item.reorder_level,
            })

    po.status = "received"
    await db.commit()

    # Publish events
    await event_bus.publish("po.received", {
        "po_id": str(po.id),
        "po_number": po.po_number,
        "supplier_name": po.supplier_name,
        "total": str(po.total),
        "lines_count": len(po.lines),
    })

    for alert in low_stock_alerts:
        await event_bus.publish("stock.low", alert)

    # Reload with lines for response
    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .where(PurchaseOrder.id == po.id)
    )
    po = result.scalar_one()
    return PODetailOut.model_validate(po).model_dump()


@router.delete(
    "/purchase-orders/{po_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel a purchase order",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def cancel_purchase_order(
    po_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    po = await db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    if po.status not in ("draft", "sent"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel purchase order with status '{po.status}'",
        )

    po.status = "cancelled"
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Dashboard + Alerts ───────────────────────────────────────────────────────

@router.get("/dashboard/stats", summary="Inventory dashboard summary")
async def inventory_dashboard(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Total active items
    items_result = await db.execute(
        select(func.count()).select_from(InventoryItem).where(
            InventoryItem.is_active == True  # noqa: E712
        )
    )
    total_items = items_result.scalar() or 0

    # Low stock count: items where any stock level quantity_on_hand <= reorder_level
    low_stock_result = await db.execute(
        select(func.count(func.distinct(InventoryItem.id)))
        .select_from(InventoryItem)
        .join(StockLevel, StockLevel.item_id == InventoryItem.id)
        .where(
            and_(
                InventoryItem.is_active == True,  # noqa: E712
                StockLevel.quantity_on_hand <= InventoryItem.reorder_level,
            )
        )
    )
    low_stock_count = low_stock_result.scalar() or 0

    # Pending purchase orders (draft or sent)
    pending_result = await db.execute(
        select(func.count()).select_from(PurchaseOrder).where(
            PurchaseOrder.status.in_(["draft", "sent"])
        )
    )
    pending_pos = pending_result.scalar() or 0

    # Total inventory value: sum(cost_price * quantity_on_hand) across all items/warehouses
    value_result = await db.execute(
        select(
            func.coalesce(
                func.sum(InventoryItem.cost_price * StockLevel.quantity_on_hand), 0
            )
        )
        .select_from(InventoryItem)
        .join(StockLevel, StockLevel.item_id == InventoryItem.id)
        .where(InventoryItem.is_active == True)  # noqa: E712
    )
    total_inventory_value = value_result.scalar() or Decimal("0")

    # Overstock count: items where quantity_on_hand > max_stock_level
    overstock_result = await db.execute(
        select(func.count(func.distinct(InventoryItem.id)))
        .select_from(InventoryItem)
        .join(StockLevel, StockLevel.item_id == InventoryItem.id)
        .where(
            and_(
                InventoryItem.is_active == True,  # noqa: E712
                InventoryItem.max_stock_level.isnot(None),
                StockLevel.quantity_on_hand > InventoryItem.max_stock_level,
            )
        )
    )
    overstock_count = overstock_result.scalar() or 0

    # Total incoming quantity value
    incoming_result = await db.execute(
        select(
            func.coalesce(func.sum(StockLevel.quantity_incoming), 0)
        )
        .select_from(StockLevel)
    )
    total_incoming = incoming_result.scalar() or 0

    return {
        "total_items": total_items,
        "low_stock_count": low_stock_count,
        "overstock_count": overstock_count,
        "pending_pos": pending_pos,
        "total_inventory_value": float(total_inventory_value),
        "total_incoming_units": total_incoming,
    }


@router.get("/reorder-alerts", summary="Items at or below reorder level")
async def reorder_alerts(
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(
            InventoryItem.id,
            InventoryItem.sku,
            InventoryItem.name,
            InventoryItem.category,
            InventoryItem.reorder_level,
            InventoryItem.cost_price,
            StockLevel.warehouse_id,
            StockLevel.quantity_on_hand,
            StockLevel.quantity_reserved,
            Warehouse.name.label("warehouse_name"),
        )
        .join(StockLevel, StockLevel.item_id == InventoryItem.id)
        .join(Warehouse, StockLevel.warehouse_id == Warehouse.id)
        .where(
            and_(
                InventoryItem.is_active == True,  # noqa: E712
                StockLevel.quantity_on_hand <= InventoryItem.reorder_level,
            )
        )
        .order_by(StockLevel.quantity_on_hand.asc())
    )
    rows = result.all()

    alerts = []
    for row in rows:
        alerts.append({
            "item_id": str(row.id),
            "sku": row.sku,
            "item_name": row.name,
            "category": row.category,
            "reorder_level": row.reorder_level,
            "cost_price": str(row.cost_price),
            "warehouse_id": str(row.warehouse_id),
            "warehouse_name": row.warehouse_name,
            "quantity_on_hand": row.quantity_on_hand,
            "quantity_reserved": row.quantity_reserved,
            "shortfall": row.reorder_level - row.quantity_on_hand,
        })

    return alerts


