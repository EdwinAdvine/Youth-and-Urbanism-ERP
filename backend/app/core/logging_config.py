"""Structured logging configuration for Urban ERP.

Uses structlog for structured logging with JSON output in production
and colored console output in development. Includes request-ID tracking
middleware for FastAPI.
"""

from __future__ import annotations

import logging
import sys
import uuid
from contextvars import ContextVar
from typing import Any

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings

# ── Context variable for request ID ──────────────────────────────────────────
request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)


# ── Custom structlog processors ──────────────────────────────────────────────
def add_request_id(
    logger: Any, method: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    """Inject the current request ID into every log entry."""
    rid = request_id_ctx.get()
    if rid is not None:
        event_dict["request_id"] = rid
    return event_dict


def add_app_info(
    logger: Any, method: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    """Add application name to every log entry."""
    event_dict["app"] = "urban-erp"
    return event_dict


# ── Setup function ───────────────────────────────────────────────────────────
def setup_logging() -> None:
    """Configure structlog and stdlib logging integration.

    Call this once at application startup, before any logging occurs.
    In DEBUG mode, logs are rendered as colored console output.
    In production, logs are rendered as JSON for machine consumption.
    """

    # Shared processors used by both structlog and stdlib integration
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        add_request_id,
        add_app_info,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if settings.DEBUG:
        # Development: colored console output
        renderer: structlog.types.Processor = structlog.dev.ConsoleRenderer(
            colors=True,
        )
    else:
        # Production: JSON output
        shared_processors.append(
            structlog.processors.format_exc_info,
        )
        renderer = structlog.processors.JSONRenderer()

    # Configure structlog
    structlog.configure(
        processors=[
            *shared_processors,
            # Prepare for stdlib's ProcessorFormatter
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Build the formatter that stdlib handlers will use
    formatter = structlog.stdlib.ProcessorFormatter(
        # The final processor that renders output
        processor=renderer,
        # Processors that run on records coming from stdlib logging
        foreign_pre_chain=shared_processors,
    )

    # Replace all existing handlers on the root logger
    root_logger = logging.getLogger()
    root_logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)

    # Set log level
    root_logger.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)

    # Quiet down noisy third-party loggers
    for noisy in ("uvicorn.access", "uvicorn.error", "sqlalchemy.engine", "httpcore", "httpx"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    # Allow uvicorn to propagate through our formatter
    logging.getLogger("uvicorn").handlers.clear()
    logging.getLogger("uvicorn.access").handlers.clear()
    logging.getLogger("uvicorn.error").handlers.clear()


# ── Request ID Middleware ─────────────────────────────────────────────────────
class RequestIDMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware that assigns a unique request ID to every request.

    The request ID is:
    - Read from the incoming ``X-Request-ID`` header if present, or generated.
    - Stored in a context variable so structlog can include it automatically.
    - Returned in the ``X-Request-ID`` response header for client correlation.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Accept an existing request ID from upstream (e.g., load balancer)
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex
        token = request_id_ctx.set(rid)
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = rid
            return response
        finally:
            request_id_ctx.reset(token)
