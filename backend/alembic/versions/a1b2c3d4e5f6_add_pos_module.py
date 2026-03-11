"""add_pos_module

Revision ID: a1b2c3d4e5f6
Revises: 0aef716d191a
Create Date: 2026-03-10 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '0aef716d191a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # POS Sessions
    op.create_table(
        'pos_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_number', sa.String(30), unique=True, nullable=False),
        sa.Column('cashier_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('warehouse_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('inventory_warehouses.id'), nullable=False),
        sa.Column('opened_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('opening_balance', sa.Numeric(15, 2), nullable=False),
        sa.Column('closing_balance', sa.Numeric(15, 2), nullable=True),
        sa.Column('expected_balance', sa.Numeric(15, 2), nullable=True),
        sa.Column('difference', sa.Numeric(15, 2), nullable=True),
        sa.Column('status', sa.String(20), server_default='open', nullable=False),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # POS Transactions
    op.create_table(
        'pos_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('transaction_number', sa.String(30), unique=True, nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('pos_sessions.id'), nullable=False),
        sa.Column('customer_name', sa.String(200), nullable=True),
        sa.Column('customer_email', sa.String(200), nullable=True),
        sa.Column('subtotal', sa.Numeric(15, 2), nullable=False),
        sa.Column('discount_amount', sa.Numeric(15, 2), server_default='0', nullable=False),
        sa.Column('discount_type', sa.String(20), nullable=True),
        sa.Column('tax_amount', sa.Numeric(15, 2), server_default='0', nullable=False),
        sa.Column('total', sa.Numeric(15, 2), nullable=False),
        sa.Column('status', sa.String(20), server_default='completed', nullable=False),
        sa.Column('receipt_data', postgresql.JSON, nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # POS Transaction Lines
    op.create_table(
        'pos_transaction_lines',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('transaction_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('pos_transactions.id'), nullable=False),
        sa.Column('item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('inventory_items.id'), nullable=False),
        sa.Column('item_name', sa.String(200), nullable=False),
        sa.Column('item_sku', sa.String(50), nullable=False),
        sa.Column('quantity', sa.Integer, nullable=False),
        sa.Column('unit_price', sa.Numeric(12, 2), nullable=False),
        sa.Column('discount_amount', sa.Numeric(12, 2), server_default='0', nullable=False),
        sa.Column('line_total', sa.Numeric(12, 2), nullable=False),
    )

    # POS Payments
    op.create_table(
        'pos_payments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('transaction_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('pos_transactions.id'), nullable=False),
        sa.Column('payment_method', sa.String(30), nullable=False),
        sa.Column('amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('reference', sa.String(200), nullable=True),
        sa.Column('change_given', sa.Numeric(15, 2), server_default='0', nullable=False),
    )

    # Indexes for performance
    op.create_index('ix_pos_sessions_cashier_status', 'pos_sessions', ['cashier_id', 'status'])
    op.create_index('ix_pos_transactions_session', 'pos_transactions', ['session_id'])
    op.create_index('ix_pos_transactions_created_at', 'pos_transactions', ['created_at'])
    op.create_index('ix_pos_transaction_lines_txn', 'pos_transaction_lines', ['transaction_id'])
    op.create_index('ix_pos_payments_txn', 'pos_payments', ['transaction_id'])


def downgrade() -> None:
    op.drop_index('ix_pos_payments_txn')
    op.drop_index('ix_pos_transaction_lines_txn')
    op.drop_index('ix_pos_transactions_created_at')
    op.drop_index('ix_pos_transactions_session')
    op.drop_index('ix_pos_sessions_cashier_status')
    op.drop_table('pos_payments')
    op.drop_table('pos_transaction_lines')
    op.drop_table('pos_transactions')
    op.drop_table('pos_sessions')
