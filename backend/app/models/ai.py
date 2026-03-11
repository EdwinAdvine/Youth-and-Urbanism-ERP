from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModel, UUIDPrimaryKeyMixin


# ── AIConfig ──────────────────────────────────────────────────────────────────
class AIConfig(Base, UUIDPrimaryKeyMixin):
    """Stores the active AI provider configuration (single active row pattern)."""

    __tablename__ = "ai_configs"

    provider: Mapped[str] = mapped_column(
        String(50), nullable=False, default="ollama",
        comment="ollama | openai | grok | anthropic",
    )
    model_name: Mapped[str] = mapped_column(String(150), nullable=False, default="llama3.2")
    api_key: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="Encrypted API key for cloud providers",
    )
    base_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    updater = relationship("User", foreign_keys=[updated_by])

    def __repr__(self) -> str:
        return f"<AIConfig id={self.id} provider={self.provider} active={self.is_active}>"


# ── AIChatHistory ─────────────────────────────────────────────────────────────
class AIChatHistory(Base, UUIDPrimaryKeyMixin):
    """Persists every message in an AI chat session."""

    __tablename__ = "ai_chat_history"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    session_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    role: Mapped[str] = mapped_column(
        String(20), nullable=False,
        comment="user | assistant | system",
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<AIChatHistory id={self.id} session={self.session_id} role={self.role}>"


# ── AIAuditLog ────────────────────────────────────────────────────────────────
class AIAuditLog(Base, UUIDPrimaryKeyMixin):
    """Audit trail for all AI-related actions."""

    __tablename__ = "ai_audit_logs"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    module: Mapped[str | None] = mapped_column(String(100), nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<AIAuditLog id={self.id} action={self.action}>"
