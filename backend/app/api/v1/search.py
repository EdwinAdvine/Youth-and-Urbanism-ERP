"""Global cross-module search endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import or_, select

from app.core.deps import CurrentUser, DBSession
from app.core.sanitize import like_pattern
from app.models.crm import Contact
from app.models.finance import Invoice
from app.models.hr import Employee
from app.models.inventory import InventoryItem
from app.models.projects import Project
from app.models.user import User

router = APIRouter()


@router.get("/")
async def global_search(
    q: str = Query(..., min_length=1, description="Search term"),
    current_user: CurrentUser = None,
    db: DBSession = None,
):
    """Search across modules and return grouped results."""
    term = like_pattern(q)
    results = []

    # Inventory items
    inv_result = await db.execute(
        select(InventoryItem).where(
            InventoryItem.is_active == True,  # noqa: E712
            or_(InventoryItem.name.ilike(term), InventoryItem.sku.ilike(term))
        ).limit(5)
    )
    inv_items = inv_result.scalars().all()
    if inv_items:
        results.append({
            "module": "inventory",
            "label": "Inventory",
            "items": [{"id": str(i.id), "title": i.name, "subtitle": f"SKU: {i.sku}", "link": f"/inventory/items"} for i in inv_items],
        })

    # Employees
    emp_result = await db.execute(
        select(Employee, User)
        .join(User, Employee.user_id == User.id)
        .where(
            Employee.is_active == True,  # noqa: E712
            or_(
                User.full_name.ilike(term),
                Employee.employee_number.ilike(term),
            )
        ).limit(5)
    )
    employees = emp_result.all()
    if employees:
        results.append({
            "module": "hr",
            "label": "Employees",
            "items": [{"id": str(e.Employee.id), "title": e.User.full_name, "subtitle": f"#{e.Employee.employee_number}", "link": f"/hr/employees/{e.Employee.id}"} for e in employees],
        })

    # Contacts (CRM)
    contact_result = await db.execute(
        select(Contact).where(
            Contact.is_active == True,  # noqa: E712
            or_(
                Contact.first_name.ilike(term),
                Contact.last_name.ilike(term),
                Contact.email.ilike(term),
                Contact.company.ilike(term),
            )
        ).limit(5)
    )
    contacts = contact_result.scalars().all()
    if contacts:
        results.append({
            "module": "crm",
            "label": "Contacts",
            "items": [{"id": str(c.id), "title": f"{c.first_name or ''} {c.last_name or ''}".strip() or c.company or c.email, "subtitle": c.email or c.company or "", "link": f"/crm/contacts/{c.id}"} for c in contacts],
        })

    # Invoices
    inv_res = await db.execute(
        select(Invoice).where(
            or_(
                Invoice.invoice_number.ilike(term),
                Invoice.customer_name.ilike(term),
            )
        ).limit(5)
    )
    invoices = inv_res.scalars().all()
    if invoices:
        results.append({
            "module": "finance",
            "label": "Invoices",
            "items": [{"id": str(i.id), "title": i.invoice_number, "subtitle": f"{i.customer_name or ''} — {i.status}", "link": f"/finance/invoices/{i.id}"} for i in invoices],
        })

    # Projects
    proj_result = await db.execute(
        select(Project).where(Project.name.ilike(term)).limit(5)
    )
    projects = proj_result.scalars().all()
    if projects:
        results.append({
            "module": "projects",
            "label": "Projects",
            "items": [{"id": str(p.id), "title": p.name, "subtitle": p.status, "link": f"/projects/{p.id}"} for p in projects],
        })

    return {"query": q, "results": results}
