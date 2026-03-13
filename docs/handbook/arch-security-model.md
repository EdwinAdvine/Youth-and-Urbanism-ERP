---
title: Security Model & RBAC
slug: security-model-rbac
category: architecture
article_type: guide
tags: [security, rbac, authentication, jwt, encryption, permissions]
sort_order: 1
is_pinned: false
excerpt: How Urban Vibes Dynamics secures access: JWT authentication, three-tier RBAC, and field-level encryption.
---

# Security Model & RBAC

This document explains how Urban Vibes Dynamics authenticates users, controls what they can see and do, and protects sensitive data at rest. Understanding this model is useful for both administrators configuring access and developers extending the platform.

---

## Authentication — JWT Token Flow

Urban Vibes Dynamics uses stateless JWT (JSON Web Token) authentication. There is no server-side session store; token validity is verified cryptographically on every request.

**Two-token model:**

| Token | Lifetime | Purpose |
|---|---|---|
| Access token | 15 minutes | Sent with every API request in the `Authorization: Bearer <token>` header |
| Refresh token | 7 days | Stored in an `HttpOnly` cookie; used to silently obtain a new access token |

**Flow:**

1. User submits credentials → `POST /api/v1/auth/login`
2. Backend verifies credentials, issues access token (JSON body) and refresh token (`HttpOnly` cookie)
3. React stores the access token in memory only (never `localStorage`) to prevent XSS token theft
4. TanStack Query automatically calls `POST /api/v1/auth/refresh` before the access token expires, using the HttpOnly cookie. The user never sees a login prompt unless the refresh token also expires.
5. On logout, both tokens are invalidated: the refresh token is added to a Redis deny-list (checked on every refresh), and the access token is discarded from memory.

**WebSocket authentication:** WebSocket connections (AI chat, live notifications) pass the access token as a query parameter: `?token=<access_token>`. The backend validates it on handshake and re-validates it if the connection outlives the token's 15-minute window.

---

## Three-Tier RBAC

Urban Vibes Dynamics uses a strict three-tier role hierarchy. Higher tiers inherit all permissions of tiers below them within their scope.

### Tier 1 — Super Admin

- Exactly one account (the bootstrap account created from environment variables)
- Full access to every module, every record, every setting
- The only role that can:
  - Create or delete App Admin accounts
  - Enable or disable modules
  - Configure system-wide settings (SMTP, AI provider, storage)
  - View the global audit log

### Tier 2 — App Admin

- Created by Super Admin, scoped to one or more specific modules (e.g. `finance`, `hr`)
- Within their module scope: can configure settings, manage users' module access, view all records, and override standard user restrictions
- Cannot access modules outside their scope, cannot view the Super Admin panel, cannot modify another App Admin's scope

### Tier 3 — User

- Standard access based on explicit permission grants
- Permissions are additive — users have no access by default; each permission must be explicitly granted

---

## Permission Format

Permissions follow a three-part dot-notation string:

```
<module>.<resource>.<action>
```

Examples:

| Permission string | What it allows |
|---|---|
| `finance.invoice.read` | View invoices |
| `finance.invoice.create` | Create new invoices |
| `finance.invoice.delete` | Delete invoices |
| `hr.employee.read` | View employee records |
| `hr.payroll.approve` | Approve payroll runs |
| `crm.deal.export` | Export deal data to CSV |

Permissions are assigned to users in **Admin → Users & Roles → [User] → Permissions**. App Admins can assign permissions only within their own module scope.

---

## Field-Level Encryption

Certain database columns containing personally identifiable information (PII) or financial data are encrypted at rest using **Fernet symmetric encryption** (AES-128 in CBC mode with HMAC-SHA256 authentication). The encryption key is derived from `SECRET_KEY` in your environment file and is never stored in the database.

Encrypted fields include (non-exhaustive):

- `Employee.national_id`, `Employee.bank_account_number`
- `Contact.phone`, `Contact.personal_email`
- `PayrollEntry.net_salary` (stored encrypted, decrypted only for authorised reads)
- `SystemSettings.smtp_password`, `SystemSettings.ai_api_key`

Encryption and decryption happen transparently in the SQLAlchemy model layer via a custom `EncryptedString` column type. Querying encrypted fields (e.g. searching by national ID) requires a decrypt-then-compare approach; the backend handles this in service-layer queries rather than at the database level.

---

## HTTPS and WSS in Production

In production, all traffic must be served over HTTPS/WSS. The recommended setup is:

1. Place an **nginx reverse proxy** or **Traefik** in front of the stack.
2. Terminate TLS at the proxy layer (certificates via Let's Encrypt or your own CA).
3. Set `SECURE_COOKIES=true` in the backend environment — this adds the `Secure` flag to the refresh token cookie so it is never sent over plain HTTP.

The Docker Compose file includes a commented-out nginx service template as a starting point.

---

## Rate Limiting

The backend enforces per-IP and per-user rate limits on sensitive endpoints:

| Endpoint category | Limit |
|---|---|
| `POST /auth/login` | 10 attempts per minute per IP |
| `POST /auth/refresh` | 60 requests per minute per user |
| AI inference endpoints | 30 requests per minute per user |
| General API endpoints | 300 requests per minute per user |

Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) are included in every API response. Limits are tracked in Redis and reset on a rolling window.
