"""Manufacturing Traceability API — Lot/Serial Tracking, Genealogy, Batch Records."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.models.manufacturing import (
    ElectronicBatchRecord,
    LotSerialTrack,
    TraceabilityEvent,
)

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

# -- Lot/Serial --

class LotSerialCreate(BaseModel):
    tracking_number: str
    tracking_type: str = "lot"  # lot, serial
    item_id: uuid.UUID
    work_order_id: uuid.UUID | None = None
    parent_tracking_id: uuid.UUID | None = None
    quantity: Decimal = Decimal("1")
    manufactured_date: date | None = None
    expiry_date: date | None = None
    supplier_id: uuid.UUID | None = None
    grn_id: uuid.UUID | None = None
    metadata_json: dict | None = None


class LotSerialOut(BaseModel):
    id: uuid.UUID
    tracking_number: str
    tracking_type: str
    item_id: uuid.UUID
    work_order_id: uuid.UUID | None
    parent_tracking_id: uuid.UUID | None
    quantity: Decimal
    status: str
    manufactured_date: date | None
    expiry_date: date | None
    supplier_id: uuid.UUID | None
    grn_id: uuid.UUID | None
    metadata_json: dict | None
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Traceability Event --

class TraceEventCreate(BaseModel):
    event_type: str  # created, consumed, produced, inspected, shipped, recalled
    work_order_id: uuid.UUID | None = None
    reference_type: str | None = None
    reference_id: uuid.UUID | None = None
    quantity: Decimal | None = None
    notes: str | None = None


class TraceEventOut(BaseModel):
    id: uuid.UUID
    lot_serial_id: uuid.UUID
    event_type: str
    work_order_id: uuid.UUID | None
    reference_type: str | None
    reference_id: uuid.UUID | None
    quantity: Decimal | None
    notes: str | None
    event_timestamp: datetime
    recorded_by: uuid.UUID

    model_config = {"from_attributes": True}


# -- Batch Record --

class BatchRecordCreate(BaseModel):
    batch_number: str
    work_order_id: uuid.UUID
    bom_id: uuid.UUID
    material_verification: dict | None = None
    process_parameters: dict | None = None
    quality_results: dict | None = None


class BatchRecordUpdate(BaseModel):
    status: str | None = None
    material_verification: dict | None = None
    process_parameters: dict | None = None
    quality_results: dict | None = None
    deviations: dict | None = None


class BatchRecordOut(BaseModel):
    id: uuid.UUID
    batch_number: str
    work_order_id: uuid.UUID
    bom_id: uuid.UUID
    status: str
    material_verification: dict | None
    process_parameters: dict | None
    quality_results: dict | None
    deviations: dict | None
    approved_by: uuid.UUID | None
    approved_at: datetime | None
    electronic_signature: str | None
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class BatchRecordApproveIn(BaseModel):
    electronic_signature: str


# ── Lot/Serial Endpoints ─────────────────────────────────────────────────────

@router.post("/lots", response_model=LotSerialOut, status_code=status.HTTP_201_CREATED)
async def create_lot_serial(body: LotSerialCreate, db: DBSession, user: CurrentUser):
    # Check uniqueness
    existing = await db.execute(
        select(LotSerialTrack).where(LotSerialTrack.tracking_number == body.tracking_number)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Tracking number already exists")

    lot = LotSerialTrack(
        **body.model_dump(),
        created_by=user.id,
    )
    db.add(lot)
    await db.flush()

    # Auto-create initial traceability event
    event = TraceabilityEvent(
        lot_serial_id=lot.id,
        event_type="created",
        work_order_id=body.work_order_id,
        quantity=body.quantity,
        notes=f"Lot/serial {body.tracking_number} created",
        recorded_by=user.id,
    )
    db.add(event)

    await db.commit()
    await db.refresh(lot)
    return lot


@router.get("/lots", response_model=list[LotSerialOut])
async def list_lots(
    db: DBSession,
    user: CurrentUser,
    item_id: uuid.UUID | None = None,
    work_order_id: uuid.UUID | None = None,
    tracking_type: str | None = None,
    lot_status: str | None = Query(None, alias="status"),
    skip: int = 0,
    limit: int = 50,
):
    q = select(LotSerialTrack).order_by(LotSerialTrack.created_at.desc())
    if item_id:
        q = q.where(LotSerialTrack.item_id == item_id)
    if work_order_id:
        q = q.where(LotSerialTrack.work_order_id == work_order_id)
    if tracking_type:
        q = q.where(LotSerialTrack.tracking_type == tracking_type)
    if lot_status:
        q = q.where(LotSerialTrack.status == lot_status)
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/lots/{lot_id}", response_model=LotSerialOut)
async def get_lot_serial(lot_id: uuid.UUID, db: DBSession, user: CurrentUser):
    lot = await db.get(LotSerialTrack, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot/serial not found")
    return lot


@router.post("/lots/{lot_id}/events", response_model=TraceEventOut, status_code=status.HTTP_201_CREATED)
async def record_trace_event(lot_id: uuid.UUID, body: TraceEventCreate, db: DBSession, user: CurrentUser):
    lot = await db.get(LotSerialTrack, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot/serial not found")

    event = TraceabilityEvent(
        lot_serial_id=lot_id,
        event_type=body.event_type,
        work_order_id=body.work_order_id,
        reference_type=body.reference_type,
        reference_id=body.reference_id,
        quantity=body.quantity,
        notes=body.notes,
        recorded_by=user.id,
    )
    db.add(event)

    # Update lot status based on event
    status_map = {
        "consumed": "consumed",
        "shipped": "shipped",
        "recalled": "recalled",
    }
    if body.event_type in status_map:
        lot.status = status_map[body.event_type]

    await db.commit()
    await db.refresh(event)
    return event


@router.get("/lots/{lot_id}/events", response_model=list[TraceEventOut])
async def get_lot_events(lot_id: uuid.UUID, db: DBSession, user: CurrentUser):
    result = await db.execute(
        select(TraceabilityEvent)
        .where(TraceabilityEvent.lot_serial_id == lot_id)
        .order_by(TraceabilityEvent.event_timestamp)
    )
    return result.scalars().all()


@router.get("/lots/{lot_id}/trace-forward")
async def trace_forward(lot_id: uuid.UUID, db: DBSession, user: CurrentUser):
    """Forward traceability: where did this lot/serial go?"""
    lot = await db.get(LotSerialTrack, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot/serial not found")

    # Find all children recursively (produced from this lot)
    children = []
    queue = [lot_id]
    visited = set()

    while queue:
        current_id = queue.pop(0)
        if current_id in visited:
            continue
        visited.add(current_id)

        result = await db.execute(
            select(LotSerialTrack)
            .where(LotSerialTrack.parent_tracking_id == current_id)
        )
        child_lots = result.scalars().all()
        for child in child_lots:
            children.append({
                "id": str(child.id),
                "tracking_number": child.tracking_number,
                "tracking_type": child.tracking_type,
                "item_id": str(child.item_id),
                "status": child.status,
                "quantity": float(child.quantity),
                "work_order_id": str(child.work_order_id) if child.work_order_id else None,
            })
            queue.append(child.id)

    # Find related events (where this lot was consumed/shipped)
    events_result = await db.execute(
        select(TraceabilityEvent)
        .where(
            TraceabilityEvent.lot_serial_id == lot_id,
            TraceabilityEvent.event_type.in_(["consumed", "shipped", "produced"]),
        )
        .order_by(TraceabilityEvent.event_timestamp)
    )
    events = events_result.scalars().all()

    return {
        "lot": {
            "id": str(lot.id),
            "tracking_number": lot.tracking_number,
            "item_id": str(lot.item_id),
            "status": lot.status,
        },
        "downstream_lots": children,
        "events": [
            {
                "event_type": e.event_type,
                "timestamp": e.event_timestamp.isoformat() if e.event_timestamp else None,
                "work_order_id": str(e.work_order_id) if e.work_order_id else None,
                "quantity": float(e.quantity) if e.quantity else None,
                "notes": e.notes,
            }
            for e in events
        ],
    }


@router.get("/lots/{lot_id}/trace-backward")
async def trace_backward(lot_id: uuid.UUID, db: DBSession, user: CurrentUser):
    """Backward traceability: where did this lot/serial come from?"""
    lot = await db.get(LotSerialTrack, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot/serial not found")

    # Walk up the parent chain
    ancestors = []
    current = lot
    visited = set()

    while current.parent_tracking_id and current.parent_tracking_id not in visited:
        visited.add(current.parent_tracking_id)
        parent = await db.get(LotSerialTrack, current.parent_tracking_id)
        if not parent:
            break
        ancestors.append({
            "id": str(parent.id),
            "tracking_number": parent.tracking_number,
            "tracking_type": parent.tracking_type,
            "item_id": str(parent.item_id),
            "status": parent.status,
            "quantity": float(parent.quantity),
            "supplier_id": str(parent.supplier_id) if parent.supplier_id else None,
            "grn_id": str(parent.grn_id) if parent.grn_id else None,
        })
        current = parent

    return {
        "lot": {
            "id": str(lot.id),
            "tracking_number": lot.tracking_number,
            "item_id": str(lot.item_id),
            "status": lot.status,
        },
        "upstream_lots": ancestors,
        "origin": ancestors[-1] if ancestors else {
            "id": str(lot.id),
            "tracking_number": lot.tracking_number,
            "supplier_id": str(lot.supplier_id) if lot.supplier_id else None,
            "grn_id": str(lot.grn_id) if lot.grn_id else None,
        },
    }


@router.get("/lots/{lot_id}/genealogy")
async def get_genealogy(lot_id: uuid.UUID, db: DBSession, user: CurrentUser):
    """Product genealogy tree — parent and child relationships."""
    lot = await db.get(LotSerialTrack, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot/serial not found")

    async def _build_tree(node_id: uuid.UUID, depth: int = 0, max_depth: int = 10) -> dict:
        node = await db.get(LotSerialTrack, node_id)
        if not node or depth > max_depth:
            return {}

        result = await db.execute(
            select(LotSerialTrack).where(LotSerialTrack.parent_tracking_id == node_id)
        )
        children_lots = result.scalars().all()

        return {
            "id": str(node.id),
            "tracking_number": node.tracking_number,
            "tracking_type": node.tracking_type,
            "item_id": str(node.item_id),
            "status": node.status,
            "quantity": float(node.quantity),
            "children": [await _build_tree(c.id, depth + 1) for c in children_lots],
        }

    # Find root (walk up to top parent)
    root = lot
    visited = set()
    while root.parent_tracking_id and root.parent_tracking_id not in visited:
        visited.add(root.parent_tracking_id)
        parent = await db.get(LotSerialTrack, root.parent_tracking_id)
        if not parent:
            break
        root = parent

    tree = await _build_tree(root.id)
    return {"genealogy_tree": tree, "queried_lot_id": str(lot_id)}


# ── Batch Record Endpoints ───────────────────────────────────────────────────

@router.post("/batch-records", response_model=BatchRecordOut, status_code=status.HTTP_201_CREATED)
async def create_batch_record(body: BatchRecordCreate, db: DBSession, user: CurrentUser):
    # Check uniqueness
    existing = await db.execute(
        select(ElectronicBatchRecord).where(ElectronicBatchRecord.batch_number == body.batch_number)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Batch number already exists")

    record = ElectronicBatchRecord(
        **body.model_dump(),
        owner_id=user.id,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.get("/batch-records", response_model=list[BatchRecordOut])
async def list_batch_records(
    db: DBSession,
    user: CurrentUser,
    work_order_id: uuid.UUID | None = None,
    record_status: str | None = Query(None, alias="status"),
    skip: int = 0,
    limit: int = 50,
):
    q = select(ElectronicBatchRecord).order_by(ElectronicBatchRecord.created_at.desc())
    if work_order_id:
        q = q.where(ElectronicBatchRecord.work_order_id == work_order_id)
    if record_status:
        q = q.where(ElectronicBatchRecord.status == record_status)
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/batch-records/{record_id}", response_model=BatchRecordOut)
async def get_batch_record(record_id: uuid.UUID, db: DBSession, user: CurrentUser):
    record = await db.get(ElectronicBatchRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Batch record not found")
    return record


@router.put("/batch-records/{record_id}", response_model=BatchRecordOut)
async def update_batch_record(record_id: uuid.UUID, body: BatchRecordUpdate, db: DBSession, user: CurrentUser):
    record = await db.get(ElectronicBatchRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Batch record not found")
    if record.status == "approved":
        raise HTTPException(status_code=400, detail="Cannot modify approved batch record")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(record, field, value)
    await db.commit()
    await db.refresh(record)
    return record


@router.post("/batch-records/{record_id}/approve", response_model=BatchRecordOut)
async def approve_batch_record(record_id: uuid.UUID, body: BatchRecordApproveIn, db: DBSession, user: CurrentUser):
    record = await db.get(ElectronicBatchRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Batch record not found")
    if record.status not in ("completed", "reviewed"):
        raise HTTPException(status_code=400, detail="Batch record must be completed or reviewed before approval")

    record.status = "approved"
    record.approved_by = user.id
    record.approved_at = func.now()
    record.electronic_signature = body.electronic_signature

    await db.commit()
    await db.refresh(record)
    return record
