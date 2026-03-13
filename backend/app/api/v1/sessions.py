"""Session management — list, revoke, sign out everywhere."""
import uuid
from datetime import UTC, datetime
from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import CurrentUser, DBSession
from app.core.security import revoke_token_jti, decode_token
from app.models.session import UserSession
from app.schemas.session import SessionResponse
from fastapi import Depends

router = APIRouter()

@router.get("", response_model=list[SessionResponse], summary="List my active sessions")
async def list_sessions(current_user: CurrentUser, db: DBSession) -> list[SessionResponse]:
    result = await db.execute(
        select(UserSession).where(
            UserSession.user_id == current_user.id,
            UserSession.revoked_at.is_(None),
        ).order_by(UserSession.last_active_at.desc())
    )
    return result.scalars().all()

@router.delete("/{session_id}", status_code=status.HTTP_200_OK, summary="Revoke a specific session")
async def revoke_session(session_id: uuid.UUID, current_user: CurrentUser, db: DBSession):
    result = await db.execute(
        select(UserSession).where(UserSession.id == session_id, UserSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.revoked_at = datetime.now(UTC)
    await revoke_token_jti(session.token_jti, ttl_seconds=86400 * 30)
    await db.commit()
    return {"status": "revoked"}

@router.delete("", status_code=status.HTTP_200_OK, summary="Sign out everywhere (revoke all sessions)")
async def revoke_all_sessions(request: Request, current_user: CurrentUser, db: DBSession):
    result = await db.execute(
        select(UserSession).where(
            UserSession.user_id == current_user.id,
            UserSession.revoked_at.is_(None),
        )
    )
    sessions = result.scalars().all()
    now = datetime.now(UTC)
    # Get current session JTI to keep it active
    auth_header = request.headers.get("Authorization", "")
    current_jti = None
    if auth_header.startswith("Bearer "):
        try:
            payload = decode_token(auth_header[7:])
            current_jti = payload.get("jti")
        except Exception:
            pass
    for s in sessions:
        if s.token_jti != current_jti:
            s.revoked_at = now
            await revoke_token_jti(s.token_jti, ttl_seconds=86400 * 30)
    await db.commit()
    return {"status": "all_revoked", "count": len([s for s in sessions if s.token_jti != current_jti])}
