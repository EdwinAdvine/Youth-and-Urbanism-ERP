"""Finance Phase 2A: Estimates, CustomFields, Dimensions, RevenueRecognition,
WorkflowRules, WorkflowExecutions, DunningLogs, TaxJurisdictions,
ComplianceEvents, FXRevaluations, BankCategorizationRules.
Also adds custom_fields/dimension_ids/auto_je_posted to invoices,
custom_fields/dimension_ids/mileage to expenses, custom_fields/dimension_ids to vendor bills.

Revision ID: n4h5i6j7k8l9
Revises: m3g4h5i6j7k8
Create Date: 2026-03-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON


revision = "n4h5i6j7k8l9"
down_revision = "m3g4h5i6j7k8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Add columns to existing finance tables ─────────────────────────────
    op.add_column("finance_invoices", sa.Column("custom_fields", JSON, nullable=True))
    op.add_column("finance_invoices", sa.Column("dimension_ids", JSON, nullable=True))
    op.add_column("finance_invoices", sa.Column("auto_je_posted", sa.Boolean, nullable=False, server_default="false"))

    op.add_column("finance_expenses", sa.Column("custom_fields", JSON, nullable=True))
    op.add_column("finance_expenses", sa.Column("dimension_ids", JSON, nullable=True))
    op.add_column("finance_expenses", sa.Column("mileage_km", sa.Numeric(10, 2), nullable=True))
    op.add_column("finance_expenses", sa.Column("mileage_rate", sa.Numeric(10, 4), nullable=True))

    op.add_column("finance_vendor_bills", sa.Column("custom_fields", JSON, nullable=True))
    op.add_column("finance_vendor_bills", sa.Column("dimension_ids", JSON, nullable=True))

    # ── finance_estimates ──────────────────────────────────────────────────
    op.create_table(
        "finance_estimates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("estimate_number", sa.String(50), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("customer_name", sa.String(200), nullable=True),
        sa.Column("customer_email", sa.String(200), nullable=True),
        sa.Column("issue_date", sa.Date, nullable=False),
        sa.Column("expiry_date", sa.Date, nullable=False),
        sa.Column("subtotal", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("tax_amount", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("total", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("terms", sa.Text, nullable=True),
        sa.Column("items", JSON, nullable=True),
        sa.Column("custom_fields", JSON, nullable=True),
        sa.Column("dimension_ids", JSON, nullable=True),
        sa.Column(
            "converted_invoice_id",
            UUID(as_uuid=True),
            sa.ForeignKey("finance_invoices.id"),
            nullable=True,
        ),
        sa.Column(
            "owner_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── finance_custom_fields ──────────────────────────────────────────────
    op.create_table(
        "finance_custom_fields",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("field_name", sa.String(100), nullable=False),
        sa.Column("field_label", sa.String(200), nullable=False),
        sa.Column("field_type", sa.String(30), nullable=False),
        sa.Column("options", JSON, nullable=True),
        sa.Column("is_required", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("placeholder", sa.String(200), nullable=True),
        sa.Column("default_value", sa.String(500), nullable=True),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── finance_dimensions ─────────────────────────────────────────────────
    op.create_table(
        "finance_dimensions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("code", sa.String(50), nullable=True),
        sa.Column("dimension_type", sa.String(50), nullable=False),
        sa.Column("parent_id", UUID(as_uuid=True), sa.ForeignKey("finance_dimensions.id"), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── finance_revenue_recognition ────────────────────────────────────────
    op.create_table(
        "finance_revenue_recognition",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("invoice_id", UUID(as_uuid=True), sa.ForeignKey("finance_invoices.id"), nullable=False),
        sa.Column("total_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("recognized_amount", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("deferred_amount", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("recognition_method", sa.String(40), nullable=False, server_default="straight_line"),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("revenue_account_id", UUID(as_uuid=True), sa.ForeignKey("finance_accounts.id"), nullable=True),
        sa.Column("deferred_account_id", UUID(as_uuid=True), sa.ForeignKey("finance_accounts.id"), nullable=True),
        sa.Column("schedule_lines", JSON, nullable=True),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── finance_workflow_rules ─────────────────────────────────────────────
    op.create_table(
        "finance_workflow_rules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("trigger_event", sa.String(100), nullable=False),
        sa.Column("conditions", JSON, nullable=True),
        sa.Column("actions", JSON, nullable=True),
        sa.Column("priority", sa.Integer, nullable=False, server_default="10"),
        sa.Column("last_triggered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("trigger_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── finance_workflow_executions ────────────────────────────────────────
    op.create_table(
        "finance_workflow_executions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("rule_id", UUID(as_uuid=True), sa.ForeignKey("finance_workflow_rules.id"), nullable=False),
        sa.Column("trigger_event", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="success"),
        sa.Column("actions_taken", JSON, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── finance_dunning_logs ───────────────────────────────────────────────
    op.create_table(
        "finance_dunning_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("invoice_id", UUID(as_uuid=True), sa.ForeignKey("finance_invoices.id"), nullable=False),
        sa.Column("stage", sa.Integer, nullable=False, server_default="1"),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("channel", sa.String(20), nullable=False, server_default="email"),
        sa.Column("message_preview", sa.Text, nullable=True),
        sa.Column("ai_generated", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("opened", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("responded", sa.Boolean, nullable=False, server_default="false"),
    )

    # ── finance_tax_jurisdictions ──────────────────────────────────────────
    op.create_table(
        "finance_tax_jurisdictions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("country", sa.String(100), nullable=False),
        sa.Column("state_province", sa.String(100), nullable=True),
        sa.Column("tax_type", sa.String(50), nullable=False),
        sa.Column("rate", sa.Numeric(8, 4), nullable=False),
        sa.Column("compound", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("applies_to", sa.String(20), nullable=False, server_default="all"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("effective_date", sa.Date, nullable=False),
        sa.Column("expiry_date", sa.Date, nullable=True),
        sa.Column("tax_account_id", UUID(as_uuid=True), sa.ForeignKey("finance_accounts.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── finance_compliance_events ──────────────────────────────────────────
    op.create_table(
        "finance_compliance_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("due_date", sa.Date, nullable=False),
        sa.Column("recurrence", sa.String(20), nullable=False, server_default="one_time"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("jurisdiction", sa.String(100), nullable=True),
        sa.Column("assigned_to", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reminder_days", JSON, nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("documents", JSON, nullable=True),
        sa.Column("ai_generated", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── finance_fx_revaluations ────────────────────────────────────────────
    op.create_table(
        "finance_fx_revaluations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("revaluation_date", sa.Date, nullable=False),
        sa.Column("account_id", UUID(as_uuid=True), sa.ForeignKey("finance_accounts.id"), nullable=False),
        sa.Column("original_currency", sa.String(3), nullable=False),
        sa.Column("original_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("base_currency_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("revaluation_rate", sa.Numeric(18, 8), nullable=False),
        sa.Column("revalued_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("gain_loss", sa.Numeric(15, 2), nullable=False),
        sa.Column("gain_loss_account_id", UUID(as_uuid=True), sa.ForeignKey("finance_accounts.id"), nullable=True),
        sa.Column("journal_entry_id", UUID(as_uuid=True), sa.ForeignKey("finance_journal_entries.id"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── finance_bank_categorization_rules ─────────────────────────────────
    op.create_table(
        "finance_bank_categorization_rules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("pattern", sa.String(300), nullable=False),
        sa.Column("match_type", sa.String(20), nullable=False, server_default="contains"),
        sa.Column("account_id", UUID(as_uuid=True), sa.ForeignKey("finance_accounts.id"), nullable=False),
        sa.Column("description_override", sa.String(300), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("priority", sa.Integer, nullable=False, server_default="10"),
        sa.Column("ai_learned", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("match_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("finance_bank_categorization_rules")
    op.drop_table("finance_fx_revaluations")
    op.drop_table("finance_compliance_events")
    op.drop_table("finance_tax_jurisdictions")
    op.drop_table("finance_dunning_logs")
    op.drop_table("finance_workflow_executions")
    op.drop_table("finance_workflow_rules")
    op.drop_table("finance_revenue_recognition")
    op.drop_table("finance_dimensions")
    op.drop_table("finance_custom_fields")
    op.drop_table("finance_estimates")

    op.drop_column("finance_vendor_bills", "dimension_ids")
    op.drop_column("finance_vendor_bills", "custom_fields")
    op.drop_column("finance_expenses", "mileage_rate")
    op.drop_column("finance_expenses", "mileage_km")
    op.drop_column("finance_expenses", "dimension_ids")
    op.drop_column("finance_expenses", "custom_fields")
    op.drop_column("finance_invoices", "auto_je_posted")
    op.drop_column("finance_invoices", "dimension_ids")
    op.drop_column("finance_invoices", "custom_fields")
