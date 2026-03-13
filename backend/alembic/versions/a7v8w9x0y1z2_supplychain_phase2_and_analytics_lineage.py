"""Supply Chain Phase 2 (Logistics + Risk/MRP) and Analytics DataLineage tables.

Revision ID: a7v8w9x0y1z2
Revises: z6u7v8w9x0y1
Create Date: 2026-03-13

Adds:
  Supply Chain Logistics (6 tables):
    sc_carriers, sc_routes, sc_transport_orders, sc_freight_costs,
    sc_dock_schedules, sc_yard_slots

  Supply Chain Risk/MRP (6 tables):
    sc_risk_assessments, sc_risk_scenarios, sc_mitigation_plans,
    sc_mrp_runs, sc_mrp_lines, sc_production_schedules

  Analytics:
    analytics_data_lineage
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSON, UUID

revision = "sc7v8w9x0y1z2"
down_revision = "z6u7v8w9x0y1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── sc_carriers ─────────────────────────────────────────────────────────────
    op.create_table(
        "sc_carriers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("code", sa.String(50), unique=True, nullable=True),
        sa.Column("carrier_type", sa.String(50), nullable=False, server_default="road"),
        sa.Column("scac_code", sa.String(10), nullable=True),
        sa.Column("contact_email", sa.String(255), nullable=True),
        sa.Column("contact_phone", sa.String(50), nullable=True),
        sa.Column("api_endpoint", sa.String(500), nullable=True),
        sa.Column("api_key_encrypted", sa.Text, nullable=True),
        sa.Column("tracking_url_template", sa.String(500), nullable=True),
        sa.Column("service_levels", JSON, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("rating", sa.Float, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── sc_routes ────────────────────────────────────────────────────────────────
    op.create_table(
        "sc_routes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("carrier_id", UUID(as_uuid=True), sa.ForeignKey("sc_carriers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("origin_location", sa.String(255), nullable=False),
        sa.Column("destination_location", sa.String(255), nullable=False),
        sa.Column("origin_country", sa.String(3), nullable=True),
        sa.Column("destination_country", sa.String(3), nullable=True),
        sa.Column("transit_days", sa.Integer, nullable=True),
        sa.Column("transport_mode", sa.String(50), nullable=False, server_default="road"),
        sa.Column("distance_km", sa.Float, nullable=True),
        sa.Column("base_cost", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("waypoints", JSON, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── sc_transport_orders ──────────────────────────────────────────────────────
    op.create_table(
        "sc_transport_orders",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("reference", sa.String(100), unique=True, nullable=False),
        sa.Column("carrier_id", UUID(as_uuid=True), sa.ForeignKey("sc_carriers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("route_id", UUID(as_uuid=True), sa.ForeignKey("sc_routes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("purchase_order_id", UUID(as_uuid=True), nullable=True),
        sa.Column("sales_order_id", UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft"),
        sa.Column("service_level", sa.String(50), nullable=True),
        sa.Column("tracking_number", sa.String(100), nullable=True),
        sa.Column("shipper_address", JSON, nullable=True),
        sa.Column("consignee_address", JSON, nullable=True),
        sa.Column("weight_kg", sa.Float, nullable=True),
        sa.Column("volume_m3", sa.Float, nullable=True),
        sa.Column("package_count", sa.Integer, nullable=True),
        sa.Column("items", JSON, nullable=True),
        sa.Column("pickup_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("estimated_delivery", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_delivery", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tracking_events", JSON, nullable=True),
        sa.Column("special_instructions", sa.Text, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── sc_freight_costs ─────────────────────────────────────────────────────────
    op.create_table(
        "sc_freight_costs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("transport_order_id", UUID(as_uuid=True), sa.ForeignKey("sc_transport_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cost_type", sa.String(50), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("invoiced", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("invoice_reference", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── sc_dock_schedules ────────────────────────────────────────────────────────
    op.create_table(
        "sc_dock_schedules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("transport_order_id", UUID(as_uuid=True), sa.ForeignKey("sc_transport_orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("dock_door", sa.String(50), nullable=False),
        sa.Column("direction", sa.String(20), nullable=False, server_default="inbound"),
        sa.Column("scheduled_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("scheduled_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actual_arrival", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_departure", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="scheduled"),
        sa.Column("carrier_name", sa.String(255), nullable=True),
        sa.Column("driver_name", sa.String(255), nullable=True),
        sa.Column("trailer_number", sa.String(50), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── sc_yard_slots ────────────────────────────────────────────────────────────
    op.create_table(
        "sc_yard_slots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("slot_code", sa.String(50), unique=True, nullable=False),
        sa.Column("zone", sa.String(50), nullable=True),
        sa.Column("slot_type", sa.String(50), nullable=False, server_default="trailer"),
        sa.Column("capacity_tons", sa.Float, nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="available"),
        sa.Column("occupied_by_transport_id", UUID(as_uuid=True), sa.ForeignKey("sc_transport_orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("occupied_since", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reserved_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── sc_risk_assessments ───────────────────────────────────────────────────────
    op.create_table(
        "sc_risk_assessments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("risk_category", sa.String(50), nullable=False),
        sa.Column("risk_level", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("probability", sa.Float, nullable=True),
        sa.Column("impact_score", sa.Float, nullable=True),
        sa.Column("risk_score", sa.Float, nullable=True),
        sa.Column("affected_supplier_id", UUID(as_uuid=True), nullable=True),
        sa.Column("affected_product_ids", JSON, nullable=True),
        sa.Column("affected_routes", JSON, nullable=True),
        sa.Column("identified_date", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("expected_impact_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expected_impact_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="open"),
        sa.Column("owner_id", UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── sc_risk_scenarios ─────────────────────────────────────────────────────────
    op.create_table(
        "sc_risk_scenarios",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("risk_id", UUID(as_uuid=True), sa.ForeignKey("sc_risk_assessments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("scenario_type", sa.String(30), nullable=False, server_default="pessimistic"),
        sa.Column("assumptions", JSON, nullable=True),
        sa.Column("projected_cost_impact", sa.Numeric(15, 2), nullable=True),
        sa.Column("projected_revenue_impact", sa.Numeric(15, 2), nullable=True),
        sa.Column("projected_delay_days", sa.Integer, nullable=True),
        sa.Column("simulation_results", JSON, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── sc_mitigation_plans ───────────────────────────────────────────────────────
    op.create_table(
        "sc_mitigation_plans",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("risk_id", UUID(as_uuid=True), sa.ForeignKey("sc_risk_assessments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("strategy", sa.String(30), nullable=False, server_default="mitigate"),
        sa.Column("actions", JSON, nullable=True),
        sa.Column("estimated_cost", sa.Numeric(15, 2), nullable=True),
        sa.Column("effectiveness_score", sa.Float, nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="planned"),
        sa.Column("assigned_to", UUID(as_uuid=True), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── sc_mrp_runs ───────────────────────────────────────────────────────────────
    op.create_table(
        "sc_mrp_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("run_type", sa.String(30), nullable=False, server_default="regenerative"),
        sa.Column("planning_horizon_days", sa.Integer, nullable=False, server_default="90"),
        sa.Column("bucket_size", sa.String(10), nullable=False, server_default="week"),
        sa.Column("product_ids", JSON, nullable=True),
        sa.Column("warehouse_ids", JSON, nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("total_demand_lines", sa.Integer, nullable=False, server_default="0"),
        sa.Column("planned_orders_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("exceptions_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── sc_mrp_lines ─────────────────────────────────────────────────────────────
    op.create_table(
        "sc_mrp_lines",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("mrp_run_id", UUID(as_uuid=True), sa.ForeignKey("sc_mrp_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), nullable=True),
        sa.Column("product_sku", sa.String(100), nullable=True),
        sa.Column("product_name", sa.String(255), nullable=True),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("gross_demand", sa.Numeric(15, 4), nullable=False, server_default="0"),
        sa.Column("scheduled_receipts", sa.Numeric(15, 4), nullable=False, server_default="0"),
        sa.Column("projected_inventory", sa.Numeric(15, 4), nullable=False, server_default="0"),
        sa.Column("net_demand", sa.Numeric(15, 4), nullable=False, server_default="0"),
        sa.Column("planned_order_qty", sa.Numeric(15, 4), nullable=False, server_default="0"),
        sa.Column("demand_source_type", sa.String(50), nullable=True),
        sa.Column("demand_source_id", UUID(as_uuid=True), nullable=True),
        sa.Column("action_type", sa.String(30), nullable=True),
        sa.Column("action_details", JSON, nullable=True),
        sa.Column("exception_message", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_sc_mrp_lines_run_id", "sc_mrp_lines", ["mrp_run_id"])

    # ── sc_production_schedules ───────────────────────────────────────────────────
    op.create_table(
        "sc_production_schedules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("mrp_run_id", UUID(as_uuid=True), sa.ForeignKey("sc_mrp_runs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("product_id", UUID(as_uuid=True), nullable=True),
        sa.Column("product_sku", sa.String(100), nullable=True),
        sa.Column("product_name", sa.String(255), nullable=True),
        sa.Column("planned_qty", sa.Numeric(15, 4), nullable=False),
        sa.Column("confirmed_qty", sa.Numeric(15, 4), nullable=True),
        sa.Column("completed_qty", sa.Numeric(15, 4), nullable=True),
        sa.Column("work_center", sa.String(100), nullable=True),
        sa.Column("planned_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("planned_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actual_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="planned"),
        sa.Column("priority", sa.Integer, nullable=False, server_default="5"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── analytics_data_lineage ────────────────────────────────────────────────────
    op.create_table(
        "analytics_data_lineage",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("widget_id", UUID(as_uuid=True), sa.ForeignKey("analytics_dashboard_widgets.id", ondelete="CASCADE"), nullable=True),
        sa.Column("transform_id", UUID(as_uuid=True), sa.ForeignKey("analytics_transform_pipelines.id", ondelete="CASCADE"), nullable=True),
        sa.Column("source_type", sa.String(50), nullable=False),
        sa.Column("source_name", sa.String(255), nullable=False),
        sa.Column("source_columns", JSON, nullable=True),
        sa.Column("source_transform_id", UUID(as_uuid=True), sa.ForeignKey("analytics_transform_pipelines.id", ondelete="SET NULL"), nullable=True),
        sa.Column("transformation_notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_analytics_lineage_widget_id", "analytics_data_lineage", ["widget_id"])


def downgrade() -> None:
    op.drop_table("analytics_data_lineage")
    op.drop_table("sc_production_schedules")
    op.drop_index("ix_sc_mrp_lines_run_id", "sc_mrp_lines")
    op.drop_table("sc_mrp_lines")
    op.drop_table("sc_mrp_runs")
    op.drop_table("sc_mitigation_plans")
    op.drop_table("sc_risk_scenarios")
    op.drop_table("sc_risk_assessments")
    op.drop_table("sc_yard_slots")
    op.drop_table("sc_dock_schedules")
    op.drop_table("sc_freight_costs")
    op.drop_table("sc_transport_orders")
    op.drop_table("sc_routes")
    op.drop_table("sc_carriers")
