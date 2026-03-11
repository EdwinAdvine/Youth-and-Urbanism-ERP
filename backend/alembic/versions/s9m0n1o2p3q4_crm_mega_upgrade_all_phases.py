"""CRM Mega Upgrade — all 3 phases (MVP + Phase 2 + Phase 3).

Adds columns to Contact/Lead/Opportunity, creates 33 new tables.

Revision ID: s9m0n1o2p3q4
Revises: r8l9m0n1o2p3
Create Date: 2026-03-11
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "s9m0n1o2p3q4"
down_revision = "r8l9m0n1o2p3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── MVP: Column additions to existing tables ─────────────────────────────

    # Contact additions
    op.add_column("crm_contacts", sa.Column("website", sa.String(500), nullable=True))
    op.add_column("crm_contacts", sa.Column("industry", sa.String(100), nullable=True))
    op.add_column("crm_contacts", sa.Column("annual_revenue", sa.Numeric(15, 2), nullable=True))
    op.add_column("crm_contacts", sa.Column("employee_count", sa.Integer(), nullable=True))
    op.add_column("crm_contacts", sa.Column("lifecycle_stage", sa.String(30), server_default="subscriber", nullable=True))
    op.add_column("crm_contacts", sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("crm_contacts", sa.Column("custom_fields", postgresql.JSON(), nullable=True))
    op.add_column("crm_contacts", sa.Column("social_profiles", postgresql.JSON(), nullable=True))
    op.add_column("crm_contacts", sa.Column("score", sa.Integer(), server_default="0", nullable=True))
    op.create_index("ix_crm_contacts_lifecycle_stage", "crm_contacts", ["lifecycle_stage"])

    # Lead additions
    op.add_column("crm_leads", sa.Column("score", sa.Integer(), server_default="0", nullable=True))
    op.add_column("crm_leads", sa.Column("score_factors", postgresql.JSON(), nullable=True))
    op.add_column("crm_leads", sa.Column("scored_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("crm_leads", sa.Column("custom_fields", postgresql.JSON(), nullable=True))

    # Opportunity additions
    op.add_column("crm_opportunities", sa.Column("pipeline_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("crm_opportunities", sa.Column("swimlane", sa.String(50), nullable=True))
    op.add_column("crm_opportunities", sa.Column("weighted_value", sa.Numeric(15, 2), nullable=True))
    op.add_column("crm_opportunities", sa.Column("loss_reason", sa.String(200), nullable=True))
    op.add_column("crm_opportunities", sa.Column("custom_fields", postgresql.JSON(), nullable=True))

    # ── MVP: New tables ──────────────────────────────────────────────────────

    op.create_table(
        "crm_contact_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_contacts.id"), nullable=False),
        sa.Column("note_type", sa.String(30), nullable=False),
        sa.Column("subject", sa.String(300), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_custom_field_definitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("field_name", sa.String(100), nullable=False),
        sa.Column("field_label", sa.String(200), nullable=False),
        sa.Column("field_type", sa.String(30), nullable=False),
        sa.Column("options", postgresql.JSON(), nullable=True),
        sa.Column("is_required", sa.Boolean(), server_default="false"),
        sa.Column("display_order", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_duplicate_candidates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("contact_a_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_contacts.id"), nullable=False),
        sa.Column("contact_b_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_contacts.id"), nullable=False),
        sa.Column("confidence_score", sa.Integer(), nullable=False),
        sa.Column("match_reasons", postgresql.JSON(), nullable=True),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("resolved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_lead_scoring_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("field", sa.String(100), nullable=False),
        sa.Column("operator", sa.String(30), nullable=False),
        sa.Column("value", sa.String(500), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_sales_activities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("activity_type", sa.String(30), nullable=False),
        sa.Column("subject", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_contacts.id"), nullable=True),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_crm_sales_activities_contact_id", "crm_sales_activities", ["contact_id"])

    op.create_table(
        "crm_pipelines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("stages", postgresql.JSON(), nullable=True),
        sa.Column("is_default", sa.Boolean(), server_default="false"),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # FK for opportunity -> pipeline
    op.create_foreign_key("fk_opportunity_pipeline", "crm_opportunities", "crm_pipelines", ["pipeline_id"], ["id"])

    op.create_table(
        "crm_sales_sequences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), server_default="draft"),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_sequence_steps",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("sequence_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_sales_sequences.id"), nullable=False),
        sa.Column("step_order", sa.Integer(), nullable=False),
        sa.Column("step_type", sa.String(30), nullable=False),
        sa.Column("delay_days", sa.Integer(), server_default="0"),
        sa.Column("config", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_sequence_enrollments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("sequence_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_sales_sequences.id"), nullable=False),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_contacts.id"), nullable=False),
        sa.Column("current_step", sa.Integer(), server_default="0"),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("enrolled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("next_action_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_crm_sequence_enrollments_status", "crm_sequence_enrollments", ["status"])

    op.create_table(
        "crm_email_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("subject", sa.String(500), nullable=False),
        sa.Column("body_html", sa.Text(), nullable=False),
        sa.Column("body_text", sa.Text(), nullable=True),
        sa.Column("category", sa.String(50), server_default="one_off"),
        sa.Column("variables", postgresql.JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── Phase 2: Marketing tables ────────────────────────────────────────────

    op.create_table(
        "crm_email_campaign_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_campaigns.id"), nullable=False),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_email_templates.id"), nullable=True),
        sa.Column("subject_line_a", sa.String(500), nullable=False),
        sa.Column("subject_line_b", sa.String(500), nullable=True),
        sa.Column("ab_test_ratio", sa.Integer(), server_default="50"),
        sa.Column("ab_winner_metric", sa.String(20), server_default="open_rate"),
        sa.Column("ab_winner_auto_send", sa.Boolean(), server_default="false"),
        sa.Column("winner_determined_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("send_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_count", sa.Integer(), server_default="0"),
        sa.Column("open_count", sa.Integer(), server_default="0"),
        sa.Column("click_count", sa.Integer(), server_default="0"),
        sa.Column("unsubscribe_count", sa.Integer(), server_default="0"),
        sa.Column("bounce_count", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_segments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("segment_type", sa.String(30), server_default="static"),
        sa.Column("rules", postgresql.JSON(), nullable=True),
        sa.Column("contact_count", sa.Integer(), server_default="0"),
        sa.Column("ai_suggested", sa.Boolean(), server_default="false"),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_segment_contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("segment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_segments.id"), nullable=False),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_contacts.id"), nullable=False),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_content_calendar",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("content_type", sa.String(30), nullable=False),
        sa.Column("scheduled_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(20), server_default="idea"),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_campaigns.id"), nullable=True),
        sa.Column("assigned_to", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_unsubscribes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_contacts.id"), nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_campaigns.id"), nullable=True),
        sa.Column("reason", sa.String(200), nullable=True),
        sa.Column("unsubscribed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── Phase 2: Service Hub tables ──────────────────────────────────────────

    op.create_table(
        "crm_conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("channel", sa.String(30), nullable=False),
        sa.Column("subject", sa.String(300), nullable=True),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_contacts.id"), nullable=True),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_tickets.id"), nullable=True),
        sa.Column("status", sa.String(20), server_default="open"),
        sa.Column("assigned_to", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_conversation_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_conversations.id"), nullable=False),
        sa.Column("sender_type", sa.String(20), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("content_type", sa.String(20), server_default="text"),
        sa.Column("attachments", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_knowledge_base_articles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("slug", sa.String(300), unique=True, nullable=False),
        sa.Column("content_html", sa.Text(), nullable=False),
        sa.Column("content_text", sa.Text(), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("status", sa.String(20), server_default="draft"),
        sa.Column("view_count", sa.Integer(), server_default="0"),
        sa.Column("helpful_count", sa.Integer(), server_default="0"),
        sa.Column("not_helpful_count", sa.Integer(), server_default="0"),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("embedding", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_sla_policies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("priority", sa.String(20), nullable=False),
        sa.Column("first_response_hours", sa.Integer(), nullable=False),
        sa.Column("resolution_hours", sa.Integer(), nullable=False),
        sa.Column("business_hours_only", sa.Boolean(), server_default="true"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_sla_trackers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_tickets.id"), nullable=False),
        sa.Column("sla_policy_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_sla_policies.id"), nullable=False),
        sa.Column("first_response_due", sa.DateTime(timezone=True), nullable=False),
        sa.Column("first_response_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_due", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolution_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_first_response_breached", sa.Boolean(), server_default="false"),
        sa.Column("is_resolution_breached", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── Phase 2: Workflow Automation tables ───────────────────────────────────

    op.create_table(
        "crm_workflows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("trigger_type", sa.String(50), nullable=False),
        sa.Column("trigger_config", postgresql.JSON(), nullable=True),
        sa.Column("status", sa.String(20), server_default="draft"),
        sa.Column("execution_count", sa.Integer(), server_default="0"),
        sa.Column("last_executed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_workflow_nodes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workflow_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_workflows.id"), nullable=False),
        sa.Column("node_type", sa.String(30), nullable=False),
        sa.Column("position_x", sa.Integer(), server_default="0"),
        sa.Column("position_y", sa.Integer(), server_default="0"),
        sa.Column("config", postgresql.JSON(), nullable=True),
        sa.Column("next_node_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("true_branch_node_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("false_branch_node_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_workflow_executions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workflow_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_workflows.id"), nullable=False),
        sa.Column("trigger_data", postgresql.JSON(), nullable=True),
        sa.Column("status", sa.String(20), server_default="running"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("steps_log", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_workflow_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("workflow_json", postgresql.JSON(), nullable=True),
        sa.Column("is_system", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── Phase 2: Reports & Gamification tables ───────────────────────────────

    op.create_table(
        "crm_saved_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("report_type", sa.String(50), nullable=False),
        sa.Column("config", postgresql.JSON(), nullable=True),
        sa.Column("is_favorite", sa.Boolean(), server_default="false"),
        sa.Column("is_shared", sa.Boolean(), server_default="false"),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_dashboard_widgets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("dashboard_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("widget_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("config", postgresql.JSON(), nullable=True),
        sa.Column("position_x", sa.Integer(), server_default="0"),
        sa.Column("position_y", sa.Integer(), server_default="0"),
        sa.Column("width", sa.Integer(), server_default="1"),
        sa.Column("height", sa.Integer(), server_default="1"),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_gamification_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("period", sa.String(10), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("score", sa.Integer(), server_default="0"),
        sa.Column("deals_closed", sa.Integer(), server_default="0"),
        sa.Column("deals_value", sa.Numeric(15, 2), server_default="0"),
        sa.Column("activities_completed", sa.Integer(), server_default="0"),
        sa.Column("leads_converted", sa.Integer(), server_default="0"),
        sa.Column("metadata_json", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── Phase 3: AI Agents tables ────────────────────────────────────────────

    op.create_table(
        "crm_ai_agent_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("agent_type", sa.String(50), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("config", postgresql.JSON(), nullable=True),
        sa.Column("schedule", postgresql.JSON(), nullable=True),
        sa.Column("approval_required", sa.Boolean(), server_default="true"),
        sa.Column("max_actions_per_run", sa.Integer(), server_default="10"),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_ai_agent_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("agent_config_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_ai_agent_configs.id"), nullable=False),
        sa.Column("status", sa.String(20), server_default="running"),
        sa.Column("trigger", sa.String(50), nullable=False),
        sa.Column("input_data", postgresql.JSON(), nullable=True),
        sa.Column("output_data", postgresql.JSON(), nullable=True),
        sa.Column("actions_taken", postgresql.JSON(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── Phase 3: Custom Objects tables ───────────────────────────────────────

    op.create_table(
        "crm_custom_object_definitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("label", sa.String(200), nullable=False),
        sa.Column("plural_label", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column("fields", postgresql.JSON(), nullable=True),
        sa.Column("relationships", postgresql.JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_custom_object_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("definition_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_custom_object_definitions.id"), nullable=False),
        sa.Column("data", postgresql.JSON(), nullable=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "crm_custom_object_relationships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("record_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_custom_object_records.id"), nullable=False),
        sa.Column("related_entity_type", sa.String(50), nullable=False),
        sa.Column("related_entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("relationship_type", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── Phase 3: Collaboration tables ────────────────────────────────────────

    op.create_table(
        "crm_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("mentions", postgresql.JSON(), nullable=True),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("is_edited", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_crm_comments_entity", "crm_comments", ["entity_type", "entity_id"])

    op.create_table(
        "crm_record_followers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_crm_record_followers_entity", "crm_record_followers", ["entity_type", "entity_id"])

    # ── Phase 3: Audit Log table ─────────────────────────────────────────────

    op.create_table(
        "crm_audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("changes", postgresql.JSON(), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("ip_address", sa.String(50), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_crm_audit_log_entity", "crm_audit_log", ["entity_type", "entity_id"])


def downgrade() -> None:
    # Phase 3
    op.drop_index("ix_crm_audit_log_entity")
    op.drop_table("crm_audit_log")
    op.drop_index("ix_crm_record_followers_entity")
    op.drop_table("crm_record_followers")
    op.drop_index("ix_crm_comments_entity")
    op.drop_table("crm_comments")
    op.drop_table("crm_custom_object_relationships")
    op.drop_table("crm_custom_object_records")
    op.drop_table("crm_custom_object_definitions")
    op.drop_table("crm_ai_agent_runs")
    op.drop_table("crm_ai_agent_configs")

    # Phase 2
    op.drop_table("crm_gamification_scores")
    op.drop_table("crm_dashboard_widgets")
    op.drop_table("crm_saved_reports")
    op.drop_table("crm_workflow_templates")
    op.drop_table("crm_workflow_executions")
    op.drop_table("crm_workflow_nodes")
    op.drop_table("crm_workflows")
    op.drop_table("crm_sla_trackers")
    op.drop_table("crm_sla_policies")
    op.drop_table("crm_knowledge_base_articles")
    op.drop_table("crm_conversation_messages")
    op.drop_table("crm_conversations")
    op.drop_table("crm_unsubscribes")
    op.drop_table("crm_content_calendar")
    op.drop_table("crm_segment_contacts")
    op.drop_table("crm_segments")
    op.drop_table("crm_email_campaign_configs")

    # MVP
    op.drop_table("crm_email_templates")
    op.drop_index("ix_crm_sequence_enrollments_status")
    op.drop_table("crm_sequence_enrollments")
    op.drop_table("crm_sequence_steps")
    op.drop_table("crm_sales_sequences")
    op.drop_constraint("fk_opportunity_pipeline", "crm_opportunities")
    op.drop_table("crm_pipelines")
    op.drop_index("ix_crm_sales_activities_contact_id")
    op.drop_table("crm_sales_activities")
    op.drop_table("crm_lead_scoring_rules")
    op.drop_table("crm_duplicate_candidates")
    op.drop_table("crm_custom_field_definitions")
    op.drop_table("crm_contact_notes")

    # Column removals
    op.drop_column("crm_opportunities", "custom_fields")
    op.drop_column("crm_opportunities", "loss_reason")
    op.drop_column("crm_opportunities", "weighted_value")
    op.drop_column("crm_opportunities", "swimlane")
    op.drop_column("crm_opportunities", "pipeline_id")
    op.drop_column("crm_leads", "custom_fields")
    op.drop_column("crm_leads", "scored_at")
    op.drop_column("crm_leads", "score_factors")
    op.drop_column("crm_leads", "score")
    op.drop_index("ix_crm_contacts_lifecycle_stage", "crm_contacts")
    op.drop_column("crm_contacts", "score")
    op.drop_column("crm_contacts", "social_profiles")
    op.drop_column("crm_contacts", "custom_fields")
    op.drop_column("crm_contacts", "last_activity_at")
    op.drop_column("crm_contacts", "lifecycle_stage")
    op.drop_column("crm_contacts", "employee_count")
    op.drop_column("crm_contacts", "annual_revenue")
    op.drop_column("crm_contacts", "industry")
    op.drop_column("crm_contacts", "website")
