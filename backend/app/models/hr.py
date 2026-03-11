"""HR & Payroll models — employees, departments, leave, attendance."""
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


class Department(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Company department."""

    __tablename__ = "hr_departments"

    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    head_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_departments.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    parent = relationship("Department", remote_side="Department.id", lazy="selectin")
    employees = relationship("Employee", back_populates="department")


class Employee(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Employee profile linked to a User account."""

    __tablename__ = "hr_employees"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False
    )
    employee_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_departments.id"), nullable=True
    )
    job_title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    employment_type: Mapped[str] = mapped_column(
        String(50), default="full_time"
    )  # full_time, part_time, contract, intern
    hire_date: Mapped[date] = mapped_column(Date, nullable=False)
    termination_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    salary: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    department = relationship("Department", back_populates="employees")
    leave_requests = relationship("LeaveRequest", back_populates="employee")
    attendance_records = relationship("Attendance", back_populates="employee")


class LeaveRequest(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Employee leave / time-off request."""

    __tablename__ = "hr_leave_requests"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    leave_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # annual, sick, maternity, paternity, unpaid
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    days: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending, approved, rejected, cancelled
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    employee = relationship("Employee", back_populates="leave_requests")


class Attendance(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Daily attendance record."""

    __tablename__ = "hr_attendance"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False)
    check_in: Mapped[time | None] = mapped_column(Time, nullable=True)
    check_out: Mapped[time | None] = mapped_column(Time, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="present"
    )  # present, absent, half_day, remote
    hours_worked: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    employee = relationship("Employee", back_populates="attendance_records")


class SalaryStructure(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Salary structure template."""
    __tablename__ = "hr_salary_structures"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    base_salary: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    allowances: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {"housing": 5000, "transport": 2000}
    deductions: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {"tax": 0.3, "pension": 0.05}
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Payslip(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Employee payslip for a pay period."""
    __tablename__ = "hr_payslips"

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False)
    salary_structure_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("hr_salary_structures.id"), nullable=True)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    gross_pay: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    deductions_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    net_pay: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft, approved, paid
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    employee = relationship("Employee", lazy="selectin")


class EmployeeDocument(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Document attached to an employee (contract, ID, certificate, etc.)."""

    __tablename__ = "hr_employee_documents"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    doc_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # contract, id, cert, other
    file_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    employee = relationship("Employee", lazy="selectin")


class Training(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Training session / programme."""

    __tablename__ = "hr_trainings"

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    trainer: Mapped[str | None] = mapped_column(String(200), nullable=True)
    duration_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="planned"
    )  # planned, in_progress, completed

    attendees = relationship("TrainingAttendee", back_populates="training", lazy="selectin")


class TrainingAttendee(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Link between a training session and an attending employee."""

    __tablename__ = "hr_training_attendees"

    training_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_trainings.id"), nullable=False
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), default="registered"
    )  # registered, attended, absent

    training = relationship("Training", back_populates="attendees")
    employee = relationship("Employee", lazy="selectin")


class PerformanceReview(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Employee performance review / appraisal."""

    __tablename__ = "hr_performance_reviews"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    period: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "Q1 2026", "2025 Annual"
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    goals: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    strengths: Mapped[str | None] = mapped_column(Text, nullable=True)
    areas_for_improvement: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, submitted, acknowledged
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)

    employee = relationship("Employee", lazy="selectin")


class Benefit(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Employee benefit (health insurance, pension, transport, etc.)."""

    __tablename__ = "hr_benefits"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    benefit_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # health, pension, transport, housing, other
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    employee = relationship("Employee", lazy="selectin")


class Overtime(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Employee overtime record."""

    __tablename__ = "hr_overtime"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hr_employees.id"), nullable=False
    )
    overtime_date: Mapped[date] = mapped_column(Date, nullable=False)
    hours: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    rate_multiplier: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=Decimal("1.5"))
    status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending, approved, rejected
    approver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    employee = relationship("Employee", lazy="selectin")
