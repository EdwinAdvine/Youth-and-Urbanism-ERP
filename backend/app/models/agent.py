"""Urban Bad AI — Multi-agent orchestration models."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class AgentRun(Base, UUIDPrimaryKeyMixin):
    """Top-level record for a single multi-agent orchestration run."""

    __tablename__ = "agent_runs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    session_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="planning",
        comment="planning | researching | verifying | executing | awaiting_approval | completed | failed",
    )
    plan: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    result_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider: Mapped[str | None] = mapped_column(String(30), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    total_llm_calls: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_tool_calls: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_tokens_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    page_context: Mapped[dict | None] = mapped_column(
        JSON, nullable=True,
        comment="Current route + selected record when prompt was sent",
    )
    message_history: Mapped[list | None] = mapped_column(
        JSON, nullable=True, default=list,
        comment="Last 3-5 messages for session memory / context continuity",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    user = relationship("User", foreign_keys=[user_id])
    steps = relationship("AgentRunStep", back_populates="run", cascade="all, delete-orphan", order_by="AgentRunStep.created_at")

    def __repr__(self) -> str:
        return f"<AgentRun id={self.id} status={self.status}>"


class AgentRunStep(Base, UUIDPrimaryKeyMixin):
    """Individual step within an agent run (one per agent action)."""

    __tablename__ = "agent_run_steps"

    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agent_runs.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    agent: Mapped[str] = mapped_column(
        String(30), nullable=False,
        comment="orchestrator | researcher | executor | verifier",
    )
    action: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="Tool name or internal action (plan, research, verify, summarize)",
    )
    input_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    output_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="pending",
        comment="pending | running | completed | failed | skipped | awaiting_approval | approved | rejected",
    )
    approval_tier: Mapped[str | None] = mapped_column(
        String(30), nullable=True,
        comment="auto_approve | warn | require_approval",
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    run = relationship("AgentRun", back_populates="steps")

    def __repr__(self) -> str:
        return f"<AgentRunStep id={self.id} agent={self.agent} action={self.action} status={self.status}>"


class AgentApproval(Base, UUIDPrimaryKeyMixin):
    """Pending approval record for a sensitive agent action."""

    __tablename__ = "agent_approvals"

    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agent_runs.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    step_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agent_run_steps.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    action_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    risk_level: Mapped[str] = mapped_column(
        String(30), nullable=False,
        comment="warn | require_approval",
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending",
        comment="pending | approved | rejected",
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    run = relationship("AgentRun", foreign_keys=[run_id])
    step = relationship("AgentRunStep", foreign_keys=[step_id])
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<AgentApproval id={self.id} status={self.status}>"
