"""Session management, security events, and API keys models."""
from __future__ import annotations
import hashlib
import secrets
import uuid
from datetime import UTC, datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

class UserSession(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "user_sessions"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_jti: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    device_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    device_fingerprint: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_active_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    __table_args__ = (Index("ix_user_sessions_user_id", "user_id"),)

class TrustedDevice(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "trusted_devices"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    device_fingerprint: Mapped[str] = mapped_column(String(100), nullable=False)
    device_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    trusted_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    __table_args__ = (Index("ix_trusted_devices_user_fingerprint", "user_id", "device_fingerprint"),)

class SecurityEvent(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "security_events"
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="low")  # low/medium/high/critical
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)
    __table_args__ = (
        Index("ix_security_events_user_id", "user_id"),
        Index("ix_security_events_created_at", "created_at"),
        Index("ix_security_events_severity", "severity"),
    )

class APIKey(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "api_keys"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(200), nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(10), nullable=False)  # first 8 chars for display
    scopes: Mapped[list | None] = mapped_column(JSON, nullable=True)  # e.g. ["read", "write"]
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    __table_args__ = (Index("ix_api_keys_user_id", "user_id"), Index("ix_api_keys_key_prefix", "key_prefix"),)

    @staticmethod
    def generate_key() -> tuple[str, str]:
        """Returns (raw_key, key_hash). Store hash, show raw once."""
        raw = "urp_" + secrets.token_urlsafe(32)
        key_hash = hashlib.sha256(raw.encode()).hexdigest()
        return raw, key_hash

    @staticmethod
    def hash_key(raw: str) -> str:
        return hashlib.sha256(raw.encode()).hexdigest()
