"""Drive universal file gateway: source module tracking + access requests.

Revision ID: b43232670d70
Revises: z6u7v8w9x0y1
Create Date: 2026-03-13

Adds:
  - drive_files: source_module, source_entity_type, source_entity_id columns
  - ix_drive_files_source composite index
  - file_access_requests table for permission-gated access flow
"""

revision = "b43232670d70"
down_revision = "z6u7v8w9x0y1"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import text, inspect


def _column_exists(table, column):
    bind = op.get_bind()
    result = bind.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name=:t AND column_name=:c"
        ),
        {"t": table, "c": column},
    )
    return result.fetchone() is not None


def _table_exists(table):
    bind = op.get_bind()
    result = bind.execute(
        text("SELECT 1 FROM information_schema.tables WHERE table_name=:t"),
        {"t": table},
    )
    return result.fetchone() is not None


def _index_exists(index_name):
    bind = op.get_bind()
    result = bind.execute(
        text("SELECT 1 FROM pg_indexes WHERE indexname=:i"),
        {"i": index_name},
    )
    return result.fetchone() is not None


def upgrade() -> None:
    # ── Add source tracking columns to drive_files ──────────────────────
    if not _column_exists("drive_files", "source_module"):
        op.add_column("drive_files", sa.Column("source_module", sa.String(50), nullable=True))
    if not _column_exists("drive_files", "source_entity_type"):
        op.add_column("drive_files", sa.Column("source_entity_type", sa.String(100), nullable=True))
    if not _column_exists("drive_files", "source_entity_id"):
        op.add_column("drive_files", sa.Column("source_entity_id", sa.String(36), nullable=True))

    if not _index_exists("ix_drive_files_source_module"):
        op.create_index("ix_drive_files_source_module", "drive_files", ["source_module"])
    if not _index_exists("ix_drive_files_source"):
        op.create_index(
            "ix_drive_files_source",
            "drive_files",
            ["source_module", "source_entity_type", "source_entity_id"],
        )

    # ── Create file_access_requests table ───────────────────────────────
    if not _table_exists("file_access_requests"):
        op.create_table(
            "file_access_requests",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("file_id", UUID(as_uuid=True), sa.ForeignKey("drive_files.id", ondelete="CASCADE"), nullable=False),
            sa.Column("requester_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("requested_permission", sa.String(20), nullable=False, server_default="view"),
            sa.Column("reason", sa.Text, nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
            sa.Column("responded_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if not _index_exists("ix_file_access_requests_file_id"):
        op.create_index("ix_file_access_requests_file_id", "file_access_requests", ["file_id"])
    if not _index_exists("ix_file_access_requests_requester_id"):
        op.create_index("ix_file_access_requests_requester_id", "file_access_requests", ["requester_id"])
    if not _index_exists("ix_file_access_requests_owner_id"):
        op.create_index("ix_file_access_requests_owner_id", "file_access_requests", ["owner_id"])


def downgrade() -> None:
    op.drop_table("file_access_requests")

    op.drop_index("ix_drive_files_source", table_name="drive_files")
    op.drop_index("ix_drive_files_source_module", table_name="drive_files")
    op.drop_column("drive_files", "source_entity_id")
    op.drop_column("drive_files", "source_entity_type")
    op.drop_column("drive_files", "source_module")
