
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import SuperAdminUser
from app.core.security import encrypt_field
from app.models.sso import SSOProvider, SSOProviderType
from app.services.sso import SSOService

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class SSOProviderCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    provider_type: SSOProviderType
    client_id: str = Field(..., min_length=1)
    client_secret: str = Field(..., min_length=1)
    authorization_url: str = Field(..., min_length=1)
    token_url: str = Field(..., min_length=1)
    userinfo_url: str = Field(..., min_length=1)
    redirect_uri: str = Field(..., min_length=1)
    scopes: str = "openid email profile"
    is_active: bool = True


class SSOProviderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    provider_type: SSOProviderType | None = None
    client_id: str | None = None
    client_secret: str | None = None
    authorization_url: str | None = None
    token_url: str | None = None
    userinfo_url: str | None = None
    redirect_uri: str | None = None
    scopes: str | None = None
    is_active: bool | None = None


class SSOProviderResponse(BaseModel):
    id: uuid.UUID
    name: str
    provider_type: SSOProviderType
    client_id: str
    authorization_url: str
    token_url: str
    userinfo_url: str
    redirect_uri: str
    scopes: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Admin endpoints ──────────────────────────────────────────────────────────

@router.get("/providers", response_model=list[SSOProviderResponse], summary="List SSO providers")
async def list_providers(
    db: AsyncSession = Depends(get_db),
) -> list[SSOProviderResponse]:
    result = await db.execute(
        select(SSOProvider).where(SSOProvider.is_active == True).order_by(SSOProvider.name)  # noqa: E712
    )
    return [SSOProviderResponse.model_validate(p) for p in result.scalars().all()]


@router.post("/providers", response_model=SSOProviderResponse, status_code=status.HTTP_201_CREATED, summary="Create SSO provider (Super Admin)")
async def create_provider(
    payload: SSOProviderCreate,
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> SSOProviderResponse:
    provider = SSOProvider(
        name=payload.name,
        provider_type=payload.provider_type,
        client_id=payload.client_id,
        client_secret=encrypt_field(payload.client_secret),
        authorization_url=payload.authorization_url,
        token_url=payload.token_url,
        userinfo_url=payload.userinfo_url,
        redirect_uri=payload.redirect_uri,
        scopes=payload.scopes,
        is_active=payload.is_active,
    )
    db.add(provider)
    await db.flush()
    await db.refresh(provider)
    return SSOProviderResponse.model_validate(provider)


@router.put("/providers/{provider_id}", response_model=SSOProviderResponse, summary="Update SSO provider (Super Admin)")
async def update_provider(
    provider_id: uuid.UUID,
    payload: SSOProviderUpdate,
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> SSOProviderResponse:
    result = await db.execute(select(SSOProvider).where(SSOProvider.id == provider_id))
    provider = result.scalar_one_or_none()
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SSO provider not found")

    data = payload.model_dump(exclude_unset=True)
    if "client_secret" in data and data["client_secret"]:
        data["client_secret"] = encrypt_field(data["client_secret"])

    for key, value in data.items():
        setattr(provider, key, value)

    db.add(provider)
    await db.flush()
    await db.refresh(provider)
    return SSOProviderResponse.model_validate(provider)


@router.delete("/providers/{provider_id}", status_code=status.HTTP_200_OK, summary="Delete SSO provider (Super Admin)")
async def delete_provider(
    provider_id: uuid.UUID,
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    result = await db.execute(select(SSOProvider).where(SSOProvider.id == provider_id))
    provider = result.scalar_one_or_none()
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SSO provider not found")
    await db.delete(provider)
    await db.flush()
    return {"message": "SSO provider deleted"}


# ── OAuth2 flow endpoints ────────────────────────────────────────────────────

@router.get("/{provider_id}/authorize", summary="Redirect to SSO provider for login")
async def authorize(
    provider_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    sso = SSOService(db)
    provider = await sso.get_provider(provider_id)
    if not provider.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SSO provider is not active")
    auth_url = sso.generate_auth_url(provider)
    return RedirectResponse(url=auth_url)


@router.get("/{provider_id}/callback", summary="SSO callback — exchange code for JWT tokens")
async def callback(
    provider_id: uuid.UUID,
    code: str = Query(...),
    state: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    sso = SSOService(db)
    provider = await sso.get_provider(provider_id)
    if not provider.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SSO provider is not active")

    userinfo = await sso.exchange_code(provider, code)
    result = await sso.get_or_create_user(provider, userinfo)
    return result
