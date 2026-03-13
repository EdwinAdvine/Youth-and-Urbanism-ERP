"""Y&U Forms comprehensive upgrade: 30+ field types, versions, webhooks, audit, options, sandbox.

Revision ID: fc1a2b3c4d5e
Revises: z6u7v8w9x0y1
Create Date: 2026-03-12

Adds:
  - New tables: form_field_options, form_versions, form_webhooks, form_audit_logs
  - Extended form_fields: page_number, description, placeholder, metadata
  - Extended form_responses: is_sandbox
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "fc1a2b3c4d5e"
down_revision = "z6u7v8w9x0y1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Extend form_fields ──────────────────────────────────────────────────
    op.add_column(
        "form_fields",
        sa.Column("page_number", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "form_fields",
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.add_column(
        "form_fields",
        sa.Column("placeholder", sa.String(500), nullable=True),
    )
    op.add_column(
        "form_fields",
        sa.Column("metadata", postgresql.JSON(astext_type=sa.Text()), nullable=True),
    )

    # ── Extend form_responses ───────────────────────────────────────────────
    op.add_column(
        "form_responses",
        sa.Column("is_sandbox", sa.Boolean(), nullable=False, server_default="false"),
    )

    # ── form_field_options ──────────────────────────────────────────────────
    op.create_table(
        "form_field_options",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "field_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("form_fields.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("label", sa.String(500), nullable=False),
        sa.Column("value", sa.String(500), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "parent_option_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("form_field_options.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("is_correct", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # ── form_versions ───────────────────────────────────────────────────────
    op.create_table(
        "form_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "form_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("forms.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("version_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "schema_snapshot",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "published_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # ── form_webhooks ───────────────────────────────────────────────────────
    op.create_table(
        "form_webhooks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "form_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("forms.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("url", sa.String(2000), nullable=False),
        sa.Column("secret", sa.String(500), nullable=True),
        sa.Column(
            "events",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # ── form_audit_logs ─────────────────────────────────────────────────────
    op.create_table(
        "form_audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "form_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("forms.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column(
            "details",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("form_audit_logs")
    op.drop_table("form_webhooks")
    op.drop_table("form_versions")
    op.drop_table("form_field_options")

    op.drop_column("form_responses", "is_sandbox")
    op.drop_column("form_fields", "metadata")
    op.drop_column("form_fields", "placeholder")
    op.drop_column("form_fields", "description")
    op.drop_column("form_fields", "page_number")
