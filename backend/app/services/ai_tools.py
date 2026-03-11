"""AI tool definitions and executor for cross-module actions."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.sanitize import like_pattern

logger = logging.getLogger(__name__)

# ── Tool definitions (OpenAI function-calling format) ────────────────────────

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "create_calendar_event",
            "description": "Create a calendar event",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Event title"},
                    "start_time": {
                        "type": "string",
                        "description": "Start time in ISO 8601 datetime format",
                    },
                    "end_time": {
                        "type": "string",
                        "description": "End time in ISO 8601 datetime format",
                    },
                    "event_type": {
                        "type": "string",
                        "enum": ["meeting", "task", "reminder"],
                        "default": "meeting",
                        "description": "Type of calendar event",
                    },
                    "description": {
                        "type": "string",
                        "description": "Optional event description",
                    },
                },
                "required": ["title", "start_time", "end_time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_email",
            "description": "Send an email",
            "parameters": {
                "type": "object",
                "properties": {
                    "to": {
                        "type": "string",
                        "format": "email",
                        "description": "Recipient email address",
                    },
                    "subject": {"type": "string", "description": "Email subject line"},
                    "body": {"type": "string", "description": "Email body text"},
                },
                "required": ["to", "subject", "body"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_note",
            "description": "Create a personal note",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Note title"},
                    "content": {
                        "type": "string",
                        "description": "Note content (optional)",
                    },
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional tags for the note",
                    },
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_meetings",
            "description": "List upcoming meetings",
            "parameters": {
                "type": "object",
                "properties": {
                    "days_ahead": {
                        "type": "integer",
                        "default": 7,
                        "description": "Number of days ahead to search for meetings",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_files",
            "description": "Search files in Drive",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query to match against file names",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": "Create a project task",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_name": {
                        "type": "string",
                        "description": "Name of the project to add the task to",
                    },
                    "title": {"type": "string", "description": "Task title"},
                    "priority": {
                        "type": "string",
                        "enum": ["low", "medium", "high"],
                        "default": "medium",
                        "description": "Task priority level",
                    },
                },
                "required": ["project_name", "title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_invoice",
            "description": "Create a sales invoice",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_name": {"type": "string", "description": "Customer name"},
                    "customer_email": {"type": "string", "description": "Customer email"},
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "description": {"type": "string"},
                                "quantity": {"type": "number"},
                                "unit_price": {"type": "number"},
                            },
                        },
                        "description": "Line items (description, quantity, unit_price)",
                    },
                    "due_days": {
                        "type": "integer",
                        "default": 30,
                        "description": "Days until payment due",
                    },
                },
                "required": ["customer_name", "items"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_employee",
            "description": "Look up an employee by name or employee number",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Employee name or employee number to search"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_leave_balance",
            "description": "Check leave balance for an employee",
            "parameters": {
                "type": "object",
                "properties": {
                    "employee_number": {"type": "string", "description": "Employee number"},
                },
                "required": ["employee_number"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_lead",
            "description": "Create a CRM lead",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Lead title"},
                    "contact_name": {"type": "string", "description": "Contact name"},
                    "contact_email": {"type": "string", "description": "Contact email"},
                    "estimated_value": {"type": "number", "description": "Estimated deal value"},
                    "source": {"type": "string", "description": "Lead source (website, referral, cold_call)"},
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pipeline_summary",
            "description": "Get CRM pipeline summary with deals grouped by stage",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_revenue_summary",
            "description": "Get finance revenue summary for the current month",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_inventory",
            "description": "Search inventory items by name or SKU",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Item name or SKU to search for"},
                    "limit": {"type": "integer", "description": "Max results to return", "default": 5},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_stock_level",
            "description": "Get stock levels for a specific inventory item across all warehouses",
            "parameters": {
                "type": "object",
                "properties": {
                    "sku": {"type": "string", "description": "The SKU of the item"},
                    "item_name": {"type": "string", "description": "Item name (used if SKU not provided)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_purchase_order",
            "description": "Create a draft purchase order for inventory restocking",
            "parameters": {
                "type": "object",
                "properties": {
                    "supplier_name": {"type": "string", "description": "Supplier company name"},
                    "supplier_email": {"type": "string", "description": "Supplier email (optional)"},
                    "items": {
                        "type": "array",
                        "description": "List of items to order",
                        "items": {
                            "type": "object",
                            "properties": {
                                "sku": {"type": "string", "description": "Item SKU"},
                                "quantity": {"type": "integer", "description": "Quantity to order"},
                                "unit_price": {"type": "number", "description": "Price per unit"},
                            },
                            "required": ["sku", "quantity", "unit_price"],
                        },
                    },
                },
                "required": ["supplier_name", "items"],
            },
        },
    },
    # ── Document generation tool ─────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "generate_document",
            "description": "Generate a document (.docx or .xlsx) and save it to the user's Drive",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Document title"},
                    "format": {
                        "type": "string",
                        "enum": ["docx", "xlsx"],
                        "description": "Output format: docx for Word, xlsx for Excel",
                    },
                    "content": {
                        "type": "string",
                        "description": "For docx: the document body text (paragraphs separated by double newlines). Required for docx.",
                    },
                    "data": {
                        "type": "array",
                        "description": "For xlsx: rows of data. First row should be headers. Each row is an array of values.",
                        "items": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                    },
                },
                "required": ["title", "format"],
            },
        },
    },
    # ── Summarization tools ────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "summarize_email",
            "description": "Summarize an email message by its ID",
            "parameters": {
                "type": "object",
                "properties": {
                    "message_id": {"type": "string", "description": "The email message ID to summarize"},
                },
                "required": ["message_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "summarize_meeting",
            "description": "Summarize a calendar event / meeting by its ID",
            "parameters": {
                "type": "object",
                "properties": {
                    "event_id": {"type": "string", "description": "The calendar event ID to summarize"},
                },
                "required": ["event_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "summarize_note",
            "description": "Summarize a note by its ID",
            "parameters": {
                "type": "object",
                "properties": {
                    "note_id": {"type": "string", "description": "The note ID to summarize"},
                },
                "required": ["note_id"],
            },
        },
    },
]


ADMIN_TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "create_user",
            "description": "Create a new user account (super-admin only)",
            "parameters": {
                "type": "object",
                "properties": {
                    "email": {"type": "string", "format": "email", "description": "User email address"},
                    "full_name": {"type": "string", "description": "User full name"},
                    "role": {
                        "type": "string",
                        "enum": ["user", "admin"],
                        "default": "user",
                        "description": "User role (user or admin)",
                    },
                },
                "required": ["email", "full_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "assign_role",
            "description": "Assign a role to a user by email (super-admin only)",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_email": {"type": "string", "format": "email", "description": "Target user email"},
                    "role_name": {"type": "string", "description": "Role name to assign"},
                },
                "required": ["user_email", "role_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "make_app_admin",
            "description": "Make a user an app admin for a specific module (super-admin only)",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_email": {"type": "string", "format": "email", "description": "Target user email"},
                    "app_name": {
                        "type": "string",
                        "description": "Application module name (e.g. finance, hr, crm, inventory, projects)",
                    },
                },
                "required": ["user_email", "app_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "deactivate_user",
            "description": "Deactivate a user account by email (super-admin only)",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_email": {"type": "string", "format": "email", "description": "User email to deactivate"},
                },
                "required": ["user_email"],
            },
        },
    },
    # ── Support / Customer Center tools ─────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "lookup_ticket",
            "description": "Look up a support ticket by ticket number or keyword",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Ticket number or keyword to search"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_support_summary",
            "description": "Get a summary of open/pending support tickets and SLA status",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_knowledge_base",
            "description": "Search published knowledge base articles",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search keywords"},
                },
                "required": ["query"],
            },
        },
    },
    # ── Supply Chain tools ──────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "lookup_supplier",
            "description": "Look up a supplier by name or code",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Supplier name or code"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_procurement_status",
            "description": "Get summary of pending requisitions, open GRNs, and returns",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    # ── Manufacturing tools ─────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "check_bom_cost",
            "description": "Calculate the total cost of a Bill of Materials by name",
            "parameters": {
                "type": "object",
                "properties": {
                    "bom_name": {"type": "string", "description": "Name of the BOM"},
                },
                "required": ["bom_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_production_summary",
            "description": "Get summary of active work orders, completion rates, and output",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_material_availability",
            "description": "Check if materials are available for a specific BOM",
            "parameters": {
                "type": "object",
                "properties": {
                    "bom_name": {"type": "string", "description": "Name of the BOM to check"},
                    "quantity": {"type": "integer", "description": "Number of units to produce", "default": 1},
                },
                "required": ["bom_name"],
            },
        },
    },
    # ── POS tools ──────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "get_pos_daily_summary",
            "description": "Get today's POS sales summary including total revenue and transaction count",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_pos_transaction",
            "description": "Look up a POS transaction by receipt number",
            "parameters": {
                "type": "object",
                "properties": {
                    "receipt_number": {"type": "string", "description": "Receipt or transaction number"},
                },
                "required": ["receipt_number"],
            },
        },
    },
    # ── E-Commerce tools ───────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "get_ecommerce_sales_summary",
            "description": "Get e-commerce sales summary: orders, revenue, top products",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_order",
            "description": "Look up an e-commerce order by order number",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_number": {"type": "string", "description": "Order number to look up"},
                },
                "required": ["order_number"],
            },
        },
    },
]


class ToolExecutor:
    """Executes AI tool calls against the database and services."""

    def __init__(self, db: AsyncSession, user_id: uuid.UUID, user: Any | None = None):
        self.db = db
        self.user_id = user_id
        self.user = user  # Full User ORM object (needed for admin tool checks)

    async def execute(self, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Dispatch a tool call to the appropriate handler. Returns result dict."""
        handler = getattr(self, f"_exec_{tool_name}", None)
        if not handler:
            return {"error": f"Unknown tool: {tool_name}"}
        try:
            return await handler(**arguments)
        except Exception as e:
            logger.error("Tool %s failed: %s", tool_name, e)
            return {"error": str(e)}

    # ── Tool handlers ────────────────────────────────────────────────────────

    async def _exec_create_calendar_event(
        self,
        title: str,
        start_time: str,
        end_time: str,
        event_type: str = "meeting",
        description: str | None = None,
    ) -> dict[str, Any]:
        from app.models.calendar import CalendarEvent  # noqa: PLC0415

        event = CalendarEvent(
            title=title,
            start_time=datetime.fromisoformat(start_time),
            end_time=datetime.fromisoformat(end_time),
            event_type=event_type,
            description=description,
            owner_id=self.user_id,
        )
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)
        return {"status": "created", "event_id": str(event.id), "title": title}

    async def _exec_send_email(
        self, to: str, subject: str, body: str
    ) -> dict[str, Any]:
        from app.tasks.celery_app import send_email  # noqa: PLC0415

        send_email.delay(to=to, subject=subject, body=body, from_email=None)
        return {"status": "queued", "to": to}

    async def _exec_create_note(
        self,
        title: str,
        content: str | None = None,
        tags: list[str] | None = None,
    ) -> dict[str, Any]:
        from app.models.notes import Note  # noqa: PLC0415

        note = Note(
            title=title,
            content=content or "",
            tags=tags or [],
            owner_id=self.user_id,
        )
        self.db.add(note)
        await self.db.commit()
        await self.db.refresh(note)
        return {"status": "created", "note_id": str(note.id), "title": title}

    async def _exec_list_meetings(self, days_ahead: int = 7) -> dict[str, Any]:
        from app.models.calendar import CalendarEvent  # noqa: PLC0415

        now = datetime.now(timezone.utc)
        cutoff = now + timedelta(days=days_ahead)

        result = await self.db.execute(
            select(CalendarEvent).where(
                CalendarEvent.event_type == "meeting",
                CalendarEvent.start_time > now,
                CalendarEvent.start_time < cutoff,
                CalendarEvent.owner_id == self.user_id,
            )
        )
        events = result.scalars().all()
        return {
            "meetings": [
                {
                    "title": e.title,
                    "start": e.start_time.isoformat(),
                    "end": e.end_time.isoformat(),
                }
                for e in events
            ]
        }

    async def _exec_search_files(self, query: str) -> dict[str, Any]:
        from app.models.drive import DriveFile  # noqa: PLC0415

        result = await self.db.execute(
            select(DriveFile).where(
                DriveFile.name.ilike(like_pattern(query)),
                DriveFile.owner_id == self.user_id,
            )
        )
        files = result.scalars().all()
        return {
            "files": [
                {
                    "name": f.name,
                    "size": f.size,
                    "content_type": f.content_type,
                }
                for f in files
            ]
        }

    async def _exec_create_task(
        self,
        project_name: str,
        title: str,
        priority: str = "medium",
    ) -> dict[str, Any]:
        from app.models.projects import Project, Task  # noqa: PLC0415

        result = await self.db.execute(
            select(Project).where(
                Project.name.ilike(like_pattern(project_name)),
                Project.owner_id == self.user_id,
            )
        )
        project = result.scalar_one_or_none()
        if not project:
            return {"error": f"Project '{project_name}' not found"}

        task = Task(
            title=title,
            priority=priority,
            project_id=project.id,
        )
        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)
        return {"status": "created", "task_id": str(task.id), "project": project.name}

    # ── Finance tools ─────────────────────────────────────────────────────

    async def _exec_create_invoice(
        self,
        customer_name: str,
        items: list[dict[str, Any]],
        customer_email: str | None = None,
        due_days: int = 30,
    ) -> dict[str, Any]:
        from app.models.finance import Invoice  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415
        from datetime import date  # noqa: PLC0415

        today = date.today()
        count_q = select(func.count()).select_from(Invoice)
        count_result = await self.db.execute(count_q)
        seq = (count_result.scalar() or 0) + 1
        inv_number = f"INV-{today.year}-{seq:04d}"

        subtotal = sum(
            (item.get("quantity", 1) * item.get("unit_price", 0)) for item in items
        )

        invoice = Invoice(
            invoice_number=inv_number,
            invoice_type="sales",
            status="draft",
            customer_name=customer_name,
            customer_email=customer_email,
            issue_date=today,
            due_date=today + timedelta(days=due_days),
            subtotal=subtotal,
            total=subtotal,
            items=items,
            owner_id=self.user_id,
        )
        self.db.add(invoice)
        await self.db.commit()
        await self.db.refresh(invoice)
        return {
            "status": "created",
            "invoice_number": inv_number,
            "total": float(subtotal),
            "customer": customer_name,
        }

    # ── HR tools ──────────────────────────────────────────────────────────

    async def _exec_lookup_employee(self, query: str) -> dict[str, Any]:
        from app.models.hr import Employee  # noqa: PLC0415
        from app.models.user import User  # noqa: PLC0415
        from sqlalchemy.orm import selectinload  # noqa: PLC0415

        result = await self.db.execute(
            select(Employee).join(User, Employee.user_id == User.id).where(
                (Employee.employee_number.ilike(like_pattern(query)))
                | (User.full_name.ilike(like_pattern(query)))
            ).limit(5)
        )
        employees = result.scalars().all()
        if not employees:
            return {"error": f"No employees found matching '{query}'"}

        items = []
        for emp in employees:
            user_q = await self.db.execute(select(User).where(User.id == emp.user_id))
            user = user_q.scalar_one_or_none()
            items.append({
                "employee_number": emp.employee_number,
                "name": user.full_name if user else "Unknown",
                "job_title": emp.job_title,
                "department_id": str(emp.department_id) if emp.department_id else None,
                "is_active": emp.is_active,
            })
        return {"employees": items}

    async def _exec_check_leave_balance(self, employee_number: str) -> dict[str, Any]:
        from app.models.hr import Employee, LeaveRequest  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415

        emp_q = await self.db.execute(
            select(Employee).where(Employee.employee_number == employee_number)
        )
        employee = emp_q.scalar_one_or_none()
        if not employee:
            return {"error": f"Employee '{employee_number}' not found"}

        used_q = select(func.coalesce(func.sum(LeaveRequest.days), 0)).where(
            LeaveRequest.employee_id == employee.id,
            LeaveRequest.status == "approved",
        )
        used_result = await self.db.execute(used_q)
        used_days = float(used_result.scalar() or 0)
        annual_allocation = 21.0

        return {
            "employee_number": employee_number,
            "annual_allocation": annual_allocation,
            "used_days": used_days,
            "remaining_days": annual_allocation - used_days,
        }

    # ── CRM tools ─────────────────────────────────────────────────────────

    async def _exec_create_lead(
        self,
        title: str,
        contact_name: str | None = None,
        contact_email: str | None = None,
        estimated_value: float | None = None,
        source: str | None = None,
    ) -> dict[str, Any]:
        from app.models.crm import Lead, Contact  # noqa: PLC0415

        contact_id = None
        if contact_name or contact_email:
            contact = Contact(
                contact_type="person",
                first_name=contact_name.split()[0] if contact_name else None,
                last_name=" ".join(contact_name.split()[1:]) if contact_name and len(contact_name.split()) > 1 else None,
                email=contact_email,
                owner_id=self.user_id,
            )
            self.db.add(contact)
            await self.db.flush()
            contact_id = contact.id

        lead = Lead(
            title=title,
            contact_id=contact_id,
            source=source,
            estimated_value=estimated_value,
            owner_id=self.user_id,
        )
        self.db.add(lead)
        await self.db.commit()
        await self.db.refresh(lead)
        return {"status": "created", "lead_id": str(lead.id), "title": title}

    async def _exec_get_pipeline_summary(self) -> dict[str, Any]:
        from app.models.crm import Opportunity  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415

        result = await self.db.execute(
            select(
                Opportunity.stage,
                func.count(),
                func.coalesce(func.sum(Opportunity.expected_value), 0),
            ).group_by(Opportunity.stage)
        )
        stages = []
        total_value = 0
        for stage, count, value in result.all():
            stages.append({"stage": stage, "count": count, "value": float(value)})
            total_value += float(value)

        return {"stages": stages, "total_pipeline_value": total_value}

    async def _exec_get_revenue_summary(self) -> dict[str, Any]:
        from app.models.finance import Invoice, Payment  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415
        from datetime import date  # noqa: PLC0415

        today = date.today()
        month_start = today.replace(day=1)

        revenue_q = select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.status == "completed",
            Payment.payment_date >= month_start,
        )
        revenue = float((await self.db.execute(revenue_q)).scalar() or 0)

        outstanding_q = select(
            func.count(), func.coalesce(func.sum(Invoice.total), 0)
        ).where(Invoice.status.in_(["sent", "overdue"]))
        outstanding_count, outstanding_amount = (await self.db.execute(outstanding_q)).one()

        return {
            "revenue_mtd": revenue,
            "outstanding_invoices": outstanding_count,
            "outstanding_amount": float(outstanding_amount),
            "period": f"{month_start.isoformat()} to {today.isoformat()}",
        }

    # ── Inventory tools ───────────────────────────────────────────────────────

    async def _exec_lookup_inventory(
        self,
        query: str,
        limit: int = 5,
    ) -> dict[str, Any]:
        from app.models.inventory import InventoryItem  # noqa: PLC0415
        from sqlalchemy import or_  # noqa: PLC0415

        result = await self.db.execute(
            select(InventoryItem)
            .where(
                InventoryItem.is_active == True,  # noqa: E712
                or_(
                    InventoryItem.name.ilike(like_pattern(query)),
                    InventoryItem.sku.ilike(like_pattern(query)),
                ),
            )
            .limit(limit)
        )
        items = result.scalars().all()
        if not items:
            return {"result": f"No inventory items found matching '{query}'."}
        lines = [
            f"- {i.name} (SKU: {i.sku}, Category: {i.category or 'N/A'}, Sell: {i.selling_price})"
            for i in items
        ]
        return {"result": f"Found {len(items)} items:\n" + "\n".join(lines)}

    async def _exec_check_stock_level(
        self,
        sku: str = "",
        item_name: str = "",
    ) -> dict[str, Any]:
        from app.models.inventory import InventoryItem, StockLevel, Warehouse  # noqa: PLC0415
        from sqlalchemy import or_  # noqa: PLC0415

        conditions = []
        if sku:
            conditions.append(InventoryItem.sku.ilike(like_pattern(sku)))
        if item_name:
            conditions.append(InventoryItem.name.ilike(like_pattern(item_name)))
        if not conditions:
            return {"result": "Please provide either a SKU or item name."}
        item_result = await self.db.execute(
            select(InventoryItem)
            .where(or_(*conditions), InventoryItem.is_active == True)  # noqa: E712
            .limit(1)
        )
        item = item_result.scalar_one_or_none()
        if not item:
            return {"result": f"No item found with SKU '{sku}' or name '{item_name}'."}
        sl_result = await self.db.execute(
            select(StockLevel, Warehouse)
            .join(Warehouse, StockLevel.warehouse_id == Warehouse.id)
            .where(StockLevel.item_id == item.id)
        )
        rows = sl_result.all()
        if not rows:
            return {"result": f"No stock records for {item.name} (SKU: {item.sku}). It may not be in any warehouse yet."}
        total = sum(r.StockLevel.quantity_on_hand for r in rows)
        lines = [f"- {r.Warehouse.name}: {r.StockLevel.quantity_on_hand} {item.unit_of_measure}" for r in rows]
        status = "LOW STOCK" if total <= item.reorder_level else "OK"
        return {
            "result": (
                f"{item.name} (SKU: {item.sku}) — Total: {total} {item.unit_of_measure} [{status}]\n"
                f"Reorder level: {item.reorder_level}\n"
                + "\n".join(lines)
            )
        }

    async def _exec_create_purchase_order(
        self,
        supplier_name: str,
        items: list[dict[str, Any]],
        supplier_email: str | None = None,
    ) -> dict[str, Any]:
        from datetime import date  # noqa: PLC0415
        from app.models.inventory import InventoryItem, PurchaseOrder, PurchaseOrderLine  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415

        if not items:
            return {"error": "No items specified for the purchase order."}
        year = date.today().year
        count_result = await self.db.execute(
            select(func.count()).select_from(PurchaseOrder).where(
                PurchaseOrder.po_number.like(f"PO-{year}-%")
            )
        )
        seq = (count_result.scalar() or 0) + 1
        po_number = f"PO-{year}-{seq:04d}"
        po_lines = []
        total = 0.0
        for item_data in items:
            item_result = await self.db.execute(
                select(InventoryItem).where(InventoryItem.sku == item_data["sku"])
            )
            inv_item = item_result.scalar_one_or_none()
            if not inv_item:
                return {"error": f"Item with SKU '{item_data['sku']}' not found."}
            line_total = item_data["quantity"] * item_data["unit_price"]
            total += line_total
            po_lines.append(PurchaseOrderLine(
                item_id=inv_item.id,
                quantity=item_data["quantity"],
                unit_price=item_data["unit_price"],
                received_quantity=0,
            ))
        po = PurchaseOrder(
            po_number=po_number,
            supplier_name=supplier_name,
            supplier_email=supplier_email,
            status="draft",
            order_date=date.today(),
            total=total,
            owner_id=str(self.user_id),
        )
        self.db.add(po)
        await self.db.flush()
        for line in po_lines:
            line.purchase_order_id = po.id
            self.db.add(line)
        await self.db.commit()
        return {
            "status": "created",
            "po_number": po_number,
            "supplier": supplier_name,
            "total": total,
            "item_count": len(po_lines),
            "result": f"Draft PO {po_number} created for {supplier_name}. Total: {total:,.2f}. Items: {len(po_lines)}. Navigate to /inventory/purchase-orders to send it.",
        }

    # ── Document generation tool ──────────────────────────────────────────

    async def _exec_generate_document(
        self,
        title: str,
        format: str,
        content: str | None = None,
        data: list[list[Any]] | None = None,
    ) -> dict[str, Any]:
        from app.services.docgen import docgen_svc  # noqa: PLC0415

        if format == "docx":
            if not content:
                return {"error": "Content is required for .docx generation."}
            result = await docgen_svc.generate_docx(
                title=title,
                content=content,
                user_id=self.user_id,
                db=self.db,
            )
            return {
                "status": "created",
                "format": "docx",
                **result,
                "result": f"Document '{result['file_name']}' created. Download: {result['download_url']}",
            }
        elif format == "xlsx":
            if not data:
                return {"error": "Data (rows) is required for .xlsx generation."}
            result = await docgen_svc.generate_xlsx(
                title=title,
                data=data,
                user_id=self.user_id,
                db=self.db,
            )
            return {
                "status": "created",
                "format": "xlsx",
                **result,
                "result": f"Spreadsheet '{result['file_name']}' created. Download: {result['download_url']}",
            }
        else:
            return {"error": f"Unsupported format: {format}. Use 'docx' or 'xlsx'."}

    # ── Summarization tools ───────────────────────────────────────────────

    async def _summarize_via_llm(self, text_to_summarize: str, item_type: str) -> str:
        """Send text to the LLM with a summarization prompt and return the summary."""
        import httpx  # noqa: PLC0415
        from app.core.config import settings  # noqa: PLC0415

        prompt = (
            f"Please provide a concise summary of the following {item_type}. "
            "Include the key points, action items, and any important details. "
            "Keep the summary to 3-5 sentences.\n\n"
            f"{text_to_summarize}"
        )
        url = f"{settings.OLLAMA_URL.rstrip('/')}/api/chat"
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                url,
                json={
                    "model": settings.OLLAMA_MODEL,
                    "messages": [
                        {"role": "system", "content": "You are a helpful summarization assistant."},
                        {"role": "user", "content": prompt},
                    ],
                    "stream": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()
        return data.get("message", {}).get("content", "Could not generate summary.")

    async def _exec_summarize_email(self, message_id: str) -> dict[str, Any]:
        """Summarize an email. Attempts to fetch from Stalwart; falls back to a
        placeholder if the mail integration is unavailable."""
        import httpx  # noqa: PLC0415
        from app.core.config import settings  # noqa: PLC0415

        # Try to fetch email via Stalwart JMAP endpoint
        try:
            jmap_url = f"{settings.STALWART_URL.rstrip('/')}/jmap"
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    jmap_url,
                    json={
                        "using": ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
                        "methodCalls": [
                            [
                                "Email/get",
                                {
                                    "accountId": "default",
                                    "ids": [message_id],
                                    "properties": ["subject", "from", "to", "textBody", "bodyValues"],
                                    "fetchTextBodyValues": True,
                                },
                                "0",
                            ]
                        ],
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                emails = data.get("methodResponses", [[None, {}]])[0][1].get("list", [])
                if emails:
                    email = emails[0]
                    subject = email.get("subject", "No subject")
                    body_values = email.get("bodyValues", {})
                    body_text = ""
                    for bv in body_values.values():
                        body_text += bv.get("value", "")
                    email_text = f"Subject: {subject}\n\n{body_text}"
                    summary = await self._summarize_via_llm(email_text, "email")
                    return {"status": "ok", "message_id": message_id, "summary": summary}
        except Exception as exc:
            logger.warning("Could not fetch email %s from Stalwart: %s", message_id, exc)

        return {
            "error": f"Could not retrieve email with ID '{message_id}'. "
            "Ensure the Stalwart mail server is running and the message ID is correct."
        }

    async def _exec_summarize_meeting(self, event_id: str) -> dict[str, Any]:
        """Summarize a calendar event / meeting."""
        from app.models.calendar import CalendarEvent  # noqa: PLC0415

        result = await self.db.execute(
            select(CalendarEvent).where(CalendarEvent.id == uuid.UUID(event_id))
        )
        event = result.scalar_one_or_none()
        if not event:
            return {"error": f"Calendar event '{event_id}' not found."}

        attendees_str = ""
        if event.attendees:
            attendees_str = f"\nAttendees: {', '.join(str(a) for a in event.attendees)}"

        event_text = (
            f"Meeting: {event.title}\n"
            f"Time: {event.start_time.isoformat()} to {event.end_time.isoformat()}\n"
            f"Type: {event.event_type}\n"
            f"Location: {event.location or 'Not specified'}"
            f"{attendees_str}\n"
            f"Description: {event.description or 'No description provided.'}"
        )

        summary = await self._summarize_via_llm(event_text, "meeting")
        return {"status": "ok", "event_id": event_id, "title": event.title, "summary": summary}

    async def _exec_summarize_note(self, note_id: str) -> dict[str, Any]:
        """Summarize a note."""
        from app.models.notes import Note  # noqa: PLC0415

        result = await self.db.execute(
            select(Note).where(Note.id == uuid.UUID(note_id))
        )
        note = result.scalar_one_or_none()
        if not note:
            return {"error": f"Note '{note_id}' not found."}

        note_text = f"Title: {note.title}\n\n{note.content or 'No content.'}"
        summary = await self._summarize_via_llm(note_text, "note")
        return {"status": "ok", "note_id": note_id, "title": note.title, "summary": summary}

    # ── Admin tools (super-admin only) ───────────────────────────────────

    def _require_superadmin(self) -> None:
        """Raise an error if the current user is not a super-admin."""
        if not self.user or not getattr(self.user, "is_superadmin", False):
            raise PermissionError("This action requires super-admin privileges.")

    async def _exec_create_user(
        self,
        email: str,
        full_name: str,
        role: str = "user",
    ) -> dict[str, Any]:
        self._require_superadmin()
        from app.core.security import hash_password  # noqa: PLC0415
        from app.models.user import User  # noqa: PLC0415

        # Check if user already exists
        existing = await self.db.execute(
            select(User).where(User.email == email)
        )
        if existing.scalar_one_or_none():
            return {"error": f"User with email '{email}' already exists."}

        # Generate a temporary password
        import secrets  # noqa: PLC0415
        temp_password = secrets.token_urlsafe(12)

        new_user = User(
            email=email,
            full_name=full_name,
            hashed_password=hash_password(temp_password),
            is_active=True,
            is_superadmin=(role == "admin"),
        )
        self.db.add(new_user)
        await self.db.commit()
        await self.db.refresh(new_user)
        return {
            "status": "created",
            "user_id": str(new_user.id),
            "email": email,
            "full_name": full_name,
            "role": role,
            "result": f"User '{full_name}' ({email}) created successfully with role '{role}'. Temporary password: {temp_password}",
        }

    async def _exec_assign_role(
        self,
        user_email: str,
        role_name: str,
    ) -> dict[str, Any]:
        self._require_superadmin()
        from app.models.user import Role, User, UserRole  # noqa: PLC0415

        # Find user
        user_result = await self.db.execute(
            select(User).where(User.email == user_email)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            return {"error": f"User with email '{user_email}' not found."}

        # Find or create role
        role_result = await self.db.execute(
            select(Role).where(Role.name == role_name)
        )
        role = role_result.scalar_one_or_none()
        if not role:
            role = Role(name=role_name, description=f"Role: {role_name}")
            self.db.add(role)
            await self.db.flush()

        # Check if already assigned
        existing = await self.db.execute(
            select(UserRole).where(
                UserRole.user_id == user.id,
                UserRole.role_id == role.id,
            )
        )
        if existing.scalar_one_or_none():
            return {"result": f"User '{user_email}' already has role '{role_name}'."}

        user_role = UserRole(
            user_id=user.id,
            role_id=role.id,
            granted_by=self.user_id,
            granted_at=datetime.now(timezone.utc),
        )
        self.db.add(user_role)
        await self.db.commit()
        return {
            "status": "assigned",
            "result": f"Role '{role_name}' assigned to user '{user_email}'.",
        }

    async def _exec_make_app_admin(
        self,
        user_email: str,
        app_name: str,
    ) -> dict[str, Any]:
        self._require_superadmin()
        from app.models.user import AppAdmin, User  # noqa: PLC0415

        # Find user
        user_result = await self.db.execute(
            select(User).where(User.email == user_email)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            return {"error": f"User with email '{user_email}' not found."}

        # Check if already app admin
        existing = await self.db.execute(
            select(AppAdmin).where(
                AppAdmin.user_id == user.id,
                AppAdmin.app_name == app_name,
            )
        )
        if existing.scalar_one_or_none():
            return {"result": f"User '{user_email}' is already an admin for '{app_name}'."}

        app_admin = AppAdmin(
            user_id=user.id,
            app_name=app_name,
            granted_by=self.user_id,
            granted_at=datetime.now(timezone.utc),
        )
        self.db.add(app_admin)
        await self.db.commit()
        return {
            "status": "granted",
            "result": f"User '{user_email}' is now an admin for '{app_name}'.",
        }

    async def _exec_deactivate_user(
        self,
        user_email: str,
    ) -> dict[str, Any]:
        self._require_superadmin()
        from app.models.user import User  # noqa: PLC0415

        user_result = await self.db.execute(
            select(User).where(User.email == user_email)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            return {"error": f"User with email '{user_email}' not found."}

        if user.id == self.user_id:
            return {"error": "Cannot deactivate your own account."}

        user.is_active = False
        await self.db.commit()
        return {
            "status": "deactivated",
            "result": f"User '{user_email}' ({user.full_name}) has been deactivated.",
        }

    # ── Support tools ────────────────────────────────────────────────────

    async def _exec_lookup_ticket(self, query: str) -> dict[str, Any]:
        from app.models.support import Ticket  # noqa: PLC0415
        from sqlalchemy import or_  # noqa: PLC0415

        result = await self.db.execute(
            select(Ticket).where(
                or_(
                    Ticket.ticket_number.ilike(like_pattern(query)),
                    Ticket.subject.ilike(like_pattern(query)),
                )
            ).limit(5)
        )
        tickets = result.scalars().all()
        if not tickets:
            return {"result": f"No tickets found matching '{query}'."}
        lines = [
            f"- {t.ticket_number}: {t.subject} [{t.status}] (priority: {t.priority})"
            for t in tickets
        ]
        return {"result": f"Found {len(tickets)} tickets:\n" + "\n".join(lines)}

    async def _exec_get_support_summary(self) -> dict[str, Any]:
        from app.models.support import Ticket  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415

        result = await self.db.execute(
            select(Ticket.status, func.count()).group_by(Ticket.status)
        )
        statuses = {row[0]: row[1] for row in result.all()}
        total = sum(statuses.values())
        return {
            "total_tickets": total,
            "by_status": statuses,
            "result": f"Support: {total} total tickets. " + ", ".join(f"{k}: {v}" for k, v in statuses.items()),
        }

    async def _exec_search_knowledge_base(self, query: str) -> dict[str, Any]:
        from app.models.support import KnowledgeBaseArticle  # noqa: PLC0415

        result = await self.db.execute(
            select(KnowledgeBaseArticle).where(
                KnowledgeBaseArticle.status == "published",
                KnowledgeBaseArticle.title.ilike(like_pattern(query)),
            ).limit(5)
        )
        articles = result.scalars().all()
        if not articles:
            return {"result": f"No knowledge base articles found matching '{query}'."}
        lines = [f"- {a.title} (views: {a.view_count})" for a in articles]
        return {"result": f"Found {len(articles)} articles:\n" + "\n".join(lines)}

    # ── Supply Chain tools ────────────────────────────────────────────────

    async def _exec_lookup_supplier(self, query: str) -> dict[str, Any]:
        from app.models.supplychain import Supplier  # noqa: PLC0415
        from sqlalchemy import or_  # noqa: PLC0415

        result = await self.db.execute(
            select(Supplier).where(
                or_(
                    Supplier.name.ilike(like_pattern(query)),
                    Supplier.code.ilike(like_pattern(query)),
                )
            ).limit(5)
        )
        suppliers = result.scalars().all()
        if not suppliers:
            return {"result": f"No suppliers found matching '{query}'."}
        lines = [
            f"- {s.name} (code: {s.code}, rating: {s.rating or 'N/A'}, active: {s.is_active})"
            for s in suppliers
        ]
        return {"result": f"Found {len(suppliers)} suppliers:\n" + "\n".join(lines)}

    async def _exec_get_procurement_status(self) -> dict[str, Any]:
        from app.models.supplychain import GoodsReceivedNote, ProcurementRequisition, SupplierReturn  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415

        pending_reqs = (await self.db.execute(
            select(func.count()).select_from(ProcurementRequisition).where(
                ProcurementRequisition.status.in_(["draft", "submitted"])
            )
        )).scalar() or 0

        open_grns = (await self.db.execute(
            select(func.count()).select_from(GoodsReceivedNote).where(
                GoodsReceivedNote.status == "draft"
            )
        )).scalar() or 0

        pending_returns = (await self.db.execute(
            select(func.count()).select_from(SupplierReturn).where(
                SupplierReturn.status.in_(["draft", "pending_approval"])
            )
        )).scalar() or 0

        return {
            "pending_requisitions": pending_reqs,
            "open_grns": open_grns,
            "pending_returns": pending_returns,
            "result": f"Procurement: {pending_reqs} pending requisitions, {open_grns} open GRNs, {pending_returns} pending returns.",
        }

    # ── Manufacturing tools ───────────────────────────────────────────────

    async def _exec_check_bom_cost(self, bom_name: str) -> dict[str, Any]:
        from app.models.manufacturing import BOMItem, BillOfMaterials  # noqa: PLC0415
        from app.models.inventory import InventoryItem  # noqa: PLC0415

        bom_result = await self.db.execute(
            select(BillOfMaterials).where(
                BillOfMaterials.name.ilike(like_pattern(bom_name))
            ).limit(1)
        )
        bom = bom_result.scalar_one_or_none()
        if not bom:
            return {"result": f"No BOM found matching '{bom_name}'."}

        items_result = await self.db.execute(
            select(BOMItem, InventoryItem).join(
                InventoryItem, BOMItem.item_id == InventoryItem.id
            ).where(BOMItem.bom_id == bom.id)
        )
        rows = items_result.all()
        total_cost = 0.0
        lines = []
        for bom_item, inv_item in rows:
            cost = float(bom_item.quantity) * float(inv_item.cost_price or 0)
            total_cost += cost
            lines.append(f"- {inv_item.name}: {bom_item.quantity} x {inv_item.cost_price or 0} = {cost:.2f}")

        return {
            "bom_name": bom.name,
            "total_material_cost": total_cost,
            "result": f"BOM '{bom.name}' total material cost: {total_cost:,.2f}\n" + "\n".join(lines),
        }

    async def _exec_get_production_summary(self) -> dict[str, Any]:
        from app.models.manufacturing import WorkOrder  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415

        result = await self.db.execute(
            select(WorkOrder.status, func.count()).group_by(WorkOrder.status)
        )
        statuses = {row[0]: row[1] for row in result.all()}
        total = sum(statuses.values())
        active = statuses.get("in_progress", 0)
        completed = statuses.get("completed", 0)
        return {
            "total_work_orders": total,
            "active": active,
            "completed": completed,
            "by_status": statuses,
            "result": f"Production: {total} work orders ({active} active, {completed} completed). " + ", ".join(f"{k}: {v}" for k, v in statuses.items()),
        }

    async def _exec_check_material_availability(self, bom_name: str, quantity: int = 1) -> dict[str, Any]:
        from app.models.manufacturing import BOMItem, BillOfMaterials  # noqa: PLC0415
        from app.models.inventory import InventoryItem, StockLevel  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415

        bom_result = await self.db.execute(
            select(BillOfMaterials).where(
                BillOfMaterials.name.ilike(like_pattern(bom_name))
            ).limit(1)
        )
        bom = bom_result.scalar_one_or_none()
        if not bom:
            return {"result": f"No BOM found matching '{bom_name}'."}

        items_result = await self.db.execute(
            select(BOMItem, InventoryItem).join(
                InventoryItem, BOMItem.item_id == InventoryItem.id
            ).where(BOMItem.bom_id == bom.id)
        )
        rows = items_result.all()
        lines = []
        all_available = True
        for bom_item, inv_item in rows:
            needed = float(bom_item.quantity) * quantity
            stock_result = await self.db.execute(
                select(func.coalesce(func.sum(StockLevel.quantity_on_hand), 0)).where(
                    StockLevel.item_id == inv_item.id
                )
            )
            on_hand = float(stock_result.scalar() or 0)
            status = "OK" if on_hand >= needed else "SHORT"
            if status == "SHORT":
                all_available = False
            lines.append(f"- {inv_item.name}: need {needed}, have {on_hand} [{status}]")

        summary = "All materials available." if all_available else "Some materials are short."
        return {
            "bom_name": bom.name,
            "quantity": quantity,
            "all_available": all_available,
            "result": f"Material check for {quantity}x '{bom.name}': {summary}\n" + "\n".join(lines),
        }

    # ── POS tools ────────────────────────────────────────────────────────

    async def _exec_get_pos_daily_summary(self) -> dict[str, Any]:
        from app.models.pos import POSTransaction  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415
        from datetime import date  # noqa: PLC0415

        today = date.today()
        result = await self.db.execute(
            select(
                func.count(),
                func.coalesce(func.sum(POSTransaction.total_amount), 0),
            ).where(
                func.date(POSTransaction.created_at) == today,
                POSTransaction.status == "completed",
            )
        )
        count, total = result.one()
        return {
            "date": today.isoformat(),
            "transaction_count": count,
            "total_revenue": float(total),
            "result": f"POS today ({today}): {count} transactions, total revenue: {float(total):,.2f}",
        }

    async def _exec_lookup_pos_transaction(self, receipt_number: str) -> dict[str, Any]:
        from app.models.pos import POSTransaction  # noqa: PLC0415

        result = await self.db.execute(
            select(POSTransaction).where(
                POSTransaction.receipt_number == receipt_number
            )
        )
        txn = result.scalar_one_or_none()
        if not txn:
            return {"result": f"No POS transaction found with receipt number '{receipt_number}'."}
        return {
            "receipt_number": txn.receipt_number,
            "status": txn.status,
            "total_amount": float(txn.total_amount),
            "payment_method": txn.payment_method,
            "created_at": txn.created_at.isoformat() if txn.created_at else None,
            "result": f"Receipt {txn.receipt_number}: {txn.status}, total: {float(txn.total_amount):,.2f}, payment: {txn.payment_method}",
        }

    # ── E-Commerce tools ─────────────────────────────────────────────────

    async def _exec_get_ecommerce_sales_summary(self) -> dict[str, Any]:
        from app.models.ecommerce import Order  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415
        from datetime import date  # noqa: PLC0415

        today = date.today()
        month_start = today.replace(day=1)

        result = await self.db.execute(
            select(
                func.count(),
                func.coalesce(func.sum(Order.total_amount), 0),
            ).where(
                Order.created_at >= month_start,
            )
        )
        count, total = result.one()

        pending = (await self.db.execute(
            select(func.count()).select_from(Order).where(
                Order.status.in_(["pending", "confirmed", "processing"])
            )
        )).scalar() or 0

        return {
            "period": f"{month_start.isoformat()} to {today.isoformat()}",
            "orders_this_month": count,
            "revenue_this_month": float(total),
            "pending_orders": pending,
            "result": f"E-Commerce ({month_start} to {today}): {count} orders, revenue: {float(total):,.2f}, {pending} pending.",
        }

    async def _exec_lookup_order(self, order_number: str) -> dict[str, Any]:
        from app.models.ecommerce import Order  # noqa: PLC0415

        result = await self.db.execute(
            select(Order).where(Order.order_number == order_number)
        )
        order = result.scalar_one_or_none()
        if not order:
            return {"result": f"No order found with number '{order_number}'."}
        return {
            "order_number": order.order_number,
            "status": order.status,
            "total_amount": float(order.total_amount),
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "result": f"Order {order.order_number}: {order.status}, total: {float(order.total_amount):,.2f}",
        }
