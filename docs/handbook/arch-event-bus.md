---
title: Event Bus & Cross-Module Integrations
slug: event-bus-cross-module-integrations
category: architecture
article_type: guide
tags: [event-bus, redis, pub-sub, integrations, cross-module]
sort_order: 2
is_pinned: false
excerpt: How modules communicate via Redis pub/sub events — the glue holding Urban Vibes Dynamics together.
---

# Event Bus & Cross-Module Integrations

Urban Vibes Dynamics's modules are developed independently, but they need to talk to each other. A CRM lead should appear when a web form is submitted. A Finance journal entry should be created when a POS sale completes. Notes should be auto-created when a meeting ends. This coordination happens through an in-process event bus backed by Redis pub/sub.

---

## How the Event Bus Works

The event bus lives in `backend/app/core/event_bus.py`. It is a thin async wrapper around Redis pub/sub with a simple publish/subscribe API:

```python
# Publishing an event (any service can do this)
await event_bus.publish("pos.sale.completed", {
    "sale_id": sale.id,
    "customer_id": sale.customer_id,
    "total": sale.total,
    "items": [...]
})

# Subscribing to an event (registered at app startup)
@event_bus.on("pos.sale.completed")
async def handle_pos_sale(payload: dict):
    # create CRM purchase history record
    # trigger email receipt via Celery
    ...
```

Handlers are registered during the FastAPI app lifespan startup in `backend/app/main.py`. Every handler runs in the same async event loop as the FastAPI server — there is no separate consumer process to manage.

---

## Delivery Guarantees

The event bus uses **at-most-once delivery**. This means:

- If the backend process is restarted between a publish and its handler running, that event is lost.
- Handlers are not retried on failure.

This is an intentional trade-off. Urban Vibes Dynamics's cross-module events are supplementary side effects (creating a linked record, sending a notification) — they are not the source of truth for the triggering action. If a `pos.sale.completed` handler fails to create the CRM entry, the POS sale is still recorded correctly. A Super Admin or App Admin can manually create the cross-module link if needed.

For operations where delivery guarantees matter — primarily email sending — events route through Celery tasks, which have their own retry logic backed by Redis.

---

## Cross-Module Event Examples

### form.response.submitted → CRM Lead

When a visitor submits a lead capture form:

1. The Forms module publishes `form.response.submitted` with `{form_id, fields, submitted_at}`.
2. The CRM handler checks whether the form is configured to auto-create leads (set in **CRM → Forms → [Form] → Lead Settings**).
3. If enabled, it maps the form fields to Contact and Lead fields, creates both records, and assigns the lead to the configured owner.

**Result:** A new lead appears in the CRM pipeline within seconds of form submission — no manual data entry required.

---

### meeting.ended → Notes & CRM

When a Jitsi meeting ends:

1. The Meetings module publishes `meeting.ended` with `{meeting_id, participants, duration, transcript_url}`.
2. The Notes handler creates a new meeting-notes document in the linked project (if any) with a pre-filled template containing the participant list, date, and duration.
3. The CRM handler checks whether any meeting participant is a CRM contact. If so, it logs the meeting as an Activity on that contact's timeline.

**Result:** Meeting notes and CRM activity log entries are created automatically. Participants find a notes document waiting for them when they return to the project.

---

### pos.sale.completed → Finance Journal Entry

When a POS transaction is finalised:

1. The POS module publishes `pos.sale.completed` with line items, payment method, and totals.
2. The Finance handler creates a journal entry: debit Cash (or the appropriate payment account), credit Sales Revenue, credit Tax Payable (if applicable).
3. If the sale is linked to a CRM contact (loyalty programme), the CRM handler records the purchase in that contact's history.

**Result:** Every POS sale automatically creates the correct double-entry bookkeeping record in Finance with no manual journal entry required.

---

### supplychain.po.completed → Finance Payable

When a purchase order is marked as received:

1. Supply Chain publishes `supplychain.po.completed` with the PO total and supplier ID.
2. The Finance handler creates a vendor Bill in **Accounts Payable**, pre-populated with the supplier details and line items from the PO.

---

## Tracing Event Flow for Debugging

When a cross-module side effect does not happen as expected, follow these steps:

1. **Check the backend logs.** All event publishes are logged at `DEBUG` level with the event name and payload. All handler invocations are logged at `INFO` level. Run `docker compose logs urban-vibes-dynamics-backend --tail 200 | grep event_bus` to see recent activity.

2. **Verify the handler is registered.** Open `backend/app/main.py` and look for the `lifespan` function. All `event_bus.on(...)` registrations happen there. If a handler is missing, it was never registered.

3. **Check for handler exceptions.** Unhandled exceptions in event handlers are logged at `ERROR` level with a full traceback but do not crash the server. Search logs for `ERROR` entries mentioning the event name.

4. **Test with a manual publish.** In development, you can use the Admin API endpoint `POST /api/v1/admin/events/test` (Super Admin only) to publish a synthetic event with a custom payload — useful for testing handler logic without triggering the real upstream action.

5. **Inspect Redis directly.** Connect to the Redis container (`docker compose exec urban-vibes-dynamics-redis redis-cli`) and use `MONITOR` to watch pub/sub traffic in real time while reproducing the action in another tab.
