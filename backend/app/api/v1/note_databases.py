"""API router for Y&U Notes — Notion-style Databases.

Endpoints:
  Databases  — CRUD + archive
  Properties — CRUD + reorder
  Views      — CRUD
  Rows       — CRUD + bulk create
  ERP Import — pull live ERP data as rows
"""

import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class DatabaseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    icon: Optional[str] = None
    notebook_id: Optional[str] = None
    page_id: Optional[str] = None


class DatabaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    is_archived: Optional[bool] = None


class PropertyCreate(BaseModel):
    name: str
    property_type: str = "text"
    config: Optional[dict[str, Any]] = None


class PropertyUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[dict[str, Any]] = None
    is_visible: Optional[bool] = None
    width: Optional[int] = None


class ViewCreate(BaseModel):
    name: str
    view_type: str = "table"


class ViewUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[dict[str, Any]] = None
    is_default: Optional[bool] = None


class RowCreate(BaseModel):
    values: dict[str, Any] = {}


class RowUpdate(BaseModel):
    values: dict[str, Any]


class ERPImportBody(BaseModel):
    source: str  # crm_deals | projects_tasks | finance_invoices | hr_employees | support_tickets
    filters: Optional[dict[str, Any]] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_db_or_404(db_id: str, user_id: str, db: AsyncSession):
    from app.models.note_database import NoteDatabase
    result = await db.execute(
        select(NoteDatabase).where(
            NoteDatabase.id == uuid.UUID(db_id),
            NoteDatabase.owner_id == uuid.UUID(user_id),
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Database not found")
    return obj


# ── Databases ─────────────────────────────────────────────────────────────────

@router.get("")
async def list_databases(
    notebook_id: Optional[str] = Query(None),
    include_archived: bool = Query(False),
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.note_database import NoteDatabase
    q = select(NoteDatabase).where(NoteDatabase.owner_id == uuid.UUID(user.id))
    if not include_archived:
        q = q.where(NoteDatabase.is_archived.is_(False))
    if notebook_id:
        q = q.where(NoteDatabase.notebook_id == uuid.UUID(notebook_id))
    q = q.order_by(NoteDatabase.sort_order, NoteDatabase.created_at)
    result = await db.execute(q)
    databases = result.scalars().all()

    out = []
    for d in databases:
        out.append({
            "id": str(d.id),
            "title": d.title,
            "description": d.description,
            "owner_id": str(d.owner_id),
            "notebook_id": str(d.notebook_id) if d.notebook_id else None,
            "page_id": str(d.page_id) if d.page_id else None,
            "icon": d.icon,
            "is_shared": d.is_shared,
            "is_archived": d.is_archived,
            "sort_order": d.sort_order,
            "created_at": d.created_at.isoformat(),
            "updated_at": d.updated_at.isoformat(),
        })
    return out


@router.post("", status_code=201)
async def create_database(
    body: DatabaseCreate,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.note_database import NoteDatabase, NoteDatabaseProperty, NoteDatabaseView
    import datetime as dt

    new_db = NoteDatabase(
        title=body.title,
        description=body.description,
        icon=body.icon,
        owner_id=uuid.UUID(user.id),
        notebook_id=uuid.UUID(body.notebook_id) if body.notebook_id else None,
        page_id=uuid.UUID(body.page_id) if body.page_id else None,
    )
    db.add(new_db)
    await db.flush()

    # Create default "Name" text property
    name_prop = NoteDatabaseProperty(
        database_id=new_db.id,
        name="Name",
        property_type="text",
        sort_order=0,
    )
    db.add(name_prop)

    # Create default Table view
    table_view = NoteDatabaseView(
        database_id=new_db.id,
        name="Table",
        view_type="table",
        is_default=True,
        sort_order=0,
    )
    db.add(table_view)

    await db.commit()
    await db.refresh(new_db)

    return {
        "id": str(new_db.id),
        "title": new_db.title,
        "description": new_db.description,
        "icon": new_db.icon,
        "owner_id": str(new_db.owner_id),
        "notebook_id": str(new_db.notebook_id) if new_db.notebook_id else None,
        "is_shared": new_db.is_shared,
        "is_archived": new_db.is_archived,
        "sort_order": new_db.sort_order,
        "created_at": new_db.created_at.isoformat(),
        "updated_at": new_db.updated_at.isoformat(),
    }


@router.get("/{db_id}")
async def get_database(
    db_id: str,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.note_database import NoteDatabase, NoteDatabaseProperty, NoteDatabaseView

    obj = await _get_db_or_404(db_id, user.id, db)

    props_r = await db.execute(
        select(NoteDatabaseProperty)
        .where(NoteDatabaseProperty.database_id == obj.id)
        .order_by(NoteDatabaseProperty.sort_order)
    )
    views_r = await db.execute(
        select(NoteDatabaseView)
        .where(NoteDatabaseView.database_id == obj.id)
        .order_by(NoteDatabaseView.sort_order)
    )

    def _prop(p):
        return {"id": str(p.id), "database_id": str(p.database_id), "name": p.name,
                "property_type": p.property_type, "config": p.config,
                "sort_order": p.sort_order, "is_visible": p.is_visible, "width": p.width}

    def _view(v):
        return {"id": str(v.id), "database_id": str(v.database_id), "name": v.name,
                "view_type": v.view_type, "config": v.config,
                "is_default": v.is_default, "sort_order": v.sort_order}

    return {
        "id": str(obj.id), "title": obj.title, "description": obj.description,
        "owner_id": str(obj.owner_id),
        "notebook_id": str(obj.notebook_id) if obj.notebook_id else None,
        "page_id": str(obj.page_id) if obj.page_id else None,
        "icon": obj.icon, "is_shared": obj.is_shared, "is_archived": obj.is_archived,
        "sort_order": obj.sort_order,
        "created_at": obj.created_at.isoformat(), "updated_at": obj.updated_at.isoformat(),
        "properties": [_prop(p) for p in props_r.scalars().all()],
        "views": [_view(v) for v in views_r.scalars().all()],
    }


@router.put("/{db_id}")
async def update_database(
    db_id: str,
    body: DatabaseUpdate,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    import datetime as dt
    obj = await _get_db_or_404(db_id, user.id, db)
    if body.title is not None: obj.title = body.title
    if body.description is not None: obj.description = body.description
    if body.icon is not None: obj.icon = body.icon
    if body.is_archived is not None: obj.is_archived = body.is_archived
    obj.updated_at = dt.datetime.utcnow()
    await db.commit()
    return {"id": str(obj.id), "title": obj.title}


@router.delete("/{db_id}", status_code=204)
async def delete_database(
    db_id: str,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    obj = await _get_db_or_404(db_id, user.id, db)
    await db.delete(obj)
    await db.commit()


# ── Properties ────────────────────────────────────────────────────────────────

@router.post("/{db_id}/properties", status_code=201)
async def create_property(
    db_id: str,
    body: PropertyCreate,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.note_database import NoteDatabaseProperty
    obj = await _get_db_or_404(db_id, user.id, db)

    # Get max sort_order
    from sqlalchemy import func
    max_r = await db.execute(
        select(func.max(NoteDatabaseProperty.sort_order)).where(NoteDatabaseProperty.database_id == obj.id)
    )
    max_order = max_r.scalar() or 0

    prop = NoteDatabaseProperty(
        database_id=obj.id,
        name=body.name,
        property_type=body.property_type,
        config=body.config,
        sort_order=max_order + 1,
    )
    db.add(prop)
    await db.commit()
    await db.refresh(prop)
    return {"id": str(prop.id), "name": prop.name, "property_type": prop.property_type,
            "config": prop.config, "sort_order": prop.sort_order,
            "is_visible": prop.is_visible, "width": prop.width}


@router.put("/{db_id}/properties/{prop_id}")
async def update_property(
    db_id: str,
    prop_id: str,
    body: PropertyUpdate,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.note_database import NoteDatabaseProperty
    import datetime as dt
    obj = await _get_db_or_404(db_id, user.id, db)
    r = await db.execute(
        select(NoteDatabaseProperty).where(
            NoteDatabaseProperty.id == uuid.UUID(prop_id),
            NoteDatabaseProperty.database_id == obj.id,
        )
    )
    prop = r.scalar_one_or_none()
    if not prop:
        raise HTTPException(404, "Property not found")
    if body.name is not None: prop.name = body.name
    if body.config is not None: prop.config = body.config
    if body.is_visible is not None: prop.is_visible = body.is_visible
    if body.width is not None: prop.width = body.width
    await db.commit()
    return {"id": str(prop.id), "name": prop.name, "property_type": prop.property_type,
            "config": prop.config, "is_visible": prop.is_visible, "width": prop.width}


@router.delete("/{db_id}/properties/{prop_id}", status_code=204)
async def delete_property(
    db_id: str,
    prop_id: str,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.note_database import NoteDatabaseProperty
    obj = await _get_db_or_404(db_id, user.id, db)
    await db.execute(
        delete(NoteDatabaseProperty).where(
            NoteDatabaseProperty.id == uuid.UUID(prop_id),
            NoteDatabaseProperty.database_id == obj.id,
        )
    )
    await db.commit()


# ── Views ─────────────────────────────────────────────────────────────────────

@router.post("/{db_id}/views", status_code=201)
async def create_view(
    db_id: str,
    body: ViewCreate,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.note_database import NoteDatabaseView
    from sqlalchemy import func
    obj = await _get_db_or_404(db_id, user.id, db)
    max_r = await db.execute(
        select(func.max(NoteDatabaseView.sort_order)).where(NoteDatabaseView.database_id == obj.id)
    )
    max_order = max_r.scalar() or 0
    view = NoteDatabaseView(
        database_id=obj.id, name=body.name, view_type=body.view_type, sort_order=max_order + 1
    )
    db.add(view)
    await db.commit()
    await db.refresh(view)
    return {"id": str(view.id), "name": view.name, "view_type": view.view_type,
            "is_default": view.is_default, "sort_order": view.sort_order}


@router.put("/{db_id}/views/{view_id}")
async def update_view(
    db_id: str,
    view_id: str,
    body: ViewUpdate,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.note_database import NoteDatabaseView
    obj = await _get_db_or_404(db_id, user.id, db)
    r = await db.execute(
        select(NoteDatabaseView).where(
            NoteDatabaseView.id == uuid.UUID(view_id),
            NoteDatabaseView.database_id == obj.id,
        )
    )
    view = r.scalar_one_or_none()
    if not view:
        raise HTTPException(404, "View not found")
    if body.name is not None: view.name = body.name
    if body.config is not None: view.config = body.config
    if body.is_default is not None: view.is_default = body.is_default
    await db.commit()
    return {"id": str(view.id), "name": view.name, "view_type": view.view_type, "is_default": view.is_default}


@router.delete("/{db_id}/views/{view_id}", status_code=204)
async def delete_view(
    db_id: str,
    view_id: str,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.note_database import NoteDatabaseView
    obj = await _get_db_or_404(db_id, user.id, db)
    await db.execute(
        delete(NoteDatabaseView).where(
            NoteDatabaseView.id == uuid.UUID(view_id),
            NoteDatabaseView.database_id == obj.id,
        )
    )
    await db.commit()


# ── Rows ─────────────────────────────────────────────────────────────────────

@router.get("/{db_id}/rows")
async def list_rows(
    db_id: str,
    view_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.note_database import NoteDatabaseRow
    obj = await _get_db_or_404(db_id, user.id, db)
    q = (
        select(NoteDatabaseRow)
        .where(NoteDatabaseRow.database_id == obj.id)
        .order_by(NoteDatabaseRow.sort_order, NoteDatabaseRow.created_at)
    )
    result = await db.execute(q)
    rows = result.scalars().all()
    return [
        {"id": str(r.id), "database_id": str(r.database_id),
         "page_id": str(r.page_id) if r.page_id else None,
         "values": r.values or {}, "sort_order": r.sort_order,
         "created_at": r.created_at.isoformat(), "updated_at": r.updated_at.isoformat()}
        for r in rows
    ]


@router.post("/{db_id}/rows", status_code=201)
async def create_row(
    db_id: str,
    body: RowCreate,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.note_database import NoteDatabaseRow
    from sqlalchemy import func
    obj = await _get_db_or_404(db_id, user.id, db)
    max_r = await db.execute(
        select(func.max(NoteDatabaseRow.sort_order)).where(NoteDatabaseRow.database_id == obj.id)
    )
    max_order = max_r.scalar() or 0
    row = NoteDatabaseRow(
        database_id=obj.id,
        values=body.values,
        sort_order=max_order + 1,
        created_by_id=uuid.UUID(user.id),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {"id": str(row.id), "database_id": str(row.database_id),
            "values": row.values, "sort_order": row.sort_order,
            "created_at": row.created_at.isoformat(), "updated_at": row.updated_at.isoformat()}


@router.put("/{db_id}/rows/{row_id}")
async def update_row(
    db_id: str,
    row_id: str,
    body: RowUpdate,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.note_database import NoteDatabaseRow
    import datetime as dt
    obj = await _get_db_or_404(db_id, user.id, db)
    r = await db.execute(
        select(NoteDatabaseRow).where(
            NoteDatabaseRow.id == uuid.UUID(row_id),
            NoteDatabaseRow.database_id == obj.id,
        )
    )
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Row not found")
    row.values = body.values
    row.updated_at = dt.datetime.utcnow()
    await db.commit()
    return {"id": str(row.id), "values": row.values}


@router.delete("/{db_id}/rows/{row_id}", status_code=204)
async def delete_row(
    db_id: str,
    row_id: str,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.note_database import NoteDatabaseRow
    obj = await _get_db_or_404(db_id, user.id, db)
    await db.execute(
        delete(NoteDatabaseRow).where(
            NoteDatabaseRow.id == uuid.UUID(row_id),
            NoteDatabaseRow.database_id == obj.id,
        )
    )
    await db.commit()


# ── ERP Import ────────────────────────────────────────────────────────────────

ERP_IMPORTERS: dict[str, str] = {
    "crm_deals":         "app.models.crm.Lead",
    "projects_tasks":    "app.models.projects.Task",
    "finance_invoices":  "app.models.finance.Invoice",
    "hr_employees":      "app.models.hr.Employee",
    "support_tickets":   "app.models.support.Ticket",
}

ERP_FIELD_MAPS: dict[str, dict[str, str]] = {
    "crm_deals":        {"title": "title", "stage": "stage", "value": "value"},
    "projects_tasks":   {"Name": "title", "Status": "status", "Priority": "priority"},
    "finance_invoices": {"Number": "invoice_number", "Status": "status", "Amount": "total_amount"},
    "hr_employees":     {"Name": "full_name or name", "Role": "job_title", "Department": "department"},
    "support_tickets":  {"Title": "title", "Status": "status", "Priority": "priority"},
}


@router.post("/{db_id}/import-erp")
async def import_from_erp(
    db_id: str,
    body: ERPImportBody,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.note_database import NoteDatabaseRow, NoteDatabaseProperty
    from sqlalchemy import func
    import importlib

    obj = await _get_db_or_404(db_id, user.id, db)

    if body.source not in ERP_IMPORTERS:
        raise HTTPException(400, f"Unknown ERP source: {body.source}. Valid: {list(ERP_IMPORTERS.keys())}")

    module_path, class_name = ERP_IMPORTERS[body.source].rsplit(".", 1)
    try:
        module = importlib.import_module(module_path)
        Model = getattr(module, class_name)
    except (ImportError, AttributeError):
        raise HTTPException(500, f"Could not load model for {body.source}")

    # Query ERP records (limit 200 to avoid huge imports)
    erp_r = await db.execute(select(Model).limit(200))
    erp_records = erp_r.scalars().all()

    # Get existing properties to map columns
    props_r = await db.execute(
        select(NoteDatabaseProperty)
        .where(NoteDatabaseProperty.database_id == obj.id)
        .order_by(NoteDatabaseProperty.sort_order)
    )
    props = props_r.scalars().all()

    # Get current max sort_order
    max_r = await db.execute(
        select(func.max(NoteDatabaseRow.sort_order)).where(NoteDatabaseRow.database_id == obj.id)
    )
    start_order = (max_r.scalar() or 0) + 1

    field_map = ERP_FIELD_MAPS.get(body.source, {})
    imported = 0

    for i, record in enumerate(erp_records):
        values: dict[str, Any] = {}
        for prop in props:
            # Try to map property name to a record field
            erp_field = field_map.get(prop.name, prop.name.lower().replace(" ", "_"))
            val = getattr(record, erp_field, None)
            if val is not None:
                values[str(prop.id)] = str(val) if not isinstance(val, (bool, int, float)) else val

        row = NoteDatabaseRow(
            database_id=obj.id,
            values=values,
            sort_order=start_order + i,
        )
        db.add(row)
        imported += 1

    await db.commit()
    return {"imported": imported, "source": body.source}
