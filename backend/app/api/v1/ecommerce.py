"""E-Commerce Admin API — stores, products, orders, customers, dashboard."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.core.export import rows_to_csv
from app.models.ecommerce import (
    CustomerAccount,
    EcomOrder,
    EcomProduct,
    OrderLine,
    Store,
)

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

# Stores
class StoreCreate(BaseModel):
    name: str
    slug: str
    currency: str = "KES"
    settings_json: dict | None = None
    is_active: bool = True


class StoreUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    currency: str | None = None
    settings_json: dict | None = None
    is_active: bool | None = None


class StoreOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    currency: str
    settings_json: dict | None
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# Products
class ProductCreate(BaseModel):
    store_id: uuid.UUID
    inventory_item_id: uuid.UUID | None = None
    display_name: str
    slug: str
    description: str | None = None
    images: list | None = None
    price: Decimal
    compare_at_price: Decimal | None = None
    is_published: bool = False
    seo_title: str | None = None
    seo_description: str | None = None


class ProductUpdate(BaseModel):
    display_name: str | None = None
    slug: str | None = None
    description: str | None = None
    images: list | None = None
    price: Decimal | None = None
    compare_at_price: Decimal | None = None
    is_published: bool | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    inventory_item_id: uuid.UUID | None = None


class ProductOut(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    inventory_item_id: uuid.UUID | None
    display_name: str
    slug: str
    description: str | None
    images: list | None
    price: Decimal
    compare_at_price: Decimal | None
    is_published: bool
    seo_title: str | None
    seo_description: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# Orders
class OrderOut(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    order_number: str
    customer_id: uuid.UUID
    customer_name: str | None = None
    customer_email: str | None = None
    status: str
    subtotal: Decimal
    tax: Decimal
    shipping_cost: Decimal
    total: Decimal
    tracking_number: str | None
    notes: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class OrderLineOut(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    product_id: uuid.UUID | None
    product_name: str
    quantity: int
    unit_price: Decimal
    total: Decimal

    model_config = {"from_attributes": True}


class AddressOut(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    label: str | None
    address_line1: str
    address_line2: str | None
    city: str
    state: str | None
    postal_code: str | None
    country: str
    is_default: bool
    created_at: Any

    model_config = {"from_attributes": True}


class OrderDetailOut(OrderOut):
    lines: list[OrderLineOut] = []
    shipping_address: AddressOut | None = None


class StatusUpdate(BaseModel):
    status: str
    tracking_number: str | None = None


# Customers
class CustomerOut(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    email: str
    first_name: str | None
    last_name: str | None
    phone: str | None
    is_active: bool
    crm_contact_id: uuid.UUID | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# Dashboard
class EcomDashboardStats(BaseModel):
    total_orders: int
    total_revenue: float
    pending_orders: int
    shipped_orders: int
    total_customers: int
    total_products: int
    published_products: int
    recent_orders: list[dict[str, Any]]
    top_products: list[dict[str, Any]]


# ── Helpers ────────────────────────────────────────────────────────────────────

VALID_ORDER_STATUSES = {"pending", "confirmed", "processing", "shipped", "delivered", "cancelled"}


def _order_out(o: EcomOrder) -> dict:
    d = OrderOut.model_validate(o).model_dump()
    d["customer_name"] = None
    d["customer_email"] = None
    if o.customer:
        d["customer_name"] = f"{o.customer.first_name or ''} {o.customer.last_name or ''}".strip() or None
        d["customer_email"] = o.customer.email
    return d


def _order_detail_out(o: EcomOrder) -> dict:
    d = _order_out(o)
    d["lines"] = [OrderLineOut.model_validate(ln).model_dump() for ln in (o.lines or [])]
    d["shipping_address"] = (
        AddressOut.model_validate(o.shipping_address).model_dump() if o.shipping_address else None
    )
    return d


async def _generate_order_number(db) -> str:
    """Generate ORD-YYYY-NNNN."""
    year = datetime.now(timezone.utc).year
    prefix = f"ORD-{year}-"
    result = await db.execute(
        select(func.count()).select_from(EcomOrder).where(EcomOrder.order_number.like(f"{prefix}%"))
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}{count:04d}"


# ── Stores ─────────────────────────────────────────────────────────────────────

@router.get("/stores", summary="List stores")
async def list_stores(
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    result = await db.execute(select(Store).order_by(Store.name))
    stores = result.scalars().all()
    return [StoreOut.model_validate(s).model_dump() for s in stores]


@router.get("/stores/{store_id}", summary="Get store detail")
async def get_store(
    store_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    store = await db.get(Store, store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return StoreOut.model_validate(store).model_dump()


@router.post("/stores", status_code=status.HTTP_201_CREATED, summary="Create store")
async def create_store(
    payload: StoreCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    store = Store(**payload.model_dump())
    db.add(store)
    await db.commit()
    await db.refresh(store)
    return StoreOut.model_validate(store).model_dump()


@router.put("/stores/{store_id}", summary="Update store")
async def update_store(
    store_id: uuid.UUID,
    payload: StoreUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    store = await db.get(Store, store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(store, field, value)
    await db.commit()
    await db.refresh(store)
    return StoreOut.model_validate(store).model_dump()


# ── Products ───────────────────────────────────────────────────────────────────

@router.get("/products", summary="List products")
async def list_products(
    current_user: CurrentUser,
    db: DBSession,
    store_id: uuid.UUID | None = None,
    search: str | None = None,
    is_published: bool | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    filters: list = []
    if store_id:
        filters.append(EcomProduct.store_id == store_id)
    if is_published is not None:
        filters.append(EcomProduct.is_published == is_published)
    if search:
        like = f"%{search}%"
        filters.append(
            or_(EcomProduct.display_name.ilike(like), EcomProduct.slug.ilike(like))
        )

    count_q = select(func.count()).select_from(EcomProduct)
    if filters:
        count_q = count_q.where(and_(*filters))
    total = (await db.execute(count_q)).scalar() or 0

    q = select(EcomProduct).order_by(EcomProduct.created_at.desc()).offset((page - 1) * limit).limit(limit)
    if filters:
        q = q.where(and_(*filters))
    result = await db.execute(q)
    products = result.scalars().all()

    return {
        "total": total,
        "products": [ProductOut.model_validate(p).model_dump() for p in products],
    }


@router.get("/products/{product_id}", summary="Get product detail")
async def get_product(
    product_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    product = await db.get(EcomProduct, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return ProductOut.model_validate(product).model_dump()


@router.post("/products", status_code=status.HTTP_201_CREATED, summary="Create product")
async def create_product(
    payload: ProductCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Verify store exists
    store = await db.get(Store, payload.store_id)
    if not store:
        raise HTTPException(status_code=400, detail="Store not found")

    product = EcomProduct(**payload.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return ProductOut.model_validate(product).model_dump()


@router.put("/products/{product_id}", summary="Update product")
async def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    product = await db.get(EcomProduct, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(product, field, value)
    await db.commit()
    await db.refresh(product)
    return ProductOut.model_validate(product).model_dump()


@router.delete("/products/{product_id}", status_code=status.HTTP_200_OK, summary="Delete product")
async def delete_product(
    product_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    product = await db.get(EcomProduct, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.delete(product)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ── Orders ─────────────────────────────────────────────────────────────────────

@router.get("/orders", summary="List orders")
async def list_orders(
    current_user: CurrentUser,
    db: DBSession,
    store_id: uuid.UUID | None = None,
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    filters: list = []
    if store_id:
        filters.append(EcomOrder.store_id == store_id)
    if status_filter:
        filters.append(EcomOrder.status == status_filter)
    if search:
        like = f"%{search}%"
        filters.append(EcomOrder.order_number.ilike(like))

    count_q = select(func.count()).select_from(EcomOrder)
    if filters:
        count_q = count_q.where(and_(*filters))
    total = (await db.execute(count_q)).scalar() or 0

    q = select(EcomOrder).order_by(EcomOrder.created_at.desc()).offset((page - 1) * limit).limit(limit)
    if filters:
        q = q.where(and_(*filters))
    result = await db.execute(q)
    orders = result.scalars().all()

    return {
        "total": total,
        "orders": [_order_out(o) for o in orders],
    }


@router.get("/orders/{order_id}", summary="Get order detail")
async def get_order(
    order_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(EcomOrder)
        .where(EcomOrder.id == order_id)
        .options(selectinload(EcomOrder.lines))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return _order_detail_out(order)


@router.put("/orders/{order_id}/status", summary="Update order status")
async def update_order_status(
    order_id: uuid.UUID,
    payload: StatusUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    order = await db.get(EcomOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if payload.status not in VALID_ORDER_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {payload.status}")

    order.status = payload.status
    if payload.tracking_number is not None:
        order.tracking_number = payload.tracking_number

    await db.commit()
    result = await db.execute(select(EcomOrder).where(EcomOrder.id == order.id))
    order = result.scalar_one()
    return _order_out(order)


@router.get("/orders/export", summary="Export orders as CSV")
async def export_orders(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status"),
):
    filters: list = []
    if status_filter:
        filters.append(EcomOrder.status == status_filter)

    q = select(EcomOrder).order_by(EcomOrder.created_at.desc())
    if filters:
        q = q.where(and_(*filters))
    result = await db.execute(q)
    orders = result.scalars().all()

    columns = ["order_number", "status", "customer_email", "subtotal", "tax", "total", "created_at"]
    rows = []
    for o in orders:
        rows.append({
            "order_number": o.order_number,
            "status": o.status,
            "customer_email": o.customer.email if o.customer else "",
            "subtotal": str(o.subtotal),
            "tax": str(o.tax),
            "total": str(o.total),
            "created_at": str(o.created_at),
        })
    return rows_to_csv(rows, columns, filename="ecommerce_orders_export.csv")


# ── Customers ──────────────────────────────────────────────────────────────────

@router.get("/customers", summary="List customers")
async def list_customers(
    current_user: CurrentUser,
    db: DBSession,
    store_id: uuid.UUID | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    filters: list = []
    if store_id:
        filters.append(CustomerAccount.store_id == store_id)
    if search:
        like = f"%{search}%"
        filters.append(
            or_(
                CustomerAccount.email.ilike(like),
                CustomerAccount.first_name.ilike(like),
                CustomerAccount.last_name.ilike(like),
            )
        )

    count_q = select(func.count()).select_from(CustomerAccount)
    if filters:
        count_q = count_q.where(and_(*filters))
    total = (await db.execute(count_q)).scalar() or 0

    q = (
        select(CustomerAccount)
        .order_by(CustomerAccount.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    if filters:
        q = q.where(and_(*filters))
    result = await db.execute(q)
    customers = result.scalars().all()

    return {
        "total": total,
        "customers": [CustomerOut.model_validate(c).model_dump() for c in customers],
    }


@router.get("/customers/{customer_id}", summary="Get customer detail")
async def get_customer(
    customer_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    customer = await db.get(CustomerAccount, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    d = CustomerOut.model_validate(customer).model_dump()
    d["addresses"] = [AddressOut.model_validate(a).model_dump() for a in (customer.addresses or [])]
    d["order_count"] = len(customer.orders or [])
    return d


# ── Dashboard ──────────────────────────────────────────────────────────────────

@router.get("/dashboard", summary="E-commerce dashboard statistics")
async def dashboard(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Total orders
    total_orders = (await db.execute(select(func.count()).select_from(EcomOrder))).scalar() or 0

    # Revenue
    revenue_result = await db.execute(
        select(func.coalesce(func.sum(EcomOrder.total), 0)).select_from(EcomOrder)
    )
    total_revenue = float(revenue_result.scalar() or 0)

    # Orders by status
    pending = (await db.execute(
        select(func.count()).select_from(EcomOrder).where(EcomOrder.status == "pending")
    )).scalar() or 0
    shipped = (await db.execute(
        select(func.count()).select_from(EcomOrder).where(EcomOrder.status == "shipped")
    )).scalar() or 0

    # Customers
    total_customers = (await db.execute(select(func.count()).select_from(CustomerAccount))).scalar() or 0

    # Products
    total_products = (await db.execute(select(func.count()).select_from(EcomProduct))).scalar() or 0
    published_products = (await db.execute(
        select(func.count()).select_from(EcomProduct).where(EcomProduct.is_published == True)  # noqa: E712
    )).scalar() or 0

    # Recent orders
    recent_q = select(EcomOrder).order_by(EcomOrder.created_at.desc()).limit(10)
    recent_result = await db.execute(recent_q)
    recent_orders = [_order_out(o) for o in recent_result.scalars().all()]

    # Top products by order count
    top_q = (
        select(EcomProduct.display_name, func.sum(OrderLine.quantity).label("sold"))
        .join(OrderLine, OrderLine.product_id == EcomProduct.id)
        .group_by(EcomProduct.id, EcomProduct.display_name)
        .order_by(func.sum(OrderLine.quantity).desc())
        .limit(10)
    )
    top_result = await db.execute(top_q)
    top_products = [{"name": row[0], "sold": int(row[1] or 0)} for row in top_result.all()]

    return {
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "pending_orders": pending,
        "shipped_orders": shipped,
        "total_customers": total_customers,
        "total_products": total_products,
        "published_products": published_products,
        "recent_orders": recent_orders,
        "top_products": top_products,
    }
