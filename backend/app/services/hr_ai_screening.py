"""HR AI Resume Screening Service.

Uses the configured AI provider to extract skills from resumes and compute a
match score against a job requisition's required skills.
"""
from __future__ import annotations

import json
import logging
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


SCREENING_PROMPT = """You are an expert HR recruiter AI. Analyze the following resume text and job requirements.

RESUME TEXT:
{resume_text}

JOB REQUIREMENTS:
Title: {job_title}
Required Skills: {required_skills}
Description: {job_description}

Return a JSON object with exactly these fields:
{{
  "match_score": <integer 0-100>,
  "extracted_skills": [<list of skills found in resume>],
  "matching_skills": [<skills from required list found in resume>],
  "missing_skills": [<required skills NOT found in resume>],
  "summary": "<2-3 sentence candidate summary>",
  "strengths": [<top 3 strengths>],
  "concerns": [<top 2 concerns or empty list>]
}}

Only return the JSON object, no other text."""


async def screen_resume(
    resume_text: str,
    job_title: str,
    required_skills: list[str],
    job_description: str = "",
) -> dict[str, Any]:
    """Screen a resume against job requirements using the configured AI provider.

    Returns a dict with match_score, extracted_skills, summary, etc.
    """
    prompt = SCREENING_PROMPT.format(
        resume_text=resume_text[:4000],  # limit to avoid context overflow
        job_title=job_title,
        required_skills=", ".join(required_skills) if required_skills else "Not specified",
        job_description=job_description[:1000],
    )

    try:
        raw_text = await _ai_chat([{"role": "user", "content": prompt}])
        result = _parse_json_response(raw_text)
        return result

    except Exception as e:
        logger.error("AI error during resume screening: %s", e)
        return _fallback_screening(resume_text, required_skills)


def _parse_json_response(raw_text: str) -> dict[str, Any]:
    """Extract and parse JSON from AI response."""
    # Try direct parse first
    try:
        return json.loads(raw_text.strip())
    except json.JSONDecodeError:
        pass

    # Try to find JSON block in the text
    start = raw_text.find("{")
    end = raw_text.rfind("}") + 1
    if start != -1 and end > start:
        try:
            return json.loads(raw_text[start:end])
        except json.JSONDecodeError:
            pass

    # Return a safe default
    logger.warning("Could not parse JSON from AI screening response")
    return {
        "match_score": 0,
        "extracted_skills": [],
        "matching_skills": [],
        "missing_skills": [],
        "summary": "Unable to process resume at this time.",
        "strengths": [],
        "concerns": ["Resume could not be parsed automatically"],
    }


def _fallback_screening(
    resume_text: str, required_skills: list[str]
) -> dict[str, Any]:
    """Simple keyword-based fallback when AI is unavailable."""
    resume_lower = resume_text.lower()
    matching = [s for s in required_skills if s.lower() in resume_lower]
    missing = [s for s in required_skills if s.lower() not in resume_lower]
    score = int((len(matching) / max(len(required_skills), 1)) * 100)

    return {
        "match_score": score,
        "extracted_skills": matching,
        "matching_skills": matching,
        "missing_skills": missing,
        "summary": f"Keyword-based screening: {len(matching)}/{len(required_skills)} required skills found.",
        "strengths": [f"Has {s}" for s in matching[:3]],
        "concerns": ["AI screening unavailable — manual review recommended"],
    }


SKILLS_EXTRACTION_PROMPT = """Extract a comprehensive list of skills from this text.
Include: programming languages, frameworks, tools, soft skills, domain expertise, certifications.

TEXT:
{text}

Return ONLY a JSON array of skill strings, e.g.: ["Python", "SQL", "Project Management"]
No other text."""


async def extract_skills_from_text(text: str) -> list[str]:
    """Extract skills from any text (resume, profile, job description)."""
    prompt = SKILLS_EXTRACTION_PROMPT.format(text=text[:3000])

    try:
        raw_text = await _ai_chat([{"role": "user", "content": prompt}])
        raw_text = raw_text.strip()

        start = raw_text.find("[")
        end = raw_text.rfind("]") + 1
        if start != -1 and end > start:
            return json.loads(raw_text[start:end])

    except Exception as e:
        logger.error("Error extracting skills via AI: %s", e)

    return []
