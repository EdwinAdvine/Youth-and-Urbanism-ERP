"""indexes_constraints_triggers

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-13

Adds composite indexes, CHECK constraints, journal balance trigger,
and financial history triggers for journal entries and invoices.
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6g7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------ #
    # PART 1: Composite Indexes
    # ------------------------------------------------------------------ #

    # POS
    op.create_index("ix_pos_txn_session_status", "pos_transactions", ["session_id", "status"])
    op.create_index("ix_pos_txn_created_status", "pos_transactions", ["created_at", "status"])

    # Finance
    op.create_index("ix_fin_je_date_status", "finance_journal_entries", ["entry_date", "status"])
    op.create_index("ix_fin_invoice_status_due", "finance_invoices", ["status", "due_date"])
    op.create_index("ix_fin_invoice_owner_status", "finance_invoices", ["owner_id", "status"])
    op.create_index("ix_fin_payment_date_status", "finance_payments", ["payment_date", "status"])
    op.create_index("ix_fin_expense_user_status", "finance_expenses", ["user_id", "status"])

    # Inventory
    op.create_index("ix_inv_movement_item_created", "stock_movements", ["item_id", "created_at"])
    op.create_index("ix_inv_movement_warehouse", "stock_movements", ["warehouse_id", "created_at"])
    op.create_index("ix_inv_stock_item_warehouse", "stock_levels", ["item_id", "warehouse_id"])

    # CRM
    op.create_index("ix_crm_deal_stage_owner", "crm_deals", ["stage", "owner_id"])
    op.create_index("ix_crm_lead_status", "crm_leads", ["status"])
    op.create_index("ix_crm_opportunity_status_owner", "crm_opportunities", ["status", "owner_id"])

    # Projects
    op.create_index("ix_task_project_status", "tasks", ["project_id", "status"])
    op.create_index("ix_task_assignee", "tasks", ["assigned_to"])

    # Support
    op.create_index("ix_ticket_status_priority", "support_tickets", ["status", "priority"])
    op.create_index("ix_ticket_assigned_status", "support_tickets", ["assigned_to", "status"])

    # HR
    op.create_index("ix_attendance_employee_date", "hr_attendance", ["employee_id", "date"])
    op.create_index("ix_leave_employee_status", "hr_leave_requests", ["employee_id", "status"])

    # Chat
    op.create_index("ix_chat_msg_channel_created", "chat_messages", ["channel_id", "created_at"])

    # ------------------------------------------------------------------ #
    # PART 2: CHECK Constraints
    # ------------------------------------------------------------------ #

    # Finance positive amounts
    op.execute("ALTER TABLE finance_invoices ADD CONSTRAINT ck_fin_invoice_total_positive CHECK (total >= 0);")
    op.execute("ALTER TABLE finance_payments ADD CONSTRAINT ck_fin_payment_amount_positive CHECK (amount >= 0);")
    op.execute("ALTER TABLE finance_journal_lines ADD CONSTRAINT ck_fin_jl_debit_positive CHECK (debit >= 0);")
    op.execute("ALTER TABLE finance_journal_lines ADD CONSTRAINT ck_fin_jl_credit_positive CHECK (credit >= 0);")
    op.execute("ALTER TABLE finance_budget_lines ADD CONSTRAINT ck_fin_bl_allocated_positive CHECK (allocated >= 0);")
    op.execute("ALTER TABLE finance_fixed_assets ADD CONSTRAINT ck_fin_asset_cost_positive CHECK (purchase_cost >= 0);")

    # POS positive amounts
    op.execute("ALTER TABLE pos_transactions ADD CONSTRAINT ck_pos_txn_total_positive CHECK (total >= 0);")

    # Finance date ranges
    op.execute("ALTER TABLE finance_invoices ADD CONSTRAINT ck_fin_invoice_dates_valid CHECK (due_date >= issue_date);")
    op.execute("ALTER TABLE finance_vendor_bills ADD CONSTRAINT ck_fin_bill_dates_valid CHECK (due_date >= issue_date);")
    op.execute("ALTER TABLE finance_estimates ADD CONSTRAINT ck_fin_estimate_dates_valid CHECK (expiry_date >= issue_date);")

    # ------------------------------------------------------------------ #
    # PART 3: Journal Balance Trigger
    # ------------------------------------------------------------------ #

    op.execute("""
        CREATE OR REPLACE FUNCTION check_journal_balance()
        RETURNS TRIGGER AS $$
        BEGIN
            IF (SELECT ABS(COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0)) > 0.01
                FROM finance_journal_lines
                WHERE journal_entry_id = NEW.journal_entry_id) THEN
                RAISE EXCEPTION 'Journal entry is not balanced: debits must equal credits';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER trg_journal_balance
            AFTER INSERT OR UPDATE ON finance_journal_lines
            FOR EACH ROW EXECUTE FUNCTION check_journal_balance();
    """)

    # ------------------------------------------------------------------ #
    # PART 4: Financial History Triggers
    # ------------------------------------------------------------------ #

    # Journal entry history trigger
    op.execute("""
        CREATE OR REPLACE FUNCTION log_journal_entry_history()
        RETURNS TRIGGER AS $$
        BEGIN
            INSERT INTO finance_journal_entries_history (
                id, journal_entry_id, version, entry_number, entry_date,
                status, description, lines_snapshot, posted_by, changed_by, changed_at
            ) VALUES (
                gen_random_uuid(), OLD.id, COALESCE(OLD.version, 1), OLD.entry_number,
                OLD.entry_date, OLD.status, OLD.description,
                (SELECT COALESCE(json_agg(json_build_object(
                    'account_id', l.account_id::text,
                    'debit', l.debit,
                    'credit', l.credit,
                    'description', l.description
                )), '[]'::json) FROM finance_journal_lines l WHERE l.journal_entry_id = OLD.id),
                OLD.posted_by,
                NULLIF(current_setting('app.current_user_id', true), '')::uuid,
                now()
            );
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER trg_journal_entry_history
            BEFORE UPDATE ON finance_journal_entries
            FOR EACH ROW EXECUTE FUNCTION log_journal_entry_history();
    """)

    # Invoice history trigger
    op.execute("""
        CREATE OR REPLACE FUNCTION log_invoice_history()
        RETURNS TRIGGER AS $$
        BEGIN
            INSERT INTO finance_invoices_history (
                id, invoice_id, version, invoice_number, status, total,
                items_snapshot, full_snapshot, changed_by, changed_at
            ) VALUES (
                gen_random_uuid(), OLD.id, COALESCE(OLD.version, 1), OLD.invoice_number,
                OLD.status, OLD.total, OLD.items,
                json_build_object(
                    'invoice_number', OLD.invoice_number,
                    'invoice_type', OLD.invoice_type,
                    'status', OLD.status,
                    'customer_name', OLD.customer_name,
                    'customer_email', OLD.customer_email,
                    'issue_date', OLD.issue_date::text,
                    'due_date', OLD.due_date::text,
                    'subtotal', OLD.subtotal,
                    'tax_amount', OLD.tax_amount,
                    'total', OLD.total,
                    'currency', OLD.currency,
                    'notes', OLD.notes,
                    'items', OLD.items
                ),
                NULLIF(current_setting('app.current_user_id', true), '')::uuid,
                now()
            );
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER trg_invoice_history
            BEFORE UPDATE ON finance_invoices
            FOR EACH ROW EXECUTE FUNCTION log_invoice_history();
    """)


def downgrade() -> None:
    # ------------------------------------------------------------------ #
    # Drop triggers and functions (reverse order of Part 4, then Part 3)
    # ------------------------------------------------------------------ #

    op.execute("DROP TRIGGER IF EXISTS trg_invoice_history ON finance_invoices;")
    op.execute("DROP FUNCTION IF EXISTS log_invoice_history();")

    op.execute("DROP TRIGGER IF EXISTS trg_journal_entry_history ON finance_journal_entries;")
    op.execute("DROP FUNCTION IF EXISTS log_journal_entry_history();")

    op.execute("DROP TRIGGER IF EXISTS trg_journal_balance ON finance_journal_lines;")
    op.execute("DROP FUNCTION IF EXISTS check_journal_balance();")

    # ------------------------------------------------------------------ #
    # Drop CHECK constraints (reverse order of Part 2)
    # ------------------------------------------------------------------ #

    op.execute("ALTER TABLE finance_estimates DROP CONSTRAINT IF EXISTS ck_fin_estimate_dates_valid;")
    op.execute("ALTER TABLE finance_vendor_bills DROP CONSTRAINT IF EXISTS ck_fin_bill_dates_valid;")
    op.execute("ALTER TABLE finance_invoices DROP CONSTRAINT IF EXISTS ck_fin_invoice_dates_valid;")

    op.execute("ALTER TABLE pos_transactions DROP CONSTRAINT IF EXISTS ck_pos_txn_total_positive;")

    op.execute("ALTER TABLE finance_fixed_assets DROP CONSTRAINT IF EXISTS ck_fin_asset_cost_positive;")
    op.execute("ALTER TABLE finance_budget_lines DROP CONSTRAINT IF EXISTS ck_fin_bl_allocated_positive;")
    op.execute("ALTER TABLE finance_journal_lines DROP CONSTRAINT IF EXISTS ck_fin_jl_credit_positive;")
    op.execute("ALTER TABLE finance_journal_lines DROP CONSTRAINT IF EXISTS ck_fin_jl_debit_positive;")
    op.execute("ALTER TABLE finance_payments DROP CONSTRAINT IF EXISTS ck_fin_payment_amount_positive;")
    op.execute("ALTER TABLE finance_invoices DROP CONSTRAINT IF EXISTS ck_fin_invoice_total_positive;")

    # ------------------------------------------------------------------ #
    # Drop composite indexes (reverse order of Part 1)
    # ------------------------------------------------------------------ #

    op.drop_index("ix_chat_msg_channel_created", table_name="chat_messages")

    op.drop_index("ix_leave_employee_status", table_name="hr_leave_requests")
    op.drop_index("ix_attendance_employee_date", table_name="hr_attendance")

    op.drop_index("ix_ticket_assigned_status", table_name="support_tickets")
    op.drop_index("ix_ticket_status_priority", table_name="support_tickets")

    op.drop_index("ix_task_assignee", table_name="tasks")
    op.drop_index("ix_task_project_status", table_name="tasks")

    op.drop_index("ix_crm_opportunity_status_owner", table_name="crm_opportunities")
    op.drop_index("ix_crm_lead_status", table_name="crm_leads")
    op.drop_index("ix_crm_deal_stage_owner", table_name="crm_deals")

    op.drop_index("ix_inv_stock_item_warehouse", table_name="stock_levels")
    op.drop_index("ix_inv_movement_warehouse", table_name="stock_movements")
    op.drop_index("ix_inv_movement_item_created", table_name="stock_movements")

    op.drop_index("ix_fin_expense_user_status", table_name="finance_expenses")
    op.drop_index("ix_fin_payment_date_status", table_name="finance_payments")
    op.drop_index("ix_fin_invoice_owner_status", table_name="finance_invoices")
    op.drop_index("ix_fin_invoice_status_due", table_name="finance_invoices")
    op.drop_index("ix_fin_je_date_status", table_name="finance_journal_entries")

    op.drop_index("ix_pos_txn_created_status", table_name="pos_transactions")
    op.drop_index("ix_pos_txn_session_status", table_name="pos_transactions")
