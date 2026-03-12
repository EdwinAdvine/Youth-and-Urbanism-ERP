"""Add Y&U Teams chat tables: channels, members, messages, receipts, tabs, pins, bookmarks.

Revision ID: x4s5t6u7v8w9
Revises: w3r4s5t6u7v8
Create Date: 2026-03-12

Adds:
  - chat_channels (conversation spaces: public/private/direct/group/announcement)
  - chat_channel_members (membership + preferences)
  - chat_messages (persistent messages with threading, reactions, attachments)
  - chat_message_read_receipts (per-user read tracking)
  - chat_channel_tabs (configurable tabs pinned to channels)
  - chat_pinned_messages (pinned messages for easy reference)
  - chat_user_bookmarks (personal message bookmarks)
  - users.is_bot flag for system bot users
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "x4s5t6u7v8w9"
down_revision = "w3r4s5t6u7v8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Add is_bot flag to users table ────────────────────────────────────────
    op.add_column(
        "users",
        sa.Column("is_bot", sa.Boolean(), nullable=False, server_default=sa.text("false"),
                  comment="System bot users (AI assistant, webhook bots)"),
    )

    # ── chat_channels ─────────────────────────────────────────────────────────
    op.create_table(
        "chat_channels",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=True,
                  comment="Null for DMs and group chats not tied to a team"),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("channel_type", sa.String(20), nullable=False, server_default="public",
                  comment="public | private | direct | group | announcement"),
        sa.Column("topic", sa.String(500), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_starred", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True,
                  comment="Denormalized for fast channel list sorting"),
        sa.Column("message_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("linked_entity_type", sa.String(50), nullable=True,
                  comment="e.g. 'project', 'deal', 'ticket' for auto-created channels"),
        sa.Column("linked_entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_chat_channels_team", "chat_channels", ["team_id"])
    op.create_index("ix_chat_channels_type", "chat_channels", ["channel_type"])
    op.create_index("ix_chat_channels_slug", "chat_channels", ["team_id", "slug"], unique=True)

    # ── chat_channel_members ──────────────────────────────────────────────────
    op.create_table(
        "chat_channel_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("channel_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("chat_channels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="member",
                  comment="owner | admin | member"),
        sa.Column("notifications_pref", sa.String(20), nullable=False, server_default="all",
                  comment="all | mentions | none"),
        sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_muted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("channel_id", "user_id"),
    )
    op.create_index("ix_chat_channel_members_user", "chat_channel_members", ["user_id"])

    # ── chat_messages ─────────────────────────────────────────────────────────
    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("channel_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("chat_channels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("content_type", sa.String(20), nullable=False, server_default="text",
                  comment="text | system | file | card | action"),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("chat_messages.id", ondelete="SET NULL"), nullable=True,
                  comment="Parent message for threaded replies"),
        sa.Column("thread_reply_count", sa.Integer(), nullable=False, server_default=sa.text("0"),
                  comment="Denormalized count of replies in this thread"),
        sa.Column("thread_last_reply_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reactions", postgresql.JSON(), nullable=True,
                  comment='{"thumbsup": ["user_id1"], "heart": ["user_id2"]}'),
        sa.Column("mentions", postgresql.JSON(), nullable=True,
                  comment='["user_id1", "@channel", "@here"]'),
        sa.Column("attachments", postgresql.JSON(), nullable=True,
                  comment='[{"file_id": "...", "name": "...", "size": 1234, "mime": "..."}]'),
        sa.Column("metadata", postgresql.JSON(), nullable=True,
                  comment="Flexible payload for cards/actions: {action, params, result, status}"),
        sa.Column("is_edited", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_chat_messages_channel_created", "chat_messages", ["channel_id", "created_at"])
    op.create_index("ix_chat_messages_parent", "chat_messages", ["parent_id"])
    op.create_index("ix_chat_messages_sender", "chat_messages", ["sender_id"])

    # ── chat_message_read_receipts ────────────────────────────────────────────
    op.create_table(
        "chat_message_read_receipts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("message_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("message_id", "user_id"),
    )
    op.create_index("ix_chat_read_receipts_user", "chat_message_read_receipts", ["user_id"])

    # ── chat_channel_tabs ─────────────────────────────────────────────────────
    op.create_table(
        "chat_channel_tabs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("channel_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("chat_channels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tab_type", sa.String(50), nullable=False,
                  comment="files | tasks | notes | wiki | dashboard | form | custom_url"),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("config", postgresql.JSON(), nullable=True,
                  comment="Type-specific config: {folder_id, project_id, url, form_id, ...}"),
        sa.Column("position", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_chat_channel_tabs_channel", "chat_channel_tabs", ["channel_id"])

    # ── chat_pinned_messages ──────────────────────────────────────────────────
    op.create_table(
        "chat_pinned_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("channel_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("chat_channels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("message_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pinned_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("channel_id", "message_id"),
    )

    # ── chat_user_bookmarks ───────────────────────────────────────────────────
    op.create_table(
        "chat_user_bookmarks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("message_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("note", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "message_id"),
    )


def downgrade() -> None:
    op.drop_table("chat_user_bookmarks")
    op.drop_table("chat_pinned_messages")
    op.drop_table("chat_channel_tabs")
    op.drop_table("chat_message_read_receipts")
    op.drop_table("chat_messages")
    op.drop_table("chat_channel_members")
    op.drop_table("chat_channels")
    op.drop_column("users", "is_bot")
