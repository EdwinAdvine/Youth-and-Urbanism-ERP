"""Authentication service for Urban Vibes Dynamics.

Handles user login (with account lockout + MFA), registration, password
changes, token refresh, and MFA setup/teardown.  All credential verification,
JWT creation, and refresh-token rotation is delegated to ``app.core.security``.

Security features:
    - **Account lockout**: After ``MAX_FAILED_ATTEMPTS`` consecutive failed
      logins the account is locked for ``LOCKOUT_DURATION_MINUTES``.
    - **MFA (TOTP)**: Optional per-user TOTP via pyotp.  When enabled, login
      returns a short-lived MFA token; the caller must then call
      ``verify_mfa`` with a valid TOTP code (or backup code) to receive the
      real access + refresh token pair.
    - **Login audit trail**: Every login attempt (success or failure) is
      persisted as a ``LoginAttempt`` row for forensic review.

Usage:
    from app.services.auth import AuthService

    svc = AuthService(db)
    tokens = await svc.login(LoginRequest(email="...", password="..."))
"""

from __future__ import annotations

import json
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    decrypt_field,
    encrypt_field,
    get_stored_refresh_token,
    hash_password,
    store_refresh_token,
    verify_password,
)
from app.core.anomaly_detector import record_failed_login, record_login_ip
from app.models.mfa import LoginAttempt, UserMFA
from app.models.session import SecurityEvent, UserSession
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    MFATokenResponse,
    RegisterRequest,
    TokenResponse,
)

# ── Constants ────────────────────────────────────────────────────────────────
MAX_FAILED_ATTEMPTS = 5          # Lock account after this many consecutive failures
LOCKOUT_DURATION_MINUTES = 15    # How long the account stays locked (minutes)
MFA_TOKEN_EXPIRE_MINUTES = 5     # Short-lived token window for MFA verification step


class AuthService:
    """Core authentication service.

    Each instance is scoped to a single database session.  The caller
    (typically a FastAPI dependency) is responsible for committing the
    session after the service method returns.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Login (with account lockout + MFA) ───────────────────────────────────
    async def login(
        self,
        payload: LoginRequest,
        *,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> TokenResponse | MFATokenResponse:
        """Authenticate a user by email + password.

        Flow:
            1. Look up user by email.
            2. Check for active account lockout (HTTP 423 if locked).
            3. Verify password — increment ``failed_login_count`` on failure
               and lock the account when the threshold is reached.
            4. If MFA is enabled, return a short-lived ``MFATokenResponse``
               so the caller can complete the second factor.
            5. Otherwise, issue full access + refresh tokens.

        Every attempt (success or failure) is persisted via ``_log_attempt``.

        Returns:
            ``TokenResponse`` if login completes fully, or
            ``MFATokenResponse`` if the user must provide a TOTP code.

        Raises:
            HTTPException 401: Invalid credentials.
            HTTPException 403: Account disabled.
            HTTPException 423: Account temporarily locked.
        """
        result = await self.db.execute(
            select(User).where(User.email == payload.email)
        )
        user = result.scalar_one_or_none()

        # Check account lockout — reject early if the lock window hasn't expired
        if user and user.locked_until and user.locked_until > datetime.now(UTC):
            remaining = int((user.locked_until - datetime.now(UTC)).total_seconds())
            await self._log_attempt(payload.email, False, "account_locked", ip_address, user_agent)
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Account is temporarily locked. Try again in {remaining} seconds.",
            )

        # Verify credentials — use constant-time comparison via passlib
        if user is None or not verify_password(payload.password, user.hashed_password):
            if user:
                # Increment failure counter; lock account when threshold reached
                user.failed_login_count += 1
                if user.failed_login_count >= MAX_FAILED_ATTEMPTS:
                    user.locked_until = datetime.now(UTC) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
                self.db.add(user)
                await self.db.flush()
            # Record the failed attempt in the anomaly detector (IP-based brute force tracking)
            if ip_address:
                try:
                    await record_failed_login(ip_address)
                except Exception:
                    pass
            await self._log_attempt(payload.email, False, "invalid_credentials", ip_address, user_agent)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )

        if not user.is_active:
            await self._log_attempt(payload.email, False, "account_disabled", ip_address, user_agent)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled",
            )

        # Reset failed attempts on successful password verification
        user.failed_login_count = 0
        user.locked_until = None

        # Check if MFA is enabled
        mfa = await self._get_user_mfa(user.id)
        if mfa and mfa.is_enabled:
            # Issue a short-lived MFA token instead of full tokens
            mfa_token = self._create_mfa_token(str(user.id))
            await self._store_mfa_token(str(user.id), mfa_token)
            self.db.add(user)
            await self.db.flush()
            await self._log_attempt(payload.email, True, "mfa_required", ip_address, user_agent)
            return MFATokenResponse(mfa_token=mfa_token)

        # No MFA — issue full tokens
        user.last_login = datetime.now(UTC)
        self.db.add(user)
        await self.db.flush()
        await self._log_attempt(payload.email, True, None, ip_address, user_agent)

        # Anomaly detection: record IP and fire SecurityEvent on first-seen IP
        if ip_address:
            try:
                is_new_ip = await record_login_ip(str(user.id), ip_address)
                if is_new_ip:
                    event = SecurityEvent(
                        event_type="auth.login.new_ip",
                        severity="medium",
                        user_id=user.id,
                        ip_address=ip_address,
                        details={"email": user.email, "ip": ip_address},
                    )
                    self.db.add(event)
            except Exception:
                pass  # Never block login for anomaly detection failures

        return await self._issue_tokens(user, ip_address=ip_address, user_agent=user_agent)

    # ── MFA verification ─────────────────────────────────────────────────────
    async def verify_mfa(
        self,
        mfa_token: str,
        totp_code: str,
        *,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> TokenResponse:
        """Verify TOTP code and issue full access+refresh tokens."""
        user_id = await self._validate_mfa_token(mfa_token)
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="Invalid MFA session")

        mfa = await self._get_user_mfa(uuid.UUID(user_id))
        if not mfa or not mfa.is_enabled:
            raise HTTPException(status_code=400, detail="MFA not configured")

        # Verify TOTP code
        try:
            import pyotp  # noqa: PLC0415
        except ImportError:
            raise HTTPException(status_code=500, detail="MFA module not available")

        totp_secret = decrypt_field(mfa.totp_secret)
        totp = pyotp.TOTP(totp_secret)

        if totp.verify(totp_code, valid_window=1):
            # Valid TOTP code
            mfa.last_used_at = datetime.now(UTC)
            self.db.add(mfa)
        elif self._verify_backup_code(mfa, totp_code):
            # Valid backup code (consumed)
            self.db.add(mfa)
        else:
            await self._log_attempt(user.email, False, "invalid_totp", ip_address, user_agent)
            raise HTTPException(status_code=401, detail="Invalid verification code")

        # Revoke MFA token
        await self._revoke_mfa_token(user_id)

        user.last_login = datetime.now(UTC)
        self.db.add(user)
        await self.db.flush()
        await self._log_attempt(user.email, True, None, ip_address, user_agent)

        # Anomaly detection: record IP and fire SecurityEvent on first-seen IP
        if ip_address:
            try:
                is_new_ip = await record_login_ip(str(user.id), ip_address)
                if is_new_ip:
                    event = SecurityEvent(
                        event_type="auth.login.new_ip",
                        severity="medium",
                        user_id=user.id,
                        ip_address=ip_address,
                        details={"email": user.email, "ip": ip_address},
                    )
                    self.db.add(event)
            except Exception:
                pass  # Never block login for anomaly detection failures

        return await self._issue_tokens(user, ip_address=ip_address, user_agent=user_agent)

    # ── Password change ──────────────────────────────────────────────────────
    async def change_password(
        self,
        user: User,
        payload: ChangePasswordRequest,
    ) -> None:
        if not verify_password(payload.current_password, user.hashed_password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")

        user.hashed_password = hash_password(payload.new_password)
        user.password_changed_at = datetime.now(UTC)
        user.must_change_password = False
        self.db.add(user)
        await self.db.flush()

    # ── Register ─────────────────────────────────────────────────────────────
    async def register(self, payload: RegisterRequest) -> User:
        result = await self.db.execute(
            select(User).where(User.email == payload.email)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        user = User(
            email=payload.email,
            full_name=payload.full_name,
            hashed_password=hash_password(payload.password),
            password_changed_at=datetime.now(UTC),
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    # ── Refresh ──────────────────────────────────────────────────────────────
    async def refresh(self, refresh_token: str) -> TokenResponse:
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
        try:
            payload = decode_token(refresh_token)
            if payload.get("type") != "refresh":
                raise credentials_exception
            user_id: str = payload["sub"]
        except JWTError:
            raise credentials_exception

        stored = await get_stored_refresh_token(user_id)
        if stored != refresh_token:
            raise credentials_exception

        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None or not user.is_active:
            raise credentials_exception

        return await self._issue_tokens(user)

    # ── MFA Setup ────────────────────────────────────────────────────────────
    async def setup_mfa(self, user: User) -> dict:
        """Generate a new TOTP secret for the user."""
        try:
            import pyotp  # noqa: PLC0415
        except ImportError:
            raise HTTPException(status_code=500, detail="MFA module not available")

        secret = pyotp.random_base32()
        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(
            name=user.email,
            issuer_name=settings.APP_NAME,
        )

        mfa = await self._get_user_mfa(user.id)
        if mfa:
            mfa.totp_secret = encrypt_field(secret)
            mfa.is_enabled = False
        else:
            mfa = UserMFA(
                user_id=user.id,
                totp_secret=encrypt_field(secret),
                is_enabled=False,
            )
        self.db.add(mfa)
        await self.db.flush()

        return {"provisioning_uri": provisioning_uri, "secret": secret}

    async def verify_mfa_setup(self, user: User, totp_code: str) -> list[str]:
        """Verify initial TOTP code and enable MFA. Returns backup codes."""
        try:
            import pyotp  # noqa: PLC0415
        except ImportError:
            raise HTTPException(status_code=500, detail="MFA module not available")

        mfa = await self._get_user_mfa(user.id)
        if not mfa:
            raise HTTPException(status_code=400, detail="MFA setup not initiated")

        secret = decrypt_field(mfa.totp_secret)
        totp = pyotp.TOTP(secret)
        if not totp.verify(totp_code, valid_window=1):
            raise HTTPException(status_code=400, detail="Invalid TOTP code")

        backup_codes = [secrets.token_hex(4).upper() for _ in range(10)]
        hashed_codes = [hash_password(code) for code in backup_codes]
        mfa.is_enabled = True
        mfa.backup_codes = json.dumps(hashed_codes)
        mfa.last_used_at = datetime.now(UTC)
        self.db.add(mfa)
        await self.db.flush()

        return backup_codes

    async def disable_mfa(self, user: User) -> None:
        mfa = await self._get_user_mfa(user.id)
        if mfa:
            await self.db.delete(mfa)
            await self.db.flush()

    async def generate_backup_codes(self, user: User) -> list[str]:
        mfa = await self._get_user_mfa(user.id)
        if not mfa or not mfa.is_enabled:
            raise HTTPException(status_code=400, detail="MFA is not enabled")

        backup_codes = [secrets.token_hex(4).upper() for _ in range(10)]
        hashed_codes = [hash_password(code) for code in backup_codes]
        mfa.backup_codes = json.dumps(hashed_codes)
        self.db.add(mfa)
        await self.db.flush()

        return backup_codes

    # ── Admin: unlock account ────────────────────────────────────────────────
    async def unlock_account(self, user_id: uuid.UUID) -> None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.failed_login_count = 0
        user.locked_until = None
        self.db.add(user)
        await self.db.flush()

    # ── Private helpers ──────────────────────────────────────────────────────
    async def _issue_tokens(
        self,
        user: User,
        *,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> TokenResponse:
        access_token = create_access_token(
            subject=str(user.id),
            email=user.email,
            is_superadmin=user.is_superadmin,
        )
        refresh_token = create_refresh_token(subject=str(user.id))
        await store_refresh_token(str(user.id), refresh_token)

        # Persist a UserSession row so active sessions are trackable
        try:
            token_payload = decode_token(access_token)
            jti = token_payload.get("jti")
            if jti:
                session_record = UserSession(
                    user_id=user.id,
                    token_jti=jti,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    device_name=None,
                    device_fingerprint=None,
                    last_active_at=datetime.now(UTC),
                )
                self.db.add(session_record)
        except Exception:
            pass  # Never block token issuance for session tracking failures

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def _get_user_mfa(self, user_id: uuid.UUID) -> UserMFA | None:
        result = await self.db.execute(
            select(UserMFA).where(UserMFA.user_id == user_id)
        )
        return result.scalar_one_or_none()

    def _create_mfa_token(self, user_id: str) -> str:
        from jose import jwt as jose_jwt  # noqa: PLC0415
        expire = datetime.now(UTC) + timedelta(minutes=MFA_TOKEN_EXPIRE_MINUTES)
        payload = {"sub": user_id, "type": "mfa", "exp": expire}
        return jose_jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    async def _store_mfa_token(self, user_id: str, token: str) -> None:
        import redis.asyncio as aioredis  # noqa: PLC0415
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        try:
            await r.setex(f"mfa:{user_id}", MFA_TOKEN_EXPIRE_MINUTES * 60, token)
        finally:
            await r.aclose()

    async def _validate_mfa_token(self, token: str) -> str:
        try:
            payload = decode_token(token)
            if payload.get("type") != "mfa":
                raise HTTPException(status_code=401, detail="Invalid MFA token")
            user_id = payload["sub"]
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid or expired MFA token")

        import redis.asyncio as aioredis  # noqa: PLC0415
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        try:
            stored = await r.get(f"mfa:{user_id}")
            if stored != token:
                raise HTTPException(status_code=401, detail="MFA token already used or expired")
        finally:
            await r.aclose()

        return user_id

    async def _revoke_mfa_token(self, user_id: str) -> None:
        import redis.asyncio as aioredis  # noqa: PLC0415
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        try:
            await r.delete(f"mfa:{user_id}")
        finally:
            await r.aclose()

    def _verify_backup_code(self, mfa: UserMFA, code: str) -> bool:
        if not mfa.backup_codes:
            return False
        hashed_codes: list[str] = json.loads(mfa.backup_codes)
        for i, hashed in enumerate(hashed_codes):
            if verify_password(code, hashed):
                hashed_codes.pop(i)
                mfa.backup_codes = json.dumps(hashed_codes)
                return True
        return False

    async def _log_attempt(
        self,
        email: str,
        success: bool,
        failure_reason: str | None,
        ip_address: str | None,
        user_agent: str | None,
    ) -> None:
        try:
            attempt = LoginAttempt(
                email=email,
                ip_address=ip_address,
                success=success,
                failure_reason=failure_reason,
                user_agent=user_agent,
            )
            self.db.add(attempt)
            await self.db.flush()
        except Exception:
            pass  # Never block login for logging failures
