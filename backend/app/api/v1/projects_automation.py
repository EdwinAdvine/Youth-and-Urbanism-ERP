"""Projects API — Automation rules (no-code triggers and actions)."""

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.projects import Project
from app.models.projects_enhanced import AutomationRule

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _user_can_access_project(project: Project, user_id: uuid.UUID) -> bool:
    if project.owner_id == user_id:
        return True
    members = project.members or []
    return str(user_id) in [str(m) for m in members]


VALID_TRIGGERS = {"status_change", "due_date_reached", "assignment_change", "task_created", "priority_change"}
VALID_ACTIONS = {"assign_user", "send_notification", "move_to_status", "create_subtask", "add_tag"}


# ── Schemas ──────────────────────────────────────────────────────────────────

class AutomationRuleCreate(BaseModel):
    name: str
    trigger_type: str
    trigger_config: dict | None = None
    action_type: str
    action_config: dict | None = None


class AutomationRuleUpdate(BaseModel):
    name: str | None = None
    trigger_type: str | None = None
    trigger_config: dict | None = None
    action_type: str | None = None
    action_config: dict | None = None
    is_active: bool | None = None


class AutomationRuleOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    trigger_type: str
    trigger_config: dict | None
    action_type: str
    action_config: dict | None
    is_active: bool
    execution_count: int
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post(
    "/{project_id}/automations",
    status_code=status.HTTP_201_CREATED,
    summary="Create an automation rule",
)
async def create_automation_rule(
    project_id: uuid.UUID,
    payload: AutomationRuleCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.trigger_type not in VALID_TRIGGERS:
        raise HTTPException(status_code=400, detail=f"Invalid trigger_type. Must be one of: {', '.join(VALID_TRIGGERS)}")
    if payload.action_type not in VALID_ACTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid action_type. Must be one of: {', '.join(VALID_ACTIONS)}")

    rule = AutomationRule(
        project_id=project_id,
        name=payload.name,
        trigger_type=payload.trigger_type,
        trigger_config=payload.trigger_config,
        action_type=payload.action_type,
        action_config=payload.action_config,
        created_by=current_user.id,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return AutomationRuleOut.model_validate(rule).model_dump()


@router.get(
    "/{project_id}/automations",
    summary="List automation rules for a project",
)
async def list_automation_rules(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(AutomationRule)
        .where(AutomationRule.project_id == project_id)
        .order_by(AutomationRule.created_at.desc())
    )
    rules = result.scalars().all()
    return {
        "total": len(rules),
        "rules": [AutomationRuleOut.model_validate(r).model_dump() for r in rules],
    }


@router.put(
    "/{project_id}/automations/{rule_id}",
    summary="Update an automation rule",
)
async def update_automation_rule(
    project_id: uuid.UUID,
    rule_id: uuid.UUID,
    payload: AutomationRuleUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    rule = await db.get(AutomationRule, rule_id)
    if not rule or rule.project_id != project_id:
        raise HTTPException(status_code=404, detail="Automation rule not found")

    if payload.trigger_type and payload.trigger_type not in VALID_TRIGGERS:
        raise HTTPException(status_code=400, detail=f"Invalid trigger_type")
    if payload.action_type and payload.action_type not in VALID_ACTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid action_type")

    for attr, value in payload.model_dump(exclude_none=True).items():
        setattr(rule, attr, value)

    await db.commit()
    await db.refresh(rule)
    return AutomationRuleOut.model_validate(rule).model_dump()


@router.delete(
    "/{project_id}/automations/{rule_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete an automation rule",
)
async def delete_automation_rule(
    project_id: uuid.UUID,
    rule_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    project = await db.get(Project, project_id)
    if not project or not _user_can_access_project(project, current_user.id):
        raise HTTPException(status_code=404, detail="Project not found")

    rule = await db.get(AutomationRule, rule_id)
    if not rule or rule.project_id != project_id:
        raise HTTPException(status_code=404, detail="Automation rule not found")

    await db.delete(rule)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


@router.get(
    "/{project_id}/automations/templates",
    summary="List automation rule templates",
)
async def list_automation_templates(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Returns pre-built automation templates the user can use as starting points."""
    return {
        "templates": [
            {
                "name": "Auto-assign on creation",
                "trigger_type": "task_created",
                "trigger_config": {},
                "action_type": "assign_user",
                "action_config": {"user_id": "select_user"},
            },
            {
                "name": "Move to Done when all subtasks complete",
                "trigger_type": "status_change",
                "trigger_config": {"to_status": "done", "check_subtasks": True},
                "action_type": "move_to_status",
                "action_config": {"status": "done"},
            },
            {
                "name": "Notify on high priority",
                "trigger_type": "priority_change",
                "trigger_config": {"to_priority": "urgent"},
                "action_type": "send_notification",
                "action_config": {"message": "A task was marked as urgent"},
            },
            {
                "name": "Add review tag on completion",
                "trigger_type": "status_change",
                "trigger_config": {"to_status": "done"},
                "action_type": "add_tag",
                "action_config": {"tag": "needs-review"},
            },
            {
                "name": "Create QA subtask on review",
                "trigger_type": "status_change",
                "trigger_config": {"to_status": "in_review"},
                "action_type": "create_subtask",
                "action_config": {"title": "QA Review", "priority": "high"},
            },
        ],
    }
