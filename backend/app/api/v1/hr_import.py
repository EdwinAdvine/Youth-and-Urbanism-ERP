"""HR Bulk Import API — CSV/JSON imports for Rippling, BambooHR, HiBob, ADP formats."""
from __future__ import annotations

import csv
import io
import json
import secrets
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.security import hash_password
from app.models.hr import Department, Employee
from app.models.user import User

router = APIRouter()

# ── CSV template headers ──────────────────────────────────────────────────────

CSV_TEMPLATE_HEADERS = [
    "first_name",
    "last_name",
    "email",
    "employee_number",
    "department_name",
    "job_title",
    "hire_date",
    "salary",
    "currency",
    "employment_type",
]

# ── Pydantic schemas ──────────────────────────────────────────────────────────


class ImportResult(BaseModel):
    imported: int
    updated: int
    skipped: int
    errors: list[dict[str, Any]]


# ── Internal helpers ──────────────────────────────────────────────────────────


def _parse_date(value: str | None) -> date | None:
    """Try common date formats and return a date or None."""
    if not value:
        return None
    value = value.strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d", "%d-%m-%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def _parse_decimal(value: str | None) -> Decimal | None:
    if not value:
        return None
    try:
        return Decimal(str(value).replace(",", "").strip())
    except InvalidOperation:
        return None


async def _get_or_create_department(db: DBSession, name: str) -> Department | None:
    """Return existing department by name or create a new one."""
    if not name or not name.strip():
        return None
    name = name.strip()
    result = await db.execute(select(Department).where(Department.name == name))
    dept = result.scalar_one_or_none()
    if not dept:
        dept = Department(name=name, is_active=True)
        db.add(dept)
        await db.flush()  # get dept.id
    return dept


async def _get_or_create_user(db: DBSession, email: str, full_name: str) -> tuple[User, bool]:
    """Return (user, created) — creates user with random password if not found."""
    result = await db.execute(select(User).where(User.email == email.lower().strip()))
    user = result.scalar_one_or_none()
    if user:
        return user, False
    user = User(
        email=email.lower().strip(),
        full_name=full_name.strip(),
        hashed_password=hash_password(secrets.token_hex(16)),
        is_active=True,
        is_superadmin=False,
    )
    db.add(user)
    await db.flush()
    return user, True


async def _upsert_employee(
    db: DBSession,
    *,
    employee_number: str,
    user: User,
    department: Department | None,
    job_title: str | None,
    hire_date: date | None,
    salary: Decimal | None,
    currency: str,
    employment_type: str,
) -> tuple[Employee, bool]:
    """Upsert employee by employee_number. Returns (employee, created)."""
    result = await db.execute(
        select(Employee).where(Employee.employee_number == employee_number.strip())
    )
    emp = result.scalar_one_or_none()
    if emp:
        # Update mutable fields
        emp.department_id = department.id if department else emp.department_id
        emp.job_title = job_title or emp.job_title
        emp.hire_date = hire_date or emp.hire_date
        emp.salary = salary if salary is not None else emp.salary
        emp.currency = currency or emp.currency
        emp.employment_type = employment_type or emp.employment_type
        return emp, False
    else:
        emp = Employee(
            user_id=user.id,
            employee_number=employee_number.strip(),
            department_id=department.id if department else None,
            job_title=job_title,
            hire_date=hire_date or date.today(),
            salary=salary,
            currency=currency or "USD",
            employment_type=employment_type or "full_time",
            is_active=True,
        )
        db.add(emp)
        return emp, True


async def _process_employee_row(
    db: DBSession,
    row_num: int,
    first_name: str | None,
    last_name: str | None,
    email: str | None,
    employee_number: str | None,
    department_name: str | None,
    job_title: str | None,
    hire_date_raw: str | None,
    salary_raw: str | None,
    currency: str | None,
    employment_type: str | None,
    errors: list,
    imported_count: list,
    updated_count: list,
) -> None:
    """Process a single employee row, appending to errors/imported/updated lists."""
    # Validate required fields
    if not email or not email.strip():
        errors.append({"row": row_num, "message": "Missing required field: email"})
        return
    if not first_name or not first_name.strip():
        errors.append({"row": row_num, "message": "Missing required field: first_name"})
        return
    if not last_name or not last_name.strip():
        errors.append({"row": row_num, "message": "Missing required field: last_name"})
        return
    if not employee_number or not employee_number.strip():
        errors.append({"row": row_num, "message": "Missing required field: employee_number"})
        return

    full_name = f"{first_name.strip()} {last_name.strip()}"
    hire_date = _parse_date(hire_date_raw)
    salary = _parse_decimal(salary_raw)
    dept = await _get_or_create_department(db, department_name or "")
    user, _ = await _get_or_create_user(db, email, full_name)
    _, created = await _upsert_employee(
        db,
        employee_number=employee_number,
        user=user,
        department=dept,
        job_title=job_title,
        hire_date=hire_date,
        salary=salary,
        currency=(currency or "USD").upper()[:3],
        employment_type=employment_type or "full_time",
    )
    if created:
        imported_count.append(1)
    else:
        updated_count.append(1)


# ── CSV import ────────────────────────────────────────────────────────────────


@router.post(
    "/import/employees/csv",
    summary="Bulk import employees from CSV (HR admin)",
)
async def import_employees_csv(
    current_user: CurrentUser,
    db: DBSession,
    file: UploadFile = File(..., description="CSV with employee data"),
    _admin: Any = Depends(require_app_admin("hr")),
) -> ImportResult:
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    errors: list[dict] = []
    imported: list[int] = []
    updated: list[int] = []
    skipped = 0

    for row_num, row in enumerate(reader, start=2):  # row 1 = header
        try:
            await _process_employee_row(
                db,
                row_num=row_num,
                first_name=row.get("first_name"),
                last_name=row.get("last_name"),
                email=row.get("email"),
                employee_number=row.get("employee_number"),
                department_name=row.get("department_name"),
                job_title=row.get("job_title"),
                hire_date_raw=row.get("hire_date"),
                salary_raw=row.get("salary"),
                currency=row.get("currency"),
                employment_type=row.get("employment_type"),
                errors=errors,
                imported_count=imported,
                updated_count=updated,
            )
        except Exception as exc:
            errors.append({"row": row_num, "message": str(exc)})

    await db.commit()
    return ImportResult(
        imported=len(imported),
        updated=len(updated),
        skipped=skipped,
        errors=errors,
    )


# ── JSON import ───────────────────────────────────────────────────────────────


@router.post(
    "/import/employees/json",
    summary="Bulk import employees from JSON array (HR admin)",
)
async def import_employees_json(
    current_user: CurrentUser,
    db: DBSession,
    file: UploadFile = File(..., description="JSON array of employee objects"),
    _admin: Any = Depends(require_app_admin("hr")),
) -> ImportResult:
    content = await file.read()
    try:
        data = json.loads(content.decode("utf-8-sig"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}") from exc

    if not isinstance(data, list):
        raise HTTPException(status_code=400, detail="JSON body must be an array of employee objects")

    errors: list[dict] = []
    imported: list[int] = []
    updated: list[int] = []

    for row_num, row in enumerate(data, start=1):
        if not isinstance(row, dict):
            errors.append({"row": row_num, "message": "Row must be a JSON object"})
            continue
        try:
            await _process_employee_row(
                db,
                row_num=row_num,
                first_name=row.get("first_name"),
                last_name=row.get("last_name"),
                email=row.get("email"),
                employee_number=row.get("employee_number"),
                department_name=row.get("department_name"),
                job_title=row.get("job_title"),
                hire_date_raw=row.get("hire_date"),
                salary_raw=str(row.get("salary", "")) if row.get("salary") is not None else None,
                currency=row.get("currency"),
                employment_type=row.get("employment_type"),
                errors=errors,
                imported_count=imported,
                updated_count=updated,
            )
        except Exception as exc:
            errors.append({"row": row_num, "message": str(exc)})

    await db.commit()
    return ImportResult(
        imported=len(imported),
        updated=len(updated),
        skipped=0,
        errors=errors,
    )


# ── Rippling format import ────────────────────────────────────────────────────


@router.post(
    "/import/format/rippling",
    summary="Import employees from Rippling JSON export (HR admin)",
)
async def import_rippling(
    current_user: CurrentUser,
    db: DBSession,
    file: UploadFile = File(..., description="Rippling JSON export with 'workers' array"),
    _admin: Any = Depends(require_app_admin("hr")),
) -> ImportResult:
    content = await file.read()
    try:
        data = json.loads(content.decode("utf-8-sig"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}") from exc

    workers = data.get("workers") or data if isinstance(data, list) else []
    if not isinstance(workers, list):
        raise HTTPException(status_code=400, detail="Expected 'workers' array in Rippling export")

    errors: list[dict] = []
    imported: list[int] = []
    updated: list[int] = []

    for row_num, worker in enumerate(workers, start=1):
        if not isinstance(worker, dict):
            errors.append({"row": row_num, "message": "Worker entry must be a JSON object"})
            continue
        try:
            # Rippling field mapping
            first_name = worker.get("firstName") or worker.get("first_name")
            last_name = worker.get("lastName") or worker.get("last_name")
            email = (
                worker.get("workEmail")
                or worker.get("personalEmail")
                or worker.get("email")
            )
            employee_number = (
                worker.get("employeeId")
                or worker.get("employee_id")
                or worker.get("employeeNumber")
            )
            department_name = (
                worker.get("department", {}).get("name")
                if isinstance(worker.get("department"), dict)
                else worker.get("department") or worker.get("departmentName")
            )
            job_title = worker.get("title") or worker.get("jobTitle") or worker.get("job_title")
            hire_date_raw = worker.get("startDate") or worker.get("hireDate") or worker.get("hire_date")
            salary_raw = str(worker.get("annualSalary") or worker.get("salary") or "")
            currency = worker.get("currency", "USD")
            employment_type_raw = worker.get("employmentType") or worker.get("employment_type", "full_time")
            # Normalize employment type
            employment_type = employment_type_raw.lower().replace(" ", "_") if employment_type_raw else "full_time"

            await _process_employee_row(
                db,
                row_num=row_num,
                first_name=first_name,
                last_name=last_name,
                email=email,
                employee_number=str(employee_number) if employee_number else None,
                department_name=department_name,
                job_title=job_title,
                hire_date_raw=hire_date_raw,
                salary_raw=salary_raw or None,
                currency=currency,
                employment_type=employment_type,
                errors=errors,
                imported_count=imported,
                updated_count=updated,
            )
        except Exception as exc:
            errors.append({"row": row_num, "message": str(exc)})

    await db.commit()
    return ImportResult(
        imported=len(imported),
        updated=len(updated),
        skipped=0,
        errors=errors,
    )


# ── BambooHR format import ────────────────────────────────────────────────────


@router.post(
    "/import/format/bamboohr",
    summary="Import employees from BambooHR CSV export (HR admin)",
)
async def import_bamboohr(
    current_user: CurrentUser,
    db: DBSession,
    file: UploadFile = File(..., description="BambooHR CSV export"),
    _admin: Any = Depends(require_app_admin("hr")),
) -> ImportResult:
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    errors: list[dict] = []
    imported: list[int] = []
    updated: list[int] = []

    for row_num, row in enumerate(reader, start=2):
        try:
            # BambooHR field mapping
            display_name = row.get("displayName") or row.get("Display Name") or ""
            parts = display_name.strip().split(" ", 1)
            first_name = row.get("firstName") or row.get("First Name") or (parts[0] if parts else "")
            last_name = row.get("lastName") or row.get("Last Name") or (parts[1] if len(parts) > 1 else "")
            email = row.get("workEmail") or row.get("Work Email") or row.get("email") or row.get("Email")
            employee_number = (
                row.get("employeeNumber")
                or row.get("Employee #")
                or row.get("id")
                or row.get("Id")
            )
            department_name = row.get("department") or row.get("Department")
            job_title = row.get("jobTitle") or row.get("Job Title")
            hire_date_raw = row.get("hireDate") or row.get("Hire Date") or row.get("originalHireDate")
            salary_raw = row.get("salary") or row.get("Salary")
            currency = row.get("currency") or row.get("Currency") or "USD"
            employment_type_raw = row.get("employmentHistoryStatus") or row.get("Employment Status") or "full_time"
            employment_type = employment_type_raw.lower().replace(" ", "_") if employment_type_raw else "full_time"
            # Map BambooHR statuses
            status_map = {"full-time": "full_time", "part-time": "part_time"}
            employment_type = status_map.get(employment_type, employment_type)

            # Auto-generate employee_number from id if not present
            if not employee_number:
                employee_number = row.get("Employee Id") or row.get("employeeId")

            await _process_employee_row(
                db,
                row_num=row_num,
                first_name=first_name,
                last_name=last_name,
                email=email,
                employee_number=str(employee_number) if employee_number else None,
                department_name=department_name,
                job_title=job_title,
                hire_date_raw=hire_date_raw,
                salary_raw=salary_raw,
                currency=currency,
                employment_type=employment_type,
                errors=errors,
                imported_count=imported,
                updated_count=updated,
            )
        except Exception as exc:
            errors.append({"row": row_num, "message": str(exc)})

    await db.commit()
    return ImportResult(
        imported=len(imported),
        updated=len(updated),
        skipped=0,
        errors=errors,
    )


# ── HiBob format import ───────────────────────────────────────────────────────


@router.post(
    "/import/format/hibob",
    summary="Import employees from HiBob JSON export (HR admin)",
)
async def import_hibob(
    current_user: CurrentUser,
    db: DBSession,
    file: UploadFile = File(..., description="HiBob JSON export with 'employees' array"),
    _admin: Any = Depends(require_app_admin("hr")),
) -> ImportResult:
    content = await file.read()
    try:
        data = json.loads(content.decode("utf-8-sig"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}") from exc

    employees = data.get("employees") or data if isinstance(data, list) else []
    if not isinstance(employees, list):
        raise HTTPException(status_code=400, detail="Expected 'employees' array in HiBob export")

    errors: list[dict] = []
    imported: list[int] = []
    updated: list[int] = []

    for row_num, emp in enumerate(employees, start=1):
        if not isinstance(emp, dict):
            errors.append({"row": row_num, "message": "Employee entry must be a JSON object"})
            continue
        try:
            # HiBob nested field mapping
            personal = emp.get("personal") or {}
            work = emp.get("work") or {}
            payroll = emp.get("payroll") or {}
            employment = emp.get("employment") or {}

            first_name = emp.get("firstName") or personal.get("firstName") or ""
            last_name = emp.get("lastName") or personal.get("surname") or ""
            email = (
                work.get("email")
                or emp.get("email")
                or personal.get("email")
            )
            employee_number = (
                emp.get("id")
                or work.get("employeeIdInCompany")
                or emp.get("employeeNumber")
            )
            department_name = (
                work.get("department")
                or emp.get("department")
            )
            job_title = work.get("title") or emp.get("title") or work.get("jobTitle")
            hire_date_raw = (
                work.get("startDate")
                or emp.get("startDate")
                or work.get("hireDate")
            )
            salary_raw = str(payroll.get("salary") or emp.get("salary") or "")
            currency = payroll.get("currency") or emp.get("currency") or "USD"
            employment_type_raw = (
                employment.get("type")
                or work.get("employmentType")
                or emp.get("employmentType")
                or "full_time"
            )
            employment_type = employment_type_raw.lower().replace(" ", "_").replace("-", "_")

            await _process_employee_row(
                db,
                row_num=row_num,
                first_name=first_name,
                last_name=last_name,
                email=email,
                employee_number=str(employee_number) if employee_number else None,
                department_name=department_name,
                job_title=job_title,
                hire_date_raw=hire_date_raw,
                salary_raw=salary_raw or None,
                currency=currency,
                employment_type=employment_type,
                errors=errors,
                imported_count=imported,
                updated_count=updated,
            )
        except Exception as exc:
            errors.append({"row": row_num, "message": str(exc)})

    await db.commit()
    return ImportResult(
        imported=len(imported),
        updated=len(updated),
        skipped=0,
        errors=errors,
    )


# ── ADP format import ─────────────────────────────────────────────────────────


@router.post(
    "/import/format/adp",
    summary="Import employees from ADP CSV export (HR admin)",
)
async def import_adp(
    current_user: CurrentUser,
    db: DBSession,
    file: UploadFile = File(..., description="ADP CSV export"),
    _admin: Any = Depends(require_app_admin("hr")),
) -> ImportResult:
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    errors: list[dict] = []
    imported: list[int] = []
    updated: list[int] = []

    for row_num, row in enumerate(reader, start=2):
        try:
            # ADP field mapping
            first_name = row.get("FirstName") or row.get("First Name") or row.get("first_name")
            last_name = row.get("LastName") or row.get("Last Name") or row.get("last_name")
            email = (
                row.get("WorkEmailAddress")
                or row.get("Work Email")
                or row.get("EmailAddress")
                or row.get("email")
            )
            employee_number = (
                row.get("FileNumber")
                or row.get("File Number")
                or row.get("EmployeeID")
                or row.get("Employee ID")
            )
            department_name = (
                row.get("Department")
                or row.get("DepartmentName")
                or row.get("Department Name")
            )
            job_title = (
                row.get("PositionTitle")
                or row.get("Position Title")
                or row.get("JobTitle")
                or row.get("Job Title")
            )
            hire_date_raw = (
                row.get("HireDate")
                or row.get("Hire Date")
                or row.get("OriginalHireDate")
                or row.get("Original Hire Date")
            )
            salary_raw = row.get("AnnualSalary") or row.get("Annual Salary") or row.get("Salary")
            currency = row.get("Currency") or row.get("CurrencyCode") or "USD"
            employment_type_raw = (
                row.get("PayClass")
                or row.get("Pay Class")
                or row.get("EmployeeType")
                or row.get("Employee Type")
                or "full_time"
            )
            # Map ADP pay classes to our types
            type_map = {
                "ft": "full_time",
                "pt": "part_time",
                "full time": "full_time",
                "part time": "part_time",
                "contractor": "contract",
                "temp": "contract",
            }
            employment_type = type_map.get(
                employment_type_raw.lower().strip(), employment_type_raw.lower().replace(" ", "_")
            )

            await _process_employee_row(
                db,
                row_num=row_num,
                first_name=first_name,
                last_name=last_name,
                email=email,
                employee_number=str(employee_number) if employee_number else None,
                department_name=department_name,
                job_title=job_title,
                hire_date_raw=hire_date_raw,
                salary_raw=salary_raw,
                currency=currency,
                employment_type=employment_type,
                errors=errors,
                imported_count=imported,
                updated_count=updated,
            )
        except Exception as exc:
            errors.append({"row": row_num, "message": str(exc)})

    await db.commit()
    return ImportResult(
        imported=len(imported),
        updated=len(updated),
        skipped=0,
        errors=errors,
    )


# ── CSV template download ─────────────────────────────────────────────────────


@router.get(
    "/import/template/csv",
    summary="Download CSV import template with correct headers",
    response_class=Response,
)
async def download_csv_template(current_user: CurrentUser) -> Response:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_TEMPLATE_HEADERS)
    # Include one example row so users understand the expected format
    writer.writerow([
        "Jane",
        "Smith",
        "jane.smith@company.com",
        "EMP-001",
        "Engineering",
        "Software Engineer",
        "2024-01-15",
        "75000",
        "USD",
        "full_time",
    ])
    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=employee_import_template.csv",
            "Content-Type": "text/csv; charset=utf-8",
        },
    )
