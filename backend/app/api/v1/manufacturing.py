"""Manufacturing API — BOM, Work Orders, Workstations, Quality Checks."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.models.inventory import InventoryItem, StockLevel, StockMovement, Warehouse
from app.models.manufacturing import (
    BillOfMaterials,
    BOMItem,
    MaterialConsumption,
    QualityCheck,
    WorkOrder,
    WorkStation,
)

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

# -- BOM --

class BOMItemIn(BaseModel):
    item_id: uuid.UUID
    child_bom_id: uuid.UUID | None = None
    quantity_required: Decimal
    unit_of_measure: str = "unit"
    scrap_percentage: Decimal = Decimal("0")
    sort_order: int = 0
    notes: str | None = None


class BOMItemOut(BaseModel):
    id: uuid.UUID
    bom_id: uuid.UUID
    item_id: uuid.UUID
    child_bom_id: uuid.UUID | None
    quantity_required: Decimal
    unit_of_measure: str
    scrap_percentage: Decimal
    sort_order: int
    notes: str | None
    item_name: str | None = None

    model_config = {"from_attributes": True}


class BOMCreate(BaseModel):
    name: str
    finished_item_id: uuid.UUID
    quantity_produced: int = 1
    version: int = 1
    is_default: bool = False
    notes: str | None = None
    items: list[BOMItemIn]


class BOMUpdate(BaseModel):
    name: str | None = None
    finished_item_id: uuid.UUID | None = None
    quantity_produced: int | None = None
    version: int | None = None
    is_active: bool | None = None
    is_default: bool | None = None
    notes: str | None = None
    items: list[BOMItemIn] | None = None


class BOMOut(BaseModel):
    id: uuid.UUID
    bom_number: str
    name: str
    finished_item_id: uuid.UUID
    quantity_produced: int
    version: int
    is_active: bool
    is_default: bool
    notes: str | None
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any
    finished_item_name: str | None = None

    model_config = {"from_attributes": True}


class BOMDetailOut(BOMOut):
    items: list[BOMItemOut] = []


# -- WorkStation --

class WorkStationCreate(BaseModel):
    name: str
    code: str
    description: str | None = None
    capacity_per_hour: Decimal | None = None
    hourly_rate: Decimal = Decimal("0")
    warehouse_id: uuid.UUID | None = None


class WorkStationUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    description: str | None = None
    capacity_per_hour: Decimal | None = None
    hourly_rate: Decimal | None = None
    is_active: bool | None = None
    warehouse_id: uuid.UUID | None = None


class WorkStationOut(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    description: str | None
    capacity_per_hour: Decimal | None
    hourly_rate: Decimal
    is_active: bool
    warehouse_id: uuid.UUID | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Work Order --

class WorkOrderCreate(BaseModel):
    bom_id: uuid.UUID
    workstation_id: uuid.UUID | None = None
    planned_quantity: int
    priority: str = "medium"
    planned_start: datetime | None = None
    planned_end: datetime | None = None
    target_warehouse_id: uuid.UUID
    source_warehouse_id: uuid.UUID
    notes: str | None = None
    assigned_to: uuid.UUID | None = None


class WorkOrderUpdate(BaseModel):
    workstation_id: uuid.UUID | None = None
    planned_quantity: int | None = None
    priority: str | None = None
    planned_start: datetime | None = None
    planned_end: datetime | None = None
    target_warehouse_id: uuid.UUID | None = None
    source_warehouse_id: uuid.UUID | None = None
    notes: str | None = None
    assigned_to: uuid.UUID | None = None


class WorkOrderOut(BaseModel):
    id: uuid.UUID
    wo_number: str
    bom_id: uuid.UUID
    workstation_id: uuid.UUID | None
    finished_item_id: uuid.UUID
    planned_quantity: int
    completed_quantity: int
    rejected_quantity: int
    status: str
    priority: str
    planned_start: datetime | None
    planned_end: datetime | None
    actual_start: datetime | None
    actual_end: datetime | None
    target_warehouse_id: uuid.UUID
    source_warehouse_id: uuid.UUID
    total_material_cost: Decimal
    total_labor_cost: Decimal
    notes: str | None
    assigned_to: uuid.UUID | None
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any
    finished_item_name: str | None = None
    bom_name: str | None = None

    model_config = {"from_attributes": True}


# -- Material Consumption --

class MaterialConsumeIn(BaseModel):
    item_id: uuid.UUID
    quantity: Decimal
    notes: str | None = None


class MaterialConsumptionOut(BaseModel):
    id: uuid.UUID
    work_order_id: uuid.UUID
    item_id: uuid.UUID
    planned_quantity: Decimal
    actual_quantity: Decimal
    warehouse_id: uuid.UUID
    stock_movement_id: uuid.UUID | None
    consumed_at: datetime | None
    notes: str | None
    item_name: str | None = None

    model_config = {"from_attributes": True}


# -- Quality Check --

class QualityCheckCreate(BaseModel):
    work_order_id: uuid.UUID
    quantity_inspected: int
    quantity_passed: int
    quantity_failed: int
    status: str = "pending"
    parameters: dict | None = None
    notes: str | None = None


class QualityCheckOut(BaseModel):
    id: uuid.UUID
    check_number: str
    work_order_id: uuid.UUID
    inspector_id: uuid.UUID
    checked_at: datetime
    quantity_inspected: int
    quantity_passed: int
    quantity_failed: int
    status: str
    parameters: dict | None
    notes: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _generate_sequence(db: DBSession, model: Any, prefix: str, number_field: str, with_year: bool = True) -> str:
    """Generate an auto-incrementing number like WO-2026-0001 or BOM-0001."""
    col = getattr(model, number_field)
    if with_year:
        year = datetime.utcnow().year
        pattern = f"{prefix}-{year}-%"
        result = await db.execute(
            select(func.count()).select_from(model).where(col.like(pattern))
        )
        count = (result.scalar() or 0) + 1
        return f"{prefix}-{year}-{count:04d}"
    else:
        result = await db.execute(select(func.count()).select_from(model))
        count = (result.scalar() or 0) + 1
        return f"{prefix}-{count:04d}"


# ── BOM endpoints ────────────────────────────────────────────────────────────

@router.get("/bom", summary="List Bills of Materials")
async def list_boms(
    current_user: CurrentUser,
    db: DBSession,
    search: str | None = Query(None),
    is_active: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(BillOfMaterials)

    if is_active is not None:
        query = query.where(BillOfMaterials.is_active == is_active)
    if search:
        like = f"%{search}%"
        query = query.where(
            BillOfMaterials.name.ilike(like) | BillOfMaterials.bom_number.ilike(like)
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(BillOfMaterials.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    boms = result.scalars().all()

    # Enrich with finished item names
    items_out = []
    for b in boms:
        out = BOMOut.model_validate(b)
        fi = await db.get(InventoryItem, b.finished_item_id)
        out.finished_item_name = fi.name if fi else None
        items_out.append(out.model_dump())

    return {"total": total, "boms": items_out}


@router.post(
    "/bom",
    status_code=status.HTTP_201_CREATED,
    summary="Create a BOM with items",
    dependencies=[Depends(require_app_admin("manufacturing"))],
)
async def create_bom(
    payload: BOMCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one BOM item is required",
        )

    # Validate finished item
    finished_item = await db.get(InventoryItem, payload.finished_item_id)
    if not finished_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finished item not found")

    bom_number = await _generate_sequence(db, BillOfMaterials, "BOM", "bom_number", with_year=False)

    bom = BillOfMaterials(
        bom_number=bom_number,
        name=payload.name,
        finished_item_id=payload.finished_item_id,
        quantity_produced=payload.quantity_produced,
        version=payload.version,
        is_default=payload.is_default,
        notes=payload.notes,
        owner_id=current_user.id,
    )
    db.add(bom)
    await db.flush()

    for item_data in payload.items:
        line = BOMItem(
            bom_id=bom.id,
            item_id=item_data.item_id,
            child_bom_id=item_data.child_bom_id,
            quantity_required=item_data.quantity_required,
            unit_of_measure=item_data.unit_of_measure,
            scrap_percentage=item_data.scrap_percentage,
            sort_order=item_data.sort_order,
            notes=item_data.notes,
        )
        db.add(line)

    await db.commit()

    # Reload with items
    result = await db.execute(
        select(BillOfMaterials)
        .options(selectinload(BillOfMaterials.items))
        .where(BillOfMaterials.id == bom.id)
    )
    bom = result.scalar_one()
    out = BOMDetailOut.model_validate(bom)
    out.finished_item_name = finished_item.name

    # Enrich item names
    enriched_items = []
    for bi in bom.items:
        bi_out = BOMItemOut.model_validate(bi)
        inv_item = await db.get(InventoryItem, bi.item_id)
        bi_out.item_name = inv_item.name if inv_item else None
        enriched_items.append(bi_out)
    out.items = enriched_items

    return out.model_dump()


@router.get("/bom/{bom_id}", summary="Get BOM detail with items")
async def get_bom(
    bom_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(BillOfMaterials)
        .options(selectinload(BillOfMaterials.items))
        .where(BillOfMaterials.id == bom_id)
    )
    bom = result.scalar_one_or_none()
    if not bom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BOM not found")

    out = BOMDetailOut.model_validate(bom)
    fi = await db.get(InventoryItem, bom.finished_item_id)
    out.finished_item_name = fi.name if fi else None

    enriched_items = []
    for bi in bom.items:
        bi_out = BOMItemOut.model_validate(bi)
        inv_item = await db.get(InventoryItem, bi.item_id)
        bi_out.item_name = inv_item.name if inv_item else None
        enriched_items.append(bi_out)
    out.items = enriched_items

    return out.model_dump()


@router.put(
    "/bom/{bom_id}",
    summary="Update a BOM",
    dependencies=[Depends(require_app_admin("manufacturing"))],
)
async def update_bom(
    bom_id: uuid.UUID,
    payload: BOMUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(BillOfMaterials)
        .options(selectinload(BillOfMaterials.items))
        .where(BillOfMaterials.id == bom_id)
    )
    bom = result.scalar_one_or_none()
    if not bom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BOM not found")

    for field, value in payload.model_dump(exclude_none=True, exclude={"items"}).items():
        setattr(bom, field, value)

    # Replace items if provided
    if payload.items is not None:
        if not payload.items:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="At least one BOM item is required",
            )
        for existing in bom.items:
            await db.delete(existing)

        for item_data in payload.items:
            line = BOMItem(
                bom_id=bom.id,
                item_id=item_data.item_id,
                child_bom_id=item_data.child_bom_id,
                quantity_required=item_data.quantity_required,
                unit_of_measure=item_data.unit_of_measure,
                scrap_percentage=item_data.scrap_percentage,
                sort_order=item_data.sort_order,
                notes=item_data.notes,
            )
            db.add(line)

    await db.commit()

    # Reload
    result = await db.execute(
        select(BillOfMaterials)
        .options(selectinload(BillOfMaterials.items))
        .where(BillOfMaterials.id == bom.id)
    )
    bom = result.scalar_one()
    out = BOMDetailOut.model_validate(bom)
    fi = await db.get(InventoryItem, bom.finished_item_id)
    out.finished_item_name = fi.name if fi else None
    return out.model_dump()


@router.delete(
    "/bom/{bom_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete a BOM",
    dependencies=[Depends(require_app_admin("manufacturing"))],
)
async def delete_bom(
    bom_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    bom = await db.get(BillOfMaterials, bom_id)
    if not bom or not bom.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BOM not found")

    bom.is_active = False
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/bom/{bom_id}/cost", summary="Calculate recursive material cost for a BOM")
async def bom_cost(
    bom_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Recursively calculate the total material cost for one unit produced by this BOM."""

    async def _calc_cost(bid: uuid.UUID, visited: set[uuid.UUID] | None = None) -> Decimal:
        if visited is None:
            visited = set()
        if bid in visited:
            return Decimal("0")  # prevent cycles
        visited.add(bid)

        result = await db.execute(
            select(BillOfMaterials)
            .options(selectinload(BillOfMaterials.items))
            .where(BillOfMaterials.id == bid)
        )
        bom = result.scalar_one_or_none()
        if not bom:
            return Decimal("0")

        total = Decimal("0")
        for line in bom.items:
            effective_qty = line.quantity_required * (1 + line.scrap_percentage / 100)
            if line.child_bom_id:
                child_cost = await _calc_cost(line.child_bom_id, visited)
                total += effective_qty * child_cost
            else:
                item = await db.get(InventoryItem, line.item_id)
                if item:
                    total += effective_qty * item.cost_price

        return total / max(bom.quantity_produced, 1)

    unit_cost = await _calc_cost(bom_id)

    bom = await db.get(BillOfMaterials, bom_id)
    if not bom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BOM not found")

    return {
        "bom_id": str(bom_id),
        "bom_number": bom.bom_number,
        "unit_cost": str(unit_cost),
        "total_cost": str(unit_cost * bom.quantity_produced),
    }


# ── WorkStation endpoints ────────────────────────────────────────────────────

@router.get("/workstations", summary="List workstations")
async def list_workstations(
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(WorkStation)
        .where(WorkStation.is_active == True)  # noqa: E712
        .order_by(WorkStation.name.asc())
    )
    workstations = result.scalars().all()
    return [WorkStationOut.model_validate(w).model_dump() for w in workstations]


@router.post(
    "/workstations",
    status_code=status.HTTP_201_CREATED,
    summary="Create a workstation",
    dependencies=[Depends(require_app_admin("manufacturing"))],
)
async def create_workstation(
    payload: WorkStationCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    ws = WorkStation(
        name=payload.name,
        code=payload.code,
        description=payload.description,
        capacity_per_hour=payload.capacity_per_hour,
        hourly_rate=payload.hourly_rate,
        warehouse_id=payload.warehouse_id,
    )
    db.add(ws)
    await db.commit()
    await db.refresh(ws)
    return WorkStationOut.model_validate(ws).model_dump()


@router.get("/workstations/{ws_id}", summary="Get workstation detail")
async def get_workstation(
    ws_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    ws = await db.get(WorkStation, ws_id)
    if not ws or not ws.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workstation not found")
    return WorkStationOut.model_validate(ws).model_dump()


@router.put(
    "/workstations/{ws_id}",
    summary="Update a workstation",
    dependencies=[Depends(require_app_admin("manufacturing"))],
)
async def update_workstation(
    ws_id: uuid.UUID,
    payload: WorkStationUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    ws = await db.get(WorkStation, ws_id)
    if not ws or not ws.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workstation not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(ws, field, value)

    await db.commit()
    await db.refresh(ws)
    return WorkStationOut.model_validate(ws).model_dump()


# ── Work Order endpoints ─────────────────────────────────────────────────────

@router.get("/work-orders", summary="List work orders")
async def list_work_orders(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status"),
    priority: str | None = Query(None),
    search: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=500),
) -> dict[str, Any]:
    query = select(WorkOrder)

    if status_filter:
        query = query.where(WorkOrder.status == status_filter)
    if priority:
        query = query.where(WorkOrder.priority == priority)
    if search:
        like = f"%{search}%"
        query = query.where(WorkOrder.wo_number.ilike(like))

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(WorkOrder.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    orders = result.scalars().all()

    items_out = []
    for wo in orders:
        out = WorkOrderOut.model_validate(wo)
        fi = await db.get(InventoryItem, wo.finished_item_id)
        out.finished_item_name = fi.name if fi else None
        bom = await db.get(BillOfMaterials, wo.bom_id)
        out.bom_name = bom.name if bom else None
        items_out.append(out.model_dump())

    return {"total": total, "work_orders": items_out}


@router.post(
    "/work-orders",
    status_code=status.HTTP_201_CREATED,
    summary="Create a work order from a BOM",
    dependencies=[Depends(require_app_admin("manufacturing"))],
)
async def create_work_order(
    payload: WorkOrderCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Validate BOM
    bom_result = await db.execute(
        select(BillOfMaterials)
        .options(selectinload(BillOfMaterials.items))
        .where(BillOfMaterials.id == payload.bom_id)
    )
    bom = bom_result.scalar_one_or_none()
    if not bom or not bom.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BOM not found")

    # Validate warehouses
    target_wh = await db.get(Warehouse, payload.target_warehouse_id)
    if not target_wh or not target_wh.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target warehouse not found")
    source_wh = await db.get(Warehouse, payload.source_warehouse_id)
    if not source_wh or not source_wh.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source warehouse not found")

    wo_number = await _generate_sequence(db, WorkOrder, "WO", "wo_number")

    # Calculate multiplier: how many BOM batches needed
    multiplier = Decimal(str(payload.planned_quantity)) / Decimal(str(max(bom.quantity_produced, 1)))

    wo = WorkOrder(
        wo_number=wo_number,
        bom_id=bom.id,
        workstation_id=payload.workstation_id,
        finished_item_id=bom.finished_item_id,
        planned_quantity=payload.planned_quantity,
        status="draft",
        priority=payload.priority,
        planned_start=payload.planned_start,
        planned_end=payload.planned_end,
        target_warehouse_id=payload.target_warehouse_id,
        source_warehouse_id=payload.source_warehouse_id,
        notes=payload.notes,
        assigned_to=payload.assigned_to,
        owner_id=current_user.id,
    )
    db.add(wo)
    await db.flush()

    # Auto-populate material consumption from BOM items
    total_material_cost = Decimal("0")
    for bom_item in bom.items:
        effective_qty = bom_item.quantity_required * multiplier * (1 + bom_item.scrap_percentage / 100)
        inv_item = await db.get(InventoryItem, bom_item.item_id)
        if inv_item:
            total_material_cost += effective_qty * inv_item.cost_price

        mc = MaterialConsumption(
            work_order_id=wo.id,
            item_id=bom_item.item_id,
            planned_quantity=effective_qty,
            warehouse_id=payload.source_warehouse_id,
        )
        db.add(mc)

    wo.total_material_cost = total_material_cost
    await db.commit()
    await db.refresh(wo)

    out = WorkOrderOut.model_validate(wo)
    fi = await db.get(InventoryItem, wo.finished_item_id)
    out.finished_item_name = fi.name if fi else None
    out.bom_name = bom.name
    return out.model_dump()


@router.get("/work-orders/{wo_id}", summary="Get work order detail")
async def get_work_order(
    wo_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    wo = await db.get(WorkOrder, wo_id)
    if not wo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")

    out = WorkOrderOut.model_validate(wo)
    fi = await db.get(InventoryItem, wo.finished_item_id)
    out.finished_item_name = fi.name if fi else None
    bom = await db.get(BillOfMaterials, wo.bom_id)
    out.bom_name = bom.name if bom else None
    return out.model_dump()


@router.put(
    "/work-orders/{wo_id}",
    summary="Update a draft/planned work order",
    dependencies=[Depends(require_app_admin("manufacturing"))],
)
async def update_work_order(
    wo_id: uuid.UUID,
    payload: WorkOrderUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    wo = await db.get(WorkOrder, wo_id)
    if not wo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")

    if wo.status not in ("draft", "planned"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot update work order with status '{wo.status}'",
        )

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(wo, field, value)

    await db.commit()
    await db.refresh(wo)

    out = WorkOrderOut.model_validate(wo)
    fi = await db.get(InventoryItem, wo.finished_item_id)
    out.finished_item_name = fi.name if fi else None
    return out.model_dump()


@router.post(
    "/work-orders/{wo_id}/start",
    summary="Start a work order — consume raw materials from inventory",
    dependencies=[Depends(require_app_admin("manufacturing"))],
)
async def start_work_order(
    wo_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(WorkOrder)
        .options(selectinload(WorkOrder.materials))
        .where(WorkOrder.id == wo_id)
    )
    wo = result.scalar_one_or_none()
    if not wo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")

    if wo.status not in ("draft", "planned"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot start work order with status '{wo.status}'",
        )

    # Consume materials from source warehouse
    for mc in wo.materials:
        qty_to_consume = int(mc.planned_quantity)
        if qty_to_consume <= 0:
            continue

        # Check stock availability
        sl_result = await db.execute(
            select(StockLevel).where(
                and_(
                    StockLevel.item_id == mc.item_id,
                    StockLevel.warehouse_id == mc.warehouse_id,
                )
            )
        )
        stock_level = sl_result.scalar_one_or_none()
        if not stock_level or stock_level.quantity_on_hand < qty_to_consume:
            item = await db.get(InventoryItem, mc.item_id)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Insufficient stock for '{item.name if item else mc.item_id}'. "
                       f"Required: {qty_to_consume}, Available: {stock_level.quantity_on_hand if stock_level else 0}",
            )

        # Create stock movement (issue)
        movement = StockMovement(
            item_id=mc.item_id,
            warehouse_id=mc.warehouse_id,
            movement_type="issue",
            quantity=-qty_to_consume,
            reference_type="work_order",
            reference_id=wo.id,
            notes=f"Consumed for WO {wo.wo_number}",
            created_by=current_user.id,
        )
        db.add(movement)
        await db.flush()

        # Update stock level
        stock_level.quantity_on_hand -= qty_to_consume

        # Update consumption record
        mc.actual_quantity = mc.planned_quantity
        mc.stock_movement_id = movement.id
        mc.consumed_at = func.now()

        # Check reorder
        item = await db.get(InventoryItem, mc.item_id)
        if item and stock_level.quantity_on_hand <= item.reorder_level:
            await event_bus.publish("stock.low", {
                "item_id": str(item.id),
                "item_name": item.name,
                "sku": item.sku,
                "warehouse_id": str(mc.warehouse_id),
                "quantity_on_hand": stock_level.quantity_on_hand,
                "reorder_level": item.reorder_level,
            })

    wo.status = "in_progress"
    wo.actual_start = func.now()
    await db.commit()
    await db.refresh(wo)

    await event_bus.publish("wo.started", {
        "wo_id": str(wo.id),
        "wo_number": wo.wo_number,
        "finished_item_id": str(wo.finished_item_id),
    })

    out = WorkOrderOut.model_validate(wo)
    fi = await db.get(InventoryItem, wo.finished_item_id)
    out.finished_item_name = fi.name if fi else None
    return out.model_dump()


@router.post(
    "/work-orders/{wo_id}/complete",
    summary="Complete a work order — add finished goods to inventory",
    dependencies=[Depends(require_app_admin("manufacturing"))],
)
async def complete_work_order(
    wo_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    completed_quantity: int = Query(..., description="Quantity of finished goods produced"),
    rejected_quantity: int = Query(0, description="Quantity rejected"),
) -> dict[str, Any]:
    wo = await db.get(WorkOrder, wo_id)
    if not wo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")

    if wo.status != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot complete work order with status '{wo.status}'",
        )

    # Add finished goods to target warehouse
    movement = StockMovement(
        item_id=wo.finished_item_id,
        warehouse_id=wo.target_warehouse_id,
        movement_type="receipt",
        quantity=completed_quantity,
        reference_type="work_order",
        reference_id=wo.id,
        notes=f"Finished goods from WO {wo.wo_number}",
        created_by=current_user.id,
    )
    db.add(movement)

    # Upsert stock level for finished goods
    sl_result = await db.execute(
        select(StockLevel).where(
            and_(
                StockLevel.item_id == wo.finished_item_id,
                StockLevel.warehouse_id == wo.target_warehouse_id,
            )
        )
    )
    stock_level = sl_result.scalar_one_or_none()

    if stock_level is None:
        stock_level = StockLevel(
            item_id=wo.finished_item_id,
            warehouse_id=wo.target_warehouse_id,
            quantity_on_hand=completed_quantity,
        )
        db.add(stock_level)
    else:
        stock_level.quantity_on_hand += completed_quantity

    wo.completed_quantity = completed_quantity
    wo.rejected_quantity = rejected_quantity
    wo.status = "completed"
    wo.actual_end = func.now()

    await db.commit()
    await db.refresh(wo)

    await event_bus.publish("wo.completed", {
        "wo_id": str(wo.id),
        "wo_number": wo.wo_number,
        "finished_item_id": str(wo.finished_item_id),
        "completed_quantity": completed_quantity,
        "rejected_quantity": rejected_quantity,
    })

    out = WorkOrderOut.model_validate(wo)
    fi = await db.get(InventoryItem, wo.finished_item_id)
    out.finished_item_name = fi.name if fi else None
    return out.model_dump()


@router.post(
    "/work-orders/{wo_id}/cancel",
    summary="Cancel a work order",
    dependencies=[Depends(require_app_admin("manufacturing"))],
)
async def cancel_work_order(
    wo_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    wo = await db.get(WorkOrder, wo_id)
    if not wo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")

    if wo.status in ("completed", "cancelled"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel work order with status '{wo.status}'",
        )

    wo.status = "cancelled"
    await db.commit()
    await db.refresh(wo)

    out = WorkOrderOut.model_validate(wo)
    return out.model_dump()


@router.get("/work-orders/{wo_id}/material-availability", summary="Check material availability for a work order")
async def check_material_availability(
    wo_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(WorkOrder)
        .options(selectinload(WorkOrder.materials))
        .where(WorkOrder.id == wo_id)
    )
    wo = result.scalar_one_or_none()
    if not wo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")

    availability = []
    for mc in wo.materials:
        item = await db.get(InventoryItem, mc.item_id)

        sl_result = await db.execute(
            select(StockLevel).where(
                and_(
                    StockLevel.item_id == mc.item_id,
                    StockLevel.warehouse_id == mc.warehouse_id,
                )
            )
        )
        stock_level = sl_result.scalar_one_or_none()
        on_hand = stock_level.quantity_on_hand if stock_level else 0
        required = int(mc.planned_quantity)

        availability.append({
            "item_id": str(mc.item_id),
            "item_name": item.name if item else None,
            "sku": item.sku if item else None,
            "required": required,
            "available": on_hand,
            "sufficient": on_hand >= required,
            "shortfall": max(required - on_hand, 0),
        })

    return availability


# ── Material Consumption endpoints ───────────────────────────────────────────

@router.post(
    "/work-orders/{wo_id}/consume",
    summary="Record additional material consumption for a work order",
    dependencies=[Depends(require_app_admin("manufacturing"))],
)
async def consume_material(
    wo_id: uuid.UUID,
    payload: MaterialConsumeIn,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    wo = await db.get(WorkOrder, wo_id)
    if not wo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")

    if wo.status != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Can only consume materials for in-progress work orders",
        )

    item = await db.get(InventoryItem, payload.item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    qty = int(payload.quantity)

    # Check stock
    sl_result = await db.execute(
        select(StockLevel).where(
            and_(
                StockLevel.item_id == payload.item_id,
                StockLevel.warehouse_id == wo.source_warehouse_id,
            )
        )
    )
    stock_level = sl_result.scalar_one_or_none()
    if not stock_level or stock_level.quantity_on_hand < qty:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Insufficient stock for '{item.name}'",
        )

    # Create stock movement
    movement = StockMovement(
        item_id=payload.item_id,
        warehouse_id=wo.source_warehouse_id,
        movement_type="issue",
        quantity=-qty,
        reference_type="work_order",
        reference_id=wo.id,
        notes=payload.notes or f"Additional consumption for WO {wo.wo_number}",
        created_by=current_user.id,
    )
    db.add(movement)
    await db.flush()

    stock_level.quantity_on_hand -= qty

    mc = MaterialConsumption(
        work_order_id=wo.id,
        item_id=payload.item_id,
        planned_quantity=payload.quantity,
        actual_quantity=payload.quantity,
        warehouse_id=wo.source_warehouse_id,
        stock_movement_id=movement.id,
        consumed_at=func.now(),
        notes=payload.notes,
    )
    db.add(mc)

    # Update total material cost
    wo.total_material_cost += payload.quantity * item.cost_price

    await db.commit()
    await db.refresh(mc)

    out = MaterialConsumptionOut.model_validate(mc)
    out.item_name = item.name
    return out.model_dump()


@router.get("/work-orders/{wo_id}/consumption", summary="List material consumption for a work order")
async def list_consumption(
    wo_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    wo = await db.get(WorkOrder, wo_id)
    if not wo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")

    result = await db.execute(
        select(MaterialConsumption)
        .where(MaterialConsumption.work_order_id == wo_id)
        .order_by(MaterialConsumption.created_at.asc())
    )
    consumptions = result.scalars().all()

    items_out = []
    for mc in consumptions:
        out = MaterialConsumptionOut.model_validate(mc)
        item = await db.get(InventoryItem, mc.item_id)
        out.item_name = item.name if item else None
        items_out.append(out.model_dump())

    return items_out


# ── Quality Check endpoints ──────────────────────────────────────────────────

@router.post(
    "/quality-checks",
    status_code=status.HTTP_201_CREATED,
    summary="Create a quality check for a work order",
    dependencies=[Depends(require_app_admin("manufacturing"))],
)
async def create_quality_check(
    payload: QualityCheckCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    wo = await db.get(WorkOrder, payload.work_order_id)
    if not wo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")

    check_number = await _generate_sequence(db, QualityCheck, "QC", "check_number")

    qc = QualityCheck(
        check_number=check_number,
        work_order_id=payload.work_order_id,
        inspector_id=current_user.id,
        quantity_inspected=payload.quantity_inspected,
        quantity_passed=payload.quantity_passed,
        quantity_failed=payload.quantity_failed,
        status=payload.status,
        parameters=payload.parameters,
        notes=payload.notes,
    )
    db.add(qc)
    await db.commit()
    await db.refresh(qc)
    return QualityCheckOut.model_validate(qc).model_dump()


@router.get("/quality-checks", summary="List quality checks")
async def list_quality_checks(
    current_user: CurrentUser,
    db: DBSession,
    work_order_id: uuid.UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(QualityCheck)

    if work_order_id:
        query = query.where(QualityCheck.work_order_id == work_order_id)
    if status_filter:
        query = query.where(QualityCheck.status == status_filter)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(QualityCheck.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    checks = result.scalars().all()
    return {
        "total": total,
        "quality_checks": [QualityCheckOut.model_validate(c).model_dump() for c in checks],
    }


@router.get("/quality-checks/{qc_id}", summary="Get quality check detail")
async def get_quality_check(
    qc_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    qc = await db.get(QualityCheck, qc_id)
    if not qc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quality check not found")
    return QualityCheckOut.model_validate(qc).model_dump()


# ── Dashboard ────────────────────────────────────────────────────────────────

@router.get("/dashboard/stats", summary="Manufacturing dashboard summary")
async def manufacturing_dashboard(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Active BOMs
    bom_result = await db.execute(
        select(func.count()).select_from(BillOfMaterials).where(
            BillOfMaterials.is_active == True  # noqa: E712
        )
    )
    total_boms = bom_result.scalar() or 0

    # Active workstations
    ws_result = await db.execute(
        select(func.count()).select_from(WorkStation).where(
            WorkStation.is_active == True  # noqa: E712
        )
    )
    total_workstations = ws_result.scalar() or 0

    # Work order counts by status
    for s in ("draft", "planned", "in_progress", "completed", "cancelled"):
        r = await db.execute(
            select(func.count()).select_from(WorkOrder).where(WorkOrder.status == s)
        )
        locals()[f"wo_{s}"] = r.scalar() or 0

    # Total material cost of in-progress work orders
    cost_result = await db.execute(
        select(func.coalesce(func.sum(WorkOrder.total_material_cost), 0))
        .select_from(WorkOrder)
        .where(WorkOrder.status == "in_progress")
    )
    in_progress_cost = cost_result.scalar() or Decimal("0")

    # Recent quality check fail rate (last 30 checks)
    qc_result = await db.execute(
        select(
            func.coalesce(func.sum(QualityCheck.quantity_inspected), 0),
            func.coalesce(func.sum(QualityCheck.quantity_failed), 0),
        )
        .select_from(QualityCheck)
    )
    row = qc_result.one()
    total_inspected = row[0] or 0
    total_failed = row[1] or 0
    defect_rate = round(float(total_failed) / max(total_inspected, 1) * 100, 2)

    return {
        "total_boms": total_boms,
        "total_workstations": total_workstations,
        "wo_draft": locals().get("wo_draft", 0),
        "wo_planned": locals().get("wo_planned", 0),
        "wo_in_progress": locals().get("wo_in_progress", 0),
        "wo_completed": locals().get("wo_completed", 0),
        "wo_cancelled": locals().get("wo_cancelled", 0),
        "in_progress_material_cost": str(in_progress_cost),
        "defect_rate_percent": defect_rate,
    }
