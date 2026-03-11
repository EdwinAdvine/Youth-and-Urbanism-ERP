"""Storefront public API — catalog, customer auth, cart, checkout, customer orders."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Header, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select

from app.core.deps import DBSession
from app.models.ecommerce import (
    Cart,
    CartItem,
    CustomerAccount,
    EcomOrder,
    EcomProduct,
    OrderLine,
    ShippingAddress,
    Store,
)

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class CatalogProductOut(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    display_name: str
    slug: str
    description: str | None
    images: list | None
    price: Decimal
    compare_at_price: Decimal | None
    seo_title: str | None
    seo_description: str | None
    created_at: Any

    model_config = {"from_attributes": True}


class CustomerRegister(BaseModel):
    store_id: uuid.UUID
    email: str
    password: str
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None


class CustomerLogin(BaseModel):
    email: str
    password: str


class CartItemCreate(BaseModel):
    store_id: uuid.UUID
    product_id: uuid.UUID
    quantity: int = 1
    session_key: str | None = None


class CartItemUpdate(BaseModel):
    quantity: int


class CartItemOut(BaseModel):
    id: uuid.UUID
    cart_id: uuid.UUID
    product_id: uuid.UUID
    product_name: str | None = None
    quantity: int
    unit_price: Decimal | None = None
    created_at: Any

    model_config = {"from_attributes": True}


class CartOut(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    customer_id: uuid.UUID | None
    session_key: str | None
    items: list[CartItemOut] = []
    total: Decimal = Decimal("0.00")
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class CheckoutPayload(BaseModel):
    cart_id: uuid.UUID
    shipping_address_id: uuid.UUID | None = None
    # Inline address if no saved one
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country: str = "Kenya"
    notes: str | None = None


class AddressCreate(BaseModel):
    label: str | None = None
    address_line1: str
    address_line2: str | None = None
    city: str
    state: str | None = None
    postal_code: str | None = None
    country: str = "Kenya"
    is_default: bool = False


class OrderOut(BaseModel):
    id: uuid.UUID
    order_number: str
    status: str
    subtotal: Decimal
    tax: Decimal
    shipping_cost: Decimal
    total: Decimal
    tracking_number: str | None
    notes: str | None
    created_at: Any

    model_config = {"from_attributes": True}


class OrderLineOut(BaseModel):
    id: uuid.UUID
    product_name: str
    quantity: int
    unit_price: Decimal
    total: Decimal

    model_config = {"from_attributes": True}


class OrderDetailOut(OrderOut):
    lines: list[OrderLineOut] = []


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_customer_from_token(
    db,
    x_customer_token: str | None,
) -> CustomerAccount | None:
    """Simple token = customer ID for MVP. Replace with JWT in production."""
    if not x_customer_token:
        return None
    try:
        cid = uuid.UUID(x_customer_token)
    except ValueError:
        return None
    customer = await db.get(CustomerAccount, cid)
    return customer


async def _require_customer(db, x_customer_token: str | None) -> CustomerAccount:
    customer = await _get_customer_from_token(db, x_customer_token)
    if not customer:
        raise HTTPException(status_code=401, detail="Customer authentication required")
    return customer


async def _generate_order_number(db) -> str:
    year = datetime.now(timezone.utc).year
    prefix = f"ORD-{year}-"
    result = await db.execute(
        select(func.count()).select_from(EcomOrder).where(EcomOrder.order_number.like(f"{prefix}%"))
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}{count:04d}"


# ── Catalog ────────────────────────────────────────────────────────────────────

@router.get("/catalog", summary="List published products")
async def catalog(
    db: DBSession,
    store_id: uuid.UUID | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    filters = [EcomProduct.is_published == True]  # noqa: E712
    if store_id:
        filters.append(EcomProduct.store_id == store_id)
    if search:
        like = f"%{search}%"
        filters.append(
            or_(EcomProduct.display_name.ilike(like), EcomProduct.description.ilike(like))
        )

    count_q = select(func.count()).select_from(EcomProduct).where(and_(*filters))
    total = (await db.execute(count_q)).scalar() or 0

    q = (
        select(EcomProduct)
        .where(and_(*filters))
        .order_by(EcomProduct.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(q)
    products = result.scalars().all()

    return {
        "total": total,
        "products": [CatalogProductOut.model_validate(p).model_dump() for p in products],
    }


@router.get("/catalog/{slug}", summary="Get product by slug")
async def catalog_product(
    slug: str,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(EcomProduct).where(
            and_(EcomProduct.slug == slug, EcomProduct.is_published == True)  # noqa: E712
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return CatalogProductOut.model_validate(product).model_dump()


# ── Customer Auth ──────────────────────────────────────────────────────────────

@router.post("/customer/register", status_code=status.HTTP_201_CREATED, summary="Register customer")
async def register_customer(
    payload: CustomerRegister,
    db: DBSession,
) -> dict[str, Any]:
    # Check duplicate email
    existing = await db.execute(
        select(CustomerAccount).where(CustomerAccount.email == payload.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Verify store
    store = await db.get(Store, payload.store_id)
    if not store:
        raise HTTPException(status_code=400, detail="Store not found")

    # Hash password (simple hash for MVP — use bcrypt in production)
    import hashlib
    password_hash = hashlib.sha256(payload.password.encode()).hexdigest()

    customer = CustomerAccount(
        store_id=payload.store_id,
        email=payload.email,
        password_hash=password_hash,
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
    )
    db.add(customer)
    await db.commit()
    await db.refresh(customer)

    return {
        "id": str(customer.id),
        "email": customer.email,
        "token": str(customer.id),  # MVP: use customer ID as token
        "first_name": customer.first_name,
        "last_name": customer.last_name,
    }


@router.post("/customer/login", summary="Customer login")
async def login_customer(
    payload: CustomerLogin,
    db: DBSession,
) -> dict[str, Any]:
    import hashlib
    password_hash = hashlib.sha256(payload.password.encode()).hexdigest()

    result = await db.execute(
        select(CustomerAccount).where(
            and_(
                CustomerAccount.email == payload.email,
                CustomerAccount.password_hash == password_hash,
                CustomerAccount.is_active == True,  # noqa: E712
            )
        )
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {
        "id": str(customer.id),
        "email": customer.email,
        "token": str(customer.id),
        "first_name": customer.first_name,
        "last_name": customer.last_name,
    }


# ── Cart ───────────────────────────────────────────────────────────────────────

def _cart_out(cart: Cart) -> dict:
    items = []
    total = Decimal("0.00")
    for ci in (cart.items or []):
        unit_price = ci.product.price if ci.product else Decimal("0.00")
        line_total = unit_price * ci.quantity
        total += line_total
        items.append({
            "id": str(ci.id),
            "cart_id": str(ci.cart_id),
            "product_id": str(ci.product_id),
            "product_name": ci.product.display_name if ci.product else None,
            "quantity": ci.quantity,
            "unit_price": float(unit_price),
            "created_at": str(ci.created_at),
        })
    return {
        "id": str(cart.id),
        "store_id": str(cart.store_id),
        "customer_id": str(cart.customer_id) if cart.customer_id else None,
        "session_key": cart.session_key,
        "items": items,
        "total": float(total),
        "created_at": str(cart.created_at),
        "updated_at": str(cart.updated_at),
    }


@router.get("/cart", summary="Get cart")
async def get_cart(
    db: DBSession,
    session_key: str | None = None,
    x_customer_token: str | None = Header(None),
) -> dict[str, Any]:
    customer = await _get_customer_from_token(db, x_customer_token)

    filters = []
    if customer:
        filters.append(Cart.customer_id == customer.id)
    elif session_key:
        filters.append(Cart.session_key == session_key)
    else:
        return {"id": None, "items": [], "total": 0}

    result = await db.execute(
        select(Cart).where(and_(*filters)).order_by(Cart.updated_at.desc()).limit(1)
    )
    cart = result.scalar_one_or_none()
    if not cart:
        return {"id": None, "items": [], "total": 0}

    return _cart_out(cart)


@router.post("/cart/items", status_code=status.HTTP_201_CREATED, summary="Add item to cart")
async def add_cart_item(
    payload: CartItemCreate,
    db: DBSession,
    x_customer_token: str | None = Header(None),
) -> dict[str, Any]:
    customer = await _get_customer_from_token(db, x_customer_token)

    # Verify product exists and is published
    product = await db.get(EcomProduct, payload.product_id)
    if not product or not product.is_published:
        raise HTTPException(status_code=400, detail="Product not available")

    # Find or create cart
    cart = None
    if customer:
        result = await db.execute(
            select(Cart).where(Cart.customer_id == customer.id).order_by(Cart.updated_at.desc()).limit(1)
        )
        cart = result.scalar_one_or_none()
    elif payload.session_key:
        result = await db.execute(
            select(Cart).where(Cart.session_key == payload.session_key).order_by(Cart.updated_at.desc()).limit(1)
        )
        cart = result.scalar_one_or_none()

    if not cart:
        cart = Cart(
            store_id=payload.store_id,
            customer_id=customer.id if customer else None,
            session_key=payload.session_key if not customer else None,
        )
        db.add(cart)
        await db.commit()
        await db.refresh(cart)

    # Check if item already in cart
    existing_result = await db.execute(
        select(CartItem).where(
            and_(CartItem.cart_id == cart.id, CartItem.product_id == payload.product_id)
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        existing.quantity += payload.quantity
    else:
        item = CartItem(
            cart_id=cart.id,
            product_id=payload.product_id,
            quantity=payload.quantity,
        )
        db.add(item)

    await db.commit()

    # Re-fetch cart
    result = await db.execute(select(Cart).where(Cart.id == cart.id))
    cart = result.scalar_one()
    return _cart_out(cart)


@router.put("/cart/items/{item_id}", summary="Update cart item quantity")
async def update_cart_item(
    item_id: uuid.UUID,
    payload: CartItemUpdate,
    db: DBSession,
) -> dict[str, Any]:
    item = await db.get(CartItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    if payload.quantity <= 0:
        await db.delete(item)
    else:
        item.quantity = payload.quantity

    await db.commit()

    # Re-fetch cart
    result = await db.execute(select(Cart).where(Cart.id == item.cart_id))
    cart = result.scalar_one_or_none()
    if not cart:
        return {"id": None, "items": [], "total": 0}
    return _cart_out(cart)


@router.delete("/cart/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove cart item")
async def remove_cart_item(
    item_id: uuid.UUID,
    db: DBSession,
):
    item = await db.get(CartItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    await db.delete(item)
    await db.commit()
    from fastapi.responses import Response
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Checkout ───────────────────────────────────────────────────────────────────

@router.post("/checkout", status_code=status.HTTP_201_CREATED, summary="Checkout")
async def checkout(
    payload: CheckoutPayload,
    db: DBSession,
    x_customer_token: str | None = Header(None),
) -> dict[str, Any]:
    customer = await _require_customer(db, x_customer_token)

    # Get cart
    cart = await db.get(Cart, payload.cart_id)
    if not cart:
        raise HTTPException(status_code=400, detail="Cart not found")
    if not cart.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    # Resolve shipping address
    shipping_address_id = payload.shipping_address_id
    if not shipping_address_id and payload.address_line1:
        addr = ShippingAddress(
            customer_id=customer.id,
            address_line1=payload.address_line1,
            address_line2=payload.address_line2,
            city=payload.city or "",
            state=payload.state,
            postal_code=payload.postal_code,
            country=payload.country,
        )
        db.add(addr)
        await db.commit()
        await db.refresh(addr)
        shipping_address_id = addr.id

    # Calculate totals
    subtotal = Decimal("0.00")
    order_lines = []
    for ci in cart.items:
        price = ci.product.price if ci.product else Decimal("0.00")
        line_total = price * ci.quantity
        subtotal += line_total
        order_lines.append(OrderLine(
            product_id=ci.product_id,
            product_name=ci.product.display_name if ci.product else "Unknown",
            quantity=ci.quantity,
            unit_price=price,
            total=line_total,
        ))

    tax = subtotal * Decimal("0.16")  # 16% VAT default
    total = subtotal + tax

    order_number = await _generate_order_number(db)
    order = EcomOrder(
        store_id=cart.store_id,
        order_number=order_number,
        customer_id=customer.id,
        status="pending",
        shipping_address_id=shipping_address_id,
        subtotal=subtotal,
        tax=tax,
        shipping_cost=Decimal("0.00"),
        total=total,
        notes=payload.notes,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)

    # Add order lines
    for ln in order_lines:
        ln.order_id = order.id
        db.add(ln)

    # Clear cart
    for ci in cart.items:
        await db.delete(ci)

    await db.commit()

    return {
        "order_id": str(order.id),
        "order_number": order.order_number,
        "total": float(total),
        "status": order.status,
    }


# ── Customer Orders ────────────────────────────────────────────────────────────

@router.get("/orders", summary="Customer's orders")
async def customer_orders(
    db: DBSession,
    x_customer_token: str | None = Header(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    customer = await _require_customer(db, x_customer_token)

    count_q = select(func.count()).select_from(EcomOrder).where(EcomOrder.customer_id == customer.id)
    total = (await db.execute(count_q)).scalar() or 0

    q = (
        select(EcomOrder)
        .where(EcomOrder.customer_id == customer.id)
        .order_by(EcomOrder.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(q)
    orders = result.scalars().all()

    return {
        "total": total,
        "orders": [OrderOut.model_validate(o).model_dump() for o in orders],
    }


@router.get("/orders/{order_id}", summary="Customer order detail")
async def customer_order_detail(
    order_id: uuid.UUID,
    db: DBSession,
    x_customer_token: str | None = Header(None),
) -> dict[str, Any]:
    customer = await _require_customer(db, x_customer_token)

    result = await db.execute(
        select(EcomOrder).where(
            and_(EcomOrder.id == order_id, EcomOrder.customer_id == customer.id)
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    d = OrderOut.model_validate(order).model_dump()
    d["lines"] = [OrderLineOut.model_validate(ln).model_dump() for ln in (order.lines or [])]
    return d
