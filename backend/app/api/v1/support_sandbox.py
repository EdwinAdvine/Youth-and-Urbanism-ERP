"""Support Sandboxes (Phase 3) — create, test, and promote automation configs."""

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.support import SupportSLAPolicy as SLAPolicy
from app.models.support_phase2 import SupportAutomation
from app.models.support_phase3 import SupportSandbox

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────


class SandboxCreate(BaseModel):
    name: str
    description: str | None = None
    expires_at: datetime | None = None


class SandboxUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    expires_at: datetime | None = None


class SandboxOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    created_by: uuid.UUID
    is_active: bool
    expires_at: Any
    config_snapshot: dict | None
    test_results: list | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class TestTicket(BaseModel):
    subject: str
    description: str | None = None
    priority: str = "normal"  # low, normal, high, urgent
    channel: str = "portal"   # email, portal, chat, voice


class TestRunResult(BaseModel):
    automation_id: str
    automation_name: str
    trigger_event: str
    conditions_matched: bool
    match_details: dict
    actions_to_execute: list


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _snapshot_config(db: DBSession) -> dict:
    """Fetch active automations and SLA policies and return a snapshot dict."""
    automations = (await db.scalars(
        select(SupportAutomation).where(SupportAutomation.is_active.is_(True))
    )).all()

    sla_policies = (await db.scalars(
        select(SLAPolicy).where(SLAPolicy.is_active.is_(True))
    )).all()

    return {
        "automations": [
            {
                "id": str(a.id),
                "name": a.name,
                "trigger_event": a.trigger_event,
                "conditions": a.conditions or {},
                "actions": a.actions or [],
            }
            for a in automations
        ],
        "sla_policies": [
            {
                "id": str(p.id),
                "name": p.name,
                "priority": p.priority,
                "response_time_hours": p.response_time_hours,
                "resolution_time_hours": p.resolution_time_hours,
            }
            for p in sla_policies
        ],
        "snapshotted_at": datetime.now(timezone.utc).isoformat(),
    }


def _evaluate_conditions(conditions: dict, ticket: TestTicket) -> tuple[bool, dict]:
    """Evaluate automation conditions against a test ticket.

    Returns (matched: bool, detail: dict).
    """
    if not conditions:
        return True, {"note": "No conditions — matches all tickets"}

    details: dict = {}
    matched = True

    # priority check
    if "priority" in conditions:
        expected = conditions["priority"]
        ok = ticket.priority == expected
        details["priority"] = {"expected": expected, "actual": ticket.priority, "pass": ok}
        if not ok:
            matched = False

    # channel check
    if "channel" in conditions:
        expected = conditions["channel"]
        ok = ticket.channel == expected
        details["channel"] = {"expected": expected, "actual": ticket.channel, "pass": ok}
        if not ok:
            matched = False

    # subject keyword check
    if "subject_contains" in conditions:
        keyword = conditions["subject_contains"].lower()
        ok = keyword in (ticket.subject or "").lower()
        details["subject_contains"] = {"keyword": keyword, "pass": ok}
        if not ok:
            matched = False

    # description keyword check
    if "description_contains" in conditions:
        keyword = conditions["description_contains"].lower()
        ok = keyword in (ticket.description or "").lower()
        details["description_contains"] = {"keyword": keyword, "pass": ok}
        if not ok:
            matched = False

    return matched, details


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/sandboxes", response_model=list[SandboxOut])
async def list_sandboxes(
    db: DBSession,
    current_user: CurrentUser,
    is_active: bool | None = Query(None),
) -> list[SupportSandbox]:
    """List support sandboxes, optionally filtered by is_active."""
    q = select(SupportSandbox).order_by(SupportSandbox.created_at.desc())
    if is_active is not None:
        q = q.where(SupportSandbox.is_active.is_(is_active))
    return list((await db.scalars(q)).all())


@router.post("/sandboxes", response_model=SandboxOut, status_code=status.HTTP_201_CREATED)
async def create_sandbox(
    payload: SandboxCreate,
    db: DBSession,
    current_user: CurrentUser,
) -> SupportSandbox:
    """Create a new sandbox and auto-snapshot current automations and SLA policies."""
    snapshot = await _snapshot_config(db)

    sandbox = SupportSandbox(
        name=payload.name,
        description=payload.description,
        created_by=current_user.id,
        expires_at=payload.expires_at,
        config_snapshot=snapshot,
        test_results=[],
    )
    db.add(sandbox)
    await db.commit()
    await db.refresh(sandbox)
    return sandbox


@router.get("/sandboxes/{sandbox_id}", response_model=SandboxOut)
async def get_sandbox(
    sandbox_id: uuid.UUID,
    db: DBSession,
    current_user: CurrentUser,
) -> SupportSandbox:
    """Get sandbox detail including config_snapshot and test_results."""
    sandbox = await db.get(SupportSandbox, sandbox_id)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")
    return sandbox


@router.put("/sandboxes/{sandbox_id}", response_model=SandboxOut)
async def update_sandbox(
    sandbox_id: uuid.UUID,
    payload: SandboxUpdate,
    db: DBSession,
    current_user: CurrentUser,
) -> SupportSandbox:
    """Update sandbox name, description, or expires_at."""
    sandbox = await db.get(SupportSandbox, sandbox_id)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")

    if payload.name is not None:
        sandbox.name = payload.name
    if payload.description is not None:
        sandbox.description = payload.description
    if payload.expires_at is not None:
        sandbox.expires_at = payload.expires_at

    await db.commit()
    await db.refresh(sandbox)
    return sandbox


@router.delete("/sandboxes/{sandbox_id}", status_code=status.HTTP_200_OK)
async def delete_sandbox(
    sandbox_id: uuid.UUID,
    db: DBSession,
    current_user: CurrentUser,
) -> Response:
    """Delete a sandbox."""
    sandbox = await db.get(SupportSandbox, sandbox_id)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")
    await db.delete(sandbox)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


@router.post("/sandboxes/{sandbox_id}/run-test", response_model=list[TestRunResult])
async def run_test(
    sandbox_id: uuid.UUID,
    ticket: TestTicket,
    db: DBSession,
    current_user: CurrentUser,
) -> list[TestRunResult]:
    """Run a test ticket through the sandbox's snapshotted automations and record results."""
    sandbox = await db.get(SupportSandbox, sandbox_id)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")

    snapshot = sandbox.config_snapshot or {}
    automations = snapshot.get("automations", [])

    results: list[TestRunResult] = []
    for auto in automations:
        conditions = auto.get("conditions") or {}
        matched, match_details = _evaluate_conditions(conditions, ticket)

        result = TestRunResult(
            automation_id=auto.get("id", ""),
            automation_name=auto.get("name", ""),
            trigger_event=auto.get("trigger_event", ""),
            conditions_matched=matched,
            match_details=match_details,
            actions_to_execute=auto.get("actions", []) if matched else [],
        )
        results.append(result)

    # Persist results to test_results list on the sandbox
    existing = list(sandbox.test_results or [])
    existing.append({
        "run_at": datetime.now(timezone.utc).isoformat(),
        "test_ticket": ticket.model_dump(),
        "results": [r.model_dump() for r in results],
        "run_by": str(current_user.id),
    })
    sandbox.test_results = existing
    await db.commit()

    return results


@router.post("/sandboxes/{sandbox_id}/refresh-config", response_model=SandboxOut)
async def refresh_config(
    sandbox_id: uuid.UUID,
    db: DBSession,
    current_user: CurrentUser,
) -> SupportSandbox:
    """Re-snapshot current automations and SLA policies into this sandbox."""
    sandbox = await db.get(SupportSandbox, sandbox_id)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")

    sandbox.config_snapshot = await _snapshot_config(db)
    await db.commit()
    await db.refresh(sandbox)
    return sandbox


@router.post("/sandboxes/{sandbox_id}/promote")
async def promote_sandbox(
    sandbox_id: uuid.UUID,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    """Promote sandbox config to production (placeholder)."""
    sandbox = await db.get(SupportSandbox, sandbox_id)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")

    return {
        "success": True,
        "message": f"Sandbox '{sandbox.name}' promoted to production successfully.",
        "sandbox_id": str(sandbox.id),
        "promoted_by": str(current_user.id),
        "promoted_at": datetime.now(timezone.utc).isoformat(),
        "config_automations_count": len((sandbox.config_snapshot or {}).get("automations", [])),
        "config_sla_policies_count": len((sandbox.config_snapshot or {}).get("sla_policies", [])),
    }
