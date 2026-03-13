---
title: Lead Management
slug: lead-management
category: crm
article_type: guide
module: crm
tags: [leads, pipeline, qualification, conversion, ai-score]
sort_order: 2
is_pinned: false
excerpt: Capture, qualify, and convert inbound leads in the CRM pipeline.
---

# Lead Management

A lead is any potential customer who has shown interest in your business but has not yet been qualified as a real sales opportunity. Urban Vibes Dynamics gives you tools to capture leads from multiple sources, score them automatically using AI, and convert the good ones into active deals.

## How Leads Are Created

### 1. Manual Entry

Go to **CRM → Leads** and click **New Lead**. Fill in the contact details, company, and what they are interested in. Use this for leads from trade shows, referrals, business card exchanges, or phone enquiries.

### 2. Website Form Submission

When you embed a Urban Vibes Dynamics web form on your website or landing page (created in **CRM → Forms**), every submission automatically creates a new lead. The form data maps to the lead fields, and the source is recorded as "Web Form". Your team is notified immediately.

**Example:** Your website has a "Request a Quote" form. A manager at Equity Bank fills it in. Within seconds, a lead appears in your CRM tagged with Equity Bank's details and the form's data — no manual entry needed.

### 3. Email Import

If Mail integration is enabled, inbound emails to a designated enquiries inbox (e.g. sales@yourcompany.co.ke) can be parsed and converted to leads. Ask your Admin to configure this under **Mail → Lead Capture Rules**.

## Lead Statuses

| Status | Meaning |
|---|---|
| **New** | Just created, not yet reviewed |
| **Contacted** | Initial outreach has been made |
| **Qualified** | Confirmed there is a real opportunity — budget, authority, need, timeline established |
| **Disqualified** | Not a fit (wrong industry, no budget, no decision-making power, etc.) |

Move a lead's status by opening the lead record and clicking the status badge, or by dragging the lead card in the Leads board view.

## AI Lead Score

Every lead has an AI-generated **Lead Score** from 0 to 100. The score is calculated by Urban Bad AI based on:

- Completeness of contact information
- Company size and industry signals
- Email engagement history (if they have received previous campaigns)
- Speed of response (leads who respond quickly score higher)
- Historical conversion patterns from similar leads

A score above **70** is generally considered warm — worth prioritising. A score below **30** may not be worth investing significant time in immediately.

> **Note:** The AI score is a guide, not a verdict. A lead from a warm referral may score low because they are a new contact with no history in the system — but your judgement should override the algorithm in those cases.

## Qualifying a Lead

Qualifying means confirming the lead is a genuine opportunity. A practical framework used by many Kenyan B2B sales teams:

- **Budget** — Do they have the money to buy?
- **Authority** — Are you talking to the decision maker, or do you need to reach someone more senior?
- **Need** — Do they have a problem your product or service solves?
- **Timeline** — Are they buying soon, or just researching for next year?

Once all four are confirmed, mark the lead as **Qualified**.

## Converting a Qualified Lead to a Deal

From a Qualified lead, click **Convert to Deal**. You will be prompted to:

1. Confirm or update the contact details
2. Set an initial deal value (KES amount)
3. Assign the deal to a pipeline stage (default: Qualified)
4. Assign a sales rep

Clicking **Convert** creates a Deal in your pipeline. The lead record is marked as Converted and linked to the new deal — the history is preserved.

## Lead Source Attribution

Every lead has a **Source** field. Keeping this accurate helps you understand which channels deliver the best leads. At the end of each quarter, go to **CRM → Reports → Lead Sources** to see your conversion rate by source. This tells you where to focus your marketing budget.

Common sources in a Kenyan business context: Referral, LinkedIn, Trade Show, Cold Call, Tender Portal, Google Ads, Radio, Existing Customer Upsell.

## Disqualifying Leads

Not every lead should be chased indefinitely. When you determine a lead is not a fit, mark it **Disqualified** and select a reason:

- Budget too small
- Wrong geography
- Competitor relationship
- No decision-making authority
- Timeline too far out

Disqualified leads stay in the system for reporting and can be re-opened later if circumstances change.
