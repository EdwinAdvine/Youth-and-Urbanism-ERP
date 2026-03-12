"""Add document_bookmarks table for Y&U Docs upgrade.

Revision ID: w3r4s5t6u7v8
Revises: v2q3r4s5t6u7
Create Date: 2026-03-12

Adds:
  - document_bookmarks (user bookmarked/starred documents)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "w3r4s5t6u7v8"
down_revision = "v2q3r4s5t6u7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_bookmarks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("file_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drive_files.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "file_id", name="uq_document_bookmarks_user_file"),
    )


def downgrade() -> None:
    op.drop_table("document_bookmarks")
