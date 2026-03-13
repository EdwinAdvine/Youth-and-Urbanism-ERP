"""One-time backfill tasks to register existing module files in Drive.

Run manually via Celery:
    celery -A app.tasks.celery_app call app.tasks.drive_backfill.backfill_all

Or individually:
    celery -A app.tasks.celery_app call app.tasks.drive_backfill.backfill_mail_attachments
    celery -A app.tasks.celery_app call app.tasks.drive_backfill.backfill_calendar_attachments
    celery -A app.tasks.celery_app call app.tasks.drive_backfill.backfill_project_documents
"""
from __future__ import annotations

import logging

from app.tasks.celery_app import celery

logger = logging.getLogger(__name__)


@celery.task(name="app.tasks.drive_backfill.backfill_all")
def backfill_all() -> dict[str, int]:
    """Run all backfill tasks sequentially."""
    import asyncio

    loop = asyncio.new_event_loop()
    results = {}
    try:
        results["mail"] = loop.run_until_complete(_backfill_mail())
        results["calendar"] = loop.run_until_complete(_backfill_calendar())
        results["projects"] = loop.run_until_complete(_backfill_projects())
    finally:
        loop.close()

    logger.info("Drive backfill complete: %s", results)
    return results


@celery.task(name="app.tasks.drive_backfill.backfill_mail_attachments")
def backfill_mail_attachments() -> int:
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_backfill_mail())
    finally:
        loop.close()


@celery.task(name="app.tasks.drive_backfill.backfill_calendar_attachments")
def backfill_calendar_attachments() -> int:
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_backfill_calendar())
    finally:
        loop.close()


@celery.task(name="app.tasks.drive_backfill.backfill_project_documents")
def backfill_project_documents() -> int:
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_backfill_projects())
    finally:
        loop.close()


async def _backfill_mail() -> int:
    """Register mail attachments that have storage_key but no DriveFile."""
    from sqlalchemy import select

    from app.core.database import AsyncSessionLocal
    from app.models.mail_storage import MailboxMessage
    from app.services.drive_gateway import register_existing_object, find_module_file

    count = 0
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(MailboxMessage).where(MailboxMessage.attachments.isnot(None))
        )
        messages = result.scalars().all()

        for msg in messages:
            for att in (msg.attachments or []):
                storage_key = att.get("storage_key")
                if not storage_key:
                    continue

                entity_id = str(msg.id)
                existing = await find_module_file(db, "mail", "attachment", entity_id)
                if existing:
                    continue

                try:
                    await register_existing_object(
                        db,
                        minio_key=storage_key,
                        filename=att.get("filename", "attachment"),
                        content_type=att.get("content_type", "application/octet-stream"),
                        size=att.get("size", 0),
                        owner_id=msg.user_id,
                        source_module="mail",
                        source_entity_type="attachment",
                        source_entity_id=entity_id,
                    )
                    count += 1
                except Exception:
                    logger.exception("Failed to backfill mail attachment %s", storage_key)

        await db.commit()

    logger.info("Backfilled %d mail attachments", count)
    return count


async def _backfill_calendar() -> int:
    """Register calendar attachments with minio_key but no drive_file_id."""
    from sqlalchemy import select

    from app.core.database import AsyncSessionLocal
    from app.models.calendar import EventAttachment
    from app.services.drive_gateway import register_existing_object

    count = 0
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(EventAttachment).where(
                EventAttachment.minio_key.isnot(None),
                EventAttachment.drive_file_id.is_(None),
            )
        )
        attachments = result.scalars().all()

        for att in attachments:
            try:
                drive_file = await register_existing_object(
                    db,
                    minio_key=att.minio_key,
                    filename=att.file_name or "calendar-attachment",
                    content_type=att.mime_type or "application/octet-stream",
                    size=att.file_size or 0,
                    owner_id=att.uploaded_by,
                    source_module="calendar",
                    source_entity_type="event_attachment",
                    source_entity_id=str(att.id),
                    folder_name=None,
                )
                # Update the EventAttachment to point to the new DriveFile
                att.drive_file_id = drive_file.id
                count += 1
            except Exception:
                logger.exception("Failed to backfill calendar attachment %s", att.id)

        await db.commit()

    logger.info("Backfilled %d calendar attachments", count)
    return count


async def _backfill_projects() -> int:
    """Tag existing ProjectDocument entries with source_module='projects'."""
    from sqlalchemy import select

    from app.core.database import AsyncSessionLocal
    from app.models.drive import DriveFile
    from app.models.project_links import ProjectDocument

    count = 0
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(ProjectDocument))
        docs = result.scalars().all()

        for doc in docs:
            if not doc.file_id:
                continue
            drive_file = await db.get(DriveFile, doc.file_id)
            if drive_file and not drive_file.source_module:
                drive_file.source_module = "projects"
                drive_file.source_entity_type = "document"
                drive_file.source_entity_id = str(doc.id)
                count += 1

        await db.commit()

    logger.info("Tagged %d project documents with source_module", count)
    return count
