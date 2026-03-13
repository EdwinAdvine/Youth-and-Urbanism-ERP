"""Central configuration for the Urban Vibes Dynamics platform.

Defines all environment variables consumed by the backend, organized by
subsystem (database, JWT, AI, mail, etc.).  Values are loaded from a `.env`
file at startup via Pydantic Settings; every variable listed here has a
sensible development default so the stack boots with zero manual setup.

Usage:
    from app.core.config import settings

    url = settings.DATABASE_URL
    secret = settings.SECRET_KEY

The singleton ``settings`` object at module level is cached via
``@lru_cache`` so the `.env` file is only read once per process.

Integrations:
    - database.py  — uses DATABASE_URL for the async SQLAlchemy engine
    - deps.py      — uses SECRET_KEY / ALGORITHM to decode JWTs
    - events.py    — uses REDIS_URL for the pub/sub event bus
    - celery_app.py — uses CELERY_BROKER_URL / CELERY_RESULT_BACKEND
    - ai.py        — uses AI_PROVIDER and vendor API keys
    - minio.py     — uses MINIO_URL, MINIO_ACCESS_KEY, MINIO_SECRET_KEY
    - smtp/imap    — uses SMTP_* and IMAP_* for mail send/receive
"""

from __future__ import annotations

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Pydantic Settings model holding every configurable env var.

    All values can be overridden by setting the corresponding environment
    variable (case-insensitive).  A ``.env`` file in the project root is
    loaded automatically.  Unknown variables are silently ignored
    (``extra="ignore"``).
    """

    model_config = SettingsConfigDict(
        env_file=".env",          # auto-load .env from the working directory
        env_file_encoding="utf-8",
        case_sensitive=False,     # ENV_VAR and env_var both resolve
        extra="ignore",           # ignore vars not defined on this class
    )

    # ── Application ──────────────────────────────────────────────────────────
    APP_NAME: str = "Urban Vibes Dynamics"                  # displayed in UI headers and email subjects
    APP_URL: str = "http://localhost:3010"        # public frontend URL — used for email links, CORS, OAuth redirects
    DEBUG: bool = False                           # enables verbose logging and auto-reload; NEVER True in production

    # ── Database ─────────────────────────────────────────────────────────────
    # Primary write connection. In HA mode this should point to PgBouncer
    # (port 6432) which routes to the Patroni primary via HAProxy.
    # In single-node dev mode it points directly to the postgres container.
    DATABASE_URL: str = "postgresql+asyncpg://urban:urban_secret@postgres:5432/urban_vibes_dynamics"

    # Read-replica connection for heavy read queries (analytics, reports, lists).
    # When PGBOUNCER_ENABLED=true this should point to PgBouncer's readonly db.
    # Falls back to DATABASE_URL when empty (single-node dev mode).
    READ_DATABASE_URL: str = ""

    # Set to true when the stack runs with PgBouncer in front of Patroni.
    # Adjusts the engine pool settings to work correctly with PgBouncer
    # transaction-level pooling (disables pool_pre_ping, reduces pool_size).
    PGBOUNCER_ENABLED: bool = False

    # ── Backup ────────────────────────────────────────────────────────────────
    # AES-256-CBC passphrase for pgBackRest repository encryption.
    PGBACKREST_CIPHER_PASS: str = "change-me-in-production"

    # ── Security / Encryption ─────────────────────────────────────────────────
    # Symmetric key for column-level PII encryption (national IDs, bank details).
    # MUST be set in production. Dev default is intentionally weak.
    PG_ENCRYPTION_KEY: str = "dev-only-insecure-key-change-in-production"

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://redis:6379/0"      # db 0 — event bus pub/sub + rate limiter
    REDIS_PASSWORD: str = ""                      # leave blank for local dev; set in production

    # ── JWT ───────────────────────────────────────────────────────────────────
    SECRET_KEY: str  # REQUIRED — no default; set via .env or environment variable
    ALGORITHM: str = "HS256"                      # JWT signing algorithm (used by python-jose)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60         # short-lived access token lifetime (1 hour)
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30           # refresh token lifetime — user re-authenticates after this window

    # ── AI ──────────────────────────────────────────────────────────────────────
    # Any OpenAI-compatible provider works (OpenRouter, Together, Groq, Mistral,
    # vLLM, etc.). Set AI_BASE_URL to the provider's /v1 endpoint.
    # For Anthropic, set AI_PROVIDER="anthropic" — it uses the native SDK.
    AI_PROVIDER: str = "openai"                    # provider name — free-form string
    AI_API_KEY: str | None = None                  # unified API key for the active provider
    AI_BASE_URL: str | None = None                 # custom base URL (e.g. https://openrouter.ai/api/v1)
    AI_MODEL: str = "gpt-4o"                       # default model name

    # ── MinIO / Object Storage ────────────────────────────────────────────────
    # S3-compatible store for Drive files, email attachments, and report exports.
    # Bucket "urban-vibes-dynamics-files" is auto-created on first upload.
    MINIO_URL: str = "http://minio:9000"          # internal API endpoint (Docker service name)
    MINIO_EXTERNAL_URL: str = "http://localhost:9010"  # browser-reachable endpoint for presigned URLs
    MINIO_ACCESS_KEY: str = "minioadmin"           # root access key — override in production
    MINIO_SECRET_KEY: str = "minioadmin123"        # root secret key — override in production

    # ── First Super-Admin seed ────────────────────────────────────────────────
    # Credentials used to bootstrap the first Super Admin on initial DB seed.
    # Only applied when the users table is empty (see auth service).
    FIRST_SUPERADMIN_EMAIL: str = "edwin@youthandurbanism.org"
    FIRST_SUPERADMIN_PASSWORD: str = "super-admin@2026!"

    # ── ONLYOFFICE ────────────────────────────────────────────────────────────
    # Document editing engine — kept forever. Our React UI wraps the ONLYOFFICE
    # JS API for docs, spreadsheets, and presentations.
    ONLYOFFICE_URL: str = "http://onlyoffice:80"  # internal Docker network — backend→ONLYOFFICE calls
    ONLYOFFICE_PUBLIC_URL: str = "http://localhost:8083"  # browser-accessible URL for the JS editor SDK
    ONLYOFFICE_JWT_SECRET: str = "onlyoffice-jwt-secret-2026-urban-vibes-dynamics"  # shared secret for callback auth

    # Internal backend URL reachable by other containers (e.g. ONLYOFFICE callback)
    BACKEND_INTERNAL_URL: str = "http://backend:8000"  # used in ONLYOFFICE callbackUrl and webhook payloads

    # ── Jitsi ─────────────────────────────────────────────────────────────────
    # Video conferencing engine — kept forever. Our React UI wraps the Jitsi iframe API.
    JITSI_PUBLIC_URL: str = "http://localhost:8080"  # browser-accessible — Meetings module embeds this

    # ── Mail ─────────────────────────────────────────────────────────────────
    # Core mail identity settings used across the Mail module, notifications,
    # and transactional emails (password reset, invoice delivery, etc.).
    MAIL_DOMAIN: str = "youthandurbanism.org"           # domain for user mailboxes (user@this-domain)
    MAIL_ALLOWED_DOMAIN: str = "youthandurbanism.org"   # restrict outbound "From" to this domain
    SYSTEM_EMAIL: str = "noreply@youthandurbanism.org"  # sender address for automated/system emails

    # ── SMTP (outbound) ────────────────────────────────────────────────────
    # Configurable SMTP relay — defaults to Stalwart container; can point to
    # external providers (SendGrid, SES, etc.) by setting these vars.
    SMTP_HOST: str = ""               # SMTP server hostname — empty disables outbound mail
    SMTP_PORT: int = 25               # default SMTP port; use 587 for STARTTLS, 465 for implicit TLS
    SMTP_USER: str = ""               # SMTP auth username (optional for local relay)
    SMTP_PASSWORD: str = ""           # SMTP auth password
    SMTP_USE_TLS: bool = False        # enable STARTTLS — set True when using external providers

    # ── IMAP (inbound / sync) ──────────────────────────────────────────────
    # Used by the Mail module's background sync task to pull new messages
    # from the mailbox into PostgreSQL for search and UI display.
    IMAP_HOST: str = ""               # IMAP server hostname — typically the Stalwart container
    IMAP_PORT: int = 993              # IMAPS port (TLS); use 143 for plain IMAP
    IMAP_USER: str = ""               # IMAP auth username
    IMAP_PASSWORD: str = ""           # IMAP auth password
    IMAP_USE_SSL: bool = True         # use implicit TLS (port 993); False for STARTTLS on 143

    # ── DKIM / DNS ─────────────────────────────────────────────────────────
    # Path to the PEM-encoded DKIM private key used to sign outbound emails.
    # The corresponding public key must be published as a DNS TXT record.
    DKIM_PRIVATE_KEY_PATH: str = ""   # empty disables DKIM signing

    # ── Security ──────────────────────────────────────────────────────────────
    BACKUP_ENCRYPTION_KEY: str = ""   # AES key for encrypting database backups — generate with `openssl rand -hex 32`

    # ── CORS ──────────────────────────────────────────────────────────────────
    # Allowed origins for cross-origin requests from the frontend.
    # Both localhost:3000 (Vite default) and 3010 (Docker-mapped) are included.
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",       # Vite dev server default
        "http://localhost:3010",        # Docker-mapped frontend
        "http://127.0.0.1:3000",       # same as above, loopback variant
        "http://127.0.0.1:3010",
    ]

    # ── Celery ────────────────────────────────────────────────────────────────
    # Background task queue for async jobs: email delivery, report generation,
    # AI tool execution, and scheduled tasks (beat).
    CELERY_BROKER_URL: str = "redis://redis:6379/1"      # Redis db 1 — task messages
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"   # Redis db 2 — task result storage

    # ── E-Commerce ────────────────────────────────────────────────────────────
    # Tuning knobs for the E-Commerce module's automation workflows.
    ECOM_CART_ABANDONMENT_HOURS: int = 1                   # hours before a cart is considered abandoned (triggers recovery email)
    ECOM_PROJECT_TRIGGER_THRESHOLD: float = 50000.0        # KES threshold for auto-project creation on large orders
    ECOM_RECOVERY_DISCOUNT_PCT: float = 10.0               # discount percentage offered in cart-recovery emails
    ECOM_BASE_CURRENCY: str = "KES"                        # default currency for product pricing and order totals


@lru_cache
def get_settings() -> Settings:
    """Create and cache a Settings instance.

    The ``@lru_cache`` decorator ensures the ``.env`` file is parsed only
    once per process.  All subsequent calls return the same object.

    Returns:
        The singleton Settings instance with all env vars resolved.
    """
    return Settings()


# Module-level singleton — import this everywhere instead of calling get_settings()
settings = get_settings()
