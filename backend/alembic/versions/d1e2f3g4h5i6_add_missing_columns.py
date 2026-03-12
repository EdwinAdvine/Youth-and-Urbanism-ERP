"""Add missing columns to tickets, crm_pipelines, crm_sales_activities

Revision ID: d1e2f3g4h5i6
Revises: bcb892522ee3
Create Date: 2026-03-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'd1e2f3g4h5i6'
down_revision = 'bcb892522ee3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── tickets: add omnichannel + AI sentiment + custom fields ────────────────
    op.add_column('tickets', sa.Column('channel', sa.String(length=30), nullable=True))
    op.add_column('tickets', sa.Column('sentiment_score', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('sentiment_label', sa.String(length=20), nullable=True))
    op.add_column('tickets', sa.Column('custom_fields', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    # Set default for existing rows
    op.execute("UPDATE tickets SET channel = 'web' WHERE channel IS NULL")
    # Create index on channel
    op.create_index('ix_tickets_channel', 'tickets', ['channel'], unique=False)

    # ── crm_pipelines: add is_active ──────────────────────────────────────────
    op.add_column('crm_pipelines', sa.Column('is_active', sa.Boolean(), nullable=True))
    op.execute("UPDATE crm_pipelines SET is_active = true WHERE is_active IS NULL")

    # ── crm_sales_activities: add missing columns ─────────────────────────────
    op.add_column('crm_sales_activities', sa.Column('lead_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('crm_sales_activities', sa.Column('opportunity_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('crm_sales_activities', sa.Column('assigned_to', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('crm_sales_activities', sa.Column('duration_minutes', sa.Integer(), nullable=True))
    op.add_column('crm_sales_activities', sa.Column('outcome', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('crm_sales_activities', 'outcome')
    op.drop_column('crm_sales_activities', 'duration_minutes')
    op.drop_column('crm_sales_activities', 'assigned_to')
    op.drop_column('crm_sales_activities', 'opportunity_id')
    op.drop_column('crm_sales_activities', 'lead_id')
    op.drop_column('crm_pipelines', 'is_active')
    op.drop_index('ix_tickets_channel', table_name='tickets')
    op.drop_column('tickets', 'custom_fields')
    op.drop_column('tickets', 'sentiment_label')
    op.drop_column('tickets', 'sentiment_score')
    op.drop_column('tickets', 'channel')
