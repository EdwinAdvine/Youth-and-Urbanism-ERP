"""Urban Bad AI — WebSocket + REST endpoints for multi-agent orchestration."""
from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import CurrentUser
from app.core.security import decode_token
from app.models.agent import AgentApproval, AgentRun
from app.models.user import User
from app.schemas.agent import AgentApprovalOut, AgentRunOut, ApprovalDecision
from app.services.agent_orchestrator import AgentOrchestrator
from app.services.ai import AIService

router = APIRouter()


# ── WebSocket: Multi-agent orchestration ─────────────────────────────────────

@router.websocket("/ws/{session_id}")
async def websocket_agent(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(""),
) -> None:
    """
    WebSocket endpoint for Urban Bad AI multi-agent orchestration.

    Authentication: JWT passed via ?token= query parameter.

    Client sends:
      {"type": "prompt", "message": "...", "context": {"module": "...", "route": "...", "selected_id": "..."}}
      {"type": "approve", "run_id": "...", "step_ids": ["..."], "decision": "approve"|"reject"}

    Server streams:
      {"type": "plan", "run_id": "...", "steps": [...]}
      {"type": "agent_thinking", "agent": "researcher", "message": "Looking up..."}
      {"type": "step_started", "step_id": "...", "agent": "executor", "action": "..."}
      {"type": "step_completed", "step_id": "...", "result": {...}}
      {"type": "approval_needed", "run_id": "...", "steps": [...]}
      {"type": "result", "run_id": "...", "summary": "...", "steps_completed": [...]}
      {"type": "error", "message": "..."}
    """
    # ── Authenticate from query param ────────────────────────────────────────
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise ValueError("Not an access token")
        user_id_str: str = payload["sub"]
    except (JWTError, ValueError, KeyError):
        await websocket.close(code=4001, reason="Unauthorized")
        return

    from app.core.database import AsyncSessionLocal  # noqa: PLC0415

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id_str))
        user = result.scalar_one_or_none()
        if user is None or not user.is_active:
            await websocket.close(code=4001, reason="User not found or inactive")
            return

        await websocket.accept()

        ai_service = AIService(db, user=user)
        orchestrator = AgentOrchestrator(db, user, ai_service)

        try:
            while True:
                raw = await websocket.receive_text()
                try:
                    data: dict[str, Any] = json.loads(raw)
                except json.JSONDecodeError:
                    await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                    continue

                msg_type = data.get("type", "prompt")

                if msg_type == "prompt":
                    message = data.get("message", "").strip()
                    if not message:
                        await websocket.send_json({"type": "error", "message": "Empty message"})
                        continue

                    context = data.get("context")

                    async for event in orchestrator.run(message, session_id, page_context=context):
                        try:
                            await websocket.send_json(event.to_dict())
                        except Exception:
                            break

                elif msg_type == "approve":
                    run_id_str = data.get("run_id", "")
                    step_ids_str = data.get("step_ids", [])
                    decision = data.get("decision", "reject")

                    try:
                        run_id = uuid.UUID(run_id_str)
                        step_ids = [uuid.UUID(s) for s in step_ids_str]
                    except (ValueError, TypeError):
                        await websocket.send_json({"type": "error", "message": "Invalid run_id or step_ids"})
                        continue

                    async for event in orchestrator.resume_after_approval(run_id, step_ids, decision):
                        try:
                            await websocket.send_json(event.to_dict())
                        except Exception:
                            break

                else:
                    await websocket.send_json({"type": "error", "message": f"Unknown message type: {msg_type}"})

        except WebSocketDisconnect:
            pass
        finally:
            try:
                await websocket.close()
            except Exception:
                pass


# ── REST: Agent run history ──────────────────────────────────────────────────

@router.get("/runs", response_model=list[AgentRunOut], summary="List agent runs for current user")
async def list_runs(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> list[AgentRunOut]:
    result = await db.execute(
        select(AgentRun)
        .where(AgentRun.user_id == current_user.id)
        .options(selectinload(AgentRun.steps))
        .order_by(AgentRun.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    runs = result.scalars().unique().all()
    return [AgentRunOut.model_validate(r) for r in runs]


@router.get("/runs/{run_id}", response_model=AgentRunOut, summary="Get a specific agent run")
async def get_run(
    run_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> AgentRunOut:
    result = await db.execute(
        select(AgentRun)
        .where(AgentRun.id == run_id, AgentRun.user_id == current_user.id)
        .options(selectinload(AgentRun.steps))
    )
    run = result.scalar_one_or_none()
    if run is None:
        from fastapi import HTTPException  # noqa: PLC0415
        raise HTTPException(status_code=404, detail="Run not found")
    return AgentRunOut.model_validate(run)


@router.post("/runs/{run_id}/approve", response_model=AgentRunOut, summary="Approve or reject pending steps (REST fallback)")
async def approve_run(
    run_id: uuid.UUID,
    payload: ApprovalDecision,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> AgentRunOut:
    ai_service = AIService(db, user=current_user)
    orchestrator = AgentOrchestrator(db, current_user, ai_service)

    # Process approval
    async for _event in orchestrator.resume_after_approval(run_id, payload.step_ids, payload.decision):
        pass  # REST endpoint doesn't stream — just process to completion

    # Return updated run
    result = await db.execute(
        select(AgentRun)
        .where(AgentRun.id == run_id, AgentRun.user_id == current_user.id)
        .options(selectinload(AgentRun.steps))
    )
    run = result.scalar_one_or_none()
    if run is None:
        from fastapi import HTTPException  # noqa: PLC0415
        raise HTTPException(status_code=404, detail="Run not found")
    return AgentRunOut.model_validate(run)


@router.get("/approvals/pending", response_model=list[AgentApprovalOut], summary="List pending approvals")
async def list_pending_approvals(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> list[AgentApprovalOut]:
    result = await db.execute(
        select(AgentApproval)
        .where(AgentApproval.user_id == current_user.id, AgentApproval.status == "pending")
        .order_by(AgentApproval.created_at.desc())
    )
    approvals = result.scalars().all()
    return [AgentApprovalOut.model_validate(a) for a in approvals]
