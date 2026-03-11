"""Forms extensions — analytics, utilities, templates."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.models.forms import Form, FormCollaborator, FormField, FormResponse, FormTemplate

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class TemplateCreate(BaseModel):
    name: str
    schema_data: dict  # renamed to avoid clash with pydantic's .schema
    category: str | None = None


class SharePayload(BaseModel):
    user_id: uuid.UUID
    role: str = "viewer"  # editor | viewer


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    schema: dict
    category: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class CollaboratorOut(BaseModel):
    id: uuid.UUID
    form_id: uuid.UUID
    user_id: uuid.UUID
    role: str
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_owned_form(db: Any, form_id: uuid.UUID, user_id: uuid.UUID) -> Form:
    form = await db.get(Form, form_id)
    if not form or form.owner_id != user_id:
        raise HTTPException(status_code=404, detail="Form not found")
    return form


# ── Analytics ────────────────────────────────────────────────────────────────

@router.get("/forms/{form_id}/analytics", summary="Get response analytics for a form")
async def form_analytics(
    form_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Load form with fields
    query = (
        select(Form)
        .where(Form.id == form_id)
        .options(selectinload(Form.fields))
    )
    result = await db.execute(query)
    form = result.scalar_one_or_none()
    if not form or form.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Form not found")

    # Count responses
    count_result = await db.execute(
        select(func.count()).select_from(FormResponse).where(FormResponse.form_id == form_id)
    )
    total_responses = count_result.scalar() or 0

    if total_responses == 0:
        return {
            "form_id": str(form_id),
            "total_responses": 0,
            "field_analytics": [],
        }

    # Fetch all responses
    resp_result = await db.execute(
        select(FormResponse).where(FormResponse.form_id == form_id)
    )
    responses = resp_result.scalars().all()

    # Analyse each field
    field_analytics: list[dict[str, Any]] = []
    for field in sorted(form.fields, key=lambda f: f.order):
        fid = str(field.id)
        values = [r.answers.get(fid) for r in responses if r.answers.get(fid) is not None]
        answered = len(values)

        analytics: dict[str, Any] = {
            "field_id": fid,
            "label": field.label,
            "field_type": field.field_type,
            "answered": answered,
            "skipped": total_responses - answered,
        }

        if field.field_type == "number" and values:
            numeric = []
            for v in values:
                try:
                    numeric.append(float(v))
                except (ValueError, TypeError):
                    pass
            if numeric:
                analytics["min"] = min(numeric)
                analytics["max"] = max(numeric)
                analytics["avg"] = round(sum(numeric) / len(numeric), 2)
                analytics["sum"] = sum(numeric)

        elif field.field_type in ("select", "radio", "checkbox"):
            counts: dict[str, int] = {}
            for v in values:
                if isinstance(v, list):
                    for item in v:
                        counts[str(item)] = counts.get(str(item), 0) + 1
                else:
                    counts[str(v)] = counts.get(str(v), 0) + 1
            analytics["value_counts"] = counts

        elif field.field_type in ("text", "textarea", "email"):
            analytics["unique_values"] = len(set(str(v) for v in values))

        field_analytics.append(analytics)

    return {
        "form_id": str(form_id),
        "total_responses": total_responses,
        "field_analytics": field_analytics,
    }


# ── Utilities ────────────────────────────────────────────────────────────────

@router.post("/forms/{form_id}/duplicate", status_code=status.HTTP_201_CREATED, summary="Duplicate a form")
async def duplicate_form(
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
    if not form or form.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Form not found")

    new_form = Form(
        title=f"Copy of {form.title}",
        description=form.description,
        is_published=False,
        settings=dict(form.settings) if form.settings else {},
        owner_id=current_user.id,
    )
    db.add(new_form)
    await db.flush()

    # Duplicate fields
    for field in form.fields:
        new_field = FormField(
            form_id=new_form.id,
            label=field.label,
            field_type=field.field_type,
            options=list(field.options) if field.options else None,
            is_required=field.is_required,
            order=field.order,
            validation_rules=dict(field.validation_rules) if field.validation_rules else None,
        )
        db.add(new_field)

    await db.commit()

    # Re-fetch with fields
    result = await db.execute(
        select(Form).where(Form.id == new_form.id).options(selectinload(Form.fields))
    )
    new_form = result.scalar_one()

    return {
        "id": str(new_form.id),
        "title": new_form.title,
        "duplicated_from": str(form_id),
        "field_count": len(new_form.fields),
    }


@router.put("/forms/{form_id}/publish", summary="Toggle form publish status")
async def toggle_publish(
    form_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    form = await _get_owned_form(db, form_id, current_user.id)
    form.is_published = not form.is_published
    await db.commit()
    await db.refresh(form)
    return {
        "id": str(form.id),
        "title": form.title,
        "is_published": form.is_published,
    }


@router.post("/forms/{form_id}/share", status_code=status.HTTP_201_CREATED, summary="Share a form with a collaborator")
async def share_form(
    form_id: uuid.UUID,
    payload: SharePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    form = await _get_owned_form(db, form_id, current_user.id)

    # Check for existing collaborator
    existing = await db.execute(
        select(FormCollaborator).where(
            FormCollaborator.form_id == form_id,
            FormCollaborator.user_id == payload.user_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User is already a collaborator")

    collab = FormCollaborator(
        form_id=form_id,
        user_id=payload.user_id,
        role=payload.role,
    )
    db.add(collab)
    await db.commit()
    await db.refresh(collab)
    return CollaboratorOut.model_validate(collab).model_dump()


# ── Templates ────────────────────────────────────────────────────────────────

@router.get("/templates", summary="List form templates")
async def list_templates(
    current_user: CurrentUser,
    db: DBSession,
    category: str | None = Query(None, description="Filter by category"),
) -> dict[str, Any]:
    query = select(FormTemplate).order_by(FormTemplate.name)
    if category:
        query = query.where(FormTemplate.category == category)
    result = await db.execute(query)
    templates = result.scalars().all()
    return {
        "total": len(templates),
        "templates": [TemplateOut.model_validate(t).model_dump() for t in templates],
    }


@router.post("/from-template/{template_id}", status_code=status.HTTP_201_CREATED, summary="Create a form from a template")
async def create_from_template(
    template_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    template = await db.get(FormTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    schema = template.schema or {}

    # Create form from template schema
    new_form = Form(
        title=schema.get("title", template.name),
        description=schema.get("description"),
        is_published=False,
        settings=schema.get("settings", {}),
        owner_id=current_user.id,
    )
    db.add(new_form)
    await db.flush()

    # Create fields from schema
    fields_data = schema.get("fields", [])
    for idx, field_data in enumerate(fields_data):
        field = FormField(
            form_id=new_form.id,
            label=field_data.get("label", f"Field {idx + 1}"),
            field_type=field_data.get("field_type", "text"),
            options=field_data.get("options"),
            is_required=field_data.get("is_required", False),
            order=field_data.get("order", idx),
            validation_rules=field_data.get("validation_rules"),
        )
        db.add(field)

    await db.commit()

    # Re-fetch with fields
    result = await db.execute(
        select(Form).where(Form.id == new_form.id).options(selectinload(Form.fields))
    )
    new_form = result.scalar_one()

    return {
        "id": str(new_form.id),
        "title": new_form.title,
        "from_template": str(template_id),
        "field_count": len(new_form.fields),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  9. Forms → Projects: create a task from a form response
# ══════════════════════════════════════════════════════════════════════════════

class CreateTaskFromResponsePayload(BaseModel):
    response_id: uuid.UUID
    project_id: uuid.UUID
    title: str | None = None
    priority: str = "medium"
    assignee_id: uuid.UUID | None = None


@router.post(
    "/forms/{form_id}/create-task-from-response",
    summary="Create a project task from a form response",
    status_code=status.HTTP_201_CREATED,
)
async def create_task_from_response(
    form_id: uuid.UUID,
    payload: CreateTaskFromResponsePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Create a project task from a form response, including answer summary in description."""
    form = await _get_owned_form(db, form_id, current_user.id)

    # Verify the response belongs to this form
    resp = await db.get(FormResponse, payload.response_id)
    if not resp or resp.form_id != form_id:
        raise HTTPException(status_code=404, detail="Response not found for this form")

    from app.models.projects import Project, Task  # noqa: PLC0415

    # Verify the project exists
    project = await db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Build a description from the response answers
    # Load fields for label mapping
    from sqlalchemy.orm import selectinload  # noqa: PLC0415 — re-import at function scope
    form_result = await db.execute(
        select(Form).where(Form.id == form_id).options(selectinload(Form.fields))
    )
    form_with_fields = form_result.scalar_one()
    field_map = {str(f.id): f.label for f in form_with_fields.fields}

    description_lines = [f"Form: {form.title}", f"Response ID: {str(resp.id)}", ""]
    for fid, val in (resp.answers or {}).items():
        label = field_map.get(fid, fid)
        display_val = ", ".join(val) if isinstance(val, list) else str(val)
        description_lines.append(f"- {label}: {display_val}")

    task_title = payload.title or f"[Form] {form.title} - Response #{str(resp.id)[:8]}"

    # Calculate next order value
    count_result = await db.execute(
        select(func.count()).select_from(Task).where(Task.project_id == payload.project_id)
    )
    order = (count_result.scalar() or 0)

    task = Task(
        project_id=payload.project_id,
        title=task_title,
        description="\n".join(description_lines),
        status="todo",
        priority=payload.priority,
        assignee_id=payload.assignee_id,
        order=order,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    from app.core.events import event_bus  # noqa: PLC0415
    await event_bus.publish("form.response.task_created", {
        "form_id": str(form_id),
        "response_id": str(resp.id),
        "task_id": str(task.id),
        "project_id": str(payload.project_id),
        "user_id": str(current_user.id),
    })

    return {
        "task_id": str(task.id),
        "title": task.title,
        "project_id": str(payload.project_id),
        "form_id": str(form_id),
        "response_id": str(resp.id),
    }
