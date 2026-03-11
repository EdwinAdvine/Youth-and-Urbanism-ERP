"""Supply Chain Extensions — Shipments, Returns, Quality Inspections, Ratings, Contracts, Reports."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, select

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.models.supplychain import (
    Contract,
    GoodsReceivedNote,
    QualityInspection,
    ReturnOrder,
    Shipment,
    Supplier,
    SupplierRating,
)

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

# -- Shipments --

class ShipmentCreate(BaseModel):
    order_id: uuid.UUID
    carrier: str
    tracking_no: str | None = None
    destination: str
    status: str = "pending"
    shipped_at: datetime | None = None


class ShipmentOut(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    carrier: str
    tracking_no: str | None
    status: str
    shipped_at: Any | None
    delivered_at: Any | None
    destination: str
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class ShipmentTrackUpdate(BaseModel):
    tracking_no: str | None = None
    status: str | None = None
    shipped_at: datetime | None = None
    delivered_at: datetime | None = None


# -- Return Orders --

class ReturnOrderCreate(BaseModel):
    original_order_id: uuid.UUID
    reason: str
    return_items: dict | None = None


class ReturnOrderUpdate(BaseModel):
    reason: str | None = None
    status: str | None = None
    return_items: dict | None = None


class ReturnOrderOut(BaseModel):
    id: uuid.UUID
    original_order_id: uuid.UUID
    reason: str
    status: str
    return_items: dict | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Quality Inspections --

class QualityInspectionCreate(BaseModel):
    goods_receipt_id: uuid.UUID
    result: str  # pass, fail, partial
    notes: str | None = None


class QualityInspectionOut(BaseModel):
    id: uuid.UUID
    goods_receipt_id: uuid.UUID
    inspector_id: uuid.UUID
    result: str
    notes: str | None
    inspected_at: Any
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Supplier Ratings --

class SupplierRatingCreate(BaseModel):
    supplier_id: uuid.UUID
    quality_score: int = Field(..., ge=1, le=5)
    delivery_score: int = Field(..., ge=1, le=5)
    price_score: int = Field(..., ge=1, le=5)
    period: str
    notes: str | None = None


class SupplierRatingOut(BaseModel):
    id: uuid.UUID
    supplier_id: uuid.UUID
    quality_score: int
    delivery_score: int
    price_score: int
    period: str
    notes: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Contracts --

class ContractCreate(BaseModel):
    supplier_id: uuid.UUID
    title: str
    start_date: date
    end_date: date
    terms: str
    value: Decimal
    auto_renew: bool = False


class ContractUpdate(BaseModel):
    title: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    terms: str | None = None
    value: Decimal | None = None
    auto_renew: bool | None = None
    status: str | None = None


class ContractOut(BaseModel):
    id: uuid.UUID
    supplier_id: uuid.UUID
    title: str
    start_date: date
    end_date: date
    terms: str
    value: Decimal
    auto_renew: bool
    status: str
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════════════════════
#  SHIPMENT ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/shipments", summary="List shipments")
async def list_shipments(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status"),
    order_id: uuid.UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Shipment)

    if status_filter:
        query = query.where(Shipment.status == status_filter)
    if order_id:
        query = query.where(Shipment.order_id == order_id)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Shipment.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    shipments = result.scalars().all()
    return {
        "total": total,
        "shipments": [ShipmentOut.model_validate(s).model_dump() for s in shipments],
    }


@router.post(
    "/shipments",
    status_code=status.HTTP_201_CREATED,
    summary="Create a shipment",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def create_shipment(
    payload: ShipmentCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    shipment = Shipment(
        order_id=payload.order_id,
        carrier=payload.carrier,
        tracking_no=payload.tracking_no,
        status=payload.status,
        shipped_at=payload.shipped_at,
        destination=payload.destination,
    )
    db.add(shipment)
    await db.commit()
    await db.refresh(shipment)

    await event_bus.publish("shipment.created", {
        "shipment_id": str(shipment.id),
        "order_id": str(shipment.order_id),
        "carrier": shipment.carrier,
    })

    return ShipmentOut.model_validate(shipment).model_dump()


@router.get("/shipments/{shipment_id}", summary="Get shipment detail")
async def get_shipment(
    shipment_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    shipment = await db.get(Shipment, shipment_id)
    if not shipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")
    return ShipmentOut.model_validate(shipment).model_dump()


@router.put(
    "/shipments/{shipment_id}/track",
    summary="Update shipment tracking information",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def update_shipment_tracking(
    shipment_id: uuid.UUID,
    payload: ShipmentTrackUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    shipment = await db.get(Shipment, shipment_id)
    if not shipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(shipment, field, value)

    await db.commit()
    await db.refresh(shipment)

    if shipment.status == "delivered":
        await event_bus.publish("shipment.delivered", {
            "shipment_id": str(shipment.id),
            "order_id": str(shipment.order_id),
        })

    return ShipmentOut.model_validate(shipment).model_dump()


# ══════════════════════════════════════════════════════════════════════════════
#  RETURN ORDER ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/returns", summary="List return orders")
async def list_return_orders(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(ReturnOrder)

    if status_filter:
        query = query.where(ReturnOrder.status == status_filter)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(ReturnOrder.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    returns = result.scalars().all()
    return {
        "total": total,
        "returns": [ReturnOrderOut.model_validate(r).model_dump() for r in returns],
    }


@router.post(
    "/returns",
    status_code=status.HTTP_201_CREATED,
    summary="Create a return order",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def create_return_order(
    payload: ReturnOrderCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    ret = ReturnOrder(
        original_order_id=payload.original_order_id,
        reason=payload.reason,
        return_items=payload.return_items,
    )
    db.add(ret)
    await db.commit()
    await db.refresh(ret)
    return ReturnOrderOut.model_validate(ret).model_dump()


@router.get("/returns/{return_id}", summary="Get return order detail")
async def get_return_order(
    return_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    ret = await db.get(ReturnOrder, return_id)
    if not ret:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Return order not found")
    return ReturnOrderOut.model_validate(ret).model_dump()


@router.put(
    "/returns/{return_id}",
    summary="Update a return order",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def update_return_order(
    return_id: uuid.UUID,
    payload: ReturnOrderUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    ret = await db.get(ReturnOrder, return_id)
    if not ret:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Return order not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(ret, field, value)

    await db.commit()
    await db.refresh(ret)
    return ReturnOrderOut.model_validate(ret).model_dump()


# ══════════════════════════════════════════════════════════════════════════════
#  QUALITY INSPECTION ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/quality-inspections", summary="List quality inspections")
async def list_quality_inspections(
    current_user: CurrentUser,
    db: DBSession,
    goods_receipt_id: uuid.UUID | None = Query(None),
    result_filter: str | None = Query(None, alias="result"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(QualityInspection)

    if goods_receipt_id:
        query = query.where(QualityInspection.goods_receipt_id == goods_receipt_id)
    if result_filter:
        query = query.where(QualityInspection.result == result_filter)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(QualityInspection.inspected_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    inspections = result.scalars().all()
    return {
        "total": total,
        "inspections": [QualityInspectionOut.model_validate(i).model_dump() for i in inspections],
    }


@router.post(
    "/quality-inspections",
    status_code=status.HTTP_201_CREATED,
    summary="Create a quality inspection for a GRN",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def create_quality_inspection(
    payload: QualityInspectionCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    grn = await db.get(GoodsReceivedNote, payload.goods_receipt_id)
    if not grn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goods received note not found",
        )

    if payload.result not in ("pass", "fail", "partial"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Result must be 'pass', 'fail', or 'partial'",
        )

    inspection = QualityInspection(
        goods_receipt_id=payload.goods_receipt_id,
        inspector_id=current_user.id,
        result=payload.result,
        notes=payload.notes,
    )
    db.add(inspection)
    await db.commit()
    await db.refresh(inspection)
    return QualityInspectionOut.model_validate(inspection).model_dump()


# ══════════════════════════════════════════════════════════════════════════════
#  SUPPLIER RATING ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/supplier-ratings", summary="List supplier ratings")
async def list_supplier_ratings(
    current_user: CurrentUser,
    db: DBSession,
    supplier_id: uuid.UUID | None = Query(None),
    period: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(SupplierRating)

    if supplier_id:
        query = query.where(SupplierRating.supplier_id == supplier_id)
    if period:
        query = query.where(SupplierRating.period == period)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(SupplierRating.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    ratings = result.scalars().all()
    return {
        "total": total,
        "ratings": [SupplierRatingOut.model_validate(r).model_dump() for r in ratings],
    }


@router.post(
    "/supplier-ratings",
    status_code=status.HTTP_201_CREATED,
    summary="Create a supplier rating",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def create_supplier_rating(
    payload: SupplierRatingCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    supplier = await db.get(Supplier, payload.supplier_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    rating = SupplierRating(
        supplier_id=payload.supplier_id,
        quality_score=payload.quality_score,
        delivery_score=payload.delivery_score,
        price_score=payload.price_score,
        period=payload.period,
        notes=payload.notes,
    )
    db.add(rating)
    await db.commit()
    await db.refresh(rating)
    return SupplierRatingOut.model_validate(rating).model_dump()


# ══════════════════════════════════════════════════════════════════════════════
#  CONTRACT ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/contracts", summary="List supplier contracts")
async def list_contracts(
    current_user: CurrentUser,
    db: DBSession,
    supplier_id: uuid.UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Contract)

    if supplier_id:
        query = query.where(Contract.supplier_id == supplier_id)
    if status_filter:
        query = query.where(Contract.status == status_filter)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Contract.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    contracts = result.scalars().all()
    return {
        "total": total,
        "contracts": [ContractOut.model_validate(c).model_dump() for c in contracts],
    }


@router.post(
    "/contracts",
    status_code=status.HTTP_201_CREATED,
    summary="Create a supplier contract",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def create_contract(
    payload: ContractCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    supplier = await db.get(Supplier, payload.supplier_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    if payload.end_date <= payload.start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="End date must be after start date",
        )

    contract = Contract(
        supplier_id=payload.supplier_id,
        title=payload.title,
        start_date=payload.start_date,
        end_date=payload.end_date,
        terms=payload.terms,
        value=payload.value,
        auto_renew=payload.auto_renew,
    )
    db.add(contract)
    await db.commit()
    await db.refresh(contract)
    return ContractOut.model_validate(contract).model_dump()


@router.get("/contracts/{contract_id}", summary="Get contract detail")
async def get_contract(
    contract_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    contract = await db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
    return ContractOut.model_validate(contract).model_dump()


@router.put(
    "/contracts/{contract_id}",
    summary="Update a contract",
    dependencies=[Depends(require_app_admin("supply_chain"))],
)
async def update_contract(
    contract_id: uuid.UUID,
    payload: ContractUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    contract = await db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(contract, field, value)

    await db.commit()
    await db.refresh(contract)
    return ContractOut.model_validate(contract).model_dump()


# ══════════════════════════════════════════════════════════════════════════════
#  REPORTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/reports/lead-times", summary="Report: average lead times by supplier")
async def report_lead_times(
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    """Calculate average lead times from shipment creation to delivery per carrier."""
    result = await db.execute(
        select(Shipment).where(
            and_(
                Shipment.status == "delivered",
                Shipment.shipped_at.isnot(None),
                Shipment.delivered_at.isnot(None),
            )
        )
    )
    shipments = result.scalars().all()

    # Group by carrier
    carrier_times: dict[str, list[float]] = {}
    for s in shipments:
        if s.shipped_at and s.delivered_at:
            days = (s.delivered_at - s.shipped_at).total_seconds() / 86400
            carrier_times.setdefault(s.carrier, []).append(days)

    report = []
    for carrier, times in sorted(carrier_times.items()):
        report.append({
            "carrier": carrier,
            "total_shipments": len(times),
            "avg_lead_time_days": round(sum(times) / len(times), 1),
            "min_lead_time_days": round(min(times), 1),
            "max_lead_time_days": round(max(times), 1),
        })

    return report


@router.get("/reports/supplier-performance", summary="Report: supplier performance overview")
async def report_supplier_performance(
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    """Aggregate supplier ratings into an overall performance view."""
    result = await db.execute(
        select(
            SupplierRating.supplier_id,
            func.count(SupplierRating.id).label("rating_count"),
            func.avg(SupplierRating.quality_score).label("avg_quality"),
            func.avg(SupplierRating.delivery_score).label("avg_delivery"),
            func.avg(SupplierRating.price_score).label("avg_price"),
        )
        .group_by(SupplierRating.supplier_id)
    )
    rows = result.all()

    report = []
    for row in rows:
        supplier = await db.get(Supplier, row.supplier_id)
        avg_overall = (float(row.avg_quality) + float(row.avg_delivery) + float(row.avg_price)) / 3
        report.append({
            "supplier_id": str(row.supplier_id),
            "supplier_name": supplier.name if supplier else "Unknown",
            "rating_count": row.rating_count,
            "avg_quality_score": round(float(row.avg_quality), 2),
            "avg_delivery_score": round(float(row.avg_delivery), 2),
            "avg_price_score": round(float(row.avg_price), 2),
            "avg_overall_score": round(avg_overall, 2),
        })

    report.sort(key=lambda x: x["avg_overall_score"], reverse=True)
    return report
