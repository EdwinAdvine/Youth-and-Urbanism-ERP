"""CRM Email Templates — CRUD + preview with merge fields."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.models.crm import EmailTemplate

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────


class TemplateCreate(BaseModel):
    name: str
    subject: str
    body_html: str
    body_text: str | None = None
    category: str = "one_off"
    variables: dict | None = None
    is_active: bool = True


class TemplateUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    body_html: str | None = None
    body_text: str | None = None
    category: str | None = None
    variables: dict | None = None
    is_active: bool | None = None


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    subject: str
    body_html: str
    body_text: str | None
    category: str
    variables: dict | None
    is_active: bool
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


class PreviewPayload(BaseModel):
    merge_data: dict = {}


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/templates", summary="List email templates")
async def list_templates(
    current_user: CurrentUser,
    db: DBSession,
    category: str | None = Query(None),
    active_only: bool = Query(False),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(EmailTemplate)
    if category:
        query = query.where(EmailTemplate.category == category)
    if active_only:
        query = query.where(EmailTemplate.is_active.is_(True))
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    query = query.order_by(EmailTemplate.updated_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    templates = result.scalars().all()
    return {
        "total": total,
        "templates": [TemplateOut.model_validate(t).model_dump() for t in templates],
    }


@router.post("/templates", status_code=201, summary="Create an email template")
async def create_template(
    payload: TemplateCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    template = EmailTemplate(
        name=payload.name,
        subject=payload.subject,
        body_html=payload.body_html,
        body_text=payload.body_text,
        category=payload.category,
        variables=payload.variables,
        is_active=payload.is_active,
        owner_id=current_user.id,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return TemplateOut.model_validate(template).model_dump()


@router.get("/templates/{template_id}", summary="Get an email template")
async def get_template(
    template_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    template = await db.get(EmailTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return TemplateOut.model_validate(template).model_dump()


@router.put("/templates/{template_id}", summary="Update an email template")
async def update_template(
    template_id: uuid.UUID,
    payload: TemplateUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    template = await db.get(EmailTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(template, k, v)
    await db.commit()
    await db.refresh(template)
    return TemplateOut.model_validate(template).model_dump()


@router.delete("/templates/{template_id}", status_code=204, summary="Delete an email template")
async def delete_template(
    template_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    template = await db.get(EmailTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(template)
    await db.commit()
    return Response(status_code=204)


@router.post("/templates/{template_id}/preview", summary="Preview template with merge fields")
async def preview_template(
    template_id: uuid.UUID,
    payload: PreviewPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    template = await db.get(EmailTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    subject = template.subject
    body_html = template.body_html
    body_text = template.body_text or ""

    for key, val in payload.merge_data.items():
        placeholder = f"{{{{{key}}}}}"
        subject = subject.replace(placeholder, str(val))
        body_html = body_html.replace(placeholder, str(val))
        body_text = body_text.replace(placeholder, str(val))

    return {
        "subject": subject,
        "body_html": body_html,
        "body_text": body_text,
    }
