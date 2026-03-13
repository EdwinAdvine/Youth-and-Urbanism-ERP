"""Y&U Docs Phase 2 + Phase 3 models: spreadsheet data connections, audit logs,
security settings, template categories, template favorites.

Revision ID: dp1a2b3c4d5e
Revises: z6u7v8w9x0y1
Create Date: 2026-03-12

Adds:
  - spreadsheet_data_connections
  - document_audit_logs
  - document_security
  - document_template_categories
  - document_template_favorites
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "dp1a2b3c4d5e"
down_revision = "z6u7v8w9x0y1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── spreadsheet_data_connections ─────────────────────────────────────────
    op.create_table(
        "spreadsheet_data_connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "file_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("drive_files.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("source_module", sa.String(100), nullable=False),
        sa.Column("query_type", sa.String(100), nullable=False),
        sa.Column("query_params", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("target_range", sa.String(100), nullable=False),
        sa.Column("refresh_interval_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_refreshed", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cached_data", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── document_audit_logs ───────────────────────────────────────────────────
    op.create_table(
        "document_audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "file_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("drive_files.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("details", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("ip_address", sa.String(50), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── document_security ─────────────────────────────────────────────────────
    op.create_table(
        "document_security",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "file_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("drive_files.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
            index=True,
        ),
        sa.Column("classification", sa.String(50), nullable=False, server_default="internal"),
        sa.Column("prevent_download", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("prevent_print", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("prevent_copy", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("watermark_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("watermark_text", sa.String(200), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── document_template_categories ─────────────────────────────────────────
    op.create_table(
        "document_template_categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(200), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── document_template_favorites ───────────────────────────────────────────
    op.create_table(
        "document_template_favorites",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "template_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("document_templates.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # Seed default template categories
    op.execute("""
        INSERT INTO document_template_categories (id, name, description, icon, sort_order)
        VALUES
            (gen_random_uuid(), 'Finance', 'Invoices, reports, budgets', 'DollarSign', 1),
            (gen_random_uuid(), 'HR', 'Contracts, payslips, reviews', 'Users', 2),
            (gen_random_uuid(), 'Legal', 'NDAs, agreements, policies', 'Scale', 3),
            (gen_random_uuid(), 'Marketing', 'Proposals, presentations, briefs', 'Megaphone', 4),
            (gen_random_uuid(), 'Operations', 'SOPs, reports, manuals', 'Settings', 5),
            (gen_random_uuid(), 'General', 'Letters, memos, notes', 'FileText', 6)
        ON CONFLICT (name) DO NOTHING;
    """)


def downgrade() -> None:
    op.drop_table("document_template_favorites")
    op.drop_table("document_template_categories")
    op.drop_table("document_security")
    op.drop_table("document_audit_logs")
    op.drop_table("spreadsheet_data_connections")
