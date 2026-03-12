"""E-Commerce Blog models."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class BlogPost(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Blog post for e-commerce content marketing."""
    __tablename__ = "ecom_blog_posts"

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecom_stores.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    slug: Mapped[str] = mapped_column(String(500), unique=True, nullable=False, index=True)
    content_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", index=True)  # draft/published
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    tags_json: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)
    meta_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    meta_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    feature_image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    store = relationship("Store", lazy="joined")
    author = relationship("User", lazy="joined")

    def __repr__(self) -> str:
        return f"<BlogPost id={self.id} title={self.title!r} status={self.status}>"
