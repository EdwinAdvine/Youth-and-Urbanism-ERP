"""Forms API — CRUD for forms, fields, and responses with 30+ field types."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.models.forms import FIELD_TYPES, Form, FormField, FormFieldOption, FormResponse

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class FieldOptionCreate(BaseModel):
    label: str
    value: str
    order: int = 0
    parent_option_id: uuid.UUID | None = None
    score: float | None = None
    is_correct: bool = False


class FieldCreate(BaseModel):
    label: str
    field_type: str = "text"
    options: list | None = None
    is_required: bool = False
    order: int = 0
    page_number: int = 1
    description: str | None = None
    placeholder: str | None = None
    metadata: dict | None = None
    validation_rules: dict | None = None
    field_options: list[FieldOptionCreate] | None = None


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
    is_sandbox: bool = False


class FieldOptionOut(BaseModel):
    id: uuid.UUID
    field_id: uuid.UUID
    label: str
    value: str
    order: int
    parent_option_id: uuid.UUID | None
    score: float | None
    is_correct: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class FieldOut(BaseModel):
    id: uuid.UUID
    form_id: uuid.UUID
    label: str
    field_type: str
    options: list | None
    is_required: bool
    order: int
    page_number: int
    description: str | None
    placeholder: str | None
    metadata: dict | None
    validation_rules: dict | None
    field_options: list[FieldOptionOut] = []
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
    is_sandbox: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Layout-only field types (no answer expected) ──────────────────────────────
LAYOUT_FIELD_TYPES = {"section_header", "description", "page_break"}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", summary="List forms owned by the current user")
async def list_forms(
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    count_query = select(func.count()).select_from(Form).where(Form.owner_id == current_user.id)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

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

    if payload.fields:
        for idx, field_data in enumerate(payload.fields):
            field = FormField(
                form_id=form.id,
                label=field_data.label,
                field_type=field_data.field_type,
                options=field_data.options,
                is_required=field_data.is_required,
                order=field_data.order if field_data.order else idx,
                page_number=field_data.page_number,
                description=field_data.description,
                placeholder=field_data.placeholder,
                field_metadata=field_data.metadata,
                validation_rules=field_data.validation_rules,
            )
            db.add(field)
            await db.flush()

            # Create structured field options if provided
            if field_data.field_options:
                for opt in field_data.field_options:
                    option = FormFieldOption(
                        field_id=field.id,
                        label=opt.label,
                        value=opt.value,
                        order=opt.order,
                        parent_option_id=opt.parent_option_id,
                        score=opt.score,
                        is_correct=opt.is_correct,
                    )
                    db.add(option)

    await db.commit()

    query = (
        select(Form)
        .where(Form.id == form.id)
        .options(selectinload(Form.fields).selectinload(FormField.field_options))
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
        .options(selectinload(Form.fields).selectinload(FormField.field_options))
    )
    result = await db.execute(query)
    form = result.scalar_one_or_none()

    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

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


@router.delete("/{form_id}", status_code=status.HTTP_200_OK, summary="Delete a form")
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
    return Response(status_code=status.HTTP_200_OK)


@router.post("/{form_id}/fields", summary="Bulk update fields (replace all)")
async def bulk_update_fields(
    form_id: uuid.UUID,
    payload: BulkFieldsUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    query = (
        select(Form)
        .where(Form.id == form_id)
        .options(selectinload(Form.fields).selectinload(FormField.field_options))
    )
    result = await db.execute(query)
    form = result.scalar_one_or_none()

    if not form or form.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    # Delete existing fields (cascades to field_options)
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
            page_number=field_data.page_number,
            description=field_data.description,
            placeholder=field_data.placeholder,
            metadata=field_data.metadata,
            validation_rules=field_data.validation_rules,
        )
        db.add(field)
        await db.flush()

        if field_data.field_options:
            for opt in field_data.field_options:
                option = FormFieldOption(
                    field_id=field.id,
                    label=opt.label,
                    value=opt.value,
                    order=opt.order,
                    parent_option_id=opt.parent_option_id,
                    score=opt.score,
                    is_correct=opt.is_correct,
                )
                db.add(option)

    await db.commit()

    result = await db.execute(
        select(Form)
        .where(Form.id == form.id)
        .options(selectinload(Form.fields).selectinload(FormField.field_options))
    )
    form = result.scalar_one()
    return FormDetailOut.model_validate(form).model_dump()


def _validate_field_value(field: FormField, value: Any) -> str | None:
    """Validate a single field value. Returns error message or None."""
    ft = field.field_type

    # Layout fields — no answer expected
    if ft in LAYOUT_FIELD_TYPES:
        return None

    # Required check
    if field.is_required and (value is None or value == "" or value == []):
        return f"Field '{field.label}' is required"

    if value is None or value == "":
        return None

    # Type-specific validation
    if ft == "number":
        try:
            float(value)
        except (ValueError, TypeError):
            return f"Field '{field.label}' must be a number"

    elif ft == "email":
        if not isinstance(value, str) or "@" not in value:
            return f"Field '{field.label}' must be a valid email"

    elif ft == "phone":
        if not isinstance(value, str) or len(value) < 7:
            return f"Field '{field.label}' must be a valid phone number"

    elif ft == "url":
        if not isinstance(value, str) or not (value.startswith("http://") or value.startswith("https://")):
            return f"Field '{field.label}' must be a valid URL"

    elif ft in ("select", "radio", "dropdown"):
        valid_options = field.options or []
        if value not in valid_options:
            return f"Field '{field.label}' must be one of: {', '.join(str(o) for o in valid_options)}"

    elif ft == "checkbox":
        if not isinstance(value, list):
            return f"Field '{field.label}' must be a list of selected options"
        elif field.options:
            invalid = [v for v in value if v not in field.options]
            if invalid:
                return f"Field '{field.label}' contains invalid options: {invalid}"

    elif ft == "ranking":
        if not isinstance(value, list):
            return f"Field '{field.label}' must be an ordered list"

    elif ft in ("rating", "nps", "slider", "likert"):
        try:
            val = float(value) if not isinstance(value, (int, float)) else value
            meta = field.field_metadata or {}
            min_val = meta.get("min", 0)
            max_val = meta.get("max", 10 if ft == "nps" else 5)
            if val < min_val or val > max_val:
                return f"Field '{field.label}' must be between {min_val} and {max_val}"
        except (ValueError, TypeError):
            return f"Field '{field.label}' must be a number"

    elif ft == "date":
        if isinstance(value, str):
            try:
                datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                return f"Field '{field.label}' must be a valid date"

    elif ft == "gps":
        if isinstance(value, dict):
            if "lat" not in value or "lng" not in value:
                return f"Field '{field.label}' must include lat and lng"
        elif not isinstance(value, str):
            return f"Field '{field.label}' must be a GPS coordinate"

    elif ft == "matrix":
        if not isinstance(value, dict):
            return f"Field '{field.label}' must be a matrix of row→column selections"

    elif ft == "calculated":
        pass  # Calculated fields are computed, not validated

    elif ft in ("employee_picker", "product_picker", "customer_picker",
                "gl_account_picker", "warehouse_picker"):
        if not isinstance(value, (str, dict)):
            return f"Field '{field.label}' must be a valid ERP reference"

    return None


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
    query = (
        select(Form)
        .where(Form.id == form_id)
        .options(selectinload(Form.fields))
    )
    result = await db.execute(query)
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    # Sandbox submissions bypass publish check
    if not payload.is_sandbox and not form.is_published:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Form is not published and cannot accept responses",
        )

    # Enforce close_date
    form_settings = form.settings or {}
    close_date_str = form_settings.get("close_date")
    if close_date_str and not payload.is_sandbox:
        try:
            close_date = datetime.fromisoformat(str(close_date_str).replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > close_date:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This form is closed and no longer accepting responses",
                )
        except (ValueError, TypeError):
            pass

    # Enforce max_responses
    max_responses = form_settings.get("max_responses")
    if max_responses and not payload.is_sandbox:
        count_result = await db.execute(
            select(func.count()).select_from(FormResponse).where(
                FormResponse.form_id == form_id,
                FormResponse.is_sandbox == False,  # noqa: E712
            )
        )
        current_count = count_result.scalar() or 0
        if current_count >= max_responses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This form has reached its maximum number of responses",
            )

    # Server-side field validation
    errors: list[str] = []
    for field in form.fields:
        fid = str(field.id)
        value = payload.answers.get(fid)
        error = _validate_field_value(field, value)
        if error:
            errors.append(error)

    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"validation_errors": errors},
        )

    # Determine respondent
    respondent_id = None if form_settings.get("allow_anonymous") else current_user.id

    response = FormResponse(
        form_id=form.id,
        respondent_id=respondent_id,
        answers=payload.answers,
        is_sandbox=payload.is_sandbox,
    )
    db.add(response)
    await db.commit()
    await db.refresh(response)

    # Publish event for cross-module integrations (skip for sandbox)
    if not payload.is_sandbox:
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
    include_sandbox: bool = Query(False, description="Include sandbox/preview responses"),
) -> dict[str, Any]:
    form = await db.get(Form, form_id)
    if not form or form.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    base_filter = [FormResponse.form_id == form_id]
    if not include_sandbox:
        base_filter.append(FormResponse.is_sandbox == False)  # noqa: E712

    count_query = (
        select(func.count())
        .select_from(FormResponse)
        .where(*base_filter)
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        select(FormResponse)
        .where(*base_filter)
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
    query = (
        select(Form)
        .where(Form.id == form_id)
        .options(selectinload(Form.fields))
    )
    result = await db.execute(query)
    form = result.scalar_one_or_none()
    if not form or form.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    # Exclude sandbox responses from exports
    resp_query = (
        select(FormResponse)
        .where(
            FormResponse.form_id == form_id,
            FormResponse.is_sandbox == False,  # noqa: E712
        )
        .order_by(FormResponse.created_at.asc())
    )
    resp_result = await db.execute(resp_query)
    responses = resp_result.scalars().all()

    if format == "json":
        return [FormResponseOut.model_validate(r).model_dump() for r in responses]

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
