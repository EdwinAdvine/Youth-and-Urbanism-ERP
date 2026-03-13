---
title: Sales Rep Quick Start (CRM)
slug: sales-rep-quick-start
category: getting-started
article_type: quickstart
module: crm
tags: [crm, contacts, leads, deals, pipeline]
sort_order: 3
is_pinned: false
excerpt: Get started in CRM: add a contact, create a lead, and move it through your pipeline.
---

# Sales Rep Quick Start (CRM)

This guide covers the core CRM workflow for a sales rep: adding a contact, turning them into a lead, converting the lead to a deal, and moving it through your pipeline stages to close.

---

## Navigating CRM

Click **CRM** in the left sidebar. The main sections are:

- **Dashboard** — pipeline overview, your activity, open deals by stage (`/crm`)
- **Contacts** — people and organisations (`/crm/contacts`)
- **Leads** — unqualified opportunities (`/crm/leads`)
- **Deals** — qualified opportunities in your pipeline (`/crm/deals`)
- **Activities** — calls, emails, meetings, tasks (`/crm/activities`)
- **Forms** — lead capture forms embeddable on your website (`/crm/forms`)

---

## Step 1 — Add a Contact

1. Go to **CRM → Contacts** and click **+ New Contact**.
2. Fill in the basics:
   - **Full Name** and **Email** (required)
   - **Phone**, **Company / Organisation**, **Job Title**
   - **Source** — how did you find them? (Website, Referral, Event, Cold Outreach, etc.)
3. Click **Save**.

The contact now appears in your contacts list. Urban Vibes Dynamics automatically checks for duplicate emails and will warn you before creating a near-match.

> **Pro tip:** If the contact came in through a web form, Urban Vibes Dynamics may have already created the contact automatically via the `form.response.submitted` event. Check Contacts before creating manually.

---

## Step 2 — Create a Lead from the Contact

Contacts become leads when there is a potential business opportunity.

1. Open the contact record.
2. Click **+ Create Lead** (in the top-right action bar).
3. Fill in:
   - **Lead Title** — a short description of the opportunity (e.g. "Annual software licence — Acme Ltd")
   - **Estimated Value** — your best guess at deal size
   - **Expected Close Date**
   - **Assigned To** — defaults to you
4. Click **Save**.

The lead appears in **CRM → Leads** and is linked to the contact record.

---

## Step 3 — Qualify and Convert to a Deal

Once you have confirmed genuine interest and a budget, convert the lead to a deal:

1. Open the lead in **CRM → Leads**.
2. Click **Convert to Deal**.
3. Choose (or create) a **Pipeline** to place the deal in.
4. The deal is created at the first pipeline stage and the lead is marked **Converted**.

You can also archive leads that go cold rather than converting them — this keeps your lead list clean.

---

## Step 4 — Move the Deal Through Your Pipeline

1. Go to **CRM → Deals** and switch to the **Kanban** view (board icon, top right).
2. You will see your pipeline stages as columns (e.g. Prospect → Qualified → Proposal → Negotiation → Closed Won / Closed Lost).
3. Drag the deal card between columns as the opportunity progresses — or open the deal and use the **Stage** dropdown.
4. Inside each deal record you can:
   - Log a **Call**, **Email**, or **Meeting** under the **Activities** tab
   - Attach files
   - Add internal notes
   - Schedule a follow-up reminder

---

## Step 5 — Close the Deal

When the customer signs:

1. Open the deal and move it to **Closed Won**.
2. Enter the **Actual Close Date** and **Final Value**.
3. Click **Save**.

Urban Vibes Dynamics will fire a `crm.deal.won` event — if your Finance module is connected, you can immediately create an invoice from the deal via **Actions → Create Invoice**.

---

## Tips to Work Faster

- **Global search (Cmd+K):** Type a contact name or company to jump directly to their record.
- **Bulk activity logging:** Select multiple deals → **Actions → Log Activity** to add the same note or task to all at once.
- **Pipeline filters:** Use the filter bar in the Deals Kanban to show only your own deals or deals closing this month.
