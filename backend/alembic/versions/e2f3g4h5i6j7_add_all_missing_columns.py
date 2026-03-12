"""Add all missing columns across models (safe - IF NOT EXISTS)

Revision ID: e2f3g4h5i6j7
Revises: d1e2f3g4h5i6
Create Date: 2026-03-13

"""
from alembic import op
import sqlalchemy as sa

revision = 'e2f3g4h5i6j7'
down_revision = 'd1e2f3g4h5i6'
branch_labels = None
depends_on = None


def add_if_missing(table, column, col_type):
    """Add a column only if it doesn't already exist."""
    op.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {col_type}")


def upgrade() -> None:
    # calendar_events
    add_if_missing('calendar_events', 'sensitivity', 'VARCHAR(20)')
    add_if_missing('calendar_events', 'priority', 'VARCHAR(20)')
    add_if_missing('calendar_events', 'buffer_before', 'INTEGER DEFAULT 0')
    add_if_missing('calendar_events', 'buffer_after', 'INTEGER DEFAULT 0')
    add_if_missing('calendar_events', 'timezone', 'VARCHAR(100)')
    add_if_missing('calendar_events', 'reminders', 'JSONB')
    add_if_missing('calendar_events', 'calendar_id', 'UUID')
    add_if_missing('calendar_events', 'category_id', 'UUID')
    add_if_missing('calendar_events', 'erp_context', 'JSONB')
    add_if_missing('calendar_events', 'status', "VARCHAR(20) DEFAULT 'confirmed'")
    op.execute("UPDATE calendar_events SET sensitivity='default' WHERE sensitivity IS NULL")

    # form_fields
    add_if_missing('form_fields', 'description', 'TEXT')
    add_if_missing('form_fields', 'metadata', 'JSONB')
    add_if_missing('form_fields', 'page_number', 'INTEGER DEFAULT 1')
    add_if_missing('form_fields', 'placeholder', 'VARCHAR(500)')

    # form_responses
    add_if_missing('form_responses', 'is_sandbox', 'BOOLEAN DEFAULT FALSE')

    # crm_contact_notes
    add_if_missing('crm_contact_notes', 'metadata_json', 'JSONB')
    add_if_missing('crm_contact_notes', 'pinned', 'BOOLEAN DEFAULT FALSE')

    # crm_custom_field_definitions
    add_if_missing('crm_custom_field_definitions', 'created_by', 'UUID')
    add_if_missing('crm_custom_field_definitions', 'default_value', 'TEXT')
    add_if_missing('crm_custom_field_definitions', 'sort_order', 'INTEGER DEFAULT 0')

    # crm_duplicate_candidates
    add_if_missing('crm_duplicate_candidates', 'match_fields', 'JSONB')
    add_if_missing('crm_duplicate_candidates', 'reviewed_at', 'TIMESTAMPTZ')
    add_if_missing('crm_duplicate_candidates', 'reviewed_by', 'UUID')

    # crm_lead_scoring_rules
    add_if_missing('crm_lead_scoring_rules', 'category', 'VARCHAR(50)')
    add_if_missing('crm_lead_scoring_rules', 'created_by', 'UUID')
    add_if_missing('crm_lead_scoring_rules', 'field_name', 'VARCHAR(100)')
    add_if_missing('crm_lead_scoring_rules', 'score_delta', 'INTEGER DEFAULT 0')

    # crm_sales_activities
    add_if_missing('crm_sales_activities', 'due_date', 'TIMESTAMPTZ')

    # crm_sales_sequences
    add_if_missing('crm_sales_sequences', 'trigger_config', 'JSONB')
    add_if_missing('crm_sales_sequences', 'trigger_type', 'VARCHAR(50)')

    # crm_sequence_enrollments
    add_if_missing('crm_sequence_enrollments', 'current_step_id', 'UUID')
    add_if_missing('crm_sequence_enrollments', 'enrolled_by', 'UUID')
    add_if_missing('crm_sequence_enrollments', 'metadata_json', 'JSONB')

    # crm_sequence_steps
    add_if_missing('crm_sequence_steps', 'delay_hours', 'INTEGER DEFAULT 0')

    # mailbox_messages
    add_if_missing('mailbox_messages', 'account_id', 'UUID')
    add_if_missing('mailbox_messages', 'ai_category', 'VARCHAR(50)')
    add_if_missing('mailbox_messages', 'ai_summary', 'TEXT')
    add_if_missing('mailbox_messages', 'ai_triage', 'JSONB')
    add_if_missing('mailbox_messages', 'category_ids', 'JSONB')
    add_if_missing('mailbox_messages', 'display_format', "VARCHAR(20) DEFAULT 'html'")
    add_if_missing('mailbox_messages', 'flag_due_date', 'TIMESTAMPTZ')
    add_if_missing('mailbox_messages', 'flag_reminder_at', 'TIMESTAMPTZ')
    add_if_missing('mailbox_messages', 'flag_status', 'VARCHAR(20)')
    add_if_missing('mailbox_messages', 'is_pinned', 'BOOLEAN DEFAULT FALSE')
    add_if_missing('mailbox_messages', 'predicted_actions', 'JSONB')
    add_if_missing('mailbox_messages', 'priority_score', 'FLOAT')
    add_if_missing('mailbox_messages', 'scheduled_send_at', 'TIMESTAMPTZ')
    add_if_missing('mailbox_messages', 'sensitivity_label_id', 'UUID')

    # mfg_bom_items
    add_if_missing('mfg_bom_items', 'is_phantom', 'BOOLEAN DEFAULT FALSE')

    # mfg_maintenance_schedules
    add_if_missing('mfg_maintenance_schedules', 'asset_id', 'UUID')
    add_if_missing('mfg_maintenance_schedules', 'trigger_threshold', 'FLOAT')
    add_if_missing('mfg_maintenance_schedules', 'trigger_type', 'VARCHAR(30)')

    # mfg_routing_steps
    add_if_missing('mfg_routing_steps', 'barcode_scan_required', 'BOOLEAN DEFAULT FALSE')
    add_if_missing('mfg_routing_steps', 'instruction_media', 'JSONB')
    add_if_missing('mfg_routing_steps', 'min_operators', 'INTEGER DEFAULT 1')
    add_if_missing('mfg_routing_steps', 'required_skill', 'VARCHAR(100)')
    add_if_missing('mfg_routing_steps', 'work_instructions', 'TEXT')

    # mfg_work_orders
    add_if_missing('mfg_work_orders', 'consumption_mode', "VARCHAR(20) DEFAULT 'at_start'")
    add_if_missing('mfg_work_orders', 'parent_wo_id', 'UUID')
    add_if_missing('mfg_work_orders', 'total_overhead_cost', 'NUMERIC(14,2) DEFAULT 0')

    # mfg_workstations
    add_if_missing('mfg_workstations', 'current_status', "VARCHAR(30) DEFAULT 'idle'")

    # pos_bundles
    add_if_missing('pos_bundles', 'description', 'TEXT')

    # pos_gift_card_transactions
    add_if_missing('pos_gift_card_transactions', 'notes', 'TEXT')

    # pos_gift_cards
    add_if_missing('pos_gift_cards', 'issued_by', 'UUID')

    # pos_payment_gateway_configs
    add_if_missing('pos_payment_gateway_configs', 'config_overrides', 'JSONB')
    add_if_missing('pos_payment_gateway_configs', 'gateway_id', 'VARCHAR(100)')

    # pos_pickup_orders
    add_if_missing('pos_pickup_orders', 'notes', 'TEXT')
    add_if_missing('pos_pickup_orders', 'picked_up_by', 'UUID')

    # project_automation_rules
    add_if_missing('project_automation_rules', 'action_type', 'VARCHAR(50)')
    add_if_missing('project_automation_rules', 'execution_count', 'INTEGER DEFAULT 0')
    add_if_missing('project_automation_rules', 'trigger_type', 'VARCHAR(50)')

    # project_custom_fields
    add_if_missing('project_custom_fields', 'default_value', 'TEXT')
    add_if_missing('project_custom_fields', '"order"', 'INTEGER DEFAULT 0')

    # project_guest_access
    add_if_missing('project_guest_access', 'permissions', 'JSONB')

    # project_recurring_configs
    add_if_missing('project_recurring_configs', 'cron_expression', 'VARCHAR(100)')
    add_if_missing('project_recurring_configs', 'day_of_month', 'INTEGER')
    add_if_missing('project_recurring_configs', 'day_of_week', 'INTEGER')
    add_if_missing('project_recurring_configs', 'recurrence_interval', 'INTEGER DEFAULT 1')
    add_if_missing('project_recurring_configs', 'recurrence_type', 'VARCHAR(30)')
    add_if_missing('project_recurring_configs', 'template_task', 'JSONB')

    # project_task_checklists
    add_if_missing('project_task_checklists', 'completed_at', 'TIMESTAMPTZ')
    add_if_missing('project_task_checklists', 'completed_by', 'UUID')
    add_if_missing('project_task_checklists', 'is_completed', 'BOOLEAN DEFAULT FALSE')

    # project_task_comments
    add_if_missing('project_task_comments', 'content', 'TEXT')
    add_if_missing('project_task_comments', 'mentions', 'JSONB')

    # project_task_relationships
    add_if_missing('project_task_relationships', 'updated_at', 'TIMESTAMPTZ')


def downgrade() -> None:
    pass
