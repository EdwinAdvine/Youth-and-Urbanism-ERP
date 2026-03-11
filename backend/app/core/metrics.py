"""Prometheus metrics instrumentation for Urban ERP FastAPI application."""

from __future__ import annotations

from prometheus_fastapi_instrumentator import Instrumentator


def instrument_app(app):
    """
    Attach Prometheus metrics to a FastAPI application.

    Tracks:
    - Request count per method/endpoint/status
    - Latency histograms per endpoint
    - In-progress requests gauge

    Exposes metrics at GET /metrics.
    """
    instrumentator = Instrumentator(
        should_group_status_codes=False,
        should_ignore_untemplated=True,
        should_respect_env_var=False,
        excluded_handlers=["/health", "/metrics"],
        env_var_name="ENABLE_METRICS",
        inprogress_name="urban_erp_inprogress_requests",
        inprogress_labels=True,
    )

    instrumentator.add(
        # Default metrics: request count, latency histogram, requests in progress
    )

    instrumentator.instrument(app).expose(
        app,
        endpoint="/metrics",
        include_in_schema=False,
        tags=["monitoring"],
    )
