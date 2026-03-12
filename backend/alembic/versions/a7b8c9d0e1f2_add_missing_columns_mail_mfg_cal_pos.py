"""Add missing columns: mail advanced fields, mfg ext, calendar sensitivity, pos bundle/giftcard

Revision ID: a7b8c9d0e1f2
Revises: d1e2f3g4h5i6
Create Date: 2026-03-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'a7b8c9d0e1f2'
down_revision = 'd1e2f3g4h5i6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── mailbox_messages: multi-account + advanced mail features ──────────────
    op.add_column('mailbox_messages', sa.Column('account_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('mailbox_messages', sa.Column('is_pinned', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('mailbox_messages', sa.Column('flag_status', sa.String(length=20), nullable=False, server_default='none'))
    op.add_column('mailbox_messages', sa.Column('flag_due_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('mailbox_messages', sa.Column('flag_reminder_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('mailbox_messages', sa.Column('category_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'))
    op.add_column('mailbox_messages', sa.Column('sensitivity_label_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('mailbox_messages', sa.Column('display_format', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('mailbox_messages', sa.Column('scheduled_send_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('mailbox_messages', sa.Column('priority_score', sa.Float(), nullable=True))
    op.add_column('mailbox_messages', sa.Column('ai_category', sa.String(length=50), nullable=True))
    op.add_column('mailbox_messages', sa.Column('ai_summary', sa.Text(), nullable=True))
    op.add_column('mailbox_messages', sa.Column('ai_triage', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('mailbox_messages', sa.Column('predicted_actions', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.create_index('ix_mailbox_messages_account_id', 'mailbox_messages', ['account_id'], unique=False)
    op.create_index('ix_mailbox_messages_priority_score', 'mailbox_messages', ['priority_score'], unique=False)

    # ── mfg_work_orders: cost breakdown ───────────────────────────────────────
    op.add_column('mfg_work_orders', sa.Column('total_overhead_cost', sa.Numeric(14, 2), nullable=False, server_default='0'))

    # ── mfg_workstations: real-time status ────────────────────────────────────
    op.add_column('mfg_workstations', sa.Column('current_status', sa.String(length=30), nullable=False, server_default='idle'))

    # ── calendar_events: sensitivity / privacy ────────────────────────────────
    op.add_column('calendar_events', sa.Column('sensitivity', sa.String(length=20), nullable=False, server_default='normal'))

    # ── pos_bundles: description ──────────────────────────────────────────────
    op.add_column('pos_bundles', sa.Column('description', sa.Text(), nullable=True))

    # ── pos_gift_cards: issued_by ─────────────────────────────────────────────
    op.add_column('pos_gift_cards', sa.Column('issued_by', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_pos_gift_cards_issued_by',
        'pos_gift_cards', 'users',
        ['issued_by'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_pos_gift_cards_issued_by', 'pos_gift_cards', type_='foreignkey')
    op.drop_column('pos_gift_cards', 'issued_by')
    op.drop_column('pos_bundles', 'description')
    op.drop_column('calendar_events', 'sensitivity')
    op.drop_column('mfg_workstations', 'current_status')
    op.drop_column('mfg_work_orders', 'total_overhead_cost')
    op.drop_index('ix_mailbox_messages_priority_score', table_name='mailbox_messages')
    op.drop_index('ix_mailbox_messages_account_id', table_name='mailbox_messages')
    op.drop_column('mailbox_messages', 'predicted_actions')
    op.drop_column('mailbox_messages', 'ai_triage')
    op.drop_column('mailbox_messages', 'ai_summary')
    op.drop_column('mailbox_messages', 'ai_category')
    op.drop_column('mailbox_messages', 'priority_score')
    op.drop_column('mailbox_messages', 'scheduled_send_at')
    op.drop_column('mailbox_messages', 'display_format')
    op.drop_column('mailbox_messages', 'sensitivity_label_id')
    op.drop_column('mailbox_messages', 'category_ids')
    op.drop_column('mailbox_messages', 'flag_reminder_at')
    op.drop_column('mailbox_messages', 'flag_due_date')
    op.drop_column('mailbox_messages', 'flag_status')
    op.drop_column('mailbox_messages', 'is_pinned')
    op.drop_column('mailbox_messages', 'account_id')
