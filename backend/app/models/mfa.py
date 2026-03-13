"""MFA (Multi-Factor Authentication) and login attempt tracking models."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class UserMFA(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """TOTP multi-factor authentication configuration per user."""

    __tablename__ = "user_mfa"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    # TOTP secret — encrypted with Fernet before storage
    totp_secret: Mapped[str] = mapped_column(String(500), nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # JSON array of bcrypt-hashed backup codes (10 codes generated on setup)
    backup_codes: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user = relationship("User", backref="mfa_config", uselist=False)

    def __repr__(self) -> str:
        return f"<UserMFA user_id={self.user_id} enabled={self.is_enabled}>"


class LoginAttempt(Base, UUIDPrimaryKeyMixin):
    """Immutable log of every login attempt for security monitoring."""

    __tablename__ = "login_attempts"
    __table_args__ = (
        Index("ix_login_attempts_email", "email"),
        Index("ix_login_attempts_ip", "ip_address"),
        Index("ix_login_attempts_attempted_at", "attempted_at"),
    )

    email: Mapped[str] = mapped_column(String(255), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    failure_reason: Mapped[str | None] = mapped_column(String(100), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    attempted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )

    def __repr__(self) -> str:
        return f"<LoginAttempt email={self.email} success={self.success}>"
