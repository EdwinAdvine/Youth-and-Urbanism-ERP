"""HR Phase 1 upgrade — skills, compensation, scheduling, goals, audit (18 tables).

Revision ID: p6j7k8l9m0n1
Revises: o5i6j7k8l9m0
Create Date: 2026-03-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON


# revision identifiers, used by Alembic.
revision = "p6j7k8l9m0n1"
down_revision = "o5i6j7k8l9m0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── hr_employee_skills ─────────────────────────────────────────────────
    op.create_table(
        "hr_employee_skills",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("hr_employees.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("skill_name", sa.String(200), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("proficiency_level", sa.Integer, nullable=False),
        sa.Column("years_experience", sa.Numeric(4, 1), nullable=True),
        sa.Column("verified_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── hr_succession_plans ────────────────────────────────────────────────
    op.create_table(
        "hr_succession_plans",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("position_title", sa.String(200), nullable=False),
        sa.Column("department_id", UUID(as_uuid=True), sa.ForeignKey("hr_departments.id"), nullable=False, index=True),
        sa.Column("current_holder_id", UUID(as_uuid=True), sa.ForeignKey("hr_employees.id"), nullable=True),
        sa.Column("successor_id", UUID(as_uuid=True), sa.ForeignKey("hr_employees.id"), nullable=False),
        sa.Column("readiness", sa.String(20), server_default="developing", nullable=False),
        sa.Column("development_notes", sa.Text, nullable=True),
        sa.Column("priority", sa.String(20), server_default="medium", nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── hr_employee_activity_log ───────────────────────────────────────────
    op.create_table(
        "hr_employee_activity_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("hr_employees.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("activity_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("source_module", sa.String(50), nullable=False),
        sa.Column("source_id", UUID(as_uuid=True), nullable=True),
        sa.Column("metadata_json", JSON, nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_hr_employee_activity_log_occurred", "hr_employee_activity_log", ["occurred_at"])

    # ── hr_document_versions ───────────────────────────────────────────────
    op.create_table(
        "hr_document_versions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("hr_employee_documents.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("version_number", sa.Integer, nullable=False),
        sa.Column("file_id", UUID(as_uuid=True), nullable=False),
        sa.Column("file_name", sa.String(500), nullable=False),
        sa.Column("file_size", sa.Integer, nullable=True),
        sa.Column("change_notes", sa.Text, nullable=True),
        sa.Column("uploaded_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── hr_compensation_bands ──────────────────────────────────────────────
    op.create_table(
        "hr_compensation_bands",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("job_level", sa.String(100), nullable=False),
        sa.Column("job_family", sa.String(200), nullable=False),
        sa.Column("currency", sa.String(3), server_default="USD", nullable=False),
        sa.Column("min_salary", sa.Numeric(14, 2), nullable=False),
        sa.Column("mid_salary", sa.Numeric(14, 2), nullable=False),
        sa.Column("max_salary", sa.Numeric(14, 2), nullable=False),
        sa.Column("country_code", sa.String(3), server_default="KE", nullable=False),
        sa.Column("effective_from", sa.Date, nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── hr_merit_budget_pools ──────────────────────────────────────────────
    op.create_table(
        "hr_merit_budget_pools",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("department_id", UUID(as_uuid=True), sa.ForeignKey("hr_departments.id"), nullable=True),
        sa.Column("fiscal_year", sa.Integer, nullable=False),
        sa.Column("total_budget", sa.Numeric(14, 2), nullable=False),
        sa.Column("allocated_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("currency", sa.String(3), server_default="USD", nullable=False),
        sa.Column("status", sa.String(20), server_default="open", nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── hr_merit_increases ─────────────────────────────────────────────────
    op.create_table(
        "hr_merit_increases",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("hr_employees.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("review_id", UUID(as_uuid=True), sa.ForeignKey("hr_performance_reviews.id"), nullable=True),
        sa.Column("current_salary", sa.Numeric(14, 2), nullable=False),
        sa.Column("proposed_salary", sa.Numeric(14, 2), nullable=False),
        sa.Column("increase_percentage", sa.Numeric(5, 2), nullable=False),
        sa.Column("increase_type", sa.String(30), nullable=False),
        sa.Column("effective_date", sa.Date, nullable=False),
        sa.Column("budget_pool_id", UUID(as_uuid=True), sa.ForeignKey("hr_merit_budget_pools.id"), nullable=True),
        sa.Column("status", sa.String(20), server_default="proposed", nullable=False),
        sa.Column("approved_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── hr_bonuses ─────────────────────────────────────────────────────────
    op.create_table(
        "hr_bonuses",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("hr_employees.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("bonus_type", sa.String(30), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(3), server_default="USD", nullable=False),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("review_id", UUID(as_uuid=True), sa.ForeignKey("hr_performance_reviews.id"), nullable=True),
        sa.Column("pay_period", sa.String(50), nullable=True),
        sa.Column("status", sa.String(20), server_default="proposed", nullable=False),
        sa.Column("approved_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── hr_equity_grants ───────────────────────────────────────────────────
    op.create_table(
        "hr_equity_grants",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("hr_employees.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("grant_type", sa.String(30), nullable=False),
        sa.Column("shares", sa.Integer, nullable=False),
        sa.Column("strike_price", sa.Numeric(14, 4), nullable=True),
        sa.Column("grant_date", sa.Date, nullable=False),
        sa.Column("vesting_start", sa.Date, nullable=False),
        sa.Column("vesting_schedule", JSON, nullable=True),
        sa.Column("vested_shares", sa.Integer, server_default="0", nullable=False),
        sa.Column("exercised_shares", sa.Integer, server_default="0", nullable=False),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── hr_shift_templates ─────────────────────────────────────────────────
    op.create_table(
        "hr_shift_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("start_time", sa.Time, nullable=False),
        sa.Column("end_time", sa.Time, nullable=False),
        sa.Column("break_duration_minutes", sa.Integer, server_default="60", nullable=False),
        sa.Column("is_overnight", sa.Boolean, server_default="false", nullable=False),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── hr_shift_assignments ───────────────────────────────────────────────
    op.create_table(
        "hr_shift_assignments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("hr_employees.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("shift_template_id", UUID(as_uuid=True), sa.ForeignKey("hr_shift_templates.id"), nullable=False),
        sa.Column("assignment_date", sa.Date, nullable=False),
        sa.Column("actual_start", sa.Time, nullable=True),
        sa.Column("actual_end", sa.Time, nullable=True),
        sa.Column("status", sa.String(20), server_default="scheduled", nullable=False),
        sa.Column("swap_with_id", UUID(as_uuid=True), sa.ForeignKey("hr_employees.id"), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_hr_shift_assignments_date", "hr_shift_assignments", ["assignment_date"])

    # ── hr_holiday_calendars ───────────────────────────────────────────────
    op.create_table(
        "hr_holiday_calendars",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("country_code", sa.String(3), nullable=False),
        sa.Column("holiday_date", sa.Date, nullable=False),
        sa.Column("is_recurring", sa.Boolean, server_default="true", nullable=False),
        sa.Column("is_half_day", sa.Boolean, server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── hr_goals ───────────────────────────────────────────────────────────
    op.create_table(
        "hr_goals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("goal_type", sa.String(20), nullable=False),
        sa.Column("owner_type", sa.String(20), nullable=False),
        sa.Column("owner_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("parent_id", UUID(as_uuid=True), sa.ForeignKey("hr_goals.id"), nullable=True),
        sa.Column("metric_type", sa.String(20), server_default="percentage", nullable=False),
        sa.Column("target_value", sa.Numeric(14, 2), nullable=True),
        sa.Column("current_value", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("due_date", sa.Date, nullable=False),
        sa.Column("status", sa.String(20), server_default="not_started", nullable=False),
        sa.Column("weight", sa.Numeric(5, 2), server_default="1.0", nullable=False),
        sa.Column("review_period", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── hr_goal_updates ────────────────────────────────────────────────────
    op.create_table(
        "hr_goal_updates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("goal_id", UUID(as_uuid=True), sa.ForeignKey("hr_goals.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("previous_value", sa.Numeric(14, 2), nullable=False),
        sa.Column("new_value", sa.Numeric(14, 2), nullable=False),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── hr_continuous_feedback ─────────────────────────────────────────────
    op.create_table(
        "hr_continuous_feedback",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("from_employee_id", UUID(as_uuid=True), sa.ForeignKey("hr_employees.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("to_employee_id", UUID(as_uuid=True), sa.ForeignKey("hr_employees.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("feedback_type", sa.String(20), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("is_anonymous", sa.Boolean, server_default="false", nullable=False),
        sa.Column("visibility", sa.String(20), server_default="private", nullable=False),
        sa.Column("related_goal_id", UUID(as_uuid=True), sa.ForeignKey("hr_goals.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── hr_review_cycles ───────────────────────────────────────────────────
    op.create_table(
        "hr_review_cycles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("cycle_type", sa.String(20), nullable=False),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=False),
        sa.Column("self_review_deadline", sa.Date, nullable=True),
        sa.Column("peer_review_deadline", sa.Date, nullable=True),
        sa.Column("manager_review_deadline", sa.Date, nullable=True),
        sa.Column("status", sa.String(20), server_default="draft", nullable=False),
        sa.Column("department_ids", JSON, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── hr_review_assignments ──────────────────────────────────────────────
    op.create_table(
        "hr_review_assignments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("cycle_id", UUID(as_uuid=True), sa.ForeignKey("hr_review_cycles.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("reviewee_id", UUID(as_uuid=True), sa.ForeignKey("hr_employees.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("reviewer_id", UUID(as_uuid=True), sa.ForeignKey("hr_employees.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("review_type", sa.String(20), nullable=False),
        sa.Column("rating", sa.Integer, nullable=True),
        sa.Column("comments", sa.Text, nullable=True),
        sa.Column("strengths", sa.Text, nullable=True),
        sa.Column("improvements", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── hr_audit_field_changes ─────────────────────────────────────────────
    op.create_table(
        "hr_audit_field_changes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("table_name", sa.String(100), nullable=False, index=True),
        sa.Column("record_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("field_name", sa.String(100), nullable=False),
        sa.Column("old_value", sa.Text, nullable=True),
        sa.Column("new_value", sa.Text, nullable=True),
        sa.Column("changed_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("change_reason", sa.Text, nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("hr_audit_field_changes")
    op.drop_table("hr_review_assignments")
    op.drop_table("hr_review_cycles")
    op.drop_table("hr_continuous_feedback")
    op.drop_table("hr_goal_updates")
    op.drop_table("hr_goals")
    op.drop_table("hr_holiday_calendars")
    op.drop_index("ix_hr_shift_assignments_date", table_name="hr_shift_assignments")
    op.drop_table("hr_shift_assignments")
    op.drop_table("hr_shift_templates")
    op.drop_table("hr_equity_grants")
    op.drop_table("hr_bonuses")
    op.drop_table("hr_merit_increases")
    op.drop_table("hr_merit_budget_pools")
    op.drop_table("hr_compensation_bands")
    op.drop_table("hr_document_versions")
    op.drop_index("ix_hr_employee_activity_log_occurred", table_name="hr_employee_activity_log")
    op.drop_table("hr_employee_activity_log")
    op.drop_table("hr_succession_plans")
    op.drop_table("hr_employee_skills")
