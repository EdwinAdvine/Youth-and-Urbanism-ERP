"""Email-to-Task inbound processing via Stalwart IMAP polling.

Provides two endpoints:
  GET  /projects/email/address          — user's personal project-task email address
  POST /projects/email/process-inbound  — internal webhook called by Celery beat

Any email sent to tasks+<hash>@erp.local will be automatically converted to a
task in the user's default (most recently active) project.  The Celery IMAP
polling task resolves the destination address to a user_id and calls this
endpoint with the parsed email payload.
"""

import hashlib
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.projects import Project, Task

router = APIRouter(tags=["Projects Email Inbound"])

_EMAIL_DOMAIN = "erp.local"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _user_task_email_address(user_id: uuid.UUID) -> str:
    """Return the deterministic tasks-inbound address for a user.

    Format: tasks+{first8hexofsha256(user_id)}@erp.local
    """
    uid_hash = hashlib.sha256(str(user_id).encode()).hexdigest()[:8]
    return f"tasks+{uid_hash}@{_EMAIL_DOMAIN}"


# ── Schemas ───────────────────────────────────────────────────────────────────

class TaskInboundEmailPayload(BaseModel):
    """Payload sent by the Celery IMAP polling task."""
    from_email: str
    subject: str
    body_text: str | None = None
    body_html: str | None = None
    # Resolved by the Celery task from the destination email address
    owner_user_id: str | None = None
    # Optional: explicit project_id to add the task to
    project_id: str | None = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get(
    "/email/address",
    summary="Get the user's personal task-inbound email address",
)
async def get_task_email_address(current_user: CurrentUser) -> dict[str, str]:
    """Return the inbound email address that creates tasks on behalf of the user.

    Any email sent to this address will become a new task in the user's most
    recently created project. The subject becomes the task title and the body
    becomes the task description.
    """
    return {
        "address": _user_task_email_address(current_user.id),
        "description": (
            "Forward or send emails to this address to automatically create tasks. "
            "Subject becomes the task title; body becomes the description. "
            "The task will be added to your most recent project in 'todo' status."
        ),
    }


@router.post(
    "/email/process-inbound",
    summary="Process an inbound email and create a task (internal, Celery only)",
    status_code=status.HTTP_201_CREATED,
)
async def process_inbound_email(
    payload: TaskInboundEmailPayload,
    db: DBSession,
) -> dict[str, Any]:
    """Create a task from an inbound email message.

    Called internally by the Celery beat IMAP polling task.  No user JWT
    authentication is required (trusted internal call).  In a production
    hardened deployment you would verify an internal API key header here.
    """
    if not payload.owner_user_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="owner_user_id is required for inbound email task creation",
        )

    try:
        owner_id = uuid.UUID(payload.owner_user_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid owner_user_id UUID")

    # Resolve target project
    if payload.project_id:
        try:
            project_id = uuid.UUID(payload.project_id)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid project_id UUID")
        project = await db.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Target project not found")
    else:
        # Fall back to most recently created project owned or membered by this user
        result = await db.execute(
            select(Project)
            .where(Project.owner_id == owner_id)
            .order_by(Project.created_at.desc())
            .limit(1)
        )
        project = result.scalar_one_or_none()
        if not project:
            raise HTTPException(
                status_code=404,
                detail="No project found for this user. Create a project first.",
            )

    title = (payload.subject.strip() or f"Email from {payload.from_email}")[:500]
    description = payload.body_text or payload.body_html or ""

    task = Task(
        project_id=project.id,
        title=title,
        description=description,
        status="todo",
        priority="medium",
        tags=["email-inbound"],
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    return {
        "id": str(task.id),
        "title": task.title,
        "project_id": str(task.project_id),
        "status": task.status,
        "created_at": task.created_at.isoformat(),
    }
