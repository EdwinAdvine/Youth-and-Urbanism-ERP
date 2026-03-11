"""Custom Superset configuration for Urban ERP embedding."""
import os

# Allow iframe embedding from any origin (required for Urban ERP dashboard)
FEATURE_FLAGS = {
    "EMBEDDED_SUPERSET": True,
    "EMBEDDABLE_CHARTS": True,
}

# Remove X-Frame-Options restriction so Superset can be embedded
HTTP_HEADERS = {
    "X-Frame-Options": "ALLOWALL",
}

# Enable CORS for guest token API
ENABLE_CORS = True
CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": ["*"],
    "resources": ["*"],
    "origins": [
        os.environ.get("APP_URL", "http://localhost:3010"),
        "http://localhost:3010",
        "http://localhost:8010",
    ],
}

# Use the shared Postgres database
SQLALCHEMY_DATABASE_URI = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg2://urban:urban_secret@postgres:5432/superset",
)

# Guest token configuration
GUEST_ROLE_NAME = "Public"
GUEST_TOKEN_JWT_SECRET = os.environ.get(
    "SUPERSET_SECRET_KEY", "superset-secret-key-2026-urban-erp"
)
GUEST_TOKEN_JWT_EXP_SECONDS = 3600

# Talisman (security middleware) — disable frame protection
TALISMAN_ENABLED = False
