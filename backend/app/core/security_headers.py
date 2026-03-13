"""Security headers middleware for FastAPI."""
from __future__ import annotations

from app.core.config import settings
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


def _build_csp() -> str:
    """Build CSP header with dynamic ONLYOFFICE/Jitsi frame sources."""
    onlyoffice_url = settings.ONLYOFFICE_PUBLIC_URL
    jitsi_url = settings.JITSI_PUBLIC_URL
    return (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' data: https://fonts.gstatic.com; "
        "img-src 'self' data: blob:; "
        "connect-src 'self' ws: wss:; "
        f"frame-src 'self' {onlyoffice_url} {jitsi_url}; "
        "object-src 'none'; "
        "base-uri 'self'"
    )


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to every response."""

    def __init__(self, app, **kwargs):
        super().__init__(app, **kwargs)
        self._csp = _build_csp()

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(self), geolocation=()"
        response.headers["Content-Security-Policy"] = self._csp
        # HSTS only in production (when not DEBUG)
        if not request.app.debug:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response
