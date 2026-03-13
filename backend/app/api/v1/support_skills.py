"""Support Agent Skills & Workforce Management API — Phase 3.

Provides skill-based routing, shift scheduling, on-duty checks, and
weekly coverage heatmaps for support agents.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.models.support import Ticket
from app.models.support_phase3 import AgentShift, AgentSkill

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────


class SkillCreate(BaseModel):
    user_id: uuid.UUID
    skill_name: str
    proficiency: int = 3  # 1-5
    is_primary: bool = False
    max_concurrent: int = 5
    languages: list[str] | None = None


class SkillUpdate(BaseModel):
    skill_name: str | None = None
    proficiency: int | None = None
    is_primary: bool | None = None
    max_concurrent: int | None = None
    languages: list[str] | None = None


class SkillOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    skill_name: str
    proficiency: int
    is_primary: bool
    max_concurrent: int
    languages: list[str] | None
    agent_name: str | None = None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class SkillSummary(BaseModel):
    skill_name: str
    agent_count: int


class RouteTicketRequest(BaseModel):
    ticket_id: uuid.UUID


class RouteTicketResponse(BaseModel):
    suggested_agent_id: uuid.UUID | None
    agent_name: str | None
    matching_skills: list[str]
    proficiency_score: int


class ShiftCreate(BaseModel):
    user_id: uuid.UUID
    day_of_week: int  # 0=Monday … 6=Sunday
    start_time: str  # HH:MM
    end_time: str  # HH:MM
    timezone: str = "UTC"


class ShiftUpdate(BaseModel):
    day_of_week: int | None = None
    start_time: str | None = None
    end_time: str | None = None
    timezone: str | None = None
    is_active: bool | None = None


class ShiftOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    day_of_week: int
    start_time: str
    end_time: str
    timezone: str
    is_active: bool
    agent_name: str | None = None
    created_at: Any
    updated_at: Any

    model_config = {"from_attributes": True}


class OnDutyAgent(BaseModel):
    user_id: uuid.UUID
    agent_name: str | None
    shift_id: uuid.UUID
    day_of_week: int
    start_time: str
    end_time: str
    timezone: str
    skills: list[SkillOut]


class CoverageHeatmap(BaseModel):
    # grid[day_of_week][hour] = agent_count  (7 days × 24 hours)
    grid: list[list[int]]
    days: list[str]
    hours: list[int]


# ── Helper ─────────────────────────────────────────────────────────────────────


def _agent_name(skill_or_shift: AgentSkill | AgentShift) -> str | None:
    """Return full_name or email of the related user, or None."""
    user = getattr(skill_or_shift, "user", None)
    if user is None:
        return None
    return getattr(user, "full_name", None) or getattr(user, "email", None)


def _skill_out(skill: AgentSkill) -> SkillOut:
    return SkillOut(
        id=skill.id,
        user_id=skill.user_id,
        skill_name=skill.skill_name,
        proficiency=skill.proficiency,
        is_primary=skill.is_primary,
        max_concurrent=skill.max_concurrent,
        languages=skill.languages,
        agent_name=_agent_name(skill),
        created_at=skill.created_at,
        updated_at=skill.updated_at,
    )


def _shift_out(shift: AgentShift) -> ShiftOut:
    return ShiftOut(
        id=shift.id,
        user_id=shift.user_id,
        day_of_week=shift.day_of_week,
        start_time=shift.start_time,
        end_time=shift.end_time,
        timezone=shift.timezone,
        is_active=shift.is_active,
        agent_name=_agent_name(shift),
        created_at=shift.created_at,
        updated_at=shift.updated_at,
    )


def _time_str_to_minutes(t: str) -> int:
    """Convert 'HH:MM' to total minutes since midnight."""
    h, m = t.split(":")
    return int(h) * 60 + int(m)


# ── Skills endpoints ────────────────────────────────────────────────────────────


@router.get("/skills", response_model=list[SkillSummary])
async def list_skills(
    db: DBSession,
    _current_user: CurrentUser,
) -> list[SkillSummary]:
    """Return unique skill names with the number of agents holding each skill."""
    result = await db.execute(
        select(AgentSkill.skill_name, func.count(AgentSkill.user_id).label("agent_count"))
        .group_by(AgentSkill.skill_name)
        .order_by(AgentSkill.skill_name)
    )
    rows = result.all()
    return [SkillSummary(skill_name=row.skill_name, agent_count=row.agent_count) for row in rows]


@router.get("/skills/agents/{agent_id}", response_model=list[SkillOut])
async def list_agent_skills(
    agent_id: uuid.UUID,
    db: DBSession,
    _current_user: CurrentUser,
) -> list[SkillOut]:
    """Return all skills registered for a specific agent."""
    result = await db.execute(
        select(AgentSkill)
        .where(AgentSkill.user_id == agent_id)
        .order_by(AgentSkill.proficiency.desc(), AgentSkill.skill_name)
    )
    skills = result.scalars().all()
    return [_skill_out(s) for s in skills]


@router.post("/skills", response_model=SkillOut, status_code=status.HTTP_201_CREATED)
async def add_skill(
    payload: SkillCreate,
    db: DBSession,
    _current_user: CurrentUser,
) -> SkillOut:
    """Add a skill entry for an agent."""
    if not (1 <= payload.proficiency <= 5):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="proficiency must be between 1 and 5",
        )
    skill = AgentSkill(
        user_id=payload.user_id,
        skill_name=payload.skill_name.strip(),
        proficiency=payload.proficiency,
        is_primary=payload.is_primary,
        max_concurrent=payload.max_concurrent,
        languages=payload.languages,
    )
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    return _skill_out(skill)


@router.put("/skills/{skill_id}", response_model=SkillOut)
async def update_skill(
    skill_id: uuid.UUID,
    payload: SkillUpdate,
    db: DBSession,
    _current_user: CurrentUser,
) -> SkillOut:
    """Update a skill's proficiency or settings."""
    result = await db.execute(select(AgentSkill).where(AgentSkill.id == skill_id))
    skill = result.scalar_one_or_none()
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")

    if payload.skill_name is not None:
        skill.skill_name = payload.skill_name.strip()
    if payload.proficiency is not None:
        if not (1 <= payload.proficiency <= 5):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="proficiency must be between 1 and 5",
            )
        skill.proficiency = payload.proficiency
    if payload.is_primary is not None:
        skill.is_primary = payload.is_primary
    if payload.max_concurrent is not None:
        skill.max_concurrent = payload.max_concurrent
    if payload.languages is not None:
        skill.languages = payload.languages

    await db.commit()
    await db.refresh(skill)
    return _skill_out(skill)


@router.delete("/skills/{skill_id}", status_code=status.HTTP_200_OK)
async def delete_skill(
    skill_id: uuid.UUID,
    db: DBSession,
    _current_user: CurrentUser,
) -> None:
    """Delete a skill entry."""
    result = await db.execute(select(AgentSkill).where(AgentSkill.id == skill_id))
    skill = result.scalar_one_or_none()
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")
    await db.delete(skill)
    await db.commit()


@router.post("/skills/route-ticket", response_model=RouteTicketResponse)
async def route_ticket(
    payload: RouteTicketRequest,
    db: DBSession,
    _current_user: CurrentUser,
) -> RouteTicketResponse:
    """Skill-based ticket routing.

    Derives required skills from the ticket's category name and tags, then
    finds the best available agent ordered by matching-skill proficiency.
    Returns the suggested agent, matching skill names, and a combined score.
    """
    # Load the ticket
    ticket_result = await db.execute(select(Ticket).where(Ticket.id == payload.ticket_id))
    ticket = ticket_result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    # Derive candidate skill keywords from category + tags
    required_keywords: list[str] = []
    if ticket.category and ticket.category.name:
        required_keywords.append(ticket.category.name.lower())
    if ticket.tags:
        required_keywords.extend(t.lower() for t in ticket.tags)

    # Load all agent skills
    all_skills_result = await db.execute(
        select(AgentSkill).order_by(AgentSkill.proficiency.desc())
    )
    all_skills: list[AgentSkill] = list(all_skills_result.scalars().all())

    if not all_skills:
        return RouteTicketResponse(
            suggested_agent_id=None,
            agent_name=None,
            matching_skills=[],
            proficiency_score=0,
        )

    # Score each agent: sum proficiency of skills that match any required keyword
    # If no keywords, fall back to the agent with the highest primary proficiency.
    agent_scores: dict[uuid.UUID, dict] = {}

    for skill in all_skills:
        agent_id = skill.user_id
        if agent_id not in agent_scores:
            agent_scores[agent_id] = {
                "agent_id": agent_id,
                "agent_name": _agent_name(skill),
                "matching_skills": [],
                "proficiency_score": 0,
            }

        if required_keywords:
            skill_lower = skill.skill_name.lower()
            matched = any(kw in skill_lower or skill_lower in kw for kw in required_keywords)
            if matched:
                agent_scores[agent_id]["matching_skills"].append(skill.skill_name)
                agent_scores[agent_id]["proficiency_score"] += skill.proficiency
        else:
            # No keywords — accumulate all skills, favour is_primary
            bonus = 1 if skill.is_primary else 0
            agent_scores[agent_id]["proficiency_score"] += skill.proficiency + bonus
            agent_scores[agent_id]["matching_skills"].append(skill.skill_name)

    # Pick best agent
    best = max(agent_scores.values(), key=lambda x: x["proficiency_score"])

    return RouteTicketResponse(
        suggested_agent_id=best["agent_id"],
        agent_name=best["agent_name"],
        matching_skills=best["matching_skills"],
        proficiency_score=best["proficiency_score"],
    )


# ── Shifts / Schedule endpoints ─────────────────────────────────────────────────


@router.get("/shifts/agents/{agent_id}", response_model=list[ShiftOut])
async def list_agent_shifts(
    agent_id: uuid.UUID,
    db: DBSession,
    _current_user: CurrentUser,
) -> list[ShiftOut]:
    """Return all shifts for a specific agent."""
    result = await db.execute(
        select(AgentShift)
        .where(AgentShift.user_id == agent_id)
        .order_by(AgentShift.day_of_week, AgentShift.start_time)
    )
    shifts = result.scalars().all()
    return [_shift_out(s) for s in shifts]


@router.post("/shifts", response_model=ShiftOut, status_code=status.HTTP_201_CREATED)
async def create_shift(
    payload: ShiftCreate,
    db: DBSession,
    _current_user: CurrentUser,
) -> ShiftOut:
    """Create a shift entry for an agent."""
    if not (0 <= payload.day_of_week <= 6):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="day_of_week must be between 0 (Monday) and 6 (Sunday)",
        )
    shift = AgentShift(
        user_id=payload.user_id,
        day_of_week=payload.day_of_week,
        start_time=payload.start_time,
        end_time=payload.end_time,
        timezone=payload.timezone,
        is_active=True,
    )
    db.add(shift)
    await db.commit()
    await db.refresh(shift)
    return _shift_out(shift)


@router.put("/shifts/{shift_id}", response_model=ShiftOut)
async def update_shift(
    shift_id: uuid.UUID,
    payload: ShiftUpdate,
    db: DBSession,
    _current_user: CurrentUser,
) -> ShiftOut:
    """Update a shift's schedule or active state."""
    result = await db.execute(select(AgentShift).where(AgentShift.id == shift_id))
    shift = result.scalar_one_or_none()
    if shift is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift not found")

    if payload.day_of_week is not None:
        if not (0 <= payload.day_of_week <= 6):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="day_of_week must be between 0 (Monday) and 6 (Sunday)",
            )
        shift.day_of_week = payload.day_of_week
    if payload.start_time is not None:
        shift.start_time = payload.start_time
    if payload.end_time is not None:
        shift.end_time = payload.end_time
    if payload.timezone is not None:
        shift.timezone = payload.timezone
    if payload.is_active is not None:
        shift.is_active = payload.is_active

    await db.commit()
    await db.refresh(shift)
    return _shift_out(shift)


@router.delete("/shifts/{shift_id}", status_code=status.HTTP_200_OK)
async def delete_shift(
    shift_id: uuid.UUID,
    db: DBSession,
    _current_user: CurrentUser,
) -> None:
    """Delete a shift entry."""
    result = await db.execute(select(AgentShift).where(AgentShift.id == shift_id))
    shift = result.scalar_one_or_none()
    if shift is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift not found")
    await db.delete(shift)
    await db.commit()


@router.get("/shifts/on-duty", response_model=list[OnDutyAgent])
async def list_on_duty_agents(
    db: DBSession,
    _current_user: CurrentUser,
) -> list[OnDutyAgent]:
    """Return agents currently on duty based on UTC time and active shifts.

    Compares the current UTC weekday (0=Monday) and HH:MM time against each
    agent's active shift windows.  Overnight shifts (end_time < start_time)
    are handled correctly.
    """
    now_utc = datetime.now(timezone.utc)
    current_dow = now_utc.weekday()  # 0=Monday … 6=Sunday
    current_minutes = now_utc.hour * 60 + now_utc.minute

    result = await db.execute(
        select(AgentShift)
        .where(AgentShift.is_active.is_(True))
        .where(AgentShift.day_of_week == current_dow)
    )
    candidate_shifts: list[AgentShift] = list(result.scalars().all())

    on_duty: list[OnDutyAgent] = []
    seen_agent_ids: set[uuid.UUID] = set()

    for shift in candidate_shifts:
        start_min = _time_str_to_minutes(shift.start_time)
        end_min = _time_str_to_minutes(shift.end_time)

        if end_min > start_min:
            # Normal (same-day) shift
            is_on = start_min <= current_minutes < end_min
        else:
            # Overnight shift (e.g. 22:00 – 06:00)
            is_on = current_minutes >= start_min or current_minutes < end_min

        if not is_on:
            continue

        agent_id = shift.user_id
        if agent_id in seen_agent_ids:
            continue
        seen_agent_ids.add(agent_id)

        # Fetch agent's skills
        skills_result = await db.execute(
            select(AgentSkill)
            .where(AgentSkill.user_id == agent_id)
            .order_by(AgentSkill.proficiency.desc())
        )
        agent_skills = list(skills_result.scalars().all())

        on_duty.append(
            OnDutyAgent(
                user_id=agent_id,
                agent_name=_agent_name(shift),
                shift_id=shift.id,
                day_of_week=shift.day_of_week,
                start_time=shift.start_time,
                end_time=shift.end_time,
                timezone=shift.timezone,
                skills=[_skill_out(s) for s in agent_skills],
            )
        )

    return on_duty


@router.get("/shifts/coverage", response_model=CoverageHeatmap)
async def get_coverage_heatmap(
    db: DBSession,
    _current_user: CurrentUser,
) -> CoverageHeatmap:
    """Return a 7×24 coverage heatmap showing agent count per (day, hour) slot.

    Each cell grid[day][hour] contains the number of agents whose active shift
    covers that hour on that day of the week.  Overnight shifts are handled.
    """
    # 7 days × 24 hours grid, initialised to zero
    grid: list[list[int]] = [[0] * 24 for _ in range(7)]

    result = await db.execute(
        select(AgentShift).where(AgentShift.is_active.is_(True))
    )
    active_shifts: list[AgentShift] = list(result.scalars().all())

    for shift in active_shifts:
        start_min = _time_str_to_minutes(shift.start_time)
        end_min = _time_str_to_minutes(shift.end_time)
        day = shift.day_of_week

        if end_min > start_min:
            # Same-day shift: mark each full hour covered
            start_hour = start_min // 60
            # End hour: if shift ends exactly on the hour, don't count that hour
            end_hour = (end_min - 1) // 60 + 1 if end_min % 60 != 0 else end_min // 60
            for h in range(start_hour, min(end_hour, 24)):
                grid[day][h] += 1
        else:
            # Overnight shift — covers start→midnight on `day` and midnight→end on next day
            next_day = (day + 1) % 7
            start_hour = start_min // 60
            for h in range(start_hour, 24):
                grid[day][h] += 1
            end_hour = (end_min - 1) // 60 + 1 if end_min % 60 != 0 else end_min // 60
            for h in range(0, min(end_hour, 24)):
                grid[next_day][h] += 1

    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    return CoverageHeatmap(
        grid=grid,
        days=day_names,
        hours=list(range(24)),
    )
