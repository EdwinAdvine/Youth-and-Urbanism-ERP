"""add_sessions_api_keys_security_events

Revision ID: ad1c2e3f4a5b
Revises: ac1b2d3e4f5a
Create Date: 2026-03-13

Adds:
- user_sessions table
- trusted_devices table
- security_events table
- api_keys table
"""

from __future__ import annotations
import sqlalchemy as sa
from alembic import op

revision: str = "ad1c2e3f4a5b"
down_revision: str | None = "ac1b2d3e4f5a"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "user_sessions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("token_jti", sa.String(100), nullable=False),
        sa.Column("device_name", sa.String(200), nullable=True),
        sa.Column("device_fingerprint", sa.String(100), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_jti"),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])
    op.create_index("ix_user_sessions_token_jti", "user_sessions", ["token_jti"])

    op.create_table(
        "trusted_devices",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("device_fingerprint", sa.String(100), nullable=False),
        sa.Column("device_name", sa.String(200), nullable=True),
        sa.Column("trusted_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_trusted_devices_user_fingerprint", "trusted_devices", ["user_id", "device_fingerprint"])

    op.create_table(
        "security_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default="low"),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("resolved", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("resolved_by", sa.UUID(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_security_events_user_id", "security_events", ["user_id"])
    op.create_index("ix_security_events_created_at", "security_events", ["created_at"])
    op.create_index("ix_security_events_severity", "security_events", ["severity"])

    op.create_table(
        "api_keys",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("key_hash", sa.String(200), nullable=False),
        sa.Column("key_prefix", sa.String(10), nullable=False),
        sa.Column("scopes", sa.JSON(), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_api_keys_user_id", "api_keys", ["user_id"])
    op.create_index("ix_api_keys_key_prefix", "api_keys", ["key_prefix"])

def downgrade() -> None:
    op.drop_index("ix_api_keys_key_prefix", "api_keys")
    op.drop_index("ix_api_keys_user_id", "api_keys")
    op.drop_table("api_keys")
    op.drop_index("ix_security_events_severity", "security_events")
    op.drop_index("ix_security_events_created_at", "security_events")
    op.drop_index("ix_security_events_user_id", "security_events")
    op.drop_table("security_events")
    op.drop_index("ix_trusted_devices_user_fingerprint", "trusted_devices")
    op.drop_table("trusted_devices")
    op.drop_index("ix_user_sessions_token_jti", "user_sessions")
    op.drop_index("ix_user_sessions_user_id", "user_sessions")
    op.drop_table("user_sessions")
