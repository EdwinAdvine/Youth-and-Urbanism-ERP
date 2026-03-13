# Configuration Reference

All Urban Vibes Dynamics configuration is managed via environment variables loaded by
`backend/app/core/config.py` using **Pydantic Settings**. Every variable can
be set in a `.env` file at the project root or as a real environment variable.

The `settings` singleton is cached with `@lru_cache` — it is created once at
startup. To apply changes you must restart the backend.

---

## Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://urban:urban@localhost:5433/urban_erp` | Async PostgreSQL connection string (asyncpg driver required) |
| `REDIS_URL` | `redis://localhost:6380/0` | Redis connection for the event bus, Celery broker results, and rate limiting |

---

## JWT & Security

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | (required) | 64-char hex secret — used for JWT signing AND Fernet field encryption. Generate with `openssl rand -hex 32` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Access token lifetime (minutes). Short-lived; clients use refresh token to renew |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` | Refresh token lifetime (days). Stored in Redis and invalidated on logout |
| `ALGORITHM` | `HS256` | JWT signing algorithm |

---

## Application

| Variable | Default | Description |
|----------|---------|-------------|
| `DEBUG` | `False` | Enables FastAPI debug mode + colored console logs. Never enable in production |
| `CORS_ORIGINS` | `["http://localhost:3010"]` | Comma-separated list of allowed CORS origins. Add your frontend URL in production |
| `APP_NAME` | `Urban Vibes Dynamics` | Application display name |

---

## Super Admin Seed

These values are only used on **first startup** to seed the initial Super Admin account.

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPER_ADMIN_EMAIL` | `admin@urban-vibes-dynamics.com` | Super Admin login email |
| `SUPER_ADMIN_PASSWORD` | `AdminPassword123!` | Super Admin initial password — **change immediately after first login** |
| `SUPER_ADMIN_FULL_NAME` | `System Administrator` | Super Admin display name |

---

## MinIO (File Storage)

| Variable | Default | Description |
|----------|---------|-------------|
| `MINIO_URL` | `http://localhost:9010` | MinIO API endpoint (internal Docker address) |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO access key |
| `MINIO_SECRET_KEY` | `minioadmin123` | MinIO secret key |
| `MINIO_BUCKET` | `urban-vibes-dynamics-files` | Default bucket name for all file uploads |

---

## Mail (SMTP / IMAP)

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | `localhost` | SMTP server hostname |
| `SMTP_PORT` | `25` | SMTP port (25 = plain, 587 = STARTTLS, 465 = SSL) |
| `SMTP_USER` | `""` | SMTP authentication username (empty = no auth) |
| `SMTP_PASSWORD` | `""` | SMTP authentication password |
| `SMTP_USE_TLS` | `False` | Use SSL/TLS connection to SMTP server |
| `MAIL_DOMAIN` | `urban-vibes-dynamics.local` | Domain used for Message-ID generation |
| `IMAP_HOST` | `localhost` | IMAP server hostname |
| `IMAP_PORT` | `143` | IMAP port (143 = plain, 993 = SSL) |
| `IMAP_USER` | `""` | IMAP username |
| `IMAP_PASSWORD` | `""` | IMAP password |

---

## AI

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER` | `openai` | Active AI provider: `openai`, `anthropic`, `grok`, or any OpenAI-compatible provider |
| `AI_API_KEY` | `""` | API key for the active AI provider (OpenAI, Anthropic, Grok, or compatible) |
| `AI_BASE_URL` | Provider-specific | Base URL for the AI API. Override for self-hosted or alternative OpenAI-compatible providers |
| `AI_MODEL` | Provider-specific | Model name to use (e.g., `gpt-4`, `claude-3-opus`, `grok-2`). Defaults vary by provider |

---

## ONLYOFFICE

| Variable | Default | Description |
|----------|---------|-------------|
| `ONLYOFFICE_URL` | `http://localhost:8083` | ONLYOFFICE Document Server internal URL |
| `ONLYOFFICE_PUBLIC_URL` | `http://localhost:8083` | ONLYOFFICE URL visible to browsers (used in CSP and editor config) |
| `ONLYOFFICE_JWT_SECRET` | (uses `SECRET_KEY`) | Secret for signing ONLYOFFICE editor configs and callback verification |

---

## Jitsi (Video Conferencing)

| Variable | Default | Description |
|----------|---------|-------------|
| `JITSI_PUBLIC_URL` | `http://localhost:8443` | Jitsi Meet public URL for room links |
| `JITSI_APP_ID` | `urban-vibes-dynamics` | Jitsi app ID for JWT auth |
| `JITSI_APP_SECRET` | (uses `SECRET_KEY`) | Secret for signing Jitsi meeting JWTs |

---

## Celery (Background Jobs)

| Variable | Default | Description |
|----------|---------|-------------|
| `CELERY_BROKER_URL` | `redis://localhost:6380/1` | Redis URL for Celery task broker (db 1) |
| `CELERY_RESULT_BACKEND` | `redis://localhost:6380/2` | Redis URL for Celery results (db 2) |

---

## E-Commerce

| Variable | Default | Description |
|----------|---------|-------------|
| `ECOMMERCE_CURRENCY` | `KES` | Default currency code for storefront pricing |
| `STOREFRONT_URL` | `http://localhost:3010` | Public storefront URL (used in order confirmation emails) |

---

## Production Checklist

Before going to production, ensure you have:

- [ ] Generated a new `SECRET_KEY` with `openssl rand -hex 32`
- [ ] Set `DEBUG=False`
- [ ] Updated `CORS_ORIGINS` to your production frontend URL
- [ ] Changed the Super Admin password after first login
- [ ] Configured real `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD`
- [ ] Set real `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY` (not defaults)
- [ ] Set `ONLYOFFICE_JWT_SECRET` to a dedicated secret (not `SECRET_KEY`)
- [ ] Set `JITSI_APP_SECRET` to a dedicated secret
- [ ] Configured AI provider by setting `AI_PROVIDER`, `AI_API_KEY`, and optionally `AI_BASE_URL` and `AI_MODEL`

---

## Loading Configuration

```python
from app.core.config import settings

# Access any setting
print(settings.DATABASE_URL)
print(settings.DEBUG)
```

The `settings` object is a cached singleton — import it anywhere in the backend.
