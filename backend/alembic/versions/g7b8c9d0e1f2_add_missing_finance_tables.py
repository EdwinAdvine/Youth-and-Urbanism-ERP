"""add_missing_finance_tables

Revision ID: g7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-03-11

Creates tables for: Expense, VendorBill, FixedAsset, RecurringInvoice, BankReconciliation
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "g7b8c9d0e1f2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── RecurringInvoice ──────────────────────────────────────────────────
    op.create_table(
        'finance_recurring_invoices',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('invoice_type', sa.String(20), nullable=False, server_default='sales'),
        sa.Column('customer_name', sa.String(200), nullable=True),
        sa.Column('customer_email', sa.String(200), nullable=True),
        sa.Column('items', postgresql.JSON(), nullable=True),
        sa.Column('subtotal', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('tax_amount', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('total', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('currency', sa.String(3), nullable=False, server_default='USD'),
        sa.Column('frequency', sa.String(20), nullable=False, server_default='monthly'),
        sa.Column('next_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── Expense ───────────────────────────────────────────────────────────
    op.create_table(
        'finance_expenses',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('description', sa.String(500), nullable=False),
        sa.Column('amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('currency', sa.String(3), nullable=False, server_default='USD'),
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('expense_date', sa.Date(), nullable=False),
        sa.Column('receipt_file_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('drive_files.id', ondelete='SET NULL'), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('approver_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('account_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('finance_accounts.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── VendorBill ────────────────────────────────────────────────────────
    op.create_table(
        'finance_vendor_bills',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('bill_number', sa.String(50), unique=True, nullable=False),
        sa.Column('vendor_name', sa.String(200), nullable=False),
        sa.Column('vendor_email', sa.String(200), nullable=True),
        sa.Column('bill_type', sa.String(20), nullable=False, server_default='expense'),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('issue_date', sa.Date(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('items', postgresql.JSON(), nullable=True),
        sa.Column('subtotal', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('tax_amount', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('total', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('currency', sa.String(3), nullable=False, server_default='USD'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('payment_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('finance_payments.id'), nullable=True),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── FixedAsset ────────────────────────────────────────────────────────
    op.create_table(
        'finance_fixed_assets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('asset_number', sa.String(50), unique=True, nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('purchase_date', sa.Date(), nullable=False),
        sa.Column('purchase_cost', sa.Numeric(15, 2), nullable=False),
        sa.Column('salvage_value', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('useful_life_months', sa.Integer(), nullable=False),
        sa.Column('depreciation_method', sa.String(30), nullable=False, server_default='straight_line'),
        sa.Column('accumulated_depreciation', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('current_value', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('disposed_date', sa.Date(), nullable=True),
        sa.Column('disposed_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('account_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('finance_accounts.id'), nullable=True),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── BankReconciliation ────────────────────────────────────────────────
    op.create_table(
        'finance_bank_reconciliations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('account_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('finance_accounts.id'), nullable=False),
        sa.Column('statement_date', sa.Date(), nullable=False),
        sa.Column('statement_balance', sa.Numeric(15, 2), nullable=False),
        sa.Column('reconciled_balance', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('reconciled_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('reconciled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('items', postgresql.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('finance_bank_reconciliations')
    op.drop_table('finance_fixed_assets')
    op.drop_table('finance_vendor_bills')
    op.drop_table('finance_expenses')
    op.drop_table('finance_recurring_invoices')
