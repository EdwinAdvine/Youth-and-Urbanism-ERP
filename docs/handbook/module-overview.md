---
title: Module Overview
slug: module-overview
category: modules
article_type: guide
module: admin
tags: [modules, overview, navigation, features]
sort_order: 1
is_pinned: false
excerpt: A complete map of all Urban Vibes Dynamics modules and what each one does.
---

# Module Overview

Urban Vibes Dynamics is an all-in-one platform. Every capability your organisation needs — finance, HR, CRM, communication, documents, video, and AI — is built in and connected. This page maps every module so you know where to go for what.

---

## Navigating Between Modules

The **left sidebar** is your primary navigation. It groups modules into sections. Click any module name to open it. On smaller screens, click the menu icon to expand the sidebar.

- **Collapse / expand** a section by clicking the section header.
- **Pin** a module to the top of the sidebar via the pin icon that appears on hover.
- **Switch** between modules instantly — Urban Vibes Dynamics does not reload the page, so you can jump from Finance to CRM without losing your place.
- Use **`Cmd/Ctrl + K`** to search across all modules by name.

Super Admins see all modules. App Admins and Users see only the modules they have been granted access to.

---

## Core Business Modules

### Finance
**Invoicing, payments, budgets, and financial reporting.**

Manage your entire financial operation: create and send invoices, record payments, reconcile bank statements, track expenses, set budgets, and generate P&L, balance sheet, and cash flow reports. Supports multi-currency transactions with automatic forex gain/loss calculation. Integrated with CRM (invoice from deal), Projects (billable time and expense tracking), Supply Chain (vendor bills from purchase orders), and Manufacturing (cost breakdowns).

### CRM — Customer Relationship Management
**Contacts, leads, deals, campaigns, and AI lead scoring.**

Central hub for all customer and prospect data. Track the full sales funnel from lead capture through deal close. Run email campaigns, score leads with AI, schedule follow-up tasks, and link deals to projects or invoices with one click. Form submissions from the Forms module automatically create leads. Purchase history from POS and E-Commerce syncs to contact records.

### HR & Payroll
**Employees, payroll, leave management, recruitment (ATS), and learning (LMS).**

Full human resources suite. Manage employee profiles, departments, and organisational charts. Run payroll with statutory deductions (PAYE, NHIF, NSSF), process leave requests, track attendance, and generate payslips. Recruit with the built-in applicant tracking system. Upskill staff with the learning management system. Manufacturing work orders can pull operators from HR for cost assignment.

### Projects
**Tasks, sprints, time tracking, and project timelines.**

Plan and execute projects with task boards (Kanban and list views), sprint planning, Gantt-style timelines, and time tracking. Assign tasks to team members, set deadlines, and track progress. Projects auto-create folders in Drive, log emails from Mail, and link to Finance for billable time and expense tracking. A won deal in CRM can become a project with one click.

### Inventory
**Items, stock levels, warehouses, and stock movements.**

Track stock across one or multiple warehouses. Manage item catalogues with variants (size, colour, etc.), set reorder points, record stock adjustments, and process stock transfers between locations. Feeds into Manufacturing (raw materials), Supply Chain (purchase orders), POS (retail stock), and E-Commerce (online stock).

### Manufacturing
**Bills of Materials (BOMs), work orders, quality control, and equipment.**

Plan and execute manufacturing runs. Define Bills of Materials for each finished product, raise work orders, track production stages, and record quality checks. Manufacturing costs (labour, materials, overhead) auto-post journal entries to Finance. Raw material needs flow to Supply Chain for procurement. Equipment maintenance schedules are tracked within the module.

### Supply Chain
**Suppliers, purchase orders, goods received notes (GRN), and demand planning.**

Manage the full procurement cycle from supplier records through to goods receipt. Raise purchase orders, track approval workflows, receive goods against a PO with a GRN, and reconcile vendor bills. Completed purchase orders automatically create vendor bills in Finance. Demand planning uses Inventory reorder points and Manufacturing schedules to suggest purchases.

---

## Customer & Sales Modules

### Point of Sale (POS)
**In-store sessions, cash register, and receipts.**

Fast, touch-friendly POS for retail and hospitality. Open a session, scan or search items, process cash and card payments, print or email receipts, and close the session with a cash count. Purchase history syncs to CRM contact records. Stock levels update in Inventory in real time.

### E-Commerce
**Online store, B2B portal, subscriptions, and loyalty programme.**

Publish products to an online storefront, manage B2B customer portals with custom pricing, set up subscription products with recurring billing, and run a points-based loyalty programme. Orders create or update contact records in CRM. Inventory stock is shared with the online catalogue. Low stock or supplier shortfalls can trigger procurement requests to Supply Chain.

### Booking
**Appointment scheduling for services.**

Let customers book appointments online. Configure services, staff availability, working hours, and buffer times. Bookings appear in the Calendar module and send confirmation emails via the Mail module. Useful for clinics, salons, consultancies, and any service business that manages appointments.

---

## Communication Modules

### Mail
**Full email inbox with IMAP/SMTP support.**

A complete email client built into Urban Vibes Dynamics. Connect one or more mailboxes via IMAP. Compose, reply, forward, and organise emails in folders. Emails can be logged to a CRM contact, linked to a Project, saved as a Note, or attached to a Drive folder — all without leaving the Mail module.

### Calendar
**Events, scheduling, and AI-assisted scheduling.**

Shared and personal calendars for your organisation. Create events, invite attendees, set recurrences, and attach video meeting links. The AI scheduling assistant can find the best time for a group of people based on their availability. Calendar events sync with Meetings (Jitsi links) and Booking appointments.

### Meetings
**Jitsi-powered video conferencing.**

Host video meetings directly in Urban Vibes Dynamics without any external conferencing service. Start or join a Jitsi Meet room from a Calendar event or from the Meetings module directly. Meeting participants, notes, and recordings are linked to the meeting record. After a meeting ends, action items can be sent to Projects and a summary note saved automatically.

### Chat
**Team messaging — direct messages and group channels.**

Real-time text messaging for your team. Create channels by topic, project, or department. Send direct messages to individuals. Supports file attachments (files are stored in Drive/MinIO). The Urban Bad AI assistant can be mentioned in any channel.

### Notes
**Personal and team notes with hierarchy.**

A flexible notes system supporting nested notebooks and pages (hierarchy). Write personal notes or share pages with your team. Notes support rich text with the Tiptap editor. Notes can be linked to Projects, Meetings, and CRM records to provide context.

### Drive
**MinIO-backed file storage and sharing.**

Secure, self-hosted file storage. Upload any file type, organise into folders, share with specific users or teams, and control access with view/edit/owner permissions. Projects auto-create a Drive folder. Files can be opened directly in Docs for collaborative editing. All storage is in your own MinIO instance — no third-party cloud.

### Docs
**ONLYOFFICE collaborative document editing.**

Create and edit Word-compatible documents, Excel-compatible spreadsheets, and PowerPoint-compatible presentations inside Urban Vibes Dynamics. Multiple users can collaborate in real time. Documents are stored in Drive (MinIO) and can be linked to Projects or shared via Drive permissions.

---

## Operations Modules

### Analytics
**Revenue, user activity, module usage, and business metrics.**

Built-in business intelligence without any external BI tool. Dashboards cover: revenue trends, invoice ageing, top customers, payroll costs, support ticket volume, module adoption, and more. All data is queried directly from your PostgreSQL database. Super Admins can see cross-module analytics; App Admins see metrics for their module scope.

### Forms
**Custom web forms and submission management.**

Build forms with a drag-and-drop builder — text fields, dropdowns, file uploads, signatures, and more. Embed forms on your website or share a direct link. Submissions are stored in Urban Vibes Dynamics and can automatically create leads in CRM or support tickets in the Support module.

### Support
**Tickets, SLA tracking, live chat, and omnichannel inbox.**

Manage customer support end-to-end. Customers submit tickets via email, web form, or live chat widget. Agents manage tickets in a shared inbox, apply SLA policies, escalate to deals in CRM, and link issues to Projects for engineering resolution. Omnichannel inbox consolidates email, live chat, and form submissions into a single queue.

---

## Platform Modules

### Admin
**Users, roles, permissions, system settings, and parity audit.**

The control centre for Super Admins and App Admins. Manage user accounts, assign roles, configure SMTP, set company branding, enable/disable modules, and monitor system health via the Parity Dashboard. Role-based access control (RBAC) is enforced at the API level — what users see is exactly what they can access.

### AI & Urban Bad AI
**Multi-agent AI assistant across all modules.**

Urban Vibes Dynamics includes a built-in AI assistant with configurable providers (OpenAI, Anthropic, Grok). The basic AI chat answers questions and helps with tasks in context. **Urban Bad AI** is the advanced multi-agent mode — it has four specialised agents (Orchestrator, Researcher, Verifier, Executor) that can plan multi-step tasks, run them with your approval, and interact with any module's data. Toggle the AI sidebar with `Cmd/Ctrl + Shift + A`.

---

## Module Count Summary

| Category | Modules |
|---|---|
| Core Business | Finance, CRM, HR & Payroll, Projects, Inventory, Manufacturing, Supply Chain |
| Customer & Sales | POS, E-Commerce, Booking |
| Communication | Mail, Calendar, Meetings, Chat, Notes, Drive, Docs |
| Operations | Analytics, Forms, Support |
| Platform | Admin, AI / Urban Bad AI |
| **Total** | **25 modules** |

---

## Next Steps

- [Cross-Module Links & Integrations](./module-cross-module-links.md) — how modules connect automatically
- [Setting Up Your Workspace](./gs-setup-workspace.md) — configure your environment before enabling modules
