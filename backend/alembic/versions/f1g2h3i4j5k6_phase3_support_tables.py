"""Create missing Phase 3 support tables

Revision ID: f1g2h3i4j5k6
Revises: 02568862bbaf
Create Date: 2026-03-13

Creates: support_analytics_snapshots, agent_shifts, agent_skills, proactive_rules,
         support_sandboxes, customer_health_scores, voice_call_records
"""
from __future__ import annotations
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f1g2h3i4j5k6'
down_revision: Union[str, None] = '02568862bbaf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('support_analytics_snapshots',
    sa.Column('snapshot_date', sa.DateTime(timezone=True), nullable=False),
    sa.Column('new_tickets', sa.Integer(), nullable=False),
    sa.Column('resolved_tickets', sa.Integer(), nullable=False),
    sa.Column('closed_tickets', sa.Integer(), nullable=False),
    sa.Column('reopened_tickets', sa.Integer(), nullable=False),
    sa.Column('backlog_count', sa.Integer(), nullable=False),
    sa.Column('sla_compliance_pct', sa.Float(), nullable=True),
    sa.Column('avg_response_minutes', sa.Float(), nullable=True),
    sa.Column('avg_resolution_minutes', sa.Float(), nullable=True),
    sa.Column('avg_csat', sa.Float(), nullable=True),
    sa.Column('csat_responses', sa.Integer(), nullable=False),
    sa.Column('ai_classified_count', sa.Integer(), nullable=False),
    sa.Column('ai_auto_responded_count', sa.Integer(), nullable=False),
    sa.Column('ai_deflected_count', sa.Integer(), nullable=False),
    sa.Column('channel_breakdown', postgresql.JSON(astext_type=sa.Text()), nullable=True),
    sa.Column('priority_breakdown', postgresql.JSON(astext_type=sa.Text()), nullable=True),
    sa.Column('category_breakdown', postgresql.JSON(astext_type=sa.Text()), nullable=True),
    sa.Column('agent_performance', postgresql.JSON(astext_type=sa.Text()), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('agent_shifts',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('day_of_week', sa.Integer(), nullable=False),
    sa.Column('start_time', sa.String(length=5), nullable=False),
    sa.Column('end_time', sa.String(length=5), nullable=False),
    sa.Column('timezone', sa.String(length=50), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('agent_skills',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('skill_name', sa.String(length=200), nullable=False),
    sa.Column('proficiency', sa.Integer(), nullable=False),
    sa.Column('is_primary', sa.Boolean(), nullable=False),
    sa.Column('max_concurrent', sa.Integer(), nullable=False),
    sa.Column('languages', postgresql.ARRAY(sa.String()), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('proactive_rules',
    sa.Column('name', sa.String(length=300), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('trigger_type', sa.String(length=30), nullable=False),
    sa.Column('trigger_conditions', postgresql.JSON(astext_type=sa.Text()), nullable=True),
    sa.Column('actions', postgresql.JSON(astext_type=sa.Text()), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('execution_count', sa.Integer(), nullable=False),
    sa.Column('last_triggered_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('support_sandboxes',
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('config_snapshot', postgresql.JSON(astext_type=sa.Text()), nullable=True),
    sa.Column('test_results', postgresql.JSON(astext_type=sa.Text()), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('customer_health_scores',
    sa.Column('customer_email', sa.String(length=320), nullable=False),
    sa.Column('contact_id', sa.UUID(), nullable=True),
    sa.Column('overall_score', sa.Integer(), nullable=False),
    sa.Column('engagement_score', sa.Integer(), nullable=False),
    sa.Column('satisfaction_score', sa.Integer(), nullable=False),
    sa.Column('effort_score', sa.Integer(), nullable=False),
    sa.Column('ticket_frequency', sa.Float(), nullable=True),
    sa.Column('avg_sentiment', sa.Float(), nullable=True),
    sa.Column('avg_csat', sa.Float(), nullable=True),
    sa.Column('last_ticket_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('total_tickets', sa.Integer(), nullable=False),
    sa.Column('risk_level', sa.String(length=20), nullable=False),
    sa.Column('churn_probability', sa.Float(), nullable=True),
    sa.Column('score_factors', postgresql.JSON(astext_type=sa.Text()), nullable=True),
    sa.Column('computed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['contact_id'], ['crm_contacts.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('voice_call_records',
    sa.Column('ticket_id', sa.UUID(), nullable=True),
    sa.Column('agent_id', sa.UUID(), nullable=True),
    sa.Column('customer_phone', sa.String(length=30), nullable=True),
    sa.Column('customer_name', sa.String(length=300), nullable=True),
    sa.Column('direction', sa.String(length=10), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('answered_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('duration_seconds', sa.Integer(), nullable=False),
    sa.Column('wait_seconds', sa.Integer(), nullable=False),
    sa.Column('recording_url', sa.String(length=500), nullable=True),
    sa.Column('transcript', sa.Text(), nullable=True),
    sa.Column('sentiment_score', sa.Float(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['agent_id'], ['users.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['ticket_id'], ['tickets.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_support_analytics_snapshots_snapshot_date'), 'support_analytics_snapshots', ['snapshot_date'], unique=False)
    op.create_index(op.f('ix_agent_shifts_user_id'), 'agent_shifts', ['user_id'], unique=False)
    op.create_index(op.f('ix_agent_skills_skill_name'), 'agent_skills', ['skill_name'], unique=False)
    op.create_index(op.f('ix_agent_skills_user_id'), 'agent_skills', ['user_id'], unique=False)
    op.create_index(op.f('ix_customer_health_scores_contact_id'), 'customer_health_scores', ['contact_id'], unique=False)
    op.create_index(op.f('ix_customer_health_scores_customer_email'), 'customer_health_scores', ['customer_email'], unique=False)
    op.create_index(op.f('ix_voice_call_records_agent_id'), 'voice_call_records', ['agent_id'], unique=False)
    op.create_index(op.f('ix_voice_call_records_ticket_id'), 'voice_call_records', ['ticket_id'], unique=False)

def downgrade() -> None:
    op.drop_table('voice_call_records')
    op.drop_table('customer_health_scores')
    op.drop_table('support_sandboxes')
    op.drop_table('proactive_rules')
    op.drop_table('agent_skills')
    op.drop_table('agent_shifts')
    op.drop_table('support_analytics_snapshots')
