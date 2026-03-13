"""Drive Gateway — universal file registration service.

Every ERP module that creates files should call this service to register
them in Drive, making them discoverable via Drive search, browsing, and
cross-module navigation.

Usage from event handlers or routers::

    from app.services.drive_gateway import register_module_file, find_module_file

    # Register a new file (uploads to MinIO + creates DriveFile)
    drive_file = await register_module_file(
        db=db,
        file_data=html_bytes,
        filename="INV-001.html",
        content_type="text/html",
        owner_id=user_id,
        source_module="finance",
        source_entity_type="invoice",
        source_entity_id=str(invoice.id),
        folder_name="Invoices",
    )
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations import minio_client
from app.models.drive import DriveFile, DriveFolder

logger = logging.getLogger(__name__)

# ── Module folder naming convention ──────────────────────────────────────────

MODULE_FOLDER_MAP: dict[str, str] = {
    "finance": "Finance Documents",
    "notes": "Notes",
    "mail": "Mail Attachments",
    "pos": "POS Documents",
    "hr": "HR Documents",
    "support": "Support Documents",
    "manufacturing": "Manufacturing Documents",
    "supplychain": "Supply Chain Documents",
    "calendar": "Calendar Attachments",
    "projects": "Project Documents",
    "crm": "CRM Documents",
    "ecommerce": "E-Commerce Documents",
    "inventory": "Inventory Documents",
}


# ── Folder management ───────────────────────────────────────────────────────

async def ensure_module_folder(
    db: AsyncSession,
    user_id: uuid.UUID,
    module: str,
    subfolder_name: str | None = None,
) -> DriveFolder:
    """Get or create the module root folder, and optionally a subfolder.

    Hierarchy: ``{Module Root} / {Subfolder}``
    e.g. ``Finance Documents / Invoices``

    Returns the leaf folder (subfolder if given, root otherwise).
    """
    root_name = MODULE_FOLDER_MAP.get(module, f"{module.title()} Documents")

    # Find or create root folder
    result = await db.execute(
        select(DriveFolder).where(
            DriveFolder.owner_id == user_id,
            DriveFolder.name == root_name,
            DriveFolder.parent_id.is_(None),
            DriveFolder.description == f"{module}:root",
        ).limit(1)
    )
    root = result.scalar_one_or_none()
    if not root:
        root = DriveFolder(
            name=root_name,
            owner_id=user_id,
            description=f"{module}:root",
            icon=_module_icon(module),
        )
        db.add(root)
        await db.flush()

    if not subfolder_name:
        return root

    # Find or create subfolder
    desc_key = f"{module}:{subfolder_name}"
    result = await db.execute(
        select(DriveFolder).where(
            DriveFolder.owner_id == user_id,
            DriveFolder.parent_id == root.id,
            DriveFolder.description == desc_key,
        ).limit(1)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        sub = DriveFolder(
            name=subfolder_name,
            owner_id=user_id,
            parent_id=root.id,
            description=desc_key,
        )
        db.add(sub)
        await db.flush()

    return sub


def _module_icon(module: str) -> str:
    """Return an icon identifier for a module folder."""
    icons = {
        "finance": "receipt",
        "notes": "notebook",
        "mail": "mail",
        "pos": "shopping-cart",
        "hr": "users",
        "support": "life-buoy",
        "manufacturing": "settings",
        "supplychain": "truck",
        "calendar": "calendar",
        "projects": "briefcase",
        "crm": "user-check",
        "ecommerce": "shopping-bag",
        "inventory": "package",
    }
    return icons.get(module, "folder")


# ── File registration ────────────────────────────────────────────────────────

async def register_module_file(
    db: AsyncSession,
    *,
    file_data: bytes,
    filename: str,
    content_type: str,
    owner_id: uuid.UUID,
    source_module: str,
    source_entity_type: str,
    source_entity_id: str,
    folder_name: str | None = None,
) -> DriveFile:
    """Upload file to MinIO and create a DriveFile with source tracking.

    Idempotent: if a DriveFile already exists for the same
    (source_module, source_entity_type, source_entity_id), the existing
    file's content is updated instead of creating a duplicate.
    """
    existing = await find_module_file(db, source_module, source_entity_type, source_entity_id)
    if existing:
        return await update_module_file(
            db,
            drive_file=existing,
            file_data=file_data,
            filename=filename,
            content_type=content_type,
        )

    folder = await ensure_module_folder(db, owner_id, source_module, folder_name)
    folder_path_str = f"/{MODULE_FOLDER_MAP.get(source_module, source_module)}"
    if folder_name:
        folder_path_str += f"/{folder_name}"

    record = minio_client.upload_file(
        file_data=file_data,
        filename=filename,
        user_id=str(owner_id),
        folder_path=folder_path_str.strip("/"),
        content_type=content_type,
    )

    drive_file = DriveFile(
        id=uuid.UUID(record["file_id"]),
        name=filename,
        content_type=content_type,
        size=len(file_data),
        minio_key=record["minio_key"],
        folder_path=folder_path_str,
        folder_id=folder.id,
        owner_id=owner_id,
        is_public=False,
        source_module=source_module,
        source_entity_type=source_entity_type,
        source_entity_id=source_entity_id,
    )
    db.add(drive_file)
    await db.flush()

    logger.info(
        "Registered module file: %s/%s → %s (DriveFile %s)",
        source_module, source_entity_type, filename, drive_file.id,
    )
    return drive_file


async def register_existing_object(
    db: AsyncSession,
    *,
    minio_key: str,
    filename: str,
    content_type: str,
    size: int,
    owner_id: uuid.UUID,
    source_module: str,
    source_entity_type: str,
    source_entity_id: str,
    folder_name: str | None = None,
) -> DriveFile:
    """Register a file that already exists in MinIO without re-uploading.

    Used for mail attachments, calendar attachments, etc. that are already
    stored but not yet tracked as DriveFile rows.
    """
    existing = await find_module_file(db, source_module, source_entity_type, source_entity_id)
    if existing:
        return existing

    # Check if minio_key is already registered (unique constraint)
    result = await db.execute(
        select(DriveFile).where(DriveFile.minio_key == minio_key).limit(1)
    )
    existing_by_key = result.scalar_one_or_none()
    if existing_by_key:
        # Already a DriveFile, just update source tracking
        existing_by_key.source_module = source_module
        existing_by_key.source_entity_type = source_entity_type
        existing_by_key.source_entity_id = source_entity_id
        await db.flush()
        return existing_by_key

    folder = await ensure_module_folder(db, owner_id, source_module, folder_name)
    folder_path_str = f"/{MODULE_FOLDER_MAP.get(source_module, source_module)}"
    if folder_name:
        folder_path_str += f"/{folder_name}"

    drive_file = DriveFile(
        name=filename,
        content_type=content_type,
        size=size,
        minio_key=minio_key,
        folder_path=folder_path_str,
        folder_id=folder.id,
        owner_id=owner_id,
        is_public=False,
        source_module=source_module,
        source_entity_type=source_entity_type,
        source_entity_id=source_entity_id,
    )
    db.add(drive_file)
    await db.flush()

    logger.info(
        "Registered existing MinIO object: %s → %s (DriveFile %s)",
        minio_key, filename, drive_file.id,
    )
    return drive_file


# ── Lookup + update ──────────────────────────────────────────────────────────

async def find_module_file(
    db: AsyncSession,
    source_module: str,
    source_entity_type: str,
    source_entity_id: str,
) -> DriveFile | None:
    """Find the DriveFile registered for a specific module entity."""
    result = await db.execute(
        select(DriveFile).where(
            DriveFile.source_module == source_module,
            DriveFile.source_entity_type == source_entity_type,
            DriveFile.source_entity_id == source_entity_id,
        ).limit(1)
    )
    return result.scalar_one_or_none()


async def update_module_file(
    db: AsyncSession,
    *,
    drive_file: DriveFile,
    file_data: bytes,
    filename: str | None = None,
    content_type: str | None = None,
) -> DriveFile:
    """Update the MinIO content and metadata of an existing module file."""
    ct = content_type or drive_file.content_type
    minio_client.upload_file_from_bytes(
        data=file_data,
        object_name=drive_file.minio_key,
        content_type=ct,
    )

    drive_file.size = len(file_data)
    if filename:
        drive_file.name = filename
    if content_type:
        drive_file.content_type = content_type
    # Reset AI processing flag so it gets re-indexed
    drive_file.ai_processed = False

    await db.flush()
    logger.info("Updated module file: DriveFile %s (%s bytes)", drive_file.id, len(file_data))
    return drive_file


# ── Permission check ─────────────────────────────────────────────────────────

async def check_module_access(
    db: AsyncSession,
    file: DriveFile,
    user: Any,
) -> dict[str, Any]:
    """Check if a user can access a module-sourced Drive file.

    Returns:
        {"allowed": True/False, "reason": str, "can_request_access": bool}
    """
    # File owner always has access
    if file.owner_id == user.id:
        return {"allowed": True, "reason": "owner", "can_request_access": False}

    # Super Admins always have access
    if getattr(user, "is_superadmin", False):
        return {"allowed": True, "reason": "superadmin", "can_request_access": False}

    # Native Drive files (no source_module) use standard Drive permissions
    if not file.source_module:
        return {"allowed": True, "reason": "native_drive", "can_request_access": False}

    # Check module-level RBAC (opt-out model: allowed unless explicitly blocked)
    from app.models.user import AppAccess

    result = await db.execute(
        select(AppAccess).where(
            AppAccess.user_id == user.id,
            AppAccess.app_name == file.source_module,
        )
    )
    access = result.scalar_one_or_none()

    # If access row exists and granted=False, block
    if access is not None and not access.granted:
        return {
            "allowed": False,
            "reason": f"No access to '{file.source_module}' module",
            "can_request_access": True,
        }

    # Check FileShare for explicit sharing
    from app.models.file_share import FileShare

    share_result = await db.execute(
        select(FileShare).where(
            FileShare.file_id == file.id,
            FileShare.shared_with_user_id == user.id,
        ).limit(1)
    )
    if share_result.scalar_one_or_none():
        return {"allowed": True, "reason": "shared", "can_request_access": False}

    # Default: allowed (module access not explicitly blocked, file is visible)
    return {"allowed": True, "reason": "module_access", "can_request_access": False}
