"""Forms extensions — analytics, templates, versioning, webhooks, ERP integrations, AI generation."""
from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from datetime import date, datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.models.forms import (
    Form,
    FormAuditLog,
    FormCollaborator,
    FormField,
    FormFieldOption,
    FormResponse,
    FormTemplate,
    FormVersion,
    FormWebhook,
)

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class TemplateCreate(BaseModel):
    name: str
    schema_data: dict
    category: str | None = None


class SharePayload(BaseModel):
    user_id: uuid.UUID
    role: str = "viewer"


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


class WebhookCreate(BaseModel):
    url: str
    secret: str | None = None
    events: list[str] = ["submitted"]
    is_active: bool = True


class WebhookOut(BaseModel):
    id: uuid.UUID
    form_id: uuid.UUID
    url: str
    events: list
    is_active: bool
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class VersionOut(BaseModel):
    id: uuid.UUID
    form_id: uuid.UUID
    version_number: int
    schema_snapshot: dict
    published_at: Any
    created_by: uuid.UUID | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class AuditLogOut(BaseModel):
    id: uuid.UUID
    form_id: uuid.UUID
    user_id: uuid.UUID | None
    action: str
    details: dict | None
    ip_address: str | None
    created_at: Any

    model_config = {"from_attributes": True}


class AIFormGeneratePayload(BaseModel):
    description: str
    max_fields: int = 10
    include_erp_fields: bool = False


class CreateInvoiceFromResponsePayload(BaseModel):
    response_id: uuid.UUID
    invoice_type: str = "sales"
    due_days: int = 30


class CreateTicketFromResponsePayload(BaseModel):
    response_id: uuid.UUID
    priority: str = "medium"
    category: str | None = None


class CreateEventFromResponsePayload(BaseModel):
    response_id: uuid.UUID
    start_time: datetime
    end_time: datetime
    location: str | None = None


class CreateLeaveRequestPayload(BaseModel):
    response_id: uuid.UUID
    employee_id: uuid.UUID
    leave_type: str = "annual"
    start_date: date
    end_date: date


class CreatePOFromResponsePayload(BaseModel):
    response_id: uuid.UUID
    supplier_name: str
    items: list[dict] | None = None


class CreateTaskFromResponsePayload(BaseModel):
    response_id: uuid.UUID
    project_id: uuid.UUID
    title: str | None = None
    priority: str = "medium"
    assignee_id: uuid.UUID | None = None


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_owned_form(db: Any, form_id: uuid.UUID, user_id: uuid.UUID) -> Form:
    form = await db.get(Form, form_id)
    if not form or form.owner_id != user_id:
        raise HTTPException(status_code=404, detail="Form not found")
    return form


async def _get_response_for_form(db: Any, form_id: uuid.UUID, response_id: uuid.UUID) -> FormResponse:
    resp = await db.get(FormResponse, response_id)
    if not resp or resp.form_id != form_id:
        raise HTTPException(status_code=404, detail="Response not found for this form")
    return resp


def _build_answer_summary(form_fields: list[FormField], answers: dict) -> str:
    """Build a human-readable summary from form answers."""
    field_map = {str(f.id): f.label for f in form_fields}
    lines = []
    for fid, val in (answers or {}).items():
        label = field_map.get(fid, fid)
        display_val = ", ".join(val) if isinstance(val, list) else str(val)
        lines.append(f"- {label}: {display_val}")
    return "\n".join(lines)


async def _snapshot_form(db: Any, form: Form) -> dict:
    """Create a JSON snapshot of the form's current state."""
    result = await db.execute(
        select(Form)
        .where(Form.id == form.id)
        .options(selectinload(Form.fields).selectinload(FormField.field_options))
    )
    form = result.scalar_one()
    return {
        "title": form.title,
        "description": form.description,
        "settings": form.settings,
        "fields": [
            {
                "label": f.label,
                "field_type": f.field_type,
                "options": f.options,
                "is_required": f.is_required,
                "order": f.order,
                "page_number": f.page_number,
                "description": f.description,
                "placeholder": f.placeholder,
                "metadata": f.metadata,
                "validation_rules": f.validation_rules,
                "field_options": [
                    {"label": o.label, "value": o.value, "order": o.order,
                     "score": o.score, "is_correct": o.is_correct}
                    for o in (f.field_options or [])
                ],
            }
            for f in sorted(form.fields, key=lambda x: x.order)
        ],
    }


async def _fire_webhooks(db: Any, form_id: uuid.UUID, event: str, payload: dict) -> None:
    """Fire outbound webhooks for a form event (best-effort, non-blocking)."""
    result = await db.execute(
        select(FormWebhook).where(
            FormWebhook.form_id == form_id,
            FormWebhook.is_active == True,  # noqa: E712
        )
    )
    webhooks = result.scalars().all()
    for wh in webhooks:
        if event not in (wh.events or []):
            continue
        body = json.dumps({"event": event, "form_id": str(form_id), "data": payload})
        headers = {"Content-Type": "application/json"}
        if wh.secret:
            sig = hmac.new(wh.secret.encode(), body.encode(), hashlib.sha256).hexdigest()
            headers["X-Webhook-Signature"] = sig
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(wh.url, content=body, headers=headers)
        except Exception:
            pass  # Best-effort, log failures in production


# ══════════════════════════════════════════════════════════════════════════════
#  ANALYTICS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/forms/{form_id}/analytics", summary="Get response analytics for a form")
async def form_analytics(
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

    # Exclude sandbox responses from analytics
    count_result = await db.execute(
        select(func.count()).select_from(FormResponse).where(
            FormResponse.form_id == form_id,
            FormResponse.is_sandbox == False,  # noqa: E712
        )
    )
    total_responses = count_result.scalar() or 0

    if total_responses == 0:
        return {
            "form_id": str(form_id),
            "total_responses": 0,
            "field_analytics": [],
        }

    resp_result = await db.execute(
        select(FormResponse).where(
            FormResponse.form_id == form_id,
            FormResponse.is_sandbox == False,  # noqa: E712
        )
    )
    responses = resp_result.scalars().all()

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

        if field.field_type in ("number", "rating", "nps", "slider", "likert") and values:
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

        elif field.field_type in ("select", "radio", "checkbox", "dropdown", "ranking"):
            counts: dict[str, int] = {}
            for v in values:
                if isinstance(v, list):
                    for item in v:
                        counts[str(item)] = counts.get(str(item), 0) + 1
                else:
                    counts[str(v)] = counts.get(str(v), 0) + 1
            analytics["value_counts"] = counts

        elif field.field_type in ("text", "textarea", "email", "phone", "url"):
            analytics["unique_values"] = len(set(str(v) for v in values))

        elif field.field_type == "matrix" and values:
            row_counts: dict[str, dict[str, int]] = {}
            for v in values:
                if isinstance(v, dict):
                    for row, col in v.items():
                        if row not in row_counts:
                            row_counts[row] = {}
                        col_str = str(col)
                        row_counts[row][col_str] = row_counts[row].get(col_str, 0) + 1
            analytics["matrix_counts"] = row_counts

        elif field.field_type == "gps" and values:
            analytics["response_count"] = len(values)

        field_analytics.append(analytics)

    return {
        "form_id": str(form_id),
        "total_responses": total_responses,
        "field_analytics": field_analytics,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  UTILITIES
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/forms/{form_id}/duplicate", status_code=status.HTTP_201_CREATED, summary="Duplicate a form")
async def duplicate_form(
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

    for field in form.fields:
        new_field = FormField(
            form_id=new_form.id,
            label=field.label,
            field_type=field.field_type,
            options=list(field.options) if field.options else None,
            is_required=field.is_required,
            order=field.order,
            page_number=field.page_number,
            description=field.description,
            placeholder=field.placeholder,
            metadata=dict(field.metadata) if field.metadata else None,
            validation_rules=dict(field.validation_rules) if field.validation_rules else None,
        )
        db.add(new_field)
        await db.flush()

        for opt in (field.field_options or []):
            new_opt = FormFieldOption(
                field_id=new_field.id,
                label=opt.label,
                value=opt.value,
                order=opt.order,
                score=opt.score,
                is_correct=opt.is_correct,
            )
            db.add(new_opt)

    await db.commit()

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
    was_published = form.is_published
    form.is_published = not form.is_published
    await db.flush()

    # Auto-create version snapshot on publish
    if form.is_published and not was_published:
        count_result = await db.execute(
            select(func.count()).select_from(FormVersion).where(FormVersion.form_id == form_id)
        )
        version_number = (count_result.scalar() or 0) + 1

        snapshot = await _snapshot_form(db, form)
        version = FormVersion(
            form_id=form_id,
            version_number=version_number,
            schema_snapshot=snapshot,
            created_by=current_user.id,
        )
        db.add(version)

        # Audit log
        audit = FormAuditLog(
            form_id=form_id,
            user_id=current_user.id,
            action="published",
            details={"version_number": version_number},
        )
        db.add(audit)
    elif not form.is_published and was_published:
        audit = FormAuditLog(
            form_id=form_id,
            user_id=current_user.id,
            action="unpublished",
        )
        db.add(audit)

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


# ══════════════════════════════════════════════════════════════════════════════
#  TEMPLATES
# ══════════════════════════════════════════════════════════════════════════════

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

    new_form = Form(
        title=schema.get("title", template.name),
        description=schema.get("description"),
        is_published=False,
        settings=schema.get("settings", {}),
        owner_id=current_user.id,
    )
    db.add(new_form)
    await db.flush()

    fields_data = schema.get("fields", [])
    for idx, field_data in enumerate(fields_data):
        field = FormField(
            form_id=new_form.id,
            label=field_data.get("label", f"Field {idx + 1}"),
            field_type=field_data.get("field_type", "text"),
            options=field_data.get("options"),
            is_required=field_data.get("is_required", False),
            order=field_data.get("order", idx),
            page_number=field_data.get("page_number", 1),
            description=field_data.get("description"),
            placeholder=field_data.get("placeholder"),
            metadata=field_data.get("metadata"),
            validation_rules=field_data.get("validation_rules"),
        )
        db.add(field)

    await db.commit()

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
#  VERSION HISTORY
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/forms/{form_id}/versions", summary="List form version history")
async def list_versions(
    form_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_owned_form(db, form_id, current_user.id)

    result = await db.execute(
        select(FormVersion)
        .where(FormVersion.form_id == form_id)
        .order_by(FormVersion.version_number.desc())
    )
    versions = result.scalars().all()
    return {
        "total": len(versions),
        "versions": [VersionOut.model_validate(v).model_dump() for v in versions],
    }


@router.post("/forms/{form_id}/versions", status_code=status.HTTP_201_CREATED, summary="Create a version snapshot")
async def create_version(
    form_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    form = await _get_owned_form(db, form_id, current_user.id)

    count_result = await db.execute(
        select(func.count()).select_from(FormVersion).where(FormVersion.form_id == form_id)
    )
    version_number = (count_result.scalar() or 0) + 1

    snapshot = await _snapshot_form(db, form)
    version = FormVersion(
        form_id=form_id,
        version_number=version_number,
        schema_snapshot=snapshot,
        created_by=current_user.id,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)
    return VersionOut.model_validate(version).model_dump()


@router.post("/forms/{form_id}/restore/{version_id}", summary="Restore form from a version")
async def restore_version(
    form_id: uuid.UUID,
    version_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    form = await _get_owned_form(db, form_id, current_user.id)
    version = await db.get(FormVersion, version_id)
    if not version or version.form_id != form_id:
        raise HTTPException(status_code=404, detail="Version not found")

    snapshot = version.schema_snapshot
    form.title = snapshot.get("title", form.title)
    form.description = snapshot.get("description")
    form.settings = snapshot.get("settings", {})
    form.is_published = False  # Unpublish on restore for safety

    # Delete existing fields
    existing_result = await db.execute(
        select(FormField).where(FormField.form_id == form_id)
    )
    for f in existing_result.scalars().all():
        await db.delete(f)

    # Recreate fields from snapshot
    for idx, field_data in enumerate(snapshot.get("fields", [])):
        field = FormField(
            form_id=form_id,
            label=field_data.get("label", f"Field {idx + 1}"),
            field_type=field_data.get("field_type", "text"),
            options=field_data.get("options"),
            is_required=field_data.get("is_required", False),
            order=field_data.get("order", idx),
            page_number=field_data.get("page_number", 1),
            description=field_data.get("description"),
            placeholder=field_data.get("placeholder"),
            metadata=field_data.get("metadata"),
            validation_rules=field_data.get("validation_rules"),
        )
        db.add(field)
        await db.flush()

        for opt_data in field_data.get("field_options", []):
            opt = FormFieldOption(
                field_id=field.id,
                label=opt_data.get("label", ""),
                value=opt_data.get("value", ""),
                order=opt_data.get("order", 0),
                score=opt_data.get("score"),
                is_correct=opt_data.get("is_correct", False),
            )
            db.add(opt)

    # Audit log
    audit = FormAuditLog(
        form_id=form_id,
        user_id=current_user.id,
        action="restored",
        details={"from_version": version.version_number},
    )
    db.add(audit)

    await db.commit()
    return {
        "message": f"Form restored to version {version.version_number}",
        "form_id": str(form_id),
        "version_number": version.version_number,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  WEBHOOKS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/forms/{form_id}/webhooks", summary="List webhooks for a form")
async def list_webhooks(
    form_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_owned_form(db, form_id, current_user.id)

    result = await db.execute(
        select(FormWebhook).where(FormWebhook.form_id == form_id)
    )
    webhooks = result.scalars().all()
    return {
        "total": len(webhooks),
        "webhooks": [WebhookOut.model_validate(w).model_dump() for w in webhooks],
    }


@router.post("/forms/{form_id}/webhooks", status_code=status.HTTP_201_CREATED, summary="Create a webhook")
async def create_webhook(
    form_id: uuid.UUID,
    payload: WebhookCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    await _get_owned_form(db, form_id, current_user.id)

    wh = FormWebhook(
        form_id=form_id,
        url=payload.url,
        secret=payload.secret,
        events=payload.events,
        is_active=payload.is_active,
    )
    db.add(wh)
    await db.commit()
    await db.refresh(wh)
    return WebhookOut.model_validate(wh).model_dump()


@router.delete("/forms/{form_id}/webhooks/{webhook_id}", status_code=status.HTTP_200_OK, summary="Delete a webhook")
async def delete_webhook(
    form_id: uuid.UUID,
    webhook_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> None:
    await _get_owned_form(db, form_id, current_user.id)
    wh = await db.get(FormWebhook, webhook_id)
    if not wh or wh.form_id != form_id:
        raise HTTPException(status_code=404, detail="Webhook not found")
    await db.delete(wh)
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════════
#  AUDIT LOG
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/forms/{form_id}/audit-log", summary="Get form audit log")
async def get_audit_log(
    form_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    await _get_owned_form(db, form_id, current_user.id)

    result = await db.execute(
        select(FormAuditLog)
        .where(FormAuditLog.form_id == form_id)
        .order_by(FormAuditLog.created_at.desc())
        .limit(limit)
    )
    logs = result.scalars().all()
    return {
        "total": len(logs),
        "audit_logs": [AuditLogOut.model_validate(log).model_dump() for log in logs],
    }


# ══════════════════════════════════════════════════════════════════════════════
#  LOGIC RULES & THEME
# ══════════════════════════════════════════════════════════════════════════════

class LogicRulesPayload(BaseModel):
    logic_rules: list[dict]


class ThemePayload(BaseModel):
    theme: dict


@router.put("/forms/{form_id}/logic-rules", summary="Persist conditional logic rules")
async def update_logic_rules(
    form_id: uuid.UUID,
    payload: LogicRulesPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    form = await _get_owned_form(db, form_id, current_user.id)
    settings = dict(form.settings or {})
    settings["logic_rules"] = payload.logic_rules
    form.settings = settings
    await db.commit()
    return {"message": "Logic rules saved", "rule_count": len(payload.logic_rules)}


@router.put("/forms/{form_id}/theme", summary="Save form theme/branding")
async def update_theme(
    form_id: uuid.UUID,
    payload: ThemePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    form = await _get_owned_form(db, form_id, current_user.id)
    settings = dict(form.settings or {})
    settings["theme"] = payload.theme
    form.settings = settings
    await db.commit()
    return {"message": "Theme saved", "theme": payload.theme}


# ══════════════════════════════════════════════════════════════════════════════
#  AI FORM GENERATION (direct in builder)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/forms/ai-generate", status_code=status.HTTP_201_CREATED, summary="AI-generate a form from natural language")
async def ai_generate_form(
    payload: AIFormGeneratePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.services.ai import chat_with_ai  # noqa: PLC0415

    erp_hint = ""
    if payload.include_erp_fields:
        erp_hint = (
            "\n\nYou may use these ERP-native field types where appropriate: "
            "employee_picker, product_picker, customer_picker, gl_account_picker, warehouse_picker. "
            "Use them when the form needs to reference ERP data like employees, products, customers, "
            "GL accounts, or warehouse locations."
        )

    prompt = (
        f"Generate a JSON form schema for: {payload.description}\n\n"
        f"Requirements:\n"
        f"- Maximum {payload.max_fields} fields\n"
        f"- Return ONLY valid JSON, no markdown\n"
        f"- Use this structure: {{\"title\": \"...\", \"description\": \"...\", \"fields\": [...]}}\n"
        f"- Each field: {{\"label\": \"...\", \"field_type\": \"...\", \"is_required\": bool, "
        f"\"options\": [...] (for choice fields), \"description\": \"...\", \"placeholder\": \"...\", "
        f"\"metadata\": {{}} (for slider min/max, rating max, etc.)}}\n"
        f"- Available field types: text, textarea, number, email, phone, url, date, time, datetime, "
        f"select, checkbox, radio, dropdown, rating, likert, nps, slider, matrix, file, photo, "
        f"signature, gps, section_header, description, calculated, ranking, cascading_select"
        f"{erp_hint}"
    )

    try:
        ai_response = await chat_with_ai(prompt, model="default")
        # Extract JSON from response
        text = ai_response if isinstance(ai_response, str) else str(ai_response)
        # Try to find JSON in the response
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            form_schema = json.loads(text[start:end])
        else:
            raise ValueError("No JSON found in AI response")
    except Exception:
        # Fallback: generate a basic form
        form_schema = {
            "title": f"Form: {payload.description[:100]}",
            "description": payload.description,
            "fields": [
                {"label": "Name", "field_type": "text", "is_required": True, "placeholder": "Enter your name"},
                {"label": "Email", "field_type": "email", "is_required": True, "placeholder": "Enter your email"},
                {"label": "Details", "field_type": "textarea", "is_required": False, "placeholder": "Provide details"},
            ],
        }

    # Create form from AI-generated schema
    new_form = Form(
        title=form_schema.get("title", "AI Generated Form"),
        description=form_schema.get("description"),
        is_published=False,
        settings={},
        owner_id=current_user.id,
    )
    db.add(new_form)
    await db.flush()

    for idx, field_data in enumerate(form_schema.get("fields", [])[:payload.max_fields]):
        field = FormField(
            form_id=new_form.id,
            label=field_data.get("label", f"Field {idx + 1}"),
            field_type=field_data.get("field_type", "text"),
            options=field_data.get("options"),
            is_required=field_data.get("is_required", False),
            order=idx,
            page_number=field_data.get("page_number", 1),
            description=field_data.get("description"),
            placeholder=field_data.get("placeholder"),
            metadata=field_data.get("metadata"),
        )
        db.add(field)

    await db.commit()

    result = await db.execute(
        select(Form).where(Form.id == new_form.id).options(selectinload(Form.fields))
    )
    new_form = result.scalar_one()

    return {
        "id": str(new_form.id),
        "title": new_form.title,
        "description": new_form.description,
        "field_count": len(new_form.fields),
        "ai_generated": True,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  ERP INTEGRATIONS: Forms → Finance
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/forms/{form_id}/create-invoice-from-response",
    summary="Create a Finance invoice from a form response",
    status_code=status.HTTP_201_CREATED,
)
async def create_invoice_from_response(
    form_id: uuid.UUID,
    payload: CreateInvoiceFromResponsePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    form = await _get_owned_form(db, form_id, current_user.id)
    resp = await _get_response_for_form(db, form_id, payload.response_id)

    from app.models.finance import Invoice  # noqa: PLC0415

    # Load form fields for label mapping
    form_result = await db.execute(
        select(Form).where(Form.id == form_id).options(selectinload(Form.fields))
    )
    form_with_fields = form_result.scalar_one()
    summary = _build_answer_summary(form_with_fields.fields, resp.answers)

    today = date.today()
    from datetime import timedelta  # noqa: PLC0415
    due = today + timedelta(days=payload.due_days)

    # Generate unique invoice number
    count_result = await db.execute(select(func.count()).select_from(Invoice))
    count = (count_result.scalar() or 0) + 1
    invoice_number = f"FORM-INV-{count:06d}"

    invoice = Invoice(
        invoice_number=invoice_number,
        invoice_type=payload.invoice_type,
        issue_date=today,
        due_date=due,
        owner_id=current_user.id,
        notes=f"Auto-created from form: {form.title}\n\n{summary}",
    )
    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)

    from app.core.events import event_bus  # noqa: PLC0415
    await event_bus.publish("form.response.invoice_created", {
        "form_id": str(form_id),
        "response_id": str(resp.id),
        "invoice_id": str(invoice.id),
        "user_id": str(current_user.id),
    })

    return {
        "invoice_id": str(invoice.id),
        "invoice_number": invoice_number,
        "form_id": str(form_id),
        "response_id": str(resp.id),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  ERP INTEGRATIONS: Forms → Support
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/forms/{form_id}/create-ticket-from-response",
    summary="Create a Support ticket from a form response",
    status_code=status.HTTP_201_CREATED,
)
async def create_ticket_from_response(
    form_id: uuid.UUID,
    payload: CreateTicketFromResponsePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    form = await _get_owned_form(db, form_id, current_user.id)
    resp = await _get_response_for_form(db, form_id, payload.response_id)

    from app.models.support import Ticket  # noqa: PLC0415

    form_result = await db.execute(
        select(Form).where(Form.id == form_id).options(selectinload(Form.fields))
    )
    form_with_fields = form_result.scalar_one()
    summary = _build_answer_summary(form_with_fields.fields, resp.answers)

    # Generate ticket number
    count_result = await db.execute(select(func.count()).select_from(Ticket))
    count = (count_result.scalar() or 0) + 1
    ticket_number = f"FORM-TKT-{count:06d}"

    ticket = Ticket(
        ticket_number=ticket_number,
        subject=f"[Form] {form.title}",
        description=f"Auto-created from form submission\n\n{summary}",
        priority=payload.priority,
        category=payload.category,
        created_by=current_user.id,
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)

    from app.core.events import event_bus  # noqa: PLC0415
    await event_bus.publish("form.response.ticket_created", {
        "form_id": str(form_id),
        "response_id": str(resp.id),
        "ticket_id": str(ticket.id),
        "user_id": str(current_user.id),
    })

    return {
        "ticket_id": str(ticket.id),
        "ticket_number": ticket_number,
        "form_id": str(form_id),
        "response_id": str(resp.id),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  ERP INTEGRATIONS: Forms → Calendar
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/forms/{form_id}/create-event-from-response",
    summary="Create a Calendar event from a form response",
    status_code=status.HTTP_201_CREATED,
)
async def create_event_from_response(
    form_id: uuid.UUID,
    payload: CreateEventFromResponsePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    form = await _get_owned_form(db, form_id, current_user.id)
    resp = await _get_response_for_form(db, form_id, payload.response_id)

    from app.models.calendar import CalendarEvent  # noqa: PLC0415

    form_result = await db.execute(
        select(Form).where(Form.id == form_id).options(selectinload(Form.fields))
    )
    form_with_fields = form_result.scalar_one()
    summary = _build_answer_summary(form_with_fields.fields, resp.answers)

    event = CalendarEvent(
        title=f"[Form] {form.title}",
        description=f"Created from form response\n\n{summary}",
        start_time=payload.start_time,
        end_time=payload.end_time,
        location=payload.location,
        organizer_id=current_user.id,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    from app.core.events import event_bus  # noqa: PLC0415
    await event_bus.publish("form.response.event_created", {
        "form_id": str(form_id),
        "response_id": str(resp.id),
        "event_id": str(event.id),
        "user_id": str(current_user.id),
    })

    return {
        "event_id": str(event.id),
        "title": event.title,
        "form_id": str(form_id),
        "response_id": str(resp.id),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  ERP INTEGRATIONS: Forms → HR (Leave Request)
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/forms/{form_id}/create-leave-request",
    summary="Create an HR leave request from a form response",
    status_code=status.HTTP_201_CREATED,
)
async def create_leave_request(
    form_id: uuid.UUID,
    payload: CreateLeaveRequestPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    form = await _get_owned_form(db, form_id, current_user.id)
    resp = await _get_response_for_form(db, form_id, payload.response_id)

    from app.models.hr import LeaveRequest  # noqa: PLC0415

    # Calculate days
    days = (payload.end_date - payload.start_date).days + 1

    leave = LeaveRequest(
        employee_id=payload.employee_id,
        leave_type=payload.leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        days=days,
        reason=f"Auto-created from form: {form.title}",
    )
    db.add(leave)
    await db.commit()
    await db.refresh(leave)

    from app.core.events import event_bus  # noqa: PLC0415
    await event_bus.publish("form.response.leave_created", {
        "form_id": str(form_id),
        "response_id": str(resp.id),
        "leave_id": str(leave.id),
        "user_id": str(current_user.id),
    })

    return {
        "leave_id": str(leave.id),
        "leave_type": payload.leave_type,
        "form_id": str(form_id),
        "response_id": str(resp.id),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  ERP INTEGRATIONS: Forms → Supply Chain (Purchase Order)
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/forms/{form_id}/create-po-from-response",
    summary="Create a Supply Chain purchase order from a form response",
    status_code=status.HTTP_201_CREATED,
)
async def create_po_from_response(
    form_id: uuid.UUID,
    payload: CreatePOFromResponsePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    form = await _get_owned_form(db, form_id, current_user.id)
    resp = await _get_response_for_form(db, form_id, payload.response_id)

    from app.models.supplychain import PurchaseOrder  # noqa: PLC0415

    form_result = await db.execute(
        select(Form).where(Form.id == form_id).options(selectinload(Form.fields))
    )
    form_with_fields = form_result.scalar_one()
    summary = _build_answer_summary(form_with_fields.fields, resp.answers)

    count_result = await db.execute(select(func.count()).select_from(PurchaseOrder))
    count = (count_result.scalar() or 0) + 1
    po_number = f"FORM-PO-{count:06d}"

    po = PurchaseOrder(
        po_number=po_number,
        supplier_name=payload.supplier_name,
        order_date=date.today(),
        owner_id=current_user.id,
        notes=f"Auto-created from form: {form.title}\n\n{summary}",
    )
    db.add(po)
    await db.commit()
    await db.refresh(po)

    from app.core.events import event_bus  # noqa: PLC0415
    await event_bus.publish("form.response.po_created", {
        "form_id": str(form_id),
        "response_id": str(resp.id),
        "po_id": str(po.id),
        "user_id": str(current_user.id),
    })

    return {
        "po_id": str(po.id),
        "po_number": po_number,
        "form_id": str(form_id),
        "response_id": str(resp.id),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  Forms → Projects: create a task from a form response
# ══════════════════════════════════════════════════════════════════════════════

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
    form = await _get_owned_form(db, form_id, current_user.id)
    resp = await _get_response_for_form(db, form_id, payload.response_id)

    from app.models.projects import Project, Task  # noqa: PLC0415

    project = await db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    form_result = await db.execute(
        select(Form).where(Form.id == form_id).options(selectinload(Form.fields))
    )
    form_with_fields = form_result.scalar_one()

    description_lines = [f"Form: {form.title}", f"Response ID: {str(resp.id)}", ""]
    description_lines.append(_build_answer_summary(form_with_fields.fields, resp.answers))

    task_title = payload.title or f"[Form] {form.title} - Response #{str(resp.id)[:8]}"

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
