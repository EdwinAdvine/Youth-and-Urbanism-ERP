"""Verification tests for Urban Bad AI — multi-agent orchestration system.

Covers:
1. Plan parsing (valid JSON, retries on failure, fallback)
2. Tool classification / approval tiers
3. Short-circuit for single read-only tool
4. Approval flow (require_approval steps pause)
5. Financial amount extraction
6. Session memory
7. Token tracking
8. REST endpoints (GET /runs, GET /runs/{id}, POST approve, GET approvals/pending)
9. AgentEvent serialization
10. Model creation
"""
from __future__ import annotations

import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import AgentApproval, AgentRun, AgentRunStep
from app.services.agent_orchestrator import (
    AgentEvent,
    AgentOrchestrator,
    _estimate_tokens,
    _extract_financial_amount,
    _parse_json_plan,
)
from app.services.ai_tools import get_tool_approval_tier

from tests.conftest import auth_headers


# ── Helper: collect all events from an async generator ───────────────────────

async def collect_events(gen) -> list[AgentEvent]:
    events = []
    async for event in gen:
        events.append(event)
    return events


# ═══════════════════════════════════════════════════════════════════════════════
# PURE UNIT TESTS (no DB needed)
# ═══════════════════════════════════════════════════════════════════════════════


# ── 1. Plan parsing ─────────────────────────────────────────────────────────

class TestPlanParsing:
    def test_parse_valid_json_array(self):
        raw = '[{"action": "list_meetings", "args": {}, "rationale": "Show meetings"}]'
        result = _parse_json_plan(raw)
        assert result is not None
        assert len(result) == 1
        assert result[0]["action"] == "list_meetings"

    def test_parse_json_in_markdown_fences(self):
        raw = '```json\n[{"action": "check_stock_level", "args": {"sku": "X"}, "rationale": "Check stock"}]\n```'
        result = _parse_json_plan(raw)
        assert result is not None
        assert result[0]["action"] == "check_stock_level"

    def test_parse_json_embedded_in_text(self):
        raw = 'Here is the plan:\n[{"action": "get_revenue_summary", "args": {}, "rationale": "Revenue check"}]\nDone.'
        result = _parse_json_plan(raw)
        assert result is not None
        assert result[0]["action"] == "get_revenue_summary"

    def test_parse_invalid_json_returns_none(self):
        raw = "This is just plain text without any JSON."
        result = _parse_json_plan(raw)
        assert result is None

    def test_parse_empty_array_returns_empty(self):
        raw = "[]"
        result = _parse_json_plan(raw)
        assert result is not None
        assert len(result) == 0

    def test_parse_multi_step_plan(self):
        raw = json.dumps([
            {"action": "lookup_employee", "args": {"name": "John"}, "rationale": "Find employee"},
            {"action": "check_leave_balance", "args": {"employee_id": "123"}, "rationale": "Check leave"},
        ])
        result = _parse_json_plan(raw)
        assert result is not None
        assert len(result) == 2
        assert result[0]["action"] == "lookup_employee"
        assert result[1]["action"] == "check_leave_balance"


# ── 2. Tool classification ──────────────────────────────────────────────────

class TestToolClassification:
    def test_read_only_tools_are_auto_approve(self):
        read_only = [
            "list_meetings", "search_files", "lookup_employee",
            "check_leave_balance", "get_pipeline_summary",
            "get_revenue_summary", "lookup_inventory", "check_stock_level",
            "query_data", "generate_report", "summarize_email",
            "find_file", "check_availability",
        ]
        for tool in read_only:
            assert get_tool_approval_tier(tool) == "auto_approve", f"{tool} should be auto_approve"

    def test_create_update_tools_are_warn(self):
        warn_tools = [
            "create_calendar_event", "send_email", "create_invoice",
            "create_task", "create_lead", "compose_email",
            "create_purchase_order", "log_time",
        ]
        for tool in warn_tools:
            assert get_tool_approval_tier(tool) == "warn", f"{tool} should be warn"

    def test_admin_tools_are_require_approval(self):
        admin_tools = [
            "create_user", "assign_role", "make_app_admin",
            "update_ai_config", "share_file",
        ]
        for tool in admin_tools:
            assert get_tool_approval_tier(tool) == "require_approval", f"{tool} should be require_approval"

    def test_unknown_tool_defaults_to_warn(self):
        assert get_tool_approval_tier("nonexistent_tool_xyz") == "warn"


# ── 3. Financial amount extraction ──────────────────────────────────────────

class TestFinancialAmountExtraction:
    def test_extract_from_items_list(self):
        args = {"items": [{"quantity": 5, "unit_price": 100.0}]}
        assert _extract_financial_amount(args) == 500.0

    def test_extract_multiple_items(self):
        args = {"items": [
            {"quantity": 2, "unit_price": 100.0},
            {"quantity": 3, "unit_price": 50.0},
        ]}
        assert _extract_financial_amount(args) == 350.0

    def test_extract_from_direct_amount(self):
        args = {"amount": 250000}
        assert _extract_financial_amount(args) == 250000

    def test_extract_from_total(self):
        args = {"total": 999.99}
        assert _extract_financial_amount(args) == 999.99

    def test_extract_from_estimated_value(self):
        args = {"estimated_value": 75000}
        assert _extract_financial_amount(args) == 75000

    def test_returns_none_for_no_amount(self):
        args = {"name": "Test", "description": "No amount here"}
        assert _extract_financial_amount(args) is None


# ── 4. Token estimation ─────────────────────────────────────────────────────

class TestTokenEstimation:
    def test_estimates_tokens_from_messages(self):
        messages = [{"content": "Hello world"}]  # 11 chars
        estimate = _estimate_tokens(messages)
        assert estimate >= 1

    def test_includes_reply_in_estimate(self):
        messages = [{"content": "Hi"}]  # 2 chars
        reply = "Hello there, how can I help you today?"  # 38 chars
        estimate = _estimate_tokens(messages, reply)
        assert estimate == (2 + 38) // 4  # 10

    def test_minimum_is_one(self):
        messages = [{"content": ""}]
        assert _estimate_tokens(messages) == 1

    def test_long_messages_scale(self):
        messages = [{"content": "x" * 4000}]
        estimate = _estimate_tokens(messages)
        assert estimate == 1000


# ── 5. AgentEvent serialization ─────────────────────────────────────────────

class TestAgentEvent:
    def test_to_dict_with_agent(self):
        event = AgentEvent(type="agent_thinking", agent="researcher", data={"message": "Looking up..."})
        d = event.to_dict()
        assert d["type"] == "agent_thinking"
        assert d["agent"] == "researcher"
        assert d["message"] == "Looking up..."

    def test_to_dict_without_agent(self):
        event = AgentEvent(type="error", data={"message": "Something failed"})
        d = event.to_dict()
        assert d["type"] == "error"
        assert "agent" not in d
        assert d["message"] == "Something failed"

    def test_to_dict_plan_event(self):
        event = AgentEvent(
            type="plan",
            data={"run_id": "abc", "steps": [{"id": "1", "action": "list_meetings"}]},
        )
        d = event.to_dict()
        assert d["type"] == "plan"
        assert d["run_id"] == "abc"
        assert len(d["steps"]) == 1

    def test_to_dict_result_event(self):
        event = AgentEvent(
            type="result",
            data={"run_id": "xyz", "summary": "Done.", "steps_completed": ["s1", "s2"]},
        )
        d = event.to_dict()
        assert d["type"] == "result"
        assert d["summary"] == "Done."
        assert len(d["steps_completed"]) == 2

    def test_to_dict_step_completed(self):
        event = AgentEvent(
            type="step_completed",
            agent="executor",
            data={"step_id": "s1", "result": {"count": 5}},
        )
        d = event.to_dict()
        assert d["type"] == "step_completed"
        assert d["agent"] == "executor"
        assert d["result"]["count"] == 5

    def test_to_dict_approval_needed(self):
        event = AgentEvent(
            type="approval_needed",
            data={
                "run_id": "r1",
                "steps": [
                    {"id": "s1", "action": "create_user", "risk_level": "require_approval"},
                ],
            },
        )
        d = event.to_dict()
        assert d["type"] == "approval_needed"
        assert d["steps"][0]["risk_level"] == "require_approval"


# ═══════════════════════════════════════════════════════════════════════════════
# DB-DEPENDENT TESTS
# Note: These require a working async DB session. If the test infra has
# event-loop conflicts (pytest-asyncio session scope issue), run with:
#   pytest tests/test_agent.py -k "not db_" to skip these.
# ═══════════════════════════════════════════════════════════════════════════════


# ── 6. Model creation and relationships ──────────────────────────────────────

@pytest.mark.asyncio
async def test_agent_run_model(db: AsyncSession, test_user):
    """AgentRun can be created and persisted with all fields."""
    run = AgentRun(
        user_id=test_user.id,
        session_id="test-session-123",
        prompt="Show revenue summary",
        status="planning",
        page_context={"module": "finance", "route": "/finance"},
    )
    db.add(run)
    await db.flush()

    assert run.id is not None
    assert run.total_llm_calls == 0
    assert run.total_tool_calls == 0
    assert run.total_tokens_used == 0


@pytest.mark.asyncio
async def test_agent_run_step_model(db: AsyncSession, test_user):
    """AgentRunStep can be created linked to an AgentRun."""
    run = AgentRun(
        user_id=test_user.id,
        session_id="test-session-456",
        prompt="Create an invoice",
        status="planning",
    )
    db.add(run)
    await db.flush()

    step = AgentRunStep(
        run_id=run.id,
        agent="orchestrator",
        action="create_invoice",
        input_data={"customer": "Acme Corp", "amount": 5000},
        status="pending",
        approval_tier="warn",
    )
    db.add(step)
    await db.flush()

    assert step.id is not None
    assert step.run_id == run.id


@pytest.mark.asyncio
async def test_agent_approval_model(db: AsyncSession, test_user):
    """AgentApproval can be created linked to a run and step."""
    run = AgentRun(
        user_id=test_user.id,
        session_id="test-session-789",
        prompt="Create a new user",
        status="awaiting_approval",
    )
    db.add(run)
    await db.flush()

    step = AgentRunStep(
        run_id=run.id,
        agent="executor",
        action="create_user",
        status="awaiting_approval",
        approval_tier="require_approval",
    )
    db.add(step)
    await db.flush()

    approval = AgentApproval(
        run_id=run.id,
        step_id=step.id,
        user_id=test_user.id,
        action_description="Create user new@test.com",
        risk_level="require_approval",
        status="pending",
    )
    db.add(approval)
    await db.flush()

    assert approval.id is not None
    assert approval.status == "pending"


# ── 7. REST endpoints ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_agent_runs_empty(client: AsyncClient, test_user):
    """GET /api/v1/agent/runs returns empty list when no runs exist."""
    headers = auth_headers(test_user)
    resp = await client.get("/api/v1/agent/runs", headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_get_agent_run_not_found(client: AsyncClient, test_user):
    """GET /api/v1/agent/runs/{id} returns 404 for non-existent run."""
    headers = auth_headers(test_user)
    fake_id = str(uuid.uuid4())
    resp = await client.get(f"/api/v1/agent/runs/{fake_id}", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_pending_approvals_empty(client: AsyncClient, test_user):
    """GET /api/v1/agent/approvals/pending returns empty list."""
    headers = auth_headers(test_user)
    resp = await client.get("/api/v1/agent/approvals/pending", headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_approve_run_not_found(client: AsyncClient, test_user):
    """POST /api/v1/agent/runs/{id}/approve returns 404 for non-existent run."""
    headers = auth_headers(test_user)
    fake_id = str(uuid.uuid4())
    resp = await client.post(
        f"/api/v1/agent/runs/{fake_id}/approve",
        json={"step_ids": [str(uuid.uuid4())], "decision": "approve"},
        headers=headers,
    )
    assert resp.status_code == 404


# ── 8. Orchestrator integration (mocked AI + DB) ────────────────────────────

@pytest.mark.asyncio
async def test_short_circuit_single_read_only(db: AsyncSession, test_user):
    """Single auto_approve tool should skip Researcher + Verifier."""
    mock_ai = MagicMock()
    plan_json = json.dumps([{"action": "list_meetings", "args": {"date": "today"}, "rationale": "Show meetings"}])
    mock_ai.chat = AsyncMock(side_effect=[
        (plan_json, "ollama", "llama3"),
        ("Here are your meetings.", "ollama", "llama3"),
    ])

    mock_tool_executor = AsyncMock()
    mock_tool_executor.execute = AsyncMock(return_value={"meetings": []})

    with patch("app.services.agent_orchestrator.ToolExecutor", return_value=mock_tool_executor), \
         patch("app.services.agent_orchestrator.get_user_permissions", new_callable=AsyncMock, return_value=[]):
        orchestrator = AgentOrchestrator(db, test_user, mock_ai)
        events = await collect_events(orchestrator.run("Show my meetings", "test-session"))

    event_types = [e.type for e in events]
    assert "plan" in event_types
    assert "step_started" in event_types
    assert "step_completed" in event_types
    assert "result" in event_types
    # Researcher and verifier thinking should NOT appear for short-circuit
    thinking_agents = [e.agent for e in events if e.type == "agent_thinking"]
    assert "researcher" not in thinking_agents
    assert "verifier" not in thinking_agents


@pytest.mark.asyncio
async def test_no_tool_fallback(db: AsyncSession, test_user):
    """When plan parsing fails 3 times, should fall back to _no_tool."""
    mock_ai = MagicMock()
    mock_ai.chat = AsyncMock(return_value=("I cannot help with that request.", "ollama", "llama3"))

    with patch("app.services.agent_orchestrator.ToolExecutor"), \
         patch("app.services.agent_orchestrator.get_user_permissions", new_callable=AsyncMock, return_value=[]):
        orchestrator = AgentOrchestrator(db, test_user, mock_ai)
        events = await collect_events(orchestrator.run("Do something impossible", "test-session"))

    event_types = [e.type for e in events]
    assert "result" in event_types
    result_event = next(e for e in events if e.type == "result")
    assert result_event.data.get("summary", "") != ""


@pytest.mark.asyncio
async def test_token_tracking_accumulates(db: AsyncSession, test_user):
    """Token usage should be estimated and accumulated during orchestration."""
    mock_ai = MagicMock()
    plan_json = json.dumps([{"action": "list_meetings", "args": {}, "rationale": "Show meetings"}])
    mock_ai.chat = AsyncMock(side_effect=[
        (plan_json, "ollama", "llama3"),
        ("Your meetings are listed.", "ollama", "llama3"),
    ])

    mock_tool_executor = AsyncMock()
    mock_tool_executor.execute = AsyncMock(return_value={"meetings": []})

    with patch("app.services.agent_orchestrator.ToolExecutor", return_value=mock_tool_executor), \
         patch("app.services.agent_orchestrator.get_user_permissions", new_callable=AsyncMock, return_value=[]):
        orchestrator = AgentOrchestrator(db, test_user, mock_ai)
        await collect_events(orchestrator.run("Show meetings", "test-session"))

    assert orchestrator._tokens_accumulated > 0


@pytest.mark.asyncio
async def test_approval_flow_pauses(db: AsyncSession, superadmin_user):
    """Steps with require_approval tier should pause for user approval."""
    mock_ai = MagicMock()
    plan_json = json.dumps([
        {"action": "create_user", "args": {"email": "new@test.com"}, "rationale": "Create new user"},
    ])
    mock_ai.chat = AsyncMock(side_effect=[
        (plan_json, "ollama", "llama3"),
        ("Research complete.", "ollama", "llama3"),
        ("Completed the operation.", "ollama", "llama3"),
    ])

    mock_tool_executor = AsyncMock()
    mock_tool_executor.execute = AsyncMock(return_value={"user_id": "new-uuid"})

    with patch("app.services.agent_orchestrator.ToolExecutor", return_value=mock_tool_executor), \
         patch("app.services.agent_orchestrator.get_user_permissions", new_callable=AsyncMock, return_value=["admin.users.create"]):
        orchestrator = AgentOrchestrator(db, superadmin_user, mock_ai)
        events = await collect_events(orchestrator.run("Create user new@test.com", "test-session"))

    event_types = [e.type for e in events]
    assert "approval_needed" in event_types

    approval_event = next(e for e in events if e.type == "approval_needed")
    assert len(approval_event.data["steps"]) >= 1
    assert approval_event.data["steps"][0]["action"] == "create_user"
