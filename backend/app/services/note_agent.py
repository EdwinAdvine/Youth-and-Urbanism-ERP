"""Note Agent Service — multi-step agentic workflows for Y&U Notes.

Orchestrates cross-module data gathering and AI generation for complex note tasks.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class NoteAgentService:
    """Multi-step note workflows that combine ERP data + AI generation."""

    async def create_project_status_report(
        self,
        project_id: str,
        user_id: str,
        db: Any,
    ) -> dict[str, Any]:
        """Generate a complete project status report from live ERP data.

        Queries Projects, Finance, HR, and CRM modules, then uses AI to
        produce a structured status report note.
        """
        import uuid  # noqa: PLC0415
        from sqlalchemy import select  # noqa: PLC0415

        context_parts: list[str] = []
        steps: list[str] = []

        # Step 1: Fetch project data
        try:
            from app.models.project import Project, Task  # noqa: PLC0415
            pid = uuid.UUID(str(project_id))
            project = await db.get(Project, pid)
            if project:
                steps.append(f"✓ Project: {project.name}")
                # Count tasks
                res = await db.execute(select(Task).where(Task.project_id == pid))
                tasks = res.scalars().all()
                total = len(tasks)
                done = sum(1 for t in tasks if getattr(t, 'status', '') in ('done', 'completed'))
                overdue = sum(1 for t in tasks if getattr(t, 'due_date', None) and getattr(t, 'status', '') not in ('done', 'completed'))
                context_parts.append(
                    f"Project: {project.name}\n"
                    f"Status: {getattr(project, 'status', 'active')}\n"
                    f"Tasks: {done}/{total} complete, {overdue} overdue\n"
                    f"Description: {(project.description or '')[:200]}"
                )
        except Exception:
            logger.warning("Failed to fetch project data for %s", project_id)
            steps.append("⚠ Project data unavailable")

        # Step 2: Fetch budget/finance data
        try:
            from app.models.project import ProjectBudget  # noqa: PLC0415
            res = await db.execute(
                select(ProjectBudget).where(ProjectBudget.project_id == uuid.UUID(str(project_id)))
            )
            budget = res.scalar_one_or_none()
            if budget:
                spent = float(getattr(budget, 'spent_amount', 0) or 0)
                total_b = float(getattr(budget, 'total_budget', 0) or 1)
                pct = round(spent / total_b * 100, 1) if total_b else 0
                context_parts.append(f"Budget: ${spent:,.0f} spent of ${total_b:,.0f} ({pct}% burn rate)")
                steps.append(f"✓ Budget: {pct}% burned")
        except Exception:
            logger.warning("Budget data unavailable for project %s", project_id)

        # Step 3: AI generation
        try:
            from app.services.ai import AIService  # noqa: PLC0415
            ai = AIService(db=db)
            context = "\n\n".join(context_parts) if context_parts else f"Project ID: {project_id}"
            prompt = (
                f"Write a professional project status report based on this live ERP data:\n\n"
                f"{context}\n\n"
                f"Format as HTML with sections: Executive Summary, Progress, Budget, Risks & Issues, Next Steps. "
                f"Use <h2> for section headings. Be concise and data-driven."
            )
            messages = [
                {"role": "system", "content": "You are a project manager writing a status report."},
                {"role": "user", "content": prompt},
            ]
            import uuid as uuid_mod  # noqa: PLC0415
            uid = uuid_mod.UUID(str(user_id))
            content, _, _ = await ai.chat(messages, uid, "note-agent-project-report", tools=False)
            steps.append("✓ AI report generated")
            return {"content": content, "steps": steps, "success": True}
        except Exception as e:
            logger.exception("AI generation failed for project status report")
            fallback = f"<h1>Project Status Report</h1>\n{'<br>'.join(context_parts)}"
            return {"content": fallback, "steps": steps, "success": False, "error": str(e)}

    async def process_meeting_notes(
        self,
        note_id: str,
        user_id: str,
        db: Any,
    ) -> dict[str, Any]:
        """Extract action items from meeting notes and create ERP records."""
        import uuid  # noqa: PLC0415
        from app.models.notes import Note  # noqa: PLC0415

        note = await db.get(Note, uuid.UUID(str(note_id)))
        if not note:
            return {"error": "Note not found", "success": False}

        steps: list[str] = []
        actions_created: list[dict] = []

        try:
            from app.services.ai import AIService  # noqa: PLC0415
            import re  # noqa: PLC0415
            import json  # noqa: PLC0415
            ai = AIService(db=db)
            text = re.sub(r"<[^>]+>", "", note.content or "")
            prompt = (
                f"Extract all action items from these meeting notes. "
                f"For each action item return JSON with: title, assignee (person name or null), "
                f"due_date (ISO date or null), type (task|email|event|invoice).\n\n"
                f"Return ONLY a JSON array. Meeting notes:\n\n{text[:3000]}"
            )
            messages = [
                {"role": "system", "content": "You extract structured data from meeting notes."},
                {"role": "user", "content": prompt},
            ]
            uid = uuid.UUID(str(user_id))
            raw, _, _ = await ai.chat(messages, uid, "note-agent-meeting", tools=False)
            steps.append("✓ Action items extracted")

            # Parse AI response
            try:
                start = raw.find('[')
                end = raw.rfind(']') + 1
                items = json.loads(raw[start:end]) if start >= 0 else []
            except Exception:
                items = []

            # Create tasks for each action item
            from app.models.project import Task  # noqa: PLC0415
            for item in items[:10]:  # Cap at 10
                if item.get('type', 'task') == 'task':
                    task = Task(
                        title=item.get('title', 'Action item'),
                        status='todo',
                        created_by_id=uid,
                        description=f"Created from meeting note: {note.title}",
                    )
                    db.add(task)
                    actions_created.append({"type": "task", "title": item.get('title')})

            await db.commit()
            steps.append(f"✓ Created {len(actions_created)} tasks")
            return {"actions_created": actions_created, "steps": steps, "success": True, "count": len(actions_created)}

        except Exception as e:
            logger.exception("Failed to process meeting notes for %s", note_id)
            return {"error": str(e), "steps": steps, "success": False}

    async def create_deal_proposal(
        self,
        deal_id: str,
        user_id: str,
        db: Any,
    ) -> dict[str, Any]:
        """Generate a deal proposal from CRM + Finance data."""
        import uuid  # noqa: PLC0415
        context_parts: list[str] = []
        steps: list[str] = []

        try:
            from app.models.crm import Deal  # noqa: PLC0415
            deal = await db.get(Deal, uuid.UUID(str(deal_id)))
            if deal:
                context_parts.append(
                    f"Deal: {getattr(deal, 'title', deal_id)}\n"
                    f"Value: ${getattr(deal, 'value', 0):,.0f}\n"
                    f"Stage: {getattr(deal, 'stage', 'unknown')}\n"
                    f"Description: {(getattr(deal, 'description', '') or '')[:200]}"
                )
                steps.append(f"✓ Deal: {getattr(deal, 'title', deal_id)}")
        except Exception:
            steps.append("⚠ Deal data unavailable")

        try:
            from app.services.ai import AIService  # noqa: PLC0415
            import uuid as uuid_mod  # noqa: PLC0415
            ai = AIService(db=db)
            context = "\n\n".join(context_parts) if context_parts else f"Deal ID: {deal_id}"
            prompt = (
                f"Write a professional business proposal based on this CRM data:\n\n{context}\n\n"
                f"Format as HTML with sections: Executive Summary, Our Solution, Value Proposition, "
                f"Pricing, Next Steps. Use <h2> headings."
            )
            messages = [
                {"role": "system", "content": "You are a sales professional writing a business proposal."},
                {"role": "user", "content": prompt},
            ]
            uid = uuid_mod.UUID(str(user_id))
            content, _, _ = await ai.chat(messages, uid, "note-agent-deal-proposal", tools=False)
            steps.append("✓ Proposal generated")
            return {"content": content, "steps": steps, "success": True}
        except Exception as e:
            return {"error": str(e), "steps": steps, "success": False}
