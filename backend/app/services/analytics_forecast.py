"""
TrendForecaster service — generates short-term forecasts for ERP time-series data.
Uses manual linear regression (least-squares) + additive seasonal decomposition.

No external dependencies — pure Python stdlib only.
"""
from __future__ import annotations

import math
import logging
import statistics
from typing import Any

logger = logging.getLogger(__name__)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _extract_values(data: list[dict], value_key: str) -> list[float]:
    """Pull numeric values from dicts, coercing missing/None to 0.0."""
    result: list[float] = []
    for item in data:
        raw = item.get(value_key, 0)
        try:
            result.append(float(raw) if raw is not None else 0.0)
        except (TypeError, ValueError):
            result.append(0.0)
    return result


def _linear_regression(values: list[float]) -> tuple[float, float]:
    """Return (slope, intercept) from ordinary least squares.

    x indices are 0, 1, ..., n-1.
    """
    n = len(values)
    if n == 0:
        return 0.0, 0.0
    if n == 1:
        return 0.0, values[0]

    x_mean = (n - 1) / 2.0
    y_mean = statistics.mean(values)

    ss_xx = sum((i - x_mean) ** 2 for i in range(n))
    ss_xy = sum((i - x_mean) * (values[i] - y_mean) for i in range(n))

    slope = ss_xy / ss_xx if ss_xx != 0 else 0.0
    intercept = y_mean - slope * x_mean
    return slope, intercept


def _r_squared(values: list[float], slope: float, intercept: float) -> float:
    """Coefficient of determination for a linear fit."""
    n = len(values)
    if n < 2:
        return 0.0
    y_mean = statistics.mean(values)
    ss_tot = sum((v - y_mean) ** 2 for v in values)
    if ss_tot == 0:
        return 1.0
    ss_res = sum((values[i] - (slope * i + intercept)) ** 2 for i in range(n))
    return max(0.0, 1.0 - ss_res / ss_tot)


def _residual_std(values: list[float], slope: float, intercept: float) -> float:
    """Standard deviation of residuals from the linear fit."""
    n = len(values)
    if n < 2:
        return 0.0
    residuals = [values[i] - (slope * i + intercept) for i in range(n)]
    try:
        return statistics.pstdev(residuals)
    except statistics.StatisticsError:
        return 0.0


# ── Public API ────────────────────────────────────────────────────────────────

def forecast_linear(
    data: list[dict],
    value_key: str,
    periods: int = 3,
) -> list[dict]:
    """Append `periods` forecast points using manual least-squares linear regression.

    Each forecast dict:
        {
            "period":      "Forecast +N",
            "value":       float,
            "lower":       float,   # value - 1.96 * residual_std
            "upper":       float,   # value + 1.96 * residual_std
            "is_forecast": True
        }

    Original rows are returned unchanged (without is_forecast key) followed
    by the forecast points.
    """
    values = _extract_values(data, value_key)
    n = len(values)

    slope, intercept = _linear_regression(values)
    res_std = _residual_std(values, slope, intercept)
    margin = 1.96 * res_std

    # Return original rows first
    result: list[dict] = [dict(row) for row in data]

    for i in range(1, periods + 1):
        x = n - 1 + i
        predicted = slope * x + intercept
        result.append(
            {
                "period": f"Forecast +{i}",
                "value": round(predicted, 4),
                "lower": round(predicted - margin, 4),
                "upper": round(predicted + margin, 4),
                "is_forecast": True,
            }
        )

    return result


def forecast_seasonal(
    data: list[dict],
    value_key: str,
    period_length: int = 12,
    periods: int = 3,
) -> list[dict]:
    """Additive seasonal decomposition + linear trend forecast.

    Requires len(data) >= 2 * period_length; otherwise falls back to
    forecast_linear.

    Steps:
      1. Compute a centred moving average to isolate trend.
      2. Subtract trend to get seasonal + residual.
      3. Average by season position to get seasonal indices.
      4. Fit linear regression on de-seasonalised trend values.
      5. Forecast: trend(x) + seasonal_index(x % period_length).
    """
    values = _extract_values(data, value_key)
    n = len(values)

    if n < 2 * period_length:
        logger.debug(
            "forecast_seasonal: insufficient data (%d < %d), falling back to linear",
            n, 2 * period_length,
        )
        return forecast_linear(data, value_key, periods)

    # --- 1. Centred moving average (trend) ---
    half = period_length // 2
    trend: list[float | None] = [None] * n
    for i in range(half, n - half):
        trend[i] = statistics.mean(values[i - half: i + half + 1])

    # --- 2. De-trend ---
    seasonal_residuals: list[list[float]] = [[] for _ in range(period_length)]
    for i, t in enumerate(trend):
        if t is not None and t != 0:
            seasonal_residuals[i % period_length].append(values[i] - t)

    # --- 3. Seasonal indices ---
    seasonal_indices: list[float] = []
    for s in seasonal_residuals:
        seasonal_indices.append(statistics.mean(s) if s else 0.0)

    # Normalise so indices sum to 0
    idx_mean = statistics.mean(seasonal_indices)
    seasonal_indices = [s - idx_mean for s in seasonal_indices]

    # --- 4. De-seasonalised values for regression ---
    deseasonalised = [values[i] - seasonal_indices[i % period_length] for i in range(n)]
    slope, intercept = _linear_regression(deseasonalised)

    # Residual std on original values
    reconstructed = [
        slope * i + intercept + seasonal_indices[i % period_length] for i in range(n)
    ]
    residuals = [values[i] - reconstructed[i] for i in range(n)]
    try:
        res_std = statistics.pstdev(residuals)
    except statistics.StatisticsError:
        res_std = 0.0
    margin = 1.96 * res_std

    # --- 5. Forecast ---
    result: list[dict] = [dict(row) for row in data]
    for i in range(1, periods + 1):
        x = n - 1 + i
        s_idx = seasonal_indices[x % period_length]
        predicted = slope * x + intercept + s_idx
        result.append(
            {
                "period": f"Forecast +{i}",
                "value": round(predicted, 4),
                "lower": round(predicted - margin, 4),
                "upper": round(predicted + margin, 4),
                "is_forecast": True,
            }
        )

    return result


def detect_trend(data: list[dict], value_key: str) -> dict[str, Any]:
    """Characterise the direction and strength of a time series trend.

    Returns:
        {
            "direction":        "up" | "down" | "flat",
            "slope":            float,
            "r_squared":        float,
            "pct_change_total": float   # (last - first) / first * 100
        }

    "flat" when abs(slope) < 0.01 * mean(values) or mean == 0.
    """
    values = _extract_values(data, value_key)
    n = len(values)

    if n == 0:
        return {"direction": "flat", "slope": 0.0, "r_squared": 0.0, "pct_change_total": 0.0}

    slope, intercept = _linear_regression(values)
    r2 = _r_squared(values, slope, intercept)

    mean_val = statistics.mean(values) if values else 0.0
    flat_threshold = 0.01 * abs(mean_val) if mean_val != 0 else 0.0

    if abs(slope) < flat_threshold or mean_val == 0:
        direction = "flat"
    elif slope > 0:
        direction = "up"
    else:
        direction = "down"

    # Total % change first → last (avoid division by zero)
    first = values[0]
    last = values[-1]
    if first != 0:
        pct_change_total = round((last - first) / abs(first) * 100, 4)
    else:
        pct_change_total = 0.0

    return {
        "direction": direction,
        "slope": round(slope, 6),
        "r_squared": round(r2, 6),
        "pct_change_total": pct_change_total,
    }
