"""Drive Linker — helper to upload files to MinIO and create DriveFile records.

This service acts as the central file-storage bridge so that any module
(Finance invoices, HR documents, CRM attachments, etc.) can persist files
through Drive without duplicating upload logic.

Usage::

    from app.services.drive_linker import upload_and_link

    drive_file = await upload_and_link(
        file_data=pdf_bytes,
        filename="invoice_INV-2026-0001.pdf",
        user_id=str(current_user.id),
        folder_path="finance/invoices",
        content_type="application/pdf",
        db=db,
    )
    # drive_file is a persisted DriveFile ORM instance
"""
from __future__ import annotations

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.minio_client import upload_file as minio_upload
from app.models.drive import DriveFile

logger = logging.getLogger(__name__)


async def upload_and_link(
    file_data: bytes,
    filename: str,
    user_id: str,
    folder_path: str,
    content_type: str,
    db: AsyncSession,
) -> DriveFile:
    """Upload a file to MinIO and create a corresponding DriveFile record.

    Parameters
    ----------
    file_data : bytes
        Raw file content.
    filename : str
        Human-readable file name (e.g. ``report.pdf``).
    user_id : str
        UUID string of the owning user.
    folder_path : str
        Logical folder path within Drive (e.g. ``finance/invoices``).
    content_type : str
        MIME type (e.g. ``application/pdf``).
    db : AsyncSession
        Active database session (caller is responsible for the outer transaction).

    Returns
    -------
    DriveFile
        The persisted ORM record with ``id``, ``minio_key``, etc.
    """
    # 1. Upload to MinIO
    minio_record = minio_upload(
        file_data=file_data,
        filename=filename,
        user_id=user_id,
        folder_path=folder_path,
        content_type=content_type,
    )

    # 2. Create DriveFile DB record
    drive_file = DriveFile(
        name=filename,
        content_type=content_type,
        size=minio_record["size"],
        minio_key=minio_record["minio_key"],
        folder_path=minio_record["folder_path"],
        owner_id=uuid.UUID(user_id),
        is_public=False,
    )
    db.add(drive_file)
    await db.flush()
    await db.refresh(drive_file)

    logger.info(
        "Drive-linked file: %s (%d bytes) -> %s",
        filename,
        minio_record["size"],
        minio_record["minio_key"],
    )
    return drive_file
