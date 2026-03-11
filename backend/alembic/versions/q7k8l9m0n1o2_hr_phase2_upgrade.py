"""HR Phase 2 — ATS, Onboarding, LMS, Engagement, Recognition.

Revision ID: q7k8l9m0n1o2
Revises: p6j7k8l9m0n1
Create Date: 2026-03-11 10:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "q7k8l9m0n1o2"
down_revision = "p6j7k8l9m0n1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ─────────── ATS: Job Requisitions ───────────
    op.create_table(
        "hr_job_requisitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("hiring_manager_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("job_type", sa.String(50), nullable=False, server_default="full_time"),
        sa.Column("location", sa.String(300), nullable=True),
        sa.Column("remote_policy", sa.String(50), nullable=False, server_default="onsite"),
        sa.Column("salary_min", sa.Numeric(14, 2), nullable=True),
        sa.Column("salary_max", sa.Numeric(14, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("headcount", sa.Integer, nullable=False, server_default="1"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("requirements", sa.Text, nullable=True),
        sa.Column("skills_required", postgresql.JSON, nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("target_hire_date", sa.Date, nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["department_id"], ["hr_departments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["hiring_manager_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_hr_job_requisitions_status", "hr_job_requisitions", ["status"])
    op.create_index("ix_hr_job_requisitions_department_id", "hr_job_requisitions", ["department_id"])

    # ─────────── ATS: Candidates ───────────
    op.create_table(
        "hr_candidates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("first_name", sa.String(150), nullable=False),
        sa.Column("last_name", sa.String(150), nullable=False),
        sa.Column("email", sa.String(300), nullable=False),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("linkedin_url", sa.String(500), nullable=True),
        sa.Column("resume_file_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resume_file_name", sa.String(500), nullable=True),
        sa.Column("skills_extracted", postgresql.JSON, nullable=True),
        sa.Column("ai_summary", sa.Text, nullable=True),
        sa.Column("source", sa.String(100), nullable=True),
        sa.Column("is_blacklisted", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_hr_candidates_email"),
    )
    op.create_index("ix_hr_candidates_email", "hr_candidates", ["email"])

    # ─────────── ATS: Candidate Applications ───────────
    op.create_table(
        "hr_candidate_applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requisition_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("stage", sa.String(50), nullable=False, server_default="applied"),
        sa.Column("ai_match_score", sa.Integer, nullable=True),
        sa.Column("ai_match_notes", sa.Text, nullable=True),
        sa.Column("rejection_reason", sa.String(300), nullable=True),
        sa.Column("offer_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("assigned_to", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["candidate_id"], ["hr_candidates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requisition_id"], ["hr_job_requisitions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assigned_to"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_hr_candidate_applications_stage", "hr_candidate_applications", ["stage"])
    op.create_index("ix_hr_candidate_applications_requisition_id", "hr_candidate_applications", ["requisition_id"])
    op.create_index("ix_hr_candidate_applications_candidate_id", "hr_candidate_applications", ["candidate_id"])

    # ─────────── ATS: Interviews ───────────
    op.create_table(
        "hr_interviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("interview_type", sa.String(50), nullable=False, server_default="video"),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer, nullable=False, server_default="60"),
        sa.Column("interviewer_ids", postgresql.JSON, nullable=True),
        sa.Column("meeting_url", sa.String(500), nullable=True),
        sa.Column("calendar_event_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="scheduled"),
        sa.Column("feedback", sa.Text, nullable=True),
        sa.Column("rating", sa.Integer, nullable=True),
        sa.Column("recommendation", sa.String(30), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["application_id"], ["hr_candidate_applications.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_hr_interviews_application_id", "hr_interviews", ["application_id"])
    op.create_index("ix_hr_interviews_scheduled_at", "hr_interviews", ["scheduled_at"])

    # ─────────── Onboarding: Templates ───────────
    op.create_table(
        "hr_onboarding_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("template_type", sa.String(30), nullable=False, server_default="onboarding"),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["department_id"], ["hr_departments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
    )

    # ─────────── Onboarding: Tasks ───────────
    op.create_table(
        "hr_onboarding_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("task_type", sa.String(30), nullable=False, server_default="onboarding"),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("assigned_to", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("due_days_offset", sa.Integer, nullable=False, server_default="0"),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("order_index", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["template_id"], ["hr_onboarding_templates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["employee_id"], ["hr_employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assigned_to"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_hr_onboarding_tasks_employee_id", "hr_onboarding_tasks", ["employee_id"])
    op.create_index("ix_hr_onboarding_tasks_status", "hr_onboarding_tasks", ["status"])

    # ─────────── Onboarding: Buddy Assignments ───────────
    op.create_table(
        "hr_buddy_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("new_employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("buddy_employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["new_employee_id"], ["hr_employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["buddy_employee_id"], ["hr_employees.id"], ondelete="CASCADE"),
    )

    # ─────────── LMS: Courses ───────────
    op.create_table(
        "hr_courses",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("level", sa.String(30), nullable=False, server_default="beginner"),
        sa.Column("duration_hours", sa.Numeric(5, 1), nullable=False, server_default="0"),
        sa.Column("thumbnail_url", sa.String(500), nullable=True),
        sa.Column("skills_taught", postgresql.JSON, nullable=True),
        sa.Column("prerequisites", postgresql.JSON, nullable=True),
        sa.Column("is_mandatory", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_published", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("pass_score", sa.Integer, nullable=False, server_default="70"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_hr_courses_is_published", "hr_courses", ["is_published"])
    op.create_index("ix_hr_courses_category", "hr_courses", ["category"])

    # ─────────── LMS: Course Modules ───────────
    op.create_table(
        "hr_course_modules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("module_type", sa.String(30), nullable=False, server_default="video"),
        sa.Column("content_url", sa.String(500), nullable=True),
        sa.Column("file_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("duration_minutes", sa.Integer, nullable=False, server_default="0"),
        sa.Column("quiz_questions", postgresql.JSON, nullable=True),
        sa.Column("order_index", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_required", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["course_id"], ["hr_courses.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_hr_course_modules_course_id", "hr_course_modules", ["course_id"])

    # ─────────── LMS: Enrollments ───────────
    op.create_table(
        "hr_course_enrollments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("enrolled_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("progress_pct", sa.Integer, nullable=False, server_default="0"),
        sa.Column("quiz_score", sa.Integer, nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="enrolled"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("certificate_url", sa.String(500), nullable=True),
        sa.Column("modules_completed", postgresql.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["course_id"], ["hr_courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["employee_id"], ["hr_employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["enrolled_by"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_hr_course_enrollments_course_id", "hr_course_enrollments", ["course_id"])
    op.create_index("ix_hr_course_enrollments_employee_id", "hr_course_enrollments", ["employee_id"])
    op.create_index("ix_hr_course_enrollments_status", "hr_course_enrollments", ["status"])

    # ─────────── LMS: Certifications ───────────
    op.create_table(
        "hr_certifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("issuer", sa.String(200), nullable=True),
        sa.Column("credential_id", sa.String(200), nullable=True),
        sa.Column("issue_date", sa.Date, nullable=False),
        sa.Column("expiry_date", sa.Date, nullable=True),
        sa.Column("file_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_verified", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("verified_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["employee_id"], ["hr_employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["course_id"], ["hr_courses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["verified_by"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_hr_certifications_employee_id", "hr_certifications", ["employee_id"])
    op.create_index("ix_hr_certifications_expiry_date", "hr_certifications", ["expiry_date"])

    # ─────────── Surveys ───────────
    op.create_table(
        "hr_surveys",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("survey_type", sa.String(30), nullable=False, server_default="engagement"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("questions", postgresql.JSON, nullable=True),
        sa.Column("target_audience", postgresql.JSON, nullable=True),
        sa.Column("is_anonymous", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("opens_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closes_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_hr_surveys_status", "hr_surveys", ["status"])
    op.create_index("ix_hr_surveys_type", "hr_surveys", ["survey_type"])

    # ─────────── Survey Responses ───────────
    op.create_table(
        "hr_survey_responses",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("survey_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("respondent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("answers", postgresql.JSON, nullable=True),
        sa.Column("sentiment_score", sa.Numeric(4, 3), nullable=True),
        sa.Column("sentiment_label", sa.String(20), nullable=True),
        sa.Column("nps_score", sa.Integer, nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["survey_id"], ["hr_surveys.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["respondent_id"], ["hr_employees.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_hr_survey_responses_survey_id", "hr_survey_responses", ["survey_id"])

    # ─────────── Recognitions ───────────
    op.create_table(
        "hr_recognitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("from_employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("to_employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recognition_type", sa.String(50), nullable=False, server_default="kudos"),
        sa.Column("badge_name", sa.String(100), nullable=True),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("points", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_public", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["from_employee_id"], ["hr_employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["to_employee_id"], ["hr_employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["department_id"], ["hr_departments.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_hr_recognitions_to_employee_id", "hr_recognitions", ["to_employee_id"])
    op.create_index("ix_hr_recognitions_type", "hr_recognitions", ["recognition_type"])


def downgrade() -> None:
    # Drop in reverse FK-safe order
    op.drop_table("hr_recognitions")
    op.drop_table("hr_survey_responses")
    op.drop_table("hr_surveys")
    op.drop_table("hr_certifications")
    op.drop_table("hr_course_enrollments")
    op.drop_table("hr_course_modules")
    op.drop_table("hr_courses")
    op.drop_table("hr_buddy_assignments")
    op.drop_table("hr_onboarding_tasks")
    op.drop_table("hr_onboarding_templates")
    op.drop_table("hr_interviews")
    op.drop_table("hr_candidate_applications")
    op.drop_table("hr_candidates")
    op.drop_table("hr_job_requisitions")
