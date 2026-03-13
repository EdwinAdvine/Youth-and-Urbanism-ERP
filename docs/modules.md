# Module Guide

> Index of all Urban Vibes Dynamics modules. Click any module for full documentation.

Detailed per-module docs live in `docs/modules/`. This file provides a quick
overview index. For full documentation including architecture, data models,
API endpoints, and workflows, follow the links below.

## Module Index

| Module | Quick Link | Description |
|--------|-----------|-------------|
| Admin | [docs/modules/admin.md](modules/admin.md) | Users, roles, permissions, RBAC, SSO, backups |
| Finance | [docs/modules/finance.md](modules/finance.md) | Accounting, invoicing, payments, reports |
| CRM | [docs/modules/crm.md](modules/crm.md) | Contacts, leads, deals, pipelines, campaigns |
| HR & Payroll | [docs/modules/hr.md](modules/hr.md) | Employees, leave, attendance, payroll |
| Calendar | [docs/modules/calendar.md](modules/calendar.md) | Events, smart scheduling, meetings |
| Projects | [docs/modules/projects.md](modules/projects.md) | Tasks, Kanban, sprints, time tracking |
| Support | [docs/modules/support.md](modules/support.md) | Tickets, SLA, live chat, AI triage |
| AI System | [docs/modules/ai.md](modules/ai.md) | Chat, Urban Bad AI, 55 tools |
| E-Commerce | [docs/modules/ecommerce.md](modules/ecommerce.md) | Online store, products, orders, B2B |
| Inventory | [docs/modules/inventory.md](modules/inventory.md) | Warehouses, stock, purchase orders |
| Supply Chain | [docs/modules/supply-chain.md](modules/supply-chain.md) | Suppliers, procurement, GRN |
| Manufacturing | [docs/modules/manufacturing.md](modules/manufacturing.md) | BOM, work orders, quality, traceability |
| POS | [docs/modules/pos.md](modules/pos.md) | In-store terminal, sessions, receipts |
| Drive & Docs | [docs/modules/drive.md](modules/drive.md) | File management, ONLYOFFICE editing |
| Mail | [docs/modules/mail.md](modules/mail.md) | Full email client, rules, AI features |
| Notes | [docs/modules/notes.md](modules/notes.md) | Rich text notebooks, AI, sharing |
| Chat/Teams | [docs/modules/chat.md](modules/chat.md) | Real-time messaging, video calls |
| Analytics | [docs/modules/analytics.md](modules/analytics.md) | Built-in metrics dashboard |
| Forms | [docs/modules/forms.md](modules/forms.md) | Form builder, responses, CRM integration |
| Booking | [docs/modules/booking.md](modules/booking.md) | Appointment scheduling |

## Core Infrastructure

| Topic | Link |
|-------|------|
| Configuration (env vars) | [docs/core/configuration.md](core/configuration.md) |
| Authentication & RBAC | [docs/core/authentication.md](core/authentication.md) |
| Event Bus | [docs/core/event-bus.md](core/event-bus.md) |
| Database & Migrations | [docs/core/database.md](core/database.md) |

---

## Original Module Breakdown (below)

The detailed per-module breakdown follows below for quick reference. For complete documentation, use the index links above.

---

---

## 1. Admin (Foundation)

**Purpose:** User, team, role, and system management. The backbone of RBAC and platform configuration.

**Models:** User, Role, Permission, AppAdmin

**Backend:** `api/v1/admin.py`, `api/v1/users.py`, `api/v1/roles.py`, `api/v1/app_admin.py`, `api/v1/user_import.py`

**Frontend Pages:**
- User management (CRUD, role assignment)
- Role management (permissions matrix)
- App admin assignment
- AI provider configuration
- Audit log viewer
- Bulk user import (CSV)
- License management
- SSO provider configuration
- Backup management

**Features:**
- RBAC with role inheritance (Super Admin → App Admin → User)
- Per-app admin dashboards with scoped access
- Bulk CSV user import with validation
- SSO via OAuth2/OIDC (Google, Microsoft, custom)
- Internal license/subscription tracking
- System-wide audit logging
- AI commands ("make user X a Finance Admin")

**Cross-module:** Admin creates the user foundation all other modules depend on.

---

## 2. Y&U Mails

**Purpose:** Full email client (Outlook-like) powered by Stalwart mail server.

**OSS Integration:** Stalwart (Rust) — IMAP/SMTP/JMAP/CalDAV/CardDAV

**Models:** MailMessage, MailAttachment, MailFolder, MailLabel

**Backend:** `api/v1/mail.py`, `integrations/stalwart.py`

**Frontend Pages:** Mail inbox with folder navigation, compose, thread view

**Features:**
- Inbox, sent, drafts, trash, custom folders
- Rules, signatures, attachments
- Full-text search across messages
- Read receipts
- AI reply suggestions and thread summarization
- CardDAV contact sync with CRM

**Cross-module:**
- Calendar — email invitations auto-create calendar events
- Drive — attachments saved to Drive
- CRM — contact sync via CardDAV
- AI — thread summarization, smart replies

---

## 3–5. Y&U Docs / Excel / PowerPoint

**Purpose:** Full office suite with MS Office compatibility and real-time collaboration.

**OSS Integration:** ONLYOFFICE Document Server

**Backend:** `api/v1/docs.py`, `integrations/onlyoffice.py`

**Frontend Pages:** ONLYOFFICE editor embedded via JS SDK

**Features:**
- Full formatting, charts, formulas, animations
- Real-time co-editing with presence indicators
- Comments and track changes
- Import/export MS Office formats (docx, xlsx, pptx)
- Version history
- AI-powered content generation

**Cross-module:**
- Drive — documents stored in MinIO, accessible via Drive
- Finance — reports generated as Excel/PDF
- Projects — version history syncs to project activity
- AI — document generation from prompts

---

## 6. Y&U Notes

**Purpose:** Rich-text collaborative notes (Notion-like).

**Models:** Note (Tiptap JSON content, encrypted)

**Backend:** `api/v1/notes.py`

**Frontend Pages:** Notes list, Tiptap rich-text editor

**Features:**
- Tiptap editor with markdown support
- Rich formatting (headings, lists, tables, code blocks)
- Note sharing with specific users
- Encrypted storage in PostgreSQL
- AI summarization

**Cross-module:**
- Drive — note attachments stored in Drive
- Calendar — notes linked to events
- AI — content summarization

---

## 7. Y&U Drive

**Purpose:** Central file storage with SharePoint-level sharing capabilities.

**OSS Integration:** MinIO (S3-compatible) + Nextcloud

**Models:** File, Folder, FileShare, TeamFolder, TeamFolderMember, ShareAuditLog, DocLink

**Backend:** `api/v1/drive.py`, `integrations/minio_client.py`, `integrations/nextcloud_client.py`

**Frontend Pages:** File explorer, ShareDialog (People/Link/Active tabs), Team Folders

**Features:**
- File upload/download with MinIO backend
- Folder hierarchy with drag-and-drop
- Share links with: password protection, expiry dates, download limits, no-download mode
- File-drop upload links (anyone can upload)
- Approval workflows for shared access
- Team folders with member management
- Share audit logging
- Nextcloud integration for advanced sharing

**Cross-module:**
- All modules — central file store for attachments
- Docs — ONLYOFFICE documents stored here
- Projects — project files linked via Drive
- Finance — invoice PDFs, report exports
- HR — employee documents

---

## 8. Y&U Teams (Meetings)

**Purpose:** Video conferencing (Microsoft Teams-like).

**OSS Integration:** Jitsi Meet (full Docker stack: web, prosody, jicofo, jvb)

**Models:** Meeting (in calendar events)

**Backend:** `api/v1/meetings.py`, `integrations/jitsi.py`

**Frontend Pages:** Meeting scheduler, Jitsi embedded view

**Features:**
- Create meetings with auto-generated Jitsi room
- Calendar integration (meetings appear as events)
- Attendee management from Users table
- Meeting recordings saved to Drive
- AI meeting summarization

**Cross-module:**
- Calendar — meeting → calendar event (via event bus)
- Mail — meeting link sent via email
- Drive — recordings stored in MinIO
- AI — join and summarize meetings

---

## 9. Y&U Calendar

**Purpose:** Unified calendar aggregating events from all modules.

**Models:** CalendarEvent, CalendarRecurrence

**Backend:** `api/v1/calendar.py`

**Frontend Pages:** FullCalendar view (month/week/day)

**Features:**
- FullCalendar React component
- Recurring events with RRULE support
- CalDAV sync with Stalwart
- Color-coded event categories
- Drag-and-drop rescheduling

**Cross-module:**
- Mail — email invitations create events
- Meetings — Jitsi meetings appear on calendar
- Projects — task deadlines as calendar events
- HR — approved leave creates calendar blocks
- AI — "schedule a meeting with X tomorrow"

---

## 10. Y&U Forms

**Purpose:** Form builder with response collection and export.

**Models:** Form, FormField, FormResponse

**Backend:** `api/v1/forms.py`, `services/forms_export.py`

**Frontend Pages:** Form builder, response viewer, public form submit

**Features:**
- JSON schema-based form definition
- Field types: text, number, date, select, checkbox, file upload
- Public submission URLs
- Response analytics
- CSV and XLSX export
- AI-generated forms from descriptions

**Cross-module:**
- Drive — uploaded files stored in MinIO
- Excel — responses exportable to XLSX

---

## 11. Y&U Projects

**Purpose:** Project management with Kanban boards and time tracking.

**Models:** Project, ProjectMember, Task, Subtask, TimeLog

**Backend:** `api/v1/projects.py`

**Frontend Pages:** Kanban board (drag-and-drop), time log report

**Features:**
- Project CRUD with member management
- Kanban board with customizable columns
- Drag-and-drop task reordering
- Subtasks and checklists
- Time logging per task
- Task assignment to team members

**Cross-module:**
- Calendar — task deadlines appear as events
- Finance — project costs via time logs
- Drive — project file attachments
- AI — "create a task for X in project Y"

---

## 12. CRM (Customer Relationship Management)

**Purpose:** Contact management, lead tracking, deal pipeline.

**Models:** Contact, Lead, Deal, Activity, Pipeline

**Backend:** `api/v1/crm.py`

**Frontend Pages:** Dashboard, Contacts, Contact Detail, Leads, Pipeline, Deals

**Features:**
- Contact and company management
- Lead capture and scoring
- Multi-stage deal pipeline (Kanban view)
- Activity logging (calls, emails, meetings)
- Lead-to-deal conversion
- AI lead scoring and deal analysis

**Cross-module:**
- Finance — deal won → auto-create invoice
- Mail — email history linked to contacts
- Calendar — meetings with contacts
- Supply Chain — suppliers linked from CRM
- AI — lead scoring, sentiment analysis

---

## 13. Finance & Accounting

**Purpose:** Full double-entry accounting, invoicing, reporting.

**Models:** Account, Invoice, Payment, JournalEntry, BankAccount, Reconciliation, Currency, TaxRate, ExpenseCategory, BudgetAllocation, PnLCategory

**Backend:** `api/v1/finance.py`, `api/v1/finance_ext.py`

**Frontend Pages:** Dashboard, Accounts, Invoices, Invoice Detail, Payments, Journal, Reports, Budget, Tax Config, Currency, Bank Reconciliation

**Features:**
- Double-entry chart of accounts
- Invoice creation, sending, and tracking
- Payment recording and matching
- Journal entries
- Multi-currency support
- Tax rate configuration
- Bank account reconciliation
- Budget allocation and tracking
- P&L and Balance Sheet reports
- CSV/PDF export

**Cross-module:**
- CRM — deals create invoices
- HR — payroll creates journal entries
- Inventory — purchase orders impact accounts
- Supply Chain — procurement costs
- E-Commerce — order revenue tracking
- AI — expense categorization, financial forecasting

---

## 14. HR & Payroll

**Purpose:** Employee management, leave tracking, attendance, payroll processing.

**Models:** Department, Employee, Leave, Attendance, Payslip, TaxBracket, PayRun, LeaveAllocation, Deduction, Allowance, PayRunLine

**Backend:** `api/v1/hr.py`, `api/v1/payroll_ext.py`

**Frontend Pages:** Dashboard, Departments, Employees, Employee Detail, Leave, Attendance, Payroll, Payslip Detail, Tax Brackets, Pay Runs

**Features:**
- Department and employee management
- Leave requests with approval workflow
- Leave allocation and balance tracking
- Attendance check-in/check-out
- Payslip generation with deductions and allowances
- Tax bracket configuration
- Pay run processing (batch payroll)
- Employee document management

**Cross-module:**
- Finance — payroll creates journal entries
- Calendar — approved leave creates calendar events
- Drive — employee documents in Drive
- AI — payroll forecasting, leave trend analysis

---

## 15. Inventory

**Purpose:** Warehouse management, stock tracking, purchase orders.

**Models:** Item, Warehouse, StockMovement, PurchaseOrder, ReorderAlert

**Backend:** `api/v1/inventory.py`

**Frontend Pages:** Dashboard, Items, Warehouses, Stock Movements, Purchase Orders, PO Detail, Reorder Alerts

**Features:**
- Item catalog with SKU management
- Multi-warehouse support
- Stock movement tracking (in/out/transfer)
- Purchase order lifecycle (draft → sent → received)
- Automatic reorder alerts when stock falls below threshold
- Stock valuation

**Cross-module:**
- Finance — POs create payable entries
- Supply Chain — PO workflow integration
- POS — stock deducted on sale
- E-Commerce — product stock sync
- AI — reorder optimization, stock trend analysis

---

## 16. Supply Chain

**Purpose:** Supplier management, procurement, goods receiving, returns.

**Models:** Supplier, Requisition, GRN (Goods Received Note), Return

**Backend:** `api/v1/supplychain.py`

**Frontend Pages:** Suppliers, Requisitions, GRNs, Returns (list + detail views)

**Features:**
- Supplier directory with contact info
- Purchase requisition workflow (request → approve → PO)
- Goods received notes with quantity verification
- Return management
- Supplier performance tracking

**Cross-module:**
- Inventory — GRN receipt updates stock levels
- Finance — procurement costs in accounting
- CRM — supplier contacts
- AI — supply chain optimization

---

## 17. Manufacturing

**Purpose:** Production management with BOMs, work orders, and quality control.

**Models:** BOM (Bill of Materials), WorkStation, WorkOrder, QualityCheck

**Backend:** `api/v1/manufacturing.py`

**Frontend Pages:** BOMs, Work Stations, Work Orders, Quality Checks

**Features:**
- Bill of Materials with component hierarchy
- Work station management
- Work order lifecycle (planned → in progress → completed)
- Quality check recording and compliance
- Production scheduling

**Cross-module:**
- Inventory — BOM components consume stock, finished goods added
- Finance — production costs
- AI — manufacturing optimization insights

---

## 18. Point of Sale (POS)

**Purpose:** In-store sales terminal with session management.

**Models:** POSSession, POSTransaction, POSReceipt

**Backend:** `api/v1/pos.py`

**Frontend Pages:** POS Terminal, Sessions, Session Detail, Receipt View

**Features:**
- POS terminal interface (product grid, cart, payment)
- Session open/close with cash reconciliation
- Multiple payment methods
- Receipt generation
- Offline mode support

**Cross-module:**
- Inventory — stock deducted on sale
- Finance — revenue recorded
- CRM — customer purchase history
- AI — POS analytics, sales trends

---

## 19. E-Commerce

**Purpose:** Online store with product catalog, orders, and customer management.

**Models:** Store, Product, ProductVariant, Order, OrderItem, Customer

**Backend:** `api/v1/ecommerce.py`, `api/v1/storefront.py`

**Frontend Pages:** Stores, Products, Orders, Customers

**Features:**
- Multi-store support
- Product catalog with variants (size, color, etc.)
- Order management with status workflow
- Customer accounts and purchase history
- Public storefront API for headless commerce

**Cross-module:**
- Inventory — product stock sync
- Finance — order revenue and reporting
- Supply Chain — auto-reorder on low stock
- CRM — customer data shared
- AI — product recommendations, demand forecasting

---

## 20. Support

**Purpose:** Help desk / ticket management system.

**Models:** Ticket, TicketReply

**Backend:** `api/v1/support.py`

**Frontend Pages:** Ticket list, Ticket Detail with reply thread

**Features:**
- Ticket creation with priority and category
- Reply threading
- Agent assignment
- Status workflow (open → in progress → resolved → closed)
- SLA tracking

**Cross-module:**
- CRM — tickets linked to contacts
- Mail — ticket replies via email
- AI — ticket categorization, suggested responses

---

## 21. Analytics

**Purpose:** Business intelligence dashboards powered by Apache Superset.

**OSS Integration:** Apache Superset

**Backend:** `api/v1/analytics.py`

**Frontend Pages:** Superset embedded dashboards

**Features:**
- Direct PostgreSQL connection to all Urban Vibes Dynamics data
- Pre-built dashboards per module
- Custom SQL queries and visualizations
- Scheduled report delivery

**Cross-module:** Reads data from all module tables for cross-functional analytics.

---

## 22. Settings

**Models:** CompanySettings, UserSettings

**Backend:** `api/v1/settings.py`

**Frontend Pages:** Tabbed settings (General, Company, Notifications, Integrations)

**Features:**
- Company profile (name, logo, address, timezone)
- Notification preferences
- Integration toggles
- Theme and display settings

---

## 23. Notifications

**Models:** Notification

**Backend:** `api/v1/notifications.py`

**Frontend:** Notification center page + header bell dropdown

**Features:**
- Per-user notifications with type (info/warning/error)
- Read/unread tracking
- Real-time delivery via event bus
- Notification preferences in settings

**Triggers:** stock.low, invoice.sent, leave.approved, file.shared, po.received, payslip.approved, ticket.assigned, and more.
