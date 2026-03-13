"""HR Workflow Automation — visual workflow builder, executor, approvals."""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.models.hr_phase3 import HRWorkflow as Workflow, WorkflowApproval, HRWorkflowExecution as WorkflowExecution

router = APIRouter()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class WorkflowOut(BaseModel):
    id: str
    name: str
    description: str | None
    trigger_type: str
    trigger_config: dict | None
    steps: list | None
    is_active: bool
    is_template: bool
    category: str | None
    run_count: int
    last_run_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class ExecutionOut(BaseModel):
    id: str
    workflow_id: str
    status: str
    current_step_id: str | None
    steps_completed: list | None
    started_at: datetime
    completed_at: datetime | None
    error_message: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class ApprovalOut(BaseModel):
    id: str
    execution_id: str
    step_id: str
    status: str
    requested_at: datetime
    decided_at: datetime | None
    decision_note: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class WorkflowCreateBody(BaseModel):
    name: str
    description: str | None = None
    trigger_type: str
    trigger_config: dict | None = None
    steps: list | None = None
    is_template: bool = False
    category: str | None = None


class WorkflowUpdateBody(BaseModel):
    name: str | None = None
    description: str | None = None
    trigger_type: str | None = None
    trigger_config: dict | None = None
    steps: list | None = None
    is_template: bool | None = None
    category: str | None = None


class TriggerBody(BaseModel):
    trigger_data: dict | None = None


class DecisionBody(BaseModel):
    decision: str  # "approved" | "rejected"
    note: str | None = None


class InstantiateBody(BaseModel):
    name: str


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _workflow_to_dict(wf: Workflow, run_count: int = 0, last_run_at: datetime | None = None) -> dict:
    return {
        "id": str(wf.id),
        "name": wf.name,
        "description": wf.description,
        "trigger_type": wf.trigger_type,
        "trigger_config": wf.trigger_config,
        "steps": wf.steps,
        "is_active": wf.is_active,
        "is_template": wf.is_template,
        "category": wf.category,
        "run_count": run_count,
        "last_run_at": last_run_at,
        "created_at": wf.created_at,
    }


# ---------------------------------------------------------------------------
# Workflow CRUD
# ---------------------------------------------------------------------------

@router.get("/workflows")
async def list_workflows(
    db: DBSession,
    current_user: CurrentUser,
    is_active: bool | None = Query(None),
    category: str | None = Query(None),
    is_template: bool | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """List workflows with optional filters."""
    q = select(Workflow)
    if is_active is not None:
        q = q.where(Workflow.is_active == is_active)
    if category is not None:
        q = q.where(Workflow.category == category)
    if is_template is not None:
        q = q.where(Workflow.is_template == is_template)

    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar_one()

    q = q.offset((page - 1) * limit).limit(limit).order_by(Workflow.created_at.desc())
    result = await db.execute(q)
    workflows = result.scalars().all()

    items = []
    for wf in workflows:
        exec_q = await db.execute(
            select(func.count(), func.max(WorkflowExecution.started_at))
            .where(WorkflowExecution.workflow_id == wf.id)
        )
        row = exec_q.one()
        run_count = row[0] or 0
        last_run_at = row[1]
        items.append(_workflow_to_dict(wf, run_count=run_count, last_run_at=last_run_at))

    return {"items": items, "total": total, "page": page, "limit": limit}


@router.post("/workflows", status_code=status.HTTP_201_CREATED)
async def create_workflow(
    body: WorkflowCreateBody,
    db: DBSession,
    current_user: CurrentUser,
    _admin=Depends(require_app_admin),
):
    """Create a new workflow."""
    wf = Workflow(
        id=uuid.uuid4(),
        name=body.name,
        description=body.description,
        trigger_type=body.trigger_type,
        trigger_config=body.trigger_config,
        steps=body.steps or [],
        is_active=True,
        is_template=body.is_template,
        category=body.category,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(wf)
    await db.commit()
    await db.refresh(wf)
    return _workflow_to_dict(wf)


@router.get("/workflows/{workflow_id}")
async def get_workflow(
    workflow_id: str,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get workflow detail with execution stats."""
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    exec_q = await db.execute(
        select(func.count(), func.max(WorkflowExecution.started_at))
        .where(WorkflowExecution.workflow_id == wf.id)
    )
    row = exec_q.one()
    run_count = row[0] or 0
    last_run_at = row[1]
    return _workflow_to_dict(wf, run_count=run_count, last_run_at=last_run_at)


@router.put("/workflows/{workflow_id}")
async def update_workflow(
    workflow_id: str,
    body: WorkflowUpdateBody,
    db: DBSession,
    current_user: CurrentUser,
    _admin=Depends(require_app_admin),
):
    """Update workflow — only if no active executions."""
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    active_exec = await db.execute(
        select(func.count())
        .where(WorkflowExecution.workflow_id == workflow_id)
        .where(WorkflowExecution.status == "running")
    )
    if active_exec.scalar_one() > 0:
        raise HTTPException(
            status_code=409, detail="Cannot update workflow with active executions"
        )

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(wf, field, value)
    wf.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(wf)
    return _workflow_to_dict(wf)


@router.delete("/workflows/{workflow_id}", status_code=status.HTTP_200_OK)
async def delete_workflow(
    workflow_id: str,
    db: DBSession,
    current_user: CurrentUser,
    _admin=Depends(require_app_admin),
):
    """Delete workflow — only if no executions exist."""
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    exec_count = await db.execute(
        select(func.count()).where(WorkflowExecution.workflow_id == workflow_id)
    )
    if exec_count.scalar_one() > 0:
        raise HTTPException(
            status_code=409, detail="Cannot delete workflow that has execution history"
        )

    await db.delete(wf)
    await db.commit()


@router.patch("/workflows/{workflow_id}/toggle")
async def toggle_workflow(
    workflow_id: str,
    db: DBSession,
    current_user: CurrentUser,
    _admin=Depends(require_app_admin),
):
    """Toggle is_active on a workflow."""
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    wf.is_active = not wf.is_active
    wf.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(wf)
    return {"id": str(wf.id), "is_active": wf.is_active}


# ---------------------------------------------------------------------------
# Execution
# ---------------------------------------------------------------------------

@router.post("/workflows/{workflow_id}/trigger", status_code=status.HTTP_201_CREATED)
async def trigger_workflow(
    workflow_id: str,
    body: TriggerBody,
    db: DBSession,
    current_user: CurrentUser,
):
    """Manually trigger a workflow execution."""
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not wf.is_active:
        raise HTTPException(status_code=400, detail="Workflow is not active")

    execution = WorkflowExecution(
        id=uuid.uuid4(),
        workflow_id=wf.id,
        status="running",
        current_step_id=None,
        steps_completed=[],
        trigger_data=body.trigger_data or {},
        triggered_by=str(current_user.id),
        started_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)

    try:
        from app.services.hr_workflow_engine import execute_workflow  # noqa: PLC0415

        await execute_workflow(workflow_id=str(wf.id), execution_id=str(execution.id), db=db)
    except ImportError:
        logger.warning("hr_workflow_engine not available; execution created with 'running' status")
    except Exception as exc:  # noqa: BLE001
        logger.error("Workflow execution error: %s", exc)
        execution.status = "failed"
        execution.error_message = str(exc)
        execution.completed_at = datetime.now(timezone.utc)
        await db.commit()

    return {
        "id": str(execution.id),
        "workflow_id": str(execution.workflow_id),
        "status": execution.status,
        "current_step_id": execution.current_step_id,
        "steps_completed": execution.steps_completed,
        "started_at": execution.started_at,
        "completed_at": execution.completed_at,
        "error_message": execution.error_message,
        "created_at": execution.created_at,
    }


@router.get("/workflows/executions")
async def list_executions(
    db: DBSession,
    current_user: CurrentUser,
    workflow_id: str | None = Query(None),
    exec_status: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """List all workflow executions."""
    q = select(WorkflowExecution)
    if workflow_id:
        q = q.where(WorkflowExecution.workflow_id == workflow_id)
    if exec_status:
        q = q.where(WorkflowExecution.status == exec_status)

    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar_one()

    q = q.offset((page - 1) * limit).limit(limit).order_by(WorkflowExecution.started_at.desc())
    result = await db.execute(q)
    executions = result.scalars().all()

    items = [
        {
            "id": str(e.id),
            "workflow_id": str(e.workflow_id),
            "status": e.status,
            "current_step_id": e.current_step_id,
            "steps_completed": e.steps_completed,
            "started_at": e.started_at,
            "completed_at": e.completed_at,
            "error_message": e.error_message,
            "created_at": e.created_at,
        }
        for e in executions
    ]
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/workflows/executions/{execution_id}")
async def get_execution(
    execution_id: str,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get execution detail."""
    result = await db.execute(
        select(WorkflowExecution).where(WorkflowExecution.id == execution_id)
    )
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")

    steps_completed = execution.steps_completed or []
    return {
        "id": str(execution.id),
        "workflow_id": str(execution.workflow_id),
        "status": execution.status,
        "current_step_id": execution.current_step_id,
        "steps_completed": steps_completed,
        "steps_completed_count": len(steps_completed),
        "started_at": execution.started_at,
        "completed_at": execution.completed_at,
        "error_message": execution.error_message,
        "created_at": execution.created_at,
    }


# ---------------------------------------------------------------------------
# Approvals
# ---------------------------------------------------------------------------

@router.get("/workflows/approvals/pending")
async def list_pending_approvals(
    db: DBSession,
    current_user: CurrentUser,
):
    """List pending approvals for the current user."""
    result = await db.execute(
        select(WorkflowApproval)
        .where(WorkflowApproval.approver_id == str(current_user.id))
        .where(WorkflowApproval.status == "pending")
        .order_by(WorkflowApproval.requested_at.desc())
    )
    approvals = result.scalars().all()

    items = []
    for ap in approvals:
        exec_result = await db.execute(
            select(WorkflowExecution).where(WorkflowExecution.id == ap.execution_id)
        )
        execution = exec_result.scalar_one_or_none()
        workflow_name = None
        if execution:
            wf_result = await db.execute(
                select(Workflow).where(Workflow.id == execution.workflow_id)
            )
            wf = wf_result.scalar_one_or_none()
            workflow_name = wf.name if wf else None

        items.append(
            {
                "id": str(ap.id),
                "execution_id": str(ap.execution_id),
                "step_id": ap.step_id,
                "status": ap.status,
                "requested_at": ap.requested_at,
                "decided_at": ap.decided_at,
                "decision_note": ap.decision_note,
                "created_at": ap.created_at,
                "context": {
                    "workflow_name": workflow_name,
                    "execution_status": execution.status if execution else None,
                },
            }
        )
    return {"items": items, "total": len(items)}


@router.post("/workflows/approvals/{approval_id}/decide")
async def decide_approval(
    approval_id: str,
    body: DecisionBody,
    db: DBSession,
    current_user: CurrentUser,
):
    """Approve or reject a pending workflow approval step."""
    if body.decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="decision must be 'approved' or 'rejected'")

    result = await db.execute(
        select(WorkflowApproval).where(WorkflowApproval.id == approval_id)
    )
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    if approval.approver_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to decide this approval")
    if approval.status != "pending":
        raise HTTPException(status_code=409, detail="Approval already decided")

    approval.status = body.decision
    approval.decision_note = body.note
    approval.decided_at = datetime.now(timezone.utc)
    await db.commit()

    exec_result = await db.execute(
        select(WorkflowExecution).where(WorkflowExecution.id == approval.execution_id)
    )
    execution = exec_result.scalar_one_or_none()

    if body.decision == "approved" and execution:
        try:
            from app.services.hr_workflow_engine import resume_workflow  # noqa: PLC0415

            await resume_workflow(
                execution_id=str(execution.id),
                approval_id=approval_id,
                db=db,
            )
        except ImportError:
            logger.warning("hr_workflow_engine not available; execution remains in current state")
        except Exception as exc:  # noqa: BLE001
            logger.error("Resume workflow error: %s", exc)
    elif body.decision == "rejected" and execution:
        execution.status = "cancelled"
        execution.completed_at = datetime.now(timezone.utc)
        await db.commit()

    await event_bus.publish(
        "hr.workflow_decision",
        {
            "approval_id": approval_id,
            "execution_id": str(approval.execution_id),
            "decision": body.decision,
            "decided_by": str(current_user.id),
        },
    )

    return {
        "id": str(approval.id),
        "status": approval.status,
        "decision_note": approval.decision_note,
        "decided_at": approval.decided_at,
    }


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

@router.get("/workflows/templates")
async def list_templates(
    db: DBSession,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """List workflow templates."""
    q = select(Workflow).where(Workflow.is_template == True)  # noqa: E712
    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar_one()

    q = q.offset((page - 1) * limit).limit(limit).order_by(Workflow.created_at.desc())
    result = await db.execute(q)
    workflows = result.scalars().all()

    items = [_workflow_to_dict(wf) for wf in workflows]
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.post("/workflows/templates/{template_id}/instantiate", status_code=status.HTTP_201_CREATED)
async def instantiate_template(
    template_id: str,
    body: InstantiateBody,
    db: DBSession,
    current_user: CurrentUser,
):
    """Create a new workflow from a template."""
    result = await db.execute(
        select(Workflow).where(Workflow.id == template_id).where(Workflow.is_template == True)  # noqa: E712
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    new_wf = Workflow(
        id=uuid.uuid4(),
        name=body.name,
        description=template.description,
        trigger_type=template.trigger_type,
        trigger_config=template.trigger_config,
        steps=template.steps,
        is_active=True,
        is_template=False,
        category=template.category,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(new_wf)
    await db.commit()
    await db.refresh(new_wf)
    return _workflow_to_dict(new_wf)


@router.get("/workflows/templates/library")
async def get_template_library(current_user: CurrentUser):
    """Return a hardcoded library of common HR workflow templates."""
    return {
        "items": [
            {
                "key": "new_employee_onboarding",
                "name": "New Employee Onboarding",
                "description": "Automated onboarding flow triggered when a new employee is created.",
                "trigger_type": "employee_created",
                "trigger_config": {},
                "category": "onboarding",
                "steps": [
                    {
                        "id": "step_1",
                        "type": "send_email",
                        "config": {"template": "welcome_email", "to": "{{employee.email}}"},
                        "next_step_id": "step_2",
                    },
                    {
                        "id": "step_2",
                        "type": "assign_buddy",
                        "config": {"auto_assign": True},
                        "next_step_id": "step_3",
                    },
                    {
                        "id": "step_3",
                        "type": "create_tasks",
                        "config": {
                            "tasks": [
                                "Set up workstation",
                                "Grant system access",
                                "Issue ID badge",
                                "Enroll in benefits",
                            ]
                        },
                        "next_step_id": "step_4",
                    },
                    {
                        "id": "step_4",
                        "type": "schedule_meeting",
                        "config": {
                            "title": "Orientation Session",
                            "duration_minutes": 60,
                            "within_days": 3,
                        },
                        "next_step_id": None,
                    },
                ],
            },
            {
                "key": "performance_review_reminder",
                "name": "Performance Review Reminder",
                "description": "Sends reminder emails and creates review tasks on a scheduled date.",
                "trigger_type": "date_based",
                "trigger_config": {"cron": "0 9 1 */6 *"},
                "category": "performance",
                "steps": [
                    {
                        "id": "step_1",
                        "type": "send_email",
                        "config": {
                            "template": "performance_review_reminder",
                            "to": "all_managers",
                        },
                        "next_step_id": "step_2",
                    },
                    {
                        "id": "step_2",
                        "type": "create_tasks",
                        "config": {
                            "tasks": ["Complete self-assessment", "Schedule 1-on-1 with manager"],
                            "assign_to": "all_employees",
                        },
                        "next_step_id": None,
                    },
                ],
            },
            {
                "key": "offboarding_checklist",
                "name": "Offboarding Checklist",
                "description": "Triggered when employee status changes to inactive.",
                "trigger_type": "status_changed",
                "trigger_config": {"new_status": "inactive"},
                "category": "offboarding",
                "steps": [
                    {
                        "id": "step_1",
                        "type": "revoke_access",
                        "config": {"systems": ["email", "vpn", "slack", "github"]},
                        "next_step_id": "step_2",
                    },
                    {
                        "id": "step_2",
                        "type": "create_tasks",
                        "config": {
                            "tasks": [
                                "Collect company laptop",
                                "Collect access card",
                                "Collect company phone",
                            ],
                            "assign_to": "hr_team",
                        },
                        "next_step_id": "step_3",
                    },
                    {
                        "id": "step_3",
                        "type": "schedule_meeting",
                        "config": {
                            "title": "Exit Interview",
                            "duration_minutes": 45,
                            "within_days": 5,
                        },
                        "next_step_id": None,
                    },
                ],
            },
            {
                "key": "probation_period_review",
                "name": "Probation Period Review",
                "description": "Triggers at 90 days to notify manager and require an approval decision.",
                "trigger_type": "date_based",
                "trigger_config": {"offset_days": 90, "anchor": "employee.hire_date"},
                "category": "performance",
                "steps": [
                    {
                        "id": "step_1",
                        "type": "send_notification",
                        "config": {
                            "to": "{{employee.manager}}",
                            "message": "Probation review due for {{employee.full_name}}",
                        },
                        "next_step_id": "step_2",
                    },
                    {
                        "id": "step_2",
                        "type": "create_tasks",
                        "config": {
                            "tasks": ["Complete probation review form"],
                            "assign_to": "{{employee.manager}}",
                        },
                        "next_step_id": "step_3",
                    },
                    {
                        "id": "step_3",
                        "type": "require_approval",
                        "config": {
                            "approver": "{{employee.manager}}",
                            "options": ["Pass Probation", "Extend Probation", "Terminate"],
                        },
                        "next_step_id": None,
                    },
                ],
            },
        ]
    }


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

@router.get("/workflows/analytics/summary")
async def workflow_analytics_summary(
    db: DBSession,
    current_user: CurrentUser,
):
    """Workflow analytics summary."""
    total_result = await db.execute(select(func.count()).select_from(select(WorkflowExecution).subquery()))
    total_executions = total_result.scalar_one()

    success_result = await db.execute(
        select(func.count()).where(WorkflowExecution.status == "completed")
    )
    success_count = success_result.scalar_one()

    success_rate = round((success_count / total_executions * 100), 2) if total_executions > 0 else 0.0

    # Average duration in seconds
    avg_duration_result = await db.execute(
        select(
            func.avg(
                func.extract(
                    "epoch",
                    WorkflowExecution.completed_at - WorkflowExecution.started_at,
                )
            )
        ).where(
            WorkflowExecution.status == "completed",
            WorkflowExecution.completed_at.isnot(None),
        )
    )
    avg_duration = avg_duration_result.scalar_one()

    # Most triggered workflow
    most_triggered_result = await db.execute(
        select(WorkflowExecution.workflow_id, func.count().label("cnt"))
        .group_by(WorkflowExecution.workflow_id)
        .order_by(func.count().desc())
        .limit(1)
    )
    most_triggered_row = most_triggered_result.first()
    most_triggered = None
    if most_triggered_row:
        wf_result = await db.execute(
            select(Workflow.name).where(Workflow.id == most_triggered_row[0])
        )
        wf_name = wf_result.scalar_one_or_none()
        most_triggered = {
            "workflow_id": str(most_triggered_row[0]),
            "name": wf_name,
            "count": most_triggered_row[1],
        }

    pending_approvals_result = await db.execute(
        select(func.count()).where(WorkflowApproval.status == "pending")
    )
    pending_approvals_count = pending_approvals_result.scalar_one()

    return {
        "total_executions": total_executions,
        "success_count": success_count,
        "success_rate": success_rate,
        "avg_duration_seconds": round(float(avg_duration), 2) if avg_duration else None,
        "most_triggered": most_triggered,
        "pending_approvals_count": pending_approvals_count,
    }
