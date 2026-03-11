"""Handbook models: categories, articles, feedback, progress, and view logs."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class HandbookCategory(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A category for organising handbook articles by module/topic."""

    __tablename__ = "handbook_categories"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)

    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("handbook_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    module: Mapped[str | None] = mapped_column(
        String(100), nullable=True,
        comment="Maps to ERP module name: finance, hr, crm, etc.",
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    parent = relationship("HandbookCategory", remote_side="HandbookCategory.id", foreign_keys=[parent_id])
    children = relationship("HandbookCategory", back_populates="parent", foreign_keys=[parent_id])
    articles = relationship("HandbookArticle", back_populates="category", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<HandbookCategory id={self.id} slug={self.slug!r}>"


class HandbookArticle(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A handbook article containing documentation, guides, or quick-start content."""

    __tablename__ = "handbook_articles"

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    slug: Mapped[str] = mapped_column(String(500), nullable=False, unique=True, index=True)
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    excerpt: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("handbook_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft",
        comment="draft | published | archived",
    )
    article_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default="guide",
        comment="guide | quickstart | faq | release_note | pro_tip",
    )
    module: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True,
        comment="ERP module this article covers",
    )
    tags: Mapped[list | None] = mapped_column(ARRAY(String(100)), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    featured_image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    ai_shortcut_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)

    estimated_read_time: Mapped[int | None] = mapped_column(Integer, nullable=True)
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    helpful_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    not_helpful_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    category = relationship("HandbookCategory", back_populates="articles", foreign_keys=[category_id])
    author = relationship("User", foreign_keys=[author_id])
    feedback = relationship("HandbookFeedback", back_populates="article", cascade="all, delete-orphan")
    progress_records = relationship("HandbookProgress", back_populates="article", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<HandbookArticle id={self.id} slug={self.slug!r} status={self.status}>"


class HandbookFeedback(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Per-user feedback on a handbook article (helpful / not helpful)."""

    __tablename__ = "handbook_feedback"
    __table_args__ = (
        UniqueConstraint("article_id", "user_id", name="uq_handbook_feedback_article_user"),
    )

    article_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("handbook_articles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_helpful: Mapped[bool] = mapped_column(Boolean, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    article = relationship("HandbookArticle", back_populates="feedback", foreign_keys=[article_id])
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<HandbookFeedback id={self.id} article={self.article_id} helpful={self.is_helpful}>"


class HandbookProgress(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Tracks which articles a user has read/completed."""

    __tablename__ = "handbook_progress"
    __table_args__ = (
        UniqueConstraint("article_id", "user_id", name="uq_handbook_progress_article_user"),
    )

    article_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("handbook_articles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    article = relationship("HandbookArticle", back_populates="progress_records", foreign_keys=[article_id])
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<HandbookProgress id={self.id} article={self.article_id} user={self.user_id}>"


class HandbookViewLog(Base, UUIDPrimaryKeyMixin):
    """Analytics: individual page-view events for handbook articles."""

    __tablename__ = "handbook_view_logs"

    article_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("handbook_articles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    viewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
