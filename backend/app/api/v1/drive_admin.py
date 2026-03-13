"""Drive Admin endpoints: user storage breakdown, content types, auto-backup rules,
guest users management, anomaly alerts, per-user quota enforcement, ONLYOFFICE comment sync."""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select, update

from app.core.deps import CurrentUser, DBSession, SuperAdminUser
from app.models.drive import DriveFile, DriveFolder, FileAccessLog
from app.models.drive_phase3 import (
    AutoBackupRule,
    DriveAnomalyAlert,
    DriveContentType,
    DriveContentTypeFolder,
    DriveGuestUser,
    DriveStorageTier,
    DriveUserBehavior,
)
from app.models.file_share import FileShare

logger = logging.getLogger(__name__)
router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN: PER-USER STORAGE BREAKDOWN
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/admin/drive/users-storage", summary="Per-user storage breakdown (Admin)")
async def get_users_storage(
    db: DBSession,
    _admin: SuperAdminUser,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    """Return storage usage breakdown per user, sorted by total size descending."""
    from app.models.user import User

    # Aggregate storage per user
    query = (
        select(
            DriveFile.owner_id,
            func.count(DriveFile.id).label("file_count"),
            func.sum(DriveFile.size).label("total_size"),
            func.max(DriveFile.created_at).label("last_upload"),
        )
        .group_by(DriveFile.owner_id)
        .order_by(func.sum(DriveFile.size).desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    rows = result.all()

    # Enrich with user info
    users_data = []
    for owner_id, file_count, total_size, last_upload in rows:
        user = await db.get(User, owner_id)
        users_data.append({
            "user_id": str(owner_id),
            "email": user.email if user else "Unknown",
            "full_name": user.full_name if user else "Unknown",
            "file_count": file_count or 0,
            "total_size": total_size or 0,
            "last_upload": last_upload.isoformat() if last_upload else None,
        })

    # Total count
    count_result = await db.execute(
        select(func.count(func.distinct(DriveFile.owner_id)))
    )
    total = count_result.scalar_one()

    return {"users": users_data, "total": total, "limit": limit, "offset": offset}


# ══════════════════════════════════════════════════════════════════════════════
# CONTENT TYPES
# ══════════════════════════════════════════════════════════════════════════════


class ContentTypeCreate(BaseModel):
    name: str
    description: str | None = None
    required_fields: list[dict] = []
    allowed_mime_types: list[str] | None = None
    icon: str | None = None
    color: str | None = None


@router.post("/admin/drive/content-types", status_code=status.HTTP_201_CREATED,
             summary="Create a Drive content type (Admin)")
async def create_content_type(
    body: ContentTypeCreate,
    db: DBSession,
    user: CurrentUser,
) -> dict[str, Any]:
    ct = DriveContentType(
        name=body.name,
        description=body.description,
        required_fields=body.required_fields,
        allowed_mime_types=body.allowed_mime_types,
        icon=body.icon,
        color=body.color,
        created_by=user.id,
    )
    db.add(ct)
    await db.commit()
    await db.refresh(ct)
    return {"id": str(ct.id), "name": ct.name, "required_fields": ct.required_fields}


@router.get("/admin/drive/content-types", summary="List Drive content types")
async def list_content_types(
    db: DBSession,
    _user: CurrentUser,
) -> dict[str, Any]:
    result = await db.execute(select(DriveContentType).order_by(DriveContentType.name))
    cts = result.scalars().all()
    return {
        "content_types": [
            {
                "id": str(ct.id),
                "name": ct.name,
                "description": ct.description,
                "required_fields": ct.required_fields,
                "allowed_mime_types": ct.allowed_mime_types,
                "icon": ct.icon,
                "color": ct.color,
                "is_system": ct.is_system,
            }
            for ct in cts
        ]
    }


@router.put("/admin/drive/content-types/{ct_id}/assign/{folder_id}",
            summary="Assign content type to folder")
async def assign_content_type_to_folder(
    ct_id: uuid.UUID,
    folder_id: uuid.UUID,
    db: DBSession,
    user: CurrentUser,
    enforce: bool = Query(True),
) -> dict[str, Any]:
    ct = await db.get(DriveContentType, ct_id)
    if not ct:
        raise HTTPException(status_code=404, detail="Content type not found")
    folder = await db.get(DriveFolder, folder_id)
    if not folder or folder.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Folder not found")

    # Upsert assignment
    existing = await db.execute(
        select(DriveContentTypeFolder).where(
            DriveContentTypeFolder.content_type_id == ct_id,
            DriveContentTypeFolder.folder_id == folder_id,
        )
    )
    assignment = existing.scalar_one_or_none()
    if assignment:
        assignment.enforce_on_upload = enforce
    else:
        assignment = DriveContentTypeFolder(
            content_type_id=ct_id,
            folder_id=folder_id,
            enforce_on_upload=enforce,
        )
        db.add(assignment)

    await db.commit()
    return {"content_type_id": str(ct_id), "folder_id": str(folder_id), "enforce_on_upload": enforce}


@router.delete("/admin/drive/content-types/{ct_id}", summary="Delete content type (Admin)")
async def delete_content_type(
    ct_id: uuid.UUID,
    db: DBSession,
    _admin: SuperAdminUser,
) -> dict[str, Any]:
    ct = await db.get(DriveContentType, ct_id)
    if not ct:
        raise HTTPException(status_code=404, detail="Content type not found")
    if ct.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete system content types")
    await db.delete(ct)
    await db.commit()
    return {"deleted": True, "id": str(ct_id)}


# ══════════════════════════════════════════════════════════════════════════════
# AUTO-BACKUP RULES
# ══════════════════════════════════════════════════════════════════════════════


class AutoBackupRuleCreate(BaseModel):
    name: str
    folder_id: uuid.UUID
    schedule_cron: str = "0 2 * * *"
    destination: str = "minio_backup"
    retention_count: int = 7


@router.post("/drive/backup-rules", status_code=status.HTTP_201_CREATED,
             summary="Create auto-backup rule for a folder")
async def create_backup_rule(
    body: AutoBackupRuleCreate,
    db: DBSession,
    user: CurrentUser,
) -> dict[str, Any]:
    folder = await db.get(DriveFolder, body.folder_id)
    if not folder or folder.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Folder not found")

    rule = AutoBackupRule(
        name=body.name,
        folder_id=body.folder_id,
        created_by=user.id,
        schedule_cron=body.schedule_cron,
        destination=body.destination,
        retention_count=body.retention_count,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return {
        "id": str(rule.id),
        "name": rule.name,
        "folder_id": str(rule.folder_id),
        "schedule_cron": rule.schedule_cron,
        "next_run_at": rule.next_run_at.isoformat() if rule.next_run_at else None,
    }


@router.get("/drive/backup-rules", summary="List auto-backup rules for current user")
async def list_backup_rules(
    db: DBSession,
    user: CurrentUser,
) -> dict[str, Any]:
    result = await db.execute(
        select(AutoBackupRule).where(AutoBackupRule.created_by == user.id).order_by(AutoBackupRule.created_at.desc())
    )
    rules = result.scalars().all()
    return {
        "rules": [
            {
                "id": str(r.id),
                "name": r.name,
                "folder_id": str(r.folder_id),
                "schedule_cron": r.schedule_cron,
                "destination": r.destination,
                "retention_count": r.retention_count,
                "is_active": r.is_active,
                "last_run_at": r.last_run_at.isoformat() if r.last_run_at else None,
                "last_run_status": r.last_run_status,
                "last_run_files": r.last_run_files,
            }
            for r in rules
        ]
    }


@router.delete("/drive/backup-rules/{rule_id}", summary="Delete auto-backup rule")
async def delete_backup_rule(
    rule_id: uuid.UUID,
    db: DBSession,
    user: CurrentUser,
) -> dict[str, Any]:
    rule = await db.get(AutoBackupRule, rule_id)
    if not rule or rule.created_by != user.id:
        raise HTTPException(status_code=404, detail="Backup rule not found")
    await db.delete(rule)
    await db.commit()
    return {"deleted": True}


# ══════════════════════════════════════════════════════════════════════════════
# GUEST USERS (TRACKED EXTERNAL COLLABORATORS)
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/sharing/guests", summary="List guest users who accessed your shares")
async def list_guest_users(
    db: DBSession,
    user: CurrentUser,
) -> dict[str, Any]:
    # Find shares owned by user
    shares_result = await db.execute(
        select(FileShare).where(FileShare.shared_by_user_id == user.id)
    )
    share_ids = [s.id for s in shares_result.scalars().all()]

    if not share_ids:
        return {"guests": []}

    result = await db.execute(
        select(DriveGuestUser)
        .where(DriveGuestUser.share_id.in_(share_ids))
        .order_by(DriveGuestUser.last_accessed_at.desc().nullslast())
    )
    guests = result.scalars().all()
    return {
        "guests": [
            {
                "id": str(g.id),
                "name": g.name,
                "email": g.email,
                "share_id": str(g.share_id),
                "access_count": g.access_count,
                "last_accessed_at": g.last_accessed_at.isoformat() if g.last_accessed_at else None,
                "expires_at": g.expires_at.isoformat() if g.expires_at else None,
                "is_active": g.is_active,
            }
            for g in guests
        ]
    }


@router.delete("/sharing/guests/{guest_id}", summary="Revoke guest access")
async def revoke_guest(
    guest_id: uuid.UUID,
    db: DBSession,
    user: CurrentUser,
) -> dict[str, Any]:
    guest = await db.get(DriveGuestUser, guest_id)
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    if guest.invited_by != user.id:
        raise HTTPException(status_code=403, detail="Not your guest")
    guest.is_active = False
    await db.commit()
    return {"revoked": True}


# ══════════════════════════════════════════════════════════════════════════════
# ANOMALY ALERTS (ADMIN)
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/admin/drive/anomaly-alerts", summary="List behavioral anomaly alerts (Admin)")
async def list_anomaly_alerts(
    db: DBSession,
    _admin: SuperAdminUser,
    days: int = Query(30, le=90),
    unresolved_only: bool = Query(False),
) -> dict[str, Any]:
    from app.models.user import User

    since = datetime.now(timezone.utc) - timedelta(days=days)
    query = select(DriveAnomalyAlert).where(DriveAnomalyAlert.detected_at >= since)
    if unresolved_only:
        query = query.where(DriveAnomalyAlert.is_resolved == False)  # noqa: E712
    query = query.order_by(DriveAnomalyAlert.detected_at.desc()).limit(200)

    result = await db.execute(query)
    alerts = result.scalars().all()

    enriched = []
    for alert in alerts:
        user = await db.get(User, alert.user_id)
        enriched.append({
            "id": str(alert.id),
            "user_id": str(alert.user_id),
            "user_email": user.email if user else "Unknown",
            "alert_type": alert.alert_type,
            "severity": alert.severity,
            "details": alert.details,
            "is_resolved": alert.is_resolved,
            "detected_at": alert.detected_at.isoformat(),
        })
    return {"alerts": enriched, "total": len(enriched)}


@router.post("/admin/drive/anomaly-alerts/{alert_id}/resolve",
             summary="Resolve an anomaly alert (Admin)")
async def resolve_anomaly_alert(
    alert_id: uuid.UUID,
    db: DBSession,
    user: SuperAdminUser,
) -> dict[str, Any]:
    alert = await db.get(DriveAnomalyAlert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_resolved = True
    alert.resolved_by = user.id
    await db.commit()
    return {"resolved": True}


# ══════════════════════════════════════════════════════════════════════════════
# STORAGE TIER MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════


@router.post("/files/{file_id}/tier", summary="Manually change storage tier for a file")
async def set_file_tier(
    file_id: uuid.UUID,
    db: DBSession,
    user: CurrentUser,
    tier: str = Query(..., description="Target tier: hot, warm, cold, archived"),
) -> dict[str, Any]:
    valid_tiers = {"hot", "warm", "cold", "archived"}
    if tier not in valid_tiers:
        raise HTTPException(status_code=400, detail=f"Invalid tier. Must be one of: {valid_tiers}")

    file = await db.get(DriveFile, file_id)
    if not file or file.owner_id != user.id:
        raise HTTPException(status_code=404, detail="File not found")

    # Upsert tier record
    result = await db.execute(
        select(DriveStorageTier).where(DriveStorageTier.file_id == file_id)
    )
    tier_record = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if tier_record:
        tier_record.tier = tier
        tier_record.tiered_at = now
        tier_record.tiered_by = "manual"
        if tier == "hot":
            tier_record.restore_completed_at = now
    else:
        tier_record = DriveStorageTier(
            file_id=file_id,
            tier=tier,
            tiered_at=now,
            tiered_by="manual",
        )
        db.add(tier_record)

    await db.commit()
    return {"file_id": str(file_id), "tier": tier, "tiered_at": now.isoformat()}


@router.get("/files/{file_id}/tier", summary="Get storage tier info for a file")
async def get_file_tier(
    file_id: uuid.UUID,
    db: DBSession,
    user: CurrentUser,
) -> dict[str, Any]:
    file = await db.get(DriveFile, file_id)
    if not file or file.owner_id != user.id:
        raise HTTPException(status_code=404, detail="File not found")

    result = await db.execute(
        select(DriveStorageTier).where(DriveStorageTier.file_id == file_id)
    )
    tier_record = result.scalar_one_or_none()

    return {
        "file_id": str(file_id),
        "tier": tier_record.tier if tier_record else "hot",
        "tiered_at": tier_record.tiered_at.isoformat() if tier_record and tier_record.tiered_at else None,
        "tiered_by": tier_record.tiered_by if tier_record else None,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ONLYOFFICE COMMENT SYNC CALLBACK
# ══════════════════════════════════════════════════════════════════════════════


class OnlyOfficeComment(BaseModel):
    file_id: str
    user_id: str | None = None
    user_name: str | None = None
    message: str
    quote: str | None = None
    time: str | None = None


@router.post("/files/onlyoffice/comment-sync", summary="Sync ONLYOFFICE inline comment to Drive FileComment")
async def sync_onlyoffice_comment(
    body: OnlyOfficeComment,
    request: Request,
    db: DBSession,
) -> dict[str, Any]:
    """Called by ONLYOFFICE Document Server callback to sync inline comments."""
    from app.models.drive import FileComment

    try:
        file_id = uuid.UUID(body.file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_id")

    file = await db.get(DriveFile, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Build comment content with quote context
    content = body.message
    if body.quote:
        content = f'> "{body.quote}"\n\n{body.message}'

    comment = FileComment(
        file_id=file_id,
        user_id=file.owner_id,  # attribute to file owner if no user_id
        content=f"[ONLYOFFICE] {content}",
    )
    if body.user_id:
        try:
            comment.user_id = uuid.UUID(body.user_id)
        except ValueError:
            pass

    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return {"synced": True, "comment_id": str(comment.id)}
