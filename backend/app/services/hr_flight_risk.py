"""HR Flight Risk Scoring — predicts employee attrition risk via Ollama."""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


FLIGHT_RISK_PROMPT = """You are an expert HR analytics AI specializing in employee retention and attrition prediction.

Analyze the following employee data and assess their flight risk (likelihood of leaving the organization).

EMPLOYEE DATA:
Name: {name}
Job Title: {job_title}
Department: {department}
Tenure: {tenure_years} years
Last Performance Review Rating: {last_review_rating}
Days Since Last Promotion: {days_since_last_promotion}
Current Salary: {current_salary}
Estimated Market Salary: {market_salary_estimate}
Recent Leave Days Taken: {recent_leave_days}
Overtime Hours (last 30 days): {overtime_hours_30d}
Survey Sentiment Average: {survey_sentiment_avg}

ORGANIZATIONAL CONTEXT:
Team Average Tenure: {team_avg_tenure} years
Organization Attrition Rate YTD: {org_attrition_rate_ytd}%

Analyze the risk across these dimensions and return a JSON object with EXACTLY these fields:
{{
  "risk_score": <integer 0-100, overall flight risk>,
  "risk_level": "<one of: low, medium, high, critical>",
  "factors": {{
    "tenure_risk": <integer 0-100>,
    "satisfaction_risk": <integer 0-100>,
    "compensation_risk": <integer 0-100>,
    "promotion_risk": <integer 0-100>,
    "workload_risk": <integer 0-100>
  }},
  "recommendations": [<list of 3-5 specific, actionable strings for HR/manager>],
  "summary": "<2-3 sentence explanation of the risk assessment>"
}}

Risk level mapping: 0-25 = low, 26-50 = medium, 51-75 = high, 76-100 = critical.
Only return the JSON object, no other text."""


async def calculate_flight_risk(
    employee_data: dict[str, Any],
    db_context: dict[str, Any],
) -> dict[str, Any]:
    """Predict employee attrition risk using Ollama.

    Args:
        employee_data: Keys: employee_id, name, tenure_years, job_title, department,
            last_review_rating (1-5 or None), days_since_last_promotion, current_salary,
            market_salary_estimate, recent_leave_days, overtime_hours_30d,
            survey_sentiment_avg (None if no surveys).
        db_context: Keys: team_avg_tenure, org_attrition_rate_ytd.

    Returns:
        dict with risk_score, risk_level, factors, recommendations, summary.
    """
    prompt = FLIGHT_RISK_PROMPT.format(
        name=employee_data.get("name", "Unknown"),
        job_title=employee_data.get("job_title", "Unknown"),
        department=employee_data.get("department", "Unknown"),
        tenure_years=employee_data.get("tenure_years", 0),
        last_review_rating=employee_data.get("last_review_rating") or "Not available",
        days_since_last_promotion=employee_data.get("days_since_last_promotion", 0),
        current_salary=employee_data.get("current_salary") or "Not available",
        market_salary_estimate=employee_data.get("market_salary_estimate") or "Not available",
        recent_leave_days=employee_data.get("recent_leave_days", 0),
        overtime_hours_30d=employee_data.get("overtime_hours_30d", 0),
        survey_sentiment_avg=employee_data.get("survey_sentiment_avg") or "No survey data",
        team_avg_tenure=db_context.get("team_avg_tenure", "Unknown"),
        org_attrition_rate_ytd=db_context.get("org_attrition_rate_ytd", "Unknown"),
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

        result = _parse_flight_risk_response(raw_text)
        return result

    except httpx.HTTPError as e:
        logger.error("Ollama HTTP error during flight risk calculation: %s", e)
        return _fallback_flight_risk(employee_data)
    except Exception as e:
        logger.error("Unexpected error during flight risk calculation: %s", e)
        return _fallback_flight_risk(employee_data)


def _parse_flight_risk_response(raw_text: str) -> dict[str, Any]:
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
            # Clamp risk_score to 0-100
            score = int(data.get("risk_score", 0))
            data["risk_score"] = max(0, min(100, score))
            # Validate risk_level
            valid_levels = ("low", "medium", "high", "critical")
            if data.get("risk_level") not in valid_levels:
                data["risk_level"] = _score_to_risk_level(data["risk_score"])
            return data
        except (json.JSONDecodeError, ValueError):
            pass

    logger.warning("Could not parse JSON from Ollama flight risk response")
    return _default_flight_risk_result()


def _score_to_risk_level(score: int) -> str:
    """Map numeric score to risk level label."""
    if score <= 25:
        return "low"
    if score <= 50:
        return "medium"
    if score <= 75:
        return "high"
    return "critical"


def _fallback_flight_risk(employee_data: dict[str, Any]) -> dict[str, Any]:
    """Heuristic scoring fallback when Ollama is unavailable."""
    tenure_years = float(employee_data.get("tenure_years") or 0)
    days_since_promotion = int(employee_data.get("days_since_last_promotion") or 0)
    survey_sentiment = employee_data.get("survey_sentiment_avg")
    overtime_30d = float(employee_data.get("overtime_hours_30d") or 0)
    current_salary = float(employee_data.get("current_salary") or 0)
    market_salary = float(employee_data.get("market_salary_estimate") or 0)

    # Tenure risk
    if tenure_years < 1:
        tenure_risk = 80
    elif tenure_years < 2:
        tenure_risk = 60
    elif tenure_years < 5:
        tenure_risk = 30
    else:
        tenure_risk = 15

    # Promotion risk
    promotion_risk = 70 if days_since_promotion > 730 else 35 if days_since_promotion > 365 else 15

    # Satisfaction risk (from survey sentiment)
    if survey_sentiment is None:
        satisfaction_risk = 40  # unknown — moderate concern
    elif float(survey_sentiment) < -0.3:
        satisfaction_risk = 80
    elif float(survey_sentiment) < 0:
        satisfaction_risk = 55
    elif float(survey_sentiment) < 0.3:
        satisfaction_risk = 30
    else:
        satisfaction_risk = 10

    # Workload risk
    workload_risk = 70 if overtime_30d > 20 else 45 if overtime_30d > 10 else 15

    # Compensation risk
    if current_salary > 0 and market_salary > 0:
        ratio = current_salary / market_salary
        if ratio < 0.85:
            compensation_risk = 80
        elif ratio < 0.95:
            compensation_risk = 50
        elif ratio > 1.1:
            compensation_risk = 10
        else:
            compensation_risk = 25
    else:
        compensation_risk = 40  # unknown

    # Weighted overall risk score
    risk_score = int(
        tenure_risk * 0.20
        + promotion_risk * 0.20
        + satisfaction_risk * 0.25
        + workload_risk * 0.15
        + compensation_risk * 0.20
    )
    risk_score = max(0, min(100, risk_score))

    recommendations = []
    if tenure_risk >= 60:
        recommendations.append("Schedule a stay interview to understand career expectations.")
    if promotion_risk >= 70:
        recommendations.append("Review promotion eligibility and create a clear career path plan.")
    if satisfaction_risk >= 70:
        recommendations.append("Conduct a one-on-one to address satisfaction concerns immediately.")
    if workload_risk >= 70:
        recommendations.append("Review workload distribution and consider temporary resource support.")
    if compensation_risk >= 70:
        recommendations.append("Benchmark compensation against market rates and consider a salary review.")
    if not recommendations:
        recommendations.append("Continue regular check-ins and maintain current engagement practices.")

    return {
        "risk_score": risk_score,
        "risk_level": _score_to_risk_level(risk_score),
        "factors": {
            "tenure_risk": tenure_risk,
            "satisfaction_risk": satisfaction_risk,
            "compensation_risk": compensation_risk,
            "promotion_risk": promotion_risk,
            "workload_risk": workload_risk,
        },
        "recommendations": recommendations[:5],
        "summary": (
            f"Heuristic assessment (AI unavailable): risk score {risk_score}/100. "
            f"Key drivers: tenure ({tenure_years:.1f}yrs), "
            f"promotion gap ({days_since_promotion}d), "
            f"overtime ({overtime_30d:.0f}h/30d)."
        ),
    }


def _default_flight_risk_result() -> dict[str, Any]:
    """Safe default when parsing completely fails."""
    return {
        "risk_score": 50,
        "risk_level": "medium",
        "factors": {
            "tenure_risk": 50,
            "satisfaction_risk": 50,
            "compensation_risk": 50,
            "promotion_risk": 50,
            "workload_risk": 50,
        },
        "recommendations": ["Manual HR review recommended — automated scoring unavailable."],
        "summary": "Unable to generate flight risk assessment at this time. Manual review required.",
    }


async def get_team_flight_risk_summary(employee_risks: list[dict[str, Any]]) -> dict[str, Any]:
    """Aggregate flight risk scores for a team into a summary.

    Args:
        employee_risks: List of individual flight risk result dicts (each from
            calculate_flight_risk).

    Returns:
        dict with avg_risk, high_risk_count, critical_risk_count, top_concerns.
    """
    if not employee_risks:
        return {
            "avg_risk": 0,
            "high_risk_count": 0,
            "critical_risk_count": 0,
            "top_concerns": [],
        }

    scores = [r.get("risk_score", 0) for r in employee_risks]
    avg_risk = round(sum(scores) / len(scores), 1)

    high_risk_count = sum(1 for r in employee_risks if r.get("risk_level") in ("high", "critical"))
    critical_risk_count = sum(1 for r in employee_risks if r.get("risk_level") == "critical")

    # Aggregate factor scores to find top team-wide concerns
    factor_totals: dict[str, float] = {
        "tenure_risk": 0.0,
        "satisfaction_risk": 0.0,
        "compensation_risk": 0.0,
        "promotion_risk": 0.0,
        "workload_risk": 0.0,
    }
    factor_label_map = {
        "tenure_risk": "Tenure & retention gaps",
        "satisfaction_risk": "Low employee satisfaction",
        "compensation_risk": "Below-market compensation",
        "promotion_risk": "Stalled career progression",
        "workload_risk": "Excessive workload / overtime",
    }

    for risk in employee_risks:
        factors = risk.get("factors") or {}
        for key in factor_totals:
            factor_totals[key] += float(factors.get(key, 0))

    # Average each factor and find those above 50
    factor_avgs = {k: v / len(employee_risks) for k, v in factor_totals.items()}
    top_concerns = [
        factor_label_map[k]
        for k, avg in sorted(factor_avgs.items(), key=lambda x: x[1], reverse=True)
        if avg >= 50
    ]

    return {
        "avg_risk": avg_risk,
        "high_risk_count": high_risk_count,
        "critical_risk_count": critical_risk_count,
        "top_concerns": top_concerns,
    }
