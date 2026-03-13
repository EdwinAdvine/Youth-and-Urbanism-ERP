---
title: Support Automation & AI Triage
slug: sup-automation
category: support
article_type: guide
module: support
tags: [automation, ai, triage, assignment, rules, workflows]
sort_order: 5
is_pinned: false
excerpt: Automate ticket routing, assignment, and responses using rules and AI-powered triage.
---

# Support Automation & AI Triage

Support automation reduces manual work by routing, tagging, and responding to tickets automatically — using both rule-based logic and AI.

## Accessing Automation

Go to **Support → Automation**. You'll see a list of existing rules and their on/off status.

## Creating a Routing Rule

Example: automatically route billing tickets to the Billing team with High priority.

- **Trigger:** Ticket Created
- **Condition:** Category = "Billing"
- **Actions:**
  - Assign to team: Billing
  - Set priority: High
  - Add tag: "billing"

## AI Triage

Urban ERP uses AI to analyse each new ticket's subject and body and:

- **Suggest category** — pre-fills the category field
- **Suggest priority** — based on urgency keywords
- **Detect language** — routes to a language-appropriate agent if configured
- **Flag urgency** — tickets containing "payment failed", "data breach", or "urgent" are automatically escalated

AI suggestions appear as pre-filled fields that agents can accept or override.

## Common Automation Rules

### Auto-response on Ticket Creation
- **Trigger:** Ticket Created
- **Action:** Send Email → Template: "Ticket Received Confirmation"
- Customers receive `Your ticket #{{ticket.id}} has been received`

### Auto-close Stale Tickets
- **Trigger:** Ticket status = Waiting for Customer AND inactivity ≥ 5 days
- **Action 1:** Send Email → Template: "Closing Due to Inactivity"
- **Action 2:** Set status: Closed

### CSAT Survey on Resolution
- **Trigger:** Ticket Resolved
- **Action:** Send Email → Template: "Satisfaction Survey" (1–5 rating + comment)

## Canned Responses

Pre-written reply templates save time on common questions:

1. Go to **Support → Canned Responses → New**
2. Give it a shortcut name (e.g. "refund-policy")
3. In any ticket reply box, type `/` to trigger the canned response picker
4. Supported variables: `{{ticket.id}}`, `{{contact.first_name}}`, `{{agent.name}}`

## Automation Log

Each rule shows:
- Total executions
- Last triggered timestamp
- Any errors (e.g. template missing, user not found)

Review the log weekly to catch broken rules.

> **Tip:** Create a "Spam/Junk" rule that auto-closes tickets matching keywords like "unsubscribe" or "remove me" — this keeps your queue clean automatically.
