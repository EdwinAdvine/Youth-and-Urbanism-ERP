"""HR Phase 3 upgrade — AI Intelligence, Workflows, People Analytics.

Revision ID: u1p2q3r4s5t6
Revises: q7k8l9m0n1o2
Create Date: 2026-03-11
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "u1p2q3r4s5t6"
down_revision = "q7k8l9m0n1o2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ─────────── 1. Skill Ontology (self-referential — create table first, FK added after) ───────────
    op.create_table(
        "hr_skill_ontology",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("aliases", postgresql.JSON, nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # Self-referential FK added separately so the table exists first
    op.create_foreign_key(
        "fk_hr_skill_ontology_parent_id",
        "hr_skill_ontology",
        "hr_skill_ontology",
        ["parent_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_hr_skill_ontology_category", "hr_skill_ontology", ["category"])
    op.create_index("ix_hr_skill_ontology_parent_id", "hr_skill_ontology", ["parent_id"])

    # ─────────── 2. Flight Risk Scores ───────────
    op.create_table(
        "hr_flight_risk_scores",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("score", sa.Numeric(5, 2), nullable=False),
        sa.Column("risk_level", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("factors", postgresql.JSON, nullable=True),
        sa.Column("recommendations", postgresql.JSON, nullable=True),
        sa.Column("model_version", sa.String(50), nullable=True),
        sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["employee_id"], ["hr_employees.id"], ondelete="CASCADE"
        ),
    )
    op.create_index(
        "ix_hr_flight_risk_scores_employee_id", "hr_flight_risk_scores", ["employee_id"]
    )
    op.create_index(
        "ix_hr_flight_risk_scores_risk_level", "hr_flight_risk_scores", ["risk_level"]
    )
    op.create_index(
        "ix_hr_flight_risk_scores_calculated_at",
        "hr_flight_risk_scores",
        ["calculated_at"],
    )

    # ─────────── 3. Burnout Indicators ───────────
    op.create_table(
        "hr_burnout_indicators",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("risk_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("risk_level", sa.String(20), nullable=False, server_default="low"),
        sa.Column("overtime_hours_30d", sa.Numeric(6, 2), nullable=True),
        sa.Column("leave_days_taken_90d", sa.Integer, nullable=True),
        sa.Column("consecutive_work_days", sa.Integer, nullable=True),
        sa.Column("sentiment_trend", sa.String(20), nullable=True),
        sa.Column("factors", postgresql.JSON, nullable=True),
        sa.Column("recommendations", postgresql.JSON, nullable=True),
        sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["employee_id"], ["hr_employees.id"], ondelete="CASCADE"
        ),
    )
    op.create_index(
        "ix_hr_burnout_indicators_employee_id", "hr_burnout_indicators", ["employee_id"]
    )
    op.create_index(
        "ix_hr_burnout_indicators_risk_level", "hr_burnout_indicators", ["risk_level"]
    )
    op.create_index(
        "ix_hr_burnout_indicators_calculated_at",
        "hr_burnout_indicators",
        ["calculated_at"],
    )

    # ─────────── 4. Workflows ───────────
    op.create_table(
        "hr_workflows",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("trigger_type", sa.String(50), nullable=False),
        sa.Column("trigger_config", postgresql.JSON, nullable=True),
        sa.Column("steps", postgresql.JSON, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("is_template", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("run_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_hr_workflows_trigger_type", "hr_workflows", ["trigger_type"])
    op.create_index("ix_hr_workflows_is_active", "hr_workflows", ["is_active"])
    op.create_index("ix_hr_workflows_category", "hr_workflows", ["category"])

    # ─────────── 5. Workflow Executions ───────────
    op.create_table(
        "hr_workflow_executions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("workflow_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("triggered_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("trigger_data", postgresql.JSON, nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="running"),
        sa.Column("current_step_id", sa.String(100), nullable=True),
        sa.Column("steps_completed", postgresql.JSON, nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["workflow_id"], ["hr_workflows.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["triggered_by"], ["users.id"], ondelete="SET NULL"
        ),
    )
    op.create_index(
        "ix_hr_workflow_executions_workflow_id",
        "hr_workflow_executions",
        ["workflow_id"],
    )
    op.create_index(
        "ix_hr_workflow_executions_status", "hr_workflow_executions", ["status"]
    )
    op.create_index(
        "ix_hr_workflow_executions_started_at",
        "hr_workflow_executions",
        ["started_at"],
    )

    # ─────────── 6. Workflow Approvals ───────────
    op.create_table(
        "hr_workflow_approvals",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("execution_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("step_id", sa.String(100), nullable=False),
        sa.Column("approver_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("decision_note", sa.Text, nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["execution_id"], ["hr_workflow_executions.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["approver_id"], ["users.id"], ondelete="SET NULL"
        ),
    )
    op.create_index(
        "ix_hr_workflow_approvals_execution_id",
        "hr_workflow_approvals",
        ["execution_id"],
    )
    op.create_index(
        "ix_hr_workflow_approvals_status", "hr_workflow_approvals", ["status"]
    )
    op.create_index(
        "ix_hr_workflow_approvals_approver_id",
        "hr_workflow_approvals",
        ["approver_id"],
    )

    # ─────────── 7. Analytics Dashboards ───────────
    op.create_table(
        "hr_analytics_dashboards",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_shared", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("layout", postgresql.JSON, nullable=True),
        sa.Column("widget_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_hr_analytics_dashboards_owner_id", "hr_analytics_dashboards", ["owner_id"]
    )
    op.create_index(
        "ix_hr_analytics_dashboards_is_shared",
        "hr_analytics_dashboards",
        ["is_shared"],
    )

    # ─────────── 8. Workforce Planning Scenarios ───────────
    op.create_table(
        "hr_workforce_scenarios",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("fiscal_year", sa.Integer, nullable=False),
        sa.Column("base_headcount", sa.Integer, nullable=False),
        sa.Column("base_budget", sa.Numeric(16, 2), nullable=True),
        sa.Column("scenarios", postgresql.JSON, nullable=True),
        sa.Column("assumptions", postgresql.JSON, nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_approved", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index(
        "ix_hr_workforce_scenarios_fiscal_year",
        "hr_workforce_scenarios",
        ["fiscal_year"],
    )
    op.create_index(
        "ix_hr_workforce_scenarios_created_by",
        "hr_workforce_scenarios",
        ["created_by"],
    )
    op.create_index(
        "ix_hr_workforce_scenarios_is_approved",
        "hr_workforce_scenarios",
        ["is_approved"],
    )


def downgrade() -> None:
    # Drop in reverse FK-safe order
    op.drop_table("hr_workforce_scenarios")
    op.drop_table("hr_analytics_dashboards")
    op.drop_table("hr_workflow_approvals")
    op.drop_table("hr_workflow_executions")
    op.drop_table("hr_workflows")
    op.drop_table("hr_burnout_indicators")
    op.drop_table("hr_flight_risk_scores")
    # Drop self-referential FK before dropping the table
    op.drop_constraint(
        "fk_hr_skill_ontology_parent_id", "hr_skill_ontology", type_="foreignkey"
    )
    op.drop_table("hr_skill_ontology")
