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
