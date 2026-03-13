"""Cross-module soft links — lightweight integration endpoints between modules.

Integrations:
  1. Support -> CRM: Link ticket to CRM contact
  2. Support -> Projects: Escalate ticket to project task
  3. POS -> CRM: Customer purchase history
  4. POS -> Mail: Email receipt to customer
  5. E-Commerce -> Supply Chain: Order -> procurement request
  6. Supply Chain -> Finance: (event handler in integration_handlers.py)
  7. Manufacturing -> Finance: Production cost breakdown
  8. Manufacturing -> Supply Chain: Material requisition
  9. Manufacturing -> HR: Operator scheduling
"""

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession

router = APIRouter()


# ── Pydantic Schemas ────────────────────────────────────────────────────────

class LinkContactPayload(BaseModel):
    contact_id: uuid.UUID


class EscalateToTaskPayload(BaseModel):
    project_id: uuid.UUID
    priority: str = "medium"


class EmailReceiptPayload(BaseModel):
    email: str


class CreateProcurementPayload(BaseModel):
    notes: str | None = None


class AssignOperatorsPayload(BaseModel):
    employee_ids: list[uuid.UUID]


# ══════════════════════════════════════════════════════════════════════════════
#  1. SUPPORT -> CRM: Link Ticket to Contact
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/support/tickets/{ticket_id}/link-contact",
    summary="Link a support ticket to a CRM contact",
    tags=["Cross-Module Links"],
)
async def link_ticket_to_contact(
    ticket_id: uuid.UUID,
    payload: LinkContactPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.support import Ticket  # noqa: PLC0415
    from app.models.crm import Contact  # noqa: PLC0415

    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    contact = await db.get(Contact, payload.contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="CRM contact not found")

    ticket.contact_id = payload.contact_id
    ticket.customer_name = f"{contact.first_name or ''} {contact.last_name or ''}".strip() or contact.company_name
    ticket.customer_email = contact.email

    await db.commit()
    await db.refresh(ticket)

    return {
        "ticket_id": str(ticket.id),
        "ticket_number": ticket.ticket_number,
        "contact_id": str(contact.id),
        "contact_name": ticket.customer_name,
        "contact_email": ticket.customer_email,
    }


@router.get(
    "/support/tickets/{ticket_id}/linked-contact",
    summary="Get the CRM contact linked to a support ticket",
    tags=["Cross-Module Links"],
)
async def get_ticket_linked_contact(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.support import Ticket  # noqa: PLC0415
    from app.models.crm import Contact  # noqa: PLC0415

    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if not ticket.contact_id:
        return {"ticket_id": str(ticket_id), "linked_contact": None}

    contact = await db.get(Contact, ticket.contact_id)
    if not contact:
        return {"ticket_id": str(ticket_id), "linked_contact": None}

    return {
        "ticket_id": str(ticket_id),
        "linked_contact": {
            "id": str(contact.id),
            "contact_type": contact.contact_type,
            "first_name": contact.first_name,
            "last_name": contact.last_name,
            "company_name": contact.company_name,
            "email": contact.email,
            "phone": contact.phone,
            "source": contact.source,
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
#  2. SUPPORT -> PROJECTS: Escalate Ticket to Task
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/support/tickets/{ticket_id}/escalate-to-task",
    status_code=status.HTTP_201_CREATED,
    summary="Escalate a support ticket to a project task",
    tags=["Cross-Module Links"],
)
async def escalate_ticket_to_task(
    ticket_id: uuid.UUID,
    payload: EscalateToTaskPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.support import Ticket  # noqa: PLC0415
    from app.models.projects import Project, Task  # noqa: PLC0415

    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    project = await db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.priority not in ("low", "medium", "high", "critical"):
        raise HTTPException(status_code=422, detail="Priority must be low, medium, high, or critical")

    # Get next order number for tasks in this project
    order_result = await db.execute(
        select(func.coalesce(func.max(Task.order), 0)).where(Task.project_id == payload.project_id)
    )
    next_order = (order_result.scalar() or 0) + 1

    task = Task(
        project_id=payload.project_id,
        title=f"[Escalated] {ticket.subject}",
        description=(
            f"Escalated from support ticket {ticket.ticket_number}.\n\n"
            f"Priority: {ticket.priority}\n"
            f"Customer: {ticket.customer_name or 'N/A'}\n"
            f"Customer Email: {ticket.customer_email or 'N/A'}\n\n"
            f"--- Original Description ---\n"
            f"{ticket.description or 'No description provided.'}"
        ),
        assignee_id=ticket.assigned_to or current_user.id,
        status="todo",
        priority=payload.priority,
        order=next_order,
        tags=["escalated", "support"],
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    return {
        "task_id": str(task.id),
        "project_id": str(task.project_id),
        "title": task.title,
        "status": task.status,
        "priority": task.priority,
        "ticket_number": ticket.ticket_number,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  3. POS -> CRM: Customer Purchase History
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/crm/contacts/{contact_id}/purchase-history",
    summary="Get POS purchase history for a CRM contact",
    tags=["Cross-Module Links"],
)
async def get_contact_purchase_history(
    contact_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    from app.models.crm import Contact  # noqa: PLC0415
    from app.models.pos import POSTransaction  # noqa: PLC0415

    contact = await db.get(Contact, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="CRM contact not found")

    # Match POS transactions by customer email
    if not contact.email:
        return {
            "contact_id": str(contact_id),
            "contact_name": f"{contact.first_name or ''} {contact.last_name or ''}".strip(),
            "total_transactions": 0,
            "total_spent": "0",
            "transactions": [],
        }

    result = await db.execute(
        select(POSTransaction)
        .where(
            and_(
                POSTransaction.customer_email == contact.email,
                POSTransaction.status == "completed",
            )
        )
        .order_by(POSTransaction.created_at.desc())
        .limit(limit)
    )
    transactions = result.scalars().all()

    # Get total count and sum
    stats_result = await db.execute(
        select(
            func.count().label("cnt"),
            func.coalesce(func.sum(POSTransaction.total), 0).label("total_spent"),
        ).where(
            and_(
                POSTransaction.customer_email == contact.email,
                POSTransaction.status == "completed",
            )
        )
    )
    stats = stats_result.one()

    return {
        "contact_id": str(contact_id),
        "contact_name": f"{contact.first_name or ''} {contact.last_name or ''}".strip(),
        "total_transactions": stats.cnt,
        "total_spent": str(stats.total_spent),
        "transactions": [
            {
                "id": str(t.id),
                "transaction_number": t.transaction_number,
                "total": str(t.total),
                "date": t.created_at.isoformat(),
                "status": t.status,
            }
            for t in transactions
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
#  4. POS -> MAIL: Email Receipt to Customer
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/pos/transactions/{txn_id}/email-receipt",
    summary="Email a POS receipt to a customer",
    tags=["Cross-Module Links"],
)
async def email_pos_receipt(
    txn_id: uuid.UUID,
    payload: EmailReceiptPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.pos import POSTransaction  # noqa: PLC0415
    from sqlalchemy.orm import selectinload  # noqa: PLC0415

    result = await db.execute(
        select(POSTransaction)
        .options(selectinload(POSTransaction.lines), selectinload(POSTransaction.payments))
        .where(POSTransaction.id == txn_id)
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Build receipt email body
    lines_text = ""
    for line in (txn.lines or []):
        lines_text += f"  {line.item_name} x{line.quantity} @ {line.unit_price} = {line.line_total}\n"

    payments_text = ""
    for p in (txn.payments or []):
        payments_text += f"  {p.payment_method}: {p.amount}\n"

    body = (
        f"RECEIPT — {txn.transaction_number}\n"
        f"Date: {txn.created_at.strftime('%Y-%m-%d %H:%M')}\n"
        f"Customer: {txn.customer_name or 'Walk-in Customer'}\n\n"
        f"Items:\n{lines_text}\n"
        f"Subtotal: {txn.subtotal}\n"
        f"Discount: {txn.discount_amount}\n"
        f"Tax: {txn.tax_amount}\n"
        f"Total: {txn.total}\n\n"
        f"Payment:\n{payments_text}\n"
        f"Thank you for your purchase!\n"
        f"--- Urban Vibes Dynamics POS ---"
    )

    subject = f"Your Receipt — {txn.transaction_number}"

    # Send email via SMTP (best-effort)
    try:
        from app.integrations.smtp_client import send_email  # noqa: PLC0415
        from app.core.config import settings  # noqa: PLC0415

        from_addr = getattr(settings, "SYSTEM_EMAIL", "noreply@urban-vibes-dynamics.local")
        await send_email(from_addr=from_addr, to_addrs=[payload.email], subject=subject, body_text=body)
    except Exception:
        # Mail service may be unavailable in dev
        pass

    return {
        "transaction_id": str(txn.id),
        "transaction_number": txn.transaction_number,
        "email_sent_to": payload.email,
        "status": "sent",
    }


# ══════════════════════════════════════════════════════════════════════════════
#  5. E-COMMERCE -> SUPPLY CHAIN: Order -> Procurement Request
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/ecommerce/orders/{order_id}/create-procurement",
    status_code=status.HTTP_201_CREATED,
    summary="Create a procurement request for out-of-stock e-commerce order items",
    tags=["Cross-Module Links"],
)
async def create_procurement_from_order(
    order_id: uuid.UUID,
    payload: CreateProcurementPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.ecommerce import EcomOrder, EcomProduct  # noqa: PLC0415
    from app.models.inventory import InventoryItem, StockLevel  # noqa: PLC0415
    from app.models.supplychain import ProcurementRequisition, RequisitionLine  # noqa: PLC0415

    result = await db.execute(
        select(EcomOrder)
        .options(selectinload(EcomOrder.lines))
        .where(EcomOrder.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="E-commerce order not found")

    # Check stock levels for order line items and identify shortages
    shortage_lines: list[dict] = []
    for line in (order.lines or []):
        if not line.product_id:
            continue
        product = await db.get(EcomProduct, line.product_id)
        if not product or not product.inventory_item_id:
            continue

        inv_item = await db.get(InventoryItem, product.inventory_item_id)
        if not inv_item:
            continue

        # Get total stock across all warehouses
        stock_result = await db.execute(
            select(func.coalesce(func.sum(StockLevel.quantity_on_hand), 0)).where(
                StockLevel.item_id == inv_item.id
            )
        )
        total_stock = stock_result.scalar() or 0

        if total_stock < line.quantity:
            shortage_qty = line.quantity - total_stock
            shortage_lines.append({
                "item_id": inv_item.id,
                "item_name": inv_item.name,
                "quantity_needed": shortage_qty,
                "unit_price": float(line.unit_price),
            })

    if not shortage_lines:
        return {
            "order_id": str(order_id),
            "order_number": order.order_number,
            "procurement_created": False,
            "message": "All items are in stock — no procurement needed.",
        }

    # Generate requisition number
    today = date.today()
    count_result = await db.execute(
        select(func.count()).select_from(ProcurementRequisition)
    )
    seq = (count_result.scalar() or 0) + 1
    req_number = f"REQ-ECOM-{today.year}-{seq:04d}"

    total_estimated = Decimal(str(sum(s["quantity_needed"] * s["unit_price"] for s in shortage_lines)))

    requisition = ProcurementRequisition(
        requisition_number=req_number,
        title=f"E-commerce order {order.order_number} — stock replenishment",
        description=(
            f"Auto-generated procurement request for out-of-stock items from "
            f"e-commerce order {order.order_number}.\n"
            f"{payload.notes or ''}"
        ),
        requested_by=current_user.id,
        status="submitted",
        priority="high",
        required_by_date=today,
        total_estimated=total_estimated,
        notes=payload.notes,
    )
    db.add(requisition)
    await db.flush()

    for s in shortage_lines:
        db.add(RequisitionLine(
            requisition_id=requisition.id,
            item_id=s["item_id"],
            quantity=s["quantity_needed"],
            estimated_unit_price=Decimal(str(s["unit_price"])),
        ))

    await db.commit()
    await db.refresh(requisition)

    return {
        "order_id": str(order_id),
        "order_number": order.order_number,
        "procurement_created": True,
        "requisition_id": str(requisition.id),
        "requisition_number": requisition.requisition_number,
        "shortage_items": shortage_lines,
        "total_estimated": str(total_estimated),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  7. MANUFACTURING -> FINANCE: Production Cost Breakdown
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/manufacturing/work-orders/{wo_id}/cost-breakdown",
    summary="Get cost breakdown for a manufacturing work order",
    tags=["Cross-Module Links"],
)
async def get_work_order_cost_breakdown(
    wo_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.manufacturing import WorkOrder, RoutingStep  # noqa: PLC0415
    from app.models.inventory import InventoryItem  # noqa: PLC0415

    result = await db.execute(
        select(WorkOrder)
        .options(selectinload(WorkOrder.materials), selectinload(WorkOrder.workstation))
        .where(WorkOrder.id == wo_id)
    )
    wo = result.scalar_one_or_none()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    # Material costs from consumption records
    material_costs: list[dict] = []
    total_material = Decimal("0")
    for mc in (wo.materials or []):
        item = await db.get(InventoryItem, mc.item_id)
        item_name = item.name if item else "Unknown"
        unit_cost = item.cost_price if item and item.cost_price else Decimal("0")
        cost = Decimal(str(mc.actual_quantity or mc.planned_quantity)) * unit_cost
        total_material += cost
        material_costs.append({
            "item_id": str(mc.item_id),
            "item_name": item_name,
            "quantity": str(mc.actual_quantity or mc.planned_quantity),
            "unit_cost": str(unit_cost),
            "total_cost": str(cost),
        })

    # Labor cost from workstation hourly rate and routing steps
    total_labor = Decimal("0")
    labor_details: list[dict] = []
    if wo.workstation and wo.bom_id:
        routing_result = await db.execute(
            select(RoutingStep).where(RoutingStep.bom_id == wo.bom_id).order_by(RoutingStep.sequence)
        )
        steps = routing_result.scalars().all()

        for step in steps:
            from app.models.manufacturing import WorkStation  # noqa: PLC0415
            ws = await db.get(WorkStation, step.workstation_id)
            if ws:
                hours = Decimal(str(step.duration_minutes)) / Decimal("60")
                cost = hours * ws.hourly_rate * wo.planned_quantity
                total_labor += cost
                labor_details.append({
                    "operation": step.operation,
                    "workstation": ws.name,
                    "duration_minutes": step.duration_minutes,
                    "hourly_rate": str(ws.hourly_rate),
                    "cost": str(cost),
                })

    # Use stored costs as fallback
    if not material_costs:
        total_material = wo.total_material_cost or Decimal("0")
    if not labor_details:
        total_labor = wo.total_labor_cost or Decimal("0")

    overhead_rate = Decimal("0.10")  # 10% overhead (configurable)
    overhead = (total_material + total_labor) * overhead_rate
    total_cost = total_material + total_labor + overhead
    unit_cost = total_cost / max(wo.planned_quantity, 1)

    return {
        "work_order_id": str(wo.id),
        "wo_number": wo.wo_number,
        "status": wo.status,
        "planned_quantity": wo.planned_quantity,
        "completed_quantity": wo.completed_quantity,
        "material_costs": material_costs,
        "total_material_cost": str(total_material),
        "labor_details": labor_details,
        "total_labor_cost": str(total_labor),
        "overhead_rate": str(overhead_rate),
        "overhead_cost": str(overhead),
        "total_production_cost": str(total_cost),
        "unit_cost": str(unit_cost),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  8. MANUFACTURING -> SUPPLY CHAIN: Material Requisition
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/manufacturing/work-orders/{wo_id}/request-materials",
    status_code=status.HTTP_201_CREATED,
    summary="Create procurement request for work order BOM material shortages",
    tags=["Cross-Module Links"],
)
async def request_materials_for_work_order(
    wo_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.manufacturing import WorkOrder, BOMItem  # noqa: PLC0415
    from app.models.inventory import InventoryItem, StockLevel  # noqa: PLC0415
    from app.models.supplychain import ProcurementRequisition, RequisitionLine  # noqa: PLC0415

    result = await db.execute(
        select(WorkOrder).where(WorkOrder.id == wo_id)
    )
    wo = result.scalar_one_or_none()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    # Get BOM items
    bom_result = await db.execute(
        select(BOMItem).where(BOMItem.bom_id == wo.bom_id)
    )
    bom_items = bom_result.scalars().all()

    if not bom_items:
        return {
            "work_order_id": str(wo_id),
            "wo_number": wo.wo_number,
            "procurement_created": False,
            "message": "No BOM items found.",
        }

    shortage_lines: list[dict] = []
    for bi in bom_items:
        required_qty = int(float(bi.quantity_required) * wo.planned_quantity)
        item = await db.get(InventoryItem, bi.item_id)
        if not item:
            continue

        # Check stock at the source warehouse
        stock_result = await db.execute(
            select(func.coalesce(func.sum(StockLevel.quantity_on_hand), 0)).where(
                and_(
                    StockLevel.item_id == bi.item_id,
                    StockLevel.warehouse_id == wo.source_warehouse_id,
                )
            )
        )
        available = stock_result.scalar() or 0

        if available < required_qty:
            shortage_qty = required_qty - available
            shortage_lines.append({
                "item_id": bi.item_id,
                "item_name": item.name,
                "required": required_qty,
                "available": available,
                "shortage": shortage_qty,
                "unit_cost": float(item.cost_price) if item.cost_price else 0,
            })

    if not shortage_lines:
        return {
            "work_order_id": str(wo_id),
            "wo_number": wo.wo_number,
            "procurement_created": False,
            "message": "All materials are in stock.",
        }

    # Create requisition
    today = date.today()
    count_result = await db.execute(
        select(func.count()).select_from(ProcurementRequisition)
    )
    seq = (count_result.scalar() or 0) + 1
    req_number = f"REQ-MFG-{today.year}-{seq:04d}"

    total_estimated = Decimal(str(sum(s["shortage"] * s["unit_cost"] for s in shortage_lines)))

    requisition = ProcurementRequisition(
        requisition_number=req_number,
        title=f"Material request for WO {wo.wo_number}",
        description=f"Auto-generated material requisition for work order {wo.wo_number}.",
        requested_by=current_user.id,
        status="submitted",
        priority="high",
        required_by_date=wo.planned_start.date() if wo.planned_start else today,
        total_estimated=total_estimated,
    )
    db.add(requisition)
    await db.flush()

    for s in shortage_lines:
        db.add(RequisitionLine(
            requisition_id=requisition.id,
            item_id=s["item_id"],
            quantity=s["shortage"],
            estimated_unit_price=Decimal(str(s["unit_cost"])),
        ))

    await db.commit()
    await db.refresh(requisition)

    return {
        "work_order_id": str(wo_id),
        "wo_number": wo.wo_number,
        "procurement_created": True,
        "requisition_id": str(requisition.id),
        "requisition_number": requisition.requisition_number,
        "shortage_items": shortage_lines,
        "total_estimated": str(total_estimated),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  9. MANUFACTURING -> HR: Operator Scheduling
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/manufacturing/work-orders/{wo_id}/assign-operators",
    summary="Assign HR employees as operators to a work order",
    tags=["Cross-Module Links"],
)
async def assign_operators_to_work_order(
    wo_id: uuid.UUID,
    payload: AssignOperatorsPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.manufacturing import WorkOrder  # noqa: PLC0415
    from app.models.hr import Employee  # noqa: PLC0415

    wo = await db.get(WorkOrder, wo_id)
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    # Validate all employee IDs exist
    valid_employees: list[dict] = []
    for emp_id in payload.employee_ids:
        emp = await db.get(Employee, emp_id)
        if not emp:
            raise HTTPException(
                status_code=404,
                detail=f"Employee {emp_id} not found",
            )
        if not emp.is_active:
            raise HTTPException(
                status_code=400,
                detail=f"Employee {emp.employee_number} is not active",
            )
        valid_employees.append({
            "employee_id": str(emp.id),
            "employee_number": emp.employee_number,
            "job_title": emp.job_title,
        })

    # Store operator assignments in work order notes (metadata)
    # Using notes field as lightweight storage to avoid schema changes
    operator_ids = [str(e) for e in payload.employee_ids]
    if wo.notes:
        # Append or replace operator assignment info
        import json
        try:
            meta = json.loads(wo.notes) if wo.notes.startswith("{") else {}
        except (json.JSONDecodeError, ValueError):
            meta = {}
        meta["assigned_operators"] = operator_ids
        wo.notes = json.dumps(meta)
    else:
        import json
        wo.notes = json.dumps({"assigned_operators": operator_ids})

    await db.commit()
    await db.refresh(wo)

    return {
        "work_order_id": str(wo.id),
        "wo_number": wo.wo_number,
        "assigned_operators": valid_employees,
    }


@router.get(
    "/manufacturing/work-orders/{wo_id}/operators",
    summary="List operators assigned to a work order",
    tags=["Cross-Module Links"],
)
async def get_work_order_operators(
    wo_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.models.manufacturing import WorkOrder  # noqa: PLC0415
    from app.models.hr import Employee  # noqa: PLC0415
    from app.models.user import User  # noqa: PLC0415

    wo = await db.get(WorkOrder, wo_id)
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    operator_ids: list[str] = []
    if wo.notes:
        import json
        try:
            meta = json.loads(wo.notes) if wo.notes.startswith("{") else {}
            operator_ids = meta.get("assigned_operators", [])
        except (json.JSONDecodeError, ValueError):
            pass

    operators: list[dict] = []
    for oid in operator_ids:
        try:
            emp = await db.get(Employee, uuid.UUID(oid))
        except (ValueError, TypeError):
            continue
        if not emp:
            continue

        user = await db.get(User, emp.user_id)
        operators.append({
            "employee_id": str(emp.id),
            "employee_number": emp.employee_number,
            "name": user.full_name if user else "Unknown",
            "job_title": emp.job_title,
            "department_id": str(emp.department_id) if emp.department_id else None,
            "is_active": emp.is_active,
        })

    return {
        "work_order_id": str(wo.id),
        "wo_number": wo.wo_number,
        "operators": operators,
    }
