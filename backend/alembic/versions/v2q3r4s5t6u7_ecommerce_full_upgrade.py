"""E-Commerce Full Upgrade — B2B, Loyalty, Subscriptions, Blog, Currency, Bundles, Flash Sales, BOPIS, Import.

Revision ID: v2q3r4s5t6u7
Revises: u1p2q3r4s5t6
Create Date: 2026-03-12

Adds:
  - ecom_b2b_companies, ecom_b2b_company_members, ecom_b2b_pricing_tiers
  - ecom_b2b_quotes, ecom_b2b_quote_items
  - ecom_loyalty_programs, ecom_loyalty_tiers, ecom_loyalty_accounts
  - ecom_loyalty_transactions, ecom_referral_codes, ecom_referral_uses
  - ecom_subscriptions, ecom_subscription_orders
  - ecom_blog_posts
  - ecom_currencies
  - ecom_cart_abandonment_logs
  - ecom_product_bundles, ecom_bundle_items
  - ecom_flash_sales
  - ecom_pickup_locations
  - ecom_order_work_order_links
  - ecom_order_project_links
  - ecom_import_jobs
  - New columns on ecom_products: is_made_to_order, lead_time_days, weight, tags_json, category
  - New columns on ecom_orders: po_number, fulfillment_type, pickup_location_id, currency_code, exchange_rate_snapshot
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "v2q3r4s5t6u7"
down_revision = "u1p2q3r4s5t6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── ecom_b2b_companies ────────────────────────────────────────────────────
    op.create_table(
        "ecom_b2b_companies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("tax_id", sa.String(100), nullable=True),
        sa.Column("credit_limit", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("payment_terms", sa.String(20), nullable=False, server_default="COD"),
        sa.Column("is_approved", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("contact_email", sa.String(320), nullable=True),
        sa.Column("contact_phone", sa.String(50), nullable=True),
        sa.Column("address", sa.Text, nullable=True),
        sa.Column("metadata_json", postgresql.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_b2b_company_members ──────────────────────────────────────────────
    op.create_table(
        "ecom_b2b_company_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_b2b_companies.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_customers.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("role", sa.String(20), nullable=False, server_default="buyer"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_b2b_pricing_tiers ────────────────────────────────────────────────
    op.create_table(
        "ecom_b2b_pricing_tiers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("min_order_qty", sa.Integer, nullable=False, server_default="1"),
        sa.Column("discount_pct", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("fixed_price_override", sa.Numeric(14, 2), nullable=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_products.id", ondelete="CASCADE"), nullable=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_b2b_companies.id", ondelete="CASCADE"), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_b2b_quotes ───────────────────────────────────────────────────────
    op.create_table(
        "ecom_b2b_quotes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_b2b_companies.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("requested_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft", index=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("admin_notes", sa.Text, nullable=True),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("converted_order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("po_number", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_b2b_quote_items ──────────────────────────────────────────────────
    op.create_table(
        "ecom_b2b_quote_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("quote_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_b2b_quotes.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False, server_default="1"),
        sa.Column("requested_price", sa.Numeric(14, 2), nullable=True),
        sa.Column("approved_price", sa.Numeric(14, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_loyalty_programs ─────────────────────────────────────────────────
    op.create_table(
        "ecom_loyalty_programs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_stores.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("name", sa.String(200), nullable=False, server_default="Loyalty Rewards"),
        sa.Column("points_per_unit_spent", sa.Integer, nullable=False, server_default="1"),
        sa.Column("currency_per_point", sa.Numeric(8, 4), nullable=False, server_default="0.01"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("referral_bonus_points", sa.Integer, nullable=False, server_default="100"),
        sa.Column("referral_referee_points", sa.Integer, nullable=False, server_default="50"),
        sa.Column("points_expiry_days", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_loyalty_tiers ────────────────────────────────────────────────────
    op.create_table(
        "ecom_loyalty_tiers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_stores.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("min_lifetime_points", sa.Integer, nullable=False, server_default="0"),
        sa.Column("discount_pct", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("free_shipping", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("badge_color", sa.String(20), nullable=False, server_default="#51459d"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_loyalty_accounts ─────────────────────────────────────────────────
    op.create_table(
        "ecom_loyalty_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_customers.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("points_balance", sa.Integer, nullable=False, server_default="0"),
        sa.Column("lifetime_points", sa.Integer, nullable=False, server_default="0"),
        sa.Column("tier_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_loyalty_tiers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_loyalty_transactions ─────────────────────────────────────────────
    op.create_table(
        "ecom_loyalty_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_loyalty_accounts.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("transaction_type", sa.String(20), nullable=False),
        sa.Column("points", sa.Integer, nullable=False),
        sa.Column("reference_id", sa.String(100), nullable=True),
        sa.Column("note", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_referral_codes ───────────────────────────────────────────────────
    op.create_table(
        "ecom_referral_codes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_customers.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("code", sa.String(50), nullable=False, unique=True, index=True),
        sa.Column("used_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_points_earned", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_referral_uses ────────────────────────────────────────────────────
    op.create_table(
        "ecom_referral_uses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("referral_code_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_referral_codes.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("new_customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("rewarded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_subscriptions ────────────────────────────────────────────────────
    op.create_table(
        "ecom_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_customers.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False, server_default="1"),
        sa.Column("frequency_days", sa.Integer, nullable=False, server_default="30"),
        sa.Column("discount_pct", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active", index=True),
        sa.Column("next_billing_date", sa.Date, nullable=False),
        sa.Column("shipping_address_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_shipping_addresses.id", ondelete="SET NULL"), nullable=True),
        sa.Column("payment_gateway_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_payment_gateways.id", ondelete="SET NULL"), nullable=True),
        sa.Column("metadata_json", postgresql.JSON, nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_subscription_orders ──────────────────────────────────────────────
    op.create_table(
        "ecom_subscription_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("subscription_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_subscriptions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("billing_date", sa.Date, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_blog_posts ───────────────────────────────────────────────────────
    op.create_table(
        "ecom_blog_posts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_stores.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("slug", sa.String(500), nullable=False, unique=True, index=True),
        sa.Column("content_markdown", sa.Text, nullable=True),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft", index=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tags_json", postgresql.JSON, nullable=True),
        sa.Column("meta_title", sa.String(500), nullable=True),
        sa.Column("meta_description", sa.Text, nullable=True),
        sa.Column("feature_image", sa.String(500), nullable=True),
        sa.Column("view_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_currencies ───────────────────────────────────────────────────────
    op.create_table(
        "ecom_currencies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.String(10), nullable=False, unique=True, index=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("symbol", sa.String(10), nullable=False),
        sa.Column("exchange_rate_to_base", sa.Numeric(14, 6), nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("last_updated", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_cart_abandonment_logs ────────────────────────────────────────────
    op.create_table(
        "ecom_cart_abandonment_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("cart_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_carts.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_stores.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("customer_email", sa.String(320), nullable=False, index=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_customers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("items_snapshot", postgresql.JSON, nullable=True),
        sa.Column("abandoned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recovery_email_1_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recovery_email_2_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recovery_email_3_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recovered_order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("discount_code_used", sa.String(50), nullable=True),
        sa.Column("is_recovered", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_pickup_locations ─────────────────────────────────────────────────
    op.create_table(
        "ecom_pickup_locations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_stores.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("address", sa.String(500), nullable=False),
        sa.Column("city", sa.String(150), nullable=False),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("operating_hours_json", postgresql.JSON, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_product_bundles ──────────────────────────────────────────────────
    op.create_table(
        "ecom_product_bundles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_stores.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("slug", sa.String(300), nullable=False, unique=True, index=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("image", sa.String(500), nullable=True),
        sa.Column("discount_type", sa.String(20), nullable=False, server_default="pct"),
        sa.Column("discount_value", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_bundle_items ─────────────────────────────────────────────────────
    op.create_table(
        "ecom_bundle_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("bundle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_product_bundles.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_flash_sales ──────────────────────────────────────────────────────
    op.create_table(
        "ecom_flash_sales",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_stores.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_products.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("sale_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("inventory_limit", sa.Integer, nullable=True),
        sa.Column("sold_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("countdown_visible", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_order_work_order_links ───────────────────────────────────────────
    op.create_table(
        "ecom_order_work_order_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_orders.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("order_line_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_order_lines.id", ondelete="SET NULL"), nullable=True),
        sa.Column("work_order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("work_order_number", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_order_project_links ──────────────────────────────────────────────
    op.create_table(
        "ecom_order_project_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_orders.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_name", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── ecom_import_jobs ──────────────────────────────────────────────────────
    op.create_table(
        "ecom_import_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_stores.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("source_platform", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending", index=True),
        sa.Column("file_path", sa.String(500), nullable=True),
        sa.Column("mappings_json", postgresql.JSON, nullable=True),
        sa.Column("progress_pct", sa.Integer, nullable=False, server_default="0"),
        sa.Column("error_log", sa.Text, nullable=True),
        sa.Column("imported_products", sa.Integer, nullable=False, server_default="0"),
        sa.Column("imported_customers", sa.Integer, nullable=False, server_default="0"),
        sa.Column("imported_orders", sa.Integer, nullable=False, server_default="0"),
        sa.Column("started_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── New columns on ecom_products ──────────────────────────────────────────
    op.add_column("ecom_products", sa.Column("is_made_to_order", sa.Boolean, nullable=False, server_default="false"))
    op.add_column("ecom_products", sa.Column("lead_time_days", sa.Integer, nullable=False, server_default="0"))
    op.add_column("ecom_products", sa.Column("weight", sa.Numeric(10, 3), nullable=True))
    op.add_column("ecom_products", sa.Column("tags_json", postgresql.JSON, nullable=True))
    op.add_column("ecom_products", sa.Column("category", sa.String(200), nullable=True))

    # ── New columns on ecom_orders ────────────────────────────────────────────
    op.add_column("ecom_orders", sa.Column("po_number", sa.String(100), nullable=True))
    op.add_column("ecom_orders", sa.Column("fulfillment_type", sa.String(20), nullable=False, server_default="shipping"))
    op.add_column("ecom_orders", sa.Column("pickup_location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ecom_pickup_locations.id", ondelete="SET NULL"), nullable=True))
    op.add_column("ecom_orders", sa.Column("currency_code", sa.String(10), nullable=False, server_default="KES"))
    op.add_column("ecom_orders", sa.Column("exchange_rate_snapshot", sa.Numeric(14, 6), nullable=False, server_default="1"))

    # ── Seed common currencies ────────────────────────────────────────────────
    op.execute("""
        INSERT INTO ecom_currencies (id, code, name, symbol, exchange_rate_to_base, is_active)
        VALUES
          (gen_random_uuid(), 'KES', 'Kenyan Shilling', 'KSh', 1.0, true),
          (gen_random_uuid(), 'USD', 'US Dollar', '$', 0.0077, true),
          (gen_random_uuid(), 'EUR', 'Euro', '€', 0.0071, true),
          (gen_random_uuid(), 'GBP', 'British Pound', '£', 0.0061, true),
          (gen_random_uuid(), 'UGX', 'Ugandan Shilling', 'USh', 28.5, true),
          (gen_random_uuid(), 'TZS', 'Tanzanian Shilling', 'TSh', 20.0, true)
        ON CONFLICT (code) DO NOTHING
    """)


def downgrade() -> None:
    # Remove new columns
    op.drop_column("ecom_orders", "exchange_rate_snapshot")
    op.drop_column("ecom_orders", "currency_code")
    op.drop_column("ecom_orders", "pickup_location_id")
    op.drop_column("ecom_orders", "fulfillment_type")
    op.drop_column("ecom_orders", "po_number")
    op.drop_column("ecom_products", "category")
    op.drop_column("ecom_products", "tags_json")
    op.drop_column("ecom_products", "weight")
    op.drop_column("ecom_products", "lead_time_days")
    op.drop_column("ecom_products", "is_made_to_order")

    # Drop tables in reverse order
    op.drop_table("ecom_import_jobs")
    op.drop_table("ecom_order_project_links")
    op.drop_table("ecom_order_work_order_links")
    op.drop_table("ecom_flash_sales")
    op.drop_table("ecom_bundle_items")
    op.drop_table("ecom_product_bundles")
    op.drop_table("ecom_pickup_locations")
    op.drop_table("ecom_cart_abandonment_logs")
    op.drop_table("ecom_currencies")
    op.drop_table("ecom_blog_posts")
    op.drop_table("ecom_subscription_orders")
    op.drop_table("ecom_subscriptions")
    op.drop_table("ecom_referral_uses")
    op.drop_table("ecom_referral_codes")
    op.drop_table("ecom_loyalty_transactions")
    op.drop_table("ecom_loyalty_accounts")
    op.drop_table("ecom_loyalty_tiers")
    op.drop_table("ecom_loyalty_programs")
    op.drop_table("ecom_b2b_quote_items")
    op.drop_table("ecom_b2b_quotes")
    op.drop_table("ecom_b2b_pricing_tiers")
    op.drop_table("ecom_b2b_company_members")
    op.drop_table("ecom_b2b_companies")
