"""Y&U Notes hierarchy upgrade: notebooks, sections, sub-pages, entity links, versions, comments, collaboration, audit.

Revision ID: z6u7v8w9x0y1
Revises: y5t6u7v8w9x0
Create Date: 2026-03-12

Adds:
  - New tables: notebooks, notebook_sections, note_entity_links, note_versions,
    note_comments, note_collab_snapshots, note_collab_updates, note_audit_logs,
    note_sensitivity_labels
  - Extended notes table: notebook_id, section_id, parent_page_id, content_format,
    icon, cover_image_url, full_width, sort_order, is_archived, word_count,
    properties, source_type
  - Extended note_templates: content_tiptap_json, description, icon,
    erp_merge_fields, preview_image_url, is_system
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "z6u7v8w9x0y1"
down_revision = "y5t6u7v8w9x0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- New tables ---

    op.create_table(
        "notebooks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False, server_default="Untitled Notebook"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("cover_image_url", sa.String(1000), nullable=True),
        sa.Column("is_default", sa.Boolean, server_default=sa.text("false"), nullable=False),
        sa.Column("is_shared", sa.Boolean, server_default=sa.text("false"), nullable=False),
        sa.Column("sort_order", sa.Integer, server_default=sa.text("0"), nullable=False),
        sa.Column("is_archived", sa.Boolean, server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "notebook_sections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("notebook_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notebooks.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("title", sa.String(500), nullable=False, server_default="Untitled Section"),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("sort_order", sa.Integer, server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "note_entity_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("note_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("link_type", sa.String(30), nullable=False, server_default="references"),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "note_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("note_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("version_number", sa.Integer, nullable=False),
        sa.Column("content_snapshot", sa.Text, nullable=False),
        sa.Column("content_format", sa.String(20), nullable=False, server_default="tiptap_json"),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("label", sa.String(255), nullable=True),
        sa.Column("word_count", sa.Integer, server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "note_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("note_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("parent_comment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("note_comments.id", ondelete="CASCADE"), nullable=True),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("anchor_block_id", sa.String(100), nullable=True),
        sa.Column("anchor_text", sa.String(500), nullable=True),
        sa.Column("is_resolved", sa.Boolean, server_default=sa.text("false"), nullable=False),
        sa.Column("resolved_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "note_collab_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("note_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("snapshot", sa.LargeBinary, nullable=False),
        sa.Column("version", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "note_collab_updates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("note_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("update_data", sa.LargeBinary, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "note_audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("note_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("details", postgresql.JSON, nullable=True),
        sa.Column("ip_address", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "note_sensitivity_labels",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("level", sa.Integer, nullable=False),
        sa.Column("color", sa.String(20), nullable=False, server_default="#6b7280"),
        sa.Column("restrictions", postgresql.JSON, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # --- Extend notes table ---

    op.add_column("notes", sa.Column("notebook_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notebooks.id", ondelete="SET NULL"), nullable=True))
    op.add_column("notes", sa.Column("section_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notebook_sections.id", ondelete="SET NULL"), nullable=True))
    op.add_column("notes", sa.Column("parent_page_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notes.id", ondelete="SET NULL"), nullable=True))
    op.add_column("notes", sa.Column("content_format", sa.String(20), nullable=False, server_default="html"))
    op.add_column("notes", sa.Column("icon", sa.String(50), nullable=True))
    op.add_column("notes", sa.Column("cover_image_url", sa.String(1000), nullable=True))
    op.add_column("notes", sa.Column("full_width", sa.Boolean, server_default=sa.text("false"), nullable=False))
    op.add_column("notes", sa.Column("sort_order", sa.Integer, server_default=sa.text("0"), nullable=False))
    op.add_column("notes", sa.Column("is_archived", sa.Boolean, server_default=sa.text("false"), nullable=False))
    op.add_column("notes", sa.Column("word_count", sa.Integer, server_default=sa.text("0"), nullable=False))
    op.add_column("notes", sa.Column("properties", postgresql.JSON, nullable=True))
    op.add_column("notes", sa.Column("source_type", sa.String(30), nullable=False, server_default="manual"))

    op.create_index("ix_notes_notebook_id", "notes", ["notebook_id"])
    op.create_index("ix_notes_section_id", "notes", ["section_id"])
    op.create_index("ix_notes_parent_page_id", "notes", ["parent_page_id"])

    # --- Extend note_templates table ---

    op.add_column("note_templates", sa.Column("content_tiptap_json", sa.Text, nullable=True))
    op.add_column("note_templates", sa.Column("description", sa.Text, nullable=True))
    op.add_column("note_templates", sa.Column("icon", sa.String(50), nullable=True))
    op.add_column("note_templates", sa.Column("erp_merge_fields", postgresql.JSON, nullable=True))
    op.add_column("note_templates", sa.Column("preview_image_url", sa.String(1000), nullable=True))
    op.add_column("note_templates", sa.Column("is_system", sa.Boolean, server_default=sa.text("false"), nullable=False))


def downgrade() -> None:
    # Drop extended note_templates columns
    op.drop_column("note_templates", "is_system")
    op.drop_column("note_templates", "preview_image_url")
    op.drop_column("note_templates", "erp_merge_fields")
    op.drop_column("note_templates", "icon")
    op.drop_column("note_templates", "description")
    op.drop_column("note_templates", "content_tiptap_json")

    # Drop extended notes columns
    op.drop_index("ix_notes_parent_page_id", "notes")
    op.drop_index("ix_notes_section_id", "notes")
    op.drop_index("ix_notes_notebook_id", "notes")
    op.drop_column("notes", "source_type")
    op.drop_column("notes", "properties")
    op.drop_column("notes", "word_count")
    op.drop_column("notes", "is_archived")
    op.drop_column("notes", "sort_order")
    op.drop_column("notes", "full_width")
    op.drop_column("notes", "cover_image_url")
    op.drop_column("notes", "icon")
    op.drop_column("notes", "content_format")
    op.drop_column("notes", "parent_page_id")
    op.drop_column("notes", "section_id")
    op.drop_column("notes", "notebook_id")

    # Drop new tables
    op.drop_table("note_sensitivity_labels")
    op.drop_table("note_audit_logs")
    op.drop_table("note_collab_updates")
    op.drop_table("note_collab_snapshots")
    op.drop_table("note_comments")
    op.drop_table("note_versions")
    op.drop_table("note_entity_links")
    op.drop_table("notebook_sections")
    op.drop_table("notebooks")
