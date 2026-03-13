# Data Push — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 1


## Contents

- [data_push.py](#data-push) (1 endpoints)

---

## data_push.py

Server-Sent Events (SSE) endpoint for real-time data push.

Provides a persistent SSE connection that notifies the authenticated user
whenever data changes in the ERP. The frontend uses this to invalidate
TanStack Query caches instantly — achieving ≤5s data freshness across tabs.

Usage (frontend):
    const es = new EventSource('/api/v1/data-push/stream?token=<jwt>');
    es.onmessage = (e) => {
        const { entity, action } = JSON.parse(e.data);
        queryClient.invalidateQueries({ queryKey: ENTITY_QUERY_MAP[entity] });
    };

Redis channels:
    - user:{user_id}:changes  — changes relevant to a specific user
    - broadcast:changes       — changes relevant to all users


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/stream` | `data_change_stream` | Open a Server-Sent Events stream that delivers data change events. |

### `GET /stream`

**Function:** `data_change_stream` (line 40)

Open a Server-Sent Events stream that delivers data change events.

The client should pass the JWT as a query parameter since EventSource
does not support custom headers. Events are delivered as JSON objects:

    data: {"entity": "invoice", "action": "created", "id": "...", "ts": "..."}

Reconnection is handled automatically by the browser's EventSource API.

**Parameters:** `token`

