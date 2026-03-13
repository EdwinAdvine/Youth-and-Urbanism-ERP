"""Projects API — Custom field definitions and task field values."""

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.projects import Project, Task
from app.models.projects_enhanced import ProjectCustomField, TaskCustomFieldValue

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _user_can_access_project(project: Project, user_id: uuid.UUID) -> bool:
    if project.owner_id == user_id:
        return True
    members = project.members or []
    return str(user_id) in [str(m) for m in members]


VALID_FIELD_TYPES = {"text", "number", "dropdown", "date", "formula"}


# ── Schemas ──────────────────────────────────────────────────────────────────

class CustomFieldCreate(BaseModel):
    name: str
    field_type: str  # text | number | dropdown | date | formula
    options: dict | None = None
    default_value: str | None = None
    is_required: bool = False
    order: int = 0


class CustomFieldUpdate(BaseModel):
    name: str | None = None
    options: dict | None = None
    default_value: str | None = None
    is_required: bool | None = None
    order: int | None = None


class CustomFieldOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    field_type: str
    options: dict | None
    default_value: str | None
    is_required: bool
    order: int
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class FieldValueSet(BaseModel):
    field_id: uuid.UUID
    value_text: str | None = None
    value_number: float | None = None
    value_date: datetime | None = None


class BatchSetFieldValues(BaseModel):
    values: list[FieldValueSet]


class FieldValueOut(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    field_id: uuid.UUID
    value_text: str | None
    value_number: float | None
    value_date: datetime | None
    field_name: str | None = None
    field_type: str | None = None

    model_config = {"from_attributes": True}


# ── Custom field definition endpoints ────────────────────────────────────────

@router.post(
    "/{project_id}/custom-fields",
    status_code=status.HTTP_201_CREATED,
    summary="Define a custom field for the project",
)
async def create_custom_field(
    project_id: uuid.UUID,
    payload: CustomFieldCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found or not owner")

    if payload.field_type not in VALID_FIELD_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid field_type. Must be one of: {', '.join(VALID_FIELD_TYPES)}")

    field = ProjectCustomField(
        project_id=project_id,
        name=payload.name,
        field_type=payload.field_type,
        options=payload.options,
        default_value=payload.default_value,
        is_required=payload.is_required,
        order=payload.order,
    )
    db.add(field)
    await db.commit()
    await db.refresh(field)
    return CustomFieldOut.model_validate(field).model_dump()


@router.get(
    "/{project_id}/custom-fields",
    summary="List custom field definitions for a project",
)
async def list_custom_fields(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(ProjectCustomField)
        .where(ProjectCustomField.project_id == project_id)
        .order_by(ProjectCustomField.order.asc())
    )
    fields = result.scalars().all()
    return {
        "total": len(fields),
        "fields": [CustomFieldOut.model_validate(f).model_dump() for f in fields],
    }


@router.put(
    "/{project_id}/custom-fields/{field_id}",
    summary="Update a custom field definition",
)
async def update_custom_field(
    project_id: uuid.UUID,
    field_id: uuid.UUID,
    payload: CustomFieldUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found or not owner")

    field = await db.get(ProjectCustomField, field_id)
    if not field or field.project_id != project_id:
        raise HTTPException(status_code=404, detail="Custom field not found")

    for attr, value in payload.model_dump(exclude_none=True).items():
        setattr(field, attr, value)

    await db.commit()
    await db.refresh(field)
    return CustomFieldOut.model_validate(field).model_dump()


@router.delete(
    "/{project_id}/custom-fields/{field_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a custom field definition (cascades values)",
)
async def delete_custom_field(
    project_id: uuid.UUID,
    field_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    project = await db.get(Project, project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found or not owner")

    field = await db.get(ProjectCustomField, field_id)
    if not field or field.project_id != project_id:
        raise HTTPException(status_code=404, detail="Custom field not found")

    await db.delete(field)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ── Task custom field value endpoints ────────────────────────────────────────

@router.put(
    "/{project_id}/tasks/{task_id}/custom-fields",
    summary="Set/update custom field values on a task (batch)",
)
async def set_task_custom_field_values(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: BatchSetFieldValues,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    task = await db.get(Task, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found")

    results = []
    for fv in payload.values:
        # Validate field belongs to project
        field = await db.get(ProjectCustomField, fv.field_id)
        if not field or field.project_id != project_id:
            raise HTTPException(status_code=404, detail=f"Custom field {fv.field_id} not found in project")

        # Upsert: check if value exists
        existing_result = await db.execute(
            select(TaskCustomFieldValue).where(
                TaskCustomFieldValue.task_id == task_id,
                TaskCustomFieldValue.field_id == fv.field_id,
            )
        )
        existing = existing_result.scalar_one_or_none()

        if existing:
            existing.value_text = fv.value_text
            existing.value_number = fv.value_number
            existing.value_date = fv.value_date
            await db.flush()
            await db.refresh(existing)
            results.append(existing)
        else:
            new_val = TaskCustomFieldValue(
                task_id=task_id,
                field_id=fv.field_id,
                value_text=fv.value_text,
                value_number=fv.value_number,
                value_date=fv.value_date,
            )
            db.add(new_val)
            await db.flush()
            await db.refresh(new_val)
            results.append(new_val)

    await db.commit()
    return {
        "values": [
            {
                "id": str(r.id),
                "task_id": str(r.task_id),
                "field_id": str(r.field_id),
                "value_text": r.value_text,
                "value_number": r.value_number,
                "value_date": r.value_date.isoformat() if r.value_date else None,
            }
            for r in results
        ],
    }


@router.get(
    "/{project_id}/tasks/{task_id}/custom-fields",
    summary="Get custom field values for a task",
)
async def get_task_custom_field_values(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    task = await db.get(Task, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found")

    # Get all field definitions for the project
    fields_result = await db.execute(
        select(ProjectCustomField)
        .where(ProjectCustomField.project_id == project_id)
        .order_by(ProjectCustomField.order.asc())
    )
    fields = fields_result.scalars().all()
    field_map = {f.id: f for f in fields}

    # Get values for this task
    values_result = await db.execute(
        select(TaskCustomFieldValue).where(TaskCustomFieldValue.task_id == task_id)
    )
    values = values_result.scalars().all()
    value_map = {v.field_id: v for v in values}

    # Merge: show all fields with their values (or None)
    output = []
    for f in fields:
        v = value_map.get(f.id)
        output.append({
            "field_id": str(f.id),
            "field_name": f.name,
            "field_type": f.field_type,
            "is_required": f.is_required,
            "options": f.options,
            "value_id": str(v.id) if v else None,
            "value_text": v.value_text if v else None,
            "value_number": v.value_number if v else None,
            "value_date": v.value_date.isoformat() if v and v.value_date else None,
        })

    return {"fields": output}
