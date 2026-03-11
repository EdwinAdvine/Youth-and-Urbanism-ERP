from __future__ import annotations

import csv
import io
import secrets
from typing import Any

from fastapi import HTTPException, status
from pydantic import BaseModel, EmailStr, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User


class ImportRowValidator(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=255)
    role: str | None = None
    department: str | None = None


def _generate_password() -> str:
    """Generate a random URL-safe password."""
    return secrets.token_urlsafe(12)


async def parse_csv_preview(
    db: AsyncSession,
    csv_content: str,
) -> dict[str, Any]:
    """
    Parse CSV content, validate each row (format + DB duplicate check),
    and return a preview with valid rows and errors.
    Expected columns: email, full_name, role (optional), department (optional)
    """
    reader = csv.DictReader(io.StringIO(csv_content))

    if not reader.fieldnames:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file is empty or has no headers",
        )

    # Normalize field names
    normalized_fields = [f.strip().lower().replace(" ", "_") for f in reader.fieldnames]

    if "email" not in normalized_fields or "full_name" not in normalized_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV must have 'email' and 'full_name' columns",
        )

    valid_rows: list[dict[str, Any]] = []
    error_rows: list[dict[str, Any]] = []
    seen_emails: set[str] = set()

    for row_num, raw_row in enumerate(reader, start=2):  # row 1 is headers
        # Normalize keys
        row = {
            k.strip().lower().replace(" ", "_"): (v.strip() if v else "")
            for k, v in raw_row.items()
        }

        email_raw = row.get("email", "").lower()

        # Validate with pydantic
        try:
            validated = ImportRowValidator(
                email=row.get("email", ""),
                full_name=row.get("full_name", ""),
                role=row.get("role") or None,
                department=row.get("department") or None,
            )
        except ValidationError as e:
            errors = "; ".join(
                f"{err['loc'][-1]}: {err['msg']}" for err in e.errors()
            )
            error_rows.append({
                "row": row_num,
                "email": row.get("email", ""),
                "full_name": row.get("full_name", ""),
                "errors": errors,
            })
            continue

        # Check for duplicate within the CSV itself
        if email_raw in seen_emails:
            error_rows.append({
                "row": row_num,
                "email": validated.email,
                "full_name": validated.full_name,
                "errors": "Duplicate email within CSV",
            })
            continue

        # Check for existing user in DB
        existing = await db.execute(
            select(User.id).where(User.email == validated.email).limit(1)
        )
        if existing.scalar_one_or_none() is not None:
            error_rows.append({
                "row": row_num,
                "email": validated.email,
                "full_name": validated.full_name,
                "errors": "Email already exists in system",
            })
            continue

        seen_emails.add(email_raw)
        valid_rows.append({
            "row": row_num,
            "email": validated.email,
            "full_name": validated.full_name,
            "role": validated.role,
            "department": validated.department,
        })

    return {
        "total_rows": len(valid_rows) + len(error_rows),
        "valid_count": len(valid_rows),
        "error_count": len(error_rows),
        "valid_rows": valid_rows,
        "error_rows": error_rows,
    }


async def batch_create_users(
    db: AsyncSession,
    rows: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Batch-create users from validated rows.
    Returns summary with created count, skipped (duplicates), and generated passwords.
    """
    created: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []

    for row in rows:
        email = row["email"]

        # Double-check for existing user (race condition safety)
        existing = await db.execute(
            select(User.id).where(User.email == email).limit(1)
        )
        if existing.scalar_one_or_none() is not None:
            skipped.append({"email": email, "reason": "Email already exists"})
            continue

        password = row.get("password") or _generate_password()
        user = User(
            email=email,
            full_name=row["full_name"],
            hashed_password=hash_password(password),
            is_superadmin=False,
            is_active=True,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

        created.append({
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "generated_password": password,
        })

    await db.commit()

    return {
        "created_count": len(created),
        "skipped_count": len(skipped),
        "created_users": created,
        "skipped": skipped,
        "created": len(created),
        "message": f"{len(created)} users created successfully",
    }
