"""add_mfa_and_login_attempts

Revision ID: ac1b2d3e4f5a
Revises: z6u7v8w9x0y1
Create Date: 2026-03-13

Adds:
- user_mfa table (TOTP secrets, backup codes, enable/disable)
- login_attempts table (audit trail of every login attempt)
- Users columns: failed_login_count, locked_until, password_changed_at,
                 must_change_password, mfa_required
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "ac1b2d3e4f5a"
down_revision: str | None = "z6u7v8w9x0y1"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    # ── user_mfa ──────────────────────────────────────────────────────────────
    op.create_table(
        "user_mfa",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("totp_secret", sa.Text(), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("backup_codes", sa.Text(), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_user_mfa_user_id", "user_mfa", ["user_id"])

    # ── login_attempts ────────────────────────────────────────────────────────
    op.create_table(
        "login_attempts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("failure_reason", sa.String(length=100), nullable=True),
        sa.Column("attempted_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_login_attempts_email", "login_attempts", ["email"])
    op.create_index("ix_login_attempts_ip_address", "login_attempts", ["ip_address"])
    op.create_index("ix_login_attempts_attempted_at", "login_attempts", ["attempted_at"])

    # ── users columns ─────────────────────────────────────────────────────────
    op.add_column("users", sa.Column("failed_login_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("mfa_required", sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("users", "mfa_required")
    op.drop_column("users", "must_change_password")
    op.drop_column("users", "password_changed_at")
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_count")

    op.drop_index("ix_login_attempts_attempted_at", table_name="login_attempts")
    op.drop_index("ix_login_attempts_ip_address", table_name="login_attempts")
    op.drop_index("ix_login_attempts_email", table_name="login_attempts")
    op.drop_table("login_attempts")

    op.drop_index("ix_user_mfa_user_id", table_name="user_mfa")
    op.drop_table("user_mfa")
