"""Prometheus metrics for pgBackRest backup monitoring.

Exposes three Gauge metrics that are updated by the Celery backup tasks:

    urban_vibes_dynamics_backup_age_seconds    — seconds since last successful backup
    urban_vibes_dynamics_backup_last_status    — 1=ok, 0=failed
    urban_vibes_dynamics_wal_archive_lag_bytes — WAL archiving lag in bytes (approximate)

These metrics are scraped by Prometheus and displayed on the
"Backup Status" Grafana dashboard. Alerts are fired via Alertmanager
when backup_age_seconds > 86400 (24h) or last_status == 0.

Usage:
    from app.core.backup_metrics import (
        record_backup_success,
        record_backup_failure,
        update_wal_lag,
    )

    # After a successful backup:
    record_backup_success(backup_type="full", size_bytes=1_000_000)

    # After a failed backup:
    record_backup_failure(backup_type="diff")
"""

from __future__ import annotations

import logging
import time

logger = logging.getLogger(__name__)

# ── Prometheus metrics (lazy-initialized) ────────────────────────────────────
# We use lazy initialization to avoid import errors when prometheus_client is
# not installed (single-node dev mode without monitoring stack).

_backup_age_gauge = None
_backup_status_gauge = None
_wal_lag_gauge = None
_last_backup_time: dict[str, float] = {}  # backup_type → unix timestamp


def _get_metrics():
    """Lazily initialize Prometheus Gauge objects."""
    global _backup_age_gauge, _backup_status_gauge, _wal_lag_gauge
    if _backup_age_gauge is not None:
        return _backup_age_gauge, _backup_status_gauge, _wal_lag_gauge
    try:
        from prometheus_client import Gauge  # noqa: PLC0415
        _backup_age_gauge = Gauge(
            "urban_vibes_dynamics_backup_age_seconds",
            "Seconds since the last successful backup",
            ["backup_type"],
        )
        _backup_status_gauge = Gauge(
            "urban_vibes_dynamics_backup_last_status",
            "Status of the last backup run: 1=success, 0=failure",
            ["backup_type"],
        )
        _wal_lag_gauge = Gauge(
            "urban_vibes_dynamics_wal_archive_lag_bytes",
            "Approximate WAL archiving lag in bytes",
        )
    except ImportError:
        logger.debug("prometheus_client not installed — backup metrics disabled")
    return _backup_age_gauge, _backup_status_gauge, _wal_lag_gauge


def record_backup_success(*, backup_type: str = "full", size_bytes: int = 0) -> None:
    """Record a successful backup completion.

    Args:
        backup_type: "full" or "diff"
        size_bytes:  Compressed backup size in bytes (from pgBackRest info)
    """
    age_gauge, status_gauge, _ = _get_metrics()
    _last_backup_time[backup_type] = time.time()
    if status_gauge:
        status_gauge.labels(backup_type=backup_type).set(1)
    logger.info("Backup metrics: %s backup succeeded (%d bytes)", backup_type, size_bytes)


def record_backup_failure(*, backup_type: str = "full") -> None:
    """Record a failed backup run.

    Args:
        backup_type: "full" or "diff"
    """
    _, status_gauge, _ = _get_metrics()
    if status_gauge:
        status_gauge.labels(backup_type=backup_type).set(0)
    logger.warning("Backup metrics: %s backup FAILED", backup_type)


def update_wal_lag(lag_bytes: int) -> None:
    """Update the WAL archiving lag gauge.

    Args:
        lag_bytes: Approximate unarchived WAL bytes (from pg_stat_archiver)
    """
    _, _, wal_gauge = _get_metrics()
    if wal_gauge:
        wal_gauge.set(lag_bytes)


def refresh_backup_age() -> None:
    """Update the backup age gauges based on last recorded backup times.

    Call this periodically (e.g., from a Celery beat task) to keep the
    age gauge current even when no backup has run recently.
    """
    age_gauge, _, _ = _get_metrics()
    if not age_gauge:
        return
    now = time.time()
    for btype, ts in _last_backup_time.items():
        age_gauge.labels(backup_type=btype).set(now - ts)
