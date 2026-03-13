"""Projects API — Guest Access (invite, list, revoke, token-view).

Endpoints:
  POST   /projects/{id}/guests             — invite an external collaborator
  GET    /projects/{id}/guests             — list all guest tokens for a project
  DELETE /projects/{id}/guests/{guest_id}  — revoke a guest invitation
  GET    /projects/guest-view/{token}      — public token-based read-only view
"""

import secrets
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.projects import Project
from app.models.projects_enhanced import ProjectGuestAccess

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _user_can_manage_project(project: Project, user_id: uuid.UUID) -> bool:
    """Return True if user owns project or is a member."""
    if project.owner_id == user_id:
        return True
    members = project.members or []
    return str(user_id) in [str(m) for m in members]


def _generate_token() -> str:
    return secrets.token_urlsafe(32)


# ── Schemas ───────────────────────────────────────────────────────────────────

class GuestInviteCreate(BaseModel):
    email: EmailStr
    permissions: dict[str, bool] | None = None
    expires_at: datetime | None = None


class GuestInviteOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    email: str
    token: str
    permissions: dict[str, Any] | None
    invited_by: uuid.UUID
    expires_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class GuestProjectView(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    status: str | None
    guest_email: str
    permissions: dict[str, Any] | None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/projects/{project_id}/guests",
    response_model=GuestInviteOut,
    status_code=status.HTTP_201_CREATED,
    summary="Invite a guest collaborator",
)
async def invite_guest(
    project_id: uuid.UUID,
    body: GuestInviteCreate,
    db: DBSession,
    current_user: CurrentUser,
) -> GuestInviteOut:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not _user_can_manage_project(project, current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    # Default permissions if not provided
    perms = body.permissions or {"can_comment": True, "can_view_tasks": True, "can_edit_tasks": False}

    guest = ProjectGuestAccess(
        project_id=project_id,
        email=body.email,
        token=_generate_token(),
        permissions=perms,
        invited_by=current_user.id,
        expires_at=body.expires_at,
    )
    db.add(guest)
    await db.commit()
    await db.refresh(guest)
    return GuestInviteOut.model_validate(guest)


@router.get(
    "/projects/{project_id}/guests",
    response_model=list[GuestInviteOut],
    summary="List guest invitations for a project",
)
async def list_guests(
    project_id: uuid.UUID,
    db: DBSession,
    current_user: CurrentUser,
) -> list[GuestInviteOut]:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not _user_can_manage_project(project, current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(ProjectGuestAccess).where(ProjectGuestAccess.project_id == project_id)
    )
    guests = result.scalars().all()
    return [GuestInviteOut.model_validate(g) for g in guests]


@router.delete(
    "/projects/{project_id}/guests/{guest_id}",
    status_code=status.HTTP_200_OK,
    summary="Revoke a guest invitation",
)
async def revoke_guest(
    project_id: uuid.UUID,
    guest_id: uuid.UUID,
    db: DBSession,
    current_user: CurrentUser,
) -> dict[str, str]:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not _user_can_manage_project(project, current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    guest = await db.get(ProjectGuestAccess, guest_id)
    if not guest or guest.project_id != project_id:
        raise HTTPException(status_code=404, detail="Guest invitation not found")

    await db.delete(guest)
    await db.commit()
    return {"detail": "Guest access revoked"}


@router.get(
    "/projects/guest-view/{token}",
    response_model=GuestProjectView,
    summary="Public token-based read-only project view",
)
async def guest_token_view(
    token: str,
    db: DBSession,
) -> GuestProjectView:
    result = await db.execute(
        select(ProjectGuestAccess).where(ProjectGuestAccess.token == token)
    )
    guest = result.scalar_one_or_none()
    if not guest:
        raise HTTPException(status_code=404, detail="Invalid or expired token")

    # Check expiry
    if guest.expires_at and guest.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Guest link has expired")

    project = await db.get(Project, guest.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return GuestProjectView(
        id=project.id,
        name=project.name,
        description=getattr(project, "description", None),
        status=getattr(project, "status", None),
        guest_email=guest.email,
        permissions=guest.permissions,
    )
