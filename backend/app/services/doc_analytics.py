"""Document Analytics — usage, storage, collaboration, and AI metrics."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


class DocAnalyticsService:
    """Provides document analytics by querying live data."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def overview(self) -> dict[str, Any]:
        """High-level document metrics."""
        from app.models.drive import DriveFile
        from app.models.docs import DocumentComment, RecentDocument, DocumentBookmark

        total_docs = (await self.db.execute(select(func.count(DriveFile.id)))).scalar() or 0
        total_size = (await self.db.execute(select(func.coalesce(func.sum(DriveFile.size), 0)))).scalar() or 0
        total_comments = (await self.db.execute(select(func.count(DocumentComment.id)))).scalar() or 0
        total_bookmarks = (await self.db.execute(select(func.count(DocumentBookmark.id)))).scalar() or 0

        # Recently active (last 7 days)
        week_ago = datetime.utcnow() - timedelta(days=7)
        active_docs = (await self.db.execute(
            select(func.count(func.distinct(RecentDocument.document_id)))
            .where(RecentDocument.last_opened >= week_ago)
        )).scalar() or 0

        active_users = (await self.db.execute(
            select(func.count(func.distinct(RecentDocument.user_id)))
            .where(RecentDocument.last_opened >= week_ago)
        )).scalar() or 0

        return {
            "total_documents": total_docs,
            "total_storage_bytes": int(total_size),
            "total_storage_mb": round(int(total_size) / (1024 * 1024), 2),
            "total_comments": total_comments,
            "total_bookmarks": total_bookmarks,
            "active_documents_7d": active_docs,
            "active_users_7d": active_users,
        }

    async def usage_by_type(self) -> list[dict[str, Any]]:
        """Document count and size grouped by file extension."""
        from app.models.drive import DriveFile

        result = await self.db.execute(
            select(
                DriveFile.content_type,
                func.count(DriveFile.id).label("count"),
                func.coalesce(func.sum(DriveFile.size), 0).label("total_size"),
            ).group_by(DriveFile.content_type)
        )
        rows = result.all()
        return [
            {"content_type": row.content_type or "unknown", "count": row.count, "total_size_bytes": int(row.total_size)}
            for row in rows
        ]

    async def top_documents(self, limit: int = 10) -> list[dict[str, Any]]:
        """Most frequently accessed documents."""
        from app.models.drive import DriveFile
        from app.models.docs import RecentDocument

        result = await self.db.execute(
            select(
                RecentDocument.document_id,
                func.count(RecentDocument.id).label("access_count"),
                func.max(RecentDocument.last_opened).label("last_accessed"),
            )
            .group_by(RecentDocument.document_id)
            .order_by(func.count(RecentDocument.id).desc())
            .limit(limit)
        )
        rows = result.all()

        docs = []
        for row in rows:
            file = await self.db.get(DriveFile, row.document_id)
            if file:
                docs.append({
                    "file_id": str(row.document_id),
                    "name": file.name,
                    "content_type": file.content_type,
                    "access_count": row.access_count,
                    "last_accessed": row.last_accessed.isoformat() if row.last_accessed else None,
                })
        return docs

    async def storage_trend(self, days: int = 30) -> list[dict[str, Any]]:
        """Daily storage usage over the past N days."""
        from app.models.drive import DriveFile

        start = datetime.utcnow() - timedelta(days=days)
        result = await self.db.execute(
            select(
                func.date(DriveFile.created_at).label("day"),
                func.count(DriveFile.id).label("new_files"),
                func.coalesce(func.sum(DriveFile.size), 0).label("new_bytes"),
            )
            .where(DriveFile.created_at >= start)
            .group_by(func.date(DriveFile.created_at))
            .order_by(func.date(DriveFile.created_at))
        )
        return [
            {"date": str(row.day), "new_files": row.new_files, "new_bytes": int(row.new_bytes)}
            for row in result.all()
        ]

    async def collaboration_stats(self) -> dict[str, Any]:
        """Collaboration metrics — shared docs, comments, active collaborators."""
        from app.models.drive import DriveFile
        from app.models.docs import DocumentComment
        from app.models.file_share import FileShare

        shared_docs = (await self.db.execute(
            select(func.count(func.distinct(FileShare.file_id)))
        )).scalar() or 0

        week_ago = datetime.utcnow() - timedelta(days=7)
        recent_comments = (await self.db.execute(
            select(func.count(DocumentComment.id))
            .where(DocumentComment.created_at >= week_ago)
        )).scalar() or 0

        unique_commenters = (await self.db.execute(
            select(func.count(func.distinct(DocumentComment.author_id)))
            .where(DocumentComment.created_at >= week_ago)
        )).scalar() or 0

        return {
            "shared_documents": shared_docs,
            "comments_last_7d": recent_comments,
            "unique_commenters_7d": unique_commenters,
        }

    async def audit_summary(self, file_id: str | None = None, days: int = 30) -> list[dict[str, Any]]:
        """Audit log summary — action counts by type."""
        from app.models.docs import DocumentAuditLog

        start = datetime.utcnow() - timedelta(days=days)
        query = (
            select(
                DocumentAuditLog.action,
                func.count(DocumentAuditLog.id).label("count"),
            )
            .where(DocumentAuditLog.created_at >= start)
            .group_by(DocumentAuditLog.action)
            .order_by(func.count(DocumentAuditLog.id).desc())
        )
        if file_id:
            from uuid import UUID
            query = query.where(DocumentAuditLog.file_id == UUID(file_id))

        result = await self.db.execute(query)
        return [{"action": row.action, "count": row.count} for row in result.all()]
