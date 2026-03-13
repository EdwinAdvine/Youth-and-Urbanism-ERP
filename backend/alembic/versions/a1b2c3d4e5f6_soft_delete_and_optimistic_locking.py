"""soft_delete_and_optimistic_locking

Revision ID: aa1b2c3d4e5f
Revises: z6u7v8w9x0y1
Create Date: 2026-03-13

Adds:
- deleted_at / deleted_by soft-delete columns to all BaseModel tables
- Partial index ix_{table}_not_deleted WHERE deleted_at IS NULL
- version (optimistic locking) column to high-contention tables
- universal_audit_log table
- finance_journal_entries_history table
- finance_invoices_history table
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "aa1b2c3d4e5f"
down_revision = "z6u7v8w9x0y1"
branch_labels = None
depends_on = None

# ---------------------------------------------------------------------------
# Tables receiving soft-delete columns (deleted_at, deleted_by)
# ---------------------------------------------------------------------------
SOFT_DELETE_TABLES = [
    "users", "roles", "permissions", "teams",
    "ai_configs", "ai_chat_history", "ai_audit_logs", "ai_prompt_templates", "ai_knowledge_bases",
    "drive_files", "drive_folders", "file_tags", "file_comments", "trash_bins",
    "notes", "note_tags", "note_share_records", "note_templates",
    "notebooks", "notebook_sections", "note_entity_links",
    "calendar_events", "calendar_subscriptions", "calendar_categories",
    "user_calendars", "calendar_permissions", "event_attachments",
    "focus_time_blocks", "calendar_rules", "calendar_audit_logs",
    "calendar_webhooks", "calendar_api_keys",
    "booking_pages", "booking_slots",
    "resources", "resource_bookings",
    "forms", "form_fields", "form_responses", "form_templates", "form_collaborators",
    "projects", "tasks", "milestones", "time_logs", "task_dependencies", "project_milestones", "task_attachments", "project_templates",
    "finance_accounts", "finance_journal_entries", "finance_invoices", "finance_payments",
    "finance_budgets", "finance_budget_lines", "finance_tax_rates",
    "finance_recurring_invoices", "finance_expenses", "finance_vendor_bills", "finance_fixed_assets",
    "finance_estimates", "finance_custom_fields", "finance_dimensions",
    "finance_revenue_recognition", "finance_workflow_rules",
    "hr_departments", "hr_employees", "hr_leave_requests", "hr_attendance",
    "hr_salary_structures", "hr_payslips", "hr_employee_documents",
    "hr_trainings", "hr_performance_reviews", "hr_benefits", "hr_overtime",
    "warehouses", "inventory_items", "stock_levels", "stock_movements",
    "purchase_orders", "stock_adjustments", "item_variants",
    "batch_numbers", "inventory_counts", "inventory_suppliers",
    "crm_contacts", "crm_leads", "crm_opportunities", "crm_deals",
    "crm_campaigns", "crm_products", "crm_quotes", "crm_tickets",
    "system_settings", "user_preferences", "notifications",
    "file_shares", "activity_feed",
    "support_ticket_categories", "support_tickets", "support_ticket_comments",
    "support_kb_articles", "support_sla_policies", "support_canned_responses",
    "support_ticket_tags", "support_customer_satisfaction",
    "suppliers", "procurement_requisitions",
    "goods_received_notes", "supplier_returns",
    "shipments", "return_orders", "quality_inspections", "supplier_ratings", "contracts",
    "pos_sessions", "pos_transactions", "pos_terminals", "pos_discounts",
    "pos_receipts", "pos_bundles",
    "loyalty_programs", "loyalty_tiers", "loyalty_members", "loyalty_transactions", "loyalty_rewards",
    "kds_stations", "kds_orders",
    "bom", "work_stations", "work_orders", "quality_checks",
    "routing_steps", "scrap_entries", "maintenance_schedules", "quality_controls",
    "ecom_stores", "ecom_products", "ecom_customer_accounts",
    "ecom_carts", "ecom_orders",
    "ecom_coupons", "ecom_shipping_methods", "ecom_reviews", "ecom_wishlists", "ecom_payment_gateways",
    "licenses",
    "sso_providers",
    "currencies", "exchange_rates", "bank_statements", "reconciliations", "bank_reconciliations",
    "tax_brackets", "statutory_deductions", "pay_runs",
    "mail_rules", "mail_signatures", "mail_read_receipts", "mail_threads", "mail_labels", "mail_filters",
    "meeting_recordings", "meeting_chats", "meeting_templates", "meeting_notes", "meeting_links",
    "document_comments", "document_templates", "recent_documents", "document_bookmarks",
    "dashboards", "analytics_widgets", "saved_queries", "reports", "data_alerts",
    "channels", "channel_members", "chat_messages",
]

# ---------------------------------------------------------------------------
# Tables receiving optimistic-locking version column
# ---------------------------------------------------------------------------
VERSION_TABLES = [
    "finance_journal_entries", "finance_invoices", "finance_vendor_bills", "finance_budgets",
    "inventory_items", "stock_levels", "purchase_orders",
    "crm_deals", "crm_opportunities", "crm_quotes",
    "projects", "tasks",
    "support_tickets",
    "ecom_orders",
    "work_orders",
    "pos_sessions",
]


def upgrade() -> None:
    conn = op.get_bind()

    # ------------------------------------------------------------------
    # 1. Soft-delete columns + partial index for every BaseModel table
    #    Uses IF EXISTS / IF NOT EXISTS so missing tables are skipped.
    # ------------------------------------------------------------------
    for table in SOFT_DELETE_TABLES:
        conn.execute(sa.text(
            f"ALTER TABLE IF EXISTS {table} ADD COLUMN IF NOT EXISTS "
            f"deleted_at TIMESTAMP WITH TIME ZONE"
        ))
        conn.execute(sa.text(
            f"ALTER TABLE IF EXISTS {table} ADD COLUMN IF NOT EXISTS "
            f"deleted_by UUID"
        ))
        # Create partial index only if table & column exist
        conn.execute(sa.text(f"""
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = '{table}' AND column_name = 'deleted_at'
                ) THEN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_indexes
                        WHERE tablename = '{table}' AND indexname = 'ix_{table}_not_deleted'
                    ) THEN
                        CREATE INDEX ix_{table}_not_deleted
                        ON {table} (deleted_at) WHERE deleted_at IS NULL;
                    END IF;
                END IF;
            END $$;
        """))

    # ------------------------------------------------------------------
    # 2. Optimistic-locking version column
    # ------------------------------------------------------------------
    for table in VERSION_TABLES:
        conn.execute(sa.text(
            f"ALTER TABLE IF EXISTS {table} ADD COLUMN IF NOT EXISTS "
            f"version INTEGER NOT NULL DEFAULT 1"
        ))

    # ------------------------------------------------------------------
    # 3. universal_audit_log table
    # ------------------------------------------------------------------
    op.create_table(
        "universal_audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("table_name", sa.String(100), nullable=False),
        sa.Column("record_id", sa.String(36), nullable=False),
        sa.Column("action", sa.String(10), nullable=False),
        sa.Column("old_values", postgresql.JSONB, nullable=True),
        sa.Column("new_values", postgresql.JSONB, nullable=True),
        sa.Column("changed_fields", postgresql.JSONB, nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_ual_table_record", "universal_audit_log", ["table_name", "record_id"])
    op.create_index("ix_ual_timestamp", "universal_audit_log", ["timestamp"])
    op.create_index("ix_ual_user", "universal_audit_log", ["user_id"])
    op.create_index("ix_ual_action", "universal_audit_log", ["action"])

    # ------------------------------------------------------------------
    # 4. finance_journal_entries_history table
    # ------------------------------------------------------------------
    op.create_table(
        "finance_journal_entries_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("journal_entry_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("entry_number", sa.String(50), nullable=False),
        sa.Column("entry_date", sa.Date, nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("lines_snapshot", postgresql.JSONB, nullable=False),
        sa.Column("posted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("changed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("change_reason", sa.Text, nullable=True),
    )
    op.create_index("ix_jeh_journal_entry_id", "finance_journal_entries_history", ["journal_entry_id"])
    op.create_index("ix_jeh_changed_at", "finance_journal_entries_history", ["changed_at"])

    # ------------------------------------------------------------------
    # 5. finance_invoices_history table
    # ------------------------------------------------------------------
    op.create_table(
        "finance_invoices_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("invoice_number", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("total", sa.Numeric(15, 2), nullable=False),
        sa.Column("items_snapshot", postgresql.JSONB, nullable=True),
        sa.Column("full_snapshot", postgresql.JSONB, nullable=False),
        sa.Column("changed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("change_reason", sa.Text, nullable=True),
    )
    op.create_index("ix_ih_invoice_id", "finance_invoices_history", ["invoice_id"])
    op.create_index("ix_ih_changed_at", "finance_invoices_history", ["changed_at"])


def downgrade() -> None:
    # ------------------------------------------------------------------
    # Drop history + audit tables (reverse order of creation)
    # ------------------------------------------------------------------
    op.drop_index("ix_ih_changed_at", table_name="finance_invoices_history")
    op.drop_index("ix_ih_invoice_id", table_name="finance_invoices_history")
    op.drop_table("finance_invoices_history")

    op.drop_index("ix_jeh_changed_at", table_name="finance_journal_entries_history")
    op.drop_index("ix_jeh_journal_entry_id", table_name="finance_journal_entries_history")
    op.drop_table("finance_journal_entries_history")

    op.drop_index("ix_ual_action", table_name="universal_audit_log")
    op.drop_index("ix_ual_user", table_name="universal_audit_log")
    op.drop_index("ix_ual_timestamp", table_name="universal_audit_log")
    op.drop_index("ix_ual_table_record", table_name="universal_audit_log")
    op.drop_table("universal_audit_log")

    # ------------------------------------------------------------------
    # Drop version columns
    # ------------------------------------------------------------------
    for table in VERSION_TABLES:
        op.drop_column(table, "version")

    # ------------------------------------------------------------------
    # Drop soft-delete columns + partial indexes
    # ------------------------------------------------------------------
    for table in SOFT_DELETE_TABLES:
        op.drop_index(f"ix_{table}_not_deleted", table_name=table)
        op.drop_column(table, "deleted_by")
        op.drop_column(table, "deleted_at")
