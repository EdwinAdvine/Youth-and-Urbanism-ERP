"""Support Ticket Templates API — pre-defined ticket creation templates."""

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.support_phase1 import TicketTemplate

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class TemplateCreate(BaseModel):
    name: str
    description: str | None = None
    default_subject: str | None = None
    default_description: str | None = None
    default_priority: str | None = None
    default_category_id: uuid.UUID | None = None
    default_tags: list[str] | None = None
    custom_fields: list | None = None
    is_active: bool = True


class TemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    default_subject: str | None = None
    default_description: str | None = None
    default_priority: str | None = None
    default_category_id: uuid.UUID | None = None
    default_tags: list[str] | None = None
    custom_fields: list | None = None
    is_active: bool | None = None


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    default_subject: str | None
    default_description: str | None
    default_priority: str | None
    default_category_id: uuid.UUID | None
    category_name: str | None = None
    default_tags: list[str] | None
    custom_fields: list | None
    is_active: bool
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/templates", summary="List ticket templates")
async def list_templates(
    current_user: CurrentUser,
    db: DBSession,
    active_only: bool = True,
) -> list[dict[str, Any]]:
    q = select(TicketTemplate).order_by(TicketTemplate.name)
    if active_only:
        q = q.where(TicketTemplate.is_active == True)  # noqa: E712
    result = await db.execute(q)
    templates = result.scalars().all()

    return [
        {
            **TemplateOut.model_validate(t).model_dump(),
            "category_name": t.category.name if t.category else None,
        }
        for t in templates
    ]


@router.post("/templates", status_code=201, summary="Create ticket template")
async def create_template(
    payload: TemplateCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    template = TicketTemplate(
        **payload.model_dump(),
        created_by=current_user.id,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)

    return {
        **TemplateOut.model_validate(template).model_dump(),
        "category_name": template.category.name if template.category else None,
    }


@router.put("/templates/{template_id}", summary="Update ticket template")
async def update_template(
    template_id: uuid.UUID,
    payload: TemplateUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    template = await db.get(TicketTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(template, field, value)

    await db.commit()
    await db.refresh(template)

    return {
        **TemplateOut.model_validate(template).model_dump(),
        "category_name": template.category.name if template.category else None,
    }


@router.delete("/templates/{template_id}", status_code=204, summary="Delete ticket template")
async def delete_template(
    template_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    template = await db.get(TicketTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    await db.delete(template)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


@router.post("/templates/{template_id}/apply", status_code=201, summary="Create ticket from template")
async def apply_template(
    template_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    subject_override: str | None = None,
    description_override: str | None = None,
) -> dict[str, Any]:
    """Create a new ticket pre-filled from template defaults."""
    template = await db.get(TicketTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    from app.api.v1.support import TicketCreate, create_ticket
    from unittest.mock import AsyncMock

    # Build ticket payload from template
    payload = TicketCreate(
        subject=subject_override or template.default_subject or template.name,
        description=description_override or template.default_description,
        priority=template.default_priority or "medium",
        category_id=template.default_category_id,
        tags=template.default_tags or [],
    )

    # Delegate to the existing create_ticket endpoint
    return await create_ticket(payload, current_user, db)
