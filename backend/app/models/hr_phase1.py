"""HR Phase 1 upgrade models — skills, compensation, scheduling, goals, audit."""
from __future__ import annotations

import uuid
from datetime import date, datetime, time
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
    Time,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# ---------------------------------------------------------------------------
# Module 1: Employee 360° View — Skills, Succession, Timeline, Doc Versions
# ---------------------------------------------------------------------------


class EmployeeSkill(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Skill attached to an employee with proficiency level."""

    __tablename__ = "hr_employee_skills"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    skill_name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # technical, soft, leadership, domain
    proficiency_level: Mapped[int] = mapped_column(
        Integer, nullable=False
    )  # 1-5 (beginner to expert)
    years_experience: Mapped[Decimal | None] = mapped_column(
        Numeric(4, 1), nullable=True
    )
    verified_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    employee = relationship("Employee", lazy="selectin")


class EmployeeSuccessionPlan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Succession plan linking a position to a potential successor."""

    __tablename__ = "hr_succession_plans"

    position_title: Mapped[str] = mapped_column(String(200), nullable=False)
    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_departments.id"), nullable=False
    )
    current_holder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=True
    )
    successor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    readiness: Mapped[str] = mapped_column(
        String(20), default="developing"
    )  # ready_now, ready_1yr, ready_2yr, developing
    development_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(
        String(20), default="medium"
    )  # critical, high, medium, low
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    department = relationship("Department", lazy="selectin")
    current_holder = relationship(
        "Employee", foreign_keys=[current_holder_id], lazy="selectin"
    )
    successor = relationship(
        "Employee", foreign_keys=[successor_id], lazy="selectin"
    )


class EmployeeActivityLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Unified activity timeline entry for an employee."""

    __tablename__ = "hr_employee_activity_log"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    activity_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # hire, promotion, transfer, review, training, project, deal, ticket, leave, salary_change
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_module: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # hr, projects, crm, support, training
    source_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    employee = relationship("Employee", lazy="selectin")


class DocumentVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Version history for employee documents."""

    __tablename__ = "hr_document_versions"

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employee_documents.id"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    file_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    change_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    document = relationship("EmployeeDocument", lazy="selectin")


# ---------------------------------------------------------------------------
# Module 4: Compensation Management
# ---------------------------------------------------------------------------


class CompensationBand(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Compensation band defining salary ranges for job levels."""

    __tablename__ = "hr_compensation_bands"

    job_level: Mapped[str] = mapped_column(String(100), nullable=False)
    job_family: Mapped[str] = mapped_column(String(200), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    min_salary: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    mid_salary: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    max_salary: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    country_code: Mapped[str] = mapped_column(String(3), default="KE")
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class MeritBudgetPool(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Budget pool for merit increases."""

    __tablename__ = "hr_merit_budget_pools"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_departments.id"), nullable=True
    )
    fiscal_year: Mapped[int] = mapped_column(Integer, nullable=False)
    total_budget: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    allocated_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0")
    )
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    status: Mapped[str] = mapped_column(
        String(20), default="open"
    )  # open, closed
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    department = relationship("Department", lazy="selectin")


class MeritIncrease(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Proposed or approved merit salary increase."""

    __tablename__ = "hr_merit_increases"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    review_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_performance_reviews.id"), nullable=True
    )
    current_salary: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    proposed_salary: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    increase_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    increase_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # merit, promotion, market_adjustment, cost_of_living
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    budget_pool_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_merit_budget_pools.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default="proposed"
    )  # proposed, approved, rejected, applied
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    employee = relationship("Employee", lazy="selectin")
    review = relationship("PerformanceReview", lazy="selectin")
    budget_pool = relationship("MeritBudgetPool", lazy="selectin")


class Bonus(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Employee bonus record."""

    __tablename__ = "hr_bonuses"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    bonus_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # performance, spot, signing, referral, holiday, retention
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    review_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_performance_reviews.id"), nullable=True
    )
    pay_period: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="proposed"
    )  # proposed, approved, paid, cancelled
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    employee = relationship("Employee", lazy="selectin")


class EquityGrant(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Employee stock option or RSU grant."""

    __tablename__ = "hr_equity_grants"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    grant_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # stock_option, rsu, espp
    shares: Mapped[int] = mapped_column(Integer, nullable=False)
    strike_price: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 4), nullable=True
    )
    grant_date: Mapped[date] = mapped_column(Date, nullable=False)
    vesting_start: Mapped[date] = mapped_column(Date, nullable=False)
    vesting_schedule: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )  # {"cliff_months": 12, "total_months": 48, "frequency": "monthly"}
    vested_shares: Mapped[int] = mapped_column(Integer, default=0)
    exercised_shares: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(
        String(20), default="active"
    )  # active, fully_vested, cancelled, exercised
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    employee = relationship("Employee", lazy="selectin")


# ---------------------------------------------------------------------------
# Module 5: Shift Scheduling & Holiday Calendar
# ---------------------------------------------------------------------------


class ShiftTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Reusable shift definition."""

    __tablename__ = "hr_shift_templates"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    break_duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    is_overnight: Mapped[bool] = mapped_column(Boolean, default=False)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)  # hex
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ShiftAssignment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Assignment of an employee to a shift on a specific date."""

    __tablename__ = "hr_shift_assignments"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    shift_template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_shift_templates.id"), nullable=False
    )
    assignment_date: Mapped[date] = mapped_column(Date, nullable=False)
    actual_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    actual_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="scheduled"
    )  # scheduled, checked_in, completed, absent, swapped
    swap_with_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    employee = relationship(
        "Employee", foreign_keys=[employee_id], lazy="selectin"
    )
    shift_template = relationship("ShiftTemplate", lazy="selectin")


class HolidayCalendar(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Country-specific holiday entry."""

    __tablename__ = "hr_holiday_calendars"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    country_code: Mapped[str] = mapped_column(String(3), nullable=False)
    holiday_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=True)
    is_half_day: Mapped[bool] = mapped_column(Boolean, default=False)


# ---------------------------------------------------------------------------
# Module 6: Goals, OKR, Continuous Feedback, 360° Reviews
# ---------------------------------------------------------------------------


class Goal(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """OKR / goal with hierarchical structure."""

    __tablename__ = "hr_goals"

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    goal_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # company, team, individual
    owner_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # company, department, employee
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )  # polymorphic: department_id or employee_id
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_goals.id"), nullable=True
    )
    metric_type: Mapped[str] = mapped_column(
        String(20), default="percentage"
    )  # percentage, number, currency, boolean
    target_value: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2), nullable=True
    )
    current_value: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0")
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="not_started"
    )  # not_started, in_progress, at_risk, completed, cancelled
    weight: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("1.0")
    )
    review_period: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # "Q1 2026", "2026 Annual"

    parent = relationship("Goal", remote_side="Goal.id", lazy="selectin")
    updates = relationship("GoalUpdate", back_populates="goal", lazy="selectin")


class GoalUpdate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Progress check-in for a goal."""

    __tablename__ = "hr_goal_updates"

    goal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_goals.id"), nullable=False
    )
    previous_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    new_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    goal = relationship("Goal", back_populates="updates")


class ContinuousFeedback(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Peer-to-peer or manager feedback entry."""

    __tablename__ = "hr_continuous_feedback"

    from_employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    to_employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    feedback_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # praise, improvement, general
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=False)
    visibility: Mapped[str] = mapped_column(
        String(20), default="private"
    )  # private (manager only), team, public
    related_goal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_goals.id"), nullable=True
    )

    from_employee = relationship(
        "Employee", foreign_keys=[from_employee_id], lazy="selectin"
    )
    to_employee = relationship(
        "Employee", foreign_keys=[to_employee_id], lazy="selectin"
    )


class ReviewCycle(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A performance review cycle (annual, quarterly, 360°)."""

    __tablename__ = "hr_review_cycles"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    cycle_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # annual, semi_annual, quarterly, 360
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    self_review_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    peer_review_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    manager_review_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, active, peer_review, manager_review, completed
    department_ids: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )  # null = all departments
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    assignments = relationship("ReviewAssignment", back_populates="cycle", lazy="selectin")


class ReviewAssignment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Individual review assignment within a review cycle."""

    __tablename__ = "hr_review_assignments"

    cycle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_review_cycles.id"), nullable=False
    )
    reviewee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    review_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # self, peer, manager, skip_level
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-5
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    strengths: Mapped[str | None] = mapped_column(Text, nullable=True)
    improvements: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending, in_progress, submitted
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    cycle = relationship("ReviewCycle", back_populates="assignments")
    reviewee = relationship(
        "Employee", foreign_keys=[reviewee_id], lazy="selectin"
    )
    reviewer = relationship(
        "Employee", foreign_keys=[reviewer_id], lazy="selectin"
    )


# ---------------------------------------------------------------------------
# Module 13: Audit — Field-Level Change Tracking
# ---------------------------------------------------------------------------


class AuditFieldChange(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Immutable record of a field-level change on an HR record."""

    __tablename__ = "hr_audit_field_changes"

    table_name: Mapped[str] = mapped_column(String(100), nullable=False)
    record_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    change_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
