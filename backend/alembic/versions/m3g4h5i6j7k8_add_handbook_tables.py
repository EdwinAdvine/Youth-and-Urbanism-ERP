"""Add handbook tables: categories, articles, feedback, progress, view_logs.

Revision ID: m3g4h5i6j7k8
Revises: l2g3h4i5j6k7
Create Date: 2026-03-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ARRAY


# revision identifiers, used by Alembic.
revision = "m3g4h5i6j7k8"
down_revision = "l2g3h4i5j6k7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- handbook_categories ---
    op.create_table(
        "handbook_categories",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False, unique=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column(
            "parent_id",
            UUID(as_uuid=True),
            sa.ForeignKey("handbook_categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("module", sa.String(100), nullable=True, comment="Maps to ERP module name: finance, hr, crm, etc."),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_handbook_categories_slug", "handbook_categories", ["slug"])
    op.create_index("ix_handbook_categories_parent_id", "handbook_categories", ["parent_id"])

    # --- handbook_articles ---
    op.create_table(
        "handbook_articles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("slug", sa.String(500), nullable=False, unique=True),
        sa.Column("content_markdown", sa.Text, nullable=False, server_default=""),
        sa.Column("content_html", sa.Text, nullable=True),
        sa.Column("excerpt", sa.String(1000), nullable=True),
        sa.Column(
            "category_id",
            UUID(as_uuid=True),
            sa.ForeignKey("handbook_categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "author_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft", comment="draft | published | archived"),
        sa.Column("article_type", sa.String(30), nullable=False, server_default="guide", comment="guide | quickstart | faq | release_note | pro_tip"),
        sa.Column("module", sa.String(100), nullable=True, comment="ERP module this article covers"),
        sa.Column("tags", ARRAY(sa.String(100)), nullable=True),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("featured_image_url", sa.String(1000), nullable=True),
        sa.Column("video_url", sa.String(1000), nullable=True),
        sa.Column("ai_shortcut_prompt", sa.Text, nullable=True),
        sa.Column("estimated_read_time", sa.Integer, nullable=True),
        sa.Column("view_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("helpful_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("not_helpful_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_pinned", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_handbook_articles_slug", "handbook_articles", ["slug"])
    op.create_index("ix_handbook_articles_category_id", "handbook_articles", ["category_id"])
    op.create_index("ix_handbook_articles_author_id", "handbook_articles", ["author_id"])
    op.create_index("ix_handbook_articles_module", "handbook_articles", ["module"])

    # --- handbook_feedback ---
    op.create_table(
        "handbook_feedback",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "article_id",
            UUID(as_uuid=True),
            sa.ForeignKey("handbook_articles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("is_helpful", sa.Boolean, nullable=False),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("article_id", "user_id", name="uq_handbook_feedback_article_user"),
    )
    op.create_index("ix_handbook_feedback_article_id", "handbook_feedback", ["article_id"])
    op.create_index("ix_handbook_feedback_user_id", "handbook_feedback", ["user_id"])

    # --- handbook_progress ---
    op.create_table(
        "handbook_progress",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "article_id",
            UUID(as_uuid=True),
            sa.ForeignKey("handbook_articles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("article_id", "user_id", name="uq_handbook_progress_article_user"),
    )
    op.create_index("ix_handbook_progress_article_id", "handbook_progress", ["article_id"])
    op.create_index("ix_handbook_progress_user_id", "handbook_progress", ["user_id"])

    # --- handbook_view_logs ---
    op.create_table(
        "handbook_view_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "article_id",
            UUID(as_uuid=True),
            sa.ForeignKey("handbook_articles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("viewed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_handbook_view_logs_article_id", "handbook_view_logs", ["article_id"])
    op.create_index("ix_handbook_view_logs_user_id", "handbook_view_logs", ["user_id"])


def downgrade() -> None:
    op.drop_table("handbook_view_logs")
    op.drop_table("handbook_progress")
    op.drop_table("handbook_feedback")
    op.drop_table("handbook_articles")
    op.drop_table("handbook_categories")
