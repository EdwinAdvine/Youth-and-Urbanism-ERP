"""API router for live ERP widget data embedded in Y&U Notes."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/invoice/{entity_id}")
async def get_invoice_widget(
    entity_id: str,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
) -> dict[str, Any]:
    """Get live invoice summary data for embedding in a note."""
    try:
        from app.models.finance import Invoice
        result = await db.execute(select(Invoice).where(Invoice.id == entity_id))
        inv = result.scalar_one_or_none()
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")
        return {
            "widget_type": "invoice_summary",
            "entity_id": str(inv.id),
            "data": {
                "invoice_number": getattr(inv, "invoice_number", str(inv.id)[:8]),
                "status": inv.status,
                "total_amount": float(inv.total_amount) if inv.total_amount else 0,
                "currency": getattr(inv, "currency", "KES"),
                "due_date": str(getattr(inv, "due_date", "")) if getattr(inv, "due_date", None) else None,
                "client_name": getattr(inv, "client_name", None),
                "paid_amount": float(getattr(inv, "paid_amount", 0) or 0),
                "created_at": str(inv.created_at) if inv.created_at else None,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to fetch invoice widget data")
        raise HTTPException(status_code=500, detail=f"Failed to load invoice data: {e}")


@router.get("/project/{entity_id}")
async def get_project_widget(
    entity_id: str,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
) -> dict[str, Any]:
    """Get live project progress data for embedding in a note."""
    try:
        from app.models.projects import Project, Task
        result = await db.execute(select(Project).where(Project.id == entity_id))
        proj = result.scalar_one_or_none()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")

        # Count tasks by status
        task_counts = await db.execute(
            select(Task.status, func.count())
            .where(Task.project_id == proj.id)
            .group_by(Task.status)
        )
        status_map = dict(task_counts.all())
        total_tasks = sum(status_map.values())
        done_tasks = status_map.get("done", 0) + status_map.get("completed", 0)

        return {
            "widget_type": "project_progress",
            "entity_id": str(proj.id),
            "data": {
                "name": proj.name,
                "status": proj.status,
                "progress": round((done_tasks / total_tasks * 100) if total_tasks > 0 else 0),
                "total_tasks": total_tasks,
                "completed_tasks": done_tasks,
                "start_date": str(proj.start_date) if getattr(proj, "start_date", None) else None,
                "end_date": str(proj.end_date) if getattr(proj, "end_date", None) else None,
                "owner": getattr(proj, "owner_name", None),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to fetch project widget data")
        raise HTTPException(status_code=500, detail=f"Failed to load project data: {e}")


@router.get("/deal/{entity_id}")
async def get_deal_widget(
    entity_id: str,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
) -> dict[str, Any]:
    """Get live CRM deal/lead data for embedding in a note."""
    try:
        from app.models.crm import Lead
        result = await db.execute(select(Lead).where(Lead.id == entity_id))
        lead = result.scalar_one_or_none()
        if not lead:
            raise HTTPException(status_code=404, detail="Deal not found")
        return {
            "widget_type": "deal_pipeline",
            "entity_id": str(lead.id),
            "data": {
                "name": getattr(lead, "company_name", lead.name),
                "status": lead.status,
                "stage": getattr(lead, "stage", lead.status),
                "value": float(lead.value) if lead.value else 0,
                "currency": getattr(lead, "currency", "KES"),
                "probability": getattr(lead, "probability", None),
                "expected_close": str(getattr(lead, "expected_close_date", "")) if getattr(lead, "expected_close_date", None) else None,
                "owner": getattr(lead, "owner_name", None),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to fetch deal widget data")
        raise HTTPException(status_code=500, detail=f"Failed to load deal data: {e}")


@router.get("/employee/{entity_id}")
async def get_employee_widget(
    entity_id: str,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
) -> dict[str, Any]:
    """Get employee info card data for embedding in a note."""
    try:
        from app.models.hr import Employee
        result = await db.execute(select(Employee).where(Employee.id == entity_id))
        emp = result.scalar_one_or_none()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        return {
            "widget_type": "employee_card",
            "entity_id": str(emp.id),
            "data": {
                "name": f"{emp.first_name} {emp.last_name}",
                "email": getattr(emp, "work_email", getattr(emp, "email", None)),
                "department": getattr(emp, "department", None),
                "position": getattr(emp, "job_title", getattr(emp, "position", None)),
                "phone": getattr(emp, "phone", None),
                "status": getattr(emp, "status", "active"),
                "avatar_url": getattr(emp, "avatar_url", None),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to fetch employee widget data")
        raise HTTPException(status_code=500, detail=f"Failed to load employee data: {e}")


@router.get("/ticket/{entity_id}")
async def get_ticket_widget(
    entity_id: str,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
) -> dict[str, Any]:
    """Get support ticket status data for embedding in a note."""
    try:
        from app.models.support import Ticket
        result = await db.execute(select(Ticket).where(Ticket.id == entity_id))
        ticket = result.scalar_one_or_none()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        return {
            "widget_type": "ticket_status",
            "entity_id": str(ticket.id),
            "data": {
                "title": ticket.title,
                "status": ticket.status,
                "priority": ticket.priority,
                "category": getattr(ticket, "category", None),
                "assignee": getattr(ticket, "assignee_name", None),
                "created_at": str(ticket.created_at) if ticket.created_at else None,
                "resolved_at": str(getattr(ticket, "resolved_at", "")) if getattr(ticket, "resolved_at", None) else None,
                "sla_due": str(getattr(ticket, "sla_due_at", "")) if getattr(ticket, "sla_due_at", None) else None,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to fetch ticket widget data")
        raise HTTPException(status_code=500, detail=f"Failed to load ticket data: {e}")
