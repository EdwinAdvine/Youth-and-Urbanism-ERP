from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel

class SessionResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    device_name: str | None
    device_fingerprint: str | None
    ip_address: str | None
    user_agent: str | None
    last_active_at: datetime
    created_at: datetime
    revoked_at: datetime | None
