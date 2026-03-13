"""Celery security tasks — threat detection, automated responses, retention."""
from __future__ import annotations
from celery import shared_task
from datetime import UTC, datetime, timedelta

@shared_task(name="tasks.detect_brute_force")
def detect_brute_force():
    """Detect IPs with > 10 failed logins in the last 5 minutes and auto-block them."""
    import asyncio
    from sqlalchemy import func, select, text
    from app.core.database import AsyncSessionLocal
    from app.core.ip_filter import block_ip
    from app.models.mfa import LoginAttempt

    async def _run():
        async with AsyncSessionLocal() as db:
            window_start = datetime.now(UTC) - timedelta(minutes=5)
            result = await db.execute(
                select(LoginAttempt.ip_address, func.count().label("cnt"))
                .where(
                    LoginAttempt.success == False,
                    LoginAttempt.attempted_at >= window_start,
                    LoginAttempt.ip_address.is_not(None),
                )
                .group_by(LoginAttempt.ip_address)
                .having(func.count() > 10)
            )
            bad_ips = result.all()
            for row in bad_ips:
                await block_ip(row.ip_address, ttl_seconds=3600)  # 1 hour block
                # Create security event
                from app.models.session import SecurityEvent
                event = SecurityEvent(
                    event_type="brute_force.detected",
                    severity="high",
                    ip_address=row.ip_address,
                    details={"failed_attempts": row.cnt, "window_minutes": 5},
                )
                db.add(event)
            await db.commit()

    asyncio.run(_run())

@shared_task(name="tasks.cleanup_login_attempts")
def cleanup_login_attempts():
    """Delete login_attempts older than 90 days."""
    import asyncio
    from sqlalchemy import delete
    from app.core.database import AsyncSessionLocal
    from app.models.mfa import LoginAttempt

    async def _run():
        async with AsyncSessionLocal() as db:
            cutoff = datetime.now(UTC) - timedelta(days=90)
            await db.execute(delete(LoginAttempt).where(LoginAttempt.attempted_at < cutoff))
            await db.commit()

    asyncio.run(_run())

@shared_task(name="tasks.cleanup_revoked_sessions")
def cleanup_revoked_sessions():
    """Delete sessions revoked more than 30 days ago."""
    import asyncio
    from sqlalchemy import delete
    from app.core.database import AsyncSessionLocal
    from app.models.session import UserSession

    async def _run():
        async with AsyncSessionLocal() as db:
            cutoff = datetime.now(UTC) - timedelta(days=30)
            await db.execute(
                delete(UserSession).where(UserSession.revoked_at < cutoff)
            )
            await db.commit()

    asyncio.run(_run())

@shared_task(name="tasks.cleanup_security_events")
def cleanup_security_events():
    """Delete resolved security events older than 180 days."""
    import asyncio
    from sqlalchemy import delete
    from app.core.database import AsyncSessionLocal
    from app.models.session import SecurityEvent

    async def _run():
        async with AsyncSessionLocal() as db:
            cutoff = datetime.now(UTC) - timedelta(days=180)
            await db.execute(
                delete(SecurityEvent).where(
                    SecurityEvent.resolved == True,
                    SecurityEvent.created_at < cutoff,
                )
            )
            await db.commit()

    asyncio.run(_run())


@shared_task(name="tasks.enforce_data_retention")
def enforce_data_retention() -> dict:
    """Enforce data retention policies by purging old records.

    Retention:
    - audit_log entries older than 365 days: anonymize (null user_id/ip)
    - login_attempts older than 90 days: delete
    - security_events (resolved) older than 180 days: delete  (already done by cleanup_security_events)
    - deactivated accounts marked for deletion older than 30 days: delete
    """
    import asyncio  # noqa: PLC0415
    from datetime import datetime, timezone, timedelta  # noqa: PLC0415
    from sqlalchemy import text, update, delete  # noqa: PLC0415
    from app.core.database import AsyncSessionLocal  # noqa: PLC0415

    async def _run() -> dict:
        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            counts = {}

            # 1. Anonymize old universal_audit_log entries (keep record, remove PII)
            cutoff_audit = now - timedelta(days=365)
            result = await db.execute(
                text(
                    "UPDATE universal_audit_log SET user_id = NULL, ip_address = NULL "
                    "WHERE timestamp < :cutoff AND user_id IS NOT NULL"
                ),
                {"cutoff": cutoff_audit},
            )
            counts["audit_log_anonymized"] = result.rowcount

            # 2. Delete old login_attempts
            cutoff_attempts = now - timedelta(days=90)
            result = await db.execute(
                text("DELETE FROM login_attempts WHERE attempted_at < :cutoff"),
                {"cutoff": cutoff_attempts},
            )
            counts["login_attempts_deleted"] = result.rowcount

            # 3. Delete deactivated accounts marked for deletion (is_active=False, updated_at >30 days ago)
            cutoff_accounts = now - timedelta(days=30)
            result = await db.execute(
                text(
                    "DELETE FROM users WHERE is_active = false "
                    "AND updated_at < :cutoff AND is_superadmin = false"
                ),
                {"cutoff": cutoff_accounts},
            )
            counts["accounts_purged"] = result.rowcount

            await db.commit()
            return counts

    return asyncio.get_event_loop().run_until_complete(_run())
