"""Backup management API — Super Admin only."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.core.deps import SuperAdminUser
from app.services.backup import BackupService

router = APIRouter()


@router.get("", summary="List all backups")
async def list_backups(current_user: SuperAdminUser):
    """Return a list of all database backups stored in MinIO."""
    svc = BackupService()
    return {"backups": svc.list_backups()}


@router.post("", summary="Trigger manual backup", status_code=status.HTTP_201_CREATED)
async def create_backup(current_user: SuperAdminUser):
    """Run pg_dump and upload a gzipped backup to MinIO."""
    svc = BackupService()
    try:
        result = svc.create_db_backup()
        return result
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.delete("/{filename}", summary="Delete a backup")
async def delete_backup(filename: str, current_user: SuperAdminUser):
    """Delete a specific backup file from MinIO."""
    svc = BackupService()
    success = svc.delete_backup(filename)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Backup '{filename}' not found or could not be deleted",
        )
    return {"status": "deleted", "filename": filename}
