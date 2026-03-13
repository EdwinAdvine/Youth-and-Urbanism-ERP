"""HR Survey Sentiment Analysis Service.

Analyzes open-text survey responses using the configured AI provider to produce
a sentiment score and label. Designed to run async (called from event handlers
or Celery tasks).
"""
from __future__ import annotations

import json
import logging
from decimal import Decimal
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


async def _ai_chat(messages: list[dict], model: str | None = None) -> str:
    """Call the configured AI provider."""
    from openai import AsyncOpenAI

    provider = settings.AI_PROVIDER
    if provider == "anthropic":
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=settings.AI_API_KEY)
        system_parts = [m["content"] for m in messages if m["role"] == "system"]
        non_system = [m for m in messages if m["role"] != "system"]
        kwargs: dict[str, Any] = {
            "model": model or settings.AI_MODEL,
            "max_tokens": 4096,
            "messages": non_system,
        }
        if system_parts:
            kwargs["system"] = "\n\n".join(system_parts)
        resp = await client.messages.create(**kwargs)
        return resp.content[0].text
    else:
        client_oai = AsyncOpenAI(api_key=settings.AI_API_KEY, base_url=settings.AI_BASE_URL)
        resp = await client_oai.chat.completions.create(
            model=model or settings.AI_MODEL,
            messages=messages,
            temperature=0.1,
        )
        return resp.choices[0].message.content or ""


SENTIMENT_PROMPT = """You are an expert at analyzing employee survey responses for sentiment.

Analyze the following text from an employee survey and return sentiment information.

TEXT:
{text}

Return a JSON object with exactly these fields:
{{
  "score": <float between -1.0 (very negative) and 1.0 (very positive)>,
  "label": "<one of: positive, neutral, negative>",
  "key_themes": [<list of up to 5 key themes mentioned>],
  "actionable_insights": [<list of up to 3 actionable insights for HR>]
}}

Only return the JSON object, no other text."""


async def analyze_sentiment(text: str) -> dict[str, Any]:
    """Analyze sentiment of survey response text using the configured AI provider.

    Returns dict with score (-1.0 to 1.0), label, key_themes, actionable_insights.
    """
    if not text or len(text.strip()) < 10:
        return {
            "score": 0.0,
            "label": "neutral",
            "key_themes": [],
            "actionable_insights": [],
        }

    prompt = SENTIMENT_PROMPT.format(text=text[:2000])

    try:
        raw_text = await _ai_chat([{"role": "user", "content": prompt}])
        result = _parse_sentiment_response(raw_text)
        return result

    except Exception as e:
        logger.error("AI error during sentiment analysis: %s", e)
        return _keyword_sentiment(text)


def _parse_sentiment_response(raw_text: str) -> dict[str, Any]:
    """Extract and parse JSON from AI response."""
    try:
        return json.loads(raw_text.strip())
    except json.JSONDecodeError:
        pass

    start = raw_text.find("{")
    end = raw_text.rfind("}") + 1
    if start != -1 and end > start:
        try:
            data = json.loads(raw_text[start:end])
            # Validate/clamp score
            score = float(data.get("score", 0.0))
            score = max(-1.0, min(1.0, score))
            data["score"] = score
            if data.get("label") not in ("positive", "neutral", "negative"):
                data["label"] = "neutral" if abs(score) < 0.2 else ("positive" if score > 0 else "negative")
            return data
        except (json.JSONDecodeError, ValueError):
            pass

    logger.warning("Could not parse sentiment JSON from AI response")
    return {"score": 0.0, "label": "neutral", "key_themes": [], "actionable_insights": []}


# Simple keyword lists for fallback
_POSITIVE_WORDS = {
    "great", "excellent", "amazing", "love", "happy", "satisfied", "good",
    "wonderful", "fantastic", "positive", "enjoy", "motivated", "proud",
    "supportive", "appreciated", "valued", "growth", "opportunity",
}
_NEGATIVE_WORDS = {
    "bad", "terrible", "hate", "unhappy", "dissatisfied", "poor", "awful",
    "frustrated", "stressed", "overwhelmed", "unclear", "unfair", "ignored",
    "bored", "micromanaged", "toxic", "burned", "exhausted", "quitting",
}


def _keyword_sentiment(text: str) -> dict[str, Any]:
    """Simple keyword-based fallback sentiment analysis."""
    words = set(text.lower().split())
    pos_count = len(words & _POSITIVE_WORDS)
    neg_count = len(words & _NEGATIVE_WORDS)
    total = pos_count + neg_count

    if total == 0:
        score = 0.0
        label = "neutral"
    else:
        score = (pos_count - neg_count) / total
        label = "positive" if score > 0.2 else ("negative" if score < -0.2 else "neutral")

    return {
        "score": round(score, 3),
        "label": label,
        "key_themes": [],
        "actionable_insights": ["Manual review recommended — AI sentiment unavailable"],
    }


async def analyze_survey_responses(answers: dict[str, Any]) -> dict[str, Any]:
    """Analyze all open-text answers in a survey response dict.

    Collects all string answers, concatenates them, and runs sentiment analysis.
    Returns the sentiment result dict.
    """
    # Collect all text answers (skip numeric NPS-style answers)
    text_parts = []
    for value in answers.values():
        if isinstance(value, str) and len(value.strip()) > 5:
            text_parts.append(value.strip())

    if not text_parts:
        return {"score": 0.0, "label": "neutral", "key_themes": [], "actionable_insights": []}

    combined_text = " | ".join(text_parts)
    return await analyze_sentiment(combined_text)


def score_to_decimal(score: float) -> Decimal:
    """Convert a float sentiment score to Decimal for database storage."""
    return Decimal(str(round(score, 3)))
