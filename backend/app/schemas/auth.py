from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.password_policy import PasswordPolicyError, validate_password


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)
    # Optional device fingerprint for trusted-device MFA skip
    device_fingerprint: str | None = None


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=12, max_length=128)

    @field_validator("password")
    @classmethod
    def check_password_policy(cls, v: str, info) -> str:  # noqa: N805
        email = info.data.get("email")
        full_name = info.data.get("full_name")
        try:
            validate_password(v, email=email, full_name=full_name)
        except PasswordPolicyError as exc:
            raise ValueError(str(exc)) from exc
        return v


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    # MFA fields — present when MFA is required
    mfa_required: bool = False
    mfa_token: str | None = None


class MFATokenResponse(BaseModel):
    """Returned when login succeeds but MFA verification is needed."""
    mfa_required: bool = True
    mfa_token: str
    message: str = "MFA verification required"


class MFAVerifyRequest(BaseModel):
    mfa_token: str
    totp_code: str = Field(..., min_length=6, max_length=8)
    device_fingerprint: str | None = None
    trust_device: bool = False


class MFASetupResponse(BaseModel):
    provisioning_uri: str
    secret: str  # shown once during setup


class MFABackupCodesResponse(BaseModel):
    backup_codes: list[str]
    message: str = "Store these codes securely. Each can only be used once."


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=12, max_length=128)

    @field_validator("new_password")
    @classmethod
    def check_new_password_policy(cls, v: str) -> str:  # noqa: N805
        try:
            validate_password(v)
        except PasswordPolicyError as exc:
            raise ValueError(str(exc)) from exc
        return v


class RefreshRequest(BaseModel):
    refresh_token: str


class MessageResponse(BaseModel):
    message: str
