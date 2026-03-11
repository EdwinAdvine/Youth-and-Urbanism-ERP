"""Supply Chain Planning & Ops — 21 new tables for demand, S&OP, control tower, RFx, replenishment, workflows, compliance, ESG.

Revision ID: r8l9m0n1o2p3
Revises: q7k8l9m0n1o2
Create Date: 2026-03-11 14:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "r8l9m0n1o2p3"
down_revision = "q7k8l9m0n1o2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ───────────────────────────────────────────────────────────────────────────
    # PLANNING TABLES (7)
    # ───────────────────────────────────────────────────────────────────────────

    # 1. sc_forecast_scenarios
    op.create_table(
        "sc_forecast_scenarios",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("assumptions", postgresql.JSON(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sc_forecast_scenarios_status", "sc_forecast_scenarios", ["status"])
    op.create_index("ix_sc_forecast_scenarios_created_by", "sc_forecast_scenarios", ["created_by"])

    # 2. sc_demand_forecasts
    op.create_table(
        "sc_demand_forecasts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("warehouse_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("forecast_date", sa.Date(), nullable=False),
        sa.Column("period_type", sa.String(20), nullable=False, server_default="monthly"),
        sa.Column("predicted_quantity", sa.Integer(), nullable=False),
        sa.Column("confidence_lower", sa.Integer(), nullable=True),
        sa.Column("confidence_upper", sa.Integer(), nullable=True),
        sa.Column("method", sa.String(30), nullable=False, server_default="moving_avg"),
        sa.Column("scenario_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("source_data", postgresql.JSON(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], ["inventory_items.id"]),
        sa.ForeignKeyConstraint(["warehouse_id"], ["inventory_warehouses.id"]),
        sa.ForeignKeyConstraint(["scenario_id"], ["sc_forecast_scenarios.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sc_demand_forecasts_item_id", "sc_demand_forecasts", ["item_id"])
    op.create_index("ix_sc_demand_forecasts_forecast_date", "sc_demand_forecasts", ["forecast_date"])
    op.create_index("ix_sc_demand_forecasts_scenario_id", "sc_demand_forecasts", ["scenario_id"])

    # 3. sc_demand_signals
    op.create_table(
        "sc_demand_signals",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("signal_type", sa.String(30), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("source_module", sa.String(30), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("impact_quantity", sa.Integer(), nullable=False),
        sa.Column("impact_start_date", sa.Date(), nullable=False),
        sa.Column("impact_end_date", sa.Date(), nullable=False),
        sa.Column("confidence", sa.Numeric(3, 2), nullable=False, server_default="0.5"),
        sa.Column("metadata_json", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], ["inventory_items.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sc_demand_signals_item_id", "sc_demand_signals", ["item_id"])
    op.create_index("ix_sc_demand_signals_signal_type", "sc_demand_signals", ["signal_type"])

    # 4. sc_sop_plans
    op.create_table(
        "sc_sop_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("cycle_type", sa.String(20), nullable=False, server_default="monthly"),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("demand_summary", postgresql.JSON(), nullable=True),
        sa.Column("supply_summary", postgresql.JSON(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sc_sop_plans_status", "sc_sop_plans", ["status"])
    op.create_index("ix_sc_sop_plans_period_start", "sc_sop_plans", ["period_start"])

    # 5. sc_supply_plans
    op.create_table(
        "sc_supply_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("sop_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("forecast_scenario_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("plan_horizon_days", sa.Integer(), nullable=False, server_default="90"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["sop_id"], ["sc_sop_plans.id"]),
        sa.ForeignKeyConstraint(["forecast_scenario_id"], ["sc_forecast_scenarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sc_supply_plans_sop_id", "sc_supply_plans", ["sop_id"])
    op.create_index("ix_sc_supply_plans_status", "sc_supply_plans", ["status"])

    # 6. sc_supply_plan_lines
    op.create_table(
        "sc_supply_plan_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("planned_order_date", sa.Date(), nullable=False),
        sa.Column("planned_delivery_date", sa.Date(), nullable=False),
        sa.Column("planned_quantity", sa.Integer(), nullable=False),
        sa.Column("estimated_cost", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="planned"),
        sa.ForeignKeyConstraint(["plan_id"], ["sc_supply_plans.id"]),
        sa.ForeignKeyConstraint(["item_id"], ["inventory_items.id"]),
        sa.ForeignKeyConstraint(["supplier_id"], ["sc_suppliers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sc_supply_plan_lines_plan_id", "sc_supply_plan_lines", ["plan_id"])
    op.create_index("ix_sc_supply_plan_lines_item_id", "sc_supply_plan_lines", ["item_id"])

    # 7. sc_capacity_plans
    op.create_table(
        "sc_capacity_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("sop_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resource_type", sa.String(30), nullable=False),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("available_capacity", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("required_capacity", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("utilization_pct", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("constraints", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["sop_id"], ["sc_sop_plans.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sc_capacity_plans_sop_id", "sc_capacity_plans", ["sop_id"])

    # ───────────────────────────────────────────────────────────────────────────
    # OPS TABLES (14)
    # ───────────────────────────────────────────────────────────────────────────

    # 8. sc_control_tower_alerts
    op.create_table(
        "sc_control_tower_alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("alert_type", sa.String(30), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("source_module", sa.String(30), nullable=True),
        sa.Column("source_entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("assigned_to", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["assigned_to"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sc_control_tower_alerts_status", "sc_control_tower_alerts", ["status"])
    op.create_index("ix_sc_control_tower_alerts_severity", "sc_control_tower_alerts", ["severity"])
    op.create_index("ix_sc_control_tower_alerts_alert_type", "sc_control_tower_alerts", ["alert_type"])

    # 9. sc_kpis
    op.create_table(
        "sc_kpis",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("kpi_name", sa.String(100), nullable=False),
        sa.Column("period", sa.String(20), nullable=False),
        sa.Column("value", sa.Numeric(14, 4), nullable=False),
        sa.Column("target", sa.Numeric(14, 4), nullable=True),
        sa.Column("unit", sa.String(20), nullable=False, server_default="ratio"),
        sa.Column("dimension", sa.String(100), nullable=True),
        sa.Column("dimension_value", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sc_kpis_kpi_name", "sc_kpis", ["kpi_name"])
    op.create_index("ix_sc_kpis_period", "sc_kpis", ["period"])

    # 10. sc_events
    op.create_table(
        "sc_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("severity", sa.String(20), nullable=False, server_default="info"),
        sa.Column("metadata_json", postgresql.JSON(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sc_events_event_type", "sc_events", ["event_type"])
    op.create_index("ix_sc_events_occurred_at", "sc_events", ["occurred_at"])

    # 11. sc_rfx
    op.create_table(
        "sc_rfx",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("rfx_number", sa.String(30), nullable=False, unique=True),
        sa.Column("rfx_type", sa.String(20), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("items", postgresql.JSON(), nullable=True),
        sa.Column("invited_suppliers", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sc_rfx_status", "sc_rfx", ["status"])
    op.create_index("ix_sc_rfx_rfx_type", "sc_rfx", ["rfx_type"])

    # 12. sc_rfx_responses
    op.create_table(
        "sc_rfx_responses",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("rfx_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="submitted"),
        sa.Column("quoted_items", postgresql.JSON(), nullable=True),
        sa.Column("total_value", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("lead_time_days", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("score", sa.Numeric(5, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["rfx_id"], ["sc_rfx.id"]),
        sa.ForeignKeyConstraint(["supplier_id"], ["sc_suppliers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sc_rfx_responses_rfx_id", "sc_rfx_responses", ["rfx_id"])
    op.create_index("ix_sc_rfx_responses_supplier_id", "sc_rfx_responses", ["supplier_id"])

    # 13. sc_supplier_risks
    op.create_table(
        "sc_supplier_risks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("risk_type", sa.String(30), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("source", sa.String(100), nullable=True),
        sa.Column("mitigation_notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("detected_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["supplier_id"], ["sc_suppliers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sc_supplier_risks_supplier_id", "sc_supplier_risks", ["supplier_id"])
    op.create_index("ix_sc_supplier_risks_severity", "sc_supplier_risks", ["severity"])

    # 14. sc_replenishment_rules
    op.create_table(
        "sc_replenishment_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("warehouse_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rule_type", sa.String(20), nullable=False, server_default="reorder_point"),
        sa.Column("min_level", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_level", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reorder_point", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reorder_quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lead_time_days", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("auto_generate_po", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("last_triggered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], ["inventory_items.id"]),
        sa.ForeignKeyConstraint(["warehouse_id"], ["inventory_warehouses.id"]),
        sa.ForeignKeyConstraint(["supplier_id"], ["sc_suppliers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sc_replenishment_rules_item_id", "sc_replenishment_rules", ["item_id"])
    op.create_index("ix_sc_replenishment_rules_warehouse_id", "sc_replenishment_rules", ["warehouse_id"])

    # 15. sc_safety_stock_configs
    op.create_table(
        "sc_safety_stock_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("warehouse_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("method", sa.String(30), nullable=False, server_default="static"),
        sa.Column("safety_stock_qty", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("service_level_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("demand_std_dev", sa.Numeric(12, 2), nullable=True),
        sa.Column("lead_time_std_dev", sa.Numeric(8, 2), nullable=True),
        sa.Column("recalculated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], ["inventory_items.id"]),
        sa.ForeignKeyConstraint(["warehouse_id"], ["inventory_warehouses.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sc_safety_stock_configs_item_id", "sc_safety_stock_configs", ["item_id"])

    # 16. sc_stock_health_scores
    op.create_table(
        "sc_stock_health_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("warehouse_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("health_status", sa.String(20), nullable=False, server_default="healthy"),
        sa.Column("days_of_stock", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("turnover_rate", sa.Numeric(8, 2), nullable=False, server_default="0"),
        sa.Column("last_movement_date", sa.Date(), nullable=True),
        sa.Column("recommended_action", sa.String(50), nullable=False, server_default="none"),
        sa.Column("calculated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], ["inventory_items.id"]),
        sa.ForeignKeyConstraint(["warehouse_id"], ["inventory_warehouses.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sc_stock_health_scores_item_id", "sc_stock_health_scores", ["item_id"])
    op.create_index("ix_sc_stock_health_scores_health_status", "sc_stock_health_scores", ["health_status"])

    # 17. sc_workflow_templates
    op.create_table(
        "sc_workflow_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("trigger_event", sa.String(100), nullable=False),
        sa.Column("steps", postgresql.JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sc_workflow_templates_trigger_event", "sc_workflow_templates", ["trigger_event"])

    # 18. sc_workflow_runs
    op.create_table(
        "sc_workflow_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("trigger_data", postgresql.JSON(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="running"),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["template_id"], ["sc_workflow_templates.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sc_workflow_runs_template_id", "sc_workflow_runs", ["template_id"])
    op.create_index("ix_sc_workflow_runs_status", "sc_workflow_runs", ["status"])

    # 19. sc_workflow_steps
    op.create_table(
        "sc_workflow_steps",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("step_index", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("params", postgresql.JSON(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("result", postgresql.JSON(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["run_id"], ["sc_workflow_runs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sc_workflow_steps_run_id", "sc_workflow_steps", ["run_id"])

    # 20. sc_compliance_records
    op.create_table(
        "sc_compliance_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("compliance_type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending_review"),
        sa.Column("details", postgresql.JSON(), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sc_compliance_records_entity_type", "sc_compliance_records", ["entity_type"])
    op.create_index("ix_sc_compliance_records_status", "sc_compliance_records", ["status"])

    # 21. sc_esg_metrics
    op.create_table(
        "sc_esg_metrics",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metric_type", sa.String(30), nullable=False),
        sa.Column("period", sa.String(20), nullable=False),
        sa.Column("value", sa.Numeric(14, 4), nullable=False),
        sa.Column("unit", sa.String(30), nullable=False),
        sa.Column("benchmark", sa.Numeric(14, 4), nullable=True),
        sa.Column("source", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["supplier_id"], ["sc_suppliers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sc_esg_metrics_supplier_id", "sc_esg_metrics", ["supplier_id"])
    op.create_index("ix_sc_esg_metrics_metric_type", "sc_esg_metrics", ["metric_type"])
    op.create_index("ix_sc_esg_metrics_period", "sc_esg_metrics", ["period"])


def downgrade() -> None:
    # Drop in reverse order to respect FK constraints
    op.drop_table("sc_esg_metrics")
    op.drop_table("sc_compliance_records")
    op.drop_table("sc_workflow_steps")
    op.drop_table("sc_workflow_runs")
    op.drop_table("sc_workflow_templates")
    op.drop_table("sc_stock_health_scores")
    op.drop_table("sc_safety_stock_configs")
    op.drop_table("sc_replenishment_rules")
    op.drop_table("sc_supplier_risks")
    op.drop_table("sc_rfx_responses")
    op.drop_table("sc_rfx")
    op.drop_table("sc_events")
    op.drop_table("sc_kpis")
    op.drop_table("sc_control_tower_alerts")
    op.drop_table("sc_capacity_plans")
    op.drop_table("sc_supply_plan_lines")
    op.drop_table("sc_supply_plans")
    op.drop_table("sc_sop_plans")
    op.drop_table("sc_demand_signals")
    op.drop_table("sc_demand_forecasts")
    op.drop_table("sc_forecast_scenarios")
