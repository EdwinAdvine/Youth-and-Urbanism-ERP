from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ── Config ────────────────────────────────────────────────────────────────────
class AIConfigUpdate(BaseModel):
    provider: str | None = None
    model_name: str | None = Field(default=None, max_length=150)
    api_key: str | None = None
    base_url: str | None = None
    is_active: bool | None = None


class AIConfigResponse(BaseModel):
    id: uuid.UUID
    provider: str
    model_name: str
    base_url: str | None
    is_active: bool
    updated_at: datetime | None

    model_config = {"from_attributes": True}


# ── Chat ──────────────────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=32_000)
    context: dict[str, Any] | None = None
    session_id: str | None = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    provider: str
    model: str


# ── History ───────────────────────────────────────────────────────────────────
class ChatHistoryItem(BaseModel):
    id: uuid.UUID
    session_id: str
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Audit logs ────────────────────────────────────────────────────────────────
class AIAuditLogResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    action: str
    module: str | None
    details: dict[str, Any] | None
    created_at: datetime

    model_config = {"from_attributes": True}
