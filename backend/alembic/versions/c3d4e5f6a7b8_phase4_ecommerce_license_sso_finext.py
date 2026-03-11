"""phase4_ecommerce_license_sso_finance_payroll_ext

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-10 23:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── E-Commerce ──────────────────────────────────────────────────────────
    op.create_table(
        'ecom_stores',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('slug', sa.String(200), unique=True, nullable=False),
        sa.Column('currency', sa.String(10), server_default='KES'),
        sa.Column('settings_json', postgresql.JSON, nullable=True),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'ecom_products',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('store_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ecom_stores.id'), nullable=False),
        sa.Column('inventory_item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('inventory_items.id'), nullable=True),
        sa.Column('display_name', sa.String(300), nullable=False),
        sa.Column('slug', sa.String(300), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('images', postgresql.JSON, server_default='[]'),
        sa.Column('price', sa.Numeric(12, 2), nullable=False),
        sa.Column('compare_at_price', sa.Numeric(12, 2), nullable=True),
        sa.Column('is_published', sa.Boolean, server_default='false'),
        sa.Column('seo_title', sa.String(300), nullable=True),
        sa.Column('seo_description', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_ecom_products_store_slug', 'ecom_products', ['store_id', 'slug'], unique=True)

    op.create_table(
        'ecom_customer_accounts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('store_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ecom_stores.id'), nullable=False),
        sa.Column('email', sa.String(320), nullable=False),
        sa.Column('password_hash', sa.String(200), nullable=False),
        sa.Column('first_name', sa.String(100), nullable=True),
        sa.Column('last_name', sa.String(100), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('crm_contact_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('crm_contacts.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_ecom_customers_store_email', 'ecom_customer_accounts', ['store_id', 'email'], unique=True)

    op.create_table(
        'ecom_shipping_addresses',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ecom_customer_accounts.id'), nullable=False),
        sa.Column('label', sa.String(100), nullable=True),
        sa.Column('address_line1', sa.String(300), nullable=False),
        sa.Column('address_line2', sa.String(300), nullable=True),
        sa.Column('city', sa.String(100), nullable=False),
        sa.Column('state', sa.String(100), nullable=True),
        sa.Column('postal_code', sa.String(20), nullable=True),
        sa.Column('country', sa.String(100), server_default='Kenya'),
        sa.Column('is_default', sa.Boolean, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'ecom_carts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('store_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ecom_stores.id'), nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ecom_customer_accounts.id'), nullable=True),
        sa.Column('session_key', sa.String(200), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'ecom_cart_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('cart_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ecom_carts.id'), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ecom_products.id'), nullable=False),
        sa.Column('quantity', sa.Integer, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'ecom_orders',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('store_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ecom_stores.id'), nullable=False),
        sa.Column('order_number', sa.String(30), unique=True, nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ecom_customer_accounts.id'), nullable=False),
        sa.Column('status', sa.String(30), server_default='pending'),
        sa.Column('shipping_address_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ecom_shipping_addresses.id'), nullable=True),
        sa.Column('subtotal', sa.Numeric(14, 2), nullable=False),
        sa.Column('tax', sa.Numeric(14, 2), server_default='0'),
        sa.Column('shipping_cost', sa.Numeric(14, 2), server_default='0'),
        sa.Column('total', sa.Numeric(14, 2), nullable=False),
        sa.Column('tracking_number', sa.String(200), nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_ecom_orders_customer', 'ecom_orders', ['customer_id'])
    op.create_index('ix_ecom_orders_status', 'ecom_orders', ['status'])

    op.create_table(
        'ecom_order_lines',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ecom_orders.id'), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ecom_products.id'), nullable=False),
        sa.Column('product_name', sa.String(300), nullable=False),
        sa.Column('quantity', sa.Integer, nullable=False),
        sa.Column('unit_price', sa.Numeric(12, 2), nullable=False),
        sa.Column('total', sa.Numeric(12, 2), nullable=False),
    )

    # ── License ─────────────────────────────────────────────────────────────
    op.create_table(
        'licenses',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('license_key', sa.String(500), unique=True, nullable=False),
        sa.Column('license_type', sa.String(30), nullable=False, server_default='trial'),
        sa.Column('max_users', sa.Integer, nullable=False, server_default='5'),
        sa.Column('features', postgresql.JSON, server_default='{}'),
        sa.Column('issued_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── SSO ──────────────────────────────────────────────────────────────────
    op.create_table(
        'sso_providers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('provider_type', sa.String(30), nullable=False),
        sa.Column('client_id', sa.String(500), nullable=False),
        sa.Column('client_secret', sa.String(1000), nullable=False),
        sa.Column('authorization_url', sa.String(1000), nullable=True),
        sa.Column('token_url', sa.String(1000), nullable=True),
        sa.Column('userinfo_url', sa.String(1000), nullable=True),
        sa.Column('redirect_uri', sa.String(1000), nullable=True),
        sa.Column('scopes', sa.String(500), nullable=True),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'sso_user_mappings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('provider_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sso_providers.id'), nullable=False),
        sa.Column('external_id', sa.String(500), nullable=False),
        sa.Column('external_email', sa.String(320), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_sso_mapping_provider_ext', 'sso_user_mappings', ['provider_id', 'external_id'], unique=True)

    # ── Finance Extensions ──────────────────────────────────────────────────
    op.create_table(
        'finance_currencies',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('code', sa.String(3), unique=True, nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('symbol', sa.String(10), nullable=True),
        sa.Column('is_base', sa.Boolean, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'finance_exchange_rates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('from_currency_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('finance_currencies.id'), nullable=False),
        sa.Column('to_currency_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('finance_currencies.id'), nullable=False),
        sa.Column('rate', sa.Numeric(18, 8), nullable=False),
        sa.Column('effective_date', sa.Date, nullable=False),
    )
    op.create_index('ix_finance_exchange_rates_date', 'finance_exchange_rates', ['from_currency_id', 'to_currency_id', 'effective_date'])

    op.create_table(
        'finance_bank_statements',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('account_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('finance_accounts.id'), nullable=False),
        sa.Column('statement_date', sa.Date, nullable=False),
        sa.Column('opening_balance', sa.Numeric(14, 2), nullable=False),
        sa.Column('closing_balance', sa.Numeric(14, 2), nullable=False),
        sa.Column('file_url', sa.String(1000), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'finance_bank_statement_lines',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('statement_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('finance_bank_statements.id'), nullable=False),
        sa.Column('date', sa.Date, nullable=False),
        sa.Column('description', sa.String(500), nullable=False),
        sa.Column('amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('matched_payment_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('finance_payments.id'), nullable=True),
        sa.Column('status', sa.String(20), server_default='unmatched'),
    )

    op.create_table(
        'finance_reconciliations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('statement_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('finance_bank_statements.id'), nullable=False),
        sa.Column('reconciled_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('reconciled_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('notes', sa.Text, nullable=True),
    )

    # ── Payroll Extensions ──────────────────────────────────────────────────
    op.create_table(
        'hr_tax_brackets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('country_code', sa.String(5), server_default='KE'),
        sa.Column('min_amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('max_amount', sa.Numeric(14, 2), nullable=True),
        sa.Column('rate', sa.Numeric(8, 4), nullable=False),
        sa.Column('effective_from', sa.Date, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'hr_statutory_deductions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('country_code', sa.String(5), server_default='KE'),
        sa.Column('calculation_type', sa.String(20), nullable=False),
        sa.Column('value', sa.Numeric(12, 4), nullable=False),
        sa.Column('max_amount', sa.Numeric(14, 2), nullable=True),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'hr_pay_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('period_start', sa.Date, nullable=False),
        sa.Column('period_end', sa.Date, nullable=False),
        sa.Column('status', sa.String(20), server_default='draft'),
        sa.Column('total_gross', sa.Numeric(14, 2), server_default='0'),
        sa.Column('total_deductions', sa.Numeric(14, 2), server_default='0'),
        sa.Column('total_net', sa.Numeric(14, 2), server_default='0'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Add pay_run_id FK to existing payslips table
    op.add_column('hr_payslips', sa.Column('pay_run_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('hr_pay_runs.id'), nullable=True))

    # ── Time Log Entry for Projects ─────────────────────────────────────────
    # Check if time_logs table already exists (may have been created in earlier migrations)
    # The projects.TimeLog model uses 'project_time_logs' table
    op.create_table(
        'project_time_log_entries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('task_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('project_tasks.id'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('hours', sa.Numeric(8, 2), nullable=False),
        sa.Column('logged_date', sa.Date, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_time_log_entries_task', 'project_time_log_entries', ['task_id'])


def downgrade() -> None:
    op.drop_index('ix_time_log_entries_task')
    op.drop_table('project_time_log_entries')
    op.drop_column('hr_payslips', 'pay_run_id')
    op.drop_table('hr_pay_runs')
    op.drop_table('hr_statutory_deductions')
    op.drop_table('hr_tax_brackets')
    op.drop_table('finance_reconciliations')
    op.drop_table('finance_bank_statement_lines')
    op.drop_table('finance_bank_statements')
    op.drop_index('ix_finance_exchange_rates_date')
    op.drop_table('finance_exchange_rates')
    op.drop_table('finance_currencies')
    op.drop_index('ix_sso_mapping_provider_ext')
    op.drop_table('sso_user_mappings')
    op.drop_table('sso_providers')
    op.drop_table('licenses')
    op.drop_table('ecom_order_lines')
    op.drop_index('ix_ecom_orders_status')
    op.drop_index('ix_ecom_orders_customer')
    op.drop_table('ecom_orders')
    op.drop_table('ecom_cart_items')
    op.drop_table('ecom_carts')
    op.drop_table('ecom_shipping_addresses')
    op.drop_index('ix_ecom_customers_store_email')
    op.drop_table('ecom_customer_accounts')
    op.drop_index('ix_ecom_products_store_slug')
    op.drop_table('ecom_products')
    op.drop_table('ecom_stores')
