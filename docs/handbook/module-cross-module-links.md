---
title: Cross-Module Links & Integrations
slug: module-cross-module-links
category: modules
article_type: guide
module: admin
tags: [cross-module, integrations, links, workflows]
sort_order: 2
is_pinned: false
excerpt: How Urban Vibes Dynamics modules connect to each other — automatic links, shared data, and cross-module actions.
---

# Cross-Module Links & Integrations

Urban Vibes Dynamics modules do not operate in silos. Data flows automatically between modules so you never need to re-enter information or copy records manually. This page explains how the cross-module link system works and lists every connection available.

> **Tip:** Cross-module links mean you never need to copy data between modules — follow the chain from a single record.

---

## 1. What Cross-Module Links Are

A cross-module link is a relationship between a record in one module and a record in another. For example:

- A **Deal** in CRM is linked to a **Project** created when the deal was won.
- That **Project** is linked to a **Finance Expense** logged by a team member during delivery.
- The same **Project** has an auto-created **Drive Folder** where all project files live.

You can navigate this chain from any point. Open the deal, see the linked project. Open the project, see the linked expense and drive folder. Open the drive folder, see who uploaded what.

Links are created in two ways:
1. **Automatically** — via the event bus when a trigger occurs (e.g., deal.won → create project).
2. **Manually** — from the **Links** tab on any record, where you can search and attach a related record from another module.

---

## 2. Key Cross-Module Connections

### CRM Connections

| From | To | How It Works |
|---|---|---|
| **CRM Deal** | **Calendar Event** | Schedule a meeting from a Deal — the event is created in Calendar and linked back to the deal. |
| **CRM Deal** | **Project** | Click "Convert to Project" on a won deal — a new project is created pre-populated with deal details and the contact. |
| **CRM Deal** | **Invoice (Finance)** | Click "Create Invoice" on a deal — an invoice is generated in Finance with the deal line items and contact pre-filled. |
| **CRM Contact** | **Support Ticket** | Support tickets can be linked to a CRM contact, giving the agent full customer history at a glance. |
| **CRM Contact** | **POS Purchase History** | Each POS sale is synced to the customer's CRM contact record under the Purchase History tab. |
| **CRM Contact** | **E-Commerce Orders** | Online orders create or update the matching CRM contact, with all orders visible on the contact record. |
| **CRM Lead** | **Form Submission** | When a Form submission is received, a lead is automatically created in CRM with the submitted data mapped to lead fields. |
| **CRM Campaign** | **Mail** | Email campaigns are sent via the Mail module using your configured SMTP — replies land in your Mail inbox. |

### Projects Connections

| From | To | How It Works |
|---|---|---|
| **Project** | **Drive Folder** | When a project is created, a folder is auto-created in Drive named after the project. All project file uploads are stored here. |
| **Project** | **Finance Expense** | Team members log expenses against a project. Expenses appear in Finance for reimbursement or billing. |
| **Project** | **Billable Time (Finance)** | Time logged on tasks can be marked billable — Finance can generate an invoice from billable time entries. |
| **Project** | **Email (Mail)** | Emails can be logged to a project's timeline from the Mail module. The email thread is visible in the project's Links tab. |
| **Project** | **CRM Deal** | Projects created from a deal retain the deal link — navigate from project back to the originating deal at any time. |
| **Project** | **Docs** | Documents created in Docs can be linked to a project and appear in the project's Documents tab. |

### Meetings Connections

| From | To | How It Works |
|---|---|---|
| **Meeting** | **Calendar Event** | Every Jitsi meeting has a corresponding Calendar event with the Jitsi room link included. |
| **Meeting** | **Notes** | After a meeting ends, a meeting summary note is automatically created and linked to the meeting record. |
| **Meeting** | **CRM Contact** | Meetings can be linked to CRM contacts — the meeting appears in the contact's activity timeline. |
| **Meeting** | **Project** | Action items from a meeting can be sent directly to a linked project as tasks. |

### Mail Connections

| From | To | How It Works |
|---|---|---|
| **Email** | **CRM Contact** | Log an email to a contact — the email thread appears in the contact's activity timeline in CRM. |
| **Email** | **Project** | Log an email to a project — the thread appears in the project's timeline. |
| **Email** | **Drive** | Save an email attachment directly to Drive from within the Mail module. |
| **Email** | **Notes** | Save an email as a note with one click — useful for capturing important information. |

### Support Connections

| From | To | How It Works |
|---|---|---|
| **Support Ticket** | **CRM Contact** | Link a ticket to a contact to see full customer history alongside the ticket. |
| **Support Ticket** | **CRM Deal** | Escalate a support issue that reveals a sales opportunity — link or create a deal from the ticket. |
| **Support Ticket** | **Project** | Escalate a bug or feature request to a project task with full ticket context attached. |

### Finance Connections

| From | To | How It Works |
|---|---|---|
| **Vendor Bill** | **Supply Chain PO** | When a Purchase Order is marked completed, a vendor bill draft is auto-created in Finance matched to the PO. |
| **Invoice** | **CRM Deal** | Invoices created from deals retain the deal link — both the deal and invoice show the connection. |
| **Journal Entry** | **Manufacturing Work Order** | When a work order is completed, cost breakdown entries (labour, materials, overhead) are auto-posted as journal entries. |

### E-Commerce & POS Connections

| From | To | How It Works |
|---|---|---|
| **E-Commerce Order** | **CRM Contact** | New orders create a CRM contact if one does not exist; repeat orders update the existing contact's purchase history. |
| **E-Commerce Low Stock** | **Supply Chain** | When a product drops below its reorder threshold, a procurement request is automatically created in Supply Chain. |
| **POS Sale** | **CRM Contact** | Each completed POS sale is linked to the customer's CRM contact, building a full purchase history. |
| **POS Receipt** | **Mail** | Email receipts are sent via the Mail module using the configured SMTP — no external service needed. |

### Manufacturing Connections

| From | To | How It Works |
|---|---|---|
| **Work Order** | **Finance** | Completed work orders post cost breakdowns (labour, materials, overhead) as journal entries automatically. |
| **Work Order** | **Supply Chain** | A work order needing raw materials generates a procurement request in Supply Chain if stock is insufficient. |
| **Work Order** | **HR** | Operators can be assigned to work orders from the HR employee directory, and their labour cost is tracked. |

---

## 3. How to Trigger a Cross-Module Link Manually

Every record in Urban Vibes Dynamics has a **Links** tab (visible in the record detail view, usually the last tab in the tab bar).

1. Open any record (e.g., a CRM Deal).
2. Click the **Links** tab.
3. Click **+ Add Link**.
4. Select the **module** you want to link to (e.g., Projects).
5. Search for the specific record by name or ID.
6. Select it and click **Link**.

The linked record now appears in both directions — on the deal's Links tab and on the project's Links tab.

You can also create a new record in the target module directly from the Links tab using the **+ Create and Link** button — this pre-fills the new record with relevant data from the current record.

---

## 4. The Event Bus — Automatic Background Connections

Urban Vibes Dynamics has an internal **event bus** that fires events when key actions occur. Background handlers listen for these events and take automatic actions — no user input required.

Key events and what they trigger:

| Event | Automatic Action |
|---|---|
| `deal.won` | Creates a project (if "Auto-create project on deal won" is enabled in CRM settings) |
| `form.submitted` | Creates a lead in CRM with submission data mapped to lead fields |
| `meeting.ended` | Creates a meeting summary note linked to the meeting record |
| `task.assigned` | Sends an in-app and email notification to the assignee |
| `task.status_changed` | Updates the linked deal's progress indicator if the project came from a deal |
| `supplychain.po.completed` | Creates a vendor bill draft in Finance |
| `ecommerce.order.created` | Creates or updates a CRM contact with order details |
| `pos.sale.completed` | Syncs purchase data to CRM contact's purchase history |
| `manufacturing.work_order.completed` | Posts cost journal entries to Finance |

Event bus actions run in the background via the Celery task queue — they typically complete within a few seconds of the triggering action.

---

## 5. Viewing All Links on a Record

The **Links** tab on any record shows a consolidated view of:

- All manually added links (with the module icon, record name, and linked-by user)
- All automatically created links (marked with a lightning bolt icon indicating an event-triggered link)
- Creation date of each link
- A **Go to Record** button to navigate directly to the linked record

To remove a link, hover over it and click the unlink icon. Removing a link does not delete either record — it only removes the relationship.

---

## Next Steps

- [Module Overview](./module-overview.md) — understand what each module does
- [CRM Guide](./crm-overview.md) — detailed CRM features including deal-to-project workflow
- [Projects Guide](./projects-overview.md) — task management, sprints, and project integrations
