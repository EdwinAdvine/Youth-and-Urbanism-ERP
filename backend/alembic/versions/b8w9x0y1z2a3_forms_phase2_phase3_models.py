"""forms_phase2_phase3_models

Revision ID: b8w9x0y1z2a3
Revises: fc1a2b3c4d5e
Create Date: 2026-03-12 00:00:00.000000

Adds Phase 2 and Phase 3 form models:
  - form_response_drafts     (offline drafts)
  - form_quiz_results        (quiz scoring)
  - form_schedules           (recurring distribution)
  - form_approval_workflows  (Phase 3 approval chain)
  - form_response_approvals  (per-step approval records)
  - form_translations        (multi-language support)
  - form_consents            (GDPR consent config)
  - form_consent_records     (per-respondent consent audit)
  - form_automations         (visual automation rules)
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "b8w9x0y1z2a3"
down_revision = "fc1a2b3c4d5e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── form_response_drafts ─────────────────────────────────────────────────
    op.create_table(
        "form_response_drafts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "form_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("forms.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("device_id", sa.String(255), nullable=True),
        sa.Column("draft_data", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("offline_created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_form_response_drafts_form_id", "form_response_drafts", ["form_id"])

    # ── form_quiz_results ────────────────────────────────────────────────────
    op.create_table(
        "form_quiz_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "form_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("forms.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "response_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("form_responses.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("max_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("percentage", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("pass_fail", sa.String(10), nullable=True),
        sa.Column("graded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "graded_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("ai_feedback", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_form_quiz_results_form_id", "form_quiz_results", ["form_id"])

    # ── form_schedules ───────────────────────────────────────────────────────
    op.create_table(
        "form_schedules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "form_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("forms.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "recurrence_rule",
            sa.String(500),
            nullable=True,
            comment="RFC 5545 RRULE string",
        ),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "recipients",
            postgresql.JSON(),
            nullable=True,
            comment="List of email addresses or user IDs",
        ),
        sa.Column(
            "distribution_channel",
            sa.String(20),
            nullable=False,
            server_default="email",
            comment="email | in_app | both",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_form_schedules_form_id", "form_schedules", ["form_id"])

    # ── form_approval_workflows ──────────────────────────────────────────────
    op.create_table(
        "form_approval_workflows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "form_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("forms.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "steps",
            postgresql.JSON(),
            nullable=False,
            server_default="[]",
            comment="List of {approver_id, role, step_index, label}",
        ),
        sa.Column("current_step", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # ── form_response_approvals ──────────────────────────────────────────────
    op.create_table(
        "form_response_approvals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "response_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("form_responses.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("step_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "approver_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="pending",
            comment="pending | approved | rejected",
        ),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_form_response_approvals_response_id",
        "form_response_approvals",
        ["response_id"],
    )

    # ── form_translations ────────────────────────────────────────────────────
    op.create_table(
        "form_translations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "form_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("forms.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "locale",
            sa.String(10),
            nullable=False,
            comment="BCP-47 locale code e.g. en, fr, sw, ar",
        ),
        sa.Column(
            "translations",
            postgresql.JSON(),
            nullable=False,
            server_default="{}",
            comment="{field_id: {label: str, options: [str], description: str}}",
        ),
        sa.Column("is_ai_generated", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_form_translations_form_id", "form_translations", ["form_id"])

    # ── form_consents ────────────────────────────────────────────────────────
    op.create_table(
        "form_consents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "form_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("forms.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "consent_text",
            sa.Text(),
            nullable=False,
            server_default="I agree to the privacy policy and data processing terms.",
        ),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("data_retention_days", sa.Integer(), nullable=True),
        sa.Column("privacy_policy_url", sa.String(2000), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # ── form_consent_records ─────────────────────────────────────────────────
    op.create_table(
        "form_consent_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "form_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("forms.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "response_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("form_responses.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column(
            "consented_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_form_consent_records_form_id", "form_consent_records", ["form_id"]
    )

    # ── form_automations ─────────────────────────────────────────────────────
    op.create_table(
        "form_automations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "form_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("forms.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "trigger",
            sa.String(50),
            nullable=False,
            comment="submitted | approved | rejected | scheduled",
        ),
        sa.Column("trigger_conditions", postgresql.JSON(), nullable=True),
        sa.Column(
            "actions",
            postgresql.JSON(),
            nullable=False,
            server_default="[]",
            comment="[{type: create_lead|send_email|create_invoice|assign_task|update_inventory, config: {}}]",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("run_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_form_automations_form_id", "form_automations", ["form_id"])


def downgrade() -> None:
    # Drop in reverse creation order
    op.drop_index("ix_form_automations_form_id", table_name="form_automations")
    op.drop_table("form_automations")

    op.drop_index("ix_form_consent_records_form_id", table_name="form_consent_records")
    op.drop_table("form_consent_records")

    op.drop_table("form_consents")

    op.drop_index("ix_form_translations_form_id", table_name="form_translations")
    op.drop_table("form_translations")

    op.drop_index(
        "ix_form_response_approvals_response_id",
        table_name="form_response_approvals",
    )
    op.drop_table("form_response_approvals")

    op.drop_table("form_approval_workflows")

    op.drop_index("ix_form_schedules_form_id", table_name="form_schedules")
    op.drop_table("form_schedules")

    op.drop_index("ix_form_quiz_results_form_id", table_name="form_quiz_results")
    op.drop_table("form_quiz_results")

    op.drop_index("ix_form_response_drafts_form_id", table_name="form_response_drafts")
    op.drop_table("form_response_drafts")
