"""
AnomalyDetector service — detects statistical outliers in time-series data
using z-score analysis and returns annotated data with anomaly flags.

No external dependencies — uses only Python stdlib (statistics, math).
"""
from __future__ import annotations

import math
import logging
import statistics
from typing import Any

logger = logging.getLogger(__name__)


# ── Core detection ────────────────────────────────────────────────────────────

def detect_anomalies(
    data: list[dict],
    value_key: str,
    threshold: float = 2.0,
) -> list[dict]:
    """Compute z-scores for value_key and flag outliers.

    Each returned dict is a shallow copy of the original with two extra keys:
      _is_anomaly (bool)  — True when |z_score| >= threshold
      _z_score    (float) — signed z-score for the point

    Edge cases:
      - Empty list → returns []
      - All-same values (std == 0) → no anomalies, all z-scores are 0.0
    """
    if not data:
        return []

    values: list[float] = []
    for item in data:
        raw = item.get(value_key, 0)
        try:
            values.append(float(raw) if raw is not None else 0.0)
        except (TypeError, ValueError):
            values.append(0.0)

    mean = statistics.mean(values)

    # Population stdev — fall back to 0 for single-element lists
    try:
        std = statistics.pstdev(values)
    except statistics.StatisticsError:
        std = 0.0

    annotated: list[dict] = []
    for item, val in zip(data, values):
        z = (val - mean) / std if std > 0 else 0.0
        copy = dict(item)
        copy["_z_score"] = round(z, 6)
        copy["_is_anomaly"] = abs(z) >= threshold
        annotated.append(copy)

    return annotated


def annotate_series(
    data: list[dict],
    value_keys: list[str],
    threshold: float = 2.0,
) -> dict[str, Any]:
    """Run anomaly detection across multiple value columns in one pass.

    Returns:
        {
            "annotated":      list[dict]  — original rows with _is_anomaly/<key> and
                                            _z_score/<key> added for every key,
            "anomaly_points": list[dict]  — flat list of every flagged point with
                                            {"key", "index", "value", "z_score"}
        }
    """
    if not data:
        return {"annotated": [], "anomaly_points": []}

    # Start with a deep-enough copy (one level)
    working: list[dict] = [dict(row) for row in data]
    anomaly_points: list[dict] = []

    for key in value_keys:
        per_key = detect_anomalies(data, key, threshold)
        for idx, (row, annotated_row) in enumerate(zip(working, per_key)):
            row[f"_z_score_{key}"] = annotated_row["_z_score"]
            row[f"_is_anomaly_{key}"] = annotated_row["_is_anomaly"]
            if annotated_row["_is_anomaly"]:
                raw = data[idx].get(key, 0)
                try:
                    val = float(raw) if raw is not None else 0.0
                except (TypeError, ValueError):
                    val = 0.0
                anomaly_points.append(
                    {
                        "key": key,
                        "index": idx,
                        "value": val,
                        "z_score": annotated_row["_z_score"],
                    }
                )

    return {"annotated": working, "anomaly_points": anomaly_points}


def compute_stats(data: list[dict], value_key: str) -> dict[str, Any]:
    """Return descriptive statistics + anomaly count (threshold=2.0) for a column.

    Returns:
        {
            "mean": float, "std": float,
            "min": float,  "max": float,
            "q1": float,   "q3": float, "iqr": float,
            "anomaly_count": int
        }
    """
    if not data:
        return {
            "mean": 0.0, "std": 0.0,
            "min": 0.0,  "max": 0.0,
            "q1": 0.0,   "q3": 0.0, "iqr": 0.0,
            "anomaly_count": 0,
        }

    values: list[float] = []
    for item in data:
        raw = item.get(value_key, 0)
        try:
            values.append(float(raw) if raw is not None else 0.0)
        except (TypeError, ValueError):
            values.append(0.0)

    sorted_vals = sorted(values)
    n = len(sorted_vals)

    mean = statistics.mean(values)
    try:
        std = statistics.pstdev(values)
    except statistics.StatisticsError:
        std = 0.0

    # Quartiles via linear interpolation
    def _quantile(sorted_data: list[float], p: float) -> float:
        if len(sorted_data) == 1:
            return sorted_data[0]
        idx = p * (len(sorted_data) - 1)
        lo = int(math.floor(idx))
        hi = int(math.ceil(idx))
        frac = idx - lo
        return sorted_data[lo] * (1 - frac) + sorted_data[hi] * frac

    q1 = _quantile(sorted_vals, 0.25)
    q3 = _quantile(sorted_vals, 0.75)
    iqr = q3 - q1

    anomaly_count = sum(
        1 for row in detect_anomalies(data, value_key, threshold=2.0)
        if row["_is_anomaly"]
    )

    return {
        "mean": round(mean, 6),
        "std": round(std, 6),
        "min": sorted_vals[0],
        "max": sorted_vals[-1],
        "q1": round(q1, 6),
        "q3": round(q3, 6),
        "iqr": round(iqr, 6),
        "anomaly_count": anomaly_count,
    }
