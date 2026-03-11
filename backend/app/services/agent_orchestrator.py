"""Urban Bad AI — Multi-agent orchestration engine.

4-agent Society of Mind: Orchestrator → Researcher + Verifier (parallel) → Executor → Summarize.
All agents run in-process as async functions sharing the same DB session, user context, and LLM config.
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, AsyncGenerator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import get_user_permissions
from app.models.agent import AgentApproval, AgentRun, AgentRunStep
from app.models.settings import SystemSettings
from app.models.user import User
from app.schemas.agent import PlanStepSchema
from app.services.agent_prompts import (
    ORCHESTRATOR_SUMMARIZE_PROMPT,
    ORCHESTRATOR_SYSTEM_PROMPT,
    RESEARCHER_SYSTEM_PROMPT,
)
from app.services.ai import AIService
from app.services.ai_tools import (
    ADMIN_TOOL_DEFINITIONS,
    TOOL_DEFINITIONS,
    ToolExecutor,
    get_tool_approval_tier,
)

logger = logging.getLogger(__name__)

MAX_PLAN_RETRIES = 2
MAX_SESSION_MEMORY = 5


# ── Event types streamed to the client ───────────────────────────────────────

@dataclass
class AgentEvent:
    """Event streamed to the WebSocket client during an agent run."""
    type: str  # plan | agent_thinking | step_started | step_completed | approval_needed | result | error
    agent: str | None = None  # orchestrator | researcher | executor | verifier
    data: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"type": self.type}
        if self.agent:
            d["agent"] = self.agent
        d.update(self.data)
        return d


# ── Helpers ──────────────────────────────────────────────────────────────────

def _estimate_tokens(messages: list[dict[str, str]], reply: str = "") -> int:
    """Rough token estimate: ~4 chars per token (standard approximation)."""
    total_chars = sum(len(m.get("content", "")) for m in messages) + len(reply)
    return max(1, total_chars // 4)


def _build_tool_list_str(include_admin: bool = False) -> str:
    """Build a compact tool name list for the Orchestrator prompt."""
    tools = list(TOOL_DEFINITIONS)
    if include_admin:
        tools.extend(ADMIN_TOOL_DEFINITIONS)
    names = [t["function"]["name"] for t in tools]
    return ", ".join(names)


def _parse_json_plan(text: str) -> list[dict[str, Any]] | None:
    """Try to parse the LLM output as a JSON array of plan steps."""
    text = text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines).strip()

    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass

    # Try to find a JSON array within the text
    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end != -1 and end > start:
        try:
            parsed = json.loads(text[start : end + 1])
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError:
            pass

    return None


async def _get_financial_thresholds(db: AsyncSession) -> dict[str, float]:
    """Load configurable financial thresholds from SystemSettings."""
    defaults = {
        "invoice_amount": 500_000,
        "payment_amount": 500_000,
        "purchase_order": 1_000_000,
    }
    result = await db.execute(
        select(SystemSettings).where(
            SystemSettings.key.like("agent.approval_threshold.%")
        )
    )
    rows = result.scalars().all()
    for row in rows:
        key = row.key.replace("agent.approval_threshold.", "")
        try:
            defaults[key] = float(row.value)
        except (ValueError, TypeError):
            pass
    return defaults


def _extract_financial_amount(args: dict[str, Any]) -> float | None:
    """Try to extract a monetary amount from tool arguments."""
    # Check items list (invoices, POs)
    items = args.get("items")
    if isinstance(items, list):
        total = 0.0
        for item in items:
            if isinstance(item, dict):
                qty = item.get("quantity", 1)
                price = item.get("unit_price", 0)
                try:
                    total += float(qty) * float(price)
                except (ValueError, TypeError):
                    pass
        if total > 0:
            return total

    # Check direct amount fields
    for key in ("amount", "estimated_value", "value", "total"):
        if key in args:
            try:
                return float(args[key])
            except (ValueError, TypeError):
                pass
    return None


# ── Main orchestrator ────────────────────────────────────────────────────────

class AgentOrchestrator:
    """Multi-agent orchestration engine for Urban Bad AI."""

    def __init__(self, db: AsyncSession, user: User, ai_service: AIService):
        self.db = db
        self.user = user
        self.ai = ai_service
        self.is_admin = getattr(user, "is_superadmin", False) or getattr(user, "role", "") == "superadmin"
        self.tool_executor = ToolExecutor(db, user.id, user=user)
        self._tokens_accumulated = 0

    async def _chat_and_track(
        self,
        messages: list[dict[str, str]],
        session_id: str,
    ) -> tuple[str, str, str]:
        """Wrapper around ai.chat() that tracks estimated token usage."""
        reply, provider, model = await self.ai.chat(messages, self.user.id, session_id)
        self._tokens_accumulated += _estimate_tokens(messages, reply)
        return reply, provider, model

    # ── Public API ───────────────────────────────────────────────────────────

    async def run(
        self,
        prompt: str,
        session_id: str,
        page_context: dict[str, Any] | None = None,
    ) -> AsyncGenerator[AgentEvent, None]:
        """Main entry point. Yields AgentEvent objects for WebSocket streaming."""

        # 1. Build context
        user_perms = await get_user_permissions(self.db, str(self.user.id))
        admin_scopes: list[str] = []
        if hasattr(self.user, "app_admin_scopes"):
            admin_scopes = self.user.app_admin_scopes or []

        user_context = {
            "role": getattr(self.user, "role", "user"),
            "is_superadmin": self.is_admin,
            "permissions": list(user_perms),
            "app_admin_scopes": admin_scopes,
        }

        # Load session memory (last N messages from previous runs)
        session_memory = await self._load_session_memory(session_id)

        # 2. Create AgentRun record
        run = AgentRun(
            user_id=self.user.id,
            session_id=session_id,
            prompt=prompt,
            status="planning",
            page_context=page_context,
            message_history=session_memory,
        )
        self.db.add(run)
        await self.db.flush()

        try:
            # 3. ORCHESTRATOR PHASE — Plan generation
            yield AgentEvent(type="agent_thinking", agent="orchestrator", data={"message": "Analyzing your request..."})

            plan_steps = await self._orchestrator_plan(prompt, page_context, user_context, session_memory)

            if not plan_steps:
                run.status = "failed"
                run.result_summary = "Could not create an execution plan for your request."
                run.total_tokens_used = self._tokens_accumulated
                await self.db.commit()
                yield AgentEvent(type="error", data={"message": run.result_summary})
                return

            # Check for _no_tool response
            if len(plan_steps) == 1 and plan_steps[0].get("action") == "_no_tool":
                run.status = "completed"
                run.result_summary = plan_steps[0].get("rationale", "This request cannot be fulfilled with available tools.")
                run.plan = [s for s in plan_steps]
                run.total_tokens_used = self._tokens_accumulated
                await self.db.commit()
                yield AgentEvent(type="result", data={"run_id": str(run.id), "summary": run.result_summary, "steps_completed": []})
                return

            run.plan = plan_steps
            run.total_llm_calls += 1

            # Create AgentRunStep records
            step_records: list[AgentRunStep] = []
            for step_data in plan_steps:
                step = AgentRunStep(
                    run_id=run.id,
                    agent="orchestrator",
                    action=step_data.get("action", "unknown"),
                    input_data=step_data.get("args", {}),
                    status="pending",
                )
                self.db.add(step)
                step_records.append(step)
            await self.db.flush()

            yield AgentEvent(
                type="plan",
                data={
                    "run_id": str(run.id),
                    "steps": [
                        {"id": str(s.id), "action": s.action, "args": s.input_data, "rationale": plan_steps[i].get("rationale", "")}
                        for i, s in enumerate(step_records)
                    ],
                },
            )

            # 4. SHORT-CIRCUIT: single read-only step
            if len(step_records) == 1 and get_tool_approval_tier(step_records[0].action) == "auto_approve":
                step = step_records[0]
                run.status = "executing"
                step.status = "running"
                step.agent = "executor"
                step.started_at = datetime.now(UTC)
                await self.db.flush()

                yield AgentEvent(type="step_started", agent="executor", data={"step_id": str(step.id), "action": step.action})
                result = await self._execute_step(step)
                yield AgentEvent(type="step_completed", agent="executor", data={"step_id": str(step.id), "result": result})

                run.total_tool_calls += 1
                summary = await self._orchestrator_summarize(prompt, [{**plan_steps[0], "result": result}])
                run.total_llm_calls += 1
                run.status = "completed"
                run.result_summary = summary
                run.completed_at = datetime.now(UTC)
                await self._save_session_memory(run, prompt, summary)
                run.total_tokens_used = self._tokens_accumulated
                await self.db.commit()

                yield AgentEvent(type="result", data={"run_id": str(run.id), "summary": summary, "steps_completed": [str(step.id)]})
                return

            # 5. PARALLEL PHASE — Researcher + Verifier
            run.status = "researching"
            await self.db.flush()

            researcher_results, verifier_results = await asyncio.gather(
                self._researcher_phase(plan_steps, step_records, run),
                self._verifier_phase(plan_steps, step_records, user_context, run),
            )

            # Yield thinking events for both agents
            for msg in researcher_results.get("thinking_messages", []):
                yield AgentEvent(type="agent_thinking", agent="researcher", data={"message": msg})
            for msg in verifier_results.get("thinking_messages", []):
                yield AgentEvent(type="agent_thinking", agent="verifier", data={"message": msg})

            # 6. Check for approvals
            approval_needed: list[AgentRunStep] = []
            blocked: list[AgentRunStep] = []
            auto_steps: list[AgentRunStep] = []

            for i, step in enumerate(step_records):
                verdict = verifier_results.get("verdicts", {}).get(str(step.id), {})
                tier = verdict.get("tier", "warn")
                approved = verdict.get("approved", True)
                step.approval_tier = tier

                if not approved:
                    step.status = "skipped"
                    step.error = verdict.get("reason", "Blocked by Verifier")
                    blocked.append(step)
                elif tier == "require_approval":
                    step.status = "awaiting_approval"
                    approval_needed.append(step)
                    # Create approval record
                    approval = AgentApproval(
                        run_id=run.id,
                        step_id=step.id,
                        user_id=self.user.id,
                        action_description=f"{step.action}: {json.dumps(step.input_data, default=str)[:200]}",
                        risk_level=tier,
                        status="pending",
                    )
                    self.db.add(approval)
                else:
                    auto_steps.append(step)

            await self.db.flush()

            if approval_needed:
                run.status = "awaiting_approval"
                run.total_tokens_used = self._tokens_accumulated
                await self.db.commit()
                yield AgentEvent(
                    type="approval_needed",
                    data={
                        "run_id": str(run.id),
                        "steps": [
                            {
                                "id": str(s.id),
                                "action": s.action,
                                "args": s.input_data,
                                "risk_level": s.approval_tier,
                                "description": f"{s.action} with {json.dumps(s.input_data, default=str)[:200]}",
                            }
                            for s in approval_needed
                        ],
                    },
                )
                # Don't return — continue executing auto-approve steps below

            # 7. EXECUTOR PHASE — Execute approved steps
            run.status = "executing"
            await self.db.flush()

            completed_results: list[dict[str, Any]] = []
            for i, step in enumerate(auto_steps):
                step.status = "running"
                step.agent = "executor"
                step.started_at = datetime.now(UTC)
                await self.db.flush()

                yield AgentEvent(type="step_started", agent="executor", data={"step_id": str(step.id), "action": step.action})

                result = await self._execute_step(step)
                run.total_tool_calls += 1

                yield AgentEvent(type="step_completed", agent="executor", data={"step_id": str(step.id), "result": result})
                completed_results.append({**plan_steps[step_records.index(step)], "result": result})

            # 8. ORCHESTRATOR PHASE — Summarize (only if no pending approvals, or partial summary)
            if not approval_needed:
                run.status = "completed"
            summary = await self._orchestrator_summarize(prompt, completed_results, blocked)
            run.total_llm_calls += 1
            run.result_summary = summary
            if not approval_needed:
                run.completed_at = datetime.now(UTC)
            await self._save_session_memory(run, prompt, summary)
            run.total_tokens_used = self._tokens_accumulated
            await self.db.commit()

            yield AgentEvent(
                type="result",
                data={
                    "run_id": str(run.id),
                    "summary": summary,
                    "steps_completed": [str(s.id) for s in auto_steps if s.status == "completed"],
                    "steps_pending_approval": [str(s.id) for s in approval_needed],
                },
            )

        except Exception as exc:
            logger.exception("Agent orchestration failed: %s", exc)
            run.status = "failed"
            run.result_summary = f"An error occurred: {exc}"
            run.total_tokens_used = self._tokens_accumulated
            await self.db.commit()
            yield AgentEvent(type="error", data={"message": str(exc)})

    async def resume_after_approval(
        self,
        run_id: uuid.UUID,
        step_ids: list[uuid.UUID],
        decision: str,
    ) -> AsyncGenerator[AgentEvent, None]:
        """Resume execution after user approves/rejects pending steps."""
        run = await self.db.get(AgentRun, run_id)
        if not run or str(run.user_id) != str(self.user.id):
            yield AgentEvent(type="error", data={"message": "Run not found"})
            return

        # Load steps
        result = await self.db.execute(
            select(AgentRunStep).where(
                AgentRunStep.run_id == run_id,
                AgentRunStep.id.in_(step_ids),
            )
        )
        steps = list(result.scalars().all())

        # Update approval records
        approval_result = await self.db.execute(
            select(AgentApproval).where(
                AgentApproval.run_id == run_id,
                AgentApproval.step_id.in_(step_ids),
            )
        )
        approvals = list(approval_result.scalars().all())
        for a in approvals:
            a.status = "approved" if decision == "approve" else "rejected"
            a.decided_at = datetime.now(UTC)

        completed_results: list[dict[str, Any]] = []

        if decision == "approve":
            run.status = "executing"
            await self.db.flush()

            for step in steps:
                step.status = "approved"
                step.agent = "executor"
                step.started_at = datetime.now(UTC)
                await self.db.flush()

                yield AgentEvent(type="step_started", agent="executor", data={"step_id": str(step.id), "action": step.action})
                exec_result = await self._execute_step(step)
                run.total_tool_calls += 1
                yield AgentEvent(type="step_completed", agent="executor", data={"step_id": str(step.id), "result": exec_result})
                completed_results.append({"action": step.action, "args": step.input_data, "result": exec_result})
        else:
            for step in steps:
                step.status = "rejected"
                step.completed_at = datetime.now(UTC)

        # Check if all steps are now resolved
        all_steps_result = await self.db.execute(
            select(AgentRunStep).where(AgentRunStep.run_id == run_id)
        )
        all_steps = list(all_steps_result.scalars().all())
        still_pending = any(s.status == "awaiting_approval" for s in all_steps)

        if not still_pending:
            run.status = "completed"
            run.completed_at = datetime.now(UTC)

        summary = await self._orchestrator_summarize(
            run.prompt,
            completed_results,
            [s for s in steps if s.status == "rejected"],
        )
        run.total_llm_calls += 1
        if run.result_summary:
            run.result_summary += f"\n\n{summary}"
        else:
            run.result_summary = summary
        run.total_tokens_used = (run.total_tokens_used or 0) + self._tokens_accumulated
        await self.db.commit()

        yield AgentEvent(
            type="result",
            data={
                "run_id": str(run.id),
                "summary": summary,
                "steps_completed": [str(s.id) for s in steps if s.status == "completed"],
            },
        )

    # ── Internal agent phases ────────────────────────────────────────────────

    async def _orchestrator_plan(
        self,
        prompt: str,
        page_context: dict[str, Any] | None,
        user_context: dict[str, Any],
        session_memory: list[dict[str, str]],
    ) -> list[dict[str, Any]] | None:
        """Call the Orchestrator agent to generate a plan."""
        tool_list = _build_tool_list_str(include_admin=self.is_admin)

        system_content = ORCHESTRATOR_SYSTEM_PROMPT + f"\n\nAvailable tools: {tool_list}"
        if page_context:
            system_content += f"\n\nCurrent page context: {json.dumps(page_context)}"
        if user_context:
            system_content += f"\n\nUser context: role={user_context['role']}, admin_scopes={user_context['app_admin_scopes']}"

        messages: list[dict[str, str]] = [{"role": "system", "content": system_content}]

        # Add session memory for context continuity
        for mem in session_memory[-MAX_SESSION_MEMORY:]:
            messages.append(mem)

        messages.append({"role": "user", "content": prompt})

        last_error = ""
        for attempt in range(MAX_PLAN_RETRIES + 1):
            if attempt > 0:
                messages.append({
                    "role": "user",
                    "content": f"Your previous response was not valid JSON. Error: {last_error}. Please output ONLY a valid JSON array.",
                })

            reply, provider, model = await self._chat_and_track(
                messages, f"agent-plan-{uuid.uuid4().hex[:8]}"
            )

            parsed = _parse_json_plan(reply)
            if parsed is not None:
                # Validate each step
                validated = []
                for step in parsed:
                    try:
                        s = PlanStepSchema(**step)
                        validated.append(s.model_dump())
                    except Exception:
                        validated.append(step)  # Keep raw if validation fails
                return validated

            last_error = f"Could not parse JSON from: {reply[:200]}"

        # Final fallback: treat as a general query
        return [{"action": "_no_tool", "args": {}, "rationale": reply[:500]}]

    async def _researcher_phase(
        self,
        plan_steps: list[dict[str, Any]],
        step_records: list[AgentRunStep],
        run: AgentRun,
    ) -> dict[str, Any]:
        """Researcher agent: gather data for planned steps using read-only tools."""
        thinking_messages: list[str] = []
        findings: dict[str, Any] = {}

        # Only research steps that need data
        for i, step_data in enumerate(plan_steps):
            action = step_data.get("action", "")
            tier = get_tool_approval_tier(action)

            # Read-only tools don't need research
            if tier == "auto_approve":
                continue

            thinking_messages.append(f"Gathering context for: {action}")

            # Ask Researcher to find relevant data
            messages = [
                {"role": "system", "content": RESEARCHER_SYSTEM_PROMPT},
                {"role": "user", "content": f"The planned action is: {action} with args {json.dumps(step_data.get('args', {}), default=str)}. What relevant ERP data should we check?"},
            ]

            try:
                reply, _, _ = await self._chat_and_track(
                    messages, f"agent-research-{uuid.uuid4().hex[:8]}"
                )
                run.total_llm_calls += 1
                findings[str(step_records[i].id)] = reply
            except Exception as exc:
                logger.warning("Researcher failed for step %s: %s", action, exc)
                findings[str(step_records[i].id)] = None

        return {"thinking_messages": thinking_messages, "findings": findings}

    async def _verifier_phase(
        self,
        plan_steps: list[dict[str, Any]],
        step_records: list[AgentRunStep],
        user_context: dict[str, Any],
        run: AgentRun,
    ) -> dict[str, Any]:
        """Verifier agent: check permissions and classify each step."""
        thinking_messages: list[str] = []
        verdicts: dict[str, dict[str, Any]] = {}
        thresholds = await _get_financial_thresholds(self.db)

        for i, step_data in enumerate(plan_steps):
            action = step_data.get("action", "")
            args = step_data.get("args", {})
            step = step_records[i]

            # Start with the tool's default tier
            tier = get_tool_approval_tier(action)
            approved = True
            reason = "Action permitted"

            thinking_messages.append(f"Checking permissions for: {action}")

            # Dynamic checks

            # 1. Module permission check
            module_map = {
                "create_invoice": "finance", "get_revenue_summary": "finance", "financial_forecast": "finance",
                "detect_anomalies": "finance",
                "create_lead": "crm", "get_pipeline_summary": "crm", "score_lead": "crm",
                "create_task": "projects", "log_time": "projects", "analyze_project_risk": "projects",
                "lookup_employee": "hr", "check_leave_balance": "hr", "predict_attrition": "hr",
                "lookup_inventory": "inventory", "check_stock_level": "inventory", "create_purchase_order": "inventory",
                "demand_forecast": "inventory",
                "create_user": "admin", "assign_role": "admin", "make_app_admin": "admin",
                "deactivate_user": "admin",
            }
            module = module_map.get(action)
            if module:
                if module == "admin" and not user_context.get("is_superadmin"):
                    approved = False
                    reason = f"Only Super Admins can use {action}"
                elif module in ("finance", "hr", "crm", "projects", "inventory"):
                    # Check if user has module access (admin or via permissions)
                    has_access = (
                        user_context.get("is_superadmin")
                        or module in user_context.get("app_admin_scopes", [])
                        or any(p.startswith(f"{module}.") for p in user_context.get("permissions", []))
                    )
                    if not has_access and tier != "auto_approve":
                        approved = False
                        reason = f"You don't have access to the {module} module"

            # 2. Financial threshold escalation
            if tier == "warn" and action in ("create_invoice", "create_purchase_order"):
                amount = _extract_financial_amount(args)
                threshold_key = "invoice_amount" if action == "create_invoice" else "purchase_order"
                threshold = thresholds.get(threshold_key, 500_000)
                if amount and amount > threshold:
                    tier = "require_approval"
                    reason = f"Amount {amount:,.0f} exceeds threshold {threshold:,.0f}"

            # 3. Admin tools always require approval
            if action in ("create_user", "assign_role", "make_app_admin", "deactivate_user", "update_ai_config"):
                tier = "require_approval"
                if not user_context.get("is_superadmin"):
                    approved = False
                    reason = f"Only Super Admins can use {action}"

            verdicts[str(step.id)] = {
                "approved": approved,
                "tier": tier,
                "reason": reason,
            }

        return {"thinking_messages": thinking_messages, "verdicts": verdicts}

    async def _execute_step(self, step: AgentRunStep) -> dict[str, Any]:
        """Execute a single tool call via the existing ToolExecutor."""
        action = step.action
        args = step.input_data or {}

        try:
            result = await self.tool_executor.execute(action, args)
            step.status = "completed"
            step.output_data = result
            step.completed_at = datetime.now(UTC)
            return result
        except Exception as exc:
            logger.warning("Tool execution failed: %s(%s) -> %s", action, args, exc)
            step.status = "failed"
            step.error = str(exc)
            step.completed_at = datetime.now(UTC)
            return {"error": str(exc)}

    async def _orchestrator_summarize(
        self,
        original_prompt: str,
        completed_results: list[dict[str, Any]],
        blocked_steps: list[AgentRunStep] | None = None,
    ) -> str:
        """Call the Orchestrator agent to summarize results."""
        content = f"User's request: {original_prompt}\n\nResults:\n"
        for r in completed_results:
            content += f"- {r.get('action', '?')}: {json.dumps(r.get('result', {}), default=str)[:300]}\n"
        if blocked_steps:
            content += "\nBlocked/Skipped steps:\n"
            for s in blocked_steps:
                content += f"- {s.action}: {s.error or 'rejected'}\n"

        messages = [
            {"role": "system", "content": ORCHESTRATOR_SUMMARIZE_PROMPT},
            {"role": "user", "content": content},
        ]

        try:
            reply, _, _ = await self._chat_and_track(
                messages, f"agent-summary-{uuid.uuid4().hex[:8]}"
            )
            return reply
        except Exception as exc:
            logger.warning("Summary generation failed: %s", exc)
            # Fallback: manual summary
            actions = [r.get("action", "?") for r in completed_results]
            return f"Completed {len(completed_results)} action(s): {', '.join(actions)}."

    # ── Session memory ───────────────────────────────────────────────────────

    async def _load_session_memory(self, session_id: str) -> list[dict[str, str]]:
        """Load last N messages from previous runs in this session."""
        result = await self.db.execute(
            select(AgentRun)
            .where(AgentRun.session_id == session_id, AgentRun.user_id == self.user.id)
            .order_by(AgentRun.created_at.desc())
            .limit(MAX_SESSION_MEMORY)
        )
        runs = list(result.scalars().all())
        runs.reverse()  # Oldest first

        memory: list[dict[str, str]] = []
        for r in runs:
            if r.prompt:
                memory.append({"role": "user", "content": r.prompt})
            if r.result_summary:
                memory.append({"role": "assistant", "content": r.result_summary})
        return memory[-MAX_SESSION_MEMORY * 2 :]  # Keep last N pairs

    async def _save_session_memory(self, run: AgentRun, prompt: str, summary: str) -> None:
        """Save the current prompt + summary to the run's message_history."""
        history = run.message_history or []
        history.append({"role": "user", "content": prompt})
        history.append({"role": "assistant", "content": summary})
        run.message_history = history[-MAX_SESSION_MEMORY * 2 :]
