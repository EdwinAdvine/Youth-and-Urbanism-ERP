"""Projects Enhanced — subtasks, checklists, custom fields, sprints, automation, recurring, guest access.

Revision ID: p1q2r3s4t5u6
Revises: 3db90a021a2a
Create Date: 2026-03-12 06:00:00.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "p1q2r3s4t5u6"
down_revision = "3db90a021a2a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. New columns on project_tasks ──────────────────────────────────────
    op.add_column(
        "project_tasks",
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("project_tasks.id", ondelete="CASCADE"), nullable=True),
    )
    op.add_column(
        "project_tasks",
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "project_tasks",
        sa.Column("estimated_hours", sa.Float(), nullable=True),
    )
    op.add_column(
        "project_tasks",
        sa.Column("sprint_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "project_tasks",
        sa.Column("recurring_config_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_project_tasks_parent_id", "project_tasks", ["parent_id"])
    op.create_index("ix_project_tasks_sprint_id", "project_tasks", ["sprint_id"])

    # ── 2. project_sprints ────────────────────────────────────────────────────
    op.create_table(
        "project_sprints",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("goal", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="planning"),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_project_sprints_project_id", "project_sprints", ["project_id"])

    # Add FK from project_tasks.sprint_id → project_sprints.id
    op.create_foreign_key(
        "fk_project_tasks_sprint_id",
        "project_tasks", "project_sprints",
        ["sprint_id"], ["id"],
        ondelete="SET NULL",
    )

    # ── 3. project_recurring_configs ─────────────────────────────────────────
    op.create_table(
        "project_recurring_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("assignee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("tags", postgresql.ARRAY(sa.String(100)), nullable=True),
        sa.Column("estimated_hours", sa.Float(), nullable=True),
        sa.Column("frequency", sa.String(20), nullable=False),
        sa.Column("interval", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_project_recurring_configs_project_id", "project_recurring_configs", ["project_id"])

    # Add FK from project_tasks.recurring_config_id → project_recurring_configs.id
    op.create_foreign_key(
        "fk_project_tasks_recurring_config_id",
        "project_tasks", "project_recurring_configs",
        ["recurring_config_id"], ["id"],
        ondelete="SET NULL",
    )

    # ── 4. project_task_checklists ────────────────────────────────────────────
    op.create_table(
        "project_task_checklists",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("project_tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("is_done", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("assignee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_project_task_checklists_task_id", "project_task_checklists", ["task_id"])

    # ── 5. project_task_relationships ─────────────────────────────────────────
    op.create_table(
        "project_task_relationships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source_task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("project_tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("project_tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relationship_type", sa.String(30), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("source_task_id", "target_task_id", "relationship_type", name="uq_task_relationship"),
    )
    op.create_index("ix_project_task_relationships_source", "project_task_relationships", ["source_task_id"])
    op.create_index("ix_project_task_relationships_target", "project_task_relationships", ["target_task_id"])

    # ── 6. project_custom_fields ──────────────────────────────────────────────
    op.create_table(
        "project_custom_fields",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("field_type", sa.String(20), nullable=False),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("options", postgresql.JSON(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_project_custom_fields_project_id", "project_custom_fields", ["project_id"])

    # ── 7. project_task_custom_field_values ───────────────────────────────────
    op.create_table(
        "project_task_custom_field_values",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("project_tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("field_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("project_custom_fields.id", ondelete="CASCADE"), nullable=False),
        sa.Column("value_text", sa.Text(), nullable=True),
        sa.Column("value_number", sa.Float(), nullable=True),
        sa.Column("value_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("task_id", "field_id", name="uq_task_custom_field"),
    )
    op.create_index("ix_project_task_custom_field_values_task_id", "project_task_custom_field_values", ["task_id"])

    # ── 8. project_task_audit_log ─────────────────────────────────────────────
    op.create_table(
        "project_task_audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("project_tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("changes", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_project_task_audit_log_task_id", "project_task_audit_log", ["task_id"])
    op.create_index("ix_project_task_audit_log_created_at", "project_task_audit_log", ["created_at"])

    # ── 9. project_task_comments ──────────────────────────────────────────────
    op.create_table(
        "project_task_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("project_tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_edited", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_project_task_comments_task_id", "project_task_comments", ["task_id"])

    # Add self-referential FK for threaded comments
    op.create_foreign_key(
        "fk_project_task_comments_parent_id",
        "project_task_comments", "project_task_comments",
        ["parent_id"], ["id"],
        ondelete="CASCADE",
    )

    # ── 10. project_automation_rules ─────────────────────────────────────────
    op.create_table(
        "project_automation_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("trigger", sa.String(50), nullable=False),
        sa.Column("trigger_config", postgresql.JSON(), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("action_config", postgresql.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_project_automation_rules_project_id", "project_automation_rules", ["project_id"])

    # ── 11. project_guest_access ──────────────────────────────────────────────
    op.create_table(
        "project_guest_access",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("token", sa.String(64), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="viewer"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("invited_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_project_guest_access_project_id", "project_guest_access", ["project_id"])
    op.create_index("ix_project_guest_access_token", "project_guest_access", ["token"], unique=True)


def downgrade() -> None:
    op.drop_table("project_guest_access")
    op.drop_table("project_automation_rules")
    op.drop_table("project_task_comments")
    op.drop_table("project_task_audit_log")
    op.drop_table("project_task_custom_field_values")
    op.drop_table("project_custom_fields")
    op.drop_table("project_task_relationships")
    op.drop_table("project_task_checklists")
    op.drop_table("project_recurring_configs")
    op.drop_table("project_sprints")
    op.drop_column("project_tasks", "recurring_config_id")
    op.drop_column("project_tasks", "sprint_id")
    op.drop_column("project_tasks", "estimated_hours")
    op.drop_column("project_tasks", "start_date")
    op.drop_column("project_tasks", "parent_id")
