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


@router.delete("/cart/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove cart item")
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
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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


@router.delete("/coupons/{coupon_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete coupon")
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
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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


@router.delete("/shipping-methods/{method_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete shipping method")
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
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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


@router.delete("/wishlist/{wishlist_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove from wishlist")
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
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
