"""Drive AI upgrade: content extraction, embeddings, smart folders, activity logging.

Revision ID: y5t6u7v8w9x0
Revises: x4s5t6u7v8w9
Create Date: 2026-03-12

Adds:
  - DriveFile new columns: file_content_text, content_embedding (pgvector), content_hash,
    ai_processed, is_locked, locked_by, locked_at, sensitivity_level, is_on_hold
  - DriveFolder new columns: description, color, icon, is_pinned
  - FileTag new columns: color, source
  - FileComment new columns: parent_id (threading), is_resolved
  - TrashBin new column: folder_id
  - New tables: file_ai_metadata, smart_folders, saved_views, file_metadata,
    file_access_logs, drive_snapshots, sensitivity_labels
  - pg_trgm extension + GIN index for fuzzy filename search
  - pgvector HNSW index for semantic search
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON, UUID


# revision identifiers, used by Alembic.
revision = "y5t6u7v8w9x0"
down_revision = "x4s5t6u7v8w9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pg_trgm extension for fuzzy search
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # ── DriveFolder enhancements ──────────────────────────────────────────
    op.add_column("drive_folders", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("drive_folders", sa.Column("color", sa.String(20), nullable=True))
    op.add_column("drive_folders", sa.Column("icon", sa.String(50), nullable=True))
    op.add_column("drive_folders", sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default="false"))

    # ── DriveFile AI + locking columns ────────────────────────────────────
    op.add_column("drive_files", sa.Column("file_content_text", sa.Text(), nullable=True))
    op.add_column("drive_files", sa.Column("content_hash", sa.String(64), nullable=True))
    op.add_column("drive_files", sa.Column("ai_processed", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("drive_files", sa.Column("is_locked", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("drive_files", sa.Column("locked_by", UUID(as_uuid=True),
                   sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))
    op.add_column("drive_files", sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("drive_files", sa.Column("sensitivity_level", sa.String(30), nullable=True))
    op.add_column("drive_files", sa.Column("is_on_hold", sa.Boolean(), nullable=False, server_default="false"))

    # pgvector embedding column (1024-dim for nomic-embed-text / mxbai-embed-large)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("ALTER TABLE drive_files ADD COLUMN content_embedding vector(1024)")

    # HNSW index for fast cosine similarity search
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_drive_files_embedding_hnsw
        ON drive_files USING hnsw (content_embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)

    # GIN trigram index for fuzzy filename search
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_drive_files_name_trgm
        ON drive_files USING gin (name gin_trgm_ops)
    """)

    # Full-text search: add tsvector column + GIN index
    op.execute("ALTER TABLE drive_files ADD COLUMN search_vector tsvector")
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_drive_files_search_vector
        ON drive_files USING gin (search_vector)
    """)
    # Trigger to auto-update search_vector on name/file_content_text changes
    op.execute("""
        CREATE OR REPLACE FUNCTION drive_files_search_vector_update() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector :=
                setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
                setweight(to_tsvector('english', COALESCE(LEFT(NEW.file_content_text, 100000), '')), 'B');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER drive_files_search_vector_trigger
        BEFORE INSERT OR UPDATE OF name, file_content_text
        ON drive_files
        FOR EACH ROW
        EXECUTE FUNCTION drive_files_search_vector_update()
    """)

    # ── FileTag enhancements ──────────────────────────────────────────────
    op.add_column("file_tags", sa.Column("color", sa.String(20), nullable=True))
    op.add_column("file_tags", sa.Column("source", sa.String(20), nullable=False, server_default="manual"))

    # ── FileComment threading ─────────────────────────────────────────────
    op.add_column("file_comments", sa.Column("parent_id", UUID(as_uuid=True),
                   sa.ForeignKey("file_comments.id", ondelete="CASCADE"), nullable=True))
    op.add_column("file_comments", sa.Column("is_resolved", sa.Boolean(), nullable=False, server_default="false"))
    op.create_index("ix_file_comments_parent_id", "file_comments", ["parent_id"])

    # ── TrashBin folder support ───────────────────────────────────────────
    op.add_column("trash_bin", sa.Column("folder_id", UUID(as_uuid=True),
                   sa.ForeignKey("drive_folders.id", ondelete="SET NULL"), nullable=True))
    op.create_index("ix_trash_bin_folder_id", "trash_bin", ["folder_id"])

    # ── FileShare link_scope ──────────────────────────────────────────────
    op.add_column("file_shares", sa.Column("link_scope", sa.String(30), nullable=True, server_default="anyone"))

    # ── New tables ────────────────────────────────────────────────────────

    # file_ai_metadata
    op.create_table(
        "file_ai_metadata",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("file_id", UUID(as_uuid=True), sa.ForeignKey("drive_files.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("entities_json", JSON, nullable=True),
        sa.Column("suggested_tags", JSON, nullable=True),
        sa.Column("sensitivity_level", sa.String(30), nullable=True),
        sa.Column("language", sa.String(10), nullable=True),
        sa.Column("word_count", sa.Integer(), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("processing_error", sa.Text(), nullable=True),
        sa.Column("module_suggestions", JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_file_ai_metadata_file_id", "file_ai_metadata", ["file_id"])

    # smart_folders
    op.create_table(
        "smart_folders",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filter_json", JSON, nullable=False, server_default="{}"),
        sa.Column("sort_field", sa.String(50), nullable=False, server_default="created_at"),
        sa.Column("sort_direction", sa.String(4), nullable=False, server_default="desc"),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_smart_folders_owner_id", "smart_folders", ["owner_id"])

    # saved_views
    op.create_table(
        "saved_views",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("folder_id", UUID(as_uuid=True),
                  sa.ForeignKey("drive_folders.id", ondelete="CASCADE"), nullable=True),
        sa.Column("filters_json", JSON, nullable=True),
        sa.Column("sort_json", JSON, nullable=True),
        sa.Column("columns_json", JSON, nullable=True),
        sa.Column("view_type", sa.String(20), nullable=False, server_default="list"),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_saved_views_owner_id", "saved_views", ["owner_id"])
    op.create_index("ix_saved_views_folder_id", "saved_views", ["folder_id"])

    # file_metadata (key-value)
    op.create_table(
        "file_metadata",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("file_id", UUID(as_uuid=True), sa.ForeignKey("drive_files.id", ondelete="CASCADE"), nullable=False),
        sa.Column("key", sa.String(100), nullable=False),
        sa.Column("value", sa.Text(), nullable=True),
        sa.Column("value_type", sa.String(20), nullable=False, server_default="string"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_file_metadata_file_id", "file_metadata", ["file_id"])
    op.create_index("ix_file_metadata_key_value", "file_metadata", ["key", "value"])

    # file_access_logs
    op.create_table(
        "file_access_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("file_id", UUID(as_uuid=True), sa.ForeignKey("drive_files.id", ondelete="SET NULL"), nullable=True),
        sa.Column("folder_id", UUID(as_uuid=True),
                  sa.ForeignKey("drive_folders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("metadata_json", JSON, nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_file_access_logs_user_id", "file_access_logs", ["user_id"])
    op.create_index("ix_file_access_logs_file_id", "file_access_logs", ["file_id"])
    op.create_index("ix_file_access_logs_folder_id", "file_access_logs", ["folder_id"])
    op.create_index("ix_file_access_logs_timestamp", "file_access_logs", ["timestamp"])
    op.create_index("ix_file_access_logs_action", "file_access_logs", ["action"])

    # drive_snapshots
    op.create_table(
        "drive_snapshots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("snapshot_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("metadata_json", JSON, nullable=False, server_default="{}"),
        sa.Column("file_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_size", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_drive_snapshots_owner_id", "drive_snapshots", ["owner_id"])

    # sensitivity_labels
    op.create_table(
        "sensitivity_labels",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(50), nullable=False, unique=True),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(20), nullable=False, server_default="#6b7280"),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column("severity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("block_external_sharing", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("block_public_links", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("require_password_for_links", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("max_link_expiry_hours", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Seed default sensitivity labels
    op.execute("""
        INSERT INTO sensitivity_labels (id, name, display_name, description, color, severity, block_external_sharing, block_public_links)
        VALUES
            (gen_random_uuid(), 'public', 'Public', 'Can be shared freely', '#22c55e', 0, false, false),
            (gen_random_uuid(), 'internal', 'Internal', 'For internal use only', '#3b82f6', 10, true, false),
            (gen_random_uuid(), 'confidential', 'Confidential', 'Restricted access', '#f59e0b', 20, true, true),
            (gen_random_uuid(), 'highly_confidential', 'Highly Confidential', 'Strictly controlled', '#ef4444', 30, true, true)
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS drive_files_search_vector_trigger ON drive_files")
    op.execute("DROP FUNCTION IF EXISTS drive_files_search_vector_update()")
    op.execute("DROP INDEX IF EXISTS ix_drive_files_search_vector")
    op.execute("DROP INDEX IF EXISTS ix_drive_files_name_trgm")
    op.execute("DROP INDEX IF EXISTS ix_drive_files_embedding_hnsw")

    op.drop_table("sensitivity_labels")
    op.drop_table("drive_snapshots")
    op.drop_table("file_access_logs")
    op.drop_table("file_metadata")
    op.drop_table("saved_views")
    op.drop_table("smart_folders")
    op.drop_table("file_ai_metadata")

    op.drop_column("file_shares", "link_scope")
    op.drop_index("ix_trash_bin_folder_id", "trash_bin")
    op.drop_column("trash_bin", "folder_id")
    op.drop_index("ix_file_comments_parent_id", "file_comments")
    op.drop_column("file_comments", "is_resolved")
    op.drop_column("file_comments", "parent_id")
    op.drop_column("file_tags", "source")
    op.drop_column("file_tags", "color")

    op.drop_column("drive_files", "search_vector")
    op.drop_column("drive_files", "content_embedding")
    op.drop_column("drive_files", "is_on_hold")
    op.drop_column("drive_files", "sensitivity_level")
    op.drop_column("drive_files", "locked_at")
    op.drop_column("drive_files", "locked_by")
    op.drop_column("drive_files", "is_locked")
    op.drop_column("drive_files", "ai_processed")
    op.drop_column("drive_files", "content_hash")
    op.drop_column("drive_files", "file_content_text")

    op.drop_column("drive_folders", "is_pinned")
    op.drop_column("drive_folders", "icon")
    op.drop_column("drive_folders", "color")
    op.drop_column("drive_folders", "description")
