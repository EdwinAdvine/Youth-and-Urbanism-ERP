"""Supply Chain API — Suppliers, Requisitions, GRNs, Returns, Dashboard."""
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
from app.models.supplychain import (
    GoodsReceivedNote,
    GRNLine,
    ProcurementRequisition,
    RequisitionLine,
    Supplier,
    SupplierReturn,
    SupplierReturnLine,
)

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

# -- Suppliers --

class SupplierCreate(BaseModel):
    name: str
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    payment_terms: str | None = None
    payment_terms_days: int = 30
    rating: int | None = None
    tags: list[str] | None = None
    contact_id: uuid.UUID | None = None
    notes: str | None = None


class SupplierUpdate(BaseModel):
    name: str | None = None
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    payment_terms: str | None = None
    payment_terms_days: int | None = None
    rating: int | None = None
    tags: list[str] | None = None
    is_active: bool | None = None
    contact_id: uuid.UUID | None = None
    notes: str | None = None


class SupplierOut(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    contact_name: str | None
    email: str | None
    phone: str | None
    address: str | None
    payment_terms: str | None
    payment_terms_days: int
    rating: int | None
    tags: list[str] | None
    is_active: bool
    contact_id: uuid.UUID | None
    notes: str | None
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Requisitions --

class RequisitionLineIn(BaseModel):
    item_id: uuid.UUID
    quantity: int
    estimated_unit_price: Decimal = Decimal("0")
    supplier_id: uuid.UUID | None = None
    notes: str | None = None


class RequisitionLineOut(BaseModel):
    id: uuid.UUID
    requisition_id: uuid.UUID
    item_id: uuid.UUID
    quantity: int
    estimated_unit_price: Decimal
    supplier_id: uuid.UUID | None
    notes: str | None

    model_config = {"from_attributes": True}


class RequisitionCreate(BaseModel):
    title: str
    description: str | None = None
    department_id: uuid.UUID | None = None
    priority: str = "medium"
    required_by_date: date | None = None
    notes: str | None = None
    lines: list[RequisitionLineIn]


class RequisitionUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    department_id: uuid.UUID | None = None
    priority: str | None = None
    required_by_date: date | None = None
    notes: str | None = None
    lines: list[RequisitionLineIn] | None = None


class RequisitionOut(BaseModel):
    id: uuid.UUID
    requisition_number: str
    title: str
    description: str | None
    requested_by: uuid.UUID
    department_id: uuid.UUID | None
    status: str
    approved_by: uuid.UUID | None
    approved_at: Any | None
    priority: str
    required_by_date: date | None
    total_estimated: Decimal
    notes: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class RequisitionDetailOut(RequisitionOut):
    lines: list[RequisitionLineOut] = []


# -- GRN --

class GRNLineIn(BaseModel):
    po_line_id: uuid.UUID
    item_id: uuid.UUID
    ordered_quantity: int
    received_quantity: int
    accepted_quantity: int
    rejected_quantity: int = 0
    rejection_reason: str | None = None


class GRNLineOut(BaseModel):
    id: uuid.UUID
    grn_id: uuid.UUID
    po_line_id: uuid.UUID
    item_id: uuid.UUID
    ordered_quantity: int
    received_quantity: int
    accepted_quantity: int
    rejected_quantity: int
    rejection_reason: str | None

    model_config = {"from_attributes": True}


class GRNCreate(BaseModel):
    purchase_order_id: uuid.UUID
    supplier_id: uuid.UUID
    warehouse_id: uuid.UUID
    received_date: date
    notes: str | None = None
    lines: list[GRNLineIn]


class GRNOut(BaseModel):
    id: uuid.UUID
    grn_number: str
    purchase_order_id: uuid.UUID
    supplier_id: uuid.UUID
    warehouse_id: uuid.UUID
    received_by: uuid.UUID
    received_date: date
    status: str
    notes: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class GRNDetailOut(GRNOut):
    lines: list[GRNLineOut] = []


# -- Returns --

class ReturnLineIn(BaseModel):
    item_id: uuid.UUID
    quantity: int
    unit_cost: Decimal
    reason: str | None = None


class ReturnLineOut(BaseModel):
    id: uuid.UUID
    return_id: uuid.UUID
    item_id: uuid.UUID
    quantity: int
    unit_cost: Decimal
    reason: str | None

    model_config = {"from_attributes": True}


class ReturnCreate(BaseModel):
    supplier_id: uuid.UUID
    grn_id: uuid.UUID | None = None
    warehouse_id: uuid.UUID
    reason: str
    lines: list[ReturnLineIn]


class ReturnOut(BaseModel):
    id: uuid.UUID
    return_number: str
    supplier_id: uuid.UUID
    grn_id: uuid.UUID | None
    warehouse_id: uuid.UUID
    status: str
    reason: str
    total_value: Decimal
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class ReturnDetailOut(ReturnOut):
    lines: list[ReturnLineOut] = []


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _generate_sequence(db: DBSession, model: Any, prefix: str, number_field: str) -> str:
    """Generate an auto-incrementing number like REQ-2026-0001."""
    year = datetime.utcnow().year
    pattern = f"{prefix}-{year}-%"
    col = getattr(model, number_field)
    result = await db.execute(
        select(func.count()).select_from(model).where(col.like(pattern))
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}-{year}-{count:04d}"


async def _generate_supplier_code(db: DBSession) -> str:
    """Generate an auto-incrementing code like SUP-0001."""
    result = await db.execute(select(func.count()).select_from(Supplier))
    count = (result.scalar() or 0) + 1
    return f"SUP-{count:04d}"


# ══════════════════════════════════════════════════════════════════════════════
#  SUPPLIER ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/suppliers", summary="List suppliers")
async def list_suppliers(
    current_user: CurrentUser,
    db: DBSession,
    search: str | None = Query(None, description="Search by name, code, or email"),
    is_active: bool | None = Query(None, description="Filter by active status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Supplier)

    if is_active is not None:
        query = query.where(Supplier.is_active == is_active)
    if search:
        like_pattern = f"%{search}%"
        query = query.where(
            Supplier.name.ilike(like_pattern)
            | Supplier.code.ilike(like_pattern)
            | Supplier.email.ilike(like_pattern)
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Supplier.name.asc()).offset(skip).limit(limit)
    result = await db.execute(query)
    suppliers = result.scalars().all()
    return {
        "total": total,
        "suppliers": [SupplierOut.model_validate(s) for s in suppliers],
    }


@router.post(
    "/suppliers",
    status_code=status.HTTP_201_CREATED,
    summary="Create a supplier",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def create_supplier(
    payload: SupplierCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    code = await _generate_supplier_code(db)

    supplier = Supplier(
        name=payload.name,
        code=code,
        contact_name=payload.contact_name,
        email=payload.email,
        phone=payload.phone,
        address=payload.address,
        payment_terms=payload.payment_terms,
        payment_terms_days=payload.payment_terms_days,
        rating=payload.rating,
        tags=payload.tags,
        contact_id=payload.contact_id,
        notes=payload.notes,
        owner_id=current_user.id,
    )
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return SupplierOut.model_validate(supplier).model_dump()


@router.get("/suppliers/export", summary="Export suppliers as CSV")
async def export_suppliers(
    current_user: CurrentUser,
    db: DBSession,
):
    """Download all suppliers as a CSV file."""
    from app.core.export import rows_to_csv  # noqa: PLC0415

    result = await db.execute(
        select(Supplier).where(Supplier.is_active == True).order_by(Supplier.name)  # noqa: E712
    )
    suppliers = result.scalars().all()
    rows = [
        {
            "code": s.code,
            "name": s.name,
            "contact_name": s.contact_name or "",
            "email": s.email or "",
            "phone": s.phone or "",
            "payment_terms": s.payment_terms or "",
            "payment_terms_days": s.payment_terms_days,
            "rating": s.rating or "",
            "is_active": s.is_active,
            "created_at": s.created_at.isoformat(),
        }
        for s in suppliers
    ]
    columns = ["code", "name", "contact_name", "email", "phone", "payment_terms", "payment_terms_days", "rating", "is_active", "created_at"]
    return rows_to_csv(rows, columns, "suppliers.csv")


@router.get("/suppliers/{supplier_id}", summary="Get supplier detail")
async def get_supplier(
    supplier_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return SupplierOut.model_validate(supplier).model_dump()


@router.put(
    "/suppliers/{supplier_id}",
    summary="Update a supplier",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def update_supplier(
    supplier_id: uuid.UUID,
    payload: SupplierUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(supplier, field, value)

    await db.commit()
    await db.refresh(supplier)
    return SupplierOut.model_validate(supplier).model_dump()


@router.delete(
    "/suppliers/{supplier_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete a supplier",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def delete_supplier(
    supplier_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    supplier.is_active = False
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ══════════════════════════════════════════════════════════════════════════════
#  REQUISITION ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/requisitions", summary="List procurement requisitions")
async def list_requisitions(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    priority: str | None = Query(None, description="Filter by priority"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(ProcurementRequisition)

    if status_filter:
        query = query.where(ProcurementRequisition.status == status_filter)
    if priority:
        query = query.where(ProcurementRequisition.priority == priority)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(ProcurementRequisition.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    reqs = result.scalars().all()
    return {
        "total": total,
        "requisitions": [RequisitionOut.model_validate(r) for r in reqs],
    }


@router.post(
    "/requisitions",
    status_code=status.HTTP_201_CREATED,
    summary="Create a procurement requisition",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def create_requisition(
    payload: RequisitionCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    if not payload.lines:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one line item is required",
        )

    req_number = await _generate_sequence(
        db, ProcurementRequisition, "REQ", "requisition_number"
    )

    total_estimated = sum(
        Decimal(str(line.quantity)) * line.estimated_unit_price for line in payload.lines
    )

    req = ProcurementRequisition(
        requisition_number=req_number,
        title=payload.title,
        description=payload.description,
        requested_by=current_user.id,
        department_id=payload.department_id,
        priority=payload.priority,
        required_by_date=payload.required_by_date,
        total_estimated=total_estimated,
        notes=payload.notes,
    )
    db.add(req)
    await db.flush()

    for line_data in payload.lines:
        line = RequisitionLine(
            requisition_id=req.id,
            item_id=line_data.item_id,
            quantity=line_data.quantity,
            estimated_unit_price=line_data.estimated_unit_price,
            supplier_id=line_data.supplier_id,
            notes=line_data.notes,
        )
        db.add(line)

    await db.commit()

    result = await db.execute(
        select(ProcurementRequisition)
        .options(selectinload(ProcurementRequisition.lines))
        .where(ProcurementRequisition.id == req.id)
    )
    req = result.scalar_one()
    return RequisitionDetailOut.model_validate(req).model_dump()


@router.get("/requisitions/{req_id}", summary="Get requisition detail")
async def get_requisition(
    req_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(ProcurementRequisition)
        .options(selectinload(ProcurementRequisition.lines))
        .where(ProcurementRequisition.id == req_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requisition not found")
    return RequisitionDetailOut.model_validate(req).model_dump()


@router.put(
    "/requisitions/{req_id}",
    summary="Update a draft requisition",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def update_requisition(
    req_id: uuid.UUID,
    payload: RequisitionUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(ProcurementRequisition)
        .options(selectinload(ProcurementRequisition.lines))
        .where(ProcurementRequisition.id == req_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requisition not found")

    if req.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only draft requisitions can be updated",
        )

    if payload.title is not None:
        req.title = payload.title
    if payload.description is not None:
        req.description = payload.description
    if payload.department_id is not None:
        req.department_id = payload.department_id
    if payload.priority is not None:
        req.priority = payload.priority
    if payload.required_by_date is not None:
        req.required_by_date = payload.required_by_date
    if payload.notes is not None:
        req.notes = payload.notes

    if payload.lines is not None:
        if not payload.lines:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="At least one line item is required",
            )
        for existing_line in req.lines:
            await db.delete(existing_line)

        total_estimated = Decimal("0")
        for line_data in payload.lines:
            line = RequisitionLine(
                requisition_id=req.id,
                item_id=line_data.item_id,
                quantity=line_data.quantity,
                estimated_unit_price=line_data.estimated_unit_price,
                supplier_id=line_data.supplier_id,
                notes=line_data.notes,
            )
            db.add(line)
            total_estimated += Decimal(str(line_data.quantity)) * line_data.estimated_unit_price
        req.total_estimated = total_estimated

    await db.commit()

    result = await db.execute(
        select(ProcurementRequisition)
        .options(selectinload(ProcurementRequisition.lines))
        .where(ProcurementRequisition.id == req.id)
    )
    req = result.scalar_one()
    return RequisitionDetailOut.model_validate(req).model_dump()


@router.post(
    "/requisitions/{req_id}/submit",
    summary="Submit a requisition for approval",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def submit_requisition(
    req_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    req = await db.get(ProcurementRequisition, req_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requisition not found")

    if req.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot submit requisition with status '{req.status}'",
        )

    req.status = "submitted"
    await db.commit()
    await db.refresh(req)
    return RequisitionOut.model_validate(req).model_dump()


@router.post(
    "/requisitions/{req_id}/approve",
    summary="Approve or reject a requisition",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def approve_requisition(
    req_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    action: str = Query(..., description="approve or reject"),
) -> dict[str, Any]:
    req = await db.get(ProcurementRequisition, req_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requisition not found")

    if req.status != "submitted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot approve/reject requisition with status '{req.status}'",
        )

    if action not in ("approve", "reject"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="action must be 'approve' or 'reject'",
        )

    req.status = "approved" if action == "approve" else "rejected"
    req.approved_by = current_user.id
    req.approved_at = datetime.utcnow()
    await db.commit()
    await db.refresh(req)
    return RequisitionOut.model_validate(req).model_dump()


@router.post(
    "/requisitions/{req_id}/convert-to-po",
    summary="Convert an approved requisition into a purchase order",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def convert_requisition_to_po(
    req_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(ProcurementRequisition)
        .options(selectinload(ProcurementRequisition.lines))
        .where(ProcurementRequisition.id == req_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requisition not found")

    if req.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only approved requisitions can be converted to PO",
        )

    if not req.lines:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Requisition has no line items",
        )

    # Determine supplier name from the first line that has a supplier
    supplier_name = "TBD"
    for line in req.lines:
        if line.supplier_id:
            supplier = await db.get(Supplier, line.supplier_id)
            if supplier:
                supplier_name = supplier.name
                break

    # Generate PO number using inventory PO pattern
    year = datetime.utcnow().year
    pattern = f"PO-{year}-%"
    po_count_result = await db.execute(
        select(func.count()).select_from(PurchaseOrder).where(
            PurchaseOrder.po_number.like(pattern)
        )
    )
    po_count = (po_count_result.scalar() or 0) + 1
    po_number = f"PO-{year}-{po_count:04d}"

    total = sum(
        Decimal(str(line.quantity)) * line.estimated_unit_price for line in req.lines
    )

    from datetime import date as date_type
    po = PurchaseOrder(
        po_number=po_number,
        supplier_name=supplier_name,
        order_date=date_type.today(),
        expected_date=req.required_by_date,
        total=total,
        notes=f"Created from requisition {req.requisition_number}",
        owner_id=current_user.id,
    )
    db.add(po)
    await db.flush()

    for line in req.lines:
        po_line = PurchaseOrderLine(
            purchase_order_id=po.id,
            item_id=line.item_id,
            quantity=line.quantity,
            unit_price=line.estimated_unit_price,
        )
        db.add(po_line)

    req.status = "converted_to_po"
    await db.commit()

    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .where(PurchaseOrder.id == po.id)
    )
    po = result.scalar_one()
    return {
        "message": f"Requisition {req.requisition_number} converted to PO {po.po_number}",
        "purchase_order_id": str(po.id),
        "po_number": po.po_number,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  GRN ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/grn", summary="List goods received notes")
async def list_grns(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(GoodsReceivedNote)

    if status_filter:
        query = query.where(GoodsReceivedNote.status == status_filter)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(GoodsReceivedNote.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    grns = result.scalars().all()
    return {
        "total": total,
        "grns": [GRNOut.model_validate(g) for g in grns],
    }


@router.post(
    "/grn",
    status_code=status.HTTP_201_CREATED,
    summary="Create a GRN from a purchase order",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def create_grn(
    payload: GRNCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Validate PO exists
    po = await db.get(PurchaseOrder, payload.purchase_order_id)
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    # Validate supplier exists
    supplier = await db.get(Supplier, payload.supplier_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    # Validate warehouse exists
    warehouse = await db.get(Warehouse, payload.warehouse_id)
    if not warehouse or not warehouse.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    if not payload.lines:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one GRN line is required",
        )

    grn_number = await _generate_sequence(db, GoodsReceivedNote, "GRN", "grn_number")

    grn = GoodsReceivedNote(
        grn_number=grn_number,
        purchase_order_id=payload.purchase_order_id,
        supplier_id=payload.supplier_id,
        warehouse_id=payload.warehouse_id,
        received_by=current_user.id,
        received_date=payload.received_date,
        notes=payload.notes,
    )
    db.add(grn)
    await db.flush()

    for line_data in payload.lines:
        line = GRNLine(
            grn_id=grn.id,
            po_line_id=line_data.po_line_id,
            item_id=line_data.item_id,
            ordered_quantity=line_data.ordered_quantity,
            received_quantity=line_data.received_quantity,
            accepted_quantity=line_data.accepted_quantity,
            rejected_quantity=line_data.rejected_quantity,
            rejection_reason=line_data.rejection_reason,
        )
        db.add(line)

    await db.commit()

    result = await db.execute(
        select(GoodsReceivedNote)
        .options(selectinload(GoodsReceivedNote.lines))
        .where(GoodsReceivedNote.id == grn.id)
    )
    grn = result.scalar_one()
    return GRNDetailOut.model_validate(grn).model_dump()


@router.get("/grn/{grn_id}", summary="Get GRN detail")
async def get_grn(
    grn_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(GoodsReceivedNote)
        .options(selectinload(GoodsReceivedNote.lines))
        .where(GoodsReceivedNote.id == grn_id)
    )
    grn = result.scalar_one_or_none()
    if not grn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GRN not found")
    return GRNDetailOut.model_validate(grn).model_dump()


@router.post(
    "/grn/{grn_id}/accept",
    summary="Accept a GRN and create stock movements",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def accept_grn(
    grn_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(GoodsReceivedNote)
        .options(selectinload(GoodsReceivedNote.lines))
        .where(GoodsReceivedNote.id == grn_id)
    )
    grn = result.scalar_one_or_none()
    if not grn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GRN not found")

    if grn.status not in ("draft", "inspecting"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot accept GRN with status '{grn.status}'",
        )

    all_accepted = True
    for grn_line in grn.lines:
        if grn_line.accepted_quantity <= 0:
            continue

        # Create stock movement for accepted quantity
        movement = StockMovement(
            item_id=grn_line.item_id,
            warehouse_id=grn.warehouse_id,
            movement_type="receipt",
            quantity=grn_line.accepted_quantity,
            reference_type="grn",
            reference_id=grn.id,
            notes=f"Received via GRN {grn.grn_number}",
            created_by=current_user.id,
        )
        db.add(movement)

        # Upsert stock level
        sl_result = await db.execute(
            select(StockLevel).where(
                and_(
                    StockLevel.item_id == grn_line.item_id,
                    StockLevel.warehouse_id == grn.warehouse_id,
                )
            )
        )
        stock_level = sl_result.scalar_one_or_none()

        if stock_level is None:
            stock_level = StockLevel(
                item_id=grn_line.item_id,
                warehouse_id=grn.warehouse_id,
                quantity_on_hand=grn_line.accepted_quantity,
            )
            db.add(stock_level)
        else:
            stock_level.quantity_on_hand += grn_line.accepted_quantity

        # Update PO line received quantity
        po_line = await db.get(PurchaseOrderLine, grn_line.po_line_id)
        if po_line:
            po_line.received_quantity += grn_line.accepted_quantity

        # Track if any line was not fully accepted
        if grn_line.accepted_quantity < grn_line.received_quantity:
            all_accepted = False

        # Check reorder level for event
        item = await db.get(InventoryItem, grn_line.item_id)
        if item and stock_level.quantity_on_hand <= item.reorder_level:
            await event_bus.publish("stock.low", {
                "item_id": str(item.id),
                "item_name": item.name,
                "sku": item.sku,
                "warehouse_id": str(grn.warehouse_id),
                "quantity_on_hand": stock_level.quantity_on_hand,
                "reorder_level": item.reorder_level,
            })

    grn.status = "accepted" if all_accepted else "partial"
    await db.commit()
    await db.refresh(grn)

    # Publish event for cross-module integrations (SupplyChain→Inventory, notifications)
    await event_bus.publish("supplychain.goods_received", {
        "grn_id": str(grn.id),
        "grn_number": grn.grn_number,
        "warehouse_id": str(grn.warehouse_id),
        "supplier_id": str(grn.supplier_id),
        "received_by": str(grn.received_by),
        "items": [
            {
                "item_id": str(gl.item_id),
                "accepted_quantity": gl.accepted_quantity,
                "rejected_quantity": gl.rejected_quantity,
            }
            for gl in grn.lines
        ],
    })

    return GRNOut.model_validate(grn).model_dump()


@router.post(
    "/grn/{grn_id}/reject",
    summary="Reject a GRN",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def reject_grn(
    grn_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    grn = await db.get(GoodsReceivedNote, grn_id)
    if not grn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GRN not found")

    if grn.status not in ("draft", "inspecting"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot reject GRN with status '{grn.status}'",
        )

    grn.status = "rejected"
    await db.commit()
    await db.refresh(grn)
    return GRNOut.model_validate(grn).model_dump()


# ══════════════════════════════════════════════════════════════════════════════
#  SUPPLIER RETURN ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/returns", summary="List supplier returns")
async def list_returns(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(SupplierReturn)

    if status_filter:
        query = query.where(SupplierReturn.status == status_filter)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(SupplierReturn.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    returns = result.scalars().all()
    return {
        "total": total,
        "returns": [ReturnOut.model_validate(r) for r in returns],
    }


@router.post(
    "/returns",
    status_code=status.HTTP_201_CREATED,
    summary="Create a supplier return",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def create_return(
    payload: ReturnCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Validate supplier
    supplier = await db.get(Supplier, payload.supplier_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    # Validate warehouse
    warehouse = await db.get(Warehouse, payload.warehouse_id)
    if not warehouse or not warehouse.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    if not payload.lines:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one return line is required",
        )

    return_number = await _generate_sequence(db, SupplierReturn, "RTS", "return_number")

    total_value = sum(
        Decimal(str(line.quantity)) * line.unit_cost for line in payload.lines
    )

    ret = SupplierReturn(
        return_number=return_number,
        supplier_id=payload.supplier_id,
        grn_id=payload.grn_id,
        warehouse_id=payload.warehouse_id,
        reason=payload.reason,
        total_value=total_value,
        created_by=current_user.id,
    )
    db.add(ret)
    await db.flush()

    for line_data in payload.lines:
        line = SupplierReturnLine(
            return_id=ret.id,
            item_id=line_data.item_id,
            quantity=line_data.quantity,
            unit_cost=line_data.unit_cost,
            reason=line_data.reason,
        )
        db.add(line)

    await db.commit()

    result = await db.execute(
        select(SupplierReturn)
        .options(selectinload(SupplierReturn.lines))
        .where(SupplierReturn.id == ret.id)
    )
    ret = result.scalar_one()
    return ReturnDetailOut.model_validate(ret).model_dump()


@router.get("/returns/{return_id}", summary="Get supplier return detail")
async def get_return(
    return_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(SupplierReturn)
        .options(selectinload(SupplierReturn.lines))
        .where(SupplierReturn.id == return_id)
    )
    ret = result.scalar_one_or_none()
    if not ret:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Return not found")
    return ReturnDetailOut.model_validate(ret).model_dump()


@router.post(
    "/returns/{return_id}/approve",
    summary="Approve a supplier return",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def approve_return(
    return_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    ret = await db.get(SupplierReturn, return_id)
    if not ret:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Return not found")

    if ret.status not in ("draft", "pending_approval"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot approve return with status '{ret.status}'",
        )

    ret.status = "approved"
    await db.commit()
    await db.refresh(ret)
    return ReturnOut.model_validate(ret).model_dump()


@router.post(
    "/returns/{return_id}/complete",
    summary="Complete a supplier return (creates stock issue movements)",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def complete_return(
    return_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(SupplierReturn)
        .options(selectinload(SupplierReturn.lines))
        .where(SupplierReturn.id == return_id)
    )
    ret = result.scalar_one_or_none()
    if not ret:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Return not found")

    if ret.status not in ("approved", "shipped"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot complete return with status '{ret.status}'",
        )

    for ret_line in ret.lines:
        # Create stock issue movement (negative stock)
        movement = StockMovement(
            item_id=ret_line.item_id,
            warehouse_id=ret.warehouse_id,
            movement_type="issue",
            quantity=-ret_line.quantity,
            reference_type="supplier_return",
            reference_id=ret.id,
            notes=f"Returned to supplier via {ret.return_number}",
            created_by=current_user.id,
        )
        db.add(movement)

        # Update stock level
        sl_result = await db.execute(
            select(StockLevel).where(
                and_(
                    StockLevel.item_id == ret_line.item_id,
                    StockLevel.warehouse_id == ret.warehouse_id,
                )
            )
        )
        stock_level = sl_result.scalar_one_or_none()
        if stock_level:
            stock_level.quantity_on_hand -= ret_line.quantity

            # Check reorder level
            item = await db.get(InventoryItem, ret_line.item_id)
            if item and stock_level.quantity_on_hand <= item.reorder_level:
                await event_bus.publish("stock.low", {
                    "item_id": str(item.id),
                    "item_name": item.name,
                    "sku": item.sku,
                    "warehouse_id": str(ret.warehouse_id),
                    "quantity_on_hand": stock_level.quantity_on_hand,
                    "reorder_level": item.reorder_level,
                })

    ret.status = "completed"
    await db.commit()
    await db.refresh(ret)
    return ReturnOut.model_validate(ret).model_dump()


# ══════════════════════════════════════════════════════════════════════════════
#  DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/dashboard/stats", summary="Supply chain dashboard summary")
async def supply_chain_dashboard(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Total active suppliers
    suppliers_result = await db.execute(
        select(func.count()).select_from(Supplier).where(
            Supplier.is_active == True  # noqa: E712
        )
    )
    total_suppliers = suppliers_result.scalar() or 0

    # Pending requisitions (submitted, waiting for approval)
    pending_reqs_result = await db.execute(
        select(func.count()).select_from(ProcurementRequisition).where(
            ProcurementRequisition.status == "submitted"
        )
    )
    pending_requisitions = pending_reqs_result.scalar() or 0

    # Open GRNs (draft + inspecting)
    open_grns_result = await db.execute(
        select(func.count()).select_from(GoodsReceivedNote).where(
            GoodsReceivedNote.status.in_(["draft", "inspecting"])
        )
    )
    open_grns = open_grns_result.scalar() or 0

    # Pending returns (draft + pending_approval + approved)
    pending_returns_result = await db.execute(
        select(func.count()).select_from(SupplierReturn).where(
            SupplierReturn.status.in_(["draft", "pending_approval", "approved"])
        )
    )
    pending_returns = pending_returns_result.scalar() or 0

    # Total requisition value (approved, not yet converted)
    req_value_result = await db.execute(
        select(func.coalesce(func.sum(ProcurementRequisition.total_estimated), 0))
        .select_from(ProcurementRequisition)
        .where(ProcurementRequisition.status == "approved")
    )
    pending_requisition_value = req_value_result.scalar() or Decimal("0")

    # Total return value (pending)
    return_value_result = await db.execute(
        select(func.coalesce(func.sum(SupplierReturn.total_value), 0))
        .select_from(SupplierReturn)
        .where(SupplierReturn.status.in_(["draft", "pending_approval", "approved"]))
    )
    pending_return_value = return_value_result.scalar() or Decimal("0")

    return {
        "total_suppliers": total_suppliers,
        "pending_requisitions": pending_requisitions,
        "open_grns": open_grns,
        "pending_returns": pending_returns,
        "pending_requisition_value": str(pending_requisition_value),
        "pending_return_value": str(pending_return_value),
    }
