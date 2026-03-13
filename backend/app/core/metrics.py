"""Prometheus metrics instrumentation for Urban Vibes Dynamics FastAPI application.

Wraps ``prometheus-fastapi-instrumentator`` to expose request-level metrics
at ``GET /metrics`` in Prometheus exposition format.  Health and metrics
endpoints are excluded from instrumentation to avoid recursive noise.

Usage:
    from app.core.metrics import instrument_app

    # During FastAPI app initialization (main.py):
    instrument_app(app)

    # Then scrape http://localhost:8010/metrics with Prometheus or
    # any compatible monitoring stack (Grafana Agent, VictoriaMetrics, etc.).

Metrics exposed:
    - ``http_requests_total``              — counter per method/endpoint/status
    - ``http_request_duration_seconds``    — histogram per endpoint
    - ``urban_vibes_dynamics_inprogress_requests``    — gauge of in-flight requests

Depends on:
    - ``prometheus-fastapi-instrumentator`` (pip)
    - Called from ``app/main.py`` at startup
"""

from __future__ import annotations

from prometheus_fastapi_instrumentator import Instrumentator


def instrument_app(app) -> None:
    """Attach Prometheus metrics middleware to a FastAPI application instance.

    Configures the instrumentator with sensible defaults for Urban Vibes Dynamics:

    * ``should_group_status_codes=False`` — record exact HTTP status codes
      (e.g. 201, 204) instead of grouping into 2xx/4xx/5xx buckets.
    * ``should_ignore_untemplated=True`` — ignore requests to paths that do
      not match any registered route (prevents metric cardinality explosion).
    * ``excluded_handlers`` — ``/health`` and ``/metrics`` are excluded so
      liveness probes and Prometheus scrapes do not inflate request counts.
    * ``inprogress_name`` — custom gauge name prefixed with ``urban_vibes_dynamics_``
      for easy identification in multi-service dashboards.

    Args:
        app: The FastAPI application instance to instrument.
    """
    instrumentator = Instrumentator(
        should_group_status_codes=False,
        should_ignore_untemplated=True,
        should_respect_env_var=False,
        excluded_handlers=["/health", "/metrics"],
        env_var_name="ENABLE_METRICS",
        inprogress_name="urban_vibes_dynamics_inprogress_requests",
        inprogress_labels=True,
    )

    instrumentator.add(
        # Default metrics: request count, latency histogram, requests in progress
    )

    # Attach ASGI middleware and expose the /metrics endpoint
    instrumentator.instrument(app).expose(
        app,
        endpoint="/metrics",
        include_in_schema=False,  # Hide from OpenAPI docs — internal only
        tags=["monitoring"],
    )
