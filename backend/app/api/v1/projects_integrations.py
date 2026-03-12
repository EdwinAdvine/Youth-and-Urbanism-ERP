"""Projects cross-module integrations API.

Provides soft links between Projects and other modules:
  1. Projects -> Drive: auto-create/link a Drive folder per project, list files
  2. Projects -> Docs: create documents from project context
  3. Projects -> CRM: link projects to deals
  4. Projects -> Finance: cost tracking (time * rate + linked expenses)
"""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.models.crm import Deal
from app.models.drive import DriveFile, DriveFolder
from app.models.finance import Expense
from app.models.project_links import (
    ProjectDealLink,
    ProjectDocument,
    ProjectDriveFolder,
    ProjectExpenseLink,
)
from app.models.projects import Project, Task, TimeLog

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _user_can_access_project(project: Project, user_id: uuid.UUID) -> bool:
    """Return True if the user owns the project or is a member."""
    if project.owner_id == user_id:
        return True
    members = project.members or []
    return str(user_id) in [str(m) for m in members]


async def _get_project_or_404(
    project_id: uuid.UUID, user_id: uuid.UUID, db: Any
) -> Project:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    return project


# ── Schemas ──────────────────────────────────────────────────────────────────

class LinkDriveOut(BaseModel):
    project_id: uuid.UUID
    folder_id: uuid.UUID
    folder_name: str
    created: bool  # True if newly created, False if already existed

    model_config = {"from_attributes": True}


class DriveFileOut(BaseModel):
    id: uuid.UUID
    name: str
    content_type: str
    size: int
    folder_path: str
    created_at: Any

    model_config = {"from_attributes": True}


class CreateDocumentPayload(BaseModel):
    title: str
    doc_type: str = "document"  # document | spreadsheet | presentation


class ProjectDocumentOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    file_id: uuid.UUID
    title: str
    doc_type: str
    created_at: Any

    model_config = {"from_attributes": True}


class LinkDealPayload(BaseModel):
    deal_id: uuid.UUID
    notes: str | None = None


class DealLinkOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    deal_id: uuid.UUID
    deal_title: str | None = None
    deal_value: float | None = None
    deal_status: str | None = None
    notes: str | None = None
    created_at: Any

    model_config = {"from_attributes": True}


class LinkExpensePayload(BaseModel):
    expense_id: uuid.UUID


class ExpenseLinkOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    expense_id: uuid.UUID
    expense_description: str | None = None
    expense_amount: float | None = None
    expense_category: str | None = None
    expense_date: Any | None = None
    created_at: Any

    model_config = {"from_attributes": True}


class ProjectCostSummary(BaseModel):
    project_id: str
    project_name: str
    total_hours: float
    hourly_rate: float
    labor_cost: float
    total_expenses: float
    grand_total: float
    time_by_user: list[dict[str, Any]]
    expenses: list[dict[str, Any]]


# ═══════════════════════════════════════════════════════════════════════════════
# 1. PROJECTS → DRIVE: Project Files Folder
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/{project_id}/link-drive",
    status_code=status.HTTP_201_CREATED,
    summary="Create or get the Drive folder linked to this project",
)
async def link_drive_folder(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> LinkDriveOut:
    project = await _get_project_or_404(project_id, current_user.id, db)

    # Check if already linked
    existing = await db.execute(
        select(ProjectDriveFolder).where(
            ProjectDriveFolder.project_id == project_id
        )
    )
    link = existing.scalar_one_or_none()
    if link:
        folder = await db.get(DriveFolder, link.folder_id)
        return LinkDriveOut(
            project_id=project_id,
            folder_id=link.folder_id,
            folder_name=folder.name if folder else "Project Files",
            created=False,
        )

    # Create a new Drive folder for this project
    folder = DriveFolder(
        name=f"Project: {project.name}",
        parent_id=None,
        owner_id=current_user.id,
    )
    db.add(folder)
    await db.flush()

    link = ProjectDriveFolder(
        project_id=project_id,
        folder_id=folder.id,
    )
    db.add(link)
    await db.commit()
    await db.refresh(folder)

    return LinkDriveOut(
        project_id=project_id,
        folder_id=folder.id,
        folder_name=folder.name,
        created=True,
    )


@router.get(
    "/{project_id}/files",
    summary="List Drive files in the project's linked folder",
)
async def list_project_files(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_project_or_404(project_id, current_user.id, db)

    # Find linked folder
    link_result = await db.execute(
        select(ProjectDriveFolder).where(
            ProjectDriveFolder.project_id == project_id
        )
    )
    link = link_result.scalar_one_or_none()
    if not link:
        return {"total": 0, "files": [], "folder_id": None}

    # List files in the folder
    files_result = await db.execute(
        select(DriveFile)
        .where(DriveFile.folder_id == link.folder_id)
        .order_by(DriveFile.created_at.desc())
    )
    files = files_result.scalars().all()

    return {
        "total": len(files),
        "folder_id": str(link.folder_id),
        "files": [
            DriveFileOut.model_validate(f).model_dump() for f in files
        ],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 2. PROJECTS → DOCS: Project Documentation
# ═══════════════════════════════════════════════════════════════════════════════

CONTENT_TYPE_MAP = {
    "document": "application/vnd.oasis.opendocument.text",
    "spreadsheet": "application/vnd.oasis.opendocument.spreadsheet",
    "presentation": "application/vnd.oasis.opendocument.presentation",
}

EXTENSION_MAP = {
    "document": ".docx",
    "spreadsheet": ".xlsx",
    "presentation": ".pptx",
}


@router.post(
    "/{project_id}/create-document",
    status_code=status.HTTP_201_CREATED,
    summary="Create a blank document linked to this project",
)
async def create_project_document(
    project_id: uuid.UUID,
    payload: CreateDocumentPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> ProjectDocumentOut:
    project = await _get_project_or_404(project_id, current_user.id, db)

    # Ensure project has a drive folder
    link_result = await db.execute(
        select(ProjectDriveFolder).where(
            ProjectDriveFolder.project_id == project_id
        )
    )
    folder_link = link_result.scalar_one_or_none()

    if not folder_link:
        # Auto-create Drive folder
        folder = DriveFolder(
            name=f"Project: {project.name}",
            parent_id=None,
            owner_id=current_user.id,
        )
        db.add(folder)
        await db.flush()
        folder_link = ProjectDriveFolder(
            project_id=project_id,
            folder_id=folder.id,
        )
        db.add(folder_link)
        await db.flush()

    # Create a DriveFile entry as a blank document placeholder
    ext = EXTENSION_MAP.get(payload.doc_type, ".docx")
    content_type = CONTENT_TYPE_MAP.get(
        payload.doc_type, "application/octet-stream"
    )
    safe_title = payload.title.replace("/", "-")
    minio_key = f"projects/{project_id}/docs/{uuid.uuid4()}{ext}"

    drive_file = DriveFile(
        name=f"{safe_title}{ext}",
        content_type=content_type,
        size=0,
        minio_key=minio_key,
        folder_path=f"/projects/{project.name}/",
        folder_id=folder_link.folder_id,
        owner_id=current_user.id,
    )
    db.add(drive_file)
    await db.flush()

    # Create the project-document link
    doc = ProjectDocument(
        project_id=project_id,
        file_id=drive_file.id,
        title=payload.title,
        doc_type=payload.doc_type,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return ProjectDocumentOut.model_validate(doc)


@router.get(
    "/{project_id}/documents",
    summary="List documents linked to this project",
)
async def list_project_documents(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_project_or_404(project_id, current_user.id, db)

    result = await db.execute(
        select(ProjectDocument)
        .where(ProjectDocument.project_id == project_id)
        .order_by(ProjectDocument.created_at.desc())
    )
    docs = result.scalars().all()

    return {
        "total": len(docs),
        "documents": [
            ProjectDocumentOut.model_validate(d).model_dump() for d in docs
        ],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 3. PROJECTS → CRM: Link to Deals
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/{project_id}/link-deal",
    status_code=status.HTTP_201_CREATED,
    summary="Link a CRM deal to this project",
)
async def link_deal(
    project_id: uuid.UUID,
    payload: LinkDealPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> DealLinkOut:
    await _get_project_or_404(project_id, current_user.id, db)

    # Verify deal exists
    deal = await db.get(Deal, payload.deal_id)
    if not deal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found"
        )

    # Check for duplicate
    existing = await db.execute(
        select(ProjectDealLink).where(
            ProjectDealLink.project_id == project_id,
            ProjectDealLink.deal_id == payload.deal_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Deal is already linked to this project",
        )

    link = ProjectDealLink(
        project_id=project_id,
        deal_id=payload.deal_id,
        notes=payload.notes,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)

    return DealLinkOut(
        id=link.id,
        project_id=link.project_id,
        deal_id=link.deal_id,
        deal_title=deal.title,
        deal_value=float(deal.deal_value),
        deal_status=deal.status,
        notes=link.notes,
        created_at=link.created_at,
    )


@router.get(
    "/{project_id}/linked-deals",
    summary="List CRM deals linked to this project",
)
async def list_linked_deals(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_project_or_404(project_id, current_user.id, db)

    result = await db.execute(
        select(ProjectDealLink, Deal)
        .join(Deal, ProjectDealLink.deal_id == Deal.id)
        .where(ProjectDealLink.project_id == project_id)
        .order_by(ProjectDealLink.created_at.desc())
    )
    rows = result.all()

    deals = []
    total_value = Decimal("0")
    for link, deal in rows:
        total_value += deal.deal_value or Decimal("0")
        deals.append(
            DealLinkOut(
                id=link.id,
                project_id=link.project_id,
                deal_id=link.deal_id,
                deal_title=deal.title,
                deal_value=float(deal.deal_value),
                deal_status=deal.status,
                notes=link.notes,
                created_at=link.created_at,
            ).model_dump()
        )

    return {
        "total": len(deals),
        "total_deal_value": float(total_value),
        "deals": deals,
    }


@router.delete(
    "/{project_id}/unlink-deal/{deal_id}",
    status_code=status.HTTP_200_OK,
    summary="Unlink a CRM deal from this project",
)
async def unlink_deal(
    project_id: uuid.UUID,
    deal_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    await _get_project_or_404(project_id, current_user.id, db)

    result = await db.execute(
        select(ProjectDealLink).where(
            ProjectDealLink.project_id == project_id,
            ProjectDealLink.deal_id == deal_id,
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deal link not found",
        )

    await db.delete(link)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ═══════════════════════════════════════════════════════════════════════════════
# 4. PROJECTS → FINANCE: Cost Tracking
# ═══════════════════════════════════════════════════════════════════════════════

DEFAULT_HOURLY_RATE = 50.0  # Default rate when not configured


@router.get(
    "/{project_id}/costs",
    summary="Project cost summary: labor (time * rate) + linked expenses",
)
async def get_project_costs(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    hourly_rate: float = Query(DEFAULT_HOURLY_RATE, description="Hourly rate for labor cost calculation"),
) -> ProjectCostSummary:
    project = await _get_project_or_404(project_id, current_user.id, db)

    # Aggregate time logs by user
    user_hours_result = await db.execute(
        select(
            TimeLog.user_id,
            func.sum(TimeLog.hours).label("total_hours"),
        )
        .join(Task, TimeLog.task_id == Task.id)
        .where(Task.project_id == project_id)
        .group_by(TimeLog.user_id)
    )
    user_rows = user_hours_result.all()

    total_hours = sum(float(r.total_hours) for r in user_rows)
    labor_cost = total_hours * hourly_rate

    time_by_user = [
        {
            "user_id": str(r.user_id),
            "hours": float(r.total_hours),
            "cost": float(r.total_hours) * hourly_rate,
        }
        for r in user_rows
    ]

    # Get linked expenses
    expense_result = await db.execute(
        select(ProjectExpenseLink, Expense)
        .join(Expense, ProjectExpenseLink.expense_id == Expense.id)
        .where(ProjectExpenseLink.project_id == project_id)
        .order_by(Expense.expense_date.desc())
    )
    expense_rows = expense_result.all()

    total_expenses = Decimal("0")
    expenses_list = []
    for link, expense in expense_rows:
        total_expenses += expense.amount
        expenses_list.append({
            "link_id": str(link.id),
            "expense_id": str(expense.id),
            "description": expense.description,
            "amount": float(expense.amount),
            "category": expense.category,
            "expense_date": expense.expense_date.isoformat() if expense.expense_date else None,
            "status": expense.status,
        })

    grand_total = labor_cost + float(total_expenses)

    return ProjectCostSummary(
        project_id=str(project_id),
        project_name=project.name,
        total_hours=total_hours,
        hourly_rate=hourly_rate,
        labor_cost=labor_cost,
        total_expenses=float(total_expenses),
        grand_total=grand_total,
        time_by_user=time_by_user,
        expenses=expenses_list,
    )


@router.post(
    "/{project_id}/link-expense",
    status_code=status.HTTP_201_CREATED,
    summary="Link a finance expense to this project",
)
async def link_expense(
    project_id: uuid.UUID,
    payload: LinkExpensePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> ExpenseLinkOut:
    await _get_project_or_404(project_id, current_user.id, db)

    # Verify expense exists
    expense = await db.get(Expense, payload.expense_id)
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found"
        )

    # Check for duplicate
    existing = await db.execute(
        select(ProjectExpenseLink).where(
            ProjectExpenseLink.project_id == project_id,
            ProjectExpenseLink.expense_id == payload.expense_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Expense is already linked to this project",
        )

    link = ProjectExpenseLink(
        project_id=project_id,
        expense_id=payload.expense_id,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)

    return ExpenseLinkOut(
        id=link.id,
        project_id=link.project_id,
        expense_id=link.expense_id,
        expense_description=expense.description,
        expense_amount=float(expense.amount),
        expense_category=expense.category,
        expense_date=expense.expense_date,
        created_at=link.created_at,
    )


@router.delete(
    "/{project_id}/unlink-expense/{expense_id}",
    status_code=status.HTTP_200_OK,
    summary="Unlink a finance expense from this project",
)
async def unlink_expense(
    project_id: uuid.UUID,
    expense_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    await _get_project_or_404(project_id, current_user.id, db)

    result = await db.execute(
        select(ProjectExpenseLink).where(
            ProjectExpenseLink.project_id == project_id,
            ProjectExpenseLink.expense_id == expense_id,
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense link not found",
        )

    await db.delete(link)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)
