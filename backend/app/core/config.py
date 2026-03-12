from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────────────────
    APP_NAME: str = "Urban ERP"
    APP_URL: str = "http://localhost:3010"
    DEBUG: bool = False

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://urban:urban_secret@postgres:5432/urban_erp"

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://redis:6379/0"

    # ── JWT ───────────────────────────────────────────────────────────────────
    SECRET_KEY: str = "urban-erp-super-secret-key-change-in-production-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── AI / Ollama ───────────────────────────────────────────────────────────
    OLLAMA_URL: str = "http://ollama:11434"
    OLLAMA_MODEL: str = "llama3.2"
    AI_PROVIDER: Literal["ollama", "openai", "grok", "anthropic"] = "ollama"

    OPENAI_API_KEY: str | None = None
    GROK_API_KEY: str | None = None
    ANTHROPIC_API_KEY: str | None = None

    # ── MinIO / Object Storage ────────────────────────────────────────────────
    MINIO_URL: str = "http://minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin123"

    # ── First Super-Admin seed ────────────────────────────────────────────────
    FIRST_SUPERADMIN_EMAIL: str = "super-admin@youthandurbanism.org"
    FIRST_SUPERADMIN_PASSWORD: str = "super-admin@2026!"

    # ── ONLYOFFICE ────────────────────────────────────────────────────────────
    ONLYOFFICE_URL: str = "http://onlyoffice:80"  # internal Docker network
    ONLYOFFICE_PUBLIC_URL: str = "http://localhost:8083"  # browser-accessible
    ONLYOFFICE_JWT_SECRET: str = "onlyoffice-jwt-secret-2026-urban-erp"

    # Internal backend URL reachable by other containers (e.g. ONLYOFFICE callback)
    BACKEND_INTERNAL_URL: str = "http://backend:8000"

    # ── Jitsi ─────────────────────────────────────────────────────────────────
    JITSI_PUBLIC_URL: str = "http://localhost:8080"

    # ── Mail ─────────────────────────────────────────────────────────────────
    MAIL_DOMAIN: str = "youthandurbanism.org"
    SYSTEM_EMAIL: str = "noreply@youthandurbanism.org"

    # ── SMTP (outbound) ────────────────────────────────────────────────────
    SMTP_HOST: str = ""
    SMTP_PORT: int = 25
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = False

    # ── IMAP (inbound / sync) ──────────────────────────────────────────────
    IMAP_HOST: str = ""
    IMAP_PORT: int = 993
    IMAP_USER: str = ""
    IMAP_PASSWORD: str = ""
    IMAP_USE_SSL: bool = True

    # ── DKIM / DNS ─────────────────────────────────────────────────────────
    DKIM_PRIVATE_KEY_PATH: str = ""

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:3010",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3010",
        "http://0.0.0.0:3000",
    ]

    # ── Celery ────────────────────────────────────────────────────────────────
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # ── E-Commerce ────────────────────────────────────────────────────────────
    ECOM_CART_ABANDONMENT_HOURS: int = 1
    ECOM_PROJECT_TRIGGER_THRESHOLD: float = 50000.0  # KES threshold for auto-project creation
    ECOM_RECOVERY_DISCOUNT_PCT: float = 10.0
    ECOM_BASE_CURRENCY: str = "KES"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
