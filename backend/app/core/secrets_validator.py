"""Startup validator that rejects default dev secrets in production mode."""
from __future__ import annotations

import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# Default development values that MUST be changed in production
_DEFAULT_SECRETS: dict[str, list[str]] = {
    "SECRET_KEY": [
        "urban-vibes-dynamics-super-secret-key-change-in-production-2026",
        "change-me-in-production-use-openssl-rand-hex-32",
    ],
    "MINIO_SECRET_KEY": ["minioadmin123", "minioadmin"],
    "ONLYOFFICE_JWT_SECRET": ["onlyoffice-jwt-secret-2026-urban-vibes-dynamics"],
    "FIRST_SUPERADMIN_PASSWORD": ["super-admin@2026!"],
}


def validate_production_secrets() -> None:
    """Check that no default dev secrets are used when DEBUG=False.

    In DEBUG mode, logs warnings. In production, raises SystemExit.
    """
    violations: list[str] = []

    for attr, defaults in _DEFAULT_SECRETS.items():
        value = getattr(settings, attr, None)
        if value and value in defaults:
            violations.append(attr)

    # Also check the database password embedded in DATABASE_URL
    if "urban_secret" in settings.DATABASE_URL:
        violations.append("POSTGRES_PASSWORD (in DATABASE_URL)")

    if not violations:
        logger.info("Secrets validation passed.")
        return

    msg_lines = [
        "The following secrets still use default development values:",
        *(f"  - {name}" for name in violations),
        "",
        "Generate secure values with:  openssl rand -hex 32",
    ]
    full_msg = "\n".join(msg_lines)

    if settings.DEBUG:
        logger.warning("⚠ DEV MODE — %s", full_msg)
    else:
        logger.critical("🛑 PRODUCTION SECRET VIOLATION\n%s", full_msg)
        raise SystemExit(
            "Refusing to start: default secrets detected in production mode. "
            "Set DEBUG=true for development or change the secrets listed above."
        )
