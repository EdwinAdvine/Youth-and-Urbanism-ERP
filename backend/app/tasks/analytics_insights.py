"""
Analytics Proactive Insights — Celery task that runs nightly to scan all
KPIs for anomalies, trend reversals, and cross-module correlations.
Creates AnalyticsInsight records for significant findings.
"""
from __future__ import annotations

import asyncio
import concurrent.futures
import logging
from datetime import datetime
from typing import Any

from celery import shared_task

logger = logging.getLogger(__name__)


# ── Async implementation ───────────────────────────────────────────────────────

async def _run_insights_async() -> dict[str, Any]:
    from sqlalchemy import text

    from app.core.database import AsyncSessionLocal
    from app.models.analytics import AnalyticsInsight
    from app.services.analytics_anomaly import detect_anomalies
    from app.services.analytics_forecast import detect_trend

    insights_created = 0
    errors: list[dict[str, str]] = []

    # KPI queries to scan — each entry is one time-series scan
    KPI_SCANS = [
        {
            "name": "Monthly Revenue",
            "module": "finance",
            "query": """
                SELECT DATE_TRUNC('month', issue_date) AS period,
                       SUM(total_amount) AS value
                FROM invoices
                WHERE status = 'paid'
                  AND issue_date >= NOW() - INTERVAL '12 months'
                GROUP BY DATE_TRUNC('month', issue_date)
                ORDER BY period
            """,
            "value_key": "value",
        },
        {
            "name": "Monthly Active Deals",
            "module": "crm",
            "query": """
                SELECT DATE_TRUNC('month', created_at) AS period,
                       COUNT(*) AS value
                FROM deals
                WHERE created_at >= NOW() - INTERVAL '12 months'
                GROUP BY DATE_TRUNC('month', created_at)
                ORDER BY period
            """,
            "value_key": "value",
        },
        {
            "name": "Monthly Support Tickets",
            "module": "support",
            "query": """
                SELECT DATE_TRUNC('month', created_at) AS period,
                       COUNT(*) AS value
                FROM support_tickets
                WHERE created_at >= NOW() - INTERVAL '12 months'
                GROUP BY DATE_TRUNC('month', created_at)
                ORDER BY period
            """,
            "value_key": "value",
        },
    ]

    async with AsyncSessionLocal() as db:
        for scan in KPI_SCANS:
            try:
                result = await db.execute(text(scan["query"]))
                rows = [dict(r) for r in result.mappings().all()]

                # Need at least 3 data points for meaningful statistics
                if len(rows) < 3:
                    continue

                # Normalise: convert period timestamps to ISO strings and
                # cast value to float so both services receive clean dicts.
                data: list[dict[str, Any]] = []
                for r in rows:
                    row_dict = dict(r)
                    period = row_dict.get("period")
                    if hasattr(period, "isoformat"):
                        row_dict["period"] = period.isoformat()
                    row_dict[scan["value_key"]] = float(
                        row_dict.get(scan["value_key"]) or 0
                    )
                    data.append(row_dict)

                # ── Anomaly detection ──────────────────────────────────────
                annotated = detect_anomalies(data, scan["value_key"], threshold=2.0)
                anomaly_points = [d for d in annotated if d.get("_is_anomaly")]

                if anomaly_points:
                    insight = AnalyticsInsight(
                        title=f"Anomaly detected in {scan['name']}",
                        description=(
                            f"{len(anomaly_points)} anomalous data point(s) detected in "
                            f"{scan['name']} over the last 12 months. "
                            f"Latest anomaly: {anomaly_points[-1].get(scan['value_key'])}"
                        ),
                        insight_type="anomaly",
                        module=scan["module"],
                        severity="warning" if len(anomaly_points) == 1 else "critical",
                        data={"anomaly_points": anomaly_points, "scan": scan["name"]},
                        is_dismissed=False,
                    )
                    db.add(insight)
                    insights_created += 1

                # ── Trend detection ────────────────────────────────────────
                trend = detect_trend(data, scan["value_key"])
                if abs(trend.get("pct_change_total", 0)) > 20:
                    direction = trend.get("direction", "unknown")
                    pct = round(trend.get("pct_change_total", 0), 1)
                    severity = "info" if direction == "up" else "warning"
                    insight = AnalyticsInsight(
                        title=f"{scan['name']} trending {direction}",
                        description=(
                            f"{scan['name']} shows a {direction}ward trend of {pct}% "
                            f"over the last 12 months "
                            f"(R\u00b2={round(trend.get('r_squared', 0), 2)})."
                        ),
                        insight_type="trend_change",
                        module=scan["module"],
                        severity=severity,
                        data={"trend": trend, "scan": scan["name"]},
                        is_dismissed=False,
                    )
                    db.add(insight)
                    insights_created += 1

            except Exception as exc:
                errors.append({"scan": scan["name"], "error": str(exc)})
                logger.warning("Insights scan failed for %s: %s", scan["name"], exc)
                continue

        if insights_created > 0:
            await db.commit()

    return {
        "insights_created": insights_created,
        "scans_run": len(KPI_SCANS),
        "errors": errors,
        "timestamp": datetime.now().isoformat(),
    }


# ── Celery task (sync wrapper) ────────────────────────────────────────────────

@shared_task(bind=True, name="analytics.proactive_insights")
def run_proactive_insights(self) -> dict[str, Any]:
    """Nightly scan: detect anomalies and trends in ERP metrics, create insight records."""
    try:
        return asyncio.run(_run_insights_async())
    except RuntimeError:
        # asyncio.run() raises RuntimeError when an event loop is already running
        # (e.g. in some test environments). Fall back to a dedicated thread.
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(asyncio.run, _run_insights_async())
            return future.result()
