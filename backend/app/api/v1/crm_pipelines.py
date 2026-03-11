"""CRM Pipelines — multi-pipeline CRUD + board view + what-if forecast."""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.models.crm import Opportunity, Pipeline

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────


class PipelineCreate(BaseModel):
    name: str
    description: str | None = None
    stages: list[dict] | None = None  # [{name, probability, color, position}]
    is_default: bool = False


class PipelineUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    stages: list[dict] | None = None
    is_default: bool | None = None
    is_active: bool | None = None


class PipelineOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    stages: dict | None
    is_default: bool
    is_active: bool
    owner_id: uuid.UUID
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/pipelines", summary="List pipelines")
async def list_pipelines(
    current_user: CurrentUser,
    db: DBSession,
    active_only: bool = Query(True),
) -> dict[str, Any]:
    query = select(Pipeline)
    if active_only:
        query = query.where(Pipeline.is_active.is_(True))
    query = query.order_by(Pipeline.is_default.desc(), Pipeline.name)
    result = await db.execute(query)
    pipelines = result.scalars().all()
    return {"pipelines": [PipelineOut.model_validate(p).model_dump() for p in pipelines]}


@router.post("/pipelines", status_code=201, summary="Create a pipeline")
async def create_pipeline(
    payload: PipelineCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # If default, unset other defaults
    if payload.is_default:
        await db.execute(
            Pipeline.__table__.update().values(is_default=False)
        )
    pipeline = Pipeline(
        name=payload.name,
        description=payload.description,
        stages=payload.stages,
        is_default=payload.is_default,
        owner_id=current_user.id,
    )
    db.add(pipeline)
    await db.commit()
    await db.refresh(pipeline)
    return PipelineOut.model_validate(pipeline).model_dump()


@router.put("/pipelines/{pipeline_id}", summary="Update a pipeline")
async def update_pipeline(
    pipeline_id: uuid.UUID,
    payload: PipelineUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    pipeline = await db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if payload.is_default:
        await db.execute(
            Pipeline.__table__.update().values(is_default=False)
        )
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(pipeline, k, v)
    await db.commit()
    await db.refresh(pipeline)
    return PipelineOut.model_validate(pipeline).model_dump()


@router.delete("/pipelines/{pipeline_id}", status_code=204, summary="Delete a pipeline")
async def delete_pipeline(
    pipeline_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    pipeline = await db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    # Check if opportunities exist
    count = (await db.execute(
        select(func.count()).where(Opportunity.pipeline_id == pipeline_id)
    )).scalar() or 0
    if count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {count} opportunities still in this pipeline")
    await db.delete(pipeline)
    await db.commit()
    return Response(status_code=204)


@router.get("/pipelines/{pipeline_id}/board", summary="Pipeline board view")
async def pipeline_board(
    pipeline_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    swimlane: str | None = Query(None, description="Group by: owner, priority, source"),
) -> dict[str, Any]:
    pipeline = await db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    query = select(Opportunity).where(Opportunity.pipeline_id == pipeline_id)
    result = await db.execute(query)
    opps = result.scalars().all()

    stages = pipeline.stages or []
    stage_names = [s["name"] for s in stages] if stages else [
        "prospecting", "proposal", "negotiation", "closed_won", "closed_lost"
    ]

    board: dict[str, list] = {stage: [] for stage in stage_names}
    for opp in opps:
        stage_key = opp.stage if opp.stage in board else "prospecting"
        card = {
            "id": str(opp.id),
            "title": opp.title,
            "stage": opp.stage,
            "expected_value": float(opp.expected_value or 0),
            "probability": opp.probability,
            "weighted_value": float(opp.weighted_value or 0),
            "expected_close_date": str(opp.expected_close_date) if opp.expected_close_date else None,
            "assigned_to": str(opp.assigned_to) if opp.assigned_to else None,
            "swimlane": opp.swimlane,
        }
        board[stage_key].append(card)

    # Swimlane grouping
    swimlane_data = None
    if swimlane:
        swimlane_data = {}
        for opp in opps:
            key = str(getattr(opp, swimlane, "Other") or "Other")
            swimlane_data.setdefault(key, {stage: [] for stage in stage_names})
            stage_key = opp.stage if opp.stage in board else "prospecting"
            swimlane_data[key][stage_key].append({
                "id": str(opp.id),
                "title": opp.title,
                "expected_value": float(opp.expected_value or 0),
            })

    return {
        "pipeline": PipelineOut.model_validate(pipeline).model_dump(),
        "stages": stage_names,
        "board": board,
        "swimlanes": swimlane_data,
        "total_opportunities": len(opps),
    }


@router.get("/pipelines/{pipeline_id}/forecast", summary="What-if pipeline forecast")
async def pipeline_forecast(
    pipeline_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    probability_adjustment: int = Query(0, description="Adjust all probabilities by this %"),
) -> dict[str, Any]:
    pipeline = await db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    result = await db.execute(
        select(Opportunity).where(
            Opportunity.pipeline_id == pipeline_id,
            Opportunity.stage.notin_(["closed_won", "closed_lost"]),
        )
    )
    opps = result.scalars().all()

    total_value = Decimal("0")
    weighted_value = Decimal("0")
    by_stage: dict[str, dict] = {}

    for opp in opps:
        val = opp.expected_value or Decimal("0")
        prob = min(100, max(0, (opp.probability or 50) + probability_adjustment))
        w = val * Decimal(str(prob)) / Decimal("100")
        total_value += val
        weighted_value += w
        stage = opp.stage
        if stage not in by_stage:
            by_stage[stage] = {"count": 0, "total_value": Decimal("0"), "weighted_value": Decimal("0")}
        by_stage[stage]["count"] += 1
        by_stage[stage]["total_value"] += val
        by_stage[stage]["weighted_value"] += w

    return {
        "pipeline_id": str(pipeline_id),
        "probability_adjustment": probability_adjustment,
        "total_opportunities": len(opps),
        "total_value": float(total_value),
        "weighted_forecast": float(weighted_value),
        "by_stage": {k: {"count": v["count"], "total_value": float(v["total_value"]), "weighted_value": float(v["weighted_value"])} for k, v in by_stage.items()},
    }
