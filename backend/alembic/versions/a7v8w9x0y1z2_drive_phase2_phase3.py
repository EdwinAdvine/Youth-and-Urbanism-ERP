"""Drive Phase 2 + 3 tables: file requests, webhooks, API keys, templates, vault, DLP.

Revision ID: a7v8w9x0y1z2
Revises: y5t6u7v8w9x0
Create Date: 2026-03-12 10:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON, UUID

# revision identifiers
revision = "a7v8w9x0y1z2"
down_revision = "y5t6u7v8w9x0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── file_requests ──────────────────────────────────────────────────────────
    op.create_table(
        "file_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("required_types", JSON, nullable=True),
        sa.Column("max_file_size", sa.Integer(), nullable=True),
        sa.Column("max_files", sa.Integer(), nullable=True),
        sa.Column("folder_id", UUID(as_uuid=True), sa.ForeignKey("drive_folders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("token", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("branding_json", JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "file_request_submissions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("request_id", UUID(as_uuid=True), sa.ForeignKey("file_requests.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("file_id", UUID(as_uuid=True), sa.ForeignKey("drive_files.id", ondelete="CASCADE"), nullable=False),
        sa.Column("submitted_by_name", sa.String(255), nullable=True),
        sa.Column("submitted_by_email", sa.String(255), nullable=True),
        sa.Column("submitted_by_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="received"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
    )

    # ── drive_webhooks ─────────────────────────────────────────────────────────
    op.create_table(
        "drive_webhooks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("url", sa.String(2048), nullable=False),
        sa.Column("secret", sa.String(255), nullable=True),
        sa.Column("events", JSON, nullable=False, server_default="[]"),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_triggered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "webhook_deliveries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("webhook_id", UUID(as_uuid=True), sa.ForeignKey("drive_webhooks.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("event", sa.String(50), nullable=False),
        sa.Column("payload_json", JSON, nullable=False, server_default="{}"),
        sa.Column("response_status", sa.Integer(), nullable=True),
        sa.Column("response_body", sa.Text(), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("delivered_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── drive_api_keys ─────────────────────────────────────────────────────────
    op.create_table(
        "drive_api_keys",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("key_hash", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("key_prefix", sa.String(10), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("scopes", JSON, nullable=False, server_default="[]"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
    )

    # ── document_templates ─────────────────────────────────────────────────────
    op.create_table(
        "document_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("content_type", sa.String(255), nullable=False),
        sa.Column("minio_key", sa.String(1024), nullable=False, unique=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("thumbnail_key", sa.String(1024), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("variables_json", JSON, nullable=True),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("use_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
    )

    # ── personal_vaults ────────────────────────────────────────────────────────
    op.create_table(
        "personal_vaults",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("vault_folder_id", UUID(as_uuid=True), sa.ForeignKey("drive_folders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_locked", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("lock_timeout_minutes", sa.Integer(), nullable=False, server_default="20"),
        sa.Column("last_accessed", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
    )

    # ── dlp_rules ──────────────────────────────────────────────────────────────
    op.create_table(
        "dlp_rules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("patterns", JSON, nullable=False, server_default="[]"),
        sa.Column("action", sa.String(30), nullable=False, server_default="warn"),
        sa.Column("notify_admin", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("apply_to_sensitivity", JSON, nullable=True),
        sa.Column("apply_to_departments", JSON, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "dlp_violations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("rule_id", UUID(as_uuid=True), sa.ForeignKey("dlp_rules.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("file_id", UUID(as_uuid=True), sa.ForeignKey("drive_files.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("matched_patterns", JSON, nullable=False, server_default="[]"),
        sa.Column("action_taken", sa.String(30), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("detected_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── indexes ────────────────────────────────────────────────────────────────
    op.create_index("ix_file_requests_created_by", "file_requests", ["created_by"])
    op.create_index("ix_drive_webhooks_owner_id", "drive_webhooks", ["owner_id"])
    op.create_index("ix_document_templates_category", "document_templates", ["category"])
    op.create_index("ix_document_templates_is_public", "document_templates", ["is_public"])
    op.create_index("ix_dlp_violations_detected_at", "dlp_violations", ["detected_at"])
    op.create_index("ix_webhook_deliveries_delivered_at", "webhook_deliveries", ["delivered_at"])


def downgrade() -> None:
    op.drop_table("dlp_violations")
    op.drop_table("dlp_rules")
    op.drop_table("personal_vaults")
    op.drop_table("document_templates")
    op.drop_table("drive_api_keys")
    op.drop_table("webhook_deliveries")
    op.drop_table("drive_webhooks")
    op.drop_table("file_request_submissions")
    op.drop_table("file_requests")
