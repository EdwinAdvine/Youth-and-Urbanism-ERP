# Event Bus

Urban Vibes Dynamics uses a **Redis pub/sub event bus** for decoupled, asynchronous
communication between modules. Instead of importing one module's code into
another (tight coupling), modules publish events that other modules can react
to independently.

**Implementation:** `backend/app/core/events.py`
**Singleton:** `event_bus` — imported and used across the codebase

---

## How It Works

```
Module A (Publisher)              Redis Channel              Module B (Subscriber)
─────────────────────             ──────────────             ─────────────────────
await event_bus.publish(      →   "meeting.created"    →   handle_meeting_created()
  "meeting.created",                                         auto-creates CalendarEvent
  {"meeting_id": "...", ...}
)
```

1. Publisher calls `await event_bus.publish(channel, data)`
2. Backend serializes the payload to JSON and sends it to the Redis channel
3. The background listener task picks up the message
4. All registered handlers for that channel are called with `data`
5. Handlers run concurrently (order is not guaranteed)

---

## Usage

### Publishing an Event

```python
from app.core.events import event_bus

# In any async endpoint or service:
await event_bus.publish("meeting.created", {
    "meeting_id": str(meeting.id),
    "organizer_id": str(current_user.id),
    "title": meeting.title,
})
```

### Subscribing to an Event

Handlers are registered in `backend/app/main.py` during the lifespan startup.
Register in `main.py` to ensure handlers are set up before the bus starts.

```python
from app.core.events import event_bus

@event_bus.on("meeting.created")
async def handle_meeting_created(data: dict):
    meeting_id = data["meeting_id"]
    # Create a CalendarEvent, send notification, etc.
    ...
```

### Lifecycle

The event bus is started and stopped in `main.py`'s lifespan function:

```python
async with lifespan(app):
    await event_bus.start()   # connects to Redis, starts listener task
    # ... app runs ...
    await event_bus.stop()    # cancels listener, closes Redis connection
```

---

## Registered Event Channels

All channels registered as of Urban Vibes Dynamics v1.0:

| Channel | Published By | Handled By | Description |
|---------|-------------|------------|-------------|
| `meeting.created` | Meetings API | Calendar | Auto-creates a CalendarEvent |
| `meeting.deleted` | Meetings API | Calendar | Removes linked CalendarEvent |
| `calendar.event.created` | Calendar API | Notifications | Notifies attendees |
| `calendar.event.updated` | Calendar API | Notifications | Notifies attendees of changes |
| `calendar.event.reminder` | Celery Beat | Notifications | Fires reminder notifications |
| `file.uploaded` | Drive API | Audit Log | Logs file upload activity |
| `file.deleted` | Drive API | Audit Log | Logs file deletion |
| `email.sent` | Mail API | Audit Log | Logs outbound email |
| `note.created` | Notes API | AI | Optionally triggers auto-summarization |
| `form.response.submitted` | Forms API | CRM | Auto-creates or updates a CRM Lead |
| `task.status.changed` | Projects API | Notifications, CRM | Notifies assignees; updates linked deal |
| `pos.sale.completed` | POS API | Finance | Creates a journal entry for sale revenue |
| `ecommerce.order.created` | E-Commerce API | Finance, Mail | Creates an invoice; sends order confirmation email |
| `ecommerce.order.shipped` | E-Commerce API | Mail | Sends shipping notification email |
| `inventory.valuation.changed` | Inventory API | Finance | Updates balance sheet stock valuation |
| `supplychain.goods_received` | Supply Chain API | Inventory | Updates stock levels from GRN |
| `wo.completed` | Manufacturing API | Notifications | Notifies production manager of WO completion |
| `support.ticket.created` | Support API | Mail | Sends ticket acknowledgment email to customer |
| `opportunity.stage_changed` | CRM API | Mail, Notifications | Sends stage-change notification |
| `task.assigned` | Projects API | Mail, Notifications | Notifies newly assigned user |

---

## Adding a New Event

1. **Publish from the source module:**
   ```python
   await event_bus.publish("mymodule.something_happened", {
       "entity_id": str(entity.id),
       "user_id": str(current_user.id),
       # ... relevant data
   })
   ```

2. **Register a handler in `main.py`:**
   ```python
   @event_bus.on("mymodule.something_happened")
   async def handle_something_happened(data: dict):
       async with AsyncSessionLocal() as db:
           # handle the event
           ...
   ```

3. **Document the new channel** in this file and in `backend/app/core/events.py`.

---

## Payload Convention

All event payloads are plain dicts. Include:
- Entity IDs (as strings — UUIDs serialized)
- The user who triggered the action (`user_id`)
- Enough context for handlers to act without a DB query if possible
- Avoid embedding large objects — use IDs and let handlers load what they need

The event bus wraps your payload with metadata before publishing:
```json
{
  "event": "meeting.created",
  "data": { "meeting_id": "...", "organizer_id": "..." },
  "timestamp": "2026-03-13T14:00:00Z",
  "id": "uuid-of-this-event"
}
```

Handlers receive only the inner `data` dict.

---

## Error Handling

If a handler raises an exception, it is logged but **does not affect other handlers**
or the original request. The event bus is fire-and-forget — it provides
at-most-once delivery (if Redis goes down, events are lost).

For critical side effects that must be guaranteed, use Celery tasks instead
of event handlers.
