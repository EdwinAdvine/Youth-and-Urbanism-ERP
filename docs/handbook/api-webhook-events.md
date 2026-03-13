---
title: Webhook Events & Automation
slug: api-webhook-events
category: api-reference
article_type: guide
module: admin
tags: [webhooks, events, api, automation, integrations]
sort_order: 3
is_pinned: false
excerpt: Receive real-time event notifications from Urban ERP via webhooks to integrate with external systems.
---

# Webhook Events & Automation

Webhooks let external systems receive real-time notifications when events happen in Urban ERP — no polling required.

## Configuring a Webhook

Go to **Admin → Settings → Webhooks → New Webhook**:

| Field | Description |
|-------|-------------|
| URL | Your endpoint that will receive POST requests |
| Secret | Used to sign requests for verification |
| Events | Which events to subscribe to (multi-select) |

## Available Events

| Module | Event | When It Fires |
|--------|-------|---------------|
| Finance | `invoice.created` | A new invoice is saved |
| Finance | `invoice.paid` | Invoice status changes to Paid |
| Finance | `payment.received` | A payment is recorded |
| Finance | `expense.approved` | An expense claim is approved |
| CRM | `lead.created` | A new lead is added |
| CRM | `lead.score_changed` | AI score crosses a threshold |
| CRM | `deal.won` | Deal stage set to Won |
| CRM | `deal.lost` | Deal stage set to Lost |
| CRM | `deal.stage_changed` | Deal moves to any new stage |
| HR | `employee.created` | A new employee record is created |
| HR | `payroll.published` | A payroll run is published |
| HR | `leave.approved` | A leave request is approved |
| Support | `ticket.created` | A new support ticket is opened |
| Support | `ticket.resolved` | A ticket is marked Resolved |
| Support | `sla.breached` | An SLA deadline is missed |
| E-Commerce | `order.placed` | A new order is submitted |
| E-Commerce | `order.shipped` | Order marked as shipped |
| E-Commerce | `order.refunded` | A refund is processed |
| Projects | `project.created` | A new project is created |
| Projects | `task.completed` | A task is marked complete |
| Projects | `milestone.reached` | A project milestone is hit |

## Webhook Payload

Every request is a JSON POST:

```json
{
  "event": "deal.won",
  "timestamp": "2026-03-13T14:30:00+03:00",
  "data": {
    "deal_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "deal_name": "Acme Corp — ERP Implementation",
    "value": 2500000,
    "currency": "KES",
    "contact_id": "...",
    "assigned_to": "..."
  }
}
```

## Verifying the Signature

Each request includes an HMAC-SHA256 signature header:

```
X-Urban-Signature: sha256=abc123...
```

Verify it before processing:

```python
import hmac, hashlib

def verify(secret: str, body: bytes, signature: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

**Always verify the signature** — reject requests that don't match.

## Retry Logic

If your endpoint returns a non-2xx status code, Urban ERP retries:

| Attempt | Delay |
|---------|-------|
| 1st retry | 1 minute |
| 2nd retry | 5 minutes |
| 3rd retry | 15 minutes |

After 3 failed attempts, the delivery is marked as failed. Check the delivery log to investigate.

## Delivery Log

**Admin → Settings → Webhooks → [Webhook Name] → Delivery Log** shows each delivery:
- Timestamp
- HTTP response code from your endpoint
- Response body (first 500 chars)
- Latency

## Security Best Practices

- Use HTTPS only — never send webhooks to plain HTTP endpoints
- Always verify the HMAC signature before processing
- Rotate the webhook secret if you suspect it's been compromised (Admin → Webhooks → Regenerate Secret)
- Respond with 200 quickly; do heavy processing asynchronously

> **Tip:** Use a tool like [webhook.site](https://webhook.site) during development to inspect webhook payloads before writing your integration code.
