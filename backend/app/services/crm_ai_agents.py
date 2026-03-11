"""CRM AI Agents service — leverages Urban Bad AI orchestrator for CRM-specific agents."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.crm_ai_agents import CRMAIAgentConfig, CRMAIAgentRun

logger = logging.getLogger(__name__)

# Agent system prompts by type
AGENT_SYSTEM_PROMPTS = {
    "lead_qualifier": """You are a Lead Qualification Agent for the CRM. Your job is to:
1. Evaluate new leads using scoring rules and contact data
2. Assign a qualification status (new, contacted, qualified, unqualified)
3. Suggest next best actions for each lead
4. Flag high-value leads for immediate follow-up
Only use the tools provided. Be conservative with status changes.""",

    "meeting_scheduler": """You are a Meeting Scheduler Agent. Your job is to:
1. Check calendar availability for requested participants
2. Propose optimal meeting times
3. Create calendar events and send invitations
4. Follow up on unconfirmed meetings
Always respect business hours and timezone preferences.""",

    "ticket_resolver": """You are a Ticket Resolution Agent. Your job is to:
1. Search the knowledge base for relevant articles
2. Generate a helpful response based on the article content
3. If confidence is high (>80%), auto-resolve the ticket
4. Otherwise, escalate to a human agent with your research
Always be professional and empathetic in responses.""",

    "report_generator": """You are a Report Generator Agent. Your job is to:
1. Query CRM data based on the requested report type
2. Compute metrics (conversion rates, pipeline health, forecast)
3. Generate a summary with key insights
4. Highlight anomalies or concerning trends
Present data clearly with actionable recommendations.""",

    "data_enricher": """You are a Data Enrichment Agent. Your job is to:
1. Identify contacts with incomplete information
2. Suggest data enrichment from public sources
3. Detect and flag potential duplicates
4. Update contact records with verified information
Only update fields you are confident about.""",
}


async def run_agent(
    db: AsyncSession,
    agent_config_id,
    trigger: str = "manual",
    input_data: dict | None = None,
) -> CRMAIAgentRun:
    """Run a CRM AI agent."""
    config = await db.get(CRMAIAgentConfig, agent_config_id)
    if not config:
        raise ValueError("Agent config not found")

    if not config.is_active:
        raise ValueError("Agent is not active")

    run = CRMAIAgentRun(
        agent_config_id=agent_config_id,
        trigger=trigger,
        input_data=input_data or {},
        status="running",
        started_at=datetime.now(timezone.utc),
        actions_taken=[],
    )
    db.add(run)
    await db.flush()

    try:
        system_prompt = AGENT_SYSTEM_PROMPTS.get(config.agent_type, "You are a CRM assistant.")
        agent_config_data = config.config or {}

        # Get tool allowlist from config
        tool_allowlist = agent_config_data.get("tool_allowlist", [])
        max_actions = config.max_actions_per_run

        # Execute agent logic based on type
        result = await _execute_agent_logic(
            db, config.agent_type, input_data or {}, tool_allowlist, max_actions
        )

        run.output_data = result.get("output", {})
        run.actions_taken = result.get("actions", [])

        if config.approval_required and result.get("actions"):
            run.status = "needs_approval"
        else:
            run.status = "completed"
            run.completed_at = datetime.now(timezone.utc)

    except Exception as e:
        run.status = "failed"
        run.error_message = str(e)
        run.completed_at = datetime.now(timezone.utc)
        logger.exception("Agent run failed: %s", e)

    await db.flush()
    return run


async def _execute_agent_logic(
    db: AsyncSession,
    agent_type: str,
    input_data: dict,
    tool_allowlist: list,
    max_actions: int,
) -> dict:
    """Execute agent-specific logic."""
    if agent_type == "lead_qualifier":
        return await _qualify_leads(db, input_data, max_actions)
    elif agent_type == "ticket_resolver":
        return await _resolve_ticket(db, input_data)
    elif agent_type == "report_generator":
        return await _generate_report(db, input_data)
    elif agent_type == "data_enricher":
        return await _enrich_data(db, input_data, max_actions)
    else:
        return {"output": {"message": f"Agent type '{agent_type}' not implemented"}, "actions": []}


async def _qualify_leads(db: AsyncSession, input_data: dict, max_actions: int) -> dict:
    """Qualify leads using scoring engine."""
    from app.models.crm import Lead
    from app.services.crm_scoring import score_lead

    stmt = select(Lead).where(Lead.status == "new").limit(max_actions)
    result = await db.execute(stmt)
    leads = result.scalars().all()

    actions = []
    for lead in leads:
        score_result = await score_lead(db, lead.id)
        score = score_result.get("score", 0)
        category = score_result.get("category", "Cold")

        action = {
            "type": "score_lead",
            "lead_id": str(lead.id),
            "score": score,
            "category": category,
        }

        if score >= 80:
            lead.status = "qualified"
            action["status_change"] = "qualified"
        elif score >= 40:
            lead.status = "contacted"
            action["status_change"] = "contacted"

        actions.append(action)

    return {
        "output": {"leads_processed": len(leads), "qualified": sum(1 for a in actions if a.get("status_change") == "qualified")},
        "actions": actions,
    }


async def _resolve_ticket(db: AsyncSession, input_data: dict) -> dict:
    """Attempt to resolve a ticket using knowledge base."""
    from app.services.crm_kb_embeddings import semantic_search

    ticket_id = input_data.get("ticket_id")
    query = input_data.get("query", "")

    if not query:
        return {"output": {"message": "No query provided"}, "actions": []}

    articles = await semantic_search(db, query, limit=3)

    if articles and articles[0].get("similarity", 0) > 0.8:
        return {
            "output": {
                "suggested_response": articles[0].get("snippet", ""),
                "article_id": articles[0].get("id"),
                "confidence": articles[0].get("similarity"),
                "auto_resolve": True,
            },
            "actions": [{"type": "resolve_ticket", "ticket_id": ticket_id, "article_id": articles[0].get("id")}],
        }

    return {
        "output": {"articles": articles, "auto_resolve": False, "message": "Could not auto-resolve. Suggested articles attached."},
        "actions": [],
    }


async def _generate_report(db: AsyncSession, input_data: dict) -> dict:
    """Generate a CRM report."""
    report_type = input_data.get("report_type", "pipeline_summary")
    from app.models.crm import Opportunity
    from sqlalchemy import func

    if report_type == "pipeline_summary":
        result = await db.execute(
            select(
                Opportunity.stage,
                func.count().label("count"),
                func.sum(Opportunity.expected_value).label("total_value"),
            ).group_by(Opportunity.stage)
        )
        rows = result.all()
        summary = [{"stage": r.stage, "count": r.count, "total_value": float(r.total_value or 0)} for r in rows]
        return {"output": {"report_type": report_type, "data": summary}, "actions": []}

    return {"output": {"report_type": report_type, "message": "Report type not implemented"}, "actions": []}


async def _enrich_data(db: AsyncSession, input_data: dict, max_actions: int) -> dict:
    """Find contacts with incomplete data and suggest enrichment."""
    from app.models.crm import Contact

    stmt = select(Contact).where(
        Contact.is_active.is_(True),
        (Contact.industry.is_(None)) | (Contact.website.is_(None)) | (Contact.employee_count.is_(None)),
    ).limit(max_actions)
    result = await db.execute(stmt)
    contacts = result.scalars().all()

    actions = []
    for c in contacts:
        missing = []
        if not c.industry:
            missing.append("industry")
        if not c.website:
            missing.append("website")
        if not c.employee_count:
            missing.append("employee_count")
        actions.append({
            "type": "enrich_contact",
            "contact_id": str(c.id),
            "missing_fields": missing,
        })

    return {
        "output": {"contacts_found": len(contacts), "total_missing_fields": sum(len(a["missing_fields"]) for a in actions)},
        "actions": actions,
    }


async def approve_run(db: AsyncSession, run_id, approver_id, approved: bool = True) -> dict:
    """Approve or reject a pending agent run."""
    run = await db.get(CRMAIAgentRun, run_id)
    if not run:
        return {"error": "Run not found"}
    if run.status != "needs_approval":
        return {"error": "Run is not pending approval"}

    run.approved_by = approver_id
    if approved:
        run.status = "completed"
    else:
        run.status = "failed"
        run.error_message = "Rejected by user"
    run.completed_at = datetime.now(timezone.utc)
    await db.flush()
    return {"status": run.status, "run_id": str(run.id)}
