"""CRM Custom Objects — CRUD for user-defined object definitions, records & relationships."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.models.crm_custom_objects import (
    CustomObjectDefinition,
    CustomObjectRecord,
    CustomObjectRelationship,
)

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────


class FieldSchema(BaseModel):
    name: str
    label: str
    type: str  # text, number, date, dropdown, boolean, url, email, textarea
    required: bool = False
    options: list[str] | None = None
    default_value: str | None = None


class RelationshipSchema(BaseModel):
    name: str
    related_object: str
    relationship_type: str  # one_to_many, many_to_one, many_to_many


# ── Definition Schemas ────────────────────────────────────────────────────────


class CustomObjectDefinitionCreate(BaseModel):
    name: str
    label: str
    plural_label: str
    description: str | None = None
    icon: str | None = None
    fields: list[FieldSchema] | None = None
    relationships: list[RelationshipSchema] | None = None
    is_active: bool = True


class CustomObjectDefinitionUpdate(BaseModel):
    label: str | None = None
    plural_label: str | None = None
    description: str | None = None
    icon: str | None = None
    fields: list[FieldSchema] | None = None
    relationships: list[RelationshipSchema] | None = None
    is_active: bool | None = None


class CustomObjectDefinitionOut(BaseModel):
    id: uuid.UUID
    name: str
    label: str
    plural_label: str
    description: str | None
    icon: str | None
    fields: list[dict[str, Any]] | None
    relationships: list[dict[str, Any]] | None
    is_active: bool
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


# ── Record Schemas ────────────────────────────────────────────────────────────


class CustomObjectRecordCreate(BaseModel):
    data: dict[str, Any] | None = None


class CustomObjectRecordUpdate(BaseModel):
    data: dict[str, Any] | None = None


class CustomObjectRelationshipOut(BaseModel):
    id: uuid.UUID
    record_id: uuid.UUID
    related_entity_type: str
    related_entity_id: uuid.UUID
    relationship_type: str
    created_at: Any
    model_config = {"from_attributes": True}


class CustomObjectRecordOut(BaseModel):
    id: uuid.UUID
    definition_id: uuid.UUID
    data: dict[str, Any] | None
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any
    record_relationships: list[CustomObjectRelationshipOut] = []
    model_config = {"from_attributes": True}


class CustomObjectRecordListOut(BaseModel):
    id: uuid.UUID
    definition_id: uuid.UUID
    data: dict[str, Any] | None
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


# ── Relationship Schemas ──────────────────────────────────────────────────────


class RelationshipCreate(BaseModel):
    related_entity_type: str
    related_entity_id: uuid.UUID
    relationship_type: str


# ── Helpers ───────────────────────────────────────────────────────────────────


def _validate_record_data(
    definition: CustomObjectDefinition, data: dict[str, Any] | None
) -> None:
    """Validate record data against definition fields."""
    fields = definition.fields or []
    if not fields:
        return

    data = data or {}
    field_map = {f["name"]: f for f in fields}

    # Check required fields
    for field in fields:
        if field.get("required") and field["name"] not in data:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Required field '{field['name']}' is missing",
            )

    # Check for unknown fields
    for key in data:
        if key not in field_map:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unknown field '{key}' — not defined on this custom object",
            )


# ── Definition Endpoints ─────────────────────────────────────────────────────


@router.get("/custom-objects", summary="List custom object definitions")
async def list_custom_object_definitions(
    current_user: CurrentUser,
    db: DBSession,
    is_active: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    q = select(CustomObjectDefinition)
    count_q = select(func.count(CustomObjectDefinition.id))

    if is_active is not None:
        q = q.where(CustomObjectDefinition.is_active == is_active)
        count_q = count_q.where(CustomObjectDefinition.is_active == is_active)

    total = (await db.execute(count_q)).scalar() or 0
    rows = (
        await db.execute(
            q.order_by(CustomObjectDefinition.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
    ).scalars().all()

    return {
        "total": total,
        "items": [CustomObjectDefinitionOut.model_validate(r) for r in rows],
    }


@router.post(
    "/custom-objects",
    status_code=status.HTTP_201_CREATED,
    summary="Create custom object definition",
)
async def create_custom_object_definition(
    body: CustomObjectDefinitionCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> CustomObjectDefinitionOut:
    # Check for duplicate name
    existing = (
        await db.execute(
            select(CustomObjectDefinition).where(
                CustomObjectDefinition.name == body.name
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Custom object with name '{body.name}' already exists",
        )

    obj = CustomObjectDefinition(
        name=body.name,
        label=body.label,
        plural_label=body.plural_label,
        description=body.description,
        icon=body.icon,
        fields=[f.model_dump() for f in body.fields] if body.fields else None,
        relationships=[r.model_dump() for r in body.relationships]
        if body.relationships
        else None,
        is_active=body.is_active,
        created_by=current_user.id,
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return CustomObjectDefinitionOut.model_validate(obj)


@router.get("/custom-objects/{definition_id}", summary="Get custom object definition")
async def get_custom_object_definition(
    definition_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> CustomObjectDefinitionOut:
    obj = (
        await db.execute(
            select(CustomObjectDefinition).where(
                CustomObjectDefinition.id == definition_id
            )
        )
    ).scalar_one_or_none()
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom object definition not found",
        )
    return CustomObjectDefinitionOut.model_validate(obj)


@router.put("/custom-objects/{definition_id}", summary="Update custom object definition")
async def update_custom_object_definition(
    definition_id: uuid.UUID,
    body: CustomObjectDefinitionUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> CustomObjectDefinitionOut:
    obj = (
        await db.execute(
            select(CustomObjectDefinition).where(
                CustomObjectDefinition.id == definition_id
            )
        )
    ).scalar_one_or_none()
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom object definition not found",
        )

    updates = body.model_dump(exclude_unset=True)
    if "fields" in updates and updates["fields"] is not None:
        updates["fields"] = [f.model_dump() for f in body.fields]  # type: ignore[union-attr]
    if "relationships" in updates and updates["relationships"] is not None:
        updates["relationships"] = [r.model_dump() for r in body.relationships]  # type: ignore[union-attr]

    for key, value in updates.items():
        setattr(obj, key, value)

    await db.commit()
    await db.refresh(obj)
    return CustomObjectDefinitionOut.model_validate(obj)


@router.delete(
    "/custom-objects/{definition_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete custom object definition (cascades records & relationships)",
)
async def delete_custom_object_definition(
    definition_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    obj = (
        await db.execute(
            select(CustomObjectDefinition).where(
                CustomObjectDefinition.id == definition_id
            )
        )
    ).scalar_one_or_none()
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom object definition not found",
        )

    # Delete relationships for all records of this definition
    records = (
        await db.execute(
            select(CustomObjectRecord).where(
                CustomObjectRecord.definition_id == definition_id
            )
        )
    ).scalars().all()

    for record in records:
        rels = (
            await db.execute(
                select(CustomObjectRelationship).where(
                    CustomObjectRelationship.record_id == record.id
                )
            )
        ).scalars().all()
        for rel in rels:
            await db.delete(rel)
        await db.delete(record)

    await db.delete(obj)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Record Endpoints ─────────────────────────────────────────────────────────


@router.get(
    "/custom-objects/{definition_id}/records",
    summary="List records for a custom object definition",
)
async def list_custom_object_records(
    definition_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    # Verify definition exists
    defn = (
        await db.execute(
            select(CustomObjectDefinition).where(
                CustomObjectDefinition.id == definition_id
            )
        )
    ).scalar_one_or_none()
    if not defn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom object definition not found",
        )

    count_q = select(func.count(CustomObjectRecord.id)).where(
        CustomObjectRecord.definition_id == definition_id
    )
    total = (await db.execute(count_q)).scalar() or 0

    rows = (
        await db.execute(
            select(CustomObjectRecord)
            .where(CustomObjectRecord.definition_id == definition_id)
            .order_by(CustomObjectRecord.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
    ).scalars().all()

    return {
        "total": total,
        "items": [CustomObjectRecordListOut.model_validate(r) for r in rows],
    }


@router.post(
    "/custom-objects/{definition_id}/records",
    status_code=status.HTTP_201_CREATED,
    summary="Create record for a custom object definition",
)
async def create_custom_object_record(
    definition_id: uuid.UUID,
    body: CustomObjectRecordCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> CustomObjectRecordListOut:
    defn = (
        await db.execute(
            select(CustomObjectDefinition).where(
                CustomObjectDefinition.id == definition_id
            )
        )
    ).scalar_one_or_none()
    if not defn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom object definition not found",
        )
    if not defn.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create records for an inactive custom object",
        )

    _validate_record_data(defn, body.data)

    record = CustomObjectRecord(
        definition_id=definition_id,
        data=body.data,
        owner_id=current_user.id,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return CustomObjectRecordListOut.model_validate(record)


@router.get(
    "/custom-object-records/{record_id}",
    summary="Get single record with relationships",
)
async def get_custom_object_record(
    record_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> CustomObjectRecordOut:
    record = (
        await db.execute(
            select(CustomObjectRecord)
            .where(CustomObjectRecord.id == record_id)
            .options(selectinload(CustomObjectRecord.record_relationships))
        )
    ).scalar_one_or_none()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom object record not found",
        )
    return CustomObjectRecordOut.model_validate(record)


@router.put(
    "/custom-object-records/{record_id}",
    summary="Update record data",
)
async def update_custom_object_record(
    record_id: uuid.UUID,
    body: CustomObjectRecordUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> CustomObjectRecordListOut:
    record = (
        await db.execute(
            select(CustomObjectRecord).where(CustomObjectRecord.id == record_id)
        )
    ).scalar_one_or_none()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom object record not found",
        )

    # Validate against definition
    defn = (
        await db.execute(
            select(CustomObjectDefinition).where(
                CustomObjectDefinition.id == record.definition_id
            )
        )
    ).scalar_one_or_none()
    if defn:
        _validate_record_data(defn, body.data)

    if body.data is not None:
        record.data = body.data

    await db.commit()
    await db.refresh(record)
    return CustomObjectRecordListOut.model_validate(record)


@router.delete(
    "/custom-object-records/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete record",
)
async def delete_custom_object_record(
    record_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    record = (
        await db.execute(
            select(CustomObjectRecord).where(CustomObjectRecord.id == record_id)
        )
    ).scalar_one_or_none()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom object record not found",
        )

    # Delete related relationships first
    rels = (
        await db.execute(
            select(CustomObjectRelationship).where(
                CustomObjectRelationship.record_id == record_id
            )
        )
    ).scalars().all()
    for rel in rels:
        await db.delete(rel)

    await db.delete(record)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Relationship Endpoints ───────────────────────────────────────────────────


@router.post(
    "/custom-object-records/{record_id}/relationships",
    status_code=status.HTTP_201_CREATED,
    summary="Add relationship to a record",
)
async def add_record_relationship(
    record_id: uuid.UUID,
    body: RelationshipCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> CustomObjectRelationshipOut:
    record = (
        await db.execute(
            select(CustomObjectRecord).where(CustomObjectRecord.id == record_id)
        )
    ).scalar_one_or_none()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom object record not found",
        )

    rel = CustomObjectRelationship(
        record_id=record_id,
        related_entity_type=body.related_entity_type,
        related_entity_id=body.related_entity_id,
        relationship_type=body.relationship_type,
    )
    db.add(rel)
    await db.commit()
    await db.refresh(rel)
    return CustomObjectRelationshipOut.model_validate(rel)


@router.delete(
    "/custom-object-records/{record_id}/relationships/{rel_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove relationship from a record",
)
async def remove_record_relationship(
    record_id: uuid.UUID,
    rel_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    rel = (
        await db.execute(
            select(CustomObjectRelationship).where(
                CustomObjectRelationship.id == rel_id,
                CustomObjectRelationship.record_id == record_id,
            )
        )
    ).scalar_one_or_none()
    if not rel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Relationship not found",
        )

    await db.delete(rel)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
