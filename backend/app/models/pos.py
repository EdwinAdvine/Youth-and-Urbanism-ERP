"""Point of Sale models — sessions, transactions, lines, payments, bundles, modifiers."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Date,
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


# ── POS Session ──────────────────────────────────────────────────────────────
class POSSession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A cashier shift / register session."""

    __tablename__ = "pos_sessions"

    session_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    cashier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False
    )
    terminal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_terminals.id"), nullable=True
    )
    opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    opening_balance: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    closing_balance: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    expected_balance: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    difference: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="open"
    )  # open, closed, reconciled
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    cashier = relationship("User", foreign_keys=[cashier_id])
    warehouse = relationship("Warehouse")
    terminal = relationship("POSTerminal")
    transactions = relationship("POSTransaction", back_populates="session")


# ── POS Transaction ──────────────────────────────────────────────────────────
class POSTransaction(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A single sale / return at the POS terminal."""

    __tablename__ = "pos_transactions"

    transaction_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_sessions.id"), nullable=False
    )
    customer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    customer_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_contacts.id"), nullable=True
    )
    subtotal: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    discount_type: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # percentage, fixed
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    tip_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="completed"
    )  # completed, refunded, voided, held, layaway
    held_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    receipt_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # Relationships
    session = relationship("POSSession", back_populates="transactions")
    customer = relationship("Contact", foreign_keys=[customer_id])
    lines = relationship(
        "POSTransactionLine", back_populates="transaction", cascade="all, delete-orphan"
    )
    payments = relationship(
        "POSPayment", back_populates="transaction", cascade="all, delete-orphan"
    )
    creator = relationship("User", foreign_keys=[created_by])


# ── POS Transaction Line ─────────────────────────────────────────────────────
class POSTransactionLine(UUIDPrimaryKeyMixin, Base):
    """Single line item in a POS transaction."""

    __tablename__ = "pos_transaction_lines"

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_transactions.id"), nullable=False
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_item_variants.id"), nullable=True
    )
    batch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_batch_numbers.id"), nullable=True
    )
    bundle_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_bundles.id"), nullable=True
    )
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)
    item_sku: Mapped[str] = mapped_column(String(50), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    modifiers: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    transaction = relationship("POSTransaction", back_populates="lines")
    item = relationship("InventoryItem")
    variant = relationship("ItemVariant")
    batch = relationship("BatchNumber")
    bundle = relationship("POSBundle")


# ── POS Payment ──────────────────────────────────────────────────────────────
class POSPayment(UUIDPrimaryKeyMixin, Base):
    """Payment tendered for a POS transaction."""

    __tablename__ = "pos_payments"

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_transactions.id"), nullable=False
    )
    payment_method: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # cash, card, mobile_money, gift_card, store_credit, split
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    reference: Mapped[str | None] = mapped_column(String(200), nullable=True)
    change_given: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)

    transaction = relationship("POSTransaction", back_populates="payments")


# ── POS Terminal ────────────────────────────────────────────────────────────
class POSTerminal(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A physical or virtual POS terminal/register."""

    __tablename__ = "pos_terminals"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    location: Mapped[str | None] = mapped_column(String(300), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    settings: Mapped[dict | None] = mapped_column(JSON, nullable=True)


# ── POS Discount ────────────────────────────────────────────────────────────
class POSDiscount(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Reusable discount definitions for POS transactions."""

    __tablename__ = "pos_discounts"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    discount_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # percentage, fixed
    value: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    valid_from: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    valid_to: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    conditions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)


# ── POS Receipt ─────────────────────────────────────────────────────────────
class POSReceipt(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Formal receipt generated for a POS transaction."""

    __tablename__ = "pos_receipts"

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_transactions.id"), nullable=False
    )
    receipt_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    printed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    transaction = relationship("POSTransaction")


# ── POS Cash Movement ───────────────────────────────────────────────────────
class POSCashMovement(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Cash-in / cash-out within a POS session (e.g. float top-up, cash drop)."""

    __tablename__ = "pos_cash_movements"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_sessions.id"), nullable=False
    )
    movement_type: Mapped[str] = mapped_column(
        String(10), nullable=False
    )  # in, out
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    session = relationship("POSSession")
    creator = relationship("User", foreign_keys=[created_by])


# ── POS Bundle ─────────────────────────────────────────────────────────────
class POSBundle(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A product bundle / combo sold at a single price."""

    __tablename__ = "pos_bundles"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    bundle_price: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True)

    items = relationship("POSBundleItem", back_populates="bundle", cascade="all, delete-orphan")


class POSBundleItem(UUIDPrimaryKeyMixin, Base):
    """A single item within a product bundle."""

    __tablename__ = "pos_bundle_items"

    bundle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_bundles.id"), nullable=False
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    bundle = relationship("POSBundle", back_populates="items")
    item = relationship("InventoryItem")


# ── POS Modifier ───────────────────────────────────────────────────────────
class POSModifierGroup(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A group of modifiers for a product (e.g. Size, Add-ons)."""

    __tablename__ = "pos_modifier_groups"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    selection_type: Mapped[str] = mapped_column(
        String(20), default="single"
    )  # single, multiple
    is_required: Mapped[bool] = mapped_column(default=False)
    min_selections: Mapped[int] = mapped_column(Integer, default=0)
    max_selections: Mapped[int] = mapped_column(Integer, default=0)

    modifiers = relationship("POSModifier", back_populates="group", cascade="all, delete-orphan")
    product_links = relationship("POSProductModifierLink", back_populates="modifier_group", cascade="all, delete-orphan")


class POSModifier(UUIDPrimaryKeyMixin, Base):
    """A single modifier option (e.g. Large, Extra cheese)."""

    __tablename__ = "pos_modifiers"

    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_modifier_groups.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    price_adjustment: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    is_active: Mapped[bool] = mapped_column(default=True)

    group = relationship("POSModifierGroup", back_populates="modifiers")


class POSProductModifierLink(UUIDPrimaryKeyMixin, Base):
    """Links an inventory item to a modifier group."""

    __tablename__ = "pos_product_modifier_links"

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False
    )
    modifier_group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_modifier_groups.id"), nullable=False
    )

    item = relationship("InventoryItem")
    modifier_group = relationship("POSModifierGroup", back_populates="product_links")


# ── POS Gift Card ──────────────────────────────────────────────────────────
class POSGiftCard(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A gift card with loadable / redeemable balance."""

    __tablename__ = "pos_gift_cards"

    card_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    original_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    current_balance: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_contacts.id"), nullable=True
    )
    issued_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(default=True)

    customer = relationship("Contact", foreign_keys=[customer_id])
    issuer = relationship("User", foreign_keys=[issued_by])
    transactions = relationship("POSGiftCardTransaction", back_populates="gift_card")


class POSGiftCardTransaction(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A single load or redemption on a gift card."""

    __tablename__ = "pos_gift_card_transactions"

    gift_card_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_gift_cards.id"), nullable=False
    )
    transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_transactions.id"), nullable=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    gift_card = relationship("POSGiftCard", back_populates="transactions")
    pos_transaction = relationship("POSTransaction")


# ── POS Store Credit ───────────────────────────────────────────────────────
class POSStoreCredit(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Aggregated store credit balance for a customer."""

    __tablename__ = "pos_store_credits"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_contacts.id"), unique=True, nullable=False
    )
    balance: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)

    customer = relationship("Contact", foreign_keys=[customer_id])
    transactions = relationship("POSStoreCreditTransaction", back_populates="store_credit")


class POSStoreCreditTransaction(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A single adjustment to a customer's store credit."""

    __tablename__ = "pos_store_credit_transactions"

    store_credit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_store_credits.id"), nullable=False
    )
    transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_transactions.id"), nullable=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    reason: Mapped[str] = mapped_column(String(200), nullable=False)

    store_credit = relationship("POSStoreCredit", back_populates="transactions")
    pos_transaction = relationship("POSTransaction")


# ── POS Pickup Order (BOPIS) ──────────────────────────────────────────────
class POSPickupOrder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Buy-online-pickup-in-store order."""

    __tablename__ = "pos_pickup_orders"

    ecom_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_orders.id"), nullable=False
    )
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(30), default="pending_prep"
    )  # pending_prep, ready, picked_up, cancelled
    ready_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    picked_up_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    picked_up_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    ecom_order = relationship("EcomOrder")
    warehouse = relationship("Warehouse")
    picker = relationship("User", foreign_keys=[picked_up_by])


# ── POS Payment Gateway Config ────────────────────────────────────────────
class POSPaymentGatewayConfig(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Links a payment gateway to a POS terminal with optional overrides."""

    __tablename__ = "pos_payment_gateway_configs"

    terminal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_terminals.id"), nullable=True
    )
    gateway_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_payment_gateways.id"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(default=True)
    config_overrides: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    terminal = relationship("POSTerminal")
    gateway = relationship("PaymentGateway")


# ── POS Commission ─────────────────────────────────────────────────────────
class POSCommissionRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Commission rule definition for cashier sales."""

    __tablename__ = "pos_commission_rules"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    rule_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # flat_per_sale, percentage, tiered
    value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    tiers: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)


class POSCommission(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Calculated commission for a cashier on a transaction."""

    __tablename__ = "pos_commissions"

    cashier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_sessions.id"), nullable=False
    )
    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_transactions.id"), nullable=False
    )
    rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_commission_rules.id"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="calculated"
    )  # calculated, approved, paid

    cashier = relationship("User", foreign_keys=[cashier_id])
    session = relationship("POSSession")
    transaction = relationship("POSTransaction")
    rule = relationship("POSCommissionRule")


# ── POS Tip Pool ───────────────────────────────────────────────────────────
class POSTipPool(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Pooled tips for a day at a location, distributed to cashiers."""

    __tablename__ = "pos_tip_pools"

    session_date: Mapped[date] = mapped_column(Date, nullable=False)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_warehouses.id"), nullable=False
    )
    total_tips: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    distribution_method: Mapped[str] = mapped_column(
        String(30), default="equal"
    )  # equal, hours_worked, sales_volume
    status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending, distributed
    distributions: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    warehouse = relationship("Warehouse")
