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

# ── Approval tier classification (single source of truth) ────────────────────
# Used by the Verifier agent to decide auto_approve / warn / require_approval.
# Keys are tool names; values are the tier. Default for unknown tools is "warn".
TOOL_APPROVAL_TIERS: dict[str, str] = {
    # ── auto_approve: read-only / analysis tools ──────────────────────────────
    "list_meetings": "auto_approve",
    "search_files": "auto_approve",
    "lookup_employee": "auto_approve",
    "check_leave_balance": "auto_approve",
    "get_pipeline_summary": "auto_approve",
    "get_revenue_summary": "auto_approve",
    "lookup_inventory": "auto_approve",
    "check_stock_level": "auto_approve",
    "query_data": "auto_approve",
    "generate_report": "auto_approve",
    "summarize_email": "auto_approve",
    "summarize_meeting": "auto_approve",
    "summarize_note": "auto_approve",
    "summarize_thread": "auto_approve",
    "summarize_email_thread": "auto_approve",
    "summarize_meeting_notes": "auto_approve",
    "find_file": "auto_approve",
    "check_availability": "auto_approve",
    "predict_attrition": "auto_approve",
    "detect_payroll_anomalies": "auto_approve",
    "recommend_supplier": "auto_approve",
    "optimize_production": "auto_approve",
    "predict_maintenance": "auto_approve",
    "recommend_products": "auto_approve",
    "optimize_pricing": "auto_approve",
    "analyze_project_risk": "auto_approve",
    "categorize_email": "auto_approve",
    "auto_tag_note": "auto_approve",
    "suggest_file_organization": "auto_approve",
    "next_best_action": "auto_approve",
    "financial_forecast": "auto_approve",
    "detect_anomalies": "auto_approve",
    "lookup_ticket": "auto_approve",
    "get_support_summary": "auto_approve",
    "search_knowledge_base": "auto_approve",
    "lookup_supplier": "auto_approve",
    "get_procurement_status": "auto_approve",
    "check_bom_cost": "auto_approve",
    "get_production_summary": "auto_approve",
    "check_material_availability": "auto_approve",
    "get_pos_daily_summary": "auto_approve",
    "lookup_pos_transaction": "auto_approve",
    "get_ecommerce_sales_summary": "auto_approve",
    "lookup_order": "auto_approve",
    "classify_ticket": "auto_approve",
    "suggest_response": "auto_approve",
    "score_lead": "auto_approve",
    "estimate_task": "auto_approve",
    "demand_forecast": "auto_approve",
    "optimize_reorder_point": "auto_approve",
    # ── warn: create/update tools (execute but show warning) ──────────────────
    "create_calendar_event": "warn",
    "send_email": "warn",
    "create_note": "warn",
    "create_task": "warn",
    "create_invoice": "warn",
    "create_lead": "warn",
    "create_purchase_order": "warn",
    "generate_document": "warn",
    "compose_email": "warn",
    "organize_files": "warn",
    "log_time": "warn",
    "schedule_meeting": "warn",
    "generate_kb_article": "warn",
    "generate_form": "warn",
    "translate_document": "warn",
    # ── require_approval: admin/destructive/sharing tools ─────────────────────
    "create_user": "require_approval",
    "assign_role": "require_approval",
    "make_app_admin": "require_approval",
    "deactivate_user": "require_approval",
    "share_file": "require_approval",
    "update_ai_config": "require_approval",
    "get_system_metrics": "require_approval",
}


def get_tool_approval_tier(tool_name: str) -> str:
    """Look up approval tier for a tool. Defaults to 'warn' if not classified."""
    return TOOL_APPROVAL_TIERS.get(tool_name, "warn")


def get_all_tool_definitions(*, include_admin: bool = False) -> list[dict]:
    """Return tool definitions, optionally including admin tools."""
    tools = list(TOOL_DEFINITIONS)
    if include_admin:
        tools.extend(ADMIN_TOOL_DEFINITIONS)
    return tools


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
    # ── AI Lead Scoring ──────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "score_lead",
            "description": "Analyze a CRM lead's activity, company size, engagement to return a 0-100 score with explanation",
            "parameters": {
                "type": "object",
                "properties": {
                    "lead_id": {"type": "string", "description": "UUID of the lead to score"},
                },
                "required": ["lead_id"],
            },
        },
    },
    # ── AI Demand Forecasting ────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "demand_forecast",
            "description": "Analyze historical stock movements to predict future demand per item using moving average and trend detection",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_id": {"type": "string", "description": "UUID of the inventory item"},
                    "sku": {"type": "string", "description": "SKU of the item (alternative to item_id)"},
                    "periods_ahead": {
                        "type": "integer",
                        "default": 3,
                        "description": "Number of months to forecast (1-12)",
                    },
                },
                "required": [],
            },
        },
    },
    # ── AI Reorder Point Optimization ───────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "optimize_reorder_point",
            "description": "Analyze historical stock movement data and suggest optimal reorder points and quantities for inventory items",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_id": {"type": "string", "description": "Inventory item ID to optimize"},
                },
                "required": ["item_id"],
            },
        },
    },
    # ── AI Ticket Classification ─────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "classify_ticket",
            "description": "Analyze a support ticket's subject/description to suggest category, priority, and assignee",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticket_id": {"type": "string", "description": "UUID of the ticket to classify"},
                },
                "required": ["ticket_id"],
            },
        },
    },
    # ── AI Suggested Response ────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "suggest_response",
            "description": "Generate a suggested reply for a support ticket based on KB articles and ticket context",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticket_id": {"type": "string", "description": "UUID of the ticket"},
                },
                "required": ["ticket_id"],
            },
        },
    },
    # ── AI KB Article Generation ─────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "generate_kb_article",
            "description": "Create a knowledge base article from a resolved ticket's conversation thread",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticket_id": {"type": "string", "description": "UUID of the resolved ticket"},
                },
                "required": ["ticket_id"],
            },
        },
    },
    # ── AI Meeting Summarization (enhanced) ──────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "summarize_meeting_notes",
            "description": "Summarize meeting notes or chat export into a structured summary with action items",
            "parameters": {
                "type": "object",
                "properties": {
                    "meeting_notes": {"type": "string", "description": "Raw meeting notes or chat transcript"},
                    "event_id": {"type": "string", "description": "Optional calendar event ID to link the summary to"},
                },
                "required": ["meeting_notes"],
            },
        },
    },
    # ── AI Calendar Tools ────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "schedule_meeting",
            "description": "Find free slots across attendees and create a meeting event",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Meeting title"},
                    "duration_minutes": {"type": "integer", "default": 60, "description": "Duration in minutes"},
                    "attendee_emails": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Email addresses of attendees",
                    },
                    "preferred_date": {"type": "string", "description": "Preferred date (ISO format, e.g. 2026-03-15)"},
                    "description": {"type": "string", "description": "Optional meeting description"},
                },
                "required": ["title", "attendee_emails"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_availability",
            "description": "Check free/busy status for one or more users on a given date",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_emails": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Email addresses to check availability for",
                    },
                    "date": {"type": "string", "description": "Date to check (ISO format, e.g. 2026-03-15)"},
                },
                "required": ["user_emails", "date"],
            },
        },
    },
    # ── AI Mail Tools ────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "compose_email",
            "description": "Draft an email from natural language instructions (does NOT send)",
            "parameters": {
                "type": "object",
                "properties": {
                    "instructions": {"type": "string", "description": "What the email should say / accomplish"},
                    "to": {"type": "string", "description": "Recipient email address"},
                    "tone": {
                        "type": "string",
                        "enum": ["formal", "casual", "friendly", "urgent"],
                        "default": "formal",
                        "description": "Email tone",
                    },
                },
                "required": ["instructions"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "summarize_thread",
            "description": "Summarize an email thread / conversation",
            "parameters": {
                "type": "object",
                "properties": {
                    "thread_text": {"type": "string", "description": "The email thread text to summarize"},
                },
                "required": ["thread_text"],
            },
        },
    },
    # ── AI Drive Tools ───────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "find_file",
            "description": "Search files by description or keywords across Drive",
            "parameters": {
                "type": "object",
                "properties": {
                    "description": {"type": "string", "description": "Natural language description of the file to find"},
                    "file_type": {"type": "string", "description": "Optional file type filter (e.g. pdf, docx, xlsx)"},
                },
                "required": ["description"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "share_file",
            "description": "Share a file with specified users by email",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_name": {"type": "string", "description": "Name of the file to share"},
                    "user_emails": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Email addresses of users to share with",
                    },
                    "permission": {
                        "type": "string",
                        "enum": ["view", "edit"],
                        "default": "view",
                        "description": "Permission level",
                    },
                },
                "required": ["file_name", "user_emails"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "organize_files",
            "description": "Analyze files in a folder and suggest a better folder structure",
            "parameters": {
                "type": "object",
                "properties": {
                    "folder_path": {"type": "string", "default": "/", "description": "Folder path to analyze"},
                },
                "required": [],
            },
        },
    },
    # ── AI Projects Tools ────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "log_time",
            "description": "Log time spent on a task",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_title": {"type": "string", "description": "Title of the task"},
                    "hours": {"type": "number", "description": "Hours spent"},
                    "description": {"type": "string", "description": "Description of work done"},
                },
                "required": ["task_title", "hours"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "estimate_task",
            "description": "Estimate effort for a task based on its description and historical data from similar tasks",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_description": {"type": "string", "description": "Description of the task to estimate"},
                    "project_name": {"type": "string", "description": "Project name for context"},
                },
                "required": ["task_description"],
            },
        },
    },
    # ── AI Analytics Tools ───────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "generate_report",
            "description": "Generate an analytics report from a natural language query",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Natural language description of the report (e.g. 'monthly revenue breakdown by product')"},
                    "format": {
                        "type": "string",
                        "enum": ["summary", "table", "chart_data"],
                        "default": "summary",
                        "description": "Output format",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_data",
            "description": "Convert a natural language question to SQL and execute it against the ERP database (read-only)",
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {"type": "string", "description": "Natural language question (e.g. 'How many invoices were created this month?')"},
                },
                "required": ["question"],
            },
        },
    },
    # ── AI Attrition Prediction ──────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "predict_attrition",
            "description": "Analyze an employee's tenure, leave patterns, and performance reviews to predict attrition risk",
            "parameters": {
                "type": "object",
                "properties": {
                    "employee_id": {"type": "string", "description": "UUID of the employee to analyze"},
                },
                "required": ["employee_id"],
            },
        },
    },
    # ── AI Payroll Anomaly Detection ─────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "detect_payroll_anomalies",
            "description": "Compare recent payslips against historical patterns to detect anomalies such as unusual pay amounts or deductions",
            "parameters": {
                "type": "object",
                "properties": {
                    "months_back": {
                        "type": "integer",
                        "default": 6,
                        "description": "Number of months of history to compare against",
                    },
                },
                "required": [],
            },
        },
    },
    # ── AI Supplier Recommendation ───────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "recommend_supplier",
            "description": "Score and rank suppliers by quality, delivery, and price metrics to recommend the best supplier for a procurement need",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_category": {"type": "string", "description": "Category or type of item being procured (optional)"},
                    "budget_limit": {"type": "number", "description": "Maximum budget (optional)"},
                },
                "required": [],
            },
        },
    },
    # ── AI Production Optimization ───────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "optimize_production",
            "description": "Analyze pending work orders, workstation capacity, and material availability to suggest optimal production scheduling",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    # ── AI Predictive Maintenance ────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "predict_maintenance",
            "description": "Analyze maintenance history and work order load for a workstation to predict failures and suggest maintenance windows",
            "parameters": {
                "type": "object",
                "properties": {
                    "workstation_id": {"type": "string", "description": "UUID of the workstation to analyze"},
                },
                "required": ["workstation_id"],
            },
        },
    },
    # ── AI Product Recommendations (E-Commerce) ─────────────────────────
    {
        "type": "function",
        "function": {
            "name": "recommend_products",
            "description": "Analyze order history to suggest cross-sell and upsell product recommendations for a customer or product",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string", "description": "UUID of the product to find related products for (optional)"},
                    "customer_id": {"type": "string", "description": "UUID of the e-commerce customer (optional)"},
                    "limit": {"type": "integer", "default": 5, "description": "Max recommendations"},
                },
                "required": [],
            },
        },
    },
    # ── AI Pricing Optimization (E-Commerce) ─────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "optimize_pricing",
            "description": "Analyze a product's sales history, competitor pricing, and demand to suggest optimal pricing",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string", "description": "UUID of the e-commerce product"},
                },
                "required": ["product_id"],
            },
        },
    },
    # ── AI Project Risk Analysis ─────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "analyze_project_risk",
            "description": "Analyze a project's tasks, deadlines, resource allocation, and progress to identify risk factors",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {"type": "string", "description": "UUID of the project to analyze"},
                },
                "required": ["project_id"],
            },
        },
    },
    # ── AI Email Thread Summarization ────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "summarize_email_thread",
            "description": "Summarize an email thread by thread ID, pulling messages from the mail system",
            "parameters": {
                "type": "object",
                "properties": {
                    "thread_id": {"type": "string", "description": "Thread or conversation ID"},
                },
                "required": ["thread_id"],
            },
        },
    },
    # ── AI Smart Email Categorization ────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "categorize_email",
            "description": "Auto-label/categorize an email message by analyzing its subject and content",
            "parameters": {
                "type": "object",
                "properties": {
                    "message_id": {"type": "string", "description": "Email message ID to categorize"},
                },
                "required": ["message_id"],
            },
        },
    },
    # ── AI Note Auto-Tagging ─────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "auto_tag_note",
            "description": "Analyze a note's title and content to suggest relevant tags",
            "parameters": {
                "type": "object",
                "properties": {
                    "note_id": {"type": "string", "description": "UUID of the note to tag"},
                },
                "required": ["note_id"],
            },
        },
    },
    # ── AI Form Generation ───────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "generate_form",
            "description": "Generate a form schema (title, description, fields) from a natural language description",
            "parameters": {
                "type": "object",
                "properties": {
                    "description": {"type": "string", "description": "Natural language description of the form to create"},
                    "max_fields": {"type": "integer", "default": 10, "description": "Maximum number of fields to generate"},
                },
                "required": ["description"],
            },
        },
    },
    # ── AI Document Translation ──────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "translate_document",
            "description": "Translate a document's content to a target language",
            "parameters": {
                "type": "object",
                "properties": {
                    "doc_id": {"type": "string", "description": "UUID of the document to translate"},
                    "target_language": {"type": "string", "description": "Target language (e.g. Spanish, French, German, Swahili)"},
                },
                "required": ["doc_id", "target_language"],
            },
        },
    },
    # ── AI File Organization Suggestions ─────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "suggest_file_organization",
            "description": "Analyze all files in a user's Drive and suggest a folder structure based on file types, names, and usage patterns",
            "parameters": {
                "type": "object",
                "properties": {
                    "include_shared": {"type": "boolean", "default": False, "description": "Include shared files in the analysis"},
                },
                "required": [],
            },
        },
    },
    # ── AI CRM Next-Best-Action ──────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "next_best_action",
            "description": "Analyze a deal or contact and suggest the best next step to advance the relationship",
            "parameters": {
                "type": "object",
                "properties": {
                    "deal_id": {"type": "string", "description": "UUID of the deal (optional)"},
                    "contact_id": {"type": "string", "description": "UUID of the CRM contact (optional)"},
                    "opportunity_id": {"type": "string", "description": "UUID of the opportunity (optional)"},
                },
                "required": [],
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
    # ── Finance AI tools ──────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "financial_forecast",
            "description": "Generate a revenue/expense forecast for the next N months based on historical data",
            "parameters": {
                "type": "object",
                "properties": {
                    "months_ahead": {
                        "type": "integer",
                        "default": 3,
                        "description": "Number of months to forecast (1-12)",
                    },
                    "metric": {
                        "type": "string",
                        "enum": ["revenue", "expenses", "profit"],
                        "default": "revenue",
                        "description": "Which financial metric to forecast",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "detect_anomalies",
            "description": "Detect anomalous transactions (unusually large amounts, unusual patterns) in recent finance data",
            "parameters": {
                "type": "object",
                "properties": {
                    "days_back": {
                        "type": "integer",
                        "default": 30,
                        "description": "Number of days to look back for anomalies",
                    },
                    "threshold": {
                        "type": "number",
                        "default": 2.0,
                        "description": "Standard deviation threshold for anomaly detection",
                    },
                },
                "required": [],
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
        """Summarize an email by fetching it from the local PostgreSQL mailbox."""
        from app.models.mail_storage import MailboxMessage  # noqa: PLC0415

        try:
            msg = await self.db.get(MailboxMessage, uuid.UUID(message_id))
        except (ValueError, AttributeError):
            return {"error": f"Invalid message ID '{message_id}'."}

        if not msg:
            return {"error": f"Message not found in mailbox (ID: '{message_id}')."}

        subject = msg.subject or "No subject"
        body_text = msg.body_text or ""
        email_text = f"Subject: {subject}\n\n{body_text}"
        summary = await self._summarize_via_llm(email_text, "email")
        return {"status": "ok", "message_id": message_id, "summary": summary}

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
        from app.models.ecommerce import EcomOrder  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415
        from datetime import date  # noqa: PLC0415

        today = date.today()
        month_start = today.replace(day=1)

        result = await self.db.execute(
            select(
                func.count(),
                func.coalesce(func.sum(EcomOrder.total), 0),
            ).where(
                EcomOrder.created_at >= month_start,
            )
        )
        count, total = result.one()

        pending = (await self.db.execute(
            select(func.count()).select_from(EcomOrder).where(
                EcomOrder.status.in_(["pending", "confirmed", "processing"])
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
        from app.models.ecommerce import EcomOrder  # noqa: PLC0415

        result = await self.db.execute(
            select(EcomOrder).where(EcomOrder.order_number == order_number)
        )
        order = result.scalar_one_or_none()
        if not order:
            return {"result": f"No order found with number '{order_number}'."}
        return {
            "order_number": order.order_number,
            "status": order.status,
            "total": float(order.total),
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "result": f"Order {order.order_number}: {order.status}, total: {float(order.total):,.2f}",
        }

    # ── Finance AI tools ─────────────────────────────────────────────────

    async def _exec_financial_forecast(
        self,
        months_ahead: int = 3,
        metric: str = "revenue",
    ) -> dict[str, Any]:
        """Simple linear trend forecast based on last 6 months of data."""
        from app.models.finance import Invoice, Expense, Payment  # noqa: PLC0415
        from sqlalchemy import func, extract, and_  # noqa: PLC0415
        from datetime import date  # noqa: PLC0415
        from decimal import Decimal  # noqa: PLC0415

        today = date.today()
        six_months_ago = today.replace(day=1)
        for _ in range(6):
            six_months_ago = (six_months_ago - timedelta(days=1)).replace(day=1)

        monthly_data = []

        if metric in ("revenue", "profit"):
            # Revenue: sum of paid sales invoices grouped by month
            result = await self.db.execute(
                select(
                    extract("year", Invoice.issue_date).label("yr"),
                    extract("month", Invoice.issue_date).label("mo"),
                    func.coalesce(func.sum(Invoice.total), 0).label("amount"),
                )
                .where(
                    and_(
                        Invoice.invoice_type == "sales",
                        Invoice.status == "paid",
                        Invoice.issue_date >= six_months_ago,
                    )
                )
                .group_by("yr", "mo")
                .order_by("yr", "mo")
            )
            revenue_rows = {(int(r.yr), int(r.mo)): float(r.amount) for r in result.all()}
        else:
            revenue_rows = {}

        if metric in ("expenses", "profit"):
            result = await self.db.execute(
                select(
                    extract("year", Expense.expense_date).label("yr"),
                    extract("month", Expense.expense_date).label("mo"),
                    func.coalesce(func.sum(Expense.amount), 0).label("amount"),
                )
                .where(
                    and_(
                        Expense.status.in_(["approved", "reimbursed"]),
                        Expense.expense_date >= six_months_ago,
                    )
                )
                .group_by("yr", "mo")
                .order_by("yr", "mo")
            )
            expense_rows = {(int(r.yr), int(r.mo)): float(r.amount) for r in result.all()}
        else:
            expense_rows = {}

        # Build monthly series
        current = six_months_ago
        historical = []
        for i in range(6):
            yr, mo = current.year, current.month
            if metric == "revenue":
                val = revenue_rows.get((yr, mo), 0)
            elif metric == "expenses":
                val = expense_rows.get((yr, mo), 0)
            else:  # profit
                val = revenue_rows.get((yr, mo), 0) - expense_rows.get((yr, mo), 0)
            historical.append({"year": yr, "month": mo, "amount": val})
            # Move to next month
            if mo == 12:
                current = current.replace(year=yr + 1, month=1)
            else:
                current = current.replace(month=mo + 1)

        # Simple linear regression
        n = len(historical)
        if n < 2:
            return {"error": "Insufficient historical data for forecasting"}

        amounts = [h["amount"] for h in historical]
        x_mean = (n - 1) / 2
        y_mean = sum(amounts) / n
        numerator = sum((i - x_mean) * (amounts[i] - y_mean) for i in range(n))
        denominator = sum((i - x_mean) ** 2 for i in range(n))
        slope = numerator / denominator if denominator else 0
        intercept = y_mean - slope * x_mean

        forecast = []
        for j in range(months_ahead):
            predicted = intercept + slope * (n + j)
            # Advance month
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)
            forecast.append({
                "year": current.year,
                "month": current.month,
                "predicted_amount": round(max(predicted, 0), 2),
            })

        return {
            "metric": metric,
            "historical": historical,
            "forecast": forecast,
            "trend": "increasing" if slope > 0 else "decreasing" if slope < 0 else "flat",
            "monthly_growth_rate": round(slope, 2),
        }

    async def _exec_detect_anomalies(
        self,
        days_back: int = 30,
        threshold: float = 2.0,
    ) -> dict[str, Any]:
        """Detect anomalous transactions using z-score on payment/invoice amounts."""
        from app.models.finance import Invoice, Payment  # noqa: PLC0415
        from sqlalchemy import func, and_  # noqa: PLC0415
        from datetime import date  # noqa: PLC0415
        import math  # noqa: PLC0415

        today = date.today()
        cutoff = today - timedelta(days=days_back)

        # Get all payment amounts in the period
        payments_result = await self.db.execute(
            select(Payment.id, Payment.payment_number, Payment.amount, Payment.payment_date)
            .where(and_(Payment.payment_date >= cutoff, Payment.status == "completed"))
        )
        payments = payments_result.all()

        # Get all invoice totals in the period
        invoices_result = await self.db.execute(
            select(Invoice.id, Invoice.invoice_number, Invoice.total, Invoice.issue_date)
            .where(Invoice.issue_date >= cutoff)
        )
        invoices = invoices_result.all()

        anomalies = []

        # Analyze payments
        if len(payments) >= 3:
            amounts = [float(p.amount) for p in payments]
            mean = sum(amounts) / len(amounts)
            variance = sum((a - mean) ** 2 for a in amounts) / len(amounts)
            std_dev = math.sqrt(variance) if variance > 0 else 1

            for p in payments:
                z_score = abs(float(p.amount) - mean) / std_dev if std_dev > 0 else 0
                if z_score >= threshold:
                    anomalies.append({
                        "type": "payment",
                        "id": str(p.id),
                        "reference": p.payment_number,
                        "amount": float(p.amount),
                        "date": str(p.payment_date),
                        "z_score": round(z_score, 2),
                        "reason": f"Amount {float(p.amount):,.2f} is {z_score:.1f} std devs from mean ({mean:,.2f})",
                    })

        # Analyze invoices
        if len(invoices) >= 3:
            amounts = [float(inv.total) for inv in invoices]
            mean = sum(amounts) / len(amounts)
            variance = sum((a - mean) ** 2 for a in amounts) / len(amounts)
            std_dev = math.sqrt(variance) if variance > 0 else 1

            for inv in invoices:
                z_score = abs(float(inv.total) - mean) / std_dev if std_dev > 0 else 0
                if z_score >= threshold:
                    anomalies.append({
                        "type": "invoice",
                        "id": str(inv.id),
                        "reference": inv.invoice_number,
                        "amount": float(inv.total),
                        "date": str(inv.issue_date),
                        "z_score": round(z_score, 2),
                        "reason": f"Amount {float(inv.total):,.2f} is {z_score:.1f} std devs from mean ({mean:,.2f})",
                    })

        anomalies.sort(key=lambda x: x["z_score"], reverse=True)

        return {
            "period_days": days_back,
            "threshold": threshold,
            "total_payments_analyzed": len(payments),
            "total_invoices_analyzed": len(invoices),
            "anomalies_found": len(anomalies),
            "anomalies": anomalies[:20],  # Top 20
        }

    # ── AI Lead Scoring ──────────────────────────────────────────────────

    async def _exec_score_lead(self, lead_id: str) -> dict[str, Any]:
        """Score a CRM lead 0-100 based on activity, estimated value, source, and status."""
        from app.models.crm import Contact, Lead, Opportunity  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415

        result = await self.db.execute(
            select(Lead).where(Lead.id == uuid.UUID(lead_id))
        )
        lead = result.scalar_one_or_none()
        if not lead:
            return {"error": f"Lead '{lead_id}' not found."}

        score = 0
        factors: list[str] = []

        # Factor 1: Estimated value (0-25 points)
        if lead.estimated_value:
            val = float(lead.estimated_value)
            if val >= 100000:
                score += 25
                factors.append(f"High estimated value ({val:,.0f}): +25")
            elif val >= 50000:
                score += 20
                factors.append(f"Good estimated value ({val:,.0f}): +20")
            elif val >= 10000:
                score += 15
                factors.append(f"Moderate estimated value ({val:,.0f}): +15")
            elif val > 0:
                score += 8
                factors.append(f"Low estimated value ({val:,.0f}): +8")
        else:
            factors.append("No estimated value: +0")

        # Factor 2: Lead source quality (0-15 points)
        source_scores = {"referral": 15, "website": 12, "inbound": 12, "partner": 10, "cold_call": 5, "other": 3}
        src = (lead.source or "other").lower()
        src_score = source_scores.get(src, 5)
        score += src_score
        factors.append(f"Source '{src}': +{src_score}")

        # Factor 3: Lead status progression (0-20 points)
        status_scores = {"new": 5, "contacted": 10, "qualified": 20, "converted": 20, "unqualified": 0}
        st_score = status_scores.get(lead.status, 5)
        score += st_score
        factors.append(f"Status '{lead.status}': +{st_score}")

        # Factor 4: Has contact info (0-15 points)
        contact_score = 0
        if lead.contact_id:
            contact_result = await self.db.execute(
                select(Contact).where(Contact.id == lead.contact_id)
            )
            contact = contact_result.scalar_one_or_none()
            if contact:
                if contact.email:
                    contact_score += 5
                if contact.phone:
                    contact_score += 5
                if contact.company_name:
                    contact_score += 5
        score += contact_score
        factors.append(f"Contact completeness: +{contact_score}")

        # Factor 5: Has linked opportunities (0-15 points)
        opp_count_result = await self.db.execute(
            select(func.count()).select_from(Opportunity).where(
                Opportunity.lead_id == lead.id
            )
        )
        opp_count = opp_count_result.scalar() or 0
        opp_score = min(opp_count * 5, 15)
        score += opp_score
        factors.append(f"Linked opportunities ({opp_count}): +{opp_score}")

        # Factor 6: Recency (0-10 points)
        if lead.created_at:
            days_old = (datetime.now(timezone.utc) - lead.created_at).days
            if days_old <= 7:
                recency_score = 10
            elif days_old <= 30:
                recency_score = 7
            elif days_old <= 90:
                recency_score = 4
            else:
                recency_score = 1
            score += recency_score
            factors.append(f"Lead age ({days_old} days): +{recency_score}")

        score = min(score, 100)

        # Categorize
        if score >= 80:
            category = "Hot"
        elif score >= 60:
            category = "Warm"
        elif score >= 40:
            category = "Cool"
        else:
            category = "Cold"

        return {
            "lead_id": lead_id,
            "title": lead.title,
            "score": score,
            "category": category,
            "factors": factors,
            "result": f"Lead '{lead.title}' scored {score}/100 ({category}). Factors:\n" + "\n".join(f"  {f}" for f in factors),
        }

    # ── AI Demand Forecasting ────────────────────────────────────────────

    async def _exec_demand_forecast(
        self,
        item_id: str = "",
        sku: str = "",
        periods_ahead: int = 3,
    ) -> dict[str, Any]:
        """Forecast demand using simple moving average + trend detection on stock movements."""
        from app.models.inventory import InventoryItem, StockMovement  # noqa: PLC0415
        from sqlalchemy import func, extract, and_, or_  # noqa: PLC0415
        import math  # noqa: PLC0415

        # Find item
        conditions = []
        if item_id:
            conditions.append(InventoryItem.id == uuid.UUID(item_id))
        if sku:
            conditions.append(InventoryItem.sku == sku)
        if not conditions:
            return {"error": "Provide either item_id or sku."}

        item_result = await self.db.execute(
            select(InventoryItem).where(or_(*conditions)).limit(1)
        )
        item = item_result.scalar_one_or_none()
        if not item:
            return {"error": f"Item not found (id={item_id}, sku={sku})."}

        # Get last 12 months of outbound movements (issues)
        twelve_months_ago = datetime.now(timezone.utc) - timedelta(days=365)
        result = await self.db.execute(
            select(
                extract("year", StockMovement.created_at).label("yr"),
                extract("month", StockMovement.created_at).label("mo"),
                func.coalesce(func.sum(StockMovement.quantity), 0).label("qty"),
            )
            .where(
                and_(
                    StockMovement.item_id == item.id,
                    StockMovement.movement_type == "issue",
                    StockMovement.created_at >= twelve_months_ago,
                )
            )
            .group_by("yr", "mo")
            .order_by("yr", "mo")
        )
        rows = result.all()

        if len(rows) < 2:
            return {
                "item": item.name,
                "sku": item.sku,
                "error": "Insufficient historical data (need at least 2 months of issue movements).",
            }

        monthly_demand = [abs(int(r.qty)) for r in rows]
        historical = [{"year": int(r.yr), "month": int(r.mo), "demand": abs(int(r.qty))} for r in rows]

        # Simple Moving Average (SMA) with window = min(3, len)
        window = min(3, len(monthly_demand))
        sma = sum(monthly_demand[-window:]) / window

        # Linear trend
        n = len(monthly_demand)
        x_mean = (n - 1) / 2
        y_mean = sum(monthly_demand) / n
        numerator = sum((i - x_mean) * (monthly_demand[i] - y_mean) for i in range(n))
        denominator = sum((i - x_mean) ** 2 for i in range(n))
        slope = numerator / denominator if denominator else 0

        # Forecast
        forecast = []
        now = datetime.now(timezone.utc)
        current_yr, current_mo = now.year, now.month
        for j in range(periods_ahead):
            current_mo += 1
            if current_mo > 12:
                current_mo = 1
                current_yr += 1
            # Weighted: 60% SMA + 40% trend
            trend_val = sma + slope * (j + 1)
            predicted = max(round(0.6 * sma + 0.4 * trend_val), 0)
            forecast.append({"year": current_yr, "month": current_mo, "predicted_demand": predicted})

        trend = "increasing" if slope > 0.5 else "decreasing" if slope < -0.5 else "stable"

        return {
            "item": item.name,
            "sku": item.sku,
            "historical": historical,
            "forecast": forecast,
            "trend": trend,
            "moving_average": round(sma, 1),
            "monthly_trend_slope": round(slope, 2),
            "result": (
                f"Demand forecast for {item.name} (SKU: {item.sku}): trend is {trend}.\n"
                f"SMA({window}): {sma:.0f} units/month, slope: {slope:.1f}\n"
                + "\n".join(f"  {f['year']}-{f['month']:02d}: ~{f['predicted_demand']} units" for f in forecast)
            ),
        }

    # ── AI Reorder Point Optimization ───────────────────────────────────

    async def _exec_optimize_reorder_point(self, item_id: str) -> dict[str, Any]:
        """Analyze stock movements and suggest optimal reorder point and quantity."""
        from app.models.inventory import InventoryItem, StockMovement  # noqa: PLC0415
        from sqlalchemy import func, and_  # noqa: PLC0415
        import math  # noqa: PLC0415

        # Find item
        item_result = await self.db.execute(
            select(InventoryItem).where(InventoryItem.id == uuid.UUID(item_id))
        )
        item = item_result.scalar_one_or_none()
        if not item:
            return {"error": f"Item not found (id={item_id})."}

        # Get last 90 days of outbound movements (issues)
        ninety_days_ago = datetime.now(timezone.utc) - timedelta(days=90)
        result = await self.db.execute(
            select(StockMovement)
            .where(
                and_(
                    StockMovement.item_id == item.id,
                    StockMovement.movement_type == "issue",
                    StockMovement.created_at >= ninety_days_ago,
                )
            )
            .order_by(StockMovement.created_at)
        )
        movements = result.scalars().all()

        if not movements:
            return {
                "item_id": str(item.id),
                "item_name": item.name,
                "sku": item.sku,
                "error": "No outbound stock movements in the last 90 days. Cannot optimize reorder point.",
            }

        # Calculate average daily usage
        total_qty = sum(abs(m.quantity) for m in movements)
        first_movement = movements[0].created_at
        last_movement = movements[-1].created_at
        date_range_days = max((last_movement - first_movement).days, 1)
        avg_daily_usage = total_qty / date_range_days

        # Calculate usage variability (standard deviation of daily usage)
        daily_quantities: dict[int, float] = {}
        for m in movements:
            day_key = (m.created_at - first_movement).days
            daily_quantities[day_key] = daily_quantities.get(day_key, 0) + abs(m.quantity)

        daily_values = list(daily_quantities.values())
        if len(daily_values) > 1:
            mean_daily = sum(daily_values) / len(daily_values)
            variance = sum((v - mean_daily) ** 2 for v in daily_values) / (len(daily_values) - 1)
            std_daily = math.sqrt(variance)
        else:
            std_daily = avg_daily_usage * 0.3  # fallback: assume 30% variability

        # Estimate lead time (default 7 days if not available on item)
        lead_time_days = getattr(item, "lead_time_days", None) or 7

        # Safety stock = Z * std_daily * sqrt(lead_time)
        # Z = 1.65 for 95% service level
        z_score = 1.65
        safety_stock = round(z_score * std_daily * math.sqrt(lead_time_days))

        # Reorder point = (avg_daily_usage * lead_time) + safety_stock
        reorder_point = round(avg_daily_usage * lead_time_days + safety_stock)

        # Economic Order Quantity (simplified): EOQ = sqrt(2 * D * S / H)
        # D = annual demand, S = ordering cost (estimate $50), H = holding cost (estimate 20% of unit cost)
        annual_demand = avg_daily_usage * 365
        ordering_cost = 50.0
        unit_cost = float(getattr(item, "unit_cost", None) or getattr(item, "cost_price", None) or 10.0)
        holding_cost = unit_cost * 0.20
        if holding_cost > 0:
            eoq = round(math.sqrt(2 * annual_demand * ordering_cost / holding_cost))
        else:
            eoq = round(annual_demand / 12)  # fallback: 1 month supply

        # Ensure minimum reorder quantity
        reorder_quantity = max(eoq, 1)

        current_stock = getattr(item, "quantity_on_hand", None) or getattr(item, "stock_quantity", None) or 0

        reasoning_lines = [
            f"Analysis based on {len(movements)} outbound movements over {date_range_days} days.",
            f"Average daily usage: {avg_daily_usage:.1f} units/day.",
            f"Usage variability (std dev): {std_daily:.1f} units/day.",
            f"Estimated lead time: {lead_time_days} days.",
            f"Safety stock (95% service level): {safety_stock} units.",
            f"Reorder point: {reorder_point} units (triggers reorder when stock falls to this level).",
            f"Suggested order quantity (EOQ): {reorder_quantity} units.",
            f"Current stock: {current_stock} units.",
        ]
        if current_stock <= reorder_point:
            reasoning_lines.append("WARNING: Current stock is at or below reorder point — consider ordering now.")

        return {
            "item_id": str(item.id),
            "item_name": item.name,
            "sku": item.sku,
            "current_stock": current_stock,
            "avg_daily_usage": round(avg_daily_usage, 2),
            "lead_time_days": lead_time_days,
            "safety_stock": safety_stock,
            "reorder_point": reorder_point,
            "reorder_quantity": reorder_quantity,
            "reasoning": reasoning_lines,
            "result": (
                f"Reorder optimization for {item.name} (SKU: {item.sku}):\n"
                + "\n".join(f"  {line}" for line in reasoning_lines)
            ),
        }

    # ── AI Ticket Classification ─────────────────────────────────────────

    async def _exec_classify_ticket(self, ticket_id: str) -> dict[str, Any]:
        """Classify a ticket by analyzing subject/description against existing categories and patterns."""
        from app.models.support import Ticket, TicketCategory  # noqa: PLC0415
        from app.models.user import User  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415

        result = await self.db.execute(
            select(Ticket).where(Ticket.id == uuid.UUID(ticket_id))
        )
        ticket = result.scalar_one_or_none()
        if not ticket:
            return {"error": f"Ticket '{ticket_id}' not found."}

        text = f"{ticket.subject} {ticket.description or ''}".lower()

        # Get categories
        cats_result = await self.db.execute(
            select(TicketCategory).where(TicketCategory.is_active == True)  # noqa: E712
        )
        categories = cats_result.scalars().all()

        # Simple keyword matching for category suggestion
        suggested_category = None
        best_score = 0
        for cat in categories:
            cat_words = set(cat.name.lower().split())
            if cat.description:
                cat_words.update(cat.description.lower().split())
            matches = sum(1 for w in cat_words if w in text and len(w) > 2)
            if matches > best_score:
                best_score = matches
                suggested_category = cat

        # Priority suggestion based on keywords
        urgent_keywords = {"urgent", "critical", "emergency", "asap", "down", "broken", "crash", "outage", "blocked"}
        high_keywords = {"important", "error", "fail", "bug", "issue", "problem", "cannot", "unable"}
        low_keywords = {"question", "how to", "feature request", "suggestion", "nice to have", "info"}

        text_words = set(text.split())
        if text_words & urgent_keywords:
            suggested_priority = "urgent"
        elif text_words & high_keywords:
            suggested_priority = "high"
        elif text_words & low_keywords:
            suggested_priority = "low"
        else:
            suggested_priority = "medium"

        # Suggest assignee: find user who handles the most tickets in this category
        suggested_assignee = None
        if suggested_category:
            agent_result = await self.db.execute(
                select(Ticket.assigned_to, func.count().label("cnt"))
                .where(
                    Ticket.category_id == suggested_category.id,
                    Ticket.assigned_to.isnot(None),
                )
                .group_by(Ticket.assigned_to)
                .order_by(func.count().desc())
                .limit(1)
            )
            top_agent = agent_result.first()
            if top_agent:
                user_result = await self.db.execute(
                    select(User).where(User.id == top_agent[0])
                )
                user = user_result.scalar_one_or_none()
                if user:
                    suggested_assignee = {"id": str(user.id), "name": user.full_name, "email": user.email}

        return {
            "ticket_id": ticket_id,
            "ticket_number": ticket.ticket_number,
            "suggested_category": {
                "id": str(suggested_category.id),
                "name": suggested_category.name,
            } if suggested_category else None,
            "suggested_priority": suggested_priority,
            "current_priority": ticket.priority,
            "suggested_assignee": suggested_assignee,
            "result": (
                f"Ticket {ticket.ticket_number} classification:\n"
                f"  Category: {suggested_category.name if suggested_category else 'Unknown'}\n"
                f"  Priority: {suggested_priority} (current: {ticket.priority})\n"
                f"  Assignee: {suggested_assignee['name'] if suggested_assignee else 'No suggestion'}"
            ),
        }

    # ── AI Suggested Response ────────────────────────────────────────────

    async def _exec_suggest_response(self, ticket_id: str) -> dict[str, Any]:
        """Generate a suggested reply for a support ticket using KB articles and context."""
        from app.models.support import KnowledgeBaseArticle, Ticket, TicketComment  # noqa: PLC0415

        result = await self.db.execute(
            select(Ticket).where(Ticket.id == uuid.UUID(ticket_id))
        )
        ticket = result.scalar_one_or_none()
        if not ticket:
            return {"error": f"Ticket '{ticket_id}' not found."}

        # Get ticket comments
        comments_result = await self.db.execute(
            select(TicketComment)
            .where(TicketComment.ticket_id == ticket.id)
            .order_by(TicketComment.created_at)
        )
        comments = comments_result.scalars().all()

        # Search KB for relevant articles
        keywords = ticket.subject.split()[:5]  # Use first 5 words
        kb_articles = []
        for kw in keywords:
            if len(kw) > 3:
                kb_result = await self.db.execute(
                    select(KnowledgeBaseArticle).where(
                        KnowledgeBaseArticle.status == "published",
                        KnowledgeBaseArticle.title.ilike(like_pattern(kw)),
                    ).limit(2)
                )
                kb_articles.extend(kb_result.scalars().all())

        # Deduplicate
        seen_ids: set[uuid.UUID] = set()
        unique_articles = []
        for a in kb_articles:
            if a.id not in seen_ids:
                seen_ids.add(a.id)
                unique_articles.append(a)

        # Build context for LLM
        context_parts = [
            f"Subject: {ticket.subject}",
            f"Description: {ticket.description or 'No description'}",
            f"Priority: {ticket.priority}",
            f"Status: {ticket.status}",
        ]
        if comments:
            context_parts.append("Previous comments:")
            for c in comments[-5:]:  # Last 5 comments
                context_parts.append(f"  - {c.content[:200]}")
        if unique_articles:
            context_parts.append("Relevant KB articles:")
            for a in unique_articles[:3]:
                context_parts.append(f"  - {a.title}: {(a.content or '')[:200]}")

        ticket_context = "\n".join(context_parts)

        # Generate response using LLM
        prompt = (
            "You are a helpful customer support agent. Based on the following ticket context "
            "and knowledge base articles, draft a professional and helpful reply to the customer. "
            "Be empathetic, concise, and provide actionable next steps.\n\n"
            f"{ticket_context}"
        )
        suggested_reply = await self._summarize_via_llm(prompt, "support ticket reply")

        return {
            "ticket_id": ticket_id,
            "ticket_number": ticket.ticket_number,
            "suggested_reply": suggested_reply,
            "kb_articles_used": [{"title": a.title, "id": str(a.id)} for a in unique_articles[:3]],
            "result": f"Suggested reply for {ticket.ticket_number}:\n\n{suggested_reply}",
        }

    # ── AI KB Article Generation ─────────────────────────────────────────

    async def _exec_generate_kb_article(self, ticket_id: str) -> dict[str, Any]:
        """Generate a KB article from a resolved ticket's conversation."""
        from app.models.support import KnowledgeBaseArticle, Ticket, TicketComment  # noqa: PLC0415
        import re  # noqa: PLC0415

        result = await self.db.execute(
            select(Ticket).where(Ticket.id == uuid.UUID(ticket_id))
        )
        ticket = result.scalar_one_or_none()
        if not ticket:
            return {"error": f"Ticket '{ticket_id}' not found."}

        if ticket.status not in ("resolved", "closed"):
            return {"error": f"Ticket must be resolved or closed (current: {ticket.status})."}

        # Get all comments
        comments_result = await self.db.execute(
            select(TicketComment)
            .where(TicketComment.ticket_id == ticket.id)
            .order_by(TicketComment.created_at)
        )
        comments = comments_result.scalars().all()

        # Build conversation text
        conversation_parts = [
            f"Issue: {ticket.subject}",
            f"Description: {ticket.description or 'No description'}",
        ]
        for c in comments:
            role = "Agent" if c.is_internal else "Customer"
            conversation_parts.append(f"{role}: {c.content}")

        conversation_text = "\n\n".join(conversation_parts)

        # Generate article using LLM
        prompt = (
            "Based on the following resolved support ticket conversation, create a knowledge base article. "
            "Format the article with:\n"
            "1. A clear, searchable title\n"
            "2. A brief problem description\n"
            "3. Step-by-step solution\n"
            "4. Any additional notes or tips\n\n"
            f"{conversation_text}"
        )
        article_content = await self._summarize_via_llm(prompt, "KB article")

        # Extract title from the generated content (first line)
        lines = article_content.strip().split("\n")
        title = lines[0].strip("#").strip() if lines else f"KB: {ticket.subject}"
        # Clean up title
        title = re.sub(r"^(title:\s*|#\s*)", "", title, flags=re.IGNORECASE).strip()
        if not title:
            title = f"KB: {ticket.subject}"

        # Create slug
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
        slug = f"{slug}-{str(uuid.uuid4())[:8]}"

        # Create the KB article
        kb_article = KnowledgeBaseArticle(
            title=title,
            slug=slug,
            content=article_content,
            category_id=ticket.category_id,
            status="draft",
            author_id=self.user_id,
            tags=[ticket.ticket_number],
        )
        self.db.add(kb_article)
        await self.db.commit()
        await self.db.refresh(kb_article)

        return {
            "status": "created",
            "article_id": str(kb_article.id),
            "title": title,
            "slug": slug,
            "result": f"KB article '{title}' created as draft from ticket {ticket.ticket_number}.",
        }

    # ── AI Meeting Summarization (enhanced) ──────────────────────────────

    async def _exec_summarize_meeting_notes(
        self,
        meeting_notes: str,
        event_id: str | None = None,
    ) -> dict[str, Any]:
        """Summarize meeting notes into structured format with action items."""
        prompt = (
            "Analyze the following meeting notes and provide a structured summary with:\n"
            "1. **Meeting Summary** (2-3 sentences)\n"
            "2. **Key Decisions** (bullet points)\n"
            "3. **Action Items** (who, what, when — bullet points)\n"
            "4. **Open Questions** (if any)\n\n"
            f"{meeting_notes}"
        )
        summary = await self._summarize_via_llm(prompt, "meeting notes")

        result_dict: dict[str, Any] = {
            "status": "ok",
            "summary": summary,
            "result": f"Meeting summary:\n\n{summary}",
        }

        # If event_id provided, update the calendar event description
        if event_id:
            from app.models.calendar import CalendarEvent  # noqa: PLC0415

            event_result = await self.db.execute(
                select(CalendarEvent).where(CalendarEvent.id == uuid.UUID(event_id))
            )
            event = event_result.scalar_one_or_none()
            if event:
                event.description = (event.description or "") + f"\n\n--- AI Summary ---\n{summary}"
                await self.db.commit()
                result_dict["event_updated"] = True

        return result_dict

    # ── AI Calendar: Schedule Meeting ────────────────────────────────────

    async def _exec_schedule_meeting(
        self,
        title: str,
        attendee_emails: list[str],
        duration_minutes: int = 60,
        preferred_date: str | None = None,
        description: str | None = None,
    ) -> dict[str, Any]:
        """Find free slots and create a meeting event."""
        from app.models.calendar import CalendarEvent  # noqa: PLC0415
        from app.models.user import User  # noqa: PLC0415

        # Resolve attendee user IDs
        attendee_ids: list[str] = []
        for email in attendee_emails:
            user_result = await self.db.execute(
                select(User).where(User.email == email)
            )
            user = user_result.scalar_one_or_none()
            if user:
                attendee_ids.append(str(user.id))

        # Determine date range to search
        if preferred_date:
            search_date = datetime.fromisoformat(preferred_date).replace(tzinfo=timezone.utc)
        else:
            search_date = datetime.now(timezone.utc) + timedelta(days=1)

        # Check 9 AM to 5 PM on the preferred date
        all_user_ids = attendee_ids + [str(self.user_id)]
        day_start = search_date.replace(hour=9, minute=0, second=0, microsecond=0)
        day_end = search_date.replace(hour=17, minute=0, second=0, microsecond=0)

        # Get existing events for all attendees on that day
        existing_events = []
        for uid in all_user_ids:
            events_result = await self.db.execute(
                select(CalendarEvent).where(
                    CalendarEvent.organizer_id == uuid.UUID(uid),
                    CalendarEvent.start_time >= day_start,
                    CalendarEvent.end_time <= day_end,
                )
            )
            existing_events.extend(events_result.scalars().all())

        # Build busy slots
        busy_slots = [(e.start_time, e.end_time) for e in existing_events]
        busy_slots.sort(key=lambda x: x[0])

        # Find first available slot
        duration = timedelta(minutes=duration_minutes)
        slot_start = day_start
        found_slot = None

        while slot_start + duration <= day_end:
            slot_end = slot_start + duration
            conflict = False
            for busy_start, busy_end in busy_slots:
                if slot_start < busy_end and slot_end > busy_start:
                    conflict = True
                    slot_start = busy_end
                    break
            if not conflict:
                found_slot = (slot_start, slot_end)
                break

        if not found_slot:
            # Try next day
            next_day = search_date + timedelta(days=1)
            found_slot = (
                next_day.replace(hour=9, minute=0, second=0, microsecond=0),
                next_day.replace(hour=9, minute=0, second=0, microsecond=0) + duration,
            )

        # Create the event
        event = CalendarEvent(
            title=title,
            start_time=found_slot[0],
            end_time=found_slot[1],
            event_type="meeting",
            description=description,
            organizer_id=self.user_id,
            attendees=attendee_ids,
        )
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)

        return {
            "status": "created",
            "event_id": str(event.id),
            "title": title,
            "start_time": found_slot[0].isoformat(),
            "end_time": found_slot[1].isoformat(),
            "attendees": attendee_emails,
            "result": (
                f"Meeting '{title}' scheduled for {found_slot[0].strftime('%Y-%m-%d %H:%M')} "
                f"to {found_slot[1].strftime('%H:%M')} with {', '.join(attendee_emails)}."
            ),
        }

    # ── AI Calendar: Check Availability ──────────────────────────────────

    async def _exec_check_availability(
        self,
        user_emails: list[str],
        date: str,
    ) -> dict[str, Any]:
        """Check free/busy status for users on a given date."""
        from app.models.calendar import CalendarEvent  # noqa: PLC0415
        from app.models.user import User  # noqa: PLC0415

        check_date = datetime.fromisoformat(date).replace(tzinfo=timezone.utc)
        day_start = check_date.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = check_date.replace(hour=23, minute=59, second=59, microsecond=0)

        availability: list[dict[str, Any]] = []

        for email in user_emails:
            user_result = await self.db.execute(
                select(User).where(User.email == email)
            )
            user = user_result.scalar_one_or_none()
            if not user:
                availability.append({"email": email, "status": "user_not_found"})
                continue

            events_result = await self.db.execute(
                select(CalendarEvent).where(
                    CalendarEvent.organizer_id == user.id,
                    CalendarEvent.start_time >= day_start,
                    CalendarEvent.end_time <= day_end,
                ).order_by(CalendarEvent.start_time)
            )
            events = events_result.scalars().all()

            busy_slots = [
                {
                    "title": e.title,
                    "start": e.start_time.strftime("%H:%M"),
                    "end": e.end_time.strftime("%H:%M"),
                }
                for e in events
            ]

            # Calculate free hours (business hours 9-17)
            busy_minutes = sum(
                (min(e.end_time, day_end) - max(e.start_time, day_start)).total_seconds() / 60
                for e in events
                if e.start_time < day_end and e.end_time > day_start
            )
            free_hours = max(0, (8 * 60 - busy_minutes) / 60)

            availability.append({
                "email": email,
                "name": user.full_name,
                "date": date,
                "busy_slots": busy_slots,
                "free_hours": round(free_hours, 1),
                "status": "busy" if free_hours < 1 else "available",
            })

        return {
            "date": date,
            "users": availability,
            "result": "\n".join(
                f"  {a['email']}: {a['status']} ({a.get('free_hours', '?')}h free, {len(a.get('busy_slots', []))} meetings)"
                for a in availability
            ),
        }

    # ── AI Mail: Compose Email ───────────────────────────────────────────

    async def _exec_compose_email(
        self,
        instructions: str,
        to: str | None = None,
        tone: str = "formal",
    ) -> dict[str, Any]:
        """Draft an email using the LLM based on instructions."""
        prompt = (
            f"Draft a {tone} email based on these instructions:\n\n"
            f"{instructions}\n\n"
            "Format the output as:\n"
            "Subject: [subject line]\n\n"
            "[email body]\n\n"
            "Do not include greeting placeholders like [Name]. Use natural language."
        )
        draft = await self._summarize_via_llm(prompt, "email draft")

        # Parse subject from draft
        lines = draft.strip().split("\n")
        subject = ""
        body_start = 0
        for i, line in enumerate(lines):
            if line.lower().startswith("subject:"):
                subject = line[8:].strip()
                body_start = i + 1
                break

        body = "\n".join(lines[body_start:]).strip()

        return {
            "status": "drafted",
            "to": to,
            "subject": subject,
            "body": body,
            "result": f"Email drafted:\nTo: {to or '[not specified]'}\nSubject: {subject}\n\n{body[:300]}...",
        }

    # ── AI Mail: Summarize Thread ────────────────────────────────────────

    async def _exec_summarize_thread(self, thread_text: str) -> dict[str, Any]:
        """Summarize an email thread."""
        prompt = (
            "Summarize the following email thread. Include:\n"
            "1. Main topic / subject\n"
            "2. Key points discussed\n"
            "3. Any decisions made\n"
            "4. Outstanding action items\n\n"
            f"{thread_text}"
        )
        summary = await self._summarize_via_llm(prompt, "email thread")
        return {
            "status": "ok",
            "summary": summary,
            "result": f"Thread summary:\n\n{summary}",
        }

    # ── AI Drive: Find File ──────────────────────────────────────────────

    async def _exec_find_file(
        self,
        description: str,
        file_type: str | None = None,
    ) -> dict[str, Any]:
        """Search files by description keywords across Drive."""
        from app.models.drive import DriveFile  # noqa: PLC0415
        from sqlalchemy import or_  # noqa: PLC0415

        # Extract keywords from description
        keywords = [w for w in description.split() if len(w) > 2]
        conditions = []
        for kw in keywords[:5]:
            conditions.append(DriveFile.name.ilike(like_pattern(kw)))

        if not conditions:
            return {"error": "Please provide a more descriptive search term."}

        query = select(DriveFile).where(
            or_(*conditions),
            DriveFile.owner_id == self.user_id,
        )

        if file_type:
            query = query.where(DriveFile.name.ilike(f"%.{file_type}"))

        result = await self.db.execute(query.limit(10))
        files = result.scalars().all()

        if not files:
            return {"result": f"No files found matching '{description}'."}

        return {
            "files": [
                {
                    "id": str(f.id),
                    "name": f.name,
                    "size": f.size,
                    "content_type": f.content_type,
                    "folder_path": f.folder_path,
                }
                for f in files
            ],
            "result": f"Found {len(files)} files:\n" + "\n".join(
                f"  - {f.name} ({f.folder_path}, {f.size} bytes)" for f in files
            ),
        }

    # ── AI Drive: Share File ─────────────────────────────────────────────

    async def _exec_share_file(
        self,
        file_name: str,
        user_emails: list[str],
        permission: str = "view",
    ) -> dict[str, Any]:
        """Share a file with specified users."""
        from app.models.drive import DriveFile  # noqa: PLC0415
        from app.models.file_share import FileShare  # noqa: PLC0415
        from app.models.user import User  # noqa: PLC0415

        # Find file
        file_result = await self.db.execute(
            select(DriveFile).where(
                DriveFile.name.ilike(like_pattern(file_name)),
                DriveFile.owner_id == self.user_id,
            ).limit(1)
        )
        file = file_result.scalar_one_or_none()
        if not file:
            return {"error": f"File '{file_name}' not found in your Drive."}

        shared_with = []
        for email in user_emails:
            user_result = await self.db.execute(
                select(User).where(User.email == email)
            )
            user = user_result.scalar_one_or_none()
            if not user:
                shared_with.append({"email": email, "status": "user_not_found"})
                continue

            share = FileShare(
                file_id=file.id,
                shared_with_user_id=user.id,
                shared_by_user_id=self.user_id,
                permission=permission,
            )
            self.db.add(share)
            shared_with.append({"email": email, "name": user.full_name, "status": "shared"})

        await self.db.commit()

        return {
            "file": file_name,
            "permission": permission,
            "shared_with": shared_with,
            "result": f"File '{file_name}' shared ({permission}) with: " + ", ".join(
                f"{s['email']} ({s['status']})" for s in shared_with
            ),
        }

    # ── AI Drive: Organize Files ─────────────────────────────────────────

    async def _exec_organize_files(self, folder_path: str = "/") -> dict[str, Any]:
        """Analyze files and suggest folder organization."""
        from app.models.drive import DriveFile  # noqa: PLC0415

        result = await self.db.execute(
            select(DriveFile).where(
                DriveFile.folder_path == folder_path,
                DriveFile.owner_id == self.user_id,
            ).limit(100)
        )
        files = result.scalars().all()

        if not files:
            return {"result": f"No files found in '{folder_path}'."}

        # Group by content type
        type_groups: dict[str, list[str]] = {}
        for f in files:
            ct = f.content_type.split("/")[-1] if f.content_type else "other"
            type_groups.setdefault(ct, []).append(f.name)

        # Build suggestion
        suggestions: list[str] = []
        type_folder_map = {
            "pdf": "Documents/PDFs",
            "msword": "Documents/Word",
            "vnd.openxmlformats-officedocument.wordprocessingml.document": "Documents/Word",
            "vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Documents/Spreadsheets",
            "vnd.ms-excel": "Documents/Spreadsheets",
            "vnd.openxmlformats-officedocument.presentationml.presentation": "Documents/Presentations",
            "png": "Images",
            "jpeg": "Images",
            "jpg": "Images",
            "gif": "Images",
            "svg+xml": "Images",
            "mp4": "Videos",
            "webm": "Videos",
            "mp3": "Audio",
            "wav": "Audio",
            "zip": "Archives",
            "x-zip-compressed": "Archives",
        }

        for ct, file_names in type_groups.items():
            folder = type_folder_map.get(ct, f"Other/{ct}")
            suggestions.append(f"Move {len(file_names)} {ct} files to /{folder}/")

        return {
            "folder_path": folder_path,
            "total_files": len(files),
            "type_breakdown": {k: len(v) for k, v in type_groups.items()},
            "suggestions": suggestions,
            "result": (
                f"Folder '{folder_path}' contains {len(files)} files.\n"
                "Suggested organization:\n" + "\n".join(f"  - {s}" for s in suggestions)
            ),
        }

    # ── AI Projects: Log Time ────────────────────────────────────────────

    async def _exec_log_time(
        self,
        task_title: str,
        hours: float,
        description: str | None = None,
    ) -> dict[str, Any]:
        """Log time on a task."""
        from app.models.projects import Task, TimeLog  # noqa: PLC0415

        result = await self.db.execute(
            select(Task).where(
                Task.title.ilike(like_pattern(task_title)),
            ).limit(1)
        )
        task = result.scalar_one_or_none()
        if not task:
            return {"error": f"Task '{task_title}' not found."}

        time_log = TimeLog(
            task_id=task.id,
            user_id=self.user_id,
            hours=hours,
            description=description,
        )
        self.db.add(time_log)
        await self.db.commit()
        await self.db.refresh(time_log)

        return {
            "status": "logged",
            "time_log_id": str(time_log.id),
            "task": task.title,
            "hours": hours,
            "result": f"Logged {hours}h on task '{task.title}'.",
        }

    # ── AI Projects: Estimate Task ───────────────────────────────────────

    async def _exec_estimate_task(
        self,
        task_description: str,
        project_name: str | None = None,
    ) -> dict[str, Any]:
        """Estimate task effort based on historical data from similar tasks."""
        from app.models.projects import Project, Task, TimeLog  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415

        # Find completed tasks with time logs for reference
        query = (
            select(
                Task.title,
                Task.priority,
                func.coalesce(func.sum(TimeLog.hours), 0).label("total_hours"),
            )
            .outerjoin(TimeLog, TimeLog.task_id == Task.id)
            .where(Task.status == "done")
            .group_by(Task.id, Task.title, Task.priority)
            .having(func.sum(TimeLog.hours) > 0)
            .order_by(func.sum(TimeLog.hours).desc())
            .limit(20)
        )

        if project_name:
            query = query.join(Project, Task.project_id == Project.id).where(
                Project.name.ilike(like_pattern(project_name))
            )

        result = await self.db.execute(query)
        historical = result.all()

        if not historical:
            # No historical data — use LLM estimation
            prompt = (
                f"Estimate the effort in hours for the following task:\n\n"
                f"Description: {task_description}\n"
                f"Project: {project_name or 'General'}\n\n"
                "Provide a low, medium, and high estimate in hours."
            )
            estimate = await self._summarize_via_llm(prompt, "task estimation")
            return {
                "method": "ai_estimate",
                "estimate": estimate,
                "result": f"AI estimation for '{task_description}':\n{estimate}",
            }

        # Calculate averages from historical data
        hours_list = [float(h.total_hours) for h in historical]
        avg_hours = sum(hours_list) / len(hours_list)
        min_hours = min(hours_list)
        max_hours = max(hours_list)

        # Use keywords to refine
        desc_lower = task_description.lower()
        complexity_multiplier = 1.0
        if any(w in desc_lower for w in ("complex", "refactor", "migrate", "redesign")):
            complexity_multiplier = 1.5
        elif any(w in desc_lower for w in ("simple", "minor", "fix", "typo", "update")):
            complexity_multiplier = 0.6

        estimate_low = round(min_hours * complexity_multiplier, 1)
        estimate_mid = round(avg_hours * complexity_multiplier, 1)
        estimate_high = round(max_hours * complexity_multiplier, 1)

        return {
            "method": "historical",
            "task_description": task_description,
            "estimate_low_hours": estimate_low,
            "estimate_mid_hours": estimate_mid,
            "estimate_high_hours": estimate_high,
            "based_on_tasks": len(historical),
            "complexity_multiplier": complexity_multiplier,
            "result": (
                f"Estimation for '{task_description}':\n"
                f"  Low: {estimate_low}h | Mid: {estimate_mid}h | High: {estimate_high}h\n"
                f"  Based on {len(historical)} completed tasks (avg {avg_hours:.1f}h)"
            ),
        }

    # ── AI Analytics: Generate Report ────────────────────────────────────

    async def _exec_generate_report(
        self,
        query: str,
        format: str = "summary",
    ) -> dict[str, Any]:
        """Generate an analytics report from a natural language query."""
        from app.models.finance import Invoice, Payment  # noqa: PLC0415
        from app.models.crm import Lead, Opportunity, Deal  # noqa: PLC0415
        from app.models.hr import Employee  # noqa: PLC0415
        from app.models.inventory import InventoryItem  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415
        from datetime import date  # noqa: PLC0415

        query_lower = query.lower()
        report_data: dict[str, Any] = {"query": query, "format": format}

        # Revenue report
        if any(w in query_lower for w in ("revenue", "sales", "income")):
            today = date.today()
            month_start = today.replace(day=1)
            payments = await self.db.execute(
                select(
                    func.count().label("count"),
                    func.coalesce(func.sum(Payment.amount), 0).label("total"),
                ).where(Payment.status == "completed", Payment.payment_date >= month_start)
            )
            row = payments.one()
            invoices = await self.db.execute(
                select(
                    func.count().label("count"),
                    func.coalesce(func.sum(Invoice.total), 0).label("total"),
                ).where(Invoice.issue_date >= month_start)
            )
            inv_row = invoices.one()
            report_data["revenue"] = {
                "period": f"{month_start} to {today}",
                "payments_received": {"count": row.count, "total": float(row.total)},
                "invoices_issued": {"count": inv_row.count, "total": float(inv_row.total)},
            }

        # CRM / Pipeline report
        elif any(w in query_lower for w in ("pipeline", "lead", "deal", "crm", "opportunity")):
            leads = await self.db.execute(
                select(Lead.status, func.count()).group_by(Lead.status)
            )
            lead_data = {r[0]: r[1] for r in leads.all()}
            opps = await self.db.execute(
                select(
                    Opportunity.stage,
                    func.count(),
                    func.coalesce(func.sum(Opportunity.expected_value), 0),
                ).group_by(Opportunity.stage)
            )
            opp_data = [{"stage": r[0], "count": r[1], "value": float(r[2])} for r in opps.all()]
            report_data["crm"] = {
                "leads_by_status": lead_data,
                "pipeline": opp_data,
                "total_pipeline_value": sum(o["value"] for o in opp_data),
            }

        # HR report
        elif any(w in query_lower for w in ("employee", "headcount", "hr", "staff")):
            emp_count = await self.db.execute(
                select(func.count()).select_from(Employee).where(Employee.is_active == True)  # noqa: E712
            )
            report_data["hr"] = {"active_employees": emp_count.scalar() or 0}

        # Inventory report
        elif any(w in query_lower for w in ("inventory", "stock", "warehouse")):
            items = await self.db.execute(
                select(func.count()).select_from(InventoryItem).where(InventoryItem.is_active == True)  # noqa: E712
            )
            report_data["inventory"] = {"active_items": items.scalar() or 0}

        else:
            report_data["note"] = "Could not determine report type. Try queries like 'monthly revenue' or 'CRM pipeline'."

        return {
            **report_data,
            "result": f"Report for '{query}':\n{str(report_data)}",
        }

    # ── AI Analytics: Query Data ─────────────────────────────────────────

    async def _exec_query_data(self, question: str) -> dict[str, Any]:
        """Convert natural language to SQL and execute read-only queries."""
        from sqlalchemy import text  # noqa: PLC0415

        # Map common questions to safe, pre-defined queries
        question_lower = question.lower()

        query_map: dict[str, str] = {
            "invoice": "SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM invoices WHERE issue_date >= date_trunc('month', CURRENT_DATE)",
            "payment": "SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed' AND payment_date >= date_trunc('month', CURRENT_DATE)",
            "employee": "SELECT COUNT(*) as count FROM employees WHERE is_active = true",
            "lead": "SELECT status, COUNT(*) as count FROM crm_leads GROUP BY status",
            "ticket": "SELECT status, COUNT(*) as count FROM tickets GROUP BY status",
            "order": "SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total FROM ecommerce_orders GROUP BY status",
            "item": "SELECT COUNT(*) as count FROM inventory_items WHERE is_active = true",
            "project": "SELECT status, COUNT(*) as count FROM projects GROUP BY status",
            "user": "SELECT COUNT(*) as active_users FROM users WHERE is_active = true",
        }

        # Find matching query
        sql = None
        for keyword, q in query_map.items():
            if keyword in question_lower:
                sql = q
                break

        if not sql:
            return {
                "error": "Could not map question to a safe query. Try asking about invoices, payments, employees, leads, tickets, orders, inventory items, projects, or users.",
            }

        try:
            result = await self.db.execute(text(sql))
            rows = result.mappings().all()
            data = [dict(row) for row in rows]

            # Convert Decimal/datetime to serializable types
            for row in data:
                for k, v in row.items():
                    if hasattr(v, "__float__"):
                        row[k] = float(v)
                    elif hasattr(v, "isoformat"):
                        row[k] = v.isoformat()

            return {
                "question": question,
                "sql": sql,
                "data": data,
                "row_count": len(data),
                "result": f"Query result ({len(data)} rows):\n" + "\n".join(str(r) for r in data[:10]),
            }
        except Exception as e:
            return {"error": f"Query failed: {e}"}

    # ── AI CRM: Next Best Action ─────────────────────────────────────────

    async def _exec_next_best_action(
        self,
        deal_id: str | None = None,
        contact_id: str | None = None,
        opportunity_id: str | None = None,
    ) -> dict[str, Any]:
        """Analyze a deal/contact/opportunity and suggest the next best action."""
        from app.models.crm import Contact, Deal, Lead, Opportunity  # noqa: PLC0415

        context_parts: list[str] = []
        entity_name = ""

        if deal_id:
            result = await self.db.execute(
                select(Deal).where(Deal.id == uuid.UUID(deal_id))
            )
            deal = result.scalar_one_or_none()
            if not deal:
                return {"error": f"Deal '{deal_id}' not found."}
            entity_name = deal.title
            context_parts.append(f"Deal: {deal.title}")
            context_parts.append(f"Value: {float(deal.deal_value):,.2f} {deal.currency}")
            context_parts.append(f"Status: {deal.status}")
            context_parts.append(f"Close date: {deal.close_date}")
            if deal.notes:
                context_parts.append(f"Notes: {deal.notes[:300]}")

        elif opportunity_id:
            result = await self.db.execute(
                select(Opportunity).where(Opportunity.id == uuid.UUID(opportunity_id))
            )
            opp = result.scalar_one_or_none()
            if not opp:
                return {"error": f"Opportunity '{opportunity_id}' not found."}
            entity_name = opp.title
            context_parts.append(f"Opportunity: {opp.title}")
            context_parts.append(f"Stage: {opp.stage}")
            context_parts.append(f"Expected value: {float(opp.expected_value or 0):,.2f}")
            context_parts.append(f"Probability: {opp.probability or 0}%")
            if opp.expected_close_date:
                days_left = (opp.expected_close_date - datetime.now(timezone.utc).date()).days
                context_parts.append(f"Days to expected close: {days_left}")
            if opp.notes:
                context_parts.append(f"Notes: {opp.notes[:300]}")

        elif contact_id:
            result = await self.db.execute(
                select(Contact).where(Contact.id == uuid.UUID(contact_id))
            )
            contact = result.scalar_one_or_none()
            if not contact:
                return {"error": f"Contact '{contact_id}' not found."}
            entity_name = f"{contact.first_name or ''} {contact.last_name or ''}".strip()
            context_parts.append(f"Contact: {entity_name}")
            context_parts.append(f"Type: {contact.contact_type}")
            if contact.company_name:
                context_parts.append(f"Company: {contact.company_name}")
            if contact.email:
                context_parts.append(f"Email: {contact.email}")
            context_parts.append(f"Source: {contact.source or 'Unknown'}")

            # Check for linked leads
            from sqlalchemy import func  # noqa: PLC0415
            leads_result = await self.db.execute(
                select(Lead).where(Lead.contact_id == contact.id).limit(5)
            )
            leads = leads_result.scalars().all()
            if leads:
                context_parts.append(f"Active leads: {len(leads)}")
                for ld in leads:
                    context_parts.append(f"  - {ld.title} ({ld.status}, value: {float(ld.estimated_value or 0):,.0f})")
        else:
            return {"error": "Provide at least one of: deal_id, contact_id, or opportunity_id."}

        context_text = "\n".join(context_parts)

        # Rule-based suggestions
        actions: list[str] = []

        if opportunity_id and opp:  # type: ignore[possibly-undefined]
            stage = opp.stage
            if stage == "prospecting":
                actions.append("Schedule an introductory call or demo to qualify the opportunity")
                actions.append("Send a personalized value proposition email")
            elif stage == "proposal":
                actions.append("Follow up on the proposal — ask for feedback")
                actions.append("Offer a meeting to walk through the proposal details")
            elif stage == "negotiation":
                actions.append("Address any remaining objections")
                actions.append("Prepare final terms and get legal review if needed")
                actions.append("Set a clear timeline for decision")
            elif stage in ("closed_won", "closed_lost"):
                if stage == "closed_won":
                    actions.append("Send onboarding materials and schedule kickoff")
                else:
                    actions.append("Document reasons for loss and schedule a retrospective")
            if opp.probability and opp.probability < 30:
                actions.append("Re-qualify: probability is low — consider whether to continue investing time")

        elif deal_id and deal:  # type: ignore[possibly-undefined]
            if deal.status == "active":
                actions.append("Check in with the client on satisfaction and expansion opportunities")
                actions.append("Schedule a quarterly business review")
            elif deal.status == "completed":
                actions.append("Request a testimonial or case study")
                actions.append("Explore upsell / cross-sell opportunities")

        elif contact_id:
            if not leads:  # type: ignore[possibly-undefined]
                actions.append("Create a lead for this contact to start tracking the opportunity")
            actions.append("Send a follow-up email to maintain the relationship")
            actions.append("Add to a relevant marketing campaign")

        if not actions:
            actions.append("Review the current status and update notes")
            actions.append("Schedule a follow-up within the next 7 days")

        return {
            "entity": entity_name,
            "context": context_text,
            "suggested_actions": actions,
            "result": (
                f"Next best actions for '{entity_name}':\n" +
                "\n".join(f"  {i+1}. {a}" for i, a in enumerate(actions))
            ),
        }

    # ── AI Attrition Prediction ─────────────────────────────────────────

    async def _exec_predict_attrition(self, employee_id: str) -> dict[str, Any]:
        """Predict attrition risk for an employee based on tenure, leave, and performance."""
        from app.models.hr import Employee, LeaveRequest, PerformanceReview  # noqa: PLC0415
        from app.models.user import User  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415
        from datetime import date  # noqa: PLC0415

        emp_result = await self.db.execute(
            select(Employee).where(Employee.id == uuid.UUID(employee_id))
        )
        employee = emp_result.scalar_one_or_none()
        if not employee:
            return {"error": f"Employee '{employee_id}' not found."}

        # Get employee name
        user_result = await self.db.execute(
            select(User).where(User.id == employee.user_id)
        )
        user = user_result.scalar_one_or_none()
        emp_name = user.full_name if user else "Unknown"

        risk_score = 0
        risk_factors: list[str] = []

        # Factor 1: Tenure (0-20 points — shorter tenure = higher risk)
        today = date.today()
        tenure_days = (today - employee.hire_date).days if employee.hire_date else 0
        tenure_years = tenure_days / 365.25
        if tenure_years < 1:
            risk_score += 20
            risk_factors.append(f"Short tenure ({tenure_years:.1f} years): +20 risk")
        elif tenure_years < 2:
            risk_score += 15
            risk_factors.append(f"Moderate tenure ({tenure_years:.1f} years): +15 risk")
        elif tenure_years < 5:
            risk_score += 8
            risk_factors.append(f"Decent tenure ({tenure_years:.1f} years): +8 risk")
        else:
            risk_score += 3
            risk_factors.append(f"Long tenure ({tenure_years:.1f} years): +3 risk")

        # Factor 2: Leave patterns — excessive or increasing leave (0-25 points)
        recent_leaves = await self.db.execute(
            select(func.coalesce(func.sum(LeaveRequest.days), 0)).where(
                LeaveRequest.employee_id == employee.id,
                LeaveRequest.status == "approved",
                LeaveRequest.start_date >= today - timedelta(days=180),
            )
        )
        leave_days_6mo = float(recent_leaves.scalar() or 0)

        sick_leaves = await self.db.execute(
            select(func.coalesce(func.sum(LeaveRequest.days), 0)).where(
                LeaveRequest.employee_id == employee.id,
                LeaveRequest.status == "approved",
                LeaveRequest.leave_type == "sick",
                LeaveRequest.start_date >= today - timedelta(days=180),
            )
        )
        sick_days_6mo = float(sick_leaves.scalar() or 0)

        if leave_days_6mo > 15:
            risk_score += 25
            risk_factors.append(f"High leave usage (last 6 months: {leave_days_6mo} days): +25 risk")
        elif leave_days_6mo > 10:
            risk_score += 15
            risk_factors.append(f"Elevated leave usage (last 6 months: {leave_days_6mo} days): +15 risk")
        elif leave_days_6mo > 5:
            risk_score += 8
            risk_factors.append(f"Normal leave usage (last 6 months: {leave_days_6mo} days): +8 risk")
        else:
            risk_score += 2
            risk_factors.append(f"Low leave usage (last 6 months: {leave_days_6mo} days): +2 risk")

        if sick_days_6mo > 5:
            risk_score += 10
            risk_factors.append(f"Frequent sick leave ({sick_days_6mo} days in 6 months): +10 risk")

        # Factor 3: Performance reviews (0-25 points — low ratings = higher risk)
        reviews_result = await self.db.execute(
            select(PerformanceReview)
            .where(PerformanceReview.employee_id == employee.id)
            .order_by(PerformanceReview.created_at.desc())
            .limit(3)
        )
        reviews = reviews_result.scalars().all()

        if reviews:
            avg_rating = sum(r.rating for r in reviews) / len(reviews)
            if avg_rating <= 2:
                risk_score += 25
                risk_factors.append(f"Low performance rating (avg: {avg_rating:.1f}/5): +25 risk")
            elif avg_rating <= 3:
                risk_score += 15
                risk_factors.append(f"Below-average performance (avg: {avg_rating:.1f}/5): +15 risk")
            elif avg_rating <= 3.5:
                risk_score += 8
                risk_factors.append(f"Average performance (avg: {avg_rating:.1f}/5): +8 risk")
            else:
                risk_score += 2
                risk_factors.append(f"Good performance (avg: {avg_rating:.1f}/5): +2 risk")

            # Check for declining trend
            if len(reviews) >= 2 and reviews[0].rating < reviews[-1].rating:
                risk_score += 10
                risk_factors.append(f"Declining performance trend ({reviews[-1].rating} -> {reviews[0].rating}): +10 risk")
        else:
            risk_score += 10
            risk_factors.append("No performance reviews on record: +10 risk")

        # Factor 4: Employment type (0-10 points)
        if employee.employment_type == "contract":
            risk_score += 10
            risk_factors.append("Contract employee (higher mobility): +10 risk")
        elif employee.employment_type == "intern":
            risk_score += 8
            risk_factors.append("Intern (temporary by nature): +8 risk")

        risk_score = min(risk_score, 100)

        # Risk level
        if risk_score >= 75:
            risk_level = "Critical"
        elif risk_score >= 50:
            risk_level = "High"
        elif risk_score >= 30:
            risk_level = "Medium"
        else:
            risk_level = "Low"

        # Recommendations
        recommendations: list[str] = []
        if risk_score >= 50:
            recommendations.append("Schedule a one-on-one meeting to discuss career goals and satisfaction")
            recommendations.append("Review compensation against market rates")
        if avg_rating <= 3 if reviews else True:
            recommendations.append("Create a personal development plan with clear growth opportunities")
        if leave_days_6mo > 10:
            recommendations.append("Check for burnout symptoms and workload balance")
        if tenure_years < 2:
            recommendations.append("Ensure strong onboarding and mentorship is in place")

        return {
            "employee_id": employee_id,
            "employee_name": emp_name,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "risk_factors": risk_factors,
            "recommendations": recommendations,
            "details": {
                "tenure_years": round(tenure_years, 1),
                "leave_days_6mo": leave_days_6mo,
                "sick_days_6mo": sick_days_6mo,
                "avg_performance_rating": round(avg_rating, 1) if reviews else None,
                "reviews_count": len(reviews),
            },
            "result": (
                f"Attrition risk for {emp_name}: {risk_score}/100 ({risk_level})\n"
                + "\n".join(f"  - {f}" for f in risk_factors)
                + ("\n\nRecommendations:\n" + "\n".join(f"  {i+1}. {r}" for i, r in enumerate(recommendations)) if recommendations else "")
            ),
        }

    # ── AI Payroll Anomaly Detection ─────────────────────────────────────

    async def _exec_detect_payroll_anomalies(self, months_back: int = 6) -> dict[str, Any]:
        """Detect payroll anomalies by comparing payslips against historical patterns using z-scores."""
        from app.models.hr import Employee, Payslip  # noqa: PLC0415
        from app.models.user import User  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415
        from datetime import date  # noqa: PLC0415
        import math  # noqa: PLC0415

        today = date.today()
        cutoff = today - timedelta(days=months_back * 30)

        # Get all payslips in the period grouped by employee
        payslips_result = await self.db.execute(
            select(Payslip)
            .where(Payslip.period_start >= cutoff)
            .order_by(Payslip.employee_id, Payslip.period_start)
        )
        payslips = payslips_result.scalars().all()

        if not payslips:
            return {"anomalies": [], "result": "No payslips found in the specified period."}

        # Group by employee
        emp_payslips: dict[uuid.UUID, list] = {}
        for ps in payslips:
            emp_payslips.setdefault(ps.employee_id, []).append(ps)

        anomalies: list[dict[str, Any]] = []

        for emp_id, slips in emp_payslips.items():
            if len(slips) < 2:
                continue

            gross_amounts = [float(s.gross_pay) for s in slips]
            net_amounts = [float(s.net_pay) for s in slips]
            deduction_amounts = [float(s.deductions_total) for s in slips]

            # Z-score analysis on gross pay
            mean_gross = sum(gross_amounts) / len(gross_amounts)
            variance = sum((a - mean_gross) ** 2 for a in gross_amounts) / len(gross_amounts)
            std_dev = math.sqrt(variance) if variance > 0 else 0

            # Get employee info
            emp_result = await self.db.execute(
                select(Employee).where(Employee.id == emp_id)
            )
            emp = emp_result.scalar_one_or_none()
            emp_name = emp.employee_number if emp else str(emp_id)

            if emp and emp.user_id:
                user_result = await self.db.execute(
                    select(User).where(User.id == emp.user_id)
                )
                user = user_result.scalar_one_or_none()
                if user:
                    emp_name = f"{user.full_name} ({emp.employee_number})"

            for slip in slips:
                reasons: list[str] = []
                gross = float(slip.gross_pay)
                net = float(slip.net_pay)
                deductions = float(slip.deductions_total)

                # Check gross pay anomaly
                if std_dev > 0:
                    z_score = abs(gross - mean_gross) / std_dev
                    if z_score >= 2.0:
                        reasons.append(
                            f"Gross pay {gross:,.2f} deviates {z_score:.1f} std devs from mean {mean_gross:,.2f}"
                        )

                # Check deduction ratio
                if gross > 0:
                    deduction_ratio = deductions / gross
                    mean_ratio = sum(d / g for d, g in zip(deduction_amounts, gross_amounts) if g > 0) / len(gross_amounts)
                    if abs(deduction_ratio - mean_ratio) > 0.15:
                        reasons.append(
                            f"Unusual deduction ratio: {deduction_ratio:.1%} vs avg {mean_ratio:.1%}"
                        )

                # Check for zero or negative net pay
                if net <= 0:
                    reasons.append(f"Net pay is zero or negative: {net:,.2f}")

                if reasons:
                    anomalies.append({
                        "employee_id": str(emp_id),
                        "employee": emp_name,
                        "period": f"{slip.period_start} to {slip.period_end}",
                        "gross_pay": gross,
                        "net_pay": net,
                        "deductions": deductions,
                        "reasons": reasons,
                    })

        anomalies.sort(key=lambda x: len(x["reasons"]), reverse=True)

        return {
            "period_months": months_back,
            "employees_analyzed": len(emp_payslips),
            "payslips_analyzed": len(payslips),
            "anomalies_found": len(anomalies),
            "anomalies": anomalies[:30],
            "result": (
                f"Payroll anomaly check ({months_back} months): analyzed {len(payslips)} payslips "
                f"for {len(emp_payslips)} employees. Found {len(anomalies)} anomalies.\n"
                + "\n".join(
                    f"  - {a['employee']} ({a['period']}): {'; '.join(a['reasons'])}"
                    for a in anomalies[:10]
                )
            ),
        }

    # ── AI Supplier Recommendation ──────────────────────────────────────

    async def _exec_recommend_supplier(
        self,
        item_category: str | None = None,
        budget_limit: float | None = None,
    ) -> dict[str, Any]:
        """Score and rank suppliers using supplier ratings, GRN history, and activity."""
        from app.models.supplychain import GoodsReceivedNote, Supplier, SupplierRating  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415

        # Get active suppliers
        query = select(Supplier).where(Supplier.is_active == True)  # noqa: E712
        suppliers_result = await self.db.execute(query.limit(50))
        suppliers = suppliers_result.scalars().all()

        if not suppliers:
            return {"error": "No active suppliers found."}

        scored_suppliers: list[dict[str, Any]] = []

        for supplier in suppliers:
            # Get latest ratings
            rating_result = await self.db.execute(
                select(SupplierRating)
                .where(SupplierRating.supplier_id == supplier.id)
                .order_by(SupplierRating.created_at.desc())
                .limit(4)
            )
            ratings = rating_result.scalars().all()

            # Get delivery track record (GRNs)
            grn_count_result = await self.db.execute(
                select(func.count()).select_from(GoodsReceivedNote).where(
                    GoodsReceivedNote.supplier_id == supplier.id,
                    GoodsReceivedNote.status == "received",
                )
            )
            completed_deliveries = grn_count_result.scalar() or 0

            # Calculate composite score
            if ratings:
                avg_quality = sum(r.quality_score for r in ratings) / len(ratings)
                avg_delivery = sum(r.delivery_score for r in ratings) / len(ratings)
                avg_price = sum(r.price_score for r in ratings) / len(ratings)
            else:
                avg_quality = 3.0
                avg_delivery = 3.0
                avg_price = 3.0

            # Weighted score: quality 35%, delivery 35%, price 30%
            composite = (avg_quality * 0.35 + avg_delivery * 0.35 + avg_price * 0.30) * 20  # Scale to 0-100

            # Bonus for delivery track record
            if completed_deliveries >= 10:
                composite += 5
            elif completed_deliveries >= 5:
                composite += 3

            # Overall rating bonus
            if supplier.rating:
                composite += supplier.rating * 2

            composite = min(round(composite, 1), 100)

            # Filter by tags/category if specified
            if item_category and supplier.tags:
                tag_match = any(item_category.lower() in t.lower() for t in supplier.tags)
                if not tag_match:
                    composite *= 0.8  # Penalize non-matching category

            scored_suppliers.append({
                "supplier_id": str(supplier.id),
                "name": supplier.name,
                "code": supplier.code,
                "score": composite,
                "quality_score": round(avg_quality, 1),
                "delivery_score": round(avg_delivery, 1),
                "price_score": round(avg_price, 1),
                "completed_deliveries": completed_deliveries,
                "payment_terms": supplier.payment_terms,
                "contact_email": supplier.email,
            })

        # Sort by score descending
        scored_suppliers.sort(key=lambda x: x["score"], reverse=True)

        return {
            "item_category": item_category,
            "suppliers_analyzed": len(scored_suppliers),
            "recommendations": scored_suppliers[:10],
            "result": (
                f"Supplier recommendations" + (f" for '{item_category}'" if item_category else "") + ":\n"
                + "\n".join(
                    f"  {i+1}. {s['name']} (score: {s['score']}, Q: {s['quality_score']}, D: {s['delivery_score']}, P: {s['price_score']})"
                    for i, s in enumerate(scored_suppliers[:10])
                )
            ),
        }

    # ── AI Production Optimization ──────────────────────────────────────

    async def _exec_optimize_production(self) -> dict[str, Any]:
        """Analyze pending work orders, workstation capacity, and material availability to suggest scheduling."""
        from app.models.manufacturing import BOMItem, BillOfMaterials, WorkOrder, WorkStation  # noqa: PLC0415
        from app.models.inventory import InventoryItem, StockLevel  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415

        # Get pending/planned work orders
        wo_result = await self.db.execute(
            select(WorkOrder)
            .where(WorkOrder.status.in_(["draft", "planned"]))
            .order_by(WorkOrder.planned_start.asc().nulls_last())
        )
        work_orders = wo_result.scalars().all()

        if not work_orders:
            return {"suggestions": [], "result": "No pending work orders to optimize."}

        # Get workstations and their capacity
        ws_result = await self.db.execute(
            select(WorkStation).where(WorkStation.is_active == True)  # noqa: E712
        )
        workstations = ws_result.scalars().all()

        # Check in-progress load per workstation
        active_wo_result = await self.db.execute(
            select(WorkOrder.workstation_id, func.count().label("active_count"))
            .where(WorkOrder.status == "in_progress")
            .group_by(WorkOrder.workstation_id)
        )
        ws_load = {r[0]: r[1] for r in active_wo_result.all()}

        suggestions: list[dict[str, Any]] = []

        for wo in work_orders:
            wo_info: dict[str, Any] = {
                "work_order": wo.wo_number,
                "bom_id": str(wo.bom_id),
                "planned_quantity": wo.planned_quantity,
                "issues": [],
                "recommendations": [],
            }

            # Check material availability
            bom_items_result = await self.db.execute(
                select(BOMItem, InventoryItem)
                .join(InventoryItem, BOMItem.item_id == InventoryItem.id)
                .where(BOMItem.bom_id == wo.bom_id)
            )
            bom_rows = bom_items_result.all()
            materials_ok = True

            for bom_item, inv_item in bom_rows:
                needed = float(bom_item.quantity) * wo.planned_quantity
                stock_result = await self.db.execute(
                    select(func.coalesce(func.sum(StockLevel.quantity_on_hand), 0))
                    .where(StockLevel.item_id == inv_item.id)
                )
                on_hand = float(stock_result.scalar() or 0)
                if on_hand < needed:
                    materials_ok = False
                    wo_info["issues"].append(
                        f"Material shortage: {inv_item.name} — need {needed}, have {on_hand}"
                    )

            if materials_ok:
                wo_info["recommendations"].append("Materials available — ready to start production")
            else:
                wo_info["recommendations"].append("Delay production until materials are procured, or reduce batch size")

            # Suggest best workstation (lowest load)
            if workstations:
                best_ws = min(workstations, key=lambda ws: ws_load.get(ws.id, 0))
                current_load = ws_load.get(best_ws.id, 0)
                wo_info["suggested_workstation"] = {
                    "name": best_ws.name,
                    "code": best_ws.code,
                    "current_active_orders": current_load,
                }
                wo_info["recommendations"].append(
                    f"Assign to workstation {best_ws.name} ({best_ws.code}) — "
                    f"lowest load with {current_load} active orders"
                )

            suggestions.append(wo_info)

        return {
            "pending_work_orders": len(work_orders),
            "available_workstations": len(workstations),
            "suggestions": suggestions,
            "result": (
                f"Production optimization: {len(work_orders)} pending work orders, "
                f"{len(workstations)} workstations available.\n"
                + "\n".join(
                    f"  WO {s['work_order']}: " + "; ".join(s["recommendations"][:2])
                    for s in suggestions[:10]
                )
            ),
        }

    # ── AI Predictive Maintenance ───────────────────────────────────────

    async def _exec_predict_maintenance(self, workstation_id: str) -> dict[str, Any]:
        """Analyze maintenance history and workload to predict failures and suggest maintenance."""
        from app.models.manufacturing import MaintenanceSchedule, WorkOrder, WorkStation  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415
        from datetime import date  # noqa: PLC0415

        ws_result = await self.db.execute(
            select(WorkStation).where(WorkStation.id == uuid.UUID(workstation_id))
        )
        workstation = ws_result.scalar_one_or_none()
        if not workstation:
            return {"error": f"Workstation '{workstation_id}' not found."}

        # Get maintenance schedules
        maint_result = await self.db.execute(
            select(MaintenanceSchedule)
            .where(MaintenanceSchedule.workstation_id == workstation.id)
            .order_by(MaintenanceSchedule.next_date.asc())
        )
        schedules = maint_result.scalars().all()

        # Get work order history for this workstation
        today = date.today()
        six_months_ago = today - timedelta(days=180)
        wo_result = await self.db.execute(
            select(func.count().label("total"), func.sum(WorkOrder.completed_quantity).label("output"))
            .where(
                WorkOrder.workstation_id == workstation.id,
                WorkOrder.created_at >= six_months_ago,
            )
        )
        wo_stats = wo_result.one()
        total_wo = wo_stats.total or 0
        total_output = int(wo_stats.output or 0)

        # Analyze overdue maintenance
        overdue_schedules = [s for s in schedules if s.next_date <= today and s.is_active]
        upcoming_schedules = [s for s in schedules if s.next_date > today and s.is_active]

        risk_score = 0
        risk_factors: list[str] = []
        recommendations: list[str] = []

        # Factor 1: Overdue maintenance (0-40 points)
        if overdue_schedules:
            overdue_days = max((today - s.next_date).days for s in overdue_schedules)
            if overdue_days > 30:
                risk_score += 40
                risk_factors.append(f"Maintenance overdue by {overdue_days} days: +40 risk")
            elif overdue_days > 14:
                risk_score += 25
                risk_factors.append(f"Maintenance overdue by {overdue_days} days: +25 risk")
            else:
                risk_score += 15
                risk_factors.append(f"Maintenance overdue by {overdue_days} days: +15 risk")
            recommendations.append(f"Immediately perform {len(overdue_schedules)} overdue maintenance task(s)")

        # Factor 2: Maintenance frequency vs last completed (0-20 points)
        for s in schedules:
            if s.last_completed and s.is_active:
                days_since = (today - s.last_completed).days
                freq_days = {"daily": 1, "weekly": 7, "monthly": 30}.get(s.frequency, 30)
                if days_since > freq_days * 2:
                    risk_score += 10
                    risk_factors.append(f"'{s.description}' last done {days_since} days ago (should be {s.frequency})")

        # Factor 3: High workload (0-20 points)
        if total_wo > 20:
            risk_score += 20
            risk_factors.append(f"High workload: {total_wo} work orders in 6 months: +20 risk")
        elif total_wo > 10:
            risk_score += 10
            risk_factors.append(f"Moderate workload: {total_wo} work orders in 6 months: +10 risk")

        # Factor 4: No scheduled maintenance (0-20 points)
        if not schedules:
            risk_score += 20
            risk_factors.append("No maintenance schedule defined: +20 risk")
            recommendations.append("Create a preventive maintenance schedule for this workstation")

        risk_score = min(risk_score, 100)

        if risk_score >= 70:
            risk_level = "Critical"
        elif risk_score >= 40:
            risk_level = "High"
        elif risk_score >= 20:
            risk_level = "Medium"
        else:
            risk_level = "Low"

        if not recommendations:
            if upcoming_schedules:
                next_maint = upcoming_schedules[0]
                recommendations.append(f"Next scheduled maintenance: '{next_maint.description}' on {next_maint.next_date}")
            recommendations.append("Continue regular preventive maintenance schedule")

        return {
            "workstation_id": workstation_id,
            "workstation_name": workstation.name,
            "workstation_code": workstation.code,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "risk_factors": risk_factors,
            "recommendations": recommendations,
            "details": {
                "total_maintenance_schedules": len(schedules),
                "overdue_tasks": len(overdue_schedules),
                "work_orders_6mo": total_wo,
                "output_6mo": total_output,
            },
            "result": (
                f"Predictive maintenance for {workstation.name} ({workstation.code}): "
                f"risk {risk_score}/100 ({risk_level})\n"
                + "\n".join(f"  - {f}" for f in risk_factors)
                + "\n\nRecommendations:\n"
                + "\n".join(f"  {i+1}. {r}" for i, r in enumerate(recommendations))
            ),
        }

    # ── AI Product Recommendations (E-Commerce) ─────────────────────────

    async def _exec_recommend_products(
        self,
        product_id: str | None = None,
        customer_id: str | None = None,
        limit: int = 5,
    ) -> dict[str, Any]:
        """Recommend products based on co-purchase patterns."""
        from app.models.ecommerce import EcomOrder, EcomProduct  # noqa: PLC0415
        from sqlalchemy import func, text  # noqa: PLC0415

        recommendations: list[dict[str, Any]] = []

        if product_id:
            # Find orders containing this product, then find other products in those orders
            product_result = await self.db.execute(
                select(EcomProduct).where(EcomProduct.id == uuid.UUID(product_id))
            )
            product = product_result.scalar_one_or_none()
            if not product:
                return {"error": f"Product '{product_id}' not found."}

            # Get orders containing this product using raw SQL for order_items join
            try:
                co_purchase_sql = text("""
                    SELECT p.id, p.display_name, p.price, COUNT(*) as co_count
                    FROM ecom_products p
                    JOIN ecom_order_items oi2 ON oi2.product_id = p.id
                    WHERE oi2.order_id IN (
                        SELECT oi1.order_id FROM ecom_order_items oi1
                        WHERE oi1.product_id = :pid
                    )
                    AND p.id != :pid
                    AND p.is_published = true
                    GROUP BY p.id, p.display_name, p.price
                    ORDER BY co_count DESC
                    LIMIT :lim
                """)
                result = await self.db.execute(
                    co_purchase_sql, {"pid": uuid.UUID(product_id), "lim": limit}
                )
                for row in result.mappings().all():
                    recommendations.append({
                        "product_id": str(row["id"]),
                        "name": row["display_name"],
                        "price": float(row["price"]),
                        "co_purchase_count": row["co_count"],
                        "reason": "frequently bought together",
                    })
            except Exception:
                # Fallback: recommend products in same price range
                price = float(product.price)
                fallback_result = await self.db.execute(
                    select(EcomProduct)
                    .where(
                        EcomProduct.is_published == True,  # noqa: E712
                        EcomProduct.id != product.id,
                        EcomProduct.price.between(price * 0.5, price * 2.0),
                    )
                    .limit(limit)
                )
                for p in fallback_result.scalars().all():
                    recommendations.append({
                        "product_id": str(p.id),
                        "name": p.display_name,
                        "price": float(p.price),
                        "reason": "similar price range",
                    })

        elif customer_id:
            # Recommend based on customer's purchase history
            try:
                customer_recs_sql = text("""
                    SELECT p.id, p.display_name, p.price, COUNT(*) as popularity
                    FROM ecom_products p
                    JOIN ecom_order_items oi ON oi.product_id = p.id
                    JOIN ecom_orders o ON o.id = oi.order_id
                    WHERE o.status NOT IN ('cancelled')
                    AND p.id NOT IN (
                        SELECT oi2.product_id FROM ecom_order_items oi2
                        JOIN ecom_orders o2 ON o2.id = oi2.order_id
                        WHERE o2.customer_id = :cid
                    )
                    AND p.is_published = true
                    GROUP BY p.id, p.display_name, p.price
                    ORDER BY popularity DESC
                    LIMIT :lim
                """)
                result = await self.db.execute(
                    customer_recs_sql, {"cid": uuid.UUID(customer_id), "lim": limit}
                )
                for row in result.mappings().all():
                    recommendations.append({
                        "product_id": str(row["id"]),
                        "name": row["display_name"],
                        "price": float(row["price"]),
                        "popularity": row["popularity"],
                        "reason": "popular product not yet purchased",
                    })
            except Exception:
                pass

        if not recommendations:
            # Fallback: most popular products
            popular_result = await self.db.execute(
                select(EcomProduct)
                .where(EcomProduct.is_published == True)  # noqa: E712
                .order_by(EcomProduct.created_at.desc())
                .limit(limit)
            )
            for p in popular_result.scalars().all():
                recommendations.append({
                    "product_id": str(p.id),
                    "name": p.display_name,
                    "price": float(p.price),
                    "reason": "popular product",
                })

        return {
            "product_id": product_id,
            "customer_id": customer_id,
            "recommendations": recommendations,
            "result": (
                f"Product recommendations:\n"
                + "\n".join(
                    f"  - {r['name']} (${r['price']:,.2f}) — {r['reason']}"
                    for r in recommendations
                )
            ),
        }

    # ── AI Pricing Optimization (E-Commerce) ────────────────────────────

    async def _exec_optimize_pricing(self, product_id: str) -> dict[str, Any]:
        """Analyze sales history and demand to suggest optimal pricing for a product."""
        from app.models.ecommerce import EcomOrder, EcomProduct  # noqa: PLC0415
        from sqlalchemy import func, text  # noqa: PLC0415
        import math  # noqa: PLC0415

        product_result = await self.db.execute(
            select(EcomProduct).where(EcomProduct.id == uuid.UUID(product_id))
        )
        product = product_result.scalar_one_or_none()
        if not product:
            return {"error": f"Product '{product_id}' not found."}

        current_price = float(product.price)
        compare_price = float(product.compare_at_price) if product.compare_at_price else None

        # Get sales history for this product
        try:
            sales_sql = text("""
                SELECT
                    oi.unit_price,
                    oi.quantity,
                    o.created_at
                FROM ecom_order_items oi
                JOIN ecom_orders o ON o.id = oi.order_id
                WHERE oi.product_id = :pid
                AND o.status NOT IN ('cancelled')
                ORDER BY o.created_at DESC
                LIMIT 100
            """)
            sales_result = await self.db.execute(sales_sql, {"pid": uuid.UUID(product_id)})
            sales_data = sales_result.mappings().all()
        except Exception:
            sales_data = []

        total_units_sold = sum(int(s.get("quantity", 0)) for s in sales_data)
        total_revenue = sum(float(s.get("unit_price", 0)) * int(s.get("quantity", 0)) for s in sales_data)

        # Price elasticity analysis
        suggestions: list[dict[str, Any]] = []

        if sales_data and total_units_sold > 0:
            avg_selling_price = total_revenue / total_units_sold

            # If selling below compare_at_price, discount is working
            if compare_price and current_price < compare_price:
                discount_pct = ((compare_price - current_price) / compare_price) * 100
                suggestions.append({
                    "type": "current_discount",
                    "detail": f"Currently {discount_pct:.0f}% off compare price ({compare_price:,.2f})",
                })

            # Suggest price points
            # Conservative: +5% from current
            conservative = round(current_price * 1.05, 2)
            # Moderate: based on avg selling price
            moderate = round(avg_selling_price * 1.10, 2) if avg_selling_price > 0 else round(current_price * 1.10, 2)
            # Aggressive: +15%
            aggressive = round(current_price * 1.15, 2)

            suggestions.append({
                "strategy": "conservative",
                "suggested_price": conservative,
                "expected_impact": "Minimal impact on sales volume, ~5% revenue increase per unit",
            })
            suggestions.append({
                "strategy": "moderate",
                "suggested_price": moderate,
                "expected_impact": "Balanced approach based on historical average selling price",
            })
            suggestions.append({
                "strategy": "aggressive",
                "suggested_price": aggressive,
                "expected_impact": "Higher margin but may reduce sales volume",
            })

            # Volume discount suggestion
            if total_units_sold > 20:
                suggestions.append({
                    "strategy": "volume_discount",
                    "suggested_price": round(current_price * 0.90, 2),
                    "condition": "For orders of 5+ units",
                    "expected_impact": "Encourage bulk purchases, increase total revenue",
                })
        else:
            # No sales data — use cost-plus or competitive analysis
            suggestions.append({
                "strategy": "penetration",
                "suggested_price": round(current_price * 0.90, 2),
                "expected_impact": "Lower price to drive initial sales and gather demand data",
            })
            suggestions.append({
                "strategy": "maintain",
                "suggested_price": current_price,
                "expected_impact": "Keep current price and monitor demand",
            })

        return {
            "product_id": product_id,
            "product_name": product.display_name,
            "current_price": current_price,
            "compare_at_price": compare_price,
            "total_units_sold": total_units_sold,
            "total_revenue": round(total_revenue, 2),
            "suggestions": suggestions,
            "result": (
                f"Pricing analysis for {product.display_name}:\n"
                f"  Current: ${current_price:,.2f} | Units sold: {total_units_sold} | Revenue: ${total_revenue:,.2f}\n"
                + "\n".join(
                    f"  {s.get('strategy', s.get('type', 'info'))}: "
                    + (f"${s['suggested_price']:,.2f}" if 'suggested_price' in s else s.get('detail', ''))
                    for s in suggestions
                )
            ),
        }

    # ── AI Project Risk Analysis ────────────────────────────────────────

    async def _exec_analyze_project_risk(self, project_id: str) -> dict[str, Any]:
        """Analyze project tasks, deadlines, and progress to identify risk factors."""
        from app.models.projects import Project, Task, TimeLog  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415

        project_result = await self.db.execute(
            select(Project).where(Project.id == uuid.UUID(project_id))
        )
        project = project_result.scalar_one_or_none()
        if not project:
            return {"error": f"Project '{project_id}' not found."}

        # Get all tasks
        tasks_result = await self.db.execute(
            select(Task).where(Task.project_id == project.id)
        )
        tasks = tasks_result.scalars().all()

        now = datetime.now(timezone.utc)
        risk_score = 0
        risk_factors: list[str] = []
        recommendations: list[str] = []

        # Factor 1: Overall completion rate
        total_tasks = len(tasks)
        if total_tasks == 0:
            return {
                "project_id": project_id,
                "project_name": project.name,
                "risk_score": 0,
                "risk_level": "Unknown",
                "risk_factors": ["No tasks defined"],
                "recommendations": ["Add tasks to the project to enable risk analysis"],
                "result": f"Project '{project.name}' has no tasks — cannot assess risk.",
            }

        done_tasks = len([t for t in tasks if t.status == "done"])
        in_progress = len([t for t in tasks if t.status == "in_progress"])
        completion_rate = done_tasks / total_tasks

        if completion_rate < 0.25 and project.status == "active":
            risk_score += 15
            risk_factors.append(f"Low completion rate: {completion_rate:.0%} ({done_tasks}/{total_tasks})")

        # Factor 2: Overdue tasks
        overdue_tasks = [
            t for t in tasks
            if t.due_date and t.due_date < now and t.status not in ("done",)
        ]
        if overdue_tasks:
            overdue_pct = len(overdue_tasks) / total_tasks
            if overdue_pct > 0.3:
                risk_score += 25
                risk_factors.append(f"High overdue rate: {len(overdue_tasks)} tasks ({overdue_pct:.0%}) past due")
            elif overdue_pct > 0.1:
                risk_score += 15
                risk_factors.append(f"Some tasks overdue: {len(overdue_tasks)} tasks ({overdue_pct:.0%}) past due")
            else:
                risk_score += 5
                risk_factors.append(f"Minor delays: {len(overdue_tasks)} tasks overdue")
            recommendations.append(f"Address {len(overdue_tasks)} overdue task(s) immediately")

        # Factor 3: Project deadline proximity
        if project.end_date:
            days_remaining = (project.end_date - now).days
            remaining_work = total_tasks - done_tasks
            if days_remaining <= 0:
                risk_score += 25
                risk_factors.append(f"Project deadline passed ({abs(days_remaining)} days ago) with {remaining_work} tasks remaining")
            elif days_remaining < 7 and remaining_work > 3:
                risk_score += 20
                risk_factors.append(f"Tight deadline: {days_remaining} days left, {remaining_work} tasks remaining")
            elif days_remaining < 14 and remaining_work > total_tasks * 0.5:
                risk_score += 10
                risk_factors.append(f"Approaching deadline: {days_remaining} days left, {remaining_work} tasks ({remaining_work/total_tasks:.0%}) remaining")

        # Factor 4: Unassigned tasks
        unassigned = [t for t in tasks if not t.assignee_id and t.status != "done"]
        if unassigned:
            unassigned_pct = len(unassigned) / total_tasks
            if unassigned_pct > 0.3:
                risk_score += 15
                risk_factors.append(f"Many unassigned tasks: {len(unassigned)} ({unassigned_pct:.0%})")
                recommendations.append("Assign owners to unassigned tasks to ensure accountability")
            elif len(unassigned) > 0:
                risk_score += 5
                risk_factors.append(f"Some unassigned tasks: {len(unassigned)}")

        # Factor 5: High-priority tasks not done
        critical_undone = [t for t in tasks if t.priority in ("high", "critical") and t.status != "done"]
        if critical_undone:
            risk_score += len(critical_undone) * 3
            risk_factors.append(f"High/critical priority tasks pending: {len(critical_undone)}")
            recommendations.append("Prioritize completing high-priority tasks first")

        # Factor 6: Stalled tasks (in_progress for too long)
        stalled = [
            t for t in tasks
            if t.status == "in_progress" and t.updated_at and (now - t.updated_at).days > 7
        ]
        if stalled:
            risk_score += len(stalled) * 5
            risk_factors.append(f"Stalled tasks (no update in 7+ days): {len(stalled)}")
            recommendations.append("Follow up on stalled tasks — they may be blocked")

        risk_score = min(risk_score, 100)

        if risk_score >= 70:
            risk_level = "Critical"
        elif risk_score >= 45:
            risk_level = "High"
        elif risk_score >= 20:
            risk_level = "Medium"
        else:
            risk_level = "Low"

        if not recommendations:
            recommendations.append("Project appears on track — maintain current pace")

        return {
            "project_id": project_id,
            "project_name": project.name,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "risk_factors": risk_factors,
            "recommendations": recommendations,
            "details": {
                "total_tasks": total_tasks,
                "done": done_tasks,
                "in_progress": in_progress,
                "overdue": len(overdue_tasks),
                "unassigned": len(unassigned),
                "completion_rate": round(completion_rate * 100, 1),
            },
            "result": (
                f"Project risk analysis for '{project.name}': {risk_score}/100 ({risk_level})\n"
                + "\n".join(f"  - {f}" for f in risk_factors)
                + "\n\nRecommendations:\n"
                + "\n".join(f"  {i+1}. {r}" for i, r in enumerate(recommendations))
            ),
        }

    # ── AI Email Thread Summarization ───────────────────────────────────

    async def _exec_summarize_email_thread(self, thread_id: str) -> dict[str, Any]:
        """Summarize an email thread by querying messages from PostgreSQL."""
        from sqlalchemy import or_  # noqa: PLC0415

        from app.models.mail_storage import MailboxMessage  # noqa: PLC0415

        result = await self.db.execute(
            select(MailboxMessage).where(
                MailboxMessage.user_id == self.user_id,
                or_(
                    MailboxMessage.message_id_header == thread_id,
                    MailboxMessage.in_reply_to == thread_id,
                    MailboxMessage.references.contains(thread_id),
                ),
            ).order_by(MailboxMessage.received_at)
        )
        messages = result.scalars().all()

        if not messages:
            return {"error": f"No emails found in thread '{thread_id}'."}

        # Build thread text
        thread_parts: list[str] = []
        subject = ""
        for msg in messages:
            subject = msg.subject or subject or "No subject"
            from_addr = msg.from_addr or "unknown"
            received = msg.received_at.isoformat() if msg.received_at else ""
            body_text = msg.body_text or ""
            thread_parts.append(f"From: {from_addr} ({received})\n{body_text[:1000]}")

        thread_text = f"Subject: {subject}\n\n" + "\n---\n".join(thread_parts)

        # Summarize using LLM
        prompt = (
            "Summarize the following email thread concisely. Include:\n"
            "1. Main topic\n"
            "2. Key points from each participant\n"
            "3. Decisions made\n"
            "4. Action items (if any)\n"
            "5. Current status / next steps\n\n"
            f"{thread_text}"
        )
        summary = await self._summarize_via_llm(prompt, "email thread")

        return {
            "thread_id": thread_id,
            "subject": subject,
            "message_count": len(messages),
            "summary": summary,
            "result": f"Thread summary ({len(messages)} messages, subject: {subject}):\n\n{summary}",
        }

    # ── AI Smart Email Categorization ───────────────────────────────────

    async def _exec_categorize_email(self, message_id: str) -> dict[str, Any]:
        """Auto-categorize an email by analyzing subject and content with keyword matching + LLM."""
        from app.models.mail_storage import MailboxMessage  # noqa: PLC0415

        # Fetch the email from PostgreSQL
        try:
            msg = await self.db.get(MailboxMessage, uuid.UUID(message_id))
        except (ValueError, AttributeError):
            return {"error": f"Invalid message ID '{message_id}'."}

        if not msg:
            return {"error": f"Message not found in mailbox (ID: '{message_id}')."}

        subject = msg.subject or ""
        body_text = msg.body_text or ""
        from_addr = msg.from_addr or ""

        if not subject and not body_text:
            return {"error": f"Email '{message_id}' has no content to categorize."}

        combined_text = f"{subject} {body_text}".lower()

        # Rule-based categorization
        categories: list[dict[str, Any]] = []

        category_rules = {
            "finance": {"keywords": ["invoice", "payment", "budget", "expense", "billing", "receipt", "tax", "financial"], "color": "#6fd943"},
            "hr": {"keywords": ["leave", "vacation", "salary", "performance", "hiring", "onboarding", "resignation", "payroll"], "color": "#ffa21d"},
            "support": {"keywords": ["issue", "bug", "problem", "error", "help", "support", "ticket", "fix", "broken"], "color": "#ff3a6e"},
            "sales": {"keywords": ["proposal", "quote", "deal", "client", "customer", "pricing", "discount", "order"], "color": "#3ec9d6"},
            "meeting": {"keywords": ["meeting", "call", "agenda", "schedule", "conference", "sync", "standup", "review"], "color": "#51459d"},
            "marketing": {"keywords": ["campaign", "newsletter", "promotion", "brand", "launch", "social media", "content"], "color": "#e83e8c"},
            "project": {"keywords": ["project", "milestone", "deadline", "task", "sprint", "deliverable", "roadmap"], "color": "#6610f2"},
            "legal": {"keywords": ["contract", "agreement", "nda", "compliance", "regulation", "legal", "policy"], "color": "#343a40"},
            "internal": {"keywords": ["memo", "announcement", "update", "notice", "internal", "team"], "color": "#6c757d"},
        }

        for cat_name, cat_info in category_rules.items():
            matches = sum(1 for kw in cat_info["keywords"] if kw in combined_text)
            if matches > 0:
                categories.append({
                    "category": cat_name,
                    "confidence": min(round(matches / len(cat_info["keywords"]) * 100, 1), 100),
                    "matched_keywords": matches,
                    "color": cat_info["color"],
                })

        categories.sort(key=lambda x: x["confidence"], reverse=True)

        # Determine priority
        urgent_signals = ["urgent", "asap", "immediately", "critical", "emergency", "deadline today"]
        is_urgent = any(sig in combined_text for sig in urgent_signals)

        # Sentiment hint
        negative_words = ["complaint", "unhappy", "disappointed", "frustrated", "angry", "unacceptable", "terrible"]
        is_negative = any(w in combined_text for w in negative_words)

        return {
            "message_id": message_id,
            "subject": subject,
            "from": from_addr,
            "categories": categories[:5],
            "primary_category": categories[0]["category"] if categories else "uncategorized",
            "is_urgent": is_urgent,
            "is_negative_sentiment": is_negative,
            "suggested_labels": [c["category"] for c in categories[:3]],
            "result": (
                f"Email categorization for '{subject}':\n"
                f"  Primary: {categories[0]['category'] if categories else 'uncategorized'}\n"
                f"  Labels: {', '.join(c['category'] for c in categories[:3])}\n"
                f"  Urgent: {'Yes' if is_urgent else 'No'}\n"
                f"  Sentiment: {'Negative' if is_negative else 'Neutral/Positive'}"
            ),
        }

    # ── AI Note Auto-Tagging ────────────────────────────────────────────

    async def _exec_auto_tag_note(self, note_id: str) -> dict[str, Any]:
        """Analyze a note's content and suggest relevant tags."""
        from app.models.notes import Note  # noqa: PLC0415

        result = await self.db.execute(
            select(Note).where(Note.id == uuid.UUID(note_id))
        )
        note = result.scalar_one_or_none()
        if not note:
            return {"error": f"Note '{note_id}' not found."}

        title = note.title or ""
        content = note.content or ""
        combined = f"{title} {content}".lower()

        # Rule-based tag suggestions
        tag_rules: dict[str, list[str]] = {
            "meeting": ["meeting", "agenda", "minutes", "attendees", "action items", "standup"],
            "todo": ["todo", "to-do", "task", "action", "follow up", "follow-up", "deadline"],
            "idea": ["idea", "brainstorm", "concept", "proposal", "suggestion", "innovation"],
            "research": ["research", "analysis", "study", "data", "findings", "report"],
            "personal": ["personal", "diary", "journal", "reflection", "thoughts"],
            "technical": ["code", "api", "bug", "feature", "architecture", "database", "deploy"],
            "finance": ["budget", "invoice", "payment", "expense", "revenue", "financial"],
            "project": ["project", "milestone", "sprint", "release", "roadmap", "planning"],
            "client": ["client", "customer", "account", "contract", "proposal", "quote"],
            "hr": ["employee", "hiring", "interview", "onboarding", "performance", "review"],
            "important": ["important", "urgent", "critical", "priority", "asap"],
            "reference": ["reference", "documentation", "guide", "howto", "how-to", "tutorial"],
        }

        suggested_tags: list[dict[str, Any]] = []
        for tag, keywords in tag_rules.items():
            matches = sum(1 for kw in keywords if kw in combined)
            if matches > 0:
                confidence = min(round(matches / len(keywords) * 100, 1), 100)
                suggested_tags.append({
                    "tag": tag,
                    "confidence": confidence,
                    "matched_keywords": matches,
                })

        suggested_tags.sort(key=lambda x: x["confidence"], reverse=True)

        # Also use LLM for more nuanced tagging if content is substantial
        llm_tags: list[str] = []
        if len(combined) > 100:
            prompt = (
                "Analyze the following note and suggest 3-5 short, relevant tags (single words or short phrases). "
                "Return ONLY the tags, one per line, no bullets or numbers.\n\n"
                f"Title: {title}\n\n{content[:2000]}"
            )
            try:
                llm_result = await self._summarize_via_llm(prompt, "tag suggestion")
                llm_tags = [
                    t.strip().lower().strip("#").strip("-").strip("*")
                    for t in llm_result.split("\n")
                    if t.strip() and len(t.strip()) < 30
                ][:5]
            except Exception:
                pass

        # Merge rule-based and LLM tags
        all_tags = [t["tag"] for t in suggested_tags[:5]]
        for lt in llm_tags:
            if lt and lt not in all_tags:
                all_tags.append(lt)

        existing_tags = note.tags or []

        return {
            "note_id": note_id,
            "note_title": note.title,
            "existing_tags": existing_tags,
            "suggested_tags": all_tags[:8],
            "tag_details": suggested_tags[:8],
            "llm_tags": llm_tags,
            "result": (
                f"Tag suggestions for '{note.title}':\n"
                f"  Existing: {', '.join(existing_tags) if existing_tags else 'none'}\n"
                f"  Suggested: {', '.join(all_tags[:8])}"
            ),
        }

    # ── AI Form Generation ──────────────────────────────────────────────

    async def _exec_generate_form(
        self,
        description: str,
        max_fields: int = 10,
    ) -> dict[str, Any]:
        """Generate a form schema from a natural language description using LLM."""
        import json as json_mod  # noqa: PLC0415

        prompt = (
            "Generate a JSON form schema based on this description. Return ONLY valid JSON.\n\n"
            f"Description: {description}\n\n"
            f"Max fields: {max_fields}\n\n"
            "Use this exact JSON structure:\n"
            '{\n'
            '  "title": "Form title",\n'
            '  "description": "Form description",\n'
            '  "fields": [\n'
            '    {\n'
            '      "label": "Field label",\n'
            '      "field_type": "text|textarea|number|email|select|checkbox|radio|date|file",\n'
            '      "is_required": true/false,\n'
            '      "options": ["option1", "option2"] // only for select/radio/checkbox\n'
            '    }\n'
            '  ]\n'
            '}'
        )

        llm_result = await self._summarize_via_llm(prompt, "form generation")

        # Try to parse JSON from LLM response
        form_schema: dict[str, Any] | None = None
        try:
            # Find JSON in the response
            json_start = llm_result.find("{")
            json_end = llm_result.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                form_schema = json_mod.loads(llm_result[json_start:json_end])
        except (json_mod.JSONDecodeError, ValueError):
            pass

        if not form_schema:
            # Fallback: generate a basic form from the description
            form_schema = {
                "title": description[:100],
                "description": description,
                "fields": [
                    {"label": "Name", "field_type": "text", "is_required": True},
                    {"label": "Email", "field_type": "email", "is_required": True},
                    {"label": "Message", "field_type": "textarea", "is_required": False},
                ],
            }

        # Validate and clean the schema
        title = form_schema.get("title", description[:100])
        form_description = form_schema.get("description", description)
        fields = form_schema.get("fields", [])[:max_fields]

        valid_types = {"text", "textarea", "number", "email", "select", "checkbox", "radio", "date", "file"}
        cleaned_fields = []
        for i, field in enumerate(fields):
            ft = field.get("field_type", "text")
            if ft not in valid_types:
                ft = "text"
            cleaned_fields.append({
                "label": field.get("label", f"Field {i+1}"),
                "field_type": ft,
                "is_required": bool(field.get("is_required", False)),
                "options": field.get("options") if ft in ("select", "radio", "checkbox") else None,
                "order": i,
            })

        return {
            "status": "generated",
            "form_schema": {
                "title": title,
                "description": form_description,
                "fields": cleaned_fields,
            },
            "field_count": len(cleaned_fields),
            "result": (
                f"Generated form: '{title}' with {len(cleaned_fields)} fields:\n"
                + "\n".join(
                    f"  {i+1}. {f['label']} ({f['field_type']})"
                    + (" *required" if f["is_required"] else "")
                    for i, f in enumerate(cleaned_fields)
                )
            ),
        }

    # ── AI Document Translation ─────────────────────────────────────────

    async def _exec_translate_document(
        self,
        doc_id: str,
        target_language: str,
    ) -> dict[str, Any]:
        """Translate a document's content to a target language using the LLM."""
        from app.models.drive import DriveFile  # noqa: PLC0415

        # Look for the document in Drive files
        doc_result = await self.db.execute(
            select(DriveFile).where(DriveFile.id == uuid.UUID(doc_id))
        )
        doc = doc_result.scalar_one_or_none()

        if not doc:
            return {"error": f"Document '{doc_id}' not found."}

        # For text-based documents, we can translate the name/metadata
        # For full translation, we'd need to fetch the file content from MinIO
        # Here we use the LLM to translate whatever text content we have
        doc_name = doc.name

        # Try to get content from notes if it's a note-linked doc
        from app.models.notes import Note  # noqa: PLC0415
        note_result = await self.db.execute(
            select(Note).where(Note.title.ilike(like_pattern(doc_name))).limit(1)
        )
        note = note_result.scalar_one_or_none()

        content_to_translate = ""
        if note and note.content:
            content_to_translate = note.content
        else:
            # Use document name as a minimal translation target
            content_to_translate = f"Document: {doc_name}"

        prompt = (
            f"Translate the following text to {target_language}. "
            "Preserve all formatting, headers, and structure. "
            "Return ONLY the translated text without any explanations.\n\n"
            f"{content_to_translate[:5000]}"
        )

        translated = await self._summarize_via_llm(prompt, "document translation")

        return {
            "doc_id": doc_id,
            "doc_name": doc_name,
            "target_language": target_language,
            "original_length": len(content_to_translate),
            "translated_content": translated,
            "result": (
                f"Translated '{doc_name}' to {target_language}.\n\n"
                f"{translated[:500]}{'...' if len(translated) > 500 else ''}"
            ),
        }

    # ── AI File Organization Suggestions ────────────────────────────────

    async def _exec_suggest_file_organization(
        self,
        include_shared: bool = False,
    ) -> dict[str, Any]:
        """Analyze all files in Drive and suggest a comprehensive folder structure."""
        from app.models.drive import DriveFile  # noqa: PLC0415
        from app.models.file_share import FileShare  # noqa: PLC0415
        from sqlalchemy import or_  # noqa: PLC0415

        # Get user's files
        conditions = [DriveFile.owner_id == self.user_id]
        result = await self.db.execute(
            select(DriveFile).where(*conditions).limit(500)
        )
        files = result.scalars().all()

        if include_shared:
            shared_result = await self.db.execute(
                select(DriveFile)
                .join(FileShare, FileShare.file_id == DriveFile.id)
                .where(FileShare.shared_with_user_id == self.user_id)
                .limit(100)
            )
            files.extend(shared_result.scalars().all())

        if not files:
            return {"result": "No files found in your Drive."}

        # Analyze files by multiple dimensions
        by_type: dict[str, list[str]] = {}
        by_folder: dict[str, int] = {}
        by_extension: dict[str, int] = {}
        file_ages: list[int] = []
        now = datetime.now(timezone.utc)

        for f in files:
            # By content type
            ct = f.content_type.split("/")[-1] if f.content_type else "other"
            by_type.setdefault(ct, []).append(f.name)

            # By current folder
            folder = f.folder_path or "/"
            by_folder[folder] = by_folder.get(folder, 0) + 1

            # By extension
            ext = f.name.rsplit(".", 1)[-1].lower() if "." in f.name else "no_ext"
            by_extension[ext] = by_extension.get(ext, 0) + 1

            # Age
            if f.created_at:
                age_days = (now - f.created_at).days
                file_ages.append(age_days)

        # Generate organization suggestions
        suggestions: list[dict[str, Any]] = []

        # Suggestion 1: Type-based folders
        type_folder_map = {
            "pdf": "Documents/PDFs",
            "msword": "Documents/Word",
            "vnd.openxmlformats-officedocument.wordprocessingml.document": "Documents/Word",
            "vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Documents/Spreadsheets",
            "vnd.ms-excel": "Documents/Spreadsheets",
            "vnd.openxmlformats-officedocument.presentationml.presentation": "Documents/Presentations",
            "png": "Images", "jpeg": "Images", "jpg": "Images", "gif": "Images", "svg+xml": "Images",
            "mp4": "Videos", "webm": "Videos", "avi": "Videos",
            "mp3": "Audio", "wav": "Audio", "ogg": "Audio",
            "zip": "Archives", "x-zip-compressed": "Archives", "x-tar": "Archives",
        }

        for ct, file_names in by_type.items():
            if len(file_names) >= 2:
                target_folder = type_folder_map.get(ct, f"Other/{ct}")
                suggestions.append({
                    "action": "group_by_type",
                    "target_folder": f"/{target_folder}/",
                    "file_count": len(file_names),
                    "description": f"Move {len(file_names)} {ct} files to /{target_folder}/",
                })

        # Suggestion 2: Root folder cleanup
        root_files = by_folder.get("/", 0)
        if root_files > 10:
            suggestions.append({
                "action": "cleanup_root",
                "file_count": root_files,
                "description": f"Root folder has {root_files} files — consider organizing into subfolders",
            })

        # Suggestion 3: Archive old files
        if file_ages:
            old_files = sum(1 for age in file_ages if age > 180)
            if old_files > 5:
                suggestions.append({
                    "action": "archive_old",
                    "file_count": old_files,
                    "description": f"{old_files} files are older than 6 months — consider moving to an Archive folder",
                })

        # Suggestion 4: Date-based organization
        if len(files) > 20:
            suggestions.append({
                "action": "date_folders",
                "description": "Consider organizing files into year/month folders (e.g., /2026/03/) for easier browsing",
            })

        return {
            "total_files": len(files),
            "files_by_type": {k: len(v) for k, v in by_type.items()},
            "files_by_folder": by_folder,
            "files_by_extension": by_extension,
            "suggestions": suggestions,
            "proposed_structure": {
                "Documents": {"PDFs": [], "Word": [], "Spreadsheets": [], "Presentations": []},
                "Images": [],
                "Videos": [],
                "Audio": [],
                "Archives": [],
                "Projects": [],
                "Shared": [],
            },
            "result": (
                f"File organization analysis: {len(files)} files across {len(by_folder)} folders.\n"
                f"Types: {', '.join(f'{k}: {len(v)}' for k, v in sorted(by_type.items(), key=lambda x: -len(x[1]))[:5])}\n\n"
                "Suggestions:\n"
                + "\n".join(f"  {i+1}. {s['description']}" for i, s in enumerate(suggestions))
            ),
        }
