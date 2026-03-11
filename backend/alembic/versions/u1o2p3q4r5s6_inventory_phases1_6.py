"""Inventory Phases 1-6: serial numbers, UoM, blanket orders, WMS (zones/bins),
replenishment suggestions, ABC, kits, supplier prices, landed costs, costing, audit, automation.
Also adds supplier_id / blanket_order_id / warehouse_id / three_way_match_status to PurchaseOrder.

Revision ID: u1o2p3q4r5s6
Revises: s9m0n1o2p3q4
Create Date: 2026-03-11
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision = "u1o2p3q4r5s6"
down_revision = "s9m0n1o2p3q4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Phase 1: UnitOfMeasure ────────────────────────────────────────────────
    op.create_table(
        "inventory_uom",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("abbreviation", sa.String(20), nullable=False),
        sa.Column("category", sa.String(30), server_default=sa.text("'count'"), nullable=False),
        sa.Column("is_base", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Phase 1: UoMConversion ────────────────────────────────────────────────
    op.create_table(
        "inventory_uom_conversions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("from_uom_id", UUID(as_uuid=True), sa.ForeignKey("inventory_uom.id"), nullable=False),
        sa.Column("to_uom_id", UUID(as_uuid=True), sa.ForeignKey("inventory_uom.id"), nullable=False),
        sa.Column("factor", sa.Numeric(18, 6), nullable=False),
        sa.Column("item_id", UUID(as_uuid=True), sa.ForeignKey("inventory_items.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("from_uom_id", "to_uom_id", "item_id", name="uq_uom_conversion"),
    )

    # ── Phase 1: BlanketOrder ─────────────────────────────────────────────────
    op.create_table(
        "inventory_blanket_orders",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("bo_number", sa.String(30), unique=True, nullable=False),
        sa.Column("supplier_id", UUID(as_uuid=True), sa.ForeignKey("inventory_suppliers.id"), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("total_value_limit", sa.Numeric(16, 2), nullable=True),
        sa.Column("released_value", sa.Numeric(16, 2), server_default=sa.text("0"), nullable=False),
        sa.Column("status", sa.String(20), server_default=sa.text("'active'"), nullable=False),
        sa.Column("terms", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Phase 1: SerialNumber ─────────────────────────────────────────────────
    op.create_table(
        "inventory_serial_numbers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("item_id", UUID(as_uuid=True), sa.ForeignKey("inventory_items.id"), nullable=False),
        sa.Column("serial_no", sa.String(100), unique=True, nullable=False),
        sa.Column("warehouse_id", UUID(as_uuid=True), sa.ForeignKey("inventory_warehouses.id"), nullable=True),
        sa.Column("batch_id", UUID(as_uuid=True), sa.ForeignKey("inventory_batch_numbers.id"), nullable=True),
        sa.Column("purchase_order_id", UUID(as_uuid=True), sa.ForeignKey("inventory_purchase_orders.id"), nullable=True),
        sa.Column("status", sa.String(20), server_default=sa.text("'available'"), nullable=False),
        sa.Column("sold_to_reference", sa.String(200), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Phase 1: Enhance PurchaseOrder ────────────────────────────────────────
    op.add_column("inventory_purchase_orders", sa.Column("supplier_id", UUID(as_uuid=True), nullable=True))
    op.add_column("inventory_purchase_orders", sa.Column("blanket_order_id", UUID(as_uuid=True), nullable=True))
    op.add_column("inventory_purchase_orders", sa.Column("warehouse_id", UUID(as_uuid=True), nullable=True))
    op.add_column("inventory_purchase_orders", sa.Column("three_way_match_status", sa.String(20), server_default=sa.text("'pending'"), nullable=False))
    op.create_foreign_key("fk_po_supplier", "inventory_purchase_orders", "inventory_suppliers", ["supplier_id"], ["id"])
    op.create_foreign_key("fk_po_blanket_order", "inventory_purchase_orders", "inventory_blanket_orders", ["blanket_order_id"], ["id"])
    op.create_foreign_key("fk_po_warehouse", "inventory_purchase_orders", "inventory_warehouses", ["warehouse_id"], ["id"])

    # ── Phase 2: WarehouseZone ────────────────────────────────────────────────
    op.create_table(
        "inventory_warehouse_zones",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("warehouse_id", UUID(as_uuid=True), sa.ForeignKey("inventory_warehouses.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("zone_type", sa.String(30), server_default=sa.text("'storage'"), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Phase 2: WarehouseBin ─────────────────────────────────────────────────
    op.create_table(
        "inventory_warehouse_bins",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("zone_id", UUID(as_uuid=True), sa.ForeignKey("inventory_warehouse_zones.id"), nullable=False),
        sa.Column("warehouse_id", UUID(as_uuid=True), sa.ForeignKey("inventory_warehouses.id"), nullable=False),
        sa.Column("bin_code", sa.String(50), nullable=False),
        sa.Column("bin_type", sa.String(30), server_default=sa.text("'standard'"), nullable=False),
        sa.Column("max_weight", sa.Numeric(10, 3), nullable=True),
        sa.Column("max_volume", sa.Numeric(10, 3), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("warehouse_id", "bin_code", name="uq_bin_code_per_warehouse"),
    )

    # ── Phase 2: BinContent ───────────────────────────────────────────────────
    op.create_table(
        "inventory_bin_contents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("bin_id", UUID(as_uuid=True), sa.ForeignKey("inventory_warehouse_bins.id"), nullable=False),
        sa.Column("item_id", UUID(as_uuid=True), sa.ForeignKey("inventory_items.id"), nullable=False),
        sa.Column("variant_id", UUID(as_uuid=True), sa.ForeignKey("inventory_item_variants.id"), nullable=True),
        sa.Column("batch_id", UUID(as_uuid=True), sa.ForeignKey("inventory_batch_numbers.id"), nullable=True),
        sa.Column("serial_id", UUID(as_uuid=True), sa.ForeignKey("inventory_serial_numbers.id"), nullable=True),
        sa.Column("quantity", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("bin_id", "item_id", "variant_id", "batch_id", name="uq_bin_content"),
    )

    # ── Phase 2: PutawayRule ──────────────────────────────────────────────────
    op.create_table(
        "inventory_putaway_rules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("warehouse_id", UUID(as_uuid=True), sa.ForeignKey("inventory_warehouses.id"), nullable=False),
        sa.Column("item_id", UUID(as_uuid=True), sa.ForeignKey("inventory_items.id"), nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("zone_id", UUID(as_uuid=True), sa.ForeignKey("inventory_warehouse_zones.id"), nullable=True),
        sa.Column("bin_id", UUID(as_uuid=True), sa.ForeignKey("inventory_warehouse_bins.id"), nullable=True),
        sa.Column("priority", sa.Integer(), server_default=sa.text("10"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Phase 2: PickList ─────────────────────────────────────────────────────
    op.create_table(
        "inventory_pick_lists",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("pick_number", sa.String(30), unique=True, nullable=False),
        sa.Column("warehouse_id", UUID(as_uuid=True), sa.ForeignKey("inventory_warehouses.id"), nullable=False),
        sa.Column("status", sa.String(20), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("pick_strategy", sa.String(20), server_default=sa.text("'fifo'"), nullable=False),
        sa.Column("assigned_to", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reference_type", sa.String(50), nullable=True),
        sa.Column("reference_id", UUID(as_uuid=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Phase 2: PickListLine ─────────────────────────────────────────────────
    op.create_table(
        "inventory_pick_list_lines",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("pick_list_id", UUID(as_uuid=True), sa.ForeignKey("inventory_pick_lists.id"), nullable=False),
        sa.Column("item_id", UUID(as_uuid=True), sa.ForeignKey("inventory_items.id"), nullable=False),
        sa.Column("bin_id", UUID(as_uuid=True), sa.ForeignKey("inventory_warehouse_bins.id"), nullable=True),
        sa.Column("batch_id", UUID(as_uuid=True), sa.ForeignKey("inventory_batch_numbers.id"), nullable=True),
        sa.Column("serial_id", UUID(as_uuid=True), sa.ForeignKey("inventory_serial_numbers.id"), nullable=True),
        sa.Column("quantity_requested", sa.Integer(), nullable=False),
        sa.Column("quantity_picked", sa.Integer(), server_default=sa.text("0"), nullable=False),
    )

    # ── Phase 3: PurchaseSuggestion ───────────────────────────────────────────
    op.create_table(
        "inventory_purchase_suggestions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("item_id", UUID(as_uuid=True), sa.ForeignKey("inventory_items.id"), nullable=False),
        sa.Column("warehouse_id", UUID(as_uuid=True), sa.ForeignKey("inventory_warehouses.id"), nullable=False),
        sa.Column("supplier_id", UUID(as_uuid=True), sa.ForeignKey("inventory_suppliers.id"), nullable=True),
        sa.Column("suggested_qty", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Phase 3: ItemClassification ───────────────────────────────────────────
    op.create_table(
        "inventory_item_classifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("item_id", UUID(as_uuid=True), sa.ForeignKey("inventory_items.id"), nullable=False),
        sa.Column("warehouse_id", UUID(as_uuid=True), sa.ForeignKey("inventory_warehouses.id"), nullable=False),
        sa.Column("abc_class", sa.String(1), nullable=True),
        sa.Column("xyz_class", sa.String(1), nullable=True),
        sa.Column("combined_class", sa.String(2), nullable=True),
        sa.Column("annual_consumption_value", sa.Numeric(16, 2), server_default=sa.text("0"), nullable=False),
        sa.Column("demand_variability", sa.Numeric(8, 4), nullable=True),
        sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("item_id", "warehouse_id", name="uq_item_classification"),
    )

    # ── Phase 4: Kits ─────────────────────────────────────────────────────────
    op.create_table(
        "inventory_kits",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("kit_item_id", UUID(as_uuid=True), sa.ForeignKey("inventory_items.id"), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "inventory_kit_components",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("kit_id", UUID(as_uuid=True), sa.ForeignKey("inventory_kits.id"), nullable=False),
        sa.Column("component_item_id", UUID(as_uuid=True), sa.ForeignKey("inventory_items.id"), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 4), nullable=False),
        sa.Column("is_optional", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )

    # ── Phase 4: SupplierPriceList ────────────────────────────────────────────
    op.create_table(
        "inventory_supplier_prices",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("supplier_id", UUID(as_uuid=True), sa.ForeignKey("inventory_suppliers.id"), nullable=False),
        sa.Column("item_id", UUID(as_uuid=True), sa.ForeignKey("inventory_items.id"), nullable=False),
        sa.Column("unit_price", sa.Numeric(14, 4), nullable=False),
        sa.Column("min_order_qty", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("lead_time_days", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("currency", sa.String(3), server_default=sa.text("'USD'"), nullable=False),
        sa.Column("valid_from", sa.Date(), nullable=True),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Phase 4: LandedCost ───────────────────────────────────────────────────
    op.create_table(
        "inventory_landed_cost_vouchers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("voucher_number", sa.String(30), unique=True, nullable=False),
        sa.Column("purchase_order_id", UUID(as_uuid=True), sa.ForeignKey("inventory_purchase_orders.id"), nullable=True),
        sa.Column("status", sa.String(20), server_default=sa.text("'draft'"), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "inventory_landed_cost_lines",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("voucher_id", UUID(as_uuid=True), sa.ForeignKey("inventory_landed_cost_vouchers.id"), nullable=False),
        sa.Column("cost_type", sa.String(50), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(3), server_default=sa.text("'USD'"), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
    )

    op.create_table(
        "inventory_landed_cost_allocations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("voucher_id", UUID(as_uuid=True), sa.ForeignKey("inventory_landed_cost_vouchers.id"), nullable=False),
        sa.Column("item_id", UUID(as_uuid=True), sa.ForeignKey("inventory_items.id"), nullable=False),
        sa.Column("allocated_amount", sa.Numeric(14, 4), nullable=False),
        sa.Column("allocation_method", sa.String(20), server_default=sa.text("'by_value'"), nullable=False),
    )

    # ── Phase 5: CostingConfig ────────────────────────────────────────────────
    op.create_table(
        "inventory_costing_config",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("item_id", UUID(as_uuid=True), sa.ForeignKey("inventory_items.id"), nullable=False),
        sa.Column("method", sa.String(20), server_default=sa.text("'average'"), nullable=False),
        sa.Column("standard_cost", sa.Numeric(14, 4), nullable=True),
        sa.Column("last_updated_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("item_id", name="uq_costing_config_item"),
    )

    # ── Phase 5: CostLayer ────────────────────────────────────────────────────
    op.create_table(
        "inventory_cost_layers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("item_id", UUID(as_uuid=True), sa.ForeignKey("inventory_items.id"), nullable=False),
        sa.Column("warehouse_id", UUID(as_uuid=True), sa.ForeignKey("inventory_warehouses.id"), nullable=False),
        sa.Column("purchase_order_id", UUID(as_uuid=True), sa.ForeignKey("inventory_purchase_orders.id"), nullable=True),
        sa.Column("quantity_received", sa.Integer(), nullable=False),
        sa.Column("quantity_remaining", sa.Integer(), nullable=False),
        sa.Column("unit_cost", sa.Numeric(14, 4), nullable=False),
        sa.Column("receipt_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Phase 5: InventoryAuditTrail ──────────────────────────────────────────
    op.create_table(
        "inventory_audit_trail",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", UUID(as_uuid=True), nullable=False),
        sa.Column("field_name", sa.String(100), nullable=False),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("changed_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_inv_audit_entity", "inventory_audit_trail", ["entity_type", "entity_id"])

    # ── Phase 6: InventoryAutomationRule ──────────────────────────────────────
    op.create_table(
        "inventory_automation_rules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("trigger_event", sa.String(50), nullable=False),
        sa.Column("conditions", JSON(), nullable=True),
        sa.Column("action_type", sa.String(50), nullable=False),
        sa.Column("action_config", JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("last_triggered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    # Phase 6
    op.drop_table("inventory_automation_rules")
    # Phase 5
    op.drop_index("ix_inv_audit_entity", "inventory_audit_trail")
    op.drop_table("inventory_audit_trail")
    op.drop_table("inventory_cost_layers")
    op.drop_table("inventory_costing_config")
    # Phase 4
    op.drop_table("inventory_landed_cost_allocations")
    op.drop_table("inventory_landed_cost_lines")
    op.drop_table("inventory_landed_cost_vouchers")
    op.drop_table("inventory_supplier_prices")
    op.drop_table("inventory_kit_components")
    op.drop_table("inventory_kits")
    # Phase 3
    op.drop_table("inventory_item_classifications")
    op.drop_table("inventory_purchase_suggestions")
    # Phase 2
    op.drop_table("inventory_pick_list_lines")
    op.drop_table("inventory_pick_lists")
    op.drop_table("inventory_putaway_rules")
    op.drop_table("inventory_bin_contents")
    op.drop_table("inventory_warehouse_bins")
    op.drop_table("inventory_warehouse_zones")
    # Phase 1 PO enhancements
    op.drop_constraint("fk_po_warehouse", "inventory_purchase_orders", type_="foreignkey")
    op.drop_constraint("fk_po_blanket_order", "inventory_purchase_orders", type_="foreignkey")
    op.drop_constraint("fk_po_supplier", "inventory_purchase_orders", type_="foreignkey")
    op.drop_column("inventory_purchase_orders", "three_way_match_status")
    op.drop_column("inventory_purchase_orders", "warehouse_id")
    op.drop_column("inventory_purchase_orders", "blanket_order_id")
    op.drop_column("inventory_purchase_orders", "supplier_id")
    # Phase 1 new tables
    op.drop_table("inventory_serial_numbers")
    op.drop_table("inventory_blanket_orders")
    op.drop_table("inventory_uom_conversions")
    op.drop_table("inventory_uom")
