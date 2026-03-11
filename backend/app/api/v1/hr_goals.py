"""HR Goals, OKR, Continuous Feedback & 360 Review Cycles API."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, select

from app.core.deps import CurrentUser, DBSession, require_app_admin
from app.core.events import event_bus
from app.models.hr import Department, Employee
from app.models.hr_phase1 import (
    ContinuousFeedback,
    Goal,
    GoalUpdate,
    ReviewAssignment,
    ReviewCycle,
)

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

# -- Goal schemas --


class GoalCreate(BaseModel):
    title: str
    description: str | None = None
    goal_type: str  # company, team, individual
    owner_type: str  # company, department, employee
    owner_id: uuid.UUID
    parent_id: uuid.UUID | None = None
    metric_type: str = "percentage"
    target_value: Decimal | None = None
    current_value: Decimal = Decimal("0")
    start_date: date
    due_date: date
    status: str = "not_started"
    weight: Decimal = Decimal("1.0")
    review_period: str | None = None


class GoalUpdate_(BaseModel):
    title: str | None = None
    description: str | None = None
    goal_type: str | None = None
    owner_type: str | None = None
    owner_id: uuid.UUID | None = None
    parent_id: uuid.UUID | None = None
    metric_type: str | None = None
    target_value: Decimal | None = None
    current_value: Decimal | None = None
    start_date: date | None = None
    due_date: date | None = None
    status: str | None = None
    weight: Decimal | None = None
    review_period: str | None = None


class GoalOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    goal_type: str
    owner_type: str
    owner_id: uuid.UUID
    parent_id: uuid.UUID | None
    metric_type: str
    target_value: Decimal | None
    current_value: Decimal
    start_date: date
    due_date: date
    status: str
    weight: Decimal
    review_period: str | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Goal Update schemas --


class GoalProgressCreate(BaseModel):
    new_value: Decimal
    comment: str | None = None


class GoalProgressOut(BaseModel):
    id: uuid.UUID
    goal_id: uuid.UUID
    previous_value: Decimal
    new_value: Decimal
    comment: str | None
    updated_by: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Continuous Feedback schemas --


class FeedbackCreate(BaseModel):
    to_employee_id: uuid.UUID
    feedback_type: str  # praise, improvement, general
    content: str
    is_anonymous: bool = False
    visibility: str = "private"
    related_goal_id: uuid.UUID | None = None


class FeedbackOut(BaseModel):
    id: uuid.UUID
    from_employee_id: uuid.UUID
    to_employee_id: uuid.UUID
    feedback_type: str
    content: str
    is_anonymous: bool
    visibility: str
    related_goal_id: uuid.UUID | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Review Cycle schemas --


class ReviewCycleCreate(BaseModel):
    name: str
    cycle_type: str  # annual, semi_annual, quarterly, 360
    start_date: date
    end_date: date
    self_review_deadline: date | None = None
    peer_review_deadline: date | None = None
    manager_review_deadline: date | None = None
    department_ids: dict | None = None


class ReviewCycleUpdate(BaseModel):
    name: str | None = None
    cycle_type: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    self_review_deadline: date | None = None
    peer_review_deadline: date | None = None
    manager_review_deadline: date | None = None
    status: str | None = None
    department_ids: dict | None = None


class ReviewCycleOut(BaseModel):
    id: uuid.UUID
    name: str
    cycle_type: str
    start_date: date
    end_date: date
    self_review_deadline: date | None
    peer_review_deadline: date | None
    manager_review_deadline: date | None
    status: str
    department_ids: dict | None
    created_by: uuid.UUID
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# -- Review Assignment schemas --


class ReviewAssignmentUpdate(BaseModel):
    rating: int | None = Field(None, ge=1, le=5)
    comments: str | None = None
    strengths: str | None = None
    improvements: str | None = None


class ReviewAssignmentOut(BaseModel):
    id: uuid.UUID
    cycle_id: uuid.UUID
    reviewee_id: uuid.UUID
    reviewer_id: uuid.UUID
    review_type: str
    rating: int | None
    comments: str | None
    strengths: str | None
    improvements: str | None
    status: str
    submitted_at: Any | None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _get_employee_for_user(db, user_id: uuid.UUID) -> Employee:
    result = await db.execute(select(Employee).where(Employee.user_id == user_id))
    employee = result.scalar_one_or_none()
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee profile found for current user",
        )
    return employee


# ── Goals / OKR endpoints ────────────────────────────────────────────────────


@router.get("/goals", summary="List goals")
async def list_goals(
    current_user: CurrentUser,
    db: DBSession,
    goal_type: str | None = Query(None),
    owner_type: str | None = Query(None),
    owner_id: uuid.UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    review_period: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(Goal)
    count_query = select(func.count(Goal.id))
    filters = []

    if goal_type:
        filters.append(Goal.goal_type == goal_type)
    if owner_type:
        filters.append(Goal.owner_type == owner_type)
    if owner_id:
        filters.append(Goal.owner_id == owner_id)
    if status_filter:
        filters.append(Goal.status == status_filter)
    if review_period:
        filters.append(Goal.review_period == review_period)

    if filters:
        query = query.where(and_(*filters))
        count_query = count_query.where(and_(*filters))

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(Goal.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    items = result.scalars().all()

    return {
        "items": [GoalOut.model_validate(g).model_dump() for g in items],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("/goals", status_code=status.HTTP_201_CREATED, summary="Create goal")
async def create_goal(
    payload: GoalCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    goal = Goal(**payload.model_dump())
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return GoalOut.model_validate(goal).model_dump()


@router.put("/goals/{goal_id}", summary="Update goal")
async def update_goal(
    goal_id: uuid.UUID,
    payload: GoalUpdate_,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    goal = await db.get(Goal, goal_id)
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(goal, field, value)

    await db.commit()
    await db.refresh(goal)
    return GoalOut.model_validate(goal).model_dump()


@router.delete("/goals/{goal_id}", summary="Delete goal")
async def delete_goal(
    goal_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, str]:
    goal = await db.get(Goal, goal_id)
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")

    await db.delete(goal)
    await db.commit()
    return {"detail": "Goal deleted"}


@router.get("/goals/tree", summary="Full OKR hierarchy")
async def goal_tree(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Company-level goals (no parent)
    company_result = await db.execute(
        select(Goal).where(
            and_(Goal.goal_type == "company", Goal.parent_id.is_(None))
        )
    )
    company_goals = company_result.scalars().all()
    company_goal_ids = [g.id for g in company_goals]

    # Team goals (parent is a company goal)
    team_result = await db.execute(
        select(Goal).where(Goal.parent_id.in_(company_goal_ids))
    ) if company_goal_ids else None
    team_goals = team_result.scalars().all() if team_result else []
    team_goal_ids = [g.id for g in team_goals]

    # Individual goals (parent is a team goal)
    individual_result = await db.execute(
        select(Goal).where(Goal.parent_id.in_(team_goal_ids))
    ) if team_goal_ids else None
    individual_goals = individual_result.scalars().all() if individual_result else []

    def _serialize(g):
        return GoalOut.model_validate(g).model_dump()

    # Build nested structure
    individual_by_parent: dict[uuid.UUID, list] = {}
    for g in individual_goals:
        individual_by_parent.setdefault(g.parent_id, []).append(_serialize(g))

    team_by_parent: dict[uuid.UUID, list] = {}
    for g in team_goals:
        node = _serialize(g)
        node["children"] = individual_by_parent.get(g.id, [])
        team_by_parent.setdefault(g.parent_id, []).append(node)

    tree = []
    for g in company_goals:
        node = _serialize(g)
        node["children"] = team_by_parent.get(g.id, [])
        tree.append(node)

    return {"tree": tree}


@router.get("/goals/dashboard", summary="Goal completion stats by department")
async def goal_dashboard(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    # Get all departments
    dept_result = await db.execute(select(Department).where(Department.is_active.is_(True)))
    departments = dept_result.scalars().all()

    stats = []
    for dept in departments:
        # Get employees in this department
        emp_result = await db.execute(
            select(Employee.id).where(Employee.department_id == dept.id)
        )
        emp_ids = [row[0] for row in emp_result.all()]
        if not emp_ids:
            stats.append({
                "department_name": dept.name,
                "total_goals": 0,
                "completed": 0,
                "in_progress": 0,
                "at_risk": 0,
            })
            continue

        # Count goals owned by these employees
        total = (await db.execute(
            select(func.count(Goal.id)).where(
                and_(Goal.owner_type == "employee", Goal.owner_id.in_(emp_ids))
            )
        )).scalar() or 0

        completed = (await db.execute(
            select(func.count(Goal.id)).where(
                and_(
                    Goal.owner_type == "employee",
                    Goal.owner_id.in_(emp_ids),
                    Goal.status == "completed",
                )
            )
        )).scalar() or 0

        in_progress = (await db.execute(
            select(func.count(Goal.id)).where(
                and_(
                    Goal.owner_type == "employee",
                    Goal.owner_id.in_(emp_ids),
                    Goal.status == "in_progress",
                )
            )
        )).scalar() or 0

        at_risk = (await db.execute(
            select(func.count(Goal.id)).where(
                and_(
                    Goal.owner_type == "employee",
                    Goal.owner_id.in_(emp_ids),
                    Goal.status == "at_risk",
                )
            )
        )).scalar() or 0

        stats.append({
            "department_name": dept.name,
            "total_goals": total,
            "completed": completed,
            "in_progress": in_progress,
            "at_risk": at_risk,
        })

    return {"departments": stats}


@router.get("/goals/{goal_id}", summary="Get goal with children")
async def get_goal(
    goal_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    goal = await db.get(Goal, goal_id)
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")

    # Get direct children
    children_result = await db.execute(
        select(Goal).where(Goal.parent_id == goal_id).order_by(Goal.created_at.asc())
    )
    children = children_result.scalars().all()

    data = GoalOut.model_validate(goal).model_dump()
    data["children"] = [GoalOut.model_validate(c).model_dump() for c in children]
    return data


@router.post(
    "/goals/{goal_id}/updates",
    status_code=status.HTTP_201_CREATED,
    summary="Add progress update to a goal",
)
async def create_goal_update(
    goal_id: uuid.UUID,
    payload: GoalProgressCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    goal = await db.get(Goal, goal_id)
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")

    update = GoalUpdate(
        goal_id=goal_id,
        previous_value=goal.current_value,
        new_value=payload.new_value,
        comment=payload.comment,
        updated_by=current_user.id,
    )
    db.add(update)

    # Auto-update goal's current value
    goal.current_value = payload.new_value
    if goal.status == "not_started":
        goal.status = "in_progress"

    # Check if goal is completed
    if goal.target_value is not None and payload.new_value >= goal.target_value:
        goal.status = "completed"
        await event_bus.publish("goal.completed", {
            "goal_id": str(goal.id),
            "title": goal.title,
            "owner_type": goal.owner_type,
            "owner_id": str(goal.owner_id),
        })

    await db.commit()
    await db.refresh(update)
    return GoalProgressOut.model_validate(update).model_dump()


@router.get("/goals/{goal_id}/updates", summary="List goal updates")
async def list_goal_updates(
    goal_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    goal = await db.get(Goal, goal_id)
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")

    count = (await db.execute(
        select(func.count(GoalUpdate.id)).where(GoalUpdate.goal_id == goal_id)
    )).scalar() or 0

    result = await db.execute(
        select(GoalUpdate)
        .where(GoalUpdate.goal_id == goal_id)
        .order_by(GoalUpdate.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    items = result.scalars().all()

    return {
        "items": [GoalProgressOut.model_validate(u).model_dump() for u in items],
        "total": count,
        "page": page,
        "limit": limit,
    }


# ── Continuous Feedback endpoints ─────────────────────────────────────────────


@router.get("/feedback", summary="List feedback received by current user")
async def list_feedback_received(
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    employee = await _get_employee_for_user(db, current_user.id)

    count = (await db.execute(
        select(func.count(ContinuousFeedback.id)).where(
            ContinuousFeedback.to_employee_id == employee.id
        )
    )).scalar() or 0

    result = await db.execute(
        select(ContinuousFeedback)
        .where(ContinuousFeedback.to_employee_id == employee.id)
        .order_by(ContinuousFeedback.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    items = result.scalars().all()

    return {
        "items": [FeedbackOut.model_validate(f).model_dump() for f in items],
        "total": count,
        "page": page,
        "limit": limit,
    }


@router.post(
    "/feedback",
    status_code=status.HTTP_201_CREATED,
    summary="Give feedback to another employee",
)
async def create_feedback(
    payload: FeedbackCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    employee = await _get_employee_for_user(db, current_user.id)

    # Verify target employee exists
    target = await db.get(Employee, payload.to_employee_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target employee not found")

    feedback = ContinuousFeedback(
        from_employee_id=employee.id,
        to_employee_id=payload.to_employee_id,
        feedback_type=payload.feedback_type,
        content=payload.content,
        is_anonymous=payload.is_anonymous,
        visibility=payload.visibility,
        related_goal_id=payload.related_goal_id,
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)

    await event_bus.publish("feedback.received", {
        "feedback_id": str(feedback.id),
        "from_employee_id": str(employee.id),
        "to_employee_id": str(payload.to_employee_id),
        "feedback_type": payload.feedback_type,
    })

    return FeedbackOut.model_validate(feedback).model_dump()


@router.get("/feedback/given", summary="List feedback given by current user")
async def list_feedback_given(
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    employee = await _get_employee_for_user(db, current_user.id)

    count = (await db.execute(
        select(func.count(ContinuousFeedback.id)).where(
            ContinuousFeedback.from_employee_id == employee.id
        )
    )).scalar() or 0

    result = await db.execute(
        select(ContinuousFeedback)
        .where(ContinuousFeedback.from_employee_id == employee.id)
        .order_by(ContinuousFeedback.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    items = result.scalars().all()

    return {
        "items": [FeedbackOut.model_validate(f).model_dump() for f in items],
        "total": count,
        "page": page,
        "limit": limit,
    }


@router.get(
    "/feedback/summary/{employee_id}",
    summary="Feedback summary for an employee (admin or manager)",
)
async def feedback_summary(
    employee_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    target = await db.get(Employee, employee_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    total_received = (await db.execute(
        select(func.count(ContinuousFeedback.id)).where(
            ContinuousFeedback.to_employee_id == employee_id
        )
    )).scalar() or 0

    praise_count = (await db.execute(
        select(func.count(ContinuousFeedback.id)).where(
            and_(
                ContinuousFeedback.to_employee_id == employee_id,
                ContinuousFeedback.feedback_type == "praise",
            )
        )
    )).scalar() or 0

    improvement_count = (await db.execute(
        select(func.count(ContinuousFeedback.id)).where(
            and_(
                ContinuousFeedback.to_employee_id == employee_id,
                ContinuousFeedback.feedback_type == "improvement",
            )
        )
    )).scalar() or 0

    recent_result = await db.execute(
        select(ContinuousFeedback)
        .where(ContinuousFeedback.to_employee_id == employee_id)
        .order_by(ContinuousFeedback.created_at.desc())
        .limit(10)
    )
    recent = recent_result.scalars().all()

    return {
        "employee_id": str(employee_id),
        "total_received": total_received,
        "praise_count": praise_count,
        "improvement_count": improvement_count,
        "recent": [FeedbackOut.model_validate(f).model_dump() for f in recent],
    }


# ── Review Cycle endpoints ───────────────────────────────────────────────────


@router.get("/review-cycles", summary="List review cycles")
async def list_review_cycles(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(None, alias="status"),
    cycle_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = select(ReviewCycle)
    count_query = select(func.count(ReviewCycle.id))
    filters = []

    if status_filter:
        filters.append(ReviewCycle.status == status_filter)
    if cycle_type:
        filters.append(ReviewCycle.cycle_type == cycle_type)

    if filters:
        query = query.where(and_(*filters))
        count_query = count_query.where(and_(*filters))

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(ReviewCycle.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    items = result.scalars().all()

    return {
        "items": [ReviewCycleOut.model_validate(c).model_dump() for c in items],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post(
    "/review-cycles",
    status_code=status.HTTP_201_CREATED,
    summary="Create review cycle (admin)",
)
async def create_review_cycle(
    payload: ReviewCycleCreate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    cycle = ReviewCycle(
        **payload.model_dump(),
        created_by=current_user.id,
    )
    db.add(cycle)
    await db.commit()
    await db.refresh(cycle)
    return ReviewCycleOut.model_validate(cycle).model_dump()


@router.put("/review-cycles/{cycle_id}", summary="Update review cycle (admin)")
async def update_review_cycle(
    cycle_id: uuid.UUID,
    payload: ReviewCycleUpdate,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    cycle = await db.get(ReviewCycle, cycle_id)
    if not cycle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review cycle not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(cycle, field, value)

    await db.commit()
    await db.refresh(cycle)
    return ReviewCycleOut.model_validate(cycle).model_dump()


@router.post(
    "/review-cycles/{cycle_id}/launch",
    summary="Launch review cycle — auto-create assignments (admin)",
)
async def launch_review_cycle(
    cycle_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    cycle = await db.get(ReviewCycle, cycle_id)
    if not cycle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review cycle not found")
    if cycle.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot launch cycle in '{cycle.status}' status, must be 'draft'",
        )

    # Determine target employees
    emp_query = select(Employee).where(Employee.is_active.is_(True))
    if cycle.department_ids and isinstance(cycle.department_ids, list):
        dept_uuids = [uuid.UUID(d) if isinstance(d, str) else d for d in cycle.department_ids]
        emp_query = emp_query.where(Employee.department_id.in_(dept_uuids))

    emp_result = await db.execute(emp_query)
    employees = emp_result.scalars().all()

    assignments_created = 0
    for emp in employees:
        if cycle.cycle_type == "360":
            # Self review
            db.add(ReviewAssignment(
                cycle_id=cycle.id,
                reviewee_id=emp.id,
                reviewer_id=emp.id,
                review_type="self",
            ))
            assignments_created += 1

            # Peer reviews — pick other employees in same department
            if emp.department_id:
                peer_result = await db.execute(
                    select(Employee).where(
                        and_(
                            Employee.department_id == emp.department_id,
                            Employee.id != emp.id,
                            Employee.is_active.is_(True),
                        )
                    ).limit(3)
                )
                peers = peer_result.scalars().all()
                for peer in peers:
                    db.add(ReviewAssignment(
                        cycle_id=cycle.id,
                        reviewee_id=emp.id,
                        reviewer_id=peer.id,
                        review_type="peer",
                    ))
                    assignments_created += 1

            # Manager review — department head
            if emp.department_id:
                dept = await db.get(Department, emp.department_id)
                if dept and dept.head_id:
                    # Find the employee record for the department head
                    mgr_result = await db.execute(
                        select(Employee).where(Employee.user_id == dept.head_id)
                    )
                    manager = mgr_result.scalar_one_or_none()
                    if manager and manager.id != emp.id:
                        db.add(ReviewAssignment(
                            cycle_id=cycle.id,
                            reviewee_id=emp.id,
                            reviewer_id=manager.id,
                            review_type="manager",
                        ))
                        assignments_created += 1
        else:
            # Standard cycle: self review + manager review
            db.add(ReviewAssignment(
                cycle_id=cycle.id,
                reviewee_id=emp.id,
                reviewer_id=emp.id,
                review_type="self",
            ))
            assignments_created += 1

            if emp.department_id:
                dept = await db.get(Department, emp.department_id)
                if dept and dept.head_id:
                    mgr_result = await db.execute(
                        select(Employee).where(Employee.user_id == dept.head_id)
                    )
                    manager = mgr_result.scalar_one_or_none()
                    if manager and manager.id != emp.id:
                        db.add(ReviewAssignment(
                            cycle_id=cycle.id,
                            reviewee_id=emp.id,
                            reviewer_id=manager.id,
                            review_type="manager",
                        ))
                        assignments_created += 1

    cycle.status = "active"
    await db.commit()
    await db.refresh(cycle)

    await event_bus.publish("review_cycle.launched", {
        "cycle_id": str(cycle.id),
        "name": cycle.name,
        "assignments_created": assignments_created,
    })

    return {
        "detail": "Review cycle launched",
        "cycle": ReviewCycleOut.model_validate(cycle).model_dump(),
        "assignments_created": assignments_created,
    }


PHASE_ORDER = ["draft", "active", "peer_review", "manager_review", "completed"]


@router.put(
    "/review-cycles/{cycle_id}/advance",
    summary="Advance review cycle phase (admin)",
)
async def advance_review_cycle(
    cycle_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    _admin: Any = Depends(require_app_admin("hr")),
) -> dict[str, Any]:
    cycle = await db.get(ReviewCycle, cycle_id)
    if not cycle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review cycle not found")

    if cycle.status not in PHASE_ORDER or cycle.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot advance from '{cycle.status}' status",
        )

    current_idx = PHASE_ORDER.index(cycle.status)
    cycle.status = PHASE_ORDER[current_idx + 1]

    await db.commit()
    await db.refresh(cycle)
    return ReviewCycleOut.model_validate(cycle).model_dump()


@router.get(
    "/review-cycles/{cycle_id}/assignments",
    summary="List assignments for a review cycle",
)
async def list_cycle_assignments(
    cycle_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    review_type: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    cycle = await db.get(ReviewCycle, cycle_id)
    if not cycle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review cycle not found")

    query = select(ReviewAssignment).where(ReviewAssignment.cycle_id == cycle_id)
    count_query = select(func.count(ReviewAssignment.id)).where(
        ReviewAssignment.cycle_id == cycle_id
    )
    filters = []

    if review_type:
        filters.append(ReviewAssignment.review_type == review_type)
    if status_filter:
        filters.append(ReviewAssignment.status == status_filter)

    if filters:
        query = query.where(and_(*filters))
        count_query = count_query.where(and_(*filters))

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(ReviewAssignment.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    items = result.scalars().all()

    return {
        "items": [ReviewAssignmentOut.model_validate(a).model_dump() for a in items],
        "total": total,
        "page": page,
        "limit": limit,
    }


# ── Review Assignment endpoints ───────────────────────────────────────────────


@router.get("/review-assignments/mine", summary="My pending review assignments")
async def my_review_assignments(
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    employee = await _get_employee_for_user(db, current_user.id)

    count = (await db.execute(
        select(func.count(ReviewAssignment.id)).where(
            and_(
                ReviewAssignment.reviewer_id == employee.id,
                ReviewAssignment.status.in_(["pending", "in_progress"]),
            )
        )
    )).scalar() or 0

    result = await db.execute(
        select(ReviewAssignment)
        .where(
            and_(
                ReviewAssignment.reviewer_id == employee.id,
                ReviewAssignment.status.in_(["pending", "in_progress"]),
            )
        )
        .order_by(ReviewAssignment.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    items = result.scalars().all()

    return {
        "items": [ReviewAssignmentOut.model_validate(a).model_dump() for a in items],
        "total": count,
        "page": page,
        "limit": limit,
    }


@router.put(
    "/review-assignments/{assignment_id}",
    summary="Submit review assignment",
)
async def submit_review_assignment(
    assignment_id: uuid.UUID,
    payload: ReviewAssignmentUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    assignment = await db.get(ReviewAssignment, assignment_id)
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Review assignment not found"
        )

    # Verify current user is the reviewer
    employee = await _get_employee_for_user(db, current_user.id)
    if assignment.reviewer_id != employee.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the reviewer for this assignment",
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(assignment, field, value)

    assignment.status = "submitted"
    assignment.submitted_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(assignment)
    return ReviewAssignmentOut.model_validate(assignment).model_dump()


@router.get(
    "/review-assignments/{assignment_id}",
    summary="Get review assignment detail",
)
async def get_review_assignment(
    assignment_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    assignment = await db.get(ReviewAssignment, assignment_id)
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Review assignment not found"
        )
    return ReviewAssignmentOut.model_validate(assignment).model_dump()


# ── Individual Development Plan ───────────────────────────────────────────────


@router.get(
    "/employees/{employee_id}/idp",
    summary="Individual development plan for an employee",
)
async def employee_idp(
    employee_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    employee = await db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    # 1. Skills gaps — compare employee skills to department average
    from app.models.hr_phase1 import EmployeeSkill

    skills_result = await db.execute(
        select(EmployeeSkill).where(EmployeeSkill.employee_id == employee_id)
    )
    employee_skills = skills_result.scalars().all()

    skill_gaps = []
    if employee.department_id:
        # Get department peers
        peer_ids_result = await db.execute(
            select(Employee.id).where(
                and_(
                    Employee.department_id == employee.department_id,
                    Employee.is_active.is_(True),
                )
            )
        )
        peer_ids = [row[0] for row in peer_ids_result.all()]

        if peer_ids:
            # Department average proficiency per skill
            avg_result = await db.execute(
                select(
                    EmployeeSkill.skill_name,
                    func.avg(EmployeeSkill.proficiency_level).label("avg_level"),
                )
                .where(EmployeeSkill.employee_id.in_(peer_ids))
                .group_by(EmployeeSkill.skill_name)
            )
            dept_averages = {row.skill_name: float(row.avg_level) for row in avg_result.all()}

            emp_skill_map = {s.skill_name: s.proficiency_level for s in employee_skills}

            for skill_name, avg_level in dept_averages.items():
                emp_level = emp_skill_map.get(skill_name, 0)
                if emp_level < avg_level:
                    skill_gaps.append({
                        "skill_name": skill_name,
                        "employee_level": emp_level,
                        "department_average": round(avg_level, 1),
                        "gap": round(avg_level - emp_level, 1),
                    })

            skill_gaps.sort(key=lambda x: x["gap"], reverse=True)

    # 2. Recent feedback
    feedback_result = await db.execute(
        select(ContinuousFeedback)
        .where(ContinuousFeedback.to_employee_id == employee_id)
        .order_by(ContinuousFeedback.created_at.desc())
        .limit(10)
    )
    recent_feedback = feedback_result.scalars().all()

    # 3. Pending goals
    goals_result = await db.execute(
        select(Goal).where(
            and_(
                Goal.owner_type == "employee",
                Goal.owner_id == employee_id,
                Goal.status.in_(["not_started", "in_progress", "at_risk"]),
            )
        ).order_by(Goal.due_date.asc())
    )
    pending_goals = goals_result.scalars().all()

    # 4. Performance review history
    from app.models.hr import PerformanceReview

    reviews_result = await db.execute(
        select(PerformanceReview)
        .where(PerformanceReview.employee_id == employee_id)
        .order_by(PerformanceReview.created_at.desc())
        .limit(5)
    )
    reviews = reviews_result.scalars().all()

    # Also include review assignments (360 reviews)
    assignments_result = await db.execute(
        select(ReviewAssignment)
        .where(
            and_(
                ReviewAssignment.reviewee_id == employee_id,
                ReviewAssignment.status == "submitted",
            )
        )
        .order_by(ReviewAssignment.submitted_at.desc())
        .limit(10)
    )
    submitted_assignments = assignments_result.scalars().all()

    return {
        "employee_id": str(employee_id),
        "skill_gaps": skill_gaps,
        "recent_feedback": [FeedbackOut.model_validate(f).model_dump() for f in recent_feedback],
        "pending_goals": [GoalOut.model_validate(g).model_dump() for g in pending_goals],
        "performance_reviews": [
            {
                "id": str(r.id),
                "period": r.period,
                "rating": r.rating,
                "strengths": r.strengths,
                "areas_for_improvement": r.areas_for_improvement,
                "status": r.status,
            }
            for r in reviews
        ],
        "review_assignments": [
            ReviewAssignmentOut.model_validate(a).model_dump() for a in submitted_assignments
        ],
    }
