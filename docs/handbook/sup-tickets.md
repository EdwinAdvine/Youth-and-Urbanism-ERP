---
title: Managing Support Tickets
slug: managing-support-tickets
category: support
article_type: guide
module: support
tags: [support, tickets, sla, agents, escalation, helpdesk]
sort_order: 1
is_pinned: false
excerpt: Create, assign, and resolve support tickets with SLA tracking.
---

# Managing Support Tickets

The Support module is your team's helpdesk. It centralises all customer issues — whether they arrive by email, live chat, or are logged manually — into a single queue with full SLA tracking, assignment, and escalation.

## How Tickets Are Created

Tickets enter the Support queue through three channels:

1. **Email**: when a customer sends a message to your support email address (e.g., `support@yourcompany.co.ke`), Urban Vibes Dynamics automatically creates a ticket. The customer's message becomes the first ticket comment. Replies you send from Urban Vibes Dynamics land in their inbox.
2. **Live Chat**: when a visitor starts a chat on your website widget and it escalates beyond the bot, a ticket is created and linked to the chat transcript (see the Live Chat article).
3. **Manual**: any agent can click **New Ticket** in **Support → Tickets** to log an issue on behalf of a customer — useful for issues reported by phone or in person.

## The Ticket Queue

Open **Support → Tickets** to see all tickets. Filter by status, priority, assigned agent, or team. Sort by creation date, SLA due time, or last activity. Each ticket row shows the customer name, subject, current status, priority badge, assigned agent, and SLA countdown.

Click any ticket to open the detail view, which shows the full conversation thread, ticket metadata, linked CRM contact, and action buttons.

## Assigning Tickets

1. Open a ticket.
2. In the **Assigned To** field, select an agent or a team queue.
3. The assigned agent receives a notification.

Tickets can also be auto-assigned using routing rules configured in **Support → Settings → Routing Rules** — for example, all tickets tagged "Billing" go automatically to the Finance support team.

## Priority Levels

Every ticket is assigned a priority, which determines its SLA targets:

| Priority | Response Target | Resolution Target |
|----------|----------------|-------------------|
| Critical | 1 hour          | 4 hours            |
| High     | 4 hours         | 24 hours           |
| Medium   | 8 hours         | 48 hours           |
| Low      | 24 hours        | 72 hours           |

Priority is set manually by the agent or automatically by routing rules (e.g., tickets from VIP customers are automatically set to High).

## Status Workflow

A ticket moves through the following statuses:

1. **Open** — newly created, awaiting first response
2. **In Progress** — an agent is actively working on it
3. **Pending Customer** — waiting for information from the customer
4. **Resolved** — the issue has been fixed; awaiting customer confirmation
5. **Closed** — confirmed resolved or automatically closed after 72 hours of no customer response post-resolution

Agents update the status from the ticket detail view. Status changes are logged in the ticket activity timeline.

## SLA Tracking and Breach Alerts

The SLA countdown is visible on every ticket. When a ticket is approaching its response or resolution deadline, the timer turns amber. When the deadline is breached, it turns red and:

- The assigned agent receives an urgent notification.
- The agent's team lead or Support Admin receives an escalation alert.
- The ticket is flagged with a **SLA Breached** badge in the queue.

## Escalation

To escalate a ticket to a senior agent or manager:

1. Open the ticket and click **Escalate**.
2. Select the escalation target (a specific user or the escalation team).
3. Add a note explaining why you are escalating.

The escalation target receives an immediate notification and the ticket appears at the top of their queue.

## Linking to CRM

Every ticket is linked to a CRM contact automatically when the customer's email is recognised. From the ticket detail view, click **View CRM Record** to see the customer's full history — past deals, invoices, and previous tickets — without leaving the support view.
