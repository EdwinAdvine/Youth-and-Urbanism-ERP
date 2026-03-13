"""Forms extensions — analytics, templates, versioning, webhooks, ERP integrations, AI generation."""

import hashlib
import hmac
import json
import uuid
from datetime import date, datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.models.forms import (
    Form,
    FormApprovalWorkflow,
    FormAuditLog,
    FormAutomation,
    FormCollaborator,
    FormConsent,
    FormConsentRecord,
    FormField,
    FormFieldOption,
    FormQuizResult,
    FormResponse,
    FormResponseApproval,
    FormResponseDraft,
    FormSchedule,
    FormTemplate,
    FormTranslation,
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


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 2 & PHASE 3 — ADDITIONAL SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class ResponseDraftPayload(BaseModel):
    answers: dict
    device_id: str | None = None
    offline_created_at: datetime | None = None


class BulkSyncPayload(BaseModel):
    drafts: list[ResponseDraftPayload]


class QuizGradePayload(BaseModel):
    response_id: uuid.UUID
    override_score: float | None = None


class ScheduleCreate(BaseModel):
    recurrence_rule: str | None = None
    recipients: list[str] = []
    distribution_channel: str = "email"
    is_active: bool = True


class ApprovalWorkflowCreate(BaseModel):
    steps: list[dict]  # [{label, approver_id?, role?}]


class ApproveResponsePayload(BaseModel):
    status: str  # "approved" | "rejected"
    comments: str | None = None


class TranslationCreate(BaseModel):
    locale: str
    translations: dict


class ConsentCreate(BaseModel):
    consent_text: str = "I agree to the data processing terms."
    is_required: bool = True
    data_retention_days: int | None = None
    privacy_policy_url: str | None = None


class ConsentRecordCreate(BaseModel):
    response_id: uuid.UUID | None = None
    ip_address: str | None = None
    user_agent: str | None = None


class AutomationCreate(BaseModel):
    name: str
    trigger: str
    trigger_conditions: dict | None = None
    actions: list[dict] = []
    is_active: bool = True


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION A: OFFLINE SYNC (PHASE 2)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/{form_id}/responses/draft", status_code=status.HTTP_201_CREATED)
async def save_draft(form_id: uuid.UUID, payload: ResponseDraftPayload, user: CurrentUser, db: DBSession):
    """Save an offline draft response (not yet submitted)."""
    form = await db.get(Form, form_id)
    if not form:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Form not found")
    draft = FormResponseDraft(
        form_id=form_id,
        user_id=user.id,
        device_id=payload.device_id,
        draft_data=payload.answers,
        offline_created_at=payload.offline_created_at or datetime.now(timezone.utc),
    )
    db.add(draft)
    await db.commit()
    await db.refresh(draft)
    return {"id": str(draft.id), "synced": False}


@router.post("/{form_id}/responses/bulk-sync")
async def bulk_sync_drafts(form_id: uuid.UUID, payload: BulkSyncPayload, user: CurrentUser, db: DBSession):
    """Bulk sync offline drafts — convert each to a real FormResponse."""
    form = await db.get(Form, form_id)
    if not form:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Form not found")
    results = []
    for d in payload.drafts:
        resp = FormResponse(
            form_id=form_id,
            respondent_id=user.id,
            answers=d.answers,
            is_sandbox=False,
        )
        db.add(resp)
        await db.flush()
        results.append({"response_id": str(resp.id), "synced": True})
    await db.commit()
    return {"synced_count": len(results), "results": results}


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION B: QUIZ (PHASE 2)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{form_id}/quiz-results")
async def get_quiz_results(form_id: uuid.UUID, user: CurrentUser, db: DBSession):
    """List all quiz results for a form."""
    stmt = select(FormQuizResult).where(FormQuizResult.form_id == form_id).order_by(FormQuizResult.created_at.desc())
    rows = (await db.execute(stmt)).scalars().all()
    return {
        "total": len(rows),
        "results": [
            {
                "id": str(r.id),
                "form_id": str(r.form_id),
                "response_id": str(r.response_id),
                "score": r.score,
                "max_score": r.max_score,
                "percentage": r.percentage,
                "pass_fail": r.pass_fail,
                "graded_at": r.graded_at,
                "ai_feedback": r.ai_feedback,
            }
            for r in rows
        ],
    }


@router.post("/{form_id}/quiz-results/grade", status_code=status.HTTP_201_CREATED)
async def grade_quiz_response(form_id: uuid.UUID, payload: QuizGradePayload, user: CurrentUser, db: DBSession):
    """Grade a quiz response. Computes score from FormFieldOption.is_correct marks."""
    resp = await db.get(FormResponse, payload.response_id)
    if not resp or resp.form_id != form_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Response not found")

    # Get all fields and their correct options
    fields_stmt = select(FormField).where(FormField.form_id == form_id).options(selectinload(FormField.field_options))
    fields = (await db.execute(fields_stmt)).scalars().all()

    total_score = 0.0
    max_score = 0.0
    for field in fields:
        correct_opts = [o for o in field.field_options if o.is_correct]
        if not correct_opts:
            continue
        max_pts = max((o.score or 1.0) for o in correct_opts)
        max_score += max_pts
        ans = resp.answers.get(str(field.id))
        if ans:
            ans_list = ans if isinstance(ans, list) else [ans]
            for opt in field.field_options:
                if opt.is_correct and (opt.value in ans_list or opt.label in ans_list):
                    total_score += opt.score or 1.0

    if payload.override_score is not None:
        total_score = payload.override_score

    percentage = (total_score / max_score * 100) if max_score > 0 else 0.0
    pass_threshold = 60.0
    pass_fail = "pass" if percentage >= pass_threshold else "fail"

    result = FormQuizResult(
        form_id=form_id,
        response_id=payload.response_id,
        score=total_score,
        max_score=max_score,
        percentage=percentage,
        pass_fail=pass_fail,
        graded_at=datetime.now(timezone.utc),
        graded_by=user.id,
    )
    db.add(result)
    await db.commit()
    await db.refresh(result)
    return {"id": str(result.id), "score": total_score, "max_score": max_score, "percentage": percentage, "pass_fail": pass_fail}


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION C: SCHEDULE (PHASE 2)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/{form_id}/schedule", status_code=status.HTTP_201_CREATED)
async def create_schedule(form_id: uuid.UUID, payload: ScheduleCreate, user: CurrentUser, db: DBSession):
    form = await db.get(Form, form_id)
    if not form:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Form not found")
    sched = FormSchedule(
        form_id=form_id,
        recurrence_rule=payload.recurrence_rule,
        recipients=payload.recipients,
        distribution_channel=payload.distribution_channel,
        is_active=payload.is_active,
    )
    db.add(sched)
    await db.commit()
    await db.refresh(sched)
    return {"id": str(sched.id), "form_id": str(sched.form_id), "recurrence_rule": sched.recurrence_rule, "is_active": sched.is_active}


@router.get("/{form_id}/schedule")
async def get_schedule(form_id: uuid.UUID, user: CurrentUser, db: DBSession):
    stmt = select(FormSchedule).where(FormSchedule.form_id == form_id)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if not row:
        return None
    return {"id": str(row.id), "recurrence_rule": row.recurrence_rule, "recipients": row.recipients, "distribution_channel": row.distribution_channel, "is_active": row.is_active, "next_run_at": row.next_run_at, "last_run_at": row.last_run_at}


@router.delete("/{form_id}/schedule", status_code=status.HTTP_200_OK)
async def delete_schedule(form_id: uuid.UUID, user: CurrentUser, db: DBSession):
    stmt = select(FormSchedule).where(FormSchedule.form_id == form_id)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.commit()
    return {"deleted": True}


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION D: AI ANALYZE RESPONSES (PHASE 2)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/{form_id}/ai-analyze-responses")
async def ai_analyze_responses(form_id: uuid.UUID, user: CurrentUser, db: DBSession):
    """Use Ollama to generate an AI summary of all form responses."""
    from app.services.ai import chat_with_ai
    stmt = select(FormResponse).where(FormResponse.form_id == form_id, FormResponse.is_sandbox == False).order_by(FormResponse.submitted_at.desc()).limit(100)  # noqa: E712
    responses = (await db.execute(stmt)).scalars().all()
    if not responses:
        return {"summary": "No responses to analyze yet.", "response_count": 0}

    sample = [r.answers for r in responses[:20]]
    prompt = f"Analyze these {len(responses)} form responses and provide:\n1. Key themes and patterns\n2. Most common answers\n3. Notable outliers or concerns\n4. Actionable recommendations\n\nSample data: {json.dumps(sample, default=str)[:3000]}"

    try:
        result = await chat_with_ai(prompt, model="ollama")
        return {"summary": result, "response_count": len(responses), "sample_size": min(20, len(responses))}
    except Exception:
        return {"summary": "AI analysis temporarily unavailable.", "response_count": len(responses)}


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION E: CROSS-TAB & FUNNEL ANALYTICS (PHASE 2)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{form_id}/analytics/cross-tab")
async def cross_tab_analytics(
    form_id: uuid.UUID,
    row_field_id: str = Query(...),
    col_field_id: str = Query(...),
    user: CurrentUser = None,
    db: DBSession = None,
):
    """Cross-tabulation of two fields."""
    stmt = select(FormResponse).where(FormResponse.form_id == form_id, FormResponse.is_sandbox == False)  # noqa: E712
    responses = (await db.execute(stmt)).scalars().all()

    table: dict = {}
    for resp in responses:
        row_val = str(resp.answers.get(row_field_id, "N/A"))
        col_val = str(resp.answers.get(col_field_id, "N/A"))
        if row_val not in table:
            table[row_val] = {}
        table[row_val][col_val] = table[row_val].get(col_val, 0) + 1

    return {"row_field_id": row_field_id, "col_field_id": col_field_id, "table": table, "total_responses": len(responses)}


@router.get("/{form_id}/analytics/funnel")
async def funnel_analytics(form_id: uuid.UUID, user: CurrentUser, db: DBSession):
    """Page-by-page drop-off funnel analysis."""
    fields_stmt = select(FormField).where(FormField.form_id == form_id).order_by(FormField.page_number, FormField.order)
    fields = (await db.execute(fields_stmt)).scalars().all()
    if not fields:
        return {"pages": []}

    pages = sorted(set(f.page_number for f in fields))
    total_stmt = select(func.count()).select_from(FormResponse).where(FormResponse.form_id == form_id, FormResponse.is_sandbox == False)  # noqa: E712
    total = (await db.execute(total_stmt)).scalar_one()

    page_fields: dict = {}
    for f in fields:
        page_fields.setdefault(f.page_number, []).append(str(f.id))

    responses_stmt = select(FormResponse).where(FormResponse.form_id == form_id, FormResponse.is_sandbox == False)  # noqa: E712
    responses = (await db.execute(responses_stmt)).scalars().all()

    funnel = []
    for pg in pages:
        answered = sum(
            1 for r in responses
            if any(str(fid) in r.answers for fid in page_fields.get(pg, []))
        )
        funnel.append({"page": pg, "responses": answered, "drop_off": total - answered if pg > 1 else 0})

    return {"total_started": total, "pages": funnel}


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION F: PHASE 3 — APPROVAL WORKFLOW
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/{form_id}/approval-workflow", status_code=status.HTTP_201_CREATED)
async def create_approval_workflow(form_id: uuid.UUID, payload: ApprovalWorkflowCreate, user: CurrentUser, db: DBSession):
    form = await db.get(Form, form_id)
    if not form:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Form not found")
    wf = FormApprovalWorkflow(form_id=form_id, steps=payload.steps, is_active=True)
    db.add(wf)
    await db.commit()
    await db.refresh(wf)
    return {"id": str(wf.id), "form_id": str(wf.form_id), "steps": wf.steps, "is_active": wf.is_active}


@router.get("/{form_id}/approval-workflow")
async def get_approval_workflow(form_id: uuid.UUID, user: CurrentUser, db: DBSession):
    stmt = select(FormApprovalWorkflow).where(FormApprovalWorkflow.form_id == form_id)
    wf = (await db.execute(stmt)).scalar_one_or_none()
    if not wf:
        return None
    return {"id": str(wf.id), "steps": wf.steps, "current_step": wf.current_step, "is_active": wf.is_active}


@router.post("/responses/{response_id}/approve")
async def approve_response(response_id: uuid.UUID, payload: ApproveResponsePayload, user: CurrentUser, db: DBSession):
    resp = await db.get(FormResponse, response_id)
    if not resp:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Response not found")
    approval = FormResponseApproval(
        response_id=response_id,
        approver_id=user.id,
        status=payload.status,
        comments=payload.comments,
        decided_at=datetime.now(timezone.utc),
    )
    db.add(approval)
    await db.commit()
    return {"response_id": str(response_id), "status": payload.status, "approver_id": str(user.id)}


@router.get("/{form_id}/approval-queue")
async def get_approval_queue(form_id: uuid.UUID, user: CurrentUser, db: DBSession):
    stmt = (
        select(FormResponse)
        .where(FormResponse.form_id == form_id, FormResponse.is_sandbox == False)  # noqa: E712
        .options(selectinload(FormResponse.form))
        .order_by(FormResponse.submitted_at.desc())
        .limit(50)
    )
    responses = (await db.execute(stmt)).scalars().all()
    result = []
    for r in responses:
        approval_stmt = select(FormResponseApproval).where(FormResponseApproval.response_id == r.id).order_by(FormResponseApproval.created_at.desc())
        approvals = (await db.execute(approval_stmt)).scalars().all()
        latest_status = approvals[0].status if approvals else "pending"
        result.append({"response_id": str(r.id), "submitted_at": r.submitted_at, "status": latest_status})
    return {"total": len(result), "responses": result}


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION G: PHASE 3 — TRANSLATIONS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{form_id}/translations")
async def get_translations(form_id: uuid.UUID, user: CurrentUser, db: DBSession):
    stmt = select(FormTranslation).where(FormTranslation.form_id == form_id)
    rows = (await db.execute(stmt)).scalars().all()
    return {"translations": [{"id": str(r.id), "locale": r.locale, "translations": r.translations, "is_ai_generated": r.is_ai_generated} for r in rows]}


@router.post("/{form_id}/translations", status_code=status.HTTP_201_CREATED)
async def create_translation(form_id: uuid.UUID, payload: TranslationCreate, user: CurrentUser, db: DBSession):
    form = await db.get(Form, form_id)
    if not form:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Form not found")
    existing = (await db.execute(select(FormTranslation).where(FormTranslation.form_id == form_id, FormTranslation.locale == payload.locale))).scalar_one_or_none()
    if existing:
        existing.translations = payload.translations
        await db.commit()
        return {"id": str(existing.id), "locale": existing.locale, "updated": True}
    t = FormTranslation(form_id=form_id, locale=payload.locale, translations=payload.translations)
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return {"id": str(t.id), "locale": t.locale, "created": True}


@router.post("/{form_id}/translations/ai-generate")
async def ai_generate_translations(form_id: uuid.UUID, locale: str = Query(...), user: CurrentUser = None, db: DBSession = None):
    """Auto-translate form fields to the given locale using Ollama."""
    import re
    from app.services.ai import chat_with_ai
    form_stmt = select(Form).where(Form.id == form_id).options(selectinload(Form.fields).selectinload(FormField.field_options))
    form = (await db.execute(form_stmt)).scalar_one_or_none()
    if not form:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Form not found")

    fields_data = [{"id": str(f.id), "label": f.label, "description": f.description, "options": [o.label for o in f.field_options]} for f in form.fields if f.label]
    prompt = f"Translate this form to locale '{locale}'. Return valid JSON only: a dict mapping field_id to {{label, description, options}} all translated.\nFields: {json.dumps(fields_data)}"

    try:
        result = await chat_with_ai(prompt, model="ollama")
        json_match = re.search(r'\{.*\}', result, re.DOTALL)
        translations = json.loads(json_match.group()) if json_match else {}
    except Exception:
        translations = {}

    existing = (await db.execute(select(FormTranslation).where(FormTranslation.form_id == form_id, FormTranslation.locale == locale))).scalar_one_or_none()
    if existing:
        existing.translations = translations
        existing.is_ai_generated = True
        await db.commit()
        return {"locale": locale, "translations": translations, "updated": True, "ai_generated": True}

    t = FormTranslation(form_id=form_id, locale=locale, translations=translations, is_ai_generated=True)
    db.add(t)
    await db.commit()
    return {"locale": locale, "translations": translations, "created": True, "ai_generated": True}


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION H: PHASE 3 — CONSENT
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/{form_id}/consent", status_code=status.HTTP_201_CREATED)
async def configure_consent(form_id: uuid.UUID, payload: ConsentCreate, user: CurrentUser, db: DBSession):
    form = await db.get(Form, form_id)
    if not form:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Form not found")
    existing = (await db.execute(select(FormConsent).where(FormConsent.form_id == form_id))).scalar_one_or_none()
    if existing:
        existing.consent_text = payload.consent_text
        existing.is_required = payload.is_required
        existing.data_retention_days = payload.data_retention_days
        existing.privacy_policy_url = payload.privacy_policy_url
        await db.commit()
        return {"id": str(existing.id), "updated": True}
    c = FormConsent(form_id=form_id, consent_text=payload.consent_text, is_required=payload.is_required, data_retention_days=payload.data_retention_days, privacy_policy_url=payload.privacy_policy_url)
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return {"id": str(c.id), "created": True}


@router.get("/{form_id}/consent")
async def get_consent_config(form_id: uuid.UUID):
    # Public endpoint — no auth needed (called during form display)
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        row = (await db.execute(select(FormConsent).where(FormConsent.form_id == form_id))).scalar_one_or_none()
        if not row:
            return None
        return {"consent_text": row.consent_text, "is_required": row.is_required, "privacy_policy_url": row.privacy_policy_url}


@router.post("/{form_id}/consent/record", status_code=status.HTTP_201_CREATED)
async def record_consent(form_id: uuid.UUID, payload: ConsentRecordCreate, db: DBSession):
    record = FormConsentRecord(form_id=form_id, response_id=payload.response_id, ip_address=payload.ip_address, user_agent=payload.user_agent)
    db.add(record)
    await db.commit()
    return {"recorded": True}


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION I: PHASE 3 — AUTOMATIONS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/{form_id}/automations", status_code=status.HTTP_201_CREATED)
async def create_automation(form_id: uuid.UUID, payload: AutomationCreate, user: CurrentUser, db: DBSession):
    form = await db.get(Form, form_id)
    if not form:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Form not found")
    auto = FormAutomation(form_id=form_id, name=payload.name, trigger=payload.trigger, trigger_conditions=payload.trigger_conditions, actions=payload.actions, is_active=payload.is_active)
    db.add(auto)
    await db.commit()
    await db.refresh(auto)
    return {"id": str(auto.id), "name": auto.name, "trigger": auto.trigger, "is_active": auto.is_active}


@router.get("/{form_id}/automations")
async def list_automations(form_id: uuid.UUID, user: CurrentUser, db: DBSession):
    stmt = select(FormAutomation).where(FormAutomation.form_id == form_id)
    rows = (await db.execute(stmt)).scalars().all()
    return {"total": len(rows), "automations": [{"id": str(r.id), "name": r.name, "trigger": r.trigger, "actions": r.actions, "is_active": r.is_active, "run_count": r.run_count, "last_run_at": r.last_run_at} for r in rows]}


@router.delete("/{form_id}/automations/{auto_id}", status_code=status.HTTP_200_OK)
async def delete_automation(form_id: uuid.UUID, auto_id: uuid.UUID, user: CurrentUser, db: DBSession):
    row = await db.get(FormAutomation, auto_id)
    if not row or row.form_id != form_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Automation not found")
    await db.delete(row)
    await db.commit()
    return {"deleted": True}


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION J: PHASE 3 — PUBLIC FORM ACCESS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/public/{share_token}")
async def get_public_form(share_token: str, db: DBSession):
    """Unauthenticated form access by share token stored in settings."""
    stmt = select(Form).options(selectinload(Form.fields).selectinload(FormField.field_options))
    forms = (await db.execute(stmt)).scalars().all()
    form = next((f for f in forms if (f.settings or {}).get("share_token") == share_token), None)
    if not form or not form.is_published:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Form not found or not published")
    return {
        "id": str(form.id),
        "title": form.title,
        "description": form.description,
        "settings": form.settings,
        "fields": [
            {
                "id": str(f.id),
                "label": f.label,
                "field_type": f.field_type,
                "is_required": f.is_required,
                "order": f.order,
                "page_number": f.page_number,
                "description": f.description,
                "placeholder": f.placeholder,
                "options": f.options,
                "field_options": [{"id": str(o.id), "label": o.label, "value": o.value, "order": o.order} for o in f.field_options],
            }
            for f in sorted(form.fields, key=lambda x: (x.page_number, x.order))
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION K: AI SUGGEST IMPROVEMENTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/{form_id}/ai-suggest-improvements")
async def ai_suggest_improvements(form_id: uuid.UUID, user: CurrentUser, db: DBSession):
    """AI-powered form quality audit: clarity, completion likelihood, bias, accessibility."""
    form = await db.get(Form, form_id)
    if not form:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Form not found")
    fields_summary = [
        {"label": f.label, "type": f.field_type, "required": f.is_required, "description": f.description}
        for f in form.fields
    ]
    prompt = (
        f"You are a form design expert. Analyze this form and provide improvement suggestions.\n\n"
        f"Form: {form.title}\nDescription: {form.description or 'None'}\n"
        f"Fields ({len(fields_summary)}):\n"
        + "\n".join(f"- [{f['type']}] {f['label']} ({'required' if f['required'] else 'optional'})" for f in fields_summary)
        + "\n\nProvide a JSON response with these keys:\n"
        "  overall_score (0-100 integer),\n"
        "  clarity_score (0-100),\n"
        "  completion_likelihood (0-100),\n"
        "  accessibility_score (0-100),\n"
        "  bias_score (0-100, higher=less bias),\n"
        "  estimated_completion_minutes (float),\n"
        "  suggestions (array of {issue, severity: 'high'|'medium'|'low', recommendation})\n"
        "Return ONLY valid JSON."
    )
    try:
        from app.services.ai import AIService
        svc = AIService(db)
        raw = await svc.chat(message=prompt, session_id=f"form-audit-{form_id}")
        import json, re
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        result = json.loads(match.group()) if match else {"raw": raw}
    except Exception as exc:
        result = {"error": str(exc)}
    return result


@router.post("/{form_id}/media-upload")
async def upload_form_media(
    form_id: uuid.UUID,
    file: UploadFile,
    user: CurrentUser,
    db: DBSession,
):
    """Upload media (photo/video/audio/document) attached to a form response."""
    from app.integrations import minio_client
    form = await db.get(Form, form_id)
    if not form:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Form not found")
    content = await file.read()
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "bin"
    filename = f"form-{form_id}/{uuid.uuid4()}.{ext}"
    try:
        record = minio_client.upload_file(
            file_data=content,
            filename=filename,
            user_id=str(user.id),
            folder_path=f"forms/{form_id}/media",
            content_type=file.content_type or "application/octet-stream",
        )
        return {"url": record.get("url", ""), "minio_key": record.get("minio_key", filename), "filename": file.filename}
    except Exception as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Upload failed: {exc}")


@router.put("/{form_id}/embed-config")
async def save_embed_config(form_id: uuid.UUID, payload: dict, user: CurrentUser, db: DBSession):
    """Save embed configuration (allowed domains, iframe height, hide header, etc.)."""
    form = await db.get(Form, form_id)
    if not form:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Form not found")
    settings_data = dict(form.settings or {})
    settings_data["embed_config"] = payload
    form.settings = settings_data
    await db.commit()
    return {"embed_config": payload}


@router.get("/{form_id}/embed-config")
async def get_embed_config(form_id: uuid.UUID, user: CurrentUser, db: DBSession):
    """Get embed configuration for a form."""
    form = await db.get(Form, form_id)
    if not form:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Form not found")
    return {"embed_config": (form.settings or {}).get("embed_config", {})}


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION L: REAL-TIME ANALYTICS WEBSOCKET
# ══════════════════════════════════════════════════════════════════════════════

@router.websocket("/{form_id}/ws/analytics")
async def realtime_analytics_ws(
    form_id: uuid.UUID,
    websocket: WebSocket,
    db: DBSession,
    token: str = Query(""),
):
    """WebSocket endpoint for real-time form analytics. Pushes stats on each new submission."""
    import asyncio
    import json as _json
    from app.core.events import event_bus
    from app.core.ws_auth import validate_ws_token  # noqa: PLC0415

    payload = await validate_ws_token(websocket, token)
    if payload is None:
        return

    await websocket.accept()

    async def _get_stats():
        stmt = select(FormResponse).where(FormResponse.form_id == form_id, FormResponse.is_sandbox == False)  # noqa: E712
        responses = (await db.execute(stmt)).scalars().all()
        total = len(responses)
        return {"total_responses": total, "form_id": str(form_id)}

    try:
        # Send initial stats
        stats = await _get_stats()
        await websocket.send_text(_json.dumps(stats))

        # Subscribe to form.submitted events
        channel = f"form.submitted.{form_id}"
        pubsub = event_bus.redis.pubsub() if hasattr(event_bus, 'redis') else None

        if pubsub:
            await pubsub.subscribe(channel)
            try:
                while True:
                    try:
                        message = await asyncio.wait_for(pubsub.get_message(ignore_subscribe_messages=True), timeout=30)
                        if message:
                            stats = await _get_stats()
                            await websocket.send_text(_json.dumps(stats))
                        else:
                            # Send heartbeat
                            await websocket.send_text(_json.dumps({"heartbeat": True}))
                    except asyncio.TimeoutError:
                        await websocket.send_text(_json.dumps({"heartbeat": True}))
            finally:
                await pubsub.unsubscribe(channel)
        else:
            # Polling fallback every 10s
            while True:
                stats = await _get_stats()
                await websocket.send_text(_json.dumps(stats))
                await asyncio.sleep(10)
    except Exception:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
