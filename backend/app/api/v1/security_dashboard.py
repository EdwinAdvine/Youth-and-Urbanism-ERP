"""Security dashboard — Super Admin only overview."""
from datetime import UTC, datetime, timedelta
from fastapi import APIRouter, Query
from sqlalchemy import func, select
from app.core.deps import SuperAdminUser, DBSession
from app.core.ip_filter import list_blocked_ips, block_ip, unblock_ip
from app.models.session import SecurityEvent, UserSession
from app.models.mfa import LoginAttempt
from app.models.user import User
from pydantic import BaseModel

router = APIRouter()

@router.get("/overview", summary="Security overview KPIs")
async def security_overview(current_user: SuperAdminUser, db: DBSession):
    now = datetime.now(UTC)
    last_24h = now - timedelta(hours=24)

    # Active sessions
    active_sessions_q = await db.execute(
        select(func.count()).select_from(UserSession).where(UserSession.revoked_at.is_(None))
    )
    active_sessions = active_sessions_q.scalar() or 0

    # Failed logins last 24h
    failed_logins_q = await db.execute(
        select(func.count()).select_from(LoginAttempt).where(
            LoginAttempt.success == False,
            LoginAttempt.attempted_at >= last_24h,
        )
    )
    failed_logins = failed_logins_q.scalar() or 0

    # Locked accounts
    locked_q = await db.execute(
        select(func.count()).select_from(User).where(
            User.locked_until > now,
        )
    )
    locked_accounts = locked_q.scalar() or 0

    # Unresolved security events
    events_q = await db.execute(
        select(func.count()).select_from(SecurityEvent).where(SecurityEvent.resolved == False)
    )
    unresolved_events = events_q.scalar() or 0

    # Total users / users with MFA
    total_users_q = await db.execute(select(func.count()).select_from(User).where(User.is_active == True))
    total_users = total_users_q.scalar() or 0

    return {
        "active_sessions": active_sessions,
        "failed_logins_24h": failed_logins,
        "locked_accounts": locked_accounts,
        "unresolved_security_events": unresolved_events,
        "total_active_users": total_users,
    }

@router.get("/events", summary="Security events (paginated)")
async def list_security_events(
    current_user: SuperAdminUser,
    db: DBSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    severity: str | None = Query(None),
    resolved: bool | None = Query(None),
):
    q = select(SecurityEvent).order_by(SecurityEvent.created_at.desc()).offset(skip).limit(limit)
    if severity:
        q = q.where(SecurityEvent.severity == severity)
    if resolved is not None:
        q = q.where(SecurityEvent.resolved == resolved)
    result = await db.execute(q)
    events = result.scalars().all()
    return [
        {
            "id": str(e.id),
            "event_type": e.event_type,
            "severity": e.severity,
            "user_id": str(e.user_id) if e.user_id else None,
            "ip_address": e.ip_address,
            "details": e.details,
            "resolved": e.resolved,
            "created_at": e.created_at.isoformat(),
        }
        for e in events
    ]

@router.post("/events/{event_id}/resolve", summary="Resolve a security event")
async def resolve_event(event_id: str, current_user: SuperAdminUser, db: DBSession):
    from sqlalchemy import update
    import uuid as _uuid
    await db.execute(
        update(SecurityEvent).where(SecurityEvent.id == _uuid.UUID(event_id)).values(
            resolved=True,
            resolved_by=current_user.id,
            resolved_at=datetime.now(UTC),
        )
    )
    await db.commit()
    return {"status": "resolved"}

@router.get("/login-activity", summary="Login activity for heatmap")
async def login_activity(current_user: SuperAdminUser, db: DBSession, days: int = Query(7, ge=1, le=30)):
    since = datetime.now(UTC) - timedelta(days=days)
    result = await db.execute(
        select(
            func.date_trunc("hour", LoginAttempt.attempted_at).label("hour"),
            func.count().label("total"),
            func.sum(func.cast(LoginAttempt.success, func.Integer() if False else LoginAttempt.success.__class__)).label("successes"),
        ).where(LoginAttempt.attempted_at >= since)
        .group_by("hour").order_by("hour")
    )
    rows = result.all()
    return [{"hour": str(r.hour), "total": r.total, "successes": int(r.successes or 0)} for r in rows]

@router.get("/ip-blocklist", summary="List blocked IPs")
async def get_ip_blocklist(current_user: SuperAdminUser):
    return {"blocked_ips": await list_blocked_ips()}

@router.post("/ip-blocklist", summary="Block an IP", status_code=201)
async def add_to_blocklist(current_user: SuperAdminUser, ip: str, ttl_hours: int = 24):
    await block_ip(ip, ttl_seconds=ttl_hours * 3600)
    return {"status": "blocked", "ip": ip}

@router.delete("/ip-blocklist/{ip}", summary="Unblock an IP")
async def remove_from_blocklist(ip: str, current_user: SuperAdminUser):
    await unblock_ip(ip)
    return {"status": "unblocked", "ip": ip}

@router.post("/lockdown", summary="Emergency lockdown — revoke all non-admin sessions")
async def emergency_lockdown(current_user: SuperAdminUser, db: DBSession):
    from sqlalchemy import update
    # Revoke all sessions for non-superadmin users
    from app.models.session import UserSession
    result = await db.execute(
        select(UserSession).join(User, UserSession.user_id == User.id).where(
            User.is_superadmin == False,
            UserSession.revoked_at.is_(None),
        )
    )
    sessions = result.scalars().all()
    now = datetime.now(UTC)
    from app.core.security import revoke_token_jti
    for s in sessions:
        s.revoked_at = now
        await revoke_token_jti(s.token_jti, ttl_seconds=86400 * 30)
    await db.commit()
    return {"status": "lockdown", "sessions_revoked": len(sessions)}
