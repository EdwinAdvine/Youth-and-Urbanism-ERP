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

from app.models.base import Base, OptimisticLockMixin, TimestampMixin, UUIDPrimaryKeyMixin


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
    is_made_to_order: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    lead_time_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    weight: Mapped[Decimal | None] = mapped_column(Numeric(10, 3), nullable=True)
    tags_json: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)
    category: Mapped[str | None] = mapped_column(String(200), nullable=True)

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
class EcomOrder(OptimisticLockMixin, Base, UUIDPrimaryKeyMixin, TimestampMixin):
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
    po_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    fulfillment_type: Mapped[str] = mapped_column(String(20), nullable=False, default="shipping")  # shipping/pickup
    pickup_location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_pickup_locations.id", ondelete="SET NULL"),
        nullable=True,
    )
    currency_code: Mapped[str] = mapped_column(String(10), nullable=False, default="KES")
    exchange_rate_snapshot: Mapped[Decimal] = mapped_column(Numeric(14, 6), nullable=False, default=1)

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


# -- CartAbandonmentLog -------------------------------------------------------
class CartAbandonmentLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Tracks abandoned carts for recovery email campaigns."""

    __tablename__ = "ecom_cart_abandonment_logs"

    cart_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_carts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_customers.id", ondelete="SET NULL"),
        nullable=True,
    )
    items_snapshot: Mapped[list | None] = mapped_column(JSON, nullable=True)
    abandoned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    recovery_email_1_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recovery_email_2_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recovery_email_3_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recovered_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_orders.id", ondelete="SET NULL"),
        nullable=True,
    )
    discount_code_used: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_recovered: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    def __repr__(self) -> str:
        return f"<CartAbandonmentLog email={self.customer_email!r} recovered={self.is_recovered}>"


# -- ProductBundle ------------------------------------------------------------
class ProductBundle(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A bundle of products sold together at a discount."""

    __tablename__ = "ecom_product_bundles"

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    slug: Mapped[str] = mapped_column(String(300), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    discount_type: Mapped[str] = mapped_column(String(20), nullable=False, default="pct")  # pct/fixed
    discount_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    store = relationship("Store", lazy="joined")
    items = relationship("BundleItem", back_populates="bundle", cascade="all, delete-orphan", lazy="selectin")

    def __repr__(self) -> str:
        return f"<ProductBundle id={self.id} name={self.name!r}>"


# -- BundleItem ---------------------------------------------------------------
class BundleItem(Base, UUIDPrimaryKeyMixin):
    """A product inside a bundle."""

    __tablename__ = "ecom_bundle_items"

    bundle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_product_bundles.id", ondelete="CASCADE"),
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

    bundle = relationship("ProductBundle", back_populates="items")
    product = relationship("EcomProduct", lazy="joined")

    def __repr__(self) -> str:
        return f"<BundleItem bundle={self.bundle_id} product={self.product_id}>"


# -- FlashSale ----------------------------------------------------------------
class FlashSale(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Time-limited flash sale for a product."""

    __tablename__ = "ecom_flash_sales"

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sale_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    inventory_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sold_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    countdown_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    store = relationship("Store", lazy="joined")
    product = relationship("EcomProduct", lazy="joined")

    def __repr__(self) -> str:
        return f"<FlashSale product={self.product_id} active={self.is_active}>"


# -- PickupLocation -----------------------------------------------------------
class PickupLocation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """BOPIS pickup location linked to a store."""

    __tablename__ = "ecom_pickup_locations"

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    city: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    operating_hours_json: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    store = relationship("Store", lazy="joined")

    def __repr__(self) -> str:
        return f"<PickupLocation id={self.id} name={self.name!r}>"


# -- EcomOrderWorkOrderLink ---------------------------------------------------
class EcomOrderWorkOrderLink(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Links an e-commerce order line to a manufacturing work order."""

    __tablename__ = "ecom_order_work_order_links"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_line_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_order_lines.id", ondelete="SET NULL"),
        nullable=True,
    )
    work_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )  # FK to mfg_work_orders — cross-module, no DB constraint
    work_order_number: Mapped[str | None] = mapped_column(String(100), nullable=True)

    def __repr__(self) -> str:
        return f"<EcomOrderWorkOrderLink order={self.order_id} wo={self.work_order_id}>"


# -- EcomOrderProjectLink -----------------------------------------------------
class EcomOrderProjectLink(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Links a large e-commerce order to an auto-created project."""

    __tablename__ = "ecom_order_project_links"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_orders.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )  # FK to projects — cross-module, no DB constraint
    project_name: Mapped[str | None] = mapped_column(String(500), nullable=True)

    def __repr__(self) -> str:
        return f"<EcomOrderProjectLink order={self.order_id} project={self.project_id}>"


# -- ImportJob ----------------------------------------------------------------
class ImportJob(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Tracks a bulk product/customer/order import job."""

    __tablename__ = "ecom_import_jobs"

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ecom_stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_platform: Mapped[str] = mapped_column(String(50), nullable=False)  # shopify/woocommerce/bigcommerce/csv
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)  # pending/running/done/failed
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    mappings_json: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
    progress_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_log: Mapped[str | None] = mapped_column(Text, nullable=True)
    imported_products: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    imported_customers: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    imported_orders: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    started_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    def __repr__(self) -> str:
        return f"<ImportJob id={self.id} platform={self.source_platform} status={self.status}>"
