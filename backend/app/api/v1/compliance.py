"""GDPR compliance — data export and deletion requests."""
import json
from datetime import UTC, datetime
from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from sqlalchemy import select, text
from app.core.audit import log_audit
from app.core.deps import CurrentUser, DBSession, SuperAdminUser
from app.models.user import User
from fastapi import Request

router = APIRouter()

@router.get("/me/data-export", summary="Export all my personal data")
async def export_my_data(current_user: CurrentUser, db: DBSession):
    """Return a JSON bundle of all data associated with the current user."""
    user_data = {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "created_at": current_user.created_at.isoformat() if hasattr(current_user, "created_at") and current_user.created_at else None,
        "last_login": current_user.last_login.isoformat() if current_user.last_login else None,
    }
    # Export audit log entries for this user
    audit_result = await db.execute(
        text("SELECT action, resource_type, resource_id, metadata, created_at FROM audit_logs WHERE user_id = :uid ORDER BY created_at DESC LIMIT 1000"),
        {"uid": str(current_user.id)},
    )
    audit_rows = audit_result.fetchall()
    return {
        "exported_at": datetime.now(UTC).isoformat(),
        "user": user_data,
        "audit_log": [
            {"action": r[0], "resource_type": r[1], "resource_id": r[2], "metadata": r[3], "created_at": str(r[4])}
            for r in audit_rows
        ],
    }

@router.delete("/me/account", status_code=status.HTTP_200_OK, summary="Request account deletion")
async def request_account_deletion(request: Request, current_user: CurrentUser, db: DBSession, background_tasks: BackgroundTasks):
    """Schedule account deletion. Superadmins cannot self-delete."""
    if current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Super admin accounts cannot be self-deleted")
    # Deactivate immediately, flag for cleanup
    current_user.is_active = False
    await db.commit()
    await log_audit(db, current_user, "user.deletion_requested",
                    resource_type="user", resource_id=str(current_user.id), request=request)
    return {"status": "scheduled", "message": "Account deactivated. Data will be purged within 30 days."}

@router.get("/data-retention", summary="View data retention policies (Super Admin)")
async def get_retention_policies(_: SuperAdminUser):
    return {
        "policies": [
            {"table": "audit_logs", "retention_days": 365, "description": "Audit log entries"},
            {"table": "login_attempts", "retention_days": 90, "description": "Login attempt records"},
            {"table": "security_events", "retention_days": 180, "description": "Security event records"},
        ]
    }
