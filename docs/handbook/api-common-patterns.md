---
title: API Common Patterns
slug: api-common-patterns
category: api-reference
article_type: guide
module: admin
tags: [api, rest, pagination, filtering, errors, patterns]
sort_order: 2
is_pinned: false
excerpt: Common request patterns, pagination, filtering, error responses, and conventions used across all Urban ERP API endpoints.
---

# API Common Patterns

## Base URL & Documentation

- **Base URL:** `https://yourdomain.com/api/v1/`
- **Interactive docs (Swagger):** `https://yourdomain.com/docs`
- **ReDoc:** `https://yourdomain.com/redoc`

## Authentication

All endpoints require a JWT bearer token:

```http
Authorization: Bearer <jwt_token>
```

Get a token:

```http
POST /api/v1/auth/login
Content-Type: application/json

{"email": "user@example.com", "password": "your-password"}
```

Response: `{"access_token": "eyJ...", "token_type": "bearer"}`

Tokens expire after 24 hours by default. Re-authenticate to get a new token.

## Pagination

Most list endpoints accept:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `page` | 1 | Page number |
| `per_page` | 20 | Items per page (max 100) |

Response envelope:

```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "per_page": 20,
  "pages": 8
}
```

## Filtering & Sorting

```
GET /api/v1/crm/leads?status=qualified&assigned_to=<user-uuid>&created_after=2026-01-01
GET /api/v1/finance/invoices?sort_by=created_at&sort_dir=desc
```

Available filter parameters vary by endpoint — see the Swagger docs for the full list.

## Error Responses

### Not Found (404)
```json
{"detail": "Invoice not found"}
```

### Validation Error (422)
```json
{
  "detail": [
    {
      "loc": ["body", "amount"],
      "msg": "value must be greater than 0",
      "type": "value_error"
    }
  ]
}
```

### Unauthorized (401)
```json
{"detail": "Not authenticated"}
```

### Forbidden (403)
```json
{"detail": "Insufficient permissions"}
```

## CRUD Conventions

| Action | Method | Returns |
|--------|--------|---------|
| List | `GET /resource` | Paginated list |
| Get one | `GET /resource/{id}` | Single object |
| Create | `POST /resource` | 201 + created object |
| Full update | `PUT /resource/{id}` | 200 + updated object |
| Partial update | `PATCH /resource/{id}` | 200 + updated object |
| Delete | `DELETE /resource/{id}` | 200 + `{"message": "Deleted successfully"}` |

Note: Urban ERP returns **200 (not 204)** on delete — this is intentional and consistent across all endpoints.

## Data Types

- **IDs:** UUIDs as strings (`"3fa85f64-5717-4562-b3fc-2c963f66afa6"`)
- **Dates:** ISO 8601 (`"2026-03-13T14:30:00+03:00"`) — EAT (UTC+3) for Kenyan deployments
- **Money:** integers in the smallest currency unit (KES cents) or decimals — check the specific endpoint schema
- **Booleans:** `true` / `false` (JSON)

> **Tip:** Visit `/docs` on your running instance for interactive API exploration — every endpoint is documented with example request and response bodies you can execute directly in the browser.
