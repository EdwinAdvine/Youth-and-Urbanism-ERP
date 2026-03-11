"""HR Phase 2 models — ATS, Onboarding, LMS, Engagement, Recognition."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# ─────────────────────────── ATS / Recruiting ────────────────────────────────


class JobRequisition(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Job posting with approval workflow."""

    __tablename__ = "hr_job_requisitions"

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_departments.id"), nullable=True
    )
    hiring_manager_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    job_type: Mapped[str] = mapped_column(
        String(50), default="full_time"
    )  # full_time, part_time, contract, intern
    location: Mapped[str | None] = mapped_column(String(300), nullable=True)
    remote_policy: Mapped[str] = mapped_column(
        String(50), default="onsite"
    )  # onsite, hybrid, remote
    salary_min: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    salary_max: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    headcount: Mapped[int] = mapped_column(Integer, default=1)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    requirements: Mapped[str | None] = mapped_column(Text, nullable=True)
    skills_required: Mapped[list | None] = mapped_column(JSON, nullable=True)  # ["Python", "SQL"]
    status: Mapped[str] = mapped_column(
        String(30), default="draft"
    )  # draft, open, on_hold, filled, cancelled
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    target_hire_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    applications = relationship("CandidateApplication", back_populates="requisition", lazy="selectin")


class Candidate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Candidate profile (may apply to multiple requisitions)."""

    __tablename__ = "hr_candidates"

    first_name: Mapped[str] = mapped_column(String(150), nullable=False)
    last_name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(300), unique=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    resume_file_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    resume_file_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    skills_extracted: Mapped[list | None] = mapped_column(JSON, nullable=True)  # AI-extracted skills
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # linkedin, indeed, referral, careers_page
    is_blacklisted: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    applications = relationship("CandidateApplication", back_populates="candidate", lazy="selectin")


class CandidateApplication(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Application linking a candidate to a requisition (pipeline stages)."""

    __tablename__ = "hr_candidate_applications"

    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_candidates.id"), nullable=False
    )
    requisition_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_job_requisitions.id"), nullable=False
    )
    stage: Mapped[str] = mapped_column(
        String(50), default="applied"
    )  # applied, screening, interview, offer, hired, rejected
    ai_match_score: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0-100
    ai_match_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(300), nullable=True)
    offer_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    candidate = relationship("Candidate", back_populates="applications")
    requisition = relationship("JobRequisition", back_populates="applications")
    interviews = relationship("Interview", back_populates="application", lazy="selectin")


class Interview(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Interview scheduled for a candidate application."""

    __tablename__ = "hr_interviews"

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_candidate_applications.id"), nullable=False
    )
    interview_type: Mapped[str] = mapped_column(
        String(50), default="video"
    )  # video, phone, in_person, technical, panel
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    interviewer_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)  # [user_id, ...]
    meeting_url: Mapped[str | None] = mapped_column(String(500), nullable=True)  # Jitsi link
    calendar_event_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(
        String(30), default="scheduled"
    )  # scheduled, completed, cancelled, no_show
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-5
    recommendation: Mapped[str | None] = mapped_column(
        String(30), nullable=True
    )  # advance, reject, hold

    application = relationship("CandidateApplication", back_populates="interviews")


# ─────────────────────────── Onboarding / Offboarding ───────────────────────


class OnboardingTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Reusable onboarding/offboarding task template."""

    __tablename__ = "hr_onboarding_templates"

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    template_type: Mapped[str] = mapped_column(
        String(30), default="onboarding"
    )  # onboarding, offboarding
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_departments.id"), nullable=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    tasks = relationship("OnboardingTask", back_populates="template", lazy="selectin",
                         foreign_keys="OnboardingTask.template_id")


class OnboardingTask(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Individual checklist item for onboarding/offboarding."""

    __tablename__ = "hr_onboarding_tasks"

    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_onboarding_templates.id"), nullable=True
    )
    employee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=True
    )  # set when assigned to a specific employee run
    task_type: Mapped[str] = mapped_column(
        String(30), default="onboarding"
    )  # onboarding, offboarding
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # it_setup, paperwork, training, access, equipment
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    due_days_offset: Mapped[int] = mapped_column(Integer, default=0)  # days from hire_date
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending, in_progress, completed, skipped
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    template = relationship("OnboardingTemplate", back_populates="tasks",
                            foreign_keys=[template_id])


class BuddyAssignment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """New-hire buddy matching."""

    __tablename__ = "hr_buddy_assignments"

    new_employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    buddy_employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    new_employee = relationship("Employee", foreign_keys=[new_employee_id], lazy="selectin")
    buddy_employee = relationship("Employee", foreign_keys=[buddy_employee_id], lazy="selectin")


# ─────────────────────────── LMS (Learning Management) ──────────────────────


class Course(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """LMS course catalog entry."""

    __tablename__ = "hr_courses"

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    level: Mapped[str] = mapped_column(
        String(30), default="beginner"
    )  # beginner, intermediate, advanced
    duration_hours: Mapped[Decimal] = mapped_column(Numeric(5, 1), default=Decimal("0"))
    thumbnail_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    skills_taught: Mapped[list | None] = mapped_column(JSON, nullable=True)
    prerequisites: Mapped[list | None] = mapped_column(JSON, nullable=True)  # [course_id, ...]
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    pass_score: Mapped[int] = mapped_column(Integer, default=70)  # minimum % to pass

    modules = relationship("CourseModule", back_populates="course", lazy="selectin",
                           order_by="CourseModule.order_index")
    enrollments = relationship("CourseEnrollment", back_populates="course", lazy="noload")


class CourseModule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Individual content block within a course."""

    __tablename__ = "hr_course_modules"

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_courses.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    module_type: Mapped[str] = mapped_column(
        String(30), default="video"
    )  # video, document, quiz, scorm
    content_url: Mapped[str | None] = mapped_column(String(500), nullable=True)  # MinIO URL
    file_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=0)
    quiz_questions: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # [{question, options:[...], correct_index, points}]
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True)

    course = relationship("Course", back_populates="modules")


class CourseEnrollment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Employee's enrollment and progress in a course."""

    __tablename__ = "hr_course_enrollments"

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_courses.id"), nullable=False
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    enrolled_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)  # 0-100
    quiz_score: Mapped[int | None] = mapped_column(Integer, nullable=True)  # final %
    status: Mapped[str] = mapped_column(
        String(30), default="enrolled"
    )  # enrolled, in_progress, completed, failed
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    certificate_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    modules_completed: Mapped[list | None] = mapped_column(JSON, nullable=True)  # [module_id, ...]

    course = relationship("Course", back_populates="enrollments")
    employee = relationship("Employee", lazy="selectin")


class Certification(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Professional certification tracking with expiry reminders."""

    __tablename__ = "hr_certifications"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    issuer: Mapped[str | None] = mapped_column(String(200), nullable=True)
    credential_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    file_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_courses.id"), nullable=True
    )  # if earned via LMS
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verified_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    employee = relationship("Employee", lazy="selectin")


# ─────────────────────────── Surveys & Engagement ────────────────────────────


class Survey(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Survey builder (engagement, eNPS, pulse, exit)."""

    __tablename__ = "hr_surveys"

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    survey_type: Mapped[str] = mapped_column(
        String(30), default="engagement"
    )  # engagement, enps, pulse, exit, onboarding, custom
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    questions: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # [{id, type, text, options, required}] types: likert, nps, open, multichoice, rating
    target_audience: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # {department_ids: [], all: true}
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, active, closed
    opens_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    responses = relationship("SurveyResponse", back_populates="survey", lazy="noload")


class SurveyResponse(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Employee survey response with AI sentiment scoring."""

    __tablename__ = "hr_survey_responses"

    survey_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_surveys.id"), nullable=False
    )
    respondent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=True
    )  # NULL if fully anonymous
    answers: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # {question_id: value_or_text}
    sentiment_score: Mapped[Decimal | None] = mapped_column(Numeric(4, 3), nullable=True)
    # -1.0 to 1.0, AI-calculated
    sentiment_label: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # positive, neutral, negative
    nps_score: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0-10
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    survey = relationship("Survey", back_populates="responses")


# ─────────────────────────── Recognition & Rewards ───────────────────────────


class Recognition(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Employee recognition — shout-outs, badges, kudos."""

    __tablename__ = "hr_recognitions"

    from_employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    to_employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    recognition_type: Mapped[str] = mapped_column(
        String(50), default="kudos"
    )  # kudos, badge, shoutout, award
    badge_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    points: Mapped[int] = mapped_column(Integer, default=0)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_departments.id"), nullable=True
    )

    from_employee = relationship("Employee", foreign_keys=[from_employee_id], lazy="selectin")
    to_employee = relationship("Employee", foreign_keys=[to_employee_id], lazy="selectin")
