---
title: CRM Integrations
slug: crm-integrations
category: crm
article_type: guide
module: crm
tags: [integrations, forms, email, calendar, projects, ecommerce]
sort_order: 12
is_pinned: false
excerpt: How CRM connects with Forms, Mail, Calendar, Projects, Finance, and E-Commerce.
---

# CRM Integrations

CRM is the central hub of Urban ERP — it connects to almost every other module so your data flows automatically.

## Forms → CRM

Web form submissions automatically create leads:

1. Create a form in the **Forms** module
2. Go to **Forms → Settings → Lead Mapping**
3. Map form fields to lead fields (name, email, phone, source)
4. Every new submission creates a lead in CRM and triggers any matching automation rules

## Mail → CRM

- **Log emails to a contact timeline** — from the Mail module, open any email and click **Log to CRM Contact**
- **Incoming mail parser** — configure a mailbox to auto-create leads from new senders (e.g. enquiries@ address)

## Calendar → CRM

- Schedule a meeting from a **deal's timeline** — the event appears both on the deal and in Calendar
- Meeting attendees are auto-linked to the deal's contacts

## CRM → Projects

When a deal is marked **Won**:

1. Open the deal and click **Create Project** (top-right action menu)
2. Deal name pre-populates the project name; client contact is linked
3. The project appears in the deal's Links tab

## CRM → Finance

Convert a deal to an invoice directly:

1. Open the deal → **Finance** tab → **Create Invoice**
2. Deal value pre-populates line items
3. The invoice is linked back to the deal

## E-Commerce → CRM

Customer orders from the online store sync to the CRM contact's **Purchase History** tab automatically — no manual linking required.

## AI / Urban Bad AI → CRM

Urban Bad AI can:
- Search leads by name, company, or score
- Update deal stages on your behalf
- Draft follow-up emails
- Log activities to the timeline

All AI actions on CRM records require your approval before executing.

## Webhooks

**CRM → Automation → New Rule → Action: Webhook** sends deal or lead data to any external URL when a rule triggers — useful for syncing with external tools.

> **Tip:** The Forms → CRM link is the fastest way to capture inbound leads from your website. Set it up before launching any campaign.
