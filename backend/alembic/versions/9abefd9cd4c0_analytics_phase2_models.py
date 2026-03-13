"""analytics_phase2_models

Revision ID: 9abefd9cd4c0
Revises: 56db987dbfa3
Create Date: 2026-03-13 08:10:00.000000

Adds 4 new analytics tables:
  - analytics_usage_logs
  - dashboard_rls
  - dashboard_shares
  - analytics_embed_tokens
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '9abefd9cd4c0'
down_revision: Union[str, None] = '56db987dbfa3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── analytics_usage_logs ──────────────────────────────────────────────────
    op.create_table(
        'analytics_usage_logs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('resource_type', sa.String(), nullable=False),
        sa.Column('resource_id', sa.String(), nullable=True),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── dashboard_rls ─────────────────────────────────────────────────────────
    op.create_table(
        'dashboard_rls',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('dashboard_id', sa.UUID(), nullable=False),
        sa.Column('role', sa.String(), nullable=True),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('field', sa.String(), nullable=False),
        sa.Column('operator', sa.String(), nullable=False),
        sa.Column('value_template', sa.String(), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['dashboard_id'], ['analytics_dashboards.id'], ondelete='CASCADE'
        ),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── dashboard_shares ──────────────────────────────────────────────────────
    op.create_table(
        'dashboard_shares',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('dashboard_id', sa.UUID(), nullable=False),
        sa.Column('shared_with_user_id', sa.String(), nullable=True),
        sa.Column('shared_with_role', sa.String(), nullable=True),
        sa.Column('is_public', sa.Boolean(), nullable=False),
        sa.Column('permission', sa.String(), nullable=False),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ['dashboard_id'], ['analytics_dashboards.id'], ondelete='CASCADE'
        ),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── analytics_embed_tokens ────────────────────────────────────────────────
    op.create_table(
        'analytics_embed_tokens',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('token', sa.String(), nullable=False),
        sa.Column('dashboard_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('allowed_origins', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('view_count', sa.Integer(), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['dashboard_id'], ['analytics_dashboards.id'], ondelete='CASCADE'
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token'),
    )


def downgrade() -> None:
    op.drop_table('analytics_embed_tokens')
    op.drop_table('dashboard_shares')
    op.drop_table('dashboard_rls')
    op.drop_table('analytics_usage_logs')
