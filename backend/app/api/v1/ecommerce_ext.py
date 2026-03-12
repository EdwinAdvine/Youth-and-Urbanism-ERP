"""E-Commerce Extended API — cart, checkout, coupons, shipping, reviews, wishlist, reports."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.ecommerce import (
    Cart,
    CartItem,
    Coupon,
    EcomOrder,
    EcomProduct,
    OrderLine,
    Review,
    ShippingMethod,
    Store,
    Wishlist,
)

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

# Cart
class CartItemAdd(BaseModel):
    store_id: uuid.UUID
    product_id: uuid.UUID
    quantity: int = 1


class CartItemQtyUpdate(BaseModel):
    quantity: int


class CartItemOut(BaseModel):
    id: uuid.UUID
    cart_id: uuid.UUID
    product_id: uuid.UUID
    product_name: str | None = None
    quantity: int
    unit_price: float = 0
    line_total: float = 0
    created_at: Any

    model_config = {"from_attributes": True}


class CartOut(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    customer_id: uuid.UUID | None = None
    session_key: str | None = None
    items: list[CartItemOut] = []
    subtotal: float = 0
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# Checkout
class CheckoutPayload(BaseModel):
    coupon_code: str | None = None
    shipping_method_id: uuid.UUID | None = None
    shipping_address_id: uuid.UUID | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country: str = "Kenya"
    notes: str | None = None


# Coupons
class CouponCreate(BaseModel):
    code: str
    coupon_type: str = "percentage"  # percentage | fixed
    value: Decimal
    min_order: Decimal = Decimal("0")
    valid_from: datetime
    valid_to: datetime
    usage_limit: int = 0
    is_active: bool = True


class CouponUpdate(BaseModel):
    code: str | None = None
    coupon_type: str | None = None
    value: Decimal | None = None
    min_order: Decimal | None = None
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    usage_limit: int | None = None
    is_active: bool | None = None


class CouponOut(BaseModel):
    id: uuid.UUID
    code: str
    coupon_type: str
    value: Decimal
    min_order: Decimal
    valid_from: Any
    valid_to: Any
    usage_limit: int
    usage_count: int
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class CouponValidate(BaseModel):
    code: str
    order_total: Decimal


# Shipping
class ShippingMethodCreate(BaseModel):
    name: str
    price: Decimal
    estimated_days: int
    zones: list | None = None
    is_active: bool = True


class ShippingMethodUpdate(BaseModel):
    name: str | None = None
    price: Decimal | None = None
    estimated_days: int | None = None
    zones: list | None = None
    is_active: bool | None = None


class ShippingMethodOut(BaseModel):
    id: uuid.UUID
    name: str
    price: Decimal
    estimated_days: int
    zones: list | None
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# Order operations
class ShipPayload(BaseModel):
    tracking_number: str


class RefundPayload(BaseModel):
    reason: str | None = None


# Reviews
class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = None


class ReviewUpdate(BaseModel):
    rating: int | None = Field(None, ge=1, le=5)
    comment: str | None = None


class ReviewOut(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    user_id: uuid.UUID
    user_name: str | None = None
    rating: int
    comment: str | None
    is_approved: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# Wishlist
class WishlistAdd(BaseModel):
    product_id: uuid.UUID


class WishlistOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    product_id: uuid.UUID
    product_name: str | None = None
    product_price: float | None = None
    created_at: Any

    model_config = {"from_attributes": True}


# Reports
class SalesReportRow(BaseModel):
    date: str
    orders: int
    revenue: float


# ── Helpers ────────────────────────────────────────────────────────────────────

def _cart_out(cart: Cart) -> dict:
    """Serialize a Cart with computed line totals."""
    items = []
    subtotal = Decimal("0.00")
    for ci in (cart.items or []):
        unit_price = ci.product.price if ci.product else Decimal("0.00")
        line_total = unit_price * ci.quantity
        subtotal += line_total
        items.append({
            "id": str(ci.id),
            "cart_id": str(ci.cart_id),
            "product_id": str(ci.product_id),
            "product_name": ci.product.display_name if ci.product else None,
            "quantity": ci.quantity,
            "unit_price": float(unit_price),
            "line_total": float(line_total),
            "created_at": str(ci.created_at),
        })
    return {
        "id": str(cart.id),
        "store_id": str(cart.store_id),
        "customer_id": str(cart.customer_id) if cart.customer_id else None,
        "session_key": cart.session_key,
        "items": items,
        "subtotal": float(subtotal),
        "created_at": str(cart.created_at),
        "updated_at": str(cart.updated_at),
    }


async def _get_or_create_cart(db, user_id: uuid.UUID) -> Cart:
    """Fetch the current user's active cart, or create a new one."""
    result = await db.execute(
        select(Cart).where(Cart.customer_id == user_id).order_by(Cart.updated_at.desc()).limit(1)
    )
    cart = result.scalar_one_or_none()
    if not cart:
        # Use the first active store as default
        store_result = await db.execute(
            select(Store).where(Store.is_active == True).limit(1)  # noqa: E712
        )
        store = store_result.scalar_one_or_none()
        if not store:
            raise HTTPException(status_code=400, detail="No active store found")
        cart = Cart(store_id=store.id, customer_id=user_id)
        db.add(cart)
        await db.commit()
        await db.refresh(cart)
    return cart


async def _generate_order_number(db) -> str:
    """Generate ORD-YYYY-NNNN."""
    year = datetime.now(timezone.utc).year
    prefix = f"ORD-{year}-"
    result = await db.execute(
        select(func.count()).select_from(EcomOrder).where(EcomOrder.order_number.like(f"{prefix}%"))
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}{count:04d}"


# ── Cart ───────────────────────────────────────────────────────────────────────

@router.get("/cart", summary="Get current user's cart")
async def get_cart(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(Cart).where(Cart.customer_id == current_user.id).order_by(Cart.updated_at.desc()).limit(1)
    )
    cart = result.scalar_one_or_none()
    if not cart:
        return {"id": None, "items": [], "subtotal": 0}
    return _cart_out(cart)


@router.post("/cart/items", status_code=status.HTTP_201_CREATED, summary="Add item to cart")
async def add_cart_item(
    payload: CartItemAdd,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Verify product is published
    product = await db.get(EcomProduct, payload.product_id)
    if not product or not product.is_published:
        raise HTTPException(status_code=400, detail="Product not available")

    # Get or create cart
    result = await db.execute(
        select(Cart).where(Cart.customer_id == current_user.id).order_by(Cart.updated_at.desc()).limit(1)
    )
    cart = result.scalar_one_or_none()
    if not cart:
        cart = Cart(store_id=payload.store_id, customer_id=current_user.id)
        db.add(cart)
        await db.commit()
        await db.refresh(cart)

    # Check if product already in cart — increment qty
    existing_result = await db.execute(
        select(CartItem).where(
            and_(CartItem.cart_id == cart.id, CartItem.product_id == payload.product_id)
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        existing.quantity += payload.quantity
    else:
        item = CartItem(cart_id=cart.id, product_id=payload.product_id, quantity=payload.quantity)
        db.add(item)

    await db.commit()

    # Re-fetch cart with items
    result = await db.execute(select(Cart).where(Cart.id == cart.id))
    cart = result.scalar_one()
    return _cart_out(cart)


@router.put("/cart/items/{item_id}", summary="Update cart item quantity")
async def update_cart_item(
    item_id: uuid.UUID,
    payload: CartItemQtyUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    item = await db.get(CartItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    # Verify ownership through cart
    cart = await db.get(Cart, item.cart_id)
    if not cart or cart.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your cart")

    if payload.quantity <= 0:
        await db.delete(item)
    else:
        item.quantity = payload.quantity

    await db.commit()

    result = await db.execute(select(Cart).where(Cart.id == cart.id))
    cart = result.scalar_one()
    return _cart_out(cart)


@router.delete("/cart/items/{item_id}", status_code=status.HTTP_200_OK, summary="Remove cart item")
async def remove_cart_item(
    item_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    item = await db.get(CartItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    cart = await db.get(Cart, item.cart_id)
    if not cart or cart.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your cart")

    await db.delete(item)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ── Checkout ───────────────────────────────────────────────────────────────────

@router.post("/checkout", status_code=status.HTTP_201_CREATED, summary="Convert cart to order")
async def checkout(
    payload: CheckoutPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Get user's cart
    result = await db.execute(
        select(Cart).where(Cart.customer_id == current_user.id).order_by(Cart.updated_at.desc()).limit(1)
    )
    cart = result.scalar_one_or_none()
    if not cart or not cart.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    # Calculate subtotal and validate stock
    subtotal = Decimal("0.00")
    order_lines = []
    for ci in cart.items:
        if not ci.product or not ci.product.is_published:
            raise HTTPException(
                status_code=400,
                detail=f"Product {ci.product_id} is no longer available",
            )
        # Check inventory if linked
        if ci.product.inventory_item_id:
            from app.models.inventory import InventoryItem
            inv_item = await db.get(InventoryItem, ci.product.inventory_item_id)
            if inv_item and inv_item.quantity_on_hand < ci.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for {ci.product.display_name}. "
                    f"Available: {inv_item.quantity_on_hand}, requested: {ci.quantity}",
                )
        price = ci.product.price
        line_total = price * ci.quantity
        subtotal += line_total
        order_lines.append(OrderLine(
            product_id=ci.product_id,
            product_name=ci.product.display_name,
            quantity=ci.quantity,
            unit_price=price,
            total=line_total,
        ))

    # Apply coupon discount
    discount = Decimal("0.00")
    coupon = None
    if payload.coupon_code:
        coupon_result = await db.execute(
            select(Coupon).where(
                and_(
                    Coupon.code == payload.coupon_code,
                    Coupon.is_active == True,  # noqa: E712
                )
            )
        )
        coupon = coupon_result.scalar_one_or_none()
        if not coupon:
            raise HTTPException(status_code=400, detail="Invalid coupon code")

        now = datetime.now(timezone.utc)
        if now < coupon.valid_from or now > coupon.valid_to:
            raise HTTPException(status_code=400, detail="Coupon has expired")
        if coupon.usage_limit > 0 and coupon.usage_count >= coupon.usage_limit:
            raise HTTPException(status_code=400, detail="Coupon usage limit reached")
        if subtotal < coupon.min_order:
            raise HTTPException(
                status_code=400,
                detail=f"Minimum order amount for this coupon is {coupon.min_order}",
            )

        if coupon.coupon_type == "percentage":
            discount = subtotal * (coupon.value / Decimal("100"))
        else:
            discount = min(coupon.value, subtotal)

    # Apply shipping cost
    shipping_cost = Decimal("0.00")
    if payload.shipping_method_id:
        shipping = await db.get(ShippingMethod, payload.shipping_method_id)
        if not shipping or not shipping.is_active:
            raise HTTPException(status_code=400, detail="Shipping method not available")
        shipping_cost = shipping.price

    # Resolve shipping address
    shipping_address_id = payload.shipping_address_id
    if not shipping_address_id and payload.address_line1:
        from app.models.ecommerce import ShippingAddress
        # Find or create a customer account for this user
        cust_result = await db.execute(
            select(EcomOrder.customer_id).where(EcomOrder.store_id == cart.store_id).limit(1)
        )
        # For admin users checking out, create an inline address without customer FK
        # This is handled by storing the address_id on the order directly
        addr = ShippingAddress(
            customer_id=cart.customer_id or current_user.id,
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

    # Tax (16% VAT default)
    taxable = subtotal - discount
    tax = taxable * Decimal("0.16")
    total = taxable + tax + shipping_cost

    order_number = await _generate_order_number(db)
    order = EcomOrder(
        store_id=cart.store_id,
        order_number=order_number,
        customer_id=cart.customer_id or current_user.id,
        status="pending",
        shipping_address_id=shipping_address_id,
        subtotal=subtotal,
        tax=tax,
        shipping_cost=shipping_cost,
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

    # Deduct inventory
    for ci in cart.items:
        if ci.product and ci.product.inventory_item_id:
            from app.models.inventory import InventoryItem
            inv_item = await db.get(InventoryItem, ci.product.inventory_item_id)
            if inv_item:
                inv_item.quantity_on_hand -= ci.quantity

    # Increment coupon usage
    if coupon:
        coupon.usage_count += 1

    # Clear cart items
    for ci in cart.items:
        await db.delete(ci)

    await db.commit()

    await event_bus.publish("ecommerce.order.created", {
        "order_id": str(order.id),
        "order_number": order.order_number,
        "user_id": str(current_user.id),
        "total": float(total),
    })

    return {
        "order_id": str(order.id),
        "order_number": order.order_number,
        "subtotal": float(subtotal),
        "discount": float(discount),
        "tax": float(tax),
        "shipping_cost": float(shipping_cost),
        "total": float(total),
        "status": order.status,
    }


# ── Coupons ────────────────────────────────────────────────────────────────────

@router.get("/coupons", summary="List coupons")
async def list_coupons(
    current_user: CurrentUser,
    db: DBSession,
    is_active: bool | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    filters: list = []
    if is_active is not None:
        filters.append(Coupon.is_active == is_active)

    count_q = select(func.count()).select_from(Coupon)
    if filters:
        count_q = count_q.where(and_(*filters))
    total = (await db.execute(count_q)).scalar() or 0

    q = select(Coupon).order_by(Coupon.created_at.desc()).offset((page - 1) * limit).limit(limit)
    if filters:
        q = q.where(and_(*filters))
    result = await db.execute(q)
    coupons = result.scalars().all()

    return {
        "total": total,
        "coupons": [CouponOut.model_validate(c).model_dump() for c in coupons],
    }


@router.post("/coupons", status_code=status.HTTP_201_CREATED, summary="Create coupon")
async def create_coupon(
    payload: CouponCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    if payload.coupon_type not in ("percentage", "fixed"):
        raise HTTPException(status_code=400, detail="coupon_type must be 'percentage' or 'fixed'")

    # Check uniqueness
    existing = await db.execute(select(Coupon).where(Coupon.code == payload.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Coupon code already exists")

    coupon = Coupon(**payload.model_dump())
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon)
    return CouponOut.model_validate(coupon).model_dump()


@router.post("/coupons/validate", summary="Validate a coupon code")
async def validate_coupon(
    payload: CouponValidate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(Coupon).where(and_(Coupon.code == payload.code, Coupon.is_active == True))  # noqa: E712
    )
    coupon = result.scalar_one_or_none()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found or inactive")

    now = datetime.now(timezone.utc)
    if now < coupon.valid_from or now > coupon.valid_to:
        return {"valid": False, "reason": "Coupon has expired", "discount": 0}
    if coupon.usage_limit > 0 and coupon.usage_count >= coupon.usage_limit:
        return {"valid": False, "reason": "Usage limit reached", "discount": 0}
    if payload.order_total < coupon.min_order:
        return {"valid": False, "reason": f"Minimum order amount is {coupon.min_order}", "discount": 0}

    if coupon.coupon_type == "percentage":
        discount = float(payload.order_total * (coupon.value / Decimal("100")))
    else:
        discount = float(min(coupon.value, payload.order_total))

    return {"valid": True, "discount": discount, "coupon_type": coupon.coupon_type, "value": float(coupon.value)}


@router.put("/coupons/{coupon_id}", summary="Update coupon")
async def update_coupon(
    coupon_id: uuid.UUID,
    payload: CouponUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    coupon = await db.get(Coupon, coupon_id)
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(coupon, field, value)
    await db.commit()
    await db.refresh(coupon)
    return CouponOut.model_validate(coupon).model_dump()


@router.delete("/coupons/{coupon_id}", status_code=status.HTTP_200_OK, summary="Delete coupon")
async def delete_coupon(
    coupon_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    coupon = await db.get(Coupon, coupon_id)
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    await db.delete(coupon)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ── Shipping Methods ───────────────────────────────────────────────────────────

@router.get("/shipping-methods", summary="List shipping methods")
async def list_shipping_methods(
    current_user: CurrentUser,
    db: DBSession,
    is_active: bool | None = None,
) -> list[dict[str, Any]]:
    q = select(ShippingMethod).order_by(ShippingMethod.name)
    if is_active is not None:
        q = q.where(ShippingMethod.is_active == is_active)
    result = await db.execute(q)
    methods = result.scalars().all()
    return [ShippingMethodOut.model_validate(m).model_dump() for m in methods]


@router.post("/shipping-methods", status_code=status.HTTP_201_CREATED, summary="Create shipping method")
async def create_shipping_method(
    payload: ShippingMethodCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    method = ShippingMethod(**payload.model_dump())
    db.add(method)
    await db.commit()
    await db.refresh(method)
    return ShippingMethodOut.model_validate(method).model_dump()


@router.put("/shipping-methods/{method_id}", summary="Update shipping method")
async def update_shipping_method(
    method_id: uuid.UUID,
    payload: ShippingMethodUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    method = await db.get(ShippingMethod, method_id)
    if not method:
        raise HTTPException(status_code=404, detail="Shipping method not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(method, field, value)
    await db.commit()
    await db.refresh(method)
    return ShippingMethodOut.model_validate(method).model_dump()


@router.delete("/shipping-methods/{method_id}", status_code=status.HTTP_200_OK, summary="Delete shipping method")
async def delete_shipping_method(
    method_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    method = await db.get(ShippingMethod, method_id)
    if not method:
        raise HTTPException(status_code=404, detail="Shipping method not found")
    await db.delete(method)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ── Order Operations ──────────────────────────────────────────────────────────

@router.post("/orders/{order_id}/ship", summary="Mark order as shipped")
async def ship_order(
    order_id: uuid.UUID,
    payload: ShipPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    order = await db.get(EcomOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in ("pending", "confirmed", "processing"):
        raise HTTPException(status_code=400, detail=f"Cannot ship order in '{order.status}' status")

    order.status = "shipped"
    order.tracking_number = payload.tracking_number
    await db.commit()
    await db.refresh(order)

    await event_bus.publish("ecommerce.order.shipped", {
        "order_id": str(order.id),
        "order_number": order.order_number,
        "tracking_number": payload.tracking_number,
    })

    return {
        "id": str(order.id),
        "order_number": order.order_number,
        "status": order.status,
        "tracking_number": order.tracking_number,
    }


@router.post("/orders/{order_id}/refund", summary="Refund an order")
async def refund_order(
    order_id: uuid.UUID,
    payload: RefundPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(EcomOrder).where(EcomOrder.id == order_id).options(selectinload(EcomOrder.lines))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status == "cancelled":
        raise HTTPException(status_code=400, detail="Order is already cancelled")

    order.status = "cancelled"
    if payload.reason:
        order.notes = (order.notes or "") + f"\nRefund reason: {payload.reason}"

    # Restore inventory
    for line in (order.lines or []):
        if line.product and line.product.inventory_item_id:
            from app.models.inventory import InventoryItem
            inv_item = await db.get(InventoryItem, line.product.inventory_item_id)
            if inv_item:
                inv_item.quantity_on_hand += line.quantity

    await db.commit()
    await db.refresh(order)

    await event_bus.publish("ecommerce.order.refunded", {
        "order_id": str(order.id),
        "order_number": order.order_number,
        "total": float(order.total),
        "reason": payload.reason,
    })

    return {
        "id": str(order.id),
        "order_number": order.order_number,
        "status": order.status,
        "total": float(order.total),
        "refunded": True,
    }


# ── Reviews ────────────────────────────────────────────────────────────────────

@router.get("/products/{product_id}/reviews", summary="List reviews for a product")
async def list_product_reviews(
    product_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    approved_only: bool = True,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    filters = [Review.product_id == product_id]
    if approved_only:
        filters.append(Review.is_approved == True)  # noqa: E712

    count_q = select(func.count()).select_from(Review).where(and_(*filters))
    total = (await db.execute(count_q)).scalar() or 0

    avg_q = select(func.avg(Review.rating)).where(and_(*filters))
    avg_rating = (await db.execute(avg_q)).scalar()

    q = (
        select(Review)
        .where(and_(*filters))
        .order_by(Review.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(q)
    reviews = result.scalars().all()

    items = []
    for r in reviews:
        d = ReviewOut.model_validate(r).model_dump()
        if r.user:
            d["user_name"] = r.user.full_name if hasattr(r.user, "full_name") else r.user.email
        items.append(d)

    return {
        "total": total,
        "average_rating": round(float(avg_rating), 2) if avg_rating else None,
        "reviews": items,
    }


@router.post("/products/{product_id}/reviews", status_code=status.HTTP_201_CREATED, summary="Create a review")
async def create_review(
    product_id: uuid.UUID,
    payload: ReviewCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Verify product exists
    product = await db.get(EcomProduct, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check if user already reviewed this product
    existing = await db.execute(
        select(Review).where(
            and_(Review.product_id == product_id, Review.user_id == current_user.id)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You have already reviewed this product")

    review = Review(
        product_id=product_id,
        user_id=current_user.id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)

    d = ReviewOut.model_validate(review).model_dump()
    if review.user:
        d["user_name"] = review.user.full_name if hasattr(review.user, "full_name") else review.user.email
    return d


@router.put("/reviews/{review_id}/approve", summary="Approve or reject a review")
async def approve_review(
    review_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    approve: bool = Query(True),
) -> dict[str, Any]:
    review = await db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    review.is_approved = approve
    await db.commit()
    await db.refresh(review)

    d = ReviewOut.model_validate(review).model_dump()
    return d


# ── Wishlist ───────────────────────────────────────────────────────────────────

@router.get("/wishlist", summary="Get current user's wishlist")
async def get_wishlist(
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
) -> dict[str, Any]:
    count_q = select(func.count()).select_from(Wishlist).where(Wishlist.user_id == current_user.id)
    total = (await db.execute(count_q)).scalar() or 0

    q = (
        select(Wishlist)
        .where(Wishlist.user_id == current_user.id)
        .order_by(Wishlist.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(q)
    items = result.scalars().all()

    out = []
    for w in items:
        d = {
            "id": str(w.id),
            "user_id": str(w.user_id),
            "product_id": str(w.product_id),
            "product_name": w.product.display_name if w.product else None,
            "product_price": float(w.product.price) if w.product else None,
            "created_at": str(w.created_at),
        }
        out.append(d)

    return {"total": total, "items": out}


@router.post("/wishlist", status_code=status.HTTP_201_CREATED, summary="Add product to wishlist")
async def add_to_wishlist(
    payload: WishlistAdd,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Verify product exists
    product = await db.get(EcomProduct, payload.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check for duplicate
    existing = await db.execute(
        select(Wishlist).where(
            and_(Wishlist.user_id == current_user.id, Wishlist.product_id == payload.product_id)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Product already in wishlist")

    wishlist = Wishlist(user_id=current_user.id, product_id=payload.product_id)
    db.add(wishlist)
    await db.commit()
    await db.refresh(wishlist)

    return {
        "id": str(wishlist.id),
        "user_id": str(wishlist.user_id),
        "product_id": str(wishlist.product_id),
        "product_name": product.display_name,
        "product_price": float(product.price),
        "created_at": str(wishlist.created_at),
    }


@router.delete("/wishlist/{wishlist_id}", status_code=status.HTTP_200_OK, summary="Remove from wishlist")
async def remove_from_wishlist(
    wishlist_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    wishlist = await db.get(Wishlist, wishlist_id)
    if not wishlist:
        raise HTTPException(status_code=404, detail="Wishlist item not found")
    if wishlist.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your wishlist item")
    await db.delete(wishlist)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ── Reports ────────────────────────────────────────────────────────────────────

@router.get("/reports/sales", summary="Sales report by date range")
async def sales_report(
    current_user: CurrentUser,
    db: DBSession,
    start_date: date | None = None,
    end_date: date | None = None,
    group_by: str = Query("day", pattern="^(day|week|month)$"),
) -> dict[str, Any]:
    filters: list = []
    if start_date:
        filters.append(EcomOrder.created_at >= datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc))
    if end_date:
        filters.append(EcomOrder.created_at <= datetime.combine(end_date, datetime.max.time()).replace(tzinfo=timezone.utc))

    # Exclude cancelled orders
    filters.append(EcomOrder.status != "cancelled")

    if group_by == "day":
        date_trunc = func.date_trunc("day", EcomOrder.created_at)
    elif group_by == "week":
        date_trunc = func.date_trunc("week", EcomOrder.created_at)
    else:
        date_trunc = func.date_trunc("month", EcomOrder.created_at)

    q = (
        select(
            date_trunc.label("period"),
            func.count(EcomOrder.id).label("orders"),
            func.coalesce(func.sum(EcomOrder.total), 0).label("revenue"),
        )
        .where(and_(*filters))
        .group_by(date_trunc)
        .order_by(date_trunc)
    )
    result = await db.execute(q)
    rows = result.all()

    # Totals
    total_orders = sum(r.orders for r in rows)
    total_revenue = sum(float(r.revenue) for r in rows)

    return {
        "group_by": group_by,
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "data": [
            {
                "period": str(r.period.date()) if r.period else None,
                "orders": r.orders,
                "revenue": float(r.revenue),
            }
            for r in rows
        ],
    }


@router.get("/reports/top-products", summary="Top-selling products")
async def top_products_report(
    current_user: CurrentUser,
    db: DBSession,
    limit: int = Query(10, ge=1, le=50),
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict[str, Any]]:
    filters: list = [EcomOrder.status != "cancelled"]
    if start_date:
        filters.append(EcomOrder.created_at >= datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc))
    if end_date:
        filters.append(EcomOrder.created_at <= datetime.combine(end_date, datetime.max.time()).replace(tzinfo=timezone.utc))

    q = (
        select(
            OrderLine.product_name,
            OrderLine.product_id,
            func.sum(OrderLine.quantity).label("total_sold"),
            func.sum(OrderLine.total).label("total_revenue"),
        )
        .join(EcomOrder, EcomOrder.id == OrderLine.order_id)
        .where(and_(*filters))
        .group_by(OrderLine.product_id, OrderLine.product_name)
        .order_by(func.sum(OrderLine.quantity).desc())
        .limit(limit)
    )
    result = await db.execute(q)
    rows = result.all()

    return [
        {
            "product_id": str(r.product_id) if r.product_id else None,
            "product_name": r.product_name,
            "total_sold": int(r.total_sold or 0),
            "total_revenue": float(r.total_revenue or 0),
        }
        for r in rows
    ]


@router.get("/reports/conversion-funnel", summary="Conversion funnel metrics")
async def conversion_funnel(
    current_user: CurrentUser,
    db: DBSession,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict[str, Any]:
    """Returns funnel: total carts → carts with items → checkouts (orders) → completed orders."""
    date_filters: list = []
    if start_date:
        ts = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        date_filters.append(("created_at_gte", ts))
    if end_date:
        ts = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=timezone.utc)
        date_filters.append(("created_at_lte", ts))

    # Total carts
    cart_q = select(func.count()).select_from(Cart)
    for name, val in date_filters:
        if "gte" in name:
            cart_q = cart_q.where(Cart.created_at >= val)
        else:
            cart_q = cart_q.where(Cart.created_at <= val)
    total_carts = (await db.execute(cart_q)).scalar() or 0

    # Carts with at least one item
    carts_with_items_q = (
        select(func.count(func.distinct(CartItem.cart_id))).select_from(CartItem)
    )
    carts_with_items = (await db.execute(carts_with_items_q)).scalar() or 0

    # Orders created (checkouts)
    order_q = select(func.count()).select_from(EcomOrder)
    for name, val in date_filters:
        if "gte" in name:
            order_q = order_q.where(EcomOrder.created_at >= val)
        else:
            order_q = order_q.where(EcomOrder.created_at <= val)
    total_orders = (await db.execute(order_q)).scalar() or 0

    # Delivered orders
    delivered_q = order_q.where(EcomOrder.status == "delivered")
    delivered_orders = (await db.execute(delivered_q)).scalar() or 0

    # Conversion rates
    cart_to_checkout = (total_orders / carts_with_items * 100) if carts_with_items > 0 else 0
    checkout_to_delivered = (delivered_orders / total_orders * 100) if total_orders > 0 else 0

    return {
        "total_carts": total_carts,
        "carts_with_items": carts_with_items,
        "total_orders": total_orders,
        "delivered_orders": delivered_orders,
        "cart_to_checkout_rate": round(cart_to_checkout, 2),
        "checkout_to_delivered_rate": round(checkout_to_delivered, 2),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  E-COMMERCE → POS: Unified Product Catalog
# ══════════════════════════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════════════════════════
#  ABANDONED CARTS
# ══════════════════════════════════════════════════════════════════════════════

class AbandonedCartConfigUpdate(BaseModel):
    abandonment_hours: int | None = None
    enable_discount: bool | None = None
    discount_pct: float | None = None


@router.get("/abandoned-carts", summary="List abandoned cart recovery logs (admin)")
async def list_abandoned_carts(
    current_user: CurrentUser,
    db: DBSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    from app.models.ecommerce import CartAbandonmentLog
    count_q = select(func.count()).select_from(CartAbandonmentLog)
    total = (await db.execute(count_q)).scalar() or 0

    q = select(CartAbandonmentLog).order_by(CartAbandonmentLog.abandoned_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    logs = result.scalars().all()

    recovered = sum(1 for l in logs if l.recovered_order_id)
    return {
        "total": total,
        "recovered": recovered,
        "recovery_rate": round(recovered / total * 100, 2) if total else 0,
        "logs": [
            {
                "id": str(l.id),
                "cart_id": str(l.cart_id),
                "customer_email": l.customer_email,
                "items_snapshot": l.items_snapshot,
                "abandoned_at": str(l.abandoned_at),
                "recovery_email_1_sent_at": str(l.recovery_email_1_sent_at) if l.recovery_email_1_sent_at else None,
                "recovery_email_2_sent_at": str(l.recovery_email_2_sent_at) if l.recovery_email_2_sent_at else None,
                "recovered_order_id": str(l.recovered_order_id) if l.recovered_order_id else None,
                "discount_code_used": l.discount_code_used,
            }
            for l in logs
        ],
    }


@router.get("/abandoned-carts/config", summary="Get abandoned cart recovery config")
async def get_abandoned_cart_config(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.settings import SystemSettings
    keys = ["ecom.abandonment_hours", "ecom.recovery_discount_enabled", "ecom.recovery_discount_pct"]
    result = await db.execute(select(SystemSettings).where(SystemSettings.key.in_(keys)))
    settings = {s.key: s.value for s in result.scalars().all()}
    return {
        "abandonment_hours": int(settings.get("ecom.abandonment_hours", "1")),
        "enable_discount": settings.get("ecom.recovery_discount_enabled", "true") == "true",
        "discount_pct": float(settings.get("ecom.recovery_discount_pct", "10")),
    }


@router.put("/abandoned-carts/config", summary="Update abandoned cart recovery config")
async def update_abandoned_cart_config(
    payload: AbandonedCartConfigUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.settings import SystemSettings
    mapping = {}
    if payload.abandonment_hours is not None:
        mapping["ecom.abandonment_hours"] = str(payload.abandonment_hours)
    if payload.enable_discount is not None:
        mapping["ecom.recovery_discount_enabled"] = "true" if payload.enable_discount else "false"
    if payload.discount_pct is not None:
        mapping["ecom.recovery_discount_pct"] = str(payload.discount_pct)

    for key, value in mapping.items():
        result = await db.execute(select(SystemSettings).where(SystemSettings.key == key))
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = value
        else:
            db.add(SystemSettings(key=key, value=value))

    await db.commit()
    return {"updated": list(mapping.keys())}


# ══════════════════════════════════════════════════════════════════════════════
#  PRODUCT BUNDLES
# ══════════════════════════════════════════════════════════════════════════════

class BundleCreate(BaseModel):
    store_id: uuid.UUID
    name: str
    slug: str
    description: str | None = None
    image: str | None = None
    discount_type: str = "pct"  # pct | fixed
    discount_value: Decimal = Decimal("0")
    is_active: bool = True
    items: list[dict] = []  # [{product_id, quantity}]


class BundleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    image: str | None = None
    discount_type: str | None = None
    discount_value: Decimal | None = None
    is_active: bool | None = None


@router.get("/bundles", summary="List product bundles")
async def list_bundles(
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    from app.models.ecommerce import ProductBundle, BundleItem
    result = await db.execute(
        select(ProductBundle).order_by(ProductBundle.name)
    )
    bundles = result.scalars().all()
    out = []
    for b in bundles:
        items_result = await db.execute(
            select(BundleItem).where(BundleItem.bundle_id == b.id)
        )
        items = items_result.scalars().all()
        out.append({
            "id": str(b.id),
            "store_id": str(b.store_id),
            "name": b.name,
            "slug": b.slug,
            "description": b.description,
            "image": b.image,
            "discount_type": b.discount_type,
            "discount_value": float(b.discount_value),
            "is_active": b.is_active,
            "items": [{"product_id": str(i.product_id), "quantity": i.quantity} for i in items],
            "created_at": str(b.created_at),
        })
    return out


@router.get("/bundles/{bundle_id}", summary="Get bundle detail")
async def get_bundle(
    bundle_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.ecommerce import ProductBundle, BundleItem
    bundle = await db.get(ProductBundle, bundle_id)
    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle not found")
    items_result = await db.execute(
        select(BundleItem).where(BundleItem.bundle_id == bundle_id)
    )
    items = items_result.scalars().all()
    total_price = Decimal("0")
    for item in items:
        product = await db.get(EcomProduct, item.product_id)
        if product:
            total_price += product.price * item.quantity

    discount = (total_price * bundle.discount_value / 100) if bundle.discount_type == "pct" else bundle.discount_value
    return {
        "id": str(bundle.id),
        "store_id": str(bundle.store_id),
        "name": bundle.name,
        "slug": bundle.slug,
        "description": bundle.description,
        "image": bundle.image,
        "discount_type": bundle.discount_type,
        "discount_value": float(bundle.discount_value),
        "is_active": bundle.is_active,
        "items": [{"product_id": str(i.product_id), "quantity": i.quantity} for i in items],
        "total_price": float(total_price),
        "discounted_price": float(total_price - discount),
        "created_at": str(bundle.created_at),
    }


@router.post("/bundles", status_code=status.HTTP_201_CREATED, summary="Create bundle")
async def create_bundle(
    payload: BundleCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.ecommerce import ProductBundle, BundleItem
    bundle = ProductBundle(
        store_id=payload.store_id,
        name=payload.name,
        slug=payload.slug,
        description=payload.description,
        image=payload.image,
        discount_type=payload.discount_type,
        discount_value=payload.discount_value,
        is_active=payload.is_active,
    )
    db.add(bundle)
    await db.commit()
    await db.refresh(bundle)

    for item_data in payload.items:
        db.add(BundleItem(
            bundle_id=bundle.id,
            product_id=uuid.UUID(item_data["product_id"]),
            quantity=item_data.get("quantity", 1),
        ))
    await db.commit()

    return {"id": str(bundle.id), "name": bundle.name, "slug": bundle.slug, "is_active": bundle.is_active}


@router.put("/bundles/{bundle_id}", summary="Update bundle")
async def update_bundle(
    bundle_id: uuid.UUID,
    payload: BundleUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.ecommerce import ProductBundle
    bundle = await db.get(ProductBundle, bundle_id)
    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(bundle, field, value)
    await db.commit()
    await db.refresh(bundle)
    return {"id": str(bundle.id), "name": bundle.name, "is_active": bundle.is_active}


@router.delete("/bundles/{bundle_id}", status_code=status.HTTP_200_OK, summary="Delete bundle")
async def delete_bundle(
    bundle_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    from app.models.ecommerce import ProductBundle, BundleItem
    bundle = await db.get(ProductBundle, bundle_id)
    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle not found")
    items_result = await db.execute(select(BundleItem).where(BundleItem.bundle_id == bundle_id))
    for item in items_result.scalars().all():
        await db.delete(item)
    await db.delete(bundle)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
#  FLASH SALES
# ══════════════════════════════════════════════════════════════════════════════

class FlashSaleCreate(BaseModel):
    store_id: uuid.UUID
    product_id: uuid.UUID
    sale_price: Decimal
    start_at: datetime
    end_at: datetime
    inventory_limit: int | None = None
    countdown_visible: bool = True


class FlashSaleUpdate(BaseModel):
    sale_price: Decimal | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    inventory_limit: int | None = None
    is_active: bool | None = None
    countdown_visible: bool | None = None


@router.get("/flash-sales", summary="List flash sales (active + upcoming)")
async def list_flash_sales(
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    from app.models.ecommerce import FlashSale
    result = await db.execute(select(FlashSale).order_by(FlashSale.start_at.desc()))
    sales = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "store_id": str(s.store_id),
            "product_id": str(s.product_id),
            "sale_price": float(s.sale_price),
            "start_at": str(s.start_at),
            "end_at": str(s.end_at),
            "inventory_limit": s.inventory_limit,
            "sold_count": s.sold_count,
            "is_active": s.is_active,
            "countdown_visible": s.countdown_visible,
        }
        for s in sales
    ]


@router.post("/flash-sales", status_code=status.HTTP_201_CREATED, summary="Create flash sale")
async def create_flash_sale(
    payload: FlashSaleCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.ecommerce import FlashSale
    now = datetime.now(timezone.utc)
    sale = FlashSale(
        store_id=payload.store_id,
        product_id=payload.product_id,
        sale_price=payload.sale_price,
        start_at=payload.start_at,
        end_at=payload.end_at,
        inventory_limit=payload.inventory_limit,
        countdown_visible=payload.countdown_visible,
        is_active=(payload.start_at <= now <= payload.end_at),
        sold_count=0,
    )
    db.add(sale)
    await db.commit()
    await db.refresh(sale)
    return {"id": str(sale.id), "product_id": str(sale.product_id), "sale_price": float(sale.sale_price), "is_active": sale.is_active}


@router.put("/flash-sales/{sale_id}", summary="Update / end flash sale")
async def update_flash_sale(
    sale_id: uuid.UUID,
    payload: FlashSaleUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.ecommerce import FlashSale
    sale = await db.get(FlashSale, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Flash sale not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(sale, field, value)
    await db.commit()
    await db.refresh(sale)
    return {"id": str(sale.id), "sale_price": float(sale.sale_price), "is_active": sale.is_active}


# ══════════════════════════════════════════════════════════════════════════════
#  CURRENCIES
# ══════════════════════════════════════════════════════════════════════════════

class CurrencyCreate(BaseModel):
    code: str  # ISO 4217 e.g. "USD"
    name: str
    symbol: str
    exchange_rate_to_base: float


class CurrencyUpdate(BaseModel):
    exchange_rate_to_base: float | None = None
    is_active: bool | None = None


@router.get("/currencies", summary="List supported currencies")
async def list_currencies(
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    from app.models.ecommerce_currency import EcomCurrency
    result = await db.execute(select(EcomCurrency).order_by(EcomCurrency.code))
    currencies = result.scalars().all()
    return [
        {
            "code": c.code,
            "name": c.name,
            "symbol": c.symbol,
            "exchange_rate_to_base": float(c.exchange_rate_to_base),
            "is_active": c.is_active,
            "last_updated": str(c.last_updated) if c.last_updated else None,
        }
        for c in currencies
    ]


@router.post("/currencies", status_code=status.HTTP_201_CREATED, summary="Add currency")
async def create_currency(
    payload: CurrencyCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.ecommerce_currency import EcomCurrency
    existing = await db.execute(select(EcomCurrency).where(EcomCurrency.code == payload.code.upper()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Currency already exists")
    currency = EcomCurrency(
        code=payload.code.upper(),
        name=payload.name,
        symbol=payload.symbol,
        exchange_rate_to_base=payload.exchange_rate_to_base,
        is_active=True,
        last_updated=datetime.now(timezone.utc),
    )
    db.add(currency)
    await db.commit()
    await db.refresh(currency)
    return {"code": currency.code, "name": currency.name, "symbol": currency.symbol}


@router.put("/currencies/{code}", summary="Update currency exchange rate / status")
async def update_currency(
    code: str,
    payload: CurrencyUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.ecommerce_currency import EcomCurrency
    result = await db.execute(select(EcomCurrency).where(EcomCurrency.code == code.upper()))
    currency = result.scalar_one_or_none()
    if not currency:
        raise HTTPException(status_code=404, detail="Currency not found")
    if payload.exchange_rate_to_base is not None:
        currency.exchange_rate_to_base = payload.exchange_rate_to_base
        currency.last_updated = datetime.now(timezone.utc)
    if payload.is_active is not None:
        currency.is_active = payload.is_active
    await db.commit()
    await db.refresh(currency)
    return {"code": currency.code, "exchange_rate_to_base": float(currency.exchange_rate_to_base), "is_active": currency.is_active}


# ══════════════════════════════════════════════════════════════════════════════
#  AI PERSONALIZATION
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/recommendations", summary="Personalized product recommendations for current user")
async def get_recommendations(
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    from app.services.ecommerce_ai import get_recommendations as ai_recommend
    recs = await ai_recommend(db, str(current_user.id), limit=10)
    return recs


@router.post("/products/{product_id}/generate-description", summary="AI-generate product description")
async def generate_product_description(
    product_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    attributes: dict[str, Any] | None = None,
) -> dict[str, Any]:
    product = await db.get(EcomProduct, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    from app.services.ecommerce_ai import generate_product_description as ai_gen
    description = await ai_gen(product.display_name, attributes or {})
    # Optionally save to product
    product.description = description
    await db.commit()
    return {"product_id": str(product_id), "description": description}


@router.get("/products/{product_id}/price-suggestion", summary="AI dynamic price suggestion")
async def get_price_suggestion(
    product_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    product = await db.get(EcomProduct, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    from app.services.ecommerce_ai import compute_dynamic_price_suggestion
    suggestion = await compute_dynamic_price_suggestion(db, str(product_id))
    return {"product_id": str(product_id), "current_price": float(product.price), **suggestion}


@router.get("/health-score", summary="E-commerce store health score (0-100)")
async def get_health_score(
    current_user: CurrentUser,
    db: DBSession,
    store_id: uuid.UUID | None = Query(None),
) -> dict[str, Any]:
    from app.services.ecommerce_ai import get_ecom_health_score
    result = await get_ecom_health_score(db, str(store_id) if store_id else None)
    return result


# ══════════════════════════════════════════════════════════════════════════════
#  ADVANCED ANALYTICS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/analytics/health-score", summary="Health score + component breakdown")
async def analytics_health_score(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.services.ecommerce_ai import get_ecom_health_score
    return await get_ecom_health_score(db, None)


@router.get("/analytics/rfm-segments", summary="Customer RFM segmentation")
async def rfm_segments(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Recency / Frequency / Monetary segmentation across all customers."""
    from app.models.ecommerce import CustomerAccount
    now = datetime.now(timezone.utc)

    q = (
        select(
            EcomOrder.customer_id,
            func.max(EcomOrder.created_at).label("last_order"),
            func.count(EcomOrder.id).label("order_count"),
            func.sum(EcomOrder.total).label("total_spent"),
        )
        .where(EcomOrder.status != "cancelled")
        .group_by(EcomOrder.customer_id)
    )
    result = await db.execute(q)
    rows = result.all()

    segments: dict[str, list] = {"champions": [], "loyal": [], "at_risk": [], "hibernating": [], "new": []}
    for row in rows:
        days_since = (now - row.last_order.replace(tzinfo=timezone.utc)).days if row.last_order else 9999
        if days_since <= 30 and row.order_count >= 5 and float(row.total_spent or 0) >= 10000:
            segments["champions"].append(str(row.customer_id))
        elif days_since <= 60 and row.order_count >= 3:
            segments["loyal"].append(str(row.customer_id))
        elif 60 < days_since <= 120:
            segments["at_risk"].append(str(row.customer_id))
        elif days_since > 120:
            segments["hibernating"].append(str(row.customer_id))
        else:
            segments["new"].append(str(row.customer_id))

    return {
        "segments": {k: {"count": len(v), "customer_ids": v[:20]} for k, v in segments.items()},
        "total_customers": len(rows),
    }


@router.get("/analytics/demand-forecast", summary="30-day revenue forecast")
async def demand_forecast(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Simple linear trend forecast from last 90 days of daily revenue."""
    from datetime import timedelta
    from app.models.ecommerce import EcomOrder as _EcomOrder

    ninety_days_ago = datetime.now(timezone.utc) - timedelta(days=90)
    q = (
        select(
            func.date_trunc("day", EcomOrder.created_at).label("day"),
            func.sum(EcomOrder.total).label("revenue"),
        )
        .where(
            and_(
                EcomOrder.created_at >= ninety_days_ago,
                EcomOrder.status != "cancelled",
            )
        )
        .group_by(func.date_trunc("day", EcomOrder.created_at))
        .order_by(func.date_trunc("day", EcomOrder.created_at))
    )
    result = await db.execute(q)
    rows = result.all()

    if not rows:
        return {"forecast_30d": 0, "avg_daily": 0, "trend": "neutral", "data_points": 0}

    revenues = [float(r.revenue or 0) for r in rows]
    avg = sum(revenues) / len(revenues)
    # Simple linear trend: compare last 30 vs first 30 days
    mid = len(revenues) // 2
    first_half_avg = sum(revenues[:mid]) / mid if mid else avg
    second_half_avg = sum(revenues[mid:]) / (len(revenues) - mid) if len(revenues) > mid else avg
    trend = "up" if second_half_avg > first_half_avg * 1.05 else ("down" if second_half_avg < first_half_avg * 0.95 else "neutral")

    forecast_30d = second_half_avg * 30

    return {
        "forecast_30d": round(forecast_30d, 2),
        "avg_daily": round(avg, 2),
        "trend": trend,
        "data_points": len(rows),
        "recent_daily": [{"day": str(r.day.date()), "revenue": float(r.revenue or 0)} for r in rows[-14:]],
    }


@router.get("/analytics/cohorts", summary="Monthly cohort retention table")
async def cohort_retention(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Monthly signup cohorts and their repeat purchase rates."""
    from datetime import timedelta

    # First orders per customer grouped by month
    first_order_q = (
        select(
            EcomOrder.customer_id,
            func.min(EcomOrder.created_at).label("first_order_at"),
        )
        .where(EcomOrder.status != "cancelled")
        .group_by(EcomOrder.customer_id)
    )
    result = await db.execute(first_order_q)
    first_orders = {r.customer_id: r.first_order_at for r in result.all()}

    # All orders
    all_orders_q = select(EcomOrder.customer_id, EcomOrder.created_at).where(EcomOrder.status != "cancelled")
    result2 = await db.execute(all_orders_q)
    all_orders = result2.all()

    # Build cohort map: month_key → {month_offset → set of customers}
    cohorts: dict[str, dict[int, set]] = {}
    for cid, order_at in all_orders:
        if cid not in first_orders:
            continue
        first_at = first_orders[cid]
        cohort_key = first_at.strftime("%Y-%m")
        months_since = (order_at.year - first_at.year) * 12 + (order_at.month - first_at.month)
        if cohort_key not in cohorts:
            cohorts[cohort_key] = {}
        if months_since not in cohorts[cohort_key]:
            cohorts[cohort_key][months_since] = set()
        cohorts[cohort_key][months_since].add(cid)

    table = []
    for cohort_key in sorted(cohorts.keys())[-12:]:
        base_count = len(cohorts[cohort_key].get(0, set()))
        row = {"cohort": cohort_key, "customers": base_count, "retention": {}}
        for m in range(1, 7):
            m_count = len(cohorts[cohort_key].get(m, set()))
            row["retention"][f"month_{m}"] = round(m_count / base_count * 100, 1) if base_count else 0
        table.append(row)

    return {"cohorts": table}


@router.get("/analytics/ai-insights", summary="Top AI-generated actionable insights")
async def ai_insights(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Generate 3 actionable insights using Ollama over store metrics."""
    from app.services.ecommerce_ai import get_ecom_health_score

    health = await get_ecom_health_score(db, None)

    # Build a compact metrics summary for the LLM
    metrics_summary = (
        f"E-commerce health score: {health.get('score', 'N/A')}/100. "
        f"Conversion rate: {health.get('components', {}).get('conversion_rate', 'N/A')}. "
        f"Cart abandonment rate: {health.get('components', {}).get('abandonment_rate', 'N/A')}. "
        f"Revenue growth: {health.get('components', {}).get('revenue_growth', 'N/A')}. "
        f"Repeat purchase rate: {health.get('components', {}).get('repeat_purchase_rate', 'N/A')}."
    )

    prompt = (
        f"You are an e-commerce analyst. Based on these metrics: {metrics_summary}\n"
        "Provide exactly 3 concise, actionable business insights to improve performance. "
        "Format as a JSON array of objects with 'title' and 'insight' keys."
    )

    try:
        import httpx
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "http://ollama:11434/api/generate",
                json={"model": "llama3", "prompt": prompt, "stream": False},
            )
        raw = resp.json().get("response", "[]")
        import json as _json
        # Try to extract JSON array from response
        start = raw.find("[")
        end = raw.rfind("]") + 1
        insights = _json.loads(raw[start:end]) if start >= 0 else []
    except Exception:
        insights = [
            {"title": "Reduce Cart Abandonment", "insight": "Set up automated recovery emails for carts abandoned over 1 hour."},
            {"title": "Loyalty Program", "insight": "Activate loyalty rewards to increase repeat purchase rate."},
            {"title": "Flash Sales", "insight": "Run weekly flash sales to boost conversion rate during off-peak hours."},
        ]

    return {"insights": insights[:3], "metrics": health}


# ══════════════════════════════════════════════════════════════════════════════
#  MANUFACTURING WORK ORDER LINKS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/orders/{order_id}/work-orders", summary="Get manufacturing work orders linked to an e-commerce order")
async def get_order_work_orders(
    order_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    from app.models.ecommerce import EcomOrderWorkOrderLink
    order = await db.get(EcomOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    result = await db.execute(
        select(EcomOrderWorkOrderLink).where(EcomOrderWorkOrderLink.order_id == order_id)
    )
    links = result.scalars().all()

    work_orders = []
    for link in links:
        wo_data = {
            "link_id": str(link.id),
            "order_id": str(link.order_id),
            "order_line_id": str(link.order_line_id) if link.order_line_id else None,
            "work_order_id": str(link.work_order_id) if link.work_order_id else None,
        }
        if link.work_order_id:
            from app.models.manufacturing import WorkOrder
            wo = await db.get(WorkOrder, link.work_order_id)
            if wo:
                wo_data["work_order"] = {
                    "id": str(wo.id),
                    "reference": getattr(wo, "reference", None) or getattr(wo, "work_order_number", None),
                    "status": wo.status,
                    "planned_start": str(wo.planned_start) if hasattr(wo, "planned_start") and wo.planned_start else None,
                    "planned_end": str(wo.planned_end) if hasattr(wo, "planned_end") and wo.planned_end else None,
                }
        work_orders.append(wo_data)

    return work_orders


# ══════════════════════════════════════════════════════════════════════════════
#  E-COMMERCE → POS: Unified Product Catalog
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/products/pos-sync", summary="Get products formatted for POS terminal")
async def products_for_pos(
    current_user: CurrentUser,
    db: DBSession,
    store_id: uuid.UUID | None = Query(None, description="Filter by store"),
    published_only: bool = Query(True, description="Only published products"),
) -> dict[str, Any]:
    """Returns e-commerce products in a format suitable for POS import."""
    query = select(EcomProduct)
    if store_id:
        query = query.where(EcomProduct.store_id == store_id)
    if published_only:
        query = query.where(EcomProduct.is_published == True)  # noqa: E712

    query = query.order_by(EcomProduct.display_name.asc())
    result = await db.execute(query)
    products = result.scalars().all()

    pos_items = []
    for p in products:
        pos_items.append({
            "ecom_product_id": str(p.id),
            "store_id": str(p.store_id),
            "name": p.display_name,
            "slug": p.slug,
            "description": p.description or "",
            "price": str(p.price),
            "images": p.images or [],
            "inventory_item_id": str(p.inventory_item_id) if p.inventory_item_id else None,
            "sku": p.inventory_item.sku if p.inventory_item else None,
            "barcode": p.inventory_item.barcode if p.inventory_item and hasattr(p.inventory_item, "barcode") else None,
        })

    return {"total": len(pos_items), "pos_items": pos_items}
