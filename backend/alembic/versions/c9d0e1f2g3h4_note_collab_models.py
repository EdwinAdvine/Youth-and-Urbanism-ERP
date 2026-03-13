"""Note collaboration models: snapshots, updates, comments, versions.

Revision ID: c9d0e1f2g3h4
Revises: nd1a2b3c4d5e
Create Date: 2026-03-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "c9d0e1f2g3h4"
down_revision = "nd1a2b3c4d5e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "note_collab_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("note_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("snapshot", sa.LargeBinary, nullable=False),
        sa.Column("version", sa.Integer, default=0, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "note_collab_updates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("note_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("update_data", sa.LargeBinary, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("version", sa.Integer, default=0, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_note_collab_updates_note_id", "note_collab_updates", ["note_id"])
    op.create_table(
        "note_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("note_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_comment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("note_comments.id", ondelete="CASCADE"), nullable=True),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("anchor_block_id", sa.String(255), nullable=True),
        sa.Column("anchor_text", sa.String(500), nullable=True),
        sa.Column("is_resolved", sa.Boolean, default=False),
        sa.Column("resolved_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_note_comments_note_id", "note_comments", ["note_id"])
    op.create_table(
        "note_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("note_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.Integer, nullable=False),
        sa.Column("content_snapshot", sa.Text, nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("label", sa.String(255), nullable=True),
        sa.Column("word_count", sa.Integer, default=0),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("note_id", "version_number", name="uq_note_version"),
    )
    op.create_index("ix_note_versions_note_id", "note_versions", ["note_id"])


def downgrade() -> None:
    op.drop_index("ix_note_versions_note_id", table_name="note_versions")
    op.drop_table("note_versions")
    op.drop_index("ix_note_comments_note_id", table_name="note_comments")
    op.drop_table("note_comments")
    op.drop_index("ix_note_collab_updates_note_id", table_name="note_collab_updates")
    op.drop_table("note_collab_updates")
    op.drop_table("note_collab_snapshots")
