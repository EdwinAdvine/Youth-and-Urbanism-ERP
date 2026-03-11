"""Forms API — CRUD for forms, fields, and responses."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.models.forms import Form, FormField, FormResponse

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class FieldCreate(BaseModel):
    label: str
    field_type: str = "text"
    options: list | None = None
    is_required: bool = False
    order: int = 0


class FormCreate(BaseModel):
    title: str
    description: str | None = None
    is_published: bool = False
    settings: dict | None = None
    fields: list[FieldCreate] | None = None


class FormUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    is_published: bool | None = None
    settings: dict | None = None


class BulkFieldsUpdate(BaseModel):
    fields: list[FieldCreate]


class ResponseSubmit(BaseModel):
    answers: dict[str, Any]


class FieldOut(BaseModel):
    id: uuid.UUID
    form_id: uuid.UUID
    label: str
    field_type: str
    options: list | None
    is_required: bool
    order: int
    validation_rules: dict | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class FormOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    is_published: bool
    is_template: bool
    settings: dict | None
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class FormDetailOut(FormOut):
    fields: list[FieldOut] = []


class FormResponseOut(BaseModel):
    id: uuid.UUID
    form_id: uuid.UUID
    respondent_id: uuid.UUID | None
    answers: dict
    submitted_at: Any
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", summary="List forms owned by the current user")
async def list_forms(
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    # Count total
    count_query = select(func.count()).select_from(Form).where(Form.owner_id == current_user.id)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Fetch page
    query = (
        select(Form)
        .where(Form.owner_id == current_user.id)
        .order_by(Form.updated_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(query)
    forms = result.scalars().all()
    return {
        "total": total,
        "forms": [FormOut.model_validate(f) for f in forms],
    }


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create a form")
async def create_form(
    payload: FormCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    form = Form(
        title=payload.title,
        description=payload.description,
        is_published=payload.is_published,
        settings=payload.settings or {},
        owner_id=current_user.id,
    )
    db.add(form)
    await db.flush()

    # Create nested fields if provided
    if payload.fields:
        for idx, field_data in enumerate(payload.fields):
            field = FormField(
                form_id=form.id,
                label=field_data.label,
                field_type=field_data.field_type,
                options=field_data.options,
                is_required=field_data.is_required,
                order=field_data.order if field_data.order else idx,
            )
            db.add(field)

    await db.commit()

    # Re-fetch with fields eager-loaded
    query = (
        select(Form)
        .where(Form.id == form.id)
        .options(selectinload(Form.fields))
    )
    result = await db.execute(query)
    form = result.scalar_one()
    return FormDetailOut.model_validate(form).model_dump()


@router.get("/{form_id}", summary="Get form detail with fields")
async def get_form(
    form_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    query = (
        select(Form)
        .where(Form.id == form_id)
        .options(selectinload(Form.fields))
    )
    result = await db.execute(query)
    form = result.scalar_one_or_none()

    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    # Allow access if owner or if form is published
    if form.owner_id != current_user.id and not form.is_published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    return FormDetailOut.model_validate(form).model_dump()


@router.put("/{form_id}", summary="Update a form")
async def update_form(
    form_id: uuid.UUID,
    payload: FormUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    form = await db.get(Form, form_id)
    if not form or form.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(form, field, value)

    await db.commit()
    await db.refresh(form)
    return FormOut.model_validate(form).model_dump()


@router.delete("/{form_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a form")
async def delete_form(
    form_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    form = await db.get(Form, form_id)
    if not form or form.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    await db.delete(form)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{form_id}/fields", summary="Bulk update fields (replace all)")
async def bulk_update_fields(
    form_id: uuid.UUID,
    payload: BulkFieldsUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Load form with existing fields
    query = (
        select(Form)
        .where(Form.id == form_id)
        .options(selectinload(Form.fields))
    )
    result = await db.execute(query)
    form = result.scalar_one_or_none()

    if not form or form.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    # Delete existing fields
    for existing_field in form.fields:
        await db.delete(existing_field)

    # Create new fields
    for idx, field_data in enumerate(payload.fields):
        field = FormField(
            form_id=form.id,
            label=field_data.label,
            field_type=field_data.field_type,
            options=field_data.options,
            is_required=field_data.is_required,
            order=field_data.order if field_data.order else idx,
        )
        db.add(field)

    await db.commit()

    # Re-fetch with updated fields
    result = await db.execute(
        select(Form).where(Form.id == form.id).options(selectinload(Form.fields))
    )
    form = result.scalar_one()
    return FormDetailOut.model_validate(form).model_dump()


@router.post(
    "/{form_id}/responses",
    status_code=status.HTTP_201_CREATED,
    summary="Submit a response",
)
async def submit_response(
    form_id: uuid.UUID,
    payload: ResponseSubmit,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Load form with fields for validation
    query = (
        select(Form)
        .where(Form.id == form_id)
        .options(selectinload(Form.fields))
    )
    result = await db.execute(query)
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    if not form.is_published:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Form is not published and cannot accept responses",
        )

    # ── Server-side field validation ─────────────────────────────────────
    errors: list[str] = []

    for field in form.fields:
        fid = str(field.id)
        value = payload.answers.get(fid)

        # Required check
        if field.is_required and (value is None or value == "" or value == []):
            errors.append(f"Field '{field.label}' is required")
            continue

        if value is None or value == "":
            continue  # optional and empty — skip type checks

        # Type checks
        if field.field_type == "number":
            try:
                float(value)
            except (ValueError, TypeError):
                errors.append(f"Field '{field.label}' must be a number")

        elif field.field_type == "email":
            if not isinstance(value, str) or "@" not in value:
                errors.append(f"Field '{field.label}' must be a valid email")

        elif field.field_type in ("select", "radio"):
            valid_options = field.options or []
            if value not in valid_options:
                errors.append(
                    f"Field '{field.label}' must be one of: {', '.join(str(o) for o in valid_options)}"
                )

        elif field.field_type == "checkbox":
            if not isinstance(value, list):
                errors.append(f"Field '{field.label}' must be a list of selected options")
            elif field.options:
                invalid = [v for v in value if v not in field.options]
                if invalid:
                    errors.append(f"Field '{field.label}' contains invalid options: {invalid}")

    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"validation_errors": errors},
        )

    # Determine respondent — anonymous if settings allow it
    form_settings = form.settings or {}
    respondent_id = None if form_settings.get("allow_anonymous") else current_user.id

    response = FormResponse(
        form_id=form.id,
        respondent_id=respondent_id,
        answers=payload.answers,
    )
    db.add(response)
    await db.commit()
    await db.refresh(response)

    # Publish event for cross-module integrations (e.g. lead capture forms → CRM)
    from app.core.events import event_bus  # noqa: PLC0415
    await event_bus.publish("form.submitted", {
        "form_id": str(form.id),
        "response_id": str(response.id),
        "form_title": form.title,
        "answers": payload.answers,
        "respondent_id": str(respondent_id) if respondent_id else None,
    })

    return FormResponseOut.model_validate(response).model_dump()


@router.get("/{form_id}/responses", summary="List responses (form owner only)")
async def list_responses(
    form_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    form = await db.get(Form, form_id)
    if not form or form.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    # Count total
    count_query = (
        select(func.count())
        .select_from(FormResponse)
        .where(FormResponse.form_id == form_id)
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Fetch page
    query = (
        select(FormResponse)
        .where(FormResponse.form_id == form_id)
        .order_by(FormResponse.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(query)
    responses = result.scalars().all()
    return {
        "total": total,
        "responses": [FormResponseOut.model_validate(r) for r in responses],
    }


@router.get("/{form_id}/export", summary="Export responses as CSV, XLSX, or JSON")
async def export_responses(
    form_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    format: str = Query("json", description="Export format: json, csv, or xlsx"),
) -> Any:
    # Load form with fields
    query = (
        select(Form)
        .where(Form.id == form_id)
        .options(selectinload(Form.fields))
    )
    result = await db.execute(query)
    form = result.scalar_one_or_none()
    if not form or form.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    resp_query = (
        select(FormResponse)
        .where(FormResponse.form_id == form_id)
        .order_by(FormResponse.created_at.asc())
    )
    resp_result = await db.execute(resp_query)
    responses = resp_result.scalars().all()

    # JSON format (original behavior)
    if format == "json":
        return [FormResponseOut.model_validate(r).model_dump() for r in responses]

    # CSV or XLSX
    from app.services.forms_export import export_form_responses  # noqa: PLC0415
    from fastapi.responses import Response as RawResponse  # noqa: PLC0415

    fields_data = [
        {"id": str(f.id), "label": f.label, "order": f.order}
        for f in form.fields
    ]
    responses_data = [
        {
            "answers": r.answers,
            "submitted_at": r.submitted_at.isoformat() if r.submitted_at else "",
        }
        for r in responses
    ]

    file_bytes, media_type, ext = export_form_responses(fields_data, responses_data, format)
    filename = f"{form.title.replace(' ', '_')}_responses.{ext}"

    return RawResponse(
        content=file_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
