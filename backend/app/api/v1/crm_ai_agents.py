from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.models.crm_ai_agents import CRMAIAgentConfig, CRMAIAgentRun
from app.services.crm_ai_agents import approve_run, run_agent

router = APIRouter()

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class AgentConfigCreate(BaseModel):
    agent_type: str
    name: str
    description: str | None = None
    is_active: bool = True
    config: dict[str, Any] | None = None
    schedule: dict[str, Any] | None = None
    approval_required: bool = True
    max_actions_per_run: int = 10


class AgentConfigUpdate(BaseModel):
    agent_type: str | None = None
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None
    config: dict[str, Any] | None = None
    schedule: dict[str, Any] | None = None
    approval_required: bool | None = None
    max_actions_per_run: int | None = None


class AgentConfigOut(BaseModel):
    id: UUID
    agent_type: str
    name: str
    description: str | None = None
    is_active: bool
    config: dict[str, Any] | None = None
    schedule: dict[str, Any] | None = None
    approval_required: bool
    max_actions_per_run: int
    owner_id: UUID

    model_config = {"from_attributes": True}


class AgentRunOut(BaseModel):
    id: UUID
    agent_config_id: UUID
    status: str
    trigger: str
    input_data: dict[str, Any] | None = None
    output_data: dict[str, Any] | None = None
    actions_taken: dict[str, Any] | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error_message: str | None = None
    approved_by: UUID | None = None

    model_config = {"from_attributes": True}


class RunTriggerBody(BaseModel):
    input_data: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# Agent config endpoints
# ---------------------------------------------------------------------------


@router.get("/ai-agents")
async def list_agent_configs(
    current_user: CurrentUser,
    db: DBSession,
    agent_type: str | None = Query(None),
    is_active: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(CRMAIAgentConfig)
    count_query = select(func.count()).select_from(CRMAIAgentConfig)

    if agent_type is not None:
        query = query.where(CRMAIAgentConfig.agent_type == agent_type)
        count_query = count_query.where(CRMAIAgentConfig.agent_type == agent_type)
    if is_active is not None:
        query = query.where(CRMAIAgentConfig.is_active == is_active)
        count_query = count_query.where(CRMAIAgentConfig.is_active == is_active)

    total = (await db.execute(count_query)).scalar_one()
    rows = (await db.execute(query.offset(skip).limit(limit))).scalars().all()

    return {"total": total, "items": [AgentConfigOut.model_validate(r) for r in rows]}


@router.post("/ai-agents", status_code=status.HTTP_201_CREATED)
async def create_agent_config(
    body: AgentConfigCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> AgentConfigOut:
    agent = CRMAIAgentConfig(**body.model_dump(), owner_id=current_user.id)
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return AgentConfigOut.model_validate(agent)


@router.get("/ai-agents/{agent_id}")
async def get_agent_config(
    agent_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> AgentConfigOut:
    agent = await db.get(CRMAIAgentConfig, agent_id)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent config not found")
    return AgentConfigOut.model_validate(agent)


@router.put("/ai-agents/{agent_id}")
async def update_agent_config(
    agent_id: UUID,
    body: AgentConfigUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> AgentConfigOut:
    agent = await db.get(CRMAIAgentConfig, agent_id)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent config not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(agent, field, value)

    await db.commit()
    await db.refresh(agent)
    return AgentConfigOut.model_validate(agent)


@router.delete("/ai-agents/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent_config(
    agent_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    agent = await db.get(CRMAIAgentConfig, agent_id)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent config not found")

    await db.delete(agent)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Agent run endpoints
# ---------------------------------------------------------------------------


@router.post("/ai-agents/{agent_id}/run", status_code=status.HTTP_201_CREATED)
async def trigger_agent_run(
    agent_id: UUID,
    body: RunTriggerBody,
    current_user: CurrentUser,
    db: DBSession,
) -> AgentRunOut:
    agent = await db.get(CRMAIAgentConfig, agent_id)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent config not found")

    run = await run_agent(db, agent_config_id=agent_id, trigger="manual", input_data=body.input_data)
    return AgentRunOut.model_validate(run)


@router.get("/ai-agents/{agent_id}/runs")
async def list_agent_runs(
    agent_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
    run_status: str | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    base = select(CRMAIAgentRun).where(CRMAIAgentRun.agent_config_id == agent_id)
    count_base = (
        select(func.count())
        .select_from(CRMAIAgentRun)
        .where(CRMAIAgentRun.agent_config_id == agent_id)
    )

    if run_status is not None:
        base = base.where(CRMAIAgentRun.status == run_status)
        count_base = count_base.where(CRMAIAgentRun.status == run_status)

    total = (await db.execute(count_base)).scalar_one()
    rows = (await db.execute(base.offset(skip).limit(limit))).scalars().all()

    return {"total": total, "items": [AgentRunOut.model_validate(r) for r in rows]}


@router.get("/ai-agent-runs/{run_id}")
async def get_agent_run(
    run_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> AgentRunOut:
    run = await db.get(CRMAIAgentRun, run_id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent run not found")
    return AgentRunOut.model_validate(run)


@router.post("/ai-agent-runs/{run_id}/approve")
async def approve_agent_run(
    run_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> AgentRunOut:
    run = await db.get(CRMAIAgentRun, run_id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent run not found")
    if run.status != "needs_approval":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Run is not awaiting approval",
        )

    run = await approve_run(db, run_id=run_id, approver_id=current_user.id, approved=True)
    return AgentRunOut.model_validate(run)


@router.post("/ai-agent-runs/{run_id}/reject")
async def reject_agent_run(
    run_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> AgentRunOut:
    run = await db.get(CRMAIAgentRun, run_id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent run not found")
    if run.status != "needs_approval":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Run is not awaiting approval",
        )

    run = await approve_run(db, run_id=run_id, approver_id=current_user.id, approved=False)
    return AgentRunOut.model_validate(run)
