"""Add meeting_links table for cross-module soft links (tasks, notes, CRM).

Revision ID: h8c9d0e1f2g3
Revises: g7b8c9d0e1f2
Create Date: 2026-03-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "h8c9d0e1f2g3"
down_revision = "g7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "meeting_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("meeting_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("calendar_events.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("link_type", sa.String(50), nullable=False, comment="task | contact | deal | note"),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False, comment="ID of the linked entity in its own table"),
        sa.Column("entity_title", sa.String(500), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
    )
    # Index for efficient lookups by meeting + type
    op.create_index("ix_meeting_links_meeting_type", "meeting_links", ["meeting_id", "link_type"])


def downgrade() -> None:
    op.drop_index("ix_meeting_links_meeting_type", table_name="meeting_links")
    op.drop_table("meeting_links")
