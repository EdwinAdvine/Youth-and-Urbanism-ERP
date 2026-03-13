"""performance_indexes_and_matviews

Add comprehensive database indexes for query performance and
materialized views for dashboard aggregations.

Revision ID: ab1c2d3e4f5a
Revises: e40d57b69a05
Create Date: 2026-03-13 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ab1c2d3e4f5a"
down_revision: Union[str, None] = "e40d57b69a05"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Enable pg_stat_statements extension ──────────────────────────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_stat_statements")

    # ── Finance indexes ──────────────────────────────────────────────────────
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_finance_invoices_created_at "
        "ON finance_invoices (created_at)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_finance_invoices_status "
        "ON finance_invoices (status)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_finance_invoices_type_status "
        "ON finance_invoices (invoice_type, status)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_finance_journal_entries_entry_date "
        "ON finance_journal_entries (entry_date)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_finance_journal_entries_status "
        "ON finance_journal_entries (status)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_finance_payments_payment_date "
        "ON finance_payments (payment_date)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_finance_payments_invoice_id "
        "ON finance_payments (invoice_id)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_finance_expenses_created_at "
        "ON finance_expenses (created_at)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_finance_expenses_status "
        "ON finance_expenses (status)"
    )

    # ── User indexes ─────────────────────────────────────────────────────────
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_users_created_at "
        "ON users (created_at)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_users_is_active "
        "ON users (is_active) WHERE is_active = true"
    )

    # ── CRM indexes ──────────────────────────────────────────────────────────
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_crm_contacts_created_at "
        "ON crm_contacts (created_at)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_crm_contacts_owner_id "
        "ON crm_contacts (owner_id)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_crm_opportunities_stage "
        "ON crm_opportunities (stage)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_crm_opportunities_owner_id "
        "ON crm_opportunities (owner_id)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_crm_opportunities_created_at "
        "ON crm_opportunities (created_at)"
    )

    # ── Inventory indexes ────────────────────────────────────────────────────
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_inventory_items_sku "
        "ON inventory_items (sku)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_inventory_items_category_id "
        "ON inventory_items (category_id)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_inventory_items_is_active "
        "ON inventory_items (is_active) WHERE is_active = true"
    )

    # ── POS indexes ──────────────────────────────────────────────────────────
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_pos_transactions_created_at "
        "ON pos_transactions (created_at)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_pos_transactions_status "
        "ON pos_transactions (status)"
    )

    # ── Support indexes ──────────────────────────────────────────────────────
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_tickets_status "
        "ON tickets (status)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_tickets_priority "
        "ON tickets (priority)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_tickets_assigned_to "
        "ON tickets (assigned_to)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_tickets_created_at "
        "ON tickets (created_at)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_tickets_status_priority "
        "ON tickets (status, priority)"
    )

    # ── Calendar indexes ─────────────────────────────────────────────────────
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_calendar_events_start_time "
        "ON calendar_events (start_time)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_calendar_events_end_time "
        "ON calendar_events (end_time)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_calendar_events_organizer_id "
        "ON calendar_events (organizer_id)"
    )

    # ── Projects indexes ─────────────────────────────────────────────────────
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_project_tasks_status "
        "ON project_tasks (status)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_project_tasks_assigned_to "
        "ON project_tasks (assigned_to)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_project_tasks_project_id "
        "ON project_tasks (project_id)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_project_tasks_status_project "
        "ON project_tasks (status, project_id)"
    )

    # ── Activity feed indexes ────────────────────────────────────────────────
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_activity_feed_created_at "
        "ON activity_feed (created_at DESC)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_activity_feed_module "
        "ON activity_feed (module)"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_activity_feed_user_id "
        "ON activity_feed (user_id)"
    )

    # ── Notification indexes ─────────────────────────────────────────────────
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_notifications_user_id_read "
        "ON notifications (user_id, is_read) WHERE is_read = false"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_notifications_created_at "
        "ON notifications (created_at DESC)"
    )

    # ── Materialized views for dashboard aggregations ────────────────────────
    op.execute("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_monthly_revenue AS
        SELECT
            DATE_TRUNC('month', created_at) AS month,
            COALESCE(SUM(total), 0) AS revenue,
            COUNT(*) AS invoice_count
        FROM finance_invoices
        WHERE created_at >= NOW() - INTERVAL '36 months'
        GROUP BY 1
        ORDER BY 1 ASC
    """)
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_mv_monthly_revenue_month "
        "ON mv_monthly_revenue (month)"
    )

    op.execute("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_monthly_users AS
        SELECT
            DATE_TRUNC('month', created_at) AS month,
            COUNT(*) AS new_users
        FROM users
        WHERE created_at >= NOW() - INTERVAL '36 months'
        GROUP BY 1
        ORDER BY 1 ASC
    """)
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_mv_monthly_users_month "
        "ON mv_monthly_users (month)"
    )

    op.execute("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_support_metrics AS
        SELECT
            COUNT(*) FILTER (WHERE status = 'open') AS open_tickets,
            COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_tickets,
            COUNT(*) FILTER (WHERE status = 'closed') AS closed_tickets,
            COUNT(*) AS total_tickets
        FROM tickets
    """)

    op.execute("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_module_counts AS
        SELECT 'Finance' AS module, COUNT(*) AS count FROM finance_invoices
        UNION ALL SELECT 'CRM', COUNT(*) FROM crm_contacts
        UNION ALL SELECT 'Inventory', COUNT(*) FROM inventory_items
        UNION ALL SELECT 'Calendar', COUNT(*) FROM calendar_events
        UNION ALL SELECT 'Users', COUNT(*) FROM users
    """)


def downgrade() -> None:
    # Drop materialized views
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_module_counts")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_support_metrics")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_monthly_users")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_monthly_revenue")

    # Drop indexes (in reverse order)
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_notifications_created_at")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_notifications_user_id_read")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_activity_feed_user_id")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_activity_feed_module")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_activity_feed_created_at")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_project_tasks_status_project")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_project_tasks_project_id")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_project_tasks_assigned_to")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_project_tasks_status")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_calendar_events_organizer_id")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_calendar_events_end_time")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_calendar_events_start_time")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_tickets_status_priority")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_tickets_created_at")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_tickets_assigned_to")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_tickets_priority")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_tickets_status")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_pos_transactions_status")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_pos_transactions_created_at")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_inventory_items_is_active")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_inventory_items_category_id")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_inventory_items_sku")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_crm_opportunities_created_at")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_crm_opportunities_owner_id")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_crm_opportunities_stage")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_crm_contacts_owner_id")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_crm_contacts_created_at")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_users_is_active")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_users_created_at")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_finance_expenses_status")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_finance_expenses_created_at")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_finance_payments_invoice_id")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_finance_payments_payment_date")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_finance_journal_entries_status")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_finance_journal_entries_entry_date")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_finance_invoices_type_status")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_finance_invoices_status")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_finance_invoices_created_at")
