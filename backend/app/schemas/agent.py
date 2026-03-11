"""Pydantic schemas for Urban Bad AI multi-agent system."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


# ── Plan step (LLM output) ──────────────────────────────────────────────────
class PlanStepSchema(BaseModel):
    action: str = Field(..., description="Tool name to invoke")
    args: dict[str, Any] = Field(default_factory=dict, description="Tool arguments")
    rationale: str = Field("", description="Why this step is needed")


# ── WebSocket messages ───────────────────────────────────────────────────────
class AgentPromptMessage(BaseModel):
    type: Literal["prompt"] = "prompt"
    message: str = Field(..., min_length=1, max_length=32_000)
    context: dict[str, Any] | None = None


class AgentApprovalMessage(BaseModel):
    type: Literal["approve"] = "approve"
    run_id: uuid.UUID
    step_ids: list[uuid.UUID]
    decision: Literal["approve", "reject"]


# ── REST request/response ───────────────────────────────────────────────────
class ApprovalDecision(BaseModel):
    step_ids: list[uuid.UUID]
    decision: Literal["approve", "reject"]


class AgentRunStepOut(BaseModel):
    id: uuid.UUID
    agent: str
    action: str
    status: str
    approval_tier: str | None = None
    input_data: dict[str, Any] | None = None
    output_data: dict[str, Any] | None = None
    error: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentRunOut(BaseModel):
    id: uuid.UUID
    prompt: str
    status: str
    plan: list[dict[str, Any]] | None = None
    result_summary: str | None = None
    provider: str | None = None
    model: str | None = None
    total_llm_calls: int = 0
    total_tool_calls: int = 0
    total_tokens_used: int = 0
    page_context: dict[str, Any] | None = None
    created_at: datetime
    completed_at: datetime | None = None
    steps: list[AgentRunStepOut] = []

    model_config = {"from_attributes": True}


class AgentApprovalOut(BaseModel):
    id: uuid.UUID
    run_id: uuid.UUID
    step_id: uuid.UUID
    action_description: str
    risk_level: str
    status: str
    decided_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
