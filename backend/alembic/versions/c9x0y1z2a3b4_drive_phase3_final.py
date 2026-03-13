"""Drive Phase 3 Final: Change Feed, Calendar Attachments, Content Types, Auto-Backup Rules,
Storage Tiers, Behavioral Profiles, Guest Users, Contract Metadata, AI Auto-Links,
plus add link_scope column to file_shares.

Revision ID: c9x0y1z2a3b4
Revises: a7v8w9x0y1z2
Create Date: 2026-03-12 12:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON, UUID

revision = "c9x0y1z2a3b4"
down_revision = "a7v8w9x0y1z2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── drive_change_feed ─────────────────────────────────────────────────────
    op.create_table(
        "drive_change_feed",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_id", UUID(as_uuid=True), sa.ForeignKey("drive_files.id", ondelete="SET NULL"), nullable=True),
        sa.Column("folder_id", UUID(as_uuid=True), sa.ForeignKey("drive_folders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(30), nullable=False),
        sa.Column("entity_type", sa.String(10), nullable=False),
        sa.Column("entity_name", sa.String(1024), nullable=False),
        sa.Column("parent_folder_id", UUID(as_uuid=True), nullable=True),
        sa.Column("sequence_id", sa.Integer(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("extra_data", JSON, nullable=True),
    )
    op.create_index("ix_drive_change_feed_user_id", "drive_change_feed", ["user_id"])
    op.create_index("ix_drive_change_feed_sequence_id", "drive_change_feed", ["sequence_id"])
    op.create_index("ix_drive_change_feed_occurred_at", "drive_change_feed", ["occurred_at"])

    # ── drive_user_sequences ──────────────────────────────────────────────────
    op.create_table(
        "drive_user_sequences",
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("last_sequence", sa.Integer(), nullable=False, server_default="0"),
    )

    # ── calendar_drive_attachments ────────────────────────────────────────────
    op.create_table(
        "calendar_drive_attachments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("event_id", UUID(as_uuid=True), sa.ForeignKey("calendar_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_id", UUID(as_uuid=True), sa.ForeignKey("drive_files.id", ondelete="CASCADE"), nullable=False),
        sa.Column("attached_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_calendar_drive_attachments_event_id", "calendar_drive_attachments", ["event_id"])

    # ── drive_content_types ───────────────────────────────────────────────────
    op.create_table(
        "drive_content_types",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("required_fields", JSON, nullable=False, server_default="[]"),
        sa.Column("allowed_mime_types", JSON, nullable=True),
        sa.Column("icon", sa.String(100), nullable=True),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
    )

    # ── drive_content_type_folders ────────────────────────────────────────────
    op.create_table(
        "drive_content_type_folders",
        sa.Column("content_type_id", UUID(as_uuid=True), sa.ForeignKey("drive_content_types.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("folder_id", UUID(as_uuid=True), sa.ForeignKey("drive_folders.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("enforce_on_upload", sa.Boolean(), nullable=False, server_default="true"),
    )

    # ── auto_backup_rules ─────────────────────────────────────────────────────
    op.create_table(
        "auto_backup_rules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("folder_id", UUID(as_uuid=True), sa.ForeignKey("drive_folders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("schedule_cron", sa.String(100), nullable=False, server_default="'0 2 * * *'"),
        sa.Column("destination", sa.String(50), nullable=False, server_default="'minio_backup'"),
        sa.Column("retention_count", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_run_status", sa.String(20), nullable=True),
        sa.Column("last_run_files", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_auto_backup_rules_folder_id", "auto_backup_rules", ["folder_id"])

    # ── drive_storage_tiers ───────────────────────────────────────────────────
    op.create_table(
        "drive_storage_tiers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("file_id", UUID(as_uuid=True), sa.ForeignKey("drive_files.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("tier", sa.String(20), nullable=False, server_default="'hot'"),
        sa.Column("tiered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tiered_by", sa.String(20), nullable=False, server_default="'auto'"),
        sa.Column("restore_requested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("restore_completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_drive_storage_tiers_file_id", "drive_storage_tiers", ["file_id"])

    # ── drive_user_behaviors ──────────────────────────────────────────────────
    op.create_table(
        "drive_user_behaviors",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("avg_daily_uploads", sa.Float(), nullable=True),
        sa.Column("avg_daily_downloads", sa.Float(), nullable=True),
        sa.Column("avg_daily_shares", sa.Float(), nullable=True),
        sa.Column("avg_daily_deletes", sa.Float(), nullable=True),
        sa.Column("typical_hours", JSON, nullable=True),
        sa.Column("typical_ip_hashes", JSON, nullable=True),
        sa.Column("upload_threshold", sa.Float(), nullable=True),
        sa.Column("download_threshold", sa.Float(), nullable=True),
        sa.Column("delete_threshold", sa.Float(), nullable=True),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("alert_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_alert_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── drive_anomaly_alerts ──────────────────────────────────────────────────
    op.create_table(
        "drive_anomaly_alerts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("alert_type", sa.String(50), nullable=False),
        sa.Column("details", JSON, nullable=False, server_default="{}"),
        sa.Column("severity", sa.String(20), nullable=False, server_default="'medium'"),
        sa.Column("is_resolved", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("resolved_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("detected_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_drive_anomaly_alerts_user_id", "drive_anomaly_alerts", ["user_id"])
    op.create_index("ix_drive_anomaly_alerts_detected_at", "drive_anomaly_alerts", ["detected_at"])

    # ── drive_guest_users ─────────────────────────────────────────────────────
    op.create_table(
        "drive_guest_users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("share_id", UUID(as_uuid=True), sa.ForeignKey("file_shares.id", ondelete="CASCADE"), nullable=False),
        sa.Column("invited_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("access_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_accessed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_drive_guest_users_email", "drive_guest_users", ["email"])
    op.create_index("ix_drive_guest_users_share_id", "drive_guest_users", ["share_id"])

    # ── drive_contract_metadata ───────────────────────────────────────────────
    op.create_table(
        "drive_contract_metadata",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("file_id", UUID(as_uuid=True), sa.ForeignKey("drive_files.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("parties", JSON, nullable=True),
        sa.Column("effective_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expiry_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("renewal_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("contract_value", sa.Float(), nullable=True),
        sa.Column("currency", sa.String(3), nullable=True),
        sa.Column("key_obligations", JSON, nullable=True),
        sa.Column("payment_terms", sa.Text(), nullable=True),
        sa.Column("governing_law", sa.String(255), nullable=True),
        sa.Column("termination_clauses", JSON, nullable=True),
        sa.Column("auto_renews", sa.Boolean(), nullable=True),
        sa.Column("notice_period_days", sa.Integer(), nullable=True),
        sa.Column("renewal_alert_sent", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("expiry_alert_sent", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_drive_contract_metadata_file_id", "drive_contract_metadata", ["file_id"])

    # ── drive_auto_links ──────────────────────────────────────────────────────
    op.create_table(
        "drive_auto_links",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("file_id", UUID(as_uuid=True), sa.ForeignKey("drive_files.id", ondelete="CASCADE"), nullable=False),
        sa.Column("module", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(100), nullable=False),
        sa.Column("entity_id", sa.String(36), nullable=False),
        sa.Column("entity_name", sa.String(255), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("suggested_by", sa.String(20), nullable=False, server_default="'ai'"),
        sa.Column("status", sa.String(20), nullable=False, server_default="'suggested'"),
        sa.Column("confirmed_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_drive_auto_links_file_id", "drive_auto_links", ["file_id"])


def downgrade() -> None:
    op.drop_table("drive_auto_links")
    op.drop_table("drive_contract_metadata")
    op.drop_table("drive_guest_users")
    op.drop_table("drive_anomaly_alerts")
    op.drop_table("drive_user_behaviors")
    op.drop_table("drive_storage_tiers")
    op.drop_table("auto_backup_rules")
    op.drop_table("drive_content_type_folders")
    op.drop_table("drive_content_types")
    op.drop_table("calendar_drive_attachments")
    op.drop_table("drive_user_sequences")
    op.drop_table("drive_change_feed")
