from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import SuperAdminUser
from app.models.ai import AIAuditLog
from app.models.user import AppAdmin, User
from app.schemas.ai import AIAuditLogResponse, AIConfigResponse, AIConfigUpdate
from app.schemas.user import AppAdminCreate, AppAdminResponse
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
            "model": ai_config.model_name if ai_config else settings.OLLAMA_MODEL,
            "config_active": ai_config.is_active if ai_config else False,
        },
        "timestamp": datetime.now(UTC).isoformat(),
    }


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
    payload: AppAdminCreate,
    current_user: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> AppAdminResponse:
    aa = await UserService(db).grant_app_admin(payload, current_user.id)
    return AppAdminResponse.model_validate(aa)


@router.delete(
    "/app-admins/{app_admin_id}",
    status_code=status.HTTP_200_OK,
    summary="Revoke app admin rights",
)
async def revoke_app_admin(
    app_admin_id: uuid.UUID,
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    await UserService(db).revoke_app_admin(app_admin_id)


# ── AI Config ─────────────────────────────────────────────────────────────────
@router.get("/ai-config", response_model=AIConfigResponse, summary="Get active AI configuration")
async def get_ai_config(
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> AIConfigResponse:
    ai_svc = AIService(db)
    config = await ai_svc.get_active_config()
    if config is None:
        # Return defaults from env
        from app.models.ai import AIConfig  # noqa: PLC0415

        dummy = AIConfig(
            provider=settings.AI_PROVIDER,
            model_name=settings.OLLAMA_MODEL,
            base_url=settings.OLLAMA_URL,
            is_active=False,
        )
        return AIConfigResponse.model_validate(dummy)
    return AIConfigResponse.model_validate(config)


@router.put("/ai-config", response_model=AIConfigResponse, summary="Update AI configuration")
async def update_ai_config(
    payload: AIConfigUpdate,
    current_user: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> AIConfigResponse:
    ai_svc = AIService(db)
    config = await ai_svc.update_config(
        payload.model_dump(exclude_unset=True),
        current_user.id,
    )
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
    base_url = payload.base_url or settings.OLLAMA_URL
    model = payload.model_name or settings.OLLAMA_MODEL

    try:
        if provider == "ollama":
            url = f"{base_url.rstrip('/')}/api/tags"
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url)
                resp.raise_for_status()
            return {"status": "ok", "provider": provider, "message": "Ollama is reachable"}
        elif provider in ("openai", "grok"):
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
