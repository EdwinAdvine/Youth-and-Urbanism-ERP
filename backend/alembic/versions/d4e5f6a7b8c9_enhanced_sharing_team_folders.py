"""enhanced_sharing_team_folders_audit

Revision ID: d4e5f6a7b8c9
Revises: 9b8c87451538
Create Date: 2026-03-11 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "9b8c87451538"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Team Folders ──────────────────────────────────────────────────────────
    op.create_table(
        "team_folders",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("department", sa.String(100), nullable=True),
        sa.Column("drive_folder_id", UUID(as_uuid=True), sa.ForeignKey("drive_folders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("is_company_wide", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "team_folder_members",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("team_folder_id", UUID(as_uuid=True), sa.ForeignKey("team_folders.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("permission", sa.String(20), nullable=False, server_default="view"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Enhance file_shares table ─────────────────────────────────────────────
    op.add_column("file_shares", sa.Column("folder_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_file_shares_folder", "file_shares", "drive_folders", ["folder_id"], ["id"], ondelete="CASCADE")
    op.create_index("ix_file_shares_folder_id", "file_shares", ["folder_id"])

    op.add_column("file_shares", sa.Column("shared_with_team_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_file_shares_team", "file_shares", "team_folders", ["shared_with_team_id"], ["id"], ondelete="CASCADE")
    op.create_index("ix_file_shares_shared_with_team_id", "file_shares", ["shared_with_team_id"])

    op.add_column("file_shares", sa.Column("shared_by_user_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_file_shares_shared_by", "file_shares", "users", ["shared_by_user_id"], ["id"], ondelete="SET NULL")

    op.add_column("file_shares", sa.Column("link_password", sa.String(255), nullable=True))
    op.add_column("file_shares", sa.Column("no_download", sa.Boolean, nullable=False, server_default="false"))
    op.add_column("file_shares", sa.Column("is_file_drop", sa.Boolean, nullable=False, server_default="false"))
    op.add_column("file_shares", sa.Column("max_downloads", sa.Integer, nullable=True))
    op.add_column("file_shares", sa.Column("download_count", sa.Integer, nullable=False, server_default="0"))
    op.add_column("file_shares", sa.Column("requires_approval", sa.Boolean, nullable=False, server_default="false"))
    op.add_column("file_shares", sa.Column("approved", sa.Boolean, nullable=False, server_default="false"))
    op.add_column("file_shares", sa.Column("approved_by_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_file_shares_approved_by", "file_shares", "users", ["approved_by_id"], ["id"], ondelete="SET NULL")
    op.add_column("file_shares", sa.Column("notify_on_access", sa.Boolean, nullable=False, server_default="false"))

    # Make file_id nullable (shares can target folders instead)
    op.alter_column("file_shares", "file_id", existing_type=UUID(as_uuid=True), nullable=True)
    op.create_index("ix_file_shares_file_id", "file_shares", ["file_id"])
    op.create_index("ix_file_shares_shared_with_user_id", "file_shares", ["shared_with_user_id"])

    # ── Share Audit Log ───────────────────────────────────────────────────────
    op.create_table(
        "share_audit_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("share_id", UUID(as_uuid=True), sa.ForeignKey("file_shares.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("actor_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("details", sa.Text, nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("share_audit_logs")

    op.drop_constraint("fk_file_shares_approved_by", "file_shares", type_="foreignkey")
    op.drop_column("file_shares", "notify_on_access")
    op.drop_column("file_shares", "approved_by_id")
    op.drop_column("file_shares", "approved")
    op.drop_column("file_shares", "requires_approval")
    op.drop_column("file_shares", "download_count")
    op.drop_column("file_shares", "max_downloads")
    op.drop_column("file_shares", "is_file_drop")
    op.drop_column("file_shares", "no_download")
    op.drop_column("file_shares", "link_password")
    op.drop_constraint("fk_file_shares_shared_by", "file_shares", type_="foreignkey")
    op.drop_column("file_shares", "shared_by_user_id")
    op.drop_index("ix_file_shares_shared_with_team_id", table_name="file_shares")
    op.drop_constraint("fk_file_shares_team", "file_shares", type_="foreignkey")
    op.drop_column("file_shares", "shared_with_team_id")
    op.drop_index("ix_file_shares_folder_id", table_name="file_shares")
    op.drop_constraint("fk_file_shares_folder", "file_shares", type_="foreignkey")
    op.drop_column("file_shares", "folder_id")

    op.alter_column("file_shares", "file_id", existing_type=UUID(as_uuid=True), nullable=False)

    op.drop_table("team_folder_members")
    op.drop_table("team_folders")
