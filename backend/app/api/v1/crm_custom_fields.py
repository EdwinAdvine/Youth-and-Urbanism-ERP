"""CRM Custom Fields — CRUD for user-defined field definitions."""

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.crm import CustomFieldDefinition

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────


class CustomFieldCreate(BaseModel):
    entity_type: str  # contact, lead, opportunity, deal
    field_name: str
    field_label: str
    field_type: str  # text, number, date, dropdown, boolean, url, email
    options: dict | None = None
    is_required: bool = False
    default_value: str | None = None
    sort_order: int = 0


class CustomFieldUpdate(BaseModel):
    field_label: str | None = None
    field_type: str | None = None
    options: dict | None = None
    is_required: bool | None = None
    default_value: str | None = None
    sort_order: int | None = None


class CustomFieldOut(BaseModel):
    id: uuid.UUID
    entity_type: str
    field_name: str
    field_label: str
    field_type: str
    options: dict | None
    is_required: bool
    default_value: str | None
    sort_order: int
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/custom-fields", summary="List custom field definitions")
async def list_custom_fields(
    current_user: CurrentUser,
    db: DBSession,
    entity_type: str | None = Query(None, description="Filter by entity type"),
) -> dict[str, Any]:
    query = select(CustomFieldDefinition).order_by(CustomFieldDefinition.sort_order)
    if entity_type:
        query = query.where(CustomFieldDefinition.entity_type == entity_type)
    result = await db.execute(query)
    fields = result.scalars().all()
    return {"fields": [CustomFieldOut.model_validate(f).model_dump() for f in fields]}


@router.post("/custom-fields", status_code=201, summary="Create a custom field definition")
async def create_custom_field(
    payload: CustomFieldCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    field = CustomFieldDefinition(
        entity_type=payload.entity_type,
        field_name=payload.field_name,
        field_label=payload.field_label,
        field_type=payload.field_type,
        options=payload.options,
        is_required=payload.is_required,
        default_value=payload.default_value,
        sort_order=payload.sort_order,
        created_by=current_user.id,
    )
    db.add(field)
    await db.commit()
    await db.refresh(field)
    return CustomFieldOut.model_validate(field).model_dump()


@router.put("/custom-fields/{field_id}", summary="Update a custom field definition")
async def update_custom_field(
    field_id: uuid.UUID,
    payload: CustomFieldUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    field = await db.get(CustomFieldDefinition, field_id)
    if not field:
        raise HTTPException(status_code=404, detail="Custom field not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(field, k, v)
    await db.commit()
    await db.refresh(field)
    return CustomFieldOut.model_validate(field).model_dump()


@router.delete("/custom-fields/{field_id}", status_code=204, summary="Delete a custom field definition")
async def delete_custom_field(
    field_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    field = await db.get(CustomFieldDefinition, field_id)
    if not field:
        raise HTTPException(status_code=404, detail="Custom field not found")
    await db.delete(field)
    await db.commit()
    return Response(status_code=204)
