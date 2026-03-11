"""Sales sequence execution engine — processes enrollments via Celery beat."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.crm import (
    EmailTemplate,
    SalesActivity,
    SalesSequence,
    SequenceEnrollment,
    SequenceStep,
)

logger = logging.getLogger(__name__)


async def process_enrollments(db: AsyncSession) -> dict:
    """Process all active enrollments — advance to next step if delay has elapsed."""
    stmt = (
        select(SequenceEnrollment)
        .where(SequenceEnrollment.status == "active")
        .options(
            selectinload(SequenceEnrollment.sequence).selectinload(SalesSequence.steps),
            selectinload(SequenceEnrollment.current_step),
            selectinload(SequenceEnrollment.contact),
        )
    )
    result = await db.execute(stmt)
    enrollments = list(result.scalars().all())

    processed = 0
    completed = 0
    now = datetime.now(timezone.utc)

    for enrollment in enrollments:
        sequence = enrollment.sequence
        if not sequence or sequence.status != "active":
            continue

        steps = sorted(sequence.steps, key=lambda s: s.step_order)
        if not steps:
            continue

        if enrollment.current_step_id is None:
            # First step — check if delay from enrollment has elapsed
            first_step = steps[0]
            delay = timedelta(days=first_step.delay_days, hours=first_step.delay_hours)
            if now >= enrollment.enrolled_at + delay:
                await _execute_step(db, enrollment, first_step)
                enrollment.current_step_id = first_step.id
                processed += 1
        else:
            # Find next step
            current_order = enrollment.current_step.step_order if enrollment.current_step else 0
            next_step = None
            for s in steps:
                if s.step_order > current_order:
                    next_step = s
                    break

            if next_step is None:
                # Sequence complete
                enrollment.status = "completed"
                enrollment.completed_at = now
                completed += 1
                continue

            # Check delay from last step execution
            delay = timedelta(days=next_step.delay_days, hours=next_step.delay_hours)
            last_update = enrollment.updated_at
            if now >= last_update + delay:
                await _execute_step(db, enrollment, next_step)
                enrollment.current_step_id = next_step.id
                processed += 1

    await db.flush()
    return {"processed": processed, "completed": completed, "total_active": len(enrollments)}


async def _execute_step(db: AsyncSession, enrollment: SequenceEnrollment, step: SequenceStep):
    """Execute a single sequence step."""
    step_type = step.step_type
    config = step.config or {}

    if step_type == "email":
        await _execute_email_step(db, enrollment, config)
    elif step_type == "task":
        await _execute_task_step(db, enrollment, config)
    elif step_type == "wait":
        pass  # Wait steps just consume delay
    elif step_type == "condition":
        pass  # Condition evaluation — future enhancement

    # Log activity
    activity = SalesActivity(
        activity_type="email" if step_type == "email" else "task" if step_type == "task" else "note",
        subject=f"Sequence step: {step_type} (step {step.step_order})",
        description=config.get("description", f"Auto-executed sequence step {step.step_order}"),
        contact_id=enrollment.contact_id,
        completed_at=datetime.now(timezone.utc),
        owner_id=enrollment.enrolled_by,
    )
    db.add(activity)

    # Update enrollment metadata
    history = enrollment.metadata_json or {}
    step_log = history.get("steps_executed", [])
    step_log.append({
        "step_id": str(step.id),
        "step_order": step.step_order,
        "step_type": step_type,
        "executed_at": datetime.now(timezone.utc).isoformat(),
    })
    history["steps_executed"] = step_log
    enrollment.metadata_json = history


async def _execute_email_step(db: AsyncSession, enrollment: SequenceEnrollment, config: dict):
    """Send email via template — delegates to Celery send_email task."""
    template_id = config.get("template_id")
    if not template_id:
        logger.warning("Email step has no template_id, skipping")
        return

    stmt = select(EmailTemplate).where(EmailTemplate.id == template_id)
    result = await db.execute(stmt)
    template = result.scalar_one_or_none()
    if not template:
        logger.warning(f"Template {template_id} not found, skipping email step")
        return

    contact = enrollment.contact
    if not contact or not contact.email:
        logger.warning(f"Contact has no email for enrollment {enrollment.id}")
        return

    # Merge template variables
    subject = template.subject
    body = template.body_html
    merge_data = {
        "first_name": contact.first_name or "",
        "last_name": contact.last_name or "",
        "company_name": contact.company_name or "",
        "email": contact.email or "",
    }
    for key, val in merge_data.items():
        subject = subject.replace(f"{{{{{key}}}}}", val)
        body = body.replace(f"{{{{{key}}}}}", val)

    # Enqueue email via Celery
    try:
        from app.tasks.celery_app import send_email
        send_email.delay(
            to_email=contact.email,
            subject=subject,
            body=body,
        )
    except Exception as e:
        logger.error(f"Failed to enqueue email for enrollment {enrollment.id}: {e}")


async def _execute_task_step(db: AsyncSession, enrollment: SequenceEnrollment, config: dict):
    """Create a task activity for the enrollment owner."""
    task_desc = config.get("description", "Follow up with contact")
    due_days = config.get("due_days", 1)

    activity = SalesActivity(
        activity_type="task",
        subject=config.get("subject", "Sequence task"),
        description=task_desc,
        contact_id=enrollment.contact_id,
        assigned_to=enrollment.enrolled_by,
        due_date=datetime.now(timezone.utc) + timedelta(days=due_days),
        owner_id=enrollment.enrolled_by,
    )
    db.add(activity)


async def enroll_contact(
    db: AsyncSession,
    sequence_id,
    contact_id,
    enrolled_by,
) -> SequenceEnrollment:
    """Enroll a contact in a sales sequence."""
    enrollment = SequenceEnrollment(
        sequence_id=sequence_id,
        contact_id=contact_id,
        enrolled_at=datetime.now(timezone.utc),
        enrolled_by=enrolled_by,
        status="active",
    )
    db.add(enrollment)
    await db.flush()
    return enrollment


async def unenroll_contact(db: AsyncSession, enrollment_id) -> dict:
    """Unenroll a contact from a sequence."""
    stmt = select(SequenceEnrollment).where(SequenceEnrollment.id == enrollment_id)
    result = await db.execute(stmt)
    enrollment = result.scalar_one_or_none()
    if not enrollment:
        return {"error": "Enrollment not found"}
    enrollment.status = "paused"
    await db.flush()
    return {"status": "paused", "enrollment_id": str(enrollment.id)}
