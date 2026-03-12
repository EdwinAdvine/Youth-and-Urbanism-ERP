"""CRM Workflow Automation — workflow CRUD, node management, execution & templates."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.models.crm_automations import (
    CRMWorkflow as Workflow,
    CRMWorkflowExecution as WorkflowExecution,
    WorkflowNode,
    WorkflowTemplate,
)

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────


class WorkflowCreate(BaseModel):
    name: str
    description: str | None = None
    trigger_type: str = "manual"  # event, schedule, manual, webhook
    trigger_config: dict | None = None


class WorkflowUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    trigger_type: str | None = None
    trigger_config: dict | None = None


class WorkflowOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    trigger_type: str
    trigger_config: dict | None
    status: str
    execution_count: int
    last_executed_at: Any | None
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


class NodeCreate(BaseModel):
    node_type: str  # trigger, action, condition, delay, branch
    position_x: int = 0
    position_y: int = 0
    config: dict | None = None
    next_node_id: uuid.UUID | None = None
    true_branch_node_id: uuid.UUID | None = None
    false_branch_node_id: uuid.UUID | None = None


class NodeUpdate(BaseModel):
    node_type: str | None = None
    position_x: int | None = None
    position_y: int | None = None
    config: dict | None = None
    next_node_id: uuid.UUID | None = None
    true_branch_node_id: uuid.UUID | None = None
    false_branch_node_id: uuid.UUID | None = None


class NodeOut(BaseModel):
    id: uuid.UUID
    workflow_id: uuid.UUID
    node_type: str
    position_x: int
    position_y: int
    config: dict | None
    next_node_id: uuid.UUID | None
    true_branch_node_id: uuid.UUID | None
    false_branch_node_id: uuid.UUID | None
    created_at: Any
    model_config = {"from_attributes": True}


class WorkflowDetailOut(WorkflowOut):
    nodes: list[NodeOut] = []


class ExecutionOut(BaseModel):
    id: uuid.UUID
    workflow_id: uuid.UUID
    trigger_data: dict | None
    status: str
    started_at: Any
    completed_at: Any | None
    error_message: str | None
    steps_log: dict | None
    model_config = {"from_attributes": True}


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    category: str
    workflow_json: dict | None
    is_system: bool
    created_at: Any
    model_config = {"from_attributes": True}


class TestExecuteIn(BaseModel):
    trigger_data: dict | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _get_workflow(db: DBSession, workflow_id: uuid.UUID) -> Workflow:
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return wf


# ── Workflow CRUD ─────────────────────────────────────────────────────────────


@router.get("/workflows", response_model=dict)
async def list_workflows(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status"),
    trigger_type: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """List workflows with optional status and trigger_type filters."""
    q = select(Workflow).where(Workflow.owner_id == current_user.id)
    count_q = select(func.count()).select_from(Workflow).where(Workflow.owner_id == current_user.id)

    if status_filter:
        q = q.where(Workflow.status == status_filter)
        count_q = count_q.where(Workflow.status == status_filter)
    if trigger_type:
        q = q.where(Workflow.trigger_type == trigger_type)
        count_q = count_q.where(Workflow.trigger_type == trigger_type)

    total = (await db.execute(count_q)).scalar() or 0
    rows = (await db.execute(q.order_by(Workflow.created_at.desc()).offset(skip).limit(limit))).scalars().all()
    return {"total": total, "items": [WorkflowOut.model_validate(r) for r in rows]}


@router.post("/workflows", response_model=WorkflowDetailOut, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    payload: WorkflowCreate,
    current_user: CurrentUser,
    db: DBSession,
):
    """Create a workflow with an initial trigger node."""
    wf = Workflow(
        name=payload.name,
        description=payload.description,
        trigger_type=payload.trigger_type,
        trigger_config=payload.trigger_config,
        status="draft",
        execution_count=0,
        owner_id=current_user.id,
    )
    db.add(wf)
    await db.flush()

    trigger_node = WorkflowNode(
        workflow_id=wf.id,
        node_type="trigger",
        position_x=0,
        position_y=0,
        config=payload.trigger_config,
    )
    db.add(trigger_node)
    await db.commit()
    await db.refresh(wf, attribute_names=["nodes"])
    return wf


@router.get("/workflows/{workflow_id}", response_model=WorkflowDetailOut)
async def get_workflow(
    workflow_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """Get a single workflow with all its nodes."""
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == workflow_id)
        .options(selectinload(Workflow.nodes))
    )
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return wf


@router.put("/workflows/{workflow_id}", response_model=WorkflowOut)
async def update_workflow(
    workflow_id: uuid.UUID,
    payload: WorkflowUpdate,
    current_user: CurrentUser,
    db: DBSession,
):
    """Update workflow metadata."""
    wf = await _get_workflow(db, workflow_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(wf, field, value)
    await db.commit()
    await db.refresh(wf)
    return wf


@router.delete("/workflows/{workflow_id}", status_code=status.HTTP_200_OK)
async def delete_workflow(
    workflow_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """Delete a workflow and cascade-delete its nodes and executions."""
    wf = await _get_workflow(db, workflow_id)
    await db.execute(delete(WorkflowNode).where(WorkflowNode.workflow_id == wf.id))
    await db.execute(delete(WorkflowExecution).where(WorkflowExecution.workflow_id == wf.id))
    await db.delete(wf)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ── Node Management ──────────────────────────────────────────────────────────


@router.post(
    "/workflows/{workflow_id}/nodes",
    response_model=NodeOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_node(
    workflow_id: uuid.UUID,
    payload: NodeCreate,
    current_user: CurrentUser,
    db: DBSession,
):
    """Add a node to a workflow."""
    await _get_workflow(db, workflow_id)
    node = WorkflowNode(
        workflow_id=workflow_id,
        node_type=payload.node_type,
        position_x=payload.position_x,
        position_y=payload.position_y,
        config=payload.config,
        next_node_id=payload.next_node_id,
        true_branch_node_id=payload.true_branch_node_id,
        false_branch_node_id=payload.false_branch_node_id,
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return node


@router.put("/workflows/{workflow_id}/nodes/{node_id}", response_model=NodeOut)
async def update_node(
    workflow_id: uuid.UUID,
    node_id: uuid.UUID,
    payload: NodeUpdate,
    current_user: CurrentUser,
    db: DBSession,
):
    """Update a workflow node."""
    result = await db.execute(
        select(WorkflowNode).where(
            WorkflowNode.id == node_id,
            WorkflowNode.workflow_id == workflow_id,
        )
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(node, field, value)
    await db.commit()
    await db.refresh(node)
    return node


@router.delete(
    "/workflows/{workflow_id}/nodes/{node_id}",
    status_code=status.HTTP_200_OK,
)
async def delete_node(
    workflow_id: uuid.UUID,
    node_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """Delete a workflow node."""
    result = await db.execute(
        select(WorkflowNode).where(
            WorkflowNode.id == node_id,
            WorkflowNode.workflow_id == workflow_id,
        )
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    await db.delete(node)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ── Workflow Lifecycle ────────────────────────────────────────────────────────


@router.post("/workflows/{workflow_id}/activate", response_model=WorkflowOut)
async def activate_workflow(
    workflow_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """Set workflow status to active."""
    wf = await _get_workflow(db, workflow_id)
    if wf.status == "active":
        raise HTTPException(status_code=400, detail="Workflow is already active")
    wf.status = "active"
    await db.commit()
    await db.refresh(wf)
    return wf


@router.post("/workflows/{workflow_id}/pause", response_model=WorkflowOut)
async def pause_workflow(
    workflow_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """Set workflow status to paused."""
    wf = await _get_workflow(db, workflow_id)
    if wf.status == "paused":
        raise HTTPException(status_code=400, detail="Workflow is already paused")
    wf.status = "paused"
    await db.commit()
    await db.refresh(wf)
    return wf


@router.post("/workflows/{workflow_id}/test", response_model=ExecutionOut)
async def test_execute_workflow(
    workflow_id: uuid.UUID,
    payload: TestExecuteIn,
    current_user: CurrentUser,
    db: DBSession,
):
    """Test-execute a workflow with sample trigger data."""
    wf = await _get_workflow(db, workflow_id)
    from app.services.crm_workflow_engine import execute_workflow  # noqa: PLC0415

    execution = await execute_workflow(db, wf, trigger_data=payload.trigger_data, test_mode=True)
    return execution


# ── Executions ────────────────────────────────────────────────────────────────


@router.get("/workflows/{workflow_id}/executions", response_model=dict)
async def list_executions(
    workflow_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """List executions for a workflow."""
    await _get_workflow(db, workflow_id)

    count_q = (
        select(func.count())
        .select_from(WorkflowExecution)
        .where(WorkflowExecution.workflow_id == workflow_id)
    )
    total = (await db.execute(count_q)).scalar() or 0

    q = (
        select(WorkflowExecution)
        .where(WorkflowExecution.workflow_id == workflow_id)
        .order_by(WorkflowExecution.started_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().all()
    return {"total": total, "items": [ExecutionOut.model_validate(r) for r in rows]}


# ── Templates ─────────────────────────────────────────────────────────────────


@router.get("/workflow-templates", response_model=list[TemplateOut])
async def list_templates(
    current_user: CurrentUser,
    db: DBSession,
    category: str | None = Query(None),
):
    """List workflow templates, optionally filtered by category."""
    q = select(WorkflowTemplate)
    if category:
        q = q.where(WorkflowTemplate.category == category)
    q = q.order_by(WorkflowTemplate.name)
    rows = (await db.execute(q)).scalars().all()
    return [TemplateOut.model_validate(r) for r in rows]


@router.post(
    "/workflow-templates/{template_id}/clone",
    response_model=WorkflowDetailOut,
    status_code=status.HTTP_201_CREATED,
)
async def clone_template(
    template_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    """Clone a template into a new workflow with its nodes."""
    result = await db.execute(select(WorkflowTemplate).where(WorkflowTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    wf_json: dict = template.workflow_json or {}

    wf = Workflow(
        name=f"{template.name} (Copy)",
        description=template.description,
        trigger_type=wf_json.get("trigger_type", "manual"),
        trigger_config=wf_json.get("trigger_config"),
        status="draft",
        execution_count=0,
        owner_id=current_user.id,
    )
    db.add(wf)
    await db.flush()

    # Map old node IDs to new node IDs for link resolution
    nodes_data: list[dict] = wf_json.get("nodes", [])
    old_to_new: dict[str, uuid.UUID] = {}

    # First pass: create nodes without links
    created_nodes: list[WorkflowNode] = []
    for nd in nodes_data:
        old_id = nd.get("id", str(uuid.uuid4()))
        new_id = uuid.uuid4()
        old_to_new[old_id] = new_id

        node = WorkflowNode(
            id=new_id,
            workflow_id=wf.id,
            node_type=nd.get("node_type", "action"),
            position_x=nd.get("position_x", 0),
            position_y=nd.get("position_y", 0),
            config=nd.get("config"),
        )
        db.add(node)
        created_nodes.append(node)

    await db.flush()

    # Second pass: resolve links
    for nd, node in zip(nodes_data, created_nodes):
        if nd.get("next_node_id") and nd["next_node_id"] in old_to_new:
            node.next_node_id = old_to_new[nd["next_node_id"]]
        if nd.get("true_branch_node_id") and nd["true_branch_node_id"] in old_to_new:
            node.true_branch_node_id = old_to_new[nd["true_branch_node_id"]]
        if nd.get("false_branch_node_id") and nd["false_branch_node_id"] in old_to_new:
            node.false_branch_node_id = old_to_new[nd["false_branch_node_id"]]

    await db.commit()
    await db.refresh(wf, attribute_names=["nodes"])
    return wf
