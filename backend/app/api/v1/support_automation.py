"""Support Automation Engine (Phase 2) — CRUD, toggle, dry-run test, and evaluate endpoints."""

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import and_, select

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.support import Ticket, TicketComment
from app.models.support_phase2 import SupportAutomation, SupportAutomationLog

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────


class AutomationCreate(BaseModel):
    name: str
    description: str | None = None
    trigger_event: str
    conditions: dict | None = None
    actions: list | None = None
    is_active: bool = True


class AutomationUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    trigger_event: str | None = None
    conditions: dict | None = None
    actions: list | None = None
    is_active: bool | None = None


class AutomationOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    trigger_event: str
    conditions: dict | None
    actions: list | None
    is_active: bool
    execution_count: int
    last_executed_at: Any
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class AutomationLogOut(BaseModel):
    id: uuid.UUID
    automation_id: uuid.UUID
    ticket_id: uuid.UUID | None
    actions_executed: list | None
    success: bool
    error_message: str | None
    executed_at: Any

    model_config = {"from_attributes": True}


class TestAutomationPayload(BaseModel):
    ticket_id: uuid.UUID


class EvaluatePayload(BaseModel):
    ticket_id: uuid.UUID


# ── Helpers ───────────────────────────────────────────────────────────────────


def _evaluate_conditions(ticket: Ticket, conditions: dict | None) -> dict[str, Any]:
    """
    Evaluate a conditions dict against a ticket.

    Returns a dict mapping each condition key to {"expected": ..., "actual": ..., "matched": bool}.
    """
    if not conditions:
        return {}

    results: dict[str, Any] = {}
    for field, expected_value in conditions.items():
        actual_value = getattr(ticket, field, None)
        # Coerce UUIDs to str for comparison convenience
        if isinstance(actual_value, uuid.UUID):
            actual_value = str(actual_value)
        if isinstance(expected_value, uuid.UUID):
            expected_value = str(expected_value)
        results[field] = {
            "expected": expected_value,
            "actual": actual_value,
            "matched": actual_value == expected_value,
        }
    return results


def _all_conditions_match(conditions_result: dict[str, Any]) -> bool:
    """Return True only when every condition in the result dict matched."""
    if not conditions_result:
        return True  # no conditions → always matches
    return all(v["matched"] for v in conditions_result.values())


async def _execute_actions(
    automation: SupportAutomation,
    ticket: Ticket,
    current_user_id: uuid.UUID,
    db: DBSession,
) -> tuple[list[str], str | None]:
    """
    Execute the automation's action list against the given ticket.

    Returns (actions_executed_list, error_message_or_None).
    """
    actions_executed: list[str] = []
    error_message: str | None = None

    try:
        for action in (automation.actions or []):
            action_type = action.get("type")

            if action_type == "assign":
                user_id_raw = action.get("user_id")
                if user_id_raw:
                    ticket.assigned_to = uuid.UUID(str(user_id_raw))
                    actions_executed.append(f"assign:{user_id_raw}")

            elif action_type == "set_priority":
                value = action.get("value")
                if value:
                    ticket.priority = value
                    actions_executed.append(f"set_priority:{value}")

            elif action_type == "add_tag":
                value = action.get("value")
                if value:
                    existing_tags: list[str] = list(ticket.tags or [])
                    if value not in existing_tags:
                        existing_tags.append(value)
                        ticket.tags = existing_tags
                    actions_executed.append(f"add_tag:{value}")

            elif action_type == "add_comment":
                content = action.get("content", "")
                is_internal = bool(action.get("is_internal", True))
                if content:
                    comment = TicketComment(
                        ticket_id=ticket.id,
                        author_id=current_user_id,
                        content=content,
                        is_internal=is_internal,
                    )
                    db.add(comment)
                    actions_executed.append("add_comment")

            elif action_type == "send_notification":
                await event_bus.publish(
                    "support.automation.notification",
                    {
                        "automation_id": str(automation.id),
                        "automation_name": automation.name,
                        "ticket_id": str(ticket.id),
                        "ticket_number": ticket.ticket_number,
                        "action": action,
                    },
                )
                actions_executed.append("send_notification")

    except Exception as exc:  # noqa: BLE001
        error_message = str(exc)

    return actions_executed, error_message


# ══════════════════════════════════════════════════════════════════════════════
#  AUTOMATIONS — CRUD
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/automations", summary="List all automations with optional filters")
async def list_automations(
    current_user: CurrentUser,
    db: DBSession,
    is_active: bool | None = Query(None),
    trigger_event: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(SupportAutomation).order_by(SupportAutomation.created_at.desc())

    if is_active is not None:
        query = query.where(SupportAutomation.is_active == is_active)
    if trigger_event:
        query = query.where(SupportAutomation.trigger_event == trigger_event)

    # Total count (before pagination)
    from sqlalchemy import func  # noqa: PLC0415
    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar() or 0

    # Paginated rows
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    automations = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "automations": [AutomationOut.model_validate(a).model_dump() for a in automations],
    }


@router.post(
    "/automations",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new automation rule",
)
async def create_automation(
    payload: AutomationCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    automation = SupportAutomation(
        name=payload.name,
        description=payload.description,
        trigger_event=payload.trigger_event,
        conditions=payload.conditions or {},
        actions=payload.actions or [],
        is_active=payload.is_active,
        created_by=current_user.id,
    )
    db.add(automation)
    await db.commit()
    await db.refresh(automation)
    return AutomationOut.model_validate(automation).model_dump()


@router.get("/automations/{automation_id}", summary="Get a single automation with recent logs")
async def get_automation(
    automation_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    automation = await db.get(SupportAutomation, automation_id)
    if not automation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Automation not found")

    # Recent logs (last 20), sorted newest-first
    logs_result = await db.execute(
        select(SupportAutomationLog)
        .where(SupportAutomationLog.automation_id == automation_id)
        .order_by(SupportAutomationLog.executed_at.desc())
        .limit(20)
    )
    recent_logs = logs_result.scalars().all()

    out = AutomationOut.model_validate(automation).model_dump()
    out["recent_logs"] = [AutomationLogOut.model_validate(log).model_dump() for log in recent_logs]
    return out


@router.put("/automations/{automation_id}", summary="Update an automation rule")
async def update_automation(
    automation_id: uuid.UUID,
    payload: AutomationUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    automation = await db.get(SupportAutomation, automation_id)
    if not automation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Automation not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(automation, field, value)

    await db.commit()
    await db.refresh(automation)
    return AutomationOut.model_validate(automation).model_dump()


@router.delete(
    "/automations/{automation_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete an automation rule",
)
async def delete_automation(
    automation_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    automation = await db.get(SupportAutomation, automation_id)
    if not automation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Automation not found")

    await db.delete(automation)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


@router.post("/automations/{automation_id}/toggle", summary="Toggle automation active state")
async def toggle_automation(
    automation_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    automation = await db.get(SupportAutomation, automation_id)
    if not automation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Automation not found")

    automation.is_active = not automation.is_active
    await db.commit()
    await db.refresh(automation)
    return {
        "id": str(automation.id),
        "name": automation.name,
        "is_active": automation.is_active,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  TEST (DRY-RUN)
# ══════════════════════════════════════════════════════════════════════════════


@router.post(
    "/automations/{automation_id}/test",
    summary="Dry-run: evaluate conditions against a test ticket without executing actions",
)
async def test_automation(
    automation_id: uuid.UUID,
    payload: TestAutomationPayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    automation = await db.get(SupportAutomation, automation_id)
    if not automation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Automation not found")

    ticket = await db.get(Ticket, payload.ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    conditions_result = _evaluate_conditions(ticket, automation.conditions)
    would_match = _all_conditions_match(conditions_result)

    return {
        "automation_id": str(automation_id),
        "automation_name": automation.name,
        "ticket_id": str(payload.ticket_id),
        "ticket_number": ticket.ticket_number,
        "would_match": would_match,
        "conditions_result": conditions_result,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  EXECUTION LOGS
# ══════════════════════════════════════════════════════════════════════════════


@router.get(
    "/automations/{automation_id}/logs",
    summary="Paginated execution logs for an automation",
)
async def list_automation_logs(
    automation_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    automation = await db.get(SupportAutomation, automation_id)
    if not automation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Automation not found")

    from sqlalchemy import func  # noqa: PLC0415
    base_query = select(SupportAutomationLog).where(
        SupportAutomationLog.automation_id == automation_id
    )

    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * page_size
    logs_result = await db.execute(
        base_query.order_by(SupportAutomationLog.executed_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    logs = logs_result.scalars().all()

    return {
        "automation_id": str(automation_id),
        "total": total,
        "page": page,
        "page_size": page_size,
        "logs": [AutomationLogOut.model_validate(log).model_dump() for log in logs],
    }


# ══════════════════════════════════════════════════════════════════════════════
#  EVALUATE — MANUAL TRIGGER AGAINST A TICKET
# ══════════════════════════════════════════════════════════════════════════════


@router.post(
    "/automations/evaluate",
    summary="Evaluate all active automations against a ticket and execute matching ones",
)
async def evaluate_automations(
    payload: EvaluatePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """
    Iterate over all active automations, test each one's conditions against
    the given ticket, and execute actions for every automation that matches.
    Logs each execution. Returns the list of automation names that were
    executed.
    """
    ticket = await db.get(Ticket, payload.ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    # Load all active automations
    active_result = await db.execute(
        select(SupportAutomation)
        .where(SupportAutomation.is_active == True)  # noqa: E712
        .order_by(SupportAutomation.created_at.asc())
    )
    active_automations = active_result.scalars().all()

    executed_names: list[str] = []
    execution_summary: list[dict[str, Any]] = []

    for automation in active_automations:
        conditions_result = _evaluate_conditions(ticket, automation.conditions)
        matched = _all_conditions_match(conditions_result)

        if not matched:
            continue

        # Execute actions
        actions_executed, error_message = await _execute_actions(
            automation, ticket, current_user.id, db
        )

        success = error_message is None

        # Update automation counters
        automation.execution_count = (automation.execution_count or 0) + 1
        automation.last_executed_at = datetime.now(timezone.utc)

        # Write execution log
        log_entry = SupportAutomationLog(
            automation_id=automation.id,
            ticket_id=ticket.id,
            actions_executed=actions_executed,
            success=success,
            error_message=error_message,
            executed_at=datetime.now(timezone.utc),
        )
        db.add(log_entry)

        executed_names.append(automation.name)
        execution_summary.append({
            "automation_id": str(automation.id),
            "automation_name": automation.name,
            "actions_executed": actions_executed,
            "success": success,
            "error_message": error_message,
        })

    # Persist all ticket mutations + logs in one commit
    await db.commit()

    return {
        "ticket_id": str(payload.ticket_id),
        "ticket_number": ticket.ticket_number,
        "automations_evaluated": len(active_automations),
        "automations_matched": len(executed_names),
        "executed_automation_names": executed_names,
        "execution_summary": execution_summary,
    }
