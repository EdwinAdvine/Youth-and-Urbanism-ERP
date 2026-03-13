---
title: "API Authentication"
slug: "api-authentication"
category: "api-reference"
article_type: "guide"
tags: [api, authentication, jwt, tokens]
sort_order: 0
is_pinned: true
excerpt: "How to authenticate with the Urban Vibes Dynamics REST API using JWT access tokens."
---

# API Authentication

Urban Vibes Dynamics uses JWT (JSON Web Token) based authentication for all API endpoints.

## Getting a Token

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "yourpassword"
}
```

Response:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

- **Access token** — valid for 15 minutes
- **Refresh token** — valid for 7 days; use to get a new access token

## Using the Token

Include the access token in every request:

```http
GET /api/v1/finance/invoices
Authorization: Bearer eyJ...
```

## Refreshing Tokens

When the access token expires (HTTP 401 response), use the refresh token:

```http
POST /api/v1/auth/refresh
Authorization: Bearer <refresh_token>
```

Returns a new access token.

## Interactive API Docs

Full interactive API documentation (Swagger UI) is available at:
```
http://your-server:8010/docs
```

All endpoints are documented with request/response schemas, example values, and the ability to test directly in the browser.

## Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request (validation error) |
| 401 | Unauthenticated (token missing or expired) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not found |
| 422 | Unprocessable entity (schema validation failed) |
| 429 | Rate limit exceeded |
| 500 | Server error |
