"""HR Skills Inference — infers skills from activity across modules."""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


SKILLS_INFERENCE_PROMPT = """You are an expert HR AI that infers employee skills from their work activity.

Analyze the following activity data and infer skills the employee has demonstrated.

EMPLOYEE: {name}

PROJECT TASKS COMPLETED:
{project_tasks_text}

CRM DEALS WORKED:
{crm_deals_text}

TRAINING COMPLETED:
{training_text}

DOCUMENTS CREATED:
{documents_text}

TIME ENTRIES:
{time_entries_text}

Based on this activity, infer the employee's skills and identify any gaps.
Return a JSON object with EXACTLY these fields:
{{
  "inferred_skills": [
    {{
      "skill_name": "<skill name>",
      "category": "<one of: technical, soft, domain, tool, language, certification>",
      "confidence": <integer 0-100>,
      "source": "<one of: project, crm, training, document>",
      "evidence": "<brief explanation of what activity demonstrated this skill>"
    }}
  ],
  "skill_gaps": [
    {{
      "skill_name": "<skill name>",
      "importance": "<one of: critical, high, medium>",
      "recommended_courses": [<list of 1-2 course/resource suggestions>]
    }}
  ],
  "skill_summary": "<2-3 sentence overview of the employee's skill profile>"
}}

Only return the JSON object, no other text."""


# ---------------------------------------------------------------------------
# Keyword → skill mappings for fallback inference
# ---------------------------------------------------------------------------

_KEYWORD_SKILL_MAP: dict[str, dict[str, str]] = {
    # Technical
    "python": {"skill_name": "Python", "category": "technical"},
    "javascript": {"skill_name": "JavaScript", "category": "technical"},
    "typescript": {"skill_name": "TypeScript", "category": "technical"},
    "sql": {"skill_name": "SQL", "category": "technical"},
    "react": {"skill_name": "React", "category": "technical"},
    "fastapi": {"skill_name": "FastAPI", "category": "technical"},
    "api": {"skill_name": "API Development", "category": "technical"},
    "docker": {"skill_name": "Docker", "category": "tool"},
    "kubernetes": {"skill_name": "Kubernetes", "category": "tool"},
    "aws": {"skill_name": "AWS", "category": "tool"},
    "azure": {"skill_name": "Microsoft Azure", "category": "tool"},
    "database": {"skill_name": "Database Management", "category": "technical"},
    # Soft skills
    "manage": {"skill_name": "Project Management", "category": "soft"},
    "lead": {"skill_name": "Leadership", "category": "soft"},
    "present": {"skill_name": "Presentation", "category": "soft"},
    "negotiat": {"skill_name": "Negotiation", "category": "soft"},
    "communicat": {"skill_name": "Communication", "category": "soft"},
    "team": {"skill_name": "Teamwork", "category": "soft"},
    "analys": {"skill_name": "Analysis", "category": "soft"},
    "report": {"skill_name": "Reporting", "category": "soft"},
    # Domain
    "sales": {"skill_name": "Sales", "category": "domain"},
    "marketing": {"skill_name": "Marketing", "category": "domain"},
    "finance": {"skill_name": "Financial Analysis", "category": "domain"},
    "account": {"skill_name": "Accounting", "category": "domain"},
    "hr": {"skill_name": "Human Resources", "category": "domain"},
    "recruit": {"skill_name": "Recruitment", "category": "domain"},
    "supply": {"skill_name": "Supply Chain", "category": "domain"},
    "procurement": {"skill_name": "Procurement", "category": "domain"},
    "customer": {"skill_name": "Customer Relations", "category": "domain"},
    "design": {"skill_name": "Design", "category": "domain"},
    "ux": {"skill_name": "UX/UI Design", "category": "domain"},
    "research": {"skill_name": "Research", "category": "domain"},
    "strategy": {"skill_name": "Strategic Planning", "category": "domain"},
}


async def infer_skills_from_activity(activity_data: dict[str, Any]) -> dict[str, Any]:
    """Infer employee skills from cross-module activity using Ollama.

    Args:
        activity_data: Keys: employee_id, name,
            project_tasks (list of {title, description, tags}),
            crm_deals (list of {title, value, industry}),
            training_completed (list of {course_title, skills_taught}),
            documents_created (list of {title, doc_type}),
            time_entries (list of {task_title, hours}).

    Returns:
        dict with inferred_skills, skill_gaps, skill_summary.
    """
    name = activity_data.get("name", "Unknown")
    project_tasks = activity_data.get("project_tasks") or []
    crm_deals = activity_data.get("crm_deals") or []
    training_completed = activity_data.get("training_completed") or []
    documents_created = activity_data.get("documents_created") or []
    time_entries = activity_data.get("time_entries") or []

    # Build readable text sections for the prompt
    project_tasks_text = (
        "\n".join(
            f"- {t.get('title', 'N/A')}: {t.get('description', '')[:200]} "
            f"[tags: {', '.join(t.get('tags') or [])}]"
            for t in project_tasks[:20]
        )
        or "None"
    )
    crm_deals_text = (
        "\n".join(
            f"- {d.get('title', 'N/A')} | Value: {d.get('value', 'N/A')} | Industry: {d.get('industry', 'N/A')}"
            for d in crm_deals[:15]
        )
        or "None"
    )
    training_text = (
        "\n".join(
            f"- {t.get('course_title', 'N/A')} (skills: {', '.join(t.get('skills_taught') or [])})"
            for t in training_completed[:20]
        )
        or "None"
    )
    documents_text = (
        "\n".join(
            f"- {d.get('title', 'N/A')} ({d.get('doc_type', 'N/A')})"
            for d in documents_created[:15]
        )
        or "None"
    )
    time_entries_text = (
        "\n".join(
            f"- {e.get('task_title', 'N/A')}: {e.get('hours', 0):.1f}h"
            for e in time_entries[:20]
        )
        or "None"
    )

    prompt = SKILLS_INFERENCE_PROMPT.format(
        name=name,
        project_tasks_text=project_tasks_text,
        crm_deals_text=crm_deals_text,
        training_text=training_text,
        documents_text=documents_text,
        time_entries_text=time_entries_text,
    )

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                f"{settings.OLLAMA_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.2},
                },
            )
            response.raise_for_status()
            data = response.json()
            raw_text = data.get("response", "")

        result = _parse_skills_response(raw_text)

        # Merge in direct training skills (high confidence, no AI needed)
        direct_training_skills = _extract_from_training(training_completed)
        existing_names = {s["skill_name"].lower() for s in result.get("inferred_skills", [])}
        for skill in direct_training_skills:
            if skill["skill_name"].lower() not in existing_names:
                result.setdefault("inferred_skills", []).append(skill)

        return result

    except httpx.HTTPError as e:
        logger.error("Ollama HTTP error during skills inference: %s", e)
        return _fallback_inference(activity_data)
    except Exception as e:
        logger.error("Unexpected error during skills inference: %s", e)
        return _fallback_inference(activity_data)


def _parse_skills_response(raw_text: str) -> dict[str, Any]:
    """Extract and parse JSON from Ollama skills inference response."""
    try:
        return json.loads(raw_text.strip())
    except json.JSONDecodeError:
        pass

    start = raw_text.find("{")
    end = raw_text.rfind("}") + 1
    if start != -1 and end > start:
        try:
            return json.loads(raw_text[start:end])
        except json.JSONDecodeError:
            pass

    logger.warning("Could not parse JSON from Ollama skills inference response")
    return {
        "inferred_skills": [],
        "skill_gaps": [],
        "skill_summary": "Unable to infer skills at this time — manual assessment recommended.",
    }


def _extract_from_training(training_completed: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Directly extract skills from training records without AI.

    Maps skills_taught fields to inferred_skills entries with high confidence
    since training completion is authoritative evidence.

    Args:
        training_completed: List of {course_title, skills_taught} dicts.

    Returns:
        List of inferred skill dicts.
    """
    skills: list[dict[str, Any]] = []
    seen: set[str] = set()

    for training in training_completed:
        course_title = training.get("course_title", "")
        skills_taught = training.get("skills_taught") or []
        for skill_name in skills_taught:
            if not skill_name or skill_name.lower() in seen:
                continue
            seen.add(skill_name.lower())
            skills.append(
                {
                    "skill_name": skill_name,
                    "category": "certification" if "certif" in course_title.lower() else "technical",
                    "confidence": 90,
                    "source": "training",
                    "evidence": f"Completed course: {course_title}",
                }
            )

    return skills


def _fallback_inference(activity_data: dict[str, Any]) -> dict[str, Any]:
    """Simple keyword-matching fallback when Ollama is unavailable."""
    skills: list[dict[str, Any]] = []
    seen_skills: set[str] = set()

    # First get direct training skills (authoritative)
    training_completed = activity_data.get("training_completed") or []
    for skill in _extract_from_training(training_completed):
        if skill["skill_name"].lower() not in seen_skills:
            seen_skills.add(skill["skill_name"].lower())
            skills.append(skill)

    # Keyword scan across task titles, descriptions, and CRM deal titles
    text_sources: list[tuple[str, str]] = []
    for task in activity_data.get("project_tasks") or []:
        combined = f"{task.get('title', '')} {task.get('description', '')}"
        text_sources.append((combined, "project"))
    for deal in activity_data.get("crm_deals") or []:
        text_sources.append((deal.get("title", ""), "crm"))
    for entry in activity_data.get("time_entries") or []:
        text_sources.append((entry.get("task_title", ""), "project"))
    for doc in activity_data.get("documents_created") or []:
        text_sources.append((doc.get("title", ""), "document"))

    for text, source in text_sources:
        text_lower = text.lower()
        for keyword, skill_info in _KEYWORD_SKILL_MAP.items():
            if keyword in text_lower and skill_info["skill_name"].lower() not in seen_skills:
                seen_skills.add(skill_info["skill_name"].lower())
                skills.append(
                    {
                        "skill_name": skill_info["skill_name"],
                        "category": skill_info["category"],
                        "confidence": 55,
                        "source": source,
                        "evidence": f"Keyword '{keyword}' found in {source} activity (AI unavailable).",
                    }
                )

    name = activity_data.get("name", "this employee")
    skill_count = len(skills)
    summary = (
        f"Keyword-based skill inference for {name} identified {skill_count} skill(s). "
        "AI-powered analysis unavailable — results may be incomplete. "
        "Manual skill assessment is recommended."
    )

    return {
        "inferred_skills": skills,
        "skill_gaps": [],
        "skill_summary": summary,
    }
