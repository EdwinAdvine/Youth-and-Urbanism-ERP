"""API key management — generate, list, revoke."""
import uuid
from datetime import UTC, datetime
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import CurrentUser, DBSession
from app.core.rate_limit import limiter
from app.models.session import APIKey
from fastapi import Request

router = APIRouter()

class APIKeyCreate(BaseModel):
    name: str
    scopes: list[str] | None = None

class APIKeyResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    name: str
    key_prefix: str
    scopes: list[str] | None
    last_used_at: datetime | None
    expires_at: datetime | None
    is_active: bool
    created_at: datetime

class APIKeyCreatedResponse(APIKeyResponse):
    raw_key: str  # Only shown once on creation

@router.post("", response_model=APIKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_api_key(request: Request, payload: APIKeyCreate, current_user: CurrentUser, db: DBSession):
    raw_key, key_hash = APIKey.generate_key()
    key = APIKey(
        user_id=current_user.id,
        name=payload.name,
        key_hash=key_hash,
        key_prefix=raw_key[:8],
        scopes=payload.scopes,
    )
    db.add(key)
    await db.commit()
    await db.refresh(key)
    data = APIKeyResponse.model_validate(key).model_dump()
    data["raw_key"] = raw_key
    return data

@router.get("", response_model=list[APIKeyResponse])
async def list_api_keys(current_user: CurrentUser, db: DBSession):
    result = await db.execute(
        select(APIKey).where(APIKey.user_id == current_user.id, APIKey.is_active == True)
    )
    return result.scalars().all()

@router.delete("/{key_id}", status_code=status.HTTP_200_OK)
async def revoke_api_key(key_id: uuid.UUID, current_user: CurrentUser, db: DBSession):
    result = await db.execute(
        select(APIKey).where(APIKey.id == key_id, APIKey.user_id == current_user.id)
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    key.is_active = False
    await db.commit()
    return {"status": "revoked"}
