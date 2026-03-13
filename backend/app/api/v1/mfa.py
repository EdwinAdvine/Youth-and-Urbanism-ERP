"""MFA (Multi-Factor Authentication) endpoints."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser
from app.core.rate_limit import limiter
from app.schemas.auth import (
    MFABackupCodesResponse,
    MFASetupResponse,
    MFAVerifyRequest,
    MessageResponse,
    TokenResponse,
)
from app.services.auth import AuthService

router = APIRouter()


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post("/mfa/setup", response_model=MFASetupResponse, summary="Start MFA setup")
@limiter.limit("5/minute")
async def mfa_setup(
    request: Request,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> MFASetupResponse:
    result = await AuthService(db).setup_mfa(current_user)
    return MFASetupResponse(**result)


@router.post("/mfa/verify-setup", response_model=MFABackupCodesResponse, summary="Confirm MFA setup with first TOTP code")
@limiter.limit("5/minute")
async def mfa_verify_setup(
    request: Request,
    totp_code: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> MFABackupCodesResponse:
    codes = await AuthService(db).verify_mfa_setup(current_user, totp_code)
    return MFABackupCodesResponse(backup_codes=codes)


@router.post("/mfa/verify", response_model=TokenResponse, summary="Verify TOTP code during login")
@limiter.limit("5/minute")
async def mfa_verify(
    request: Request,
    payload: MFAVerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    return await AuthService(db).verify_mfa(
        mfa_token=payload.mfa_token,
        totp_code=payload.totp_code,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )


@router.post("/mfa/backup-codes", response_model=MFABackupCodesResponse, summary="Regenerate backup codes")
@limiter.limit("3/minute")
async def mfa_backup_codes(
    request: Request,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> MFABackupCodesResponse:
    codes = await AuthService(db).generate_backup_codes(current_user)
    return MFABackupCodesResponse(backup_codes=codes)


@router.delete("/mfa/disable", response_model=MessageResponse, summary="Disable MFA")
@limiter.limit("3/minute")
async def mfa_disable(
    request: Request,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await AuthService(db).disable_mfa(current_user)
    return MessageResponse(message="MFA has been disabled")
