"""CRM cross-module soft links — Calendar, Meetings, Forms, E-Commerce."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class ScheduleFollowupPayload(BaseModel):
    title: str
    start_time: datetime
    end_time: datetime
    description: str | None = None
    color: str | None = "#51459d"


class ScheduleMeetingPayload(BaseModel):
    title: str
    start_time: datetime
    end_time: datetime
    description: str | None = None
    attendees: list[str] | None = None


class LeadCaptureFormPayload(BaseModel):
    form_name: str
    fields: list[dict] | None = None
    pipeline_id: uuid.UUID | None = None
    auto_assign_to: uuid.UUID | None = None


class EcommerceSyncPayload(BaseModel):
    store_id: uuid.UUID


class EcommerceImportPayload(BaseModel):
    store_id: uuid.UUID
    customer_ids: list[uuid.UUID] | None = None  # None = all


# ── 1. CRM → Calendar: Schedule Follow-up ────────────────────────────────────

@router.post(
    "/contacts/{contact_id}/schedule-followup",
    status_code=status.HTTP_201_CREATED,
    summary="Schedule a calendar follow-up for a contact",
)
async def schedule_contact_followup(
    contact_id: uuid.UUID,
    payload: ScheduleFollowupPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.crm import Contact  # noqa: PLC0415
    from app.models.calendar import CalendarEvent  # noqa: PLC0415

    contact = await db.get(Contact, contact_id)
    if not contact or not contact.is_active:
        raise HTTPException(status_code=404, detail="Contact not found")

    contact_name = f"{contact.first_name or ''} {contact.last_name or ''}".strip() or contact.email or "Contact"

    event = CalendarEvent(
        title=payload.title,
        description=(
            f"{payload.description or ''}\n\n"
            f"---\nCRM Follow-up for contact: {contact_name} ({contact.email or 'no email'})\n"
            f"Contact ID: {contact_id}"
        ).strip(),
        start_time=payload.start_time,
        end_time=payload.end_time,
        all_day=False,
        event_type="reminder",
        color=payload.color or "#51459d",
        organizer_id=current_user.id,
        attendees=[],
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    await event_bus.publish("crm.followup.scheduled", {
        "event_id": str(event.id),
        "contact_id": str(contact_id),
        "contact_name": contact_name,
        "title": payload.title,
        "start_time": event.start_time.isoformat(),
        "owner_id": str(current_user.id),
    })

    return {
        "id": str(event.id),
        "title": event.title,
        "start_time": event.start_time.isoformat(),
        "end_time": event.end_time.isoformat(),
        "event_type": event.event_type,
        "linked_module": "crm_contact",
        "linked_id": str(contact_id),
    }


@router.post(
    "/deals/{deal_id}/schedule-followup",
    status_code=status.HTTP_201_CREATED,
    summary="Schedule a calendar follow-up for a deal",
)
async def schedule_deal_followup(
    deal_id: uuid.UUID,
    payload: ScheduleFollowupPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.crm import Deal  # noqa: PLC0415
    from app.models.calendar import CalendarEvent  # noqa: PLC0415

    deal = await db.get(Deal, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    event = CalendarEvent(
        title=payload.title,
        description=(
            f"{payload.description or ''}\n\n"
            f"---\nCRM Follow-up for deal: {deal.title}\n"
            f"Deal ID: {deal_id}"
        ).strip(),
        start_time=payload.start_time,
        end_time=payload.end_time,
        all_day=False,
        event_type="reminder",
        color=payload.color or "#51459d",
        organizer_id=current_user.id,
        attendees=[],
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    await event_bus.publish("crm.followup.scheduled", {
        "event_id": str(event.id),
        "deal_id": str(deal_id),
        "deal_title": deal.title,
        "title": payload.title,
        "start_time": event.start_time.isoformat(),
        "owner_id": str(current_user.id),
    })

    return {
        "id": str(event.id),
        "title": event.title,
        "start_time": event.start_time.isoformat(),
        "end_time": event.end_time.isoformat(),
        "event_type": event.event_type,
        "linked_module": "crm_deal",
        "linked_id": str(deal_id),
    }


# ── 2. CRM → Meetings: Link Meeting to Deal/Contact ─────────────────────────

@router.post(
    "/contacts/{contact_id}/schedule-meeting",
    status_code=status.HTTP_201_CREATED,
    summary="Schedule a Jitsi meeting linked to a CRM contact",
)
async def schedule_contact_meeting(
    contact_id: uuid.UUID,
    payload: ScheduleMeetingPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.crm import Contact  # noqa: PLC0415
    from app.models.calendar import CalendarEvent  # noqa: PLC0415

    contact = await db.get(Contact, contact_id)
    if not contact or not contact.is_active:
        raise HTTPException(status_code=404, detail="Contact not found")

    contact_name = f"{contact.first_name or ''} {contact.last_name or ''}".strip() or contact.email or "Contact"

    # Create Jitsi room
    from app.integrations import jitsi  # noqa: PLC0415

    display_name = getattr(current_user, "full_name", None) or getattr(current_user, "email", str(current_user.id))
    email = getattr(current_user, "email", "")

    jitsi_data = jitsi.create_room(
        name=payload.title,
        user_id=str(current_user.id),
        user_name=display_name,
        user_email=email,
    )

    event = CalendarEvent(
        title=payload.title,
        description=(
            f"{payload.description or ''}\n\n"
            f"---\nCRM Meeting with contact: {contact_name} ({contact.email or 'no email'})\n"
            f"Contact ID: {contact_id}"
        ).strip(),
        start_time=payload.start_time,
        end_time=payload.end_time,
        all_day=False,
        event_type="meeting",
        color="#51459d",
        location=jitsi_data["room_url"],
        organizer_id=current_user.id,
        attendees=payload.attendees or [],
        jitsi_room=jitsi_data["room_name"],
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    await event_bus.publish("crm.meeting.scheduled", {
        "meeting_id": str(event.id),
        "contact_id": str(contact_id),
        "contact_name": contact_name,
        "title": payload.title,
        "start_time": event.start_time.isoformat(),
        "jitsi_room_url": jitsi_data["room_url"],
        "owner_id": str(current_user.id),
    })

    return {
        "id": str(event.id),
        "title": event.title,
        "start_time": event.start_time.isoformat(),
        "end_time": event.end_time.isoformat(),
        "jitsi_room": event.jitsi_room,
        "jitsi_room_url": jitsi_data["room_url"],
        "jitsi_jwt": jitsi_data["jwt_token"],
        "linked_module": "crm_contact",
        "linked_id": str(contact_id),
    }


@router.post(
    "/deals/{deal_id}/schedule-meeting",
    status_code=status.HTTP_201_CREATED,
    summary="Schedule a Jitsi meeting linked to a CRM deal",
)
async def schedule_deal_meeting(
    deal_id: uuid.UUID,
    payload: ScheduleMeetingPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.crm import Deal  # noqa: PLC0415
    from app.models.calendar import CalendarEvent  # noqa: PLC0415

    deal = await db.get(Deal, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    from app.integrations import jitsi  # noqa: PLC0415

    display_name = getattr(current_user, "full_name", None) or getattr(current_user, "email", str(current_user.id))
    email = getattr(current_user, "email", "")

    jitsi_data = jitsi.create_room(
        name=payload.title,
        user_id=str(current_user.id),
        user_name=display_name,
        user_email=email,
    )

    event = CalendarEvent(
        title=payload.title,
        description=(
            f"{payload.description or ''}\n\n"
            f"---\nCRM Meeting for deal: {deal.title}\n"
            f"Deal ID: {deal_id}"
        ).strip(),
        start_time=payload.start_time,
        end_time=payload.end_time,
        all_day=False,
        event_type="meeting",
        color="#51459d",
        location=jitsi_data["room_url"],
        organizer_id=current_user.id,
        attendees=payload.attendees or [],
        jitsi_room=jitsi_data["room_name"],
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    await event_bus.publish("crm.meeting.scheduled", {
        "meeting_id": str(event.id),
        "deal_id": str(deal_id),
        "deal_title": deal.title,
        "title": payload.title,
        "start_time": event.start_time.isoformat(),
        "jitsi_room_url": jitsi_data["room_url"],
        "owner_id": str(current_user.id),
    })

    return {
        "id": str(event.id),
        "title": event.title,
        "start_time": event.start_time.isoformat(),
        "end_time": event.end_time.isoformat(),
        "jitsi_room": event.jitsi_room,
        "jitsi_room_url": jitsi_data["room_url"],
        "jitsi_jwt": jitsi_data["jwt_token"],
        "linked_module": "crm_deal",
        "linked_id": str(deal_id),
    }


# ── 3. CRM → Forms: Lead Capture Form ───────────────────────────────────────

@router.post(
    "/lead-capture-forms",
    status_code=status.HTTP_201_CREATED,
    summary="Create a lead capture form linked to CRM",
)
async def create_lead_capture_form(
    payload: LeadCaptureFormPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.forms import Form, FormField  # noqa: PLC0415

    # Default lead capture fields if none provided
    default_fields = [
        {"label": "Full Name", "field_type": "text", "is_required": True, "order": 0},
        {"label": "Email", "field_type": "email", "is_required": True, "order": 1},
        {"label": "Phone", "field_type": "text", "is_required": False, "order": 2},
        {"label": "Company", "field_type": "text", "is_required": False, "order": 3},
        {"label": "Message", "field_type": "textarea", "is_required": False, "order": 4},
    ]

    fields_config = payload.fields or default_fields

    form = Form(
        title=payload.form_name,
        description=f"Lead capture form — submissions auto-create CRM leads.",
        owner_id=current_user.id,
        is_published=True,
        is_template=False,
        settings={
            "crm_lead_capture": True,
            "pipeline_id": str(payload.pipeline_id) if payload.pipeline_id else None,
            "auto_assign_to": str(payload.auto_assign_to) if payload.auto_assign_to else None,
            "allow_anonymous": True,
        },
    )
    db.add(form)
    await db.flush()

    for idx, field_def in enumerate(fields_config):
        field = FormField(
            form_id=form.id,
            label=field_def.get("label", f"Field {idx + 1}"),
            field_type=field_def.get("field_type", "text"),
            options=field_def.get("options"),
            is_required=field_def.get("is_required", False),
            order=field_def.get("order", idx),
        )
        db.add(field)

    await db.commit()
    await db.refresh(form)

    # Re-fetch fields
    from sqlalchemy.orm import selectinload  # noqa: PLC0415
    result = await db.execute(
        select(Form).where(Form.id == form.id).options(selectinload(Form.fields))
    )
    form = result.scalar_one()

    return {
        "id": str(form.id),
        "title": form.title,
        "description": form.description,
        "is_published": form.is_published,
        "settings": form.settings,
        "fields": [
            {
                "id": str(f.id),
                "label": f.label,
                "field_type": f.field_type,
                "is_required": f.is_required,
                "order": f.order,
            }
            for f in sorted(form.fields, key=lambda x: x.order)
        ],
        "form_url": f"/forms/{form.id}/submit",
    }


@router.get(
    "/lead-capture-forms",
    summary="List lead capture forms",
)
async def list_lead_capture_forms(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.forms import Form  # noqa: PLC0415

    result = await db.execute(
        select(Form).where(
            Form.settings["crm_lead_capture"].as_boolean() == True,  # noqa: E712
        ).order_by(Form.created_at.desc())
    )
    forms = result.scalars().all()

    return {
        "forms": [
            {
                "id": str(f.id),
                "title": f.title,
                "is_published": f.is_published,
                "created_at": f.created_at.isoformat() if f.created_at else None,
            }
            for f in forms
        ],
    }


# ── 4. CRM → E-Commerce: Customer Sync ──────────────────────────────────────

@router.post(
    "/contacts/{contact_id}/sync-ecommerce",
    status_code=status.HTTP_201_CREATED,
    summary="Sync a CRM contact to an e-commerce customer account",
)
async def sync_contact_to_ecommerce(
    contact_id: uuid.UUID,
    payload: EcommerceSyncPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.crm import Contact  # noqa: PLC0415
    from app.models.ecommerce import CustomerAccount, Store  # noqa: PLC0415

    contact = await db.get(Contact, contact_id)
    if not contact or not contact.is_active:
        raise HTTPException(status_code=404, detail="Contact not found")

    if not contact.email:
        raise HTTPException(status_code=400, detail="Contact must have an email to sync to e-commerce")

    store = await db.get(Store, payload.store_id)
    if not store or not store.is_active:
        raise HTTPException(status_code=404, detail="Store not found")

    # Check if customer already exists for this email + store
    existing = await db.execute(
        select(CustomerAccount).where(
            CustomerAccount.email == contact.email,
            CustomerAccount.store_id == payload.store_id,
        )
    )
    existing_customer = existing.scalar_one_or_none()

    if existing_customer:
        # Link existing customer to CRM contact
        existing_customer.crm_contact_id = contact.id
        existing_customer.first_name = contact.first_name or existing_customer.first_name
        existing_customer.last_name = contact.last_name or existing_customer.last_name
        existing_customer.phone = contact.phone or existing_customer.phone
        await db.commit()
        await db.refresh(existing_customer)

        return {
            "action": "linked",
            "customer_id": str(existing_customer.id),
            "contact_id": str(contact_id),
            "email": existing_customer.email,
            "message": "Existing e-commerce customer linked to CRM contact",
        }

    # Create new customer account
    import secrets  # noqa: PLC0415
    from app.core.security import hash_password  # noqa: PLC0415

    temp_password = secrets.token_urlsafe(16)

    customer = CustomerAccount(
        store_id=payload.store_id,
        email=contact.email,
        password_hash=hash_password(temp_password),
        first_name=contact.first_name,
        last_name=contact.last_name,
        phone=contact.phone,
        is_active=True,
        crm_contact_id=contact.id,
    )
    db.add(customer)
    await db.commit()
    await db.refresh(customer)

    # Update CRM contact metadata with e-commerce link
    meta = contact.metadata_json or {}
    meta["ecommerce_customer_id"] = str(customer.id)
    meta["ecommerce_store_id"] = str(payload.store_id)
    contact.metadata_json = meta
    await db.commit()

    await event_bus.publish("crm.ecommerce.synced", {
        "contact_id": str(contact_id),
        "customer_id": str(customer.id),
        "store_id": str(payload.store_id),
        "email": customer.email,
        "owner_id": str(current_user.id),
    })

    return {
        "action": "created",
        "customer_id": str(customer.id),
        "contact_id": str(contact_id),
        "email": customer.email,
        "message": "New e-commerce customer created and linked to CRM contact",
    }


@router.post(
    "/contacts/import-from-ecommerce",
    status_code=status.HTTP_201_CREATED,
    summary="Import e-commerce customers as CRM contacts",
)
async def import_from_ecommerce(
    payload: EcommerceImportPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.crm import Contact  # noqa: PLC0415
    from app.models.ecommerce import CustomerAccount, Store  # noqa: PLC0415

    store = await db.get(Store, payload.store_id)
    if not store or not store.is_active:
        raise HTTPException(status_code=404, detail="Store not found")

    # Fetch customers to import
    query = select(CustomerAccount).where(
        CustomerAccount.store_id == payload.store_id,
        CustomerAccount.is_active == True,  # noqa: E712
    )
    if payload.customer_ids:
        query = query.where(CustomerAccount.id.in_(payload.customer_ids))

    result = await db.execute(query)
    customers = result.scalars().all()

    imported = 0
    skipped = 0
    linked = 0

    for customer in customers:
        # Check if already linked to a CRM contact
        if customer.crm_contact_id:
            skipped += 1
            continue

        # Check if a CRM contact with same email already exists
        existing_contact = await db.execute(
            select(Contact).where(
                Contact.email == customer.email,
                Contact.is_active == True,  # noqa: E712
            )
        )
        existing = existing_contact.scalar_one_or_none()

        if existing:
            # Link the customer to the existing CRM contact
            customer.crm_contact_id = existing.id
            meta = existing.metadata_json or {}
            meta["ecommerce_customer_id"] = str(customer.id)
            meta["ecommerce_store_id"] = str(payload.store_id)
            existing.metadata_json = meta
            linked += 1
        else:
            # Create a new CRM contact
            contact = Contact(
                contact_type="person",
                first_name=customer.first_name,
                last_name=customer.last_name,
                email=customer.email,
                phone=customer.phone,
                source="ecommerce",
                owner_id=current_user.id,
                tags=["ecommerce-import"],
                metadata_json={
                    "ecommerce_customer_id": str(customer.id),
                    "ecommerce_store_id": str(payload.store_id),
                },
            )
            db.add(contact)
            await db.flush()

            customer.crm_contact_id = contact.id
            imported += 1

    await db.commit()

    return {
        "imported": imported,
        "linked": linked,
        "skipped": skipped,
        "total_processed": imported + linked + skipped,
        "store_id": str(payload.store_id),
    }
