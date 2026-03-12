"""Inventory Extensions API — Suppliers, Adjustments, Variants, Batches, Counts, Reports."""
from __future__ import annotations

import csv
import io
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.models.inventory import (
    BatchNumber,
    InventoryCount,
    InventoryItem,
    ItemVariant,
    StockAdjustment,
    StockLevel,
    StockMovement,
    InventorySupplier as Supplier,
    Warehouse,
)

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

# -- Suppliers --

class SupplierCreate(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    contact_person: str | None = None
    payment_terms: str | None = None


class SupplierUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    contact_person: str | None = None
    payment_terms: str | None = None
    is_active: bool | None = None


class SupplierOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str | None
    phone: str | None
    address: str | None
    contact_person: str | None
    payment_terms: str | None
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Stock Adjustments --

class StockAdjustmentCreate(BaseModel):
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    adjustment_type: str  # 'increase' | 'decrease'
    quantity: int  # delta (always positive)
    reason: str | None = None
    notes: str | None = None  # combined with reason for display


class StockAdjustmentOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    item_name: str | None = None
    warehouse_id: uuid.UUID
    warehouse_name: str | None = None
    adjustment_type: str  # computed: 'increase' | 'decrease'
    quantity: int  # computed: abs(new - old)
    old_quantity: int
    new_quantity: int
    reason: str | None
    notes: str | None = None
    adjusted_by: uuid.UUID
    adjusted_by_name: str | None = None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


def _adj_to_dict(adj: StockAdjustment, item_name: str | None = None, warehouse_name: str | None = None) -> dict:
    qty_diff = adj.new_quantity - adj.old_quantity
    return {
        "id": str(adj.id),
        "item_id": str(adj.item_id),
        "item_name": item_name,
        "warehouse_id": str(adj.warehouse_id),
        "warehouse_name": warehouse_name,
        "adjustment_type": "increase" if qty_diff >= 0 else "decrease",
        "quantity": abs(qty_diff),
        "old_quantity": adj.old_quantity,
        "new_quantity": adj.new_quantity,
        "reason": adj.reason,
        "notes": None,
        "adjusted_by": str(adj.adjusted_by),
        "adjusted_by_name": None,
        "created_at": adj.created_at.isoformat() if adj.created_at else None,
        "updated_at": adj.updated_at.isoformat() if adj.updated_at else None,
    }


# -- Item Variants --

class ItemVariantCreate(BaseModel):
    variant_name: str
    sku: str
    price_adjustment: Decimal = Decimal("0")
    attributes: dict | None = None


class ItemVariantUpdate(BaseModel):
    variant_name: str | None = None
    sku: str | None = None
    price_adjustment: Decimal | None = None
    attributes: dict | None = None
    is_active: bool | None = None


class ItemVariantOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    variant_name: str
    sku: str
    price_adjustment: Decimal
    attributes: dict | None
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Batch Numbers --

class BatchNumberCreate(BaseModel):
    batch_no: str
    manufacture_date: date
    expiry_date: date | None = None
    quantity: int
    warehouse_id: uuid.UUID


class BatchNumberOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    item_name: str | None = None
    batch_no: str
    manufacture_date: date
    expiry_date: date | None
    quantity: int
    warehouse_id: uuid.UUID
    warehouse_name: str | None = None
    status: str = "active"  # computed: 'active' | 'expired'
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


def _batch_to_dict(batch: BatchNumber, item_name: str | None = None, warehouse_name: str | None = None) -> dict:
    now = date.today()
    status = "expired" if (batch.expiry_date and batch.expiry_date < now) else "active"
    return {
        "id": str(batch.id),
        "item_id": str(batch.item_id),
        "item_name": item_name,
        "batch_no": batch.batch_no,
        "manufacture_date": batch.manufacture_date.isoformat() if batch.manufacture_date else None,
        "expiry_date": batch.expiry_date.isoformat() if batch.expiry_date else None,
        "quantity": batch.quantity,
        "warehouse_id": str(batch.warehouse_id),
        "warehouse_name": warehouse_name,
        "status": status,
        "created_at": batch.created_at.isoformat() if batch.created_at else None,
        "updated_at": batch.updated_at.isoformat() if batch.updated_at else None,
    }


# -- Inventory Counts --

class InventoryCountCreate(BaseModel):
    warehouse_id: uuid.UUID
    count_date: date
    notes: str | None = None


class InventoryCountUpdate(BaseModel):
    status: str | None = None  # completed, cancelled
    notes: str | None = None
    lines: list[dict] | None = None  # [{item_id, expected_qty, actual_qty}]


class InventoryCountOut(BaseModel):
    id: uuid.UUID
    warehouse_id: uuid.UUID
    count_date: date
    status: str
    counted_by: uuid.UUID
    notes: str | None
    lines: list | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Supplier endpoints ───────────────────────────────────────────────────────

@router.get("/suppliers", summary="List suppliers")
async def list_suppliers(
    current_user: CurrentUser,
    db: DBSession,
    search: str | None = Query(None, description="Search by name or email"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Supplier).where(Supplier.is_active == True)  # noqa: E712

    if search:
        like_pattern = f"%{search}%"
        query = query.where(
            Supplier.name.ilike(like_pattern) | Supplier.email.ilike(like_pattern)
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Supplier.name.asc()).offset(skip).limit(limit)
    result = await db.execute(query)
    suppliers = result.scalars().all()
    return {
        "total": total,
        "suppliers": [SupplierOut.model_validate(s).model_dump() for s in suppliers],
    }


@router.post(
    "/suppliers",
    status_code=status.HTTP_201_CREATED,
    summary="Create a supplier",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def create_supplier(
    payload: SupplierCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    supplier = Supplier(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        address=payload.address,
        contact_person=payload.contact_person,
        payment_terms=payload.payment_terms,
    )
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return SupplierOut.model_validate(supplier).model_dump()


@router.get("/suppliers/{supplier_id}", summary="Get supplier detail")
async def get_supplier(
    supplier_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    supplier = await db.get(Supplier, supplier_id)
    if not supplier or not supplier.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return SupplierOut.model_validate(supplier).model_dump()


@router.put(
    "/suppliers/{supplier_id}",
    summary="Update a supplier",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def update_supplier(
    supplier_id: uuid.UUID,
    payload: SupplierUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    supplier = await db.get(Supplier, supplier_id)
    if not supplier or not supplier.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(supplier, field, value)

    await db.commit()
    await db.refresh(supplier)
    return SupplierOut.model_validate(supplier).model_dump()


@router.delete(
    "/suppliers/{supplier_id}",
    status_code=status.HTTP_200_OK,
    summary="Soft-delete a supplier",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def delete_supplier(
    supplier_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    supplier = await db.get(Supplier, supplier_id)
    if not supplier or not supplier.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    supplier.is_active = False
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ── Stock Adjustment endpoints ───────────────────────────────────────────────

@router.post(
    "/stock-adjustments",
    status_code=status.HTTP_201_CREATED,
    summary="Create a stock adjustment",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def create_stock_adjustment(
    payload: StockAdjustmentCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Validate item and warehouse
    item = await db.get(InventoryItem, payload.item_id)
    if not item or not item.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    warehouse = await db.get(Warehouse, payload.warehouse_id)
    if not warehouse or not warehouse.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    # Get current stock level
    sl_result = await db.execute(
        select(StockLevel).where(
            and_(
                StockLevel.item_id == payload.item_id,
                StockLevel.warehouse_id == payload.warehouse_id,
            )
        )
    )
    stock_level = sl_result.scalar_one_or_none()
    old_quantity = stock_level.quantity_on_hand if stock_level else 0

    # Compute new quantity from adjustment_type + quantity
    if payload.adjustment_type == "increase":
        new_quantity = old_quantity + payload.quantity
    else:
        new_quantity = max(0, old_quantity - payload.quantity)

    # Build reason text (combine reason + notes if both provided)
    reason_text = payload.reason
    if payload.notes:
        reason_text = f"{reason_text}: {payload.notes}" if reason_text else payload.notes

    # Create adjustment record
    adjustment = StockAdjustment(
        item_id=payload.item_id,
        warehouse_id=payload.warehouse_id,
        old_quantity=old_quantity,
        new_quantity=new_quantity,
        reason=reason_text,
        adjusted_by=current_user.id,
    )
    db.add(adjustment)

    # Update stock level
    if stock_level is None:
        stock_level = StockLevel(
            item_id=payload.item_id,
            warehouse_id=payload.warehouse_id,
            quantity_on_hand=new_quantity,
        )
        db.add(stock_level)
    else:
        stock_level.quantity_on_hand = new_quantity

    # Create a stock movement for audit trail
    qty_diff = new_quantity - old_quantity
    movement = StockMovement(
        item_id=payload.item_id,
        warehouse_id=payload.warehouse_id,
        movement_type="adjustment",
        quantity=qty_diff,
        reference_type="stock_adjustment",
        notes=reason_text or "Manual stock adjustment",
        created_by=current_user.id,
    )
    db.add(movement)

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
    await db.refresh(adjustment)
    return _adj_to_dict(adjustment, item_name=item.name, warehouse_name=warehouse.name)


@router.get("/stock-adjustments", summary="List stock adjustments")
async def list_stock_adjustments(
    current_user: CurrentUser,
    db: DBSession,
    item_id: uuid.UUID | None = Query(None, description="Filter by item"),
    warehouse_id: uuid.UUID | None = Query(None, description="Filter by warehouse"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = (
        select(
            StockAdjustment,
            InventoryItem.name.label("item_name"),
            Warehouse.name.label("warehouse_name"),
        )
        .join(InventoryItem, StockAdjustment.item_id == InventoryItem.id)
        .join(Warehouse, StockAdjustment.warehouse_id == Warehouse.id)
    )

    if item_id:
        query = query.where(StockAdjustment.item_id == item_id)
    if warehouse_id:
        query = query.where(StockAdjustment.warehouse_id == warehouse_id)

    count_base = select(StockAdjustment)
    if item_id:
        count_base = count_base.where(StockAdjustment.item_id == item_id)
    if warehouse_id:
        count_base = count_base.where(StockAdjustment.warehouse_id == warehouse_id)
    total_result = await db.execute(select(func.count()).select_from(count_base.subquery()))
    total = total_result.scalar() or 0

    query = query.order_by(StockAdjustment.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    rows = result.all()

    return {
        "total": total,
        "stock_adjustments": [
            _adj_to_dict(adj, item_name=item_name, warehouse_name=warehouse_name)
            for adj, item_name, warehouse_name in rows
        ],
    }


# ── Item History endpoint ────────────────────────────────────────────────────

@router.get("/items/{item_id}/history", summary="Movement history for an item")
async def item_history(
    item_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    warehouse_id: uuid.UUID | None = Query(None, description="Filter by warehouse"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    item = await db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    query = select(StockMovement).where(StockMovement.item_id == item_id)
    if warehouse_id:
        query = query.where(StockMovement.warehouse_id == warehouse_id)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(StockMovement.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    movements = result.scalars().all()

    from app.api.v1.inventory import StockMovementOut  # noqa: PLC0415

    return {
        "total": total,
        "item_id": str(item_id),
        "item_name": item.name,
        "movements": [StockMovementOut.model_validate(m).model_dump() for m in movements],
    }


# ── Valuation endpoint ──────────────────────────────────────────────────────

@router.get("/valuation", summary="Stock value by warehouse")
async def stock_valuation(
    current_user: CurrentUser,
    db: DBSession,
    warehouse_id: uuid.UUID | None = Query(None, description="Filter by warehouse"),
) -> dict[str, Any]:
    # Per-item per-warehouse stock levels with item details
    query = (
        select(
            Warehouse.id.label("warehouse_id"),
            Warehouse.name.label("warehouse_name"),
            InventoryItem.id.label("item_id"),
            InventoryItem.name.label("item_name"),
            InventoryItem.sku,
            InventoryItem.cost_price,
            StockLevel.quantity_on_hand,
        )
        .select_from(StockLevel)
        .join(InventoryItem, StockLevel.item_id == InventoryItem.id)
        .join(Warehouse, StockLevel.warehouse_id == Warehouse.id)
        .where(InventoryItem.is_active == True)  # noqa: E712
        .where(StockLevel.quantity_on_hand > 0)
        .order_by(Warehouse.name, InventoryItem.name)
    )

    if warehouse_id:
        query = query.where(Warehouse.id == warehouse_id)

    result = await db.execute(query)
    rows = result.all()

    # Group by warehouse
    wh_map: dict[str, dict] = {}
    for row in rows:
        wid = str(row.warehouse_id)
        if wid not in wh_map:
            wh_map[wid] = {
                "warehouse_id": wid,
                "warehouse_name": row.warehouse_name,
                "items": [],
                "total_value": 0.0,
            }
        unit_cost = float(row.cost_price)
        total_value = unit_cost * row.quantity_on_hand
        wh_map[wid]["items"].append({
            "item_id": str(row.item_id),
            "item_name": row.item_name,
            "sku": row.sku,
            "quantity": row.quantity_on_hand,
            "unit_cost": unit_cost,
            "total_value": total_value,
        })
        wh_map[wid]["total_value"] += total_value

    warehouses = list(wh_map.values())
    grand_total = sum(w["total_value"] for w in warehouses)

    return {
        "warehouses": warehouses,
        "grand_total": grand_total,
    }


# ── Physical Count endpoints ────────────────────────────────────────────────

@router.post(
    "/counts",
    status_code=status.HTTP_201_CREATED,
    summary="Start a physical inventory count",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def create_count(
    payload: InventoryCountCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    warehouse = await db.get(Warehouse, payload.warehouse_id)
    if not warehouse or not warehouse.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    # Pre-populate expected quantities from stock levels
    sl_result = await db.execute(
        select(StockLevel, InventoryItem.name)
        .join(InventoryItem, StockLevel.item_id == InventoryItem.id)
        .where(
            and_(
                StockLevel.warehouse_id == payload.warehouse_id,
                InventoryItem.is_active == True,  # noqa: E712
            )
        )
    )
    sl_rows = sl_result.all()

    initial_lines = [
        {
            "item_id": str(sl.item_id),
            "item_name": item_name,
            "expected_qty": sl.quantity_on_hand,
            "actual_qty": None,
        }
        for sl, item_name in sl_rows
    ]

    count = InventoryCount(
        warehouse_id=payload.warehouse_id,
        count_date=payload.count_date,
        status="in_progress",
        counted_by=current_user.id,
        notes=payload.notes,
        lines=initial_lines,
    )
    db.add(count)
    await db.commit()
    await db.refresh(count)
    return InventoryCountOut.model_validate(count).model_dump()


@router.put(
    "/counts/{count_id}",
    summary="Submit / update count results",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def update_count(
    count_id: uuid.UUID,
    payload: InventoryCountUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    count = await db.get(InventoryCount, count_id)
    if not count:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory count not found")

    if count.status != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot update count with status '{count.status}'",
        )

    if payload.notes is not None:
        count.notes = payload.notes
    if payload.lines is not None:
        count.lines = payload.lines

    if payload.status is not None:
        if payload.status not in ("completed", "cancelled"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Status must be 'completed' or 'cancelled'",
            )

        if payload.status == "completed" and count.lines:
            # Apply adjustments for discrepancies
            for line in count.lines:
                if line.get("actual_qty") is None:
                    continue
                expected = line.get("expected_qty", 0)
                actual = line["actual_qty"]
                if expected != actual:
                    item_uuid = uuid.UUID(line["item_id"])
                    # Create stock adjustment
                    adj = StockAdjustment(
                        item_id=item_uuid,
                        warehouse_id=count.warehouse_id,
                        old_quantity=expected,
                        new_quantity=actual,
                        reason=f"Physical count adjustment (Count #{str(count.id)[:8]})",
                        adjusted_by=current_user.id,
                    )
                    db.add(adj)

                    # Update stock level
                    sl_result = await db.execute(
                        select(StockLevel).where(
                            and_(
                                StockLevel.item_id == item_uuid,
                                StockLevel.warehouse_id == count.warehouse_id,
                            )
                        )
                    )
                    stock_level = sl_result.scalar_one_or_none()
                    if stock_level:
                        stock_level.quantity_on_hand = actual

                    # Create movement for audit trail
                    movement = StockMovement(
                        item_id=item_uuid,
                        warehouse_id=count.warehouse_id,
                        movement_type="adjustment",
                        quantity=actual - expected,
                        reference_type="inventory_count",
                        reference_id=count.id,
                        notes=f"Physical count adjustment",
                        created_by=current_user.id,
                    )
                    db.add(movement)

        count.status = payload.status

    await db.commit()
    await db.refresh(count)
    return InventoryCountOut.model_validate(count).model_dump()


@router.get("/counts", summary="List inventory counts")
async def list_counts(
    current_user: CurrentUser,
    db: DBSession,
    warehouse_id: uuid.UUID | None = Query(None, description="Filter by warehouse"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(InventoryCount)

    if warehouse_id:
        query = query.where(InventoryCount.warehouse_id == warehouse_id)
    if status_filter:
        query = query.where(InventoryCount.status == status_filter)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(InventoryCount.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    counts = result.scalars().all()
    return {
        "total": total,
        "counts": [InventoryCountOut.model_validate(c).model_dump() for c in counts],
    }


# ── Report endpoints ────────────────────────────────────────────────────────

@router.get("/reports/turnover", summary="Inventory turnover report")
async def turnover_report(
    current_user: CurrentUser,
    db: DBSession,
    days: int = Query(30, ge=1, le=365, description="Look-back window in days"),
    warehouse_id: uuid.UUID | None = Query(None, description="Filter by warehouse"),
) -> dict[str, Any]:
    """
    Turnover = total issued quantity / average stock on hand per item
    over the specified number of days.
    """
    from datetime import timedelta  # noqa: PLC0415

    cutoff = datetime.utcnow() - timedelta(days=days)

    # Total issued quantities per item in the window
    issued_query = (
        select(
            StockMovement.item_id,
            func.coalesce(func.sum(func.abs(StockMovement.quantity)), 0).label("total_issued"),
        )
        .where(
            and_(
                StockMovement.movement_type == "issue",
                StockMovement.created_at >= cutoff,
            )
        )
        .group_by(StockMovement.item_id)
    )

    if warehouse_id:
        issued_query = issued_query.where(StockMovement.warehouse_id == warehouse_id)

    issued_result = await db.execute(issued_query)
    issued_map: dict[uuid.UUID, int] = {}
    for row in issued_result.all():
        issued_map[row.item_id] = int(row.total_issued)

    # Current stock on hand per item
    stock_query = select(
        StockLevel.item_id,
        func.sum(StockLevel.quantity_on_hand).label("total_on_hand"),
    ).group_by(StockLevel.item_id)

    if warehouse_id:
        stock_query = stock_query.where(StockLevel.warehouse_id == warehouse_id)

    stock_result = await db.execute(stock_query)
    stock_map: dict[uuid.UUID, int] = {}
    for row in stock_result.all():
        stock_map[row.item_id] = int(row.total_on_hand)

    # Build report — only items with either issues or stock
    all_item_ids = set(issued_map.keys()) | set(stock_map.keys())
    if not all_item_ids:
        return {"days": days, "items": []}

    items_result = await db.execute(
        select(InventoryItem).where(
            and_(
                InventoryItem.id.in_(all_item_ids),
                InventoryItem.is_active == True,  # noqa: E712
            )
        )
    )
    items = {i.id: i for i in items_result.scalars().all()}

    report_items = []
    for item_id in all_item_ids:
        item = items.get(item_id)
        if not item:
            continue
        issued = issued_map.get(item_id, 0)
        on_hand = stock_map.get(item_id, 0)
        avg_stock = max(on_hand, 1)  # avoid division by zero
        turnover_ratio = round(issued / avg_stock, 2)
        report_items.append({
            "item_id": str(item_id),
            "sku": item.sku,
            "item_name": item.name,
            "total_issued": issued,
            "current_on_hand": on_hand,
            "turnover_ratio": turnover_ratio,
        })

    report_items.sort(key=lambda x: x["turnover_ratio"], reverse=True)

    return {"days": days, "items": report_items}


@router.get("/reports/aging", summary="Inventory aging report")
async def aging_report(
    current_user: CurrentUser,
    db: DBSession,
    warehouse_id: uuid.UUID | None = Query(None, description="Filter by warehouse"),
) -> dict[str, Any]:
    """
    Shows how long stock has been sitting. Uses the last receipt date as proxy
    for stock age. Buckets: 0-30 days, 31-60, 61-90, 90+ days.
    """
    # Last receipt movement per item per warehouse
    query = (
        select(
            StockMovement.item_id,
            StockMovement.warehouse_id,
            func.max(StockMovement.created_at).label("last_receipt"),
            InventoryItem.sku,
            InventoryItem.name.label("item_name"),
            InventoryItem.cost_price,
            StockLevel.quantity_on_hand,
            Warehouse.name.label("warehouse_name"),
        )
        .join(InventoryItem, StockMovement.item_id == InventoryItem.id)
        .join(StockLevel, and_(
            StockLevel.item_id == StockMovement.item_id,
            StockLevel.warehouse_id == StockMovement.warehouse_id,
        ))
        .join(Warehouse, StockMovement.warehouse_id == Warehouse.id)
        .where(
            and_(
                StockMovement.movement_type == "receipt",
                InventoryItem.is_active == True,  # noqa: E712
                StockLevel.quantity_on_hand > 0,
            )
        )
        .group_by(
            StockMovement.item_id,
            StockMovement.warehouse_id,
            InventoryItem.sku,
            InventoryItem.name,
            InventoryItem.cost_price,
            StockLevel.quantity_on_hand,
            Warehouse.name,
        )
    )

    if warehouse_id:
        query = query.where(StockMovement.warehouse_id == warehouse_id)

    result = await db.execute(query)
    rows = result.all()

    now = datetime.utcnow()
    buckets = {"0_30": [], "31_60": [], "61_90": [], "90_plus": []}

    for row in rows:
        last_receipt = row.last_receipt
        if hasattr(last_receipt, "replace"):
            # Strip timezone for comparison
            last_receipt = last_receipt.replace(tzinfo=None)
        age_days = (now - last_receipt).days
        value = float(row.cost_price) * row.quantity_on_hand

        entry = {
            "item_id": str(row.item_id),
            "sku": row.sku,
            "item_name": row.item_name,
            "warehouse_id": str(row.warehouse_id),
            "warehouse_name": row.warehouse_name,
            "quantity_on_hand": row.quantity_on_hand,
            "age_days": age_days,
            "stock_value": round(value, 2),
        }

        if age_days <= 30:
            buckets["0_30"].append(entry)
        elif age_days <= 60:
            buckets["31_60"].append(entry)
        elif age_days <= 90:
            buckets["61_90"].append(entry)
        else:
            buckets["90_plus"].append(entry)

    return {
        "buckets": buckets,
        "summary": {
            "0_30_count": len(buckets["0_30"]),
            "31_60_count": len(buckets["31_60"]),
            "61_90_count": len(buckets["61_90"]),
            "90_plus_count": len(buckets["90_plus"]),
        },
    }


# ── Import / Export endpoints ────────────────────────────────────────────────

@router.post(
    "/items/import",
    status_code=status.HTTP_201_CREATED,
    summary="Bulk import items from CSV",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def import_items(
    current_user: CurrentUser,
    db: DBSession,
    file: UploadFile = File(...),
) -> dict[str, Any]:
    """
    CSV columns: sku, name, description, category, unit_of_measure,
    cost_price, selling_price, reorder_level
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only CSV files are supported",
        )

    contents = await file.read()
    try:
        text = contents.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = contents.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    created = 0
    skipped = 0
    errors: list[dict[str, Any]] = []

    for row_num, row in enumerate(reader, start=2):
        try:
            name = row.get("name", "").strip()
            if not name:
                errors.append({"row": row_num, "error": "Missing required field 'name'"})
                skipped += 1
                continue

            sku = row.get("sku", "").strip()
            if not sku:
                sku = await _generate_sku_for_import(db)

            # Check for duplicate SKU
            dup_result = await db.execute(
                select(func.count()).select_from(InventoryItem).where(InventoryItem.sku == sku)
            )
            if (dup_result.scalar() or 0) > 0:
                errors.append({"row": row_num, "error": f"Duplicate SKU: {sku}"})
                skipped += 1
                continue

            item = InventoryItem(
                sku=sku,
                name=name,
                description=row.get("description", "").strip() or None,
                category=row.get("category", "").strip() or None,
                unit_of_measure=row.get("unit_of_measure", "").strip() or "unit",
                cost_price=Decimal(row.get("cost_price", "0").strip() or "0"),
                selling_price=Decimal(row.get("selling_price", "0").strip() or "0"),
                reorder_level=int(row.get("reorder_level", "0").strip() or "0"),
                owner_id=current_user.id,
            )
            db.add(item)
            created += 1
        except Exception as exc:
            errors.append({"row": row_num, "error": str(exc)})
            skipped += 1

    if created > 0:
        await db.commit()

    return {
        "created": created,
        "skipped": skipped,
        "errors": errors,
    }


async def _generate_sku_for_import(db: DBSession) -> str:
    result = await db.execute(
        select(func.count()).select_from(InventoryItem)
    )
    count = (result.scalar() or 0) + 1
    return f"SKU-{count:04d}"




# ── Variant endpoints ────────────────────────────────────────────────────────

@router.get("/items/{item_id}/variants", summary="List variants for an item")
async def list_variants(
    item_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    item = await db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    result = await db.execute(
        select(ItemVariant)
        .where(
            and_(
                ItemVariant.item_id == item_id,
                ItemVariant.is_active == True,  # noqa: E712
            )
        )
        .order_by(ItemVariant.variant_name.asc())
    )
    variants = result.scalars().all()
    return [ItemVariantOut.model_validate(v).model_dump() for v in variants]


@router.post(
    "/items/{item_id}/variants",
    status_code=status.HTTP_201_CREATED,
    summary="Create a variant for an item",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def create_variant(
    item_id: uuid.UUID,
    payload: ItemVariantCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    item = await db.get(InventoryItem, item_id)
    if not item or not item.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    # Check duplicate SKU
    dup_result = await db.execute(
        select(func.count()).select_from(ItemVariant).where(ItemVariant.sku == payload.sku)
    )
    if (dup_result.scalar() or 0) > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Variant SKU '{payload.sku}' already exists",
        )

    variant = ItemVariant(
        item_id=item_id,
        variant_name=payload.variant_name,
        sku=payload.sku,
        price_adjustment=payload.price_adjustment,
        attributes=payload.attributes,
    )
    db.add(variant)
    await db.commit()
    await db.refresh(variant)
    return ItemVariantOut.model_validate(variant).model_dump()


@router.put(
    "/variants/{variant_id}",
    summary="Update a variant",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def update_variant(
    variant_id: uuid.UUID,
    payload: ItemVariantUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    variant = await db.get(ItemVariant, variant_id)
    if not variant or not variant.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    if payload.sku is not None and payload.sku != variant.sku:
        dup_result = await db.execute(
            select(func.count()).select_from(ItemVariant).where(ItemVariant.sku == payload.sku)
        )
        if (dup_result.scalar() or 0) > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Variant SKU '{payload.sku}' already exists",
            )

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(variant, field, value)

    await db.commit()
    await db.refresh(variant)
    return ItemVariantOut.model_validate(variant).model_dump()


@router.delete(
    "/variants/{variant_id}",
    status_code=status.HTTP_200_OK,
    summary="Soft-delete a variant",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def delete_variant(
    variant_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    variant = await db.get(ItemVariant, variant_id)
    if not variant or not variant.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    variant.is_active = False
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ── Batch endpoints ──────────────────────────────────────────────────────────

@router.get("/batches", summary="List all batches with optional filters")
async def list_all_batches(
    current_user: CurrentUser,
    db: DBSession,
    item_id: uuid.UUID | None = Query(None, description="Filter by item"),
    warehouse_id: uuid.UUID | None = Query(None, description="Filter by warehouse"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    query = (
        select(
            BatchNumber,
            InventoryItem.name.label("item_name"),
            Warehouse.name.label("warehouse_name"),
        )
        .join(InventoryItem, BatchNumber.item_id == InventoryItem.id)
        .join(Warehouse, BatchNumber.warehouse_id == Warehouse.id)
    )
    if item_id:
        query = query.where(BatchNumber.item_id == item_id)
    if warehouse_id:
        query = query.where(BatchNumber.warehouse_id == warehouse_id)

    count_base = select(BatchNumber)
    if item_id:
        count_base = count_base.where(BatchNumber.item_id == item_id)
    if warehouse_id:
        count_base = count_base.where(BatchNumber.warehouse_id == warehouse_id)
    total_result = await db.execute(select(func.count()).select_from(count_base.subquery()))
    total = total_result.scalar() or 0

    query = query.order_by(BatchNumber.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    rows = result.all()

    return {
        "total": total,
        "batches": [_batch_to_dict(b, item_name=iname, warehouse_name=wname) for b, iname, wname in rows],
    }


@router.get("/items/{item_id}/batches", summary="List batches for an item")
async def list_batches(
    item_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    item = await db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    result = await db.execute(
        select(BatchNumber, Warehouse.name.label("warehouse_name"))
        .join(Warehouse, BatchNumber.warehouse_id == Warehouse.id)
        .where(BatchNumber.item_id == item_id)
        .order_by(BatchNumber.manufacture_date.desc())
    )
    rows = result.all()
    return [_batch_to_dict(b, item_name=item.name, warehouse_name=wname) for b, wname in rows]


@router.post(
    "/items/{item_id}/batches",
    status_code=status.HTTP_201_CREATED,
    summary="Create a batch for an item",
    dependencies=[Depends(require_app_admin("inventory"))],
)
async def create_batch(
    item_id: uuid.UUID,
    payload: BatchNumberCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    item = await db.get(InventoryItem, item_id)
    if not item or not item.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    warehouse = await db.get(Warehouse, payload.warehouse_id)
    if not warehouse or not warehouse.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    # Check duplicate batch number
    dup_result = await db.execute(
        select(func.count()).select_from(BatchNumber).where(BatchNumber.batch_no == payload.batch_no)
    )
    if (dup_result.scalar() or 0) > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Batch number '{payload.batch_no}' already exists",
        )

    batch = BatchNumber(
        item_id=item_id,
        batch_no=payload.batch_no,
        manufacture_date=payload.manufacture_date,
        expiry_date=payload.expiry_date,
        quantity=payload.quantity,
        warehouse_id=payload.warehouse_id,
    )
    db.add(batch)
    await db.commit()
    await db.refresh(batch)
    return _batch_to_dict(batch, item_name=item.name, warehouse_name=warehouse.name)


@router.get("/batches/{batch_id}", summary="Get batch detail")
async def get_batch(
    batch_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(BatchNumber, InventoryItem.name.label("item_name"), Warehouse.name.label("warehouse_name"))
        .join(InventoryItem, BatchNumber.item_id == InventoryItem.id)
        .join(Warehouse, BatchNumber.warehouse_id == Warehouse.id)
        .where(BatchNumber.id == batch_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    batch, item_name, warehouse_name = row
    return _batch_to_dict(batch, item_name=item_name, warehouse_name=warehouse_name)
