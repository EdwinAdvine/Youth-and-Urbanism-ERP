"""Inventory Phase 0: Create unmigrated tables (suppliers, adjustments, variants,
batches, counts) and enrich Warehouse, InventoryItem, StockLevel with new columns.

Revision ID: o5i6j7k8l9m0
Revises: n4h5i6j7k8l9
Create Date: 2026-03-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision = "o5i6j7k8l9m0"
down_revision = "n4h5i6j7k8l9"
branch_labels = None
depends_on = None


def _table_exists(conn, table_name: str) -> bool:
    result = conn.execute(
        sa.text("SELECT to_regclass(:tbl)"), {"tbl": table_name}
    )
    return result.scalar() is not None


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :tbl AND column_name = :col"
        ),
        {"tbl": table_name, "col": column_name},
    )
    return result.fetchone() is not None


def upgrade() -> None:
    conn = op.get_bind()

    # ── Create unmigrated tables ─────────────────────────────────────────────

    # inventory_suppliers
    if not _table_exists(conn, "inventory_suppliers"):
     op.create_table(
        "inventory_suppliers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(200), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("contact_person", sa.String(200), nullable=True),
        sa.Column("payment_terms", sa.String(200), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
     )

    # inventory_stock_adjustments
    if not _table_exists(conn, "inventory_stock_adjustments"):
     op.create_table(
        "inventory_stock_adjustments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("item_id", UUID(as_uuid=True), sa.ForeignKey("inventory_items.id"), nullable=False),
        sa.Column("warehouse_id", UUID(as_uuid=True), sa.ForeignKey("inventory_warehouses.id"), nullable=False),
        sa.Column("old_quantity", sa.Integer(), nullable=False),
        sa.Column("new_quantity", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("adjusted_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
     )

    # inventory_item_variants
    if not _table_exists(conn, "inventory_item_variants"):
     op.create_table(
        "inventory_item_variants",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("item_id", UUID(as_uuid=True), sa.ForeignKey("inventory_items.id"), nullable=False),
        sa.Column("variant_name", sa.String(200), nullable=False),
        sa.Column("sku", sa.String(50), unique=True, nullable=False),
        sa.Column("price_adjustment", sa.Numeric(12, 2), server_default=sa.text("0"), nullable=False),
        sa.Column("attributes", JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
     )

    # inventory_batch_numbers
    if not _table_exists(conn, "inventory_batch_numbers"):
     op.create_table(
        "inventory_batch_numbers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("item_id", UUID(as_uuid=True), sa.ForeignKey("inventory_items.id"), nullable=False),
        sa.Column("batch_no", sa.String(100), unique=True, nullable=False),
        sa.Column("manufacture_date", sa.Date(), nullable=False),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("warehouse_id", UUID(as_uuid=True), sa.ForeignKey("inventory_warehouses.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
     )

    # inventory_counts
    if not _table_exists(conn, "inventory_counts"):
     op.create_table(
        "inventory_counts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("warehouse_id", UUID(as_uuid=True), sa.ForeignKey("inventory_warehouses.id"), nullable=False),
        sa.Column("count_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(20), server_default=sa.text("'in_progress'"), nullable=False),
        sa.Column("counted_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("lines", JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
     )

    # ── Enrich Warehouse ─────────────────────────────────────────────────────

    if not _column_exists(conn, "inventory_warehouses", "address"):
        op.add_column("inventory_warehouses", sa.Column("address", sa.Text(), nullable=True))
    if not _column_exists(conn, "inventory_warehouses", "warehouse_type"):
        op.add_column("inventory_warehouses", sa.Column("warehouse_type", sa.String(30), server_default=sa.text("'standard'"), nullable=False))
    if not _column_exists(conn, "inventory_warehouses", "manager_id"):
        op.add_column("inventory_warehouses", sa.Column("manager_id", UUID(as_uuid=True), nullable=True))
        op.create_foreign_key("fk_warehouse_manager", "inventory_warehouses", "users", ["manager_id"], ["id"])

    # ── Enrich InventoryItem ─────────────────────────────────────────────────

    if not _column_exists(conn, "inventory_items", "item_type"):
        op.add_column("inventory_items", sa.Column("item_type", sa.String(30), server_default=sa.text("'stockable'"), nullable=False))
    if not _column_exists(conn, "inventory_items", "tracking_type"):
        op.add_column("inventory_items", sa.Column("tracking_type", sa.String(20), server_default=sa.text("'none'"), nullable=False))
    if not _column_exists(conn, "inventory_items", "weight"):
        op.add_column("inventory_items", sa.Column("weight", sa.Numeric(10, 3), nullable=True))
    if not _column_exists(conn, "inventory_items", "dimensions"):
        op.add_column("inventory_items", sa.Column("dimensions", JSON(), nullable=True))
    if not _column_exists(conn, "inventory_items", "barcode"):
        op.add_column("inventory_items", sa.Column("barcode", sa.String(100), nullable=True))
        op.create_index("ix_inventory_items_barcode", "inventory_items", ["barcode"])
    if not _column_exists(conn, "inventory_items", "min_order_qty"):
        op.add_column("inventory_items", sa.Column("min_order_qty", sa.Integer(), server_default=sa.text("1"), nullable=False))
    if not _column_exists(conn, "inventory_items", "lead_time_days"):
        op.add_column("inventory_items", sa.Column("lead_time_days", sa.Integer(), server_default=sa.text("0"), nullable=False))
    if not _column_exists(conn, "inventory_items", "preferred_supplier_id"):
        op.add_column("inventory_items", sa.Column("preferred_supplier_id", UUID(as_uuid=True), nullable=True))
        op.create_foreign_key("fk_item_preferred_supplier", "inventory_items", "inventory_suppliers", ["preferred_supplier_id"], ["id"])
    if not _column_exists(conn, "inventory_items", "custom_fields"):
        op.add_column("inventory_items", sa.Column("custom_fields", JSON(), nullable=True))
    if not _column_exists(conn, "inventory_items", "max_stock_level"):
        op.add_column("inventory_items", sa.Column("max_stock_level", sa.Integer(), nullable=True))

    # ── Enrich StockLevel ────────────────────────────────────────────────────

    if not _column_exists(conn, "inventory_stock_levels", "quantity_committed"):
        op.add_column("inventory_stock_levels", sa.Column("quantity_committed", sa.Integer(), server_default=sa.text("0"), nullable=False))
    if not _column_exists(conn, "inventory_stock_levels", "quantity_incoming"):
        op.add_column("inventory_stock_levels", sa.Column("quantity_incoming", sa.Integer(), server_default=sa.text("0"), nullable=False))
    if not _column_exists(conn, "inventory_stock_levels", "bin_location"):
        op.add_column("inventory_stock_levels", sa.Column("bin_location", sa.String(100), nullable=True))


def downgrade() -> None:
    # ── StockLevel columns ───────────────────────────────────────────────────
    op.drop_column("inventory_stock_levels", "bin_location")
    op.drop_column("inventory_stock_levels", "quantity_incoming")
    op.drop_column("inventory_stock_levels", "quantity_committed")

    # ── InventoryItem columns ────────────────────────────────────────────────
    op.drop_constraint("fk_item_preferred_supplier", "inventory_items", type_="foreignkey")
    op.drop_index("ix_inventory_items_barcode", "inventory_items")
    op.drop_column("inventory_items", "max_stock_level")
    op.drop_column("inventory_items", "custom_fields")
    op.drop_column("inventory_items", "preferred_supplier_id")
    op.drop_column("inventory_items", "lead_time_days")
    op.drop_column("inventory_items", "min_order_qty")
    op.drop_column("inventory_items", "barcode")
    op.drop_column("inventory_items", "dimensions")
    op.drop_column("inventory_items", "weight")
    op.drop_column("inventory_items", "tracking_type")
    op.drop_column("inventory_items", "item_type")

    # ── Warehouse columns ────────────────────────────────────────────────────
    op.drop_constraint("fk_warehouse_manager", "inventory_warehouses", type_="foreignkey")
    op.drop_column("inventory_warehouses", "manager_id")
    op.drop_column("inventory_warehouses", "warehouse_type")
    op.drop_column("inventory_warehouses", "address")

    # ── Drop new tables ──────────────────────────────────────────────────────
    op.drop_table("inventory_counts")
    op.drop_table("inventory_batch_numbers")
    op.drop_table("inventory_item_variants")
    op.drop_table("inventory_stock_adjustments")
    op.drop_table("inventory_suppliers")
