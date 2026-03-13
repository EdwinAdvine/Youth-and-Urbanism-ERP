"""Calendar Group/Department calendars — auto-create from HR departments."""


import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession, SuperAdminUser
from app.models.calendar import UserCalendar, CalendarPermission
from app.models.hr import Department, Employee

router = APIRouter(prefix="/calendar", tags=["Calendar - Group Calendars"])

# ── Colours for department calendars (rotate) ────────────────────────────────
DEPT_COLORS = [
    "#51459d", "#3ec9d6", "#6fd943", "#ffa21d", "#ff3a6e",
    "#8b5cf6", "#0ea5e9", "#f59e0b", "#14b8a6", "#ec4899",
]


# ── Schemas ──────────────────────────────────────────────────────────────────

class GroupCalendarOut(BaseModel):
    id: uuid.UUID
    name: str
    color: str
    description: Optional[str]
    calendar_type: str
    department_id: Optional[uuid.UUID]
    owner_id: uuid.UUID
    member_count: int = 0

    model_config = {"from_attributes": True}


class GroupCalendarCreate(BaseModel):
    name: str
    color: str = "#51459d"
    description: Optional[str] = None
    department_id: Optional[uuid.UUID] = None


class SyncResult(BaseModel):
    created: int
    updated: int
    departments_processed: int


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/group-calendars", response_model=list[GroupCalendarOut])
async def list_group_calendars(
    db: DBSession,
    user: CurrentUser,
    calendar_type: Optional[str] = None,
):
    """List all group/department/team calendars the user can see."""
    query = select(UserCalendar).where(
        UserCalendar.calendar_type.in_(["department", "team", "shared"])
    )
    if calendar_type:
        query = query.where(UserCalendar.calendar_type == calendar_type)

    result = await db.execute(query)
    calendars = result.scalars().all()

    out = []
    for cal in calendars:
        # Count members who have permissions
        perm_q = select(CalendarPermission).where(
            CalendarPermission.calendar_id == cal.id
        )
        perm_result = await db.execute(perm_q)
        member_count = len(perm_result.scalars().all())

        out.append(GroupCalendarOut(
            id=cal.id,
            name=cal.name,
            color=cal.color,
            description=cal.description,
            calendar_type=cal.calendar_type,
            department_id=cal.department_id,
            owner_id=cal.owner_id,
            member_count=member_count,
        ))

    return out


@router.post("/group-calendars", response_model=GroupCalendarOut, status_code=201)
async def create_group_calendar(
    body: GroupCalendarCreate,
    db: DBSession,
    user: CurrentUser,
):
    """Manually create a group/team calendar."""
    cal = UserCalendar(
        name=body.name,
        color=body.color,
        description=body.description,
        calendar_type="team",
        department_id=body.department_id,
        owner_id=user.id,
        is_default=False,
        is_visible=True,
    )
    db.add(cal)
    await db.flush()

    # Grant the creator manage permission
    perm = CalendarPermission(
        calendar_id=cal.id,
        grantee_id=user.id,
        permission_level="manage",
        granted_by=user.id,
    )
    db.add(perm)
    await db.commit()
    await db.refresh(cal)

    return GroupCalendarOut(
        id=cal.id,
        name=cal.name,
        color=cal.color,
        description=cal.description,
        calendar_type=cal.calendar_type,
        department_id=cal.department_id,
        owner_id=cal.owner_id,
        member_count=1,
    )


@router.post(
    "/group-calendars/sync-departments",
    response_model=SyncResult,
    status_code=200,
)
async def sync_department_calendars(
    db: DBSession,
    admin: SuperAdminUser,
):
    """Auto-create a department calendar for every HR department.

    - Creates UserCalendar with type='department' linked to the department
    - Grants 'read' permission to all department members
    - Grants 'manage' permission to department head
    - Skips departments that already have a calendar
    - Rotates through a colour palette
    """
    # 1. Get all active departments
    dept_result = await db.execute(
        select(Department).where(Department.is_active.is_(True))
    )
    departments = dept_result.scalars().all()

    created = 0
    updated = 0

    for idx, dept in enumerate(departments):
        # Check if calendar already exists for this department
        existing = await db.execute(
            select(UserCalendar).where(
                and_(
                    UserCalendar.department_id == dept.id,
                    UserCalendar.calendar_type == "department",
                )
            )
        )
        cal = existing.scalars().first()

        if cal is None:
            # Create new department calendar
            cal = UserCalendar(
                name=f"{dept.name} Calendar",
                color=DEPT_COLORS[idx % len(DEPT_COLORS)],
                description=f"Auto-generated calendar for {dept.name} department",
                calendar_type="department",
                department_id=dept.id,
                owner_id=dept.head_id or admin.id,
                is_default=False,
                is_visible=True,
            )
            db.add(cal)
            await db.flush()
            created += 1
        else:
            updated += 1

        # Get all employees in this department
        emp_result = await db.execute(
            select(Employee).where(
                and_(
                    Employee.department_id == dept.id,
                    Employee.is_active.is_(True),
                )
            )
        )
        employees = emp_result.scalars().all()

        # Get existing permission grantee IDs
        existing_perms = await db.execute(
            select(CalendarPermission.grantee_id).where(
                CalendarPermission.calendar_id == cal.id
            )
        )
        existing_grantee_ids = {row[0] for row in existing_perms}

        # Grant permissions to department members
        for emp in employees:
            if emp.user_id in existing_grantee_ids:
                continue

            is_head = dept.head_id and emp.user_id == dept.head_id
            perm = CalendarPermission(
                calendar_id=cal.id,
                grantee_id=emp.user_id,
                permission_level="manage" if is_head else "read",
                granted_by=admin.id,
            )
            db.add(perm)

        # If department head isn't an employee record, still grant manage
        if dept.head_id and dept.head_id not in existing_grantee_ids:
            head_is_employee = any(e.user_id == dept.head_id for e in employees)
            if not head_is_employee:
                perm = CalendarPermission(
                    calendar_id=cal.id,
                    grantee_id=dept.head_id,
                    permission_level="manage",
                    granted_by=admin.id,
                )
                db.add(perm)

    await db.commit()

    return SyncResult(
        created=created,
        updated=updated,
        departments_processed=len(departments),
    )


@router.delete("/group-calendars/{calendar_id}", status_code=204)
async def delete_group_calendar(
    calendar_id: uuid.UUID,
    db: DBSession,
    user: CurrentUser,
):
    """Delete a group calendar. Only owner or super admin can delete."""
    result = await db.execute(
        select(UserCalendar).where(UserCalendar.id == calendar_id)
    )
    cal = result.scalars().first()
    if not cal:
        raise HTTPException(status_code=404, detail="Calendar not found")

    if cal.owner_id != user.id and not getattr(user, "is_super_admin", False):
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.delete(cal)
    await db.commit()


@router.get("/group-calendars/{calendar_id}/members")
async def list_calendar_members(
    calendar_id: uuid.UUID,
    db: DBSession,
    user: CurrentUser,
):
    """List all members with their permission levels."""
    result = await db.execute(
        select(CalendarPermission).where(
            CalendarPermission.calendar_id == calendar_id
        )
    )
    perms = result.scalars().all()

    return [
        {
            "id": str(p.id),
            "grantee_id": str(p.grantee_id),
            "permission_level": p.permission_level,
            "granted_by": str(p.granted_by) if p.granted_by else None,
            "granted_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in perms
    ]


# ── Granular CalendarPermission CRUD (item 22) ───────────────────────────────

VALID_PERMISSION_LEVELS = ("free_busy", "read", "propose", "edit", "manage")


class PermissionCreate(BaseModel):
    calendar_id: uuid.UUID
    grantee_id: uuid.UUID
    permission_level: str = "read"


class PermissionUpdate(BaseModel):
    permission_level: str


class PermissionOut(BaseModel):
    id: uuid.UUID
    calendar_id: uuid.UUID
    grantee_id: uuid.UUID
    permission_level: str
    granted_by: Optional[uuid.UUID]
    created_at: Optional[str]

    model_config = {"from_attributes": True}


@router.get("/permissions", response_model=list[PermissionOut], tags=["Calendar - Permissions"])
async def list_calendar_permissions(
    db: DBSession,
    user: CurrentUser,
    calendar_id: Optional[uuid.UUID] = None,
):
    """List CalendarPermission records.

    If ``calendar_id`` is provided, returns only permissions for that calendar.
    Otherwise returns all permissions on calendars owned by the current user.
    """
    if calendar_id:
        query = select(CalendarPermission).where(
            CalendarPermission.calendar_id == calendar_id
        )
    else:
        # Permissions on calendars the user owns
        owned_cals = await db.execute(
            select(UserCalendar.id).where(UserCalendar.owner_id == user.id)
        )
        owned_ids = [row[0] for row in owned_cals]
        query = select(CalendarPermission).where(
            CalendarPermission.calendar_id.in_(owned_ids)
        )

    result = await db.execute(query.order_by(CalendarPermission.created_at.asc()))
    perms = result.scalars().all()
    return [
        PermissionOut(
            id=p.id,
            calendar_id=p.calendar_id,
            grantee_id=p.grantee_id,
            permission_level=p.permission_level,
            granted_by=p.granted_by,
            created_at=p.created_at.isoformat() if p.created_at else None,
        )
        for p in perms
    ]


@router.post(
    "/permissions",
    response_model=PermissionOut,
    status_code=201,
    tags=["Calendar - Permissions"],
)
async def create_calendar_permission(
    body: PermissionCreate,
    db: DBSession,
    user: CurrentUser,
):
    """Grant a user access to a calendar.

    The caller must own the calendar or already have 'manage' permission.
    ``permission_level`` must be one of: free_busy | read | propose | edit | manage
    """
    if body.permission_level not in VALID_PERMISSION_LEVELS:
        from fastapi import HTTPException as _HTTPException, status as _status
        raise _HTTPException(
            status_code=_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"permission_level must be one of: {', '.join(VALID_PERMISSION_LEVELS)}",
        )

    # Verify the caller has authority over the calendar
    cal = await db.get(UserCalendar, body.calendar_id)
    if not cal:
        from fastapi import HTTPException as _HTTPException, status as _status
        raise _HTTPException(status_code=404, detail="Calendar not found")

    is_owner = cal.owner_id == user.id
    if not is_owner:
        # Check if caller has manage permission
        mgr_result = await db.execute(
            select(CalendarPermission).where(
                CalendarPermission.calendar_id == body.calendar_id,
                CalendarPermission.grantee_id == user.id,
                CalendarPermission.permission_level == "manage",
            )
        )
        if not mgr_result.scalar_one_or_none():
            from fastapi import HTTPException as _HTTPException, status as _status
            raise _HTTPException(
                status_code=403,
                detail="Only the calendar owner or a manager can grant permissions",
            )

    # Upsert — update if already exists
    existing_result = await db.execute(
        select(CalendarPermission).where(
            CalendarPermission.calendar_id == body.calendar_id,
            CalendarPermission.grantee_id == body.grantee_id,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        existing.permission_level = body.permission_level
        existing.granted_by = user.id
        await db.commit()
        await db.refresh(existing)
        perm = existing
    else:
        perm = CalendarPermission(
            calendar_id=body.calendar_id,
            grantee_id=body.grantee_id,
            permission_level=body.permission_level,
            granted_by=user.id,
        )
        db.add(perm)
        await db.commit()
        await db.refresh(perm)

    return PermissionOut(
        id=perm.id,
        calendar_id=perm.calendar_id,
        grantee_id=perm.grantee_id,
        permission_level=perm.permission_level,
        granted_by=perm.granted_by,
        created_at=perm.created_at.isoformat() if perm.created_at else None,
    )


@router.put(
    "/permissions/{permission_id}",
    response_model=PermissionOut,
    tags=["Calendar - Permissions"],
)
async def update_calendar_permission(
    permission_id: uuid.UUID,
    body: PermissionUpdate,
    db: DBSession,
    user: CurrentUser,
):
    """Update a CalendarPermission's level."""
    if body.permission_level not in VALID_PERMISSION_LEVELS:
        from fastapi import HTTPException as _HTTPException, status as _status
        raise _HTTPException(
            status_code=422,
            detail=f"permission_level must be one of: {', '.join(VALID_PERMISSION_LEVELS)}",
        )

    perm = await db.get(CalendarPermission, permission_id)
    if not perm:
        from fastapi import HTTPException as _HTTPException, status as _status
        raise _HTTPException(status_code=404, detail="Permission not found")

    # Verify authority
    cal = await db.get(UserCalendar, perm.calendar_id)
    if not cal or (cal.owner_id != user.id and perm.granted_by != user.id):
        mgr_result = await db.execute(
            select(CalendarPermission).where(
                CalendarPermission.calendar_id == perm.calendar_id,
                CalendarPermission.grantee_id == user.id,
                CalendarPermission.permission_level == "manage",
            )
        )
        if not mgr_result.scalar_one_or_none():
            from fastapi import HTTPException as _HTTPException, status as _status
            raise _HTTPException(status_code=403, detail="Not authorized to update this permission")

    perm.permission_level = body.permission_level
    await db.commit()
    await db.refresh(perm)
    return PermissionOut(
        id=perm.id,
        calendar_id=perm.calendar_id,
        grantee_id=perm.grantee_id,
        permission_level=perm.permission_level,
        granted_by=perm.granted_by,
        created_at=perm.created_at.isoformat() if perm.created_at else None,
    )


@router.delete(
    "/permissions/{permission_id}",
    status_code=204,
    tags=["Calendar - Permissions"],
)
async def delete_calendar_permission(
    permission_id: uuid.UUID,
    db: DBSession,
    user: CurrentUser,
):
    """Revoke a CalendarPermission."""
    perm = await db.get(CalendarPermission, permission_id)
    if not perm:
        from fastapi import HTTPException as _HTTPException, status as _status
        raise _HTTPException(status_code=404, detail="Permission not found")

    cal = await db.get(UserCalendar, perm.calendar_id)
    if not cal or cal.owner_id != user.id:
        mgr_result = await db.execute(
            select(CalendarPermission).where(
                CalendarPermission.calendar_id == perm.calendar_id,
                CalendarPermission.grantee_id == user.id,
                CalendarPermission.permission_level == "manage",
            )
        )
        if not mgr_result.scalar_one_or_none():
            from fastapi import HTTPException as _HTTPException, status as _status
            raise _HTTPException(status_code=403, detail="Not authorized to revoke this permission")

    await db.delete(perm)
    await db.commit()
