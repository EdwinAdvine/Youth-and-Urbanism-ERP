"""Analytics Copilot — NL-to-SQL powered by Ollama/LLM.

Accepts natural language questions about ERP data, generates validated SQL,
executes read-only queries, and returns both data and a natural language summary.
"""
from __future__ import annotations

import json
import logging
import re
import time
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services import analytics_cache as cache

logger = logging.getLogger(__name__)

# ── SQL validation (reused from analytics_ext) ───────────────────────────────
_FORBIDDEN_SQL_RE = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXEC|EXECUTE|MERGE|CALL|SET|COPY|VACUUM|REINDEX|CLUSTER|COMMENT|LOCK|NOTIFY|LISTEN|UNLISTEN|DISCARD|PREPARE|DEALLOCATE|SAVEPOINT|RELEASE|ROLLBACK|COMMIT|BEGIN)\b",
    re.IGNORECASE,
)
_VALID_SELECT_RE = re.compile(r"^\s*(SELECT|WITH)\b", re.IGNORECASE)


def _validate_sql(sql: str) -> str:
    """Validate and sanitize generated SQL. Returns cleaned SQL or raises ValueError."""
    stripped = sql.strip().rstrip(";").strip()

    # Extract SQL from markdown code blocks if present
    if "```" in stripped:
        match = re.search(r"```(?:sql)?\s*\n?(.*?)```", stripped, re.DOTALL)
        if match:
            stripped = match.group(1).strip().rstrip(";").strip()

    if not _VALID_SELECT_RE.match(stripped):
        raise ValueError("Generated query is not a SELECT statement")
    if _FORBIDDEN_SQL_RE.search(stripped):
        raise ValueError("Generated query contains forbidden DDL/DML statements")

    # Auto-add LIMIT if missing
    if "LIMIT" not in stripped.upper():
        stripped += " LIMIT 1000"

    return stripped


# ── Schema context builder ───────────────────────────────────────────────────
async def _build_schema_context(db: AsyncSession, module: str | None = None) -> str:
    """Build a concise schema context string for the LLM prompt.

    Includes table names, column names/types, and foreign key relationships
    so the LLM can generate accurate SQL.
    """
    # Get tables
    tables_sql = text("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name != 'alembic_version'
        ORDER BY table_name
    """)
    result = await db.execute(tables_sql)
    all_tables = [row[0] for row in result.fetchall()]

    # If module specified, filter tables
    if module:
        from app.api.v1.analytics_schema import _classify_table
        all_tables = [t for t in all_tables if _classify_table(t) == module]

    # Limit to most relevant tables (top 30) to fit context window
    tables = all_tables[:30]

    # Get columns for these tables
    if not tables:
        return "No tables found."

    placeholders = ", ".join(f"'{t}'" for t in tables)
    cols_sql = text(f"""
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ({placeholders})
        ORDER BY table_name, ordinal_position
    """)  # noqa: S608
    cols_result = await db.execute(cols_sql)

    # Build compact schema description
    schema_lines = []
    current_table = None
    cols = []
    for row in cols_result.fetchall():
        if row[0] != current_table:
            if current_table:
                schema_lines.append(f"  {current_table}({', '.join(cols)})")
            current_table = row[0]
            cols = []
        cols.append(f"{row[1]} {row[2]}")
    if current_table:
        schema_lines.append(f"  {current_table}({', '.join(cols)})")

    # Get FK relationships
    fk_sql = text(f"""
        SELECT tc.table_name, kcu.column_name, ccu.table_name, ccu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
          AND tc.table_name IN ({placeholders})
    """)  # noqa: S608
    fk_result = await db.execute(fk_sql)
    fk_lines = [
        f"  {row[0]}.{row[1]} -> {row[2]}.{row[3]}"
        for row in fk_result.fetchall()
    ]

    context = "DATABASE SCHEMA:\n" + "\n".join(schema_lines)
    if fk_lines:
        context += "\n\nRELATIONSHIPS:\n" + "\n".join(fk_lines[:20])

    return context


# ── LLM integration ──────────────────────────────────────────────────────────
async def _call_ollama(prompt: str, system: str = "") -> str:
    """Call Ollama API for text generation."""
    import httpx

    url = f"{settings.OLLAMA_URL}/api/generate"
    payload = {
        "model": settings.OLLAMA_MODEL,
        "prompt": prompt,
        "system": system,
        "stream": False,
        "options": {"temperature": 0.1, "num_predict": 1024},
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "")
    except Exception as e:
        logger.error("Ollama call failed: %s", e)
        raise


async def _call_openai(prompt: str, system: str = "") -> str:
    """Fallback: call OpenAI API."""
    import httpx

    if not settings.OPENAI_API_KEY:
        raise ValueError("OpenAI API key not configured")

    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
    payload = {
        "model": "gpt-4o",
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.1,
        "max_tokens": 1024,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def _generate_text(prompt: str, system: str = "") -> str:
    """Generate text using configured AI provider with fallback."""
    try:
        return await _call_ollama(prompt, system)
    except Exception:
        logger.warning("Ollama failed, trying OpenAI fallback")
        try:
            return await _call_openai(prompt, system)
        except Exception:
            logger.error("All AI providers failed")
            raise


# ── Main Copilot functions ───────────────────────────────────────────────────
async def nl_to_sql(
    question: str,
    db: AsyncSession,
    module: str | None = None,
) -> str:
    """Convert a natural language question to a validated SQL query."""
    schema_context = await _build_schema_context(db, module)

    system_prompt = """You are a PostgreSQL expert that converts natural language questions to SQL queries.
Rules:
- Generate ONLY a single SELECT statement (no DDL, DML, or multiple statements)
- Always include LIMIT (default 100 unless user specifies otherwise)
- Use proper JOIN syntax when combining tables
- Use aggregate functions (SUM, COUNT, AVG) with GROUP BY when asking for totals
- Format monetary values with 2 decimal places
- Use DATE_TRUNC for time-based grouping
- Return ONLY the SQL query, no explanations
- Use double quotes for column names that are reserved words
- Always qualify column names with table names when joining"""

    prompt = f"""{schema_context}

QUESTION: {question}

Generate a PostgreSQL SELECT query to answer this question. Return ONLY the SQL, no markdown or explanations."""

    raw_sql = await _generate_text(prompt, system_prompt)
    return _validate_sql(raw_sql)


async def generate_narrative(
    question: str,
    data: list[dict],
    sql: str,
) -> str:
    """Generate a natural language summary of query results."""
    # Truncate data for prompt
    sample = data[:10] if len(data) > 10 else data
    data_str = json.dumps(sample, default=str, indent=2)
    total_rows = len(data)

    system_prompt = """You are a business analyst explaining data insights to executives.
Rules:
- Be concise (2-3 sentences max)
- Highlight key numbers and trends
- Use business language, not technical jargon
- Include specific values from the data
- Note if the data shows any notable patterns or anomalies
- Format numbers with commas and appropriate units (KSh for currency)"""

    prompt = f"""Question: {question}
SQL Query: {sql}
Total rows: {total_rows}
Data (sample):
{data_str}

Provide a brief business insight summary of this data."""

    return await _generate_text(prompt, system_prompt)


async def suggest_visualizations(
    question: str,
    data: list[dict],
    columns: list[str],
) -> list[dict]:
    """Suggest the best chart types for the given data."""
    # Simple heuristic-based suggestions (no LLM needed for this)
    suggestions = []

    has_date = any("date" in c.lower() or "month" in c.lower() or "year" in c.lower() for c in columns)
    has_numeric = len(columns) > 1  # At least one dimension + one measure
    has_category = any("name" in c.lower() or "status" in c.lower() or "type" in c.lower() for c in columns)
    row_count = len(data)

    if has_date and has_numeric:
        suggestions.append({"type": "line", "title": "Trend over time", "x_axis": next(c for c in columns if "date" in c.lower() or "month" in c.lower() or "year" in c.lower()), "confidence": 0.9})
        suggestions.append({"type": "bar", "title": "Period comparison", "confidence": 0.7})

    if has_category and has_numeric and row_count <= 10:
        suggestions.append({"type": "pie", "title": "Distribution breakdown", "confidence": 0.8})
        suggestions.append({"type": "donut", "title": "Proportional view", "confidence": 0.7})

    if has_category and has_numeric:
        suggestions.append({"type": "bar", "title": "Comparison by category", "confidence": 0.85})

    if row_count == 1 and len(columns) <= 3:
        suggestions.append({"type": "kpi", "title": "Key metric", "confidence": 0.95})

    if has_numeric and row_count > 5:
        suggestions.append({"type": "table", "title": "Data table", "confidence": 0.6})

    # Sort by confidence
    suggestions.sort(key=lambda x: x["confidence"], reverse=True)
    return suggestions[:4]


async def copilot_query(
    question: str,
    db: AsyncSession,
    module: str | None = None,
) -> dict[str, Any]:
    """Full copilot pipeline: question → SQL → execute → data + narrative + viz suggestions.

    Returns:
        {
            "question": str,
            "sql": str,
            "columns": list[str],
            "data": list[dict],
            "total_rows": int,
            "execution_time_ms": int,
            "narrative": str,
            "suggested_visuals": list[dict],
        }
    """
    # Check cache
    cache_key = f"{question}:{module or 'all'}"
    cached = await cache.get_query_result(cache_key)
    if cached:
        return cached

    # Generate SQL
    sql = await nl_to_sql(question, db, module)

    # Execute query
    start = time.monotonic()
    try:
        result = await db.execute(text(sql))
        rows = result.fetchall()
        columns = list(result.keys()) if rows else []
    except Exception as e:
        logger.error("Copilot query execution failed: %s\nSQL: %s", e, sql)
        return {
            "question": question,
            "sql": sql,
            "columns": [],
            "data": [],
            "total_rows": 0,
            "execution_time_ms": 0,
            "narrative": f"Query execution failed: {e}",
            "suggested_visuals": [],
            "error": str(e),
        }
    elapsed_ms = int((time.monotonic() - start) * 1000)

    # Format data
    data = [dict(zip(columns, [str(v) if v is not None else None for v in row])) for row in rows]

    # Generate narrative and viz suggestions in parallel concept (sequential here for simplicity)
    try:
        narrative = await generate_narrative(question, data, sql)
    except Exception:
        narrative = f"Query returned {len(data)} rows in {elapsed_ms}ms."

    viz_suggestions = await suggest_visualizations(question, data, columns)

    response = {
        "question": question,
        "sql": sql,
        "columns": columns,
        "data": data,
        "total_rows": len(data),
        "execution_time_ms": elapsed_ms,
        "narrative": narrative,
        "suggested_visuals": viz_suggestions,
    }

    # Cache the result
    await cache.set_query_result(cache_key, response, ttl=120)

    return response
