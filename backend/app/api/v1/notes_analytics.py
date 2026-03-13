"""Notes analytics endpoints."""

from fastapi import APIRouter

from app.core.deps import CurrentUser, DBSession

router = APIRouter()


@router.get("/overview")
async def get_analytics_overview(db: DBSession, user: CurrentUser) -> dict:
    from app.services.notes_analytics import NotesAnalyticsService  # noqa: PLC0415
    svc = NotesAnalyticsService()
    return await svc.get_overview(str(user.id), db)


@router.get("/collaboration")
async def get_collaboration_stats(db: DBSession, user: CurrentUser) -> dict:
    from app.services.notes_analytics import NotesAnalyticsService  # noqa: PLC0415
    svc = NotesAnalyticsService()
    return await svc.get_collaboration_stats(str(user.id), db)
