"""Backup management API — Super Admin only.

Endpoints:
    GET  /backups              — list pg_dump backups (single-node)
    POST /backups              — trigger pg_dump backup (single-node)
    DELETE /backups/{filename} — delete a pg_dump backup

    # pgBackRest / HA mode endpoints:
    GET  /backups/status       — backup health (age, last result, WAL lag)
    GET  /backups/pitr-info    — available PITR window from pgBackRest
    POST /backups/verify       — trigger pgBackRest verify
    POST /backups/pitr-restore — trigger PITR restore to a timestamp (caution!)
"""


import json
import subprocess
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, status
from pydantic import BaseModel

from app.core.deps import SuperAdminUser
from app.core.rate_limit import limiter
from app.services.backup import BackupService

router = APIRouter()


# ── pgBackRest helpers ────────────────────────────────────────────────────────

def _pgbackrest_info() -> dict:
    """Run pgbackrest info --output=json and return parsed output."""
    try:
        result = subprocess.run(
            ["pgbackrest", "--stanza=urban-vibes-dynamics", "--output=json", "info"],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return {"available": True, "info": data}
    except (FileNotFoundError, subprocess.TimeoutExpired, json.JSONDecodeError):
        pass
    return {"available": False, "info": []}


# ── pgBackRest status endpoint ────────────────────────────────────────────────

@router.get("/status", summary="Backup health status")
async def backup_status(current_user: SuperAdminUser):
    """Return backup health: age of last backup, WAL archiving status, pgBackRest info."""
    info = _pgbackrest_info()
    if not info["available"]:
        return {
            "mode": "pg_dump",
            "pgbackrest_available": False,
            "message": "pgBackRest not available — running in single-node pg_dump mode.",
        }

    stanzas = info["info"]
    status_data = {
        "mode": "pgbackrest",
        "pgbackrest_available": True,
        "stanzas": stanzas,
    }

    # Extract last backup timestamp from the first stanza
    if stanzas and stanzas[0].get("backup"):
        last_backup = stanzas[0]["backup"][-1]
        stop_ts = last_backup.get("timestamp", {}).get("stop", 0)
        if stop_ts:
            age_s = int(datetime.utcnow().timestamp()) - stop_ts
            status_data["last_backup_age_seconds"] = age_s
            status_data["last_backup_type"] = last_backup.get("type", "unknown")

    return status_data


# ── PITR info endpoint ────────────────────────────────────────────────────────

@router.get("/pitr-info", summary="Available PITR recovery window")
async def pitr_info(current_user: SuperAdminUser):
    """Return the earliest and latest timestamps available for Point-in-Time Recovery."""
    info = _pgbackrest_info()
    if not info["available"] or not info["info"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="pgBackRest not available or no backups found.",
        )

    stanza = info["info"][0]
    backups = stanza.get("backup", [])
    if not backups:
        return {"earliest": None, "latest": None, "backup_count": 0}

    earliest_ts = backups[0].get("timestamp", {}).get("start", 0)
    latest_ts = backups[-1].get("timestamp", {}).get("stop", 0)

    return {
        "earliest": datetime.utcfromtimestamp(earliest_ts).isoformat() + "Z" if earliest_ts else None,
        "latest": datetime.utcfromtimestamp(latest_ts).isoformat() + "Z" if latest_ts else None,
        "backup_count": len(backups),
        "archive_available": bool(stanza.get("archive")),
    }


# ── Manual verify endpoint ────────────────────────────────────────────────────

@router.post("/verify", summary="Trigger pgBackRest backup verification")
@limiter.limit("3/hour")
async def verify_backup(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: SuperAdminUser,
):
    """Trigger a pgBackRest verify run in the background."""
    from app.tasks.celery_app import pgbackrest_verify  # noqa: PLC0415

    task = pgbackrest_verify.delay()
    return {"status": "queued", "task_id": task.id, "message": "Verify task queued — check Celery logs for results."}


# ── PITR restore endpoint ─────────────────────────────────────────────────────

class PITRRestoreRequest(BaseModel):
    target_time: str  # ISO 8601 timestamp, e.g. "2026-03-12T14:30:00Z"
    confirm: bool = False


@router.post("/pitr-restore", summary="Trigger Point-in-Time Recovery")
@limiter.limit("1/hour")
async def pitr_restore(
    request: Request,
    body: PITRRestoreRequest,
    current_user: SuperAdminUser,
):
    """Initiate a PITR restore. DANGEROUS — stops all services and restores the DB.

    This endpoint queues a Celery task that:
    1. Stops backend and Celery workers.
    2. Runs pgBackRest restore to the given timestamp.
    3. Restarts services.

    You MUST set confirm=true in the request body to proceed.
    """
    if not body.confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Set confirm=true to acknowledge that this will destroy the current database state.",
        )

    # Validate timestamp format
    try:
        target_dt = datetime.fromisoformat(body.target_time.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid target_time format. Use ISO 8601, e.g. '2026-03-12T14:30:00Z'.",
        )

    # Queue PITR restore as a Celery task
    from app.tasks.celery_app import celery_app  # noqa: PLC0415

    task = celery_app.send_task(
        "tasks.pgbackrest_pitr_restore",
        kwargs={"target_time": body.target_time},
    )

    return {
        "status": "queued",
        "task_id": task.id,
        "target_time": target_dt.isoformat(),
        "warning": "PITR restore will cause database downtime. Monitor Celery logs for progress.",
    }


@router.get("", summary="List all backups")
async def list_backups(current_user: SuperAdminUser):
    """Return a list of all database backups stored in MinIO."""
    svc = BackupService()
    return {"backups": svc.list_backups()}


@router.post("", summary="Trigger manual backup", status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
async def create_backup(request: Request, current_user: SuperAdminUser):
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
