"""HR ATS API — Applicant Tracking System: requisitions, candidates, applications, interviews."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.core.sanitize import like_pattern
from app.models.hr_phase2 import (
    Candidate,
    CandidateApplication,
    Interview,
    JobRequisition,
)

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

# -- Job Requisition schemas --


class RequisitionCreate(BaseModel):
    title: str
    department_id: uuid.UUID | None = None
    hiring_manager_id: uuid.UUID | None = None
    job_type: str = "full_time"
    location: str | None = None
    remote_policy: str = "onsite"
    salary_min: Decimal | None = None
    salary_max: Decimal | None = None
    currency: str = "USD"
    headcount: int = 1
    description: str | None = None
    requirements: str | None = None
    skills_required: list[str] | None = None
    target_hire_date: str | None = None  # ISO date string


class RequisitionUpdate(BaseModel):
    title: str | None = None
    department_id: uuid.UUID | None = None
    hiring_manager_id: uuid.UUID | None = None
    job_type: str | None = None
    location: str | None = None
    remote_policy: str | None = None
    salary_min: Decimal | None = None
    salary_max: Decimal | None = None
    currency: str | None = None
    headcount: int | None = None
    description: str | None = None
    requirements: str | None = None
    skills_required: list[str] | None = None
    target_hire_date: str | None = None


class RequisitionOut(BaseModel):
    id: uuid.UUID
    title: str
    department_id: uuid.UUID | None
    hiring_manager_id: uuid.UUID | None
    job_type: str
    location: str | None
    remote_policy: str
    salary_min: Decimal | None
    salary_max: Decimal | None
    currency: str
    headcount: int
    description: str | None
    requirements: str | None
    skills_required: list | None
    status: str
    published_at: Any
    target_hire_date: Any
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Candidate schemas --


class CandidateCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str | None = None
    linkedin_url: str | None = None
    resume_file_id: uuid.UUID | None = None
    resume_file_name: str | None = None
    source: str | None = None
    notes: str | None = None


class CandidateUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    linkedin_url: str | None = None
    resume_file_id: uuid.UUID | None = None
    resume_file_name: str | None = None
    source: str | None = None
    notes: str | None = None
    skills_extracted: list | None = None
    ai_summary: str | None = None


class CandidateOut(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    email: str
    phone: str | None
    linkedin_url: str | None
    resume_file_id: uuid.UUID | None
    resume_file_name: str | None
    skills_extracted: list | None
    ai_summary: str | None
    source: str | None
    is_blacklisted: bool
    notes: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Application schemas --


class ApplicationCreate(BaseModel):
    candidate_id: uuid.UUID
    requisition_id: uuid.UUID
    notes: str | None = None


class ApplicationStageUpdate(BaseModel):
    stage: str
    notes: str | None = None
    rejection_reason: str | None = None


class ApplicationAssignUpdate(BaseModel):
    user_id: uuid.UUID


class ApplicationOfferUpdate(BaseModel):
    offer_amount: Decimal


class ApplicationOut(BaseModel):
    id: uuid.UUID
    candidate_id: uuid.UUID
    requisition_id: uuid.UUID
    stage: str
    ai_match_score: int | None
    ai_match_notes: str | None
    rejection_reason: str | None
    offer_amount: Decimal | None
    notes: str | None
    assigned_to: uuid.UUID | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Interview schemas --


class InterviewCreate(BaseModel):
    application_id: uuid.UUID
    interview_type: str = "video"
    scheduled_at: datetime
    duration_minutes: int = 60
    interviewer_ids: list[uuid.UUID] | None = None


class InterviewFeedbackUpdate(BaseModel):
    feedback: str
    rating: int
    recommendation: str
    status: str


class InterviewOut(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    interview_type: str
    scheduled_at: Any
    duration_minutes: int
    interviewer_ids: list | None
    meeting_url: str | None
    calendar_event_id: uuid.UUID | None
    status: str
    feedback: str | None
    rating: int | None
    recommendation: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Job Requisition endpoints ──────────────────────────────────────────────────


@router.get("/requisitions", summary="List job requisitions with filters")
async def list_requisitions(
    current_user: CurrentUser,
    db: DBSession,
    req_status: str | None = Query(None, alias="status"),
    department_id: uuid.UUID | None = Query(None),
    hiring_manager_id: uuid.UUID | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(JobRequisition)

    if req_status:
        query = query.where(JobRequisition.status == req_status)
    if department_id:
        query = query.where(JobRequisition.department_id == department_id)
    if hiring_manager_id:
        query = query.where(JobRequisition.hiring_manager_id == hiring_manager_id)
    if search:
        pattern = like_pattern(search)
        query = query.where(
            or_(
                JobRequisition.title.ilike(pattern),
                JobRequisition.location.ilike(pattern),
            )
        )

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    query = (
        query.order_by(JobRequisition.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "items": [RequisitionOut.model_validate(r).model_dump() for r in items],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post(
    "/requisitions",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new job requisition",
)
async def create_requisition(
    payload: RequisitionCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    from datetime import date as date_type

    target_date = None
    if payload.target_hire_date:
        target_date = date_type.fromisoformat(payload.target_hire_date)

    req = JobRequisition(
        title=payload.title,
        department_id=payload.department_id,
        hiring_manager_id=payload.hiring_manager_id,
        job_type=payload.job_type,
        location=payload.location,
        remote_policy=payload.remote_policy,
        salary_min=payload.salary_min,
        salary_max=payload.salary_max,
        currency=payload.currency,
        headcount=payload.headcount,
        description=payload.description,
        requirements=payload.requirements,
        skills_required=payload.skills_required,
        target_hire_date=target_date,
        status="draft",
        created_by=current_user.id,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return RequisitionOut.model_validate(req).model_dump()


@router.get("/requisitions/{req_id}", summary="Get requisition detail with application count")
async def get_requisition(
    req_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    req = await db.get(JobRequisition, req_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requisition not found")

    count_result = await db.execute(
        select(func.count()).where(CandidateApplication.requisition_id == req_id)
    )
    application_count = count_result.scalar() or 0

    data = RequisitionOut.model_validate(req).model_dump()
    data["application_count"] = application_count
    return data


@router.put("/requisitions/{req_id}", summary="Update a job requisition")
async def update_requisition(
    req_id: uuid.UUID,
    payload: RequisitionUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    req = await db.get(JobRequisition, req_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requisition not found")

    if req.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update a cancelled requisition",
        )

    # Only the hiring manager or an HR admin may update
    if (
        not current_user.is_superadmin
        and req.hiring_manager_id != current_user.id
    ):
        from app.core.rbac import is_app_admin

        if not await is_app_admin(db, str(current_user.id), "hr"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the hiring manager or an HR admin can update this requisition",
            )

    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "target_hire_date" and value is not None:
            from datetime import date as date_type
            value = date_type.fromisoformat(value)
        setattr(req, field, value)

    await db.commit()
    await db.refresh(req)
    return RequisitionOut.model_validate(req).model_dump()


@router.delete(
    "/requisitions/{req_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel (soft-delete) a requisition",
)
async def cancel_requisition(
    req_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
):
    req = await db.get(JobRequisition, req_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requisition not found")

    req.status = "cancelled"
    await db.commit()


@router.post("/requisitions/{req_id}/publish", summary="Publish a requisition (set status=open)")
async def publish_requisition(
    req_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    req = await db.get(JobRequisition, req_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requisition not found")

    if req.status not in ("draft", "on_hold"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot publish a requisition with status '{req.status}'",
        )

    req.status = "open"
    req.published_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(req)
    return RequisitionOut.model_validate(req).model_dump()


@router.post("/requisitions/{req_id}/close", summary="Close a requisition (set status=filled)")
async def close_requisition(
    req_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    req = await db.get(JobRequisition, req_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requisition not found")

    if req.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot close a cancelled requisition",
        )

    req.status = "filled"
    await db.commit()
    await db.refresh(req)
    return RequisitionOut.model_validate(req).model_dump()


@router.get(
    "/requisitions/{req_id}/pipeline",
    summary="Get applications grouped by pipeline stage with counts",
)
async def get_requisition_pipeline(
    req_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    req = await db.get(JobRequisition, req_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requisition not found")

    stage_counts_result = await db.execute(
        select(CandidateApplication.stage, func.count().label("count"))
        .where(CandidateApplication.requisition_id == req_id)
        .group_by(CandidateApplication.stage)
    )
    rows = stage_counts_result.all()

    all_stages = ["applied", "screening", "interview", "offer", "hired", "rejected"]
    stage_map: dict[str, int] = {s: 0 for s in all_stages}
    for row in rows:
        stage_map[row.stage] = row.count

    apps_result = await db.execute(
        select(CandidateApplication)
        .where(CandidateApplication.requisition_id == req_id)
        .options(selectinload(CandidateApplication.candidate))
        .order_by(CandidateApplication.created_at.desc())
    )
    apps = apps_result.scalars().all()

    grouped: dict[str, list[dict]] = {s: [] for s in all_stages}
    for app in apps:
        grouped[app.stage].append(ApplicationOut.model_validate(app).model_dump())

    return {
        "requisition_id": str(req_id),
        "stage_counts": stage_map,
        "pipeline": grouped,
    }


# ── Candidate endpoints ────────────────────────────────────────────────────────


@router.get("/candidates", summary="List candidates with search and source filter")
async def list_candidates(
    current_user: CurrentUser,
    db: DBSession,
    search: str | None = Query(None),
    source: str | None = Query(None),
    is_blacklisted: bool | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Candidate)

    if search:
        pattern = like_pattern(search)
        query = query.where(
            or_(
                Candidate.first_name.ilike(pattern),
                Candidate.last_name.ilike(pattern),
                Candidate.email.ilike(pattern),
            )
        )
    if source:
        query = query.where(Candidate.source == source)
    if is_blacklisted is not None:
        query = query.where(Candidate.is_blacklisted == is_blacklisted)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    query = (
        query.order_by(Candidate.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "items": [CandidateOut.model_validate(c).model_dump() for c in items],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post(
    "/candidates",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new candidate profile",
)
async def create_candidate(
    payload: CandidateCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    # Prevent duplicate candidates by email
    existing_result = await db.execute(
        select(Candidate).where(Candidate.email == payload.email)
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A candidate with email '{payload.email}' already exists",
        )

    candidate = Candidate(
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        phone=payload.phone,
        linkedin_url=payload.linkedin_url,
        resume_file_id=payload.resume_file_id,
        resume_file_name=payload.resume_file_name,
        source=payload.source,
        notes=payload.notes,
    )
    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)
    return CandidateOut.model_validate(candidate).model_dump()


@router.get("/candidates/{cand_id}", summary="Get candidate detail with all applications")
async def get_candidate(
    cand_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(Candidate)
        .where(Candidate.id == cand_id)
        .options(selectinload(Candidate.applications))
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    data = CandidateOut.model_validate(candidate).model_dump()
    data["applications"] = [
        ApplicationOut.model_validate(a).model_dump() for a in candidate.applications
    ]
    return data


@router.put("/candidates/{cand_id}", summary="Update candidate profile")
async def update_candidate(
    cand_id: uuid.UUID,
    payload: CandidateUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    candidate = await db.get(Candidate, cand_id)
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    if candidate.is_blacklisted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update a blacklisted candidate",
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(candidate, field, value)

    await db.commit()
    await db.refresh(candidate)
    return CandidateOut.model_validate(candidate).model_dump()


@router.post("/candidates/{cand_id}/blacklist", summary="Blacklist a candidate")
async def blacklist_candidate(
    cand_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    candidate = await db.get(Candidate, cand_id)
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    candidate.is_blacklisted = True
    await db.commit()
    await db.refresh(candidate)
    return CandidateOut.model_validate(candidate).model_dump()


class AIScreenRequest(BaseModel):
    candidate_id: uuid.UUID
    requisition_id: uuid.UUID


@router.post("/candidates/ai-screen", summary="Queue AI resume screening for a candidate/requisition pair")
async def ai_screen_candidate(
    payload: AIScreenRequest,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    candidate = await db.get(Candidate, payload.candidate_id)
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    req = await db.get(JobRequisition, payload.requisition_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requisition not found")

    if candidate.is_blacklisted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot screen a blacklisted candidate",
        )

    await event_bus.publish(
        "ats.ai_screen_requested",
        {
            "candidate_id": str(payload.candidate_id),
            "requisition_id": str(payload.requisition_id),
            "requested_by": str(current_user.id),
        },
    )

    return {"status": "screening_queued"}


# ── Application endpoints ──────────────────────────────────────────────────────


@router.get("/applications", summary="List applications with requisition, stage, and assignee filters")
async def list_applications(
    current_user: CurrentUser,
    db: DBSession,
    requisition_id: uuid.UUID | None = Query(None),
    stage: str | None = Query(None),
    assigned_to: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(CandidateApplication)

    if requisition_id:
        query = query.where(CandidateApplication.requisition_id == requisition_id)
    if stage:
        query = query.where(CandidateApplication.stage == stage)
    if assigned_to:
        query = query.where(CandidateApplication.assigned_to == assigned_to)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    query = (
        query.order_by(CandidateApplication.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "items": [ApplicationOut.model_validate(a).model_dump() for a in items],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post(
    "/applications",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new candidate application",
)
async def create_application(
    payload: ApplicationCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    candidate = await db.get(Candidate, payload.candidate_id)
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    if candidate.is_blacklisted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Blacklisted candidates cannot submit applications",
        )

    req = await db.get(JobRequisition, payload.requisition_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requisition not found")

    if req.status != "open":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requisition is not open for applications (status='{req.status}')",
        )

    # Prevent duplicate applications
    dupe_result = await db.execute(
        select(CandidateApplication).where(
            and_(
                CandidateApplication.candidate_id == payload.candidate_id,
                CandidateApplication.requisition_id == payload.requisition_id,
            )
        )
    )
    if dupe_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This candidate already has an application for that requisition",
        )

    application = CandidateApplication(
        candidate_id=payload.candidate_id,
        requisition_id=payload.requisition_id,
        stage="applied",
        notes=payload.notes,
    )
    db.add(application)
    await db.commit()
    await db.refresh(application)
    return ApplicationOut.model_validate(application).model_dump()


@router.get("/applications/{app_id}", summary="Get application detail with interviews")
async def get_application(
    app_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(CandidateApplication)
        .where(CandidateApplication.id == app_id)
        .options(
            selectinload(CandidateApplication.interviews),
            selectinload(CandidateApplication.candidate),
        )
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    data = ApplicationOut.model_validate(application).model_dump()
    data["interviews"] = [
        InterviewOut.model_validate(i).model_dump() for i in application.interviews
    ]
    data["candidate"] = CandidateOut.model_validate(application.candidate).model_dump()
    return data


@router.put("/applications/{app_id}/stage", summary="Advance or change an application stage")
async def update_application_stage(
    app_id: uuid.UUID,
    payload: ApplicationStageUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    valid_stages = {"applied", "screening", "interview", "offer", "hired", "rejected"}
    if payload.stage not in valid_stages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid stage '{payload.stage}'. Must be one of: {', '.join(sorted(valid_stages))}",
        )

    application = await db.get(CandidateApplication, app_id)
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    previous_stage = application.stage
    application.stage = payload.stage
    if payload.notes is not None:
        application.notes = payload.notes
    if payload.rejection_reason is not None:
        application.rejection_reason = payload.rejection_reason

    await db.commit()
    await db.refresh(application)

    await event_bus.publish(
        "ats.application_stage_changed",
        {
            "application_id": str(app_id),
            "candidate_id": str(application.candidate_id),
            "requisition_id": str(application.requisition_id),
            "previous_stage": previous_stage,
            "new_stage": payload.stage,
            "changed_by": str(current_user.id),
        },
    )

    return ApplicationOut.model_validate(application).model_dump()


@router.put("/applications/{app_id}/assign", summary="Assign application to a recruiter/user")
async def assign_application(
    app_id: uuid.UUID,
    payload: ApplicationAssignUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    application = await db.get(CandidateApplication, app_id)
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    application.assigned_to = payload.user_id
    await db.commit()
    await db.refresh(application)
    return ApplicationOut.model_validate(application).model_dump()


@router.put("/applications/{app_id}/offer", summary="Set offer amount and advance to offer stage")
async def set_application_offer(
    app_id: uuid.UUID,
    payload: ApplicationOfferUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    application = await db.get(CandidateApplication, app_id)
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    if application.stage in ("hired", "rejected"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot set an offer on an application with stage '{application.stage}'",
        )

    application.offer_amount = payload.offer_amount
    application.stage = "offer"
    await db.commit()
    await db.refresh(application)

    await event_bus.publish(
        "ats.application_stage_changed",
        {
            "application_id": str(app_id),
            "candidate_id": str(application.candidate_id),
            "requisition_id": str(application.requisition_id),
            "previous_stage": "interview",
            "new_stage": "offer",
            "offer_amount": str(payload.offer_amount),
            "changed_by": str(current_user.id),
        },
    )

    return ApplicationOut.model_validate(application).model_dump()


# ── Interview endpoints ────────────────────────────────────────────────────────


@router.get("/interviews", summary="List interviews with application_id and status filters")
async def list_interviews(
    current_user: CurrentUser,
    db: DBSession,
    application_id: uuid.UUID | None = Query(None),
    interview_status: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Interview)

    if application_id:
        query = query.where(Interview.application_id == application_id)
    if interview_status:
        query = query.where(Interview.status == interview_status)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    query = (
        query.order_by(Interview.scheduled_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "items": [InterviewOut.model_validate(i).model_dump() for i in items],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post(
    "/interviews",
    status_code=status.HTTP_201_CREATED,
    summary="Schedule an interview; auto-generates Jitsi link for video type",
)
async def create_interview(
    payload: InterviewCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    application = await db.get(CandidateApplication, payload.application_id)
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    if application.stage in ("hired", "rejected"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot schedule an interview for an application with stage '{application.stage}'",
        )

    meeting_url: str | None = None
    if payload.interview_type == "video":
        from uuid import uuid4
        meeting_url = f"https://meet.jit.si/hr-interview-{uuid4().hex[:8]}"

    interview = Interview(
        application_id=payload.application_id,
        interview_type=payload.interview_type,
        scheduled_at=payload.scheduled_at,
        duration_minutes=payload.duration_minutes,
        interviewer_ids=[str(uid) for uid in payload.interviewer_ids] if payload.interviewer_ids else None,
        meeting_url=meeting_url,
        status="scheduled",
    )
    db.add(interview)
    await db.commit()
    await db.refresh(interview)

    await event_bus.publish(
        "ats.interview_scheduled",
        {
            "interview_id": str(interview.id),
            "application_id": str(payload.application_id),
            "candidate_id": str(application.candidate_id),
            "requisition_id": str(application.requisition_id),
            "interview_type": payload.interview_type,
            "scheduled_at": payload.scheduled_at.isoformat(),
            "meeting_url": meeting_url,
            "scheduled_by": str(current_user.id),
        },
    )

    return InterviewOut.model_validate(interview).model_dump()


@router.get("/interviews/{int_id}", summary="Get interview detail")
async def get_interview(
    int_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    interview = await db.get(Interview, int_id)
    if not interview:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found")
    return InterviewOut.model_validate(interview).model_dump()


@router.put("/interviews/{int_id}/feedback", summary="Submit feedback and outcome for an interview")
async def submit_interview_feedback(
    int_id: uuid.UUID,
    payload: InterviewFeedbackUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    valid_recommendations = {"advance", "reject", "hold"}
    if payload.recommendation not in valid_recommendations:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"recommendation must be one of: {', '.join(sorted(valid_recommendations))}",
        )
    if not (1 <= payload.rating <= 5):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="rating must be between 1 and 5",
        )

    interview = await db.get(Interview, int_id)
    if not interview:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found")

    if interview.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot submit feedback for a cancelled interview",
        )

    interview.feedback = payload.feedback
    interview.rating = payload.rating
    interview.recommendation = payload.recommendation
    interview.status = payload.status
    await db.commit()
    await db.refresh(interview)
    return InterviewOut.model_validate(interview).model_dump()


@router.delete(
    "/interviews/{int_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel an interview",
    response_model=None,
)
async def cancel_interview(
    int_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
):
    interview = await db.get(Interview, int_id)
    if not interview:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found")

    if interview.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interview is already cancelled",
        )

    interview.status = "cancelled"
    await db.commit()


# ── ATS Dashboard endpoints ────────────────────────────────────────────────────


@router.get("/ats/dashboard", summary="ATS overview dashboard statistics")
async def ats_dashboard(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Open requisitions count
    open_req_result = await db.execute(
        select(func.count()).where(JobRequisition.status == "open")
    )
    open_requisitions: int = open_req_result.scalar() or 0

    # Total candidates
    total_cand_result = await db.execute(
        select(func.count()).select_from(select(Candidate).subquery())
    )
    total_candidates: int = total_cand_result.scalar() or 0

    # Applications by stage
    stage_result = await db.execute(
        select(CandidateApplication.stage, func.count().label("count"))
        .group_by(CandidateApplication.stage)
    )
    applications_by_stage: dict[str, int] = {row.stage: row.count for row in stage_result.all()}

    # Average time-to-hire in days (applications that reached hired stage)
    # Uses extract(epoch from ...) / 86400 for portability; SQLAlchemy renders on PG
    avg_days_result = await db.execute(
        select(
            func.avg(
                func.extract(
                    "epoch",
                    CandidateApplication.updated_at - CandidateApplication.created_at,
                )
                / 86400.0
            )
        ).where(CandidateApplication.stage == "hired")
    )
    avg_raw = avg_days_result.scalar()
    avg_time_to_hire_days: float | None = round(float(avg_raw), 1) if avg_raw is not None else None

    # Interviews scheduled this week (Mon–Sun)
    now = datetime.now(timezone.utc)
    week_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = week_start.replace(day=now.day - now.weekday())
    week_end = week_start.replace(day=week_start.day + 7)

    interviews_week_result = await db.execute(
        select(func.count()).where(
            and_(
                Interview.scheduled_at >= week_start,
                Interview.scheduled_at < week_end,
                Interview.status != "cancelled",
            )
        )
    )
    interviews_this_week: int = interviews_week_result.scalar() or 0

    return {
        "open_requisitions": open_requisitions,
        "total_candidates": total_candidates,
        "applications_by_stage": applications_by_stage,
        "avg_time_to_hire_days": avg_time_to_hire_days,
        "interviews_this_week": interviews_this_week,
    }


@router.get("/ats/diversity", summary="D&I analytics: source breakdown and stage conversion rates")
async def ats_diversity(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Applications per source (via candidate.source)
    source_result = await db.execute(
        select(Candidate.source, func.count().label("count"))
        .join(CandidateApplication, CandidateApplication.candidate_id == Candidate.id)
        .group_by(Candidate.source)
        .order_by(func.count().desc())
    )
    applications_per_source: dict[str, int] = {
        (row.source or "unknown"): row.count for row in source_result.all()
    }

    # Stage conversion rates: count of applications that have ever reached each stage
    # (current stage represents furthest point reached in the pipeline)
    pipeline_stages = ["applied", "screening", "interview", "offer", "hired"]
    stage_totals_result = await db.execute(
        select(CandidateApplication.stage, func.count().label("count"))
        .where(CandidateApplication.stage.in_(pipeline_stages))
        .group_by(CandidateApplication.stage)
    )
    stage_counts: dict[str, int] = {row.stage: row.count for row in stage_totals_result.all()}

    # Include rejected applications in the base denominator
    rejected_result = await db.execute(
        select(func.count()).where(CandidateApplication.stage == "rejected")
    )
    rejected_count: int = rejected_result.scalar() or 0

    total_apps = sum(stage_counts.values()) + rejected_count
    conversion_rates: dict[str, float] = {}
    if total_apps > 0:
        for stage in pipeline_stages:
            count = stage_counts.get(stage, 0)
            conversion_rates[stage] = round((count / total_apps) * 100, 1)

    # Stage-to-stage drop-off rates
    stage_funnel: list[dict[str, Any]] = []
    prev_count: int | None = None
    for stage in pipeline_stages:
        count = stage_counts.get(stage, 0)
        drop_off_pct: float | None = None
        if prev_count is not None and prev_count > 0:
            drop_off_pct = round(((prev_count - count) / prev_count) * 100, 1)
        stage_funnel.append(
            {
                "stage": stage,
                "count": count,
                "conversion_from_applied_pct": conversion_rates.get(stage),
                "drop_off_from_prev_pct": drop_off_pct,
            }
        )
        prev_count = count

    return {
        "total_applications": total_apps,
        "applications_per_source": applications_per_source,
        "stage_conversion_rates": conversion_rates,
        "stage_funnel": stage_funnel,
        "rejected_count": rejected_count,
    }
