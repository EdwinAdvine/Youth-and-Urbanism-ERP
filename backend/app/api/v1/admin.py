
import uuid
from datetime import UTC, datetime
from typing import Any

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_audit
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import SuperAdminUser
from app.core.rbac import get_user_app_scopes
from app.models.ai import AIAuditLog
from app.models.user import AppAdmin, User
from app.schemas.ai import AIAuditLogResponse, AIConfigResponse, AIConfigUpdate
from app.schemas.user import (
    AppAccessBulkUpdate,
    AppAccessEntry,
    AppAdminCreate,
    AppAdminResponse,
    AuditLogResponse,
    UserCreate,
    UserMeResponse,
    UserResponse,
    UserUpdate,
)
from app.services.ai import AIService
from app.services.user import UserService

router = APIRouter()


# ── Dashboard stats ───────────────────────────────────────────────────────────
@router.get("/stats", summary="Super Admin overview statistics")
async def get_stats(
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    total_users_res = await db.execute(select(func.count()).select_from(User))
    total_users: int = total_users_res.scalar_one()

    active_users_res = await db.execute(
        select(func.count()).select_from(User).where(User.is_active.is_(True))
    )
    active_users: int = active_users_res.scalar_one()

    superadmin_count_res = await db.execute(
        select(func.count()).select_from(User).where(User.is_superadmin.is_(True))
    )
    superadmin_count: int = superadmin_count_res.scalar_one()

    app_admins_res = await db.execute(select(func.count()).select_from(AppAdmin))
    app_admins_count: int = app_admins_res.scalar_one()

    # Active Redis sessions (refresh tokens)
    active_sessions = 0
    try:
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        try:
            keys = await r.keys("refresh:*")
            active_sessions = len(keys)
        finally:
            await r.aclose()
    except Exception:
        active_sessions = -1  # Redis unavailable

    # AI config info
    ai_config = await AIService(db).get_active_config()

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "superadmins": superadmin_count,
            "app_admins": app_admins_count,
        },
        "sessions": {
            "active_refresh_tokens": active_sessions,
        },
        "ai": {
            "provider": ai_config.provider if ai_config else settings.AI_PROVIDER,
            "model": ai_config.model_name if ai_config else "gpt-4o",
            "config_active": ai_config.is_active if ai_config else False,
        },
        "timestamp": datetime.now(UTC).isoformat(),
    }


# ── Users (admin-scoped CRUD) ─────────────────────────────────────────────────


async def _enrich_user(db: AsyncSession, user: object) -> UserMeResponse:
    """Add computed role and app_admin_scopes to a UserResponse."""
    base = UserResponse.model_validate(user)
    scopes = await get_user_app_scopes(db, str(base.id))
    role = "superadmin" if base.is_superadmin else ("admin" if scopes else "user")
    data = base.model_dump()
    data["role"] = role
    data["app_admin_scopes"] = scopes if role in ("admin", "superadmin") else []
    data.setdefault("app_access", [])
    data.setdefault("permissions", [])
    return UserMeResponse(**data)


@router.get("/users", summary="List users (paginated)")
async def admin_list_users(
    _: SuperAdminUser,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=200),
    search: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    query = select(User)
    count_query = select(func.count()).select_from(User)

    if search:
        pattern = f"%{search}%"
        filt = or_(User.email.ilike(pattern), User.full_name.ilike(pattern))
        query = query.where(filt)
        count_query = count_query.where(filt)

    total_res = await db.execute(count_query)
    total: int = total_res.scalar_one()

    offset = (page - 1) * per_page
    result = await db.execute(
        query.order_by(User.created_at.desc()).offset(offset).limit(per_page)
    )
    users = list(result.scalars().all())
    enriched = [await _enrich_user(db, u) for u in users]

    return {
        "items": [u.model_dump() for u in enriched],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.post(
    "/users",
    status_code=status.HTTP_201_CREATED,
    summary="Create user (admin)",
)
async def admin_create_user(
    request: Request,
    payload: UserCreate,
    current_user: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await UserService(db).create_user(payload)
    await log_audit(
        db, current_user, "user.created",
        resource_type="user", resource_id=str(user.id),
        metadata={"email": user.email, "full_name": user.full_name},
        request=request,
    )
    enriched = await _enrich_user(db, user)
    return enriched.model_dump()


@router.patch(
    "/users/{user_id}",
    summary="Update user (admin, partial)",
)
async def admin_update_user(
    request: Request,
    user_id: uuid.UUID,
    payload: UserUpdate,
    current_user: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await UserService(db).update_user(user_id, payload)
    await log_audit(
        db, current_user, "user.updated",
        resource_type="user", resource_id=str(user_id),
        metadata={"changes": payload.model_dump(exclude_unset=True, exclude={"password"})},
        request=request,
    )
    enriched = await _enrich_user(db, user)
    return enriched.model_dump()


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete user (admin)",
)
async def admin_delete_user(
    request: Request,
    user_id: uuid.UUID,
    current_user: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    await UserService(db).delete_user(user_id)
    await log_audit(
        db, current_user, "user.deleted",
        resource_type="user", resource_id=str(user_id),
        request=request,
    )


# ── App Admins ────────────────────────────────────────────────────────────────
@router.get("/app-admins", response_model=list[AppAdminResponse], summary="List app admins")
async def list_app_admins(
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> list[AppAdminResponse]:
    admins = await UserService(db).list_app_admins()
    return [AppAdminResponse.model_validate(a) for a in admins]


@router.post(
    "/app-admins",
    response_model=AppAdminResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Grant app admin rights",
)
async def grant_app_admin(
    request: Request,
    payload: AppAdminCreate,
    current_user: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> AppAdminResponse:
    aa = await UserService(db).grant_app_admin(payload, current_user.id)
    await log_audit(db, current_user, "app_admin.granted",
                    resource_type="app_admin", resource_id=str(aa.id),
                    metadata={"user_id": str(payload.user_id), "app_name": payload.app_name},
                    request=request)
    return AppAdminResponse.model_validate(aa)


@router.delete(
    "/app-admins/{app_admin_id}",
    status_code=status.HTTP_200_OK,
    summary="Revoke app admin rights",
)
async def revoke_app_admin(
    request: Request,
    app_admin_id: uuid.UUID,
    current_user: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    await UserService(db).revoke_app_admin(app_admin_id)
    await log_audit(db, current_user, "app_admin.revoked",
                    resource_type="app_admin", resource_id=str(app_admin_id),
                    request=request)


# ── AI Config ─────────────────────────────────────────────────────────────────
@router.get("/ai-config", response_model=AIConfigResponse, summary="Get active AI configuration")
async def get_ai_config(
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> AIConfigResponse:
    ai_svc = AIService(db)
    config = await ai_svc.get_active_config()
    if config is None:
        # Return defaults from env — must set id explicitly because
        # SQLAlchemy insert-defaults don't fire on unsaved instances.
        from app.models.ai import AIConfig  # noqa: PLC0415

        dummy = AIConfig(
            id=uuid.uuid4(),
            provider=settings.AI_PROVIDER,
            model_name="gpt-4o",
            base_url=None,
            is_active=False,
        )
        return AIConfigResponse.model_validate(dummy)
    return AIConfigResponse.model_validate(config)


@router.put("/ai-config", response_model=AIConfigResponse, summary="Update AI configuration")
async def update_ai_config(
    request: Request,
    payload: AIConfigUpdate,
    current_user: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> AIConfigResponse:
    ai_svc = AIService(db)
    config = await ai_svc.update_config(
        payload.model_dump(exclude_unset=True),
        current_user.id,
    )
    await log_audit(db, current_user, "ai_config.updated",
                    resource_type="ai_config",
                    metadata={"provider": payload.provider, "model_name": payload.model_name},
                    request=request)
    return AIConfigResponse.model_validate(config)


@router.post("/ai-config/test", summary="Test AI provider connection")
async def test_ai_connection(
    payload: AIConfigUpdate,
    current_user: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Test connectivity to the configured AI provider without saving changes."""
    import httpx  # noqa: PLC0415

    provider = payload.provider or settings.AI_PROVIDER
    base_url = payload.base_url
    model = payload.model_name or "gpt-4o"

    try:
        if provider in ("openai", "grok"):
            from app.core.security import decrypt_field  # noqa: PLC0415
            api_key = payload.api_key
            if api_key:
                try:
                    api_key = decrypt_field(api_key)
                except Exception:
                    pass
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            test_url = (base_url or "https://api.openai.com/v1").rstrip("/") + "/models"
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(test_url, headers=headers)
                resp.raise_for_status()
            return {"status": "ok", "provider": provider, "message": f"{provider} API is reachable"}
        elif provider == "anthropic":
            return {"status": "ok", "provider": provider, "message": "Anthropic config saved (connection not tested)"}
        else:
            return {"status": "error", "provider": provider, "message": f"Unknown provider: {provider}"}
    except Exception as exc:
        return {"status": "error", "provider": provider, "message": str(exc)}


# ── Audit Logs ────────────────────────────────────────────────────────────────
@router.get("/audit-logs", response_model=list[AIAuditLogResponse], summary="Get AI audit logs")
async def get_audit_logs(
    _: SuperAdminUser,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> list[AIAuditLogResponse]:
    result = await db.execute(
        select(AIAuditLog)
        .order_by(AIAuditLog.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    logs = list(result.scalars().all())
    return [AIAuditLogResponse.model_validate(log) for log in logs]


# ── General Audit Logs ────────────────────────────────────────────────────────
@router.get(
    "/audit-logs/general",
    response_model=list[AuditLogResponse],
    summary="Get general admin audit logs",
)
async def get_general_audit_logs(
    _: SuperAdminUser,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=500),
    user_id: uuid.UUID | None = Query(default=None),
    action: str | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[AuditLogResponse]:
    logs = await UserService(db).list_audit_logs(
        skip=skip, limit=limit,
        user_id=user_id, action=action, resource_type=resource_type,
    )
    return [AuditLogResponse.model_validate(log) for log in logs]


# ── User App Access ───────────────────────────────────────────────────────────
@router.get(
    "/users/{user_id}/app-access",
    response_model=list[AppAccessEntry],
    summary="Get app access grants for a user",
)
async def get_user_app_access(
    user_id: uuid.UUID,
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> list[AppAccessEntry]:
    entries = await UserService(db).list_user_app_access(user_id)
    return [AppAccessEntry.model_validate(e) for e in entries]


@router.put(
    "/users/{user_id}/app-access",
    summary="Bulk set app access for a user",
)
async def set_user_app_access(
    request: Request,
    user_id: uuid.UUID,
    payload: AppAccessBulkUpdate,
    current_user: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    count = await UserService(db).bulk_set_app_access(
        user_id, payload.app_grants, current_user.id
    )
    await log_audit(db, current_user, "app_access.updated",
                    resource_type="user", resource_id=str(user_id),
                    metadata={"grants": payload.app_grants},
                    request=request)
    return {"updated": count}
