---
title: SLA Policies & Escalations
slug: sup-sla-management
category: support
article_type: guide
module: support
tags: [sla, escalation, response-time, priority, policies]
sort_order: 4
is_pinned: false
excerpt: Define SLA response and resolution targets by priority and configure automatic escalation when SLAs are at risk.
---

# SLA Policies & Escalations

SLA (Service Level Agreement) policies define how quickly tickets must be responded to and resolved. Urban ERP tracks compliance automatically and escalates when SLAs are at risk.

## Creating an SLA Policy

Go to **Support → Settings → SLA Policies → New Policy**:

- **Name** — e.g. "Standard Support", "Enterprise SLA"
- **Applies to** — All tickets / by priority / by category / by contact tag

## Default SLA Targets

| Priority | First Response | Resolution |
|----------|---------------|------------|
| Critical | 1 hour | 4 hours |
| High | 4 hours | 24 hours |
| Medium | 8 hours | 3 business days |
| Low | 24 hours | 7 business days |

## Business Hours

SLA timers count only during configured business hours (e.g. Mon–Fri 08:00–18:00 EAT). Weekends and public holidays pause the clock.

Configure under **Support → Settings → Business Hours**.

## SLA Status Indicators on Tickets

| Colour | Meaning |
|--------|---------|
| Green | On track — more than 25% of SLA time remaining |
| Amber | At risk — less than 25% of time remaining |
| Red | Breached — SLA target has passed |

## Automatic Escalation

When a ticket reaches 75% of its SLA timer, Urban ERP:
1. Sends an in-app notification to the Support Manager
2. Sends an escalation email to the manager
3. Adds an "At Risk" tag to the ticket

On breach:
- Sends an alert to the manager
- Can send a customer-facing apology message (configurable per policy)
- Logs the breach in the SLA report

## SLA Reports

**Support → Reports → SLA** shows:

- Breach rate by priority
- Average first response time and resolution time
- Rep-level SLA performance breakdown
- Month-over-month trend

## VIP / Custom SLAs

Mark a CRM contact as VIP to apply a tighter SLA policy to all their tickets automatically. Assign the VIP policy under **Support → Settings → SLA Policies → Contact Tags**.

> **Tip:** Start with conservative SLA targets you can consistently meet, then tighten them. Missing SLAs consistently damages trust more than having looser targets you always hit.
