"""Finance API — Employee Expense Management."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.core.export import rows_to_csv
from app.integrations import minio_client
from app.models.drive import DriveFile
from app.models.finance import Expense

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    description: str
    amount: Decimal
    currency: str = "USD"
    category: str  # travel, meals, office, software, other
    expense_date: date
    receipt_file_id: uuid.UUID | None = None
    account_id: uuid.UUID | None = None


class ExpenseUpdate(BaseModel):
    description: str | None = None
    amount: Decimal | None = None
    currency: str | None = None
    category: str | None = None
    expense_date: date | None = None
    receipt_file_id: uuid.UUID | None = None
    account_id: uuid.UUID | None = None


class ExpenseReject(BaseModel):
    reason: str


class ExpenseOut(BaseModel):
    id: uuid.UUID
    description: str
    amount: Decimal
    currency: str
    category: str
    expense_date: date
    receipt_file_id: uuid.UUID | None
    status: str
    user_id: uuid.UUID
    approver_id: uuid.UUID | None
    approved_at: Any | None
    rejection_reason: str | None
    account_id: uuid.UUID | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/expenses", summary="List expenses")
async def list_expenses(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    user_id: uuid.UUID | None = Query(None, description="Filter by user (admin only)"),
    category: str | None = Query(None, description="Filter by category"),
    start_date: date | None = Query(None, description="Expense date start"),
    end_date: date | None = Query(None, description="Expense date end"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Expense)

    # Non-admins can only see their own expenses
    if not current_user.is_superadmin:
        if user_id and user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own expenses",
            )
        query = query.where(Expense.user_id == current_user.id)
    elif user_id:
        query = query.where(Expense.user_id == user_id)

    if status_filter:
        query = query.where(Expense.status == status_filter)
    if category:
        query = query.where(Expense.category == category)
    if start_date:
        query = query.where(Expense.expense_date >= start_date)
    if end_date:
        query = query.where(Expense.expense_date <= end_date)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Expense.expense_date.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    expenses = result.scalars().all()
    return {
        "total": total,
        "expenses": [ExpenseOut.model_validate(e) for e in expenses],
    }


@router.post("/expenses", status_code=status.HTTP_201_CREATED, summary="Create a new expense")
async def create_expense(
    payload: ExpenseCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    expense = Expense(
        description=payload.description,
        amount=payload.amount,
        currency=payload.currency,
        category=payload.category,
        expense_date=payload.expense_date,
        receipt_file_id=payload.receipt_file_id,
        account_id=payload.account_id,
        user_id=current_user.id,
        status="draft",
    )
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return ExpenseOut.model_validate(expense).model_dump()


@router.get("/expenses/export", summary="Export expenses as CSV")
async def export_expenses(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status"),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
):
    query = select(Expense)

    if not current_user.is_superadmin:
        query = query.where(Expense.user_id == current_user.id)

    if status_filter:
        query = query.where(Expense.status == status_filter)
    if start_date:
        query = query.where(Expense.expense_date >= start_date)
    if end_date:
        query = query.where(Expense.expense_date <= end_date)

    result = await db.execute(query.order_by(Expense.expense_date.desc()))
    expenses = result.scalars().all()

    columns = [
        "id", "description", "amount", "currency", "category",
        "expense_date", "status", "user_id", "approver_id",
        "approved_at", "rejection_reason",
    ]
    rows = [
        {
            "id": str(e.id),
            "description": e.description,
            "amount": str(e.amount),
            "currency": e.currency,
            "category": e.category,
            "expense_date": str(e.expense_date),
            "status": e.status,
            "user_id": str(e.user_id),
            "approver_id": str(e.approver_id) if e.approver_id else "",
            "approved_at": str(e.approved_at) if e.approved_at else "",
            "rejection_reason": e.rejection_reason or "",
        }
        for e in expenses
    ]
    return rows_to_csv(rows, columns, filename="expenses_export.csv")


@router.get("/expenses/{expense_id}", summary="Get expense detail")
async def get_expense(
    expense_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    expense = await db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    if expense.user_id != current_user.id and not current_user.is_superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return ExpenseOut.model_validate(expense).model_dump()


@router.put("/expenses/{expense_id}", summary="Update a draft expense")
async def update_expense(
    expense_id: uuid.UUID,
    payload: ExpenseUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    expense = await db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    if expense.user_id != current_user.id and not current_user.is_superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if expense.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only draft expenses can be updated",
        )

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(expense, field, value)

    await db.commit()
    await db.refresh(expense)
    return ExpenseOut.model_validate(expense).model_dump()


@router.put("/expenses/{expense_id}/submit", summary="Submit expense for approval")
async def submit_expense(
    expense_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    expense = await db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    if expense.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if expense.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot submit expense with status '{expense.status}'",
        )

    expense.status = "submitted"
    await db.commit()
    await db.refresh(expense)

    await event_bus.publish("expense.submitted", {
        "expense_id": str(expense.id),
        "user_id": str(expense.user_id),
        "amount": str(expense.amount),
        "currency": expense.currency,
        "category": expense.category,
    })

    return ExpenseOut.model_validate(expense).model_dump()


@router.put(
    "/expenses/{expense_id}/approve",
    summary="Approve an expense (Finance Admin)",
    dependencies=[Depends(require_app_admin("Finance"))],
)
async def approve_expense(
    expense_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    expense = await db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    if expense.status != "submitted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot approve expense with status '{expense.status}'",
        )

    expense.status = "approved"
    expense.approver_id = current_user.id
    expense.approved_at = datetime.utcnow()
    expense.rejection_reason = None
    await db.commit()
    await db.refresh(expense)

    await event_bus.publish("expense.approved", {
        "expense_id": str(expense.id),
        "user_id": str(expense.user_id),
        "approver_id": str(current_user.id),
        "amount": str(expense.amount),
        "currency": expense.currency,
    })

    return ExpenseOut.model_validate(expense).model_dump()


@router.put(
    "/expenses/{expense_id}/reject",
    summary="Reject an expense (Finance Admin)",
    dependencies=[Depends(require_app_admin("Finance"))],
)
async def reject_expense(
    expense_id: uuid.UUID,
    payload: ExpenseReject,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    expense = await db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    if expense.status != "submitted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot reject expense with status '{expense.status}'",
        )

    expense.status = "rejected"
    expense.approver_id = current_user.id
    expense.rejection_reason = payload.reason
    await db.commit()
    await db.refresh(expense)

    await event_bus.publish("expense.rejected", {
        "expense_id": str(expense.id),
        "user_id": str(expense.user_id),
        "approver_id": str(current_user.id),
        "reason": payload.reason,
    })

    return ExpenseOut.model_validate(expense).model_dump()


@router.put(
    "/expenses/{expense_id}/reimburse",
    summary="Mark expense as reimbursed (Finance Admin)",
    dependencies=[Depends(require_app_admin("Finance"))],
)
async def reimburse_expense(
    expense_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    expense = await db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    if expense.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot reimburse expense with status '{expense.status}' (must be approved first)",
        )

    expense.status = "reimbursed"
    await db.commit()
    await db.refresh(expense)

    await event_bus.publish("expense.reimbursed", {
        "expense_id": str(expense.id),
        "user_id": str(expense.user_id),
        "amount": str(expense.amount),
        "currency": expense.currency,
    })

    return ExpenseOut.model_validate(expense).model_dump()


@router.post(
    "/expenses/{expense_id}/receipt",
    status_code=status.HTTP_200_OK,
    summary="Upload a receipt image/PDF for an expense",
)
async def upload_expense_receipt(
    expense_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    file: UploadFile = File(...),
) -> dict[str, Any]:
    """Upload a receipt photo or PDF and attach it to the expense."""
    expense = await db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    if expense.user_id != current_user.id and not current_user.is_superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Validate file type
    allowed_types = {
        "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic",
        "application/pdf",
    }
    content_type = file.content_type or "application/octet-stream"
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{content_type}' not allowed. Use JPEG, PNG, GIF, WebP, HEIC, or PDF.",
        )

    # Limit to 10 MB
    file_data = await file.read()
    if len(file_data) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Receipt file must be under 10 MB",
        )

    filename = file.filename or f"receipt_{expense_id}"

    # Upload to MinIO
    record = minio_client.upload_file(
        file_data=file_data,
        filename=filename,
        user_id=str(current_user.id),
        folder_path="expense-receipts",
        content_type=content_type,
    )

    # Create a DriveFile record
    drive_file = DriveFile(
        id=uuid.UUID(record["file_id"]),
        name=filename,
        content_type=content_type,
        size=record["size"],
        minio_key=record["minio_key"],
        owner_id=current_user.id,
    )
    db.add(drive_file)

    # Attach to expense
    expense.receipt_file_id = drive_file.id
    await db.commit()
    await db.refresh(expense)

    return {
        "message": "Receipt uploaded successfully",
        "file_id": str(drive_file.id),
        "filename": filename,
        "content_type": content_type,
        "size": record["size"],
        "expense": ExpenseOut.model_validate(expense).model_dump(),
    }


@router.get(
    "/expenses/{expense_id}/receipt",
    summary="Download the receipt file for an expense",
)
async def get_expense_receipt(
    expense_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """Return a pre-signed URL to download the receipt."""
    expense = await db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    if expense.user_id != current_user.id and not current_user.is_superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if not expense.receipt_file_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No receipt attached")

    drive_file = await db.get(DriveFile, expense.receipt_file_id)
    if not drive_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt file not found in storage")

    url = minio_client.get_download_url(drive_file.minio_key)
    return {"url": url, "filename": drive_file.name, "content_type": drive_file.content_type}
