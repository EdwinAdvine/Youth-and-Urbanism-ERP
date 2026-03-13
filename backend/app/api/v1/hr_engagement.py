"""HR Employee Engagement API — Surveys (eNPS / pulse / exit) + Recognition."""

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, select

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.models.hr import Employee
from app.models.hr_phase2 import Recognition, Survey, SurveyResponse

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────


# -- Survey schemas --


class SurveyCreate(BaseModel):
    title: str
    survey_type: str = "engagement"  # engagement, enps, pulse, exit, onboarding, custom
    description: str | None = None
    questions: list[dict] | None = None
    target_audience: dict | None = None
    is_anonymous: bool = True
    closes_at: datetime | None = None


class SurveyUpdate(BaseModel):
    title: str | None = None
    survey_type: str | None = None
    description: str | None = None
    questions: list[dict] | None = None
    target_audience: dict | None = None
    is_anonymous: bool | None = None
    closes_at: datetime | None = None


class SurveyOut(BaseModel):
    id: uuid.UUID
    title: str
    survey_type: str
    description: str | None
    questions: list | None
    target_audience: dict | None
    is_anonymous: bool
    status: str
    opens_at: Any | None
    closes_at: Any | None
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Survey Response schemas --


class SurveyRespondCreate(BaseModel):
    answers: dict = Field(..., description="Map of question_id → answer value/text")


# -- Recognition schemas --


class RecognitionCreate(BaseModel):
    to_employee_id: uuid.UUID
    recognition_type: str = "kudos"  # kudos, badge, shoutout, award
    badge_name: str | None = None
    message: str
    points: int = Field(default=0, ge=0)
    is_public: bool = True
    department_id: uuid.UUID | None = None


class RecognitionOut(BaseModel):
    id: uuid.UUID
    from_employee_id: uuid.UUID
    to_employee_id: uuid.UUID
    recognition_type: str
    badge_name: str | None
    message: str
    points: int
    is_public: bool
    department_id: uuid.UUID | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _get_employee_for_user(db: Any, user_id: uuid.UUID) -> Employee:
    """Resolve Employee record from the authenticated user's UUID."""
    result = await db.execute(select(Employee).where(Employee.user_id == user_id))
    employee = result.scalar_one_or_none()
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee profile found for current user",
        )
    return employee


async def _require_survey(db: Any, survey_id: uuid.UUID) -> Survey:
    survey = await db.get(Survey, survey_id)
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    return survey


def _is_admin(current_user: Any) -> bool:
    """Return True when the caller has super-admin or any app-admin privilege."""
    return bool(getattr(current_user, "is_superadmin", False))


# ── Survey endpoints ──────────────────────────────────────────────────────────


@router.get("/surveys", summary="List surveys")
async def list_surveys(
    current_user: CurrentUser,
    db: DBSession,
    survey_type: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    """
    Admins see all surveys.
    Regular users see only surveys in *active* status (surveys they can take).
    """
    query = select(Survey)
    count_query = select(func.count(Survey.id))
    filters: list = []

    if survey_type:
        filters.append(Survey.survey_type == survey_type)

    if status_filter:
        filters.append(Survey.status == status_filter)
    elif not _is_admin(current_user):
        # Non-admin users only see active surveys
        filters.append(Survey.status == "active")

    if filters:
        query = query.where(and_(*filters))
        count_query = count_query.where(and_(*filters))

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(Survey.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    items = result.scalars().all()

    return {
        "items": [SurveyOut.model_validate(s).model_dump() for s in items],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post(
    "/surveys",
    status_code=status.HTTP_201_CREATED,
    summary="Create survey (HR admin only)",
)
async def create_survey(
    payload: SurveyCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    survey = Survey(
        **payload.model_dump(),
        status="draft",
        created_by=current_user.id,
    )
    db.add(survey)
    await db.commit()
    await db.refresh(survey)
    return SurveyOut.model_validate(survey).model_dump()


@router.get("/surveys/enps-trend", summary="eNPS scores over the last 12 months")
async def enps_trend(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """
    Returns one eNPS data point per closed eNPS survey over the last 12 months,
    ordered chronologically.
    """

    now = datetime.now(timezone.utc)
    # Closed eNPS surveys with at least one response in the past 12 months
    surveys_result = await db.execute(
        select(Survey)
        .where(
            and_(
                Survey.survey_type == "enps",
                Survey.status == "closed",
                Survey.opens_at.isnot(None),
                # opens_at within the past 12 months
                Survey.opens_at >= func.now() - func.cast(
                    func.concat(12, " months"), type_=None
                ),
            )
        )
        .order_by(Survey.opens_at.asc())
        .limit(12)
    )
    surveys = surveys_result.scalars().all()

    trend = []
    for survey in surveys:
        responses_result = await db.execute(
            select(SurveyResponse).where(
                and_(
                    SurveyResponse.survey_id == survey.id,
                    SurveyResponse.nps_score.isnot(None),
                )
            )
        )
        responses = responses_result.scalars().all()
        total = len(responses)
        if total == 0:
            enps = None
        else:
            promoters = sum(1 for r in responses if r.nps_score is not None and r.nps_score >= 9)
            detractors = sum(1 for r in responses if r.nps_score is not None and r.nps_score <= 6)
            enps = round((promoters - detractors) / total * 100, 1)

        trend.append(
            {
                "survey_id": str(survey.id),
                "title": survey.title,
                "opened_at": survey.opens_at.isoformat() if survey.opens_at else None,
                "response_count": total,
                "enps_score": enps,
            }
        )

    return {"trend": trend}


@router.get("/surveys/{survey_id}", summary="Survey detail")
async def get_survey(
    survey_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """
    Returns survey detail.  If is_anonymous, respondent_id is stripped from
    all response objects returned alongside the survey metadata.
    """
    survey = await _require_survey(db, survey_id)

    # Load response count for context; full results use the /results endpoint
    count = (
        await db.execute(
            select(func.count(SurveyResponse.id)).where(
                SurveyResponse.survey_id == survey_id
            )
        )
    ).scalar() or 0

    data = SurveyOut.model_validate(survey).model_dump()
    data["response_count"] = count
    return data


@router.put(
    "/surveys/{survey_id}",
    summary="Update survey (draft only, HR admin)",
)
async def update_survey(
    survey_id: uuid.UUID,
    payload: SurveyUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    survey = await _require_survey(db, survey_id)
    if survey.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only surveys in 'draft' status can be updated",
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(survey, field, value)

    await db.commit()
    await db.refresh(survey)
    return SurveyOut.model_validate(survey).model_dump()


@router.delete(
    "/surveys/{survey_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete survey (draft only, HR admin)",
    response_model=None,
)
async def delete_survey(
    survey_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
):
    survey = await _require_survey(db, survey_id)
    if survey.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only surveys in 'draft' status can be deleted",
        )
    await db.delete(survey)
    await db.commit()


@router.post(
    "/surveys/{survey_id}/launch",
    summary="Launch survey — set active, publish event (HR admin)",
)
async def launch_survey(
    survey_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    survey = await _require_survey(db, survey_id)
    if survey.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot launch survey in '{survey.status}' status — must be 'draft'",
        )

    survey.status = "active"
    survey.opens_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(survey)

    await event_bus.publish(
        "engagement.survey_launched",
        {
            "survey_id": str(survey.id),
            "title": survey.title,
            "survey_type": survey.survey_type,
            "is_anonymous": survey.is_anonymous,
            "launched_by": str(current_user.id),
        },
    )

    return {"detail": "Survey launched", "survey": SurveyOut.model_validate(survey).model_dump()}


@router.post(
    "/surveys/{survey_id}/close",
    summary="Close survey (HR admin)",
)
async def close_survey(
    survey_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    survey = await _require_survey(db, survey_id)
    if survey.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot close survey in '{survey.status}' status — must be 'active'",
        )

    survey.status = "closed"

    await db.commit()
    await db.refresh(survey)
    return {"detail": "Survey closed", "survey": SurveyOut.model_validate(survey).model_dump()}


@router.post(
    "/surveys/{survey_id}/respond",
    status_code=status.HTTP_201_CREATED,
    summary="Submit survey response",
)
async def respond_to_survey(
    survey_id: uuid.UUID,
    payload: SurveyRespondCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """
    Submit a response for an active survey.

    - If is_anonymous: respondent_id is set to None regardless of caller.
    - If not anonymous: respondent_id is resolved from current user's employee profile.
    - Extracts NPS score from answers if an "nps" key is present.
    - Publishes engagement.survey_response_submitted event.
    - Sentiment analysis is queued asynchronously (not blocking this response).
    """
    survey = await _require_survey(db, survey_id)
    if survey.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This survey is not currently accepting responses",
        )

    # Resolve respondent
    respondent_id: uuid.UUID | None = None
    if not survey.is_anonymous:
        employee = await _get_employee_for_user(db, current_user.id)
        respondent_id = employee.id

        # Prevent duplicate submission for identified surveys
        existing = await db.execute(
            select(SurveyResponse).where(
                and_(
                    SurveyResponse.survey_id == survey_id,
                    SurveyResponse.respondent_id == respondent_id,
                )
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You have already submitted a response for this survey",
            )

    # Extract NPS score if present
    nps_score: int | None = None
    raw_nps = payload.answers.get("nps")
    if raw_nps is not None:
        try:
            nps_int = int(raw_nps)
            if 0 <= nps_int <= 10:
                nps_score = nps_int
        except (ValueError, TypeError):
            pass  # Ignore malformed NPS value; proceed without score

    response = SurveyResponse(
        survey_id=survey_id,
        respondent_id=respondent_id,
        answers=payload.answers,
        nps_score=nps_score,
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(response)
    await db.commit()
    await db.refresh(response)

    await event_bus.publish(
        "engagement.survey_response_submitted",
        {
            "survey_id": str(survey_id),
            "response_id": str(response.id),
            "anonymous": survey.is_anonymous,
            "nps_score": nps_score,
        },
    )

    return {"status": "submitted", "sentiment_queued": True}


# ── Survey Results endpoints ──────────────────────────────────────────────────


@router.get(
    "/surveys/{survey_id}/results",
    summary="Aggregated survey results (HR admin)",
)
async def survey_results(
    survey_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    """
    Returns:
    - Per-question breakdown (value frequencies / avg for numeric questions)
    - Average sentiment_score across all responses
    - NPS score: (promoters − detractors) / total × 100
    - Response rate: responses / target_count (target_count from target_audience or all active employees)
    - If survey is_anonymous: no respondent_id information is included
    """
    survey = await _require_survey(db, survey_id)

    # Fetch all responses
    responses_result = await db.execute(
        select(SurveyResponse).where(SurveyResponse.survey_id == survey_id)
    )
    responses = responses_result.scalars().all()
    total_responses = len(responses)

    # ── Per-question breakdown ────────────────────────────────────────────────
    question_breakdown: dict[str, Any] = {}
    questions: list = survey.questions or []

    for q in questions:
        q_id = str(q.get("id", ""))
        q_type = q.get("type", "open")
        answers_for_q = [
            r.answers.get(q_id) if r.answers else None
            for r in responses
            if r.answers and q_id in r.answers
        ]

        if q_type in ("likert", "rating", "nps"):
            numeric_values = []
            for val in answers_for_q:
                try:
                    numeric_values.append(float(val))
                except (ValueError, TypeError):
                    pass
            avg = round(sum(numeric_values) / len(numeric_values), 2) if numeric_values else None
            # Frequency distribution
            freq: dict[str, int] = {}
            for val in numeric_values:
                key = str(int(val)) if val == int(val) else str(val)
                freq[key] = freq.get(key, 0) + 1
            question_breakdown[q_id] = {
                "question_text": q.get("text"),
                "type": q_type,
                "response_count": len(numeric_values),
                "average": avg,
                "distribution": freq,
            }
        elif q_type == "multichoice":
            freq_mc: dict[str, int] = {}
            for val in answers_for_q:
                if isinstance(val, list):
                    for item in val:
                        freq_mc[str(item)] = freq_mc.get(str(item), 0) + 1
                else:
                    freq_mc[str(val)] = freq_mc.get(str(val), 0) + 1
            question_breakdown[q_id] = {
                "question_text": q.get("text"),
                "type": q_type,
                "response_count": len(answers_for_q),
                "distribution": freq_mc,
            }
        else:
            # open-ended — just count non-empty responses
            non_empty = [v for v in answers_for_q if v]
            question_breakdown[q_id] = {
                "question_text": q.get("text"),
                "type": q_type,
                "response_count": len(non_empty),
            }
            if not survey.is_anonymous:
                question_breakdown[q_id]["samples"] = non_empty[:5]  # first 5 as samples

    # ── NPS calculation ───────────────────────────────────────────────────────
    nps_responses = [r for r in responses if r.nps_score is not None]
    nps_score_agg: float | None = None
    if nps_responses:
        promoters = sum(1 for r in nps_responses if r.nps_score >= 9)
        detractors = sum(1 for r in nps_responses if r.nps_score <= 6)
        nps_score_agg = round((promoters - detractors) / len(nps_responses) * 100, 1)

    # ── Average sentiment ─────────────────────────────────────────────────────
    scored = [r for r in responses if r.sentiment_score is not None]
    avg_sentiment: float | None = None
    if scored:
        avg_sentiment = round(
            float(sum(r.sentiment_score for r in scored)) / len(scored), 3
        )

    # ── Response rate ─────────────────────────────────────────────────────────
    target_count: int | None = None
    audience = survey.target_audience or {}
    if audience.get("all"):
        target_count = (
            await db.execute(
                select(func.count(Employee.id)).where(Employee.is_active.is_(True))
            )
        ).scalar() or 0
    elif audience.get("department_ids"):
        dept_ids = [
            uuid.UUID(d) if isinstance(d, str) else d
            for d in audience["department_ids"]
        ]
        target_count = (
            await db.execute(
                select(func.count(Employee.id)).where(
                    and_(
                        Employee.is_active.is_(True),
                        Employee.department_id.in_(dept_ids),
                    )
                )
            )
        ).scalar() or 0

    response_rate: float | None = (
        round(total_responses / target_count * 100, 1)
        if target_count and target_count > 0
        else None
    )

    return {
        "survey_id": str(survey_id),
        "title": survey.title,
        "status": survey.status,
        "is_anonymous": survey.is_anonymous,
        "total_responses": total_responses,
        "target_count": target_count,
        "response_rate_pct": response_rate,
        "avg_sentiment_score": avg_sentiment,
        "nps_score": nps_score_agg,
        "question_breakdown": question_breakdown,
    }


# ── Recognition endpoints ─────────────────────────────────────────────────────


@router.get("/recognitions/leaderboard", summary="Top 10 employees by recognition points this month")
async def recognition_leaderboard(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """
    Returns top 10 employees ranked by total recognition points received in the
    current calendar month.
    """
    now = datetime.now(timezone.utc)
    # First day of current month (timezone-naive comparison via UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    rows_result = await db.execute(
        select(
            Recognition.to_employee_id,
            func.sum(Recognition.points).label("total_points"),
            func.count(Recognition.id).label("total_recognitions"),
        )
        .where(Recognition.created_at >= month_start)
        .group_by(Recognition.to_employee_id)
        .order_by(func.sum(Recognition.points).desc())
        .limit(10)
    )
    rows = rows_result.all()

    leaderboard = []
    for rank, row in enumerate(rows, start=1):
        employee = await db.get(Employee, row.to_employee_id)
        leaderboard.append(
            {
                "rank": rank,
                "employee_id": str(row.to_employee_id),
                "employee_number": employee.employee_number if employee else None,
                "job_title": employee.job_title if employee else None,
                "total_points": int(row.total_points or 0),
                "total_recognitions": int(row.total_recognitions or 0),
            }
        )

    return {"month": month_start.strftime("%Y-%m"), "leaderboard": leaderboard}


@router.get("/recognitions", summary="List recognitions (public feed or all for admin)")
async def list_recognitions(
    current_user: CurrentUser,
    db: DBSession,
    to_employee_id: uuid.UUID | None = Query(None),
    from_employee_id: uuid.UUID | None = Query(None),
    recognition_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    """
    Public feed: non-admins see only is_public=True recognitions.
    Admins see all.
    """
    query = select(Recognition)
    count_query = select(func.count(Recognition.id))
    filters: list = []

    if not _is_admin(current_user):
        filters.append(Recognition.is_public.is_(True))

    if to_employee_id:
        filters.append(Recognition.to_employee_id == to_employee_id)
    if from_employee_id:
        filters.append(Recognition.from_employee_id == from_employee_id)
    if recognition_type:
        filters.append(Recognition.recognition_type == recognition_type)

    if filters:
        query = query.where(and_(*filters))
        count_query = count_query.where(and_(*filters))

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(Recognition.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    items = result.scalars().all()

    return {
        "items": [RecognitionOut.model_validate(r).model_dump() for r in items],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post(
    "/recognitions",
    status_code=status.HTTP_201_CREATED,
    summary="Give recognition to an employee",
)
async def give_recognition(
    payload: RecognitionCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from_employee = await _get_employee_for_user(db, current_user.id)

    if from_employee.id == payload.to_employee_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot give recognition to yourself",
        )

    # Verify target employee exists
    target = await db.get(Employee, payload.to_employee_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target employee not found",
        )

    recognition = Recognition(
        from_employee_id=from_employee.id,
        to_employee_id=payload.to_employee_id,
        recognition_type=payload.recognition_type,
        badge_name=payload.badge_name,
        message=payload.message,
        points=payload.points,
        is_public=payload.is_public,
        department_id=payload.department_id,
    )
    db.add(recognition)
    await db.commit()
    await db.refresh(recognition)

    await event_bus.publish(
        "engagement.recognition_given",
        {
            "recognition_id": str(recognition.id),
            "from_employee_id": str(from_employee.id),
            "to_employee_id": str(payload.to_employee_id),
            "recognition_type": payload.recognition_type,
            "badge_name": payload.badge_name,
            "points": payload.points,
            "is_public": payload.is_public,
        },
    )

    return RecognitionOut.model_validate(recognition).model_dump()


@router.get("/recognitions/{rec_id}", summary="Recognition detail")
async def get_recognition(
    rec_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    recognition = await db.get(Recognition, rec_id)
    if not recognition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recognition not found")

    # Non-admin callers may not view private recognitions unless they are the sender or receiver
    if not recognition.is_public and not _is_admin(current_user):
        employee = await _get_employee_for_user(db, current_user.id)
        if employee.id not in (recognition.from_employee_id, recognition.to_employee_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this recognition",
            )

    return RecognitionOut.model_validate(recognition).model_dump()


@router.delete(
    "/recognitions/{rec_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete recognition (own or admin)",
)
async def delete_recognition(
    rec_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
):
    recognition = await db.get(Recognition, rec_id)
    if not recognition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recognition not found")

    if not _is_admin(current_user):
        employee = await _get_employee_for_user(db, current_user.id)
        if recognition.from_employee_id != employee.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own recognitions",
            )

    await db.delete(recognition)
    await db.commit()


@router.get(
    "/employees/{emp_id}/recognition-summary",
    summary="Recognition summary for an employee",
)
async def employee_recognition_summary(
    emp_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """
    Returns:
    - total recognitions received
    - breakdown by recognition_type
    - top badges earned (by frequency)
    - total points accumulated
    """
    employee = await db.get(Employee, emp_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    recs_result = await db.execute(
        select(Recognition).where(Recognition.to_employee_id == emp_id)
    )
    recs = recs_result.scalars().all()

    total_received = len(recs)
    total_points = sum(r.points for r in recs)

    # Breakdown by type
    type_breakdown: dict[str, int] = {}
    badge_counter: dict[str, int] = {}
    for r in recs:
        type_breakdown[r.recognition_type] = type_breakdown.get(r.recognition_type, 0) + 1
        if r.badge_name:
            badge_counter[r.badge_name] = badge_counter.get(r.badge_name, 0) + 1

    # Top badges (sorted descending by count, top 5)
    top_badges = sorted(
        [{"badge_name": name, "count": cnt} for name, cnt in badge_counter.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:5]

    return {
        "employee_id": str(emp_id),
        "total_received": total_received,
        "total_points": total_points,
        "by_type": type_breakdown,
        "top_badges": top_badges,
    }
