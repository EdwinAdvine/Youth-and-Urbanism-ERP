"""POS Upgrade — Phases 0-4: Loyalty, KDS, Bundles, Modifiers, Gift Cards, Store Credit,
BOPIS, Commissions, Tips Pool, Payment Gateway Config, and extend POS transaction models.

Revision ID: t0n1o2p3q4r5
Revises: u1o2p3q4r5s6
Create Date: 2026-03-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision = "t0n1o2p3q4r5"
down_revision = "u1o2p3q4r5s6"
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


def _index_exists(conn, index_name: str) -> bool:
    result = conn.execute(
        sa.text("SELECT to_regclass(:idx)"), {"idx": index_name}
    )
    return result.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()

    # ── Phase 0: Extend POSTransaction ───────────────────────────────────────

    if not _column_exists(conn, "pos_transactions", "customer_id"):
        op.add_column("pos_transactions", sa.Column("customer_id", UUID(as_uuid=True), sa.ForeignKey("crm_contacts.id"), nullable=True))
    if not _column_exists(conn, "pos_transactions", "tip_amount"):
        op.add_column("pos_transactions", sa.Column("tip_amount", sa.Numeric(15, 2), server_default=sa.text("0"), nullable=False))
    if not _column_exists(conn, "pos_transactions", "held_at"):
        op.add_column("pos_transactions", sa.Column("held_at", sa.DateTime(timezone=True), nullable=True))

    # ── Phase 0: Extend POSTransactionLine ───────────────────────────────────

    if not _column_exists(conn, "pos_transaction_lines", "variant_id"):
        op.add_column("pos_transaction_lines", sa.Column("variant_id", UUID(as_uuid=True), nullable=True))
    if not _column_exists(conn, "pos_transaction_lines", "batch_id"):
        op.add_column("pos_transaction_lines", sa.Column("batch_id", UUID(as_uuid=True), nullable=True))
    if not _column_exists(conn, "pos_transaction_lines", "bundle_id"):
        op.add_column("pos_transaction_lines", sa.Column("bundle_id", UUID(as_uuid=True), nullable=True))
    if not _column_exists(conn, "pos_transaction_lines", "modifiers"):
        op.add_column("pos_transaction_lines", sa.Column("modifiers", JSON(), nullable=True))

    # ── Phase 0: Extend POSSession ───────────────────────────────────────────

    if not _column_exists(conn, "pos_sessions", "terminal_id"):
        op.add_column("pos_sessions", sa.Column("terminal_id", UUID(as_uuid=True), nullable=True))

    # ── Phase 0: Extend InventoryItem with RFID ──────────────────────────────

    if not _column_exists(conn, "inventory_items", "rfid_tag"):
        op.add_column("inventory_items", sa.Column("rfid_tag", sa.String(100), nullable=True))
        if not _index_exists(conn, "ix_inventory_items_rfid_tag"):
            op.create_index("ix_inventory_items_rfid_tag", "inventory_items", ["rfid_tag"])

    # ── Phase 1: POS Bundles ──────────────────────────────────────────────────

    if not _table_exists(conn, "pos_bundles"):
        op.create_table(
            "pos_bundles",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("bundle_price", sa.Numeric(12, 2), nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if not _table_exists(conn, "pos_bundle_items"):
        op.create_table(
            "pos_bundle_items",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("bundle_id", UUID(as_uuid=True), sa.ForeignKey("pos_bundles.id", ondelete="CASCADE"), nullable=False),
            sa.Column("item_id", UUID(as_uuid=True), sa.ForeignKey("inventory_items.id"), nullable=False),
            sa.Column("quantity", sa.Integer(), server_default=sa.text("1"), nullable=False),
        )

    # ── Phase 1: POS Modifier Groups & Modifiers ─────────────────────────────

    if not _table_exists(conn, "pos_modifier_groups"):
        op.create_table(
            "pos_modifier_groups",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("selection_type", sa.String(20), server_default=sa.text("'single'"), nullable=False),
            sa.Column("is_required", sa.Boolean(), server_default=sa.text("false"), nullable=False),
            sa.Column("min_selections", sa.Integer(), server_default=sa.text("0"), nullable=False),
            sa.Column("max_selections", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if not _table_exists(conn, "pos_modifiers"):
        op.create_table(
            "pos_modifiers",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("group_id", UUID(as_uuid=True), sa.ForeignKey("pos_modifier_groups.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("price_adjustment", sa.Numeric(12, 2), server_default=sa.text("0"), nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        )

    if not _table_exists(conn, "pos_product_modifier_links"):
        op.create_table(
            "pos_product_modifier_links",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("item_id", UUID(as_uuid=True), sa.ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False),
            sa.Column("modifier_group_id", UUID(as_uuid=True), sa.ForeignKey("pos_modifier_groups.id", ondelete="CASCADE"), nullable=False),
        )

    # ── Phase 2: Loyalty Program ──────────────────────────────────────────────

    if not _table_exists(conn, "loyalty_programs"):
        op.create_table(
            "loyalty_programs",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("points_per_unit_currency", sa.Numeric(10, 2), server_default=sa.text("1"), nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if not _table_exists(conn, "loyalty_tiers"):
        op.create_table(
            "loyalty_tiers",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("program_id", UUID(as_uuid=True), sa.ForeignKey("loyalty_programs.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("min_points", sa.Integer(), server_default=sa.text("0"), nullable=False),
            sa.Column("discount_percentage", sa.Numeric(5, 2), server_default=sa.text("0"), nullable=False),
            sa.Column("points_multiplier", sa.Numeric(5, 2), server_default=sa.text("1"), nullable=False),
            sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        )

    if not _table_exists(conn, "loyalty_members"):
        op.create_table(
            "loyalty_members",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("program_id", UUID(as_uuid=True), sa.ForeignKey("loyalty_programs.id"), nullable=False),
            sa.Column("customer_id", UUID(as_uuid=True), sa.ForeignKey("crm_contacts.id"), nullable=False),
            sa.Column("points_balance", sa.Integer(), server_default=sa.text("0"), nullable=False),
            sa.Column("lifetime_points", sa.Integer(), server_default=sa.text("0"), nullable=False),
            sa.Column("tier_id", UUID(as_uuid=True), sa.ForeignKey("loyalty_tiers.id"), nullable=True),
            sa.Column("referral_code", sa.String(20), unique=True, nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if not _table_exists(conn, "loyalty_transactions"):
        op.create_table(
            "loyalty_transactions",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("member_id", UUID(as_uuid=True), sa.ForeignKey("loyalty_members.id"), nullable=False),
            sa.Column("pos_transaction_id", UUID(as_uuid=True), sa.ForeignKey("pos_transactions.id"), nullable=True),
            sa.Column("points_change", sa.Integer(), nullable=False),
            sa.Column("reason", sa.String(200), nullable=False),
            sa.Column("balance_after", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if not _table_exists(conn, "loyalty_rewards"):
        op.create_table(
            "loyalty_rewards",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("program_id", UUID(as_uuid=True), sa.ForeignKey("loyalty_programs.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("points_cost", sa.Integer(), nullable=False),
            sa.Column("reward_type", sa.String(50), nullable=False),
            sa.Column("reward_value", JSON(), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # ── Phase 2: Gift Cards & Store Credit ───────────────────────────────────

    if not _table_exists(conn, "pos_gift_cards"):
        op.create_table(
            "pos_gift_cards",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("card_number", sa.String(50), unique=True, nullable=False),
            sa.Column("original_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("current_balance", sa.Numeric(12, 2), nullable=False),
            sa.Column("customer_id", UUID(as_uuid=True), sa.ForeignKey("crm_contacts.id"), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if not _table_exists(conn, "pos_gift_card_transactions"):
        op.create_table(
            "pos_gift_card_transactions",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("gift_card_id", UUID(as_uuid=True), sa.ForeignKey("pos_gift_cards.id"), nullable=False),
            sa.Column("transaction_id", UUID(as_uuid=True), sa.ForeignKey("pos_transactions.id"), nullable=True),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("balance_after", sa.Numeric(12, 2), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if not _table_exists(conn, "pos_store_credits"):
        op.create_table(
            "pos_store_credits",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("customer_id", UUID(as_uuid=True), sa.ForeignKey("crm_contacts.id"), unique=True, nullable=False),
            sa.Column("balance", sa.Numeric(12, 2), server_default=sa.text("0"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if not _table_exists(conn, "pos_store_credit_transactions"):
        op.create_table(
            "pos_store_credit_transactions",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("store_credit_id", UUID(as_uuid=True), sa.ForeignKey("pos_store_credits.id"), nullable=False),
            sa.Column("transaction_id", UUID(as_uuid=True), sa.ForeignKey("pos_transactions.id"), nullable=True),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("balance_after", sa.Numeric(12, 2), nullable=False),
            sa.Column("reason", sa.String(200), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # ── Phase 2: BOPIS (Buy Online, Pickup In Store) ──────────────────────────

    if not _table_exists(conn, "pos_pickup_orders"):
        op.create_table(
            "pos_pickup_orders",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("ecom_order_id", UUID(as_uuid=True), nullable=False),
            sa.Column("warehouse_id", UUID(as_uuid=True), sa.ForeignKey("inventory_warehouses.id"), nullable=False),
            sa.Column("status", sa.String(20), server_default=sa.text("'pending'"), nullable=False),
            sa.Column("ready_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("picked_up_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # ── Phase 2: Payment Gateway Config ─────────────────────────────────────

    if not _table_exists(conn, "pos_payment_gateway_configs"):
        op.create_table(
            "pos_payment_gateway_configs",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("terminal_id", UUID(as_uuid=True), sa.ForeignKey("pos_terminals.id"), nullable=True),
            sa.Column("gateway_type", sa.String(50), nullable=False),
            sa.Column("config", JSON(), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # ── Phase 3: KDS ─────────────────────────────────────────────────────────

    if not _table_exists(conn, "kds_stations"):
        op.create_table(
            "kds_stations",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("station_type", sa.String(50), server_default=sa.text("'kitchen'"), nullable=False),
            sa.Column("warehouse_id", UUID(as_uuid=True), sa.ForeignKey("inventory_warehouses.id"), nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if not _table_exists(conn, "kds_orders"):
        op.create_table(
            "kds_orders",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("transaction_id", UUID(as_uuid=True), sa.ForeignKey("pos_transactions.id"), nullable=False),
            sa.Column("station_id", UUID(as_uuid=True), sa.ForeignKey("kds_stations.id"), nullable=False),
            sa.Column("status", sa.String(20), server_default=sa.text("'new'"), nullable=False),
            sa.Column("priority", sa.Integer(), server_default=sa.text("0"), nullable=False),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if not _table_exists(conn, "kds_order_items"):
        op.create_table(
            "kds_order_items",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("kds_order_id", UUID(as_uuid=True), sa.ForeignKey("kds_orders.id", ondelete="CASCADE"), nullable=False),
            sa.Column("line_id", UUID(as_uuid=True), nullable=True),
            sa.Column("item_name", sa.String(200), nullable=False),
            sa.Column("quantity", sa.Integer(), nullable=False),
            sa.Column("modifiers", JSON(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("status", sa.String(20), server_default=sa.text("'pending'"), nullable=False),
        )

    # ── Phase 3: Commission Rules & Commissions ───────────────────────────────

    if not _table_exists(conn, "pos_commission_rules"):
        op.create_table(
            "pos_commission_rules",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("rule_type", sa.String(20), server_default=sa.text("'percentage'"), nullable=False),
            sa.Column("value", sa.Numeric(10, 4), nullable=True),
            sa.Column("tiers", JSON(), nullable=True),
            sa.Column("category", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if not _table_exists(conn, "pos_commissions"):
        op.create_table(
            "pos_commissions",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("cashier_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("pos_sessions.id"), nullable=True),
            sa.Column("transaction_id", UUID(as_uuid=True), sa.ForeignKey("pos_transactions.id"), nullable=True),
            sa.Column("rule_id", UUID(as_uuid=True), sa.ForeignKey("pos_commission_rules.id"), nullable=True),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("status", sa.String(20), server_default=sa.text("'calculated'"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # ── Phase 3: Tips Pool ────────────────────────────────────────────────────

    if not _table_exists(conn, "pos_tip_pools"):
        op.create_table(
            "pos_tip_pools",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("session_date", sa.Date(), nullable=False),
            sa.Column("warehouse_id", UUID(as_uuid=True), sa.ForeignKey("inventory_warehouses.id"), nullable=False),
            sa.Column("total_tips", sa.Numeric(12, 2), server_default=sa.text("0"), nullable=False),
            sa.Column("distribution_method", sa.String(50), server_default=sa.text("'equal'"), nullable=False),
            sa.Column("status", sa.String(20), server_default=sa.text("'pending'"), nullable=False),
            sa.Column("distributions", JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )


def downgrade() -> None:
    op.drop_table("pos_tip_pools")
    op.drop_table("pos_commissions")
    op.drop_table("pos_commission_rules")
    op.drop_table("kds_order_items")
    op.drop_table("kds_orders")
    op.drop_table("kds_stations")
    op.drop_table("pos_payment_gateway_configs")
    op.drop_table("pos_pickup_orders")
    op.drop_table("pos_store_credit_transactions")
    op.drop_table("pos_store_credits")
    op.drop_table("pos_gift_card_transactions")
    op.drop_table("pos_gift_cards")
    op.drop_table("loyalty_rewards")
    op.drop_table("loyalty_transactions")
    op.drop_table("loyalty_members")
    op.drop_table("loyalty_tiers")
    op.drop_table("loyalty_programs")
    op.drop_table("pos_product_modifier_links")
    op.drop_table("pos_modifiers")
    op.drop_table("pos_modifier_groups")
    op.drop_table("pos_bundle_items")
    op.drop_table("pos_bundles")
    op.drop_column("inventory_items", "rfid_tag")
    op.drop_column("pos_sessions", "terminal_id")
    op.drop_column("pos_transaction_lines", "modifiers")
    op.drop_column("pos_transaction_lines", "bundle_id")
    op.drop_column("pos_transaction_lines", "batch_id")
    op.drop_column("pos_transaction_lines", "variant_id")
    op.drop_column("pos_transactions", "held_at")
    op.drop_column("pos_transactions", "tip_amount")
    op.drop_column("pos_transactions", "customer_id")
