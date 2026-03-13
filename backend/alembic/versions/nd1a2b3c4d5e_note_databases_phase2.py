"""Y&U Notes Phase 2: Notion-style databases — tables, properties, views, and rows.

Revision ID: nd1a2b3c4d5e
Revises: z6u7v8w9x0y1
Create Date: 2026-03-12

Adds:
  - note_databases        — top-level database container (owner, notebook, page)
  - note_database_properties — typed column definitions per database
  - note_database_views   — saved view configurations (table/kanban/calendar/gallery/list/timeline)
  - note_database_rows    — individual records with JSON property values
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "nd1a2b3c4d5e"
down_revision = "z6u7v8w9x0y1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -----------------------------------------------------------------------
    # note_databases
    # -----------------------------------------------------------------------
    op.create_table(
        "note_databases",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "notebook_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("notebooks.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "page_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("notes.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("icon", sa.String(20), nullable=True),
        sa.Column("cover_image_url", sa.String(1000), nullable=True),
        sa.Column("is_shared", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("is_archived", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default=sa.text("0")),
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
            nullable=False,
        ),
    )

    # -----------------------------------------------------------------------
    # note_database_properties
    # -----------------------------------------------------------------------
    op.create_table(
        "note_database_properties",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "database_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("note_databases.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("property_type", sa.String(50), nullable=False),
        sa.Column("config", sa.JSON, nullable=True),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("is_visible", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("width", sa.Integer, nullable=False, server_default=sa.text("160")),
    )

    # -----------------------------------------------------------------------
    # note_database_views
    # -----------------------------------------------------------------------
    op.create_table(
        "note_database_views",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "database_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("note_databases.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("view_type", sa.String(50), nullable=False),
        sa.Column("config", sa.JSON, nullable=True),
        sa.Column("is_default", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default=sa.text("0")),
    )

    # -----------------------------------------------------------------------
    # note_database_rows
    # -----------------------------------------------------------------------
    op.create_table(
        "note_database_rows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "database_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("note_databases.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "page_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("notes.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("values", sa.JSON, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default=sa.text("0")),
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
            nullable=False,
        ),
        sa.Column(
            "created_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # -----------------------------------------------------------------------
    # Extra indexes (beyond those created inline above)
    # -----------------------------------------------------------------------
    op.create_index("ix_note_databases_owner_id", "note_databases", ["owner_id"])
    op.create_index("ix_note_databases_notebook_id", "note_databases", ["notebook_id"])
    op.create_index("ix_note_databases_page_id", "note_databases", ["page_id"])
    op.create_index("ix_note_database_properties_database_id", "note_database_properties", ["database_id"])
    op.create_index("ix_note_database_views_database_id", "note_database_views", ["database_id"])
    op.create_index("ix_note_database_rows_database_id", "note_database_rows", ["database_id"])


def downgrade() -> None:
    # Drop indexes first, then tables in reverse dependency order.

    op.drop_index("ix_note_database_rows_database_id", table_name="note_database_rows")
    op.drop_index("ix_note_database_views_database_id", table_name="note_database_views")
    op.drop_index("ix_note_database_properties_database_id", table_name="note_database_properties")
    op.drop_index("ix_note_databases_page_id", table_name="note_databases")
    op.drop_index("ix_note_databases_notebook_id", table_name="note_databases")
    op.drop_index("ix_note_databases_owner_id", table_name="note_databases")

    op.drop_table("note_database_rows")
    op.drop_table("note_database_views")
    op.drop_table("note_database_properties")
    op.drop_table("note_databases")
