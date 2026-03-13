"""Seed the Handbook with content from project documentation.

Usage:
    docker compose exec backend python -m scripts.seed_handbook
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.handbook import HandbookArticle, HandbookCategory
from app.models.user import User


def _uid() -> uuid.UUID:
    return uuid.uuid4()


def _slug(text: str) -> str:
    import re
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _read_time(text: str) -> int:
    words = len(text.split())
    return max(1, round(words / 200))


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------
CATEGORIES: list[dict] = [
    {
        "name": "Getting Started",
        "slug": "getting-started",
        "description": "Quick-start guides and onboarding for Urban Vibes Dynamics.",
        "icon": "🚀",
        "sort_order": 0,
        "module": None,
    },
    {
        "name": "Architecture",
        "slug": "architecture",
        "description": "System design, service topology, and technical architecture.",
        "icon": "🏗",
        "sort_order": 1,
        "module": None,
    },
    {
        "name": "Modules",
        "slug": "modules",
        "description": "Detailed guides for each ERP module.",
        "icon": "📦",
        "sort_order": 2,
        "module": None,
    },
    {
        "name": "Integrations",
        "slug": "integrations",
        "description": "How Urban Vibes Dynamics integrates with open-source services.",
        "icon": "🔌",
        "sort_order": 3,
        "module": None,
    },
    {
        "name": "Deployment",
        "slug": "deployment",
        "description": "Deployment guides, production setup, and infrastructure.",
        "icon": "🚢",
        "sort_order": 4,
        "module": None,
    },
    {
        "name": "Development",
        "slug": "development",
        "description": "Developer guides, conventions, and contribution workflows.",
        "icon": "💻",
        "sort_order": 5,
        "module": None,
    },
    {
        "name": "API Reference",
        "slug": "api-reference",
        "description": "REST API endpoint documentation for all modules.",
        "icon": "📡",
        "sort_order": 6,
        "module": None,
    },
    {
        "name": "Finance",
        "slug": "finance",
        "description": "Accounting, invoicing, payments, and financial reporting.",
        "icon": "💰",
        "sort_order": 10,
        "module": "finance",
    },
    {
        "name": "HR & Payroll",
        "slug": "hr-payroll",
        "description": "Employee management, leave, attendance, and payroll.",
        "icon": "👥",
        "sort_order": 11,
        "module": "hr",
    },
    {
        "name": "CRM",
        "slug": "crm",
        "description": "Customer relationship management, leads, and deals.",
        "icon": "🤝",
        "sort_order": 12,
        "module": "crm",
    },
    {
        "name": "Projects",
        "slug": "projects",
        "description": "Project management, Kanban boards, and time tracking.",
        "icon": "📋",
        "sort_order": 13,
        "module": "projects",
    },
    {
        "name": "Inventory",
        "slug": "inventory",
        "description": "Warehouse management, stock tracking, and purchase orders.",
        "icon": "📦",
        "sort_order": 14,
        "module": "inventory",
    },
    {
        "name": "Supply Chain",
        "slug": "supply-chain",
        "description": "Supplier management, procurement, and goods receiving.",
        "icon": "🔗",
        "sort_order": 15,
        "module": "supply-chain",
    },
    {
        "name": "Manufacturing",
        "slug": "manufacturing",
        "description": "Production management, BOMs, and quality control.",
        "icon": "🏭",
        "sort_order": 16,
        "module": "manufacturing",
    },
    {
        "name": "Point of Sale",
        "slug": "pos",
        "description": "In-store sales terminal and session management.",
        "icon": "🛒",
        "sort_order": 17,
        "module": "pos",
    },
    {
        "name": "E-Commerce",
        "slug": "ecommerce",
        "description": "Online store, product catalog, and order management.",
        "icon": "🛍",
        "sort_order": 18,
        "module": "ecommerce",
    },
    {
        "name": "Communication",
        "slug": "communication",
        "description": "Mail, calendar, meetings, and notes.",
        "icon": "✉",
        "sort_order": 19,
        "module": None,
    },
    {
        "name": "Support",
        "slug": "support",
        "description": "Help desk and ticket management.",
        "icon": "🎫",
        "sort_order": 20,
        "module": "support",
    },
]


# ---------------------------------------------------------------------------
# Articles
# ---------------------------------------------------------------------------
ARTICLES: list[dict] = [
    # ── Getting Started ──────────────────────────────────────────────
    {
        "title": "Welcome to Urban Vibes Dynamics",
        "slug": "welcome-to-urban-vibes-dynamics",
        "category_slug": "getting-started",
        "article_type": "quickstart",
        "module": None,
        "tags": ["onboarding", "overview"],
        "sort_order": 0,
        "is_pinned": True,
        "excerpt": "A complete overview of Urban Vibes Dynamics — what it is, what it replaces, and how to get started.",
        "content_markdown": """# Welcome to Urban Vibes Dynamics

Urban Vibes Dynamics is a **fully self-hosted ERP platform** that consolidates Microsoft 365 + Google Workspace + traditional ERP into a single Docker Compose stack. Zero external API dependencies for core functionality. 100% code ownership.

## What Urban Vibes Dynamics Replaces

| Traditional Tool | Urban Vibes Dynamics Equivalent |
|-----------------|---------------------|
| Microsoft Outlook / Gmail | Y&U Mails (Stalwart) |
| Microsoft Word / Google Docs | Y&U Docs (ONLYOFFICE) |
| Microsoft Excel / Google Sheets | Y&U Excel (ONLYOFFICE) |
| Microsoft Teams / Zoom | Y&U Teams (Jitsi) |
| Google Calendar | Y&U Calendar |
| Google Drive / SharePoint | Y&U Drive (MinIO) |
| Microsoft OneNote / Notion | Y&U Notes |
| Google Forms | Y&U Forms |
| Salesforce | Y&U CRM |
| QuickBooks / Xero | Y&U Finance |
| BambooHR | Y&U HR & Payroll |
| Jira / Asana | Y&U Projects |
| Shopify | Y&U E-Commerce |
| Square POS | Y&U POS |
| Zendesk | Y&U Support |
| Power BI | Y&U Analytics |

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite + TanStack Query + Zustand + Tailwind CSS
- **Backend:** Python FastAPI + SQLAlchemy 2.0 (async) + Alembic
- **Database:** PostgreSQL 16 with pgvector for AI embeddings
- **Queue:** Celery + Redis
- **AI:** Ollama (local, primary) with OpenAI/Anthropic/Grok fallback
- **File Storage:** MinIO (S3-compatible)
- **Engines:** ONLYOFFICE (docs) + Jitsi (video)
- **Mail:** Stalwart (Rust-based, IMAP/SMTP/CalDAV/CardDAV)

## Quick Start

1. Clone the repository and copy the environment file
2. Run `docker compose up -d --build`
3. Apply migrations: `docker compose exec backend alembic upgrade head`
4. Open http://localhost:3010 and log in with the super admin credentials from `.env`

## Service URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3010 |
| Backend API (Swagger) | http://localhost:8010/docs |
| MinIO Console | http://localhost:9011 |
| Stalwart Admin | http://localhost:8082 |

## Navigation

Use the **left sidebar** to navigate between modules. The **app launcher** (grid icon) provides quick access to all applications. Use **Cmd+K** (or Ctrl+K) to search across all modules instantly.

## Getting Help

- Browse this Handbook for detailed guides on each module
- Use the **AI Assistant** (Cmd+Shift+A) to ask questions or perform actions
- Check the Getting Started category for step-by-step quickstart guides
""",
        "ai_shortcut_prompt": "What modules are available in Urban Vibes Dynamics and what does each one do?",
    },
    {
        "title": "Your First 10 Minutes",
        "slug": "first-10-minutes",
        "category_slug": "getting-started",
        "article_type": "quickstart",
        "module": None,
        "tags": ["onboarding", "quickstart"],
        "sort_order": 1,
        "is_pinned": True,
        "excerpt": "A quick walkthrough of essential tasks to complete when you first log in.",
        "content_markdown": """# Your First 10 Minutes in Urban Vibes Dynamics

Follow these steps to set up your workspace after your first login.

## Step 1: Update Your Profile

Navigate to your profile by clicking your avatar in the top-right corner. Set your:
- Full name and display photo
- Time zone and language preference
- Notification preferences

## Step 2: Explore the Dashboard

The **Home** page (Urban Board) shows:
- Quick stats across all modules
- Recent activity feed
- AI-powered insights
- Shortcut tiles to your most-used modules

## Step 3: Set Up Your Module

Depending on your role, start with the module most relevant to you:

### If you're in Finance
- Go to **Finance > Accounts** to review the chart of accounts
- Create your first invoice under **Finance > Invoices**

### If you're in HR
- Visit **HR > Departments** to set up your org structure
- Add employees under **HR > Employees**

### If you're in Sales/CRM
- Head to **CRM > Contacts** to import your first contacts
- Set up your deal pipeline under **CRM > Pipeline**

### If you manage Projects
- Create your first project under **Projects**
- Add tasks and invite team members

## Step 4: Try the AI Assistant

Press **Cmd+Shift+A** (or click the AI icon) to open the AI sidebar. Try asking:
- "Show me a summary of today's activity"
- "Create a new invoice for $500"
- "What tasks are due this week?"

## Step 5: Set Up Notifications

Go to **Settings > Notifications** to configure which events trigger alerts. You can receive notifications for:
- New assignments
- Approval requests
- Stock alerts
- Invoice payments

> **Pro Tip:** Use Cmd+K to quickly search and navigate to any page, contact, invoice, or project across the entire system.
""",
        "ai_shortcut_prompt": "Help me set up my Urban Vibes Dynamics workspace. What should I configure first?",
    },

    # ── Architecture ─────────────────────────────────────────────────
    {
        "title": "System Architecture Overview",
        "slug": "system-architecture-overview",
        "category_slug": "architecture",
        "article_type": "guide",
        "module": None,
        "tags": ["architecture", "technical", "design"],
        "sort_order": 0,
        "excerpt": "Understand the system design principles, service topology, and technical architecture of Urban Vibes Dynamics.",
        "content_markdown": """# System Architecture Overview

## Design Principles

1. **Total Independence** -- All services run inside Docker containers on private infrastructure. No SaaS dependencies, no "call home" risks.
2. **Single Orchestrator** -- FastAPI is the sole entry point. No direct app-to-app calls. All communication flows through the central backend.
3. **Shared Database** -- Single PostgreSQL 16 instance with pgvector. All modules share one schema with proper isolation via RBAC.
4. **Event-Driven** -- Redis pub/sub event bus enables loose coupling between modules. Cross-module side effects happen via event handlers.
5. **Async First** -- SQLAlchemy 2.0 async with asyncpg, async FastAPI endpoints, async service methods.

## Service Topology

The system runs 14 Docker containers:

| Service | Port | Purpose |
|---------|------|---------|
| Frontend (React/Vite) | 3010 | Web UI |
| Backend (FastAPI) | 8010 | API server |
| PostgreSQL + pgvector | 5433 | Primary database |
| Redis | 6380 | Cache + message broker |
| MinIO | 9010/9011 | S3-compatible file storage |
| Ollama | 11435 | Local AI/LLM |
| Stalwart | 8082 | Mail server (IMAP/SMTP) |
| ONLYOFFICE | 8083 | Document editing engine |
| Jitsi (4 containers) | 8443 | Video conferencing |
| Celery Worker | -- | Background task processing |
| Celery Beat | -- | Scheduled task orchestration |

## Backend Layer Structure

```
API Layer (Routers)       -> Request validation, auth checks, response formatting
Service Layer             -> Business logic, cross-module coordination
Model Layer (SQLAlchemy)  -> Database entities, relationships
Core Layer                -> Config, DB sessions, security, events, RBAC
```

## Event Bus

Redis pub/sub enables cross-module reactivity without tight coupling:

| Event | Triggered Action |
|-------|-----------------|
| `meeting.created` | Auto-create calendar event |
| `invoice.sent` | Notify finance admins, send email |
| `leave.approved` | Create calendar block, notify employee |
| `stock.low` | Trigger reorder alert |
| `file.shared` | Create notification for recipient |
| `po.received` | Update inventory stock levels |

## RBAC System

Three-tier access control:
- **Super Admin** -- full system access, all modules
- **App Admin** -- scoped to specific module (e.g., Finance Admin)
- **User** -- permission-based access via role assignments

## Frontend Architecture

- All feature pages are lazy-loaded with route-level code splitting
- TanStack Query handles server state (caching, refetch)
- Zustand handles client state (auth, UI preferences)
- Centralized Axios instance with JWT token injection

## Security

- JWT access + refresh tokens with bcrypt password hashing
- Security headers: HSTS, CSP, X-Frame-Options
- Redis-backed per-endpoint rate limiting
- SQL input sanitization and XSS prevention via DOMPurify
- Full audit trail for sensitive operations
""",
    },
    {
        "title": "AI System & Tools",
        "slug": "ai-system-and-tools",
        "category_slug": "architecture",
        "article_type": "guide",
        "module": None,
        "tags": ["ai", "architecture", "tools"],
        "sort_order": 1,
        "excerpt": "How Urban Vibes Dynamics's AI system works -- local LLM, tool calling, RAG, and the multi-agent orchestrator.",
        "content_markdown": """# AI System & Tools

Urban Vibes Dynamics includes a powerful AI system that can understand your data and take actions across all modules.

## AI Providers

The system uses a **provider fallback chain**:
1. **Ollama** (default) -- runs models locally, no data leaves your server
2. **OpenAI** -- cloud fallback (optional)
3. **Anthropic** -- cloud fallback (optional)
4. **Grok** -- cloud fallback (optional)

The Super Admin configures which providers are enabled under **Admin > AI Configuration**.

## AI Chat

Access the AI assistant via:
- **Cmd+Shift+A** -- opens the AI sidebar
- The AI icon in the bottom-right corner

The AI can:
- Answer questions about your data across all modules
- Execute actions (create invoices, schedule meetings, etc.)
- Summarize documents, threads, and reports
- Generate content for documents and emails

## AI Tools (55+)

The AI has access to 55+ tools organized by module:

| Module | Example Tools |
|--------|--------------|
| Finance | Create invoice, record payment, get financial summary |
| HR | Look up employee, check leave balance, generate payslip |
| CRM | Search contacts, update deal stage, log activity |
| Inventory | Check stock levels, create purchase order |
| Projects | Create task, update status, log time |
| Calendar | Schedule event, check availability |
| Mail | Draft email, search inbox |

### Tool Approval Tiers

Tools are categorized by risk level:
- **auto_approve** -- safe read operations execute immediately
- **warn** -- actions that modify data show a warning first
- **require_approval** -- high-impact actions (financial, deletion) need explicit user approval

## Urban Bad AI (Multi-Agent System)

For complex tasks, the AI uses a multi-agent orchestrator:

1. **Orchestrator** -- breaks down the request into steps
2. **Researcher** -- gathers relevant data from modules
3. **Verifier** -- validates the plan before execution
4. **Executor** -- carries out approved actions

The agent shows its thinking process in real-time and pauses for approval before executing sensitive operations.

## RAG (Retrieval-Augmented Generation)

Documents and data are embedded using pgvector for semantic search. When you ask a question, the AI:
1. Converts your query to an embedding
2. Finds the most relevant documents via cosine similarity
3. Includes that context in its response

This means the AI's answers are grounded in your actual data, not just general knowledge.
""",
        "ai_shortcut_prompt": "What AI tools are available and what can they do?",
    },

    # ── Module Guides ────────────────────────────────────────────────
    {
        "title": "Finance & Accounting",
        "slug": "finance-accounting-guide",
        "category_slug": "finance",
        "article_type": "guide",
        "module": "finance",
        "tags": ["finance", "accounting", "invoices", "payments"],
        "sort_order": 0,
        "excerpt": "Complete guide to double-entry accounting, invoicing, payments, and financial reporting.",
        "content_markdown": """# Finance & Accounting

## Overview

The Finance module provides full double-entry accounting with invoicing, payments, journal entries, multi-currency support, tax configuration, bank reconciliation, and budgeting.

## Key Features

### Chart of Accounts
Navigate to **Finance > Accounts** to view and manage your chart of accounts. Accounts are organized by type: Assets, Liabilities, Equity, Revenue, and Expenses.

### Invoicing
1. Go to **Finance > Invoices**
2. Click **New Invoice**
3. Select a customer (from CRM contacts) or enter details manually
4. Add line items with quantities, unit prices, and tax rates
5. Save as draft or send immediately

Invoice statuses: Draft -> Sent -> Paid -> Overdue

### Payments
Record payments against invoices under **Finance > Payments**. Payments automatically update invoice status and create corresponding journal entries.

### Journal Entries
For manual double-entry bookkeeping, use **Finance > Journal**. Every entry must balance (debits = credits).

### Reports
- **Profit & Loss** -- revenue vs expenses over a period
- **Balance Sheet** -- assets, liabilities, and equity at a point in time

### Multi-Currency
Configure supported currencies under **Finance > Currencies**. Exchange rates are tracked for automatic conversion.

### Tax Rates
Set up tax rates (VAT, GST, etc.) under **Finance > Tax Rates**. These can be applied to invoice line items.

### Bank Reconciliation
Link bank accounts and reconcile transactions under **Finance > Bank Accounts**.

### Budgets
Create budget allocations per account/department under **Finance > Budgets**. Track actual vs planned spending.

## Cross-Module Integration

- **CRM**: Deals won can auto-create invoices
- **HR**: Payroll creates journal entries
- **Inventory**: Purchase orders impact accounts
- **E-Commerce**: Order revenue tracked in finance
- **AI**: Expense categorization, financial forecasting

## Pro Tips

> Use the AI assistant to quickly create invoices: "Create an invoice for Acme Corp for $5,000 due in 30 days"

> Set up overdue invoice reminders via Celery beat -- they run automatically and notify via email.
""",
        "ai_shortcut_prompt": "How do I create an invoice in the Finance module?",
    },
    {
        "title": "HR & Payroll",
        "slug": "hr-payroll-guide",
        "category_slug": "hr-payroll",
        "article_type": "guide",
        "module": "hr",
        "tags": ["hr", "payroll", "employees", "leave", "attendance"],
        "sort_order": 0,
        "excerpt": "Manage employees, departments, leave, attendance, and payroll processing.",
        "content_markdown": """# HR & Payroll

## Overview

The HR module handles employee management, department structure, leave requests, attendance tracking, and full payroll processing with tax brackets, deductions, and allowances.

## Departments & Employees

### Setting Up Departments
1. Go to **HR > Departments**
2. Create departments matching your org structure
3. Assign a department head for each

### Adding Employees
1. Navigate to **HR > Employees**
2. Click **Add Employee**
3. Fill in personal details, department, position, and employment date
4. An employee number is auto-generated

Each employee is linked to a User account for system access.

## Leave Management

### Submitting Leave
1. Go to **HR > Leave**
2. Click **Request Leave**
3. Select leave type (Annual, Sick, Personal, etc.)
4. Choose dates and add a reason
5. Submit for manager approval

### Approving Leave
Managers see pending requests on their HR dashboard. Approved leave automatically:
- Creates a calendar block for the leave period
- Pushes to CalDAV (syncs with external calendar apps)
- Notifies the employee

### Leave Allocation
Admins can set annual leave allocations per employee under **HR > Leave Allocation**.

## Attendance

- **Check-in/Check-out** tracking via **HR > Attendance**
- Auto-checkout via Celery beat (configurable time)
- Attendance reports by employee/department

## Payroll

### Tax Brackets
Configure tax brackets under **HR > Tax Brackets** before processing payroll.

### Deductions & Allowances
Set up recurring deductions (insurance, pension) and allowances (transport, housing) under **Payroll > Deductions/Allowances**.

### Pay Runs
1. Go to **HR > Pay Runs**
2. Click **Create Pay Run**
3. Select the pay period and employees
4. Review calculated amounts (gross, deductions, tax, net)
5. Approve individual payslips
6. Process the batch

Approved payslips automatically create journal entries in the Finance module.

## Cross-Module Integration

- **Finance**: Payroll journal entries
- **Calendar**: Leave blocks
- **Drive**: Employee documents stored in MinIO
- **AI**: Payroll forecasting, leave trend analysis
""",
        "ai_shortcut_prompt": "Show me the HR onboarding guide for adding new employees",
    },
    {
        "title": "CRM - Customer Relationship Management",
        "slug": "crm-guide",
        "category_slug": "crm",
        "article_type": "guide",
        "module": "crm",
        "tags": ["crm", "contacts", "leads", "deals", "pipeline"],
        "sort_order": 0,
        "excerpt": "Manage contacts, track leads, and close deals with the visual pipeline.",
        "content_markdown": """# CRM - Customer Relationship Management

## Overview

The CRM module helps you manage customer relationships from first contact to closed deal. Track contacts, nurture leads, manage deal pipelines, and log all interactions.

## Contacts

### Adding Contacts
1. Go to **CRM > Contacts**
2. Click **Add Contact**
3. Enter details: name, email, phone, company
4. Contacts can be linked to leads and deals

### Contact Detail
Each contact page shows:
- Contact information and company details
- Related deals and their stages
- Activity history (calls, emails, meetings)
- Linked invoices from Finance

## Leads

### Lead Management
1. Navigate to **CRM > Leads**
2. Create leads with source tracking (website, referral, cold call, etc.)
3. Score leads based on engagement and fit

### Lead Conversion
When a lead is qualified:
1. Click **Convert to Deal** on the lead page
2. A new deal is created with the lead's contact
3. The lead is marked as converted

## Deal Pipeline

### Visual Pipeline
Go to **CRM > Pipeline** for a Kanban-style view of all active deals organized by stage.

### Managing Deals
- Drag deals between stages
- Update deal value and expected close date
- Add activities (calls, meetings, emails)
- When a deal is won, optionally auto-create an invoice

### Pipeline Stages
Default stages: Qualification -> Proposal -> Negotiation -> Closed Won / Closed Lost

## Activities

Log all customer interactions under **CRM > Activities**:
- Phone calls
- Email exchanges
- Meetings
- Notes

## Cross-Module Integration

- **Finance**: Won deals auto-create invoices
- **Mail**: Email history linked to contacts
- **Calendar**: Meetings with contacts
- **Forms**: Form submissions can auto-create leads
- **E-Commerce**: Customer purchase history
- **AI**: Lead scoring, sentiment analysis
""",
        "ai_shortcut_prompt": "How do I set up a deal pipeline in CRM?",
    },
    {
        "title": "Project Management",
        "slug": "project-management-guide",
        "category_slug": "projects",
        "article_type": "guide",
        "module": "projects",
        "tags": ["projects", "kanban", "tasks", "time-tracking"],
        "sort_order": 0,
        "excerpt": "Create projects, manage tasks with Kanban boards, and track time.",
        "content_markdown": """# Project Management

## Overview

The Projects module provides Kanban-style project management with task tracking, subtasks, team collaboration, and time logging.

## Creating a Project

1. Go to **Projects**
2. Click **New Project**
3. Set the project name, description, and status
4. Add team members

## Kanban Board

Each project has a Kanban board with customizable columns (default: To Do, In Progress, Review, Done).

### Managing Tasks
- Click **Add Task** to create a new task in any column
- Drag and drop tasks between columns
- Click a task to view/edit details
- Add subtasks as a checklist within tasks

### Task Details
- Title, description, and priority
- Assignee and due date
- Subtasks with completion tracking
- Time log entries
- Comments and activity feed

## Time Tracking

### Logging Time
1. Open a task
2. Click **Log Time**
3. Enter hours/minutes and a description
4. Time is recorded with timestamps

### Time Reports
View time reports per project under the project's **Time Logs** tab. Reports show:
- Total hours per team member
- Time breakdown by task
- Daily/weekly summaries

## Cross-Module Integration

- **Calendar**: Task deadlines appear as calendar events
- **Finance**: Project costs via time logs
- **Drive**: Project files stored and organized
- **CRM**: Projects can be linked to deals
- **AI**: "Create a task for Sarah in Project Alpha"
""",
        "ai_shortcut_prompt": "How do I create a project and add tasks?",
    },
    {
        "title": "Inventory Management",
        "slug": "inventory-management-guide",
        "category_slug": "inventory",
        "article_type": "guide",
        "module": "inventory",
        "tags": ["inventory", "stock", "warehouse", "purchase-orders"],
        "sort_order": 0,
        "excerpt": "Manage warehouses, track stock levels, and handle purchase orders with automatic reorder alerts.",
        "content_markdown": """# Inventory Management

## Overview

The Inventory module provides complete warehouse management with item tracking, stock movements, purchase orders, and automatic reorder alerts.

## Items

### Adding Items
1. Go to **Inventory > Items**
2. Click **Add Item**
3. Enter: name, SKU, description, unit price, reorder level
4. Assign to a warehouse

### Item Details
Each item shows:
- Current stock level across all warehouses
- Stock movement history
- Active purchase orders
- Reorder status

## Warehouses

Create and manage warehouses under **Inventory > Warehouses**. Each warehouse tracks independent stock levels.

## Stock Movements

Record stock changes under **Inventory > Stock Movements**:
- **In**: goods received (from PO, manual adjustment)
- **Out**: goods shipped (from sales, POS)
- **Transfer**: move stock between warehouses

## Purchase Orders

### Creating a Purchase Order
1. Go to **Inventory > Purchase Orders**
2. Click **New Purchase Order**
3. Select a supplier and add items with quantities
4. Submit the PO

### PO Lifecycle
Draft -> Sent -> Partially Received -> Received

When a PO is received, stock levels are automatically updated.

## Reorder Alerts

When an item's stock falls below its reorder level, an alert is automatically created. View active alerts under **Inventory > Reorder Alerts**.

The system can also trigger a `stock.low` event that:
- Creates a notification for inventory admins
- Can auto-generate a purchase order (configurable)

## Cross-Module Integration

- **Finance**: POs create payable entries
- **Supply Chain**: PO workflow integration
- **POS**: Stock deducted on sale
- **E-Commerce**: Product stock sync
- **AI**: Reorder optimization, stock trend analysis
""",
        "ai_shortcut_prompt": "How do I check current stock levels and create a purchase order?",
    },

    # ── Communication ────────────────────────────────────────────────
    {
        "title": "Mail, Calendar & Meetings",
        "slug": "communication-guide",
        "category_slug": "communication",
        "article_type": "guide",
        "module": None,
        "tags": ["mail", "calendar", "meetings", "communication"],
        "sort_order": 0,
        "excerpt": "Use the built-in email client, calendar, and video conferencing.",
        "content_markdown": """# Mail, Calendar & Meetings

## Y&U Mails

Urban Vibes Dynamics includes a full email client powered by **Stalwart**, a modern Rust-based mail server.

### Features
- Inbox, sent, drafts, trash, and custom folders
- Full-text search across messages
- Attachments saved to Drive
- AI-powered reply suggestions and thread summarization
- CardDAV contact sync with CRM

### Sending Email
1. Go to **Mail**
2. Click **Compose**
3. Enter recipients, subject, and body
4. Attach files from Drive or your computer
5. Send

## Y&U Calendar

A unified calendar that aggregates events from all modules.

### Features
- Month, week, and day views (FullCalendar)
- Recurring events with RRULE support
- CalDAV sync with external apps (Apple Calendar, Thunderbird)
- Color-coded event categories
- Drag-and-drop rescheduling

### Auto-Created Events
Events are automatically created for:
- Scheduled meetings (Jitsi)
- Approved leave periods
- Task deadlines (from Projects)
- Email invitations

## Y&U Teams (Meetings)

Video conferencing powered by **Jitsi Meet**.

### Scheduling a Meeting
1. Go to **Teams** or click **Schedule Meeting** from the calendar
2. Set title, date/time, and duration
3. Add attendees from the user directory
4. A Jitsi room is auto-created with a unique link
5. Meeting appears on all attendees' calendars
6. Email invitations sent via Stalwart

### During a Meeting
- Screen sharing
- Chat
- Recording (saved to Drive)
- AI meeting summarization (post-meeting)
""",
        "ai_shortcut_prompt": "How do I schedule a meeting with my team?",
    },

    # ── Integrations ─────────────────────────────────────────────────
    {
        "title": "Integrated Services",
        "slug": "integrated-services",
        "category_slug": "integrations",
        "article_type": "guide",
        "module": None,
        "tags": ["integrations", "stalwart", "jitsi", "onlyoffice", "minio", "ollama"],
        "sort_order": 0,
        "excerpt": "How Urban Vibes Dynamics integrates with Stalwart (mail), ONLYOFFICE (docs), Jitsi (video), MinIO (files), and Ollama (AI).",
        "content_markdown": """# Integrated Services

Urban Vibes Dynamics integrates five open-source services, all running internally within the Docker stack. No external API calls are made.

## Stalwart (Mail Server)

A modern Rust-based mail server providing:
- **IMAP/SMTP** -- full email client support
- **CalDAV** -- calendar sync with external apps
- **CardDAV** -- contact sync with CRM

All email is stored locally. CalDAV enables bi-directional calendar sync with Apple Calendar, Thunderbird, and other clients.

## ONLYOFFICE (Document Server)

Full Microsoft Office-compatible editing:
- Word documents (.docx)
- Spreadsheets (.xlsx)
- Presentations (.pptx)

Features: real-time co-editing, comments, track changes, version history. Documents are stored in MinIO and opened via JWT-secured editing URLs.

## Jitsi Meet (Video Conferencing)

Self-hosted video conferencing with:
- HD video and audio
- Screen sharing
- In-meeting chat
- Recording support

Jitsi runs as 4 Docker containers (web, prosody, jicofo, jvb). Meetings are JWT-authenticated.

## MinIO (File Storage)

S3-compatible object storage for all file operations:
- Drive file storage
- Document attachments
- Mail attachments
- Invoice PDFs
- Meeting recordings

Access via the MinIO Console at http://localhost:9011.

## Ollama (Local AI)

Runs large language models locally for 100% data privacy:
- Chat completions with streaming
- Document embeddings for RAG search
- Tool calling for cross-module actions

Models are managed via Docker:
```
docker compose exec ollama ollama pull llama3.1
docker compose exec ollama ollama list
```

## Cross-Service Event Flows

Services communicate through the backend event bus:
- **Meeting created** -> calendar event + email invite
- **File shared** -> notification + audit log
- **Invoice sent** -> email via Stalwart + finance notification
- **Leave approved** -> calendar block + CalDAV sync
""",
    },

    # ── Deployment ───────────────────────────────────────────────────
    {
        "title": "Deployment Guide",
        "slug": "deployment-guide",
        "category_slug": "deployment",
        "article_type": "guide",
        "module": None,
        "tags": ["deployment", "docker", "production", "backup"],
        "sort_order": 0,
        "excerpt": "Deploy Urban Vibes Dynamics for development or production with Docker Compose.",
        "content_markdown": """# Deployment Guide

## Development Setup

### Prerequisites
- Docker Engine 24+ and Docker Compose v2
- 8 GB RAM minimum (16 GB recommended)
- 50 GB disk space (SSD recommended)

### Quick Start
```
cp .env.example .env
docker compose up -d --build
docker compose exec backend alembic upgrade head
```

### Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET_KEY` | JWT signing secret |
| `AI_PROVIDER` | AI provider (ollama/openai/anthropic/grok) |
| `MINIO_ACCESS_KEY` | MinIO access credentials |
| `FIRST_SUPERADMIN_EMAIL` | Initial admin email |
| `FIRST_SUPERADMIN_PASSWORD` | Initial admin password |

## Production Deployment

For production, use `docker-compose.prod.yml` which includes:
- Nginx reverse proxy with SSL termination
- Resource limits on all containers
- Restart policies
- No development tools

### SSL Setup
```
./scripts/init-ssl.sh yourdomain.com
```

### Deploy
```
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

## Backup & Restore

### Create Backup
```
docker compose exec postgres pg_dump -U urban urban_vibes_dynamics > backup.sql
```

### Restore
```
docker compose exec -T postgres psql -U urban urban_vibes_dynamics < backup.sql
```

### API-Based Backups
Super Admins can manage backups via **Admin > Backups** or the API.

## Monitoring

- **Health check**: GET /health -- checks all service connectivity
- **Prometheus metrics**: GET /metrics
- **Structured logging**: JSON logs via structlog with request IDs
- View logs: `docker compose logs -f backend frontend`

## Troubleshooting

| Issue | Solution |
|-------|---------|
| Database connection refused | Check `docker compose ps postgres` |
| Migration conflicts | Run `alembic current` then `alembic heads` |
| MinIO access denied | Verify credentials in `.env` |
| Ollama model not found | Run `docker compose exec ollama ollama pull llama3.1` |
| Frontend can't reach backend | Check `VITE_API_URL` and `CORS_ORIGINS` |
""",
    },

    # ── Development ──────────────────────────────────────────────────
    {
        "title": "Developer Guide",
        "slug": "developer-guide",
        "category_slug": "development",
        "article_type": "guide",
        "module": None,
        "tags": ["development", "conventions", "testing", "contributing"],
        "sort_order": 0,
        "excerpt": "Development setup, code conventions, testing, and how to add new modules.",
        "content_markdown": """# Developer Guide

## Local Development

For faster iteration, run backend and frontend locally while keeping infrastructure in Docker:

```
# Start infrastructure only
docker compose up -d postgres redis minio ollama

# Backend (terminal 1)
cd backend && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (terminal 2)
cd frontend && npm install && npm run dev
```

## Backend Conventions

### File Organization
- `api/v1/` -- Routers (one per module, thin HTTP layer)
- `models/` -- SQLAlchemy models (one per domain)
- `services/` -- Business logic (complex operations)
- `core/` -- Shared utilities (never import from modules)

### Patterns
- All endpoints use `async def`
- Database sessions via `DBSession` dependency
- Auth via `CurrentUser` dependency (JWT extraction)
- Admin-only via `SuperAdminUser` or `require_app_admin()`
- Events via `event_bus.emit()` for cross-module side effects

## Frontend Conventions

### File Organization
- `api/` -- API clients (one per module)
- `features/` -- Feature modules (pages + components)
- `components/ui/` -- Radix UI primitives
- `components/layout/` -- Shell, Sidebar, Header

### Patterns
- TanStack Query for server state
- Zustand for client-only state
- React Hook Form + Zod for forms
- Lazy loading for all feature pages
- Path alias: `@/` maps to `./src/`

## Adding a New Module

1. Create model: `backend/app/models/newmodule.py`
2. Create router: `backend/app/api/v1/newmodule.py`
3. Register router in `api/v1/__init__.py`
4. Generate migration: `alembic revision --autogenerate -m "add_newmodule"`
5. Apply migration: `alembic upgrade head`
6. Create API client: `frontend/src/api/newmodule.ts`
7. Create page: `frontend/src/features/newmodule/`
8. Add lazy route in `App.tsx`
9. (Optional) Add AI tools in `services/ai_tools.py`

## Testing

```
# All backend tests
docker compose exec backend pytest

# With coverage
docker compose exec backend pytest --cov=app

# Frontend type check
cd frontend && npx tsc --noEmit
```

## Code Quality

```
# Backend lint + format
ruff check backend/ && ruff format backend/

# Frontend lint
cd frontend && npx eslint src/
```
""",
    },

    # ── API Reference ────────────────────────────────────────────────
    {
        "title": "API Reference Overview",
        "slug": "api-reference-overview",
        "category_slug": "api-reference",
        "article_type": "guide",
        "module": None,
        "tags": ["api", "reference", "endpoints", "rest"],
        "sort_order": 0,
        "excerpt": "REST API endpoint reference for all Urban Vibes Dynamics modules.",
        "content_markdown": """# API Reference

Base URL: `http://localhost:8010/api/v1`

All endpoints require JWT authentication. Include the token as:
```
Authorization: Bearer <access_token>
```

Interactive Swagger docs: http://localhost:8010/docs

## Authentication

| Endpoint | Description |
|----------|-------------|
| `POST /auth/login` | Login, returns access + refresh tokens |
| `POST /auth/register` | Register new user |
| `POST /auth/refresh` | Refresh expired access token |
| `POST /auth/logout` | Invalidate session |

## Core Modules

### Finance
- `GET/POST /finance/accounts` -- Chart of accounts
- `GET/POST /finance/invoices` -- Invoice CRUD
- `POST /finance/invoices/{id}/send` -- Send invoice (triggers email)
- `GET/POST /finance/payments` -- Record payments
- `GET/POST /finance/journal` -- Journal entries (double-entry)
- `GET /finance/reports/pnl` -- Profit & Loss
- `GET /finance/reports/balance-sheet` -- Balance sheet

### HR & Payroll
- `GET/POST /hr/departments` -- Department management
- `GET/POST /hr/employees` -- Employee CRUD
- `GET/POST /hr/leave` -- Leave requests
- `PUT /hr/leave/{id}/approve` -- Approve/reject leave
- `POST /hr/attendance/check-in` -- Attendance check-in
- `POST /hr/pay-runs` -- Create pay run

### CRM
- `GET/POST /crm/contacts` -- Contact management
- `GET/POST /crm/leads` -- Lead tracking
- `PUT /crm/leads/{id}/convert` -- Convert lead to deal
- `GET/POST /crm/deals` -- Deal pipeline
- `GET /crm/pipeline` -- Pipeline Kanban view

### Projects
- `GET/POST /projects/` -- Project CRUD
- `POST /projects/{id}/tasks` -- Create task
- `PUT /projects/tasks/{id}/kanban` -- Kanban drag-and-drop
- `POST /projects/tasks/{id}/time-log` -- Log time

### Inventory
- `GET/POST /inventory/items` -- Item catalog
- `GET/POST /inventory/warehouses` -- Warehouse management
- `POST /inventory/stock-movements` -- Record stock changes
- `GET/POST /inventory/purchase-orders` -- Purchase orders
- `GET /inventory/reorder-alerts` -- Reorder alerts

## Communication

### Mail
- `GET /mail/inbox` -- Inbox messages
- `POST /mail/send` -- Send email

### Calendar
- `GET/POST /calendar/events` -- Calendar events
- `POST /calendar/sync/caldav` -- Force CalDAV sync

### Meetings
- `POST /meetings/` -- Schedule meeting (creates Jitsi room)

## Utility

### Global Search
- `GET /search?q={query}` -- Search across all modules

### Notifications
- `GET /notifications/` -- List notifications
- `PUT /notifications/read-all` -- Mark all read

### Health
- `GET /health` -- Service health check
- `GET /metrics` -- Prometheus metrics

## Common Patterns

- **Pagination**: `?page=1&page_size=20`
- **Filtering**: `?status=active&date_from=2026-01-01`
- **Sorting**: `?sort_by=created_at&sort_order=desc`
- **CSV Export**: Most list endpoints support `/export/csv`
""",
    },

    # ── Supply Chain ─────────────────────────────────────────────────
    {
        "title": "Supply Chain Management",
        "slug": "supply-chain-guide",
        "category_slug": "supply-chain",
        "article_type": "guide",
        "module": "supply-chain",
        "tags": ["supply-chain", "suppliers", "procurement", "grn"],
        "sort_order": 0,
        "excerpt": "Manage suppliers, procurement requisitions, goods receiving, and returns.",
        "content_markdown": """# Supply Chain Management

## Overview

The Supply Chain module manages the full procurement lifecycle: supplier directory, purchase requisitions, goods receiving, and returns.

## Suppliers

Manage your supplier directory under **Supply Chain > Suppliers**. Each supplier record includes:
- Company name and contact details
- Payment terms
- Performance rating
- Linked purchase orders

## Requisitions

### Creating a Requisition
1. Go to **Supply Chain > Requisitions**
2. Click **New Requisition**
3. Specify items needed, quantities, and urgency
4. Submit for approval

Approved requisitions can be converted to Purchase Orders in the Inventory module.

## Goods Received Notes (GRN)

When a shipment arrives:
1. Go to **Supply Chain > GRNs**
2. Create a new GRN against a Purchase Order
3. Verify quantities received vs ordered
4. Submit -- stock levels are automatically updated

## Returns

Track return orders under **Supply Chain > Returns** for defective or incorrect goods.

## Cross-Module Integration

- **Inventory**: GRN receipt updates stock levels
- **Finance**: Procurement costs flow to accounting
- **CRM**: Supplier contacts linked
- **E-Commerce**: Low stock can trigger auto-procurement
""",
        "ai_shortcut_prompt": "How do I receive goods against a purchase order?",
    },
    {
        "title": "Manufacturing",
        "slug": "manufacturing-guide",
        "category_slug": "manufacturing",
        "article_type": "guide",
        "module": "manufacturing",
        "tags": ["manufacturing", "bom", "work-orders", "quality"],
        "sort_order": 0,
        "excerpt": "Manage BOMs, work orders, work stations, and quality checks.",
        "content_markdown": """# Manufacturing

## Overview

The Manufacturing module handles production management with Bills of Materials, work orders, work station management, and quality control.

## Bills of Materials (BOM)

Create BOMs under **Manufacturing > BOMs**:
- Define the finished product
- List component items with quantities
- Set up multi-level BOMs for complex products

## Work Stations

Define your production work stations under **Manufacturing > Work Stations**:
- Station name and capacity
- Operating hours
- Assigned operators

## Work Orders

### Creating a Work Order
1. Go to **Manufacturing > Work Orders**
2. Select a BOM
3. Specify quantity to produce
4. Assign to a work station
5. Set planned start/end dates

### Work Order Lifecycle
Planned -> In Progress -> Completed

When completed, finished goods are added to inventory and components are deducted.

## Quality Checks

Record quality inspections under **Manufacturing > Quality Checks**:
- Link to a work order
- Record pass/fail status
- Add inspection notes
- Track compliance metrics

## Cross-Module Integration

- **Inventory**: BOM components consume stock, finished goods added
- **Finance**: Production cost tracking
- **Supply Chain**: Request materials for production
- **HR**: Assign operators to work stations
""",
        "ai_shortcut_prompt": "How do I create a bill of materials and start a work order?",
    },
    {
        "title": "Point of Sale (POS)",
        "slug": "pos-guide",
        "category_slug": "pos",
        "article_type": "guide",
        "module": "pos",
        "tags": ["pos", "sales", "terminal", "receipts"],
        "sort_order": 0,
        "excerpt": "Use the POS terminal for in-store sales with session management and receipts.",
        "content_markdown": """# Point of Sale (POS)

## Overview

The POS module provides an in-store sales terminal with session management, multiple payment methods, and receipt generation.

## Opening a Session

1. Go to **POS**
2. Click **Open Session**
3. Enter your opening cash balance
4. The POS terminal opens

## Making a Sale

1. Search or browse products in the product grid
2. Click items to add them to the cart
3. Adjust quantities as needed
4. Select payment method (cash, card, etc.)
5. Complete the sale
6. Receipt is generated automatically

## Closing a Session

1. Click **Close Session**
2. Count your cash and enter the closing balance
3. The system calculates any discrepancy
4. Session summary shows total sales, transactions, and payment breakdown

## Cross-Module Integration

- **Inventory**: Stock is automatically deducted on each sale
- **Finance**: Revenue recorded in accounting
- **CRM**: Customer purchase history tracked
- **Mail**: Email receipts to customers
""",
        "ai_shortcut_prompt": "How do I open a POS session and process a sale?",
    },
    {
        "title": "E-Commerce",
        "slug": "ecommerce-guide",
        "category_slug": "ecommerce",
        "article_type": "guide",
        "module": "ecommerce",
        "tags": ["ecommerce", "store", "products", "orders"],
        "sort_order": 0,
        "excerpt": "Set up online stores, manage products with variants, and process orders.",
        "content_markdown": """# E-Commerce

## Overview

The E-Commerce module provides multi-store support with product catalogs, variant management, order processing, and a public storefront API.

## Stores

Create and manage stores under **E-Commerce > Stores**. Each store can have its own:
- Name and branding
- Product catalog
- Order management

## Products

### Adding Products
1. Go to **E-Commerce > Products**
2. Click **Add Product**
3. Enter: name, description, price, images
4. Add variants (size, color, etc.) with individual pricing/stock

### Product Variants
Variants let you offer different options for the same product. Each variant has its own:
- SKU
- Price
- Stock level
- Images

## Orders

### Order Management
View and manage orders under **E-Commerce > Orders**:
- Order details with line items
- Status workflow: Pending -> Processing -> Shipped -> Delivered
- Customer information

### Storefront API
A public API is available for headless commerce:
- `GET /storefront/products` -- public product catalog
- `POST /storefront/cart` -- add to cart
- `POST /storefront/checkout` -- place order

## Cross-Module Integration

- **Inventory**: Product stock sync and deduction
- **Finance**: Order revenue tracking
- **Supply Chain**: Low stock triggers auto-reorder
- **CRM**: Customer data shared across modules
""",
        "ai_shortcut_prompt": "How do I add products and manage my online store?",
    },
    {
        "title": "Support & Help Desk",
        "slug": "support-guide",
        "category_slug": "support",
        "article_type": "guide",
        "module": "support",
        "tags": ["support", "tickets", "help-desk"],
        "sort_order": 0,
        "excerpt": "Manage support tickets, assign agents, and track resolution times.",
        "content_markdown": """# Support & Help Desk

## Overview

The Support module provides a help desk ticket management system with reply threading, agent assignment, and SLA tracking.

## Creating Tickets

1. Go to **Support**
2. Click **New Ticket**
3. Enter: subject, description, priority, and category
4. Submit the ticket

## Managing Tickets

### Ticket Detail
Each ticket page shows:
- Subject and description
- Status, priority, and assigned agent
- Reply thread with timestamps
- Time tracking for SLA compliance

### Status Workflow
Open -> In Progress -> Resolved -> Closed

### Agent Assignment
Admins can assign tickets to agents. Assigned agents receive notifications and can update status.

## Replying to Tickets

1. Open a ticket
2. Type your reply in the reply form
3. Submit -- the customer is notified

## Cross-Module Integration

- **CRM**: Tickets linked to contacts for customer context
- **Projects**: Support issues can be escalated to project tasks
- **Mail**: Ticket replies sent via email
- **AI**: Ticket categorization, suggested responses
""",
        "ai_shortcut_prompt": "How do I create and manage support tickets?",
    },

    # ── Pro Tips ─────────────────────────────────────────────────────
    {
        "title": "Keyboard Shortcuts & Power Tips",
        "slug": "keyboard-shortcuts-power-tips",
        "category_slug": "getting-started",
        "article_type": "pro_tip",
        "module": None,
        "tags": ["shortcuts", "productivity", "tips"],
        "sort_order": 10,
        "excerpt": "Master Urban Vibes Dynamics with keyboard shortcuts and productivity tips.",
        "content_markdown": """# Keyboard Shortcuts & Power Tips

## Global Shortcuts

| Shortcut | Action |
|----------|--------|
| **Cmd+K** (Ctrl+K) | Global search -- find anything across all modules |
| **Cmd+Shift+A** | Toggle AI sidebar |

## Navigation Tips

- Use the **App Launcher** (grid icon in the left rail) to quickly switch between modules
- The **sidebar** shows contextual navigation for the current module
- **Breadcrumbs** at the top of each page show your current location

## Search Tips

The global search (Cmd+K) searches across:
- Inventory items (by name or SKU)
- Employees (by name or employee number)
- CRM contacts (by name, email, or company)
- Invoices (by number or customer name)
- Projects (by name)
- Handbook articles (by title or content)

## AI Tips

The AI assistant understands context. When you're on a specific module page, it automatically knows your context. Try:
- On Finance page: "Show me overdue invoices"
- On HR page: "Who's on leave this week?"
- On Inventory page: "Which items are below reorder level?"

## Data Export

Most list pages support CSV export. Look for the export button in the toolbar.

## Pro Tips

> **Batch Operations**: Many list pages support multi-select for bulk actions (delete, status change, export).

> **Preloading**: Hovering over sidebar links preloads the page for instant navigation.

> **Dark Mode**: Toggle dark mode in Settings > Appearance (coming soon).
""",
    },

    # ── RBAC Guide ───────────────────────────────────────────────────
    {
        "title": "User Roles & Permissions",
        "slug": "user-roles-permissions",
        "category_slug": "getting-started",
        "article_type": "guide",
        "module": None,
        "tags": ["rbac", "roles", "permissions", "admin"],
        "sort_order": 5,
        "excerpt": "Understand the three-tier RBAC system: Super Admin, App Admin, and User roles.",
        "content_markdown": """# User Roles & Permissions

Urban Vibes Dynamics uses a three-tier role-based access control (RBAC) system.

## Role Tiers

### Super Admin
- Full system access across all modules
- Can create App Admins and manage users
- Controls global settings, AI configuration, and backups
- Manages SSO providers and license

### App Admin
- Scoped to a specific module (e.g., Finance Admin, HR Admin)
- Full control within their module including admin features
- Cannot access admin features of other modules
- Created by Super Admin under **Admin > App Admins**

### User
- Access based on assigned role permissions
- Roles define which actions are allowed per module
- Created by Super Admin or App Admin

## Managing Roles

### Creating a Role
1. Go to **Admin > Roles** (Super Admin only)
2. Click **Create Role**
3. Name the role (e.g., "Sales Representative")
4. Check the permissions this role should have
5. Save

### Assigning Roles to Users
1. Go to **Admin > Users**
2. Click on a user
3. Select their role from the dropdown
4. Save

### App Admin Assignment
1. Go to **Admin > App Admins**
2. Select a user
3. Choose the module they should administer
4. They now have full admin access to that specific module

## Permission Examples

| Role | Can Do | Cannot Do |
|------|--------|-----------|
| Finance Admin | Manage all invoices, accounts, reports | Access HR payslips, modify CRM |
| HR Admin | Manage employees, payroll, leave | Access finance accounts, modify inventory |
| Sales Rep | View/edit own deals, contacts | Delete contacts, access admin panels |
| Viewer | Read-only access to assigned modules | Create, edit, or delete anything |
""",
        "ai_shortcut_prompt": "How do I set up user roles and permissions?",
    },
]


async def seed(db: AsyncSession) -> None:
    """Seed handbook categories and articles."""

    # Get first superadmin as author
    result = await db.execute(
        select(User).where(User.is_superadmin == True).limit(1)  # noqa: E712
    )
    author = result.scalar_one_or_none()
    if not author:
        # Fallback: get any user
        result = await db.execute(select(User).limit(1))
        author = result.scalar_one_or_none()
    if not author:
        print("ERROR: No users found in database. Cannot seed handbook.")
        return

    print(f"Using author: {author.full_name} ({author.email})")

    # Check if already seeded
    existing = await db.execute(select(HandbookCategory).limit(1))
    if existing.scalar_one_or_none():
        print("Handbook already has data. Skipping seed.")
        return

    # Create categories
    cat_map: dict[str, HandbookCategory] = {}
    for cat_data in CATEGORIES:
        cat = HandbookCategory(
            id=_uid(),
            **cat_data,
        )
        db.add(cat)
        cat_map[cat_data["slug"]] = cat
    await db.flush()

    print(f"Created {len(cat_map)} categories.")

    # Create articles
    count = 0
    for art_data in ARTICLES:
        category_slug = art_data.pop("category_slug")
        category = cat_map.get(category_slug)

        content = art_data["content_markdown"]
        art = HandbookArticle(
            id=_uid(),
            category_id=category.id if category else None,
            author_id=author.id,
            status="published",
            estimated_read_time=_read_time(content),
            **art_data,
        )
        db.add(art)
        count += 1

    await db.commit()
    print(f"Created {count} articles (all published).")
    print("Handbook seed complete!")


async def main() -> None:
    async with AsyncSessionLocal() as db:
        await seed(db)


if __name__ == "__main__":
    asyncio.run(main())
