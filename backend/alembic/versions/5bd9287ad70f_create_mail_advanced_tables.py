"""create_mail_advanced_tables

Revision ID: 5bd9287ad70f
Revises: 7ad0bee85d46
Create Date: 2026-03-12 23:40:12.104889

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '5bd9287ad70f'
down_revision: Union[str, None] = '7ad0bee85d46'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### Create mail advanced tables ###
    op.create_table('dlp_policies',
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('patterns', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('action', sa.String(length=20), nullable=False, comment='warn, block, log'),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_by', sa.UUID(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )

    op.create_table('focused_inbox_scores',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('sender_email', sa.String(length=320), nullable=False),
    sa.Column('score', sa.Float(), nullable=False),
    sa.Column('email_count', sa.Integer(), nullable=False),
    sa.Column('last_email_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('has_crm_contact', sa.Boolean(), nullable=False),
    sa.Column('has_open_deal', sa.Boolean(), nullable=False),
    sa.Column('has_support_ticket', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'sender_email', name='uq_focused_inbox_user_sender')
    )

    op.create_table('mail_accounts',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('provider', sa.String(length=20), nullable=False, comment='internal, gmail, outlook, yahoo, imap'),
    sa.Column('email', sa.String(length=320), nullable=False),
    sa.Column('display_name', sa.String(length=255), nullable=False),
    sa.Column('imap_host', sa.String(length=255), nullable=True),
    sa.Column('imap_port', sa.Integer(), nullable=True),
    sa.Column('smtp_host', sa.String(length=255), nullable=True),
    sa.Column('smtp_port', sa.Integer(), nullable=True),
    sa.Column('oauth_tokens', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='Encrypted OAuth tokens'),
    sa.Column('password_encrypted', sa.Text(), nullable=True),
    sa.Column('sync_enabled', sa.Boolean(), nullable=False),
    sa.Column('last_sync_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('sync_cursor', sa.Text(), nullable=True),
    sa.Column('is_default', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )

    op.create_table('mail_annotations',
    sa.Column('message_id', sa.UUID(), nullable=False),
    sa.Column('author_id', sa.UUID(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('is_internal', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )

    op.create_table('mail_categories',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('color', sa.String(length=20), nullable=False),
    sa.Column('keyboard_shortcut', sa.String(length=10), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )

    op.create_table('mail_contact_profiles',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('email', sa.String(length=320), nullable=False),
    sa.Column('display_name', sa.String(length=255), nullable=True),
    sa.Column('avatar_url', sa.Text(), nullable=True),
    sa.Column('title', sa.String(length=255), nullable=True),
    sa.Column('company', sa.String(length=255), nullable=True),
    sa.Column('crm_contact_id', sa.UUID(), nullable=True),
    sa.Column('email_count', sa.Integer(), nullable=False),
    sa.Column('last_email_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('avg_response_time_minutes', sa.Float(), nullable=True),
    sa.Column('sentiment_trend', sa.String(length=20), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'email', name='uq_mail_contact_profile_user_email')
    )

    op.create_table('mail_polls',
    sa.Column('message_id', sa.UUID(), nullable=True),
    sa.Column('creator_id', sa.UUID(), nullable=False),
    sa.Column('question', sa.Text(), nullable=False),
    sa.Column('options', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('responses', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('closes_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['creator_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )

    op.create_table('mail_quick_steps',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('icon', sa.String(length=50), nullable=True),
    sa.Column('keyboard_shortcut', sa.String(length=20), nullable=True),
    sa.Column('actions', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )

    op.create_table('mail_retention_policies',
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('applies_to_labels', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('applies_to_categories', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('retention_days', sa.Integer(), nullable=False),
    sa.Column('action', sa.String(length=20), nullable=False, comment='archive, delete'),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_by', sa.UUID(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )

    op.create_table('mail_search_folders',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('query_string', sa.Text(), nullable=False),
    sa.Column('icon', sa.String(length=50), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )

    op.create_table('mail_smart_folders',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('query', sa.Text(), nullable=False),
    sa.Column('icon', sa.String(length=50), nullable=True),
    sa.Column('is_ai_suggested', sa.Boolean(), nullable=False),
    sa.Column('message_count', sa.Integer(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )

    op.create_table('mail_templates',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('subject_template', sa.String(length=998), nullable=False),
    sa.Column('body_html_template', sa.Text(), nullable=False),
    sa.Column('variables', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('category', sa.String(length=100), nullable=True),
    sa.Column('is_shared', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )

    op.create_table('mail_webhooks',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('url', sa.Text(), nullable=False),
    sa.Column('events', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('secret', sa.String(length=255), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )

    op.create_table('push_subscriptions',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('endpoint', sa.Text(), nullable=False),
    sa.Column('p256dh_key', sa.Text(), nullable=False),
    sa.Column('auth_key', sa.Text(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )

    op.create_table('shared_mailboxes',
    sa.Column('email', sa.String(length=320), nullable=False),
    sa.Column('display_name', sa.String(length=255), nullable=False),
    sa.Column('member_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('created_by', sa.UUID(), nullable=False),
    sa.Column('auto_assign_enabled', sa.Boolean(), nullable=False),
    sa.Column('assignment_strategy', sa.String(length=20), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email')
    )

    # ### Create indexes ###
    op.create_index('ix_crm_contacts_email', 'crm_contacts', ['email'], unique=False)

    # ### Drop orphaned tables (all empty) with CASCADE ###
    op.execute("DROP TABLE IF EXISTS ecom_loyalty_transactions CASCADE")
    op.execute("DROP TABLE IF EXISTS project_time_log_entries CASCADE")
    op.execute("DROP TABLE IF EXISTS ecom_b2b_quote_items CASCADE")
    op.execute("DROP TABLE IF EXISTS ecom_b2b_quotes CASCADE")
    op.execute("DROP TABLE IF EXISTS ecom_loyalty_accounts CASCADE")
    op.execute("DROP TABLE IF EXISTS ecom_referral_uses CASCADE")
    op.execute("DROP TABLE IF EXISTS ecom_referral_codes CASCADE")
    op.execute("DROP TABLE IF EXISTS ecom_blog_posts CASCADE")
    op.execute("DROP TABLE IF EXISTS ecom_loyalty_tiers CASCADE")
    op.execute("DROP TABLE IF EXISTS ecom_b2b_company_members CASCADE")
    op.execute("DROP TABLE IF EXISTS ecom_b2b_companies CASCADE")
    op.execute("DROP TABLE IF EXISTS ecom_b2b_pricing_tiers CASCADE")
    op.execute("DROP TABLE IF EXISTS ecom_subscription_orders CASCADE")
    op.execute("DROP TABLE IF EXISTS ecom_subscriptions CASCADE")
    op.execute("DROP TABLE IF EXISTS ecom_loyalty_programs CASCADE")
    op.execute("DROP TABLE IF EXISTS ecom_currencies CASCADE")
    op.execute("DROP TABLE IF EXISTS ab_user_role CASCADE")
    op.execute("DROP TABLE IF EXISTS ab_user_group CASCADE")
    op.execute("DROP TABLE IF EXISTS ab_permission_view_role CASCADE")
    op.execute("DROP TABLE IF EXISTS ab_group_role CASCADE")
    op.execute("DROP TABLE IF EXISTS ab_permission_view CASCADE")
    op.execute("DROP TABLE IF EXISTS ab_group CASCADE")
    op.execute("DROP TABLE IF EXISTS ab_role CASCADE")
    op.execute("DROP TABLE IF EXISTS ab_permission CASCADE")
    op.execute("DROP TABLE IF EXISTS ab_view_menu CASCADE")
    op.execute("DROP TABLE IF EXISTS ab_user CASCADE")
    op.execute("DROP TABLE IF EXISTS ab_register_user CASCADE")
    op.execute("DROP TABLE IF EXISTS smart_folders CASCADE")  # renamed to mail_smart_folders



def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column('tickets', 'sentiment_label',
               existing_type=sa.String(length=30),
               type_=sa.VARCHAR(length=20),
               existing_nullable=True)
    op.alter_column('tickets', 'channel',
               existing_type=sa.VARCHAR(length=30),
               nullable=True)
    op.drop_constraint(None, 'sso_user_mappings', type_='foreignkey')
    op.drop_constraint(None, 'sso_user_mappings', type_='foreignkey')
    op.create_foreign_key('sso_user_mappings_provider_id_fkey', 'sso_user_mappings', 'sso_providers', ['provider_id'], ['id'])
    op.create_foreign_key('sso_user_mappings_user_id_fkey', 'sso_user_mappings', 'users', ['user_id'], ['id'])
    op.drop_constraint(None, 'sso_user_mappings', type_='unique')
    op.create_index('ix_sso_mapping_provider_ext', 'sso_user_mappings', ['provider_id', 'external_id'], unique=True)
    op.alter_column('sso_user_mappings', 'external_email',
               existing_type=sa.String(length=255),
               type_=sa.VARCHAR(length=320),
               nullable=True)
    op.alter_column('sso_providers', 'is_active',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('true'))
    op.alter_column('sso_providers', 'scopes',
               existing_type=sa.VARCHAR(length=500),
               nullable=True)
    op.alter_column('sso_providers', 'redirect_uri',
               existing_type=sa.VARCHAR(length=1000),
               nullable=True)
    op.alter_column('sso_providers', 'userinfo_url',
               existing_type=sa.VARCHAR(length=1000),
               nullable=True)
    op.alter_column('sso_providers', 'token_url',
               existing_type=sa.VARCHAR(length=1000),
               nullable=True)
    op.alter_column('sso_providers', 'authorization_url',
               existing_type=sa.VARCHAR(length=1000),
               nullable=True)
    op.alter_column('sso_providers', 'client_secret',
               existing_type=sa.Text(),
               type_=sa.VARCHAR(length=1000),
               comment=None,
               existing_comment='Encrypted with Fernet',
               existing_nullable=False)
    op.alter_column('sso_providers', 'provider_type',
               existing_type=sa.Enum('google', 'microsoft', 'github', 'custom_oidc', name='sso_provider_type_enum', create_constraint=True),
               type_=sa.VARCHAR(length=30),
               existing_nullable=False)
    op.alter_column('sso_providers', 'name',
               existing_type=sa.String(length=150),
               type_=sa.VARCHAR(length=200),
               existing_nullable=False)
    op.create_index('ix_sc_workflow_templates_trigger_event', 'sc_workflow_templates', ['trigger_event'], unique=False)
    op.create_index('ix_sc_workflow_steps_run_id', 'sc_workflow_steps', ['run_id'], unique=False)
    op.create_index('ix_sc_workflow_runs_template_id', 'sc_workflow_runs', ['template_id'], unique=False)
    op.create_index('ix_sc_workflow_runs_status', 'sc_workflow_runs', ['status'], unique=False)
    op.create_index('ix_sc_supply_plans_status', 'sc_supply_plans', ['status'], unique=False)
    op.create_index('ix_sc_supply_plans_sop_id', 'sc_supply_plans', ['sop_id'], unique=False)
    op.create_index('ix_sc_supply_plan_lines_plan_id', 'sc_supply_plan_lines', ['plan_id'], unique=False)
    op.create_index('ix_sc_supply_plan_lines_item_id', 'sc_supply_plan_lines', ['item_id'], unique=False)
    op.create_index('ix_sc_suppliers_code', 'sc_suppliers', ['code'], unique=False)
    op.alter_column('sc_suppliers', 'is_active',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('true'))
    op.alter_column('sc_suppliers', 'payment_terms_days',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('30'))
    op.create_index('ix_sc_supplier_risks_supplier_id', 'sc_supplier_risks', ['supplier_id'], unique=False)
    op.create_index('ix_sc_supplier_risks_severity', 'sc_supplier_risks', ['severity'], unique=False)
    op.alter_column('sc_supplier_returns', 'total_value',
               existing_type=sa.NUMERIC(precision=14, scale=2),
               nullable=True,
               existing_server_default=sa.text("'0'::numeric"))
    op.alter_column('sc_supplier_returns', 'status',
               existing_type=sa.VARCHAR(length=30),
               nullable=True,
               existing_server_default=sa.text("'draft'::character varying"))
    op.create_index('ix_sc_stock_health_scores_item_id', 'sc_stock_health_scores', ['item_id'], unique=False)
    op.create_index('ix_sc_stock_health_scores_health_status', 'sc_stock_health_scores', ['health_status'], unique=False)
    op.create_index('ix_sc_sop_plans_status', 'sc_sop_plans', ['status'], unique=False)
    op.create_index('ix_sc_sop_plans_period_start', 'sc_sop_plans', ['period_start'], unique=False)
    op.create_index('ix_sc_safety_stock_configs_item_id', 'sc_safety_stock_configs', ['item_id'], unique=False)
    op.create_index('ix_sc_rfx_responses_supplier_id', 'sc_rfx_responses', ['supplier_id'], unique=False)
    op.create_index('ix_sc_rfx_responses_rfx_id', 'sc_rfx_responses', ['rfx_id'], unique=False)
    op.create_index('ix_sc_rfx_status', 'sc_rfx', ['status'], unique=False)
    op.create_index('ix_sc_rfx_rfx_type', 'sc_rfx', ['rfx_type'], unique=False)
    op.create_index('ix_sc_requisitions_status', 'sc_requisitions', ['status'], unique=False)
    op.alter_column('sc_requisitions', 'total_estimated',
               existing_type=sa.NUMERIC(precision=14, scale=2),
               nullable=True,
               existing_server_default=sa.text("'0'::numeric"))
    op.alter_column('sc_requisitions', 'priority',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_server_default=sa.text("'medium'::character varying"))
    op.alter_column('sc_requisitions', 'status',
               existing_type=sa.VARCHAR(length=30),
               nullable=True,
               existing_server_default=sa.text("'draft'::character varying"))
    op.alter_column('sc_requisition_lines', 'estimated_unit_price',
               existing_type=sa.NUMERIC(precision=12, scale=2),
               nullable=True,
               existing_server_default=sa.text("'0'::numeric"))
    op.create_index('ix_sc_replenishment_rules_warehouse_id', 'sc_replenishment_rules', ['warehouse_id'], unique=False)
    op.create_index('ix_sc_replenishment_rules_item_id', 'sc_replenishment_rules', ['item_id'], unique=False)
    op.create_index('ix_sc_kpis_period', 'sc_kpis', ['period'], unique=False)
    op.create_index('ix_sc_kpis_kpi_name', 'sc_kpis', ['kpi_name'], unique=False)
    op.alter_column('sc_grn_lines', 'rejected_quantity',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.create_index('ix_sc_grn_po', 'sc_goods_received_notes', ['purchase_order_id'], unique=False)
    op.alter_column('sc_goods_received_notes', 'status',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_server_default=sa.text("'draft'::character varying"))
    op.create_index('ix_sc_forecast_scenarios_status', 'sc_forecast_scenarios', ['status'], unique=False)
    op.create_index('ix_sc_forecast_scenarios_created_by', 'sc_forecast_scenarios', ['created_by'], unique=False)
    op.create_index('ix_sc_events_occurred_at', 'sc_events', ['occurred_at'], unique=False)
    op.create_index('ix_sc_events_event_type', 'sc_events', ['event_type'], unique=False)
    op.create_index('ix_sc_esg_metrics_supplier_id', 'sc_esg_metrics', ['supplier_id'], unique=False)
    op.create_index('ix_sc_esg_metrics_period', 'sc_esg_metrics', ['period'], unique=False)
    op.create_index('ix_sc_esg_metrics_metric_type', 'sc_esg_metrics', ['metric_type'], unique=False)
    op.create_index('ix_sc_demand_signals_signal_type', 'sc_demand_signals', ['signal_type'], unique=False)
    op.create_index('ix_sc_demand_signals_item_id', 'sc_demand_signals', ['item_id'], unique=False)
    op.create_index('ix_sc_demand_forecasts_scenario_id', 'sc_demand_forecasts', ['scenario_id'], unique=False)
    op.create_index('ix_sc_demand_forecasts_item_id', 'sc_demand_forecasts', ['item_id'], unique=False)
    op.create_index('ix_sc_demand_forecasts_forecast_date', 'sc_demand_forecasts', ['forecast_date'], unique=False)
    op.create_index('ix_sc_control_tower_alerts_status', 'sc_control_tower_alerts', ['status'], unique=False)
    op.create_index('ix_sc_control_tower_alerts_severity', 'sc_control_tower_alerts', ['severity'], unique=False)
    op.create_index('ix_sc_control_tower_alerts_alert_type', 'sc_control_tower_alerts', ['alert_type'], unique=False)
    op.create_index('ix_sc_compliance_records_status', 'sc_compliance_records', ['status'], unique=False)
    op.create_index('ix_sc_compliance_records_entity_type', 'sc_compliance_records', ['entity_type'], unique=False)
    op.create_index('ix_sc_capacity_plans_sop_id', 'sc_capacity_plans', ['sop_id'], unique=False)
    op.alter_column('project_tasks', 'parent_id',
               existing_type=sa.UUID(),
               comment=None,
               existing_comment='Subtask parent; NULL = top-level task',
               existing_nullable=True)
    op.add_column('project_task_relationships', sa.Column('created_by', sa.UUID(), autoincrement=False, nullable=True))
    op.create_foreign_key('project_task_relationships_created_by_fkey', 'project_task_relationships', 'users', ['created_by'], ['id'], ondelete='SET NULL')
    op.drop_index(op.f('ix_project_task_relationships_target_task_id'), table_name='project_task_relationships')
    op.drop_index(op.f('ix_project_task_relationships_source_task_id'), table_name='project_task_relationships')
    op.create_unique_constraint('uq_task_relationship', 'project_task_relationships', ['source_task_id', 'target_task_id', 'relationship_type'])
    op.create_index('ix_project_task_relationships_target', 'project_task_relationships', ['target_task_id'], unique=False)
    op.create_index('ix_project_task_relationships_source', 'project_task_relationships', ['source_task_id'], unique=False)
    op.alter_column('project_task_relationships', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True)
    op.alter_column('project_task_relationships', 'relationship_type',
               existing_type=sa.VARCHAR(length=30),
               comment=None,
               existing_comment='blocks | is_blocked_by | duplicates | is_duplicated_by | relates_to',
               existing_nullable=False)
    op.drop_index(op.f('ix_project_task_custom_field_values_field_id'), table_name='project_task_custom_field_values')
    op.add_column('project_task_comments', sa.Column('body', sa.TEXT(), autoincrement=False, nullable=False))
    op.drop_index(op.f('ix_project_task_comments_parent_id'), table_name='project_task_comments')
    op.drop_index(op.f('ix_project_task_comments_author_id'), table_name='project_task_comments')
    op.alter_column('project_task_comments', 'mentions',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               comment=None,
               existing_comment='Array of mentioned user IDs',
               existing_nullable=True)
    op.alter_column('project_task_comments', 'content',
               existing_type=sa.TEXT(),
               nullable=True)
    op.add_column('project_task_checklists', sa.Column('due_date', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True))
    op.add_column('project_task_checklists', sa.Column('assignee_id', sa.UUID(), autoincrement=False, nullable=True))
    op.add_column('project_task_checklists', sa.Column('is_done', sa.BOOLEAN(), server_default=sa.text('false'), autoincrement=False, nullable=False))
    op.drop_constraint(None, 'project_task_checklists', type_='foreignkey')
    op.create_foreign_key('project_task_checklists_assignee_id_fkey', 'project_task_checklists', 'users', ['assignee_id'], ['id'], ondelete='SET NULL')
    op.alter_column('project_task_checklists', 'is_completed',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
    op.create_index('ix_project_task_audit_log_created_at', 'project_task_audit_log', ['created_at'], unique=False)
    op.alter_column('project_task_audit_log', 'changes',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               type_=postgresql.JSON(astext_type=sa.Text()),
               comment=None,
               existing_comment='{field: {old: ..., new: ...}}',
               existing_nullable=True)
    op.alter_column('project_task_audit_log', 'action',
               existing_type=sa.VARCHAR(length=50),
               comment=None,
               existing_comment='created | updated | status_changed | assigned | commented | checklist_toggled | deleted',
               existing_nullable=False)
    op.alter_column('project_sprints', 'status',
               existing_type=sa.VARCHAR(length=20),
               comment=None,
               existing_comment='planning | active | completed',
               existing_nullable=False,
               existing_server_default=sa.text("'planning'::character varying"))
    op.add_column('project_recurring_configs', sa.Column('tags', postgresql.ARRAY(sa.VARCHAR(length=100)), autoincrement=False, nullable=True))
    op.add_column('project_recurring_configs', sa.Column('frequency', sa.VARCHAR(length=20), autoincrement=False, nullable=False))
    op.add_column('project_recurring_configs', sa.Column('interval', sa.INTEGER(), server_default=sa.text('1'), autoincrement=False, nullable=False))
    op.add_column('project_recurring_configs', sa.Column('description', sa.TEXT(), autoincrement=False, nullable=True))
    op.add_column('project_recurring_configs', sa.Column('priority', sa.VARCHAR(length=20), server_default=sa.text("'medium'::character varying"), autoincrement=False, nullable=False))
    op.add_column('project_recurring_configs', sa.Column('estimated_hours', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True))
    op.add_column('project_recurring_configs', sa.Column('assignee_id', sa.UUID(), autoincrement=False, nullable=True))
    op.add_column('project_recurring_configs', sa.Column('title', sa.VARCHAR(length=500), autoincrement=False, nullable=False))
    op.drop_constraint(None, 'project_recurring_configs', type_='foreignkey')
    op.create_foreign_key('project_recurring_configs_assignee_id_fkey', 'project_recurring_configs', 'users', ['assignee_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('project_recurring_configs_created_by_fkey', 'project_recurring_configs', 'users', ['created_by'], ['id'], ondelete='SET NULL')
    op.alter_column('project_recurring_configs', 'created_by',
               existing_type=sa.UUID(),
               nullable=True)
    op.alter_column('project_recurring_configs', 'cron_expression',
               existing_type=sa.VARCHAR(length=100),
               comment=None,
               existing_comment='For custom recurrence',
               existing_nullable=True)
    op.alter_column('project_recurring_configs', 'day_of_week',
               existing_type=sa.INTEGER(),
               comment=None,
               existing_comment='0=Mon..6=Sun',
               existing_nullable=True)
    op.alter_column('project_recurring_configs', 'recurrence_interval',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('1'))
    op.alter_column('project_recurring_configs', 'recurrence_type',
               existing_type=sa.String(length=20),
               type_=sa.VARCHAR(length=30),
               nullable=True,
               comment=None,
               existing_comment='daily | weekly | monthly | custom')
    op.alter_column('project_recurring_configs', 'template_task',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               nullable=True,
               comment=None,
               existing_comment='Task template: {title, description, status, priority, assignee_id, tags}')
    op.add_column('project_guest_access', sa.Column('is_active', sa.BOOLEAN(), server_default=sa.text('true'), autoincrement=False, nullable=False))
    op.add_column('project_guest_access', sa.Column('role', sa.VARCHAR(length=20), server_default=sa.text("'viewer'::character varying"), autoincrement=False, nullable=False))
    op.drop_constraint(None, 'project_guest_access', type_='foreignkey')
    op.create_foreign_key('project_guest_access_invited_by_fkey', 'project_guest_access', 'users', ['invited_by'], ['id'], ondelete='SET NULL')
    op.alter_column('project_guest_access', 'invited_by',
               existing_type=sa.UUID(),
               nullable=True)
    op.alter_column('project_guest_access', 'permissions',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               comment=None,
               existing_comment='{can_comment: true, can_view_tasks: true, can_edit_tasks: false}',
               existing_nullable=True)
    op.alter_column('project_guest_access', 'token',
               existing_type=sa.String(length=255),
               type_=sa.VARCHAR(length=64),
               existing_nullable=False)
    op.alter_column('project_documents', 'doc_type',
               existing_type=sa.VARCHAR(length=30),
               comment=None,
               existing_comment='document | spreadsheet | presentation',
               existing_nullable=False,
               existing_server_default=sa.text("'document'::character varying"))
    op.add_column('project_custom_fields', sa.Column('created_by', sa.UUID(), autoincrement=False, nullable=True))
    op.create_foreign_key('project_custom_fields_created_by_fkey', 'project_custom_fields', 'users', ['created_by'], ['id'], ondelete='SET NULL')
    op.alter_column('project_custom_fields', 'order',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('project_custom_fields', 'default_value',
               existing_type=sa.String(length=500),
               type_=sa.TEXT(),
               existing_nullable=True)
    op.alter_column('project_custom_fields', 'options',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               type_=postgresql.JSON(astext_type=sa.Text()),
               comment=None,
               existing_comment='Dropdown choices, formula expression, etc.',
               existing_nullable=True)
    op.alter_column('project_custom_fields', 'field_type',
               existing_type=sa.String(length=30),
               type_=sa.VARCHAR(length=20),
               comment=None,
               existing_comment='text | number | dropdown | date | formula',
               existing_nullable=False)
    op.alter_column('project_custom_fields', 'name',
               existing_type=sa.String(length=200),
               type_=sa.VARCHAR(length=100),
               existing_nullable=False)
    op.add_column('project_automation_rules', sa.Column('trigger', sa.VARCHAR(length=50), autoincrement=False, nullable=False))
    op.add_column('project_automation_rules', sa.Column('action', sa.VARCHAR(length=50), autoincrement=False, nullable=False))
    op.drop_constraint(None, 'project_automation_rules', type_='foreignkey')
    op.create_foreign_key('project_automation_rules_created_by_fkey', 'project_automation_rules', 'users', ['created_by'], ['id'], ondelete='SET NULL')
    op.alter_column('project_automation_rules', 'created_by',
               existing_type=sa.UUID(),
               nullable=True)
    op.alter_column('project_automation_rules', 'execution_count',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('project_automation_rules', 'action_config',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               type_=postgresql.JSON(astext_type=sa.Text()),
               nullable=False,
               comment=None,
               existing_comment='E.g. {user_id: "...", status: "..."}')
    op.alter_column('project_automation_rules', 'action_type',
               existing_type=sa.VARCHAR(length=50),
               nullable=True,
               comment=None,
               existing_comment='assign_user | send_notification | move_to_status | create_subtask | add_tag')
    op.alter_column('project_automation_rules', 'trigger_config',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               type_=postgresql.JSON(astext_type=sa.Text()),
               nullable=False,
               comment=None,
               existing_comment='E.g. {from_status: "todo", to_status: "done"}')
    op.alter_column('project_automation_rules', 'trigger_type',
               existing_type=sa.VARCHAR(length=50),
               nullable=True,
               comment=None,
               existing_comment='status_change | due_date_reached | assignment_change | task_created | priority_change')
    op.alter_column('project_automation_rules', 'name',
               existing_type=sa.String(length=300),
               type_=sa.VARCHAR(length=200),
               existing_nullable=False)
    op.create_index('ix_pos_transactions_session', 'pos_transactions', ['session_id'], unique=False)
    op.create_index('ix_pos_transactions_created_at', 'pos_transactions', ['created_at'], unique=False)
    op.drop_constraint(None, 'pos_transaction_lines', type_='foreignkey')
    op.drop_constraint(None, 'pos_transaction_lines', type_='foreignkey')
    op.drop_constraint(None, 'pos_transaction_lines', type_='foreignkey')
    op.create_index('ix_pos_transaction_lines_txn', 'pos_transaction_lines', ['transaction_id'], unique=False)
    op.alter_column('pos_tip_pools', 'distribution_method',
               existing_type=sa.String(length=30),
               type_=sa.VARCHAR(length=50),
               existing_nullable=False,
               existing_server_default=sa.text("'equal'::character varying"))
    op.alter_column('pos_tip_pools', 'total_tips',
               existing_type=sa.Numeric(precision=15, scale=2),
               type_=sa.NUMERIC(precision=12, scale=2),
               existing_nullable=False,
               existing_server_default=sa.text('0'))
    op.alter_column('pos_store_credits', 'balance',
               existing_type=sa.Numeric(precision=15, scale=2),
               type_=sa.NUMERIC(precision=12, scale=2),
               existing_nullable=False,
               existing_server_default=sa.text('0'))
    op.alter_column('pos_store_credit_transactions', 'reason',
               existing_type=sa.VARCHAR(length=200),
               nullable=True)
    op.alter_column('pos_store_credit_transactions', 'balance_after',
               existing_type=sa.Numeric(precision=15, scale=2),
               type_=sa.NUMERIC(precision=12, scale=2),
               existing_nullable=False)
    op.alter_column('pos_store_credit_transactions', 'amount',
               existing_type=sa.Numeric(precision=15, scale=2),
               type_=sa.NUMERIC(precision=12, scale=2),
               existing_nullable=False)
    op.drop_constraint(None, 'pos_sessions', type_='foreignkey')
    op.create_index('ix_pos_sessions_cashier_status', 'pos_sessions', ['cashier_id', 'status'], unique=False)
    op.drop_constraint(None, 'pos_product_modifier_links', type_='foreignkey')
    op.drop_constraint(None, 'pos_product_modifier_links', type_='foreignkey')
    op.create_foreign_key('pos_product_modifier_links_modifier_group_id_fkey', 'pos_product_modifier_links', 'pos_modifier_groups', ['modifier_group_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('pos_product_modifier_links_item_id_fkey', 'pos_product_modifier_links', 'inventory_items', ['item_id'], ['id'], ondelete='CASCADE')
    op.drop_constraint(None, 'pos_pickup_orders', type_='foreignkey')
    op.drop_constraint(None, 'pos_pickup_orders', type_='foreignkey')
    op.alter_column('pos_pickup_orders', 'status',
               existing_type=sa.String(length=30),
               type_=sa.VARCHAR(length=20),
               existing_nullable=False,
               existing_server_default=sa.text("'pending'::character varying"))
    op.create_index('ix_pos_payments_txn', 'pos_payments', ['transaction_id'], unique=False)
    op.add_column('pos_payment_gateway_configs', sa.Column('gateway_type', sa.VARCHAR(length=50), autoincrement=False, nullable=False))
    op.add_column('pos_payment_gateway_configs', sa.Column('config', postgresql.JSON(astext_type=sa.Text()), autoincrement=False, nullable=True))
    op.drop_constraint(None, 'pos_payment_gateway_configs', type_='foreignkey')
    op.alter_column('pos_payment_gateway_configs', 'config_overrides',
               existing_type=postgresql.JSON(astext_type=sa.Text()),
               type_=postgresql.JSONB(astext_type=sa.Text()),
               existing_nullable=True)
    op.alter_column('pos_payment_gateway_configs', 'gateway_id',
               existing_type=sa.UUID(),
               type_=sa.VARCHAR(length=100),
               nullable=True)
    op.drop_constraint(None, 'pos_modifiers', type_='foreignkey')
    op.create_foreign_key('pos_modifiers_group_id_fkey', 'pos_modifiers', 'pos_modifier_groups', ['group_id'], ['id'], ondelete='CASCADE')
    op.alter_column('pos_modifier_groups', 'max_selections',
               existing_type=sa.INTEGER(),
               nullable=True)
    op.drop_constraint(None, 'pos_gift_cards', type_='foreignkey')
    op.create_foreign_key('fk_pos_gift_cards_issued_by', 'pos_gift_cards', 'users', ['issued_by'], ['id'], ondelete='SET NULL')
    op.alter_column('pos_gift_cards', 'issued_by',
               existing_type=sa.UUID(),
               nullable=True)
    op.alter_column('pos_gift_cards', 'current_balance',
               existing_type=sa.Numeric(precision=15, scale=2),
               type_=sa.NUMERIC(precision=12, scale=2),
               existing_nullable=False)
    op.alter_column('pos_gift_cards', 'original_amount',
               existing_type=sa.Numeric(precision=15, scale=2),
               type_=sa.NUMERIC(precision=12, scale=2),
               existing_nullable=False)
    op.alter_column('pos_gift_card_transactions', 'balance_after',
               existing_type=sa.Numeric(precision=15, scale=2),
               type_=sa.NUMERIC(precision=12, scale=2),
               existing_nullable=False)
    op.alter_column('pos_gift_card_transactions', 'amount',
               existing_type=sa.Numeric(precision=15, scale=2),
               type_=sa.NUMERIC(precision=12, scale=2),
               existing_nullable=False)
    op.alter_column('pos_commissions', 'rule_id',
               existing_type=sa.UUID(),
               nullable=True)
    op.alter_column('pos_commissions', 'transaction_id',
               existing_type=sa.UUID(),
               nullable=True)
    op.alter_column('pos_commissions', 'session_id',
               existing_type=sa.UUID(),
               nullable=True)
    op.alter_column('pos_commission_rules', 'value',
               existing_type=sa.Numeric(precision=12, scale=2),
               type_=sa.NUMERIC(precision=10, scale=4),
               nullable=True)
    op.alter_column('pos_commission_rules', 'rule_type',
               existing_type=sa.String(length=30),
               type_=sa.VARCHAR(length=20),
               existing_nullable=False,
               existing_server_default=sa.text("'percentage'::character varying"))
    op.alter_column('pos_bundles', 'bundle_price',
               existing_type=sa.Numeric(precision=15, scale=2),
               type_=sa.NUMERIC(precision=12, scale=2),
               existing_nullable=False)
    op.drop_constraint(None, 'pos_bundle_items', type_='foreignkey')
    op.create_foreign_key('pos_bundle_items_bundle_id_fkey', 'pos_bundle_items', 'pos_bundles', ['bundle_id'], ['id'], ondelete='CASCADE')
    op.alter_column('notes', 'source_type',
               existing_type=sa.VARCHAR(length=30),
               comment=None,
               existing_comment='manual | voice | meeting | auto_created | web_clip | email',
               existing_nullable=False,
               existing_server_default=sa.text("'manual'::character varying"))
    op.alter_column('notes', 'properties',
               existing_type=postgresql.JSON(astext_type=sa.Text()),
               comment=None,
               existing_comment='Notion-style page properties: {property_name: value}',
               existing_nullable=True)
    op.alter_column('notes', 'linked_items',
               existing_type=postgresql.JSON(astext_type=sa.Text()),
               comment=None,
               existing_comment='JSON array of cross-module links',
               existing_nullable=True,
               existing_server_default=sa.text("'[]'::json"))
    op.alter_column('notes', 'content_format',
               existing_type=sa.VARCHAR(length=20),
               comment=None,
               existing_comment='html | tiptap_json',
               existing_nullable=False,
               existing_server_default=sa.text("'html'::character varying"))
    op.alter_column('note_templates', 'is_system',
               existing_type=sa.BOOLEAN(),
               comment=None,
               existing_comment='Pre-built system template',
               existing_nullable=False,
               existing_server_default=sa.text('false'))
    op.alter_column('note_templates', 'erp_merge_fields',
               existing_type=postgresql.JSON(astext_type=sa.Text()),
               comment=None,
               existing_comment='ERP merge field mappings: {"{{field}}": {"module": "...", "query": "..."}}',
               existing_nullable=True)
    op.alter_column('note_templates', 'content_tiptap_json',
               existing_type=sa.TEXT(),
               comment=None,
               existing_comment='TipTap JSON content for block editor templates',
               existing_nullable=True)
    op.alter_column('note_shares', 'permission',
               existing_type=sa.VARCHAR(length=10),
               comment='view | edit',
               existing_comment='view | edit | comment',
               existing_nullable=False)
    op.alter_column('note_sensitivity_labels', 'restrictions',
               existing_type=postgresql.JSON(astext_type=sa.Text()),
               comment=None,
               existing_comment='{"prevent_share": bool, "prevent_export": bool, "prevent_print": bool, "watermark": bool, "auto_expire_days": int|null}',
               existing_nullable=False,
               existing_server_default=sa.text("'{}'::jsonb"))
    op.alter_column('note_sensitivity_labels', 'level',
               existing_type=sa.INTEGER(),
               comment=None,
               existing_comment='0=public, 1=internal, 2=confidential, 3=restricted',
               existing_nullable=False)
    op.alter_column('note_entity_links', 'link_type',
               existing_type=sa.VARCHAR(length=30),
               comment=None,
               existing_comment='references | created_from | related_to | action_item',
               existing_nullable=False,
               existing_server_default=sa.text("'references'::character varying"))
    op.alter_column('note_entity_links', 'entity_type',
               existing_type=sa.VARCHAR(length=50),
               comment=None,
               existing_comment='contact | deal | invoice | project | task | ticket | employee | meeting | file | lead | calendar',
               existing_nullable=False)
    op.alter_column('note_comments', 'anchor_text',
               existing_type=sa.VARCHAR(length=500),
               comment=None,
               existing_comment='Quoted text the comment refers to',
               existing_nullable=True)
    op.alter_column('note_comments', 'anchor_block_id',
               existing_type=sa.VARCHAR(length=100),
               comment=None,
               existing_comment='TipTap node ID for inline comment anchoring',
               existing_nullable=True)
    op.alter_column('note_audit_logs', 'action',
               existing_type=sa.VARCHAR(length=50),
               comment=None,
               existing_comment='created | updated | deleted | shared | unshared | viewed | exported | printed | moved | version_restored | ai_generated',
               existing_nullable=False)
    op.alter_column('mfg_workstations', 'current_status',
               existing_type=sa.String(length=20),
               type_=sa.VARCHAR(length=30),
               existing_nullable=False,
               existing_server_default=sa.text("'idle'::character varying"))
    op.alter_column('mfg_workstations', 'is_active',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('true'))
    op.alter_column('mfg_workstations', 'hourly_rate',
               existing_type=sa.NUMERIC(precision=10, scale=2),
               nullable=True,
               existing_server_default=sa.text("'0'::numeric"))
    op.drop_constraint(None, 'mfg_work_orders', type_='foreignkey')
    op.create_index('ix_mfg_wo_status', 'mfg_work_orders', ['status'], unique=False)
    op.create_index('ix_mfg_wo_bom', 'mfg_work_orders', ['bom_id'], unique=False)
    op.alter_column('mfg_work_orders', 'consumption_mode',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_server_default=sa.text("'at_start'::character varying"))
    op.alter_column('mfg_work_orders', 'total_labor_cost',
               existing_type=sa.NUMERIC(precision=14, scale=2),
               nullable=True,
               existing_server_default=sa.text("'0'::numeric"))
    op.alter_column('mfg_work_orders', 'total_material_cost',
               existing_type=sa.NUMERIC(precision=14, scale=2),
               nullable=True,
               existing_server_default=sa.text("'0'::numeric"))
    op.alter_column('mfg_work_orders', 'priority',
               existing_type=sa.VARCHAR(length=10),
               nullable=True,
               existing_server_default=sa.text("'medium'::character varying"))
    op.alter_column('mfg_work_orders', 'status',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_server_default=sa.text("'draft'::character varying"))
    op.alter_column('mfg_work_orders', 'rejected_quantity',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('mfg_work_orders', 'completed_quantity',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('mfg_routing_steps', 'barcode_scan_required',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
    op.alter_column('mfg_routing_steps', 'instruction_media',
               existing_type=postgresql.JSON(astext_type=sa.Text()),
               type_=postgresql.JSONB(astext_type=sa.Text()),
               existing_nullable=True)
    op.alter_column('mfg_routing_steps', 'min_operators',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('1'))
    op.alter_column('mfg_quality_checks', 'status',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_server_default=sa.text("'pending'::character varying"))
    op.alter_column('mfg_material_consumption', 'actual_quantity',
               existing_type=sa.NUMERIC(precision=12, scale=4),
               nullable=True,
               existing_server_default=sa.text("'0'::numeric"))
    op.drop_constraint(None, 'mfg_maintenance_schedules', type_='foreignkey')
    op.alter_column('mfg_maintenance_schedules', 'trigger_threshold',
               existing_type=sa.Numeric(precision=12, scale=2),
               type_=sa.DOUBLE_PRECISION(precision=53),
               existing_nullable=True)
    op.alter_column('mfg_maintenance_schedules', 'trigger_type',
               existing_type=sa.String(length=20),
               type_=sa.VARCHAR(length=30),
               nullable=True)
    op.alter_column('mfg_bom_items', 'is_phantom',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
    op.alter_column('mfg_bom_items', 'sort_order',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('mfg_bom_items', 'scrap_percentage',
               existing_type=sa.NUMERIC(precision=5, scale=2),
               nullable=True,
               existing_server_default=sa.text("'0'::numeric"))
    op.alter_column('mfg_bom_items', 'unit_of_measure',
               existing_type=sa.VARCHAR(length=50),
               nullable=True,
               existing_server_default=sa.text("'unit'::character varying"))
    op.alter_column('mfg_bom', 'is_default',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
    op.alter_column('mfg_bom', 'is_active',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('true'))
    op.alter_column('mfg_bom', 'version',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('1'))
    op.alter_column('mfg_bom', 'quantity_produced',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('1'))
    op.create_index('ix_meeting_links_meeting_type', 'meeting_links', ['meeting_id', 'link_type'], unique=False)
    op.create_index('ix_mailbox_messages_priority_score', 'mailbox_messages', ['priority_score'], unique=False)
    op.alter_column('mailbox_messages', 'ai_category',
               existing_type=sa.VARCHAR(length=50),
               comment=None,
               existing_comment='finance-invoice, support-request, deal-related, project-update, personal, newsletter, spam-suspect',
               existing_nullable=True)
    op.alter_column('mailbox_messages', 'flag_status',
               existing_type=sa.VARCHAR(length=20),
               comment=None,
               existing_comment='none, flagged, complete',
               existing_nullable=False,
               existing_server_default=sa.text("'none'::character varying"))
    op.alter_column('mailbox_messages', 'attachments',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               comment=None,
               existing_comment='List of {filename, content_type, size, storage_key} dicts',
               existing_nullable=False,
               existing_server_default=sa.text("'[]'::jsonb"))
    op.drop_constraint(None, 'loyalty_tiers', type_='foreignkey')
    op.create_foreign_key('loyalty_tiers_program_id_fkey', 'loyalty_tiers', 'loyalty_programs', ['program_id'], ['id'], ondelete='CASCADE')
    op.drop_constraint(None, 'loyalty_rewards', type_='foreignkey')
    op.create_foreign_key('loyalty_rewards_program_id_fkey', 'loyalty_rewards', 'loyalty_programs', ['program_id'], ['id'], ondelete='CASCADE')
    op.drop_index(op.f('ix_licenses_license_key'), table_name='licenses')
    op.create_unique_constraint('licenses_license_key_key', 'licenses', ['license_key'])
    op.alter_column('licenses', 'is_active',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('true'))
    op.alter_column('licenses', 'issued_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('licenses', 'features',
               existing_type=postgresql.JSON(astext_type=sa.Text()),
               nullable=True,
               existing_server_default=sa.text("'{}'::json"))
    op.alter_column('licenses', 'license_type',
               existing_type=sa.Enum('trial', 'standard', 'professional', 'enterprise', name='license_type_enum', create_constraint=True),
               type_=sa.VARCHAR(length=30),
               existing_nullable=False,
               existing_server_default=sa.text("'trial'::character varying"))
    op.alter_column('licenses', 'license_key',
               existing_type=sa.String(length=255),
               type_=sa.VARCHAR(length=500),
               existing_nullable=False)
    op.alter_column('kds_orders', 'status',
               existing_type=sa.String(length=30),
               type_=sa.VARCHAR(length=20),
               existing_nullable=False,
               existing_server_default=sa.text("'new'::character varying"))
    op.drop_constraint(None, 'kds_order_items', type_='foreignkey')
    op.drop_constraint(None, 'kds_order_items', type_='foreignkey')
    op.create_foreign_key('kds_order_items_kds_order_id_fkey', 'kds_order_items', 'kds_orders', ['kds_order_id'], ['id'], ondelete='CASCADE')
    op.alter_column('kds_order_items', 'status',
               existing_type=sa.String(length=30),
               type_=sa.VARCHAR(length=20),
               existing_nullable=False,
               existing_server_default=sa.text("'pending'::character varying"))
    op.drop_constraint(None, 'hr_workforce_scenarios', type_='foreignkey')
    op.drop_constraint(None, 'hr_workforce_scenarios', type_='foreignkey')
    op.create_foreign_key('hr_workforce_scenarios_approved_by_fkey', 'hr_workforce_scenarios', 'users', ['approved_by'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('hr_workforce_scenarios_created_by_fkey', 'hr_workforce_scenarios', 'users', ['created_by'], ['id'], ondelete='RESTRICT')
    op.create_index('ix_hr_workforce_scenarios_is_approved', 'hr_workforce_scenarios', ['is_approved'], unique=False)
    op.create_index('ix_hr_workforce_scenarios_fiscal_year', 'hr_workforce_scenarios', ['fiscal_year'], unique=False)
    op.create_index('ix_hr_workforce_scenarios_created_by', 'hr_workforce_scenarios', ['created_by'], unique=False)
    op.drop_constraint(None, 'hr_workflows', type_='foreignkey')
    op.create_foreign_key('hr_workflows_created_by_fkey', 'hr_workflows', 'users', ['created_by'], ['id'], ondelete='RESTRICT')
    op.create_index('ix_hr_workflows_trigger_type', 'hr_workflows', ['trigger_type'], unique=False)
    op.create_index('ix_hr_workflows_is_active', 'hr_workflows', ['is_active'], unique=False)
    op.create_index('ix_hr_workflows_category', 'hr_workflows', ['category'], unique=False)
    op.drop_constraint(None, 'hr_workflow_executions', type_='foreignkey')
    op.drop_constraint(None, 'hr_workflow_executions', type_='foreignkey')
    op.create_foreign_key('hr_workflow_executions_workflow_id_fkey', 'hr_workflow_executions', 'hr_workflows', ['workflow_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('hr_workflow_executions_triggered_by_fkey', 'hr_workflow_executions', 'users', ['triggered_by'], ['id'], ondelete='SET NULL')
    op.create_index('ix_hr_workflow_executions_workflow_id', 'hr_workflow_executions', ['workflow_id'], unique=False)
    op.create_index('ix_hr_workflow_executions_status', 'hr_workflow_executions', ['status'], unique=False)
    op.create_index('ix_hr_workflow_executions_started_at', 'hr_workflow_executions', ['started_at'], unique=False)
    op.drop_constraint(None, 'hr_workflow_approvals', type_='foreignkey')
    op.drop_constraint(None, 'hr_workflow_approvals', type_='foreignkey')
    op.create_foreign_key('hr_workflow_approvals_approver_id_fkey', 'hr_workflow_approvals', 'users', ['approver_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('hr_workflow_approvals_execution_id_fkey', 'hr_workflow_approvals', 'hr_workflow_executions', ['execution_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_hr_workflow_approvals_status', 'hr_workflow_approvals', ['status'], unique=False)
    op.create_index('ix_hr_workflow_approvals_execution_id', 'hr_workflow_approvals', ['execution_id'], unique=False)
    op.create_index('ix_hr_workflow_approvals_approver_id', 'hr_workflow_approvals', ['approver_id'], unique=False)
    op.alter_column('hr_tax_brackets', 'rate',
               existing_type=sa.Numeric(precision=5, scale=4),
               type_=sa.NUMERIC(precision=8, scale=4),
               existing_nullable=False)
    op.alter_column('hr_tax_brackets', 'country_code',
               existing_type=sa.String(length=3),
               type_=sa.VARCHAR(length=5),
               nullable=True,
               existing_server_default=sa.text("'KE'::character varying"))
    op.drop_constraint(None, 'hr_surveys', type_='foreignkey')
    op.create_foreign_key('hr_surveys_created_by_fkey', 'hr_surveys', 'users', ['created_by'], ['id'], ondelete='RESTRICT')
    op.create_index('ix_hr_surveys_type', 'hr_surveys', ['survey_type'], unique=False)
    op.create_index('ix_hr_surveys_status', 'hr_surveys', ['status'], unique=False)
    op.drop_constraint(None, 'hr_survey_responses', type_='foreignkey')
    op.drop_constraint(None, 'hr_survey_responses', type_='foreignkey')
    op.create_foreign_key('hr_survey_responses_survey_id_fkey', 'hr_survey_responses', 'hr_surveys', ['survey_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('hr_survey_responses_respondent_id_fkey', 'hr_survey_responses', 'hr_employees', ['respondent_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_hr_survey_responses_survey_id', 'hr_survey_responses', ['survey_id'], unique=False)
    op.create_index('ix_hr_succession_plans_department_id', 'hr_succession_plans', ['department_id'], unique=False)
    op.alter_column('hr_statutory_deductions', 'is_active',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('true'))
    op.alter_column('hr_statutory_deductions', 'value',
               existing_type=sa.Numeric(precision=14, scale=4),
               type_=sa.NUMERIC(precision=12, scale=4),
               existing_nullable=False)
    op.alter_column('hr_statutory_deductions', 'country_code',
               existing_type=sa.String(length=3),
               type_=sa.VARCHAR(length=5),
               nullable=True,
               existing_server_default=sa.text("'KE'::character varying"))
    op.drop_constraint(None, 'hr_skill_ontology', type_='foreignkey')
    op.create_foreign_key('fk_hr_skill_ontology_parent_id', 'hr_skill_ontology', 'hr_skill_ontology', ['parent_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_hr_skill_ontology_parent_id', 'hr_skill_ontology', ['parent_id'], unique=False)
    op.create_index('ix_hr_skill_ontology_category', 'hr_skill_ontology', ['category'], unique=False)
    op.drop_constraint(None, 'hr_shift_assignments', type_='foreignkey')
    op.create_foreign_key('hr_shift_assignments_employee_id_fkey', 'hr_shift_assignments', 'hr_employees', ['employee_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_hr_shift_assignments_employee_id', 'hr_shift_assignments', ['employee_id'], unique=False)
    op.create_index('ix_hr_shift_assignments_date', 'hr_shift_assignments', ['assignment_date'], unique=False)
    op.drop_constraint(None, 'hr_review_assignments', type_='foreignkey')
    op.drop_constraint(None, 'hr_review_assignments', type_='foreignkey')
    op.drop_constraint(None, 'hr_review_assignments', type_='foreignkey')
    op.create_foreign_key('hr_review_assignments_reviewer_id_fkey', 'hr_review_assignments', 'hr_employees', ['reviewer_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('hr_review_assignments_cycle_id_fkey', 'hr_review_assignments', 'hr_review_cycles', ['cycle_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('hr_review_assignments_reviewee_id_fkey', 'hr_review_assignments', 'hr_employees', ['reviewee_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_hr_review_assignments_reviewer_id', 'hr_review_assignments', ['reviewer_id'], unique=False)
    op.create_index('ix_hr_review_assignments_reviewee_id', 'hr_review_assignments', ['reviewee_id'], unique=False)
    op.create_index('ix_hr_review_assignments_cycle_id', 'hr_review_assignments', ['cycle_id'], unique=False)
    op.drop_constraint(None, 'hr_recognitions', type_='foreignkey')
    op.drop_constraint(None, 'hr_recognitions', type_='foreignkey')
    op.drop_constraint(None, 'hr_recognitions', type_='foreignkey')
    op.create_foreign_key('hr_recognitions_to_employee_id_fkey', 'hr_recognitions', 'hr_employees', ['to_employee_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('hr_recognitions_department_id_fkey', 'hr_recognitions', 'hr_departments', ['department_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('hr_recognitions_from_employee_id_fkey', 'hr_recognitions', 'hr_employees', ['from_employee_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_hr_recognitions_type', 'hr_recognitions', ['recognition_type'], unique=False)
    op.create_index('ix_hr_recognitions_to_employee_id', 'hr_recognitions', ['to_employee_id'], unique=False)
    op.add_column('hr_payslips', sa.Column('pay_run_id', sa.UUID(), autoincrement=False, nullable=True))
    op.create_foreign_key('hr_payslips_pay_run_id_fkey', 'hr_payslips', 'hr_pay_runs', ['pay_run_id'], ['id'])
    op.alter_column('hr_pay_runs', 'total_net',
               existing_type=sa.NUMERIC(precision=14, scale=2),
               nullable=True,
               existing_server_default=sa.text("'0'::numeric"))
    op.alter_column('hr_pay_runs', 'total_deductions',
               existing_type=sa.NUMERIC(precision=14, scale=2),
               nullable=True,
               existing_server_default=sa.text("'0'::numeric"))
    op.alter_column('hr_pay_runs', 'total_gross',
               existing_type=sa.NUMERIC(precision=14, scale=2),
               nullable=True,
               existing_server_default=sa.text("'0'::numeric"))
    op.alter_column('hr_pay_runs', 'status',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_server_default=sa.text("'draft'::character varying"))
    op.drop_constraint(None, 'hr_onboarding_templates', type_='foreignkey')
    op.drop_constraint(None, 'hr_onboarding_templates', type_='foreignkey')
    op.create_foreign_key('hr_onboarding_templates_department_id_fkey', 'hr_onboarding_templates', 'hr_departments', ['department_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('hr_onboarding_templates_created_by_fkey', 'hr_onboarding_templates', 'users', ['created_by'], ['id'], ondelete='RESTRICT')
    op.drop_constraint(None, 'hr_onboarding_tasks', type_='foreignkey')
    op.drop_constraint(None, 'hr_onboarding_tasks', type_='foreignkey')
    op.drop_constraint(None, 'hr_onboarding_tasks', type_='foreignkey')
    op.create_foreign_key('hr_onboarding_tasks_template_id_fkey', 'hr_onboarding_tasks', 'hr_onboarding_templates', ['template_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('hr_onboarding_tasks_employee_id_fkey', 'hr_onboarding_tasks', 'hr_employees', ['employee_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('hr_onboarding_tasks_assigned_to_fkey', 'hr_onboarding_tasks', 'users', ['assigned_to'], ['id'], ondelete='SET NULL')
    op.create_index('ix_hr_onboarding_tasks_status', 'hr_onboarding_tasks', ['status'], unique=False)
    op.create_index('ix_hr_onboarding_tasks_employee_id', 'hr_onboarding_tasks', ['employee_id'], unique=False)
    op.drop_constraint(None, 'hr_merit_increases', type_='foreignkey')
    op.create_foreign_key('hr_merit_increases_employee_id_fkey', 'hr_merit_increases', 'hr_employees', ['employee_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_hr_merit_increases_employee_id', 'hr_merit_increases', ['employee_id'], unique=False)
    op.drop_constraint(None, 'hr_job_requisitions', type_='foreignkey')
    op.drop_constraint(None, 'hr_job_requisitions', type_='foreignkey')
    op.drop_constraint(None, 'hr_job_requisitions', type_='foreignkey')
    op.create_foreign_key('hr_job_requisitions_hiring_manager_id_fkey', 'hr_job_requisitions', 'users', ['hiring_manager_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('hr_job_requisitions_created_by_fkey', 'hr_job_requisitions', 'users', ['created_by'], ['id'], ondelete='RESTRICT')
    op.create_foreign_key('hr_job_requisitions_department_id_fkey', 'hr_job_requisitions', 'hr_departments', ['department_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_hr_job_requisitions_status', 'hr_job_requisitions', ['status'], unique=False)
    op.create_index('ix_hr_job_requisitions_department_id', 'hr_job_requisitions', ['department_id'], unique=False)
    op.drop_constraint(None, 'hr_interviews', type_='foreignkey')
    op.create_foreign_key('hr_interviews_application_id_fkey', 'hr_interviews', 'hr_candidate_applications', ['application_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_hr_interviews_scheduled_at', 'hr_interviews', ['scheduled_at'], unique=False)
    op.create_index('ix_hr_interviews_application_id', 'hr_interviews', ['application_id'], unique=False)
    op.create_index('ix_hr_goals_owner_id', 'hr_goals', ['owner_id'], unique=False)
    op.drop_constraint(None, 'hr_goal_updates', type_='foreignkey')
    op.create_foreign_key('hr_goal_updates_goal_id_fkey', 'hr_goal_updates', 'hr_goals', ['goal_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_hr_goal_updates_goal_id', 'hr_goal_updates', ['goal_id'], unique=False)
    op.drop_constraint(None, 'hr_flight_risk_scores', type_='foreignkey')
    op.create_foreign_key('hr_flight_risk_scores_employee_id_fkey', 'hr_flight_risk_scores', 'hr_employees', ['employee_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_hr_flight_risk_scores_risk_level', 'hr_flight_risk_scores', ['risk_level'], unique=False)
    op.create_index('ix_hr_flight_risk_scores_employee_id', 'hr_flight_risk_scores', ['employee_id'], unique=False)
    op.create_index('ix_hr_flight_risk_scores_calculated_at', 'hr_flight_risk_scores', ['calculated_at'], unique=False)
    op.drop_constraint(None, 'hr_equity_grants', type_='foreignkey')
    op.create_foreign_key('hr_equity_grants_employee_id_fkey', 'hr_equity_grants', 'hr_employees', ['employee_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_hr_equity_grants_employee_id', 'hr_equity_grants', ['employee_id'], unique=False)
    op.drop_constraint(None, 'hr_employee_skills', type_='foreignkey')
    op.create_foreign_key('hr_employee_skills_employee_id_fkey', 'hr_employee_skills', 'hr_employees', ['employee_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_hr_employee_skills_employee_id', 'hr_employee_skills', ['employee_id'], unique=False)
    op.drop_constraint(None, 'hr_employee_activity_log', type_='foreignkey')
    op.create_foreign_key('hr_employee_activity_log_employee_id_fkey', 'hr_employee_activity_log', 'hr_employees', ['employee_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_hr_employee_activity_log_occurred', 'hr_employee_activity_log', ['occurred_at'], unique=False)
    op.create_index('ix_hr_employee_activity_log_employee_id', 'hr_employee_activity_log', ['employee_id'], unique=False)
    op.drop_constraint(None, 'hr_document_versions', type_='foreignkey')
    op.create_foreign_key('hr_document_versions_document_id_fkey', 'hr_document_versions', 'hr_employee_documents', ['document_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_hr_document_versions_document_id', 'hr_document_versions', ['document_id'], unique=False)
    op.drop_constraint(None, 'hr_courses', type_='foreignkey')
    op.create_foreign_key('hr_courses_created_by_fkey', 'hr_courses', 'users', ['created_by'], ['id'], ondelete='RESTRICT')
    op.create_index('ix_hr_courses_is_published', 'hr_courses', ['is_published'], unique=False)
    op.create_index('ix_hr_courses_category', 'hr_courses', ['category'], unique=False)
    op.drop_constraint(None, 'hr_course_modules', type_='foreignkey')
    op.create_foreign_key('hr_course_modules_course_id_fkey', 'hr_course_modules', 'hr_courses', ['course_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_hr_course_modules_course_id', 'hr_course_modules', ['course_id'], unique=False)
    op.drop_constraint(None, 'hr_course_enrollments', type_='foreignkey')
    op.drop_constraint(None, 'hr_course_enrollments', type_='foreignkey')
    op.drop_constraint(None, 'hr_course_enrollments', type_='foreignkey')
    op.create_foreign_key('hr_course_enrollments_enrolled_by_fkey', 'hr_course_enrollments', 'users', ['enrolled_by'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('hr_course_enrollments_employee_id_fkey', 'hr_course_enrollments', 'hr_employees', ['employee_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('hr_course_enrollments_course_id_fkey', 'hr_course_enrollments', 'hr_courses', ['course_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_hr_course_enrollments_status', 'hr_course_enrollments', ['status'], unique=False)
    op.create_index('ix_hr_course_enrollments_employee_id', 'hr_course_enrollments', ['employee_id'], unique=False)
    op.create_index('ix_hr_course_enrollments_course_id', 'hr_course_enrollments', ['course_id'], unique=False)
    op.drop_constraint(None, 'hr_continuous_feedback', type_='foreignkey')
    op.drop_constraint(None, 'hr_continuous_feedback', type_='foreignkey')
    op.create_foreign_key('hr_continuous_feedback_from_employee_id_fkey', 'hr_continuous_feedback', 'hr_employees', ['from_employee_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('hr_continuous_feedback_to_employee_id_fkey', 'hr_continuous_feedback', 'hr_employees', ['to_employee_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_hr_continuous_feedback_to_employee_id', 'hr_continuous_feedback', ['to_employee_id'], unique=False)
    op.create_index('ix_hr_continuous_feedback_from_employee_id', 'hr_continuous_feedback', ['from_employee_id'], unique=False)
    op.drop_constraint(None, 'hr_certifications', type_='foreignkey')
    op.drop_constraint(None, 'hr_certifications', type_='foreignkey')
    op.drop_constraint(None, 'hr_certifications', type_='foreignkey')
    op.create_foreign_key('hr_certifications_employee_id_fkey', 'hr_certifications', 'hr_employees', ['employee_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('hr_certifications_verified_by_fkey', 'hr_certifications', 'users', ['verified_by'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('hr_certifications_course_id_fkey', 'hr_certifications', 'hr_courses', ['course_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_hr_certifications_expiry_date', 'hr_certifications', ['expiry_date'], unique=False)
    op.create_index('ix_hr_certifications_employee_id', 'hr_certifications', ['employee_id'], unique=False)
    op.create_index('ix_hr_candidates_email', 'hr_candidates', ['email'], unique=False)
    op.drop_constraint(None, 'hr_candidate_applications', type_='foreignkey')
    op.drop_constraint(None, 'hr_candidate_applications', type_='foreignkey')
    op.drop_constraint(None, 'hr_candidate_applications', type_='foreignkey')
    op.create_foreign_key('hr_candidate_applications_assigned_to_fkey', 'hr_candidate_applications', 'users', ['assigned_to'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('hr_candidate_applications_candidate_id_fkey', 'hr_candidate_applications', 'hr_candidates', ['candidate_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('hr_candidate_applications_requisition_id_fkey', 'hr_candidate_applications', 'hr_job_requisitions', ['requisition_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_hr_candidate_applications_stage', 'hr_candidate_applications', ['stage'], unique=False)
    op.create_index('ix_hr_candidate_applications_requisition_id', 'hr_candidate_applications', ['requisition_id'], unique=False)
    op.create_index('ix_hr_candidate_applications_candidate_id', 'hr_candidate_applications', ['candidate_id'], unique=False)
    op.drop_constraint(None, 'hr_burnout_indicators', type_='foreignkey')
    op.create_foreign_key('hr_burnout_indicators_employee_id_fkey', 'hr_burnout_indicators', 'hr_employees', ['employee_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_hr_burnout_indicators_risk_level', 'hr_burnout_indicators', ['risk_level'], unique=False)
    op.create_index('ix_hr_burnout_indicators_employee_id', 'hr_burnout_indicators', ['employee_id'], unique=False)
    op.create_index('ix_hr_burnout_indicators_calculated_at', 'hr_burnout_indicators', ['calculated_at'], unique=False)
    op.drop_constraint(None, 'hr_buddy_assignments', type_='foreignkey')
    op.drop_constraint(None, 'hr_buddy_assignments', type_='foreignkey')
    op.create_foreign_key('hr_buddy_assignments_buddy_employee_id_fkey', 'hr_buddy_assignments', 'hr_employees', ['buddy_employee_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('hr_buddy_assignments_new_employee_id_fkey', 'hr_buddy_assignments', 'hr_employees', ['new_employee_id'], ['id'], ondelete='CASCADE')
    op.drop_constraint(None, 'hr_bonuses', type_='foreignkey')
    op.create_foreign_key('hr_bonuses_employee_id_fkey', 'hr_bonuses', 'hr_employees', ['employee_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_hr_bonuses_employee_id', 'hr_bonuses', ['employee_id'], unique=False)
    op.create_index('ix_hr_audit_field_changes_table_name', 'hr_audit_field_changes', ['table_name'], unique=False)
    op.create_index('ix_hr_audit_field_changes_record_id', 'hr_audit_field_changes', ['record_id'], unique=False)
    op.drop_constraint(None, 'hr_analytics_dashboards', type_='foreignkey')
    op.create_foreign_key('hr_analytics_dashboards_owner_id_fkey', 'hr_analytics_dashboards', 'users', ['owner_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_hr_analytics_dashboards_owner_id', 'hr_analytics_dashboards', ['owner_id'], unique=False)
    op.create_index('ix_hr_analytics_dashboards_is_shared', 'hr_analytics_dashboards', ['is_shared'], unique=False)
    op.drop_index(op.f('ix_handbook_categories_slug'), table_name='handbook_categories')
    op.create_index('ix_handbook_categories_slug', 'handbook_categories', ['slug'], unique=False)
    op.create_unique_constraint('handbook_categories_slug_key', 'handbook_categories', ['slug'])
    op.drop_index(op.f('ix_handbook_articles_slug'), table_name='handbook_articles')
    op.create_index('ix_handbook_articles_slug', 'handbook_articles', ['slug'], unique=False)
    op.create_unique_constraint('handbook_articles_slug_key', 'handbook_articles', ['slug'])
    op.alter_column('form_responses', 'is_sandbox',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
    op.alter_column('form_fields', 'metadata',
               existing_type=postgresql.JSON(astext_type=sa.Text()),
               type_=postgresql.JSONB(astext_type=sa.Text()),
               existing_nullable=True)
    op.alter_column('form_fields', 'page_number',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('1'))
    op.alter_column('form_fields', 'field_type',
               existing_type=sa.VARCHAR(length=50),
               comment='text | textarea | number | email | select | checkbox | radio | date | file',
               existing_comment='See FIELD_TYPES in models/forms.py for full list (30+ types)',
               existing_nullable=False)
    op.alter_column('finance_workflow_rules', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_workflow_rules', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_workflow_executions', 'executed_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.add_column('finance_vendor_bills', sa.Column('bill_type', sa.VARCHAR(length=20), server_default=sa.text("'expense'::character varying"), autoincrement=False, nullable=False))
    op.alter_column('finance_vendor_bills', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_vendor_bills', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_tax_jurisdictions', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_tax_jurisdictions', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_revenue_recognition', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_revenue_recognition', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.add_column('finance_recurring_invoices', sa.Column('invoice_type', sa.VARCHAR(length=20), server_default=sa.text("'sales'::character varying"), autoincrement=False, nullable=False))
    op.alter_column('finance_recurring_invoices', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_recurring_invoices', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_recurring_invoices', 'customer_name',
               existing_type=sa.VARCHAR(length=200),
               nullable=True)
    op.drop_constraint(None, 'finance_reconciliations', type_='unique')
    op.alter_column('finance_fx_revaluations', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_fx_revaluations', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.add_column('finance_fixed_assets', sa.Column('description', sa.TEXT(), autoincrement=False, nullable=True))
    op.add_column('finance_fixed_assets', sa.Column('disposed_date', sa.DATE(), autoincrement=False, nullable=True))
    op.add_column('finance_fixed_assets', sa.Column('disposed_amount', sa.NUMERIC(precision=15, scale=2), autoincrement=False, nullable=True))
    op.add_column('finance_fixed_assets', sa.Column('asset_number', sa.VARCHAR(length=50), autoincrement=False, nullable=False))
    op.drop_constraint(None, 'finance_fixed_assets', type_='unique')
    op.create_unique_constraint('finance_fixed_assets_asset_number_key', 'finance_fixed_assets', ['asset_number'])
    op.alter_column('finance_fixed_assets', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_fixed_assets', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_fixed_assets', 'category',
               existing_type=sa.VARCHAR(length=100),
               nullable=True)
    op.alter_column('finance_fixed_assets', 'asset_code',
               existing_type=sa.VARCHAR(length=50),
               nullable=True)
    op.alter_column('finance_expenses', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_expenses', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.create_index('ix_finance_exchange_rates_date', 'finance_exchange_rates', ['from_currency_id', 'to_currency_id', 'effective_date'], unique=False)
    op.alter_column('finance_estimates', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_estimates', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_dunning_logs', 'sent_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_dimensions', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_dimensions', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_custom_fields', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_custom_fields', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_currencies', 'is_base',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
    op.alter_column('finance_currencies', 'symbol',
               existing_type=sa.VARCHAR(length=10),
               nullable=True)
    op.alter_column('finance_compliance_events', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_compliance_events', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_bank_statements', 'file_url',
               existing_type=sa.String(length=500),
               type_=sa.VARCHAR(length=1000),
               existing_nullable=True)
    op.alter_column('finance_bank_statements', 'closing_balance',
               existing_type=sa.Numeric(precision=15, scale=2),
               type_=sa.NUMERIC(precision=14, scale=2),
               existing_nullable=False)
    op.alter_column('finance_bank_statements', 'opening_balance',
               existing_type=sa.Numeric(precision=15, scale=2),
               type_=sa.NUMERIC(precision=14, scale=2),
               existing_nullable=False)
    op.alter_column('finance_bank_statement_lines', 'status',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_server_default=sa.text("'unmatched'::character varying"))
    op.alter_column('finance_bank_statement_lines', 'amount',
               existing_type=sa.Numeric(precision=15, scale=2),
               type_=sa.NUMERIC(precision=14, scale=2),
               existing_nullable=False)
    op.alter_column('finance_bank_reconciliations', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_bank_reconciliations', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_bank_categorization_rules', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('finance_bank_categorization_rules', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.add_column('finance_accounts', sa.Column('balance', sa.NUMERIC(precision=15, scale=2), server_default=sa.text('0'), autoincrement=False, nullable=False))
    op.drop_index(op.f('ix_file_ai_metadata_file_id'), table_name='file_ai_metadata')
    op.create_index('ix_file_ai_metadata_file_id', 'file_ai_metadata', ['file_id'], unique=False)
    op.create_unique_constraint('file_ai_metadata_file_id_key', 'file_ai_metadata', ['file_id'])
    op.drop_index(op.f('ix_ecom_stores_slug'), table_name='ecom_stores')
    op.create_unique_constraint('ecom_stores_slug_key', 'ecom_stores', ['slug'])
    op.alter_column('ecom_stores', 'is_active',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('true'))
    op.alter_column('ecom_stores', 'currency',
               existing_type=sa.VARCHAR(length=10),
               nullable=True,
               existing_server_default=sa.text("'KES'::character varying"))
    op.drop_constraint(None, 'ecom_shipping_addresses', type_='foreignkey')
    op.create_foreign_key('ecom_shipping_addresses_customer_id_fkey', 'ecom_shipping_addresses', 'ecom_customers', ['customer_id'], ['id'])
    op.drop_index(op.f('ix_ecom_shipping_addresses_customer_id'), table_name='ecom_shipping_addresses')
    op.alter_column('ecom_shipping_addresses', 'is_default',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
    op.alter_column('ecom_shipping_addresses', 'country',
               existing_type=sa.VARCHAR(length=100),
               nullable=True,
               existing_server_default=sa.text("'Kenya'::character varying"))
    op.alter_column('ecom_shipping_addresses', 'state',
               existing_type=sa.String(length=150),
               type_=sa.VARCHAR(length=100),
               existing_nullable=True)
    op.alter_column('ecom_shipping_addresses', 'city',
               existing_type=sa.String(length=150),
               type_=sa.VARCHAR(length=100),
               existing_nullable=False)
    op.drop_constraint(None, 'ecom_products', type_='foreignkey')
    op.drop_constraint(None, 'ecom_products', type_='foreignkey')
    op.create_foreign_key('ecom_products_inventory_item_id_fkey', 'ecom_products', 'inventory_items', ['inventory_item_id'], ['id'])
    op.create_foreign_key('ecom_products_store_id_fkey', 'ecom_products', 'ecom_stores', ['store_id'], ['id'])
    op.drop_index(op.f('ix_ecom_products_store_id'), table_name='ecom_products')
    op.drop_index(op.f('ix_ecom_products_slug'), table_name='ecom_products')
    op.create_index('ix_ecom_products_store_slug', 'ecom_products', ['store_id', 'slug'], unique=True)
    op.alter_column('ecom_products', 'seo_title',
               existing_type=sa.String(length=500),
               type_=sa.VARCHAR(length=300),
               existing_nullable=True)
    op.alter_column('ecom_products', 'is_published',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
    op.alter_column('ecom_products', 'compare_at_price',
               existing_type=sa.Numeric(precision=14, scale=2),
               type_=sa.NUMERIC(precision=12, scale=2),
               existing_nullable=True)
    op.alter_column('ecom_products', 'price',
               existing_type=sa.Numeric(precision=14, scale=2),
               type_=sa.NUMERIC(precision=12, scale=2),
               existing_nullable=False)
    op.drop_constraint(None, 'ecom_orders', type_='foreignkey')
    op.drop_constraint(None, 'ecom_orders', type_='foreignkey')
    op.drop_constraint(None, 'ecom_orders', type_='foreignkey')
    op.create_foreign_key('ecom_orders_shipping_address_id_fkey', 'ecom_orders', 'ecom_shipping_addresses', ['shipping_address_id'], ['id'])
    op.create_foreign_key('ecom_orders_store_id_fkey', 'ecom_orders', 'ecom_stores', ['store_id'], ['id'])
    op.create_foreign_key('ecom_orders_customer_id_fkey', 'ecom_orders', 'ecom_customers', ['customer_id'], ['id'])
    op.drop_index(op.f('ix_ecom_orders_store_id'), table_name='ecom_orders')
    op.drop_index(op.f('ix_ecom_orders_order_number'), table_name='ecom_orders')
    op.drop_index(op.f('ix_ecom_orders_customer_id'), table_name='ecom_orders')
    op.create_index('ix_ecom_orders_customer', 'ecom_orders', ['customer_id'], unique=False)
    op.create_unique_constraint('ecom_orders_order_number_key', 'ecom_orders', ['order_number'])
    op.alter_column('ecom_orders', 'shipping_cost',
               existing_type=sa.NUMERIC(precision=14, scale=2),
               nullable=True,
               existing_server_default=sa.text("'0'::numeric"))
    op.alter_column('ecom_orders', 'tax',
               existing_type=sa.NUMERIC(precision=14, scale=2),
               nullable=True,
               existing_server_default=sa.text("'0'::numeric"))
    op.alter_column('ecom_orders', 'status',
               existing_type=sa.VARCHAR(length=30),
               nullable=True,
               existing_server_default=sa.text("'pending'::character varying"))
    op.drop_constraint(None, 'ecom_order_lines', type_='foreignkey')
    op.drop_constraint(None, 'ecom_order_lines', type_='foreignkey')
    op.create_foreign_key('ecom_order_lines_product_id_fkey', 'ecom_order_lines', 'ecom_products', ['product_id'], ['id'])
    op.create_foreign_key('ecom_order_lines_order_id_fkey', 'ecom_order_lines', 'ecom_orders', ['order_id'], ['id'])
    op.drop_index(op.f('ix_ecom_order_lines_order_id'), table_name='ecom_order_lines')
    op.alter_column('ecom_order_lines', 'total',
               existing_type=sa.Numeric(precision=14, scale=2),
               type_=sa.NUMERIC(precision=12, scale=2),
               existing_nullable=False)
    op.alter_column('ecom_order_lines', 'unit_price',
               existing_type=sa.Numeric(precision=14, scale=2),
               type_=sa.NUMERIC(precision=12, scale=2),
               existing_nullable=False)
    op.alter_column('ecom_order_lines', 'product_id',
               existing_type=sa.UUID(),
               nullable=False)
    op.drop_constraint(None, 'ecom_customers', type_='foreignkey')
    op.drop_constraint(None, 'ecom_customers', type_='foreignkey')
    op.create_foreign_key('ecom_customer_accounts_store_id_fkey', 'ecom_customers', 'ecom_stores', ['store_id'], ['id'])
    op.create_foreign_key('ecom_customer_accounts_crm_contact_id_fkey', 'ecom_customers', 'crm_contacts', ['crm_contact_id'], ['id'])
    op.drop_index(op.f('ix_ecom_customers_store_id'), table_name='ecom_customers')
    op.drop_index(op.f('ix_ecom_customers_email'), table_name='ecom_customers')
    op.create_index('ix_ecom_customers_store_email', 'ecom_customers', ['store_id', 'email'], unique=True)
    op.alter_column('ecom_customers', 'is_active',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('true'))
    op.alter_column('ecom_customers', 'last_name',
               existing_type=sa.String(length=150),
               type_=sa.VARCHAR(length=100),
               existing_nullable=True)
    op.alter_column('ecom_customers', 'first_name',
               existing_type=sa.String(length=150),
               type_=sa.VARCHAR(length=100),
               existing_nullable=True)
    op.alter_column('ecom_customers', 'password_hash',
               existing_type=sa.String(length=256),
               type_=sa.VARCHAR(length=200),
               existing_nullable=False)
    op.drop_constraint(None, 'ecom_carts', type_='foreignkey')
    op.drop_constraint(None, 'ecom_carts', type_='foreignkey')
    op.create_foreign_key('ecom_carts_store_id_fkey', 'ecom_carts', 'ecom_stores', ['store_id'], ['id'])
    op.create_foreign_key('ecom_carts_customer_id_fkey', 'ecom_carts', 'ecom_customers', ['customer_id'], ['id'])
    op.drop_index(op.f('ix_ecom_carts_store_id'), table_name='ecom_carts')
    op.drop_index(op.f('ix_ecom_carts_session_key'), table_name='ecom_carts')
    op.alter_column('ecom_carts', 'session_key',
               existing_type=sa.String(length=128),
               type_=sa.VARCHAR(length=200),
               existing_nullable=True)
    op.drop_constraint(None, 'ecom_cart_items', type_='foreignkey')
    op.drop_constraint(None, 'ecom_cart_items', type_='foreignkey')
    op.create_foreign_key('ecom_cart_items_product_id_fkey', 'ecom_cart_items', 'ecom_products', ['product_id'], ['id'])
    op.create_foreign_key('ecom_cart_items_cart_id_fkey', 'ecom_cart_items', 'ecom_carts', ['cart_id'], ['id'])
    op.drop_index(op.f('ix_ecom_cart_items_cart_id'), table_name='ecom_cart_items')
    op.add_column('drive_files', sa.Column('search_vector', postgresql.TSVECTOR(), autoincrement=False, nullable=True))
    op.create_index('ix_drive_files_search_vector', 'drive_files', ['search_vector'], unique=False, postgresql_using='gin')
    op.create_index('ix_drive_files_embedding_hnsw', 'drive_files', ['content_embedding'], unique=False, postgresql_with={'m': '16', 'ef_construction': '64'}, postgresql_using='hnsw')
    op.create_unique_constraint('uq_document_bookmarks_user_file', 'document_bookmarks', ['user_id', 'file_id'])
    op.alter_column('crm_workflows', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_workflows', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_workflows', 'execution_count',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('crm_workflows', 'status',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_server_default=sa.text("'draft'::character varying"))
    op.alter_column('crm_workflow_templates', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_workflow_templates', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_workflow_templates', 'is_system',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('true'))
    op.alter_column('crm_workflow_nodes', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_workflow_nodes', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_workflow_nodes', 'position_y',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('crm_workflow_nodes', 'position_x',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('crm_workflow_executions', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_workflow_executions', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_workflow_executions', 'status',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_server_default=sa.text("'running'::character varying"))
    op.alter_column('crm_unsubscribes', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_unsubscribes', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_sla_trackers', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_sla_trackers', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_sla_trackers', 'is_resolution_breached',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
    op.alter_column('crm_sla_trackers', 'is_first_response_breached',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
    op.alter_column('crm_sla_policies', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_sla_policies', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_sla_policies', 'is_active',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('true'))
    op.alter_column('crm_sla_policies', 'business_hours_only',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('true'))
    op.alter_column('crm_sequence_steps', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_sequence_steps', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_sequence_steps', 'delay_hours',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('crm_sequence_steps', 'delay_days',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.add_column('crm_sequence_enrollments', sa.Column('current_step', sa.INTEGER(), server_default=sa.text('0'), autoincrement=False, nullable=True))
    op.add_column('crm_sequence_enrollments', sa.Column('next_action_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True))
    op.drop_constraint(None, 'crm_sequence_enrollments', type_='foreignkey')
    op.drop_constraint(None, 'crm_sequence_enrollments', type_='foreignkey')
    op.alter_column('crm_sequence_enrollments', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_sequence_enrollments', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_sequence_enrollments', 'metadata_json',
               existing_type=postgresql.JSON(astext_type=sa.Text()),
               type_=postgresql.JSONB(astext_type=sa.Text()),
               existing_nullable=True)
    op.alter_column('crm_sequence_enrollments', 'enrolled_by',
               existing_type=sa.UUID(),
               nullable=True)
    op.alter_column('crm_sequence_enrollments', 'status',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_server_default=sa.text("'active'::character varying"))
    op.alter_column('crm_segments', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_segments', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_segments', 'ai_suggested',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
    op.alter_column('crm_segments', 'contact_count',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('crm_segments', 'segment_type',
               existing_type=sa.VARCHAR(length=30),
               nullable=True,
               existing_server_default=sa.text("'static'::character varying"))
    op.alter_column('crm_segment_contacts', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_segment_contacts', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_saved_reports', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_saved_reports', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_saved_reports', 'is_shared',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
    op.alter_column('crm_saved_reports', 'is_favorite',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
    op.alter_column('crm_sales_sequences', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_sales_sequences', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_sales_sequences', 'trigger_config',
               existing_type=postgresql.JSON(astext_type=sa.Text()),
               type_=postgresql.JSONB(astext_type=sa.Text()),
               existing_nullable=True)
    op.alter_column('crm_sales_sequences', 'trigger_type',
               existing_type=sa.String(length=30),
               type_=sa.VARCHAR(length=50),
               nullable=True)
    op.alter_column('crm_sales_sequences', 'status',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_server_default=sa.text("'draft'::character varying"))
    op.add_column('crm_sales_activities', sa.Column('due_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True))
    op.drop_constraint(None, 'crm_sales_activities', type_='foreignkey')
    op.drop_constraint(None, 'crm_sales_activities', type_='foreignkey')
    op.drop_constraint(None, 'crm_sales_activities', type_='foreignkey')
    op.drop_constraint(None, 'crm_sales_activities', type_='foreignkey')
    op.alter_column('crm_sales_activities', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_sales_activities', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_record_followers', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_record_followers', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_pipelines', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_pipelines', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_pipelines', 'is_active',
               existing_type=sa.BOOLEAN(),
               nullable=True)
    op.alter_column('crm_pipelines', 'is_default',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
    op.add_column('crm_lead_scoring_rules', sa.Column('points', sa.INTEGER(), autoincrement=False, nullable=False))
    op.add_column('crm_lead_scoring_rules', sa.Column('field', sa.VARCHAR(length=100), autoincrement=False, nullable=False))
    op.drop_constraint(None, 'crm_lead_scoring_rules', type_='foreignkey')
    op.alter_column('crm_lead_scoring_rules', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_lead_scoring_rules', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_lead_scoring_rules', 'created_by',
               existing_type=sa.UUID(),
               nullable=True)
    op.alter_column('crm_lead_scoring_rules', 'is_active',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('true'))
    op.alter_column('crm_lead_scoring_rules', 'score_delta',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('crm_lead_scoring_rules', 'operator',
               existing_type=sa.String(length=20),
               type_=sa.VARCHAR(length=30),
               existing_nullable=False)
    op.alter_column('crm_lead_scoring_rules', 'field_name',
               existing_type=sa.VARCHAR(length=100),
               nullable=True)
    op.alter_column('crm_lead_scoring_rules', 'category',
               existing_type=sa.String(length=30),
               type_=sa.VARCHAR(length=50),
               nullable=True)
    op.alter_column('crm_knowledge_base_articles', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_knowledge_base_articles', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_knowledge_base_articles', 'embedding',
               existing_type=pgvector.sqlalchemy.vector.VECTOR(dim=1536),
               type_=postgresql.JSON(astext_type=sa.Text()),
               existing_nullable=True)
    op.alter_column('crm_knowledge_base_articles', 'not_helpful_count',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('crm_knowledge_base_articles', 'helpful_count',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('crm_knowledge_base_articles', 'view_count',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('crm_knowledge_base_articles', 'status',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_server_default=sa.text("'draft'::character varying"))
    op.alter_column('crm_gamification_scores', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_gamification_scores', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_gamification_scores', 'leads_converted',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('crm_gamification_scores', 'activities_completed',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('crm_gamification_scores', 'deals_value',
               existing_type=sa.NUMERIC(precision=15, scale=2),
               nullable=True,
               existing_server_default=sa.text("'0'::numeric"))
    op.alter_column('crm_gamification_scores', 'deals_closed',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('crm_gamification_scores', 'score',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('crm_email_templates', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_email_templates', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_email_templates', 'is_active',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('true'))
    op.alter_column('crm_email_templates', 'category',
               existing_type=sa.VARCHAR(length=50),
               nullable=True,
               existing_server_default=sa.text("'one_off'::character varying"))
    op.alter_column('crm_email_campaign_configs', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_email_campaign_configs', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_email_campaign_configs', 'bounce_count',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('crm_email_campaign_configs', 'unsubscribe_count',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('crm_email_campaign_configs', 'click_count',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('crm_email_campaign_configs', 'open_count',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('crm_email_campaign_configs', 'sent_count',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('crm_email_campaign_configs', 'ab_winner_auto_send',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
    op.alter_column('crm_email_campaign_configs', 'ab_winner_metric',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_server_default=sa.text("'open_rate'::character varying"))
    op.alter_column('crm_email_campaign_configs', 'ab_test_ratio',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('50'))
    op.add_column('crm_duplicate_candidates', sa.Column('match_reasons', postgresql.JSON(astext_type=sa.Text()), autoincrement=False, nullable=True))
    op.add_column('crm_duplicate_candidates', sa.Column('resolved_by', sa.UUID(), autoincrement=False, nullable=True))
    op.drop_constraint(None, 'crm_duplicate_candidates', type_='foreignkey')
    op.alter_column('crm_duplicate_candidates', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_duplicate_candidates', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_duplicate_candidates', 'status',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_server_default=sa.text("'pending'::character varying"))
    op.alter_column('crm_duplicate_candidates', 'match_fields',
               existing_type=postgresql.JSON(astext_type=sa.Text()),
               type_=postgresql.JSONB(astext_type=sa.Text()),
               existing_nullable=True)
    op.alter_column('crm_dashboard_widgets', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_dashboard_widgets', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_dashboard_widgets', 'height',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('1'))
    op.alter_column('crm_dashboard_widgets', 'width',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('1'))
    op.alter_column('crm_dashboard_widgets', 'position_y',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('crm_dashboard_widgets', 'position_x',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('crm_custom_object_relationships', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_custom_object_relationships', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_custom_object_records', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_custom_object_records', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_custom_object_definitions', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_custom_object_definitions', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_custom_object_definitions', 'is_active',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('true'))
    op.add_column('crm_custom_field_definitions', sa.Column('display_order', sa.INTEGER(), server_default=sa.text('0'), autoincrement=False, nullable=True))
    op.drop_constraint(None, 'crm_custom_field_definitions', type_='foreignkey')
    op.alter_column('crm_custom_field_definitions', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_custom_field_definitions', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_custom_field_definitions', 'created_by',
               existing_type=sa.UUID(),
               nullable=True)
    op.alter_column('crm_custom_field_definitions', 'sort_order',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('crm_custom_field_definitions', 'default_value',
               existing_type=sa.String(length=500),
               type_=sa.TEXT(),
               existing_nullable=True)
    op.alter_column('crm_custom_field_definitions', 'is_required',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
    op.alter_column('crm_custom_field_definitions', 'entity_type',
               existing_type=sa.String(length=30),
               type_=sa.VARCHAR(length=50),
               existing_nullable=False)
    op.alter_column('crm_conversations', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_conversations', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_conversations', 'status',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_server_default=sa.text("'open'::character varying"))
    op.alter_column('crm_conversation_messages', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_conversation_messages', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_conversation_messages', 'content_type',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_server_default=sa.text("'text'::character varying"))
    op.alter_column('crm_content_calendar', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_content_calendar', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_content_calendar', 'status',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_server_default=sa.text("'idea'::character varying"))
    op.drop_index('ix_crm_contacts_email', table_name='crm_contacts')
    op.alter_column('crm_contacts', 'lifecycle_stage',
               existing_type=sa.VARCHAR(length=30),
               nullable=True,
               existing_server_default=sa.text("'subscriber'::character varying"))
    op.alter_column('crm_contacts', 'website',
               existing_type=sa.String(length=300),
               type_=sa.VARCHAR(length=500),
               existing_nullable=True)
    op.add_column('crm_contact_notes', sa.Column('subject', sa.VARCHAR(length=300), autoincrement=False, nullable=True))
    op.alter_column('crm_contact_notes', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_contact_notes', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_contact_notes', 'pinned',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
    op.alter_column('crm_contact_notes', 'metadata_json',
               existing_type=postgresql.JSON(astext_type=sa.Text()),
               type_=postgresql.JSONB(astext_type=sa.Text()),
               existing_nullable=True)
    op.alter_column('crm_comments', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_comments', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_comments', 'is_edited',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
    op.alter_column('crm_audit_log', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_audit_log', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_ai_agent_runs', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_ai_agent_runs', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_ai_agent_runs', 'status',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_server_default=sa.text("'running'::character varying"))
    op.alter_column('crm_ai_agent_configs', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_ai_agent_configs', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('crm_ai_agent_configs', 'max_actions_per_run',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('10'))
    op.alter_column('crm_ai_agent_configs', 'approval_required',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('true'))
    op.alter_column('crm_ai_agent_configs', 'is_active',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('true'))
    op.alter_column('chat_messages', 'metadata',
               existing_type=postgresql.JSON(astext_type=sa.Text()),
               comment='Flexible payload for cards/actions: {action, params, result, status}',
               existing_comment='Flexible payload for cards/actions: {action, params, result, status, entity_type, entity_id}',
               existing_nullable=True)
    op.alter_column('chat_messages', 'mentions',
               existing_type=postgresql.JSON(astext_type=sa.Text()),
               comment='["user_id1", "@channel", "@here"]',
               existing_comment='["user_id1", "user_id2"] or ["@channel", "@here"]',
               existing_nullable=True)
    op.alter_column('chat_messages', 'reactions',
               existing_type=postgresql.JSON(astext_type=sa.Text()),
               comment='{"thumbsup": ["user_id1"], "heart": ["user_id2"]}',
               existing_comment='{"thumbsup": ["user_id1", "user_id2"], "heart": ["user_id3"]}',
               existing_nullable=True)
    op.drop_constraint(None, 'calendar_events', type_='foreignkey')
    op.drop_constraint(None, 'calendar_events', type_='foreignkey')
    op.alter_column('calendar_events', 'status',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               comment=None,
               existing_comment='confirmed | tentative | cancelled',
               existing_server_default=sa.text("'confirmed'::character varying"))
    op.alter_column('calendar_events', 'erp_context',
               existing_type=postgresql.JSON(astext_type=sa.Text()),
               type_=postgresql.JSONB(astext_type=sa.Text()),
               comment=None,
               existing_comment='ERP cross-module links {invoice_id, ticket_id, deal_id, project_id, ...}',
               existing_nullable=True)
    op.alter_column('calendar_events', 'reminders',
               existing_type=postgresql.JSON(astext_type=sa.Text()),
               type_=postgresql.JSONB(astext_type=sa.Text()),
               comment=None,
               existing_comment='Array of reminder configs [{minutes_before, channel}]',
               existing_nullable=True)
    op.alter_column('calendar_events', 'timezone',
               existing_type=sa.VARCHAR(length=100),
               comment=None,
               existing_comment='IANA timezone string for display, e.g. Africa/Nairobi',
               existing_nullable=True)
    op.alter_column('calendar_events', 'buffer_after',
               existing_type=sa.INTEGER(),
               nullable=True,
               comment=None,
               existing_comment='Buffer minutes after event',
               existing_server_default=sa.text('0'))
    op.alter_column('calendar_events', 'buffer_before',
               existing_type=sa.INTEGER(),
               nullable=True,
               comment=None,
               existing_comment='Buffer minutes before event',
               existing_server_default=sa.text('0'))
    op.alter_column('calendar_events', 'priority',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               comment=None,
               existing_comment='low | normal | high | urgent')
    op.alter_column('calendar_events', 'sensitivity',
               existing_type=sa.VARCHAR(length=20),
               comment=None,
               existing_comment='normal | private | confidential',
               existing_nullable=False,
               existing_server_default=sa.text("'normal'::character varying"))
    op.alter_column('calendar_events', 'event_type',
               existing_type=sa.VARCHAR(length=20),
               comment='meeting | task | reminder | holiday',
               existing_comment='meeting | task | reminder | holiday | focus | booking | deadline',
               existing_nullable=False)
    op.add_column('agent_runs', sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False))
    op.alter_column('agent_runs', 'message_history',
               existing_type=postgresql.JSON(astext_type=sa.Text()),
               comment=None,
               existing_comment='Last 3-5 messages for session memory / context continuity',
               existing_nullable=True,
               existing_server_default=sa.text("'[]'::json"))
    op.alter_column('agent_runs', 'page_context',
               existing_type=postgresql.JSON(astext_type=sa.Text()),
               comment=None,
               existing_comment='Current route + selected record when prompt was sent',
               existing_nullable=True)
    op.alter_column('agent_runs', 'model',
               existing_type=sa.String(length=150),
               type_=sa.VARCHAR(length=100),
               existing_nullable=True)
    op.alter_column('agent_runs', 'provider',
               existing_type=sa.String(length=50),
               type_=sa.VARCHAR(length=30),
               existing_nullable=True)
    op.alter_column('agent_runs', 'status',
               existing_type=sa.VARCHAR(length=30),
               comment=None,
               existing_comment='planning | researching | verifying | executing | awaiting_approval | completed | failed',
               existing_nullable=False,
               existing_server_default=sa.text("'planning'::character varying"))
    op.add_column('agent_run_steps', sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False))
    op.alter_column('agent_run_steps', 'approval_tier',
               existing_type=sa.String(length=20),
               type_=sa.VARCHAR(length=30),
               comment=None,
               existing_comment='auto_approve | warn | require_approval',
               existing_nullable=True)
    op.alter_column('agent_run_steps', 'status',
               existing_type=sa.VARCHAR(length=30),
               comment=None,
               existing_comment='pending | running | completed | failed | skipped | awaiting_approval | approved | rejected',
               existing_nullable=False,
               existing_server_default=sa.text("'pending'::character varying"))
    op.alter_column('agent_run_steps', 'action',
               existing_type=sa.VARCHAR(length=100),
               comment=None,
               existing_comment='Tool name or internal action (plan, research, verify, summarize)',
               existing_nullable=False)
    op.alter_column('agent_run_steps', 'agent',
               existing_type=sa.String(length=20),
               type_=sa.VARCHAR(length=30),
               comment=None,
               existing_comment='orchestrator | researcher | executor | verifier',
               existing_nullable=False)
    op.add_column('agent_approvals', sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False))
    op.alter_column('agent_approvals', 'status',
               existing_type=sa.VARCHAR(length=20),
               comment=None,
               existing_comment='pending | approved | rejected',
               existing_nullable=False,
               existing_server_default=sa.text("'pending'::character varying"))
    op.alter_column('agent_approvals', 'risk_level',
               existing_type=sa.String(length=20),
               type_=sa.VARCHAR(length=30),
               comment=None,
               existing_comment='warn | require_approval',
               existing_nullable=False,
               existing_server_default=sa.text("'warn'::character varying"))
    op.alter_column('agent_approvals', 'action_description',
               existing_type=sa.TEXT(),
               nullable=True)
    op.create_table('ecom_b2b_quote_items',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), autoincrement=False, nullable=False),
    sa.Column('quote_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('product_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('quantity', sa.INTEGER(), server_default=sa.text('1'), autoincrement=False, nullable=False),
    sa.Column('requested_price', sa.NUMERIC(precision=14, scale=2), autoincrement=False, nullable=True),
    sa.Column('approved_price', sa.NUMERIC(precision=14, scale=2), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['product_id'], ['ecom_products.id'], name='ecom_b2b_quote_items_product_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['quote_id'], ['ecom_b2b_quotes.id'], name='ecom_b2b_quote_items_quote_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='ecom_b2b_quote_items_pkey')
    )
    op.create_index('ix_ecom_b2b_quote_items_quote_id', 'ecom_b2b_quote_items', ['quote_id'], unique=False)
    op.create_table('ecom_currencies',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), autoincrement=False, nullable=False),
    sa.Column('code', sa.VARCHAR(length=10), autoincrement=False, nullable=False),
    sa.Column('name', sa.VARCHAR(length=100), autoincrement=False, nullable=False),
    sa.Column('symbol', sa.VARCHAR(length=10), autoincrement=False, nullable=False),
    sa.Column('exchange_rate_to_base', sa.NUMERIC(precision=14, scale=6), server_default=sa.text("'1'::numeric"), autoincrement=False, nullable=False),
    sa.Column('is_active', sa.BOOLEAN(), server_default=sa.text('true'), autoincrement=False, nullable=False),
    sa.Column('last_updated', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name='ecom_currencies_pkey')
    )
    op.create_index('ix_ecom_currencies_code', 'ecom_currencies', ['code'], unique=True)
    op.create_table('ab_permission_view_role',
    sa.Column('id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('permission_view_id', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('role_id', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.ForeignKeyConstraint(['permission_view_id'], ['ab_permission_view.id'], name='ab_permission_view_role_permission_view_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['role_id'], ['ab_role.id'], name='ab_permission_view_role_role_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='ab_permission_view_role_pkey'),
    sa.UniqueConstraint('permission_view_id', 'role_id', name='ab_permission_view_role_permission_view_id_role_id_key')
    )
    op.create_index('idx_role_id', 'ab_permission_view_role', ['role_id'], unique=False)
    op.create_index('idx_permission_view_id', 'ab_permission_view_role', ['permission_view_id'], unique=False)
    op.create_table('ecom_b2b_company_members',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), autoincrement=False, nullable=False),
    sa.Column('company_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('customer_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('role', sa.VARCHAR(length=20), server_default=sa.text("'buyer'::character varying"), autoincrement=False, nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['company_id'], ['ecom_b2b_companies.id'], name='ecom_b2b_company_members_company_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['customer_id'], ['ecom_customers.id'], name='ecom_b2b_company_members_customer_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='ecom_b2b_company_members_pkey')
    )
    op.create_index('ix_ecom_b2b_company_members_customer_id', 'ecom_b2b_company_members', ['customer_id'], unique=False)
    op.create_index('ix_ecom_b2b_company_members_company_id', 'ecom_b2b_company_members', ['company_id'], unique=False)
    op.create_table('ecom_b2b_pricing_tiers',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), autoincrement=False, nullable=False),
    sa.Column('name', sa.VARCHAR(length=200), autoincrement=False, nullable=False),
    sa.Column('min_order_qty', sa.INTEGER(), server_default=sa.text('1'), autoincrement=False, nullable=False),
    sa.Column('discount_pct', sa.NUMERIC(precision=5, scale=2), server_default=sa.text("'0'::numeric"), autoincrement=False, nullable=False),
    sa.Column('fixed_price_override', sa.NUMERIC(precision=14, scale=2), autoincrement=False, nullable=True),
    sa.Column('product_id', sa.UUID(), autoincrement=False, nullable=True),
    sa.Column('company_id', sa.UUID(), autoincrement=False, nullable=True),
    sa.Column('is_active', sa.BOOLEAN(), server_default=sa.text('true'), autoincrement=False, nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['company_id'], ['ecom_b2b_companies.id'], name='ecom_b2b_pricing_tiers_company_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['product_id'], ['ecom_products.id'], name='ecom_b2b_pricing_tiers_product_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='ecom_b2b_pricing_tiers_pkey')
    )
    op.create_table('ecom_loyalty_programs',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), autoincrement=False, nullable=False),
    sa.Column('store_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('name', sa.VARCHAR(length=200), server_default=sa.text("'Loyalty Rewards'::character varying"), autoincrement=False, nullable=False),
    sa.Column('points_per_unit_spent', sa.INTEGER(), server_default=sa.text('1'), autoincrement=False, nullable=False),
    sa.Column('currency_per_point', sa.NUMERIC(precision=8, scale=4), server_default=sa.text('0.01'), autoincrement=False, nullable=False),
    sa.Column('is_active', sa.BOOLEAN(), server_default=sa.text('true'), autoincrement=False, nullable=False),
    sa.Column('referral_bonus_points', sa.INTEGER(), server_default=sa.text('100'), autoincrement=False, nullable=False),
    sa.Column('referral_referee_points', sa.INTEGER(), server_default=sa.text('50'), autoincrement=False, nullable=False),
    sa.Column('points_expiry_days', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['store_id'], ['ecom_stores.id'], name='ecom_loyalty_programs_store_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='ecom_loyalty_programs_pkey'),
    sa.UniqueConstraint('store_id', name='ecom_loyalty_programs_store_id_key')
    )
    op.create_table('ab_view_menu',
    sa.Column('id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('name', sa.VARCHAR(length=250), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name='ab_view_menu_pkey'),
    sa.UniqueConstraint('name', name='ab_view_menu_name_key'),
    postgresql_ignore_search_path=False
    )
    op.create_table('ab_register_user',
    sa.Column('id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('first_name', sa.VARCHAR(length=64), autoincrement=False, nullable=False),
    sa.Column('last_name', sa.VARCHAR(length=64), autoincrement=False, nullable=False),
    sa.Column('username', sa.VARCHAR(length=64), autoincrement=False, nullable=False),
    sa.Column('password', sa.VARCHAR(length=256), autoincrement=False, nullable=True),
    sa.Column('email', sa.VARCHAR(length=320), autoincrement=False, nullable=False),
    sa.Column('registration_date', postgresql.TIMESTAMP(), autoincrement=False, nullable=True),
    sa.Column('registration_hash', sa.VARCHAR(length=256), autoincrement=False, nullable=True),
    sa.PrimaryKeyConstraint('id', name='ab_register_user_pkey'),
    sa.UniqueConstraint('email', name='ab_register_user_email_key'),
    sa.UniqueConstraint('username', name='ab_register_user_username_key')
    )
    op.create_table('ab_group_role',
    sa.Column('id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('group_id', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('role_id', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.ForeignKeyConstraint(['group_id'], ['ab_group.id'], name='ab_group_role_group_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['role_id'], ['ab_role.id'], name='ab_group_role_role_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='ab_group_role_pkey'),
    sa.UniqueConstraint('group_id', 'role_id', name='ab_group_role_group_id_role_id_key')
    )
    op.create_index('idx_group_role_id', 'ab_group_role', ['role_id'], unique=False)
    op.create_index('idx_group_id', 'ab_group_role', ['group_id'], unique=False)
    op.create_table('ecom_subscription_orders',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), autoincrement=False, nullable=False),
    sa.Column('subscription_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('order_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('billing_date', sa.DATE(), autoincrement=False, nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['order_id'], ['ecom_orders.id'], name='ecom_subscription_orders_order_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['subscription_id'], ['ecom_subscriptions.id'], name='ecom_subscription_orders_subscription_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='ecom_subscription_orders_pkey')
    )
    op.create_index('ix_ecom_subscription_orders_subscription_id', 'ecom_subscription_orders', ['subscription_id'], unique=False)
    op.create_table('ab_permission_view',
    sa.Column('id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('permission_id', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('view_menu_id', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.ForeignKeyConstraint(['permission_id'], ['ab_permission.id'], name='ab_permission_view_permission_id_fkey'),
    sa.ForeignKeyConstraint(['view_menu_id'], ['ab_view_menu.id'], name='ab_permission_view_view_menu_id_fkey'),
    sa.PrimaryKeyConstraint('id', name='ab_permission_view_pkey'),
    sa.UniqueConstraint('permission_id', 'view_menu_id', name='ab_permission_view_permission_id_view_menu_id_key')
    )
    op.create_index('idx_view_menu_id', 'ab_permission_view', ['view_menu_id'], unique=False)
    op.create_index('idx_permission_id', 'ab_permission_view', ['permission_id'], unique=False)
    op.create_table('ecom_subscriptions',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), autoincrement=False, nullable=False),
    sa.Column('customer_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('product_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('quantity', sa.INTEGER(), server_default=sa.text('1'), autoincrement=False, nullable=False),
    sa.Column('frequency_days', sa.INTEGER(), server_default=sa.text('30'), autoincrement=False, nullable=False),
    sa.Column('discount_pct', sa.NUMERIC(precision=5, scale=2), server_default=sa.text("'0'::numeric"), autoincrement=False, nullable=False),
    sa.Column('status', sa.VARCHAR(length=20), server_default=sa.text("'active'::character varying"), autoincrement=False, nullable=False),
    sa.Column('next_billing_date', sa.DATE(), autoincrement=False, nullable=False),
    sa.Column('shipping_address_id', sa.UUID(), autoincrement=False, nullable=True),
    sa.Column('payment_gateway_id', sa.UUID(), autoincrement=False, nullable=True),
    sa.Column('metadata_json', postgresql.JSON(astext_type=sa.Text()), autoincrement=False, nullable=True),
    sa.Column('cancelled_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['customer_id'], ['ecom_customers.id'], name='ecom_subscriptions_customer_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['payment_gateway_id'], ['ecom_payment_gateways.id'], name='ecom_subscriptions_payment_gateway_id_fkey', ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['product_id'], ['ecom_products.id'], name='ecom_subscriptions_product_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['shipping_address_id'], ['ecom_shipping_addresses.id'], name='ecom_subscriptions_shipping_address_id_fkey', ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name='ecom_subscriptions_pkey')
    )
    op.create_index('ix_ecom_subscriptions_status', 'ecom_subscriptions', ['status'], unique=False)
    op.create_index('ix_ecom_subscriptions_customer_id', 'ecom_subscriptions', ['customer_id'], unique=False)
    op.create_table('ecom_referral_uses',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), autoincrement=False, nullable=False),
    sa.Column('referral_code_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('new_customer_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('order_id', sa.UUID(), autoincrement=False, nullable=True),
    sa.Column('rewarded_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['new_customer_id'], ['ecom_customers.id'], name='ecom_referral_uses_new_customer_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['order_id'], ['ecom_orders.id'], name='ecom_referral_uses_order_id_fkey', ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['referral_code_id'], ['ecom_referral_codes.id'], name='ecom_referral_uses_referral_code_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='ecom_referral_uses_pkey')
    )
    op.create_index('ix_ecom_referral_uses_referral_code_id', 'ecom_referral_uses', ['referral_code_id'], unique=False)
    op.create_table('ecom_b2b_companies',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), autoincrement=False, nullable=False),
    sa.Column('name', sa.VARCHAR(length=300), autoincrement=False, nullable=False),
    sa.Column('tax_id', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('credit_limit', sa.NUMERIC(precision=14, scale=2), server_default=sa.text("'0'::numeric"), autoincrement=False, nullable=False),
    sa.Column('payment_terms', sa.VARCHAR(length=20), server_default=sa.text("'COD'::character varying"), autoincrement=False, nullable=False),
    sa.Column('is_approved', sa.BOOLEAN(), server_default=sa.text('false'), autoincrement=False, nullable=False),
    sa.Column('approved_by', sa.UUID(), autoincrement=False, nullable=True),
    sa.Column('notes', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('contact_email', sa.VARCHAR(length=320), autoincrement=False, nullable=True),
    sa.Column('contact_phone', sa.VARCHAR(length=50), autoincrement=False, nullable=True),
    sa.Column('address', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('metadata_json', postgresql.JSON(astext_type=sa.Text()), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['approved_by'], ['users.id'], name='ecom_b2b_companies_approved_by_fkey', ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name='ecom_b2b_companies_pkey'),
    postgresql_ignore_search_path=False
    )
    op.create_table('ab_user',
    sa.Column('id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('first_name', sa.VARCHAR(length=64), autoincrement=False, nullable=False),
    sa.Column('last_name', sa.VARCHAR(length=64), autoincrement=False, nullable=False),
    sa.Column('username', sa.VARCHAR(length=64), autoincrement=False, nullable=False),
    sa.Column('password', sa.VARCHAR(length=256), autoincrement=False, nullable=True),
    sa.Column('active', sa.BOOLEAN(), autoincrement=False, nullable=True),
    sa.Column('email', sa.VARCHAR(length=320), autoincrement=False, nullable=False),
    sa.Column('last_login', postgresql.TIMESTAMP(), autoincrement=False, nullable=True),
    sa.Column('login_count', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('fail_login_count', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('created_on', postgresql.TIMESTAMP(), autoincrement=False, nullable=True),
    sa.Column('changed_on', postgresql.TIMESTAMP(), autoincrement=False, nullable=True),
    sa.Column('created_by_fk', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('changed_by_fk', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.ForeignKeyConstraint(['changed_by_fk'], ['ab_user.id'], name='ab_user_changed_by_fk_fkey'),
    sa.ForeignKeyConstraint(['created_by_fk'], ['ab_user.id'], name='ab_user_created_by_fk_fkey'),
    sa.PrimaryKeyConstraint('id', name='ab_user_pkey'),
    sa.UniqueConstraint('email', name='ab_user_email_key'),
    sa.UniqueConstraint('username', name='ab_user_username_key'),
    postgresql_ignore_search_path=False
    )
    op.create_table('ecom_loyalty_tiers',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), autoincrement=False, nullable=False),
    sa.Column('store_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('name', sa.VARCHAR(length=100), autoincrement=False, nullable=False),
    sa.Column('min_lifetime_points', sa.INTEGER(), server_default=sa.text('0'), autoincrement=False, nullable=False),
    sa.Column('discount_pct', sa.NUMERIC(precision=5, scale=2), server_default=sa.text("'0'::numeric"), autoincrement=False, nullable=False),
    sa.Column('free_shipping', sa.BOOLEAN(), server_default=sa.text('false'), autoincrement=False, nullable=False),
    sa.Column('badge_color', sa.VARCHAR(length=20), server_default=sa.text("'#51459d'::character varying"), autoincrement=False, nullable=False),
    sa.Column('sort_order', sa.INTEGER(), server_default=sa.text('0'), autoincrement=False, nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['store_id'], ['ecom_stores.id'], name='ecom_loyalty_tiers_store_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='ecom_loyalty_tiers_pkey'),
    postgresql_ignore_search_path=False
    )
    op.create_index('ix_ecom_loyalty_tiers_store_id', 'ecom_loyalty_tiers', ['store_id'], unique=False)
    op.create_table('ab_role',
    sa.Column('id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('name', sa.VARCHAR(length=64), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name='ab_role_pkey'),
    sa.UniqueConstraint('name', name='ab_role_name_key'),
    postgresql_ignore_search_path=False
    )
    op.create_table('ecom_blog_posts',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), autoincrement=False, nullable=False),
    sa.Column('store_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('title', sa.VARCHAR(length=500), autoincrement=False, nullable=False),
    sa.Column('slug', sa.VARCHAR(length=500), autoincrement=False, nullable=False),
    sa.Column('content_markdown', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('author_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('status', sa.VARCHAR(length=20), server_default=sa.text("'draft'::character varying"), autoincrement=False, nullable=False),
    sa.Column('published_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
    sa.Column('tags_json', postgresql.JSON(astext_type=sa.Text()), autoincrement=False, nullable=True),
    sa.Column('meta_title', sa.VARCHAR(length=500), autoincrement=False, nullable=True),
    sa.Column('meta_description', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('feature_image', sa.VARCHAR(length=500), autoincrement=False, nullable=True),
    sa.Column('view_count', sa.INTEGER(), server_default=sa.text('0'), autoincrement=False, nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['author_id'], ['users.id'], name='ecom_blog_posts_author_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['store_id'], ['ecom_stores.id'], name='ecom_blog_posts_store_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='ecom_blog_posts_pkey')
    )
    op.create_index('ix_ecom_blog_posts_store_id', 'ecom_blog_posts', ['store_id'], unique=False)
    op.create_index('ix_ecom_blog_posts_status', 'ecom_blog_posts', ['status'], unique=False)
    op.create_index('ix_ecom_blog_posts_slug', 'ecom_blog_posts', ['slug'], unique=True)
    op.create_table('ecom_referral_codes',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), autoincrement=False, nullable=False),
    sa.Column('customer_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('code', sa.VARCHAR(length=50), autoincrement=False, nullable=False),
    sa.Column('used_count', sa.INTEGER(), server_default=sa.text('0'), autoincrement=False, nullable=False),
    sa.Column('total_points_earned', sa.INTEGER(), server_default=sa.text('0'), autoincrement=False, nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['customer_id'], ['ecom_customers.id'], name='ecom_referral_codes_customer_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='ecom_referral_codes_pkey'),
    sa.UniqueConstraint('customer_id', name='ecom_referral_codes_customer_id_key')
    )
    op.create_index('ix_ecom_referral_codes_code', 'ecom_referral_codes', ['code'], unique=True)
    op.create_table('ab_permission',
    sa.Column('id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('name', sa.VARCHAR(length=100), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name='ab_permission_pkey'),
    sa.UniqueConstraint('name', name='ab_permission_name_key')
    )
    op.create_table('ab_user_group',
    sa.Column('id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('user_id', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('group_id', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.ForeignKeyConstraint(['group_id'], ['ab_group.id'], name='ab_user_group_group_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['ab_user.id'], name='ab_user_group_user_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='ab_user_group_pkey'),
    sa.UniqueConstraint('user_id', 'group_id', name='ab_user_group_user_id_group_id_key')
    )
    op.create_index('idx_user_id', 'ab_user_group', ['user_id'], unique=False)
    op.create_index('idx_user_group_id', 'ab_user_group', ['group_id'], unique=False)
    op.create_table('ab_user_role',
    sa.Column('id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('user_id', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('role_id', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.ForeignKeyConstraint(['role_id'], ['ab_role.id'], name='ab_user_role_role_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['ab_user.id'], name='ab_user_role_user_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='ab_user_role_pkey'),
    sa.UniqueConstraint('user_id', 'role_id', name='ab_user_role_user_id_role_id_key')
    )
    op.create_table('ecom_loyalty_accounts',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), autoincrement=False, nullable=False),
    sa.Column('customer_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('points_balance', sa.INTEGER(), server_default=sa.text('0'), autoincrement=False, nullable=False),
    sa.Column('lifetime_points', sa.INTEGER(), server_default=sa.text('0'), autoincrement=False, nullable=False),
    sa.Column('tier_id', sa.UUID(), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['customer_id'], ['ecom_customers.id'], name='ecom_loyalty_accounts_customer_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['tier_id'], ['ecom_loyalty_tiers.id'], name='ecom_loyalty_accounts_tier_id_fkey', ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name='ecom_loyalty_accounts_pkey'),
    postgresql_ignore_search_path=False
    )
    op.create_index('ix_ecom_loyalty_accounts_customer_id', 'ecom_loyalty_accounts', ['customer_id'], unique=True)
    op.create_table('ecom_b2b_quotes',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), autoincrement=False, nullable=False),
    sa.Column('company_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('requested_by', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('status', sa.VARCHAR(length=20), server_default=sa.text("'draft'::character varying"), autoincrement=False, nullable=False),
    sa.Column('notes', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('admin_notes', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('valid_until', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
    sa.Column('converted_order_id', sa.UUID(), autoincrement=False, nullable=True),
    sa.Column('po_number', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['company_id'], ['ecom_b2b_companies.id'], name='ecom_b2b_quotes_company_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['converted_order_id'], ['ecom_orders.id'], name='ecom_b2b_quotes_converted_order_id_fkey', ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['requested_by'], ['ecom_customers.id'], name='ecom_b2b_quotes_requested_by_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='ecom_b2b_quotes_pkey')
    )
    op.create_index('ix_ecom_b2b_quotes_status', 'ecom_b2b_quotes', ['status'], unique=False)
    op.create_index('ix_ecom_b2b_quotes_company_id', 'ecom_b2b_quotes', ['company_id'], unique=False)
    op.create_table('project_time_log_entries',
    sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('task_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('user_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('description', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('hours', sa.NUMERIC(precision=8, scale=2), autoincrement=False, nullable=False),
    sa.Column('logged_date', sa.DATE(), autoincrement=False, nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['task_id'], ['project_tasks.id'], name='project_time_log_entries_task_id_fkey'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='project_time_log_entries_user_id_fkey'),
    sa.PrimaryKeyConstraint('id', name='project_time_log_entries_pkey')
    )
    op.create_index('ix_time_log_entries_task', 'project_time_log_entries', ['task_id'], unique=False)
    op.create_table('ab_group',
    sa.Column('id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('name', sa.VARCHAR(length=100), autoincrement=False, nullable=False),
    sa.Column('label', sa.VARCHAR(length=150), autoincrement=False, nullable=True),
    sa.Column('description', sa.VARCHAR(length=512), autoincrement=False, nullable=True),
    sa.PrimaryKeyConstraint('id', name='ab_group_pkey'),
    sa.UniqueConstraint('name', name='ab_group_name_key')
    )
    op.create_table('ecom_loyalty_transactions',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), autoincrement=False, nullable=False),
    sa.Column('account_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('transaction_type', sa.VARCHAR(length=20), autoincrement=False, nullable=False),
    sa.Column('points', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('reference_id', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('note', sa.VARCHAR(length=500), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['account_id'], ['ecom_loyalty_accounts.id'], name='ecom_loyalty_transactions_account_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='ecom_loyalty_transactions_pkey')
    )
    op.create_index('ix_ecom_loyalty_transactions_account_id', 'ecom_loyalty_transactions', ['account_id'], unique=False)
    op.drop_table('shared_mailboxes')
    op.drop_table('push_subscriptions')
    op.drop_table('mail_webhooks')
    op.drop_table('mail_templates')
    op.drop_table('mail_smart_folders')
    op.drop_table('mail_search_folders')
    op.drop_table('mail_retention_policies')
    op.drop_table('mail_quick_steps')
    op.drop_table('mail_polls')
    op.drop_table('mail_contact_profiles')
    op.drop_table('mail_categories')
    op.drop_table('mail_annotations')
    op.drop_table('mail_accounts')
    op.drop_table('focused_inbox_scores')
    op.drop_table('dlp_policies')
    # ### end Alembic commands ###
