"""Notes analytics service — usage, collaboration, and AI metrics."""
from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class NotesAnalyticsService:

    async def get_overview(self, user_id: str, db: AsyncSession) -> dict[str, Any]:
        import uuid  # noqa: PLC0415
        from app.models.notes import Note  # noqa: PLC0415
        uid = uuid.UUID(str(user_id))
        now = datetime.now(UTC)
        last_30 = now - timedelta(days=30)

        # Total notes
        res = await db.execute(select(func.count()).where(Note.owner_id == uid))
        total_notes = res.scalar() or 0

        # Notes this month
        res = await db.execute(
            select(func.count()).where(and_(Note.owner_id == uid, Note.created_at >= last_30))
        )
        notes_this_month = res.scalar() or 0

        # Most active days (notes created per day last 30 days)
        res = await db.execute(
            select(func.date(Note.created_at).label('day'), func.count().label('count'))
            .where(and_(Note.owner_id == uid, Note.created_at >= last_30))
            .group_by(func.date(Note.created_at))
            .order_by(func.date(Note.created_at))
        )
        activity = [{"date": str(r.day), "count": r.count} for r in res.all()]

        # Most used tags
        res = await db.execute(
            select(Note.tags).where(Note.owner_id == uid).limit(200)
        )
        tag_counts: dict[str, int] = {}
        for (tags,) in res.all():
            for tag in (tags or []):
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
        top_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:10]

        # Recent notes
        res = await db.execute(
            select(Note.id, Note.title, Note.updated_at)
            .where(Note.owner_id == uid)
            .order_by(Note.updated_at.desc())
            .limit(5)
        )
        recent = [{"id": str(r.id), "title": r.title, "updated_at": r.updated_at.isoformat()} for r in res.all()]

        return {
            "total_notes": total_notes,
            "notes_this_month": notes_this_month,
            "activity_by_day": activity,
            "top_tags": [{"tag": t, "count": c} for t, c in top_tags],
            "recent_notes": recent,
        }

    async def get_collaboration_stats(self, user_id: str, db: AsyncSession) -> dict[str, Any]:
        import uuid  # noqa: PLC0415
        from app.models.note_collab import NoteComment, NoteVersion  # noqa: PLC0415
        uid = uuid.UUID(str(user_id))

        # Comment count by note
        res = await db.execute(
            select(NoteComment.note_id, func.count().label('count'))
            .where(NoteComment.author_id == uid)
            .group_by(NoteComment.note_id)
            .order_by(func.count().desc())
            .limit(10)
        )
        comment_activity = [{"note_id": str(r.note_id), "count": r.count} for r in res.all()]

        res = await db.execute(select(func.count()).where(NoteComment.author_id == uid))
        total_comments = res.scalar() or 0

        res = await db.execute(
            select(func.count()).where(NoteVersion.created_by_id == uid)
        )
        total_versions = res.scalar() or 0

        return {
            "total_comments": total_comments,
            "total_versions": total_versions,
            "comment_activity": comment_activity,
        }
