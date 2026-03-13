---
title: Managing Contacts
slug: managing-contacts
category: crm
article_type: guide
module: crm
tags: [contacts, people, organisations, activities, duplicates]
sort_order: 1
is_pinned: false
excerpt: Add, search, and manage contacts (people and organisations) in Urban Vibes Dynamics CRM.
---

# Managing Contacts

Contacts are the foundation of your CRM. Every lead, deal, campaign, and activity connects to a contact record. Keeping your contact database clean and up to date directly improves your sales team's effectiveness.

## Adding a Contact

Navigate to **CRM → Contacts** and click **New Contact**.

| Field | Description |
|---|---|
| **Type** | Person or Organisation |
| **Full Name** | First and last name for a person; company name for an org |
| **Email** | Primary email address — used for campaigns and communications |
| **Phone** | Primary phone. For Kenya, format as +254 7xx xxx xxx |
| **Company** | For person contacts, link to their organisation (creates a relationship) |
| **Job Title** | Their role, e.g. "Procurement Manager" |
| **Tags** | Labels for segmentation, e.g. "VIP", "Wholesale", "Nairobi" |
| **Source** | How you met them: Referral, Trade Show, Website, Cold Outreach, etc. |
| **Assigned To** | The sales rep responsible for this contact |

Click **Save**. The contact record is created and immediately available for campaigns, leads, and deals.

## Searching and Filtering Contacts

The Contacts list has a search bar and filter panel on the left. You can filter by:

- **Tag** — e.g. show all contacts tagged "Mombasa"
- **Company** — all people at a specific organisation
- **Assigned rep** — all contacts owned by a specific sales person
- **Source** — filter by how they came in
- **Date added** — contacts added in a date range
- **Activity status** — contacts with no recent activity (useful for re-engagement campaigns)

Use the **Columns** toggle to show/hide fields in the list view.

## Logging Activities on a Contact

Every interaction with a contact should be logged. Open the contact and scroll to the **Activities** section. Click **Log Activity**:

| Activity Type | When to Use |
|---|---|
| Call | You called or were called by the contact |
| Email | You sent or received a relevant email |
| Meeting | An in-person or video call meeting |
| Note | General note about the contact |
| Task | A to-do tied to this contact (e.g. "Send proposal by Friday") |

Activities build a chronological history on the contact record. Any team member opening the contact can instantly see the full relationship history without asking anyone.

## Custom Fields

If the default fields do not capture everything your business needs, ask your CRM Admin to add custom fields under **Settings → CRM → Custom Fields**. Common additions: KRA PIN, county, preferred contact time, customer tier.

## Merging Duplicate Contacts

Duplicate contacts happen — especially when contacts come in from multiple sources. To merge two duplicates:

1. Open the contact you want to **keep**
2. Click **More → Merge Duplicate**
3. Search for and select the duplicate contact
4. Review which fields to keep from each record
5. Click **Merge**

All leads, deals, activities, and campaign history from both records are combined into the surviving record. The duplicate is permanently deleted.

> **Tip:** Run a duplicate check periodically using **CRM → Contacts → Find Duplicates** (under the Tools menu). This flags contacts with matching email addresses or very similar names.

## How Contacts Link to Other Modules

- **Leads** — a lead is always associated with a contact (or creates one automatically)
- **Deals** — each deal has a primary contact and can have secondary contacts
- **Campaigns** — contacts are the recipients of email campaigns (segmented by tag or filter)
- **Invoices** — when you invoice a customer, their contact record in CRM is linked to the Finance invoice, giving you a full customer view including payment history
- **Support Tickets** — tickets created by a customer are visible on their CRM contact record
