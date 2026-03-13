"""add_perf_web_vitals

Revision ID: bc1d2e3f4a5b
Revises: ab1c2d3e4f5a
Create Date: 2026-03-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'bc1d2e3f4a5b'
down_revision = 'ab1c2d3e4f5a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'perf_web_vitals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=20), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('rating', sa.String(length=20), nullable=False),
        sa.Column('url', sa.String(length=500), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_perf_web_vitals_name', 'perf_web_vitals', ['name'])
    op.create_index('ix_perf_web_vitals_created_at', 'perf_web_vitals', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_perf_web_vitals_created_at', table_name='perf_web_vitals')
    op.drop_index('ix_perf_web_vitals_name', table_name='perf_web_vitals')
    op.drop_table('perf_web_vitals')
