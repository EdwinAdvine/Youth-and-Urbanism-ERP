"""E-Commerce Import API — upload import files and track background import jobs."""
from __future__ import annotations

import io
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession
from app.models.ecommerce import ImportJob

router = APIRouter(tags=["E-Commerce Import"])


# ── Upload Import File ────────────────────────────────────────────────────────

@router.post("/import/upload", status_code=201)
async def upload_import_file(
    store_id: uuid.UUID,
    source_platform: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Upload an import file (CSV/JSON), save to MinIO, and create an ImportJob record.

    - store_id: target store UUID (query param)
    - source_platform: shopify | woocommerce | bigcommerce | csv
    - file: multipart upload
    """
    from app.integrations.minio_client import upload_file_from_bytes

    file_bytes = await file.read()
    job_id = uuid.uuid4()
    object_key = f"imports/{job_id}/{file.filename}"
    content_type = file.content_type or "application/octet-stream"

    # Upload to MinIO
    try:
        upload_file_from_bytes(
            data=file_bytes,
            object_name=object_key,
            content_type=content_type,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to upload file to storage: {exc}")

    # Create the ImportJob record
    job = ImportJob(
        id=job_id,
        store_id=store_id,
        source_platform=source_platform,
        status="pending",
        file_path=object_key,
        progress_pct=0,
        started_by=current_user.id,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    return {
        "job_id": str(job.id),
        "store_id": str(job.store_id),
        "source_platform": job.source_platform,
        "status": job.status,
        "file_path": job.file_path,
        "created_at": job.created_at.isoformat() if job.created_at else None,
    }


# ── Start Import Job ──────────────────────────────────────────────────────────

@router.post("/import/jobs/{job_id}/start")
async def start_import_job(
    job_id: uuid.UUID,
    data: dict = {},
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Kick off background import Celery task for a pending job."""
    result = await db.execute(select(ImportJob).where(ImportJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    if job.status not in ("pending", "failed"):
        raise HTTPException(
            status_code=400,
            detail=f"Job cannot be started in status '{job.status}'",
        )

    # Apply column mappings if provided
    if data.get("mappings"):
        job.mappings_json = data["mappings"]

    job.status = "running"
    job.progress_pct = 0
    await db.commit()

    # Dispatch Celery task
    try:
        from app.tasks.ecommerce_tasks import run_import_job
        run_import_job.delay(str(job_id))
    except Exception as exc:
        # Roll back status if task dispatch fails
        job.status = "failed"
        job.error_log = f"Task dispatch failed: {exc}"
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to dispatch import task: {exc}")

    return {"job_id": str(job.id), "status": job.status}


# ── List Import Jobs ──────────────────────────────────────────────────────────

@router.get("/import/jobs")
async def list_import_jobs(
    store_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
    status: str | None = None,
    skip: int = 0,
    limit: int = 50,
):
    """List import jobs for a store."""
    q = select(ImportJob).where(ImportJob.store_id == store_id)
    if status:
        q = q.where(ImportJob.status == status)
    q = q.order_by(ImportJob.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    jobs = result.scalars().all()
    return [
        {
            "id": str(j.id),
            "store_id": str(j.store_id),
            "source_platform": j.source_platform,
            "status": j.status,
            "progress_pct": j.progress_pct,
            "imported_products": j.imported_products,
            "imported_customers": j.imported_customers,
            "imported_orders": j.imported_orders,
            "file_path": j.file_path,
            "created_at": j.created_at.isoformat() if j.created_at else None,
        }
        for j in jobs
    ]


# ── Import Job Detail ─────────────────────────────────────────────────────────

@router.get("/import/jobs/{job_id}")
async def get_import_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    current_user=Depends(CurrentUser),
):
    """Get import job detail with progress."""
    result = await db.execute(select(ImportJob).where(ImportJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")

    return {
        "id": str(job.id),
        "store_id": str(job.store_id),
        "source_platform": job.source_platform,
        "status": job.status,
        "progress_pct": job.progress_pct,
        "file_path": job.file_path,
        "mappings": job.mappings_json,
        "imported_products": job.imported_products,
        "imported_customers": job.imported_customers,
        "imported_orders": job.imported_orders,
        "error_log": job.error_log,
        "created_at": job.created_at.isoformat() if job.created_at else None,
    }
