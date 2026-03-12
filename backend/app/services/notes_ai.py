"""AI service for Y&U Notes — ERP-aware content generation, extraction, and Q&A."""
from __future__ import annotations

import json
import logging
import re
import uuid
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.ai import AIService
from app.services.embedding import embedding_svc

logger = logging.getLogger(__name__)


class NotesAIService:
    """AI operations specific to Y&U Notes."""

    def __init__(self, db: AsyncSession, user: Any | None = None) -> None:
        self.db = db
        self._user = user
        self._ai = AIService(db, user)

    # ── ERP context gathering ────────────────────────────────────────────────

    async def gather_erp_context(
        self,
        prompt: str,
        user_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Parse user prompt for ERP references and fetch relevant data."""
        context: dict[str, Any] = {}

        # Check for project references
        if re.search(r"project|sprint|milestone|task", prompt, re.I):
            try:
                from app.models.projects import Project
                result = await self.db.execute(
                    select(Project)
                    .where(Project.owner_id == user_id)
                    .order_by(Project.updated_at.desc())
                    .limit(5)
                )
                projects = result.scalars().all()
                if projects:
                    context["projects"] = [
                        {"id": str(p.id), "name": p.name, "status": p.status, "progress": getattr(p, "progress", 0)}
                        for p in projects
                    ]
            except Exception:
                logger.debug("Could not fetch project context")

        # Check for finance references
        if re.search(r"invoice|budget|expense|revenue|financial|payment", prompt, re.I):
            try:
                from app.models.finance import Invoice
                result = await self.db.execute(
                    select(Invoice)
                    .where(Invoice.created_by == user_id)
                    .order_by(Invoice.created_at.desc())
                    .limit(5)
                )
                invoices = result.scalars().all()
                if invoices:
                    context["invoices"] = [
                        {"id": str(inv.id), "number": getattr(inv, "invoice_number", ""), "status": inv.status,
                         "total": float(inv.total_amount) if inv.total_amount else 0}
                        for inv in invoices
                    ]
            except Exception:
                logger.debug("Could not fetch finance context")

        # Check for CRM references
        if re.search(r"deal|lead|contact|pipeline|client|customer", prompt, re.I):
            try:
                from app.models.crm import Lead
                result = await self.db.execute(
                    select(Lead)
                    .where(Lead.owner_id == user_id)
                    .order_by(Lead.updated_at.desc())
                    .limit(5)
                )
                leads = result.scalars().all()
                if leads:
                    context["crm_deals"] = [
                        {"id": str(l.id), "name": getattr(l, "company_name", l.name),
                         "status": l.status, "value": float(l.value) if l.value else 0}
                        for l in leads
                    ]
            except Exception:
                logger.debug("Could not fetch CRM context")

        # Check for HR references
        if re.search(r"employee|team|staff|department|hr|leave|payroll", prompt, re.I):
            try:
                from app.models.hr import Employee
                result = await self.db.execute(
                    select(func.count()).select_from(Employee)
                )
                emp_count = result.scalar() or 0
                context["hr"] = {"total_employees": emp_count}
            except Exception:
                logger.debug("Could not fetch HR context")

        # Check for support/ticket references
        if re.search(r"ticket|support|issue|bug|incident", prompt, re.I):
            try:
                from app.models.support import Ticket
                result = await self.db.execute(
                    select(Ticket)
                    .where(Ticket.status.in_(["open", "in_progress"]))
                    .order_by(Ticket.created_at.desc())
                    .limit(5)
                )
                tickets = result.scalars().all()
                if tickets:
                    context["tickets"] = [
                        {"id": str(t.id), "title": t.title, "status": t.status, "priority": t.priority}
                        for t in tickets
                    ]
            except Exception:
                logger.debug("Could not fetch support context")

        return context

    # ── Content generation ───────────────────────────────────────────────────

    async def generate_content(
        self,
        prompt: str,
        user_id: uuid.UUID,
        session_id: str = "notes-ai",
        include_erp_context: bool = True,
    ) -> str:
        """Generate note content with optional ERP context enrichment."""
        erp_context = {}
        if include_erp_context:
            erp_context = await self.gather_erp_context(prompt, user_id)

        system_msg = (
            "You are Y&U Notes AI, an intelligent writing assistant inside Urban ERP. "
            "Generate well-structured, professional content for notes. "
            "Use Markdown formatting with headings, lists, and emphasis. "
            "Be concise but thorough."
        )
        if erp_context:
            system_msg += (
                "\n\nYou have access to live ERP data. Use this context to make your "
                "response accurate and data-driven:\n"
                f"{json.dumps(erp_context, indent=2, default=str)}"
            )

        messages = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": prompt},
        ]

        reply, _, _ = await self._ai.chat(messages, user_id, session_id, tools=False)
        return reply

    # ── Summarize ────────────────────────────────────────────────────────────

    async def summarize(
        self,
        content: str,
        user_id: uuid.UUID,
        style: str = "concise",
    ) -> str:
        """Summarize note content."""
        style_instructions = {
            "concise": "Create a brief, bullet-point summary of the key points.",
            "executive": "Create an executive summary suitable for leadership review. Include key decisions, metrics, and action items.",
            "detailed": "Create a comprehensive summary preserving all important details, organized with headings.",
        }

        messages = [
            {"role": "system", "content": (
                "You are a professional summarization assistant. "
                f"{style_instructions.get(style, style_instructions['concise'])} "
                "Output in Markdown format."
            )},
            {"role": "user", "content": f"Summarize the following note:\n\n{content}"},
        ]

        reply, _, _ = await self._ai.chat(messages, user_id, "notes-summarize", tools=False)
        return reply

    # ── Action item extraction ───────────────────────────────────────────────

    async def extract_actions(
        self,
        content: str,
        user_id: uuid.UUID,
    ) -> list[dict[str, Any]]:
        """Extract action items, tasks, follow-ups, and events from note content."""
        messages = [
            {"role": "system", "content": (
                "You are an action item extraction engine. Analyze the note content and extract:\n"
                "- Tasks (things to do)\n"
                "- Events (meetings, deadlines)\n"
                "- Follow-ups (people to contact)\n\n"
                "Return a JSON array of objects with these fields:\n"
                '- "type": "task" | "event" | "follow_up"\n'
                '- "title": short description\n'
                '- "assignee": person name if mentioned (or null)\n'
                '- "due_date": date if mentioned in ISO format (or null)\n'
                '- "priority": "high" | "medium" | "low"\n'
                '- "erp_action": suggested ERP action — "create_task" | "create_event" | "send_email" | null\n\n'
                "Return ONLY the JSON array, no other text."
            )},
            {"role": "user", "content": content},
        ]

        reply, _, _ = await self._ai.chat(messages, user_id, "notes-extract", tools=False)

        # Parse JSON from reply
        try:
            # Try to extract JSON array from the response
            json_match = re.search(r'\[.*\]', reply, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return json.loads(reply)
        except (json.JSONDecodeError, ValueError):
            logger.warning("Failed to parse action items JSON from AI response")
            return []

    # ── Text transformation ──────────────────────────────────────────────────

    async def transform_text(
        self,
        text: str,
        action: str,
        user_id: uuid.UUID,
        tone: str | None = None,
        target_language: str | None = None,
    ) -> str:
        """Transform text: improve, expand, simplify, translate, fix_grammar, change_tone."""
        instructions = {
            "improve": "Improve the writing quality, clarity, and flow while preserving the meaning.",
            "expand": "Expand this text with more detail, examples, and context. Make it approximately 2-3x longer.",
            "simplify": "Simplify this text. Use shorter sentences, simpler words, and remove jargon.",
            "fix_grammar": "Fix all grammar, spelling, and punctuation errors. Do not change the meaning or style.",
            "make_professional": "Rewrite in a professional, business-appropriate tone.",
            "make_casual": "Rewrite in a casual, friendly tone.",
            "translate": f"Translate this text to {target_language or 'English'}. Preserve formatting.",
            "change_tone": f"Rewrite this text in a {tone or 'professional'} tone.",
        }

        instruction = instructions.get(action, instructions["improve"])

        messages = [
            {"role": "system", "content": (
                "You are a professional writing assistant. "
                f"{instruction}\n"
                "Return ONLY the transformed text, no explanations or commentary."
            )},
            {"role": "user", "content": text},
        ]

        reply, _, _ = await self._ai.chat(messages, user_id, "notes-transform", tools=False)
        return reply

    # ── RAG Q&A over notes ───────────────────────────────────────────────────

    async def ask_notes(
        self,
        question: str,
        user_id: uuid.UUID,
        notebook_id: str | None = None,
    ) -> dict[str, Any]:
        """Answer a question using semantic search over the user's notes (RAG)."""
        # Search for relevant note chunks
        results = await embedding_svc.search(
            query_text=question,
            top_k=8,
            source_types=["note"],
            db=self.db,
        )

        if not results:
            return {
                "answer": "I couldn't find any relevant notes to answer your question. Try rephrasing or ensure your notes are indexed.",
                "sources": [],
            }

        # Build context from search results
        context_parts = []
        sources = []
        for r in results:
            if r["score"] > 0.3:  # Only include reasonably similar results
                context_parts.append(r["chunk_text"])
                sources.append({
                    "note_id": r["source_id"],
                    "chunk": r["chunk_text"][:200],
                    "score": round(r["score"], 3),
                })

        if not context_parts:
            return {
                "answer": "I found some notes but none were closely related to your question.",
                "sources": [],
            }

        context = "\n\n---\n\n".join(context_parts)

        messages = [
            {"role": "system", "content": (
                "You are Y&U Notes AI assistant. Answer the user's question based ONLY on "
                "the provided note excerpts. If the notes don't contain enough information, "
                "say so. Cite which note excerpts support your answer.\n\n"
                f"Note excerpts:\n{context}"
            )},
            {"role": "user", "content": question},
        ]

        reply, _, _ = await self._ai.chat(messages, user_id, "notes-qa", tools=False)

        return {
            "answer": reply,
            "sources": sources,
        }

    # ── Auto-suggest entity links ────────────────────────────────────────────

    async def suggest_links(
        self,
        content: str,
        user_id: uuid.UUID,
    ) -> list[dict[str, Any]]:
        """Analyze content and suggest ERP entity links."""
        messages = [
            {"role": "system", "content": (
                "Analyze the text and identify references to ERP entities. Look for:\n"
                "- Invoice numbers (INV-XXXX)\n"
                "- Project names\n"
                "- People/employee names\n"
                "- Deal/lead references\n"
                "- Ticket/issue numbers (TKT-XXXX)\n\n"
                "Return a JSON array of objects with:\n"
                '- "entity_type": "invoice" | "project" | "employee" | "deal" | "ticket"\n'
                '- "reference_text": the text that triggered the match\n'
                '- "confidence": 0.0 to 1.0\n\n'
                "Return ONLY the JSON array."
            )},
            {"role": "user", "content": content},
        ]

        reply, _, _ = await self._ai.chat(messages, user_id, "notes-links", tools=False)

        try:
            json_match = re.search(r'\[.*\]', reply, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return json.loads(reply)
        except (json.JSONDecodeError, ValueError):
            return []
