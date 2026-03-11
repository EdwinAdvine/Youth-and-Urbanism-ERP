"""E-Commerce models — stores, products, customers, carts, orders."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# -- Store --------------------------------------------------------------------
class Store(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """An e-commerce store / storefront."""

    __tablename__ = "ecom_stores"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="KES")
    settings_json: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    products = relationship("EcomProduct", back_populates="store", lazy="selectin")
    customers = relationship("CustomerAccount", back_populates="store", lazy="selectin")
    orders = relationship("EcomOrder", back_populates="store", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Store id={self.id} name={self.name!r}>"


# -- EcomProduct --------------------------------------------------------------
class EcomProduct(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A product listed in an e-commerce store."""

    __tablename__ = "ecom_products"

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    inventory_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inventory_items.id", ondelete="SET NULL"),
        nullable=True,
    )
    display_name: Mapped[str] = mapped_column(String(300), nullable=False)
    slug: Mapped[str] = mapped_column(String(300), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    images: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)
    price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    compare_at_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    seo_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    seo_description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    store = relationship("Store", back_populates="products", lazy="joined")
    inventory_item = relationship("InventoryItem", lazy="joined")

    def __repr__(self) -> str:
        return f"<EcomProduct id={self.id} name={self.display_name!r}>"


# -- CustomerAccount ---------------------------------------------------------
class CustomerAccount(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A storefront customer account."""

    __tablename__ = "ecom_customers"

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    crm_contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("crm_contacts.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    store = relationship("Store", back_populates="customers", lazy="joined")
    crm_contact = relationship("Contact", lazy="joined")
    addresses = relationship("ShippingAddress", back_populates="customer", lazy="selectin", cascade="all, delete-orphan")
    orders = relationship("EcomOrder", back_populates="customer", lazy="selectin")

    def __repr__(self) -> str:
        return f"<CustomerAccount id={self.id} email={self.email!r}>"


# -- ShippingAddress ----------------------------------------------------------
class ShippingAddress(Base, UUIDPrimaryKeyMixin):
    """A saved shipping address for a customer."""

    __tablename__ = "ecom_shipping_addresses"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address_line1: Mapped[str] = mapped_column(String(300), nullable=False)
    address_line2: Mapped[str | None] = mapped_column(String(300), nullable=True)
    city: Mapped[str] = mapped_column(String(150), nullable=False)
    state: Mapped[str | None] = mapped_column(String(150), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    country: Mapped[str] = mapped_column(String(100), nullable=False, default="Kenya")
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    customer = relationship("CustomerAccount", back_populates="addresses")

    def __repr__(self) -> str:
        return f"<ShippingAddress id={self.id} city={self.city!r}>"


# -- Cart ---------------------------------------------------------------------
class Cart(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Shopping cart (guest or customer)."""

    __tablename__ = "ecom_carts"

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_customers.id", ondelete="SET NULL"),
        nullable=True,
    )
    session_key: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)

    # Relationships
    store = relationship("Store", lazy="joined")
    customer = relationship("CustomerAccount", lazy="joined")
    items = relationship("CartItem", back_populates="cart", lazy="selectin", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Cart id={self.id}>"


# -- CartItem -----------------------------------------------------------------
class CartItem(Base, UUIDPrimaryKeyMixin):
    """A single line in a shopping cart."""

    __tablename__ = "ecom_cart_items"

    cart_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_carts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_products.id", ondelete="CASCADE"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    cart = relationship("Cart", back_populates="items")
    product = relationship("EcomProduct", lazy="joined")

    def __repr__(self) -> str:
        return f"<CartItem id={self.id} qty={self.quantity}>"


# -- EcomOrder ----------------------------------------------------------------
class EcomOrder(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """An e-commerce order."""

    __tablename__ = "ecom_orders"

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_number: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False, index=True
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="pending", index=True,
    )  # pending, confirmed, processing, shipped, delivered, cancelled
    shipping_address_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_shipping_addresses.id", ondelete="SET NULL"),
        nullable=True,
    )
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    tax: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    shipping_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    tracking_number: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    store = relationship("Store", back_populates="orders", lazy="joined")
    customer = relationship("CustomerAccount", back_populates="orders", lazy="joined")
    shipping_address = relationship("ShippingAddress", lazy="joined")
    lines = relationship(
        "OrderLine", back_populates="order", lazy="selectin", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<EcomOrder {self.order_number} status={self.status}>"


# -- OrderLine ----------------------------------------------------------------
class OrderLine(Base, UUIDPrimaryKeyMixin):
    """A single line item on an e-commerce order."""

    __tablename__ = "ecom_order_lines"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_products.id", ondelete="SET NULL"),
        nullable=True,
    )
    product_name: Mapped[str] = mapped_column(String(300), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)

    # Relationships
    order = relationship("EcomOrder", back_populates="lines")
    product = relationship("EcomProduct", lazy="joined")

    def __repr__(self) -> str:
        return f"<OrderLine id={self.id} product={self.product_name!r}>"


# -- Coupon -------------------------------------------------------------------
class Coupon(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Discount coupon / promo code."""

    __tablename__ = "ecom_coupons"

    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    coupon_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="percentage",
    )  # percentage | fixed
    value: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    min_order: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    valid_to: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    usage_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    def __repr__(self) -> str:
        return f"<Coupon code={self.code!r} type={self.coupon_type}>"


# -- ShippingMethod -----------------------------------------------------------
class ShippingMethod(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A shipping method with price, estimated days, and zone restrictions."""

    __tablename__ = "ecom_shipping_methods"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    estimated_days: Mapped[int] = mapped_column(Integer, nullable=False)
    zones: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    def __repr__(self) -> str:
        return f"<ShippingMethod id={self.id} name={self.name!r}>"


# -- Review -------------------------------------------------------------------
class Review(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Product review left by an authenticated user."""

    __tablename__ = "ecom_reviews"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_approved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    product = relationship("EcomProduct", lazy="joined")
    user = relationship("User", lazy="joined")

    def __repr__(self) -> str:
        return f"<Review id={self.id} product_id={self.product_id} rating={self.rating}>"


# -- Wishlist -----------------------------------------------------------------
class Wishlist(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """User wishlist entry for a product."""

    __tablename__ = "ecom_wishlists"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Relationships
    product = relationship("EcomProduct", lazy="joined")
    user = relationship("User", lazy="joined")

    def __repr__(self) -> str:
        return f"<Wishlist id={self.id} user_id={self.user_id} product_id={self.product_id}>"


# -- PaymentGateway -----------------------------------------------------------
class PaymentGateway(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Configured payment gateway (Mpesa, Stripe, PayPal, etc.)."""

    __tablename__ = "ecom_payment_gateways"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    def __repr__(self) -> str:
        return f"<PaymentGateway id={self.id} name={self.name!r}>"
