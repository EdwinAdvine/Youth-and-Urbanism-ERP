"""HR Burnout Detection — identifies burnout risk patterns via Ollama."""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


BURNOUT_PROMPT = """You are an expert occupational health AI specializing in employee burnout detection.

Analyze the following employee data for burnout risk indicators and patterns.

EMPLOYEE DATA:
Name: {name}
Overtime Hours (last 30 days): {overtime_hours_30d}
Overtime Hours (last 60 days): {overtime_hours_60d}
Leave Days Taken (last 90 days): {leave_days_taken_90d}
Leave Balance Remaining: {leave_balance_remaining} days
Consecutive Work Days (current streak): {consecutive_work_days}
Recent Survey Sentiment: {recent_survey_sentiment}
Recent Feedback Submissions: {recent_feedback_count}
Recent 1-on-1 Meetings: {recent_1on1_count}
Days Since Last Manager Check-in: {manager_check_in_days_ago}

Analyze the burnout risk and return a JSON object with EXACTLY these fields:
{{
  "risk_score": <integer 0-100, overall burnout risk>,
  "risk_level": "<one of: low, moderate, high, severe>",
  "factors": {{
    "overwork_score": <integer 0-100>,
    "leave_avoidance_score": <integer 0-100>,
    "isolation_score": <integer 0-100>,
    "sentiment_score": <integer 0-100, higher = worse sentiment / more burnout risk>
  }},
  "warning_signs": [<list of specific observations based on the data>],
  "recommendations": [<list of interventions — mix of manager actions and HR actions>],
  "immediate_action_required": <true if risk_score >= 75, else false>
}}

Only return the JSON object, no other text."""


async def calculate_burnout_risk(employee_data: dict[str, Any]) -> dict[str, Any]:
    """Assess employee burnout risk using Ollama.

    Args:
        employee_data: Keys: employee_id, name, overtime_hours_30d, overtime_hours_60d,
            leave_days_taken_90d, leave_balance_remaining, consecutive_work_days,
            recent_survey_sentiment (None if none), recent_feedback_count,
            recent_1on1_count, manager_check_in_days_ago.

    Returns:
        dict with risk_score, risk_level, factors, warning_signs, recommendations,
        immediate_action_required.
    """
    prompt = BURNOUT_PROMPT.format(
        name=employee_data.get("name", "Unknown"),
        overtime_hours_30d=employee_data.get("overtime_hours_30d", 0),
        overtime_hours_60d=employee_data.get("overtime_hours_60d", 0),
        leave_days_taken_90d=employee_data.get("leave_days_taken_90d", 0),
        leave_balance_remaining=employee_data.get("leave_balance_remaining", 0),
        consecutive_work_days=employee_data.get("consecutive_work_days", 0),
        recent_survey_sentiment=employee_data.get("recent_survey_sentiment") or "No recent survey data",
        recent_feedback_count=employee_data.get("recent_feedback_count", 0),
        recent_1on1_count=employee_data.get("recent_1on1_count", 0),
        manager_check_in_days_ago=employee_data.get("manager_check_in_days_ago", 0),
    )

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.OLLAMA_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1},
                },
            )
            response.raise_for_status()
            data = response.json()
            raw_text = data.get("response", "")

        result = _parse_burnout_response(raw_text)
        return result

    except httpx.HTTPError as e:
        logger.error("Ollama HTTP error during burnout risk calculation: %s", e)
        return _fallback_burnout(employee_data)
    except Exception as e:
        logger.error("Unexpected error during burnout risk calculation: %s", e)
        return _fallback_burnout(employee_data)


def _parse_burnout_response(raw_text: str) -> dict[str, Any]:
    """Extract and parse JSON from Ollama response."""
    try:
        return json.loads(raw_text.strip())
    except json.JSONDecodeError:
        pass

    start = raw_text.find("{")
    end = raw_text.rfind("}") + 1
    if start != -1 and end > start:
        try:
            data = json.loads(raw_text[start:end])
            # Clamp and validate
            score = int(data.get("risk_score", 0))
            data["risk_score"] = max(0, min(100, score))
            valid_levels = ("low", "moderate", "high", "severe")
            if data.get("risk_level") not in valid_levels:
                data["risk_level"] = _score_to_burnout_level(data["risk_score"])
            # Ensure immediate_action_required is consistent with score
            data["immediate_action_required"] = data["risk_score"] >= 75
            return data
        except (json.JSONDecodeError, ValueError):
            pass

    logger.warning("Could not parse JSON from Ollama burnout response")
    return _default_burnout_result()


def _score_to_burnout_level(score: int) -> str:
    """Map numeric score to burnout risk level label."""
    if score <= 25:
        return "low"
    if score <= 50:
        return "moderate"
    if score <= 74:
        return "high"
    return "severe"


def _fallback_burnout(employee_data: dict[str, Any]) -> dict[str, Any]:
    """Heuristic burnout scoring fallback when Ollama is unavailable."""
    overtime_30d = float(employee_data.get("overtime_hours_30d") or 0)
    overtime_60d = float(employee_data.get("overtime_hours_60d") or 0)
    leave_90d = int(employee_data.get("leave_days_taken_90d") or 0)
    consecutive_days = int(employee_data.get("consecutive_work_days") or 0)
    check_in_days_ago = int(employee_data.get("manager_check_in_days_ago") or 0)
    recent_1on1 = int(employee_data.get("recent_1on1_count") or 0)
    sentiment = employee_data.get("recent_survey_sentiment")

    # Overwork score
    overwork_score = 30  # baseline
    if overtime_30d > 25:
        overwork_score = 85
    elif overtime_30d > 15:
        overwork_score = 65
    elif overtime_30d > 8:
        overwork_score = 45
    if consecutive_days > 14:
        overwork_score = min(100, overwork_score + 20)
    # Sustained overtime (both periods)
    if overtime_60d > 40:
        overwork_score = min(100, overwork_score + 15)

    # Leave avoidance score
    if leave_90d < 2:
        leave_avoidance_score = 80
    elif leave_90d < 5:
        leave_avoidance_score = 55
    elif leave_90d < 10:
        leave_avoidance_score = 25
    else:
        leave_avoidance_score = 10

    # Isolation score (low manager engagement)
    isolation_score = 20  # baseline
    if check_in_days_ago > 30:
        isolation_score = 70
    elif check_in_days_ago > 14:
        isolation_score = 45
    if recent_1on1 == 0:
        isolation_score = min(100, isolation_score + 20)

    # Sentiment score
    if sentiment is None:
        sentiment_score = 35  # unknown — mild concern
    else:
        sent_val = float(sentiment)
        if sent_val < -0.5:
            sentiment_score = 85
        elif sent_val < -0.2:
            sentiment_score = 65
        elif sent_val < 0.1:
            sentiment_score = 40
        else:
            sentiment_score = 15

    # Weighted overall risk score
    risk_score = int(
        overwork_score * 0.35
        + leave_avoidance_score * 0.25
        + isolation_score * 0.20
        + sentiment_score * 0.20
    )
    risk_score = max(0, min(100, risk_score))

    warning_signs = []
    if overtime_30d > 25:
        warning_signs.append(f"High overtime: {overtime_30d:.0f} hours in last 30 days.")
    if consecutive_days > 14:
        warning_signs.append(f"Working {consecutive_days} consecutive days without a break.")
    if leave_90d < 2:
        warning_signs.append("Taken fewer than 2 leave days in the past 90 days.")
    if check_in_days_ago > 30:
        warning_signs.append(f"No manager check-in in {check_in_days_ago} days.")
    if sentiment is not None and float(sentiment) < -0.2:
        warning_signs.append("Negative sentiment detected in recent survey responses.")
    if not warning_signs:
        warning_signs.append("No immediate warning signs detected — continue monitoring.")

    recommendations = []
    if overwork_score >= 65:
        recommendations.append("Manager: Review task load and redistribute urgent assignments.")
        recommendations.append("HR: Enforce maximum overtime policy and schedule a wellness check.")
    if leave_avoidance_score >= 55:
        recommendations.append("Manager: Encourage the employee to take scheduled leave.")
    if isolation_score >= 45:
        recommendations.append("Manager: Schedule a one-on-one meeting within the next 5 days.")
    if sentiment_score >= 65:
        recommendations.append("HR: Conduct a confidential wellbeing conversation.")
    if not recommendations:
        recommendations.append("Continue regular check-ins and monitor trends monthly.")

    return {
        "risk_score": risk_score,
        "risk_level": _score_to_burnout_level(risk_score),
        "factors": {
            "overwork_score": overwork_score,
            "leave_avoidance_score": leave_avoidance_score,
            "isolation_score": isolation_score,
            "sentiment_score": sentiment_score,
        },
        "warning_signs": warning_signs,
        "recommendations": recommendations[:6],
        "immediate_action_required": risk_score >= 75,
    }


def _default_burnout_result() -> dict[str, Any]:
    """Safe default when parsing completely fails."""
    return {
        "risk_score": 50,
        "risk_level": "moderate",
        "factors": {
            "overwork_score": 50,
            "leave_avoidance_score": 50,
            "isolation_score": 50,
            "sentiment_score": 50,
        },
        "warning_signs": ["Automated burnout assessment unavailable — manual review required."],
        "recommendations": ["HR: Conduct a manual wellbeing review for this employee."],
        "immediate_action_required": False,
    }


async def analyze_team_burnout(employee_list: list[dict[str, Any]]) -> dict[str, Any]:
    """Analyze burnout risk distribution across a team.

    Runs calculate_burnout_risk for each employee and aggregates results.

    Args:
        employee_list: List of employee_data dicts (same format as
            calculate_burnout_risk expects).

    Returns:
        dict with team burnout distribution and summary metrics.
    """
    if not employee_list:
        return {
            "total_employees": 0,
            "avg_risk_score": 0,
            "distribution": {"low": 0, "moderate": 0, "high": 0, "severe": 0},
            "immediate_action_count": 0,
            "top_risk_factors": [],
            "team_risk_level": "low",
        }

    results = []
    for emp_data in employee_list:
        result = await calculate_burnout_risk(emp_data)
        results.append(result)

    scores = [r.get("risk_score", 0) for r in results]
    avg_score = round(sum(scores) / len(scores), 1)

    distribution = {"low": 0, "moderate": 0, "high": 0, "severe": 0}
    for r in results:
        level = r.get("risk_level", "low")
        if level in distribution:
            distribution[level] += 1

    immediate_action_count = sum(1 for r in results if r.get("immediate_action_required"))

    # Aggregate factor averages to identify top team risk factors
    factor_totals: dict[str, float] = {
        "overwork_score": 0.0,
        "leave_avoidance_score": 0.0,
        "isolation_score": 0.0,
        "sentiment_score": 0.0,
    }
    factor_label_map = {
        "overwork_score": "Excessive overtime / overwork",
        "leave_avoidance_score": "Leave avoidance pattern",
        "isolation_score": "Lack of manager engagement",
        "sentiment_score": "Negative sentiment trend",
    }
    for r in results:
        factors = r.get("factors") or {}
        for key in factor_totals:
            factor_totals[key] += float(factors.get(key, 0))

    factor_avgs = {k: v / len(results) for k, v in factor_totals.items()}
    top_risk_factors = [
        factor_label_map[k]
        for k, avg in sorted(factor_avgs.items(), key=lambda x: x[1], reverse=True)
        if avg >= 45
    ]

    # Derive team-level risk label
    if avg_score >= 75:
        team_risk_level = "severe"
    elif avg_score >= 50:
        team_risk_level = "high"
    elif avg_score >= 25:
        team_risk_level = "moderate"
    else:
        team_risk_level = "low"

    return {
        "total_employees": len(results),
        "avg_risk_score": avg_score,
        "distribution": distribution,
        "immediate_action_count": immediate_action_count,
        "top_risk_factors": top_risk_factors,
        "team_risk_level": team_risk_level,
    }
